# Knowledge Base 검증 리포트 (VALIDATION_REPORT)

> 대상: `knowledge/` 지식베이스 (전자책 PART 1 + 업종별 승인 케이스 부록)
> 목적: 데이터가 AI 코치 / `diagnosis.ts` 에 연결될 수 있을 정도로 정확·일관적인지 검증하고, 필요한 부분만 최소 수정.
> 원칙: 새 지식 파일 생성·서사 원문 임의 덮어쓰기 없음. 표기 통일 + 매칭용 정규화 필드 추가만 수행.

---

## 0. 요약

| 항목 | 결과 |
|---|---|
| 총 케이스 | 64건 (변동 없음) |
| 중복 사례 | **없음** (id·title 유일, 서사 중복 없음) |
| JSON 파일 | 12개 전부 유효 · 전부 `meta` 보유 |
| 케이스 스키마 | 단일 키셋 · 필드 18 → **20**(정규화 필드 2개 추가) |
| 기관명 표기 | 20종 → **14종**으로 통일(별칭·플레이스홀더 정리) |
| industryCategory | 6-value 통제 어휘로 전 케이스 분류 완료 |
| searchTags | 전 케이스 3~10개(평균 6.3), 43종 태그 |

---

## 1. 중복 사례 검토

- `id` 중복: **없음** (case-001 ~ case-064 유일)
- `title` 중복: **없음**
- 유사하지만 별개인 사례 존재(예: "편의점" 3건, "화장품 도소매" 2건) — 상황·기관·조건이 달라 **중복이 아님**. 그대로 유지.
- 결론: 제거할 중복 없음.

## 2. 기관명 표기 통일 (institutions)

케이스의 `institutions` 표기를 `funding-agencies.json` 정식 명칭 기준으로 통일했습니다. 서사(situation/strategy)는 원문 보존.

| 수정 전 | 수정 후 | 사유 |
|---|---|---|
| `미소금융재단` | `미소금융` | 별칭 통일 |
| `정부 R&D` | `정부 R&D 무상 지원금` | 카탈로그 정식명 일치 |
| `미상(재신청 승인)`, `미상(2년 연속)`, `타 기관(즉시 승인)`, `1차 기관` | `비특정 기관` | 원문에 기관명 미기재 → 통일 플레이스홀더 |
| `다수 기관`, `3개 기관 동시`, `4개 기관 분산` | `비특정 다수 기관` | 상동(복수 기관, 명칭 미기재) |

**정규화 후 기관 어휘(14종)**
- 핵심 기관/카탈로그 프로그램(9): 소상공인시장진흥공단 · 지역신용보증재단 · 신용보증기금 · 기술보증기금 · 중소벤처기업진흥공단 · 미소금융 · 성장촉진 보증대출 · 지자체 관광진흥기금 · 정부 R&D 무상 지원금 → 모두 `funding-agencies.json` 에 존재
- 카탈로그 외 일반 프로그램(3, 원문 기반·의도적 유지): 정부 직접 자금 · 정부 고정금리 대환 제도 · 정책자금(업체 맞춤) → 특정 기관이 아닌 자금 경로(케이스 59~61)라 카탈로그에 없음이 정상
- 플레이스홀더(2): 비특정 기관 · 비특정 다수 기관

## 3. 업종/태그 표기 통일 (industryCategory)

- 문제: `industry` 자유 라벨이 44종으로 불일치("요식업" vs "요식업/분식", "제조업" vs "제조업(법인)" 등).
- 조치: 원본 `industry` 라벨은 가독성 위해 **보존**하고, `diagnosis.ts` 의 `IndustryCategory` 와 동일한 **6-value 통제 어휘** `industryCategory` 필드를 추가.
- 통제 어휘: `제조` · `도소매` · `음식/외식` · `서비스` · `IT/지식서비스` · `건설/기타`

**분류 결과**

| industryCategory | 건수 |
|---|---|
| 제조 | 16 |
| 음식/외식 | 13 |
| 도소매 | 11 |
| 서비스 | 11 |
| 건설/기타 | 11 |
| IT/지식서비스 | 2 |

