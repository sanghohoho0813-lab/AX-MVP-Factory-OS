/**
 * D-550 SYNC-5 '다른 기기 때문에 덮인 내용' 을 화면에 보여 주는 모양 — 규칙만(외부 호출 0).
 *
 * 보관 줄(D-535)은 모듈 · 갈래 · 내용(payload)뿐이라 그대로는 무엇인지 모른다.
 * 여기서 사람이 읽는 이름(어느 기록인지) · 열어 볼 화면 · 지금 내용과 달라진 곳(최대 3곳 · 앞부분만)을 만든다.
 * 내부 키 이름은 화면에 쓰지 않는다 — 달라진 글만 '그때 / 지금' 으로.
 */
import type { OverwrittenEntry } from './moduleData'
import { specHref } from './patent/pvBoard'

const BUCKET_LABEL: Record<string, Record<string, string>> = {
  'patent-draft': { draft: '특허 명세서' },
  'cert-os': { profile: '기업인증 회사 정보', work: '기업인증 준비', life: '기업인증 유지 관리' },
  labcare: { orig: '연구소 관리' },
  cretop: { analyses: '크레탑 분석' },
  'policy-funding': { consults: '정책자금 상담 기록' },
}
const MODULE_LABEL: Record<string, string> = {
  'patent-draft': '특허 명세서',
  'cert-os': '기업인증',
  labcare: '연구소 관리',
  cretop: '크레탑 분석',
  'policy-funding': '정책자금',
}
const CERT_NAME: Record<string, string> = {
  venture: '벤처',
  lab: '연구소',
  innobiz: '이노비즈',
  mainbiz: '메인비즈',
  iso9001: 'ISO 9001',
  iso14001: 'ISO 14001',
  iso45001: 'ISO 45001',
}

/** '특허 명세서' · '기업인증 준비' … 모르는 모듈은 '모듈 기록' */
export function kindLabel(e: Pick<OverwrittenEntry, 'moduleKey' | 'bucket'>): string {
  return BUCKET_LABEL[e.moduleKey]?.[e.bucket] ?? MODULE_LABEL[e.moduleKey] ?? '모듈 기록'
}

const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const clip = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t)

/** 기록 이름 한 줄 — 명세서 제목 · 회사 · 인증 이름 등 있는 것 하나(없으면 '') */
export function recordTitle(e: Pick<OverwrittenEntry, 'data'>): string {
  const d = e.data ?? {}
  const draft = (d.draft ?? {}) as Record<string, unknown>
  const profile = (d.profile ?? {}) as Record<string, unknown>
  const cert = CERT_NAME[s(d.cert)] ?? ''
  const t = s(draft.title) || s(d.title) || s(d.company) || s(d.companyName) || s(profile.companyName) || s(d.name) || (cert ? `${cert} 인증` : '')
  return clip(t, 40)
}

/** 열어 볼 화면(모르면 '') */
export function openHref(e: Pick<OverwrittenEntry, 'moduleKey' | 'originalId' | 'clientId'>): string {
  switch (e.moduleKey) {
    case 'patent-draft':
      return specHref(e.originalId, e.clientId)
    case 'cert-os':
      return '/tools/cert-os'
    case 'labcare':
      return '/tools/labcare'
    case 'cretop':
      return '/tools/cretop'
    case 'policy-funding':
      return '/tools/policy-funding'
    default:
      return ''
  }
}

type Leaf = string | number | boolean | null

/** 글 · 숫자 칸을 길(path) → 값으로 펼친다(깊이 8 · 6,000칸까지 — 큰 기록에서 멈추지 않게) */
function leaves(v: unknown, path: string, out: Map<string, Leaf>, depth: number): void {
  if (out.size >= 6000) return
  if (v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
    out.set(path, v)
    return
  }
  if (depth > 8 || typeof v !== 'object') return
  if (Array.isArray(v)) v.forEach((x, i) => leaves(x, `${path}[${i}]`, out, depth + 1))
  else for (const [k, x] of Object.entries(v as Record<string, unknown>)) leaves(x, path ? `${path}.${k}` : k, out, depth + 1)
}

export interface DiffSample {
  /** 그때(보관한 판) */
  then: string
  /** 지금 */
  now: string
}

/**
 * 보관한 판과 지금 내용의 달라진 곳 — 칸 수 · 글이 다른 곳 앞 3개.
 * 지금 줄이 없으면(지워짐) now = null → removed: true.
 */
export function diffSummary(then: Record<string, unknown>, now: Record<string, unknown> | null, max = 3): { count: number; samples: DiffSample[]; removed: boolean } {
  if (!now) return { count: 0, samples: [], removed: true }
  const a = new Map<string, Leaf>()
  const b = new Map<string, Leaf>()
  leaves(then, '', a, 0)
  leaves(now, '', b, 0)
  const keys = new Set([...a.keys(), ...b.keys()])
  let count = 0
  const samples: DiffSample[] = []
  const show = (v: Leaf | undefined) => (v === undefined || v === null || v === '' ? '(비어 있음)' : typeof v === 'boolean' ? (v ? '예' : '아니요') : clip(String(v).replace(/\s+/g, ' ').trim(), 80))
  for (const k of keys) {
    const x = a.get(k)
    const y = b.get(k)
    if (x === y || ((x === undefined || x === null || x === '') && (y === undefined || y === null || y === ''))) continue
    count += 1
    // 시각 · id 같은 칸은 세기만 하고 보여 주지 않는다(사람이 고친 글이 먼저 보이게)
    if (samples.length < max && /(^|\.)(updatedAt|savedAt|ts|id|v)$/.test(k) === false) samples.push({ then: show(x), now: show(y) })
  }
  return { count, samples, removed: false }
}

/** '11월 6일 14:03' — 같은 해면 해를 뺀다 */
export function whenLabel(iso: string, today: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso)
  if (!m) return iso.slice(0, 10)
  const d = new Date(iso)
  const local = Number.isNaN(d.getTime())
    ? { y: m[1], mo: Number(m[2]), da: Number(m[3]), h: m[4], mi: m[5] }
    : { y: String(d.getFullYear()), mo: d.getMonth() + 1, da: d.getDate(), h: String(d.getHours()).padStart(2, '0'), mi: String(d.getMinutes()).padStart(2, '0') }
  const year = local.y === today.slice(0, 4) ? '' : `${local.y}년 `
  return `${year}${local.mo}월 ${local.da}일 ${local.h}:${local.mi}`
}
