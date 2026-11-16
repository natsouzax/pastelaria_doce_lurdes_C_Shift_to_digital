import { requireStaff } from '@/lib/authz';
import { jsonError } from '@/lib/http';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const staff = await requireStaff(['manager', 'production']);
    return NextResponse.json({ role: staff.role }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return jsonError(error); }
}
