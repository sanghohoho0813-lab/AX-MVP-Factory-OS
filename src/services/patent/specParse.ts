/**
 * D-245 명세서 읽기 — 특허로 명세서(.hwpx) · 복붙용 MD · 글(.txt) 을 같은 모양(SpecDoc)으로.
 *
 * HWPX: Contents/section*.xml 의 맨 바깥 문단(hp:p)마다 글(hp:t) · 그림(hp:pic) · 표(hp:tbl) · 글자 모양 번호(charPrIDRef).
 *       header.xml 의 글자 모양(굵게 · 기울임 · 밑줄 · 취소선 · 위/아래 첨자 · 음영 · 색) — 발명의 명칭 · 대표도 숨은 서식(E-261) 확인용.
 *       BinData/* 그림은 머리만 읽는다(TIFF 규격 확인).
 * 글: 한 줄 = 한 문단. 【식별항목】 · [식별항목] · **[식별항목]**(Master 복붙용 MD 모양) 을 알아본다.
 *
 * AI 를 쓰지 않는다 — 규칙으로 읽는다.
 */
import { imageInfo, type ImageInfo } from './tiffInfo'
import { unzip } from './zip'

export interface CharProp {
  bold: boolean
  italic: boolean
  underline: boolean
  strike: boolean
  supscript: boolean
  subscript: boolean
  shade: boolean
  color: boolean
}

export interface SpecRun {
  text: string
  charId: string
}

export interface SpecPara {
  idx: number
  text: string
  runs: SpecRun[]
  /** 이 문단에 든 그림(바이너리 이름) */
  images: string[]
  table: boolean
}

/** 식별항목이 어떤 모양으로 적혔나 */
export type IdentStyle = 'full' | 'square' | 'md'

export type Role =
  | 'desc'
  | 'title'
  | 'field'
  | 'background'
  | 'priorArt'
  | 'patentLit'
  | 'nonPatentLit'
  | 'content'
  | 'problem'
  | 'solution'
  | 'effect'
  | 'drawingDesc'
  | 'detail'
  | 'signs'
  | 'industrial'
  | 'claimsHead'
  | 'claim'
  | 'abstractHead'
  | 'abstract'
  | 'repFig'
  | 'figsHead'
  | 'fig'
  | 'inline'
  | 'other'

export interface SpecItem {
  /** 적힌 이름 그대로(괄호 뺀) */
  name: string
  role: Role
  /** 청구항 · 도 번호 */
  num?: number
  style: IdentStyle
  /** 식별항목 문단이 굵게인가(HWPX) */
  bold: boolean
  paraIdx: number
  /** 다음 식별항목 전까지의 문단(인라인 식별항목 — 표 · 수학식 — 은 안에 그대로) */
  content: SpecPara[]
}

export interface SpecDoc {
  kind: 'hwpx' | 'text'
  fileName: string
  paras: SpecPara[]
  items: SpecItem[]
  charProps: Record<string, CharProp>
  /** 바이너리 이름(image1) → 그림 머리 */
  images: Record<string, ImageInfo>
}

/* ------------------------------------------------------------------ */
/* 식별항목 이름 → 역할                                                  */
/* ------------------------------------------------------------------ */

const ROLE_BY_NAME: Record<string, Role> = {
  발명의설명: 'desc',
  명세서: 'desc',
  발명의명칭: 'title',
  기술분야: 'field',
  발명의배경이되는기술: 'background',
  배경기술: 'background',
  선행기술문헌: 'priorArt',
  특허문헌: 'patentLit',
  비특허문헌: 'nonPatentLit',
  발명의내용: 'content',
  해결하려는과제: 'problem',
  해결하고자하는과제: 'problem',
  해결하고자하는기술적과제: 'problem',
  과제의해결수단: 'solution',
  과제해결수단: 'solution',
  발명의효과: 'effect',
  도면의간단한설명: 'drawingDesc',
  발명을실시하기위한구체적인내용: 'detail',
  발명의실시를위한구체적인내용: 'detail',
  발명을실시하기위한형태: 'detail',
  부호의설명: 'signs',
  산업상이용가능성: 'industrial',
  청구범위: 'claimsHead',
  특허청구범위: 'claimsHead',
  요약서: 'abstractHead',
  요약: 'abstract',
  대표도: 'repFig',
  도면: 'figsHead',
}

export const ROLE_LABEL: Record<Role, string> = {
  desc: '발명의 설명',
  title: '발명의 명칭',
  field: '기술분야',
  background: '발명의 배경이 되는 기술',
  priorArt: '선행기술문헌',
  patentLit: '특허문헌',
  nonPatentLit: '비특허문헌',
  content: '발명의 내용',
  problem: '해결하려는 과제',
  solution: '과제의 해결 수단',
  effect: '발명의 효과',
  drawingDesc: '도면의 간단한 설명',
  detail: '발명을 실시하기 위한 구체적인 내용',
  signs: '부호의 설명',
  industrial: '산업상 이용가능성',
  claimsHead: '청구범위',
  claim: '청구항',
  abstractHead: '요약서',
  abstract: '요약',
  repFig: '대표도',
  figsHead: '도면',
  fig: '도',
  inline: '표 · 수학식',
  other: '기타',
}

