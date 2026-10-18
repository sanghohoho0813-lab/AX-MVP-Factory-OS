/**
 * 홈페이지 만들기 화면 (D-202).
 *
 * 처음: 업체 기록으로 무엇이 채워질지 보여 주고 [초안 만들기] 한 번.
 * 그다음: 왼쪽 블록 목록(누르면 칸이 펼쳐짐 · 위아래 · 복사 · 숨기기 · 지우기) / 오른쪽 PC · 휴대폰 미리보기(블록을 누르면 왼쪽에서 열림).
 * 꾸밈(색 · 글꼴 · 모서리 · 검색 정보) · 점검(꼭 고칠 것 · 확인할 것) 탭. [HTML 내려받기] · [새 창으로 보기] · [업체 기록에 붙이기].
 * 휴대폰에서는 [고치기 | 미리보기] 를 번갈아 본다.
 * D-208: 디자인 한 번에(스타일 6가지 — 꾸밈 + 블록 모양 + 바탕 흐름) · 홈페이지 점수 100점 + '이것만 하면 +n점'(누르면 그 블록) ·
 *        업종 맞춤 블록 [넣기] · 같은 업체 홍보 글 만들기로 바로 가기.
 * D-227: 대표 "한 페이지에 너무 많으면 역효과 · 길을 잃지 않게 · 토스처럼 다음 단계로" —
 *        블록 · 꾸밈 · 점검 탭을 ① 내용 고치기 → ② 꾸미기 → ③ 점검 · 내려받기 단계로(아무 단계나 눌러 가도 된다),
 *        단계 끝마다 [다음 단계] 단추, ③ 에 [HTML 내려받기] 를 크게. 점수 카드는 '이것만 하면' 첫 칸만 보이고 나머지는 접는다.
 */
import { usePageCrumbs } from '../../lib/crumbStore'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowDown, ArrowRight, ArrowUp, Check, CheckCircle2, ChevronRight, Copy, Download, ExternalLink, EyeOff, Gauge, Globe, LayoutGrid, Maximize2, Minimize2, Monitor, Palette, PenLine, Plus, Redo2, RefreshCw, Smartphone, Sparkles, Trash2, Undo2, Wand2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { BottomSheet, Badge } from '../../components/ui/primitives'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { useToast } from '../../components/ui/toastContext'
import { useUnsavedChangesGuard } from '../../lib/useUnsavedChangesGuard'
import { useFold } from '../../components/ui/fold'
import { useIsPhone } from '../../lib/useIsPhone'
import { nowIso, todayLocalDate } from '../../lib/appClock'
import { generateId } from '../../storage/localStore'
import {
  BLOCK_DEFS,
  CORNERS,
  INDUSTRY_STYLE,
  STYLE_PRESETS,
  applyStylePreset,
  blockSuggestions,
  currentStyle,
  paletteOf,
  siteScore,
  FONTS,
  INDUSTRIES,
  MAX_TOTAL_IMAGE_CHARS,
  PALETTES,
  blockDef,
  confirmSample,
  draftSite,
  duplicateBlock,
  hasContent,
  imageChars,
  industryDef,
  industryForRecord,
  insertBlock,
  moveBlock,
  newBlock,
  removeBlock,
  renderSiteHtml,
  setHidden,
  setProp,
  setSeo,
  setTheme,
  siteChecks,
  siteFacts,
  siteFileName,
  withContactPhone,
  type BlockType,
  type IndustryKey,
  type ScoreItem,
  type SiteBlock,
  type SiteDoc,
} from '../../services/siteBuilder'
import type { ClientOpsRecord } from '../../types/clientOps'
import { ToolResultAttach } from '../shared/ToolResultAttach'
import { isTrialId, subjectQuery } from '../../services/marketingTrial'
import { BlockFields, IconBtn, inputClass } from './BlockFields'
import { SitePreview, type Device } from './SitePreview'
import type { SiteStore } from './useSiteDoc'
import { MkHero, MkIcon } from '../marketing/mkKit'
import { BLOCK_STYLE, MK_PRIMARY, TONE } from '../marketing/mkTheme'

type Tab = 'blocks' | 'style' | 'checks'

// D-226 고른 칸 · 칩은 테마 색이 아니라 홈페이지 색(초록)
const onBox = 'border-emerald-500 ring-2 ring-emerald-200'
const onSoft = 'border-emerald-500 bg-emerald-50 text-emerald-900'

function blockSummary(b: SiteBlock): string {
  const p = b.props
  const s = (k: string) => (typeof p[k] === 'string' ? (p[k] as string).trim() : '')
  const n = (k: string) => (Array.isArray(p[k]) ? (p[k] as unknown[]).length : 0)
  switch (b.type) {
    case 'header':
      return s('logoText')
    case 'hero':
      return s('title').replace(/\n/g, ' ')
    case 'footer':
      return [s('companyName'), s('businessNumber')].filter(Boolean).join(' · ')
    case 'contact':
      return [s('address'), s('phone')].filter(Boolean).join(' · ')
    case 'about':
      return s('title')
    case 'cta':
      return s('title')
    default:
      return `${s('title')}${n('items') ? ` · ${n('items')}개` : ''}`
  }
}

function download(name: string, html: string) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/* ------------------------------------------------------------------ */
/* 처음 — 업체 기록으로 무엇이 채워지나                                    */
/* ------------------------------------------------------------------ */

