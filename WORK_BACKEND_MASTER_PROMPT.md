# MASTER PROMPT PARA CHATGPT WORK — QUITAFÁCIL / INDIMPLENCIA

## CONTEXTO DO PROJETO

Repositório: RuanMarcos38/Indimplencia

Objetivo do produto: transformar o projeto em um SaaS financeiro multiusuário, seguro e funcional para pessoas físicas, famílias e empreendedores consultarem e consolidarem débitos associados ao próprio CPF e/ou CNPJ, organizarem renda e despesas, escolherem um prazo para sair das dívidas e receberem um plano de ação e um cronograma mensal de quitação.

O frontend deve manter a identidade visual corporativa já implementada, inspirada no dashboard de referência do projeto. A prioridade desta tarefa é colocar o BACKEND, BANCO, AUTENTICAÇÃO, INTEGRAÇÕES, SINCRONIZAÇÃO, IMPORTAÇÃO DE RELATÓRIOS E MOTOR FINANCEIRO funcionando de verdade.

IMPORTANTE: não fingir integrações. Não retornar dados simulados como se fossem reais. Não fazer scraping de áreas autenticadas de gov.br, Serasa, SPC, Registrato, bancos ou outros serviços protegidos. Quando uma API oficial exigir contrato, certificado, consentimento ou credencial, implementar o conector real preparado para produção, colocar a integração em status "Aguardando credencial/contrato" e disponibilizar um fallback legítimo por importação de relatório.

---

# 1. RESULTADO FINAL OBRIGATÓRIO

Ao concluir o projeto, o usuário deve conseguir:

1. Criar conta e entrar de forma segura.
2. Cadastrar um ou mais perfis financeiros:
   - Pessoa Física / CPF.
   - Pessoa Jurídica / CNPJ.
3. Informar CPF/CNPJ e iniciar uma "Varredura Financeira".
4. O backend consultar automaticamente todas as fontes em que existir integração oficial/pública configurada.
5. Nas fontes protegidas:
   - solicitar conexão/autorização oficial quando tecnicamente disponível; OU
   - apresentar botão "Importar relatório oficial"; OU
   - apresentar "Integração disponível mediante contrato", sem inventar resultado.
6. Consolidar todos os débitos encontrados em uma única tabela normalizada.
7. Eliminar duplicidade entre fontes.
8. Identificar a origem do débito.
9. Registrar:
   - credor;
   - CPF/CNPJ;
   - tipo da dívida;
   - número de contrato/inscrição quando existir;
   - saldo principal;
   - saldo atualizado;
   - juros;
   - multa;
   - encargos;
   - parcela mínima;
   - dias em atraso;
   - vencimento;
   - data da última atualização;
   - status;
   - fonte;
   - proposta de acordo;
   - validade da oferta;
   - URL/canal oficial para negociação.
10. Cadastrar receitas.
11. Cadastrar despesas fixas e variáveis.
12. Separar fluxo financeiro de CPF e CNPJ.
13. Consolidar CPF + CNPJ quando o usuário desejar.
14. O usuário escolher um prazo alvo, por exemplo:
    - 6 meses;
    - 12 meses;
    - 18 meses;
    - 24 meses;
    - 36 meses;
    - 48 meses;
    - 60 meses;
    - prazo personalizado.
15. O sistema calcular exatamente:
    - quanto o usuário ganha;
    - quanto gasta;
    - quanto sobra;
    - reserva mínima;
    - total das dívidas;
    - juros projetados;
    - valor mensal necessário para quitar dentro do prazo escolhido;
    - diferença entre valor necessário e capacidade atual;
    - prazo real possível com a capacidade atual;
    - economia estimada com acordos cadastrados;
    - data estimada da saída das dívidas.
16. Gerar plano de ação.
17. Gerar cronograma mês a mês.
18. Recalcular automaticamente sempre que:
    - renda mudar;
    - despesa mudar;
    - dívida mudar;
    - uma dívida for paga;
    - nova dívida for sincronizada;
    - uma proposta de acordo for cadastrada;
    - o prazo alvo for alterado.
