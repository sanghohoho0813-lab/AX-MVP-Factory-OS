/**
 * D-185: 머리줄 [안내 영상] — 언제든 다시 보기. 휴대폰은 아이콘만(이름은 읽어 준다).
 * 글자는 넓은 PC 에서만 — 팀장 1440px · 대표 1700px 부터(대표 머리줄은 화면 전환 · 고객 화면 단추가 더 있다).
 * 대표 머리줄은 1024~1365px 에서 단추도 숨긴다(아주 큰 글자에서 자리가 없다 — 사용자 메뉴에서 연다).
 */
import { PlayCircle } from 'lucide-react'
import { useTutorial } from './tutorialContext'

export function TutorialButton({ roomy = false }: { roomy?: boolean }) {
  const t = useTutorial()
  if (!t) return null
  return (
    <button
      type="button"
      data-testid="tutorial-open"
      aria-label="안내 영상 보기"
      title="안내 영상 보기"
      onClick={() => t.open()}
      className={`${roomy ? '' : 'lg:max-[1365px]:hidden '}tap hdr-tight flex size-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-(--radius-control) text-slate-600 hover:bg-slate-100 hover:text-slate-900 lg:h-10 lg:w-auto lg:border lg:border-slate-200 lg:px-2.5 lg:text-[0.9rem] lg:font-medium`}
    >
      <PlayCircle aria-hidden="true" className="size-5 shrink-0 text-brand-600" />
      <span className={roomy ? 'hidden min-[1440px]:inline' : 'hidden min-[1700px]:inline'}>안내 영상</span>
    </button>
  )
}

/** 사용자 메뉴 안 [안내 영상 보기] — 머리줄 단추가 숨는 폭(대표 1024~1279px)에서도 열 수 있게 */
export function TutorialMenuItem({ onPick }: { onPick?: () => void }) {
  const t = useTutorial()
  if (!t) return null
  return (
    <button
      type="button"
      data-testid="tutorial-menu-open"
      onClick={() => {
        onPick?.()
        t.open()
      }}
      className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
    >
      <PlayCircle aria-hidden="true" className="size-4 text-slate-400" /> 안내 영상 보기
    </button>
  )
}
