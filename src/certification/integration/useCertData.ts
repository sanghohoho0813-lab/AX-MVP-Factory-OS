/**
 * 기업인증 화면 ↔ OS (D-170 · P1) — 지금 연 업체 · 업체 사정(칩) · 자가진단 · 실사 준비 · 진행 기록을 읽고 저장한다.
 * 모듈 기록(`cert-os`)에 두고, 업체 기록은 사람이 누른 것만 고친다:
 *   - [회사 정보에 확인된 사실로 저장] → 사실 창고(특허 · 연구소) '확인됨'
 *   - [인증 완료 기록] → 회사 정보 '인증서' 칸 + 갱신 일정(달력 · 오늘) + 활동 기록
 *   - 진행 상태 바꾸기 → 활동 기록 한 줄
 *   - [고객에게 자료 요청] → 서류함에 빈 칸(없는 것만)
 * 새 표 · 마이그레이션 없음.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useToolClient } from '../../tools/shared/toolClientContext'
import { useModuleBucket } from '../../tools/shared/useModuleBucket'
import { nowIso, todayLocalDate } from '../../lib/appClock'
import { saveClient, withCustomField, withToolResult } from '../../services/clientOpsService'
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
  rec = { ...rec, toolResults: (rec.toolResults ?? []).filter((t) => !(t.toolKey === CERT_MODULE && t.title === title)) }
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

  const saveProfile = useCallback(
    async (patch: Partial<CertProfile>) => {
      if (!clientId) return
      await profiles.save({ id: profileRow?.id, clientId, data: { profile: { ...profile, ...patch } } })
    },
    [clientId, profiles, profileRow, profile],
  )

  const workOf = useCallback(
    (cert: CertificationKey) => {
      const row = clientId ? (works.rows ?? []).find((r) => r.clientId === clientId && r.data.cert === cert) ?? null : null
      return { row, answers: row?.data.answers ?? {}, prep: row?.data.prep ?? {}, notes: row?.data.notes ?? {} }
    },
    [clientId, works.rows],
  )

  const saveWork = useCallback(
    async (cert: CertificationKey, patch: { answers?: Record<string, Answer>; prep?: Record<string, PreparedAnswer>; notes?: Record<string, string> }) => {
      if (!clientId) return
      const cur = workOf(cert)
      // P2: 대표 답(notes) — 다른 칸을 저장할 때 지워지지 않게 늘 같이 쓴다
      await works.save({ id: cur.row?.id, clientId, data: { ...(cur.row?.data ?? {}), cert, answers: patch.answers ?? cur.answers, prep: patch.prep ?? cur.prep, notes: patch.notes ?? cur.notes } })
    },
    [clientId, works, workOf],
  )

  const lifeOf = useCallback(
    (cert: CertificationKey) => {
      const row = clientId ? (lifeRows.rows ?? []).find((r) => r.clientId === clientId && r.data.cert === cert) ?? null : null
      return { row, life: normalizeLifecycle(row?.data.life, cert) }
    },
    [clientId, lifeRows.rows],
  )

  /** 업체 기록 저장 — 화면이 쓰는 기록도 바꾼다(다음 단추가 예전 기록 위에 저장하지 않게) */
  const commit = useCallback(
    async (next: ClientOpsRecord) => {
      const saved = await saveClient(next)
      replaceClient(saved)
      return saved
    },
    [replaceClient],
  )

  const saveLife = useCallback(
    async (cert: CertificationKey, life: CertLifecycle) => {
      if (!clientId) return
      await lifeRows.save({ id: lifeOf(cert).row?.id, clientId, data: { cert, life } })
    },
    [clientId, lifeRows, lifeOf],
  )

  /** 진행 상태 바꾸기 — 진행 기록 + 업체 활동 기록 한 줄 */
  const setStatus = useCallback(
    async (cert: CertificationKey, status: CertStatus) => {
      if (!clientRecord) return
      const at = nowIso()
      const cur = lifeOf(cert).life
      const next = withCertStatus(cur, status, at)
      if (next === cur) return
      await saveLife(cert, next)
      await commit(withActivity(clientRecord, 'tool', `${CERT_RULES[cert].label} 진행 — ${CERT_STATUS_LABEL[status]}`, null, at))
    },
    [clientRecord, lifeOf, saveLife, commit],
  )

  /** 메모 · 사후 점검일 같은 덧붙임(활동 기록 없음) */
  const patchLife = useCallback(
    async (cert: CertificationKey, patch: Partial<Pick<CertLifecycle, 'memo' | 'postAuditAt'>>) => {
      const cur = lifeOf(cert).life
      await saveLife(cert, { ...cur, ...patch, updatedAt: nowIso() })
    },
    [lifeOf, saveLife],
  )

  /**
   * [인증 완료 기록] — 번호 · 인증일 · 유효기간(사람이 적은 것만).
   * toProfile: 회사 정보 '인증서' 칸에도(다른 모듈 · 서류 요청이 같이 안다). 유효기간이 있으면 갱신 일정을 달력 · 오늘에.
   */
  const complete = useCallback(
    async (cert: CertificationKey, input: CompletionInput, opts: { toProfile: boolean }) => {
      if (!clientRecord || !clientId) return
      const at = nowIso()
      const life = withCompletion(lifeOf(cert).life, input, at)
      await saveLife(cert, life)
      const rec = withCertCompletion(clientRecord, cert, life, { toProfile: opts.toProfile, today, clientId })
      await commit(rec)
    },
    [clientRecord, clientId, lifeOf, saveLife, commit, today],
  )

  /** [회사 정보에 확인된 사실로 저장] — 칩으로 고른 특허 · 연구소를 사실 창고에 '확인됨' 으로 */
  const confirmFacts = useCallback(async () => {
    if (!clientRecord) return 0
    const now = nowIso()
    let rec = clientRecord
    const patch = factPatchOf(profile)
    for (const f of patch) rec = withFactValue(rec, f.key, f.value, { source: 'manual', status: 'confirmed', asOf: todayLocalDate(), now })
    if (rec === clientRecord) return 0
    rec = withActivity(rec, 'profile', `기업인증에서 확인한 사실 저장 — ${patch.map((f) => `${f.label} ${f.value}`).join(' · ')}`, null, now)
    await commit(rec)
    return patch.length
  }, [clientRecord, profile, commit])

  /** [고객에게 자료 요청] — 서류함에 없는 것만 빈 칸으로(고객 화면 · 서류 요청 문구가 같이 쓴다) */
  const requestDocs = useCallback(
    async (labels: string[]) => {
      if (!clientRecord) return 0
      const next = withDocSlots(clientRecord, labels)
      const added = (next.customDocuments?.length ?? 0) - (clientRecord.customDocuments?.length ?? 0)
      if (added > 0) await commit(withActivity(next, 'document', `기업인증 자료 요청 — 서류함에 칸 ${added}개`, null, nowIso()))
      return Math.max(0, added)
    },
    [clientRecord, commit],
  )

  return {
    clientId,
    clientName,
    clientRecord,
    loaded: profiles.rows !== null && works.rows !== null && lifeRows.rows !== null,
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
