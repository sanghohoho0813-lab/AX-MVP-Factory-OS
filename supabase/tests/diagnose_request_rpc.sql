-- =====================================================================
-- 진단 · "요청 보내기" 가 저장되지 않는 원인 가르기
-- ---------------------------------------------------------------------
-- 고객 권한으로 portal_create_request 를 실제로 호출해 본다.
--   · 성공하면  → DB·권한·트리거는 정상. 문제는 브라우저 쪽(전송이 안 된 것).
--   · 실패하면  → 그 자리에서 진짜 에러를 보여준다.
--
-- 시험 호출은 하위 트랜잭션 안에서 하고 되돌리므로 데이터가 남지 않는다.
-- 결과표를 그대로 복사해서 보내면 판독한다.
-- =====================================================================

drop table if exists _d;
create temp table _d (순 int, 항목 text, 값 text);

do $$
declare
  v_link uuid; v_cust uuid; v_req uuid;
  ok  boolean := false;
  ev  boolean := false;
  msg text; det text; hnt text; ctx text;
begin
  select id, profile_id into v_link, v_cust
    from public.portal_client_links
   where operations_client_id = 'cli_roundtrip_check' limit 1;

  if v_link is null then
    insert into _d values (0, '오류', 'roundtrip_1_setup.sql 을 먼저 실행하세요');
    return;
  end if;

  -- 앱이 호출하는 것과 같은 권한·같은 함수·같은 인자로 시험한다.
  -- 성공하든 실패하든 이 하위 블록은 되돌아가므로 흔적이 남지 않는다.
  begin
    perform set_config('request.jwt.claim.sub', v_cust::text, true);
    perform set_config('request.jwt.claim.role', 'authenticated', true);
    set local role authenticated;

    select public.portal_create_request(
             v_link, 'status', '벤처인증 진행 상황이 궁금합니다', '접수까지 얼마나 걸릴까요?')
      into v_req;

    -- 이벤트 확인은 반드시 역할을 되돌린 뒤에 한다.
    -- authenticated 인 채로 customer_events 를 읽으면 RLS 에 가려 0건으로 보인다.
    reset role;
    ev := exists (select 1 from public.customer_events
                   where source_type = 'portal_request' and source_id = v_req::text);
    ok := v_req is not null;

    raise exception 'DIAG_ROLLBACK';   -- 여기까지 온 것을 되돌린다
  exception when others then
    begin reset role; exception when others then null; end;
    get stacked diagnostics
      msg = message_text, det = pg_exception_detail,
      hnt = pg_exception_hint, ctx = pg_exception_context;
    if msg <> 'DIAG_ROLLBACK' then
      ok := false;
    else
      msg := null;                     -- 정상 경로였다
    end if;
  end;

  -- PL/pgSQL 변수는 롤백돼도 유지되므로 여기서 결과를 기록한다
  insert into _d values (10, '대상 연결', v_link::text);
  insert into _d values (11, '대상 고객 계정',
    coalesce((select email from public.profiles where id = v_cust), '(없음)'));

  if ok then
    insert into _d values
      (20, '판정', '✅ DB 경로 정상 — 고객 권한으로 요청이 만들어졌다'),
      (21, '트리거', case when ev then '✅ 이벤트도 함께 생성됐다' else '❌ 요청은 됐는데 이벤트가 안 생겼다' end),
      (22, '결론', '브라우저에서 전송이 안 된 것이다. 고객 화면에서 다시 보내고, 입력칸 아래 빨간 문구를 확인하세요.'),
      (23, '뒷정리', '시험 요청은 되돌렸다 — 데이터 안 남음');
  else
    insert into _d values
      (20, '판정',   '❌ DB 경로에서 실패한다 — 브라우저 문제가 아니다'),
      (21, '에러',   coalesce(msg, '(알 수 없음)')),
      (22, 'detail', coalesce(det, '-')),
      (23, 'hint',   coalesce(hnt, '-')),
      (24, '위치',   coalesce(split_part(ctx, E'\n', 1), '-'));
  end if;

  insert into _d values
    (30, '참고 · 함수 존재',
         case when to_regprocedure('public.portal_create_request(uuid,text,text,text)') is not null
              then '✅ 있음' else '❌ 없음' end),
    (31, '참고 · authenticated 실행권한',
         case when has_function_privilege('authenticated',
                to_regprocedure('public.portal_create_request(uuid,text,text,text)')::oid, 'execute')
              then '✅ 있음' else '❌ 없음 — 이러면 앱이 호출하지 못한다' end),
    (32, '참고', '서류 업로드는 이미 성공했으므로 로그인·연결·트리거 기반은 정상이다');
end $$;

-- =====================================================================
-- 결과 — 이 표 하나만 복사해서 보내면 된다
-- =====================================================================
select 항목, 값 from _d order by 순;
