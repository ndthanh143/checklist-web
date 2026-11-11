import { useState } from 'react';
import { FLOOR_LABELS } from '../content/types';
import { getBuilder } from '../lib/rules';
import { useSession } from '../store/session';
import { BuilderLogo } from './common';
import { beginOpen, pickJobFile, readJobFile, usePendingOpen } from './fileActions';
import { IconEdit, IconGuide, IconNext, IconOpen, IconWarn } from './icons';
import { OpenDialog } from './OpenDialog';

export function Home({ onNewJob }: { onNewJob: (builderId: string) => void }) {
  const { content, data, go } = useSession();
  const [pending, setPending] = usePendingOpen();
  const [over, setOver] = useState(false);
  const builders = content.builders.filter((b) => b.active);

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    beginOpen(await readJobFile(await file.arrayBuffer(), file.name, null), setPending);
  };

  return (
    <main className="page">
      {data && (
        <div className="card card-pad row" style={{ marginBottom: 22, justifyContent: 'space-between' }}>
          <div>
            <div className="section-title">Open job</div>
            <b>
              {data.job.jobNo || 'New job'} · {FLOOR_LABELS[data.job.floor]}
            </b>{' '}
            <span className="muted">— {getBuilder(content, data.job.builderId)?.name}</span>
          </div>
          <button className="btn primary" onClick={() => go('workspace')}>
            Continue this job <IconNext size={18} />
          </button>
        </div>
      )}

      <section className="home-hero">
        <div className="stack">
          <h1>Wall frame checklist</h1>
          <p className="muted" style={{ fontSize: 16 }}>
            Choose the builder to start a new checklist. The checklist follows the MiTek 20/20 detailing steps and shows only what applies to your job.
          </p>
          <div className="notice">
            <IconWarn size={20} />
            <div>
              <b>Your work is not stored on this website.</b> Refreshing or closing the page loses anything you have not saved. Press <b>Save</b> often — the
              checklist is saved as a <b>.chck</b> file on your computer. <button className="link-btn" onClick={() => go('guide')}>Read the user guide</button>
            </div>
          </div>
        </div>
        <div
          className={`dropzone${over ? ' over' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
        >
          <IconOpen size={34} color="#0033A0" />
          <b>Continue or review a saved checklist</b>
          <span className="muted">Drag a .chck file here, or</span>
          <button className="btn primary" onClick={async () => beginOpen(await pickJobFile(), setPending)}>
            Open a .chck file
          </button>
        </div>
      </section>

      <div className="section-title">Start a new checklist — choose the builder</div>
      <div className="builder-grid">
        {builders.map((b) => (
          <button key={b.id} className="builder-card" onClick={() => onNewJob(b.id)}>
            <BuilderLogo builder={b} />
            <span className="name">{b.name}</span>
          </button>
        ))}
      </div>

      <div className="row mt" style={{ marginTop: 34, justifyContent: 'space-between' }}>
        <button className="btn ghost" onClick={() => go('guide')}>
          <IconGuide size={18} /> User guide
        </button>
        <a className="btn ghost" href="/admin" title="For staff who update the checklist rules">
          <IconEdit size={18} /> Content editor
        </a>
      </div>

      {pending && <OpenDialog pending={pending} onClose={() => setPending(null)} />}
    </main>
  );
}
