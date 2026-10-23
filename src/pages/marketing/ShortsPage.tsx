/**
 * D-273 마케팅 · 브랜딩 › 릴스 · 틱톡 — 대표 "릴스 틱톡 파트도 따로 만들어 줘 · 60대도 쓸 수 있을 정도로 쉽고 간편하게".
 * 대표가 준 숏폼 실측 공식(틱톡 · 릴스 승 · 패 비교)을 그대로, 한 번에 하나씩 고르게:
 *  ① 어디에(틱톡 · 쇼츠 / 릴스) ② 무엇을(많이 보이게 / 문의 · 댓글) ③ 형식(맞는 것만 2~4개) ④ 소재 → [예시 대본] 또는 [AI로 대본 2개]
 *  ⑤ 고치며 규칙 검사(규칙 계산 — 첫마디 · 길이 · 권유 · 캡션 · 해시태그) → 복사 · 저장 · 올렸어요
 *  기록표: 조회 · 좋아요 · 댓글 · 저장 · 공유 · 문의 → 점수(좋아요 + 댓글×3) · 저장 · 공유율 · 형식별 평균.
 * 대표 전용(마케팅 · 브랜딩 모듈). 저장은 기존 모듈 기록(marketing / shorts).
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { BookOpen, CalendarCheck, ClipboardCopy, Clapperboard, Download, FilePlus2, RefreshCw, Save, Send, Sparkles, TriangleAlert } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Badge, MetricTile, Surface } from '../../components/ui/primitives'
import { useToast } from '../../components/ui/toastContext'
import { copyText, downloadText } from '../../components/consulting/studioParts'
import { WorkspaceScope } from '../../components/workspace/WorkspaceScope'
import { useViewingPilot } from '../../auth/osAccess'
import { useOwnerAiAccess } from '../../auth/ownerAiAccess'
import { MarketingTabs } from '../../tools/marketing/MarketingTabs'
import { todayLocalDate } from '../../lib/appClock'
import { AssistError, callAssist } from '../../services/aiAssist/client'
import { newRequestId, readChoice } from '../../services/aiAssist/store'
import { useShortPosts } from '../../services/marketing/useSnsPosts'
import {
  AIMS,
  EMPTY_SHORT_STATS,
  PLATFORMS,
  SHORT_BASICS,
  SHORT_FORMATS,
  SHORT_STAT_KEYS,
  aimLabel,
  aimsOf,
  exampleOf,
  firstWordsOf,
  formatOf,
  formatRecords,
  formatsFor,
  keepRate,
  lintShort,
  parseShortDrafts,
  shortScore,
  shortsContext,
  shortsCsv,
  weekMix,
  type ShortAim,
  type ShortDraft,
  type ShortFormat,
  type ShortFormatKey,
  type ShortPlatform,
  type ShortPost,
} from '../../services/marketing/shorts'
import { BigChoices, DeleteTwice, FactsBox, InnerTabs, LintList, RewriteTable, ShareKit, StatInputs, StepTitle, chip } from './snsParts'

type Tab = 'write' | 'records' | 'guide'
const TABS = [
  { key: 'write' as const, label: '오늘 만들 영상', short: '만들기', icon: Clapperboard },
  { key: 'records' as const, label: '기록표', short: '기록표', icon: CalendarCheck },
  { key: 'guide' as const, label: '형식 · 공식', short: '공식', icon: BookOpen },
]
const tabOf = (raw: string | null): Tab => (TABS.some((t) => t.key === raw) ? (raw as Tab) : 'write')

const QUICK_TOPICS = ['창업 3년 안 벤처확인 세금', '매일 반복되는 일 하나 화면으로 바꾸기', '정책자금 전에 볼 기본 컨디션(신용 · 재무 · 체납)']

interface Draft {
  id?: string
  platform: ShortPlatform
  aim: ShortAim | ''
  format: ShortFormatKey | ''
  topic: string
  facts: string
  script: string
  caption: string
  hashtags: string
  checks: string[]
  source: ShortPost['source']
}
const EMPTY: Draft = { platform: 'tiktok', aim: '', format: '', topic: '', facts: '', script: '', caption: '', hashtags: '', checks: [], source: 'hand' }
const DRAFT_KEY = 'mirae.shorts.draft.v1'
function readDraft(): Draft {
  try {
    const v = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null') as Partial<Draft> | null
    if (v && typeof v === 'object') return { ...EMPTY, ...v, platform: v.platform === 'reels' ? 'reels' : 'tiktok', checks: Array.isArray(v.checks) ? v.checks.filter((x) => typeof x === 'string') : [] }
  } catch {
    // 못 읽으면 빈 대본
  }
  return EMPTY
}
function writeDraft(d: Draft): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(d))
  } catch {
    // 저장 공간이 없으면 이번 접속 동안만
  }
}

export default function ShortsPage() {
  return <WorkspaceScope>{(ctx) => <Shorts workspaceId={ctx.workspaceId} />}</WorkspaceScope>
}

function Shorts({ workspaceId }: { workspaceId: string | null }) {
  const readOnly = useViewingPilot() !== null
  const aiOk = useOwnerAiAccess() !== 'no' && !readOnly
  const store = useShortPosts(workspaceId, readOnly)
  const [params, setParams] = useSearchParams()
  const tab = tabOf(params.get('tab'))
  const go = (t: Tab) => {
    const next = new URLSearchParams(params)
    if (t === 'write') next.delete('tab')
    else next.set('tab', t)
    setParams(next)
  }
  // D-274 스레드에서 '같은 소재로' 를 누르고 왔으면 소재를 채운다(주소의 topic 은 한 번 쓰고 지운다)
  const [draft, setDraftState] = useState<Draft>(() => {
    const d = readDraft()
    const t = params.get('topic')
    return t ? { ...d, topic: t.slice(0, 200) } : d
  })
  useEffect(() => {
    if (!params.get('topic')) return
    const next = new URLSearchParams(params)
    next.delete('topic')
    setParams(next, { replace: true })
  }, [params, setParams])
  const setDraft = (fn: (d: Draft) => Draft) =>
    setDraftState((d) => {
      const n = fn(d)
      writeDraft(n)
      return n
    })
  const openPost = (p: ShortPost) => {
    setDraft(() => ({ ...EMPTY, id: p.id, platform: p.platform, aim: p.aim, format: p.format, topic: p.topic, script: p.script, caption: p.caption, hashtags: p.hashtags, checks: p.checks, source: p.source }))
    go('write')
  }
  const pickFormat = (f: ShortFormat) => {
    setDraft((d) => {
      const platform = f.platforms.includes(d.platform) ? d.platform : f.platforms[0]
      const aims = aimsOf(f, platform)
      return { ...d, platform, aim: d.aim && aims.includes(d.aim) ? d.aim : aims[0], format: f.key }
    })
    go('write')
  }

  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-5" data-testid="sht-page">
      <PageHeader
        title="마케팅 · 브랜딩"
        showOnPhone
        descriptionAsHint
        description="릴스 · 틱톡 · 유튜브 쇼츠 대본을 실측 공식대로 만듭니다 — 어디에 · 무엇을 · 어떤 형식을 하나씩 고르면 예시 대본이나 AI 대본이 나오고, 첫마디 · 길이 · 권유 · 캡션 · 해시태그를 규칙으로 바로 확인합니다(규칙 계산)."
      />
      <MarketingTabs active="shorts" />
      <InnerTabs tabs={TABS} value={tab} onPick={go} label="릴스 · 틱톡" testPrefix="sht" />
      {store.failed && (
        <div role="alert" className="flex flex-wrap items-center gap-2 rounded-(--radius-control) border border-warning-200 bg-warning-50 px-3 py-2" data-testid="sht-failed">
          <p className="t-sub min-w-[12rem] flex-1 break-keep text-warning-700">기록을 읽지 못했습니다. 적어 둔 대본은 이 화면에 그대로 있고, 다시 읽기 전에는 저장하지 않습니다.</p>
          <Button size="sm" variant="secondary" onClick={() => void store.reload()}>
            <RefreshCw aria-hidden="true" className="size-4" /> 다시 읽기
          </Button>
        </div>
      )}
      {readOnly && <p className="t-sub rounded-(--radius-control) bg-slate-50 px-3 py-2 text-slate-600">팀장 화면을 보는 중에는 저장하지 않습니다.</p>}
      {tab === 'write' && <WritePanel draft={draft} setDraft={setDraft} store={store} aiOk={aiOk} readOnly={readOnly} onRecords={() => go('records')} />}
      {tab === 'records' && <RecordsPanel store={store} readOnly={readOnly} onOpen={openPost} />}
      {tab === 'guide' && <GuidePanel onUse={pickFormat} />}
    </div>
  )
}

type Store = ReturnType<typeof useShortPosts>

/* ------------------------------------------------------------------ */
/* 오늘 만들 영상                                                        */
/* ------------------------------------------------------------------ */

