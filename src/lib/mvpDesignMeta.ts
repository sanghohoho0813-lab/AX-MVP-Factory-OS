import {
  AlertTriangle,
  BadgeCheck,
  Ban,
  BarChart3,
  Bell,
  Bot,
  Boxes,
  Braces,
  Calculator,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Cog,
  Database,
  FileCheck2,
  FileText,
  FilterX,
  FlaskConical,
  Gauge,
  GitBranch,
  LayoutDashboard,
  LayoutList,
  ListChecks,
  type LucideIcon,
  MinusCircle,
  PlugZap,
  Search,
  ShieldCheck,
  Sparkles,
  SquareStack,
  Table,
  UserCheck,
  Users,
  Workflow,
  Wrench,
} from 'lucide-react'
import type { StatusTone } from '../types'
import type {
  AiFeaturePurpose,
  BusinessRuleType,
  ExceptionKind,
  FeatureAutomationMode,
  FeatureScope,
  FeatureType,
  FieldType,
  GuardrailStatus,
  IntegrationReadiness,
  KpiDirection,
  MvpDesignStatus,
  ProcessingKind,
  QualityCheckSeverity,
  ScreenType,
  TestScenarioKind,
} from '../types/mvpDesign'

interface Meta {
  label: string
  description: string
  tone: StatusTone
  icon: LucideIcon
  order: number
}
type MetaMap<K extends string> = Record<K, Meta>
function keysByOrder<K extends string>(map: MetaMap<K>): K[] {
  return (Object.keys(map) as K[]).sort((a, b) => map[a].order - map[b].order)
}
interface SimpleMeta {
  label: string
  tone: StatusTone
  order: number
}

/* 설계 상태 */
export const MVP_DESIGN_STATUS_META: MetaMap<MvpDesignStatus> = {
  draft: { label: '설계 초안', description: '자동 설계를 반영한 초안입니다.', tone: 'warning', icon: FlaskConical, order: 0 },
  reviewed: { label: '내부 검토', description: '담당자 검토를 마쳤습니다.', tone: 'info', icon: ClipboardCheck, order: 1 },
  finalized: { label: '설계 확정', description: 'MVP 설계가 확정되었습니다.', tone: 'success', icon: CheckCircle2, order: 2 },
  superseded: { label: '이전 버전', description: '새 버전으로 대체된 이전 설계입니다.', tone: 'neutral', icon: MinusCircle, order: 3 },
}
export const MVP_DESIGN_STATUSES = keysByOrder(MVP_DESIGN_STATUS_META)

/* 기능 범위 */
export const FEATURE_SCOPE_META: MetaMap<FeatureScope> = {
  must: { label: 'Must · 1차 필수', description: '1차 MVP에서 반드시 구현할 최소 기능입니다.', tone: 'success', icon: BadgeCheck, order: 0 },
  should: { label: 'Should · 권장', description: '여유가 되면 1차에 포함하는 기능입니다.', tone: 'info', icon: ListChecks, order: 1 },
  later: { label: 'Later · 2차', description: '2차 이후로 미루는 기능입니다.', tone: 'warning', icon: MinusCircle, order: 2 },
  excluded: { label: 'Excluded · 제외', description: '이번 범위에서 제외한 기능입니다.', tone: 'danger', icon: Ban, order: 3 },
}
export const FEATURE_SCOPES = keysByOrder(FEATURE_SCOPE_META)

