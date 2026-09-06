# QA_REPORT — MIRAE AI LAB OS · 2026-09-05

규격: `AX + Platform Unified Design & Development System v3.0` (2026-09-02)
브랜치 `main` · Production https://ax-mvp-factory-os.vercel.app (supabase 모드)
이전 보고(2026-09-03)는 브릿지 READY 시점의 기록이다. 그 뒤 브릿지 Production 적용·실왕복 확인·모바일 재구축·v3.0 채점 화면 신설이 있었다.

---

## 1. 이중 점수 (v3.0 §18 — 전략과 제품을 따로 매긴다)

### SCORE A — 전략 / 사업 품질 · **90 / 100**

| 영역 | 배점 | 점수 | 근거 · 깎인 이유 |
|---|---:|---:|---|
| Problem / Constraint | 15 | 14 | 병목 하나(아침 재조합 시간)로 잠김. 핵심 기능 6개가 전부 이 병목에 연결 |
| Process Redesign | 10 | 9 | 제거→표준화→디지털화→자동화→AI 표 6행 (SPEC). 카톡 되묻기·서류 재요청은 "자동화" 가 아니라 "제거" |
| Data Foundation / Asset | 15 | 14 | SSOT 19 엔티티, provenance, Moat 자가 10/12. −1: Outcome 데이터(결과·성과)가 아직 얇다 |
| AI Fit / Explainability | 10 | 10 | AI 0개. 우선순위·경고·정리 전부 규칙이고 이유를 표기. LLM 은 NEXT |
| Proof / KPI Design | 15 | 14 | Cost/Revenue/Scale/Adoption 10개 지표, 측정 지점 명시, 기준선 5건 규칙, 목표치 없음. −1: 실증 결과는 12주 뒤 |
| Customer / Partner / Platform Fit | 10 | 9 | 고객→내부→고객 왕복 Production 실측. −1: 고객 알림이 없어 고객이 직접 들어와야 안다(NEXT) |
| Scale / Unit Economics | 10 | 8 | SCALE KPI 측정 중, SaaS 분리 구조 준비. −2: 단위경제 수치 없음(내부 도구라 측정 항목만 정의) |
| Moat / Asset | 5 | 4 | 운영 데이터 + 왕복 기록. −1: 12개월 축적 전 |
| Adoption / Risk | 5 | 4 | Adoption 지표 측정 중, 첫 접속 안내창 제거. −1: 사용자 1인이라 직원 이익 검증 불가 |
| Financeability / Growth Logic | 5 | 4 | WHY MONEY · 적합도(중진공형+기보형) 기재. −1: 자본 투입 효과는 실측 전 |

판정: **90~94 좋은 전략**. Strategic P0 **0** (PROJECT_STATE "Strategic P0 점검" 12항목).
남은 10점은 설계가 아니라 시간이 필요한 것(실증 결과·데이터 축적·단위경제 실측)이다.

### SCORE B — 제품 / 구현 품질 (내부 OS) · **95 / 100**

| 영역 | 배점 | 점수 | 근거 · 깎인 이유 |
|---|---:|---:|---|
| Brand / Reference Fidelity | 15 | 14 | 로고·딥틸 기본 테마·문자열 일관. −1: 데스크톱 헤더 저장상태 칩 문구가 길다 |
| Product Shell / Platform Feel | 15 | 14 | 프리미티브 한 벌, 분류색 0곳, 3단계 위계. −1: AX 스튜디오 내부 표는 옛 스타일 |
| Primary Journey | 20 | 19 | 모바일 한 바퀴 15/15, 실왕복 확인. −1: 고객 알림 부재로 왕복이 고객의 재방문에 의존 |
| Mobile / Responsive | 15 | 15 | 8폭 + 360×글자1.3배, 가로 넘침 0, 하단 내비 겹침 0 |
| Card / Detail Quality | 10 | 9 | 업체 상세 10,486→1,833px, 접기 구조. −1: 서류 탭 10항목 고정 나열 |
| Conversion / Action Clarity | 10 | 10 | KPI→상세→업무 딥링크, 이유 표기, 기획의도·성과 지표·향후 확장 찾을 수 있음 |
| Data / State / Interaction | 5 | 5 | 시트 Escape·배경 클릭 닫힘, 로딩·빈·오류 상태, 확인 대신 Modal/Toast |
| Performance / A11y | 5 | 4 | 메타 글자 대비 4.76:1(AA), 탭 44px, aria. 번들 892→900KB(+0.9%). −1: 자동 접근성 도구 미실행 |
| Polish / Motion | 5 | 5 | 620ms 등장, 반복 애니메이션 0, 움직임 줄이기 설정 존중 |

### 고객 플랫폼 (miraeailab.com) · **90 / 100** (2026-09-03 Mock 20/20 + 2026-09-04 실왕복 기준)
이번 회차에 손댄 것은 가입 화면(카카오·구글만)뿐. U-2 10항목 중 Explore·카탈로그·상세·전환·완료·My·리뷰/FAQ·내부 연결 있음. 재주문은 서비스 특성상 해당 없음. 향후 확장 층은 내부 OS 에만 있음(−). 다음 회차 대상.

U-5 Minimum Floor: 전략 90 ✓ · 내부 제품 90 ✓ · 고객 제품 90 ✓ · P0 0 ✓

---

## 2. 정적 검사
| 항목 | 결과 |
|---|---|
| TypeScript (`tsc --noEmit`, strict) | 오류 0 |
| oxlint | 오류 0 (경고는 기존 fast-refresh 항목) |
| Production build | OK · route-level lazy 유지 |
| 화면 코드의 분류색(`cat-*`) 사용 | 0곳 |
| 13px 미만 본문 글자 | 핵심 화면 0곳 (AX 스튜디오 배지 30여 곳은 P2) |

