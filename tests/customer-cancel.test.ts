import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { canCustomerCancel } from '../src/lib/domain';

test('customer can only cancel unpaid pending/confirmed orders without capacity conflict', () => {
  const ok = { status: 'pending', paymentCount: 0, capacityResolutionRequired: false };
  assert.equal(canCustomerCancel(ok), true);
  assert.equal(canCustomerCancel({ ...ok, status: 'confirmed' }), true);
  for (const status of ['in_production', 'ready', 'delivered', 'cancelled']) assert.equal(canCustomerCancel({ ...ok, status }), false, status);
  assert.equal(canCustomerCancel({ ...ok, paymentCount: 1 }), false);
  assert.equal(canCustomerCancel({ ...ok, capacityResolutionRequired: true }), false);
});

test('cancelling an unpaid order frees its capacity; paid orders are detected', async () => {
  const pg = await PGlite.create();
  try {
    await pg.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);`);
    await pg.exec(await readFile(new URL('../supabase/migrations/20261116210057_initial_schema.sql', import.meta.url), 'utf8'));
    const actor = randomUUID(); const product = randomUUID();
    await pg.query('insert into auth.users(id) values ($1)', [actor]);
    await pg.query(`insert into public.products(id,name,category,unit,unit_price_cents,min_lead_hours,is_custom_cake) values($1,'Bolo','Bolo personalizado','kg',2800,120,true)`, [product]);
    const make = async (status: string) => {
      const id = randomUUID();
      await pg.query(`insert into public.orders(id,tracking_code_hash,customer_name,customer_phone,pickup_at,pickup_date,status,total_cents,deposit_required_cents)
        values($1,$2,'Test','912345678','2026-12-08T10:00:00Z','2026-12-08',$3::public.order_status,5600,1700)`, [id, createHash('sha256').update(id).digest('hex'), status]);
      await pg.query(`insert into public.order_items(order_id,product_id,product_name_snapshot,unit_snapshot,unit_price_cents_snapshot,quantity,subtotal_cents,is_custom_cake,weight_kg) values($1,$2,'Bolo','kg',2800,1,5600,true,2)`, [id, product]);
      return id;
    };
    const reserved = async () => Number((await pg.query<{ n: number }>(`select count(*)::integer as n from public.orders where pickup_date='2026-12-08' and status not in ('pending','cancelled')`)).rows[0].n);
    const unpaid = await make('confirmed');
    const paid = await make('confirmed');
    await pg.query(`insert into public.simulated_payments(order_id,kind,amount_cents,recorded_by,idempotency_key) values($1,'deposit',1700,$2,gen_random_uuid())`, [paid, actor]);
    assert.equal(await reserved(), 2);
    const paymentCount = async (id: string) => Number((await pg.query<{ n: number }>('select count(*)::integer as n from public.simulated_payments where order_id=$1', [id])).rows[0].n);
    assert.equal(await paymentCount(paid), 1);
    assert.equal(await paymentCount(unpaid), 0);
    await pg.query(`update public.orders set status='cancelled', cancelled_at=now(), cancellation_reason='Cancelado pelo cliente', updated_at=now() where id=$1`, [unpaid]);
    assert.equal(await reserved(), 1);
  } finally { await pg.close(); }
});
