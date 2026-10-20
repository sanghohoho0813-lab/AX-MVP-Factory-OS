/**
 * 기업인증 화면 ↔ OS (D-170 · P1) — 지금 연 업체 · 업체 사정(칩) · 자가진단 · 실사 준비 · 진행 기록을 읽고 저장한다.
 * 모듈 기록(`cert-os`)에 두고, 업체 기록은 사람이 누른 것만 고친다:
 *   - [회사 정보에 확인된 사실로 저장] → 사실 창고(특허 · 연구소) '확인됨'
 *   - [인증 완료 기록] → 회사 정보 '인증서' 칸 + 갱신 일정(달력 · 오늘) + 활동 기록
 *   - 진행 상태 바꾸기 → 활동 기록 한 줄
 *   - [고객에게 자료 요청] → 서류함에 빈 칸(없는 것만)
 * 새 표 · 마이그레이션 없음.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useToolClient } from '../../tools/shared/toolClientContext'
import { useModuleBucket } from '../../tools/shared/useModuleBucket'
import { nowIso, todayLocalDate } from '../../lib/appClock'
import { listClients, saveClient, withCustomField, withToolResult } from '../../services/clientOpsService'
import { withActivity } from '../../services/clientOpsActivity'
import { withFactValue } from '../../services/customerFacts'
import { withDocSlots } from '../../services/salesMeeting'
import type { ClientOpsRecord } from '../../types/clientOps'
import { assessAll } from '../core/assess'
import { buildRoadmap } from '../core/roadmap'
import type { Answer } from '../core/selfCheck'
import type { PreparedAnswer } from '../core/inspection'
import type { CertificationKey } from '../core/types'
import { CERT_STATUS_LABEL, normalizeLifecycle, withCertStatus, withCompletion, type CertLifecycle, type CertStatus, type CompletionInput } from '../core/lifecycle'
import { renewalDeadlines, renewalPlan } from '../core/renewal'
import { CERT_RULES } from '../rules/officialRules'
import { certContextOf, certKeyOf, factPatchValue, normalizeCertProfile, type CertProfile } from './clientContext'
import { labcareFactsOf } from './labcareAdapter'
import { legacyVentureFactsOf } from './legacyConsulting'
import { listProjectsForClient } from '../../services/consultingStudioService'
import type { ConsultingProject } from '../../types/consulting'

export const CERT_MODULE = 'cert-os'

type ProfileRow = { profile: CertProfile } & Record<string, unknown>
type WorkRow = { cert: CertificationKey; answers: Record<string, Answer>; prep: Record<string, PreparedAnswer>; notes?: Record<string, string> } & Record<string, unknown>
type LifeRow = { cert: CertificationKey; life: CertLifecycle } & Record<string, unknown>

/**
 * 인증별 회사 정보 '인증서' 칸 이름 — 확인서 PDF 를 올렸을 때 서류 읽기(certDocParser)가 붙이는 이름과 같게 둔다.
 * 그래야 서류 먼저 · 진행 기록 먼저 어느 쪽이든 한 칸으로 모인다(P1 릴리스 확인: 중복 칸 방지).
 */
export const CERT_DOC_LABEL: Record<CertificationKey, string> = {
  venture: '벤처기업',
  innobiz: '이노비즈',
  mainbiz: '메인비즈',
  lab: '기업부설연구소',
  iso9001: 'ISO 9001',
  iso14001: 'ISO 14001',
  iso45001: 'ISO 45001',
}

/**
 * 회사 정보 '인증서' 칸 값 — 서류에서 읽은 값과 같은 꼴(번호 · 인증일 · 끝날짜 · 기관).
 * 이미 있던 칸이면 번호 · 날짜 · 끝날짜는 진행 기록 값으로 바꾸고, 기관처럼 진행 기록에 없는 조각은 남긴다.
 */
export function credentialValue(cert: CertificationKey, l: CertLifecycle, existing = ''): string {
  const verb = cert === 'venture' ? '확인' : cert === 'lab' ? '인정' : '인증'
  const mine = [l.number && `${verb}번호 ${l.number}`, l.certifiedAt && `${verb}일 ${l.certifiedAt}`, l.validUntil && `${l.validUntil}까지`].filter(Boolean) as string[]
  const keep = existing
    .split(' · ')
    .map((x) => x.trim())
    .filter((x) => x && x !== '있음' && !/번호|(인정|확인|인증|등록|지정)일|까지|만료|\d{4}-\d{2}-\d{2}/.test(x))
  return [...mine, ...keep].join(' · ')
}

