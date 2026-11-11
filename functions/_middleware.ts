import { gate } from '../server/gate.js';
import { securityHeaders } from '../server/http.js';
import type { Env } from './lib/env.js';

export const onRequest: PagesFunction<Env> = async (ctx) => (await gate(ctx.request, ctx.env)) ?? securityHeaders(await ctx.next());
