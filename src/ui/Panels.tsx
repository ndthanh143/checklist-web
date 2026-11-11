import { useState } from 'react';
import { CONDITION_KEYS, CONDITION_LABELS, FLOOR_KINDS, FLOOR_LABELS, HOUSE_TYPES, HOUSE_TYPE_LABELS, OPENING_TYPES } from '../content/types';
import { ELEVATION_NAMING, nameFor } from '../job/factory';
import type { Opening, Wall, WallFinish } from '../job/types';
import { addressWarnings, checkFrameHeight, checkFrameLength, num, pineLintelWarning, planToFrameDimension, trimmerRule, type Check } from '../lib/calc';
import { getBuilder, itemState, openingCalc, wallIssues } from '../lib/rules';
import { useSession } from '../store/session';
import { NumberInput, YesNo } from './common';
import { IconAdd, IconDelete, IconWarn } from './icons';

function CheckPill({ c }: { c: Check }) {
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
  const { data, role, addElevation, updateElevation, removeElevation } = useSession();
  if (!data) return null;
  const locked = role !== 'detailer';
  const els = data.elevations;
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
              <th style={{ width: 150 }}>Front façade (street)</th>
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
                <td>
                  <label className="check">
                    <input type="radio" name="front" checked={e.frontFacade} disabled={locked} onChange={() => updateElevation(e.id, { frontFacade: true })} />
                    <span>{e.frontFacade ? 'Front façade' : 'Set as front'}</span>
                  </label>
                </td>
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
        {!els.some((e) => e.frontFacade) && <span className="warn-text"><IconWarn size={14} /> No front façade set yet</span>}
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

function AddWalls({ elevationId, prefix, locked }: { elevationId: string | null; prefix: string; locked: boolean }) {
  const { addWall } = useSession();
  const [text, setText] = useState('');
  const add = () => {
    for (const l of parseLabels(text)) addWall(l, elevationId);
    setText('');
  };
  return (
    <div className="row">
      <input
        className="input"
        style={{ width: 220 }}
        aria-label="Wall labels to add"
        placeholder={`e.g. ${prefix}1-${prefix}4, ${prefix}7`}
        value={text}
        disabled={locked}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && text.trim() && add()}
      />
      <button className="btn small" disabled={locked || !text.trim()} onClick={add}>
        <IconAdd size={15} /> Add walls
      </button>
    </div>
  );
}

