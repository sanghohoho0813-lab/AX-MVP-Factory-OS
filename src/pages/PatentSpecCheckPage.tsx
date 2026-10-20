/**
 * D-245 명세서 점검 — 특허로에 넣기 전에 형식 · 도면 · 청구항이 서로 맞는지(규칙 점검 · AI 없음).
 *
 * 파일은 이 브라우저 안에서만 읽는다(서버로 보내지 않는다). .hwpx · 복붙용 .md · .txt.
 * 결과는 고쳐야 함 → 주의 → 참고 순. 걸린 곳을 누르면 그 문단 글을 바로 아래에 보여 준다.
 * 최종 PASS 는 특허로 편집기 오류검사 0건 + 최종 미리보기다 — 이 화면은 그 전에 걸러 주는 것.
 */
import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, FileSearch, FileUp, Search } from 'lucide-react'
import { Badge, Disclosure, ScreenTitle, Surface, type Tone } from '../components/ui/primitives'
import { Button } from '../components/ui/Button'
import { parseSpecFile, parseSpecText, type SpecDoc } from '../services/patent/specParse'
import { checkSpec, type Finding, type Level, type SpecReport } from '../services/patent/specCheck'
import { findEditorCodes, EDITOR_CODES } from '../services/patent/editorCodes'

const LEVEL: Record<Level, { label: string; tone: Tone }> = {
  error: { label: '고쳐야 함', tone: 'danger' },
  warn: { label: '주의', tone: 'warning' },
  info: { label: '참고', tone: 'neutral' },
}

const MAX_BYTES = 30 * 1024 * 1024

function FindingCard({ f, doc }: { f: Finding; doc: SpecDoc }) {
  const [open, setOpen] = useState<number | null>(null)
  const lv = LEVEL[f.level]
  const para = open != null ? doc.paras.find((p) => p.idx === open) : undefined
  const around = open != null ? doc.paras.filter((p) => p.idx >= open - 1 && p.idx <= open + 1) : []
  return (
    <li data-finding={f.id}>
    <Surface showEdge edge={lv.tone} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={lv.tone}>{lv.label}</Badge>
        {f.code && <Badge tone="neutral">{f.code}</Badge>}
      </div>
      <p className="t-card break-keep text-slate-900 [overflow-wrap:anywhere]">{f.title}</p>
      {f.detail && <p className="t-sub break-keep text-slate-600 [overflow-wrap:anywhere]">{f.detail}</p>}
      <p className="t-sub break-keep text-slate-800 [overflow-wrap:anywhere]">
        <span className="font-semibold">고치는 법 </span>
        {f.fix}
      </p>
      {f.where.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {f.where.map((w, i) =>
            w.paraIdx != null ? (
              <button
                key={i}
                type="button"
                aria-expanded={open === w.paraIdx}
                onClick={() => setOpen(open === w.paraIdx ? null : (w.paraIdx ?? null))}
                className={`tap t-meta max-w-full rounded-full border px-2.5 py-1 text-left break-keep [overflow-wrap:anywhere] ${open === w.paraIdx ? 'border-brand-400 bg-brand-50 text-brand-800' : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-brand-300'}`}
              >
                {w.label}
              </button>
            ) : (
              <span key={i} className="t-meta rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-700">
                {w.label}
              </span>
            ),
          )}
        </div>
      )}
      {para && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3" data-para-view>
          <p className="t-meta mb-1 text-slate-500">문서 속 그 자리(앞뒤 한 문단씩)</p>
          {around.map((p) => (
            <p key={p.idx} className={`t-sub break-keep whitespace-pre-wrap [overflow-wrap:anywhere] ${p.idx === open ? 'font-semibold text-slate-900' : 'text-slate-500'}`}>
              {p.images.length > 0 ? '〔그림〕' : p.table ? '〔표〕' : p.text.trim() ? p.text : '〔빈 문단〕'}
            </p>
          ))}
        </div>
      )}
    </Surface>
    </li>
  )
}

