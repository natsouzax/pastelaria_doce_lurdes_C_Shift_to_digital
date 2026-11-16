import test from 'node:test';
import assert from 'node:assert/strict';
import { api, ApiFailure, type NewOrder } from '../src/lib/api';
import { lisbonPickupTimestamp } from '../src/lib/dates';

test('public order uses the REST contract and exposes the one-time tracking code', async () => {
  const original = globalThis.fetch;
  let captured: { path:string; init:RequestInit } | undefined;
  globalThis.fetch = (async (path:RequestInfo|URL, init:RequestInit) => {
    captured = { path:String(path), init };
    return new Response(JSON.stringify({ order_id:'order-1', tracking_code:'secret', status:'pending', pickup_at:'2026-11-24T10:00:00+00:00', total_cents:5600, deposit_required_cents:1700, amount_paid_cents:0, balance_due_cents:5600, capacity_reserved:false, message:'Aguarde confirmação.' }), { status:201, headers:{'Content-Type':'application/json'} });
  }) as typeof fetch;
  try {
    const payload: NewOrder = {customer:{name:'Inês',phone:'000'},pickup_at:'2026-11-24T10:00:00+00:00',notes:null,items:[{product_id:'product-1',quantity:1,weight_kg:2,cake_message:'Parabéns Inês',declared_allergies:['frutos secos']}]};
    const result = await api.createOrder(payload);
    assert.equal(captured?.path,'/api/orders');
    assert.equal(captured?.init.method,'POST');
    assert.deepEqual(JSON.parse(String(captured?.init.body)),payload);
    assert.equal(result.tracking_code,'secret');
  } finally { globalThis.fetch = original; }
});

test('staff requests use local pickup date and an idempotent payment key', async () => {
  const original = globalThis.fetch;
  const requests:Array<{path:string;init:RequestInit}>=[];
  globalThis.fetch = (async (path:RequestInfo|URL, init:RequestInit) => {
    requests.push({path:String(path),init});
    return new Response(JSON.stringify(String(path).includes('/payments')?{order:{status:'confirmed'}}:{data:[],next_cursor:null}),{status:200,headers:{'Content-Type':'application/json'}});
  }) as typeof fetch;
  try {
    await api.staffOrders('2026-11-24');
    await api.payment('order-1','deposit',1700,true,'3c84079b-9608-48bd-9c93-a24e7d0e2145');
    assert.equal(requests[0].path,'/api/staff/orders?pickup_date=2026-11-24');
    assert.equal(new Headers(requests[1].init.headers).get('Idempotency-Key'),'3c84079b-9608-48bd-9c93-a24e7d0e2145');
    assert.deepEqual(JSON.parse(String(requests[1].init.body)),{kind:'deposit',amount_cents:1700,external_payment_received:true,note:null});
  } finally { globalThis.fetch = original; }
});

test('business errors retain the nested code and the external payment flag', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({error:{code:'CAPACITY_LOST_AFTER_PAYMENT',message:'Sem vaga',payment_recorded:true}}),{status:409,headers:{'Content-Type':'application/json'}})) as typeof fetch;
  try { await assert.rejects(api.payment('order-1','deposit',1700,true,'key'), error => error instanceof ApiFailure && error.code==='CAPACITY_LOST_AFTER_PAYMENT' && error.paymentRecorded); }
  finally { globalThis.fetch = original; }
});

test('Lisbon pickup offsets follow winter and summer time', () => {
  assert.equal(lisbonPickupTimestamp('2026-11-24','10:00'),'2026-11-24T10:00:00+00:00');
  assert.equal(lisbonPickupTimestamp('2026-07-24','10:00'),'2026-07-24T10:00:00+01:00');
});
