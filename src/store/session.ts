import { create } from 'zustand';
import { defaultContent } from '../content/defaultContent';
import type { ChecklistContent, StageId } from '../content/types';
import { emptyConditions, newElevation, newOpening, newWall } from '../job/factory';
import type { Elevation, FieldValue, ItemState, JobData, JobInfo, Opening, Photo, ReviewEntry, Role, Status, Wall } from '../job/types';
import { contentChanges, type ContentChanges } from '../lib/fileio';
import { uid } from '../lib/hash';
import { EMPTY_ITEM } from '../lib/rules';

export type View = 'home' | 'wizard' | 'workspace' | 'summary' | 'guide';

interface Session {
  content: ChecklistContent;
  contentSource: 'server' | 'bundled';
  /** true when the Cloudflare backend answered (login, content API). */
  server: boolean;
  view: View;

  data: JobData | null;
  photos: Photo[];
  handle: FileSystemFileHandle | null;
  dirty: boolean;
  /** When the first unsaved change was made (for the save reminder colour). */
  dirtySince: number | null;
  lastSavedAt: number | null;
  role: Role;
  reviewerName: string;
  stage: StageId;
  /** Shown after opening a file that was edited outside the app. */
  fingerprintWarning: boolean;
  contentChanges: ContentChanges | null;

  setContent: (c: ChecklistContent, source: 'server' | 'bundled') => void;
  setServer: (server: boolean) => void;
  go: (v: View) => void;
  setStage: (s: StageId) => void;
  startJob: (data: JobData) => void;
  loadJob: (opts: { data: JobData; photos: Photo[]; handle: FileSystemFileHandle | null; role: Role; reviewerName?: string; fingerprintOk: boolean }) => void;
  closeJob: () => void;
  markSaved: (data: JobData, handle: FileSystemFileHandle | null) => void;
  dismissWarnings: () => void;

  // Detailer edits (ignored in checker role)
  updateJob: (patch: Partial<JobInfo>) => void;
  setStatus: (itemId: string, status: Status) => void;
  setValue: (itemId: string, fieldId: string, value: FieldValue) => void;
  setNote: (itemId: string, note: string) => void;
  addElevation: (name: string) => void;
  updateElevation: (id: string, patch: Partial<Elevation>) => void;
  removeElevation: (id: string) => void;
  addWall: (label: string, elevationId: string | null) => void;
  updateWall: (id: string, patch: Partial<Wall>) => void;
  removeWall: (id: string) => void;
  addOpening: (label: string, wallId: string | null, internal: boolean) => void;
  updateOpening: (id: string, patch: Partial<Opening>) => void;
  removeOpening: (id: string) => void;
  sendForReview: () => void;
  respondToEntry: (entryId: string, response: string) => void;

  // Review (checker)
  setReviewerName: (name: string) => void;
  startRound: (round: number, checker: string) => void;
  addEntry: (entry: Pick<ReviewEntry, 'itemId' | 'kind' | 'text'>, photos: Photo[]) => void;
  setEntryResolved: (entryId: string, resolved: boolean) => void;
  removeEntry: (entryId: string) => void;
  signOff: () => void;
  setRequiredChecks: (n: 1 | 2) => void;
}

const now = () => new Date().toISOString();

