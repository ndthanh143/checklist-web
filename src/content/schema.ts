import { z } from 'zod';
import { CONDITION_KEYS, FLOOR_KINDS, HOUSE_TYPES, OPENING_TYPES, STAGE_IDS, SUGGEST_KEYS, WIDGET_KEYS } from './types.js';
import type { ChecklistContent } from './types.js';
import { STATUSES } from '../job/types.js';
import type { JobData } from '../job/types.js';

// ─── Content (rules) ───

const fieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  kind: z.enum(['text', 'number', 'select', 'checks', 'textarea']),
  unit: z.string().optional(),
  options: z.array(z.string()).optional(),
  placeholder: z.string().optional(),
  suggest: z.enum(SUGGEST_KEYS).optional(),
  required: z.boolean().optional(),
  requireAll: z.boolean().optional(),
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
    allowances: z.record(z.enum(OPENING_TYPES), allowanceSchema),
    lintelTable: z.array(
      z.object({ minWidth: z.number(), maxWidth: z.number(), minDeflection: z.number(), maxDeflection: z.number() }),
    ),
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

const fieldValue = z.union([z.string(), z.array(z.string())]);

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
      position: z.enum(['middle', 'dimension']),
      dimension: z.string(),
      side: z.enum(['left', 'right', '']),
      hyneTimber: z.string(),
      hyneDeflection: z.string(),
      autobeamTimber: z.string(),
      autobeamDeflection: z.string(),
      note: z.string(),
    }),
  ),
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
  }),
});

export function parseJobData(data: unknown): JobData {
  return jobDataSchema.parse(data) as JobData;
}
