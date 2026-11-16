import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { depositRequired } from '../src/lib/domain';

test('versioned source preserves eleven products, eight orders, and paid deposits', async () => {
  const source = JSON.parse(await readFile(new URL('../seed/original-data.json', import.meta.url), 'utf8'));
  assert.equal(source.products.length, 11);
  assert.equal(source.orders.length, 8);
  assert.equal(new Set(source.products.map((p:{ref:string})=>p.ref)).size, 11);
  assert.equal(new Set(source.orders.map((o:{ref:string})=>o.ref)).size, 8);
  const sofia=source.orders.find((o:{ref:string})=>o.ref==='sofia-mendes');
  const catarina=source.orders.find((o:{ref:string})=>o.ref==='catarina-sa');
  const pedro=source.orders.find((o:{ref:string})=>o.ref==='pedro-alves');
  assert.equal(sofia.deposit_status,'paid');
  assert.equal(catarina.deposit_status,'paid');
  assert.equal(pedro.deposit_status,'unpaid');
  assert.equal(pedro.status,'pending');
  assert.equal(depositRequired(2*2800,true),1700);
  assert.equal(depositRequired(2.5*3200,true),2400);
  for(const order of source.orders) {
    const weekday=new Intl.DateTimeFormat('en-US',{weekday:'long',timeZone:'Europe/Lisbon'}).format(new Date(order.pickup_at));
    assert.equal(weekday,order.pickup_weekday);
  }
});

test('demo fixture contributes five cakes to the user-created sixth on 24 November', async () => {
  const fixture=JSON.parse(await readFile(new URL('../seed/demo-day.json',import.meta.url),'utf8'));
  assert.equal(fixture.reference_at,'2026-11-17T10:00:00+00:00');
  assert.equal(fixture.pickup_date,'2026-11-24');
  assert.equal(fixture.pickup_timezone,'Europe/Lisbon');
  assert.equal(fixture.product_ref,'bolo-chocolate');
  assert.equal(fixture.cakes.length,5);
  assert.equal(new Set(fixture.cakes.map((c:{ref:string})=>c.ref)).size,5);
  assert.equal(fixture.cakes.every((c:{weight_kg:number})=>c.weight_kg>0),true);
});
