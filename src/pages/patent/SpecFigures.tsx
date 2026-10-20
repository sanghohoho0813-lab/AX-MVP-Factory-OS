/**
 * D-248 명세서 쓰기 — 도면 초안 그림(흑백 SVG). 도 1 블록도(시스템 100 안 구성요소) · 도 2 순서도(단계 S110 …).
 * 특허로 제출용 그림의 출발점일 뿐 — 선 굵기 · 글자 크기는 사람이 다듬는다. PNG 로 내려받을 수 있다.
 */
import { useRef, type ReactNode } from 'react'
import { Download } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import type { SpecDraft } from '../../services/patent/specDraft'

const W = 640
const FONT = "'Noto Sans KR', 'Malgun Gothic', sans-serif"

/** 한 줄에 n자 — 넘치면 줄을 나눈다(글자 폭을 재지 않고 글자 수로) */
function wrap(text: string, n: number, maxLines = 2): string[] {
  const t = text.trim()
  if (!t) return ['']
  const lines: string[] = []
  let rest = t
  while (rest && lines.length < maxLines) {
    if (rest.length <= n) {
      lines.push(rest)
      rest = ''
      break
    }
    let cut = rest.lastIndexOf(' ', n)
    if (cut < n * 0.5) cut = n
    lines.push(rest.slice(0, cut).trim())
    rest = rest.slice(cut).trim()
  }
  if (rest) lines[lines.length - 1] = `${lines[lines.length - 1].slice(0, Math.max(0, n - 1))}…`
  return lines
}

function Arrow({ x, y1, y2 }: { x: number; y1: number; y2: number }) {
  return (
    <g>
      <line x1={x} y1={y1} x2={x} y2={y2 - 7} stroke="#000" strokeWidth={1.6} />
      <path d={`M ${x - 5} ${y2 - 9} L ${x} ${y2} L ${x + 5} ${y2 - 9} Z`} fill="#000" />
    </g>
  )
}

/** 도 1 — 시스템(100) 상자 안에 구성요소를 위에서 아래로 */
function BlockSvg({ d, sys }: { d: SpecDraft; sys: string }) {
  const comps = d.components.filter((c) => c.name.trim())
  const boxH = 46
  const gap = 26
  const top = 64
  const h = top + Math.max(1, comps.length) * (boxH + gap) + 12
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${W} ${h}`} width="100%" role="img" aria-label="도 1 블록도 초안" fontFamily={FONT}>
      <rect x={0} y={0} width={W} height={h} fill="#fff" />
      <rect x={60} y={20} width={W - 120} height={h - 30} fill="none" stroke="#000" strokeWidth={1.6} />
      <text x={W / 2} y={46} textAnchor="middle" fontSize={17} fill="#000">
        {sys || '시스템'}(100)
      </text>
      {comps.map((c, i) => {
        const y = top + i * (boxH + gap)
        return (
          <g key={`${c.no}-${i}`}>
            <rect x={140} y={y} width={W - 280} height={boxH} fill="#fff" stroke="#000" strokeWidth={1.4} />
            <text x={W / 2} y={y + boxH / 2 + 6} textAnchor="middle" fontSize={16} fill="#000">
              {wrap(`${c.name.trim()}(${c.no.trim()})`, 22, 1)[0]}
            </text>
            {i < comps.length - 1 && <Arrow x={W / 2} y1={y + boxH} y2={y + boxH + gap} />}
          </g>
        )
      })}
    </svg>
  )
}

/** 도 2 — 시작 → 단계 → 끝 */
function FlowSvg({ d }: { d: SpecDraft }) {
  const steps = d.steps.filter((s) => s.text.trim())
  const boxH = 58
  const gap = 24
  const capH = 34
  const top = 20
  const h = top + capH + gap + steps.length * (boxH + gap) + capH + 20
  const cx = W / 2
  let y = top
  const nodes: ReactNode[] = []
  nodes.push(
    <g key="start">
      <rect x={cx - 60} y={y} width={120} height={capH} rx={17} fill="#fff" stroke="#000" strokeWidth={1.4} />
      <text x={cx} y={y + capH / 2 + 5} textAnchor="middle" fontSize={15} fill="#000">
        시작
      </text>
      <Arrow x={cx} y1={y + capH} y2={y + capH + gap} />
    </g>,
  )
  y += capH + gap
  steps.forEach((s, i) => {
    const lines = wrap(s.text, 24, 2)
    nodes.push(
      <g key={`${s.no}-${i}`}>
        <rect x={110} y={y} width={W - 220} height={boxH} fill="#fff" stroke="#000" strokeWidth={1.4} />
        {lines.map((l, j) => (
          <text key={j} x={cx} y={y + (lines.length === 1 ? boxH / 2 + 6 : 24 + j * 20)} textAnchor="middle" fontSize={14} fill="#000">
            {l}
          </text>
        ))}
        <text x={W - 104} y={y + boxH / 2 + 5} fontSize={14} fill="#000">
          {s.no.trim()}
        </text>
        <Arrow x={cx} y1={y + boxH} y2={y + boxH + gap} />
      </g>,
    )
    y += boxH + gap
  })
  nodes.push(
    <g key="end">
      <rect x={cx - 60} y={y} width={120} height={capH} rx={17} fill="#fff" stroke="#000" strokeWidth={1.4} />
      <text x={cx} y={y + capH / 2 + 5} textAnchor="middle" fontSize={15} fill="#000">
        끝
      </text>
    </g>,
  )
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${W} ${h}`} width="100%" role="img" aria-label="도 2 순서도 초안" fontFamily={FONT}>
      <rect x={0} y={0} width={W} height={h} fill="#fff" />
      {nodes}
    </svg>
  )
}

