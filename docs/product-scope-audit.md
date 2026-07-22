# 제품 기능 범위 감사 (Stage 12B-UX 5차)

- 작성일: 2026-07-21
- 기준 코드: `src/app/appRouteChildren.tsx`(라우트), `src/components/layout/Sidebar.tsx`(현재 메뉴), `src/repositories/index.ts`(저장소), `src/services/*`(도메인 서비스)
- 기준 운영 모드: **로컬 모드(localStorage)**. Supabase 코드(`src/app/SupabaseApp.tsx`, `src/pages/settings/SupabaseSettingsView.tsx`, `src/lib/supabase*`)는 존재하지만 실연결은 다음 스테이지 과제이므로, 타 기기 공유·다중 사용자 협업·클라우드 저장이 전제인 기능은 "보류(대기)"로 분류한다.

이 문서는 전체 기능을 아래 5개 등급으로 분류하고, "core 모드"(처음 쓰는 사용자에게 보여줄 단순화된 기본 메뉴)에서의 노출 여부를 제안한다. **이 단계에서는 어떤 기능도 삭제하지 않는다** — 분류는 노출 순서·기본 숨김을 정하기 위한 것이다.

## 분류 기준

| 등급 | 의미 |
| --- | --- |
| **A. 핵심 기능** | 처음 사용하는 사용자가 기본적으로 사용하는 기능 |
| **B. 고급 운영 기능** | 핵심 결과(진단→선택→설계→제출자료)가 나온 뒤 사용하는 기능 |
| **C. 내부 관리 기능** | 일반 사용자에게 기본 노출이 불필요한 설정·시스템 기능 |
| **D. 보류 기능** | 클라우드·실데이터·외부 연동이 없어 본격 사용이 어려운 기능 |
| **E. 통합·제거 검토** | 다른 기능과 중복되거나 목적이 불명확한 기능 |

---

## 1. 홈·공통

| 기능명 | 사용자 목적 | 관련 라우트 | 저장 데이터(리포지토리) | 선행조건 | 결과물 | 로컬 사용 가능 | 분류 | core 노출 | 유지·숨김·통합 이유 / 중복 / 운영 제약 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 오늘 할 일(홈) | 지금 해야 할 다음 행동 1개와 이어서 할 프로젝트를 바로 보여줌 | `/` (`DashboardPage` + `journeyService.computeProjectJourney`) | 읽기 전용 — `projectRepository`·`organizationRepository` 등 전 도메인 집계 | 프로젝트 1개 이상(없으면 시작 안내) | 다음 행동 히어로, 이어서 하기 목록, 주의 프로젝트 | 가능 | **A** | **노출** | 첫 화면의 존재 이유. 유지 |
| 홈 운영 현황 상세 | KPI 스트립(선별 대기·설계 진행·중대 이슈 등)과 고객사 포트폴리오 건강도 확인 | `/` 내 토글(`showOps`) — `dashboardService.buildDashboardMetrics`, `PortfolioHealth` | 읽기 전용 집계(`countSelectionPending` 등 각 서비스 카운터) | 각 모듈 데이터 축적 | 운영 KPI·포트폴리오 표 | 가능 | **B** | 접힘(토글 유지) | 핵심 결과가 쌓인 뒤 의미. **중복**: 프로젝트 컨트롤 센터·고객사 상세·각 results 목록과 진행 현황 표시가 겹침(§11) |
| 전역 검색 | Ctrl/Cmd+K·`/` 로 고객사·프로젝트·지금 할 일·결과 화면으로 즉시 이동 | 라우트 없음(`components/search/GlobalSearch.tsx`, 헤더 상시) | 읽기 전용 — `organizationRepository`, `projectRepository` | 없음 | 화면 이동 | 가능 | **A** | **노출**(헤더) | 초심자 길찾기 보조. 유지 |
| Guided Demo(안내 데모) | 빈 상태에서 샘플 고객사·설문·결과를 자동 생성해 전체 흐름을 체험 | `/` 내 "데모 보기"·초기화(`guidedDemoService`, `DemoTourProvider`) | `guidedDemoRepository` + 전 도메인 리포지토리에 데모 데이터 기록 | 없음 | 데모 프로젝트 전체 여정 데이터 | 가능 | **A** | **노출**(홈 빈 상태에서만) | 첫 사용자 온보딩 핵심. 데모 "초기화"는 파괴적이므로 확인 모달 뒤에 유지 |

## 2. 고객·프로젝트

