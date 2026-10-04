import test from 'node:test';
import assert from 'node:assert/strict';
import { eventToStatus, isEntitled, buildFinance, claimDecision } from './server.mjs';

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
