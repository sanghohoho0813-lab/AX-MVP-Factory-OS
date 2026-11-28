-- 0035 되돌리기 — 고객 화면 '새 결과 자료' 표시(D-686)를 멈춘다. 대표가 되돌리라고 할 때만.
-- 하는 일: 고객용 읽기 함수 둘의 실행 권한을 거둔다 → 홈페이지의 '새 결과 자료' 표시만 숨고 예전 화면 그대로.
-- 남기는 것: 열람 기록 · 함수 본문 · 0033 · 0034 — 아무것도 지우지 않는다(이 파일은 기록을 만들지도 않는다).
-- 다시 켜려면 0035 파일을 통째로 다시 실행.
begin;
revoke execute on function public.portal_results_state(uuid) from authenticated;
revoke execute on function public.portal_result_summary() from authenticated;
commit;
-- 확인: false | false 이면 되돌려진 것
select has_function_privilege('authenticated', 'public.portal_results_state(uuid)', 'execute') as results_state,
       has_function_privilege('authenticated', 'public.portal_result_summary()', 'execute') as result_summary;
