/**
 * 수령액 시뮬레이터 — 인원 × 입사일 → 월별 현금흐름 (D-91).
 *
 * 원본과 같은 계산(simulator.ts)을 쓰고, 상담용 문구를 한 번에 복사할 수 있게 했다.
 * 업체를 물고 왔으면 결과를 그 업체 기록에 붙일 수 있다 — 붙이면 회차 기한이 달력으로 간다.
 */

import { useMemo, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { MetricTile, Section, Surface } from '../../../components/ui/primitives'
import { ToolResultAttach } from '../../shared/ToolResultAttach'
import { fMan } from '../lib/format'
import { usePrograms } from '../lib/usePrograms'
import { simulate, simulationText } from '../lib/simulator'

const inputCls =
  'w-full rounded-(--radius-control) border border-slate-300 bg-white px-2.5 py-2 text-[0.95rem] text-slate-900 focus:border-brand-500 focus:outline-none'

export function SimulatorScreen() {
  const { programs, enabled } = usePrograms()
  const [programId, setProgramId] = useState('')
  const [count, setCount] = useState('1')
  const [startDate, setStartDate] = useState('')
  const [copied, setCopied] = useState(false)

  const list = enabled.length > 0 ? enabled : (programs ?? [])
  const chosen = list.find((p) => p.id === programId) ?? list[0]
  const n = Number(count) || 0
  const result = useMemo(() => simulate(chosen, n, startDate), [chosen, n, startDate])

  if (programs === null) return <p className="t-sub text-slate-400">지원금 표를 읽는 중…</p>
  if (!chosen) return <p className="t-sub text-slate-500">쓸 수 있는 지원금이 없습니다. 목차의 지원금 관리에서 하나를 켜 주세요.</p>

  const text = simulationText(chosen.name, n, result)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      /* 복사 못 하면 화면에서 긁는다 */
    }
  }

  return (
    <div className="flex flex-col gap-5" data-testid="emp-simulator">
      <Surface>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="t-sub font-medium text-slate-600">지원금 종류</span>
            <select aria-label="지원금 종류" value={chosen.id} onChange={(e) => setProgramId(e.target.value)} className={`mt-1 ${inputCls}`}>
              {list.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="t-sub font-medium text-slate-600">채용 인원</span>
            <input aria-label="채용 인원" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} className={`mt-1 ${inputCls} text-right tabular-nums`} />
          </label>
          <label className="block">
            <span className="t-sub font-medium text-slate-600">입사일 (비우면 오늘)</span>
            <input type="date" aria-label="입사일" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={`mt-1 ${inputCls}`} />
          </label>
        </div>
      </Surface>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
        <MetricTile label="예상 총 수령액" value={fMan(result.total)} hint={`${n}명 기준`} tone={result.total > 0 ? 'brand' : 'neutral'} />
        <MetricTile label="1인당 최대" value={fMan(result.perPerson)} hint={chosen.name} />
        <MetricTile
          label="수령 시기"
          value={result.monthly.length > 0 ? `${result.monthly[0].month} ~ ${result.monthly[result.monthly.length - 1].month}` : '-'}
          hint={result.monthly.length > 0 ? `${result.monthly.length}번에 나눠 받음` : ''}
        />
      </div>

      {result.monthly.length > 0 && (
        <Section
          title="월별 현금흐름"
          count={result.monthly.length}
          action={
            <Button size="sm" onClick={copy}>
              {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
              {copied ? '복사됨' : '상담 문구 복사'}
            </Button>
          }
        >
          <ul className="flex flex-col gap-1.5" data-testid="emp-sim-months">
            {result.monthly.map((m) => (
              <li key={m.month}>
                <Surface as="div" padded={false}>
                  <div className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="t-sub font-medium text-slate-700">{m.month}</span>
                    <span className="t-meta text-slate-500">{m.count}건</span>
                    <span className="t-sub ml-auto font-bold tabular-nums text-slate-900">{fMan(m.amount)}</span>
                  </div>
                </Surface>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {result.total > 0 && (
        <ToolResultAttach
          toolKey="employment"
          title="수령액 시뮬레이션"
          verdict={null}
          verdictLabel={`${n}명 · ${fMan(result.total)}`}
          summary={text}
          data={{ tab: 'simulator', programId: chosen.id, count: n, startDate, monthly: result.monthly, total: result.total }}
        />
      )}
    </div>
  )
}
