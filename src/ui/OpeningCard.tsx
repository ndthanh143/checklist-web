import { useState } from 'react';
import { EXTERNAL_OPENING_TYPES, INTERNAL_OPENING_TYPES, OPENING_TYPES, type OpeningType } from '../content/types';
import { DETAILING_METHODS, LINTEL_MODES, type DetailingMethod, type Opening } from '../job/types';
import { num, pineLintelWarning, planToFrameDimension, type Check } from '../lib/calc';
import { LINTEL_MODE_LABELS, METHOD_INFO } from '../lib/openings';
import { getBuilder, itemState, openingCalc, usesFrontFacade } from '../lib/rules';
import { useSession } from '../store/session';
import { NumberInput, ZoomImage } from './common';
import { IconAdd, IconDelete, IconWarn } from './icons';

function CheckPill({ c }: { c: Check }) {
  return <span className={`pill ${c.level}`}>{c.message}</span>;
}

/** Opening types offered for a wall: internal-only types (#17) on internal walls, the rest on external walls. */
export function typesForWall(internal: boolean | null): OpeningType[] {
  if (internal === null) return [...OPENING_TYPES];
  return internal ? [...INTERNAL_OPENING_TYPES, 'other'] : [...EXTERNAL_OPENING_TYPES, 'other'];
}

const TRIMMER_OTHER = '__other';

