import { useState } from 'react';
import { FLOOR_LABELS } from '../content/types';
import { useSession } from '../store/session';
import { Modal } from './common';
import { openJob, type PendingOpen } from './fileActions';

/** Asks who is opening a review file: the checker (inputs locked) or the detailer (fix flags). */
export function OpenDialog({ pending, onClose }: { pending: PendingOpen; onClose: () => void }) {
  const { data } = pending.parsed;
  const reviewerName = useSession((s) => s.reviewerName);
  const startRound = useSession((s) => s.startRound);
  const last = data.review.rounds.at(-1);
  const defaultRound = !last ? 2 : last.signedOffAt ? Math.min(last.round + 1, 3) : last.round;
  const [role, setRole] = useState<'checker' | 'detailer'>('checker');
  const [name, setName] = useState(reviewerName || (last && !last.signedOffAt ? last.checker : ''));
  const [round, setRound] = useState(defaultRound);

  const open = () => {
    if (role === 'checker') {
      openJob(pending, 'checker', name.trim());
      startRound(round, name.trim());
    } else {
      openJob(pending, 'detailer');
    }
    onClose();
  };

  const openFlags = data.review.entries.filter((e) => e.kind === 'flag' && !e.resolved).length;

  return (
    <Modal
      title="Open a job in review"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={open} disabled={role === 'checker' && !name.trim()}>
            Open
          </button>
        </>
      }
    >
      <p>
        <b>
          {data.job.jobNo} · {FLOOR_LABELS[data.job.floor]}
        </b>{' '}
        was sent for review. {openFlags > 0 ? `It has ${openFlags} open flag(s).` : 'It has no open flags.'}
      </p>
      <div className="stack">
        <label className={`option${role === 'checker' ? ' selected' : ''}`}>
          <input type="radio" name="role" checked={role === 'checker'} onChange={() => setRole('checker')} />
          <span>
            <b>I am the checker</b>
            <br />
            <span className="muted">The detailer’s inputs are locked. You add flags, comments and photos, export a draft PDF, and sign off.</span>
          </span>
        </label>
        <label className={`option${role === 'detailer' ? ' selected' : ''}`}>
          <input type="radio" name="role" checked={role === 'detailer'} onChange={() => setRole('detailer')} />
          <span>
            <b>I am the detailer — fix flagged items</b>
            <br />
            <span className="muted">You can edit the checklist and reply to each flag. Then save and send it back to the checker.</span>
          </span>
        </label>
      </div>
      {role === 'checker' && (
        <div className="field-row">
          <div className="field">
            <label className="label" htmlFor="checker-name">
              Your name
            </label>
            <input id="checker-name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="field">
            <span className="label">This is the</span>
            <div className="seg" role="group" aria-label="Check round">
              {[2, 3].map((r) => (
                <button key={r} type="button" className={round === r ? 'on' : ''} onClick={() => setRound(r)}>
                  {r === 2 ? '2nd check' : '3rd check'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
