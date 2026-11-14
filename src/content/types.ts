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
  'cabinet',
  'window-alu',
  'window-timber',
  'ext-door-alu',
  'ext-door-timber',
  'other',
] as const;
export type OpeningType = (typeof OPENING_TYPES)[number];

export const EXTERNAL_OPENING_TYPES: OpeningType[] = ['window-alu', 'window-timber', 'ext-door-alu', 'ext-door-timber'];
/** Types offered on internal walls (#17: smart robe, passage door, cavity slider and cabinet are internal only). */
export const INTERNAL_OPENING_TYPES: OpeningType[] = ['internal-door', 'cavity-slider', 'smart-robe', 'cabinet'];

/** Used when stored rules miss an opening type that was added later. */
export const OPENING_TYPE_LABELS: Record<OpeningType, string> = {
  'internal-door': 'Internal passage door',
  'cavity-slider': 'Cavity sliding door',
  'smart-robe': 'Smart robe',
  cabinet: 'Cabinet opening',
  'window-alu': 'Window (aluminium)',
  'window-timber': 'Window (timber)',
  'ext-door-alu': 'External door (aluminium)',
  'ext-door-timber': 'External door (timber)',
  other: 'Other',
};

/** Calculators / helpers that can be attached to an item. */
export const WIDGET_KEYS = [
  'wall-heights',
  'nog-height',
  'step-down-height',
  'bulkhead-timber',
  'bracing-capacity',
  'tie-down',
  'address-preview',
  'opening-notes',
  'girder-openings',
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

export const FIELD_KINDS = ['text', 'number', 'select', 'checks', 'textarea', 'rows', 'photos'] as const;
export type FieldKind = (typeof FIELD_KINDS)[number];

/** One column of a 'rows' field (a small table with "+ Add"). */
export interface RowColumn {
  id: string;
  label: string;
  kind: 'text' | 'number' | 'select';
  unit?: string;
  options?: string[];
  placeholder?: string;
  /** Every row needs this column before the item is "Done". */
  required?: boolean;
}

export interface FieldDef {
  id: string;
  label: string;
  kind: FieldKind;
  unit?: string;
  options?: string[];
  placeholder?: string;
  suggest?: SuggestKey;
  /** Item cannot be "Done" while this field is empty ('rows': at least one row; 'photos': at least one photo). */
  required?: boolean;
  /** For 'checks': every option must be ticked before the item is "Done". */
  requireAll?: boolean;
  /** For 'rows': the table columns. */
  columns?: RowColumn[];
  /** For 'rows': text of the add button, e.g. "Add area". */
  addLabel?: string;
  /** Show this field only when a tick-list field of the same item has this option ticked. */
  showWhen?: { field: string; includes: string };
  /** Short hint shown under the field. */
  hint?: string;
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
  /** Paths under /spec/. Add a caption after " | ", e.g. "/spec/post-case-1-plan.png | Case 1 — Plan". */
  images?: string[];
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
  /** Show this item above the stage's table (e.g. WHH above the openings table). */
  showAbovePanel?: boolean;
  /** Highlighted for the checker during review. */
  checkerFocus?: boolean;
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
  /** The builder has front-façade rules (Ashmont): show the front façade column and checks. */
  usesFrontFacade?: boolean;
  /** Internal door openings sit this far from wall corners (mm). Default 70. */
  internalDoorCornerGap?: 70 | 90;
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

/** Known frame heights with a fixed nog height / centres (otherwise ≈ half the height). */
export interface NogRow {
  wallHeight: number;
  height: number;
  centres: number;
}

/** Member sizes suggested for opening framing (#18, #19). */
export interface OpeningFraming {
  /** Stud opening width (mm). Up to this width an opening in a non-load-bearing wall needs no lintel. */
  lintelThreshold: number;
  /** Openings with a lintel (external, internal load-bearing, or wider than the threshold). */
  withLintel: { trimmer: string; jamb: string; prop: string };
  /** Internal openings up to the threshold in a non-load-bearing wall: no lintel, no prop stud. */
  noLintel: { trimmer: string; jamb: string; jambCorner90: string; jambCorner70: string };
  /** Trimmer choices offered on each opening. */
  trimmerOptions: string[];
  /** Lintels that should be doubled (single ply too weak), e.g. "90x35" → "2/90x35". */
  doubleLintels: string[];
}

export const DEFAULT_NOG_TABLE: NogRow[] = [
  { wallHeight: 2450, height: 1220, centres: 1200 },
  { wallHeight: 2600, height: 1350, centres: 1350 },
  { wallHeight: 2740, height: 1350, centres: 1350 },
];

export const DEFAULT_OPENING_FRAMING: OpeningFraming = {
  lintelThreshold: 1800,
  withLintel: { trimmer: '90x35', jamb: '90x35', prop: '90x35' },
  noLintel: { trimmer: '90x45', jamb: '90x45', jambCorner90: '2/90x45', jambCorner70: '2/90x35' },
  trimmerOptions: ['90x35', '90x45'],
  doubleLintels: ['90x35', '140x35'],
};

export interface ChecklistContent {
  version: number;
  updatedAt: string;
  stages: Stage[];
  items: ChecklistItem[];
  builders: Builder[];
  allowances: Record<OpeningType, Allowance>;
  lintelTable: LintelBand[];
  nogTable: NogRow[];
  openingFraming: OpeningFraming;
}
