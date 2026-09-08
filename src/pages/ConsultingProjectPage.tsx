/**
 * 컨설팅 프로젝트 — 기본은 간단 모드.
 *
 *   진행하기 · 결과물 · 기록   세 곳뿐이다.
 *   기존 12탭은 '고급 보기'(?adv=1) 안으로 들어갔다. 지워진 것은 없다.
 *
 * 자동저장: update(fn) 은 즉시 화면에 반영하고 700ms 뒤 한 번 저장한다.
 * submitTask 는 값 저장 · 결정 기록 · 단계 전환을 한 번에 처리한다(§43).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, MoreHorizontal, SlidersHorizontal } from 'lucide-react'
import { WorkspaceScope } from '../components/workspace/WorkspaceScope'
import { Badge, BottomSheet } from '../components/ui/primitives'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { NotFoundState } from '../components/ui/NotFoundState'
import { useToast } from '../components/ui/toastContext'
import { SavedBadge } from '../components/ops/opsControls'
import { EditorContext, type EditorValue } from '../components/consulting/editorContext'
import { ProgressTab } from '../components/consulting/simple/ProgressTab'
import { ResultsTab } from '../components/consulting/simple/ResultsTab'
import { TimelineTab } from '../components/consulting/simple/TimelineTab'
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
import { TablesMissingNotice, TextField, stageTitle } from '../components/consulting/studioParts'
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
import { applyTask } from '../domain/consulting/applyTask'
import { resolveCurrentTask } from '../domain/consulting/currentTask'
import { nowIso, todayLocalDate } from '../lib/appClock'
import type { ConsultingArtifact, ConsultingDecision, ConsultingEvidence, ConsultingProject, ConsultingPromptPackage, ProjectStatus } from '../types/consulting'

/* 간단 모드 3개 + 고급 12개 */
type SimpleTab = 'progress' | 'results' | 'timeline'
const SIMPLE_TABS: { key: SimpleTab; label: string }[] = [
  { key: 'progress', label: '진행하기' },
  { key: 'results', label: '결과물' },
  { key: 'timeline', label: '기록' },
]

