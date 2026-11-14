import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Flows added by requirement-update.docx (v2).

test.beforeEach(async ({ page }) => {
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

async function startJob(page: Page, builder: string) {
  await page.goto('/');
  await page.locator('.builder-card', { hasText: builder }).click();
  await page.fill('#jobno', '26-179');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Start checklist' }).click();
}

const stage = (page: Page, name: string) => page.locator('.stage-link', { hasText: name }).click();

test('branding: Smart Check Wall logo, MiTek before Lawmans', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Smart Check Wall');
  await expect(page.locator('.topbar .app-logo')).toHaveAttribute('alt', 'Smart Check Wall');
  const partners = page.locator('.topbar .partners img');
  await expect(partners.nth(0)).toHaveAttribute('alt', 'MiTek');
  await expect(partners.nth(1)).toHaveAttribute('alt', 'Lawmans Frame & Truss');
  const [a, b] = [await partners.nth(0).boundingBox(), await partners.nth(1).boundingBox()];
  expect(a!.height).toBe(b!.height);
  await expect(page.locator('.builder-card', { hasText: 'Ashmont Homes' }).locator('img')).toHaveAttribute('src', '/logos/ashmont.png');
});

test('wall labels survive changing stage and reopening the file; external walls start LB', async ({ page }) => {
  await startJob(page, 'Betterbuilt');
  await stage(page, 'Elevations');
  await expect(page.getByText('Front façade (street)')).toHaveCount(0); // Ashmont only
  await stage(page, 'Wall Panels');
  const extInput = page.getByRole('textbox', { name: 'Wall labels to add (elevation)' }).first();
  await extInput.fill('E1-E3');
  // Leave the stage without pressing "Add walls" — the text must still be there.
  await stage(page, 'Openings');
  await stage(page, 'Wall Panels');
  await expect(extInput).toHaveValue('E1-E3');
  await page.getByRole('button', { name: /Add walls/ }).first().click();
  await expect(page.getByRole('checkbox', { name: 'E1 load-bearing' })).toBeChecked();
  const intInput = page.getByRole('textbox', { name: 'Wall labels to add (internal)' });
  await intInput.fill('I1-I2');
  await page.getByRole('button', { name: /Add walls/ }).last().click();
  await expect(page.getByRole('checkbox', { name: 'I1 load-bearing' })).not.toBeChecked();

  const file = await download(page, () => page.locator('.topbar').getByRole('button', { name: 'Save' }).click());
  await page.reload();
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Open a .chck file' }).click()]);
  await chooser.setFiles(file);
  await stage(page, 'Wall Panels');
  await expect(extInput).toHaveValue('E1-E3');
  // Adding the same range again does not duplicate walls; the button stays usable.
  await extInput.fill('E1-E4');
  await expect(page.getByRole('button', { name: 'Add walls (1 new)' })).toBeEnabled();
  await page.getByRole('button', { name: 'Add walls (1 new)' }).click();
  await expect(page.getByRole('textbox', { name: 'Wall label', exact: true })).toHaveCount(6);
});

test('openings: WHH first, internal door framing, under girder, cabinet opening', async ({ page }) => {
  await startJob(page, 'Betterbuilt');
  await stage(page, 'Wall Panels');
  await page.getByRole('textbox', { name: 'Wall labels to add (elevation)' }).first().fill('E1');
  await page.getByRole('button', { name: /Add walls/ }).first().click();
  await page.getByRole('textbox', { name: 'Wall labels to add (internal)' }).fill('I1');
  await page.getByRole('button', { name: /Add walls/ }).last().click();
  await stage(page, 'Openings');

  // WHH sits above the openings table.
  const whhBox = await page.locator('#item-op-head-height').boundingBox();
  const tableBox = await page.getByText('Openings by elevation').boundingBox();
  expect(whhBox!.y).toBeLessThan(tableBox!.y);

  // Internal door: no lintel, 90x45 trimmer; 90 mm from a corner is Betterbuilt's standard.
  await page.locator('.card', { hasText: 'Internal' }).getByRole('button', { name: 'Add opening' }).click();
  await page.getByRole('combobox', { name: 'Type of D1' }).click();
  await expect(page.getByRole('combobox', { name: 'Type of D1' }).locator('option')).toHaveText(['Internal passage door', 'Cavity sliding door', 'Smart robe', 'Cabinet opening', 'Other']);
  await page.getByRole('textbox', { name: 'D1 schedule height' }).fill('2040');
  await page.getByRole('textbox', { name: 'D1 schedule width' }).fill('820');
  await page.getByRole('combobox', { name: 'Position of D1' }).selectOption('corner90');
  await expect(page.getByRole('combobox', { name: 'Position of D1' }).locator('option:checked')).toHaveText('90 mm from corner (Betterbuilt standard)');
  const d1 = page.locator('.opening-card', { has: page.getByRole('textbox', { name: 'D1 schedule height' }) });
  await expect(d1.locator('.framing-studs')).toContainText('Jamb: 90x45 each side · corner side: 2/90x45 · Prop: none · Lintel: none');
  await expect(d1.getByRole('combobox', { name: 'Trimmer for D1' }).locator('option:checked')).toHaveText('90x45 (suggested)');

  // External window under a girder needs the Autobeam critical stud.
  await page.locator('.card', { hasText: 'Elevation 1' }).first().getByRole('button', { name: 'Add opening' }).click();
  await page.getByRole('textbox', { name: 'W1 schedule height' }).fill('1200');
  await page.getByRole('textbox', { name: 'W1 schedule width' }).fill('1210');
  const w1 = page.locator('.opening-card', { has: page.getByRole('textbox', { name: 'W1 schedule height' }) });
  await expect(w1.getByRole('combobox', { name: 'Trimmer for W1' }).locator('option:checked')).toHaveText('90x35 (suggested)');
  await w1.getByText('Under girder').click();
  await expect(w1).toContainText('Under girder: enter the critical stud size and deflection from Autobeam');
  await w1.getByRole('textbox', { name: 'W1 critical stud size' }).fill('3/90x35 MGP10');
  await w1.getByRole('textbox', { name: 'W1 critical stud deflection' }).fill('1.6');
  await expect(w1).not.toContainText('Under girder: enter');
  await w1.getByRole('textbox', { name: 'W1 Hyne lintel' }).fill('90x35 MGP10');
  await w1.getByRole('button', { name: 'Use this' }).last().click();
  await expect(w1.getByRole('textbox', { name: 'W1 Hyne lintel' })).toHaveValue('2/90x35 MGP10');
  await w1.getByText('Cut in ribbon plate').click();
  await expect(w1.locator('.method-reminders')).toContainText('+ Head Straps');

  await page.locator('.card', { hasText: 'Internal' }).getByRole('button', { name: 'Add cabinet opening' }).click();
  await expect(page.getByRole('combobox', { name: 'Type of D2' })).toHaveValue('cabinet');

  // The girder opening shows in Wall Adjustment, the method note in Elevation Check.
  await stage(page, 'Wall Adjustment');
  await expect(page.locator('#item-wa-critical-capacity')).toContainText('W1 (E1): critical stud 3/90x35 MGP10, deflection 1.6 mm');
  await stage(page, 'Elevation Check');
  await expect(page.locator('#item-ec-extra-notes')).toContainText('W1: Cut in ribbon plate · + Head Straps · Head strap workline');
});

test('tables and pictures: step-down areas, bracing screenshots', async ({ page }) => {
  await page.goto('/');
  await page.locator('.builder-card', { hasText: 'Transpire' }).click();
  await page.fill('#jobno', '26-175');
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('group', { name: 'Step-down areas (garage, porch, alfresco…)', exact: true }).getByRole('button', { name: 'Yes' }).click();
  await page.getByRole('button', { name: 'Start checklist' }).click();

  await stage(page, 'Job Setup');
  await page.locator('#item-js-heights input').first().fill('2600');
  await expect(page.locator('#item-js-nog-spacing .calc-box')).toContainText('nog height 1350, centres 1350');

  await stage(page, 'Wall Input');
  const sd = page.locator('#item-wi-step-down');
  await sd.getByRole('button', { name: 'Add area' }).click();
  await sd.getByRole('textbox', { name: 'Step-down areas row 1 Area' }).fill('Garage');
  await sd.getByRole('textbox', { name: 'Step-down areas row 1 Step-down depth' }).fill('200');
  await sd.getByRole('button', { name: 'Add area' }).click();
  await sd.getByRole('textbox', { name: 'Step-down areas row 2 Area' }).fill('Porch');
  await sd.getByRole('textbox', { name: 'Step-down areas row 2 Step-down depth' }).fill('50');
  await expect(sd.locator('.calc-box')).toContainText('Garage: 2600 + 200 = 2800 mm');
  await expect(sd.locator('.calc-box')).toContainText('Porch: 2600 + 50 = 2650 mm');

  await stage(page, 'Elevation Check');
  const bracing = page.locator('#item-ec-bracing-capacity');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  await bracing.locator('input[type=file]').setInputFiles({ name: 'bracing.png', mimeType: 'image/png', buffer: png });
  await expect(bracing.locator('.photo-thumb img')).toHaveCount(1);
});

test('checker sees the checker-focus list and can verify points', async ({ page }) => {
  await startJob(page, 'Betterbuilt');
  await page.locator('.topbar').getByRole('button', { name: 'Summary' }).click();
  page.once('dialog', (d) => d.accept());
  const reviewFile = await download(page, () => page.getByRole('button', { name: 'Send for review' }).click());
  await page.reload();
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Open a .chck file' }).click()]);
  await chooser.setFiles(reviewFile);
  await page.fill('#checker-name', 'Duy');
  await page.locator('.modal-foot').getByRole('button', { name: 'Open' }).click();
  const panel = page.locator('.focus-panel');
  await expect(panel).toContainText('Checker focus');
  await expect(panel).toContainText('Betterbuilt: vanity nogs and step-down extra nogs');
  await expect(panel.locator('.pill')).toHaveText('0/16 verified');
  await panel.locator('.focus-card', { hasText: 'Builder' }).first().getByText('Verified').click();
  await expect(panel.locator('.pill')).toHaveText('1/16 verified');
  // Focus items are highlighted in the checklist.
  await page.locator('.topbar').getByRole('button', { name: 'Checklist' }).click();
  await stage(page, 'Job Setup');
  await expect(page.locator('#item-js-stud .focus-badge')).toBeVisible();
});
