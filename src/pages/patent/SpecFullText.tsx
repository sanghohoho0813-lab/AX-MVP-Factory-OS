/**
 * D-269 명세서 전문 · 나눠서 보기 — 대표: "최종적으로 작성을 하면 전문으로 쭉 먼저 나와 주면서 전문으로 보기가 기본 ·
 *   나눠서 보기를 누르면 청구항 · 발명의 효과 … 목차마다 칸으로 나눠 각각 복사 붙여 넣기".
 * 모양은 대표가 보여 준 출원 명세서(HWPX) 그대로 — 【식별항목】 줄 · 명칭 한글{영문} 한 줄 · 굵게 · 가로선 없음(특허로에 붙이면 걸린다).
 */
import { useMemo, useState } from 'react'
import { Check, Copy, Download } from 'lucide-react'
import { Surface } from '../../components/ui/primitives'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/toastContext'
import { specPlainSections, specPlainText, type SpecDraft } from '../../services/patent/specDraft'

/** MD 내려받기와 같은 이름 꼴(patent-spec-날짜) — 한글 파일 이름은 일부 브라우저 · 기기에서 'download' 로 깨진다 */
const fileName = () => {
  const t = new Date()
  const ymd = `${t.getFullYear()}${String(t.getMonth() + 1).padStart(2, '0')}${String(t.getDate()).padStart(2, '0')}`
  return `patent-spec-${ymd}-full.txt`
}

/** 전문을 .txt 로 — 특허로 · 한글에 그대로 붙일 글 */
export function downloadPlain(d: SpecDraft): void {
  const url = URL.createObjectURL(new Blob([specPlainText(d)], { type: 'text/plain;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = fileName()
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/** 클립보드 — 막히면(권한 · 오래된 브라우저) 숨은 글상자로 */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // 아래로
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  } catch {
    return false
  }
}

export function SpecFullText({ d }: { d: SpecDraft }) {
  const { showToast } = useToast()
  const [view, setView] = useState<'full' | 'split'>('full')
  const [copied, setCopied] = useState('')
  const full = useMemo(() => specPlainText(d), [d])
  const sections = useMemo(() => specPlainSections(d), [d])
  const claims = sections.filter((s) => /^claim\d+$/.test(s.key))
  const copy = async (key: string, text: string, label: string) => {
    if (await copyText(text)) {
      setCopied(key)
      showToast(`${label} 복사했어요 — 특허로 명세서 작성기의 그 칸에 붙여 넣으세요`)
    } else showToast('복사하지 못했어요 — 글을 직접 골라 복사해 주세요')
  }
  const tab = (v: 'full' | 'split', label: string) => (
    <button
      type="button"
      onClick={() => setView(v)}
      aria-pressed={view === v}
      className={`tap t-sub min-h-11 rounded-(--radius-control) px-3 font-semibold ${view === v ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50'}`}
      data-testid={`spec-full-view-${v}`}
    >
      {label}
    </button>
  )
  return (
    <Surface>
      <section className="flex flex-col gap-3" data-testid="spec-full" data-view={view} aria-labelledby="spec-full-title">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <h3 id="spec-full-title" className="t-section min-w-0 flex-1 font-bold break-keep text-slate-900">
            명세서 전문
          </h3>
          <div className="flex gap-1.5" role="group" aria-label="보기">
            {tab('full', '전문으로 보기')}
            {tab('split', '나눠서 보기')}
          </div>
        </div>
        <p className="t-meta break-keep text-slate-600">
          특허로 명세서 작성기에 붙일 모양 — 【식별항목】 · 명칭은 한글{'{'}영문{'}'} 한 줄 · 굵게 · 가로선 없음. 작성기에서는 식별항목을 만든 뒤 그 아래 글만 붙여 넣으세요([나눠서 보기] 에서 칸마다 복사).
        </p>

        {view === 'full' ? (
          <>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button variant="primary" onClick={() => void copy('full', full, '전문을')} data-testid="spec-full-copy">
                {copied === 'full' ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />} 전문 복사
              </Button>
              <Button variant="secondary" onClick={() => downloadPlain(d)} data-testid="spec-full-download">
                <Download aria-hidden="true" className="size-4" /> 전문 내려받기(.txt)
              </Button>
            </div>
            <pre className="t-sub max-h-[70vh] overflow-auto rounded-(--radius-control) border border-slate-200 bg-slate-50 p-3 font-sans break-words whitespace-pre-wrap text-slate-900" data-testid="spec-full-text" tabIndex={0}>
              {full}
            </pre>
          </>
        ) : (
          <>
            {claims.length > 1 && (
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => void copy('claims', claims.map((c) => `【${c.label}】\n${c.text}`).join('\n\n'), '청구항 전체를')} data-testid="spec-split-claims">
                  <Copy aria-hidden="true" className="size-4" /> 청구항 {claims.length}개 한꺼번에 복사
                </Button>
              </div>
            )}
            <ol className="flex flex-col gap-2" data-testid="spec-split">
              {sections.map((s) => (
                <li key={s.key} className="flex flex-col gap-1.5 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2.5" data-testid="spec-split-item" data-key={s.key}>
                  <div className="flex items-center gap-2">
                    <p className="t-sub min-w-0 flex-1 font-bold break-keep text-slate-900">【{s.label}】</p>
                    <Button variant={copied === s.key ? 'primary' : 'secondary'} size="sm" className="shrink-0" onClick={() => void copy(s.key, s.text, s.label === '발명의 명칭' ? '발명의 명칭을' : `${s.label} 글을`)} data-testid="spec-split-copy" data-key={s.key}>
                      {copied === s.key ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />} 복사
                    </Button>
                  </div>
                  <pre className="t-sub max-h-80 overflow-auto rounded-(--radius-control) bg-slate-50 p-2.5 font-sans break-words whitespace-pre-wrap text-slate-800">{s.text}</pre>
                </li>
              ))}
            </ol>
          </>
        )}
      </section>
    </Surface>
  )
}
