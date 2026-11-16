import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { db } from '@/lib/db';
import { assertLeadTime, depositRequired, parsePickup } from '@/lib/domain';
import { ApiError, jsonError, parseJson } from '@/lib/http';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  customer: z.object({ name: z.string().trim().min(1).max(120), phone: z.string().trim().min(3).max(40) }).strict(),
  pickup_at: z.string(), notes: z.string().trim().max(1000).nullable().optional(),
  items: z.array(z.object({
    product_id: z.uuid(), quantity: z.number().positive().max(10000), weight_kg: z.number().positive().max(100).optional(),
    cake_message: z.string().max(80).nullable().optional(), declared_allergies: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
    production_notes: z.string().trim().max(500).nullable().optional(),
  }).strict()).min(1).max(100),
}).strict();

export async function POST(request: Request) {
  try {
    const parsed = requestSchema.safeParse(await parseJson(request));
    if (!parsed.success) throw new ApiError(400, 'VALIDATION_ERROR', 'Pedido inválido.', Object.fromEntries(parsed.error.issues.map(i => [String(i.path.join('.')), i.message])));
    const input = parsed.data;
    const { pickupAt, pickupDate } = parsePickup(input.pickup_at);
    const productIds = input.items.map(i => i.product_id);
    const code = randomBytes(24).toString('base64url');
    const codeHash = createHash('sha256').update(code).digest('hex');
    const result = await db.begin(async tx => {
      const products = await tx`select id, name, unit, unit_price_cents, allergens, min_lead_hours, is_custom_cake from public.products where active = true and id = any(${productIds}::uuid[])`;
      const byId = new Map(products.map(p => [String(p.id), p]));
      let totalCents = 0;
      const lines = input.items.map(item => {
        const product = byId.get(item.product_id);
        if (!product) throw new ApiError(400, 'VALIDATION_ERROR', 'Produto inválido ou inativo.', { product_id: item.product_id });
        const custom = Boolean(product.is_custom_cake);
        if (custom && (item.quantity !== 1 || item.weight_kg === undefined)) throw new ApiError(400, 'VALIDATION_ERROR', 'Cada bolo personalizado deve ser um item individual com peso em kg.');
        if (!custom && (item.weight_kg !== undefined || item.cake_message !== undefined || (item.declared_allergies?.length ?? 0) > 0)) throw new ApiError(400, 'VALIDATION_ERROR', 'Campos de bolo só são aceites em produtos personalizados.');
        if (!custom && product.unit !== 'kg' && !Number.isInteger(item.quantity)) throw new ApiError(400, 'VALIDATION_ERROR', 'A quantidade deve ser inteira para unidades, centenas e dúzias.');
        if (Math.round(item.quantity * 1000) !== item.quantity * 1000) throw new ApiError(400, 'VALIDATION_ERROR', 'A quantidade aceita no máximo três casas decimais.');
        if (custom && product.unit !== 'kg') throw new ApiError(500, 'INTERNAL_ERROR', 'O catálogo tem uma unidade incompatível para bolo personalizado.');
        assertLeadTime(pickupAt, Math.max(Number(product.min_lead_hours), custom ? 120 : 48));
        const weight = custom ? item.weight_kg! : null;
        if (weight !== null && Math.round(weight * 1000) !== weight * 1000) throw new ApiError(400, 'VALIDATION_ERROR', 'O peso aceita no máximo três casas decimais.');
        const subtotal = custom ? Math.round(weight! * Number(product.unit_price_cents)) : Math.round(item.quantity * Number(product.unit_price_cents));
        totalCents += subtotal;
        return { item, product, custom, weight, subtotal };
      });
      const hasCustom = lines.some(l => l.custom);
      const requestedCakes = lines.filter(l => l.custom).length;
      if (requestedCakes) {
        const occupied = await tx`select count(*)::integer as count from public.order_items i
          join public.orders o on o.id=i.order_id
          where o.pickup_date=${pickupDate}::date and o.status in ('confirmed','in_production','ready','delivered')
            and i.is_custom_cake`;
        if (Number(occupied[0].count) + requestedCakes > 6) throw new ApiError(409, 'CAPACITY_FULL', 'A data já tem seis bolos personalizados reservados.');
      }
      const deposit = depositRequired(totalCents, hasCustom);
      const orders = await tx`
        insert into public.orders (tracking_code_hash, customer_name, customer_phone, pickup_at, pickup_date, notes, source, total_cents, deposit_required_cents)
        values (${codeHash}, ${input.customer.name}, ${input.customer.phone}, ${pickupAt.toISOString()}, ${pickupDate}::date, ${input.notes ?? null}, 'online', ${totalCents}, ${deposit})
        returning id, status, pickup_at`;
      const order = orders[0];
      const responseItems = [];
      for (const line of lines) {
        const inserted = await tx`
          insert into public.order_items (order_id, product_id, product_name_snapshot, unit_snapshot, unit_price_cents_snapshot,
            quantity, subtotal_cents, is_custom_cake, weight_kg, cake_message, declared_allergies, production_notes)
          values (${order.id}, ${line.product.id}, ${line.product.name}, ${line.product.unit}, ${line.product.unit_price_cents},
            ${line.custom ? 1 : line.item.quantity}, ${line.subtotal}, ${line.custom}, ${line.weight}, ${line.custom ? line.item.cake_message ?? null : null},
            ${line.custom ? line.item.declared_allergies ?? [] : []}, ${line.custom ? line.item.production_notes ?? null : null})
          returning id, product_name_snapshot, quantity, unit_snapshot, unit_price_cents_snapshot, subtotal_cents, weight_kg, cake_message`;
        responseItems.push(inserted[0]);
      }
      return { order, items: responseItems, totalCents, deposit };
    });
    return NextResponse.json({ order_id: result.order.id, tracking_code: code, status: result.order.status,
      pickup_at: result.order.pickup_at, items: result.items, total_cents: result.totalCents,
      deposit_required_cents: result.deposit, amount_paid_cents: 0, balance_due_cents: result.totalCents,
      capacity_reserved: false, message: result.deposit ? 'Contacte a Gestora para confirmar disponibilidade antes de registar o sinal.' : 'Pedido recebido; aguarde confirmação da Gestora.' },
    { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return jsonError(error); }
}
