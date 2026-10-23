/**
 * PV-1 특허 · 벤처 첫 화면 위 '이 회사 준비 현황 · 다음 할 일'(규칙 계산 — pvBrief). 회사를 안 골랐으면 이어서 할 회사 몇 곳.
 * 대화창은 그 아래 그대로(묻고 싶은 것 · 점검 파일 올리기).
 */
import { useNavigate } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Circle, CircleDot, Sparkles } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import type { PvBrief, PvStepState } from '../../services/patent/pvBrief'
import type { PvBoardRow } from '../../services/patent/pvBoard'

const STATE: Record<PvStepState, { icon: typeof Circle; word: string; cls: string }> = {
  done: { icon: CheckCircle2, word: '끝', cls: 'text-success-700' },
  doing: { icon: CircleDot, word: '진행 중', cls: 'text-brand-700' },
  todo: { icon: Circle, word: '아직', cls: 'text-slate-600' },
}

export function PvBriefCard({ company, brief, onNewSpec }: { company: string; brief: PvBrief; onNewSpec: () => void }) {
  const navigate = useNavigate()
  const go = () => (brief.next.href ? navigate(brief.next.href) : onNewSpec())
  return (
    <section className="flex flex-col gap-3 rounded-(--radius-panel) border-2 border-slate-900 bg-white p-4" data-testid="pv-brief" aria-label={`${company} 특허 · 벤처 준비 현황`}>
      <h2 className="t-section break-keep text-slate-900 [overflow-wrap:anywhere]">{company} — 준비 현황</h2>
      <ol className="grid grid-cols-1 gap-2 sm:grid-cols-3" data-testid="pv-brief-steps">
        {brief.steps.map((s, i) => {
          const L = STATE[s.state]
          return (
            <li key={s.key} className="flex min-w-0 items-center gap-2 rounded-(--radius-control) border border-slate-200 bg-slate-50 px-3 py-2" data-testid="pv-brief-step" data-key={s.key} data-state={s.state}>
              <L.icon aria-hidden="true" className={`size-5 shrink-0 ${L.cls}`} />
              <span className="t-sub min-w-0 flex-1 break-keep text-slate-800">
                <b className="text-slate-900">
                  {i + 1} {s.label}
                </b>
                {s.text && <> · {s.text}</>}
              </span>
              <span className={`t-sub shrink-0 font-bold ${L.cls}`}>{L.word}</span>
            </li>
          )
        })}
      </ol>
      <p className="t-sub break-keep text-slate-700" data-testid="pv-brief-have">
        <b className="text-slate-900">이미 있는 자료</b> · {brief.have.length ? `${brief.have.join(' · ')} — AI 가 알아서 읽어요` : '아직 없음 — 고객 관리 › 서류함에 올리면 알아서 읽어요'}
        {brief.research && <> · 선행기술 조사 {brief.research === 'done' ? '함' : '아직'}</>}
      </p>
      <div className="flex flex-col gap-2 rounded-(--radius-control) border border-brand-200 bg-brand-50/60 px-3 py-3 sm:flex-row sm:items-center">
        <p className="t-body min-w-0 flex-1 break-keep font-semibold text-slate-900" data-testid="pv-brief-next-text">
          다음 할 일 · {brief.next.text}
        </p>
        <Button variant="primary" onClick={go} className="w-full sm:w-auto" data-testid="pv-brief-next">
          {brief.next.act ? <Sparkles aria-hidden="true" className="size-4" /> : <ArrowRight aria-hidden="true" className="size-4" />} {brief.next.label}
        </Button>
      </div>
      <ul className="t-sub flex flex-col gap-0.5 break-keep text-warning-800" data-testid="pv-brief-cautions">
        {brief.cautions.map((c) => (
          <li key={c}>△ {c}</li>
        ))}
      </ul>
    </section>
  )
}

/** 회사를 안 골랐을 때 — 손대던 회사 3곳까지 [이어서] */
export function PvResumeCard({ rows, onPick }: { rows: readonly PvBoardRow[]; onPick: (row: PvBoardRow) => void }) {
  const list = rows.filter((r) => r.stage !== 'done').slice(0, 3)
  if (!list.length) return null
  return (
    <section className="flex flex-col gap-2 rounded-(--radius-panel) border-2 border-slate-900 bg-white p-4" data-testid="pv-resume" aria-label="이어서 할 회사">
      <h2 className="t-section text-slate-900">이어서 할 회사</h2>
      <ul className="flex flex-col gap-2">
        {list.map((r, i) => (
          <li key={r.key} className="flex flex-col gap-2 rounded-(--radius-control) border border-slate-200 px-3 py-2 sm:flex-row sm:items-center" data-testid="pv-resume-row">
            <p className="t-sub min-w-0 flex-1 break-keep text-slate-800 [overflow-wrap:anywhere]">
              <b className="text-slate-900">{r.companyName}</b> — {r.next.text}
            </p>
            <Button size="sm" variant={i === 0 ? 'primary' : 'secondary'} onClick={() => onPick(r)} data-testid="pv-resume-go">
              {r.clientId ? '이 회사 보기' : r.next.label}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}
