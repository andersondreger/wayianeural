import test from 'node:test';
import assert from 'node:assert/strict';
import { eventToStatus, isEntitled, buildFinance, claimDecision, parseIngestSubscription, parseIngestTicket, normalizePhone, ticketAlertText, ticketReplyText, sendWhatsApp, buildInvoices, slimEvent, serviceTokenOk, makeRateLimiter, parseProductTokens, accessState, buildHub, signHandoff, verifyHandoff, server } from './server.mjs';

test('eventos do Asaas mapeiam para o status certo', () => {
  assert.equal(eventToStatus('PAYMENT_RECEIVED'), 'ACTIVE');
  assert.equal(eventToStatus('PAYMENT_OVERDUE'), 'PAST_DUE');
  assert.equal(eventToStatus('PAYMENT_REFUNDED'), 'CANCELED');
  assert.equal(eventToStatus('PAYMENT_CREATED'), null);
});

test('acesso so vale com ACTIVE e periodo nao vencido', () => {
  const future = new Date(Date.now() + 86400000).toISOString();
  const past = new Date(Date.now() - 86400000).toISOString();
  assert.equal(isEntitled({ status: 'ACTIVE', current_period_end: future }), true);
  assert.equal(isEntitled({ status: 'ACTIVE', current_period_end: past }), false);
  assert.equal(isEntitled({ status: 'PENDING', current_period_end: future }), false);
  assert.equal(isEntitled(undefined), false);
});

test('financeiro: conta cada cobranca uma vez e separa estorno', () => {
  const now = new Date('2026-10-15T12:00:00Z');
  const subs = [
    { email: 'a@x', product_slug: 'pet360', status: 'ACTIVE', price_cents: 14900, created_at: '2026-10-02T10:00:00Z', updated_at: '2026-10-02T10:00:00Z', asaas_subscription_id: 's1' },
    { email: 'b@x', product_slug: 'wayar', status: 'PAST_DUE', price_cents: 12900, created_at: '2026-08-02T10:00:00Z', updated_at: '2026-10-05T10:00:00Z', asaas_subscription_id: 's2' },
    { email: 'c@x', product_slug: 'wayar', status: 'CANCELED', price_cents: 12900, created_at: '2026-07-02T10:00:00Z', updated_at: '2026-10-10T10:00:00Z', asaas_subscription_id: 's3' },
    { email: 'd@x', product_slug: 'bela360', status: 'PENDING', price_cents: 9900, created_at: '2026-10-14T10:00:00Z', updated_at: '2026-10-14T10:00:00Z', asaas_subscription_id: 's4' },
  ];
  const ev = (id, event, pid, sub, cents, at) => ({ id, event, pid, asaas_subscription_id: sub, amount_cents: cents, created_at: at });
  const events = [
    ev('e1', 'PAYMENT_CONFIRMED', 'p1', 's1', 14900, '2026-10-02T11:00:00Z'),
    ev('e2', 'PAYMENT_RECEIVED', 'p1', 's1', 14900, '2026-10-03T11:00:00Z'), // mesma cobranca: nao dobra
    ev('e3', 'PAYMENT_RECEIVED', 'p2', 's3', 12900, '2026-09-20T11:00:00Z'),
    ev('e4', 'PAYMENT_REFUNDED', 'p2', 's3', 12900, '2026-10-11T11:00:00Z'),
  ];
  const f = buildFinance(subs, events, now, { pet360: 'Pet360' });
  assert.equal(f.kpis.mrrCents, 14900);
  assert.equal(f.kpis.arrCents, 14900 * 12);
  assert.equal(f.kpis.receivedThisMonthCents, 14900);
  assert.equal(f.kpis.receivedPrevMonthCents, 12900);
  assert.equal(f.kpis.refundsThisMonthCents, 12900);
  assert.equal(f.kpis.atRiskCents, 12900);
  assert.equal(f.kpis.pendingCents, 9900);
  assert.equal(f.kpis.newThisMonth, 2);
  assert.equal(f.kpis.canceledThisMonth, 1);
  assert.equal(f.kpis.churnPct, 50);
  assert.equal(f.months.length, 12);
  assert.equal(f.byProduct.find((p) => p.slug === 'pet360').name, 'Pet360');
});

