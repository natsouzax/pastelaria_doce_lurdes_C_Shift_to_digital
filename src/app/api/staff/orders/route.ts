import { requireStaff } from '@/lib/authz';
import { db } from '@/lib/db';
import { capacityReserved } from '@/lib/domain';
import { ApiError, jsonError } from '@/lib/http';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const staff = await requireStaff(['manager', 'production']);
    const query = new URL(request.url).searchParams;
    for (const key of query.keys()) if (!['pickup_date', 'status', 'limit', 'cursor'].includes(key)) throw new ApiError(400, 'VALIDATION_ERROR', `Filtro não suportado: ${key}.`);
    const date = query.get('pickup_date');
    const parsedDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00Z`) : null;
    if (!date || !parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0,10) !== date) throw new ApiError(400, 'VALIDATION_ERROR', 'pickup_date é obrigatório (YYYY-MM-DD).');
    const requestedStatus = query.get('status');
    const statuses = ['pending', 'confirmed', 'in_production', 'ready', 'delivered', 'cancelled'];
    if (requestedStatus && !statuses.includes(requestedStatus)) throw new ApiError(400, 'VALIDATION_ERROR', 'status inválido.');
    const limit = Math.min(100, Math.max(1, Number(query.get('limit') ?? 50)));
    if (!Number.isInteger(limit)) throw new ApiError(400, 'VALIDATION_ERROR', 'limit deve ser inteiro.');
    let cursorDate: string | null = null, cursorId: string | null = null;
    if (query.has('cursor')) {
      try {
        [cursorDate, cursorId] = Buffer.from(query.get('cursor')!, 'base64url').toString().split('|');
        if (!/^\d{4}-\d{2}-\d{2}T.*Z$/.test(cursorDate!) || !/^[0-9a-f-]{36}$/i.test(cursorId!)) throw new Error();
      } catch { throw new ApiError(400, 'VALIDATION_ERROR', 'cursor inválido.'); }
    }
    const rows = await db`
      select o.id, o.status, o.pickup_at, o.customer_name, o.customer_phone, o.notes, o.source,
        o.total_cents, o.deposit_required_cents, o.capacity_resolution_required, o.pickup_date,
        (select count(*)::integer from public.order_items i where i.order_id=o.id and i.is_custom_cake) as custom_cake_count,
        (select coalesce(sum(case when p.kind = 'refund' then -p.amount_cents else p.amount_cents end),0)::integer from public.simulated_payments p where p.order_id=o.id) as amount_paid_cents,
        (select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'kind',p.kind,'amount_cents',p.amount_cents,'recorded_at',p.recorded_at,'note',p.note) order by p.recorded_at),'[]'::jsonb) from public.simulated_payments p where p.order_id=o.id) as payments,
        (select coalesce(jsonb_agg(jsonb_build_object(
          'id', i.id, 'product_name', i.product_name_snapshot, 'quantity', i.quantity, 'unit', i.unit_snapshot,
          'weight_kg', i.weight_kg, 'cake_message', i.cake_message, 'product_allergens', p.allergens,
          'declared_allergies', i.declared_allergies, 'production_notes', i.production_notes,
          'production_status', i.production_status
        ) order by i.created_at, i.id),'[]'::jsonb) from public.order_items i join public.products p on p.id=i.product_id where i.order_id=o.id) as items
      from public.orders o
      where o.pickup_date = ${date}::date
        and (${requestedStatus}::text is null or o.status = ${requestedStatus}::public.order_status)
        and (${staff.role === 'production'}::boolean = false or o.status in ('confirmed','in_production','ready'))
        and (${cursorDate}::timestamptz is null or (o.pickup_at,o.id) > (${cursorDate}::timestamptz,${cursorId}::uuid))
      order by o.pickup_at,o.id limit ${limit + 1}`;
    const more = rows.length > limit;
    const page = rows.slice(0, limit).map(row => {
      const amountPaid = Number(row.amount_paid_cents);
      const base = { id: row.id, status: row.status, pickup_at: row.pickup_at, items: row.items,
        ...(staff.role === 'manager' ? { customer_name: row.customer_name, customer_phone: row.customer_phone, notes: row.notes,
          source: row.source, total_cents: Number(row.total_cents), amount_paid_cents: amountPaid,
          deposit_required_cents: Number(row.deposit_required_cents),
          balance_due_cents: Math.max(0, Number(row.total_cents) - amountPaid), payments: row.payments,
          capacity_reserved: capacityReserved(String(row.status), Number(row.custom_cake_count)),
          capacity_resolution_required: Boolean(row.capacity_resolution_required) } : {}) };
      return base;
    });
    const last = rows[Math.min(limit, rows.length) - 1];
    return NextResponse.json({ data: page, next_cursor: more ? Buffer.from(`${new Date(last.pickup_at).toISOString()}|${last.id}`).toString('base64url') : null }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return jsonError(error); }
}
