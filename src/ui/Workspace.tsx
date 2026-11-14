import { useEffect, useMemo, useState } from 'react';
import { CONDITION_LABELS, FLOOR_LABELS, type ChecklistItem, type StageId } from '../content/types';
import { getBuilder, hiddenItems, stageProgress, visibleItems } from '../lib/rules';
import { useSession } from '../store/session';
import { Detail, ZoomImage } from './common';
import { IconBack, IconHide, IconNext, IconShow, IconSummary, IconTip } from './icons';
import { ItemCard } from './ItemCard';
import { ElevationsPanel, JobInfoPanel, OpeningsPanel, WallsPanel } from './Panels';
import { StageArt } from './StageArt';

function Sidebar() {
  const { content, data, stage, setStage, go } = useSession();
  if (!data) return null;
  return (
    <nav className="sidebar" aria-label="Checklist stages">
      {content.stages.map((s, i) => {
        const p = stageProgress(content, data, s.id);
        const complete = p.total > 0 && p.complete === p.total;
        const flags = data.review.entries.filter((e) => e.kind === 'flag' && !e.resolved && content.items.find((it) => it.id === e.itemId)?.stage === s.id).length;
        return (
          <button key={s.id} className={`stage-link${stage === s.id ? ' active' : ''}`} onClick={() => setStage(s.id)} aria-current={stage === s.id ? 'step' : undefined}>
            <span className={`stage-num${complete ? ' complete' : ''}`}>{i + 1}</span>
            <span className="stage-name">{s.title}</span>
            <span className="stage-meta">
              <span className="bar" aria-hidden>
                <span style={{ width: `${p.total ? (p.complete / p.total) * 100 : 0}%` }} />
              </span>
              {p.complete}/{p.total}
              {p.confirm + p.blocked > 0 && <span className="warn-text">⚠{p.confirm + p.blocked}</span>}
              {flags > 0 && <span className="block-text">⚑{flags}</span>}
            </span>
          </button>
        );
      })}
      <div className="sidebar-foot">
        <button className="btn" style={{ width: '100%' }} onClick={() => go('summary')}>
          <IconSummary size={18} /> Summary & export
        </button>
      </div>
    </nav>
  );
}

function describeCondition(item: ChecklistItem, builderName: (id: string) => string): string {
  const w = item.appliesWhen;
  if (!w) return '';
  const parts: string[] = [];
  if (w.builders?.length) parts.push(`only for ${w.builders.map(builderName).join(', ')}`);
  if (w.conditions?.length) parts.push(`only when the job has: ${w.conditions.map((c) => CONDITION_LABELS[c].toLowerCase()).join(' or ')}`);
  if (w.floors?.length) parts.push(`only for ${w.floors.map((f) => FLOOR_LABELS[f]).join(', ')}`);
  if (w.splitLevel !== undefined) parts.push(w.splitLevel ? 'only for split-level houses' : 'only for standard houses');
  return parts.join('; ');
}

/** "/spec/a.png | Case 1 — Plan" → { src, caption }. */
export function parseRefImage(line: string): { src: string; caption: string } {
  const [src, ...rest] = line.split('|');
  return { src: src.trim(), caption: rest.join('|').trim() };
}

function RefImages({ item }: { item: ChecklistItem }) {
  const images = (item.ref?.images ?? []).map(parseRefImage);
  if (images.length === 0) return null;
  const captioned = images.some((i) => i.caption);
  return (
    <div className={captioned ? 'ref-grid' : undefined}>
      {images.map(({ src, caption }) =>
        caption ? (
          <figure key={src} className="ref-figure">
            <ZoomImage src={src} alt={`${item.title} — ${caption}`} />
            <figcaption>{caption}</figcaption>
          </figure>
        ) : (
          <ZoomImage key={src} src={src} alt={`${item.title} — reference`} />
        ),
      )}
    </div>
  );
}

