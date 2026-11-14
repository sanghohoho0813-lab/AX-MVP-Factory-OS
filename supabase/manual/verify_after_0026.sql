-- 0026(L-27 · D-608 대표가 팀장 고객 자료를 볼 때 — 팀장 허락 동안만) 적용 뒤 확인 — 읽기만
-- SQL Editor 에 통째로 붙여 실행. 맨 위 줄이 이 거래를 읽기 전용으로 묶는다(같은 덩어리 안 쓰기 문장은 오류로 막힌다).
-- 결과: 번호 | 무엇 | 값 | 판정 — 1~6 이 모두 '좋음' 이면 들어간 것이다. 7 · 8 은 지금 상태 안내(판정 아님).
set transaction read only;
select n, item, val, verdict from (
  select 1 as n, '고객 자료 표에 단 문(RESTRICTIVE)' as item,
         (select count(*)::text from pg_policies where schemaname = 'public' and policyname = 'zz View consent gate' and tablename <> 'module_data') as val,
         case when (select count(*) from pg_policies where schemaname = 'public' and policyname = 'zz View consent gate' and tablename <> 'module_data') >= 10 then '좋음' else '없음' end as verdict
  union all
  select 2, '모듈 기록 문(업체 걸린 줄 · 업체 자료 모듈)',
         (select count(*)::text from pg_policies where schemaname = 'public' and policyname = 'zz View consent gate' and tablename = 'module_data'),
         case when (select count(*) from pg_policies where schemaname = 'public' and policyname = 'zz View consent gate' and tablename = 'module_data') = 1 then '좋음' else '없음' end
  union all
  select 3, '업체 서류 파일 문(client-documents)',
         (select count(*)::text from pg_policies where schemaname = 'storage' and policyname = 'zz View consent gate client documents'),
         case when (select count(*) from pg_policies where schemaname = 'storage' and policyname = 'zz View consent gate client documents') = 1 then '좋음' else '없음' end
  union all
  select 4, '허락 · 요청 기록 표',
         (select count(*)::text from pg_tables where schemaname = 'public' and tablename in ('workspace_view_grants', 'workspace_view_requests')),
         case when (select count(*) from pg_tables where schemaname = 'public' and tablename in ('workspace_view_grants', 'workspace_view_requests')) = 2 then '좋음' else '없음' end
  union all
  select 5, '화면이 쓰는 함수(view_consent_*)',
         (select count(*)::text from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname like 'view\_consent\_%'),
         case when (select count(*) from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname like 'view\_consent\_%') = 8 then '좋음' else '없음' end
  union all
  select 6, '앱 계정이 기록 표에 가진 권한(읽기만이어야 함)',
         coalesce((select string_agg(distinct privilege_type, ',') from information_schema.role_table_grants where grantee = 'authenticated' and table_schema = 'public' and table_name in ('workspace_view_grants', 'workspace_view_requests')), '-'),
         case when (select string_agg(distinct privilege_type, ',') from information_schema.role_table_grants where grantee = 'authenticated' and table_schema = 'public' and table_name in ('workspace_view_grants', 'workspace_view_requests')) = 'SELECT' then '좋음' else '살펴볼 것' end
  union all
  select 7, '대표가 팀장 작업공간 구성원(전환 단추는 그대로)',
         (select count(*)::text from public.workspace_members m
            join public.workspaces w on w.id = m.workspace_id
            join public.os_access o on o.user_id = w.owner_id and o.tier = 'pilot'
            join public.os_access a on a.user_id = m.user_id and a.tier = 'full'
          where m.user_id <> w.owner_id),
         '안내'
  union all
  select 8, '지금 열린 허락(0 이면 대표는 팀장 업체 · 서류를 못 본다)',
         (select count(*)::text from public.workspace_view_grants where revoked_at is null and expires_at > now()),
         '안내'
) x
order by n;
