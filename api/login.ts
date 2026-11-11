import { handleLogin } from '../server/auth.js';
import { vercelEnv } from '../server/vercelEnv.js';

export function POST(request: Request): Promise<Response> {
  return handleLogin(request, vercelEnv());
}
