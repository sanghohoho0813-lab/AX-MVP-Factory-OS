import { useState } from 'react'
import {
  CheckCircle2,
  Plus,
  ShieldAlert,
  TriangleAlert,
  Users,
} from 'lucide-react'
import { useParams } from 'react-router-dom'
import type { AnalysisIssue } from '../../../types/assessment'
import { Button } from '../../../components/ui/Button'
import { EmptyState } from '../../../components/ui/EmptyState'
import { Modal } from '../../../components/ui/Modal'
import { Panel } from '../../../components/ui/Panel'
import { SummaryStrip } from '../../../components/ui/SummaryStrip'
import { useToast } from '../../../components/ui/toastContext'
import { AnalysisNav } from '../../../components/assessment/AnalysisNav'
import { IssueList } from '../../../components/assessment/IssueList'
import {
  acknowledgeIssue,
  addManualIssue,
  excludeIssue,
  reopenIssue,
  resolveIssue,
} from '../../../services/assessmentService'
import { TriangleAlert as IssueIcon } from 'lucide-react'
import {
  AnalysisHeader,
  ProjectNotFound,
  useAnalysisData,
} from './analysisShared'

interface ReasonModal {
  kind: 'resolve' | 'exclude'
  issue: AnalysisIssue
}

export function AnalysisIssuesPage() {
  const { projectId = '' } = useParams()
  const { showToast } = useToast()
  const { context, organization } = useAnalysisData(projectId)
  const [reasonModal, setReasonModal] = useState<ReasonModal | null>(null)
  const [reason, setReason] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [manualTitle, setManualTitle] = useState('')
  const [manualDesc, setManualDesc] = useState('')

  if (!context) return <ProjectNotFound />
  const { project, issues } = context

  const activeIssues = issues.filter(
    (i) => i.status === 'open' || i.status === 'acknowledged',
  )
  const closedIssues = issues.filter(
    (i) => i.status === 'resolved' || i.status === 'excluded',
  )

  const counts = {
    total: issues.length,
    contradiction: issues.filter((i) => i.type === 'contradiction' || i.type === 'perception_gap').length,
    missing: issues.filter((i) => i.type === 'missing_data').length,
    risk: issues.filter((i) => i.type === 'risk_signal' || i.type === 'expert_review').length,
    resolved: issues.filter((i) => i.status === 'resolved' || i.status === 'excluded').length,
  }

  const openReason = (modal: ReasonModal) => {
    setReason('')
    setReasonModal(modal)
  }

  const submitReason = () => {
    if (!reasonModal) return
    if (reason.trim() === '') {
      showToast('사유를 입력해 주세요.')
      return
    }
    try {
      if (reasonModal.kind === 'resolve') {
        resolveIssue(reasonModal.issue.id, reason.trim())
        showToast('이슈를 해결 처리했습니다.')
      } else {
        excludeIssue(reasonModal.issue.id, reason.trim())
        showToast('이슈를 제외 처리했습니다.')
      }
      setReasonModal(null)
    } catch {
      showToast('처리에 실패했습니다.')
    }
  }

  const actions = {
    onAcknowledge: (i: AnalysisIssue) => {
      acknowledgeIssue(i.id)
      showToast('이슈를 확인 처리했습니다.')
    },
    onResolve: (i: AnalysisIssue) => openReason({ kind: 'resolve', issue: i }),
    onExclude: (i: AnalysisIssue) => openReason({ kind: 'exclude', issue: i }),
    onReopen: (i: AnalysisIssue) => {
      reopenIssue(i.id)
      showToast('이슈를 다시 열었습니다.')
    },
  }

  const submitManual = () => {
    if (manualTitle.trim() === '') {
      showToast('제목을 입력해 주세요.')
      return
    }
    addManualIssue(projectId, manualTitle.trim(), manualDesc.trim())
    setManualTitle('')
    setManualDesc('')
    setAddOpen(false)
    showToast('수동 이슈를 추가했습니다.')
  }

  return (
    <div className="flex flex-col gap-5">
      <AnalysisHeader
        project={project}
        organization={organization}
        actions={
          <Button variant="secondary" onClick={() => setAddOpen(true)}>
            <Plus aria-hidden="true" className="size-4" />
            수동 이슈 추가
          </Button>
        }
      />
      <AnalysisNav projectId={projectId} />

      <SummaryStrip
        ariaLabel="확인 필요 항목 요약"
        items={[
          { key: 'total', label: '전체', value: counts.total, unit: '건', tone: 'neutral', icon: IssueIcon },
          { key: 'conflict', label: '모순·인식차이', value: counts.contradiction, unit: '건', tone: 'danger', icon: Users },
          { key: 'missing', label: '데이터 누락', value: counts.missing, unit: '건', tone: 'warning', icon: TriangleAlert },
          { key: 'risk', label: '위험·전문가', value: counts.risk, unit: '건', tone: 'danger', icon: ShieldAlert },
          { key: 'resolved', label: '해결·제외', value: counts.resolved, unit: '건', tone: 'success', icon: CheckCircle2 },
        ]}
      />

      <Panel title={`확인이 필요한 항목 (${activeIssues.length})`}>
        {activeIssues.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="확인이 필요한 항목이 없습니다"
            description="모순·누락·위험 신호가 발견되지 않았거나 모두 처리되었습니다."
          />
        ) : (
          <IssueList issues={activeIssues} {...actions} />
        )}
      </Panel>

      {closedIssues.length > 0 && (
        <Panel title={`처리 완료 (${closedIssues.length})`}>
          <IssueList issues={closedIssues} {...actions} />
        </Panel>
      )}

      {/* 사유 입력 모달 */}
      <Modal
        open={reasonModal !== null}
        title={reasonModal?.kind === 'resolve' ? '이슈 해결 처리' : '이슈 제외 처리'}
        onClose={() => setReasonModal(null)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setReasonModal(null)}>
              취소
            </Button>
            <Button variant="primary" onClick={submitReason}>
              {reasonModal?.kind === 'resolve' ? '해결 처리' : '제외 처리'}
            </Button>
          </>
        }
      >
        <label htmlFor="issue-reason" className="mb-1.5 block text-sm font-medium text-slate-700">
          {reasonModal?.kind === 'resolve' ? '해결 메모' : '제외 사유'}
        </label>
        <textarea
          id="issue-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder={
            reasonModal?.kind === 'resolve'
              ? '어떻게 확인·해결했는지 기록하세요.'
              : '왜 제외하는지 사유를 기록하세요.'
          }
          className="w-full resize-none rounded-(--radius-control) border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
        />
      </Modal>

      {/* 수동 이슈 추가 모달 */}
      <Modal
        open={addOpen}
        title="수동 이슈 추가"
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
            <label htmlFor="manual-title" className="mb-1.5 block text-sm font-medium text-slate-700">
              제목
            </label>
            <input
              id="manual-title"
              value={manualTitle}
              onChange={(e) => setManualTitle(e.target.value)}
              className="w-full rounded-(--radius-control) border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </div>
          <div>
            <label htmlFor="manual-desc" className="mb-1.5 block text-sm font-medium text-slate-700">
              설명
            </label>
            <textarea
              id="manual-desc"
              value={manualDesc}
              onChange={(e) => setManualDesc(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-(--radius-control) border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
