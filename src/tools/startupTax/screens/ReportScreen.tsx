/**
 * 판정 결과서 — 상담에 들고 가는 한 장 (D-91).
 *
 * 판정 화면에서 적은 것을 그대로 읽어(브라우저에 남아 있다) 결과서로 만든다.
 * 다시 묻지 않는다 — 대표는 같은 것을 두 번 적지 않아야 한다.
 *
 * 인쇄는 브라우저가 한다. 요약 글은 그대로 복사해 카톡으로 보낼 수 있다.
 */

import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Copy, Printer } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { Badge, MetricTile, Section, Surface, type Tone } from '../../../components/ui/primitives'
import { judge, VERDICT_EMOJI, VERDICT_LABEL } from '../lib/judgement'
import { buildSummaryText } from '../lib/summary'
import { EMPTY_FORM } from '../lib/formDefaults'
import type { FormData, Verdict } from '../types'

const STORAGE_KEY = 'axmvp.tools.startupTax'

const VERDICT_TONE: Record<Verdict, Tone> = {
  good: 'success',
  caution: 'warning',
  conditional: 'warning',
  bad: 'danger',
}

function loadForm(): FormData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return { ...EMPTY_FORM, ...(JSON.parse(raw) as Partial<FormData>) }
  } catch {
    return null
  }
}

export function StartupTaxReportScreen() {
  const [copied, setCopied] = useState(false)
  const form = useMemo(() => loadForm(), [])
  const result = useMemo(() => (form ? judge(form) : null), [form])

  if (!form || !result) {
    return (
      <Surface edge="brand" showEdge>
        <p className="t-sub break-keep text-slate-600" data-testid="startup-report-empty">
          아직 판정한 내용이 없습니다.{' '}
          <Link to="/tools/startup-tax/judge" className="font-bold text-brand-700 hover:underline">
            1분 판정
          </Link>{' '}
          에서 여덟 가지를 고르면 여기에 결과서가 만들어집니다.
        </p>
      </Surface>
    )
  }

  const summary = buildSummaryText(result)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summary)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      /* 복사 못 하면 화면에서 긁는다 */
    }
  }

  return (
    <div className="flex flex-col gap-5" data-testid="startup-report">
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <MetricTile
          label="종합 판정"
          value={`${VERDICT_EMOJI[result.overall]} ${VERDICT_LABEL[result.overall]}`}
          tone={VERDICT_TONE[result.overall]}
        />
        <MetricTile label="예상 절세 규모" value={result.savingsLevel.label} hint={result.savingsLevel.level} />
        <MetricTile label="전문가 검토" value={result.expertReview.grade} hint={result.expertReview.label} />
        <MetricTile label="청년 여부" value={result.isYouth === null ? '확인 필요' : result.isYouth ? '해당' : '해당 없음'} hint={result.age ? `만 ${result.age}세` : ''} />
      </div>

      <Section
        title="상담용 요약"
        action={
          <span className="flex gap-2">
            <Button size="sm" onClick={() => void copy()} data-testid="startup-report-copy">
              {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
              {copied ? '복사됨' : '복사'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => window.print()}>
              <Printer aria-hidden="true" className="size-4" /> 인쇄·PDF
            </Button>
          </span>
        }
      >
        <Surface>
          <pre className="t-meta max-h-96 overflow-auto whitespace-pre-wrap break-keep text-slate-600" data-testid="startup-report-text">
            {summary}
          </pre>
        </Surface>
      </Section>

      <Section title="판정 사유" count={result.keyReasons.length}>
        <Surface>
          <ul className="t-sub flex list-disc flex-col gap-1 pl-5 text-slate-700">
            {result.keyReasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </Surface>
      </Section>

      {result.keyChecks.length > 0 && (
        <Section title="확인해야 할 것" count={result.keyChecks.length}>
          <Surface edge="warning" showEdge>
            <ul className="t-sub flex list-disc flex-col gap-1 pl-5 text-slate-700">
              {result.keyChecks.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </Surface>
        </Section>
      )}

      <Section title="법 기준별 판정" count={result.frameworks.length}>
        <ul className="flex flex-col gap-2">
          {result.frameworks.map((f) => (
            <li key={f.key}>
              <Surface as="div" edge={VERDICT_TONE[f.verdict]} showEdge>
                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="t-sub font-bold text-slate-900">{f.title}</span>
                    <Badge tone={VERDICT_TONE[f.verdict]}>
                      {VERDICT_EMOJI[f.verdict]} {VERDICT_LABEL[f.verdict]}
                    </Badge>
                  </div>
                  <p className="t-meta break-keep text-slate-600">{f.conclusion}</p>
                </div>
              </Surface>
            </li>
          ))}
        </ul>
      </Section>

      <p className="t-meta break-keep text-slate-400">
        규칙표 기준 1차 검토이며 확정이 아닙니다. 실제 적용은 세무 대리인의 검토를 받으세요.
      </p>
    </div>
  )
}
