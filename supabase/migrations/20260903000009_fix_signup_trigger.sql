-- 20260903000009_fix_signup_trigger.sql
--
-- 장애 수정: 이 프로젝트에서 신규 계정 생성이 전부 실패하고 있었다.
--
-- 증상
--   Dashboard → Add user, 그리고 miraeailab.com 회원가입 모두
--   "Database error creating new user" 로 실패.
--
-- 원인
--   auth.users 에 가입 트리거가 두 개 걸려 있다.
--     on_auth_user_created        → public.handle_new_user()        (내부 OS, 20260721000002)
--     zz_mirae_on_auth_user_created → public.handle_new_user_mirae() (공개 사이트)
--   트리거는 이름 순서로 발화하므로 내부 것이 먼저 돈다.
--   내부 handle_new_user 는 profiles (id, email, display_name) 에 넣도록 쓰여 있는데,
--   이 프로젝트의 public.profiles 는 공개 사이트 스키마(name 은 있고 display_name 은 없다)라
--   첫 트리거가 그 자리에서 실패하고, 그 바람에 auth.users INSERT 전체가 롤백된다.
--   공개 사이트 트리거는 'zz_' 접두사로 나중에 돌도록 설계돼 있어 순서 자체는 의도대로였지만,
--   앞 트리거가 죽으면 뒤 트리거는 실행될 기회조차 없다.
--
--   이번 브릿지 마이그레이션(…0006/0007/0008)과는 무관하다.
--   브릿지 트리거는 auth.users 나 profiles 에 걸려 있지 않다.
--
-- 조치
--   handle_new_user 를 스키마에 맞춰 동작하도록 고친다. 실행 시점에 profiles 의
--   컬럼을 보고 display_name / name 중 있는 것에만 넣는다. 둘 다 없으면 id·email 만 넣는다.
--   이렇게 하면
--     · 이 프로젝트(공개 사이트 스키마)     — 실패하지 않고, 뒤이어 도는 공개 사이트
--       트리거가 name·phone·organization·role 을 채운다(ON CONFLICT DO UPDATE 로 보강).
--     · 내부 OS 단독 배포(display_name 스키마) — 지금까지와 똑같이 동작한다.
--
--   ON CONFLICT (id) DO NOTHING 을 쓴다. 뒤 트리거가 보강하도록 자리만 만들고 비켜 준다.
--
-- 원칙: 함수 교체만 — 테이블·컬럼·트리거·정책 변경 없음. 멱등.

begin;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  has_display boolean;
  has_name    boolean;
  v_label     text;
begin
  select
    count(*) filter (where column_name = 'display_name') > 0,
    count(*) filter (where column_name = 'name') > 0
    into has_display, has_name
  from information_schema.columns
  where table_schema = 'public' and table_name = 'profiles';

  v_label := coalesce(
    new.raw_user_meta_data ->> 'display_name',
    new.raw_user_meta_data ->> 'name',
    new.raw_user_meta_data ->> 'full_name',
    split_part(coalesce(new.email, ''), '@', 1)
  );

  if has_display and has_name then
    insert into public.profiles (id, email, display_name, name)
    values (new.id, new.email, v_label, v_label)
    on conflict (id) do nothing;
  elsif has_display then
    insert into public.profiles (id, email, display_name)
    values (new.id, new.email, v_label)
    on conflict (id) do nothing;
  elsif has_name then
    insert into public.profiles (id, email, name)
    values (new.id, new.email, v_label)
    on conflict (id) do nothing;
  else
    insert into public.profiles (id, email)
    values (new.id, new.email)
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;

commit;

-- ------------------------------------------------------------------
-- 확인용 — 계정 생성이 다시 되는지 (트랜잭션 안에서 시험하고 되돌린다)
-- ------------------------------------------------------------------
--   begin;
--     insert into auth.users (id, email) values (gen_random_uuid(), 'check@example.com');
--     select id, email, name, role from public.profiles where email = 'check@example.com';
--   rollback;
