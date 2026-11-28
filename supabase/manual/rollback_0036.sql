-- 0036 되돌리기 — 고객 화면 '담당자가 추천해요'(D-689)를 멈춘다. 대표가 되돌리라고 할 때만.
-- 하는 일: 함수 넷의 실행 권한 · 두 표의 읽기 권한을 거둔다 → 홈페이지 추천 칸 · OS '고객에게 추천' 칸만 숨고 예전 화면 그대로.
-- 남기는 것: 올린 추천 · [관심 있어요] 기록 · 함수 본문 · 0033 ~ 0035 — 아무것도 지우지 않는다(이 파일은 기록을 만들지도 않는다).
-- 다시 켜려면 0036 파일을 통째로 다시 실행(올린 추천 · 관심 기록이 그대로 돌아온다).
begin;
revoke execute on function public.portal_recommendations(uuid) from authenticated;
revoke execute on function public.portal_recommendation_interest(uuid, uuid) from authenticated;
revoke execute on function public.portal_show_recommendation(uuid, text, text, text, text, text, date, text, jsonb) from authenticated;
revoke execute on function public.portal_withdraw_recommendation(uuid) from authenticated;
revoke select on public.portal_recommendations from authenticated;
revoke select on public.portal_recommendation_interest from authenticated;
commit;
-- 확인: false | false | false 이면 되돌려진 것
select has_function_privilege('authenticated', 'public.portal_recommendations(uuid)', 'execute') as customer_fn,
       has_function_privilege('authenticated', 'public.portal_show_recommendation(uuid,text,text,text,text,text,date,text,jsonb)', 'execute') as staff_fn,
       has_table_privilege('authenticated', 'public.portal_recommendations', 'select') as staff_read;
