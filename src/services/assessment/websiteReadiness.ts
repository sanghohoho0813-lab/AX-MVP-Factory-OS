import type {
  AssessmentConfidence,
  ScoreConfidence,
  WebsiteReadinessDomain,
  WebsiteReadinessResult,
  WebsiteReadinessScore,
} from '../../types/assessment'
import { WEBSITE_DOMAIN_META } from '../../lib/assessmentMeta'
import { WEBSITE_DOMAIN_MAX_SCORE } from './scoringConfig'
import type { AnalysisDataset } from './analysisData'
import type { NormalizedAnswer } from './answerNormalization'

const WEB_TAG = {
  purpose: 'website_purpose',
  audience: 'target_audience',
  keyService: 'key_service',
  differentiator: 'differentiator',
  cta: 'primary_cta',
  pages: 'pages',
  brandMood: 'brand_mood',
  color: 'color_preference',
  assets: 'content_assets',
  reference: 'reference',
  responsive: 'responsive',
  maintenance: 'maintenance',
} as const

function firstAnswer(
  dataset: AnalysisDataset,
  tag: string,
): NormalizedAnswer | null {
  for (const respondent of dataset.respondents) {
    const found = respondent.byTag.get(tag)?.find((n) => n.answered)
    if (found) return found
  }
  return null
}

function answered(dataset: AnalysisDataset, tag: string): boolean {
  return firstAnswer(dataset, tag) !== null
}

function domainConfidence(answeredCount: number, total: number): ScoreConfidence {
  if (total === 0) return 'low'
  const ratio = answeredCount / total
  if (ratio >= 0.8) return 'high'
  if (ratio >= 0.4) return 'medium'
  return 'low'
}

interface DomainCalc {
  score: number // 0-100 normalized
  answeredCount: number
  totalCount: number
  evidenceIds: string[]
  explanation: string
}

function calcPurpose(dataset: AnalysisDataset): DomainCalc {
  const purpose = answered(dataset, WEB_TAG.purpose)
  const cta = answered(dataset, WEB_TAG.cta)
  const service = answered(dataset, WEB_TAG.keyService)
  const score = (purpose ? 40 : 0) + (cta ? 30 : 0) + (service ? 30 : 0)
  const cnt = [purpose, cta, service].filter(Boolean).length
  return {
    score,
    answeredCount: cnt,
    totalCount: 3,
    evidenceIds: [],
    explanation: `홈페이지 목적(${purpose ? '응답' : '미응답'})·핵심 행동(${cta ? '응답' : '미응답'})·강조 서비스(${service ? '응답' : '미응답'}) 기준.`,
  }
}

function calcCustomer(dataset: AnalysisDataset): DomainCalc {
  const audience = answered(dataset, WEB_TAG.audience)
  const diff = answered(dataset, WEB_TAG.differentiator)
  const score = (audience ? 60 : 0) + (diff ? 40 : 0)
  return {
    score,
    answeredCount: [audience, diff].filter(Boolean).length,
    totalCount: 2,
    evidenceIds: [],
    explanation: `핵심 고객(${audience ? '응답' : '미응답'})·차별점(${diff ? '응답' : '미응답'}) 기준.`,
  }
}

function calcContent(dataset: AnalysisDataset): DomainCalc {
  const pages = firstAnswer(dataset, WEB_TAG.pages)
  const service = answered(dataset, WEB_TAG.keyService)
  const reference = answered(dataset, WEB_TAG.reference)
  const pageCount = pages?.selectedOptionValues.length ?? 0
  const pageScore =
    pageCount >= 4 ? 100 : pageCount >= 2 ? 70 : pageCount === 1 ? 40 : 0
  const score = Math.round(
    pageScore * 0.5 + (service ? 25 : 0) + (reference ? 25 : 0),
  )
  const cnt = [pageCount > 0, service, reference].filter(Boolean).length
  return {
    score,
    answeredCount: cnt,
    totalCount: 3,
    evidenceIds: [],
    explanation: `필요 페이지 ${pageCount}개·강조 서비스·참고 사이트 기준.`,
  }
}

function calcBrand(dataset: AnalysisDataset): DomainCalc {
  const mood = answered(dataset, WEB_TAG.brandMood)
  const color = answered(dataset, WEB_TAG.color)
  const score = (mood ? 60 : 0) + (color ? 40 : 0)
  return {
    score,
    answeredCount: [mood, color].filter(Boolean).length,
    totalCount: 2,
    evidenceIds: [],
    explanation: `브랜드 분위기(${mood ? '응답' : '미응답'})·색상 방향(${color ? '응답' : '미응답'}) 기준.`,
  }
}

function calcAssets(dataset: AnalysisDataset): DomainCalc {
  const assets = firstAnswer(dataset, WEB_TAG.assets)
  const selected = (assets?.selectedOptionValues ?? []).filter(
    (v) => v !== 'none',
  )
  const count = selected.length
  const score = count >= 3 ? 100 : count === 2 ? 70 : count === 1 ? 45 : 10
  return {
    score,
    answeredCount: assets ? 1 : 0,
    totalCount: 1,
    evidenceIds: [],
    explanation: `보유 콘텐츠 자산 ${count}종 기준.`,
  }
}

