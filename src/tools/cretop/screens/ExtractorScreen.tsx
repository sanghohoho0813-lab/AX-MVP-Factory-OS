/**
 * 숫자 추출기 — 크레탑 표에서 숫자만 골라낸다 (D-91).
 *
 * 원본(홈페이지 크레탑 분석기)의 추출 엔진은 이미 옮겨져 있다(engine/index.js).
 * 여기서는 그 결과를 **줄 단위로 사람이 검수**하게 보여 주고, 골라낸 것을 CSV·표로 내보낸다.
 *
 * 자동으로 확정하지 않는다. 상태(적용 후보·검수 필요·단위 확인 필요…)를 그대로 보여 주고
 * 대표가 끄고 켠다 — 숫자를 잘못 믿는 것이 못 읽는 것보다 위험하기 때문이다.
 */

import { useMemo, useState } from 'react'
import { Check, Copy, Download, RotateCcw } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { Badge, MetricTile, Section, Surface, type Tone } from '../../../components/ui/primitives'
import { useToast } from '../../../components/ui/toastContext'
import {
  CRETOP_EXTRACT_SAMPLE,
  extractCretopNumbers,
  extractEokText,
  extractRowsToCsv,
  extractRowsToText,
  type CretopExtractedRow,
} from '../engine/index.js'

const STATUS_TONE: Record<string, Tone> = {
  '적용 후보': 'success',
  '검수 필요': 'warning',
  '단위 확인 필요': 'warning',
  '연도 확인 필요': 'warning',
  '오류 의심': 'danger',
  제외: 'neutral',
}

export function ExtractorScreen() {
  const { showToast } = useToast()
  const [text, setText] = useState('')
  const [off, setOff] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState(false)

  const result = useMemo(() => {
    if (!text.trim()) return null
    try {
      return extractCretopNumbers(text)
    } catch {
      return null
    }
  }, [text])

  const rows: CretopExtractedRow[] = result?.rows ?? []
  const picked = rows.filter((r) => r.sel && !off.has(r.id))

  const copy = async (payload: string) => {
    try {
      await navigator.clipboard.writeText(payload)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      showToast('복사하지 못했습니다. 표를 직접 긁어 주세요.')
    }
  }

  const download = () => {
    const blob = new Blob([extractRowsToCsv(picked)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `크레탑-숫자-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    showToast('고른 줄을 CSV 로 내보냈습니다.')
  }

  return (
    <div className="flex flex-col gap-5" data-testid="cretop-extractor">
      <Surface>
        <div className="flex flex-col gap-3">
          <p className="t-sub break-keep text-slate-600">
            크레탑 보고서의 표를 그대로 붙여 넣으면 계정별 숫자 후보를 줄 단위로 뽑습니다.
            <b> 자동으로 확정하지 않습니다</b> — 상태를 보고 끄고 켜세요.
          </p>
          <textarea
            aria-label="크레탑 표 붙여넣기"
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="요약 손익계산서 … 매출액 1,250 1,860 2,430 …"
            className="w-full rounded-(--radius-control) border border-slate-300 bg-white px-2.5 py-2 text-[0.95rem] text-slate-900"
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={() => setText(CRETOP_EXTRACT_SAMPLE)} data-testid="cretop-extract-sample">
              샘플 넣기
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setText(''); setOff(new Set()) }}>
              <RotateCcw aria-hidden="true" className="size-4" /> 비우기
            </Button>
          </div>
        </div>
      </Surface>

      {result && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
            <MetricTile label="뽑은 줄" value={`${rows.length}줄`} />
            <MetricTile label="고른 줄" value={`${picked.length}줄`} tone={picked.length > 0 ? 'brand' : 'neutral'} />
            <MetricTile label="연도" value={result.detectedYears.join(' · ') || '-'} />
            <MetricTile label="표" value={`${result.sections.length}개`} hint={result.queryDate ? `조회일 ${result.queryDate}` : ''} />
          </div>

          <Section
            title="뽑은 숫자"
            count={rows.length}
            action={
              <span className="flex gap-2">
                <Button size="sm" onClick={() => void copy(extractRowsToText(picked))}>
                  {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
                  표 복사
                </Button>
                <Button variant="ghost" size="sm" onClick={download} data-testid="cretop-extract-csv">
                  <Download aria-hidden="true" className="size-4" /> CSV
                </Button>
              </span>
            }
          >
            <ul className="flex flex-col gap-1.5" data-testid="cretop-extract-rows">
              {rows.map((r) => {
                const on = r.sel && !off.has(r.id)
                return (
                  <li key={r.id}>
                    <Surface as="div" edge={STATUS_TONE[r.status] ?? 'neutral'} showEdge padded={false}>
                      <label className="tap flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                        <input
                          type="checkbox"
                          checked={on}
                          aria-label={`${r.account} 고르기`}
                          data-row={r.accountKey}
                          onChange={() => {
                            const next = new Set(off)
                            if (on) next.add(r.id)
                            else next.delete(r.id)
                            setOff(next)
                          }}
                          className="size-4 shrink-0"
                        />
                        <span className="t-sub w-32 shrink-0 font-bold text-slate-900">{r.account}</span>
                        <span className="t-meta w-16 shrink-0 tabular-nums text-slate-500">{r.year ?? '연도?'}</span>
                        <span className="t-sub w-28 shrink-0 text-right tabular-nums text-slate-800">
                          {r.rawValue == null ? '-' : r.rawValue.toLocaleString()}
                        </span>
                        <span className="t-meta w-16 shrink-0 text-slate-500">{r.unit || '단위?'}</span>
                        <span className="t-meta w-28 shrink-0 tabular-nums text-slate-500">{extractEokText(r)}</span>
                        <Badge tone={STATUS_TONE[r.status] ?? 'neutral'}>{r.status}</Badge>
                        <span className="t-meta min-w-0 flex-1 truncate text-slate-400">{r.rowText}</span>
                      </label>
                    </Surface>
                  </li>
                )
              })}
            </ul>
          </Section>

          <p className="t-meta break-keep text-slate-400">
            뽑은 숫자는 원문 확인이 필요한 <b>후보</b>입니다. 특히 '단위 확인 필요'·'오류 의심' 은 보고서 원문과 대조하세요.
          </p>
        </>
      )}
    </div>
  )
}
