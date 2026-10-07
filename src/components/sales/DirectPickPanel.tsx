/**
 * 제안 항목 바로 고르기 (D-167) — 크레탑 분석기 없이 1차 미팅을 준비하는 길.
 *
 * 대표: "경험 많은 컨설턴트는 재무제표 · 크레탑을 대충 봐도 답이 나온다. 오늘 가서 무슨 얘기를 할지만 정리해 가면 된다."
 * 그래서 컨설팅 항목 26 가운데 고르기만 하면 — 고른 항목마다 왜 · 물어볼 것 · 받을 자료를 한 장으로 보여 주고,
 * 업체 기록(sales.picks)에 남겨 2 · 3차 준비('이어서 물을 것')가 그대로 이어서 쓴다. 규칙 목록이다 — 외부 호출 없음.
 */
import { Check } from 'lucide-react'
import { CONSULTING_CATEGORIES, CONSULTING_STRATEGIES } from '../../tools/cretop/mini/analysisCore.js'
import type { ClientOpsRecord } from '../../types/clientOps'
import { withSalesInfo } from '../../services/salesPipeline'
import { PillList } from './salesParts'

export function DirectPickPanel({ record, onSave }: { record: ClientOpsRecord; onSave: (next: ClientOpsRecord, msg: string) => unknown }) {
  const picks = record.sales?.picks ?? []
  const toggle = (name: string) => {
    const next = picks.includes(name) ? picks.filter((x) => x !== name) : [...picks, name]
    void onSave(withSalesInfo(record, { picks: next }), picks.includes(name) ? `'${name}' 을(를) 뺐습니다.` : `'${name}' 을(를) 이번 미팅 항목에 넣었습니다.`)
  }
  const chosen = picks.map((n) => CONSULTING_STRATEGIES.find((s) => s.name === n)).filter((s): s is (typeof CONSULTING_STRATEGIES)[number] => !!s)
  return (
    <section aria-label="제안 항목 바로 고르기" data-testid="direct-pick" className="flex flex-col gap-3 rounded-(--radius-panel) border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="t-section text-slate-900">오늘 꺼낼 항목 고르기</h2>
        <span className="t-sub text-slate-500" data-testid="direct-pick-count">{picks.length}개 골랐음 · 컨설팅 항목 {CONSULTING_STRATEGIES.length}개</span>
      </div>
      <div className="flex flex-col gap-2.5">
        {CONSULTING_CATEGORIES.map((cat) => (
          <fieldset key={cat}>
            <legend className="t-meta font-semibold text-slate-500">{cat}</legend>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {CONSULTING_STRATEGIES.filter((s) => s.cat === cat).map((s) => {
                const on = picks.includes(s.name)
                return (
                  <button
                    key={s.name}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(s.name)}
                    className={`tap t-sub inline-flex items-center gap-1 rounded-full border px-3 py-1 font-medium ${on ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                  >
                    {on && <Check aria-hidden="true" className="size-3.5" />}
                    {s.name}
                  </button>
                )
              })}
            </div>
          </fieldset>
        ))}
      </div>
      {chosen.length > 0 && (
        <ol className="grid gap-2 lg:grid-cols-2" data-testid="direct-pick-points">
          {chosen.map((s, i) => (
            <li key={s.name} className="flex flex-col gap-1.5 rounded-(--radius-control) border border-brand-200 bg-brand-50/40 p-3">
              <span className="t-sub font-bold text-slate-900">{i + 1}. {s.name}</span>
              <span className="t-sub break-keep text-slate-700">{s.why}</span>
              {s.questions.length > 0 && (
                <ul className="t-sub flex list-disc flex-col gap-0.5 pl-5 break-keep text-slate-700">
                  {s.questions.slice(0, 3).map((q) => <li key={q}>{q}</li>)}
                </ul>
              )}
              {(s.docs?.length ?? 0) > 0 && <PillList items={s.docs ?? []} />}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
