import {
  CheckCircle2,
  Clock3,
  FileText,
  ListChecks,
  Timer,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useStoreVersion } from '../../lib/useStoreVersion'
import { formatDateTime } from '../../lib/format'
import {
  organizationRepository,
  projectRepository,
  surveyDistributionRepository,
  surveyResponseRepository,
} from '../../repositories'
import {
  answersToMap,
  calculateSurveyProgress,
  evaluateVisibleSnapshotQuestions,
} from '../../services/surveyRuntimeService'
import { isValueAnswered } from '../../services/surveyAnswerBridge'
import { DetailHeader } from '../../components/ui/DetailHeader'
import { NotFoundState } from '../../components/ui/NotFoundState'
import { Panel } from '../../components/ui/Panel'
import { SummaryStrip } from '../../components/ui/SummaryStrip'
import { SurveyAnswerDisplay } from '../../components/runtime/SurveyAnswerDisplay'
import {
  SurveyDistributionStatusBadge,
  SurveyResponseStatusBadge,
} from '../../components/runtime/badges'
import {
  ExpertRiskBadge,
  QuestionCategoryBadge,
  QuestionScopeBadge,
} from '../../components/diagnosis/badges'
import { Button } from '../../components/ui/Button'

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm break-keep text-slate-700">{value || '-'}</dd>
    </div>
  )
}

function durationLabel(start: string | null, end: string | null): string {
  if (!start || !end) return '-'
  const ms = new Date(end).getTime() - new Date(start).getTime()
  if (ms < 0) return '-'
  const mins = Math.round(ms / 60000)
  if (mins < 60) return `${mins}분`
  const h = Math.floor(mins / 60)
  return `${h}시간 ${mins % 60}분`
}

