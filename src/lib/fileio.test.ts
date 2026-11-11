import { describe, expect, it } from 'vitest';
import { defaultContent } from '../content/defaultContent';
import { emptyConditions, newJobData, newWall } from '../job/factory';
import type { Photo } from '../job/types';
import { contentChanges, FileFormatError, parse, prepareForSave, serialize, suggestedFileName } from './fileio';
import { buildDocDefinition } from './pdf';

function sample() {
  const data = newJobData({
    jobNo: '26-89',
    builderId: 'ashmont',
    addressLine1: 'Lot 4413 No 5 Peter Pan Street',
    addressLine2: 'Menangle Park',
    houseType: 'double-standard',
    floor: 'ground',
    conditions: { ...emptyConditions(), parapet: true },
    detailer: 'Thu',
  });
  data.items['js-stud'] = { status: 'done', values: { stud: '90x35 meyWALL Red LVL', spacing: '600cc' }, note: 'Ghi chú tiếng Việt: đã kiểm tra' };
  data.walls.push(newWall('E1', data.elevations[0].id));
  return data;
}

async function toBuffer(blob: Blob) {
  return blob.arrayBuffer();
}

const PNG_1PX =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('.chck files', () => {
  it('round-trips plain JSON with a valid fingerprint', async () => {
    const saved = await prepareForSave(sample(), [], defaultContent);
    const parsed = await parse(await toBuffer(await serialize(saved, [])));
    expect(parsed.fingerprintOk).toBe(true);
    expect(parsed.data).toEqual(saved);
    expect(parsed.photos).toEqual([]);
  });

  it('round-trips a zip with photos', async () => {
    const photos: Photo[] = [{ id: 'p1', name: 'flag.png', mime: 'image/png', dataUrl: PNG_1PX }];
    const data = sample();
    data.stage = 'review';
    data.review.rounds.push({ round: 2, checker: 'Duy', startedAt: '2026-11-11T00:00:00.000Z' });
    data.review.entries.push({ id: 'r1', itemId: 'js-stud', kind: 'flag', text: 'Check stud', photoIds: ['p1'], author: 'Duy', round: 2, createdAt: 'now', resolved: false });
    const saved = await prepareForSave(data, photos, defaultContent);
    const blob = await serialize(saved, photos);
    const bytes = new Uint8Array(await toBuffer(blob));
    expect([bytes[0], bytes[1]]).toEqual([0x50, 0x4b]); // zip
    const parsed = await parse(bytes.buffer);
    expect(parsed.fingerprintOk).toBe(true);
    expect(parsed.photos).toEqual(photos);
    expect(suggestedFileName(parsed.data)).toBe('26-89 Ground Floor - Review 2.chck');
  });

  it('detects a file edited outside the app', async () => {
    const saved = await prepareForSave(sample(), [], defaultContent);
    const text = JSON.stringify(saved).replace('90x35 meyWALL Red LVL', '70x35 MGP10');
    const parsed = await parse(new TextEncoder().encode(text).buffer as ArrayBuffer);
    expect(parsed.fingerprintOk).toBe(false);
  });

  it('rejects files that are not checklists', async () => {
    await expect(parse(new TextEncoder().encode('hello').buffer as ArrayBuffer)).rejects.toBeInstanceOf(FileFormatError);
    await expect(parse(new TextEncoder().encode('{"format":"other"}').buffer as ArrayBuffer)).rejects.toBeInstanceOf(FileFormatError);
  });

  it('reports content changes since the file was saved', async () => {
    const saved = await prepareForSave(sample(), [], defaultContent);
    const updated = structuredClone(defaultContent);
    updated.version = 2;
    updated.items[0] = { ...updated.items[0], title: 'Changed title' };
    updated.items.push({ id: 'new-item', stage: 'job-review', title: 'New rule from client feedback' });
    const c = contentChanges(saved.itemDefs, updated);
    expect(c.added).toEqual(['new-item']);
    expect(c.changed).toEqual([updated.items[0].id]);
    expect(c.removed).toEqual([]);
  });
});

describe('PDF definition', () => {
  it('builds draft and final documents with a watermark only on draft', () => {
    const data = sample();
    const draft = buildDocDefinition(defaultContent, data, [], 'draft');
    const final = buildDocDefinition(defaultContent, data, [], 'final');
    expect(draft.watermark).toBeTruthy();
    expect(final.watermark).toBeUndefined();
    expect(JSON.stringify(draft.content)).toContain('Checker notes');
    expect(JSON.stringify(final.content)).not.toContain('Checker notes');
    expect(JSON.stringify(final.content)).toContain('Ghi chú tiếng Việt');
  });
});
