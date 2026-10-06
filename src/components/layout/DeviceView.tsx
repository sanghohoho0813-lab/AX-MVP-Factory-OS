/**
 * 보기 방식 단추와 무대 (D-164, 마스터 규격 v2.9 Device View).
 *   DeviceSwitch — [PC] [Mobile] [PC+Mobile] (PC 1024px 이상 · iframe 밖에서만)
 *   DeviceStage  — Mobile: 가운데 390px 휴대폰 틀 / PC+Mobile: 왼쪽 PC(약 67%) · 오른쪽 휴대폰(약 33%)
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

export function DeviceSwitch({ wide = false }: { wide?: boolean }) {
  const { mode, available } = useDeviceView()
  if (!available) return null
  return (
    <div role="radiogroup" aria-label="보기 방식" data-testid="device-switch" className="inline-flex h-10 shrink-0 items-center rounded-(--radius-control) border border-slate-200 bg-white p-0.5">
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
            className={`inline-flex h-full min-w-9 items-center justify-center gap-1 rounded-[calc(var(--radius-control)-2px)] px-2 text-[0.85rem] font-semibold whitespace-nowrap ${on ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-300 ring-inset' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <Icon aria-hidden="true" className="size-4" />
            {/* 넓은 화면에서만 글자 — 머리줄이 옆으로 넘치지 않게(무대 위쪽 줄에서는 늘 글자) */}
            <span aria-hidden="true" className={wide ? '' : 'hdr-opt-label hidden min-[1700px]:inline'}>{label}</span>
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

function PhoneFrame({ src, frameRef, availH }: { src: string; frameRef: React.RefObject<HTMLIFrameElement | null>; availH: number }) {
  const full = PHONE_H + BEZEL * 2
  const scale = availH > 0 ? Math.min(1, availH / full) : 1
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

/** PC 1024px 이상 · iframe 밖 · Mobile 또는 PC+Mobile 일 때 앱 대신 그린다 */
export function DeviceStage() {
  const { mode } = useDeviceView()
  const [startPath] = useState(() => stripFrame(window.location.pathname + window.location.search))
  const pcRef = useRef<HTMLIFrameElement>(null)
  const mobileRef = useRef<HTMLIFrameElement>(null)
  const lastPath = useRef(startPath)
  const [pcBox, pcSize] = useBox<HTMLDivElement>()
  const [phoneBox, phoneSize] = useBox<HTMLDivElement>()

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

  const scale = pcSize.w > 0 ? Math.min(1, pcSize.w / PC_LOGICAL_W) : 1
  const pcW = scale < 1 ? PC_LOGICAL_W : pcSize.w
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-slate-100" data-testid={mode === 'dual' ? 'dual-view' : 'mobile-stage'}>
      <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-5">
        <p className="min-w-0 truncate text-[0.95rem] font-semibold text-slate-700">
          {mode === 'dual' ? 'PC + Mobile — 같은 화면 · 같은 자료, 주소가 서로 따라갑니다' : 'Mobile — 실제 휴대폰 폭(390px) 화면'}
        </p>
        <DeviceSwitch wide />
      </div>
      {mode === 'mobile' ? (
        <div ref={phoneBox} className="flex min-h-0 flex-1 justify-center overflow-hidden p-4">
          <PhoneFrame src={framedSrc(startPath, 'mobile')} frameRef={mobileRef} availH={phoneSize.h - 32} />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 gap-4 overflow-hidden p-4">
          {/* 왼쪽 PC(약 67%) — 좁으면 PC 배치 그대로 줄여 보인다 */}
          <div ref={pcBox} className="relative min-w-0 flex-[2_1_0%] overflow-hidden rounded-(--radius-panel) border border-slate-200 bg-white" data-testid="dual-pc">
            {pcSize.w > 0 && (
              <iframe
                ref={pcRef}
                title="PC 화면"
                src={framedSrc(startPath, 'pc')}
                style={{ width: pcW, height: pcSize.h / scale, border: 0, transform: `scale(${scale})`, transformOrigin: 'top left' }}
                className="block"
              />
            )}
          </div>
          {/* 오른쪽 휴대폰(약 33%) */}
          <div ref={phoneBox} className="flex min-w-0 flex-[1_1_0%] justify-center overflow-hidden">
            <PhoneFrame src={framedSrc(startPath, 'mobile')} frameRef={mobileRef} availH={phoneSize.h} />
          </div>
        </div>
      )}
    </div>
  )
}
