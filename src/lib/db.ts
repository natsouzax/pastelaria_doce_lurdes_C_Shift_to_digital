import 'server-only';
import postgres from 'postgres';

const url = process.env.DATABASE_URL;

// Create a pool per warm server instance; no user/request state is stored here.
export const db = postgres(url ?? 'postgres://missing:missing@127.0.0.1:5432/missing', {
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10,
  prepare: false,
});
