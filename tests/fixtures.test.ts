import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('the demo day fixture has six separately identified personalized cakes', async () => {
  const fixture=JSON.parse(await readFile(new URL('../seed/demo-day.json',import.meta.url),'utf8')) as {fixture:string;pickup_date:string;pickup_timezone:string;product:{unit_price_cents:number};cakes:{ref:string;weight_kg:number;message:string|null;allergies:string[]}[]};
  assert.equal(fixture.fixture,'demo-day-six-custom-cakes');
  assert.equal(fixture.pickup_date,'2026-12-08');
  assert.equal(fixture.pickup_timezone,'Europe/Lisbon');
  assert.equal(fixture.cakes.length,6);
  assert.equal(new Set(fixture.cakes.map(c=>c.ref)).size,6);
  const ines=fixture.cakes.find(c=>c.ref==='ines-chocolate-2kg');
  assert.equal(ines?.weight_kg,2);
  assert.equal(ines?.message,'Parabéns Inês');
  assert.deepEqual(ines?.allergies,['frutos secos']);
  assert.equal(fixture.product.unit_price_cents*2,5600);
});
