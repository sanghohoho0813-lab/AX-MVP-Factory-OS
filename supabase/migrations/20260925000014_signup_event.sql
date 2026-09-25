-- 20260925000014_signup_event.sql  (D-106)
--
-- 목적: 홈페이지(고객 플랫폼, miraeailab.com)에서 누가 **회원가입**하면
--       내부 OS '잠재고객 상담신청' 에 한 줄이 뜨게 한다 (event_type = 'customer_signed_up').
--
-- 무엇을 하나
--   1. customer_events.event_type 이 받는 값에 'customer_signed_up' 하나를 더한다.
--      (허용 목록을 넓히기만 — 이미 있는 행 · 값은 전부 그대로 유효하다. 행을 지우거나 바꾸지 않는다.)
--   2. auth.users 에 가입 후 트리거 하나를 더 건다: zzz_bridge_on_auth_user_created
--      - 이름을 'zzz_' 로 시작해 기존 두 가입 트리거(내부 on_auth_user_created → 공개 사이트 zz_mirae_…)
--        **뒤에** 돈다. 그래서 공개 사이트가 profiles 에 채운 이름 · 연락처 · 회사를 읽을 수 있다.
--      - **이 트리거가 어떤 이유로 실패해도 회원가입은 절대 막지 않는다** (안에서 오류를 삼키고 경고만 남긴다).
--        2026-09-03 장애(가입 트리거 하나가 죽어서 모든 가입이 롤백됨, 0009 참고)를 되풀이하지 않기 위해서다.
--      - 내부 OS 가입 화면으로 만든 직원 계정은 건너뛴다(가입 정보에 signup_app='internal_os' 또는 display_name).
--
-- 원칙: 추가만(함수 1 · 트리거 1 · 허용 값 1). 표 · 열 · 정책 삭제 없음. 멱등(여러 번 실행해도 같다).
-- 되돌리기: drop trigger zzz_bridge_on_auth_user_created on auth.users;  (허용 값은 남겨 둬도 무해)

begin;

-- 1) 허용 값 넓히기 — 이름이 자동으로 붙은 event_type 검사를 찾아 같은 이름으로 다시 건다
do $$
declare
  r record;
begin
  for r in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace ns on ns.oid = rel.relnamespace
    where ns.nspname = 'public'
      and rel.relname = 'customer_events'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%event_type%'
  loop
    execute format('alter table public.customer_events drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.customer_events
  add constraint customer_events_event_type_check
  check (event_type in (
    'diagnosis_completed', 'consultation_requested', 'service_order_created',
    'document_uploaded', 'customer_request_created', 'customer_action_completed',
    'customer_reply', 'profile_updated',
    'customer_signed_up'
  ));

-- 2) 가입 후 알림
create or replace function public.bridge_on_auth_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meta    jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_prof    jsonb;
  v_profile uuid;
begin
  -- 내부 OS 직원 가입은 상담신청이 아니다
  if v_meta ->> 'signup_app' = 'internal_os' or v_meta ? 'display_name' then
    return new;
  end if;

  begin
    -- 공개 사이트 스키마(name · phone · organization)든 내부 스키마든 있는 칸만 읽는다
    select to_jsonb(p) into v_prof from public.profiles p where p.id = new.id;
    if v_prof is not null then
      v_profile := new.id;
    end if;

    perform public.bridge_emit_customer_event(
      'customer_signed_up',
      'auth_signup',
      new.id::text,
      jsonb_strip_nulls(jsonb_build_object(
        'name',         nullif(trim(coalesce(v_prof ->> 'name', v_meta ->> 'name', v_meta ->> 'full_name', '')), ''),
        'email',        new.email,
        'phone',        nullif(trim(coalesce(v_prof ->> 'phone', v_meta ->> 'phone', '')), ''),
        'company_name', nullif(trim(coalesce(v_prof ->> 'organization', v_prof ->> 'company', v_meta ->> 'organization', v_meta ->> 'company', '')), ''),
        'signup_source', 'miraeailab.com'
      )),
      'medium',
      v_profile,
      null,
      coalesce(new.created_at, now())
    );
  exception when others then
    -- 알림이 실패해도 가입은 그대로 — 원인만 로그에 남긴다
    raise warning 'bridge_on_auth_signup skipped for %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;
revoke all on function public.bridge_on_auth_signup() from public, anon, authenticated;

drop trigger if exists zzz_bridge_on_auth_user_created on auth.users;
create trigger zzz_bridge_on_auth_user_created
  after insert on auth.users
  for each row execute function public.bridge_on_auth_signup();

commit;
