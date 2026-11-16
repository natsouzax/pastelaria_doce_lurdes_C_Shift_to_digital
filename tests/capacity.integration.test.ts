import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import postgres from 'postgres';
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());
const databaseUrl = process.env.DATABASE_URL;
test('simultaneous confirmations cannot reserve a seventh cake', { skip: !databaseUrl }, async () => {
  const sql = postgres(databaseUrl!, { max: 10, prepare: false });
  const productId = randomUUID();
  const orderIds = Array.from({ length: 7 }, randomUUID);
  const actorId = randomUUID();
  const day = '2026-12-08';
  const codeHashes = orderIds.map(id => createHash('sha256').update(id).digest('hex'));
  try {
    await sql.begin(async tx => {
      await tx`insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
        values(${actorId}::uuid,'authenticated','authenticated',${`capacity-${actorId}@example.invalid`},'',now(),'{}'::jsonb,'{}'::jsonb,now(),now())`;
      await tx`insert into public.products(id,name,category,unit,unit_price_cents,min_lead_hours,is_custom_cake) values (${productId},'capacity test','test','kg',2800,120,true)`;
      for (let n = 0; n < 7; n++) {
        const status = n < 5 ? 'confirmed' : 'pending';
        await tx`insert into public.orders(id,tracking_code_hash,customer_name,customer_phone,pickup_at,pickup_date,status,total_cents,deposit_required_cents)
          values (${orderIds[n]},${codeHashes[n]},'Test','000',${`${day}T10:00:00Z`}::timestamptz,${day}::date,${status}::public.order_status,5600,1700)`;
        await tx`insert into public.order_items(order_id,product_id,product_name_snapshot,unit_snapshot,unit_price_cents_snapshot,quantity,subtotal_cents,is_custom_cake,weight_kg)
          values (${orderIds[n]},${productId},'capacity test','kg',2800,1,5600,true,2)`;
      }
    });
    const attempt = (index: number) => sql.begin(async tx => tx`select public.confirm_order_after_deposit(
      ${orderIds[index]},${actorId},${randomUUID()},1700,false,'concurrency test') as outcome`);
    const results = await Promise.allSettled([attempt(5), attempt(6)]);
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(results.filter(r => r.status === 'rejected').length, 1);
    const counts = await sql`select count(*)::integer as reserved from public.orders where pickup_date=${day}::date and status <> 'pending' and status <> 'cancelled'`;
    assert.equal(Number(counts[0].reserved), 6);
  } finally {
    await sql`delete from public.simulated_payments where order_id = any(${sql.array(orderIds)})`;
    await sql`delete from public.orders where id = any(${sql.array(orderIds)})`;
    await sql`delete from public.products where id=${productId}`;
    await sql`delete from auth.users where id=${actorId}::uuid`;
    await sql.end();
  }
});
