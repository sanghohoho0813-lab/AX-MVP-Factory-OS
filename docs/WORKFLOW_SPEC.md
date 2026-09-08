# WORKFLOW_SPEC — 컨설팅 워크플로 엔진 v1 (특허 × 벤처 × MVP)

사람용 규칙 원본은 Master v2.0 MD 다. 이 문서는 그 규칙 중 **코드가 실제로 강제하는 부분**만 적는다.
코드 위치: `src/types/consulting.ts`, `src/domain/consulting/*`, `src/services/consultingStudioService.ts`.
LLM API 는 부르지 않는다. 사람이 프롬프트를 들고 나가 결과를 붙여 넣는 **수동 왕복**이 전부다.

## 1. 단계 (S0~S16) 와 묶음

| 묶음 | 단계 | 목적 | Master 활성 PART |
|---|---|---|---|
| 이해 | S0 INTAKE · S1 VENTURE GATE · S2 PROBLEM DISCOVERY | 회사 사실 확보 → GO/HOLD/NO-GO → 핵심문제 한 문장 | PART 1 |
| 특허 | S3 PATENT IDEA · S4 PRIOR ART · S5 KIPO REFERENCE · S6 PATENT DRAFT · S7 PATENT FILED | 5개 질문 → 선행기술 → 참고 2~5종 → 명세서 → 출원번호 | PART 2 + APPENDIX |
| MVP | S8 STRATEGY LOCK · S9 BUILD | MVP_SPEC 잠금 → 구현·QA·URL | PART 3 + 4 |
| 벤처 | S10 FACTSHEET · S11 VENTURE PLAN · S12 EVIDENCE | 사실표 잠금 → 7항목 → 10슬롯 | PART 5 + 6 |
| 제출·실사 | S13 FINAL QA · S14 SUBMITTED · S15 FIELD REVIEW · S16 RESULT | Judge/Devil → 신청 → 3분 Script → 결과 | PART 7 / 9 / 8 |

단계 상태: `not_started · in_progress · blocked · ready_for_review · completed · skipped`.
`skipped` 는 이유 필수. `blocked` 는 무엇에 막혔는지 필수. 단계 정의(exit checklist · 필요 사실 · 필요 산출물 · 프롬프트 종류)는 `workflowDefinition.ts` 에 있다.

## 2. 사실표 (Factsheet SSOT)

7묶음 45항목. 값마다 `status(confirmed|unverified|planned|demo|future) · source · asOfDate · note`.
숫자 항목은 기준연도·출처·산식을 붙이도록 힌트를 준다(Master §5-1). 회사 기본 8항목은 고객 운영 기록에서 처음 값을 가져온다(`fromClient`).
완성도 = 채워진 항목 / 전체. 단계별 필요 사실이 비어 있으면 그 단계는 완료할 수 없다(Completion gate).

## 3. One Core Thread

8칸: 현장문제 → 기존방식 → 핵심 해결기술 → 특허 권리화 포인트 → MVP AX Core → Platform Surface → 벤처 Solution 핵심문장 → 핵심 증빙.
규칙 경고(점수 아님):
- 빈 칸 → info. 핵심 해결기술·특허 포인트·AX Core·벤처 문장 사이에 공통 낱말(2자 이상 명사)이 하나도 없으면 **p1** "핵심 기술이 서로 다르게 읽힌다" (Master §35-1).
- 출원 상태가 `filed` 인데 벤처 문장·핵심기술에 "특허 등록/등록 완료" 가 있으면 **p0** (§14-2).
- `axMode` 가 rule/scoring/demo 인데 AX Core 문장에 "AI" 가 있으면 **p1** (§18-2).
- 사실표에 demo 값이 있는데 실사 숫자 목록에 들어 있으면 **p0**.

## 4. 게이트

| 게이트 | 언제 | 무엇 |
|---|---|---|
| Venture GO/HOLD/NO-GO | S1 | 9개 GO 항목을 사람이 체크 → 결정은 사람이 고른다. 코드는 체크 수만 세어 "GO 근거 N/9" 로 보여 준다 |
| Completion | 모든 단계 | 필요 사실·필요 산출물·exit checklist 가 비면 완료 버튼이 막힌다(이유 표시) |
| Integrity | S8~S13 | LIVE/DEMO/FUTURE 칸이 비면 경고, 출원≠등록, Rule≠AI |
| Freshness | S7·S14 진입 | `freshness[]` 에 30일 이내 확인 기록이 없으면 완료 불가 (K9) |
| Evidence | S12 | 10슬롯 중 비어 있는 슬롯 · 핵심 주장인데 출처 없는 항목 |
| QA | S13 | P0 Red Flag 12개를 사람이 "문제 없음" 으로 확인해야 완료 (§41) |

