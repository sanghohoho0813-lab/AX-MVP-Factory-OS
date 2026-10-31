/**
 * D-386 여러 서류를 한 PDF 로 합쳐 보낸 파일 — 쪽마다 제목을 보고 서류별로 나눠 읽는다.
 *
 * 고객은 사업자등록증 · 등기부 · 재무제표를 스캔 한 번에 묶어 보내는 일이 많은데, 예전에는 첫 장 제목으로 칸 하나만 정하고
 * 나머지 쪽의 정보(설립일 · 임원 · 매출 …)는 첫 서류 것처럼 섞어 읽었다.
 *  - 글자를 읽을 때 쪽 사이에 쪽 나눔(\f)을 넣는다(docTextExtract). 글자 파일에 쪽 나눔이 있어도 같다.
 *  - 쪽 맨 위에서 서류 제목을 확실히 찾은 쪽이 새 서류의 시작 — 제목이 없는 쪽은 앞 서류에 붙인다(여러 쪽짜리 등기부 · 재무제표).
 *  - 서로 다른 서류가 둘 이상일 때만 나눈다. 파일은 첫 서류 칸에 두고, 나머지 칸은 '받음' + '○○.pdf 3쪽에 함께' 메모(파일을 두 번 올리지 않는다).
 * 규칙 계산 — 외부 호출 없음.
 */
import type { DocumentMeta } from '../content/clientOpsCatalog'
import { placeDocument, type DocPlacement } from './docClassify'

export const PAGE_BREAK = '\f'

export interface BundlePart {
  placement: DocPlacement
  text: string
  /** 1부터 — 이 서류가 시작하는 쪽 · 끝나는 쪽 */
  from: number
  to: number
}

const keyOf = (p: DocPlacement) => (p.kind === 'existing' ? `k:${p.key}` : `n:${p.label}`)

/** 쪽 나눔이 있는 글 → 서류별 묶음. 서로 다른 서류가 둘 이상이 아니면 null */
export function splitBundle(text: string, metas: DocumentMeta[]): BundlePart[] | null {
  const raw = String(text || '')
  if (!raw.includes(PAGE_BREAK)) return null
  const pages = raw.split(PAGE_BREAK)
  if (pages.length < 2) return null
  const parts: BundlePart[] = []
  pages.forEach((page, i) => {
    const t = page.trim()
    if (!t) return
    const pl = placeDocument({ text: t, fileName: '' }, metas)
    // 제목을 확실히 찾았고 앞 서류와 다른 서류면 새 묶음 — 같은 서류(등기부 2쪽)는 이어 붙인다
    const prev = parts[parts.length - 1]
    if (pl.sure && (!prev || keyOf(prev.placement) !== keyOf(pl))) parts.push({ placement: pl, text: t, from: i + 1, to: i + 1 })
    else if (prev) {
      prev.text = `${prev.text}\n${t}`
      prev.to = i + 1
    } else parts.push({ placement: pl, text: t, from: i + 1, to: i + 1 })
  })
  return parts.length >= 2 ? parts : null
}

/** '3쪽' · '3~4쪽' */
export function pagesLabel(p: Pick<BundlePart, 'from' | 'to'>): string {
  return p.from === p.to ? `${p.from}쪽` : `${p.from}~${p.to}쪽`
}
