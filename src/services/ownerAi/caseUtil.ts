/**
 * Company Case 공통 — 아이디 · 지문 · 회사 이름 맞추기 · 중복 업체 찾기 · 타임라인 · 자료 만들기.
 */
import type { ActivityEntry, ClientOpsRecord } from '../../types/clientOps'
import { redactSensitive } from '../../domain/consulting/privacyFilter'
import { stripRrn } from '../../tools/employment/lib/privacy'
import type { CaseFactKey, CaseMaterial, CaseRelation, CompanyCase, MaterialKind } from './types'

export function newId(prefix: string): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } }
  const raw = g.crypto?.randomUUID ? g.crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`
  return `${prefix}${raw.replace(/-/g, '').slice(0, 20)}`
}

export const newCaseId = () => newId('case_')

/** uuid 모양(실행 기록 아이디 · 요청 번호 — 클라우드 표가 uuid) */
export function newUuid(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string; getRandomValues?: (a: Uint8Array) => Uint8Array } }
  if (g.crypto?.randomUUID) return g.crypto.randomUUID()
  const b = new Uint8Array(16)
  if (g.crypto?.getRandomValues) g.crypto.getRandomValues(b)
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/** 짧은 지문(같은 글인지) — 보안용이 아니다 */
export function textHash(s: string): string {
  let h1 = 0x811c9dc5
  let h2 = 0
  const t = s.replace(/\s+/g, ' ').trim()
  for (let i = 0; i < t.length; i++) {
    const c = t.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0
    h2 = (h2 * 31 + c) >>> 0
  }
  return `${h1.toString(16)}${h2.toString(16)}${t.length.toString(16)}`
}

/** 회사 이름 비교용 — (주) · 주식회사 · ㈜ · 띄어쓰기 · 영문 대소문자 */
export function normalizeCompany(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(주\)|㈜|주식회사|유한회사|\(유\)|co\.,?\s*ltd\.?|inc\.?|corp\.?/g, '')
    .replace(/[\s·.,()\-_'"]/g, '')
    .trim()
}

export function normalizeBizNo(v: string): string {
  const d = (v ?? '').replace(/\D/g, '')
  return d.length === 10 ? d : ''
}

/**
 * D-219: DB 고유 규칙(0021 — 주인별 사업자번호 하나 · 고객 하나에 작업실 하나)에 걸리는 작업실.
 * 로컬 저장도 같은 규칙을 지키고, 화면은 새로 만들기 전에 이걸로 미리 알아본다.
 */
export function caseClash(list: readonly CompanyCase[], next: CompanyCase): CompanyCase | null {
  if (next.archivedAt) return null
  return (
    list.find(
      (x) =>
        x.id !== next.id &&
        !x.archivedAt &&
        (x.ownerId ?? null) === (next.ownerId ?? null) &&
        ((!!next.bizNo && x.bizNo === next.bizNo) || (!!next.clientId && x.clientId === next.clientId)),
    ) ?? null
  )
}

/** D-219: 업체 상세에서 열 작업실 — 이 고객과 이은 것 먼저, 없으면 같은 사업자번호로 만든 것(새로 만들면 DB 가 막는다) */
export function findCaseForClient(cases: readonly CompanyCase[], client: { id: string; businessNumber?: string | null }): { linked: CompanyCase | null; sameBiz: CompanyCase | null } {
  const live = cases.filter((c) => !c.archivedAt)
  const linked = live.find((c) => c.clientId === client.id) ?? null
  const biz = normalizeBizNo(client.businessNumber ?? '')
  const sameBiz = linked || !biz ? null : (live.find((c) => c.bizNo === biz) ?? null)
  return { linked, sameBiz }
}

/**
 * D-255 대표 "기존 고객도 여기서 바로 · 타자 없이" — AI 전략실 첫 화면의 '고객 관리에서 고르기' 목록.
 * 아직 작업실과 잇지 않은 고객만(같은 사업자번호로 만든 작업실이 있으면 그것도 이은 것으로 본다) · 보관한 고객 빼고 · 최근에 손댄 순.
 * q 가 있으면 회사명 · 대표/담당자 · 사업자번호(숫자만)로 거른다.
 */
export function clientsToStart<T extends Pick<ClientOpsRecord, 'id' | 'companyName' | 'contactName' | 'businessNumber' | 'archivedAt' | 'updatedAt'>>(
  clients: readonly T[],
  cases: readonly CompanyCase[],
  q = '',
  limit = 8,
): { list: T[]; total: number } {
  const live = cases.filter((c) => !c.archivedAt)
  const linkedIds = new Set(live.map((c) => c.clientId).filter((x): x is string => !!x))
  const caseBiz = new Set(live.map((c) => c.bizNo).filter(Boolean))
  const nq = normalizeCompany(q)
  const dq = q.replace(/\D/g, '')
  const open = clients
    .filter((c) => !c.archivedAt && !linkedIds.has(c.id) && !caseBiz.has(normalizeBizNo(c.businessNumber ?? '')))
    .filter((c) => !q.trim() || (nq && normalizeCompany(c.companyName).includes(nq)) || (c.contactName ?? '').includes(q.trim()) || (dq.length >= 3 && (c.businessNumber ?? '').replace(/\D/g, '').includes(dq)))
    .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
  return { list: open.slice(0, Math.max(1, limit)), total: open.length }
}

export function normalizeUrl(v: string): string {
  const t = (v ?? '').trim()
  if (!t) return ''
  const withScheme = /^https?:\/\//i.test(t) ? t : `https://${t}`
  try {
    const u = new URL(withScheme)
    if (!/\./.test(u.hostname)) return ''
    return `${u.protocol}//${u.hostname}${u.pathname === '/' ? '' : u.pathname}`.replace(/\/+$/, '')
  } catch {
    return ''
  }
}

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/** 여러 회사가 같은 주소(host)를 나눠 쓰는 곳 — 주소 첫 칸(blog.naver.com/한빛식품)까지 봐야 같은 회사다 */
const SHARED_HOSTS = new Set(['blog.naver.com', 'm.blog.naver.com', 'smartstore.naver.com', 'm.smartstore.naver.com', 'cafe.naver.com', 'band.us', 'instagram.com', 'facebook.com', 'm.facebook.com', 'youtube.com', 'm.youtube.com', 'linktr.ee', 'sites.google.com', 'pf.kakao.com', 'x.com', 'twitter.com'])

