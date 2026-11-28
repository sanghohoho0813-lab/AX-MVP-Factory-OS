-- 0036(D-689 고객 화면 '담당자가 추천해요') 적용 뒤 확인 — 읽기만
-- SQL Editor 에 통째로 붙여 실행. 맨 위 줄이 이 거래를 읽기 전용으로 묶는다(같은 덩어리 안 쓰기 문장은 오류로 막힌다).
-- 결과: 번호 | 무엇 | 값 | 판정 — 1~6 이 모두 '좋음' 이면 들어간 것이다. 7 · 8 은 지금 상태 안내(판정 아님).
set transaction read only;
select n, item, val, verdict from (
  select 1 as n, '추천 표 · 관심 기록 표' as item,
         ((to_regclass('public.portal_recommendations') is not null) and (to_regclass('public.portal_recommendation_interest') is not null))::text as val,
         case when to_regclass('public.portal_recommendations') is not null and to_regclass('public.portal_recommendation_interest') is not null then '좋음' else '없음' end as verdict
  union all
  select 2, '고객 함수 2 · 내부 함수 2',
         (select count(*)::text from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public'
            and p.proname in ('portal_recommendations', 'portal_recommendation_interest', 'portal_show_recommendation', 'portal_withdraw_recommendation')),
         case when (select count(*) from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public'
            and p.proname in ('portal_recommendations', 'portal_recommendation_interest', 'portal_show_recommendation', 'portal_withdraw_recommendation')) = 4 then '좋음' else '없음' end
  union all
  select 3, '두 표 RLS 켜짐',
         (select string_agg(relname || ':' || relrowsecurity::text, ' · ' order by relname) from pg_class where relnamespace = 'public'::regnamespace and relname in ('portal_recommendations', 'portal_recommendation_interest')),
         case when (select bool_and(relrowsecurity) and count(*) = 2 from pg_class where relnamespace = 'public'::regnamespace and relname in ('portal_recommendations', 'portal_recommendation_interest')) then '좋음' else '확인' end
  union all
  select 4, '앱 계정 권한(읽기만이어야 함 · anon 0)',
         coalesce((select string_agg(distinct grantee || ':' || privilege_type, ' · ') from information_schema.role_table_grants
                    where table_schema = 'public' and table_name in ('portal_recommendations', 'portal_recommendation_interest') and grantee in ('anon', 'authenticated')), '없음'),
         case when (select string_agg(distinct grantee || ':' || privilege_type, ' · ') from information_schema.role_table_grants
                    where table_schema = 'public' and table_name in ('portal_recommendations', 'portal_recommendation_interest') and grantee in ('anon', 'authenticated')) = 'authenticated:SELECT' then '좋음' else '확인' end
  union all
  select 5, '허락 문(0026) · 작업공간 고정(0023) · 같은 작업공간 지킴 붙음',
         (select count(*)::text from pg_policies where policyname = 'zz View consent gate' and tablename in ('portal_recommendations', 'portal_recommendation_interest')) || ' · ' ||
         (select count(*)::text from pg_trigger g join pg_class c on c.oid = g.tgrelid where c.relname in ('portal_recommendations', 'portal_recommendation_interest') and g.tgname in ('zz_workspace_id_lock', 'zz_portal_recommendations_same_workspace', 'zz_portal_reco_interest_same_workspace')),
         case when (select count(*) from pg_policies where policyname = 'zz View consent gate' and tablename in ('portal_recommendations', 'portal_recommendation_interest')) = 2
               and (select count(*) from pg_trigger g join pg_class c on c.oid = g.tgrelid where c.relname in ('portal_recommendations', 'portal_recommendation_interest') and g.tgname in ('zz_workspace_id_lock', 'zz_portal_recommendations_same_workspace', 'zz_portal_reco_interest_same_workspace')) = 4 then '좋음' else '확인' end
  union all
  select 6, '로그인한 계정은 부를 수 있음 · 로그인 안 한 사람(anon)은 못 부름',
         has_function_privilege('authenticated', 'public.portal_recommendations(uuid)', 'execute')::text || ' · ' || has_function_privilege('anon', 'public.portal_recommendations(uuid)', 'execute')::text,
         case when has_function_privilege('authenticated', 'public.portal_recommendations(uuid)', 'execute') and has_function_privilege('authenticated', 'public.portal_recommendation_interest(uuid,uuid)', 'execute')
               and has_function_privilege('authenticated', 'public.portal_show_recommendation(uuid,text,text,text,text,text,date,text,jsonb)', 'execute') and has_function_privilege('authenticated', 'public.portal_withdraw_recommendation(uuid)', 'execute')
               and not has_function_privilege('anon', 'public.portal_recommendations(uuid)', 'execute') and not has_function_privilege('anon', 'public.portal_recommendation_interest(uuid,uuid)', 'execute')
               and not has_function_privilege('anon', 'public.portal_show_recommendation(uuid,text,text,text,text,text,date,text,jsonb)', 'execute') and not has_function_privilege('anon', 'public.portal_withdraw_recommendation(uuid)', 'execute') then '좋음' else '확인' end
  union all
  select 7, '고객 화면에 올라와 있는 추천 · 내린 추천',
         (select count(*) filter (where status = 'shown') || ' · ' || count(*) filter (where status = 'withdrawn') from public.portal_recommendations),
         '안내'
  union all
  select 8, '[관심 있어요] 누른 수',
         (select count(*)::text from public.portal_recommendation_interest),
         '안내'
) x
order by n;
