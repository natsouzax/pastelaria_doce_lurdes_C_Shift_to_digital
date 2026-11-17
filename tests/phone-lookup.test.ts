import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { phoneTail } from '../src/lib/domain';

test('phoneTail ignores formatting and country code, and rejects short numbers', () => {
  assert.equal(phoneTail('912 345 678'), '912345678');
  assert.equal(phoneTail('+351 912-345-678'), '912345678');
  assert.equal(phoneTail('00351912345678'), '912345678');
  assert.equal(phoneTail('(912) 345.678'), '912345678');
  assert.equal(phoneTail('12345678'), null);
  assert.equal(phoneTail('abc'), null);
});

test('phone lookup query matches differently formatted numbers and nothing else', async () => {
  const pg = await PGlite.create();
  try {
    await pg.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);`);
    await pg.exec(await readFile(new URL('../supabase/migrations/20261116210057_initial_schema.sql', import.meta.url), 'utf8'));
    const product = randomUUID();
    await pg.query(`insert into public.products(id,name,category,unit,unit_price_cents,min_lead_hours) values($1,'Pão de ló','Bolo','unidade',1400,48)`, [product]);
    const phones = ['+351 912 345 678', '912345678', '913 000 111', '000'];
    for (const [i, phone] of phones.entries()) {
      const id = randomUUID();
      await pg.query(`insert into public.orders(id,tracking_code_hash,customer_name,customer_phone,pickup_at,pickup_date,status,total_cents,deposit_required_cents)
        values($1,$2,'Test',$3,$4::timestamptz,$5::date,'pending',1400,0)`, [id, createHash('sha256').update(id).digest('hex'), phone, `2026-12-1${i}T10:00:00Z`, `2026-12-1${i}`]);
      await pg.query(`insert into public.order_items(order_id,product_id,product_name_snapshot,unit_snapshot,unit_price_cents_snapshot,quantity,subtotal_cents,is_custom_cake) values($1,$2,'Pão de ló','unidade',1400,1,1400,false)`, [id, product]);
    }
    const find = (phone: string) => pg.query<{ pickup_at: string }>(
      `select pickup_at from public.orders where right(regexp_replace(customer_phone, '[^0-9]', '', 'g'), 9) = $1 order by pickup_at desc, id limit 20`, [phoneTail(phone)]);
    assert.equal((await find('912345678')).rows.length, 2);
    assert.equal((await find('+351 912 345 678')).rows.length, 2);
    assert.equal((await find('913000111')).rows.length, 1);
    assert.equal((await find('999999999')).rows.length, 0);
  } finally { await pg.close(); }
});
