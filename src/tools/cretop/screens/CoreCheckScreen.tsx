/**
 * 핵심지표 검수 — 뽑아낸 숫자를 줄 단위로 확인한다 (D-91).
 *
 * 분석 화면은 결론을 보여 준다. 이 화면은 그 결론이 **어느 줄에서 나왔는지**를 보여 준다.
 * 상담에서 숫자를 말하기 전에 여기서 한 번 눈으로 훑는 용도다.
 *
 * 엔진(engine/index.js)의 추출 결과를 그대로 쓴다 — 여기서 숫자를 다시 계산하지 않는다.
 */

import { useMemo, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { Badge, MetricTile, Section, Surface, type Tone } from '../../../components/ui/primitives'
import { CORE_LABELS, CORE_PREVIEW_ORDER, CRETOP_CORE_SAMPLE, extractCretopCore } from '../engine/index.js'

const STATUS_TONE: Record<string, Tone> = {
  확정: 'success',
  '적용 후보': 'success',
  '검수 필요': 'warning',
  '단위 확인 필요': 'warning',
  '연도 확인 필요': 'warning',
  '오류 의심': 'danger',
  '미검출': 'neutral',
}

export function CoreCheckScreen() {
  const [text, setText] = useState('')
  const [checked, setChecked] = useState<Set<string>>(new Set())

  const core = useMemo(() => {
    if (!text.trim()) return null
    try {
      return extractCretopCore(text)
    } catch {
      return null
    }
  }, [text])

  const rows = core?.rows ?? []
  const shown = CORE_PREVIEW_ORDER.map((key) => rows.find((r) => r.accountKey === key)).filter(
    (r): r is NonNullable<typeof r> => Boolean(r),
  )
  const missing = CORE_PREVIEW_ORDER.filter((key) => !rows.some((r) => r.accountKey === key))

  return (
    <div className="flex flex-col gap-5" data-testid="cretop-core-check">
      <Surface>
        <div className="flex flex-col gap-3">
          <p className="t-sub break-keep text-slate-600">
            크레탑 보고서를 붙여 넣으면 핵심지표가 <b>어느 줄에서 나왔는지</b>와 그 상태를 함께 보여 줍니다.
            상담에서 숫자를 말하기 전에 여기서 한 번 확인하세요.
          </p>
          <textarea
            aria-label="크레탑 보고서 붙여넣기"
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="크레탑 기업종합보고서 글자를 그대로 붙여 넣으세요"
            className="w-full rounded-(--radius-control) border border-slate-300 bg-white px-2.5 py-2 text-[0.95rem] text-slate-900"
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={() => setText(CRETOP_CORE_SAMPLE)} data-testid="cretop-core-sample">
              샘플 넣기
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setText(''); setChecked(new Set()) }}>
              <RotateCcw aria-hidden="true" className="size-4" /> 비우기
            </Button>
          </div>
        </div>
      </Surface>

      {core && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
            <MetricTile label="찾은 지표" value={`${shown.length}개`} tone={shown.length > 0 ? 'brand' : 'neutral'} />
            <MetricTile label="못 찾은 지표" value={`${missing.length}개`} tone={missing.length > 0 ? 'warning' : 'success'} />
            <MetricTile label="확인 표시" value={`${checked.size}개`} tone={checked.size > 0 ? 'success' : 'neutral'} />
            <MetricTile label="연도" value={(core.detectedYears ?? []).join(' · ') || '-'} />
          </div>

          <Section title="핵심지표" count={shown.length}>
            <ul className="flex flex-col gap-1.5" data-testid="cretop-core-rows">
              {shown.map((r) => {
                const key = String(r.accountKey)
                const on = checked.has(key)
                const status = String(r.status ?? '검수 필요')
                return (
                  <li key={key}>
                    <Surface as="div" edge={on ? 'success' : (STATUS_TONE[status] ?? 'neutral')} showEdge padded={false}>
                      <label className="tap flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                        <input
                          type="checkbox"
                          checked={on}
                          aria-label={`${CORE_LABELS[key] ?? key} 확인함`}
                          data-core={key}
                          onChange={() => {
                            const next = new Set(checked)
                            if (on) next.delete(key)
                            else next.add(key)
                            setChecked(next)
                          }}
                          className="size-4 shrink-0"
                        />
                        <span className="t-sub w-36 shrink-0 font-bold text-slate-900">{CORE_LABELS[key] ?? key}</span>
                        <span className="t-sub w-32 shrink-0 text-right tabular-nums text-slate-800">
                          {typeof r.rawValue === 'number' ? r.rawValue.toLocaleString() : String(r.rawValue ?? '-')}
                        </span>
                        <span className="t-meta w-16 shrink-0 text-slate-500">{String(r.unit ?? '')}</span>
                        <Badge tone={STATUS_TONE[status] ?? 'neutral'}>{status}</Badge>
                        <span className="t-meta min-w-0 flex-1 truncate text-slate-400">{String(r.rowText ?? '')}</span>
                      </label>
                    </Surface>
                  </li>
                )
              })}
            </ul>
          </Section>

          {missing.length > 0 && (
            <Surface edge="warning" showEdge>
              <p className="t-sub break-keep text-slate-700" data-testid="cretop-core-missing">
                못 찾은 지표 — {missing.map((k) => CORE_LABELS[k] ?? k).join(' · ')}. 보고서에 그 표가 없거나 글자가 깨진 경우입니다.
              </p>
            </Surface>
          )}
        </>
      )}
    </div>
  )
}
