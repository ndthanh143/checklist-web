import type { ChecklistContent, LintelBand, NogRow, OpeningFraming } from '../content/types';
import { OPENING_TYPES } from '../content/types';
import { IconAdd, IconDelete } from '../ui/icons';

type Update = (fn: (c: ChecklistContent) => ChecklistContent) => void;

const n = (s: string) => (Number.isFinite(Number(s)) ? Number(s) : 0);

function NogTable({ content, update }: { content: ChecklistContent; update: Update }) {
  const setRow = (i: number, patch: Partial<NogRow>) => update((c) => ({ ...c, nogTable: c.nogTable.map((r, k) => (k === i ? { ...r, ...patch } : r)) }));
  return (
    <section className="card card-pad stack">
      <h2>Nog height and centres</h2>
      <p className="muted">For these frame heights the checklist suggests the values below. Other heights get about half the frame height.</p>
      <div className="table-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th>Frame height (mm)</th>
              <th>Nog height (mm)</th>
              <th>Nog centres (mm)</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {content.nogTable.map((r, i) => (
              <tr key={i}>
                {(['wallHeight', 'height', 'centres'] as const).map((k) => (
                  <td key={k}>
                    <input className="input" aria-label={k} inputMode="numeric" value={r[k]} onChange={(e) => setRow(i, { [k]: n(e.target.value) })} />
                  </td>
                ))}
                <td>
                  <button className="btn ghost small" aria-label="Remove row" onClick={() => update((c) => ({ ...c, nogTable: c.nogTable.filter((_, k) => k !== i) }))}>
                    <IconDelete size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <button className="btn small" onClick={() => update((c) => ({ ...c, nogTable: [...c.nogTable, { wallHeight: 0, height: 0, centres: 0 }] }))}>
          <IconAdd size={14} /> Add row
        </button>
      </div>
    </section>
  );
}

function FramingTable({ content, update }: { content: ChecklistContent; update: Update }) {
  const f = content.openingFraming;
  const set = (patch: Partial<OpeningFraming>) => update((c) => ({ ...c, openingFraming: { ...c.openingFraming, ...patch } }));
  const text = (label: string, value: string, onChange: (v: string) => void) => (
    <div className="field">
      <span className="label">{label}</span>
      <input className="input" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
  return (
    <section className="card card-pad stack">
      <h2>Opening framing suggestions</h2>
      <p className="muted">Sizes suggested on each opening. The detailer can still change the trimmer and the lintel choice.</p>
      <div className="field" style={{ maxWidth: 360 }}>
        <span className="label">No lintel needed up to this stud opening width (mm)</span>
        <input className="input" inputMode="numeric" value={f.lintelThreshold} onChange={(e) => set({ lintelThreshold: n(e.target.value) })} />
        <span className="hint">Internal openings in non-load-bearing walls, and the “No lintel” choice on external non-load-bearing walls.</span>
      </div>
      <h3>Openings with a lintel (external, load-bearing, or wider than the limit)</h3>
      <div className="field-row">
        {text('Trimmer', f.withLintel.trimmer, (v) => set({ withLintel: { ...f.withLintel, trimmer: v } }))}
        {text('Jamb stud', f.withLintel.jamb, (v) => set({ withLintel: { ...f.withLintel, jamb: v } }))}
        {text('Prop stud', f.withLintel.prop, (v) => set({ withLintel: { ...f.withLintel, prop: v } }))}
      </div>
      <h3>Internal openings without a lintel (non-load-bearing, up to the limit)</h3>
      <div className="field-row">
        {text('Trimmer', f.noLintel.trimmer, (v) => set({ noLintel: { ...f.noLintel, trimmer: v } }))}
        {text('Jamb stud (each side)', f.noLintel.jamb, (v) => set({ noLintel: { ...f.noLintel, jamb: v } }))}
        {text('Jamb stud — door 90 mm from a corner', f.noLintel.jambCorner90, (v) => set({ noLintel: { ...f.noLintel, jambCorner90: v } }))}
        {text('Jamb stud — door 70 mm from a corner', f.noLintel.jambCorner70, (v) => set({ noLintel: { ...f.noLintel, jambCorner70: v } }))}
      </div>
      <div className="field-row">
        <div className="field">
          <span className="label">Trimmer choices on each opening (comma separated)</span>
          <input className="input" defaultValue={f.trimmerOptions.join(', ')} onBlur={(e) => set({ trimmerOptions: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
        </div>
        <div className="field">
          <span className="label">Lintels to double — suggest 2 ply (comma separated)</span>
          <input className="input" defaultValue={f.doubleLintels.join(', ')} onBlur={(e) => set({ doubleLintels: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
        </div>
      </div>
    </section>
  );
}

export function TablesEditor({ content, update }: { content: ChecklistContent; update: Update }) {
  const setBand = (i: number, patch: Partial<LintelBand>) => update((c) => ({ ...c, lintelTable: c.lintelTable.map((b, k) => (k === i ? { ...b, ...patch } : b)) }));
  return (
    <main className="page stack">
      <FramingTable content={content} update={update} />
      <NogTable content={content} update={update} />
      <section className="card card-pad stack">
        <h2>Standard opening allowances</h2>
        <p className="muted">Stud opening = schedule size + allowance. Builder overrides (Builders tab) replace these for that builder.</p>
        <div className="table-wrap">
          <table className="grid">
            <thead>
              <tr>
                <th>Opening type</th>
                <th>Width + (mm)</th>
                <th>Height + (mm)</th>
                <th>Double the width first</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {OPENING_TYPES.map((t) => {
                const a = content.allowances[t];
                const set = (patch: Partial<typeof a>) => update((c) => ({ ...c, allowances: { ...c.allowances, [t]: { ...a, ...patch } } }));
                return (
                  <tr key={t}>
                    <td>
                      <input className="input" aria-label="Label" value={a.label} onChange={(e) => set({ label: e.target.value })} />
                    </td>
                    <td style={{ width: 110 }}>
                      <input className="input" aria-label={`${a.label} width`} inputMode="numeric" value={a.width} onChange={(e) => set({ width: n(e.target.value) })} />
                    </td>
                    <td style={{ width: 110 }}>
                      <input className="input" aria-label={`${a.label} height`} inputMode="numeric" value={a.height} onChange={(e) => set({ height: n(e.target.value) })} />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <input type="checkbox" aria-label={`${a.label} double width`} checked={!!a.doubleWidth} onChange={(e) => set({ doubleWidth: e.target.checked || undefined })} />
                    </td>
                    <td>
                      <input className="input" aria-label={`${a.label} note`} value={a.note ?? ''} onChange={(e) => set({ note: e.target.value || undefined })} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card card-pad stack">
        <h2>Lintel span / deflection table</h2>
        <p className="muted">Deflection over the band’s maximum is blocked. Widths in a gap or overlap use the stricter limit and show a warning.</p>
        <div className="table-wrap">
          <table className="grid">
            <thead>
              <tr>
                <th>Opening width from (mm)</th>
                <th>to (mm)</th>
                <th>Deflection from (mm)</th>
                <th>Maximum deflection (mm)</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {content.lintelTable.map((b, i) => (
                <tr key={i}>
                  {(['minWidth', 'maxWidth', 'minDeflection', 'maxDeflection'] as const).map((k) => (
                    <td key={k}>
                      <input className="input" aria-label={k} inputMode="decimal" value={b[k]} onChange={(e) => setBand(i, { [k]: n(e.target.value) })} />
                    </td>
                  ))}
                  <td>
                    <button className="btn ghost small" aria-label="Remove row" onClick={() => update((c) => ({ ...c, lintelTable: c.lintelTable.filter((_, k) => k !== i) }))}>
                      <IconDelete size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <button className="btn small" onClick={() => update((c) => ({ ...c, lintelTable: [...c.lintelTable, { minWidth: 0, maxWidth: 0, minDeflection: 0, maxDeflection: 0 }] }))}>
            <IconAdd size={14} /> Add row
          </button>
        </div>
      </section>
    </main>
  );
}
