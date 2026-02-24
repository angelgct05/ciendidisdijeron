-- 02_export_old_project.sql
-- Ejecutar en el proyecto VIEJO de Supabase.
-- Copia el JSON resultante (columna migration_payload) para usarlo en 03_import_new_project.sql

select jsonb_pretty(
  jsonb_build_object(
    'game_rooms',
      coalesce(
        (
          select jsonb_agg(row_to_json(t))
          from (
            select room_code, state, updated_at
            from public.game_rooms
            order by room_code
          ) t
        ),
        '[]'::jsonb
      ),
    'game_question_types',
      coalesce(
        (
          select jsonb_agg(row_to_json(t))
          from (
            select room_code, id, name, description, updated_at
            from public.game_question_types
            order by room_code, id
          ) t
        ),
        '[]'::jsonb
      ),
    'game_questions',
      coalesce(
        (
          select jsonb_agg(row_to_json(t))
          from (
            select room_code, position, question, type_id, display_order, answers, updated_at
            from public.game_questions
            order by room_code, position
          ) t
        ),
        '[]'::jsonb
      )
  )
) as migration_payload;