## 5. 다음 행동 (규칙 · 최대 3개)

`nextActionResolver` 는 프로젝트를 읽고 결정론적으로 1~3개를 낸다. 우선순위:
1. 막힘(blocked) 해소 → 2. 게이트 미결 → 3. 현재 단계의 비어 있는 필요 사실 → 4. 필요 산출물이 없으면 "프롬프트 만들기"(있으면 "결과 들여오기") → 5. 참고자료 미선정/PDF 미첨부 → 6. Freshness → 7. 단계 완료.
같은 입력 → 같은 출력. 단위 테스트가 이를 고정한다.

## 6. 산출물 · 프롬프트 꾸러미 · 결과 왕복

- 프롬프트 13종 × 대상 4종(general/chatgpt/claude/claude_code). 본문 = 역할 + 현재 단계 + 사실표 발췌(상태 표시 포함) + Core Thread + 단계별 규칙 발췌(20~40줄) + 출력 형식.
  출력 형식 첫 줄에 `[ARTIFACT] type=… stage=…` 를 요구해서 결과 들여오기가 종류를 자동 인식한다.
- 개인정보 필터: 주민번호·계좌번호·비밀번호 줄·인증서 비밀번호·API 키(`sk-`, `sb_secret_`, `AKIA`, `ghp_`)·이메일·휴대폰을 `[가림:종류]` 로 치환하고 개수를 보고한다. 복사 전 미리보기 필수.
- 결과 들여오기: 붙여넣기/파일 → type·title·stage·version 확인 → Artifact 저장(`source=llm_paste|llm_file`). 같은 type 은 버전 +1, 이전 것은 `superseded` 로 표시 가능.
- 결정 기록: 게이트·단계 전환·범위·사실 변경마다 한 줄(`consulting_decisions`). 일기에도 `decision` 으로 남긴다(P1).

## 7. 데이터

| 표 | 내용 | 비고 |
|---|---|---|
| `consulting_projects` | id text pk · workspace_id · client_id → operations_clients(id) cascade · module_key · title · status · current_stage · payload jsonb · timestamps | payload = stages·factsheet·coreThread·gate·freshness·kipo·patent·mvp·venture·fieldReview |
| `consulting_artifacts` | id · project_id cascade · type · title · stage_key · version · status · content · source · prompt_package_id · file_name | |
| `consulting_prompt_packages` | id · project_id · type · target · stage_key · title · prompt · context · privacy jsonb · section | |
| `consulting_decisions` | id · project_id · stage_key · kind · summary · reason | |
| `consulting_evidence` | id · project_id · slot 1~10 · claim · claim_status · title · source · links_patent · links_mvp · ready · note | |

전부 workspace RLS(`is_workspace_member`/`can_write_workspace`), anon revoke, 멱등, additive. 마이그레이션 `supabase/migrations/20260908000012_consulting_studio.sql` 은 **브랜치에만 있고 Production 에 적용하지 않는다.**
local 모드 키: `axmvp.v1.consulting_projects` 등 5개.

사실표·단계 상태를 프로젝트 payload 에 두는 이유: 프로젝트와 1:1 이고 한 화면에서 함께 자동저장된다. 따로 표로 나누면 절반만 저장되는 순간이 생기고, 마이그레이션 미적용 환경 대응도 표 수만큼 늘어난다.

## 8. 화면

- `/studio` 컨설팅 작업실: 프로젝트 카드(회사·제목·단계·진행도·막힘·다음 행동) + 새 프로젝트(고객 선택).
- `/studio/:id?tab=` 탭: 개요 · 단계 · 사실표 · 핵심 줄기 · 특허 · MVP · 벤처 · 증빙 · 프롬프트 · 산출물 · 결정 · 실사.
- 개요 = 회사·제목·현재 단계·진행도·막힘·다음 행동 3개 + Core Thread 요약 + 단계 타임라인 + 사실 완성도 + 최근 산출물/결정 + 필요 자료.
- 단계: 묶음별 그룹, 모바일은 이전/현재/다음 + 바텀시트 전체 목록.
- 고객 상세 '컨설팅' 탭 → 그 고객의 프로젝트.
- 모바일 P0: 360/390/430 + 글자 1.3배에서 짜부라짐 0, 가로 스크롤 0.

## 9. 범위

P0 = 위 전부. P1 = 오늘/일기/검색 통합·결정 로그 다듬기·전역 참고자료 라이브러리(표). P2/Future = LLM API·RAG·벡터·파인튜닝·선행기술 자동조사·정책 크롤링·과금·권한·AI 일관성 점수.
"AI 학습 완료" 류 문구 금지. 규칙 계산을 AI 라 부르지 않는다.
