/**
 * D-258 판 맨 위 'OS 안에서 열기' — [AI 대화] · [Google 검색] 을 새 창 없이 OS 오른쪽 판(SideDock)으로.
 * D-256 판에 주소 칸 — 주소(google.com · naver.com …)나 검색어를 적고 [열기] → 같은 옆 창이 그리로(비우면 Google).
 *   옆 창의 주소창은 브라우저가 고칠 수 없게 막아 두므로 여기서 바꾼다. 바로 가기: 네이버 · 기업마당 · K-Startup · 홈택스.
 * D-254 [ChatGPT 옆에 띄우기] — 누르면 작은 판: 어느 AI(ChatGPT · Claude · Gemini) · 폭 3단계 · 옆에 열기 · 앞으로 · 닫기 ·
 * OS 도 왼쪽 창으로 · 팝업이 막혔을 때 푸는 법 · 창 정리 단축키. PC 에서만(휴대폰은 앱을 오가는 편이 빠르다).
 * D-265 자리는 본문 오른쪽 위 — 대표: "왼쪽 메뉴 맨 아래보다 PC 기준 우측 상단 여백에".
 *   본문 오른쪽 여백에 단추가 들어가면 그 여백에 화면 고정(굴려도 그 자리) · 모자라면 본문 맨 위 줄(경로 줄) 오른쪽.
 *   옆 창 · 오른쪽 판이 열리면 그 왼쪽으로 따라온다. 머리줄은 이미 꽉 차 넣지 않는다(D-254 실측 — 1024 · 1440 · 1600 · 1900 에서 넘쳤다).
 * 판은 단추 아래에 화면 고정(오른쪽 끝을 단추에 맞춤). 보기 무대(iframe) 안에서는 숨긴다(바깥에 하나만).
 * D-261 대표: "옆에 열기 누르면 그 안에서 떴으면 · 새 창 말고". ChatGPT · Claude · Gemini 사이트는 그 회사가 다른 화면 안에 넣지 못하게
 *   막아 두어(브라우저가 지킨다) 사이트 그대로는 옆 창으로만 열린다. 그래서 맨 위에서 AI 를 고르면
 *   ① [OS 안에서 이 AI 로 대화] — 같은 회사 모델(GPT · Claude · Gemini)로 OS 안 오른쪽 판에서 묻고 답한다(새 창 없음)
 *   ② [사이트 그대로 옆 창] — 로그인 · 대화 기록이 필요할 때. 끊긴 창(cut)이면 [원래대로] 로 자리를 되돌린다.
 *   D-265 끊긴 창도 닫으면 비켜 준 자리에 마우스가 오는 순간 가운데로 돌아온다(lib/sideAi) — [원래대로] 는 바로 돌리고 싶을 때.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { ArrowUpRight, Globe, PanelRight, PanelsLeftRight, Search, Sparkles, X } from 'lucide-react'
import { inFrame } from '../../lib/deviceView'
import { closeDock, openDock, useDock } from '../../lib/sideDock'
import { CORNER_GAP, SIDE_SERVICES, SIDE_SITES, SIDE_WIDTHS, closeSideAi, cornerSpot, focusSideAi, openOsLeft, openSideAddress, openSideAi, setSidePrefs, useSideAi, type SideService, type SideWidth } from '../../lib/sideAi'
import { fetchAssistStatus, type ProviderId } from '../../services/aiAssist/client'
import { allowedProviders, readChoice, saveChoice } from '../../services/aiAssist/store'
import { useToast } from '../ui/toastContext'

/** 옆 창 서비스 → OS 안 대화에 쓸 AI 회사 */
const PROVIDER_OF: Partial<Record<SideService, ProviderId>> = { chatgpt: 'openai', claude: 'anthropic', gemini: 'gemini' }
const MODEL_NAME: Partial<Record<SideService, string>> = { chatgpt: 'GPT', claude: 'Claude', gemini: 'Gemini' }

/**
 * D-265 단추 자리 재기 — 본문 글 오른쪽 끝 · 쓸 수 있는 오른쪽 끝(본문 칸 안쪽 끝 · 오른쪽 판 왼쪽) · 머리줄 아래 끝.
 * 본문 칸의 오른쪽 여백(padding)에는 옆 창 · 붙인 판 몫이 들어 있다. 덮어 띄운 판은 그 왼쪽 끝까지.
 */
