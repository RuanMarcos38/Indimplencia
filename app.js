const STORAGE_KEY = "plano-aberto-v1";

const defaultState = {
  incomes: [],
  expenses: [],
  debts: [],
  settings: { reservePercent: 5, extraBudget: "", strategy: "balanced" },
  checks: { rfb:false, pgfn:false, bcb:false, serasa:false, spc:false, other:false }
};

let state = loadState();
let dialogMode = null;
let editingId = null;
let latestSimulation = null;

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const money = (n) => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(n)||0);
const number = (n) => Number(String(n ?? "").replace(",", ".")) || 0;
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)+Date.now());
const escapeHtml = (v="") => String(v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));
const monthLabel = (offset) => {
  const d = new Date();
  d.setMonth(d.getMonth()+offset);
  return d.toLocaleDateString("pt-BR",{month:"short",year:"numeric"}).replace(".","");
};

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(defaultState),
      ...parsed,
      settings:{...defaultState.settings,...(parsed.settings||{})},
      checks:{...defaultState.checks,...(parsed.checks||{})}
    };
  }catch{
    return structuredClone(defaultState);
  }
}

function saveState(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function toast(msg){
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(()=>el.classList.remove("show"),2200);
}

function totals(){
  const income = state.incomes.reduce((s,i)=>s+number(i.amount),0);
  const expenses = state.expenses.reduce((s,i)=>s+number(i.amount),0);
  const openDebts = state.debts.filter(d=>d.status!=="paid");
  const debt = openDebts.reduce((s,d)=>s+number(d.balance),0);
  const reserve = income * (number(state.settings.reservePercent)/100);
  const automaticCapacity = Math.max(0, income-expenses-reserve);
  const budgetOverride = number(state.settings.extraBudget);
  const capacity = budgetOverride>0 ? Math.min(budgetOverride, Math.max(0,income-expenses)) : automaticCapacity;
  const minimums = openDebts.reduce((s,d)=>s+number(d.minPayment),0);
  return {income,expenses,debt,reserve,capacity,minimums,openDebts};
}

function isFiscal(d){
  const t = `${d.source||""} ${d.creditor||""}`.toLowerCase();
  return /(receita|pgfn|fiscal|tribut|simples|darf|das|fgts|prefeitura|fazenda)/.test(t);
}

function effectiveBalance(d){
  const balance = number(d.balance);
  const offer = number(d.settlementOffer);
  return offer>0 && offer<balance ? offer : balance;
}

function debtSort(debts, strategy){
  const copy = debts.map(d=>({...d,_effective:effectiveBalance(d)}));
  if(strategy==="avalanche"){
    return copy.sort((a,b)=>number(b.monthlyInterest)-number(a.monthlyInterest) || a._effective-b._effective);
  }
  if(strategy==="snowball"){
    return copy.sort((a,b)=>a._effective-b._effective || number(b.monthlyInterest)-number(a.monthlyInterest));
  }
  if(strategy==="urgent"){
    return copy.sort((a,b)=>{
      const sa=(a.overdue?200:0)+(isFiscal(a)?120:0)+number(a.monthlyInterest)*5;
      const sb=(b.overdue?200:0)+(isFiscal(b)?120:0)+number(b.monthlyInterest)*5;
      return sb-sa || a._effective-b._effective;
    });
  }
  return copy.sort((a,b)=>{
    const sa=(a.overdue?120:0)+(isFiscal(a)?65:0)+number(a.monthlyInterest)*8+(a._effective<2000?10:0);
    const sb=(b.overdue?120:0)+(isFiscal(b)?65:0)+number(b.monthlyInterest)*8+(b._effective<2000?10:0);
    return sb-sa || a._effective-b._effective;
  });
}

function simulate(){
  const t = totals();
  const strategy = state.settings.strategy || "balanced";
  const ordered = debtSort(t.openDebts,strategy);
  const budget = Math.max(0,t.capacity);
  const working = ordered.map(d=>({
    ...d,
    balance: effectiveBalance(d),
    originalBalance: number(d.balance),
    rate: Math.max(0,number(d.monthlyInterest))/100
  }));

  const rows=[];
  let totalInterest=0;
  let month=0;
  let warning="";

  if(!working.length){
    return {rows,months:0,totalInterest:0,budget,ordered,warning:"",remaining:0};
  }
  if(budget<=0){
    return {rows,months:null,totalInterest:0,budget,ordered,warning:"Sua capacidade mensal para pagamento está zerada. É necessário reduzir custos, aumentar renda ou renegociar parcelas antes de projetar uma quitação.",remaining:working.reduce((s,d)=>s+d.balance,0)};
  }

  while(working.some(d=>d.balance>0.01) && month<240){
    month++;
    const start = working.reduce((s,d)=>s+d.balance,0);
    let interest=0;
    for(const d of working){
      if(d.balance<=0.01) continue;
      const i=d.balance*d.rate;
      d.balance+=i;
      interest+=i;
    }
    totalInterest+=interest;

    let available=budget;
    let paid=0;
    const paidOff=[];

    for(const d of working){
      if(available<=0 || d.balance<=0.01) continue;
      const min=number(d.minPayment);
      if(min<=0) continue;
      const p=Math.min(d.balance,min,available);
      d.balance-=p; available-=p; paid+=p;
      if(d.balance<=0.01){d.balance=0;paidOff.push(d.creditor||"Dívida");}
    }

    for(const d of working){
      if(available<=0) break;
      if(d.balance<=0.01) continue;
      const p=Math.min(d.balance,available);
      d.balance-=p; available-=p; paid+=p;
      if(d.balance<=0.01){d.balance=0;if(!paidOff.includes(d.creditor||"Dívida"))paidOff.push(d.creditor||"Dívida");}
    }

    const end=working.reduce((s,d)=>s+d.balance,0);
    rows.push({month,start,interest,payment:paid,end,paidOff:[...new Set(paidOff)]});

    if(paid<=interest && end>=start-0.01){
      warning="Com o orçamento atual, os juros podem impedir a redução do saldo. Priorize renegociação de juros/parcelas ou aumente o valor mensal destinado às dívidas.";
      break;
    }
  }

  const remaining=working.reduce((s,d)=>s+d.balance,0);
  if(month>=240 && remaining>0.01) warning="A projeção ultrapassou 20 anos. Revise juros, ofertas de acordo e o orçamento mensal.";
  return {rows,months:remaining<=0.01?month:null,totalInterest,budget,ordered,warning,remaining};
}

function strategyName(v){
  return ({balanced:"Equilibrada",avalanche:"Maior juros primeiro",snowball:"Menor saldo primeiro",urgent:"Atrasadas e fiscais primeiro"})[v]||"Equilibrada";
}

function render(){
  renderDashboard();
  renderCashflow();
  renderDebts();
  renderPlan();
  renderChecks();
  bindDynamicButtons();
}

function renderDashboard(){
  const t=totals();
  latestSimulation=simulate();

  $("#kpiIncome").textContent=money(t.income);
  $("#kpiExpenses").textContent=money(t.expenses);
  $("#kpiDebt").textContent=money(t.debt);
  $("#kpiCapacity").textContent=money(t.capacity);
  $("#debtCount").textContent=`${t.openDebts.length} dívida${t.openDebts.length===1?"":"s"} aberta${t.openDebts.length===1?"":"s"}`;
  $("#expenseRatio").textContent=t.income? `${Math.round(t.expenses/t.income*100)}% da renda`:"0% da renda";

  const commitment=t.income?Math.min(999,(t.expenses+t.minimums)/t.income*100):0;
  $("#commitmentPct").textContent=`${Math.round(commitment)}%`;
  $("#commitmentBar").style.width=`${Math.min(100,commitment)}%`;

  const badge=$("#healthBadge");
  let status="Sem dados",cls="neutral";
  if(t.income>0){
    if(t.expenses>t.income){status="Caixa negativo";cls="bad";}
    else if(t.capacity<=0){status="Sem folga";cls="bad";}
    else if(commitment>80){status="Pressionado";cls="warn";}
    else{status="Com plano possível";cls="good";}
  }
  badge.textContent=status;badge.className=`status ${cls}`;

  const insights=[];
  if(t.income===0) insights.push(["💰","Cadastre sua renda","Informe quanto entra por mês para calcular a capacidade real de pagamento."]);
  if(t.income>0 && t.expenses>t.income) insights.push(["⚠️","Déficit mensal",`Seus custos excedem a renda em ${money(t.expenses-t.income)}. O primeiro passo é zerar esse déficit.`]);
  if(t.minimums>t.capacity && t.openDebts.length) insights.push(["📉","Parcelas acima da capacidade",`Pagamentos mínimos somam ${money(t.minimums)}, acima da capacidade estimada de ${money(t.capacity)}. Renegociação é prioridade.`]);
  if(t.openDebts.some(d=>d.overdue)) insights.push(["⏰","Existem dívidas atrasadas","Priorize contato com credores e verifique propostas com desconto, especialmente quando houver juros altos."]);
  if(t.openDebts.some(d=>isFiscal(d))) insights.push(["🏛️","Há dívida fiscal cadastrada","Confira Receita/REGULARIZE para validar saldo, situação e opções oficiais de parcelamento/transação."]);
  if(!Object.values(state.checks).every(Boolean)) insights.push(["🔎","Varredura ainda incompleta","Use a área Consultas oficiais para reduzir o risco de esquecer dívidas."]);
  if(!insights.length) insights.push(["✅","Base organizada","Seus dados essenciais estão preenchidos. Acompanhe o plano e atualize saldos após pagamentos."]);

  $("#diagnosisList").innerHTML=insights.slice(0,4).map(x=>`<div class="insight"><span>${x[0]}</span><div><b>${x[1]}</b><p>${x[2]}</p></div></div>`).join("");

  const sim=latestSimulation;
  $("#payoffMonths").textContent=sim.months ?? "—";
  $("#projectedInterest").textContent=money(sim.totalInterest);
  $("#strategyLabel").textContent=strategyName(state.settings.strategy);
  if(sim.months){
    const d=new Date();d.setMonth(d.getMonth()+sim.months);
    $("#payoffDate").textContent=d.toLocaleDateString("pt-BR",{month:"long",year:"numeric"});
  }else $("#payoffDate").textContent=t.debt===0?"Sem dívidas cadastradas":"Requer ajuste";

  renderActions(t,sim);
}

function renderActions(t,sim){
  const actions=[];
  if(!Object.values(state.checks).every(Boolean)) actions.push(["Completar a varredura das dívidas","Consulte as fontes oficiais e marque o checklist conforme avançar.","Agora"]);
  if(t.income===0) actions.push(["Cadastrar renda mensal","Inclua receitas pessoais e empresariais que realmente entram no caixa.","Agora"]);
  if(t.expenses===0) actions.push(["Cadastrar custos fixos e essenciais","Inclua moradia, alimentação, folha, impostos correntes e demais despesas recorrentes.","Agora"]);
  if(t.expenses>t.income && t.income>0) actions.push(["Eliminar déficit mensal",`Corte ou gere pelo menos ${money(t.expenses-t.income)} adicionais por mês antes de acelerar pagamentos.`,"Prioridade"]);
  if(t.openDebts.length && sim.ordered[0]){
    const d=sim.ordered[0];
    actions.push([`Atacar primeiro: ${d.creditor||"dívida prioritária"}`,`Saldo de referência ${money(effectiveBalance(d))}. ${d.overdue?"Está marcada como atrasada.":""}`,"Prioridade"]);
  }
  if(t.capacity>0 && t.debt>0) actions.push(["Separar o valor das dívidas no início do mês",`Reserve ${money(t.capacity)} para o plano antes de gastos não essenciais.`,"Mensal"]);
  if(t.debt===0) actions.push(["Cadastrar todas as dívidas encontradas","Depois da varredura, inclua saldo, juros, parcela mínima e eventual oferta de acordo.","Agora"]);
  actions.push(["Atualizar o painel após cada pagamento","Marque dívidas quitadas e ajuste os saldos para manter o prazo realista.","Mensal"]);

  $("#actionPlan").innerHTML=actions.slice(0,6).map((a,i)=>`
    <div class="action-item">
      <div class="action-num">${i+1}</div>
      <div><b>${a[0]}</b><p>${a[1]}</p></div>
      <span class="status neutral">${a[2]}</span>
    </div>`).join("");
}

function renderCashflow(){
  $("#incomeList").innerHTML=state.incomes.length?state.incomes.map(i=>`
    <div class="item-row">
      <div><b>${escapeHtml(i.name)}</b><small>${escapeHtml(i.scope||"Pessoal")}</small></div>
      <strong class="money">${money(i.amount)}</strong>
      <button class="icon-btn" data-delete-income="${i.id}" aria-label="Excluir">×</button>
    </div>`).join(""):'<div class="empty">Nenhuma receita cadastrada.</div>';

  $("#expenseList").innerHTML=state.expenses.length?state.expenses.map(i=>`
    <div class="item-row">
      <div><b>${escapeHtml(i.name)}</b><small>${i.essential?"Essencial":"Ajustável"} · ${escapeHtml(i.scope||"Pessoal")}</small></div>
      <strong class="money">${money(i.amount)}</strong>
      <button class="icon-btn" data-delete-expense="${i.id}" aria-label="Excluir">×</button>
    </div>`).join(""):'<div class="empty">Nenhum custo cadastrado.</div>';

  const t=totals();
  $("#incomeTotal").textContent=money(t.income);
  $("#expenseTotal").textContent=money(t.expenses);
  $("#reservePercent").value=state.settings.reservePercent;
  $("#extraBudget").value=state.settings.extraBudget;
  $("#strategy").value=state.settings.strategy;
}

function renderDebts(){
  const body=$("#debtTableBody");
  const rows=state.debts.map(d=>`
    <tr>
      <td>${escapeHtml(d.source||"Manual")}</td>
      <td><strong>${escapeHtml(d.creditor||"Sem credor")}</strong>${d.status==="paid"?'<br><span class="tag free">Quitada</span>':""}</td>
      <td>${escapeHtml(d.scope||"CPF")}</td>
      <td class="money">${money(d.balance)}</td>
      <td>${number(d.monthlyInterest).toFixed(2).replace(".",",")}%</td>
      <td>${d.overdue?'<span class="status bad">Sim</span>':'<span class="status neutral">Não</span>'}</td>
      <td class="money">${number(d.settlementOffer)>0?money(d.settlementOffer):"—"}</td>
      <td>
        <button class="icon-btn" data-edit-debt="${d.id}" title="Editar">✎</button>
        <button class="icon-btn" data-delete-debt="${d.id}" title="Excluir">×</button>
      </td>
    </tr>`).join("");
  body.innerHTML=rows;
  $("#emptyDebts").classList.toggle("hidden",state.debts.length>0);
  $(".table-wrap").classList.toggle("hidden",state.debts.length===0);
}

function renderPlan(){
  const sim=latestSimulation||simulate();
  const t=totals();
  $("#planBudget").textContent=money(sim.budget);
  $("#planMonths").textContent=sim.months ?? "—";

  const savings=t.openDebts.reduce((s,d)=>{
    const o=number(d.settlementOffer),b=number(d.balance);
    return s+(o>0&&o<b?b-o:0);
  },0);
  $("#discountSavings").textContent=money(savings);

  $("#priorityQueue").innerHTML=sim.ordered.length?sim.ordered.map((d,i)=>`
    <div class="priority-item">
      <div class="priority-rank">${i+1}</div>
      <div>
        <b>${escapeHtml(d.creditor||"Dívida")}</b>
        <p>${escapeHtml(d.source||"Manual")} · ${escapeHtml(d.scope||"CPF")} · ${d.overdue?"atrasada":"em acompanhamento"} · juros ${number(d.monthlyInterest).toFixed(2).replace(".",",")}% a.m.</p>
      </div>
      <strong class="money">${money(effectiveBalance(d))}</strong>
    </div>`).join(""):'<div class="empty">Cadastre dívidas para gerar a ordem de quitação.</div>';

  $("#planTableBody").innerHTML=sim.rows.slice(0,36).map(r=>`
    <tr>
      <td>${monthLabel(r.month-1)}</td>
      <td class="money">${money(r.start)}</td>
      <td class="money danger-text">${money(r.interest)}</td>
      <td class="money success-text">${money(r.payment)}</td>
      <td class="money">${money(r.end)}</td>
      <td>${r.paidOff.length?escapeHtml(r.paidOff.join(", ")):"—"}</td>
    </tr>`).join("");

  const w=$("#planWarning");
  w.textContent=sim.warning || (sim.rows.length>36?"Exibindo os primeiros 36 meses. Exporte o CSV para ver o cronograma completo.":"");
  w.classList.toggle("hidden",!w.textContent);
}

function renderChecks(){
  $$("#sourceChecklist input").forEach(el=>el.checked=!!state.checks[el.dataset.check]);
}

function bindDynamicButtons(){
  $$("[data-delete-income]").forEach(b=>b.onclick=()=>{
    state.incomes=state.incomes.filter(x=>x.id!==b.dataset.deleteIncome);saveState();render();toast("Receita removida.");
  });
  $$("[data-delete-expense]").forEach(b=>b.onclick=()=>{
    state.expenses=state.expenses.filter(x=>x.id!==b.dataset.deleteExpense);saveState();render();toast("Custo removido.");
  });
  $$("[data-delete-debt]").forEach(b=>b.onclick=()=>{
    state.debts=state.debts.filter(x=>x.id!==b.dataset.deleteDebt);saveState();render();toast("Dívida removida.");
  });
  $$("[data-edit-debt]").forEach(b=>b.onclick=()=>openDebtDialog(b.dataset.editDebt));
}

function setView(id){
  $$(".view").forEach(v=>v.classList.toggle("active",v.id===id));
  $$(".nav-item").forEach(n=>n.classList.toggle("active",n.dataset.view===id));
  const labels={dashboard:"Visão geral",cashflow:"Receitas e custos",debts:"Dívidas",plan:"Plano de quitação",sources:"Consultas oficiais"};
  $("#pageTitle").textContent=labels[id]||"Plano Aberto";
  window.scrollTo({top:0,behavior:"smooth"});
}

function openDialog(mode,id=null){
  dialogMode=mode;editingId=id;
  const fields=$("#dialogFields");
  const title=$("#dialogTitle");
  const eyebrow=$("#dialogEyebrow");
  eyebrow.textContent="CADASTRO";

  if(mode==="income"){
    title.textContent="Nova receita";
    fields.innerHTML=`
      <label>Descrição<input name="name" required placeholder="Ex.: Pró-labore, salário, vendas" /></label>
      <label>Valor mensal (R$)<input name="amount" required type="number" min="0" step="0.01" /></label>
      <label>Origem<select name="scope"><option>Pessoal / CPF</option><option>Empresa / CNPJ</option><option>Outra</option></select></label>`;
  }else if(mode==="expense"){
    title.textContent="Novo custo mensal";
    fields.innerHTML=`
      <label>Descrição<input name="name" required placeholder="Ex.: Aluguel, mercado, sistema" /></label>
      <label>Valor mensal (R$)<input name="amount" required type="number" min="0" step="0.01" /></label>
      <label>Origem<select name="scope"><option>Pessoal / CPF</option><option>Empresa / CNPJ</option><option>Outra</option></select></label>
      <label>Classificação<select name="essential"><option value="true">Essencial</option><option value="false">Ajustável / pode reduzir</option></select></label>`;
  }
  $("#itemDialog").showModal();
}

function openDebtDialog(id=null){
  dialogMode="debt";editingId=id;
  const d=state.debts.find(x=>x.id===id)||{};
  $("#dialogEyebrow").textContent=id?"EDITAR DÍVIDA":"CADASTRO";
  $("#dialogTitle").textContent=id?"Editar dívida":"Nova dívida";
  $("#dialogFields").innerHTML=`
    <div class="form-grid three">
      <label>Documento
        <select name="scope">
          <option ${d.scope==="CPF"?"selected":""}>CPF</option>
          <option ${d.scope==="CNPJ"?"selected":""}>CNPJ</option>
        </select>
      </label>
      <label>Origem
        <select name="source">
          ${["Receita Federal","PGFN / REGULARIZE","Banco Central / SCR","Serasa","SPC","Banco / Cartão","Fornecedor","Protesto","Tributo estadual/municipal","Manual"].map(x=>`<option ${d.source===x?"selected":""}>${x}</option>`).join("")}
        </select>
      </label>
      <label>Status
        <select name="status">
          <option value="open" ${d.status!=="paid"?"selected":""}>Aberta</option>
          <option value="paid" ${d.status==="paid"?"selected":""}>Quitada</option>
        </select>
      </label>
    </div>
    <label>Credor / descrição<input name="creditor" required value="${escapeHtml(d.creditor||"")}" placeholder="Ex.: Banco X, Receita, fornecedor" /></label>
    <div class="form-grid three">
      <label>Saldo atual (R$)<input name="balance" required type="number" min="0" step="0.01" value="${number(d.balance)||""}" /></label>
      <label>Juros ao mês (%)<input name="monthlyInterest" type="number" min="0" step="0.01" value="${number(d.monthlyInterest)||0}" /></label>
      <label>Parcela mínima (R$)<input name="minPayment" type="number" min="0" step="0.01" value="${number(d.minPayment)||0}" /></label>
    </div>
    <div class="form-grid three">
      <label>Está atrasada?
        <select name="overdue"><option value="false" ${!d.overdue?"selected":""}>Não</option><option value="true" ${d.overdue?"selected":""}>Sim</option></select>
      </label>
      <label>Oferta para quitação (R$)<input name="settlementOffer" type="number" min="0" step="0.01" value="${number(d.settlementOffer)||""}" placeholder="Se houver" /></label>
      <label>Vencimento / referência<input name="dueDate" type="date" value="${escapeHtml(d.dueDate||"")}" /></label>
    </div>
    <label>Observações<input name="notes" value="${escapeHtml(d.notes||"")}" placeholder="Número do acordo, canal de negociação, condição..." /></label>`;
  $("#itemDialog").showModal();
}

function handleFormSubmit(e){
  e.preventDefault();
  const fd=new FormData(e.currentTarget);
  const data=Object.fromEntries(fd.entries());
  if(dialogMode==="income"){
    state.incomes.push({id:uid(),name:data.name.trim(),amount:number(data.amount),scope:data.scope});
  }else if(dialogMode==="expense"){
    state.expenses.push({id:uid(),name:data.name.trim(),amount:number(data.amount),scope:data.scope,essential:data.essential==="true"});
  }else if(dialogMode==="debt"){
    const entry={
      id:editingId||uid(),
      scope:data.scope,
      source:data.source,
      status:data.status,
      creditor:data.creditor.trim(),
      balance:number(data.balance),
      monthlyInterest:number(data.monthlyInterest),
      minPayment:number(data.minPayment),
      overdue:data.overdue==="true",
      settlementOffer:number(data.settlementOffer),
      dueDate:data.dueDate||"",
      notes:data.notes||""
    };
    if(editingId) state.debts=state.debts.map(x=>x.id===editingId?entry:x);
    else state.debts.push(entry);
  }
  saveState();$("#itemDialog").close();render();toast("Dados salvos.");
}

function download(filename,content,type="text/plain"){
  const blob=new Blob([content],{type});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download=filename;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),500);
}

