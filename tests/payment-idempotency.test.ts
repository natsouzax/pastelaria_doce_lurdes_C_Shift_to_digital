import test from 'node:test';
import assert from 'node:assert/strict';
import { samePaymentRequest } from '../src/lib/payment-idempotency';

test('payment retry binds key to order and complete payload', () => {
  const previous = { order_id: 'order-a', kind: 'deposit', amount_cents: 1700,
    external_payment_received: true, note: 'Sinal recebido' };
  const input = { kind: 'deposit' as const, amount_cents: 1700,
    external_payment_received: true, note: 'Sinal recebido' };
  assert.equal(samePaymentRequest(previous, 'order-a', input), true);
  assert.equal(samePaymentRequest(previous, 'order-b', input), false);
  assert.equal(samePaymentRequest(previous, 'order-a', { ...input, amount_cents: 2400 }), false);
  assert.equal(samePaymentRequest(previous, 'order-a', { ...input, external_payment_received: false }), false);
  assert.equal(samePaymentRequest(previous, 'order-a', { ...input, note: 'Outra nota' }), false);
});
