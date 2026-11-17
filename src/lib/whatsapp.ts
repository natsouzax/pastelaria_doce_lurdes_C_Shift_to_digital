import { normalizePortuguesePhone } from './phone';

const dateFormat = new Intl.DateTimeFormat('pt-PT', { timeZone: 'Europe/Lisbon', weekday: 'long', day: 'numeric', month: 'long' });
const timeFormat = new Intl.DateTimeFormat('pt-PT', { timeZone: 'Europe/Lisbon', hour: '2-digit', minute: '2-digit' });

/** Mensagem enviada ao cliente quando todos os itens da encomenda ficam prontos. */
export function readyMessage(customerName: string | undefined, pickupAt: string): string {
  const first = customerName?.trim().split(/\s+/)[0];
  const pickup = new Date(pickupAt);
  return `Olá${first ? ` ${first}` : ''}! A sua encomenda na Doce Lurdes já está pronta. `
    + `Pode levantá-la ${dateFormat.format(pickup)}, às ${timeFormat.format(pickup)}. Obrigado!`;
}

/**
 * Link `wa.me` com a mensagem preenchida, ou null se o telefone não for português válido.
 * O WhatsApp só abre a conversa com o texto escrito: quem usa a aplicação carrega em “Enviar”.
 */
export function whatsappLink(phone: string | undefined, message: string): string | null {
  const normalized = phone ? normalizePortuguesePhone(phone) : null;
  return normalized ? `https://wa.me/${normalized.slice(1)}?text=${encodeURIComponent(message)}` : null;
}

/** Números fixos (começados por 2) normalmente não têm WhatsApp. */
export const isLandline = (phone: string | undefined) => normalizePortuguesePhone(phone ?? '')?.startsWith('+3512') ?? false;
