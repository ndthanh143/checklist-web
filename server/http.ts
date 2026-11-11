/** Settings shared by the Cloudflare and Vercel versions of the backend. */
export interface ServerEnv {
  SITE_PASSWORD?: string;
  SESSION_SECRET?: string;
  /** Vercel: password for the Content editor (/admin). */
  ADMIN_PASSWORD?: string;
  /** Cloudflare Access (Cloudflare only). */
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  /** Optional allow-list of editor names / emails, comma-separated. */
  ADMIN_EMAILS?: string;
  /** Local development only (honoured on localhost). */
  DEV_ADMIN_EMAIL?: string;
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

export function securityHeaders(res: Response): Response {
  const out = new Response(res.body, res);
  out.headers.set('X-Content-Type-Options', 'nosniff');
  out.headers.set('X-Frame-Options', 'DENY');
  out.headers.set('Referrer-Policy', 'same-origin');
  return out;
}

export const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'same-origin',
};
