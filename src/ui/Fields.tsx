import type { ChecklistItem, FieldDef } from '../content/types';
import { FLOOR_LABELS } from '../content/types';
import type { FieldValue, ItemState } from '../job/types';
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
import { getBuilder, isSplitLevel, itemState, suggestionFor } from '../lib/rules';
import { useSession } from '../store/session';
import { NumberInput } from './common';

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

export function FieldInput({ item, field, state, locked }: { item: ChecklistItem; field: FieldDef; state: ItemState; locked: boolean }) {
  const { data, content, setValue } = useSession();
  const builder = data ? getBuilder(content, data.job.builderId) : undefined;
  const value = state.values[field.id];
  const str = typeof value === 'string' ? value : '';
  const set = (v: FieldValue) => setValue(item.id, field.id, v);
  const suggestion = data ? suggestionFor(field.suggest, builder, data.job) : null;
  const inputId = `${item.id}-${field.id}`;
  const suggestLabel = field.suggest?.startsWith('builder.') ? `Suggested for ${builder?.shortName ?? 'builder'}` : 'Suggested';

  if (field.kind === 'checks') {
    const ticked = Array.isArray(value) ? value : [];
    return (
      <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="label">
          {field.label}
          {field.requireAll ? <span className="hint"> — tick every one</span> : null}
        </legend>
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
      <label className="label" htmlFor={inputId}>
        {field.label}
        {field.required ? <span className="block-text"> *</span> : null}
      </label>
      {control}
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
      const s = nogSuggestion(h);
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
      const d = num(v('depth'));
      const split = isSplitLevel(data.job);
      if (h === null || d === null) return <div className="calc-box">Enter the external wall height (Job Setup) and the step-down depth to calculate the frame height.</div>;
      return (
        <div className="calc-box">
          {split ? (
            <>
              Split-level house: frame height stays <span className="result">{h} mm</span>. Adjust the elevation offset by {d} mm so the panel drops to the lower level.
            </>
          ) : (
            <>
              Standard house: frame height = {h} + {d} = <span className="result">{stepDownFrameHeight(h, d, false)} mm</span>
            </>
          )}
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
