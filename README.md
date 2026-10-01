# QuitaFácil — SaaS de Recuperação Financeira

Aplicação full-stack para famílias, profissionais e empreendedores organizarem dívidas de CPF e CNPJ, consolidarem fluxo de caixa e definirem um prazo objetivo para sair do vermelho.

## Aplicação publicada

https://quitafacil-u0thco.v2.appdeploy.ai/

## Fluxo principal

1. Entrar na conta.
2. Informar CPF ou CNPJ.
3. Definir o prazo desejado para quitar as dívidas.
4. Cadastrar renda mensal e custos pessoais/empresariais.
5. Consultar as fontes disponíveis e consolidar os débitos encontrados.
6. Informar saldo, juros, parcela mínima e eventual proposta de quitação.
7. Gerar o plano.
8. O sistema calcula:
   - total em dívidas;
   - caixa livre mensal;
   - reserva financeira;
   - valor mensal necessário para atingir o prazo escolhido;
   - diferença entre capacidade atual e valor necessário;
   - ordem de prioridade;
   - juros projetados;
   - cronograma mês a mês;
   - plano de ação para tornar a meta viável.

## Backend

A aplicação usa backend persistente e autenticação. Cada usuário possui dados financeiros isolados por conta.

Rotas principais:

- `GET /api/finance`
- `PUT /api/finance`
- `POST /api/scan`
- `POST /api/plan`
- `GET /api/_healthcheck`

O cálculo do plano é executado no backend e considera juros mensais, pagamentos mínimos, ofertas de quitação e priorização de débitos atrasados/fiscais.

## Consultas de CPF/CNPJ

O produto foi desenhado com o documento como ponto de entrada, mas sem inventar integrações.

### Disponível gratuitamente

**PGFN — Dívida Aberta:** consulta pública por CPF/CNPJ para inscrições em situação irregular.

### Dados protegidos

Receita Federal/e-CAC, REGULARIZE detalhado, Banco Central/Registrato, Serasa e outros dados individualizados exigem autenticação, consentimento do titular ou contratação oficial. O sistema apresenta os conectores e permite consolidar os resultados no plano.

### SPC / APIs comerciais

Não é utilizada falsa API gratuita. Quando a fonte exige contratação, o sistema identifica isso de forma explícita.

## Frontend

React + Vite + Tailwind, com painel corporativo responsivo inspirado no layout de referência:

- menu lateral;
- cards de indicadores;
- visão financeira;
- diagnóstico CPF/CNPJ;
- fluxo financeiro;
- gestão de dívidas;
- plano por prazo;
- integrações;
- configurações;
- interface mobile.

## Estrutura

- `src/App.tsx` — interface e fluxos do SaaS.
- `src/index.css` — identidade visual responsiva.
- `backend/index.ts` — API, persistência, validação de documentos e motor financeiro.
- `appdeploy.auth-login.json` — autenticação.
- `tests/tests.json` — testes dos fluxos críticos.

## Segurança

- Nenhuma senha de gov.br, Serasa ou SPC é armazenada.
- Dados persistidos são separados pelo identificador autenticado do usuário.
- As rotas financeiras exigem autenticação.
- Consultas protegidas só devem ser integradas por meios oficiais e autorizados.

## Observação

O QuitaFácil é uma ferramenta de organização e simulação. O saldo oficial, juros, descontos, validade de propostas, certidões e baixa de restrições devem ser confirmados com o credor ou órgão responsável.
