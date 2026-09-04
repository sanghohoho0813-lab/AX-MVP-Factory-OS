-- =====================================================================
-- 진단 · "Failed to create user: Database error creating new user"
-- ---------------------------------------------------------------------
-- Supabase 는 auth.users 에 걸린 트리거가 실패하면 저 문구만 보여주고
-- 진짜 원인을 감춘다. 이 스크립트가 그 원인을 꺼낸다.
--
-- SQL Editor 는 "마지막 쿼리 결과" 하나만 보여주므로,
-- 모든 진단 결과를 표 하나에 모아서 마지막에 한 번에 출력한다.
-- (NOTICE 로 찍지 않는다 — 화면에 안 보이기 때문)
--
-- 읽기 전용이다. D 단계에서 시험 삽입을 하지만 곧바로 되돌린다.
-- 결과표를 그대로 복사해서 보내면 판독한다.
-- =====================================================================

drop table if exists _diag;
create temp table _diag (순 int, 구분 text, 항목 text, 값 text);

-- ---------------------------------------------------------------------
-- A. auth.users 에 걸린 트리거 — 이 중 하나가 실패하고 있다
-- ---------------------------------------------------------------------
insert into _diag
select 10, 'A. auth.users 트리거', t.tgname,
       p.proname || case when t.tgenabled = 'D' then ' (꺼짐)' else '' end
  from pg_trigger t
  join pg_proc p on p.oid = t.tgfoid
 where t.tgrelid = 'auth.users'::regclass and not t.tgisinternal;

insert into _diag
select 11, 'A. auth.users 트리거', '(없음)', '트리거가 하나도 없다'
 where not exists (select 1 from pg_trigger
                    where tgrelid = 'auth.users'::regclass and not tgisinternal);

-- ---------------------------------------------------------------------
-- B. profiles 의 실제 컬럼 — 트리거가 넣는 컬럼과 어긋나면 여기서 드러난다
-- ---------------------------------------------------------------------
insert into _diag
select 20, 'B. profiles 실제 컬럼', column_name,
       data_type || ' · NULL' || (case when is_nullable = 'YES' then '허용' else '불가' end)
       || coalesce(' · 기본값=' || column_default, '')
  from information_schema.columns
 where table_schema = 'public' and table_name = 'profiles';

-- ---------------------------------------------------------------------
-- C. handle_new_user 가 profiles 에 넣으려는 컬럼 목록
--    B 와 나란히 놓고 비교한다
-- ---------------------------------------------------------------------
insert into _diag
select 30, 'C. 트리거가 넣는 컬럼', '함수 원본 ' || lpad(n::text, 2, '0') || '행', line
  from (
    select row_number() over () as n, line
      from pg_proc p
      join pg_namespace ns on ns.oid = p.pronamespace
      cross join lateral unnest(string_to_array(pg_get_functiondef(p.oid), E'\n')) as line
     where ns.nspname = 'public' and p.proname = 'handle_new_user'
  ) s
 where line ~* 'insert into|values|profiles|\m(name|phone|organization|role|member_type|display_name)\M';

insert into _diag
select 31, 'C. 트리거가 넣는 컬럼', '(없음)', 'handle_new_user 함수가 존재하지 않는다'
 where not exists (select 1 from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
                    where ns.nspname = 'public' and p.proname = 'handle_new_user');

-- ---------------------------------------------------------------------
-- D. 진짜 에러 재현 — 실제 계정 생성과 같은 경로로 넣어 보고 되돌린다
-- ---------------------------------------------------------------------
do $$
declare
  v_id   uuid := gen_random_uuid();
  v_mail text := 'diag-' || substr(v_id::text, 1, 8) || '@example.com';
  msg text; det text; hnt text; ctx text;
begin
  begin
    insert into auth.users (id, email) values (v_id, v_mail);
    insert into _diag values (40, 'D. 재현 결과', '판정', '✅ 삽입 성공 — 트리거는 정상. 원인이 다른 데 있다');
    raise exception 'DIAG_ROLLBACK';        -- 흔적을 남기지 않고 되돌린다
  exception
    when others then
      get stacked diagnostics
        msg = message_text, det = pg_exception_detail,
        hnt = pg_exception_hint, ctx = pg_exception_context;
      if msg <> 'DIAG_ROLLBACK' then
        insert into _diag values
          (40, 'D. 재현 결과', '판정',  '❌ 계정 생성이 실패한다'),
          (41, 'D. 재현 결과', '에러',   msg),
          (42, 'D. 재현 결과', 'detail', coalesce(det, '-')),
          (43, 'D. 재현 결과', 'hint',   coalesce(hnt, '-')),
          (44, 'D. 재현 결과', '위치',   coalesce(split_part(ctx, E'\n', 1), '-'));
      end if;
  end;
  -- 시험 삽입은 위 subtransaction 과 함께 되돌아갔다
  insert into _diag values (45, 'D. 재현 결과', '뒷정리', '시험 계정은 남기지 않았다');
end $$;

-- ---------------------------------------------------------------------
-- E. 브릿지 트리거 위치 — 계정 생성 경로와 무관함을 확인
-- ---------------------------------------------------------------------
insert into _diag
select 50, 'E. 브릿지 트리거', c.relname, t.tgname
  from pg_trigger t join pg_class c on c.oid = t.tgrelid
 where t.tgname like 'trg_bridge%';

insert into _diag
select 51, 'E. 브릿지 트리거', '판정',
       case when exists (
              select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid
               where t.tgname like 'trg_bridge%' and c.relname in ('users', 'profiles'))
            then '❌ 브릿지 트리거가 계정 경로에 걸려 있다'
            else '✅ 브릿지 트리거는 auth.users·profiles 에 없다 (이번 마이그레이션 무관)' end;

-- =====================================================================
-- 결과 — 이 표 하나만 복사해서 보내면 된다
-- =====================================================================
select 구분, 항목, 값 from _diag order by 순, 항목;
