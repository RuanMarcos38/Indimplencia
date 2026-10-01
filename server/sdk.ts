import type { Request, Response, NextFunction } from 'express';
import { createHash } from 'node:crypto';
import { database } from './storage.ts';
export { db } from './storage.ts';

export type Context = { body: unknown; user?: { userId: string }; req: Request };
type Result = { status: number; body: unknown };
type Route = (context: Context) => Promise<Result | void> | Result | void;

export function json(body: unknown, status = 200): Result { return { status, body }; }
export function error(message: string, status = 400): Result { return json({ error: message }, status); }
export function sessionUser(req: Request) {
  const token = req.cookies?.qf_session;
  if (!token) return null;
  const hash = createHash('sha256').update(token).digest('hex');
  return database.prepare(`SELECT users.id, users.email, users.name FROM sessions
    JOIN users ON sessions.user_id = users.id WHERE sessions.hash = ? AND expires > ?`)
    .get(hash, Date.now()) as { id: string; email: string; name: string } | undefined;
}
export function requireAuth(): Route {
  return context => {
    const user = sessionUser(context.req);
    if (!user) return error('Entre na sua conta para continuar.', 401);
    context.user = { userId: user.id };
  };
}
export function router(routes: Record<string, Route[]>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const handlers = routes[req.method + ' ' + req.path];
    if (!handlers) return next();
    const context: Context = { req, body: req.body };
    try {
      for (const handler of handlers) {
        const result = await handler(context);
        if (result) return res.status(result.status).json(result.body);
      }
      return res.status(204).end();
    } catch (exception) {
      console.error('Falha interna da API:', exception instanceof Error ? exception.name : 'unknown');
      return res.status(500).json({ error: 'Não foi possível concluir a operação.' });
    }
  };
}