function WritePanel({ draft, setDraft, store, aiOk, readOnly, onRecords }: { draft: Draft; setDraft: (fn: (d: Draft) => Draft) => void; store: Store; aiOk: boolean; readOnly: boolean; onRecords: () => void }) {
  const { showToast } = useToast()
  const navigate = useNavigate()
  const today = todayLocalDate()
  const set = (part: Partial<Draft>) => setDraft((d) => ({ ...d, ...part }))
  const formats = formatsFor(draft.platform, draft.aim)
  const fmt = draft.format ? formatOf(draft.format) : undefined
  const [ai, setAi] = useState<{ busy: boolean; error: string; drafts: ShortDraft[] }>({ busy: false, error: '', drafts: [] })
  const [saving, setSaving] = useState(false)
  const factsText = `${draft.facts}\n${draft.topic}`
  const lint = useMemo(() => lintShort({ platform: draft.platform, aim: draft.aim, script: draft.script, caption: draft.caption, hashtags: draft.hashtags, facts: factsText }), [draft.platform, draft.aim, draft.script, draft.caption, draft.hashtags, factsText])
  const mix = weekMix(store.posts, today)

  const pickPlatform = (p: ShortPlatform) => {
    const f = draft.format ? formatOf(draft.format) : undefined
    set({ platform: p, format: f && f.platforms.includes(p) && (!draft.aim || aimsOf(f, p).includes(draft.aim)) ? draft.format : '' })
  }
  const pickAim = (a: ShortAim) => {
    const f = draft.format ? formatOf(draft.format) : undefined
    set({ aim: a, format: f && aimsOf(f, draft.platform).includes(a) ? draft.format : '' })
  }
  const start = (part: Pick<Draft, 'script' | 'caption' | 'hashtags' | 'source'> & Partial<Draft>) => {
    if (draft.script.trim() && draft.script.trim() !== part.script.trim() && !window.confirm('지금 쓰던 대본을 이 대본으로 바꿀까요? (쓰던 대본은 사라집니다)')) return
    set({ checks: [], ...part })
    document.getElementById('sht-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const runAi = async () => {
    if (ai.busy) return
    setAi({ busy: true, error: '', drafts: [] })
    try {
      const context = shortsContext({ platform: draft.platform, aim: draft.aim, format: draft.format, topic: draft.topic, facts: draft.facts, recent: store.posts, today })
      const run = await callAssist({ requestId: newRequestId(), assistId: 'shorts.write', page: 'shorts', choice: readChoice(), context })
      const { drafts, checks } = parseShortDrafts(run.structured)
      if (!drafts.length) throw new AssistError('provider_error', 'AI 답에서 대본을 찾지 못했어요 — 다시 눌러 주세요.')
      setAi({ busy: false, error: '', drafts })
      set({ checks })
    } catch (e) {
      setAi({ busy: false, error: e instanceof Error && e.message ? e.message : '다시 눌러 주세요.', drafts: [] })
    }
  }
  const save = async (posted: boolean) => {
    if (!draft.script.trim()) return showToast('대본이 비어 있어요.')
    if (readOnly || saving) return
    setSaving(true)
    try {
      const prev = draft.id ? store.posts.find((p) => p.id === draft.id) : undefined
      const saved = await store.save({
        id: draft.id,
        platform: draft.platform,
        aim: draft.aim,
        format: draft.format,
        topic: draft.topic,
        script: draft.script.trim(),
        caption: draft.caption.trim(),
        hashtags: draft.hashtags.trim(),
        checks: draft.checks,
        status: posted ? 'posted' : (prev?.status ?? 'draft'),
        postedOn: posted ? (prev?.postedOn || today) : (prev?.postedOn ?? ''),
        stats: prev?.stats ?? EMPTY_SHORT_STATS,
        source: draft.source,
      })
      if (posted) {
        setDraft((d) => ({ ...EMPTY, platform: d.platform, aim: d.aim }))
        setAi({ busy: false, error: '', drafts: [] })
        showToast('기록표에 올렸어요 — 하루 이틀 뒤 숫자를 적어 주세요.')
        onRecords()
      } else {
        set({ id: saved.id })
        showToast('저장했어요 — 기록표의 "만들다 둔 영상" 에 있어요.')
      }
    } catch (e) {
      showToast(e instanceof Error && e.message ? `저장하지 못했어요 — ${e.message} (적은 대본은 이 화면에 그대로 있어요)` : '저장하지 못했어요 — 적은 대본은 이 화면에 그대로 있어요.')
    } finally {
      setSaving(false)
    }
  }
  const copy = (text: string, what: string) => void copyText(text).then((ok) => showToast(ok ? `${what} 복사했어요.` : '복사하지 못했어요 — 글을 길게 눌러 복사해 주세요.'))

  return (
    <div className="flex flex-col gap-4" data-testid="sht-write">
      <div className="rounded-(--radius-panel) border-2 border-slate-900 bg-white px-4 py-3" data-testid="sht-basics">
        <p className="t-body font-bold text-slate-900">이것만 지키면 돼요</p>
        <ol className="t-body mt-1 flex list-decimal flex-col gap-1 pl-5 break-keep text-slate-800">
          {SHORT_BASICS.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ol>
      </div>

      <Surface className="flex flex-col gap-3">
        <StepTitle n="1">어디에 올려요?</StepTitle>
        <BigChoices items={PLATFORMS} value={draft.platform} onPick={pickPlatform} label="어디에 올려요" testPrefix="sht-platform" min="13rem" />
      </Surface>

      <Surface className="flex flex-col gap-3">
        <StepTitle n="2">무엇을 원해요?</StepTitle>
        <BigChoices items={AIMS[draft.platform]} value={draft.aim} onPick={pickAim} label="무엇을 원해요" testPrefix="sht-aim" min="13rem" />
        <p className="t-sub break-keep text-slate-600" data-testid="sht-mix">
          {draft.platform === 'tiktok' ? `권장: 많이 보이게 3번에 문의로 1번 · 이번 주 ${mix.tiktok.reach} : ${mix.tiktok.convert}` : `권장: 많이 보이게 2번 · 댓글 받기 2번(자금 · 세금 소재는 댓글 위주) · 이번 주 ${mix.reels.reach} : ${mix.reels.convert}`}
        </p>
      </Surface>

      <Surface className="flex flex-col gap-3">
        <StepTitle n="3">어떤 형식으로?</StepTitle>
        <ul className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 15rem), 1fr))' }} data-testid="sht-formats">
          {formats.map((f) => {
            const on = draft.format === f.key
            return (
              <li key={f.key} className="min-w-0">
                <button type="button" aria-pressed={on} onClick={() => set({ format: f.key })} className={`tap flex h-full min-h-16 w-full min-w-0 flex-col items-start gap-0.5 rounded-(--radius-control) border-2 px-3.5 py-2.5 text-left ${on ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-white hover:border-brand-300'}`} data-testid={`sht-format-${f.key}`}>
                  <span className="flex w-full flex-wrap items-baseline gap-x-2">
                    <span className="t-body font-bold break-keep text-slate-900">{f.name}</span>
                    <span className="t-sub text-slate-500">{f.seconds}</span>
                  </span>
                  <span className="t-sub break-keep text-slate-600">{f.how}</span>
                </button>
              </li>
            )
          })}
        </ul>
        {fmt && (
          <div className="flex flex-col gap-2 rounded-(--radius-control) border border-brand-200 bg-brand-50/60 px-3 py-3" data-testid="sht-format-detail">
            <p className="t-sub break-keep text-slate-700">
              <b>왜 되나</b> {fmt.why}
            </p>
            {fmt.caution && (
              <p className="t-sub flex items-start gap-1.5 break-keep text-warning-800">
                <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> {fmt.caution}
              </p>
            )}
            <div>
              <Button variant="secondary" onClick={() => start({ ...exampleOf(fmt, draft.platform), hashtags: fmt.exampleTags, source: 'example' })} data-testid="sht-use-example">
                <FilePlus2 aria-hidden="true" className="size-4" /> 예시 대본으로 시작
              </Button>
            </div>
          </div>
        )}
      </Surface>

      <Surface className="flex flex-col gap-3">
        <StepTitle n="4">무엇에 대해?</StepTitle>
        <input value={draft.topic} onChange={(e) => set({ topic: e.target.value })} placeholder="예: 창업 3년 안 벤처확인 세금" aria-label="소재" className="t-body min-h-12 w-full min-w-0 rounded-(--radius-control) border border-slate-300 bg-white px-3" data-testid="sht-topic" />
        <div className="flex flex-wrap gap-1.5">
          {QUICK_TOPICS.map((t) => (
            <button key={t} type="button" onClick={() => set({ topic: t })} className={chip(draft.topic === t)} data-testid="sht-topic-pick">
              {t}
            </button>
          ))}
        </div>
        <FactsBox value={draft.facts} onChange={(v) => set({ facts: v })} testPrefix="sht" what="영상" />
        {aiOk && (
          <div className="flex flex-col gap-2">
            <Button variant="primary" onClick={() => void runAi()} disabled={ai.busy} className="w-full sm:w-auto" data-testid="sht-ai">
              <Sparkles aria-hidden="true" className="size-4" /> {ai.busy ? 'AI가 쓰는 중…' : 'AI로 대본 2개 쓰기'}
            </Button>
            {ai.error && (
              <p role="alert" className="t-sub break-keep text-danger-700" data-testid="sht-ai-error">
                {ai.error}
              </p>
            )}
            {ai.drafts.length > 0 && (
              <ul className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 22rem), 1fr))' }} data-testid="sht-ai-drafts">
                {ai.drafts.map((d, i) => (
                  <AiDraftCard key={i} d={d} draft={draft} facts={factsText} onUse={() => start({ script: d.script, caption: d.caption, hashtags: d.hashtags, source: 'ai', checks: draft.checks, ...(d.format ? { format: d.format } : {}) })} />
                ))}
              </ul>
            )}
          </div>
        )}
      </Surface>

      <Surface className="flex flex-col gap-3">
        <div id="sht-editor" className="scroll-mt-24">
          <StepTitle n="5">고치고 확인하기</StepTitle>
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]" data-testid="sht-editor">
          <div className="flex min-w-0 flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="t-sub font-semibold text-slate-700">대본{fmt ? ` — ${fmt.name}` : ''}</span>
                <span className="t-sub font-bold tabular-nums text-slate-700" data-testid="sht-seconds">
                  {draft.script.trim() ? `약 ${lint.seconds}초 · 첫마디 ${lint.firstWords.replace(/\s/g, '').length}자` : ''}
                </span>
              </span>
              <textarea value={draft.script} onChange={(e) => set({ script: e.target.value })} rows={11} placeholder={'[0:00] 첫마디 10자 안팎  (화면 큰 글자: …)\n[0:03] 딱 세 가지만 보세요.\n[0:06] 첫째, …'} className="t-body w-full min-w-0 rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2 leading-relaxed" data-testid="sht-script" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="t-sub font-semibold text-slate-700">캡션 {draft.platform === 'tiktok' ? '(한 줄)' : draft.aim === 'convert' ? '(200자 안팎 · 요약 3줄 + 키워드)' : '(100자 안팎)'}</span>
              <textarea value={draft.caption} onChange={(e) => set({ caption: e.target.value })} rows={3} className="t-body w-full min-w-0 rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2" data-testid="sht-caption" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="t-sub font-semibold text-slate-700">해시태그 {draft.platform === 'tiktok' ? '(3~5개)' : '(0~3개)'}</span>
              <input value={draft.hashtags} onChange={(e) => set({ hashtags: e.target.value })} placeholder="#벤처기업확인 #창업" className="t-body min-h-12 w-full min-w-0 rounded-(--radius-control) border border-slate-300 bg-white px-3" data-testid="sht-tags" />
            </label>
            {draft.checks.length > 0 && (
              <div className="rounded-(--radius-control) border border-warning-200 bg-warning-50 px-3 py-2" data-testid="sht-checks">
                <p className="t-sub font-semibold text-warning-900">찍기 전 확인할 것(AI 가 적음)</p>
                <ul className="t-sub list-disc pl-5 break-keep text-warning-900">
                  {draft.checks.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => copy(draft.script.trim(), '대본을')} disabled={!draft.script.trim()} data-testid="sht-copy-script">
                <ClipboardCopy aria-hidden="true" className="size-4" /> 대본 복사
              </Button>
              <Button variant="secondary" onClick={() => copy(`${draft.caption.trim()}\n\n${draft.hashtags.trim()}`.trim(), '캡션을')} disabled={!draft.caption.trim() && !draft.hashtags.trim()} data-testid="sht-copy-caption">
                <ClipboardCopy aria-hidden="true" className="size-4" /> 캡션 복사
              </Button>
              {!readOnly && (
                <>
                  <Button variant="secondary" onClick={() => void save(false)} disabled={!draft.script.trim() || saving} data-testid="sht-save">
                    <Save aria-hidden="true" className="size-4" /> 저장
                  </Button>
                  <Button variant="primary" onClick={() => void save(true)} disabled={!draft.script.trim() || saving} data-testid="sht-posted">
                    <Send aria-hidden="true" className="size-4" /> 올렸어요 · 기록표로
                  </Button>
                </>
              )}
              <Button variant="ghost" onClick={() => (draft.script.trim() && !window.confirm('지금 대본을 비우고 새로 만들까요?') ? undefined : (setDraft((d) => ({ ...EMPTY, platform: d.platform, aim: d.aim })), setAi({ busy: false, error: '', drafts: [] })))} data-testid="sht-new">
                새로
              </Button>
            </div>
            {draft.topic.trim() && (
              <Button variant="ghost" className="self-start" onClick={() => navigate(`/marketing/threads?topic=${encodeURIComponent(draft.topic.trim())}`)} data-testid="sht-to-threads">
                같은 소재로 스레드 글 쓰기 →
              </Button>
            )}
            {draft.format === 'comment' && <ShareKit testId="sht-share" />}
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="t-sub font-semibold text-slate-700">규칙 검사</span>
              {lint.bad > 0 ? <Badge tone="danger">고칠 것 {lint.bad}</Badge> : <Badge tone="success">고칠 것 0</Badge>}
              {lint.warn > 0 && <Badge tone="warning">볼 것 {lint.warn}</Badge>}
            </div>
            <LintList lines={draft.script.trim() ? lint.lines : []} testId="sht-lint" />
            {!draft.script.trim() && <p className="t-sub break-keep text-slate-500">대본을 쓰면 여기서 바로 확인해요.</p>}
          </div>
        </div>
      </Surface>
    </div>
  )
}

