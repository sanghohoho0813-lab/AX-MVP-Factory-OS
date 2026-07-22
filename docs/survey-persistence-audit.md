# 설문 저장 유실 방지 감사 (Stage 12C)

작성일: 2026-07-22 · 대상: 공개 설문(local·supabase 모드), LocalTestPage 계열 저장 흐름

## 1. 현재 저장 흐름

### Local 모드 (`PublicSurveyPage → LocalPublicSurvey`)
1. **입력 즉시(동기)** — `surveyDraftCache`(신규)가 답변·프로필·동의·페이지 위치를
   `axmvp.survey.draft.<responseId>` 키에 localStorage 동기 저장. debounce 와 무관하게 항상 최신.
2. **debounce 800ms** — `saveNow()`가 `SurveyResponseRepository.update()`(동기 localStorage)로 정식 저장.
3. **수명주기 flush** — `visibilitychange(hidden)`, `pagehide`, `beforeunload`, **컴포넌트 unmount**(effect cleanup)에서
   `saveNow()` 즉시 실행. 모두 동기 저장이므로 async 완료에 의존하지 않는다.
4. **복구 순서** — 정식 저장 Response → (updatedAt 이 더 최신이면) emergency draft → 빈 초기값.
   `isDraftNewer()` 비교로 오래된 draft 가 최신 정식 저장을 덮어쓰지 않는다.
5. **정식 저장 성공·제출 시** draft 정리(`clearSurveyDraft`). 제출 후 저장 경로 차단(status==='submitted' 가드).

### Supabase 모드 (`SupabasePublicSurvey`)
2단계 구조: **① 입력 즉시 로컬 안전 draft(동기)** + **② 서버 autosave/제출**.
- 서버 저장은 `createSerialSaveQueue()`(신규, 단위 테스트됨)로 **직렬화**: 완료 순서 역전 불가,
  seq(단조 증가 revision)로 오래된 비최종 요청은 건너뛰어 중복 전송을 방지, 항상 실행 시점의
  최신 상태(stateRef)를 전송.
- **submit** 은 같은 큐에 enqueue → 대기 중 autosave 가 모두 끝난 뒤 최종 제출이 실행된다(경합 불가).
- 최종 제출 성공 시 `queue.close()` → 이후 어떤 draft 저장도 실행되지 않음(read-only).
- 실패 시 상태를 `offline_draft`("이 브라우저에 임시저장됨 · 클라우드 저장 재시도 필요")로 표시하고
  재시도 버튼 제공. 성공 표시는 실제 서버 응답 후에만.
- 재진입 시 서버는 이전 답변을 반환하지 않으므로(공개 RPC 계약), 같은 브라우저의 로컬 안전 draft 를 복구.

## 2. 발견한 위험과 수정

| # | 위험 | 심각도 | 수정 |
|---|---|---|---|
| 1 | debounce 대기 중 탭 종료 시 마지막 답변 유실 (이벤트 미발화 경로) | 높음 | 입력 즉시 동기 emergency draft (`surveyDraftCache`) |
| 2 | `pagehide` 미청취 — 모바일 브라우저는 `beforeunload` 를 종종 생략 | 높음 | pagehide 리스너 추가(두 모드) |
| 3 | 컴포넌트 unmount(SPA 내 이동) 시 flush 없음 | 중간 | effect cleanup 에서 `saveNow()` (local) |
| 4 | **조건부 질문 source 답변을 placement id 로 조회하는 버그** — 조건 질문이 조건 충족 시에도 표시·유지되지 않음 | 높음 | `sourceAnswerFor` 를 `source.questionId` 로 수정 (+단위 테스트) |
| 5 | **중첩 조건 미지원** — 상위 조건 질문이 숨겨져도 남은 답변을 근거로 하위 질문이 보임/유지될 수 있음 | 중간 | `evaluateVisibleSnapshotQuestions` 고정점 평가로 전이적 숨김 (+단위 테스트) |
| 6 | supabase 모드 저장 순서 역전(느린 이전 요청이 최신 저장을 덮어씀) | 높음 | 직렬 저장 큐 + 실행 시점 최신 상태 전송 |
| 7 | supabase 모드 submit 과 진행 중 autosave 경합 | 높음 | 동일 큐 직렬화 — submit 은 pending 완료 후 실행 |
| 8 | submitted 이후 늦은 autosave 가 상태를 되돌림 | 중간 | local: status 가드 / supabase: `queue.close()` |
| 9 | 저장 실패 후 '저장됨' 표시 잔존 | 중간 | 실패 시 error/offline_draft 로 전환, 성공 표시는 실제 완료 후에만 |
| 10 | 저장 위치 오인(로컬인데 클라우드처럼 보임) | 낮음 | 표기 분리: "이 브라우저에 임시저장됨" vs "클라우드 저장됨" |

숨김 조건부 답변은 단일 sanitizer(`sanitizeAnswersForSubmission` → `evaluateVisibleSnapshotQuestions`)를
모든 제출 경로가 공유한다: 공개 설문 제출·`submitSurveyResponse`(서비스 내부에서도 재적용)·Guided Demo 제출.
분석(Assessment)·후보 추출은 제출된(=sanitize 된) 답변만 사용한다.
조건이 다시 충족되면 이전 입력값은 draft/정식 저장에 남아 있는 한 **복원**된다(제출 데이터에서만 제외) — 기존 정책 유지.

## 3. 보장 범위와 한계

### Local 모드 보장
- 입력 직후(effect 커밋 시점, 수 ms 이내)부터 마지막 유효 답변은 동기 draft 로 복구 가능.
- 새로고침·탭 종료·백그라운드 전환·SPA 이동·모바일 페이지 종료 모두 복구 검증됨.
- 한계: 같은 브라우저 프로필에서만 복구된다(localStorage). 브라우저/OS 가 상태 커밋 전에
  프로세스를 강제 종료하는 극단적 크래시(전원 차단 등)는 마지막 keystroke 일부가 유실될 수 있다.

### Supabase 모드(향후 실연결 시) 보장
- 서버 autosave 는 직렬·최신 상태 전송·제출 후 차단 계약을 가지며 큐는 단위 테스트로 고정.
- 브라우저 종료 시 **네트워크 요청 완료는 보장하지 않는다**. 대신 로컬 안전 draft 가 같은
  브라우저 재진입 시 복구를 보장하고, 서버 저장은 재시도로 따라잡는 2단계 구조다.
- 크로스 기기 이어쓰기는 공개 RPC 가 이전 답변을 반환하도록 확장해야 가능(실연결 단계 과제).

## 4. 검증

- **단위 테스트** `npm run test:persistence` (14 케이스): 직렬 큐 순서 보존·오래된 요청 건너뛰기·
  실패 후 계속·close 차단 / sanitizer 단일·중첩·손상 조건 / draft 최신성 비교.
- **브라우저 E2E** (Playwright, 실제 링크 생성 → 공개 설문): A. debounce 전 새로고침 복구,
  B. visibilitychange(hidden) 후 유지, C. pagehide 후 재진입 유지, D. 전체 페이지 이동 후 복귀 유지,
  저장 상태 문구("이 브라우저에 임시저장됨") 표시 — 전부 통과, 콘솔 오류 0.
- **한계 문서화**: 실제 브라우저 강제 종료(프로세스 kill)는 pagehide·재실행 조합으로 근사 검증했다.
  local 모드 저장이 전부 동기이므로 이벤트가 하나라도 발화하면 유실이 없고, 이벤트가 전혀 발화하지
  않는 경우에도 직전 입력의 동기 draft 가 남는다.