function calcOperation(dataset: AnalysisDataset): DomainCalc {
  const maintenance = firstAnswer(dataset, WEB_TAG.maintenance)
  const responsive = firstAnswer(dataset, WEB_TAG.responsive)
  const maintVal = maintenance ? String(maintenance.rawValue) : ''
  const maintScore =
    maintVal === '' ? 0 : maintVal === 'undecided' ? 30 : 100
  const respScore = responsive?.normalizedScore ?? 0
  const score = Math.round(maintScore * 0.6 + respScore * 0.4)
  return {
    score,
    answeredCount: [maintenance, responsive].filter(Boolean).length,
    totalCount: 2,
    evidenceIds: [],
    explanation: `운영 담당(${maintVal || '미정'})·반응형 중요도 기준.`,
  }
}

const CALC: Record<WebsiteReadinessDomain, (d: AnalysisDataset) => DomainCalc> = {
  purpose_clarity: calcPurpose,
  customer_clarity: calcCustomer,
  content_readiness: calcContent,
  brand_direction: calcBrand,
  asset_readiness: calcAssets,
  operation_readiness: calcOperation,
}

const WEB_DOMAIN_ORDER: WebsiteReadinessDomain[] = [
  'purpose_clarity',
  'customer_clarity',
  'content_readiness',
  'brand_direction',
  'asset_readiness',
  'operation_readiness',
]

/** 홈페이지 제작 준비도 분석 (순수 함수) */
export function analyzeWebsiteReadiness(
  dataset: AnalysisDataset,
): WebsiteReadinessResult {
  const domains: WebsiteReadinessScore[] = []
  let totalScore = 0

  for (const domain of WEB_DOMAIN_ORDER) {
    const calc = CALC[domain](dataset)
    const maxScore = WEBSITE_DOMAIN_MAX_SCORE[domain]
    const score = Math.round((calc.score / 100) * maxScore * 10) / 10
    totalScore += score
    domains.push({
      domain,
      score,
      maxScore,
      confidence: domainConfidence(calc.answeredCount, calc.totalCount),
      evidenceIds: calc.evidenceIds,
      explanation: `${WEBSITE_DOMAIN_META[domain].label}: ${calc.explanation}`,
    })
  }

  const overallScore = Math.round(totalScore)
  const recommendation =
    overallScore >= 80
      ? 'design_ready'
      : overallScore >= 65
        ? 'content_supplement'
        : overallScore >= 50
          ? 'structure_first'
          : 'planning_interview_first'

  // 부족 자산·콘텐츠
  const assets = firstAnswer(dataset, WEB_TAG.assets)
  const selectedAssets = new Set(assets?.selectedOptionValues ?? [])
  const assetLabels: Record<string, string> = {
    logo: '로고(고해상도)',
    photo: '제품·현장 사진',
    video: '홍보 영상',
    brochure: '회사 소개서',
    certificate: '인증서·수상 이력',
  }
  const missingAssets = Object.entries(assetLabels)
    .filter(([key]) => !selectedAssets.has(key))
    .map(([, label]) => label)

  const missingContent: string[] = []
  if (!answered(dataset, WEB_TAG.keyService)) missingContent.push('강조 서비스 설명')
  if (!answered(dataset, WEB_TAG.differentiator)) missingContent.push('차별점 정리')
  if (!answered(dataset, WEB_TAG.audience)) missingContent.push('핵심 고객 정의')
  if (!answered(dataset, WEB_TAG.reference)) missingContent.push('참고 사이트')

  const designRisks: string[] = []
  if (!answered(dataset, WEB_TAG.brandMood)) designRisks.push('브랜드 분위기 미정')
  if (!answered(dataset, WEB_TAG.color)) designRisks.push('선호·금지 색상 미정')
  if (selectedAssets.has('none') || selectedAssets.size === 0) {
    designRisks.push('시각 자산 부족')
  }

  const nextActions =
    recommendation === 'design_ready'
      ? ['바로 디자인 시안 제작을 시작할 수 있습니다.', '부족 자산이 있으면 병행 준비하세요.']
      : recommendation === 'content_supplement'
        ? ['부족한 콘텐츠·자산을 보완한 뒤 시안 제작을 권장합니다.']
        : recommendation === 'structure_first'
          ? ['필요 페이지 구조와 핵심 콘텐츠를 먼저 정리하세요.']
          : ['목적·고객·콘텐츠 확인을 위한 기획 인터뷰를 먼저 진행하세요.']

  // 전체 신뢰도
  const answeredDomains = domains.filter((d) => d.confidence !== 'low').length
  const confidence: AssessmentConfidence =
    dataset.respondents.length === 0
      ? 'insufficient'
      : answeredDomains >= 5
        ? 'high'
        : answeredDomains >= 3
          ? 'medium'
          : 'low'

  return {
    overallScore,
    recommendation,
    confidence,
    domains,
    missingAssets,
    missingContent,
    designRisks,
    nextActions,
  }
}
