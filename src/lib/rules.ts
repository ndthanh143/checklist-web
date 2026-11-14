import type { Builder, ChecklistContent, ChecklistItem, FieldDef, StageId, SuggestKey } from '../content/types';
import { EXTERNAL_OPENING_TYPES, FLOOR_LABELS, INTERNAL_OPENING_TYPES } from '../content/types';
import type { FieldValue, ItemState, JobData, JobInfo, Opening, RowValue, Status, Wall } from '../job/types';
import { doubleLintelSuggestion, framingSuggestion, type FramingSuggestion } from './openings';
import {
  checkDeflection,
  checkFrameHeight,
  checkFrameLength,
  needsLintelDesign,
  num,
  studOpening,
  type Check,
} from './calc';

export const EMPTY_ITEM: ItemState = { status: 'not-started', values: {}, note: '' };

export function isSplitLevel(job: JobInfo): boolean {
  return job.houseType === 'single-split' || job.houseType === 'double-split';
}

export function isItemVisible(item: ChecklistItem, job: JobInfo): boolean {
  const w = item.appliesWhen;
  if (!w) return true;
  if (w.builders && w.builders.length > 0 && !w.builders.includes(job.builderId)) return false;
  if (w.floors && w.floors.length > 0 && !w.floors.includes(job.floor)) return false;
  if (w.conditions && w.conditions.length > 0 && !w.conditions.some((c) => job.conditions[c])) return false;
  if (w.splitLevel !== undefined && w.splitLevel !== isSplitLevel(job)) return false;
  return true;
}

/** Items of a stage in display order: items shown above the stage's table first (keeps numbering the same on screen and in the PDF). */
export function visibleItems(content: ChecklistContent, job: JobInfo, stage?: StageId): ChecklistItem[] {
  const list = content.items.filter((i) => (!stage || i.stage === stage) && isItemVisible(i, job));
  return stage ? [...list.filter((i) => i.showAbovePanel), ...list.filter((i) => !i.showAbovePanel)] : list;
}

export function hiddenItems(content: ChecklistContent, job: JobInfo, stage: StageId): ChecklistItem[] {
  return content.items.filter((i) => i.stage === stage && !isItemVisible(i, job));
}

export function getBuilder(content: ChecklistContent, id: string): Builder | undefined {
  return content.builders.find((b) => b.id === id);
}

export function suggestionFor(key: SuggestKey | undefined, builder: Builder | undefined, job: JobInfo): string | null {
  if (!key) return null;
  if (key === 'floor.panelName') return FLOOR_LABELS[job.floor];
  if (!builder) return null;
  switch (key) {
    case 'builder.stud':
      return builder.framing.stud;
    case 'builder.lbTopPlate':
      return builder.framing.lbTopPlate;
    case 'builder.nlbTopPlate':
      return builder.framing.nlbTopPlate;
    case 'builder.bottomPlate':
      return builder.framing.bottomPlate;
    case 'builder.nogging':
      return builder.framing.nogging;
    case 'builder.headExternal':
      return builder.headHeights?.external?.toString() ?? null;
    case 'builder.headInternal':
      return builder.headHeights?.internal?.toString() ?? null;
    case 'builder.headBic':
      return builder.headHeights?.bic?.toString() ?? null;
  }
}

function isEmpty(v: FieldValue | undefined): boolean {
  if (v === undefined) return true;
  if (Array.isArray(v)) return v.length === 0;
  return v.trim() === '';
}

/** Values of a tick-list field ('checks') or photo ids ('photos'). */
export function listValue(v: FieldValue | undefined): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

/** Rows of a 'rows' field. */
export function rowsValue(v: FieldValue | undefined): RowValue[] {
  return Array.isArray(v) ? v.filter((x): x is RowValue => typeof x === 'object' && x !== null) : [];
}

/** A field with `showWhen` is shown only while that tick-list option is ticked. */
export function isFieldVisible(field: FieldDef, state: ItemState): boolean {
  if (!field.showWhen) return true;
  return listValue(state.values[field.showWhen.field]).includes(field.showWhen.includes);
}

