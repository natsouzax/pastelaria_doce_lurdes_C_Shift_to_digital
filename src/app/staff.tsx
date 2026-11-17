'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiFailure, type ItemStatus, type OrderStatus, type StaffOrder, type StaffRole } from '@/lib/api';
import { dateLabel, lisbonDateString } from '@/lib/dates';
import { createAuthClient } from '@/lib/supabase/client';
import { isLandline, readyMessage, whatsappLink } from '@/lib/whatsapp';
import { describeError, euro, pickupTimeLabel, units, weightLabel } from './presentation';
import { EmptyState, Icon, Loading, Notice, Status, statusLabel } from './ui';

type PaymentDetails = { amount_cents?: number; note: string | null };
type Pending = { title: string; body: string; confirm: string; danger?: boolean; reason?: boolean; paymentNote?: boolean; confirmationPayment?: { totalCents: number }; success?: string; run: (reason?: string, payment?: PaymentDetails | null) => Promise<unknown> };

function ConfirmDialog({ pending, busy, onCancel, onConfirm }: { pending: Pending | null; busy: boolean; onCancel: () => void; onConfirm: (reason?: string, payment?: PaymentDetails | null) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState('');
  const [paymentChoice, setPaymentChoice] = useState<'unpaid' | 'full' | 'custom'>('unpaid');
  const [customAmount, setCustomAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (pending && !dialog.open) { setReason(''); setPaymentChoice('unpaid'); setCustomAmount(''); setPaymentNote(''); dialog.showModal(); }
    if (!pending && dialog.open) dialog.close();
  }, [pending]);
  const customCents = Math.round(Number(customAmount) * 100);
  const invalidCustomAmount = pending?.confirmationPayment && paymentChoice === 'custom'
    && (!Number.isFinite(customCents) || customCents <= 0 || customCents > pending.confirmationPayment.totalCents);
  return <dialog ref={ref} className="dialog" onCancel={event => { event.preventDefault(); onCancel(); }} aria-labelledby="dialog-title">
    {pending && <form onSubmit={event => {
      event.preventDefault();
      if (pending.reason && !reason.trim() || invalidCustomAmount) return;
      if (pending.confirmationPayment) {
        const payment = paymentChoice === 'unpaid' ? null : { amount_cents: paymentChoice === 'full' ? pending.confirmationPayment.totalCents : customCents, note: paymentNote.trim() || null };
        onConfirm(reason.trim(), payment);
      } else if (pending.paymentNote) onConfirm(reason.trim(), { note: paymentNote.trim() || null });
      else onConfirm(reason.trim());
    }}>
      <h2 id="dialog-title">{pending.title}</h2>
      <p>{pending.body}</p>
      {pending.reason && <div className="field"><label htmlFor="dialog-reason">Motivo do cancelamento</label><textarea id="dialog-reason" rows={3} required value={reason} onChange={event => setReason(event.target.value)} autoFocus /></div>}
      {pending.confirmationPayment && <>
        <div className="field"><label htmlFor="dialog-payment-choice">Pagamento recebido</label><select id="dialog-payment-choice" value={paymentChoice} onChange={event => setPaymentChoice(event.target.value as typeof paymentChoice)}><option value="unpaid">Ainda não pago</option><option value="full">Total pago ({euro(pending.confirmationPayment.totalCents)})</option><option value="custom">Valor personalizado pago</option></select></div>
        {paymentChoice === 'custom' && <div className="field"><label htmlFor="dialog-custom-amount">Valor recebido</label><input id="dialog-custom-amount" type="number" min="0.01" max={(pending.confirmationPayment.totalCents / 100).toFixed(2)} step="0.01" required value={customAmount} onChange={event => setCustomAmount(event.target.value)} />{invalidCustomAmount && <small>Indique um valor maior que zero e até {euro(pending.confirmationPayment.totalCents)}.</small>}</div>}
      </>}
      {(pending.paymentNote || pending.confirmationPayment && paymentChoice !== 'unpaid') && <div className="field"><label htmlFor="dialog-payment-note">Nota do pagamento <span className="optional">opcional</span></label><textarea id="dialog-payment-note" rows={2} maxLength={500} placeholder="Ex.: dinheiro, MB WAY, transferência…" value={paymentNote} onChange={event => setPaymentNote(event.target.value)} /></div>}
      <div className="dialog-actions"><button type="button" className="button ghost" onClick={onCancel} disabled={busy}>Voltar</button><button className={`button ${pending.danger ? 'danger' : 'primary'}`} disabled={busy || Boolean(pending.reason && !reason.trim()) || Boolean(invalidCustomAmount)}>{busy ? 'A guardar…' : pending.confirm}</button></div>
    </form>}
  </dialog>;
}

