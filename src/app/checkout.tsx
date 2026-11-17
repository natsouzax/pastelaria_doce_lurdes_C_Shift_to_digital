import { useEffect, useRef, useState } from 'react';
import type { CreatedOrder, NewOrder, Product } from '@/lib/api';
import { dateLabel, lisbonDateString, lisbonPickupTimestamp } from '@/lib/dates';
import { CAKE_LIMIT_MESSAGE, DAILY_CAKE_LIMIT, cakeUnits } from '@/lib/cakes';
import { normalizePortuguesePhone } from '@/lib/phone';
import { euro, leadLabel, lineAmount, lineTotal, pickupProblems, units, weightLabel, type Line, type Problem } from './presentation';
import { EmptyState, Icon, Notice, Status } from './ui';

type Props = {
  lines: Line[]; products: Product[]; update: (key: string, patch: Partial<Line>) => void; remove: (key: string) => void; duplicate: (key: string) => void;
  shop: () => void; submit: (order: NewOrder) => Promise<void>; busy: boolean; error: Problem | null; created: CreatedOrder | null; track: () => void;
};

type Errors = Record<string, string>;

const stepLabels = ['Produtos', 'Levantamento', 'Contacto', 'Rever'];
const stepTitles = ['O seu cesto', 'Quando quer levantar?', 'Como falamos consigo?', 'Reveja o pedido'];
const isMonday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay() === 1;

function earliestDate(leadHours: number, time: string) {
  const day = new Date(`${lisbonDateString(new Date())}T12:00:00Z`);
  const minimumPickupTime = Date.now() + leadHours * 3600000;
  while (true) {
    const date = day.toISOString().slice(0, 10);
    if (day.getUTCDay() !== 1 && new Date(lisbonPickupTimestamp(date, time)).getTime() >= minimumPickupTime) return date;
    day.setUTCDate(day.getUTCDate() + 1);
  }
}

function Stepper({ value, onChange, step, min, label, id, invalid }: { value: string; onChange: (value: string) => void; step: number; min: number; label: string; id: string; invalid: boolean }) {
  const nudge = (direction: 1 | -1) => {
    const current = Number(value);
    const base = Number.isFinite(current) && current > 0 ? current : min;
    const next = Math.max(min, Math.round((base + direction * step) * 1000) / 1000);
    onChange(String(next));
  };
  return <div className={`stepper${invalid ? ' invalid' : ''}`}>
    <button type="button" onClick={() => nudge(-1)} aria-label={`Diminuir ${label}`}><Icon name="minus" size={16} /></button>
    <input id={id} type="number" inputMode="decimal" min={min} step={step} value={value} onChange={event => onChange(event.target.value)} aria-label={label} aria-invalid={invalid} />
    <button type="button" onClick={() => nudge(1)} aria-label={`Aumentar ${label}`}><Icon name="plus" size={16} /></button>
  </div>;
}

