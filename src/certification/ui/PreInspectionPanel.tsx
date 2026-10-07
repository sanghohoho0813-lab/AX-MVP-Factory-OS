/**
 * 실사 직전 3분 요약 (P1) — 실사 대비 기록을 한 장으로: 준비된 것 · 보완할 것 · 대표에게 물어볼 것 · 가져갈 자료.
 */
import { useMemo } from 'react'
import { Copy } from 'lucide-react'
import { Surface } from '../../components/ui/primitives'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/toastContext'
import { inspectionCards, type InspectionQuestion, type PreparedAnswer } from '../core/inspection'
import { preInspectionSummary, preInspectionText } from '../core/preInspection'
import type { CertificationClientContext } from '../core/types'

function Block({ title, lines, tone, testid }: { title: string; lines: string[]; tone: string; testid: string }) {
  return (
    <div className="flex flex-col gap-1" data-testid={testid}>
      <p className={`t-sub font-bold ${tone}`}>
        {title} <span className="tabular-nums">({lines.length})</span>
      </p>
      {lines.length === 0 ? (
        <p className="t-sub text-slate-500">없음</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {lines.map((l) => (
            <li key={l} className="t-sub break-keep text-slate-800">
              · {l}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function PreInspectionPanel({ title, qs, ctx, labelOf, prep, onClose }: { title: string; qs: InspectionQuestion[]; ctx: CertificationClientContext; labelOf: (id: string) => string; prep: Record<string, PreparedAnswer>; onClose: () => void }) {
  const { showToast } = useToast()
  const s = useMemo(() => preInspectionSummary(inspectionCards(qs, ctx, labelOf), prep), [qs, ctx, labelOf, prep])
  const copy = () =>
    void navigator.clipboard
      .writeText(preInspectionText(title, s))
      .then(() => showToast('실사 직전 요약을 복사했습니다'))
      .catch(() => showToast('복사하지 못했습니다 — 화면을 그대로 보여 주세요'))
  return (
    <Surface>
      <div className="flex flex-col gap-3" data-testid="pre-inspection">
        <h3 className="t-section font-bold text-slate-900">실사 직전 3분 요약</h3>
        {s.untouched > 0 && <p className="t-sub break-keep text-warning-800">아직 보지 않은 질문 {s.untouched}개 — '실사 대비 시작' 에서 한 번씩 봐 두면 요약이 정확해집니다.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          <Block title="준비된 것" lines={s.ready} tone="text-success-700" testid="pre-ready" />
          <Block title="보완할 것" lines={s.fix} tone="text-warning-800" testid="pre-fix" />
          <Block title="대표에게 물어볼 것" lines={s.ask} tone="text-danger-700" testid="pre-ask" />
          <Block title="가져갈 자료(원본)" lines={s.bring} tone="text-slate-900" testid="pre-bring" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={copy} data-testid="pre-copy">
            <Copy aria-hidden="true" className="size-4" /> 복사
          </Button>
          <Button variant="ghost" onClick={onClose}>
            닫기
          </Button>
        </div>
      </div>
    </Surface>
  )
}
