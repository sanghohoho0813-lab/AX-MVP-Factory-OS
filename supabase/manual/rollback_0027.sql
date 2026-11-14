-- 0027 되돌리기 — 상담 신청 링크를 모두 멈춘다(공개 주소는 '지금 받지 않아요' · 앱의 링크 칸은 숨는다). 대표가 되돌리라고 할 때만.
-- 하는 일: 0027 함수 실행 권한만 거둔다.
-- 남기는 것: 링크 표 · 이미 들어온 잠재고객(업체 기록) · 함수 본문 — 아무것도 지우지 않는다. 다시 켜려면 0027 파일을 통째로 다시 실행.
begin;
revoke execute on function public.intake_link_state(uuid) from authenticated;
revoke execute on function public.intake_link_save(uuid, text, text) from authenticated;
revoke execute on function public.intake_link_rotate(uuid) from authenticated;
revoke execute on function public.intake_link_off(uuid) from authenticated;
revoke execute on function public.public_intake_form(text) from anon, authenticated;
revoke execute on function public.public_intake_submit(text, jsonb) from anon, authenticated;
commit;
-- 확인: false | false 이면 되돌려진 것
select has_function_privilege('anon', 'public.public_intake_submit(text,jsonb)', 'execute') as anon_submit,
       has_function_privilege('authenticated', 'public.intake_link_save(uuid,text,text)', 'execute') as app_save;