| 기능명 | 사용자 목적 | 관련 라우트 | 저장 데이터(리포지토리) | 선행조건 | 결과물 | 로컬 사용 가능 | 분류 | core 노출 | 유지·숨김·통합 이유 / 중복 / 운영 제약 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 고객사 관리(목록·상세·등록·수정) | 고객사 기본 정보·담당자·프로젝트 이력을 한곳에서 관리 | `/clients`, `/clients/new`, `/clients/:organizationId`, `/clients/:organizationId/edit` | `organizationRepository`, `activityRepository` | 없음(첫 진입점) | 고객사 카드·상세·활동 이력 | 가능 | **A** | **노출** | 모든 흐름의 시작. 유지. 고객사 상세의 단계 현황 표시는 §11 중복 검토 대상 |
| 프로젝트 등록 Wizard | 고객사에 AX/홈페이지 프로젝트를 단계형 폼으로 생성·수정 | `/projects/new`, `/projects/:projectId/edit` (`ProjectFormPage` + `WizardLayout`) | `projectRepository` | 고객사 1개 이상 | 프로젝트(유형 ax/website/둘 다) | 가능 | **A** | **노출**(고객사 화면에서 진입) | 유지. 유형에 따라 사이드바 작업공간 메뉴가 달라짐 |
| 프로젝트 컨트롤 센터 | 프로젝트 1건의 전체 여정(진단→…→제출)과 다음 행동, 모듈별 상태를 한 화면에서 확인 | `/projects/:projectId` (`ProjectDetailPage` + `JourneyFlow`) | 읽기 전용 — 전 도메인 컨텍스트(`getProject*Context`) + `activityRepository` | 프로젝트 존재 | 여정 플로우, 모듈별 요약 카드, 다음 행동 | 가능 | **A** | **노출** | 프로젝트 허브로 유지. 단, 홈·고객사 상세·results 목록과 "진행 현황" 표현 중복(§11) — 컨트롤 센터를 프로젝트 단위 현황의 단일 기준으로 삼을 것 |

## 3. 기업 진단

### 3-1. 진단 전문가 설정(콘텐츠 편집)

| 기능명 | 사용자 목적 | 관련 라우트 | 저장 데이터(리포지토리) | 선행조건 | 결과물 | 로컬 사용 가능 | 분류 | core 노출 | 유지·숨김·통합 이유 / 중복 / 운영 제약 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 진단 스튜디오 허브 | 질문은행·모듈·템플릿·설문·결과로 가는 전문가용 진입 화면 | `/diagnosis` (`DiagnosisStudioPage`) | 읽기 전용 | 없음 | 링크 허브 | 가능 | **C** | 숨김(고급 메뉴) | 일반 사용자는 프로젝트 작업공간의 "기업 진단"으로 충분. **중복**: 사이드바 작업공간 진입과 이중 경로 |
| 질문은행 | 진단 질문(유형·옵션·조건)을 만들고 관리 | `/diagnosis/questions`, `.../new`, `.../:questionId/edit` | `questionRepository` | 없음(기본 데이터 내장) | 재사용 가능한 질문 | 가능 | **C** | 숨김 | 콘텐츠 편집은 진단 설계 전문가 작업. 기본 질문 세트만으로 A 흐름 동작 |
| 진단 모듈 | 질문 묶음(모듈)을 구성 | `/diagnosis/modules`, `.../new`, `.../:moduleId/edit` | `surveyModuleRepository` | 질문은행 | 설문 조립용 모듈 | 가능 | **C** | 숨김 | 동상 |
| 진단 템플릿(빌더·미리보기) | 업종·목적별 설문 템플릿을 조립하고 미리보기 | `/diagnosis/templates`, `.../new`, `.../:templateId/edit`, `.../:templateId/preview` | `surveyTemplateRepository` | 모듈·질문 | 설문 템플릿 | 가능 | **C** | 숨김 | 동상. 템플릿 기본값만 노출하면 충분 |

### 3-2. 프로젝트 진단 흐름

