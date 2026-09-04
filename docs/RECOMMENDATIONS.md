# RECOMMENDATIONS — P2 이후 (이번 단계에서 구현하지 않음)

무한 개선 루프를 막기 위해 P2 아이디어는 여기 적고 멈춘다. 우선순위는 위에서부터.

## 제품
1. **고객 알림 발송** — portal_updates 발행 시 이메일/카카오 알림. 지금은 고객이 My MIRAE 에 들어와야 본다. (Adapter 자리: `customerBridgeService.publishUpdate` 이후)
2. **자동 공개 템플릿** — "기관 접수 완료" 같은 안전한 내부 이벤트를 템플릿 발행으로 반자동화 (D-09 원칙 유지: 사람이 확인 후 발행).
3. **Team Journal** — 워크스페이스 멤버가 2명 이상일 때 `visibility` 컬럼 + 정책 추가(additive).
4. **LLM 정리 Adapter** — 통화 메모 요약, 하루 정리 문장 다듬기. 규칙 결과 옆에 "AI 정리"로 분리 표기.
5. **일정 ICS 내보내기 / 구글 캘린더 동기화**.
6. **결과자료(AX STUDIO deliverables) → 고객 공유 원클릭** — 지금은 파일 공유만.
7. **고객 이벤트 → 업무 자동 생성 제안 UI** — 이벤트 카드의 "추천: 벤처인증 업무 시작"을 버튼으로(상태 확정은 여전히 사람이).
8. **이벤트함 대량 처리(선택 → 보류/완료)**.

## 정리
9. `pages/DashboardPage.tsx` · `ClientOperationsWorkspacePage.tsx` · `ClientOpsLedgerPage.tsx` 물리 삭제 (라우트 미연결 상태 확인됨).
10. `src/data/demo.ts` 의 데모 워크스페이스/사용자 상수 제거(local 모드 헤더가 아직 사용).
11. `src/domain/`·`src/adapters/` 로 순수 함수·supabase 분기 이동(PORTABILITY §4).
12. 공개 저장소 페이지 전체 lazy import 전환(현재 신규 Portal 페이지만 lazy).
13. 공개 저장소 `v19/` 스냅샷·`docs/ax-mvp-factory-os-설계안.md` 정리.

## 데이터
14. UI 설정(테마·글자·모션) 서버 동기화(`ui_preferences.payload`) — 지금은 브라우저별.
15. `customer_events` 보관 정책(예: resolved 180일 후 archive 테이블).
16. 활동 기록 200건 상한을 별도 테이블로(장기 Evidence).

## QA
17. Playwright 스모크를 CI 로(현재 로컬 실행 스크립트).
18. pgTAP 버전의 브릿지 계약 테스트(`supabase test db` 통합).

## 2026-09-03 추가 (P2)

- `customer_intake_routing` 은 `is_default` 에 유니크 제약이 없다. `default_intake_workspace()` 는
  `is_default` 중 `created_at` 이 가장 이른 것을 고르므로 결과는 결정적이지만, 나중에 행을 하나 더
  넣어도 유입처가 바뀌지 않는다(조용히 무시된다). 워크스페이스를 여러 개 쓰게 되면 부분 유니크
  인덱스(`where is_default`)나 "지정 시 기존 default 해제" 규칙을 넣는다.
- 고객 알림 발송(이메일/카톡)이 없어, 내부가 업데이트를 발행해도 고객은 직접 들어와야 안다.
- 공개 사이트 `public` 스키마에 RLS 가 꺼진 테이블이 있다(`tools`, `tool_access`, `reviews`,
  `surveys`, `user_roles`, `payments`). 이번 브릿지와 무관하고 고객 포털 경로도 이들을 읽지
  않지만, Supabase Security Advisor 는 별도로 지적한다. 공개 사이트 저장소에서 따로 판단한다.
- 내부 OS local 모드 헤더의 워크스페이스/사용자 표시는 아직 데모 상수다.

## 2026-09-04 추가 — 모바일 우선 UI 재구축 이후 (P2)

- AX 스튜디오 하위 화면(진단·설계·검증)은 화면 제목과 공통 카드만 새 기준을 따른다.
  단계 표시(StageProgress)·비교 표 같은 내부 UI 는 손대지 않았다. 매일 쓰는 화면이
  아니라 이번 범위에서 뺐다. 다음에 손댈 때 `docs/DESIGN_SYSTEM.md` 를 따른다.
- 업체 상세 '서류' 탭은 항목이 10개로 고정이라 접기 없이 그대로 둔다. 서류 종류가
  더 늘면 진행 중인 업무에 필요한 것만 먼저 보이도록 접어야 한다.
- 1920px 이상에서 본문 최대 폭이 1840px 이라 시선 이동이 길다. 1440~1600 에서
  멈추게 할지는 실제로 큰 화면에서 써 보고 정한다.
- 남아 있는 `text-[0.7x rem]` 은 AX 스튜디오 쪽 단계 번호·보조 배지 30여 곳이다.
  본문이 아니라 메타데이터라 급하지는 않지만, 그 화면을 손댈 때 `t-meta` 로 바꾼다.
- 하단 내비게이션이 생기면서 화면 아래 여백(`pb-safe-nav`)을 앱 셸에서 한 번만
  준다. 자체 스크롤 영역을 새로 만드는 화면은 이 여백을 직접 챙겨야 한다.
