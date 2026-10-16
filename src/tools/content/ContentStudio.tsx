/**
 * 홍보 글 만들기 화면 (D-203) — 업체 하나로 블로그 · 짧은 영상 · 긴 영상 · 카드뉴스 · 카톡 · 플레이스 소개 · 키워드.
 *
 * 순서: 업체 홍보 정보(업체 기록에서 저절로 · 고치기) → 먼저 만들 것 3개(누르면 바로 글) → 직접 고르기(형식 · 키워드 · 주제)
 *      → 결과(복사 · 다른 안 · 고치기 · 보관함 · 업체 기록에 붙이기 · 대표는 AI 작업실로) → 보관함.
 * 규칙 + 업종 견본으로 채우며 'AI' 가 아니다. 업체마다 다른 내용은 [대괄호] 로 비워 두고 점검이 알린다.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Check, ChevronRight, Copy, Info, PencilLine, RefreshCw, Save, Sparkles, Star, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { Badge, BottomSheet } from '../../components/ui/primitives'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { useToast } from '../../components/ui/toastContext'
import { todayLocalDate } from '../../lib/appClock'
import { useOwnerAiAccess } from '../../auth/ownerAiAccess'
import {
  CONTENT_KINDS,
  CONTENT_LIB,
  KIND_HINT,
  KIND_LABEL,
  NEEDS_TOPIC,
  PURPOSE_LABEL,
  TONE_LABEL,
  TOPIC_LABEL,
  buildProfile,
  draftChecks,
  firstPicks,
  keywordGroups,
  latestByRoot,
  mainKeyword,
  makeDraft,
  plainText,
  topicsFor,
  type ContentItem,
  type ContentKind,
  type ContentPick,
  type Draft,
  type DraftBlock,
  type KakaoPurpose,
  type ProfileOverrides,
  type Tone,
  type TopicType,
} from '../../services/contentStudio'
import { INDUSTRIES, type IndustryKey } from '../../services/siteBuilder'
import type { ClientOpsRecord } from '../../types/clientOps'
import { copyToClipboard, useOwnerAiIdentity, useOwnerAiRepo } from '../../pages/ownerAi/shared'
import { ToolResultAttach } from '../shared/ToolResultAttach'
import { inputClass } from '../homepage/BlockFields'
import { sendDraftToOwnerAi } from './aiHandoff'
import type { ContentStore } from './useContentStore'

const card = 'rounded-(--radius-panel) border border-slate-200 bg-white'
const PURPOSES: KakaoPurpose[] = ['news', 'event', 'season', 'thanks']

function chip(on: boolean): string {
  return `tap t-body min-h-11 rounded-full border px-4 font-semibold ${on ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400'}`
}

/** 화면에 띄운 글 — 새로 만든 것(item 없음) 또는 보관함에서 연 것 */
interface Shown {
  draft: Draft
  item: ContentItem | null
}

