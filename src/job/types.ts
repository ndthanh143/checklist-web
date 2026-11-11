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

export type FieldValue = string | string[];

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

export interface Opening {
  id: string;
  label: string;
  wallId: string | null;
  type: OpeningType;
  scheduleH: string;
  scheduleW: string;
  headHeight: string;
  position: 'middle' | 'dimension';
  dimension: string;
  side: 'left' | 'right' | '';
  hyneTimber: string;
  hyneDeflection: string;
  autobeamTimber: string;
  autobeamDeflection: string;
  note: string;
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
  openings: Opening[];
  review: {
    requiredChecks: 1 | 2;
    rounds: ReviewRound[];
    entries: ReviewEntry[];
  };
}

export type Role = 'detailer' | 'checker';
