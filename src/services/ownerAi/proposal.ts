/**
 * 제안서 스튜디오 엔진 — AI 는 페이지 구성 · 글만, 글자는 OS 가 실제 글자(SVG text)로 그린다.
 *  - 오타 하나 고칠 때 전체를 다시 만들지 않는다: 페이지 하나만 고치고 다시 그린다(전체 AI 재생성은 따로).
 *  - 내보내기(PDF · PNG) 전에 자동 점검: 빈 페이지 · 넘침 · 잘린 글 · 자리표시자 · 회사명 불일치 · 제목 중복 · 이상한 문자 · 숫자 형식.
 * 글자 너비 재기(measure)는 밖에서 받는다 — 화면은 canvas measureText, 시험은 어림셈.
 */
import { newId, normalizeCompany } from './caseUtil'
import { josa } from '../../lib/josa'

export interface ProposalNumber {
  label: string
  value: string
  basis: string
}

export interface ProposalPage {
  id: string
  title: string
  message: string
  bullets: string[]
  keyNumbers: ProposalNumber[]
  /** 시각 방향(디자이너 · 이미지 자리 메모 — 출력에는 그리지 않는다) */
  visual: string
}

export interface ProposalDoc {
  companyName: string
  purpose: string
  audience: string
  pages: ProposalPage[]
}

type O = Record<string, unknown>
const obj = (v: unknown): O => (v && typeof v === 'object' && !Array.isArray(v) ? (v as O) : {})
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '')

export function emptyPage(): ProposalPage {
  return { id: newId('pg_'), title: '', message: '', bullets: [], keyNumbers: [], visual: '' }
}

/** AI 결과(제안서 구성) 또는 고친 글 → 제안서 */
export function proposalFrom(v: unknown, companyName: string): ProposalDoc {
  const o = obj(v)
  if (Array.isArray(o.pages) && o.pages.length && typeof obj(o.pages[0]).id === 'string' && 'companyName' in o) {
    // 이미 제안서 모양(고친 글)
    return {
      companyName: str(o.companyName) || companyName,
      purpose: str(o.purpose),
      audience: str(o.audience),
      pages: arr(o.pages).map((p) => {
        const x = obj(p)
        return { id: str(x.id) || newId('pg_'), title: str(x.title), message: str(x.message), bullets: arr(x.bullets).map(str).filter(Boolean), keyNumbers: arr(x.keyNumbers).map((k) => ({ label: str(obj(k).label), value: str(obj(k).value), basis: str(obj(k).basis) || '미확인' })).filter((k) => k.label || k.value), visual: str(x.visual) }
      }),
    }
  }
  return {
    companyName,
    purpose: str(o.purpose),
    audience: str(o.audience),
    pages: arr(o.pages).slice(0, 12).map((p) => {
      const x = obj(p)
      return {
        id: newId('pg_'),
        title: str(x.title),
        message: str(x.message),
        bullets: arr(x.bullets).map(str).filter(Boolean).slice(0, 6),
        keyNumbers: arr(x.keyNumbers).map((k) => ({ label: str(obj(k).label), value: str(obj(k).value), basis: str(obj(k).basis) || '미확인' })).filter((k) => k.label || k.value).slice(0, 3),
        visual: str(x.visual),
      }
    }),
  }
}

/* ------------------------------------------------------------------ */
/* 배치 — 1280 × 720 한 장                                              */
/* ------------------------------------------------------------------ */

export const PAGE_W = 1280
export const PAGE_H = 720
const PAD = 72
const INNER = PAGE_W - PAD * 2

export type Measure = (text: string, px: number, weight: number) => number

/** 시험 · 서버용 어림셈 — 한글 · 전각 1em, 나머지 0.56em */
export const roughMeasure: Measure = (text, px) => {
  let w = 0
  for (const ch of text) w += /[ᄀ-ᇿ　-鿿가-힯＀-￯]/.test(ch) ? px : ch === ' ' ? px * 0.3 : px * 0.56
  return w
}

/** 낱말(띄어쓰기) 단위로 줄바꿈 — 한 낱말이 한 줄보다 길면 글자 단위로 나눈다 */
export function wrapText(text: string, px: number, weight: number, maxW: number, measure: Measure): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    const words = para.split(/(\s+)/).filter((w) => w !== '')
    let line = ''
    for (const w of words) {
      const next = line + w
      if (measure(next.trimEnd(), px, weight) <= maxW) {
        line = next
        continue
      }
      if (line.trim()) out.push(line.trimEnd())
      line = w.trimStart()
      while (measure(line, px, weight) > maxW) {
        let cut = line.length
        while (cut > 1 && measure(line.slice(0, cut), px, weight) > maxW) cut -= 1
        out.push(line.slice(0, cut))
        line = line.slice(cut)
      }
    }
    if (line.trim()) out.push(line.trimEnd())
  }
  return out
}

