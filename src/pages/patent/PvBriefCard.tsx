/**
 * PV-1 특허 · 벤처 첫 화면 위 '이 회사 준비 현황 · 다음 할 일'(규칙 계산 — pvBrief). 회사를 안 골랐으면 이어서 할 회사 몇 곳.
 * 대화창은 그 아래 그대로(묻고 싶은 것 · 점검 파일 올리기).
 *
 * UXS-1 화면 문법(공통 다섯 칸)에 맞춰 한 장이던 카드를 자리별로 나눴다 — 판정 · 글 · 단추 · 시험 이름은 그대로:
 *   ② 요약   PvBriefSummary  준비 현황(다섯 단계 · 이미 있는 자료)
 *   ③ 할 일  PvBriefNext     다음 할 일 + 주 단추 하나
 *   ⑤ 보조   PvBriefCautions 주의
 */
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Sparkles, Stamp, TriangleAlert } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { IconTile, StepProgress } from '../../components/ui/visual'
import { NextActionBar } from '../../components/ui/pageFrame'
import type { PvBrief } from '../../services/patent/pvBrief'
import type { PvBoardRow } from '../../services/patent/pvBoard'
import { pvSteps } from '../../services/patent/pvSteps'
import { AiConfirm } from '../../components/ai/AiConfirm'

/** ② 요약 — 이 회사 준비 현황(다섯 단계 · 이미 있는 자료) */
export function PvBriefSummary({ company, clientId, brief }: { company: string; clientId: string; brief: PvBrief }) {
  const navigate = useNavigate()
  // D-282 준비 현황 = 다섯 단계 표시(회사 → 아이디어 → 명세서 → 점검 → 사업계획서). 명세서 · 점검 · 사업계획서는 준비 현황과 같은 규칙
  const steps = pvSteps(clientId, brief.row, company)
  return (
    <section className="flex flex-col gap-3 rounded-(--radius-panel) border border-slate-200 bg-white p-4 sm:p-5" data-testid="pv-brief" aria-label={`${company} 특허 · 벤처 준비 현황`}>
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
    </section>
  )
}

/** ③ 지금 할 일 — 다음 할 일 하나 + 주 단추 */
export function PvBriefNext({ brief, onNewSpec }: { brief: PvBrief; onNewSpec: () => void }) {
  const navigate = useNavigate()
  const go = () => (brief.next.href ? navigate(brief.next.href) : onNewSpec())
  return (
    <NextActionBar
      label="다음 할 일"
      tone="amber"
      icon={brief.next.act ? Sparkles : ArrowRight}
      title={<span data-testid="pv-brief-next-text">{brief.next.text}</span>}
      action={
        // D-289 AI 를 바로 부르는 다음 할 일(AI로 명세서 초안 쓰기 등)만 두 번 — 화면 이동은 한 번
        brief.next.act ? (
          <AiConfirm>
            <Button variant="primary" onClick={go} data-testid="pv-brief-next">
              <Sparkles aria-hidden="true" className="size-4" /> {brief.next.label}
            </Button>
          </AiConfirm>
        ) : (
          <Button variant="primary" onClick={go} data-testid="pv-brief-next">
            <ArrowRight aria-hidden="true" className="size-4" /> {brief.next.label}
          </Button>
        )
      }
      testId="pv-next"
    />
  )
}

/** ⑤ 보조 — 주의(초안은 사람이 정함 · 출원번호는 기록에 있는 것만 …) */
export function PvBriefCautions({ brief }: { brief: PvBrief }) {
  if (!brief.cautions.length) return null
  return (
    <section className="flex flex-col gap-2 rounded-(--radius-panel) border border-slate-200 bg-white p-4" aria-label="주의">
      <h2 className="t-section flex items-center gap-1.5 text-slate-900">
        <TriangleAlert aria-hidden="true" className="size-4 text-warning-600" /> 주의
      </h2>
      <ul className="t-sub flex flex-col gap-1 break-keep text-warning-800" data-testid="pv-brief-cautions">
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
    <section className="flex flex-col gap-2 rounded-(--radius-panel) border border-slate-200 bg-white p-4" data-testid="pv-resume" aria-label="이어서 할 회사">
      <h2 className="t-section text-slate-900">이어서 할 회사</h2>
      <ul className="flex flex-col divide-y divide-slate-100">
        {list.map((r, i) => (
          <li key={r.key} className="flex flex-col gap-2 py-2.5 first:pt-1 last:pb-0" data-testid="pv-resume-row">
            <p className="t-sub min-w-0 flex-1 break-keep text-slate-800 [overflow-wrap:anywhere]">
              <b className="text-slate-900">{r.companyName}</b> — {r.next.text}
            </p>
            <Button size="sm" variant={i === 0 ? 'primary' : 'secondary'} className="self-start" onClick={() => onPick(r)} data-testid="pv-resume-go">
              {r.clientId ? '이 회사 보기' : r.next.label}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  )
}
