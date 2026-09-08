/**
 * 컨설팅 작업실 — 프로젝트 목록.
 *
 * 관리자 표가 아니다. 대표가 보고 싶은 것은 셋뿐이다 (§22):
 *   누구 / 어디까지 왔나 / 지금 무엇을 하면 되나 → [계속하기]
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Plus, Workflow, X } from 'lucide-react'
import { WorkspaceScope } from '../components/workspace/WorkspaceScope'
import { Badge, Blank, BottomSheet, ScreenTitle } from '../components/ui/primitives'
import { Button } from '../components/ui/Button'
import { useToast } from '../components/ui/toastContext'
import { listClients } from '../services/clientOpsService'
import { createProject, isTablesMissing, listArtifacts, listEvidence, listProjects, listPromptPackages } from '../services/consultingStudioService'
import { overallPercent, resolveCurrentTask } from '../domain/consulting/currentTask'
import { todayLocalDate } from '../lib/appClock'
import { contractStageOf } from '../types/clientOps'
import type { ClientOpsRecord } from '../types/clientOps'
import type { ConsultingArtifact, ConsultingEvidence, ConsultingProject, ConsultingPromptPackage } from '../types/consulting'
import { TablesMissingNotice } from '../components/consulting/studioParts'

/** 처음 안내를 닫았는지 — 이 브라우저에만 남는다 */
const INTRO_KEY = 'axmvp.studio.intro'

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
  const [busy, setBusy] = useState(false)
  const [showDone, setShowDone] = useState(false)
  const [showIntro, setShowIntro] = useState(() => {
    try {
      return localStorage.getItem(INTRO_KEY) !== 'done'
    } catch {
      return false
    }
  })

  const dismissIntro = () => {
    setShowIntro(false)
    try {
      localStorage.setItem(INTRO_KEY, 'done')
    } catch {
      /* 저장 못 해도 화면은 그대로 동작한다 */
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setClients(await listClients(workspaceId))
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

  const rows = useMemo(
    () =>
      projects
        .filter((p) => showDone || (p.status !== 'done' && p.status !== 'archived'))
        .map((p) => ({ p, task: resolveCurrentTask(p, { artifacts, prompts, evidence, today }), percent: overallPercent(p) })),
    [projects, artifacts, prompts, evidence, today, showDone],
  )
  const doneCount = projects.filter((p) => p.status === 'done' || p.status === 'archived').length

  /** §23 — 고객만 고르면 시작한다. 이름·workflow·owner 는 기본값 */
  const create = async () => {
    if (!newClientId) return
    setBusy(true)
    try {
      const client = clients.find((c) => c.id === newClientId) ?? null
      const p = await createProject(workspaceId, { clientId: newClientId, clientName: client?.companyName ?? '' }, client)
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
        sub="특허 → MVP → 벤처인증 → 실사. 다음에 무엇을 할지는 시스템이 정합니다."
        actions={
          !missing && (
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus aria-hidden="true" className="size-4" />
              새 프로젝트
            </Button>
          )
        }
      />

      {/*
        처음 오는 사람에게 딱 세 줄 (§20). 모달도 튜토리얼도 아니다 —
        목록 위에 한 번 뜨고, 닫으면 다시 뜨지 않는다.
      */}
      {!missing && showIntro && (
        <div className="rounded-(--radius-panel) border border-brand-200 bg-brand-50/60 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <p className="t-card break-keep text-slate-900">처음이신가요? 세 가지만 알면 됩니다.</p>
            <button type="button" aria-label="안내 닫기" onClick={dismissIntro} className="tap shrink-0 text-slate-500 hover:text-slate-800">
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
          <ol className="mt-2 flex flex-col gap-1.5">
            <li className="t-body break-keep text-slate-700"><strong className="font-semibold">1.</strong> 고객을 고르면 프로젝트가 시작됩니다.</li>
            <li className="t-body break-keep text-slate-700"><strong className="font-semibold">2.</strong> 화면에 나오는 질문에 답하거나, 시스템이 만든 추천을 확인하세요.</li>
            <li className="t-body break-keep text-slate-700"><strong className="font-semibold">3.</strong> 준비되면 프롬프트를 만들어 ChatGPT·Claude 에 붙여 넣고, 결과를 다시 붙여 넣으면 됩니다.</li>
          </ol>
          <Button variant="primary" className="mt-3" onClick={() => { dismissIntro(); setCreating(true) }}>
            바로 시작
          </Button>
        </div>
      )}

      {missing && <TablesMissingNotice />}
      {!missing && loading && <p className="t-sub py-6 text-center text-slate-500">불러오는 중…</p>}

      {!missing && !loading && rows.length === 0 && (
        <Blank
          icon={<Workflow className="size-8" />}
          title={projects.length === 0 ? '고객을 골라 시작하면 됩니다.' : '진행 중인 프로젝트가 없습니다.'}
          action={
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus aria-hidden="true" className="size-4" />
              새 프로젝트
            </Button>
          }
        />
      )}

      {!missing && rows.length > 0 && (
        <ul className="ax-stagger flex flex-col gap-2.5 xl:grid xl:grid-cols-2">
          {rows.map(({ p, task, percent }) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => navigate(`/studio/${p.id}`)}
                className="tap flex w-full flex-col gap-3 rounded-(--radius-panel) border border-slate-200 bg-white p-5 text-left hover:border-brand-300"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="t-card break-keep text-slate-900">{clientName.get(p.clientId) ?? p.clientName}</span>
                    {p.status === 'on_hold' && <Badge tone="warning">보류</Badge>}
                    {p.status === 'done' && <Badge tone="success">끝남</Badge>}
                  </div>
                  {/* 같은 고객에 프로젝트가 둘 이상일 수 있으므로 이름은 작게 남긴다 */}
                  <p className="t-sub mt-0.5 break-keep text-slate-500">{p.title}</p>
                </div>

                <div>
                  <p className="t-body break-keep font-semibold text-slate-900">{task.headline}</p>
                  {task.nextPreview && <p className="t-sub mt-0.5 break-keep text-slate-600">{task.nextPreview}</p>}
                </div>

                <div className="flex items-center gap-3">
                  <div aria-hidden="true" className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${percent}%` }} />
                  </div>
                  <span className="t-sub shrink-0 tabular-nums text-slate-600">{percent}%</span>
                </div>

                <span className="t-body inline-flex items-center gap-1.5 font-semibold text-brand-700">
                  계속하기 <ArrowRight aria-hidden="true" className="size-4" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {!missing && doneCount > 0 && (
        <button type="button" onClick={() => setShowDone((v) => !v)} className="t-sub self-start text-slate-500 hover:text-slate-800">
          {showDone ? '끝난 프로젝트 감추기' : `끝난 프로젝트 ${doneCount}건 보기`}
        </button>
      )}

      {creating && (
        <BottomSheet
          title="새 프로젝트"
          onClose={() => setCreating(false)}
          footer={
            <div className="flex justify-end gap-2">
              <Button onClick={() => setCreating(false)}>취소</Button>
              <Button variant="primary" disabled={busy || !newClientId} onClick={() => void create()}>
                {busy ? '만드는 중…' : '시작'}
              </Button>
            </div>
          }
        >
          <div className="flex flex-col gap-3">
            <label className="block">
              <span className="t-sub block font-medium text-slate-600">어느 고객인가요?</span>
              <select
                aria-label="고객"
                value={newClientId}
                onChange={(e) => setNewClientId(e.target.value)}
                className="t-body mt-1 h-12 w-full rounded-(--radius-control) border border-slate-300 bg-white px-3"
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
            <p className="t-meta break-keep text-slate-500">
              회사 기본정보는 고객 기록에서 자동으로 가져옵니다. 나머지는 진행하면서 필요한 것만 물어봅니다.
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
