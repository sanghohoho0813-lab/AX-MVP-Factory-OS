/**
 * 지원사업 신청 준비 (D-151).
 *
 * 공고 → 맞는 업체 → 알림까지 하던 것을 그다음 단계까지 잇는다.
 *  - 공고에서 [신청 준비] 를 누르면 그 업체의 '자금 · 지원사업 신청 건'(fundingApplications)이 하나 생긴다.
 *    마감일 · 마감 시각 · 공고 링크 · 낼 서류 목록이 함께 들어간다. 같은 공고는 두 번 생기지 않는다.
 *  - 낼 서류는 공고 글의 '제출서류' 를 읽고, 없으면 지원사업에 흔히 내는 서류(기본 목록)를 쓴다.
 *  - 서류마다 서류함과 맞춰 본다 — **마감일 기준**으로. 지금은 쓸 수 있어도 마감 전에 유효기간이 끝나면
 *    '마감 전에 만료 — 다시 발급' 으로 알린다(납세증명서처럼 한 달짜리).
 *  - 서류함에 없는 서류(신청서 · 사업계획서)는 손으로 '준비됨' 표시를 한다.
 *  - 모자란 서류만 골라 고객에게 보낼 카톡 문구를 만든다.
 *
 * 규칙 계산이다 — 외부 호출 · LLM 0. 서류 파일을 열지 않고 서류함 기록(받음 · 발급일 · 유효기간)만 본다.
 */

import type { ApplyDoc, ClientOpsRecord, DocumentKey, FundingApplication } from '../../types/clientOps'
import { allDocumentMetas } from '../clientOpsDocuments'
import { daysLeftFrom, documentStatus } from '../clientOpsAlerts'
import { withFunding, withNewFunding } from '../clientOpsService'
import type { GrantNotice } from './grantMatch'

/** 공고 글에 제출서류가 없을 때 — 정부 지원사업에 흔히 내는 것 */
export const DEFAULT_APPLY_DOCS: readonly string[] = [
  '사업자등록증',
  '중소기업 확인서',
  '최근 3개년 재무제표',
  '4대보험 가입자 명부',
  '국세 납세증명서',
  '지방세 납세증명서',
  '신청서 · 사업계획서',
]

/**
 * 서류 이름 → 같은 서류로 보는 이름들. 위에서부터 먼저 맞는 것을 쓴다(더 좁은 이름을 위에).
 * 서류함 칸 이름(사업자등록증 · 법인등기부등본 …)과 공고 글의 이름(등기사항전부증명서 …)을 한 이름으로 모은다.
 */
const SAME_DOC: ReadonlyArray<{ name: string; alias: readonly string[] }> = [
  { name: '지방세납세증명서', alias: ['지방세납세증명', '지방세완납증명'] },
  { name: '4대보험완납증명서', alias: ['4대보험완납', '4대사회보험완납', '사회보험료완납'] },
  { name: '국세납세증명서', alias: ['국세납세증명', '국세완납증명', '납세증명서', '완납증명서'] },
  { name: '4대보험가입자명부', alias: ['가입자명부', '피보험자명부', '사업장가입자'] },
  { name: '건강보험득실확인서', alias: ['득실확인'] },
  { name: '법인등기부등본', alias: ['등기부등본', '등기사항전부증명', '법인등기'] },
  { name: '법인인감증명서', alias: ['인감증명'] },
  { name: '중소기업확인서', alias: ['중소기업확인', '소상공인확인', '중소기업(소상공인)확인'] },
  { name: '벤처기업확인서', alias: ['벤처기업확인', '벤처확인'] },
  { name: '기업부설연구소인정서', alias: ['연구소인정', '연구개발전담부서'] },
  { name: '재무제표', alias: ['재무제표', '재무제표증명'] },
  { name: '사업자등록증', alias: ['사업자등록증'] },
  { name: '대표자신분증', alias: ['신분증'] },
  { name: '주주명부', alias: ['주주명부'] },
  { name: '정관', alias: ['정관'] },
  { name: '통장사본', alias: ['통장사본', '통장'] },
  { name: '특허증', alias: ['특허증', '특허등록'] },
]

