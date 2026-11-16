-- =====================================================================
-- 운영 DB 점검 — 0026 · 0027 · 0028 이 들어가 있는지, 넣기 전에 있어야 할 것(0019 · 0020 · 0022 · 0024 · 0025)이 있는지
-- **읽기만** 해서 알려 준다. (마이그레이션 아님 — 넣기 전에도 · 넣은 뒤에도 몇 번이든 실행해도 된다)
--
-- 사용: Supabase SQL Editor 에 이 파일을 **통째로** 붙여 넣고 실행.
-- 읽기 전용 보장(두 겹):
--   1) 맨 위 `set transaction read only` — 편집기는 붙여 넣은 글을 한 덩어리(한 거래)로 보낸다. 그 거래 안에서는 쓰기 문장이 오류로 막힌다.
--   2) 아래는 SELECT 한 문장뿐 — 표 · 함수 · 칸을 만들거나 고치는 문장이 없다. 표 이름은 '있는지' 만 본다(없는 표를 읽지 않는다 — 넣기 전에도 오류 없음).
-- 결과: **표 하나**(묶음 | 번호 | 무엇 | 본 것 | 결과). 이름 · 이메일 같은 개인 정보는 읽지 않는다.
--   - '0 확인'   읽기 전용 거래 = on 이면 1) 이 걸린 것
--   - '1 먼저'   0026~0028 을 넣기 전에 있어야 하는 것 — 다섯 줄 모두 '들어감' 이어야 시작
--   - '2 이번'   0026 · 0027 · 0028 — '없음'(아직) · '들어감'(끝) · '일부만'(중간에 멈춤 — 그 파일을 다시 통째로 실행하면 된다)
-- 넣는 순서 · 넣으면 달라지는 것 · 되돌리기: docs/OPS_0023_0024_RUNBOOK.md §10 ~ §12.
-- (되돌리기 파일을 실행한 뒤에도 표 · 함수는 남아 '들어감' 으로 보인다 — 켜짐/꺼짐은 verify_after_002x.sql 이 말해 준다.)
-- =====================================================================
set transaction read only;

with fn(name) as (
  select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
), trg(name) as (
  select g.tgname from pg_trigger g where not g.tgisinternal
), col(tbl, name) as (
  select table_name, column_name from information_schema.columns where table_schema = 'public'
), pol(name, n) as (
  select policyname, count(*) from pg_policies where schemaname in ('public', 'storage') group by policyname
), need(no, migration, what, ok) as (
  values
  (19, '0019 계정 등급(full · pilot)', 'os_access 표 · 내 등급 함수',
     to_regclass('public.os_access') is not null and exists (select 1 from fn where name = 'my_os_access')),
  (20, '0020 대표 → 팀장 화면', '팀장 화면 목록 함수',
     exists (select 1 from fn where name = 'my_pilot_views')),
  (22, '0022 AI 사용량 장부', 'AI 권한 표 · 내 AI 권한 함수',
     to_regclass('public.ai_entitlements') is not null and exists (select 1 from fn where name = 'my_ai_access')),
  (24, '0024 고객 ↔ 내부 팀장 분리', 'os_access.audience 칸 · 고객 작업공간 대표 금지 장치',
     exists (select 1 from col where tbl = 'os_access' and name = 'audience') and exists (select 1 from trg where name = 'zz_os_access_customer_member')),
  (25, '0025 문의 · 화면 오류', 'support_messages 표 · 받은함 함수',
     to_regclass('public.support_messages') is not null and exists (select 1 from fn where name = 'support_inbox'))
), part(no, migration, what, have, want) as (
  values
  (26, '0026 대표가 팀장 고객 자료를 볼 때 — 팀장 허락 동안만', '기록 표 2 · 함수(view_consent_*) 8 · 고객 자료 문(zz View consent gate) 1 · 서류 파일 문 1',
     (case when to_regclass('public.workspace_view_grants') is not null then 1 else 0 end)
     + (case when to_regclass('public.workspace_view_requests') is not null then 1 else 0 end)
     + (select count(*)::int from fn where name like 'view\_consent\_%')
     + (case when exists (select 1 from pol where name = 'zz View consent gate') then 1 else 0 end)
     + (case when exists (select 1 from pol where name = 'zz View consent gate client documents') then 1 else 0 end),
     12),
  (27, '0027 고객마다 상담 신청 링크', '링크 표 1 · 함수 7(intake_link_* 5 · public_intake_form · public_intake_submit)',
     (case when to_regclass('public.public_intake_links') is not null then 1 else 0 end)
     + (select count(*)::int from fn where name in ('intake_link_state', 'intake_link_save', 'intake_link_rotate', 'intake_link_off', 'intake_link_owner_check', 'public_intake_form', 'public_intake_submit')),
     8),
  (28, '0028 가입하면 바로 쓰기(꺼 둔 채로 들어간다)', '설정 표 1 · 기록 표 1 · 함수 8(signup_open · self_signup_*)',
     (case when to_regclass('public.self_signup_policy') is not null then 1 else 0 end)
     + (case when to_regclass('public.self_signup_accounts') is not null then 1 else 0 end)
     + (select count(*)::int from fn where name in ('signup_open', 'self_signup_state', 'self_signup_start', 'self_signup_admin', 'self_signup_admin_save', 'self_signup_admin_list', 'self_signup_seats_left', 'self_signup_check')),
     10)
), rows_out(sec, no, item, what, result) as (
  select '0 확인', 0, '읽기 전용 거래', '맨 위 set transaction read only 가 걸렸나(on 이어야 함)', current_setting('transaction_read_only')
  union all
  select '1 먼저', no, migration, what, case when ok then '들어감' else '없음' end from need
  union all
  select '2 이번', no, migration, what || ' — 찾은 것 ' || have || '/' || want,
         case when have = 0 then '없음' when have >= want then '들어감' else '일부만' end
    from part
)
select sec as "묶음", no as "번호", item as "무엇", what as "본 것", result as "결과" from rows_out order by sec, no;
