import JSZip from 'jszip';
import type { ChecklistContent } from '../content/types';
import { FLOOR_LABELS } from '../content/types';
import { parseJobData } from '../content/schema';
import type { JobData, Photo } from '../job/types';
import { sha256Hex, shortHash, stableStringify } from './hash';

export const FILE_EXTENSION = '.chck';

/** Hash of everything in the file except the fingerprint itself and the save time. */
export async function computeFingerprint(data: JobData, photos: Photo[]): Promise<string> {
  const { fingerprint: _f, savedAt: _s, ...rest } = data;
  const photoPart = [...photos]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((p) => `${p.id}:${shortHash(p.dataUrl)}`)
    .join('|');
  return sha256Hex(`${stableStringify(rest)}#${photoPart}`);
}

export function itemDefHashes(content: ChecklistContent): Record<string, string> {
  const out: Record<string, string> = {};
  for (const item of content.items) out[item.id] = shortHash(item);
  return out;
}

export interface ContentChanges {
  added: string[];
  changed: string[];
  removed: string[];
}

/** Compare the item definitions stored in a file with the current content. */
export function contentChanges(saved: Record<string, string>, content: ChecklistContent): ContentChanges {
  const now = itemDefHashes(content);
  const added = Object.keys(now).filter((id) => !(id in saved));
  const changed = Object.keys(now).filter((id) => id in saved && saved[id] !== now[id]);
  const removed = Object.keys(saved).filter((id) => !(id in now));
  return { added, changed, removed };
}

/** Called on every save: stamps time, content version, item hashes and fingerprint. */
export async function prepareForSave(data: JobData, photos: Photo[], content: ChecklistContent): Promise<JobData> {
  const stamped: JobData = {
    ...data,
    savedAt: new Date().toISOString(),
    contentVersion: content.version,
    itemDefs: itemDefHashes(content),
  };
  stamped.fingerprint = await computeFingerprint(stamped, photos);
  return stamped;
}

function extFromMime(mime: string): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/gif') return 'gif';
  return 'jpg';
}

async function dataUrlToBytes(dataUrl: string): Promise<Uint8Array> {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return `data:${mime};base64,${btoa(bin)}`;
}

/** Plain JSON when there are no photos; a zip (job.json + photos/) when there are. */
export async function serialize(data: JobData, photos: Photo[]): Promise<Blob> {
  const json = JSON.stringify(data, null, 2);
  if (photos.length === 0) return new Blob([json], { type: 'application/json' });
  const zip = new JSZip();
  zip.file('job.json', json);
  const meta = photos.map((p) => ({ id: p.id, name: p.name, mime: p.mime, file: `photos/${p.id}.${extFromMime(p.mime)}` }));
  zip.file('photos.json', JSON.stringify(meta, null, 2));
  for (const [i, p] of photos.entries()) zip.file(meta[i].file, await dataUrlToBytes(p.dataUrl));
  return zip.generateAsync({ type: 'blob', mimeType: 'application/zip' });
}

export class FileFormatError extends Error {}

export interface ParsedFile {
  data: JobData;
  photos: Photo[];
  /** false when the fingerprint does not match: the file was edited outside the app. */
  fingerprintOk: boolean;
}

export async function parse(bytes: ArrayBuffer): Promise<ParsedFile> {
  const head = new Uint8Array(bytes.slice(0, 4));
  const isZip = head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04;
  let raw: unknown;
  let photos: Photo[] = [];
  try {
    if (isZip) {
      const zip = await JSZip.loadAsync(bytes);
      const jobFile = zip.file('job.json');
      if (!jobFile) throw new FileFormatError('This file is missing job data.');
      raw = JSON.parse(await jobFile.async('string'));
      const metaFile = zip.file('photos.json');
      if (metaFile) {
        const meta = JSON.parse(await metaFile.async('string')) as { id: string; name: string; mime: string; file: string }[];
        for (const m of meta) {
          const f = zip.file(m.file);
          if (!f) continue;
          photos.push({ id: m.id, name: m.name, mime: m.mime, dataUrl: bytesToDataUrl(await f.async('uint8array'), m.mime) });
        }
      }
    } else {
      raw = JSON.parse(new TextDecoder().decode(bytes));
    }
  } catch (e) {
    if (e instanceof FileFormatError) throw e;
    throw new FileFormatError('This is not a checklist file (.chck), or the file is damaged.');
  }
  let data: JobData;
  try {
    data = parseJobData(raw);
  } catch {
    throw new FileFormatError('This file could not be read. It may be from a newer version of the app, or it was damaged.');
  }
  const fingerprintOk = (await computeFingerprint(data, photos)) === data.fingerprint;
  return { data, photos, fingerprintOk };
}

export function suggestedFileName(data: JobData): string {
  const base = `${data.job.jobNo || 'New job'} ${FLOOR_LABELS[data.job.floor]}`.replace(/[\\/:*?"<>|]/g, '-').trim();
  if (data.stage === 'review') {
    const round = data.review.rounds.at(-1)?.round;
    return `${base} - Review${round ? ` ${round}` : ''}${FILE_EXTENSION}`;
  }
  return `${base}${FILE_EXTENSION}`;
}

// ─── Browser file access ───
// Chrome/Edge: File System Access API, so "Save" writes back to the same file.
// Other browsers: download a copy.

interface PickerType {
  description: string;
  accept: Record<string, string[]>;
}
interface FsWindow {
  showSaveFilePicker?: (opts: { suggestedName?: string; types?: PickerType[] }) => Promise<FileSystemFileHandle>;
  showOpenFilePicker?: (opts: { types?: PickerType[]; multiple?: boolean }) => Promise<FileSystemFileHandle[]>;
}
type WritableHandle = FileSystemFileHandle & {
  createWritable: () => Promise<{ write: (b: Blob) => Promise<void>; close: () => Promise<void> }>;
};

const PICKER_TYPES: PickerType[] = [{ description: 'Lawmans checklist', accept: { 'application/x-lawmans-chck': [FILE_EXTENSION] } }];

export function canSaveInPlace(): boolean {
  return typeof window !== 'undefined' && typeof (window as unknown as FsWindow).showSaveFilePicker === 'function';
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Returns the handle that was written to (for later in-place saves), or null for a download. */
export async function writeFile(blob: Blob, name: string, handle: FileSystemFileHandle | null, saveAs: boolean): Promise<FileSystemFileHandle | null> {
  const w = window as unknown as FsWindow;
  if (!w.showSaveFilePicker) {
    downloadBlob(blob, name);
    return null;
  }
  let target = handle;
  if (!target || saveAs) target = await w.showSaveFilePicker({ suggestedName: name, types: PICKER_TYPES });
  const writable = await (target as WritableHandle).createWritable();
  await writable.write(blob);
  await writable.close();
  return target;
}

export async function pickFile(): Promise<{ bytes: ArrayBuffer; name: string; handle: FileSystemFileHandle | null } | null> {
  const w = window as unknown as FsWindow;
  if (w.showOpenFilePicker) {
    const [handle] = await w.showOpenFilePicker({ types: PICKER_TYPES, multiple: false });
    const file = await handle.getFile();
    return { bytes: await file.arrayBuffer(), name: file.name, handle };
  }
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = FILE_EXTENSION;
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      resolve({ bytes: await file.arrayBuffer(), name: file.name, handle: null });
    };
    input.click();
  });
}

export function isAbortError(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError';
}
