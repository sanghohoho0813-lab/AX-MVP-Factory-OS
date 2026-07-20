import {
  Accessibility,
  AlertTriangle,
  Ban,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Cpu,
  Database,
  Eye,
  FileText,
  FlaskConical,
  Gauge,
  HelpCircle,
  Image,
  Lightbulb,
  Link2,
  ListChecks,
  Lock,
  type LucideIcon,
  MessageSquare,
  MinusCircle,
  MonitorSmartphone,
  Rocket,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Target,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  UserCheck,
  Users,
  Wrench,
  XCircle,
} from 'lucide-react'
import type { StatusTone } from '../types'
import type {
  BuildArtifactStatus,
  BuildArtifactType,
  FeedbackSeverity,
  FeedbackStatus,
  FeedbackType,
  GateCriterionStatus,
  MetricDirection,
  MetricEvaluationStatus,
  ParticipantConsentStatus,
  ParticipantStatus,
  ScenarioRunResult,
  TestMethod,
  ValidationDecisionType,
  ValidationGateNumber,
  ValidationGateStatus,
  ValidationIssueStatus,
  ValidationIssueType,
  ValidationParticipantRole,
  ValidationQualitySeverity,
  ValidationRoundStatus,
  ValidationScenarioType,
  ValidationTrackType,
  ValidationWorkspaceStatus,
} from '../types/validation'

interface SimpleMeta {
  label: string
  tone: StatusTone
  order: number
}
interface IconMeta extends SimpleMeta {
  icon: LucideIcon
  description?: string
}

/* 트랙 */
export const TRACK_META: Record<ValidationTrackType, { label: string; icon: LucideIcon; tone: StatusTone }> = {
  ax_mvp: { label: 'AX MVP 테스트', icon: Rocket, tone: 'info' },
  website: { label: '홈페이지 테스트', icon: MonitorSmartphone, tone: 'accent' },
}

/* 워크스페이스 상태 */
export const WORKSPACE_STATUS_META: Record<ValidationWorkspaceStatus, IconMeta> = {
  draft: { label: '준비 중', tone: 'neutral', icon: FlaskConical, order: 0 },
  ready: { label: '테스트 준비', tone: 'info', icon: ClipboardCheck, order: 1 },
  testing: { label: '테스트 중', tone: 'warning', icon: Users, order: 2 },
  evaluating: { label: '결과 검토', tone: 'accent', icon: Gauge, order: 3 },
  finalized: { label: '검증 확정', tone: 'success', icon: CheckCircle2, order: 4 },
  superseded: { label: '이전 버전', tone: 'neutral', icon: MinusCircle, order: 5 },
}
export const WORKSPACE_STATUSES = (Object.keys(WORKSPACE_STATUS_META) as ValidationWorkspaceStatus[]).sort(
  (a, b) => WORKSPACE_STATUS_META[a].order - WORKSPACE_STATUS_META[b].order,
)

/* Gate */
export const GATE_META: Record<ValidationGateNumber, { label: string; purpose: string; index: number }> = {
  gate_0: { label: 'Gate 0 · 문제 확인', purpose: '해결할 문제·대상 사용자·진단 근거 확인', index: 0 },
  gate_1: { label: 'Gate 1 · 핵심 업무 선정', purpose: '핵심 과제·성공 지표·제외 범위 확인', index: 1 },
  gate_2: { label: 'Gate 2 · 설계 확정', purpose: '설계 finalized·수용 기준·인계 스냅샷 확인', index: 2 },
  gate_3: { label: 'Gate 3 · 제작 준비', purpose: '제작 담당·테스트 버전·실행 방법 확인', index: 3 },
  gate_4: { label: 'Gate 4 · 테스트 준비', purpose: '참여자·시나리오·KPI·개인정보 확인', index: 4 },
  gate_5: { label: 'Gate 5 · 현장 테스트', purpose: '회차 실행·결과·피드백·증거 확인', index: 5 },
  gate_6: { label: 'Gate 6 · 결과 판정', purpose: '통과율·KPI·critical 해결·근거 확인', index: 6 },
  gate_7: { label: 'Gate 7 · 다음 단계 결정', purpose: '유지·수정·확대·운영·보류·중단 확정', index: 7 },
}
export const GATE_NUMBERS: ValidationGateNumber[] = ['gate_0', 'gate_1', 'gate_2', 'gate_3', 'gate_4', 'gate_5', 'gate_6', 'gate_7']

