import { useState } from 'react';
import { api, type PhoneOrder, type TrackedOrder } from '@/lib/api';
import { dateLabel } from '@/lib/dates';
import { describeError, euro, pickupTimeLabel, units, weightLabel, type Problem } from './presentation';
import { Icon, Notice, Status, Timeline } from './ui';

type Props = { code: string; setCode: (code: string) => void; tracked: TrackedOrder | null; error: Problem | null; busy: boolean; submit: (event: React.FormEvent) => void; cancel: () => Promise<void> };

function PhoneLookup() {
  const [phone, setPhone] = useState('');
  const [orders, setOrders] = useState<PhoneOrder[] | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<PhoneOrder | null>(null);
  const [error, setError] = useState<Problem | null>(null);
  const [busy, setBusy] = useState(false);
  async function search(event: React.FormEvent) {
    event.preventDefault();
    setError(null); setOrders(null); setSelectedOrder(null); setBusy(true);
    try { setOrders(await api.ordersByPhone(phone)); }
    catch (failure) { setError(describeError(failure)); }
    finally { setBusy(false); }
  }
  const digits = phone.replace(/\D/g, '').length;
  return <>
    <form className="tracking-search" onSubmit={search}>
      <div className="field"><label htmlFor="tracking-phone">Telefone usado no pedido</label><input id="tracking-phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={40} required value={phone} onChange={event => setPhone(event.target.value)} placeholder="Ex.: 912 345 678" /></div>
      <button className="button primary" disabled={busy || digits < 9}>{busy ? 'A procurar…' : 'Ver os meus pedidos'}{!busy && <Icon name="arrow" size={18} />}</button>
    </form>
    <div aria-live="polite">
      {error && <Notice tone="error">{error.message}</Notice>}
      {orders && !orders.length && <Notice>Não encontrámos pedidos com este telefone. Confirme o número ou fale com a pastelaria.</Notice>}
      {orders && orders.length > 0 && !selectedOrder && <div className="phone-orders">
        <p className="muted tracking-hint">{orders.length === 1 ? '1 pedido encontrado' : `${orders.length} pedidos encontrados`}. Selecione um pedido para abrir todos os detalhes.</p>
        {orders.map((order, index) => <article className="panel phone-order" key={index}>
          <div className="phone-order-head"><div><span className="eyebrow">Levantamento</span><h2>{dateLabel(new Date(order.pickup_at))} · {pickupTimeLabel(order.pickup_at)}</h2></div><Status value={order.status} /></div>
          <ul>{order.items.map((item, itemIndex) => <li key={itemIndex}><span>{item.product_name}</span><span className="muted">{item.weight_kg ? weightLabel(item.weight_kg) : `${item.quantity} × ${units[item.unit]}`}</span></li>)}</ul>
          <button type="button" className="button secondary" onClick={() => setSelectedOrder(order)}>Abrir pedido completo<Icon name="arrow" size={18} /></button>
        </article>)}
      </div>}
      {selectedOrder && <div className="tracking-result phone-order-detail">
        <button type="button" className="button ghost" onClick={() => setSelectedOrder(null)}><Icon name="back" size={18} />Voltar aos pedidos</button>
        <div className="tracking-top">
          <section className="panel">
            <div className="tracking-status"><span className="eyebrow">Estado do pedido</span><Status value={selectedOrder.status} /></div>
            <Timeline status={selectedOrder.status} />
            <div className="phone-customer-details"><h2>Dados do pedido</h2><p><strong>Cliente:</strong> {selectedOrder.customer_name}</p><p><strong>Telefone:</strong> <a href={`tel:${selectedOrder.customer_phone}`}>{selectedOrder.customer_phone}</a></p>{selectedOrder.notes && <p><strong>Observações:</strong> {selectedOrder.notes}</p>}</div>
          </section>
          <aside className="panel pickup-card"><span className="eyebrow">Levantamento</span><h2>{dateLabel(new Date(selectedOrder.pickup_at))}</h2><p className="pickup-time">{pickupTimeLabel(selectedOrder.pickup_at)} <small>hora de Lisboa</small></p>
            <dl className="money"><div><dt>Total</dt><dd>{euro(selectedOrder.total_cents)}</dd></div>{selectedOrder.deposit_required_cents > 0 && <div><dt>Sinal previsto</dt><dd>{euro(selectedOrder.deposit_required_cents)}</dd></div>}<div><dt>Pago</dt><dd>{euro(selectedOrder.amount_paid_cents)}</dd></div><div><dt>Por pagar</dt><dd>{euro(selectedOrder.balance_due_cents)}</dd></div></dl>
          </aside>
        </div>
        <h2 className="tracked-heading">Produtos do pedido</h2>
        <div className="tracked-list">{selectedOrder.items.map((item, index) => <article className="tracked-item phone-detail-item" key={index}><div>
          <h3>{item.product_name}</h3><p>{item.weight_kg ? weightLabel(item.weight_kg) : `${item.quantity} × ${units[item.unit]}`}</p>
          <p>Preço unitário: {euro(item.unit_price_cents)} · Subtotal: {euro(item.subtotal_cents)}</p>
          {item.cake_message && <p><strong>Mensagem:</strong> “{item.cake_message}”</p>}
          {item.declared_allergies.length > 0 && <p><strong>Alergias declaradas:</strong> {item.declared_allergies.join(', ')}</p>}
          {item.product_allergens.length > 0 && <p><strong>Ingredientes alergénicos:</strong> {item.product_allergens.join(', ')}</p>}
          {item.production_notes && <p><strong>Notas:</strong> {item.production_notes}</p>}
        </div><Status value={item.production_status} /></article>)}</div>
        <section className="panel phone-payments"><h2>Pagamentos</h2>{selectedOrder.payments.length ? <div className="payment-list">{selectedOrder.payments.map((payment, index) => <p key={index}><strong>{payment.kind === 'deposit' ? 'Sinal' : payment.kind === 'balance' ? 'Restante' : 'Reembolso'}</strong><span>{euro(payment.amount_cents)} · {new Date(payment.recorded_at).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })}</span>{payment.note && <small>{payment.note}</small>}</p>)}</div> : <p className="muted">Ainda não há pagamentos registados.</p>}</section>
      </div>}
    </div>
  </>;
}

