import { describe, expect, it } from 'vitest';
import { defaultContent } from '../content/defaultContent';
import { parseContent, parseJobData } from '../content/schema';
import { DEFAULT_OPENING_FRAMING } from '../content/types';
import { emptyConditions, newJobData, newOpening, newWall } from '../job/factory';
import type { JobData, JobInfo } from '../job/types';
import { useSession } from '../store/session';
import { nogSuggestion } from './calc';
import { computeFingerprint, parse, prepareForSave, serialize } from './fileio';
import { FOCUS_POINTS, focusPointsFor } from './focus';
import { doubleLintelSuggestion, framingSuggestion, type FramingInput } from './openings';
import { isFieldVisible, itemProblems, loadBearingIssues, openingCalc, visibleItems } from './rules';

// Tests for requirement-update.docx (checklist v2).

function job(patch: Partial<JobInfo> = {}): JobInfo {
  return {
    jobNo: '26-179',
    builderId: 'betterbuilt',
    addressLine1: '47 Harkness Road',
    addressLine2: 'Oakville',
    houseType: 'double-standard',
    floor: 'ground',
    conditions: emptyConditions(),
    detailer: 'Thu',
    ...patch,
  };
}

const item = (id: string) => defaultContent.items.find((i) => i.id === id)!;
const F = DEFAULT_OPENING_FRAMING;

describe('#7 ceiling type, #10 nog 2600', () => {
  it('asks for the ceiling type (text), not a height', () => {
    const f = item('jr-detailing-info').fields!.find((x) => x.id === 'ceilingType')!;
    expect(f.kind).toBe('text');
    expect(f.placeholder).toContain('13mm Plaster');
    expect(item('jr-detailing-info').fields!.some((x) => x.id === 'ceiling')).toBe(false);
  });
  it('2600 frame → nog 1350 / 1350', () => {
    expect(nogSuggestion(2600, defaultContent.nogTable)).toEqual({ height: 1350, centres: 1350, known: true });
    expect(nogSuggestion(2450, defaultContent.nogTable).height).toBe(1220);
    expect(nogSuggestion(2590, defaultContent.nogTable)).toEqual({ height: 1300, centres: 1300, known: false });
  });
});

describe('#8 / #15 load-bearing walls', () => {
  it('external walls start load-bearing, internal walls do not', () => {
    expect(newWall('E1', 'el1').loadBearing).toBe(true);
    expect(newWall('I1', null).loadBearing).toBe(false);
  });
  it('internal walls listed in 1.2 are added as LB; mismatches are flagged', () => {
    const data = newJobData(job());
    data.items['jr-load-bearing'] = { status: 'done', values: { internalLb: 'I3, i7' }, note: '' };
    useSession.setState({ data, role: 'detailer' });
    const r = useSession.getState().addWalls(['I3', 'I4', 'I7', 'I3'], null);
    expect(r).toEqual({ added: 3, existing: ['I3'] });
    const walls = useSession.getState().data!.walls;
    expect(walls.map((w) => [w.label, w.loadBearing])).toEqual([
      ['I3', true],
      ['I4', false],
      ['I7', true],
    ]);
    const d = useSession.getState().data!;
    d.walls[0].loadBearing = false;
    expect(loadBearingIssues(d).map((i) => i.check.message)).toEqual(['I3 is listed as internal load-bearing but LB is not ticked']);
  });
  it('the typed labels are kept in the job and adding again creates no duplicates', () => {
    const data = newJobData(job());
    useSession.setState({ data, role: 'detailer' });
    const el = data.elevations[0].id;
    useSession.getState().setWallLabelDraft(el, 'E1-E3');
    expect(useSession.getState().data!.wallLabelDrafts[el]).toBe('E1-E3');
    expect(useSession.getState().addWalls(['E1', 'E2', 'E3'], el).added).toBe(3);
    expect(useSession.getState().addWalls(['E1', 'E2', 'E3', 'E4'], el)).toEqual({ added: 1, existing: ['E1', 'E2', 'E3'] });
  });
  it('checkers cannot add walls', () => {
    useSession.setState({ data: newJobData(job()), role: 'checker' });
    expect(useSession.getState().addWalls(['E1'], null).added).toBe(0);
  });
});