19. Registrar pagamentos realizados.
20. Mostrar evolução da dívida ao longo dos meses.
21. Gerar relatório PDF/CSV.
22. Nunca afirmar "não existem dívidas" quando uma fonte não pôde ser consultada. Exibir separadamente:
    - Consultado com sucesso;
    - Nenhum registro encontrado;
    - Consulta indisponível;
    - Requer autenticação;
    - Requer contrato;
    - Aguardando importação.

---

# 2. REGRA PRINCIPAL DAS INTEGRAÇÕES

Criar uma camada de providers. O restante do SaaS NUNCA deve depender diretamente de um fornecedor.

Interface conceitual obrigatória:

DebtProvider
- id
- name
- capabilities
- connectionStatus()
- validateConfiguration()
- authorize()
- sync(subject)
- normalize(rawData)
- healthcheck()
- lastSuccessfulSync
- lastError

Status possíveis:
- connected
- public_available
- credentials_required
- consent_required
- contract_required
- import_only
- temporarily_unavailable
- disabled

Toda integração deve escrever em sync_runs e audit_logs.

---

# 3. INTEGRAÇÕES OBRIGATÓRIAS

## 3.1 PGFN — DÍVIDA ATIVA DA UNIÃO

Implementar primeiro.

Fontes oficiais:
- Dívida Aberta / PGFN.
- API Consulta Dívida Ativa / SERPRO, quando houver credenciais contratadas.
- Dados Abertos PGFN como fallback de dados públicos compatíveis.

Comportamento:

MODO PRODUÇÃO COM API SERPRO:
- usar somente documentação oficial atual;
- autenticação oficial;
- guardar client ID/secret/certificado exclusivamente no backend/secrets manager;
- nunca enviar credencial para frontend;
- consultar por CPF/CNPJ conforme contrato;
- normalizar inscrições retornadas.

MODO GRATUITO:
- usar apenas fonte pública oficialmente permitida;
- Dados Abertos da PGFN podem ser importados/indexados;
- observar que CPF em dados abertos pode estar parcialmente mascarado;
- nunca declarar que a busca de CPF em dados abertos é completa quando não for;
- para consulta pública sem API contratada, oferecer acesso à fonte oficial e importação do resultado.

Campos desejados:
- inscrição;
- natureza;
- situação;
- valor originário;
- valor consolidado;
- data da inscrição;
- órgão de origem;
- processo;
- unidade responsável;
- tipo de débito;
- status de negociação quando disponível.

Não usar scraping do REGULARIZE autenticado.

Referências oficiais:
https://www.gov.br/pgfn/pt-br/assuntos/divida-ativa-da-uniao/transparencia-fiscal-1/divida-aberta
https://www.gov.br/pgfn/pt-br/assuntos/divida-ativa-da-uniao/transparencia-fiscal-1/dados-abertos
https://www.gov.br/conecta/catalogo/apis/consulta-divida-ativa-da-uniao
https://www.gov.br/pt-br/servicos/obter-solucao-de%20consulta-de-dados-de-divida-ativa

---

## 3.2 RECEITA FEDERAL / SERPRO — SITUAÇÃO FISCAL

Criar provider separado.

Integrações oficiais a avaliar e implementar quando contratadas:
- Integra Contador;
- Consulta CPF SERPRO;
- Consulta CNPJ SERPRO;
- Consulta CND;
- demais APIs fiscais oficialmente disponíveis no contrato.

A integração deve ser feita APENAS pela documentação atual do SERPRO/RFB.

Não criar endpoints fictícios.

Criar configuração por feature flag:
SERPRO_ENABLED=true/false
SERPRO_CLIENT_ID=
SERPRO_CLIENT_SECRET=
SERPRO_CERTIFICATE=
SERPRO_PRIVATE_KEY=
SERPRO_ENV=sandbox|production

Se não houver credenciais:
- provider deve ficar contract_required;
- frontend deve mostrar "Conectar integração SERPRO";
- permitir importação de Relatório de Situação Fiscal / documentos oficiais.

Integra Contador:
- respeitar sigilo fiscal;
- respeitar procuração eletrônica/autorização aplicável;
- não consultar contribuinte sem base legal/autorização.

Referências:
https://www.serpro.gov.br/
https://loja.serpro.gov.br/
https://www.gov.br/receitafederal/

