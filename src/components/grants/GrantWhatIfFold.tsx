/**
 * D-556 업체 상세 '맞는 지원사업' 아래 — 한 가지만 갖추면 더 맞는 공고(평소 접힘 · 한 줄 요약).
 * 펼치면 갖출 것마다: 새로 맞는 공고(제목 · 마감 · 지원 내용) + 이어서 준비할 곳.
 * 화면 원칙: 흰 바탕 · 얇은 회색 테두리 · 강조는 글자색 · 누를 수 있는 것은 손가락(전역 규칙).
 */
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { VERDICT_LABEL } from '../../services/grants/grantMatch'
import { renewalRiskLine, whatIfLine, type GrantRenewalRisk, type GrantWhatIf } from '../../services/grants/grantWhatIf'

/** D-557 곧 끝나는 인증 — 갱신하지 않으면 못 하는 공고(빨간 글자 = 주의) */
export function GrantRenewalLines({ risks }: { risks: readonly GrantRenewalRisk[] }) {
  if (!risks.length) return null
  return (
    <ul className="mt-3 flex flex-col gap-2" data-testid="grants-renewal">
      {risks.map((r) => (
        <li key={r.cert} className="flex flex-col gap-0.5 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2" data-testid="grants-renewal-item" data-cert={r.cert}>
          <p className="t-sub break-keep font-semibold text-danger-700">{renewalRiskLine(r)}</p>
          <p className="t-sub break-keep text-slate-600">{r.lost.slice(0, 3).map((m) => `${m.notice.title} — ${m.deadline.label}`).join(' · ')}{r.lost.length > 3 ? ` 외 ${r.lost.length - 3}건` : ''}</p>
          {r.next ? (
            <Link to={r.next.href} className="tap t-sub inline-flex items-center gap-1 self-start font-semibold text-brand-700 hover:underline" data-testid="grants-renewal-next">
              {r.next.label} <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

export function GrantWhatIfFold({ list }: { list: readonly GrantWhatIf[] }) {
  if (!list.length) return null
  const total = new Set(list.flatMap((w) => w.gained.map((m) => m.notice.id))).size
  return (
    <details className="mt-3 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2" data-testid="grants-whatif">
      <summary className="sum-chev tap t-sub min-h-9 cursor-pointer break-keep text-slate-800">
        <b className="font-semibold text-slate-900">한 가지만 갖추면 더 맞는 공고 {total}건</b>
        <span className="text-slate-600"> — {whatIfLine(list)}</span>
      </summary>
      <p className="t-sub mt-1 break-keep text-slate-600">지금 열린 공고 가운데, 아래 하나만 갖추면 조건이 맞는 공고예요. 공고에 적힌 조건으로만 다시 판정했어요.</p>
      <ul className="mt-2 flex flex-col gap-3" data-testid="grants-whatif-list">
        {list.map((w) => (
          <li key={w.key} className="flex flex-col gap-1" data-testid="grants-whatif-item" data-key={w.key}>
            <p className="t-sub break-keep text-slate-900">
              <b className="font-semibold">{w.label}</b> → 공고 <b className="font-semibold text-brand-700">{w.gained.length}건</b> 더
              {w.fit > 0 && w.fit < w.gained.length ? <span className="text-slate-600"> (조건 맞음 {w.fit} · 확인 필요 {w.gained.length - w.fit})</span> : null}
            </p>
            <ul className="t-sub flex flex-col gap-0.5 pl-4 break-keep text-slate-700">
              {w.gained.slice(0, 5).map((m) => (
                <li key={m.notice.id} className="list-disc">
                  {m.notice.title} <span className="text-slate-500">— {m.deadline.label}{m.notice.amountText ? ` · ${m.notice.amountText}` : ''}{m.verdict !== 'fit' ? ` · ${VERDICT_LABEL[m.verdict]}` : ''}</span>
                </li>
              ))}
              {w.gained.length > 5 ? <li className="list-none text-slate-500">외 {w.gained.length - 5}건</li> : null}
            </ul>
            {w.next ? (
              <Link to={w.next.href} className="tap t-sub inline-flex items-center gap-1 self-start font-semibold text-brand-700 hover:underline" data-testid="grants-whatif-next">
                {w.next.label} <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </details>
  )
}
