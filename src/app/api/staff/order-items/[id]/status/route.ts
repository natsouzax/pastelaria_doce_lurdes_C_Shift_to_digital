import { z } from 'zod';
import { requireStaff } from '@/lib/authz';
import { db } from '@/lib/db';
import { ApiError, assertSameOrigin, jsonError, parseJson } from '@/lib/http';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await requireStaff(['manager', 'production']);
    assertSameOrigin(request);
    const { id } = await context.params;
    if (!z.uuid().safeParse(id).success) throw new ApiError(400, 'VALIDATION_ERROR', 'ID inválido.');
    const body = z.object({ status: z.enum(['in_progress','ready']) }).strict().safeParse(await parseJson(request));
    if (!body.success) throw new ApiError(400, 'VALIDATION_ERROR', 'Estado de produção inválido.');
    const result = await db.begin(async tx => {
      const rows = await tx`select i.id,i.order_id,i.production_status,o.status as order_status from public.order_items i join public.orders o on o.id=i.order_id where i.id=${id}::uuid for update of i,o`;
      const row = rows[0];
      if (!row) throw new ApiError(404, 'NOT_FOUND', 'Item não encontrado.');
      if (!['confirmed','in_production'].includes(row.order_status)) throw new ApiError(409, 'INVALID_STATE', 'A encomenda não está confirmada para produção.');
      const allowed = row.production_status === 'to_do' && body.data.status === 'in_progress' || row.production_status === 'in_progress' && body.data.status === 'ready';
      if (!allowed) throw new ApiError(409, 'INVALID_STATE', 'O estado do item só pode avançar um passo.');
      await tx`update public.order_items set production_status=${body.data.status}::public.production_status,updated_at=now() where id=${id}::uuid`;
      const all = await tx`select production_status from public.order_items where order_id=${row.order_id}::uuid`;
      const statuses = all.map(i => String(i.production_status));
      const orderStatus = statuses.every(s => s === 'ready') ? 'ready' : statuses.some(s => s === 'in_progress' || s === 'ready') ? 'in_production' : row.order_status;
      await tx`update public.orders set status=${orderStatus}::public.order_status,updated_at=now() where id=${row.order_id}::uuid`;
      return { item_id: id, item_status: body.data.status, order_id: String(row.order_id), order_status: orderStatus };
    });
    return NextResponse.json({ item: { id: result.item_id, production_status: result.item_status }, order: { id: result.order_id, status: result.order_status } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return jsonError(error); }
}