function StartCard({ record, onStart }: { record: ClientOpsRecord; onStart: (industry: IndustryKey) => void }) {
  const today = todayLocalDate()
  const f = siteFacts(record, today)
  const detected = industryForRecord(record)
  const [industry, setIndustry] = useState<IndustryKey>(detected)
  const rows: [string, string][] = [
    ['회사명', f.companyName],
    ['대표', f.representative],
    ['사업자등록번호', f.businessNumber],
    ['주소', f.address],
    ['대표 전화', f.phone],
    ['메일', f.email],
    ['설립일', f.establishedAt],
    ['업종 · 종목', [f.category, f.item].filter(Boolean).join(' · ')],
    ['인증 · 특허 · 연구소', [...f.certifications, ...(f.researchLab ? ['기업부설연구소'] : []), ...f.patents].join(', ')],
  ]
  const have = rows.filter(([, v]) => v).length
  return (
    <section className="flex flex-col overflow-hidden rounded-(--radius-panel) border border-slate-200 bg-white shadow-sm" data-testid="site-start">
      {/* D-226 머리 띠 — 무엇이 채워질지 한눈에(몇 가지 있는지 막대로) */}
      <MkHero
        tone="emerald"
        icon={Globe}
        eyebrow="홈페이지 초안 · 업체 기록으로"
        title={record.companyName}
        sub={`업체 기록으로 홈페이지 초안을 만듭니다. 아래 ${rows.length}가지 중 ${have}가지가 있어요.`}
        stats={[{ label: '채울 수 있는 것', value: `${have}/${rows.length}` }]}
      >
        <div className="h-2.5 w-full max-w-md overflow-hidden rounded-full bg-white/25" aria-hidden="true">
          <div className="h-full rounded-full bg-white" style={{ width: `${Math.round((have / rows.length) * 100)}%` }} />
        </div>
      </MkHero>
      <div className="flex flex-col gap-4 p-4 sm:p-5">
        <p className="t-body break-keep text-slate-600">있는 것은 그대로 넣고, 없는 것은 비워 둔 채 점검에서 알려 드려요. 숫자 · 인증은 기록에 있을 때만 넣어요(지어내지 않아요).</p>
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2" data-testid="site-start-facts">
          {rows.map(([k, v]) => (
            <div key={k} className={`flex min-h-12 min-w-0 items-start gap-2.5 rounded-(--radius-control) border px-3 py-2 ${v ? 'border-emerald-200 bg-emerald-50/60' : 'border-dashed border-slate-300 bg-slate-50'}`}>
              {v ? (
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white" aria-label="있음">
                  <Check className="size-4" aria-hidden="true" />
                </span>
              ) : (
                <span className="t-meta mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-200 font-bold text-slate-500" aria-label="없음">
                  –
                </span>
              )}
              <div className="min-w-0 flex-1">
                <dt className="t-meta font-semibold text-slate-600">{k}</dt>
                <dd className={`t-sub min-w-0 break-words [overflow-wrap:anywhere] ${v ? 'font-medium text-slate-900' : 'text-slate-500'}`}>{v || '없음'}</dd>
              </div>
            </div>
          ))}
        </dl>
        {!f.phone && f.contactPhone && <p className="t-sub break-keep rounded-(--radius-control) bg-amber-50 px-3 py-2 text-amber-800">회사 대표 전화가 없어요 — 담당자 휴대폰은 저절로 넣지 않아요. 만든 뒤 점검에서 넣을 수 있어요.</p>}
        <div className="flex flex-col gap-3 rounded-(--radius-control) border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-3 sm:flex-row sm:items-end">
          <label className="flex min-w-0 flex-1 flex-col sm:max-w-sm">
            <span className="t-sub font-semibold text-slate-700">업종 견본 {industry === detected && <span className="t-meta font-normal text-slate-500">(업체 기록으로 알아봄)</span>}</span>
            <select className={inputClass} value={industry} onChange={(e) => setIndustry(e.target.value as IndustryKey)} data-testid="site-industry">
              {INDUSTRIES.map((i) => (
                <option key={i.key} value={i.key}>
                  {i.label}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className={MK_PRIMARY.emerald} onClick={() => onStart(industry)} data-testid="site-create">
            <Wand2 className="size-5" aria-hidden="true" />
            초안 만들기
          </button>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* 편집                                                                 */
/* ------------------------------------------------------------------ */

export function HomepageBuilder({ record, store }: { record: ClientOpsRecord; store: SiteStore }) {
  const { showToast } = useToast()
  const phone = useIsPhone()
  const [tab, setTab] = useState<Tab>('blocks')
  // D-235 경로 줄 끝에 지금 단계(… › 홈페이지 만들기 › 업체 › 2 꾸미기)
  usePageCrumbs([{ label: tab === 'blocks' ? '① 내용 고치기' : tab === 'style' ? '② 꾸미기' : '③ 내려받기' }])
  const [selected, setSelected] = useState<string | null>(null)
  const [device, setDevice] = useState<Device>('pc')
  const [pane, setPane] = useState<'edit' | 'preview'>('edit')
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<SiteBlock | null>(null)
  const [redraft, setRedraft] = useState<IndustryKey | null>(null)
  // PC 미리보기 크게(왼쪽 고치기 칸을 접고 미리보기만) — D-205
  const [big, setBig] = useState(false)
  const doc = store.doc
  // D-221 사진처럼 늦게 들어오는 값은 그때의 최신 홈페이지에 넣는다(예전에는 사진을 줄이는 동안 다른 칸에 적은 글이 옛 값으로 덮였다)
  const docRef = useRef(doc)
  docRef.current = doc
  const today = todayLocalDate()

  const change = useCallback((next: SiteDoc, group?: string) => store.change(next, group), [store])

  const checks = useMemo(() => (doc ? siteChecks(doc, { contactPhone: record.contactPhone }) : []), [doc, record.contactPhone])
  const must = checks.filter((c) => c.level === 'must').length
  const should = checks.filter((c) => c.level === 'should').length
  const score = useMemo(() => (doc ? siteScore(doc) : null), [doc])
  const suggestions = useMemo(() => (doc ? blockSuggestions(doc) : []), [doc])
  // D-227 점수 '이것만 하면' — 첫 칸만 보이고 나머지는 접어 둔다(펼침은 이 기기에 기억)
  const [scoreOpen, setScoreOpen] = useFold('site.score', false)
  // D-227 '있으면 좋은 블록' 도 한 줄로 접어 둔다(블록 이름만 보이고 누르면 까닭 · [넣기])
  const [suggestOpen, setSuggestOpen] = useFold('site.suggest', false)

  // 미리보기에서 블록을 누르면 → 블록 탭에서 그 블록을 연다(휴대폰은 고치기 화면으로)
  const selectBlock = useCallback(
    (id: string) => {
      setSelected(id)
      setTab('blocks')
      setBig(false)
      if (phone) setPane('edit')
      window.setTimeout(() => document.querySelector(`[data-block-row="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 50)
    },
    [phone],
  )

  useEffect(() => {
    // 저장 실패를 알린다(적은 것은 화면에 남아 있다)
    if (store.save === 'error') showToast('저장하지 못했어요 — 적은 것은 이 화면에 남아 있어요. 잠시 뒤 다시 저장하고, 위의 [지금 다시 저장] 으로 바로 할 수도 있어요.')
  }, [store.save, showToast])
  // D-221 저장에 실패한 채 메뉴 · 링크로 다른 화면에 가면 묻는다(예전에는 창 닫기만 막아 고친 것이 말없이 사라졌다)
  const { blocker: leaveRoute } = useUnsavedChangesGuard(store.save === 'error')
  const retrySave = () => void store.flush().then((ok) => showToast(ok ? '저장했어요.' : '아직 저장하지 못했어요 — 인터넷 연결을 확인해 주세요.'))

  if (!doc) {
    return (
      <StartCard
        record={record}
        onStart={(industry) => {
          const d = draftSite(record, { industry, today, now: nowIso(), makeId: generateId })
          store.change(d)
          setSelected(d.blocks[1]?.id ?? null)
          showToast(`${industryDef(industry).label} 견본으로 초안을 만들었어요 — 견본 문구는 업체와 확인해 주세요.`)
        }}
      />
    )
  }

  const html = () => renderSiteHtml(doc)
  const onDownload = async () => {
    await store.flush()
    download(siteFileName(doc), html())
    showToast(must ? `내려받았어요 — 꼭 고칠 것 ${must}개가 남아 있어요.` : '홈페이지 HTML 을 내려받았어요.')
  }
  const onOpen = () => {
    const url = URL.createObjectURL(new Blob([html()], { type: 'text/html;charset=utf-8' }))
    window.open(url, '_blank', 'noopener')
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }
  const imageRoom = MAX_TOTAL_IMAGE_CHARS - imageChars(doc)
  // 업체 기록으로 본 업종과 지금 견본이 다르고, 첫 화면 문구가 아직 견본이면 → 맞는 견본으로 바꾸자고 알린다(D-205)
  const detected = industryForRecord(record)
  const heroBlock = doc.blocks.find((b) => b.type === 'hero')
  const mismatch = detected !== doc.industry && detected !== 'general' && Boolean(heroBlock?.sample?.includes('title'))
  const visibleCount = doc.blocks.filter((b) => hasContent(b) && !(b.hidePc && b.hideMobile)).length

  /** D-208 블록 하나 더하기(맨 아래 줄 · 연락처 바로 위) — 업종 맞춤 · 점수에서 */
  const addBlock = (type: BlockType) => {
    const b = newBlock(type, record, doc.industry, today, generateId())
    const contact = doc.blocks.find((x) => x.type === 'contact')
    const before = contact ? doc.blocks[doc.blocks.indexOf(contact) - 1] : undefined
    change(insertBlock(doc, b, before?.id ?? selected, nowIso()))
    setSelected(b.id)
    setTab('blocks')
    setBig(false)
    if (phone) setPane('edit')
    window.setTimeout(() => document.querySelector(`[data-block-row="${CSS.escape(b.id)}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 50)
    showToast(`${blockDef(type)?.label ?? ''} 블록을 넣었어요 — 칸을 채우면 홈페이지에 나와요.`)
  }

  /** D-208 점수 항목 누르기 → 그 블록 · 꾸밈 탭 · 블록 더하기 */
  const openScore = (it: ScoreItem) => {
    if (it.open.blockId) selectBlock(it.open.blockId)
    else if (it.open.tab) {
      setTab(it.open.tab)
      setBig(false)
      if (phone) setPane('edit')
    } else if (it.open.add) addBlock(it.open.add)
  }

  const nowStyle = currentStyle(doc)
  const recommendStyle = INDUSTRY_STYLE[doc.industry]

  /* ---- 머리 도구줄 ---- */
  const toolbar = (
    <div className="flex flex-wrap items-center gap-2" data-testid="site-toolbar">
      <IconBtn label="되돌리기" disabled={!store.canUndo} onClick={store.undo} testId="site-undo">
        <Undo2 className="size-4" />
      </IconBtn>
      <IconBtn label="다시 하기" disabled={!store.canRedo} onClick={store.redo} testId="site-redo">
        <Redo2 className="size-4" />
      </IconBtn>
      <span className={`t-meta ${store.save === 'error' ? 'font-semibold text-danger-700' : 'text-slate-500'}`} data-testid="site-save" data-state={store.save}>
        {store.save === 'saved' ? '저장됨' : store.save === 'saving' ? '저장하는 중…' : store.save === 'pending' ? '고친 것 저장 대기' : '저장 실패 — 잠시 뒤 다시 저장해요'}
      </span>
      {store.save === 'error' && (
        <Button size="sm" onClick={retrySave} data-testid="site-save-retry">
          <RefreshCw className="size-4" aria-hidden="true" /> 지금 다시 저장
        </Button>
      )}
      <span className="ml-auto" />
      <button
        type="button"
        onClick={() => setTab('checks')}
        className={`tap t-sub inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-control) border px-3 font-semibold ${must ? 'border-danger-200 bg-danger-50 text-danger-700' : should ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}
        data-testid="site-check-count"
        data-must={must}
        data-should={should}
      >
        {must ? <AlertTriangle className="size-4" aria-hidden="true" /> : <CheckCircle2 className="size-4" aria-hidden="true" />}
        {must ? `꼭 고칠 것 ${must}` : should ? `확인할 것 ${should}` : '점검 통과'}
      </button>
      <Link to={`/tools/content/build?${subjectQuery(record.id)}`} className="tap t-sub inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-control) border border-violet-200 bg-violet-50 px-3 font-semibold text-violet-800 hover:border-violet-400" data-testid="site-to-content">
        <PenLine className="size-4" aria-hidden="true" /> 이 업체 홍보 글
      </Link>
      <Button size="sm" onClick={onOpen} data-testid="site-open">
        <ExternalLink className="size-4" aria-hidden="true" /> 새 창으로 보기
      </Button>
      <button type="button" className={MK_PRIMARY.emerald} onClick={() => void onDownload()} data-testid="site-download">
        <Download className="size-4" aria-hidden="true" /> HTML 내려받기
      </button>
      {/* D-220: 가상 업체 · 컨설턴트는 붙일 업체 기록이 없다 — 임시등록하면 붙일 수 있다 */}
      {!isTrialId(record.id) && (
      <ToolResultAttach
        toolKey="homepage"
        title="홈페이지 초안"
        verdict={must ? 'check' : 'ready'}
        verdictLabel={must ? `꼭 고칠 것 ${must}개` : should ? `확인할 것 ${should}개` : '내보낼 수 있음'}
        summary={`홈페이지 초안 — 블록 ${visibleCount}개(${industryDef(doc.industry).label} 견본)${must ? ` · 꼭 고칠 것 ${must}개` : ''}${should ? ` · 확인할 것 ${should}개` : ''}`}
        data={{ blocks: doc.blocks.length, industry: doc.industry, updatedAt: doc.updatedAt }}
        followUp={{ text: '홈페이지 초안 업체 확인 · 견본 문구 고치기', days: 3 }}
        presetClientId={record.id}
      />
      )}
    </div>
  )

  /* ---- 블록 목록 ---- */
  const blocksTab = (
    <div className="flex flex-col gap-2" data-testid="site-blocks">
      {suggestions.length > 0 && (
        <div className="flex flex-col gap-2 rounded-(--radius-control) border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-3" data-testid="site-suggest">
          <button type="button" onClick={() => setSuggestOpen(!suggestOpen)} aria-expanded={suggestOpen} className="tap -m-1 flex min-h-11 min-w-0 items-center gap-1.5 rounded-(--radius-control) p-1 text-left" data-testid="site-suggest-toggle">
            <ChevronRight className={`size-4 shrink-0 text-emerald-700 transition-transform duration-150 ${suggestOpen ? 'rotate-90' : ''}`} aria-hidden="true" />
            <Sparkles className="size-4 shrink-0 text-emerald-700" aria-hidden="true" />
            <span className="t-sub min-w-0 flex-1 font-semibold break-keep text-emerald-900">
              {industryDef(doc.industry).label}에 있으면 좋은 블록 {suggestions.length}개
              {!suggestOpen && <span className="font-normal text-emerald-800"> · {suggestions.map((sg) => blockDef(sg.type)?.label).join(' · ')}</span>}
            </span>
          </button>
          {suggestOpen && suggestions.map((sg) => (
            <div key={sg.type} className="flex items-center gap-2" data-testid="site-suggest-item" data-type={sg.type}>
              <MkIcon icon={BLOCK_STYLE[sg.type].icon} tone={BLOCK_STYLE[sg.type].tone} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="t-sub block font-semibold text-slate-800">{blockDef(sg.type)?.label}</span>
                <span className="t-meta block break-keep text-slate-600">{sg.why}</span>
              </span>
              <Button size="sm" onClick={() => addBlock(sg.type)} data-testid="site-suggest-add">
                <Plus className="size-4" aria-hidden="true" /> 넣기
              </Button>
            </div>
          ))}
        </div>
      )}
      {doc.blocks.map((b, i) => {
        const def = blockDef(b.type)
        const open = selected === b.id
        const pinned = b.type === 'header' || b.type === 'footer'
        return (
          <div key={b.id} data-block-row={b.id} data-type={b.type} className={`rounded-(--radius-control) border bg-white ${open ? 'border-emerald-400 shadow-md ring-1 ring-emerald-200' : `border-slate-200 ${TONE[BLOCK_STYLE[b.type].tone].hover}`}`}>
            <button type="button" className="tap flex w-full min-h-14 items-center gap-3 px-3 py-2 text-left" onClick={() => setSelected(open ? null : b.id)} aria-expanded={open} data-testid="block-row">
              <span className="relative shrink-0">
                <MkIcon icon={BLOCK_STYLE[b.type].icon} tone={BLOCK_STYLE[b.type].tone} />
                <span className="absolute -top-1.5 -left-1.5 flex size-5 items-center justify-center rounded-full bg-white text-[0.6875rem] font-bold text-slate-600 tabular-nums shadow ring-1 ring-slate-200" aria-hidden="true">
                  {i + 1}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="t-card block break-keep font-semibold text-slate-900">{def?.label}</span>
                <span className="t-meta block truncate text-slate-500">{blockSummary(b) || def?.desc}</span>
              </span>
              <span className="flex shrink-0 flex-wrap justify-end gap-1">
                {b.sample?.length ? <Badge tone="warning">견본</Badge> : null}
                {!hasContent(b) && <Badge tone="neutral">비어 있음</Badge>}
                {b.hidePc && <Badge tone="neutral">PC 숨김</Badge>}
                {b.hideMobile && <Badge tone="neutral">휴대폰 숨김</Badge>}
              </span>
            </button>
            {open && def && (
              <div className="flex flex-col gap-4 border-t border-slate-100 p-3" data-testid="block-editor">
                {b.sample?.length ? (
                  <div className="flex flex-wrap items-center gap-2 rounded-(--radius-control) bg-amber-50 p-3">
                    <p className="t-sub min-w-0 flex-1 break-keep text-amber-900">견본 문구가 들어 있어요. 업체와 맞는지 확인하고 고쳐 주세요.</p>
                    <Button size="sm" onClick={() => change(confirmSample(doc, b.id, nowIso()))} data-testid="sample-confirm">
                      업체와 확인했어요
                    </Button>
                  </div>
                ) : null}
                <BlockFields
                  block={b}
                  fields={def.fields}
                  imageRoom={imageRoom}
                  onImageError={(m) => showToast(m)}
                  onChange={(key, value, group) => change(setProp(docRef.current ?? doc, b.id, key, value, nowIso()), group)}
                />
                <div className="flex flex-wrap gap-1.5 border-t border-slate-100 pt-3" data-testid="block-actions">
                  <IconBtn label="위로" disabled={pinned || i <= 1 || doc.blocks[i - 1]?.type === 'header'} onClick={() => change(moveBlock(doc, b.id, -1, nowIso()))} testId="block-up">
                    <ArrowUp className="size-4" />
                  </IconBtn>
                  <IconBtn label="아래로" disabled={pinned || doc.blocks[i + 1]?.type === 'footer' || i === doc.blocks.length - 1} onClick={() => change(moveBlock(doc, b.id, 1, nowIso()))} testId="block-down">
                    <ArrowDown className="size-4" />
                  </IconBtn>
                  {!def.single && (
                    <IconBtn label="복사" onClick={() => change(duplicateBlock(doc, b.id, generateId(), nowIso()))} testId="block-copy">
                      <Copy className="size-4" />
                    </IconBtn>
                  )}
                  <label className="tap t-sub inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-(--radius-control) border border-slate-300 px-3 text-slate-700">
                    <input type="checkbox" className="size-4 accent-emerald-600" checked={Boolean(b.hidePc)} onChange={(e) => change(setHidden(doc, b.id, 'pc', e.target.checked, nowIso()))} data-testid="block-hide-pc" />
                    <EyeOff className="size-4" aria-hidden="true" /> PC 숨김
                  </label>
                  <label className="tap t-sub inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-(--radius-control) border border-slate-300 px-3 text-slate-700">
                    <input type="checkbox" className="size-4 accent-emerald-600" checked={Boolean(b.hideMobile)} onChange={(e) => change(setHidden(doc, b.id, 'mobile', e.target.checked, nowIso()))} data-testid="block-hide-mobile" />
                    <EyeOff className="size-4" aria-hidden="true" /> 휴대폰 숨김
                  </label>
                  <span className="ml-auto" />
                  <IconBtn label="블록 지우기" danger onClick={() => setRemoving(b)} testId="block-remove">
                    <Trash2 className="size-4" />
                  </IconBtn>
                </div>
              </div>
            )}
          </div>
        )
      })}
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="tap t-body inline-flex min-h-12 items-center justify-center gap-2 rounded-(--radius-control) border-2 border-dashed border-emerald-300 bg-emerald-50 font-semibold text-emerald-800 hover:bg-emerald-100"
        data-testid="block-add"
      >
        <Plus className="size-5" aria-hidden="true" /> 블록 더하기
      </button>
    </div>
  )

  /* ---- 꾸밈 ---- */
  const styleTab = (
    <div className="flex flex-col gap-5" data-testid="site-style">
      <fieldset className="flex flex-col gap-2" data-testid="site-presets">
        <legend className="t-card mb-1 font-semibold text-slate-900">디자인 한 번에</legend>
        <p className="t-meta -mt-1 break-keep text-slate-500">누르면 색 · 글꼴 · 모서리 · 블록 모양 · 바탕이 한꺼번에 바뀌어요. 글 · 사진 · 순서는 그대로 · 마음에 안 들면 [되돌리기].</p>
        {/* 고치기 칸이 좁은 PC(lg)는 한 줄에 하나 — 설명이 잘게 꺾이지 않게 */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
          {STYLE_PRESETS.map((sp) => {
            const pal = paletteOf(sp.palette)
            const on = nowStyle === sp.key
            return (
              <button
                key={sp.key}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  change(applyStylePreset(doc, sp.key, nowIso()))
                  showToast(`'${sp.label}' 스타일로 바꿨어요 — 마음에 안 들면 [되돌리기] 를 눌러 주세요.`)
                }}
                className={`tap flex min-h-16 w-full min-w-0 items-center gap-3 border px-3 py-2 text-left ${on ? onBox : 'border-slate-200 hover:border-emerald-300'}`}
                style={{ borderRadius: sp.corner === 'square' ? 6 : sp.corner === 'round' ? 14 : 22 }}
                data-testid="site-preset"
                data-value={sp.key}
              >
                <span className="flex h-11 w-14 shrink-0 flex-col overflow-hidden border border-slate-200" style={{ borderRadius: sp.corner === 'square' ? 3 : 10 }} aria-hidden="true">
                  <span className="flex-[3]" style={{ background: `linear-gradient(135deg, ${pal.heroFrom}, ${pal.heroTo})` }} />
                  <span className="flex flex-[2] items-center gap-1 px-1" style={{ background: pal.soft }}>
                    <span className="h-1.5 flex-1" style={{ background: pal.primary, borderRadius: sp.corner === 'pill' ? 99 : 1 }} />
                    <span className="h-1.5 w-2" style={{ background: pal.line }} />
                  </span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`t-sub flex flex-wrap items-center gap-x-1.5 font-semibold text-slate-900 ${sp.font === 'serif' ? 'font-serif' : ''}`}>
                    {sp.label}
                    {sp.key === recommendStyle && <span className="t-meta rounded-full bg-amber-100 px-1.5 font-semibold text-amber-800">이 업종 추천</span>}
                    {on && <Check className="size-4 text-emerald-600" aria-label="지금 스타일" />}
                  </span>
                  <span className="t-meta block break-keep text-slate-500">{sp.hint}</span>
                </span>
              </button>
            )
          })}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="t-card mb-1 font-semibold text-slate-900">색만 바꾸기</legend>
        <div className="grid grid-cols-2 gap-2">
          {PALETTES.map((p) => (
            <button
              key={p.key}
              type="button"
              aria-pressed={doc.theme.palette === p.key}
              onClick={() => change(setTheme(doc, { palette: p.key }, nowIso()))}
              className={`tap flex min-h-14 items-center gap-2.5 rounded-(--radius-control) border px-3 py-2 text-left ${doc.theme.palette === p.key ? onBox : 'border-slate-200 hover:border-emerald-300'}`}
              data-testid="theme-palette"
              data-value={p.key}
            >
              <span className="flex shrink-0 overflow-hidden rounded-full border border-slate-200">
                <span className="size-5" style={{ background: p.heroFrom }} />
                <span className="size-5" style={{ background: p.primary }} />
                <span className="size-5" style={{ background: p.soft }} />
              </span>
              <span className="min-w-0">
                <span className="t-sub block font-semibold text-slate-800">{p.label}</span>
                <span className="t-meta block truncate text-slate-500">{p.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="t-card mb-1 font-semibold text-slate-900">글꼴</legend>
        <div className="flex flex-wrap gap-2">
          {FONTS.map((f) => (
            <button key={f.key} type="button" aria-pressed={doc.theme.font === f.key} onClick={() => change(setTheme(doc, { font: f.key }, nowIso()))} className={`tap t-sub min-h-11 rounded-(--radius-control) border px-4 font-medium ${doc.theme.font === f.key ? onSoft : 'border-slate-300 text-slate-700'}`} data-testid="theme-font" data-value={f.key}>
              {f.label}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="t-card mb-1 font-semibold text-slate-900">모서리</legend>
        <div className="flex flex-wrap gap-2">
          {CORNERS.map((c) => (
            <button key={c.key} type="button" aria-pressed={doc.theme.corner === c.key} onClick={() => change(setTheme(doc, { corner: c.key }, nowIso()))} className={`tap t-sub min-h-11 border px-4 font-medium ${doc.theme.corner === c.key ? onSoft : 'border-slate-300 text-slate-700'}`} style={{ borderRadius: Math.min(c.button, 22) }} data-testid="theme-corner" data-value={c.key}>
              {c.label}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="t-card mb-1 font-semibold text-slate-900">검색에 보일 정보</legend>
        <label className="flex flex-col">
          <span className="t-sub font-semibold text-slate-700">제목(브라우저 탭 · 검색 결과)</span>
          <input className={inputClass} value={doc.seo.title} maxLength={60} onChange={(e) => change(setSeo(doc, { title: e.target.value }, nowIso()), 'seo-title')} data-testid="seo-title" />
        </label>
        <label className="flex flex-col">
          <span className="t-sub font-semibold text-slate-700">설명(검색 결과 두 줄)</span>
          <textarea className={`${inputClass} resize-y`} rows={3} value={doc.seo.description} maxLength={150} onChange={(e) => change(setSeo(doc, { description: e.target.value }, nowIso()), 'seo-desc')} data-testid="seo-description" />
        </label>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="t-card mb-1 font-semibold text-slate-900">업종 견본</legend>
        <p className="t-sub break-keep text-slate-600">지금: {industryDef(doc.industry).label}. 다른 업종 견본으로 처음부터 다시 만들 수 있어요(고친 내용은 사라져요 — 되돌리기로 돌아올 수 있어요).</p>
        <div className="flex flex-wrap gap-2">
          <select className={`${inputClass} mt-0 w-auto`} defaultValue={doc.industry} id="redraft-industry" data-testid="redraft-industry">
            {INDUSTRIES.map((i) => (
              <option key={i.key} value={i.key}>
                {i.label}
              </option>
            ))}
          </select>
          <Button onClick={() => setRedraft((document.getElementById('redraft-industry') as HTMLSelectElement | null)?.value as IndustryKey)} data-testid="redraft">
            <RefreshCw className="size-4" aria-hidden="true" /> 이 견본으로 다시 만들기
          </Button>
        </div>
      </fieldset>
    </div>
  )

  /* ---- 점검 ---- */
  const checksTab = (
    <div className="flex flex-col gap-2" data-testid="site-checks">
      {checks.length === 0 && <p className="t-body text-emerald-700">점검할 것이 없어요. 내려받아도 됩니다.</p>}
      {checks.map((c) => (
        <div key={c.key} className={`flex flex-wrap items-start gap-2 rounded-(--radius-control) border p-3 ${c.level === 'must' ? 'border-danger-200 bg-danger-50' : c.level === 'should' ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'}`} data-testid="site-check" data-level={c.level} data-key={c.key}>
          <span className={`t-meta shrink-0 rounded-full px-2 py-0.5 font-bold ${c.level === 'must' ? 'bg-danger-600 text-white' : c.level === 'should' ? 'bg-amber-500 text-white' : 'bg-slate-400 text-white'}`}>
            {c.level === 'must' ? '꼭' : c.level === 'should' ? '확인' : '참고'}
          </span>
          <p className="t-sub min-w-0 flex-1 break-keep text-slate-800">{c.text}</p>
          <div className="flex gap-2">
            {c.fix === 'useContactPhone' && (
              <Button size="sm" onClick={() => change(withContactPhone(doc, record.contactPhone, nowIso()))} data-testid="fix-contact-phone">
                담당자 번호 넣기
              </Button>
            )}
            {c.blockId && (
              <Button size="sm" variant="ghost" onClick={() => selectBlock(c.blockId as string)} data-testid="check-open">
                열기
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  )

  // D-227 단계 — 탭 이름 대신 ① ② ③(아무 단계나 눌러 가도 된다 · 순서만 알려 준다)
  const tabs: { key: Tab; label: string; sub: string }[] = [
    { key: 'blocks', label: '내용 고치기', sub: `블록 ${doc.blocks.length}` },
    { key: 'style', label: '꾸미기', sub: STYLE_PRESETS.find((sp) => sp.key === nowStyle)?.label ?? '색 · 글꼴' },
    { key: 'checks', label: '내려받기', sub: must ? `꼭 고칠 것 ${must}` : should ? `확인 ${should}` : '통과' },
  ]
  const at = tabs.findIndex((t) => t.key === tab)
  const goTab = (k: Tab) => {
    setTab(k)
    window.setTimeout(() => document.querySelector('[data-testid="site-steps"]')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 30)
  }
  /** 단계 끝 [다음 단계] — ③ 에서는 내려받기 · 새 창 보기를 크게 */
  const stepFoot =
    at < tabs.length - 1 ? (
      <button type="button" onClick={() => goTab(tabs[at + 1].key)} className={`${MK_PRIMARY.emerald} w-full justify-center`} data-testid="site-next" data-to={tabs[at + 1].key}>
        다음 단계 · {tabs[at + 1].label}
        <ArrowRight className="size-4" aria-hidden="true" />
      </button>
    ) : (
      <div className="flex flex-col gap-2 rounded-(--radius-control) border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-3" data-testid="site-finish">
        <p className="t-sub break-keep text-emerald-900">
          <b className="font-bold">{must ? `꼭 고칠 것 ${must}개를 고친 뒤 내려받는 것이 좋아요.` : '다 됐어요 — 내려받아 업체에 보내거나 올려 주세요.'}</b> 내려받은 HTML 파일 하나가 홈페이지 전체예요.
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={`${MK_PRIMARY.emerald} flex-1 justify-center`} onClick={() => void onDownload()} data-testid="site-finish-download">
            <Download className="size-4" aria-hidden="true" /> HTML 내려받기
          </button>
          <Button size="sm" onClick={onOpen} data-testid="site-finish-open">
            <ExternalLink className="size-4" aria-hidden="true" /> 새 창으로 보기
          </Button>
        </div>
      </div>
    )

  const editor = (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex items-stretch gap-1 rounded-(--radius-control) bg-emerald-50 p-1 ring-1 ring-emerald-100" role="tablist" aria-label="홈페이지 만들기 단계" data-testid="site-steps" data-current={tab}>
        {tabs.map((t, i) => {
          const on = tab === t.key
          return (
            <button key={t.key} type="button" role="tab" aria-selected={on} onClick={() => goTab(t.key)} className={`tap flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-(--radius-control) px-1 py-1.5 text-center ${on ? 'bg-emerald-700 text-white shadow-sm' : 'text-emerald-900 hover:bg-white/70'}`} data-testid={`site-tab-${t.key}`} data-step={i + 1}>
              <span className="t-sub flex items-center gap-1 font-bold break-keep">
                <span className={`flex size-5 shrink-0 items-center justify-center rounded-full text-xs tabular-nums ${on ? 'bg-white text-emerald-800' : 'bg-emerald-700 text-white'}`}>{i + 1}</span>
                {t.label}
              </span>
              <span className={`t-meta flex items-center gap-1 break-keep ${on ? 'text-white/90' : t.key === 'checks' && must ? 'font-semibold text-danger-700' : 'text-emerald-800'}`}>
                {t.key === 'blocks' ? <LayoutGrid className="size-3.5" aria-hidden="true" /> : t.key === 'style' ? <Palette className="size-3.5" aria-hidden="true" /> : must ? <AlertTriangle className="size-3.5" aria-hidden="true" /> : <CheckCircle2 className="size-3.5" aria-hidden="true" />}
                {t.sub}
              </span>
            </button>
          )
        })}
      </div>
      {tab === 'blocks' ? blocksTab : tab === 'style' ? styleTab : checksTab}
      {stepFoot}
    </div>
  )

  const preview = (
    <div className="flex min-w-0 flex-col gap-2 lg:sticky lg:top-20">
      <div className="flex items-center gap-2">
        {(['pc', 'mobile'] as const).map((d) => (
          <button key={d} type="button" aria-pressed={device === d} onClick={() => setDevice(d)} className={`tap t-sub inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-control) border px-3 font-semibold ${device === d ? onSoft : 'border-slate-300 text-slate-600'}`} data-testid={`preview-${d}`}>
            {d === 'pc' ? <Monitor className="size-4" aria-hidden="true" /> : <Smartphone className="size-4" aria-hidden="true" />}
            {d === 'pc' ? 'PC' : '휴대폰'}
          </button>
        ))}
        <span className="t-meta ml-auto break-keep text-slate-500">{phone ? '블록을 누르면 고치기 화면에서 열려요' : big ? '블록을 누르면 고치기 칸이 다시 열려요' : '블록을 누르면 왼쪽에서 열려요'}</span>
        {!phone && (
          <Button size="sm" onClick={() => setBig((v) => !v)} aria-pressed={big} data-testid="preview-big">
            {big ? <Minimize2 className="size-4" aria-hidden="true" /> : <Maximize2 className="size-4" aria-hidden="true" />}
            {big ? '고치기 칸 같이 보기' : '미리보기 크게'}
          </Button>
        )}
      </div>
      <SitePreview doc={doc} device={device} selectedId={selected} onSelect={selectBlock} height={phone ? 620 : big ? 860 : 760} />
    </div>
  )

  return (
    <div className="flex flex-col gap-4" data-testid="site-builder">
      {/* D-226 머리 띠 — 누구 홈페이지 · 어떤 견본 · 블록 · 점수가 한눈에, 아래에 도구줄 */}
      <section className="overflow-hidden rounded-(--radius-panel) border border-slate-200 bg-white shadow-sm">
        <MkHero
          tone="emerald"
          icon={Globe}
          eyebrow={`홈페이지 · ${industryDef(doc.industry).label} 견본`}
          title={record.companyName}
          stats={[
            { label: '보이는 블록', value: `${visibleCount}개`, testId: 'site-stat-blocks' },
            ...(score ? [{ label: '점수', value: `${score.score}점`, testId: 'site-stat-score' }] : []),
            { label: '점검', value: must ? `꼭 고칠 것 ${must}` : should ? `확인 ${should}` : '통과', testId: 'site-stat-checks' },
          ]}
          testId="site-hero"
        />
        <div className="p-3 sm:p-4">{toolbar}</div>
      </section>
      {mismatch && (
        <div className="flex flex-wrap items-center gap-3 rounded-(--radius-panel) border border-amber-200 bg-amber-50 p-3 sm:p-4" data-testid="site-industry-mismatch" data-detected={detected}>
          <AlertTriangle className="size-5 shrink-0 text-amber-600" aria-hidden="true" />
          <p className="t-body min-w-0 flex-1 break-keep text-amber-900">
            업체 기록으로 보면 <b>{industryDef(detected).label}</b> 업종이에요. 지금은 {industryDef(doc.industry).label} 견본이라 첫 화면 문구가 안 맞을 수 있어요.
          </p>
          <Button size="sm" variant="primary" onClick={() => setRedraft(detected)} data-testid="site-industry-fix">
            맞는 견본으로 바꾸기
          </Button>
        </div>
      )}
      {score && (
        <section className={`flex flex-col gap-3 rounded-(--radius-panel) border-2 p-3 shadow-sm sm:flex-row sm:items-center sm:gap-4 sm:p-4 ${score.score >= 80 ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50' : score.score >= 50 ? 'border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50' : 'border-danger-200 bg-gradient-to-br from-danger-50 to-rose-50'}`} data-testid="site-score" data-score={score.score}>
          <div className="flex shrink-0 items-center gap-3">
            {/* D-226 점수만큼 차오르는 고리 */}
            <span
              className="relative flex size-16 shrink-0 items-center justify-center rounded-full"
              style={{ background: `conic-gradient(${score.score >= 80 ? '#059669' : score.score >= 50 ? '#f59e0b' : '#dc2626'} ${Math.round(score.score * 3.6)}deg, #e2e8f0 0)` }}
              aria-hidden="true"
            >
              <span className={`flex size-12 flex-col items-center justify-center rounded-full bg-white ${score.score >= 80 ? 'text-emerald-700' : score.score >= 50 ? 'text-amber-700' : 'text-danger-700'}`}>
                <span className="text-lg leading-none font-bold tabular-nums">{score.score}</span>
                <span className="t-meta leading-none">점</span>
              </span>
            </span>
            <span className="min-w-0">
              <span className="t-card flex items-center gap-1.5 font-semibold text-slate-900">
                <Gauge className="size-4 text-emerald-700" aria-hidden="true" />
                홈페이지 점수 {score.score}점
              </span>
              <span className="t-meta block break-keep text-slate-500">손님이 믿고 연락하기까지 필요한 것 11가지(우리 기준 · 검색 순위 점수 아님)</span>
            </span>
          </div>
          {score.next.length > 0 ? (
            <div className="flex min-w-0 flex-1 flex-col gap-1.5" data-testid="site-score-next">
              <span className="t-meta font-semibold text-slate-600">이것만 하면</span>
              <div className="flex flex-wrap gap-1.5">
                {(scoreOpen ? score.next : score.next.slice(0, 1)).map((it) => (
                  <button key={it.key} type="button" onClick={() => openScore(it)} title={it.how} className="tap t-sub inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-(--radius-control) border border-emerald-200 bg-white px-3 text-left font-semibold text-emerald-900 shadow-sm hover:border-emerald-400" data-testid="site-score-item" data-key={it.key}>
                    <span className="t-meta shrink-0 rounded-full bg-emerald-700 px-1.5 font-bold text-white tabular-nums">+{it.points}</span>
                    <span className="min-w-0 break-keep">{it.label}</span>
                    <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
                  </button>
                ))}
                {score.next.length > 1 && (
                  <button type="button" onClick={() => setScoreOpen(!scoreOpen)} aria-expanded={scoreOpen} className="tap t-sub inline-flex min-h-11 items-center gap-1 rounded-(--radius-control) px-2 font-semibold text-emerald-800 hover:bg-white/70" data-testid="site-score-more">
                    {scoreOpen ? '접기' : `${score.next.length - 1}개 더 보기`}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <p className="t-sub font-semibold text-emerald-700">다 갖췄어요 — 내려받아 올려도 좋아요.</p>
          )}
        </section>
      )}
      {phone ? (
        <>
          <div className="flex gap-1 rounded-(--radius-control) bg-slate-100 p-1">
            {(['edit', 'preview'] as const).map((p) => (
              <button key={p} type="button" aria-pressed={pane === p} onClick={() => setPane(p)} className={`tap t-sub min-h-11 flex-1 rounded-(--radius-control) font-semibold ${pane === p ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`} data-testid={`pane-${p}`}>
                {p === 'edit' ? '고치기' : '미리보기'}
              </button>
            ))}
          </div>
          {pane === 'edit' ? editor : preview}
        </>
      ) : (
        <div className={`grid items-start gap-4 ${big ? '' : 'lg:grid-cols-[minmax(340px,420px)_minmax(0,1fr)]'}`} data-big={big}>
          {!big && editor}
          {preview}
        </div>
      )}

      {adding && (
        <BottomSheet title="블록 더하기" onClose={() => setAdding(false)}>
          <div className="flex flex-col gap-2 p-4" data-testid="block-palette">
            <p className="t-sub break-keep text-slate-600">{selected ? '고른 블록 바로 아래에 더해요.' : '맨 아래 줄 바로 위에 더해요.'}</p>
            {BLOCK_DEFS.filter((d) => !(d.single && doc.blocks.some((b) => b.type === d.type))).map((d) => (
              <button
                key={d.type}
                type="button"
                onClick={() => {
                  const b = newBlock(d.type as BlockType, record, doc.industry, today, generateId())
                  change(insertBlock(doc, b, selected, nowIso()))
                  setSelected(b.id)
                  setAdding(false)
                  setTab('blocks')
                }}
                className={`tap flex min-h-14 items-center gap-3 rounded-(--radius-control) border border-slate-200 px-3 py-2 text-left hover:bg-slate-50 ${TONE[BLOCK_STYLE[d.type as BlockType].tone].hover}`}
                data-testid="palette-item"
                data-type={d.type}
              >
                <MkIcon icon={BLOCK_STYLE[d.type as BlockType].icon} tone={BLOCK_STYLE[d.type as BlockType].tone} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="t-card font-semibold text-slate-900">{d.label}</span>
                  <span className="t-meta text-slate-500">{d.desc}</span>
                </span>
              </button>
            ))}
          </div>
        </BottomSheet>
      )}
      <ConfirmModal
        open={removing !== null}
        title="이 블록을 지울까요?"
        message={removing ? `${blockDef(removing.type)?.label ?? ''} 블록을 지웁니다. 지운 뒤에도 [되돌리기] 로 돌아올 수 있어요.` : ''}
        confirmLabel="지우기"
        danger
        onConfirm={() => {
          if (removing) change(removeBlock(doc, removing.id, nowIso()))
          if (removing && selected === removing.id) setSelected(null)
          setRemoving(null)
        }}
        onCancel={() => setRemoving(null)}
      />
      <ConfirmModal
        open={redraft !== null}
        title="견본으로 다시 만들까요?"
        message={redraft ? `${industryDef(redraft).label} 견본과 업체 기록으로 처음부터 다시 만들어요. 지금 고친 내용은 사라지지만 [되돌리기] 로 돌아올 수 있어요.` : ''}
        confirmLabel="다시 만들기"
        onConfirm={() => {
          if (redraft) {
            const d = draftSite(record, { industry: redraft, today, now: nowIso(), makeId: generateId })
            change({ ...d, createdAt: doc.createdAt })
            setSelected(null)
            setTab('blocks')
          }
          setRedraft(null)
        }}
        onCancel={() => setRedraft(null)}
      />
      <ConfirmModal
        open={leaveRoute.state === 'blocked'}
        title="저장하지 못한 홈페이지가 있어요"
        message="마지막으로 고친 것을 아직 저장하지 못했어요. 지금 나가면 그 내용이 사라져요."
        confirmLabel="저장하지 않고 나가기"
        cancelLabel="남아서 다시 저장"
        danger
        onConfirm={() => leaveRoute.proceed?.()}
        onCancel={() => {
          leaveRoute.reset?.()
          retrySave()
        }}
      />
    </div>
  )
}