/* 기능 유형 */
export const FEATURE_TYPE_META: Record<FeatureType, { label: string; tone: StatusTone; icon: LucideIcon }> = {
  input_form: { label: '입력 폼', tone: 'info', icon: FileText },
  list_view: { label: '목록 조회', tone: 'info', icon: LayoutList },
  detail_view: { label: '상세 조회', tone: 'info', icon: FileCheck2 },
  rule_calculation: { label: '규칙 계산', tone: 'accent', icon: Calculator },
  document_generation: { label: '문서 생성', tone: 'accent', icon: FileText },
  approval_flow: { label: '승인 흐름', tone: 'warning', icon: Workflow },
  notification: { label: '알림', tone: 'info', icon: Bell },
  dashboard_report: { label: '대시보드·보고', tone: 'accent', icon: BarChart3 },
  search_filter: { label: '검색·필터', tone: 'neutral', icon: Search },
  data_validation: { label: '데이터 검증', tone: 'info', icon: ShieldCheck },
  status_tracking: { label: '상태 추적', tone: 'info', icon: Gauge },
  ai_assist: { label: 'AI 보조', tone: 'accent', icon: Bot },
  integration: { label: '외부 연동', tone: 'warning', icon: PlugZap },
  admin_setting: { label: '관리 설정', tone: 'neutral', icon: Cog },
  other: { label: '기타', tone: 'neutral', icon: ClipboardList },
}
export const FEATURE_TYPES = Object.keys(FEATURE_TYPE_META) as FeatureType[]

/* 기능 자동화 방식 */
export const AUTOMATION_MODE_META: MetaMap<FeatureAutomationMode> = {
  full_auto: { label: '완전 자동', description: '사람 개입 없이 규칙으로 처리합니다.', tone: 'success', icon: ShieldCheck, order: 0 },
  assisted: { label: '자동 보조', description: '시스템이 초안·후보를 만들고 사람이 다듬습니다.', tone: 'info', icon: Sparkles, order: 1 },
  human_confirm: { label: '사람 확정', description: '시스템 결과를 사람이 확인·확정합니다.', tone: 'warning', icon: UserCheck, order: 2 },
  manual_only: { label: '수동 처리', description: '사람이 직접 처리하고 시스템은 기록만 합니다.', tone: 'neutral', icon: Wrench, order: 3 },
}

/* 처리 방식 */
export const PROCESSING_KIND_META: Record<ProcessingKind, { label: string; icon: LucideIcon }> = {
  store: { label: '저장', icon: Database },
  rule_transform: { label: '규칙 변환', icon: GitBranch },
  calculate: { label: '계산', icon: Calculator },
  classify: { label: '분류', icon: FilterX },
  aggregate: { label: '집계', icon: BarChart3 },
  generate_draft: { label: '초안 생성', icon: FileText },
  route_notify: { label: '배정·알림', icon: Bell },
  validate: { label: '검증', icon: ShieldCheck },
  passthrough: { label: '단순 전달', icon: MinusCircle },
}

/* 화면 유형 */
export const SCREEN_TYPE_META: Record<ScreenType, { label: string; icon: LucideIcon; tone: StatusTone }> = {
  list: { label: '목록', icon: LayoutList, tone: 'info' },
  detail: { label: '상세', icon: FileCheck2, tone: 'info' },
  form: { label: '입력 폼', icon: FileText, tone: 'accent' },
  dashboard: { label: '대시보드', icon: LayoutDashboard, tone: 'accent' },
  wizard: { label: '단계 입력', icon: SquareStack, tone: 'info' },
  result: { label: '결과', icon: BadgeCheck, tone: 'success' },
  setting: { label: '설정', icon: Cog, tone: 'neutral' },
  auth: { label: '인증', icon: ShieldCheck, tone: 'neutral' },
}

/* 필드 유형 */
export const FIELD_TYPE_META: Record<FieldType, { label: string }> = {
  text: { label: '텍스트' },
  long_text: { label: '긴 텍스트' },
  number: { label: '숫자' },
  currency: { label: '금액' },
  date: { label: '날짜' },
  datetime: { label: '일시' },
  boolean: { label: '예/아니오' },
  enum: { label: '선택값' },
  reference: { label: '참조' },
  file: { label: '파일' },
  computed: { label: '계산값' },
}

/* 비즈니스 규칙 유형 */
export const BUSINESS_RULE_TYPE_META: Record<BusinessRuleType, { label: string; tone: StatusTone; icon: LucideIcon }> = {
  validation: { label: '검증 규칙', tone: 'info', icon: ShieldCheck },
  calculation: { label: '계산 규칙', tone: 'accent', icon: Calculator },
  classification: { label: '분류 규칙', tone: 'accent', icon: FilterX },
  routing: { label: '배정 규칙', tone: 'warning', icon: GitBranch },
  threshold: { label: '기준값 규칙', tone: 'info', icon: Gauge },
  permission: { label: '권한 규칙', tone: 'neutral', icon: ShieldCheck },
  lifecycle: { label: '상태 전이', tone: 'info', icon: Workflow },
  exception: { label: '예외 규칙', tone: 'danger', icon: AlertTriangle },
}