| 기능명 | 사용자 목적 | 관련 라우트 | 저장 데이터(리포지토리) | 선행조건 | 결과물 | 로컬 사용 가능 | 분류 | core 노출 | 유지·숨김·통합 이유 / 중복 / 운영 제약 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 설문 설계(프로젝트) | 템플릿을 골라 대표자·현장용 설문 청사진을 확정 | `/diagnosis/projects/:projectId/setup` (`projectSurveyService`) | `projectSurveyBlueprintRepository` | 프로젝트 | 설문 청사진(ready) | 가능 | **A** | **노출**(작업공간 "기업 진단") | 진단 흐름의 시작. 유지 |
| 설문 링크 발급·응답 관리 | 응답자별 링크를 만들고 진행·제출 상태를 추적 | `/diagnosis/projects/:projectId/surveys`, `/diagnosis/surveys/:distributionId`, `.../response` (`surveyRuntimeService`, `surveyTokenService`) | `surveyDistributionRepository`, `surveyResponseRepository` | 설문 청사진 ready | 배포 링크·응답 원본 | 같은 브라우저에서 가능 | **A**(로컬) / **D**(타 기기 공유) | **노출** | 유지. **운영 제약**: 링크가 localStorage 기반이라 다른 기기·다른 사람 브라우저에서는 열리지 않음 → 실고객 원격 응답은 Supabase 실연결 후 가능 |
| 공개 설문 응답 화면 | 응답자가 로그인 없이 설문에 답변 | `/survey/:accessToken` (`PublicSurveyPage`, 앱 셸 밖 공개 라우트) | `surveyResponseRepository` | 발급된 링크 | 제출된 응답 | 같은 브라우저에서 가능 | **A**(로컬) / **D**(타 기기) | 메뉴 아님(링크 진입) | 유지. 제약은 위와 동일 |
| 진단 결과(분석 홈·확정) | 응답을 채점해 영역별 점수·추천을 확인하고 진단을 확정 | `/diagnosis/projects/:projectId/analysis`, `.../analysis/result` (`assessmentService`, `assessment/*` 엔진) | `assessmentRepository` | 제출 응답 1건 이상 | 확정 진단(점수·추천·요약) | 가능 | **A** | **노출** | 핵심 산출물. 유지 |
| 응답 비교 | 대표자 vs 현장 응답 차이를 비교 | `.../analysis/compare` (`comparisonEngine`) | 읽기 전용(진단 파생) | 응답 2건 이상 | 인식 차이 목록 | 가능 | **B** | 결과 화면 내 링크 | 심화 분석 — 결과가 나온 뒤 사용. 별도 메뉴 불필요 |
| 이슈 관리 | 자동 감지된 데이터·응답 이슈를 확인·처리 | `.../analysis/issues` (`issueDetection`) | `analysisIssueRepository` | 분석 실행 | 이슈 목록·확인 상태 | 가능 | **B** | 결과 화면 내 링크 | 동상 |
| 인터뷰 질문 | 진단 보완용 후속 인터뷰 질문 생성·기록 | `.../analysis/interview` (`interviewQuestionEngine`) | `interviewQuestionRepository` | 분석 실행 | 인터뷰 질문·답변 기록 | 가능 | **B** | 결과 화면 내 링크 | 동상 |
| 점수 상세·수동 조정 | 영역별 점수 근거 확인, 전문가 수동 조정 | `.../analysis/score` (`domainScoring`, `deductionEngine`) | `assessmentRepository`(조정 기록) | 분석 실행 | 점수 상세·조정 이력 | 가능 | **B** | 결과 화면 내 링크 | 수동 조정은 전문가 기능이나 결과 화면 하위로 충분 |
| 진단 결과 전체 목록 / 설문 전체 목록 | 프로젝트를 가로질러 모든 진단·설문을 나열 | `/diagnosis/assessments`, `/diagnosis/surveys` | 읽기 전용 | 데이터 축적 | 목록 화면 | 가능 | **B** | 숨김(고급) | 운영 규모가 커진 뒤 유용. §11 결과 목록 중복 검토 대상 |

## 4. 만들 업무 선택

| 기능명 | 사용자 목적 | 관련 라우트 | 저장 데이터(리포지토리) | 선행조건 | 결과물 | 로컬 사용 가능 | 분류 | core 노출 | 유지·숨김·통합 이유 / 중복 / 운영 제약 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 후보 보드 | 확정 진단에서 자동화 후보 업무를 추출·검토 | `/selection/projects/:projectId`, `.../candidates` (`selectionService`, `selection/*`) | `automationCandidateRepository` | 확정 진단 | 후보 목록(점수·분류) | 가능 | **A** | **노출**(작업공간 "만들 업무 선택") | 유지 |
| 후보 상세 | 후보 1건의 근거·점수·메모 확인·보완 | `.../candidates/:candidateId` | `automationCandidateRepository` | 후보 생성 | 보강된 후보 | 가능 | **A** | 보드에서 진입 | 유지 |
| 우선순위 매트릭스 | 효과×난이도 매트릭스로 우선순위 비교 | `.../matrix` (`candidateScoring`) | 읽기 전용(후보 파생) | 후보 2건 이상 | 사분면 배치 | 가능 | **A** | **노출**(단계 레일) | 유지 |
| 선정 확정 | 먼저 만들 업무 1개를 확정하고 설계로 인계 | `.../decision` (`selectionOrchestrator`, `selectionHandoffBuilder`) | `selectionDecisionRepository`, `selectionHandoffRepository` | 후보 검토 | 확정 결정 + 설계 인계 데이터 | 가능 | **A** | **노출** | 유지 — 설계 단계의 선행조건 |
| 선별 전역 메인·결과 목록 | 전 프로젝트의 선별 현황·결과 나열 | `/selection`, `/selection/results` | 읽기 전용 | 데이터 축적 | 목록 | 가능 | **B** | 숨김 | §11 중복 검토. 작업공간 진입과 이중 경로 |

## 5. AX 기능·화면 설계

