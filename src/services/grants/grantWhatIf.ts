/**
 * D-556 지원사업 상황 예시 — '한 가지만 갖추면 더 맞는 공고'.
 *
 * 받아 둔 공고(지금 접수 중) 가운데 이 업체에 '안 맞음' 인 것을 하나씩 보고, 안 맞는 까닭이 **한 가지뿐이고 업체가 갖출 수 있는 것**이면
 * (인증 하나 · 직원 수) 그것을 갖춘 업체로 다시 판정한다. 다시 판정해서 '조건 맞음 · 확인 필요' 가 되는 공고만 센다.
 *
 *  - 판정은 공고 맞추기(matchGrant) 그대로 — 요건을 새로 짓지 않는다(공고에 적힌 조건만 · 지어낸 기준 0).
 *  - 지역 · 업력 · 업종 · 매출 · 대표 나이처럼 업체가 바로 바꿀 수 없는 조건은 세지 않는다.
 *  - 안 맞는 까닭이 둘 이상(인증 + 직원 수)이면 '한 가지만' 이 아니라 세지 않는다.
 *  - 규칙 계산이다(AI 아님). 저장하지 않고 볼 때마다 계산한다.
 */
import { CERT_LABEL, daysBetween, deadlineOf, exact, matchGrant, verdictRank, deadlineRank, type CertKey, type CompanyProfile, type GrantMatch, type GrantNotice } from './grantMatch'
import { sectionHref } from '../../certification/ui/certNav'
import type { ClientOpsRecord } from '../../types/clientOps'
import { certExpiries, credentialsOf, profileOfRecord } from './grantProfile'

export interface GrantWhatIf {
  /** 'cert:venture' · 'employees:5' */
  key: string
  /** '벤처기업 확인을 받으면' */
  label: string
  /** 칩에 쓰는 짧은 이름 — '벤처 확인' */
  short: string
  /** 그렇게 되면 새로 맞는 공고(조건 맞음 먼저 · 마감 급한 순) */
  gained: GrantMatch[]
  /** 그중 '조건 맞음' 수 */
  fit: number
  /** 예전에 있었는데 만료된 인증이면 true — '다시 받으면' */
  renew: boolean
  /** 이어서 준비할 곳(없으면 null) */
  next: { label: string; href: string } | null
}

const CERT_ACTION: Record<CertKey, { label: string; renew: string; short: string; section: string | null }> = {
  venture: { label: '벤처기업 확인을 받으면', renew: '벤처기업 확인을 다시 받으면', short: '벤처 확인', section: 'venture' },
  innobiz: { label: '이노비즈 인증을 받으면', renew: '이노비즈 인증을 다시 받으면', short: '이노비즈', section: 'innobiz' },
  mainbiz: { label: '메인비즈 인증을 받으면', renew: '메인비즈 인증을 다시 받으면', short: '메인비즈', section: 'mainbiz' },
  lab: { label: '기업부설연구소(전담부서)를 세우면', renew: '연구소 인정을 다시 받으면', short: '연구소', section: 'lab' },
  women: { label: '여성기업 확인을 받으면', renew: '여성기업 확인을 다시 받으면', short: '여성기업', section: null },
}

/** 업체가 갖출 수 있는 '안 맞음' 까닭 — 이것만 있을 때 센다 */
const FIXABLE = new Set(['certs', 'employees'])

/**
 * 한 가지만 갖추면 더 맞는 공고 — 많이 생기는 것 먼저.
 * opts.expired: 만료된 인증(credentialsOf) — '다시 받으면' 으로 · opts.clientId: 이어서 준비할 곳 주소
 */