const norm = (s: string) => s.replace(/\s+/g, '')

/** 문단 글이 식별항목이면 { name, role, num, style } */
export function identOf(raw: string): { name: string; role: Role; num?: number; style: IdentStyle } | null {
  const t = raw.trim()
  let m = /^【\s*([^】]{1,40}?)\s*】$/.exec(t)
  let style: IdentStyle = 'full'
  if (!m) {
    m = /^\*\*\s*\[\s*([^\]]{1,40}?)\s*\]\s*\*\*$/.exec(t)
    style = 'md'
  }
  if (!m) {
    m = /^\[\s*([^\]]{1,40}?)\s*\]$/.exec(t)
    style = 'square'
  }
  if (!m) return null
  const name = m[1].trim()
  const n = norm(name)
  if (/^\d{3,5}$/.test(n)) return null // 【0001】 문단 번호만 있는 줄
  const claim = /^청구항(\d{1,3})$/.exec(n)
  if (claim) return { name, role: 'claim', num: Number(claim[1]), style }
  const fig = /^도(\d{1,3})$/.exec(n)
  if (fig) return { name, role: 'fig', num: Number(fig[1]), style }
  if (/^(표|수학식|화학식|반응식|서열)\d{1,3}$/.test(n)) return { name, role: 'inline', style }
  const role = ROLE_BY_NAME[n]
  if (role) return { name, role, style }
  // 대괄호 모양은 아는 이름만 식별항목으로 본다(본문 속 [참고] 같은 것 빼고)
  if (style !== 'full') return null
  return { name, role: 'other', style }
}

/* ------------------------------------------------------------------ */
/* 항목 나누기(공통)                                                      */
/* ------------------------------------------------------------------ */

function splitItems(paras: SpecPara[], boldOf: (p: SpecPara) => boolean): SpecItem[] {
  const items: SpecItem[] = []
  let cur: SpecItem | null = null
  for (const p of paras) {
    const id = p.images.length === 0 && !p.table ? identOf(p.text) : null
    if (id && id.role !== 'inline') {
      cur = { name: id.name, role: id.role, num: id.num, style: id.style, bold: boldOf(p), paraIdx: p.idx, content: [] }
      items.push(cur)
    } else if (cur) cur.content.push(p)
  }
  return items
}

/* ------------------------------------------------------------------ */
/* 글(.txt · .md)                                                         */
/* ------------------------------------------------------------------ */

export function parseSpecText(text: string, fileName = '붙여넣은 글'): SpecDoc {
  const lines = String(text ?? '').replace(/\r\n?/g, '\n').split('\n')
  const paras: SpecPara[] = lines.map((line, idx) => ({ idx, text: line, runs: [{ text: line, charId: '' }], images: [], table: false }))
  return { kind: 'text', fileName, paras, items: splitItems(paras, () => false), charProps: {}, images: {} }
}

/* ------------------------------------------------------------------ */
/* HWPX                                                                  */
/* ------------------------------------------------------------------ */

const ENT: Record<string, string> = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" }
function decodeXml(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-z]+);/g, (all, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : all
    }
    return ENT[e] ?? all
  })
}

const attr = (tagBody: string, name: string): string | null => {
  const m = new RegExp(`\\b${name}="([^"]*)"`).exec(tagBody)
  return m ? m[1] : null
}

/** 한 section XML → 맨 바깥 문단들(표 안 문단은 표 문단 하나로 묶는다) */
export function parseSectionXml(xml: string, startIdx = 0): SpecPara[] {
  const out: SpecPara[] = []
  const re = /<(\/?)([A-Za-z0-9_]+:)?([A-Za-z0-9_]+)([^>]*?)(\/?)>|([^<]+)/g
  let depthP = 0
  let tblDepth = 0
  let inT = false
  let cur: SpecPara | null = null
  let runChar = ''
  let m: RegExpExecArray | null
  while ((m = re.exec(xml))) {
    const [, close, , local, body, selfClose, text] = m
    if (text !== undefined) {
      if (cur && inT && depthP === 1 && tblDepth === 0) {
        const t = decodeXml(text)
        cur.text += t
        const last = cur.runs[cur.runs.length - 1]
        if (last && last.charId === runChar) last.text += t
        else cur.runs.push({ text: t, charId: runChar })
      }
      continue
    }
    if (local === 'p') {
      if (close) {
        depthP -= 1
        if (depthP === 0 && cur) {
          out.push(cur)
          cur = null
        }
      } else if (!selfClose) {
        depthP += 1
        if (depthP === 1) cur = { idx: startIdx + out.length, text: '', runs: [], images: [], table: false }
      } else if (depthP === 0) out.push({ idx: startIdx + out.length, text: '', runs: [], images: [], table: false })
      continue
    }
    if (local === 'tbl') {
      if (close) tblDepth = Math.max(0, tblDepth - 1)
      else if (!selfClose) {
        tblDepth += 1
        if (cur) cur.table = true
      }
      continue
    }
    if (local === 'run' && !close) {
      runChar = attr(body, 'charPrIDRef') ?? ''
      continue
    }
    if (local === 't') {
      if (selfClose) continue
      inT = !close
      continue
    }
    if ((local === 'lineBreak' || local === 'tab' || local === 'nbSpace' || local === 'fwSpace') && cur && inT && depthP === 1 && tblDepth === 0) {
      const t = local === 'tab' ? '\t' : local === 'lineBreak' ? '\n' : ' '
      cur.text += t
      const last = cur.runs[cur.runs.length - 1]
      if (last) last.text += t
      continue
    }
    if (local === 'img' && cur && tblDepth === 0) {
      const ref = attr(body, 'binaryItemIDRef')
      if (ref) cur.images.push(ref)
    }
  }
  return out
}

