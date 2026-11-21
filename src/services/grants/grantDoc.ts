/**
 * D-639 공고 원문 파일(PDF · 한글 · 사진) 읽기 — 순수 함수. 규칙으로 읽는다(LLM 호출 0).
 *
 * 붙여넣기 읽기(parseNoticeText)는 '지원대상 …' 처럼 줄 맨 앞에 칸 이름이 있는 짧은 글을 본다.
 * 부처 · 지자체가 내는 공고 원문은 모양이 다르다:
 *   중소벤처기업부 공고 제2026-98호            ← 소관 · 번호 줄(공고명이 아님)
 *   2026년 ○○ 지원사업 참여기업 모집 공고       ← 공고명
 *   1. 사업 개요                               ← 칸 머리(글머리 · 번호)
 *    ❍ (지원규모) 총 300억원, 약 900개사         ← 괄호 칸 이름
 *   2. 신청 자격                               ← 칸 머리만 있고 내용은 아래 '가. …' 줄들
 *   지 원 대 상\t창업 3년 이내 기업               ← 한글 표(칸 사이 탭 · 글자 사이 띄어 쓴 칸 이름)
 * 그래서 줄마다 글머리 단계(□ · 1. → 가. → ❍ · ① → -)를 보고 칸 이름을 찾아 칸별 글을 모은 뒤,
 * 붙여넣기 읽기와 같은 규칙(기간 · 조건 · 서류 · 금액)에 넘긴다.
 *
 * 지어내지 않는다 — 못 찾은 칸은 비우고 '못 찾은 칸' 으로 알린다. 어디서 읽었는지(쪽 · 그 줄)를 같이 돌려준다.
 */
import { NO_RULES } from './grantMatch'
import { amountOf } from './grantFilter'
import { categoryOf, documentsOf, periodOf, rulesFromText, withAgencyRegion, type NoticeDraft } from './grantText'

export type DocField = '공고명' | '소관' | '신청 기간' | '지원 대상' | '지원 금액' | '제출 서류'

/** 읽은 칸 하나 — 화면에 '어디서 읽었나' 로 보인다 */
export interface DocFound {
  field: DocField
  /** 몇 쪽(1부터 · 쪽 나눔이 없으면 1) */
  page: number
  /** 읽은 줄 앞부분 */
  line: string
}

export interface DocRead {
  draft: NoticeDraft
  found: DocFound[]
  /** 못 찾은 칸 — 직접 적어 달라고 한다 */
  missing: DocField[]
  /** 칸 이름 없이 글 전체에서 짐작한 칸 — 한 번 확인해 달라고 한다 */
  unsure: DocField[]
  /** 읽은 쪽 수 */
  pages: number
}

export const DOC_FIELDS: readonly DocField[] = ['공고명', '소관', '신청 기간', '지원 대상', '지원 금액', '제출 서류']

/* ------------------------------------------------------------------ */
/* 줄 · 칸 이름                                                          */
/* ------------------------------------------------------------------ */

type Key = 'title' | 'agency' | 'operator' | 'period' | 'target' | 'exclude' | 'support' | 'summary' | 'docs' | 'stop'

