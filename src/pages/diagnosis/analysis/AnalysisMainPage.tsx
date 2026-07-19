import {
  ArrowRight,
  ClipboardCheck,
  GitCompareArrows,
  MessageCircleQuestion,
  Send,
  TriangleAlert,
  Trophy,
} from 'lucide-react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { RESPONDENT_ROLE_META } from '../../../lib/surveyMeta'
import { Button } from '../../../components/ui/Button'
import { EmptyState } from '../../../components/ui/EmptyState'
import { Panel } from '../../../components/ui/Panel'
import { AnalysisNav } from '../../../components/assessment/AnalysisNav'
import {
  AnalysisProgressSteps,
  AssessmentScoreHeadline,
  DataCompletenessPanel,
  RuleVersionInfo,
  WebsiteReadinessSummary,
  type AnalysisStep,
} from '../../../components/assessment/summaryPanels'
import {
  AssessmentStatusBadge,
} from '../../../components/assessment/badges'
import { ComparisonView } from '../../../components/assessment/ComparisonView'
import {
  AnalysisHeader,
  AnalysisHeaderActions,
  NoResponseState,
  ProjectNotFound,
  ReanalysisBanner,
  useAnalysisData,
  useRunAnalysis,
} from './analysisShared'

export function AnalysisMainPage() {
  const { projectId = '' } = useParams()
  const navigate = useNavigate()
  const { context, organization } = useAnalysisData(projectId)
  const runAnalysis = useRunAnalysis(projectId)

  if (!context) return <ProjectNotFound />
  const { project, latest, issues, interviews, submittedCount } = context

  const header = (
    <AnalysisHeader
      project={project}
      organization={organization}
      actions={
        submittedCount > 0 ? (
          <AnalysisHeaderActions context={context} onRun={runAnalysis} />
        ) : undefined
      }
    />
  )

  if (submittedCount === 0) {
    return (
      <div className="flex flex-col gap-5">
        {header}
        <AnalysisNav projectId={projectId} />
        <NoResponseState projectId={projectId} />
      </div>
    )
  }

  if (!latest) {
    return (
      <div className="flex flex-col gap-5">
        {header}
        <AnalysisNav projectId={projectId} />
        <div className="rounded-(--radius-panel) border border-slate-200 bg-white shadow-(--shadow-card)">
          <EmptyState
            icon={Send}
            title="분석을 시작할 수 있습니다"
            description={`제출 완료된 응답 ${submittedCount}건을 기준으로 진단 분석을 실행합니다.`}
            action={
              <Button variant="primary" onClick={runAnalysis}>
                <Send aria-hidden="true" className="size-4" />
                진단 분석 시작
              </Button>
            }
          />
        </div>
      </div>
    )
  }

  const openCritical = issues.filter(
    (i) => i.severity === 'critical' && i.status === 'open',
  ).length
  const topIssues = [...issues]
    .filter((i) => i.status === 'open' || i.status === 'acknowledged')
    .slice(0, 5)
  const topInterviews = [...interviews]
    .filter((q) => q.status === 'suggested' || q.status === 'selected')
    .slice(0, 5)
  const isWebsite = latest.analysisKind === 'website'

  const steps: AnalysisStep[] = [
    { label: '제출 응답 확인', state: 'done', hint: `${submittedCount}건 제출` },
    {
      label: '응답 비교',
      state: latest.comparisons.length > 0 ? 'done' : 'todo',
      hint: isWebsite ? '홈페이지 단독 — 비교 없음' : `비교 ${latest.comparisons.length}건`,
    },
    {
      label: '확인 필요 항목',
      state: openCritical > 0 ? 'attention' : issues.length > 0 ? 'done' : 'todo',
      hint: `이슈 ${issues.length}건 · 미확인 중대 ${openCritical}건`,
    },
    {
      label: '추가 인터뷰',
      state: interviews.some((q) => q.status === 'answered')
        ? 'done'
        : interviews.length > 0
          ? 'todo'
          : 'todo',
      hint: `질문 ${interviews.length}건`,
    },
    {
      label: '점수 검토',
      state:
        latest.status === 'reviewed' || latest.status === 'finalized'
          ? 'reviewed'
          : latest.manualAdjustments.length > 0
            ? 'done'
            : 'todo',
    },
    {
      label: '결과 확정',
      state: latest.status === 'finalized' ? 'finalized' : 'todo',
    },
  ]

  const quickLinks = [
    { to: 'compare', label: '응답자 비교', icon: GitCompareArrows },
    { to: 'issues', label: '확인 필요 항목', icon: TriangleAlert },
    { to: 'interview', label: '추가 인터뷰', icon: MessageCircleQuestion },
    { to: 'score', label: '점수 상세', icon: Trophy },
    { to: 'result', label: '결과 검토', icon: ClipboardCheck },
  ]

  return (
    <div className="flex flex-col gap-5">
      {header}
      <AnalysisNav projectId={projectId} />
      <ReanalysisBanner show={context.needsReanalysisFlag} onRun={runAnalysis} />

      <div className="flex flex-wrap items-center gap-2">
        <AssessmentStatusBadge status={latest.status} />
        <RuleVersionInfo result={latest} />
        <span className="text-xs text-slate-400">
          제출 응답 {latest.sourceResponseIds.length}건 기준
        </span>
      </div>

      {/* 핵심 분석 요약 */}
      <Panel title={isWebsite ? '홈페이지 제작 준비도' : '핵심 분석 요약'}>
        {isWebsite && latest.websiteReadiness ? (
          <WebsiteReadinessSummary website={latest.websiteReadiness} />
        ) : (
          <AssessmentScoreHeadline result={latest} />
        )}
        <p className="mt-4 text-sm break-keep text-slate-600">{latest.autoSummary}</p>
      </Panel>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-5 xl:col-span-2">
          {/* 확인 필요 항목 */}
          <Panel
            title="확인 필요 항목"
            actions={
              <Link
                to="issues"
                className="text-[13px] font-semibold text-brand-600 hover:text-brand-700"
              >
                전체 보기
              </Link>
            }
          >
            {topIssues.length === 0 ? (
              <p className="text-[13px] text-slate-500">확인이 필요한 항목이 없습니다.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {topIssues.map((issue) => (
                  <li
                    key={issue.id}
                    className="flex items-start gap-2 rounded-(--radius-control) border border-slate-100 px-3 py-2"
                  >
                    <TriangleAlert
                      aria-hidden="true"
                      className={`mt-0.5 size-4 shrink-0 ${
                        issue.severity === 'critical' ? 'text-danger-500' : 'text-warning-500'
                      }`}
                    />
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-slate-700">{issue.title}</p>
                      <p className="truncate text-xs text-slate-400">{issue.description}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* 응답자 비교 요약 */}
          {!isWebsite && (
            <Panel
              title="응답자 비교"
              actions={
                <Link
                  to="compare"
                  className="text-[13px] font-semibold text-brand-600 hover:text-brand-700"
                >
                  전체 보기
                </Link>
              }
            >
              <ComparisonView
                items={latest.comparisons
                  .filter((c) => c.status === 'major_gap' || c.status === 'minor_gap')
                  .slice(0, 3)}
              />
            </Panel>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          {/* 진행 단계 */}
          <Panel title="분석 진행 순서">
            <AnalysisProgressSteps steps={steps} />
          </Panel>

          {/* 데이터 충분도 */}
          {!isWebsite && (
            <Panel title="분석 신뢰도·데이터 충분도">
              <DataCompletenessPanel result={latest} />
            </Panel>
          )}

          {/* 추가 인터뷰 */}
          <Panel
            title="추가 인터뷰"
            actions={
              <Link
                to="interview"
                className="text-[13px] font-semibold text-brand-600 hover:text-brand-700"
              >
                전체 보기
              </Link>
            }
          >
            {topInterviews.length === 0 ? (
              <p className="text-[13px] text-slate-500">제안된 인터뷰 질문이 없습니다.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {topInterviews.map((q) => (
                  <li key={q.id} className="rounded-(--radius-control) border border-slate-100 px-3 py-2">
                    <p className="text-[13px] break-keep text-slate-700">{q.question}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {RESPONDENT_ROLE_META[q.targetRespondentRole].label} 대상
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* 빠른 이동 */}
          <Panel title="빠른 이동">
            <div className="flex flex-col gap-2">
              {quickLinks.map((item) => (
                <button
                  key={item.to}
                  type="button"
                  onClick={() => navigate(item.to)}
                  className="flex items-center gap-2.5 rounded-(--radius-control) border border-slate-200 px-3.5 py-2.5 text-sm font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                >
                  <item.icon aria-hidden="true" className="size-4 text-slate-400" />
                  {item.label}
                  <ArrowRight aria-hidden="true" className="ml-auto size-4 text-slate-300" />
                </button>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}
