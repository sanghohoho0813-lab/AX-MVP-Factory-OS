-- D-635 가입 신청 → 대표가 앱에서 승인 · 거절(0029) 시험 — 로컬 시험 DB(axqa)에서만. test-0019 · 0024 · 0025 · 0028 다음에 돈다.
--   대표 O(19…a1 · full · 상담신청 받는 작업공간 주인 = 운영자) · 내부 팀장 P(19…b1) · 외부 고객 C(24…d1)
--   새 가입자(모두 내부 OS 가입 화면으로 가입 — signup_app = internal_os):
--     Y1 이메일 확인 · 이름 · 소속 · 소개   Y2 확인 전   Y3 팀장 작업공간 구성원(초대 받아 들어옴)   Y4 기다리는 초대가 있음
--     Y5 홈페이지(고객 플랫폼)에서만 가입(내부 표시 없음)   Y6 거절했다가 승인   Y7 이름 · 소속 없음
--   다른 시험이 남긴 계정이 목록에 섞일 수 있어 29000000- 로 시작하는 사람만 본다(숫자는 앞뒤 차이로)
\set QUIET 1
\set ON_ERROR_STOP 1
grant usage on schema qa to anon;
grant execute on all functions in schema qa to anon, authenticated;
select set_config('request.headers', '', false);
select set_config('request.jwt.claim.sub', '', false);

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, created_at) values
  ('29000000-0000-0000-0000-000000000001', 'y1-29@x.kr', now(), '{"signup_app":"internal_os","display_name":" 김신청 ","company":"  신청   컨설팅 ","intro":"정책자금 상담 10년"}', now() - interval '3 hours'),
  ('29000000-0000-0000-0000-000000000002', 'y2-29@x.kr', null, '{"signup_app":"internal_os","display_name":"이확인전"}', now() - interval '2 hours'),
  ('29000000-0000-0000-0000-000000000003', 'y3-29@x.kr', now(), '{"signup_app":"internal_os","display_name":"팀원"}', now() - interval '2 hours'),
  ('29000000-0000-0000-0000-000000000004', 'Y4-29@x.kr', now(), '{"signup_app":"internal_os"}', now() - interval '2 hours'),
  ('29000000-0000-0000-0000-000000000005', 'y5-29@x.kr', now(), '{"name":"홈페이지회원","phone":"010-0000-0000"}', now() - interval '2 hours'),
  ('29000000-0000-0000-0000-000000000006', 'y6-29@x.kr', now(), '{"signup_app":"internal_os","display_name":"박거절"}', now() - interval '1 hour'),
  ('29000000-0000-0000-0000-000000000007', 'y7-29@x.kr', now(), '{"signup_app":"internal_os"}', now() - interval '30 minutes') on conflict (id) do nothing;
insert into public.profiles (id, email) select id, email from auth.users where id::text like '29000000-%' on conflict (id) do nothing;
-- Y3: 팀장 작업공간에 들어와 있는 사람 · Y4: 팀장이 보낸 초대가 아직 기다리는 중(이메일 대소문자 달라도 같은 사람)
insert into public.workspace_members (workspace_id, user_id, role) select v, '29000000-0000-0000-0000-000000000003', 'viewer' from qa.ids where k = 'P' on conflict do nothing;
insert into public.workspace_invites (workspace_id, email, role, token_hash, status, expires_at) select v, 'y4-29@x.kr', 'viewer', 'qa-0029-invite', 'pending', now() + interval '7 days' from qa.ids where k = 'P';

-- ---------- 로그인 안 한 사람 ----------
set role anon;
select qa.no('A1 내 가입 상태 함수 부를 수 없음', $q$select public.my_signup_status()$q$);
select qa.no('A2 목록 부를 수 없음', $q$select count(*) from public.signup_requests()$q$);
select qa.no('A3 숫자 부를 수 없음', $q$select public.signup_requests_count()$q$);
select qa.no('A4 승인 부를 수 없음', $q$select public.signup_approve('29000000-0000-0000-0000-000000000001')$q$);
select qa.no('A5 거절 부를 수 없음', $q$select public.signup_reject('29000000-0000-0000-0000-000000000001')$q$);
select qa.no('A6 결정 표 읽기 막힘', $q$select count(*) from public.signup_decisions$q$);
reset role;