function exportBackup(){
  const payload={version:1,exportedAt:new Date().toISOString(),data:state};
  download(`plano-aberto-backup-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(payload,null,2),"application/json");
  toast("Backup exportado.");
}

async function importBackup(file){
  try{
    const raw=await file.text();
    const parsed=JSON.parse(raw);
    const data=parsed.data||parsed;
    if(!data || !Array.isArray(data.incomes) || !Array.isArray(data.expenses) || !Array.isArray(data.debts)) throw new Error();
    state={...structuredClone(defaultState),...data,settings:{...defaultState.settings,...(data.settings||{})},checks:{...defaultState.checks,...(data.checks||{})}};
    saveState();render();toast("Backup importado com sucesso.");
  }catch{toast("Arquivo de backup inválido.");}
}

function csvEscape(v){
  const s=String(v??"");
  return /[;"\n"]/.test(s)?`"${s.replaceAll('"','""')}"`:s;
}

function exportPlanCsv(){
  const sim=latestSimulation||simulate();
  const rows=[["mes","saldo_inicial","juros","pagamento","saldo_final","dividas_quitadas"]];
  sim.rows.forEach(r=>rows.push([monthLabel(r.month-1),r.start.toFixed(2),r.interest.toFixed(2),r.payment.toFixed(2),r.end.toFixed(2),r.paidOff.join("|")]));
  download("cronograma-quitacao.csv","\uFEFF"+rows.map(r=>r.map(csvEscape).join(";")).join("\n"),"text/csv;charset=utf-8");
}

function debtTemplate(){
  const rows=[
    ["documento","origem","credor","saldo","juros_mes","parcela_minima","atrasada","oferta_quitacao","vencimento","observacoes"],
    ["CPF","Serasa","Exemplo Banco","2500.00","3.5","180.00","sim","1500.00","","Apague esta linha de exemplo"]
  ];
  download("modelo-dividas.csv","\uFEFF"+rows.map(r=>r.join(";")).join("\n"),"text/csv;charset=utf-8");
}

function parseCsvLine(line,delimiter){
  const out=[];let cur="";let quoted=false;
  for(let i=0;i<line.length;i++){
    const c=line[i];
    if(c==='"'){
      if(quoted && line[i+1]==='"'){cur+='"';i++;}
      else quoted=!quoted;
    }else if(c===delimiter && !quoted){out.push(cur.trim());cur="";}
    else cur+=c;
  }
  out.push(cur.trim());
  return out;
}

async function importDebtsCsv(file){
  try{
    let text=await file.text();
    text=text.replace(/^\uFEFF/,"").trim();
    const lines=text.split(/\r?\n/).filter(Boolean);
    if(lines.length<2) throw new Error();
    const delimiter=lines[0].includes(";")?";":",";
    const headers=parseCsvLine(lines[0],delimiter).map(h=>h.toLowerCase().trim());
    const get=(row,name)=>row[headers.indexOf(name)]??"";
    let added=0;
    for(const line of lines.slice(1)){
      const row=parseCsvLine(line,delimiter);
      const creditor=get(row,"credor");
      const balance=number(get(row,"saldo"));
      if(!creditor || balance<=0) continue;
      state.debts.push({
        id:uid(),
        scope:(get(row,"documento")||"CPF").toUpperCase()==="CNPJ"?"CNPJ":"CPF",
        source:get(row,"origem")||"Manual",
        creditor,
        balance,
        monthlyInterest:number(get(row,"juros_mes")),
        minPayment:number(get(row,"parcela_minima")),
        overdue:/^(sim|s|true|1)$/i.test(get(row,"atrasada")),
        settlementOffer:number(get(row,"oferta_quitacao")),
        dueDate:get(row,"vencimento")||"",
        notes:get(row,"observacoes")||"",
        status:"open"
      });added++;
    }
    if(!added) throw new Error();
    saveState();render();toast(`${added} dívida(s) importada(s).`);
  }catch{toast("CSV inválido. Use o modelo disponibilizado.");}
}

function resetAll(){
  if(!confirm("Isso apagará os dados financeiros salvos neste navegador. Deseja continuar?")) return;
  state=structuredClone(defaultState);saveState();render();toast("Dados locais apagados.");
}

$$(".nav-item").forEach(n=>n.addEventListener("click",()=>setView(n.dataset.view)));
$$("[data-view-jump]").forEach(n=>n.addEventListener("click",()=>setView(n.dataset.viewJump)));
$$("[data-action='add-debt']").forEach(b=>b.addEventListener("click",()=>openDebtDialog()));
$("#addIncome").addEventListener("click",()=>openDialog("income"));
$("#addExpense").addEventListener("click",()=>openDialog("expense"));
$("#itemForm").addEventListener("submit",handleFormSubmit);
$$("[data-close-dialog]").forEach(b=>b.addEventListener("click",()=>$("#itemDialog").close()));
$("#reservePercent").addEventListener("change",e=>{state.settings.reservePercent=Math.min(50,Math.max(0,number(e.target.value)));saveState();render();});
$("#extraBudget").addEventListener("change",e=>{state.settings.extraBudget=e.target.value;saveState();render();});
$("#strategy").addEventListener("change",e=>{state.settings.strategy=e.target.value;saveState();render();});
$("#exportData").addEventListener("click",exportBackup);
$("#importData").addEventListener("change",e=>{if(e.target.files[0]) importBackup(e.target.files[0]);e.target.value="";});
$("#downloadDebtTemplate").addEventListener("click",debtTemplate);
$("#importDebtsCsv").addEventListener("change",e=>{if(e.target.files[0]) importDebtsCsv(e.target.files[0]);e.target.value="";});
$("#downloadPlanCsv").addEventListener("click",exportPlanCsv);
$("#resetDemo").addEventListener("click",resetAll);
$$("#sourceChecklist input").forEach(el=>el.addEventListener("change",()=>{state.checks[el.dataset.check]=el.checked;saveState();renderDashboard();}));
$("#itemDialog").addEventListener("click",e=>{if(e.target===$("#itemDialog"))$("#itemDialog").close();});

render();
