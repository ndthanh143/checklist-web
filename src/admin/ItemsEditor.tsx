import { useMemo, useState } from 'react';
import type { AppliesWhen, ChecklistContent, ChecklistItem, FieldDef, FieldKind, RowColumn, StageId } from '../content/types';
import { CONDITION_KEYS, CONDITION_LABELS, FIELD_KINDS, FLOOR_KINDS, FLOOR_LABELS, HOUSE_TYPES, HOUSE_TYPE_LABELS, SUGGEST_KEYS, WIDGET_KEYS } from '../content/types';
import { emptyConditions } from '../job/factory';
import type { JobInfo } from '../job/types';
import { uid } from '../lib/hash';
import { visibleItems } from '../lib/rules';
import { Modal } from '../ui/common';
import { IconAdd, IconDelete, IconShow } from '../ui/icons';

type Update = (fn: (c: ChecklistContent) => ChecklistContent) => void;

const WIDGET_LABELS: Record<(typeof WIDGET_KEYS)[number], string> = {
  'wall-heights': 'Internal wall height (external − 25)',
  'nog-height': 'Nog height and centres',
  'step-down-height': 'Step-down frame height',
  'bulkhead-timber': 'Bulkhead member and timber',
  'bracing-capacity': 'Bracing shortfall (designed − detailed)',
  'tie-down': 'Tie-down (RLW, uplift, per stud)',
  'address-preview': 'Frame layout address label',
  'opening-notes': 'Notes needed by the openings (detailing methods)',
  'girder-openings': 'Openings marked “Under girder”',
};

const KIND_LABELS: Record<FieldKind, string> = {
  text: 'Text',
  number: 'Number',
  select: 'Choose one',
  checks: 'Tick list',
  textarea: 'Long text',
  rows: 'Table (rows with “+ Add”)',
  photos: 'Pictures / screenshots',
};

function lines(text: string): string[] {
  return text.split('\n').map((s) => s.trim()).filter(Boolean);
}

