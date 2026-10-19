# 대표 AI 작업실 V1 — Company Case Intelligence

> 2026-10-14 · D-200 · 대표 전용(김상호 대표 계정 한 사람). 최은혜 팀장 화면에는 메뉴 · 탭 · 주소 · 데이터 · AI 호출 모두 없다.

이 시스템은 AI 답변을 많이 만드는 곳이 아니다. **대표가 업체에 대해 내린 판단이 사라지지 않게** 만드는 곳이다.
모든 화면과 저장 구조는 `생성 → 판단(채택 · 일부 채택 · 폐기) → 기록 → 재사용` 한 바퀴를 중심으로 짰다.

---

## 1. 왜 만들었나

- 동료 컨설턴트가 업체를 넘겨주면 ChatGPT 창을 새로 열고 같은 설명을 처음부터 다시 했다. 며칠 · 한 달 뒤 같은 업체를 다시 열면 지난번 AX 방향 · 특허 판단을 다시 설명해야 했다.
- 고객이 아닌 회사(한 번 검토 · 동료 요청 · 상담 예정 …)는 고객 관리에 넣을 곳이 없었다.
- 제안서는 이미지 생성으로 만들면 오타 하나에 전체를 다시 만들어야 했다.

V1 은 업체마다 **기억(Current Context)** 을 판(v1, v2 …)으로 쌓고, 대표가 **채택한 결과만** 다음 AI 작업에 자동으로 붙인다.

## 2. 현재 구조

| 층 | 위치 | 하는 일 |
|---|---|---|
| 화면 | `src/pages/ownerAi/*` | `/ai` 목록 · 빠른 등록 · `/ai/cases/:id` 업체 작업실 · 제안서 스튜디오 · AX 화면 스튜디오 · `/ai/usage` · 업체 상세 '더보기 › AI 작업실(대표 전용)' |
| 화면 엔진 | `src/services/ownerAi/*` | 업체(Case) · 중복 찾기 · Snapshot 13칸 · AI 에 보낼 최소 묶음 · 기억 제안/비교 · 결과 글 · 저장소(로컬/클라우드) · 서버 부르기 · 사용량 · Partner 다리 · 제안서 배치/점검 · 화면 명세 |
| 서버 함수 | `api/ai-run.js` + `api/_ai/core.js` · `api/_ai/skills.js` | 로그인 · 기능 권한 확인 → 크기 · 중복 요청 · 속도 제한 → 개인정보 지우기 → 프롬프트 → AI 공급자 → JSON 검사 → 비용 계산 |
| DB | `supabase/migrations/20261014000021_owner_ai_workspace.sql` | 기능 권한 · Company Case · 기억 판 · 실행 기록 · 수정 이력(모두 덧붙이기) |

재사용한 기존 구조:
- **고객 관리 업체**(operations_clients) — Case 는 `client_id` 로 기존 업체와 잇는다(업체 DB 를 따로 만들지 않음). 이어 두면 Snapshot 이 고객 관리의 회사 정보(clientFacts — 업종 · 업력 · 대표자 · 직원 · 매출 · 홈페이지)를 그대로 쓴다.
- **타임라인** — 고객 관리 활동 기록(ActivityEntry)과 같은 모양.
- **서류 읽기** — PDF · 이미지(OCR) · 글 · 엑셀 판독기(docTextExtract)와 개인정보 필터(privacyFilter · stripRrn).
- **업체 서류함** — 이어 둔 업체면 서류함 파일(사업자등록증 · 등기 · 크레탑 · 재무제표 · 직접 만든 칸)을 자료로 가져온다(신분증 · 명부 · 인증서 · 건강보험은 뺌).
- **OS 진단(규칙 계산)** — 정책자금 · 벤처 작업에는 이어 둔 업체의 기존 진단 결과(buildInsights)를 같이 보낸다.
- **벤처 9칸** — 기업인증 벤처 패키지와 같은 칸(basic · problem · product · tech · market · growth · rnd · ip · proof).
- **권한 틀** — 0019 os_access(대표 full · 팀장 pilot) 위에 기능 권한 하나를 더했다. 메뉴 · 주소 막기는 기존 Pilot 문지기(AppShell)를 그대로 썼다.

