-- 0031 되돌리기 — 서류 올리기 링크를 모두 멈춘다(공개 주소는 '닫힌 링크' · 앱의 [올리기 링크] 칸은 숨는다). 대표가 되돌리라고 할 때만.
-- 하는 일: 0031 함수 실행 권한을 거두고, 0031 이 더한 보관함 넣기 정책 하나만 뺀다(로그인 안 한 사람은 보관함에 한 장도 못 넣는다).
-- 남기는 것: 링크 표 · 받은 파일 기록 · 보관함에 이미 들어온 파일 · 함수 본문 · 기존 보관함 정책 — 아무것도 지우지 않는다.
-- 다시 켜려면 0031 파일을 통째로 다시 실행.
begin;
revoke execute on function public.upload_link_state(uuid, text) from authenticated;
revoke execute on function public.upload_link_save(uuid, text, jsonb, integer, text) from authenticated;
revoke execute on function public.upload_link_rotate(uuid, text) from authenticated;
revoke execute on function public.upload_link_off(uuid, text) from authenticated;
revoke execute on function public.upload_link_decide(uuid, text) from authenticated;
revoke execute on function public.upload_link_inbox(uuid) from authenticated;
revoke execute on function public.public_upload_form(text) from anon, authenticated;
revoke execute on function public.public_upload_reserve(text, text, text, bigint, text) from anon, authenticated;
revoke execute on function public.public_upload_done(text, text) from anon, authenticated;
revoke execute on function public.upload_link_path_ok(text) from anon, authenticated;
drop policy if exists "Upload links: reserved path insert" on storage.objects;
commit;
-- 확인: false | false | 0 이면 되돌려진 것
select has_function_privilege('anon', 'public.public_upload_reserve(text,text,text,bigint,text)', 'execute') as anon_reserve,
       has_function_privilege('authenticated', 'public.upload_link_save(uuid,text,jsonb,integer,text)', 'execute') as app_save,
       (select count(*) from pg_policies where schemaname = 'storage' and policyname = 'Upload links: reserved path insert') as storage_policy;
