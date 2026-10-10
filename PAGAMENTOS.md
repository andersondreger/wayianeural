# Admin de pagamentos WayIA

Gateway: **Asaas** (o mesmo do WayAR: PIX, cartao, boleto, assinatura recorrente).
Servico: `payments-api/` (Node, sem dependencias) atras do nginx em `/pay-api/`.
Banco: tabelas `pay_*` no Supabase (`supabase_payments.sql`).

## Fluxo
1. Cliente clica em "Contratar" em qualquer projeto -> `https://wayia.com.br/app/?pay=<slug>`
   (slugs: `pet360`, `imob360`, `bela360`, `wayar`, `criar`, `neural`).
2. Dashboard abre em **Projetos & Planos**, confirma o e-mail por codigo, pede CPF/CNPJ e leva ao checkout Asaas.
3. Asaas chama `POST /pay-api/webhook/asaas` -> assinatura vira `ACTIVE` (acesso ate vencimento + 3 dias).
4. Cada projeto pergunta se o cliente pode entrar: 

```
GET https://wayia.com.br/pay-api/entitlement?email=<email>&product=<slug>
Header: x-service-token: <PAY_SERVICE_TOKEN>      (so no servidor do projeto!)
-> { "active": true, "status": "ACTIVE", "currentPeriodEnd": "..." }
```
   Se `active=false`, o projeto redireciona para `https://wayia.com.br/app/?pay=<slug>`.

## Quem cobra o que
- **Cobranca central (payments-api, Asaas):** pet360, imob360, criar, neural. Cada projeto consulta `/entitlement` (paywall `PAYWALL_MODE=off|warn|enforce`).
- **Cobranca propria (Asaas do projeto):** bela360 (R$97, `/assinatura`) e WayAR (97/297/897, `/dashboard/billing`) ja cobram sozinhos.
  O portal so leva o cliente para a pagina deles (`pay_products.checkout_url`), para nao criar 2a assinatura e cobrar em dobro.
  A receita deles ainda nao aparece no painel Financeiro (so a das assinaturas centrais).

## Subir na VPS
1. Rodar `supabase_payments.sql` no Supabase.
2. Preencher no `.env` da VPS: `SUPABASE_SERVICE_ROLE_KEY`, `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`, `PAY_SERVICE_TOKEN`, `ADMIN_EMAILS`.
   Comece com `ASAAS_API_BASE_URL` no sandbox.
3. No painel Asaas: webhook `https://wayia.com.br/pay-api/webhook/asaas` com o mesmo token; eventos de cobranca.
4. No Supabase, ative o login por e-mail com codigo (template "Magic Link" deve exibir `{{ .Token }}`).
5. `docker compose up -d --build`.

## Precos propostos (editaveis no admin)
Base: docs internos (imob360 R$149/349/749, pet360 Pro R$149) e mercado BR (Imobzi R$129, Trinks R$40-81, MyWebar ~US$25).
Pet360 R$149 · ImobiVision R$249 · Bela360 R$97 (preco real) · WayAR a partir de R$97 (planos reais 97/297/897) · WayIA Criar R$79 · WayFlow Neural R$197.

## Criar (cobranca propria + reporte ao painel)
O **WayIA Criar** cobra pelo checkout dele (Asaas: mensal R$ 89,90 / anual R$ 899,00, 11 dias gratis) e **reporta** ao painel:
- `POST /ingest/subscription` (header `x-service-token`): estado da assinatura + evento de pagamento. Alimenta MRR (anual = valor/12), recebido por mes, inadimplentes.
- `POST /ingest/ticket`: chamado de suporte aberto no Criar. `GET /service/tickets?email&product`: o Criar le a resposta do suporte.
- Painel (Financeiro → **Suporte**): lista e responde chamados. `GET /admin/tickets`, `POST /admin/tickets/:id/reply`.
- Produto `criar` tem `checkout_url` (portal so redireciona; nunca cria 2a assinatura).

### Suporte por WhatsApp (Evolution `evo2.wayiaflow.com.br`)
- Chamado novo → aviso 1:1 ao admin (`SUPPORT_WHATSAPP_TO`) pela instancia `SUPPORT_EVO_INSTANCE` (padrao `nucleo`).
- Resposta no painel → vai por WhatsApp ao cliente **somente se ele marcou o consentimento** no chamado (LGPD / regras do WhatsApp); sempre fica visivel no painel dele.
- Nao usa webhook de entrada: as instancias `nucleo` e a do WaySend ja tem webhook proprio e nao devem ser trocadas.

