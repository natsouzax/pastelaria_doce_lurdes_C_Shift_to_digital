'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, type CreatedOrder, type NewOrder, type Product, type TrackedOrder } from '@/lib/api';
import { Catalog, Hero, HowToOrder } from './catalog';
import { Checkout } from './checkout';
import { describeError, newLine, type Line, type Problem } from './presentation';
import { Staff } from './staff';
import { Tracking } from './tracking';
import { Icon } from './ui';

type View = 'shop' | 'cart' | 'track' | 'staff';

export default function Home() {
  const [view, setView] = useState<View>('shop');
  const [products, setProducts] = useState<Product[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [created, setCreated] = useState<CreatedOrder | null>(null);
  const [submitError, setSubmitError] = useState<Problem | null>(null);
  const [trackingCode, setTrackingCode] = useState('');
  const [tracked, setTracked] = useState<TrackedOrder | null>(null);
  const [trackError, setTrackError] = useState<Problem | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const loadProducts = useCallback(async () => {
    setCatalogLoading(true);
    try {
      setCatalogError('');
      setProducts(await api.products());
    } catch (error) {
      setCatalogError(describeError(error).message);
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  useEffect(() => { void loadProducts(); }, [loadProducts]);

  // Entrada suave dos blocos .reveal ao entrarem no ecrã.
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('.reveal:not(.in)'));
    if (!('IntersectionObserver' in window)) { nodes.forEach(node => node.classList.add('in')); return; }
    const observer = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('in'); observer.unobserve(entry.target); } }), { rootMargin: '0px 0px -8% 0px' });
    nodes.forEach(node => observer.observe(node));
    return () => observer.disconnect();
  }, [view, products, catalogLoading]);

  const counts = useMemo(() => lines.reduce<Record<string, number>>((acc, line) => ({ ...acc, [line.product_id]: (acc[line.product_id] ?? 0) + 1 }), {}), [lines]);

  function showToast(text: string) {
    window.clearTimeout(toastTimer.current);
    setToast({ text, id: Date.now() });
    toastTimer.current = window.setTimeout(() => setToast(null), 4500);
  }

  function goTo(next: View) {
    setView(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function add(product: Product) {
    setLines(current => [...current, newLine(product)]);
    setCreated(null);
    setSubmitError(null);
    showToast(`${product.name} adicionado ao cesto.`);
  }

  const updateLine = (key: string, patch: Partial<Line>) => setLines(current => current.map(line => line.key === key ? { ...line, ...patch } : line));
  const removeLine = (key: string) => setLines(current => current.filter(line => line.key !== key));
  const duplicateLine = (key: string) => setLines(current => current.flatMap(line => line.key === key ? [line, { ...line, key: crypto.randomUUID() }] : [line]));

  async function submitOrder(order: NewOrder) {
    setBusy(true);
    setSubmitError(null);
    setCreated(null);
    try {
      const result = await api.createOrder({ customer: order.customer, pickup_at: order.pickup_at, notes: null, items: order.items });
      setCreated(result);
      setTrackingCode(result.tracking_code);
      setTracked(null);
      setLines([]);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      setSubmitError(describeError(error));
    } finally {
      setBusy(false);
    }
  }

  async function trackOrder(event: React.FormEvent) {
    event.preventDefault();
    setTrackError(null);
    setTracked(null);
    setBusy(true);
    try {
      setTracked(await api.track(trackingCode));
    } catch (error) {
      setTrackError(describeError(error));
    } finally {
      setBusy(false);
    }
  }

  const tab = (name: View, label: string, badge?: number) => <button type="button" className={`nav-item nav-item--${name}${view === name ? ' active' : ''}`} aria-current={view === name ? 'page' : undefined} onClick={() => goTo(name)}>
    {name === 'cart' && <Icon name="bag" size={20} />}<span>{label}</span>{badge ? <span className="nav-badge" aria-label={`${badge} no cesto`}>{badge}</span> : null}
  </button>;

  return <div className="site-shell">
    <a className="skip-link" href="#conteudo">Saltar para o conteúdo</a>
    <header className="site-header">
      <button type="button" className="logo" onClick={() => goTo('shop')} aria-label="Doce Lurdes, página inicial"><span className="logo-mark" aria-hidden="true" /><span className="logo-name">Doce Lurdes</span><span className="logo-sub">Pastelaria</span></button>
      <nav className="main-nav" aria-label="Navegação principal">{tab('shop', 'Encomendar')}{tab('track', 'Acompanhar')}{tab('staff', 'Equipa')}{tab('cart', 'Cesto', lines.length)}</nav>
    </header>

    <main className="main-content" id="conteudo">
      {view === 'shop' && <>
        <Hero onTrack={() => goTo('track')} />
        <Catalog products={products} loading={catalogLoading} error={catalogError} retry={() => void loadProducts()} add={add} counts={counts} />
        <HowToOrder />
      </>}
      {view === 'cart' && <Checkout lines={lines} products={products} update={updateLine} remove={removeLine} duplicate={duplicateLine} shop={() => goTo('shop')} submit={submitOrder} busy={busy} error={submitError} created={created} track={() => goTo('track')} />}
      {view === 'track' && <Tracking code={trackingCode} setCode={setTrackingCode} tracked={tracked} error={trackError} busy={busy} submit={trackOrder} />}
      {view === 'staff' && <Staff />}
    </main>

    <footer className="site-footer"><span className="footer-logo">Doce Lurdes</span><span>Sem pagamento online · os pedidos ficam pendentes até a Gestora confirmar.</span></footer>

    {toast && <div className="toast" key={toast.id} role="status"><span>{toast.text}</span><button type="button" onClick={() => { setToast(null); goTo('cart'); }}>Ver cesto</button></div>}
  </div>;
}
