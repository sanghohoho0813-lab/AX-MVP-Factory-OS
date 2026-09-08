/**
 * 컨설팅 워크플로 엔진 — 타입.
 *
 * 무엇인가
 *   특허 출원 → AX/플랫폼 MVP → 벤처기업확인(혁신성장유형) → 현장실사까지를
 *   한 회사에 대해 한 줄기(One Core Thread)로 끌고 가는 프로젝트의 자료 구조다.
 *   업무 규칙의 사람용 원본은 Master MD(v2.0)이고, 여기는 그 규칙을 코드로 옮긴 것이다.
 *
 * 고객(CLIENT)은 새로 만들지 않는다. 기존 고객 운영 기록(operations_clients)에
 * clientId 로 매달린다. 한 고객이 여러 프로젝트를 가질 수 있다.
 *
 * 저장 원칙
 *   - 단계 상태·사실표·핵심 줄기·참고자료 선택은 프로젝트 한 행의 payload 에 함께 둔다.
 *     프로젝트와 1:1 이고 늘 같이 저장되므로, 따로 떼면 절반만 저장되는 순간이 생긴다.
 *   - 산출물·프롬프트 꾸러미·결정·증빙은 계속 늘어나는 목록이라 각자 표를 갖는다.
 *   - 주민등록번호·계좌번호·비밀번호·인증서·API 키는 어떤 필드에도 넣지 않는다.
 *     내보내기 직전에는 개인정보 필터(privacyFilter)가 한 번 더 걸러 낸다.
 *
 * LLM 호출 없음
 *   이 엔진은 외부 AI API 를 부르지 않는다. 사람이 프롬프트를 복사해 나가고,
 *   결과를 붙여 넣어 들여온다(수동 왕복). 규칙으로 계산한 것을 "AI" 라 부르지 않는다.
 */

/* ------------------------------------------------------------------ */
/* 모듈 · 단계                                                          */
/* ------------------------------------------------------------------ */

/** 워크플로 모듈 — 지금은 하나. 코어는 모듈에 의존하지 않게 짠다. */
export type WorkflowModuleKey = 'patent_venture_mvp'

/** S0~S16 단계 키 */
export type StageKey =
  | 'S0' | 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6' | 'S7' | 'S8'
  | 'S9' | 'S10' | 'S11' | 'S12' | 'S13' | 'S14' | 'S15' | 'S16'

/** 단계 묶음 — 화면 탐색과 Master K5(STAGE-SCOPED ACTIVATION)의 활성 PART 가 이 단위로 갈린다 */
export type StageGroupKey = 'understand' | 'patent' | 'mvp' | 'venture' | 'submit'

/**
 * 단계 상태.
 *   skipped 는 반드시 이유가 있어야 한다 — "안 했다" 와 "이 회사에는 없는 일" 을 가르기 위해서다.
 */
export type StageStatus =
  | 'not_started'
  | 'in_progress'
  | 'blocked'
  | 'ready_for_review'
  | 'completed'
  | 'skipped'

export interface StageState {
  status: StageStatus
  /** skipped 일 때 필수 */
  skipReason: string
  /** blocked 일 때 무엇에 막혔는지 */
  blockedBy: string
  note: string
  startedAt: string | null
  completedAt: string | null
  updatedAt: string | null
}

/** 단계 정의 — 코드가 아는 규칙 (Master PART 1 §2-1, K5) */
export interface StageDefinition {
  key: StageKey
  /** 화면에 보이는 짧은 이름 */
  label: string
  /** 영문 코드명 (Master 표기) */
  code: string
  group: StageGroupKey
  /** 이 단계가 끝나면 무엇이 정해지는가 — 한 문장 */
  purpose: string
  /** 완료로 넘기기 전에 확인하는 것 — 사람이 체크한다 */
  exitChecklist: string[]
  /** 이 단계에서 채워져 있어야 하는 사실표 항목 키 */
  requiredFacts: FactKey[]
  /** 이 단계에서 만들어져야 하는 산출물 종류 */
  requiredArtifacts: ArtifactType[]
  /** 이 단계에서 쓸 수 있는 프롬프트 꾸러미 종류 */
  promptTypes: PromptPackageType[]
  /** Master 에서 우선 활성화하는 PART (K5) */
  activeParts: string
  /** 건너뛸 수 있는 단계인지 (예: 특허가 이미 있는 회사) */
  skippable: boolean
}