const whatsappFor = (order: StaffOrder) => whatsappLink(order.customer_phone, readyMessage(order.customer_name, order.pickup_at));

function WhatsappButton({ order, onClick }: { order: StaffOrder; onClick?: () => void }) {
  const href = whatsappFor(order);
  if (!href) return null;
  return <a className="button secondary" href={href} target="_blank" rel="noopener noreferrer" onClick={onClick}><Icon name="chat" size={18} />Avisar no WhatsApp</a>;
}

/** Abre-se sozinho quando o último item fica pronto: um toque abre o WhatsApp com a mensagem escrita; só falta carregar em “Enviar”. */
function NotifyDialog({ order, onClose }: { order: StaffOrder | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (order && !dialog.open) dialog.showModal();
    if (!order && dialog.open) dialog.close();
  }, [order]);
  const name = order?.customer_name?.trim();
  return <dialog ref={ref} className="dialog" onCancel={event => { event.preventDefault(); onClose(); }} aria-labelledby="notify-title">
    {order && <div className="notify">
      <h2 id="notify-title">Encomenda pronta</h2>
      <p>Avise {name ? <strong>{name}</strong> : 'o cliente'} de que já pode levantar a encomenda.</p>
      {whatsappFor(order)
        ? <>{isLandline(order.customer_phone) && <Notice tone="info">Este número é fixo e pode não ter WhatsApp. Se não abrir, ligue para <a href={`tel:${order.customer_phone}`}>{order.customer_phone}</a>.</Notice>}
          <p className="muted">A conversa abre com a mensagem escrita. Carregue em “Enviar” no WhatsApp.</p></>
        : <Notice tone="error">Esta encomenda não tem um telefone válido para WhatsApp.{order.customer_phone && <> Ligue para <a href={`tel:${order.customer_phone}`}>{order.customer_phone}</a>.</>}</Notice>}
      <div className="dialog-actions"><button type="button" className="button ghost" onClick={onClose}>Agora não</button>{whatsappFor(order) && <a className="button primary" href={whatsappFor(order)!} target="_blank" rel="noopener noreferrer" onClick={onClose}><Icon name="chat" size={18} />Abrir WhatsApp</a>}</div>
    </div>}
  </dialog>;
}