function CancelOrder({ cancel }: { cancel: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Problem | null>(null);
  async function run() {
    setBusy(true); setError(null);
    try { await cancel(); } catch (failure) { setError(describeError(failure)); setConfirming(false); } finally { setBusy(false); }
  }
  return <div className="panel cancel-box">
    <div><h2>Precisa de cancelar?</h2><p className="muted">Ainda não há pagamento registado, por isso pode cancelar este pedido aqui. Depois de cancelado, não é possível voltar atrás.</p></div>
    {error && <Notice tone="error">{error.message}</Notice>}
    {confirming
      ? <div className="cancel-actions" role="alertdialog" aria-label="Confirmar cancelamento"><strong>Tem a certeza?</strong><button type="button" className="button danger" disabled={busy} onClick={() => void run()}>{busy ? 'A cancelar…' : 'Sim, cancelar pedido'}</button><button type="button" className="button ghost" disabled={busy} onClick={() => setConfirming(false)}>Manter pedido</button></div>
      : <button type="button" className="button secondary" onClick={() => setConfirming(true)}>Cancelar pedido</button>}
  </div>;
}

export function Tracking({ code, setCode, tracked, error, busy, submit, cancel }: Props) {
  const [mode, setMode] = useState<'code' | 'phone'>('code');
  return <section className="page tracking" aria-labelledby="tracking-title">
    <div className="page-heading"><div><p className="eyebrow">Acompanhar</p><h1 id="tracking-title">Onde está a sua encomenda?</h1><p className="lead">{mode === 'code' ? 'Introduza o código que recebeu quando enviou o pedido.' : 'Indique o telefone que usou na encomenda para ver os seus pedidos.'}</p></div></div>
    <div className="filters catalog-filters tracking-mode" role="group" aria-label="Como procurar"><button type="button" aria-pressed={mode === 'code'} onClick={() => setMode('code')}>Pelo código</button><button type="button" aria-pressed={mode === 'phone'} onClick={() => setMode('phone')}>Pelo telefone</button></div>
    {mode === 'phone' ? <PhoneLookup /> : <>
    <form className="tracking-search" onSubmit={submit}>
      <div className="field"><label htmlFor="tracking-code">Código de seguimento</label><input id="tracking-code" required value={code} onChange={event => setCode(event.target.value)} autoCapitalize="none" autoCorrect="off" autoComplete="off" spellCheck={false} placeholder="Cole aqui o seu código" /></div>
      <button className="button primary" disabled={busy || !code.trim()}>{busy ? 'A procurar…' : 'Consultar pedido'}{!busy && <Icon name="arrow" size={18} />}</button>
    </form>
    <div aria-live="polite">
      {error && <Notice tone="error">{error.message}</Notice>}
      {!tracked && !busy && !error && <p className="muted tracking-hint">Não tem o código? Só é apresentado quando o pedido é criado. Se o perdeu, fale com a pastelaria.</p>}
      {tracked && <div className="tracking-result">
        <div className="tracking-top">
          <div className="panel"><div className="tracking-status"><span className="eyebrow">Estado</span><Status value={tracked.status} /></div><Timeline status={tracked.status} />{tracked.status === 'pending' && <Notice>A Gestora ainda vai verificar o pedido. Até confirmar, não há vaga reservada e <strong>não deve pagar online</strong>.</Notice>}</div>
          <aside className="panel pickup-card"><span className="eyebrow">Levantamento</span><h2>{dateLabel(new Date(tracked.pickup_at))}</h2><p className="pickup-time">{pickupTimeLabel(tracked.pickup_at)} <small>hora de Lisboa</small></p>
            <dl className="money"><div><dt>Total</dt><dd>{euro(tracked.total_cents)}</dd></div><div><dt>Pago</dt><dd>{euro(tracked.amount_paid_cents)}</dd></div><div><dt>Por pagar</dt><dd>{euro(tracked.balance_due_cents)}</dd></div></dl></aside>
        </div>
        <h2 className="tracked-heading">Os seus produtos</h2>
        <div className="tracked-list">{tracked.items.map((item, index) => <article className="tracked-item" key={index}><div><h3>{item.product_name}</h3><p>{item.weight_kg ? weightLabel(item.weight_kg) : `${item.quantity} × ${units[item.unit]}`}</p>{item.cake_message && <p>Mensagem: “{item.cake_message}”</p>}</div><Status value={item.production_status} /></article>)}</div>
        {tracked.can_cancel && <CancelOrder cancel={cancel} />}
        {tracked.status === 'cancelled' && <Notice>Este pedido foi cancelado.</Notice>}
      </div>}
    </div>
    </>}
  </section>;
}