function AiDraftCard({ d, draft, facts, onUse }: { d: ShortDraft; draft: Draft; facts: string; onUse: () => void }) {
  const lint = lintShort({ platform: draft.platform, aim: draft.aim, script: d.script, caption: d.caption, hashtags: d.hashtags, facts })
  const f = d.format ? formatOf(d.format) : undefined
  return (
    <li className="flex min-w-0 flex-col gap-2 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-3" data-testid="sht-ai-draft">
      <div className="flex flex-wrap items-center gap-1.5">
        {f && <Badge tone="brand">{f.name}</Badge>}
        <Badge tone={lint.bad ? 'danger' : 'success'}>
          약 {lint.seconds}초 · 고칠 것 {lint.bad}
        </Badge>
      </div>
      <p className="t-sub max-h-56 overflow-y-auto break-keep whitespace-pre-line text-slate-800">{d.script}</p>
      {d.caption && <p className="t-sub break-keep text-slate-500">캡션: {d.caption}</p>}
      <Button variant="secondary" onClick={onUse} data-testid="sht-ai-use">
        이 대본으로 고치기
      </Button>
    </li>
  )
}

/* ------------------------------------------------------------------ */
/* 기록표                                                              */
/* ------------------------------------------------------------------ */

function RecordsPanel({ store, readOnly, onOpen }: { store: Store; readOnly: boolean; onOpen: (p: ShortPost) => void }) {
  const { showToast } = useToast()
  const today = todayLocalDate()
  const posted = store.posts.filter((p) => p.status === 'posted')
  const drafts = store.posts.filter((p) => p.status === 'draft')
  const recs = formatRecords(store.posts)
  const mix = weekMix(store.posts, today)
  const inquiries = posted.reduce((a, p) => a + (p.stats.inquiries ?? 0), 0)
  if (!store.loaded) return <p className="t-sub text-slate-500">기록을 읽는 중…</p>
  return (
    <div className="flex flex-col gap-4" data-testid="sht-records">
      <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 9.5rem), 1fr))' }}>
        <div data-testid="sht-rec-count" className="contents">
          <MetricTile label="올린 영상" value={`${posted.length}개`} />
        </div>
        <MetricTile label="이번 주 틱톡" value={`${mix.tiktok.reach + mix.tiktok.convert}개`} hint={`많이 보이게 ${mix.tiktok.reach} · 문의 ${mix.tiktok.convert}`} hintOnMobile />
        <MetricTile label="이번 주 릴스" value={`${mix.reels.reach + mix.reels.convert}개`} hint={`많이 보이게 ${mix.reels.reach} · 댓글 ${mix.reels.convert}`} hintOnMobile />
        <MetricTile label="문의" value={`${inquiries}건`} />
      </div>
      <Surface className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="t-section min-w-[12rem] flex-1 break-keep text-slate-900">우리 계정에서 되는 형식</h2>
          <Button size="sm" variant="ghost" onClick={() => downloadText(`릴스-틱톡-기록표-${today}.csv`, `﻿${shortsCsv(store.posts)}`, 'text/csv')} disabled={!posted.length} data-testid="sht-rec-csv">
            <Download aria-hidden="true" className="size-4" /> CSV
          </Button>
        </div>
        <p className="t-sub break-keep text-slate-600">점수 = 좋아요 + 댓글×3 (실측에서 잘 된 · 안 된 영상을 가른 계산). 형식마다 3개 넘게 쌓이면 그 숫자를 먼저 믿어요.</p>
        {recs.length ? (
          <ul className="flex flex-col divide-y divide-slate-100" data-testid="sht-rec-formats">
            {recs.map((r) => (
              <li key={r.key} className="flex flex-col gap-0.5 py-2" data-testid="sht-rec-format" data-key={r.key}>
                <span className="t-body font-semibold break-keep text-slate-900">{r.label}</span>
                <span className="t-sub flex flex-wrap items-center gap-x-3 gap-y-0.5 tabular-nums text-slate-600">
                  <span>{r.posts}개</span>
                  <b className="text-slate-900">평균 {r.avgScore == null ? '—' : r.avgScore.toLocaleString('ko-KR')}</b>
                  <span>조회 {r.avgViews == null ? '—' : r.avgViews.toLocaleString('ko-KR')}</span>
                  {r.inquiries > 0 && <span>문의 {r.inquiries}</span>}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="t-sub rounded-(--radius-control) bg-slate-50 px-3 py-2 break-keep text-slate-600">아직 올린 영상이 없어요 — [오늘 만들 영상] 에서 만들고 [올렸어요] 를 누르면 여기에 쌓입니다.</p>
        )}
      </Surface>
      {posted.length > 0 && (
        <section className="flex flex-col gap-2" aria-label="올린 영상">
          <h2 className="t-section break-keep text-slate-900">올린 영상 — 숫자 적기</h2>
          <ul className="flex flex-col gap-2" data-testid="sht-rec-list">
            {posted.map((p) => (
              <RecordItem key={p.id} p={p} store={store} readOnly={readOnly} onOpen={() => onOpen(p)} showToast={showToast} />
            ))}
          </ul>
        </section>
      )}
      {drafts.length > 0 && (
        <section className="flex flex-col gap-2" aria-label="만들다 둔 영상">
          <h2 className="t-section break-keep text-slate-900">만들다 둔 영상 {drafts.length}</h2>
          <ul className="flex flex-col gap-2" data-testid="sht-rec-drafts">
            {drafts.map((p) => (
              <RecordItem key={p.id} p={p} store={store} readOnly={readOnly} onOpen={() => onOpen(p)} showToast={showToast} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function RecordItem({ p, store, readOnly, onOpen, showToast }: { p: ShortPost; store: Store; readOnly: boolean; onOpen: () => void; showToast: (m: string) => void }) {
  const f = p.format ? formatOf(p.format) : undefined
  const score = shortScore(p.stats)
  const rate = keepRate(p.stats)
  const put = (part: Partial<ShortPost>) => store.patch(p.id, part).catch((e: unknown) => showToast(e instanceof Error && e.message ? `저장하지 못했어요 — ${e.message}` : '저장하지 못했어요.'))
  return (
    <li className="flex min-w-0 flex-col gap-2 rounded-(--radius-panel) border border-slate-200 bg-white px-3 py-3 sm:px-4" data-testid="sht-rec-item" data-id={p.id}>
      <div className="flex flex-wrap items-center gap-1.5">
        {p.status === 'posted' ? <Badge tone="success">{p.postedOn.slice(5).replace('-', '/')} 올림</Badge> : <Badge>만들다 둠</Badge>}
        <Badge tone="brand">{p.platform === 'reels' ? '릴스' : '틱톡 · 쇼츠'}</Badge>
        {f && <Badge>{f.name}</Badge>}
        {p.aim && <Badge>{aimLabel(p.platform, p.aim)}</Badge>}
      </div>
      <p className="t-body line-clamp-2 font-semibold break-keep text-slate-900">{firstWordsOf(p.script)}</p>
      {(score != null || rate != null) && (
        <p className="t-sub flex flex-wrap gap-x-3 font-bold tabular-nums text-slate-900" data-testid="sht-rec-score">
          {score != null && <span>점수 {score.toLocaleString('ko-KR')}</span>}
          {rate != null && <span>저장 · 공유율 {rate}%</span>}
        </p>
      )}
      {p.status === 'posted' && <StatInputs keys={SHORT_STAT_KEYS} values={p.stats} disabled={readOnly} onSet={(k, v) => void put({ stats: { ...p.stats, [k]: v } })} testPrefix="sht" />}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" onClick={onOpen} data-testid="sht-rec-open">
          열어서 고치기
        </Button>
        {!readOnly && p.status === 'draft' && (
          <Button size="sm" variant="secondary" onClick={() => void put({ status: 'posted', postedOn: todayLocalDate() })} data-testid="sht-rec-post">
            <Send aria-hidden="true" className="size-4" /> 올렸어요
          </Button>
        )}
        {!readOnly && <DeleteTwice onDelete={() => void store.remove(p.id).catch(() => showToast('지우지 못했어요 — 다시 눌러 주세요.'))} testPrefix="sht-rec" what="이 영상을" />}
      </div>
    </li>
  )
}

/* ------------------------------------------------------------------ */
/* 형식 · 공식                                                          */
/* ------------------------------------------------------------------ */

const COMMENT_WORKS: ReadonlyArray<[string, string]> = [
  ['받는 것이 크고 구체적(목록 · 공식 · 서류 목록)', '"정리해 드림" · 목차만 · 무료 상담'],
  ['대상이 넓음("사장님 누구나")', '대상이 좁음("연구소 보유 법인")'],
  ['20초 안팎 · 숫자가 첫 화면에', '40초 넘는 글자 영상 · 숫자 없음'],
  ['키워드가 쉬움(숫자 하나 · "아무 댓글")', '신청 폼 · DM · 링크까지 여러 단계'],
]

function GuidePanel({ onUse }: { onUse: (f: ShortFormat) => void }) {
  return (
    <div className="flex flex-col gap-4" data-testid="sht-guide">
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 20rem), 1fr))' }}>
        <Surface className="flex flex-col gap-1.5">
          <h2 className="t-section break-keep text-slate-900">틱톡 · 유튜브 쇼츠</h2>
          <ul className="t-body flex list-disc flex-col gap-1 pl-5 break-keep text-slate-800">
            <li>정보형 40~70초 (답을 끝으로) · 이미지형 25~30초</li>
            <li>말로 설명 — 1초에 6~7자</li>
            <li>리스트 · 화면 시연 · 대화형</li>
            <li>많이 보이게: 끝에 권유 없이 / 문의로: 끝 한 줄</li>
            <li>캡션 한 줄 + 해시태그 3~5개</li>
          </ul>
        </Surface>
        <Surface className="flex flex-col gap-1.5">
          <h2 className="t-section break-keep text-slate-900">인스타 릴스</h2>
          <ul className="t-body flex list-disc flex-col gap-1 pl-5 break-keep text-slate-800">
            <li>20~25초 · 한 화면 목록은 6~15초</li>
            <li>말 없이 글자만도 됨 (말을 넣으면 첫 문장에 숫자)</li>
            <li>한 화면 목록 · 화면 시연 · 짧은 글자 정보</li>
            <li>많이 보이게: 권유 없이 / 댓글 받기: "키워드 댓글" 하나</li>
            <li>캡션 100자(댓글형 200자) · 해시태그 0~3개</li>
          </ul>
        </Surface>
      </div>
      <h2 className="t-section break-keep text-slate-900">형식 5가지</h2>
      <ul className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 20rem), 1fr))' }} data-testid="sht-guide-formats">
        {SHORT_FORMATS.map((f) => (
          <li key={f.key} className="min-w-0">
            <Surface className="flex h-full flex-col gap-2" as="article">
              <div className="flex flex-wrap items-baseline gap-x-2" data-testid="sht-guide-card" data-key={f.key}>
                <h3 className="t-body font-bold break-keep text-slate-900">{f.name}</h3>
                <span className="t-sub text-slate-500">{f.seconds}</span>
              </div>
              <p className="t-sub break-keep text-slate-600">{f.platforms.map((p) => (p === 'reels' ? '릴스' : '틱톡 · 쇼츠')).join(' · ')}</p>
              <p className="t-sub break-keep text-slate-800">{f.how}</p>
              <p className="t-sub break-keep text-slate-700">
                <b>왜</b> {f.why}
              </p>
              <details className="rounded-(--radius-control) bg-slate-50 px-3 py-2">
                <summary className="tap t-sub cursor-pointer font-semibold text-slate-700">예시 대본 보기</summary>
                <p className="t-sub mt-1 break-keep whitespace-pre-line text-slate-800">{f.example}</p>
                <p className="t-sub mt-2 break-keep whitespace-pre-line text-slate-500">캡션: {f.exampleCaption}</p>
              </details>
              <div className="mt-auto">
                <Button variant="secondary" onClick={() => onUse(f)} data-testid="sht-guide-use">
                  이 형식으로 만들기
                </Button>
              </div>
            </Surface>
          </li>
        ))}
      </ul>
      <Surface className="flex flex-col gap-2">
        <h2 className="t-section break-keep text-slate-900">릴스 "댓글 받기" 가 통하는 조건</h2>
        <ShareKit testId="sht-guide-share" />
        <ul className="flex flex-col divide-y divide-slate-100" data-testid="sht-comment-works">
          {COMMENT_WORKS.map(([yes, no]) => (
            <li key={yes} className="flex flex-col gap-0.5 py-2">
              <span className="t-sub break-keep text-success-800">○ {yes}</span>
              <span className="t-sub break-keep text-slate-500">✕ {no}</span>
            </li>
          ))}
        </ul>
        <p className="t-sub break-keep text-slate-600">자료는 실제로 만든 뒤에만 겁니다.</p>
      </Surface>
      <Surface className="flex flex-col gap-2">
        <h2 className="t-section break-keep text-slate-900">이렇게 말고 → 이렇게</h2>
        <p className="t-sub break-keep text-slate-600">대표님이 정한 원칙 · 넣지 말 것 — 규칙 검사가 이 표대로 알려 드려요.</p>
        <RewriteTable testId="sht-rewrites" />
      </Surface>
    </div>
  )
}
