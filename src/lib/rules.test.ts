import { describe, expect, it } from 'vitest';
import { defaultContent } from '../content/defaultContent';
import { parseContent } from '../content/schema';
import { emptyConditions, newJobData, newOpening, newWall } from '../job/factory';
import type { JobInfo } from '../job/types';
import { finalGate, isItemVisible, itemProblems, jobSummary, openingCalc, visibleItems, wallIssues } from './rules';

function job(patch: Partial<JobInfo> = {}): JobInfo {
  return {
    jobNo: '26-175',
    builderId: 'transpire',
    addressLine1: 'Lot 1531 No. 7 May Lane',
    addressLine2: 'Wilton',
    houseType: 'single-standard',
    floor: 'single',
    conditions: emptyConditions(),
    detailer: 'Thu',
    ...patch,
  };
}

const ids = (j: JobInfo) => visibleItems(defaultContent, j).map((i) => i.id);

describe('default content', () => {
  it('passes the content schema', () => expect(() => parseContent(defaultContent)).not.toThrow());
  it('has 9 stages in blueprint order', () =>
    expect(defaultContent.stages.map((s) => s.title)).toEqual([
      'Job Review',
      'Job Setup',
      'Wall Input',
      'Elevations',
      'Wall Panels per Elevation',
      'Openings per Elevation',
      'Wall Adjustment',
      'Elevation Check',
      'Labels & Notes',
    ]));
  it('has the 5 agreed builders and no Elysium', () =>
    expect(defaultContent.builders.map((b) => b.id).sort()).toEqual(['add-style', 'ashmont', 'betterbuilt', 'idyll', 'transpire']));
  it('every stage has at least one item', () => {
    for (const s of defaultContent.stages) expect(defaultContent.items.some((i) => i.stage === s.id)).toBe(true);
  });
  it('builder notes only reference known builders', () => {
    const known = new Set(defaultContent.builders.map((b) => b.id));
    for (const i of defaultContent.items) {
      for (const b of Object.keys(i.builderNotes ?? {})) expect(known.has(b)).toBe(true);
      for (const b of i.appliesWhen?.builders ?? []) expect(known.has(b)).toBe(true);
    }
  });
});

describe('visibility', () => {
  it('builder-only items show only for that builder', () => {
    expect(ids(job({ builderId: 'ashmont' }))).toContain('op-floating');
    expect(ids(job({ builderId: 'transpire' }))).not.toContain('op-floating');
    expect(ids(job({ builderId: 'transpire' }))).toContain('jr-slab');
    expect(ids(job({ builderId: 'betterbuilt' }))).toContain('wa-extra-nogs');
  });
  it('Idyll gets the Add Style items', () => {
    const idyll = ids(job({ builderId: 'idyll' }));
    expect(idyll).toContain('op-nibs');
    expect(idyll).not.toContain('op-floating');
  });
  it('job conditions switch items on', () => {
    const off = ids(job());
    expect(off).not.toContain('wi-step-down');
    expect(off).not.toContain('wi-raked');
    const on = ids(job({ conditions: { ...emptyConditions(), stepDown: true, raked: true } }));
    expect(on).toContain('wi-step-down');
    expect(on).toContain('ln-step-down');
    expect(on).toContain('wi-raked');
  });
  it('conditions are any-of (shower OR bath)', () => {
    const item = defaultContent.items.find((i) => i.id === 'wa-shower')!;
    expect(isItemVisible(item, job({ conditions: { ...emptyConditions(), bath: true } }))).toBe(true);
    expect(isItemVisible(item, job())).toBe(false);
  });
});

describe('item problems', () => {
  const raked = defaultContent.items.find((i) => i.id === 'wi-raked')!;
  it('scenario checklist warns while any scenario is unticked (blueprint 4.2.3)', () => {
    expect(itemProblems(raked, { status: 'done', values: { scenarios: ['Ridge beam detailed as a 90 mm pocket'] }, note: '' })[0]).toMatch(/4 of 5 not ticked/);
    const all = raked.fields![0].options!;
    expect(itemProblems(raked, { status: 'done', values: { scenarios: all }, note: '' })).toEqual([]);
  });
  it('required fields must be filled', () => {
    const heights = defaultContent.items.find((i) => i.id === 'js-heights')!;
    expect(itemProblems(heights, { status: 'done', values: { external: '2450' }, note: '' })).toEqual(['"Internal wall height" is empty']);
  });
});

describe('walls and openings', () => {
  it('flags duplicates, long walls and tall walls', () => {
    const w1 = { ...newWall('E1', 'el1'), length: '6100' };
    const w2 = { ...newWall('E1', 'el1'), height: '3690' };
    const issues = wallIssues([w1, w2]).map((i) => i.check.message);
    expect(issues.some((m) => m.includes('more than once'))).toBe(true);
    expect(issues.some((m) => m.includes('5950'))).toBe(true);
    expect(issues.some((m) => m.includes('3450'))).toBe(true);
  });
  it('Ashmont front-façade opening gets +130 and needs lintel when load-bearing', () => {
    const data = newJobData(job({ builderId: 'ashmont' }));
    data.elevations[0].frontFacade = true;
    const wall = { ...newWall('E1', data.elevations[0].id), loadBearing: true };
    data.walls.push(wall);
    const o = { ...newOpening('W1', wall.id, false), scheduleH: '1200', scheduleW: '1210', hyneDeflection: '1.2' };
    const c = openingCalc(defaultContent, data, o);
    expect(c.stud).toMatchObject({ height: 1280, width: 1340 });
    expect(c.lintelNeeded).toBe(true);
    expect(c.deflection[0].level).toBe('ok');
  });
});

describe('final gate', () => {
  it('blocks until every item is complete and signed off', () => {
    const data = newJobData(job());
    expect(finalGate(defaultContent, data).ready).toBe(false);
    for (const item of visibleItems(defaultContent, data.job)) {
      const values: Record<string, string | string[]> = {};
      for (const f of item.fields ?? []) values[f.id] = f.kind === 'checks' ? [...(f.options ?? [])] : '1';
      data.items[item.id] = { status: 'done', values, note: '' };
    }
    const g1 = finalGate(defaultContent, data);
    expect(g1.ready).toBe(false);
    expect(g1.reasons).toEqual(['Needs sign-off from the 2nd checker']);
    data.review.rounds.push({ round: 2, checker: 'Duy', startedAt: 'x', signedOffAt: 'y' });
    expect(finalGate(defaultContent, data).ready).toBe(true);
    data.review.entries.push({ id: 'f', itemId: 'js-stud', kind: 'flag', text: 'x', photoIds: [], author: 'Duy', round: 2, createdAt: 'x', resolved: false });
    expect(finalGate(defaultContent, data).reasons).toContain('1 flag(s) are still open');
    expect(jobSummary(defaultContent, data).openFlags).toBe(1);
  });
});
