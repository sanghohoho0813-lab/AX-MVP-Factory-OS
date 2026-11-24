/**
 * D-654 미팅 녹음 요약(대표만) — 미팅 메모 탭의 [녹음해서 적기].
 *
 *   [녹음해서 적기] → 녹음 전 동의 한 줄 → [동의 받았어요 · 녹음 시작] → 2분마다 조각을 서버 AI 가 받아 적음(녹음은 계속)
 *   → [멈추고 정리] → 받아 적은 글 전체를 미팅 메모로 정리 → 아래 메모 칸에 넣음(덮지 않고 덧붙임) → 사람이 읽고 [기록]
 *
 * 녹음 파일은 저장하지 않는다(조각은 받아 적고 버린다 · 못 받아 적은 조각만 [다시 받아 적기] 를 위해 이 화면 안에 잠시).
 * 화면을 닫거나 다른 곳으로 가면 녹음은 멈춘다 — 그래서 녹음 중에는 나가기 전에 묻는다.
 */
import { useEffect, useRef, useState } from 'react'
import { Copy, Mic, RotateCcw, Square } from 'lucide-react'
import { Button } from '../ui/Button'
import { useToast } from '../ui/toastContext'
import { copyText } from '../consulting/studioParts'
import { todayLocalDate } from '../../lib/appClock'
import { callAssistRetry } from '../../services/aiAssist/retry'
import { AssistError } from '../../services/aiAssist/client'
import {
  REC_BITRATE,
  REC_MAX_SEC,
  REC_MIN_BYTES,
  blobToBase64,
  chunkMs,
  clockOf,
  heardLinesOf,
  heardRunOk,
  heardText,
  memoFromSummary,
  pickRecordMime,
  summaryContext,
  transcribeContext,
  type HeardLine,
} from '../../services/meetingRecord'

type Phase = 'idle' | 'consent' | 'recording' | 'finishing' | 'done'
type SegStatus = 'wait' | 'busy' | 'done' | 'fail'
interface Seg {
  index: number
  start: number
  status: SegStatus
  lines: HeardLine[]
  blob: Blob | null
  mime: string
}

const AI_BTN = 'tap t-sub inline-flex min-h-10 items-center gap-1.5 rounded-(--radius-control) border border-violet-300 bg-white px-3 py-1.5 font-semibold text-violet-800 hover:bg-violet-50'

const errText = (e: unknown, fallback: string) => (e instanceof AssistError && e.message ? e.message : fallback)

