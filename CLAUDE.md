# 이 저장소에서 일하는 방식

MIRAE AI LAB OS × Customer Platform.
자세한 규칙은 `docs/` 에 있다 — 여기에는 **매번 지켜야 하는 것만** 적는다.

## 배포 (2026-09-09 대표 지시)

**따로 말하지 않으면 QA 를 통과한 뒤 main 까지 병합하고 배포한다.**

- 물어보지 않는다. "병합할까요?" 를 다시 묻지 않는다.
- 순서: feature branch 에서 작업 → 아래 QA 전부 녹색 → main 으로 **fast-forward** → push.
  feature branch 는 지우지 않고 남긴다.
- main 은 Production 직행이다(D-16). 그래서 **QA 가 녹색이 아니면 병합하지 않는다** — 이때만 멈추고 보고한다.
- 예외: 대표가 "Preview 까지" 또는 "병합하지 마"라고 지시한 작업. 그때는 그 지시가 우선한다.
- 되돌릴 수 없는 것(DB 파괴적 변경·외부 발송·데이터 삭제)은 여전히 먼저 확인받는다.

## 병합 전 QA (전부 녹색이어야 한다)

```bash
npx tsc --noEmit -p tsconfig.app.json && npx oxlint src && npm run build
npm run test:all                                   # 단위·계약 14묶음
npx vite preview --port 4390 &                     # 아래 E2E 용
npm run qa:simple -- http://localhost:4390         # 간단 모드
npm run qa:studio -- http://localhost:4390         # 컨설팅 작업실(고급)
npm run qa:board  -- http://localhost:4390
npm run qa:todos  -- http://localhost:4390
npm run e2e:mobile -- http://localhost:4390
npm run qa:squeeze -- http://localhost:4390 --all  # 짜부라진 글자 0
```

화면을 손댔으면 **실제로 찍어서 눈으로 본다**(`npm run qa:shots -- <url> <dir> --wide`).
스크린샷 없이 "잘 됐습니다" 라고 쓰지 않는다.

## 절대 하지 않는 것

- `service_role` · `sb_secret_` 키를 브라우저·git·번들에 넣지 않는다.
- 공동인증서 비밀번호, 주민등록번호를 저장하지 않는다.
- DB 변경은 **추가만**. DROP TABLE/COLUMN · TRUNCATE · 이름 바꾸기 · PK 변경 · RLS 끄기 금지.
- force push · history rewrite · 기존 브랜치 삭제 금지.
- 고객 플랫폼은 내부 표를 읽지 않는다 — `portal_*` 과 고객 안전 RPC 만. 업무 일기는 고객에게 절대 안 보인다.
- 규칙 계산을 "AI" 라고 부르지 않는다. LLM API 호출 0을 유지한다.
- 저장소 이름 · Vercel 프로젝트 이름 · 도메인을 바꾸지 않는다.
- 커밋·PR·코드 주석에 모델 이름을 넣지 않는다.

## 보고할 때

- 기능 목록이 아니라 **대표가 겪는 변화**로 쓴다 (BEFORE → AFTER).
- 숫자는 실제로 잰 것만 쓴다. 못 잰 것은 "확인하지 못했다" 고 적는다.
- 못 한 것 · 목표에 못 미친 것을 감추지 않는다.