export interface PageLayout {
  title: { lines: string[]; y: number; px: number; lh: number }
  message: { lines: string[]; y: number; px: number; lh: number }
  bullets: { lines: string[]; y: number; first: boolean }[]
  bulletPx: number
  bulletLh: number
  numbers: { label: string; value: string; basis: string; x: number; w: number; y: number }[]
  /** 넘친 곳(빈 배열이면 다 들어감) */
  overflow: string[]
}

export const FONT = { title: { px: 44, w: 800, lh: 56, max: 2 }, message: { px: 26, w: 600, lh: 36, max: 2 }, bullet: { px: 22, w: 400, lh: 32 }, number: { px: 40, w: 800 } }

export function layoutPage(p: ProposalPage, measure: Measure): PageLayout {
  const overflow: string[] = []
  let y = 150
  const titleLines = wrapText(p.title || '', FONT.title.px, FONT.title.w, INNER, measure)
  if (titleLines.length > FONT.title.max) overflow.push('제목')
  const title = { lines: titleLines, y, px: FONT.title.px, lh: FONT.title.lh }
  y += Math.max(1, titleLines.length) * FONT.title.lh + 14
  const msgLines = wrapText(p.message || '', FONT.message.px, FONT.message.w, INNER, measure)
  if (msgLines.length > FONT.message.max) overflow.push('핵심 메시지')
  const message = { lines: msgLines, y, px: FONT.message.px, lh: FONT.message.lh }
  y += (msgLines.length ? msgLines.length * FONT.message.lh : 0) + 30
  const hasNumbers = p.keyNumbers.length > 0
  const bottomLimit = hasNumbers ? PAGE_H - 200 : PAGE_H - 70
  const bullets: PageLayout['bullets'] = []
  let bulletOver = false
  for (const b of p.bullets) {
    const lines = wrapText(b, FONT.bullet.px, FONT.bullet.w, INNER - 36, measure)
    lines.forEach((l, i) => {
      if (y + FONT.bullet.lh > bottomLimit) bulletOver = true
      bullets.push({ lines: [l], y, first: i === 0 })
      y += FONT.bullet.lh
    })
    y += 8
  }
  if (bulletOver) overflow.push('본문')
  const n = Math.min(3, p.keyNumbers.length)
  const gap = 24
  const w = n ? (INNER - gap * (n - 1)) / n : 0
  const numbers = p.keyNumbers.slice(0, 3).map((k, i) => {
    if (measure(k.value, FONT.number.px, FONT.number.w) > w - 40) overflow.push(`핵심 수치 ${i + 1}`)
    return { label: k.label, value: k.value, basis: k.basis, x: PAD + i * (w + gap), w, y: PAGE_H - 170 }
  })
  return { title, message, bullets, bulletPx: FONT.bullet.px, bulletLh: FONT.bullet.lh, numbers, overflow }
}

/* ------------------------------------------------------------------ */
/* 내보내기 전 자동 점검                                                */
/* ------------------------------------------------------------------ */

export type QaKind = 'empty' | 'overflow' | 'placeholder' | 'company' | 'duplicate_title' | 'bad_char' | 'number_format'

export const QA_LABEL: Record<QaKind, string> = {
  empty: '빈 페이지',
  overflow: '넘침 · 잘린 글',
  placeholder: '자리표시자 남음',
  company: '회사명 불일치',
  duplicate_title: '제목 중복',
  bad_char: '이상한 문자',
  number_format: '숫자 표기',
}

export interface QaIssue {
  page: number
  kind: QaKind
  text: string
}

const PLACEHOLDER = /\[(?:회사명|업체명|고객사|이름|대표자|숫자|금액|날짜|연도|[^\]]*입력[^\]]*)\]|O{3,}|○{2,}|X{3,}|\bTODO\b|lorem ipsum|\{\{[^}]*\}\}|<[^>]*(?:입력|회사명)[^>]*>/i
const BAD_CHAR = /[�\u0000-\u0008\u000B\u000C\u000E-\u001F]|Ã.|â€|ï»¿/
const COMPANY_TOKEN = /(?:\(주\)|㈜|주식회사)\s*([가-힣A-Za-z0-9]{2,20})|([가-힣A-Za-z0-9]{2,20})\s*(?:\(주\)|㈜)/g
const RAW_NUMBER = /(?<![\d,.])\d{5,}(?![\d,.])\s*(?:원|명|개|건|시간|분)?/

