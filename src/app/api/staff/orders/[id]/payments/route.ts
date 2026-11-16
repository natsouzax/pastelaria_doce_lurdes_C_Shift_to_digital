import { z } from 'zod';
import { requireStaff } from '@/lib/authz';
import { db } from '@/lib/db';
import { balanceDue } from '@/lib/domain';
import { samePaymentRequest } from '@/lib/payment-idempotency';
import { ApiError, assertSameOrigin, dbError, jsonError, parseJson } from '@/lib/http';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const schema = z.object({ kind: z.enum(['deposit', 'balance', 'refund']), amount_cents: z.number().int().positive(),
  external_payment_received: z.boolean().default(false), note: z.string().trim().max(500).nullable().optional() }).strict();

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const staff = await requireStaff(['manager']);
    assertSameOrigin(request);
    const { id } = await context.params;
    if (!z.uuid().safeParse(id).success) throw new ApiError(400, 'VALIDATION_ERROR', 'ID inválido.');
    const key = request.headers.get('Idempotency-Key');
    if (!key || !z.uuid().safeParse(key).success) throw new ApiError(400, 'VALIDATION_ERROR', 'O header Idempotency-Key UUID é obrigatório.');
    const parsed = schema.safeParse(await parseJson(request));
    if (!parsed.success) throw new ApiError(400, 'VALIDATION_ERROR', 'Pagamento inválido.');
    const body = parsed.data;
    let response: { result: string; payment_id: string; status: string; total_cents: number; deposit_required_cents: number; paid: number; resolution_required: boolean };
    try {
      response = await db.begin(async tx => {
        await tx`select pg_advisory_xact_lock(hashtextextended(${`${staff.userId}:${key}`},0))`;
        const previous = await tx`select id, order_id, kind, amount_cents, external_payment_received, note from public.simulated_payments where recorded_by=${staff.userId}::uuid and idempotency_key=${key}::uuid`;
        if (previous[0]) {
          if (!samePaymentRequest(previous[0] as { order_id: string; kind: string; amount_cents: number; external_payment_received: boolean; note: string | null }, id, body)) throw new ApiError(409, 'INVALID_STATE', 'Chave idempotente já utilizada com outros dados.');
          const rows = await tx`select o.status, o.total_cents, o.deposit_required_cents, o.capacity_resolution_required,
            (select coalesce(sum(case when kind='refund' then -amount_cents else amount_cents end),0)::integer from public.simulated_payments where order_id=o.id) as paid
            from public.orders o where o.id=${id}::uuid`;
          if (!rows[0]) throw new ApiError(404, 'NOT_FOUND', 'Encomenda não encontrada.');
          return { result: rows[0].capacity_resolution_required ? 'capacity_lost_after_payment' : 'idempotent', payment_id: String(previous[0].id), status: String(rows[0].status), total_cents: Number(rows[0].total_cents), deposit_required_cents: Number(rows[0].deposit_required_cents), paid: Number(rows[0].paid), resolution_required: Boolean(rows[0].capacity_resolution_required) };
        }
        const orders = await tx`select * from public.orders where id=${id}::uuid for update`;
        const order = orders[0];
        if (!order) throw new ApiError(404, 'NOT_FOUND', 'Encomenda não encontrada.');
        if (body.kind === 'deposit') {
          if (body.external_payment_received && order.deposit_required_cents <= 0) throw new ApiError(409, 'PAYMENT_MISMATCH', 'Este pedido não exige sinal.');
          const rows = await tx`select public.confirm_order_after_deposit(${id}::uuid, ${staff.userId}::uuid, ${key}::uuid,
            ${body.amount_cents}, ${body.external_payment_received}, ${body.note ?? null}) as outcome`;
          const outcome = rows[0].outcome as { result: string; payment_id: string; status: string };
          const paid = Number(order.deposit_required_cents);
          return { ...outcome, total_cents: Number(order.total_cents), deposit_required_cents: Number(order.deposit_required_cents), paid, resolution_required: outcome.result === 'capacity_lost_after_payment' };
        }
        const payments = await tx`select coalesce(sum(case when kind='refund' then -amount_cents else amount_cents end),0)::integer as paid from public.simulated_payments where order_id=${id}::uuid`;
        const paid = Number(payments[0].paid);
        if (paid > Number(order.total_cents)) throw new ApiError(409, 'PAYMENT_MISMATCH', 'O total líquido pago já excede o total da encomenda.');
        if (body.kind === 'balance') {
          if (!['confirmed', 'in_production', 'ready'].includes(order.status) || body.external_payment_received && order.status === 'pending') throw new ApiError(409, 'INVALID_STATE', 'Só se pode registar saldo depois da confirmação.');
          if (body.amount_cents > balanceDue(Number(order.total_cents), paid)) throw new ApiError(409, 'PAYMENT_MISMATCH', 'O pagamento excede o saldo.');
          const inserts = await tx`insert into public.simulated_payments(order_id,kind,amount_cents,recorded_by,note,external_payment_received,idempotency_key)
            values (${id}::uuid,'balance',${body.amount_cents},${staff.userId}::uuid,${body.note ?? null},${body.external_payment_received},${key}::uuid) returning id`;
          return { result: 'recorded', payment_id: String(inserts[0].id), status: String(order.status), total_cents: Number(order.total_cents), deposit_required_cents: Number(order.deposit_required_cents), paid: paid + body.amount_cents, resolution_required: false };
        }
        if (order.status !== 'pending' || !order.capacity_resolution_required || body.external_payment_received) throw new ApiError(409, 'INVALID_STATE', 'Reembolso manual só está disponível para sinal recebido sem vaga.');
        if (paid !== Number(order.deposit_required_cents) || body.amount_cents !== paid) throw new ApiError(409, 'PAYMENT_MISMATCH', 'O reembolso deve corresponder ao sinal líquido registado.');
        const refunds = await tx`insert into public.simulated_payments(order_id,kind,amount_cents,recorded_by,note,idempotency_key)
          values (${id}::uuid,'refund',${body.amount_cents},${staff.userId}::uuid,${body.note ?? 'Resolução de capacidade indisponível'},${key}::uuid) returning id`;
        await tx`update public.orders set status='cancelled', cancelled_at=now(), cancellation_reason='capacity_lost_after_payment', capacity_resolution_required=false, updated_at=now() where id=${id}::uuid`;
        return { result: 'refunded', payment_id: String(refunds[0].id), status: 'cancelled', total_cents: Number(order.total_cents), deposit_required_cents: Number(order.deposit_required_cents), paid: 0, resolution_required: false };
      });
    } catch (error) { dbError(error); }
    if (response.result === 'capacity_lost_after_payment') {
      return NextResponse.json({ error: { code: 'CAPACITY_LOST_AFTER_PAYMENT', message: 'O sinal foi registado, mas a data esgotou. Resolva com alteração de data ou reembolso simulado.', payment_recorded: true, actions: ['reschedule_or_refund'] }, payment: { id: response.payment_id, kind: 'deposit', amount_cents: response.deposit_required_cents }, order: { id, status: 'pending', capacity_reserved: false, capacity_resolution_required: true } }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
    }
    return NextResponse.json({ payment: { id: response.payment_id, kind: body.kind, amount_cents: body.amount_cents },
      order: { id, status: response.status, total_cents: response.total_cents, deposit_required_cents: response.deposit_required_cents,
        amount_paid_cents: response.paid, balance_due_cents: balanceDue(response.total_cents, response.paid),
        capacity_reserved: ['confirmed','in_production','ready','delivered'].includes(response.status) && !response.resolution_required }, resolution_required: response.resolution_required },
    { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return jsonError(error); }
}
