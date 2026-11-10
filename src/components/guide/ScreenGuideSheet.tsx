/**
 * D-586 휴대폰 '이 화면 안내' — 머리줄의 화면 이름을 누르면 그 화면의 무엇 · 왜 · 효과 · 앞으로 + 이 화면 안에서 할 수 있는 것.
 *
 * 대표(2026-11-10): "메뉴마다 · 기능마다 이게 뭐고 왜 있고 어떤 효과가 있는지". PC 는 마우스를 올리면 뜨지만 휴대폰은 올릴 수 없었다.
 *  - 글은 있는 안내 그대로(content/menuGuide · functionGuide) — 고객 계정에는 고객용 글 · 숨긴 기능은 안 보인다.
 *  - 창 안에서 끝낸다(화면을 떠나지 않는다). 영상 · 다른 메뉴는 [사용법 안내에서 더 보기].
 * 규칙 글이다 — AI 를 부르지 않는다. 저장하는 것 없음.
 */
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Modal } from '../ui/Modal'
import { useIsPilot } from '../../auth/osAccess'
import { useCustomerAudience } from '../../config/customerAudience'
import { GUIDE_LABELS, menuGuide } from '../../content/menuGuide'
import { functionGuidesOf } from '../../content/functionGuide'
import { guideTitle } from './guideTitle'

export function ScreenGuideSheet({ guideKey, fallbackLabel, onClose }: { guideKey: string; fallbackLabel: string; onClose: () => void }) {
  const pilot = useIsPilot()
  const basic = useCustomerAudience()
  const named = guideTitle(guideKey)
  const label = named === guideKey ? fallbackLabel : named
  const g = menuGuide(guideKey, { label, basic })
  const fns = functionGuidesOf(guideKey, { pilot, basic })
  return (
    <Modal
      open
      title="이 화면 안내"
      onClose={onClose}
      footer={
        <Link to={`/guide?m=${encodeURIComponent(guideKey)}`} onClick={onClose} className="tap t-sub inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-control) border border-slate-200 bg-white px-3.5 font-semibold text-slate-800 hover:bg-slate-50" data-testid="screen-guide-more">
          사용법 안내에서 더 보기 <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      }
    >
      <div className="flex flex-col gap-3.5" data-testid="screen-guide" data-key={guideKey}>
        <p className="t-card font-bold break-keep text-slate-900" data-testid="screen-guide-label">
          {label}
        </p>
        <dl className="flex flex-col gap-2.5">
          {(['what', 'why', 'effect', 'next'] as const).map((k) => (
            <div key={k} className="flex flex-col gap-0.5" data-testid={`screen-guide-${k}`}>
              <dt className="t-sub font-bold text-brand-700">{GUIDE_LABELS[k]}</dt>
              <dd className="t-body break-keep text-slate-800">{g[k]}</dd>
            </div>
          ))}
        </dl>
        {fns.length > 0 && (
          <section className="flex flex-col gap-1.5 border-t border-slate-100 pt-3" aria-label="이 화면 안에서 할 수 있는 것" data-testid="screen-guide-functions">
            <h3 className="t-sub font-bold text-brand-700">이 화면 안에서 할 수 있는 것</h3>
            <ul className="flex flex-col gap-1.5">
              {fns.map(({ key, guide }) => (
                <li key={key} className="t-sub break-keep text-slate-800" data-testid="screen-guide-function" data-key={key}>
                  <span className="font-bold text-slate-900">{guide.label}</span> — {menuGuide(key, { basic }).what}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Modal>
  )
}
