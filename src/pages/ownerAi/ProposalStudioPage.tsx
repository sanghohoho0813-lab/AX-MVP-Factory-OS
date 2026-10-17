/**
 * 제안서 스튜디오 — AI 는 페이지 구성 · 글만 만들고, 글자는 OS 가 실제 글자(SVG text)로 그린다.
 *  - 페이지 하나만 고치고 다시 그린다(오타 하나에 전체를 다시 만들지 않는다). '전체 AI 재생성' 은 따로.
 *  - 내보내기 전 자동 점검(빈 페이지 · 넘침 · 자리표시자 · 회사명 불일치 · 제목 중복 · 이상한 문자 · 숫자 표기) + 맞춤법 검사.
 *  - PDF(인쇄 · 쪽마다 1280×720) · PNG(지금 페이지).
 */
import { useMemo, useRef, useState } from 'react'
import { DraftTextarea } from './parts/DraftTextarea'
import { tidyLines } from './parts/draftLines'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Download, FileText, Plus, Printer, SpellCheck, Trash2, Wand2 } from 'lucide-react'
import { applyFix, emptyPage, layoutPage, proofreadInput, proposalFrom, qaProposal, PAGE_H, PAGE_W, QA_LABEL, type Measure, type ProposalDoc, type ProposalPage, type QaIssue } from '../../services/ownerAi/proposal'
import { AiCallError } from '../../services/ownerAi/aiClient'
import { newUuid } from '../../services/ownerAi/caseUtil'
import { runSkill } from '../../services/ownerAi/workflow'
import { todayLocalDate } from '../../lib/appClock'
import { useToast } from '../../components/ui/toastContext'
import { Badge, ScreenTitle, Surface } from '../../components/ui/primitives'
import { Button } from '../../components/ui/Button'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { useUnsavedChangesGuard } from '../../lib/useUnsavedChangesGuard'
import { AiSetupBanner, OwnerAiGate, useAiSetup, useOwnerAiIdentity } from './shared'
import { PrintSheet, STUDIO_FONT, downloadBlob, safeFileName, svgToPng, useStudioRun } from './studioShared'

export default function ProposalStudioPage() {
  const { runId = '' } = useParams()
  return (
    <OwnerAiGate>
      <Studio key={runId} />
    </OwnerAiGate>
  )
}

/** 화면 글자 너비 — canvas 로 실제 글꼴 너비를 잰다(넘침 점검이 그림과 같다) */
function useMeasure(): Measure {
  return useMemo(() => {
    const ctx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null
    const cache = new Map<string, number>()
    return (text: string, px: number, weight: number) => {
      const k = `${weight}|${px}|${text}`
      const hit = cache.get(k)
      if (hit != null) return hit
      let w = 0
      if (ctx) {
        ctx.font = `${weight} ${px}px ${STUDIO_FONT}`
        w = ctx.measureText(text).width
      } else w = text.length * px
      if (cache.size > 4000) cache.clear()
      cache.set(k, w)
      return w
    }
  }, [])
}

const C = { ink: '#0f172a', sub: '#334155', mute: '#64748b', accent: '#9a7b4f', line: '#e2e8f0', soft: '#f8fafc' }