function ReferencePanel({ item }: { item: ChecklistItem | null }) {
  const { content, data } = useSession();
  if (!data) return null;
  const builder = getBuilder(content, data.job.builderId);
  const rule = item?.builderNotes?.[data.job.builderId];
  return (
    <aside className="refpanel" aria-label="Reference">
      {item ? (
        <div className="stack">
          <div className="section-title">Reference</div>
          <h3>{item.title}</h3>
          {item.ref && (
            <div>
              <span className="src">
                {item.ref.source} {item.ref.section}
              </span>
              {item.ref.text && <Detail text={item.ref.text} />}
              <RefImages item={item} />

            </div>
          )}
          {rule && (
            <div className="builder-rule">
              <div>
                <b>{builder?.shortName}:</b> {rule}
              </div>
            </div>
          )}
          {item.tips?.map((t, i) => (
            <div key={i} className="tips">
              <IconTip size={14} /> <span className="job-tag">Job {t.job}</span>
              {t.text}
            </div>
          ))}
          {!item.ref && !rule && !item.tips?.length && <p className="muted">No extra reference for this item.</p>}
        </div>
      ) : (
        <p className="muted">Click an item to see its spec reference here.</p>
      )}
      {builder && (
        <div className="stack" style={{ marginTop: 24 }}>
          <div className="section-title">{builder.shortName} — suggested framing</div>
          <p className="hint">Suggestions only. Enter the sizes designed for this job.</p>
          <table className="framing-table">
            <tbody>
              <tr><th>Stud</th><td>{builder.framing.stud}</td></tr>
              <tr><th>Load-bearing top + ribbon plate</th><td>{builder.framing.lbTopPlate}</td></tr>
              <tr><th>Non-load-bearing top plate</th><td>{builder.framing.nlbTopPlate}</td></tr>
              <tr><th>Bottom plate</th><td>{builder.framing.bottomPlate}</td></tr>
              <tr><th>Nogging</th><td>{builder.framing.nogging}</td></tr>
            </tbody>
          </table>
          {builder.notes.length > 0 && (
            <>
              <div className="section-title" style={{ marginTop: 8 }}>{builder.shortName} — key rules</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14 }}>
                {builder.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </aside>
  );
}

const PANELS: Partial<Record<StageId, () => React.JSX.Element | null>> = {
  'job-review': JobInfoPanel,
  elevations: ElevationsPanel,
  'wall-panels': WallsPanel,
  openings: OpeningsPanel,
};

export function Workspace() {
  const { content, data, stage, setStage } = useSession();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const stageIndex = content.stages.findIndex((s) => s.id === stage);
  const stageDef = content.stages[stageIndex];
  const items = useMemo(() => (data ? visibleItems(content, data.job, stage) : []), [content, data, stage]);
  const hidden = useMemo(() => (data ? hiddenItems(content, data.job, stage) : []), [content, data, stage]);

  useEffect(() => {
    setSelectedId(null);
    window.scrollTo({ top: 0 });
  }, [stage]);

  if (!data || !stageDef) return null;
  const Panel = PANELS[stage];
  const selected = content.items.find((i) => i.id === selectedId) ?? null;
  const builderName = (id: string) => content.builders.find((b) => b.id === id)?.shortName ?? id;
  const prev = content.stages[stageIndex - 1];
  const next = content.stages[stageIndex + 1];

  return (
    <div className="workspace">
      <Sidebar />
      <main className="main">
        <header className="stage-head">
          <div>
            <span className="kicker">
              Stage {stageIndex + 1} of {content.stages.length} · {stageDef.ref}
            </span>
            <h2>{stageDef.title}</h2>
            <p>{stageDef.summary}</p>
          </div>
          <StageArt stage={stage} />
        </header>
        {/* Items marked "show above the table" (e.g. WHH before the openings) come first — visibleItems puts them first. */}
        {items.map((item, i) =>
          item.showAbovePanel ? (
            <ItemCard key={item.id} item={item} num={`${stageIndex + 1}.${i + 1}`} selected={selectedId === item.id} onSelect={() => setSelectedId(item.id)} />
          ) : null,
        )}
        {Panel && <Panel />}
        {items.map((item, i) =>
          item.showAbovePanel ? null : (
            <ItemCard key={item.id} item={item} num={`${stageIndex + 1}.${i + 1}`} selected={selectedId === item.id} onSelect={() => setSelectedId(item.id)} />
          ),
        )}
        {hidden.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <button className="btn ghost small" onClick={() => setShowHidden(!showHidden)}>
              {showHidden ? <IconHide size={16} /> : <IconShow size={16} />} {showHidden ? 'Hide' : 'Show'} {hidden.length} item{hidden.length > 1 ? 's' : ''} that do not apply to this job
            </button>
            {showHidden && (
              <ul className="list card card-pad" style={{ marginTop: 8 }}>
                {hidden.map((h) => (
                  <li key={h.id}>
                    <span className="muted">
                      <b>{h.title}</b> — {describeCondition(h, builderName)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <nav className="stage-nav" aria-label="Stage navigation">
          {prev ? (
            <button className="btn" onClick={() => setStage(prev.id)}>
              <IconBack size={18} /> {prev.title}
            </button>
          ) : (
            <span />
          )}
          {next ? (
            <button className="btn primary" onClick={() => setStage(next.id)}>
              Next: {next.title} <IconNext size={18} />
            </button>
          ) : (
            <button className="btn primary" onClick={() => useSession.getState().go('summary')}>
              Go to summary <IconNext size={18} />
            </button>
          )}
        </nav>
      </main>
      <ReferencePanel item={selected} />
    </div>
  );
}