function measureCorner(btnW: number): { spot: 'margin' | 'inline'; left: number; top: number } {
  const main = document.querySelector('main')
  const col = main?.parentElement
  if (!main || !col) return { spot: 'inline', left: 0, top: 0 }
  const m = main.getBoundingClientRect()
  const textRight = m.right - (parseFloat(getComputedStyle(main).paddingRight) || 0)
  let limit = col.getBoundingClientRect().right - (parseFloat(getComputedStyle(col).paddingRight) || 0)
  const dockEl = document.querySelector('[data-testid="side-dock"]')
  if (dockEl) limit = Math.min(limit, dockEl.getBoundingClientRect().left)
  const header = document.querySelector('header')
  const top = Math.round((header?.getBoundingClientRect().bottom ?? 64) + 20)
  // 화면 고정 자리는 왼쪽에서 잰다 — 오른쪽 기준은 스크롤 막대 자리(약 15px)만큼 어긋났다(실측)
  return { spot: cornerSpot(limit, textRight, btnW), left: Math.round(limit - CORNER_GAP - btnW), top }
}

export function SideAiButton() {
  const s = useSideAi()
  const dock = useDock()
  const [open, setOpen] = useState(false)
  const [at, setAt] = useState<CSSProperties>({})
  const [corner, setCorner] = useState<{ spot: 'margin' | 'inline'; left: number; top: number }>({ spot: 'inline', left: 0, top: 0 })
  const [osOpened, setOsOpened] = useState(false)
  const [addr, setAddr] = useState('')
  const box = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const { showToast } = useToast()
  const [starting, setStarting] = useState(false)

  /** D-261 OS 안 오른쪽 판에서 고른 AI 회사 모델로 대화 — 그 회사 모델을 아직 안 골랐으면 보통(standard) 모델로 바꿔 둔다 */
  const chatInside = async () => {
    const want = PROVIDER_OF[s.service]
    if (want && readChoice()?.provider !== want) {
      if (!allowedProviders().includes(want)) showToast('이 계정은 Gemini 로 대화해요 — OS 안 판을 Gemini 로 엽니다')
      else {
        setStarting(true)
        try {
          const p = (await fetchAssistStatus(true)).providers.find((x) => x.id === want)
          const m = p?.configured ? (p.models.find((x) => x.tier === 'standard') ?? p.models[0]) : undefined
          if (m) saveChoice({ provider: want, model: m.id })
          else showToast(`${MODEL_NAME[s.service]} 키가 아직 없어요 — 지금 고른 모델로 엽니다(판 위 [모델] 에서 바꿀 수 있어요)`)
        } catch {
          /* 목록을 못 읽으면 지금 고른 모델로 연다 */
        } finally {
          setStarting(false)
        }
      }
    }
    openDock('chat')
    setOpen(false)
  }
  // D-265 판은 단추 바로 아래 · 오른쪽 끝을 단추에 맞춤 · 아래로는 화면 안까지만(넘치면 판 안에서 굴린다)
  const placePanel = useCallback(() => {
    const r = btn.current?.getBoundingClientRect()
    if (!r) return
    const w = Math.min(384, window.innerWidth - 16)
    const top = Math.max(8, Math.min(r.bottom + 8, window.innerHeight - 248))
    setAt({ left: Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8)), top, width: w, maxHeight: window.innerHeight - top - 8 })
  }, [])
  const toggle = () => {
    placePanel()
    setOpen((v) => !v)
  }
  const label = s.open ? `${s.at || SIDE_SERVICES[s.service].label} 옆 창 열림` : `${SIDE_SERVICES[s.service].label} 옆에 띄우기`
  // 단추 자리 — 창 크기 · 메뉴 폭 · 본문 폭 · 옆 창 · 오른쪽 판 · 단추 글이 바뀔 때마다 다시 잰다
  const remeasure = useCallback(() => {
    const w = btn.current?.offsetWidth ?? 0
    if (!w) return
    const next = measureCorner(w)
    setCorner((c) => (c.spot === next.spot && c.left === next.left && c.top === next.top ? c : next))
  }, [])
  useLayoutEffect(() => {
    remeasure()
  }, [remeasure, label, s.reserve, dock.open, dock.width])
  useEffect(() => {
    const main = document.querySelector('main')
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => remeasure())
    if (main && ro) {
      ro.observe(main)
      if (main.parentElement) ro.observe(main.parentElement)
    }
    window.addEventListener('resize', remeasure)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', remeasure)
    }
  }, [remeasure])
  // 판이 열린 채 옆 창 · 오른쪽 판 · 자리가 바뀌면 판도 단추를 따라간다(옆 창 밑에 깔리지 않게)
  useLayoutEffect(() => {
    if (open) placePanel()
  }, [open, placePanel, corner, s.reserve, dock.open, dock.width])
  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => {
      const t = e.target as Node
      if (box.current && !box.current.contains(t) && !panelRef.current?.contains(t)) setOpen(false)
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
  const shown = s.at || name
  const inMargin = corner.spot === 'margin'
  return (
    <div
      ref={box}
      className={`no-print hidden lg:block ${inMargin ? 'fixed z-20' : 'mb-3 shrink-0 lg:mb-4'}`}
      style={inMargin ? { top: corner.top, left: corner.left } : undefined}
      data-testid="side-ai-corner"
      data-spot={corner.spot}
    >
      <button
        ref={btn}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={`${name} 옆에 띄우기`}
        title={`${name} 옆에 띄우기 — OS 를 보면서 오른쪽에 AI 창`}
        data-testid="side-ai-button"
        data-open={s.open ? '1' : '0'}
        className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-(--radius-control) border px-3 py-2 text-[0.9rem] font-semibold whitespace-nowrap shadow-(--shadow-card) ${s.open ? 'border-violet-600 bg-violet-600 text-white hover:bg-violet-700' : 'border-violet-300 bg-white text-violet-800 hover:bg-violet-50'}`}
      >
        <PanelRight aria-hidden="true" className="size-[18px] shrink-0" />
        <span>{label}</span>
      </button>
      {/* D-258 판은 body 에 — 메뉴 칸(sticky z-30) 안에 두면 머리줄(z-30)이 판 윗부분을 덮었다(실측) */}
      {open && createPortal(
        <div ref={panelRef} role="dialog" aria-label="AI 옆 창" style={at} className="fixed z-50 flex flex-col gap-3 overflow-y-auto rounded-(--radius-panel) border border-slate-200 bg-white p-4 text-slate-900 shadow-(--shadow-card)" data-testid="side-ai-panel">
          <div className="flex items-start gap-2">
            <p className="t-body min-w-0 flex-1 font-bold break-keep">AI · 웹 옆에 띄우기</p>
            <button type="button" onClick={() => setOpen(false)} aria-label="닫기" className="tap -mt-1 -mr-1 flex size-9 items-center justify-center rounded-(--radius-control) text-slate-500 hover:bg-slate-100">
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
          {/* D-261 무엇을 — 먼저 고르고, 아래에서 'OS 안에서' 또는 '사이트 그대로 옆 창' */}
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="무엇을 띄울까요">
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
          {/* D-258 새 창 없이 OS 안 오른쪽 판으로 — 머리줄 아래 본문 칸 안에 뜬다(우리 서버 · 팀장은 Gemini) */}
          <div className="flex flex-col gap-1.5 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2.5" data-testid="side-ai-inside">
            <span className="t-meta font-semibold text-violet-900">OS 안에서 열기 (새 창 없이 · 화면 오른쪽 칸)</span>
            <div className="flex gap-1.5">
              {s.service === 'google' ? (
                <button
                  type="button"
                  onClick={() => {
                    openDock('web')
                    setOpen(false)
                  }}
                  className="tap t-sub inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-(--radius-control) bg-violet-700 px-3 font-semibold text-white hover:bg-violet-800"
                  data-testid="side-ai-dock-web"
                >
                  <Search aria-hidden="true" className="size-4" /> Google 검색
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={starting}
                    onClick={() => void chatInside()}
                    className="tap t-sub inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-(--radius-control) bg-violet-700 px-3 font-semibold text-white hover:bg-violet-800 disabled:opacity-60"
                    data-testid="side-ai-dock-chat"
                  >
                    <Sparkles aria-hidden="true" className="size-4" /> {MODEL_NAME[s.service] ?? 'AI'} 로 대화
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      openDock('web')
                      setOpen(false)
                    }}
                    className="tap t-sub inline-flex min-h-11 items-center justify-center gap-1.5 rounded-(--radius-control) border border-violet-300 bg-white px-3 font-semibold text-violet-900 hover:bg-violet-100"
                    data-testid="side-ai-dock-web"
                  >
                    <Search aria-hidden="true" className="size-4" /> Google
                  </button>
                </>
              )}
            </div>
            {dock.open && (
              <button type="button" onClick={() => closeDock()} className="tap t-meta self-start font-semibold text-violet-800 underline underline-offset-2" data-testid="side-ai-dock-close">
                오른쪽 판 닫기
              </button>
            )}
          </div>
          <div className="flex flex-col gap-2 rounded-(--radius-control) border border-slate-200 px-3 py-2.5" data-testid="side-ai-site-box">
            <span className="t-meta font-semibold text-slate-700">{name} 사이트 그대로 옆 창 (로그인 · 대화 기록이 필요할 때)</span>
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
                  className={`tap t-meta min-h-9 rounded-full border px-2.5 font-semibold ${s.width === id ? 'border-violet-600 bg-violet-50 text-violet-900' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
                >
                  {SIDE_WIDTHS[id].label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => openSideAi()} className="tap t-sub inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-(--radius-control) border border-violet-400 bg-white px-3 font-semibold text-violet-900 hover:bg-violet-50" data-testid="side-ai-open">
                <PanelRight aria-hidden="true" className="size-4" /> {s.open ? '다시 붙이기' : `${name} 옆 창으로`}
              </button>
              {s.open && !s.cut && (
                <button type="button" onClick={() => focusSideAi()} className="tap t-sub inline-flex min-h-11 items-center gap-1 rounded-(--radius-control) border border-slate-300 px-3 font-semibold text-slate-700 hover:bg-slate-50" data-testid="side-ai-front">
                  <ArrowUpRight aria-hidden="true" className="size-4" /> 앞으로
                </button>
              )}
              {s.open && (
                <button type="button" onClick={() => closeSideAi()} className="tap t-sub inline-flex min-h-11 items-center gap-1 rounded-(--radius-control) border border-slate-300 px-3 font-semibold text-slate-700 hover:bg-slate-50" data-testid="side-ai-close">
                  <X aria-hidden="true" className="size-4" /> {s.cut ? '원래대로' : '닫기'}
                </button>
              )}
            </div>
            {s.cut && (
              <p className="t-meta break-keep text-slate-600" data-testid="side-ai-cut-note">
                {shown} 창을 X 로 닫으면 마우스가 그 자리로 오는 순간 화면이 가운데로 돌아와요. 바로 돌리려면 <b>원래대로</b>.
              </p>
            )}
          </div>
          <form
            className="flex flex-col gap-1.5 rounded-(--radius-control) border border-slate-200 bg-slate-50 px-3 py-2.5"
            onSubmit={(e) => {
              e.preventDefault()
              openSideAddress(addr)
            }}
            data-testid="side-ai-address-form"
          >
            <label htmlFor="side-ai-address" className="t-meta font-semibold text-slate-700">
              주소 · 검색어로 열기 <span className="font-normal text-slate-500">(비우면 Google)</span>
            </label>
            <div className="flex gap-1.5">
              <input
                id="side-ai-address"
                type="text"
                inputMode="url"
                enterKeyHint="go"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                value={addr}
                onChange={(e) => setAddr(e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
                placeholder="google.com · 검색어"
                className="t-sub min-h-11 min-w-0 flex-1 rounded-(--radius-control) border border-slate-300 bg-white px-3 text-slate-900"
                data-testid="side-ai-address"
              />
              <button type="submit" className="tap t-sub inline-flex min-h-11 shrink-0 items-center gap-1 rounded-(--radius-control) bg-slate-800 px-3 font-semibold text-white hover:bg-slate-900" data-testid="side-ai-go">
                <Globe aria-hidden="true" className="size-4" /> 열기
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5" aria-label="바로 가기">
              {SIDE_SITES.map((site) => (
                <button
                  key={site.id}
                  type="button"
                  onClick={() => openSideAddress(site.url, site.label)}
                  className="tap t-meta min-h-9 rounded-full border border-slate-300 bg-white px-2.5 font-semibold text-slate-700 hover:bg-slate-100"
                  data-testid="side-ai-site"
                  data-id={site.id}
                >
                  {site.label}
                </button>
              ))}
            </div>
          </form>
          <button
            type="button"
            onClick={() => setOsOpened(openOsLeft(window.location.href))}
            className="tap t-sub inline-flex min-h-11 items-center justify-center gap-1.5 rounded-(--radius-control) border border-slate-200 bg-white px-3 font-semibold text-violet-900 hover:bg-violet-100"
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
            ChatGPT · Claude · Gemini <b>사이트</b>는 그 회사가 다른 화면 안에 넣지 못하게 막아 두어(브라우저가 지킵니다) 사이트 그대로는 옆 창으로만 열려요 — OS 안에서는 위 <b>로 대화</b>. 옆 창 주소는 위 <b>주소 칸</b>에서 바꿉니다. 창 나란히: Windows <b>Win+←</b> · <b>Win+→</b>, Mac 초록 단추 길게.
          </p>
        </div>,
        document.body,
      )}
    </div>
  )
}
