-- L-7 · D-610 가입하면 바로 쓰기(0028) 시험 — 로컬 시험 DB(axqa)에서만. test-0019 · 0024 · 0025 · 0027 다음에 돈다.
--   대표 O(19…a1 · full · 상담신청 받는 작업공간 주인 = 운영자) · 내부 팀장 P(19…b1) · 외부 고객 C(24…d1)
--   새 가입자 X1 · X4 · X5(이메일 확인함) · X2(확인 전) · X3(팀장 작업공간 구성원) · X6(AI 권한 줄이 이미 있음)
\set QUIET 1
\set ON_ERROR_STOP 1
grant usage on schema qa to anon;
grant execute on all functions in schema qa to anon, authenticated;
select set_config('request.headers', '', false);
select set_config('request.jwt.claim.sub', '', false);

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) values
  ('28000000-0000-0000-0000-000000000001', 'x1-28@x.kr', now(), '{}'),
  ('28000000-0000-0000-0000-000000000002', 'x2-28@x.kr', null, '{}'),
  ('28000000-0000-0000-0000-000000000003', 'x3-28@x.kr', now(), '{}'),
  ('28000000-0000-0000-0000-000000000004', 'x4-28@x.kr', now(), '{"display_name":"  박고객  "}'),
  ('28000000-0000-0000-0000-000000000005', 'x5-28@x.kr', now(), '{}'),
  ('28000000-0000-0000-0000-000000000006', 'x6-28@x.kr', now(), '{}') on conflict (id) do nothing;
insert into public.profiles (id, email) select id, email from auth.users where id::text like '28000000-%' on conflict (id) do nothing;
-- X3: 팀장 작업공간에 들어와 있는 사람(서버 작업으로 넣음 — 초대 받은 것과 같은 모양)
insert into public.workspace_members (workspace_id, user_id, role) select v, '28000000-0000-0000-0000-000000000003', 'viewer' from qa.ids where k = 'P' on conflict do nothing;
-- X6: AI 권한 줄이 이미 있음
insert into public.ai_entitlements (user_id, kind, plan, note) values ('28000000-0000-0000-0000-000000000006', 'customer', 'growth', '시험 28') on conflict (user_id) do nothing;

select qa.eq('D1 설치 직후 = 꺼짐 · 3명 · 14일 · 100 · 마케팅 포함', (select concat_ws(' ', open::text, seat_limit, trial_days, monthly_units, marketing::text) from public.self_signup_policy), 'false 3 14 100 true');

-- ---------- 로그인 안 한 사람 ----------
set role anon;
select qa.eq('A1 가입 화면: 지금은 바로 못 씀', public.signup_open()::text, 'false');
select qa.no('A2 상태 함수 부를 수 없음', $q$select public.self_signup_state()$q$);
select qa.no('A3 시작 함수 부를 수 없음', $q$select public.self_signup_start('')$q$);
select qa.no('A4 대표 설정 함수 부를 수 없음', $q$select public.self_signup_admin()$q$);
select qa.no('A5 설정 표 읽기 막힘', $q$select count(*) from public.self_signup_policy$q$);
reset role;

-- ---------- 새 가입자 X1 — 꺼져 있을 때 ----------
select set_config('request.jwt.claim.sub', '28000000-0000-0000-0000-000000000001', false);
set role authenticated;
select qa.eq('S1 꺼져 있으면 closed', public.self_signup_state(), 'closed');
select qa.eq('S2 눌러도 closed · 등급 없음', (public.self_signup_start('X1')->>'status') || ' ' || coalesce(public.my_os_access(), '-'), 'closed -');
select qa.eq('S3 설정 표 · 기록 표 읽어도 0줄', (select count(*)::text from public.self_signup_policy) || ' ' || (select count(*)::text from public.self_signup_accounts), '0 0');
select qa.no('S4 설정 표에 직접 쓰기(켜기) 막힘', $q$update public.self_signup_policy set open = true$q$);
select qa.no('S5 기록 표에 직접 넣기 막힘', $q$insert into public.self_signup_accounts (user_id) values (auth.uid())$q$);
select qa.eq('S6 대표 설정 읽기 = none', public.self_signup_admin()->>'role', 'none');
select qa.no('S7 대표 설정 바꾸기 막힘', $q$select public.self_signup_admin_save(true, 100, 30, 1000, true)$q$);
select qa.eq('S8 대표 목록 = 0줄', (select count(*)::text from public.self_signup_admin_list()), '0');
select qa.no('S9 안쪽 함수(남은 자리 · 조건)는 부를 수 없음', $q$select public.self_signup_seats_left() + length(public.self_signup_check(auth.uid()))$q$);
reset role;