export function grantWhatIfs(notices: readonly GrantNotice[], p: CompanyProfile, today: string, opts: { expired?: readonly CertKey[]; clientId?: string | null } = {}): GrantWhatIf[] {
  const groups = new Map<string, GrantWhatIf>()
  const clientId = opts.clientId ?? null
  const expired = new Set(opts.expired ?? [])
  const add = (key: string, base: Omit<GrantWhatIf, 'gained' | 'fit'>, m: GrantMatch) => {
    const g = groups.get(key) ?? { ...base, gained: [], fit: 0 }
    if (!g.gained.some((x) => x.notice.id === m.notice.id)) {
      g.gained.push(m)
      if (m.verdict === 'fit') g.fit += 1
    }
    groups.set(key, g)
  }
  for (const n of notices) {
    const deadline = deadlineOf(n, today)
    if (deadline.state === 'closed' || deadline.state === 'upcoming') continue
    const now = matchGrant(n, p, today, deadline)
    if (now.verdict !== 'no') continue
    const no = now.reasons.filter((r) => r.state === 'no')
    // 안 맞는 까닭이 한 가지(업체가 갖출 수 있는 것)일 때만
    if (no.length !== 1 || !FIXABLE.has(no[0].key)) continue
    if (no[0].key === 'certs') {
      for (const c of n.rules.certs) {
        if (p.certs.includes(c)) continue
        // 여성기업 확인은 여성 대표만 — 남성 대표로 확인된 업체에는 보이지 않는다
        if (c === 'women' && p.female === false) continue
        const after = matchGrant(n, { ...p, certs: [...p.certs, c], certsKnown: true }, today, deadline)
        if (after.verdict === 'no') continue
        const a = CERT_ACTION[c]
        const renew = expired.has(c)
        add(`cert:${c}`, { key: `cert:${c}`, label: renew ? a.renew : a.label, short: a.short, renew, next: a.section ? { label: `기업인증 › ${CERT_LABEL[c]}에서 준비`, href: sectionHref(a.section, clientId) } : null }, after)
      }
    } else {
      const min = n.rules.minEmployees
      // 직원이 적어서 안 맞는 것만(많아서 안 맞는 것은 줄일 일이 아니다)
      if (min === null || !p.employees || p.employees.hi >= min) continue
      const after = matchGrant(n, { ...p, employees: exact(min) }, today, deadline)
      if (after.verdict === 'no') continue
      const more = min - p.employees.hi
      add(
        `employees:${min}`,
        {
          key: `employees:${min}`,
          label: `직원이 ${min}명이 되면(지금보다 ${more}명 더)`,
          short: `직원 ${min}명`,
          renew: false,
          next: clientId ? { label: '채용하면 받는 고용지원금 함께 보기', href: `/tools/employment/diagnosis?client=${encodeURIComponent(clientId)}&preset=emp-youth` } : null,
        },
        after,
      )
    }
  }
  const out = [...groups.values()]
  for (const g of out) g.gained.sort((a, b) => verdictRank(a.verdict) - verdictRank(b.verdict) || deadlineRank(a.deadline) - deadlineRank(b.deadline) || a.notice.title.localeCompare(b.notice.title))
  return out.sort((a, b) => b.gained.length - a.gained.length || b.fit - a.fit || a.key.localeCompare(b.key))
}

/** '벤처 확인 +3 · 연구소 +1' — 접힌 줄 · 맞춤 추천 한 줄 */
export function whatIfLine(list: readonly GrantWhatIf[], max = 3): string {
  return list
    .slice(0, max)
    .map((w) => `${w.short} +${w.gained.length}`)
    .join(' · ')
}

/* ------------------------------------------------------------------ */
/* D-557 인증이 곧 끝나면 — 갱신하지 않으면 못 하는 공고                       */
/* ------------------------------------------------------------------ */

export interface GrantRenewalRisk {
  cert: CertKey
  /** 인증 끝나는 날 */
  until: string
  daysLeft: number
  /** 갱신하지 않으면 못 하는 공고 — 지금은 맞는데(맞음 · 확인 필요) 이 인증이 빠지면 '안 맞음', 접수가 끝나는 날보다 먼저 인증이 끝나는 것 */
  lost: GrantMatch[]
  next: { label: string; href: string } | null
}

/** 이만큼 남았을 때부터 알린다(갱신 준비 기간) */
export const RENEWAL_WARN_DAYS = 120

/**
 * 곧 끝나는 인증(오늘 ~ 120일 안)마다, 그 인증 덕분에 지금 맞는 공고 가운데 접수 마감이 인증 끝나는 날보다 늦은 것(또는 상시 · 선착순).
 * 같은 판정 규칙(matchGrant)으로 '그 인증이 없는 업체' 를 다시 판정한다 — 다른 인증으로도 맞으면 세지 않는다.
 */
