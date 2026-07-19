import { useState } from 'react'
import { CheckCircle2, ListChecks, MessageCircleQuestion, Plus } from 'lucide-react'
import { useParams } from 'react-router-dom'
import type { InterviewQuestion } from '../../../types/assessment'
import type { RespondentRole } from '../../../types'
import { RESPONDENT_ROLE_META } from '../../../lib/surveyMeta'
import { Button } from '../../../components/ui/Button'
import { EmptyState } from '../../../components/ui/EmptyState'
import { Modal } from '../../../components/ui/Modal'
import { Panel } from '../../../components/ui/Panel'
import { SummaryStrip } from '../../../components/ui/SummaryStrip'
import { useToast } from '../../../components/ui/toastContext'
import { AnalysisNav } from '../../../components/assessment/AnalysisNav'
import { InterviewList } from '../../../components/assessment/InterviewList'
import {
  addManualInterviewQuestion,
  excludeInterviewQuestion,
  recordInterviewAnswer,
  selectInterviewQuestion,
} from '../../../services/assessmentService'
import {
  AnalysisHeader,
  ProjectNotFound,
  useAnalysisData,
} from './analysisShared'

const ROLES: RespondentRole[] = ['owner', 'manager', 'worker']

export function InterviewQuestionsPage() {
  const { projectId = '' } = useParams()
  const { showToast } = useToast()
  const { context, organization } = useAnalysisData(projectId)
  const [addOpen, setAddOpen] = useState(false)
  const [text, setText] = useState('')
  const [role, setRole] = useState<RespondentRole>('manager')

  if (!context) return <ProjectNotFound />
  const { project, interviews } = context

  const suggested = interviews.filter((q) => q.status === 'suggested')
  const active = interviews.filter(
    (q) => q.status === 'selected' || q.status === 'answered',
  )
  const excluded = interviews.filter((q) => q.status === 'excluded')

  const actions = {
    onSelect: (q: InterviewQuestion) => {
      selectInterviewQuestion(q.id)
      showToast('인터뷰 질문으로 선택했습니다.')
    },
    onExclude: (q: InterviewQuestion) => {
      excludeInterviewQuestion(q.id)
      showToast('질문을 제외했습니다.')
    },
    onAnswer: (q: InterviewQuestion, answer: string) => {
      recordInterviewAnswer(q.id, answer)
      showToast('인터뷰 답변을 기록했습니다. 재분석 시 반영됩니다.')
    },
  }

  const submitManual = () => {
    if (text.trim() === '') {
      showToast('질문을 입력해 주세요.')
      return
    }
    addManualInterviewQuestion(projectId, text.trim(), role)
    setText('')
    setAddOpen(false)
    showToast('수동 질문을 추가했습니다.')
  }

  return (
    <div className="flex flex-col gap-5">
      <AnalysisHeader
        project={project}
        organization={organization}
        actions={
          <Button variant="secondary" onClick={() => setAddOpen(true)}>
            <Plus aria-hidden="true" className="size-4" />
            수동 질문 추가
          </Button>
        }
      />
      <AnalysisNav projectId={projectId} />

      <p className="text-sm break-keep text-slate-500">
        설문만으로 확인되지 않은 업무 흐름·수치·모순을 보완할 질문을 정리합니다. 인터뷰 답변을
        기록하면 재분석 시 근거로 반영할 수 있습니다.
      </p>

      <SummaryStrip
        ariaLabel="추가 인터뷰 요약"
        items={[
          { key: 'suggested', label: '자동 제안', value: suggested.length, unit: '건', tone: 'neutral', icon: MessageCircleQuestion },
          { key: 'selected', label: '선택·진행', value: active.length, unit: '건', tone: 'info', icon: ListChecks },
          { key: 'answered', label: '답변 완료', value: interviews.filter((q) => q.status === 'answered').length, unit: '건', tone: 'success', icon: CheckCircle2 },
        ]}
      />

      {interviews.length === 0 ? (
        <div className="rounded-(--radius-panel) border border-slate-200 bg-white shadow-(--shadow-card)">
          <EmptyState
            icon={MessageCircleQuestion}
            title="추가 인터뷰 질문이 없습니다"
            description="분석을 실행하면 확인이 필요한 항목에 대한 인터뷰 질문이 자동 생성됩니다."
          />
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <Panel title={`선택·진행 중 질문 (${active.length})`}>
              <InterviewList questions={active} {...actions} />
            </Panel>
          )}
          {suggested.length > 0 && (
            <Panel title={`자동 제안 질문 (${suggested.length})`}>
              <InterviewList questions={suggested} {...actions} />
            </Panel>
          )}
          {excluded.length > 0 && (
            <Panel title={`제외한 질문 (${excluded.length})`}>
              <InterviewList questions={excluded} {...actions} />
            </Panel>
          )}
        </>
      )}

      <Modal
        open={addOpen}
        title="수동 인터뷰 질문 추가"
        onClose={() => setAddOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>
              취소
            </Button>
            <Button variant="primary" onClick={submitManual}>
              추가
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <div>
            <label htmlFor="iq-role" className="mb-1.5 block text-sm font-medium text-slate-700">
              대상 응답자
            </label>
            <select
              id="iq-role"
              value={role}
              onChange={(e) => setRole(e.target.value as RespondentRole)}
              className="w-full rounded-(--radius-control) border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {RESPONDENT_ROLE_META[r].label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="iq-text" className="mb-1.5 block text-sm font-medium text-slate-700">
              질문
            </label>
            <textarea
              id="iq-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-(--radius-control) border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
