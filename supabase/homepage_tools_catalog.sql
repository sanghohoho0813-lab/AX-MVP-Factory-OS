-- 홈페이지(고객 플랫폼) 도구 카탈로그 — 크레탑 분석기 정리 (D-89)
--
-- 사실 관계 (2026-09-22, 홈페이지 저장소 a12a543 에서 직접 확인)
--   - 홈페이지 `public.tools` 에 `cretop-analyzer` 한 줄이 있고, `external_url` 이
--     옛 배포본(corp-sales-os … /mini.html)을 가리킨다.
--     (supabase/schema.sql 231행, migrate-existing-cretop-mini.sql 273행)
--   - 그 주소는 **고객 화면에 그냥 노출되지는 않는다.** 홈페이지는 `external_url` 을
--     일부러 조회에서 빼고(src/lib/portal.ts 의 TRIAL_TOOL_COLUMNS),
--     권한을 확인한 뒤 `/api/trial` 의 open 으로만 건네준다.
--     → 따라서 이것은 '유출' 이 아니라 '오래된 배포본을 가리키는 카드' 다. 급한 일은 아니다.
--   - 같은 카드가 홈페이지 코드의 정적 목록(src/data/tools.ts 111~131행)에도 있다.
--     **카드를 화면에서 내리려면 DB 만으로는 안 되고 홈페이지 코드도 고쳐야 한다.**
--
-- 이 저장소에서 하지 않은 이유
--   - 운영 Supabase 접속 정보가 없다(이 저장소에는 키를 두지 않는다).
--   - 고객에게 보이는 것을 바꾸는 일이고, 홈페이지 저장소는 이번 작업 범위가 아니다.
--   - 그래서 **실행하지 않은 SQL** 로만 남긴다. 대표가 고르면 그때 돌린다.
--
-- 표를 지우거나 이름을 바꾸지 않는다. 한 줄의 값만 바꾸고, 되돌릴 수 있다.

-- 0) 지금 값 확인 — 먼저 이것만 실행하고 결과를 캡처해 둔다
select slug, title, status, access_type, is_public, is_trial_available, external_url
from public.tools
where slug = 'cretop-analyzer';

-- ── (A) 내부 전용으로 돌린다 — 권장 ─────────────────────────────────────────
-- 분석기는 2026-09-22 부터 운영 OS 안(/tools/cretop)에 있다. 이 도구는 컨설턴트가 쓰는 것이고,
-- 고객이 직접 돌릴 물건이 아니다. 신청 목록에서 빼고 비공개로 둔다.
--
-- update public.tools
--    set is_trial_available = false,   -- '내 도구함' 신청 목록에서 빠진다
--        is_public          = false,
--        status             = '내부 전용',
--        access_type        = 'private'
--  where slug = 'cretop-analyzer';
--
-- 함께 할 일 (홈페이지 저장소):
--   src/data/tools.ts 의 'cretop-analyzer' 항목을 지우거나 upcomingTools 로 옮긴다.
--   그러지 않으면 카탈로그 화면에는 카드가 그대로 남는다.

-- ── (B) 주소만 새 것으로 바꾼다 ────────────────────────────────────────────
-- 고객에게도 계속 열어 줄 생각이면 주소만 바꾼다.
-- 주의: 운영 OS(/tools/cretop)는 내부 로그인이 필요하다. 고객 계정으로는 열리지 않는다.
--       고객용으로 열려면 별도의 고객 화면을 먼저 만들어야 한다 — 지금은 없다.
--
-- update public.tools
--    set external_url = 'https://ax-mvp-factory-os.vercel.app/tools/cretop'
--  where slug = 'cretop-analyzer';

-- 되돌리기 (A 를 실행한 뒤 원래대로)
--
-- update public.tools
--    set is_trial_available = true,
--        is_public          = true,
--        status             = 'MVP 베타',
--        access_type        = 'beta'
--  where slug = 'cretop-analyzer';
