import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import postgres from 'postgres';
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const testDatabaseHost = testDatabaseUrl ? new URL(testDatabaseUrl).hostname : '';
const isLocalTestDatabase = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(testDatabaseHost);
const databaseUrl = process.env.RUN_DATABASE_INTEGRATION_TESTS === '1'
  && testDatabaseUrl
  && (isLocalTestDatabase || process.env.TEST_ALLOW_REMOTE_DATABASE === 'true')
  ? testDatabaseUrl
  : undefined;

test('daily order limit allows six and rejects confirmation of a seventh', { skip: !databaseUrl }, async () => {
  const sql = postgres(databaseUrl!, { max: 10, prepare: false });
  const productId = randomUUID();
  const orderIds = Array.from({ length: 7 }, randomUUID);
  const actorId = randomUUID();
  const pickupDay = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000);
  while (pickupDay.getUTCDay() === 1) pickupDay.setUTCDate(pickupDay.getUTCDate() + 1);
  const day = pickupDay.toISOString().slice(0, 10);
  const codeHashes = orderIds.map(id => createHash('sha256').update(id).digest('hex'));
  try {
    await sql.begin(async tx => {
      await tx`insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
        values(${actorId}::uuid,'authenticated','authenticated',${`capacity-${actorId}@example.invalid`},'',now(),'{}'::jsonb,'{}'::jsonb,now(),now())`;
      await tx`insert into public.products(id,name,category,unit,unit_price_cents,min_lead_hours,is_custom_cake) values (${productId},'capacity test','test','kg',2800,120,true)`;
      for (let n = 0; n < 6; n++) {
        const status = n < 5 ? 'confirmed' : 'pending';
        await tx`insert into public.orders(id,tracking_code_hash,customer_name,customer_phone,pickup_at,pickup_date,status,total_cents,deposit_required_cents)
          values (${orderIds[n]},${codeHashes[n]},'Test','000',${`${day}T10:00:00Z`}::timestamptz,${day}::date,${status}::public.order_status,5600,1700)`;
        await tx`insert into public.order_items(order_id,product_id,product_name_snapshot,unit_snapshot,unit_price_cents_snapshot,quantity,subtotal_cents,is_custom_cake,weight_kg)
          values (${orderIds[n]},${productId},'capacity test','kg',2800,1,5600,true,2)`;
      }
    });
    const attempt = (index: number) => sql.begin(async tx => tx`select public.confirm_order_after_deposit(
      ${orderIds[index]},${actorId},${randomUUID()},1700,false,'concurrency test') as outcome`);
    const sixth = await attempt(5);
    assert.equal((sixth[0].outcome as { result: string }).result, 'confirmed');

    await sql`insert into public.orders(id,tracking_code_hash,customer_name,customer_phone,pickup_at,pickup_date,status,total_cents,deposit_required_cents)
      values (${orderIds[6]},${codeHashes[6]},'Test','000',${`${day}T10:00:00Z`}::timestamptz,${day}::date,'pending',5600,1700)`;
    await sql`insert into public.order_items(order_id,product_id,product_name_snapshot,unit_snapshot,unit_price_cents_snapshot,quantity,subtotal_cents,is_custom_cake,weight_kg)
      values (${orderIds[6]},${productId},'capacity test','kg',2800,1,5600,true,2)`;

    await assert.rejects(attempt(6), /CAPACITY_FULL/);
    const state = await sql`select
      (select count(*)::integer from public.orders where pickup_date=${day}::date and status <> 'cancelled') as orders,
      (select count(*)::integer from public.simulated_payments where order_id=${orderIds[6]}) as seventh_order_payments,
      (select status::text from public.orders where id=${orderIds[5]}) as sixth_status,
      (select status::text from public.orders where id=${orderIds[6]}) as seventh_status`;
    assert.equal(Number(state[0].orders), 7);
    assert.equal(Number(state[0].seventh_order_payments), 0);
    assert.equal(state[0].sixth_status, 'confirmed');
    assert.equal(state[0].seventh_status, 'pending');
  } finally {
    await sql`delete from public.simulated_payments where order_id = any(${sql.array(orderIds)})`;
    await sql`delete from public.orders where id = any(${sql.array(orderIds)})`;
    await sql`delete from public.products where id=${productId}`;
    await sql`delete from auth.users where id=${actorId}::uuid`;
    await sql.end();
  }
});
