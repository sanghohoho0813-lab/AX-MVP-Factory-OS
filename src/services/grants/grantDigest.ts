/**
 * D-623 맞는 공고 묶음 — 업체마다 '지난번 알린 뒤 새로 올라온 맞는 공고' 를 골라, 공고마다 내 한 줄 의견을 달아 한 통으로 보낸다.
 *
 *  - 예전 [카톡 문구 복사](D-141)는 맞는 공고 위에서 5건의 제목 · 마감만 한꺼번에 보냈다 — 고를 수 없고, 왜 맞는지 · 내 의견이 없었다.
 *  - 여기서는 ① 새로 올라온 것 먼저 골라 두고 ② 넣고 빼고 ③ 공고마다 한 줄 의견 ④ 한 통(소관 · 마감 · 지원 · 맞는 조건 · 확인할 것 · 의견 · 주소).
 *  - 보낸 기록에 그때의 공고 이름 · 의견을 같이 남긴다(기업마당 공고는 마감되면 목록에서 사라져 이름을 다시 못 찾는다).
 * 규칙 계산(공고 조건 × 업체 정보)이다 — 선정 가능성이 아니고, 글을 지어내지 않는다(공고에 적힌 것 · 내가 적은 의견만).
 */
import { localDateOf } from '../../lib/appClock'
import type { ClientOpsRecord } from '../../types/clientOps'
import { deadlineRank, verdictRank, type GrantMatch, type GrantNotice } from './grantMatch'
import type { SentChannel, SentRecord } from './grantStore'
import { applyDocViews, applyDocsFor } from './grantApply'

/** 처음에 골라 두는 수 — 카톡 한 통에 읽기 좋은 길이 */
export const DIGEST_DEFAULT = 5
/** 한 통에 넣을 수 있는 최대 수 */
export const DIGEST_LIMIT = 10
export const DIGEST_COMMENT_MAX = 120
export const DIGEST_NOTE_MAX = 200

/** fresh = 지난번 알린 뒤 새로 올라옴(한 번도 안 알린 업체는 맞는 공고 전부) · unsent = 예전부터 있었는데 아직 안 알림 · sent = 알린 적 있음 */
export type DigestBucket = 'fresh' | 'unsent' | 'sent'

export interface DigestCandidate {
  match: GrantMatch
  bucket: DigestBucket
  /** 알린 적 있으면 마지막으로 알린 날(YYYY-MM-DD) */
  sentOn: string
}

/** 업체마다 알린 기록 — 공고 id → 마지막으로 알린 날 · 업체의 마지막 알림 날 */
export interface SentIndex {
  ids: Map<string, Map<string, string>>
  last: Map<string, string>
}

const NO_IDS: ReadonlyMap<string, string> = new Map()

/** 보낸 기록(새것 먼저)을 한 번만 훑어 업체별로 묶는다 — 업체 수백 곳 × 공고 수백 건이어도 다시 찾지 않게 */
export function sentIndexOf(sent: readonly SentRecord[]): SentIndex {
  const ids = new Map<string, Map<string, string>>()
  const last = new Map<string, string>()
  for (const s of sent) {
    const day = localDateOf(s.at)
    if (!day) continue
    if ((last.get(s.clientId) ?? '') < day) last.set(s.clientId, day)
    let m = ids.get(s.clientId)
    if (!m) ids.set(s.clientId, (m = new Map()))
    for (const id of s.noticeIds) if ((m.get(id) ?? '') < day) m.set(id, day)
  }
  return { ids, last }
}

/** 공고가 올라온 날 — 기업마당은 등록일, 직접 넣은 공고는 넣은 날. 모르면 ''(새로 올라왔다고 하지 않는다) */
export function noticeDay(n: Pick<GrantNotice, 'postedAt' | 'createdAt' | 'source'>): string {
  if (n.postedAt) return n.postedAt
  // 기업마당 공고의 createdAt 은 '받아 온 때' 라 매일 바뀐다 — 올라온 날로 쓰지 않는다
  return n.source === 'bizinfo' ? '' : localDateOf(n.createdAt)
}

