/**
 * D-259 · D-260 벤치마킹 영상 창 아래 — [대본 받아 적기] · [AI로 우리 회사 버전 만들기] (대표만).
 *   대본: Gemini 가 공개 영상을 직접 보고 10분씩 받아 적는다 · 받은 구간부터 보임 · 시각을 누르면 유튜브 그 자리 · 전체 복사 · 영상마다 기억.
 *   우리 버전: 이 영상의 틀(고민 · 제목 · 구성)을 채널 설계 기준 · 규칙집에 맞춰 — 제목 · 썸네일 · 첫 문장 · 구성 · 우리 재료 · 쇼츠 → [내 콘텐츠에 담기].
 */
import { useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { BookmarkPlus, ClipboardCopy, ExternalLink, FileText, Loader2, RotateCcw, Sparkles } from 'lucide-react'
import { useAiAssistAccess } from '../../../auth/ownerAiAccess'
import { ModelPicker } from '../../../components/ai/ModelPicker'
import { useToast } from '../../../components/ui/toastContext'
import { copyText } from '../../../components/consulting/studioParts'
import { todayLocalDate } from '../../../lib/appClock'
import type { ChannelBrief, IdeaInput } from '../../../services/marketing/radarStore'
import type { RadarVideo } from '../../../services/marketing/ytRadar'
import { adaptContext, adaptIdea, adaptItem, adaptText, canTranscribe, clockOf, transcriptContext, transcriptDone, transcriptLines, transcriptSegments, transcriptText } from '../../../services/marketing/videoStudy'
import { adaptOf, resetTranscript, startAdapt, startTranscript, studyRun, studyVersion, subscribeStudy, transcriptOf } from '../../../services/marketing/videoStudyRun'

export interface StudyProps {
  brief: ChannelBrief | null
  readOnly: boolean
  /** 예시 데이터로 보는 중(지어낸 영상 — 받아 적기 없음) */
  sample?: boolean
  /** 내 콘텐츠에 담기 → 담은 줄 주소(실패 · 취소면 null) */
  onSave: (input: IdeaInput) => Promise<string | null>
}

const ORDER: { tag: string; title: RegExp; label: string }[] = [
  { tag: '분석', title: /왜/, label: '왜 잘 됐나' },
  { tag: '제목', title: /제목/, label: '제목 후보' },
  { tag: '썸네일', title: /썸네일/, label: '썸네일 문구' },
  { tag: '첫문장', title: /첫\s*문장/, label: '첫 문장' },
  { tag: '구성', title: /구성/, label: '구성 시간표' },
  { tag: '재료', title: /재료/, label: '우리가 보여 줄 재료' },
  { tag: '쇼츠', title: /쇼츠/, label: '쇼츠로 자르기' },
  { tag: '차별', title: /그대로|바꿀/, label: '그대로 가져올 것 · 바꿀 것' },
]

const tAt = (url: string, t: number) => `${url}${url.includes('?') ? '&' : '?'}t=${Math.floor(t)}s`

export function VideoStudy({ v, lessons, study }: { v: RadarVideo; lessons: readonly string[]; study: StudyProps }) {
  const access = useAiAssistAccess()
  const { showToast } = useToast()
  useSyncExternalStore(subscribeStudy, studyVersion, studyVersion)
  const [savedHref, setSavedHref] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  if (access !== 'owner') return null

  const run = studyRun(v.id)
  const doc = transcriptOf(v.id)
  const segs = transcriptSegments(v.durationSec)
  const lines = transcriptLines(doc)
  const failed = (doc?.parts ?? []).filter((p) => p.status === 'error')
  const done = transcriptDone(doc, segs)
  const gotParts = (doc?.parts ?? []).filter((p) => p.status === 'done').length
  const can = !study.sample && canTranscribe(v.id)
  const adapt = adaptOf(v.id)
  const a = adapt?.answer ?? null
  const minutes = Math.max(1, Math.round(v.durationSec / 60))
  const copy = async (t: string, what: string) => showToast((await copyText(t)) ? `${what} 복사했어요` : '복사하지 못했어요 — 글을 길게 눌러 복사해 주세요')
  const ctxBase = () => adaptContext({ v, lessons, brief: study.brief, transcript: transcriptOf(v.id), today: todayLocalDate() })

  // 받아 적기에는 영상 이름 · 채널 · 길이만(규칙집 · 채널 기준 · 앞서 받은 대본 없이 — 들린 그대로)
  const getTranscript = (onlyFailed = false) => startTranscript({ id: v.id, title: v.title, durationSec: v.durationSec }, transcriptContext(v, todayLocalDate()), onlyFailed ? failed.map((p) => ({ start: p.start, end: p.end })) : undefined)
  const makeAdapt = async () => {
    setSavedHref(null)
    const got = await startAdapt(v.id, ctxBase(), lines.length > 0)
    if (got) showToast('우리 회사 버전을 만들었어요 — 아래에서 확인하고 [내 콘텐츠에 담기]')
  }
  const save = async () => {
    if (!a || saving) return
    setSaving(true)
    try {
      const href = await study.onSave(adaptIdea(a, v))
      if (href) setSavedHref(href)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="flex flex-col gap-3" data-ai-assist data-testid="video-study">
      {/* 대본 */}
      <div className="flex flex-col gap-2.5 rounded-(--radius-panel) border border-slate-200 bg-slate-50 p-3 sm:p-4" data-testid="vs-transcript">
        <div className="flex flex-wrap items-center gap-2">
          <FileText aria-hidden="true" className="size-5 shrink-0 text-slate-700" />
          <p className="t-body flex-1 font-bold whitespace-nowrap text-slate-900">영상 대본</p>
          {lines.length > 0 && (
            <span className="t-meta text-slate-500" data-testid="vs-count">
              {lines.length}줄 · {gotParts}/{segs.length} 구간{doc?.model ? ` · ${doc.model}` : ''}
            </span>
          )}
        </div>
        {!can ? (
          <p className="t-sub break-keep text-slate-600" data-testid="vs-cannot">
            예시 영상은 받아 적을 수 없어요 — 실제로 받아 온 영상에서 눌러 주세요.
          </p>
        ) : (
          <>
            {!lines.length && run.running === 0 && (
              <p className="t-sub break-keep text-slate-600">
                Gemini 가 이 영상을 직접 보고 말을 그대로 받아 적어요. {v.isShort ? '쇼츠라 한 번에' : `${minutes}분 영상 — 10분씩 ${segs.length}번에 나눠`} 받아요(보통 1~2분).
                {v.durationSec > 7200 && ' 2시간이 넘는 영상은 앞 2시간만 받아요.'}
              </p>
            )}
            {run.running > 0 && (
              <div className="flex flex-col gap-1" role="status" data-testid="vs-progress">
                <p className="t-sub flex items-center gap-1.5 font-semibold text-violet-900">
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" /> 받아 적는 중 — {run.total - run.running}/{run.total} 구간 끝
                </p>
                <div className="h-2 overflow-hidden rounded-full bg-violet-100">
                  <div className="h-full rounded-full bg-violet-500 transition-[width]" style={{ width: `${Math.round(((run.total - run.running) / Math.max(1, run.total)) * 100)}%` }} />
                </div>
              </div>
            )}
            {lines.length > 0 && (
              <ol className="flex max-h-[45vh] flex-col gap-1.5 overflow-y-auto rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2.5" data-testid="vs-lines">
                {lines.map((l, k) => (
                  <li key={`${l.t}-${k}`} className="t-sub flex gap-2.5 break-keep text-slate-800 [overflow-wrap:anywhere]">
                    <a href={tAt(v.url, l.t)} target="_blank" rel="noopener noreferrer" className="shrink-0 font-semibold text-violet-700 tabular-nums hover:underline" title="유튜브에서 이 자리부터 보기">
                      {clockOf(l.t)}
                    </a>
                    <span className="min-w-0">
                      {l.screen && <span className="t-meta mr-1 rounded bg-slate-100 px-1 text-slate-500">화면 글</span>}
                      {l.text}
                    </span>
                  </li>
                ))}
              </ol>
            )}
            {failed.length > 0 && run.running === 0 && (
              <p role="alert" className="t-sub break-keep rounded-(--radius-control) bg-amber-50 px-3 py-2 text-amber-900" data-testid="vs-failed">
                {failed.length}개 구간({failed.map((p) => `${clockOf(p.start)}~${clockOf(p.end)}`).join(' · ')})을 받지 못했어요 — {failed[0].error}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {!done && run.running === 0 && (failed.length === 0 || gotParts + failed.length < segs.length) && (
                <button type="button" onClick={() => getTranscript()} className="tap t-sub inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-control) bg-slate-900 px-3 font-semibold text-white hover:bg-slate-800" data-testid="vs-get">
                  <FileText aria-hidden="true" className="size-4" /> {lines.length ? '나머지 받아 적기' : '대본 받아 적기'}
                </button>
              )}
              {failed.length > 0 && run.running === 0 && (
                <button type="button" onClick={() => getTranscript(true)} className="tap t-sub inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-control) border border-amber-300 bg-white px-3 font-semibold text-amber-900 hover:bg-amber-50" data-testid="vs-retry">
                  <RotateCcw aria-hidden="true" className="size-4" /> 못 받은 구간 다시
                </button>
              )}
              {lines.length > 0 && (
                <button type="button" onClick={() => void copy(transcriptText(doc), '대본')} className="tap t-sub inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-control) border border-slate-300 bg-white px-3 font-semibold text-slate-800 hover:bg-slate-50" data-testid="vs-copy">
                  <ClipboardCopy aria-hidden="true" className="size-4" /> 대본 전체 복사
                </button>
              )}
              {doc && run.running === 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('받아 둔 대본을 지우고 처음부터 다시 받을까요?')) {
                      resetTranscript(v.id)
                      getTranscript()
                    }
                  }}
                  className="tap t-meta ml-auto font-semibold text-slate-500 underline underline-offset-2"
                  data-testid="vs-reset"
                >
                  처음부터 다시 받기
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* 우리 회사 버전 */}
      <div className="flex flex-col gap-2.5 rounded-(--radius-panel) border border-violet-200 bg-violet-50 p-3 sm:p-4" data-testid="vs-adapt">
        <div className="flex flex-wrap items-center gap-2">
          <Sparkles aria-hidden="true" className="size-5 shrink-0 text-violet-700" />
          <p className="t-body min-w-0 flex-1 font-bold text-violet-950">AI로 우리 회사 버전 만들기</p>
        </div>
        <p className="t-sub break-keep text-violet-950/80">
          이 영상이 잘 된 틀(건드린 고민 · 제목 · 구성)을 우리 채널 기준에 맞게 — 제목 · 썸네일 · 첫 문장 · 구성 시간표 · 우리 재료 · 쇼츠까지. 제목 · 대사는 베끼지 않아요.
        </p>
        {can && !lines.length && !a && <p className="t-meta break-keep text-violet-900">대본을 먼저 받으면 구성까지 더 정확해요(없어도 만들 수 있어요).</p>}
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void makeAdapt()} disabled={run.adapting} className="tap t-sub inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-control) bg-violet-700 px-3 font-semibold text-white hover:bg-violet-800 disabled:opacity-60" data-testid="vs-adapt-run">
            {run.adapting ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Sparkles aria-hidden="true" className="size-4" />}
            {run.adapting ? '만드는 중…' : a ? '다시 만들기' : 'AI로 우리 회사 버전 만들기'}
          </button>
          <ModelPicker popover testId="vs-model" />
          {a && adapt && <span className="t-meta text-violet-900/70">{adapt.withTranscript ? '대본을 보고 만듦' : '제목 · 숫자로 만듦'} · {adapt.model}</span>}
        </div>
        {run.adaptError && (
          <p role="alert" className="t-sub break-keep rounded-(--radius-control) bg-amber-50 px-3 py-2 text-amber-900" data-testid="vs-adapt-error">
            {run.adaptError}
          </p>
        )}
        {a && (
          <div className="flex flex-col gap-2.5 rounded-(--radius-control) bg-white p-3" data-testid="vs-adapt-result">
            <p className="t-meta font-semibold text-slate-500">우리 버전 제목</p>
            <p className="t-body font-bold break-keep text-slate-900 [overflow-wrap:anywhere]" data-testid="vs-adapt-headline">
              {a.headline}
            </p>
            {ORDER.map((o) => {
              const it = adaptItem(a, o.tag, o.title)
              if (!it) return null
              return (
                <div key={o.tag} className="flex flex-col gap-1 border-t border-slate-100 pt-2" data-testid="vs-adapt-part" data-tag={o.tag}>
                  <p className="t-sub font-bold text-violet-900">{o.label}</p>
                  {it.detail && <p className="t-sub break-keep text-slate-700">{it.detail}</p>}
                  {it.outline && it.outline.length > 0 && (
                    <ul className="flex list-disc flex-col gap-0.5 pl-5">
                      {it.outline.map((x, k) => (
                        <li key={k} className="t-sub break-keep text-slate-800 [overflow-wrap:anywhere]">
                          {x}
                        </li>
                      ))}
                    </ul>
                  )}
                  {it.body && <p className="t-sub break-keep whitespace-pre-wrap text-slate-800 [overflow-wrap:anywhere]">{it.body}</p>}
                </div>
              )
            })}
            {a.next && a.next.length > 0 && (
              <p className="t-sub break-keep border-t border-slate-100 pt-2 text-slate-800">
                <b>찍기 전 준비물</b> · {a.next.join(' · ')}
              </p>
            )}
            {a.caution && <p className="t-sub break-keep text-warning-800">△ {a.caution}</p>}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button type="button" onClick={() => void copy(adaptText(a, v), '우리 버전')} className="tap t-sub inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-control) border border-slate-300 bg-white px-3 font-semibold text-slate-800 hover:bg-slate-50" data-testid="vs-adapt-copy">
                <ClipboardCopy aria-hidden="true" className="size-4" /> 전체 복사
              </button>
              {!study.readOnly && (
                <button type="button" onClick={() => void save()} disabled={saving} className="tap t-sub inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-control) bg-violet-700 px-3 font-semibold text-white hover:bg-violet-800 disabled:opacity-60" data-testid="vs-adapt-save">
                  <BookmarkPlus aria-hidden="true" className="size-4" /> {savedHref ? '다시 담기' : '내 콘텐츠에 담기'}
                </button>
              )}
              {savedHref && (
                <Link to={savedHref} className="tap t-sub inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-control) px-2 font-semibold text-violet-800 underline underline-offset-2" data-testid="vs-adapt-open">
                  <ExternalLink aria-hidden="true" className="size-4" /> 내 콘텐츠에서 보기
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
      {run.storeFull && (
        <p role="status" className="t-meta break-keep rounded-(--radius-control) bg-amber-50 px-3 py-2 text-amber-900" data-testid="vs-store-full">
          이 브라우저 저장 공간이 가득 차 대본 · 우리 버전을 남기지 못했어요 — 지금 화면의 글은 [복사] 로 가져가세요(창을 새로 열면 사라져요).
        </p>
      )}
    </section>
  )
}
