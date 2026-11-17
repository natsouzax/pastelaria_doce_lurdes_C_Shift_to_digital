import Image from 'next/image';
import { useState } from 'react';
import type { Product } from '@/lib/api';
import { categories, categoryOf, euro, leadLabel, productPhoto, units, type Category } from './presentation';
import { EmptyState, HeroVisual, Icon, Loading, Notice, type IconName } from './ui';

export function Hero({ onTrack }: { onTrack: () => void }) {
  return <section className="hero" aria-labelledby="hero-title">
    <div className="hero-copy">
      <p className="eyebrow hero-in">Pastelaria · encomendas</p>
      <h1 id="hero-title" className="hero-in">Doces momentos,<br /><em>feitos com tempo.</em></h1>
      <p className="hero-lead hero-in">Bolos, doces e salgados para a sua mesa. Escolha, combine o levantamento e a nossa Gestora confirma a sua encomenda.</p>
      <div className="hero-actions hero-in"><a className="button primary" href="#catalogo">Ver catálogo <Icon name="arrow" size={18} /></a><button type="button" className="button ghost" onClick={onTrack}>Acompanhar pedido</button></div>
      <ul className="hero-facts hero-in" aria-label="Como funciona a encomenda">
        <li><strong>Sem pagamento online</strong><span>Paga na pastelaria</span></li>
        <li><strong>Confirmada pela Gestora</strong><span>Até lá, fica pendente</span></li>
        <li><strong>5 dias · 48 horas</strong><span>Bolos personalizados · restantes</span></li>
      </ul>
    </div>
    <HeroVisual />
  </section>;
}

const iconFor: Record<Category, IconName> = { Bolos: 'cake', Doces: 'sweet', Salgados: 'savoury' };

export function ProductCard({ product, inCart, add }: { product: Product; inCart: number; add: (product: Product) => void }) {
  const category = categoryOf(product);
  const photo = productPhoto(product);
  return <article className="product reveal">
    <div className="product-top"><span className={`product-icon product-icon--${category.toLowerCase()}`}><Icon name={iconFor[category]} size={24} /></span>{product.is_custom_cake ? <span className="tag tag--gold">Personalizável</span> : <span className="tag">{category}</span>}</div>
    <div className="product-photo">{photo ? <Image src={photo} alt={`Imagem ilustrativa: ${product.name}`} width={640} height={480} sizes="(max-width: 620px) 100vw, (max-width: 1024px) 50vw, 33vw" /> : <span className="photo-fallback" aria-hidden="true"><Icon name={iconFor[category]} size={36} /></span>}</div>
    <h3>{product.name}</h3>
    <p className="price"><strong>{euro(product.unit_price_cents)}</strong><span>/ {units[product.unit]}</span></p>
    <ul className="product-meta">
      <li><Icon name="clock" size={16} /><span>Encomende com <strong>{leadLabel(product.min_lead_hours)}</strong> de antecedência</span></li>
    </ul>
    <div className="allergens"><span className="allergens-label">Alergénios</span>{product.allergens.length ? <ul>{product.allergens.map(item => <li key={item}>{item}</li>)}</ul> : <span className="muted">Não indicados</span>}</div>
    <button type="button" className="button add" onClick={() => add(product)}><Icon name="plus" size={18} />{product.is_custom_cake ? 'Adicionar bolo' : 'Adicionar ao cesto'}{inCart > 0 && <span className="in-cart">{inCart} no cesto</span>}</button>
  </article>;
}

export function Catalog({ products, loading, error, retry, add, counts }: { products: Product[]; loading: boolean; error: string; retry: () => void; add: (product: Product) => void; counts: Record<string, number> }) {
  const [category, setCategory] = useState<Category | 'Todos'>('Todos');
  const ordered = [...products].sort((a, b) => categories.indexOf(categoryOf(a)) - categories.indexOf(categoryOf(b)));
  const shown = ordered.filter(product => category === 'Todos' || categoryOf(product) === category);
  const present = categories.filter(item => products.some(product => categoryOf(product) === item));
  return <section className="section" id="catalogo" aria-labelledby="catalog-title">
    <div className="section-heading reveal"><div><p className="eyebrow">Catálogo</p><h2 id="catalog-title">O que vai para a sua mesa?</h2></div><p>Bolos, doces e salgados por encomenda. Os preços e os alergénios são os de cada produto.</p></div>
    {!loading && !error && products.length > 0 && <div className="filters reveal" role="group" aria-label="Categorias">{(['Todos', ...present] as const).map(item => <button type="button" key={item} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}<span>{item === 'Todos' ? products.length : products.filter(product => categoryOf(product) === item).length}</span></button>)}</div>}
    {loading ? <Loading label="A carregar o catálogo…" /> : error ? <div className="state-block"><Notice tone="error"><strong>Não foi possível carregar o catálogo.</strong> {error}</Notice><button className="button secondary" type="button" onClick={retry}>Tentar novamente</button></div> : !shown.length ? <EmptyState title="Ainda não há produtos disponíveis">Volte mais tarde ou experimente outra categoria.</EmptyState> : <div className="product-grid">{shown.map(product => <ProductCard key={product.id} product={product} inCart={counts[product.id] ?? 0} add={add} />)}</div>}
  </section>;
}

export function HowToOrder() {
  const steps = [
    ['Escolha os produtos', 'Adicione ao cesto. Em cada bolo indique peso, mensagem e alergias.'],
    ['Combine o levantamento', 'Escolha o dia e a hora. Não há levantamentos à segunda-feira.'],
    ['Deixe o seu contacto', 'Nome e telefone, para a pastelaria falar consigo se for preciso.'],
    ['Aguarde a confirmação', 'A Gestora verifica a disponibilidade. Até lá, o pedido fica pendente.'],
  ];
  return <section className="section how" id="como-encomendar" aria-labelledby="how-title">
    <div className="section-heading reveal"><div><p className="eyebrow">Passo a passo</p><h2 id="how-title">Da escolha ao levantamento</h2></div><p>Sem conta e sem pagamento online. Guarde o código do pedido para o acompanhar.</p></div>
    <ol className="how-steps">{steps.map(([title, text], index) => <li className="reveal" key={title} style={{ transitionDelay: `${index * 70}ms` }}><span>{String(index + 1).padStart(2, '0')}</span><h3>{title}</h3><p>{text}</p></li>)}</ol>
  </section>;
}