const bucketRank = (b: DigestBucket) => (b === 'fresh' ? 0 : b === 'unsent' ? 1 : 2)
const targeted = (m: GrantMatch) => (m.verdict === 'fit' || m.verdict === 'check') && m.deadline.open

/** 한 번도 알린 적 없는 업체는 맞는 공고 전부가 '보낼 것' · 알린 적 있으면 그날 뒤에 올라온 공고만 */
function bucketOf(m: GrantMatch, sentIds: ReadonlyMap<string, string>, last: string): { bucket: DigestBucket; sentOn: string } {
  const sentOn = sentIds.get(m.notice.id) ?? ''
  if (sentOn) return { bucket: 'sent', sentOn }
  const day = noticeDay(m.notice)
  return { bucket: !last || (day !== '' && day > last) ? 'fresh' : 'unsent', sentOn: '' }
}

/**
 * 이 업체에 보낼 만한 공고 — 업체를 겨냥한 것(맞음 · 확인 필요)만.
 * 새로 올라온 것 → 아직 안 알린 것 → 알린 것 순 · 그 안에서는 맞음 먼저 · 마감 급한 순.
 */
export function digestCandidates(matches: readonly GrantMatch[], index: SentIndex, clientId: string): DigestCandidate[] {
  const sentIds = index.ids.get(clientId) ?? NO_IDS
  const last = index.last.get(clientId) ?? ''
  return matches
    .filter(targeted)
    .map((match): DigestCandidate => ({ match, ...bucketOf(match, sentIds, last) }))
    .sort(
      (a, b) =>
        bucketRank(a.bucket) - bucketRank(b.bucket) ||
        verdictRank(a.match.verdict) - verdictRank(b.match.verdict) ||
        deadlineRank(a.match.deadline) - deadlineRank(b.match.deadline) ||
        a.match.notice.title.localeCompare(b.match.notice.title),
    )
}

/**
 * 처음에 골라 둘 공고 — 새로 올라온 것 위에서 n건.
 * 새로 올라온 것이 없으면 아무것도 고르지 않는다(같은 공고를 또 보내는 일은 직접 골랐을 때만).
 */
export function defaultDigestPicks(cands: readonly DigestCandidate[], n = DIGEST_DEFAULT): string[] {
  return cands
    .filter((c) => c.bucket === 'fresh')
    .slice(0, n)
    .map((c) => c.match.notice.id)
}

export interface DigestSummary {
  /** 이 업체에 마지막으로 알린 날('' = 한 번도 안 알림) */
  lastSent: string
  /** 새로 올라온 공고 가운데 조건 맞음 */
  fresh: number
  /** 그 가운데 7일 안에 끝나는 것 */
  urgentFresh: number
  /** 보낼 것이 있나 — 목록 '보낼 곳만' */
  due: boolean
}

/** 목록용 — 줄 세우지 않고 세기만 한다(업체 수백 곳 × 공고 수백 건) */
export function digestSummary(matches: readonly GrantMatch[], index: SentIndex, clientId: string): DigestSummary {
  const sentIds = index.ids.get(clientId) ?? NO_IDS
  const lastSent = index.last.get(clientId) ?? ''
  let fresh = 0
  let urgentFresh = 0
  for (const m of matches) {
    if (m.verdict !== 'fit' || !m.deadline.open || bucketOf(m, sentIds, lastSent).bucket !== 'fresh') continue
    fresh += 1
    if (m.deadline.urgent) urgentFresh += 1
  }
  return { lastSent, fresh, urgentFresh, due: fresh > 0 }
}

/* ------------------------------------------------------------------ */
/* 문구                                                                 */
/* ------------------------------------------------------------------ */

export interface DigestItem {
  match: GrantMatch
  /** 이 공고에 붙이는 내 한 줄 의견(없으면 줄을 넣지 않는다) */
  comment: string
}

const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩']
const oneLine = (s: string, max: number) => s.replace(/\s+/g, ' ').trim().slice(0, max)
const mdKo = (ymd: string) => (/^\d{4}-\d{2}-\d{2}$/.test(ymd) ? `${Number(ymd.slice(5, 7))}월 ${Number(ymd.slice(8, 10))}일` : '')

