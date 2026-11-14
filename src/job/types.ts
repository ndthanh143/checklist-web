import type { ConditionKey, FloorKind, HouseType, OpeningType } from '../content/types';

export const STATUSES = ['not-started', 'done', 'na', 'confirm', 'blocked'] as const;
export type Status = (typeof STATUSES)[number];

export const STATUS_LABELS: Record<Status, string> = {
  'not-started': 'Not started',
  done: 'Done',
  na: 'N/A',
  confirm: 'Needs confirmation',
  blocked: 'Blocked',
};

/** One row of a 'rows' field: column id → value. */
export type RowValue = Record<string, string>;

/** text/number/select/textarea → string · checks/photos (photo ids) → string[] · rows → RowValue[] */
export type FieldValue = string | string[] | RowValue[];

export interface ItemState {
  status: Status;
  values: Record<string, FieldValue>;
  note: string;
  updatedAt?: string;
}

export interface JobInfo {
  jobNo: string;
  builderId: string;
  addressLine1: string;
  addressLine2: string;
  houseType: HouseType;
  floor: FloorKind;
  conditions: Record<ConditionKey, boolean>;
  detailer: string;
}

export type ElevationNaming = 'cardinal' | 'spatial' | 'numbered' | 'custom';

export interface Elevation {
  id: string;
  name: string;
  frontFacade: boolean;
}

export type WallFinish = 'brick-veneer' | 'cladding' | 'other';

export interface Wall {
  id: string;
  label: string;
  /** null = internal wall */
  elevationId: string | null;
  finish: WallFinish;
  loadBearing: boolean;
  length: string;
  height: string;
}

export const OPENING_POSITIONS = ['middle', 'dimension', 'corner90', 'corner70'] as const;
export type OpeningPosition = (typeof OPENING_POSITIONS)[number];

/** How the lintel is handled (#18). */
export const LINTEL_MODES = ['designed', 'no-suitable', 'none'] as const;
export type LintelMode = (typeof LINTEL_MODES)[number];

/** Detailing methods (#18) — several can apply to one opening. */
export const DETAILING_METHODS = ['header-raise', 'cut-ribbon', 'cut-top', 'trimmer-plus'] as const;
export type DetailingMethod = (typeof DETAILING_METHODS)[number];

export interface Opening {
  id: string;
  label: string;
  wallId: string | null;
  type: OpeningType;
  scheduleH: string;
  scheduleW: string;
  headHeight: string;
  position: OpeningPosition;
  dimension: string;
  side: 'left' | 'right' | '';
  hyneTimber: string;
  hyneDeflection: string;
  autobeamTimber: string;
  autobeamDeflection: string;
  note: string;
  /** Trimmer chosen by the detailer ('' = use the suggested size). */
  trimmer: string;
  lintelMode: LintelMode;
  methods: DetailingMethod[];
  /** For the "+30 / +25 / +20 Trimmer" method. */
  trimmerPlus: '' | '+30' | '+25' | '+20';
  /** Wall carries a girder load → critical stud designed in Autobeam (#17). */
  underGirder: boolean;
  criticalStud: string;
  criticalDeflection: string;
  /** Ashmont front-elevation brick veneer option. null = follow the wall (front façade + brick veneer). */
  frontBrickVeneer: boolean | null;
}

export interface ReviewRound {
  round: number; // 2 = 2nd check, 3 = 3rd check
  checker: string;
  startedAt: string;
  signedOffAt?: string;
}

export interface ReviewEntry {
  id: string;
  /** null = general comment on the whole job */
  itemId: string | null;
  kind: 'flag' | 'comment';
  text: string;
  photoIds: string[];
  author: string;
  round: number;
  createdAt: string;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  /** Detailer's reply, e.g. "Fixed — moved D1 to 90 mm". */
  response?: string;
}

export interface Photo {
  id: string;
  name: string;
  mime: string;
  dataUrl: string;
}

export type FileStage = 'in-progress' | 'review';

/** Everything saved in a .chck file (photos are stored separately inside the zip). */
export interface JobData {
  format: 'lawmans-chck';
  formatVersion: 1;
  stage: FileStage;
  savedAt: string;
  contentVersion: number;
  /** item id → short hash of the item definition when the file was saved. */
  itemDefs: Record<string, string>;
  /** SHA-256 of the detailer's inputs, written by the app on every save. */
  fingerprint: string;
  job: JobInfo;
  items: Record<string, ItemState>;
  elevations: Elevation[];
  walls: Wall[];
  /** Text typed in the "e.g. E1-E4" boxes, per elevation id ("internal" for internal walls). */
  wallLabelDrafts: Record<string, string>;
  openings: Opening[];
  review: {
    requiredChecks: 1 | 2;
    rounds: ReviewRound[];
    entries: ReviewEntry[];
    /** Checker focus points the checker has verified (#24). */
    focusChecks: Record<string, FocusCheck>;
  };
}

export interface FocusCheck {
  by: string;
  at: string;
}

export type Role = 'detailer' | 'checker';
