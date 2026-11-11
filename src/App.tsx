import { lazy, Suspense, useEffect, useState } from 'react';
import { useSession } from './store/session';
import { Toasts } from './ui/common';
import { Guide } from './ui/Guide';
import { Home } from './ui/Home';
import { IconClose, IconWarn, IconInfo, IconLock } from './ui/icons';
import { Summary } from './ui/Summary';
import { TopBar } from './ui/TopBar';
import { Wizard } from './ui/Wizard';
import { Workspace } from './ui/Workspace';

const ContentEditor = lazy(() => import('./admin/ContentEditor'));

function Banners() {
  const { data, role, fingerprintWarning, contentChanges, dismissWarnings, content } = useSession();
  if (!data) return null;
  const title = (id: string) => content.items.find((i) => i.id === id)?.title ?? id;
  return (
    <>
      {fingerprintWarning && (
        <div className="banner block" role="alert">
          <IconWarn size={18} />
          <div className="grow">
            <b>This file was changed outside the app.</b> Someone edited the .chck file with another program after it was last saved here. Check the inputs carefully.
          </div>
          <button className="btn ghost small" onClick={dismissWarnings} aria-label="Dismiss">
            <IconClose size={16} />
          </button>
        </div>
      )}
      {contentChanges && (
        <div className="banner info">
          <IconInfo size={18} />
          <div className="grow">
            <b>Checklist rules were updated since this file was saved.</b>{' '}
            {contentChanges.added.length > 0 && <>New: {contentChanges.added.map(title).join(', ')}. </>}
            {contentChanges.changed.length > 0 && <>Changed: {contentChanges.changed.map(title).join(', ')}. </>}
            {contentChanges.removed.length > 0 && <>{contentChanges.removed.length} item(s) removed. </>}
          </div>
          <button className="btn ghost small" onClick={dismissWarnings} aria-label="Dismiss">
            <IconClose size={16} />
          </button>
        </div>
      )}
      {data.stage === 'review' && role === 'checker' && (
        <div className="banner warn">
          <IconLock size={18} />
          <div className="grow">
            <b>Review mode.</b> The detailer’s inputs are locked. Add flags, comments and photos on any item, then save the review file.
          </div>
        </div>
      )}
      {data.stage === 'review' && role === 'detailer' && (
        <div className="banner info">
          <IconInfo size={18} />
          <div className="grow">
            <b>This job is in review.</b> Fix each open flag and write a reply, then save and send the file back to the checker.
          </div>
        </div>
      )}
    </>
  );
}

function MainApp() {
  const { view, go } = useSession();
  const [wizardBuilder, setWizardBuilder] = useState('');

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (useSession.getState().dirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  return (
    <div className="app">
      <TopBar />
      <Banners />
      {view === 'home' && (
        <Home
          onNewJob={(b) => {
            setWizardBuilder(b);
            go('wizard');
          }}
        />
      )}
      {view === 'wizard' && <Wizard initialBuilder={wizardBuilder} onCancel={() => go('home')} />}
      {view === 'workspace' && <Workspace />}
      {view === 'summary' && <Summary />}
      {view === 'guide' && <Guide />}
      <Toasts />
    </div>
  );
}

export default function App() {
  if (window.location.pathname.startsWith('/admin')) {
    return (
      <Suspense fallback={<div className="page">Loading content editor…</div>}>
        <ContentEditor />
        <Toasts />
      </Suspense>
    );
  }
  return <MainApp />;
}