/* ------------------------------------------------------------------ */
/* 사실표 (VENTURE FACTSHEET — 숫자·사실의 단일 원본, Master §5)         */
/* ------------------------------------------------------------------ */

export type FactSectionKey = 'company' | 'org' | 'finance' | 'business' | 'tech' | 'market' | 'plan3y'

/**
 * 사실 하나의 상태.
 *   confirmed  근거가 있는 확정 사실
 *   unverified 들었지만 아직 근거 없음
 *   planned    계획·목표 (실적 아님)
 *   demo       시연용 값 (실적처럼 쓰면 안 됨)
 *   future     향후 개발·확장 예정
 */
export type FactStatus = 'confirmed' | 'unverified' | 'planned' | 'demo' | 'future'

export interface FactValue {
  value: string
  status: FactStatus
  /** 어디서 온 값인지 (문서명·기관·인터뷰 …) */
  source: string
  /** 기준일 YYYY-MM-DD */
  asOfDate: string
  /** 산식·비고 */
  note: string
  updatedAt: string | null
}

export type FactKey =
  // 회사 기본
  | 'companyName' | 'representative' | 'establishedAt' | 'headOffice' | 'businessNumber' | 'corporateNumber'
  | 'industry' | 'mainProducts'
  // 조직
  | 'employees' | 'rdStaff' | 'rdOrg' | 'ceoCareer' | 'keyPeople'
  // 재무
  | 'revenue3y' | 'profit3y' | 'revenueThisYear' | 'fundingNow' | 'revenueTarget3y'
  // 고객/사업
  | 'customers' | 'accounts' | 'customerSegments' | 'repeatSignals' | 'contracts'
  // 기술
  | 'coreProblem' | 'currentMethod' | 'coreTech' | 'implemented' | 'inDevelopment' | 'futureDev'
  | 'patent' | 'mvpUrl' | 'axCore' | 'platformUsers'
  // 시장
  | 'tam' | 'sam' | 'som' | 'marketFormula' | 'marketBaseYear' | 'marketSource'
  // 3년 계획
  | 'techGoal' | 'customerGoal' | 'revenueGoal' | 'marketExpansion' | 'fundingNeed' | 'fundingUse'

export interface FactDefinition {
  key: FactKey
  section: FactSectionKey
  label: string
  /** 입력 힌트 */
  placeholder: string
  /** 숫자형 — 기준연도·출처·산식을 붙이도록 권한다 (Master §5-1) */
  numeric: boolean
  /** 고객 운영 기록에서 처음 값을 가져올 수 있는 항목 */
  fromClient?: 'companyName' | 'representativeName' | 'establishedAt' | 'businessAddress' | 'businessNumber' | 'corporateNumber' | 'industry' | 'employeeCount'
  /** 여러 줄 입력 */
  multiline?: boolean
}

export type Factsheet = Partial<Record<FactKey, FactValue>>

/* ------------------------------------------------------------------ */
/* One Core Thread (Master PART 6 §35)                                  */
/* ------------------------------------------------------------------ */

export type CoreThreadKey =
  | 'fieldProblem'      // 현장문제
  | 'existingMethod'    // 기존방식
  | 'coreTech'          // 핵심 해결기술
  | 'patentPoint'       // 특허 권리화 포인트
  | 'axCore'            // MVP AX Core
  | 'platformSurface'   // Platform Surface
  | 'ventureSentence'   // 벤처 Solution 핵심문장
  | 'keyEvidence'       // 핵심 증빙

