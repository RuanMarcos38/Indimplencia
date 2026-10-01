import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api, auth } from '@appdeploy/client';
import {
  LayoutDashboard,
  Search,
  Bell,
  ChevronDown,
  WalletCards,
  Landmark,
  ReceiptText,
  TrendingUp,
  Settings,
  LogOut,
  Menu,
  X,
  Plus,
  Trash2,
  RefreshCw,
  ShieldCheck,
  CircleDollarSign,
  CalendarDays,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Building2,
  UserRound,
  CreditCard,
  Target,
  FileSearch,
  BadgeCheck,
  ExternalLink,
} from 'lucide-react';

type Scope = 'CPF' | 'CNPJ';
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
type CashItem = {
  id: string;
  name: string;
  amount: number;
  kind: 'income' | 'expense';
  scope: Scope;
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
type PlanResult = {
  targetMonths: number;
  requiredMonthlyPayment: number;
  availableMonthlyPayment: number;
  gap: number;
  feasible: boolean;
  projectedInterest: number;
  totalDebt: number;
  payoffMonths: number | null;
  payoffDate: string | null;
  schedule: Array<{
    month: number;
    label: string;
    opening: number;
    interest: number;
    payment: number;
    closing: number;
    paidOff: string[];
  }>;
  priority: Array<{
    creditor: string;
    balance: number;
    rate: number;
    reason: string;
  }>;
  actions: string[];
};
type ScanResult = {
  document: string;
  valid: boolean;
  scope: Scope;
  company?: { name?: string; tradeName?: string; status?: string } | null;
  providers: Array<{
    id: string;
    name: string;
    status: 'available' | 'protected' | 'contract';
    detail: string;
    url: string;
  }>;
};

const emptyFinance: FinanceData = {
  document: '',
  scope: 'CPF',
  targetMonths: 24,
  reservePercent: 5,
  cashItems: [],
  debts: [],
};

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});
const pct = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });

function money(value: number) {
  return BRL.format(Number(value) || 0);
}
function num(value: string) {
  return Number(value.replace(',', '.')) || 0;
}
function uid() {
  return crypto.randomUUID();
}