| 기능명 | 사용자 목적 | 관련 라우트 | 저장 데이터(리포지토리) | 선행조건 | 결과물 | 로컬 사용 가능 | 분류 | core 노출 | 유지·숨김·통합 이유 / 중복 / 운영 제약 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 설계 개요(프로젝트) | 선정된 업무의 MVP 설계 상태를 한눈에 보고 단계 이동 | `/mvp-design/projects/:projectId` (`mvpDesignService`, `designOrchestrator`) | `mvpDesignRepository` | 선정 확정(인계 데이터) | 설계 초안 | 가능 | **A** | **노출**(작업공간 "AX 기능 설계") | 유지 |
| 하위 단계: 업무 흐름·기능·화면·데이터·권한·규칙 | 워크플로/기능(Must·Should·Later)/화면/데이터 항목/권한/업무 규칙 정의 | `.../workflow`, `.../features`, `.../screens`, `.../data`, `.../permissions`, `.../rules` (`designGenerator`, `featureBlueprints`, `guardrailEngine`) | `mvpDesignRepository`(단일 설계 문서에 저장) | 설계 개요 진입 | 각 섹션 정의 | 가능 | **A** | 단계 레일로 노출 | 유지 — 자동 생성 + 수동 보정 구조 |
| 설계 검증·검토 확정 | 품질 점검(누락·모순) 후 설계 확정, 다음 단계로 인계 | `.../validation`, `.../review` (`qualityEngine`, `designHandoffBuilder`) | `mvpDesignRepository`, `mvpDesignHandoffRepository` | 섹션 작성 | 확정 설계 + 인계 | 가능 | **A** | **노출** | 유지 |
| 설계 전역 메인·결과 목록 | 전 프로젝트 설계 현황·결과 나열 | `/mvp-design`, `/mvp-design/results` | 읽기 전용 | 데이터 축적 | 목록 | 가능 | **B** | 숨김 | §11 중복 검토 |

## 6. 홈페이지 설계

| 기능명 | 사용자 목적 | 관련 라우트 | 저장 데이터(리포지토리) | 선행조건 | 결과물 | 로컬 사용 가능 | 분류 | core 노출 | 유지·숨김·통합 이유 / 중복 / 운영 제약 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 홈페이지 설계 개요 | 기업·브랜드 정보 기반 홈페이지 설계 상태 확인 | `/website-studio/projects/:projectId` (`websiteDesignService`, `websiteOrchestrator`) | `websiteDesignRepository` | website(또는 both) 유형 프로젝트 | 설계 초안 | 가능 | **A** | **노출**(작업공간 "홈페이지 설계") | 유지. website 유형에서는 진단 대신 첫 단계 |
| 하위 단계: 전략·사이트맵·페이지·콘텐츠·디자인 방향 | 목적/타깃 전략, 사이트 구조, 페이지 구성, 문구, 컬러·모션 방향 정의 | `.../strategy`, `.../sitemap`, `.../pages`, `.../content`, `.../design` (`designGenerator`, `websiteTaxonomy`) | `websiteDesignRepository` | 개요 진입 | 각 섹션 정의 | 가능 | **A** | 단계 레일로 노출 | 유지 |
| 개발 프롬프트 생성 | Claude Code용 홈페이지 개발 프롬프트 출력 | `.../prompt` (`promptBuilder`) | `websiteDesignRepository` | 섹션 작성 | 복사 가능한 프롬프트 | 가능 | **A** | **노출** | 이 모듈의 최종 산출물. 유지 |
| 검토 확정 | 품질 점검 후 확정·인계 | `.../review` (`qualityEngine`, `handoffBuilder`) | `websiteDesignHandoffRepository` | 프롬프트 생성 | 확정 설계 + 인계 | 가능 | **A** | **노출** | 유지 |
| 웹 전역 메인·결과 목록 | 전 프로젝트 홈페이지 설계 나열 | `/website-studio`, `/website-studio/results` | 읽기 전용 | 데이터 축적 | 목록 | 가능 | **B** | 숨김 | §11 중복 검토 |

## 7. 실제 사용 테스트(현장 검증)

