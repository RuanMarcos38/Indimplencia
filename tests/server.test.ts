import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'quitafacil-test-'));
const origin = 'http://127.0.0.1:18081';
let processHandle: ReturnType<typeof spawn>;
function start() {
  processHandle = spawn(process.execPath, ['server/index.ts'], {
    env: { ...process.env, NODE_ENV: 'test', PORT: '18081', PUBLIC_ORIGIN: origin, DATA_DIR: dir },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return new Promise<void>((resolve, reject) => {
    processHandle.once('error', reject);
    processHandle.once('exit', code => reject(new Error('Servidor encerrou: ' + code)));
    processHandle.stderr?.on('data', data => console.error(String(data)));
    processHandle.stdout?.on('data', data => { if (String(data).includes('QuitaFácil iniciado')) resolve(); });
  });
}
async function stop() {
  await new Promise<void>(resolve => { processHandle.once('exit', () => resolve()); processHandle.kill(); });
}
before(start);
after(async () => { await stop(); rmSync(dir, { recursive: true, force: true }); });
async function request(path: string, method = 'GET', body?: unknown, cookie = '', customOrigin = origin) {
  const response = await fetch(origin + path, {
    method, headers: { Origin: customOrigin, Cookie: cookie, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] || '' };
}

test('Contas isoladas, persistência após reiniciar, plano determinístico e guardrails', async () => {
  assert.equal((await request('/api/finance')).status, 401);
  assert.equal((await request('/api/auth/register', 'POST', { name: 'A', email: 'a@example.test', password: 'curta' })).status, 400);
  const a = await request('/api/auth/register', 'POST', { name: 'Pessoa A', email: 'a@example.test', password: 'senha-de-teste-A-12345' });
  const b = await request('/api/auth/register', 'POST', { name: 'Pessoa B', email: 'b@example.test', password: 'senha-de-teste-B-12345' });
  assert.equal(a.status, 201); assert.equal(b.status, 201);
  const finance = { document: '', scope: 'CPF', targetMonths: 24, reservePercent: 0,
    cashItems: [{ id: 'income', name: 'Renda de teste', kind: 'income', scope: 'CPF', amount: 5000 }],
    debts: [{ id: 'd1', creditor: 'Credor de teste', source: 'Manual', scope: 'CPF', balance: 24000,
      monthlyInterest: 0, minimumPayment: 0, overdue: false }] };
  const saved = await request('/api/finance', 'PUT', finance, a.cookie);
  assert.equal(saved.status, 200);
  const alien = await request('/api/finance', 'PUT', { ...finance, recordId: saved.body.finance.recordId, debts: [] }, b.cookie);
  assert.equal(alien.status, 200);
  assert.equal((await request('/api/finance', 'GET', undefined, a.cookie)).body.finance.debts.length, 1);
  assert.equal((await request('/api/finance', 'GET', undefined, b.cookie)).body.finance.debts.length, 0);
  const plan = await request('/api/plan', 'POST', { finance }, a.cookie);
  assert.equal(plan.status, 200); assert.equal(plan.body.requiredMonthlyPayment, 1000);
  assert.equal(plan.body.schedule.length, 24);
  const otherPlan = await request('/api/plan', 'POST', { finance: { ...finance, targetMonths: 12 } }, a.cookie);
  assert.equal(otherPlan.body.requiredMonthlyPayment, 2000);
  const badCpf = await request('/api/scan', 'POST', { document: '11111111111', scope: 'CPF' }, a.cookie);
  assert.equal(badCpf.body.valid, false);
  assert.equal((await request('/api/auth/govbr')).status, 503);
  const providers = await request('/api/providers', 'GET', undefined, a.cookie);
  assert.ok(providers.body.providers.every((provider: { automatic: boolean }) => !provider.automatic));
  assert.equal((await request('/api/finance', 'PUT', finance, a.cookie, 'https://attacker.example')).status, 403);
  await stop(); await start();
  assert.equal((await request('/api/finance', 'GET', undefined, a.cookie)).body.finance.debts.length, 1);
  assert.equal((await request('/api/auth/logout', 'POST', {}, a.cookie)).status, 200);
  assert.equal((await request('/api/finance', 'GET', undefined, a.cookie)).status, 401);
  const login = await request('/api/auth/login', 'POST', { email: 'a@example.test', password: 'senha-de-teste-A-12345' });
  assert.equal(login.status, 200);
  assert.equal((await request('/api/finance', 'GET', undefined, login.cookie)).body.finance.debts.length, 1);
});

