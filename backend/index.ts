import { router, json, error, requireAuth, db } from '@appdeploy/sdk';

type Scope = 'CPF' | 'CNPJ';
type CashItem = {
  id: string;
  name: string;
  amount: number;
  kind: 'income' | 'expense';
  scope: Scope;
};
type Debt = {
  id: string;
  scope: Scope;
  source: string;
  creditor: string;
  balance: number;
  monthlyInterest: number;
  minimumPayment: number;
  overdue: boolean;
  settlementOffer?: number;
};
type FinanceData = {
  recordId?: string;
  document: string;
  scope: Scope;
  targetMonths: number;
  reservePercent: number;
  cashItems: CashItem[];
  debts: Debt[];
  updatedAt?: string;
};

const emptyFinance: FinanceData = {
  document: '',
  scope: 'CPF',
  targetMonths: 24,
  reservePercent: 5,
  cashItems: [],
  debts: [],
};

function digits(value: unknown) {
  return String(value ?? '').replace(/\D/g, '');
}
function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
function asNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function validCpf(raw: string) {
  const cpf = digits(raw);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10]);
}

function validCnpj(raw: string) {
  const cnpj = digits(raw);
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
  const check = (base: string, weights: number[]) => {
    const sum = base
      .split('')
      .reduce((s, n, i) => s + Number(n) * weights[i], 0);
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  const d1 = check(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = check(
    cnpj.slice(0, 12) + d1,
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  );
  return d1 === Number(cnpj[12]) && d2 === Number(cnpj[13]);
}

function sanitizeFinance(input: unknown): FinanceData {
  const body = (
    input && typeof input === 'object' ? input : {}
  ) as Partial<FinanceData>;
  const scope: Scope = body.scope === 'CNPJ' ? 'CNPJ' : 'CPF';
  const cashItems = Array.isArray(body.cashItems)
    ? body.cashItems.slice(0, 200).map(i => ({
        id: String(i.id || crypto.randomUUID()),
        name: String(i.name || '').slice(0, 90),
        amount: clamp(asNumber(i.amount), 0, 1_000_000_000),
        kind: i.kind === 'expense' ? ('expense' as const) : ('income' as const),
        scope: i.scope === 'CNPJ' ? ('CNPJ' as const) : ('CPF' as const),
      }))
    : [];
  const debts = Array.isArray(body.debts)
    ? body.debts.slice(0, 300).map(d => ({
        id: String(d.id || crypto.randomUUID()),
        scope: d.scope === 'CNPJ' ? ('CNPJ' as const) : ('CPF' as const),
        source: String(d.source || 'Manual').slice(0, 90),
        creditor: String(d.creditor || 'Credor').slice(0, 120),
        balance: clamp(asNumber(d.balance), 0, 1_000_000_000),
        monthlyInterest: clamp(asNumber(d.monthlyInterest), 0, 50),
        minimumPayment: clamp(asNumber(d.minimumPayment), 0, 1_000_000_000),
        overdue: Boolean(d.overdue),
        settlementOffer:
          asNumber(d.settlementOffer) > 0
            ? clamp(asNumber(d.settlementOffer), 0, 1_000_000_000)
            : undefined,
      }))
    : [];
  return {
    recordId: body.recordId ? String(body.recordId) : undefined,
    document: digits(body.document).slice(0, 14),
    scope,
    targetMonths: clamp(Math.round(asNumber(body.targetMonths) || 24), 1, 120),
    reservePercent: clamp(asNumber(body.reservePercent), 0, 50),
    cashItems,
    debts,
    updatedAt: new Date().toISOString(),
  };
}

async function readFinance(userId: string) {
  const table = 'finance:' + userId;
  const { items } = await db.list<FinanceData>(table, { limit: 1 });
  if (!items.length) return { ...emptyFinance };
  const item = items[0];
  return { ...item, recordId: item.id };
}

async function writeFinance(userId: string, input: unknown) {
  const table = 'finance:' + userId;
  const next = sanitizeFinance(input);
  const existing = await readFinance(userId);
  if (existing.recordId) {
    const record = { ...next };
    delete record.recordId;
    const [ok] = await db.update(table, [{ id: existing.recordId, record }]);
    if (!ok) throw new Error('Falha ao atualizar dados.');
    return { ...record, recordId: existing.recordId };
  }
  const record = { ...next };
  delete record.recordId;
  const [id] = await db.add(table, [record]);
  if (!id) throw new Error('Falha ao criar dados.');
  return { ...record, recordId: id };
}

function effectiveBalance(debt: Debt) {
  return debt.settlementOffer &&
    debt.settlementOffer > 0 &&
    debt.settlementOffer < debt.balance
    ? debt.settlementOffer
    : debt.balance;
}

function orderDebts(debts: Debt[]) {
  return debts
    .map(d => ({ ...d, effective: effectiveBalance(d) }))
    .sort((a, b) => {
      const urgentA =
        (a.overdue ? 100 : 0) +
        (/PGFN|Receita|tribut|fiscal/i.test(a.source) ? 50 : 0);
      const urgentB =
        (b.overdue ? 100 : 0) +
        (/PGFN|Receita|tribut|fiscal/i.test(b.source) ? 50 : 0);
      if (urgentA !== urgentB) return urgentB - urgentA;
      if (a.monthlyInterest !== b.monthlyInterest)
        return b.monthlyInterest - a.monthlyInterest;
      return a.effective - b.effective;
    });
}

function simulate(debts: Debt[], monthlyBudget: number, maxMonths: number) {
  const ordered = orderDebts(debts);
  const work = ordered.map(d => ({
    ...d,
    current: effectiveBalance(d),
    rate: d.monthlyInterest / 100,
  }));
  const schedule: Array<{
    month: number;
    label: string;
    opening: number;
    interest: number;
    payment: number;
    closing: number;
    paidOff: string[];
  }> = [];
  let interestTotal = 0;
  for (let month = 1; month <= maxMonths; month++) {
    const opening = work.reduce((s, d) => s + d.current, 0);
    if (opening <= 0.01) return { months: month - 1, interestTotal, schedule };
    let monthlyInterest = 0;
    for (const d of work) {
      if (d.current <= 0.01) continue;
      const interest = d.current * d.rate;
      d.current += interest;
      monthlyInterest += interest;
    }
    interestTotal += monthlyInterest;
    let available = monthlyBudget;
    let payment = 0;
    const paidOff: string[] = [];
    for (const d of work) {
      if (available <= 0 || d.current <= 0.01 || d.minimumPayment <= 0)
        continue;
      const p = Math.min(d.current, d.minimumPayment, available);
      d.current -= p;
      available -= p;
      payment += p;
      if (d.current <= 0.01) {
        d.current = 0;
        paidOff.push(d.creditor);
      }
    }
    for (const d of work) {
      if (available <= 0) break;
      if (d.current <= 0.01) continue;
      const p = Math.min(d.current, available);
      d.current -= p;
      available -= p;
      payment += p;
      if (d.current <= 0.01) {
        d.current = 0;
        if (!paidOff.includes(d.creditor)) paidOff.push(d.creditor);
      }
    }
    const closing = work.reduce((s, d) => s + d.current, 0);
    const date = new Date();
    date.setMonth(date.getMonth() + month - 1);
    schedule.push({
      month,
      label: date.toLocaleDateString('pt-BR', {
        month: 'short',
        year: 'numeric',
      }),
      opening,
      interest: monthlyInterest,
      payment,
      closing,
      paidOff,
    });
    if (payment <= monthlyInterest && closing >= opening - 0.01)
      return { months: null, interestTotal, schedule };
  }
  const left = work.reduce((s, d) => s + d.current, 0);
  return { months: left <= 0.01 ? maxMonths : null, interestTotal, schedule };
}

function requiredBudget(debts: Debt[], months: number) {
  if (!debts.length) return 0;
  const principal = debts.reduce((s, d) => s + effectiveBalance(d), 0);
  let low = 0;
  let high = Math.max(
    principal,
    debts.reduce((s, d) => s + d.minimumPayment, 0),
    1
  );
  for (let i = 0; i < 30; i++) {
    const result = simulate(debts, high, months);
    if (result.months !== null && result.months <= months) break;
    high *= 2;
  }
  for (let i = 0; i < 45; i++) {
    const mid = (low + high) / 2;
    const result = simulate(debts, mid, months);
    if (result.months !== null && result.months <= months) high = mid;
    else low = mid;
  }
  return Math.ceil(high * 100) / 100;
}

function buildPlan(finance: FinanceData) {
  const income = finance.cashItems
    .filter(i => i.kind === 'income')
    .reduce((s, i) => s + i.amount, 0);
  const expenses = finance.cashItems
    .filter(i => i.kind === 'expense')
    .reduce((s, i) => s + i.amount, 0);
  const reserve = (income * finance.reservePercent) / 100;
  const available = Math.max(0, income - expenses - reserve);
  const totalDebt = finance.debts.reduce((s, d) => s + effectiveBalance(d), 0);
  const required = requiredBudget(finance.debts, finance.targetMonths);
  const gap = required - available;
  const simulation = simulate(
    finance.debts,
    required,
    Math.max(finance.targetMonths, 1)
  );
  const end = new Date();
  end.setMonth(end.getMonth() + (simulation.months ?? finance.targetMonths));
  const priority = orderDebts(finance.debts).map(d => ({
    creditor: d.creditor,
    balance: d.effective,
    rate: d.monthlyInterest,
    reason: d.overdue
      ? 'Atrasada — prioridade alta'
      : d.monthlyInterest > 2
        ? 'Juros elevados'
        : /PGFN|Receita|tribut|fiscal/i.test(d.source)
          ? 'Débito fiscal'
          : 'Ordem financeira',
  }));
  const actions: string[] = [];
  if (!finance.debts.length)
    actions.push(
      'Cadastre ou importe as dívidas encontradas para gerar um cronograma real.'
    );
  if (income <= 0)
    actions.push(
      'Informe toda a renda mensal líquida disponível no CPF e no CNPJ.'
    );
  if (expenses >= income && income > 0)
    actions.push(
      'Seu caixa mensal está no limite ou negativo. Reduza custos ou aumente renda antes de assumir um acordo novo.'
    );
  if (gap > 0.01) {
    actions.push(
      'Para quitar em ' +
        finance.targetMonths +
        ' meses, gere ou economize mais ' +
        gap.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) +
        ' por mês.'
    );
    actions.push(
      'Compare propostas à vista e parceladas e priorize redução de juros antes de alongar o prazo.'
    );
  } else if (totalDebt > 0) {
    actions.push(
      'Separe ' +
        required.toLocaleString('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        }) +
        ' no início de cada mês exclusivamente para o plano.'
    );
  }
  if (finance.debts.some(d => d.overdue))
    actions.push(
      'Contate primeiro os credores marcados como atrasados e confirme saldo atualizado e condição de acordo.'
    );
  if (finance.debts.some(d => /PGFN|Receita|tribut|fiscal/i.test(d.source)))
    actions.push(
      'Valide débitos fiscais no canal oficial antes de pagar ou parcelar.'
    );
  actions.push(
    'Atualize o saldo no sistema após cada pagamento para recalcular automaticamente o prazo.'
  );
  return {
    targetMonths: finance.targetMonths,
    requiredMonthlyPayment: required,
    availableMonthlyPayment: available,
    gap,
    feasible: totalDebt > 0 && gap <= 0.01,
    projectedInterest: simulation.interestTotal,
    totalDebt,
    payoffMonths: simulation.months,
    payoffDate:
      totalDebt > 0 && simulation.months !== null
        ? end.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
        : null,
    schedule: simulation.schedule,
    priority,
    actions,
  };
}

export const handler = router({
  'GET /api/_healthcheck': [async () => json({ message: 'Success' })],
  'GET /api/finance': [
    requireAuth(),
    async ctx => json({ finance: await readFinance(ctx.user!.userId) }),
  ],
  'PUT /api/finance': [
    requireAuth(),
    async ctx => {
      try {
        return json({
          finance: await writeFinance(ctx.user!.userId, ctx.body),
        });
      } catch (e) {
        console.error(e);
        return error('Não foi possível salvar os dados.', 500);
      }
    },
  ],
  'POST /api/plan': [
    requireAuth(),
    async ctx => {
      const body = (
        ctx.body && typeof ctx.body === 'object' ? ctx.body : {}
      ) as { finance?: unknown };
      const finance = sanitizeFinance(body.finance);
      return json(buildPlan(finance));
    },
  ],
  'POST /api/scan': [
    requireAuth(),
    async ctx => {
      const body = (
        ctx.body && typeof ctx.body === 'object' ? ctx.body : {}
      ) as { document?: string; scope?: Scope };
      const scope: Scope = body.scope === 'CNPJ' ? 'CNPJ' : 'CPF';
      const document = digits(body.document);
      const valid = scope === 'CNPJ' ? validCnpj(document) : validCpf(document);
      if (!valid) return json({ document, valid: false, scope, providers: [] });
      let company: {
        name?: string;
        tradeName?: string;
        status?: string;
      } | null = null;
      if (scope === 'CNPJ') {
        try {
          const response = await fetch(
            'https://brasilapi.com.br/api/cnpj/v1/' + document,
            { signal: AbortSignal.timeout(4500) }
          );
          if (response.ok) {
            const data = (await response.json()) as {
              razao_social?: string;
              nome_fantasia?: string;
              descricao_situacao_cadastral?: string;
            };
            company = {
              name: data.razao_social,
              tradeName: data.nome_fantasia,
              status: data.descricao_situacao_cadastral,
            };
          }
        } catch (e) {
          console.warn('Consulta cadastral de CNPJ indisponível', e);
        }
      }
      return json({
        document,
        valid: true,
        scope,
        company,
        providers: [
          {
            id: 'pgfn',
            name: 'PGFN — Dívida Aberta',
            status: 'available',
            detail:
              'Consulta pública e gratuita por CPF/CNPJ para débitos em situação irregular.',
            url: 'https://www.dividaaberta.pgfn.gov.br/consultar-devedores',
          },
          {
            id: 'rfb',
            name: 'Receita Federal / e-CAC',
            status: 'protected',
            detail: 'Pendências detalhadas exigem autenticação do titular.',
            url: 'https://servicos.receitafederal.gov.br/',
          },
          {
            id: 'regularize',
            name: 'REGULARIZE',
            status: 'protected',
            detail:
              'Detalhes e negociação são acessados pelo próprio contribuinte.',
            url: 'https://www.regularize.pgfn.gov.br/',
          },
          {
            id: 'bcb',
            name: 'Banco Central / Registrato',
            status: 'protected',
            detail: 'Crédito bancário exige autenticação e consentimento.',
            url: 'https://www.bcb.gov.br/meubc/registrato',
          },
          {
            id: 'serasa',
            name: 'Serasa',
            status: 'protected',
            detail: 'Consulta do consumidor ocorre em ambiente autenticado.',
            url: 'https://www.serasa.com.br/',
          },
          {
            id: 'spc',
            name: 'SPC Brasil',
            status: 'contract',
            detail:
              'Integração automática é comercial, sem API pública gratuita.',
            url: 'https://www.spcbrasil.org.br/',
          },
        ],
      });
    },
  ],
});
