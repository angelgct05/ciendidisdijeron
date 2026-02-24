-- 01_schema_full.sql
-- Ejecutar en el proyecto NUEVO de Supabase (SQL Editor)

begin;

-- =========================
-- Tabla principal de estado
-- =========================
create table if not exists public.game_rooms (
  room_code text primary key,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists game_rooms_updated_at_idx
  on public.game_rooms (updated_at desc);

alter table public.game_rooms enable row level security;

drop policy if exists "anon read game_rooms" on public.game_rooms;
drop policy if exists "anon insert game_rooms" on public.game_rooms;
drop policy if exists "anon update game_rooms" on public.game_rooms;
drop policy if exists "anon delete game_rooms" on public.game_rooms;

create policy "anon read game_rooms"
on public.game_rooms
for select
to anon
using (true);

create policy "anon insert game_rooms"
on public.game_rooms
for insert
to anon
with check (true);

create policy "anon update game_rooms"
on public.game_rooms
for update
to anon
using (true)
with check (true);

create policy "anon delete game_rooms"
on public.game_rooms
for delete
to anon
using (true);

-- =========================
-- Tabla de preguntas
-- =========================
create table if not exists public.game_questions (
  id bigserial primary key,
  room_code text not null,
  position integer not null,
  question text not null,
  type_id text,
  display_order integer not null default 1,
  answers jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint game_questions_room_position_unique unique (room_code, position)
);

create index if not exists game_questions_room_code_idx
  on public.game_questions (room_code);

alter table public.game_questions enable row level security;

drop policy if exists "anon read game_questions" on public.game_questions;
drop policy if exists "anon insert game_questions" on public.game_questions;
drop policy if exists "anon update game_questions" on public.game_questions;
drop policy if exists "anon delete game_questions" on public.game_questions;

create policy "anon read game_questions"
on public.game_questions
for select
to anon
using (true);

create policy "anon insert game_questions"
on public.game_questions
for insert
to anon
with check (true);

create policy "anon update game_questions"
on public.game_questions
for update
to anon
using (true)
with check (true);

create policy "anon delete game_questions"
on public.game_questions
for delete
to anon
using (true);

-- =========================
-- Tabla de tipos de pregunta
-- =========================
create table if not exists public.game_question_types (
  id text not null,
  room_code text not null,
  name text not null,
  description text,
  updated_at timestamptz not null default now(),
  constraint game_question_types_room_id_unique primary key (room_code, id)
);

create index if not exists game_question_types_room_code_idx
  on public.game_question_types (room_code);

alter table public.game_question_types enable row level security;

drop policy if exists "anon read game_question_types" on public.game_question_types;
drop policy if exists "anon insert game_question_types" on public.game_question_types;
drop policy if exists "anon update game_question_types" on public.game_question_types;
drop policy if exists "anon delete game_question_types" on public.game_question_types;

create policy "anon read game_question_types"
on public.game_question_types
for select
to anon
using (true);

create policy "anon insert game_question_types"
on public.game_question_types
for insert
to anon
with check (true);

create policy "anon update game_question_types"
on public.game_question_types
for update
to anon
using (true)
with check (true);

create policy "anon delete game_question_types"
on public.game_question_types
for delete
to anon
using (true);

-- ===================================
-- RPC para lock atómico de buzzer
-- ===================================
create or replace function public.try_lock_buzzer(p_room text, p_team text)
returns table(state jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  room_row public.game_rooms%rowtype;
  next_state jsonb;
  winner text;
  status text;
  next_version bigint;
begin
  if p_team not in ('A', 'B') then
    return;
  end if;

  select *
  into room_row
  from public.game_rooms
  where room_code = p_room
  for update;

  if not found then
    return;
  end if;

  next_state := coalesce(room_row.state, '{}'::jsonb);
  winner := nullif(next_state #>> '{round,buzzerWinner}', '');
  status := coalesce(next_state #>> '{round,status}', 'buzz-open');

  if winner is not null or status <> 'buzz-open' then
    return query select room_row.state;
    return;
  end if;

  next_version := coalesce((next_state ->> 'stateVersion')::bigint, 0) + 1;

  next_state := jsonb_set(next_state, '{round,buzzerWinner}', to_jsonb(p_team), true);
  next_state := jsonb_set(next_state, '{round,status}', to_jsonb('locked'::text), true);
  next_state := jsonb_set(next_state, '{stateVersion}', to_jsonb(next_version), true);
  next_state := jsonb_set(
    next_state,
    '{updatedAt}',
    to_jsonb((extract(epoch from clock_timestamp()) * 1000)::bigint),
    true
  );

  update public.game_rooms
  set state = next_state,
      updated_at = now()
  where room_code = p_room
  returning state into next_state;

  return query select next_state;
end;
$$;

grant execute on function public.try_lock_buzzer(text, text) to anon, authenticated;

-- ===================================
-- Realtime publication
-- ===================================
do $$
begin
  begin
    alter publication supabase_realtime add table public.game_rooms;
  exception when duplicate_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.game_questions;
  exception when duplicate_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.game_question_types;
  exception when duplicate_object then null;
  end;
end $$;

commit;
