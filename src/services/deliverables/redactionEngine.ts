import type {
  DeliverableAudience,
  DeliverableContentBlock,
  DeliverablePackage,
  DeliverableRedactionRule,
  DeliverableSection,
  DeliverableSectionVisibility,
} from '../../types/deliverables'

/** 공개 범위가 대상 독자에게 허용되는지 */
export function visibilityAllowsAudience(
  visibility: DeliverableSectionVisibility,
  audience: DeliverableAudience,
): boolean {
  if (audience === 'internal' || audience === 'mixed') return true
  switch (visibility) {
    case 'shared': return true
    case 'internal_only': return false
    case 'client_visible': return audience === 'client'
    case 'developer_visible': return audience === 'developer'
    case 'institution_visible': return audience === 'institution'
    default: return false
  }
}

const PHONE = /01[016-9][-\s]?\d{3,4}[-\s]?\d{4}/g
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g

function enabled(rules: DeliverableRedactionRule[], type: DeliverableRedactionRule['type']): DeliverableRedactionRule | undefined {
  return rules.find((r) => r.type === type && r.enabled)
}

/** 텍스트에 활성 가림 규칙을 적용한다 (개인정보 등) */
export function redactText(text: string, rules: DeliverableRedactionRule[]): string {
  let out = text
  const contact = enabled(rules, 'remove_personal_contact')
  if (contact) {
    out = out.replace(PHONE, contact.replacementText || '(연락처 비공개)')
    out = out.replace(EMAIL, contact.replacementText || '(이메일 비공개)')
  }
  return out
}

function redactBlock(block: DeliverableContentBlock, rules: DeliverableRedactionRule[]): DeliverableContentBlock {
  return {
    ...block,
    text: redactText(block.text, rules),
    items: block.items.map((i) => redactText(i, rules)),
    keyValues: block.keyValues.map((kv) => ({ key: kv.key, value: redactText(kv.value, rules) })),
    rows: block.rows.map((r) => ({ cells: r.cells.map((c) => redactText(c, rules)) })),
    // hide_source_id 활성 시 출처 ID 표기를 감춘다
    sourceReferenceIds: enabled(rules, 'hide_source_id') ? [] : block.sourceReferenceIds,
  }
}

export interface RedactedView {
  audience: DeliverableAudience
  sections: DeliverableSection[]
  removedSectionCount: number
  removedBlockCount: number
}

/**
 * 대상 독자 기준으로 패키지의 공개 가능한 Section·블록만 남긴 뷰를 만든다.
 * 원본 패키지는 변경하지 않는다 (읽기 전용 뷰).
 */
export function buildRedactedView(pkg: DeliverablePackage, audience: DeliverableAudience): RedactedView {
  const rules = pkg.redactionRules
  const internalMode = audience === 'internal' || audience === 'mixed'
  let removedSectionCount = 0
  let removedBlockCount = 0
  const sections: DeliverableSection[] = []

  for (const section of pkg.sections) {
    if (section.status === 'excluded') continue
    if (!visibilityAllowsAudience(section.visibility, audience)) {
      removedSectionCount += 1
      continue
    }
    const keptBlocks = section.structuredContent.filter((b) => {
      if (!internalMode && b.internalOnly) {
        removedBlockCount += 1
        return false
      }
      return true
    })
    sections.push({
      ...section,
      structuredContent: internalMode ? keptBlocks : keptBlocks.map((b) => redactBlock(b, rules)),
    })
  }

  return { audience, sections, removedSectionCount, removedBlockCount }
}

/** 고객·기관용 뷰에 내부 전용 내용이 남아있는지 검사 (품질검사용) */
export function hasLeakedInternalContent(pkg: DeliverablePackage, audience: DeliverableAudience): boolean {
  if (audience === 'internal' || audience === 'mixed') return false
  return pkg.sections.some(
    (s) => s.status !== 'excluded' && s.visibility === 'internal_only' && visibilityAllowsAudience(s.visibility, audience),
  )
}
