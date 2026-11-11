import { describe, expect, it } from 'vitest';
import { defaultContent } from '../content/defaultContent';
import {
  addressLabel,
  addressWarnings,
  bracingShortfall,
  bulkheadTimber,
  checkDeflection,
  checkFrameHeight,
  checkFrameLength,
  deflectionLimit,
  internalWallHeight,
  nogSuggestion,
  pineLintelWarning,
  planToFrameDimension,
  stepDownFrameHeight,
  studOpening,
  tieDown,
} from './calc';

const ashmont = defaultContent.builders.find((b) => b.id === 'ashmont')!;
const addStyle = defaultContent.builders.find((b) => b.id === 'add-style')!;
const A = defaultContent.allowances;

describe('wall heights', () => {
  it('internal wall is 25 mm lower', () => expect(internalWallHeight(2450)).toBe(2425));
  it('nog defaults from the blueprint', () => {
    expect(nogSuggestion(2450)).toEqual({ height: 1220, centres: 1200, known: true });
    expect(nogSuggestion(2740)).toEqual({ height: 1350, centres: 1350, known: true });
  });
  it('other heights: half, marked as not known', () => expect(nogSuggestion(2590)).toEqual({ height: 1300, centres: 1300, known: false }));
  it('step-down: standard adds depth, split-level keeps height', () => {
    expect(stepDownFrameHeight(2450, 75, false)).toBe(2525);
    expect(stepDownFrameHeight(2450, 75, true)).toBe(2450);
  });
});

describe('frame limits', () => {
  it('length: ≤4500 ok, >4500 warn, >5950 block', () => {
    expect(checkFrameLength(4500).level).toBe('ok');
    expect(checkFrameLength(4501).level).toBe('warn');
    expect(checkFrameLength(5950).level).toBe('warn');
    expect(checkFrameLength(5951).level).toBe('block');
  });
  it('height: >3450 block for transport', () => {
    expect(checkFrameHeight(3450).level).toBe('ok');
    expect(checkFrameHeight(3690).level).toBe('block');
  });
});

describe('stud openings', () => {
  const plain = { frontFacade: false, brickVeneer: false };
  it('internal door example 2040x820 → 2110x880', () => {
    const s = studOpening('internal-door', 2040, 820, A, addStyle, plain);
    expect([s.height, s.width]).toEqual([2110, 880]);
  });
  it('cavity slider: (W×2)+60, H+110 → 2150 high', () => {
    const s = studOpening('cavity-slider', 2040, 820, A, addStyle, plain);
    expect([s.height, s.width]).toEqual([2150, 1700]);
  });
  it('Ashmont window: height +80 everywhere', () => {
    const s = studOpening('window-alu', 1200, 1210, A, ashmont, plain);
    expect([s.height, s.width]).toEqual([1280, 1270]);
  });
  it('Ashmont front-façade brick veneer: width +130', () => {
    const s = studOpening('window-alu', 1200, 1210, A, ashmont, { frontFacade: true, brickVeneer: true });
    expect(s.width).toBe(1340);
    expect(s.reasons.some((r) => r.includes('+130'))).toBe(true);
  });
  it('Ashmont +130 does not apply to cladding on the front façade', () => {
    expect(studOpening('window-alu', 1200, 1210, A, ashmont, { frontFacade: true, brickVeneer: false }).width).toBe(1270);
  });
  it('Ashmont override does not touch internal doors', () => {
    expect(studOpening('internal-door', 2040, 820, A, ashmont, { frontFacade: true, brickVeneer: true }).height).toBe(2110);
  });
  it('plan dimension minus finish', () => {
    expect(planToFrameDimension(1095, 'brick-veneer')).toEqual({ min: 935, max: 945 });
    expect(planToFrameDimension(1095, 'cladding')).toEqual({ min: 1060, max: 1060 });
  });
});

describe('lintel deflection table', () => {
  const T = defaultContent.lintelTable;
  it('inside a band uses its max', () => expect(deflectionLimit(820, T)).toMatchObject({ limit: 1.5, ambiguous: false }));
  it('3000 is in two bands → stricter 3.0 and ambiguous', () => expect(deflectionLimit(3000, T)).toMatchObject({ limit: 3.0, ambiguous: true }));
  it('gap 1050 → band below, ambiguous', () => expect(deflectionLimit(1050, T)).toMatchObject({ limit: 1.5, ambiguous: true }));
  it('over 6000 is outside the table', () => expect(deflectionLimit(6100, T)).toBeNull());
  it('job 26-89: 880 opening with 2.1 mm deflection fails', () => expect(checkDeflection(880, 2.1, T).level).toBe('block'));
  it('job 26-175: 4.2 mm on a 6 m span passes', () => expect(checkDeflection(6000, 4.2, T).level).toBe('ok'));
  it('pine deeper than 190 warns', () => {
    expect(pineLintelWarning('240x45 MGP10')).not.toBeNull();
    expect(pineLintelWarning('190x45 MGP10')).toBeNull();
    expect(pineLintelWarning('200x63 LVL')).toBeNull();
  });
});

describe('tie-down and bracing', () => {
  it('spec 7.2 example: 8880 span, 610 overhang, 0.14', () => {
    const t = tieDown(8880, 610, 0.14, 600);
    expect(t.rlw).toBe(5050);
    expect(t.uplift).toBeCloseTo(0.707, 3);
    expect(t.perStud).toBeCloseTo(0.424, 3);
    expect(tieDown(8880, 610, 0.14, 450).perStud).toBeCloseTo(0.318, 3);
  });
  it('job 26-89 bracing: X needs 2.895 kN more', () => {
    expect(bracingShortfall(50.0, 47.105)).toEqual({ shortfall: 2.895, ok: false });
    expect(bracingShortfall(40, 42).ok).toBe(true);
  });
});

describe('bulkhead and address', () => {
  it('spec 15.2 example: 3140 long, 190 deep → 7000', () => {
    expect(bulkheadTimber(3140, 190)).toMatchObject({ plates: 6280, studCount: 6, studLength: 120, studs: 720, total: 7000 });
  });
  it('address label follows the blueprint format', () => {
    expect(addressLabel('26-175', 'Ground Floor', 'Transpire Constructions', 'Lot 1531 No. 7 May Lane', 'Wilton')).toEqual([
      'Job No - 26-175   (Ground Floor)',
      '',
      'Transpire Constructions.',
      'Lot 1531 No. 7 May Lane,',
      'Wilton.',
    ]);
  });
  it('flags DP numbers, state and postcode', () => {
    expect(addressWarnings('Lot 4413 No 5 Peter Pan Street DP 1313734', 'Menangle Park NSW 2563')).toHaveLength(3);
    expect(addressWarnings('Lot 4413 No 5 Peter Pan Street', 'Menangle Park')).toHaveLength(0);
  });
});