-- ---------- 새 가입자 Y1 — 스스로는 아무것도 못 함 ----------
select set_config('request.jwt.claim.sub', '29000000-0000-0000-0000-000000000001', false);
set role authenticated;
select qa.eq('S1 내 상태 = pending(대표 승인 기다림)', public.my_signup_status()->>'status', 'pending');
select qa.eq('S2 목록 0줄 · 숫자 0', (select count(*)::text from public.signup_requests()) || ' ' || public.signup_requests_count(), '0 0');
select qa.no('S3 나를 스스로 승인 막힘', $q$select public.signup_approve(auth.uid())$q$);
select qa.no('S4 남을 거절 막힘', $q$select public.signup_reject('29000000-0000-0000-0000-000000000006')$q$);
select qa.eq('S5 결정 표 읽어도 0줄', (select count(*)::text from public.signup_decisions), '0');
select qa.no('S6 결정 표에 직접 쓰기(승인) 막힘', $q$insert into public.signup_decisions (user_id, decision) values (auth.uid(), 'approved')$q$);
select qa.no('S7 안쪽 함수(신청 조건)는 부를 수 없음', $q$select public.signup_request_check(auth.uid())$q$);
select qa.eq('S8 등급 · 작업공간 그대로 없음', coalesce(public.my_os_access(), '-') || ' ' || (select count(*)::text from public.workspaces where owner_id = auth.uid()), '- 0');
reset role;

-- ---------- 내부 팀장 P · 외부 고객 C ----------
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000b1', false);
set role authenticated;
select qa.eq('P1 팀장: 목록 0줄 · 숫자 0 · 내 상태 has_access', (select count(*)::text from public.signup_requests()) || ' ' || public.signup_requests_count() || ' ' || (public.my_signup_status()->>'status'), '0 0 has_access');
select qa.no('P2 팀장이 승인 막힘', $q$select public.signup_approve('29000000-0000-0000-0000-000000000001')$q$);
select qa.no('P3 팀장이 거절 막힘', $q$select public.signup_reject('29000000-0000-0000-0000-000000000001')$q$);
reset role;
select set_config('request.jwt.claim.sub', '24000000-0000-0000-0000-0000000000d1', false);
set role authenticated;
select qa.eq('C1 고객: 목록 0줄 · 숫자 0', (select count(*)::text from public.signup_requests()) || ' ' || public.signup_requests_count(), '0 0');
select qa.no('C2 고객이 승인 막힘', $q$select public.signup_approve('29000000-0000-0000-0000-000000000001')$q$);
reset role;

-- ---------- 그 밖의 가입자 상태 ----------
select set_config('request.jwt.claim.sub', '29000000-0000-0000-0000-000000000002', false);
set role authenticated;
select qa.eq('U1 확인 전 = unconfirmed', public.my_signup_status()->>'status', 'unconfirmed');
reset role;
select set_config('request.jwt.claim.sub', '29000000-0000-0000-0000-000000000003', false);
set role authenticated;
select qa.eq('E1 팀장 작업공간 구성원 = not_eligible', public.my_signup_status()->>'status', 'not_eligible');
reset role;
select set_config('request.jwt.claim.sub', '29000000-0000-0000-0000-000000000004', false);
set role authenticated;
select qa.eq('E2 기다리는 초대가 있음 = not_eligible', public.my_signup_status()->>'status', 'not_eligible');
reset role;
select set_config('request.jwt.claim.sub', '29000000-0000-0000-0000-000000000005', false);
set role authenticated;
select qa.eq('E3 홈페이지에서만 가입 = outside', public.my_signup_status()->>'status', 'outside');
reset role;

-- ---------- 대표 O — 목록 ----------
create temp table if not exists qa_c29 (k text primary key, n integer);
grant all on qa_c29 to authenticated;
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
insert into qa_c29 values ('before', public.signup_requests_count()) on conflict (k) do update set n = excluded.n;
select qa.eq('L1 대표 목록 = 기다리는 사람만(최근 것부터 · 확인 전 포함) — 구성원 · 초대 · 홈페이지 회원 · 대표 자신 없음',
  (select string_agg(email, ',' order by signed_up_at desc) from public.signup_requests() where user_id::text like '29000000-%'),
  'y7-29@x.kr,y6-29@x.kr,y2-29@x.kr,y1-29@x.kr');
