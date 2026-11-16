import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { depositRequired } from '../src/lib/domain';
import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
const { db } = await import('../src/lib/db');

const unit = z.enum(['kg','unidade','cento','duzia','meia_duzia']);
const orderStatus = z.enum(['pending','confirmed','in_production','ready','delivered','cancelled']);
const schema = z.object({
  date_assignment_notes: z.string().trim().min(20),
  products: z.array(z.object({ ref:z.string().min(1),name:z.string().min(1),category:z.string(),unit,unit_price_cents:z.number().int().nonnegative(),allergens:z.array(z.string()),min_lead_hours:z.number().int().nonnegative(),is_custom_cake:z.boolean(),active:z.boolean().default(true) })).length(11),
  orders: z.array(z.object({ ref:z.string().min(1),customer_name:z.string().min(1),customer_phone:z.string().min(1),pickup_at:z.string(),pickup_date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),pickup_weekday:z.enum(['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']),status:orderStatus,notes:z.string().nullable().optional(),source:z.enum(['online','counter','phone']).default('counter'),items:z.array(z.object({product_ref:z.string(),quantity:z.number().positive(),weight_kg:z.number().positive().nullable().optional(),cake_message:z.string().nullable().optional(),declared_allergies:z.array(z.string()).default([])})).min(1) })).length(8),
}).strict();

function stableUuid(value:string) {
  const b=Buffer.from(createHash('sha1').update(value).digest().subarray(0,16));
  b[6]=(b[6]&0x0f)|0x50; b[8]=(b[8]&0x3f)|0x80;
  const h=b.toString('hex'); return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

const raw=JSON.parse(await readFile('seed/original-data.json','utf8'));
const data=schema.parse(raw);
const weekdayMap=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
for (const order of data.orders) {
  const date=new Date(`${order.pickup_date}T12:00:00Z`);
  const pickupAt=new Date(order.pickup_at);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0,10)!==order.pickup_date || weekdayMap[date.getUTCDay()]!==order.pickup_weekday) throw new Error(`A data atribuída a ${order.ref} é inválida ou não corresponde ao dia da semana original.`);
  if (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(order.pickup_at) || Number.isNaN(pickupAt.getTime()) || new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Lisbon'}).format(pickupAt)!==order.pickup_date) throw new Error(`O instante de levantamento de ${order.ref} não corresponde à data Europe/Lisbon atribuída.`);
}

await db.begin(async tx => {
  const productIds=new Map<string,string>();
  for (const product of data.products) {
    const id=stableUuid(`cliente-c:product:${product.ref}`); productIds.set(product.ref,id);
    await tx`insert into public.products(id,name,category,unit,unit_price_cents,allergens,min_lead_hours,is_custom_cake,active)
      values (${id}::uuid,${product.name},${product.category},${product.unit}::public.product_unit,${product.unit_price_cents},${product.allergens},${product.min_lead_hours},${product.is_custom_cake},${product.active})
      on conflict(id) do update set name=excluded.name,category=excluded.category,unit=excluded.unit,unit_price_cents=excluded.unit_price_cents,allergens=excluded.allergens,min_lead_hours=excluded.min_lead_hours,is_custom_cake=excluded.is_custom_cake,active=excluded.active,updated_at=now()`;
  }
  for (const order of data.orders) {
    const orderId=stableUuid(`cliente-c:order:${order.ref}`);
    let total=0; const items=[];
    for (const item of order.items) {
      const product=data.products.find(p=>p.ref===item.product_ref); const productId=productIds.get(item.product_ref);
      if (!product || !productId) throw new Error(`Produto desconhecido ${item.product_ref} no pedido ${order.ref}.`);
      const custom=product.is_custom_cake;
      if (custom && (item.quantity!==1 || !item.weight_kg)) throw new Error(`Cada bolo personalizado deve ser um item individual com peso: ${order.ref}.`);
      const subtotal=custom?Math.round(item.weight_kg!*product.unit_price_cents):Math.round(item.quantity*product.unit_price_cents);
      total+=subtotal; items.push({item,product,productId,custom,subtotal});
    }
    const deposit=depositRequired(total,items.some(i=>i.custom));
    const trackingHash=createHash('sha256').update(`historical-order:${order.ref}`).digest('hex');
    await tx`insert into public.orders(id,tracking_code_hash,customer_name,customer_phone,pickup_at,pickup_date,status,notes,source,total_cents,deposit_required_cents)
      values (${orderId}::uuid,${trackingHash},${order.customer_name},${order.customer_phone},${order.pickup_at}::timestamptz,${order.pickup_date}::date,${order.status}::public.order_status,${order.notes??null},${order.source}::public.order_source,${total},${deposit})
      on conflict(id) do update set customer_name=excluded.customer_name,customer_phone=excluded.customer_phone,pickup_at=excluded.pickup_at,pickup_date=excluded.pickup_date,status=excluded.status,notes=excluded.notes,source=excluded.source,total_cents=excluded.total_cents,deposit_required_cents=excluded.deposit_required_cents,updated_at=now()`;
    await tx`delete from public.order_items where order_id=${orderId}::uuid`;
    for (const {item,product,productId,custom,subtotal} of items) {
      await tx`insert into public.order_items(order_id,product_id,product_name_snapshot,unit_snapshot,unit_price_cents_snapshot,quantity,subtotal_cents,is_custom_cake,weight_kg,cake_message,declared_allergies)
        values (${orderId}::uuid,${productId}::uuid,${product.name},${product.unit}::public.product_unit,${product.unit_price_cents},${custom?1:item.quantity},${subtotal},${custom},${custom?item.weight_kg??null:null},${custom?item.cake_message??null:null},${custom?item.declared_allergies:[]})`;
    }
  }
});
console.info(`Seed Cliente C carregado: ${data.products.length} produtos e ${data.orders.length} pedidos.`);
await db.end();
