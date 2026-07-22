import type {
  DeliverableAudience,
  DeliverableContentBlock,
  DeliverableExportFormat,
  DeliverablePackage,
  DeliverableSection,
} from '../../types/deliverables'
import { AUDIENCE_META, PACKAGE_TYPE_META } from '../../lib/deliverableMeta'
import { buildRedactedView } from './redactionEngine'

/* ------------------------------------------------------------------ */
/* Markdown                                                            */
/* ------------------------------------------------------------------ */

function blockToMarkdown(b: DeliverableContentBlock): string[] {
  const lines: string[] = []
  switch (b.type) {
    case 'heading':
      lines.push(`## ${b.text}`)
      break
    case 'paragraph':
      if (b.title) lines.push(`**${b.title}**`)
      if (b.text) lines.push(b.text)
      break
    case 'callout':
      lines.push(`> ${b.title ? `**${b.title}** · ` : ''}${b.text}`)
      break
    case 'warning':
      lines.push(`> ⚠️ ${b.title ? `**${b.title}** · ` : ''}${b.text}`)
      break
    case 'bullet_list':
    case 'checklist':
    case 'timeline':
      if (b.title) lines.push(`**${b.title}**`)
      b.items.forEach((i) => lines.push(`- ${i}`))
      break
    case 'numbered_list':
      if (b.title) lines.push(`**${b.title}**`)
      b.items.forEach((i, idx) => lines.push(`${idx + 1}. ${i}`))
      break
    case 'key_value':
      if (b.title) lines.push(`**${b.title}**`)
      b.keyValues.forEach((kv) => lines.push(`- **${kv.key}**: ${kv.value}`))
      break
    case 'metric':
      lines.push(`- **${b.title}**: ${b.text}`)
      break
    case 'table':
      if (b.title) lines.push(`**${b.title}**`)
      if (b.tableHeaders.length) {
        lines.push(`| ${b.tableHeaders.join(' | ')} |`)
        lines.push(`| ${b.tableHeaders.map(() => '---').join(' | ')} |`)
      }
      b.rows.forEach((r) => lines.push(`| ${r.cells.join(' | ')} |`))
      break
    case 'code':
    case 'prompt':
      if (b.title) lines.push(`**${b.title}**`)
      lines.push('```')
      lines.push(b.text)
      lines.push('```')
      break
    case 'divider':
      lines.push('---')
      break
  }
  return lines
}

function sectionToMarkdown(s: DeliverableSection): string {
  const lines: string[] = [`# ${s.title}`]
  if (s.subtitle) lines.push(`*${s.subtitle}*`)
  if (s.summary) lines.push(s.summary)
  lines.push('')
  s.structuredContent.forEach((b) => {
    lines.push(...blockToMarkdown(b))
    lines.push('')
  })
  return lines.join('\n')
}

export function toMarkdown(pkg: DeliverablePackage, audience: DeliverableAudience): string {
  const view = buildRedactedView(pkg, audience)
  const header = [
    `# ${pkg.name}`,
    ``,
    `- 유형: ${PACKAGE_TYPE_META[pkg.type].label}`,
    `- 대상 독자: ${AUDIENCE_META[audience].label}`,
    `- 버전: v${pkg.version}`,
    ``,
    `---`,
    ``,
  ].join('\n')
  return header + view.sections.map(sectionToMarkdown).join('\n---\n\n')
}

/* ------------------------------------------------------------------ */
/* Plain text                                                          */
/* ------------------------------------------------------------------ */

export function toPlainText(pkg: DeliverablePackage, audience: DeliverableAudience): string {
  const view = buildRedactedView(pkg, audience)
  const lines: string[] = [pkg.name, `유형: ${PACKAGE_TYPE_META[pkg.type].label} · 대상: ${AUDIENCE_META[audience].label} · v${pkg.version}`, '']
  view.sections.forEach((s) => {
    lines.push('==============================')
    lines.push(s.title)
    if (s.subtitle) lines.push(s.subtitle)
    lines.push('------------------------------')
    lines.push(s.body)
    lines.push('')
  })
  return lines.join('\n')
}

/* ------------------------------------------------------------------ */
/* JSON                                                                */
/* ------------------------------------------------------------------ */

export function toJson(pkg: DeliverablePackage, audience: DeliverableAudience): string {
  const view = buildRedactedView(pkg, audience)
  const payload = {
    schema: 'deliverable-package.v1',
    package: {
      id: pkg.id,
      name: pkg.name,
      type: pkg.type,
      audience,
      version: pkg.version,
      status: pkg.status,
      includedTracks: pkg.includedTracks,
      finalSummary: pkg.finalSummary,
      assumptions: pkg.assumptions,
      openQuestions: pkg.openQuestions,
    },
    sections: view.sections.map((s) => ({
      type: s.type,
      track: s.track,
      title: s.title,
      subtitle: s.subtitle,
      summary: s.summary,
      visibility: s.visibility,
      content: s.structuredContent,
    })),
    prompts: audience === 'client' || audience === 'institution'
      ? []
      : pkg.prompts.map((p) => ({ track: p.track, type: p.type, title: p.title, purpose: p.purpose, sequenceNumber: p.sequenceNumber, content: p.content, prerequisites: p.prerequisites, completionChecks: p.completionChecks })),
    roadmap: pkg.roadmap,
    risks: audience === 'client' || audience === 'institution' ? pkg.risks.filter((r) => r.clientVisible) : pkg.risks,
    evidenceIndex: pkg.evidenceIndex.filter((e) => audience === 'internal' || audience === 'mixed' || !e.internalOnly),
  }
  return JSON.stringify(payload, null, 2)
}

/** 간단한 결정적 해시 (내보내기 기록 contentHash용) */
export function contentHash(content: string): string {
  let h = 0
  for (let i = 0; i < content.length; i += 1) {
    h = (h * 31 + content.charCodeAt(i)) | 0
  }
  return `h${(h >>> 0).toString(16)}-${content.length}`
}

export function buildExportContent(
  pkg: DeliverablePackage,
  format: DeliverableExportFormat,
  audience: DeliverableAudience,
): string {
  switch (format) {
    case 'markdown': return toMarkdown(pkg, audience)
    case 'text': return toPlainText(pkg, audience)
    case 'json': return toJson(pkg, audience)
    case 'print': return toMarkdown(pkg, audience) // 인쇄는 화면 렌더를 사용, 참고용 텍스트 반환
  }
}