## 3. DB schema (0021 · 추가만)

| 표 | 내용 | 정책 |
|---|---|---|
| `user_capabilities(user_id, capability, note, granted_at)` | 기능 권한. 0021 이 기본 작업공간 소유자(=대표, os_access full)에게만 `can_use_owner_ai_workspace` 하나를 넣는다 | 자기 줄만 읽기 · 쓰기 정책 없음(화면에서 못 넣음) |
| `company_cases` | 업체 한 장: 회사명 · 관계(8가지) · client_id · 사업자번호 · 홈페이지 · payload(요청자 · 업종 · 메모 · 자료 · 읽은 정보 · 타임라인 · 들어온 곳) · context_version · archived_at | 읽기/넣기/고치기 = 본인 + 기능 권한 + 작업공간 구성원. **지우기 없음**. 같은 고객 · 같은 사업자번호는 한 장(부분 unique) |
| `company_context_snapshots(case_id, version, content, source, note)` | 지금까지의 기억 12칸 — 판마다 한 줄 | 읽기 · 넣기만(고치기 · 지우기 없음) |
| `ai_runs` | 실행 한 번: 스킬 · 판 · 공급자 · 모델 · tier · 입력 · 구조 결과 · 글 결과 · 기억 판 · 토큰 · 예상 비용 · 상태 · 평가(검토 전/채택/일부 채택/폐기) · 메모 · 채택 부분 · request_id | 읽기 · 넣기 · **평가 칸만** 고치기(트리거) · 지우기 없음 · (작성자, request_id) unique |
| `ai_output_revisions(original_run_id, revision_no, content, note)` | 고친 글 — 번호로 쌓임 | 읽기 · 넣기만 |

함수: `has_capability(cap)` · `my_capabilities()` · `owner_ai_can(ws)` · `owner_ai_case_visible(case)` · `owner_ai_seed_owner()`(서버 전용). anon 은 다섯 표 모두 권한 없음.

## 4. Permission

- 화면 문지기: `useOwnerAiAccess()` — yes(대표) · no(팀장 · 대표가 팀장 화면으로 볼 때 · 권한 없는 계정) · setup(0021 실행 전). 메뉴(사이드바 · 휴대폰 · 찾기)와 주소(`/ai/*`)를 AppShell 이 막고, 페이지 안에서도 한 번 더(OwnerAiGate).
- 데이터: RLS `owner_id = auth.uid() and owner_ai_can(workspace_id)` — 팀장이 REST 를 직접 불러도 `[]`.
- AI 호출: 서버 함수가 로그인 토큰으로 사용자를 확인하고 `has_capability` RPC 로 권한을 본다(없으면 403).
- 권한을 주는 길은 SQL(서버)뿐이다. 화면에는 권한 관리 화면이 없다(V1 은 대표 한 사람).

## 5. AI architecture

- 브라우저 → `/api/ai-run`(서버 함수) → AI 공급자. 브라우저는 공급자 주소 · 키를 모른다.
- tier 셋: **빠르게(cheap)** — 동료 문구 · 자료 요약 · 기억 정리 · 맞춤법 / **보통(standard)** — 아이템 발굴 · MVP · 화면 기획 · 제안서 구성 · 자유 질문 / **깊게(deep)** — AX 전략 분석 · 특허 · 벤처 · 정책자금 전략.
- 환경변수(서버): `AI_PROVIDER`(기본 openai) · `OPENAI_API_KEY` · `AI_MODEL_CHEAP` · `AI_MODEL_STANDARD` · `AI_MODEL_DEEP`(또는 공통 `AI_MODEL`) · 선택 `AI_PRICE_CHEAP|STANDARD|DEEP`("입력,출력" USD/100만 토큰) · `AI_MAX_OUTPUT_*` · `AI_TIMEOUT_MS` · `AI_BASE_URL`(https) · `AI_RATE_PER_MIN`(6) · `AI_RATE_PER_HOUR`(60) · `AI_RATE_DEEP_PER_DAY`(40). `VITE_` 로 시작하는 이름은 키로 읽지 않는다.
- 최소 맥락: 업체 자료 전체가 아니라 ① 구조화된 회사 정보 ② 지금까지의 기억(최신 판) ③ 이 작업에 맞는 자료 일부(스킬마다 종류 · 최신 6개 · 1개 6,000자) ④ 채택한 결과 요약 ⑤ 최근 결과 요약 ⑥ OS 진단(정책자금 · 벤처). 글 양 한도: 빠르게 9,000자 · 보통 18,000 · 깊게 30,000(자료부터 줄인다).
- 두 번 누름: 창을 열 때 요청 번호 하나 → 서버가 15분 동안 같은 번호에 같은 결과를 돌려준다(공급자 다시 안 부름) · DB 도 (작성자, request_id) unique. 화면은 도는 동안 다른 단추를 잠근다.
- 형식이 다르면(JSON 아님 · 필수 칸 없음) '형식 확인 필요' 로 원문을 그대로 보관한다(parse_fallback) — 버리지 않는다.
- ChatGPT 기억은 흉내 내지 않는다: 'ChatGPT 결과 붙여넣기' 로 가져온 결과만 기록(tier 붙여넣기 · 비용 없음)으로 남기고 채택 · 기억에 쓸 수 있다.