/** Problems with an item that the user should see (only meaningful once the item is "Done"). */
export function itemProblems(item: ChecklistItem, state: ItemState): string[] {
  const out: string[] = [];
  for (const f of item.fields ?? []) {
    if (!isFieldVisible(f, state)) continue;
    const v = state.values[f.id];
    if (f.required && isEmpty(v)) out.push(f.kind === 'rows' ? `"${f.label}": add at least one row` : f.kind === 'photos' ? `"${f.label}": add at least one picture` : `"${f.label}" is empty`);
    if (f.kind === 'checks' && f.requireAll) {
      const ticked = listValue(v);
      const missing = (f.options ?? []).filter((o) => !ticked.includes(o));
      if (missing.length > 0) out.push(`${missing.length} of ${(f.options ?? []).length} not ticked: ${missing.join('; ')}`);
    }
    if (f.kind === 'number' && typeof v === 'string' && v.trim() !== '' && num(v) === null) out.push(`"${f.label}" is not a number`);
    if (f.kind === 'rows') {
      rowsValue(v).forEach((row, i) => {
        for (const c of f.columns ?? []) {
          const cell = (row[c.id] ?? '').trim();
          if (c.required && !cell) out.push(`"${f.label}" row ${i + 1}: "${c.label}" is empty`);
          else if (c.kind === 'number' && cell && num(cell) === null) out.push(`"${f.label}" row ${i + 1}: "${c.label}" is not a number`);
        }
      });
    }
  }
  return out;
}

/** Labels typed in "Internal load-bearing walls" (Identify load-bearing walls). */
export function internalLoadBearingLabels(data: JobData): string[] {
  const v = itemState(data, 'jr-load-bearing').values.internalLb;
  return typeof v === 'string' ? v.split(/[,\s;]+/).map((s) => s.trim().toUpperCase()).filter(Boolean) : [];
}

/** The builder has front-façade rules (Ashmont). */
export function usesFrontFacade(content: ChecklistContent, data: JobData): boolean {
  return !!getBuilder(content, data.job.builderId)?.usesFrontFacade;
}

export function itemState(data: JobData, id: string): ItemState {
  return data.items[id] ?? EMPTY_ITEM;
}

export function isComplete(status: Status): boolean {
  return status === 'done' || status === 'na';
}

export interface Progress {
  total: number;
  complete: number;
  confirm: number;
  blocked: number;
}

export function stageProgress(content: ChecklistContent, data: JobData, stage: StageId): Progress {
  const list = visibleItems(content, data.job, stage);
  const p: Progress = { total: list.length, complete: 0, confirm: 0, blocked: 0 };
  for (const i of list) {
    const s = itemState(data, i.id).status;
    if (isComplete(s)) p.complete++;
    if (s === 'confirm') p.confirm++;
    if (s === 'blocked') p.blocked++;
  }
  return p;
}

// ─── Walls and openings ───

export interface WallIssue {
  wallId: string | null;
  label: string;
  kind: 'label' | 'length' | 'height' | 'placement' | 'load-bearing';
  check: Check;
}

/** Internal walls listed as load-bearing in "Identify load-bearing walls" but not ticked LB (and the reverse). */
export function loadBearingIssues(data: JobData): WallIssue[] {
  const listed = internalLoadBearingLabels(data);
  const out: WallIssue[] = [];
  for (const w of data.walls) {
    if (w.elevationId !== null) continue;
    const key = w.label.trim().toUpperCase();
    if (listed.includes(key) && !w.loadBearing)
      out.push({ wallId: w.id, label: w.label, kind: 'load-bearing', check: { level: 'warn', message: `${w.label} is listed as internal load-bearing but LB is not ticked` } });
    if (!listed.includes(key) && w.loadBearing && listed.length > 0)
      out.push({ wallId: w.id, label: w.label, kind: 'load-bearing', check: { level: 'warn', message: `${w.label} is ticked LB but not listed in "Identify load-bearing walls"` } });
  }
  return out;
}

