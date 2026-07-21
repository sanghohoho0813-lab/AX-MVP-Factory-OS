import type { DeliverablePackage, DeliverablePackageType } from '../../types/deliverables'
import type {
  CriterionCategory,
  DocumentCategory,
  FundingDocumentRequirement,
  FundingEvidence,
  FundingMatch,
} from '../../types/funding'
import type { CollectedFundingSources } from './evidenceCollector'
import { FUNDING_ISO } from './fundingTaxonomy'

/* ------------------------------------------------------------------ */
/* Stage 11 · 준비자료 요건 빌더 (deterministic, pure data)             */
/*                                                                     */
/* 후보들의 요건 점검 카테고리에서 필요한 표준 서류만 도출한다.          */
/* 전략 전체에서 공통으로 쓰이는 서류는 하나로 합쳐(dedupe) 생성한다.     */
/* 확정 제출자료(Stage 10)가 있으면 연결해 'ready'로 표시한다.           */
/* ------------------------------------------------------------------ */

interface DocSpec {
  category: DocumentCategory
  /** 이 서류가 필요해지는 요건 점검 카테고리 */
  triggers: CriterionCategory[]
  title: string
  reason: string
  required: boolean
  officialFormRequired: boolean
  sensitive: boolean
  /** sourceEvidenceIds 매칭에 쓰는 근거 라벨 키워드 */
  evidenceKeywords: string[]
}

/** 고정 순서 — 결정성 보장 */
const DOC_SPECS: DocSpec[] = [
  {
    category: 'company',
    triggers: ['basic', 'compliance', 'region'],
    title: '사업자등록증 · 법인등기부등본',
    reason: '기업 실체와 법인 자격을 확인하기 위해 필요합니다.',
    required: true,
    officialFormRequired: false,
    sensitive: false,
    evidenceKeywords: ['사업자등록', '업종', '지역', '설립'],
  },
  {
    category: 'financial',
    triggers: ['financial', 'credit'],
    title: '재무제표 · 부가세 신고자료',
    reason: '재무 상태와 매출 규모를 확인하기 위해 필요합니다.',
    required: true,
    officialFormRequired: false,
    sensitive: true,
    evidenceKeywords: ['연매출', '재무'],
  },
  {
    category: 'tax',
    triggers: ['financial', 'credit', 'compliance'],
    title: '납세증명',
    reason: '세금 체납 여부 등 기본 자격을 확인하기 위해 필요합니다.',
    required: true,
    officialFormRequired: false,
    sensitive: true,
    evidenceKeywords: ['납세', '세금'],
  },
  {
    category: 'credit',
    triggers: ['credit'],
    title: '신용정보',
    reason: '신용 관련 기초요건을 확인하기 위해 필요합니다.',
    required: true,
    officialFormRequired: false,
    sensitive: true,
    evidenceKeywords: ['신용'],
  },
  {
    category: 'technology',
    triggers: ['technology', 'innovation'],
    title: '기술 증빙 · 지식재산권',
    reason: '기술성과 보유 역량을 뒷받침하기 위해 필요합니다.',
    required: true,
    officialFormRequired: false,
    sensitive: false,
    evidenceKeywords: ['AI 활용', 'MVP 설계', '외부 연동', '기술'],
  },
  {
    category: 'rnd',
    triggers: ['innovation'],
    title: '연구개발계획서 · 연구인력 현황',
    reason: 'R&D 과제의 계획과 수행 인력을 확인하기 위해 필요합니다.',
    required: true,
    officialFormRequired: false,
    sensitive: false,
    evidenceKeywords: ['개선 KPI', '연구', 'MVP 설계'],
  },
  {
    category: 'employment',
    triggers: ['employment'],
    title: '고용보험 자료',
    reason: '고용 현황과 고용 관련 요건을 확인하기 위해 필요합니다.',
    required: false,
    officialFormRequired: false,
    sensitive: false,
    evidenceKeywords: ['직원 수', '고용'],
  },
  {
    category: 'certification',
    triggers: ['certification'],
    title: '인증 관련 서류',
    reason: '요구되는 인증 보유 여부를 확인하기 위해 필요합니다.',
    required: false,
    officialFormRequired: false,
    sensitive: false,
    evidenceKeywords: ['인증'],
  },
  {
    category: 'market',
    triggers: ['market'],
    title: '매출 증빙',
    reason: '시장·매출 실적을 뒷받침하기 위해 필요합니다.',
    required: false,
    officialFormRequired: false,
    sensitive: false,
    evidenceKeywords: ['연매출', '매출', 'KPI'],
  },
  {
    category: 'application',
    triggers: ['basic', 'documentation'],
    title: '신청서',
    reason: '지원 프로그램 접수를 위한 공식 신청서입니다.',
    required: true,
    officialFormRequired: true,
    sensitive: false,
    evidenceKeywords: ['제출자료', '자금 용도'],
  },
  {
    category: 'consent',
    triggers: ['documentation', 'compliance', 'credit'],
    title: '개인정보 동의서',
    reason: '개인정보 수집·이용 동의를 위한 공식 서식입니다.',
    required: true,
    officialFormRequired: true,
    sensitive: true,
    evidenceKeywords: [],
  },
]

