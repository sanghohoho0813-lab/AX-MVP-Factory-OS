-- =====================================================================
-- 0023 · 0024 적용 **뒤** 확인 ① — 읽기만 한다(마이그레이션 아님)
--
-- 사용: 0023 · 0024 를 적용한 다음 Supabase SQL Editor 에 통째로 붙여 넣고 실행 → 표 하나.
-- '판정' 칸이 모두 '좋음' 이면 끝. '확인 필요' 가 있으면 그 줄을 대표에게 보이고 docs/OPS_0023_0024_RUNBOOK.md 의 '되돌리기' 를 본다.
-- 읽기 전용: 맨 위 set transaction read only + 아래는 SELECT 한 문장(set_config 는 이 거래 안에서만 '대표로 본다' 고 표시할 뿐 — 자료를 쓰지 않는다).
-- 개인 정보(이름 · 이메일 · 업체 내용)는 읽지 않는다 — 수만 센다.
-- 막히는지 직접 시도해 보는 확인 ② 는 try_0023_0024.sql(마지막에 모두 되돌림).
-- =====================================================================
set transaction read only;

with lock_tables(t) as (
  select unnest(array['operations_clients', 'module_data', 'ops_journal_entries', 'ops_custom_services',
    'consulting_projects', 'consulting_artifacts', 'consulting_decisions', 'consulting_evidence', 'consulting_prompt_packages',
    'customer_events', 'portal_client_links', 'portal_documents', 'portal_requests', 'portal_updates', 'portal_grant_notices',
    'data_import_jobs', 'data_import_items', 'ui_preferences', 'workspace_invites'])
), want as (
  select count(*) as n from lock_tables l
  where exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = l.t and c.column_name = 'workspace_id')
), got as (
  select count(*) as n from pg_trigger g join pg_class c on c.oid = g.tgrelid
  where g.tgname = 'zz_workspace_id_lock' and not g.tgisinternal and c.relname in (select t from lock_tables)
), trg(name) as (
  select g.tgname from pg_trigger g where not g.tgisinternal
), fp(name, md5) as (
  select p.proname, md5(p.prosrc) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('os_access_link_owner_to_pilots', 'my_pilot_views')
), owner_id as (
  select w.owner_id as id from public.workspaces w where w.id = public.default_intake_workspace()
), as_owner as (
  -- 이 한 문장 안에서만 '대표로 로그인했다' 고 두고 팀장 화면 목록을 부른다(대표가 머리줄에서 보는 목록과 같다)
  select s.uid, (select count(*) from public.my_pilot_views() where s.uid is not null) as n
  from (select set_config('request.jwt.claim.sub', coalesce((select id::text from owner_id), ''), true)
               || left(set_config('request.jwt.claims', coalesce(json_build_object('sub', (select id from owner_id), 'role', 'authenticated')::text, ''), true), 0) as uid offset 0) s
), internal_pilot_ws as (
  select count(*) as n from public.workspaces w
  join public.os_access p on p.user_id = w.owner_id and p.tier = 'pilot' and p.audience = 'internal'
  join public.workspace_members m on m.workspace_id = w.id and m.user_id = (select id from owner_id)
), q(name, sqltext) as (
  values ('cust_ai_internal', $q$select count(*)::text as v from public.ai_entitlements e join public.os_access a on a.user_id = e.user_id and a.audience = 'customer' where e.kind = 'internal'$q$)
), qv(name, v) as (
  select name, (xpath('/row/v/text()', query_to_xml(sqltext, false, true, '')))[1]::text from q where to_regclass('public.ai_entitlements') is not null
), rows_out(no, item, what, result, verdict) as (
  select 0, '읽기 전용 거래', '맨 위 set transaction read only', current_setting('transaction_read_only'),
         case when current_setting('transaction_read_only') = 'on' then '좋음' else '참고(한 줄씩 실행하는 도구 — 아래는 SELECT 뿐)' end
  union all
  select 1, '0023 작업공간 고정 장치', '장치가 붙은 표 / 붙어야 할 표(있고 workspace_id 칸이 있는 표)',
         (select n from got)::text || ' / ' || (select n from want)::text,
         case when (select n from got) = (select n from want) and (select n from want) > 0 then '좋음' else '확인 필요 — 0023 다시 실행' end
  union all
  select 2, '0024 대상 칸', 'os_access.audience(기본값 internal)',
         coalesce((select column_default from information_schema.columns where table_schema = 'public' and table_name = 'os_access' and column_name = 'audience'), '없음'),
         case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'os_access' and column_name = 'audience') then '좋음' else '확인 필요 — 0024 다시 실행' end
  union all
  select 3, '0024 대표 연결 함수', '내부 팀장(internal)만 연결하는 본문인가',
         coalesce((select case md5 when 'a4b15692163e9302adf96e7be8b1d021' then '0024 본문' when '5923bce05aa4d3eebf827e7fd39e3db5' then '0020 본문(아직)' else '다른 본문' end from fp where name = 'os_access_link_owner_to_pilots'), '없음'),
         case when (select md5 from fp where name = 'os_access_link_owner_to_pilots') = 'a4b15692163e9302adf96e7be8b1d021' then '좋음' else '확인 필요 — 0024 다시 실행' end
  union all
  select 4, '0024 팀장 화면 목록 함수', '내부 팀장(internal)만 보여 주는 본문인가',
         coalesce((select case md5 when '9e29a68be87ac2fa4ece076aa66b6969' then '0024 본문' when 'b9e5de279b3f39efc381ecf3c0b497b0' then '0020 본문(아직)' else '다른 본문' end from fp where name = 'my_pilot_views'), '없음'),
         case when (select md5 from fp where name = 'my_pilot_views') = '9e29a68be87ac2fa4ece076aa66b6969' then '좋음' else '확인 필요 — 0024 다시 실행' end
  union all
  select 5, '0024 고객 보호 장치', '고객 작업공간 대표 금지 · 고객 전환 검사 · (0022 있으면) 고객 AI 검사',
         (select count(*) from trg where name in ('zz_os_access_customer_member', 'zz_os_access_audience', 'zz_ai_entitlements_customer'))::text
           || ' / ' || case when to_regclass('public.ai_entitlements') is not null then '3' else '2' end,
         case when (select count(*) from trg where name in ('zz_os_access_customer_member', 'zz_os_access_audience', 'zz_ai_entitlements_customer'))
                   = case when to_regclass('public.ai_entitlements') is not null then 3 else 2 end then '좋음' else '확인 필요 — 0024 다시 실행' end
  union all
  select 6, '등급/대상별 계정 수', '지금 있는 계정은 모두 internal 이어야 함(외부 고객은 아직 없음)',
         coalesce((select string_agg(t || ' ' || n, ' · ' order by t) from (
           select a.tier || '/' || a.audience as t, count(*)::text as n from public.os_access a group by 1) s), '0'),
         case when exists (select 1 from public.os_access a where a.audience = 'customer') then '참고 — 고객 계정이 있음(대표가 만든 것인지 확인)' else '좋음' end
  union all
  select 7, '대표 ↔ 팀장 화면 전환', '대표로 본 팀장 화면 목록 수 / 대표가 구성원인 내부 팀장 작업공간 수(적용 전 점검 11번과 같아야 함)',
         (select n from as_owner)::text || ' / ' || (select n from internal_pilot_ws)::text,
         case when (select uid from as_owner) = '' then '확인 필요 — 대표 계정을 찾지 못함'
              when (select n from as_owner) = (select n from internal_pilot_ws) then '좋음' else '확인 필요 — 0024 본문 확인' end
  union all
  select 8, '고객 작업공간의 대표 쪽 구성원', '외부 고객 작업공간에 들어간 full 계정 수(0 이어야 함)',
         (select count(*)::text from public.workspaces w
            join public.os_access c on c.user_id = w.owner_id and c.audience = 'customer'
            join public.workspace_members m on m.workspace_id = w.id
            join public.os_access f on f.user_id = m.user_id and f.tier = 'full'),
         case when (select count(*) from public.workspaces w
                      join public.os_access c on c.user_id = w.owner_id and c.audience = 'customer'
                      join public.workspace_members m on m.workspace_id = w.id
                      join public.os_access f on f.user_id = m.user_id and f.tier = 'full') = 0 then '좋음' else '확인 필요 — 고객 자료가 대표에게 열림' end
  union all
  select 9, '고객 계정의 한도 없는 AI', '외부 고객인데 AI 권한이 internal 인 수(0 이어야 함)',
         coalesce((select v from qv where name = 'cust_ai_internal'), '표 없음(0022 전)'),
         case when coalesce((select v from qv where name = 'cust_ai_internal'), '0') = '0' then '좋음' else '확인 필요' end
  union all
  select 10, '장치 함수를 앱이 직접 부를 수 없음', 'authenticated 가 실행할 수 있는 장치 함수 수(0 이어야 함)',
         (select count(*)::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('workspace_id_lock', 'os_access_customer_member_guard', 'os_access_audience_guard', 'ai_entitlements_customer_guard', 'os_access_link_owner_to_pilots')
             and has_function_privilege('authenticated', p.oid, 'execute')),
         case when (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                     where n.nspname = 'public' and p.proname in ('workspace_id_lock', 'os_access_customer_member_guard', 'os_access_audience_guard', 'ai_entitlements_customer_guard', 'os_access_link_owner_to_pilots')
                       and has_function_privilege('authenticated', p.oid, 'execute')) = 0 then '좋음' else '확인 필요' end
  union all
  select 11, '주요 표 RLS', '꺼진 표 수(0 이어야 함)',
         (select count(*)::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
             and c.relname in ('operations_clients', 'module_data', 'ops_journal_entries', 'workspace_members', 'workspaces', 'customer_events', 'portal_client_links', 'os_access', 'ai_entitlements')),
         case when (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
                     where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
                       and c.relname in ('operations_clients', 'module_data', 'ops_journal_entries', 'workspace_members', 'workspaces', 'customer_events', 'portal_client_links', 'os_access', 'ai_entitlements')) = 0 then '좋음' else '확인 필요' end
)
select no as "번호", item as "항목", what as "확인한 것", result as "결과", verdict as "판정"
from rows_out order by no;
