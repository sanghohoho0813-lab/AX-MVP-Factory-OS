-- 0030 되돌리기 — AI 답 보관을 멈춘다(대표가 되돌리라고 할 때만).
-- 하는 일: 앱 계정의 읽기 · 넣기 권한만 거둔다. 서버는 보관 없이 예전처럼(같은 서버 기억 15분) 돈다 — 화면 · AI 단추는 그대로 쓴다.
-- 남기는 것: 표 · 이미 보관된 답 · 정책 — 아무것도 지우지 않는다. 다시 켜려면 0030 파일을 통째로 다시 실행.
begin;
revoke select, insert on public.ai_assist_results from authenticated;
commit;
-- 확인: false | false 이면 되돌려진 것
select has_table_privilege('authenticated', 'public.ai_assist_results', 'select') as app_read,
       has_table_privilege('authenticated', 'public.ai_assist_results', 'insert') as app_write;
