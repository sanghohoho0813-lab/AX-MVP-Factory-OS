/**
 * D-245 명세서 점검 — Master v2.9 의 12 · 13 · 14장(발명의 명칭 · 식별항목 계층 · 도면 1:1 · 대표도 · 요약 · 청구항 · TIFF)을 코드로.
 *
 * AI 를 쓰지 않는다(규칙 계산). 특허 등록 가능성 · 권리범위는 판단하지 않는다 — 형식 · 서로 맞는지만.
 * 최종 PASS 는 특허로 편집기 오류검사 0건 + 최종 미리보기다(Master 12-4K). 이 점검은 그 전에 걸러 주는 것.
 *
 *   error  고쳐야 함 — 편집기 오류가 나거나 본문끼리 어긋남
 *   warn   주의 — Master 규칙과 다름(편집기에서 막히는지는 편집기 판단)
 *   info   참고
 */
import { charPropFlags, ROLE_LABEL, type Role, type SpecDoc, type SpecItem, type SpecPara } from './specParse'
import { COMPRESSION_NAME, dpiOf } from './tiffInfo'

export type Level = 'error' | 'warn' | 'info'

export interface Where {
  paraIdx?: number
  label: string
}

export interface Finding {
  id: string
  level: Level
  title: string
  detail: string
  fix: string
  /** 특허로 편집기 오류 코드(있으면) */
  code?: string
  where: Where[]
}

export interface SpecSummary {
  title: string
  titleEn: string
  claims: number
  independent: number
  dependent: number
  figs: number[]
  drawingDesc: number[]
  repFig: string
  paraNumbers: number
  abstractChars: number
  images: number
  blankParas: number
}

export interface SpecReport {
  summary: SpecSummary
  findings: Finding[]
  counts: Record<Level, number>
  /** 고쳐야 할 것(error)이 없다 — 편집기 PASS 를 뜻하지는 않는다 */
  clean: boolean
}

