/**
 * D-558 '이렇게 찍으세요' AI 추천 — 제목 하나를 누르면 아래에: 길이(분) 고르기 → [AI로 대본 만들기] → 대본 → [내 보관함으로].
 * 화면 원칙: 흰 바탕 · 얇은 회색 테두리 · 보라는 AI 단추만 · 강조는 글자색(파랑 = 고른 것).
 */
import { useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { ArchiveRestore, ClipboardCopy, Clock, FileText, RotateCcw, Sparkles } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { AiConfirm } from '../../../components/ai/AiConfirm'
import { ModelPicker } from '../../../components/ai/ModelPicker'
import { charsFor, clampMinutes, localStamp, MINUTES_MAX, SCRIPT_MINUTES, scriptError, scriptRunning, scriptSaved, scriptVersion, subscribeScript, startKitScript, type KitScript } from '../../../services/marketing/kitScript'
import type { AssistContext } from '../../../services/aiAssist/context'
import { scoreScript } from '../../../services/marketing/postScore'

export interface KitScriptPanelProps {
  sKey: string
  title: string
  titleType: string
  titleIndex: number
  /** 길이 · 요청을 받아 보낼 자료 */
  context: (minutes: number, request: string) => AssistContext
  onCopy: (text: string, what?: string) => void
  /** 내 보관함(내 콘텐츠)에 담기 → 그 줄 주소(실패 · 취소면 null) */
  onKeep?: (s: KitScript) => Promise<string | null>
  readOnly: boolean
}

export function KitScriptPanel({ sKey, title, titleType, titleIndex, context, onCopy, onKeep, readOnly }: KitScriptPanelProps) {
  useSyncExternalStore(subscribeScript, scriptVersion, scriptVersion)
  const saved = scriptSaved(sKey)
  const busy = scriptRunning(sKey)
  const err = scriptError(sKey)
  const [minutes, setMinutes] = useState<number>(saved?.minutes ?? 5)
  const [custom, setCustom] = useState('')
  const [request, setRequest] = useState('')
  const [keptHref, setKeptHref] = useState<string | null>(null)
  const [keeping, setKeeping] = useState(false)
  const run = () => startKitScript(sKey, context(minutes, request), { minutes, titleIndex, title, titleType })
  const keep = async () => {
    if (!saved || !onKeep || keeping) return
    setKeeping(true)
    try {
      setKeptHref(await onKeep(saved))
    } finally {
      setKeeping(false)
    }
  }
  return (
    <div className="flex min-w-0 flex-col gap-2.5 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2.5" data-testid="kit-script" data-key={sKey}>
      <p className="t-sub font-bold break-keep text-slate-900">
        <FileText aria-hidden="true" className="mr-1 inline size-4 align-[-3px] text-slate-500" />이 제목으로 대본 만들기
      </p>
      <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="대본 길이">
        {SCRIPT_MINUTES.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={minutes === m && !custom}
            onClick={() => {
              setMinutes(m)
              setCustom('')
            }}
            className={`tap t-sub min-h-10 rounded-full px-3.5 font-bold ${minutes === m && !custom ? 'bg-slate-900 text-white' : 'bg-white text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50'}`}
            data-testid="kit-script-min"
            data-min={m}
          >
            {m}분
          </button>
        ))}
        <label className="t-sub inline-flex items-center gap-1 text-slate-700">
          직접
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={MINUTES_MAX}
            value={custom}
            onChange={(e) => {
              setCustom(e.target.value)
              if (e.target.value) setMinutes(clampMinutes(Number(e.target.value)))
            }}
            className="h-10 w-16 rounded-(--radius-control) border border-slate-300 px-2 text-center"
            aria-label="대본 길이(분) 직접 넣기"
            data-testid="kit-script-custom"
          />
          분
        </label>
        <span className="t-meta text-slate-500">대사 약 {charsFor(minutes).toLocaleString('ko-KR')}자</span>
      </div>
      <input
        type="text"
        value={request}
        onChange={(e) => setRequest(e.target.value)}
        maxLength={200}
        placeholder="더 바라는 점(선택) — 예: 50대 사장님께 말하듯 · 사례 하나 넣어서"
        className="t-sub h-11 w-full min-w-0 rounded-(--radius-control) border border-slate-300 px-3"
        aria-label="대본에 더 바라는 점"
        data-testid="kit-script-request"
      />
      <div className="flex flex-wrap items-center gap-2">
        {!busy && <ModelPicker />}
        <AiConfirm>
          <Button size="sm" variant="primary" className="bg-violet-600 hover:bg-violet-700" onClick={run} disabled={busy || readOnly} data-testid="kit-script-run">
            {busy ? <Clock aria-hidden="true" className="size-4" /> : <Sparkles aria-hidden="true" className="size-4" />}
            {busy ? '대본 쓰는 중…' : saved ? `${minutes}분 대본 다시 만들기` : `AI로 ${minutes}분 대본 만들기`}
          </Button>
        </AiConfirm>
        {busy && <span className="t-meta text-slate-600">20~60초 — 다른 화면으로 가도 대본은 남아요.</span>}
      </div>
      {err && (
        <p role="alert" className="t-meta break-keep text-danger-700" data-testid="kit-script-error">
          대본을 받지 못했어요 — {err}
        </p>
      )}
      {saved && (
        <div className="flex min-w-0 flex-col gap-2" data-testid="kit-script-result">
          <p className="t-meta text-slate-500">
            {saved.minutes}분 · {localStamp(saved.at)}
            {saved.model ? ` · ${saved.model}` : ''}
          </p>
          <ScriptScore title={saved.title} text={saved.parts.map((p) => p.body).join('\n')} minutes={saved.minutes} />
          <div className="max-h-[28rem] overflow-y-auto rounded-(--radius-control) border border-slate-200 px-3 py-2">
            {saved.parts.map((p, i) => (
              <div key={i} className="mb-3 last:mb-0">
                <p className="t-sub font-bold text-slate-900">{p.title}</p>
                <p className="t-sub break-keep whitespace-pre-wrap text-slate-800 [overflow-wrap:anywhere]">{p.body}</p>
                {p.screen.length > 0 && <p className="t-meta mt-0.5 break-keep text-slate-500">화면: {p.screen.join(' / ')}</p>}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => onCopy(saved.text, '대본')} data-testid="kit-script-copy">
              <ClipboardCopy aria-hidden="true" className="size-4" /> 대본 복사
            </Button>
            {onKeep && (
              <Button size="sm" variant="primary" onClick={() => void keep()} disabled={keeping || readOnly} data-testid="kit-script-keep">
                <ArchiveRestore aria-hidden="true" className="size-4" /> {keptHref ? '보관함에 다시 담기' : '내 보관함으로 옮기기'}
              </Button>
            )}
            {keptHref && (
              <Link to={keptHref} className="tap t-sub inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline" data-testid="kit-script-kept">
                <RotateCcw aria-hidden="true" className="size-4 rotate-180" /> 보관함에서 보기
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/** D-559 올리기 전 점수(규칙 — AI 아님) — 고른 길이에 맞는 분량 · 제목 숫자 · 컨설팅 글 점검 · 기계 같은 말 · 긴 문장 · 빈칸 */
function ScriptScore({ title, text, minutes }: { title: string; text: string; minutes: number }) {
  const sc = scoreScript({ title, text, target: charsFor(minutes) })
  if (!sc) return null
  const tone = sc.pass ? 'text-success-700' : sc.bad ? 'text-danger-700' : 'text-warning-800'
  if (!sc.items.length)
    return (
      <p className={`t-sub font-semibold ${tone}`} data-testid="kit-script-score" data-score={sc.score} data-pass="1">
        올리기 전 점수 {sc.score}점 · 바로 찍어도 돼요
      </p>
    )
  return (
    <details className="rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2" data-testid="kit-script-score" data-score={sc.score} data-pass={sc.pass ? '1' : '0'}>
      <summary className={`sum-chev tap t-sub cursor-pointer font-semibold ${tone}`}>
        올리기 전 점수 {sc.score}점 · {sc.pass ? '바로 찍어도 돼요' : `고칠 곳 ${sc.items.length}`}
      </summary>
      <ul className="t-sub mt-1 flex list-disc flex-col gap-0.5 pl-5 break-keep text-slate-700">
        {sc.items.map((x) => (
          <li key={x.key}>{x.text}</li>
        ))}
      </ul>
      {!sc.pass && <p className="t-meta mt-1 break-keep text-slate-500">위 '더 바라는 점' 칸에 고칠 곳을 적고 다시 만들면 그대로 반영해요.</p>}
    </details>
  )
}