/**
 * D-219: 홈페이지가 같은지 보는 열쇠 — 보통은 host(경로가 달라도 같은 회사), 함께 쓰는 곳은 host + 첫 칸.
 * 예전엔 host 만 봐서 blog.naver.com 을 쓰는 다른 회사를 '홈페이지 같음 · 새로 만들 수 없음' 으로 막았다.
 */
export function siteKeyOf(url: string): string {
  const host = hostOf(url)
  if (!host || !SHARED_HOSTS.has(host)) return host
  try {
    const first = new URL(url).pathname.split('/').filter(Boolean)[0] ?? ''
    return first ? `${host.replace(/^m\./, '')}/${decodeURIComponent(first).toLowerCase()}` : ''
  } catch {
    return ''
  }
}

export interface DuplicateHit {
  kind: 'case' | 'client'
  id: string
  name: string
  reason: string
  /** 사업자번호 · 홈페이지가 같으면 강함 — 새로 만들기보다 잇기를 먼저 권한다 */
  strong: boolean
  /** 고객이면 이미 이어 둔 Case */
  caseId?: string | null
}

/** 새 업체를 만들기 전에 — 같은 업체가 이미 있으면 그것을 먼저(대표 지시: 중복 업체 DB 금지) */
export function findDuplicates(
  input: { name: string; bizNo?: string; url?: string },
  cases: readonly CompanyCase[],
  clients: readonly Pick<ClientOpsRecord, 'id' | 'companyName' | 'businessNumber' | 'archivedAt'>[],
): DuplicateHit[] {
  const name = normalizeCompany(input.name ?? '')
  const biz = normalizeBizNo(input.bizNo ?? '')
  const host = siteKeyOf(normalizeUrl(input.url ?? ''))
  const out: DuplicateHit[] = []
  const nameMatch = (other: string): string | null => {
    const o = normalizeCompany(other)
    if (!name || !o) return null
    if (o === name) return '회사 이름 같음'
    if (name.length >= 3 && o.length >= 3 && (o.includes(name) || name.includes(o))) return '회사 이름 비슷함'
    return null
  }
  for (const c of cases) {
    if (c.archivedAt) continue
    const reasons: string[] = []
    if (biz && c.bizNo === biz) reasons.push('사업자번호 같음')
    if (host && siteKeyOf(c.homepageUrl) === host) reasons.push('홈페이지 같음')
    const n = nameMatch(c.companyName)
    if (n) reasons.push(n)
    if (reasons.length) out.push({ kind: 'case', id: c.id, name: c.companyName, reason: reasons.join(' · '), strong: reasons.some((r) => r !== '회사 이름 비슷함') })
  }
  for (const c of clients) {
    if (c.archivedAt) continue
    const reasons: string[] = []
    if (biz && normalizeBizNo(c.businessNumber ?? '') === biz) reasons.push('사업자번호 같음')
    const n = nameMatch(c.companyName)
    if (n) reasons.push(n)
    if (reasons.length) {
      const linked = cases.find((x) => x.clientId === c.id && !x.archivedAt)
      out.push({ kind: 'client', id: c.id, name: c.companyName, reason: reasons.join(' · '), strong: reasons.some((r) => r !== '회사 이름 비슷함'), caseId: linked?.id ?? null })
    }
  }
  return out.sort((a, b) => Number(b.strong) - Number(a.strong))
}

