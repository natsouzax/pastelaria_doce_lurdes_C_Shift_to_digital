import { createHash } from 'node:crypto';
import { db } from '@/lib/db';
import { canCustomerCancel } from '@/lib/domain';
import { ApiError, assertSameOrigin, jsonError } from '@/lib/http';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const IP_LIMIT = 20;
const CODE_LIMIT = 5;

/** Cancelamento pelo cliente: exige o código secreto do pedido (nunca só o telefone). */
export async function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  try {
    assertSameOrigin(request);
    const { code } = await context.params;
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const codeHash = createHash('sha256').update(code).digest('hex');
    const ipKey = `cancel-ip:${createHash('sha256').update(ip).digest('hex')}`;
    const codeKey = `cancel-code:${codeHash}`;
    const lockKeys = [ipKey, codeKey].sort();
    const outcome = await db.begin(async tx => {
      for (const key of lockKeys) await tx`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
      await tx`delete from public.track_rate_events where requested_at < now() - interval '15 minutes'`;
      const recent = await tx`select request_hash, count(*)::integer as count from public.track_rate_events where request_hash in ${tx([ipKey, codeKey])} and requested_at >= now() - interval '15 minutes' group by request_hash`;
      for (const key of [ipKey, codeKey]) await tx`insert into public.track_rate_events(request_hash) values (${key})`;
      const counts = new Map(recent.map(row => [String(row.request_hash), Number(row.count)]));
      if ((counts.get(ipKey) ?? 0) >= IP_LIMIT || (counts.get(codeKey) ?? 0) >= CODE_LIMIT) return { limited: true as const };
      if (!/^[A-Za-z0-9_-]{32}$/.test(code)) return { found: false as const };
      const rows = await tx`select id, status, capacity_resolution_required from public.orders where tracking_code_hash = ${codeHash} for update`;
      const order = rows[0];
      if (!order) return { found: false as const };
      const payments = await tx`select count(*)::integer as count from public.simulated_payments where order_id = ${order.id}`;
      if (!canCustomerCancel({ status: String(order.status), paymentCount: Number(payments[0].count), capacityResolutionRequired: Boolean(order.capacity_resolution_required) })) return { blocked: true as const };
      await tx`update public.orders set status = 'cancelled', cancelled_at = now(), cancellation_reason = 'Cancelado pelo cliente', updated_at = now() where id = ${order.id}`;
      return { cancelled: true as const };
    });
    if ('limited' in outcome) throw new ApiError(429, 'RATE_LIMITED', 'Demasiadas tentativas. Tente novamente mais tarde.');
    if ('found' in outcome) throw new ApiError(404, 'NOT_FOUND', 'Pedido não encontrado.');
    if ('blocked' in outcome) throw new ApiError(409, 'INVALID_STATE', 'Este pedido já não pode ser cancelado online. Fale com a pastelaria.');
    return NextResponse.json({ status: 'cancelled' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return jsonError(error); }
}