export function grantRenewalRisks(notices: readonly GrantNotice[], p: CompanyProfile, today: string, expiries: Partial<Record<CertKey, string>>, opts: { clientId?: string | null } = {}): GrantRenewalRisk[] {
  const out: GrantRenewalRisk[] = []
  for (const [cert, until] of Object.entries(expiries) as [CertKey, string][]) {
    if (!until || !p.certs.includes(cert)) continue
    const daysLeft = daysBetween(today, until)
    if (daysLeft === null || daysLeft < 0 || daysLeft > RENEWAL_WARN_DAYS) continue
    const lost: GrantMatch[] = []
    const without = { ...p, certs: p.certs.filter((c) => c !== cert) }
    for (const n of notices) {
      if (!n.rules.certs.includes(cert)) continue
      const deadline = deadlineOf(n, today)
      if (deadline.state === 'closed') continue
      // 인증이 끝나기 전에 접수가 끝나는 공고는 갱신과 상관없다
      if (n.deadlineKind === 'date' && n.applyEnd && n.applyEnd <= until) continue
      const now = matchGrant(n, p, today, deadline)
      if (now.verdict === 'no') continue
      if (matchGrant(n, without, today, deadline).verdict !== 'no') continue
      lost.push(now)
    }
    if (!lost.length) continue
    const section = CERT_ACTION[cert].section
    lost.sort((a, b) => verdictRank(a.verdict) - verdictRank(b.verdict) || deadlineRank(a.deadline) - deadlineRank(b.deadline))
    out.push({ cert, until, daysLeft, lost, next: section ? { label: `기업인증 › ${CERT_LABEL[cert]} 갱신 준비`, href: sectionHref(section, opts.clientId ?? null) } : null })
  }
  return out.sort((a, b) => a.until.localeCompare(b.until))
}

/** '벤처기업 확인이 2026-12-20에 끝나요(41일 남음) — 갱신하지 않으면 공고 2건을 못 해요' */
export function renewalRiskLine(r: GrantRenewalRisk): string {
  return `${CERT_LABEL[r.cert]} ${r.cert === 'lab' ? '인정' : r.cert === 'venture' || r.cert === 'women' ? '확인' : '인증'}이 ${r.until}에 끝나요(${r.daysLeft}일 남음) — 갱신하지 않으면 공고 ${r.lost.length}건을 못 해요`
}

/* ------------------------------------------------------------------ */
/* D-557 기업인증 화면 — 이 인증과 지금 열린 지원사업                            */
/* ------------------------------------------------------------------ */

export interface CertGrantView {
  cert: CertKey
  held: boolean
  /** 없는 인증: 받으면 새로 맞는 공고 · 있는 인증: 이 인증 덕분에 지금 맞는 공고 */
  matches: GrantMatch[]
  /** 있는 인증이 곧 끝날 때 — 갱신하지 않으면 못 하는 공고 줄 */
  risk: string
  riskCount: number
}

/** 화면 없이 계산만(시험 · 다른 화면) */
export function certGrantView(cert: CertKey, record: ClientOpsRecord, notices: readonly GrantNotice[], today: string, validUntil?: string | null): CertGrantView {
  const p = profileOfRecord(record, today)
  const held = p.certs.includes(cert)
  if (!held) {
    const w = grantWhatIfs(notices, p, today, { expired: credentialsOf(record, today).expired, clientId: record.id }).find((x) => x.key === `cert:${cert}`)
    return { cert, held, matches: w?.gained ?? [], risk: '', riskCount: 0 }
  }
  // 이 인증 덕분에 맞는 공고 — 인증이 빠지면 '안 맞음' 이 되는 것
  const without = { ...p, certs: p.certs.filter((c) => c !== cert) }
  const matches: GrantMatch[] = []
  for (const n of notices) {
    if (!n.rules.certs.includes(cert)) continue
    const deadline = deadlineOf(n, today)
    if (deadline.state === 'closed' || deadline.state === 'upcoming') continue
    const now = matchGrant(n, p, today, deadline)
    if (now.verdict === 'no' || matchGrant(n, without, today, deadline).verdict !== 'no') continue
    matches.push(now)
  }
  matches.sort((a, b) => verdictRank(a.verdict) - verdictRank(b.verdict) || deadlineRank(a.deadline) - deadlineRank(b.deadline))
  const until = validUntil || certExpiries(record, today)[cert] || ''
  const r = until ? grantRenewalRisks(notices, p, today, { [cert]: until }, { clientId: record.id })[0] : undefined
  return { cert, held, matches, risk: r ? renewalRiskLine(r) : '', riskCount: r?.lost.length ?? 0 }
}

