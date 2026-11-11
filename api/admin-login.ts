import { handleAdminLogin } from '../server/auth';
import { json } from '../server/http';
import { vercelEnv } from '../server/vercelEnv';

export const config = { runtime: 'edge' };

export default function handler(request: Request): Promise<Response> | Response {
  return request.method === 'POST' ? handleAdminLogin(request, vercelEnv()) : json({ error: 'Method not allowed' }, 405);
}
