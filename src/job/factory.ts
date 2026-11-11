import { CONDITION_KEYS } from '../content/types';
import type { ConditionKey, FloorKind, HouseType } from '../content/types';
import { uid } from '../lib/hash';
import type { Elevation, JobData, JobInfo, Opening, Wall } from './types';

export function emptyConditions(): Record<ConditionKey, boolean> {
  return Object.fromEntries(CONDITION_KEYS.map((k) => [k, false])) as Record<ConditionKey, boolean>;
}

export const ELEVATION_NAMING: Record<'cardinal' | 'spatial' | 'numbered', string[]> = {
  cardinal: ['North', 'South', 'East', 'West'],
  spatial: ['Front', 'Rear', 'Far', 'Near'],
  numbered: ['Elevation 1', 'Elevation 2', 'Elevation 3', 'Elevation 4'],
};

export function nameFor(style: keyof typeof ELEVATION_NAMING, index: number): string {
  const names = ELEVATION_NAMING[style];
  if (index < names.length) return names[index];
  return style === 'numbered' ? `Elevation ${index + 1}` : `${names[index % names.length]} ${Math.floor(index / names.length) + 1}`;
}

export function newElevation(name: string): Elevation {
  return { id: uid('el_'), name, frontFacade: false };
}

export function newWall(label: string, elevationId: string | null): Wall {
  return { id: uid('w_'), label, elevationId, finish: elevationId ? 'brick-veneer' : 'other', loadBearing: false, length: '', height: '' };
}

export function newOpening(label: string, wallId: string | null, internal: boolean): Opening {
  return {
    id: uid('o_'),
    label,
    wallId,
    type: internal ? 'internal-door' : 'window-alu',
    scheduleH: '',
    scheduleW: '',
    headHeight: '',
    position: 'middle',
    dimension: '',
    side: '',
    hyneTimber: '',
    hyneDeflection: '',
    autobeamTimber: '',
    autobeamDeflection: '',
    note: '',
  };
}

export function floorsFor(houseType: HouseType): FloorKind[] {
  return houseType.startsWith('double') ? ['ground', 'first'] : ['single'];
}

export function newJobData(job: JobInfo): JobData {
  return {
    format: 'lawmans-chck',
    formatVersion: 1,
    stage: 'in-progress',
    savedAt: '',
    contentVersion: 0,
    itemDefs: {},
    fingerprint: '',
    job,
    items: {},
    elevations: ELEVATION_NAMING.numbered.map(newElevation),
    walls: [],
    openings: [],
    review: { requiredChecks: 1, rounds: [], entries: [] },
  };
}

/** Copy job details from another floor's file (blueprint: double storey = two checklists). */
export function jobForOtherFloor(from: JobData, floor: FloorKind): JobData {
  const fresh = newJobData({ ...from.job, floor });
  const carry = ['jr-detailing-info', 'jr-load-bearing', 'jr-quote', 'jr-slab', 'js-thickness'];
  for (const id of carry) if (from.items[id]) fresh.items[id] = { ...from.items[id], status: 'not-started' };
  return fresh;
}
