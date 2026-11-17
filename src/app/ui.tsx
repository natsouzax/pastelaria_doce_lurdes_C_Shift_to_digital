import type { OrderStatus } from '@/lib/api';

const labels: Record<string, string> = {
  pending: 'A aguardar confirmação',
  confirmed: 'Confirmada',
  in_production: 'Em produção',
  ready: 'Pronta a levantar',
  delivered: 'Entregue',
  cancelled: 'Cancelada',
  to_do: 'Por começar',
  in_progress: 'Em produção',
};

export function Status({ value }: { value: string }) {
  return <span className={`status status--${value}`}><i aria-hidden="true" />{labels[value] ?? value}</span>;
}

export function EmptyState({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="empty-state"><span className="empty-symbol" aria-hidden="true">✳</span><h3>{title}</h3><p>{children}</p></div>;
}

export function Loading({ label }: { label: string }) {
  return <div className="loading" role="status"><p>{label}</p><div className="skeleton-grid">{[0, 1, 2].map(index => <div className="skeleton" key={index} />)}</div></div>;
}

export function HeroArt() {
  return <svg className="hero-art" viewBox="0 0 520 620" role="img" aria-label="Mãos a decorar um bolo, sem mostrar rosto">
    <rect width="520" height="620" rx="36" fill="#f7f0e2" />
    <path d="M64 0h392v392c0 125-88 214-196 214S64 517 64 392Z" fill="#102b4e" />
    <circle cx="260" cy="204" r="132" fill="#173a64" />
    <circle cx="260" cy="204" r="104" fill="none" stroke="#c6a15b" strokeWidth="1.5" opacity=".65" />
    <path d="M52 430h416v190H52Z" fill="#f0e1c6" />
    <ellipse cx="260" cy="438" rx="168" ry="30" fill="#e3cfa8" />
    <ellipse cx="260" cy="430" rx="150" ry="26" fill="#fffaf0" />
    <path d="M172 306h176l-14 118c-2 18-33 30-74 30s-72-12-74-30Z" fill="#c6a15b" />
    <path d="M172 306h176v28H172Z" fill="#f7f0e2" />
    <path d="M172 334c34 22 142 22 176 0v34c-38 24-138 24-176 0Z" fill="#fff7e8" />
    <path d="M172 368c38 24 138 24 176 0v30c-38 26-138 26-176 0Z" fill="#ead7b4" />
    <ellipse cx="260" cy="306" rx="88" ry="20" fill="#fffaf0" />
    <path d="M174 305c0-11 39-20 86-20s86 9 86 20v10c0-11-39-20-86-20s-86 9-86 20Z" fill="#f0d9ae" />
    <path d="M205 290c8-18 22-31 38-38M294 288c-8-18-20-30-36-37" stroke="#c6a15b" strokeWidth="4" strokeLinecap="round" />
    <circle cx="260" cy="276" r="11" fill="#b4523f" />
    <circle cx="242" cy="269" r="6" fill="#b4523f" />
    <circle cx="278" cy="269" r="6" fill="#b4523f" />
    <path d="M252 252c4-16 12-25 20-30 4 15 1 25-10 32Z" fill="#2f6b52" />
    <path d="M96 408c22-36 52-58 84-66 18-4 31 3 34 17 3 13-7 23-23 29-22 8-39 25-49 48Z" fill="#f1c9a4" />
    <path d="M116 391c20-23 42-36 66-42 13-3 23 1 26 10 3 10-5 18-17 22-19 6-33 18-43 36Z" fill="#f7dcc0" />
    <path d="M424 404c-24-34-54-54-86-60-18-3-30 5-32 19-2 13 9 22 25 27 22 7 38 24 47 46Z" fill="#f1c9a4" />
    <path d="M404 387c-21-21-43-33-67-37-13-2-22 3-24 12-2 10 7 17 19 20 19 5 33 17 42 34Z" fill="#f7dcc0" />
    <path d="M232 190c14-14 30-14 44 0M246 176l14-14 14 14" stroke="#c6a15b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="92" cy="150" r="4" fill="#c6a15b" />
    <circle cx="428" cy="126" r="3" fill="#c6a15b" />
    <path d="M410 206v18M401 215h18" stroke="#c6a15b" strokeWidth="2.5" strokeLinecap="round" />
    <text x="260" y="572" textAnchor="middle" fill="#102b4e" fontFamily="Volkhov, Georgia, serif" fontSize="28" letterSpacing="6">FEITO À MÃO</text>
  </svg>;
}

export function ProductArt({ name, category }: { name: string; category: string }) {
  const savoury = category.toLowerCase().includes('salgad');
  const sweet = category.toLowerCase().includes('doce');
  const base = savoury ? '#e8d6b6' : sweet ? '#f2dcc1' : '#e8cfa8';
  const top = savoury ? '#c98b5a' : sweet ? '#d28b7a' : '#b86a4d';
  return <svg className="product-art" viewBox="0 0 320 220" role="img" aria-label={`Ilustração de ${name}`}>
    <rect width="320" height="220" rx="18" fill="#f9f4ea" />
    <circle cx="160" cy="106" r="80" fill="#fffdf8" />
    <circle cx="160" cy="106" r="66" fill="none" stroke="#e2d3b6" strokeWidth="2" />
    <ellipse cx="160" cy="168" rx="86" ry="14" fill="#e7dcc7" />
    {savoury ? <><path d="M92 150c14-46 54-72 109-64 28 4 44 22 32 42-10 17-36 10-52 22-19 14-51 18-89 0Z" fill={base} stroke={top} strokeWidth="3" /><path d="M112 138c24-24 58-34 92-26" stroke={top} strokeWidth="4" strokeLinecap="round" /><circle cx="140" cy="132" r="4" fill={top} /><circle cx="182" cy="122" r="4" fill={top} /><circle cx="200" cy="143" r="3" fill={top} /></> : <><path d="M100 150h120l-10-52c-2-10-22-16-50-16s-48 6-50 16Z" fill={base} stroke={top} strokeWidth="3" /><path d="M100 116c22 14 98 14 120 0v18c-24 16-96 16-120 0Z" fill="#fff8ec" /><ellipse cx="160" cy="98" rx="50" ry="13" fill="#fffaf0" /><path d="M142 84c5-14 14-22 24-26 6 13 3 23-8 29Z" fill="#2f6b52" /><circle cx="160" cy="90" r="8" fill={top} /></>}
    <path d="M54 62l6-10M266 58l8-8M272 76h12" stroke="#c6a15b" strokeWidth="2.5" strokeLinecap="round" />
  </svg>;
}

export function Timeline({ status }: { status: OrderStatus }) {
  const steps = ['pending', 'confirmed', 'in_production', 'ready', 'delivered'];
  const current = steps.indexOf(status);
  if (status === 'cancelled') return <p className="notice">Este pedido foi cancelado. Contacte a pastelaria se precisar de ajuda.</p>;
  return <ol className="timeline" aria-label="Progresso da encomenda">{steps.map((step, index) => <li key={step} className={index <= current ? 'complete' : ''} aria-current={index === current ? 'step' : undefined}><span aria-hidden="true">{index < current ? '✓' : index + 1}</span><div>{labels[step]}{index === current && <small>Estado atual</small>}</div></li>)}</ol>;
}
