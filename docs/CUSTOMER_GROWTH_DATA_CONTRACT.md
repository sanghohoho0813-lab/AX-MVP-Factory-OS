# 고객성장관리(My MIRAE) — 데이터 계약 (D-681 · 0033)

> 내부 OS ↔ 홈페이지(My MIRAE) 사이에 오가는 것은 **이 문서의 함수 · 칸뿐**이다. 홈페이지 쪽 같은 내용: 홈페이지 `docs/CUSTOMER_DATA_CONTRACT.md` '고객성장관리' 절.
> 원문: `supabase/migrations/20261127000033_customer_growth.sql`(추가만 — 예전 표 · 함수 · 정책을 바꾸지 않는다).

## 1. 원칙

1. **고객은 표를 읽지 못한다.** 두 표 모두 고객용 정책 0 — 아래 고객 함수(서버가 칸을 고른 모양)로만 본다.
2. **고객 함수는 모두 `portal_link_owned(연결 id)` 관문을 지난다** — 로그인한 그 계정의 · 활성(active) 연결만. 남의 것 · 멈춘 연결 · 끊은 연결 · 없는 번호는 모두 똑같이 `not found(P0002)`.
3. **보고서는 업체 단위 · 열람/확인 기록은 계정 단위.** 같은 업체에 계정이 둘이면 같은 보고서를 보고, 기록은 따로 남는다.
4. **열람 · 확인은 '보셨다' 는 표시일 뿐** — 계약 검수 · 대금 승인 · 동의가 아니다(고객 화면에 늘 이 한 줄).
5. **내부 미리보기는 아무것도 기록하지 않는다** — 직원이 본 것이 고객 열람으로 세어지지 않는다.
6. **직원은 열람 기록을 만들거나 고칠 수 없다**(쓰기 정책 0 · 트리거 · 고객 함수 안에서만 `auth.uid()` 로 씀).
7. **내부 칸(출처 · 발행한 사람 · 내린 까닭 · 발행 번호 · 작업공간 · 업체 id)은 고객 모양에 없다.**
8. **0026 허락 문 그대로** — 대표가 팀장 작업공간을 볼 때 허락(또는 0032 늘 보기)이 없으면 보고서 · 기록 · 내부 함수 모두 0.

## 2. 표

### `portal_reports` — 발행한 보고서(판마다 한 줄 · 지우지 않음)

| 칸 | 뜻 | 고객에게 |
|---|---|---|
| `id` | 보고서(판) 번호 | 보임 |
| `workspace_id` · `operations_client_id` | 작업공간 · 업체 | 없음 |
| `report_group` · `version` | 같은 보고서의 판 묶음 · 판 번호(1부터) — `unique(report_group, version)` | 판 번호 · '정정본' 만 |
| `kind` | `consult_summary` 상담 요약 · `progress` 경과 · `interim` 중간 · `final` 최종 · `monthly` · `annual` | 보임 |
| `title`(1~120) · `period_start` · `period_end` · `summary`(≤1000) | 제목 · 기간 · 한 줄 요약 | 보임 |
| `sections` | `[{key, title, items:[{text, date?, tag?}]}]` — 서버가 **허용된 칸만 골라 다시 만든다**(칸 8 · 줄 40 · 한 줄 300자 · 모르는 칸 버림) | 한 편 화면에서만 |
| `staff_note`(≤1000) | 담당자 한마디 | 한 편 화면에서만 |
| `correction_note`(≤300) | 정정할 때 무엇을 고쳤는지 — 2판부터 **꼭** | 보임 |
| `status` | `published` · `superseded`(새 판이 나옴) · `withdrawn`(내림) | 상태만 |
| `supersedes` · `superseded_by` | 앞 판 · 뒤 판 | 새 판 id 만(`latest_id`) |
| `source_refs` | 줄마다 근거(내부 감사용) | **없음** |
| `client_key`(8~80) | 발행 번호 — `unique(workspace_id, client_key)` 같은 창에서 두 번 눌러도 한 편 | **없음** |
| `published_by` · `published_at` | 발행한 사람 · 때 | 때만 |
| `withdrawn_at` · `withdrawn_by` · `withdrawn_reason` | 내린 때 · 사람 · 까닭 | 때만(까닭 없음) |