/** 고객 상태 → 관계 상태(고객과 이어 만들 때 처음 값) */
export function relationForClient(record: Pick<ClientOpsRecord, 'contract' | 'sales'>): CaseRelation {
  if (record.contract?.signedAt) return 'contracted'
  return record.sales ? 'prospect' : 'reviewed'
}

/* ---------------- 타임라인(고객 관리 활동 기록과 같은 모양) ---------------- */

const ACTIVITY_LIMIT = 300

export function withCaseActivity(c: CompanyCase, text: string, at: string): CompanyCase {
  const entry: ActivityEntry = { id: newId('act_'), kind: 'tool', text, serviceKey: null, at }
  return { ...c, activity: [entry, ...c.activity].slice(0, ACTIVITY_LIMIT), updatedAt: at }
}

/* ---------------- 자료 ---------------- */

/** 개인별 4대보험 원문(명부) 모양 — AI 에 보내지 않는다 */
export function looksLikeRosterText(text: string, fileName = ''): boolean {
  if (/명부|가입자\s*명부|4대\s*보험|사업장\s*가입자/.test(fileName)) return true
  const hits = (text.match(/취득일|상실일|피보험자|자격취득|보험료\s*부과|고용보험\s*관리번호/g) ?? []).length
  return hits >= 3
}

/** 저장 전에 — 주민번호 · 비밀번호 · 키 · 계좌 · 휴대폰을 지운다(원문을 남기지 않는다) */
export function safeMaterialText(text: string): string {
  return redactSensitive(stripRrn(text ?? '')).text.replace(/\u0000/g, '').slice(0, 60000)
}

export function makeMaterial(input: { kind: MaterialKind; title: string; text: string; fileName?: string; fileSize?: number; storagePath?: string; url?: string; source?: string }, at: string): CaseMaterial {
  const text = safeMaterialText(input.text)
  const roster = looksLikeRosterText(text, input.fileName ?? input.title)
  return {
    id: newId('mat_'),
    kind: input.kind,
    // 제목도 원문에서 따올 수 있다(메모 첫 줄) — 본문과 같이 지운다
    title: safeMaterialText(input.title).trim().slice(0, 120) || '자료',
    text,
    chars: text.length,
    hash: textHash(text || `${input.fileName ?? ''}|${input.fileSize ?? ''}|${input.url ?? ''}`),
    ...(input.fileName ? { fileName: input.fileName } : {}),
    ...(input.fileSize ? { fileSize: input.fileSize } : {}),
    ...(input.storagePath ? { storagePath: input.storagePath } : {}),
    ...(input.url ? { url: input.url } : {}),
    ...(input.source ? { source: input.source } : {}),
    ...(roster ? { excluded: '4대보험 명부(개인별 원문) — AI 에 보내지 않음' } : {}),
    addedAt: at,
  }
}