| 기능명 | 사용자 목적 | 관련 라우트 | 저장 데이터(리포지토리) | 선행조건 | 결과물 | 로컬 사용 가능 | 분류 | core 노출 | 유지·숨김·통합 이유 / 중복 / 운영 제약 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 검증 워크스페이스·트랙 개요 | MVP/홈페이지 트랙별 검증 상태 확인 | `/validation/projects/:projectId`, `.../:trackType` (`validationService`, `validation/orchestrator`) | `validationWorkspaceRepository` | 확정 설계(인계) | 검증 워크스페이스 | 가능 | **B** | 노출(작업공간, 후순위 배치) | 핵심 결과 이후 단계. 흐름상 메뉴에는 두되 core 온보딩 대상에서는 후순위 |
| 계획·빌드 기록·시나리오 | 테스트 계획 수립, 구현 빌드 기록, 시나리오 정의 | `.../plan`, `.../build`, `.../scenarios` | `validationWorkspaceRepository` | 워크스페이스 | 계획·시나리오 | 가능 | **B** | 단계 레일 | 유지 |
| 회차(라운드) 진행·기록 | 회차별 테스트 실행·참여자·결과 기록 | `.../rounds`, `.../rounds/:roundId` | `validationWorkspaceRepository`, `validationTestSessionRepository` | 시나리오 | 회차 기록 | 가능 | **B** | 단계 레일 | 유지 |
| 테스트 링크(참여자 화면) | 참여자가 링크로 시나리오를 수행하고 피드백 제출 | `/test/:accessToken` (`LocalTestPage`, 공개 라우트) | `validationTestSessionRepository` | 회차 발급 | 참여자 세션 기록 | 같은 브라우저에서 가능 | **B**(로컬) / **D**(타 기기 공유) | 메뉴 아님(링크 진입) | **운영 제약**: 설문 링크와 동일 — localStorage 기반이라 실제 현장 참여자 기기에서는 열리지 않음. Supabase 실연결 필요 |
| 피드백·지표·게이트 | 피드백 취합, 시간 절감·오류 지표 집계, 통과 기준(게이트) 판정 | `.../feedback`, `.../metrics`, `.../gates` (`gateEngine`, `qualityEngine`) | `validationWorkspaceRepository` | 회차 기록 | 지표·게이트 판정 | 가능 | **B** | 단계 레일 | 유지 |
| 최종 판정 | 검증 결론(통과/보완/중단) 확정·인계 | `.../decision` (`handoffBuilder`) | `validationHandoffRepository` | 게이트 판정 | 확정 판정 + 인계 | 가능 | **B** | 단계 레일 | 유지 — 제출자료의 검증 보고서 원천 |
| 검증 전역 메인·결과 목록 | 전 프로젝트 검증 현황·결과 | `/validation`, `/validation/results` | 읽기 전용 | 데이터 축적 | 목록 | 가능 | **B** | 숨김(고급) | 현재 사이드바 "검증 결과"로 노출 중 — core에서는 결과·자료 그룹 축소 검토(§11) |

## 8. 제출자료(패키지)

| 기능명 | 사용자 목적 | 관련 라우트 | 저장 데이터(리포지토리) | 선행조건 | 결과물 | 로컬 사용 가능 | 분류 | core 노출 | 유지·숨김·통합 이유 / 중복 / 운영 제약 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 패키지 목록·생성 | 프로젝트 결과를 제출용 패키지(프리셋)로 생성 | `/deliverables/projects/:projectId`, `.../create` (`deliverableService`, `packagePresetEngine`, `sourceCollector`) | `deliverablePackageRepository`, `deliverablePackageSnapshotRepository` | 확정 진단(최소), 설계·검증 결과(권장) | 패키지 + 원본 스냅샷 | 가능 | **A** | **노출**(작업공간 "제출자료") | 컨설팅 산출물의 핵심. 유지 |
| 패키지 구성·보고서 | 포함 섹션 관리, 진단·선별·설계·검증 보고서 편집 | `.../packages/:packageId`, `.../contents`, `.../reports` (`*ReportBuilder`, `sectionFactory`) | `deliverablePackageRepository` | 패키지 생성 | 보고서 섹션 | 가능 | **A** | 패키지 내부 | 유지 |
| MVP 명세·로드맵 | 개발 명세서와 단계 로드맵 생성 | `.../specification`, `.../roadmap` (`mvpSpecificationBuilder`, `roadmapBuilder`) | `deliverablePackageRepository` | 확정 설계 | 명세·로드맵 문서 | 가능 | **A** | 패키지 내부 | 유지 |
| 개발 프롬프트 묶음 | Claude Code용 구현 프롬프트 패키지 생성 | `.../prompts` (`promptPackageBuilder`) | `deliverablePackageRepository` | 확정 설계 | 프롬프트 문서 | 가능 | **A** | 패키지 내부 | 유지 |
| 근거(증빙) 색인 | 주장-근거 연결 색인 생성, 민감정보 마스킹 | `.../evidence` (`evidenceIndexBuilder`, `redactionEngine`) | `deliverablePackageRepository` | 섹션 작성 | 근거 색인 | 가능 | **A** | 패키지 내부 | 유지 — 기관 제출 신뢰도의 근거 |
| 미리보기·검토 확정·내보내기 | 최종본 미리보기, 품질 점검 후 확정, 내보내기 기록 | `.../preview`, `.../review` (`exportBuilder`, `qualityEngine`) | `deliverableExportRepository` | 섹션 완성 | 확정 패키지·내보내기 | 가능 | **A** | 패키지 내부 | 유지 |
| 제출자료 전역 메인·결과 목록 | 전 프로젝트 패키지 현황·결과 | `/deliverables`, `/deliverables/results` | 읽기 전용 | 데이터 축적 | 목록 | 가능 | **B** | 결과·자료 그룹에 1개만 노출 | 현재 사이드바 "제출자료·보고서"가 이 역할. §11 참고 |