export type CoreThread = Record<CoreThreadKey, string>

/* ------------------------------------------------------------------ */
/* 게이트 (Master PART A §4, K9, PART 7 §41)                            */
/* ------------------------------------------------------------------ */

export type GateDecision = 'go' | 'hold' | 'no_go'

/** GO 체크리스트 9개 (Master §4-1) — 사람이 표시한다. 점수를 계산해 내지 않는다. */
export type VentureGateItem =
  | 'knowsProblem' | 'repeatedInefficiency' | 'differentStructure' | 'patentPoint' | 'mvpShowable'
  | 'realTarget' | 'marketData' | 'threeYearPath' | 'ceoCanExplain'

export interface VentureGate {
  items: Partial<Record<VentureGateItem, boolean>>
  decision: GateDecision | null
  reason: string
  decidedAt: string | null
}

/** 최신 공식 기준 확인 — 출원·신청 직전 (Master K9) */
export interface PolicyFreshness {
  /** 어떤 신청을 위해 확인했는지 */
  scope: 'patent_filing' | 'venture_application'
  checkedAt: string
  /** 확인한 곳 (특허로 / 벤처확인종합관리시스템 …) */
  source: string
  /** 이 Master 와 달랐던 점 */
  differences: string
}

/* ------------------------------------------------------------------ */
/* 산출물 · 프롬프트 꾸러미 · 결정 · 증빙                                 */
/* ------------------------------------------------------------------ */

export type ArtifactType =
  | 'PATENT_IDEA' | 'PRIOR_ART_REVIEW' | 'KIPO_REFERENCE_SET' | 'PATENT_SPEC_DRAFT' | 'PATENT_CLAIMS'
  | 'PATENT_FILING_RECORD'
  | 'MVP_SPEC' | 'MVP_BUILD_PROMPT' | 'MVP_STATE'
  | 'VENTURE_FACTSHEET_SNAPSHOT' | 'VENTURE_PLAN_SECTION' | 'VENTURE_PLAN_FULL'
  | 'CLAIM_EVIDENCE_MATRIX' | 'INFOGRAPHIC_BRIEF'
  | 'QA_REPORT' | 'SUBMISSION_RECORD'
  | 'FIELD_REVIEW_SCRIPT' | 'FIELD_REVIEW_QA' | 'RESULT_RECORD'
  | 'GENERAL_REVIEW' | 'NOTE'

export type ArtifactStatus = 'draft' | 'in_review' | 'approved' | 'superseded'

/** 산출물이 어디서 왔는지 — 수동 LLM 왕복의 출처를 남긴다 */
export type ArtifactSource = 'manual' | 'llm_paste' | 'llm_file' | 'system'

export interface ConsultingArtifact {
  id: string
  workspaceId: string | null
  projectId: string
  type: ArtifactType
  title: string
  stageKey: StageKey
  /** 같은 type 안에서 1부터 증가 */
  version: number
  status: ArtifactStatus
  content: string
  source: ArtifactSource
  /** 어느 프롬프트 꾸러미에 대한 결과인지 */
  promptPackageId: string | null
  /** 원본 파일 이름 (파일로 들여온 경우) */
  fileName: string
  createdAt: string
  updatedAt: string
}

export type PromptPackageType =
  | 'PATENT_IDEA' | 'PRIOR_ART_REVIEW' | 'PATENT_SPEC_DRAFT' | 'PATENT_CLAIMS_REVIEW'
  | 'MVP_STRATEGY' | 'MVP_CLAUDE_CODE_BUILD'
  | 'VENTURE_PLAN_SECTION' | 'VENTURE_FULL_REVIEW'
  | 'EVIDENCE_REVIEW' | 'INFOGRAPHIC_BRIEF'
  | 'FIELD_REVIEW_SCRIPT' | 'FIELD_REVIEW_QA'
  | 'GENERAL_PROJECT_REVIEW'

export type PromptTarget = 'general' | 'chatgpt' | 'claude' | 'claude_code'

