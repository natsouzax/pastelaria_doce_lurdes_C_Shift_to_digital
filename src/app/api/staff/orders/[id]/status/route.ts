import { z } from 'zod';
import { requireStaff } from '@/lib/authz';
import { db } from '@/lib/db';
import { cancellationRefundCents, capacityReserved } from '@/lib/domain';
import { ApiError, assertSameOrigin, jsonError, parseJson } from '@/lib/http';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('confirmed') }).strict(),
  z.object({ status: z.literal('cancelled'), reason: z.string().trim().min(1).max(500) }).strict(),
  z.object({ status: z.literal('delivered') }).strict(),
]);

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const staff = await requireStaff(['manager']);
    assertSameOrigin(request);
    const { id } = await context.params;
    if (!z.uuid().safeParse(id).success) throw new ApiError(400, 'VALIDATION_ERROR', 'ID inválido.');
    const parsed = schema.safeParse(await parseJson(request));
    if (!parsed.success) throw new ApiError(400, 'VALIDATION_ERROR', 'Transição inválida.');
    const body = parsed.data;
    const result = await db.begin(async tx => {
      const rows = await tx`select *, pickup_date::text as pickup_date_text from public.orders where id=${id}::uuid for update`;
      const order = rows[0];
      if (!order) throw new ApiError(404, 'NOT_FOUND', 'Encomenda não encontrada.');
      const paidRows = await tx`select coalesce(sum(case when kind='refund' then -amount_cents else amount_cents end),0)::integer as paid from public.simulated_payments where order_id=${id}::uuid`;
      const paid = Number(paidRows[0].paid);
      const cakeRows = await tx`select count(*)::integer as count from public.order_items where order_id=${id}::uuid and is_custom_cake`;
      const customCakeCount = Number(cakeRows[0].count);
      let refund: { id: string; amount_cents: number } | null = null;
      if (body.status === 'confirmed') {
        if (order.status !== 'pending' || order.capacity_resolution_required) throw new ApiError(409, 'INVALID_STATE', 'Pedido não pode ser confirmado neste estado.');
        if (customCakeCount > 0) throw new ApiError(409, 'INVALID_STATE', 'Bolos personalizados exigem sinal e reserva atómica de capacidade.');
        const pickupDate = String(order.pickup_date_text);
        await tx`select pg_advisory_xact_lock(hashtextextended(${pickupDate}, 0))`;
        const otherOrders = await tx`select count(*)::integer as count from public.orders
          where pickup_date=${pickupDate}::date
            and status in ('confirmed','in_production','ready','delivered')
            and id <> ${id}::uuid`;
        if (Number(otherOrders[0].count) >= 6) throw new ApiError(409, 'CAPACITY_FULL', 'Esta data já atingiu o limite de seis encomendas.');
        await tx`update public.orders set status='confirmed',confirmed_at=now(),updated_at=now() where id=${id}::uuid`;
      } else if (body.status === 'delivered') {
        if (order.status !== 'ready') throw new ApiError(409, 'INVALID_STATE', 'Só encomendas prontas podem ser entregues.');
        await tx`update public.orders set status='delivered',updated_at=now() where id=${id}::uuid`;
      } else {
        if (!['pending','confirmed','in_production','ready'].includes(order.status) || order.capacity_resolution_required) throw new ApiError(409, 'INVALID_STATE', 'A encomenda não pode ser cancelada por esta ação. Resolva primeiro o sinal recebido sem vaga.');
        const refundCents = cancellationRefundCents(paid, Number(order.deposit_required_cents), new Date(order.pickup_at));
        if (refundCents > 0) {
          const refunds = await tx`insert into public.simulated_payments(order_id,kind,amount_cents,recorded_by,note,idempotency_key)
            values (${id}::uuid,'refund',${refundCents},${staff.userId}::uuid,'Reembolso simulado por cancelamento com 48 horas ou mais',gen_random_uuid()) returning id`;
          refund = { id: String(refunds[0].id), amount_cents: refundCents };
        }
        await tx`update public.orders set status='cancelled',cancelled_at=now(),cancellation_reason=${body.reason},updated_at=now() where id=${id}::uuid`;
      }
      return { status: body.status, paid: body.status === 'cancelled' && refund ? 0 : paid, refund,
        total: Number(order.total_cents), reserved: capacityReserved(body.status, customCakeCount) };
    });
    return NextResponse.json({ id, status: result.status, amount_paid_cents: result.paid,
      balance_due_cents: Math.max(0, result.total - result.paid), capacity_reserved: result.reserved,
      ...(result.refund ? { payment: { id: result.refund.id, kind: 'refund', amount_cents: result.refund.amount_cents } } : {}) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return jsonError(error); }
}
