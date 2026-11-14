import { z } from 'zod';
import {
  CONDITION_KEYS,
  DEFAULT_NOG_TABLE,
  DEFAULT_OPENING_FRAMING,
  FIELD_KINDS,
  FLOOR_KINDS,
  HOUSE_TYPES,
  OPENING_TYPE_LABELS,
  OPENING_TYPES,
  STAGE_IDS,
  SUGGEST_KEYS,
  WIDGET_KEYS,
} from './types.js';
import type { Allowance, ChecklistContent, OpeningType } from './types.js';
import { DETAILING_METHODS, LINTEL_MODES, OPENING_POSITIONS, STATUSES } from '../job/types.js';
import type { JobData } from '../job/types.js';

// ─── Content (rules) ───

const columnSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  kind: z.enum(['text', 'number', 'select']),
  unit: z.string().optional(),
  options: z.array(z.string()).optional(),
  placeholder: z.string().optional(),
  required: z.boolean().optional(),
});

const fieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  kind: z.enum(FIELD_KINDS),
  unit: z.string().optional(),
  options: z.array(z.string()).optional(),
  placeholder: z.string().optional(),
  suggest: z.enum(SUGGEST_KEYS).optional(),
  required: z.boolean().optional(),
  requireAll: z.boolean().optional(),
  columns: z.array(columnSchema).optional(),
  addLabel: z.string().optional(),
  showWhen: z.object({ field: z.string(), includes: z.string() }).optional(),
  hint: z.string().optional(),
});

const itemSchema = z.object({
  id: z.string().min(1),
  stage: z.enum(STAGE_IDS),
  title: z.string().min(1),
  detail: z.string().optional(),
  appliesWhen: z
    .object({
      builders: z.array(z.string()).optional(),
      floors: z.array(z.enum(FLOOR_KINDS)).optional(),
      conditions: z.array(z.enum(CONDITION_KEYS)).optional(),
      splitLevel: z.boolean().optional(),
    })
    .optional(),
  fields: z.array(fieldSchema).optional(),
  widget: z.enum(WIDGET_KEYS).optional(),
  builderNotes: z.record(z.string(), z.string()).optional(),
  ref: z
    .object({
      source: z.string(),
      section: z.string(),
      text: z.string().optional(),
      images: z.array(z.string()).optional(),
    })
    .optional(),
  tips: z.array(z.object({ job: z.string(), text: z.string() })).optional(),
  showAbovePanel: z.boolean().optional(),
  checkerFocus: z.boolean().optional(),
});

const builderSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  shortName: z.string().min(1),
  logo: z.string().optional(),
  active: z.boolean(),
  framing: z.object({
    stud: z.string(),
    lbTopPlate: z.string(),
    nlbTopPlate: z.string(),
    bottomPlate: z.string(),
    nogging: z.string(),
  }),
  headHeights: z
    .object({ external: z.number().optional(), internal: z.number().optional(), bic: z.number().optional() })
    .optional(),
  openingOverrides: z.array(
    z.object({
      appliesTo: z.array(z.enum(OPENING_TYPES)),
      heightAllowance: z.number().optional(),
      widthAllowance: z.number().optional(),
      frontFacadeBrickVeneerOnly: z.boolean().optional(),
      reason: z.string(),
    }),
  ),
  notes: z.array(z.string()),
  usesFrontFacade: z.boolean().optional(),
  internalDoorCornerGap: z.union([z.literal(70), z.literal(90)]).optional(),
});

const allowanceSchema = z.object({
  label: z.string(),
  width: z.number(),
  height: z.number(),
  doubleWidth: z.boolean().optional(),
  note: z.string().optional(),
});

export const contentSchema = z
  .object({
    version: z.number().int().nonnegative(),
    updatedAt: z.string(),
    stages: z.array(
      z.object({ id: z.enum(STAGE_IDS), title: z.string().min(1), summary: z.string(), ref: z.string() }),
    ),
    items: z.array(itemSchema),
    builders: z.array(builderSchema),
    // Rules saved before an opening type existed get a zero allowance for it.
    allowances: z.partialRecord(z.enum(OPENING_TYPES), allowanceSchema).transform((a) => {
      const out = {} as Record<OpeningType, Allowance>;
      for (const t of OPENING_TYPES) out[t] = a[t] ?? { label: OPENING_TYPE_LABELS[t], width: 0, height: 0 };
      return out;
    }),
    lintelTable: z.array(
      z.object({ minWidth: z.number(), maxWidth: z.number(), minDeflection: z.number(), maxDeflection: z.number() }),
    ),
    nogTable: z.array(z.object({ wallHeight: z.number(), height: z.number(), centres: z.number() })).default(DEFAULT_NOG_TABLE),
    openingFraming: z
      .object({
        lintelThreshold: z.number(),
        withLintel: z.object({ trimmer: z.string(), jamb: z.string(), prop: z.string() }),
        noLintel: z.object({ trimmer: z.string(), jamb: z.string(), jambCorner90: z.string(), jambCorner70: z.string() }),
        trimmerOptions: z.array(z.string()),
        doubleLintels: z.array(z.string()),
      })
      .default(DEFAULT_OPENING_FRAMING),
  })
  .superRefine((c, ctx) => {
    const seen = new Set<string>();
    for (const item of c.items) {
      if (seen.has(item.id)) ctx.addIssue({ code: 'custom', message: `Duplicate item id "${item.id}"` });
      seen.add(item.id);
    }
    const builderIds = new Set<string>();
    for (const b of c.builders) {
      if (builderIds.has(b.id)) ctx.addIssue({ code: 'custom', message: `Duplicate builder id "${b.id}"` });
      builderIds.add(b.id);
    }
    for (const id of STAGE_IDS) {
      if (!c.stages.some((s) => s.id === id)) ctx.addIssue({ code: 'custom', message: `Missing stage "${id}"` });
    }
  });