---

## 3.3 REGULARIZE / PGFN

Não automatizar login gov.br.

Criar integração em dois níveis:

Nível público:
- Dívida Aberta / resultados públicos.

Nível contribuinte:
- apresentar fluxo de orientação e importação.
- permitir upload de PDF/CSV obtido pelo próprio usuário no REGULARIZE.
- processar relatório e converter inscrições em debts.

Se no futuro houver API oficial específica autorizada:
- implementar via provider.
- nunca usar automação de navegador para capturar senha gov.br.

---

## 3.4 SERASA

Não utilizar scraping.

Situação atual esperada:
- consulta do próprio CPF no ambiente da Serasa é autenticada;
- consulta de terceiros/empresas e soluções B2B são comerciais.

Criar SerasaProvider com dois estados:

A) sem contrato:
- import_only;
- botão "Abrir Serasa";
- botão "Importar relatório Serasa";
- importar PDF/CSV/JSON se o usuário possuir o documento;
- registrar fonte = SERASA.

B) com contrato Serasa Experian:
- guardar credenciais no backend;
- seguir exatamente documentação do produto contratado;
- integrar somente os endpoints e campos licenciados;
- registrar custo de consulta;
- exigir confirmação antes de realizar consulta que gere cobrança;
- rate limit e auditoria.

Nunca usar senha Serasa do usuário.

Fontes:
https://www.serasa.com.br/
https://www.serasaexperian.com.br/

---

## 3.5 SPC BRASIL

Criar SpcProvider.

Sem contrato:
- import_only / contract_required.
- botão para abrir canal oficial.
- importação do relatório.
- nunca simular consulta gratuita.

Com contrato:
- integrar somente API/WebService oficial fornecido ao cliente SPC/CDL;
- credenciais somente no backend;
- contabilizar consulta;
- confirmação antes de operação tarifada;
- normalizar registros.

Fonte:
https://www.spcbrasil.org.br/
https://loja.spcbrasil.com.br/

---

## 3.6 BANCO CENTRAL / REGISTRATO / SCR

Não tentar consultar Registrato apenas com CPF.

Registrato/SCR é dado protegido.

Criar BcbProvider com:
- status consent_required/import_only.

Fallback obrigatório:
- usuário baixa seu relatório SCR/Registrato;
- faz upload;
- parser extrai:
  - instituição;
  - modalidade;
  - valor;
  - situação;
  - saldo;
  - atraso, quando constar;
  - referência mensal;
- sistema converte em debts/credit_accounts.

Opcional profissional:
- integração Open Finance por parceiro/provedor homologado;
- somente com consentimento explícito do usuário;
- nunca pedir senha bancária;
- usar OAuth/consentimento oficial.

Fontes:
https://www.bcb.gov.br/meubc/registrato
https://www.bcb.gov.br/meubc/faqs/s/relatorio-de-emprestimos-e-financiamentos-scr
https://www.bcb.gov.br/estabilidadefinanceira/openfinance

---

# 4. IMPORTADOR UNIVERSAL DE RELATÓRIOS

Criar uma área chamada "Central de documentos".

Aceitar:
- PDF;
- CSV;
- XLSX;
- JSON;
- imagens somente se necessário.

Tipos:
- PGFN;
- Receita;
- REGULARIZE;
- Registrato;
- Serasa;
- SPC;
- banco;
- cartão;
- fornecedor;
- protesto;
- tributo estadual;
- tributo municipal;
- outro.

Pipeline:
1. upload;
2. antivírus/validação MIME;
3. hash SHA-256;
4. verificar duplicidade;
5. OCR somente quando necessário;
6. parser específico por tipo;
7. extrair campos;
8. mostrar tela de revisão;
9. usuário confirma;
10. persistir;
11. deduplicar;
12. recalcular plano.

Nunca inserir dívida extraída sem indicar confiança/origem.

Campos do parser:
- creditor;
- source;
- contractNumber;
- registrationNumber;
- principal;
- fees;
- fine;
- interest;
- updatedBalance;
- minimumPayment;
- dueDate;
- daysOverdue;
- settlementOffer;
- offerExpiration;
- status.

---

# 5. MODELAGEM DE BANCO DE DADOS

