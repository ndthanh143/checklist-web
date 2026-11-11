import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { defaultContent } from '../src/content/defaultContent';
import { emptyConditions, newJobData } from '../src/job/factory';
import { prepareForSave, serialize } from '../src/lib/fileio';
import { visibleItems } from '../src/lib/rules';

test.beforeEach(async ({ page }) => {
  // Headless Chromium has no native save dialog: use the download fallback.
  await page.addInitScript(() => {
    delete (window as unknown as Record<string, unknown>).showSaveFilePicker;
    delete (window as unknown as Record<string, unknown>).showOpenFilePicker;
    window.confirm = () => true;
  });
});

async function download(page: Page, action: () => Promise<unknown>): Promise<string> {
  const [d] = await Promise.all([page.waitForEvent('download'), action()]);
  const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'chck-')), d.suggestedFilename());
  await d.saveAs(p);
  return p;
}

async function openFile(page: Page, file: string) {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Open a .chck file' }).click()]);
  await chooser.setFiles(file);
}

test('detailer starts a job, saves it, and continues after a refresh', async ({ page }) => {
  await page.goto('/');
  await page.locator('.builder-card', { hasText: 'Ashmont Homes' }).click();
  await page.fill('#jobno', '26-89');
  await page.fill('#addr1', 'Lot 4413 No 5 Peter Pan Street');
  await page.fill('#addr2', 'Menangle Park');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByText('Double storey — standard').click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('group', { name: 'Parapet walls', exact: true }).getByRole('button', { name: 'Yes' }).click();
  await page.getByRole('button', { name: 'Start checklist' }).click();

  await expect(page.locator('.job-chip')).toContainText('26-89 · Ground Floor');
  await expect(page.locator('.save-state')).toContainText('Not saved yet');

  // Builder-only items: Ashmont gets floating studs, not Transpire's slab check.
  await page.locator('.stage-link', { hasText: 'Openings' }).click();
  await expect(page.locator('#item-op-floating')).toBeVisible();
  await page.locator('.stage-link', { hasText: 'Job Review' }).click();
  await expect(page.locator('#item-jr-slab')).toHaveCount(0);

  // Suggestion is shown, not applied, until "Use this".
  await page.locator('.stage-link', { hasText: 'Job Setup' }).click();
  const stud = page.locator('#item-js-stud');
  await expect(stud.locator('input').first()).toHaveValue('');
  await stud.getByRole('button', { name: 'Use this' }).click();
  await expect(stud.locator('input').first()).toHaveValue('90x35 meyWALL Red LVL min');
  await stud.getByRole('button', { name: 'Done' }).click();
  await expect(stud.locator('.problems')).toContainText('"Stud spacing" is empty');
  await page.locator('#item-js-heights input').first().fill('2450');
  await page.locator('#item-js-heights').getByRole('button', { name: 'Use this' }).click();
  await expect(page.locator('#item-js-heights input').nth(1)).toHaveValue('2425');

  const file = await download(page, () => page.locator('.topbar').getByRole('button', { name: 'Save' }).click());
  expect(path.basename(file)).toBe('26-89 Ground Floor.chck');
  await expect(page.locator('.save-state')).toContainText('Saved');

  // Refresh wipes the session (by design) — reopen the file.
  await page.reload();
  await expect(page.locator('.job-chip')).toHaveCount(0);
  await openFile(page, file);
  await page.locator('.stage-link', { hasText: 'Job Setup' }).click();
  await expect(page.locator('#item-js-stud input').first()).toHaveValue('90x35 meyWALL Red LVL min');
  await expect(page.locator('#item-js-heights input').nth(1)).toHaveValue('2425');
});

test('browser warns before leaving with unsaved work', async ({ page }) => {
  await page.goto('/');
  await page.locator('.builder-card', { hasText: 'Transpire' }).click();
  await page.fill('#jobno', '26-175');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Start checklist' }).click();
  let warned = false;
  page.on('dialog', async (d) => {
    warned = d.type() === 'beforeunload';
    await d.dismiss();
  });
  await page.close({ runBeforeUnload: true });
  await expect.poll(() => warned).toBe(true);
});