export function wallIssues(walls: Wall[]): WallIssue[] {
  const out: WallIssue[] = [];
  const counts = new Map<string, number>();
  for (const w of walls) {
    const key = w.label.trim().toUpperCase();
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (const w of walls) {
    const key = w.label.trim().toUpperCase();
    if (!key) out.push({ wallId: w.id, label: '(no label)', kind: 'label', check: { level: 'warn', message: 'Wall has no label' } });
    else if ((counts.get(key) ?? 0) > 1) out.push({ wallId: w.id, label: w.label, kind: 'label', check: { level: 'warn', message: `${w.label} is listed more than once` } });
    const len = num(w.length);
    if (len !== null) {
      const c = checkFrameLength(len);
      if (c.level !== 'ok') out.push({ wallId: w.id, label: w.label, kind: 'length', check: { ...c, message: `${w.label}: ${c.message}` } });
    }
    const h = num(w.height);
    if (h !== null) {
      const c = checkFrameHeight(h);
      if (c.level !== 'ok') out.push({ wallId: w.id, label: w.label, kind: 'height', check: { ...c, message: `${w.label}: ${c.message}` } });
    }
    if (/^E/i.test(w.label.trim()) && w.elevationId === null)
      out.push({ wallId: w.id, label: w.label, kind: 'placement', check: { level: 'warn', message: `${w.label} looks external but is under "Internal"` } });
  }
  return out;
}

export interface OpeningCalc {
  stud: ReturnType<typeof studOpening> | null;
  lintelNeeded: boolean;
  deflection: Check[];
  issues: Check[];
  /** Suggested lintel / trimmer / jamb / prop (null until the wall and size are known). */
  framing: FramingSuggestion | null;
  /** Trimmer to use: the detailer's choice, else the suggestion. */
  trimmer: string;
  /** Front-elevation brick veneer applies (Ashmont +130, floating studs). */
  frontBrickVeneer: boolean;
  /** "2/90x35 …" when the entered lintel is single-ply 90x35 / 140x35. */
  doubleLintel: { hyne: string | null; autobeam: string | null };
}

/** Front-elevation brick veneer: the detailer's choice, else the wall (front façade + brick veneer). */
export function isFrontBrickVeneer(content: ChecklistContent, data: JobData, o: Opening): boolean {
  if (!usesFrontFacade(content, data)) return false;
  if (o.frontBrickVeneer !== null) return o.frontBrickVeneer;
  const wall = data.walls.find((w) => w.id === o.wallId);
  const elevation = wall?.elevationId ? data.elevations.find((e) => e.id === wall.elevationId) : undefined;
  return !!elevation?.frontFacade && wall?.finish === 'brick-veneer';
}

export function openingCalc(content: ChecklistContent, data: JobData, o: Opening): OpeningCalc {
  const wall = data.walls.find((w) => w.id === o.wallId);
  const builder = getBuilder(content, data.job.builderId);
  const h = num(o.scheduleH);
  const w = num(o.scheduleW);
  const issues: Check[] = [];
  if (!wall) issues.push({ level: 'warn', message: 'Choose the wall for this opening' });
  if (!o.label.trim()) issues.push({ level: 'warn', message: 'Opening has no label' });
  if (wall && wall.elevationId !== null && INTERNAL_OPENING_TYPES.includes(o.type))
    issues.push({ level: 'warn', message: `${content.allowances[o.type].label} is an internal opening — ${wall.label} is an external wall` });
  if (wall && wall.elevationId === null && EXTERNAL_OPENING_TYPES.includes(o.type))
    issues.push({ level: 'warn', message: `${content.allowances[o.type].label} is an external opening — ${wall.label} is an internal wall` });
  const frontBrickVeneer = isFrontBrickVeneer(content, data, o);
  const stud =
    h !== null && w !== null ? studOpening(o.type, h, w, content.allowances, builder, { frontFacade: frontBrickVeneer, brickVeneer: frontBrickVeneer }) : null;

  const framing = wall
    ? framingSuggestion(
        { internal: wall.elevationId === null, loadBearing: wall.loadBearing, studWidth: stud?.width ?? null, position: o.position, lintelMode: o.lintelMode },
        content.openingFraming,
      )
    : null;
  if (framing?.warning) issues.push(framing.warning);
  const lintelNeeded = framing ? framing.lintel === 'designed' : stud ? needsLintelDesign(stud.width, !!wall?.loadBearing) : !!wall?.loadBearing;

  const deflection: Check[] = [];
  if (stud && lintelNeeded) {
    for (const [label, d] of [
      ['Hyne', o.hyneDeflection],
      ['Autobeam', o.autobeamDeflection],
    ] as const) {
      const dv = num(d);
      if (dv !== null) {
        const c = checkDeflection(stud.width, dv, content.lintelTable);
        deflection.push({ ...c, message: `${label}: ${c.message}` });
      }
    }
    if (deflection.length === 0) issues.push({ level: 'warn', message: 'Lintel design needed — enter the Hyne or Autobeam result' });
  }
  const doubleLintel = {
    hyne: lintelNeeded ? doubleLintelSuggestion(o.hyneTimber, content.openingFraming.doubleLintels) : null,
    autobeam: lintelNeeded ? doubleLintelSuggestion(o.autobeamTimber, content.openingFraming.doubleLintels) : null,
  };
  if (doubleLintel.hyne || doubleLintel.autobeam) issues.push({ level: 'warn', message: `Single-ply lintel — use 2 ply (${doubleLintel.hyne ?? doubleLintel.autobeam})` });

  if (o.underGirder && (!o.criticalStud.trim() || !o.criticalDeflection.trim()))
    issues.push({ level: 'warn', message: 'Under girder: enter the critical stud size and deflection from Autobeam' });
  if (o.underGirder && o.criticalDeflection.trim() && num(o.criticalDeflection) === null)
    issues.push({ level: 'warn', message: 'Under girder: the critical stud deflection is not a number' });
  if (o.methods.includes('trimmer-plus') && !o.trimmerPlus) issues.push({ level: 'warn', message: 'Choose the trimmer offset (+30, +25 or +20)' });
  if (o.position === 'dimension' && !o.dimension.trim()) issues.push({ level: 'warn', message: 'Enter the plan dimension' });
  if (o.position !== 'middle' && !o.side) issues.push({ level: 'warn', message: 'Choose Left or Right' });
  return { stud, lintelNeeded, deflection, issues, framing, trimmer: o.trimmer || framing?.trimmer || '', frontBrickVeneer, doubleLintel };
}

// ─── Summary and final gate ───

export interface SummaryRow {
  item: ChecklistItem;
  state: ItemState;
  problems: string[];
}

export interface JobSummary {
  total: number;
  complete: number;
  incomplete: SummaryRow[];
  confirm: SummaryRow[];
  blocked: SummaryRow[];
  withProblems: SummaryRow[];
  notes: SummaryRow[];
  wallIssues: WallIssue[];
  openingIssues: { opening: Opening; checks: Check[] }[];
  openFlags: number;
}

export function jobSummary(content: ChecklistContent, data: JobData): JobSummary {
  const list = visibleItems(content, data.job);
  const s: JobSummary = {
    total: list.length,
    complete: 0,
    incomplete: [],
    confirm: [],
    blocked: [],
    withProblems: [],
    notes: [],
    wallIssues: [...wallIssues(data.walls), ...loadBearingIssues(data)],
    openingIssues: [],
    openFlags: data.review.entries.filter((e) => e.kind === 'flag' && !e.resolved).length,
  };
  for (const item of list) {
    const state = itemState(data, item.id);
    const row: SummaryRow = { item, state, problems: state.status === 'done' ? itemProblems(item, state) : [] };
    if (isComplete(state.status)) s.complete++;
    else s.incomplete.push(row);
    if (state.status === 'confirm') s.confirm.push(row);
    if (state.status === 'blocked') s.blocked.push(row);
    if (row.problems.length > 0) s.withProblems.push(row);
    if (state.note.trim()) s.notes.push(row);
  }
  for (const o of data.openings) {
    const c = openingCalc(content, data, o);
    const checks = [...c.issues, ...c.deflection.filter((d) => d.level !== 'ok')];
    if (checks.length > 0) s.openingIssues.push({ opening: o, checks });
  }
  return s;
}

export interface FinalGate {
  ready: boolean;
  reasons: string[];
}

export function finalGate(content: ChecklistContent, data: JobData): FinalGate {
  const s = jobSummary(content, data);
  const reasons: string[] = [];
  if (s.incomplete.length > 0) reasons.push(`${s.incomplete.length} item(s) are not Done or N/A`);
  if (s.withProblems.length > 0) reasons.push(`${s.withProblems.length} Done item(s) have missing values or unticked checks`);
  if (s.openFlags > 0) reasons.push(`${s.openFlags} flag(s) are still open`);
  const blockingWalls = s.wallIssues.filter((w) => w.check.level === 'block').length;
  if (blockingWalls > 0) reasons.push(`${blockingWalls} wall(s) are over the frame limits`);
  const blockingOpenings = s.openingIssues.filter((o) => o.checks.some((c) => c.level === 'block')).length;
  if (blockingOpenings > 0) reasons.push(`${blockingOpenings} opening(s) have a lintel over the deflection limit`);
  const signed = data.review.rounds.filter((r) => r.signedOffAt).length;
  if (signed < data.review.requiredChecks)
    reasons.push(data.review.requiredChecks === 2 ? 'Needs sign-off from the 2nd and 3rd checker' : 'Needs sign-off from the 2nd checker');
  return { ready: reasons.length === 0, reasons };
}
