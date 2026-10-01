import express from 'express';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import { randomUUID, randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { database } from './storage.ts';
import { sessionUser } from './sdk.ts';
import { handler } from '../backend/index.ts';

const app = express();
const production = process.env.NODE_ENV === 'production';
const publicOrigin = process.env.PUBLIC_ORIGIN || 'http://localhost:8080';
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin !== publicOrigin) {
    return res.status(403).json({ error: 'Origem da requisição não permitida.' });
  }
  next();
});
app.use('/api', rateLimit({ windowMs: 60_000, limit: 120, standardHeaders: 'draft-7', legacyHeaders: false }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false }));

function passwordHash(password: string) {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + scryptSync(password, salt, 64).toString('hex');
}
function verifyPassword(password: string, encoded: string) {
  const [salt, hash] = encoded.split(':');
  const expected = Buffer.from(hash, 'hex');
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
function createSession(userId: string, res: express.Response) {
  const token = randomBytes(32).toString('hex');
  const expires = Date.now() + 7 * 24 * 60 * 60_000;
  database.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());
  database.prepare('INSERT INTO sessions(hash, user_id, expires) VALUES (?, ?, ?)')
    .run(createHash('sha256').update(token).digest('hex'), userId, expires);
  res.cookie('qf_session', token, { httpOnly: true, secure: production, sameSite: 'lax',
    maxAge: expires - Date.now(), path: '/' });
}
app.get('/api/auth/user', (req, res) => res.json({ user: sessionUser(req) || null }));
app.post('/api/auth/register', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const name = String(req.body.name || '').trim().slice(0, 80);
  const password = String(req.body.password || '');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !name || password.length < 12 || password.length > 128) {
    return res.status(400).json({ error: 'Informe nome, e-mail válido e senha de 12 a 128 caracteres.' });
  }
  if (database.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
    return res.status(409).json({ error: 'Não foi possível cadastrar este e-mail. Tente entrar na sua conta.' });
  }
  const id = randomUUID();
  database.prepare('INSERT INTO users(id, email, name, password_hash) VALUES (?, ?, ?, ?)')
    .run(id, email, name, passwordHash(password));
  createSession(id, res);
  res.status(201).json({ user: { id, email, name } });
});
app.post('/api/auth/login', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  if (password.length > 128) return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
  const user = database.prepare('SELECT * FROM users WHERE email = ?').get(email) as
    { id: string; email: string; name: string; password_hash: string } | undefined;
  const dummy = '00000000000000000000000000000000:' + '00'.repeat(64);
  if (!verifyPassword(password, user?.password_hash || dummy) || !user) {
    return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
  }
  createSession(user.id, res);
  res.json({ user: { id: user.id, email: user.email, name: user.name } });
});
app.post('/api/auth/logout', (req, res) => {
  if (req.cookies.qf_session) database.prepare('DELETE FROM sessions WHERE hash = ?')
    .run(createHash('sha256').update(req.cookies.qf_session).digest('hex'));
  res.clearCookie('qf_session', { path: '/', httpOnly: true, secure: production, sameSite: 'lax' });
  res.json({ success: true });
});
app.get('/api/providers', (req, res) => {
  if (!sessionUser(req)) return res.status(401).json({ error: 'Entre na sua conta.' });
  res.json({ providers: [
    { id: 'govbr', status: 'AGUARDANDO_CREDENCIAMENTO', automatic: false,
      detail: 'Login de identidade depende de aprovação. Não consulta débitos por si só.' },
    { id: 'serasa', status: 'AGUARDANDO_CONTRATO', automatic: false,
      detail: 'Necessário contratar produto de consulta e obter documentação e credenciais correspondentes.' },
    { id: 'spc', status: 'AGUARDANDO_CONTRATO', automatic: false,
      detail: 'Necessário contratar acesso ao serviço de consultas e receber credenciais.' },
    { id: 'pgfn', status: 'CONSULTA_MANUAL', automatic: false,
      detail: 'Consultar no portal oficial e cadastrar os débitos confirmados.' },
  ] });
});
app.get('/api/auth/govbr', (_req, res) => res.status(503).json({
  error: 'Integração gov.br aguardando credenciamento e credenciais oficiais.',
  status: 'AGUARDANDO_CREDENCIAMENTO',
}));
app.use(handler);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint não encontrado.' }));
const dist = fileURLToPath(new URL('../dist/', import.meta.url));
app.use(express.static(dist, { index: 'index.html' }));
app.get('/{*path}', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
app.listen(Number(process.env.PORT || 8080), '0.0.0.0', () => console.log('QuitaFácil iniciado.'));

