-- =====================================================================
-- 운영 DB 점검 — 0026 ~ 0031 여섯 개가 들어가 있는지 한 장으로(D-662)
-- **읽기만** 한다(맨 위 `set transaction read only` + SELECT 한 문장). 넣기 전에도 · 넣은 뒤에도 몇 번이든 실행해도 된다.
-- 이 파일은 `node scripts/make-ops-bundle.mjs` 가 만든다(마이그레이션이 만드는 표 · 함수 이름을 그대로 센다).
-- 사용: Supabase SQL Editor 에 이 파일을 **통째로** 붙여 넣고 실행.
-- 결과: 여섯 줄(번호 | 무엇 | 있는 것 | 결과) — '없음'(아직) · '들어감'(끝) · '일부만'(있을 수 없는 상태 — 묶음을 다시 통째로 실행).
-- 되돌린 것(rollback_00NN — 권한만 거둠)은 이 표에서 '들어감' 으로 보인다. 그것까지 가르려면 check_applied_0026_0028 · 0029 · 0030 · 0031.sql.
-- =====================================================================
set transaction read only;

with fn(name) as (
  select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'
), part(no, what, ok) as (
  values
  ('0026', '대표가 팀장 화면을 볼 때 고객 자료는 팀장 허락 동안만', to_regclass('public.workspace_view_grants') is not null),
  ('0026', '대표가 팀장 화면을 볼 때 고객 자료는 팀장 허락 동안만', to_regclass('public.workspace_view_requests') is not null),
  ('0026', '대표가 팀장 화면을 볼 때 고객 자료는 팀장 허락 동안만', exists (select 1 from fn where name = 'view_consent_blocked_workspaces')),
  ('0026', '대표가 팀장 화면을 볼 때 고객 자료는 팀장 허락 동안만', exists (select 1 from fn where name = 'view_consent_ok')),
  ('0026', '대표가 팀장 화면을 볼 때 고객 자료는 팀장 허락 동안만', exists (select 1 from fn where name = 'view_consent_person')),
  ('0026', '대표가 팀장 화면을 볼 때 고객 자료는 팀장 허락 동안만', exists (select 1 from fn where name = 'view_consent_state')),
  ('0026', '대표가 팀장 화면을 볼 때 고객 자료는 팀장 허락 동안만', exists (select 1 from fn where name = 'view_consent_grant')),
  ('0026', '대표가 팀장 화면을 볼 때 고객 자료는 팀장 허락 동안만', exists (select 1 from fn where name = 'view_consent_revoke')),
  ('0026', '대표가 팀장 화면을 볼 때 고객 자료는 팀장 허락 동안만', exists (select 1 from fn where name = 'view_consent_request')),
  ('0026', '대표가 팀장 화면을 볼 때 고객 자료는 팀장 허락 동안만', exists (select 1 from fn where name = 'view_consent_decline')),
  ('0027', '고객(컨설턴트)마다 상담 신청 링크', to_regclass('public.public_intake_links') is not null),
  ('0027', '고객(컨설턴트)마다 상담 신청 링크', exists (select 1 from fn where name = 'intake_link_state')),
  ('0027', '고객(컨설턴트)마다 상담 신청 링크', exists (select 1 from fn where name = 'intake_link_owner_check')),
  ('0027', '고객(컨설턴트)마다 상담 신청 링크', exists (select 1 from fn where name = 'intake_link_save')),
  ('0027', '고객(컨설턴트)마다 상담 신청 링크', exists (select 1 from fn where name = 'intake_link_rotate')),
  ('0027', '고객(컨설턴트)마다 상담 신청 링크', exists (select 1 from fn where name = 'intake_link_off')),
  ('0027', '고객(컨설턴트)마다 상담 신청 링크', exists (select 1 from fn where name = 'public_intake_form')),
  ('0027', '고객(컨설턴트)마다 상담 신청 링크', exists (select 1 from fn where name = 'public_intake_submit')),
  ('0028', '가입하면 바로 쓰기(꺼진 채로 들어간다)', to_regclass('public.self_signup_policy') is not null),
  ('0028', '가입하면 바로 쓰기(꺼진 채로 들어간다)', to_regclass('public.self_signup_accounts') is not null),
  ('0028', '가입하면 바로 쓰기(꺼진 채로 들어간다)', exists (select 1 from fn where name = 'self_signup_seats_left')),
  ('0028', '가입하면 바로 쓰기(꺼진 채로 들어간다)', exists (select 1 from fn where name = 'self_signup_check')),
  ('0028', '가입하면 바로 쓰기(꺼진 채로 들어간다)', exists (select 1 from fn where name = 'signup_open')),
  ('0028', '가입하면 바로 쓰기(꺼진 채로 들어간다)', exists (select 1 from fn where name = 'self_signup_state')),
  ('0028', '가입하면 바로 쓰기(꺼진 채로 들어간다)', exists (select 1 from fn where name = 'self_signup_start')),
  ('0028', '가입하면 바로 쓰기(꺼진 채로 들어간다)', exists (select 1 from fn where name = 'self_signup_admin')),
  ('0028', '가입하면 바로 쓰기(꺼진 채로 들어간다)', exists (select 1 from fn where name = 'self_signup_admin_save')),
  ('0028', '가입하면 바로 쓰기(꺼진 채로 들어간다)', exists (select 1 from fn where name = 'self_signup_admin_list')),
  ('0029', '가입 신청 → 대표가 앱에서 승인 · 거절', to_regclass('public.signup_decisions') is not null),
  ('0029', '가입 신청 → 대표가 앱에서 승인 · 거절', exists (select 1 from fn where name = 'signup_request_check')),
  ('0029', '가입 신청 → 대표가 앱에서 승인 · 거절', exists (select 1 from fn where name = 'my_signup_status')),
  ('0029', '가입 신청 → 대표가 앱에서 승인 · 거절', exists (select 1 from fn where name = 'signup_requests')),
  ('0029', '가입 신청 → 대표가 앱에서 승인 · 거절', exists (select 1 from fn where name = 'signup_requests_count')),
  ('0029', '가입 신청 → 대표가 앱에서 승인 · 거절', exists (select 1 from fn where name = 'signup_approve')),
  ('0029', '가입 신청 → 대표가 앱에서 승인 · 거절', exists (select 1 from fn where name = 'signup_reject')),
  ('0030', 'AI 답 보관(끊겨도 이어 받기)', to_regclass('public.ai_assist_results') is not null),
  ('0031', '서류 올리기 링크(업체 대표가 로그인 없이 휴대폰으로)', to_regclass('public.client_upload_links') is not null),
  ('0031', '서류 올리기 링크(업체 대표가 로그인 없이 휴대폰으로)', to_regclass('public.client_upload_files') is not null),
  ('0031', '서류 올리기 링크(업체 대표가 로그인 없이 휴대폰으로)', exists (select 1 from fn where name = 'upload_link_access_check')),
  ('0031', '서류 올리기 링크(업체 대표가 로그인 없이 휴대폰으로)', exists (select 1 from fn where name = 'upload_link_state')),
  ('0031', '서류 올리기 링크(업체 대표가 로그인 없이 휴대폰으로)', exists (select 1 from fn where name = 'upload_link_clean_docs')),
  ('0031', '서류 올리기 링크(업체 대표가 로그인 없이 휴대폰으로)', exists (select 1 from fn where name = 'upload_link_save')),
  ('0031', '서류 올리기 링크(업체 대표가 로그인 없이 휴대폰으로)', exists (select 1 from fn where name = 'upload_link_rotate')),
  ('0031', '서류 올리기 링크(업체 대표가 로그인 없이 휴대폰으로)', exists (select 1 from fn where name = 'upload_link_off')),
  ('0031', '서류 올리기 링크(업체 대표가 로그인 없이 휴대폰으로)', exists (select 1 from fn where name = 'upload_link_decide')),
  ('0031', '서류 올리기 링크(업체 대표가 로그인 없이 휴대폰으로)', exists (select 1 from fn where name = 'upload_link_inbox')),
  ('0031', '서류 올리기 링크(업체 대표가 로그인 없이 휴대폰으로)', exists (select 1 from fn where name = 'upload_link_open')),
  ('0031', '서류 올리기 링크(업체 대표가 로그인 없이 휴대폰으로)', exists (select 1 from fn where name = 'public_upload_form')),
  ('0031', '서류 올리기 링크(업체 대표가 로그인 없이 휴대폰으로)', exists (select 1 from fn where name = 'public_upload_reserve')),
  ('0031', '서류 올리기 링크(업체 대표가 로그인 없이 휴대폰으로)', exists (select 1 from fn where name = 'upload_link_path_ok')),
  ('0031', '서류 올리기 링크(업체 대표가 로그인 없이 휴대폰으로)', exists (select 1 from fn where name = 'public_upload_done'))
)
select no as 번호, what as 무엇, count(*) filter (where ok) || '/' || count(*) as 있는_것,
       case when bool_and(ok) then '들어감' when bool_or(ok) then '일부만' else '없음' end as 결과
from part group by no, what order by no;
