import { ApiError } from './http';

export type Role = 'manager' | 'production';

export function assertStaffRole(profile: { role: Role; active: boolean } | undefined, allowed: Role[]) {
  if (!profile?.active || !allowed.includes(profile.role)) throw new ApiError(403, 'FORBIDDEN', 'O perfil não tem permissão para esta ação.');
  return profile.role;
}