/** SVG → PNG(3배 · 흰 바탕) 내려받기 */
async function svgToPng(svg: SVGSVGElement, fileName: string) {
  const box = svg.viewBox.baseVal
  const scale = 3
  const xml = new XMLSerializer().serializeToString(svg)
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }))
  try {
    const img = new Image()
    await new Promise<void>((ok, bad) => {
      img.onload = () => ok()
      img.onerror = () => bad(new Error('그림을 만들지 못했습니다'))
      img.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(box.width * scale)
    canvas.height = Math.round(box.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('그림을 만들지 못했습니다')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, 'image/png'))
    if (!blob) throw new Error('그림을 만들지 못했습니다')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = fileName
    a.click()
    window.setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function FigurePreview({ d, sys, which, onError }: { d: SpecDraft; sys: string; which: 1 | 2; onError: (msg: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const empty = which === 1 ? d.components.filter((c) => c.name.trim()).length === 0 : d.steps.filter((s) => s.text.trim()).length === 0
  const download = () => {
    const svg = ref.current?.querySelector('svg')
    if (!svg) return
    void svgToPng(svg, `fig${which}-draft.png`).catch((e: unknown) => onError(e instanceof Error ? e.message : '그림을 만들지 못했습니다'))
  }
  return (
    <figure className="flex min-w-0 flex-col gap-2" data-testid={`spec-fig-${which}`}>
      <figcaption className="t-sub flex flex-wrap items-center justify-between gap-2 font-semibold text-slate-800">
        <span>도 {which} {which === 1 ? '블록도' : '순서도'} 초안</span>
        {!empty && (
          <Button variant="ghost" size="sm" onClick={download} data-testid={`spec-fig-${which}-png`}>
            <Download aria-hidden="true" className="size-4 shrink-0" /> PNG
          </Button>
        )}
      </figcaption>
      {empty ? (
        <p className="t-sub break-keep rounded-(--radius-control) border border-dashed border-slate-300 px-3 py-6 text-center text-slate-500">{which === 1 ? '구성요소를 넣으면 그림이 나옵니다' : '단계를 넣으면 그림이 나옵니다'}</p>
      ) : (
        <div ref={ref} className="overflow-hidden rounded-(--radius-control) border border-slate-200 bg-white">
          {which === 1 ? <BlockSvg d={d} sys={sys} /> : <FlowSvg d={d} />}
        </div>
      )}
    </figure>
  )
}