function ColumnsEditor({ columns, onChange }: { columns: RowColumn[]; onChange: (c: RowColumn[]) => void }) {
  const set = (i: number, patch: Partial<RowColumn>) => onChange(columns.map((c, n) => (n === i ? { ...c, ...patch } : c)));
  const add = () => {
    const ids = new Set(columns.map((c) => c.id));
    let id = 'col';
    for (let n = 2; ids.has(id); n++) id = `col-${n}`;
    onChange([...columns, { id, label: 'New column', kind: 'text' }]);
  };
  return (
    <div className="stack" style={{ marginTop: 8 }}>
      <span className="label">Table columns</span>
      {columns.map((c, i) => (
        <div key={c.id} className="row" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: 2, minWidth: 160 }}>
            <span className="hint">Column name (id: {c.id})</span>
            <input className="input" value={c.label} onChange={(e) => set(i, { label: e.target.value })} />
          </div>
          <div className="field" style={{ flex: 1, minWidth: 120 }}>
            <span className="hint">Type</span>
            <select className="select" value={c.kind} onChange={(e) => set(i, { kind: e.target.value as RowColumn['kind'] })}>
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="select">Choose one</option>
            </select>
          </div>
          {c.kind === 'number' && (
            <div className="field" style={{ width: 80 }}>
              <span className="hint">Unit</span>
              <input className="input" value={c.unit ?? ''} onChange={(e) => set(i, { unit: e.target.value || undefined })} />
            </div>
          )}
          {c.kind === 'select' && (
            <div className="field" style={{ flex: 2, minWidth: 180 }}>
              <span className="hint">Choices (comma separated)</span>
              <input
                className="input"
                defaultValue={(c.options ?? []).join(', ')}
                onBlur={(e) => set(i, { options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
              />
            </div>
          )}
          <div className="field" style={{ flex: 2, minWidth: 160 }}>
            <span className="hint">Example text</span>
            <input className="input" value={c.placeholder ?? ''} onChange={(e) => set(i, { placeholder: e.target.value || undefined })} />
          </div>
          <label className="check">
            <input type="checkbox" checked={!!c.required} onChange={(e) => set(i, { required: e.target.checked || undefined })} />
            <span>Required</span>
          </label>
          <button className="btn small danger" aria-label={`Remove column ${c.label}`} onClick={() => onChange(columns.filter((_, n) => n !== i))}>
            <IconDelete size={14} />
          </button>
        </div>
      ))}
      <div>
        <button className="btn small" onClick={add}>
          <IconAdd size={14} /> Add column
        </button>
      </div>
    </div>
  );
}

const SUGGEST_LABELS: Record<(typeof SUGGEST_KEYS)[number], string> = {
  'builder.stud': 'Builder: stud',
  'builder.lbTopPlate': 'Builder: load-bearing top + ribbon plate',
  'builder.nlbTopPlate': 'Builder: non-load-bearing top plate',
  'builder.bottomPlate': 'Builder: bottom plate',
  'builder.nogging': 'Builder: nogging',
  'builder.headExternal': 'Builder: external head height',
  'builder.headInternal': 'Builder: internal door head height',
  'builder.headBic': 'Builder: BIC head height',
  'floor.panelName': 'Floor name (Ground Floor…)',
};

function cleanApplies(w: AppliesWhen): AppliesWhen | undefined {
  const out: AppliesWhen = {};
  if (w.builders?.length) out.builders = w.builders;
  if (w.conditions?.length) out.conditions = w.conditions;
  if (w.floors?.length) out.floors = w.floors;
  if (w.splitLevel !== undefined) out.splitLevel = w.splitLevel;
  return Object.keys(out).length ? out : undefined;
}

function toggle<T>(list: T[] | undefined, v: T, on: boolean): T[] {
  const l = list ?? [];
  return on ? [...l.filter((x) => x !== v), v] : l.filter((x) => x !== v);
}

function Checklist<T extends string>({ label, all, labels, value, onChange, hint }: { label: string; all: readonly T[]; labels: (v: T) => string; value: T[] | undefined; onChange: (v: T[]) => void; hint: string }) {
  return (
    <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className="label">{label}</legend>
      <span className="hint">{hint}</span>
      <div className="admin-checks">
        {all.map((v) => (
          <label key={v} className="check">
            <input type="checkbox" checked={value?.includes(v) ?? false} onChange={(e) => onChange(toggle(value, v, e.target.checked))} />
            <span>{labels(v)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** "Show this box only when …" — picks a tick-list box of the same item and one of its lines. */
function ShowWhenEditor({ field, fields, onChange }: { field: FieldDef; fields: FieldDef[]; onChange: (w: FieldDef['showWhen']) => void }) {
  const tickLists = fields.filter((x) => x.kind === 'checks' && x.id !== field.id);
  if (tickLists.length === 0) return null;
  const value = field.showWhen ? `${field.showWhen.field}::${field.showWhen.includes}` : '';
  return (
    <div className="field">
      <span className="label">Show this box only when ticked</span>
      <select
        className="select"
        value={value}
        onChange={(e) => {
          if (!e.target.value) return onChange(undefined);
          const [fid, ...rest] = e.target.value.split('::');
          onChange({ field: fid, includes: rest.join('::') });
        }}
      >
        <option value="">Always show</option>
        {tickLists.flatMap((t) =>
          (t.options ?? []).map((o) => (
            <option key={`${t.id}::${o}`} value={`${t.id}::${o}`}>
              {t.label}: {o}
            </option>
          )),
        )}
      </select>
    </div>
  );
}

function FieldsEditor({ fields, onChange }: { fields: FieldDef[]; onChange: (f: FieldDef[]) => void }) {
  const set = (i: number, patch: Partial<FieldDef>) => onChange(fields.map((f, n) => (n === i ? { ...f, ...patch } : f)));
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= fields.length) return;
    const copy = [...fields];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    onChange(copy);
  };
  const add = () => {
    const ids = new Set(fields.map((f) => f.id));
    let id = 'value';
    for (let n = 2; ids.has(id); n++) id = `value-${n}`;
    onChange([...fields, { id, label: 'New value', kind: 'text' }]);
  };
  return (
    <div className="stack">
      {fields.map((f, i) => (
        <div key={f.id} className="admin-field">
          <div className="field-row">
            <div className="field">
              <span className="label">Label</span>
              <input className="input" value={f.label} onChange={(e) => set(i, { label: e.target.value })} />
              <span className="hint">id: {f.id}</span>
            </div>
            <div className="field">
              <span className="label">Type</span>
              <select
                className="select"
                value={f.kind}
                onChange={(e) => {
                  const kind = e.target.value as FieldKind;
                  set(i, kind === 'rows' && !f.columns?.length ? { kind, columns: [{ id: 'value', label: 'Value', kind: 'text' }] } : { kind });
                }}
              >
                {FIELD_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
            {f.kind === 'number' && (
              <div className="field">
                <span className="label">Unit</span>
                <input className="input" value={f.unit ?? ''} placeholder="mm" onChange={(e) => set(i, { unit: e.target.value || undefined })} />
              </div>
            )}
            {(f.kind === 'text' || f.kind === 'number' || f.kind === 'select') && (
              <div className="field">
                <span className="label">Suggested value from</span>
                <select className="select" value={f.suggest ?? ''} onChange={(e) => set(i, { suggest: (e.target.value || undefined) as FieldDef['suggest'] })}>
                  <option value="">No suggestion</option>
                  {SUGGEST_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {SUGGEST_LABELS[k]}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          {(f.kind === 'select' || f.kind === 'checks') && (
            <div className="field mt" style={{ marginTop: 8 }}>
              <span className="label">{f.kind === 'checks' ? 'Things to tick (one per line)' : 'Choices (one per line)'}</span>
              <textarea
                className="textarea"
                rows={Math.max(3, (f.options ?? []).length + 1)}
                value={(f.options ?? []).join('\n')}
                onChange={(e) => set(i, { options: e.target.value.split('\n').map((s) => s.trimStart()).filter((s, n, a) => s !== '' || n === a.length - 1) })}
                onBlur={(e) => set(i, { options: lines(e.target.value) })}
              />
            </div>
          )}
          {f.kind === 'rows' && (
            <>
              <ColumnsEditor columns={f.columns ?? []} onChange={(columns) => set(i, { columns })} />
              <div className="field" style={{ marginTop: 8, maxWidth: 320 }}>
                <span className="label">Add button text</span>
                <input className="input" value={f.addLabel ?? ''} placeholder="Add row" onChange={(e) => set(i, { addLabel: e.target.value || undefined })} />
              </div>
            </>
          )}
          <div className="field-row" style={{ marginTop: 8 }}>
            <div className="field">
              <span className="label">Hint under the box (optional)</span>
              <input className="input" value={f.hint ?? ''} onChange={(e) => set(i, { hint: e.target.value || undefined })} />
            </div>
            <ShowWhenEditor field={f} fields={fields} onChange={(showWhen) => set(i, { showWhen })} />
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            {f.kind !== 'checks' && (
              <label className="check">
                <input type="checkbox" checked={!!f.required} onChange={(e) => set(i, { required: e.target.checked || undefined })} />
                <span>{f.kind === 'rows' ? 'At least one row before “Done”' : f.kind === 'photos' ? 'At least one picture before “Done”' : 'Must be filled before “Done”'}</span>
              </label>
            )}
            {f.kind === 'checks' && (
              <label className="check">
                <input type="checkbox" checked={!!f.requireAll} onChange={(e) => set(i, { requireAll: e.target.checked || undefined })} />
                <span>Every line must be ticked before “Done” (warn if not)</span>
              </label>
            )}
            <span style={{ flex: 1 }} />
            <button className="btn small" onClick={() => move(i, -1)} disabled={i === 0}>
              ↑
            </button>
            <button className="btn small" onClick={() => move(i, 1)} disabled={i === fields.length - 1}>
              ↓
            </button>
            <button className="btn small danger" onClick={() => window.confirm(`Remove "${f.label}"?`) && onChange(fields.filter((_, n) => n !== i))}>
              <IconDelete size={14} /> Remove
            </button>
          </div>
        </div>
      ))}
      <div>
        <button className="btn small" onClick={add}>
          <IconAdd size={14} /> Add a value box
        </button>
      </div>
    </div>
  );
}

function ItemForm({ item, content, update }: { item: ChecklistItem; content: ChecklistContent; update: Update }) {
  const set = (patch: Partial<ChecklistItem>) => update((c) => ({ ...c, items: c.items.map((i) => (i.id === item.id ? { ...i, ...patch } : i)) }));
  const w = item.appliesWhen ?? {};
  const setApplies = (patch: Partial<AppliesWhen>) => set({ appliesWhen: cleanApplies({ ...w, ...patch }) });
  const setNote = (builderId: string, text: string) => {
    const notes = { ...(item.builderNotes ?? {}) };
    if (text.trim()) notes[builderId] = text;
    else delete notes[builderId];
    set({ builderNotes: Object.keys(notes).length ? notes : undefined });
  };
  const ref = item.ref ?? { source: '', section: '' };
  const setRef = (patch: Partial<NonNullable<ChecklistItem['ref']>>) => {
    const next = { ...ref, ...patch };
    set({ ref: next.source || next.section || next.text || next.images?.length ? next : undefined });
  };
  const tips = item.tips ?? [];

  return (
    <div className="stack">
      <section className="card card-pad stack">
        <h3>Item</h3>
        <div className="field-row">
          <div className="field" style={{ gridColumn: 'span 2' }}>
            <label className="label" htmlFor="it-title">
              Check (one sentence)
            </label>
            <input id="it-title" className="input" value={item.title} onChange={(e) => set({ title: e.target.value })} />
          </div>
          <div className="field">
            <label className="label" htmlFor="it-stage">
              Stage
            </label>
            <select id="it-stage" className="select" value={item.stage} onChange={(e) => set({ stage: e.target.value as StageId })}>
              {content.stages.map((s, i) => (
                <option key={s.id} value={s.id}>
                  {i + 1}. {s.title}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="field">
          <label className="label" htmlFor="it-detail">
            Guidance
          </label>
          <textarea id="it-detail" className="textarea" style={{ minHeight: 110 }} value={item.detail ?? ''} onChange={(e) => set({ detail: e.target.value || undefined })} />
          <span className="hint">Start a line with “- ” to make a bullet point.</span>
        </div>
        <div className="row">
          <label className="check">
            <input type="checkbox" checked={!!item.checkerFocus} onChange={(e) => set({ checkerFocus: e.target.checked || undefined })} />
            <span>Checker focus — highlight this item for the checker during review</span>
          </label>
          <label className="check">
            <input type="checkbox" checked={!!item.showAbovePanel} onChange={(e) => set({ showAbovePanel: e.target.checked || undefined })} />
            <span>Show at the top of the stage (above the table)</span>
          </label>
        </div>
        <span className="hint">Item id: {item.id}</span>
      </section>

      <section className="card card-pad stack">
        <h3>When does this item show?</h3>
        <Checklist
          label="Builders"
          hint="None ticked = every builder."
          all={content.builders.map((b) => b.id)}
          labels={(id) => content.builders.find((b) => b.id === id)?.name ?? id}
          value={w.builders}
          onChange={(v) => setApplies({ builders: v })}
        />
        <Checklist label="Job conditions" hint="None ticked = always. Ticked = show when the job has any of them." all={CONDITION_KEYS} labels={(k) => CONDITION_LABELS[k]} value={w.conditions} onChange={(v) => setApplies({ conditions: v })} />
        <Checklist label="Floors / parts" hint="None ticked = every floor." all={FLOOR_KINDS} labels={(k) => FLOOR_LABELS[k]} value={w.floors} onChange={(v) => setApplies({ floors: v })} />
        <div className="field">
          <span className="label">House layout</span>
          <select
            className="select"
            style={{ maxWidth: 320 }}
            value={w.splitLevel === undefined ? '' : w.splitLevel ? 'split' : 'standard'}
            onChange={(e) => setApplies({ splitLevel: e.target.value === '' ? undefined : e.target.value === 'split' })}
          >
            <option value="">Standard and split-level</option>
            <option value="split">Only split-level houses</option>
            <option value="standard">Only standard houses</option>
          </select>
        </div>
      </section>

      <section className="card card-pad stack">
        <h3>Value boxes</h3>
        <FieldsEditor fields={item.fields ?? []} onChange={(f) => set({ fields: f.length ? f : undefined })} />
        <div className="field">
          <span className="label">Calculator</span>
          <select className="select" style={{ maxWidth: 420 }} value={item.widget ?? ''} onChange={(e) => set({ widget: (e.target.value || undefined) as ChecklistItem['widget'] })}>
            <option value="">None</option>
            {WIDGET_KEYS.map((k) => (
              <option key={k} value={k}>
                {WIDGET_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="card card-pad stack">
        <h3>Builder rules</h3>
        <span className="hint">Shown in the red box when the job is for that builder. Leave empty for none.</span>
        {content.builders.map((b) => (
          <div key={b.id} className="field">
            <span className="label">{b.name}</span>
            <textarea className="textarea" style={{ minHeight: 40 }} value={item.builderNotes?.[b.id] ?? ''} onChange={(e) => setNote(b.id, e.target.value)} />
          </div>
        ))}
      </section>

      <section className="card card-pad stack">
        <h3>Spec reference</h3>
        <div className="field-row">
          <div className="field">
            <span className="label">Source</span>
            <input className="input" list="ref-sources" value={ref.source} onChange={(e) => setRef({ source: e.target.value })} placeholder="Blueprint / Spec / Client feedback" />
            <datalist id="ref-sources">
              <option value="Blueprint" />
              <option value="Spec" />
              <option value="Excel" />
              <option value="Client feedback" />
            </datalist>
          </div>
          <div className="field">
            <span className="label">Section</span>
            <input className="input" value={ref.section} onChange={(e) => setRef({ section: e.target.value })} placeholder="e.g. 4.2.1" />
          </div>
        </div>
        <div className="field">
          <span className="label">Extra reference text</span>
          <textarea className="textarea" value={ref.text ?? ''} onChange={(e) => setRef({ text: e.target.value || undefined })} />
        </div>
        <div className="field">
          <span className="label">Images (one path per line, e.g. /spec/step-down-note-1.png — add a caption after “ | ”, e.g. /spec/post-case-1-plan.png | Case 1 — Plan)</span>
          <textarea
            className="textarea"
            style={{ minHeight: 50 }}
            value={(ref.images ?? []).join('\n')}
            onChange={(e) => setRef({ images: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })}
          />
        </div>
      </section>

      <section className="card card-pad stack">
        <h3>Common mistakes from client feedback</h3>
        {tips.map((t, i) => (
          <div key={i} className="row" style={{ alignItems: 'flex-start' }}>
            <input className="input" style={{ width: 110 }} aria-label="Job number" value={t.job} placeholder="Job 26-89" onChange={(e) => set({ tips: tips.map((x, n) => (n === i ? { ...x, job: e.target.value } : x)) })} />
            <textarea className="textarea" style={{ flex: 1, minHeight: 40 }} aria-label="Tip" value={t.text} onChange={(e) => set({ tips: tips.map((x, n) => (n === i ? { ...x, text: e.target.value } : x)) })} />
            <button className="btn small danger" aria-label="Remove tip" onClick={() => set({ tips: tips.filter((_, n) => n !== i).length ? tips.filter((_, n) => n !== i) : undefined })}>
              <IconDelete size={14} />
            </button>
          </div>
        ))}
        <div>
          <button className="btn small" onClick={() => set({ tips: [...tips, { job: '', text: '' }] })}>
            <IconAdd size={14} /> Add a tip
          </button>
        </div>
      </section>
    </div>
  );
}

function Preview({ content, onClose }: { content: ChecklistContent; onClose: () => void }) {
  const [job, setJob] = useState<JobInfo>({
    jobNo: 'Preview',
    builderId: content.builders[0]?.id ?? '',
    addressLine1: '',
    addressLine2: '',
    houseType: 'single-standard',
    floor: 'single',
    conditions: emptyConditions(),
    detailer: '',
  });
  const list = visibleItems(content, job);
  return (
    <Modal title="Preview the checklist" onClose={onClose} wide>
      <div className="field-row">
        <div className="field">
          <span className="label">Builder</span>
          <select className="select" value={job.builderId} onChange={(e) => setJob({ ...job, builderId: e.target.value })}>
            {content.builders.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <span className="label">House type</span>
          <select className="select" value={job.houseType} onChange={(e) => setJob({ ...job, houseType: e.target.value as JobInfo['houseType'] })}>
            {HOUSE_TYPES.map((h) => (
              <option key={h} value={h}>
                {HOUSE_TYPE_LABELS[h]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <span className="label">Floor</span>
          <select className="select" value={job.floor} onChange={(e) => setJob({ ...job, floor: e.target.value as JobInfo['floor'] })}>
            {FLOOR_KINDS.map((f) => (
              <option key={f} value={f}>
                {FLOOR_LABELS[f]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="admin-checks">
        {CONDITION_KEYS.map((k) => (
          <label key={k} className="check">
            <input type="checkbox" checked={job.conditions[k]} onChange={(e) => setJob({ ...job, conditions: { ...job.conditions, [k]: e.target.checked } })} />
            <span>{CONDITION_LABELS[k]}</span>
          </label>
        ))}
      </div>
      <p>
        <b>{list.length}</b> items for this job.
      </p>
      {content.stages.map((s, si) => {
        const items = list.filter((i) => i.stage === s.id);
        return (
          <div key={s.id}>
            <h3>
              {si + 1}. {s.title} <span className="muted">({items.length})</span>
            </h3>
            <ul style={{ margin: '4px 0 10px' }}>
              {items.map((i) => (
                <li key={i.id}>
                  {i.title}
                  {i.builderNotes?.[job.builderId] && <span className="pill block" style={{ marginLeft: 6 }}>builder rule</span>}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </Modal>
  );
}

export function ItemsEditor({ content, update }: { content: ChecklistContent; update: Update }) {
  const [selected, setSelected] = useState<string | null>(content.items[0]?.id ?? null);
  const [q, setQ] = useState('');
  const [preview, setPreview] = useState(false);
  const item = content.items.find((i) => i.id === selected) ?? null;
  const match = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (i: ChecklistItem) => !s || i.title.toLowerCase().includes(s) || (i.detail ?? '').toLowerCase().includes(s);
  }, [q]);

  const addItem = (stage: StageId) => {
    const id = `custom-${uid()}`;
    update((c) => {
      const lastIndex = c.items.map((i) => i.stage).lastIndexOf(stage);
      const items = [...c.items];
      items.splice(lastIndex + 1, 0, { id, stage, title: 'New checklist item' });
      return { ...c, items };
    });
    setSelected(id);
  };
  const move = (id: string, d: number) =>
    update((c) => {
      const items = [...c.items];
      const i = items.findIndex((x) => x.id === id);
      let j = i + d;
      while (j >= 0 && j < items.length && items[j].stage !== items[i].stage) j += d;
      if (j < 0 || j >= items.length) return c;
      [items[i], items[j]] = [items[j], items[i]];
      return { ...c, items };
    });
  const remove = (id: string) => {
    if (!window.confirm('Delete this item? Files that used it will show it as removed.')) return;
    update((c) => ({ ...c, items: c.items.filter((i) => i.id !== id) }));
    setSelected(null);
  };

  return (
    <div className="admin-layout">
      <aside className="admin-list">
        <div className="row" style={{ marginBottom: 10 }}>
          <input className="input" placeholder="Search items…" aria-label="Search items" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn small" onClick={() => setPreview(true)}>
            <IconShow size={14} /> Preview
          </button>
        </div>
        {content.stages.map((s, si) => {
          const items = content.items.filter((i) => i.stage === s.id && match(i));
          return (
            <div key={s.id} style={{ marginBottom: 12 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <div className="section-title" style={{ margin: 0 }}>
                  {si + 1}. {s.title}
                </div>
                <button className="btn ghost small" onClick={() => addItem(s.id)} aria-label={`Add item to ${s.title}`}>
                  <IconAdd size={14} />
                </button>
              </div>
              {items.map((i) => (
                <button key={i.id} className={`admin-item${selected === i.id ? ' on' : ''}`} onClick={() => setSelected(i.id)}>
                  {i.title}
                  {i.appliesWhen && <span className="hint"> · conditional</span>}
                </button>
              ))}
            </div>
          );
        })}
      </aside>
      <main className="admin-main">
        {item ? (
          <>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
              <h2>{item.title}</h2>
              <div className="row">
                <button className="btn small" onClick={() => move(item.id, -1)}>
                  ↑ Move up
                </button>
                <button className="btn small" onClick={() => move(item.id, 1)}>
                  ↓ Move down
                </button>
                <button className="btn small danger" onClick={() => remove(item.id)}>
                  <IconDelete size={14} /> Delete item
                </button>
              </div>
            </div>
            <ItemForm key={item.id} item={item} content={content} update={update} />
          </>
        ) : (
          <p className="muted">Choose an item on the left, or add one with +.</p>
        )}
      </main>
      {preview && <Preview content={content} onClose={() => setPreview(false)} />}
    </div>
  );
}
