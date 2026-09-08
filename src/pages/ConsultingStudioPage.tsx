/**
 * 컨설팅 작업실 — 특허 × 벤처 × MVP 프로젝트 목록.
 *
 * 카드 하나 = 회사 · 제목 · 현재 단계 · 진행도 · 막힘 · 다음 행동 1개.
 * 고객은 고객 운영 기록에서 고른다(새 CRM 없음). 한 고객에 여러 프로젝트를 둘 수 있다.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Workflow } from 'lucide-react'
import { WorkspaceScope } from '../components/workspace/WorkspaceScope'
import { Badge, Blank, BottomSheet, ScreenTitle, Surface } from '../components/ui/primitives'
import { Button } from '../components/ui/Button'
import { useToast } from '../components/ui/toastContext'
import { listClients } from '../services/clientOpsService'
import { createProject, isTablesMissing, listArtifacts, listEvidence, listProjects, listPromptPackages } from '../services/consultingStudioService'
import { resolveNextActions } from '../domain/consulting/nextActionResolver'
import { blockedStages, projectProgress } from '../domain/consulting/projectModel'
import { stageDef } from '../domain/consulting/workflowDefinition'
import { todayLocalDate } from '../lib/appClock'
import type { ClientOpsRecord } from '../types/clientOps'
import type { ConsultingArtifact, ConsultingEvidence, ConsultingProject, ConsultingPromptPackage } from '../types/consulting'
import { MiniProgress, StageBadge, TablesMissingNotice, stageTitle } from '../components/consulting/studioParts'
import { contractStageOf } from '../types/clientOps'

function StudioContent({ workspaceId }: { workspaceId: string | null }) {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const today = todayLocalDate()
  const [projects, setProjects] = useState<ConsultingProject[]>([])
  const [clients, setClients] = useState<ClientOpsRecord[]>([])
  const [artifacts, setArtifacts] = useState<ConsultingArtifact[]>([])
  const [prompts, setPrompts] = useState<ConsultingPromptPackage[]>([])
  const [evidence, setEvidence] = useState<ConsultingEvidence[]>([])
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newClientId, setNewClientId] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [showDone, setShowDone] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const cl = await listClients(workspaceId)
      setClients(cl)
      const [ps, arts, pks, evs] = await Promise.all([
        listProjects(workspaceId),
        listArtifacts(workspaceId),
        listPromptPackages(workspaceId),
        listEvidence(workspaceId),
      ])
      setProjects(ps)
      setArtifacts(arts)
      setPrompts(pks)
      setEvidence(evs)
      setMissing(false)
    } catch (cause) {
      if (isTablesMissing(cause)) setMissing(true)
      else showToast(cause instanceof Error ? cause.message : '불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [workspaceId, showToast])

  useEffect(() => {
    void load()
  }, [load])

  const clientName = useMemo(() => new Map(clients.map((c) => [c.id, c.companyName])), [clients])
  const activeClients = useMemo(
    () => clients.filter((c) => !c.archivedAt && contractStageOf(c.status) !== 'closed').sort((a, b) => a.companyName.localeCompare(b.companyName, 'ko')),
    [clients],
  )

  const visible = projects.filter((p) => showDone || (p.status !== 'done' && p.status !== 'archived'))
  const doneCount = projects.length - projects.filter((p) => p.status !== 'done' && p.status !== 'archived').length

  const create = async () => {
    if (!newClientId) {
      showToast('고객을 골라 주세요.')
      return
    }
    setBusy(true)
    try {
      const client = clients.find((c) => c.id === newClientId) ?? null
      const p = await createProject(workspaceId, { clientId: newClientId, clientName: client?.companyName ?? '', title: newTitle }, client)
      setCreating(false)
      setNewTitle('')
      navigate(`/studio/${p.id}`)
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : '만들지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <ScreenTitle
        title="컨설팅 작업실"
        sub="특허 → MVP → 벤처인증 → 실사를 한 줄기로. 다음에 무엇을 할지 규칙이 알려 줍니다."
        actions={
          !missing && (
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus aria-hidden="true" className="size-4" />
              새 프로젝트
            </Button>
          )
        }
      />

      {missing && <TablesMissingNotice />}

      {!missing && loading && <p className="t-sub py-6 text-center text-slate-500">불러오는 중…</p>}

      {!missing && !loading && visible.length === 0 && (
        <Blank
          icon={<Workflow className="size-8" />}
          title={projects.length === 0 ? '아직 프로젝트가 없습니다. 고객을 골라 시작합니다.' : '진행 중인 프로젝트가 없습니다.'}
          action={
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus aria-hidden="true" className="size-4" />
              새 프로젝트
            </Button>
          }
        />
      )}

      {!missing && visible.length > 0 && (
        <ul className="ax-stagger flex flex-col gap-2.5 xl:grid xl:grid-cols-2">
          {visible.map((p) => {
            const progress = projectProgress(p)
            const blocked = blockedStages(p)
            const next = resolveNextActions(p, { artifacts, prompts, evidence, today })[0]
            const stage = p.stages[p.currentStage]
            return (
              <Surface key={p.id} as="li" edge={blocked.length > 0 ? 'danger' : 'brand'} showEdge padded={false}>
                <button type="button" onClick={() => navigate(`/studio/${p.id}`)} className="tap block w-full p-4 text-left sm:p-5">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="t-card break-keep text-slate-900">{clientName.get(p.clientId) ?? p.clientName}</span>
                    <span className="t-sub break-keep text-slate-500">{p.title}</span>
                    {p.gate.decision && (
                      <Badge tone={p.gate.decision === 'go' ? 'success' : p.gate.decision === 'hold' ? 'warning' : 'danger'}>
                        {p.gate.decision.toUpperCase().replace('_', '-')}
                      </Badge>
                    )}
                    {p.status === 'on_hold' && <Badge tone="warning">보류</Badge>}
                    {p.status === 'done' && <Badge tone="success">끝남</Badge>}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="t-body font-semibold text-slate-800">{stageTitle(p.currentStage)}</span>
                    <StageBadge status={stage.status} />
                    {blocked.length > 0 && <Badge tone="danger">막힘 {blocked.length}</Badge>}
                  </div>
                  <div className="mt-3">
                    <MiniProgress value={progress.done} max={progress.total} label="단계 진행" />
                  </div>
                  {next && (
                    <p className="t-sub mt-3 break-keep text-slate-600">
                      <span className="font-semibold text-brand-700">다음 · </span>
                      {next.title}
                    </p>
                  )}
                  <p className="t-meta mt-1 text-slate-400">{stageDef(p.currentStage).purpose}</p>
                </button>
              </Surface>
            )
          })}
        </ul>
      )}

      {!missing && doneCount > 0 && (
        <button type="button" onClick={() => setShowDone((v) => !v)} className="t-sub self-start text-slate-500 hover:text-slate-800">
          {showDone ? '끝난 프로젝트 감추기' : `끝난 프로젝트 ${doneCount}건 보기`}
        </button>
      )}

      {creating && (
        <BottomSheet
          title="새 컨설팅 프로젝트"
          onClose={() => setCreating(false)}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setCreating(false)}>
                취소
              </Button>
              <Button variant="primary" disabled={busy || !newClientId} onClick={() => void create()}>
                {busy ? '만드는 중…' : '만들기'}
              </Button>
            </div>
          }
        >
          <div className="flex flex-col gap-4">
            <label className="block">
              <span className="t-sub block font-medium text-slate-600">고객 (고객 운영 기록에서)</span>
              <select
                aria-label="고객"
                value={newClientId}
                onChange={(e) => setNewClientId(e.target.value)}
                className="t-body mt-1 h-11 w-full rounded-(--radius-control) border border-slate-300 bg-white px-3"
              >
                <option value="">고객을 고르세요</option>
                {activeClients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.companyName}
                  </option>
                ))}
              </select>
              {activeClients.length === 0 && <span className="t-meta mt-1 block text-slate-500">고객 운영에 업체를 먼저 등록해 주세요.</span>}
            </label>
            <label className="block">
              <span className="t-sub block font-medium text-slate-600">프로젝트 이름 (선택)</span>
              <input
                aria-label="프로젝트 이름"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="예: 2026 벤처인증 · 작업지연 특허"
                className="t-body mt-1 w-full rounded-(--radius-control) border border-slate-300 px-3 py-2.5"
              />
            </label>
            <p className="t-meta break-keep text-slate-500">
              회사 기본 정보(대표자·설립일·주소·번호·업종)는 고객 기록에서 사실표로 가져옵니다. 출처는 "고객 운영 기록", 상태는 "미확인" 으로 표시되며 서류로 확인한 뒤 "확정" 으로 바꿉니다.
            </p>
          </div>
        </BottomSheet>
      )}
    </div>
  )
}

export function ConsultingStudioPage() {
  return <WorkspaceScope>{({ workspaceId }) => <StudioContent workspaceId={workspaceId} />}</WorkspaceScope>
}