test('vinculo: primeiro negocio ganha, outro com o mesmo e-mail e recusado', () => {
  assert.equal(claimDecision({ claimed_ref: null }, null), 'ok');
  assert.equal(claimDecision({ claimed_ref: null }, 'pet360:a'), 'claim');
  assert.equal(claimDecision({ claimed_ref: 'pet360:a' }, 'pet360:a'), 'ok');
  assert.equal(claimDecision({ claimed_ref: 'pet360:a' }, 'pet360:b'), 'conflict');
});

test('financeiro: plano anual entra no MRR dividido por 12 e projeto externo tem receita', () => {
  const now = new Date('2026-10-15T12:00:00Z');
  const subs = [
    { email: 'a@x', product_slug: 'criar', status: 'ACTIVE', price_cents: 89900, cycle: 'YEARLY', created_at: '2026-10-02T10:00:00Z', updated_at: '2026-10-02T10:00:00Z', asaas_subscription_id: 'c1' },
    { email: 'b@x', product_slug: 'criar', status: 'ACTIVE', price_cents: 8990, cycle: 'MONTHLY', created_at: '2026-10-03T10:00:00Z', updated_at: '2026-10-03T10:00:00Z', asaas_subscription_id: 'c2' },
  ];
  const events = [
    // mesmo pagamento chega pelo webhook central e pelo ingest: conta uma vez
    { id: 'evt_1', event: 'PAYMENT_RECEIVED', pid: 'pay_1', asaas_subscription_id: 'c1', amount_cents: 89900, created_at: '2026-10-02T11:00:00Z' },
    { id: 'ext:criar:evt_1', event: 'PAYMENT_RECEIVED', pid: 'pay_1', asaas_subscription_id: 'c1', amount_cents: 89900, created_at: '2026-10-02T11:00:01Z' },
  ];
  const f = buildFinance(subs, events, now, { criar: 'WayIA Criar' });
  assert.equal(f.kpis.mrrCents, Math.round(89900 / 12) + 8990);
  assert.equal(f.kpis.receivedThisMonthCents, 89900);
  const criar = f.byProduct.find((p) => p.slug === 'criar');
  assert.equal(criar.received12mCents, 89900);
  assert.equal(criar.active, 2);
});

test('ingest de assinatura valida e normaliza o corpo', () => {
  const ok = parseIngestSubscription({
    product: 'criar', email: 'A@X.com', status: 'ACTIVE', priceCents: 89900, cycle: 'YEARLY',
    currentPeriodEnd: '2027-10-16T00:00:00Z', asaasSubscriptionId: 'sub_1',
    event: { id: 'evt_9', event: 'PAYMENT_RECEIVED', paymentId: 'pay_9', amountCents: 89900 },
  });
  assert.equal(ok.sub.email, 'a@x.com');
  assert.equal(ok.sub.managed_by, 'external');
  assert.equal(ok.sub.cycle, 'YEARLY');
  assert.equal(ok.event.id, 'ext:criar:evt_9');
  assert.equal(ok.event.payload.payment.id, 'pay_9');
  const bad = (o) => assert.throws(() => parseIngestSubscription({ product: 'criar', email: 'a@x.com', status: 'ACTIVE', priceCents: 8990, ...o }));
  bad({ status: 'TRIAL' });
  bad({ email: 'x' });
  bad({ priceCents: 5 });
  bad({ product: 'Criar!' });
  bad({ currentPeriodEnd: 'ontem' });
  bad({ event: { id: '', event: 'X' } });
});

test('ingest de ticket exige campos e prefixa a referencia com o projeto', () => {
  const t = parseIngestTicket({ product: 'criar', email: 'a@x.com', ref: 't1', subject: 'Ajuda', message: 'Nao consigo exportar' });
  assert.equal(t.source_ref, 'criar:t1');
  assert.throws(() => parseIngestTicket({ product: 'criar', email: 'a@x.com', ref: 't1', subject: '', message: 'x' }));
});

test('telefone: normaliza para DDI 55 e rejeita lixo', () => {
  assert.equal(normalizePhone('(45) 99111-5540'), '5545991115540');
  assert.equal(normalizePhone('+55 45 3333-4444'), '554533334444');
  assert.equal(normalizePhone('5545991115540'), '5545991115540');
  assert.equal(normalizePhone('123'), null);
  assert.equal(normalizePhone(''), null);
});

