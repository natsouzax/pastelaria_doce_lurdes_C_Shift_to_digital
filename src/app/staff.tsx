'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiFailure, type ItemStatus, type OrderStatus, type StaffOrder, type StaffRole } from '@/lib/api';
import { dateLabel, lisbonDateString } from '@/lib/dates';
import { createAuthClient } from '@/lib/supabase/client';
import { describeError, euro, pickupTimeLabel, units } from './presentation';
import { EmptyState, Icon, Loading, Notice, Status, statusLabel } from './ui';

type Pending = { title: string; body: string; confirm: string; danger?: boolean; reason?: boolean; run: (reason?: string) => Promise<unknown> };

function ConfirmDialog({ pending, busy, onCancel, onConfirm }: { pending: Pending | null; busy: boolean; onCancel: () => void; onConfirm: (reason?: string) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState('');
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (pending && !dialog.open) { setReason(''); dialog.showModal(); }
    if (!pending && dialog.open) dialog.close();
  }, [pending]);
  return <dialog ref={ref} className="dialog" onCancel={event => { event.preventDefault(); onCancel(); }} aria-labelledby="dialog-title">
    {pending && <form onSubmit={event => { event.preventDefault(); if (pending.reason && !reason.trim()) return; onConfirm(reason.trim()); }}>
      <h2 id="dialog-title">{pending.title}</h2>
      <p>{pending.body}</p>
      {pending.reason && <div className="field"><label htmlFor="dialog-reason">Motivo do cancelamento</label><textarea id="dialog-reason" rows={3} required value={reason} onChange={event => setReason(event.target.value)} autoFocus /></div>}
      <div className="dialog-actions"><button type="button" className="button ghost" onClick={onCancel} disabled={busy}>Voltar</button><button className={`button ${pending.danger ? 'danger' : 'primary'}`} disabled={busy || (pending.reason && !reason.trim())}>{busy ? 'A guardar…' : pending.confirm}</button></div>
    </form>}
  </dialog>;
}

const shiftDay = (date: string, days: number) => { const day = new Date(`${date}T12:00:00Z`); day.setUTCDate(day.getUTCDate() + days); return day.toISOString().slice(0, 10); };
const amountLabel = (item: StaffOrder['items'][number]) => item.weight_kg ? `${item.weight_kg} kg` : `${item.quantity} × ${units[item.unit]}`;
const filters: Array<{ value: 'all' | OrderStatus; label: string }> = [{ value: 'all', label: 'Todas' }, { value: 'pending', label: 'Pendentes' }, { value: 'confirmed', label: 'Confirmadas' }, { value: 'in_production', label: 'Em produção' }, { value: 'ready', label: 'Prontas' }, { value: 'delivered', label: 'Entregues' }, { value: 'cancelled', label: 'Canceladas' }];