describe('#9 #12 #14 #23 table fields, #14 #22 picture fields', () => {
  it('rows: required table needs a row, and required columns in every row', () => {
    const sd = item('wi-step-down');
    expect(itemProblems(sd, { status: 'done', values: {}, note: '' })).toEqual(['"Step-down areas": add at least one row']);
    const problems = itemProblems(sd, { status: 'done', values: { areas: [{ area: 'Garage', labels: 'E12', depth: '200' }, { area: 'Porch', depth: 'x' }] }, note: '' });
    expect(problems).toEqual(['"Step-down areas" row 2: "Wall labels" is empty', '"Step-down areas" row 2: "Step-down depth" is not a number']);
  });
  it('other sizes are optional on stud, top plate and bottom plate', () => {
    for (const id of ['js-stud', 'js-top-plate', 'js-bottom-plate']) {
      const f = item(id).fields!.find((x) => x.id === 'otherSizes')!;
      expect(f.kind).toBe('rows');
      expect(f.required).toBeUndefined();
    }
  });
  it('beam pocket pictures show only when that pocket type is ticked', () => {
    const beams = item('wi-beams');
    const mid = beams.fields!.find((f) => f.id === 'midPhotos')!;
    const end = beams.fields!.find((f) => f.id === 'endPositions')!;
    const state = { status: 'not-started' as const, values: { checks: ['Mid-wall pockets: top plate kept, Trim Beam Pockets unticked'] }, note: '' };
    expect(isFieldVisible(mid, state)).toBe(true);
    expect(isFieldVisible(end, state)).toBe(false);
  });
  it('bracing capacity takes screenshots; critical studs take several areas', () => {
    expect(item('ec-bracing-capacity').fields!.some((f) => f.kind === 'photos')).toBe(true);
    const cols = item('wa-critical-capacity').fields![0].columns!.map((c) => c.id);
    expect(cols).toEqual(['area', 'level', 'girder', 'size', 'deflection']);
  });
  it('item pictures are saved in the .chck file and removing one drops the photo', async () => {
    const data = newJobData(job());
    useSession.setState({ data, role: 'detailer', photos: [] });
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    useSession.getState().addItemPhotos('ec-bracing-capacity', 'screenshots', [{ id: 'p1', name: 'bracing.png', mime: 'image/png', dataUrl: png }]);
    const s = useSession.getState();
    expect(s.data!.items['ec-bracing-capacity'].values.screenshots).toEqual(['p1']);
    const saved = await prepareForSave(s.data!, s.photos, defaultContent);
    const parsed = await parse(await (await serialize(saved, s.photos)).arrayBuffer());
    expect(parsed.photos.map((p) => p.id)).toEqual(['p1']);
    useSession.getState().removeItemPhoto('ec-bracing-capacity', 'screenshots', 'p1');
    expect(useSession.getState().photos).toEqual([]);
  });
});

describe('#16 #20 #21 visibility and order', () => {
  it('front façade item only for Ashmont', () => {
    expect(visibleItems(defaultContent, job({ builderId: 'ashmont' })).map((i) => i.id)).toContain('el-front');
    expect(visibleItems(defaultContent, job()).map((i) => i.id)).not.toContain('el-front');
  });
  it('WHH comes first in the openings stage', () => {
    const list = visibleItems(defaultContent, job(), 'openings').map((i) => i.id);
    expect(list[0]).toBe('op-head-height');
    const ash = visibleItems(defaultContent, job({ builderId: 'ashmont' }), 'openings').map((i) => i.id);
    expect(ash.slice(0, 2)).toEqual(['op-ashmont-reminders', 'op-head-height']);
  });
  it('cabinet openings are an opening type, not a separate item', () => {
    expect(defaultContent.allowances.cabinet.label).toBe('Cabinet opening');
    expect(defaultContent.items.some((i) => i.id === 'op-cabinet')).toBe(false);
  });
  it('Ashmont has its logo', () => expect(defaultContent.builders.find((b) => b.id === 'ashmont')!.logo).toBe('/logos/ashmont.png'));
});

