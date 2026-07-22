import type {
  DeliverableBlockTone,
  DeliverableContentBlock,
  DeliverableKeyValue,
  DeliverableTableRow,
} from '../../types/deliverables'

/** 본문 콘텐츠는 결정적이어야 하므로 고정 ISO를 사용한다 (실제 시간은 저장 메타데이터에만). */
export const DELIVERABLE_ISO = '1970-01-01T00:00:00.000Z'
export const DELIVERABLE_RULE_VERSION = '1.0.0'

/** 근거 없는 수치를 임의 생성하지 않기 위한 표준 표기 */
export const NEEDS = {
  estimate: '산정 필요',
  measure: '현장 측정 필요',
  devEstimate: '담당 개발자 산정 필요',
  beforeTest: '테스트 전',
  institutionReview: '별도 심사 필요',
  manualEvidence: '수동 작성 · 근거 확인 필요',
} as const

/**
 * 콘텐츠 블록을 순서대로 만드는 빌더. blockId는 접두어+인덱스로 결정적이다.
 */
export class BlockBuilder {
  private blocks: DeliverableContentBlock[] = []
  private prefix: string
  constructor(prefix: string) {
    this.prefix = prefix
  }

  private base(): Omit<DeliverableContentBlock, 'type'> {
    const orderIndex = this.blocks.length
    return {
      id: `${this.prefix}-b${orderIndex}`,
      title: '',
      text: '',
      items: [],
      rows: [],
      tableHeaders: [],
      keyValues: [],
      tone: 'neutral',
      sourceReferenceIds: [],
      internalOnly: false,
      orderIndex,
    }
  }

  private push(block: DeliverableContentBlock): this {
    this.blocks.push(block)
    return this
  }

  heading(text: string): this {
    return this.push({ ...this.base(), type: 'heading', text })
  }

  paragraph(text: string, opts: { sources?: string[]; tone?: DeliverableBlockTone; internalOnly?: boolean } = {}): this {
    if (!text.trim()) return this
    return this.push({ ...this.base(), type: 'paragraph', text, sourceReferenceIds: opts.sources ?? [], tone: opts.tone ?? 'neutral', internalOnly: opts.internalOnly ?? false })
  }

  bullets(items: string[], opts: { title?: string; sources?: string[]; internalOnly?: boolean } = {}): this {
    const clean = items.filter((i) => i && i.trim())
    if (clean.length === 0) return this
    return this.push({ ...this.base(), type: 'bullet_list', title: opts.title ?? '', items: clean, sourceReferenceIds: opts.sources ?? [], internalOnly: opts.internalOnly ?? false })
  }

  numbered(items: string[], opts: { title?: string; sources?: string[] } = {}): this {
    const clean = items.filter((i) => i && i.trim())
    if (clean.length === 0) return this
    return this.push({ ...this.base(), type: 'numbered_list', title: opts.title ?? '', items: clean, sourceReferenceIds: opts.sources ?? [] })
  }

  keyValue(keyValues: DeliverableKeyValue[], opts: { title?: string; sources?: string[]; internalOnly?: boolean } = {}): this {
    const clean = keyValues.filter((kv) => kv.key)
    if (clean.length === 0) return this
    return this.push({ ...this.base(), type: 'key_value', title: opts.title ?? '', keyValues: clean, sourceReferenceIds: opts.sources ?? [], internalOnly: opts.internalOnly ?? false })
  }

  metric(title: string, value: string, opts: { tone?: DeliverableBlockTone; sources?: string[] } = {}): this {
    return this.push({ ...this.base(), type: 'metric', title, text: value, tone: opts.tone ?? 'neutral', sourceReferenceIds: opts.sources ?? [] })
  }

  table(headers: string[], rows: DeliverableTableRow[], opts: { title?: string; sources?: string[]; internalOnly?: boolean } = {}): this {
    if (rows.length === 0) return this
    return this.push({ ...this.base(), type: 'table', title: opts.title ?? '', tableHeaders: headers, rows, sourceReferenceIds: opts.sources ?? [], internalOnly: opts.internalOnly ?? false })
  }

  callout(text: string, opts: { title?: string; tone?: DeliverableBlockTone; internalOnly?: boolean } = {}): this {
    return this.push({ ...this.base(), type: 'callout', title: opts.title ?? '', text, tone: opts.tone ?? 'info', internalOnly: opts.internalOnly ?? false })
  }

  warning(text: string, opts: { title?: string; internalOnly?: boolean } = {}): this {
    return this.push({ ...this.base(), type: 'warning', title: opts.title ?? '', text, tone: 'warning', internalOnly: opts.internalOnly ?? false })
  }

  checklist(items: string[], opts: { title?: string } = {}): this {
    const clean = items.filter((i) => i && i.trim())
    if (clean.length === 0) return this
    return this.push({ ...this.base(), type: 'checklist', title: opts.title ?? '', items: clean })
  }

  timeline(items: string[], opts: { title?: string } = {}): this {
    const clean = items.filter((i) => i && i.trim())
    if (clean.length === 0) return this
    return this.push({ ...this.base(), type: 'timeline', title: opts.title ?? '', items: clean })
  }

  code(text: string, opts: { title?: string } = {}): this {
    return this.push({ ...this.base(), type: 'code', title: opts.title ?? '', text })
  }

  prompt(text: string, opts: { title?: string; internalOnly?: boolean } = {}): this {
    return this.push({ ...this.base(), type: 'prompt', title: opts.title ?? '', text, internalOnly: opts.internalOnly ?? false })
  }

  divider(): this {
    return this.push({ ...this.base(), type: 'divider' })
  }

  build(): DeliverableContentBlock[] {
    return this.blocks
  }
}

/** 블록 배열을 사람이 읽을 수 있는 본문 문자열로 직렬화 (originalBody용) */
export function blocksToText(blocks: DeliverableContentBlock[]): string {
  const lines: string[] = []
  for (const b of blocks) {
    switch (b.type) {
      case 'heading':
        lines.push(`# ${b.text}`)
        break
      case 'paragraph':
      case 'callout':
      case 'warning':
        if (b.title) lines.push(`【${b.title}】`)
        if (b.text) lines.push(b.text)
        break
      case 'bullet_list':
      case 'checklist':
      case 'timeline':
        if (b.title) lines.push(b.title)
        b.items.forEach((i) => lines.push(`- ${i}`))
        break
      case 'numbered_list':
        if (b.title) lines.push(b.title)
        b.items.forEach((i, idx) => lines.push(`${idx + 1}. ${i}`))
        break
      case 'key_value':
        if (b.title) lines.push(b.title)
        b.keyValues.forEach((kv) => lines.push(`${kv.key}: ${kv.value}`))
        break
      case 'metric':
        lines.push(`${b.title}: ${b.text}`)
        break
      case 'table':
        if (b.title) lines.push(b.title)
        if (b.tableHeaders.length) lines.push(b.tableHeaders.join(' | '))
        b.rows.forEach((r) => lines.push(r.cells.join(' | ')))
        break
      case 'code':
      case 'prompt':
        if (b.title) lines.push(b.title)
        lines.push(b.text)
        break
      case 'divider':
        lines.push('---')
        break
    }
    lines.push('')
  }
  return lines.join('\n').trim()
}
