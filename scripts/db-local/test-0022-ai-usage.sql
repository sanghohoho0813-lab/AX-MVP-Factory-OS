-- SAAS-2 AI 사용량 장부 · 이용 권한(0022) 시험 — 로컬 시험 DB(axqa)에서만. test-0019 다음에 돈다(그 사람 · 작업공간 · 등급을 쓴다).
--   O = 대표(full) · P = 팀장 등급 계정(시험에서 구독 고객 ↔ 내부 팀장으로 바꿔 본다) · R = 공개 가입자
\set QUIET 1
\set ON_ERROR_STOP 1

-- ---------- 서버(SQL Editor 와 같음): 비우기 · 설정 전 ----------
select set_config('request.jwt.claim.sub', '', false);
reset role;
delete from public.ai_usage_ledger;
delete from public.ai_entitlements;
delete from public.ai_usage_config;

select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000b1', false);
set role authenticated;
select qa.eq('P: 권한 줄이 없으면 = 고객 · 요금제 없음 · 쓸 수 없음(막힌 쪽이 기본)', (select (a->>'kind') || ' ' || (a->>'plan') || ' ' || (a->>'active') from (select public.my_ai_access() a) x), 'customer none false');
select qa.eq('P: 설정 전 configured=false', (public.my_ai_access() ->> 'configured'), 'false');
select qa.no('P: 설정 전에는 예약이 멈춤(ai_usage_not_configured)', $q$select public.ai_usage_reserve('qa-secret-0123456789abcdefghij', 'req-p22-000001', 'today.top3', 'cheap', 1, null, 'general')$q$);
reset role;

-- ---------- 서버: 설정(비밀값 해시 · 기본 한도 5) ----------
select set_config('request.jwt.claim.sub', '', false);
insert into public.ai_usage_config (id, secret_hash, default_monthly_units)
values (1, sha256(convert_to('qa-secret-0123456789abcdefghij', 'UTF8')), 5)
on conflict (id) do update set secret_hash = excluded.secret_hash, default_monthly_units = excluded.default_monthly_units;
select qa.eq('서버: 비밀값 원문은 DB 에 없음(해시 32바이트만)', (select octet_length(secret_hash)::text from public.ai_usage_config), '32');
select qa.eq('서버: 새 표 3개 RLS 켜짐(FORCE 없음 — 표 주인 = 함수 주인만 씀)', (select string_agg(relname || ':' || relrowsecurity || '/' || relforcerowsecurity, ',' order by relname) from pg_class where relname in ('ai_usage_config', 'ai_entitlements', 'ai_usage_ledger') and relnamespace = 'public'::regnamespace), 'ai_entitlements:true/false,ai_usage_config:true/false,ai_usage_ledger:true/false');
select qa.eq('서버: 앱 역할(anon · authenticated)은 새 표에 쓰기 권한 자체가 없음', (select count(*)::text from information_schema.role_table_grants where table_schema = 'public' and table_name in ('ai_usage_config', 'ai_entitlements', 'ai_usage_ledger') and grantee in ('anon', 'authenticated', 'PUBLIC') and privilege_type <> 'SELECT'), '0');
select qa.eq('서버: 설정 표는 앱 역할이 읽기도 못 함', (select count(*)::text from information_schema.role_table_grants where table_schema = 'public' and table_name = 'ai_usage_config' and grantee in ('anon', 'authenticated', 'PUBLIC')), '0');
select qa.eq('서버: 안쪽 함수 4개는 앱 역할이 부를 수 없음', (select count(*)::text from information_schema.routine_privileges where routine_schema = 'public' and routine_name in ('ai_usage_check_secret', 'ai_usage_used', 'ai_usage_account', 'ai_usage_month_start') and grantee in ('anon', 'authenticated', 'PUBLIC')), '0');
select qa.eq('서버: 쓰는 함수 · 내 권한 함수는 로그인한 사람만(anon · PUBLIC 없음)', (select count(*)::text from information_schema.routine_privileges where routine_schema = 'public' and routine_name in ('ai_usage_reserve', 'ai_usage_settle', 'ai_usage_release', 'my_ai_access') and grantee in ('anon', 'PUBLIC')), '0');
select qa.eq('서버: 함수는 모두 search_path 고정(가로채기 막기)', (select count(*)::text from pg_proc where pronamespace = 'public'::regnamespace and proname in ('ai_usage_check_secret', 'ai_usage_used', 'ai_usage_account', 'ai_usage_reserve', 'ai_usage_settle', 'ai_usage_release', 'my_ai_access', 'ai_usage_month_start') and not coalesce(array_to_string(proconfig, ',') like '%search_path=public%', false)), '0');

