import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { parseContent } from './content/schema';
import { useSession } from './store/session';
import './styles.css';

/**
 * Load the latest published checklist rules from the server.
 * If the server is not available (local dev) or nothing is published yet, the bundled rules are used.
 */
async function loadContent() {
  try {
    const res = await fetch('/api/content', { cache: 'no-store', credentials: 'same-origin' });
    const isJson = res.headers.get('content-type')?.includes('application/json');
    if (res.status === 204) {
      useSession.getState().setServer(true);
      return;
    }
    if (res.ok && isJson) {
      useSession.getState().setServer(true);
      useSession.getState().setContent(parseContent(await res.json()), 'server');
    }
  } catch (e) {
    console.warn('Using bundled checklist rules:', e);
  }
}

loadContent().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