- 6-value 밖으로 벗어난 케이스: **0건**
- 농업법인·특수(대환/저신용/1인) 등 6분류에 없는 케이스는 `건설/기타`(catch-all)로 매핑 — `diagnosis.ts` 의 catch-all 규칙과 일치.

## 4. searchTags 품질 점검

- 조치: 전 케이스에 매칭용 `searchTags` 배열 신규 추가(서사 스캔 + 구조 필드 기반).
- 구성: `industryCategory` + 정규화 기관명 + 자금목적(운전/시설/창업) + 상황 태그(저신용·고금리대환·기대출과다·세금체납·재무제표오류·업종코드·특례자금·실사대응·매출성장·매출하락·무매출·1인사업장·기관전환·순차조달·병행조달·재도전·청년·R&D·무상지원금·증액심사 등).
- 품질 지표: 케이스당 **3~10개(평균 6.3)**, 빈 태그 케이스 **0건**, 43종 태그.
- 상위 태그: 운전자금(39) · 소상공인시장진흥공단(37) · 병행조달(34) · 기대출과다(25) · 저신용(20) · 창업초기(16) · 시설자금(12) · 고금리대환(11) …
- 활용: `diagnosis.ts` 의 사례 매칭(`caseMatchScore`) 시 태그 교집합으로 유사도 보강 가능.

## 5. JSON 스키마 일관성

- 12개 JSON 파일 모두 `json.load` 통과, 최상위 `meta` 보유.
- 케이스 배열: **단일 키셋**(모든 케이스 동일 필드), 스키마 드리프트 0.
- 최종 케이스 스키마(20 필드):
  `id, title, industry, industryCategory, businessAge, revenue, creditStatus, debtStatus, employees, fundingPurpose, institutions, approvedAmount, situation, strategy, keyPoint, risk, lesson, upsellOpportunity, sourceNote, searchTags`
- 기타 파일 배열 키: `agencies(9)` · `checkpoints(17)` · `fundingTypes(3)` · `scriptGroups(11)/scripts(42)` · `upsells(13)` · `rules(10)` · `rejectionReasons(12)` — 각 항목 내부 필드 일관.

## 6. 누락 필드 확인

- 케이스 필수 필드 누락: **없음**(모든 케이스 20필드 존재).
- `null` 값 현황(원문 미기재 → 의도적 null, 오류 아님):
  - `employees` 58건 — 부록이 직원 수를 거의 표기하지 않음
  - `creditStatus` 29건 — 신용 미기재 케이스
  - `revenue` 23건 — 매출 미기재 케이스
  - `debtStatus` 4건 — 부채 미기재 케이스
- 판단: 위 `null` 은 소스 특성상 정상. AI 코치/진단에서 결측 처리(가중치 제외)로 다루면 됨. 임의 추정값 삽입은 하지 않음.

## 7. 적용한 수정 요약 (최소 수정 원칙)

1. `funding-cases.json` `institutions` 표기 통일(별칭·플레이스홀더).
2. `funding-cases.json` 전 케이스에 `industryCategory`(6-value) 추가.
3. `funding-cases.json` 전 케이스에 `searchTags` 추가.
4. `funding-cases.json` `meta` 에 `schemaFields` · `industryCategoryVocabulary` · `coreAgencies` · `validationNote` 추가.

> 그 외 지식 파일(agencies/checkpoints/scripts/upsells/playbook 등)은 서사·구조가 이미 일관되어 **수정하지 않음**. 새 지식 파일도 생성하지 않음(본 리포트 제외).

## 8. 연결 준비 상태(Connection-Readiness)

- `industryCategory` 가 `diagnosis.ts` 의 `IndustryCategory` 와 1:1 대응 → 사례 매칭에 바로 사용 가능.
- 정규화된 `institutions` 가 `funding-agencies.json` 명칭과 일치 → 기관 추천 결과와 사례를 키로 연결 가능.
- `searchTags` 로 태그 기반 유사도(입력 조건 ↔ 사례) 보강 가능.
- 남은 `null` 은 결측 처리 규칙만 정의하면 됨(추정값 주입 불필요).

**결론: 지식베이스는 AI 코치/`diagnosis.ts` 연결에 필요한 정확성·일관성을 충족.** 중복 없음, 스키마 단일, 기관·업종 표기 통일, 매칭 태그 확보.
