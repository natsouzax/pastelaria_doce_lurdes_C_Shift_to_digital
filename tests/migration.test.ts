import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('initial migration applies; capacity, payment fallback and database grants behave as specified', async () => {
  const pg = await PGlite.create();
  try {
    await pg.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);`);
    const migration = await readFile(new URL('../supabase/migrations/20261116210057_initial_schema.sql', import.meta.url), 'utf8');
    await pg.exec(migration);
    const acl = await pg.query(`select has_table_privilege('anon','public.orders','select') as anon_read,
      has_function_privilege('anon','public.confirm_order_after_deposit(uuid,uuid,uuid,integer,boolean,text)','execute') as anon_confirm,
      has_function_privilege('service_role','public.confirm_order_after_deposit(uuid,uuid,uuid,integer,boolean,text)','execute') as server_confirm`);
    assert.deepEqual(acl.rows[0], { anon_read: false, anon_confirm: false, server_confirm: true });

    const actor = randomUUID();
    await pg.query('insert into auth.users(id) values ($1)', [actor]);
    const product = randomUUID();
    await pg.query(`insert into public.products(id,name,category,unit,unit_price_cents,min_lead_hours,is_custom_cake)
      values($1,'Cake','Demo','kg',2800,120,true)`, [product]);
    const day='2026-12-08';
    const orders=Array.from({length:8},()=>randomUUID());
    for(let i=0;i<7;i++){
      const id=orders[i];
      const tracking=createHash('sha256').update(id).digest('hex');
      await pg.query(`insert into public.orders(id,tracking_code_hash,customer_name,customer_phone,pickup_at,pickup_date,status,total_cents,deposit_required_cents)
        values($1,$2,'Test','000',$3::timestamptz,$4::date,$5::public.order_status,5600,1700)`,
        [id,tracking,`${day}T10:00:00Z`,day,i<6?'confirmed':'pending']);
      await pg.query(`insert into public.order_items(order_id,product_id,product_name_snapshot,unit_snapshot,unit_price_cents_snapshot,quantity,subtotal_cents,is_custom_cake,weight_kg)
        values($1,$2,'Cake','kg',2800,1,5600,true,2)`,[id,product]);
    }
    const attempt=(id:string,external:boolean)=>pg.query<{result:{result:string}}>(`select public.confirm_order_after_deposit($1,$2,$3,1700,$4,null) as result`,[id,actor,randomUUID(),external]);
    await assert.rejects(attempt(orders[6],false),/CAPACITY_FULL/);
    const noPayment=await pg.query<{n:number}>('select count(*)::integer as n from public.simulated_payments where order_id=$1',[orders[6]]);
    assert.equal(noPayment.rows[0].n,0);

    const latePayment=await attempt(orders[6],true);
    assert.equal(latePayment.rows[0].result.result,'capacity_lost_after_payment');
    const order=await pg.query<{status:string;capacity_resolution_required:boolean}>('select status,capacity_resolution_required from public.orders where id=$1',[orders[6]]);
    assert.deepEqual(order.rows[0],{status:'pending',capacity_resolution_required:true});
    const stillSix=await pg.query<{n:number}>(`select count(*)::integer as n from public.orders where pickup_date=$1::date and status not in ('pending','cancelled')`,[day]);
    assert.equal(stillSix.rows[0].n,6);
    await pg.query(`update public.orders set status='cancelled',cancelled_at=now() where id=$1`,[orders[0]]);
    const ninth=orders[7];
    const ninthHash=createHash('sha256').update(ninth).digest('hex');
    await pg.query(`insert into public.orders(id,tracking_code_hash,customer_name,customer_phone,pickup_at,pickup_date,status,total_cents,deposit_required_cents)
      values($1,$2,'Test','000',$3::timestamptz,$4::date,'pending',5600,1700)`,[ninth,ninthHash,`${day}T10:00:00Z`,day]);
    await pg.query(`insert into public.order_items(order_id,product_id,product_name_snapshot,unit_snapshot,unit_price_cents_snapshot,quantity,subtotal_cents,is_custom_cake,weight_kg)
      values($1,$2,'Cake','kg',2800,1,5600,true,2)`,[ninth,product]);
    const confirmed=await attempt(ninth,false);
    assert.equal(confirmed.rows[0].result.result,'confirmed');
  } finally { await pg.close(); }
});
