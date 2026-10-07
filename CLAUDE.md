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

## 고도화 최종 목표 (2026-10-07 대표 지시 — "다음 단계 고도화해 줘" 는 늘 이 방향)

**초보자가 써도 바로 컨설팅 전문가가 되게.** 대표 아이디 · 최은혜 팀장 아이디 상관없이 똑같이 편해야 한다.

1. **서류는 대충 올려도 알아서** — 분류 · 칸 배치 · 저장 · 회사 정보 채우기까지 스스로. 사람에게는 **정말 최종 확인이 필요한 것만** 묻는다.
2. **서류가 다 들어오면 모듈 추천이 먼저** — 맞는 모듈(정책자금 · 고용지원금 · 연구소 · 창업감면 · 절세 · 지원사업)을 알아서 싹 다 추천하고, **눈에 잘 띄게**.
3. **계산기는 상황 예시로** — 직접 계산도 되지만, 상황 예시를 많이 두고 **한 번 누르면 그 업체 숫자로 설계까지**.
4. **UI · UX 개선은 매번 서브로** 같이 가져간다.

### 🚨 반드시 먼저 물어볼 것 (눈에 확 띄게)

기존 기능을 없애거나 · 잘 만들어진 것을 통째로 갈아엎는 일은 **하기 전에 대표에게 묻는다.**
대표는 보고를 다 읽지 않고 "다음 단계 고도화해 줘" 로 넘어가는 습관이 있다 — 그래서 물을 때는 보고 **맨 위**에
`🚨🚨🚨 [확인 필요]` 처럼 빨간 표시를 여러 개 붙여 눈에 띄게 하고, 답을 받기 전에는 그 일을 하지 않는다.

## 병합 전 QA (전부 녹색이어야 한다)

```bash
npx tsc --noEmit -p tsconfig.app.json && npx oxlint src && npm run build
npm run test:all                                   # 단위·계약 전부(카탈로그 · 사실 창고 포함)
npx vite preview --port 4390 &                     # 아래 E2E 용
npm run qa:simple -- http://localhost:4390         # 간단 모드
npm run qa:studio -- http://localhost:4390         # 컨설팅 작업실(고급)
npm run qa:board  -- http://localhost:4390
npm run qa:todos  -- http://localhost:4390
npm run e2e:mobile -- http://localhost:4390
npm run qa:sales  -- http://localhost:4390         # 영업 관리(보드 · 잠재고객 · 계약 고객 숫자)
npm run qa:journey -- http://localhost:4390        # 영업 흐름(크레탑 → 잠재고객 → 미팅 준비 · 작업실 도구)
npm run qa:easy -- http://localhost:4390           # 쉽고 튼튼하게(글자 크기 · 대비 · 머리줄 넘침 · 다음 약속 · 찾기 · 미팅 메모)
npm run qa:steady -- http://localhost:4390         # 튼튼하게(저장 실패해도 적은 것 남음 · 삭제는 한 번 더 묻기)
npm run qa:flow -- http://localhost:4390           # 흐름 잇기(계약 완료 한 번에 · 상태 하나 · 미팅 → 서류함 · 오늘 돈 줄)
npm run qa:real -- http://localhost:4390           # 실제 데이터처럼(긴 이름 · 많은 항목 · 360~430 · 큰 글자에서 잘림 · 넘침 0)
npm run qa:squeeze -- http://localhost:4390 --all  # 짜부라진 글자 0
npm run qa:modules -- http://localhost:4390       # 모듈 전 화면 오류·넘침 0 · 오류 울타리 · 인쇄 · 저장 공간 가득 참
npm run qa:facts -- http://localhost:4390         # 고객 사실 창고(자료에서 찾은 정보 확인 → 모듈이 다시 씀)
npm run qa:detail -- http://localhost:4390        # 업체 상세(탭 순서 · 서류 올리기 한 번 → 바로 입력/표시/모듈 판정 · 맞춤 추천 · 회사정보 먼저 · 서류 제목으로 칸 · 겹치면 (2) · 다시 분류 · 삭제 체크 · 360~430)
npm run qa:files                                  # 서류 파일(클라우드 흉내 — 미리보기 · 새 창 · 내려받기 · 교체 · 비공개 저장소)
npm run qa:taxplan -- http://localhost:4390       # 절세 설계(원하는 결과 → 계산기 식으로 거꾸로 · 계산기 열기 · 업체 기록 저장)
npm run qa:calendar -- http://localhost:4390      # 큰 달력(날짜 칸 → 일요일부터 · 창 위 · Esc · 직접 적기 · 휴대폰)
npm run qa:connect -- http://localhost:4390       # 모듈 ↔ 업체 잇기(계산기 업체 숫자 채움 · 붙이며 할 일 걸기 · 결과 묶음 · 다시 열기)
npm run qa:enroll -- http://localhost:4390        # 명부 → 직원 → 참여신청 기한(청년도약 등록 · 겹치지 않음 · 오늘 '놓치면 끝나는 기한' · 직원 D-N)
npm run qa:planner -- http://localhost:4390       # 일정 달력(쉬는 날 빨간 날짜 · 공휴일 넣기 · 영업일 · 두 번 눌러 적기 · 반복 · 쉬는 날 마감 경고)
npm run qa:contract -- http://localhost:4390      # 계약 → 받은 돈 → 남은 돈(CASE 1~4 · 조건 대기 ≠ 미수금 · 정책자금 실제 입금 · 입금 확인/되돌리기 · 계약 상태 배지)
npm run qa:grants -- http://localhost:4390        # 지원사업 알림(공고 붙여넣기 · 맞는 업체 계약/잠재 · 카톡 문구 · 오늘 · 가망고객 찾기 화면 · 알림 신청 → 상담신청함 → 잠재고객 · 기업마당 받아오기 · 맞춤 기준 · 고객 관리/보드/오늘 연결 · 신청 준비 → 서류 대조 · 카톡 요청)
npm run qa:money -- http://localhost:4390         # 매출 · 비용(계약 수금 → 들어온 돈/예상 · 정기 결제일 · 비용 적기 · CSV · 해지 · 오늘 3일 안 결제 · 오늘 할 일 PC 두 칸 · AI 자리 단추)
npm run qa:db                                     # DB 보안(로컬 PostgreSQL · 마이그레이션 전부 · RLS · 0016~0019 공격 · 모든 표 격리) — pg_ctlcluster 16 main start 먼저
npm run qa:pilot                                  # 1인 Pilot 교차(로컬 DB + PostgREST 진짜 RLS · 대표 ↔ Pilot ↔ 가입자 · 같은 브라우저 · 주소 · 찾기 · 업무 흐름 · 390)
npm run qa:phone -- http://localhost:4390         # 휴대폰 전반(360 · 390 · 430 · 긴 이름 · 공고 300건 — 넘침 · 글자가 칸보다 넓음 · 짜부라짐 · 칩 겹침 0)
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