test('ticket: so aceita responder por WhatsApp com telefone valido e consentimento explicito', () => {
  const base = { product: 'criar', email: 'a@x.com', ref: 't1', subject: 'Ajuda', message: 'Preciso de ajuda' };
  assert.equal(parseIngestTicket({ ...base, phone: '45991115540', whatsappOptin: true }).whatsapp_optin, true);
  assert.equal(parseIngestTicket({ ...base, phone: '45991115540' }).whatsapp_optin, false);
  assert.equal(parseIngestTicket({ ...base, phone: '45991115540', whatsappOptin: 'sim' }).whatsapp_optin, false);
  const semFone = parseIngestTicket({ ...base, phone: 'abc', whatsappOptin: true });
  assert.equal(semFone.phone, null);
  assert.equal(semFone.whatsapp_optin, false);
});

test('textos do WhatsApp trazem o essencial e cortam mensagem longa', () => {
  const t = { product_slug: 'criar', email: 'a@x.com', phone: '5545991115540', subject: 'Ajuda', message: 'x'.repeat(2000) };
  const alert = ticketAlertText(t);
  assert.match(alert, /Novo chamado/);
  assert.match(alert, /a@x.com · 5545991115540/);
  assert.ok(alert.length < 1100);
  assert.match(ticketReplyText({ subject: 'Ajuda' }, 'Resolvido!'), /"Ajuda"[\s\S]*Resolvido!/);
});

test('sendWhatsApp sem chave da Evolution nao envia nada', async () => {
  let called = false;
  assert.equal(await sendWhatsApp('5545991115540', 'oi', async () => { called = true; return new Response('{}'); }), false);
  assert.equal(called, false); // EVOLUTION_API_KEY nao definida no ambiente de teste
});

const subs = [{ asaas_subscription_id: 'sub_A', product_slug: 'pet360' }];
const ev = (id, sub, pay, extra = {}) => ({ id, event: 'PAYMENT_RECEIVED', asaas_subscription_id: sub, created_at: '2026-10-01T00:00:00Z', payload: { payment: { id: pay, value: 149, ...extra } } });

test('fatura do cliente: so cobrancas das assinaturas dele (isolamento) e uma linha por pagamento', () => {
  const inv = buildInvoices(subs, [
    ev('e1', 'sub_A', 'pay_1', { status: 'PENDING' }),
    { ...ev('e2', 'sub_A', 'pay_1', { status: 'RECEIVED', invoiceUrl: 'https://x/i' }), created_at: '2026-10-02T00:00:00Z' },
    ev('e3', 'sub_OUTRO_CLIENTE', 'pay_9'),
  ]);
  assert.equal(inv.length, 1);
  assert.equal(inv[0].status, 'RECEIVED');
  assert.equal(inv[0].amountCents, 14900);
  assert.equal(inv[0].product, 'pet360');
});

test('webhook idempotente: slimEvent e estavel e guarda so o minimo (sem dados do cliente)', () => {
  const evt = { id: 'evt_1', event: 'PAYMENT_RECEIVED', payment: { id: 'p', value: 10, customer: 'cus_1', description: 'x', creditCard: { token: 'secret' } } };
  assert.deepEqual(slimEvent(evt), slimEvent(structuredClone(evt)));
  const s = JSON.stringify(slimEvent(evt));
  assert.ok(!s.includes('secret') && !s.includes('cus_1'));
});

test('chave por produto: a do produto vale, a global e a de outro produto nao', () => {
  const tokens = parseProductTokens('pet360=aaa, imob360=bbb');
  assert.ok(serviceTokenOk('aaa', 'pet360', tokens, 'glob'));
  assert.ok(!serviceTokenOk('bbb', 'pet360', tokens, 'glob'));
  assert.ok(!serviceTokenOk('glob', 'pet360', tokens, 'glob'));
  assert.ok(serviceTokenOk('glob', 'criar', tokens, 'glob'));      // sem chave propria: cai no global
  assert.ok(!serviceTokenOk('', 'criar', tokens, ''));
});

