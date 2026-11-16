export function lisbonDateString(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (name: string) => parts.find(p => p.type === name)?.value ?? "00";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function nextDemoPickupDate(): string {
  const [year, month, day] = lisbonDateString(new Date()).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + 7));
  if (date.getUTCDay() === 1) date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export function lisbonNoonTimestamp(date: string): string {
  const utcNoon = new Date(`${date}T12:00:00Z`);
  const offset = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Lisbon", timeZoneName: "longOffset" }).formatToParts(utcNoon).find(p => p.type === "timeZoneName")?.value ?? "GMT";
  const zone = offset === "GMT" ? "+00:00" : offset.slice(3);
  return `${date}T12:00:00${zone}`;
}

export function lisbonPickupTimestamp(date: string, time: string): string {
  const approximate = new Date(`${date}T${time}:00Z`);
  const offset = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Lisbon', timeZoneName: 'longOffset' }).formatToParts(approximate).find(p => p.type === 'timeZoneName')?.value ?? 'GMT';
  const zone = offset === 'GMT' ? '+00:00' : offset.slice(3);
  return `${date}T${time}:00${zone}`;
}

export function dateLabel(date: Date): string {
  return new Intl.DateTimeFormat("pt-PT", { timeZone: "Europe/Lisbon", weekday: "long", day: "numeric", month: "long" }).format(date);
}