-- ---------- P = 권한 줄 없는 계정(앞으로 가입만 한 구독 고객과 같음) ----------
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000b1', false);
set role authenticated;
select qa.no('P: 설정 표 읽기 막힘(비밀값 해시도 안 보임)', $q$select 1/(select count(*) from public.ai_usage_config)::int$q$);
select qa.no('P: 장부에 직접 넣기 막힘', $q$insert into public.ai_usage_ledger (user_id, request_id, assist_id, tier, units, status) values (auth.uid(), 'req-p22-direct1', 'today.top3', 'cheap', 1, 'settled')$q$);
select qa.no('P: 내 권한 줄 직접 넣기(스스로 구독자 · 내부 팀장 되기) 막힘', $q$insert into public.ai_entitlements (user_id, kind, plan, marketing, active_until) values (auth.uid(), 'internal', 'internal', true, now() + interval '1 year')$q$);
select qa.no('P: 비밀값 없이 예약 막힘(직접 불러 공짜로 쓰기 · 되돌리기 못 함)', $q$select public.ai_usage_reserve('wrong-secret-xxxxxxxxxxxxxxxx', 'req-p22-000001', 'today.top3', 'cheap', 1, null, 'general')$q$);
select qa.no('P: 비밀값 없이 되돌리기 막힘', $q$select public.ai_usage_release('wrong-secret-xxxxxxxxxxxxxxxx', 'req-p22-000001')$q$);
select qa.no('P: 비밀값 없이 정산 막힘', $q$select public.ai_usage_settle('wrong-secret-xxxxxxxxxxxxxxxx', 'req-p22-000001', 1, 1, 0)$q$);
select qa.no('P: 안쪽 함수(쓴 양) 직접 부르기 막힘', $q$select public.ai_usage_used(auth.uid())$q$);
select qa.no('P: 안쪽 함수(남의 권한 보기) 직접 부르기 막힘', $q$select public.ai_usage_account('19000000-0000-0000-0000-0000000000a1')$q$);
select qa.eq('P: 권한 줄 없으면 서버가 불러도 예약 = inactive · 장부 줄 안 생김', (select public.ai_usage_reserve('qa-secret-0123456789abcdefghij', 'req-p22-000001', 'today.top3', 'cheap', 1, null, 'general') ->> 'state') || ' ' || (select count(*)::text from public.ai_usage_ledger), 'inactive 0');
reset role;

-- ---------- 서버: P 를 구독 고객(basic · 마케팅 없음 · 기본 한도 · 한 달)으로 ----------
select set_config('request.jwt.claim.sub', '', false);
insert into public.ai_entitlements (user_id, kind, plan, marketing, active_until, note)
values ('19000000-0000-0000-0000-0000000000b1', 'customer', 'basic', false, now() + interval '30 days', 'qa 베이직')
on conflict (user_id) do update set kind = excluded.kind, plan = excluded.plan, marketing = excluded.marketing, monthly_units = null, active_until = excluded.active_until;

