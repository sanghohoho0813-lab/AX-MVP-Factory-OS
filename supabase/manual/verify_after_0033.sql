-- 0033(D-681 고객성장관리 P0 — 보고서 발행 · 열람/확인 기록) 적용 뒤 확인 — 읽기만
-- SQL Editor 에 통째로 붙여 실행. 맨 위 줄이 이 거래를 읽기 전용으로 묶는다(같은 덩어리 안 쓰기 문장은 오류로 막힌다).
-- 결과: 번호 | 무엇 | 값 | 판정 — 1~6 이 모두 '좋음' 이면 들어간 것이다. 7 · 8 은 지금 상태 안내(판정 아님).
set transaction read only;
select n, item, val, verdict from (
  select 1 as n, '보고서 표 · 열람 기록 표' as item,
         ((to_regclass('public.portal_reports') is not null) and (to_regclass('public.portal_receipts') is not null))::text as val,
         case when to_regclass('public.portal_reports') is not null and to_regclass('public.portal_receipts') is not null then '좋음' else '없음' end as verdict
  union all
  select 2, '고객 함수 6 · 내부 함수 5',
         (select count(*)::text from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public'
            and p.proname in ('portal_reports', 'portal_report', 'portal_mark_report_seen', 'portal_acknowledge_report', 'portal_mark_home', 'portal_growth_summary',
                              'portal_publish_report', 'portal_withdraw_report', 'portal_preview_reports', 'portal_preview_report', 'portal_link_accounts')),
         case when (select count(*) from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public'
            and p.proname in ('portal_reports', 'portal_report', 'portal_mark_report_seen', 'portal_acknowledge_report', 'portal_mark_home', 'portal_growth_summary',
                              'portal_publish_report', 'portal_withdraw_report', 'portal_preview_reports', 'portal_preview_report', 'portal_link_accounts')) = 11 then '좋음' else '없음' end
  union all
  select 3, '두 표 RLS 켜짐',
         (select string_agg(relname || ':' || relrowsecurity, ',' order by relname) from pg_class where relnamespace = 'public'::regnamespace and relname in ('portal_reports', 'portal_receipts')),
         case when (select bool_and(relrowsecurity) from pg_class where relnamespace = 'public'::regnamespace and relname in ('portal_reports', 'portal_receipts')) then '좋음' else '확인' end
  union all
  select 4, '앱 계정 권한(읽기만이어야 함 · anon 0)',
         coalesce((select string_agg(distinct grantee || ':' || privilege_type, ',') from information_schema.role_table_grants
                    where table_schema = 'public' and table_name in ('portal_reports', 'portal_receipts') and grantee in ('anon', 'authenticated')), '없음'),
         case when (select string_agg(distinct grantee || ':' || privilege_type, ',') from information_schema.role_table_grants
                    where table_schema = 'public' and table_name in ('portal_reports', 'portal_receipts') and grantee in ('anon', 'authenticated')) = 'authenticated:SELECT' then '좋음' else '확인' end
  union all
  select 5, '허락 문(0026) · 작업공간 고정(0023) 붙음',
         (select count(*)::text from pg_policies where policyname = 'zz View consent gate' and tablename in ('portal_reports', 'portal_receipts')) || ' · ' ||
         (select count(*)::text from pg_trigger g join pg_class c on c.oid = g.tgrelid where c.relname in ('portal_reports', 'portal_receipts') and g.tgname = 'zz_workspace_id_lock'),
         case when (select count(*) from pg_policies where policyname = 'zz View consent gate' and tablename in ('portal_reports', 'portal_receipts')) = 2
               and (select count(*) from pg_trigger g join pg_class c on c.oid = g.tgrelid where c.relname in ('portal_reports', 'portal_receipts') and g.tgname = 'zz_workspace_id_lock') = 2 then '좋음' else '확인' end
  union all
  select 6, '로그인 안 한 사람(anon)은 함수를 부를 수 없음',
         (has_function_privilege('anon', 'public.portal_reports(uuid)', 'execute') or has_function_privilege('anon', 'public.portal_publish_report(uuid,text,text,text,text,date,date,text,jsonb,text,jsonb,uuid,text)', 'execute'))::text,
         case when not (has_function_privilege('anon', 'public.portal_reports(uuid)', 'execute') or has_function_privilege('anon', 'public.portal_publish_report(uuid,text,text,text,text,date,date,text,jsonb,text,jsonb,uuid,text)', 'execute')) then '좋음' else '확인' end
  union all
  select 7, '지금까지 발행한 보고서(발행 중 · 정정됨 · 내림)',
         (select count(*) filter (where status = 'published') || ' · ' || count(*) filter (where status = 'superseded') || ' · ' || count(*) filter (where status = 'withdrawn') from public.portal_reports),
         '안내'
  union all
  select 8, '고객 화면에 와 본 계정 수(첫 방문 기록)',
         (select count(distinct portal_client_link_id)::text from public.portal_receipts where item_kind = 'home'),
         '안내'
) x
order by n;
