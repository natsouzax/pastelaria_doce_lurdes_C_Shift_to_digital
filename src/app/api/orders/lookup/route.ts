import { createHash } from 'node:crypto';
import { z } from 'zod';
import { db } from '@/lib/db';
import { phoneTail } from '@/lib/domain';
import { ApiError, assertSameOrigin, jsonError, parseJson } from '@/lib/http';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const requestSchema = z.object({ phone: z.string().trim().min(3).max(40) }).strict();

// Consulta pública por telefone. Sem código secreto, por isso a resposta é mínima
// (sem nome, telefone, mensagens de bolos, valores ou pagamentos) e as tentativas são muito limitadas.
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
      const orders = await tx`select id, status, pickup_at from public.orders
        where right(regexp_replace(customer_phone, '[^0-9]', '', 'g'), 9) = ${tail}
        order by pickup_at desc, id limit ${MAX_ORDERS}`;
      if (!orders.length) return { orders: [] };
      const items = await tx`select order_id, product_name_snapshot as product_name, quantity, unit_snapshot as unit, weight_kg, production_status
        from public.order_items where order_id in ${tx(orders.map(order => String(order.id)))} order by created_at, id`;
      return { orders: orders.map(order => ({
        status: order.status, pickup_at: order.pickup_at,
        items: items.filter(item => item.order_id === order.id).map(({ order_id: _orderId, ...item }) => item),
      })) };
    });
    if ('limited' in outcome) throw new ApiError(429, 'RATE_LIMITED', 'Demasiadas tentativas. Tente novamente mais tarde.');
    return NextResponse.json({ data: outcome.orders }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return jsonError(error); }
}