select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000b1', false);
set role authenticated;
select qa.eq('P: 내 권한 — 고객 basic · 쓸 수 있음 · 마케팅 없음 · 한도 5(기본값)', (select (a->>'kind') || ' ' || (a->>'plan') || ' ' || (a->>'active') || ' ' || (a->>'marketing') || ' ' || (a->>'limit') from (select public.my_ai_access() a) x), 'customer basic true false 5');
select qa.no('P: 내 권한 줄 고치기(마케팅 켜기 · 기한 늘리기) 막힘', $q$update public.ai_entitlements set marketing = true, active_until = now() + interval '10 years'$q$);
select qa.eq('P: (고치기 막힌 뒤에도) 마케팅 없음 그대로', (public.my_ai_access() ->> 'marketing'), 'false');
select qa.eq('P: 마케팅 단추 예약 = not_entitled(요금제에 없음) · 줄 안 생김', (select public.ai_usage_reserve('qa-secret-0123456789abcdefghij', 'req-p22-mk0001', 'radar.top5', 'cheap', 2, null, 'marketing') ->> 'state') || ' ' || (select count(*)::text from public.ai_usage_ledger), 'not_entitled 0');
select qa.eq('P: 첫 예약 → new · 2/5', (select r->>'state' || ' ' || (r->>'used') || '/' || (r->>'limit') from (select public.ai_usage_reserve('qa-secret-0123456789abcdefghij', 'req-p22-000001', 'today.top3', 'cheap', 2, (select v from qa.ids where k = 'P'), 'general') r) x), 'new 2/5');
select qa.eq('P: 같은 요청 번호 또(두 번 눌림 · 다른 서버) → inflight · 더 세지 않음', (select r->>'state' || ' ' || (r->>'used') from (select public.ai_usage_reserve('qa-secret-0123456789abcdefghij', 'req-p22-000001', 'today.top3', 'cheap', 2, null, 'general') r) x), 'inflight 2');
select qa.eq('P: 같은 번호 · 다른 단추 → conflict', (select public.ai_usage_reserve('qa-secret-0123456789abcdefghij', 'req-p22-000001', 'money.top', 'cheap', 2, null, 'general') ->> 'state'), 'conflict');
select qa.eq('P: 정산 → 1줄', (select public.ai_usage_settle('qa-secret-0123456789abcdefghij', 'req-p22-000001', 1200, 300, 0.0004) ->> 'settled'), '1');
select qa.eq('P: 정산 두 번 → 0줄(두 번 세지 않음)', (select public.ai_usage_settle('qa-secret-0123456789abcdefghij', 'req-p22-000001', 1200, 300, 0.0004) ->> 'settled'), '0');
select qa.eq('P: 끝난 번호로 다시(공짜 재실행 막기) → done', (select public.ai_usage_reserve('qa-secret-0123456789abcdefghij', 'req-p22-000001', 'today.top3', 'cheap', 2, null, 'general') ->> 'state'), 'done');
select qa.eq('P: 끝난 요청은 되돌리기 안 됨(0줄)', (select public.ai_usage_release('qa-secret-0123456789abcdefghij', 'req-p22-000001') ->> 'released'), '0');
select qa.eq('P: 두 번째 요청(3단위) → new · 5/5', (select r->>'state' || ' ' || (r->>'used') from (select public.ai_usage_reserve('qa-secret-0123456789abcdefghij', 'req-p22-000002', 'today.top3', 'standard', 3, null, 'general') r) x), 'new 5');
select qa.eq('P: 한도 넘는 요청 → quota · 장부에 줄 안 생김', (select public.ai_usage_reserve('qa-secret-0123456789abcdefghij', 'req-p22-000003', 'today.top3', 'cheap', 1, null, 'general') ->> 'state') || ' ' || (select count(*)::text from public.ai_usage_ledger where request_id = 'req-p22-000003'), 'quota 0');
select qa.eq('P: AI 실패 → 되돌림 1줄 · 쓴 양 2 로', (select r->>'released' || ' ' || (r->>'used') from (select public.ai_usage_release('qa-secret-0123456789abcdefghij', 'req-p22-000002') r) x), '1 2');
select qa.eq('P: 되돌린 요청을 같은 번호로 다시(재시도) → retry · 한 번만 셈(5)', (select r->>'state' || ' ' || (r->>'used') from (select public.ai_usage_reserve('qa-secret-0123456789abcdefghij', 'req-p22-000002', 'today.top3', 'standard', 3, null, 'general') r) x), 'retry 5');
select qa.eq('P: 내 사용량 5/5 · 설정됨', (select (u->>'used') || '/' || (u->>'limit') || ' ' || (u->>'configured') from (select public.my_ai_access() u) x), '5/5 true');
select qa.eq('P: 장부는 내 줄만 보임(2줄)', (select count(*)::text from public.ai_usage_ledger), '2');
select qa.no('P: 내 장부 줄 고치기(정산 → 되돌림) 막힘', $q$update public.ai_usage_ledger set status = 'released' where request_id = 'req-p22-000001'$q$);
select qa.no('P: 내 장부 줄 지우기 막힘', $q$delete from public.ai_usage_ledger where request_id = 'req-p22-000001'$q$);
select qa.eq('P: 남의 작업공간 이름표는 붙지 않음(빈칸)', (select coalesce(workspace_id::text, '빈칸') from public.ai_usage_ledger where request_id = 'req-p22-000002'), '빈칸');
select qa.eq('P: 내 작업공간 이름표는 붙음 · 장부에 고객 · 일반으로 기록', (select (workspace_id = (select v from qa.ids where k = 'P'))::text || ' ' || kind || ' ' || feature from public.ai_usage_ledger where request_id = 'req-p22-000001'), 'true customer general');
select qa.no('P: 단위가 이상하면(0) 막힘', $q$select public.ai_usage_reserve('qa-secret-0123456789abcdefghij', 'req-p22-000009', 'today.top3', 'cheap', 0, null, 'general')$q$);
select qa.no('P: 요청 번호 모양이 이상하면 막힘', $q$select public.ai_usage_reserve('qa-secret-0123456789abcdefghij', 'x', 'today.top3', 'cheap', 1, null, 'general')$q$);
select qa.no('P: 기능 이름이 이상하면 막힘', $q$select public.ai_usage_reserve('qa-secret-0123456789abcdefghij', 'req-p22-000009', 'today.top3', 'cheap', 1, null, 'free')$q$);
reset role;

