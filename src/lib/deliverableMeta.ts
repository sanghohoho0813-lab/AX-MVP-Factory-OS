import {
  Boxes,
  Building2,
  ClipboardCheck,
  ClipboardList,
  Code2,
  FileText,
  FlaskConical,
  Landmark,
  type LucideIcon,
  Presentation,
  Route,
  ShieldCheck,
  Users,
} from 'lucide-react'
import type { StatusTone } from '../types'
import type {
  DeliverableAudience,
  DeliverablePackageStatus,
  DeliverablePackageType,
  DeliverablePromptType,
  DeliverableSectionStatus,
  DeliverableSectionVisibility,
  DeliverableTrackType,
} from '../types/deliverables'

interface Meta {
  label: string
  tone: StatusTone
  order: number
}
interface IconMeta extends Meta {
  icon: LucideIcon
  description?: string
}

/* 패키지 상태 */
export const PACKAGE_STATUS_META: Record<DeliverablePackageStatus, IconMeta> = {
  draft: { label: '작성 중', tone: 'neutral', icon: FileText, order: 0 },
  reviewed: { label: '내부 검토', tone: 'info', icon: ClipboardCheck, order: 1 },
  finalized: { label: '자료 확정', tone: 'success', icon: ShieldCheck, order: 2 },
  superseded: { label: '이전 버전', tone: 'neutral', icon: FileText, order: 3 },
  archived: { label: '보관', tone: 'neutral', icon: FileText, order: 4 },
}
export const PACKAGE_STATUSES = (Object.keys(PACKAGE_STATUS_META) as DeliverablePackageStatus[]).sort(
  (a, b) => PACKAGE_STATUS_META[a].order - PACKAGE_STATUS_META[b].order,
)

/* 패키지 유형 */
export const PACKAGE_TYPE_META: Record<DeliverablePackageType, IconMeta> = {
  internal_master: { label: '내부 종합본', tone: 'neutral', icon: Boxes, order: 0, description: '모든 결과와 내부 메모·리스크·프롬프트를 담은 내부 전용 종합 자료' },
  client_proposal: { label: '고객 설명자료', tone: 'info', icon: Presentation, order: 1, description: '고객에게 방향과 기대 효과를 설명하는 자료 (내부 메모·개인정보 제외)' },
  development_handoff: { label: '개발 전달자료', tone: 'accent', icon: Code2, order: 2, description: '개발자가 바로 착수할 수 있는 명세·프롬프트 중심 자료' },
  validation_report: { label: '테스트 결과자료', tone: 'warning', icon: FlaskConical, order: 3, description: '실제 사용 테스트 회차·결과·이슈·KPI를 정리한 자료' },
  institution_preparation: { label: '기관 제출 준비자료', tone: 'success', icon: Landmark, order: 4, description: '기관 제출을 위한 내부 준비본 (공식 신청서 아님)' },
  custom: { label: '직접 구성', tone: 'neutral', icon: FileText, order: 5, description: '포함 자료를 직접 선택해 구성하는 자료' },
}
export const PACKAGE_TYPES = (Object.keys(PACKAGE_TYPE_META) as DeliverablePackageType[]).sort(
  (a, b) => PACKAGE_TYPE_META[a].order - PACKAGE_TYPE_META[b].order,
)

/* 대상 독자 */
export const AUDIENCE_META: Record<DeliverableAudience, IconMeta> = {
  internal: { label: '내부용', tone: 'neutral', icon: Users, order: 0 },
  client: { label: '고객용', tone: 'info', icon: Building2, order: 1 },
  developer: { label: '개발자용', tone: 'accent', icon: Code2, order: 2 },
  institution: { label: '기관 준비용', tone: 'success', icon: Landmark, order: 3 },
  mixed: { label: '혼합', tone: 'neutral', icon: FileText, order: 4 },
}
export const AUDIENCES = (Object.keys(AUDIENCE_META) as DeliverableAudience[]).sort(
  (a, b) => AUDIENCE_META[a].order - AUDIENCE_META[b].order,
)

/* 트랙 */
export const DELIVERABLE_TRACK_META: Record<DeliverableTrackType, { label: string; icon: LucideIcon; tone: StatusTone }> = {
  overview: { label: '개요', icon: FileText, tone: 'neutral' },
  ax: { label: 'AX', icon: Boxes, tone: 'info' },
  website: { label: '홈페이지', icon: Presentation, tone: 'accent' },
  validation: { label: '실제 사용 테스트', icon: FlaskConical, tone: 'warning' },
  roadmap: { label: '실행 로드맵', icon: Route, tone: 'neutral' },
  evidence: { label: '근거', icon: ClipboardList, tone: 'neutral' },
  prompt: { label: '개발 프롬프트', icon: Code2, tone: 'accent' },
}

/* Section 공개 범위 */
export const VISIBILITY_META: Record<DeliverableSectionVisibility, Meta> = {
  internal_only: { label: '내부 전용', tone: 'danger', order: 0 },
  client_visible: { label: '고객 공개', tone: 'info', order: 1 },
  developer_visible: { label: '개발자 공개', tone: 'accent', order: 2 },
  institution_visible: { label: '기관 공개', tone: 'success', order: 3 },
  shared: { label: '전체 공개', tone: 'neutral', order: 4 },
}
export const VISIBILITIES = (Object.keys(VISIBILITY_META) as DeliverableSectionVisibility[]).sort(
  (a, b) => VISIBILITY_META[a].order - VISIBILITY_META[b].order,
)

/* Section 상태 */
export const SECTION_STATUS_META: Record<DeliverableSectionStatus, Meta> = {
  auto_generated: { label: '자동 생성', tone: 'neutral', order: 0 },
  needs_review: { label: '검토 필요', tone: 'warning', order: 1 },
  approved: { label: '검토 완료', tone: 'success', order: 2 },
  excluded: { label: '제외', tone: 'neutral', order: 3 },
  blocked: { label: '차단', tone: 'danger', order: 4 },
}

/* 프롬프트 유형 */
export const PROMPT_TYPE_META: Record<DeliverablePromptType, { label: string; track: DeliverableTrackType }> = {
  ax_full_build: { label: 'AX 전체 개발 프롬프트', track: 'ax' },
  ax_staged_build: { label: 'AX 단계별 개발 프롬프트', track: 'ax' },
  ax_design_revision: { label: 'AX 수정·재시험 프롬프트', track: 'ax' },
  website_full_build: { label: '홈페이지 전체 개발 프롬프트', track: 'website' },
  website_staged_build: { label: '홈페이지 단계별 프롬프트', track: 'website' },
  validation_fix: { label: '검증 수정 프롬프트', track: 'validation' },
  generic_handoff: { label: '일반 전달 프롬프트', track: 'prompt' },
  custom: { label: '직접 작성', track: 'prompt' },
}

/* 품질 심각도 */
export const DELIVERABLE_QUALITY_META: Record<'info' | 'warning' | 'error', { label: string; tone: StatusTone; icon: LucideIcon }> = {
  info: { label: '안내', tone: 'info', icon: ClipboardList },
  warning: { label: '경고', tone: 'warning', icon: ClipboardCheck },
  error: { label: '오류', tone: 'danger', icon: ShieldCheck },
}

/** 기관 제출 준비자료 고지 문구 (공식 신청서 아님) */
export const INSTITUTION_DISCLAIMER =
  '현재 자료는 기관 제출을 위한 내부 준비본이며 공식 신청서가 아닙니다. 기관 제출 전 실제 공고문·신청서식·제출 기준을 별도로 확인해야 합니다.'