Usar PostgreSQL/Supabase ou PostgreSQL equivalente.

Obrigatório RLS/isolamento por usuário/tenant.

Tabelas mínimas:

profiles
- id
- user_id
- full_name
- email
- created_at

financial_subjects
- id
- user_id
- type: CPF|CNPJ
- document_encrypted
- document_hash
- display_document_masked
- legal_name
- trade_name
- active
- created_at
- updated_at

source_connections
- id
- user_id
- provider
- status
- provider_account_id
- consent_expires_at
- last_sync_at
- last_error
- metadata

sync_runs
- id
- user_id
- subject_id
- provider
- status
- started_at
- completed_at
- records_received
- records_created
- records_updated
- error_code
- error_message

debts
- id
- user_id
- subject_id
- provider
- external_id
- fingerprint
- creditor
- category
- contract_number
- registration_number
- principal_amount
- interest_amount
- fine_amount
- fee_amount
- current_balance
- interest_rate_monthly
- interest_rate_yearly
- minimum_payment
- due_date
- days_overdue
- debt_status
- is_fiscal
- is_negativated
- last_source_update_at
- created_at
- updated_at

debt_offers
- id
- debt_id
- offer_type
- cash_amount
- installment_count
- installment_amount
- entry_amount
- total_amount
- expires_at
- source
- url
- active

income_items
- id
- user_id
- subject_id nullable
- description
- amount
- frequency
- type
- is_variable
- active

expense_items
- id
- user_id
- subject_id nullable
- description
- amount
- frequency
- category
- essential
- reducible_percent
- active

payments
- id
- user_id
- debt_id
- amount
- paid_at
- source
- receipt_document_id

repayment_plans
- id
- user_id
- name
- target_months
- target_date
- reserve_percent
- strategy
- monthly_capacity
- required_monthly_amount
- gap
- total_debt
- projected_interest
- projected_total
- projected_payoff_date
- status
- snapshot_json
- created_at
- updated_at

repayment_plan_months
- id
- plan_id
- month_number
- reference_month
- opening_balance
- interest
- planned_payment
- closing_balance
- paid_off_debts_json

documents
- id
- user_id
- subject_id
- provider
- filename
- mime
- file_hash
- storage_path
- parser_status
- parser_confidence
- created_at

consents
- id
- user_id
- subject_id
- provider
- purpose
- granted_at
- expires_at
- revoked_at
- proof_json

audit_logs
- id
- user_id
- action
- entity_type
- entity_id
- provider
- ip_hash
- user_agent
- metadata
- created_at

provider_costs
- id
- provider
- sync_run_id
- user_id
- amount
- currency
- billing_reference
- created_at

---

# 6. DEDUPLICAÇÃO DE DÍVIDAS

Obrigatório.

Gerar fingerprint usando combinação normalizada de:
- documento;
- credor;
- contrato/inscrição;
- origem;
- valor aproximado;
- vencimento.

Se o mesmo débito aparecer em duas fontes:
- NÃO somar duas vezes;
- manter debt principal;
- criar debt_source_records ou provenance JSON;
- mostrar todas as fontes que confirmaram o débito;
- usar o dado mais atualizado;
- registrar divergências.

Nunca apagar informação de fonte anterior.

---

# 7. MOTOR FINANCEIRO

O motor deve ser determinístico.
Não usar LLM para cálculo matemático.

Entradas:
- renda líquida mensal;
- renda variável média;
- custos essenciais;
- custos ajustáveis;
- reserva mínima;
- dívidas;
- juros;
- pagamentos mínimos;
- acordos;
- prazo alvo;
- estratégia.

Capacidade mensal:
available_cash =
monthly_net_income
- essential_expenses
- selected_nonessential_expenses
- reserve_amount

Não permitir capacidade negativa silenciosamente.

Estratégias:
1. avalanche: maior taxa de juros primeiro;
2. snowball: menor saldo primeiro;
3. fiscal/urgência: atrasadas e fiscais com maior risco primeiro;
4. híbrida recomendada.

O motor deve calcular:
- cenário atual;
- cenário no prazo escolhido;
- cenário com acordo à vista;
- cenário com parcelamento;
- cenário sem mudança de custo;
- cenário com redução de custos;
- cenário com aumento de renda.