/** Stage 10 확정 제출자료 중 준비자료로 연결 가능한 유형 */
const LINKABLE_PACKAGE_TYPES: DeliverablePackageType[] = [
  'development_handoff',
  'institution_preparation',
  'client_proposal',
]

/** application/company 카테고리에 확정 제출자료를 연결한다 */
const LINKED_CATEGORIES: DocumentCategory[] = ['application', 'company']

function collectPresentCriterionCategories(matches: FundingMatch[]): Set<CriterionCategory> {
  const present = new Set<CriterionCategory>()
  for (const match of matches) {
    for (const check of match.criterionChecks) {
      present.add(check.category)
    }
  }
  return present
}

function matchEvidenceIds(evidence: FundingEvidence[], keywords: string[]): string[] {
  if (keywords.length === 0) return []
  return evidence
    .filter((e) => keywords.some((k) => e.label.includes(k)))
    .map((e) => e.id)
}

function findLinkablePackage(packages: DeliverablePackage[]): DeliverablePackage | null {
  return packages.find((p) => LINKABLE_PACKAGE_TYPES.includes(p.type)) ?? null
}

/**
 * 후보들의 요건 카테고리에서 필요한 표준 준비자료 요건을 도출한다.
 * 전략 전체에서 공통 서류는 하나로 합쳐 반환한다(후보별 중복 생성 금지).
 * strategyId는 오케스트레이터가 채운다. matchId는 전략 수준이므로 null.
 */
export function buildDocumentRequirements(
  sources: CollectedFundingSources,
  matches: FundingMatch[],
): FundingDocumentRequirement[] {
  const present = collectPresentCriterionCategories(matches)
  const linkable = findLinkablePackage(sources.deliverablePackages)
  const isInstitutionPrep = linkable?.type === 'institution_preparation'

  const requirements: FundingDocumentRequirement[] = []

  for (const spec of DOC_SPECS) {
    const triggered = spec.triggers.some((c) => present.has(c))
    if (!triggered) continue

    const linkThisCategory = linkable !== null && LINKED_CATEGORIES.includes(spec.category)
    const sourceDeliverablePackageId = linkThisCategory ? linkable.id : ''
    const status = linkThisCategory ? 'ready' : 'missing'

    const notes =
      linkThisCategory && isInstitutionPrep
        ? '기관 제출 준비자료는 공식 신청서가 아님 — 실제 접수 서식은 별도 확인 필요'
        : ''

    requirements.push({
      id: `doc-${spec.category}`,
      strategyId: '',
      matchId: null,
      category: spec.category,
      title: spec.title,
      description: spec.reason,
      status,
      required: spec.required,
      sourceDeliverablePackageId,
      sourceEvidenceIds: matchEvidenceIds(sources.evidence, spec.evidenceKeywords),
      ownerId: '',
      dueDate: '',
      officialFormRequired: spec.officialFormRequired,
      sensitive: spec.sensitive,
      notes,
      createdAt: FUNDING_ISO,
      updatedAt: FUNDING_ISO,
    })
  }

  return requirements
}
