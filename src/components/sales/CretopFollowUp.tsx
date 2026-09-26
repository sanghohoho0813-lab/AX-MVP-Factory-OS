/**
 * 2차 · 3차 미팅 — 1차에서 꺼낸 크레탑 전략을 이어서 (D-121).
 *
 * 1차 미팅 준비는 크레탑 분석기 그 자체다(미팅 준비 1차 탭). 그 뒤 차수는 운영 OS 흐름으로 간다 —
 * 분석기에서 '최종 선택' 한 전략(없으면 추천 위 3개)의 질문 가운데 이번 차수 것만 꺼낸다.
 *   2차: D 제안 연결   3차: E 다음 액션
 * 휴대폰에서 좁은 칸에 끼지 않게 단계 이름은 윗줄, 질문은 아랫줄 전체 폭.
 */
import { CopyButton } from './salesParts'
import { rampAt } from './salesColor'
import { FLOW_ROUND, cretopForMeeting, meetingPicks } from '../../services/salesCretop'
import type { ClientOpsRecord } from '../../types/clientOps'

export function CretopFollowUp({ record, round, onGoFirst }: { record: ClientOpsRecord; round: 2 | 3; onGoFirst: () => void }) {
  const m = cretopForMeeting(record)
  if (!m) {
    return (
      <div data-testid="cretop-followup" data-empty="1" className="flex flex-col items-start gap-2 rounded-(--radius-control) border border-dashed border-slate-300 px-3.5 py-3">
        <p className="t-sub break-keep text-slate-600">1차 미팅 탭에서 크레탑 보고서를 넣으면, 고른 전략마다 이번 차수에 이어서 물을 질문이 여기 뜹니다.</p>
        <button type="button" onClick={onGoFirst} className="t-sub font-semibold text-brand-700 hover:underline">
          1차 미팅 탭으로 →
        </button>
      </div>
    )
  }
  const picks = meetingPicks(m, 3)
  return (
    <ol data-testid="cretop-followup" className="flex flex-col gap-2">
      {picks.map((p, i) => {
        const steps = p.flow.filter((f) => FLOW_ROUND[f.step] === round)
        return (
          <li key={p.name} data-cretop-pick={p.name} className="relative flex flex-col gap-1.5 overflow-hidden rounded-(--radius-control) border border-slate-200 bg-white px-3.5 py-2.5 pl-4">
            <span aria-hidden="true" className="ramp-bar absolute inset-y-0 left-0 w-[3px]" style={rampAt(i, Math.max(2, picks.length))} />
            <p className="t-sub font-bold text-slate-900">{p.name}</p>
            {steps.map((f) => (
              <div key={f.step} className="flex flex-col gap-1">
                <p className="t-meta font-semibold text-slate-500">
                  {f.step} {f.label}
                </p>
                <p className="t-body break-keep text-slate-800">{f.q}</p>
                <div className="flex justify-end">
                  <CopyButton text={f.q} />
                </div>
              </div>
            ))}
            {round === 2 && p.docs.length > 0 && <p className="t-meta break-keep text-slate-500">받을 자료 · {p.docs.slice(0, 4).join(' · ')}</p>}
          </li>
        )
      })}
    </ol>
  )
}
