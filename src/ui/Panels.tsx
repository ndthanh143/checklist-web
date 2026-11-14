import { CONDITION_KEYS, CONDITION_LABELS, FLOOR_KINDS, FLOOR_LABELS, HOUSE_TYPES, HOUSE_TYPE_LABELS } from '../content/types';
import { ELEVATION_NAMING, nameFor } from '../job/factory';
import type { Wall, WallFinish } from '../job/types';
import { addressWarnings, checkFrameHeight, checkFrameLength, num, type Check } from '../lib/calc';
import { loadBearingIssues, usesFrontFacade, wallIssues } from '../lib/rules';
import { useSession } from '../store/session';
import { NumberInput, toast, YesNo } from './common';
import { IconAdd, IconDelete, IconWarn } from './icons';

export { OpeningsPanel } from './OpeningCard';

export function CheckPill({ c }: { c: Check }) {
  return <span className={`pill ${c.level}`}>{c.message}</span>;
}

// ─── Stage 1: job details ───

export function JobInfoPanel() {
  const { data, content, role, updateJob } = useSession();
  if (!data) return null;
  const locked = role !== 'detailer';
  const j = data.job;
  const warns = addressWarnings(j.addressLine1, j.addressLine2);
  return (
    <section className="card card-pad panel">
      <div className="panel-head">
        <h3>Job details</h3>
      </div>
      <div className="field-row">
        <div className="field">
          <label className="label" htmlFor="ji-jobno">Job No</label>
          <input id="ji-jobno" className="input" value={j.jobNo} disabled={locked} onChange={(e) => updateJob({ jobNo: e.target.value })} />
        </div>
        <div className="field">
          <label className="label" htmlFor="ji-builder">Builder</label>
          <select id="ji-builder" className="select" value={j.builderId} disabled={locked} onChange={(e) => updateJob({ builderId: e.target.value })}>
            {content.builders.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="ji-detailer">Detailer</label>
          <input id="ji-detailer" className="input" value={j.detailer} disabled={locked} onChange={(e) => updateJob({ detailer: e.target.value })} />
        </div>
        <div className="field">
          <label className="label" htmlFor="ji-a1">Address line 1 (Lot, No, Street)</label>
          <input id="ji-a1" className="input" value={j.addressLine1} disabled={locked} onChange={(e) => updateJob({ addressLine1: e.target.value })} />
        </div>
        <div className="field">
          <label className="label" htmlFor="ji-a2">Address line 2 (Suburb)</label>
          <input id="ji-a2" className="input" value={j.addressLine2} disabled={locked} onChange={(e) => updateJob({ addressLine2: e.target.value })} />
        </div>
        <div className="field">
          <label className="label" htmlFor="ji-house">House type</label>
          <select id="ji-house" className="select" value={j.houseType} disabled={locked} onChange={(e) => updateJob({ houseType: e.target.value as typeof j.houseType })}>
            {HOUSE_TYPES.map((h) => (
              <option key={h} value={h}>{HOUSE_TYPE_LABELS[h]}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="label" htmlFor="ji-floor">This checklist is for</label>
          <select id="ji-floor" className="select" value={j.floor} disabled={locked} onChange={(e) => updateJob({ floor: e.target.value as typeof j.floor })}>
            {FLOOR_KINDS.map((f) => (
              <option key={f} value={f}>{FLOOR_LABELS[f]}</option>
            ))}
          </select>
        </div>
      </div>
      {warns.length > 0 && (
        <div className="problems mt">
          {warns.map((w) => (
            <div key={w}><IconWarn size={14} /> {w}</div>
          ))}
        </div>
      )}
      <h3 className="mt">Job conditions</h3>
      <p className="hint" style={{ marginBottom: 8 }}>Items for “No” answers are hidden from the checklist.</p>
      <div className="option-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
        {CONDITION_KEYS.map((k) => (
          <div key={k} className="yesno">
            <span>{CONDITION_LABELS[k]}</span>
            <YesNo label={CONDITION_LABELS[k]} value={j.conditions[k]} disabled={locked} onChange={(v) => updateJob({ conditions: { ...j.conditions, [k]: v } })} />
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Stage 4: elevations ───

export function ElevationsPanel() {
  const { data, content, role, addElevation, updateElevation, removeElevation } = useSession();
  if (!data) return null;
  const locked = role !== 'detailer';
  const els = data.elevations;
  const front = usesFrontFacade(content, data);
  const applyNaming = (style: keyof typeof ELEVATION_NAMING) => {
    if (els.some((e) => e.name.trim()) && !window.confirm('Rename all elevations?')) return;
    els.forEach((e, i) => updateElevation(e.id, { name: nameFor(style, i) }));
  };
  return (
    <section className="card card-pad panel">
      <div className="panel-head">
        <h3>Elevations ({els.length})</h3>
        <div className="row">
          <span className="hint">Name them:</span>
          <button className="btn small" disabled={locked} onClick={() => applyNaming('cardinal')}>North / South / East / West</button>
          <button className="btn small" disabled={locked} onClick={() => applyNaming('spatial')}>Front / Rear / Far / Near</button>
          <button className="btn small" disabled={locked} onClick={() => applyNaming('numbered')}>Elevation 1, 2, 3…</button>
        </div>
      </div>
      <div className="table-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th style={{ width: 40 }}>#</th>
              <th>Name</th>
              {front && <th style={{ width: 150 }}>Front façade (street)</th>}
              <th style={{ width: 110 }}>Walls</th>
              <th style={{ width: 60 }} />
            </tr>
          </thead>
          <tbody>
            {els.map((e, i) => (
              <tr key={e.id}>
                <td>{i + 1}</td>
                <td>
                  <input className="input" aria-label={`Elevation ${i + 1} name`} value={e.name} disabled={locked} onChange={(ev) => updateElevation(e.id, { name: ev.target.value })} />
                </td>
                {front && (
                  <td>
                    <label className="check">
                      <input type="radio" name="front" checked={e.frontFacade} disabled={locked} onChange={() => updateElevation(e.id, { frontFacade: true })} />
                      <span>{e.frontFacade ? 'Front façade' : 'Set as front'}</span>
                    </label>
                  </td>
                )}
                <td>{data.walls.filter((w) => w.elevationId === e.id).map((w) => w.label).join(', ') || <span className="muted">—</span>}</td>
                <td>
                  <button className="btn ghost small" disabled={locked} aria-label={`Remove ${e.name}`} onClick={() => window.confirm(`Remove ${e.name}? Its walls move to "Internal".`) && removeElevation(e.id)}>
                    <IconDelete size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row mt">
        <button className="btn" disabled={locked} onClick={() => addElevation(nameFor('numbered', els.length))}>
          <IconAdd size={16} /> Add elevation
        </button>
        {front && !els.some((e) => e.frontFacade) && <span className="warn-text"><IconWarn size={14} /> No front façade set yet</span>}
      </div>
    </section>
  );
}

// ─── Stage 5: wall panels ───

/** "E1-E4, E7" → ["E1","E2","E3","E4","E7"] */
export function parseLabels(input: string): string[] {
  const out: string[] = [];
  for (const part of input.split(/[,\s;]+/).filter(Boolean)) {
    const m = /^([A-Za-z]*)(\d+)\s*-\s*([A-Za-z]*)(\d+)$/.exec(part);
    if (m && (m[3] === '' || m[3].toUpperCase() === m[1].toUpperCase())) {
      const [a, b] = [Number(m[2]), Number(m[4])];
      if (b >= a && b - a < 200) for (let n = a; n <= b; n++) out.push(`${m[1].toUpperCase()}${n}`);
    } else out.push(part.toUpperCase());
  }
  return out;
}

function WallRows({ walls, locked }: { walls: Wall[]; locked: boolean }) {
  const { data, updateWall, removeWall } = useSession();
  if (!data) return null;
  return (
    <>
      {walls.map((w) => {
        const len = num(w.length);
        const h = num(w.height);
        const checks = [len !== null ? checkFrameLength(len) : null, h !== null ? checkFrameHeight(h) : null].filter((c): c is Check => !!c && c.level !== 'ok');
        return (
          <tr key={w.id}>
            <td>
              <input className="input" style={{ width: 80 }} aria-label="Wall label" value={w.label} disabled={locked} onChange={(e) => updateWall(w.id, { label: e.target.value.toUpperCase() })} />
            </td>
            <td>
              <select className="select" style={{ minWidth: 130 }} aria-label={`Elevation for ${w.label}`} value={w.elevationId ?? ''} disabled={locked} onChange={(e) => updateWall(w.id, { elevationId: e.target.value || null })}>
                {data.elevations.map((el) => (
                  <option key={el.id} value={el.id}>{el.name}</option>
                ))}
                <option value="">Internal</option>
              </select>
            </td>
            <td>
              <select className="select" style={{ minWidth: 150 }} aria-label={`Finish for ${w.label}`} value={w.finish} disabled={locked} onChange={(e) => updateWall(w.id, { finish: e.target.value as WallFinish })}>
                <option value="brick-veneer">Brick veneer</option>
                <option value="cladding">Cladding</option>
                <option value="other">None / internal</option>
              </select>
            </td>
            <td style={{ textAlign: 'center' }}>
              <input type="checkbox" aria-label={`${w.label} load-bearing`} checked={w.loadBearing} disabled={locked} onChange={(e) => updateWall(w.id, { loadBearing: e.target.checked })} />
            </td>
            <td style={{ width: 120 }}>
              <NumberInput value={w.length} onChange={(v) => updateWall(w.id, { length: v })} disabled={locked} ariaLabel={`${w.label} length`} placeholder="mm" />
            </td>
            <td style={{ width: 120 }}>
              <NumberInput value={w.height} onChange={(v) => updateWall(w.id, { height: v })} disabled={locked} ariaLabel={`${w.label} height`} placeholder="mm" />
            </td>
            <td>{checks.length ? checks.map((c, i) => <CheckPill key={i} c={c} />) : len !== null || h !== null ? <span className="pill ok">OK</span> : null}</td>
            <td>
              <button className="btn ghost small" disabled={locked} aria-label={`Remove ${w.label}`} onClick={() => removeWall(w.id)}>
                <IconDelete size={15} />
              </button>
            </td>
          </tr>
        );
      })}
    </>
  );
}

/**
 * The typed labels ("E1-E8") are kept in the job — they survive changing stage and are saved
 * in the .chck file. Adding again only adds the labels that do not exist yet.
 */
function AddWalls({ elevationId, prefix, locked }: { elevationId: string | null; prefix: string; locked: boolean }) {
  const { data, addWalls, setWallLabelDraft } = useSession();
  const key = elevationId ?? 'internal';
  const text = data?.wallLabelDrafts[key] ?? '';
  const labels = parseLabels(text);
  const missing = labels.filter((l) => !data?.walls.some((w) => w.label.trim().toUpperCase() === l));
  const add = () => {
    const r = addWalls(labels, elevationId);
    if (r.added === 0) toast(r.existing.length ? `All these walls are already in the table (${r.existing.join(', ')}).` : 'Type wall labels first, e.g. E1-E8.', 'info');
    else toast(`Added ${r.added} wall${r.added > 1 ? 's' : ''}${r.existing.length ? ` · already there: ${r.existing.join(', ')}` : ''}`, 'ok');
  };
  return (
    <div className="row">
      <input
        className="input"
        style={{ width: 220 }}
        aria-label={`Wall labels to add (${elevationId ? 'elevation' : 'internal'})`}
        placeholder={`e.g. ${prefix}1-${prefix}4, ${prefix}7`}
        value={text}
        disabled={locked}
        onChange={(e) => setWallLabelDraft(key, e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && text.trim() && add()}
      />
      <button className="btn small" disabled={locked || !text.trim()} onClick={add} title={missing.length ? `Adds ${missing.join(', ')}` : 'All these walls are already in the table'}>
        <IconAdd size={15} /> Add walls{text.trim() && missing.length > 0 && missing.length !== labels.length ? ` (${missing.length} new)` : ''}
      </button>
    </div>
  );
}

export function WallsPanel() {
  const { data, content, role } = useSession();
  if (!data) return null;
  const locked = role !== 'detailer';
  const issues = [...wallIssues(data.walls).filter((i) => i.kind === 'label' || i.kind === 'placement'), ...loadBearingIssues(data)];
  const front = usesFrontFacade(content, data);
  const groups = [...data.elevations.map((e) => ({ id: e.id as string | null, name: e.name, front: front && e.frontFacade })), { id: null, name: 'Internal', front: false }];
  return (
    <section className="panel">
      <div className="panel-head">
        <h3>Wall panels by elevation ({data.walls.length})</h3>
        <span className="hint">Type labels like “E1-E8” to add several at once. LB = load-bearing: external walls start ticked, internal walls unticked.</span>
      </div>
      {issues.length > 0 && (
        <div className="problems" style={{ marginBottom: 12 }}>
          <b><IconWarn size={14} /> Check these walls:</b>
          <ul>
            {issues.map((i, n) => (
              <li key={n}>{i.check.message}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="table-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th>Wall</th>
              <th>Elevation</th>
              <th>Finish</th>
              <th>LB</th>
              <th>Length</th>
              <th>Height</th>
              <th>Frame limits</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => {
              const walls = data.walls.filter((w) => w.elevationId === g.id);
              return [
                <tr key={`h-${g.id}`} className="group-head">
                  <td colSpan={8}>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <span>
                        {g.name} {g.front && <span className="pill info">Front façade</span>} <span className="muted">({walls.length})</span>
                      </span>
                      <AddWalls elevationId={g.id} prefix={g.id ? 'E' : 'I'} locked={locked} />
                    </div>
                  </td>
                </tr>,
                <WallRows key={`r-${g.id}`} walls={walls} locked={locked} />,
              ];
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