/* Gate 상태 */
export const GATE_STATUS_META: Record<ValidationGateStatus, IconMeta> = {
  locked: { label: '잠김', tone: 'neutral', icon: Lock, order: 0 },
  ready: { label: '준비됨', tone: 'info', icon: ClipboardCheck, order: 1 },
  in_progress: { label: '진행 중', tone: 'warning', icon: FlaskConical, order: 2 },
  passed: { label: '통과', tone: 'success', icon: CheckCircle2, order: 3 },
  conditional_pass: { label: '조건부 통과', tone: 'warning', icon: AlertTriangle, order: 4 },
  failed: { label: '실패', tone: 'danger', icon: XCircle, order: 5 },
  waived: { label: '예외 승인', tone: 'accent', icon: ShieldCheck, order: 6 },
}

/* 최종 결정 */
export const DECISION_META: Record<ValidationDecisionType, IconMeta> = {
  continue: { label: '현재 방향 유지', tone: 'success', icon: ThumbsUp, order: 0 },
  revise_and_retest: { label: '수정 후 재시험', tone: 'warning', icon: Wrench, order: 1 },
  expand_scope: { label: '범위 확대', tone: 'accent', icon: TrendingUp, order: 2 },
  prepare_operation: { label: '실제 운영 전환 준비', tone: 'success', icon: Rocket, order: 3 },
  hold: { label: '일시 보류', tone: 'neutral', icon: MinusCircle, order: 4 },
  stop: { label: '중단', tone: 'danger', icon: Ban, order: 5 },
}
export const DECISION_TYPES = (Object.keys(DECISION_META) as ValidationDecisionType[]).sort(
  (a, b) => DECISION_META[a].order - DECISION_META[b].order,
)

/* 테스트 방식 */
export const TEST_METHOD_META: Record<TestMethod, { label: string }> = {
  moderated: { label: '진행자 동반 테스트' },
  unmoderated_local: { label: '비동반 로컬 테스트' },
  observation: { label: '관찰' },
  scenario_test: { label: '시나리오 테스트' },
  checklist: { label: '체크리스트' },
  interview: { label: '인터뷰' },
  mixed: { label: '혼합' },
}
export const TEST_METHODS = Object.keys(TEST_METHOD_META) as TestMethod[]

/* 제작물 */
export const BUILD_TYPE_META: Record<BuildArtifactType, { label: string; icon: LucideIcon }> = {
  prototype: { label: '프로토타입', icon: FlaskConical },
  ax_mvp: { label: 'AX MVP', icon: Rocket },
  website_preview: { label: '홈페이지 시안', icon: MonitorSmartphone },
  document: { label: '문서', icon: FileText },
  spreadsheet: { label: '스프레드시트', icon: FileText },
  other: { label: '기타', icon: FileText },
}
export const BUILD_TYPES = Object.keys(BUILD_TYPE_META) as BuildArtifactType[]

export const BUILD_STATUS_META: Record<BuildArtifactStatus, SimpleMeta> = {
  draft: { label: '초안', tone: 'neutral', order: 0 },
  ready_for_test: { label: '테스트 준비', tone: 'info', order: 1 },
  testing: { label: '테스트 중', tone: 'warning', order: 2 },
  replaced: { label: '교체됨', tone: 'neutral', order: 3 },
  archived: { label: '보관', tone: 'neutral', order: 4 },
}

/* 참여자 */
export const PARTICIPANT_ROLE_META: Record<ValidationParticipantRole, { label: string; icon: LucideIcon }> = {
  owner: { label: '대표·오너', icon: UserCheck },
  manager: { label: '관리자', icon: Users },
  operator: { label: '실무 담당자', icon: Wrench },
  reviewer: { label: '검토자', icon: Eye },
  customer: { label: '고객', icon: Users },
  external: { label: '외부 참여자', icon: Users },
  observer: { label: '관찰자', icon: Eye },
  other: { label: '기타', icon: Users },
}
export const PARTICIPANT_ROLES = Object.keys(PARTICIPANT_ROLE_META) as ValidationParticipantRole[]

export const CONSENT_META: Record<ParticipantConsentStatus, SimpleMeta> = {
  not_required: { label: '불필요', tone: 'neutral', order: 0 },
  pending: { label: '대기', tone: 'warning', order: 1 },
  agreed: { label: '동의', tone: 'success', order: 2 },
  declined: { label: '거절', tone: 'danger', order: 3 },
}

export const PARTICIPANT_STATUS_META: Record<ParticipantStatus, SimpleMeta> = {
  invited: { label: '초대', tone: 'neutral', order: 0 },
  ready: { label: '준비', tone: 'info', order: 1 },
  completed: { label: '완료', tone: 'success', order: 2 },
  cancelled: { label: '취소', tone: 'neutral', order: 3 },
}