-- ---------- 내부 팀장 P ----------
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000b1', false);
set role authenticated;
select qa.eq('P1 팀장: 대표 설정 none · 내 상태 has_access', (public.self_signup_admin()->>'role') || ' ' || public.self_signup_state(), 'none has_access');
select qa.no('P2 팀장이 켜기 막힘', $q$select public.self_signup_admin_save(true, 3, 14, 100, true)$q$);
reset role;

-- ---------- 대표 O — 켜기 ----------
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
select qa.eq('O1 대표 설정 읽기 = owner · 꺼짐 · 3자리 · 0명', (select concat_ws(' ', s->>'role', s->'policy'->>'open', s->'policy'->>'seatLimit', s->>'used', s->>'seatsLeft') from (select public.self_signup_admin() s) x), 'owner false 3 0 3');
select qa.no('O2 자리 2000 막힘', $q$select public.self_signup_admin_save(true, 2000, 14, 100, true)$q$);
select qa.no('O3 시험 기간 0일 막힘', $q$select public.self_signup_admin_save(true, 3, 0, 100, true)$q$);
select qa.no('O4 빈 값 막힘', $q$select public.self_signup_admin_save(null, 3, 14, 100, true)$q$);
select qa.eq('O5 켜기(2자리 · 7일 · 50 · 마케팅 빼고) → 그대로 저장', (select concat_ws(' ', s->'policy'->>'open', s->'policy'->>'seatLimit', s->'policy'->>'trialDays', s->'policy'->>'monthlyUnits', s->'policy'->>'marketing', s->>'seatsLeft') from (select public.self_signup_admin_save(true, 2, 7, 50, false) s) x), 'true 2 7 50 false 2');
select qa.eq('O6 대표 자신은 has_access · 눌러도 그대로', public.self_signup_state() || ' ' || (public.self_signup_start('')->>'status'), 'has_access has_access');
reset role;
select qa.eq('O7 바꾼 사람 · 때 기록', (select (updated_by = '19000000-0000-0000-0000-0000000000a1' and updated_at > now() - interval '1 minute')::text from public.self_signup_policy), 'true');

set role anon;
select qa.eq('A6 켠 뒤 가입 화면: 바로 쓸 수 있음', public.signup_open()::text, 'true');
reset role;

-- ---------- 못 여는 사람들 ----------
select set_config('request.jwt.claim.sub', '28000000-0000-0000-0000-000000000002', false);
set role authenticated;
select qa.eq('U1 이메일 확인 전 = unconfirmed · 눌러도 unconfirmed', public.self_signup_state() || ' ' || (public.self_signup_start('')->>'status'), 'unconfirmed unconfirmed');
reset role;
select qa.eq('U2 확인 전 계정에 아무것도 안 생김', (select count(*)::text from public.os_access where user_id = '28000000-0000-0000-0000-000000000002') || (select count(*)::text from public.workspaces where owner_id = '28000000-0000-0000-0000-000000000002'), '00');
select set_config('request.jwt.claim.sub', '28000000-0000-0000-0000-000000000003', false);
set role authenticated;
select qa.eq('E1 팀장 작업공간 구성원 = not_eligible', public.self_signup_state() || ' ' || (public.self_signup_start('')->>'status'), 'not_eligible not_eligible');
reset role;
select set_config('request.jwt.claim.sub', '28000000-0000-0000-0000-000000000006', false);
set role authenticated;
select qa.eq('E2 AI 권한 줄이 이미 있음 = not_eligible', public.self_signup_state() || ' ' || (public.self_signup_start('')->>'status'), 'not_eligible not_eligible');
reset role;
select set_config('request.jwt.claim.sub', '24000000-0000-0000-0000-0000000000d1', false);
set role authenticated;
select qa.eq('H1 이미 고객 = has_access · 눌러도 그대로', public.self_signup_state() || ' ' || (public.self_signup_start('')->>'status'), 'has_access has_access');
reset role;