/**
 * 인증 완료 → 업체 기록(순수 함수 · 시험 가능): 회사 정보 '인증서' 칸(같은 인증이면 한 칸으로) + 갱신 일정(결과 묶음 · 달력 · 오늘).
 */
export function withCertCompletion(record: ClientOpsRecord, cert: CertificationKey, life: CertLifecycle, opts: { toProfile: boolean; today: string; clientId: string }): ClientOpsRecord {
  const rule = CERT_RULES[cert]
  let rec = record
  if (opts.toProfile) {
    const existing = (rec.customFields ?? []).find((f) => f.group === 'credential' && certKeyOf(f.label) === cert)
    const value = credentialValue(cert, life, existing?.value ?? '')
    if (value && value !== existing?.value) rec = withCustomField(rec, { id: existing?.id, group: 'credential', label: existing?.label ?? CERT_DOC_LABEL[cert], value })
  }
  const plan = life.validUntil ? renewalPlan(cert, life.validUntil, opts.today) : null
  const title = `${rule.label} 인증 · 갱신`
  // 인증 정보를 고쳐 다시 저장하면 앞 결과(갱신 할 일 포함)를 바꾼다 — 달력 · 오늘에 같은 할 일이 두 번 뜨지 않게
  // D-214: 단계 4 '유효기간 · 갱신' 으로 붙인 결과(제목이 다름)의 계산 기한도 내린다 — 같은 만료일이 두 번 뜨고, 갱신을 기록한 뒤에도 옛 주기의 '유효기간 끝' 이 남아 '기한 지남' 으로 떴다.
  //   사람이 건 할 일(todo)은 남긴다(D-134).
  const isAttachedRenewal = (t: { toolKey: string; data?: unknown }) => {
    const d = (t.data ?? {}) as { kind?: unknown; cert?: unknown }
    return t.toolKey === CERT_MODULE && d.kind === 'renewal' && d.cert === cert
  }
  rec = {
    ...rec,
    toolResults: (rec.toolResults ?? [])
      .filter((t) => !(t.toolKey === CERT_MODULE && t.title === title))
      // 예전 화면이 계산한 '갱신 준비 시작' 에 할 일 표시를 붙여 두었다 — 사람이 건 것이 아니니 같이 내린다
      .map((t) => {
        if (!isAttachedRenewal(t)) return t
        const keep = t.deadlines.filter((d) => d.todo && !d.title.endsWith('갱신 준비 시작'))
        return keep.length === t.deadlines.length ? t : { ...t, deadlines: keep }
      }),
  }
  return withToolResult(rec, {
    toolKey: CERT_MODULE,
    title,
    verdict: 'held',
    verdictLabel: '인증 완료',
    summary: [`${rule.label} 인증 완료`, life.certifiedAt && `인증일 ${life.certifiedAt}`, life.validUntil ? `${life.validUntil}까지` : rule.validYears ? '유효기간 미입력' : '', plan ? `갱신 준비 ${plan.noticeOn}부터` : ''].filter(Boolean).join(' · '),
    data: { kind: 'certified', cert, number: life.number, certifiedAt: life.certifiedAt, validUntil: life.validUntil },
    deadlines: plan ? renewalDeadlines(plan, rule.label) : [],
    openPath: `/tools/cert-os/${cert}?client=${opts.clientId}`,
  })
}

/** 칩으로 고른 사실 → 사실 창고 값(사실 창고에 칸이 있는 것만: 특허 · 연구소) */
export function factPatchOf(p: CertProfile): { key: 'patents' | 'researchLab'; value: string; label: string }[] {
  const out: { key: 'patents' | 'researchLab'; value: string; label: string }[] = []
  if (p.patents !== null) out.push({ key: 'patents', value: factPatchValue('patents', p), label: '특허' })
  if (p.researchUnit !== null) out.push({ key: 'researchLab', value: factPatchValue('researchLab', p), label: '연구소' })
  return out
}