export function parseCharProps(headerXml: string): Record<string, CharProp> {
  const out: Record<string, CharProp> = {}
  const re = /<(?:[A-Za-z0-9_]+:)?charPr\b([^>]*)>([\s\S]*?)<\/(?:[A-Za-z0-9_]+:)?charPr>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(headerXml))) {
    const id = attr(m[1], 'id')
    if (id == null) continue
    const inner = m[2]
    const has = (tag: string) => new RegExp(`<(?:[A-Za-z0-9_]+:)?${tag}\\b`).test(inner)
    const ul = /<(?:[A-Za-z0-9_]+:)?underline\b[^>]*\btype="([A-Z_]+)"/.exec(inner)
    const so = /<(?:[A-Za-z0-9_]+:)?strikeout\b[^>]*\bshape="([A-Z_]+)"/.exec(inner)
    const shade = attr(m[1], 'shadeColor')
    const color = attr(m[1], 'textColor')
    out[id] = {
      bold: has('bold'),
      italic: has('italic'),
      underline: !!ul && ul[1] !== 'NONE',
      strike: !!so && so[1] !== 'NONE',
      supscript: has('supscript'),
      subscript: has('subscript'),
      shade: !!shade && !/^(none|#FFFFFF)$/i.test(shade),
      color: !!color && !/^#000000$/i.test(color),
    }
  }
  return out
}

export function charPropFlags(p: CharProp | undefined): string[] {
  if (!p) return []
  const out: string[] = []
  if (p.bold) out.push('굵게')
  if (p.italic) out.push('기울임')
  if (p.underline) out.push('밑줄')
  if (p.strike) out.push('취소선')
  if (p.supscript) out.push('위 첨자')
  if (p.subscript) out.push('아래 첨자')
  if (p.shade) out.push('음영')
  if (p.color) out.push('글자색')
  return out
}

export async function parseHwpx(bytes: Uint8Array, fileName = '명세서.hwpx'): Promise<SpecDoc> {
  const files = await unzip(bytes, (n) => /^Contents\/(section\d+|header)\.xml$/i.test(n) || /^BinData\//i.test(n))
  const dec = new TextDecoder('utf-8')
  const sections = [...files.keys()].filter((n) => /^Contents\/section\d+\.xml$/i.test(n)).sort((a, b) => Number(/(\d+)/.exec(a)?.[1]) - Number(/(\d+)/.exec(b)?.[1]))
  if (sections.length === 0) throw new Error('HWPX 안에 본문(Contents/section0.xml)이 없습니다.')
  const paras: SpecPara[] = []
  for (const s of sections) paras.push(...parseSectionXml(dec.decode(files.get(s)), paras.length))
  const header = files.get('Contents/header.xml')
  const charProps = header ? parseCharProps(dec.decode(header)) : {}
  const images: Record<string, ImageInfo> = {}
  for (const [name, data] of files) {
    const m = /^BinData\/([^/]+?)(\.[A-Za-z0-9]+)?$/i.exec(name)
    if (m) images[m[1]] = imageInfo(data)
  }
  const boldOf = (p: SpecPara) => p.runs.some((r) => r.text.trim() && charProps[r.charId]?.bold)
  return { kind: 'hwpx', fileName, paras, items: splitItems(paras, boldOf), charProps, images }
}

/** 파일 → SpecDoc(.hwpx · .md · .txt). .hwp(옛 형식) · PDF 는 안내만 */
export async function parseSpecFile(name: string, bytes: Uint8Array): Promise<SpecDoc> {
  const lower = name.toLowerCase()
  if (lower.endsWith('.hwpx')) return parseHwpx(bytes, name)
  if (lower.endsWith('.hwp')) throw new Error('옛 한글 형식(.hwp)은 읽지 못합니다. 특허로 · 한글에서 .hwpx 로 저장해 올려 주세요.')
  if (lower.endsWith('.pdf')) throw new Error('PDF 는 글자가 깨져 나오는 경우가 많아 점검에 쓰지 않습니다. .hwpx 나 복붙용 .md 를 올려 주세요.')
  return parseSpecText(new TextDecoder('utf-8').decode(bytes), name)
}