/** 띄어쓰기 · 가운뎃점을 뗀 칸 이름 → 칸 */
const LABEL_KEYS: [RegExp, Key][] = [
  [/^(?:공고명|사업명|공모명)$/, 'title'],
  [/^(?:소관부처(?:지자체)?|소관기관|주관기관|주최기관|소관)$/, 'agency'],
  [/^(?:사업수행기관|수행기관|전담기관|운영기관|주관수행기관|사업운영기관)$/, 'operator'],
  [/^(?:신청및접수기간|신청접수기간|사업신청기간|신청기간|접수기간|모집기간|공모기간|접수일정|신청일정|모집일정|신청기한|접수기한)$/, 'period'],
  [/^(?:지원대상|신청대상|신청자격|지원자격|참여대상|모집대상|사업대상|신청요건|참여자격|참가자격|참가대상|대상)$/, 'target'],
  [/^(?:지원제외(?:대상)?|제외대상|신청제외(?:대상)?|참여제한|신청제한|지원제한)$/, 'exclude'],
  [/^(?:지원규모|지원내용|지원금액|지원한도|지원조건|지원범위|지원사항|지원금|사업규모|선정규모|모집규모|지원예산|지원비율)$/, 'support'],
  [/^(?:사업개요|사업목적|사업내용|추진목적|추진배경|목적|개요)$/, 'summary'],
  [/^(?:제출서류(?:목록)?|구비서류|신청서류|필요서류|증빙서류|제출서류및양식)$/, 'docs'],
  [
    /^(?:신청방법|접수방법|신청및접수방법|선정방법|평가방법|선정절차|추진일정|추진절차|유의사항|우대사항|가점사항|가점|기타사항|기타|문의처|문의|담당|협약기간|사업기간|지원기간|수행기간|평가기준|선정기준|첨부|붙임)$/,
    'stop',
  ],
]

const plain = (s: string) => s.replace(/[\s·ㆍ・.,]/g, '')

function keyOf(label: string): Key | null {
  const p = plain(label)
  if (p.length < 2 || p.length > 14) return null
  for (const [re, k] of LABEL_KEYS) if (re.test(p)) return k
  return null
}

/** 글머리 단계 — 1(□ · 1. · Ⅰ.) · 2(가.) · 3(❍ · ㅇ · ① · (1) · 1)) · 4(- · · · * · ※) · 9(글머리 없음) */
const LEVELS: [number, RegExp][] = [
  [1, /^(?:[□■◆◇◈❏❑]+\s*|[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+\s*\.?\s*|[IVX]{1,4}\s*\.\s*|\d{1,2}\s*\.(?!\d)\s*)/],
  [2, /^(?:[가-하]\s*[.)]\s*|\([가-하]\)\s*)/],
  [3, /^(?:[❍○●◎◉▶▷ㅇ◦]+\s*|o(?=\s)\s*|[①-⑳]\s*|\(\d{1,2}\)\s*|\d{1,2}\s*\)\s*)/],
  [4, /^(?:[-–—·∙•▪▫*※]+\s*)/],
]

function levelOf(t: string): { level: number; body: string } {
  for (const [lv, re] of LEVELS) {
    const m = re.exec(t)
    if (m && m[0].length < t.length) return { level: lv, body: t.slice(m[0].length).trim() }
  }
  return { level: 9, body: t }
}

/** 서류 이름에 흔한 말 — 제출서류 칸 안의 '1. 사업계획서 1부' 는 칸 머리가 아니다 */
const DOC_WORDS = /서류|증명|확인서|등록증|등본|명부|계획서|신청서|재무|사본|인정서|정관|동의서|서약서|서식|양식|명세서|확약서|추천서|결산|신고서|협약서|견적서|증빙|\d\s*부/

interface Line {
  raw: string
  body: string
  level: number
  page: number
  key: Key | null
  rest: string
}

const PAGE_NO = /^[-–—\s]*\d{1,3}[-–—\s]*$|^\d{1,3}\s*\/\s*\d{1,3}$|^page\s*\d+$/i
/** 칸 이름 낱말 뒤가 조사 · '내에' 같은 말이면 문장이다 — '신청기간 내에 제출한 …' */
const SENTENCE_AFTER = /^(?:은|는|이|가|을|를|의|에|에서|내|중|동안|까지|부터|으로|로)(?![가-힣])/

