# Plano Aberto — Organizador de Dívidas CPF e CNPJ

MVP gratuito e local-first para organizar renda, custos, dívidas e gerar um plano objetivo de quitação.

## O que já funciona

- Dashboard com renda, custos, total de dívidas e capacidade mensal de pagamento.
- Separação de receitas e despesas pessoais (CPF) e empresariais (CNPJ).
- Cadastro de dívidas com origem, credor, saldo, juros mensais, parcela mínima, atraso, oferta de quitação e observações.
- Importação de dívidas por CSV.
- Estratégias de quitação: equilibrada, maior juros primeiro (avalanche), menor saldo primeiro (bola de neve) e atrasadas/fiscais primeiro.
- Simulação mês a mês com juros, pagamentos, saldo final e mês de quitação.
- Detecção de plano inviável quando o orçamento não cobre os juros.
- Cálculo de economia potencial com ofertas de acordo.
- Checklist de consultas oficiais.
- Backup e restauração em JSON.
- Exportação do cronograma em CSV.
- Dados armazenados somente no navegador via localStorage.

## Fontes oficiais / consultas

A aplicação não solicita nem armazena senha do gov.br, Serasa ou SPC.

- Receita Federal: https://servicos.receitafederal.gov.br/
- REGULARIZE / PGFN: https://www.regularize.pgfn.gov.br/
- Banco Central / Registrato: https://www.bcb.gov.br/meubc/registrato
- Serasa: https://www.serasa.com.br/
- SPC Brasil: https://www.spcbrasil.org.br/

### Por que não existe "puxar tudo automaticamente" sem custo?

Receita/PGFN e Banco Central protegem informações individualizadas com autenticação do titular. Serasa oferece consulta do próprio CPF ao consumidor, mas não uma API pública gratuita para terceiros. SPC comercializa consultas. Por isso, o MVP usa os canais oficiais e permite cadastrar/importar os resultados sem depender de API paga ou de scraping de áreas autenticadas.

## Privacidade

O MVP é local-first. CPF, CNPJ, senhas e credenciais não são necessários para uso. Os dados cadastrados ficam no navegador do próprio usuário. Para mudar de computador, use **Exportar backup** e importe o JSON no outro dispositivo.

> Em uma futura versão multiusuário, dados financeiros devem ser armazenados com autenticação forte, criptografia, controle de acesso e política de privacidade/LGPD.

## Como executar

Não há build nem dependências.

1. Baixe ou clone o repositório.
2. Abra `index.html` em um navegador moderno.

Para desenvolvimento local:

```bash
python -m http.server 8080
```

Depois acesse `http://localhost:8080`.

## Estrutura

- `index.html` — interface.
- `styles.css` — layout responsivo.
- `app.js` — armazenamento local, cálculos, simulação, importação/exportação.

## Próximas evoluções recomendadas

1. Importação assistida de relatórios PDF/CSV emitidos pela Receita, PGFN, Registrato e Serasa.
2. Modo multiusuário opcional com Supabase (free tier), mantendo isolamento por usuário.
3. Alertas de vencimento e acompanhamento de acordos.
4. Comparador de propostas de renegociação (à vista x parcelado x juros).
5. Histórico mensal de patrimônio líquido e evolução das dívidas.
6. Relatório PDF do plano financeiro.
7. Integrações oficiais adicionais apenas quando houver API autorizada, segura e economicamente viável.

## Aviso

A ferramenta é de organização e simulação financeira. Os resultados são estimativas baseadas nos dados informados pelo usuário. Valores oficiais, juros, condições de negociação e baixa de restrições devem ser confirmados diretamente com cada credor ou órgão responsável.