## 6. Skill architecture

`api/_ai/skills.js`(서버 · 지시문) ↔ `src/services/ownerAi/skillCatalog.ts`(화면 · 이름표) — id · version · tier 가 같아야 한다(단위 시험이 맞춘다). 스킬마다 `id · name · version · tier · active · createdAt · updatedAt · description · systemInstruction · outputSchema · example`.

| 스킬 | tier | 메모 |
|---|---|---|
| AX_PENGUIN | 깊게 | 12단계(돈 버는 방식 → … → 정책지원 연결) · 가장 추천 1 + 차선 · 주의 · 확인할 것 |
| AX_IDEA | 보통 | 아이템 후보 · 빨리 되는 것 표시 |
| AX_MVP | 보통 | 채택한 AX 를 범위 · 기능(필수/다음) · 화면 · 단계 · KPI 로 |
| AX_FRONT | 보통 | PC 대시보드 1 + 모바일 2 명세(글자는 OS 가 그림) |
| SANGHO_PROPOSAL | 보통 | 페이지 구성 · 제목 · 메시지 · 핵심 수치(근거 표시) |
| PATENT_IDEA | 깊게 | "내부 아이디어 정리용이며 실제 특허성/권리범위는 선행기술조사 및 변리사 검토가 필요합니다." 고정 |
| VENTURE_PLAN | 깊게 | 벤처 9칸 · 필요 증빙 |
| FUNDING_STRATEGY | 깊게 | 항목마다 근거 종류(업체 사실 · 내부 사례 · 최신 외부 · AI 추정 · 미확인) · 최신 자료 확인 필요 |
| CONSULTANT_MESSAGE | 빠르게 | 300자 · 500자 · 자세히 |
| FREE_CHAT | 보통 | 업체 기억이 붙은 자유 질문 · 기억 후보 한 줄 |
| CONTEXT_UPDATE | 빠르게 | 'AI 로 정리' — 기억 칸 제안(확인 뒤 저장) |
| PROOFREAD | 빠르게 | 제안서 맞춤법 · 오타만(내용 · 숫자 · 이름 안 바꿈) |
| SNAPSHOT_EXTRACT | 빠르게 | 자료 요약 · 업체 정보(없으면 미확인) — 채택하면 빈 Snapshot 칸만 채움 |

## 7. Cost architecture

- 실행마다 토큰(입력 · 출력)과 예상 비용(USD)을 남긴다. 가격(`AI_PRICE_*`)을 넣지 않으면 비용은 '가격 미설정'(지어내지 않음).
- `/ai/usage` — 달마다 호출 수 · 빠르게/보통/깊게 · 토큰 · 예상 비용 · 작업별 호출 · 채택 · 폐기(무엇이 실제로 쓸모 있었는지).
- 비용 막기: 깊게는 이미 만든 적이 있으면 다시 만들기 전에 한 번 묻는다 · 속도 제한(1분 6 · 1시간 60 · 깊게 하루 40) · 출력 토큰 상한 · 최소 맥락 · 제안서 오타는 페이지만 고침(전체 재생성은 따로 · 확인 뒤).

