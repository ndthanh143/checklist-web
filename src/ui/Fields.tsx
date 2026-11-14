import { useRef, useState } from 'react';
import type { ChecklistItem, FieldDef } from '../content/types';
import { FLOOR_LABELS } from '../content/types';
import type { FieldValue, ItemState, Photo, RowValue } from '../job/types';
import { uid } from '../lib/hash';
import { METHOD_INFO } from '../lib/openings';
import {
  addressLabel,
  addressWarnings,
  bracingShortfall,
  bulkheadMember,
  bulkheadTimber,
  internalWallHeight,
  nogSuggestion,
  num,
  stepDownFrameHeight,
  tieDown,
} from '../lib/calc';
import { getBuilder, isSplitLevel, itemState, listValue, openingCalc, rowsValue, suggestionFor } from '../lib/rules';
import { useSession } from '../store/session';
import { NumberInput, readPhoto, toast, ZoomImage } from './common';
import { IconAdd, IconCamera, IconDelete } from './icons';

function Suggest({ value, onUse, label = 'Suggested', disabled }: { value: string; onUse: () => void; label?: string; disabled?: boolean }) {
  return (
    <div className="suggest">
      <span>
        {label}: <b>{value}</b>
      </span>
      {!disabled && (
        <button type="button" className="btn small" onClick={onUse}>
          Use this
        </button>
      )}
    </div>
  );
}

function FieldLabel({ field, htmlFor, as = 'label' }: { field: FieldDef; htmlFor?: string; as?: 'label' | 'legend' | 'span' }) {
  const Tag = as;
  return (
    <Tag className="label" {...(as === 'label' ? { htmlFor } : {})}>
      {field.label}
      {field.required ? <span className="block-text"> *</span> : null}
      {field.kind === 'checks' && field.requireAll ? <span className="hint"> — tick every one</span> : null}
    </Tag>
  );
}

/** A small table with "+ Add" (e.g. step-down areas, other sizes, critical studs). */
function RowsInput({ item, field, value, locked }: { item: ChecklistItem; field: FieldDef; value: FieldValue | undefined; locked: boolean }) {
  const setValue = useSession((s) => s.setValue);
  const rows = rowsValue(value);
  const columns = field.columns ?? [];
  const set = (next: RowValue[]) => setValue(item.id, field.id, next);
  const setCell = (i: number, col: string, v: string) => set(rows.map((r, n) => (n === i ? { ...r, [col]: v } : r)));
  return (
    <div className="field rows-field">
      <FieldLabel field={field} as="span" />
      {field.hint && <span className="hint">{field.hint}</span>}
      {rows.length > 0 && (
        <div className="table-wrap">
          <table className="grid rows-table">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.id}>
                    {c.label}
                    {c.required ? <span className="block-text"> *</span> : null}
                  </th>
                ))}
                {!locked && <th style={{ width: 44 }} />}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  {columns.map((c) => {
                    const v = row[c.id] ?? '';
                    const aria = `${field.label} row ${i + 1} ${c.label}`;
                    return (
                      <td key={c.id}>
                        {c.kind === 'number' ? (
                          <NumberInput value={v} onChange={(x) => setCell(i, c.id, x)} unit={c.unit} disabled={locked} placeholder={c.placeholder} ariaLabel={aria} />
                        ) : c.kind === 'select' ? (
                          <select className="select" aria-label={aria} value={v} disabled={locked} onChange={(e) => setCell(i, c.id, e.target.value)}>
                            <option value="">Choose…</option>
                            {(c.options ?? []).map((o) => (
                              <option key={o} value={o}>
                                {o}
                              </option>
                            ))}
                            {v && !(c.options ?? []).includes(v) && <option value={v}>{v}</option>}
                          </select>
                        ) : (
                          <input className="input" aria-label={aria} value={v} placeholder={c.placeholder} disabled={locked} onChange={(e) => setCell(i, c.id, e.target.value)} />
                        )}
                      </td>
                    );
                  })}
                  {!locked && (
                    <td>
                      <button type="button" className="btn ghost small" aria-label={`Remove row ${i + 1}`} onClick={() => set(rows.filter((_, n) => n !== i))}>
                        <IconDelete size={15} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {rows.length === 0 && locked && <span className="muted">None entered.</span>}
      {!locked && (
        <div>
          <button type="button" className="btn small" onClick={() => set([...rows, {}])}>
            <IconAdd size={15} /> {field.addLabel ?? 'Add row'}
          </button>
        </div>
      )}
    </div>
  );
}

