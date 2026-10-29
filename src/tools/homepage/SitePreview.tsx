/**
 * 홈페이지 미리보기 (D-202) — 내려받을 HTML 과 같은 글을 iframe 에 그린다.
 *
 * iframe 은 sandbox="allow-same-origin" — 안에서 스크립트가 돌지 않는다(만든 HTML 에도 스크립트는 없다).
 * 같은 출처라 바깥(이 화면)에서 블록 누르기만 듣는다 → 누른 블록이 왼쪽에서 열린다.
 * PC 는 1280 폭, 휴대폰은 390 폭으로 그리고 칸에 맞게 줄인다. 고칠 때마다 다시 그려도 보던 자리를 지킨다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

  // 누르기는 늘 지금의 onSelect 로(처음 그릴 때 받은 옛 함수가 남지 않게)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  const wired = useRef(new WeakSet<Document>())
  // 블록 누르기 듣기 — 글이 다 그려지면(interactive) 바로. 예전에는 사진 · 글꼴까지 다 받은 뒤(load)에야 들어서,
  // 사진이 늦게 오는 동안 블록을 눌러도 아무 일이 없었다(D-316)
  const wire = useCallback(() => {
    const d = frame.current?.contentDocument
    if (!d || d.URL !== 'about:srcdoc' || d.readyState === 'loading') return false
    if (wired.current.has(d)) return true
    wired.current.add(d)
    d.addEventListener('click', (e) => {
      const el = (e.target as Element | null)?.closest?.('[data-block]')
      const a = (e.target as Element | null)?.closest?.('a')
      // 앵커(#) 는 미리보기 안에서 그대로 움직이게, 나머지 링크는 막는다
      if (a && !(a.getAttribute('href') ?? '').startsWith('#')) e.preventDefault()
      if (el) onSelectRef.current(el.getAttribute('data-block') ?? '')
    })
    return true
  }, [])
  useEffect(() => {
    // 새 글로 다시 그리면 새 문서가 생긴다 — 그 문서가 그려질 때까지 잠깐씩 본다(최대 10초)
    const before = frame.current?.contentDocument
    let n = 0
    const t = window.setInterval(() => {
      if (++n > 200 || (frame.current?.contentDocument !== before && wire())) window.clearInterval(t)
    }, 50)
    return () => window.clearInterval(t)
  }, [html, wire])

  const onLoad = useMemo(
    () => () => {
      const d = frame.current?.contentDocument
      const win = frame.current?.contentWindow
      if (!d || !win) return
      wire()
      // 고른 블록이 바뀌었으면 그 블록으로, 아니면 보던 자리로
      const target = selectedId && selectedId !== lastSelected.current ? d.querySelector(`[data-block="${CSS.escape(selectedId)}"]`) : null
      if (target) (target as HTMLElement).scrollIntoView({ block: 'start' })
      else win.scrollTo(0, scrollY.current)
      lastSelected.current = selectedId
      win.addEventListener('scroll', () => (scrollY.current = win.scrollY), { passive: true })
    },
    [selectedId, wire],
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