## 8. Security

- 키는 서버 환경변수에서만 읽는다. 화면 번들 · 브라우저 저장소 · 네트워크 응답에 키 · 공급자 주소가 없다(qa:ownerai 가 번들 · 요청 · 저장소를 직접 검사).
- 개인정보: 자료는 저장 전에 주민등록번호 · 비밀번호(공동인증서 포함) · 키 · 카드 · 계좌 · 휴대폰을 지운다(제목 포함). 서버가 프롬프트 직전에 한 번 더 지운다. 대표자 이름 · 요청자 · 연락처는 AI 에 보내지 않는다. 4대보험 명부 모양 자료는 'AI 에 안 보냄'. 원본 파일은 올리지 않고 읽은 글만 둔다(같은 작업공간 보관함은 팀장도 열 수 있어서).
- 권한: 화면 · DB(RLS) · 서버 함수 세 겹. 지우기 정책 없음 · 기억 · 실행 · 수정 이력은 덮어쓰기 없음.
- 오류 문구는 사람 말 코드만(공급자 원문 · 키 · 내부 주소 노출 없음). 요청 크기 256KB 상한.

## 9. 사용 방법

1. 사이드바 **AI 작업실** → [업체 등록] — 회사명만 있어도 된다(홈페이지 · 요청자 · 관계 · 업종 · 메모). 같은 업체가 있으면 먼저 알려 준다(사업자번호 · 홈페이지가 같으면 새로 못 만듦 · 고객 관리 업체면 '이 고객과 이어 만들기').
2. 업체 작업실 › **업체 자료** — 파일(회사소개서 PDF 등) · 홈페이지 주소(+본 내용 붙여넣기) · 붙여넣기 · 메모 · (이어 둔 업체면) 서류함에서 가져오기.
3. **빠른 작업** 10개 중 하나 → 창에서 보낼 자료 · 글 양 확인 → [AI 로 만들기].
4. 결과 카드 → **채택 · 일부 채택 · 폐기**. 채택하면 '기억에 넣기' 창(바뀌는 칸만 위에) → [새 판으로 저장]. 고치기 → 수정 이력.
5. 다음에 같은 업체를 열면 기억 · 채택한 결과가 다음 작업에 자동으로 붙는다.
6. 제안서: '제안서 구성' → [제안서 스튜디오] → 쪽마다 고치기 · 점검 · 맞춤법 → [PDF · 인쇄] / [PNG]. AX 화면: '화면 기획' → [화면 스튜디오] → 글 고치기 → PNG · 인쇄.
7. 고객 관리 업체에서: 업체 상세 › 더보기 › **AI 작업실(대표 전용)** → 처음 한 번 [AI 작업실 열기].
8. 동료(Partner OS) 요청: `/ai/new?event=ax_proposal_requested&company=…&url=…&requester=…&memo=…` 주소로 열거나, 빠른 등록 › 'Partner OS 요청 붙여넣기' 에 JSON 을 붙인다.

## 10. 아직 하지 않은 것

- 실제 OpenAI 키로 부른 적이 없다 — 이 환경에는 키가 없어 서버 함수 진짜 코드 + 가짜 공급자로만 시험했다(응답 모양 · 오류 · 비용 계산). 실제 모델의 답 품질은 확인하지 못했다.
- Production DB 에 0021 을 적용하지 않았다(수동 설정 12번).
- 홈페이지 주소를 OS 가 직접 열어 읽지 않는다(주소 + 붙여넣은 내용만).
- AI 작업실 전용 원본 파일 보관(대표만 여는 보관함)은 없다 — 글만 둔다.
- 업체 Case 를 고객 관리 업체로 '승격'하는 단추는 없다(이어 만들기 · 이어 둔 작업실 열기만).
- Partner OS 저장소는 고치지 않았다 — 주소 · JSON 받는 쪽만.
- 웹 검색 · 최신 자료 자동 조회 없음(정책자금은 '최신 자료 확인 필요' 표시만).

## 11. 다음 V2 후보

