import { db } from '@/lib/db';
import { ApiError, jsonError } from '@/lib/http';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams;
    for (const key of query.keys()) if (!['category', 'is_custom_cake', 'limit', 'cursor'].includes(key)) throw new ApiError(400, 'VALIDATION_ERROR', `Filtro não suportado: ${key}.`);
    const limit = Math.min(100, Math.max(1, Number(query.get('limit') ?? 50)));
    if (!Number.isInteger(limit)) throw new ApiError(400, 'VALIDATION_ERROR', 'limit deve ser inteiro.');
    const category = query.get('category');
    const custom = query.get('is_custom_cake');
    if (custom !== null && !['true', 'false'].includes(custom)) throw new ApiError(400, 'VALIDATION_ERROR', 'is_custom_cake deve ser true ou false.');
    const after = query.get('cursor') ? Buffer.from(query.get('cursor')!, 'base64url').toString() : null;
    if (after && !/^[0-9a-f-]{36}$/i.test(after)) throw new ApiError(400, 'VALIDATION_ERROR', 'cursor inválido.');
    const rows = await db`
      select id, name, category, unit, unit_price_cents, allergens, min_lead_hours, is_custom_cake
      from public.products
      where active = true
        and (${category}::text is null or category = ${category})
        and (${custom}::text is null or is_custom_cake = ${custom}::text::boolean)
        and (${after}::uuid is null or id > ${after}::uuid)
      order by id limit ${limit + 1}`;
    const more = rows.length > limit;
    const data = rows.slice(0, limit);
    return NextResponse.json({ data, next_cursor: more ? Buffer.from(String(data.at(-1)!.id)).toString('base64url') : null }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return jsonError(error); }
}
