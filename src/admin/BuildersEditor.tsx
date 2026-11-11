import { useState } from 'react';
import type { Builder, ChecklistContent, OpeningOverride } from '../content/types';
import { OPENING_TYPES } from '../content/types';
import { BuilderLogo } from '../ui/common';
import { IconAdd, IconDelete } from '../ui/icons';

type Update = (fn: (c: ChecklistContent) => ChecklistContent) => void;

function numOrUndef(s: string): number | undefined {
  const n = Number(s);
  return s.trim() === '' || !Number.isFinite(n) ? undefined : n;
}

function BuilderForm({ b, content, update }: { b: Builder; content: ChecklistContent; update: Update }) {
  const set = (patch: Partial<Builder>) => update((c) => ({ ...c, builders: c.builders.map((x) => (x.id === b.id ? { ...x, ...patch } : x)) }));
  const setOverride = (i: number, patch: Partial<OpeningOverride>) => set({ openingOverrides: b.openingOverrides.map((o, n) => (n === i ? { ...o, ...patch } : o)) });
  const framing: [keyof Builder['framing'], string][] = [
    ['stud', 'Stud'],
    ['lbTopPlate', 'Load-bearing top + ribbon plate'],
    ['nlbTopPlate', 'Non-load-bearing top plate'],
    ['bottomPlate', 'Bottom plate'],
    ['nogging', 'Nogging'],
  ];
  return (
    <div className="stack">
      <section className="card card-pad stack">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h3>Builder</h3>
          <div style={{ width: 160 }}>
            <BuilderLogo builder={b} />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <span className="label">Full name</span>
            <input className="input" value={b.name} onChange={(e) => set({ name: e.target.value })} />
          </div>
          <div className="field">
            <span className="label">Short name</span>
            <input className="input" value={b.shortName} onChange={(e) => set({ shortName: e.target.value })} />
          </div>
          <div className="field">
            <span className="label">Logo path</span>
            <input className="input" value={b.logo ?? ''} placeholder="/logos/name.png (empty = text)" onChange={(e) => set({ logo: e.target.value || undefined })} />
          </div>
        </div>
        <label className="check">
          <input type="checkbox" checked={b.active} onChange={(e) => set({ active: e.target.checked })} />
          <span>Show this builder on the home page</span>
        </label>
        <span className="hint">Builder id: {b.id}</span>
      </section>
      <section className="card card-pad stack">
        <h3>Suggested framing</h3>
        <span className="hint">Shown next to the input boxes as suggestions. Detailers still enter the sizes for each job.</span>
        <div className="field-row">
          {framing.map(([k, label]) => (
            <div key={k} className="field">
              <span className="label">{label}</span>
              <input className="input" value={b.framing[k]} onChange={(e) => set({ framing: { ...b.framing, [k]: e.target.value } })} />
            </div>
          ))}
        </div>
        <div className="field-row">
          {(['external', 'internal', 'bic'] as const).map((k) => (
            <div key={k} className="field">
              <span className="label">{k === 'external' ? 'External head height' : k === 'internal' ? 'Internal door head height' : 'BIC head height'} (mm)</span>
              <input
                className="input"
                inputMode="numeric"
                value={b.headHeights?.[k]?.toString() ?? ''}
                onChange={(e) => set({ headHeights: { ...(b.headHeights ?? {}), [k]: numOrUndef(e.target.value) } })}
              />
            </div>
          ))}
        </div>
      </section>
      <section className="card card-pad stack">
        <h3>Key rules (shown on the job)</h3>
        <textarea className="textarea" value={b.notes.join('\n')} onChange={(e) => set({ notes: e.target.value.split('\n') })} onBlur={(e) => set({ notes: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })} />
        <span className="hint">One rule per line.</span>
      </section>
      <section className="card card-pad stack">
        <h3>Opening allowance overrides</h3>
        <span className="hint">Replaces the standard allowance for these opening types (e.g. Ashmont: height +80).</span>
        {b.openingOverrides.map((o, i) => (
          <div key={i} className="admin-field">
            <div className="admin-checks">
              {OPENING_TYPES.map((t) => (
                <label key={t} className="check">
                  <input
                    type="checkbox"
                    checked={o.appliesTo.includes(t)}
                    onChange={(e) => setOverride(i, { appliesTo: e.target.checked ? [...o.appliesTo, t] : o.appliesTo.filter((x) => x !== t) })}
                  />
                  <span>{content.allowances[t].label}</span>
                </label>
              ))}
            </div>
            <div className="field-row" style={{ marginTop: 8 }}>
              <div className="field">
                <span className="label">Height allowance (mm)</span>
                <input className="input" inputMode="numeric" value={o.heightAllowance?.toString() ?? ''} placeholder="standard" onChange={(e) => setOverride(i, { heightAllowance: numOrUndef(e.target.value) })} />
              </div>
              <div className="field">
                <span className="label">Width allowance (mm)</span>
                <input className="input" inputMode="numeric" value={o.widthAllowance?.toString() ?? ''} placeholder="standard" onChange={(e) => setOverride(i, { widthAllowance: numOrUndef(e.target.value) })} />
              </div>
              <div className="field" style={{ gridColumn: 'span 2' }}>
                <span className="label">Reason (shown to the detailer)</span>
                <input className="input" value={o.reason} onChange={(e) => setOverride(i, { reason: e.target.value })} />
              </div>
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <label className="check">
                <input type="checkbox" checked={!!o.frontFacadeBrickVeneerOnly} onChange={(e) => setOverride(i, { frontFacadeBrickVeneerOnly: e.target.checked || undefined })} />
                <span>Only on brick veneer walls of the front façade</span>
              </label>
              <span style={{ flex: 1 }} />
              <button className="btn small danger" onClick={() => set({ openingOverrides: b.openingOverrides.filter((_, n) => n !== i) })}>
                <IconDelete size={14} /> Remove
              </button>
            </div>
          </div>
        ))}
        <div>
          <button className="btn small" onClick={() => set({ openingOverrides: [...b.openingOverrides, { appliesTo: [], reason: `${b.shortName}: ` }] })}>
            <IconAdd size={14} /> Add override
          </button>
        </div>
      </section>
    </div>
  );
}