export function SlideSvg({ doc, page, index, measure, svgRef, className = '' }: { doc: ProposalDoc; page: ProposalPage; index: number; measure: Measure; svgRef?: React.Ref<SVGSVGElement>; className?: string }) {
  const lay = layoutPage(page, measure)
  return (
    <svg ref={svgRef} viewBox={`0 0 ${PAGE_W} ${PAGE_H}`} className={className} role="img" aria-label={`${index + 1}쪽 ${page.title}`} fontFamily={STUDIO_FONT} data-slide={index + 1}>
      <rect x="0" y="0" width={PAGE_W} height={PAGE_H} fill="#ffffff" />
      <rect x="72" y="56" width="56" height="6" fill={C.accent} />
      <text x="140" y="64" fontSize="18" fontWeight="600" fill={C.mute}>{doc.companyName}</text>
      <text x={PAGE_W - 72} y="64" fontSize="18" fontWeight="600" fill={C.mute} textAnchor="end">{index + 1} / {doc.pages.length}</text>
      {lay.title.lines.slice(0, 2).map((l, i) => (
        <text key={`t${i}`} x="72" y={lay.title.y + i * lay.title.lh} fontSize={lay.title.px} fontWeight="800" fill={C.ink}>{l}</text>
      ))}
      {lay.message.lines.slice(0, 2).map((l, i) => (
        <text key={`m${i}`} x="72" y={lay.message.y + i * lay.message.lh} fontSize={lay.message.px} fontWeight="600" fill={C.accent}>{l}</text>
      ))}
      {lay.bullets.map((b, i) => (
        <g key={`b${i}`}>
          {b.first && <circle cx="80" cy={b.y - 7} r="4" fill={C.sub} />}
          <text x="100" y={b.y} fontSize={lay.bulletPx} fontWeight="400" fill={C.sub}>{b.lines[0]}</text>
        </g>
      ))}
      {lay.numbers.map((n, i) => (
        <g key={`n${i}`}>
          <rect x={n.x} y={n.y} width={n.w} height="118" rx="14" fill={C.soft} stroke={C.line} />
          <text x={n.x + 22} y={n.y + 34} fontSize="18" fontWeight="600" fill={C.mute}>{n.label}</text>
          <text x={n.x + 22} y={n.y + 80} fontSize="40" fontWeight="800" fill={C.ink}>{n.value}</text>
          <text x={n.x + 22} y={n.y + 106} fontSize="14" fontWeight="500" fill={C.mute}>근거: {n.basis || '미확인'}</text>
        </g>
      ))}
      <text x="72" y={PAGE_H - 28} fontSize="14" fontWeight="500" fill={C.mute}>MIRAE AI LAB · {doc.purpose || '제안'}</text>
    </svg>
  )
}