type AdvTab = 'overview' | 'stages' | 'factsheet' | 'thread' | 'patent' | 'mvp' | 'venture' | 'evidence' | 'prompts' | 'artifacts' | 'decisions' | 'review'
const ADV_TABS: { key: AdvTab; label: string }[] = [
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

const STATUS_LABEL: Record<ProjectStatus, string> = { active: '진행 중', on_hold: '보류', done: '끝남', archived: '보관' }

function ProjectContent({ workspaceId, userId }: { workspaceId: string | null; userId: string | null }) {
  const { projectId = '' } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { showToast } = useToast()
  const today = todayLocalDate()

  const advanced = searchParams.get('adv') === '1'
  const rawTab = searchParams.get('tab')
  const simpleTab: SimpleTab = SIMPLE_TABS.some((t) => t.key === rawTab) ? (rawTab as SimpleTab) : 'progress'
  const advTab: AdvTab = ADV_TABS.some((t) => t.key === rawTab) ? (rawTab as AdvTab) : 'overview'
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

  /** §43 — 한 번 누르면 값 저장 · 기록 · 단계 전환까지 */
  const submitTask = useCallback<EditorValue['submitTask']>(
    async (task, sub, extra) => {
      const base = latest.current
      if (!base) return
      const at = nowIso()
      const ctx = {
        artifacts: [...(extra?.extraArtifacts ?? []), ...artifacts],
        prompts: [...(extra?.extraPrompts ?? []), ...prompts],
        evidence,
        today,
      }
      const outcome = applyTask(base, task, sub, ctx, at)
      latest.current = outcome.project
      setProject(outcome.project)
      dirty.current = false
      try {
        const saved = await saveProject(outcome.project)
        latest.current = saved
        setProject(saved)
        setSavedAt(Date.now())
      } catch (cause) {
        showToast(cause instanceof Error ? cause.message : '저장하지 못했습니다.')
        void load()
        return
      }
      for (const d of outcome.decisions.slice(0, 4)) {
        try {
          await recordDecision({ workspaceId, userId }, outcome.project, d)
        } catch {
          // 기록 실패는 진행을 막지 않는다
        }
      }
      setDecisions(await listDecisions(workspaceId, projectId).catch(() => decisions))
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    [artifacts, prompts, evidence, today, workspaceId, userId, projectId, decisions, showToast, load],
  )

  const goTo = useCallback(
    (nextTab: string, nextFocus?: string) => {
      const params: Record<string, string> = {}
      const isAdv = ADV_TABS.some((t) => t.key === nextTab)
      if (isAdv) params.adv = '1'
      else if (advanced && SIMPLE_TABS.some((t) => t.key === nextTab)) {
        // 간단 탭으로 가면 고급 보기를 나온다
      } else if (advanced) params.adv = '1'
      if (nextTab !== 'progress' && nextTab !== 'overview') params.tab = nextTab
      if (nextFocus) params.focus = nextFocus
      setSearchParams(params, { replace: true })
      window.scrollTo({ top: 0 })
    },
    [setSearchParams, advanced],
  )

  const value = useMemo<EditorValue | null>(
    () =>
      project
        ? { workspaceId, userId, today, project, artifacts, prompts, decisions, evidence, update, refresh, decide, submitTask, goTo, toast: showToast }
        : null,
    [workspaceId, userId, today, project, artifacts, prompts, decisions, evidence, update, refresh, decide, submitTask, goTo, showToast],
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

  const task = resolveCurrentTask(project, { artifacts, prompts, evidence, today })
  const tabs = advanced ? ADV_TABS : SIMPLE_TABS
  const activeTab: string = advanced ? advTab : simpleTab
  /*
    간단 모드는 읽는 화면이다. 1440·1920 에서 카드를 화면 끝까지 늘이면
    제목과 버튼이 멀어져 '지금 할 일' 이 한눈에 안 들어온다 — 읽기 좋은 폭으로 묶는다.
    고급 보기는 표·2단이 있으므로 그대로 전폭을 쓴다.
  */
  const narrow = advanced ? '' : 'max-w-3xl'

  return (
    <EditorContext.Provider value={value}>
      <div className="flex flex-col gap-4">
        {/*
          위쪽 줄에 돌아가기와 부가 버튼을 함께 둔다.
          제목과 같은 줄에 두면 좁은 폭(360×1.3배)에서 제목 칸이 88px 로 눌려
          글자가 세로로 흐른다 (D-23). 제목은 항상 한 줄을 다 쓴다.
        */}
        <div className={`flex flex-col gap-2 ${narrow}`}>
          <div className="flex items-center justify-between gap-2">
            <Link to="/studio" className="t-sub inline-flex min-w-0 items-center gap-1 text-slate-500 hover:text-slate-800">
              <ArrowLeft aria-hidden="true" className="size-4 shrink-0" /> <span className="truncate">컨설팅 작업실</span>
            </Link>
            <div className="flex shrink-0 items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => setSearchParams(advanced ? {} : { adv: '1' }, { replace: true })}>
                <SlidersHorizontal aria-hidden="true" className="size-4" />
                <span className="hidden sm:inline">{advanced ? '간단히' : '고급'}</span>
              </Button>
              <Button variant="ghost" size="sm" aria-label="프로젝트 설정" onClick={() => setMoreOpen(true)}>
                <MoreHorizontal aria-hidden="true" className="size-4" />
              </Button>
            </div>
          </div>
          <div className="min-w-0">
            <Link to={`/ops/clients/${project.clientId}`} className="t-sub inline-block font-semibold text-brand-700 hover:underline">
              {project.clientName || '고객'}
            </Link>
            <h1 className="t-page break-keep text-slate-900">{project.title}</h1>
            {/*
              간단 모드에서는 단계 번호를 크게 쓰지 않는다.
              '진행하기' 탭에서는 바로 아래 카드가 같은 말을 하므로 여기서는 생략한다 — 같은 말을 두 번 하지 않는다.
            */}
            {(advanced || simpleTab !== 'progress' || project.status !== 'active') && (
              <p className="t-sub mt-1 break-keep text-slate-500">
                {advanced ? stageTitle(project.currentStage) : task.finished ? '마무리 단계입니다' : task.headline}
                {project.status !== 'active' && <> · <Badge tone={project.status === 'done' ? 'success' : 'warning'}>{STATUS_LABEL[project.status]}</Badge></>}
              </p>
            )}
          </div>
        </div>

        <div className="sticky top-16 z-20 -mx-4 border-b border-slate-200 bg-slate-50/95 px-4 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10">
          <div
            role="tablist"
            aria-label="프로젝트 영역"
            className={`flex gap-1 ${advanced ? 'overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden' : narrow}`}
          >
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={activeTab === t.key}
                onClick={() => goTo(t.key)}
                className={`t-body -mb-px flex min-h-12 shrink-0 items-center border-b-2 px-3 font-semibold whitespace-nowrap ${
                  activeTab === t.key ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'
                } ${advanced ? '' : 'flex-1 justify-center'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {!advanced && (
          <div className={narrow}>
            {simpleTab === 'progress' && <ProgressTab onOpenAdvanced={() => setSearchParams({ adv: '1' }, { replace: true })} />}
            {simpleTab === 'results' && <ResultsTab />}
            {simpleTab === 'timeline' && <TimelineTab />}
          </div>
        )}

        {advanced && (
          <>
            <p className="t-meta break-keep text-slate-500">
              고급 보기입니다. 단계·사실표·핵심 줄기·증빙을 직접 다룰 수 있습니다. 평소에는 열지 않아도 됩니다.
            </p>
            {advTab === 'overview' && <OverviewTab />}
            {advTab === 'stages' && <StagesTab focus={focus} />}
            {advTab === 'factsheet' && <FactsheetTab focus={focus} />}
            {advTab === 'thread' && <ThreadTab focus={focus} />}
            {advTab === 'patent' && <PatentTab focus={focus} />}
            {advTab === 'mvp' && <MvpTab focus={focus} />}
            {advTab === 'venture' && <VentureTab focus={focus} />}
            {advTab === 'evidence' && <EvidenceTab />}
            {advTab === 'prompts' && <PromptsTab focus={focus} />}
            {advTab === 'artifacts' && <ArtifactsTab focus={focus} />}
            {advTab === 'decisions' && <DecisionsTab />}
            {advTab === 'review' && <FieldReviewTab focus={focus} />}
          </>
        )}

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
              <Button variant="secondary" onClick={() => { setMoreOpen(false); setSearchParams({ adv: '1' }, { replace: true }) }}>고급 보기 열기</Button>
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