/** Pictures attached to an item: choose, drop, or paste (Ctrl+V) a screenshot. */
function PhotosInput({ item, field, value, locked }: { item: ChecklistItem; field: FieldDef; value: FieldValue | undefined; locked: boolean }) {
  const { photos, addItemPhotos, removeItemPhoto } = useSession();
  const [over, setOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const ids = listValue(value);
  const add = async (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (images.length === 0) return;
    try {
      const read: Photo[] = [];
      for (const f of images) read.push({ id: uid('p_'), ...(await readPhoto(f)), name: f.name || `screenshot-${new Date().toISOString().slice(0, 19)}.jpg` });
      addItemPhotos(item.id, field.id, read);
      toast(read.length === 1 ? 'Picture added' : `${read.length} pictures added`, 'ok');
    } catch {
      toast('Could not read that image.', 'error');
    }
  };
  return (
    <div className="field">
      <FieldLabel field={field} as="span" />
      {field.hint && <span className="hint">{field.hint}</span>}
      {ids.length > 0 && (
        <div className="photo-grid">
          {ids.map((pid) => {
            const p = photos.find((x) => x.id === pid);
            if (!p) return null;
            return (
              <figure key={pid} className="photo-thumb">
                <ZoomImage src={p.dataUrl} alt={p.name} />
                {!locked && (
                  <button type="button" className="btn ghost small photo-remove" aria-label={`Remove ${p.name}`} onClick={() => window.confirm('Remove this picture?') && removeItemPhoto(item.id, field.id, pid)}>
                    <IconDelete size={14} />
                  </button>
                )}
              </figure>
            );
          })}
        </div>
      )}
      {ids.length === 0 && locked && <span className="muted">No pictures.</span>}
      {!locked && (
        <div
          className={`photo-drop${over ? ' over' : ''}`}
          tabIndex={0}
          role="button"
          aria-label={`${field.label}: click, then paste with Ctrl+V, or drop pictures here`}
          onPaste={(e) => {
            const files = Array.from(e.clipboardData.files);
            if (files.length) {
              e.preventDefault();
              add(files);
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            add(Array.from(e.dataTransfer.files));
          }}
        >
          <IconCamera size={18} />
          <span>
            Click here and press <kbd>Ctrl</kbd>+<kbd>V</kbd> to paste a screenshot, drop pictures here, or{' '}
            <button type="button" className="link-btn" onClick={() => fileRef.current?.click()}>
              choose files
            </button>
          </span>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              add(Array.from(e.target.files ?? []));
              e.target.value = '';
            }}
          />
        </div>
      )}
    </div>
  );
}

