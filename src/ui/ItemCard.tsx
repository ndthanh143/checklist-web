import type { ChecklistItem } from '../content/types';
import type { Status } from '../job/types';
import { STATUSES, STATUS_LABELS } from '../job/types';
import { getBuilder, itemProblems, itemState } from '../lib/rules';
import { useSession } from '../store/session';
import { Detail } from './common';
import { FieldInput, Widget } from './Fields';
import { IconBlocked, IconDone, IconInfo, IconNA, IconNotStarted, IconTip, IconWarn } from './icons';
import { ReviewEntries } from './ReviewEntries';

export const STATUS_ICON: Record<Status, typeof IconDone> = {
  'not-started': IconNotStarted,
  done: IconDone,
  na: IconNA,
  confirm: IconWarn,
  blocked: IconBlocked,
};

const STATUS_ORDER: Status[] = ['done', 'na', 'confirm', 'blocked', 'not-started'];

export function ItemCard({ item, num, selected, onSelect }: { item: ChecklistItem; num: string; selected: boolean; onSelect: () => void }) {
  const { data, content, role, setStatus, setNote } = useSession();
  if (!data) return null;
  const state = itemState(data, item.id);
  const builder = getBuilder(content, data.job.builderId);
  const rule = item.builderNotes?.[data.job.builderId];
  const locked = role !== 'detailer';
  const problems = state.status === 'done' ? itemProblems(item, state) : [];
  const openFlags = data.review.entries.filter((e) => e.itemId === item.id && e.kind === 'flag' && !e.resolved).length;

  return (
    <article className={`item s-${state.status}${selected ? ' selected' : ''}`} id={`item-${item.id}`} onFocusCapture={onSelect} onClick={onSelect}>
      <div className="item-head">
        <span className="num">{num}</span>
        <h3>{item.title}</h3>
        {openFlags > 0 && <span className="pill block">{openFlags} open flag{openFlags > 1 ? 's' : ''}</span>}
        {item.ref && (
          <button
            className="btn ghost small"
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            title="Show the spec reference"
          >
            <IconInfo size={15} /> See spec
          </button>
        )}
      </div>
      <div className="item-body">
        {item.detail && <Detail text={item.detail} />}
        {rule && (
          <div className="builder-rule">
            <div>
              <b>{builder?.shortName ?? 'Builder'} rule:</b> {rule}
            </div>
          </div>
        )}
        {(item.fields ?? []).length > 0 && (
          <div className="field-row">
            {item.fields!.map((f) => (
              <div key={f.id} style={f.kind === 'checks' || f.kind === 'textarea' ? { gridColumn: '1 / -1' } : undefined}>
                <FieldInput item={item} field={f} state={state} locked={locked} />
              </div>
            ))}
          </div>
        )}
        <Widget item={item} state={state} locked={locked} />
        {item.tips && item.tips.length > 0 && (
          <details className="tips">
            <summary>
              <IconTip size={15} /> Common mistakes from client feedback ({item.tips.length})
            </summary>
            <ul>
              {item.tips.map((t, i) => (
                <li key={i}>
                  <span className="job-tag">Job {t.job}</span>
                  {t.text}
                </li>
              ))}
            </ul>
          </details>
        )}
        <div className="status-row" role="group" aria-label={`Status for ${item.title}`}>
          {STATUS_ORDER.map((s) => {
            const Icon = STATUS_ICON[s];
            const on = state.status === s;
            return (
              <button key={s} type="button" className={`status-btn ${s}${on ? ' on' : ''}`} aria-pressed={on} disabled={locked && !on} onClick={() => !locked && setStatus(item.id, s)}>
                <Icon size={16} /> {STATUS_LABELS[s]}
              </button>
            );
          })}
        </div>
        {problems.length > 0 && (
          <div className="problems" role="alert">
            <b>
              <IconWarn size={14} /> Marked Done, but:
            </b>
            <ul>
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </div>
        )}
        {(!locked || state.note) && (
          <div className="field">
            <label className="label" htmlFor={`note-${item.id}`}>
              Note
            </label>
            <textarea
              id={`note-${item.id}`}
              className="textarea"
              style={{ minHeight: 44 }}
              value={state.note}
              disabled={locked}
              placeholder={state.status === 'confirm' || state.status === 'blocked' ? 'What needs confirming, and with whom?' : 'Optional'}
              onChange={(e) => setNote(item.id, e.target.value)}
            />
          </div>
        )}
        <ReviewEntries itemId={item.id} />
      </div>
    </article>
  );
}

export { STATUSES };