const squash = (s: string) =>
  s
    .replace(/\s*\(\d+\)$/, '') // 서류함의 '(2)' 칸
    .replace(/\((?:최근|직전)[^)]*\)/g, '')
    .replace(/최근\s*\d\s*개?년?|직전\s*\d\s*개?년?|\d\s*개년/g, '')
    .replace(/사본|원본|각?\s*\d\s*부(?![가-힣])/g, '')
    .replace(/표준/g, '')
    .replace(/[\s·ㆍ,()]/g, '')

/** 서류 이름을 비교용 한 이름으로 — 모르는 서류는 글자 그대로(띄어쓰기 · 꼬리 뗀 것) */
export function docIdentity(label: string): string {
  const s = squash(label)
  for (const d of SAME_DOC) if (d.alias.some((a) => s.includes(a.replace(/[\s()]/g, '')))) return d.name
  return s
}

export type ApplyDocState =
  /** 서류함에 있고 마감 날까지 쓸 수 있다 */
  | 'ok'
  /** 서류함에 있지만 마감 전에 유효기간이 끝난다 */
  | 'expires_before_due'
  /** 서류함에 있지만 이미 만료 */
  | 'expired'
  /** 서류함에 없다 */
  | 'missing'
  /** 서류함에 없는 종류 — 손으로 '준비됨' 표시 */
  | 'manual_done'
  | 'manual_todo'

export interface ApplyDocView {
  label: string
  state: ApplyDocState
  /** 서류함에서 찾은 칸 */
  docKey: DocumentKey | null
  docLabel: string
  /** 만료일(있을 때) */
  expiresOn: string | null
  /** 사람 말 한 줄 */
  note: string
}

/** 서류함에 칸이 있는 종류인지 — 없는 종류(신청서 · 사업계획서)는 손으로 챙긴다 */
function shelfMatch(record: ClientOpsRecord, label: string, today: string) {
  const want = docIdentity(label)
  const metas = allDocumentMetas(record).filter((m) => m.needsFile !== false && docIdentity(m.label) === want)
  if (metas.length === 0) return null
  // 같은 종류 칸이 여럿('(2)')이면 가장 오래 쓸 수 있는 것
  const views = metas.map((m) => ({ meta: m, view: documentStatus(m.key, record.documents[m.key] ?? emptyState(), today, m) }))
  views.sort((a, b) => rank(b.view) - rank(a.view))
  return views[0]
}

const emptyState = () => ({ received: false, issuedAt: '', fileName: '', fileSize: 0, storagePath: '', note: '', updatedAt: null })
const rank = (v: { usable: boolean; received: boolean; expiresOn: string | null }) =>
  (v.usable ? 4 : v.received ? 2 : 0) + (v.usable && v.expiresOn === null ? 1 : 0) + (v.expiresOn ? Number(v.expiresOn.replace(/-/g, '')) / 1e9 : 0)

/** 늘 서류함에 칸이 있는 종류 — 업체 서류함에 그 칸이 아직 없어도 '없음' 으로 본다(손으로 체크하지 않는다) */
const SHELF_KINDS = new Set(SAME_DOC.map((d) => d.name))

/** 낼 서류 하나하나를 마감일 기준으로 본다 */
export function applyDocViews(record: ClientOpsRecord, app: Pick<FundingApplication, 'docs' | 'applyDueDate'>, today: string): ApplyDocView[] {
  const due = app.applyDueDate && app.applyDueDate >= today ? app.applyDueDate : today
  return (app.docs ?? []).map((d) => {
    const hit = shelfMatch(record, d.label, today)
    if (!hit) {
      if (SHELF_KINDS.has(docIdentity(d.label))) {
        return { label: d.label, state: 'missing', docKey: null, docLabel: '', expiresOn: null, note: '서류함에 없음' }
      }
      return d.done
        ? { label: d.label, state: 'manual_done', docKey: null, docLabel: '', expiresOn: null, note: '준비됨' }
        : { label: d.label, state: 'manual_todo', docKey: null, docLabel: '', expiresOn: null, note: '아직 준비 안 됨' }
    }
    const { meta, view } = hit
    const base = { label: d.label, docKey: meta.key, docLabel: meta.label, expiresOn: view.expiresOn }
    if (!view.received) return { ...base, state: 'missing', note: '서류함에 없음' }
    if (view.expired) return { ...base, state: 'expired', note: `만료됨(${view.expiresOn}) — 새로 발급` }
    if (view.expiresOn && view.expiresOn < due) return { ...base, state: 'expires_before_due', note: `마감 전 ${view.expiresOn} 에 만료 — 마감 가까이 다시 발급` }
    return { ...base, state: 'ok', note: view.expiresOn ? `${view.expiresOn} 까지 쓸 수 있음` : '있음' }
  })
}

