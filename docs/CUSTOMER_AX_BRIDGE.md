# CUSTOMER ↔ AX BRIDGE — 고객 행동이 내부 업무가 되고, 처리 결과가 고객에게 돌아가는 길

정본 SQL: `supabase/migrations/20260903000006_customer_bridge.sql` · 계약 테스트: `supabase/tests/bridge_contract.sql`

## 1. Closed Loop

```
고객(miraeailab.com)                     브릿지(같은 DB)                        내부(MIRAE AI LAB OS)
─────────────────────                   ─────────────────                     ──────────────────────
사업 진단 완료 ──insert lead──▶ trigger ─▶ customer_events(diagnosis_completed) ─▶ 고객 이벤트함 / 오늘 Top 3
서비스 주문·결제 ─insert order─▶ trigger ─▶ customer_events(service_order_created) ─▶ (추천) 업무 시작
상담 신청 ───────insert lead──▶ trigger ─▶ customer_events(consultation_requested)
서류 업로드 ──rpc register_doc─▶ portal_documents(uploaded) ─trigger─▶ customer_events(document_uploaded) ─▶ 확인 완료 / 다시 요청
요청 보내기 ──rpc create_req──▶ portal_requests(open) ──trigger──▶ customer_events(customer_request_created) ─▶ 답변 / 해결
조치 완료 ────rpc complete────▶ portal_updates.customer_completed_at ─trigger─▶ customer_events(customer_action_completed)

내부 "고객에게 업데이트" ──insert published──▶ portal_updates ──rpc portal_project──▶ My MIRAE > 업데이트 / 해야 할 일
내부 "서류 요청" ─────────insert requested──▶ portal_documents ─rpc portal_project─▶ My MIRAE > 요청받은 서류
내부 "공유" ──────────────visibility=shared──▶ portal_documents + storage 정책 ──▶ My MIRAE > 결과
내부 "고객 단계" ─────────customer_stage──────▶ portal_client_links ─────────────▶ My MIRAE > 진행 상태
```

## 2. 이벤트 종류 · 우선순위 (규칙)

| event_type | 원천 | priority | 이유 |
|---|---|---|---|
| service_order_created | service_orders INSERT | high | 결제한 신규 주문 |
| document_uploaded | portal_documents (customer, uploaded) | high | 확인 필요한 제출물 |
| consultation_requested | consult_leads INSERT | high | 고객이 직접 요청 |
| customer_request_created | portal_requests INSERT | high(상담·일정) / medium | 종류별 |
| diagnosis_completed | business_diagnosis_leads INSERT | high(A등급) / medium | 리드 등급 |
| customer_action_completed | portal_updates UPDATE | medium | 후속 확인 |
| customer_reply, profile_updated | (예약) | low | 참고 |

이벤트함 정렬: status(new→linked→in_progress→ignored→resolved) → priority → 최신순. 모든 고객 이벤트를 빨간 경고로 만들지 않는다.

## 3. Dedupe · Provenance

- `dedupe_key = source_type:source_id:event_type` UNIQUE, `on conflict do nothing`.
- 서류 업로드는 `source_id = document_id:uploaded_at` 로 재업로드마다 별도 이벤트(다시 요청 → 재제출 흐름).
- 모든 이벤트에 `source_type/source_id/occurred_at/payload_version` 이 있어 어디서 왔는지 추적된다. 이벤트는 알림처럼 소비 후 버리지 않고 `handled_at/handled_by/handling_note` 와 함께 남는다(Evidence).

## 4. 연결 규칙

- 트리거는 `profile_id` 만 찾는다(이메일 일치·결제 계정). 활성 `portal_client_links` 가 정확히 1개일 때만 이벤트에 link 를 붙이고 status 를 `linked` 로 둔다. 2개 이상이면 붙이지 않는다.
- 고객사 연결은 사람이 `LinkCustomerModal` 에서 확정한다: 기존 고객사 선택(후보 표시) 또는 고객 제출값으로 새 고객사 생성(값 미리보기). 계정이 확인되면 그때 `portal_client_links` 를 만든다.
- 이벤트에는 `operations_client_id` 도 있어 계정 연결 없이 "어느 고객사 건"인지 먼저 정할 수 있다.

## 5. 보안 계약

| 원칙 | 구현 |
|---|---|
| 고객은 기본 테이블 무접근 | portal_* 테이블에 고객 정책 없음, anon 권한 revoke |
| 고객 투영 allowlist | `portal_project_projection` 의 명시 컬럼 — 내부 ID·메모·수임료·일기·활동기록 제외 |
| 내부 미리보기 = 고객 화면 | `portal_preview_project`(워크스페이스 멤버) 가 같은 함수 호출 |
| 워크스페이스 격리 | 모든 브릿지 테이블 `workspace_id` + `is_workspace_member/can_write_workspace` |
| 일기 비공개 | `owner_id = auth.uid()` |
| 스토리지 | 고객 쓰기: `{ws}/portal/{link}/…` 만 · 읽기: 자기 업로드 + `shared_with_customer` 만 · 내부 정책은 그대로 |
| 프론트에 service_role 없음 | 두 앱 모두 anon 키만 · 공개 앱의 서버리스는 `SUPABASE_SERVICE_ROLE_KEY` 를 서버에서만 |
| 업로드 경로 발급 | `portal_upload_path()` 가 서버에서 만들고 `portal_register_document()` 가 접두를 검증 |

계약 테스트가 위 항목을 모두 실행으로 확인한다(§bridge_contract.sql).

## 6. 상태 (2026-09-03)

- SQL·RLS·RPC·트리거·테스트: **작성 완료, 로컬 PostgreSQL 16 에서 녹색**.
- Production Supabase(`mirae-ai-lab`) 적용: **미적용 (READY)** — Claude 환경에서 project 자격증명·CLI 가 없어 임의 apply 하지 않았다. 적용 절차는 `docs/SETUP.md`.
- 적용 전 화면 동작: 내부 이벤트함·고객 플랫폼 탭은 "준비 중(READY)" 안내, 고객 `/my-projects` 는 "준비하고 있습니다" 안내. 나머지 기능 정상.
