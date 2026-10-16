/**
 * 홈페이지 만들기 화면 (D-202).
 *
 * 처음: 업체 기록으로 무엇이 채워질지 보여 주고 [초안 만들기] 한 번.
 * 그다음: 왼쪽 블록 목록(누르면 칸이 펼쳐짐 · 위아래 · 복사 · 숨기기 · 지우기) / 오른쪽 PC · 휴대폰 미리보기(블록을 누르면 왼쪽에서 열림).
 * 꾸밈(색 · 글꼴 · 모서리 · 검색 정보) · 점검(꼭 고칠 것 · 확인할 것) 탭. [HTML 내려받기] · [새 창으로 보기] · [업체 기록에 붙이기].
 * 휴대폰에서는 [고치기 | 미리보기] 를 번갈아 본다.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowDown, ArrowUp, Check, CheckCircle2, Copy, Download, ExternalLink, EyeOff, Maximize2, Minimize2, Monitor, Plus, Redo2, RefreshCw, Smartphone, Trash2, Undo2 } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { BottomSheet, Badge } from '../../components/ui/primitives'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { useToast } from '../../components/ui/toastContext'
import { useIsPhone } from '../../lib/useIsPhone'
import { nowIso, todayLocalDate } from '../../lib/appClock'
import { generateId } from '../../storage/localStore'
import {
  BLOCK_DEFS,
  CORNERS,
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
  type SiteBlock,
  type SiteDoc,
} from '../../services/siteBuilder'
import type { ClientOpsRecord } from '../../types/clientOps'
import { ToolResultAttach } from '../shared/ToolResultAttach'
import { BlockFields, IconBtn, inputClass } from './BlockFields'
import { SitePreview, type Device } from './SitePreview'
import type { SiteStore } from './useSiteDoc'

type Tab = 'blocks' | 'style' | 'checks'

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
    <section className="rounded-(--radius-panel) border border-slate-200 bg-white flex flex-col gap-4 p-5" data-testid="site-start">
      <div>
        <h2 className="t-section text-slate-900">업체 기록으로 홈페이지 초안을 만듭니다</h2>
        <p className="t-body mt-1 break-keep text-slate-600">
          아래 {rows.length}가지 중 {have}가지가 업체 기록에 있어요. 있는 것은 그대로 넣고, 없는 것은 비워 둔 채 점검에서 알려 드려요. 숫자 · 인증은 기록에 있을 때만 넣어요(지어내지 않아요).
        </p>
      </div>
      <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2" data-testid="site-start-facts">
        {rows.map(([k, v]) => (
          <div key={k} className="flex min-h-9 items-start gap-2 border-b border-slate-100 py-1.5">
            {v ? <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-label="있음" /> : <span className="mt-0.5 size-4 shrink-0 text-center text-slate-400" aria-label="없음">–</span>}
            <dt className="t-sub w-28 shrink-0 text-slate-500">{k}</dt>
            <dd className={`t-sub min-w-0 break-words ${v ? 'font-medium text-slate-800' : 'text-slate-400'}`}>{v || '없음'}</dd>
          </div>
        ))}
      </dl>
      {!f.phone && f.contactPhone && <p className="t-sub break-keep text-amber-800">회사 대표 전화가 없어요 — 담당자 휴대폰은 저절로 넣지 않아요. 만든 뒤 점검에서 넣을 수 있어요.</p>}
      <label className="flex flex-col sm:max-w-sm">
        <span className="t-sub font-semibold text-slate-700">업종 견본 {industry === detected && <span className="t-meta font-normal text-slate-500">(업체 기록으로 알아봄)</span>}</span>
        <select className={inputClass} value={industry} onChange={(e) => setIndustry(e.target.value as IndustryKey)} data-testid="site-industry">
          {INDUSTRIES.map((i) => (
            <option key={i.key} value={i.key}>
              {i.label}
            </option>
          ))}
        </select>
      </label>
      <div>
        <Button variant="primary" onClick={() => onStart(industry)} data-testid="site-create">
          초안 만들기
        </Button>
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
  const [selected, setSelected] = useState<string | null>(null)
  const [device, setDevice] = useState<Device>('pc')
  const [pane, setPane] = useState<'edit' | 'preview'>('edit')
  const [adding, setAdding] = useState(false)
  const [removing, setRemoving] = useState<SiteBlock | null>(null)
  const [redraft, setRedraft] = useState<IndustryKey | null>(null)
  // PC 미리보기 크게(왼쪽 고치기 칸을 접고 미리보기만) — D-205
  const [big, setBig] = useState(false)
  const doc = store.doc
  const today = todayLocalDate()

  const change = useCallback((next: SiteDoc, group?: string) => store.change(next, group), [store])

  const checks = useMemo(() => (doc ? siteChecks(doc, { contactPhone: record.contactPhone }) : []), [doc, record.contactPhone])
  const must = checks.filter((c) => c.level === 'must').length
  const should = checks.filter((c) => c.level === 'should').length

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
    if (store.save === 'error') showToast('저장하지 못했어요 — 적은 것은 이 화면에 남아 있어요. 잠시 뒤 다시 저장합니다.')
  }, [store.save, showToast])

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

  /* ---- 머리 도구줄 ---- */
  const toolbar = (
    <div className="flex flex-wrap items-center gap-2" data-testid="site-toolbar">
      <IconBtn label="되돌리기" disabled={!store.canUndo} onClick={store.undo} testId="site-undo">
        <Undo2 className="size-4" />
      </IconBtn>
      <IconBtn label="다시 하기" disabled={!store.canRedo} onClick={store.redo} testId="site-redo">
        <Redo2 className="size-4" />
      </IconBtn>
      <span className="t-meta text-slate-500" data-testid="site-save" data-state={store.save}>
        {store.save === 'saved' ? '저장됨' : store.save === 'saving' ? '저장하는 중…' : store.save === 'pending' ? '고친 것 저장 대기' : '저장 실패 — 다시 시도해요'}
      </span>
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
      <Button size="sm" onClick={onOpen} data-testid="site-open">
        <ExternalLink className="size-4" aria-hidden="true" /> 새 창으로 보기
      </Button>
      <Button size="sm" variant="primary" onClick={() => void onDownload()} data-testid="site-download">
        <Download className="size-4" aria-hidden="true" /> HTML 내려받기
      </Button>
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
    </div>
  )

  /* ---- 블록 목록 ---- */
  const blocksTab = (
    <div className="flex flex-col gap-2" data-testid="site-blocks">
      {doc.blocks.map((b, i) => {
        const def = blockDef(b.type)
        const open = selected === b.id
        const pinned = b.type === 'header' || b.type === 'footer'
        return (
          <div key={b.id} data-block-row={b.id} data-type={b.type} className={`rounded-(--radius-control) border bg-white ${open ? 'border-brand-400 shadow-sm' : 'border-slate-200'}`}>
            <button type="button" className="tap flex w-full min-h-14 items-center gap-3 px-3 py-2 text-left" onClick={() => setSelected(open ? null : b.id)} aria-expanded={open} data-testid="block-row">
              <span className="t-meta flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-100 font-semibold text-slate-600">{i + 1}</span>
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
                  onChange={(key, value, group) => change(setProp(doc, b.id, key, value, nowIso()), group)}
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
                    <input type="checkbox" className="size-4 accent-brand-600" checked={Boolean(b.hidePc)} onChange={(e) => change(setHidden(doc, b.id, 'pc', e.target.checked, nowIso()))} data-testid="block-hide-pc" />
                    <EyeOff className="size-4" aria-hidden="true" /> PC 숨김
                  </label>
                  <label className="tap t-sub inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-(--radius-control) border border-slate-300 px-3 text-slate-700">
                    <input type="checkbox" className="size-4 accent-brand-600" checked={Boolean(b.hideMobile)} onChange={(e) => change(setHidden(doc, b.id, 'mobile', e.target.checked, nowIso()))} data-testid="block-hide-mobile" />
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
        className="tap t-body inline-flex min-h-12 items-center justify-center gap-2 rounded-(--radius-control) border border-dashed border-brand-300 bg-brand-50 font-semibold text-brand-700 hover:bg-brand-100"
        data-testid="block-add"
      >
        <Plus className="size-5" aria-hidden="true" /> 블록 더하기
      </button>
    </div>
  )

  /* ---- 꾸밈 ---- */
  const styleTab = (
    <div className="flex flex-col gap-5" data-testid="site-style">
      <fieldset className="flex flex-col gap-2">
        <legend className="t-card mb-1 font-semibold text-slate-900">색</legend>
        <div className="grid grid-cols-2 gap-2">
          {PALETTES.map((p) => (
            <button
              key={p.key}
              type="button"
              aria-pressed={doc.theme.palette === p.key}
              onClick={() => change(setTheme(doc, { palette: p.key }, nowIso()))}
              className={`tap flex min-h-14 items-center gap-2.5 rounded-(--radius-control) border px-3 py-2 text-left ${doc.theme.palette === p.key ? 'border-brand-500 ring-2 ring-brand-200' : 'border-slate-200'}`}
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
            <button key={f.key} type="button" aria-pressed={doc.theme.font === f.key} onClick={() => change(setTheme(doc, { font: f.key }, nowIso()))} className={`tap t-sub min-h-11 rounded-(--radius-control) border px-4 font-medium ${doc.theme.font === f.key ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-slate-300 text-slate-700'}`} data-testid="theme-font" data-value={f.key}>
              {f.label}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="flex flex-col gap-2">
        <legend className="t-card mb-1 font-semibold text-slate-900">모서리</legend>
        <div className="flex flex-wrap gap-2">
          {CORNERS.map((c) => (
            <button key={c.key} type="button" aria-pressed={doc.theme.corner === c.key} onClick={() => change(setTheme(doc, { corner: c.key }, nowIso()))} className={`tap t-sub min-h-11 border px-4 font-medium ${doc.theme.corner === c.key ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-slate-300 text-slate-700'}`} style={{ borderRadius: Math.min(c.button, 22) }} data-testid="theme-corner" data-value={c.key}>
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

  const tabs: { key: Tab; label: string }[] = [
    { key: 'blocks', label: `블록 ${doc.blocks.length}` },
    { key: 'style', label: '꾸밈' },
    { key: 'checks', label: `점검${must + should ? ` ${must + should}` : ''}` },
  ]

  const editor = (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex gap-1 rounded-(--radius-control) bg-slate-100 p-1" role="tablist">
        {tabs.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)} className={`tap t-sub min-h-11 flex-1 rounded-(--radius-control) px-2 font-semibold ${tab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`} data-testid={`site-tab-${t.key}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'blocks' ? blocksTab : tab === 'style' ? styleTab : checksTab}
    </div>
  )

  const preview = (
    <div className="flex min-w-0 flex-col gap-2 lg:sticky lg:top-20">
      <div className="flex items-center gap-2">
        {(['pc', 'mobile'] as const).map((d) => (
          <button key={d} type="button" aria-pressed={device === d} onClick={() => setDevice(d)} className={`tap t-sub inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-control) border px-3 font-semibold ${device === d ? 'border-brand-500 bg-brand-50 text-brand-800' : 'border-slate-300 text-slate-600'}`} data-testid={`preview-${d}`}>
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
      {toolbar}
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
                className="tap flex min-h-14 flex-col items-start rounded-(--radius-control) border border-slate-200 px-3 py-2 text-left hover:border-brand-300 hover:bg-brand-50"
                data-testid="palette-item"
                data-type={d.type}
              >
                <span className="t-card font-semibold text-slate-900">{d.label}</span>
                <span className="t-meta text-slate-500">{d.desc}</span>
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
    </div>
  )
}
