import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { FlaskConical, Plus } from 'lucide-react'
import type { ValidationTrackType, ValidationWorkspace } from '../../types/validation'
import { Button } from '../../components/ui/Button'
import { Panel } from '../../components/ui/Panel'
import { Modal } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import { HelpNote } from '../../components/ui/HelpNote'
import { useToast } from '../../components/ui/toastContext'
import { RoundStatusBadge } from '../../components/validation/badges'
import { createRound } from '../../services/validationService'
import { TrackSectionFrame, ReadOnlyNotice } from './validationShared'

const labelClass = 'mb-1 block text-[0.9rem] font-semibold text-slate-500'
const inputClass = 'w-full rounded-(--radius-control) border border-slate-300 px-3 py-2 text-[0.95rem] focus:border-brand-400 focus:outline-none'

function RoundsBody({
  workspace: w,
  projectId,
  trackType,
}: {
  workspace: ValidationWorkspace
  projectId: string
  trackType: ValidationTrackType
}) {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const readOnly = w.status === 'finalized' || w.status === 'superseded'

  const activeScenarios = w.scenarios.filter((s) => s.status !== 'retired')

  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [objective, setObjective] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [participantIds, setParticipantIds] = useState<string[]>([])
  const [scenarioIds, setScenarioIds] = useState<string[]>([])

  const rounds = [...w.rounds].sort((a, b) => a.roundNumber - b.roundNumber)

  const openCreate = () => {
    setName('')
    setObjective('')
    setScheduledAt('')
    setParticipantIds([])
    setScenarioIds(activeScenarios.filter((s) => s.required).map((s) => s.id))
    setOpen(true)
  }

  const toggle = (list: string[], id: string): string[] =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id]

  const submit = () => {
    if (!name.trim()) {
      showToast('회차 이름을 입력하세요.')
      return
    }
    try {
      createRound(w.id, { name, objective, participantIds, scenarioIds, scheduledAt })
      setOpen(false)
      showToast('회차를 추가했습니다.')
    } catch (err) {
      showToast(err instanceof Error ? err.message : '처리에 실패했습니다.')
    }
  }

  return (
    <>
      <ReadOnlyNotice workspace={w} />
      <HelpNote
        summary="회차는 참여자가 시나리오를 실제로 수행하는 테스트 세션입니다. 완료된 회차는 원본 보존을 위해 수정할 수 없습니다."
        what="참여자·시나리오·테스트 버전을 묶어 실행 단위를 만듭니다."
        when="시나리오와 참여자를 준비한 뒤 실행 직전에 만듭니다."
        next="회차를 시작해 시나리오 실행 결과를 기록합니다."
      />

      <Panel
        title={`회차 (${rounds.length})`}
        actions={!readOnly ? (
          <Button variant="primary" size="sm" onClick={openCreate}>
            <Plus aria-hidden="true" className="size-4" />
            회차 추가
          </Button>
        ) : undefined}
      >
        <p className="mb-3 text-[0.95rem] break-keep text-slate-500">완료된 회차는 수정할 수 없습니다(원본 보존).</p>
        {rounds.length === 0 ? (
          <EmptyState icon={FlaskConical} title="회차가 없습니다" description="참여자가 시나리오를 수행할 첫 회차를 만드세요." />
        ) : (
          <ul className="flex flex-col gap-2">
            {rounds.map((r) => {
              const runsRecorded = r.scenarioRuns.length
              const scenarioCount = r.scenarioIds.length
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/validation/projects/${projectId}/${trackType}/rounds/${r.id}`)}
                    className="w-full rounded-(--radius-card) border border-slate-200 px-4 py-3 text-left transition-colors hover:border-brand-300 hover:bg-slate-50"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[0.9rem] font-semibold text-slate-400">#{r.roundNumber}</span>
                      <p className="text-sm font-semibold break-keep text-slate-800">{r.name}</p>
                      <RoundStatusBadge status={r.status} />
                    </div>
                    {r.objective && <p className="mt-1 text-[0.95rem] break-keep text-slate-600">{r.objective}</p>}
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.9rem] text-slate-500">
                      <span>참여자 {r.participantIds.length}명</span>
                      <span>시나리오 {scenarioCount}개</span>
                      <span>실행 기록 {runsRecorded}/{scenarioCount}</span>
                      {r.completedAt && <span>완료 {new Date(r.completedAt).toLocaleDateString('ko-KR')}</span>}
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      <Modal
        open={open}
        title="회차 추가"
        onClose={() => setOpen(false)}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>취소</Button>
            <Button variant="primary" onClick={submit}>추가</Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <div>
            <label htmlFor="rd-name" className={labelClass}>회차 이름</label>
            <input id="rd-name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="예: 1차 현장 테스트" />
          </div>
          <div>
            <label htmlFor="rd-obj" className={labelClass}>목표</label>
            <textarea id="rd-obj" rows={2} value={objective} onChange={(e) => setObjective(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="rd-date" className={labelClass}>예정일</label>
            <input id="rd-date" type="date" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className={inputClass} />
          </div>
          <div>
            <p className={labelClass}>참여자</p>
            {w.participants.length === 0 ? (
              <p className="text-[0.95rem] text-slate-500">등록된 참여자가 없습니다. 제작·참여자 화면에서 먼저 추가하세요.</p>
            ) : (
              <div className="flex flex-col gap-1.5 rounded-(--radius-control) border border-slate-200 p-2">
                {w.participants.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-[0.95rem] text-slate-700">
                    <input type="checkbox" checked={participantIds.includes(p.id)} onChange={() => setParticipantIds((prev) => toggle(prev, p.id))} className="size-4 rounded border-slate-300" />
                    {p.name}
                  </label>
                ))}
              </div>
            )}
          </div>
          <div>
            <p className={labelClass}>시나리오 (필수 시나리오가 기본 선택됩니다)</p>
            {activeScenarios.length === 0 ? (
              <p className="text-[0.95rem] text-slate-500">사용 가능한 시나리오가 없습니다. 시나리오 화면에서 먼저 추가하세요.</p>
            ) : (
              <div className="flex flex-col gap-1.5 rounded-(--radius-control) border border-slate-200 p-2">
                {activeScenarios.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 text-[0.95rem] text-slate-700">
                    <input type="checkbox" checked={scenarioIds.includes(s.id)} onChange={() => setScenarioIds((prev) => toggle(prev, s.id))} className="size-4 rounded border-slate-300" />
                    <span className="break-keep">{s.title}</span>
                    {s.required && <span className="rounded border border-brand-200 bg-brand-50 px-1 text-[0.82rem] font-semibold text-brand-700">필수</span>}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </>
  )
}

export function TrackRoundsPage() {
  const { projectId = '', trackType = 'ax_mvp' } = useParams()
  return (
    <TrackSectionFrame
      projectId={projectId}
      trackType={trackType as ValidationTrackType}
      render={(w) => <RoundsBody workspace={w} projectId={projectId} trackType={trackType as ValidationTrackType} />}
    />
  )
}
