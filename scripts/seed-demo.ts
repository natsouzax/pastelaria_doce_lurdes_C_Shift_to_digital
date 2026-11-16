import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { loadEnvConfig } from '@next/env';
import { depositRequired } from '../src/lib/domain';
import postgres from 'postgres';
async function main() {
loadEnvConfig(process.cwd());
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL é obrigatório para carregar o seed.');
const db = postgres(process.env.DATABASE_URL, { prepare: false });

const fixture = z.object({
  fixture: z.string(), reference_at: z.string(), pickup_date: z.iso.date(),
  pickup_timezone: z.literal('Europe/Lisbon'), product_ref: z.literal('bolo-chocolate'),
  cakes: z.array(z.object({ ref: z.string(), customer_name: z.string(), weight_kg: z.number().positive(),
    message: z.string().nullable(), allergies: z.array(z.string()) })).length(5),
}).strict();
const data = fixture.parse(JSON.parse(await readFile('seed/demo-day.json', 'utf8')));
function stableUuid(value: string) {
  const b = Buffer.from(createHash('sha1').update(value).digest().subarray(0, 16));
  b[6] = (b[6] & 15) | 80; b[8] = (b[8] & 63) | 128;
  const h = b.toString('hex'); return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

const productId = stableUuid(`cliente-c:product:${data.product_ref}`);
const actor = process.env.DEMO_RECORDED_BY ? z.uuid().parse(process.env.DEMO_RECORDED_BY) : null;
await db.begin(async tx => {
  const products = await tx`select name,unit,unit_price_cents from public.products where id=${productId}::uuid and active and is_custom_cake`;
  const product = products[0];
  if (!product || product.unit !== 'kg') throw new Error('Execute npm run seed:original antes da fixture.');
  const fixtureIds = data.cakes.map(c => stableUuid(`${data.fixture}:order:${c.ref}`));
  const occupied = await tx`select count(*)::integer as count from public.order_items i join public.orders o on o.id=i.order_id
    where o.pickup_date=${data.pickup_date}::date and o.status in ('confirmed','in_production','ready','delivered')
    and i.is_custom_cake and o.id <> all(${fixtureIds}::uuid[])`;
  if (Number(occupied[0].count) > 1) throw new Error('A fixture exige no máximo um bolo já reservado na data.');
  for (const cake of data.cakes) {
    const orderId = stableUuid(`${data.fixture}:order:${cake.ref}`);
    const itemId = stableUuid(`${data.fixture}:item:${cake.ref}`);
    const paymentId = stableUuid(`${data.fixture}:payment:${cake.ref}`);
    const paymentKey = stableUuid(`${data.fixture}:payment-key:${cake.ref}`);
    const total = Math.round(cake.weight_kg * Number(product.unit_price_cents));
    const deposit = depositRequired(total, true);
    const trackingHash = createHash('sha256').update(`demo-only:${orderId}`).digest('hex');
    await tx`insert into public.orders(id,tracking_code_hash,customer_name,customer_phone,pickup_at,pickup_date,status,source,total_cents,deposit_required_cents,confirmed_at)
      values(${orderId}::uuid,${trackingHash},${cake.customer_name},'+351000000000',${`${data.pickup_date}T10:00:00+00:00`}::timestamptz,${data.pickup_date}::date,'confirmed','counter',${total},${deposit},now())
      on conflict(id) do update set customer_name=excluded.customer_name,pickup_at=excluded.pickup_at,pickup_date=excluded.pickup_date,status='confirmed',total_cents=excluded.total_cents,deposit_required_cents=excluded.deposit_required_cents,updated_at=now()`;
    await tx`insert into public.order_items(id,order_id,product_id,product_name_snapshot,unit_snapshot,unit_price_cents_snapshot,quantity,subtotal_cents,is_custom_cake,weight_kg,cake_message,declared_allergies)
      values(${itemId}::uuid,${orderId}::uuid,${productId}::uuid,${product.name},'kg',${product.unit_price_cents},1,${total},true,${cake.weight_kg},${cake.message},${cake.allergies})
      on conflict(id) do update set weight_kg=excluded.weight_kg,cake_message=excluded.cake_message,declared_allergies=excluded.declared_allergies,updated_at=now()`;
    await tx`insert into public.simulated_payments(id,order_id,kind,amount_cents,recorded_by,note,external_payment_received,idempotency_key)
      values(${paymentId}::uuid,${orderId}::uuid,'deposit',${deposit},${actor}::uuid,'Fixture de demonstração',false,${paymentKey}::uuid)
      on conflict(id) do update set amount_cents=excluded.amount_cents`;
  }
});
console.info(`Fixture ${data.fixture}: cinco bolos; o sexto é criado pelo fluxo da demonstração.`);
await db.end();
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
