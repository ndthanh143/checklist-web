import { useCallback, useEffect, useMemo, useState } from 'react';
import { defaultContent } from '../content/defaultContent';
import { contentSchema } from '../content/schema';
import type { ChecklistContent } from '../content/types';
import { downloadBlob } from '../lib/fileio';
import { toast } from '../ui/common';
import { IconHistory, IconHome, IconSave, IconSend, IconUpload, IconWarn, IconPdf } from '../ui/icons';
import { adminApi, ApiError, type VersionInfo } from './api';
import { BuildersEditor } from './BuildersEditor';
import { ItemsEditor } from './ItemsEditor';
import { TablesEditor } from './TablesEditor';
import '../styles.css';
import './admin.css';

type Tab = 'items' | 'builders' | 'tables' | 'publish';

export default function ContentEditor() {
  const [content, setContent] = useState<ChecklistContent | null>(null);
  const [publishedVersion, setPublishedVersion] = useState<number>(0);
  const [online, setOnline] = useState(true);
  const [email, setEmail] = useState('');
  const [dirty, setDirty] = useState(false);
  const [draftInfo, setDraftInfo] = useState<{ updatedAt: string; updatedBy: string } | null>(null);
  const [tab, setTab] = useState<Tab>('items');
  const [history, setHistory] = useState<VersionInfo[]>([]);
  const [note, setNote] = useState('');
  const [authError, setAuthError] = useState('');
  const [needLogin, setNeedLogin] = useState(false);

  const loadHistory = useCallback(async () => {
    try {
      setHistory((await adminApi.history()).versions);
    } catch {
      /* offline */
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const me = await adminApi.me();
        setEmail(me.email);
        const published = await adminApi.published();
        setPublishedVersion(published?.version ?? 0);
        const draft = await adminApi.getDraft();
        if ('content' in draft) {
          setContent(draft.content);
          setDraftInfo({ updatedAt: draft.updatedAt, updatedBy: draft.updatedBy });
        } else setContent(published ?? defaultContent);
        loadHistory();
      } catch (e) {
        if (e instanceof ApiError && e.login === 'password') {
          setNeedLogin(true);
        } else if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          setAuthError(e.message);
        } else {
          setOnline(false);
          setContent(defaultContent);
        }
      }
    })();
  }, [loadHistory]);

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const update = useCallback((fn: (c: ChecklistContent) => ChecklistContent) => {
    setContent((c) => (c ? fn(c) : c));
    setDirty(true);
  }, []);

  const validation = useMemo(() => (content ? contentSchema.safeParse(content) : null), [content]);
  const errors = validation && !validation.success ? validation.error.issues.map((i) => `${i.path.join(' › ') || 'Content'}: ${i.message}`) : [];

  if (needLogin) return <AdminLogin />;
  if (authError) {
    return (
      <main className="page page-narrow">
        <h1>Content editor</h1>
        <div className="problems mt">
          <IconWarn size={16} /> {authError}. Ask your administrator to give your email access to the Content editor.
        </div>
        <a className="btn mt" href="/">
          <IconHome size={16} /> Back to the checklist
        </a>
      </main>
    );
  }
  if (!content) return <main className="page">Loading…</main>;

  const saveDraft = async () => {
    try {
      const r = await adminApi.saveDraft(content);
      setDraftInfo({ updatedAt: r.updatedAt, updatedBy: email });
      setDirty(false);
      toast('Draft saved. Nobody sees it until you publish.', 'ok');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save the draft', 'error');
    }
  };

  const publish = async () => {
    if (errors.length) return toast('Fix the problems listed before publishing.', 'error');
    if (!note.trim()) return toast('Write a short note about what changed.', 'error');
    if (!window.confirm(`Publish these rules as version ${publishedVersion + 1}? Detailers get them the next time they open the checklist.`)) return;
    try {
      const v = await adminApi.publish(content, note.trim());
      setPublishedVersion(v.version);
      setContent({ ...content, version: v.version });
      setDirty(false);
      setDraftInfo(null);
      setNote('');
      loadHistory();
      toast(`Published version ${v.version}`, 'ok');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not publish', 'error');
    }
  };

  const rollback = async (v: VersionInfo) => {
    if (!window.confirm(`Restore version ${v.version} (${v.note})? It will be published again as a new version.`)) return;
    try {
      const r = await adminApi.rollback(v.version, `Restored version ${v.version}`);
      const restored = await adminApi.getVersion(r.version);
      setContent(restored.content);
      setPublishedVersion(r.version);
      setDirty(false);
      setDraftInfo(null);
      loadHistory();
      toast(`Version ${v.version} restored as version ${r.version}`, 'ok');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not restore', 'error');
    }
  };

  const exportJson = () => {
    downloadBlob(new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' }), `checklist-rules-v${content.version}.json`);
  };

  const importJson = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      try {
        const parsed = contentSchema.safeParse(JSON.parse(await f.text()));
        if (!parsed.success) return toast(`This file is not valid: ${parsed.error.issues[0]?.message}`, 'error');
        if (!window.confirm('Replace everything in the editor with this file?')) return;
        setContent(parsed.data as ChecklistContent);
        setDirty(true);
        toast('Imported. Save the draft or publish to keep it.', 'ok');
      } catch {
        toast('Could not read that file.', 'error');
      }
    };
    input.click();
  };

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="/">
          <img className="lawmans" src="/logos/lawmans.png" alt="Lawmans Frame & Truss" />
        </a>
        <div className="job-chip">
          <span className="title">Content editor — checklist rules</span>
          <span className="sub">
            Published: {publishedVersion ? `version ${publishedVersion}` : 'nothing yet (bundled rules in use)'}
            {email && ` · ${email}`}
          </span>
        </div>
        <div className="spacer" />
        <div className="actions">
          {dirty ? <span className="save-state warn">Unsaved changes</span> : draftInfo ? <span className="save-state ok">Draft saved</span> : null}
          <button className="btn primary" onClick={saveDraft} disabled={!online || !dirty}>
            <IconSave size={16} /> Save draft
          </button>
          <a className="btn ghost" href="/">
            <IconHome size={16} /> Checklist
          </a>
        </div>
      </header>
      {!online && (
        <div className="banner warn">
          <IconWarn size={18} />
          <div className="grow">
            <b>The server is not connected.</b> You can edit and test here, but changes can only be kept with “Export JSON”. Publishing needs the Cloudflare backend (see the README).
          </div>
        </div>
      )}
      {draftInfo && !dirty && (
        <div className="banner info">
          <div className="grow">
            Editing a draft saved by {draftInfo.updatedBy} on {new Date(draftInfo.updatedAt).toLocaleString('en-AU')}. Detailers still see version {publishedVersion || 'bundled'} until you publish.
          </div>
        </div>
      )}
      <nav className="admin-tabs" aria-label="Editor sections">
        {(
          [
            ['items', `Checklist items (${content.items.length})`],
            ['builders', `Builders (${content.builders.length})`],
            ['tables', 'Opening allowances & lintel table'],
            ['publish', 'Publish & history'],
          ] as [Tab, string][]
        ).map(([t, label]) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            {label}
            {t === 'publish' && errors.length > 0 && <span className="pill block" style={{ marginLeft: 6 }}>{errors.length}</span>}
          </button>
        ))}
      </nav>

      {tab === 'items' && <ItemsEditor content={content} update={update} />}
      {tab === 'builders' && <BuildersEditor content={content} update={update} />}
      {tab === 'tables' && <TablesEditor content={content} update={update} />}
      {tab === 'publish' && (
        <main className="page">
          <div className="summary-grid">
            <section className="card card-pad stack">
              <h2>Publish</h2>
              <p className="muted">
                Publishing makes these rules live for every detailer. Files saved with older rules still open; the app lists the items that changed.
              </p>
              {errors.length > 0 ? (
                <div className="problems">
                  <b>Fix these before publishing:</b>
                  <ul>
                    {errors.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <span className="ok-text">No problems found.</span>
              )}
              <div className="field">
                <label className="label" htmlFor="pub-note">
                  What changed? (shown in the history)
                </label>
                <textarea id="pub-note" className="textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Added Ashmont side junction break rule from job 26-89 feedback" />
              </div>
              <div className="row">
                <button className="btn primary" disabled={!online || errors.length > 0} onClick={publish}>
                  <IconSend size={16} /> Publish as version {publishedVersion + 1}
                </button>
                {draftInfo && (
                  <button
                    className="btn danger"
                    onClick={async () => {
                      if (!window.confirm('Throw away the draft and go back to the published rules?')) return;
                      await adminApi.discardDraft();
                      setContent((await adminApi.published()) ?? defaultContent);
                      setDraftInfo(null);
                      setDirty(false);
                    }}
                  >
                    Discard draft
                  </button>
                )}
              </div>
              <h3 className="mt">Backup</h3>
              <div className="row">
                <button className="btn" onClick={exportJson}>
                  <IconPdf size={16} /> Export JSON
                </button>
                <button className="btn" onClick={importJson}>
                  <IconUpload size={16} /> Import JSON
                </button>
              </div>
            </section>
            <section className="card card-pad">
              <h2>
                <IconHistory size={20} /> History
              </h2>
              {history.length === 0 ? (
                <p className="muted mt">No versions published yet.</p>
              ) : (
                <ul className="list">
                  {history.map((v) => (
                    <li key={v.version}>
                      <div style={{ flex: 1 }}>
                        <b>Version {v.version}</b>
                        {v.version === publishedVersion && <span className="pill ok" style={{ marginLeft: 6 }}>Live</span>}
                        <div className="muted">
                          {new Date(v.publishedAt).toLocaleString('en-AU')} · {v.publishedBy}
                        </div>
                        <div>{v.note}</div>
                      </div>
                      {v.version !== publishedVersion && (
                        <button className="btn small" onClick={() => rollback(v)}>
                          Restore
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </main>
      )}
    </div>
  );
}

function AdminLogin() {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await adminApi.login(name.trim(), password);
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log in');
      setBusy(false);
    }
  };
  return (
    <main className="page page-narrow">
      <form className="card card-pad stack" style={{ maxWidth: 440, margin: '40px auto' }} onSubmit={submit}>
        <img src="/logos/lawmans.png" alt="Lawmans Frame & Truss" style={{ height: 38, alignSelf: 'flex-start' }} />
        <h1>Content editor</h1>
        <p className="muted">For staff who update the checklist rules. Your name is saved in the publish history.</p>
        <div className="field">
          <label className="label" htmlFor="adm-name">Your name</label>
          <input id="adm-name" className="input" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </div>
        <div className="field">
          <label className="label" htmlFor="adm-pass">Content editor password</label>
          <input id="adm-pass" className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <div className="problems">{error}</div>}
        <button className="btn primary big" disabled={busy || !name.trim() || !password}>Log in</button>
        <a className="link-btn" href="/">Back to the checklist</a>
      </form>
    </main>
  );
}
