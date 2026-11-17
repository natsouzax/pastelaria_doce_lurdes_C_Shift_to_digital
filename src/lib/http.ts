import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public fields?: Record<string, string>) {
    super(message);
  }
}

export function jsonError(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: { code: error.code, message: error.message, ...(error.fields ? { fields: error.fields } : {}) } }, { status: error.status, headers: { 'Cache-Control': 'no-store' } });
  }
  const requestId = randomUUID();
  console.error('Unhandled API error', { requestId, name: error instanceof Error ? error.name : 'UnknownError' });
  return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Ocorreu um erro interno.', request_id: requestId } }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
}

export function parseJson(request: Request) {
  return request.json().catch(() => { throw new ApiError(400, 'VALIDATION_ERROR', 'Corpo JSON inválido.'); });
}

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin) throw new ApiError(403, 'FORBIDDEN', 'Origem da ação inválida.');
}

export function dbError(error: unknown): never {
  const message = error instanceof Error ? error.message : '';
  const mapping: Record<string, [number, string, string]> = {
    NOT_FOUND: [404, 'NOT_FOUND', 'Registo não encontrado.'],
    INVALID_STATE: [409, 'INVALID_STATE', 'A operação não é permitida neste estado.'],
    DUPLICATE_PAYMENT: [409, 'INVALID_STATE', 'Esta chave idempotente já foi utilizada.'],
    PAYMENT_MISMATCH: [409, 'PAYMENT_MISMATCH', 'O valor ou tipo de pagamento não corresponde ao pedido.'],
    CAPACITY_FULL: [409, 'CAPACITY_FULL', 'A data já atingiu o limite de seis encomendas ou de capacidade para bolos personalizados.'],
  };
  const match = Object.entries(mapping).find(([key]) => message.includes(key));
  if (match) throw new ApiError(...match[1]);
  throw error;
}
