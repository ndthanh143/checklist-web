import type { ChecklistContent, LintelBand } from '../content/types';
import { OPENING_TYPES } from '../content/types';
import { IconAdd, IconDelete } from '../ui/icons';

type Update = (fn: (c: ChecklistContent) => ChecklistContent) => void;

const n = (s: string) => (Number.isFinite(Number(s)) ? Number(s) : 0);

export function TablesEditor({ content, update }: { content: ChecklistContent; update: Update }) {
  const setBand = (i: number, patch: Partial<LintelBand>) => update((c) => ({ ...c, lintelTable: c.lintelTable.map((b, k) => (k === i ? { ...b, ...patch } : b)) }));
  return (
    <main className="page stack">
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
