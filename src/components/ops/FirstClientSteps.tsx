/**
 * 업체가 하나도 없을 때 — 등록하면 무엇이 되는지 1 → 2 → 3 (📐 화면 원칙: 누르면 어떻게 되는지 예측되게).
 * 휴대폰은 테두리 없이 세 줄(첫 화면이 길어지지 않게), PC 는 세 칸.
 * 새 업체 등록 창은 사업자등록증 · 등기부를 올리면 칸을 채우고, 등록하면 그 서류가 서류함으로 간다.
 */
import { ArrowRight, Check, X } from 'lucide-react'
import { Button } from '../ui/Button'
import { firstUseNext, type FirstStep } from '../../services/firstUse'
import { useCustomerAudience } from '../../config/customerAudience'

const STEPS: { title: string; note: string }[] = [
  { title: '첫 업체 등록', note: '사업자등록증을 올리면 이름 · 번호 · 대표가 채워져요' },
  { title: '서류 올리기', note: '대충 올려도 프로그램이 칸 · 회사 정보를 채워요' },
  { title: '맞춤 추천', note: '맞는 모듈 · 예상 금액 · 할 일이 바로 떠요' },
]
/** D-563 전문 모듈이 없는 계정(외부 구독 고객) — 없는 것을 약속하지 않는다 */
const STEP3_BASIC = { title: '확인 · 할 일', note: '읽은 정보 확인 · 챙길 일 · 기한이 바로 떠요' }

export function FirstClientSteps() {
  const customer = useCustomerAudience()
  const steps = customer ? [...STEPS.slice(0, 2), STEP3_BASIC] : STEPS
  return (
    <ol className="mx-auto grid w-full max-w-2xl gap-2.5 text-left sm:grid-cols-3 sm:gap-2" data-testid="first-client-steps" aria-label="시작 순서">
      {steps.map((s, i) => (
        <li key={s.title} className="flex min-w-0 items-start gap-2 sm:rounded-(--radius-control) sm:border sm:border-slate-200 sm:bg-white sm:px-3 sm:py-2.5">
          <span className="t-meta mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-brand-200 font-bold text-brand-700 tabular-nums">{i + 1}</span>
          <span className="flex min-w-0 flex-col">
            <span className="t-sub font-semibold text-slate-900">{s.title}</span>
            <span className="t-meta break-keep [overflow-wrap:anywhere] text-slate-500">{s.note}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}

/**
 * D-519 처음 시작 한 줄 — 첫 업체를 등록한 뒤에도 다 해 볼 때까지 오늘 맨 위에(UX-2).
 * '처음 시작 2/4 · 다음: 서류 한 장 올리기' + 큰 단추 하나(누르면 그 자리로) + 단계 점(✓) · [닫기](이 기기에서 다시 안 보임).
 */
export function FirstUseCard({ steps, onGo, onClose }: { steps: readonly FirstStep[]; onGo: (href: string) => void; onClose: () => void }) {
  const next = firstUseNext(steps)
  if (!next) return null
  const done = steps.filter((s) => s.done).length
  return (
    <section className="flex flex-col gap-2.5 rounded-(--radius-panel) border border-slate-200 bg-white px-4 py-3" data-testid="today-firstuse" data-next={next.key} aria-label="처음 시작">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
        <span className="t-meta shrink-0 font-bold text-brand-700" data-testid="today-firstuse-count">
          처음 시작 {done}/{steps.length}
        </span>
        <span className="flex min-w-0 flex-1 basis-56 flex-col">
          <span className="t-body font-bold break-keep text-slate-900">다음: {next.title}</span>
          <span className="t-sub break-keep text-slate-600">{next.note}</span>
        </span>
        <Button variant="primary" onClick={() => onGo(next.href)} data-testid="today-firstuse-go">
          {next.action} <ArrowRight aria-hidden="true" className="size-4" />
        </Button>
        <button type="button" aria-label="처음 시작 닫기" onClick={onClose} data-testid="today-firstuse-close" className="tap inline-flex size-10 shrink-0 items-center justify-center rounded-(--radius-control) text-slate-500 hover:bg-slate-50">
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
      <ol className="flex flex-wrap gap-x-3 gap-y-1" aria-label="처음 시작 단계">
        {steps.map((s, i) => (
          <li key={s.key} className={`t-meta inline-flex items-center gap-1 ${s.done ? 'text-success-700' : s.key === next.key ? 'font-bold text-slate-900' : 'text-slate-500'}`} data-testid="today-firstuse-step" data-step={s.key} data-done={s.done ? '1' : '0'}>
            {s.done ? <Check aria-hidden="true" className="size-3.5" /> : <span aria-hidden="true" className="tabular-nums">{i + 1}</span>}
            {s.title}
          </li>
        ))}
      </ol>
    </section>
  )
}