function labelOf(body: string): { key: Key; rest: string } | null {
  // (지원대상) 내용 — 괄호 칸 이름
  const paren = /^[(（[［【〔〈]\s*([가-힣·ㆍ\s]{2,20}?)\s*[)）\]］】〕〉]\s*[:：]?\s*(.*)$/.exec(body)
  if (paren) {
    const k = keyOf(paren[1])
    if (k) return { key: k, rest: paren[2].trim() }
  }
  // 표 줄 — 지원대상\t내용 · 지원대상 | 내용
  const cells = body.split(/\t+|\s+\|\s+/)
  if (cells.length >= 2) {
    const k = keyOf(cells[0])
    if (k) return { key: k, rest: cells.slice(1).join(' ').trim() }
  }
  // 지원대상 : 내용
  const colon = /^([가-힣·ㆍ\s]{2,20}?)\s*[:：]\s*(.*)$/.exec(body)
  if (colon) {
    const k = keyOf(colon[1])
    if (k) return { key: k, rest: colon[2].trim() }
  }
  // 칸 머리만 — '신청 기간 및 방법' · '사업 개요' · '제출 서류(양식 첨부)'
  const head = body.replace(/\s*[(（][^)）]*[)）]\s*$/, '').replace(/\s*(?:및|등)\s*[가-힣\s]{1,8}$/, '')
  const whole = keyOf(head)
  if (whole) return { key: whole, rest: '' }
  // 지원대상 내용 · 지원 대상 내용(붙여넣기 꼴) — 네 글자 넘는 칸 이름만(문장 속 '대상 기업은 …' 을 칸으로 읽지 않게)
  for (const re of [/^([가-힣]{4,8})\s+(.+)$/, /^([가-힣]{1,4}\s[가-힣]{1,4})\s+(.+)$/]) {
    const m = re.exec(body)
    if (!m || plain(m[1]).length < 4) continue
    const k = keyOf(m[1])
    if (k && k !== 'stop' && !SENTENCE_AFTER.test(m[2])) return { key: k, rest: m[2].trim() }
  }
  return null
}

export function noticeLines(raw: string): Line[] {
  const out: Line[] = []
  let page = 1
  for (const piece of raw.replace(/\r/g, '').split('\n')) {
    if (piece.includes('\f')) page += piece.split('\f').length - 1
    const t = piece.replace(/\f/g, '').replace(/[  　]+/g, ' ').trim()
    if (!t || PAGE_NO.test(t)) continue
    const { level, body } = levelOf(t)
    const lab = labelOf(body)
    out.push({ raw: t, body, level, page, key: lab?.key ?? null, rest: lab?.rest ?? '' })
  }
  return out
}

/* ------------------------------------------------------------------ */
/* 칸별 글 모으기                                                         */
/* ------------------------------------------------------------------ */

interface Block {
  key: Key
  page: number
  /** 칸 이름이 있던 줄 */
  first: string
  lines: string[]
}

const MAX_LINES: Record<Key, number> = { title: 2, agency: 1, operator: 1, period: 3, target: 8, exclude: 4, support: 6, summary: 6, docs: 20, stop: 0 }

function blocksOf(lines: Line[]): Block[] {
  const out: Block[] = []
  for (let i = 0; i < lines.length; i += 1) {
    const l = lines[i]
    if (!l.key || l.key === 'stop') continue
    const b: Block = { key: l.key, page: l.page, first: l.raw, lines: l.rest ? [l.rest] : [] }
    // 글머리 없는 칸 이름 줄(붙여넣기 · 표)은 큰 머리(□ · 1.)에서만 멈춘다
    const own = l.level === 9 ? 1 : l.level
    for (let j = i + 1; j < lines.length && b.lines.length < MAX_LINES[l.key]; j += 1) {
      const n = lines[j]
      // 칸 머리 아래 작은 글머리의 '사업기간: …' · '문의: …' 줄은 건너뛰고 계속(□ 사업 개요 아래 ㅇ 사업기간 · ㅇ 과제당 최대 2억원)
      if (n.key === 'stop' && n.level !== 9 && n.level > own) continue
      if (n.key) break
      if (/^https?:\/\//.test(n.raw)) break
      // 같은 단계나 더 큰 글머리에서 다음 칸 — 제출서류 칸의 '1. 사업계획서 1부' 는 서류 목록이라 계속
      if (n.level !== 9 && n.level <= own && !(l.key === 'docs' && DOC_WORDS.test(n.body))) break
      b.lines.push(l.key === 'docs' ? n.raw : n.body)
    }
    out.push(b)
  }
  return out
}

const textOf = (b: Block | undefined) => (b ? b.lines.join(' ').replace(/\s+/g, ' ').trim() : '')

const HAS_DATE = /20\d{2}\s*[.\-/년]\s*\d{1,2}|20\d{6}|상시|수시|연중|선착순|소진/

/** 제출서류 칸 → 서류 이름 목록(붙여넣기 읽기와 같은 규칙). 첫 줄이 번호 목록이면 머리 줄을 비워 둔다 */
function docsOfBlock(b: Block): string[] {
  const [first = '', ...rest] = b.lines
  const firstIsItem = /^(?:[①-⑳]|\d{1,2}\s*[.)]|[-·•○◦▪❍ㅇ])/.test(first)
  return documentsOf([`제출서류: ${firstIsItem ? '' : first}`, ...(firstIsItem ? b.lines : rest)])
}