-- ---------- 정산 실패 · 서버가 멈춘 예약 — 장부에서 빠지지 않는다 ----------
select set_config('request.jwt.claim.sub', '', false);
update public.ai_entitlements set monthly_units = 10 where user_id = '19000000-0000-0000-0000-0000000000b1';
update public.ai_usage_ledger set updated_at = now() - interval '2 minutes' where request_id = 'req-p22-000002';
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000b1', false);
set role authenticated;
select qa.eq('P: 2분 된 예약(아직 도는 중일 수 있음) → inflight', (select public.ai_usage_reserve('qa-secret-0123456789abcdefghij', 'req-p22-000002', 'today.top3', 'standard', 3, null, 'general') ->> 'state'), 'inflight');
reset role;
update public.ai_usage_ledger set updated_at = now() - interval '4 minutes' where request_id = 'req-p22-000002';
set role authenticated;
select qa.eq('P: 4분 넘게 멈춘 예약(서버 함수 최대 60초) → 같은 번호로 이어받음 retry · 다시 세지 않음(5)', (select r->>'state' || ' ' || (r->>'used') from (select public.ai_usage_reserve('qa-secret-0123456789abcdefghij', 'req-p22-000002', 'today.top3', 'standard', 3, null, 'general') r) x), 'retry 5');
select qa.eq('P: 새 요청 예약 → new 7', (select r->>'state' || ' ' || (r->>'used') from (select public.ai_usage_reserve('qa-secret-0123456789abcdefghij', 'req-p22-000004', 'today.top3', 'cheap', 2, null, 'general') r) x), 'new 7');
select qa.eq('P: AI 는 답했는데 정산 실패(예약으로 남음) — 그래도 센 양에 들어감(7)', (public.my_ai_access() ->> 'used') || ' ' || (select status from public.ai_usage_ledger where request_id = 'req-p22-000004'), '7 reserved');
reset role;
update public.ai_usage_ledger set updated_at = now() - interval '16 minutes' where request_id = 'req-p22-000004';
insert into public.ai_usage_ledger (user_id, request_id, assist_id, tier, units, status, created_at, updated_at)
values ('19000000-0000-0000-0000-0000000000b1', 'req-p22-lastmon', 'today.top3', 'deep', 50, 'settled', public.ai_usage_month_start() - interval '1 day', public.ai_usage_month_start() - interval '1 day');
set role authenticated;
select qa.eq('P: 다음 요청 → new · 지난달 50 은 안 셈(8)', (select public.ai_usage_reserve('qa-secret-0123456789abcdefghij', 'req-p22-000005', 'today.top3', 'cheap', 1, null, 'general') ->> 'used'), '8');
select qa.eq('P: 그때 15분 넘은 예약은 자동 정산으로 닫힘(센 양 그대로 8)', (select status || ':' || closed_by from public.ai_usage_ledger where request_id = 'req-p22-000004') || ' ' || (public.my_ai_access() ->> 'used'), 'settled:auto 8');
select qa.eq('P: 늦게 온 정산 → 1줄 · 다시 세지 않음(8)', (select r->>'settled' || ' ' || (r->>'used') from (select public.ai_usage_settle('qa-secret-0123456789abcdefghij', 'req-p22-000004', 900, 100, 0.0002) r) x), '1 8');
select qa.eq('P: 늦게 온 정산은 토큰 · 비용만 채움', (select closed_by || ':' || tokens_in from public.ai_usage_ledger where request_id = 'req-p22-000004'), 'server:900');
reset role;
-- 대표가 SQL 로 돌려준 줄(환불)은 서버의 늦은 정산이 다시 세지 않는다
update public.ai_usage_ledger set status = 'released', closed_by = 'admin', note = 'QA 환불', updated_at = now() where request_id = 'req-p22-000004';
set role authenticated;
select qa.eq('P: 대표 환불(admin) 뒤 사용량 6 · 늦은 정산이 와도 0줄 · 그대로 6', (public.my_ai_access() ->> 'used') || ' ' || (select r->>'settled' || ' ' || (r->>'used') from (select public.ai_usage_settle('qa-secret-0123456789abcdefghij', 'req-p22-000004', 900, 100, 0.0002) r) x), '6 0 6');
reset role;
-- 정산 못 한 채 남은 예약 점검 · 한 번에 닫기(SQL Editor 운영 SQL 그대로) — 닫아도 센 양은 그대로
insert into public.ai_usage_ledger (user_id, request_id, assist_id, tier, units, status, created_at, updated_at)
values ('19000000-0000-0000-0000-0000000000b1', 'req-p22-stale1', 'today.top3', 'cheap', 1, 'reserved', now() - interval '20 minutes', now() - interval '20 minutes');
select qa.eq('운영 SQL: 15분 넘은 예약 찾기 → 1줄', (select count(*)::text from public.ai_usage_ledger where status = 'reserved' and updated_at < now() - interval '15 minutes'), '1');
update public.ai_usage_ledger set status = 'settled', closed_by = 'admin', note = '정산 못 한 예약 닫음', updated_at = now() where status = 'reserved' and updated_at < now() - interval '15 minutes';
select qa.eq('운영 SQL: 한 번에 닫기 → settled:admin · 센 양 7(6 + 1)', (select status || ':' || closed_by from public.ai_usage_ledger where request_id = 'req-p22-stale1') || ' ' || public.ai_usage_used('19000000-0000-0000-0000-0000000000b1')::text, 'settled:admin 7');

