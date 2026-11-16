import { ApiError } from './http';
import { createAuthClient } from './supabase/server';
import { db } from './db';
import { assertStaffRole, type Role } from './roles';

export async function requireStaff(allowed: Role[]) {
  const auth = await createAuthClient();
  const { data: { user }, error } = await auth.auth.getUser();
  if (error || !user) throw new ApiError(401, 'UNAUTHENTICATED', 'É necessário iniciar sessão.');
  const profiles = await db`select role, active from public.staff_profiles where user_id = ${user.id}::uuid limit 1`;
  const profile = profiles[0] as { role: Role; active: boolean } | undefined;
  const role = assertStaffRole(profile, allowed);
  return { userId: user.id, role };
}
