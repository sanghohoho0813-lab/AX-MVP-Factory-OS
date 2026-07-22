-- =====================================================================
-- Stage 12A · 공개 토큰 RPC (설문 응답 / 로컬 테스트 피드백)
-- ---------------------------------------------------------------------
-- 보안 원칙:
--   * 토큰 원문은 DB 에 저장하지 않는다. 조회는 sha256 해시 비교로만 한다.
--   * 함수는 SECURITY DEFINER 로 RLS 를 우회하되, 반드시 토큰이 가리키는
--     "그 한 행" 과 그 워크스페이스 범위 안에서만 동작한다.
--   * 호출자가 workspace_id / 내부 id 를 임의로 넘길 수 없다.
--   * 공개 토큰으로 내부 데이터·다른 워크스페이스 데이터를 열람할 수 없다.
--   * 응답에 내부 분석 데이터를 포함하지 않는다(설문 렌더링에 필요한 필드만).
-- =====================================================================

-- 토큰 → 해시 (클라이언트도 동일하게 계산해 저장 시 hash 만 넣는다)
create or replace function public.hash_access_token(token text)
returns text
language sql
immutable
set search_path = public
as $$
  select encode(extensions.digest(coalesce(token, ''), 'sha256'), 'hex');
$$;

-- ---------------------------------------------------------------------
-- 공개 설문 조회: 렌더링에 필요한 필드만 반환
-- ---------------------------------------------------------------------
create or replace function public.get_public_survey(survey_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  dist public.survey_distributions;
  p jsonb;
begin
  select * into dist
  from public.survey_distributions
  where access_token_hash = public.hash_access_token(survey_token)
  limit 1;

  if dist.id is null then
    return null;
  end if;

  p := dist.payload;

  -- 만료/취소 상태는 그대로 알려주되 내용은 제한
  if dist.status in ('revoked', 'expired') or coalesce(p ->> 'status', dist.status) in ('revoked', 'expired') then
    return jsonb_build_object(
      'distributionId', dist.id,
      'status', coalesce(p ->> 'status', dist.status),
      'available', false
    );
  end if;

  -- 첫 열람 시각 기록 (공개 함수지만 자기 행만 갱신)
  update public.survey_distributions
  set payload = jsonb_set(
        jsonb_set(payload, '{status}',
          to_jsonb(case when coalesce(payload ->> 'status', 'issued') in ('draft','issued') then 'opened' else payload ->> 'status' end)),
        '{firstOpenedAt}',
        coalesce(payload -> 'firstOpenedAt', to_jsonb(now())))
  where id = dist.id;

  -- 렌더링에 필요한 화이트리스트 필드만 반환 (내부 분석/타 도메인 미포함)
  return jsonb_build_object(
    'distributionId', dist.id,
    'available', true,
    'status', coalesce(p ->> 'status', dist.status),
    'surveyTitle', p -> 'surveyTitle',
    'respondentRole', p -> 'respondentRole',
    'blueprintSnapshot', p -> 'blueprintSnapshot',
    'introMessage', p -> 'introMessage',
    'privacyNotice', p -> 'privacyNotice',
    'consentRequired', p -> 'consentRequired',
    'recipientName', p -> 'recipientName',
    'recipientPosition', p -> 'recipientPosition',
    'expiresAt', p -> 'expiresAt'
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 공개 설문 응답 제출/저장 (distribution 당 1건, upsert)
-- ---------------------------------------------------------------------
create or replace function public.submit_public_survey_response(
  survey_token text,
  response_payload jsonb,
  is_final boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  dist public.survey_distributions;
  existing public.survey_responses;
  new_id uuid;
  merged jsonb;
begin
  select * into dist
  from public.survey_distributions
  where access_token_hash = public.hash_access_token(survey_token)
  limit 1;

  if dist.id is null then
    raise exception '설문을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;
  if dist.status in ('revoked', 'expired')
     or coalesce(dist.payload ->> 'status', dist.status) in ('revoked', 'expired') then
    raise exception '만료되었거나 취소된 설문입니다.' using errcode = 'P0001';
  end if;

  -- 호출자가 넘긴 payload 에서 내부 식별자를 신뢰하지 않고 서버가 강제로 채운다.
  merged := coalesce(response_payload, '{}'::jsonb)
    || jsonb_build_object(
      'distributionId', dist.id,
      'projectId', dist.project_id,
      'status', case when is_final then 'submitted' else 'in_progress' end
    );

  select * into existing from public.survey_responses
  where distribution_id = dist.id limit 1;

  if existing.id is null then
    insert into public.survey_responses (workspace_id, distribution_id, project_id, payload)
    values (dist.workspace_id, dist.id, dist.project_id, merged)
    returning id into new_id;
  else
    update public.survey_responses
    set payload = merged
    where id = existing.id
    returning id into new_id;
  end if;

  if is_final then
    update public.survey_distributions
    set payload = jsonb_set(
          jsonb_set(payload, '{status}', '"submitted"'),
          '{submittedAt}', to_jsonb(now()))
    where id = dist.id;
  end if;

  return jsonb_build_object('responseId', new_id, 'status', merged ->> 'status');
end;
$$;

-- ---------------------------------------------------------------------
-- 공개 로컬 테스트 세션 조회
-- ---------------------------------------------------------------------
create or replace function public.get_public_test_session(test_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sess public.validation_test_sessions;
  p jsonb;
begin
  select * into sess
  from public.validation_test_sessions
  where access_token_hash = public.hash_access_token(test_token)
  limit 1;

  if sess.id is null then
    return null;
  end if;

  p := sess.payload;

  if sess.status in ('revoked', 'completed', 'expired')
     or coalesce(p ->> 'status', sess.status) in ('revoked', 'expired') then
    return jsonb_build_object('sessionId', sess.id, 'status', coalesce(p ->> 'status', sess.status), 'available', false);
  end if;

  return jsonb_build_object(
    'sessionId', sess.id,
    'available', true,
    'status', coalesce(p ->> 'status', sess.status),
    'title', p -> 'title',
    'instructions', p -> 'instructions',
    'scenario', p -> 'scenario',
    'tasks', p -> 'tasks',
    'questions', p -> 'questions',
    'expiresAt', p -> 'expiresAt'
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 공개 로컬 테스트 피드백 제출
-- ---------------------------------------------------------------------
create or replace function public.submit_public_test_feedback(
  test_token text,
  feedback_payload jsonb,
  is_final boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sess public.validation_test_sessions;
  merged jsonb;
begin
  select * into sess
  from public.validation_test_sessions
  where access_token_hash = public.hash_access_token(test_token)
  limit 1;

  if sess.id is null then
    raise exception '테스트 세션을 찾을 수 없습니다.' using errcode = 'P0002';
  end if;
  if sess.status in ('revoked', 'expired')
     or coalesce(sess.payload ->> 'status', sess.status) in ('revoked', 'expired') then
    raise exception '만료되었거나 취소된 테스트입니다.' using errcode = 'P0001';
  end if;

  merged := coalesce(sess.payload, '{}'::jsonb)
    || jsonb_build_object('feedback', coalesce(feedback_payload, '{}'::jsonb));
  if is_final then
    merged := jsonb_set(merged, '{status}', '"completed"');
  end if;

  update public.validation_test_sessions
  set payload = merged,
      status = case when is_final then 'completed' else status end
  where id = sess.id;

  return jsonb_build_object('sessionId', sess.id, 'status', merged ->> 'status');
end;
$$;

-- ---------------------------------------------------------------------
-- 권한: 공개 함수만 anon 에 노출. 나머지 테이블/함수는 anon 접근 불가.
-- ---------------------------------------------------------------------
revoke execute on function public.get_public_survey(text) from public;
revoke execute on function public.submit_public_survey_response(text, jsonb, boolean) from public;
revoke execute on function public.get_public_test_session(text) from public;
revoke execute on function public.submit_public_test_feedback(text, jsonb, boolean) from public;
revoke execute on function public.hash_access_token(text) from public;

grant execute on function public.get_public_survey(text) to anon, authenticated;
grant execute on function public.submit_public_survey_response(text, jsonb, boolean) to anon, authenticated;
grant execute on function public.get_public_test_session(text) to anon, authenticated;
grant execute on function public.submit_public_test_feedback(text, jsonb, boolean) to anon, authenticated;

-- 인증 사용자 전용 워크스페이스 부트스트랩 RPC
revoke execute on function public.create_workspace(text, text) from public;
revoke execute on function public.accept_workspace_invite(text) from public;
grant execute on function public.create_workspace(text, text) to authenticated;
grant execute on function public.accept_workspace_invite(text) to authenticated;
