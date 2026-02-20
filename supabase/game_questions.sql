-- Tabla dedicada para preguntas y respuestas por sala
create table if not exists public.game_questions (
  id bigserial primary key,
  room_code text not null,
  position integer not null,
  question text not null,
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