/** 개인정보 필터가 무엇을 얼마나 가렸는지 */
export interface PrivacyReport {
  rrn: number
  account: number
  password: number
  secret: number
  email: number
  phone: number
  total: number
}

export interface ConsultingPromptPackage {
  id: string
  workspaceId: string | null
  projectId: string
  type: PromptPackageType
  target: PromptTarget
  stageKey: StageKey
  title: string
  /** 복사해 나가는 본문 (필터 통과 후) */
  prompt: string
  /** 함께 첨부하는 맥락 파일 (필터 통과 후) */
  context: string
  privacy: PrivacyReport
  /** 사업계획서 항목 프롬프트일 때 1~7 */
  section: number | null
  createdAt: string
}

export type DecisionKind = 'gate' | 'stage' | 'scope' | 'fact' | 'artifact' | 'reference' | 'policy' | 'other'

export interface ConsultingDecision {
  id: string
  workspaceId: string | null
  projectId: string
  stageKey: StageKey
  kind: DecisionKind
  summary: string
  reason: string
  createdAt: string
}

/** 실제 신청화면 10개 첨부 슬롯 (Master §33) */
export type EvidenceSlot = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10

/** 주장 상태 (Claim–Evidence Matrix, Master §36) */
export type ClaimStatus = 'live' | 'demo' | 'future' | 'market' | 'target'

export interface ConsultingEvidence {
  id: string
  workspaceId: string | null
  projectId: string
  slot: EvidenceSlot
  /** 무엇을 증명하는 장인가 — 한 문장 */
  claim: string
  claimStatus: ClaimStatus
  /** 첨부물 제목 (인포그래픽 이름 등) */
  title: string
  /** 근거 출처 (통계·계약·화면 …) */
  source: string
  /** 특허와 연결되는가 / MVP 와 연결되는가 */
  linksPatent: boolean
  linksMvp: boolean
  /** 준비 상태 */
  ready: boolean
  note: string
  createdAt: string
  updatedAt: string
}

/* ------------------------------------------------------------------ */
/* KIPO 참고자료 (APPENDIX A — 118종)                                    */
/* ------------------------------------------------------------------ */

export type KipoCategory = 'living' | 'digital' | 'electric' | 'chem' | 'mech' | 'semi'

export interface KipoReference {
  code: string
  category: KipoCategory
  field: string
  title: string
}

export interface KipoSelection {
  code: string
  /** 왜 골랐는지 (4축: 기술분야·발명형태·처리구조·청구항/도면 참고가치) */
  reason: string
  /** PDF 를 받아 첨부했는지 — 받기 전에는 세부 문구를 추측해 쓰지 않는다 */
  pdfAttached: boolean
}

/* ------------------------------------------------------------------ */
/* 특허 · MVP · 벤처 · 실사 — 단계별 작업공간 데이터                       */
/* ------------------------------------------------------------------ */

/** 특허 아이디어 5개 고정 질문 (Master §8) + 권리귀속 확인표 (§9-3) */
export interface PatentWorkspace {
  problem: string
  existingMethod: string
  differentStructure: string
  processFlow: string
  claimPoint: string
  titleCandidates: string
  /** 선행기술 키워드·유사특허·차별화 포인트 (§10) */
  priorArtKeywords: string
  priorArtFindings: string
  /** 발명자·출원인 (§9) */
  inventors: string
  applicant: string
  rightsNote: string
  /** 출원 기록 (§14-1) — 등록 아님 */
  applicationNumber: string
  filedAt: string
  examRequestDue: string
  /** 출원 상태 표현: 미출원 / 출원 중 / 등록 */
  filingStatus: 'none' | 'filed' | 'registered'
}

