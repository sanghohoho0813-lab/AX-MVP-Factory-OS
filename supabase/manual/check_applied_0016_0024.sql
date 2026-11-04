-- =====================================================================
-- D-534 운영 DB 점검 — 0016 ~ 0024 가 들어가 있는지 **읽기만** 해서 알려 준다. (마이그레이션 아님)
--
-- 사용: Supabase SQL Editor 에 통째로 붙여 넣고 실행. 맨 위 한 줄이 이 거래를 '읽기 전용' 으로 묶어
--       무엇을 잘못 붙여 넣어도 DB 에는 아무것도 쓰지 못한다(쓰기를 시도하면 오류로 멈춘다). 끝에 rollback.
-- 결과: 표 두 개
--   1) 마이그레이션마다 '들어감 / 없음' (그 파일만 만드는 함수 · 트리거 · 표 · 칸으로 판단)
--   2) 안전 상태 요약(주요 표 RLS 켜짐 · 계정 등급별 수 · AI 권한 종류별 수) — 이름 · 이메일 같은 개인 정보는 읽지 않는다
-- 판단 기준은 각 파일 머리글의 '하는 일' 과 같다. '없음' 이 나오면 그 파일부터 차례로 적용(대표 승인 뒤)하면 된다.
-- =====================================================================
begin transaction read only;

with fn(name) as (
  select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
), trg(name, rel) as (
  select g.tgname, c.relname from pg_trigger g join pg_class c on c.oid = g.tgrelid where not g.tgisinternal
), col(tbl, name) as (
  select table_name, column_name from information_schema.columns where table_schema = 'public'
), checks(no, migration, what, ok) as (
  values
  (16, '0016 보안 강화', '초대 받기 함수 · 고객 플랫폼 같은 작업공간 장치 · 역할 장치',
     exists (select 1 from fn where name = 'portal_same_workspace_guard') and exists (select 1 from trg where name = 'zz_workspace_member_role_guard')),
  (17, '0017 공개 링크 강화', '공개 링크 만료 함수',
     exists (select 1 from fn where name = 'public_link_expired')),
  (18, '0018 직원 고객 찾기', '고객 프로필 찾기 함수',
     exists (select 1 from fn where name = 'staff_find_customer_profile')),
  (19, '0019 계정 등급(full · pilot)', 'os_access 표 · 내 등급 함수 · 작업공간 만들기 장치',
     to_regclass('public.os_access') is not null and exists (select 1 from fn where name = 'my_os_access') and exists (select 1 from trg where name = 'zz_os_access_workspace_create')),
  (20, '0020 대표 → 팀장 화면', '팀장 화면 목록 · 대표 연결 함수 · 구성원 바꾸기 장치',
     exists (select 1 from fn where name = 'my_pilot_views') and exists (select 1 from fn where name = 'os_access_link_owner_to_pilots') and exists (select 1 from trg where name = 'zz_member_identity_guard')),
  (21, '0021 대표 AI 작업실', '기능 권한 · Company Case · 실행 기록 표',
     to_regclass('public.user_capabilities') is not null and to_regclass('public.company_cases') is not null and to_regclass('public.ai_runs') is not null),
  (22, '0022 AI 사용량 장부', 'AI 권한 · 장부 표 · 내 AI 권한 함수',
     to_regclass('public.ai_entitlements') is not null and to_regclass('public.ai_usage_ledger') is not null and exists (select 1 from fn where name = 'my_ai_access')),
  (23, '0023 작업공간 고정(D-531)', '업체 · 모듈 기록 · 업무 일기 표에 workspace_id 고정 장치',
     (select count(*) from trg where name = 'zz_workspace_id_lock' and rel in ('operations_clients', 'module_data', 'ops_journal_entries')) = 3),
  (24, '0024 고객 ↔ 내부 팀장 분리(D-533)', 'os_access.audience 칸 · 고객 작업공간 대표 금지 장치 · 팀장 화면 목록이 internal 만',
     exists (select 1 from col where tbl = 'os_access' and name = 'audience') and exists (select 1 from trg where name = 'zz_os_access_customer_member')
     and coalesce((select position('audience' in pg_get_functiondef(p.oid)) > 0 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'my_pilot_views' limit 1), false))
)
select no as "번호", migration as "마이그레이션", what as "확인한 것", case when ok then '들어감' else '없음' end as "결과"
from checks order by no;

-- 2) 안전 상태 요약 — 숫자만
select '주요 표 RLS 켜짐' as "항목",
       string_agg(c.relname || ':' || case when c.relrowsecurity then '켜짐' else '꺼짐' end, ' · ' order by c.relname) as "값"
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
  and c.relname in ('operations_clients', 'module_data', 'ops_journal_entries', 'workspace_members', 'workspaces', 'customer_events', 'portal_client_links', 'os_access', 'ai_entitlements')
union all
-- 아래 두 줄은 표가 없을 수도 있어(0019 · 0022 전) 글로 적은 질문을 표가 있을 때만 실행한다(query_to_xml — 읽기만)
select '계정 등급별 수(os_access · 등급/대상)',
       case when to_regclass('public.os_access') is null then '표 없음(0019 전)'
            else coalesce((xpath('/row/v/text()', query_to_xml(
              $q$select coalesce(string_agg(t || ' ' || n, ' · ' order by t), '0') as v from (
                   select a.tier || '/' || coalesce(to_jsonb(a) ->> 'audience', '(0024 전)') as t, count(*)::text as n
                   from public.os_access a group by 1) s$q$, false, true, '')))[1]::text, '0') end
union all
select 'AI 권한 종류별 수(ai_entitlements)',
       case when to_regclass('public.ai_entitlements') is null then '표 없음(0022 전)'
            else coalesce((xpath('/row/v/text()', query_to_xml(
              $q$select coalesce(string_agg(k || ' ' || n, ' · ' order by k), '0') as v from (
                   select e.kind as k, count(*)::text as n from public.ai_entitlements e group by e.kind) s$q$, false, true, '')))[1]::text, '0') end;

rollback;
