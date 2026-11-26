-- 0032(L-27 보완 · D-675 대표가 정해 둔 내부 팀장 작업공간은 허락 없이도 — '늘 보기') 적용 뒤 확인 — 읽기만
-- SQL Editor 에 통째로 붙여 실행. 맨 위 줄이 이 거래를 읽기 전용으로 묶는다(같은 덩어리 안 쓰기 문장은 오류로 막힌다).
-- 결과: 번호 | 무엇 | 값 | 판정 — 1~5 가 모두 '좋음' 이면 들어간 것이다. 6 · 7 은 지금 상태 안내(판정 아님).
set transaction read only;
select n, item, val, verdict from (
  select 1 as n, '늘 보기 기록 표' as item,
         (to_regclass('public.workspace_view_always') is not null)::text as val,
         case when to_regclass('public.workspace_view_always') is not null then '좋음' else '없음' end as verdict
  union all
  select 2, '켜기 · 끄기 함수(view_always_set)',
         (to_regprocedure('public.view_always_set(uuid, boolean)') is not null)::text,
         case when to_regprocedure('public.view_always_set(uuid, boolean)') is not null then '좋음' else '없음' end
  union all
  select 3, '닫힌 작업공간 목록이 늘 보기를 본다',
         (select (pg_get_functiondef(p.oid) like '%workspace_view_always%')::text from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname = 'view_consent_blocked_workspaces'),
         case when (select pg_get_functiondef(p.oid) like '%workspace_view_always%' from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname = 'view_consent_blocked_workspaces') then '좋음' else '없음' end
  union all
  select 4, '상태 함수가 늘 보기를 알려 준다',
         (select (pg_get_functiondef(p.oid) like '%canAlways%')::text from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname = 'view_consent_state'),
         case when (select pg_get_functiondef(p.oid) like '%canAlways%' from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname = 'view_consent_state') then '좋음' else '없음' end
  union all
  select 5, '앱 계정이 기록 표에 가진 권한(읽기만이어야 함)',
         coalesce((select string_agg(distinct privilege_type, ',') from information_schema.role_table_grants where grantee = 'authenticated' and table_schema = 'public' and table_name = 'workspace_view_always'), '없음'),
         case when (select string_agg(distinct privilege_type, ',') from information_schema.role_table_grants where grantee = 'authenticated' and table_schema = 'public' and table_name = 'workspace_view_always') = 'SELECT' then '좋음' else '확인' end
  union all
  select 6, '지금 늘 보기가 켜진 작업공간(이름) — 앱에서 [늘 보기로 켜기] 를 누르기 전에는 0곳',
         coalesce((select count(*)::text || '곳: ' || string_agg(w.name, ' · ' order by w.name)
                   from public.workspace_view_always a join public.workspaces w on w.id = a.workspace_id where a.ended_at is null), '0곳'),
         '안내'
  union all
  select 7, '늘 보기를 켤 수 있는 내부 팀장 작업공간(대표가 구성원인 곳)',
         (select count(*)::text from public.workspace_members m
            join public.workspaces w on w.id = m.workspace_id
            join public.os_access o on o.user_id = w.owner_id and o.tier = 'pilot' and o.audience = 'internal'
            join public.os_access a on a.user_id = m.user_id and a.tier = 'full'
          where m.user_id <> w.owner_id),
         '안내'
) x
order by n;
