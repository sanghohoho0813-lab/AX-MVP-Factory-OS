/**
 * PV-1 특허 · 벤처 첫 화면 위 '이 회사 준비 현황 · 다음 할 일'(규칙 계산 — pvBrief). 회사를 안 골랐으면 이어서 할 회사 몇 곳.
 * 대화창은 그 아래 그대로(묻고 싶은 것 · 점검 파일 올리기).
 */
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Sparkles, Stamp } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { IconTile, StepProgress } from '../../components/ui/visual'
import type { PvBrief } from '../../services/patent/pvBrief'
import type { PvBoardRow } from '../../services/patent/pvBoard'
import { pvSteps } from '../../services/patent/pvSteps'

export function PvBriefCard({ company, clientId, brief, onNewSpec }: { company: string; clientId: string; brief: PvBrief; onNewSpec: () => void }) {
  const navigate = useNavigate()
  const go = () => (brief.next.href ? navigate(brief.next.href) : onNewSpec())
  // D-282 준비 현황 = 다섯 단계 표시(회사 → 아이디어 → 명세서 → 점검 → 사업계획서). 명세서 · 점검 · 사업계획서는 준비 현황과 같은 규칙
  const steps = pvSteps(clientId, brief.row, company)
  return (
    <section className="flex flex-col gap-3 rounded-(--radius-panel) border-2 border-amber-200 bg-white p-4" data-testid="pv-brief" aria-label={`${company} 특허 · 벤처 준비 현황`}>
      <div className="flex min-w-0 items-center gap-2.5">
        <IconTile icon={Stamp} tone="amber" size="md" />
        <h2 className="t-section min-w-0 break-keep text-slate-900 [overflow-wrap:anywhere]">{company} — 준비 현황</h2>
      </div>
      <StepProgress
        label={`${company} 특허 · 벤처 단계`}
        testId="pv-brief-steps"
        steps={steps.map((st) => ({
          key: st.key,
          label: st.label,
          state: st.state,
          note: st.note,
          onClick: st.href ? () => navigate(st.href as string) : undefined,
          // 명세서 · 점검 · 사업계획서 줄은 예전 준비 현황 칸과 같은 이름 · 상태 낱말(done · doing · todo)
          attrs: (st.key === 'spec' || st.key === 'check' || st.key === 'plan' ? { 'data-testid': 'pv-brief-step', 'data-key': st.key, 'data-state': st.word } : { 'data-key': st.key }) as Record<string, string>,
        }))}
      />
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
