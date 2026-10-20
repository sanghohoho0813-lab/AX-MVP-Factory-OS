/**
 * D-249 도면 초안 그림(흑백 SVG 글) — 도 1 블록도(시스템 100 안 구성요소) · 도 2 순서도(시작 → 단계 → 끝).
 * 화면(이미지로 보여 줌) · 제출 준비 묶음(PNG 로 바꿈)이 같은 글을 쓴다. 사람이 적은 글은 모두 XML 이스케이프.
 */
import { titleParts, type SpecDraft } from './specDraft'

export const FIG_W = 640
const FONT = "'Noto Sans KR', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif"

export function xmlEsc(s: string): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c] as string)
}

/** 한 줄에 n자 — 넘치면 줄을 나눈다(글자 폭은 재지 않는다) */
export function wrapText(text: string, n: number, maxLines = 2): string[] {
  const t = String(text ?? '').trim()
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

const arrow = (x: number, y1: number, y2: number) =>
  `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2 - 7}" stroke="#000" stroke-width="1.6"/><path d="M ${x - 5} ${y2 - 9} L ${x} ${y2} L ${x + 5} ${y2 - 9} Z" fill="#000"/>`
const text = (x: number, y: number, size: number, s: string, anchor = 'middle') => `<text x="${x}" y="${y}" font-size="${size}" text-anchor="${anchor}" fill="#000">${xmlEsc(s)}</text>`
const wrapSvg = (h: number, body: string, label: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${FIG_W} ${h}" width="${FIG_W}" height="${h}" font-family="${xmlEsc(FONT)}" role="img" aria-label="${xmlEsc(label)}"><rect x="0" y="0" width="${FIG_W}" height="${h}" fill="#fff"/>${body}</svg>`

export const sysNameOf = (d: SpecDraft) => (d.systemName || '').trim() || titleParts(d.title).system || '시스템'

/** 도 1 블록도 — 상자 수 = 구성요소 수 */
export function blockSvg(d: SpecDraft): { svg: string; boxes: number; height: number } {
  const comps = d.components.filter((c) => c.name.trim())
  const boxH = 46
  const gap = 26
  const top = 64
  const h = top + Math.max(1, comps.length) * (boxH + gap) + 12
  let body = `<rect x="60" y="20" width="${FIG_W - 120}" height="${h - 30}" fill="none" stroke="#000" stroke-width="1.6"/>${text(FIG_W / 2, 46, 17, `${sysNameOf(d)}(100)`)}`
  comps.forEach((c, i) => {
    const y = top + i * (boxH + gap)
    body += `<rect x="140" y="${y}" width="${FIG_W - 280}" height="${boxH}" fill="#fff" stroke="#000" stroke-width="1.4"/>${text(FIG_W / 2, y + boxH / 2 + 6, 16, wrapText(`${c.name.trim()}(${c.no.trim()})`, 22, 1)[0])}`
    if (i < comps.length - 1) body += arrow(FIG_W / 2, y + boxH, y + boxH + gap)
  })
  return { svg: wrapSvg(h, body, '도 1 블록도 초안'), boxes: comps.length, height: h }
}

/** 도 2 순서도 — 시작 · 단계마다 상자(오른쪽에 S번호) · 끝 */
export function flowSvg(d: SpecDraft): { svg: string; boxes: number; height: number } {
  const steps = d.steps.filter((s) => s.text.trim())
  const boxH = 58
  const gap = 24
  const capH = 34
  const cx = FIG_W / 2
  const h = 20 + capH + gap + steps.length * (boxH + gap) + capH + 20
  let y = 20
  const cap = (label: string) => `<rect x="${cx - 60}" y="${y}" width="120" height="${capH}" rx="17" fill="#fff" stroke="#000" stroke-width="1.4"/>${text(cx, y + capH / 2 + 5, 15, label)}`
  let body = cap('시작') + arrow(cx, y + capH, y + capH + gap)
  y += capH + gap
  for (const s of steps) {
    const lines = wrapText(s.text, 24, 2)
    body += `<rect x="110" y="${y}" width="${FIG_W - 220}" height="${boxH}" fill="#fff" stroke="#000" stroke-width="1.4"/>`
    lines.forEach((l, j) => (body += text(cx, y + (lines.length === 1 ? boxH / 2 + 6 : 24 + j * 20), 14, l)))
    body += text(FIG_W - 104, y + boxH / 2 + 5, 14, s.no.trim(), 'start') + arrow(cx, y + boxH, y + boxH + gap)
    y += boxH + gap
  }
  body += cap('끝')
  return { svg: wrapSvg(h, body, '도 2 순서도 초안'), boxes: steps.length, height: h }
}

export const svgDataUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