select qa.eq('L2 Y1 줄 = 이름 · 소속 · 소개(앞뒤 빈칸 정리) · 메일 확인 · 기다림',
  (select concat_ws('/', person_name, company, intro, email_confirmed::text, status, (decided_at is null)::text, note) from public.signup_requests() where email = 'y1-29@x.kr'),
  '김신청/신청 컨설팅/정책자금 상담 10년/true/pending/true/');
select qa.eq('L3 Y2 줄 = 메일 확인 전', (select email_confirmed::text from public.signup_requests() where email = 'y2-29@x.kr'), 'false');
select qa.eq('L4 숫자 = 목록의 기다림 줄 수(확인 전 포함 · 대표 자신 없음)', public.signup_requests_count()::text, (select count(*)::text from public.signup_requests() where status = 'pending'));
select qa.eq('L5 대표 자신 · 팀장 · 고객은 목록에 없음', (select count(*)::text from public.signup_requests() where user_id in ('19000000-0000-0000-0000-0000000000a1', '19000000-0000-0000-0000-0000000000b1', '24000000-0000-0000-0000-0000000000d1')), '0');

-- ---------- 대표 — 승인 못 하는 사람들 ----------
select qa.eq('R1 확인 전 Y2 승인 = unconfirmed', public.signup_approve('29000000-0000-0000-0000-000000000002')->>'status', 'unconfirmed');
select qa.eq('R2 구성원 Y3 · 초대 Y4 = not_eligible', (public.signup_approve('29000000-0000-0000-0000-000000000003')->>'status') || ' ' || (public.signup_approve('29000000-0000-0000-0000-000000000004')->>'status'), 'not_eligible not_eligible');
select qa.eq('R3 홈페이지 회원 Y5 = outside · 없는 사람 = not_found', (public.signup_approve('29000000-0000-0000-0000-000000000005')->>'status') || ' ' || (public.signup_approve('29000000-0000-0000-0000-0000000000ff')->>'status') || ' ' || (public.signup_approve(null)->>'status'), 'outside not_found not_found');
select qa.eq('R4 대표 자신 · 팀장 = has_access(아무것도 안 바뀜)', (public.signup_approve('19000000-0000-0000-0000-0000000000a1')->>'status') || ' ' || (public.signup_approve('19000000-0000-0000-0000-0000000000b1')->>'status'), 'has_access has_access');
reset role;
select qa.eq('R5 못 한 승인은 아무것도 안 만듦(등급 · 작업공간 · AI · 결정)',
  (select count(*)::text from public.os_access where user_id::text like '29000000-%') || (select count(*)::text from public.workspaces where owner_id::text like '29000000-%')
  || (select count(*)::text from public.ai_entitlements where user_id::text like '29000000-%') || (select count(*)::text from public.signup_decisions), '0000');
select qa.eq('R6 팀장 tier · audience 그대로', (select tier || ' ' || audience from public.os_access where user_id = '19000000-0000-0000-0000-0000000000b1'), 'pilot internal');

-- ---------- 대표 — Y1 승인 ----------
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
select qa.eq('K1 Y1 [승인] = ok', public.signup_approve('29000000-0000-0000-0000-000000000001')->>'status', 'ok');
select qa.eq('K2 두 번 눌러도 has_access(한 번만)', public.signup_approve('29000000-0000-0000-0000-000000000001', '또')->>'status', 'has_access');
select qa.eq('K3 목록에서 빠짐 · 숫자 하나 줄어듦', (select count(*)::text from public.signup_requests() where email = 'y1-29@x.kr') || ' ' || (public.signup_requests_count() - (select n from qa_c29 where k = 'before'))::text, '0 -1');
select qa.eq('K4 대표는 그 작업공간 · 업체가 안 보임', (select count(*)::text from public.workspaces where owner_id = '29000000-0000-0000-0000-000000000001'), '0');
select qa.eq('K5 승인된 사람은 거절 못 함(has_access)', public.signup_reject('29000000-0000-0000-0000-000000000001', '실수')->>'status', 'has_access');
reset role;
select qa.eq('K6 Y1 = 0028 [바로 시작하기] 와 같은 모양: pilot · customer', (select tier || ' ' || audience from public.os_access where user_id = '29000000-0000-0000-0000-000000000001'), 'pilot customer');
select qa.eq('K7 작업공간 하나 · 이름 = 소속(빈칸 정리) · 구성원 본인(owner) 하나 · 대표 없음',
  (select count(*)::text || ' ' || max(name) from public.workspaces where owner_id = '29000000-0000-0000-0000-000000000001') || ' '
  || (select string_agg(m.user_id::text || ':' || m.role, ',') from public.workspace_members m join public.workspaces w on w.id = m.workspace_id where w.owner_id = '29000000-0000-0000-0000-000000000001'),
  '1 신청 컨설팅 29000000-0000-0000-0000-000000000001:owner');
