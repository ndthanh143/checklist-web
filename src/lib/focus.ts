import type { ChecklistContent, StageId } from '../content/types';
import { FLOOR_LABELS, INTERNAL_OPENING_TYPES } from '../content/types';
import type { JobData } from '../job/types';
import { addressWarnings, num } from './calc';
import { getBuilder, isSplitLevel, itemState, listValue, loadBearingIssues, openingCalc, rowsValue, wallIssues } from './rules';

// The points a checker must focus on while revising a job (requirement-update #24).
// Each point gathers the data the detailer entered, so the checker can compare it with
// the plans in one place, then tick "Verified".

export interface FocusInfo {
  lines: string[];
  warnings: string[];
}

export interface FocusPoint {
  id: string;
  title: string;
  /** Where the detailer entered it — the "Open" link goes there. */
  stage: StageId;
  itemId?: string;
  applies?: (data: JobData) => boolean;
  info: (content: ChecklistContent, data: JobData) => FocusInfo;
}

const str = (data: JobData, itemId: string, fieldId: string): string => {
  const v = itemState(data, itemId).values[fieldId];
  return typeof v === 'string' ? v.trim() : '';
};

const rows = (data: JobData, itemId: string, fieldId: string) => rowsValue(itemState(data, itemId).values[fieldId]);

const statusNote = (data: JobData, itemId: string): string[] => {
  const s = itemState(data, itemId).status;
  return s === 'done' || s === 'na' ? [] : [`Item not marked Done (${s.replace('-', ' ')})`];
};

function otherSizes(data: JobData, itemId: string, member: string): string[] {
  return rows(data, itemId, 'otherSizes').map((r) => `${member} other size: ${r.size || '?'} at ${r.where || '?'}${r.reason ? ` (${r.reason})` : ''}`);
}

