-- =====================================================================
-- 0023 · 0024 적용 **전** 점검 — 읽기만 한다(마이그레이션 아님 · D-534 와 같은 방식)
--
-- 사용: Supabase SQL Editor 에 통째로 붙여 넣고 실행 → 표 하나. 맨 첫 줄 '읽기 전용 거래 = on' 이면 쓰기는 막혀 있다.
-- '판정' 칸이 모두 '좋음' 또는 '참고' 면 적용해도 된다. '멈춤' 이 하나라도 있으면 적용하지 말고 그 줄을 먼저 해결한다.
-- 개인 정보(이름 · 이메일 · 업체 내용)는 읽지 않는다 — 수만 센다.
-- 자세한 순서 · 되돌리기: docs/OPS_0023_0024_RUNBOOK.md
-- =====================================================================
set transaction read only;

with fn(name) as (
  select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
), trg(name, rel) as (
  select g.tgname, c.relname from pg_trigger g join pg_class c on c.oid = g.tgrelid where not g.tgisinternal
), fp(name, md5) as (
  select p.proname, md5(p.prosrc) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('os_access_link_owner_to_pilots', 'my_pilot_views')
), has_os as (
  select to_regclass('public.os_access') is not null as ok
), lock_tables(t) as (
  select unnest(array['operations_clients', 'module_data', 'ops_journal_entries', 'ops_custom_services',
    'consulting_projects', 'consulting_artifacts', 'consulting_decisions', 'consulting_evidence', 'consulting_prompt_packages',
    'customer_events', 'portal_client_links', 'portal_documents', 'portal_requests', 'portal_updates', 'portal_grant_notices',
    'data_import_jobs', 'data_import_items', 'ui_preferences', 'workspace_invites'])
), q(name, sqltext) as (
  -- 표가 없을 수도 있는 질문은 글로 두고 표가 있을 때만 실행(query_to_xml — 읽기만)
  values
  ('pilot_ws', $q$select count(*)::text as v from public.workspaces w join public.os_access p on p.user_id = w.owner_id and p.tier = 'pilot'$q$),
  ('owner_in_pilot', $q$select count(*)::text as v from public.workspaces w join public.os_access p on p.user_id = w.owner_id and p.tier = 'pilot'
                        join public.workspace_members m on m.workspace_id = w.id join public.os_access a on a.user_id = m.user_id and a.tier = 'full'$q$),
  ('other_in_pilot', $q$select count(*)::text as v from public.workspaces w join public.os_access p on p.user_id = w.owner_id and p.tier = 'pilot'
                        join public.workspace_members m on m.workspace_id = w.id and m.user_id <> w.owner_id
                        where not exists (select 1 from public.os_access a where a.user_id = m.user_id and a.tier = 'full')$q$),
  ('tiers', $q$select coalesce(string_agg(t || ' ' || n, ' · ' order by t), '0') as v from (
                 select a.tier || '/' || coalesce(to_jsonb(a) ->> 'audience', '(대상 칸 없음)') as t, count(*)::text as n from public.os_access a group by 1) s$q$),
  ('pilot_ai', $q$select coalesce(string_agg(k || ' ' || n, ' · ' order by k), '없음') as v from (
                 select coalesce(e.kind, '(AI 권한 줄 없음)') as k, count(*)::text as n
                 from public.os_access a left join public.ai_entitlements e on e.user_id = a.user_id where a.tier = 'pilot' group by 1) s$q$),
  ('fixed_in_pilot', $q$select count(*)::text as v from public.module_data d join public.workspaces w on w.id = d.workspace_id
                        join public.os_access p on p.user_id = w.owner_id and p.tier = 'pilot'
                        where d.id = 'self-check' or d.id ~ '^wk_[0-9]{4}-[0-9]{2}-[0-9]{2}$'$q$),
  ('owner_only_in_pilot', $q$select count(*)::text as v from public.module_data d join public.workspaces w on w.id = d.workspace_id
                             join public.os_access p on p.user_id = w.owner_id and p.tier = 'pilot'
                             where d.module_key = 'marketing'$q$)
), qv(name, v) as (
  select name, case when (select ok from has_os) then (xpath('/row/v/text()', query_to_xml(sqltext, false, true, '')))[1]::text else null end from q
  where name not in ('pilot_ai') or to_regclass('public.ai_entitlements') is not null
), rows_out(no, item, what, result, verdict) as (
  select 0, '읽기 전용 거래', '맨 위 set transaction read only', current_setting('transaction_read_only'),
         case when current_setting('transaction_read_only') = 'on' then '좋음' else '참고(한 줄씩 실행하는 도구 — 아래는 SELECT 뿐)' end
  union all
  select 1, '선행 0016~0018', '보안 강화 · 공개 링크 · 고객 찾기',
         case when exists (select 1 from fn where name = 'portal_same_workspace_guard') and exists (select 1 from fn where name = 'public_link_expired')
                   and exists (select 1 from fn where name = 'staff_find_customer_profile') then '있음' else '없음' end,
         case when exists (select 1 from fn where name = 'portal_same_workspace_guard') and exists (select 1 from fn where name = 'public_link_expired')
                   and exists (select 1 from fn where name = 'staff_find_customer_profile') then '좋음' else '멈춤 — 0016~0018 부터' end
  union all
  select 2, '선행 0019 · 0020', '등급 표 · 팀장 화면 함수(0024 가 필요)',
         case when (select ok from has_os) and exists (select 1 from fn where name = 'my_pilot_views') then '있음' else '없음' end,
         case when (select ok from has_os) and exists (select 1 from fn where name = 'my_pilot_views') then '좋음' else '멈춤 — 0019 · 0020 부터' end
  union all
  select 3, '선행 0022', 'AI 권한 표(0024 의 고객 AI 장치가 필요)',
         case when to_regclass('public.ai_entitlements') is not null then '있음' else '없음' end,
         case when to_regclass('public.ai_entitlements') is not null then '좋음' else '참고 — 0022 를 먼저 적용하거나, 0022 뒤에 0024 를 한 번 더 실행' end
  union all
  select 4, '0023 이미 적용?', 'zz_workspace_id_lock 트리거 수',
         (select count(*)::text from trg where name = 'zz_workspace_id_lock'),
         case when (select count(*) from trg where name = 'zz_workspace_id_lock') = 0 then '좋음(처음)' else '참고(이미 있음 — 다시 실행해도 같음)' end
  union all
  select 5, '0024 이미 적용?', 'os_access.audience 칸',
         case when exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'os_access' and column_name = 'audience') then '있음' else '없음' end,
         '참고'
  union all
  select 6, '0023 대상 표', '19개 중 있고 workspace_id 칸이 있는 표',
         (select count(*)::text from lock_tables l where exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = l.t and c.column_name = 'workspace_id')),
         '참고(없는 표는 건너뜀)'
  union all
  select 7, '바꿀 함수 ① 대표 연결', 'os_access_link_owner_to_pilots 본문 지문',
         coalesce((select case md5 when '5923bce05aa4d3eebf827e7fd39e3db5' then '0020 그대로' when 'a4b15692163e9302adf96e7be8b1d021' then '0024 이미' else '다름' end from fp where name = 'os_access_link_owner_to_pilots'), '없음'),
         coalesce((select case when md5 in ('5923bce05aa4d3eebf827e7fd39e3db5', 'a4b15692163e9302adf96e7be8b1d021') then '좋음' else '멈춤 — 누가 고친 본문: 먼저 pg_get_functiondef 로 보관하고 대표 확인' end from fp where name = 'os_access_link_owner_to_pilots'), '멈춤 — 0020 부터')
  union all
  select 8, '바꿀 함수 ② 팀장 화면 목록', 'my_pilot_views 본문 지문',
         coalesce((select case md5 when 'b9e5de279b3f39efc381ecf3c0b497b0' then '0020 그대로' when '9e29a68be87ac2fa4ece076aa66b6969' then '0024 이미' else '다름' end from fp where name = 'my_pilot_views'), '없음'),
         coalesce((select case when md5 in ('b9e5de279b3f39efc381ecf3c0b497b0', '9e29a68be87ac2fa4ece076aa66b6969') then '좋음' else '멈춤 — 누가 고친 본문: 먼저 보관하고 대표 확인' end from fp where name = 'my_pilot_views'), '멈춤 — 0020 부터')
  union all
  select 9, '새 함수 이름 겹침', 'workspace_id_lock · os_access_customer_member_guard · os_access_audience_guard · ai_entitlements_customer_guard',
         (select count(*)::text from fn where name in ('workspace_id_lock', 'os_access_customer_member_guard', 'os_access_audience_guard', 'ai_entitlements_customer_guard')),
         case when (select count(*) from fn where name in ('workspace_id_lock', 'os_access_customer_member_guard', 'os_access_audience_guard', 'ai_entitlements_customer_guard')) = 0
              then '좋음(처음)' else '참고(이미 있음 — 0023 · 0024 를 전에 실행했다면 정상)' end
  union all
  select 10, '팀장(Pilot) 작업공간 수', '내부 팀장 작업공간', coalesce((select v from qv where name = 'pilot_ws'), '표 없음'), '참고'
  union all
  select 11, '대표가 팀장 작업공간 구성원', '팀장 화면 전환이 쓰는 줄(0024 뒤에도 그대로여야 함)', coalesce((select v from qv where name = 'owner_in_pilot'), '표 없음'),
         case when (select v from qv where name = 'owner_in_pilot') = (select v from qv where name = 'pilot_ws') then '좋음(팀장마다 1줄)' else '참고 — 수가 다르면 팀장 화면 전환 상태를 대표가 확인' end
  union all
  select 12, '팀장 작업공간의 다른 구성원', '대표 · 팀장 본인 말고(있으면 외부 사람일 수 있음)', coalesce((select v from qv where name = 'other_in_pilot'), '표 없음'),
         case when coalesce((select v from qv where name = 'other_in_pilot'), '0') = '0' then '좋음' else '멈춤 — 누구인지 대표 확인' end
  union all
  select 13, '등급/대상별 계정 수', 'os_access(지금 외부 고객은 없어야 함)', coalesce((select v from qv where name = 'tiers'), '표 없음'), '참고 — pilot 이 내부 팀장 수와 같은지 대표 확인'
  union all
  select 14, '팀장 계정 AI 권한', 'pilot 계정의 ai_entitlements.kind(internal 이어야 함)', coalesce((select v from qv where name = 'pilot_ai'), '표 없음(0022 전)'), '참고'
  union all
  select 15, '고정 이름 기록이 팀장 작업공간에', '예전 id 의 자체점검 기준(self-check) · 이번 주 참고(wk_<주>) — 대표 기록이 옮겨졌을 수 있음(D-538 뒤 새 줄은 작업공간마다 따로라 세지 않음)', coalesce((select v from qv where name = 'fixed_in_pilot'), '표 없음'),
         case when coalesce((select v from qv where name = 'fixed_in_pilot'), '0') = '0' then '좋음' else '참고 — 대표 기록이 팀장 작업공간에 있음(적용과 무관 · 따로 정리)' end
  union all
  select 16, '대표 전용 모듈 기록이 팀장 작업공간에', 'marketing 모듈 줄 수(마케팅은 대표 전용)', coalesce((select v from qv where name = 'owner_only_in_pilot'), '표 없음'),
         case when coalesce((select v from qv where name = 'owner_only_in_pilot'), '0') = '0' then '좋음' else '참고 — 섞인 흔적일 수 있음(적용과 무관 · 따로 확인)' end
  union all
  select 17, '오래 걸린 거래', '1분 넘게 열린 거래(있으면 트리거 만들기가 기다림)',
         (select count(*)::text from pg_stat_activity where pid <> pg_backend_pid() and xact_start < now() - interval '1 minute' and state <> 'idle'),
         case when (select count(*) from pg_stat_activity where pid <> pg_backend_pid() and xact_start < now() - interval '1 minute' and state <> 'idle') = 0
              then '좋음' else '참고 — 조용한 시간에 다시' end
)
select no as "번호", item as "항목", what as "확인한 것", result as "결과", verdict as "판정"
from rows_out order by no;