### `portal_receipts` — 고객 계정이 남긴 방문 · 열람 · 확인

| 칸 | 뜻 |
|---|---|
| `portal_client_link_id` · `profile_id` | 어느 연결의 어느 계정 |
| `item_kind` | `home`(고객 화면 방문) · `report`(보고서 열람) · **D-685(0034)** `document`(공유 서류를 [열기]로 연 때) · `result`(결과 글이 '결과' 탭에서 1초 넘게 보인 때) |
| `item_id` · `item_version` | 무엇의 몇 판 — `unique(link, profile, kind, item, version)` 계정 · 판마다 한 줄 |
| `first_seen_at` · `last_seen_at` · `seen_count` | 처음 · 최근 · 횟수(1분 안에 다시 와도 횟수 그대로) |
| `acknowledged_at` | [확인했어요] 누른 때 — 다시 눌러도 처음 때 그대로 |

권한: 앱 계정(`authenticated`)은 **SELECT 하나**(그것도 작업공간 구성원 정책 + 허락 문) · `anon` 0. 쓰기는 아래 함수 안에서만.

## 3. 고객 함수(홈페이지가 부른다)

| 함수 | 돌려주는 것 | 기록 |
|---|---|---|
| `portal_growth_summary()` | 내 활성 연결마다 `{link_id, reports_total, reports_unseen, reports_unacked, latest_report, first_visit_at}` | 없음 |
| `portal_reports(p_link_id)` | 그 업체의 발행 중 보고서 목록(최신 판만 · 내린 것 빼고 · 본문 없음) + 내가 연 때 · 확인한 때 | 없음 |
| `portal_report(p_link_id, p_report_id)` | 발행 중이면 본문 + `company_name` · `consultant_name` / 정정된 판이면 `{status:'superseded', latest_id}` / 내린 판이면 `{status:'withdrawn', withdrawn_at}`(본문 없음) | 없음 |
| `portal_mark_report_seen(p_link_id, p_report_id)` | `{seen_at, acknowledged_at}` — 화면 끝이 1초 넘게 보인 뒤에 부른다 | 계정 · 판마다 한 줄 |
| `portal_acknowledge_report(p_link_id, p_report_id)` | `{seen_at, acknowledged_at}` | 확인 시각(처음 한 번) |
| `portal_mark_home()` | 활성 연결 수 — 고객 화면에 들어올 때 | 연결마다 방문 한 줄 |
| `portal_mark_item_seen(p_link_id, p_kind, p_item_id)` (0034) | `{seen_at}` — `p_kind` = `document`(공유 · 파일 있는 서류를 연 뒤) · `result`(발행한 결과 글이 1초 보인 뒤). 그 연결(활성)의 고객 · **그 연결에 공유한 것만** — 남의 것 · 내부만 · 요청만 · 파일 없는 공유 · 초안 · 진행 소식 · 멈춘 연결은 `P0002` · 모르는 종류 `22023` | 계정 · 자료마다 한 줄(1분 안 반복은 횟수 그대로) |
| `portal_result_receipts_since()` (0034 · 읽기만) | 이 기록을 남기기 시작한 때(0034 를 처음 넣은 때 · 다시 실행해도 그대로) — 그 전에 공유한 자료는 '안 열어 봄' 으로 세지 않는다 | 없음 |

## 4. 내부 함수(OS 가 부른다)

| 함수 | 누가 | 하는 일 |
|---|---|---|
| `portal_publish_report(p_workspace_id, p_client_id, p_client_key, p_kind, p_title, p_period_start, p_period_end, p_summary, p_sections, p_staff_note, p_source_refs, p_supersedes, p_correction_note)` | 그 작업공간에 쓸 수 있는 사람 + 허락 문 | 발행 · 같은 `client_key` 면 같은 결과(`created:false`) · `p_supersedes` 면 앞 판을 **잠그고**(FOR UPDATE) superseded 로 · 고친 곳 한 줄 필수 |
| `portal_withdraw_report(p_report_id, p_reason)` | 같음 | 내림(줄은 남김) · 까닭은 내부에만 |
| `portal_preview_reports(p_workspace_id, p_client_id)` · `portal_preview_report(p_report_id)` | 작업공간 구성원 + 허락 문 | 고객이 보는 모양 그대로 · **기록 0** |
| `portal_link_accounts(p_workspace_id, p_client_id)` | 같음 | 그 업체 연결 계정의 `{link_id, email}` — 계정마다 '열어 봄 · 확인' 을 이메일로 보이게(고객 프로필 표 RLS 는 그대로) |

