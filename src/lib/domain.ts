import { ApiError } from './http';

export const LISBON = 'Europe/Lisbon';
const offsetIso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

export function parsePickup(value: unknown, now = new Date()) {
  if (typeof value !== 'string' || !offsetIso.test(value)) throw new ApiError(400, 'VALIDATION_ERROR', 'pickup_at deve ser ISO 8601 com offset.');
  const pickup = new Date(value);
  const calendarDate = value.slice(0, 10);
  const normalizedDate = new Date(`${calendarDate}T00:00:00Z`);
  if (!Number.isFinite(pickup.getTime()) || Number.isNaN(normalizedDate.getTime()) || normalizedDate.toISOString().slice(0, 10) !== calendarDate) throw new ApiError(400, 'VALIDATION_ERROR', 'pickup_at inválido.');
  const local = new Intl.DateTimeFormat('en-CA', { timeZone: LISBON, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'long' }).formatToParts(pickup);
  const parts = Object.fromEntries(local.map((part) => [part.type, part.value]));
  if (parts.weekday === 'Monday') throw new ApiError(409, 'MONDAY_PICKUP', 'Não aceitamos levantamentos à segunda-feira.');
  if (pickup <= now) throw new ApiError(409, 'PICKUP_TOO_SOON', 'A data de levantamento tem de ser futura.');
  return { pickupAt: pickup, pickupDate: `${parts.year}-${parts.month}-${parts.day}` };
}

export function assertLeadTime(pickupAt: Date, minLeadHours: number, now = new Date()) {
  if (pickupAt.getTime() - now.getTime() < minLeadHours * 3_600_000) {
    throw new ApiError(409, 'PICKUP_TOO_SOON', `Este produto exige pelo menos ${minLeadHours} horas de antecedência.`);
  }
}

export function depositRequired(totalCents: number, hasCustomCake: boolean) {
  if (!hasCustomCake) return 0;
  // 30% rounded to the nearest whole euro, ties upward.
  return Math.floor((totalCents * 3 + 500) / 1000) * 100;
}

export function nextOrderStatus(current: string, itemStatuses: string[]) {
  if (itemStatuses.length > 0 && itemStatuses.every((status) => status === 'ready')) return 'ready';
  if (itemStatuses.some((status) => status === 'in_progress' || status === 'ready')) return 'in_production';
  return current;
}

export function pickupIsWithin48Hours(pickupAt: Date, now = new Date()) {
  return pickupAt.getTime() - now.getTime() < 48 * 3_600_000;
}

export function cancellationRefundCents(paidCents: number, depositCents: number, pickupAt: Date, now = new Date()) {
  if (paidCents > depositCents) throw new ApiError(409, 'PAYMENT_MISMATCH', 'Pagamentos além do sinal exigem resolução manual.');
  return paidCents > 0 && !pickupIsWithin48Hours(pickupAt, now) ? paidCents : 0;
}

export function balanceDue(total: number, paid: number) {
  return Math.max(0, total - paid);
}
