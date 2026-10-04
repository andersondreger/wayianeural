import test from 'node:test';
import assert from 'node:assert/strict';
import { eventToStatus, isEntitled } from './server.mjs';

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
