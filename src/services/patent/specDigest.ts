/**
 * D-246 명세서 → 사업계획서 재료(요약 글). 벤처 사업계획서가 특허와 한 이야기가 되도록 명세서에서 '사실' 부분만 뽑는다.
 *
 *   발명의 명칭(한글 · 영문) · 기술분야 · 해결하려는 과제 · 해결 수단 · 효과 · 독립 청구항 · 도면 설명 · 부호(구성요소 이름)
 *
 * 규칙으로만 뽑는다(AI 없음). 문단 번호([0001])는 떼고, 칸마다 길이를 잘라 전체가 너무 길지 않게 한다.
 * 이 글은 화면에서 사람이 고칠 수 있고, AI 초안을 부를 때 '특허에 실제로 적힌 것' 으로 넘어간다.
 */
import type { SpecDoc, SpecItem } from './specParse'

export interface SpecDigest {
  title: string
  titleEn: string
  /** 재료 글(여러 줄) */
  text: string
  /** 독립 청구항 수 · 전체 청구항 수 */
  claims: { total: number; independent: number }
}

const PARA_NO = /^\s*(?:\[\d{4}\]|【\d{4}】)\s*/

function bodyOf(it: SpecItem | undefined): string {
  if (!it) return ''
  return it.content
    .filter((p) => p.images.length === 0 && !p.table)
    .map((p) => p.text.replace(PARA_NO, '').trim())
    .filter(Boolean)
    .join('\n')
}

const clip = (s: string, n: number) => {
  const t = s.replace(/[ \t]+/g, ' ').trim()
  return t.length > n ? `${t.slice(0, n)}…` : t
}

/** 다른 청구항을 인용하지 않는 청구항 = 독립 */
const isDependent = (t: string) => /청구항\s*\d+|제\s*\d+\s*항/.test(t.slice(0, 80))

export function specDigest(doc: SpecDoc, max = 4000): SpecDigest {
  const one = (role: SpecItem['role']) => doc.items.find((i) => i.role === role)
  const rawTitle = bodyOf(one('title')).split('\n')[0] ?? ''
  const m = /^(.*?)\s*\{(.*)\}\s*$/.exec(rawTitle)
  const title = (m ? m[1] : rawTitle).trim()
  const titleEn = (m ? m[2] : '').trim()
  const claims = doc.items.filter((i) => i.role === 'claim')
  const claimText = claims.map((c) => ({ n: c.num ?? 0, t: bodyOf(c) }))
  const independent = claimText.filter((c) => c.t && !isDependent(c.t))
  const signs = bodyOf(one('signs'))
    .split('\n')
    .map((l) => l.replace(/^\s*\d+[a-z]?\s*[:：]\s*/, '').trim())
    .filter(Boolean)

  const parts: Array<[string, string, number]> = [
    ['발명의 명칭', title + (titleEn ? ` (${titleEn})` : ''), 300],
    ['기술분야', bodyOf(one('field')), 300],
    ['해결하려는 과제', bodyOf(one('problem')), 600],
    ['과제의 해결 수단', bodyOf(one('solution')), 900],
    ['발명의 효과', bodyOf(one('effect')), 500],
    ...independent.slice(0, 2).map((c): [string, string, number] => [`독립 청구항 ${c.n}`, c.t, 700]),
    ['도면', bodyOf(one('drawingDesc')), 400],
    ['구성요소(부호의 설명)', signs.slice(0, 30).join(' · '), 400],
  ]
  const lines: string[] = []
  let left = max
  for (const [label, body, cap] of parts) {
    if (!body.trim() || left < 80) continue
    const t = clip(body, Math.min(cap, left - label.length - 4))
    lines.push(`[${label}] ${t}`)
    left -= t.length + label.length + 4
  }
  return { title, titleEn, text: lines.join('\n'), claims: { total: claims.length, independent: independent.length } }
}
