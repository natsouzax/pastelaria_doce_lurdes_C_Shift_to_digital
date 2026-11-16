import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { depositRequired } from '../src/lib/domain';
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
const { db } = await import('../src/lib/db');

const fixture=z.object({fixture:z.string(),pickup_date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),pickup_timezone:z.literal('Europe/Lisbon'),product:z.object({name:z.string(),category:z.string(),unit:z.literal('kg'),unit_price_cents:z.number().int().positive(),allergens:z.array(z.string()),min_lead_hours:z.number().int().min(120),is_custom_cake:z.literal(true)}),cakes:z.array(z.object({ref:z.string(),customer_name:z.string(),weight_kg:z.number().positive(),message:z.string().nullable(),allergies:z.array(z.string())})).length(6)}).strict();
const data=fixture.parse(JSON.parse(await readFile('seed/demo-day.json','utf8')));
function stableUuid(value:string){const b=Buffer.from(createHash('sha1').update(value).digest().subarray(0,16));b[6]=(b[6]&15)|80;b[8]=(b[8]&63)|128;const h=b.toString('hex');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;}
const productId=stableUuid(`${data.fixture}:product`);
const actor=z.uuid().parse(process.env.DEMO_RECORDED_BY);

await db.begin(async tx=>{
  const rows=await tx`select coalesce(sum((select count(*) from public.order_items i where i.order_id=o.id and i.is_custom_cake)),0)::integer as occupied from public.orders o where o.pickup_date=${data.pickup_date}::date and o.status not in ('pending','cancelled') and o.id not in ${tx(data.cakes.map(c=>stableUuid(`${data.fixture}:order:${c.ref}`)))}`;
  if(Number(rows[0].occupied)>0) throw new Error(`A data ${data.pickup_date} já tem ${rows[0].occupied} bolos reservados; escolha outro dia de demonstração.`);
  await tx`insert into public.products(id,name,category,unit,unit_price_cents,allergens,min_lead_hours,is_custom_cake,active)
    values(${productId}::uuid,${data.product.name},${data.product.category},'kg',${data.product.unit_price_cents},${data.product.allergens},${data.product.min_lead_hours},true,true)
    on conflict(id) do update set name=excluded.name,category=excluded.category,unit_price_cents=excluded.unit_price_cents,allergens=excluded.allergens,min_lead_hours=excluded.min_lead_hours,active=true,updated_at=now()`;
  for(const cake of data.cakes){
    const orderId=stableUuid(`${data.fixture}:order:${cake.ref}`); const itemId=stableUuid(`${data.fixture}:item:${cake.ref}`); const paymentKey=stableUuid(`${data.fixture}:payment:${cake.ref}`);
    const total=Math.round(cake.weight_kg*data.product.unit_price_cents); const deposit=depositRequired(total,true);
    const codeHash=createHash('sha256').update(`demo-only:${orderId}`).digest('hex');
    await tx`insert into public.orders(id,tracking_code_hash,customer_name,customer_phone,pickup_at,pickup_date,status,source,total_cents,deposit_required_cents,confirmed_at)
      values(${orderId}::uuid,${codeHash},${cake.customer_name},'+351000000000',${`${data.pickup_date}T10:00:00+00:00`}::timestamptz,${data.pickup_date}::date,'confirmed','counter',${total},${deposit},now())
      on conflict(id) do update set customer_name=excluded.customer_name,pickup_at=excluded.pickup_at,pickup_date=excluded.pickup_date,status='confirmed',total_cents=excluded.total_cents,deposit_required_cents=excluded.deposit_required_cents,confirmed_at=now(),updated_at=now()`;
    await tx`insert into public.order_items(id,order_id,product_id,product_name_snapshot,unit_snapshot,unit_price_cents_snapshot,quantity,subtotal_cents,is_custom_cake,weight_kg,cake_message,declared_allergies)
      values(${itemId}::uuid,${orderId}::uuid,${productId}::uuid,${data.product.name},'kg',${data.product.unit_price_cents},1,${total},true,${cake.weight_kg},${cake.message},${cake.allergies})
      on conflict(id) do update set order_id=excluded.order_id,product_id=excluded.product_id,weight_kg=excluded.weight_kg,cake_message=excluded.cake_message,declared_allergies=excluded.declared_allergies,updated_at=now()`;
    await tx`insert into public.simulated_payments(order_id,kind,amount_cents,recorded_by,note,idempotency_key)
      values(${orderId}::uuid,'deposit',${deposit},${actor}::uuid,'Pagamento fictício da fixture ${data.fixture}',${paymentKey}::uuid)
      on conflict(recorded_by,idempotency_key) do nothing`;
  }
});
console.info(`Fixture ${data.fixture}: ${data.cakes.length} bolos individuais em ${data.pickup_date}.`);
await db.end();