export interface ApplyReadiness {
  views: ApplyDocView[]
  ready: number
  total: number
  /** 고객에게 받아야 하거나 다시 발급할 것 */
  needFromClient: ApplyDocView[]
  /** 우리가 챙길 것(신청서 · 사업계획서 …) */
  needFromUs: ApplyDocView[]
  daysLeft: number | null
}

export function applyReadiness(record: ClientOpsRecord, app: FundingApplication, today: string): ApplyReadiness {
  const views = applyDocViews(record, app, today)
  const ready = views.filter((v) => v.state === 'ok' || v.state === 'manual_done').length
  return {
    views,
    ready,
    total: views.length,
    needFromClient: views.filter((v) => v.state === 'missing' || v.state === 'expired' || v.state === 'expires_before_due'),
    needFromUs: views.filter((v) => v.state === 'manual_todo'),
    daysLeft: app.applyDueDate ? daysLeftFrom(today, app.applyDueDate) : null,
  }
}

/** 공고의 낼 서류 — 공고 글에서 읽은 것, 없으면 기본 목록. 신청서 · 사업계획서는 늘 넣는다 */
export function applyDocsFor(notice: Pick<GrantNotice, 'documents'>): ApplyDoc[] {
  const list = notice.documents?.length ? [...notice.documents] : [...DEFAULT_APPLY_DOCS]
  if (!list.some((l) => /신청서|사업\s*계획서/.test(l))) list.push('신청서 · 사업계획서')
  const seen = new Set<string>()
  const out: ApplyDoc[] = []
  for (const label of list) {
    const id = docIdentity(label)
    if (seen.has(id)) continue
    seen.add(id)
    out.push({ label, done: false })
  }
  return out
}

const sameProgram = (a: string, b: string) => a.replace(/[\s[\]()·]/g, '') === b.replace(/[\s[\]()·]/g, '')

/** 이 업체가 이 공고로 이미 신청 준비 중인 건 */
export function applicationFor(record: Pick<ClientOpsRecord, 'fundingApplications'>, notice: Pick<GrantNotice, 'id' | 'title'>): FundingApplication | null {
  return (
    record.fundingApplications.find((a) => a.noticeId === notice.id) ??
    record.fundingApplications.find((a) => !a.noticeId && sameProgram(a.programName, notice.title)) ??
    null
  )
}

/**
 * 공고로 신청 준비를 건다. 이미 있으면 그대로(두 번 만들지 않는다) — 예전에 손으로 적은 같은 이름 건이면 공고 정보만 붙인다.
 */
export function withGrantApplication(
  record: ClientOpsRecord,
  notice: GrantNotice,
): { record: ClientOpsRecord; app: FundingApplication; created: boolean } {
  const due = notice.deadlineKind === 'date' ? notice.applyEnd : ''
  const extra: Partial<FundingApplication> = {
    noticeId: notice.id,
    ...(notice.url ? { noticeUrl: notice.url } : {}),
    ...(notice.applyEndTime ? { applyDueTime: notice.applyEndTime } : {}),
  }
  const existing = applicationFor(record, notice)
  if (existing) {
    if (existing.noticeId === notice.id && existing.docs) return { record, app: existing, created: false }
    const patch: Partial<FundingApplication> = { ...extra, ...(existing.docs ? {} : { docs: applyDocsFor(notice) }), ...(!existing.applyDueDate && due ? { applyDueDate: due } : {}) }
    const next = withFunding(record, existing.id, patch)
    return { record: next, app: next.fundingApplications.find((a) => a.id === existing.id) ?? existing, created: false }
  }
  const made = withNewFunding(record, {
    programName: notice.title,
    institution: notice.agency || notice.operator,
    status: 'preparing',
    applyDueDate: due,
  })
  const [first, ...rest] = made.fundingApplications
  const app: FundingApplication = { ...first, ...extra, docs: applyDocsFor(notice) }
  const activity = made.activity.map((x, i) => (i === 0 && x.kind === 'funding_added' ? { ...x, text: `지원사업 신청 준비 — ${notice.title}` } : x))
  return { record: { ...made, fundingApplications: [app, ...rest], activity }, app, created: true }
}

