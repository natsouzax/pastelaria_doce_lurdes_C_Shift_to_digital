import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { DAILY_CAKE_LIMIT, cakeUnits } from '../src/lib/cakes';

const products = [
  { name: 'Bolo personalizado', category: 'Bolo personalizado', unit: 'kg', is_custom_cake: true },
  { name: 'Pão de ló', category: 'Bolo', unit: 'unidade', is_custom_cake: false },
  { name: 'Bolo de bolacha', category: 'Bolo', unit: 'kg', is_custom_cake: false },
  { name: 'Rissóis', category: 'Salgados', unit: 'cento', is_custom_cake: false },
  { name: 'Brigadeiros', category: 'Doces', unit: 'duzia', is_custom_cake: false },
] as const;

test('cakeUnits counts custom cakes, unit cakes by quantity and kg cakes once; other products zero', () => {
  assert.equal(DAILY_CAKE_LIMIT, 6);
  assert.equal(cakeUnits(products[0], 1), 1);
  assert.equal(cakeUnits(products[1], 3), 3);
  assert.equal(cakeUnits(products[1], 0), 1);
  assert.equal(cakeUnits(products[2], 2.5), 1);
  assert.equal(cakeUnits(products[3], 5), 0);
  assert.equal(cakeUnits(products[4], 2), 0);
});

test('SQL daily cake count matches cakeUnits, includes pending orders and ignores cancelled ones', async () => {
  const pg = await PGlite.create();
  try {
    await pg.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);`);
    await pg.exec(await readFile(new URL('../supabase/migrations/20261116210057_initial_schema.sql', import.meta.url), 'utf8'));
    const ids = new Map<string, string>();
    for (const p of products) {
      const id = randomUUID(); ids.set(p.name, id);
      await pg.query(`insert into public.products(id,name,category,unit,unit_price_cents,min_lead_hours,is_custom_cake) values($1,$2,$3,$4::public.product_unit,1000,$6,$5)`, [id, p.name, p.category, p.unit, p.is_custom_cake, p.is_custom_cake ? 120 : 48]);
    }
    const day = '2026-12-09';
    const order = async (status: string, lines: Array<[string, number]>) => {
      const id = randomUUID();
      await pg.query(`insert into public.orders(id,tracking_code_hash,customer_name,customer_phone,pickup_at,pickup_date,status,total_cents,deposit_required_cents)
        values($1,$2,'Cliente','912345678',$3::timestamptz,$4::date,$5::public.order_status,1000,0)`, [id, createHash('sha256').update(id).digest('hex'), `${day}T10:00:00Z`, day, status]);
      for (const [name, quantity] of lines) {
        const p = products.find(item => item.name === name)!;
        await pg.query(`insert into public.order_items(order_id,product_id,product_name_snapshot,unit_snapshot,unit_price_cents_snapshot,quantity,subtotal_cents,is_custom_cake,weight_kg)
          values($1,$2,$3,$4::public.product_unit,1000,$5,1000,$6,$7)`, [id, ids.get(name), name, p.unit, quantity, p.is_custom_cake, p.is_custom_cake ? 2 : null]);
      }
    };
    await order('pending', [['Bolo personalizado', 1], ['Pão de ló', 3], ['Rissóis', 2]]);   // 1 + 3 + 0 = 4
    await order('confirmed', [['Bolo de bolacha', 2.5], ['Brigadeiros', 1]]);                // 1
    await order('cancelled', [['Pão de ló', 5]]);                                              // ignorado
    const { rows } = await pg.query<{ count: number }>(`select coalesce(sum(case
        when i.is_custom_cake then 1
        when lower(p.category) like '%bolo%' then case when i.unit_snapshot = 'unidade' then greatest(1, ceil(i.quantity))::integer else 1 end
        else 0 end), 0)::integer as count
      from public.order_items i join public.orders o on o.id = i.order_id join public.products p on p.id = i.product_id
      where o.pickup_date = $1::date and o.status <> 'cancelled'`, [day]);
    const expected = cakeUnits(products[0], 1) + cakeUnits(products[1], 3) + cakeUnits(products[3], 2) + cakeUnits(products[2], 2.5) + cakeUnits(products[4], 1);
    assert.equal(rows[0].count, 5);
    assert.equal(rows[0].count, expected);
  } finally { await pg.close(); }
});