export const useSession = create<Session>((set, get) => {
  /** Apply a change to the job as the detailer. No-op for checkers (author inputs are locked). */
  const touched = () => ({ dirty: true, dirtySince: get().dirtySince ?? Date.now() });
  const edit = (fn: (d: JobData) => JobData) => {
    const { data, role } = get();
    if (!data || role !== 'detailer') return;
    set({ data: fn(data), ...touched() });
  };
  /** Changes a checker is allowed to make (append-only review data). */
  const review = (fn: (d: JobData) => JobData) => {
    const { data } = get();
    if (!data) return;
    set({ data: fn(data), ...touched() });
  };
  const patchItem = (d: JobData, id: string, patch: Partial<ItemState>): JobData => ({
    ...d,
    items: { ...d.items, [id]: { ...(d.items[id] ?? EMPTY_ITEM), ...patch, updatedAt: now() } },
  });

  return {
    content: defaultContent,
    contentSource: 'bundled',
    server: false,
    view: 'home',
    data: null,
    photos: [],
    handle: null,
    dirty: false,
    dirtySince: null,
    lastSavedAt: null,
    role: 'detailer',
    reviewerName: '',
    stage: 'job-review',
    fingerprintWarning: false,
    contentChanges: null,

    setContent: (content, contentSource) => set({ content, contentSource }),
    setServer: (server) => set({ server }),
    go: (view) => set({ view }),
    setStage: (stage) => set({ stage, view: 'workspace' }),
    startJob: (data) =>
      set({ data, photos: [], handle: null, dirty: true, dirtySince: Date.now(), lastSavedAt: null, role: 'detailer', stage: 'job-review', view: 'workspace', fingerprintWarning: false, contentChanges: null }),
    loadJob: ({ data, photos, handle, role, reviewerName, fingerprintOk }) => {
      const changes = data.contentVersion === get().content.version ? null : contentChanges(data.itemDefs, get().content);
      const hasChanges = changes && changes.added.length + changes.changed.length + changes.removed.length > 0;
      set({
        data,
        photos,
        handle,
        role,
        reviewerName: reviewerName ?? get().reviewerName,
        dirty: false,
        dirtySince: null,
        lastSavedAt: Date.now(),
        stage: 'job-review',
        view: data.stage === 'review' ? 'summary' : 'workspace',
        fingerprintWarning: !fingerprintOk,
        contentChanges: hasChanges ? changes : null,
      });
    },
    closeJob: () => set({ data: null, photos: [], handle: null, dirty: false, dirtySince: null, lastSavedAt: null, view: 'home', fingerprintWarning: false, contentChanges: null }),
    markSaved: (data, handle) => set({ data, handle, dirty: false, dirtySince: null, lastSavedAt: Date.now() }),
    dismissWarnings: () => set({ fingerprintWarning: false, contentChanges: null }),

    updateJob: (patch) => edit((d) => ({ ...d, job: { ...d.job, ...patch, conditions: { ...d.job.conditions, ...(patch.conditions ?? {}) } } })),
    setStatus: (id, status) => edit((d) => patchItem(d, id, { status })),
    setValue: (id, fieldId, value) =>
      edit((d) => patchItem(d, id, { values: { ...(d.items[id]?.values ?? {}), [fieldId]: value } })),
    setNote: (id, note) => edit((d) => patchItem(d, id, { note })),

    addElevation: (name) => edit((d) => ({ ...d, elevations: [...d.elevations, newElevation(name)] })),
    updateElevation: (id, patch) =>
      edit((d) => ({
        ...d,
        elevations: d.elevations.map((e) => {
          if (e.id === id) return { ...e, ...patch };
          // only one front façade
          if (patch.frontFacade) return { ...e, frontFacade: false };
          return e;
        }),
      })),
    removeElevation: (id) =>
      edit((d) => ({
        ...d,
        elevations: d.elevations.filter((e) => e.id !== id),
        walls: d.walls.map((w) => (w.elevationId === id ? { ...w, elevationId: null } : w)),
      })),
    addWall: (label, elevationId) => edit((d) => ({ ...d, walls: [...d.walls, newWall(label, elevationId)] })),
    updateWall: (id, patch) => edit((d) => ({ ...d, walls: d.walls.map((w) => (w.id === id ? { ...w, ...patch } : w)) })),
    removeWall: (id) =>
      edit((d) => ({
        ...d,
        walls: d.walls.filter((w) => w.id !== id),
        openings: d.openings.map((o) => (o.wallId === id ? { ...o, wallId: null } : o)),
      })),
    addOpening: (label, wallId, internal) => edit((d) => ({ ...d, openings: [...d.openings, newOpening(label, wallId, internal)] })),
    updateOpening: (id, patch) => edit((d) => ({ ...d, openings: d.openings.map((o) => (o.id === id ? { ...o, ...patch } : o)) })),
    removeOpening: (id) => edit((d) => ({ ...d, openings: d.openings.filter((o) => o.id !== id) })),
    sendForReview: () => edit((d) => ({ ...d, stage: 'review' })),
    respondToEntry: (entryId, response) =>
      edit((d) => ({ ...d, review: { ...d.review, entries: d.review.entries.map((e) => (e.id === entryId ? { ...e, response } : e)) } })),

    setReviewerName: (reviewerName) => set({ reviewerName }),
    startRound: (round, checker) =>
      review((d) => {
        const existing = d.review.rounds.find((r) => r.round === round);
        const rounds = existing
          ? d.review.rounds.map((r) => (r.round === round ? { ...r, checker } : r))
          : [...d.review.rounds, { round, checker, startedAt: now() }];
        return { ...d, review: { ...d.review, rounds } };
      }),
    addEntry: (entry, photos) => {
      const { data, reviewerName } = get();
      if (!data) return;
      const round = data.review.rounds.at(-1)?.round ?? 2;
      const full: ReviewEntry = {
        id: uid('r_'),
        ...entry,
        photoIds: photos.map((p) => p.id),
        author: reviewerName || 'Checker',
        round,
        createdAt: now(),
        resolved: entry.kind === 'comment',
      };
      set({
        data: { ...data, review: { ...data.review, entries: [...data.review.entries, full] } },
        photos: [...get().photos, ...photos],
        ...touched(),
      });
    },
    setEntryResolved: (entryId, resolved) => {
      const { reviewerName, role } = get();
      if (role !== 'checker') return;
      review((d) => ({
        ...d,
        review: {
          ...d.review,
          entries: d.review.entries.map((e) =>
            e.id === entryId ? { ...e, resolved, resolvedBy: resolved ? reviewerName || 'Checker' : undefined, resolvedAt: resolved ? now() : undefined } : e,
          ),
        },
      }));
    },
    removeEntry: (entryId) => {
      const { data, photos, role } = get();
      if (!data || role !== 'checker') return;
      const entry = data.review.entries.find((e) => e.id === entryId);
      set({
        data: { ...data, review: { ...data.review, entries: data.review.entries.filter((e) => e.id !== entryId) } },
        photos: photos.filter((p) => !entry?.photoIds.includes(p.id)),
        ...touched(),
      });
    },
    signOff: () =>
      review((d) => {
        const last = d.review.rounds.at(-1);
        if (!last) return d;
        return { ...d, review: { ...d.review, rounds: d.review.rounds.map((r) => (r === last ? { ...r, signedOffAt: now() } : r)) } };
      }),
    setRequiredChecks: (requiredChecks) => review((d) => ({ ...d, review: { ...d.review, requiredChecks } })),
  };
});

export function newJobInfo(): JobInfo {
  return {
    jobNo: '',
    builderId: '',
    addressLine1: '',
    addressLine2: '',
    houseType: 'single-standard',
    floor: 'single',
    conditions: emptyConditions(),
    detailer: '',
  };
}

