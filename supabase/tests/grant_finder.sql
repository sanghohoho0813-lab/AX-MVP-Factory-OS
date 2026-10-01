-- supabase/tests/grant_finder.sql  (D-141)
-- 지원사업 찾기(가망고객 공개 화면) 계약 시험.
--   1) 가망고객(anon)은 공개 공고 사본 표를 직접 못 읽는다 — 함수로만
--   2) 함수는 '찾기 화면에 보이기' 한 것 · 아직 안 끝난 것만, 정해진 칸만 내보낸다
--   3) 알림 신청 → 고객 이벤트(상담 신청 · 출처 grant_finder), 정해진 칸만 · 동의/연락처/번호 검사 · 10분 30건 제한
-- 전부 한 트랜잭션 안에서 하고 되돌린다(rollback).  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/grant_finder.sql

begin;

do $$
declare
  ws uuid;
  other uuid;
  arr jsonb;
  n int;
  p jsonb;
  ok boolean;
  today date := (now() at time zone 'Asia/Seoul')::date;
begin
  -- 받을 작업실이 없으면 시험용으로 하나 둔다(signup_event 시험과 같은 방법)
  insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-0000000000a1', 'grant-test-owner@mirae.test', '{"signup_app":"internal_os"}');
  ws := public.default_intake_workspace();
  if ws is null then
    insert into public.workspaces (name, slug, owner_id) values ('시험 작업실', 'grant-test-ws', '00000000-0000-0000-0000-0000000000a1') returning id into ws;
  end if;
  insert into public.workspaces (name, slug, owner_id) values ('다른 작업실', 'grant-test-other', '00000000-0000-0000-0000-0000000000a1') returning id into other;

  insert into public.portal_grant_notices (id, workspace_id, payload, is_published) values
    ('gf-test-open', ws, jsonb_build_object('title', '열린 공고', 'applyEnd', to_char(today + 5, 'YYYY-MM-DD'), 'rules', jsonb_build_object('regions', jsonb_build_array('경기')), 'secretNote', '내부 메모', 'url', 'javascript:alert(1)'), true),
    ('gf-test-always', ws, jsonb_build_object('title', '상시 공고', 'applyEnd', '', 'deadlineKind', 'always', 'url', 'https://www.bizinfo.go.kr/x'), true),
    ('gf-test-hidden', ws, jsonb_build_object('title', '내린 공고', 'applyEnd', to_char(today + 5, 'YYYY-MM-DD')), false),
    ('gf-test-closed', ws, jsonb_build_object('title', '끝난 공고', 'applyEnd', to_char(today - 3, 'YYYY-MM-DD')), true),
    ('gf-test-other', other, jsonb_build_object('title', '다른 작업실 공고', 'applyEnd', to_char(today + 5, 'YYYY-MM-DD')), true);

  -- 1) anon 은 표를 직접 못 읽는다
  set local role anon;
  begin
    perform 1 from public.portal_grant_notices limit 1;
    raise exception 'FAIL anon 이 공고 사본 표를 직접 읽음';
  exception when insufficient_privilege then null;
  end;

  -- 2) 함수로만 — 공개 · 안 끝남 · 받는 작업실 것만
  arr := public.portal_grant_notices();
  select count(*) into n from jsonb_array_elements(arr) e where e->>'id' like 'gf-test-%';
  if n <> 2 then raise exception 'FAIL 공개 공고 %건 (2건이어야) %', n, arr; end if;
  if exists (select 1 from jsonb_array_elements(arr) e where e->>'id' in ('gf-test-hidden', 'gf-test-closed', 'gf-test-other')) then
    raise exception 'FAIL 내린 · 끝난 · 다른 작업실 공고가 나감';
  end if;
  if exists (select 1 from jsonb_array_elements(arr) e where e ? 'secretNote') then raise exception 'FAIL 정해지지 않은 칸이 나감'; end if;
  if (select e->>'url' from jsonb_array_elements(arr) e where e->>'id' = 'gf-test-open') <> '' then raise exception 'FAIL http 아닌 링크가 나감'; end if;
  if (select e->'rules'->'regions'->>0 from jsonb_array_elements(arr) e where e->>'id' = 'gf-test-open') <> '경기' then raise exception 'FAIL 조건(rules)이 안 나감'; end if;

  -- 3) 알림 신청
  ok := public.portal_grant_alert_request(jsonb_build_object(
    'company_name', '시험식품', 'representative_name', '정시험', 'phone', '010-1234-5678', 'industry', '식품 제조',
    'message', '지원사업 알림 신청 — 전북 전주시', 'grant_query', 'r=전북&c=전주시', 'grant_titles', jsonb_build_array('가', '나', '다', '라', '마', '바', '사'),
    'grant_fit_count', 3, 'consent', true, 'evil', 'drop table'));
  if not ok then raise exception 'FAIL 알림 신청이 false'; end if;

  reset role;
  select count(*), max(customer_safe_payload::text)::jsonb into n, p from public.customer_events where source_type = 'grant_finder' and event_type = 'consultation_requested' and workspace_id = ws;
  if n <> 1 then raise exception 'FAIL 이벤트 %건', n; end if;
  if p ? 'evil' then raise exception 'FAIL 정해지지 않은 칸이 이벤트에 들어감'; end if;
  if p->>'company_name' <> '시험식품' or p->>'grant_query' <> 'r=전북&c=전주시' or (p->>'grant_fit_count')::int <> 3 then raise exception 'FAIL 이벤트 내용 %', p; end if;
  if jsonb_array_length(p->'grant_titles') <> 5 then raise exception 'FAIL 공고 제목 5개까지 %', p->'grant_titles'; end if;
  if not exists (select 1 from public.customer_events where source_type = 'grant_finder' and status = 'new' and priority = 'high') then raise exception 'FAIL 상태/우선순위'; end if;

  set local role anon;
  -- 동의 없음 · 연락처 없음 · 이상한 번호 · 회사 없음 → 막힘
  begin perform public.portal_grant_alert_request('{"company_name":"a","phone":"010-0000-0000"}'); raise exception 'FAIL 동의 없이 들어감'; exception when invalid_parameter_value then null; end;
  begin perform public.portal_grant_alert_request('{"company_name":"a","consent":true}'); raise exception 'FAIL 연락처 없이 들어감'; exception when invalid_parameter_value then null; end;
  begin perform public.portal_grant_alert_request('{"company_name":"a","phone":"abc","consent":true}'); raise exception 'FAIL 이상한 번호가 들어감'; exception when invalid_parameter_value then null; end;
  begin perform public.portal_grant_alert_request('{"company_name":" ","email":"a@b.c","consent":true}'); raise exception 'FAIL 회사 없이 들어감'; exception when invalid_parameter_value then null; end;
  begin perform public.portal_grant_alert_request('"text"'::jsonb); raise exception 'FAIL 객체 아닌 값이 들어감'; exception when invalid_parameter_value then null; end;

  -- 10분에 30건까지
  for i in 1..29 loop
    perform public.portal_grant_alert_request(jsonb_build_object('company_name', '반복' || i, 'email', 'r' || i || '@x.test', 'consent', true));
  end loop;
  begin
    perform public.portal_grant_alert_request('{"company_name":"넘침","email":"x@x.test","consent":true}');
    raise exception 'FAIL 31번째가 들어감';
  exception when program_limit_exceeded then null;
  end;
  reset role;

  -- 4) anon 은 이벤트 표를 못 읽는다(기존 계약 그대로)
  set local role anon;
  begin
    perform 1 from public.customer_events limit 1;
    raise exception 'FAIL anon 이 이벤트 표를 읽음';
  exception when insufficient_privilege then null;
  end;
  reset role;

  raise notice 'PASS grant_finder: 공개 함수만 · 공개/안 끝남/작업실 · 정해진 칸 · 알림 신청 · 검사 · 30건 제한';
end $$;

rollback;