## 3. 단위·계약 테스트 (`npm run test:all`, 12묶음)
**419건 전부 통과** — contract 16 · client-ops 13 · client-operations 9 · progress 32 · persistence 14 · onboarding 28 · alerts 94 · doc-parser 53 · stage2 44 · datamode 12 · auth-errors 16 · **mirae-os 88** (커스텀 항목 6 · 성과 지표 12 신규)

## 4. 반응형 — 규격 Q-3 여덟 폭 전수
`npm run qa:shots -- <url> <dir> --wide`
폭 **360 / 390 / 430 / 768 / 1024 / 1280 / 1440 / 1920** + **360 × 글자 1.3배** = 9조합 × 15화면 = **135장**
화면: 오늘 · 고객 운영 · 업체 상세(개요·업무·서류·수금) · 이벤트함 · 업무 일기 · 일정 · 자금 · 전체 도구 · 설정 · 기획의도 · 성과 지표 · 향후 확장

결과: **135 / 135 — 가로 넘침 0 · 화면 밖 요소 0 · JS 오류 0** (`반응형 문제 없음`)

## 5. 테마 9종 전수 — 규격 Q-1
`npm run qa:themes -- <url> <dir>` · 9테마 × 3화면(오늘·고객 운영·업체 상세) = 27장
- 본문 글자색 종류: **1** (테마에 물들지 않음)
- 주요 색(선택·버튼) 종류: **9** (테마마다 다름)
- JS 오류 0 → **9 테마 문제 없음**

## 6. 모바일 인수 여정 — 390px 한 바퀴
`npm run e2e:mobile -- <url>` · 오늘 → 고객 → 업체 → 상태 변경 → 서류 → 일기 → 이벤트함 → 일정 → 오늘 → 더보기 → 탭 44px → 가로 넘침 → JS 오류
**15 / 15 통과**

## 7. 상호작용 무결성 (Q-4)
- 시트: Escape · 배경 클릭 · X 로 닫힘, 닫힌 뒤 `[role=dialog]` 0, body 스크롤 복원
- 서랍: 하단 내비 위 층(z-50), 닫힌 뒤 backdrop 0
- 첫 접속: 자동 안내창 0 (D-17)
- NEXT 항목: 404 없음 — 5개 전부 계획 시트

## 8. 데이터 안전 (사용자 요구: 기능·데이터 손실 0)
- 이번 회차 DB 변경 **없음**. 성과 지표는 기존 기록에서 계산(D-18)
- 상태 8→5단계 축소는 읽는 자리에서 변환 — 저장된 옛 값 보존
- 직접 만든 업무 항목은 목록에서 내려도 업체 기록 유지
- 기존 라우트 전부 유지 (`/today`→`/` 리다이렉트 포함), 기존 테스트 12묶음 회귀 0

## 9. Devil Checklist (v3.0 §20) — 자가 공격
| 구분 | 물음 | 답 |
|---|---|---|
| BUSINESS | 없어도 회사가 돌아가는가 | 돌아가지만 아침마다 재조합 비용을 낸다 — 병목이 실제 |
| BUSINESS | 쉬운 문제만 풀었는가 | 가장 큰 병목(재조합)을 첫 화면이 직접 푼다 |
| DATA | Demo 데이터가 장식인가 | Production 은 실데이터. local 데모는 헤더에 명시 |
| DATA | Outcome 데이터가 없는가 | 얇다 — 수금 입금일·업무 완료일이 Outcome. 12주 뒤 재평가 |
| AI | IF 면 충분한데 AI 라 부르는가 | 부르지 않는다. 0개 |
| PLATFORM | 고객이 쓸 이유가 없는 Portal 인가 | 서류 올리기·진행 확인 — 실왕복 2건 확인. 알림 없음이 약점(NEXT) |
| PLATFORM | 요청 뒤 직원이 수기로 옮기는가 | 옮기지 않는다 — 트리거로 이벤트함 유입 |
| GROWTH | 반복매출 없는데 SaaS 라 부르는가 | 부르지 않는다. SaaS 는 NEXT |
| PRODUCT | 첫 화면만 고급이고 상세는 템플릿인가 | 업체 상세·이벤트함·일기까지 같은 부품 |
| PRODUCT | Mobile 에서 핵심 기능이 빠지는가 | 빠지지 않는다 — 시트·서랍으로 재배치 |
| PRODUCT | 튜토리얼/Why 가 있는데 못 찾는가 | 사이드바 '이 시스템' 그룹 |

## 10. Red Team (1회) — P0/P1 만 수정
- P0: 0
- P1 수정 4건: 메타 글자 대비 AA 미달 · 1440px 검색칸 잘림 · 매일 뜨는 안내창 · Why/KPI/Roadmap 부재
- P2 → RECOMMENDATIONS.md (7건)

## 11. Known Issues
- `20260904000010_custom_services.sql` Production **미적용** — 적용 전까지 클라우드에서 "업무 항목 추가" 는 오류 문구(데이터 손상 없음)
- Vercel Preview 는 환경변수가 없어 로컬 데모 모드로 뜬다 — Preview 로 실데이터를 보려면 RECOMMENDATIONS 참조
- 자동 접근성 도구(axe) 미실행 — 수동 검사(대비·aria·탭 크기)만

## 12. 재현 명령
```bash
npm run build && npx oxlint src && npm run test:all
npx vite preview --port 4390
npm run qa:shots -- http://localhost:4390 /tmp/shots --wide
npm run qa:themes -- http://localhost:4390 /tmp/themes
npm run e2e:mobile -- http://localhost:4390
```
