/**
 * 보기 방식 단추와 무대 (D-164, 마스터 규격 v2.9 Device View).
 *   DeviceSwitch — [PC] [Mobile] [PC+Mobile] (iframe 밖에서만 · PC 머리줄 / D-286 휴대폰 서랍 메뉴 · 무대 위쪽 줄)
 *   DeviceStage  — Mobile: 가운데 390px 휴대폰 틀 / PC+Mobile: 왼쪽 PC(약 67%) · 오른쪽 휴대폰(약 33%)
 *                  D-286 휴대폰: PC = PC 칸 하나(폭에 맞춰 줄임) / PC+Mobile = 세로면 위 PC · 아래 휴대폰, 가로면 나란히
 *   FrameBridge  — iframe 안의 앱: 주소가 바뀌면 부모에 알리고, 부모가 보낸 주소로 따라간다 · 저장하면 다른 화면도 새로 읽게
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronDown, Columns2, Monitor, Smartphone } from 'lucide-react'
import { useDismissable } from '../../lib/useDismissable'
import {
  CLOUD_WRITE_EVENT,
  FRAME_KIND,
  MSG_NAVIGATE,
  MSG_REFRESH,
  MSG_ROUTE,
  MSG_SAVED,
  framedSrc,
  inFrame,
  setDeviceMode,
  stripFrame,
  useDeviceView,
  type DeviceMode,
} from '../../lib/deviceView'
import { notifyStoreChanged, subscribeStore } from '../../storage/localStore'

const OPTIONS: { mode: DeviceMode; label: string; Icon: typeof Monitor }[] = [
  { mode: 'pc', label: 'PC', Icon: Monitor },
  { mode: 'mobile', label: 'Mobile', Icon: Smartphone },
  { mode: 'dual', label: 'PC+Mobile', Icon: Columns2 },
]

/** stacked — 휴대폰 서랍 메뉴(D-286): 폭을 꽉 채우고 글자 길이만큼 나눠 가진다(PC+Mobile 이 잘리지 않게) · 글자 늘 보임 */
export function DeviceSwitch({ wide = false, stacked = false }: { wide?: boolean; stacked?: boolean }) {
  const { mode, available } = useDeviceView()
  if (!available) return null
  return (
    <div role="radiogroup" aria-label="보기 방식" data-testid="device-switch" className={`inline-flex shrink-0 items-center rounded-(--radius-control) border border-slate-200 bg-white p-0.5 ${stacked ? 'h-11 w-full' : 'h-10'}`}>
      {OPTIONS.map(({ mode: m, label, Icon }) => {
        const on = mode === m
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={on}
            data-mode={m}
            onClick={() => setDeviceMode(m)}
            title={label}
            aria-label={label}
            className={`inline-flex h-full min-w-9 items-center justify-center gap-1 rounded-[calc(var(--radius-control)-2px)] px-2 text-[0.85rem] font-semibold whitespace-nowrap ${stacked ? 'min-w-0 flex-auto' : ''} ${on ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-300 ring-inset' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <Icon aria-hidden="true" className={`size-4 shrink-0 ${stacked ? 'dev-stacked-icon' : ''}`} />
            {/* 넓은 화면에서만 글자 — 머리줄이 옆으로 넘치지 않게(무대 위쪽 줄 · 휴대폰 서랍에서는 늘 글자) */}
            <span aria-hidden="true" className={wide || stacked ? 'min-w-0 truncate' : 'hdr-opt-label hidden min-[1900px]:inline'}>{label}</span>
          </button>
        )
      })}
    </div>
  )
}

/** 좁은 PC(1024~1439px) 머리줄 — 단추 하나 · 눌러서 고른다(머리줄이 옆으로 넘치지 않게) */
export function DeviceSwitchCompact() {
  const { mode, available } = useDeviceView()
  const { open, setOpen, containerRef } = useDismissable<HTMLDivElement>()
  if (!available) return null
  const cur = OPTIONS.find((o) => o.mode === mode) ?? OPTIONS[0]
  return (
    <div ref={containerRef} className="relative inline-flex" data-testid="device-switch-compact">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`보기 방식: ${cur.label}`}
        title={`보기 방식: ${cur.label}`}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex h-10 items-center gap-0.5 rounded-(--radius-control) border px-2 ${mode === 'pc' ? 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50' : 'border-brand-300 bg-brand-50 text-brand-700'}`}
      >
        <cur.Icon aria-hidden="true" className="size-4" />
        <ChevronDown aria-hidden="true" className="size-3.5 opacity-70" />
      </button>
      {open && (
        <div role="menu" aria-label="보기 방식" className="absolute top-full right-0 z-40 mt-1 w-44 rounded-(--radius-card) border border-slate-200 bg-white p-1.5 shadow-(--shadow-overlay)">
          {OPTIONS.map(({ mode: m, label, Icon }) => (
            <button
              key={m}
              type="button"
              role="menuitemradio"
              aria-checked={mode === m}
              data-mode={m}
              onClick={() => {
                setOpen(false)
                setDeviceMode(m)
              }}
              className={`tap flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[0.9rem] font-semibold ${mode === m ? 'bg-brand-50 text-brand-700' : 'text-slate-700 hover:bg-slate-50'}`}
            >
              <Icon aria-hidden="true" className="size-4" />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** iframe 안의 앱 — 부모(보기 무대)와 주소 · 저장을 맞춘다 */
export function FrameBridge() {
  const location = useLocation()
  const navigate = useNavigate()
  const relaying = useRef(false)
  const reloadTimer = useRef(0)
  const framed = inFrame()

  useEffect(() => {
    if (!framed) return
    const path = stripFrame(location.pathname + location.search)
    window.parent.postMessage({ type: MSG_ROUTE, path, frame: FRAME_KIND }, window.location.origin)
  }, [framed, location.pathname, location.search])

  useEffect(() => {
    if (!framed) return
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== window.parent) return
      const d = e.data as { type?: string; path?: unknown }
      if (d?.type === MSG_NAVIGATE && typeof d.path === 'string' && d.path.startsWith('/') && !d.path.startsWith('//')) {
        const cur = stripFrame(window.location.pathname + window.location.search)
        if (cur !== d.path) navigate(d.path)
      } else if (d?.type === MSG_REFRESH) {
        relaying.current = true
        notifyStoreChanged()
        relaying.current = false
        // 클라우드 자료는 화면이 저장소 신호로 다시 읽지 않는다 — 지금 손대고 있지 않은 화면만 새로 연다
        if ((d as { cloud?: unknown }).cloud === true && !document.hasFocus()) {
          if (reloadTimer.current) window.clearTimeout(reloadTimer.current)
          reloadTimer.current = window.setTimeout(() => window.location.reload(), 300)
        }
      }
    }
    window.addEventListener('message', onMessage)
    const unsub = subscribeStore(() => {
      if (!relaying.current) window.parent.postMessage({ type: MSG_SAVED, frame: FRAME_KIND }, window.location.origin)
    })
    // 클라우드에 쓴 것 — 사람이 손대고 있는 화면에서 쓴 것만 알린다(새로 열린 화면끼리 서로 새로 고치지 않게)
    let cloudTimer = 0
    const onCloudWrite = () => {
      if (!document.hasFocus()) return
      window.clearTimeout(cloudTimer)
      cloudTimer = window.setTimeout(() => window.parent.postMessage({ type: MSG_SAVED, frame: FRAME_KIND, cloud: true }, window.location.origin), 400)
    }
    window.addEventListener(CLOUD_WRITE_EVENT, onCloudWrite)
    return () => {
      window.removeEventListener('message', onMessage)
      window.removeEventListener(CLOUD_WRITE_EVENT, onCloudWrite)
      window.clearTimeout(cloudTimer)
      unsub()
    }
  }, [framed, navigate])
  return null
}

const PHONE_W = 390
const PHONE_H = 844
const BEZEL = 10
/** PC 칸 안 화면의 실제 폭 — 이보다 좁으면 그만큼 줄여 보인다(PC 배치 그대로) */
const PC_LOGICAL_W = 1200

function useBox<T extends HTMLElement>(): [React.RefObject<T | null>, { w: number; h: number }] {
  const ref = useRef<T>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    setBox({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])
  return [ref, box]
}

function PhoneFrame({ src, frameRef, availH, availW = 0 }: { src: string; frameRef: React.RefObject<HTMLIFrameElement | null>; availH: number; availW?: number }) {
  const full = PHONE_H + BEZEL * 2
  // 높이에 맞추되, 휴대폰 무대(D-286)처럼 칸이 좁으면 폭에도 맞춘다
  const scale = availH > 0 ? Math.min(1, availH / full, availW > 0 ? availW / (PHONE_W + BEZEL * 2) : 1) : 1
  return (
    <div style={{ width: (PHONE_W + BEZEL * 2) * scale, height: full * scale }} className="shrink-0">
      <div
        data-testid="device-frame"
        style={{ width: PHONE_W + BEZEL * 2, height: full, transform: `scale(${scale})`, transformOrigin: 'top left', borderWidth: BEZEL }}
        className="overflow-hidden rounded-[40px] border-slate-900 bg-slate-900 shadow-(--shadow-overlay)"
      >
        <iframe ref={frameRef} title="휴대폰 화면(390px)" src={src} width={PHONE_W} height={PHONE_H} className="block rounded-[30px] bg-white" style={{ width: PHONE_W, height: PHONE_H, border: 0 }} />
      </div>
    </div>
  )
}

/** PC 칸 — 1200px 배치 그대로, 칸이 좁으면 그만큼 줄여 보인다 */
function PcPane({ src, frameRef, className, testId }: { src: string; frameRef: React.RefObject<HTMLIFrameElement | null>; className: string; testId: string }) {
  const [box, size] = useBox<HTMLDivElement>()
  const scale = size.w > 0 ? Math.min(1, size.w / PC_LOGICAL_W) : 1
  const w = scale < 1 ? PC_LOGICAL_W : size.w
  return (
    <div ref={box} className={`relative min-h-0 min-w-0 overflow-hidden rounded-(--radius-panel) border border-slate-200 bg-white ${className}`} data-testid={testId}>
      {size.w > 0 && (
        <iframe
          ref={frameRef}
          title="PC 화면"
          src={src}
          style={{ width: w, height: size.h / scale, border: 0, transform: `scale(${scale})`, transformOrigin: 'top left' }}
          className="block"
        />
      )}
    </div>
  )
}

const STAGE_TITLE: Record<DeviceMode, string> = {
  pc: 'PC — 컴퓨터에서 보는 화면',
  mobile: 'Mobile — 실제 휴대폰 폭(390px) 화면',
  dual: 'PC + Mobile — 같은 화면 · 같은 자료, 주소가 서로 따라갑니다',
}

/** iframe 밖 · PC 에서 Mobile · PC+Mobile, 휴대폰(D-286)에서 PC · PC+Mobile 을 고르면 앱 대신 그린다 */
export function DeviceStage() {
  const { mode, narrow } = useDeviceView()
  const [startPath] = useState(() => stripFrame(window.location.pathname + window.location.search))
  const pcRef = useRef<HTMLIFrameElement>(null)
  const mobileRef = useRef<HTMLIFrameElement>(null)
  const lastPath = useRef(startPath)
  const [rootBox, rootSize] = useBox<HTMLDivElement>()
  const [phoneBox, phoneSize] = useBox<HTMLDivElement>()
  // 휴대폰을 세로로 들었으면 위 PC · 아래 휴대폰(나란히 두면 둘 다 손톱만 해진다)
  const stack = narrow && rootSize.h > rootSize.w

  useEffect(() => {
    const frames = () => [pcRef.current, mobileRef.current].filter((f): f is HTMLIFrameElement => !!f)
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return
      const from = frames().find((f) => f.contentWindow === e.source)
      if (!from) return
      const d = e.data as { type?: string; path?: unknown }
      if (d?.type === MSG_ROUTE && typeof d.path === 'string' && d.path.startsWith('/') && !d.path.startsWith('//')) {
        if (d.path === lastPath.current) return
        lastPath.current = d.path
        // 새로고침해도 같은 화면 — 무대 주소도 따라간다
        window.history.replaceState(null, '', d.path)
        for (const f of frames()) if (f !== from) f.contentWindow?.postMessage({ type: MSG_NAVIGATE, path: d.path }, window.location.origin)
      } else if (d?.type === MSG_SAVED) {
        const cloud = (d as { cloud?: unknown }).cloud === true
        for (const f of frames()) if (f !== from) f.contentWindow?.postMessage({ type: MSG_REFRESH, cloud }, window.location.origin)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  const pad = narrow ? 'gap-2 p-2' : 'gap-4 p-4'
  return (
    <div
      ref={rootBox}
      className="flex h-dvh flex-col overflow-hidden bg-slate-100"
      data-testid={mode === 'dual' ? 'dual-view' : mode === 'pc' ? 'pc-stage' : 'mobile-stage'}
      data-narrow={narrow ? 'true' : 'false'}
      data-layout={stack ? 'stack' : 'side'}
    >
      {narrow ? (
        // 휴대폰 — 단추가 먼저(한 줄), 안내는 그 아래 작게
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-200 bg-white px-3 py-2">
          <DeviceSwitch wide />
          <p className="t-meta min-w-0 text-slate-500">두 손가락으로 벌리면 크게 보여요{mode === 'dual' && stack ? ' · 가로로 들면 나란히' : ''}</p>
        </div>
      ) : (
        <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-5">
          <p className="min-w-0 truncate text-[0.95rem] font-semibold text-slate-700">{STAGE_TITLE[mode]}</p>
          <DeviceSwitch wide />
        </div>
      )}
      {mode === 'mobile' ? (
        <div ref={phoneBox} className="flex min-h-0 flex-1 justify-center overflow-hidden p-4">
          <PhoneFrame src={framedSrc(startPath, 'mobile')} frameRef={mobileRef} availH={phoneSize.h - 32} />
        </div>
      ) : mode === 'pc' ? (
        <div className={`flex min-h-0 flex-1 overflow-hidden ${pad}`}>
          <PcPane src={framedSrc(startPath, 'pc')} frameRef={pcRef} className="flex-1" testId="pc-frame" />
        </div>
      ) : (
        <div className={`flex min-h-0 flex-1 overflow-hidden ${pad} ${stack ? 'flex-col' : ''}`}>
          {/* PC(가로 약 67% · 휴대폰 세로면 위 약 60%) — 좁으면 PC 배치 그대로 줄여 보인다 */}
          <PcPane src={framedSrc(startPath, 'pc')} frameRef={pcRef} className={stack ? 'flex-[3_1_0%]' : 'flex-[2_1_0%]'} testId="dual-pc" />
          {/* 휴대폰(가로 약 33% · 세로면 아래) */}
          <div ref={phoneBox} className={`flex min-h-0 min-w-0 justify-center overflow-hidden ${stack ? 'flex-[2_1_0%]' : 'flex-[1_1_0%]'}`}>
            <PhoneFrame src={framedSrc(startPath, 'mobile')} frameRef={mobileRef} availH={phoneSize.h} availW={narrow ? phoneSize.w : 0} />
          </div>
        </div>
      )}
    </div>
  )
}