test('rate limit: bloqueia apos o maximo e libera na proxima janela', () => {
  let t = 0;
  const lim = makeRateLimiter(2, 1000, () => t);
  assert.ok(lim('a') && lim('a') && !lim('a'));
  assert.ok(lim('b'));
  t = 1500;
  assert.ok(lim('a'));
});

test('rotas do cliente exigem login e webhook recusa token errado', async () => {
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const [m, p] of [['GET', '/me/payments'], ['GET', '/me/export'], ['POST', '/me/cancel'], ['POST', '/me/delete']]) {
      const r = await fetch(base + p, { method: m });
      assert.ok([401, 403].includes(r.status), `${m} ${p} -> ${r.status}`);
    }
    const w = await fetch(base + '/webhook/asaas', { method: 'POST', headers: { 'asaas-access-token': 'errado' }, body: '{}' });
    assert.equal(w.status, 401);
  } finally { server.close(); }
});

const NOW = new Date('2026-10-10T12:00:00Z');
const paid = { slug: 'waysend', tier: 'paid', trial_days: 11 };
const day = (n) => new Date(NOW.getTime() + n * 86_400_000).toISOString();

test('produto gratis nunca expira nem cobra', () => {
  assert.deepEqual([accessState(undefined, { tier: 'free' }, NOW).state, accessState(undefined, { tier: 'free' }, NOW).access], ['FREE', 'full']);
});

test('teste de 11 dias: libera com contagem, depois fica somente leitura', () => {
  const t = accessState({ status: 'TRIAL', trial_ends_at: day(5) }, paid, NOW);
  assert.equal(t.state, 'TRIAL'); assert.equal(t.access, 'full'); assert.equal(t.daysLeft, 5);
  const e = accessState({ status: 'TRIAL', trial_ends_at: day(-1) }, paid, NOW);
  assert.equal(e.state, 'EXPIRED'); assert.equal(e.access, 'readonly'); assert.equal(e.active, false);
});

test('pagamento aprovado cria o direito; vencido bloqueia; PAST_DUE tem carencia', () => {
  assert.equal(accessState({ status: 'ACTIVE', current_period_end: day(20), trial_ends_at: day(-30) }, paid, NOW).state, 'ACTIVE');
  assert.equal(accessState({ status: 'ACTIVE', current_period_end: day(-1) }, paid, NOW).access, 'readonly');
  assert.equal(accessState({ status: 'PAST_DUE', current_period_end: day(2) }, paid, NOW).state, 'GRACE');
  assert.equal(accessState({ status: 'CANCELED', trial_ends_at: day(5) }, paid, NOW).access, 'readonly');
  // contratou durante o teste (PENDING): continua com acesso ate o fim do teste
  assert.equal(accessState({ status: 'PENDING', trial_ends_at: day(3) }, paid, NOW).state, 'TRIAL');
});

test('sem registro: produto pago oferece o teste; produto com cobranca propria nao', () => {
  assert.equal(accessState(undefined, paid, NOW).access, 'full');
  assert.equal(accessState(undefined, { ...paid, checkout_url: 'https://x' }, NOW).access, 'none');
});

test('hub: um card por produto com o estado do cliente', () => {
  const hub = buildHub([paid, { slug: 'wayar', tier: 'free' }, { slug: 'pet360', tier: 'paid', trial_days: 11 }],
    [{ product_slug: 'waysend', status: 'TRIAL', trial_ends_at: day(2) }], NOW);
  assert.deepEqual(hub.map((h) => h.state), ['TRIAL', 'FREE', 'NONE']);
});

test('link assinado: valido, adulterado e expirado', () => {
  const tok = signHandoff('A@x.com', 'waysend', 'segredo');
  assert.deepEqual(verifyHandoff(tok, 'segredo'), { email: 'a@x.com', product: 'waysend' });
  assert.equal(verifyHandoff(tok, 'outro'), null);
  assert.equal(verifyHandoff(tok.replace(/^./, 'Z'), 'segredo'), null);
  assert.equal(verifyHandoff(signHandoff('a@x.com', 'waysend', 'segredo', 1000, Date.now() - 5000), 'segredo'), null);
  assert.equal(signHandoff('a@x.com', 'waysend', ''), null);
});