## 9. 기관·자금 연계 / 사례 라이브러리

| 기능명 | 사용자 목적 | 관련 라우트 | 저장 데이터(리포지토리) | 선행조건 | 결과물 | 로컬 사용 가능 | 분류 | core 노출 | 유지·숨김·통합 이유 / 중복 / 운영 제약 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 기관·프로그램 카탈로그 | 지원기관·지원사업 정보 열람 | `/funding/catalog`, `.../institutions/:institutionId`, `.../programs/:programId` | `institutionRepository`, `supportProgramRepository` | 없음(내장 데이터) | 카탈로그 | 가능 | **B** | 숨김(연계 화면에서 진입) | **운영 제약**: 실기관 공고 데이터 연동이 없어 내장 목록 기준(`freshnessEngine`이 신선도만 표시). 실운영은 외부 데이터 연동 필요 → 부분 D 성격 |
| 후보 매칭 | 프로젝트 조건으로 적합 지원사업 후보 산출 | `/funding/projects/:projectId`, `.../matches` (`fundingService`, `matchRuleEngine`) | `fundingStrategyRepository` | 확정 진단·제출자료(권장) | 매칭 후보 | 가능 | **B** | 노출(작업공간 후순위) | 핵심 결과 이후의 후속 사업화 단계 |
| 부족조건(갭) | 신청 요건 대비 부족한 조건 확인 | `.../gaps` (`gapEngine`) | `fundingStrategyRepository` | 매칭 | 갭 목록 | 가능 | **B** | 단계 레일 | 유지 |
| 접촉 계획 | 기관 접촉 순서·메시지 계획 | `.../outreach` (`outreachPlanBuilder`) | `fundingStrategyRepository` | 매칭 | 접촉 플랜 | 가능 | **B** | 단계 레일 | 유지 |
| 서류 체크리스트 | 제출 서류 요건 체크 | `.../checklist` (`documentRequirementBuilder`) | `fundingStrategyRepository` | 매칭 | 체크리스트 | 가능 | **B** | 단계 레일 | 유지 |
| 파이프라인 | 신청 건별 진행 상태(준비→신청→심사) 관리 | `.../pipeline` | `fundingStrategyRepository` | 매칭 | 파이프라인 보드 | 가능 | **B** | 단계 레일 | 유지 |
| 결과 기록·검토 | 선정/탈락/보완 결과 기록, 전략 확정 | `.../outcome`, `.../review` (`fundingSnapshotBuilder`) | `fundingStrategyRepository`, `fundingStrategySnapshotRepository` | 파이프라인 | 결과 기록·스냅샷 | 가능 | **B** | 단계 레일 | 유지 |
| 사례 전환 | 성과를 사례(케이스 스터디)로 전환 | `.../case` (`caseStudyBuilder`, `caseStudyService`) | `caseStudyRepository` | 결과 기록 | 사례 초안 | 가능 | **B** | 단계 레일 | 유지 |
| 자금 전역 메인·결과 목록 | 전 프로젝트 자금 연계 현황 | `/funding`, `/funding/results` | 읽기 전용 | 데이터 축적 | 목록 | 가능 | **B** | 숨김 | §11 중복 검토 |
| 사례 라이브러리 | 완료 사례를 축적·열람해 영업·제안에 재사용 | `/cases`, `/cases/:caseId` | `caseStudyRepository` | 사례 1건 이상 | 사례 카드·상세 | 가능 | **B** | 결과·자료 그룹(유지) | 성과 축적 후 가치. 유지 |

## 10. 설정·시스템

