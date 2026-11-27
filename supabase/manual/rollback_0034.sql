-- 0034 되돌리기 — 공유 서류 · 결과 글 열람 기록(D-685)을 멈춘다. 대표가 되돌리라고 할 때만.
-- 하는 일: 고객이 기록을 남기는 함수 · 넣은 때 함수의 실행 권한을 거둔다 → 홈페이지는 기록 없이 예전처럼 열리고,
--          내부 OS 의 '열어 보심 · 안 여심' 줄과 '결과 자료 안 열어 보심' 후속 줄이 숨는다(예전 화면 그대로).
-- 남기는 것: 열람 표 · 그 안의 기록 · 넓힌 종류 검사 · 함수 본문 — 아무것도 지우지 않는다.
-- 다시 켜려면 0034 파일을 통째로 다시 실행(넣은 때는 처음 넣은 때 그대로).
begin;
revoke execute on function public.portal_mark_item_seen(uuid, text, uuid) from authenticated;
revoke execute on function public.portal_result_receipts_since() from authenticated;
commit;
-- 확인: false | false 이면 되돌려진 것
select has_function_privilege('authenticated', 'public.portal_mark_item_seen(uuid,text,uuid)', 'execute') as customer_mark_item,
       has_function_privilege('authenticated', 'public.portal_result_receipts_since()', 'execute') as since;
