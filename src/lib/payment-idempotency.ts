export type PaymentInput = { kind: 'deposit' | 'balance' | 'refund'; amount_cents: number;
  external_payment_received: boolean; note?: string | null };

export function samePaymentRequest(previous: { order_id: string; kind: string; amount_cents: number;
  external_payment_received: boolean; note: string | null }, orderId: string, input: PaymentInput): boolean {
  const storedNote = previous.note ?? null;
  const requestedNote = input.note ?? (input.kind === 'refund' ? 'Resolução de capacidade indisponível' : null);
  return previous.order_id === orderId && previous.kind === input.kind && Number(previous.amount_cents) === input.amount_cents
    && previous.external_payment_received === input.external_payment_received && storedNote === requestedNote;
}
