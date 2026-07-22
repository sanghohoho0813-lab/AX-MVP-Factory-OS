import type {
  DeliverableAudience,
  DeliverablePackageType,
  DeliverableRedactionRule,
  DeliverableRedactionRuleType,
  DeliverableSectionType,
  DeliverableSectionVisibility,
} from '../../types/deliverables'
import { DELIVERABLE_ISO } from './contentBlocks'

export interface PackagePreset {
  audience: DeliverableAudience
  /** null이면 모든 생성 Section 포함 */
  sectionTypes: DeliverableSectionType[] | null
  redactionTypes: DeliverableRedactionRuleType[]
  /** Section 유형별 기본 공개 범위 (없으면 audience 기본값) */
  visibilityByType: Partial<Record<DeliverableSectionType, DeliverableSectionVisibility>>
  includePrompts: boolean
}

const CLIENT_SECTIONS: DeliverableSectionType[] = [
  'cover', 'executive_summary', 'company_profile', 'project_overview',
  'diagnosis_summary', 'ax_suitability', 'website_readiness',
  'selected_task', 'mvp_scope', 'website_strategy', 'sitemap', 'page_sections', 'content_assets',
  'kpi_results', 'implementation_roadmap',
]

const DEV_SECTIONS: DeliverableSectionType[] = [
  'cover', 'executive_summary', 'project_overview',
  'mvp_scope', 'workflow', 'feature_specification', 'screen_specification', 'data_specification',
  'permission_specification', 'business_rules', 'ai_guardrails', 'integration_scope',
  'acceptance_criteria', 'test_scenarios',
  'website_strategy', 'sitemap', 'page_sections', 'content_assets',
  'developer_prompt', 'implementation_roadmap',
]

const VALIDATION_SECTIONS: DeliverableSectionType[] = [
  'cover', 'executive_summary', 'project_overview',
  'validation_summary', 'stage_gate', 'kpi_results', 'issue_summary', 'evidence_index',
]

const INSTITUTION_SECTIONS: DeliverableSectionType[] = [
  'cover', 'executive_summary', 'company_profile', 'project_overview',
  'diagnosis_summary', 'selected_task', 'mvp_scope', 'website_strategy',
  'implementation_roadmap', 'kpi_results', 'validation_summary',
  'risk_register', 'evidence_index',
]

export const PACKAGE_PRESETS: Record<DeliverablePackageType, PackagePreset> = {
  internal_master: {
    audience: 'internal',
    sectionTypes: null, // 전체
    redactionTypes: [],
    visibilityByType: {},
    includePrompts: true,
  },
  client_proposal: {
    audience: 'client',
    sectionTypes: CLIENT_SECTIONS,
    redactionTypes: [
      'remove_personal_contact', 'remove_internal_note', 'remove_internal_risk',
      'remove_cost_detail', 'remove_unverified_claim', 'anonymize_participant', 'hide_source_id',
    ],
    visibilityByType: {
      executive_summary: 'client_visible',
      diagnosis_summary: 'client_visible',
      mvp_scope: 'client_visible',
      website_strategy: 'client_visible',
    },
    includePrompts: false,
  },
  development_handoff: {
    audience: 'developer',
    sectionTypes: DEV_SECTIONS,
    redactionTypes: ['remove_personal_contact', 'remove_cost_detail'],
    visibilityByType: {
      feature_specification: 'developer_visible',
      data_specification: 'developer_visible',
      developer_prompt: 'developer_visible',
    },
    includePrompts: true,
  },
  validation_report: {
    audience: 'mixed',
    sectionTypes: VALIDATION_SECTIONS,
    redactionTypes: ['anonymize_participant', 'remove_personal_contact'],
    visibilityByType: {},
    includePrompts: false,
  },
  institution_preparation: {
    audience: 'institution',
    sectionTypes: INSTITUTION_SECTIONS,
    redactionTypes: ['hide_source_id', 'anonymize_participant', 'remove_unverified_claim'],
    visibilityByType: {
      risk_register: 'institution_visible',
    },
    includePrompts: false,
  },
  custom: {
    audience: 'internal',
    sectionTypes: null,
    redactionTypes: [],
    visibilityByType: {},
    includePrompts: true,
  },
}

const REDACTION_DESC: Record<DeliverableRedactionRuleType, string> = {
  remove_personal_contact: '담당자·참여자 연락처 등 개인정보를 제거합니다.',
  remove_internal_note: '내부 담당자 평가·메모를 제거합니다.',
  remove_internal_risk: '내부 위험 등급 원문을 제거합니다.',
  remove_cost_detail: '내부 비용 메모를 제거합니다.',
  remove_unverified_claim: '승인되지 않은 수익·절감 추정 등 근거 없는 표현을 제거합니다.',
  anonymize_participant: '테스트 참여자 실명을 익명으로 처리합니다.',
  hide_source_id: '내부 ID를 숨깁니다.',
  custom: '사용자 정의 규칙입니다.',
}

let ruleSeq = 0
export function buildDefaultRedactionRules(types: DeliverableRedactionRuleType[]): DeliverableRedactionRule[] {
  ruleSeq = 0
  return types.map((type) => {
    ruleSeq += 1
    return {
      id: `redact-${ruleSeq}`,
      type,
      enabled: true,
      description: REDACTION_DESC[type],
      replacementText: type === 'anonymize_participant' ? '참여자' : '(비공개)',
      relatedSectionIds: [],
    }
  })
}

/** audience 기본 공개 범위 */
export function defaultVisibilityForAudience(audience: DeliverableAudience): DeliverableSectionVisibility {
  switch (audience) {
    case 'client': return 'client_visible'
    case 'developer': return 'developer_visible'
    case 'institution': return 'institution_visible'
    default: return 'shared'
  }
}

export { DELIVERABLE_ISO }
