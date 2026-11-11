import { gate } from '../server/gate';
import { securityHeaders } from '../server/http';
import type { Env } from './lib/env';

export const onRequest: PagesFunction<Env> = async (ctx) => (await gate(ctx.request, ctx.env)) ?? securityHeaders(await ctx.next());
