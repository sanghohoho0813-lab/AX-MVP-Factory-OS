-- 0035(D-686 고객 화면 '새 결과 자료') 적용 뒤 확인 — 읽기만
-- SQL Editor 에 통째로 붙여 실행. 맨 위 줄이 이 거래를 읽기 전용으로 묶는다.
-- 결과: 번호 | 무엇 | 값 | 판정 — 1~3 이 모두 '좋음' 이면 들어간 것이다.
set transaction read only;
select n, item, val, verdict from (
  select 1 as n, '고객 읽기 함수 2' as item,
         (select count(*)::text from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname in ('portal_results_state', 'portal_result_summary')) as val,
         case when (select count(*) from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname in ('portal_results_state', 'portal_result_summary')) = 2 then '좋음' else '없음' end as verdict
  union all
  select 2, '로그인한 계정은 부를 수 있음 · 로그인 안 한 사람(anon)은 못 부름',
         has_function_privilege('authenticated', 'public.portal_result_summary()', 'execute')::text || ' · ' || has_function_privilege('anon', 'public.portal_result_summary()', 'execute')::text,
         case when has_function_privilege('authenticated', 'public.portal_result_summary()', 'execute') and has_function_privilege('authenticated', 'public.portal_results_state(uuid)', 'execute')
               and not has_function_privilege('anon', 'public.portal_result_summary()', 'execute') and not has_function_privilege('anon', 'public.portal_results_state(uuid)', 'execute') then '좋음' else '확인' end
  union all
  select 3, '먼저 넣을 것(0034) 그대로',
         (to_regproc('public.portal_mark_item_seen') is not null and to_regproc('public.portal_result_receipts_since') is not null)::text,
         case when to_regproc('public.portal_mark_item_seen') is not null and to_regproc('public.portal_result_receipts_since') is not null then '좋음' else '없음' end
) x
order by n;