/* ------------------------------------------------------------------ */
/* 공고명 · 소관                                                          */
/* ------------------------------------------------------------------ */

const NOTICE_NO = /^(.{2,40}?)\s*(?:공고|고시|공시)\s*(?:제\s*)?\(?\s*20\d{2}\s*[-–—.]?\s*\d{1,5}\s*\)?\s*호?/
const SIGNER = /^(.{2,30}?(?:부|청|처|위원회|시|도|군|구|공단|진흥원|재단|센터|원|공사|협회))\s*(?:장관|청장|처장|위원장|시장|도지사|지사|군수|구청장|이사장|원장|센터장|사장|회장)$/
const ONLY_DATE = /^\s*20\d{2}\s*[.년-]\s*\d{1,2}\s*[.월-]\s*\d{1,2}\s*[.일]?\s*(?:\([^)]{0,4}\))?\s*$/
const TITLE_END = /(?:공고|모집|공모|안내|계획)\s*(?:\([^)]{0,6}\))?\s*$/

function titleScore(s: string): number {
  let v = 0
  if (TITLE_END.test(s)) v += 3
  if (/20\d{2}/.test(s)) v += 2
  if (/사업|지원|바우처|모집|공모|선정|육성|참여기업|참가기업|프로그램/.test(s)) v += 2
  if (/^\[[^\]]{2,10}\]/.test(s)) v += 1
  if (/(?:합니다|하오니|바랍니다|입니다|하였|됩니다)\.?\s*$/.test(s) || /[.。]$/.test(s)) v -= 4
  if (s.length > 60) v -= 2
  return v
}

function titleOf(lines: Line[], blocks: Block[]): { title: string; page: number; line: string } {
  const labeled = blocks.find((b) => b.key === 'title' && textOf(b))
  if (labeled) return { title: textOf(labeled).slice(0, 200), page: labeled.page, line: labeled.first }
  const head = lines.slice(0, 30)
  const ok = (l: Line | undefined) => !!l && l.level === 9 && !l.key && !NOTICE_NO.test(l.raw) && !ONLY_DATE.test(l.raw) && !SIGNER.test(l.raw)
  let best = -1
  let bestScore = -99
  for (const [i, l] of head.entries()) {
    if (!ok(l) || l.raw.length < 8 || l.raw.length > 90 || !/[가-힣]/.test(l.raw)) continue
    const sc = titleScore(l.raw)
    if (sc > bestScore) {
      bestScore = sc
      best = i
    }
  }
  // 공고 이름다운 줄이 없으면(안내 문장뿐) 비워 둔다 — 지어내지 않는다
  if (best < 0 || bestScore < 2) return { title: '', page: 1, line: '' }
  let title = head[best].raw
  // 두 줄로 나뉜 공고명 — '2026년 창업성장기술개발사업' + '디딤돌 과제 시행계획 공고'
  const next = head[best + 1]
  const prev = head[best - 1]
  if (!TITLE_END.test(title) && ok(next) && next.raw.length <= 40 && TITLE_END.test(next.raw)) title = `${title} ${next.raw}`
  else if (TITLE_END.test(title) && !/20\d{2}/.test(title) && ok(prev) && prev.raw.length <= 40 && /20\d{2}/.test(prev.raw) && !TITLE_END.test(prev.raw)) title = `${prev.raw} ${title}`
  return { title: title.replace(/\s+/g, ' ').slice(0, 200), page: head[best].page, line: head[best].raw }
}

