import type { Organization, Project } from '../../types/domain'
import type {
  WebsiteDesign,
  WebsitePromptType,
} from '../../types/websiteDesign'
import {
  CONVERSION_ACTION_META,
  PAGE_STATUS_META,
  PAGE_TYPE_META,
  SECTION_TYPE_META,
  WEBSITE_TYPE_META,
} from '../../lib/websiteDesignMeta'

type Ctx = { design: WebsiteDesign; project: Project; organization: Organization | null }

function activePages(design: WebsiteDesign) {
  return design.pages
    .filter((p) => p.status === 'required' || p.status === 'recommended')
    .sort((a, b) => a.orderIndex - b.orderIndex)
}

function line(label: string, value: string): string {
  return value.trim() ? `- ${label}: ${value.trim()}` : ''
}

function joinLines(lines: string[]): string {
  return lines.filter((l) => l.trim() !== '').join('\n')
}

function orgLine(ctx: Ctx): string {
  const o = ctx.organization
  return o ? `${o.name} (${o.industry}${o.subIndustry ? ` · ${o.subIndustry}` : ''}${o.region ? ` · ${o.region}` : ''})` : '고객사'
}

function sitemapBlock(ctx: Ctx): string {
  return activePages(ctx.design)
    .map((p, i) => `  ${i + 1}. ${p.name} [${PAGE_STATUS_META[p.status].label}] — ${p.purpose}`)
    .join('\n')
}

function pagesDetailBlock(ctx: Ctx, withSections: boolean): string {
  return activePages(ctx.design)
    .map((p) => {
      const secs = p.sections
        .filter((s) => s.scope === 'required' || s.scope === 'recommended')
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((s) => {
          const cta = s.ctaActionId ? ' [CTA 포함]' : ''
          const msg = s.keyMessage ? ` — ${s.keyMessage}` : ''
          return withSections ? `    · ${SECTION_TYPE_META[s.sectionType].label}${msg}${cta}` : ''
        })
        .filter(Boolean)
      const head = `- ${p.name} (${p.slug}) — ${p.purpose}`
      return withSections && secs.length ? `${head}\n${secs.join('\n')}` : head
    })
    .join('\n')
}

function designBlock(ctx: Ctx): string {
  const d = ctx.design.designDirection
  return joinLines([
    line('브랜드 성격', d.personalities.map((p) => p).join(', ')),
    line('분위기', d.moodDescription),
    line('메인 색상 방향', d.primaryColorDirection),
    line('보조 색상 방향', d.secondaryColorDirection),
    line('포인트 색상 방향', d.accentColorDirection),
    line('배경 방향', d.backgroundDirection),
    line('타이포그래피', d.typographyDirection),
    line('본문 스타일', d.bodyStyle),
    line('정보 밀도', d.spacingDensity),
    line('모서리', d.cornerStyle),
    line('그림자', d.shadowStyle),
    line('이미지 스타일', d.imageStyle),
    line('아이콘 스타일', d.iconStyle),
    line('애니메이션', d.motionStyle),
    d.layoutPrinciples.length ? `- 레이아웃 원칙:\n${d.layoutPrinciples.map((x) => `    · ${x}`).join('\n')}` : '',
    d.mobilePrinciples.length ? `- 모바일 원칙:\n${d.mobilePrinciples.map((x) => `    · ${x}`).join('\n')}` : '',
    d.accessibilityPrinciples.length ? `- 접근성 원칙:\n${d.accessibilityPrinciples.map((x) => `    · ${x}`).join('\n')}` : '',
    d.prohibitedStyles.length ? `- 금지 디자인:\n${d.prohibitedStyles.map((x) => `    · ${x}`).join('\n')}` : '',
  ])
}

function ctaBlock(ctx: Ctx): string {
  return ctx.design.strategy.conversionActions
    .map((c) => `- [${c.priority}] ${c.label}: 버튼 "${c.buttonText}" → ${c.destination || CONVERSION_ACTION_META[c.type].label}`)
    .join('\n')
}