export function FieldInput({ item, field, state, locked }: { item: ChecklistItem; field: FieldDef; state: ItemState; locked: boolean }) {
  const { data, content, setValue } = useSession();
  const builder = data ? getBuilder(content, data.job.builderId) : undefined;
  const value = state.values[field.id];
  const str = typeof value === 'string' ? value : '';
  const set = (v: FieldValue) => setValue(item.id, field.id, v);
  const suggestion = data ? suggestionFor(field.suggest, builder, data.job) : null;
  const inputId = `${item.id}-${field.id}`;
  const suggestLabel = field.suggest?.startsWith('builder.') ? `Suggested for ${builder?.shortName ?? 'builder'}` : 'Suggested';

  if (field.kind === 'rows') return <RowsInput item={item} field={field} value={value} locked={locked} />;
  if (field.kind === 'photos') return <PhotosInput item={item} field={field} value={value} locked={locked} />;

  if (field.kind === 'checks') {
    const ticked = listValue(value);
    return (
      <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
        <FieldLabel field={field} as="legend" />
        {field.hint && <span className="hint">{field.hint}</span>}
        <div className="checks">
          {(field.options ?? []).map((o) => (
            <label key={o} className={`check${locked ? ' disabled' : ''}`}>
              <input
                type="checkbox"
                checked={ticked.includes(o)}
                disabled={locked}
                onChange={(e) => set(e.target.checked ? [...ticked, o] : ticked.filter((t) => t !== o))}
              />
              <span>{o}</span>
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  let control;
  if (field.kind === 'number') {
    control = <NumberInput id={inputId} value={str} onChange={set} unit={field.unit} disabled={locked} placeholder={field.placeholder} />;
  } else if (field.kind === 'select') {
    control = (
      <select id={inputId} className="select" value={str} disabled={locked} onChange={(e) => set(e.target.value)}>
        <option value="">Choose…</option>
        {(field.options ?? []).map((o) => (
          <option key={o} value={o}>
            {o}
            {field.unit ? ` ${field.unit}` : ''}
          </option>
        ))}
        {str && !(field.options ?? []).includes(str) && <option value={str}>{str}</option>}
      </select>
    );
  } else if (field.kind === 'textarea') {
    control = <textarea id={inputId} className="textarea" value={str} disabled={locked} placeholder={field.placeholder} onChange={(e) => set(e.target.value)} />;
  } else {
    control = <input id={inputId} className="input" value={str} disabled={locked} placeholder={field.placeholder} onChange={(e) => set(e.target.value)} />;
  }

  return (
    <div className="field">
      <FieldLabel field={field} htmlFor={inputId} />
      {control}
      {field.hint && <span className="hint">{field.hint}</span>}
      {suggestion && suggestion !== str && <Suggest value={suggestion} label={suggestLabel} onUse={() => set(suggestion)} disabled={locked} />}
    </div>
  );
}

// ─── Calculators attached to items ───

function WidgetNumber({ label, value, onChange, unit, locked }: { label: string; value: string; onChange: (v: string) => void; unit?: string; locked: boolean }) {
  return (
    <div className="field">
      <span className="label">{label}</span>
      <NumberInput value={value} onChange={onChange} unit={unit} disabled={locked} ariaLabel={label} />
    </div>
  );
}

export function Widget({ item, state, locked }: { item: ChecklistItem; state: ItemState; locked: boolean }) {
  const { data, content, setValue } = useSession();
  if (!data || !item.widget) return null;
  const v = (k: string) => (typeof state.values[k] === 'string' ? (state.values[k] as string) : '');
  const set = (k: string, val: string) => setValue(item.id, k, val);
  const other = (id: string, k: string) => {
    const x = itemState(data, id).values[k];
    return typeof x === 'string' ? x : '';
  };

  switch (item.widget) {
    case 'wall-heights': {
      const ext = num(v('external'));
      if (ext === null) return <div className="calc-box">Enter the external wall height to get the internal height.</div>;
      const int = String(internalWallHeight(ext));
      return (
        <div className="calc-box">
          Internal wall height = {ext} − 25 = <span className="result">{int} mm</span>{' '}
          {v('internal') !== int && !locked && (
            <button className="btn small" onClick={() => set('internal', int)}>
              Use this
            </button>
          )}
        </div>
      );
    }
    case 'nog-height': {
      const h = num(other('js-heights', 'external'));
      if (h === null) return <div className="calc-box">Enter the external wall height in “Wall heights” to get a suggestion.</div>;
      const s = nogSuggestion(h, content.nogTable);
      const done = v('height') === String(s.height) && v('centres') === String(s.centres);
      return (
        <div className="calc-box">
          For a {h} mm frame: nog height <span className="result">{s.height}</span>, centres <span className="result">{s.centres}</span>
          {s.known ? ' (blueprint default).' : ' — about half the height. Please confirm.'}{' '}
          {!done && !locked && (
            <button
              className="btn small"
              onClick={() => {
                set('height', String(s.height));
                set('centres', String(s.centres));
              }}
            >
              Use this
            </button>
          )}
        </div>
      );
    }
    case 'step-down-height': {
      const h = num(other('js-heights', 'external'));
      const split = isSplitLevel(data.job);
      const areas = rowsValue(state.values.areas).filter((r) => num(r.depth) !== null);
      if (h === null || areas.length === 0) return <div className="calc-box">Enter the external wall height (Job Setup) and each step-down depth to calculate the frame heights.</div>;
      return (
        <div className="calc-box">
          {split ? <b>Split-level house — frame height stays {h} mm; adjust the elevation offset:</b> : <b>Standard house — frame height = wall height + step-down depth:</b>}
          <ul className="issue-list" style={{ margin: '4px 0 0' }}>
            {areas.map((r, i) => {
              const d = num(r.depth)!;
              return (
                <li key={i}>
                  {r.area || `Area ${i + 1}`}
                  {r.labels ? ` (${r.labels})` : ''}:{' '}
                  {split ? (
                    <>
                      offset <span className="result">{d} mm</span>
                    </>
                  ) : (
                    <>
                      {h} + {d} = <span className="result">{stepDownFrameHeight(h, d, false)} mm</span>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      );
    }
    case 'opening-notes': {
      const rows = data.openings
        .map((o) => {
          const notes = new Set<string>();
          for (const m of o.methods) METHOD_INFO[m].notes.forEach((n) => notes.add(n));
          if (openingCalc(content, data, o).frontBrickVeneer) notes.add('+ infill');
          return { o, notes: [...notes] };
        })
        .filter((r) => r.notes.length > 0);
      if (rows.length === 0) return <div className="calc-box">No opening needs an extra note yet (from the detailing methods chosen in Openings).</div>;
      return (
        <div className="calc-box">
          <b>Notes needed by the openings</b>
          <ul className="issue-list" style={{ margin: '4px 0 0' }}>
            {rows.map(({ o, notes }) => (
              <li key={o.id}>
                <b>{o.label || 'Opening'}</b>: {notes.join(' · ')}
              </li>
            ))}
          </ul>
        </div>
      );
    }
    case 'girder-openings': {
      const list = data.openings.filter((o) => o.underGirder);
      if (list.length === 0) return null;
      return (
        <div className="calc-box">
          <b>Openings marked “Under girder”</b> <span className="hint">(entered in Openings)</span>
          <ul className="issue-list" style={{ margin: '4px 0 0' }}>
            {list.map((o) => {
              const wall = data.walls.find((w) => w.id === o.wallId);
              return (
                <li key={o.id}>
                  <b>{o.label || 'Opening'}</b>
                  {wall ? ` (${wall.label})` : ''}: critical stud {o.criticalStud ? <b>{o.criticalStud}</b> : <span className="warn-text">size missing</span>}, deflection{' '}
                  {o.criticalDeflection ? <b>{o.criticalDeflection} mm</b> : <span className="warn-text">missing</span>}
                </li>
              );
            })}
          </ul>
        </div>
      );
    }
    case 'bulkhead-timber': {
      const len = num(v('bhLength'));
      const depth = num(v('bhDepth'));
      const t = len !== null && depth !== null ? bulkheadTimber(len, depth) : null;
      return (
        <div className="calc-box">
          <b>Bulkhead calculator</b>
          <div className="calc-grid">
            <WidgetNumber label="Bulkhead length" unit="mm" value={v('bhLength')} onChange={(x) => set('bhLength', x)} locked={locked} />
            <WidgetNumber label="Bulkhead depth" unit="mm" value={v('bhDepth')} onChange={(x) => set('bhDepth', x)} locked={locked} />
          </div>
          {depth !== null && (
            <p className="mt" style={{ marginTop: 8 }}>
              Member: <span className="result">{bulkheadMember(depth)}</span>
            </p>
          )}
          {t && depth !== null && ![150, 200, 240, 300].includes(depth) && (
            <p>
              Timber if framed: plates {len} × 2 = {t.plates} · studs {t.studCount} × ({depth} − 70 = {t.studLength}) = {t.studs} · total <span className="result">{t.total} mm</span>
            </p>
          )}
        </div>
      );
    }
    case 'bracing-capacity': {
      const row = (label: string, des: string, det: string) => {
        const a = num(des);
        const b = num(det);
        if (a === null || b === null) return <li key={label}>{label}: enter designed and detailed values</li>;
        const r = bracingShortfall(a, b);
        return (
          <li key={label}>
            {label}: {r.ok ? <span className="ok-text">OK — {Math.abs(r.shortfall)} kN spare</span> : <span className="block-text">{r.shortfall} kN more bracing required</span>}
          </li>
        );
      };
      return (
        <div className="calc-box">
          <ul className="issue-list" style={{ margin: 0 }}>
            {row('Direction A', v('aDesigned'), v('aDetailed'))}
            {row('Direction B', v('bDesigned'), v('bDetailed'))}
          </ul>
        </div>
      );
    }
    case 'tie-down': {
      const spacingDefault = other('js-stud', 'spacing').replace(/\D/g, '') || '';
      const overhangDefault = other('jr-detailing-info', 'overhang');
      const span = num(v('tdSpan'));
      const overhang = num(v('tdOverhang') || overhangDefault);
      const factor = num(v('tdFactor'));
      const spacing = num(v('tdSpacing') || spacingDefault);
      const t = span !== null && overhang !== null && factor !== null && spacing !== null ? tieDown(span, overhang, factor, spacing) : null;
      return (
        <div className="calc-box">
          <b>Tie-down calculator</b> <span className="hint">(the uplift factor depends on the wind class — enter it for this job)</span>
          <div className="calc-grid">
            <WidgetNumber label="Truss span" unit="mm" value={v('tdSpan')} onChange={(x) => set('tdSpan', x)} locked={locked} />
            <WidgetNumber label="Overhang" unit="mm" value={v('tdOverhang') || overhangDefault} onChange={(x) => set('tdOverhang', x)} locked={locked} />
            <WidgetNumber label="Uplift factor" unit="kN/m²" value={v('tdFactor')} onChange={(x) => set('tdFactor', x)} locked={locked} />
            <WidgetNumber label="Stud spacing" unit="mm" value={v('tdSpacing') || spacingDefault} onChange={(x) => set('tdSpacing', x)} locked={locked} />
          </div>
          {t && (
            <p style={{ marginTop: 8 }}>
              RLW = {span} ÷ 2 + {overhang} = <b>{t.rlw} mm</b> · uplift = {(t.rlw / 1000).toFixed(3)} × {factor} = <b>{t.uplift.toFixed(3)} kN/m</b> · per stud = <span className="result">{t.perStud.toFixed(3)} kN</span>
              <br />
              <span className="hint">Compare with the nail fixing capacity. If nails are not enough, design screws; studs at 450cc or less usually resist the uplift.</span>
            </p>
          )}
        </div>
      );
    }
    case 'address-preview': {
      const builder = getBuilder(content, data.job.builderId);
      const lines = addressLabel(data.job.jobNo, FLOOR_LABELS[data.job.floor], builder?.name ?? '', data.job.addressLine1, data.job.addressLine2);
      const warns = addressWarnings(data.job.addressLine1, data.job.addressLine2);
      return (
        <div className="calc-box">
          <b>Label for the frame layout</b> <span className="hint">(edit the address on the Job Review page)</span>
          <pre style={{ fontFamily: 'Consolas, monospace', margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>{lines.join('\n')}</pre>
          {warns.map((w) => (
            <div key={w} className="warn-text">
              {w}
            </div>
          ))}
        </div>
      );
    }
  }
}
