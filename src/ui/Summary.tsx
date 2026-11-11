import { FLOOR_LABELS, type StageId } from '../content/types';
import { STATUS_LABELS } from '../job/types';
import { finalGate, jobSummary, type SummaryRow } from '../lib/rules';
import { useSession } from '../store/session';
import { exportPdf, saveJob } from './fileActions';
import { IconChecklist, IconFlag, IconLock, IconPdf, IconSave, IconSend, IconSignOff, IconWarn } from './icons';
import { STATUS_ICON } from './ItemCard';
import { ReviewEntries } from './ReviewEntries';

function goToItem(stage: StageId, itemId: string) {
  useSession.getState().setStage(stage);
  setTimeout(() => document.getElementById(`item-${itemId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
}

function ByStage({ rows }: { rows: SummaryRow[] }) {
  const { content } = useSession();
  if (rows.length === 0) return <p className="muted">None.</p>;
  return (
    <>
      {content.stages.map((s, i) => {
        const list = rows.filter((r) => r.item.stage === s.id);
        if (list.length === 0) return null;
        return (
          <details key={s.id} open={list.length <= 4} style={{ marginTop: 8 }}>
            <summary style={{ cursor: 'pointer', fontWeight: 700 }}>
              {i + 1}. {s.title} <span className="muted">({list.length})</span>
            </summary>
            <Rows rows={list} />
          </details>
        );
      })}
    </>
  );
}

function Rows({ rows, showNote }: { rows: SummaryRow[]; showNote?: boolean }) {
  const { content } = useSession();
  if (rows.length === 0) return <p className="muted">None.</p>;
  return (
    <ul className="list">
      {rows.map(({ item, state, problems }) => {
        const Icon = STATUS_ICON[state.status];
        const stageNo = content.stages.findIndex((s) => s.id === item.stage) + 1;
        return (
          <li key={item.id}>
            <Icon size={18} style={{ flex: 'none', marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <button className="link-btn" onClick={() => goToItem(item.stage, item.id)}>
                {item.title}
              </button>{' '}
              <span className="muted">
                — stage {stageNo} · {STATUS_LABELS[state.status]}
              </span>
              {showNote && state.note && <div style={{ whiteSpace: 'pre-wrap' }}>{state.note}</div>}
              {problems.length > 0 && <div className="warn-text">{problems.join(' · ')}</div>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function Summary() {
  const { content, data, role, sendForReview, signOff, setRequiredChecks, reviewerName } = useSession();
  if (!data) return null;
  const s = jobSummary(content, data);
  const gate = finalGate(content, data);
  const lastRound = data.review.rounds.at(-1);
  const canSignOff = role === 'checker' && !!lastRound && !lastRound.signedOffAt && s.openFlags === 0;

  const onSendForReview = async () => {
    const msg =
      s.incomplete.length > 0
        ? `${s.incomplete.length} item(s) are not Done or N/A yet. Send for review anyway?\n\nA new file will be saved for the checker.`
        : 'Send this checklist for review?\n\nA new file will be saved for the checker. Your inputs will be locked for them.';
    if (!window.confirm(msg)) return;
    sendForReview();
    await saveJob({ saveAs: true });
  };

  const onSignOff = async () => {
    if (!lastRound) return;
    if (!window.confirm(`Sign off the ${lastRound.round === 3 ? '3rd' : '2nd'} check as ${lastRound.checker || reviewerName}?`)) return;
    signOff();
    await saveJob();
  };

  return (
    <main className="page">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>
          Summary — {data.job.jobNo || 'New job'} · {FLOOR_LABELS[data.job.floor]}
        </h1>
        <button className="btn" onClick={() => useSession.getState().go('workspace')}>
          <IconChecklist size={18} /> Back to the checklist
        </button>
      </div>
      <div className="stats">
        <div className="stat ok">
          <div className="n">
            {s.complete}/{s.total}
          </div>
          <div className="l">Done or N/A</div>
        </div>
        <div className={`stat ${s.confirm.length ? 'warn' : ''}`}>
          <div className="n">{s.confirm.length}</div>
          <div className="l">Needs confirmation</div>
        </div>
        <div className={`stat ${s.blocked.length ? 'block' : ''}`}>
          <div className="n">{s.blocked.length}</div>
          <div className="l">Blocked</div>
        </div>
        <div className={`stat ${s.withProblems.length ? 'warn' : ''}`}>
          <div className="n">{s.withProblems.length}</div>
          <div className="l">Done but incomplete</div>
        </div>
        <div className={`stat ${s.openFlags ? 'block' : ''}`}>
          <div className="n">{s.openFlags}</div>
          <div className="l">Open review flags</div>
        </div>
      </div>

      <div className="summary-grid">
        <div className="stack">
          <section className="card card-pad">
            <h2>Not finished ({s.incomplete.length})</h2>
            <p className="hint" style={{ marginBottom: 6 }}>Every item must be Done or N/A before the final PDF. Click a stage to open it.</p>
            <ByStage rows={s.incomplete} />
          </section>
          {s.withProblems.length > 0 && (
            <section className="card card-pad">
              <h2 className="warn-text">Marked Done but incomplete ({s.withProblems.length})</h2>
              <Rows rows={s.withProblems} />
            </section>
          )}
          {(s.wallIssues.length > 0 || s.openingIssues.length > 0) && (
            <section className="card card-pad">
              <h2>Wall and opening checks</h2>
              <ul className="issue-list">
                {s.wallIssues.map((w, i) => (
                  <li key={`w${i}`} className={w.check.level === 'block' ? 'block-text' : 'warn-text'}>
                    {w.check.message}
                  </li>
                ))}
                {s.openingIssues.flatMap(({ opening, checks }) =>
                  checks.map((c, i) => (
                    <li key={`${opening.id}${i}`} className={c.level === 'block' ? 'block-text' : 'warn-text'}>
                      {opening.label || 'Opening'}: {c.message}
                    </li>
                  )),
                )}
              </ul>
            </section>
          )}
          <section className="card card-pad">
            <h2>All notes ({s.notes.length})</h2>
            <p className="hint" style={{ marginBottom: 6 }}>Every note from the checklist in one place, to review before submitting.</p>
            <Rows rows={s.notes} showNote />
          </section>
          <section className="card card-pad">
            <h2>General review comments</h2>
            <p className="hint" style={{ marginBottom: 8 }}>Comments about the whole job (not one item).</p>
            <ReviewEntries itemId={null} />
            {data.stage !== 'review' && <p className="muted">Available once the checklist is sent for review.</p>}
          </section>
        </div>

        <aside className="card card-pad export-card">
          <h2>Save and export</h2>

          <div className="export-step">
            <h4>
              <IconSave size={18} /> 1. Work in progress
            </h4>
            <p>Save the .chck file to keep your work. Open it again any time to continue.</p>
            <div className="row">
              <button className="btn primary" onClick={() => saveJob()}>
                <IconSave size={16} /> Save
              </button>
              <button className="btn" onClick={() => saveJob({ saveAs: true })}>
                Save as…
              </button>
            </div>
          </div>

          <div className="export-step">
            <h4>
              <IconFlag size={18} /> 2. Review (2nd / 3rd check)
            </h4>
            {data.stage === 'in-progress' && role === 'detailer' && (
              <>
                <p>When the checklist is done, send it to the checker. They can add flags and photos but cannot change your inputs.</p>
                <button className="btn primary" onClick={onSendForReview}>
                  <IconSend size={16} /> Send for review
                </button>
              </>
            )}
            {data.stage === 'review' && role === 'detailer' && (
              <>
                <p>
                  Fix each open flag and write a reply. Then save and send the file back to the checker.{' '}
                  {s.openFlags > 0 && <b className="block-text">{s.openFlags} open flag(s).</b>}
                </p>
                <button className="btn primary" onClick={() => saveJob()}>
                  <IconSave size={16} /> Save for the checker
                </button>
              </>
            )}
            {role === 'checker' && (
              <>
                <p>
                  <IconLock size={14} /> The detailer’s inputs are locked. Add flags and comments on items, then sign off when there are no open flags.
                </p>
                <div className="field">
                  <span className="label">Checks required before the final PDF</span>
                  <div className="seg" role="group" aria-label="Checks required">
                    <button className={data.review.requiredChecks === 1 ? 'on' : ''} onClick={() => setRequiredChecks(1)}>
                      2nd check
                    </button>
                    <button className={data.review.requiredChecks === 2 ? 'on' : ''} onClick={() => setRequiredChecks(2)}>
                      2nd + 3rd check
                    </button>
                  </div>
                </div>
                <button className="btn primary" disabled={!canSignOff} onClick={onSignOff}>
                  <IconSignOff size={16} /> Sign off {lastRound ? (lastRound.round === 3 ? '3rd' : '2nd') : ''} check
                </button>
                {role === 'checker' && s.openFlags > 0 && <span className="hint">Resolve all open flags before signing off.</span>}
              </>
            )}
            {data.review.rounds.length > 0 && (
              <ul className="list" style={{ marginTop: 6 }}>
                {data.review.rounds.map((r) => (
                  <li key={r.round}>
                    <b>{r.round === 3 ? '3rd' : '2nd'} check</b> — {r.checker || '—'} ·{' '}
                    {r.signedOffAt ? <span className="ok-text">Signed off {new Date(r.signedOffAt).toLocaleDateString('en-AU')}</span> : <span className="warn-text">Not signed off</span>}
                  </li>
                ))}
              </ul>
            )}
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn" onClick={() => exportPdf('draft')}>
                <IconPdf size={16} /> Draft PDF
              </button>
              <span className="hint">Watermarked “DRAFT”, with a blank column for handwritten notes.</span>
            </div>
          </div>

          <div className="export-step">
            <h4>
              <IconPdf size={18} /> 3. Final report for the client
            </h4>
            <p>Available after the checklist passes review and is signed off.</p>
            <button className="btn primary" disabled={!gate.ready} onClick={() => exportPdf('final')}>
              <IconPdf size={16} /> Final PDF
            </button>
            {!gate.ready && (
              <ul className="issue-list">
                {gate.reasons.map((r) => (
                  <li key={r} className="warn-text">
                    <IconWarn size={13} /> {r}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