export function WallsPanel() {
  const { data, role } = useSession();
  if (!data) return null;
  const locked = role !== 'detailer';
  const issues = wallIssues(data.walls).filter((i) => i.kind === 'label' || i.kind === 'placement');
  const groups = [...data.elevations.map((e) => ({ id: e.id as string | null, name: e.name, front: e.frontFacade })), { id: null, name: 'Internal', front: false }];
  return (
    <section className="panel">
      <div className="panel-head">
        <h3>Wall panels by elevation ({data.walls.length})</h3>
        <span className="hint">Type labels like “E1-E8” to add several at once. LB = load-bearing.</span>
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

// ─── Stage 6: openings ───

function OpeningCard({ o, locked }: { o: Opening; locked: boolean }) {
  const { data, content, updateOpening, removeOpening } = useSession();
  if (!data) return null;
  const set = (patch: Partial<Opening>) => updateOpening(o.id, patch);
  const calc = openingCalc(content, data, o);
  const wall = data.walls.find((w) => w.id === o.wallId);
  const head = itemState(data, 'op-head-height').values;
  const headSuggest = (o.type === 'internal-door' || o.type === 'cavity-slider' || o.type === 'smart-robe' ? head.internal : head.whh) as string | undefined;
  const dim = num(o.dimension);
  const frameDim = o.position === 'dimension' && dim !== null && wall ? planToFrameDimension(dim, wall.finish) : null;
  const pine = [pineLintelWarning(o.hyneTimber), pineLintelWarning(o.autobeamTimber)].find(Boolean);
  const showLintel = calc.lintelNeeded || o.hyneTimber || o.autobeamTimber;
  const width = calc.stud?.width ?? 0;

  return (
    <div className="opening-card">
      <div className="opening-grid">
        <div className="field">
          <span className="label">Label</span>
          <input className="input" aria-label="Opening label" value={o.label} disabled={locked} onChange={(e) => set({ label: e.target.value.toUpperCase() })} />
        </div>
        <div className="field">
          <span className="label">Wall</span>
          <select className="select" aria-label={`Wall for ${o.label}`} value={o.wallId ?? ''} disabled={locked} onChange={(e) => set({ wallId: e.target.value || null })}>
            <option value="">Choose…</option>
            {data.walls.map((w) => (
              <option key={w.id} value={w.id}>{w.label}</option>
            ))}
          </select>
        </div>
        <div className="field" style={{ gridColumn: 'span 2' }}>
          <span className="label">Type</span>
          <select className="select" aria-label={`Type of ${o.label}`} value={o.type} disabled={locked} onChange={(e) => set({ type: e.target.value as Opening['type'] })}>
            {OPENING_TYPES.map((t) => (
              <option key={t} value={t}>{content.allowances[t].label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <span className="label">Schedule height</span>
          <NumberInput value={o.scheduleH} onChange={(v) => set({ scheduleH: v })} unit="mm" disabled={locked} ariaLabel={`${o.label} schedule height`} />
        </div>
        <div className="field">
          <span className="label">Schedule width</span>
          <NumberInput value={o.scheduleW} onChange={(v) => set({ scheduleW: v })} unit="mm" disabled={locked} ariaLabel={`${o.label} schedule width`} />
        </div>
        <div className="field">
          <span className="label">Head height</span>
          <NumberInput value={o.headHeight} onChange={(v) => set({ headHeight: v })} unit="mm" disabled={locked} ariaLabel={`${o.label} head height`} />
          {headSuggest && headSuggest !== o.headHeight && !locked && (
            <div className="suggest">
              Standard: <b>{headSuggest}</b>
              <button className="btn small" onClick={() => set({ headHeight: headSuggest })}>Use this</button>
            </div>
          )}
        </div>
        <div className="field">
          <span className="label">Position</span>
          <select className="select" aria-label={`Position of ${o.label}`} value={o.position} disabled={locked} onChange={(e) => set({ position: e.target.value as Opening['position'] })}>
            <option value="middle">Middle of wall</option>
            <option value="dimension">From plan dimension</option>
          </select>
        </div>
        {o.position === 'dimension' && (
          <>
            <div className="field">
              <span className="label">Plan dimension</span>
              <NumberInput value={o.dimension} onChange={(v) => set({ dimension: v })} unit="mm" disabled={locked} ariaLabel={`${o.label} plan dimension`} />
            </div>
            <div className="field">
              <span className="label">Side</span>
              <div className="seg" role="group" aria-label={`Side of ${o.label}`}>
                {(['left', 'right'] as const).map((s) => (
                  <button key={s} type="button" className={o.side === s ? 'on' : ''} disabled={locked} onClick={() => set({ side: s })}>
                    {s === 'left' ? 'Left' : 'Right'}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
      {showLintel && (
        <div className="opening-grid mt" style={{ marginTop: 10 }}>
          <div className="field">
            <span className="label">Hyne lintel</span>
            <input className="input" aria-label={`${o.label} Hyne lintel`} placeholder="e.g. 190x45 MGP10" value={o.hyneTimber} disabled={locked} onChange={(e) => set({ hyneTimber: e.target.value })} />
          </div>
          <div className="field">
            <span className="label">Hyne deflection</span>
            <NumberInput value={o.hyneDeflection} onChange={(v) => set({ hyneDeflection: v })} unit="mm" disabled={locked} ariaLabel={`${o.label} Hyne deflection`} />
          </div>
          <div className="field">
            <span className="label">Autobeam lintel</span>
            <input className="input" aria-label={`${o.label} Autobeam lintel`} value={o.autobeamTimber} disabled={locked} onChange={(e) => set({ autobeamTimber: e.target.value })} />
          </div>
          <div className="field">
            <span className="label">Autobeam deflection</span>
            <NumberInput value={o.autobeamDeflection} onChange={(v) => set({ autobeamDeflection: v })} unit="mm" disabled={locked} ariaLabel={`${o.label} Autobeam deflection`} />
          </div>
        </div>
      )}
      <div className="field mt" style={{ marginTop: 10 }}>
        <input className="input" aria-label={`${o.label} note`} placeholder="Note (optional)" value={o.note} disabled={locked} onChange={(e) => set({ note: e.target.value })} />
      </div>
      <div className="opening-out">
        <span>
          Stud opening:{' '}
          {calc.stud ? (
            <b className="ok-text" style={{ color: 'var(--mitek-blue)' }}>
              {calc.stud.height} H × {calc.stud.width} W
            </b>
          ) : (
            <span className="muted">enter the schedule size</span>
          )}
        </span>
        {calc.stud && <span className="hint">{calc.stud.reasons.join(' · ')}</span>}
        {calc.stud && wall && !wall.loadBearing && <span className="hint">Trimmer: {trimmerRule(width, false)}</span>}
        {calc.stud && wall?.loadBearing && <span className="hint">Load-bearing wall — lintel by Hyne / Autobeam</span>}
        {frameDim && (
          <span>
            Frame dimension: <b>{frameDim.min === frameDim.max ? frameDim.min : `${frameDim.min}–${frameDim.max}`} mm</b> {o.side && `(${o.side})`}
          </span>
        )}
        {calc.deflection.map((c, i) => (
          <CheckPill key={`d${i}`} c={c} />
        ))}
        {pine && <CheckPill c={{ level: 'warn', message: pine }} />}
        {calc.issues.map((c, i) => (
          <CheckPill key={`i${i}`} c={c} />
        ))}
        <span style={{ flex: 1 }} />
        <button className="btn ghost small danger" disabled={locked} onClick={() => window.confirm(`Delete opening ${o.label}?`) && removeOpening(o.id)}>
          <IconDelete size={15} /> Delete
        </button>
      </div>
    </div>
  );
}

export function OpeningsPanel() {
  const { data, content, role, addOpening } = useSession();
  if (!data) return null;
  const locked = role !== 'detailer';
  const builder = getBuilder(content, data.job.builderId);
  const groups = [
    ...data.elevations.map((e) => ({ key: e.id, name: e.name, walls: data.walls.filter((w) => w.elevationId === e.id), internal: false, front: e.frontFacade })),
    { key: 'internal', name: 'Internal', walls: data.walls.filter((w) => w.elevationId === null), internal: true, front: false },
  ];
  const unassigned = data.openings.filter((o) => !data.walls.some((w) => w.id === o.wallId));
  const nextLabel = (internal: boolean) => {
    const prefix = internal ? 'D' : 'W';
    const nums = data.openings.map((o) => new RegExp(`^${prefix}(\\d+)$`).exec(o.label)?.[1]).filter(Boolean).map(Number);
    return `${prefix}${nums.length ? Math.max(...nums) + 1 : 1}`;
  };
  return (
    <section className="panel">
      <div className="panel-head">
        <h3>Openings by elevation ({data.openings.length})</h3>
        <span className="hint">Stud openings use the standard allowances{builder?.openingOverrides.length ? ` and ${builder.shortName} overrides` : ''}.</span>
      </div>
      {data.walls.length === 0 && (
        <div className="problems" style={{ marginBottom: 12 }}>
          <IconWarn size={14} /> Add wall panels in “Wall Panels per Elevation” first — each opening belongs to a wall.
        </div>
      )}
      {groups.map((g) => {
        const list = data.openings.filter((o) => g.walls.some((w) => w.id === o.wallId));
        return (
          <div key={g.key} className="card card-pad" style={{ marginBottom: 12 }}>
            <div className="panel-head">
              <h3>
                {g.name} {g.front && <span className="pill info">Front façade</span>}{' '}
                <span className="muted" style={{ fontWeight: 400, fontSize: 14 }}>
                  Walls: {g.walls.map((w) => w.label).join(', ') || '—'} · Openings: {list.map((o) => o.label).join(', ') || '—'}
                </span>
              </h3>
              <button className="btn small" disabled={locked || g.walls.length === 0} onClick={() => addOpening(nextLabel(g.internal), g.walls[0]?.id ?? null, g.internal)}>
                <IconAdd size={15} /> Add opening
              </button>
            </div>
            {list.map((o) => (
              <OpeningCard key={o.id} o={o} locked={locked} />
            ))}
          </div>
        );
      })}
      {unassigned.length > 0 && (
        <div className="card card-pad">
          <h3 className="warn-text" style={{ marginBottom: 8 }}>Openings without a wall</h3>
          {unassigned.map((o) => (
            <OpeningCard key={o.id} o={o} locked={locked} />
          ))}
        </div>
      )}
    </section>
  );
}
