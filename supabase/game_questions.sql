-- Tabla dedicada para preguntas y respuestas por sala
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

alter table public.game_questions
  add column if not exists type_id text;

alter table public.game_questions
  add column if not exists display_order integer not null default 1;

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

create table if not exists public.game_question_types (
  id text not null,
  room_code text not null,
  name text not null,
  description text,
  updated_at timestamptz not null default now(),
  constraint game_question_types_room_id_unique primary key (room_code, id)
);

alter table public.game_question_types
  add column if not exists room_code text;

alter table public.game_question_types
  add column if not exists id text;

alter table public.game_question_types
  add column if not exists name text;

alter table public.game_question_types
  add column if not exists description text;

alter table public.game_question_types
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'game_question_types'
      and constraint_name = 'game_question_types_pkey'
  ) then
    alter table public.game_question_types drop constraint game_question_types_pkey;
  end if;
exception
  when undefined_table then null;
end $$;

do $$
begin
  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'game_question_types'
      and constraint_name = 'game_question_types_room_id_unique'
  ) then
    alter table public.game_question_types
      add constraint game_question_types_room_id_unique primary key (room_code, id);
  end if;
exception
  when duplicate_table then null;
end $$;

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

-- Backfill recomendado para datos existentes
insert into public.game_question_types (room_code, id, name, description)
select distinct q.room_code, 'general', 'General', 'Categoría principal'
from public.game_questions q
where q.room_code is not null
on conflict (room_code, id) do nothing;

update public.game_questions
set type_id = 'general'
where type_id is null or btrim(type_id) = '';

update public.game_questions
set display_order = greatest(1, coalesce(display_order, position + 1))
where display_order is null or display_order <= 0;