export function useCertData() {
  const { clientId, clientRecord, clientName, replaceClient, workspaceId } = useToolClient()
  const profiles = useModuleBucket<ProfileRow>(CERT_MODULE, 'profile')
  const works = useModuleBucket<WorkRow>(CERT_MODULE, 'work')
  const lifeRows = useModuleBucket<LifeRow>(CERT_MODULE, 'life')
  // P1: 연구소 관리가 이미 아는 것(인정 · 연구전담요원 수)을 다시 묻지 않는다
  const labRows = useModuleBucket<Record<string, unknown>>('labcare', 'orig')
  const today = todayLocalDate()

  const profileRow = clientId ? (profiles.rows ?? []).find((r) => r.clientId === clientId) ?? null : null
  const profile = useMemo(() => normalizeCertProfile(profileRow?.data.profile), [profileRow])
  const lab = useMemo(() => (clientId ? labcareFactsOf(labRows.rows, clientId) : null), [labRows.rows, clientId])
  const lives = useMemo(
    () => (clientId ? (lifeRows.rows ?? []).filter((r) => r.clientId === clientId && CERT_RULES[r.data.cert]).map((r) => normalizeLifecycle(r.data.life, r.data.cert)) : []),
    [lifeRows.rows, clientId],
  )
  // AX Hotfix(LEGACY): 예전 '특허+벤처' 컨설팅 프로젝트에 남은 특허 · 사업계획 · 신청 기록을 읽기만 한다 — 그 화면으로 보내지 않는다
  const [legacyProjects, setLegacyProjects] = useState<ConsultingProject[] | null>(null)
  useEffect(() => {
    if (!clientId) return
    let alive = true
    listProjectsForClient(workspaceId, clientId)
      .then((l) => alive && setLegacyProjects(l))
      .catch(() => alive && setLegacyProjects([]))
    return () => {
      alive = false
    }
  }, [workspaceId, clientId])
  const legacy = useMemo(() => (clientId ? legacyVentureFactsOf(legacyProjects, clientId) : null), [legacyProjects, clientId])
  const ctx = useMemo(() => (clientRecord ? certContextOf(clientRecord, today, profile, { lab, lives, legacy }) : null), [clientRecord, today, profile, lab, lives, legacy])
  const list = useMemo(() => (ctx ? assessAll(ctx) : []), [ctx])
  const roadmap = useMemo(() => (ctx ? buildRoadmap(list, ctx) : { steps: [], later: [] }), [ctx, list])

  /*
   * D-214: 칩 · 자가진단 답 · 대표 답 · 진행 상태를 빨리 연달아 눌러도 앞 것이 지워지지 않게 —
   *   저장을 한 줄로 세우고(앞 저장이 끝난 뒤에), 저장할 때마다 바로 앞에 저장한 값 위에 덧붙인다.
   *   예전: 화면을 그린 때의 값으로 저장 내용을 만들어, 칩 1 저장이 끝나기 전에 칩 2 를 누르면 칩 1 이 사라졌고,
   *   모듈 기록을 읽기 전에 저장하면 같은 업체 줄이 하나 더 생겨 원래 줄을 가렸다(loaded 전에는 저장하지 않음).
   */
  const chain = useRef<Promise<unknown>>(Promise.resolve())
  const pending = useRef(0)
  const latest = useRef(new Map<string, { id?: string; data: unknown }>())
  const serial = useCallback(<R,>(job: () => Promise<R>): Promise<R> => {
    pending.current += 1
    const run = chain.current.catch(() => undefined).then(job)
    chain.current = run
      .catch(() => undefined)
      .finally(() => {
        pending.current -= 1
        if (pending.current === 0) latest.current.clear()
      })
    return run
  }, [])
  const loaded = profiles.rows !== null && works.rows !== null && lifeRows.rows !== null
  /** D-225 모듈 기록을 못 읽었으면 그 까닭 — 화면이 '읽는 중…' 에서 멈추지 않고 [다시 읽기] 를 보인다 */
  const loadError = loaded ? null : (profiles.error ?? works.error ?? lifeRows.error)
  const reloadAll = useCallback(async () => {
    await Promise.all([profiles.error || profiles.rows === null ? profiles.reload() : null, works.error || works.rows === null ? works.reload() : null, lifeRows.error || lifeRows.rows === null ? lifeRows.reload() : null])
  }, [profiles, works, lifeRows])

  const saveProfile = useCallback(
    async (patch: Partial<CertProfile>) => {
      if (!clientId || !loaded) return
      const k = `profile|${clientId}`
      await serial(async () => {
        const prev = latest.current.get(k) as { id?: string; data: CertProfile } | undefined
        const next = { ...(prev?.data ?? profile), ...patch }
        const row = await profiles.save({ id: prev?.id ?? profileRow?.id, clientId, data: { profile: next } })
        latest.current.set(k, { id: row.id, data: next })
      })
    },
    [clientId, loaded, serial, profiles, profileRow, profile],
  )

  const workOf = useCallback(
    (cert: CertificationKey) => {
      const row = clientId ? (works.rows ?? []).find((r) => r.clientId === clientId && r.data.cert === cert) ?? null : null
      return { row, answers: row?.data.answers ?? {}, prep: row?.data.prep ?? {}, notes: row?.data.notes ?? {} }
    },
    [clientId, works.rows],
  )

  /*
   * D-246: 저장할 때 쓰는 '지금 기록' 은 화면이 그려질 때의 값이 아니라 가장 최근 값 — 줄이 비면(latest 비움) 예전엔
   *   부른 쪽이 가진 옛 화면의 기록 위에 덧붙여, 오래 걸리는 일(AI 초안 여섯 번 저장)에서 앞 저장을 덮었다.
   */
  const worksRows = useRef(works.rows)
  worksRows.current = works.rows

  /** 바뀐 칸만 넘긴다 — 저장할 때 바로 앞 값(answers · prep · notes) 위에 덧붙인다 */
  const saveWork = useCallback(
    async (cert: CertificationKey, patch: { answers?: Record<string, Answer>; prep?: Record<string, PreparedAnswer>; notes?: Record<string, string> }) => {
      if (!clientId || !loaded) return
      const k = `work|${clientId}|${cert}`
      await serial(async () => {
        const prev = latest.current.get(k) as { id?: string; data: WorkRow } | undefined
        const curRow = (worksRows.current ?? []).find((r) => r.clientId === clientId && r.data.cert === cert) ?? null
        const base: WorkRow = prev?.data ?? { ...(curRow?.data ?? {}), cert, answers: curRow?.data.answers ?? {}, prep: curRow?.data.prep ?? {}, notes: curRow?.data.notes ?? {} }
        // P2: 대표 답(notes) — 다른 칸을 저장할 때 지워지지 않게 늘 같이 쓴다
        const next: WorkRow = { ...base, cert, answers: { ...base.answers, ...patch.answers }, prep: { ...base.prep, ...patch.prep }, notes: { ...(base.notes ?? {}), ...patch.notes } }
        const row = await works.save({ id: prev?.id ?? curRow?.id, clientId, data: next })
        latest.current.set(k, { id: row.id, data: next })
        // 화면이 다시 그려지기 전에 다음 저장이 와도 방금 저장한 줄 위에 덧붙이게
        const list = worksRows.current ?? []
        worksRows.current = list.some((r) => r.id === row.id) ? list.map((r) => (r.id === row.id ? row : r)) : [row, ...list]
      })
    },
    [clientId, loaded, serial, works],
  )

  const lifeOf = useCallback(
    (cert: CertificationKey) => {
      const row = clientId ? (lifeRows.rows ?? []).find((r) => r.clientId === clientId && r.data.cert === cert) ?? null : null
      return { row, life: normalizeLifecycle(row?.data.life, cert) }
    },
    [clientId, lifeRows.rows],
  )

  /** 업체 기록 저장 — 저장 직전에 그 업체 기록을 새로 읽어 그 위에 고친다(그 사이 다른 창 · 팀장이 적은 것을 덮지 않게) · 화면이 쓰는 기록도 바꾼다 */
  const commit = useCallback(
    async (change: (rec: ClientOpsRecord) => ClientOpsRecord) => {
      if (!clientRecord) return null
      const fresh = (await listClients(workspaceId).catch(() => [] as ClientOpsRecord[])).find((c) => c.id === clientRecord.id) ?? clientRecord
      const next = change(fresh)
      if (next === fresh) return fresh
      const saved = await saveClient(next)
      replaceClient(saved)
      return saved
    },
    [clientRecord, workspaceId, replaceClient],
  )

  /** 진행 기록 저장 — 바로 앞에 저장한 진행 기록(없으면 지금 기록) 위에서 바꾼다. 바뀐 게 없으면 저장하지 않고 null */
  const saveLifeWith = useCallback(
    async (cert: CertificationKey, change: (cur: CertLifecycle) => CertLifecycle, seed?: CertLifecycle): Promise<CertLifecycle | null> => {
      if (!clientId || !loaded) return null
      const k = `life|${clientId}|${cert}`
      const curRow = lifeOf(cert)
      return serial(async () => {
        const prev = latest.current.get(k) as { id?: string; data: CertLifecycle } | undefined
        const base = prev?.data ?? seed ?? curRow.life
        const next = change(base)
        if (next === base) return null
        const row = await lifeRows.save({ id: prev?.id ?? curRow.row?.id, clientId, data: { cert, life: next } })
        latest.current.set(k, { id: row.id, data: next })
        return next
      })
    },
    [clientId, loaded, serial, lifeRows, lifeOf],
  )

  /**
   * 진행 상태 바꾸기 — 진행 기록 + 업체 활동 기록 한 줄. 바뀌었으면 true.
   * D-214: seed — 회사 정보 '인증서' 칸으로만 아는 인증(진행 기록 없음)은 화면에 보이는 번호 · 날짜에서 시작한다
   *   (예전: 빈 기록에서 시작해 '갱신 준비' 를 누르면 번호 · 유효기간이 사라지고 갱신 일정도 숨었다).
   */
  const setStatus = useCallback(
    async (cert: CertificationKey, status: CertStatus, seed?: CertLifecycle): Promise<boolean> => {
      if (!clientRecord) return false
      const at = nowIso()
      const next = await saveLifeWith(cert, (cur) => withCertStatus(cur, status, at), seed)
      if (!next) return false
      await commit((rec) => withActivity(rec, 'tool', `${CERT_RULES[cert].label} 진행 — ${CERT_STATUS_LABEL[status]}`, null, at))
      return true
    },
    [clientRecord, saveLifeWith, commit],
  )

  /** 메모 · 사후 점검일 같은 덧붙임(활동 기록 없음) */
  const patchLife = useCallback(
    async (cert: CertificationKey, patch: Partial<Pick<CertLifecycle, 'memo' | 'postAuditAt'>>) => {
      await saveLifeWith(cert, (cur) => ((Object.keys(patch) as (keyof typeof patch)[]).every((x) => cur[x] === patch[x]) ? cur : { ...cur, ...patch, updatedAt: nowIso() }))
    },
    [saveLifeWith],
  )

  /**
   * [인증 완료 기록] — 번호 · 인증일 · 유효기간(사람이 적은 것만).
   * toProfile: 회사 정보 '인증서' 칸에도(다른 모듈 · 서류 요청이 같이 안다). 유효기간이 있으면 갱신 일정을 달력 · 오늘에.
   */
  const complete = useCallback(
    async (cert: CertificationKey, input: CompletionInput, opts: { toProfile: boolean }) => {
      if (!clientRecord || !clientId) return
      const at = nowIso()
      const life = await saveLifeWith(cert, (cur) => withCompletion(cur, input, at))
      if (!life) return
      await commit((rec) => withCertCompletion(rec, cert, life, { toProfile: opts.toProfile, today, clientId }))
    },
    [clientRecord, clientId, saveLifeWith, commit, today],
  )

  /** [회사 정보에 확인된 사실로 저장] — 칩으로 고른 특허 · 연구소를 사실 창고에 '확인됨' 으로 */
  const confirmFacts = useCallback(async () => {
    if (!clientRecord) return 0
    const now = nowIso()
    const patch = factPatchOf(profile)
    let changed = false
    await commit((fresh) => {
      let rec = fresh
      for (const f of patch) rec = withFactValue(rec, f.key, f.value, { source: 'manual', status: 'confirmed', asOf: todayLocalDate(), now })
      if (rec === fresh) return fresh
      changed = true
      return withActivity(rec, 'profile', `기업인증에서 확인한 사실 저장 — ${patch.map((f) => `${f.label} ${f.value}`).join(' · ')}`, null, now)
    })
    return changed ? patch.length : 0
  }, [clientRecord, profile, commit])

  /** [고객에게 자료 요청] — 서류함에 없는 것만 빈 칸으로(고객 화면 · 서류 요청 문구가 같이 쓴다) */
  const requestDocs = useCallback(
    async (labels: string[]) => {
      if (!clientRecord) return 0
      let added = 0
      await commit((fresh) => {
        const next = withDocSlots(fresh, labels)
        added = (next.customDocuments?.length ?? 0) - (fresh.customDocuments?.length ?? 0)
        return added > 0 ? withActivity(next, 'document', `기업인증 자료 요청 — 서류함에 칸 ${added}개`, null, nowIso()) : fresh
      })
      return Math.max(0, added)
    },
    [clientRecord, commit],
  )

  return {
    clientId,
    clientName,
    clientRecord,
    loaded,
    loadError,
    reloadAll,
    profile,
    lab,
    lives,
    ctx,
    list,
    roadmap,
    saveProfile,
    workOf,
    saveWork,
    lifeOf,
    setStatus,
    patchLife,
    complete,
    confirmFacts,
    requestDocs,
  }
}
