/**
 * '이 답변은 무엇을 근거로 만들었나요?' (P1) — 판정에 쓴 사실과 출처. ✓ 확인 · △ 추정 · 미확인 · ? 모름. 기본은 접힘.
 */
import { Check, CircleHelp, Triangle } from 'lucide-react'
import { basisFor } from '../core/basis'
import type { CertificationClientContext, CertificationKey } from '../core/types'

export function BasisBox({ cert, ctx }: { cert: CertificationKey; ctx: CertificationClientContext }) {
  const items = basisFor(cert, ctx)
  const known = items.filter((b) => b.state !== 'missing').length
  return (
    <details className="rounded-(--radius-control) border border-slate-200" data-testid="cert-basis">
      <summary className="tap t-sub cursor-pointer px-3 py-2 font-semibold text-slate-700">
        이 답변은 무엇을 근거로 만들었나요? <span className="font-normal text-slate-500">({known}/{items.length})</span>
      </summary>
      <ul className="flex flex-col gap-1 px-3 pb-3">
        {items.map((b) => (
          <li key={b.field} className="t-sub flex items-start gap-1.5 break-keep" data-testid="cert-basis-item" data-state={b.state}>
            <span className="mt-0.5 flex w-4 justify-center">
              {b.state === 'confirmed' ? <Check aria-hidden="true" className="size-4 text-success-600" /> : b.state === 'estimated' ? <Triangle aria-hidden="true" className="size-3.5 text-warning-600" /> : <CircleHelp aria-hidden="true" className="size-4 text-slate-400" />}
            </span>
            <span className="sr-only">{b.state === 'confirmed' ? '확인됨' : b.state === 'estimated' ? '추정 · 미확인' : '모름'}: </span>
            <span className="min-w-0">
              <b className="font-semibold text-slate-800">{b.label}</b> {b.value ? `${b.value}` : <span className="text-slate-500">모름</span>}
              {b.from && <span className="text-slate-500"> — {b.from}</span>}
            </span>
          </li>
        ))}
      </ul>
      <p className="t-meta px-3 pb-3 break-keep text-slate-500">✓ 서류 · 회사 정보(확인) · 연구소 관리 기록 △ 입력값 · 컨설턴트가 고른 값(회사 정보 미확인). 판정은 규칙 계산이며 AI 가 아닙니다.</p>
    </details>
  )
}
