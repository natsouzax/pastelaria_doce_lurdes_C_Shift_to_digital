import { createHash } from 'node:crypto';
import { db } from '@/lib/db';
import { canCustomerCancel } from '@/lib/domain';
import { ApiError, jsonError } from '@/lib/http';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await context.params;
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const codeHash = createHash('sha256').update(code).digest('hex');
    const ipHash = createHash('sha256').update(ip).digest('hex');
    const ipKey = `ip:${ipHash}`;
    const codeKey = `code:${codeHash}`;
    const lockKeys = [ipKey, codeKey].sort();
    const outcome = await db.begin(async tx => {
      for (const key of lockKeys) await tx`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
      await tx`delete from public.track_rate_events where requested_at < now() - interval '15 minutes'`;
      const recent = await tx`select request_hash, count(*)::integer as count from public.track_rate_events where request_hash in ${tx([ipKey, codeKey])} and requested_at >= now() - interval '15 minutes' group by request_hash`;
      for (const key of [ipKey, codeKey]) await tx`insert into public.track_rate_events(request_hash) values (${key})`;
      const counts = new Map(recent.map(row => [String(row.request_hash), Number(row.count)]));
      if ((counts.get(ipKey) ?? 0) >= 60 || (counts.get(codeKey) ?? 0) >= 20) return { limited: true as const };
      if (!/^[A-Za-z0-9_-]{32}$/.test(code)) return { order: null };
      const hash = createHash('sha256').update(code).digest('hex');
      const orders = await tx`select id, status, pickup_at, total_cents, capacity_resolution_required from public.orders where tracking_code_hash = ${hash}`;
      if (!orders[0]) return { order: null };
      const items = await tx`select product_name_snapshot as product_name, quantity, unit_snapshot as unit, weight_kg, cake_message, production_status from public.order_items where order_id = ${orders[0].id} order by created_at, id`;
      const paidRows = await tx`select coalesce(sum(case when kind = 'refund' then -amount_cents else amount_cents end), 0)::integer as paid, count(*)::integer as payment_count from public.simulated_payments where order_id = ${orders[0].id}`;
      return { order: { status: orders[0].status, pickup_at: orders[0].pickup_at, total_cents: orders[0].total_cents, items, amount_paid_cents: paidRows[0].paid,
        balance_due_cents: Math.max(0, Number(orders[0].total_cents) - Number(paidRows[0].paid)),
        can_cancel: canCustomerCancel({ status: String(orders[0].status), paymentCount: Number(paidRows[0].payment_count), capacityResolutionRequired: Boolean(orders[0].capacity_resolution_required) }) } };
    });
    if (outcome.limited) throw new ApiError(429, 'RATE_LIMITED', 'Demasiadas tentativas. Tente novamente mais tarde.');
    if (!outcome.order) throw new ApiError(404, 'NOT_FOUND', 'Pedido não encontrado.');
    return NextResponse.json(outcome.order, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return jsonError(error); }
}