select qa.eq('K8 AI 권한 = customer · trial · 0028 설정 값(마케팅 포함 · 100 · 14일)', (select concat_ws(' ', kind, plan, marketing::text, monthly_units, (active_until between now() + interval '13 days 23 hours' and now() + interval '14 days 1 minute')::text) from public.ai_entitlements where user_id = '29000000-0000-0000-0000-000000000001'), 'customer trial true 100 true');
select qa.eq('K9 결정 = approved · 작업공간 이어짐 · 대표가 함 · 0028 자리 안 씀',
  (select concat_ws(' ', d.decision, (d.workspace_id = w.id)::text, (d.decided_by = '19000000-0000-0000-0000-0000000000a1')::text, (d.rejected_at is null)::text) from public.signup_decisions d join public.workspaces w on w.owner_id = d.user_id where d.user_id = '29000000-0000-0000-0000-000000000001')
  || ' ' || (select count(*)::text from public.self_signup_accounts where user_id = '29000000-0000-0000-0000-000000000001'),
  'approved true true true 0');
select qa.no('K10 대표를 이 고객 작업공간 구성원으로(서버 작업) 막힘(0024)', $q$insert into public.workspace_members (workspace_id, user_id, role) select w.id, '19000000-0000-0000-0000-0000000000a1', 'editor' from public.workspaces w where w.owner_id = '29000000-0000-0000-0000-000000000001'$q$);
select set_config('request.jwt.claim.sub', '29000000-0000-0000-0000-000000000001', false);
set role authenticated;
select qa.eq('K11 Y1 로그인: 내 등급 pilot · 상태 has_access · 대표 업체 0줄 · 대표 작업공간 안 보임',
  public.my_os_access() || ' ' || (public.my_signup_status()->>'status') || ' ' || (select count(*)::text from public.operations_clients) || ' ' || (select count(*)::text from public.workspaces where id = (select v from qa.ids where k = 'O')),
  'pilot has_access 0 0');
select qa.no('K12 작업공간 하나 더 만들기 막힘(고객은 하나)', $q$select public.create_workspace('두 번째')$q$);
select qa.no('K13 내 등급을 full 로 바꾸기 막힘', $q$update public.os_access set tier = 'full' where user_id = auth.uid()$q$);
reset role;

-- ---------- 대표 — Y6 거절 → 나중에 승인 ----------
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
insert into qa_c29 values ('before_reject', public.signup_requests_count()) on conflict (k) do update set n = excluded.n;
select qa.eq('J1 Y6 [거절](메모) = ok', public.signup_reject('29000000-0000-0000-0000-000000000006', '  아직 시범 대상 아님  ')->>'status', 'ok');
select qa.eq('J2 목록에 남되 rejected · 메모(대표만) · 맨 아래 · 숫자에서 빠짐',
  (select concat_ws('/', status, note, (decided_at is not null)::text) from public.signup_requests() where email = 'y6-29@x.kr')
  || ' ' || (select email from public.signup_requests() with ordinality where user_id::text like '29000000-%' order by ordinality desc limit 1)
  || ' ' || (public.signup_requests_count() - (select n from qa_c29 where k = 'before_reject'))::text,
  'rejected/아직 시범 대상 아님/true y6-29@x.kr -1');
