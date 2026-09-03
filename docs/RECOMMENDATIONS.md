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