-- ---------- X1 — 바로 시작 ----------
select set_config('request.jwt.claim.sub', '28000000-0000-0000-0000-000000000001', false);
set role authenticated;
select qa.eq('K1 켜져 있으면 open', public.self_signup_state(), 'open');
select qa.eq('K2 [바로 시작하기] = ok', public.self_signup_start(e'  김  시범\n컨설팅  ')->>'status', 'ok');
select qa.eq('K3 내 등급 = pilot · 고객(customer)', public.my_os_access() || ' ' || (select audience from public.os_access), 'pilot customer');
select qa.eq('K4 내 작업공간 하나 · 이름(빈칸 정리)', (select count(*)::text || ' ' || max(name) from public.workspaces where owner_id = auth.uid()), '1 김 시범 컨설팅');
select qa.eq('K5 대표 업체 0줄 · 대표 작업공간 안 보임', (select count(*)::text from public.operations_clients) || ' ' || (select count(*)::text from public.workspaces where id = (select v from qa.ids where k = 'O')), '0 0');
select qa.eq('K6 다시 눌러도 has_access(작업공간 그대로 하나)', (public.self_signup_start('또')->>'status') || ' ' || (select count(*)::text from public.workspaces where owner_id = auth.uid()), 'has_access 1');
select qa.no('K7 작업공간 하나 더 만들기 막힘(고객은 하나)', $q$select public.create_workspace('두 번째')$q$);
select qa.no('K8 내 등급을 full 로 바꾸기 막힘', $q$update public.os_access set tier = 'full' where user_id = auth.uid()$q$);
reset role;
select qa.eq('K9 구성원 = 본인(owner) 하나 · 대표 없음', (select string_agg(m.user_id::text || ':' || m.role, ',') from public.workspace_members m join public.workspaces w on w.id = m.workspace_id where w.owner_id = '28000000-0000-0000-0000-000000000001'), '28000000-0000-0000-0000-000000000001:owner');
select qa.eq('K10 AI 권한 = customer · trial · 마케팅 빼고 · 50 · 7일', (select concat_ws(' ', kind, plan, marketing::text, monthly_units, (active_until between now() + interval '6 days 23 hours' and now() + interval '7 days 1 minute')::text) from public.ai_entitlements where user_id = '28000000-0000-0000-0000-000000000001'), 'customer trial false 50 true');
select qa.eq('K11 기록 한 줄 · 작업공간 이어짐', (select count(*)::text from public.self_signup_accounts s join public.workspaces w on w.id = s.workspace_id and w.owner_id = s.user_id where s.user_id = '28000000-0000-0000-0000-000000000001'), '1');
select qa.no('K12 대표를 이 고객 작업공간 구성원으로(서버 작업) 막힘', $q$insert into public.workspace_members (workspace_id, user_id, role) select w.id, '19000000-0000-0000-0000-0000000000a1', 'editor' from public.workspaces w where w.owner_id = '28000000-0000-0000-0000-000000000001'$q$);
select qa.eq('K13 대표의 팀장 화면 목록에 안 뜸(내부 팀장만)', (select count(*)::text from public.os_access a where a.user_id = '28000000-0000-0000-0000-000000000001' and a.audience = 'internal'), '0');

-- ---------- X4 — 이름 없이 → '<이름> 작업공간' · 자리 다 참 ----------
select set_config('request.jwt.claim.sub', '28000000-0000-0000-0000-000000000004', false);
set role authenticated;
select qa.eq('K14 이름 안 적고 시작 = ok', public.self_signup_start('')->>'status', 'ok');
select qa.eq('K14b 작업공간 이름 = "박고객 작업공간"(이름 앞뒤 빈칸 정리)', (select name from public.workspaces where owner_id = auth.uid()), '박고객 작업공간');
reset role;
select set_config('request.jwt.claim.sub', '28000000-0000-0000-0000-000000000005', false);
set role authenticated;
select qa.eq('F1 자리 2개가 다 차면 closed · 눌러도 closed', public.self_signup_state() || ' ' || (public.self_signup_start('')->>'status'), 'closed closed');
reset role;
set role anon;
select qa.eq('F2 다 차면 가입 화면도 "바로 못 씀"', public.signup_open()::text, 'false');
reset role;

