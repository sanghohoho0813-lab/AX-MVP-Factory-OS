import { NavLink, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, FileText } from 'lucide-react'
import type { FundingStrategy } from '../../types/funding'
import { CaseStatusBadge, CaseVisibilityBadge, ConsentBadge } from '../../components/funding/badges'
import { Button } from '../../components/ui/Button'
import { HelpNote } from '../../components/ui/HelpNote'
import { Panel } from '../../components/ui/Panel'
import { useToast } from '../../components/ui/toastContext'
import {
  canCreateCase,
  createCaseFromStrategy,
  getCasesByProject,
} from '../../services/caseStudyService'
import { FundingStrategyFrame } from './fundingShared'

function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : '처리 중 오류가 발생했습니다.'
}

export function FundingCasePage() {
  const { projectId = '' } = useParams()
  return (
    <FundingStrategyFrame
      projectId={projectId}
      render={(strategy) => <CaseContent strategy={strategy} projectId={projectId} />}
    />
  )
}

function CaseContent({ strategy, projectId }: { strategy: FundingStrategy; projectId: string }) {
  const navigate = useNavigate()
  const { showToast } = useToast()

  const creatable = canCreateCase(strategy.id)
  const cases = getCasesByProject(projectId)

  const createDraft = () => {
    try {
      const created = createCaseFromStrategy(strategy.id)
      showToast('사례 초안을 만들었습니다.')
      navigate(`/cases/${created.id}`)
    } catch (err) {
      showToast(toErrorMessage(err))
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <HelpNote
        summary="실제 결과를 바탕으로 사례를 정리합니다. 사례는 실제 결과 기반이며 공개는 고객 동의가 필요합니다."
        what="확정·기록된 실제 결과를 재사용 가능한 사례 자산으로 정리합니다."
        when="승인·부결 등 실제 결과가 기록된 뒤 사용합니다."
        next="사례 라이브러리에서 익명화·동의 확인 후 승인·공개합니다."
      />

      {!creatable.ok ? (
        <Panel title="사례 만들기" flush>
          <div className="flex flex-col items-start gap-3 px-5 py-6">
            <div className="flex items-start gap-2 rounded-(--radius-card) border border-warning-200 bg-warning-50/60 px-4 py-3">
              <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning-600" />
              <p className="text-[13px] break-keep text-warning-800">{creatable.reason}</p>
            </div>
            <NavLink
              to={`/funding/projects/${projectId}/outcome`}
              className="text-[13px] font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800"
            >
              결과·성과 화면으로 이동해 실제 결과 기록하기
            </NavLink>
          </div>
        </Panel>
      ) : cases.length === 0 ? (
        <Panel title="사례 만들기" flush>
          <div className="flex flex-col items-start gap-4 px-5 py-6">
            <p className="text-[13px] break-keep text-slate-600">
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
                  <p className="min-w-0 text-sm font-semibold break-keep text-slate-900">{c.title || '제목 없음'}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <CaseStatusBadge status={c.status} />
                  <CaseVisibilityBadge visibility={c.visibility} />
                  <ConsentBadge status={c.consentStatus} />
                </div>
                <p className="text-[13px] break-keep text-slate-600">{c.outcomeSummary || '결과 요약 없음'}</p>
                <div className="mt-1">
                  <Button variant="secondary" size="sm" onClick={() => navigate(`/cases/${c.id}`)}>열기</Button>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  )
}
