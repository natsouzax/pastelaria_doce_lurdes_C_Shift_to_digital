import test from 'node:test';
import assert from 'node:assert/strict';
import { assertStaffRole } from '../src/lib/roles';
import { ApiError } from '../src/lib/http';
import { assertLeadTime, balanceDue, cancellationRefundCents, capacityReserved, depositRequired, nextOrderStatus, parsePickup, pickupIsWithin48Hours } from '../src/lib/domain';

const now = new Date('2026-11-16T10:00:00.000Z');

test('custom lead time requires five full days; regular product requires 48 hours', () => {
  assert.doesNotThrow(() => assertLeadTime(new Date(now.getTime() + 120 * 3_600_000), 120, now));
  assert.throws(() => assertLeadTime(new Date(now.getTime() + 119 * 3_600_000), 120, now), e => e instanceof ApiError && e.code === 'PICKUP_TOO_SOON');
  assert.doesNotThrow(() => assertLeadTime(new Date(now.getTime() + 48 * 3_600_000), 48, now));
  assert.throws(() => assertLeadTime(new Date(now.getTime() + 47 * 3_600_000), 48, now), e => e instanceof ApiError && e.code === 'PICKUP_TOO_SOON');
});

test('Monday is rejected using Europe/Lisbon local calendar', () => {
  assert.throws(() => parsePickup('2026-11-23T10:00:00+00:00', now), e => e instanceof ApiError && e.code === 'MONDAY_PICKUP');
  assert.equal(parsePickup('2026-11-24T10:00:00+00:00', now).pickupDate, '2026-11-24');
  assert.throws(() => parsePickup('2026-02-31T10:00:00+00:00', now), e => e instanceof ApiError && e.code === 'VALIDATION_ERROR');
});

test('deposit and balance match the required 56 euro example', () => {
  assert.equal(depositRequired(5600, true), 1700);
  assert.equal(balanceDue(5600, 1700), 3900);
  assert.equal(depositRequired(5600, false), 0);
  assert.equal(depositRequired(5000, true), 1500);
  assert.equal(balanceDue(5600, 5700), 0);
});

test('order state derives from all item states without marking unrelated items ready', () => {
  assert.equal(nextOrderStatus('confirmed', ['to_do', 'to_do']), 'confirmed');
  assert.equal(nextOrderStatus('confirmed', ['in_progress', 'to_do']), 'in_production');
  assert.equal(nextOrderStatus('in_production', ['ready', 'in_progress']), 'in_production');
  assert.equal(nextOrderStatus('in_production', ['ready', 'ready']), 'ready');
});

test('only a confirmed personalized cake occupies a capacity slot', () => {
  assert.equal(capacityReserved('confirmed', 0), false);
  assert.equal(capacityReserved('ready', 0), false);
  assert.equal(capacityReserved('delivered', 0), false);
  assert.equal(capacityReserved('pending', 1), false);
  assert.equal(capacityReserved('cancelled', 1), false);
  assert.equal(capacityReserved('confirmed', 1), true);
  assert.equal(capacityReserved('in_production', 2), true);
});

test('48 hour refund boundary is exact', () => {
  assert.equal(pickupIsWithin48Hours(new Date(now.getTime() + 48 * 3_600_000), now), false);
  assert.equal(pickupIsWithin48Hours(new Date(now.getTime() + 48 * 3_600_000 - 1), now), true);
  assert.equal(cancellationRefundCents(1700,1700,new Date(now.getTime()+48*3_600_000),now),1700);
  assert.equal(cancellationRefundCents(1700,1700,new Date(now.getTime()+48*3_600_000-1),now),0);
  assert.throws(() => cancellationRefundCents(2000,1700,new Date(now.getTime()+72*3_600_000),now), e => e instanceof ApiError && e.code === 'PAYMENT_MISMATCH');
});

test('manager and production can advance items, but only manager can manage orders and payments', () => {
  assert.equal(assertStaffRole({ role: 'manager', active: true }, ['manager']), 'manager');
  assert.equal(assertStaffRole({ role: 'manager', active: true }, ['manager', 'production']), 'manager');
  assert.equal(assertStaffRole({ role: 'production', active: true }, ['manager', 'production']), 'production');
  assert.throws(() => assertStaffRole({ role: 'production', active: true }, ['manager']), e => e instanceof ApiError && e.status === 403);
  assert.throws(() => assertStaffRole({ role: 'manager', active: false }, ['manager']), e => e instanceof ApiError && e.status === 403);
  assert.throws(() => assertStaffRole({ role: 'production', active: false }, ['manager', 'production']), e => e instanceof ApiError && e.status === 403);
  assert.throws(() => assertStaffRole(undefined, ['production']), e => e instanceof ApiError && e.status === 403);
  assert.throws(() => assertStaffRole(undefined, ['manager', 'production']), e => e instanceof ApiError && e.status === 403);
});