오류(사람이 읽는 글은 한국어 · 고객에게는 'not found' 하나):

| 코드 | 뜻 | 화면 |
|---|---|---|
| `P0002` not found | 남의 것 · 없는 번호 · 멈춘/끊은 연결 | 고객: '이 계정에 연결된 프로젝트의 보고서만 볼 수 있어요' |
| `42501` not allowed | 쓸 권한 없음 | '이 업체에 보고서를 낼 권한이 없어요.' |
| `22023` | 모양 · 길이 · 빈 제목 · 고친 곳 빠짐 | 서버 글 그대로 |
| `40001` | 그 사이 다른 기기에서 정정 · 내림 | '이미 정정했거나 내린 보고서입니다 — 새로 불러온 뒤…' |

## 5. '꺼짐' — 0033 이 없거나 되돌렸을 때

- 앱이 '꺼짐' 으로 보는 오류: 함수 · 표 없음(`PGRST202` · `42883` · `42P01` · schema cache) · **0033 함수 실행 권한 없음** · **두 표 읽기 권한 없음**.
  다른 오류(로그인 만료 · 남의 업체 · 다른 함수 권한)는 꺼짐으로 숨기지 않는다(`isGrowthOff` — 단위 시험 OFF-a~c).
- 꺼지면: OS 는 '고객에게 보낸 보고서' 칸 · 계정 줄의 방문 표시 · 오늘 칩만 숨고 나머지 탭은 예전 그대로. 홈페이지는 성장 홈 칸 · '보고서' 탭만 숨고 목록 · 상세는 예전 그대로.
- 되돌리기 `supabase/manual/rollback_0033.sql` = 함수 11개 실행 권한 + 두 표 읽기 권한을 거둔다. **표 · 기록 · 함수 본문은 지우지 않는다.** 다시 켜기 = 0033 파일 통째로 다시.

## 6. 화면이 지키는 것(서버 밖)

- 초안의 '내부 글'(직원이 적은 다음 단계)은 꺼진 채 — 켠 줄만 발행된다. 수수료 · 메모 · 업무 일기는 초안 재료가 아니다.
- 자금 줄은 한 사업 한 줄 · '입금 확인' 과 '선정(아직 입금 전)' 을 글로 나누고 **합계를 만들지 않는다.**
- 안내 문구에는 보고서 주소만 — 금액 · 서류 이름 · 내부 id 0. 보내는 것은 사람(복사) — 앱은 외부로 보내지 않는다.

## 7. 결과 자료 열람(D-685 · 0034) — 더한 것만

- 표는 그대로(`portal_receipts`) — 종류 검사만 `home · report` → `home · report · document · result` 로 넓힘(예전 줄은 모두 그대로 맞는다 · 한 문장).
- 직원은 기록을 만들 수 없다(그 연결의 고객이 아니면 `not found`). 내부 미리보기 · 대표 '고객 화면 보기' 는 이 함수를 부르지 않는다.
- OS: 업체 › 고객 플랫폼 탭의 공유 서류 · 결과 글 줄에 '· 열어 보심 m/d(· n번)' / '· 아직 안 여심(n일째)' / '· 열람 기록 전 공유'.
  후속 규칙 `result_unseen` — 활성 연결에 공유한 것 · 기록 시작 뒤 공유한 것만 · 7일 넘게 아무 계정도 안 염 → 한 업체 한 줄(오늘 '고객 화면 챙길 것' · 탭 빨간 줄). 열면 저절로 빠짐.
- 꺼짐: `portal_result_receipts_since` 를 못 부르면(0034 전 · 되돌림) 새 줄 · 규칙만 숨김. 홈페이지는 기록 실패를 조용히 넘긴다(화면 그대로).
- 되돌리기 `supabase/manual/rollback_0034.sql` = 함수 2개 실행 권한만 거둔다(기록 · 넓힌 검사 · 함수 본문 그대로). 확인 `verify_after_0034.sql` 1~4 '좋음'.