/** 서류함에 없는 서류(신청서 …)를 '준비됨' 으로 · 되돌리기 */
export function withApplyDocDone(record: ClientOpsRecord, appId: string, label: string, done: boolean): ClientOpsRecord {
  const app = record.fundingApplications.find((a) => a.id === appId)
  if (!app?.docs) return record
  return withFunding(record, appId, { docs: app.docs.map((d) => (d.label === label ? { ...d, done } : d)) })
}

/** 낼 서류 하나 더 · 빼기 */
export function withApplyDocs(record: ClientOpsRecord, appId: string, docs: ApplyDoc[]): ClientOpsRecord {
  return withFunding(record, appId, { docs: docs.filter((d) => d.label.trim()).slice(0, 30) })
}

const DOW = ['일', '월', '화', '수', '목', '금', '토']
function dueLine(app: FundingApplication, today: string): string {
  if (!app.applyDueDate) return ''
  const [y, m, d] = app.applyDueDate.split('-').map(Number)
  const dow = DOW[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  const left = daysLeftFrom(today, app.applyDueDate)
  const dday = left === null ? '' : left > 0 ? ` (D-${left})` : left === 0 ? ' (오늘)' : ''
  return `${m}월 ${d}일(${dow})${app.applyDueTime ? ` ${app.applyDueTime}` : ''}${dday}`
}

/** 발급처 — 흔한 것만. 모르면 적지 않는다 */
const WHERE: Record<string, string> = {
  국세납세증명서: '홈택스',
  지방세납세증명서: '위택스 · 정부24',
  '4대보험가입자명부': '4대사회보험 정보연계센터',
  '4대보험완납증명서': '4대사회보험 정보연계센터',
  건강보험득실확인서: '국민건강보험공단',
  법인등기부등본: '인터넷등기소',
  법인인감증명서: '등기소 · 무인발급기',
  중소기업확인서: '중소기업현황정보시스템',
  재무제표: '홈택스(표준재무제표증명)',
  사업자등록증: '홈택스',
  벤처기업확인서: '벤처확인종합관리시스템',
}

/** 고객에게 보낼 서류 요청 카톡 문구 — 모자란 것만. 다 있으면 '다 받았다' 문구 */
export function grantDocRequestMessage(record: ClientOpsRecord, app: FundingApplication, today: string): string {
  const r = applyReadiness(record, app, today)
  const who = record.representativeName ? `${record.representativeName} 대표님` : `${record.companyName} 담당자님`
  const due = dueLine(app, today)
  const head = [`안녕하세요, ${who}.`, `'${app.programName}' 신청을 준비하고 있습니다.${due ? `\n마감: ${due}` : ''}`]
  if (r.needFromClient.length === 0) {
    return [...head, '', '필요한 서류는 모두 받았습니다. 신청서 작성이 끝나면 다시 연락드리겠습니다.'].join('\n')
  }
  const lines = r.needFromClient.map((v, i) => {
    const where = WHERE[docIdentity(v.label)]
    const why = v.state === 'expires_before_due' ? ' — 마감 전에 유효기간이 끝나 새로 발급이 필요합니다' : v.state === 'expired' ? ' — 갖고 있는 것이 만료되어 새로 발급이 필요합니다' : ''
    return `${i + 1}. ${v.label}${where ? ` (발급: ${where})` : ''}${why}`
  })
  const have = r.views.filter((v) => v.state === 'ok').map((v) => v.label)
  return [
    ...head,
    '',
    '아래 서류를 보내 주세요.',
    ...lines,
    ...(have.length ? ['', `이미 받은 서류: ${have.join(' · ')}`] : []),
    '',
    r.daysLeft !== null && r.daysLeft <= 7 ? '마감이 가까워 가능하면 이번 주 안에 부탁드립니다. 감사합니다.' : '감사합니다.',
  ].join('\n')
}

/** 진행 중인 신청 준비(접수 전)만 — 오늘 · 맞춤 추천에서 쓴다 */
export function openApplications(record: Pick<ClientOpsRecord, 'fundingApplications'>): FundingApplication[] {
  return record.fundingApplications.filter((a) => (a.status === 'watching' || a.status === 'preparing') && Array.isArray(a.docs))
}
