-- 002_fix_calls_daily_room_name_unique.sql
-- Adiciona constraint UNIQUE em calls.daily_room_name
-- Corrige omissão da sessão 01.

DROP INDEX IF EXISTS idx_calls_daily_room_name;

ALTER TABLE calls
  ADD CONSTRAINT calls_daily_room_name_unique UNIQUE (daily_room_name);