export function Checkout({ lines, products, update, remove, duplicate, shop, submit, busy, error, created, track }: Props) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('10:00');
  const [errors, setErrors] = useState<Errors>({});
  const [copyMessage, setCopyMessage] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(false);

  const selected = lines.flatMap(line => { const product = products.find(item => item.id === line.product_id); return product ? [{ line, product }] : []; });
  const total = selected.reduce((sum, { line, product }) => sum + lineTotal(line, product), 0);
  const lead = Math.max(0, ...selected.map(({ product }) => product.min_lead_hours));
  const hasCustomCake = selected.some(({ product }) => product.is_custom_cake);
  const cakeCount = selected.reduce((sum, { line, product }) => sum + cakeUnits(product, Number(line.quantity) || 0), 0);
  const overCakeLimit = cakeCount > DAILY_CAKE_LIMIT;
  const deposit = hasCustomCake ? Math.floor((total * 3 + 500) / 1000) * 100 : 0;
  const earliest = earliestDate(lead, time);

  useEffect(() => { if (!date) setDate(earliest); }, [date, earliest]);
  useEffect(() => { if (mounted.current) heading.current?.focus({ preventScroll: false }); mounted.current = true; }, [step, created]);
  useEffect(() => { if (error && pickupProblems.includes(error.code)) setStep(1); }, [error]);

  function go(next: number) { setErrors({}); setStep(next); }

  function validate(current: number): Errors {
    const found: Errors = {};
    if (current === 0) {
      if (overCakeLimit) found['cake-limit'] = CAKE_LIMIT_MESSAGE;
      selected.forEach(({ line, product }) => { if (lineAmount(line, product) <= 0) found[`qty-${line.key}`] = product.is_custom_cake ? 'Indique o peso do bolo em kg.' : 'Indique uma quantidade maior que zero.'; });
    }
    if (current === 1) {
      if (!date) found['pickup-date'] = 'Escolha o dia de levantamento.';
      else if (isMonday(date)) found['pickup-date'] = 'Não há levantamentos à segunda-feira. Escolha outro dia.';
      else if (!time) found['pickup-time'] = 'Escolha a hora.';
      else if (new Date(lisbonPickupTimestamp(date, time)).getTime() - Date.now() < lead * 3600000) found['pickup-date'] = `Este pedido precisa de pelo menos ${leadLabel(lead)} de antecedência. Escolha ${dateLabel(new Date(`${earliest}T12:00:00Z`))} ou mais tarde.`;
    }
    if (current === 2) {
      if (!name.trim()) found['contact-name'] = 'Indique o seu nome.';
      if (!normalizePortuguesePhone(phone)) found['contact-phone'] = 'Indique um telefone português válido, com 9 dígitos e começado por 2 ou 9.';
    }
    return found;
  }

  function proceed(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !selected.length) return;
    for (let current = 0; current <= step; current++) {
      const found = validate(current);
      if (Object.keys(found).length) {
        setErrors(found);
        if (current !== step) { setStep(current); return; }
        window.setTimeout(() => (document.getElementById(Object.keys(found)[0]) as HTMLElement | null)?.focus(), 30);
        return;
      }
    }
    setErrors({});
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

  if (created) return <section className="page success" aria-labelledby="success-title">
    <div className="success-mark"><Icon name="check" size={28} /></div>
    <p className="eyebrow">Pedido enviado</p>
    <h1 id="success-title" ref={heading} tabIndex={-1}>Obrigada pela sua encomenda.</h1>
    <p className="lead">Recebemos o seu pedido. A Gestora vai verificar a disponibilidade e confirmar. <strong>Não faça qualquer pagamento online.</strong></p>
    <div className="code-card">
      <span className="code-label">O seu código de seguimento</span>
      <code>{created.tracking_code}</code>
      <button type="button" className="button secondary" onClick={() => { void navigator.clipboard.writeText(created.tracking_code).then(() => setCopyMessage('Código copiado.')).catch(() => setCopyMessage('Não foi possível copiar. Selecione e guarde o código.')); }}><Icon name="copy" size={18} />Copiar código</button>
      <span className="code-warning" role="status">{copyMessage || 'Guarde-o agora: só aparece uma vez e não o conseguimos recuperar.'}</span>
    </div>
    <div className="success-grid">
      <dl className="facts"><div><dt>Estado</dt><dd><Status value={created.status} /></dd></div><div><dt>Levantamento</dt><dd>{dateLabel(new Date(created.pickup_at))}</dd></div><div><dt>Total previsto</dt><dd>{euro(created.total_cents)}</dd></div>{created.deposit_required_cents > 0 && <div><dt>Sinal previsto</dt><dd>{euro(created.deposit_required_cents)}</dd></div>}</dl>
      <ol className="next-steps"><li><strong>A Gestora verifica</strong><span>Confirma a disponibilidade para o dia pedido.</span></li><li><strong>Confirmação</strong><span>{created.deposit_required_cents > 0 ? 'Os bolos personalizados ficam confirmados quando a pastelaria registar o sinal.' : 'A Gestora confirma o pedido e avisa se for preciso.'}</span></li><li><strong>Acompanhe</strong><span>Use o código para ver o estado em qualquer altura.</span></li></ol>
    </div>
    <Notice>{created.message}</Notice>
    <div className="actions-row"><button type="button" className="button primary" onClick={track}>Acompanhar pedido <Icon name="arrow" size={18} /></button><button type="button" className="button ghost" onClick={shop}>Voltar ao catálogo</button></div>
  </section>;

  const err = (id: string) => errors[id] ? <span className="field-error" id={`${id}-error`} role="alert">{errors[id]}</span> : null;

  return <section className="page checkout" aria-labelledby="checkout-title">
    <div className="page-heading"><div><p className="eyebrow">A sua encomenda</p><h1 id="checkout-title" ref={heading} tabIndex={-1}>{lines.length ? stepTitles[step] : 'O seu cesto'}</h1></div><button className="text-link" type="button" onClick={shop}><Icon name="back" size={16} />Continuar a escolher</button></div>
    {!lines.length ? <EmptyState title="O seu cesto ainda está vazio" action={<button type="button" className="button primary" onClick={shop}>Ver catálogo</button>}>Escolha um bolo, doce ou salgado no catálogo para começar.</EmptyState> : <>
      <ol className="steps" aria-label="Etapas da encomenda">{stepLabels.map((label, index) => <li key={label} className={index < step ? 'done' : index === step ? 'current' : ''} aria-current={step === index ? 'step' : undefined}><button type="button" disabled={index > step || busy} onClick={() => go(index)}><span>{index < step ? <Icon name="check" size={14} /> : index + 1}</span><b>{label}</b></button></li>)}</ol>
      <form className="checkout-layout" onSubmit={proceed} noValidate>
        <div className="panel">
          {step === 0 && overCakeLimit && <Notice tone="error"><strong>Demasiados bolos para um só dia ({cakeCount}).</strong> {CAKE_LIMIT_MESSAGE}</Notice>}
          {step === 0 && <div className="cart-list">{selected.map(({ line, product }, index) => {
            const qtyId = `qty-${line.key}`;
            return <fieldset className="cart-item" key={line.key}>
              <legend className="sr-only">{product.name}, item {index + 1}</legend>
              <div className="cart-item-head"><div><h3>{product.name}</h3><p className="muted">{euro(product.unit_price_cents)} / {units[product.unit]}{product.is_custom_cake && ' · bolo individual'}</p></div><strong className="cart-item-total">{euro(lineTotal(line, product))}</strong></div>
              <div className="field">
                <label htmlFor={qtyId}>{product.is_custom_cake ? 'Peso deste bolo (kg)' : `Quantidade (${units[product.unit]})`}</label>
                <Stepper id={qtyId} label={product.is_custom_cake ? 'peso em kg' : 'quantidade'} value={product.is_custom_cake ? line.weight_kg : line.quantity} step={product.is_custom_cake ? 0.5 : 1} min={product.is_custom_cake ? 0.5 : 1} invalid={Boolean(errors[qtyId])} onChange={value => update(line.key, product.is_custom_cake ? { weight_kg: value } : { quantity: value })} />
                {err(qtyId)}
              </div>
              {product.is_custom_cake && <div className="field-grid">
                <div className="field"><label htmlFor={`msg-${line.key}`}>Mensagem no bolo <span className="optional">opcional</span></label><input id={`msg-${line.key}`} maxLength={80} placeholder="Ex.: Parabéns, Ana!" value={line.cake_message} onChange={event => update(line.key, { cake_message: event.target.value })} /></div>
                <div className="field"><label htmlFor={`all-${line.key}`}>Alergias declaradas <span className="optional">opcional</span></label><input id={`all-${line.key}`} placeholder="Ex.: frutos secos, lactose" value={line.declared_allergies} onChange={event => update(line.key, { declared_allergies: event.target.value })} aria-describedby={`all-help-${line.key}`} /><small id={`all-help-${line.key}`}>Separe por vírgulas. A produção confirma as restrições.</small></div>
                <div className="field field-wide"><label htmlFor={`note-${line.key}`}>Notas para a produção <span className="optional">opcional</span></label><textarea id={`note-${line.key}`} rows={2} maxLength={2000} placeholder="Cores, decoração, sabor…" value={line.production_notes} onChange={event => update(line.key, { production_notes: event.target.value })} /></div>
              </div>}
              <div className="cart-item-foot"><span className="muted">Alergénios do produto: {product.allergens.join(', ') || 'não indicados'}</span><span className="cart-item-actions">{product.is_custom_cake && <button type="button" className="text-link" onClick={() => duplicate(line.key)}>Duplicar bolo</button>}<button type="button" className="text-link danger" onClick={() => remove(line.key)} aria-label={`Remover ${product.name}, item ${index + 1}`}>Remover</button></span></div>
            </fieldset>;
          })}</div>}

          {step === 1 && <div className="step-body">
            <p className="muted">Antecedência mínima para este pedido: <strong>{leadLabel(lead)}</strong>. Primeiro dia possível: <strong>{dateLabel(new Date(`${earliest}T12:00:00Z`))}</strong>. Horas de Lisboa.</p>
            <div className="field-grid">
              <div className="field"><label htmlFor="pickup-date">Dia de levantamento</label><input id="pickup-date" type="date" min={earliest} value={date} onChange={event => { setDate(event.target.value); setErrors({}); }} aria-invalid={Boolean(errors['pickup-date'])} aria-describedby="pickup-date-error" />{err('pickup-date')}</div>
              <div className="field"><label htmlFor="pickup-time">Hora</label><input id="pickup-time" type="time" value={time} onChange={event => { setTime(event.target.value); setErrors({}); }} aria-invalid={Boolean(errors['pickup-time'])} />{err('pickup-time')}</div>
            </div>
            {date && isMonday(date) && <Notice>Não há levantamentos à segunda-feira. O dia fica sujeito à confirmação da Gestora.</Notice>}
          </div>}

          {step === 2 && <div className="step-body">
            <p className="muted">Usamos o seu nome e telefone apenas para tratar desta encomenda.</p>
            <div className="field-grid">
              <div className="field"><label htmlFor="contact-name">Nome</label><input id="contact-name" autoComplete="name" maxLength={120} value={name} onChange={event => setName(event.target.value)} aria-invalid={Boolean(errors['contact-name'])} aria-describedby="contact-name-error" />{err('contact-name')}</div>
              <div className="field"><label htmlFor="contact-phone">Telefone <span aria-hidden="true">*</span></label><input id="contact-phone" type="tel" autoComplete="tel" inputMode="tel" maxLength={40} required value={phone} onChange={event => setPhone(event.target.value)} aria-invalid={Boolean(errors['contact-phone'])} aria-describedby="contact-phone-error" placeholder="+351 912 345 678" />{err('contact-phone')}</div>
            </div>
          </div>}

          {step === 3 && <div className="step-body">
            <div className="review-cards">
              <div className="review-card"><span className="review-label">Levantamento</span><strong>{dateLabel(new Date(`${date}T12:00:00Z`))}</strong><span>às {time} · hora de Lisboa</span><button type="button" className="text-link" onClick={() => go(1)}>Alterar</button></div>
              <div className="review-card"><span className="review-label">Contacto</span><strong>{name}</strong><span>{phone}</span><button type="button" className="text-link" onClick={() => go(2)}>Alterar</button></div>
            </div>
            <div className="review-lines">{selected.map(({ line, product }) => <article key={line.key}>
                <div><h3>{product.name}</h3><p>{product.is_custom_cake ? weightLabel(line.weight_kg) : `${line.quantity} × ${units[product.unit]}`}</p>{line.cake_message && <p>Mensagem: “{line.cake_message}”</p>}{line.declared_allergies && <p><strong>Alergias declaradas:</strong> {line.declared_allergies}</p>}{line.production_notes && <p>Notas: {line.production_notes}</p>}</div>
              <strong>{euro(lineTotal(line, product))}</strong>
            </article>)}<button type="button" className="text-link" onClick={() => go(0)}>Editar produtos</button></div>
            <Notice>Ao enviar, o pedido fica <strong>pendente</strong>: só é confirmado quando a Gestora verificar a disponibilidade. Não paga nada online{hasCustomCake ? ' e o sinal só é pedido depois dessa verificação' : ''}.</Notice>
          </div>}

          {error && <Notice tone="error">{error.message}</Notice>}
          <div className="panel-foot">
            {step > 0 ? <button type="button" className="button ghost" disabled={busy} onClick={() => go(step - 1)}><Icon name="back" size={18} />Voltar</button> : <span />}
            <button className="button primary" disabled={busy || overCakeLimit}>{busy ? 'A enviar pedido…' : step === 3 ? 'Enviar pedido' : step === 2 ? 'Rever pedido' : 'Continuar'}{!busy && <Icon name="arrow" size={18} />}</button>
          </div>
        </div>

        <aside className="summary" aria-label="Resumo do pedido">
          <h2>Resumo</h2>
          <ul className="summary-lines">{selected.map(({ line, product }) => <li key={line.key}><span>{product.name}<small>{product.is_custom_cake ? weightLabel(line.weight_kg || 0) : `${line.quantity || 0} × ${units[product.unit]}`}</small></span><strong>{euro(lineTotal(line, product))}</strong></li>)}</ul>
          <dl className="money"><div><dt>Total estimado</dt><dd>{euro(total)}</dd></div>{deposit > 0 && <div><dt>Sinal previsto</dt><dd>{euro(deposit)}</dd></div>}</dl>
          <p className="summary-note">Valores indicativos: o servidor confirma preço e sinal. Não paga online; o pedido fica pendente até a Gestora confirmar.</p>
        </aside>
      </form>
    </>}
  </section>;
}