/* 시나리오 유형 */
export const SCENARIO_TYPE_META: Record<ValidationScenarioType, { label: string; icon: LucideIcon; tone: StatusTone }> = {
  happy_path: { label: '정상 흐름', icon: CheckCircle2, tone: 'success' },
  error: { label: '오류 처리', icon: AlertTriangle, tone: 'warning' },
  boundary: { label: '경계값', icon: Target, tone: 'accent' },
  permission: { label: '권한', icon: ShieldCheck, tone: 'neutral' },
  mobile: { label: '모바일', icon: Smartphone, tone: 'info' },
  data_quality: { label: '데이터 품질', icon: Database, tone: 'info' },
  performance: { label: '성능', icon: Gauge, tone: 'warning' },
  accessibility: { label: '접근성', icon: Accessibility, tone: 'accent' },
  ai_quality: { label: 'AI 품질', icon: Bot, tone: 'accent' },
  integration: { label: '외부 연동', icon: Link2, tone: 'warning' },
  conversion: { label: '전환', icon: TrendingUp, tone: 'success' },
  content: { label: '콘텐츠', icon: FileText, tone: 'info' },
  other: { label: '기타', icon: ClipboardList, tone: 'neutral' },
}
export const SCENARIO_TYPES = Object.keys(SCENARIO_TYPE_META) as ValidationScenarioType[]

/* 회차·실행 */
export const ROUND_STATUS_META: Record<ValidationRoundStatus, SimpleMeta> = {
  planned: { label: '계획', tone: 'neutral', order: 0 },
  ready: { label: '준비', tone: 'info', order: 1 },
  in_progress: { label: '진행 중', tone: 'warning', order: 2 },
  completed: { label: '완료', tone: 'success', order: 3 },
  cancelled: { label: '취소', tone: 'neutral', order: 4 },
}

export const RUN_RESULT_META: Record<ScenarioRunResult, IconMeta> = {
  not_run: { label: '미실행', tone: 'neutral', icon: MinusCircle, order: 0 },
  passed: { label: '통과', tone: 'success', icon: CheckCircle2, order: 1 },
  conditional: { label: '조건부', tone: 'warning', icon: AlertTriangle, order: 2 },
  failed: { label: '실패', tone: 'danger', icon: XCircle, order: 3 },
  blocked: { label: '차단', tone: 'danger', icon: Ban, order: 4 },
}
export const RUN_RESULTS = (Object.keys(RUN_RESULT_META) as ScenarioRunResult[]).sort(
  (a, b) => RUN_RESULT_META[a].order - RUN_RESULT_META[b].order,
)

/* 피드백 */
export const FEEDBACK_TYPE_META: Record<FeedbackType, { label: string; icon: LucideIcon; tone: StatusTone }> = {
  positive: { label: '긍정', icon: ThumbsUp, tone: 'success' },
  confusion: { label: '혼란', icon: HelpCircle, tone: 'warning' },
  request: { label: '요청', icon: Lightbulb, tone: 'info' },
  usability: { label: '사용성', icon: Wrench, tone: 'info' },
  data: { label: '데이터', icon: Database, tone: 'info' },
  performance: { label: '성능', icon: Gauge, tone: 'warning' },
  error: { label: '오류', icon: AlertTriangle, tone: 'danger' },
  content: { label: '콘텐츠', icon: FileText, tone: 'info' },
  accessibility: { label: '접근성', icon: Accessibility, tone: 'accent' },
  trust: { label: '신뢰', icon: ShieldCheck, tone: 'accent' },
  other: { label: '기타', icon: MessageSquare, tone: 'neutral' },
}
export const FEEDBACK_TYPES = Object.keys(FEEDBACK_TYPE_META) as FeedbackType[]

export const SEVERITY_META: Record<FeedbackSeverity, IconMeta> = {
  info: { label: '정보', tone: 'neutral', icon: ClipboardList, order: 0 },
  low: { label: '낮음', tone: 'info', icon: MinusCircle, order: 1 },
  medium: { label: '보통', tone: 'warning', icon: AlertTriangle, order: 2 },
  high: { label: '높음', tone: 'danger', icon: AlertTriangle, order: 3 },
  critical: { label: '중대', tone: 'danger', icon: ShieldAlert, order: 4 },
}
export const SEVERITIES = (Object.keys(SEVERITY_META) as FeedbackSeverity[]).sort(
  (a, b) => SEVERITY_META[a].order - SEVERITY_META[b].order,
)