export const FOCUS_POINTS: FocusPoint[] = [
  {
    id: 'builder',
    title: 'Builder',
    stage: 'job-review',
    info: (c, d) => ({ lines: [getBuilder(c, d.job.builderId)?.name ?? d.job.builderId], warnings: [] }),
  },
  {
    id: 'address',
    title: 'Address',
    stage: 'job-review',
    itemId: 'ln-address',
    info: (_c, d) => ({
      lines: [`Job ${d.job.jobNo || '—'} · ${FLOOR_LABELS[d.job.floor]}`, d.job.addressLine1 || '(address line 1 empty)', d.job.addressLine2 || '(suburb empty)'],
      warnings: addressWarnings(d.job.addressLine1, d.job.addressLine2),
    }),
  },
  {
    id: 'wall-dimensions',
    title: 'Wall dimensions',
    stage: 'wall-panels',
    itemId: 'wp-limits',
    info: (_c, d) => {
      const noLength = d.walls.filter((w) => num(w.length) === null).map((w) => w.label);
      const issues = wallIssues(d.walls).filter((i) => i.kind === 'length' || i.kind === 'height');
      return {
        lines: [`${d.walls.length} wall panels (${d.walls.filter((w) => w.elevationId !== null).length} external, ${d.walls.filter((w) => w.elevationId === null).length} internal)`],
        warnings: [...(noLength.length ? [`No length entered: ${noLength.join(', ')}`] : []), ...issues.map((i) => i.check.message)],
      };
    },
  },
  {
    id: 'wall-heights',
    title: 'Wall height, garage set-down, step-down / split level',
    stage: 'job-setup',
    itemId: 'js-heights',
    info: (_c, d) => {
      const ext = str(d, 'js-heights', 'external');
      const int = str(d, 'js-heights', 'internal');
      const steps = rows(d, 'wi-step-down', 'areas');
      const lines = [`External ${ext || '?'} mm · internal ${int || '?'} mm`, isSplitLevel(d.job) ? 'Split-level house' : 'Standard house'];
      if (d.job.conditions.stepDown) {
        if (steps.length === 0) lines.push('Step-down: no areas entered');
        for (const r of steps) lines.push(`Step-down ${r.area || '?'} (${r.labels || '?'}): ${r.depth || '?'} mm`);
      } else lines.push('No step-down areas on this job');
      if (d.job.conditions.garage) lines.push('Garage: check the set-down');
      return { lines, warnings: [...statusNote(d, 'js-heights'), ...(d.job.conditions.stepDown && steps.length === 0 ? ['Step-down areas missing'] : [])] };
    },
  },
  {
    id: 'missing',
    title: 'Missing walls or openings?',
    stage: 'openings',
    itemId: 'op-schedule',
    info: (_c, d) => {
      const lines = d.elevations.map((e) => {
        const walls = d.walls.filter((w) => w.elevationId === e.id);
        const openings = d.openings.filter((o) => walls.some((w) => w.id === o.wallId));
        return `${e.name}: ${walls.length} walls, ${openings.length} openings`;
      });
      const internal = d.walls.filter((w) => w.elevationId === null);
      lines.push(`Internal: ${internal.length} walls, ${d.openings.filter((o) => internal.some((w) => w.id === o.wallId)).length} openings`);
      const unassigned = d.openings.filter((o) => !d.walls.some((w) => w.id === o.wallId)).map((o) => o.label);
      return { lines, warnings: unassigned.length ? [`Openings without a wall: ${unassigned.join(', ')}`] : [] };
    },
  },
  {
    id: 'opening-sizes',
    title: 'Opening and bulkhead sizes',
    stage: 'openings',
    info: (c, d) => {
      const missing = d.openings.filter((o) => num(o.scheduleH) === null || num(o.scheduleW) === null).map((o) => o.label);
      const lines = d.openings.map((o) => {
        const s = openingCalc(c, d, o).stud;
        return `${o.label}: ${o.scheduleH || '?'}×${o.scheduleW || '?'}${s ? ` → stud ${s.height}×${s.width}` : ''}`;
      });
      const bhL = str(d, 'wa-bulkhead', 'bhLength');
      const bhD = str(d, 'wa-bulkhead', 'bhDepth');
      if (bhL || bhD) lines.push(`Bulkhead: ${bhL || '?'} long × ${bhD || '?'} deep`);
      return { lines: lines.length ? lines : ['No openings entered'], warnings: missing.length ? [`Schedule size missing: ${missing.join(', ')}`] : [] };
    },
  },
  {
    id: 'window-schedule',
    title: 'External opening sizes vs the window schedule',
    stage: 'openings',
    info: (_c, d) => {
      const ext = d.openings.filter((o) => {
        const w = d.walls.find((x) => x.id === o.wallId);
        return w ? w.elevationId !== null : !INTERNAL_OPENING_TYPES.includes(o.type);
      });
      return { lines: ext.length ? ext.map((o) => `${o.label}: ${o.scheduleH || '?'} H × ${o.scheduleW || '?'} W`) : ['No external openings entered'], warnings: [] };
    },
  },
  {
    id: 'head-heights',
    title: 'Window head height and door heights',
    stage: 'openings',
    itemId: 'op-head-height',
    info: (_c, d) => {
      const whh = str(d, 'op-head-height', 'whh');
      const internal = str(d, 'op-head-height', 'internal');
      const bic = str(d, 'op-head-height', 'bic');
      const different = d.openings.filter((o) => {
        const std = INTERNAL_OPENING_TYPES.includes(o.type) ? internal : whh;
        return o.headHeight && std && o.headHeight !== std;
      });
      return {
        lines: [`WHH / external door ${whh || '?'} · internal door ${internal || '—'} · BIC ${bic || '—'}`, ...different.map((o) => `${o.label}: head ${o.headHeight} (not standard)`)],
        warnings: whh ? [] : ['Standard WHH not entered'],
      };
    },
  },
  {
    id: 'positions',
    title: 'Opening positions',
    stage: 'openings',
    itemId: 'op-position',
    info: (_c, d) => {
      const count = (p: string) => d.openings.filter((o) => o.position === p).length;
      const missing = d.openings.filter((o) => o.position !== 'middle' && (!o.side || (o.position === 'dimension' && !o.dimension.trim()))).map((o) => o.label);
      return {
        lines: [`Middle ${count('middle')} · from plan dimension ${count('dimension')} · 90 mm from corner ${count('corner90')} · 70 mm from corner ${count('corner70')}`],
        warnings: missing.length ? [`Dimension or side missing: ${missing.join(', ')}`] : [],
      };
    },
  },
  {
    id: 'lb-walls',
    title: 'External non-load-bearing and internal load-bearing walls',
    stage: 'wall-panels',
    itemId: 'jr-load-bearing',
    info: (_c, d) => {
      const extNlb = d.walls.filter((w) => w.elevationId !== null && !w.loadBearing).map((w) => w.label);
      const intLb = d.walls.filter((w) => w.elevationId === null && w.loadBearing).map((w) => w.label);
      return {
        lines: [`External non-load-bearing: ${extNlb.join(', ') || 'none'}`, `Internal load-bearing: ${intLb.join(', ') || 'none'}`],
        warnings: loadBearingIssues(d).map((i) => i.check.message),
      };
    },
  },
  {
    id: 'member-sizes',
    title: 'Stud, top plate, ribbon plate and bottom plate sizes',
    stage: 'job-setup',
    itemId: 'js-top-plate',
    info: (_c, d) => ({
      lines: [
        `Stud: ${str(d, 'js-stud', 'stud') || '?'} @ ${str(d, 'js-stud', 'spacing') || '?'}`,
        `Load-bearing top + ribbon: ${str(d, 'js-top-plate', 'lb') || '?'}`,
        `Non-load-bearing top plate: ${str(d, 'js-top-plate', 'nlb') || '?'}`,
        `Bottom plate: ${str(d, 'js-bottom-plate', 'bottom') || '?'}`,
        ...otherSizes(d, 'js-stud', 'Stud'),
        ...otherSizes(d, 'js-top-plate', 'Top / ribbon plate'),
        ...otherSizes(d, 'js-bottom-plate', 'Bottom plate'),
      ],
      warnings: [],
    }),
  },
  {
    id: 'lintels',
    title: 'Lintels',
    stage: 'openings',
    itemId: 'op-lintels',
    info: (c, d) => {
      const lines: string[] = [];
      const warnings: string[] = [];
      for (const o of d.openings) {
        const calc = openingCalc(c, d, o);
        if (calc.framing?.lintel === 'none') continue;
        if (calc.framing?.lintel === 'floor-system') {
          lines.push(`${o.label}: no suitable lintel — floor system, 2/LVL jamb + prop`);
          continue;
        }
        if (!calc.lintelNeeded) continue;
        const l = [o.hyneTimber && `Hyne ${o.hyneTimber} (${o.hyneDeflection || '?'} mm)`, o.autobeamTimber && `Autobeam ${o.autobeamTimber} (${o.autobeamDeflection || '?'} mm)`].filter(Boolean).join(' · ');
        lines.push(`${o.label}: ${l || 'lintel not entered'}${calc.trimmer ? ` · trimmer ${calc.trimmer}` : ''}`);
        for (const x of calc.deflection.filter((x) => x.level !== 'ok')) warnings.push(`${o.label}: ${x.message}`);
        if (calc.doubleLintel.hyne || calc.doubleLintel.autobeam) warnings.push(`${o.label}: single-ply lintel — use 2 ply`);
      }
      return { lines: lines.length ? lines : ['No openings need a lintel'], warnings };
    },
  },
  {
    id: 'posts',
    title: 'Posts',
    stage: 'wall-input',
    itemId: 'wi-posts',
    info: (_c, d) => {
      const members = rows(d, 'wi-engineering', 'members').filter((r) => /post/i.test(`${r.member} ${r.size}`));
      if (!d.job.conditions.posts) return { lines: ['No posts on this job (job condition)'], warnings: [] };
      const ticked = listValue(itemState(d, 'wi-posts').values.checks);
      return { lines: [`Checked: ${ticked.join(', ') || 'nothing ticked'}`, ...members.map((r) => `${r.member}: ${r.size}${r.location ? ` at ${r.location}` : ''}`)], warnings: statusNote(d, 'wi-posts') };
    },
  },
  {
    id: 'critical-studs',
    title: 'Critical studs under girders (both floors) and their size',
    stage: 'wall-adjustment',
    itemId: 'wa-critical-capacity',
    info: (_c, d) => {
      const areas = rows(d, 'wa-critical-capacity', 'areas');
      const girders = d.openings.filter((o) => o.underGirder);
      const lines = [
        ...areas.map((r) => `${r.area || '?'}${r.level ? ` (${r.level})` : ''}${r.girder ? ` — ${r.girder}` : ''}: ${r.size || '?'}, deflection ${r.deflection || '?'} mm`),
        ...girders.map((o) => `${o.label} under girder: ${o.criticalStud || '?'}, deflection ${o.criticalDeflection || '?'} mm`),
      ];
      const warnings = [
        ...girders.filter((o) => !o.criticalStud || !o.criticalDeflection).map((o) => `${o.label}: critical stud size or deflection missing`),
        ...(d.job.houseType.startsWith('double') ? ['Check the critical studs continue on the floor below'] : []),
      ];
      return { lines: lines.length ? lines : ['No critical stud areas entered'], warnings };
    },
  },
  {
    id: 'shower',
    title: 'Shower area: shower nogs and critical stud',
    stage: 'wall-adjustment',
    itemId: 'wa-shower',
    applies: (d) => d.job.conditions.shower || d.job.conditions.bath,
    info: (_c, d) => {
      const ticked = listValue(itemState(d, 'wa-shower').values.checks);
      const need = ['Noggings at 600 and 1800 to shower tray area (straight line)', 'Critical stud in shower area'];
      return { lines: need.map((n) => `${ticked.includes(n) ? '[x]' : '[  ]'} ${n}`), warnings: need.filter((n) => !ticked.includes(n)).map((n) => `Not ticked: ${n}`) };
    },
  },
  {
    id: 'betterbuilt-nogs',
    title: 'Betterbuilt: vanity nogs and step-down extra nogs',
    stage: 'wall-adjustment',
    itemId: 'wa-extra-nogs',
    applies: (d) => d.job.builderId === 'betterbuilt',
    info: (_c, d) => {
      const ticked = listValue(itemState(d, 'wa-extra-nogs').values.checks);
      const need = ['Vanity nogs: 2×90 at 735 mm high, on edge, flush to the vanity side', 'Step-down nogs'];
      return { lines: need.map((n) => `${ticked.includes(n) ? '[x]' : '[  ]'} ${n}`), warnings: need.filter((n) => !ticked.includes(n)).map((n) => `Not ticked: ${n}`) };
    },
  },
  {
    id: 'beams',
    title: 'Beam sizes',
    stage: 'wall-input',
    itemId: 'wi-beams',
    info: (_c, d) => {
      const beams = rows(d, 'wi-beams', 'beams');
      return { lines: beams.length ? beams.map((r) => `${r.beam || '?'}: ${r.size || '?'}${r.source ? ` (${r.source})` : ''}`) : ['No beams entered'], warnings: [] };
    },
  },
];

export function focusPointsFor(data: JobData): FocusPoint[] {
  return FOCUS_POINTS.filter((p) => !p.applies || p.applies(data));
}
