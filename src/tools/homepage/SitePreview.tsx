/**
 * 홈페이지 미리보기 (D-202) — 내려받을 HTML 과 같은 글을 iframe 에 그린다.
 *
 * iframe 은 sandbox="allow-same-origin" — 안에서 스크립트가 돌지 않는다(만든 HTML 에도 스크립트는 없다).
 * 같은 출처라 바깥(이 화면)에서 블록 누르기만 듣는다 → 누른 블록이 왼쪽에서 열린다.
 * PC 는 1280 폭, 휴대폰은 390 폭으로 그리고 칸에 맞게 줄인다. 고칠 때마다 다시 그려도 보던 자리를 지킨다.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { renderSiteHtml, type SiteDoc } from '../../services/siteBuilder'

export type Device = 'pc' | 'mobile'
const WIDTH: Record<Device, number> = { pc: 1280, mobile: 390 }

export function SitePreview({ doc, device, selectedId, onSelect, height }: { doc: SiteDoc; device: Device; selectedId: string | null; onSelect: (id: string) => void; height: number }) {
  const box = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const [boxWidth, setBoxWidth] = useState(0)
  const scrollY = useRef(0)
  const lastSelected = useRef<string | null>(selectedId)
  // 타자 중에는 0.25초 모아서 한 번 그린다
  const [html, setHtml] = useState(() => renderSiteHtml(doc, { preview: true, selectedId }))
  useEffect(() => {
    const t = window.setTimeout(() => setHtml(renderSiteHtml(doc, { preview: true, selectedId })), 250)
    return () => window.clearTimeout(t)
  }, [doc, selectedId])

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setBoxWidth(el.clientWidth))
    ro.observe(el)
    setBoxWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  const w = WIDTH[device]
  const scale = boxWidth > 0 ? Math.min(1, boxWidth / w) : 1
  const innerHeight = Math.round(height / scale)

  const onLoad = useMemo(
    () => () => {
      const d = frame.current?.contentDocument
      const win = frame.current?.contentWindow
      if (!d || !win) return
      // 고른 블록이 바뀌었으면 그 블록으로, 아니면 보던 자리로
      const target = selectedId && selectedId !== lastSelected.current ? d.querySelector(`[data-block="${CSS.escape(selectedId)}"]`) : null
      if (target) (target as HTMLElement).scrollIntoView({ block: 'start' })
      else win.scrollTo(0, scrollY.current)
      lastSelected.current = selectedId
      win.addEventListener('scroll', () => (scrollY.current = win.scrollY), { passive: true })
      d.addEventListener('click', (e) => {
        const el = (e.target as Element | null)?.closest?.('[data-block]')
        const a = (e.target as Element | null)?.closest?.('a')
        // 앵커(#) 는 미리보기 안에서 그대로 움직이게, 나머지 링크는 막는다
        if (a && !(a.getAttribute('href') ?? '').startsWith('#')) e.preventDefault()
        if (el) onSelect(el.getAttribute('data-block') ?? '')
      })
    },
    [selectedId, onSelect],
  )

  return (
    <div ref={box} className="w-full overflow-hidden rounded-(--radius-panel) border border-slate-200 bg-slate-100" style={{ height }} data-testid="site-preview" data-device={device}>
      <div style={{ width: w, height: innerHeight, transform: `scale(${scale})`, transformOrigin: 'top left', marginLeft: device === 'mobile' && boxWidth > w ? (boxWidth - w) / 2 : 0 }}>
        <iframe
          ref={frame}
          title="홈페이지 미리보기"
          sandbox="allow-same-origin"
          srcDoc={html}
          onLoad={onLoad}
          style={{ width: w, height: innerHeight, border: 0, background: '#fff', display: 'block' }}
          data-testid="site-frame"
        />
      </div>
    </div>
  )
}
