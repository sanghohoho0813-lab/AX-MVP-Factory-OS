/**
 * D-273 스레드 · 릴스 · 틱톡 화면이 같이 쓰는 조각 — 단계 제목 · 큰 고르기 단추 · 안쪽 칸 · 규칙 검사 목록 · 지우기 한 번 더 묻기.
 * 대표 "60대도 쓸 수 있게 쉽고 간편하게" — 단추는 크게(44px 이상), 글은 짧게, 고를 것은 한 번에 2~4개.
 */
import { useState, type ReactNode } from 'react'
import { CheckCircle2, Download, Gift, OctagonAlert, Trash2, TriangleAlert, type LucideIcon } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { KIM_FACTS, REWRITES, VENTURE_CARDS } from '../../services/marketing/snsRules'

export function StepTitle({ n, children }: { n: string; children: ReactNode }) {
  return (
    <h2 className="t-section flex min-w-0 items-center gap-2 break-keep text-slate-900">
      <span aria-hidden="true" className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[0.8rem] font-bold text-white">
        {n}
      </span>
      <span className="min-w-0">{children}</span>
    </h2>
  )
}

export const chip = (on: boolean) => `tap t-sub inline-flex min-h-11 max-w-full items-center rounded-full border px-3.5 text-left font-semibold break-keep ${on ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`

/** 큰 고르기 단추 묶음 — 좁으면(큰 글자 포함) 한 줄에 하나 */
export function BigChoices<K extends string>({ items, value, onPick, label, testPrefix, min = '11rem' }: { items: ReadonlyArray<{ key: K; label: string; hint: string }>; value: K | ''; onPick: (k: K) => void; label: string; testPrefix: string; min?: string }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${min}), 1fr))` }} role="radiogroup" aria-label={label}>
      {items.map((g) => {
        const on = value === g.key
        return (
          <button key={g.key} type="button" role="radio" aria-checked={on} onClick={() => onPick(g.key)} className={`tap flex min-h-16 min-w-0 flex-col items-start gap-0.5 rounded-(--radius-control) border-2 px-3.5 py-2.5 text-left ${on ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-800 hover:border-slate-400'}`} data-testid={`${testPrefix}-${g.key}`}>
            <span className="t-body font-bold break-keep">{g.label}</span>
            <span className={`t-sub break-keep ${on ? 'text-slate-200' : 'text-slate-500'}`}>{g.hint}</span>
          </button>
        )
      })}
    </div>
  )
}

/** 화면 안쪽 칸(쓰기 · 기록표 · …) */
export function InnerTabs<K extends string>({ tabs, value, onPick, label, testPrefix }: { tabs: ReadonlyArray<{ key: K; label: string; short: string; icon: LucideIcon }>; value: K; onPick: (k: K) => void; label: string; testPrefix: string }) {
  return (
    <div role="tablist" aria-label={label} className="grid gap-1 rounded-(--radius-control) bg-slate-100 p-1" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }} data-testid={`${testPrefix}-tabs`}>
      {tabs.map((t) => {
        const Icon = t.icon
        const on = value === t.key
        return (
          <button key={t.key} type="button" role="tab" aria-selected={on} onClick={() => onPick(t.key)} className={`tap t-sub inline-flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-[8px] px-1 text-center leading-tight font-semibold break-keep sm:flex-row sm:gap-1.5 ${on ? 'bg-white text-slate-900 shadow-(--shadow-card)' : 'text-slate-600 hover:bg-white/70'}`} data-testid={`${testPrefix}-tab-${t.key}`}>
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            <span className="sm:hidden">{t.short}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export interface LintItem {
  key: string
  level: 'ok' | 'warn' | 'bad'
  text: string
}

/** 규칙 검사 줄 — 고칠 것(빨강) → 볼 것(노랑) → 괜찮음(초록) */
export function LintList({ lines, testId }: { lines: readonly LintItem[]; testId: string }) {
  if (!lines.length) return null
  const order = { bad: 0, warn: 1, ok: 2 } as const
  return (
    <ul className="flex flex-col gap-1.5" data-testid={testId}>
      {[...lines]
        .sort((a, b) => order[a.level] - order[b.level])
        .map((l) => {
          const Icon = l.level === 'bad' ? OctagonAlert : l.level === 'warn' ? TriangleAlert : CheckCircle2
          return (
            <li key={l.key} data-level={l.level} data-key={l.key} className={`t-sub flex items-start gap-1.5 rounded-(--radius-control) px-2.5 py-1.5 break-keep ${l.level === 'bad' ? 'bg-danger-50 text-danger-800' : l.level === 'warn' ? 'bg-warning-50 text-warning-900' : 'bg-success-50 text-success-800'}`}>
              <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span className="min-w-0">{l.text}</span>
            </li>
          )
        })}
    </ul>
  )
}

/** 지우기 — 한 번 더 묻는다 */
export function DeleteTwice({ onDelete, testPrefix, what = '이 글을' }: { onDelete: () => void; testPrefix: string; what?: string }) {
  const [sure, setSure] = useState(false)
  return sure ? (
    <span className="flex flex-wrap items-center gap-2" data-testid={`${testPrefix}-del-confirm`}>
      <span className="t-sub font-semibold text-danger-700">{what} 지울까요?</span>
      <Button size="sm" variant="danger" onClick={onDelete} data-testid={`${testPrefix}-del-yes`}>
        지우기
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setSure(false)}>
        그대로 두기
      </Button>
    </span>
  ) : (
    <Button size="sm" variant="ghost" onClick={() => setSure(true)} data-testid={`${testPrefix}-del`}>
      <Trash2 aria-hidden="true" className="size-4" /> 지우기
    </Button>
  )
}

/** 숫자 칸(기록표) — 칸을 떠날 때 저장 */
export function StatInputs<K extends string>({ keys, values, disabled, onSet, testPrefix }: { keys: ReadonlyArray<{ key: K; label: string }>; values: Readonly<Record<K, number | null>>; disabled: boolean; onSet: (k: K, v: number | null) => void; testPrefix: string }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 6.5rem), 1fr))' }}>
      {keys.map((s) => (
        <label key={s.key} className="flex min-w-0 flex-col gap-0.5">
          <span className="t-sub text-slate-600">{s.label}</span>
          <input
            inputMode="numeric"
            defaultValue={values[s.key] ?? ''}
            key={`${s.key}-${values[s.key] ?? ''}`}
            disabled={disabled}
            onBlur={(e) => {
              const raw = e.target.value.trim()
              const v = raw === '' ? null : Math.max(0, Math.round(Number(raw.replace(/[^0-9.]/g, ''))))
              if (v !== null && !Number.isFinite(v)) return
              if (values[s.key] !== v) onSet(s.key, v)
            }}
            className="t-body min-h-12 w-full min-w-0 rounded-(--radius-control) border border-slate-300 bg-white px-2.5 tabular-nums"
            data-testid={`${testPrefix}-stat-${s.key}`}
          />
        </label>
      ))}
    </div>
  )
}

