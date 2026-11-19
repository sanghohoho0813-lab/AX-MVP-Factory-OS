-- D-638 AI 답 보관(0030) 시험 — 로컬 시험 DB(axqa)에서만. test-0019 · 0024 다음에 돈다(사람 a1 · b1 · d1 이 있음).
--   대표 O(a1) · 내부 팀장 P(b1) · 고객 C(d1) — 자기 답만 넣고 읽는다 · 남의 답 0 · 고치기 · 지우기 막힘 · 모양 · 크기 막힘
\set QUIET 1
\set ON_ERROR_STOP 1
select set_config('request.jwt.claim.sub', '', false);
select qa.eq('준비: 표 1 · 정책 2', (select count(*)::text from pg_policies where schemaname = 'public' and tablename = 'ai_assist_results'), '2');
select qa.eq('준비: 앱 계정의 표 권한은 INSERT,SELECT', (select string_agg(privilege_type, ',' order by privilege_type) from information_schema.role_table_grants where table_schema = 'public' and table_name = 'ai_assist_results' and grantee = 'authenticated'), 'INSERT,SELECT');
select qa.eq('준비: 로그인 안 한 사람(anon)의 표 권한 0', (select count(*)::text from information_schema.role_table_grants where table_schema = 'public' and table_name = 'ai_assist_results' and grantee = 'anon'), '0');
select qa.eq('준비: RLS 켜짐', (select relrowsecurity::text from pg_class where oid = 'public.ai_assist_results'::regclass), 'true');

-- 로그인 안 한 사람
set role anon;
select qa.no('anon: 읽기 막힘', $q$select count(*) from public.ai_assist_results$q$);
select qa.no('anon: 넣기 막힘', $q$insert into public.ai_assist_results (user_id, request_id, assist_id, run) values ('19000000-0000-0000-0000-0000000000a1', 'anon_req_0001', 'side.chat', '{"a":1}')$q$);
reset role;

-- 고객 C: 자기 답 넣기 · 읽기
select set_config('request.jwt.claim.sub', '24000000-0000-0000-0000-0000000000d1', false);
set role authenticated;
select qa.ok('C: 자기 답 넣기(user_id 기본값 = 나)', $q$insert into public.ai_assist_results (request_id, assist_id, run) values ('cust_req_0001', 'radar.top5', '{"requestId":"cust_req_0001","structured":{"headline":"답"}}')$q$);
select qa.eq('C: 내 답 1줄 · 단추 이름 그대로', (select count(*)::text || ':' || max(assist_id) from public.ai_assist_results), '1:radar.top5');
select qa.no('C: 같은 요청 번호 두 번 넣기 막힘(첫 답 그대로)', $q$insert into public.ai_assist_results (request_id, assist_id, run) values ('cust_req_0001', 'radar.top5', '{"x":2}')$q$);
select qa.no('C: 남의 이름으로 넣기 막힘', $q$insert into public.ai_assist_results (user_id, request_id, assist_id, run) values ('19000000-0000-0000-0000-0000000000a1', 'fake_owner_01', 'side.chat', '{"a":1}')$q$);
select qa.no('C: 고치기 막힘', $q$update public.ai_assist_results set run = '{"b":1}' where request_id = 'cust_req_0001'$q$);
select qa.no('C: 지우기 막힘', $q$delete from public.ai_assist_results where request_id = 'cust_req_0001'$q$);
select qa.no('C: 요청 번호 모양 틀림 막힘', $q$insert into public.ai_assist_results (request_id, assist_id, run) values ('a b', 'side.chat', '{"a":1}')$q$);
select qa.no('C: 단추 이름 모양 틀림 막힘', $q$insert into public.ai_assist_results (request_id, assist_id, run) values ('cust_req_0002', 'Side Chat!', '{"a":1}')$q$);
select qa.no('C: 답이 글자(객체 아님) 막힘', $q$insert into public.ai_assist_results (request_id, assist_id, run) values ('cust_req_0003', 'side.chat', '"글"')$q$);
select qa.no('C: 아주 큰 답(256KB 넘음) 막힘', $q$insert into public.ai_assist_results (request_id, assist_id, run) values ('cust_req_0004', 'side.chat', jsonb_build_object('big', (select string_agg(md5(i::text), '') from generate_series(1, 12000) i)))$q$);
reset role;

-- 대표 O: 자기 답만 · 고객 답 0
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
select qa.ok('O: 자기 답 넣기', $q$insert into public.ai_assist_results (request_id, assist_id, run) values ('owner_req_001', 'side.chat', '{"structured":{"headline":"대표 답"}}')$q$);
select qa.eq('O: 내 답 1줄 · 고객 답 0', (select count(*)::text from public.ai_assist_results), '1');
select qa.eq('O: 고객 요청 번호로 찾아도 0', (select count(*)::text from public.ai_assist_results where request_id = 'cust_req_0001'), '0');
reset role;

-- 내부 팀장 P: 대표 · 고객 답 0
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000b1', false);
set role authenticated;
select qa.eq('P: 읽히는 답 0(대표 · 고객 것 안 보임)', (select count(*)::text from public.ai_assist_results), '0');
select qa.ok('P: 같은 요청 번호라도 사람이 다르면 따로 넣힘', $q$insert into public.ai_assist_results (request_id, assist_id, run) values ('owner_req_001', 'side.chat', '{"structured":{"headline":"팀장 답"}}')$q$);
select qa.eq('P: 내 것만 1줄 · 내 글', (select count(*)::text || ':' || max(run->'structured'->>'headline') from public.ai_assist_results), '1:팀장 답');
reset role;
select set_config('request.jwt.claim.sub', '', false);