function pageTexts(p: ProposalPage): string[] {
  return [p.title, p.message, ...p.bullets, ...p.keyNumbers.flatMap((k) => [k.label, k.value])]
}

export function qaProposal(doc: ProposalDoc, measure: Measure): QaIssue[] {
  const out: QaIssue[] = []
  const me = normalizeCompany(doc.companyName)
  const titles = new Map<string, number[]>()
  doc.pages.forEach((p, i) => {
    const no = i + 1
    if (!p.title.trim() || (!p.message.trim() && p.bullets.length === 0 && p.keyNumbers.length === 0)) out.push({ page: no, kind: 'empty', text: !p.title.trim() ? '제목이 비었습니다' : '본문이 비었습니다' })
    const lay = layoutPage(p, measure)
    for (const o of lay.overflow) out.push({ page: no, kind: 'overflow', text: `${josa(o, '이/가')} 칸을 넘칩니다 — 줄이거나 나누세요` })
    const all = pageTexts(p)
    for (const t of all) {
      const ph = PLACEHOLDER.exec(t)
      if (ph) out.push({ page: no, kind: 'placeholder', text: `자리표시자 "${ph[0]}"` })
      if (BAD_CHAR.test(t)) out.push({ page: no, kind: 'bad_char', text: `이상한 문자: "${t.slice(0, 30)}"` })
      const raw = RAW_NUMBER.exec(t)
      if (raw && !/^\d{4}$/.test(raw[0].trim()) && !/^(19|20)\d{2}/.test(raw[0])) out.push({ page: no, kind: 'number_format', text: `"${raw[0].trim()}" — 쉼표(1,000) 나 만 · 억 단위로` })
      for (const m of t.matchAll(COMPANY_TOKEN)) {
        const name = normalizeCompany(m[1] ?? m[2] ?? '')
        if (name && me && name !== me && !me.includes(name) && !name.includes(me) && !/미래ai랩|miraeailab/.test(name)) out.push({ page: no, kind: 'company', text: `다른 회사 이름 "${m[0].trim()}" — 이 제안서는 ${doc.companyName}` })
      }
    }
    const key = p.title.replace(/\s+/g, '')
    if (key) titles.set(key, [...(titles.get(key) ?? []), no])
  })
  for (const [, pages] of titles) if (pages.length > 1) for (const no of pages.slice(1)) out.push({ page: no, kind: 'duplicate_title', text: `제목이 ${pages[0]}쪽과 같습니다` })
  // 같은 쪽 같은 문제는 한 번만
  const seen = new Set<string>()
  return out.filter((q) => {
    const k = `${q.page}|${q.kind}|${q.text}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/** 맞춤법 검사에 보낼 글(위치 표시를 붙여서) — PROOFREAD 스킬 입력 */
export function proofreadInput(doc: ProposalDoc): string {
  return doc.pages
    .flatMap((p, i) => [`p${i + 1} 제목: ${p.title}`, `p${i + 1} 메시지: ${p.message}`, ...p.bullets.map((b, j) => `p${i + 1} 본문${j + 1}: ${b}`)])
    .join('\n')
    .slice(0, 12000)
}

/** 맞춤법 고친 안 하나 적용 — before 조각이 그 자리에 있을 때만(내용이 바뀌었으면 건너뜀) */
export function applyFix(doc: ProposalDoc, fix: { where: string; before: string; after: string }): { doc: ProposalDoc; applied: boolean } {
  const m = /^p(\d+)\s*(제목|메시지|본문(\d+))/.exec(fix.where.trim())
  if (!m || !fix.before) return { doc, applied: false }
  const pi = Number(m[1]) - 1
  const p = doc.pages[pi]
  if (!p) return { doc, applied: false }
  const rep = (s: string) => (s.includes(fix.before) ? s.replace(fix.before, fix.after) : null)
  let next: ProposalPage | null = null
  if (m[2] === '제목') {
    const t = rep(p.title)
    if (t != null) next = { ...p, title: t }
  } else if (m[2] === '메시지') {
    const t = rep(p.message)
    if (t != null) next = { ...p, message: t }
  } else {
    const bi = Number(m[3]) - 1
    const t = p.bullets[bi] != null ? rep(p.bullets[bi]) : null
    if (t != null) next = { ...p, bullets: p.bullets.map((b, j) => (j === bi ? t : b)) }
  }
  if (!next) return { doc, applied: false }
  return { doc: { ...doc, pages: doc.pages.map((x, j) => (j === pi ? next! : x)) }, applied: true }
}
