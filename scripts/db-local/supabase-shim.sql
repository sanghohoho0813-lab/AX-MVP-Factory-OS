-- 로컬 PostgreSQL 에서 Supabase 를 흉내 내는 최소 장치(auth · storage · 역할). 운영 DB 에는 절대 실행하지 않는다.
-- Supabase 모양 흉내(로컬 시험용)
create schema if not exists extensions;
create extension if not exists pgcrypto schema extensions;
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb, created_at timestamptz default now());
-- Supabase 와 같게: 예전 방식(request.jwt.claim.sub)과 PostgREST 방식(request.jwt.claims JSON) 둘 다 읽는다 — e2e(PostgREST) 와 SQL 시험이 같은 함수를 쓴다
create or replace function auth.uid() returns uuid language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid $$;
create or replace function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', 'anon') $$;
create or replace function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, jsonb_build_object('sub', current_setting('request.jwt.claim.sub', true), 'email', current_setting('request.jwt.claim.email', true))) $$;
create or replace function auth.email() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.email', true), ''), nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email') $$;
create schema if not exists storage;
create table if not exists storage.buckets (id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
create table if not exists storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid, created_at timestamptz default now());
alter table storage.objects enable row level security;
create or replace function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'),1)-1] $$;
grant usage on schema auth, storage, extensions, public to anon, authenticated, service_role;
grant select on auth.users to authenticated;
grant all on storage.objects to authenticated;
-- Supabase 기본값과 같게: public 의 새 표 · 순번 · 함수는 anon · authenticated 에게 권한이 열리고, 막는 것은 RLS 다(D-162 e2e · 시험이 운영과 같은 조건에서 돈다)
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