function App() {
  const [user, setUser] = useState<{ name?: string; email?: string } | null>(
    null
  );
  const [finance, setFinance] = useState<FinanceData>(emptyFinance);
  const [active, setActive] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [plan, setPlan] = useState<PlanResult | null>(null);
  const [notice, setNotice] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showDebtForm, setShowDebtForm] = useState(false);

  const income = useMemo(
    () =>
      finance.cashItems
        .filter(i => i.kind === 'income')
        .reduce((s, i) => s + i.amount, 0),
    [finance.cashItems]
  );
  const expenses = useMemo(
    () =>
      finance.cashItems
        .filter(i => i.kind === 'expense')
        .reduce((s, i) => s + i.amount, 0),
    [finance.cashItems]
  );
  const debtTotal = useMemo(
    () =>
      finance.debts.reduce(
        (s, d) =>
          s +
          Math.max(
            0,
            d.settlementOffer && d.settlementOffer < d.balance
              ? d.settlementOffer
              : d.balance
          ),
        0
      ),
    [finance.debts]
  );
  const reserve = (income * finance.reservePercent) / 100;
  const freeCash = Math.max(0, income - expenses - reserve);
  const commitment = income > 0 ? Math.min(100, (expenses / income) * 100) : 0;

  useEffect(() => {
    void bootstrap();
  }, []);

  useEffect(() => {
    if (user && (finance.debts.length || income || expenses))
      void calculatePlan();
  }, [finance.targetMonths, finance.reservePercent]);

  async function bootstrap() {
    try {
      const current = await auth.getUser();
      if (!current) {
        setLoading(false);
        return;
      }
      setUser(current);
      const res = await api.get('/api/finance');
      if (res.data?.finance)
        setFinance({ ...emptyFinance, ...res.data.finance });
    } catch {
      setNotice('Não foi possível carregar seus dados agora.');
    } finally {
      setLoading(false);
    }
  }

  async function signIn() {
    try {
      const result = await auth.signIn();
      setUser(result.user);
      const res = await api.get('/api/finance');
      if (res.data?.finance)
        setFinance({ ...emptyFinance, ...res.data.finance });
    } catch (err: unknown) {
      const code =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code?: string }).code)
          : '';
      setNotice(
        code === 'popup_blocked'
          ? 'Permita pop-ups para entrar.'
          : 'Entrada cancelada ou não concluída.'
      );
    }
  }

  async function signOut() {
    await auth.signOut();
    setUser(null);
    setFinance(emptyFinance);
    setPlan(null);
    setScan(null);
  }

  async function saveFinance(next = finance) {
    setSaving(true);
    try {
      const res = await api.put('/api/finance', next);
      if (res.data?.finance) setFinance(res.data.finance);
      setNotice('Dados salvos com segurança.');
    } catch {
      setNotice('Não foi possível salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  async function runScan() {
    setNotice('');
    setScan(null);
    try {
      const res = await api.post('/api/scan', {
        document: finance.document,
        scope: finance.scope,
      });
      setScan(res.data);
      if (!res.data.valid) {
        setNotice('CPF/CNPJ inválido. Confira os números informados.');
        return;
      }
      await saveFinance(finance);
      await calculatePlan();
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? 'Não foi possível concluir a consulta.'
          : 'Falha na consulta.';
      setNotice(message);
    }
  }

  async function calculatePlan() {
    try {
      const res = await api.post('/api/plan', { finance });
      setPlan(res.data);
    } catch {
      setPlan(null);
    }
  }

  async function addCashItem(
    kind: 'income' | 'expense',
    name: string,
    amount: number,
    scope: Scope
  ) {
    const next = {
      ...finance,
      cashItems: [
        ...finance.cashItems,
        { id: uid(), kind, name, amount, scope },
      ],
    };
    setFinance(next);
    await saveFinance(next);
    await calculatePlanWith(next);
  }

  async function calculatePlanWith(next: FinanceData) {
    try {
      const res = await api.post('/api/plan', { finance: next });
      setPlan(res.data);
    } catch {
      setPlan(null);
    }
  }

  async function removeCash(id: string) {
    const next = {
      ...finance,
      cashItems: finance.cashItems.filter(i => i.id !== id),
    };
    setFinance(next);
    await saveFinance(next);
    await calculatePlanWith(next);
  }

  async function addDebt(debt: Omit<Debt, 'id'>) {
    const next = {
      ...finance,
      debts: [...finance.debts, { ...debt, id: uid() }],
    };
    setFinance(next);
    setShowDebtForm(false);
    await saveFinance(next);
    await calculatePlanWith(next);
  }

  async function removeDebt(id: string) {
    if (!confirm('Excluir esta dívida do seu plano?')) return;
    const next = { ...finance, debts: finance.debts.filter(d => d.id !== id) };
    setFinance(next);
    await saveFinance(next);
    await calculatePlanWith(next);
  }

  const nav = [
    ['dashboard', 'Visão geral', LayoutDashboard],
    ['diagnostic', 'Diagnóstico CPF/CNPJ', FileSearch],
    ['debts', 'Minhas dívidas', WalletCards],
    ['cashflow', 'Fluxo financeiro', TrendingUp],
    ['plan', 'Plano de quitação', Target],
    ['integrations', 'Integrações', Landmark],
    ['settings', 'Configurações', Settings],
  ] as const;

  if (loading)
    return (
      <div className="loading-screen">
        <RefreshCw className="spin" size={28} />
        <span>Preparando seu painel...</span>
      </div>
    );

  if (!user) {
    return (
      <div className="login-shell">
        <section className="login-card">
          <div className="logo-mark">Q</div>
          <span className="brand-name">QuitaFácil</span>
          <h1>Organize, negocie e saia das dívidas com um prazo definido.</h1>
          <p>
            Centralize CPF e CNPJ, renda, custos e débitos. O sistema calcula
            quanto você precisa pagar por mês e cria um plano objetivo de
            recuperação financeira.
          </p>
          <div className="login-points">
            <span>
              <ShieldCheck size={18} /> Seus dados ficam separados por conta.
            </span>
            <span>
              <Target size={18} /> Escolha em quantos meses quer sair do
              vermelho.
            </span>
            <span>
              <CircleDollarSign size={18} /> Veja a diferença entre sua
              capacidade atual e a necessária.
            </span>
          </div>
          <button className="primary big" onClick={signIn}>
            Entrar e começar <ArrowRight size={18} />
          </button>
          <small>
            As consultas protegidas dependem de autorização do titular ou
            contrato oficial. O sistema não inventa resultados.
          </small>
        </section>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="logo-mark small">Q</div>
          <strong>QuitaFácil</strong>
          <button
            className="mobile-close"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        <nav>
          {nav.map(([id, label, Icon]) => (
            <button
              key={id}
              className={active === id ? 'active' : ''}
              onClick={() => {
                setActive(id);
                setSidebarOpen(false);
              }}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="side-summary">
          <div className="mini-icon">
            <Target size={18} />
          </div>
          <strong>Meta atual</strong>
          <span>{finance.targetMonths} meses</span>
          <button onClick={() => setActive('plan')}>Ver meu plano</button>
        </div>
        <div className="user-box">
          <div className="avatar">
            {(user.name || user.email || 'U').slice(0, 1).toUpperCase()}
          </div>
          <div>
            <strong>{user.name || 'Minha conta'}</strong>
            <span>{user.email}</span>
          </div>
          <button title="Sair" onClick={signOut}>
            <LogOut size={17} />
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button className="menu-btn" onClick={() => setSidebarOpen(true)}>
            <Menu size={22} />
          </button>
          <div>
            <h1>
              {active === 'dashboard'
                ? `Olá, ${user.name?.split(' ')[0] || 'bem-vindo'}!`
                : nav.find(n => n[0] === active)?.[1]}
            </h1>
            <p>
              {active === 'dashboard'
                ? 'Aqui está sua situação financeira consolidada.'
                : 'Informações objetivas para sua recuperação financeira.'}
            </p>
          </div>
          <div className="top-actions">
            <div className="search-box">
              <Search size={17} />
              <input placeholder="Pesquisar no painel..." />
            </div>
            <button className="icon-circle">
              <Bell size={18} />
              <i />
            </button>
            <button className="profile-chip">
              <div className="avatar tiny">{(user.name || 'U')[0]}</div>
              <ChevronDown size={15} />
            </button>
          </div>
        </header>

        {notice && (
          <div className="notice">
            <AlertTriangle size={17} />
            <span>{notice}</span>
            <button onClick={() => setNotice('')}>
              <X size={16} />
            </button>
          </div>
        )}

        {active === 'dashboard' && (
          <>
            <div className="kpi-grid">
              <Kpi
                icon={<CircleDollarSign />}
                label="Renda mensal"
                value={money(income)}
                sub="CPF + CNPJ"
                tone="purple"
              />
              <Kpi
                icon={<ReceiptText />}
                label="Custos mensais"
                value={money(expenses)}
                sub={`${pct.format(commitment)}% da renda`}
                tone="green"
              />
              <Kpi
                icon={<WalletCards />}
                label="Dívidas mapeadas"
                value={money(debtTotal)}
                sub={`${finance.debts.length} débito(s)`}
                tone="orange"
              />
              <Kpi
                icon={<Target />}
                label="Livre para quitar"
                value={money(freeCash)}
                sub={`Meta: ${finance.targetMonths} meses`}
                tone="blue"
              />
            </div>

            <div className="dashboard-grid">
              <section className="card chart-card">
                <CardTitle
                  title="Visão financeira"
                  subtitle="Renda, custos e valor disponível"
                />
                <CashflowVisual
                  income={income}
                  expenses={expenses}
                  reserve={reserve}
                  freeCash={freeCash}
                />
              </section>

              <section className="card health-card">
                <CardTitle title="Saúde do plano" subtitle="Prazo escolhido" />
                <div
                  className={`health-score ${plan?.feasible ? 'ok' : 'warn'}`}
                >
                  <strong>
                    {plan
                      ? plan.feasible
                        ? 'VIÁVEL'
                        : 'AJUSTAR'
                      : 'SEM PLANO'}
                  </strong>
                  <span>
                    {plan
                      ? `${plan.targetMonths} meses`
                      : 'Complete seu diagnóstico'}
                  </span>
                </div>
                {plan ? (
                  <div className="health-lines">
                    <Row
                      label="Necessário por mês"
                      value={money(plan.requiredMonthlyPayment)}
                    />
                    <Row
                      label="Disponível hoje"
                      value={money(plan.availableMonthlyPayment)}
                    />
                    <Row
                      label={plan.gap > 0 ? 'Falta por mês' : 'Folga mensal'}
                      value={money(Math.abs(plan.gap))}
                      danger={plan.gap > 0}
                    />
                  </div>
                ) : (
                  <button
                    className="secondary full"
                    onClick={() => setActive('diagnostic')}
                  >
                    Fazer diagnóstico
                  </button>
                )}
              </section>

              <section className="card debts-card">
                <CardTitle
                  title="Prioridade de quitação"
                  subtitle="Ordem calculada pelo plano"
                />
                <div className="priority-list">
                  {(plan?.priority || []).slice(0, 4).map((p, i) => (
                    <div className="priority-row" key={p.creditor + i}>
                      <span className="rank">{i + 1}</span>
                      <div>
                        <strong>{p.creditor}</strong>
                        <small>{p.reason}</small>
                      </div>
                      <b>{money(p.balance)}</b>
                    </div>
                  ))}
                  {!plan?.priority.length && (
                    <Empty text="Cadastre suas dívidas para gerar a prioridade." />
                  )}
                </div>
              </section>

              <section className="card actions-card">
                <CardTitle
                  title="Próximas ações"
                  subtitle="O que fazer agora"
                />
                <div className="task-list">
                  {(
                    plan?.actions || [
                      'Informe CPF/CNPJ e faça o diagnóstico.',
                      'Cadastre sua renda e seus custos mensais.',
                      'Adicione ou importe as dívidas encontradas.',
                    ]
                  )
                    .slice(0, 4)
                    .map((a, i) => (
                      <div className="task" key={a}>
                        <span className={i < 1 ? 'done' : ''}>
                          {i < 1 ? <CheckCircle2 size={16} /> : i + 1}
                        </span>
                        <p>{a}</p>
                      </div>
                    ))}
                </div>
              </section>
            </div>
          </>
        )}

        {active === 'diagnostic' && (
          <section className="page-grid">
            <div className="card span-2">
              <CardTitle
                title="Diagnóstico financeiro por CPF/CNPJ"
                subtitle="Informe o documento e os números principais. A consulta pública disponível é verificada e o plano é calculado."
              />
              <div className="form-grid">
                <label>
                  Tipo de documento
                  <select
                    value={finance.scope}
                    onChange={e =>
                      setFinance({
                        ...finance,
                        scope: e.target.value as Scope,
                        document: '',
                      })
                    }
                  >
                    <option>CPF</option>
                    <option>CNPJ</option>
                  </select>
                </label>
                <label>
                  {finance.scope}
                  <input
                    value={finance.document}
                    onChange={e =>
                      setFinance({ ...finance, document: e.target.value })
                    }
                    placeholder={
                      finance.scope === 'CPF'
                        ? '000.000.000-00'
                        : '00.000.000/0000-00'
                    }
                  />
                </label>
                <label>
                  Prazo para quitar tudo
                  <select
                    value={finance.targetMonths}
                    onChange={e =>
                      setFinance({
                        ...finance,
                        targetMonths: Number(e.target.value),
                      })
                    }
                  >
                    {[6, 12, 18, 24, 36, 48, 60].map(m => (
                      <option key={m} value={m}>
                        {m} meses
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Reserva mensal
                  <select
                    value={finance.reservePercent}
                    onChange={e =>
                      setFinance({
                        ...finance,
                        reservePercent: Number(e.target.value),
                      })
                    }
                  >
                    {[0, 3, 5, 8, 10, 15].map(v => (
                      <option key={v} value={v}>
                        {v}% da renda
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="diagnostic-numbers">
                <div>
                  <span>Renda informada</span>
                  <strong>{money(income)}</strong>
                </div>
                <div>
                  <span>Custos informados</span>
                  <strong>{money(expenses)}</strong>
                </div>
                <div>
                  <span>Saldo de dívidas</span>
                  <strong>{money(debtTotal)}</strong>
                </div>
              </div>
              <button className="primary" onClick={runScan}>
                <FileSearch size={17} /> Analisar CPF/CNPJ e gerar plano
              </button>
            </div>

            <div className="card">
              <CardTitle
                title="Resultado da consulta"
                subtitle="Fontes oficiais e públicas"
              />
              {!scan ? (
                <Empty text="Execute o diagnóstico para ver as fontes verificadas." />
              ) : (
                <>
                  <div
                    className={`document-status ${scan.valid ? 'ok' : 'bad'}`}
                  >
                    {scan.valid ? (
                      <BadgeCheck size={22} />
                    ) : (
                      <AlertTriangle size={22} />
                    )}
                    <div>
                      <strong>
                        {scan.valid ? 'Documento válido' : 'Documento inválido'}
                      </strong>
                      <span>{scan.document}</span>
                    </div>
                  </div>
                  {scan.company && (
                    <div className="company-box">
                      <Building2 size={20} />
                      <div>
                        <strong>
                          {scan.company.tradeName || scan.company.name}
                        </strong>
                        <span>
                          {scan.company.status || 'Cadastro consultado'}
                        </span>
                      </div>
                    </div>
                  )}
                  <div className="provider-list">
                    {scan.providers.map(p => (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        key={p.id}
                        className="provider-row"
                      >
                        <span className={`provider-dot ${p.status}`} />
                        <div>
                          <strong>{p.name}</strong>
                          <small>{p.detail}</small>
                        </div>
                        <ExternalLink size={15} />
                      </a>
                    ))}
                  </div>
                </>
              )}
            </div>
          </section>
        )}

        {active === 'debts' && (
          <section className="card">
            <div className="section-head">
              <CardTitle
                title="Minhas dívidas"
                subtitle="Consolide tudo que foi encontrado no CPF e no CNPJ."
              />
              <button className="primary" onClick={() => setShowDebtForm(true)}>
                <Plus size={17} /> Nova dívida
              </button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Credor</th>
                    <th>Origem</th>
                    <th>Documento</th>
                    <th>Saldo</th>
                    <th>Juros/mês</th>
                    <th>Mínimo</th>
                    <th>Situação</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {finance.debts.map(d => (
                    <tr key={d.id}>
                      <td>
                        <strong>{d.creditor}</strong>
                      </td>
                      <td>{d.source}</td>
                      <td>{d.scope}</td>
                      <td>
                        {money(
                          d.settlementOffer && d.settlementOffer < d.balance
                            ? d.settlementOffer
                            : d.balance
                        )}
                      </td>
                      <td>{pct.format(d.monthlyInterest)}%</td>
                      <td>{money(d.minimumPayment)}</td>
                      <td>
                        <span className={`pill ${d.overdue ? 'red' : 'green'}`}>
                          {d.overdue ? 'Atrasada' : 'Em dia'}
                        </span>
                      </td>
                      <td>
                        <button
                          className="trash"
                          onClick={() => removeDebt(d.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!finance.debts.length && (
                <Empty text="Nenhuma dívida cadastrada ainda." />
              )}
            </div>
            {showDebtForm && (
              <DebtModal
                onClose={() => setShowDebtForm(false)}
                onSave={addDebt}
              />
            )}
          </section>
        )}

        {active === 'cashflow' && (
          <section className="page-grid">
            <CashCard
              title="Entradas mensais"
              kind="income"
              items={finance.cashItems.filter(i => i.kind === 'income')}
              onAdd={addCashItem}
              onRemove={removeCash}
            />
            <CashCard
              title="Custos mensais"
              kind="expense"
              items={finance.cashItems.filter(i => i.kind === 'expense')}
              onAdd={addCashItem}
              onRemove={removeCash}
            />
            <div className="card span-2">
              <CardTitle
                title="Resumo mensal"
                subtitle="Quanto realmente sobra para acelerar a quitação"
              />
              <div className="summary-grid">
                <Summary
                  label="Renda total"
                  value={money(income)}
                  tone="positive"
                />
                <Summary
                  label="Custos"
                  value={money(expenses)}
                  tone="negative"
                />
                <Summary
                  label={`Reserva (${finance.reservePercent}%)`}
                  value={money(reserve)}
                  tone="neutral"
                />
                <Summary
                  label="Livre para dívidas"
                  value={money(freeCash)}
                  tone="positive"
                />
              </div>
            </div>
          </section>
        )}

        {active === 'plan' && (
          <section className="page-grid">
            <div className="card span-2">
              <div className="section-head">
                <CardTitle
                  title="Plano de quitação por prazo"
                  subtitle="Escolha o prazo. O sistema calcula o pagamento mensal necessário."
                />
                <button className="secondary" onClick={calculatePlan}>
                  <RefreshCw size={16} /> Recalcular
                </button>
              </div>
              <div className="deadline-picker">
                {[6, 12, 18, 24, 36, 48, 60].map(m => (
                  <button
                    className={finance.targetMonths === m ? 'active' : ''}
                    key={m}
                    onClick={() => setFinance({ ...finance, targetMonths: m })}
                  >
                    {m} meses
                  </button>
                ))}
              </div>
              {plan ? (
                <>
                  <div className="plan-hero">
                    <div>
                      <span>Você precisa destinar</span>
                      <strong>
                        {money(plan.requiredMonthlyPayment)}
                        <small>/mês</small>
                      </strong>
                    </div>
                    <div
                      className={`feasibility ${plan.feasible ? 'ok' : 'bad'}`}
                    >
                      {plan.feasible ? (
                        <CheckCircle2 size={22} />
                      ) : (
                        <AlertTriangle size={22} />
                      )}
                      <div>
                        <strong>
                          {plan.feasible
                            ? 'Prazo possível'
                            : 'Prazo acima da capacidade atual'}
                        </strong>
                        <span>
                          {plan.feasible
                            ? `Folga estimada de ${money(Math.abs(plan.gap))}/mês`
                            : `Faltam ${money(plan.gap)}/mês para essa meta`}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="summary-grid three">
                    <Summary
                      label="Total mapeado"
                      value={money(plan.totalDebt)}
                      tone="neutral"
                    />
                    <Summary
                      label="Juros projetados"
                      value={money(plan.projectedInterest)}
                      tone="negative"
                    />
                    <Summary
                      label="Previsão de término"
                      value={plan.payoffDate || '—'}
                      tone="positive"
                    />
                  </div>
                </>
              ) : (
                <Empty text="Cadastre renda, custos e dívidas para gerar o plano." />
              )}
            </div>

            <div className="card">
              <CardTitle
                title="Plano de ação"
                subtitle="Ajustes para caber no prazo"
              />
              <div className="action-stack">
                {(plan?.actions || []).map((a, i) => (
                  <div key={a}>
                    <span>{i + 1}</span>
                    <p>{a}</p>
                  </div>
                ))}
                {!plan?.actions.length && (
                  <Empty text="O plano de ação aparecerá aqui." />
                )}
              </div>
            </div>

            <div className="card span-2">
              <CardTitle
                title="Fluxo de quitação mês a mês"
                subtitle="Projeção calculada considerando os juros informados"
              />
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Mês</th>
                      <th>Saldo inicial</th>
                      <th>Juros</th>
                      <th>Pagamento</th>
                      <th>Saldo final</th>
                      <th>Quitações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(plan?.schedule || []).slice(0, 36).map(r => (
                      <tr key={r.month}>
                        <td>{r.label}</td>
                        <td>{money(r.opening)}</td>
                        <td>{money(r.interest)}</td>
                        <td>
                          <strong>{money(r.payment)}</strong>
                        </td>
                        <td>{money(r.closing)}</td>
                        <td>{r.paidOff.join(', ') || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {active === 'integrations' && (
          <section className="integrations-grid">
            {[
              [
                'PGFN — Dívida Aberta',
                'Consulta pública e gratuita por CPF/CNPJ para débitos em situação irregular.',
                'Grátis / público',
                'https://www.dividaaberta.pgfn.gov.br/consultar-devedores',
                'free',
              ],
              [
                'Receita Federal / e-CAC',
                'Pendências fiscais detalhadas do titular. Exige autenticação e autorização.',
                'Protegido',
                'https://servicos.receitafederal.gov.br/',
                'protected',
              ],
              [
                'REGULARIZE',
                'Detalhes e negociação das inscrições do próprio contribuinte.',
                'Protegido',
                'https://www.regularize.pgfn.gov.br/',
                'protected',
              ],
              [
                'Banco Central / Registrato',
                'Empréstimos e financiamentos do titular, com autenticação gov.br.',
                'Protegido',
                'https://www.bcb.gov.br/meubc/registrato',
                'protected',
              ],
              [
                'Serasa',
                'Negativações e propostas do consumidor. Consulta pessoal disponível no canal oficial.',
                'Protegido',
                'https://www.serasa.com.br/',
                'protected',
              ],
              [
                'SPC Brasil',
                'Dados de birô. Integração comercial não é uma API pública gratuita.',
                'Contrato',
                'https://www.spcbrasil.org.br/',
                'contract',
              ],
            ].map(([title, detail, badge, url, tone]) => (
              <article className="integration-card" key={title}>
                <div className="integration-icon">
                  <Landmark size={22} />
                </div>
                <div>
                  <span className={`pill ${tone}`}>{badge}</span>
                  <h3>{title}</h3>
                  <p>{detail}</p>
                  <a href={url} target="_blank" rel="noreferrer">
                    Abrir fonte oficial <ExternalLink size={14} />
                  </a>
                </div>
              </article>
            ))}
          </section>
        )}

        {active === 'settings' && (
          <section className="card settings-card">
            <CardTitle
              title="Configurações do plano"
              subtitle="Preferências usadas nos cálculos"
            />
            <div className="form-grid">
              <label>
                Prazo padrão
                <select
                  value={finance.targetMonths}
                  onChange={e =>
                    setFinance({
                      ...finance,
                      targetMonths: Number(e.target.value),
                    })
                  }
                >
                  {[6, 12, 18, 24, 36, 48, 60].map(m => (
                    <option key={m} value={m}>
                      {m} meses
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Reserva mensal
                <select
                  value={finance.reservePercent}
                  onChange={e =>
                    setFinance({
                      ...finance,
                      reservePercent: Number(e.target.value),
                    })
                  }
                >
                  {[0, 3, 5, 8, 10, 15].map(v => (
                    <option key={v} value={v}>
                      {v}%
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              className="primary"
              disabled={saving}
              onClick={() => saveFinance()}
            >
              {saving ? 'Salvando...' : 'Salvar configurações'}
            </button>
          </section>
        )}
      </main>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  tone: string;
}) {
  return (
    <article className="kpi-card">
      <div className={`kpi-icon ${tone}`}>{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{sub}</small>
      </div>
    </article>
  );
}
function CardTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="card-title">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
    </div>
  );
}
function Row({
  label,
  value,
  danger,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="row">
      <span>{label}</span>
      <strong className={danger ? 'danger' : ''}>{value}</strong>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return <div className="empty">{text}</div>;
}
function Summary({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className={`summary ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function CashflowVisual({
  income,
  expenses,
  reserve,
  freeCash,
}: {
  income: number;
  expenses: number;
  reserve: number;
  freeCash: number;
}) {
  const max = Math.max(income, 1);
  const bars = [
    ['Renda', income],
    ['Custos', expenses],
    ['Reserva', reserve],
    ['Livre', freeCash],
  ] as const;
  return (
    <div className="cash-visual">
      {bars.map(([name, value]) => (
        <div className="bar-line" key={name}>
          <div>
            <span>{name}</span>
            <strong>{money(value)}</strong>
          </div>
          <div className="bar-track">
            <i style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function CashCard({
  title,
  kind,
  items,
  onAdd,
  onRemove,
}: {
  title: string;
  kind: 'income' | 'expense';
  items: CashItem[];
  onAdd: (
    kind: 'income' | 'expense',
    name: string,
    amount: number,
    scope: Scope
  ) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [scope, setScope] = useState<Scope>('CPF');
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || num(amount) <= 0) return;
    await onAdd(kind, name.trim(), num(amount), scope);
    setName('');
    setAmount('');
  }
  return (
    <section className="card">
      <CardTitle
        title={title}
        subtitle={
          kind === 'income'
            ? 'Tudo que entra de forma recorrente'
            : 'Custos fixos e essenciais'
        }
      />
      <form className="inline-form" onSubmit={submit}>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={
            kind === 'income'
              ? 'Ex.: salário, pró-labore'
              : 'Ex.: aluguel, mercado'
          }
        />
        <input
          value={amount}
          onChange={e => setAmount(e.target.value)}
          inputMode="decimal"
          placeholder="R$ 0,00"
        />
        <select value={scope} onChange={e => setScope(e.target.value as Scope)}>
          <option>CPF</option>
          <option>CNPJ</option>
        </select>
        <button className="primary square">
          <Plus size={17} />
        </button>
      </form>
      <div className="cash-list">
        {items.map(i => (
          <div key={i.id}>
            <div>
              <strong>{i.name}</strong>
              <small>{i.scope}</small>
            </div>
            <b>{money(i.amount)}</b>
            <button onClick={() => onRemove(i.id)}>
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
      {!items.length && <Empty text="Nenhum item cadastrado." />}
    </section>
  );
}

function DebtModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (debt: Omit<Debt, 'id'>) => Promise<void>;
}) {
  const [scope, setScope] = useState<Scope>('CPF');
  const [source, setSource] = useState('Banco / cartão');
  const [creditor, setCreditor] = useState('');
  const [balance, setBalance] = useState('');
  const [interest, setInterest] = useState('');
  const [minimum, setMinimum] = useState('');
  const [offer, setOffer] = useState('');
  const [overdue, setOverdue] = useState(true);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!creditor.trim() || num(balance) <= 0) return;
    await onSave({
      scope,
      source,
      creditor: creditor.trim(),
      balance: num(balance),
      monthlyInterest: num(interest),
      minimumPayment: num(minimum),
      settlementOffer: num(offer) || undefined,
      overdue,
    });
  }
  return (
    <div
      className="modal-backdrop"
      onMouseDown={e => {
        if (e.currentTarget === e.target) onClose();
      }}
    >
      <form className="modal" onSubmit={submit}>
        <div className="modal-head">
          <div>
            <h2>Nova dívida</h2>
            <p>Use o saldo atualizado do credor ou órgão.</p>
          </div>
          <button type="button" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <div className="form-grid">
          <label>
            Documento
            <select
              value={scope}
              onChange={e => setScope(e.target.value as Scope)}
            >
              <option>CPF</option>
              <option>CNPJ</option>
            </select>
          </label>
          <label>
            Origem
            <select value={source} onChange={e => setSource(e.target.value)}>
              <option>Banco / cartão</option>
              <option>PGFN / Dívida Ativa</option>
              <option>Receita Federal</option>
              <option>Serasa</option>
              <option>SPC</option>
              <option>Fornecedor</option>
              <option>Tributo estadual/municipal</option>
              <option>Outro</option>
            </select>
          </label>
          <label>
            Credor
            <input
              required
              value={creditor}
              onChange={e => setCreditor(e.target.value)}
              placeholder="Nome do credor"
            />
          </label>
          <label>
            Saldo atual
            <input
              required
              value={balance}
              onChange={e => setBalance(e.target.value)}
              inputMode="decimal"
              placeholder="0,00"
            />
          </label>
          <label>
            Juros ao mês (%)
            <input
              value={interest}
              onChange={e => setInterest(e.target.value)}
              inputMode="decimal"
              placeholder="0,00"
            />
          </label>
          <label>
            Parcela mínima
            <input
              value={minimum}
              onChange={e => setMinimum(e.target.value)}
              inputMode="decimal"
              placeholder="0,00"
            />
          </label>
          <label>
            Oferta de quitação
            <input
              value={offer}
              onChange={e => setOffer(e.target.value)}
              inputMode="decimal"
              placeholder="Opcional"
            />
          </label>
          <label>
            Atrasada?
            <select
              value={String(overdue)}
              onChange={e => setOverdue(e.target.value === 'true')}
            >
              <option value="true">Sim</option>
              <option value="false">Não</option>
            </select>
          </label>
        </div>
        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="primary">Salvar dívida</button>
        </div>
      </form>
    </div>
  );
}

export default App;
