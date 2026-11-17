import type { TrackedOrder } from '@/lib/api';
import { dateLabel } from '@/lib/dates';
import { euro, pickupTimeLabel, units } from './presentation';
import { EmptyState, Status, Timeline } from './ui';

type Props = { code: string; setCode: (code: string) => void; tracked: TrackedOrder | null; error: string; busy: boolean; submit: (event: React.FormEvent) => void };

export function Tracking({ code, setCode, tracked, error, busy, submit }: Props) {
  return <section className="tracking page-section"><div className="page-heading"><div><p className="eyebrow">Do forno à sua mesa</p><h1>Acompanhar a encomenda</h1><p>Consulte o estado com o código que recebeu ao enviar o pedido.</p></div></div>
    <form className="tracking-search" onSubmit={submit}><label>Código de seguimento<input required value={code} onChange={event => setCode(event.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} /></label><button className="button primary" disabled={busy}>{busy ? 'A consultar…' : 'Consultar pedido'}</button></form>
    {error && <div className="error-state" role="alert">{error}</div>}
    {!tracked && !busy && !error && <EmptyState title="O seu pedido, passo a passo">Da confirmação ao levantamento, encontra aqui o progresso da encomenda.</EmptyState>}
    {busy && <p role="status" className="notice">A procurar a sua encomenda…</p>}
    {tracked && <div className="tracking-result" aria-live="polite"><div className="tracking-overview"><div><p className="eyebrow">Estado da encomenda</p><Status value={tracked.status} /><Timeline status={tracked.status} /></div><aside><p className="eyebrow">Levantamento</p><h2>{dateLabel(new Date(tracked.pickup_at))}</h2><p className="pickup-time">{pickupTimeLabel(tracked.pickup_at)} <small>hora de Lisboa</small></p><dl className="money-summary"><div><dt>Total</dt><dd>{euro(tracked.total_cents)}</dd></div><div><dt>Pago</dt><dd>{euro(tracked.amount_paid_cents)}</dd></div><div><dt>Por pagar</dt><dd>{euro(tracked.balance_due_cents)}</dd></div></dl></aside></div>
      {tracked.status === 'pending' && <p className="notice">Aguarde a verificação da Gestora. Um pedido pendente ainda não tem vaga reservada e não deve ser pago online.</p>}
      <h2>Os seus produtos</h2><div className="tracked-list">{tracked.items.map((item, index) => <article className="tracked-item" key={index}><div><h3>{item.product_name}</h3><p>{item.weight_kg ?? item.quantity} {item.weight_kg ? 'kg' : units[item.unit]}</p>{item.cake_message && <p>Mensagem: {item.cake_message}</p>}</div><Status value={item.production_status} /></article>)}</div>
    </div>}
  </section>;
}
