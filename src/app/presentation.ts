import { ApiFailure, type Product } from '@/lib/api';

export const euro = (cents: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(cents / 100);
export const weightLabel = (weight: number | string) => `${new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 3 }).format(Number(weight))} kg`;
export const units: Record<Product['unit'], string> = { kg: 'kg', unidade: 'unidade', cento: 'cento', duzia: 'dúzia', meia_duzia: 'meia dúzia' };
export const pickupTimeLabel = (value: string) => new Intl.DateTimeFormat('pt-PT', { timeZone: 'Europe/Lisbon', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
export const leadLabel = (hours: number) => hours % 24 === 0 ? `${hours / 24} ${hours === 24 ? 'dia' : 'dias'}` : `${hours} horas`;

export type Line = { key: string; product_id: string; quantity: string; weight_kg: string; cake_message: string; declared_allergies: string; production_notes: string };

export const newLine = (product: Product): Line => ({ key: crypto.randomUUID(), product_id: product.id, quantity: '1', weight_kg: product.is_custom_cake ? '2' : '', cake_message: '', declared_allergies: '', production_notes: '' });

export function lineAmount(line: Line, product: Product) {
  const amount = Number(product.is_custom_cake ? line.weight_kg : line.quantity);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

export const lineTotal = (line: Line, product: Product) => Math.round(lineAmount(line, product) * product.unit_price_cents);

export type Category = 'Bolos' | 'Doces' | 'Salgados';
export const categories: Category[] = ['Bolos', 'Doces', 'Salgados'];

/** Categoria de montra. Devolve null para categorias desconhecidas (ex.: dados de teste), que não entram no catálogo. */
export function categoryOf(product: Product): Category | null {
  const name = product.category.toLowerCase();
  if (name.includes('salgad')) return 'Salgados';
  if (name.includes('doce')) return 'Doces';
  if (name.includes('bolo')) return 'Bolos';
  return null;
}

export type Problem = { code: string; message: string };

const messages: Record<string, string> = {
  CAKE_LIMIT: 'Cada dia aceita no máximo 6 bolos. Para encomendar mais bolos para o mesmo dia, contacte diretamente a pastelaria.',
  CAPACITY_FULL: 'Esta data já atingiu o limite de seis encomendas ou de capacidade para bolos personalizados. Escolha outro dia de levantamento.',
  CAPACITY_LOST_AFTER_PAYMENT: 'O sinal foi registado, mas a vaga deixou de estar disponível. É necessário reagendar ou registar o reembolso.',
  PICKUP_TOO_SOON: 'O levantamento escolhido não respeita a antecedência necessária. Escolha uma data mais tarde.',
  MONDAY_PICKUP: 'Não há levantamentos à segunda-feira. Escolha outro dia.',
  UNAUTHENTICATED: 'A sessão terminou. Entre novamente.',
  FORBIDDEN: 'Esta conta não tem permissão para esta ação.',
  RATE_LIMITED: 'Foram feitas demasiadas consultas seguidas. Aguarde um momento e tente outra vez.',
};

export function describeError(error: unknown): Problem {
  if (error instanceof ApiFailure) return { code: error.code, message: messages[error.code] ?? error.message };
  return { code: 'UNKNOWN', message: error instanceof Error ? error.message : 'Não foi possível concluir. Tente novamente.' };
}

export const pickupProblems = ['CAKE_LIMIT', 'CAPACITY_FULL', 'PICKUP_TOO_SOON', 'MONDAY_PICKUP'];

/** These are illustrative images. Unknown products intentionally have no image. */
export function productPhoto(product: Pick<Product, 'name'>): string | null {
  const name = product.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const images: [string, string][] = [
    ['chocolate', 'chocolate'], ['morango', 'morango'], ['noz', 'noz'],
    ['bolacha', 'bolacha'], ['pao de lo', 'pao-lo'], ['amendoa', 'amendoa'],
    ['rissois', 'rissois'], ['croquetes', 'croquetes'], ['quiches', 'quiches'],
    ['brigadeiros', 'brigadeiros'], ['nata', 'natas'],
  ];
  const slug = images.find(([part]) => name.includes(part))?.[1];
  return slug ? `/images/products/${slug}.webp` : null;
}