export function BuildersEditor({ content, update }: { content: ChecklistContent; update: Update }) {
  const [selected, setSelected] = useState(content.builders[0]?.id ?? '');
  const b = content.builders.find((x) => x.id === selected);
  const add = () => {
    const name = window.prompt('Short name of the new builder (e.g. "Elysium")');
    if (!name?.trim()) return;
    let id = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    while (content.builders.some((x) => x.id === id)) id += '-2';
    update((c) => ({
      ...c,
      builders: [
        ...c.builders,
        { id, name: name.trim(), shortName: name.trim(), active: false, framing: { stud: '', lbTopPlate: '', nlbTopPlate: '', bottomPlate: '', nogging: '' }, openingOverrides: [], notes: [] },
      ],
    }));
    setSelected(id);
  };
  const remove = (id: string) => {
    const used = content.items.filter((i) => i.appliesWhen?.builders?.includes(id) || i.builderNotes?.[id]).length;
    if (!window.confirm(`Delete this builder?${used ? ` ${used} item(s) mention it — their rules for this builder will be removed.` : ''}\n\nTip: untick “Show this builder” instead to hide it.`)) return;
    update((c) => ({
      ...c,
      builders: c.builders.filter((x) => x.id !== id),
      items: c.items.map((i) => {
        const notes = { ...(i.builderNotes ?? {}) };
        delete notes[id];
        const builders = i.appliesWhen?.builders?.filter((x) => x !== id);
        return { ...i, builderNotes: Object.keys(notes).length ? notes : undefined, appliesWhen: i.appliesWhen ? { ...i.appliesWhen, builders } : undefined };
      }),
    }));
    setSelected(content.builders[0]?.id ?? '');
  };
  return (
    <div className="admin-layout">
      <aside className="admin-list">
        {content.builders.map((x) => (
          <button key={x.id} className={`admin-item${selected === x.id ? ' on' : ''}`} onClick={() => setSelected(x.id)}>
            {x.name} {!x.active && <span className="hint">(hidden)</span>}
          </button>
        ))}
        <button className="btn small mt" onClick={add}>
          <IconAdd size={14} /> Add builder
        </button>
      </aside>
      <main className="admin-main">
        {b ? (
          <>
            <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
              <h2>{b.name}</h2>
              <button className="btn small danger" onClick={() => remove(b.id)}>
                <IconDelete size={14} /> Delete builder
              </button>
            </div>
            <BuilderForm key={b.id} b={b} content={content} update={update} />
          </>
        ) : (
          <p className="muted">Choose a builder.</p>
        )}
      </main>
    </div>
  );
}