function buildClaudeCode(ctx: Ctx): string {
  const { design } = ctx
  const s = design.strategy
  const tech = design.technicalScope
  return joinLines([
    '# 홈페이지 개발 지시문 (Claude Code)',
    '',
    '## 1. 프로젝트 개요',
    line('고객사', orgLine(ctx)),
    line('프로젝트', ctx.project.name),
    line('홈페이지 유형', WEBSITE_TYPE_META[s.websiteType].label),
    line('홈페이지 목적', s.purpose),
    line('비즈니스 목표', s.businessGoal),
    '',
    '## 2. 핵심 고객',
    ...s.audiences.map((a) => `- ${a.name}: ${a.description}` + (a.trustNeeds.length ? ` (신뢰 요소: ${a.trustNeeds.join(', ')})` : '')),
    '',
    '## 3. 핵심 전환 행동(CTA)',
    ctaBlock(ctx),
    '',
    '## 4. 사이트맵',
    sitemapBlock(ctx),
    '',
    '## 5. 페이지·섹션 구성',
    pagesDetailBlock(ctx, true),
    '',
    '## 6. 디자인 가이드',
    designBlock(ctx),
    '',
    '## 7. 반응형·접근성',
    line('반응형', tech.responsive ? '전 페이지 반응형, 모바일 우선' : '데스크톱 우선'),
    line('접근성', tech.accessibilityLevel),
    line('성능 목표', tech.performanceGoal),
    '',
    '## 8. 기술 범위',
    line('프레임워크 선호', tech.frameworkPreference),
    line('폼', tech.forms ? '문의 폼 필요' : '없음'),
    line('SEO 기본', tech.seoBasics ? '메타 태그·시맨틱 마크업 적용' : '없음'),
    '',
    '## 9. 폼',
    ...design.forms.map((f) => `- ${f.name}: 필드 [${f.fields.join(', ')}] → ${f.destination}. 개인정보 동의 ${f.privacyConsentRequired ? '필수' : '불필요'}, 스팸 방지 ${f.spamProtectionRequired ? '필요' : '불필요'}`),
    '',
    '## 10. 외부 연동',
    ...design.integrations.map((i) => `- ${i.name}: ${i.purpose} (${i.requiredForLaunch ? '런칭 전 필요' : '이후 가능'}, 대체: ${i.fallback})`),
    '',
    '## 11. SEO 기본',
    ...activePages(design).map((p) => `- ${p.name}: 제목 "${p.seo.titleDirection}" / ${p.seo.indexable ? '색인' : '비색인'}`),
    '',
    '## 12. 구현하지 않을 범위',
    ...tech.excludedTechnicalScope.map((x) => `- ${x}`),
    '',
    '## 13. 완료 기준',
    '- 모든 필수 페이지·섹션 구현',
    '- 모든 CTA가 문의 경로로 연결',
    '- 문의 폼 제출 시 개인정보 동의 필수 검증',
    '- 모바일(390px)에서 가로 스크롤 없음',
    '- 이미지 대체 텍스트·명도 대비 충족',
    '',
    '## 14. 테스트 기준',
    '- 데스크톱/모바일 반응형 확인',
    '- 폼 유효성·동의 미체크 시 제출 차단',
    '- 주요 링크·CTA 동작 확인',
    '- 콘솔 오류 0',
  ])
}

