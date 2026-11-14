import type { Allowance, Builder, LintelBand, NogRow, OpeningType } from '../content/types';
import { DEFAULT_NOG_TABLE } from '../content/types';

// All lengths in mm unless stated. Every function returns plain data so the UI
// can show the suggestion and let the user confirm it (never auto-apply).

export type Level = 'ok' | 'warn' | 'block';

export interface Check {
  level: Level;
  message: string;
}

export function num(v: string | undefined | null): number | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim().replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Blueprint 2.2.5: internal walls are 25 mm lower than external walls. */
export function internalWallHeight(external: number): number {
  return external - 25;
}

/** Blueprint 2.2.6: nog height ≈ half the frame height, except the known heights in the table (e.g. 2600 → 1350). */
export function nogSuggestion(wallHeight: number, table: NogRow[] = DEFAULT_NOG_TABLE): { height: number; centres: number; known: boolean } {
  const row = table.find((r) => r.wallHeight === wallHeight);
  if (row) return { height: row.height, centres: row.centres, known: true };
  const half = Math.round(wallHeight / 2 / 10) * 10;
  return { height: half, centres: half, known: false };
}

/** Blueprint 4.1: standard house adds the step-down depth; split-level keeps the height. */
export function stepDownFrameHeight(wallHeight: number, depth: number, splitLevel: boolean): number {
  return splitLevel ? wallHeight : wallHeight + depth;
}

export const FRAME_LIMITS = {
  recommendedLength: 4500,
  maxLength: 5950,
  transportHeight: 3450,
  maxHeight: 6000,
};

/** Blueprint §5 + team decision (recommended ≤ 4.5 m). */
export function checkFrameLength(length: number): Check {
  if (length > FRAME_LIMITS.maxLength) return { level: 'block', message: `${length} mm is over the 5950 mm manufacturing limit — break at a junction.` };
  if (length > FRAME_LIMITS.recommendedLength) return { level: 'warn', message: `${length} mm is over the recommended 4.5 m — consider a break.` };
  return { level: 'ok', message: 'Length OK' };
}

export function checkFrameHeight(height: number): Check {
  if (height > FRAME_LIMITS.maxHeight) return { level: 'block', message: `${height} mm is over 6 m — needs engineering.` };
  if (height > FRAME_LIMITS.transportHeight) return { level: 'block', message: `${height} mm is over 3450 mm — break the frame for transport.` };
  return { level: 'ok', message: 'Height OK' };
}

// ─── Openings ───

export interface StudOpening {
  height: number;
  width: number;
  heightAllowance: number;
  widthAllowance: number;
  reasons: string[];
}

export interface OpeningContext {
  frontFacade: boolean;
  brickVeneer: boolean;
}

/** Schedule size + standard allowance, then builder overrides (Blueprint 8.3). */
export function studOpening(
  type: OpeningType,
  scheduleH: number,
  scheduleW: number,
  allowances: Record<OpeningType, Allowance>,
  builder: Builder | undefined,
  ctx: OpeningContext,
): StudOpening {
  const std = allowances[type];
  let heightAllowance = std.height;
  let widthAllowance = std.width;
  const baseWidth = std.doubleWidth ? scheduleW * 2 : scheduleW;
  const reasons: string[] = [
    `${std.label}: ${std.doubleWidth ? '(W × 2) ' : ''}W +${std.width}, H +${std.height}`,
  ];
  for (const o of builder?.openingOverrides ?? []) {
    if (!o.appliesTo.includes(type)) continue;
    if (o.frontFacadeBrickVeneerOnly && !(ctx.frontFacade && ctx.brickVeneer)) continue;
    if (o.heightAllowance !== undefined) heightAllowance = o.heightAllowance;
    if (o.widthAllowance !== undefined) widthAllowance = o.widthAllowance;
    reasons.push(o.reason);
  }
  return {
    height: scheduleH + heightAllowance,
    width: baseWidth + widthAllowance,
    heightAllowance,
    widthAllowance,
    reasons,
  };
}

/** Blueprint 8.4: plan dimension minus the wall finish. */
export function planToFrameDimension(planDim: number, finish: 'brick-veneer' | 'cladding' | 'other'): { min: number; max: number } | null {
  if (finish === 'brick-veneer') return { min: planDim - 160, max: planDim - 150 };
  if (finish === 'cladding') return { min: planDim - 35, max: planDim - 35 };
  return null;
}

/** Blueprint 8.6: non-load-bearing openings over 1800 mm need a designed lintel. */
export function needsLintelDesign(width: number, loadBearing: boolean): boolean {
  return loadBearing || width > 1800;
}

export function trimmerRule(width: number, loadBearing: boolean): string {
  if (loadBearing) return 'Load-bearing: trimmer min 35 mm (size depends on head height and opening height)';
  return width > 1800 ? 'Over 1800: lintel design + 35 mm trimmer' : 'Up to 1800: 45 mm trimmer minimum';
}

export interface DeflectionLimit {
  limit: number;
  band: LintelBand;
  /** true when the width sits in a gap or overlap of the table — stricter limit used. */
  ambiguous: boolean;
}