Para descobrir o valor mensal necessário para um prazo:
- usar simulação mês a mês;
- aplicar juros em cada dívida;
- respeitar pagamentos mínimos;
- usar busca binária para encontrar o menor pagamento mensal que zera o saldo até target_months.

Resultado:
required_monthly_payment
available_monthly_payment
monthly_gap
is_feasible
payoff_months
payoff_date
projected_interest
projected_total_paid

Se o plano não for viável:
exibir:
"Para alcançar a meta em 24 meses, você precisa liberar mais R$ X/mês."

Gerar alternativas:
- prazo mínimo possível;
- prazo com folga;
- renda extra necessária;
- redução de custo necessária;
- efeito de um acordo.

---

# 8. PLANO DE AÇÃO

Gerar regras determinísticas primeiro.

Exemplos:
- caixa negativo -> ação 1 = eliminar déficit;
- juros altos -> renegociar antes de alongar;
- proposta com desconto real -> comparar valor presente;
- dívida fiscal -> abrir canal oficial;
- dívida negativada -> mostrar prioridade de regularização;
- parcelas mínimas > capacidade -> renegociação obrigatória;
- capacidade > valor necessário -> criar reserva e antecipação.

IA pode ser usada somente para explicar o plano em linguagem simples.
O número final deve vir do motor matemático.

---

# 9. API INTERNA DO SAAS

Prefixo:
 /api/v1

Auth:
GET /me

Subjects:
GET /subjects
POST /subjects
GET /subjects/:id
PATCH /subjects/:id
DELETE /subjects/:id

Connections:
GET /connections
POST /connections/:provider/connect
POST /connections/:provider/disconnect
GET /connections/:provider/status

Sync:
POST /subjects/:id/sync
POST /subjects/:id/sync/:provider
GET /sync-runs
GET /sync-runs/:id

Debts:
GET /debts
POST /debts
GET /debts/:id
PATCH /debts/:id
DELETE /debts/:id
POST /debts/:id/refresh
GET /debts/:id/provenance

Offers:
GET /debts/:id/offers
POST /debts/:id/offers

Cashflow:
GET /income
POST /income
PATCH /income/:id
DELETE /income/:id

GET /expenses
POST /expenses
PATCH /expenses/:id
DELETE /expenses/:id

Documents:
POST /documents
GET /documents
GET /documents/:id
POST /documents/:id/parse
POST /documents/:id/confirm
DELETE /documents/:id

Plans:
POST /plans/preview
POST /plans
GET /plans
GET /plans/:id
POST /plans/:id/recalculate
GET /plans/:id/months

Payments:
POST /debts/:id/payments
GET /debts/:id/payments

Reports:
GET /reports/financial-summary.pdf
GET /reports/debts.csv
GET /reports/repayment-plan.csv

Health:
GET /health
GET /health/providers

---

# 10. FILA DE SINCRONIZAÇÃO

Não executar integrações externas pesadas dentro do request principal.

Criar jobs:
- provider_sync;
- document_parse;
- plan_recalculation;
- data_open_pgfn_refresh;
- offer_expiration_check.

Estados:
queued
running
success
partial
failed
retry_wait

Retry:
- somente erros transitórios;
- exponential backoff;
- nunca retry automático de 401/403;
- nunca ocultar 429;
- idempotency key.

---

# 11. SEGURANÇA E LGPD

Obrigatório:

- HTTPS.
- autenticação segura.
- MFA opcional.
- RLS/tenant isolation.
- criptografia de CPF/CNPJ no banco.
- hash separado para lookup/deduplicação.
- mostrar apenas documento mascarado no frontend.
- secrets fora do GitHub.
- não registrar CPF/CNPJ completo em logs.
- não registrar tokens.
- não registrar PDFs em log.
- rate limiting.
- CSRF quando aplicável.
- validação de input.
- limite de upload.
- MIME validation.
- antivírus quando disponível.
- política de retenção.
- botão excluir conta/dados.
- consentimento por provider.
- auditoria das consultas.
- registrar finalidade da consulta.
- nunca permitir consulta arbitrária de terceiros sem base/autorização adequada.