/* AI 기능 목적 */
export const AI_PURPOSE_META: Record<AiFeaturePurpose, { label: string; description: string }> = {
  draft_generation: { label: '초안 생성', description: '문서·응답 초안을 만들고 사람이 확정합니다.' },
  summarization: { label: '요약', description: '긴 텍스트를 요약합니다.' },
  classification: { label: '분류', description: '문의·문서를 자동 분류합니다.' },
  extraction: { label: '항목 추출', description: '비정형 텍스트에서 항목을 추출합니다.' },
  recommendation: { label: '추천', description: '규칙만으로 어려운 추천을 제공합니다.' },
  qna_support: { label: '질의응답 보조', description: '내부 자료 기반 질의응답을 보조합니다.' },
}

/* 연동 준비도 */
export const INTEGRATION_READINESS_META: Record<IntegrationReadiness, SimpleMeta> = {
  ready: { label: '연동 준비됨', tone: 'success', order: 0 },
  needs_setup: { label: '설정 필요', tone: 'warning', order: 1 },
  blocked: { label: '연동 불가', tone: 'danger', order: 2 },
  deferred: { label: '2차로 연기', tone: 'neutral', order: 3 },
}

/* 예외 유형 */
export const EXCEPTION_KIND_META: Record<ExceptionKind, { label: string; icon: LucideIcon }> = {
  invalid_input: { label: '잘못된 입력', icon: AlertTriangle },
  missing_data: { label: '데이터 누락', icon: Database },
  permission_denied: { label: '권한 없음', icon: ShieldCheck },
  external_failure: { label: '외부 연동 실패', icon: PlugZap },
  conflict: { label: '충돌', icon: GitBranch },
  expert_required: { label: '전문가 판단 필요', icon: UserCheck },
  edge_case: { label: '경계 상황', icon: Braces },
}

/* 테스트 유형 */
export const TEST_KIND_META: Record<TestScenarioKind, { label: string; tone: StatusTone }> = {
  happy_path: { label: '정상 흐름', tone: 'success' },
  validation: { label: '입력 검증', tone: 'info' },
  permission: { label: '권한', tone: 'neutral' },
  exception: { label: '예외', tone: 'warning' },
  boundary: { label: '경계값', tone: 'accent' },
}

/* KPI 방향 */
export const KPI_DIRECTION_META: Record<KpiDirection, { label: string; symbol: string }> = {
  increase: { label: '증가 목표', symbol: '▲' },
  decrease: { label: '감소 목표', symbol: '▼' },
  maintain: { label: '유지 목표', symbol: '＝' },
}

/* 가드레일 상태 */
export const GUARDRAIL_STATUS_META: Record<GuardrailStatus, SimpleMeta> = {
  ok: { label: '적정', tone: 'success', order: 0 },
  warning: { label: '주의', tone: 'warning', order: 1 },
  exceeded: { label: '초과', tone: 'danger', order: 2 },
}

/* 품질 점검 심각도 */
export const QUALITY_SEVERITY_META: Record<QualityCheckSeverity, { label: string; tone: StatusTone; icon: LucideIcon }> = {
  error: { label: '오류', tone: 'danger', icon: Ban },
  warning: { label: '경고', tone: 'warning', icon: AlertTriangle },
  info: { label: '안내', tone: 'info', icon: ClipboardList },
}

/* 자료군 아이콘(집계 카드용) */
export const DESIGN_SECTION_ICON = {
  features: BadgeCheck,
  screens: LayoutList,
  entities: Boxes,
  roles: Users,
  rules: GitBranch,
  ai: Bot,
  integrations: PlugZap,
  kpis: BarChart3,
  acceptance: ClipboardCheck,
  table: Table,
} as const