/** '11월 15일 마감' 처럼 이미 날짜가 든 말에는 날짜를 또 붙이지 않는다 */
function deadlineLine(m: GrantMatch): string {
  const day = mdKo(m.notice.applyEnd)
  return day && !m.deadline.label.includes(day) ? `${m.deadline.label} (${day})` : m.deadline.label
}

export function digestMessage(o: { companyName: string; sender: string; items: readonly DigestItem[]; note?: string }): string {
  const who = o.companyName.trim() ? `${o.companyName.trim()} 대표님` : '대표님'
  const note = oneLine(o.note ?? '', DIGEST_NOTE_MAX)
  const items = o.items.slice(0, DIGEST_LIMIT)
  const lines: string[] = [`${who}, 안녕하세요. ${o.sender}입니다.`, '']
  if (note) lines.push(note, '')
  lines.push(`대표님 회사 조건에 맞는 지원사업 공고 ${items.length}건을 골라 정리해 드립니다.`)
  items.forEach((it, i) => {
    const n = it.match.notice
    const ok = it.match.reasons.filter((r) => r.state === 'ok' && r.key !== 'region').map((r) => r.text.split(' — ')[0])
    const unknown = it.match.reasons.filter((r) => r.state === 'unknown').map((r) => r.label)
    const comment = oneLine(it.comment, DIGEST_COMMENT_MAX)
    lines.push(
      '',
      `${CIRCLED[i] ?? `${i + 1}.`} ${n.title}`,
      ...[
        n.agency ? `· 소관: ${n.agency}` : '',
        `· 마감: ${deadlineLine(it.match)}`,
        n.amountText ? `· 지원: ${n.amountText}` : '',
        ok.length ? `· 맞는 조건: ${ok.join(', ')}` : '',
        unknown.length ? `· 확인할 것: ${unknown.join(', ')}` : '',
        comment ? `· 제 의견: ${comment}` : '',
        n.url ? `· 공고: ${n.url}` : '',
      ].filter(Boolean),
    )
  })
  lines.push('', '신청해 보고 싶은 공고가 있으면 번호만 알려 주세요. 서류 준비부터 도와드리겠습니다.', '※ 조건은 공고 글과 회사 정보를 맞춰 본 것이며, 선정 여부는 심사에서 정해집니다.')
  return lines.join('\n')
}

/* ------------------------------------------------------------------ */
/* D-645 대표님께 드리는 한 장(인쇄 · PDF)                                  */
/* ------------------------------------------------------------------ */

export interface DigestSheetItem {
  no: string
  title: string
  /** 소관 · 수행 기관(있는 것만) */
  agency: string
  deadline: string
  amount: string
  ok: string[]
  unknown: string[]
  comment: string
  url: string
  /** 낼 서류 — 서류함에 이미 있는 것 · 더 받을 것(신청서 · 사업계획서는 따로) */
  docsHave: string[]
  docsNeed: string[]
  /** 신청서 · 사업계획서 — 같이 쓴다는 한 줄을 넣을지 */
  writePlan: boolean
}

export interface DigestSheet {
  /** 종이 머리 — '○○ 대표님께' */
  to: string
  title: string
  /** 'YYYY년 M월 D일' */
  date: string
  note: string
  items: DigestSheetItem[]
  /** 맨 아래 — 다음 순서 · 조건 안내(문구와 같은 말) */
  closing: string[]
}

const PLAN_DOC = /신청서|사업\s*계획서/
const ymdKo = (ymd: string) => (/^\d{4}-\d{2}-\d{2}$/.test(ymd) ? `${ymd.slice(0, 4)}년 ${Number(ymd.slice(5, 7))}월 ${Number(ymd.slice(8, 10))}일` : '')

/**
 * 문구(digestMessage)와 같은 공고 · 같은 순서 · 같은 의견을 종이 한 장 모양으로. 낼 서류는 공고 글의 제출서류(없으면 흔히 내는 것)를
 * 이 업체 서류함과 맞춰 '이미 있음 · 더 받을 것' 으로 나눈다(신청 준비 화면과 같은 함수 — applyDocViews).
 * 고객에게 드리는 종이 — 수수료 · 내부 메모 · 판정 점수는 넣지 않는다.
 */