- 대표 전용 원본 파일 보관함(별도 bucket · 대표만 RLS) · 홈페이지 서버에서 읽기(허용 주소만).
- 채택 · 폐기 이유를 모아 스킬 지시문 판 올리기(v2) — 판별 채택률 비교(사용량 표에 이미 판이 남는다).
- 기억 판 되돌리기(예전 판을 새 판으로 복사) · 판 비교 화면.
- 제안서 스튜디오 템플릿 몇 가지 · 표/그래프 블록.
- Partner OS 에서 바로 보내기(서명된 링크) · 결과 회신.
- 실제 키 연결 뒤 tier 별 모델 · 가격 확정과 월 예산 알림.

## 12. 수동 설정 필요사항(대표가 할 일)

1. **Supabase SQL Editor** 에서 `supabase/migrations/20261014000021_owner_ai_workspace.sql` 전체를 한 번 실행. 마지막 줄 결과 `owner_ai_granted = 1` 이면 대표 한 사람에게만 권한이 들어간 것(0019 가 먼저 적용돼 있어야 한다 — 이미 적용됨).
2. **Vercel › Settings › Environment Variables**(Production · Preview):
   - `OPENAI_API_KEY` = OpenAI 키(절대 `VITE_` 로 시작하는 이름에 넣지 않는다)
   - `AI_MODEL_CHEAP` · `AI_MODEL_STANDARD` · `AI_MODEL_DEEP` = 쓸 모델 이름
   - (선택) `AI_PRICE_CHEAP` · `AI_PRICE_STANDARD` · `AI_PRICE_DEEP` = "입력,출력" 달러/100만 토큰(예 `0.15,0.6`) — 넣어야 사용량에 비용이 나온다
   - `SUPABASE_URL` · `SUPABASE_ANON_KEY` 가 서버 함수에도 있어야 한다(이미 있는 `VITE_SUPABASE_URL` · `VITE_SUPABASE_ANON_KEY` 도 읽는다 — anon 키는 공개 키)
3. 환경변수를 넣은 뒤 **Redeploy**. AI 작업실 위 'AI 기능 설정이 필요합니다.' 안내가 사라지면 끝.

## 13. QA 결과(2026-10-14)

- `test:ownerai` 78 — 서버(로그인 · 권한 · 설정 없음 · 개인정보 지우기 · 중복 요청 · 속도 · 크기 · 공급자 오류 · 형식 다름) · 스킬 서재(화면 ↔ 서버 이름표) · 업체 · 중복 · Snapshot · 맥락 · 결과 글 · 기억 제안 · 저장소(새로고침 뒤 그대로) · 화면 흐름(화면 → 서버 함수 → 가짜 공급자) · 제안서 배치/점검/맞춤법 · 화면 명세 · 사용량 · Partner 다리.
- `qa:db` — 0021 시험(대표 O · 팀장 · 가입자 · 다른 사람 · anon 막힘 · 지우기 없음 · 평가 칸만 고침) + 모든 표 격리 시험에 company_cases.
- `qa:ownerai` 59 — 시나리오 A~E 를 실제 화면에서 끝까지(설정 없음 안내 · 등록 · 중복 · PDF/URL/메모 · 주민번호 지움 · 두 번 눌러도 1번 · 깊게 모델 · 일부 채택 → 기억 v1 · 동료 문구 복사 · 새로고침 뒤 그대로 · 특허 경고 · 기억 v2 · 벤처에 지난 판단 자동 · 제안서 5쪽 SVG 글자 · 점검 · 한 쪽 고침 · 맞춤법 · PDF 다시(AI 다시 안 부름) · PNG · AX 화면 PC 1 + 모바일 2 · 글 고침 유지 · 공급자 실패 · 형식 다름 · ChatGPT 붙여넣기 · 업체 상세 탭 줄 그대로 · 고객과 이어진 작업실 · Partner 주소 · 사용량 · 360/390 넘침 0 · 번들 · 요청 · 저장소에 키 없음).
- `qa:pilot` — 팀장: AI 작업실 주소 5곳 막힘 · REST(company_cases · ai_runs = [] · 권한 = [] · 넣기 막힘) · DB 권한은 대표 한 사람 / 대표 → 팀장 화면: 메뉴 없음 · /ai 막힘 / 대표: 메뉴 · /ai 열림.
- 숫자 · 게이트 결과는 docs/QA_REPORT.md §137.

