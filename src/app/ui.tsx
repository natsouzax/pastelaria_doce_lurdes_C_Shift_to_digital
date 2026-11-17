import type { OrderStatus } from '@/lib/api';

const statusLabels: Record<string, string> = {
  pending: 'A aguardar confirmação',
  confirmed: 'Confirmada',
  in_production: 'Em produção',
  ready: 'Pronta a levantar',
  delivered: 'Entregue',
  cancelled: 'Cancelada',
  to_do: 'Por começar',
  in_progress: 'Em produção',
};

export const statusLabel = (value: string) => statusLabels[value] ?? value;

export function Status({ value }: { value: string }) {
  return <span className={`status status--${value}`}><i aria-hidden="true" />{statusLabel(value)}</span>;
}

const paths = {
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  bag: <><path d="M5.5 8.5h13l-1 11.5h-11l-1-11.5Z" /><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  back: <path d="M19 12H5m6-6-6 6 6 6" />,
  alert: <><circle cx="12" cy="12" r="8.5" /><path d="M12 8v4.5M12 16v.01" /></>,
  calendar: <><rect x="4.5" y="5.5" width="15" height="14" rx="2" /><path d="M4.5 10h15M9 3.5v4M15 3.5v4" /></>,
  copy: <><rect x="8.5" y="8.5" width="11" height="11" rx="2" /><path d="M15.5 8.5v-2a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" /></>,
  phone: <path d="M7 4.5h3l1.5 4-2 1.3a10 10 0 0 0 4.7 4.7l1.3-2 4 1.5v3a2 2 0 0 1-2 2A14 14 0 0 1 5 6.5a2 2 0 0 1 2-2Z" />,
  cake: <><path d="M4 20h16M5 20v-6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6" /><path d="M5 15.5c2 1.4 3.2 1.4 5 0s3.2-1.4 5 0c1.5 1.2 2.8 1.2 4 0" /><path d="M12 12V8.5M12 8.5c-1.2-1-1.2-2.2 0-3.5 1.2 1.300 1.2 2.5 0 3.5Z" /></>,
  sweet: <><path d="M5 12.5a7 6 0 0 1 14 0H5Z" /><path d="m6.500 12.5 1.5 7h8l1.5-7" /><path d="M10 9.5v.01M14 8.5v.01M12 11v.01" /></>,
  savoury: <><path d="M4 17.5C4 11 8 7 13 7c4 0 7 3 7 6 0 3.2-3 4.5-5 4.5H4Z" /><path d="M9 13c1.5 1 3.2 1 4.800 0" /></>,
  sparkle: <path d="M12 4v5M12 15v5M4 12h5m6 0h5" />,
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export function EmptyState({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return <div className="empty-state"><span className="empty-symbol"><Icon name="sparkle" size={22} /></span><h3>{title}</h3><p>{children}</p>{action}</div>;
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'error' | 'success'; children: React.ReactNode }) {
  return <div className={`notice notice--${tone}`} role={tone === 'error' ? 'alert' : undefined}><Icon name={tone === 'success' ? 'check' : 'alert'} size={18} /><div>{children}</div></div>;
}

export function Loading({ label, count = 6 }: { label: string; count?: number }) {
  return <div className="loading" role="status" aria-label={label}><div className="skeleton-grid">{Array.from({ length: count }, (_, index) => <div className="skeleton" key={index} />)}</div></div>;
}

/** Placeholder do hero. Para usar uma fotografia real (mãos a preparar o bolo, sem rostos), defina o caminho em public/. */
export const HERO_PHOTO: string | null = null;

export function HeroVisual() {
  return <div className="hero-visual">
    <div className="hero-arch">
      {HERO_PHOTO ? <img src={HERO_PHOTO} alt="Mãos a preparar um bolo na pastelaria Doce Lurdes" /> : <svg viewBox="0 0 480 560" role="img" aria-label="Ilustração de um bolo de dois andares num prato" preserveAspectRatio="xMidYMax slice">
        <path d="M24 560V250a216 216 0 0 1 432 0v310" fill="none" stroke="#c9a661" strokeWidth="1" opacity=".55" />
        <ellipse cx="240" cy="468" rx="178" ry="22" fill="#0a1f38" opacity=".5" />
        <ellipse cx="240" cy="452" rx="170" ry="24" fill="#f3ead8" />
        <ellipse cx="240" cy="446" rx="146" ry="17" fill="#fff" />
        <rect x="132" y="350" width="216" height="92" rx="12" fill="#fff" />
        <rect x="132" y="384" width="216" height="8" fill="#c9a661" opacity=".85" />
        <path d="M132 362c0-6 6-12 12-12h192c6 0 12 6 12 12v6c-14 12-26 4-40 12-14 8-26-2-42 6-16-8-26 2-42-6-14-8-26 0-40-12Z" fill="#f8f2e6" />
        <rect x="170" y="280" width="140" height="72" rx="12" fill="#fbf5e9" />
        <rect x="170" y="312" width="140" height="6" fill="#c9a661" opacity=".85" />
        <path d="M170 292c0-6 5-12 11-12h118c6 0 11 6 11 12v4c-12 10-22 3-34 9-12 6-20-2-36 4-16-6-24 2-36-4-12-6-22 1-34-9Z" fill="#fff" />
        <circle cx="240" cy="262" r="11" fill="#b5524a" /><circle cx="220" cy="268" r="8" fill="#b5524a" /><circle cx="260" cy="268" r="8" fill="#b5524a" />
        <path d="M240 252c0-12 6-20 14-24M240 252c0-10-5-17-12-21" stroke="#c9a661" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <circle cx="98" cy="196" r="2.5" fill="#c9a661" /><circle cx="388" cy="150" r="2" fill="#c9a661" /><path d="M392 252v14m-7-7h14" stroke="#c9a661" strokeWidth="2" strokeLinecap="round" />
      </svg>}
    </div>
    <div className="hero-card" aria-hidden="true"><span className="hero-card-icon"><Icon name="cake" size={22} /></span><div><strong>Bolos personalizados</strong><span>Peso, mensagem e alergias à medida</span></div></div>
    <div className="hero-seal" aria-hidden="true"><span>Feito</span><em>à mão</em></div>
  </div>;
}

export function Timeline({ status }: { status: OrderStatus }) {
  const steps = ['pending', 'confirmed', 'in_production', 'ready', 'delivered'];
  const current = steps.indexOf(status);
  if (status === 'cancelled') return <Notice tone="error">Este pedido foi cancelado. Contacte a pastelaria se precisar de ajuda.</Notice>;
  return <ol className="timeline" aria-label="Progresso da encomenda">{steps.map((step, index) => <li key={step} className={index < current ? 'done' : index === current ? 'current' : ''} aria-current={index === current ? 'step' : undefined}><span className="timeline-dot" aria-hidden="true">{index < current ? <Icon name="check" size={14} /> : index + 1}</span><span className="timeline-label">{statusLabel(step)}</span></li>)}</ol>;
}
