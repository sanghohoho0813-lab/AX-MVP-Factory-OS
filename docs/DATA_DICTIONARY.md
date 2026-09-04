# DATA_DICTIONARY — System of Record 정의

같은 Supabase project(`mirae-ai-lab`) 안에서 각 엔티티의 **정본이 어디인지**, 누가 쓰고 누가 읽는지, 고객에게 보이는지, 얼마나 민감한지를 정한다.
값이 두 곳에 있으면 여기 적힌 SoR 이 이긴다.

범례 — 고객 노출: **N** 없음 · **P** 투영(allowlist)으로만 · **Y** 직접 조회 가능. 민감도: L/M/H.

| 엔티티 | 테이블 / 로컬 키 | SoR 소유 | 쓰기 | 읽기 | 고객 노출 | 민감도 | 보존 | 표면 간 사용 |
|---|---|---|---|---|---|---|---|---|
| Customer Account | `profiles` (id=auth.users) | 고객 플랫폼 | 고객 본인·서버(가입 트리거) | 본인·관리자·내부(이메일만 조회) | Y(본인) | M(연락처) | 계정 유지 중 | 내부는 `portal_client_links.profile_id` 로만 참조 |
| Portal Client Link | `portal_client_links` | **브릿지** | 내부 멤버(사람이 확정) | 내부 멤버 · 고객은 RPC 로 자기 것만 | P | M | 연결 유지 중(`status` 로 revoke) | 두 표면의 유일한 접점 |
| Operations Client | `operations_clients` (+`payload`) / `axmvp.v1.operations_clients` | 내부 OS | 내부 멤버 | 내부 멤버 | **N** (회사명·단계만 투영) | **H** (메모·수임료·자금판단) | 보관(archivedAt) 후에도 유지 | 고객사 SoR |
| Organization | `organizations` | 내부 OS(AX STUDIO) | 내부 | 내부 | N | M | — | 링크의 optional 참조 |
| Project (AX) | `projects` | 내부 OS(AX STUDIO) | 내부 | 내부 | N | M | — | 링크의 optional 참조 |
| Service Work | `operations_clients.payload.services[6]` | 내부 OS | 내부 | 내부 | N — 고객 단계 6종(`portal_client_links.customer_stage`)만 P | M | — | 내부 상태→고객 단계는 추천만(D-09) |
| Document (내부 서류함) | `operations_clients.payload.documents[10]` + Storage `client-documents/{ws}/{client}/…` | 내부 OS | 내부 | 내부(서명 URL) | N | **H**(신분증·인증서 보관 위치) | — | 공유 시 `portal_documents(visibility=shared)` 행으로만 |
| Portal Document | `portal_documents` + Storage `{ws}/portal/{link}/…` | **브릿지** | 내부(요청·검토·공유) · 고객(업로드, RPC) | 내부 · 고객은 RPC | P(requested/customer_uploaded/shared) | H | — | `internal_note` 는 절대 투영 안 함 |
| Payment / Fee | `operations_clients.payload.fees[]` | 내부 OS | 내부 | 내부 | **N** | **H** | — | 고객 결제(`product_payments`)와 별개 — 자동 대사 없음 |
| Funding Application | `operations_clients.payload.fundingApplications[]` | 내부 OS | 내부 | 내부 | N | M | — | 홈 "지원사업 마감" 신호 |
| Activity (활동 기록) | `operations_clients.payload.activity[]` (≤200) | 내부 OS | 시스템(with* 헬퍼) | 내부 | N | M | 200건 순환 | 하루 정리의 "오늘 처리" |
| Journal Entry | `ops_journal_entries` / `axmvp.v1.ops_journal_entries` | 내부 OS | owner 본인 | **owner 본인만** | **N** | **H** | — | 홈 Top 3(후속조치)·하루 정리 |
| Diagnosis Lead | `business_diagnosis_leads` | 고객 플랫폼 | 서버(service_role) | 관리자 | Y(본인 결과 화면) | M | — | INSERT 트리거 → `customer_events(diagnosis_completed)` |
| Diagnosis Session | `business_diagnosis_sessions` | 고객 플랫폼 | 서버 | 관리자 | Y(본인) | M | — | 이벤트 payload 에 포함하지 않음 |
| Service Order | `service_orders` (payment_id→`product_payments`) | 고객 플랫폼 | 서버(PortOne 검증/웹훅) | 본인·관리자 | Y(본인) | M(`internal_memo` H) | — | INSERT 트리거 → `customer_events(service_order_created)`; `internal_memo` 제외 |
| Consult Lead | `consult_leads` | 고객 플랫폼 | 서버 | 관리자 | N | M | — | INSERT 트리거 → `customer_events(consultation_requested)` |
| Customer Event | `customer_events` / `axmvp.v1.customer_events` | **브릿지** | 트리거(security definer) · 내부(상태) | 내부 멤버 | **N** | M | — | `dedupe_key` UNIQUE; `customer_safe_payload` 는 고객 제출값만 |
| Portal Update | `portal_updates` | **브릿지** | 내부(명시 발행) · 고객(조치 완료, RPC) | 내부 · 고객은 published 만 RPC | P(published) | M | archive 로 내림 | UPDATE 트리거 → `customer_action_completed` |
| Portal Request | `portal_requests` | **브릿지** | 고객(RPC) · 내부(답변·상태) | 내부 · 고객은 RPC | P | M | — | INSERT 트리거 → `customer_request_created` |
| Intake Routing | `customer_intake_routing` | 브릿지 | 내부 | 내부 | N | L | — | 연결 전 이벤트가 갈 워크스페이스 |
| Deliverable | `deliverable_packages` (AX STUDIO) | 내부 OS | 내부 | 내부 | N — 공유하려면 `portal_documents(shared)`로 | M | — | 결과자료 고객 공개는 명시 공유만 |
| UI Preference | `ui_preferences` + `axmvp.ui.preferences` | 사용자 | 본인 | 본인 | — | L | — | 테마·글자·모션 |

## 투영 필드 (고객이 보는 전부)

`portal_project_projection(link_id)` → `project{link_id,name,company_name,stage,status,consultant_name,updated_at}` · `updates[]{id,category,title,body,action_required,action_label,due_date,completed_at,published_at}` · `documents[]{id,document_type,title,status,visibility,file_name,storage_path(공개분만),customer_note,requested_at,uploaded_at,verified_at}` · `requests[]{id,request_type,title,body,status,answer,created_at,answered_at}`

포함되지 않는 것: `workspace_id`, `operations_client_id`, `profile_id`, `internal_note`, `handling_note`, `customer_safe_payload`, 수임료·미수금, 활동 기록, 업무 일기, 내부 8단계.

## 로컬 모드 키 (localStorage)

`axmvp.v1.{operations_clients, ops_journal_entries, customer_events, portal_client_links, portal_updates, portal_requests, portal_documents}` — 로컬 백업(설정 > 데이터)에 함께 포함된다. 로컬 모드의 고객 이벤트는 "샘플 만들기"로만 생기며 payload 에 `demo:true` 가 붙는다.