-- ---------- 이용 기한이 끝난 고객 → 새 요청 막힘(이미 센 줄은 그대로) ----------
update public.ai_entitlements set active_until = now() - interval '1 day' where user_id = '19000000-0000-0000-0000-0000000000b1';
set role authenticated;
select qa.eq('P: 기한 지난 고객 — 새 예약 inactive · 줄 안 생김', (select public.ai_usage_reserve('qa-secret-0123456789abcdefghij', 'req-p22-000006', 'today.top3', 'cheap', 1, null, 'general') ->> 'state') || ' ' || (select count(*)::text from public.ai_usage_ledger where request_id = 'req-p22-000006'), 'inactive 0');
select qa.eq('P: 기한 지난 고객 — 내 권한 active=false', (public.my_ai_access() ->> 'active'), 'false');
reset role;

-- ---------- 내부 팀장 — 한도 없이 기록만 · 마케팅은 따로 켠다 ----------
update public.ai_entitlements set kind = 'internal', plan = 'internal', monthly_units = null, active_until = null, marketing = false where user_id = '19000000-0000-0000-0000-0000000000b1';
set role authenticated;
select qa.eq('P(내부 팀장): 내 권한 — internal · 쓸 수 있음 · 한도 없음(null)', (select (a->>'kind') || ' ' || (a->>'active') || ' ' || coalesce(a->>'limit', 'null') from (select public.my_ai_access() a) x), 'internal true null');
select qa.eq('P(내부 팀장): 큰 요청 50 → new', (select public.ai_usage_reserve('qa-secret-0123456789abcdefghij', 'req-p22-int001', 'today.top3', 'deep', 50, null, 'general') ->> 'state'), 'new');
select qa.eq('P(내부 팀장): 또 50 → new(한도에 안 걸림)', (select public.ai_usage_reserve('qa-secret-0123456789abcdefghij', 'req-p22-int002', 'today.top3', 'deep', 50, null, 'general') ->> 'state'), 'new');
select qa.eq('P(내부 팀장): 장부에는 기록(internal 2줄)', (select count(*)::text || ' ' || string_agg(distinct kind, ',') from public.ai_usage_ledger where request_id like 'req-p22-int%'), '2 internal');
select qa.eq('P(내부 팀장): 마케팅은 켜기 전까지 not_entitled', (select public.ai_usage_reserve('qa-secret-0123456789abcdefghij', 'req-p22-intmk1', 'radar.top5', 'cheap', 2, null, 'marketing') ->> 'state'), 'not_entitled');
reset role;
update public.ai_entitlements set marketing = true where user_id = '19000000-0000-0000-0000-0000000000b1';
set role authenticated;
select qa.eq('P(내부 팀장): 대표가 마케팅을 켜면 → new', (select public.ai_usage_reserve('qa-secret-0123456789abcdefghij', 'req-p22-intmk1', 'radar.top5', 'cheap', 2, null, 'marketing') ->> 'state'), 'new');
select qa.eq('P(내부 팀장): 장부에 marketing 으로 기록', (select feature from public.ai_usage_ledger where request_id = 'req-p22-intmk1'), 'marketing');
reset role;

