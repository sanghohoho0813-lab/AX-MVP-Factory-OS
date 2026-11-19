-- =====================================================================
-- D-638 AI 답 보관 — 한 번 누른 AI 요청은 화면을 떠나도 · 휴대폰이 다른 앱으로 가도 답을 다시 받는다(두 번 세지 않게)
--   운영 미적용(대표 승인 뒤 SQL Editor 에서)
--
-- 왜: 대표(2026-11-19) "한 번 누르면 중간에 이탈 · 이동 · 멈춤 · 코인이 갑자기 … 토큰을 팔 거니까 백그라운드에서 돌아가도 전혀 문제없게".
--   지금은 휴대폰이 다른 앱으로 가 연결이 끊기면, 서버는 AI 답을 다 만들고(사용량도 세고) 화면은 답을 못 받는다.
--   다시 누르면 새 요청 = 한 번 더 센다. 서버 기억(같은 서버 15분)에만 기대고 있어 서버가 바뀌면 답이 사라진다.
--
-- 방법(추가만 — 표 1 · 정책 2 · 색인 1):
--   - ai_assist_results: 누가(user_id) · 요청 번호(request_id) · 단추(assist_id) · 답(run) · 만든 때.
--   - 서버 함수(/api/ai-assist)가 답을 만든 직후 그 사람 로그인으로 한 줄 넣는다(service_role 키 없음).
--   - 화면이 같은 요청 번호로 다시 물으면 서버가 이 줄을 먼저 본다 — 있으면 AI 를 다시 부르지 않고 그대로 돌려준다(사용량도 안 셈).
--   - 읽기 · 넣기는 자기 줄만(RLS). 고치기 · 지우기 권한 없음(답은 한 번 쓰면 그대로).
--     자기 줄에 가짜 답을 넣어도 자기 화면에만 보인다 — AI 를 공짜로 부르는 길은 없다(서버는 보관된 답을 돌려줄 뿐).
--   - 요청 번호 모양 · 답 크기(256KB)는 표가 막는다.
-- 기존 표 · 열 · 정책 · 자료는 건드리지 않는다. 여러 번 실행해도 같다. 선행 없음(auth.users 만).
-- 되돌리기(필요할 때만): revoke select, insert on public.ai_assist_results from authenticated — 서버는 보관 없이 예전처럼 돈다.
-- =====================================================================
begin;

create table if not exists public.ai_assist_results (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  request_id text not null check (request_id ~ '^[A-Za-z0-9_-]{8,80}$'),
  assist_id text not null check (assist_id ~ '^[a-z0-9_.-]{1,60}$'),
  run jsonb not null check (jsonb_typeof(run) = 'object' and pg_column_size(run) <= 262144),
  created_at timestamptz not null default now(),
  primary key (user_id, request_id)
);

alter table public.ai_assist_results enable row level security;

revoke all on public.ai_assist_results from public, anon, authenticated;
grant select, insert on public.ai_assist_results to authenticated;

drop policy if exists ai_assist_results_select_own on public.ai_assist_results;
create policy ai_assist_results_select_own on public.ai_assist_results
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists ai_assist_results_insert_own on public.ai_assist_results;
create policy ai_assist_results_insert_own on public.ai_assist_results
  for insert to authenticated
  with check (user_id = auth.uid());

create index if not exists ai_assist_results_created_idx on public.ai_assist_results (created_at);

commit;

-- 확인(바꾸지 않음): 표 1 · 정책 2 · 앱 계정 권한 INSERT,SELECT
select (select count(*) from pg_tables where schemaname = 'public' and tablename = 'ai_assist_results') as results_table,
       (select count(*) from pg_policies where schemaname = 'public' and tablename = 'ai_assist_results') as policies,
       (select string_agg(privilege_type, ',' order by privilege_type) from information_schema.role_table_grants
          where table_schema = 'public' and table_name = 'ai_assist_results' and grantee = 'authenticated') as app_grants;