| 기능명 | 사용자 목적 | 관련 라우트 | 저장 데이터(리포지토리) | 선행조건 | 결과물 | 로컬 사용 가능 | 분류 | core 노출 | 유지·숨김·통합 이유 / 중복 / 운영 제약 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 글자 크기 | 화면 전체 글자 크기 조절(지속 저장) | `/settings` "내 설정" 탭 (`TextScaleControl`, `textScale.ts`) | localStorage(설정 키) | 없음 | 즉시 반영되는 표시 배율 | 가능 | **A** | **노출** | 접근성 핵심. 설정에서 유일하게 A |
| 내 정보·워크스페이스 안내 | 데모 사용자 정보 표시, 클라우드 모드 안내 | `/settings` "내 설정"·"워크스페이스" 탭 | 없음(상수 `CURRENT_USER`) | 없음 | 표시 전용 | 가능 | **C** | 숨김(탭 유지) | 로컬 모드에서는 실기능 없음 |
| 로컬 데이터 요약·백업 내보내기 | 도메인별 저장 건수 확인, JSON 백업 다운로드 | `/settings` "데이터" 탭 (`localSnapshot`, `localBackup`) | 읽기 전용 스냅샷 | 없음 | 백업 JSON | 가능 | **C** | 숨김(탭 유지) | 데이터 안전장치로 유지하되 기본 화면 아님 |
| 데이터 모드·시스템 정보 | local/supabase 모드, 스키마 버전(v`SCHEMA_VERSION`), 마이그레이션(stage12a) 확인 | `/settings` "시스템" 탭 (`dataMode.ts`) | 환경변수 기반(런타임 전환 아님) | 없음 | 표시 전용 | 가능 | **C** | 숨김 | 개발·운영자용 메타 정보 |
| Supabase 연결 설정 | 클라우드 모드에서 로그인·워크스페이스·구성원 관리 | `/settings` (supabase 모드 시 `SupabaseSettingsView`) | Supabase(미연결) | `VITE_DATA_MODE=supabase` + URL/키 | 클라우드 워크스페이스 | **불가**(로컬 모드에선 미표시) | **C + D** | 숨김 | **운영 제약**: 실연결이 다음 스테이지. 현재는 코드만 존재 |
| 가져오기 마법사 | 로컬 백업(JSON)을 클라우드 워크스페이스로 이관 | supabase 모드 설정 내 (`components/data/ImportWizard.tsx`, `dataImport/importPlan·importExecutor`) | Supabase(미연결) | supabase 로그인 | 이관된 데이터 | **불가** | **C + D** | 숨김 | 동상 — Supabase 실연결 후 활성화 |

## 11. 결과 목록·진행 현황 화면 (통합·제거 검토)

| 기능명 | 사용자 목적 | 관련 라우트 | 저장 데이터 | 선행조건 | 로컬 사용 가능 | 분류 | core 노출 | 판단 근거 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 전체 진행 현황(리포트) | 운영 지표 요약 — **현재 미구현(준비 중 빈 페이지)** | `/reports` (`EmptyModulePage`, `MODULE_PAGES` 중 유일한 잔존 빈 페이지) | 없음 | — | 화면은 열리나 기능 없음 | **E**(+D) | **숨김 권고** | 사이드바 "결과·자료 > 전체 진행 현황"으로 노출 중이지만 빈 화면. 홈 운영 현황·컨트롤 센터와 목적 중복. 실지표 축적(클라우드) 전까지 메뉴에서 제외 권고 |
| 모듈별 전역 메인 페이지 | 프로젝트를 다시 골라 모듈로 들어가는 목록 | `/selection`, `/mvp-design`, `/website-studio`, `/validation`, `/deliverables`, `/funding`, `/diagnosis` | 읽기 전용 | — | 가능 | **E** | 숨김 | 사이드바 "작업공간"(활성 프로젝트 기준 진입)과 이중 경로. 직접 URL·검색용으로 라우트는 유지하되 메뉴 노출은 불필요 |
| 모듈별 결과 목록(6종) | 전 프로젝트 결과 나열 | `/selection/results`, `/mvp-design/results`, `/website-studio/results`, `/validation/results`, `/deliverables/results`, `/funding/results` (+`/diagnosis/assessments`, `/diagnosis/surveys`) | 읽기 전용 | 데이터 축적 | 가능 | **B**(개별) / **E**(구성) | 결과·자료 그룹에 **제출자료·보고서 1개 + 사례 라이브러리**만 기본 노출 | 6개 목록이 같은 패턴("프로젝트 × 상태")을 반복 — 장기적으로 "결과 자료" 단일 화면에 탭 통합 검토. 이번 단계에서는 노출만 축소 |
| 진행 현황 표시 중복 | 같은 진행 정보를 4곳에서 다르게 표시 | 홈 운영 현황(`/`) vs 프로젝트 컨트롤 센터(`/projects/:id`) vs 고객사 상세(`/clients/:id`) vs 각 results 목록 | 읽기 전용 | — | 가능 | **E** | — | **판단 근거**: 네 화면 모두 `journeyService`·`get*Context` 파생 데이터의 재표현이다. 기준 화면을 "프로젝트 단위=컨트롤 센터, 전체=홈"으로 정하고 나머지는 요약 배지 수준으로 축소 검토 |

---

## 요약 — Core 모드 기본 노출

처음 사용하는 사용자에게 보여줄 단순화된 기본 메뉴(현행 사이드바 5그룹 구조 유지, 항목 축소):

