-- SAAS-2 AI 사용량 장부(0022) 시험 — 로컬 시험 DB(axqa)에서만. test-0019 다음에 돈다(그 사람 · 작업공간을 쓴다).
--   O = 대표(full) · P = 팀장(Pilot = 고객과 같은 등급) · R = 공개 가입자
\set QUIET 1
\set ON_ERROR_STOP 1

-- ---------- 서버(SQL Editor 와 같음): 설정 전 ----------
select set_config('request.jwt.claim.sub', '', false);
reset role;
delete from public.ai_usage_ledger;
delete from public.ai_usage_limits;
delete from public.ai_usage_config;

select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000b1', false);
set role authenticated;
select qa.no('P: 설정 전에는 예약이 멈춤(ai_usage_not_configured)', $q$select public.ai_usage_reserve('qa-secret-0123456789abcdefghij', 'req-p22-000001', 'today.top3', 'cheap', 1, null)$q$);
select qa.eq('P: 설정 전 내 사용량 — configured=false', (public.my_ai_usage() ->> 'configured'), 'false');
reset role;

-- ---------- 서버: 설정(비밀값 해시 · 기본 한도 5) ----------
select set_config('request.jwt.claim.sub', '', false);
insert into public.ai_usage_config (id, secret_hash, default_monthly_units)
values (1, sha256(convert_to('qa-secret-0123456789abcdefghij', 'UTF8')), 5)
on conflict (id) do update set secret_hash = excluded.secret_hash, default_monthly_units = excluded.default_monthly_units;
select qa.eq('서버: 비밀값 원문은 DB 에 없음(해시 32바이트만)', (select octet_length(secret_hash)::text from public.ai_usage_config), '32');

-- ---------- 팀장(고객) P ----------
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000b1', false);
set role authenticated;
select qa.no('P: 설정 표 읽기 막힘(비밀값 해시도 안 보임)', $q$select 1/(select count(*) from public.ai_usage_config)::int$q$);
select qa.no('P: 장부에 직접 넣기 막힘', $q$insert into public.ai_usage_ledger (user_id, request_id, assist_id, tier, units, status) values (auth.uid(), 'req-p22-direct1', 'today.top3', 'cheap', 1, 'settled')$q$);
select qa.no('P: 내 한도 직접 올리기 막힘', $q$insert into public.ai_usage_limits (user_id, monthly_units) values (auth.uid(), 999999)$q$);
select qa.no('P: 비밀값 없이 예약 막힘(직접 불러 공짜로 쓰기 · 되돌리기 못 함)', $q$select public.ai_usage_reserve('wrong-secret-xxxxxxxxxxxxxxxx', 'req-p22-000001', 'today.top3', 'cheap', 1, null)$q$);
select qa.no('P: 비밀값 없이 되돌리기 막힘', $q$select public.ai_usage_release('wrong-secret-xxxxxxxxxxxxxxxx', 'req-p22-000001')$q$);
select qa.no('P: 비밀값 없이 정산 막힘', $q$select public.ai_usage_settle('wrong-secret-xxxxxxxxxxxxxxxx', 'req-p22-000001', 1, 1, 0)$q$);
select qa.no('P: 내부 함수(비밀값 확인 · 쓴 양) 직접 부르기 막힘', $q$select public.ai_usage_used(auth.uid())$q$);

