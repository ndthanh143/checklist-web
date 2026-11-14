import type { StageId } from '../content/types';
import { focusPointsFor } from '../lib/focus';
import { useSession } from '../store/session';
import { IconDone, IconFocus, IconNext, IconWarn } from './icons';

function open(stage: StageId, itemId?: string) {
  useSession.getState().setStage(stage);
  if (itemId) setTimeout(() => document.getElementById(`item-${itemId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
}

/**
 * #24 — the key things the checker compares with the plans, in one place.
 * The checker ticks each one "Verified"; the detailer sees the same list as a self-check.
 */
export function CheckerFocus() {
  const { content, data, role, setFocusCheck } = useSession();
  if (!data) return null;
  const points = focusPointsFor(data);
  const done = points.filter((p) => data.review.focusChecks[p.id]).length;
  const isChecker = role === 'checker';
  return (
    <section className="card card-pad focus-panel">
      <div className="panel-head">
        <h2>
          <IconFocus size={20} /> Checker focus
        </h2>
        <span className={`pill ${done === points.length ? 'ok' : 'warn'}`}>
          {done}/{points.length} verified
        </span>
      </div>
      <p className="hint" style={{ marginBottom: 10 }}>
        {isChecker
          ? 'Compare each point with the plans, window schedule and engineering. Tick “Verified” when it is right — add a flag on the item when it is not.'
          : 'What the checker looks at first. Check these yourself before sending the job for review.'}
      </p>
      <div className="focus-grid">
        {points.map((p) => {
          const info = p.info(content, data);
          const verified = data.review.focusChecks[p.id];
          return (
            <article key={p.id} className={`focus-card${verified ? ' verified' : ''}${info.warnings.length ? ' has-warn' : ''}`}>
              <header>
                <h3>{p.title}</h3>
                <button type="button" className="btn ghost small" onClick={() => open(p.stage, p.itemId)} title="Open where this was entered">
                  Open <IconNext size={14} />
                </button>
              </header>
              <ul>
                {info.lines.map((l, i) => (
                  <li key={i}>{l}</li>
                ))}
              </ul>
              {info.warnings.length > 0 && (
                <ul className="focus-warn">
                  {info.warnings.map((w, i) => (
                    <li key={i}>
                      <IconWarn size={13} /> {w}
                    </li>
                  ))}
                </ul>
              )}
              <footer>
                {isChecker ? (
                  <label className="check">
                    <input type="checkbox" checked={!!verified} onChange={(e) => setFocusCheck(p.id, e.target.checked)} />
                    <span>Verified</span>
                  </label>
                ) : verified ? (
                  <span className="ok-text">
                    <IconDone size={14} /> Verified by {verified.by}
                  </span>
                ) : (
                  <span className="muted">Not verified yet</span>
                )}
                {isChecker && verified && <span className="hint">by {verified.by}</span>}
              </footer>
            </article>
          );
        })}
      </div>
    </section>
  );
}
