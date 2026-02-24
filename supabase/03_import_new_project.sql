-- 03_import_new_project.sql
-- Ejecutar en el proyecto NUEVO después de 01_schema_full.sql
-- 1) Reemplaza el contenido de __PASTE_JSON_HERE__ con el JSON de 02_export_old_project.sql
-- 2) Ejecuta todo el script

begin;

with payload as (
  select '__PASTE_JSON_HERE__'::jsonb as data
)
insert into public.game_rooms (room_code, state, updated_at)
select
  r.room_code,
  r.state,
  coalesce(r.updated_at, now())
from payload,
jsonb_to_recordset(payload.data -> 'game_rooms') as r(
  room_code text,
  state jsonb,
  updated_at timestamptz
)
on conflict (room_code) do update
set state = excluded.state,
    updated_at = excluded.updated_at;

with payload as (
  select '__PASTE_JSON_HERE__'::jsonb as data
)
insert into public.game_question_types (room_code, id, name, description, updated_at)
select
  t.room_code,
  t.id,
  t.name,
  t.description,
  coalesce(t.updated_at, now())
from payload,
jsonb_to_recordset(payload.data -> 'game_question_types') as t(
  room_code text,
  id text,
  name text,
  description text,
  updated_at timestamptz
)
on conflict (room_code, id) do update
set name = excluded.name,
    description = excluded.description,
    updated_at = excluded.updated_at;

with payload as (
  select '__PASTE_JSON_HERE__'::jsonb as data
)
insert into public.game_questions (room_code, position, question, type_id, display_order, answers, updated_at)
select
  q.room_code,
  q.position,
  q.question,
  q.type_id,
  coalesce(nullif(q.display_order, 0), q.position + 1),
  coalesce(q.answers, '[]'::jsonb),
  coalesce(q.updated_at, now())
from payload,
jsonb_to_recordset(payload.data -> 'game_questions') as q(
  room_code text,
  position integer,
  question text,
  type_id text,
  display_order integer,
  answers jsonb,
  updated_at timestamptz
)
on conflict (room_code, position) do update
set question = excluded.question,
    type_id = excluded.type_id,
    display_order = excluded.display_order,
    answers = excluded.answers,
    updated_at = excluded.updated_at;

commit;
