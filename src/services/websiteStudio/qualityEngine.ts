import type {
  WebsiteDesign,
  WebsiteQualityCheck,
  WebsiteScopeGuardrail,
} from '../../types/websiteDesign'
import { BLOCKING_GUARDRAILS, type GuardrailKey } from './scoringConfig'

type QualityInput = Pick<
  WebsiteDesign,
  | 'strategy'
  | 'pages'
  | 'contentItems'
  | 'assetRequirements'
  | 'designDirection'
  | 'forms'
  | 'integrations'
  | 'generatedPrompts'
  | 'designSummary'
>

let seq = 0
function mk(
  severity: WebsiteQualityCheck['severity'],
  title: string,
  description: string,
  passed: boolean,
  relatedIds: string[] = [],
): WebsiteQualityCheck {
  seq += 1
  return { id: `qc-${seq}`, severity, title, description, passed, relatedIds }
}

/**
 * 홈페이지 설계 품질검사. error severity + passed=false 는 확정을 막는다.
 * 결정적: 동일 설계면 동일 결과.
 */
export function runQualityChecks(
  design: QualityInput,
  guardrails: WebsiteScopeGuardrail[],
): WebsiteQualityCheck[] {
  seq = 0
  const checks: WebsiteQualityCheck[] = []
  const activePages = design.pages.filter((p) => p.status === 'required' || p.status === 'recommended')
  const requiredPages = design.pages.filter((p) => p.status === 'required')
  const home = design.pages.find((p) => p.pageType === 'home' && p.status !== 'excluded')
  const primaryCta = design.strategy.conversionActions.find((c) => c.id === design.strategy.primaryConversionActionId)

  /* 오류 (확정 차단) */
  checks.push(mk('error', '홈페이지 목적', '홈페이지 목적이 정의되어야 합니다.', design.strategy.purpose.trim() !== ''))
  checks.push(mk('error', '핵심 고객', '핵심 고객이 1명 이상 정의되어야 합니다.', design.strategy.audiences.length > 0))
  checks.push(mk('error', '핵심 전환 행동', '핵심 CTA가 정의되어야 합니다.', Boolean(primaryCta)))
  checks.push(mk('error', '홈 페이지', '홈 페이지가 있어야 합니다.', Boolean(home)))
  checks.push(mk('error', '필수 페이지', '필수 페이지가 1개 이상 있어야 합니다.', requiredPages.length > 0))
  const emptyRequired = requiredPages.filter((p) => p.sections.filter((s) => s.scope !== 'excluded').length === 0)
  checks.push(mk('error', '필수 페이지 섹션', '필수 페이지에는 섹션이 있어야 합니다.', emptyRequired.length === 0, emptyRequired.map((p) => p.id)))
  const heroNoMsg = design.pages
    .flatMap((p) => p.sections)
    .filter((s) => s.sectionType === 'hero' && s.scope !== 'excluded' && s.keyMessage.trim() === '')
  checks.push(mk('error', '히어로 메시지', '첫 화면(히어로)에 핵심 메시지가 있어야 합니다.', heroNoMsg.length === 0, heroNoMsg.map((s) => s.id)))
  const wantsInquiry = design.strategy.websiteType === 'lead_generation'
  const hasContactPath = design.pages.some((p) => (p.pageType === 'contact' || p.pageType === 'diagnosis') && p.status !== 'excluded')
  checks.push(mk('error', '문의 경로', '문의형 홈페이지에는 문의 경로가 있어야 합니다.', !wantsInquiry || hasContactPath))
  const formNoConsent = design.forms.filter((f) => f.required && !f.privacyConsentRequired)
  checks.push(mk('error', '개인정보 동의', '문의 폼에는 개인정보 수집·이용 동의가 포함되어야 합니다.', formNoConsent.length === 0, formNoConsent.map((f) => f.id)))
  const requiredContent = design.contentItems.filter((c) => c.required)
  const allMissing = requiredContent.length > 0 && requiredContent.every((c) => c.status === 'missing')
  checks.push(mk('error', '필수 콘텐츠', '필수 콘텐츠가 전부 부족 상태이면 안 됩니다.', !allMissing))
  checks.push(mk('error', '모바일 원칙', '모바일 원칙이 정의되어야 합니다.', design.designDirection.mobilePrinciples.length > 0))
  checks.push(mk('error', '디자인 방향', '디자인 방향(브랜드 성격)이 정의되어야 합니다.', design.designDirection.personalities.length > 0))
  const exceeded = guardrails.filter((g) => g.status === 'exceeded' && BLOCKING_GUARDRAILS.includes(g.key as GuardrailKey))
  checks.push(mk('error', '범위 초과', '범위 가드레일을 초과하지 않아야 합니다.', exceeded.length === 0, exceeded.map((g) => g.key)))
  checks.push(mk('error', '개발 지시문', 'Claude Code용 개발 지시문이 생성되어야 합니다.', design.generatedPrompts.some((p) => p.type === 'claude_code')))
  checks.push(mk('error', '최종 요약', '최종 설계 요약이 작성되어야 합니다.', design.designSummary.trim() !== ''))

  /* 경고 */
  checks.push(mk('warning', '페이지 수', '활성 페이지가 7개를 넘지 않는 것이 좋습니다.', activePages.length <= 7, []))
  checks.push(mk('warning', 'CTA 수', '핵심 CTA는 2개 이하가 좋습니다.', design.strategy.conversionActions.filter((c) => c.priority === 'primary').length <= 2))
  checks.push(mk('warning', '폼 수', '문의 폼은 2개 이하가 좋습니다.', design.forms.length <= 2))
  checks.push(mk('warning', '외부 연동 수', '외부 연동은 3개 이하가 좋습니다.', design.integrations.length <= 3))
  checks.push(mk('warning', 'FAQ', 'FAQ가 있으면 문의 부담이 줄어듭니다.', design.pages.some((p) => p.pageType === 'faq' && p.status !== 'excluded')))
  checks.push(mk('warning', '회사 소개', '회사·사무소 소개 페이지가 있으면 신뢰가 높아집니다.', design.pages.some((p) => p.pageType === 'about' && p.status !== 'excluded')))
  checks.push(mk('warning', '법적 페이지', '개인정보처리방침 페이지가 필요합니다.', design.pages.some((p) => p.pageType === 'privacy')))
  checks.push(mk('warning', '사진 자산', '실제 사진 자산 확보가 필요합니다.', design.assetRequirements.some((a) => a.status === 'ready')))
  checks.push(mk('warning', '금지 디자인', '금지할 디자인이 명시되어 있는지 확인하세요.', design.designDirection.prohibitedStyles.length > 0))
  checks.push(mk('warning', 'SEO 제목 방향', '주요 페이지에 SEO 제목 방향이 있으면 좋습니다.', design.pages.every((p) => p.seo.titleDirection.trim() !== '')))

  /* 안내 */
  const total = design.contentItems.length || 1
  const ready = design.contentItems.filter((c) => c.status === 'ready').length
  checks.push(mk('info', '콘텐츠 준비율', `콘텐츠 준비율 ${Math.round((ready / total) * 100)}%`, true))
  const noExternal = design.integrations.filter((i) => i.requiredForLaunch).length === 0
  checks.push(mk('info', '단순 구조', noExternal ? '외부 연동 없이 동작하는 단순 홈페이지입니다.' : '일부 외부 연동이 필요합니다.', true))

  return checks
}

export function hasBlockingErrors(checks: WebsiteQualityCheck[]): boolean {
  return checks.some((c) => c.severity === 'error' && !c.passed)
}
