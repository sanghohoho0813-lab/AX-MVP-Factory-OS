import {
  ArrowRight,
  ChevronDown,
  ClipboardCheck,
  GitCompareArrows,
  MessageCircleQuestion,
  Send,
  TriangleAlert,
  Trophy,
} from 'lucide-react'
import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { RESPONDENT_ROLE_META } from '../../../lib/surveyMeta'
import { Button } from '../../../components/ui/Button'
import { EmptyState } from '../../../components/ui/EmptyState'
import { Panel } from '../../../components/ui/Panel'
import { DiagnosisFlowShell } from '../../../components/diagnosis/DiagnosisFlowShell'
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
  NoResponseState,
  ProjectNotFound,
  ReanalysisBanner,
  useAnalysisData,
  useRunAnalysis,
} from './analysisShared'
import { ScreenGuide } from '../../../components/onboarding/ScreenGuide'

export function AnalysisMainPage() {
  const { projectId = '' } = useParams()
  const navigate = useNavigate()
  const { context } = useAnalysisData(projectId)
  const runAnalysis = useRunAnalysis(projectId)
  const [showExpert, setShowExpert] = useState(false)

  if (!context) return <ProjectNotFound />
  const { latest, issues, interviews, submittedCount } = context

  if (submittedCount === 0) {
    return (
      <DiagnosisFlowShell projectId={projectId} step="result">
        <NoResponseState projectId={projectId} />
      </DiagnosisFlowShell>
    )
  }

  if (!latest) {
    return (
      <DiagnosisFlowShell projectId={projectId} step="result">
        <div className="rounded-(--radius-panel) border border-slate-200 bg-white shadow-(--shadow-card)">
          <EmptyState
            icon={Send}
            title="진단 결과를 만들 수 있습니다"
            description={`제출 완료된 응답 ${submittedCount}건을 기준으로 진단 결과를 만듭니다. 결과가 나오면 먼저 만들 업무를 비교할 수 있습니다.`}
            action={
              <Button variant="primary" onClick={runAnalysis}>
                <Send aria-hidden="true" className="size-4" />
                제출된 응답으로 진단 결과 만들기
              </Button>
            }
          />
        </div>
      </DiagnosisFlowShell>
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
    <DiagnosisFlowShell projectId={projectId} step="result">
      <div className="flex flex-col gap-5">
        <div className="flex justify-end">
          <ScreenGuide screenKey="diagnosis" />
        </div>
        <ReanalysisBanner show={context.needsReanalysisFlag} onRun={runAnalysis} />

        {/* 의사결정 히어로 */}
        <section className="rounded-(--radius-panel) border border-brand-100 bg-brand-50/50 p-6 sm:p-7">
          <h1 className="text-[1.5rem] leading-snug font-bold break-keep text-slate-900 sm:text-[1.65rem]">
            {isWebsite ? '홈페이지 제작 준비 상태를 확인했습니다.' : '이 기업에서 먼저 개선할 업무를 비교할 준비가 되었습니다.'}
          </h1>
          <p className="mt-3 max-w-3xl text-[1.05rem] leading-relaxed break-keep text-slate-600">{latest.autoSummary}</p>
          {!isWebsite && (
            <Button variant="primary" className="mt-5 h-12 px-6 text-[1.05rem]" onClick={() => navigate(`/selection/projects/${projectId}`)}>
              먼저 만들 업무 비교하기<ArrowRight aria-hidden="true" className="size-5" />
            </Button>
          )}
        </section>

        {/* 핵심 결론 — AX 도입 적합성 */}
        <Panel title={isWebsite ? '홈페이지 제작 준비도' : 'AX 도입 적합성'}>
          {isWebsite && latest.websiteReadiness ? (
            <WebsiteReadinessSummary website={latest.websiteReadiness} />
          ) : (
            <AssessmentScoreHeadline result={latest} />
          )}
        </Panel>

        {/* 역할별 의견 차이 */}
        {!isWebsite && (
          <Panel title="역할별 의견 차이" actions={<Link to="compare" className="text-[0.9rem] font-semibold text-brand-600 hover:text-brand-700">전체 보기</Link>}>
            <ComparisonView items={latest.comparisons.filter((c) => c.status === 'major_gap' || c.status === 'minor_gap').slice(0, 3)} />
          </Panel>
        )}

        {/* 주요 문제 */}
        <Panel title="주요 문제" actions={<Link to="issues" className="text-[0.9rem] font-semibold text-brand-600 hover:text-brand-700">전체 보기</Link>}>
          {topIssues.length === 0 ? (
            <p className="text-[0.95rem] text-slate-500">확인이 필요한 항목이 없습니다.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {topIssues.map((issue) => (
                <li key={issue.id} className="flex items-start gap-2 rounded-(--radius-control) border border-slate-100 px-3.5 py-2.5">
                  <TriangleAlert aria-hidden="true" className={`mt-0.5 size-5 shrink-0 ${issue.severity === 'critical' ? 'text-danger-500' : 'text-warning-500'}`} />
                  <div className="min-w-0">
                    <p className="text-[0.98rem] font-medium text-slate-700">{issue.title}</p>
                    <p className="break-keep text-[0.9rem] text-slate-500">{issue.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* 추가 확인 질문 */}
        <Panel title="추가로 확인할 질문" actions={<Link to="interview" className="text-[0.9rem] font-semibold text-brand-600 hover:text-brand-700">전체 보기</Link>}>
          {topInterviews.length === 0 ? (
            <p className="text-[0.95rem] text-slate-500">제안된 추가 질문이 없습니다.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {topInterviews.map((q) => (
                <li key={q.id} className="rounded-(--radius-control) border border-slate-100 px-3.5 py-2.5">
                  <p className="text-[0.98rem] break-keep text-slate-700">{q.question}</p>
                  <p className="mt-0.5 text-[0.88rem] text-slate-500">{RESPONDENT_ROLE_META[q.targetRespondentRole].label} 대상 · 왜 필요한지 확인 후 질문하세요.</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* 전문가 분석 상세 (기본 접힘) */}
        <div className="rounded-(--radius-panel) border border-slate-200 bg-white">
          <button type="button" onClick={() => setShowExpert((v) => !v)} aria-expanded={showExpert}
            className="flex w-full items-center justify-between gap-2 px-5 py-4 text-left text-[1rem] font-semibold text-slate-700">
            전문가 분석 상세 (점수·근거·진행 순서)
            <ChevronDown aria-hidden="true" className={`size-5 transition-transform ${showExpert ? 'rotate-180' : ''}`} />
          </button>
          {showExpert && (
            <div className="flex flex-col gap-5 border-t border-slate-100 px-5 py-5">
              <div className="flex flex-wrap items-center gap-2">
                <AssessmentStatusBadge status={latest.status} />
                <RuleVersionInfo result={latest} />
                <span className="text-[0.85rem] text-slate-400">제출 응답 {latest.sourceResponseIds.length}건 기준</span>
              </div>
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <Panel title="분석 진행 순서"><AnalysisProgressSteps steps={steps} /></Panel>
                {!isWebsite && <Panel title="분석 신뢰도·데이터 충분도"><DataCompletenessPanel result={latest} /></Panel>}
              </div>
              <div className="flex flex-wrap gap-2">
                {quickLinks.map((item) => (
                  <button key={item.to} type="button" onClick={() => navigate(item.to)}
                    className="flex items-center gap-2 rounded-(--radius-control) border border-slate-200 px-3.5 py-2.5 text-[0.9rem] font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50">
                    <item.icon aria-hidden="true" className="size-4 text-slate-400" />{item.label}
                    <ArrowRight aria-hidden="true" className="size-4 text-slate-300" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </DiagnosisFlowShell>
  )
}