describe('#17–#19 opening framing', () => {
  const base: FramingInput = { internal: true, loadBearing: false, studWidth: 880, position: 'middle', lintelMode: 'designed' };
  it('internal ≤ 1800 in a non-load-bearing wall: no lintel, no prop, 90x45 trimmer and jambs', () => {
    expect(framingSuggestion(base, F)).toMatchObject({ case: 'internal-no-lintel', lintel: 'none', trimmer: '90x45', jamb: '90x45', prop: null, jambCorner: null });
  });
  it('door 90 / 70 mm from a wall corner → double jamb 90x45 / 90x35', () => {
    expect(framingSuggestion({ ...base, position: 'corner90' }, F)!.jambCorner).toBe('2/90x45');
    expect(framingSuggestion({ ...base, position: 'corner70' }, F)!.jambCorner).toBe('2/90x35');
  });
  it('internal over 1800, or in a load-bearing wall: like an external opening', () => {
    expect(framingSuggestion({ ...base, studWidth: 1900 }, F)).toMatchObject({ case: 'with-lintel', trimmer: '90x35', jamb: '90x35', prop: '90x35' });
    expect(framingSuggestion({ ...base, loadBearing: true }, F)).toMatchObject({ case: 'with-lintel', lintel: 'designed' });
    expect(framingSuggestion({ ...base, studWidth: 1800 }, F)!.case).toBe('internal-no-lintel');
  });
  it('external: lintel by default; "no lintel" only for non-load-bearing up to 1800', () => {
    const ext = { ...base, internal: false, studWidth: 1270 };
    expect(framingSuggestion(ext, F)).toMatchObject({ case: 'with-lintel', trimmer: '90x35' });
    expect(framingSuggestion({ ...ext, lintelMode: 'none' }, F)).toMatchObject({ case: 'external-no-lintel', warning: null });
    expect(framingSuggestion({ ...ext, lintelMode: 'none', loadBearing: true }, F)!.warning?.level).toBe('warn');
    expect(framingSuggestion({ ...ext, lintelMode: 'none', studWidth: 2400 }, F)!.warning?.level).toBe('warn');
  });
  it('no suitable lintel → 2/LVL jamb and prop studs, lintel in the floor system', () => {
    expect(framingSuggestion({ ...base, internal: false, lintelMode: 'no-suitable' }, F)).toMatchObject({ lintel: 'floor-system', jamb: '2/LVL studs', prop: '2/LVL studs' });
  });
  it('single-ply 90x35 / 140x35 lintels → suggest 2 ply', () => {
    expect(doubleLintelSuggestion('90x35 MGP10', F.doubleLintels)).toBe('2/90x35 MGP10');
    expect(doubleLintelSuggestion('140x35', F.doubleLintels)).toBe('2/140x35');
    expect(doubleLintelSuggestion('2/90x35 MGP10', F.doubleLintels)).toBeNull();
    expect(doubleLintelSuggestion('190x45 MGP10', F.doubleLintels)).toBeNull();
  });

  function withWall(builderId: string, internal: boolean, loadBearing: boolean) {
    const data = newJobData(job({ builderId }));
    const wall = { ...newWall(internal ? 'I1' : 'E1', internal ? null : data.elevations[0].id), loadBearing };
    data.walls.push(wall);
    return { data, wall };
  }

  it('under girder needs the Autobeam critical stud size and deflection', () => {
    const { data, wall } = withWall('betterbuilt', false, true);
    const o = { ...newOpening('W1', wall.id, false), scheduleH: '1200', scheduleW: '1210', underGirder: true };
    expect(openingCalc(defaultContent, data, o).issues.map((i) => i.message)).toContain('Under girder: enter the critical stud size and deflection from Autobeam');
    const ok = { ...o, criticalStud: '3/90x35 MGP10', criticalDeflection: '1.8' };
    expect(openingCalc(defaultContent, data, ok).issues.map((i) => i.message)).not.toContain('Under girder: enter the critical stud size and deflection from Autobeam');
  });
  it('internal-only types on an external wall are flagged', () => {
    const { data, wall } = withWall('betterbuilt', false, true);
    const o = { ...newOpening('W1', wall.id, false), type: 'smart-robe' as const };
    expect(openingCalc(defaultContent, data, o).issues[0].message).toMatch(/internal opening/);
  });
  it('a small internal door needs no lintel design', () => {
    const { data, wall } = withWall('betterbuilt', true, false);
    const o = { ...newOpening('D1', wall.id, true), scheduleH: '2040', scheduleW: '820' };
    const c = openingCalc(defaultContent, data, o);
    expect(c.lintelNeeded).toBe(false);
    expect(c.trimmer).toBe('90x45');
    expect(c.issues).toEqual([]);
  });
  it('the detailer can change the trimmer', () => {
    const { data, wall } = withWall('betterbuilt', false, true);
    const o = { ...newOpening('W1', wall.id, false), scheduleH: '1200', scheduleW: '1210', trimmer: '90x45' };
    expect(openingCalc(defaultContent, data, o).trimmer).toBe('90x45');
  });
  it('front-elevation brick veneer only for builders with front-façade rules, and can be switched off', () => {
    const ash = withWall('ashmont', false, true);
    ash.data.elevations[0].frontFacade = true;
    const o = { ...newOpening('W1', ash.wall.id, false), scheduleH: '1200', scheduleW: '1210' };
    expect(openingCalc(defaultContent, ash.data, o).stud!.width).toBe(1340);
    expect(openingCalc(defaultContent, ash.data, { ...o, frontBrickVeneer: false }).stud!.width).toBe(1270);
    const bb = withWall('betterbuilt', false, true);
    bb.data.elevations[0].frontFacade = true;
    expect(openingCalc(defaultContent, bb.data, { ...o, wallId: bb.wall.id }).frontBrickVeneer).toBe(false);
  });
});

