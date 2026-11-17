import { useEffect, useRef, useState } from 'react';
import type { CreatedOrder, NewOrder, Product } from '@/lib/api';
import { dateLabel, lisbonDateString, lisbonPickupTimestamp, nextDemoPickupDate } from '@/lib/dates';
import { euro, leadLabel, lineTotal, units, type Line } from './presentation';
import { EmptyState, ProductArt, Status } from './ui';

type Props = { lines: Line[]; products: Product[]; update: (key: string, patch: Partial<Line>) => void; remove: (key: string) => void; shop: () => void; submit: (order: NewOrder) => Promise<void>; busy: boolean; error: string; created: CreatedOrder | null; track: () => void };

const stepTitles = ['O seu cesto', 'Quando vem levantar?', 'Como o contactamos?', 'Tudo pronto para enviar?'];
const stepLabels = ['Produtos', 'Levantamento', 'Contacto', 'Revisão'];

export function Checkout({ lines, products, update, remove, shop, submit, busy, error, created, track }: Props) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [date, setDate] = useState(nextDemoPickupDate);
  const [time, setTime] = useState('10:00');
  const [localError, setLocalError] = useState('');
  const [copyMessage, setCopyMessage] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const selected = lines.flatMap(line => { const product = products.find(item => item.id === line.product_id); return product ? [{ line, product }] : []; });
  const total = selected.reduce((sum, { line, product }) => sum + lineTotal(line, product), 0);
  const lead = Math.max(0, ...selected.map(({ product }) => product.min_lead_hours));
  const deposit = selected.some(({ product }) => product.is_custom_cake) ? Math.floor((total * 3 + 500) / 1000) * 100 : 0;
  useEffect(() => { heading.current?.focus(); }, [step, created]);

  function proceed(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setLocalError('');
    if (!lines.length) return;
    if (step === 1) {
      if (new Date(`${date}T12:00:00Z`).getUTCDay() === 1) { setLocalError('Não há levantamentos à segunda-feira. Escolha outro dia.'); return; }
      if (new Date(lisbonPickupTimestamp(date, time)).getTime() - Date.now() < lead * 3600000) { setLocalError(`Escolha um levantamento com pelo menos ${leadLabel(lead)} de antecedência.`); return; }
    }
    if (step === 2 && (!name.trim() || !phone.trim())) { setLocalError('Preencha o nome e o telefone.'); return; }
    if (step < 3) { setStep(step + 1); return; }
    const items: NewOrder['items'] = selected.map(({ line, product }) => product.is_custom_cake ? {
      product_id: product.id,
      quantity: 1,
      weight_kg: Number(line.weight_kg),
      cake_message: line.cake_message.trim() || null,
      declared_allergies: line.declared_allergies.split(',').map(value => value.trim()).filter(Boolean),
      production_notes: line.production_notes.trim() || null,
    } : { product_id: product.id, quantity: Number(line.quantity) });
    void submit({ customer: { name: name.trim(), phone: phone.trim() }, pickup_at: lisbonPickupTimestamp(date, time), notes: null, items });
  }

  if (created) return <section className="success-page page-section"><p className="eyebrow">Pedido enviado</p><h1 ref={heading} tabIndex={-1}>Obrigada pela sua encomenda.</h1><Status value={created.status} /><p className="success-lead">A Gestora vai verificar a disponibilidade e entrará em contacto. Não efetue pagamentos online.</p><div className="tracking-code"><h2>Guarde o seu código</h2><p>Este código é apresentado apenas na criação do pedido. É a sua chave para acompanhar a encomenda.</p><code>{created.tracking_code}</code><button type="button" className="button secondary" onClick={() => { void navigator.clipboard.writeText(created.tracking_code).then(() => setCopyMessage('Código copiado.')).catch(() => setCopyMessage('Não foi possível copiar. Selecione e guarde o código acima.')); }}>Copiar código</button><span role="status">{copyMessage}</span></div><dl className="money-summary"><div><dt>Total previsto</dt><dd>{euro(created.total_cents)}</dd></div><div><dt>Sinal na pastelaria</dt><dd>{euro(created.deposit_required_cents)}</dd></div></dl><p className="notice">{created.message}</p><button type="button" className="button primary" onClick={track}>Acompanhar pedido →</button></section>;

  return <section className="checkout page-section" id="cesto"><div className="page-heading"><div><p className="eyebrow">A sua encomenda</p><h1 ref={heading} tabIndex={-1}>{stepTitles[step]}</h1></div><button className="text-link" type="button" onClick={shop}>← Continuar a escolher</button></div>
    <ol className="checkout-steps" aria-label="Etapas da encomenda">{stepLabels.map((label, index) => <li key={label} className={index < step ? 'done' : ''} aria-current={step === index ? 'step' : undefined}><button type="button" disabled={index > step || busy} onClick={() => { setStep(index); setLocalError(''); }}><span>{index + 1}</span>{label}</button></li>)}</ol>
    {!lines.length ? <EmptyState title="O seu cesto ainda está vazio">Escolha um bolo, doce ou salgado no catálogo para começar.</EmptyState> : <form className="checkout-layout" onSubmit={proceed}><div className="checkout-content">
      {step === 0 && <><h2>Produtos escolhidos <span className="count">{lines.length}</span></h2>{selected.map(({ line, product }, index) => <fieldset className="cart-item" key={line.key}><legend className="sr-only">{product.name}, item {index + 1}</legend><div className="cart-item-heading"><ProductArt name={product.name} category={product.category} /><div><h3>{product.name}</h3><p>{euro(product.unit_price_cents)} / {units[product.unit]}</p></div><button type="button" className="text-link remove" onClick={() => remove(line.key)} aria-label={`Remover ${product.name}, item ${index + 1}`}>Remover</button></div><div className="fields">
        <label>{product.is_custom_cake ? 'Peso deste bolo (kg)' : `Quantidade (${units[product.unit]})`}<input required type="number" inputMode="decimal" min="0.001" step="0.001" value={product.is_custom_cake ? line.weight_kg : line.quantity} onChange={event => update(line.key, product.is_custom_cake ? { weight_kg: event.target.value } : { quantity: event.target.value })} /></label>
        {product.is_custom_cake && <><label>Mensagem no bolo <span className="optional">opcional</span><input maxLength={80} value={line.cake_message} onChange={event => update(line.key, { cake_message: event.target.value })} /></label><label className="full-field">Alergias declaradas <span className="optional">opcional</span><input value={line.declared_allergies} onChange={event => update(line.key, { declared_allergies: event.target.value })} aria-describedby={`allergy-${line.key}`} /><small id={`allergy-${line.key}`}>Separe por vírgulas. A equipa verifica as restrições antes de confirmar.</small></label><label className="full-field">Notas para a produção <span className="optional">opcional</span><input maxLength={2000} value={line.production_notes} onChange={event => update(line.key, { production_notes: event.target.value })} /></label></>}
      </div><div className="cart-item-foot"><p>Alergénios do produto: {product.allergens.join(', ') || 'Não indicados'}</p><strong>{euro(lineTotal(line, product))}</strong></div></fieldset>)}</>}
      {step === 1 && <><h2>Levantamento na pastelaria</h2><p className="muted">Antecedência mínima desta encomenda: {leadLabel(lead)}. Horas de Lisboa.</p><div className="fields"><label>Dia de levantamento<input required type="date" min={lisbonDateString(new Date(Date.now() + lead * 3600000))} value={date} onChange={event => { setDate(event.target.value); event.target.setCustomValidity(new Date(`${event.target.value}T12:00:00Z`).getUTCDay() === 1 ? 'Não há levantamentos à segunda-feira. Escolha outro dia.' : ''); }} aria-describedby="pickup-help" /></label><label>Hora<input required type="time" value={time} onChange={event => setTime(event.target.value)} /></label></div><p id="pickup-help" className="notice">Não há levantamentos à segunda-feira. A data está sujeita a confirmação pela Gestora.</p></>}
      {step === 2 && <><h2>O seu contacto</h2><p className="muted">Usamos estes dados para tratar da sua encomenda e avisar quando estiver pronta.</p><div className="fields"><label>Nome<input required autoComplete="name" maxLength={120} value={name} onChange={event => setName(event.target.value)} /></label><label>Telefone<input required type="tel" autoComplete="tel" maxLength={40} value={phone} onChange={event => setPhone(event.target.value)} /></label></div></>}
      {step === 3 && <><h2>Reveja o pedido</h2><dl className="review-details"><div><dt>Contacto</dt><dd>{name}<br />{phone}</dd></div><div><dt>Levantamento</dt><dd>{dateLabel(new Date(`${date}T12:00:00Z`))}<br />às {time} · hora de Lisboa</dd></div></dl>{selected.map(({ line, product }, index) => <article className="review-line" key={line.key}><div><h3>{index + 1}. {product.name}</h3><p>{product.is_custom_cake ? `${line.weight_kg} kg` : `${line.quantity} ${units[product.unit]}`}</p>{line.cake_message && <p>Mensagem: {line.cake_message}</p>}{line.declared_allergies && <p><strong>Alergias declaradas:</strong> {line.declared_allergies}</p>}{line.production_notes && <p>Notas: {line.production_notes}</p>}</div><strong>{euro(lineTotal(line, product))}</strong></article>)}<button type="button" className="text-link" onClick={() => setStep(0)}>Editar produtos</button></>}
      {(localError || error) && <div className="error-state" role="alert">{localError || error}</div>}
    </div><aside className="order-summary"><p className="eyebrow">Resumo do pedido</p><h2>{lines.length} {lines.length === 1 ? 'produto escolhido' : 'produtos escolhidos'}</h2><dl className="money-summary"><div><dt>Total estimado</dt><dd>{euro(total)}</dd></div>{deposit > 0 && <div><dt>Sinal previsto</dt><dd>{euro(deposit)}</dd></div>}</dl><p>O preço e o sinal são confirmados pela Gestora ao verificar a encomenda.</p><button className="button primary" disabled={busy}>{busy ? 'A enviar pedido…' : ['Continuar →', 'Continuar →', 'Rever pedido →', 'Enviar pedido'][step]}</button>{step > 0 && <button type="button" className="text-link" disabled={busy} onClick={() => setStep(step - 1)}>← Voltar</button>}<p className="summary-note">Não paga online. O pedido fica pendente e não reserva vaga até a Gestora confirmar.</p></aside></form>}
  </section>;
}