-- 서버 함수가 하는 일(비밀값 앎 · 고객 로그인으로)
select qa.eq('P: 첫 예약 → new · 2/5', (select r->>'state' || ' ' || (r->>'used') || '/' || (r->>'limit') from (select public.ai_usage_reserve('qa-secret-0123456789abcdefghij', 'req-p22-000001', 'today.top3', 'cheap', 2, (select v from qa.ids where k = 'P')) r) x), 'new 2/5');
select qa.eq('P: 같은 요청 번호 또(두 번 눌림 · 다른 서버) → inflight · 더 세지 않음', (select r->>'state' || ' ' || (r->>'used') from (select public.ai_usage_reserve('qa-secret-0123456789abcdefghij', 'req-p22-000001', 'today.top3', 'cheap', 2, null) r) x), 'inflight 2');
select qa.eq('P: 같은 번호 · 다른 단추 → conflict', (select public.ai_usage_reserve('qa-secret-0123456789abcdefghij', 'req-p22-000001', 'money.top', 'cheap', 2, null) ->> 'state'), 'conflict');
select qa.eq('P: 정산 → 1줄', (select public.ai_usage_settle('qa-secret-0123456789abcdefghij', 'req-p22-000001', 1200, 300, 0.0004) ->> 'settled'), '1');
select qa.eq('P: 정산 두 번 → 0줄(두 번 세지 않음)', (select public.ai_usage_settle('qa-secret-0123456789abcdefghij', 'req-p22-000001', 1200, 300, 0.0004) ->> 'settled'), '0');
select qa.eq('P: 끝난 번호로 다시(공짜 재실행 막기) → done', (select public.ai_usage_reserve('qa-secret-0123456789abcdefghij', 'req-p22-000001', 'today.top3', 'cheap', 2, null) ->> 'state'), 'done');
select qa.eq('P: 끝난 요청은 되돌리기 안 됨(0줄)', (select public.ai_usage_release('qa-secret-0123456789abcdefghij', 'req-p22-000001') ->> 'released'), '0');
select qa.eq('P: 두 번째 요청(3단위) → new · 5/5', (select r->>'state' || ' ' || (r->>'used') from (select public.ai_usage_reserve('qa-secret-0123456789abcdefghij', 'req-p22-000002', 'radar.top5', 'standard', 3, null) r) x), 'new 5');
select qa.eq('P: 한도 넘는 요청 → quota · 장부에 줄 안 생김', (select public.ai_usage_reserve('qa-secret-0123456789abcdefghij', 'req-p22-000003', 'today.top3', 'cheap', 1, null) ->> 'state') || ' ' || (select count(*)::text from public.ai_usage_ledger where request_id = 'req-p22-000003'), 'quota 0');
select qa.eq('P: AI 실패 → 되돌림 1줄 · 쓴 양 2 로', (select r->>'released' || ' ' || (r->>'used') from (select public.ai_usage_release('qa-secret-0123456789abcdefghij', 'req-p22-000002') r) x), '1 2');
select qa.eq('P: 되돌린 요청을 같은 번호로 다시(재시도) → retry · 한 번만 셈(5)', (select r->>'state' || ' ' || (r->>'used') from (select public.ai_usage_reserve('qa-secret-0123456789abcdefghij', 'req-p22-000002', 'radar.top5', 'standard', 3, null) r) x), 'retry 5');
select qa.eq('P: 내 사용량 표시 5/5 · 이번 달', (select (u->>'used') || '/' || (u->>'limit') || ' ' || (u->>'configured') from (select public.my_ai_usage() u) x), '5/5 true');
select qa.eq('P: 장부는 내 줄만 보임(2줄)', (select count(*)::text from public.ai_usage_ledger), '2');
select qa.no('P: 내 장부 줄 고치기(정산 → 되돌림) 막힘', $q$update public.ai_usage_ledger set status = 'released' where request_id = 'req-p22-000001'$q$);
select qa.no('P: 내 장부 줄 지우기 막힘', $q$delete from public.ai_usage_ledger where request_id = 'req-p22-000001'$q$);
select qa.eq('P: 남의 작업공간 이름표는 붙지 않음(대표 작업공간 → 빈칸)', (select coalesce(workspace_id::text, '빈칸') from public.ai_usage_ledger where request_id = 'req-p22-000002'), '빈칸');
select qa.eq('P: 내 작업공간 이름표는 붙음', (select (workspace_id = (select v from qa.ids where k = 'P'))::text from public.ai_usage_ledger where request_id = 'req-p22-000001'), 'true');
select qa.no('P: 단위가 이상하면(0 · 101) 막힘', $q$select public.ai_usage_reserve('qa-secret-0123456789abcdefghij', 'req-p22-000009', 'today.top3', 'cheap', 0, null)$q$);
select qa.no('P: 요청 번호 모양이 이상하면 막힘', $q$select public.ai_usage_reserve('qa-secret-0123456789abcdefghij', 'x', 'today.top3', 'cheap', 1, null)$q$);
reset role;

