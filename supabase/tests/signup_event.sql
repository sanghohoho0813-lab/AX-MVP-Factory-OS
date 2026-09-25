-- supabase/tests/signup_event.sql  (D-106)
-- 홈페이지 회원가입 → 잠재고객 상담신청 알림 계약 시험.
-- 전부 한 트랜잭션 안에서 하고 되돌린다(rollback) — 운영 데이터를 남기지 않는다.
-- 실패하면 exception 으로 멈춘다.  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/signup_event.sql

begin;

do $$
declare
  n int;
  p jsonb;
begin
  -- 받을 작업실이 없으면 알림은 조용히 건너뛴다 — 시험용 작업실을 하나 둔다
  if public.default_intake_workspace() is null then
    insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000f1', 'owner-test@mirae.test', '{"signup_app":"internal_os","display_name":"시험대표"}');
    insert into public.workspaces (name, slug, owner_id) values ('시험 작업실', 'signup-test-ws', '00000000-0000-0000-0000-0000000000f1');
  end if;

  -- 1) 고객 가입 → 알림 1건, 이름 · 이메일 · 출처
  insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000f2', 'signup-test-1@customer.test', '{"name":"시험고객","phone":"010-0000-9999","organization":"시험식품"}');
  select count(*), max(customer_safe_payload::text)::jsonb into n, p from public.customer_events where source_type = 'auth_signup' and source_id = '00000000-0000-0000-0000-0000000000f2';
  if n <> 1 then raise exception 'FAIL 고객 가입 알림 %건 (1건이어야)', n; end if;
  if p ->> 'email' <> 'signup-test-1@customer.test' or p ->> 'signup_source' <> 'miraeailab.com' then raise exception 'FAIL 알림 내용 %', p; end if;
  if not exists (select 1 from public.customer_events where source_id = '00000000-0000-0000-0000-0000000000f2' and event_type = 'customer_signed_up' and status = 'new') then
    raise exception 'FAIL 종류/상태';
  end if;

  -- 2) 내부 OS 직원 가입은 알림 없음
  insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000f3', 'signup-test-staff@mirae.test', '{"signup_app":"internal_os"}');
  if exists (select 1 from public.customer_events where source_id = '00000000-0000-0000-0000-0000000000f3') then raise exception 'FAIL 직원 가입이 알림으로 뜸'; end if;

  -- 3) 기존 종류는 그대로 받고, 없는 종류는 여전히 막는다
  begin
    insert into public.customer_events (workspace_id, event_type, source_type, source_id, dedupe_key)
      values (public.default_intake_workspace(), 'nonsense_type', 't', 'signup-test', 'signup-test:x');
    raise exception 'FAIL 없는 종류가 들어감';
  exception when check_violation then null;
  end;

  raise notice 'PASS signup_event: 고객 가입 알림 · 직원 제외 · 허용 값 검사';
end $$;

rollback;