export function parseContent(data: unknown): ChecklistContent {
  return contentSchema.parse(data) as ChecklistContent;
}

// ─── Job file (.chck) ───

const fieldValue = z.union([z.string(), z.array(z.string()), z.array(z.record(z.string(), z.string()))]);

export const jobDataSchema = z.object({
  format: z.literal('lawmans-chck'),
  formatVersion: z.literal(1),
  stage: z.enum(['in-progress', 'review']),
  savedAt: z.string(),
  contentVersion: z.number(),
  itemDefs: z.record(z.string(), z.string()),
  fingerprint: z.string(),
  job: z.object({
    jobNo: z.string(),
    builderId: z.string(),
    addressLine1: z.string(),
    addressLine2: z.string(),
    houseType: z.enum(HOUSE_TYPES),
    floor: z.enum(FLOOR_KINDS),
    conditions: z.record(z.enum(CONDITION_KEYS), z.boolean()),
    detailer: z.string(),
  }),
  items: z.record(
    z.string(),
    z.object({
      status: z.enum(STATUSES),
      values: z.record(z.string(), fieldValue),
      note: z.string(),
      updatedAt: z.string().optional(),
    }),
  ),
  elevations: z.array(z.object({ id: z.string(), name: z.string(), frontFacade: z.boolean() })),
  walls: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      elevationId: z.string().nullable(),
      finish: z.enum(['brick-veneer', 'cladding', 'other']),
      loadBearing: z.boolean(),
      length: z.string(),
      height: z.string(),
    }),
  ),
  openings: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      wallId: z.string().nullable(),
      type: z.enum(OPENING_TYPES),
      scheduleH: z.string(),
      scheduleW: z.string(),
      headHeight: z.string(),
      position: z.enum(OPENING_POSITIONS),
      dimension: z.string(),
      side: z.enum(['left', 'right', '']),
      hyneTimber: z.string(),
      hyneDeflection: z.string(),
      autobeamTimber: z.string(),
      autobeamDeflection: z.string(),
      note: z.string(),
      // Added in v2 — older files get the defaults.
      trimmer: z.string().default(''),
      lintelMode: z.enum(LINTEL_MODES).default('designed'),
      methods: z.array(z.enum(DETAILING_METHODS)).default([]),
      trimmerPlus: z.enum(['', '+30', '+25', '+20']).default(''),
      underGirder: z.boolean().default(false),
      criticalStud: z.string().default(''),
      criticalDeflection: z.string().default(''),
      frontBrickVeneer: z.boolean().nullable().default(null),
    }),
  ),
  wallLabelDrafts: z.record(z.string(), z.string()).default({}),
  review: z.object({
    requiredChecks: z.union([z.literal(1), z.literal(2)]),
    rounds: z.array(
      z.object({ round: z.number(), checker: z.string(), startedAt: z.string(), signedOffAt: z.string().optional() }),
    ),
    entries: z.array(
      z.object({
        id: z.string(),
        itemId: z.string().nullable(),
        kind: z.enum(['flag', 'comment']),
        text: z.string(),
        photoIds: z.array(z.string()),
        author: z.string(),
        round: z.number(),
        createdAt: z.string(),
        resolved: z.boolean(),
        resolvedBy: z.string().optional(),
        resolvedAt: z.string().optional(),
        response: z.string().optional(),
      }),
    ),
    focusChecks: z.record(z.string(), z.object({ by: z.string(), at: z.string() })).default({}),
  }),
});

export function parseJobData(data: unknown): JobData {
  return migrateJobData(jobDataSchema.parse(data) as JobData);
}

/** Moves values saved by older versions of the checklist to their new place. */
export function migrateJobData(d: JobData): JobData {
  // v2: step-down areas became a table (one row per area).
  const sd = d.items['wi-step-down'];
  if (sd && typeof sd.values.areas === 'string') {
    const { areas, labels, depth, ...rest } = sd.values;
    const row = { area: String(areas ?? ''), labels: typeof labels === 'string' ? labels : '', depth: typeof depth === 'string' ? depth : '' };
    const hasData = row.area || row.labels || row.depth;
    d = { ...d, items: { ...d.items, 'wi-step-down': { ...sd, values: { ...rest, ...(hasData ? { areas: [row] } : {}) } } } };
  }
  return d;
}
