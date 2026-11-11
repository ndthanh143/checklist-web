import type { Builder, ChecklistContent, ChecklistItem, StageId, SuggestKey } from '../content/types';
import { FLOOR_LABELS } from '../content/types';
import type { ItemState, JobData, JobInfo, Opening, Status, Wall } from '../job/types';
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

export function visibleItems(content: ChecklistContent, job: JobInfo, stage?: StageId): ChecklistItem[] {
  return content.items.filter((i) => (!stage || i.stage === stage) && isItemVisible(i, job));
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

function isEmpty(v: ItemState['values'][string] | undefined): boolean {
  if (v === undefined) return true;
  if (Array.isArray(v)) return v.length === 0;
  return v.trim() === '';
}

/** Problems with an item that the user should see (only meaningful once the item is "Done"). */
export function itemProblems(item: ChecklistItem, state: ItemState): string[] {
  const out: string[] = [];
  for (const f of item.fields ?? []) {
    const v = state.values[f.id];
    if (f.required && isEmpty(v)) out.push(`"${f.label}" is empty`);
    if (f.kind === 'checks' && f.requireAll) {
      const ticked = Array.isArray(v) ? v : [];
      const missing = (f.options ?? []).filter((o) => !ticked.includes(o));
      if (missing.length > 0) out.push(`${missing.length} of ${(f.options ?? []).length} not ticked: ${missing.join('; ')}`);
    }
    if (f.kind === 'number' && typeof v === 'string' && v.trim() !== '' && num(v) === null) out.push(`"${f.label}" is not a number`);
  }
  return out;
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
  kind: 'label' | 'length' | 'height' | 'placement';
  check: Check;
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
}

export function openingCalc(content: ChecklistContent, data: JobData, o: Opening): OpeningCalc {
  const wall = data.walls.find((w) => w.id === o.wallId);
  const elevation = wall?.elevationId ? data.elevations.find((e) => e.id === wall.elevationId) : undefined;
  const builder = getBuilder(content, data.job.builderId);
  const h = num(o.scheduleH);
  const w = num(o.scheduleW);
  const issues: Check[] = [];
  if (!wall) issues.push({ level: 'warn', message: 'Choose the wall for this opening' });
  if (!o.label.trim()) issues.push({ level: 'warn', message: 'Opening has no label' });
  const stud =
    h !== null && w !== null
      ? studOpening(o.type, h, w, content.allowances, builder, {
          frontFacade: !!elevation?.frontFacade,
          brickVeneer: wall?.finish === 'brick-veneer',
        })
      : null;
  const lintelNeeded = stud ? needsLintelDesign(stud.width, !!wall?.loadBearing) : !!wall?.loadBearing;
  const deflection: Check[] = [];
  if (stud) {
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
    if (lintelNeeded && deflection.length === 0) issues.push({ level: 'warn', message: 'Lintel design needed — enter the Hyne or Autobeam result' });
  }
  if (o.position === 'dimension' && !o.dimension.trim()) issues.push({ level: 'warn', message: 'Enter the plan dimension' });
  if (o.position === 'dimension' && !o.side) issues.push({ level: 'warn', message: 'Choose Left or Right' });
  return { stud, lintelNeeded, deflection, issues };
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
    wallIssues: wallIssues(data.walls),
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
