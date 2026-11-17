/** Normaliza números portugueses para +351XXXXXXXXX; null quando o formato é inválido. */
export function normalizePortuguesePhone(value: string): string | null {
  const input = value.trim();
  if (!/^[+\d\s().-]+$/.test(input)) return null;

  let digits = input.replace(/\D/g, '');
  if (digits.startsWith('351') && digits.length === 12) digits = digits.slice(3);
  if (!/^[29]\d{8}$/.test(digits)) return null;

  return `+351${digits}`;
}
