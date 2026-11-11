// Checklist content: the rules that agents edit in the Content editor.
// Job data (what a detailer enters) lives in src/job/types.ts.

export const STAGE_IDS = [
  'job-review',
  'job-setup',
  'wall-input',
  'elevations',
  'wall-panels',
  'openings',
  'wall-adjustment',
  'elevation-check',
  'labels-notes',
] as const;
export type StageId = (typeof STAGE_IDS)[number];

export const CONDITION_KEYS = [
  'stepDown',
  'garage',
  'raked',
  'parapet',
  'stairs',
  'bath',
  'shower',
  'niche',
  'posts',
  'posiStrut',
] as const;
export type ConditionKey = (typeof CONDITION_KEYS)[number];

export const CONDITION_LABELS: Record<ConditionKey, string> = {
  stepDown: 'Step-down areas (garage, porch, alfresco…)',
  garage: 'Garage',
  raked: 'Raked walls / cathedral ceiling',
  parapet: 'Parapet walls',
  stairs: 'Stairs',
  bath: 'Bath',
  shower: 'Shower',
  niche: 'Niche',
  posts: 'Posts / steel posts',
  posiStrut: 'Posi-Strut floor system',
};

export const HOUSE_TYPES = ['single-standard', 'single-split', 'double-standard', 'double-split'] as const;
export type HouseType = (typeof HOUSE_TYPES)[number];

export const HOUSE_TYPE_LABELS: Record<HouseType, string> = {
  'single-standard': 'Single storey — standard',
  'single-split': 'Single storey — split-level',
  'double-standard': 'Double storey — standard',
  'double-split': 'Double storey — split-level',
};

export const FLOOR_KINDS = ['single', 'ground', 'first', 'granny-flat', 'studio'] as const;
export type FloorKind = (typeof FLOOR_KINDS)[number];

export const FLOOR_LABELS: Record<FloorKind, string> = {
  single: 'Single Storey',
  ground: 'Ground Floor',
  first: 'First Floor',
  'granny-flat': 'Granny Flat',
  studio: 'Studio',
};

export const OPENING_TYPES = [
  'internal-door',
  'cavity-slider',
  'smart-robe',
  'window-alu',
  'window-timber',
  'ext-door-alu',
  'ext-door-timber',
  'other',
] as const;
export type OpeningType = (typeof OPENING_TYPES)[number];

export const EXTERNAL_OPENING_TYPES: OpeningType[] = ['window-alu', 'window-timber', 'ext-door-alu', 'ext-door-timber'];

/** Calculators / helpers that can be attached to an item. */
export const WIDGET_KEYS = [
  'wall-heights',
  'nog-height',
  'step-down-height',
  'bulkhead-timber',
  'bracing-capacity',
  'tie-down',
  'address-preview',
] as const;
export type WidgetKey = (typeof WIDGET_KEYS)[number];

/** Builder framing values that a field can show as a suggestion. */
export const SUGGEST_KEYS = [
  'builder.stud',
  'builder.lbTopPlate',
  'builder.nlbTopPlate',
  'builder.bottomPlate',
  'builder.nogging',
  'builder.headExternal',
  'builder.headInternal',
  'builder.headBic',
  'floor.panelName',
] as const;
export type SuggestKey = (typeof SUGGEST_KEYS)[number];

export type FieldKind = 'text' | 'number' | 'select' | 'checks' | 'textarea';

export interface FieldDef {
  id: string;
  label: string;
  kind: FieldKind;
  unit?: string;
  options?: string[];
  placeholder?: string;
  suggest?: SuggestKey;
  /** Item cannot be "Done" while this field is empty. */
  required?: boolean;
  /** For 'checks': every option must be ticked before the item is "Done". */
  requireAll?: boolean;
}

export interface AppliesWhen {
  /** Show only for these builders (any). */
  builders?: string[];
  /** Show only for these floors / parts (any). */
  floors?: FloorKind[];
  /** Show only when at least one of these job conditions is "Yes". */
  conditions?: ConditionKey[];
  /** Show only for split-level (true) or only for standard (false) houses. */
  splitLevel?: boolean;
}

export interface SpecRef {
  source: string; // e.g. "Blueprint", "Spec", "Client feedback"
  section: string; // e.g. "4.2.1"
  text?: string;
  images?: string[]; // paths under /spec/
}

export interface Tip {
  job: string; // e.g. "26-89"
  text: string;
}

export interface ChecklistItem {
  id: string;
  stage: StageId;
  title: string;
  /** Guidance shown under the title. Lines starting with "- " render as bullets. */
  detail?: string;
  appliesWhen?: AppliesWhen;
  fields?: FieldDef[];
  widget?: WidgetKey;
  /** Builder id → rule text shown in the coloured builder box. */
  builderNotes?: Record<string, string>;
  ref?: SpecRef;
  tips?: Tip[];
}

export interface Stage {
  id: StageId;
  title: string;
  summary: string;
  ref: string;
}

export interface Framing {
  stud: string;
  lbTopPlate: string;
  nlbTopPlate: string;
  bottomPlate: string;
  nogging: string;
}

export interface OpeningOverride {
  appliesTo: OpeningType[];
  /** Replaces the standard height allowance. */
  heightAllowance?: number;
  /** Replaces the standard width allowance. */
  widthAllowance?: number;
  /** Only apply on brick veneer walls of the front façade. */
  frontFacadeBrickVeneerOnly?: boolean;
  reason: string;
}

export interface Builder {
  id: string;
  name: string;
  shortName: string;
  logo?: string;
  active: boolean;
  framing: Framing;
  headHeights?: { external?: number; internal?: number; bic?: number };
  openingOverrides: OpeningOverride[];
  /** Key rules shown on the job header. */
  notes: string[];
}

export interface Allowance {
  label: string;
  /** Width allowance in mm. For cavity sliders the door width is doubled first. */
  width: number;
  height: number;
  doubleWidth?: boolean;
  note?: string;
}

export interface LintelBand {
  minWidth: number;
  maxWidth: number;
  minDeflection: number;
  maxDeflection: number;
}

export interface ChecklistContent {
  version: number;
  updatedAt: string;
  stages: Stage[];
  items: ChecklistItem[];
  builders: Builder[];
  allowances: Record<OpeningType, Allowance>;
  lintelTable: LintelBand[];
}
