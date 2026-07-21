import { useMemo } from 'react'
import { NavLink, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, FileText } from 'lucide-react'
import { useStoreVersion } from '../../lib/useStoreVersion'
import { CaseStatusBadge, CaseVisibilityBadge, ConsentBadge } from '../../components/funding/badges'
import { Button } from '../../components/ui/Button'
import { HelpNote } from '../../components/ui/HelpNote'
import { NotFoundState } from '../../components/ui/NotFoundState'
import { Panel } from '../../components/ui/Panel'
import { useToast } from '../../components/ui/toastContext'
import {
  WorkspaceShell,
  WorkspaceNextAction,
} from '../../components/workspace/WorkspaceShell'
import {
  canCreateCase,
  createCaseFromStrategy,
  getCasesByProject,
} from '../../services/caseStudyService'
import {
  getProjectFundingContext,
  type ProjectFundingContext,
} from '../../services/fundingService'

const MODULE_NAME = '사례 정리'
const MODULE_DESC = '실제 프로젝트 결과와 배운 점을 내부 학습자료 또는 고객 공개 사례로 정리합니다.'

function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : '처리 중 오류가 발생했습니다.'
}

export function FundingCasePage() {
  const { projectId = '' } = useParams()
  const version = useStoreVersion()
  const context = useMemo<ProjectFundingContext | null>(() => {
    return getProjectFundingContext(projectId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, version])

  if (!context) {
    return (
      <NotFoundState
        title="프로젝트를 찾을 수 없습니다"
        description="주소가 잘못되었거나 이미 삭제·이동된 프로젝트입니다."
        backTo="/funding"
        backLabel="기관·자금 연계로"
      />
    )
  }
  return <CaseContent context={context} projectId={projectId} />
}

function CaseContent({ context, projectId }: { context: ProjectFundingContext; projectId: string }) {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const strategy = context.latest

  const createDraft = () => {
    if (!strategy) return
    try {
      const created = createCaseFromStrategy(strategy.id)
      showToast('사례 초안을 만들었습니다.')
      navigate(`/cases/${created.id}`)
    } catch (err) {
      showToast(toErrorMessage(err))
    }
  }

  // 아직 연계 전략이 없는 경우
  if (!strategy) {
    return (
      <WorkspaceShell moduleName={MODULE_NAME} moduleDescription={MODULE_DESC}>
        <Panel title="사례 만들기" flush>
          <div className="flex flex-col items-start gap-3 px-5 py-6">
            <p className="text-[0.95rem] break-keep text-slate-600">
              아직 연계 전략이 없습니다. 먼저 기관·자금 연계에서 전략을 만들고 실제 결과를 기록해야 사례로 정리할 수 있습니다.
            </p>
            <NavLink
              to={`/funding/projects/${projectId}`}
              className="text-[0.95rem] font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800"
            >
              기관·자금 연계 화면으로 이동하기
            </NavLink>
          </div>
        </Panel>
      </WorkspaceShell>
    )
  }

  const creatable = canCreateCase(strategy.id)
  const cases = getCasesByProject(projectId)

  const next: {
    title: string
    why: string
    label: string
    actionPath?: string
    onAction?: () => void
    tone?: 'brand' | 'success'
  } = (() => {
    if (!creatable.ok) {
      return {
        title: '먼저 실제 결과를 기록하세요',
        why: creatable.reason,
        label: '결과·성과 화면으로 이동',
        actionPath: `/funding/projects/${projectId}/outcome`,
      }
    }
    if (cases.length === 0) {
      return {
        title: '사례 초안을 만드세요',
        why: '실제 결과가 기록되어 사례로 정리할 수 있습니다. 초안을 만들면 사례 편집 화면으로 이동합니다.',
        label: '사례 초안 만들기',
        onAction: createDraft,
        tone: 'success' as const,
      }
    }
    return {
      title: '정리한 사례를 확인하세요',
      why: `이 프로젝트에 정리한 사례 ${cases.length}건이 있습니다. 익명화·고객 동의를 확인하고 공개 범위를 관리하세요.`,
      label: '사례 라이브러리로 가기',
      actionPath: '/cases',
    }
  })()

  return (
    <WorkspaceShell
      moduleName={MODULE_NAME}
      moduleDescription={MODULE_DESC}
      nextAction={
        <WorkspaceNextAction
          title={next.title}
          why={next.why}
          actionLabel={next.label}
          actionPath={next.actionPath}
          onAction={next.onAction}
          tone={next.tone}
        />
      }
    >
      <div className="flex flex-col gap-5">
        <HelpNote
          summary="실제 결과를 바탕으로 사례를 정리합니다. 사례는 실제 결과 기반이며 공개는 고객 동의가 필요합니다."
          what="확정·기록된 실제 결과를 재사용 가능한 사례 자산으로 정리합니다."
          when="승인·부결 등 실제 결과가 기록된 뒤 사용합니다. 부결·보류도 실패가 아니라 내부 학습 사례로 정리합니다."
          next="사례 라이브러리에서 익명화·동의 확인 후 확정·공개합니다."
        />

        {!creatable.ok ? (
          <Panel title="사례 만들기" flush>
            <div className="flex flex-col items-start gap-3 px-5 py-6">
              <div className="flex items-start gap-2 rounded-(--radius-card) border border-warning-200 bg-warning-50/60 px-4 py-3">
                <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning-600" />
                <p className="text-[0.95rem] break-keep text-warning-800">{creatable.reason}</p>
              </div>
              <NavLink
                to={`/funding/projects/${projectId}/outcome`}
                className="text-[0.95rem] font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800"
              >
                결과·성과 화면으로 이동해 실제 결과 기록하기
              </NavLink>
            </div>
          </Panel>
        ) : cases.length === 0 ? (
          <Panel title="사례 만들기" flush>
            <div className="flex flex-col items-start gap-4 px-5 py-6">
              <p className="text-[0.95rem] break-keep text-slate-600">
                실제 결과가 기록되어 사례로 정리할 수 있습니다. 초안을 만들면 사례 편집 화면으로 이동합니다.
              </p>
              <Button variant="primary" onClick={createDraft}>
                <FileText aria-hidden="true" className="size-4" />
                사례 초안 만들기
              </Button>
            </div>
          </Panel>
        ) : (
          <Panel
            title={`이 프로젝트의 사례 (${cases.length})`}
            actions={
              <Button variant="secondary" size="sm" onClick={createDraft}>
                <FileText aria-hidden="true" className="size-4" />
                사례 초안 추가
              </Button>
            }
            flush
          >
            <ul className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">
              {cases.map((c) => (
                <li key={c.id} className="flex flex-col gap-3 rounded-(--radius-card) border border-slate-200 bg-white p-4 shadow-(--shadow-card)">
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 text-[1.05rem] font-semibold break-keep text-slate-900">{c.title || '제목 없음'}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <CaseStatusBadge status={c.status} />
                    <CaseVisibilityBadge visibility={c.visibility} />
                    <ConsentBadge status={c.consentStatus} />
                  </div>
                  <p className="text-[0.95rem] break-keep text-slate-600">{c.outcomeSummary || '아직 결과 요약이 없습니다'}</p>
                  <div className="mt-1">
                    <Button variant="secondary" size="sm" onClick={() => navigate(`/cases/${c.id}`)}>열기</Button>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </div>
    </WorkspaceShell>
  )
}
