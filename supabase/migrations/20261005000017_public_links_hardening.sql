-- =====================================================================
-- D-151 공개 링크 단단히 — 설문 · 시험 링크 · 지원사업 알림 신청
--
-- 원칙: 추가만. 표 · 열 · 정책을 지우거나 이름을 바꾸지 않는다. RLS 를 끄지 않는다.
--   - 공개 함수 다섯 개를 같은 이름으로 다시 만든다(create or replace) — 바뀐 곳은 'D-151' 주석
--   - 표 하나(public_intake_log)를 더한다: 신청 횟수를 세는 해시만 담는다(원문 없음 · 앱에서 못 읽음)
-- 여러 번 실행해도 같은 결과(멱등).
--
-- 막는 것
--   1. 설문 링크 — 만료 시각(expiresAt)이 지나도 열리고 답을 받았다(화면만 막고 서버는 안 막음).
--      제출한 설문도 링크만 있으면 다시 열어 답을 덮어쓸 수 있었다.
--   2. 시험(로컬 테스트) 링크 — 마친 뒤에도 피드백을 다시 내 덮어쓸 수 있었다 · 만료 시각을 안 봤다.
--   3. 지원사업 알림 신청 — 10분에 30번이 '전체' 기준이라, 한 사람이 30번 누르면 10분 동안 아무도 신청 못 했다.
--      이제 접속 주소마다 10분에 5번 · 같은 연락처 + 같은 회사는 하루에 한 번만 상담신청함에 들어간다.
--      전체 기준은 10분에 300번으로 올려 마지막 둑으로만 둔다(D-152 고침 — 이미 실행했어도 이 파일을 다시 실행하면 된다).
-- 운영 DB 에는 대표가 Supabase SQL Editor 에서 이 파일을 한 번 실행해야 켜진다.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. 만료 시각 읽기(읽을 수 없는 값은 '만료 아님') · 신청 횟수 기록 표
-- ---------------------------------------------------------------------
create or replace function public.public_link_expired(p jsonb)
returns boolean
language plpgsql
stable
set search_path = public
as $$
declare
  v text := nullif(btrim(coalesce(p ->> 'expiresAt', '')), '');
begin
  if v is null then
    return false;
  end if;
  return v::timestamptz < now();
exception when others then
  return false;
end;
$$;
revoke all on function public.public_link_expired(jsonb) from public, anon, authenticated;

create table if not exists public.public_intake_log (
  id bigint generated always as identity primary key,
  kind text not null,
  key_hash text not null,
  at timestamptz not null default now()
);
create index if not exists public_intake_log_kind_key_at_idx on public.public_intake_log (kind, key_hash, at desc);
alter table public.public_intake_log enable row level security;
revoke all on table public.public_intake_log from public, anon, authenticated;
-- 정책 없음: 앱 · 고객은 이 표를 읽거나 쓰지 못한다(아래 security definer 함수만 쓴다)


