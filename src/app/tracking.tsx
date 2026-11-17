import type { TrackedOrder } from '@/lib/api';
import { dateLabel } from '@/lib/dates';
import { euro, pickupTimeLabel, units, type Problem } from './presentation';
import { Icon, Notice, Status, Timeline } from './ui';

type Props = { code: string; setCode: (code: string) => void; tracked: TrackedOrder | null; error: Problem | null; busy: boolean; submit: (event: React.FormEvent) => void };

export function Tracking({ code, setCode, tracked, error, busy, submit }: Props) {
  return <section className="page tracking" aria-labelledby="tracking-title">
    <div className="page-heading"><div><p className="eyebrow">Acompanhar</p><h1 id="tracking-title">Onde está a sua encomenda?</h1><p className="lead">Introduza o código que recebeu quando enviou o pedido.</p></div></div>
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
        <div className="tracked-list">{tracked.items.map((item, index) => <article className="tracked-item" key={index}><div><h3>{item.product_name}</h3><p>{item.weight_kg ? `${item.weight_kg} kg` : `${item.quantity} × ${units[item.unit]}`}</p>{item.cake_message && <p>Mensagem: “{item.cake_message}”</p>}</div><Status value={item.production_status} /></article>)}</div>
      </div>}
    </div>
  </section>;
}