function TrimmerSelect({ o, suggested, options, locked, onChange }: { o: Opening; suggested: string; options: string[]; locked: boolean; onChange: (v: string) => void }) {
  const custom = o.trimmer !== '' && !options.includes(o.trimmer);
  const [other, setOther] = useState(custom);
  const value = other || custom ? TRIMMER_OTHER : o.trimmer;
  return (
    <div className="field">
      <span className="label">Trimmer</span>
      <select
        className="select"
        aria-label={`Trimmer for ${o.label}`}
        value={value}
        disabled={locked}
        onChange={(e) => {
          const v = e.target.value;
          setOther(v === TRIMMER_OTHER);
          if (v !== TRIMMER_OTHER) onChange(v);
        }}
      >
        <option value="">{suggested ? `${suggested} (suggested)` : 'Suggested'}</option>
        {options
          .filter((t) => t !== suggested)
          .map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        <option value={TRIMMER_OTHER}>Other…</option>
      </select>
      {(other || custom) && (
        <input className="input" style={{ marginTop: 6 }} aria-label={`Other trimmer for ${o.label}`} placeholder="e.g. 90x30" value={o.trimmer} disabled={locked} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

function LintelInput({ o, which, locked, suggestion, set }: { o: Opening; which: 'hyne' | 'autobeam'; locked: boolean; suggestion: string | null; set: (p: Partial<Opening>) => void }) {
  const name = which === 'hyne' ? 'Hyne' : 'Autobeam';
  const timberKey = which === 'hyne' ? 'hyneTimber' : 'autobeamTimber';
  const deflKey = which === 'hyne' ? 'hyneDeflection' : 'autobeamDeflection';
  return (
    <>
      <div className="field">
        <span className="label">{name} lintel</span>
        <input className="input" aria-label={`${o.label} ${name} lintel`} placeholder={which === 'hyne' ? 'e.g. 190x45 MGP10' : ''} value={o[timberKey]} disabled={locked} onChange={(e) => set({ [timberKey]: e.target.value })} />
        {suggestion && !locked && (
          <div className="suggest">
            Use 2 ply: <b>{suggestion}</b>
            <button type="button" className="btn small" onClick={() => set({ [timberKey]: suggestion })}>
              Use this
            </button>
          </div>
        )}
      </div>
      <div className="field">
        <span className="label">{name} deflection</span>
        <NumberInput value={o[deflKey]} onChange={(v) => set({ [deflKey]: v })} unit="mm" disabled={locked} ariaLabel={`${o.label} ${name} deflection`} />
      </div>
    </>
  );
}

export function OpeningCard({ o, locked }: { o: Opening; locked: boolean }) {
  const { data, content, updateOpening, removeOpening } = useSession();
  if (!data) return null;
  const set = (patch: Partial<Opening>) => updateOpening(o.id, patch);
  const calc = openingCalc(content, data, o);
  const wall = data.walls.find((w) => w.id === o.wallId);
  const internal = wall ? wall.elevationId === null : null;
  const builder = getBuilder(content, data.job.builderId);
  const cornerGap = builder?.internalDoorCornerGap ?? 70;
  const head = itemState(data, 'op-head-height').values;
  const headSuggest = (INTERNAL_OPENING_TYPES.includes(o.type) ? head.internal : head.whh) as string | undefined;
  const dim = num(o.dimension);
  const frameDim = o.position === 'dimension' && dim !== null && wall ? planToFrameDimension(dim, wall.finish) : null;
  const pine = [pineLintelWarning(o.hyneTimber), pineLintelWarning(o.autobeamTimber)].find(Boolean);
  const showLintel = calc.lintelNeeded || !!o.hyneTimber || !!o.autobeamTimber;
  const types = typesForWall(internal);
  const f = calc.framing;
  const lintelModes = LINTEL_MODES.filter((m) => m !== 'none' || internal === false);
  const showLintelMode = f !== null && f.case !== 'internal-no-lintel';
  const ashmontOption = usesFrontFacade(content, data) && internal === false;
  const toggleMethod = (m: DetailingMethod, on: boolean) => set({ methods: on ? [...o.methods.filter((x) => x !== m), m] : o.methods.filter((x) => x !== m), ...(m === 'trimmer-plus' && !on ? { trimmerPlus: '' } : {}) });

  return (
    <div className={`opening-card${o.underGirder ? ' girder' : ''}`}>
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
              <option key={w.id} value={w.id}>
                {w.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ gridColumn: 'span 2' }}>
          <span className="label">Type</span>
          <select className="select" aria-label={`Type of ${o.label}`} value={o.type} disabled={locked} onChange={(e) => set({ type: e.target.value as Opening['type'] })}>
            {types.map((t) => (
              <option key={t} value={t}>
                {content.allowances[t].label}
              </option>
            ))}
            {!types.includes(o.type) && <option value={o.type}>{content.allowances[o.type].label} (not for this wall)</option>}
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
              <button className="btn small" onClick={() => set({ headHeight: headSuggest })}>
                Use this
              </button>
            </div>
          )}
        </div>
        <div className="field" style={{ gridColumn: 'span 2' }}>
          <span className="label">Position</span>
          <select className="select" aria-label={`Position of ${o.label}`} value={o.position} disabled={locked} onChange={(e) => set({ position: e.target.value as Opening['position'] })}>
            <option value="middle">Middle of wall</option>
            <option value="dimension">From plan dimension</option>
            {(internal !== false || o.position === 'corner90' || o.position === 'corner70') && (
              <>
                <option value="corner90">90 mm from corner{cornerGap === 90 ? ` (${builder?.shortName ?? 'builder'} standard)` : ''}</option>
                <option value="corner70">70 mm from corner{cornerGap === 70 ? ' (standard)' : ''}</option>
              </>
            )}
          </select>
        </div>
        {o.position === 'dimension' && (
          <div className="field">
            <span className="label">Plan dimension</span>
            <NumberInput value={o.dimension} onChange={(v) => set({ dimension: v })} unit="mm" disabled={locked} ariaLabel={`${o.label} plan dimension`} />
          </div>
        )}
        {o.position !== 'middle' && (
          <div className="field">
            <span className="label">{o.position === 'dimension' ? 'Side' : 'Corner side'}</span>
            <div className="seg" role="group" aria-label={`Side of ${o.label}`}>
              {(['left', 'right'] as const).map((s) => (
                <button key={s} type="button" className={o.side === s ? 'on' : ''} disabled={locked} onClick={() => set({ side: s })}>
                  {s === 'left' ? 'Left' : 'Right'}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="opening-flags">
        <label className={`check chip${o.underGirder ? ' on' : ''}`}>
          <input type="checkbox" checked={o.underGirder} disabled={locked} onChange={(e) => set({ underGirder: e.target.checked })} />
          <span>Under girder</span>
        </label>
        {ashmontOption && (
          <label className={`check chip${calc.frontBrickVeneer ? ' on' : ''}`} title="Ashmont: +130 width, floating studs included in frame, note “+ infill”">
            <input type="checkbox" checked={calc.frontBrickVeneer} disabled={locked} onChange={(e) => set({ frontBrickVeneer: e.target.checked })} />
            <span>Front elevation brick veneer</span>
          </label>
        )}
      </div>
      {o.underGirder && (
        <div className="girder-box">
          <p>
            <b>Opening under a girder</b> — this wall carries the girder load, so it needs a critical stud designed in Autobeam. Enter the size and deflection from Autobeam.
          </p>
          <div className="opening-grid">
            <div className="field" style={{ gridColumn: 'span 2' }}>
              <span className="label">
                Critical stud size (Autobeam)<span className="block-text"> *</span>
              </span>
              <input className="input" aria-label={`${o.label} critical stud size`} placeholder="e.g. 3/90x35 MGP10" value={o.criticalStud} disabled={locked} onChange={(e) => set({ criticalStud: e.target.value })} />
            </div>
            <div className="field">
              <span className="label">
                Deflection<span className="block-text"> *</span>
              </span>
              <NumberInput value={o.criticalDeflection} onChange={(v) => set({ criticalDeflection: v })} unit="mm" disabled={locked} ariaLabel={`${o.label} critical stud deflection`} />
            </div>
          </div>
        </div>
      )}
      {calc.frontBrickVeneer && <div className="hint">Front elevation brick veneer: width +130 (60 clearance + 70 floating studs). Floating studs included in frame — add note “+ infill”.</div>}

      <div className="framing-box">
        <div className="framing-head">
          <b>Framing</b>
          {f ? <span className="hint">{f.reason}</span> : <span className="hint">{wall ? 'Enter the schedule size to see the suggested framing.' : 'Choose the wall to see the suggested framing.'}</span>}
        </div>
        <div className="opening-grid">
          {showLintelMode && (
            <div className="field" style={{ gridColumn: 'span 2' }}>
              <span className="label">Lintel</span>
              <select className="select" aria-label={`Lintel for ${o.label}`} value={o.lintelMode} disabled={locked} onChange={(e) => set({ lintelMode: e.target.value as Opening['lintelMode'] })}>
                {lintelModes.map((m) => (
                  <option key={m} value={m}>
                    {LINTEL_MODE_LABELS[m]}
                  </option>
                ))}
              </select>
            </div>
          )}
          {f && <TrimmerSelect o={o} suggested={f.trimmer} options={content.openingFraming.trimmerOptions} locked={locked} onChange={(v) => set({ trimmer: v })} />}
          {f && (
            <div className="field framing-studs" style={{ gridColumn: 'span 2' }}>
              <span className="label">Studs (suggested)</span>
              <span>
                Jamb: <b>{f.jamb}</b> each side
                {f.jambCorner ? (
                  <>
                    {' '}
                    · corner side{o.side ? ` (${o.side})` : ''}: <b>{f.jambCorner}</b>
                  </>
                ) : null}
                {' · '}Prop: {f.prop ? <b>{f.prop}</b> : <b>none</b>}
                {f.lintel === 'none' && <> · Lintel: <b>none</b></>}
                {f.lintel === 'floor-system' && <> · Lintel: <b>floor system</b></>}
              </span>
            </div>
          )}
        </div>
        {showLintel && (
          <div className="opening-grid" style={{ marginTop: 10 }}>
            <LintelInput o={o} which="hyne" locked={locked} suggestion={calc.doubleLintel.hyne} set={set} />
            <LintelInput o={o} which="autobeam" locked={locked} suggestion={calc.doubleLintel.autobeam} set={set} />
          </div>
        )}
        <div className="field" style={{ marginTop: 10 }}>
          <span className="label">Detailing method (choose all that apply)</span>
          <div className="opening-flags" style={{ marginTop: 0 }}>
            {DETAILING_METHODS.map((m) => (
              <label key={m} className={`check chip${o.methods.includes(m) ? ' on' : ''}`}>
                <input type="checkbox" checked={o.methods.includes(m)} disabled={locked} onChange={(e) => toggleMethod(m, e.target.checked)} />
                <span>{METHOD_INFO[m].label}</span>
              </label>
            ))}
            {o.methods.includes('trimmer-plus') && (
              <div className="seg" role="group" aria-label={`Trimmer offset for ${o.label}`}>
                {(['+30', '+25', '+20'] as const).map((p) => (
                  <button key={p} type="button" className={o.trimmerPlus === p ? 'on' : ''} disabled={locked} onClick={() => set({ trimmerPlus: p })}>
                    {p}
                  </button>
                ))}
              </div>
            )}
          </div>
          {o.methods.length > 0 && (
            <ul className="method-reminders">
              {o.methods.map((m) => (
                <li key={m}>
                  <IconWarn size={13} /> {m === 'trimmer-plus' && o.trimmerPlus ? `${o.trimmerPlus} trimmer.` : METHOD_INFO[m].reminder}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

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
        {calc.trimmer && <span className="hint">Trimmer: {calc.trimmer}</span>}
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
  const front = usesFrontFacade(content, data);
  const groups = [
    ...data.elevations.map((e) => ({ key: e.id, name: e.name, walls: data.walls.filter((w) => w.elevationId === e.id), internal: false, front: front && e.frontFacade })),
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
      <details className="framing-guide">
        <summary>How an opening is framed (lintel, trimmer, jamb and prop studs)</summary>
        <ZoomImage src="/illustrations/opening-framing.svg" alt="Opening framing: ribbon plate, top plate, lintel, overs, trimmer, jamb stud, prop stud, sill, unders, nogging, bottom plate" />
      </details>
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
              <div className="row">
                {g.internal && (
                  <button className="btn small" disabled={locked || g.walls.length === 0} onClick={() => addOpening(nextLabel(true), g.walls[0]?.id ?? null, true, 'cabinet')}>
                    <IconAdd size={15} /> Add cabinet opening
                  </button>
                )}
                <button className="btn small" disabled={locked || g.walls.length === 0} onClick={() => addOpening(nextLabel(g.internal), g.walls[0]?.id ?? null, g.internal)}>
                  <IconAdd size={15} /> Add opening
                </button>
              </div>
            </div>
            {list.map((o) => (
              <OpeningCard key={o.id} o={o} locked={locked} />
            ))}
          </div>
        );
      })}
      {unassigned.length > 0 && (
        <div className="card card-pad">
          <h3 className="warn-text" style={{ marginBottom: 8 }}>
            Openings without a wall
          </h3>
          {unassigned.map((o) => (
            <OpeningCard key={o.id} o={o} locked={locked} />
          ))}
        </div>
      )}
    </section>
  );
}
