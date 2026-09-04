-- =====================================================================
-- 진단 · "Failed to create user: Database error creating new user"
-- ---------------------------------------------------------------------
-- Supabase 는 auth.users 에 걸린 트리거가 실패하면 이 문구만 보여주고
-- 진짜 원인을 감춘다. 이 스크립트가 그 원인을 꺼낸다.
--
-- 읽기 전용이다. D 단계에서 시험 삽입을 하지만 곧바로 되돌린다.
-- 결과를 그대로 복사해서 보내면 판독한다.
-- =====================================================================

-- ---------------------------------------------------------------------
-- A. auth.users 에 걸린 트리거 (여기 있는 함수 중 하나가 실패하고 있다)
-- ---------------------------------------------------------------------
select '--- A. auth.users 트리거 ---' as 구분;
select t.tgname as 트리거,
       p.proname as 함수,
       case when t.tgenabled = 'D' then '꺼짐' else '켜짐' end as 상태
  from pg_trigger t
  join pg_proc p on p.oid = t.tgfoid
 where t.tgrelid = 'auth.users'::regclass
   and not t.tgisinternal
 order by t.tgname;

-- ---------------------------------------------------------------------
-- B. profiles 의 실제 컬럼과 NOT NULL 여부
--    트리거 함수가 넣는 컬럼과 어긋나면 여기서 드러난다
-- ---------------------------------------------------------------------
select '--- B. public.profiles 컬럼 ---' as 구분;
select ordinal_position as 순, column_name as 컬럼, data_type as 타입,
       is_nullable as "NULL허용", coalesce(column_default, '-') as 기본값
  from information_schema.columns
 where table_schema = 'public' and table_name = 'profiles'
 order by ordinal_position;

select '--- B2. public.profiles 제약 ---' as 구분;
select conname as 제약, pg_get_constraintdef(oid) as 정의
  from pg_constraint
 where conrelid = 'public.profiles'::regclass
 order by conname;

-- ---------------------------------------------------------------------
-- C. 트리거 함수 원본 (컬럼 목록을 B 와 비교한다)
-- ---------------------------------------------------------------------
select '--- C. handle_new_user 원본 ---' as 구분;
select pg_get_functiondef(p.oid) as 정의
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public' and p.proname = 'handle_new_user';

-- ---------------------------------------------------------------------
-- D. 진짜 에러 재현 — 트리거가 하는 삽입을 그대로 시도하고 되돌린다
-- ---------------------------------------------------------------------
select '--- D. 재현 결과 ---' as 구분;
do $$
declare
  v_id  uuid := gen_random_uuid();
  v_mail text := 'diag-' || substr(v_id::text, 1, 8) || '@example.com';
  msg text; det text; hnt text; ctx text;
begin
  begin
    -- 실제 계정 생성과 같은 경로: auth.users 삽입 → handle_new_user 트리거 발화
    insert into auth.users (id, email) values (v_id, v_mail);
    raise notice '결과: ✅ 삽입 성공 — 트리거는 정상이다. 다른 원인을 봐야 한다.';
    raise exception 'DIAG_ROLLBACK';   -- 남기지 않고 되돌린다
  exception
    when others then
      get stacked diagnostics
        msg = message_text, det = pg_exception_detail,
        hnt = pg_exception_hint, ctx = pg_exception_context;
      if msg = 'DIAG_ROLLBACK' then
        raise notice '(시험 삽입은 되돌렸다 — 데이터 안 남음)';
      else
        raise notice '결과: ❌ 진짜 에러 → %', msg;
        raise notice '  detail : %', coalesce(det, '-');
        raise notice '  hint   : %', coalesce(hnt, '-');
        raise notice '  위치   : %', coalesce(split_part(ctx, E'\n', 1), '-');
      end if;
  end;
end $$;

-- ---------------------------------------------------------------------
-- E. 참고 — 브릿지 트리거는 이 경로와 무관하다는 확인
--    (우리 트리거는 아래 6개 테이블에만 걸려 있고 auth.users/profiles 에는 없다)
-- ---------------------------------------------------------------------
select '--- E. 브릿지 트리거가 걸린 테이블 ---' as 구분;
select distinct c.relname as 테이블, t.tgname as 트리거
  from pg_trigger t join pg_class c on c.oid = t.tgrelid
 where t.tgname like 'trg_bridge%'
 order by 1, 2;
