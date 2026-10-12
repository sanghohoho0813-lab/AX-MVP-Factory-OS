import { BriefcaseBusiness, Building2 } from 'lucide-react'
import { CLIENT_TYPES, type ClientType } from '../../services/clientType'

/**
 * D-182: '어디로 분류할까요?' — 새 업체를 만드는 곳마다 같은 모양으로(고객 관리 · 상담신청 연결 · 영업 보드 · 크레탑 등록).
 * 대표 화면에서만 쓴다 — 팀장(Pilot) 화면에서는 부르는 쪽이 그리지 않는다.
 */
export function ClientTypePicker({
  value,
  onChange,
  testId = 'new-client-type',
  legend = '어디로 분류할까요?',
  hint,
}: {
  value: ClientType
  onChange: (t: ClientType) => void
  /** fieldset 은 testId, 단추는 `${testId}-sme` · `${testId}-consultant` */
  testId?: string
  legend?: string
  /** 왜 이쪽으로 골라 두었는지(신청서에 적힌 말 등) */
  hint?: string
}) {
  return (
    <fieldset data-testid={testId}>
      <legend className="text-[0.95rem] font-semibold text-slate-800">{legend}</legend>
      <div className="mt-1.5 grid grid-cols-2 gap-2">
        {CLIENT_TYPES.map((t) => {
          const on = value === t
          const Icon = t === 'sme' ? Building2 : BriefcaseBusiness
          return (
            <button
              key={t}
              type="button"
              aria-pressed={on}
              data-testid={`${testId}-${t}`}
              onClick={() => onChange(t)}
              className={`tap flex min-w-0 items-start gap-2 rounded-(--radius-control) border px-3 py-2 text-left ${on ? 'border-brand-600 bg-brand-50 ring-1 ring-brand-600' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
            >
              <Icon aria-hidden="true" className={`mt-0.5 size-5 shrink-0 ${on ? 'text-brand-700' : 'text-slate-400'}`} />
              <span className="flex min-w-0 flex-col">
                <span className="text-[0.98rem] font-bold break-keep text-slate-900">{t === 'sme' ? '중소기업 대표님' : '컨설턴트'}</span>
                <span className="t-meta break-keep text-slate-500">{t === 'sme' ? '지금까지 고객' : '따로 관리'}</span>
              </span>
            </button>
          )
        })}
      </div>
      {hint && <p data-testid={`${testId}-hint`} className="t-meta mt-1.5 break-keep text-brand-700">{hint}</p>}
    </fieldset>
  )
}