---

# 12. VARIÁVEIS DE AMBIENTE

Criar .env.example SEM valores reais.

APP_URL=
API_URL=
DATABASE_URL=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

ENCRYPTION_KEY=
DOCUMENT_HASH_PEPPER=

SERPRO_ENABLED=false
SERPRO_ENV=sandbox
SERPRO_CLIENT_ID=
SERPRO_CLIENT_SECRET=
SERPRO_CERTIFICATE_B64=
SERPRO_PRIVATE_KEY_B64=

SERASA_ENABLED=false
SERASA_API_BASE_URL=
SERASA_CLIENT_ID=
SERASA_CLIENT_SECRET=

SPC_ENABLED=false
SPC_API_BASE_URL=
SPC_CLIENT_ID=
SPC_CLIENT_SECRET=

OPEN_FINANCE_ENABLED=false
OPEN_FINANCE_PROVIDER=
OPEN_FINANCE_CLIENT_ID=
OPEN_FINANCE_CLIENT_SECRET=

STORAGE_BUCKET=
SENTRY_DSN=
LOG_LEVEL=info

Jamais versionar .env.

---

# 13. COMPORTAMENTO DO FRONTEND PARA FONTES

Cada provider deve ter um card com:

Nome
Status
Última sincronização
Quantidade de registros
Resultado
Botão principal

Exemplo:

PGFN
Conectado
Última consulta: hoje 14:32
3 inscrições
[Atualizar]

Serasa
Integração não conectada
[Importar relatório]
[Configurar integração]

Registrato
Necessita autorização/importação
[Como obter relatório]
[Importar relatório]

SPC
Integração comercial
[Configurar]
[Importar relatório]

Nunca colocar um check verde em uma fonte que não foi consultada.

---

# 14. TELA "VARREDURA FINANCEIRA"

Criar um fluxo wizard:

Etapa 1 — Identificação
- CPF
- CNPJ
- nome/empresa

Etapa 2 — Fontes
- PGFN
- Receita
- REGULARIZE
- Serasa
- SPC
- Registrato
- Open Finance
- outros

Etapa 3 — Resultado
Tabela:
Fonte | Situação | Registros | Atualizado em | Ação

Etapa 4 — Consolidar
- mostrar possíveis duplicidades;
- permitir revisar;
- confirmar débitos.

Etapa 5 — Financeiro
- renda;
- despesas;
- reserva.

Etapa 6 — Meta
"Em quanto tempo você quer quitar tudo?"

Etapa 7 — Plano
- valor por mês;
- déficit/sobra;
- data final;
- ordem de pagamento;
- ações;
- cronograma.

---

# 15. IMPORTAÇÃO DE EXTRATO BANCÁRIO

Adicionar opcionalmente:

CSV/OFX:
- detectar créditos recorrentes;
- detectar despesas recorrentes;
- sugerir renda;
- sugerir custos.

O usuário precisa confirmar antes de salvar.

Não enviar transações bancárias para LLM sem necessidade.

---

# 16. TESTES OBRIGATÓRIOS

UNIT:
- CPF validation.
- CNPJ validation.
- debt fingerprint.
- dedupe.
- interest calculation.
- payment simulation.
- required monthly payment.
- target date.
- offer comparison.

INTEGRATION:
- DB isolation.
- auth.
- provider adapter mock.
- file upload.
- parser.
- sync idempotency.
- retry behavior.

CONTRACT:
- sandbox SERPRO quando configurado.
- outros providers com sandbox/contract test quando disponível.

E2E:
1. criar usuário;
2. criar CPF;
3. cadastrar renda;
4. cadastrar custo;
5. sincronizar provider disponível;
6. importar relatório;
7. confirmar dívidas;
8. selecionar 24 meses;
9. gerar plano;
10. registrar pagamento;
11. recalcular;
12. sair e entrar novamente;
13. validar persistência.

NEGATIVE:
- CPF inválido;
- CNPJ inválido;
- usuário A não vê usuário B;
- provider offline;
- provider 401;
- provider 429;
- PDF inválido;
- arquivo duplicado;
- dívida duplicada;
- valor negativo;
- renda zero;
- custos acima da renda.

