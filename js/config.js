// Conexión con Supabase (sincronización entre equipos).
// La "publishable key" (o "anon key") está hecha para ir dentro de la app y
// puede ser pública: la seguridad la dan las reglas RLS de supabase/schema.sql.
// NUNCA pongas aquí la "secret key" ni la "service_role key".
// Si quedan vacías, la app funciona igual, solo en este dispositivo.
export const SUPABASE_URL = 'https://fgyzmquscirbiyfppewx.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_FRZvC9spRs_0fhnmqW3EjQ_7FdUwZSS';