/** MVP Strategy Lock (Master §2 + §22-1) */
export interface MvpWorkspace {
  productName: string
  oneLineValue: string
  targetUser: string
  primaryJourney: string
  axCoreFeature: string
  /** rule / scoring / optimization / llm / demo — AI 라 부를 수 있는지의 근거 */
  axMode: 'rule' | 'scoring' | 'optimization' | 'ml' | 'rag' | 'llm' | 'demo' | ''
  platformSurface: string
  live: string
  demo: string
  future: string
  notBuilding: string
  demoDataAssumption: string
  mvpUrl: string
  referenceStyle: string
}

/** 사업계획서 7개 항목 상태 (Master PART 5) */
export interface VentureSectionState {
  /** 사용자가 적어 둔 초안 요지 (본문은 산출물로 들어온다) */
  outline: string
  done: boolean
}

export interface VentureWorkspace {
  sections: Record<1 | 2 | 3 | 4 | 5 | 6 | 7, VentureSectionState>
  /** 기본 제출서류 8종 준비 여부 (§24) */
  documents: Record<string, boolean>
  /** Judge 점수 10항목 — 사람이 매긴다 (§42). null = 아직 안 함 */
  judgeScores: Partial<Record<JudgeAxis, number | null>>
  /** P0 Red Flag 12개 — 사람이 확인 (§41). true = 문제 없음 확인 */
  redFlagsCleared: Partial<Record<number, boolean>>
  submittedAt: string
  submissionNote: string
}

export type JudgeAxis = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J'

/** 현장실사 준비 (Master PART 8) */
export interface FieldReviewWorkspace {
  reviewDate: string
  script: string
  demoFlow: string
  /** 회사별로 고른 예상질문과 답변 요지 */
  qa: { question: string; keyPoint: string }[]
  /** 대표가 외울 숫자 8~12 개 (사실표 키) */
  numbersToMemorize: FactKey[]
  evidencePackChecked: Record<string, boolean>
  mockReviewDone: boolean
  result: string
}

/* ------------------------------------------------------------------ */
/* 프로젝트                                                              */
/* ------------------------------------------------------------------ */

export type ProjectStatus = 'active' | 'on_hold' | 'done' | 'archived'

export interface ConsultingProject {
  id: string
  workspaceId: string | null
  /** operations_clients.id */
  clientId: string
  /** 표시용 — 고객 이름이 바뀌면 화면에서 최신 값으로 덮는다 */
  clientName: string
  moduleKey: WorkflowModuleKey
  title: string
  status: ProjectStatus
  currentStage: StageKey
  stages: Record<StageKey, StageState>
  factsheet: Factsheet
  coreThread: CoreThread
  gate: VentureGate
  freshness: PolicyFreshness[]
  kipo: KipoSelection[]
  patent: PatentWorkspace
  mvp: MvpWorkspace
  venture: VentureWorkspace
  fieldReview: FieldReviewWorkspace
  createdAt: string
  updatedAt: string
}

export interface CreateConsultingProjectInput {
  clientId: string
  clientName: string
  title?: string
  moduleKey?: WorkflowModuleKey
}

/* ------------------------------------------------------------------ */
/* 다음 행동 (규칙 기반)                                                 */
/* ------------------------------------------------------------------ */

export type NextActionKind =
  | 'fill_fact' | 'answer_gate' | 'fill_thread' | 'fill_workspace' | 'generate_prompt'
  | 'import_result' | 'select_reference' | 'attach_pdf' | 'evidence' | 'check_policy'
  | 'complete_stage' | 'resolve_block' | 'field_review' | 'record_result'

export interface NextAction {
  kind: NextActionKind
  stageKey: StageKey
  title: string
  /** 왜 이것이 다음인지 — 규칙이 설명한다 */
  why: string
  /** 화면에서 열 탭 */
  tab: string
  /** 탭 안에서 가리킬 항목 (사실표 키·프롬프트 타입 등) */
  focus?: string
}

/** 일관성 경고 (규칙 기반 — 점수 아님) */
export interface ConsistencyWarning {
  code: string
  severity: 'p0' | 'p1' | 'info'
  message: string
  /** 고치러 갈 탭 */
  tab: string
  focus?: string
}
