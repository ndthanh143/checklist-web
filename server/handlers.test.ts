import { describe, expect, it } from 'vitest';
import { defaultContent } from '../src/content/defaultContent';
import { gate } from './gate';
import { handleAdminLogin, handleLogin, handleLogout } from './auth';
import { handleAdmin, handleContent } from './handlers';
import type { ServerEnv } from './http';
import { memoryStore } from './store';

const env: ServerEnv = { SITE_PASSWORD: 'MitekVietnam', SESSION_SECRET: 'test-secret', ADMIN_PASSWORD: 'editor-pass' };
const B = 'https://checklist.example.com';
const cookieOf = (res: Response) => (res.headers.get('set-cookie') ?? '').split(';')[0];

async function login(): Promise<string> {
  const res = await handleLogin(new Request(`${B}/api/login`, { method: 'POST', body: new URLSearchParams({ password: 'MitekVietnam' }) }), env);
  return cookieOf(res);
}

describe('login gate', () => {
  it('redirects pages and blocks APIs without a session', async () => {
    const page = await gate(new Request(`${B}/`), env);
    expect(page?.status).toBe(302);
    expect(page?.headers.get('location')).toBe(`${B}/login`);
    expect((await gate(new Request(`${B}/assets/index.js`), env))?.status).toBe(302);
    expect((await gate(new Request(`${B}/api/content`), env))?.status).toBe(401);
  });
  it('lets the login page through and fails closed when not configured', async () => {
    expect(await gate(new Request(`${B}/login`), env)).toBeNull();
    expect((await gate(new Request(`${B}/`), {}))?.status).toBe(500);
  });
  it('wrong password returns to the login page with no cookie', async () => {
    const res = await handleLogin(new Request(`${B}/api/login`, { method: 'POST', body: new URLSearchParams({ password: 'nope' }) }), env);
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toContain('error=1');
    expect(res.headers.get('set-cookie')).toBeNull();
  });
  it('correct password opens everything', async () => {
    const cookie = await login();
    expect(await gate(new Request(`${B}/`, { headers: { cookie } }), env)).toBeNull();
    expect(await gate(new Request(`${B}/api/content`, { headers: { cookie } }), env)).toBeNull();
  });
  it('logout clears both cookies', () => {
    expect(handleLogout().headers.get('set-cookie')).toMatch(/lsc_session=;.*lsc_admin=;/s);
  });
});

describe('Content editor (admin password mode)', () => {
  const store = memoryStore();
  const call = (path: string, cookie: string, init: RequestInit = {}) =>
    handleAdmin(new Request(`${B}/api/admin/${path}`, { ...init, headers: { cookie, 'content-type': 'application/json' } }), path, env, store);

  it('asks for the editor login, and the site session is not enough', async () => {
    const site = await login();
    const res = await call('me', site);
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ login: 'password' });
  });

  it('rejects a wrong editor password and needs a name', async () => {
    const bad = await handleAdminLogin(new Request(`${B}/api/admin-login`, { method: 'POST', body: JSON.stringify({ name: 'Duy', password: 'x' }) }), env);
    expect(bad.status).toBe(401);
    const noName = await handleAdminLogin(new Request(`${B}/api/admin-login`, { method: 'POST', body: JSON.stringify({ name: ' ', password: 'editor-pass' }) }), env);
    expect(noName.status).toBe(400);
  });

  it('logs in, publishes, rolls back, and records who did it', async () => {
    const res = await handleAdminLogin(new Request(`${B}/api/admin-login`, { method: 'POST', body: JSON.stringify({ name: 'Duy', password: 'editor-pass' }) }), env);
    expect(res.status).toBe(200);
    const admin = cookieOf(res);
    expect(await (await call('me', admin)).json()).toEqual({ email: 'Duy' });

    expect((await handleContent(store)).status).toBe(204);
    expect((await call('publish', admin, { method: 'POST', body: JSON.stringify({ content: { version: 1 }, note: 'bad' }) })).status).toBe(400);
    const v1 = await (await call('publish', admin, { method: 'POST', body: JSON.stringify({ content: defaultContent, note: 'First rules' }) })).json();
    expect(v1).toMatchObject({ version: 1, publishedBy: 'Duy' });
    const edited = { ...defaultContent, items: defaultContent.items.slice(1) };
    await call('draft', admin, { method: 'PUT', body: JSON.stringify({ content: edited }) });
    expect((await (await call('draft', admin)).json()).updatedBy).toBe('Duy');
    await call('publish', admin, { method: 'POST', body: JSON.stringify({ content: edited, note: 'Removed one item' }) });
    expect((await (await call('draft', admin)).json()).draft).toBeNull();
    const v3 = await (await call('rollback', admin, { method: 'POST', body: JSON.stringify({ version: 1 }) })).json();
    expect(v3).toMatchObject({ version: 3, note: 'Restored version 1' });
    const live = await (await handleContent(store)).json();
    expect(live.version).toBe(3);
    expect(live.items.length).toBe(defaultContent.items.length);
    const history = await (await call('history', admin)).json();
    expect(history.versions.map((v: { version: number }) => v.version)).toEqual([3, 2, 1]);
  });

  it('a site session token cannot be used as an editor token', async () => {
    const site = (await login()).replace('lsc_session=', 'lsc_admin=');
    expect((await call('me', site)).status).toBe(401);
  });
});