export function Staff() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<StaffRole | null>(null);
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [staffDate, setStaffDate] = useState('');
  const [orders, setOrders] = useState<StaffOrder[]>([]);
  const [staffError, setStaffError] = useState('');
  const [staffBusy, setStaffBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<'all' | OrderStatus>('all');
  const [pending, setPending] = useState<Pending | null>(null);
  const paymentKeys = useRef<Record<string, string>>({});

  const loadOrders = useCallback(async (date: string) => {
    try {
      setStaffError('');
      setOrders(await api.staffOrders(date));
    } catch (error) {
      setStaffError(describeError(error).message);
      setOrders([]);
    } finally { setLoaded(true); }
  }, []);

  useEffect(() => {
    let active = true;
    try {
      const auth = createAuthClient();
      void auth.auth.getUser().then(async ({ data }) => {
        if (active && data.user) {
          try { setRole((await api.me()).role); } catch (error) { if (active) setAuthError(describeError(error).message); }
        }
      });
      const { data: { subscription } } = auth.auth.onAuthStateChange((_event, session) => {
        if (!active) return;
        setOrders([]);
        setLoaded(false);
        setRole(null);
        if (!session) return;
        void api.me().then(me => { if (active) { setRole(me.role); setAuthError(''); } }).catch(error => { if (active) setAuthError(describeError(error).message); });
      });
      return () => { active = false; subscription.unsubscribe(); };
    } catch (error) {
      setAuthError(describeError(error).message);
      return () => { active = false; };
    }
  }, []);

  useEffect(() => {
    if (!role) return;
    const date = staffDate || lisbonDateString(new Date());
    if (!staffDate) setStaffDate(date);
    setLoaded(false);
    void loadOrders(date);
  }, [role, staffDate, loadOrders]);

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setAuthError('');
    setAuthBusy(true);
    try {
      const { error } = await createAuthClient().auth.signInWithPassword({ email, password });
      if (error) throw error;
      setPassword('');
      setRole((await api.me()).role);
    } catch (error) {
      setAuthError(describeError(error).message);
    } finally { setAuthBusy(false); }
  }

  async function signOut() {
    try { await createAuthClient().auth.signOut(); }
    finally { setRole(null); setOrders([]); setLoaded(false); setStaffDate(''); }
  }

  async function staffAction(action: (reason?: string) => Promise<unknown>, reason?: string) {
    setStaffError('');
    setStaffBusy(true);
    try {
      await action(reason);
    } catch (error) {
      const detail = error instanceof ApiFailure && error.paymentRecorded ? ' O sinal foi registado; não repita o pagamento.' : '';
      setStaffError(describeError(error).message + detail);
    } finally {
      await loadOrders(staffDate);
      setStaffBusy(false);
      setPending(null);
    }
  }

  async function pay(order: StaffOrder, kind: 'deposit' | 'balance' | 'refund', amount: number) {
    const token = `${order.id}:${kind}`;
    const key = paymentKeys.current[token] ?? crypto.randomUUID();
    paymentKeys.current[token] = key;
    try {
      await api.payment(order.id, kind, amount, kind !== 'refund', key);
      delete paymentKeys.current[token];
    } catch (error) {
      if (error instanceof ApiFailure && error.status < 500) delete paymentKeys.current[token];
      throw error;
    }
  }

  const ask = (next: Pending) => setPending(next);
  const askPayment = (order: StaffOrder, kind: 'deposit' | 'balance' | 'refund', amount: number) => {
    const what = kind === 'refund' ? 'reembolso' : kind === 'deposit' ? 'sinal' : 'valor restante';
    ask({ title: `Registar ${what}`, body: `Confirma que o ${what} de ${euro(amount)} foi ${kind === 'refund' ? 'devolvido' : 'recebido fora da aplicação'}? Este registo altera o saldo da encomenda.`, confirm: `Registar ${euro(amount)}`, run: () => pay(order, kind, amount) });
  };

  if (!role) return <section className="page staff-login" aria-labelledby="staff-title">
    <div className="login-card">
      <p className="eyebrow">Equipa</p>
      <h1 id="staff-title">Entrar na área da equipa</h1>
      <p className="muted">Gestora e Produção entram com a sua conta. Entrar não altera nenhuma encomenda.</p>
      <form onSubmit={signIn}>
        <div className="field"><label htmlFor="staff-email">Email</label><input id="staff-email" type="email" required value={email} onChange={event => setEmail(event.target.value)} autoComplete="username" /></div>
        <div className="field"><label htmlFor="staff-password">Palavra-passe</label><input id="staff-password" type="password" required value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" /></div>
        {authError && <Notice tone="error">{authError}</Notice>}
        <button className="button primary block" disabled={authBusy}>{authBusy ? 'A entrar…' : 'Entrar'}</button>
      </form>
    </div>
  </section>;

  const manager = role === 'manager';
  const sorted = [...orders].sort((a, b) => a.pickup_at.localeCompare(b.pickup_at));
  const visible = manager ? sorted.filter(order => filter === 'all' || order.status === filter) : sorted;
  const items = orders.flatMap(order => order.items);
  const count = (status: OrderStatus) => orders.filter(order => order.status === status).length;
  const itemCount = (status: ItemStatus) => items.filter(item => item.production_status === status).length;

  return <section className="page staff" aria-labelledby="staff-title">
    <div className="page-heading">
      <div><p className="eyebrow">{manager ? 'Gestora' : 'Produção'}</p><h1 id="staff-title">{manager ? 'Encomendas' : 'Plano de produção'}</h1></div>
      <button type="button" className="text-link" onClick={() => void signOut()}>Terminar sessão</button>
    </div>

    <div className="staff-toolbar">
      <div className="day-nav" role="group" aria-label="Escolher dia de levantamento">
        <button type="button" className="icon-button" onClick={() => setStaffDate(shiftDay(staffDate, -1))} aria-label="Dia anterior"><Icon name="back" size={18} /></button>
        <label className="day-label"><span className="sr-only">Dia de levantamento</span><Icon name="calendar" size={18} /><strong>{staffDate ? dateLabel(new Date(`${staffDate}T12:00:00Z`)) : '…'}</strong><input type="date" value={staffDate} onChange={event => event.target.value && setStaffDate(event.target.value)} /></label>
        <button type="button" className="icon-button" onClick={() => setStaffDate(shiftDay(staffDate, 1))} aria-label="Dia seguinte"><Icon name="arrow" size={18} /></button>
      </div>
      <button type="button" className="button secondary" disabled={staffBusy} onClick={() => void loadOrders(staffDate)}>{staffBusy ? 'A atualizar…' : 'Atualizar'}</button>
    </div>

    {loaded && orders.length > 0 && (manager
      ? <div className="filters scroll-x" role="group" aria-label="Filtrar por estado">{filters.map(({ value, label }) => { const total = value === 'all' ? orders.length : count(value); return total > 0 || value === 'all' ? <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}<span>{total}</span></button> : null; })}</div>
      : <dl className="tiles"><div><dt>Por começar</dt><dd>{itemCount('to_do')}</dd></div><div><dt>Em produção</dt><dd>{itemCount('in_progress')}</dd></div><div><dt>Prontos</dt><dd>{itemCount('ready')}</dd></div></dl>)}

    {staffError && <Notice tone="error">{staffError}</Notice>}
    {!loaded && <Loading label="A carregar encomendas…" count={3} />}
    {loaded && !visible.length && !staffError && <EmptyState title={orders.length ? 'Nenhuma encomenda com este estado' : 'Sem encomendas para este dia'}>{orders.length ? 'Escolha outro filtro.' : 'Escolha outro dia de levantamento ou atualize a lista.'}</EmptyState>}

    {loaded && visible.length > 0 && <div className="order-list">{visible.map(order => {
      const balance = order.balance_due_cents ?? 0;
      const paid = order.amount_paid_cents ?? 0;
      const hasCake = order.items.some(item => item.weight_kg !== null);
      return <article className="order-card" key={order.id}>
        <header className="order-head">
          <div className="order-time"><strong>{pickupTimeLabel(order.pickup_at)}</strong></div>
          <div className="order-who">{manager && <h2>{order.customer_name ?? 'Cliente'}</h2>}{manager && order.customer_phone && <a href={`tel:${order.customer_phone}`}><Icon name="phone" size={15} />{order.customer_phone}</a>}{!manager && <h2>Encomenda #{order.id.slice(0, 6).toUpperCase()}</h2>}</div>
          <Status value={order.status} />
        </header>
        {manager && order.capacity_resolution_required && <Notice tone="error"><strong>Sinal recebido, mas sem vaga.</strong> Não registe o sinal outra vez: reagende ou registe o reembolso.</Notice>}
        <div className="order-items">{order.items.map(item => <div className={`order-item${!manager ? ` item--${item.production_status}` : ''}`} key={item.id}>
          <div className="order-item-main">
            <div className="order-item-title"><h3>{item.product_name}</h3><span className="amount">{amountLabel(item)}</span></div>
            {item.cake_message && <p>Mensagem: “{item.cake_message}”</p>}
            {!manager && <div className="allergy-blocks">
              <p className={item.declared_allergies.length ? 'allergy allergy--declared' : 'allergy'}><b>Alergias declaradas</b>{item.declared_allergies.join(', ') || 'Nenhuma'}</p>
              <p className="allergy allergy--product"><b>Alergénios do produto</b>{item.product_allergens.join(', ') || 'Não indicados'}</p>
            </div>}
            {!manager && item.production_notes && <p className="note"><b>Notas</b>{item.production_notes}</p>}
            {manager && <Status value={item.production_status} />}
          </div>
          {!manager && (item.production_status === 'ready' ? <span className="item-done"><Icon name="check" size={18} />Pronto</span> : <button type="button" className="button primary item-action" disabled={staffBusy} onClick={() => void staffAction(() => api.itemStatus(item.id, item.production_status === 'to_do' ? 'in_progress' : 'ready'))}>{item.production_status === 'to_do' ? 'Iniciar' : 'Marcar pronto'}</button>)}
        </div>)}</div>
        {manager && <footer className="order-foot">
          <dl className="money money--inline"><div><dt>Total</dt><dd>{euro(order.total_cents ?? 0)}</dd></div><div><dt>Pago</dt><dd>{euro(paid)}</dd></div><div><dt>Por pagar</dt><dd>{euro(balance)}</dd></div></dl>
          <div className="order-actions">
            {order.status === 'pending' && !order.capacity_resolution_required && (hasCake
              ? <button type="button" className="button primary" disabled={staffBusy} onClick={() => askPayment(order, 'deposit', order.deposit_required_cents ?? 0)}>Registar sinal {euro(order.deposit_required_cents ?? 0)}</button>
              : <button type="button" className="button primary" disabled={staffBusy} onClick={() => ask({ title: 'Confirmar pedido', body: `Confirma o pedido de ${order.customer_name ?? 'cliente'} para ${pickupTimeLabel(order.pickup_at)}?`, confirm: 'Confirmar', run: () => api.orderStatus(order.id, 'confirmed') })}>Confirmar pedido</button>)}
            {order.status === 'ready' && balance > 0 && <button type="button" className="button primary" disabled={staffBusy} onClick={() => askPayment(order, 'balance', balance)}>Registar restante {euro(balance)}</button>}
            {order.status === 'ready' && balance === 0 && <button type="button" className="button primary" disabled={staffBusy} onClick={() => ask({ title: 'Marcar como entregue', body: 'O pedido passa a Entregue e já não pode ser alterado.', confirm: 'Marcar entregue', run: () => api.orderStatus(order.id, 'delivered') })}>Marcar entregue</button>}
            {order.capacity_resolution_required && paid > 0 && <button type="button" className="button secondary" disabled={staffBusy} onClick={() => askPayment(order, 'refund', paid)}>Registar reembolso</button>}
            {!['delivered', 'cancelled'].includes(order.status) && !order.capacity_resolution_required && <button type="button" className="button ghost danger-text" disabled={staffBusy} onClick={() => ask({ title: 'Cancelar pedido', body: 'A capacidade é libertada e o servidor calcula a consequência financeira.', confirm: 'Cancelar pedido', danger: true, reason: true, run: reason => api.orderStatus(order.id, 'cancelled', reason) })}>Cancelar</button>}
          </div>
        </footer>}
      </article>;
    })}</div>}
    <ConfirmDialog pending={pending} busy={staffBusy} onCancel={() => !staffBusy && setPending(null)} onConfirm={reason => pending && void staffAction(pending.run, reason)} />
  </section>;
}
