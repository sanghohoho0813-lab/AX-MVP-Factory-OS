/**
 * 창업감면 판정기 글자 크기 (D-167) — 판정기 안에서만.
 *
 * 원본은 글자 기준 20px 이고 넓은 화면에서 1.25배로 키워 OS 안에서 혼자 커 보였다(대표: "따로 노는 느낌").
 * 기본은 OS 글자와 어울리는 '보통', 필요하면 이 판정기 안에서만 키우거나 줄인다. 고른 값은 이 브라우저에 남긴다.
 */
import { useState } from 'react'

export type StartupZoom = 's' | 'm' | 'l' | 'xl'
const KEY = 'axmvp.ui.startup_zoom'
const LEVELS: { id: StartupZoom; label: string }[] = [
  { id: 's', label: '작게' },
  { id: 'm', label: '보통' },
  { id: 'l', label: '크게' },
  { id: 'xl', label: '아주 크게' },
]

function read(): StartupZoom {
  try {
    const v = localStorage.getItem(KEY)
    return v === 's' || v === 'l' || v === 'xl' ? v : 'm'
  } catch {
    return 'm'
  }
}

export function useStartupZoom(): [StartupZoom, (z: StartupZoom) => void] {
  const [zoom, setZoomState] = useState<StartupZoom>(read)
  const setZoom = (z: StartupZoom) => {
    setZoomState(z)
    try {
      localStorage.setItem(KEY, z)
    } catch {
      /* 저장 못 해도 이번 화면에는 적용 */
    }
  }
  return [zoom, setZoom]
}

export function StartupZoomPicker({ value, onChange }: { value: StartupZoom; onChange: (z: StartupZoom) => void }) {
  return (
    <div role="radiogroup" aria-label="판정기 글자 크기" className="flex items-center gap-1" data-testid="startup-zoom">
      <span className="t-meta mr-1 text-slate-500">글자</span>
      {LEVELS.map((l) => (
        <button
          key={l.id}
          type="button"
          role="radio"
          aria-checked={value === l.id}
          onClick={() => onChange(l.id)}
          className={`tap t-meta rounded-full border px-2.5 py-1 font-semibold ${
            value === l.id ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  )
}