/**
 * Blueprint 8.7 span/deflection table. The table has overlaps (3000 is in two bands)
 * and gaps (e.g. 1001–1099). Until Lawmans confirms, use the stricter limit and flag it.
 */
export function deflectionLimit(width: number, table: LintelBand[]): DeflectionLimit | null {
  const sorted = [...table].sort((a, b) => a.minWidth - b.minWidth);
  if (sorted.length === 0) return null;
  const containing = sorted.filter((b) => width >= b.minWidth && width <= b.maxWidth);
  if (containing.length === 1) return { limit: containing[0].maxDeflection, band: containing[0], ambiguous: false };
  if (containing.length > 1) {
    const strict = containing.reduce((a, b) => (b.maxDeflection < a.maxDeflection ? b : a));
    return { limit: strict.maxDeflection, band: strict, ambiguous: true };
  }
  if (width < sorted[0].minWidth) return { limit: sorted[0].maxDeflection, band: sorted[0], ambiguous: true };
  const last = sorted[sorted.length - 1];
  if (width > last.maxWidth) return null; // outside the table
  // In a gap: use the band below (smaller, stricter limit).
  const below = sorted.filter((b) => b.maxWidth < width).pop()!;
  return { limit: below.maxDeflection, band: below, ambiguous: true };
}

export function checkDeflection(width: number, deflection: number, table: LintelBand[]): Check {
  const d = deflectionLimit(width, table);
  if (!d) return { level: 'block', message: `Opening ${width} mm is outside the deflection table — consult the truss detailer, client or engineer.` };
  if (deflection > d.limit)
    return { level: 'block', message: `${deflection} mm is over the ${d.limit} mm limit for ${d.band.minWidth}–${d.band.maxWidth} — consult the truss detailer, client or engineer.` };
  if (d.ambiguous)
    return { level: 'warn', message: `Within ${d.limit} mm (stricter limit used — ${width} mm is not clearly in one band of the table).` };
  return { level: 'ok', message: `Within ${d.limit} mm limit (${d.band.minWidth}–${d.band.maxWidth})` };
}

/** Spec 8.1: largest pine lintel is 190x45 MGP10. */
export function pineLintelWarning(timber: string): string | null {
  const m = /(\d{3})\s*x\s*\d{2}\s*(mgp|pine)/i.exec(timber);
  if (!m) return null;
  const depth = Number(m[1]);
  return depth > 190 ? 'Pine deeper than 190 mm tends to warp on site — largest pine lintel is 190x45 MGP10.' : null;
}

// ─── Tie-down (Spec 7.2) ───

export interface TieDown {
  rlw: number; // mm
  uplift: number; // kN/m
  perStud: number; // kN
}

/** RLW = span ÷ 2 + overhang. Uplift = RLW (m) × factor. Factor depends on wind class — user enters it. */
export function tieDown(spanMm: number, overhangMm: number, factor: number, studSpacingMm: number): TieDown {
  const rlw = spanMm / 2 + overhangMm;
  const uplift = (rlw / 1000) * factor;
  const perStud = uplift * (studSpacingMm / 1000);
  return { rlw, uplift, perStud };
}

// ─── Bracing ───

export function bracingShortfall(designed: number, detailed: number): { shortfall: number; ok: boolean } {
  const shortfall = Math.round((designed - detailed) * 1000) / 1000;
  return { shortfall, ok: shortfall <= 0 };
}

// ─── Bulkhead (Spec 15) ───

export function bulkheadMember(depth: number): string {
  if (depth === 150) return '150x45 LVL';
  if (depth === 200 || depth === 240 || depth === 300) return 'HyJoist';
  return 'Detail as wall frame: 70x35 MGP10 top & bottom plates, studs at 600 centres';
}

export function bulkheadTimber(length: number, depth: number, studSpacing = 600, plateThickness = 35) {
  const plates = length * 2;
  const studCount = Math.ceil(length / studSpacing);
  const studLength = depth - plateThickness * 2;
  const studs = studLength * studCount;
  return { plates, studCount, studLength, studs, total: plates + studs };
}

// ─── Address label (Blueprint 13, job 26-89) ───

export function addressLabel(jobNo: string, floorLabel: string, builderName: string, line1: string, line2: string): string[] {
  const clean = (s: string) => s.trim().replace(/,\s*$/, '');
  return [
    `Job No - ${jobNo.trim()}   (${floorLabel})`,
    '',
    `${clean(builderName)}.`,
    `${clean(line1)},`,
    `${clean(line2)}.`,
  ];
}

/** Flags things the client said not to include: state, postcode, DP number. */
export function addressWarnings(line1: string, line2: string): string[] {
  const all = `${line1} ${line2}`;
  const out: string[] = [];
  if (/\bDP\s*\d+/i.test(all)) out.push('Remove the DP number — not required.');
  if (/\b(NSW|VIC|QLD|SA|WA|TAS|ACT|NT)\b/.test(all)) out.push('Remove the state — all jobs are in NSW.');
  if (/\b\d{4}\s*$/.test(line2.trim())) out.push('Remove the postcode — not required.');
  return out;
}