-- ---------- 서버: 오래 남은 예약(서버가 죽음) · 지난달 · 사람마다 한도 ----------
select set_config('request.jwt.claim.sub', '', false);
update public.ai_usage_ledger set updated_at = now() - interval '11 minutes' where request_id = 'req-p22-000002';
insert into public.ai_usage_ledger (user_id, request_id, assist_id, tier, units, status, created_at, updated_at)
values ('19000000-0000-0000-0000-0000000000b1', 'req-p22-lastmon', 'today.top3', 'deep', 50, 'settled', public.ai_usage_month_start() - interval '1 day', public.ai_usage_month_start() - interval '1 day');
insert into public.ai_usage_limits (user_id, monthly_units, note) values ('19000000-0000-0000-0000-0000000000b1', 10, 'qa 프로')
on conflict (user_id) do update set monthly_units = excluded.monthly_units;

select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000b1', false);
set role authenticated;
select qa.eq('P: 10분 넘게 남은 예약은 센 데서 빠지고 · 지난달 50 은 안 셈 · 사람마다 한도 10', (select (u->>'used') || '/' || (u->>'limit') from (select public.my_ai_usage() u) x), '2/10');
select qa.eq('P: 오래 남은 예약 번호로 다시 → retry(막히지 않음)', (select public.ai_usage_reserve('qa-secret-0123456789abcdefghij', 'req-p22-000002', 'radar.top5', 'standard', 3, null) ->> 'state'), 'retry');
select qa.eq('P: 내 한도 줄은 내 것만 읽힘', (select monthly_units::text from public.ai_usage_limits), '10');
reset role;

-- ---------- 대표 O · 공개 가입자 R — 서로 안 보임 ----------
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
select qa.eq('O: 팀장 장부 줄 안 보임', (select count(*)::text from public.ai_usage_ledger), '0');
select qa.eq('O: 팀장 한도 줄 안 보임', (select count(*)::text from public.ai_usage_limits), '0');
select qa.eq('O: 내 사용량 0(대표는 서버가 장부에 쓰지 않는다)', (public.my_ai_usage() ->> 'used'), '0');
reset role;
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000c1', false);
set role authenticated;
select qa.eq('R: 남의 장부 안 보임', (select count(*)::text from public.ai_usage_ledger), '0');
select qa.no('R: 비밀값 없이 예약 막힘', $q$select public.ai_usage_reserve('guess-guess-guess-guess-guess', 'req-r22-000001', 'today.top3', 'cheap', 1, null)$q$);
reset role;
set role anon;
select qa.no('로그인 안 한 사람: 내 사용량 함수 막힘', $q$select public.my_ai_usage()$q$);
select qa.no('로그인 안 한 사람: 예약 함수 막힘', $q$select public.ai_usage_reserve('qa-secret-0123456789abcdefghij', 'req-a22-000001', 'today.top3', 'cheap', 1, null)$q$);
reset role;

-- ---------- 동시에 — 한도 1 남았을 때 두 요청이 같이 와도 하나만 ----------
select set_config('request.jwt.claim.sub', '', false);
update public.ai_usage_limits set monthly_units = 6 where user_id = '19000000-0000-0000-0000-0000000000b1';
-- 지금 쓴 양 5(정산 2 + 예약 3) → 남은 1
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000b1', false);
set role authenticated;
select qa.eq('P: 남은 1 — 첫 1단위 요청 new', (select public.ai_usage_reserve('qa-secret-0123456789abcdefghij', 'req-p22-race01', 'today.top3', 'cheap', 1, null) ->> 'state'), 'new');
select qa.eq('P: 같은 때 온 다른 1단위 요청 quota(차례로 세서 넘지 않음)', (select public.ai_usage_reserve('qa-secret-0123456789abcdefghij', 'req-p22-race02', 'today.top3', 'cheap', 1, null) ->> 'state'), 'quota');
reset role;
