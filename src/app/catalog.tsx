import { useState } from 'react';
import type { Product } from '@/lib/api';
import { categoryOf, euro, leadLabel, units } from './presentation';
import { EmptyState, HeroArt, Loading, ProductArt } from './ui';

export function Hero() {
  return <section className="hero" aria-labelledby="hero-title">
    <div className="hero-copy">
      <p className="eyebrow">Pastelaria de bairro · desde sempre</p>
      <h1 id="hero-title">Feito com tempo,<br />para os seus<br /><em>melhores momentos.</em></h1>
      <p className="hero-lead">Bolos, doces e salgados para a sua mesa. Escolha os favoritos, combine o levantamento e deixe o resto connosco.</p>
      <div className="hero-actions"><a className="button primary" href="#catalogo">Ver catálogo <span aria-hidden="true">→</span></a><a className="text-link" href="#como-encomendar">Como funciona <span aria-hidden="true">↗</span></a></div>
      <p className="hero-footnote">Sem pagamento online. O pedido fica pendente até a Gestora confirmar.</p>
    </div>
    <div className="hero-visual"><HeroArt /></div>
  </section>;
}

export function Catalog({ products, loading, error, retry, add }: { products: Product[]; loading: boolean; error: string; retry: () => void; add: (product: Product) => void }) {
  const [category, setCategory] = useState('Todos');
  const [announcement, setAnnouncement] = useState('');
  const shown = products.filter(product => category === 'Todos' || categoryOf(product) === category);
  return <section className="catalog section" id="catalogo" aria-labelledby="catalog-title">
    <div className="section-heading"><div><p className="eyebrow">O que vai para a sua mesa?</p><h2 id="catalog-title">O nosso catálogo</h2></div><p>Bolos, doces e salgados por encomenda.<br />Escolha os seus favoritos e combine o levantamento.</p></div>
    <div className="catalog-toolbar"><div className="filters" aria-label="Categorias">{['Todos', 'Bolos', 'Doces', 'Salgados'].map(item => <button type="button" key={item} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}</div><span className="muted">{loading ? 'A consultar catálogo…' : `${shown.length} ${shown.length === 1 ? 'produto' : 'produtos'}`}</span></div>
    <p className="sr-only" role="status">{announcement}</p>
    {loading ? <Loading label="A carregar o catálogo…" /> : error ? <div className="error-state" role="alert"><h3>O catálogo está indisponível</h3><p>{error}</p><button className="button secondary" type="button" onClick={retry}>Tentar novamente</button></div> : !shown.length ? <EmptyState title="Sem produtos nesta categoria">Tente outra categoria ou volte mais tarde.</EmptyState> : <div className="product-grid">{shown.map(product => <article className="product" key={product.id}>
      <div className="product-photo"><ProductArt name={product.name} category={product.category} />{product.is_custom_cake && <span className="art-label">Personalizável</span>}</div>
      <div className="product-body">
        <div className="product-heading"><h3>{product.name}</h3><p className="price">{euro(product.unit_price_cents)}<small>/ {units[product.unit]}</small></p></div>
        <p className="product-lead"><span aria-hidden="true">◷</span> Encomendar com {leadLabel(product.min_lead_hours)} de antecedência</p>
        <p className="allergen-list"><strong>Alergénios:</strong> {product.allergens.join(', ') || 'Não indicados'}</p>
        <button type="button" className="add-button" onClick={() => { add(product); setAnnouncement(`${product.name} adicionado ao cesto.`); }}>Adicionar {product.is_custom_cake ? 'bolo' : 'ao cesto'}<span aria-hidden="true">+</span></button>
      </div>
    </article>)}</div>}
  </section>;
}

export function HowToOrder() {
  return <section className="how section" id="como-encomendar" aria-labelledby="how-title">
    <div className="section-heading"><div><p className="eyebrow">Simples e sem pressa</p><h2 id="how-title">Da escolha ao levantamento</h2></div><p>Quatro passos curtos. Sem conta, sem pagamento online.</p></div>
    <ol className="how-steps">
      <li><span>01</span><h3>Escolha os produtos</h3><p>Adicione ao cesto e personalize cada bolo com peso, mensagem e alergias.</p></li>
      <li><span>02</span><h3>Combine o levantamento</h3><p>Indique o dia e a hora. Não há levantamentos à segunda-feira.</p></li>
      <li><span>03</span><h3>Deixe o seu contacto</h3><p>Precisamos do nome e do telefone para o avisarmos quando estiver pronto.</p></li>
      <li><span>04</span><h3>Aguarde a confirmação</h3><p>A Gestora verifica a disponibilidade. O pedido pendente não reserva vaga.</p></li>
    </ol>
  </section>;
}