export function ResponseDetailPage() {
  const { distributionId = '' } = useParams()
  const version = useStoreVersion()
  const [showExcluded, setShowExcluded] = useState(false)

  const distribution = useMemo(
    () => surveyDistributionRepository.getById(distributionId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [distributionId, version],
  )
  const response = useMemo(
    () =>
      distribution
        ? surveyResponseRepository.getByDistributionId(distribution.id)
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [distribution?.id, version],
  )

  if (!distribution) {
    return (
      <NotFoundState
        title="설문 링크를 찾을 수 없습니다"
        description="주소가 잘못되었거나 이미 삭제·이동된 링크입니다."
        backTo="/diagnosis/surveys"
        backLabel="설문 관리로 돌아가기"
      />
    )
  }

  const organization = organizationRepository.getById(distribution.organizationId)
  const project = projectRepository.getById(distribution.projectId)

  if (!response || response.status === 'not_started') {
    return (
      <div className="flex flex-col gap-5">
        <DetailHeader
          backTo={`/diagnosis/surveys/${distribution.id}`}
          backLabel="링크 상세"
          title="설문 응답 상세"
          badges={<SurveyDistributionStatusBadge status={distribution.status} />}
        />
        <Panel title="응답 없음">
          <p className="text-[13px] text-slate-500">
            아직 제출되거나 작성된 응답이 없습니다. 응답자가 설문을 시작하면 이곳에서
            원본 답변을 확인할 수 있습니다.
          </p>
        </Panel>
      </div>
    )
  }

  const answerMap = answersToMap(response.answers)
  const snapshot = distribution.blueprintSnapshot
  const visible = evaluateVisibleSnapshotQuestions(snapshot, answerMap)
  const visibleIds = new Set(visible.map((p) => p.questionId))
  const progress = calculateSurveyProgress(snapshot, answerMap)

  const answeredAtOf = new Map(
    response.answers.map((a) => [a.questionId, a.updatedAt]),
  )

  const unanswered = visible.filter(
    (p) => !isValueAnswered(answerMap.get(p.questionId), p.type),
  )
  const excludedCount = snapshot.reduce(
    (n, s) => n + s.placements.filter((p) => !visibleIds.has(p.questionId)).length,
    0,
  )
  const fileAnswers = visible.filter((p) => p.type === 'file')

  return (
    <div className="flex flex-col gap-5">
      <DetailHeader
        backTo={`/diagnosis/surveys/${distribution.id}`}
        backLabel="링크 상세"
        title="설문 응답 상세"
        badges={
          <>
            <SurveyResponseStatusBadge status={response.status} />
            <SurveyDistributionStatusBadge status={distribution.status} />
          </>
        }
        meta={
          <>
            <span>{organization?.name}</span>
            <span>{project?.name}</span>
            <span>{distribution.surveyTitle}</span>
            <span>
              {response.status === 'submitted'
                ? `제출 ${formatDateTime(response.submittedAt)}`
                : `마지막 저장 ${formatDateTime(response.lastSavedAt)}`}
            </span>
          </>
        }
      />

      <SummaryStrip
        ariaLabel="응답 요약"
        items={[
          { key: 'p', label: '진행률', value: progress.progressPercent, unit: '%', tone: 'info', icon: ListChecks },
          { key: 'a', label: '응답 문항', value: progress.answeredVisibleQuestions, unit: '개', tone: 'success', icon: CheckCircle2 },
          { key: 'r', label: '필수 완료', value: progress.answeredRequiredQuestions, unit: `/${progress.totalRequiredQuestions}`, tone: 'warning', icon: Clock3 },
          { key: 'd', label: '작성 기간', value: 0, unit: durationLabel(response.startedAt, response.submittedAt ?? response.lastSavedAt), tone: 'neutral', icon: Timer },
        ]}
      />

      <Panel title="응답자 정보">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-3">
          <Info label="이름" value={response.respondentProfile.name} />
          <Info label="직책" value={response.respondentProfile.position} />
          <Info label="부서" value={response.respondentProfile.department} />
          <Info label="이메일" value={response.respondentProfile.email} />
          <Info label="전화번호" value={response.respondentProfile.phone} />
          <Info
            label="개인정보 동의"
            value={
              response.consented
                ? `동의 (${formatDateTime(response.consentedAt)})`
                : '미동의'
            }
          />
        </dl>
      </Panel>

      {/* 섹션별 응답 */}
      {snapshot.map((section) => {
        const rows = section.placements.filter((p) => visibleIds.has(p.questionId))
        if (rows.length === 0) return null
        return (
          <Panel key={section.id} title={section.title}>
            <ul className="flex flex-col divide-y divide-slate-100">
              {rows.map((p) => (
                <li key={p.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-xs font-semibold text-slate-400">
                      {p.questionCode}
                    </span>
                    <QuestionCategoryBadge category={p.category} />
                    <QuestionScopeBadge scope={p.sourceScope} />
                    {p.required && (
                      <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-500">
                        필수
                      </span>
                    )}
                    {p.expertRiskGrade !== 'green' && (
                      <ExpertRiskBadge grade={p.expertRiskGrade} />
                    )}
                  </div>
                  <p className="mt-1.5 text-sm font-medium break-keep text-slate-800">
                    {p.questionText}
                  </p>
                  <div className="mt-2">
                    <SurveyAnswerDisplay placement={p} value={answerMap.get(p.questionId)} />
                  </div>
                  {answeredAtOf.get(p.questionId) && (
                    <p className="mt-1.5 text-[11px] text-slate-400">
                      응답 {formatDateTime(answeredAtOf.get(p.questionId) ?? null)}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </Panel>
        )
      })}

      {/* 미응답·제외·파일 */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title={`미응답 문항 (${unanswered.length})`}>
          {unanswered.length === 0 ? (
            <p className="text-[13px] text-slate-500">모든 가시 문항에 응답했습니다.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {unanswered.map((p) => (
                <li key={p.id} className="flex items-center gap-2 text-[13px]">
                  <span className="font-mono text-xs text-slate-400">{p.questionCode}</span>
                  <span className="min-w-0 flex-1 truncate text-slate-600">{p.questionText}</span>
                  {p.required ? (
                    <span className="shrink-0 text-xs font-medium text-danger-600">필수</span>
                  ) : (
                    <span className="shrink-0 text-xs text-slate-400">선택</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="파일 응답">
          {fileAnswers.length === 0 ? (
            <p className="text-[13px] text-slate-500">파일 응답이 없습니다.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {fileAnswers.map((p) => (
                <li key={p.id}>
                  <p className="mb-1 text-[13px] text-slate-600">{p.questionText}</p>
                  <SurveyAnswerDisplay placement={p} value={answerMap.get(p.questionId)} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel
        title={`제외 문항 (${excludedCount})`}
        actions={
          excludedCount > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => setShowExcluded((v) => !v)}>
              {showExcluded ? '접기' : '목록 보기'}
            </Button>
          ) : undefined
        }
      >
        <p className="text-[13px] text-slate-500">
          조건에 따라 최종 제출에서 제외된 문항이 {excludedCount}개 있습니다.
        </p>
        {showExcluded && excludedCount > 0 && (
          <ul className="mt-3 flex flex-col gap-1.5">
            {snapshot
              .flatMap((s) => s.placements)
              .filter((p) => !visibleIds.has(p.questionId))
              .map((p) => (
                <li key={p.id} className="flex items-center gap-2 text-[13px]">
                  <span className="font-mono text-xs text-slate-400">{p.questionCode}</span>
                  <span className="min-w-0 flex-1 truncate text-slate-500">{p.questionText}</span>
                </li>
              ))}
          </ul>
        )}
      </Panel>

      <Panel title="내부 검토 메모">
        <p className="flex items-start gap-2 text-[13px] break-keep text-slate-500">
          <FileText aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-slate-400" />
          검토 메모 저장과 AI 응답 요약은 다음 단계에서 제공됩니다. 현재 화면은 구조화된
          원본 답변을 정확하게 확인하는 데 집중합니다.
        </p>
      </Panel>
    </div>
  )
}
