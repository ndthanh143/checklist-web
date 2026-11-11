import { useRef, useState } from 'react';
import type { Photo } from '../job/types';
import { uid } from '../lib/hash';
import { useSession } from '../store/session';
import { readPhoto, toast, ZoomImage } from './common';
import { IconCamera, IconComment, IconDelete, IconFlag, IconUndo, IconDone } from './icons';

/** Flags and comments on one item (itemId) or on the whole job (itemId = null). */
export function ReviewEntries({ itemId }: { itemId: string | null }) {
  const { data, role, photos, setEntryResolved, removeEntry, respondToEntry } = useSession();
  const [form, setForm] = useState<'flag' | 'comment' | null>(null);
  if (!data) return null;
  const entries = data.review.entries.filter((e) => e.itemId === itemId);
  const inReview = data.stage === 'review';
  const isChecker = role === 'checker';
  if (!inReview && entries.length === 0) return null;

  return (
    <div className="entries">
      {entries.map((e) => (
        <div key={e.id} className={`entry ${e.kind} ${e.resolved ? 'resolved' : 'open'}`}>
          <div className="entry-head">
            {e.kind === 'flag' ? <IconFlag size={14} color="#C43D3D" /> : <IconComment size={14} />}
            <b>{e.kind === 'flag' ? (e.resolved ? 'Flag — resolved' : 'Flag — open') : 'Comment'}</b>
            <span>
              · {e.author} · {e.round === 3 ? '3rd' : '2nd'} check · {new Date(e.createdAt).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}
            </span>
          </div>
          <div style={{ whiteSpace: 'pre-wrap' }}>{e.text}</div>
          {e.photoIds.length > 0 && (
            <div className="photos">
              {e.photoIds.map((pid) => {
                const p = photos.find((x) => x.id === pid);
                return p ? <ZoomImage key={pid} src={p.dataUrl} alt={p.name} /> : null;
              })}
            </div>
          )}
          {e.response && !(role === 'detailer' && e.kind === 'flag' && !e.resolved) && (
            <div className="response">
              <b>Detailer:</b> {e.response}
            </div>
          )}
          {role === 'detailer' && e.kind === 'flag' && !e.resolved && (
            <div className="field" style={{ marginTop: 6 }}>
              <label className="label" htmlFor={`resp-${e.id}`}>
                Your reply (what you fixed)
              </label>
              <textarea id={`resp-${e.id}`} className="textarea" value={e.response ?? ''} onChange={(ev) => respondToEntry(e.id, ev.target.value)} placeholder="e.g. Fixed — D1 moved to 90 mm from I2" />
            </div>
          )}
          {isChecker && (
            <div className="entry-actions">
              {e.kind === 'flag' &&
                (e.resolved ? (
                  <button className="btn small" onClick={() => setEntryResolved(e.id, false)}>
                    <IconUndo size={14} /> Re-open
                  </button>
                ) : (
                  <button className="btn small" onClick={() => setEntryResolved(e.id, true)}>
                    <IconDone size={14} /> Mark resolved
                  </button>
                ))}
              <button className="btn small danger" onClick={() => window.confirm('Delete this entry?') && removeEntry(e.id)}>
                <IconDelete size={14} /> Delete
              </button>
            </div>
          )}
        </div>
      ))}
      {isChecker && inReview && !form && (
        <div className="row">
          <button className="btn small" onClick={() => setForm('flag')}>
            <IconFlag size={14} /> Add flag
          </button>
          <button className="btn small" onClick={() => setForm('comment')}>
            <IconComment size={14} /> Add comment
          </button>
        </div>
      )}
      {form && <EntryForm itemId={itemId} kind={form} onDone={() => setForm(null)} />}
    </div>
  );
}

function EntryForm({ itemId, kind, onDone }: { itemId: string | null; kind: 'flag' | 'comment'; onDone: () => void }) {
  const addEntry = useSession((s) => s.addEntry);
  const [text, setText] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const addPhotos = async (files: FileList | null) => {
    if (!files) return;
    try {
      const added: Photo[] = [];
      for (const f of Array.from(files)) {
        if (!f.type.startsWith('image/')) continue;
        added.push({ id: uid('p_'), ...(await readPhoto(f)) });
      }
      setPhotos((p) => [...p, ...added]);
    } catch {
      toast('Could not read that image.', 'error');
    }
  };

  return (
    <div className="review-form">
      <label className="label" htmlFor={`entry-${itemId}`}>
        {kind === 'flag' ? 'What is wrong? (the detailer must fix this)' : 'Comment'}
      </label>
      <textarea id={`entry-${itemId}`} className="textarea" value={text} onChange={(e) => setText(e.target.value)} autoFocus placeholder={kind === 'flag' ? 'e.g. D1 should be 90 mm from I2 — detailed at 110 mm' : ''} />
      {photos.length > 0 && (
        <div className="row">
          {photos.map((p) => (
            <span key={p.id} className="pill info">
              {p.name}
              <button className="btn ghost small" aria-label={`Remove ${p.name}`} onClick={() => setPhotos(photos.filter((x) => x.id !== p.id))}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => addPhotos(e.target.files)} />
          <button className="btn small" onClick={() => fileRef.current?.click()}>
            <IconCamera size={14} /> Attach photo / screenshot
          </button>
        </div>
        <div className="row">
          <button className="btn small" onClick={onDone}>
            Cancel
          </button>
          <button
            className="btn small primary"
            disabled={!text.trim()}
            onClick={() => {
              addEntry({ itemId, kind, text: text.trim() }, photos);
              onDone();
            }}
          >
            {kind === 'flag' ? 'Add flag' : 'Add comment'}
          </button>
        </div>
      </div>
    </div>
  );
}
