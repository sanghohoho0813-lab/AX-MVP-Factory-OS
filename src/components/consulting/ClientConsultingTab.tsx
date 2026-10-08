/**
 * 고객 상세 > 컨설팅 탭 — 이 고객의 특허·벤처·MVP 프로젝트.
 * 프로젝트는 고객 기록에 매달린다(새 CRM 없음). 여기서 바로 새로 만든다.
 */

import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Workflow } from 'lucide-react'
import type { ClientOpsRecord } from '../../types/clientOps'
import type { ConsultingProject } from '../../types/consulting'
import { Badge, Blank, ListRow, ListSurface } from '../ui/primitives'
import { Button } from '../ui/Button'
import { useToast } from '../ui/toastContext'
import { createProject, isTablesMissing, listProjectsForClient } from '../../services/consultingStudioService'
import { LegacyVentureNotice } from './LegacyVentureNotice'
import { projectProgress } from '../../domain/consulting/projectModel'
import { STAGE_STATUS_LABEL, TablesMissingNotice, stageTitle } from './studioParts'

export function ClientConsultingTab({ record, workspaceId }: { record: ClientOpsRecord; workspaceId: string | null }) {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [projects, setProjects] = useState<ConsultingProject[]>([])
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setProjects(await listProjectsForClient(workspaceId, record.id))
      setMissing(false)
    } catch (cause) {
      if (isTablesMissing(cause)) setMissing(true)
      else showToast(cause instanceof Error ? cause.message : '불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [workspaceId, record.id, showToast])

  useEffect(() => {
    void load()
  }, [load])

  const create = async () => {
    setBusy(true)
    try {
      const p = await createProject(workspaceId, { clientId: record.id, clientName: record.companyName }, record)
      navigate(`/studio/${p.id}`)
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : '만들지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  if (missing) return <TablesMissingNotice />

  return (
    <div className="flex flex-col gap-3">
      {/* LEGACY — 벤처기업 확인은 기업인증에서(이 탭의 특허 · MVP · 실사 프로젝트는 그대로) */}
      <LegacyVentureNotice clientId={record.id} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="t-sub break-keep text-slate-500">특허 → MVP → 실사를 단계로 끌고 가는 프로젝트입니다(예전 벤처 기록도 여기 남아 있습니다). 회사 정보는 사실표로 가져갑니다.</p>
        <Button variant="primary" size="sm" disabled={busy} onClick={() => void create()}>
          <Plus aria-hidden="true" className="size-4" /> 새 프로젝트
        </Button>
      </div>
      {loading ? (
        <p className="t-sub py-4 text-center text-slate-500">불러오는 중…</p>
      ) : projects.length === 0 ? (
        <Blank icon={<Workflow className="size-7" />} title="아직 컨설팅 프로젝트가 없습니다." />
      ) : (
        <ListSurface>
          {projects.map((p) => {
            const pr = projectProgress(p)
            const st = p.stages[p.currentStage].status
            return (
              <ListRow
                key={p.id}
                title={p.title}
                meta={`${stageTitle(p.currentStage)} · ${STAGE_STATUS_LABEL[st]} · ${pr.done}/${pr.total} 단계`}
                badge={p.gate.decision ? <Badge tone={p.gate.decision === 'go' ? 'success' : p.gate.decision === 'hold' ? 'warning' : 'danger'}>{p.gate.decision.toUpperCase().replace('_', '-')}</Badge> : undefined}
                edge={st === 'blocked' ? 'danger' : 'brand'}
                showEdge
                onClick={() => navigate(`/studio/${p.id}`)}
              />
            )
          })}
        </ListSurface>
      )}
    </div>
  )
}