function SummaryCard({ doc, r }: { doc: SpecDoc; r: SpecReport }) {
  const s = r.summary
  const rows: Array<[string, string]> = [
    ['청구항', s.claims ? `${s.claims}개(독립 ${s.independent} · 종속 ${s.dependent})` : '없음'],
    ['도면', s.figs.length ? `${s.figs.length}장(도 ${s.figs[0]}~도 ${s.figs[s.figs.length - 1]})` : doc.kind === 'text' ? '글에는 도면 칸 없음' : '없음'],
    ['도면의 간단한 설명', s.drawingDesc.length ? `도 ${s.drawingDesc.join(', 도 ')}` : '없음'],
    ['대표도', s.repFig || '없음'],
    ['문단 번호', s.paraNumbers ? `${s.paraNumbers}개` : '쓰지 않음'],
    ['요약', s.abstractChars ? `${s.abstractChars}자` : '없음'],
  ]
  return (
    <div data-summary>
    <Surface className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="t-meta text-slate-500 [overflow-wrap:anywhere]">{doc.fileName}</span>
      </div>
      {s.title && (
        <div>
          <p className="t-card break-keep text-slate-900 [overflow-wrap:anywhere]">{s.title}</p>
          {s.titleEn && <p className="t-meta mt-0.5 text-slate-500 [overflow-wrap:anywhere]">{s.titleEn}</p>}
        </div>
      )}
      <div className="flex flex-wrap gap-2" data-counts>
        <Badge tone={r.counts.error ? 'danger' : 'success'}>고쳐야 함 {r.counts.error}</Badge>
        <Badge tone={r.counts.warn ? 'warning' : 'neutral'}>주의 {r.counts.warn}</Badge>
        <Badge tone="neutral">참고 {r.counts.info}</Badge>
      </div>
      {r.clean ? (
        <p className="t-body flex items-start gap-2 break-keep text-success-700">
          <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          고쳐야 할 것은 없습니다. 최종 확인은 특허로 편집기 오류검사 0건 + 최종 미리보기입니다.
        </p>
      ) : (
        <p className="t-body break-keep text-danger-700">특허로에 넣기 전에 '고쳐야 함' {r.counts.error}개를 먼저 고치세요.</p>
      )}
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex min-w-0 gap-2">
            <dt className="t-sub shrink-0 text-slate-500">{k}</dt>
            <dd className="t-sub min-w-0 break-keep text-slate-900 [overflow-wrap:anywhere]">{v}</dd>
          </div>
        ))}
      </dl>
    </Surface>
    </div>
  )
}

function CodeHelper() {
  const [q, setQ] = useState('')
  const hits = useMemo(() => findEditorCodes(q), [q])
  return (
    <Disclosure title="특허로 오류 코드로 찾기" hint="E-249 · S-010 …">
      <label className="t-sub block text-slate-600" htmlFor="editor-code">
        편집기 오류검사에 뜬 코드를 넣으세요(여러 개면 한 줄에 같이).
      </label>
      <div className="mt-2 flex items-center gap-2">
        <Search aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
        <input
          id="editor-code"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="예: E-249 E-261 S-010"
          className="t-body h-11 min-w-0 flex-1 rounded-lg border border-slate-300 px-3"
        />
      </div>
      {q.trim() && hits.length === 0 && <p className="t-sub mt-3 text-slate-500">아는 코드가 아닙니다. 편집기 메시지 · 최신 매뉴얼을 확인하세요. 알고 있는 코드: {EDITOR_CODES.map((c) => c.code).join(' · ')}</p>}
      {hits.length > 1 && <p className="t-sub mt-3 break-keep text-slate-700">여러 개면 위에서부터 푸세요 — 위쪽 구조 오류 하나가 아래 오류를 여러 개 만듭니다.</p>}
      <ol className="mt-3 flex flex-col gap-2" data-code-hits>
        {hits.map((c) => (
          <li key={c.code} className="rounded-lg border border-slate-200 p-3">
            <p className="t-card text-slate-900">{c.code}</p>
            <p className="t-sub mt-1 break-keep text-slate-600">{c.cause}</p>
            <p className="t-sub mt-1 break-keep text-slate-900"><span className="font-semibold">먼저 </span>{c.fix}</p>
            <p className="t-sub mt-1 break-keep text-slate-500"><span className="font-semibold">다음부터 </span>{c.prevent}</p>
          </li>
        ))}
      </ol>
    </Disclosure>
  )
}