/** D-274 나눠 줄 자료 — 체크리스트 카드 6장(누르면 크게 · 한 장씩 / 모두 내려받기) */
export function ShareKit({ testId }: { testId: string }) {
  const all = () => {
    VENTURE_CARDS.cards.forEach((c, i) =>
      window.setTimeout(() => {
        const a = document.createElement('a')
        a.href = c.file
        a.download = c.file.split('/').pop() ?? 'card.png'
        document.body.appendChild(a)
        a.click()
        a.remove()
      }, i * 250),
    )
  }
  return (
    <div className="flex flex-col gap-2 rounded-(--radius-control) border-2 border-brand-200 bg-brand-50/50 px-3 py-3" data-testid={testId}>
      <p className="t-body flex items-center gap-1.5 font-bold break-keep text-slate-900">
        <Gift aria-hidden="true" className="size-5 shrink-0 text-brand-700" /> 나눠 줄 자료가 이미 있어요 — {VENTURE_CARDS.title}
      </p>
      <p className="t-sub break-keep text-slate-600">{VENTURE_CARDS.how}</p>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {VENTURE_CARDS.cards.map((c, i) => (
          <li key={c.file} className="min-w-0">
            <a href={c.file} target="_blank" rel="noreferrer noopener" download className="tap flex flex-col items-center gap-1 rounded-(--radius-control) border border-slate-200 bg-white p-1 text-center hover:border-brand-400" data-testid={`${testId}-card`}>
              <img src={c.file} alt={`카드 ${i + 1} — ${c.label}`} loading="lazy" width={108} height={135} className="aspect-[4/5] w-full rounded-sm object-cover" />
              <span className="t-meta w-full break-keep text-slate-600">{i + 1}. {c.label}</span>
            </a>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={all} data-testid={`${testId}-all`}>
          <Download aria-hidden="true" className="size-4" /> 6장 모두 내려받기
        </Button>
        <span className="t-meta break-keep text-slate-500">휴대폰은 카드를 눌러 연 뒤 길게 눌러 저장해도 돼요.</span>
      </div>
    </div>
  )
}

/** D-274 이렇게 말고 → 이렇게(대표 운영 원칙 · 넣지 말 것) */
export function RewriteTable({ testId }: { testId: string }) {
  return (
    <ul className="flex flex-col divide-y divide-slate-100" data-testid={testId}>
      {REWRITES.map((r) => (
        <li key={r.no} className="flex flex-col gap-0.5 py-2">
          <span className="t-sub break-keep text-danger-700">✕ {r.no}</span>
          <span className="t-sub break-keep text-success-800">○ {r.yes}</span>
        </li>
      ))}
    </ul>
  )
}

/** D-274 사실 목록(이것만 씀) 보기 + 이번에 더 쓸 사실 — AI 와 숫자 대조가 같은 목록을 쓴다 */
export function FactsBox({ value, onChange, testPrefix, what }: { value: string; onChange: (v: string) => void; testPrefix: string; what: string }) {
  return (
    <details className="rounded-(--radius-control) border border-slate-200 px-3 py-2" data-testid={`${testPrefix}-facts-box`}>
      <summary className="tap t-sub cursor-pointer font-semibold text-slate-700">사실 목록 보기 · 이번 {what}에 더 쓸 사실 (선택)</summary>
      <p className="t-sub mt-1 break-keep text-slate-600">AI 와 규칙 검사는 아래 사실만 씁니다. 목록에 없는 숫자가 나오면 규칙 검사가 알려 드려요.</p>
      <ul className="t-sub mt-1 list-disc pl-5 break-keep text-slate-700" data-testid={`${testPrefix}-kim-facts`}>
        {KIM_FACTS.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
      <label className="mt-2 flex flex-col gap-1">
        <span className="t-sub font-semibold text-slate-700">이번 {what}에 더 쓸 사실 — 한 줄에 하나(고객 실명 · 매출 · 계약금액은 적지 않기)</span>
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} className="t-body w-full min-w-0 rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2" placeholder="예: 점검표 받은 대표님 12명(이번 달)" data-testid={`${testPrefix}-facts`} />
      </label>
    </details>
  )
}