export function MeetingRecorder({ company, onMemo }: { company: string; onMemo: (text: string) => void }) {
  const { showToast } = useToast()
  const [phase, setPhase] = useState<Phase>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [segs, setSegs] = useState<Seg[]>([])
  const [error, setError] = useState('')
  const [heard, setHeard] = useState<HeardLine[]>([])
  const [memoOk, setMemoOk] = useState(false)
  const [discardAsk, setDiscardAsk] = useState(false)

  const streamRef = useRef<MediaStream | null>(null)
  const recRef = useRef<MediaRecorder | null>(null)
  const rollRef = useRef<number | null>(null)
  const tickRef = useRef<number | null>(null)
  const startedRef = useRef(0)
  const segsRef = useRef<Seg[]>([])
  const nextRef = useRef(0)
  const chainRef = useRef<Promise<void>>(Promise.resolve())
  const mimeRef = useRef('')
  const runningRef = useRef(false)
  const aliveRef = useRef(true)
  const wakeRef = useRef<{ release: () => Promise<void> } | null>(null)
  const lengthRef = useRef(0)

  const sync = () => {
    if (aliveRef.current) setSegs([...segsRef.current].sort((a, b) => a.index - b.index))
  }
  const patch = (index: number, p: Partial<Seg>) => {
    segsRef.current = segsRef.current.map((s) => (s.index === index ? { ...s, ...p } : s))
    sync()
  }

  const transcribe = async (seg: Seg) => {
    if (!seg.blob) return
    patch(seg.index, { status: 'busy' })
    try {
      if (seg.blob.size < REC_MIN_BYTES) {
        patch(seg.index, { status: 'done', lines: [], blob: null })
        return
      }
      const data = await blobToBase64(seg.blob)
      const { value } = await callAssistRetry({
        req: { assistId: 'meeting.transcribe', page: 'client', choice: null, context: transcribeContext(company, seg.index, seg.start, todayLocalDate()), audio: { mime: seg.mime, data, index: seg.index, start: seg.start } },
        parse: heardRunOk,
        hint: '[출력 형식] 의 JSON 하나로만 다시 — 받아 적은 말은 items 의 body 에',
        missMessage: '받아 적은 글을 읽지 못했어요',
      })
      patch(seg.index, { status: 'done', lines: heardLinesOf(value.structured, seg.start), blob: null })
    } catch (e) {
      patch(seg.index, { status: 'fail' })
      if (aliveRef.current) setError(errText(e, '이 구간을 받아 적지 못했어요'))
    }
  }

  const enqueue = (seg: Seg) => {
    segsRef.current = [...segsRef.current, seg]
    sync()
    chainRef.current = chainRef.current.then(() => transcribe(seg))
  }

  const clearTimers = () => {
    if (rollRef.current !== null) window.clearTimeout(rollRef.current)
    if (tickRef.current !== null) window.clearInterval(tickRef.current)
    rollRef.current = null
    tickRef.current = null
  }

  const releaseMic = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    void wakeRef.current?.release().catch(() => undefined)
    wakeRef.current = null
  }

  /** 조각 하나 녹음 — 2분 뒤 멈추고(그 조각을 받아 적으러 보냄) 바로 다음 조각 */
  const startSegment = () => {
    const stream = streamRef.current
    if (!stream || !runningRef.current) return
    const index = nextRef.current++
    const start = Math.round((Date.now() - startedRef.current) / 1000)
    let rec: MediaRecorder
    try {
      rec = new MediaRecorder(stream, { mimeType: mimeRef.current, audioBitsPerSecond: REC_BITRATE })
    } catch {
      rec = new MediaRecorder(stream)
    }
    const parts: Blob[] = []
    rec.ondataavailable = (ev) => {
      if (ev.data && ev.data.size) parts.push(ev.data)
    }
    rec.onstop = () => {
      const mime = (rec.mimeType || mimeRef.current).split(';')[0]
      enqueue({ index, start, status: 'wait', lines: [], blob: new Blob(parts, { type: mime }), mime })
    }
    rec.start()
    recRef.current = rec
    rollRef.current = window.setTimeout(() => {
      if (!runningRef.current) return
      rec.stop()
      if ((Date.now() - startedRef.current) / 1000 >= REC_MAX_SEC) void finish(true)
      else startSegment()
    }, chunkMs())
  }

  const begin = async () => {
    setError('')
    const MR = (window as unknown as { MediaRecorder?: { isTypeSupported?: (m: string) => boolean } }).MediaRecorder
    const mime = MR ? pickRecordMime((m) => (typeof MR.isTypeSupported === 'function' ? MR.isTypeSupported(m) : false)) : null
    if (!mime || !navigator.mediaDevices?.getUserMedia) {
      setError('이 브라우저에서는 녹음할 수 없어요 — 크롬이나 사파리로 열어 주세요')
      setPhase('idle')
      return
    }
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } })
    } catch {
      setError('마이크를 쓸 수 없어요 — 주소 줄 옆 자물쇠에서 마이크를 허용해 주세요')
      setPhase('idle')
      return
    }
    mimeRef.current = mime
    streamRef.current = stream
    startedRef.current = Date.now()
    segsRef.current = []
    nextRef.current = 0
    chainRef.current = Promise.resolve()
    runningRef.current = true
    setSegs([])
    setHeard([])
    setMemoOk(false)
    setElapsed(0)
    setDiscardAsk(false)
    setPhase('recording')
    // 휴대폰 화면이 꺼지면 녹음이 멈춘다 — 되는 브라우저는 화면을 켜 둔다
    try {
      const wl = (navigator as unknown as { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock
      if (wl) wakeRef.current = await wl.request('screen')
    } catch {
      /* 안 되는 브라우저 — 안내 글로 */
    }
    tickRef.current = window.setInterval(() => {
      const sec = Math.round((Date.now() - startedRef.current) / 1000)
      setElapsed(sec)
      if (sec >= REC_MAX_SEC) void finish(true)
    }, 1000)
    startSegment()
  }

  /** 받아 적은 글 전체 → 미팅 메모 */
  const summarize = async (lines: HeardLine[]) => {
    const mins = Math.max(1, Math.round(lengthRef.current / 60))
    try {
      const { value } = await callAssistRetry({
        req: { assistId: 'meeting.summary', page: 'client', choice: null, context: summaryContext(company, lines, todayLocalDate()) },
        parse: (run) => (run.structured && Array.isArray(run.structured.items) ? run : null),
        hint: '[출력 형식] 의 JSON 하나로만 다시 — 메모 한 줄은 items 의 title 에',
        missMessage: '정리한 글을 읽지 못했어요',
      })
      const memo = memoFromSummary(value.structured, `${mins}분 녹음`)
      if (!aliveRef.current) return
      if (memo) onMemo(memo)
      setMemoOk(!!memo)
      // 알림은 띄우지 않는다 — 판에 같은 글이 있고, 알림이 [기록] 단추(PC) · 창 제목(휴대폰)을 가린다
    } catch (e) {
      if (aliveRef.current) setError(`${errText(e, '정리하지 못했어요')} — 받아 적은 글은 아래에 있어요`)
    }
  }

  const collect = () => [...segsRef.current].sort((a, b) => a.index - b.index).flatMap((s) => s.lines)

  const finish = async (byLimit = false) => {
    if (!runningRef.current) return
    runningRef.current = false
    clearTimers()
    lengthRef.current = Math.round((Date.now() - startedRef.current) / 1000)
    const rec = recRef.current
    if (rec && rec.state !== 'inactive') {
      await new Promise<void>((res) => {
        rec.addEventListener('stop', () => res(), { once: true })
        rec.stop()
      })
    }
    releaseMic()
    if (!aliveRef.current) return
    setPhase('finishing')
    if (byLimit) showToast(`녹음은 ${Math.round(REC_MAX_SEC / 60)}분까지예요 — 여기까지 정리할게요`)
    await chainRef.current
    if (!aliveRef.current) return
    const lines = collect()
    setHeard(lines)
    const failed = segsRef.current.some((s) => s.status === 'fail')
    if (!lines.length) {
      setError(failed ? '받아 적지 못했어요 — [다시 받아 적기] 를 눌러 주세요' : '말소리가 들리지 않았어요 — 휴대폰을 가까이 두고 다시 녹음해 주세요')
      setPhase('done')
      return
    }
    await summarize(lines)
    if (aliveRef.current) setPhase('done')
  }

  /** 못 받아 적은 조각만 다시 → 다시 정리 */
  const retryFailed = async () => {
    setError('')
    setPhase('finishing')
    for (const seg of segsRef.current.filter((s) => s.status === 'fail')) await transcribe(seg)
    if (!aliveRef.current) return
    const lines = collect()
    setHeard(lines)
    if (lines.length) await summarize(lines)
    if (aliveRef.current) setPhase('done')
  }

  const discard = () => {
    runningRef.current = false
    clearTimers()
    const rec = recRef.current
    if (rec) {
      rec.onstop = null
      if (rec.state !== 'inactive') rec.stop()
    }
    releaseMic()
    segsRef.current = []
    setSegs([])
    setHeard([])
    setDiscardAsk(false)
    setPhase('idle')
    showToast('녹음을 버렸어요 — 남은 것은 없어요')
  }

  // 화면을 떠나면 녹음을 멈추고 마이크를 놓는다(받아 적던 것은 버림)
  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
      runningRef.current = false
      if (rollRef.current !== null) window.clearTimeout(rollRef.current)
      if (tickRef.current !== null) window.clearInterval(tickRef.current)
      const rec = recRef.current
      if (rec) {
        rec.onstop = null
        if (rec.state !== 'inactive') rec.stop()
      }
      streamRef.current?.getTracks().forEach((t) => t.stop())
      void wakeRef.current?.release().catch(() => undefined)
    }
  }, [])

  // 녹음 · 정리 중에는 창을 닫기 전에 묻는다
  useEffect(() => {
    if (phase !== 'recording' && phase !== 'finishing') return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [phase])

  // 버리기 확인은 4초 뒤 저절로 접힌다
  useEffect(() => {
    if (!discardAsk) return
    const t = window.setTimeout(() => setDiscardAsk(false), 4000)
    return () => window.clearTimeout(t)
  }, [discardAsk])

  const doneSegs = segs.filter((s) => s.status === 'done').length
  const busySegs = segs.filter((s) => s.status === 'wait' || s.status === 'busy').length
  const failSegs = segs.filter((s) => s.status === 'fail').length

  if (phase === 'idle')
    return (
      <div className="flex flex-col gap-1.5" data-testid="rec" data-phase="idle">
        <button type="button" className={`${AI_BTN} self-start`} onClick={() => setPhase('consent')} data-testid="rec-open" data-guide="fn-meeting-record">
          <Mic aria-hidden="true" className="size-4" />
          녹음해서 적기
        </button>
        {error && (
          <p className="t-sub break-keep text-danger-700" data-testid="rec-error">
            {error}
          </p>
        )}
      </div>
    )

  return (
    <section className="flex flex-col gap-2.5 rounded-(--radius-control) border border-slate-200 bg-white px-3.5 py-3" data-testid="rec" data-phase={phase}>
      {phase === 'consent' && (
        <>
          <p className="t-body font-semibold break-keep text-slate-900">녹음 전에 대표님께 여쭤 주세요</p>
          <p className="t-sub break-keep text-slate-700" data-testid="rec-consent">
            「미팅 내용을 정리하려고 녹음해도 될까요?」 — 녹음은 남기지 않고, 받아 적은 글만 메모에 들어가요.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" onClick={() => void begin()} data-testid="rec-start">
              <Mic aria-hidden="true" className="size-4" /> 동의 받았어요 · 녹음 시작
            </Button>
            <Button variant="ghost" onClick={() => setPhase('idle')} data-testid="rec-cancel">
              취소
            </Button>
          </div>
        </>
      )}

      {phase === 'recording' && (
        <>
          <p className="t-body flex flex-wrap items-center gap-x-2 font-semibold text-slate-900" data-testid="rec-live">
            <span aria-hidden="true" className="size-2.5 rounded-full bg-danger-600" />
            녹음 중 <span className="tabular-nums" data-testid="rec-time">{clockOf(elapsed)}</span>
            <span className="t-sub font-normal text-slate-600" data-testid="rec-progress" data-done={doneSegs} data-busy={busySegs}>
              {doneSegs ? `· 받아 적음 ${doneSegs}구간` : '· 2분마다 받아 적어요'}
            </span>
          </p>
          <p className="t-meta break-keep text-slate-600">화면을 켜 둔 채로 두세요 — 다른 앱으로 가면 녹음이 멈출 수 있어요.</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" onClick={() => void finish()} data-testid="rec-stop">
              <Square aria-hidden="true" className="size-4" /> 멈추고 정리
            </Button>
            <Button variant={discardAsk ? 'danger' : 'secondary'} onClick={() => (discardAsk ? discard() : setDiscardAsk(true))} data-testid="rec-discard">
              {discardAsk ? '정말 버리기' : '버리기'}
            </Button>
          </div>
        </>
      )}

      {phase === 'finishing' && (
        <p className="t-body break-keep text-slate-800" data-testid="rec-busy" aria-live="polite">
          받아 적고 정리하는 중… {segs.length > 0 && <span className="t-sub text-slate-600">({doneSegs}/{segs.length}구간)</span>}
        </p>
      )}

      {phase === 'done' && (
        <>
          <p className="t-body font-semibold break-keep text-slate-900" data-testid="rec-done">
            {memoOk ? '정리한 글을 아래 메모 칸에 넣었어요 — 읽어 보고 [기록] 을 눌러 주세요' : heard.length ? '받아 적은 글은 아래에 있어요' : '정리할 글이 없어요'}
          </p>
          {heard.length > 0 && (
            <details className="rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2" data-testid="rec-heard">
              <summary className="sum-chev t-sub cursor-pointer font-semibold text-slate-800">받아 적은 글 전체 ({heard.length}줄)</summary>
              <pre className="t-sub mt-2 max-h-64 overflow-y-auto font-sans break-keep whitespace-pre-wrap text-slate-800" data-testid="rec-heard-text">
                {heardText(heard)}
              </pre>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button variant="secondary" onClick={async () => showToast((await copyText(heardText(heard))) ? '받아 적은 글을 복사했어요' : '복사하지 못했어요 — 다시 눌러 주세요')} data-testid="rec-heard-copy">
                  <Copy aria-hidden="true" className="size-4" /> 복사
                </Button>
                {!memoOk && (
                  <Button variant="secondary" onClick={() => onMemo(heardText(heard))} data-testid="rec-heard-insert">
                    메모 칸에 그대로 넣기
                  </Button>
                )}
              </div>
            </details>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {failSegs > 0 && (
              <Button variant="secondary" onClick={() => void retryFailed()} data-testid="rec-retry">
                <RotateCcw aria-hidden="true" className="size-4" /> 못 받아 적은 {failSegs}구간 다시
              </Button>
            )}
            {!memoOk && heard.length > 0 && failSegs === 0 && (
              <Button variant="secondary" onClick={() => void (async () => { setError(''); setPhase('finishing'); await summarize(heard); if (aliveRef.current) setPhase('done') })()} data-testid="rec-resum">
                <RotateCcw aria-hidden="true" className="size-4" /> 정리 다시
              </Button>
            )}
            <button type="button" className={AI_BTN} onClick={() => setPhase('consent')} data-testid="rec-again">
              <Mic aria-hidden="true" className="size-4" /> 새로 녹음
            </button>
          </div>
        </>
      )}

      {error && phase !== 'consent' && (
        <p className="t-sub break-keep text-danger-700" data-testid="rec-error">
          {error}
        </p>
      )}
    </section>
  )
}