/** 같은 자료가 이미 있나(글 지문 · 파일 이름+크기 · 주소) */
export function sameMaterial(list: readonly CaseMaterial[], m: Pick<CaseMaterial, 'hash' | 'fileName' | 'fileSize' | 'url'>): CaseMaterial | null {
  return (
    list.find((x) => x.hash === m.hash) ??
    (m.fileName ? list.find((x) => x.fileName === m.fileName && x.fileSize === m.fileSize) : undefined) ??
    (m.url ? list.find((x) => x.url && normalizeUrl(x.url) === normalizeUrl(m.url ?? '')) : undefined) ??
    null
  )
}

/** 파일 이름 · 글로 자료 종류 고르기(모르면 기타) */
export function guessMaterialKind(fileName: string, text: string): MaterialKind {
  const s = `${fileName} ${text.slice(0, 600)}`
  if (/사업자\s*등록증/.test(s)) return 'bizreg'
  if (/등기사항|법인\s*등기|등기부/.test(s)) return 'registry'
  if (/크레탑|기업\s*정보|기업정보|nice|신용\s*평가/i.test(s)) return 'company_info'
  if (/회사\s*소개|company\s*profile|ir\s*자료|소개서/i.test(s)) return 'intro'
  if (/사업\s*계획/.test(s)) return 'bizplan'
  if (/특허|출원|등록\s*번호\s*제?\s*10-/.test(s)) return 'patent'
  if (/제안서|제안\s*자료/.test(s)) return 'proposal'
  if (/\.(png|jpe?g|webp|gif|bmp)$/i.test(fileName)) return 'image'
  return 'other'
}

const FACT_KEYS: readonly CaseFactKey[] = ['industry', 'founded', 'ceo', 'employees', 'revenue', 'homepage', 'mainProblem', 'currentSystem', 'coreBusiness']

/**
 * 자료 요약(SNAPSHOT_EXTRACT)을 채택했을 때 — 자료에 있던 값만 업체 정보 칸으로(미확인 · 빈 값은 건너뛴다).
 * 이미 적힌 칸은 덮지 않는다(대표가 직접 고친 값이 먼저).
 */
export function factsFromExtract(structured: unknown, current: CompanyCase['facts'], at: string): CompanyCase['facts'] {
  const facts = structured && typeof structured === 'object' && Array.isArray((structured as { facts?: unknown }).facts) ? ((structured as { facts: unknown[] }).facts) : []
  const out: CompanyCase['facts'] = { ...current }
  for (const f of facts) {
    if (!f || typeof f !== 'object') continue
    const key = String((f as { key?: unknown }).key ?? '').trim() as CaseFactKey
    const value = String((f as { value?: unknown }).value ?? '').trim().slice(0, 300)
    if (!FACT_KEYS.includes(key) || !value || value === '미확인' || out[key]?.value) continue
    out[key] = { value, source: String((f as { source?: unknown }).source ?? '').trim().slice(0, 80) || '자료 요약', at }
  }
  return out
}

export function emptyCase(input: { id?: string; companyName: string; relation?: CaseRelation; workspaceId?: string | null; ownerId?: string | null; at: string }): CompanyCase {
  return {
    id: input.id ?? newCaseId(),
    workspaceId: input.workspaceId ?? null,
    ownerId: input.ownerId ?? null,
    companyName: input.companyName.trim(),
    relation: input.relation ?? 'reviewed',
    clientId: null,
    bizNo: '',
    homepageUrl: '',
    requester: '',
    industry: '',
    memo: '',
    materials: [],
    facts: {},
    activity: [],
    contextVersion: 0,
    origin: '',
    createdAt: input.at,
    updatedAt: input.at,
    archivedAt: null,
  }
}
