-- 05_remove_buzzer_rpc.sql
-- Ejecutar en proyectos EXISTENTES que aún tengan el RPC legado de buzzer

begin;

drop function if exists public.try_lock_buzzer(text, text);

commit;
