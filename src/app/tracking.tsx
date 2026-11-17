import { useState } from 'react';
import { api, type PhoneOrder, type TrackedOrder } from '@/lib/api';
import { dateLabel } from '@/lib/dates';
import { describeError, euro, pickupTimeLabel, units, weightLabel, type Problem } from './presentation';
import { Icon, Notice, Status, Timeline } from './ui';

type Props = { code: string; setCode: (code: string) => void; tracked: TrackedOrder | null; error: Problem | null; busy: boolean; submit: (event: React.FormEvent) => void; cancel: () => Promise<void> };

function PhoneLookup() {
  const [phone, setPhone] = useState('');
  const [orders, setOrders] = useState<PhoneOrder[] | null>(null);
  const [error, setError] = useState<Problem | null>(null);
  const [busy, setBusy] = useState(false);
  async function search(event: React.FormEvent) {
    event.preventDefault();
    setError(null); setOrders(null); setBusy(true);
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
      {orders && orders.length > 0 && <div className="phone-orders">
        <p className="muted tracking-hint">{orders.length === 1 ? '1 pedido encontrado' : `${orders.length} pedidos encontrados`}. Por privacidade, aqui só mostramos o estado e os produtos. Para ver valores e mensagens, ou para cancelar um pedido, use o código dele.</p>
        {orders.map((order, index) => <article className="panel phone-order" key={index}>
          <div className="phone-order-head"><div><span className="eyebrow">Levantamento</span><h2>{dateLabel(new Date(order.pickup_at))} · {pickupTimeLabel(order.pickup_at)}</h2></div><Status value={order.status} /></div>
          <ul>{order.items.map((item, itemIndex) => <li key={itemIndex}><span>{item.product_name}</span><span className="muted">{item.weight_kg ? weightLabel(item.weight_kg) : `${item.quantity} × ${units[item.unit]}`}</span></li>)}</ul>
        </article>)}
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
