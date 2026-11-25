-- Migration 002: remember when each task was finished (completed_at, ms since epoch).
-- SAFE to run on a live database: it only adds a column and keeps all your data.
-- Run in Supabase: SQL Editor -> New query -> paste -> Run.
alter table public.tasks add column if not exists completed_at bigint;
