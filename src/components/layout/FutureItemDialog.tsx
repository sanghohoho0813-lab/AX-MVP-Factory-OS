/**
 * 향후 확장 안내창 (D-103).
 *
 * 사이드바 '향후 확장' 을 누르면 화면을 옮기지 않고 메뉴 안에서 목록이 펼쳐진다.
 * 하나를 누르면 이 창이 화면 가운데 뜬다 — 그 기능이 생기면 **어떻게 돌아갈 수 있는지**(순서)와
 * **한 장면 예시**를 먼저, 왜 지금은 아닌지·언제 다시 볼지는 아래에 작게. Esc · 바깥 · 닫기로 끈다.
 * 아직 없는 기능이므로 이 창 어디에도 그 기능을 '쓰는' 단추는 없다.
 */
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { futureIcon } from './futureIcons'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { FUTURE_ITEMS, type FutureItem } from '../../config/capabilityStatus'

export function FutureItemDialog({ item, onClose, onPick }: { item: FutureItem | null; onClose: () => void; onPick: (next: FutureItem) => void }) {
  if (!item || typeof document === 'undefined') return null
  const idx = FUTURE_ITEMS.findIndex((f) => f.key === item.key)
  const prev = idx > 0 ? FUTURE_ITEMS[idx - 1] : null
  const next = idx >= 0 && idx < FUTURE_ITEMS.length - 1 ? FUTURE_ITEMS[idx + 1] : null
  const Icon = futureIcon(item.key)
  return createPortal(
    <Modal
      open
      size="lg"
      title={item.label}
      onClose={onClose}
      footer={
        <div className="flex w-full items-center gap-2">
          <Button variant="ghost" size="sm" disabled={!prev} onClick={() => prev && onPick(prev)}>
            <ChevronLeft aria-hidden="true" className="size-4" /> 이전
          </Button>
          <Button variant="ghost" size="sm" disabled={!next} onClick={() => next && onPick(next)}>
            다음 <ChevronRight aria-hidden="true" className="size-4" />
          </Button>
          <span className="t-meta ml-auto text-slate-400 tabular-nums">{idx + 1} / {FUTURE_ITEMS.length}</span>
          <Button variant="primary" size="sm" onClick={onClose}>닫기</Button>
        </div>
      }
    >
      <div data-testid="future-dialog" className="flex flex-col gap-4 text-slate-700">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-(--radius-control) bg-brand-50 text-brand-700">
            <Icon className="size-5" />
          </span>
          <div className="min-w-0">
            <span className="t-meta inline-block rounded-full border border-slate-300 px-2 py-0.5 font-semibold tracking-wide text-slate-500">NEXT · 아직 없는 기능</span>
            <p className="t-body mt-1.5 break-keep text-slate-800">{item.what}</p>
          </div>
        </div>

        <section aria-label="이렇게 돌아갈 수 있습니다">
          <p className="t-meta font-bold tracking-wide text-brand-700">이렇게 돌아갈 수 있습니다</p>
          <ol className="mt-2 flex flex-col gap-2">
            {item.scenario.map((line, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span aria-hidden="true" className="t-meta flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-600 font-bold text-white tabular-nums">{i + 1}</span>
                <span className="t-sub break-keep text-slate-700">{line}</span>
              </li>
            ))}
          </ol>
        </section>

        <section aria-label="예시" className="rounded-(--radius-control) border border-brand-100 bg-brand-50/60 px-3.5 py-3">
          <p className="t-meta font-bold tracking-wide text-brand-700">예시</p>
          <p className="t-sub mt-1 break-keep text-slate-700">{item.example}</p>
        </section>

        <dl className="grid gap-3 border-t border-slate-100 pt-3 sm:grid-cols-2">
          <div>
            <dt className="t-meta font-semibold text-slate-500">왜 지금은 아닌가</dt>
            <dd className="t-sub mt-0.5 break-keep text-slate-600">{item.whyNotNow}</dd>
          </div>
          <div>
            <dt className="t-meta font-semibold text-slate-500">언제 다시 볼까</dt>
            <dd className="t-sub mt-0.5 break-keep text-slate-600">{item.revisitWhen}</dd>
          </div>
        </dl>
      </div>
    </Modal>,
    document.body,
  )
}
