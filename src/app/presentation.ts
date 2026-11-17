import type { Product } from '@/lib/api';

export const euro = (cents: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(cents / 100);
export const units: Record<Product['unit'], string> = { kg: 'kg', unidade: 'unidade', cento: 'cento', duzia: 'dúzia', meia_duzia: 'meia dúzia' };
export const pickupTimeLabel = (value: string) => new Intl.DateTimeFormat('pt-PT', { timeZone: 'Europe/Lisbon', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
export const leadLabel = (hours: number) => hours % 24 === 0 ? `${hours / 24} ${hours === 24 ? 'dia' : 'dias'}` : `${hours} horas`;

export type Line = { key: string; product_id: string; quantity: string; weight_kg: string; cake_message: string; declared_allergies: string; production_notes: string };

export const newLine = (product: Product): Line => ({ key: crypto.randomUUID(), product_id: product.id, quantity: '1', weight_kg: product.is_custom_cake ? '2' : '', cake_message: '', declared_allergies: '', production_notes: '' });

export function lineTotal(line: Line, product: Product) {
  const amount = Number(product.is_custom_cake ? line.weight_kg : line.quantity);
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * product.unit_price_cents) : 0;
}

export function categoryOf(product: Product) {
  const name = product.category.toLowerCase();
  return name.includes('salgad') ? 'Salgados' : name.includes('doce') ? 'Doces' : 'Bolos';
}