function agencyOf(lines: Line[], blocks: Block[]): { agency: string; page: number; line: string } {
  const labeled = blocks.find((b) => b.key === 'agency' && textOf(b))
  if (labeled) return { agency: textOf(labeled).slice(0, 80), page: labeled.page, line: labeled.first }
  for (const l of lines.slice(0, 40)) {
    const m = NOTICE_NO.exec(l.raw)
    if (m && /[가-힣]{2,}/.test(m[1]) && !/년|사업/.test(m[1])) return { agency: m[1].replace(/\s+/g, ' ').trim().slice(0, 80), page: l.page, line: l.raw }
  }
  for (const l of lines) {
    const m = SIGNER.exec(l.raw)
    if (m) return { agency: m[1].replace(/\s+/g, ' ').trim().slice(0, 80), page: l.page, line: l.raw }
  }
  return { agency: '', page: 1, line: '' }
}

/* ------------------------------------------------------------------ */
/* 기간 — 칸 이름이 없으면 '~' 옆 날짜(사업 · 협약 기간은 빼고)                  */
/* ------------------------------------------------------------------ */

const NOT_APPLY_PERIOD = /(?:사업|협약|수행|지원|개발|운영|교육|과제|계약|보조)\s*(?:기간|일정)\s*[:：)]?\s*[^~∼]{0,24}$/

function guessPeriod(lines: Line[]): { text: string; page: number; line: string } | null {
  for (const l of lines) {
    const t = l.body
    if (!/접수|신청|모집|공모|마감/.test(t)) continue
    for (const m of t.matchAll(/[~∼]/g)) {
      const at = m.index ?? 0
      if (NOT_APPLY_PERIOD.test(t.slice(Math.max(0, at - 40), at))) continue
      const win = t.slice(Math.max(0, at - 40), at + 40)
      if (/20\d{2}\s*[.\-/년]\s*\d{1,2}|20\d{6}/.test(win)) return { text: win, page: l.page, line: l.raw }
    }
  }
  return null
}