export function ContentStudio({ record, store }: { record: ClientOpsRecord; store: ContentStore }) {
  const today = todayLocalDate()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const ownerAi = useOwnerAiAccess()
  const aiRepo = useOwnerAiRepo()
  const aiIdent = useOwnerAiIdentity()
  const { profile, source } = useMemo(() => buildProfile(record, today, store.overrides, store.site), [record, today, store.overrides, store.site])

  const [kind, setKind] = useState<ContentKind>('blog')
  const [keyword, setKeyword] = useState(() => mainKeyword(profile))
  const [topicType, setTopicType] = useState<TopicType>('tips')
  const [pages, setPages] = useState<5 | 7>(5)
  const [purpose, setPurpose] = useState<KakaoPurpose>('news')
  const [variant, setVariant] = useState(0)
  const [shown, setShown] = useState<Shown | null>(null)
  const [editing, setEditing] = useState<DraftBlock[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const resultRef = useRef<HTMLDivElement | null>(null)

  const topics = useMemo(() => topicsFor(profile, keyword, today, variant), [profile, keyword, today, variant])
  const made = useMemo(() => store.items.map((i) => ({ kind: i.kind, topicType: i.input.topicType, purpose: i.input.purpose, createdAt: i.createdAt })), [store.items])
  const picks = useMemo(() => firstPicks(profile, today, made), [profile, today, made])
  const findWords = useMemo(() => keywordGroups(profile).find((g) => g.key === 'find')?.words.slice(0, 4) ?? [], [profile])

  // 지역 · 대표 상품을 고치면 키워드 칸도 따라간다(사람이 직접 친 키워드는 그대로)
  const lastMain = useRef(mainKeyword(profile))
  useEffect(() => {
    const m = mainKeyword(profile)
    if (m !== lastMain.current) {
      // 직접 고른 키워드도 그 안의 지역 · 상품 부분은 새 값으로('화성 정밀 금속부품 추천' → '동탄 정밀가공 부품 추천')
      const old = lastMain.current
      setKeyword((k) => (old && k.includes(old) ? k.replace(old, m) : k))
      lastMain.current = m
    }
  }, [profile])

  // 말투를 바꾸면 화면의 새 글(저장 전 · 고치기 전)도 같은 요청으로 다시 만든다
  const lastTone = useRef(profile.tone)
  useEffect(() => {
    if (profile.tone === lastTone.current) return
    lastTone.current = profile.tone
    setShown((cur) => {
      if (!cur || cur.item) return cur
      const inp = cur.draft.input
      const ts = topicsFor(profile, inp.keyword ?? '', today, inp.variant)
      return { draft: makeDraft(profile, { kind: cur.draft.kind, keyword: inp.keyword, topic: ts.find((t) => t.type === inp.topicType), pages: inp.pages, purpose: inp.purpose, variant: inp.variant }, today), item: null }
    })
    setEditing(null)
  }, [profile, today])

  // 고치는 중에 창을 닫으면 묻는다
  const dirty = !!editing && !!shown && JSON.stringify(editing) !== JSON.stringify(shown.draft.blocks)
  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  const show = (d: Draft, item: ContentItem | null = null) => {
    setShown({ draft: d, item })
    setEditing(null)
    // 창만 굴린다 — scrollIntoView 는 overflow 가 숨겨진 바깥 상자까지 굴려서 머리줄 · 메뉴가 밀렸다
    window.setTimeout(() => {
      const el = resultRef.current
      if (!el) return
      const top = el.getBoundingClientRect().top + window.scrollY - 88
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
    }, 60)
  }

  const generate = (over: Partial<{ kind: ContentKind; topicType: TopicType; purpose: KakaoPurpose; variant: number; pages: 5 | 7 }> = {}) => {
    const k = over.kind ?? kind
    const v = over.variant ?? variant
    const tt = over.topicType ?? topicType
    const ts = topicsFor(profile, keyword, today, v)
    const t = ts.find((x) => x.type === tt) ?? ts[0]
    show(makeDraft(profile, { kind: k, keyword, topic: t, pages: over.pages ?? pages, purpose: over.purpose ?? purpose, variant: v }, today))
  }

  const onPick = (p: ContentPick) => {
    setKind(p.kind)
    if (p.topicType) setTopicType(p.topicType)
    if (p.purpose) setPurpose(p.purpose)
    setVariant(0)
    generate({ kind: p.kind, topicType: p.topicType, purpose: p.purpose, variant: 0 })
  }

  const blocks = editing ?? shown?.draft.blocks ?? []
  const checks = shown ? draftChecks(shown.draft.kind, blocks, profile.industry, shown.draft.input.keyword) : []
  const text = shown ? plainText(shown.draft.kind, blocks) : ''

  const copy = async (t: string, what = '글') => showToast((await copyToClipboard(t)) ? `${what}을 복사했어요.` : '복사하지 못했어요 — 글을 길게 눌러 복사해 주세요.')

  const save = async () => {
    if (!shown || busy) return
    setBusy(true)
    try {
      if (shown.item) {
        const v = await store.saveVersion(shown.item, blocks)
        if (!v) return showToast('저장하지 못했어요. 적은 글은 화면에 그대로 있어요 — 다시 눌러 주세요.')
        setShown({ draft: { ...shown.draft, blocks: v.blocks }, item: v })
        setEditing(null)
        showToast(v.id === shown.item.id ? '바뀐 곳이 없어요.' : `고친 글을 ${v.version}판으로 저장했어요(이전 판도 남아 있어요).`)
      } else {
        const r = await store.addDraft(shown.draft, blocks)
        if (!r) return showToast('저장하지 못했어요. 적은 글은 화면에 그대로 있어요 — 다시 눌러 주세요.')
        setShown({ draft: { ...shown.draft, blocks: r.item.blocks }, item: r.item })
        setEditing(null)
        showToast(r.dup ? '같은 글이 이미 보관함에 있어요.' : '보관함에 저장했어요.')
      }
    } finally {
      setBusy(false)
    }
  }

  const toAi = async () => {
    if (!shown || busy) return
    setBusy(true)
    try {
      const r = await sendDraftToOwnerAi(aiRepo, aiIdent, record, shown.draft.title, text)
      showToast(r.added ? 'AI 작업실 자료에 넣었어요 — 자유 AI 작업에 "이 글을 다듬어 줘" 라고 적어 주세요.' : '이미 AI 작업실 자료에 있는 글이에요.')
      navigate(`/ops/clients/${encodeURIComponent(record.id)}?tab=ai`)
    } catch (e) {
      showToast(e instanceof Error && /0021|설정/.test(e.message) ? 'AI 작업실 DB 설정이 필요해요.' : 'AI 작업실에 넣지 못했어요. 잠시 뒤 다시 눌러 주세요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-4" data-testid="content-studio">
      <ProfileCard record={record} profile={profile} source={source} onEdit={() => setProfileOpen(true)} />

      {/* 먼저 만들 것 — 눈에 잘 띄게 */}
      <section className="rounded-(--radius-panel) border-2 border-brand-300 bg-brand-50 p-4 sm:p-5" data-testid="content-picks">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="t-section flex items-center gap-2 text-brand-900">
            <Sparkles className="size-5 text-brand-600" aria-hidden="true" />
            {record.companyName}에 먼저 만들 것
          </h2>
          <span className="t-sub break-keep text-brand-800">누르면 이 업체 글이 바로 나와요</span>
        </div>
        <ul className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
          {picks.map((p, i) => (
            <li key={p.key}>
              <button type="button" onClick={() => onPick(p)} className="tap flex h-full w-full flex-col items-start gap-1 rounded-(--radius-control) border border-brand-200 bg-white p-3 text-left hover:border-brand-500" data-testid="content-pick" data-key={p.key} data-kind={p.kind}>
                <span className="flex w-full items-center gap-2">
                  <span className="t-meta flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-600 font-bold text-white">{i + 1}</span>
                  <span className="t-body min-w-0 flex-1 font-semibold break-keep text-slate-900">{p.label}</span>
                  <ChevronRight className="size-4 shrink-0 text-brand-600" aria-hidden="true" />
                </span>
                <span className="t-sub break-keep text-slate-600">{p.why}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:items-start">
        {/* 직접 고르기 */}
        <section className={`${card} flex flex-col gap-4 p-4 sm:p-5`} data-testid="content-maker">
          <h2 className="t-section text-slate-900">직접 고르기</h2>
          <fieldset className="flex flex-col gap-2">
            <legend className="t-sub mb-1 font-semibold text-slate-700">무엇을 만들까요?</legend>
            <div className="grid grid-cols-2 gap-2">
              {CONTENT_KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={kind === k}
                  onClick={() => setKind(k)}
                  data-testid="content-kind"
                  data-kind={k}
                  className={`tap flex min-h-[3.75rem] flex-col items-start justify-center rounded-(--radius-control) border px-3 py-2 text-left ${kind === k ? 'border-brand-600 bg-brand-50' : 'border-slate-200 bg-white hover:border-slate-400'}`}
                >
                  <span className={`t-body font-semibold break-keep ${kind === k ? 'text-brand-800' : 'text-slate-800'}`}>{KIND_LABEL[k]}</span>
                  <span className="t-meta break-keep text-slate-500">{KIND_HINT[k]}</span>
                </button>
              ))}
            </div>
          </fieldset>

          {NEEDS_TOPIC.has(kind) && (
            <>
              <label className="flex flex-col gap-1.5">
                <span className="t-sub font-semibold text-slate-700">키워드(손님이 찾는 말)</span>
                <input className={inputClass} value={keyword} maxLength={40} onChange={(e) => setKeyword(e.target.value)} data-testid="content-keyword" />
              </label>
              <div className="-mt-2 flex flex-wrap gap-1.5">
                {findWords.map((w) => (
                  <button key={w} type="button" onClick={() => setKeyword(w)} className={`tap t-sub min-h-9 rounded-full border px-3 ${keyword === w ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600'}`}>
                    {w}
                  </button>
                ))}
              </div>
              <fieldset className="flex flex-col gap-1.5">
                <legend className="t-sub mb-1 font-semibold text-slate-700">주제</legend>
                {topics.map((t) => (
                  <label key={t.type} className={`tap flex cursor-pointer items-start gap-2 rounded-(--radius-control) border px-3 py-2 ${topicType === t.type ? 'border-brand-600 bg-brand-50' : 'border-slate-200'}`} data-testid="content-topic" data-type={t.type}>
                    <input type="radio" name="topic" className="mt-1.5 size-4 accent-brand-600" checked={topicType === t.type} onChange={() => setTopicType(t.type)} />
                    <span className="min-w-0">
                      <span className="t-meta font-semibold text-brand-700">{TOPIC_LABEL[t.type]}</span>
                      <span className="t-body block break-keep text-slate-800">{t.title}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
            </>
          )}
          {kind === 'cards' && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="t-sub font-semibold text-slate-700">장 수</span>
              {([5, 7] as const).map((n) => (
                <button key={n} type="button" aria-pressed={pages === n} onClick={() => setPages(n)} className={chip(pages === n)}>
                  {n}장
                </button>
              ))}
            </div>
          )}
          {kind === 'kakao' && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="t-sub w-full font-semibold text-slate-700">무슨 소식인가요?</span>
              {PURPOSES.map((p) => (
                <button key={p} type="button" aria-pressed={purpose === p} onClick={() => setPurpose(p)} className={chip(purpose === p)} data-testid="content-purpose" data-purpose={p}>
                  {PURPOSE_LABEL[p]}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <span className="t-sub w-full font-semibold text-slate-700">말투</span>
            {(['friendly', 'formal'] as Tone[]).map((t) => (
              <button key={t} type="button" aria-pressed={profile.tone === t} onClick={() => void store.saveOverrides({ ...store.overrides, tone: t })} className={chip(profile.tone === t)} data-testid="content-tone" data-tone={t}>
                {TONE_LABEL[t]}
              </button>
            ))}
          </div>
          <Button variant="primary" onClick={() => generate()} data-testid="content-make">
            <Sparkles className="size-4" aria-hidden="true" />
            {KIND_LABEL[kind]} 만들기
          </Button>
          <p className="t-meta break-keep text-slate-500">업체 기록과 업종 견본으로 채워요(규칙 · 'AI' 아님). 업체마다 다른 곳은 [대괄호] 로 비워 둬요.</p>
        </section>

        {/* 결과 */}
        <div ref={resultRef}>
          {shown ? (
            <section className={`${card} flex flex-col gap-3 p-4 sm:p-5`} data-testid="content-result" data-kind={shown.draft.kind}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="brand">{KIND_LABEL[shown.draft.kind]}</Badge>
                {shown.item && <Badge tone="success">보관함 · {shown.item.version}판</Badge>}
                {shown.draft.input.topicType && <Badge>{TOPIC_LABEL[shown.draft.input.topicType]}</Badge>}
              </div>
              <h2 className="t-section break-keep text-slate-900" data-testid="content-result-title">{shown.draft.title}</h2>

              {(checks.length > 0 || shown.draft.notes.length > 0) && (
                <ul className="flex flex-col gap-1.5" data-testid="content-checks">
                  {checks.map((c) => (
                    <li key={c.key} data-level={c.level} className={`t-sub flex items-start gap-2 rounded-(--radius-control) px-3 py-2 break-keep ${c.level === 'must' ? 'bg-danger-50 text-danger-700' : c.level === 'should' ? 'bg-warning-50 text-warning-700' : 'bg-slate-50 text-slate-600'}`}>
                      {c.level === 'info' ? <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
                      <span className="min-w-0">{c.text}</span>
                    </li>
                  ))}
                  {shown.draft.notes
                    .filter((n) => !checks.some((c) => c.text === n))
                    .map((n) => (
                      <li key={n} data-level="info" className="t-sub flex items-start gap-2 rounded-(--radius-control) bg-slate-50 px-3 py-2 break-keep text-slate-600">
                        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                        <span className="min-w-0">{n}</span>
                      </li>
                    ))}
                </ul>
              )}

              <div className="flex flex-wrap gap-2">
                <Button variant="primary" size="sm" onClick={() => void copy(text)} data-testid="content-copy">
                  <Copy className="size-4" aria-hidden="true" />
                  전체 복사
                </Button>
                {!shown.item && (
                  <Button
                    size="sm"
                    onClick={() => {
                      const v = variant + 1
                      setVariant(v)
                      const tt = shown.draft.input.topicType ?? topicType
                      const ts = topicsFor(profile, shown.draft.input.keyword ?? keyword, today, v)
                      show(makeDraft(profile, { kind: shown.draft.kind, keyword: shown.draft.input.keyword ?? keyword, topic: ts.find((x) => x.type === tt) ?? ts[0], pages: shown.draft.input.pages, purpose: shown.draft.input.purpose, variant: v }, today))
                    }}
                    data-testid="content-again"
                  >
                    <RefreshCw className="size-4" aria-hidden="true" />
                    다른 안
                  </Button>
                )}
                <Button size="sm" onClick={() => setEditing(editing ? null : shown.draft.blocks.map((b) => ({ ...b })))} data-testid="content-edit" aria-pressed={!!editing}>
                  <PencilLine className="size-4" aria-hidden="true" />
                  {editing ? '고치기 그만' : '고치기'}
                </Button>
                <Button size="sm" onClick={() => void save()} disabled={busy || (!!shown.item && !dirty)} data-testid="content-save">
                  <Save className="size-4" aria-hidden="true" />
                  {shown.item ? (dirty ? '고친 판으로 저장' : '저장됨') : '보관함에 저장'}
                </Button>
                {ownerAi === 'yes' && (
                  <Button size="sm" variant="ghost" onClick={() => void toAi()} disabled={busy} data-testid="content-to-ai">
                    <Sparkles className="size-4 text-violet-600" aria-hidden="true" />
                    AI 작업실에서 다듬기
                  </Button>
                )}
              </div>

              <ol className="flex flex-col gap-2" data-testid="content-blocks">
                {blocks.map((b, i) => (
                  <li key={i} className="rounded-(--radius-control) border border-slate-200 bg-slate-50/60 p-3" data-testid="content-block">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        {(b.label || b.hint) && (
                          <p className="flex flex-wrap items-baseline gap-x-2">
                            {b.label && <span className="t-body font-semibold break-keep text-slate-900">{b.label}</span>}
                            {b.hint && <span className="t-meta break-keep text-slate-500">{b.hint}</span>}
                          </p>
                        )}
                        {editing ? (
                          <textarea
                            className={`${inputClass} mt-1 min-h-24 font-normal`}
                            value={b.text}
                            rows={Math.min(14, Math.max(3, b.text.split('\n').length + 1))}
                            onChange={(e) => setEditing((prev) => (prev ? prev.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) : prev))}
                            aria-label={`${b.label || b.hint || '글'} 고치기`}
                            data-testid="content-block-input"
                          />
                        ) : shown.draft.kind === 'keywords' && b.label !== '해시태그' ? (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {b.text.split('\n').map((w) => (
                              <button
                                key={w}
                                type="button"
                                title="이 말로 블로그 주제 보기"
                                onClick={() => {
                                  setKeyword(w)
                                  setKind('blog')
                                  showToast(`키워드를 "${w}" 로 바꿨어요 — 주제를 골라 [블로그 글 만들기] 를 눌러 주세요.`)
                                }}
                                className="tap t-sub min-h-9 rounded-full border border-slate-300 bg-white px-3 text-slate-700 hover:border-brand-500"
                                data-testid="content-word"
                              >
                                {w}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="t-body mt-1 break-words whitespace-pre-wrap text-slate-700">{b.text}</p>
                        )}
                      </div>
                      {!editing && (
                        <button type="button" className="tap flex size-11 shrink-0 items-center justify-center rounded-(--radius-control) text-slate-500 hover:bg-white hover:text-slate-800" onClick={() => void copy(b.label ? `${b.label}\n${b.text}` : b.text, '이 칸')} aria-label={`${b.label || b.hint || '이 칸'} 복사`}>
                          <Copy className="size-4" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ol>

              {NEEDS_TOPIC.has(shown.draft.kind) && shown.draft.input.topicType && (
                <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3" data-testid="content-chain">
                  <span className="t-sub font-semibold text-slate-700">같은 주제로</span>
                  {(['blog', 'shorts', 'cards', 'video'] as ContentKind[])
                    .filter((k) => k !== shown.draft.kind)
                    .map((k) => (
                      <Button
                        key={k}
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setKind(k)
                          setTopicType(shown.draft.input.topicType as TopicType)
                          setKeyword(shown.draft.input.keyword ?? keyword)
                          show(makeDraft(profile, { kind: k, keyword: shown.draft.input.keyword, topic: topicsFor(profile, shown.draft.input.keyword ?? keyword, today, shown.draft.input.variant).find((t) => t.type === shown.draft.input.topicType), pages, variant: shown.draft.input.variant }, today))
                        }}
                        data-testid="content-chain-kind"
                        data-kind={k}
                      >
                        {KIND_LABEL[k]}
                        <ChevronRight className="size-4" aria-hidden="true" />
                      </Button>
                    ))}
                </div>
              )}

              <ToolResultAttach
                toolKey="content"
                title={`홍보 글 · ${KIND_LABEL[shown.draft.kind]}`}
                verdict={checks.some((c) => c.level === 'must') ? 'check' : 'ready'}
                verdictLabel={checks.some((c) => c.level === 'must') ? '[대괄호] 채우기' : '내보낼 수 있음'}
                summary={`${KIND_LABEL[shown.draft.kind]} — ${shown.draft.title}`}
                data={{ kind: shown.draft.kind, title: shown.draft.title, chars: text.length }}
                followUp={{ text: `홍보 글(${KIND_LABEL[shown.draft.kind]}) 업체 확인 · 올리기`, days: 3 }}
                presetClientId={record.id}
              />
            </section>
          ) : (
            <section className={`${card} flex flex-col items-start gap-2 p-5`} data-testid="content-empty">
              <h2 className="t-section text-slate-900">여기에 글이 나와요</h2>
              <p className="t-sub break-keep text-slate-600">위의 '먼저 만들 것' 을 누르거나, 왼쪽에서 형식을 고르고 [만들기] 를 눌러 주세요.</p>
            </section>
          )}
        </div>
      </div>

      <ArchiveCard store={store} onOpen={(it) => show({ kind: it.kind, title: it.title, blocks: it.blocks, notes: [], input: it.input }, it)} openId={shown?.item?.rootId ?? null} />

      {profileOpen && (
        <ProfileSheet
          overrides={store.overrides}
          profileItem={profile.item}
          onClose={() => setProfileOpen(false)}
          onSave={async (ov) => {
            const ok = await store.saveOverrides(ov)
            showToast(ok ? '홍보 정보를 저장했어요 — 다음 글부터 반영돼요.' : '저장하지 못했어요. 다시 눌러 주세요.')
            if (ok) setProfileOpen(false)
          }}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 업체 홍보 정보                                                        */
/* ------------------------------------------------------------------ */

function ProfileCard({ record, profile, source, onEdit }: { record: ClientOpsRecord; profile: ReturnType<typeof buildProfile>['profile']; source: ReturnType<typeof buildProfile>['source']; onEdit: () => void }) {
  const ind = INDUSTRIES.find((i) => i.key === profile.industry)
  const rows: { label: string; value: string; from?: string; missing?: boolean }[] = [
    { label: '업종', value: ind?.label ?? '기타' },
    { label: '대표 상품 · 서비스', value: profile.item, from: source.item === 'industry' ? '업종 말 — 고쳐 주세요' : source.item === 'override' ? '직접 적음' : '업체 기록', missing: source.item === 'industry' },
    { label: '하는 일', value: profile.services.join(' · '), from: source.services === 'site' ? '홈페이지' : source.services === 'override' ? '직접 적음' : source.services === 'record' ? '업체 기록' : '', missing: !profile.services.length },
    { label: '지역', value: profile.region || profile.area, missing: !profile.area },
    { label: '대표 전화', value: profile.phone, missing: !profile.phone },
    { label: '강점(사실)', value: profile.strengths.join(' · ') },
  ]
  const missing = rows.filter((r) => r.missing).length
  return (
    <section className={`${card} flex flex-col gap-3 p-4 sm:p-5`} data-testid="content-profile">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="t-section break-keep text-slate-900">{record.companyName} 홍보 정보</h2>
          <p className="t-sub mt-0.5 break-keep text-slate-600">업체 기록에서 저절로 채웠어요. 모든 글이 이 정보를 같이 써요.{missing ? ` 빈 칸 ${missing}개를 채우면 글이 더 정확해져요.` : ''}</p>
        </div>
        <Button size="sm" onClick={onEdit} data-testid="content-profile-edit">
          <PencilLine className="size-4" aria-hidden="true" />
          고치기
        </Button>
      </div>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <div key={r.label} className="min-w-0" data-testid="content-profile-row" data-missing={r.missing ? '1' : '0'}>
            <dt className="t-meta flex flex-wrap items-center gap-1.5 text-slate-500">
              {r.label}
              {r.from && <span className="text-slate-400">· {r.from}</span>}
            </dt>
            <dd className={`t-body break-words ${r.missing ? 'text-warning-700' : 'text-slate-800'}`}>{r.value || (r.missing ? '비어 있어요' : '—')}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

function ProfileSheet({ overrides, profileItem, onClose, onSave }: { overrides: ProfileOverrides; profileItem: string; onClose: () => void; onSave: (ov: ProfileOverrides) => Promise<void> }) {
  const [ov, setOv] = useState<ProfileOverrides>(overrides)
  const [saving, setSaving] = useState(false)
  const list = (s: string) =>
    s
      .split(/[,·\n]/)
      .map((x) => x.trim())
      .filter(Boolean)
  const [servicesText, setServicesText] = useState((overrides.services ?? []).join(', '))
  const [extraText, setExtraText] = useState((overrides.extraStrengths ?? []).join(', '))
  const field = (label: string, key: 'item' | 'area' | 'target' | 'phone' | 'hours', placeholder: string) => (
    <label className="flex flex-col gap-1.5">
      <span className="t-sub font-semibold text-slate-700">{label}</span>
      <input className={inputClass} value={ov[key] ?? ''} placeholder={placeholder} onChange={(e) => setOv((p) => ({ ...p, [key]: e.target.value }))} data-testid={`content-ov-${key}`} />
    </label>
  )
  return (
    <BottomSheet
      title="홍보 정보 고치기"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>닫기</Button>
          <Button
            variant="primary"
            disabled={saving}
            data-testid="content-ov-save"
            onClick={async () => {
              setSaving(true)
              await onSave({ ...ov, services: list(servicesText), extraStrengths: list(extraText) })
              setSaving(false)
            }}
          >
            <Check className="size-4" aria-hidden="true" />
            저장
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="t-sub break-keep text-slate-600">비워 두면 업체 기록 · 업종 견본으로 채워요. 여기서 고친 것은 홍보 글에만 쓰고, 업체 기록은 바꾸지 않아요.</p>
        <label className="flex flex-col gap-1.5">
          <span className="t-sub font-semibold text-slate-700">업종(견본)</span>
          <select className={inputClass} value={ov.industry ?? ''} onChange={(e) => setOv((p) => ({ ...p, industry: (e.target.value || undefined) as IndustryKey | undefined }))} data-testid="content-ov-industry">
            <option value="">업체 기록으로 알아보기</option>
            {INDUSTRIES.map((i) => (
              <option key={i.key} value={i.key}>
                {i.label}
              </option>
            ))}
          </select>
        </label>
        {field('대표 상품 · 서비스(키워드 가운데 말)', 'item', `지금: ${profileItem}`)}
        <label className="flex flex-col gap-1.5">
          <span className="t-sub font-semibold text-slate-700">하는 일(쉼표로 나눔)</span>
          <input className={inputClass} value={servicesText} placeholder="예: 욕실 리모델링, 주방 리모델링, 누수 수리" onChange={(e) => setServicesText(e.target.value)} data-testid="content-ov-services" />
        </label>
        {field('키워드 지역(짧게)', 'area', '예: 동탄 · 강남 · 망원')}
        {field('주 고객', 'target', ov.industry ? CONTENT_LIB[ov.industry].target : '예: 근처에 사는 30~40대 가족')}
        <label className="flex flex-col gap-1.5">
          <span className="t-sub font-semibold text-slate-700">더할 강점(사실만 · 쉼표로 나눔)</span>
          <input className={inputClass} value={extraText} placeholder="예: 주차 20대, 당일 견적" onChange={(e) => setExtraText(e.target.value)} data-testid="content-ov-extra" />
        </label>
        {field('대표 전화(글에 넣을 번호)', 'phone', '회사 대표 번호')}
        {field('운영 시간', 'hours', '예: 평일 09:00 – 18:00 · 토 휴무')}
      </div>
    </BottomSheet>
  )
}

/* ------------------------------------------------------------------ */
/* 보관함                                                                */
/* ------------------------------------------------------------------ */

function ArchiveCard({ store, onOpen, openId }: { store: ContentStore; onOpen: (it: ContentItem) => void; openId: string | null }) {
  const { showToast } = useToast()
  const [filter, setFilter] = useState<'all' | 'fav' | ContentKind>('all')
  const [del, setDel] = useState<{ rootId: string; title: string; versions: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const rows = useMemo(() => latestByRoot(store.items), [store.items])
  const shown = rows.filter((r) => (filter === 'all' ? true : filter === 'fav' ? r.item.favorite : r.item.kind === filter))
  const kindsHere = CONTENT_KINDS.filter((k) => rows.some((r) => r.item.kind === k))
  return (
    <section className={`${card} flex flex-col gap-3 p-4 sm:p-5`} data-testid="content-archive">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="t-section text-slate-900">보관함</h2>
        <span className="t-sub text-slate-500">{rows.length}편</span>
      </div>
      {rows.length === 0 ? (
        <p className="t-sub break-keep text-slate-500">아직 저장한 글이 없어요. 글을 만들고 [보관함에 저장] 을 누르면 여기에 남아요.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {(['all', 'fav', ...kindsHere] as const).map((f) => (
              <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={`tap t-sub min-h-9 rounded-full border px-3 ${filter === f ? 'border-brand-600 bg-brand-50 font-semibold text-brand-700' : 'border-slate-200 text-slate-600'}`}>
                {f === 'all' ? '전체' : f === 'fav' ? '즐겨찾기' : KIND_LABEL[f]}
              </button>
            ))}
          </div>
          <ul className="flex flex-col divide-y divide-slate-100">
            {shown.map(({ item, versions }) => (
              <li key={item.rootId} className={`flex items-center gap-2 py-1.5 ${openId === item.rootId ? 'bg-brand-50/60' : ''}`} data-testid="content-archive-item" data-kind={item.kind}>
                <button
                  type="button"
                  className="tap flex size-11 shrink-0 items-center justify-center rounded-(--radius-control) hover:bg-slate-50"
                  aria-label={item.favorite ? '즐겨찾기 빼기' : '즐겨찾기'}
                  aria-pressed={item.favorite}
                  onClick={async () => {
                    if (!(await store.toggleFavorite(item.rootId))) showToast('바꾸지 못했어요. 다시 눌러 주세요.')
                  }}
                  data-testid="content-fav"
                >
                  <Star className={`size-5 ${item.favorite ? 'fill-amber-400 text-amber-500' : 'text-slate-300'}`} aria-hidden="true" />
                </button>
                <button type="button" className="tap flex min-h-11 min-w-0 flex-1 flex-col items-start justify-center text-left" onClick={() => onOpen(item)} data-testid="content-archive-open">
                  <span className="t-body w-full truncate font-medium text-slate-800">{item.title}</span>
                  <span className="t-meta text-slate-500">
                    {KIND_LABEL[item.kind]} · {item.createdAt.slice(0, 10)}
                    {versions > 1 ? ` · ${versions}판` : ''}
                  </span>
                </button>
                <button type="button" className="tap flex size-11 shrink-0 items-center justify-center rounded-(--radius-control) text-slate-400 hover:bg-danger-50 hover:text-danger-700" aria-label={`${item.title} 지우기`} onClick={() => setDel({ rootId: item.rootId, title: item.title, versions })} data-testid="content-del">
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <ConfirmModal
        open={!!del}
        title="이 글을 지울까요?"
        message={del ? `「${del.title}」${del.versions > 1 ? ` (고친 판 ${del.versions}개 모두)` : ''}` : ''}
        warning="지우면 되돌릴 수 없어요."
        confirmLabel="지우기"
        danger
        busy={busy}
        onCancel={() => setDel(null)}
        onConfirm={async () => {
          if (!del) return
          setBusy(true)
          const ok = await store.removeChain(del.rootId)
          setBusy(false)
          setDel(null)
          showToast(ok ? '지웠어요.' : '지우지 못했어요. 다시 눌러 주세요.')
        }}
      />
    </section>
  )
}