export const FEEDBACK_STATUS_META: Record<FeedbackStatus, SimpleMeta> = {
  new: { label: '신규', tone: 'info', order: 0 },
  reviewed: { label: '검토됨', tone: 'neutral', order: 1 },
  accepted: { label: '채택', tone: 'accent', order: 2 },
  planned: { label: '개선 계획', tone: 'warning', order: 3 },
  resolved: { label: '해결', tone: 'success', order: 4 },
  rejected: { label: '거절', tone: 'neutral', order: 5 },
  duplicate: { label: '중복', tone: 'neutral', order: 6 },
}
export const FEEDBACK_STATUSES = Object.keys(FEEDBACK_STATUS_META) as FeedbackStatus[]

/* 이슈 */
export const ISSUE_TYPE_META: Record<ValidationIssueType, { label: string; icon: LucideIcon }> = {
  blocker: { label: '차단', icon: Ban },
  defect: { label: '결함', icon: AlertTriangle },
  data_gap: { label: '데이터 부족', icon: Database },
  process_gap: { label: '프로세스 공백', icon: Wrench },
  scope: { label: '범위', icon: Target },
  privacy: { label: '개인정보', icon: ShieldCheck },
  security: { label: '보안', icon: ShieldAlert },
  accessibility: { label: '접근성', icon: Accessibility },
  integration: { label: '외부 연동', icon: Link2 },
  content: { label: '콘텐츠', icon: FileText },
  adoption: { label: '도입', icon: Users },
  other: { label: '기타', icon: ClipboardList },
}
export const ISSUE_TYPES = Object.keys(ISSUE_TYPE_META) as ValidationIssueType[]

export const ISSUE_STATUS_META: Record<ValidationIssueStatus, SimpleMeta> = {
  open: { label: '열림', tone: 'danger', order: 0 },
  investigating: { label: '조사 중', tone: 'warning', order: 1 },
  planned: { label: '수정 계획', tone: 'info', order: 2 },
  fixed: { label: '수정됨', tone: 'accent', order: 3 },
  verified: { label: '검증됨', tone: 'success', order: 4 },
  accepted_risk: { label: '위험 감수', tone: 'warning', order: 5 },
  wont_fix: { label: '수정 안 함', tone: 'neutral', order: 6 },
}
export const ISSUE_STATUSES = Object.keys(ISSUE_STATUS_META) as ValidationIssueStatus[]

/* KPI */
export const METRIC_DIRECTION_META: Record<MetricDirection, { label: string; symbol: string; icon: LucideIcon }> = {
  increase: { label: '증가 목표', symbol: '▲', icon: TrendingUp },
  decrease: { label: '감소 목표', symbol: '▼', icon: TrendingDown },
  maintain: { label: '유지 목표', symbol: '＝', icon: MinusCircle },
  threshold: { label: '기준 충족', symbol: '≥', icon: Target },
}

export const METRIC_EVAL_META: Record<MetricEvaluationStatus, SimpleMeta> = {
  target_met: { label: '목표 달성', tone: 'success', order: 0 },
  improving: { label: '개선 중', tone: 'info', order: 1 },
  unchanged: { label: '변화 없음', tone: 'neutral', order: 2 },
  worsened: { label: '악화', tone: 'danger', order: 3 },
  insufficient_data: { label: '측정 필요', tone: 'warning', order: 4 },
}

/* Gate criterion 상태 */
export const GATE_CRITERION_STATUS_META: Record<GateCriterionStatus, SimpleMeta> = {
  not_checked: { label: '미확인', tone: 'neutral', order: 0 },
  met: { label: '충족', tone: 'success', order: 1 },
  partially_met: { label: '부분 충족', tone: 'warning', order: 2 },
  not_met: { label: '미충족', tone: 'danger', order: 3 },
  waived: { label: '예외', tone: 'accent', order: 4 },
}
export const GATE_CRITERION_STATUSES = Object.keys(GATE_CRITERION_STATUS_META) as GateCriterionStatus[]

/* 품질검사 심각도 */
export const QUALITY_SEVERITY_META: Record<ValidationQualitySeverity, { label: string; tone: StatusTone; icon: LucideIcon }> = {
  error: { label: '오류', tone: 'danger', icon: Ban },
  warning: { label: '경고', tone: 'warning', icon: AlertTriangle },
  info: { label: '안내', tone: 'info', icon: ClipboardList },
}

/* 보조 아이콘(요약 카드) */
export const SECTION_ICON = { plan: ClipboardList, build: Cpu, scenarios: ListChecks, participants: Users, rounds: FlaskConical, feedback: MessageSquare, metrics: Gauge, gate: ShieldCheck, evidence: Image, sparkle: Sparkles } as const
