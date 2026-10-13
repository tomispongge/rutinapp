-- Rutinapp: esquema de sincronización familiar para Supabase.
-- Cómo usarlo: Supabase → SQL Editor → New query → pegar todo → Run.
-- Se puede volver a ejecutar sin romper nada (es idempotente).
--
-- Qué se guarda: la configuración de la familia (apodos, rutinas, talleres,
-- premios, libros, pruebas, ajustes) y los eventos de la app (pasos hechos,
-- minutos de pantalla y estudio, guías, canjes). Sin nombres reales, RUT,
-- fechas de nacimiento ni diagnósticos. Cada familia solo ve sus datos (RLS).

-- ---------- Tablas ----------
create table if not exists public.familias (
  id uuid primary key default gen_random_uuid(),
  creada timestamptz not null default now()
);

create table if not exists public.miembros (
  familia_id uuid not null references public.familias(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  creado timestamptz not null default now(),
  primary key (familia_id, user_id)
);

-- Configuración de la familia: un documento JSON por familia.
create table if not exists public.estado (
  familia_id uuid primary key references public.familias(id) on delete cascade,
  doc jsonb not null,
  actualizado timestamptz not null default now(),
  constraint estado_tamano check (octet_length(doc::text) < 2000000)
);

-- Eventos: uno por fila. "recibido" es la hora del servidor y sirve de cursor
-- para que cada equipo baje solo lo nuevo, sin depender de su reloj.
create table if not exists public.eventos (
  familia_id uuid not null references public.familias(id) on delete cascade,
  id text not null check (char_length(id) <= 200),
  data jsonb not null,
  recibido timestamptz not null default now(),
  primary key (familia_id, id),
  constraint eventos_tamano check (octet_length(data::text) < 10000)
);
create index if not exists eventos_recibido on public.eventos (familia_id, recibido);

-- ---------- Marcas de tiempo del servidor ----------
create or replace function public.tocar_recibido() returns trigger
language plpgsql set search_path = public as $$
begin
  new.recibido := now();
  return new;
end $$;

create or replace function public.tocar_actualizado() returns trigger
language plpgsql set search_path = public as $$
begin
  new.actualizado := now();
  return new;
end $$;

drop trigger if exists eventos_recibido on public.eventos;
create trigger eventos_recibido before insert or update on public.eventos
  for each row execute function public.tocar_recibido();

drop trigger if exists estado_actualizado on public.estado;
create trigger estado_actualizado before insert or update on public.estado
  for each row execute function public.tocar_actualizado();

-- ---------- Funciones ----------
-- Familias del usuario conectado (security definer evita recursión en las reglas).
create or replace function public.mis_familias() returns setof uuid
language sql stable security definer set search_path = public as $$
  select familia_id from public.miembros where user_id = auth.uid()
$$;

-- Devuelve la familia del usuario; si no tiene, la crea.
create or replace function public.mi_familia() returns uuid
language plpgsql security definer set search_path = public as $$
declare
  fid uuid;
begin
  if auth.uid() is null then
    raise exception 'Sin sesión';
  end if;
  select familia_id into fid from public.miembros where user_id = auth.uid() limit 1;
  if fid is null then
    insert into public.familias default values returning id into fid;
    insert into public.miembros (familia_id, user_id) values (fid, auth.uid());
  end if;
  return fid;
end $$;

revoke all on function public.mis_familias() from public, anon;
revoke all on function public.mi_familia() from public, anon;
grant execute on function public.mis_familias() to authenticated;
grant execute on function public.mi_familia() to authenticated;

-- ---------- Reglas de acceso (RLS) ----------
alter table public.familias enable row level security;
alter table public.miembros enable row level security;
alter table public.estado enable row level security;
alter table public.eventos enable row level security;

drop policy if exists "ver mis familias" on public.familias;
create policy "ver mis familias" on public.familias
  for select to authenticated using (id in (select public.mis_familias()));

drop policy if exists "ver mis membresias" on public.miembros;
create policy "ver mis membresias" on public.miembros
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "estado de mi familia" on public.estado;
create policy "estado de mi familia" on public.estado
  for all to authenticated
  using (familia_id in (select public.mis_familias()))
  with check (familia_id in (select public.mis_familias()));

drop policy if exists "eventos de mi familia" on public.eventos;
create policy "eventos de mi familia" on public.eventos
  for all to authenticated
  using (familia_id in (select public.mis_familias()))
  with check (familia_id in (select public.mis_familias()));

-- Permisos explícitos (las reglas RLS de arriba limitan qué filas ve cada uno).
revoke all on public.familias, public.miembros, public.estado, public.eventos from anon;
grant select on public.familias, public.miembros to authenticated;
grant select, insert, update, delete on public.estado, public.eventos to authenticated;