reset role;
select qa.eq('J3 거절해도 아무것도 안 지움 · 안 만듦(계정 · 프로필 그대로 · 등급 0)', (select count(*)::text from auth.users where id = '29000000-0000-0000-0000-000000000006') || (select count(*)::text from public.profiles where id = '29000000-0000-0000-0000-000000000006') || (select count(*)::text from public.os_access where user_id = '29000000-0000-0000-0000-000000000006'), '110');
select set_config('request.jwt.claim.sub', '29000000-0000-0000-0000-000000000006', false);
set role authenticated;
select qa.eq('J4 Y6 로그인: 내 상태 = rejected(메모는 안 나감)', public.my_signup_status()::text, '{"status": "rejected"}');
reset role;
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
select qa.eq('J5 거절한 Y6 를 다시 거절해도 ok(메모만 새로)', public.signup_reject('29000000-0000-0000-0000-000000000006', '두 번째 메모')->>'status', 'ok');
select qa.eq('J6 거절했던 Y6 [승인] = ok', public.signup_approve('29000000-0000-0000-0000-000000000006', '  박  컨설팅  ')->>'status', 'ok');
reset role;
select qa.eq('J7 Y6: pilot · customer · 작업공간 "박 컨설팅"(대표가 적은 이름) · 결정 approved · 거절한 때는 남음',
  (select tier || ' ' || audience from public.os_access where user_id = '29000000-0000-0000-0000-000000000006') || ' / '
  || (select name from public.workspaces where owner_id = '29000000-0000-0000-0000-000000000006') || ' / '
  || (select decision || ' ' || (rejected_at is not null)::text from public.signup_decisions where user_id = '29000000-0000-0000-0000-000000000006'),
  'pilot customer / 박 컨설팅 / approved true');
select set_config('request.jwt.claim.sub', '29000000-0000-0000-0000-000000000006', false);
set role authenticated;
select qa.eq('J8 Y6 로그인: has_access', public.my_signup_status()->>'status', 'has_access');
reset role;

-- ---------- 확인 전 거절 · 이름 없는 승인 ----------
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
select qa.eq('V1 확인 전 Y2 도 거절은 됨', public.signup_reject('29000000-0000-0000-0000-000000000002')->>'status', 'ok');
begin;
select qa.eq('V2 이름 · 소속 없는 Y7 승인 → "내 작업공간"', (public.signup_approve('29000000-0000-0000-0000-000000000007')->>'status'), 'ok');
select qa.eq('V2b 승인 뒤 같은 거래 안에서도 로그인 정보는 그대로(대표)', auth.uid()::text || ' ' || public.support_is_operator()::text, '19000000-0000-0000-0000-0000000000a1 true');
commit;
select qa.eq('V3 구성원 Y3 거절 = not_eligible(기록 안 함)', public.signup_reject('29000000-0000-0000-0000-000000000003')->>'status', 'not_eligible');
reset role;
select qa.eq('V4 Y7 작업공간 이름', (select name from public.workspaces where owner_id = '29000000-0000-0000-0000-000000000007'), '내 작업공간');
select qa.eq('V5 Y3 결정 줄 없음', (select count(*)::text from public.signup_decisions where user_id = '29000000-0000-0000-0000-000000000003'), '0');
-- Y2 가 나중에 메일을 확인해도 거절은 그대로
update auth.users set email_confirmed_at = now() where id = '29000000-0000-0000-0000-000000000002';
select set_config('request.jwt.claim.sub', '29000000-0000-0000-0000-000000000002', false);
set role authenticated;
select qa.eq('V6 확인 전에 거절된 Y2 가 메일을 확인해도 rejected', public.my_signup_status()->>'status', 'rejected');
reset role;

-- ---------- 대표가 계정을 닫으면(등급 줄만 지움) 다시 목록에 안 뜸 ----------
delete from public.os_access where user_id = '29000000-0000-0000-0000-000000000007';
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-0000000000a1', false);
set role authenticated;
select qa.eq('Z1 닫은 Y7 은 목록에 다시 안 뜨고 승인으로 못 엶(작업공간이 남음)', (select count(*)::text from public.signup_requests() where email = 'y7-29@x.kr') || ' ' || (public.signup_approve('29000000-0000-0000-0000-000000000007')->>'status'), '0 not_eligible');
reset role;
select qa.eq('Z2 0028 가입하면 바로 쓰기는 그대로 꺼짐(0029 가 켜지 않음)', (select open::text from public.self_signup_policy), 'false');

-- 정리: 다음 시험(격리)이 쓰지 않도록 이 시험이 만든 줄만 지운다(시험 DB)
select set_config('request.jwt.claim.sub', '', false);
delete from public.signup_decisions where user_id::text like '29000000-%';
delete from public.workspace_members where user_id::text like '29000000-%';
delete from public.workspaces where owner_id::text like '29000000-%';
delete from public.ai_entitlements where user_id::text like '29000000-%';
delete from public.os_access where user_id::text like '29000000-%';
delete from public.workspace_invites where token_hash = 'qa-0029-invite';
drop table if exists qa_c29;