export function digestSheet(o: { record: ClientOpsRecord; items: readonly DigestItem[]; note?: string; today: string }): DigestSheet {
  const name = o.record.companyName.trim()
  const items = o.items.slice(0, DIGEST_LIMIT).map((it, i): DigestSheetItem => {
    const n = it.match.notice
    const views = applyDocViews(o.record, { docs: applyDocsFor(n), applyDueDate: n.applyEnd }, o.today)
    const plain = views.filter((v) => !PLAN_DOC.test(v.label))
    return {
      no: CIRCLED[i] ?? `${i + 1}.`,
      title: n.title,
      agency: [n.agency, n.operator && n.operator !== n.agency ? n.operator : ''].filter(Boolean).join(' · '),
      deadline: deadlineLine(it.match),
      amount: n.amountText,
      ok: it.match.reasons.filter((r) => r.state === 'ok' && r.key !== 'region').map((r) => r.text.split(' — ')[0]),
      unknown: it.match.reasons.filter((r) => r.state === 'unknown').map((r) => r.label),
      comment: oneLine(it.comment, DIGEST_COMMENT_MAX),
      url: n.url,
      docsHave: plain.filter((v) => v.state === 'ok' || v.state === 'manual_done').map((v) => v.label),
      docsNeed: plain.filter((v) => v.state !== 'ok' && v.state !== 'manual_done').map((v) => (v.state === 'expired' || v.state === 'expires_before_due' ? `${v.label}(새로 발급)` : v.label)),
      writePlan: views.length !== plain.length,
    }
  })
  return {
    to: name ? `${name} 대표님께` : '대표님께',
    title: `맞는 지원사업 공고 ${items.length}건`,
    date: ymdKo(o.today),
    note: oneLine(o.note ?? '', DIGEST_NOTE_MAX),
    items,
    closing: ['신청해 보고 싶은 공고가 있으면 번호만 알려 주세요. 서류 준비부터 도와드리겠습니다.', '조건은 공고 글과 회사 정보를 맞춰 본 것이며, 선정 여부는 심사에서 정해집니다.'],
  }
}

/** 보낸 기록에 같이 남길 것 — 그때의 공고 이름 · 의견 · 한마디 */
export function digestExtra(items: readonly DigestItem[], note = ''): { titles: Record<string, string>; comments: Record<string, string>; note: string } {
  const titles: Record<string, string> = {}
  const comments: Record<string, string> = {}
  for (const it of items.slice(0, DIGEST_LIMIT)) {
    titles[it.match.notice.id] = oneLine(it.match.notice.title, 120)
    const c = oneLine(it.comment, DIGEST_COMMENT_MAX)
    if (c) comments[it.match.notice.id] = c
  }
  return { titles, comments, note: oneLine(note, DIGEST_NOTE_MAX) }
}

/* ------------------------------------------------------------------ */
/* 보낸 기록 보기                                                        */
/* ------------------------------------------------------------------ */

export interface DigestHistoryLine {
  id: string
  /** 보낸 날(YYYY-MM-DD) */
  day: string
  channel: SentChannel
  /** 그때 넣은 공고 — 이름을 아는 것만 이름으로(모르면 '' — 마감돼 목록에서 사라진 예전 기록) */
  items: { id: string; title: string; comment: string }[]
  note: string
}

/** 이 업체에 보낸 기록(새것 먼저 · n줄) — 공고가 없는 '찾기 링크' 기록도 한 줄로 남는다 */
export function digestHistory(sent: readonly SentRecord[], clientId: string, titleOf: (noticeId: string) => string, n = 5): DigestHistoryLine[] {
  return sent
    .filter((s) => s.clientId === clientId)
    .slice(0, n)
    .map((s) => ({
      id: s.id,
      day: localDateOf(s.at),
      channel: s.channel,
      items: s.noticeIds.map((id) => ({ id, title: s.titles?.[id] || titleOf(id), comment: s.comments?.[id] ?? '' })),
      note: s.note ?? '',
    }))
}
