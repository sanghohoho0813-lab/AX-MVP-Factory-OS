/**
 * D-254 머리줄 [ChatGPT 옆에] — 누르면 작은 판: 어느 AI(ChatGPT · Claude · Gemini) · 폭 3단계 · 옆에 열기 · 앞으로 · 닫기 ·
 * OS 도 왼쪽 창으로 · 팝업이 막혔을 때 푸는 법 · 창 정리 단축키. PC 에서만(휴대폰은 앱을 오가는 편이 빠르다).
 * 보기 무대(iframe) 안에서는 숨긴다(바깥 머리줄에 하나만).
 */
import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, PanelRight, PanelsLeftRight, X } from 'lucide-react'
import { inFrame } from '../../lib/deviceView'
import { SIDE_SERVICES, SIDE_WIDTHS, closeSideAi, focusSideAi, openOsLeft, openSideAi, setSidePrefs, useSideAi, type SideService, type SideWidth } from '../../lib/sideAi'

export function SideAiButton() {
  const s = useSideAi()
  const [open, setOpen] = useState(false)
  const [osOpened, setOsOpened] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])
  if (inFrame()) return null
  const name = SIDE_SERVICES[s.service].label
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`${name} 옆에 띄우기`}
        title={`${name} 옆에 띄우기 — OS 를 보면서 오른쪽에 AI 창`}
        data-testid="side-ai-button"
        data-open={s.open ? '1' : '0'}
        className={`inline-flex h-10 min-w-10 shrink-0 items-center justify-center gap-1.5 rounded-(--radius-control) border px-2 text-[0.85rem] font-semibold whitespace-nowrap min-[1900px]:px-2.5 ${s.open ? 'border-violet-500 bg-violet-600 text-white hover:bg-violet-700' : 'border-violet-300 bg-violet-50 text-violet-800 hover:bg-violet-100'}`}
      >
        <PanelRight aria-hidden="true" className="size-4" />
        <span aria-hidden="true" className="hidden min-[1900px]:inline">{name} 옆에</span>
      </button>
      {open && (
        <div role="dialog" aria-label="AI 옆 창" className="absolute right-0 z-50 mt-2 flex w-[22rem] flex-col gap-3 rounded-(--radius-panel) border border-slate-200 bg-white p-4 text-slate-900 shadow-(--shadow-card)" data-testid="side-ai-panel">
          <div className="flex items-start gap-2">
            <p className="t-body min-w-0 flex-1 font-bold break-keep">AI 를 옆에 띄우기</p>
            <button type="button" onClick={() => setOpen(false)} aria-label="닫기" className="tap -mt-1 -mr-1 flex size-9 items-center justify-center rounded-(--radius-control) text-slate-500 hover:bg-slate-100">
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="t-meta font-semibold text-slate-600">어느 AI</span>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="어느 AI">
              {(Object.keys(SIDE_SERVICES) as SideService[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={s.service === id}
                  onClick={() => setSidePrefs({ service: id })}
                  data-testid="side-ai-service"
                  data-id={id}
                  className={`tap t-sub min-h-10 rounded-full border px-3 font-semibold ${s.service === id ? 'border-violet-600 bg-violet-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
                >
                  {SIDE_SERVICES[id].label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="t-meta font-semibold text-slate-600">옆 창 폭</span>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="옆 창 폭">
              {(Object.keys(SIDE_WIDTHS) as SideWidth[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={s.width === id}
                  onClick={() => setSidePrefs({ width: id })}
                  data-testid="side-ai-width"
                  data-id={id}
                  className={`tap t-sub min-h-10 rounded-full border px-3 font-semibold ${s.width === id ? 'border-violet-600 bg-violet-50 text-violet-900' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
                >
                  {SIDE_WIDTHS[id].label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => openSideAi()} className="tap t-sub inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-(--radius-control) bg-violet-700 px-3 font-semibold text-white hover:bg-violet-800" data-testid="side-ai-open">
              <PanelRight aria-hidden="true" className="size-4" /> {s.open ? '다시 붙이기' : `${name} 옆에 열기`}
            </button>
            {s.open && (
              <>
                <button type="button" onClick={() => focusSideAi()} className="tap t-sub inline-flex min-h-11 items-center gap-1 rounded-(--radius-control) border border-slate-300 px-3 font-semibold text-slate-700 hover:bg-slate-50" data-testid="side-ai-front">
                  <ArrowUpRight aria-hidden="true" className="size-4" /> 앞으로
                </button>
                <button type="button" onClick={() => closeSideAi()} className="tap t-sub inline-flex min-h-11 items-center gap-1 rounded-(--radius-control) border border-slate-300 px-3 font-semibold text-slate-700 hover:bg-slate-50" data-testid="side-ai-close">
                  <X aria-hidden="true" className="size-4" /> 닫기
                </button>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={() => setOsOpened(openOsLeft(window.location.href))}
            className="tap t-sub inline-flex min-h-11 items-center justify-center gap-1.5 rounded-(--radius-control) border border-violet-300 bg-violet-50 px-3 font-semibold text-violet-900 hover:bg-violet-100"
            data-testid="side-ai-os-left"
          >
            <PanelsLeftRight aria-hidden="true" className="size-4" /> OS 도 왼쪽 창으로(반반 딱 맞게)
          </button>
          {osOpened && !s.blocked && (
            <p className="t-meta break-keep text-slate-600" data-testid="side-ai-os-note">
              왼쪽에 OS 새 창을 열었어요 — 거기서 이어서 쓰세요(이 탭은 닫아도 돼요. 로그인 · 저장은 같아요).
            </p>
          )}
          {s.blocked && (
            <p role="alert" className="t-sub break-keep rounded-(--radius-control) bg-amber-50 px-3 py-2 text-amber-900" data-testid="side-ai-blocked">
              브라우저가 새 창을 막았어요 — 주소창 오른쪽의 <b>팝업 차단</b> 아이콘을 눌러 <b>항상 허용</b>을 고른 뒤 다시 눌러 주세요.
            </p>
          )}
          <p className="t-meta break-keep text-slate-500">
            ChatGPT · Claude · Gemini 는 보안 때문에 OS 화면 안에는 넣을 수 없어 옆 창으로 엽니다. 창을 겹치지 않게 놓으려면 Windows 는 창을 누르고 <b>Win+←</b> · <b>Win+→</b>, Mac 은 초록 단추를 길게 눌러 왼쪽/오른쪽에 타일.
          </p>
        </div>
      )}
    </div>
  )
}