## 14. 공급자 셋 · AI 도우미(D-239 · 2026-10-19)

- 공급자: **Gemini(기본)** · OpenAI(GPT) · Anthropic(Claude). 서버 함수 둘이 같은 설정을 쓴다 — AI 작업실 `/api/ai-run` · 화면마다 AI 도우미 `/api/ai-assist`.
- 키(서버 환경변수 · 하나만 있어도 된다 · `VITE_` 이름은 읽지 않음):
  - `GEMINI_API_KEY`(또는 `GOOGLE_API_KEY` · `GOOGLE_GENERATIVE_AI_API_KEY`) — Google AI Studio 키
  - `OPENAI_API_KEY`(예전 이름 `AI_API_KEY` 도 읽음)
  - `ANTHROPIC_API_KEY`(또는 `CLAUDE_API_KEY`)
- 기본 모델: 키가 있는 공급자 중 Gemini → OpenAI → Anthropic 순서의 '빠르게(cheap)' 모델. Gemini 는 `gemini-3.1-flash-lite`.
  바꾸기: `AI_DEFAULT_PROVIDER`(gemini|openai|anthropic) · `AI_DEFAULT_MODEL` · 목록 `AI_MODELS_GEMINI|OPENAI|ANTHROPIC`("모델,모델" — 앞에서부터 빠르게 · 보통 · 깊게).
  주소(프록시 등): `AI_GEMINI_BASE_URL` · `AI_OPENAI_BASE_URL`(또는 `AI_BASE_URL`) · `AI_ANTHROPIC_BASE_URL` — https 만.
- 화면에서 고르기: AI 도우미 패널 아래 '모델' → 공급자 탭(키 있음/없음) → 모델(100만 토큰당 입력/출력 달러). 고른 것은 그 사람 브라우저에 기억 · AI 작업실도 그 공급자를 따른다.
  [키로 쓸 수 있는 모델 확인] — 공급자에 모델 목록을 물어(10분 기억) 실제로 있는 모델에 '확인됨'.
- 가격표(2026-10-19 공식 가격 페이지 기준 · 입력/출력 USD per 100만 토큰): gemini-3.1-flash-lite 0.25/1.5 · gemini-3.8-flash 0.75/3.75 · gemini-4-argon 2/10 ·
  gpt-5-nano 0.05/0.4 · gpt-5.4-mini 0.75/4.5 · gpt-6.1-sol 2/10 · claude-haiku-5-5 0.1/0.5 · claude-sonnet-5-5 2/10 · claude-opus-5-5 4/20 (그 밖의 모델은 패널 목록).
  비용은 예상치(토큰 × 가격) — 공급자 청구서와 다를 수 있다.
- AI 도우미 속도 제한: `AI_ASSIST_RATE_PER_MIN`(10) · `AI_ASSIST_RATE_PER_HOUR`(120). 같은 요청 번호 15분 = 공급자 한 번. 자료 글 양 40,000자(넘으면 뒤 줄부터 '(n건 더 — 줄임)').
- AI 도우미 답은 DB 에 남기지 않는다 — 그 브라우저에 화면마다 6개(전체 60개)까지. 사용량 화면(/ai/usage)은 AI 작업실 실행만 센다.

### Vercel 에 키 넣기(대표가 할 일)

1. Vercel › 프로젝트 › Settings › Environment Variables → `GEMINI_API_KEY` = Google AI Studio(aistudio.google.com) 에서 만든 키 · Production + Preview. (선택) `OPENAI_API_KEY` · `ANTHROPIC_API_KEY`.
2. 절대 `VITE_` 로 시작하는 이름에 넣지 않는다(화면 번들에 들어간다).
3. Deployments › 맨 위 › Redeploy. AI 도우미 패널의 '키 있음' 이 켜지면 끝.
4. AI 작업실 권한(0021)이 Production DB 에 없으면 띠는 보이지만 누르면 'DB 설정 필요' 안내가 나온다 — 12번 1을 먼저.