-- ---------------------------------------------------------------------
-- 1. 설문 링크
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
  -- D-151: 이미 낸 설문 · 만료 시각이 지난 설문은 열리지 않는다
  if dist.status = 'submitted' or coalesce(p ->> 'status', '') = 'submitted' then
    return jsonb_build_object('distributionId', dist.id, 'status', 'submitted', 'available', false);
  end if;
  if public.public_link_expired(p) then
    return jsonb_build_object('distributionId', dist.id, 'status', 'expired', 'available', false);
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
  -- D-151: 제출한 뒤에는 링크로 다시 고치지 못한다 · 만료 시각이 지나면 받지 않는다
  if dist.status = 'submitted' or coalesce(dist.payload ->> 'status', '') = 'submitted' then
    raise exception '이미 제출된 설문입니다.' using errcode = 'P0001';
  end if;
  if public.public_link_expired(dist.payload) then
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
-- 2. 시험(로컬 테스트) 링크
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
  -- D-151: 마친 시험 · 만료 시각이 지난 시험은 열리지 않는다
  if coalesce(p ->> 'status', '') = 'completed' or public.public_link_expired(p) then
    return jsonb_build_object('sessionId', sess.id, 'status', case when coalesce(p ->> 'status', '') = 'completed' then 'completed' else 'expired' end, 'available', false);
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
  -- D-151: 마친 뒤에는 다시 내지 못한다 · 만료 시각이 지나면 받지 않는다
  if sess.status = 'completed' or coalesce(sess.payload ->> 'status', '') = 'completed' then
    raise exception '이미 마친 테스트입니다.' using errcode = 'P0001';
  end if;
  if public.public_link_expired(sess.payload) then
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
-- 3. 지원사업 알림 신청
-- ---------------------------------------------------------------------
create or replace function public.portal_grant_alert_request(p_payload jsonb)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_company text;
  v_phone   text;
  v_email   text;
  v_titles  jsonb;
  v_safe    jsonb;
  v_ws      uuid;
  v_ip      text;
  v_contact text;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or length(p_payload::text) > 8000 then
    raise exception 'invalid payload' using errcode = '22023';
  end if;
  if coalesce(p_payload->>'consent', 'false') <> 'true' then
    raise exception 'consent required' using errcode = '22023';
  end if;

  v_company := left(btrim(coalesce(p_payload->>'company_name', '')), 60);
  v_phone   := left(btrim(coalesce(p_payload->>'phone', '')), 30);
  v_email   := left(btrim(coalesce(p_payload->>'email', '')), 80);
  if v_company = '' then
    raise exception 'company required' using errcode = '22023';
  end if;
  if v_phone = '' and v_email = '' then
    raise exception 'contact required' using errcode = '22023';
  end if;
  if v_phone <> '' and v_phone !~ '^[0-9+() -]{8,20}$' then
    raise exception 'invalid phone' using errcode = '22023';
  end if;

  v_ws := public.default_intake_workspace();
  if v_ws is null then
    return false; -- 받을 워크스페이스가 없는 환경(설정 전)
  end if;
  -- D-152: 전체 기준은 크게(10분에 300번) — 넘쳐도 서버가 버티게 하는 마지막 둑. 한 사람은 아래 주소별 제한(5번)에서 막힌다
  if (select count(*) from public.customer_events e
       where e.workspace_id = v_ws and e.source_type = 'grant_finder'
         and e.received_at > now() - interval '10 minutes') >= 300 then
    raise exception 'too many requests' using errcode = '54000';
  end if;

  -- D-151: 한 곳(접속 주소)에서 10분에 5번까지 — 한 사람이 장난으로 막아 다른 사람 신청이 막히지 않게.
  --        같은 연락처는 하루에 한 번만 상담신청함에 들어간다(다시 눌러도 '접수됨').
  --        주소 · 연락처 원문은 남기지 않고 해시만 남긴다.
  --        접속 주소는 앞단(Cloudflare)이 넣는 cf-connecting-ip 를 먼저 — x-forwarded-for 맨 앞은 보내는 쪽이 꾸밀 수 있다
  v_ip := btrim(split_part(coalesce(
            nullif(current_setting('request.headers', true), '')::jsonb ->> 'cf-connecting-ip',
            nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-forwarded-for',
            nullif(current_setting('request.headers', true), '')::jsonb ->> 'x-real-ip', ''), ',', 1));
  if v_ip <> '' then
    if (select count(*) from public.public_intake_log g
         where g.kind = 'grant_alert_ip' and g.key_hash = public.hash_access_token(v_ip)
           and g.at > now() - interval '10 minutes') >= 5 then
      raise exception 'too many requests' using errcode = '54000';
    end if;
    insert into public.public_intake_log (kind, key_hash) values ('grant_alert_ip', public.hash_access_token(v_ip));
  end if;
  -- D-152: 같은 연락처라도 회사가 다르면 따로 받는다(컨설턴트 한 사람이 여러 회사를 넣는 경우)
  v_contact := lower(coalesce(nullif(regexp_replace(v_phone, '[^0-9]', '', 'g'), ''), v_email)) || '|' || lower(regexp_replace(v_company, '\s', '', 'g'));
  if exists (select 1 from public.public_intake_log g
              where g.kind = 'grant_alert_contact' and g.key_hash = public.hash_access_token(v_contact)
                and g.at > now() - interval '1 day') then
    return true;
  end if;
  insert into public.public_intake_log (kind, key_hash) values ('grant_alert_contact', public.hash_access_token(v_contact));

  v_titles := case
    when jsonb_typeof(p_payload->'grant_titles') = 'array'
      then (select coalesce(jsonb_agg(left(t, 80)), '[]'::jsonb)
              from (select jsonb_array_elements_text(p_payload->'grant_titles') as t limit 5) s)
    else '[]'::jsonb
  end;

  v_safe := jsonb_build_object(
    'company_name', v_company,
    'representative_name', left(btrim(coalesce(p_payload->>'representative_name', '')), 30),
    'phone', v_phone,
    'email', v_email,
    'industry', left(btrim(coalesce(p_payload->>'industry', '')), 40),
    'program', '지원사업 알림',
    'message', left(coalesce(p_payload->>'message', ''), 300),
    'grant_query', left(coalesce(p_payload->>'grant_query', ''), 500),
    'grant_titles', v_titles,
    'grant_fit_count', case when coalesce(p_payload->>'grant_fit_count', '') ~ '^\d{1,4}$' then (p_payload->>'grant_fit_count')::int else 0 end,
    'referrer_code', left(coalesce(p_payload->>'referrer_code', ''), 40),
    'consent', true
  );

  perform public.bridge_emit_customer_event(
    'consultation_requested',
    'grant_finder',
    gen_random_uuid()::text,
    v_safe,
    'high',
    (select p.id from public.profiles p where p.id = auth.uid()), -- 로그인한 고객이면 그 계정, 아니면 비움
    null,
    now()
  );
  return true;
end;
$$;

-- 권한은 예전과 같게(다시 만들어도 바뀌지 않지만 분명히 적어 둔다)
revoke execute on function public.get_public_survey(text) from public;
revoke execute on function public.submit_public_survey_response(text, jsonb, boolean) from public;
revoke execute on function public.get_public_test_session(text) from public;
revoke execute on function public.submit_public_test_feedback(text, jsonb, boolean) from public;
grant execute on function public.get_public_survey(text) to anon, authenticated;
grant execute on function public.submit_public_survey_response(text, jsonb, boolean) to anon, authenticated;
grant execute on function public.get_public_test_session(text) to anon, authenticated;
grant execute on function public.submit_public_test_feedback(text, jsonb, boolean) to anon, authenticated;
revoke all on function public.portal_grant_alert_request(jsonb) from public;
grant execute on function public.portal_grant_alert_request(jsonb) to anon, authenticated;