-- ---------- 대표 O · 공개 가입자 R — 서로 안 보임 ----------
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
select qa.eq('O: 팀장 장부 줄 안 보임', (select count(*)::text from public.ai_usage_ledger), '0');
select qa.eq('O: 팀장 권한 줄 안 보임', (select count(*)::text from public.ai_entitlements), '0');
select qa.eq('O: 내 사용량 0(대표는 서버가 장부에 쓰지 않는다)', (public.my_ai_access() ->> 'used'), '0');
reset role;
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000c1', false);
set role authenticated;
select qa.eq('R: 남의 장부 안 보임', (select count(*)::text from public.ai_usage_ledger), '0');
select qa.eq('R: 권한 줄 없음 → 고객 · 쓸 수 없음', (select (a->>'kind') || ' ' || (a->>'active') from (select public.my_ai_access() a) x), 'customer false');
select qa.no('R: 비밀값 없이 예약 막힘', $q$select public.ai_usage_reserve('guess-guess-guess-guess-guess', 'req-r22-000001', 'today.top3', 'cheap', 1, null, 'general')$q$);
reset role;
set role anon;
select qa.no('로그인 안 한 사람: 내 권한 함수 막힘', $q$select public.my_ai_access()$q$);
select qa.no('로그인 안 한 사람: 예약 함수 막힘', $q$select public.ai_usage_reserve('qa-secret-0123456789abcdefghij', 'req-a22-000001', 'today.top3', 'cheap', 1, null, 'general')$q$);
select qa.no('로그인 안 한 사람: 장부 읽기 막힘', $q$select count(*) from public.ai_usage_ledger$q$);
reset role;

-- ---------- 동시에 — 한도 1 남은 고객에게 두 요청이 같이 와도 하나만 ----------
select set_config('request.jwt.claim.sub', '', false);
delete from public.ai_usage_ledger where user_id = '19000000-0000-0000-0000-0000000000b1';
update public.ai_entitlements set kind = 'customer', plan = 'basic', monthly_units = 1, active_until = now() + interval '30 days' where user_id = '19000000-0000-0000-0000-0000000000b1';
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000b1', false);
set role authenticated;
select qa.eq('P: 남은 1 — 첫 1단위 요청 new', (select public.ai_usage_reserve('qa-secret-0123456789abcdefghij', 'req-p22-race01', 'today.top3', 'cheap', 1, null, 'general') ->> 'state'), 'new');
select qa.eq('P: 같은 때 온 다른 1단위 요청 quota(차례로 세서 넘지 않음)', (select public.ai_usage_reserve('qa-secret-0123456789abcdefghij', 'req-p22-race02', 'today.top3', 'cheap', 1, null, 'general') ->> 'state'), 'quota');
reset role;

-- ---------- 다시 실행(여러 번 실행해도 같음) · 지금 pilot 계정은 내부 팀장으로 자동 등록 ----------
select set_config('request.jwt.claim.sub', '', false);
delete from public.ai_entitlements where user_id = '19000000-0000-0000-0000-0000000000b1';
\i supabase/migrations/20261025000022_ai_usage.sql
select qa.eq('다시 실행: pilot 계정(P) → internal 자동 등록 · 대표(full) · 가입자는 줄 없음', (select string_agg(coalesce(e.kind, '없음'), ',' order by a.tier) from public.os_access a left join public.ai_entitlements e on e.user_id = a.user_id where a.user_id in ('19000000-0000-0000-0000-0000000000a1', '19000000-0000-0000-0000-0000000000b1')), '없음,internal');
select qa.eq('다시 실행: 장부 · 설정은 그대로(지우지 않음)', (select count(*)::text from public.ai_usage_ledger where request_id = 'req-p22-race01') || ' ' || (select count(*)::text from public.ai_usage_config), '1 1');