const URL = /https?:\/\/[^\s<>"')\]]+/
const WWW = /(?<![\w.@/])www\.[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s<>"')\]]*)?/i

/* ------------------------------------------------------------------ */
/* 공고 원문 → 공고 칸                                                    */
/* ------------------------------------------------------------------ */

const clipLine = (s: string) => {
  const t = s.replace(/\t+/g, ' · ').replace(/\s+/g, ' ').trim()
  return t.length > 60 ? `${t.slice(0, 60)}…` : t
}

export function readNoticeDoc(raw: string): DocRead {
  const lines = noticeLines(raw)
  const blocks = blocksOf(lines)
  const pages = lines.length ? lines[lines.length - 1].page : 0
  const found: DocFound[] = []
  const unsure: DocField[] = []
  const note = (field: DocField, page: number, line: string) => {
    if (line) found.push({ field, page, line: clipLine(line) })
  }

  const t = titleOf(lines, blocks)
  note('공고명', t.page, t.line)
  const a = agencyOf(lines, blocks)
  note('소관', a.page, a.line)
  const op = blocks.find((b) => b.key === 'operator' && textOf(b))

  // 기간 — 날짜가 든 칸을 먼저(앞의 '신청기간 내에 …' 같은 칸은 건너뜀). 없으면 '접수 … ~' 줄에서 짐작(확인 칸)
  const periodBlock = blocks.find((b) => b.key === 'period' && HAS_DATE.test(textOf(b)))
  let period = periodOf('')
  if (periodBlock) {
    period = periodOf(textOf(periodBlock))
    note('신청 기간', periodBlock.page, periodBlock.first)
  } else {
    const g = guessPeriod(lines)
    const p = g ? periodOf(g.text) : null
    if (g && p && (p.applyEnd || p.applyStart)) {
      period = p
      note('신청 기간', g.page, g.line)
      unsure.push('신청 기간')
    }
  }

  // 지원 대상 — 글이 있는 첫 칸 + 제외 대상은 '제외 대상:' 로 덧붙인다(조건 읽기가 '그 업종 제외' 로 본다)
  const targetBlock = blocks.find((b) => b.key === 'target' && textOf(b))
  const exclude = blocks.filter((b) => b.key === 'exclude' && textOf(b)).map(textOf)
  const target = [textOf(targetBlock), ...exclude.map((x) => `제외 대상: ${x}`)].filter(Boolean).join('\n').slice(0, 600)
  if (targetBlock) note('지원 대상', targetBlock.page, targetBlock.first)

  // 지원 금액 · 규모 — 지원규모 · 지원내용 칸 → 개요(선정 규모 '30개사' 도 여기서 읽힌다)
  const supportBlocks = blocks.filter((b) => b.key === 'support' && textOf(b))
  const summaryBlocks = blocks.filter((b) => b.key === 'summary' && textOf(b))
  const support = supportBlocks.map(textOf).join(' ')
  const summary = [support, ...summaryBlocks.map(textOf)].filter(Boolean).join(' ').replace(/\s+/g, ' ').slice(0, 1200)
  const money = amountOf({ amountText: '', title: '', summary: support || summary })
  const amountText = money.man !== null ? money.text.slice(0, 80) : ''
  if (amountText) {
    const core = money.text.replace(/^(?:최대|업체당|기업당|과제당|개사당|1인당|인당|팀당|월)\s*/, '').replace(/\s+/g, '')
    const where = [...supportBlocks, ...summaryBlocks].find((b) => textOf(b).replace(/\s+/g, '').includes(core)) ?? supportBlocks[0] ?? summaryBlocks[0]
    if (where) note('지원 금액', where.page, where.first)
  }

  // 제출 서류
  let documents: string[] = []
  for (const b of blocks) {
    if (b.key !== 'docs') continue
    const list = docsOfBlock(b)
    if (list.length) {
      documents = list
      note('제출 서류', b.page, b.first)
      break
    }
  }

  const www = WWW.exec(raw)?.[0]
  const url = URL.exec(raw)?.[0] ?? (www ? `https://${www}` : '')

  // 조건 — 대상 글에 적힌 것만. '강한 표현'(창업 N년 이내) 자리도 본문 전체가 아니라 읽은 칸들만(배경 설명의 말로 조건을 걸지 않게)
  const whole = [t.title, target, summary, textOf(periodBlock)].filter(Boolean).join('\n')
  const empty = { ...NO_RULES, regions: [], cities: [], industries: [], excludeIndustries: [], sizes: [], certs: [] }
  const rules = withAgencyRegion(target ? rulesFromText(target, whole, t.title) : empty, a.agency)

  const draft: NoticeDraft = {
    title: t.title,
    agency: a.agency,
    operator: textOf(op).slice(0, 80),
    category: categoryOf(t.title, `${target} ${summary}`),
    ...period,
    amountText,
    target,
    summary,
    url,
    rules,
    source: 'paste',
    ...(documents.length ? { documents } : {}),
  }
  const have: Record<DocField, boolean> = {
    공고명: !!draft.title,
    소관: !!draft.agency,
    '신청 기간': !!(draft.applyEnd || draft.applyStart) || draft.deadlineKind !== 'date',
    '지원 대상': !!draft.target,
    '지원 금액': !!draft.amountText,
    '제출 서류': documents.length > 0,
  }
  return { draft, found, missing: DOC_FIELDS.filter((k) => !have[k]), unsure, pages }
}

/** 화면 한 줄 — '공고명 · 신청 기간 · 지원 대상 · 제출 서류 6개' */
export function docReadLine(r: DocRead): string {
  return r.found.map((f) => (f.field === '제출 서류' ? `제출 서류 ${r.draft.documents?.length ?? 0}개` : f.field)).join(' · ')
}