function buildGeneric(ctx: Ctx): string {
  const { design } = ctx
  return joinLines([
    '# 홈페이지 제작 요청 (범용 제작도구)',
    '',
    line('업종·회사', orgLine(ctx)),
    line('홈페이지 유형', WEBSITE_TYPE_META[design.strategy.websiteType].label),
    line('목적', design.strategy.purpose),
    line('핵심 메시지', design.strategy.keyMessage),
    '',
    '## 필요한 페이지',
    sitemapBlock(ctx),
    '',
    '## 페이지별 구성',
    pagesDetailBlock(ctx, true),
    '',
    '## 디자인 방향',
    line('분위기', design.designDirection.moodDescription),
    line('색상', `${design.designDirection.primaryColorDirection} / ${design.designDirection.secondaryColorDirection} / 포인트: ${design.designDirection.accentColorDirection}`),
    line('레이아웃', design.designDirection.layoutPrinciples.join(', ')),
    '',
    '## 전환 행동',
    ctaBlock(ctx),
    '',
    '## 피해야 할 스타일',
    ...design.designDirection.prohibitedStyles.map((x) => `- ${x}`),
  ])
}

function buildDesignOnly(ctx: Ctx): string {
  const d = ctx.design.designDirection
  return joinLines([
    '# 디자인 방향 지시문',
    '',
    line('브랜드 성격', d.personalities.join(', ')),
    line('전체 분위기', d.moodDescription),
    '',
    '## 색상',
    line('메인', d.primaryColorDirection),
    line('보조', d.secondaryColorDirection),
    line('포인트', d.accentColorDirection),
    line('배경', d.backgroundDirection),
    '',
    '## 타이포그래피',
    line('제목', d.headingStyle),
    line('본문', d.bodyStyle),
    line('방향', d.typographyDirection),
    '',
    '## 레이아웃·컴포넌트',
    line('정보 밀도', d.spacingDensity),
    line('모서리', d.cornerStyle),
    line('그림자', d.shadowStyle),
    line('아이콘', d.iconStyle),
    line('이미지', d.imageStyle),
    line('애니메이션', d.motionStyle),
    ...d.layoutPrinciples.map((x) => `- 레이아웃: ${x}`),
    '',
    '## 금지 스타일',
    ...d.prohibitedStyles.map((x) => `- ${x}`),
  ])
}

function buildContentOnly(ctx: Ctx): string {
  const { design } = ctx
  return joinLines([
    '# 콘텐츠 작성 지시문',
    '',
    line('회사', orgLine(ctx)),
    line('어조', design.strategy.toneOfVoice),
    line('핵심 메시지', design.strategy.keyMessage),
    '',
    '## 페이지별 필요한 카피',
    ...activePages(design).map((p) => {
      const secMsgs = p.sections
        .filter((s) => (s.scope === 'required' || s.scope === 'recommended') && s.keyMessage)
        .map((s) => `    · ${SECTION_TYPE_META[s.sectionType].label}: ${s.keyMessage}`)
      return `- ${p.name} (${PAGE_TYPE_META[p.pageType].label})` + (secMsgs.length ? `\n${secMsgs.join('\n')}` : '')
    }),
    '',
    '## CTA 문구',
    ...design.strategy.conversionActions.map((c) => `- ${c.label}: "${c.buttonText}"`),
    '',
    '## 신뢰 문구·FAQ',
    '- 전문 자격·경력·인증을 근거와 함께 서술',
    '- FAQ는 실제 상담에서 자주 나오는 질문 위주로 5~8개',
    '- 사례는 문제 → 진행 → 결과 틀로 작성 (없는 사실을 만들지 말 것)',
    '',
    '## 부족한 콘텐츠(작성 필요)',
    ...design.contentItems.filter((c) => c.status === 'missing' || c.status === 'needs_review').map((c) => `- ${c.title}`),
  ])
}

const BUILDERS: Record<WebsitePromptType, (ctx: Ctx) => string> = {
  claude_code: buildClaudeCode,
  generic_builder: buildGeneric,
  design_only: buildDesignOnly,
  content_only: buildContentOnly,
}

/** 지정 유형의 개발 지시문 텍스트를 결정적으로 조립한다 (LLM 호출 없음). */
export function buildPromptContent(
  type: WebsitePromptType,
  design: WebsiteDesign,
  project: Project,
  organization: Organization | null,
): string {
  return BUILDERS[type]({ design, project, organization })
}
