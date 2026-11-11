import { FLOOR_LABELS } from '../content/types';
import { getBuilder } from '../lib/rules';
import { useSession } from '../store/session';
import { timeAgo, useTick } from './common';
import { exportPdf, saveJob } from './fileActions';
import { IconChecklist, IconGuide, IconLogout, IconPdf, IconSave, IconSummary, IconWarn, IconDone } from './icons';

function SaveState() {
  useTick(20_000);
  const { dirty, dirtySince, lastSavedAt } = useSession();
  if (!dirty && lastSavedAt) {
    return (
      <span className="save-state ok" title="All changes are saved in your file">
        <IconDone size={16} /> Saved {timeAgo(Date.now() - lastSavedAt)}
      </span>
    );
  }
  const mins = dirtySince ? (Date.now() - dirtySince) / 60000 : 0;
  const level = mins >= 20 ? 'block' : mins >= 10 ? 'warn' : 'ok';
  const text = lastSavedAt ? `Unsaved changes${mins >= 1 ? ` (${Math.floor(mins)} min)` : ''}` : 'Not saved yet';
  return (
    <span className={`save-state ${level === 'ok' ? 'warn' : level}`} title="Refreshing or closing the page will lose unsaved work">
      <IconWarn size={16} /> {text}
    </span>
  );
}

export function TopBar() {
  const { data, content, role, go, view, server } = useSession();
  const builder = data ? getBuilder(content, data.job.builderId) : undefined;
  return (
    <header className="topbar">
      <button className="brand" onClick={() => go('home')} aria-label="Home">
        <img className="lawmans" src="/logos/lawmans.png" alt="Lawmans Frame & Truss" />
        <span className="divider" />
        <img className="mitek" src="/logos/mitek.png" alt="MiTek" />
      </button>
      {data && (
        <div className="job-chip">
          <span className="title">
            {data.job.jobNo || 'New job'} · {FLOOR_LABELS[data.job.floor]}
          </span>
          <span className="sub">
            {builder?.name ?? '—'}
            {data.stage === 'review' ? ' · In review' : ''}
          </span>
        </div>
      )}
      {data && role === 'checker' && <span className="role-badge">Checker</span>}
      <div className="spacer" />
      <div className="actions">
        {data && <SaveState />}
        {data && view !== 'workspace' && (
          <button className="btn" onClick={() => go('workspace')}>
            <IconChecklist size={18} /> Checklist
          </button>
        )}
        {data && view !== 'summary' && (
          <button className="btn" onClick={() => go('summary')}>
            <IconSummary size={18} /> Summary
          </button>
        )}
        {data && (
          <button className="btn" onClick={() => exportPdf('draft')} title="Download a draft PDF for review or printing">
            <IconPdf size={18} /> Draft PDF
          </button>
        )}
        {data && (
          <button className="btn primary" onClick={() => saveJob()} title="Save the checklist file (.chck) to your computer">
            <IconSave size={18} /> Save
          </button>
        )}
        <button className="btn ghost" onClick={() => go('guide')} title="User guide">
          <IconGuide size={18} /> <span>Guide</span>
        </button>
        {server && (
          <a className="btn ghost" href="/api/logout" title="Log out">
            <IconLogout size={18} />
          </a>
        )}
      </div>
    </header>
  );
}
