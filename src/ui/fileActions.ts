import { useState } from 'react';
import { FLOOR_LABELS } from '../content/types';
import type { JobData, Photo, Role } from '../job/types';
import { FileFormatError, isAbortError, parse, pickFile, prepareForSave, serialize, suggestedFileName, writeFile, downloadBlob, type ParsedFile } from '../lib/fileio';
import { useSession } from '../store/session';
import { dismissToast, toast } from './common';

/** Save the current job. `saveAs` asks for a new file name/location. */
export async function saveJob(opts: { saveAs?: boolean } = {}): Promise<boolean> {
  const s = useSession.getState();
  if (!s.data) return false;
  try {
    const data = await prepareForSave(s.data, s.photos, s.content);
    const blob = await serialize(data, s.photos);
    const handle = await writeFile(blob, suggestedFileName(data), s.handle, !!opts.saveAs || !s.handle);
    useSession.getState().markSaved(data, handle);
    toast(handle ? `Saved to ${handle.name}` : `Downloaded ${suggestedFileName(data)} — keep it somewhere safe`, 'ok');
    return true;
  } catch (e) {
    if (isAbortError(e)) return false;
    console.error(e);
    toast('Could not save the file. Try "Save as" to choose another place.', 'error');
    return false;
  }
}

export async function exportPdf(mode: 'draft' | 'final') {
  const s = useSession.getState();
  if (!s.data) return;
  const busy = toast(mode === 'draft' ? 'Making the draft PDF…' : 'Making the final PDF…');
  try {
    const { generatePdf } = await import('../lib/pdf');
    const blob = await generatePdf(s.content, { ...s.data, savedAt: s.data.savedAt || new Date().toISOString() }, s.photos, mode);
    const name = `${s.data.job.jobNo || 'Job'} ${FLOOR_LABELS[s.data.job.floor]} - ${mode === 'draft' ? 'DRAFT checklist' : 'Final checklist report'}.pdf`;
    downloadBlob(blob, name);
    dismissToast(busy);
    toast(`Downloaded ${name}`, 'ok');
  } catch (e) {
    console.error(e);
    dismissToast(busy);
    toast('Could not make the PDF. Please try again.', 'error');
  }
}

export interface PendingOpen {
  parsed: ParsedFile;
  handle: FileSystemFileHandle | null;
  name: string;
}

/** Read a picked or dropped file. Errors are shown as toasts. */
export async function readJobFile(bytes: ArrayBuffer, name: string, handle: FileSystemFileHandle | null): Promise<PendingOpen | null> {
  try {
    const parsed = await parse(bytes);
    return { parsed, handle, name };
  } catch (e) {
    toast(e instanceof FileFormatError ? e.message : 'Could not open this file.', 'error');
    return null;
  }
}

export async function pickJobFile(): Promise<PendingOpen | null> {
  try {
    const picked = await pickFile();
    if (!picked) return null;
    return readJobFile(picked.bytes, picked.name, picked.handle);
  } catch (e) {
    if (!isAbortError(e)) toast('Could not open this file.', 'error');
    return null;
  }
}

/** Confirm before throwing away unsaved work. */
export function confirmDiscard(): boolean {
  const { dirty, data } = useSession.getState();
  if (!data || !dirty) return true;
  return window.confirm('You have unsaved changes. If you continue, they will be lost.\n\nPress Cancel, then "Save", to keep them.');
}

export function openJob(p: PendingOpen, role: Role, reviewerName?: string) {
  useSession.getState().loadJob({
    data: p.parsed.data,
    photos: p.parsed.photos,
    // A checker saves to a new "Review" file — never over the detailer's file.
    handle: role === 'checker' ? null : p.handle,
    role,
    reviewerName,
    fingerprintOk: p.parsed.fingerprintOk,
  });
}

export function usePendingOpen() {
  return useState<PendingOpen | null>(null);
}

/** In-progress files open straight away for the detailer; review files ask who is opening them. */
export function beginOpen(p: PendingOpen | null, showDialog: (p: PendingOpen) => void) {
  if (!p) return;
  if (!confirmDiscard()) return;
  if (p.parsed.data.stage === 'review') showDialog(p);
  else openJob(p, 'detailer');
}

export type { JobData, Photo };