describe('#24 checker focus', () => {
  it('lists every point from the requirement, with builder- and condition-only points', () => {
    expect(FOCUS_POINTS.map((p) => p.id)).toEqual([
      'builder',
      'address',
      'wall-dimensions',
      'wall-heights',
      'missing',
      'opening-sizes',
      'window-schedule',
      'head-heights',
      'positions',
      'lb-walls',
      'member-sizes',
      'lintels',
      'posts',
      'critical-studs',
      'shower',
      'betterbuilt-nogs',
      'beams',
    ]);
    expect(focusPointsFor(newJobData(job({ builderId: 'transpire' }))).map((p) => p.id)).not.toContain('betterbuilt-nogs');
    expect(focusPointsFor(newJobData(job())).map((p) => p.id)).not.toContain('shower');
  });
  it('shows what was entered, including other sizes and under-girder openings', () => {
    const data = newJobData(job());
    data.items['js-top-plate'] = { status: 'done', values: { lb: '2/90x35 meyWALL LVL', nlb: '90x45 MGP10', otherSizes: [{ size: '2/90x45 MGP12', where: 'E4' }] }, note: '' };
    const wall = newWall('E1', data.elevations[0].id);
    data.walls.push(wall);
    data.openings.push({ ...newOpening('W1', wall.id, false), underGirder: true, criticalStud: '3/90x35' });
    const members = FOCUS_POINTS.find((p) => p.id === 'member-sizes')!.info(defaultContent, data);
    expect(members.lines).toContain('Top / ribbon plate other size: 2/90x45 MGP12 at E4');
    const crit = FOCUS_POINTS.find((p) => p.id === 'critical-studs')!.info(defaultContent, data);
    expect(crit.lines).toContain('W1 under girder: 3/90x35, deflection ? mm');
    expect(crit.warnings).toContain('W1: critical stud size or deflection missing');
  });
  it('only the checker can tick a point as verified', () => {
    useSession.setState({ data: newJobData(job()), role: 'detailer', reviewerName: '' });
    useSession.getState().setFocusCheck('builder', true);
    expect(useSession.getState().data!.review.focusChecks).toEqual({});
    useSession.setState({ role: 'checker', reviewerName: 'Duy' });
    useSession.getState().setFocusCheck('builder', true);
    expect(useSession.getState().data!.review.focusChecks.builder.by).toBe('Duy');
  });
});

describe('older files and rules still open', () => {
  /** A file as saved by v1: no new opening fields, single step-down values. */
  async function v1File(): Promise<Record<string, unknown>> {
    const data = newJobData(job({ conditions: { ...emptyConditions(), stepDown: true } })) as unknown as Record<string, unknown>;
    delete data.wallLabelDrafts;
    const review = data.review as Record<string, unknown>;
    delete review.focusChecks;
    const wall = newWall('E1', (data as unknown as JobData).elevations[0].id);
    const o = newOpening('W1', wall.id, false) as unknown as Record<string, unknown>;
    for (const k of ['trimmer', 'lintelMode', 'methods', 'trimmerPlus', 'underGirder', 'criticalStud', 'criticalDeflection', 'frontBrickVeneer']) delete o[k];
    data.walls = [wall];
    data.openings = [o];
    data.items = { 'wi-step-down': { status: 'done', values: { areas: 'Garage', labels: 'E12, E13', depth: '200' }, note: '' } };
    data.fingerprint = await computeFingerprint(data as unknown as JobData, []);
    return data;
  }
  it('fills the new fields and moves step-down values into the table', async () => {
    const d = parseJobData(await v1File());
    expect(d.openings[0]).toMatchObject({ lintelMode: 'designed', methods: [], underGirder: false, frontBrickVeneer: null });
    expect(d.wallLabelDrafts).toEqual({});
    expect(d.review.focusChecks).toEqual({});
    expect(d.items['wi-step-down'].values).toEqual({ areas: [{ area: 'Garage', labels: 'E12, E13', depth: '200' }] });
  });
  it('a v1 file is not reported as edited outside the app', async () => {
    const parsed = await parse(new TextEncoder().encode(JSON.stringify(await v1File())).buffer as ArrayBuffer);
    expect(parsed.fingerprintOk).toBe(true);
  });
  it('rules saved before v2 get the new tables and opening type', () => {
    const old = structuredClone(defaultContent) as unknown as Record<string, unknown>;
    delete old.nogTable;
    delete old.openingFraming;
    delete (old.allowances as Record<string, unknown>).cabinet;
    const c = parseContent(old);
    expect(c.nogTable.find((r) => r.wallHeight === 2600)?.height).toBe(1350);
    expect(c.openingFraming.lintelThreshold).toBe(1800);
    expect(c.allowances.cabinet).toEqual({ label: 'Cabinet opening', width: 0, height: 0 });
  });
});