const shiftDay = (date: string, days: number) => { const day = new Date(`${date}T12:00:00Z`); day.setUTCDate(day.getUTCDate() + days); return day.toISOString().slice(0, 10); };
const startOfWeek = (date: string) => shiftDay(date, -((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7));
const weekDayLabel = (date: string) => new Intl.DateTimeFormat('pt-PT', { timeZone: 'Europe/Lisbon', weekday: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00Z`));
const weekRangeLabel = (start: string) => {
  const end = shiftDay(start, 6);
  const month = new Intl.DateTimeFormat('pt-PT', { timeZone: 'Europe/Lisbon', month: 'short' });
  const startDate = new Date(`${start}T12:00:00Z`);
  const endDate = new Date(`${end}T12:00:00Z`);
  const sameMonth = startDate.getUTCMonth() === endDate.getUTCMonth();
  return sameMonth
    ? `${startDate.getUTCDate()}–${endDate.getUTCDate()} ${month.format(endDate)} ${endDate.getUTCFullYear()}`
    : `${startDate.getUTCDate()} ${month.format(startDate)} – ${endDate.getUTCDate()} ${month.format(endDate)} ${endDate.getUTCFullYear()}`;
};
const amountLabel = (item: StaffOrder['items'][number]) => item.weight_kg ? weightLabel(item.weight_kg) : `${item.quantity} × ${units[item.unit]}`;
const filters: Array<{ value: 'all' | OrderStatus; label: string }> = [{ value: 'all', label: 'Todas' }, { value: 'pending', label: 'Pendentes' }, { value: 'confirmed', label: 'Confirmadas' }, { value: 'in_production', label: 'Em produção' }, { value: 'ready', label: 'Prontas' }, { value: 'delivered', label: 'Entregues' }, { value: 'cancelled', label: 'Canceladas' }];

export function Staff() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<StaffRole | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [staffDate, setStaffDate] = useState('');
  const [orders, setOrders] = useState<StaffOrder[]>([]);
  const [staffError, setStaffError] = useState('');
  const [staffSuccess, setStaffSuccess] = useState('');
  const [staffBusy, setStaffBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<'all' | OrderStatus>('all');
  const [managerSection, setManagerSection] = useState<'dashboard' | 'management' | 'production'>('dashboard');
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState<Pending | null>(null);
  const [notifyId, setNotifyId] = useState<string | null>(null);
  const paymentKeys = useRef<Record<string, string>>({});
  const authCheck = useRef(0);
  const effectiveDate = staffDate || lisbonDateString(new Date());
  const selectedWeekStart = startOfWeek(effectiveDate);
  const orderQueryStart = selectedWeekStart;

  const loadOrders = useCallback(async (date: string, endDate?: string) => {
    try {
      setStaffError('');
      setOrders(await api.staffOrders(date, endDate));
    } catch (error) {
      setStaffError(describeError(error).message);
      setOrders([]);
    } finally { setLoaded(true); }
  }, []);

  useEffect(() => {
    let active = true;
    try {
      const auth = createAuthClient();
      const resolveRole = async (hasSession: boolean) => {
        const check = ++authCheck.current;
        if (!hasSession) {
          if (active && check === authCheck.current) {
            setRole(null);
            setOrders([]);
            setLoaded(false);
            setAuthReady(true);
          }
          return;
        }

        try {
          const me = await api.me();
          if (active && check === authCheck.current) {
            setRole(me.role);
            setAuthError('');
            setAuthReady(true);
          }
        } catch (error) {
          if (active && check === authCheck.current) {
            setRole(null);
            setAuthError(describeError(error).message);
            setAuthReady(true);
          }
        }
      };

      const { data: { subscription } } = auth.auth.onAuthStateChange((event, session) => {
        if (!active) return;
        // The persisted session is checked below; INITIAL_SESSION can arrive
        // while cookie storage is still initializing, so it is not decisive.
        if (event === 'SIGNED_OUT') void resolveRole(false);
        else if (event === 'SIGNED_IN') void resolveRole(Boolean(session));
      });

      void auth.auth.getSession().then(({ data, error }) => {
        if (error) throw error;
        return resolveRole(Boolean(data.session));
      }).catch(error => {
        if (active) {
          setRole(null);
          setAuthError(describeError(error).message);
          setAuthReady(true);
        }
      });

      return () => { active = false; subscription.unsubscribe(); };
    } catch (error) {
      setAuthError(describeError(error).message);
      setAuthReady(true);
      return () => { active = false; };
    }
  }, []);

  useEffect(() => {
    if (!role) return;
    const date = effectiveDate;
    if (!staffDate) setStaffDate(date);
    const week = selectedWeekStart;
    setLoaded(false);
    void loadOrders(week, shiftDay(week, 6));
  }, [role, orderQueryStart, loadOrders]);

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setAuthError('');
    setAuthBusy(true);
    try {
      const { error } = await createAuthClient().auth.signInWithPassword({ email, password });
      if (error) throw error;
      setPassword('');
      setRole((await api.me()).role);
      setAuthReady(true);
    } catch (error) {
      setAuthError(describeError(error).message);
    } finally { setAuthBusy(false); }
  }

  async function signOut() {
    try { await createAuthClient().auth.signOut(); }
    finally { setRole(null); setOrders([]); setLoaded(false); setStaffDate(''); }
  }

  async function staffAction(action: (reason?: string) => Promise<unknown>, reason?: string, success?: string) {
    setStaffError('');
    setStaffSuccess('');
    setStaffBusy(true);
    try {
      await action(reason);
      if (success) setStaffSuccess(success);
    } catch (error) {
      const detail = error instanceof ApiFailure && error.paymentRecorded ? ' O sinal foi registado; não repita o pagamento.' : '';
      setStaffError(describeError(error).message + detail);
    } finally {
      const date = staffDate || lisbonDateString(new Date());
      const week = startOfWeek(date);
      await loadOrders(week, shiftDay(week, 6));
      setStaffBusy(false);
      setPending(null);
    }
  }

  async function advanceItem(item: StaffOrder['items'][number]) {
    await staffAction(async () => {
      const result = await api.itemStatus(item.id, item.production_status === 'to_do' ? 'in_progress' : 'ready');
      if (result.order.status === 'ready') setNotifyId(result.order.id);
    });
  }

  async function pay(order: StaffOrder, kind: 'deposit' | 'balance' | 'refund', amount: number, note: string | null) {
    const token = `${order.id}:${kind}`;
    const key = paymentKeys.current[token] ?? crypto.randomUUID();
    paymentKeys.current[token] = key;
    try {
      await api.payment(order.id, kind, amount, kind !== 'refund', key, note);
      delete paymentKeys.current[token];
    } catch (error) {
      if (error instanceof ApiFailure && error.status < 500) delete paymentKeys.current[token];
      throw error;
    }
  }

  const ask = (next: Pending) => setPending(next);
  const askPayment = (order: StaffOrder, kind: 'deposit' | 'balance' | 'refund', amount: number) => {
    const what = kind === 'refund' ? 'reembolso' : kind === 'deposit' ? 'sinal' : 'valor restante';
    ask({ title: `Registar ${what}`, body: `Confirma que o ${what} de ${euro(amount)} foi ${kind === 'refund' ? 'devolvido' : 'recebido fora da aplicação'}? Este registo altera o saldo da encomenda.`, confirm: `Registar ${euro(amount)}`, paymentNote: true, run: (_, payment) => pay(order, kind, amount, payment?.note ?? null) });
  };

  if (!role) return <section className="page staff-login" aria-labelledby="staff-title">
    {!authReady && <Loading label="A verificar sessão…" count={1} />}
    {authReady && <div className="login-card">
      <p className="eyebrow">Equipa</p>
      <h1 id="staff-title">Entrar na área da equipa</h1>
      <p className="muted">Gestora e Produção entram com a sua conta. Entrar não altera nenhuma encomenda.</p>
      <form onSubmit={signIn}>
        <div className="field"><label htmlFor="staff-email">Email</label><input id="staff-email" type="email" required value={email} onChange={event => setEmail(event.target.value)} autoComplete="username" /></div>
        <div className="field"><label htmlFor="staff-password">Palavra-passe</label><input id="staff-password" type="password" required value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" /></div>
        {authError && <Notice tone="error">{authError}</Notice>}
        <button className="button primary block" disabled={authBusy}>{authBusy ? 'A entrar…' : 'Entrar'}</button>
      </form>
    </div>}
  </section>;

  const manager = role === 'manager';
  const dashboardView = manager && managerSection === 'dashboard';
  const productionView = !manager || managerSection === 'production';
  const selectedDate = effectiveDate;
  const selectedWeek = selectedWeekStart;
  const dayOf = (order: StaffOrder) => String(order.pickup_date).slice(0, 10);
  const dayOrders = orders.filter(order => dayOf(order) === selectedDate);
  const sorted = [...dayOrders].sort((a, b) => a.pickup_at.localeCompare(b.pickup_at));
  const productionOrders = sorted.filter(order => ['confirmed', 'in_production', 'ready'].includes(order.status));
  const normalizedSearch = search.trim().toLocaleLowerCase('pt-PT');
  const managementOrders = sorted.filter(order => (filter === 'all' || order.status === filter)
    && (!normalizedSearch || [order.customer_name ?? '', order.customer_phone ?? ''].join(' ').toLocaleLowerCase('pt-PT').includes(normalizedSearch)));
  const visible = productionView ? productionOrders : managementOrders;
  const productionItems = productionOrders.flatMap(order => order.items);
  const count = (status: OrderStatus) => dayOrders.filter(order => order.status === status).length;
  const itemCount = (status: ItemStatus) => productionItems.filter(item => item.production_status === status).length;
  const financialOrders = sorted.filter(order => order.status !== 'cancelled');
  const financialTotal = financialOrders.reduce((sum, order) => sum + (order.total_cents ?? 0), 0);
  const financialPaid = financialOrders.reduce((sum, order) => sum + (order.amount_paid_cents ?? 0), 0);
  const financialBalance = financialOrders.reduce((sum, order) => sum + (order.balance_due_cents ?? 0), 0);
  const dashboardOrders = orders.filter(order => order.status !== 'cancelled');
  const pendingOrders = dashboardOrders.filter(order => order.status === 'pending');
  const readyOrders = dashboardOrders.filter(order => order.status === 'ready');
  const dashboardFinancialTotal = dashboardOrders.reduce((sum, order) => sum + (order.total_cents ?? 0), 0);
  const dashboardFinancialPaid = dashboardOrders.reduce((sum, order) => sum + (order.amount_paid_cents ?? 0), 0);
  const dashboardFinancialBalance = dashboardOrders.reduce((sum, order) => sum + (order.balance_due_cents ?? 0), 0);
  const dashboardDays = Array.from({ length: 7 }, (_, index) => shiftDay(selectedWeek, index)).map(date => {
    const dayOrders = dashboardOrders.filter(order => dayOf(order) === date);
    const reservedCakes = dayOrders.reduce((sum, order) => {
      if (!['confirmed', 'in_production', 'ready', 'delivered'].includes(order.status)) return sum;
      return sum + order.items.filter(item => item.weight_kg !== null).length;
    }, 0);
    return {
      date,
      orders: dayOrders.length,
      reservedCakes,
      remainingCakes: Math.max(0, 6 - reservedCakes),
      totalCents: dayOrders.reduce((sum, order) => sum + (order.total_cents ?? 0), 0),
    };
  });
  const productDemand = new Map<string, Set<string>>();
  for (const order of dashboardOrders) for (const item of order.items) {
    const orderIds = productDemand.get(item.product_name) ?? new Set<string>();
    orderIds.add(order.id);
    productDemand.set(item.product_name, orderIds);
  }
  const topProducts = [...productDemand.entries()].map(([name, orderIds]) => ({ name, orders: orderIds.size }))
    .sort((a, b) => b.orders - a.orders || a.name.localeCompare(b.name, 'pt-PT')).slice(0, 5);

  return <section className="page staff" aria-labelledby="staff-title">
    <div className="page-heading">
      <div><p className="eyebrow">{manager ? 'Gestora' : 'Produção'}</p><h1 id="staff-title">{dashboardView ? 'Dashboard da equipa' : productionView ? 'Plano de produção' : 'Gestão de encomendas'}</h1></div>
      <button type="button" className="text-link" onClick={() => void signOut()}>Terminar sessão</button>
    </div>

    {manager && <div className="filters staff-tabs" role="group" aria-label="Secção da equipa">
      <button type="button" aria-pressed={dashboardView} onClick={() => setManagerSection('dashboard')}>Dashboard</button>
      <button type="button" aria-pressed={!dashboardView && !productionView} onClick={() => setManagerSection('management')}>Gestão</button>
      <button type="button" aria-pressed={!dashboardView && productionView} onClick={() => setManagerSection('production')}>Produção</button>
    </div>}

    <div className="staff-toolbar">
      <div className="day-nav" role="group" aria-label="Escolher semana de levantamento">
        <button type="button" className="icon-button" onClick={() => setStaffDate(shiftDay(selectedWeek, -7))} aria-label="Semana anterior"><Icon name="back" size={18} /></button>
        <label className="day-label"><span className="sr-only">Dia de levantamento</span><Icon name="calendar" size={18} /><strong>Semana de {weekRangeLabel(selectedWeek)}</strong><input type="date" value={selectedDate} onChange={event => event.target.value && setStaffDate(event.target.value)} /></label>
        <button type="button" className="icon-button" onClick={() => setStaffDate(shiftDay(selectedWeek, 7))} aria-label="Semana seguinte"><Icon name="arrow" size={18} /></button>
      </div>
      <button type="button" className="button secondary" disabled={staffBusy} onClick={() => void loadOrders(selectedWeek, shiftDay(selectedWeek, 6))}>{staffBusy ? 'A atualizar…' : 'Atualizar'}</button>
    </div>

    {!dashboardView && <div className="staff-week" role="group" aria-label="Dias da semana, com contagem de encomendas">
      {Array.from({ length: 7 }, (_, index) => shiftDay(selectedWeek, index)).map(date => {
        const dayCount = orders.filter(order => dayOf(order) === date && order.status !== 'cancelled').length;
        return <button type="button" key={date} className="staff-week-day" aria-pressed={selectedDate === date} onClick={() => setStaffDate(date)}>
          <span>{weekDayLabel(date)}</span><strong>{dayCount}</strong><small>{dayCount === 1 ? 'pedido' : 'pedidos'}</small>
        </button>;
      })}
    </div>}

    {loaded && dashboardView && <section className="staff-dashboard" aria-label="Resumo semanal da equipa">
      <dl className="dashboard-kpis">
        <div><dt>Encomendas esta semana</dt><dd>{dashboardOrders.length}</dd></div>
        <div><dt>Aguardam confirmação</dt><dd>{pendingOrders.length}</dd></div>
        <div><dt>Prontas para levantar</dt><dd>{readyOrders.length}</dd></div>
        <div><dt>Valor das encomendas</dt><dd>{euro(dashboardFinancialTotal)}</dd></div>
        <div><dt>Registado como recebido</dt><dd>{euro(dashboardFinancialPaid)}</dd></div>
        <div><dt>Por receber</dt><dd>{euro(dashboardFinancialBalance)}</dd></div>
      </dl>

      <section className="dashboard-panel" aria-labelledby="dashboard-capacity-title">
        <div className="dashboard-panel-heading"><div><p className="eyebrow">Agenda</p><h2 id="dashboard-capacity-title">Levantamentos e capacidade de bolos</h2></div><span>Até 6 bolos personalizados por dia</span></div>
        <p className="dashboard-capacity-note">Apenas encomendas confirmadas reservam estas vagas. Um pedido pendente ainda precisa de confirmação da Gestora.</p>
        <div className="dashboard-days">{dashboardDays.map(day => <article className="dashboard-day" key={day.date}>
          <div className="dashboard-day-heading"><strong>{weekDayLabel(day.date)}</strong><span>{day.orders} {day.orders === 1 ? 'pedido' : 'pedidos'}</span></div>
          <div className="dashboard-capacity-label"><span>Bolos personalizados</span><b>{day.reservedCakes}/6</b></div>
          <div className="dashboard-capacity-track" role="progressbar" aria-label={`Capacidade de bolos personalizados em ${weekDayLabel(day.date)}`} aria-valuemin={0} aria-valuemax={6} aria-valuenow={Math.min(day.reservedCakes, 6)}><span style={{ width: `${Math.min(day.reservedCakes / 6, 1) * 100}%` }} /></div>
          <p className={day.remainingCakes === 0 ? 'dashboard-capacity-full' : 'dashboard-capacity-open'}>{day.remainingCakes === 1 ? '1 vaga restante' : `${day.remainingCakes} vagas restantes`}</p>
          <small>Valor dos pedidos: {euro(day.totalCents)}</small>
          <button type="button" className="text-link" onClick={() => { setStaffDate(day.date); setFilter('all'); setManagerSection('management'); }}>Ver Gestão do dia</button>
        </article>)}</div>
      </section>

      <div className="dashboard-lower">
        <section className="dashboard-panel" aria-labelledby="dashboard-actions-title">
          <div className="dashboard-panel-heading"><div><p className="eyebrow">Acompanhar</p><h2 id="dashboard-actions-title">Pontos de atenção</h2></div></div>
          <ul className="dashboard-attention">
            <li><span>Pedidos pendentes</span><strong>{pendingOrders.length}</strong></li>
            <li><span>Prontos com saldo por receber</span><strong>{readyOrders.filter(order => (order.balance_due_cents ?? 0) > 0).length}</strong></li>
            <li><span>Sem vaga após pagamento</span><strong>{dashboardOrders.filter(order => order.capacity_resolution_required).length}</strong></li>
          </ul>
          <button type="button" className="button secondary" onClick={() => { if (pendingOrders[0]) setStaffDate(dayOf(pendingOrders[0])); setFilter('pending'); setManagerSection('management'); }}>Ver pedidos pendentes</button>
        </section>

        <section className="dashboard-panel" aria-labelledby="dashboard-products-title">
          <div className="dashboard-panel-heading"><div><p className="eyebrow">Procura</p><h2 id="dashboard-products-title">Produtos mais pedidos</h2></div></div>
          {topProducts.length ? <ol className="dashboard-products">{topProducts.map(product => <li key={product.name}><span>{product.name}</span><strong>{product.orders} {product.orders === 1 ? 'pedido' : 'pedidos'}</strong></li>)}</ol> : <p className="muted">Ainda não há pedidos nesta semana.</p>}
        </section>
      </div>
    </section>}

    {loaded && manager && !dashboardView && !productionView && <>
      <dl className="tiles"><div><dt>Total em encomendas</dt><dd>{euro(financialTotal)}</dd></div><div><dt>Registado como pago</dt><dd>{euro(financialPaid)}</dd></div><div><dt>Por receber</dt><dd>{euro(financialBalance)}</dd></div></dl>
      <div className="staff-management-tools">
        <div className="filters scroll-x" role="group" aria-label="Filtrar por estado">{filters.map(({ value, label }) => { const total = value === 'all' ? dayOrders.length : count(value); return total > 0 || value === 'all' ? <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}<span>{total}</span></button> : null; })}</div>
        <label className="staff-search"><span className="sr-only">Pesquisar por nome ou telefone</span><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Pesquisar nome ou telefone" /></label>
      </div>
    </>}

    {loaded && !dashboardView && productionView && <dl className="tiles"><div><dt>Por começar</dt><dd>{itemCount('to_do')}</dd></div><div><dt>Em produção</dt><dd>{itemCount('in_progress')}</dd></div><div><dt>Prontos</dt><dd>{itemCount('ready')}</dd></div></dl>}

    {staffError && <Notice tone="error">{staffError}</Notice>}
    {staffSuccess && <Notice>{staffSuccess}</Notice>}
    {!loaded && <Loading label="A carregar encomendas…" count={3} />}
    {!dashboardView && loaded && !visible.length && !staffError && <EmptyState title={productionView ? 'Sem encomendas em produção neste dia' : dayOrders.length ? 'Nenhuma encomenda corresponde aos filtros' : 'Sem levantamentos neste dia'}>{productionView ? 'Escolha outro dia na semana. Só aparecem encomendas confirmadas, em produção ou prontas.' : dayOrders.length ? 'Altere o estado ou a pesquisa.' : 'Escolha outro dia na semana.'}</EmptyState>}

    {!dashboardView && loaded && visible.length > 0 && <div className="order-list">{visible.map(order => {
      const managementView = !productionView;
      const balance = order.balance_due_cents ?? 0;
      const paid = order.amount_paid_cents ?? 0;
      const hasCake = order.items.some(item => item.weight_kg !== null);
      return <article className="order-card" key={order.id}>
        <header className="order-head">
          <div className="order-time"><strong>{pickupTimeLabel(order.pickup_at)}</strong></div>
          <div className="order-who">{manager && <h2>{order.customer_name ?? 'Cliente'}</h2>}{manager && order.customer_phone && <a href={`tel:${order.customer_phone}`}><Icon name="phone" size={15} />{order.customer_phone}</a>}{!manager && <h2>Encomenda #{order.id.slice(0, 6).toUpperCase()}</h2>}</div>
          <Status value={order.status} />
        </header>
        {managementView && order.capacity_resolution_required && <Notice tone="error"><strong>Sinal recebido, mas sem vaga.</strong> Não registe o sinal outra vez: reagende ou registe o reembolso.</Notice>}
        <div className="order-items">{order.items.map(item => <div className={`order-item${!manager ? ` item--${item.production_status}` : ''}`} key={item.id}>
          <div className="order-item-main">
            <div className="order-item-title"><h3>{item.product_name}</h3><span className="amount">{amountLabel(item)}</span></div>
            {item.cake_message && <p>Mensagem: “{item.cake_message}”</p>}
            {productionView && <div className="allergy-blocks">
              <p className={item.declared_allergies.length ? 'allergy allergy--declared' : 'allergy'}><b>Alergias declaradas</b>{item.declared_allergies.join(', ') || 'Nenhuma'}</p>
              <p className="allergy allergy--product"><b>Alergénios do produto</b>{item.product_allergens.join(', ') || 'Não indicados'}</p>
            </div>}
            {productionView && item.production_notes && <p className="note"><b>Notas</b>{item.production_notes}</p>}
            {managementView && <Status value={item.production_status} />}
          </div>
          {productionView && (item.production_status === 'ready' ? <span className="item-done"><Icon name="check" size={18} />Pronto</span> : <button type="button" className="button primary item-action" disabled={staffBusy} onClick={() => void advanceItem(item)}>{item.production_status === 'to_do' ? 'Iniciar' : 'Marcar pronto'}</button>)}
        </div>)}</div>
        {productionView && order.status === 'ready' && whatsappFor(order) && <div className="order-notify"><WhatsappButton order={order} /></div>}
        {managementView && <footer className="order-foot">
          <dl className="money money--inline"><div><dt>Total</dt><dd>{euro(order.total_cents ?? 0)}</dd></div><div><dt>Pago</dt><dd>{euro(paid)}</dd></div><div><dt>Por pagar</dt><dd>{euro(balance)}</dd></div></dl>
          {order.payments?.length ? <div className="payment-list" aria-label="Registos de pagamento">{order.payments.map(payment => <p key={payment.id}><strong>{payment.kind === 'deposit' ? 'Sinal' : payment.kind === 'balance' ? 'Restante' : 'Reembolso'}</strong><span>{euro(payment.amount_cents)} · {new Date(payment.recorded_at).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })}</span>{payment.note && <small>{payment.note}</small>}</p>)}</div> : <p className="muted payment-empty">Sem pagamentos registados.</p>}
          <div className="order-actions">
            {order.status === 'ready' && <WhatsappButton order={order} />}
            {order.status === 'pending'&& !order.capacity_resolution_required && (hasCake
              ? <button type="button" className="button primary" disabled={staffBusy} onClick={() => askPayment(order, 'deposit', order.deposit_required_cents ?? 0)}>Registar sinal {euro(order.deposit_required_cents ?? 0)}</button>
              : <button type="button" className="button primary" disabled={staffBusy} onClick={() => ask({ title: 'Confirmar pedido', body: `Confirma o pedido de ${order.customer_name ?? 'cliente'} para ${pickupTimeLabel(order.pickup_at)}?`, confirm: 'Confirmar', confirmationPayment: { totalCents: order.total_cents ?? 0 }, run: (_, payment) => api.orderStatus(order.id, 'confirmed', undefined, payment && payment.amount_cents !== undefined ? { amount_cents: payment.amount_cents, note: payment.note } : null) })}>Confirmar pedido</button>)}
            {order.status === 'ready' && balance > 0 && <button type="button" className="button primary" disabled={staffBusy} onClick={() => askPayment(order, 'balance', balance)}>Registar restante {euro(balance)}</button>}
            {order.status === 'ready' && balance > 0 && <p className="muted">Registe o restante para poder marcar como entregue.</p>}
            {order.status === 'ready' && balance === 0 && <button type="button" className="button primary" disabled={staffBusy} onClick={() => ask({ title: 'Confirmar levantamento', body: 'Confirma que o cliente já levantou o pedido e que o pagamento integral está registado?', confirm: 'Marcar como levantado', run: () => api.orderStatus(order.id, 'delivered') })}>Marcar como levantado</button>}
            {order.capacity_resolution_required && paid > 0 && <button type="button" className="button secondary" disabled={staffBusy} onClick={() => askPayment(order, 'refund', paid)}>Registar reembolso</button>}
            {!['delivered', 'cancelled'].includes(order.status) && !order.capacity_resolution_required && <button type="button" className="button ghost danger-text" disabled={staffBusy} onClick={() => ask({ title: 'Cancelar pedido', body: paid > (order.deposit_required_cents ?? 0) ? 'Há pagamentos além do sinal, por isso é necessária resolução manual antes do cancelamento.' : paid > 0 ? 'Com menos de 48 horas até ao levantamento, o sinal não é devolvido. Com 48 horas ou mais, o servidor simula o reembolso do sinal.' : 'A capacidade é libertada. Se houver sinal pago, com menos de 48 horas fica retido; com 48 horas ou mais, o servidor simula o reembolso.', confirm: 'Cancelar pedido', danger: true, reason: true, run: reason => api.orderStatus(order.id, 'cancelled', reason) })}>Cancelar</button>}
          </div>
        </footer>}
      </article>;
    })}</div>}
    <NotifyDialog order={orders.find(order => order.id === notifyId && order.status === 'ready') ?? null} onClose={() => setNotifyId(null)} />
    <ConfirmDialog pending={pending} busy={staffBusy} onCancel={() => !staffBusy && setPending(null)} onConfirm={(reason, payment) => pending && void staffAction(() => pending.run(reason, payment), reason, pending.success)} />
  </section>;
}
