/**
 * D-220: 가상 업체 · 컨설턴트 저장소 — 읽기 · 저장 · 지우기 · 임시등록(고객 관리로 올리고 만든 것 옮기기).
 *
 * 가상 프로필: 모듈 기록 'marketing' · 'trial' (줄 id = 가상 id, 업체 칸 없음).
 * 만든 홈페이지 · 홍보 글: 각 도구의 갈래에 업체 칸 없이 내용에 가상 id(services/marketingTrial 의 subjectRow).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { deleteRow, listRows, saveRow } from '../../services/moduleData'
import { createClient, listClients, saveClient } from '../../services/clientOpsService'
import { CONTENT_MODULE, ITEMS_BUCKET, PROFILE_BUCKET } from '../../services/contentStudio'
import { adoptRow, normalizeTrial, registerInput, rowSubjectId, TRIAL_BUCKET, TRIAL_MODULE, withTrialDetails, type TrialProfile } from '../../services/marketingTrial'
import type { ClientOpsRecord } from '../../types/clientOps'
import { SITE_BUCKET, SITE_MODULE } from '../homepage/useSiteDoc'

/** 가상 id 로 저장되는 도구 갈래 — 임시등록 때 옮기고, 지울 때 같이 지운다 */
const DOC_BUCKETS: readonly [string, string][] = [
  [SITE_MODULE, SITE_BUCKET],
  [CONTENT_MODULE, PROFILE_BUCKET],
  [CONTENT_MODULE, ITEMS_BUCKET],
]

export interface TrialStore {
  status: 'loading' | 'ready' | 'error'
  trials: TrialProfile[]
  /** 저장(새로 · 고치기) — 실패하면 null */
  save: (p: TrialProfile) => Promise<TrialProfile | null>
  /** 가상 프로필과 그것으로 만든 홈페이지 · 홍보 글까지 지운다 */
  remove: (id: string) => Promise<boolean>
}

export function useTrials(workspaceId: string | null): TrialStore {
  const [status, setStatus] = useState<TrialStore['status']>('loading')
  const [trials, setTrials] = useState<TrialProfile[]>([])
  const listRef = useRef<TrialProfile[]>([])
  const put = (list: TrialProfile[]) => {
    listRef.current = list
    setTrials(list)
  }

  useEffect(() => {
    let alive = true
    setStatus('loading')
    listRows(workspaceId, TRIAL_MODULE, TRIAL_BUCKET)
      .then((rows) => {
        if (!alive) return
        put(rows.map((r) => normalizeTrial(r.data.profile)).filter((p): p is TrialProfile => !!p))
        setStatus('ready')
      })
      .catch(() => alive && setStatus('error'))
    return () => {
      alive = false
    }
  }, [workspaceId])

  const save = useCallback(
    async (p: TrialProfile) => {
      const clean = normalizeTrial({ ...p, updatedAt: new Date().toISOString() })
      if (!clean) return null
      try {
        await saveRow(workspaceId, TRIAL_MODULE, TRIAL_BUCKET, { id: clean.id, clientId: '', data: { profile: clean } })
        const cur = listRef.current
        put(cur.some((x) => x.id === clean.id) ? cur.map((x) => (x.id === clean.id ? clean : x)) : [clean, ...cur])
        return clean
      } catch {
        return null
      }
    },
    [workspaceId],
  )

  const remove = useCallback(
    async (id: string) => {
      try {
        for (const [mod, bucket] of DOC_BUCKETS) {
          const rows = await listRows(workspaceId, mod, bucket)
          for (const r of rows) if (!r.clientId && rowSubjectId(r) === id) await deleteRow(workspaceId, mod, bucket, r.id)
        }
        await deleteRow(workspaceId, TRIAL_MODULE, TRIAL_BUCKET, id)
        put(listRef.current.filter((x) => x.id !== id))
        return true
      } catch {
        return false
      }
    },
    [workspaceId],
  )

  return { status, trials, save, remove }
}

/** 가상 id 로 만든 것을 업체 줄로 옮긴다 — 실패한 줄은 세어 돌려준다(다시 누르면 남은 것만 옮긴다) */
export async function moveTrialRows(workspaceId: string | null, trialId: string, clientId: string): Promise<{ moved: number; failed: number }> {
  let moved = 0
  let failed = 0
  for (const [mod, bucket] of DOC_BUCKETS) {
    let rows: Awaited<ReturnType<typeof listRows>>
    try {
      rows = await listRows(workspaceId, mod, bucket)
    } catch {
      failed += 1
      continue
    }
    for (const r of rows) {
      if (r.clientId || rowSubjectId(r) !== trialId) continue
      try {
        await saveRow(workspaceId, mod, bucket, adoptRow(r, clientId))
        moved += 1
      } catch {
        failed += 1
      }
    }
  }
  return { moved, failed }
}

/**
 * 임시등록 — 고객 관리에 잠재고객(컨설턴트면 컨설턴트 고객)으로 올리고 만든 홈페이지 · 홍보 글을 그 업체로 옮긴다.
 * 업체를 만든 즉시 가상 프로필에 그 id 를 적어 두어, 옮기다 실패해 다시 눌러도 업체를 또 만들지 않는다.
 */
export async function registerTrial(
  workspaceId: string | null,
  p: TrialProfile,
  saveTrial: (p: TrialProfile) => Promise<TrialProfile | null>,
): Promise<{ record: ClientOpsRecord; moved: number; failed: number }> {
  const at = new Date().toISOString()
  let record: ClientOpsRecord | null = null
  if (p.registeredClientId) {
    record = (await listClients(workspaceId)).find((c) => c.id === p.registeredClientId) ?? null
  }
  if (!record) {
    const created = await createClient(workspaceId, registerInput(p))
    // 나머지 칸 · 임시등록 표시 — 이것만 실패하면 이름 · 연락처만 있는 기록으로 남고 등록은 된다
    record = await saveClient(withTrialDetails(created, p, at)).catch(() => created)
    await saveTrial({ ...p, registeredClientId: record.id })
  }
  const { moved, failed } = await moveTrialRows(workspaceId, p.id, record.id)
  if (!failed) await saveTrial({ ...p, registeredClientId: record.id, registeredAt: at })
  return { record, moved, failed }
}