-- ---------- 대표 — 목록 · 닫은 계정 ----------
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
select qa.eq('L1 대표 설정: 2명 · 남은 자리 0', (select concat_ws(' ', s->>'used', s->>'seatsLeft') from (select public.self_signup_admin() s) x), '2 0');
select qa.eq('L2 대표 목록 = 최근 것부터 이메일 · 작업공간 · 열림', (select string_agg(concat_ws('/', email, person_name, workspace_name, active::text, (ai_until is not null)::text), ' | ') from public.self_signup_admin_list()), 'x4-28@x.kr/박고객/박고객 작업공간/true/true | x1-28@x.kr//김 시범 컨설팅/true/true');
select qa.eq('L3 대표도 고객 업체 · 작업공간은 안 보임(목록만)', (select count(*)::text from public.workspaces where owner_id = '28000000-0000-0000-0000-000000000001'), '0');
reset role;
-- 대표가 SQL Editor 로 X1 을 닫음(등급 줄만 지움 — 자료는 그대로)
delete from public.os_access where user_id = '28000000-0000-0000-0000-000000000001';
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
select public.self_signup_admin_save(true, 5, 7, 50, false);
select qa.eq('L4 닫은 계정은 목록에서 열림 false', (select active::text from public.self_signup_admin_list() where email = 'x1-28@x.kr'), 'false');
reset role;
select set_config('request.jwt.claim.sub', '28000000-0000-0000-0000-000000000001', false);
set role authenticated;
select qa.eq('L5 닫힌 X1 은 자리가 있어도 다시 이 길로 못 엶', public.self_signup_state() || ' ' || (public.self_signup_start('')->>'status') || ' ' || coalesce(public.my_os_access(), '-'), 'not_eligible not_eligible -');
reset role;

-- ---------- 한 시간 10명 ----------
insert into auth.users (id, email, email_confirmed_at) select ('28000000-0000-0000-0001-' || lpad(g::text, 12, '0'))::uuid, 'burst' || g || '-28@x.kr', now() from generate_series(1, 8) g on conflict do nothing;
insert into public.self_signup_accounts (user_id) select ('28000000-0000-0000-0001-' || lpad(g::text, 12, '0'))::uuid from generate_series(1, 8) g on conflict do nothing;
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
select public.self_signup_admin_save(true, 100, 7, 50, false);
reset role;
select set_config('request.jwt.claim.sub', '28000000-0000-0000-0000-000000000005', false);
set role authenticated;
select qa.eq('B1 한 시간에 10명이 넘으면 busy(자리가 남아도)', public.self_signup_start('')->>'status', 'busy');
reset role;
select qa.eq('B2 busy 때 아무것도 안 생김', (select count(*)::text from public.os_access where user_id = '28000000-0000-0000-0000-000000000005'), '0');

-- ---------- 대표 — 끄기 ----------
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
select qa.eq('Z1 끄기 → 꺼짐', public.self_signup_admin_save(false, 100, 7, 50, false)->'policy'->>'open', 'false');
reset role;
set role anon;
select qa.eq('Z2 끈 뒤 가입 화면: 바로 못 씀', public.signup_open()::text, 'false');
reset role;
select set_config('request.jwt.claim.sub', '28000000-0000-0000-0000-000000000005', false);
set role authenticated;
select qa.eq('Z3 끈 뒤 새 가입자 closed', public.self_signup_state(), 'closed');
reset role;
select qa.eq('Z4 끄기는 이미 열린 고객(X4)을 닫지 않음', (select tier || ' ' || audience from public.os_access where user_id = '28000000-0000-0000-0000-000000000004'), 'pilot customer');

-- 정리: 다음 시험(격리)이 쓰지 않도록 이 시험이 만든 줄만 지운다(시험 DB)
select set_config('request.jwt.claim.sub', '', false);
delete from public.self_signup_accounts;
delete from public.workspaces where owner_id::text like '28000000-%';
delete from public.workspace_members where user_id::text like '28000000-%';
delete from public.ai_entitlements where user_id::text like '28000000-%';
delete from public.os_access where user_id::text like '28000000-%';
update public.self_signup_policy set open = false, seat_limit = 3, trial_days = 14, monthly_units = 100, marketing = true, updated_by = null;