## 8. 고객 화면 '새 결과 자료'(D-686 · 0035) — 더한 것만

| 함수(고객 · 읽기만) | 돌려주는 것 |
|---|---|
| `portal_results_state(p_link_id)` | 그 연결(활성 · 내 것)의 공유 서류(파일 있음) · 발행한 결과 글마다 `{kind, id, seen_at, is_new}` — `is_new` = 기록 시작(0034 넣은 때) 뒤 공유 · 이 계정이 아직 안 엶. 남의 · 멈춘 연결은 `P0002` |
| `portal_result_summary()` | 내 활성 연결마다 `{link_id, results_new}` |

- 아무것도 기록하지 않는다(부르기만 해서는 '열어 봄' 이 생기지 않는다 — 열어 봄은 0034 `portal_mark_item_seen`).
- 계정마다 따로 · 제목 · 파일 이름 · 경로 · 내부 칸은 돌려주지 않는다(제목은 기존 투영 함수에서).
- 대표 '고객 화면 보기' 는 같은 규칙의 순수 함수 `newResultIds`(OS)로 그린다. 되돌리기 `rollback_0035.sql`(실행 권한만) · 확인 `verify_after_0035.sql` 1~3 '좋음'.


## 9. 고객 화면 '담당자가 추천해요'(D-689 · 0036) — 더한 것만

| 표 | 무엇 | 누가 쓰나 |
|---|---|---|
| `portal_recommendations` | 담당자가 고객 화면에 올린 추천(업체 단위 · `grant` 지원사업 / `task` 다음 과제 · 제목 80 · 근거 160 · 마감 · http(s) 주소 · 내부 출처 `{type, id}` · `shown` / `withdrawn`) | 서버 함수만(직원 · 고객 모두 표에 직접 못 씀) |
| `portal_recommendation_interest` | 고객 계정이 [관심 있어요] 누른 때(추천 · 계정마다 한 줄) | 서버 함수만 · 그 연결(활성)의 고객만 |

| 함수 | 누가 | 하는 일 |
|---|---|---|
| `portal_recommendations(p_link_id)` | 고객(읽기만) | 그 연결 업체의 올라와 있는 추천 `{id, kind, title, reason, deadline, link_url, shown_at, interested_at}` — 내부 출처 · 올린 사람 · 올리기 번호 0 |
| `portal_recommendation_interest(p_link_id, p_rec_id)` | 고객 | [관심 있어요] — 올라와 있는 추천만 · 다시 눌러도 처음 때 · 신청 · 계약이 아님 |
| `portal_show_recommendation(...)` | 내부(쓸 수 있는 사람 · 0026 허락 문) | 올리기 — 같은 올리기 번호 · 같은 출처면 처음 것 · 업체마다 3개까지(업체 하나만 잠가 동시에 올려도 넘지 않음) · 주소는 http(s) 만 |
| `portal_withdraw_recommendation(p_rec_id)` | 내부 | 내리기(지우지 않음 · 관심 기록은 남음) |

- 직원은 두 표를 같은 작업공간이면 읽는다(RLS · 0026 허락 문 · 0023 작업공간 고정 · 같은 작업공간 지킴 트리거).
- 내부 판정 · 금액은 고객에게 가지 않는다 — 후보 글은 OS 규칙(`portalRecoRules`)이 금액 · 점수 없이 만들고, 화면은 금액 · 점수가 든 글을 올리지 못하게 막는다(서버는 길이 · 주소만 본다).
- 오늘 '고객 화면 챙길 것' 의 관심 줄은 업체 기록 `care.lastContactAt`(안부 연락 날) 뒤의 관심만 — [연락했어요] 로 빠진다. 저절로 보내는 것 0.
- 되돌리기 `rollback_0036.sql`(함수 넷 실행 · 두 표 읽기 권한만) · 확인 `verify_after_0036.sql` 1~6 '좋음'. 로컬 시험 `test-0036-recommendations.sql` 59가지.
