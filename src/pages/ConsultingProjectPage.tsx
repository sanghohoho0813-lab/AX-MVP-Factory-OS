/**
 * 컨설팅 프로젝트 상세 — 탭: 개요 · 단계 · 사실표 · 핵심 줄기 · 특허 · MVP · 벤처 · 증빙 · 프롬프트 · 산출물 · 결정 · 실사.
 *
 * 자동저장: 탭에서 update(fn) 을 부르면 즉시 화면에 반영하고 700ms 뒤 한 번 저장한다.
 * 저장 실패는 토스트로 알리고 서버 값으로 되돌린다.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, MoreHorizontal } from 'lucide-react'
import { WorkspaceScope } from '../components/workspace/WorkspaceScope'
import { Badge, BottomSheet } from '../components/ui/primitives'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { NotFoundState } from '../components/ui/NotFoundState'
import { useToast } from '../components/ui/toastContext'
import { SavedBadge } from '../components/ops/opsControls'
import { EditorContext, type EditorValue } from '../components/consulting/editorContext'
import { OverviewTab } from '../components/consulting/OverviewTab'
import { StagesTab } from '../components/consulting/StagesTab'
import { FactsheetTab } from '../components/consulting/FactsheetTab'
import { ThreadTab } from '../components/consulting/ThreadTab'
import { PatentTab } from '../components/consulting/PatentTab'
import { MvpTab } from '../components/consulting/MvpTab'
import { VentureTab } from '../components/consulting/VentureTab'
import { EvidenceTab } from '../components/consulting/EvidenceTab'
import { PromptsTab } from '../components/consulting/PromptsTab'
import { ArtifactsTab } from '../components/consulting/ArtifactsTab'
import { DecisionsTab } from '../components/consulting/DecisionsTab'
import { FieldReviewTab } from '../components/consulting/FieldReviewTab'
import { StageBadge, TablesMissingNotice, TextField, stageTitle } from '../components/consulting/studioParts'
import {
  deleteProject,
  isTablesMissing,
  listArtifacts,
  listDecisions,
  listEvidence,
  listPromptPackages,
  loadProjectBundle,
  recordDecision,
  saveProject,
} from '../services/consultingStudioService'
import { projectProgress } from '../domain/consulting/projectModel'
import { todayLocalDate } from '../lib/appClock'
import type { ConsultingArtifact, ConsultingDecision, ConsultingEvidence, ConsultingProject, ConsultingPromptPackage, ProjectStatus } from '../types/consulting'

type Tab = 'overview' | 'stages' | 'factsheet' | 'thread' | 'patent' | 'mvp' | 'venture' | 'evidence' | 'prompts' | 'artifacts' | 'decisions' | 'review'

const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: '개요' },
  { key: 'stages', label: '단계' },
  { key: 'factsheet', label: '사실표' },
  { key: 'thread', label: '핵심 줄기' },
  { key: 'patent', label: '특허' },
  { key: 'mvp', label: 'MVP' },
  { key: 'venture', label: '벤처' },
  { key: 'evidence', label: '증빙' },
  { key: 'prompts', label: '프롬프트' },
  { key: 'artifacts', label: '산출물' },
  { key: 'decisions', label: '결정' },
  { key: 'review', label: '실사' },
]

function isTab(v: string | null): v is Tab {
  return TABS.some((t) => t.key === v)
}

const STATUS_LABEL: Record<ProjectStatus, string> = { active: '진행 중', on_hold: '보류', done: '끝남', archived: '보관' }

function ProjectContent({ workspaceId, userId }: { workspaceId: string | null; userId: string | null }) {
  const { projectId = '' } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { showToast } = useToast()
  const today = todayLocalDate()

  const tab: Tab = isTab(searchParams.get('tab')) ? (searchParams.get('tab') as Tab) : 'overview'
  const focus = searchParams.get('focus') ?? undefined

  const [project, setProject] = useState<ConsultingProject | null>(null)
  const [artifacts, setArtifacts] = useState<ConsultingArtifact[]>([])
  const [prompts, setPrompts] = useState<ConsultingPromptPackage[]>([])
  const [decisions, setDecisions] = useState<ConsultingDecision[]>([])
  const [evidence, setEvidence] = useState<ConsultingEvidence[]>([])
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [moreOpen, setMoreOpen] = useState(false)
  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0)
  const [deleteTyped, setDeleteTyped] = useState('')

  const latest = useRef<ConsultingProject | null>(null)
  const timer = useRef<number | null>(null)
  const dirty = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const b = await loadProjectBundle(workspaceId, projectId)
      if (!b) {
        setNotFound(true)
        return
      }
      setProject(b.project)
      latest.current = b.project
      setArtifacts(b.artifacts)
      setPrompts(b.prompts)
      setDecisions(b.decisions)
      setEvidence(b.evidence)
      setMissing(false)
    } catch (cause) {
      if (isTablesMissing(cause)) setMissing(true)
      else showToast(cause instanceof Error ? cause.message : '불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [workspaceId, projectId, showToast])

  useEffect(() => {
    void load()
  }, [load])

  const flush = useCallback(async () => {
    if (!dirty.current || !latest.current) return
    dirty.current = false
    try {
      const saved = await saveProject(latest.current)
      // 저장 중에 또 바뀌었으면 서버 값으로 덮지 않는다
      if (!dirty.current) {
        latest.current = saved
        setProject(saved)
      }
      setSavedAt(Date.now())
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : '저장하지 못했습니다.')
      void load()
    }
  }, [showToast, load])

  const update = useCallback(
    (fn: (p: ConsultingProject) => ConsultingProject) => {
      if (!latest.current) return
      const next = fn(latest.current)
      latest.current = next
      dirty.current = true
      setProject(next)
      if (timer.current) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => void flush(), 700)
    },
    [flush],
  )

  // 화면을 떠나거나 탭을 닫을 때 남은 변경을 저장한다
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flush()
    }
    document.addEventListener('visibilitychange', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      if (timer.current) window.clearTimeout(timer.current)
      void flush()
    }
  }, [flush])

  const refresh = useCallback(async () => {
    try {
      const [a, pk, d, e] = await Promise.all([
        listArtifacts(workspaceId, projectId),
        listPromptPackages(workspaceId, projectId),
        listDecisions(workspaceId, projectId),
        listEvidence(workspaceId, projectId),
      ])
      setArtifacts(a)
      setPrompts(pk)
      setDecisions(d)
      setEvidence(e)
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : '다시 읽지 못했습니다.')
    }
  }, [workspaceId, projectId, showToast])

  const decide = useCallback<EditorValue['decide']>(
    async (input) => {
      if (!latest.current) return
      try {
        await recordDecision({ workspaceId, userId }, latest.current, input)
        setDecisions(await listDecisions(workspaceId, projectId))
      } catch (cause) {
        showToast(cause instanceof Error ? cause.message : '결정을 기록하지 못했습니다.')
      }
    },
    [workspaceId, userId, projectId, showToast],
  )

  const goTo = useCallback(
    (nextTab: string, nextFocus?: string) => {
      const params: Record<string, string> = {}
      if (nextTab !== 'overview') params.tab = nextTab
      if (nextFocus) params.focus = nextFocus
      setSearchParams(params, { replace: true })
      window.scrollTo({ top: 0 })
    },
    [setSearchParams],
  )

  const value = useMemo<EditorValue | null>(
    () =>
      project
        ? { workspaceId, userId, today, project, artifacts, prompts, decisions, evidence, update, refresh, decide, goTo, toast: showToast }
        : null,
    [workspaceId, userId, today, project, artifacts, prompts, decisions, evidence, update, refresh, decide, goTo, showToast],
  )

  const setStatus = (status: ProjectStatus) => {
    update((p) => ({ ...p, status }))
    void decide({ stageKey: latest.current?.currentStage ?? 'S0', kind: 'scope', summary: `프로젝트 상태 → ${STATUS_LABEL[status]}` })
    setMoreOpen(false)
  }

  const doDelete = async () => {
    if (!project) return
    try {
      await deleteProject(project)
      showToast('프로젝트를 지웠습니다.')
      navigate('/studio')
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : '지우지 못했습니다.')
    }
  }

  if (missing) return <TablesMissingNotice />
  if (loading && !project) return <p className="t-sub py-10 text-center text-slate-500">불러오는 중…</p>
  if (notFound || !project || !value) return <NotFoundState title="프로젝트를 찾지 못했습니다" description="지워졌거나 다른 워크스페이스의 프로젝트입니다." backTo="/studio" backLabel="컨설팅 작업실" />

  const progress = projectProgress(project)

  return (
    <EditorContext.Provider value={value}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Link to="/studio" className="t-sub inline-flex w-fit items-center gap-1 text-slate-500 hover:text-slate-800">
            <ArrowLeft aria-hidden="true" className="size-4" /> 컨설팅 작업실
          </Link>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              {/* 회사는 윗줄(눈썹), 제목은 아랫줄 — 휴대폰에서 "회사 · 제목" 한 줄이 세 줄로 접히지 않게 */}
              <Link to={`/ops/clients/${project.clientId}`} className="t-sub inline-block font-semibold text-brand-700 hover:underline">
                {project.clientName || '고객'}
              </Link>
              <h1 className="t-page break-keep text-slate-900">{project.title}</h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className="t-body font-semibold text-slate-800">{stageTitle(project.currentStage)}</span>
                <StageBadge status={project.stages[project.currentStage].status} />
                <Badge tone="neutral">{progress.done}/{progress.total} 단계</Badge>
                {project.status !== 'active' && <Badge tone={project.status === 'done' ? 'success' : 'warning'}>{STATUS_LABEL[project.status]}</Badge>}
              </div>
            </div>
            <Button variant="ghost" onClick={() => setMoreOpen(true)}>
              <MoreHorizontal aria-hidden="true" className="size-4" /> 더보기
            </Button>
          </div>
        </div>

        <div
          role="tablist"
          aria-label="프로젝트 영역"
          className="sticky top-16 z-20 -mx-4 flex gap-1 overflow-x-auto border-b border-slate-200 bg-slate-50/95 px-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => goTo(t.key)}
              className={`t-body -mb-px flex min-h-12 shrink-0 items-center border-b-2 px-3 font-semibold whitespace-nowrap ${tab === t.key ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'overview' && <OverviewTab />}
        {tab === 'stages' && <StagesTab focus={focus} />}
        {tab === 'factsheet' && <FactsheetTab focus={focus} />}
        {tab === 'thread' && <ThreadTab focus={focus} />}
        {tab === 'patent' && <PatentTab focus={focus} />}
        {tab === 'mvp' && <MvpTab focus={focus} />}
        {tab === 'venture' && <VentureTab focus={focus} />}
        {tab === 'evidence' && <EvidenceTab />}
        {tab === 'prompts' && <PromptsTab focus={focus} />}
        {tab === 'artifacts' && <ArtifactsTab focus={focus} />}
        {tab === 'decisions' && <DecisionsTab />}
        {tab === 'review' && <FieldReviewTab focus={focus} />}

        <SavedBadge savedAt={savedAt} />

        {moreOpen && (
          <BottomSheet title="프로젝트" onClose={() => setMoreOpen(false)}>
            <div className="flex flex-col gap-3">
              <TextField label="프로젝트 이름" value={project.title} onCommit={(v) => update((p) => ({ ...p, title: v }))} />
              <div className="flex flex-wrap gap-2">
                {(['active', 'on_hold', 'done', 'archived'] as ProjectStatus[]).map((s) => (
                  <Button key={s} variant={project.status === s ? 'primary' : 'secondary'} size="sm" onClick={() => setStatus(s)}>{STATUS_LABEL[s]}</Button>
                ))}
              </div>
              <Button variant="secondary" onClick={() => { setMoreOpen(false); navigate(`/ops/clients/${project.clientId}`) }}>고객 상세 열기</Button>
              <Button variant="danger" onClick={() => { setMoreOpen(false); setDeleteStep(1) }}>프로젝트 삭제</Button>
            </div>
          </BottomSheet>
        )}

        <Modal
          open={deleteStep === 1}
          title="정말 지울까요?"
          onClose={() => setDeleteStep(0)}
          footer={
            <>
              <Button onClick={() => setDeleteStep(0)}>취소</Button>
              <Button variant="danger" onClick={() => setDeleteStep(2)}>예, 다음</Button>
            </>
          }
        >
          이 프로젝트의 단계·사실표·산출물·프롬프트·결정·증빙이 모두 지워집니다. 고객 기록은 그대로 남습니다.
        </Modal>
        <Modal
          open={deleteStep === 2}
          title="한 번 더 확인"
          onClose={() => { setDeleteStep(0); setDeleteTyped('') }}
          footer={
            <>
              <Button onClick={() => { setDeleteStep(0); setDeleteTyped('') }}>취소</Button>
              <Button variant="danger" disabled={deleteTyped.trim() !== project.title.trim()} onClick={() => void doDelete()}>지우기</Button>
            </>
          }
        >
          <p>프로젝트 이름 <strong className="text-slate-900">{project.title}</strong> 을(를) 그대로 적으면 지워집니다.</p>
          <input aria-label="프로젝트 이름 확인" value={deleteTyped} onChange={(e) => setDeleteTyped(e.target.value)} className="t-body mt-3 w-full rounded-(--radius-control) border border-slate-300 px-3 py-2" />
        </Modal>
      </div>
    </EditorContext.Provider>
  )
}

export function ConsultingProjectPage() {
  return <WorkspaceScope>{({ workspaceId, userId }) => <ProjectContent workspaceId={workspaceId} userId={userId} />}</WorkspaceScope>
}
