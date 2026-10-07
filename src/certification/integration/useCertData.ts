/**
 * 기업인증 화면 ↔ OS (D-170) — 지금 연 업체 · 업체 사정(칩으로 고른 것) · 자가진단 · 실사 준비 기록을 읽고 저장한다.
 * 저장은 모듈 기록(`cert-os`) 한 곳 — 새 표 · 마이그레이션 없음. 업체 기록 자체는 고치지 않는다(상담 요청 · 결과 붙이기 때만).
 */
import { useCallback, useMemo } from 'react'
import { useToolClient } from '../../tools/shared/toolClientContext'
import { useModuleBucket } from '../../tools/shared/useModuleBucket'
import { todayLocalDate } from '../../lib/appClock'
import { assessAll } from '../core/assess'
import { buildRoadmap } from '../core/roadmap'
import type { Answer } from '../core/selfCheck'
import type { PreparedAnswer } from '../core/inspection'
import type { CertificationKey } from '../core/types'
import { certContextOf, normalizeCertProfile, type CertProfile } from './clientContext'

export const CERT_MODULE = 'cert-os'

type ProfileRow = { profile: CertProfile } & Record<string, unknown>
type WorkRow = { cert: CertificationKey; answers: Record<string, Answer>; prep: Record<string, PreparedAnswer> } & Record<string, unknown>

export function useCertData() {
  const { clientId, clientRecord, clientName } = useToolClient()
  const profiles = useModuleBucket<ProfileRow>(CERT_MODULE, 'profile')
  const works = useModuleBucket<WorkRow>(CERT_MODULE, 'work')
  const today = todayLocalDate()

  const profileRow = clientId ? (profiles.rows ?? []).find((r) => r.clientId === clientId) ?? null : null
  const profile = useMemo(() => normalizeCertProfile(profileRow?.data.profile), [profileRow])
  const ctx = useMemo(() => (clientRecord ? certContextOf(clientRecord, today, profile) : null), [clientRecord, today, profile])
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
      return { row, answers: row?.data.answers ?? {}, prep: row?.data.prep ?? {} }
    },
    [clientId, works.rows],
  )

  const saveWork = useCallback(
    async (cert: CertificationKey, patch: { answers?: Record<string, Answer>; prep?: Record<string, PreparedAnswer> }) => {
      if (!clientId) return
      const cur = workOf(cert)
      await works.save({ id: cur.row?.id, clientId, data: { cert, answers: patch.answers ?? cur.answers, prep: patch.prep ?? cur.prep } })
    },
    [clientId, works, workOf],
  )

  return {
    clientId,
    clientName,
    clientRecord,
    loaded: profiles.rows !== null && works.rows !== null,
    profile,
    ctx,
    list,
    roadmap,
    saveProfile,
    workOf,
    saveWork,
  }
}