---

# 17. OBSERVABILIDADE

Implementar:
- structured logs;
- request ID;
- sync run ID;
- provider health;
- error tracking;
- métricas.

Dashboard de saúde:
Provider
Status
Latency
Last Success
Last Error
Error Rate

Não incluir PII nas métricas.

---

# 18. REGRAS DE ERRO

Mensagens técnicas nunca devem aparecer para usuário final.

Exemplo:

ERRADO:
AxiosError: status 429
ECONNRESET
SQLSTATE...

CORRETO:
"Não foi possível atualizar a PGFN agora. Sua última consulta válida foi em 30/09/2026 às 14:22. Tente novamente mais tarde."

Guardar erro técnico apenas no backend.

---

# 19. MIGRAÇÃO DO PROJETO ATUAL

Antes de alterar:

1. Ler todo o repositório.
2. Criar inventário.
3. Não quebrar frontend.
4. Não apagar funcionalidades sem substituição.
5. Não sobrescrever secrets.
6. Não versionar credenciais.
7. Criar branch:
   work/backend-production
8. Fazer commits pequenos.
9. Rodar testes.
10. Criar PR.
11. Só promover para produção depois do healthcheck.

---

# 20. ENTREGÁVEIS

O Work só deve considerar concluído quando entregar:

- código backend completo;
- migrations SQL;
- RLS;
- providers;
- importador;
- motor financeiro;
- endpoints;
- frontend conectado ao backend;
- .env.example;
- Dockerfile;
- docker-compose se necessário;
- healthchecks;
- testes;
- documentação;
- README de instalação;
- README de integrações;
- matriz de providers;
- manual de credenciais;
- script de seed DEMO sem CPF real;
- deploy;
- URL funcionando;
- relatório de testes.

Criar:
docs/ARCHITECTURE.md
docs/INTEGRATIONS.md
docs/SECURITY.md
docs/LGPD.md
docs/DEPLOY.md
docs/PROVIDERS.md
docs/FINANCIAL_ENGINE.md

---

# 21. CRITÉRIO PARA "100% FUNCIONANDO"

"100%" significa:

- backend online;
- banco online;
- autenticação online;
- dados persistentes;
- isolamento entre usuários;
- motor financeiro validado;
- importação funcionando;
- todas as fontes possuírem provider e status real;
- integrações contratadas funcionando com dados reais;
- integrações não contratadas NÃO simularem resultados;
- fallback por importação funcionando;
- healthcheck funcionando;
- testes passando;
- frontend sem erros de console críticos;
- mobile funcionando;
- nenhum secret no GitHub.

NÃO significa prometer acesso gratuito a bases que exigem pagamento, contrato, consentimento ou autenticação.

---

# 22. ORDEM DE EXECUÇÃO

FASE 1
- auditoria repo;
- banco;
- autenticação;
- schema;
- RLS.

FASE 2
- motor financeiro;
- debts;
- cashflow;
- repayment plan.

FASE 3
- PGFN provider;
- SERPRO adapter;
- provider framework.

FASE 4
- importador Receita/REGULARIZE/Registrato/Serasa/SPC.

FASE 5
- integrações comerciais preparadas.

FASE 6
- frontend conectado.

FASE 7
- testes.

FASE 8
- segurança/LGPD.

FASE 9
- deploy.

FASE 10
- QA real.

---

# 23. REGRA FINAL PARA O WORK

Não pare na criação de código.

Execute:
- instalação;
- migrações;
- configuração;
- build;
- testes;
- deploy;
- healthcheck;
- teste de login;
- teste de persistência;
- teste do plano;
- teste de consulta de providers disponíveis.

Quando uma credencial externa estiver faltando:
- não bloquear o restante da aplicação;
- marcar provider como "Aguardando credencial";
- listar exatamente a credencial necessária;
- fornecer o link oficial para contratação/configuração;
- deixar o adapter pronto;
- continuar todo o restante da implementação.

Ao final entregar uma tabela:

Módulo | Status | Testado | Produção | Pendência

E uma tabela:

Provider | Automático | Gratuito | Requer contrato | Requer consentimento | Fallback

O sistema não pode usar dados fictícios em produção.

Fim do prompt.