const blank = (p: SpecPara) => !p.text.trim() && p.images.length === 0 && !p.table
const textOf = (it: SpecItem | undefined) => (it ? it.content.filter((p) => !blank(p)).map((p) => p.text.trim()).join('\n') : '')
const clip = (s: string, n = 40) => {
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length > n ? `${t.slice(0, n)}…` : t
}
/** 끝 글자에 맞춘 '이/가' — 한글 받침 · 숫자 읽는 소리(2·4·5·9 → 가) · 따옴표 · 괄호는 건너뛰고 본다 */
export function iGa(word: string): string {
  const ch = word.replace(/['"’”)\]\s]+$/u, '').slice(-1)
  if (/[0-9]/.test(ch)) return '2459'.includes(ch) ? '가' : '이'
  const code = ch.charCodeAt(0) - 0xac00
  if (code >= 0 && code < 11172) return code % 28 === 0 ? '가' : '이'
  return '이(가)'
}
const withIGa = (word: string) => `${word}${iGa(word)}`

const itemLabel = (it: SpecItem) => (it.role === 'claim' ? `청구항 ${it.num}` : it.role === 'fig' ? `도 ${it.num}` : it.name)

/** 문단 번호(【0001】 · [0001]) — 앞에서 떼어 낸 글과 번호 */
export function paraNumberOf(text: string): { num: number; rest: string } | null {
  const m = /^\s*[【[]\s*(\d{4,5})\s*[】\]]\s*/.exec(text)
  return m ? { num: Number(m[1]), rest: text.slice(m[0].length) } : null
}

const CANON: Role[] = ['desc', 'title', 'field', 'background', 'priorArt', 'patentLit', 'nonPatentLit', 'content', 'problem', 'solution', 'effect', 'drawingDesc', 'detail', 'signs', 'industrial', 'claimsHead', 'claim', 'abstractHead', 'abstract', 'repFig', 'figsHead', 'fig']
const ONCE: Role[] = ['desc', 'title', 'field', 'background', 'priorArt', 'content', 'problem', 'solution', 'effect', 'drawingDesc', 'detail', 'signs', 'industrial', 'claimsHead', 'abstractHead', 'abstract', 'repFig', 'figsHead']
const DESC_ROLES: Role[] = ['field', 'background', 'priorArt', 'patentLit', 'nonPatentLit', 'content', 'problem', 'solution', 'effect', 'drawingDesc', 'detail', 'industrial']
const PARENT_OF: Partial<Record<Role, Role[]>> = {
  desc: ['title'],
  content: ['problem', 'solution', 'effect'],
  claimsHead: ['claim'],
  abstractHead: ['abstract', 'repFig'],
  figsHead: ['fig'],
  priorArt: ['patentLit', 'nonPatentLit'],
}

/** Master 12-4F · 2.4 Hygiene — 제출본에 남으면 안 되는 내부 작업 문구 */
export const INTERNAL_PHRASES = ['/Devil', 'Judge', '이번 검토', '이번 특허에서 가장 중요한', '강화 포인트', 'AI 코멘트', '내부 메모', '초안 메모', '작업용', '[확인 필요]', '[자료 요청]', 'TODO', 'TBD']

const PARTICLE = /(으로부터|에서부터|으로서|으로써|에게서|로부터|에서|에게|까지|부터|으로|하는|되는|하여|된|한|의|을|를|은|는|이|가|에|와|과|로|도|만|및)$/

/** 도 번호 모음(범위 '도 1 내지 도 3' 펼침) — '온도 5' 같은 낱말 속 '도' 는 빼고 */
export function figRefs(text: string): number[] {
  const out = new Set<number>()
  for (const m of text.matchAll(/(?<![가-힣A-Za-z])도\s*(\d{1,3})\s*(?:내지|~|부터|-)\s*(?:도\s*)?(\d{1,3})/g)) {
    const a = Number(m[1])
    const b = Number(m[2])
    if (b > a && b - a < 40) for (let k = a; k <= b; k++) out.add(k)
  }
  for (const m of text.matchAll(/(?<![가-힣A-Za-z])도\s*(\d{1,3})(?!\d)/g)) out.add(Number(m[1]))
  return [...out].sort((a, b) => a - b)
}

/** 청구항이 인용한 앞 청구항 번호 — '…에 있어서' 앞 부분에서 */
export function claimRefs(text: string): number[] {
  const head = text.split(/있어서/)[0]
  if (head.length > 260 || head === text) return []
  const out = new Set<number>()
  for (const m of head.matchAll(/(?:청구항\s*(\d{1,3})(?:\s*(?:내지|~|부터)\s*(?:청구항\s*)?(\d{1,3}))?|제\s*(\d{1,3})\s*항)/g)) {
    const a = Number(m[1] ?? m[3])
    const b = m[2] ? Number(m[2]) : NaN
    if (Number.isFinite(b) && b > a && b - a < 60) for (let k = a; k <= b; k++) out.add(k)
    else out.add(a)
  }
  return [...out].sort((a, b) => a - b)
}

export function checkSpec(doc: SpecDoc): SpecReport {
  const findings: Finding[] = []
  const add = (f: Omit<Finding, 'where'> & { where?: Where[] }) => findings.push({ where: [], ...f })
  const items = doc.items.filter((i) => i.role !== 'other')
  const byRole = (r: Role) => items.filter((i) => i.role === r)
  const one = (r: Role) => byRole(r)[0]
  const isHwpx = doc.kind === 'hwpx'
  const itemAt = (paraIdx: number) => {
    let hit: SpecItem | undefined
    for (const it of doc.items) if (it.paraIdx <= paraIdx) hit = it
    return hit
  }
  const whereOf = (paraIdx: number, extra = ''): Where => {
    const it = itemAt(paraIdx)
    return { paraIdx, label: `${it ? itemLabel(it) : '맨 앞'}${extra ? ` — ${extra}` : ''}` }
  }

  /* ---------------- 구조: 빠진 식별항목 · 순서 · 계층 ---------------- */

  const claims = byRole('claim')
  const figs = byRole('fig')
  const need: Role[] = ['title', 'field', 'background', 'content', 'problem', 'solution', 'effect', 'detail', 'claimsHead', 'abstractHead', 'abstract']
  if (figs.length > 0) need.push('drawingDesc', 'repFig', 'figsHead')
  const missing = need.filter((r) => byRole(r).length === 0)
  if (claims.length === 0) missing.push('claim')
  if (missing.length > 0) {
    add({
      id: 'STRUCT_MISSING',
      level: 'error',
      code: 'E-245',
      title: `필수 식별항목이 빠졌습니다(${missing.length}개)`,
      detail: `없는 것: ${missing.map((r) => ROLE_LABEL[r]).join(' · ')}`,
      fix: '본문에 제목 글을 치지 말고, 특허로 편집기 [서식목록 삽입]으로 정식 식별항목을 만든 뒤 그 아래에 내용을 넣으세요.',
    })
  }

  for (const r of ONCE) {
    const list = byRole(r)
    if (list.length > 1) {
      add({
        id: 'STRUCT_DUP',
        level: 'error',
        code: 'E-244',
        title: `'${ROLE_LABEL[r]}' 식별항목이 ${list.length}번 있습니다`,
        detail: '같은 식별항목은 한 번만 있어야 합니다.',
        fix: '하나만 남기고 나머지 내용은 남긴 식별항목 아래로 옮기세요.',
        where: list.map((i) => whereOf(i.paraIdx)),
      })
    }
  }

  // 순서(E-244) — 정해진 차례에서 뒤로 돌아간 곳
  let maxIdx = -1
  let prevRole: Role | null = null
  const disorder: Where[] = []
  for (const it of items) {
    const k = CANON.indexOf(it.role)
    if (k < 0) continue
    if (k < maxIdx && !(it.role === prevRole && (it.role === 'claim' || it.role === 'fig'))) disorder.push(whereOf(it.paraIdx, `${withIGa(`'${ROLE_LABEL[it.role]}'`)} 앞 항목보다 뒤에 와야 하는 자리`))
    maxIdx = Math.max(maxIdx, k)
    prevRole = it.role
  }
  if (disorder.length > 0) {
    add({
      id: 'STRUCT_ORDER',
      level: 'error',
      code: 'E-244',
      title: '식별항목 순서가 정해진 차례와 다릅니다',
      detail: '차례: 발명의 명칭 → 기술분야 → 배경기술 → 발명의 내용(과제 · 해결 수단 · 효과) → 도면의 간단한 설명 → 구체적인 내용 → 부호의 설명 → 청구범위 → 요약서(요약 · 대표도) → 도면',
      fix: '편집기 왼쪽 트리에서 위치를 옮기거나, 잘못 만든 항목을 지우고 제자리에 다시 만드세요(글을 먼저 다른 곳에 복사해 두기).',
      where: disorder.slice(0, 6),
    })
  }

  // 상위 · 하위 사이 본문(E-249)
  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    const kids = PARENT_OF[it.role]
    if (!kids) continue
    const body = it.content.filter((p) => !blank(p))
    const next = items[i + 1]
    if (body.length > 0 && next && kids.includes(next.role)) {
      add({
        id: 'STRUCT_PARENT_TEXT',
        level: 'error',
        code: 'E-249',
        title: `'${it.name}' 와 '${next.name}' 사이에 본문이 있습니다`,
        detail: `상위 식별항목 바로 아래에는 하위 식별항목이 와야 합니다. 걸린 글: "${clip(body[0].text)}"`,
        fix: '글을 지우지 말고, 그 글이 들어가야 할 하위 식별항목(예: 해결하려는 과제 · 요약) 아래로 옮기세요.',
        where: [whereOf(body[0].idx)],
      })
    } else if (isHwpx && body.length === 0 && it.content.length > 0 && next && kids.includes(next.role)) {
      add({
        id: 'STRUCT_PARENT_BLANK',
        level: 'warn',
        title: `'${it.name}' 와 '${next.name}' 사이에 빈 문단이 있습니다`,
        detail: `빈 문단 ${it.content.length}개. 편집기에 따라 계층 오류로 잡힐 수 있습니다.`,
        fix: '빈 문단을 지워 상위 · 하위 식별항목이 바로 이어지게 하세요.',
        where: [whereOf(it.paraIdx)],
      })
    }
  }

  // 직접 친 식별항목([청구항 2] 처럼 대괄호) · 굵은 식별항목
  const square = doc.items.filter((i) => i.style === 'square')
  if (square.length > 0) {
    add({
      id: 'STRUCT_SQUARE',
      level: 'error',
      code: 'E-201',
      title: `식별항목 ${square.length}개가 【 】 가 아니라 [ ] 로 직접 친 글입니다`,
      detail: `예: ${square.slice(0, 4).map((i) => `[${i.name}]`).join(' · ')}. 편집기가 정식 식별항목으로 알아보지 못해 빠진 항목(E-245) · 허용 안 된 항목(E-201)으로 잡힐 수 있습니다.`,
      fix: '직접 친 줄을 지우고 [서식목록 삽입]으로 같은 식별항목을 만든 뒤 내용을 그 아래로 옮기세요.',
      where: square.slice(0, 8).map((i) => whereOf(i.paraIdx)),
    })
  }
  const boldIdent = isHwpx ? doc.items.filter((i) => i.bold) : []
  if (boldIdent.length > 0) {
    add({
      id: 'STRUCT_BOLD',
      level: 'warn',
      code: 'E-261',
      title: `식별항목 ${boldIdent.length}개에 굵게 서식이 있습니다`,
      detail: `예: ${boldIdent.slice(0, 4).map(itemLabel).join(' · ')}. 식별항목 · 발명의 명칭 · 대표도에는 글자 속성을 쓰지 않습니다(Master 12-3D).`,
      fix: '해당 줄을 지우고 편집기에서 새로 만들거나, 글자 속성을 모두 해제하세요.',
      where: boldIdent.slice(0, 8).map((i) => whereOf(i.paraIdx)),
    })
  }

  /* ---------------- 발명의 명칭(E-261 · E-262 · E-266 · E-267 · E-268) ---------------- */

  const titleItem = one('title')
  let titleKo = ''
  let titleEn = ''
  if (titleItem) {
    const paras = titleItem.content.filter((p) => !blank(p))
    if (paras.length === 0) {
      add({ id: 'TITLE_EMPTY', level: 'error', title: '발명의 명칭이 비었습니다', detail: '', fix: '한글명칭{ENGLISH TITLE} 을 한 문단으로 넣으세요.', where: [whereOf(titleItem.paraIdx)] })
    } else {
      if (paras.length > 1 || paras[0].text.includes('\n')) {
        add({
          id: 'TITLE_PARAS',
          level: 'error',
          code: 'E-262',
          title: '발명의 명칭이 두 문단 이상입니다',
          detail: `문단 ${paras.length}개. 한글명칭과 {영문명칭}은 같은 한 문단이어야 합니다.`,
          fix: '내용을 지우고 새 평문 문단 하나에 "한글명칭{ENGLISH TITLE}" 로 다시 넣으세요.',
          where: paras.map((p) => whereOf(p.idx)),
        })
      }
      const t = paras.map((p) => p.text).join('').replace(/\n/g, ' ').trim()
      if (/영문\s*(명칭|명)|English\s*Title/i.test(t)) {
        add({ id: 'TITLE_LABEL', level: 'error', title: "발명의 명칭에 '영문명:' 같은 이름표가 있습니다", detail: clip(t, 80), fix: '이름표를 지우고 한글명칭{ENGLISH TITLE} 모양만 남기세요.', where: [whereOf(paras[0].idx)] })
      }
      const m = /^([^{}]+?)(\s*)\{([^{}]*)\}(.*)$/s.exec(t)
      if (!m) {
        add({
          id: 'TITLE_BRACE',
          level: 'error',
          code: 'E-266',
          title: '한글명칭 오른쪽에 {영문명칭} 이 없습니다',
          detail: clip(t, 80),
          fix: '한글명칭 바로 뒤에 {ENGLISH TITLE} 을 붙이세요(같은 문단).',
          where: [whereOf(paras[0].idx)],
        })
        titleKo = t
      } else {
        titleKo = m[1].trim()
        titleEn = m[3].trim()
        if (m[4].trim()) {
          add({ id: 'TITLE_AFTER', level: 'error', code: 'E-268', title: '닫는 } 뒤에 글이 있습니다', detail: `"${clip(m[4], 40)}"`, fix: '} 뒤의 글을 지우세요. 영문명칭이 제목의 마지막이어야 합니다.', where: [whereOf(paras[0].idx)] })
        }
        if (/[가-힣ㄱ-ㅎ]/.test(m[3]) || !titleEn) {
          add({ id: 'TITLE_INNER', level: 'error', code: 'E-267', title: titleEn ? '{ } 안에 한글이 있습니다' : '{ } 안이 비었습니다', detail: `{${clip(m[3], 60)}}`, fix: '중괄호 안에는 영문명칭만 넣으세요.', where: [whereOf(paras[0].idx)] })
        } else if (/[^A-Za-z0-9 ,.\-'()&/;:+]/.test(m[3])) {
          const bad = [...new Set(m[3].replace(/[A-Za-z0-9 ,.\-'()&/;:+]/g, '').split(''))].join(' ')
          add({ id: 'TITLE_INNER_CHAR', level: 'warn', code: 'E-267', title: '{ } 안에 영문명칭에 잘 쓰지 않는 글자가 있습니다', detail: `글자: ${bad}`, fix: '영문 · 숫자 · 쉼표 · 하이픈 정도만 남기세요.', where: [whereOf(paras[0].idx)] })
        }
        if (m[2]) {
          add({ id: 'TITLE_SPACE', level: 'info', title: '한글명칭과 { 사이에 띄어쓰기가 있습니다', detail: 'Master 예시는 붙여 씁니다: 한글명칭{ENGLISH TITLE}. 편집기가 허용하는지는 편집기 오류검사로 확인하세요.', fix: '{ 앞의 띄어쓰기를 지우면 Master 모양과 같아집니다.', where: [whereOf(paras[0].idx)] })
        }
      }
      if (isHwpx) {
        const flags = new Set<string>()
        for (const p of paras) for (const r of p.runs) if (r.text.trim()) for (const f of charPropFlags(doc.charProps[r.charId])) flags.add(f)
        if (flags.size > 0) {
          add({ id: 'TITLE_FORMAT', level: 'error', code: 'E-261', title: '발명의 명칭에 글자 속성이 있습니다', detail: `속성: ${[...flags].join(' · ')}`, fix: '명칭을 지우고 새 평문 문단에서 모든 글자 속성을 해제한 뒤 다시 넣으세요.', where: [whereOf(paras[0].idx)] })
        }
      }
    }
  }

  /* ---------------- 문단 번호 ---------------- */

  const numbered: Array<{ num: number; idx: number }> = []
  const unnumbered: SpecPara[] = []
  for (const it of items) {
    if (!DESC_ROLES.includes(it.role)) continue
    for (const p of it.content) {
      if (blank(p) || p.images.length > 0 || p.table) continue
      const n = paraNumberOf(p.text)
      if (n) numbered.push({ num: n.num, idx: p.idx })
      else unnumbered.push(p)
    }
  }
  if (numbered.length >= 3) {
    const gaps: Where[] = []
    const dups: Where[] = []
    for (let i = 1; i < numbered.length; i++) {
      const a = numbered[i - 1].num
      const b = numbered[i].num
      if (b === a) dups.push(whereOf(numbered[i].idx, `[${String(b).padStart(4, '0')}] 두 번`))
      else if (b < a) dups.push(whereOf(numbered[i].idx, `[${String(b).padStart(4, '0')}] 이 앞 번호보다 작음`))
      else if (b !== a + 1) gaps.push(whereOf(numbered[i].idx, `[${String(a).padStart(4, '0')}] 다음이 [${String(b).padStart(4, '0')}] — ${b - a - 1}개 빠짐`))
    }
    if (gaps.length > 0) {
      add({ id: 'PARA_GAP', level: 'error', title: `문단 번호가 ${gaps.length}곳에서 건너뜁니다`, detail: '번호만 빠졌는지, 그 자리의 글(문단)이 통째로 빠졌는지 먼저 확인하세요(Master 12-4F).', fix: '원본 초안과 대조해 빠진 문단을 되살린 뒤 번호를 다시 매기세요.', where: gaps.slice(0, 8) })
    }
    if (dups.length > 0) {
      add({ id: 'PARA_DUP', level: 'error', title: `문단 번호가 겹치거나 거꾸로 된 곳이 ${dups.length}곳 있습니다`, detail: '', fix: '번호를 차례대로 다시 매기세요.', where: dups.slice(0, 8) })
    }
    if (unnumbered.length > 0) {
      add({
        id: 'PARA_MIXED',
        level: 'info',
        title: `번호 없는 문단이 ${unnumbered.length}개 섞여 있습니다`,
        detail: `예: ${unnumbered.slice(0, 3).map((p) => `"${clip(p.text, 24)}"`).join(' · ')}. 소제목이라면 괜찮지만, 본문이면 번호를 붙이세요.`,
        fix: '소제목은 그대로 두고, 본문 문단에만 번호를 이어 매기세요.',
        where: unnumbered.slice(0, 6).map((p) => whereOf(p.idx)),
      })
    }
  }

  /* ---------------- 청구항 ---------------- */

  let independent = 0
  let dependent = 0
  if (claims.length > 0) {
    const nums = claims.map((c) => c.num ?? 0)
    const seen = new Set<number>()
    const numIssues: Where[] = []
    nums.forEach((n, i) => {
      if (seen.has(n)) numIssues.push(whereOf(claims[i].paraIdx, `청구항 ${n} 두 번`))
      else if (n !== i + 1) numIssues.push(whereOf(claims[i].paraIdx, `${i + 1}번째 청구항 번호가 ${n}`))
      seen.add(n)
    })
    if (numIssues.length > 0) {
      add({ id: 'CLAIM_NUM', level: 'error', title: '청구항 번호가 1부터 차례대로가 아닙니다', detail: `지금 순서: ${nums.join(', ')}`, fix: '청구항 번호를 1, 2, 3 … 차례로 맞추고 인용 번호도 함께 고치세요.', where: numIssues.slice(0, 8) })
    }
    const textByNum = new Map<number, string>()
    const refsByNum = new Map<number, number[]>()
    const badRefs: Where[] = []
    const labels: Where[] = []
    for (const c of claims) {
      const t = textOf(c)
      const n = c.num ?? 0
      textByNum.set(n, t)
      if (!t) {
        add({ id: 'CLAIM_EMPTY', level: 'error', title: `청구항 ${n} 이 비었습니다`, detail: '', fix: '내용을 넣거나 청구항을 지우고 번호를 다시 매기세요.', where: [whereOf(c.paraIdx)] })
        continue
      }
      const refs = claimRefs(t)
      refsByNum.set(n, refs)
      if (refs.length === 0) independent += 1
      else dependent += 1
      for (const r of refs) {
        if (r >= n) badRefs.push(whereOf(c.paraIdx, `청구항 ${n} 이 뒤(같은) 번호 청구항 ${r} 을 인용`))
        else if (!nums.includes(r)) badRefs.push(whereOf(c.paraIdx, `청구항 ${n} 이 없는 청구항 ${r} 을 인용`))
      }
      if (/(시스템|방법|장치)\s*독립항|핵심\s*청구항|종속항\s*[:：]|independent\s+claim/i.test(t)) labels.push(whereOf(c.paraIdx, `청구항 ${n}`))
    }
    if (badRefs.length > 0) {
      add({ id: 'CLAIM_REF', level: 'error', title: `청구항 인용이 잘못된 곳이 ${badRefs.length}곳 있습니다`, detail: '종속항은 앞에 있는(번호가 작은) 청구항만 인용할 수 있습니다.', fix: '인용 번호를 실제로 있는 앞 청구항으로 고치세요.', where: badRefs.slice(0, 8) })
    }
    if (labels.length > 0) {
      add({ id: 'CLAIM_LABEL', level: 'error', title: "청구항 안에 '독립항 · 핵심 청구항' 같은 설명 이름표가 있습니다", detail: '제출본 청구항에는 설명 이름표를 넣지 않습니다(Master 14-2A).', fix: '이름표를 지우세요.', where: labels })
    }
    const indepTexts = [...refsByNum.entries()].filter(([, r]) => r.length === 0).map(([n]) => textByNum.get(n) ?? '')
    const hasMethod = indepTexts.some((t) => /방법\s*\.?\s*$/.test(t.trim()))
    const hasSystem = indepTexts.some((t) => /(시스템|장치)\s*\.?\s*$/.test(t.trim()))
    if (hasSystem && !hasMethod) {
      add({ id: 'CLAIM_METHOD', level: 'info', title: '방법 독립항이 없습니다', detail: '소프트웨어 특허는 보통 시스템 독립항 + 종속항 + 방법 독립항으로 짭니다(Master 12-4F).', fix: '필요하면 시스템 독립항과 처리관계가 대응하는 방법 독립항을 더하세요.' })
    }
    // '상기 ○○' 가 앞(같은 청구항 앞부분 · 인용한 청구항)에 나온 말인지
    const ancestry = (n: number, depth = 0): string => {
      if (depth > 10) return ''
      return (refsByNum.get(n) ?? []).map((r) => (textByNum.get(r) ?? '') + ancestry(r, depth + 1)).join('\n')
    }
    const orphan: Where[] = []
    for (const c of claims) {
      const n = c.num ?? 0
      const t = textByNum.get(n) ?? ''
      const before = ancestry(n)
      for (const m of t.matchAll(/상기\s+([가-힣A-Za-z0-9·]+)/g)) {
        // 조사는 한 번만 뗀다('측정결과를' → '측정결과' · '결과' 의 '과' 까지 떼지 않게)
        const raw = m[1]
        const term = raw.replace(PARTICLE, '')
        if (term.length < 2) continue
        const earlier = before + t.slice(0, m.index ?? 0)
        if (!earlier.includes(term) && !earlier.includes(raw)) orphan.push(whereOf(c.paraIdx, `청구항 ${n}: '상기 ${term}'`))
      }
    }
    if (orphan.length > 0) {
      add({ id: 'CLAIM_ANTECEDENT', level: 'info', title: `'상기 ○○' 가 앞에 나오지 않은 말을 가리키는 곳이 ${orphan.length}곳 있을 수 있습니다`, detail: '글자 맞추기로 찾은 것이라 틀릴 수 있습니다 — 하나씩 눈으로 확인하세요.', fix: "앞에서 먼저 소개(예: '…하는 ○○부')한 뒤 '상기 ○○' 로 가리키세요.", where: orphan.slice(0, 8) })
    }
  }

  /* ---------------- 도면 · 도면의 간단한 설명 · 대표도 ---------------- */

  const figNums = figs.map((f) => f.num ?? 0)
  const descItem = one('drawingDesc')
  const descNums = descItem ? figRefs(textOf(descItem)) : []
  const bodyNums = figRefs([one('detail'), one('solution'), one('effect')].map(textOf).join('\n'))
  if (figs.length > 0) {
    const want = figNums.map((_, i) => i + 1)
    if (figNums.join(',') !== want.join(',')) {
      add({ id: 'FIG_SEQ', level: 'warn', title: '도면 번호가 1부터 차례대로가 아닙니다', detail: `지금: 도 ${figNums.join(', 도 ')}`, fix: '도 1, 도 2 … 차례로 맞추세요.', where: figs.map((f) => whereOf(f.paraIdx)) })
    }
    if (descItem) {
      const noDesc = figNums.filter((n) => !descNums.includes(n))
      const noFig = descNums.filter((n) => !figNums.includes(n))
      if (noDesc.length > 0) {
        add({
          id: 'FIG_DESC_MISSING',
          level: 'error',
          title: `도면은 ${figNums.length}장인데 '도면의 간단한 설명'에 도 ${noDesc.join(', 도 ')} 설명이 없습니다`,
          detail: `설명에 있는 것: ${descNums.length ? `도 ${descNums.join(', 도 ')}` : '없음'}. 도면의 간단한 설명과 실제 도면은 1:1 이어야 합니다(Master 12-3B).`,
          fix: `'도면의 간단한 설명'에 "도 ${noDesc[0]}는 …를 나타내는 도면이다." 문단을 더하세요(문단 번호를 쓰면 번호도 이어서).`,
          where: [whereOf(descItem.paraIdx)],
        })
      }
      if (noFig.length > 0) {
        add({ id: 'FIG_DESC_EXTRA', level: 'error', title: `'도면의 간단한 설명'에 있는 ${withIGa(`도 ${noFig.join(', 도 ')}`)} 실제 도면에 없습니다`, detail: `실제 도면: 도 ${figNums.join(', 도 ')}`, fix: '도면을 압축했다면 설명도 같이 줄이고, 아니면 빠진 도면을 넣으세요.', where: [whereOf(descItem.paraIdx)] })
      }
    }
    const ghost = bodyNums.filter((n) => !figNums.includes(n))
    if (ghost.length > 0) {
      add({ id: 'FIG_BODY_REF', level: 'error', title: `본문이 없는 도면 도 ${ghost.join(', 도 ')} 을(를) 가리킵니다`, detail: `실제 도면: 도 ${figNums.join(', 도 ')}`, fix: '본문의 도 번호를 실제 도면 번호로 고치세요.' })
    }
  } else if (descNums.length > 0 && !isHwpx) {
    add({ id: 'FIG_NOT_CHECKED', level: 'info', title: '도면 칸이 없어 도면 수와 대조하지 못했습니다', detail: `도면의 간단한 설명: 도 ${descNums.join(', 도 ')}`, fix: '.hwpx 로 올리면 실제 도면 · 그림 규격까지 대조합니다.' })
  }

  const rep = one('repFig')
  let repText = ''
  if (rep) {
    const paras = rep.content.filter((p) => !blank(p))
    repText = paras.map((p) => p.text.trim()).filter(Boolean).join(' ')
    const imgs = paras.reduce((s, p) => s + p.images.length, 0)
    if (repText && imgs > 0) {
      add({ id: 'REP_MIX', level: 'error', code: 'E-242', title: '대표도에 글과 그림이 함께 있습니다', detail: `글: "${clip(repText, 20)}" · 그림 ${imgs}개`, fix: "대표도에는 '도 1' 같은 평문 한 줄만(또는 그림 1개만) 두세요.", where: [whereOf(rep.paraIdx)] })
    } else if (!repText && imgs === 0) {
      add({ id: 'REP_EMPTY', level: 'error', code: 'E-242', title: '대표도가 비었습니다', detail: '', fix: "대표도에 실제 있는 도 번호를 '도 1' 처럼 평문으로 넣으세요.", where: [whereOf(rep.paraIdx)] })
    } else if (repText) {
      const ok = /^도\s(\d{1,3})$/.exec(repText)
      const noSpace = /^도(\d{1,3})$/.exec(repText)
      const old = /^제\s*(\d{1,3})\s*도$/.exec(repText)
      const n = Number((ok ?? noSpace ?? old)?.[1] ?? NaN)
      if (!ok && !noSpace && !old) {
        add({ id: 'REP_FORMAT', level: 'error', code: 'E-242', title: "대표도에는 '도 n' 한 줄만 들어가야 합니다", detail: `지금: "${clip(repText, 30)}"`, fix: "'도 1' 처럼 평문 한 줄만 남기세요.", where: [whereOf(rep.paraIdx)] })
      } else {
        if (!ok) add({ id: 'REP_SPACE', level: 'warn', title: `대표도 표기가 '${repText}' 입니다`, detail: "Master 기본값은 '도'와 숫자 사이 한 칸: '도 1'.", fix: `'도 ${n}' 으로 고치세요.`, where: [whereOf(rep.paraIdx)] })
        if (figs.length > 0 && !figNums.includes(n)) {
          add({ id: 'REP_MISSING_FIG', level: 'error', code: 'E-250', title: `대표도로 지정한 ${withIGa(`도 ${n}`)} 실제 도면에 없습니다`, detail: `실제 도면: 도 ${figNums.join(', 도 ')}`, fix: '실제 있는 도면 번호로 바꾸거나, 그 도면을 먼저 넣으세요.', where: [whereOf(rep.paraIdx)] })
        } else if (descItem && !descNums.includes(n)) {
          add({ id: 'REP_NO_DESC', level: 'error', title: `대표도 ${withIGa(`도 ${n}`)} '도면의 간단한 설명'에 없습니다`, detail: '대표도로 고른 도면은 설명에도 있어야 합니다.', fix: `'도면의 간단한 설명'에 도 ${n} 설명을 더하세요.`, where: [whereOf(rep.paraIdx)] })
        }
      }
      if (isHwpx) {
        const flags = new Set<string>()
        for (const p of paras) for (const r of p.runs) if (r.text.trim()) for (const f of charPropFlags(doc.charProps[r.charId])) flags.add(f)
        if (flags.size > 0) add({ id: 'REP_STYLE', level: 'error', code: 'E-261', title: '대표도 글에 글자 속성이 있습니다', detail: [...flags].join(' · '), fix: "지우고 평문 '도 n' 으로 다시 넣으세요(굵게 금지).", where: [whereOf(rep.paraIdx)] })
      }
    }
  }

  // 도 n 아래 그림(HWPX) — 바로 그림 1개(S-010 · E-240 · E-298)
  let imageCount = 0
  if (isHwpx) {
    const blankBefore: Where[] = []
    const noImage: Where[] = []
    const extra: Where[] = []
    for (const f of figs) {
      const firstImg = f.content.findIndex((p) => p.images.length > 0)
      const imgs = f.content.reduce((s, p) => s + p.images.length, 0)
      imageCount += imgs
      if (imgs === 0) noImage.push(whereOf(f.paraIdx))
      else {
        if (f.content.slice(0, firstImg).some(blank)) blankBefore.push(whereOf(f.paraIdx))
        const textual = f.content.filter((p) => p.text.trim())
        if (imgs > 1 || textual.length > 0) extra.push(whereOf(f.paraIdx, imgs > 1 ? `그림 ${imgs}개` : `글 "${clip(textual[0].text, 16)}"`))
      }
    }
    if (noImage.length > 0) add({ id: 'FIG_NO_IMAGE', level: 'error', code: 'E-240', title: `그림이 없는 도면이 ${noImage.length}개 있습니다`, detail: '', fix: "'도 n' 바로 다음 줄에 이미지 삽입으로 그림 1개를 넣으세요.", where: noImage })
    if (blankBefore.length > 0) add({ id: 'FIG_BLANK', level: 'error', code: 'S-010', title: `'도 n' 과 그림 사이에 빈 문단이 있는 도면이 ${blankBefore.length}개 있습니다`, detail: '', fix: '빈 문단을 지워 그림이 도 번호 바로 다음에 오게 하세요.', where: blankBefore })
    if (extra.length > 0) add({ id: 'FIG_EXTRA', level: 'error', code: 'E-240', title: `그림 1개 말고 다른 것이 든 도면이 ${extra.length}개 있습니다`, detail: '도 n 아래에는 그림 1개만 둡니다(파일 이름 · 설명 글 · 두 번째 그림 금지).', fix: '그림 하나만 남기고 나머지를 지우세요.', where: extra })

    // 그림 규격(Master v2.4 · MOIP 흑백 도면)
    const groups: Record<string, number[]> = {}
    const push = (k: string, n: number) => (groups[k] ??= []).push(n)
    for (const f of figs) {
      const ref = f.content.flatMap((p) => p.images)[0]
      const info = ref ? doc.images[ref] : undefined
      const n = f.num ?? 0
      if (!info) continue
      if (info.format !== 'tiff') {
        push(`fmt:${info.format}`, n)
        continue
      }
      if (info.compression !== 4) push(`comp:${info.compression ?? '?'}`, n)
      if ((info.strips ?? 1) > 1) push(`strip:${info.strips}`, n)
      const dpi = dpiOf(info)
      if (dpi !== 300 && dpi !== 400) push(`dpi:${dpi ?? '?'}`, n)
      if ((info.bitsPerSample ?? 1) !== 1) push(`bits:${info.bitsPerSample}`, n)
      if (info.byteOrder === 'MM') push('order', n)
      const w = info.widthMm ?? 0
      const h = info.heightMm ?? 0
      if (Math.max(w, h) > 255 || Math.min(w, h) > 170) push(`size:${w}x${h}`, n)
    }
    const figList = (ns: number[]) => `도 ${ns.join(', 도 ')}`
    for (const [k, ns] of Object.entries(groups)) {
      const [kind, val] = k.split(':')
      if (kind === 'fmt') add({ id: 'TIFF_FORMAT', level: 'warn', title: `${figList(ns)} 그림이 TIFF 가 아닙니다(${val})`, detail: '특허로 흑백 도면 기본 규격은 TIFF 입니다.', fix: 'TIFF(흑백 · 300dpi · CCITT G4 · 한 줄)로 바꿔 다시 넣으세요.' })
      if (kind === 'comp') add({ id: 'TIFF_COMPRESSION', level: 'warn', title: `${figList(ns)} TIFF 압축이 ${COMPRESSION_NAME[Number(val)] ?? val} 입니다`, detail: 'Master v2.4 · MOIP 흑백 도면 기준은 CCITT Group 4 입니다(v2.3 의 LZW 규칙은 폐기).', fix: 'CCITT G4 로 다시 저장하세요. 이미 편집기에서 통과했다면 편집기 판단이 우선입니다.' })
      if (kind === 'strip') add({ id: 'TIFF_STRIPS', level: 'warn', title: `${figList(ns)} TIFF 가 ${val}줄(strip)로 나뉘어 있습니다`, detail: 'Master v2.4 기준은 한 줄(single strip)입니다.', fix: '한 줄(single strip)로 다시 저장하세요. 편집기가 받아 주면 편집기 판단이 우선입니다.' })
      if (kind === 'dpi') add({ id: 'TIFF_DPI', level: 'warn', title: `${figList(ns)} 해상도가 ${val}dpi 입니다`, detail: '권장 300dpi(또는 400dpi).', fix: '300dpi 로 다시 저장하세요.' })
      if (kind === 'bits') add({ id: 'TIFF_BITS', level: 'warn', title: `${withIGa(figList(ns))} 흑백 1비트가 아닙니다(${val}비트)`, detail: '흑백(1비트) 도면이 기본입니다.', fix: '흑백 1비트로 바꿔 저장하세요.' })
      if (kind === 'order') add({ id: 'TIFF_ORDER', level: 'warn', title: `${figList(ns)} 바이트 순서가 Motorola(MM) 입니다`, detail: '기준은 Intel(II, little-endian).', fix: 'Intel 바이트 순서로 다시 저장하세요.' })
      if (kind === 'size') add({ id: 'TIFF_SIZE', level: 'info', title: `${figList(ns)} 실제 크기가 ${val.replace('x', '×')}mm 입니다`, detail: '권장 최대 255mm × 170mm(픽셀 수 자체는 강제하지 않음).', fix: '여백을 줄이거나 크기를 맞춰 다시 저장하세요. 편집기에서 통과했다면 그대로 두어도 됩니다.' })
    }
  }

  /* ---------------- 요약 ---------------- */

  const abs = one('abstract')
  let abstractChars = 0
  if (abs) {
    const t = textOf(abs).replace(/\n/g, ' ')
    abstractChars = t.length
    if (!t) add({ id: 'ABSTRACT_EMPTY', level: 'error', title: '요약이 비었습니다', detail: '', fix: '과제 · 해결 수단 · 효과를 400자 안에서 쓰세요.', where: [whereOf(abs.paraIdx)] })
    else if (abstractChars > 400) {
      add({ id: 'ABSTRACT_LONG', level: 'warn', title: `요약이 ${abstractChars}자 입니다(400자 안 권장)`, detail: '특허청 작성사례 기준 400자 이내(Master 13-1). 띄어쓰기 포함으로 셌습니다.', fix: '과제 · 해결 수단 · 효과만 남기고 줄이세요. 대표도의 부호를 ( ) 안에 쓰면 좋습니다.', where: [whereOf(abs.paraIdx)] })
    }
  }

  /* ---------------- 부호 ---------------- */

  const signsItem = one('signs')
  const signMap = new Map<string, string>()
  if (signsItem) {
    for (const p of signsItem.content) {
      const m = /^\s*(\d{1,4}[a-z]?)\s*[:：\-–]\s*(.+?)\s*$/.exec(p.text)
      if (m) signMap.set(m[1], m[2])
    }
  }
  const bodyText = [one('solution'), one('detail'), one('drawingDesc'), one('effect')].map(textOf).join('\n')
  const usedSigns = new Map<string, string>()
  for (const m of bodyText.matchAll(/([가-힣A-Za-z0-9·]+(?:[ ][가-힣A-Za-z0-9·]+){0,3})\s?\((\d{2,4}[a-z]?)\)/g)) {
    if (!usedSigns.has(m[2])) usedSigns.set(m[2], m[1])
  }
  if (usedSigns.size > 0) {
    const notListed = [...usedSigns.keys()].filter((k) => !signMap.has(k))
    if (notListed.length > 0) {
      add({ id: 'SIGNS_MISSING', level: signMap.size > 0 ? 'warn' : 'info', title: `본문 부호 ${notListed.length}개가 '부호의 설명'에 없습니다`, detail: `예: ${notListed.slice(0, 6).map((k) => `${usedSigns.get(k)}(${k})`).join(' · ')}`, fix: "'부호의 설명'에 '번호: 이름' 줄을 더하세요.", where: signsItem ? [whereOf(signsItem.paraIdx)] : [] })
    }
    const ns = (s: string) => s.replace(/\s+/g, '')
    const mismatch = [...usedSigns.entries()].filter(([k, name]) => {
      const listed = signMap.get(k)
      if (!listed) return false
      return !ns(name).endsWith(ns(listed)) && !ns(listed).endsWith(ns(name))
    })
    if (mismatch.length > 0) {
      add({ id: 'SIGNS_NAME', level: 'info', title: `부호 이름이 '부호의 설명'과 다르게 쓰인 곳이 ${mismatch.length}곳 있을 수 있습니다`, detail: mismatch.slice(0, 4).map(([k, name]) => `본문 '${clip(name, 16)}(${k})' ↔ 설명 '${signMap.get(k)}'`).join(' · '), fix: '같은 구성은 본문 · 도면 · 부호의 설명에서 같은 이름으로 쓰세요.' })
    }
    const unused = [...signMap.keys()].filter((k) => !usedSigns.has(k))
    if (unused.length > 0 && signMap.size > 0) {
      add({ id: 'SIGNS_UNUSED', level: 'info', title: `'부호의 설명'에만 있고 본문에는 안 쓰인 부호가 ${unused.length}개 있습니다`, detail: unused.slice(0, 8).map((k) => `${k}: ${signMap.get(k)}`).join(' · '), fix: '도면에만 나오는 부호라면 괜찮습니다. 아니면 본문에 쓰거나 지우세요.' })
    }
  }

  /* ---------------- 제출본 위생 ---------------- */

  const internal: Where[] = []
  const markdown: Where[] = []
  for (const p of doc.paras) {
    if (!p.text.trim()) continue
    const hit = INTERNAL_PHRASES.find((w) => p.text.includes(w))
    if (hit) internal.push(whereOf(p.idx, `'${hit}'`))
    const isIdent = doc.items.some((i) => i.paraIdx === p.idx)
    if (!isIdent && (/\*\*|```|<\/?b>|<\/?span/i.test(p.text) || /^#{1,6}\s/.test(p.text))) markdown.push(whereOf(p.idx, clip(p.text, 20)))
  }
  if (internal.length > 0) add({ id: 'HYGIENE_INTERNAL', level: 'error', title: `내부 작업 문구가 ${internal.length}곳 남아 있습니다`, detail: '제출본에는 검토 메모 · AI 코멘트 · 확인 필요 표시가 0건이어야 합니다(Master 12-4F).', fix: '해당 문구를 지우거나 실제 내용으로 바꾸세요.', where: internal.slice(0, 10) })
  if (markdown.length > 0) add({ id: 'HYGIENE_MARKDOWN', level: 'warn', code: 'E-201', title: `마크다운 · 서식 기호가 ${markdown.length}곳 남아 있습니다`, detail: "'**' · '#' · '<b>' 같은 기호가 본문에 그대로 붙으면 숨은 서식 · 식별항목 오류가 날 수 있습니다.", fix: '기호를 지우고, 편집기에는 [텍스트만 붙여넣기]로 넣으세요.', where: markdown.slice(0, 8) })

  /* ---------------- 빈 문단(HWPX) ---------------- */

  const blanks = isHwpx ? doc.paras.filter(blank) : []
  if (blanks.length > 0) {
    add({ id: 'BLANK_PARAS', level: 'info', title: `빈 문단이 ${blanks.length}개 있습니다`, detail: '본문 사이 빈 문단은 대개 괜찮지만, 식별항목 바로 아래 · 도 n 과 그림 사이에서는 오류가 됩니다. 정리하면 편집기 오류검사가 깔끔해집니다.', fix: '필요 없는 빈 문단을 지우세요.', where: blanks.slice(0, 6).map((p) => whereOf(p.idx, '빈 문단')) })
  }

  const counts: Record<Level, number> = { error: 0, warn: 0, info: 0 }
  for (const f of findings) counts[f.level] += 1
  const order: Record<Level, number> = { error: 0, warn: 1, info: 2 }
  findings.sort((a, b) => order[a.level] - order[b.level])

  return {
    summary: {
      title: titleKo,
      titleEn,
      claims: claims.length,
      independent,
      dependent,
      figs: figNums,
      drawingDesc: descNums,
      repFig: repText,
      paraNumbers: numbered.length,
      abstractChars,
      images: imageCount,
      blankParas: blanks.length,
    },
    findings,
    counts,
    clean: counts.error === 0,
  }
}