1. **오늘 할 일** — `/` (다음 행동 히어로 중심, 운영 KPI는 접힘)
2. **고객사·프로젝트** — `/clients` (등록 Wizard·컨트롤 센터 포함)
3. **작업공간**(활성 프로젝트 선택 시)
   - 기업 진단 — 설문 설계 → 링크·응답 → 진단 결과
   - 만들 업무 선택 — 후보 → 매트릭스 → 확정
   - AX 기능 설계 — 흐름·기능·화면·데이터·권한·규칙 → 검증 → 확정
   - 홈페이지 설계 — 전략 → 구조 → 콘텐츠 → 디자인 → 프롬프트 → 확정
   - 실제 사용 테스트 (B — 흐름 후반부, 노출 유지하되 온보딩 후순위)
   - 제출자료 — 패키지 생성 → 보고서·명세·프롬프트·근거 → 확정
   - 기관·자금 연계 (B — 후순위)
4. **결과·자료** — 제출자료·보고서(`/deliverables/results`), 사례 라이브러리(`/cases`) 2개로 축소
   - 제외: 검증 결과(`/validation/results` — 작업공간 테스트 화면에서 접근), 전체 진행 현황(`/reports` — 미구현)
5. **설정** — 글자 크기 중심(데이터·시스템 탭은 유지하되 후순위)

메뉴 비노출(라우트는 유지): 진단 스튜디오 허브·질문은행·모듈·템플릿(C), 모듈별 전역 메인·결과 목록(B/E), Supabase·가져오기(C+D).

### 분류 집계

| 분류 | 건수 | 대표 항목 |
| --- | --- | --- |
| A. 핵심 | 22 | 고객·프로젝트(3), 홈·검색·데모(3), 진단 핵심 흐름(3), 선택(4), AX 설계(3), 홈페이지 설계(4), 제출자료(6 중 A 6), 글자 크기(1) — 표 기준 |
| B. 고급 운영 | 24 | 실제 사용 테스트 전체(7), 기관·자금 연계(9), 사례 라이브러리, 진단 심화 분석(4), 결과 목록·운영 현황(3) |
| C. 내부 관리 | 8 | 질문은행·모듈·템플릿·스튜디오 허브(4), 설정 4탭 중 비핵심(4) — Supabase·가져오기는 C+D 중복 집계 |
| D. 보류 | 4 | 설문 링크 타기기 공유, 테스트 링크 타기기 공유, Supabase 연결, 가져오기 마법사 (모두 Supabase 실연결 필요) |
| E. 통합·제거 검토 | 4 | `/reports` 빈 페이지, 모듈별 전역 메인 7종, 결과 목록 6종의 구성 방식, 진행 현황 4중 표시 |

(설문·테스트 링크처럼 로컬에서는 A/B로 동작하지만 실운영 공유는 D인 항목은 양쪽에 표기했다.)

## 후속 권고

1. **숨김(삭제 아님)**: 이번 단계에서는 코드·라우트·데이터를 전혀 삭제하지 않는다. 모든 화면은 URL 직접 진입과 전역 검색으로 계속 접근 가능해야 하며, 변경 대상은 **사이드바·홈의 기본 노출**뿐이다. 이유: (1) 로컬 모드 사용자 데이터가 각 리포지토리에 이미 존재할 수 있고, (2) Supabase 실연결 시 D 항목이 즉시 A/B로 승격될 예정이라 제거하면 재작업이 된다.
2. **결과·자료 그룹 축소**: 사이드바에서 "검증 결과", "전체 진행 현황"을 기본 메뉴에서 내리고, "제출자료·보고서 + 사례 라이브러리" 2개로 시작한다. `/reports`는 실지표가 쌓이기 전까지 노출하지 않는다.
3. **결과 목록 통합 설계(다음 스테이지)**: 6개 `*/results` 화면이 동일 패턴을 반복하므로 "결과 자료" 단일 화면 + 도메인 탭으로 통합하는 설계를 검토한다. 이번 단계에서는 노출만 조정한다.
4. **진행 현황 단일 기준 확립**: 프로젝트 단위 현황은 컨트롤 센터(`/projects/:id`), 전체 현황은 홈(`/`)을 기준으로 삼고, 고객사 상세·목록 화면의 현황 표시는 배지 수준으로 단순화하는 방향을 다음 UX 회차에서 다룬다.
5. **C 기능은 "고급 설정" 진입점으로 묶기**: 질문은행·모듈·템플릿은 진단 설계 화면(setup) 안의 "설문 콘텐츠 관리" 링크로 접근을 유지하면, 사이드바 노출 없이도 전문가 워크플로가 끊기지 않는다.
6. **D 기능 승격 조건 명시**: 설문·테스트 링크의 타 기기 공유, 워크스페이스 협업, 클라우드 백업·가져오기는 모두 "Supabase 실연결(다음 스테이지)"이 유일한 차단 요인이다. 연결 완료 시 이 문서의 D 분류를 재심사한다.