test('checker reviews a finished job, signs off, and exports the final PDF', async ({ page }) => {
  // A finished job file, as the detailer would send it for review.
  const data = newJobData({
    jobNo: '26-175',
    builderId: 'transpire',
    addressLine1: 'Lot 1531 No. 7 May Lane',
    addressLine2: 'Wilton',
    houseType: 'single-standard',
    floor: 'single',
    conditions: emptyConditions(),
    detailer: 'Thu',
  });
  for (const item of visibleItems(defaultContent, data.job)) {
    const values: Record<string, string | string[]> = {};
    for (const f of item.fields ?? []) values[f.id] = f.kind === 'checks' ? [...(f.options ?? [])] : f.kind === 'select' ? (f.options?.[0] ?? '1') : '600';
    data.items[item.id] = { status: 'done', values, note: '' };
  }
  data.stage = 'review';
  const saved = await prepareForSave(data, [], defaultContent);
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'chck-')), '26-175 Single Storey - Review.chck');
  fs.writeFileSync(file, Buffer.from(await (await serialize(saved, [])).arrayBuffer()));

  await page.goto('/');
  await openFile(page, file);
  await expect(page.getByText('Open a job in review')).toBeVisible();
  await page.fill('#checker-name', 'Duy');
  await page.locator('.modal-foot').getByRole('button', { name: 'Open' }).click();
  await expect(page.locator('.role-badge')).toHaveText('Checker');
  await expect(page.getByRole('button', { name: 'Final PDF' })).toBeDisabled();

  // Inputs are locked for the checker; flags can be added.
  await page.locator('.topbar').getByRole('button', { name: 'Checklist' }).click();
  await page.locator('.stage-link', { hasText: 'Job Setup' }).click();
  const stud = page.locator('#item-js-stud');
  await expect(stud.locator('input').first()).toBeDisabled();
  await stud.getByRole('button', { name: 'Add flag' }).click();
  await stud.locator('textarea').last().fill('Check stud grade');
  await stud.locator('button.primary', { hasText: 'Add flag' }).click();
  await expect(stud.locator('.entry.flag.open')).toBeVisible();

  await page.locator('.topbar').getByRole('button', { name: 'Summary' }).click();
  await expect(page.getByRole('button', { name: /Sign off/ })).toBeDisabled();
  await expect(page.getByText('1 flag(s) are still open')).toBeVisible();

  // Draft PDF is available to the checker at any time.
  const draft = await download(page, () => page.locator('.export-card').getByRole('button', { name: 'Draft PDF' }).click());
  expect(fs.readFileSync(draft).subarray(0, 4).toString()).toBe('%PDF');

  // Resolve, sign off, export the final report.
  await page.locator('.topbar').getByRole('button', { name: 'Checklist' }).click();
  await page.locator('.stage-link', { hasText: 'Job Setup' }).click();
  await page.locator('#item-js-stud').getByRole('button', { name: 'Mark resolved' }).click();
  await page.locator('.topbar').getByRole('button', { name: 'Summary' }).click();
  const reviewFile = await download(page, () => page.getByRole('button', { name: /Sign off/ }).click());
  expect(path.basename(reviewFile)).toBe('26-175 Single Storey - Review 2.chck');
  await expect(page.getByRole('button', { name: 'Final PDF' })).toBeEnabled();
  const final = await download(page, () => page.getByRole('button', { name: 'Final PDF' }).click());
  expect(path.basename(final)).toBe('26-175 Single Storey - Final checklist report.pdf');
  expect(fs.readFileSync(final).subarray(0, 4).toString()).toBe('%PDF');
});

test('a file edited outside the app shows a warning', async ({ page }) => {
  const data = newJobData({
    jobNo: '26-1',
    builderId: 'idyll',
    addressLine1: '',
    addressLine2: '',
    houseType: 'single-standard',
    floor: 'single',
    conditions: emptyConditions(),
    detailer: '',
  });
  const saved = await prepareForSave(data, [], defaultContent);
  saved.job.jobNo = '26-2'; // edited by hand after saving
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'chck-')), 'edited.chck');
  fs.writeFileSync(file, JSON.stringify(saved));
  await page.goto('/');
  await openFile(page, file);
  await expect(page.getByText('This file was changed outside the app.')).toBeVisible();
});