### Subir (ordem importa)
1. Rodar o final de `supabase_payments.sql` no Supabase (colunas `cycle`, `managed_by`, tabela `pay_tickets`, colunas de WhatsApp).
2. `.env`: `EVOLUTION_API_KEY`, `SUPPORT_WHATSAPP_TO`, (opcional) `SUPPORT_EVO_INSTANCE`.
3. `docker compose up -d --build`. Antes do passo 1 o servico sobe sem quebrar webhook/financeiro (sonda a migracao), mas os endpoints `/ingest/*` respondem 503.

## Area do cliente (aba "Minha Conta")
Liberada depois da compra (login por codigo no e-mail). Tudo filtrado no servidor pelo e-mail do JWT, nunca por id do front.
- `GET /me/payments`: assinaturas, faturas (1 linha por cobranca, com link do recibo/boleto) e chamados.
- `POST /me/cancel {product}`: cancela no Asaas (so assinaturas `managed_by=central`).
- `GET /me/export` e `POST /me/delete` (LGPD). Excluir exige cancelar antes as assinaturas ativas.
- Webhook guarda so o minimo do pagamento (`slimEvent`); eventos antigos ainda tem o payload completo.
- Rate limit em memoria: `/entitlement` 120/min por IP, `/me/*` 30/min por e-mail.
- Chave por produto (opcional): `PAY_SERVICE_TOKENS="pet360=tok1,imob360=tok2"`. Produto com chave propria **rejeita** o `PAY_SERVICE_TOKEN` global; os demais continuam no global. `/ingest/*` ainda usa so o global.
- Pendente: `organization_id`/multiusuario (depende da decisao de login unico).

## Gratis, teste de 11 dias e acesso por estado (substitui o "so ACTIVE libera")
Decisoes do Anderson: teste **por produto** (11 dias a partir do 1o acesso do e-mail naquele projeto, acesso completo);
gratis = **WayAR e Neural** (3o gratis ainda em aberto: `UPDATE pay_products SET tier='free' WHERE slug=...`);
teste vencido sem pagar = **somente leitura** (dados preservados, nao cria/envia).

`GET /entitlement` agora devolve `{ active, state, access, readOnly, daysLeft, trialEndsAt, currentPeriodEnd, payUrl }`:
- `state`: `FREE | TRIAL | ACTIVE | GRACE | EXPIRED | NONE` · `access`: `full | readonly | none`.
- 1a consulta de um e-mail num produto pago abre o teste sozinha (1x; o unique e-mail+produto impede repetir).
- `payUrl` leva ao Financeiro ja com um **link assinado** (`#h=`, HMAC com `HANDOFF_SECRET`, 2h, 1 e-mail + 1 produto, so billing):
  o cliente nao confirma o e-mail de novo para pagar. Faturas, LGPD e chamados continuam exigindo o codigo por e-mail.
- Checkout durante o teste cobra so no ultimo dia dele. Projeto gratis recusa checkout.
- `GET /me/hub`: um card por projeto com o estado. Aba do portal "Meu Financeiro" (`AccountPanel`).
- Sem a migracao (`supabase_payments.sql`, bloco "Gratis / teste") o servico cai no comportamento antigo.

### Integrar um projeto (modelo: `send/src/lib/paywall.ts`)
1. `.env` do projeto: `PAYWALL_MODE=off|warn|enforce`, `PAY_API_URL`, `PAY_SERVICE_TOKEN` (chave do projeto).
2. No payments-api: `PAY_SERVICE_TOKENS="waysend=<chave>"` e `HANDOFF_SECRET=<aleatorio longo>`.
3. Consultar `/entitlement?email&product&ref=<projeto>:<idDoNegocio>`; nas rotas que criam/enviam, responder 402 com `payUrl` se `access != full`.
4. Subir em `warn`, conferir, depois `enforce`. Se a API cair o projeto libera (fail-open).
Integrado: **waySend** (rotas de campanha/contatos/numeros/grupos, worker pausa campanha, faixa no painel). Falta: pet360, imob360, bela360, wayAR, Criar.