function Studio() {
  const { caseId = '', runId = '' } = useParams()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { setup } = useAiSetup()
  const { userId } = useOwnerAiIdentity()
  const { state, save, repo } = useStudioRun(caseId, runId, 'SANGHO_PROPOSAL')
  const measure = useMeasure()
  const [doc, setDoc] = useState<ProposalDoc | null>(null)
  const [sel, setSel] = useState(0)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [fixes, setFixes] = useState<{ where: string; before: string; after: string; reason?: string; on: boolean }[] | null>(null)
  const [proofing, setProofing] = useState(false)
  const [regen, setRegen] = useState<'ask' | 'running' | null>(null)
  const [exportAsk, setExportAsk] = useState<null | 'pdf' | 'png'>(null)
  const [delAsk, setDelAsk] = useState(false)
  const svgRef = useRef<SVGSVGElement>(null)
  // D-219: 고친 글을 저장하지 않고 나가면 한 번 묻는다(작업실로 · 창 닫기) — 예전엔 말없이 사라졌다
  const { blocker, allowNavigation } = useUnsavedChangesGuard(dirty && !saving)

  // 처음 한 번 — 마지막으로 고친 제안서(있으면) 또는 AI 결과
  if (state.kind === 'ready' && doc === null) {
    const rev = state.bundle.latestRevision.get(state.run.id)?.content
    const d = proposalFrom(rev && typeof rev === 'object' ? rev : state.run.structured, state.bundle.c.companyName)
    setDoc(d.pages.length ? d : { ...d, pages: [emptyPage()] })
  }
  const issues: QaIssue[] = useMemo(() => (doc ? qaProposal(doc, measure) : []), [doc, measure])

  if (state.kind === 'loading') return <p className="t-sub text-slate-500" role="status">제안서를 여는 중…</p>
  if (state.kind !== 'ready' || !doc)
    return (
      <Surface>
        <p className="t-body text-slate-700">{state.kind === 'db_setup' ? 'AI 작업실 DB 설정이 필요합니다.' : state.kind === 'error' ? state.message : '이 제안서 결과를 찾지 못했습니다.'}</p>
        <Link to={`/ai/cases/${caseId}`} className="t-body tap mt-2 inline-flex min-h-11 items-center font-semibold text-brand-700">업체 작업실로</Link>
      </Surface>
    )

  const page = doc.pages[Math.min(sel, doc.pages.length - 1)]
  const setPage = (next: ProposalPage) => {
    setDoc({ ...doc, pages: doc.pages.map((p) => (p.id === next.id ? next : p)) })
    setDirty(true)
  }
  const persist = async (note: string, d = doc) => {
    if (saving) return false
    setSaving(true)
    try {
      await save(d, note)
      setDirty(false)
      showToast('저장했습니다 — 고친 판이 새 번호로 남고 원래 결과도 그대로입니다.')
      return true
    } catch (e) {
      showToast(e instanceof Error ? e.message : '저장하지 못했습니다.')
      return false
    } finally {
      setSaving(false)
    }
  }

  const proofread = async () => {
    if (proofing) return
    setProofing(true)
    try {
      const { run } = await runSkill({ repo, bundle: state.bundle, skill: 'PROOFREAD', input: { task: proofreadInput(doc) }, requestId: newUuid(), today: todayLocalDate(), userId })
      const list = Array.isArray((run.structured as { fixes?: unknown })?.fixes) ? ((run.structured as { fixes: { where: string; before: string; after: string; reason?: string }[] }).fixes) : []
      setFixes(list.map((f) => ({ ...f, on: true })))
      // D-219: 답을 읽지 못한 것(형식 다름)을 '고칠 곳 없음' 으로 알리지 않는다
      if (run.status === 'parse_fallback') showToast('맞춤법 결과를 읽지 못했습니다(답의 형식이 달랐습니다). 다시 눌러 주세요.')
      else if (!list.length) showToast('고칠 곳을 찾지 못했습니다.')
    } catch (e) {
      showToast(e instanceof AiCallError ? e.message : '맞춤법 검사를 하지 못했습니다.')
    } finally {
      setProofing(false)
    }
  }

  const applyFixes = async () => {
    if (!fixes) return
    let d = doc
    let applied = 0
    for (const f of fixes.filter((x) => x.on)) {
      const r = applyFix(d, f)
      d = r.doc
      if (r.applied) applied += 1
    }
    setDoc(d)
    setFixes(null)
    if (applied) await persist(`맞춤법 ${applied}곳 고침`, d)
    else showToast('적용할 수 있는 곳이 없었습니다(글이 그새 바뀌었을 수 있습니다).')
  }

  const doExport = async (kind: 'pdf' | 'png') => {
    setExportAsk(null)
    if (kind === 'pdf') {
      window.print()
      return
    }
    if (!svgRef.current) return
    const blob = await svgToPng(svgRef.current, PAGE_W, PAGE_H)
    if (blob) downloadBlob(blob, `${safeFileName(doc.companyName)}_제안서_${sel + 1}쪽.png`)
    else showToast('그림을 만들지 못했습니다.')
  }

  const regenerate = async () => {
    // D-219: 창에 '고친 글은 그대로 남습니다' 라고 했는데, 저장 전 고친 글은 새 판으로 넘어가며 사라졌다 — 먼저 저장한다
    if (dirty && !(await persist(`${sel + 1}쪽 수정`))) {
      setRegen(null)
      return
    }
    setRegen('running')
    try {
      const opts = (state.run.input.options ?? {}) as Record<string, string>
      const { run } = await runSkill({ repo, bundle: state.bundle, skill: 'SANGHO_PROPOSAL', input: { task: state.run.input.task, options: opts }, requestId: newUuid(), today: todayLocalDate(), userId })
      showToast('새 제안서 구성을 만들었습니다. 지난 판은 그대로 남습니다.')
      allowNavigation()
      navigate(`/ai/cases/${caseId}/proposal/${run.id}`)
    } catch (e) {
      showToast(e instanceof AiCallError ? e.message : '다시 만들지 못했습니다.')
      setRegen(null)
    }
  }

  const pageIssues = (i: number) => issues.filter((q) => q.page === i + 1)

  return (
    <div className="flex flex-col gap-4" data-testid="proposal-studio">
      <Link to={`/ai/cases/${caseId}`} className="t-sub tap inline-flex min-h-11 items-center gap-1 self-start font-semibold text-slate-600 hover:text-slate-900 no-print">
        <ChevronLeft aria-hidden="true" className="size-4" />
        {state.bundle.c.companyName} 작업실
      </Link>
      <ScreenTitle
        title="제안서 스튜디오"
        sub={`${doc.purpose || '제안서'} · ${doc.pages.length}쪽 · 글자는 OS 가 그립니다(이미지 생성 아님)`}
        actions={
          <>
            <Button variant="secondary" onClick={() => (issues.length ? setExportAsk('png') : void doExport('png'))} data-testid="export-png">
              <Download aria-hidden="true" className="size-4" />
              PNG
            </Button>
            <Button variant="primary" onClick={() => (issues.length ? setExportAsk('pdf') : void doExport('pdf'))} data-testid="export-pdf">
              <Printer aria-hidden="true" className="size-4" />
              PDF · 인쇄
            </Button>
          </>
        }
      />
      <AiSetupBanner setup={setup} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[13rem_minmax(0,1fr)_22rem]">
        {/* 페이지 목록 */}
        <div className="flex gap-2 overflow-x-auto xl:flex-col xl:overflow-visible" data-testid="slide-list">
          {doc.pages.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSel(i)}
              aria-pressed={sel === i}
              className={`tap relative w-40 shrink-0 rounded-(--radius-control) border bg-white p-1 text-left xl:w-full ${sel === i ? 'border-brand-500 ring-1 ring-brand-500' : 'border-slate-200'}`}
            >
              <SlideSvg doc={doc} page={p} index={i} measure={measure} className="block h-auto w-full" />
              <span className="t-meta mt-1 flex items-center gap-1 px-1 text-slate-600">
                {i + 1}. <span className="min-w-0 flex-1 truncate">{p.title || '(제목 없음)'}</span>
                {pageIssues(i).length > 0 && <Badge tone="warning">{pageIssues(i).length}</Badge>}
              </span>
            </button>
          ))}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              const p = emptyPage()
              setDoc({ ...doc, pages: [...doc.pages, p] })
              setSel(doc.pages.length)
              setDirty(true)
            }}
          >
            <Plus aria-hidden="true" className="size-4" />
            쪽 더하기
          </Button>
        </div>

        {/* 지금 페이지 */}
        <div className="flex min-w-0 flex-col gap-3">
          <div className="overflow-hidden rounded-(--radius-panel) border border-slate-200 bg-white shadow-sm">
            <SlideSvg doc={doc} page={page} index={sel} measure={measure} svgRef={svgRef} className="block h-auto w-full" />
          </div>
          {issues.length > 0 ? (
            <Surface className="flex flex-col gap-2">
              <h2 className="t-card font-bold text-slate-900">내보내기 전 점검 — {issues.length}곳</h2>
              <ul className="flex flex-col gap-1" data-testid="proposal-qa">
                {issues.map((q, i) => (
                  <li key={i}>
                    <button type="button" onClick={() => setSel(q.page - 1)} className="tap t-sub flex min-h-11 w-full items-center gap-2 text-left hover:bg-slate-50">
                      <Badge tone={q.kind === 'overflow' || q.kind === 'empty' || q.kind === 'company' ? 'danger' : 'warning'}>{q.page}쪽 · {QA_LABEL[q.kind]}</Badge>
                      <span className="min-w-0 flex-1 break-words text-slate-700">{q.text}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Surface>
          ) : (
            <p className="t-sub text-success-700" data-testid="proposal-qa-ok">점검 통과 — 빈 쪽 · 넘침 · 자리표시자 · 회사명 · 제목 중복 · 이상한 문자 · 숫자 표기 문제 없음</p>
          )}
        </div>

        {/* 이 페이지 고치기 */}
        <Surface className="flex flex-col gap-3">
          <h2 className="t-section text-slate-900">{sel + 1}쪽 고치기</h2>
          <PageEditor page={page} onChange={setPage} />
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" disabled={!dirty || saving} onClick={() => void persist(`${sel + 1}쪽 수정`)} data-testid="page-save">
              {saving ? '저장 중…' : '이 쪽 저장'}
            </Button>
            <Button variant="ghost" disabled={doc.pages.length <= 1} onClick={() => setDelAsk(true)}>
              <Trash2 aria-hidden="true" className="size-4" />
              이 쪽 빼기
            </Button>
          </div>
          <hr className="border-slate-100" />
          <Button variant="secondary" disabled={proofing || setup.state !== 'ready'} onClick={() => void proofread()} data-testid="proofread">
            <SpellCheck aria-hidden="true" className="size-4" />
            {proofing ? '검사 중…' : '맞춤법 · 오타 검사(빠르게)'}
          </Button>
          {fixes && fixes.length > 0 && (
            <div className="flex flex-col gap-2" data-testid="proofread-fixes">
              {fixes.map((f, i) => (
                <label key={i} className="tap flex min-h-11 items-start gap-2">
                  <input type="checkbox" className="mt-1 size-5 accent-brand-600" checked={f.on} onChange={(e) => setFixes(fixes.map((x, j) => (j === i ? { ...x, on: e.target.checked } : x)))} />
                  <span className="t-sub break-words text-slate-700">
                    <b>{f.where}</b> "{f.before}" → "{f.after}"{f.reason ? ` (${f.reason})` : ''}
                  </span>
                </label>
              ))}
              <Button size="sm" variant="primary" onClick={() => void applyFixes()}>고른 것 고치기</Button>
            </div>
          )}
          <Button variant="ghost" disabled={setup.state !== 'ready' || regen === 'running'} onClick={() => setRegen('ask')} data-testid="proposal-regen">
            <Wand2 aria-hidden="true" className="size-4" />
            {regen === 'running' ? '다시 만드는 중…' : '전체 AI 재생성'}
          </Button>
          <p className="t-meta break-keep text-slate-500">
            <FileText aria-hidden="true" className="mr-1 inline size-3.5" />
            시각 메모(이미지 자리)는 출력에 그리지 않습니다: {page.visual || '없음'}
          </p>
        </Surface>
      </div>

      <PrintSheet pageCss="size: 1280px 720px; margin: 0;">
        {doc.pages.map((p, i) => (
          <div key={p.id} style={{ width: PAGE_W, height: PAGE_H, breakAfter: 'page', pageBreakAfter: 'always' }}>
            <SlideSvg doc={doc} page={p} index={i} measure={measure} className="block" />
          </div>
        ))}
      </PrintSheet>

      <ConfirmModal
        open={blocker.state === 'blocked'}
        title="고친 글을 아직 저장하지 않았습니다"
        message="이 화면을 나가면 저장하지 않은 고친 글이 사라집니다. 나갈까요?"
        confirmLabel="저장하지 않고 나가기"
        cancelLabel="계속 고치기"
        danger
        onConfirm={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      />
      <ConfirmModal
        open={regen === 'ask'}
        title="전체 AI 재생성"
        message="같은 목적 · 쪽수로 제안서 구성을 처음부터 다시 만듭니다. 지금 판과 고친 글은 그대로 남고, 새 결과가 따로 생깁니다."
        warning="오타 하나 · 한 쪽만 고칠 때는 다시 만들지 말고 '이 쪽 고치기' 를 쓰세요(비용 · 시간)."
        confirmLabel="다시 만들기"
        onConfirm={() => void regenerate()}
        onCancel={() => setRegen(null)}
      />
      <ConfirmModal
        open={exportAsk !== null}
        title="점검에서 문제가 남았습니다"
        message={`${issues.length}곳 — ${[...new Set(issues.map((q) => QA_LABEL[q.kind]))].join(' · ')}. 그대로 내보낼까요?`}
        confirmLabel="그래도 내보내기"
        onConfirm={() => void doExport(exportAsk ?? 'pdf')}
        onCancel={() => setExportAsk(null)}
      />
      <ConfirmModal
        open={delAsk}
        title={`${sel + 1}쪽 빼기`}
        message="이 쪽을 제안서에서 뺍니다. 저장 전에는 되돌릴 수 있고, 저장해도 예전 판은 기록에 남습니다."
        confirmLabel="빼기"
        danger
        onConfirm={() => {
          setDoc({ ...doc, pages: doc.pages.filter((_, i) => i !== sel) })
          setSel(Math.max(0, sel - 1))
          setDirty(true)
          setDelAsk(false)
        }}
        onCancel={() => setDelAsk(false)}
      />
    </div>
  )
}

function PageEditor({ page, onChange }: { page: ProposalPage; onChange: (p: ProposalPage) => void }) {
  const input = 't-body w-full rounded-(--radius-control) border border-slate-300 px-3 py-2'
  return (
    <div className="flex flex-col gap-3" key={page.id}>
      <label className="flex flex-col gap-1">
        <span className="t-sub font-semibold text-slate-700">제목</span>
        <textarea rows={2} value={page.title} onChange={(e) => onChange({ ...page, title: e.target.value })} className={input} data-testid="page-title" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="t-sub font-semibold text-slate-700">핵심 메시지</span>
        <textarea rows={2} value={page.message} onChange={(e) => onChange({ ...page, message: e.target.value })} className={input} data-testid="page-message" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="t-sub font-semibold text-slate-700">본문(한 줄에 하나)</span>
        <DraftTextarea rows={5} value={page.bullets} toText={(v) => v.join('\n')} fromText={(t) => tidyLines(t)} onValue={(v) => onChange({ ...page, bullets: v })} className={input} data-testid="page-bullets" />
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className="t-sub font-semibold text-slate-700">핵심 수치(최대 3개 · 근거 꼭)</legend>
        {page.keyNumbers.map((k, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr] gap-1.5">
            <input value={k.label} onChange={(e) => onChange({ ...page, keyNumbers: page.keyNumbers.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} placeholder="이름" className={`${input} min-h-11`} />
            <input value={k.value} onChange={(e) => onChange({ ...page, keyNumbers: page.keyNumbers.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })} placeholder="값" className={`${input} min-h-11`} />
            <input value={k.basis} onChange={(e) => onChange({ ...page, keyNumbers: page.keyNumbers.map((x, j) => (j === i ? { ...x, basis: e.target.value } : x)) })} placeholder="근거(업체 사실 · AI 추정 · 미확인)" className={`${input} col-span-2 min-h-11`} />
          </div>
        ))}
        <div className="flex gap-2">
          {page.keyNumbers.length < 3 && (
            <Button size="sm" variant="ghost" onClick={() => onChange({ ...page, keyNumbers: [...page.keyNumbers, { label: '', value: '', basis: '미확인' }] })}>수치 더하기</Button>
          )}
          {page.keyNumbers.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => onChange({ ...page, keyNumbers: page.keyNumbers.slice(0, -1) })}>마지막 수치 빼기</Button>
          )}
        </div>
      </fieldset>
    </div>
  )
}
