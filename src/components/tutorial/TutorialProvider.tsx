/**
 * 안내 영상 (D-185) — 팀장님이 로그인하면 먼저 영상부터. 머리줄 [안내 영상] 으로 언제든 다시.
 *
 * 저절로 띄우는 조건은 services/tutorialPrefs(계산만) 가 정한다. 여기서는 창을 그리고 답을 저장한다.
 * PC(가로가 긴 화면)는 16:9 영상, 휴대폰 세로 화면은 9:16 영상을 튼다 — 같은 내용, 자막이 영상 안에 있다.
 */
import { useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { PlayCircle, X } from 'lucide-react'
import { AuthContext } from '../../auth/authContext'
import { TUTORIAL_VIDEOS, minutesLabel, type TutorialVideo } from '../../config/tutorialVideos'
import {
  hideTutorialForever,
  hideTutorialToday,
  markShownThisSession,
  readTutorialPrefs,
  shouldAutoOpenTutorial,
  wasShownThisSession,
} from '../../services/tutorialPrefs'
import { todayLocalDate } from '../../lib/appClock'
import { useBackToClose } from '../../lib/backToClose'
import { useToast } from '../ui/toastContext'
import { TutorialContext } from './tutorialContext'

type Part = TutorialVideo['key']

/** 휴대폰 세로 화면이면 세로 영상 */
function useTallScreen(): boolean {
  const pick = () => (typeof window === 'undefined' ? false : window.innerWidth < 768 && window.innerHeight > window.innerWidth)
  const [tall, setTall] = useState(pick)
  useEffect(() => {
    const on = () => setTall(pick())
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return tall
}

export function TutorialProvider({ children }: { children: ReactNode }) {
  const auth = useContext(AuthContext)
  const [state, setState] = useState<{ open: boolean; auto: boolean; part: Part }>({ open: false, auto: false, part: 'part1' })

  const access = auth?.access ?? null
  const ready = auth ? auth.bootstrap.status === 'ready' : false
  const hiddenInAccount = auth?.session?.user.user_metadata?.tutorial_hidden === true
  useEffect(() => {
    if (!ready) return
    const go = shouldAutoOpenTutorial({
      access,
      prefs: readTutorialPrefs(),
      today: todayLocalDate(),
      hiddenInAccount,
      shownThisSession: wasShownThisSession(),
    })
    if (!go) return
    markShownThisSession()
    setState({ open: true, auto: true, part: 'part1' })
  }, [ready, access, hiddenInAccount])

  const open = useCallback((part: Part = 'part1') => setState({ open: true, auto: false, part }), [])
  const close = useCallback(() => setState((s) => ({ ...s, open: false })), [])
  const value = useMemo(() => ({ open }), [open])

  return (
    <TutorialContext.Provider value={value}>
      {children}
      {state.open && (
        <TutorialDialog
          part={state.part}
          auto={state.auto}
          onPart={(part) => setState((s) => ({ ...s, part }))}
          onClose={close}
        />
      )}
    </TutorialContext.Provider>
  )
}

function TutorialDialog({ part, auto, onPart, onClose }: { part: Part; auto: boolean; onPart: (p: Part) => void; onClose: () => void }) {
  const tall = useTallScreen()
  const { showToast } = useToast()
  const video = TUTORIAL_VIDEOS.find((v) => v.key === part) ?? TUTORIAL_VIDEOS[0]
  const next = TUTORIAL_VIDEOS[TUTORIAL_VIDEOS.findIndex((v) => v.key === video.key) + 1]
  const ref = useRef<HTMLVideoElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const playNext = useRef(false)
  useBackToClose(true, onClose)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    panelRef.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // 1편이 끝나 2편으로 넘어왔으면 이어서 튼다(이미 한 번 눌러 틀었으므로 소리와 함께 재생이 허락된다)
  useEffect(() => {
    if (!playNext.current) return
    playNext.current = false
    void ref.current?.play().catch(() => {})
  }, [part])

  const hideToday = () => {
    hideTutorialToday(todayLocalDate())
    showToast('오늘은 안내 영상을 띄우지 않습니다 — 머리줄 [안내 영상] 으로 언제든 볼 수 있어요')
    onClose()
  }
  const hideForever = () => {
    hideTutorialForever()
    // 다른 기기에서도 뜨지 않게 로그인 계정 정보에도 남긴다(로컬 모드에서는 이 기기만)
    void import('../../auth/authService').then((m) => m.setTutorialHidden(true)).catch(() => {})
    showToast('앞으로 안내 영상을 저절로 띄우지 않습니다 — 머리줄 [안내 영상] 으로 언제든 볼 수 있어요')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-navy-950/85 p-0 sm:p-4" data-testid="tutorial-backdrop">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="안내 영상"
        tabIndex={-1}
        data-testid="tutorial-dialog"
        data-auto={auto ? '1' : '0'}
        className="flex h-dvh max-h-dvh w-full max-w-[1180px] flex-col overflow-hidden bg-[#10171e] text-white shadow-(--shadow-overlay) outline-none sm:h-auto sm:max-h-[96dvh] sm:rounded-(--radius-panel)"
      >
        <div className="flex shrink-0 items-center gap-2 px-3 pt-3 sm:px-5 sm:pt-4">
          <PlayCircle aria-hidden="true" className="size-5 shrink-0 text-[#e8c995]" />
          <h2 className="min-w-0 flex-1 truncate text-[1.05rem] font-bold">안내 영상</h2>
          <button
            type="button"
            aria-label="닫기"
            data-testid="tutorial-close"
            onClick={onClose}
            className="tap flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
        <div role="tablist" aria-label="안내 영상 고르기" className="flex shrink-0 gap-2 overflow-x-auto px-3 pt-2 pb-3 sm:px-5">
          {TUTORIAL_VIDEOS.map((v) => {
            const on = v.key === video.key
            return (
              <button
                key={v.key}
                type="button"
                role="tab"
                aria-selected={on}
                data-testid={`tutorial-tab-${v.key}`}
                onClick={() => onPart(v.key)}
                className={`tap flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-left text-[0.9rem] ${on ? 'border-[#d2a45f] bg-[#d2a45f]/15 text-white' : 'border-white/15 text-white/75 hover:border-white/30'}`}
              >
                <b className="font-bold">{v.label}</b>
                {/* 휴대폰에서는 편 · 길이만(두 편이 한 줄에 들어가게) */}
                <span className="hidden whitespace-nowrap sm:inline">{v.title}</span>
                <span className="whitespace-nowrap text-white/55">{minutesLabel(v.seconds)}</span>
              </button>
            )
          })}
        </div>
        {/* 남은 높이만큼만 — 영상이 위 고르기 · 아래 단추를 덮지 않게 */}
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black">
          <video
            key={`${video.key}-${tall ? 'tall' : 'wide'}`}
            ref={ref}
            data-testid="tutorial-video"
            data-ratio={tall ? 'tall' : 'wide'}
            src={tall ? video.tall : video.wide}
            poster={tall ? video.posterTall : video.posterWide}
            controls
            playsInline
            preload="metadata"
            onEnded={() => {
              if (!next) return
              playNext.current = true
              onPart(next.key)
            }}
            className={tall ? 'h-full w-full object-contain' : 'aspect-video max-h-full w-full object-contain sm:max-h-[calc(96dvh-170px)]'}
          />
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 px-3 py-3 sm:px-5">
          {auto ? (
            <>
              <button
                type="button"
                data-testid="tutorial-hide-today"
                onClick={hideToday}
                className="tap min-h-11 cursor-pointer rounded-(--radius-control) border border-white/20 px-4 text-[0.95rem] font-semibold text-white/90 hover:bg-white/10"
              >
                오늘 하루 안 보기
              </button>
              <button
                type="button"
                data-testid="tutorial-hide-forever"
                onClick={hideForever}
                className="tap min-h-11 cursor-pointer rounded-(--radius-control) border border-white/20 px-4 text-[0.95rem] font-semibold text-white/90 hover:bg-white/10"
              >
                앞으로 보지 않기
              </button>
            </>
          ) : (
            <p className="text-[0.9rem] text-white/60">머리줄 [안내 영상] 으로 언제든 다시 볼 수 있어요.</p>
          )}
          <button
            type="button"
            onClick={onClose}
            className="tap ml-auto min-h-11 cursor-pointer rounded-(--radius-control) bg-[#d2a45f] px-5 text-[0.95rem] font-bold text-[#171b20] hover:bg-[#e8c995]"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
