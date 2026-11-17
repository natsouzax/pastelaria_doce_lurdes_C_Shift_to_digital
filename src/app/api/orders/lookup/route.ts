import { createHash } from 'node:crypto';
import { z } from 'zod';
import { db } from '@/lib/db';
import { phoneTail } from '@/lib/domain';
import { ApiError, assertSameOrigin, jsonError, parseJson } from '@/lib/http';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const requestSchema = z.object({ phone: z.string().trim().min(3).max(40) }).strict();

// O telefone funciona como confirmação para abrir os detalhes completos do pedido.
// As tentativas continuam limitadas por IP e por telefone.
const IP_LIMIT = 10;
const PHONE_LIMIT = 5;
const MAX_ORDERS = 20;

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const parsed = requestSchema.safeParse(await parseJson(request));
    if (!parsed.success) throw new ApiError(400, 'VALIDATION_ERROR', 'Indique o telefone.');
    const tail = phoneTail(parsed.data.phone);
    if (!tail) throw new ApiError(400, 'VALIDATION_ERROR', 'Indique o telefone com pelo menos 9 dígitos.', { phone: 'Telefone com pelo menos 9 dígitos.' });
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const ipKey = `lookup-ip:${createHash('sha256').update(ip).digest('hex')}`;
    const phoneKey = `lookup-phone:${createHash('sha256').update(tail).digest('hex')}`;
    const lockKeys = [ipKey, phoneKey].sort();
    const outcome = await db.begin(async tx => {
      for (const key of lockKeys) await tx`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
      await tx`delete from public.track_rate_events where requested_at < now() - interval '15 minutes'`;
      const recent = await tx`select request_hash, count(*)::integer as count from public.track_rate_events where request_hash in ${tx([ipKey, phoneKey])} and requested_at >= now() - interval '15 minutes' group by request_hash`;
      for (const key of [ipKey, phoneKey]) await tx`insert into public.track_rate_events(request_hash) values (${key})`;
      const counts = new Map(recent.map(row => [String(row.request_hash), Number(row.count)]));
      if ((counts.get(ipKey) ?? 0) >= IP_LIMIT || (counts.get(phoneKey) ?? 0) >= PHONE_LIMIT) return { limited: true as const };
      const orders = await tx`select o.id, o.status, o.pickup_at, o.customer_name, o.customer_phone, o.notes,
          o.total_cents, o.deposit_required_cents,
          (select coalesce(sum(case when payment.kind = 'refund' then -payment.amount_cents else payment.amount_cents end), 0)::integer
            from public.simulated_payments payment where payment.order_id = o.id) as amount_paid_cents,
          (select coalesce(jsonb_agg(jsonb_build_object(
            'id', i.id, 'product_name', i.product_name_snapshot, 'quantity', i.quantity, 'unit', i.unit_snapshot,
            'weight_kg', i.weight_kg, 'unit_price_cents', i.unit_price_cents_snapshot, 'subtotal_cents', i.subtotal_cents,
            'cake_message', i.cake_message, 'product_allergens', p.allergens,
            'declared_allergies', i.declared_allergies, 'production_notes', i.production_notes,
            'production_status', i.production_status
          ) order by i.created_at, i.id), '[]'::jsonb)
            from public.order_items i join public.products p on p.id = i.product_id where i.order_id = o.id) as items,
          (select coalesce(jsonb_agg(jsonb_build_object(
            'id', payment.id, 'kind', payment.kind, 'amount_cents', payment.amount_cents, 'recorded_at', payment.recorded_at, 'note', payment.note
          ) order by payment.recorded_at), '[]'::jsonb)
            from public.simulated_payments payment where payment.order_id = o.id) as payments
        from public.orders o
        where right(regexp_replace(o.customer_phone, '[^0-9]', '', 'g'), 9) = ${tail}
        order by o.pickup_at desc, o.id limit ${MAX_ORDERS}`;
      return { orders: orders.map(order => {
        const amountPaid = Number(order.amount_paid_cents);
        return {
          customer_name: order.customer_name, customer_phone: order.customer_phone, notes: order.notes,
          status: order.status, pickup_at: order.pickup_at, total_cents: Number(order.total_cents),
          deposit_required_cents: Number(order.deposit_required_cents), amount_paid_cents: amountPaid,
          balance_due_cents: Math.max(0, Number(order.total_cents) - amountPaid),
          items: order.items, payments: order.payments,
        };
      }) };
    });
    if ('limited' in outcome) throw new ApiError(429, 'RATE_LIMITED', 'Demasiadas tentativas. Tente novamente mais tarde.');
    return NextResponse.json({ data: outcome.orders }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return jsonError(error); }
}