/** back: 어디서 왔는지(D-247 메뉴 '특허 · 벤처' 에서 열면 그리로) — 없으면 특허·MVP */
export function PatentSpecCheckPage({ back = { to: '/studio', label: '특허·MVP' } }: { back?: { to: string; label: string } } = {}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [doc, setDoc] = useState<SpecDoc | null>(null)
  const [report, setReport] = useState<SpecReport | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [drag, setDrag] = useState(false)
  const [paste, setPaste] = useState('')

  const run = (d: SpecDoc) => {
    setDoc(d)
    setReport(checkSpec(d))
    setError('')
  }

  const readFile = async (file: File | undefined) => {
    if (!file) return
    if (file.size > MAX_BYTES) {
      setError('파일이 너무 큽니다(30MB 까지).')
      return
    }
    setBusy(true)
    try {
      run(await parseSpecFile(file.name, new Uint8Array(await file.arrayBuffer())))
    } catch (cause) {
      setDoc(null)
      setReport(null)
      setError(cause instanceof Error ? cause.message : '읽지 못했습니다.')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const grouped = useMemo(() => {
    const out: Record<Level, Finding[]> = { error: [], warn: [], info: [] }
    for (const f of report?.findings ?? []) out[f.level].push(f)
    return out
  }, [report])

  return (
    <div className="flex flex-col gap-5">
      <ScreenTitle
        title="명세서 점검"
        sub="특허로에 넣기 전에 형식 · 도면 · 청구항이 서로 맞는지 봅니다. 규칙 점검이라 AI 를 쓰지 않습니다."
        back={
          <Link to={back.to} className="t-sub inline-flex min-w-0 items-center gap-1 text-slate-500 hover:text-slate-800" data-testid="spec-back">
            <ArrowLeft aria-hidden="true" className="size-4 shrink-0" />
            {back.label}
          </Link>
        }
      />

      <label
        htmlFor="spec-file"
        onDragOver={(e) => {
          e.preventDefault()
          setDrag(true)
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDrag(false)
          void readFile(e.dataTransfer.files?.[0])
        }}
        className={`tap flex cursor-pointer flex-col items-center gap-2 rounded-(--radius-panel) border-2 border-dashed px-4 py-7 text-center ${drag ? 'border-brand-400 bg-brand-50' : 'border-slate-300 bg-white hover:border-brand-300'}`}
      >
        <FileUp aria-hidden="true" className="size-7 text-brand-600" />
        <span className="t-card break-keep text-slate-900">{busy ? '읽는 중…' : '명세서 파일 올리기'}</span>
        <span className="t-sub break-keep text-slate-500">특허로 .hwpx · 복붙용 .md · .txt — 끌어다 놓거나 눌러서 고르기</span>
        <span className="t-meta break-keep text-slate-400">파일은 이 브라우저 안에서만 읽습니다(서버로 보내지 않음).</span>
        <input id="spec-file" ref={inputRef} type="file" accept=".hwpx,.md,.txt,.markdown" className="sr-only" onChange={(e) => void readFile(e.target.files?.[0])} />
      </label>

      <Disclosure title="글로 붙여 넣기" hint="복붙용 명세서 글">
        <textarea
          aria-label="명세서 글"
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          rows={8}
          placeholder={'【발명의 명칭】\n한글명칭{ENGLISH TITLE}\n【기술분야】\n…'}
          className="t-body w-full rounded-lg border border-slate-300 p-3"
        />
        <Button variant="primary" className="mt-2" disabled={!paste.trim()} onClick={() => run(parseSpecText(paste, '붙여 넣은 글'))}>
          <FileSearch aria-hidden="true" className="size-4" />
          이 글 점검하기
        </Button>
      </Disclosure>

      {error && (
        <p role="alert" className="t-body break-keep rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-danger-700">
          {error}
        </p>
      )}

      {doc && report && (
        <section className="flex flex-col gap-4" aria-label="점검 결과">
          <SummaryCard doc={doc} r={report} />
          {(['error', 'warn', 'info'] as Level[]).map((lv) =>
            grouped[lv].length === 0 ? null : (
              <div key={lv} className="flex flex-col gap-2" data-level={lv}>
                <h2 className="t-section text-slate-900">
                  {LEVEL[lv].label} <span className="text-slate-400">{grouped[lv].length}</span>
                </h2>
                <ul className="flex flex-col gap-2.5">
                  {grouped[lv].map((f, i) => (
                    <FindingCard key={`${f.id}-${i}`} f={f} doc={doc} />
                  ))}
                </ul>
              </div>
            ),
          )}
        </section>
      )}

      <CodeHelper />
    </div>
  )
}
