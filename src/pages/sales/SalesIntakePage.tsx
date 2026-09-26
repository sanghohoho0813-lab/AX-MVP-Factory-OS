/**
 * 영업 관리 › 크레탑으로 새 잠재고객 (D-119).
 *
 * 대표 지시: "크레탑 하나만 넣으면 분석도 다 해 주고, 고객 관리 · 잠재고객 관리에 등록도 되고, 클릭 몇 번에 전부.
 * 고려해야 될 것들도 알아서 먼저 뽑아 주고."
 *
 * 흐름: ① 보고서 넣기(PDF · 붙여넣기) → ② 확인(채울 기본 정보 · 먼저 볼 것 · 추천 전략 · 관심사 · 1차 질문,
 *       같은 업체가 있으면 거기에 붙이기) → ③ 등록 → 미팅 준비(1차)로.
 * 분석은 크레탑 분석기와 같은 규칙(analysisCore.js). 결과는 크레탑 분석 이력에도 이 업체로 남는다.
 * ?client=<id> 로 들어오면 그 업체에 붙인다(영업 흐름 · 미팅 준비의 '크레탑 보고서 넣기').
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Building2, FileUp, ScanSearch, Sparkles } from 'lucide-react'
import { WorkspaceScope } from '../../components/workspace/WorkspaceScope'
import { useToast } from '../../components/ui/toastContext'
import { Badge, ScreenTitle, type Tone } from '../../components/ui/primitives'
import { Button } from '../../components/ui/Button'
import { SalesTabs } from '../../components/sales/SalesTabs'
import { PillList, StageBadge } from '../../components/sales/salesParts'
import { rampAt } from '../../components/sales/salesColor'
import { LINK_BUTTON } from '../../components/sales/salesStyle'
import { listClients } from '../../services/clientOpsService'
import { CRETOP_TIER_LABEL, digestCretop, findClientForCretop, toPick, type CretopTier } from '../../services/salesCretop'
import { registerFromCretop } from '../../services/salesIntake'
import { salesStageOf } from '../../services/salesPipeline'
import { analyzeCretopText } from '../../tools/cretop/mini/analysisCore.js'
import { extractPdfText } from '../../tools/cretop/mini/pdf.js'
import type { CretopMiniUi } from '../../tools/cretop/mini/MiniApp.jsx'
import { SALES_SOURCES } from '../../content/salesCatalog'
import { todayLocalDate } from '../../lib/appClock'
import type { ClientOpsRecord } from '../../types/clientOps'

const inputClass = 'mt-1 w-full rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2 text-[0.95rem] text-slate-800 focus:border-brand-500 focus:outline-none'
const TIER_TONE: Record<CretopTier, Tone> = { top: 'brand', rec: 'success', cond: 'warning', low: 'neutral' }
const DIAG_DOT: Record<string, string> = { bad: 'bg-danger-500', warn: 'bg-warning-500', good: 'bg-success-500', info: 'bg-slate-300' }

const STEPS = ['보고서 넣기', '확인', '등록 · 미팅 준비']

function Steps({ at }: { at: number }) {
  return (
    <ol aria-label="진행" className="flex flex-wrap items-center gap-x-2 gap-y-1">
      {STEPS.map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          {i > 0 && <span aria-hidden="true" className="text-slate-300">›</span>}
          <span className={`t-sub inline-flex items-center gap-1.5 font-semibold ${i === at ? 'text-slate-900' : 'text-slate-400'}`} aria-current={i === at ? 'step' : undefined}>
            <span className={`t-meta flex size-5 items-center justify-center rounded-full tabular-nums ${i <= at ? 'ramp-soft ramp-text' : 'bg-slate-100 text-slate-400'}`} style={rampAt(i, 3)}>
              {i + 1}
            </span>
            {s}
          </span>
        </li>
      ))}
    </ol>
  )
}

function Row({ label, value, kept }: { label: string; value: string; kept?: string }) {
  if (!value) return null
  return (
    <div className="flex gap-3 py-1.5">
      <dt className="t-meta w-20 shrink-0 pt-0.5 text-slate-500">{label}</dt>
      <dd className="t-sub min-w-0 flex-1 break-keep text-slate-800">
        {kept ? (
          <>
            <span className="text-slate-500">{kept}</span>
            <span className="t-meta ml-1.5 text-slate-400">(이미 있음 · 그대로)</span>
          </>
        ) : (
          value
        )}
      </dd>
    </div>
  )
}

function IntakeContent({ workspaceId }: { workspaceId: string | null }) {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [params] = useSearchParams()
  const clientParam = params.get('client')
  const today = todayLocalDate()

  const [records, setRecords] = useState<ClientOpsRecord[]>([])
  const [mode, setMode] = useState<'pdf' | 'text'>('pdf')
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [err, setErr] = useState('')
  const [ui, setUi] = useState<CretopMiniUi | null>(null)
  // 확인 단계 입력
  const [source, setSource] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [meetingDate, setMeetingDate] = useState('')
  const [asNew, setAsNew] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      setRecords(await listClients(workspaceId))
    } catch {
      /* 업체 목록을 못 읽어도 새로 등록은 된다 */
    }
  }, [workspaceId])
  useEffect(() => {
    void load()
  }, [load])

  const target = clientParam ? (records.find((r) => r.id === clientParam) ?? null) : null
  const digest = useMemo(() => (ui ? digestCretop(ui) : null), [ui])
  const match = useMemo(() => (digest ? (target ?? findClientForCretop(records, digest.company)) : null), [digest, records, target])
  const existing = match && !asNew ? match : null

  const analyze = (raw: string, pages: Array<{ pageNo: number; text: string }> | null) => {
    const t = raw.trim()
    if (!t) {
      setErr('크레탑 PDF를 올리거나 보고서 글을 붙여넣어 주세요.')
      return
    }
    try {
      const result = analyzeCretopText(t, pages)
      setUi(result)
      setAsNew(false)
      setStatus('')
      if (!result.companyInfo?.companyName) setErr('회사 이름을 읽지 못했습니다. 등록은 되지만 이름을 고객 관리에서 고쳐 주세요.')
    } catch (e) {
      setErr(`분석 중 오류: ${e instanceof Error ? e.message : '알 수 없는 오류'}`)
    }
  }

  const onPick = async (f: File | undefined) => {
    if (!f) return
    setErr('')
    setUi(null)
    setFile(f)
    setBusy(true)
    try {
      if (/\.pdf$/i.test(f.name)) {
        setStatus('PDF에서 글을 읽는 중…')
        const { text: extracted, pages } = await extractPdfText(f, (p, total) => setStatus(`PDF 읽는 중… (${p}/${total}쪽)`))
        setText(extracted)
        analyze(extracted, pages)
      } else {
        const t = await f.text()
        setText(t)
        analyze(t, null)
      }
    } catch (e) {
      setErr(`파일을 읽지 못했습니다 — 글 붙여넣기로 해 보세요. (${e instanceof Error ? e.message : '오류'})`)
      setStatus('')
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    if (!ui) return
    setSaving(true)
    try {
      const res = await registerFromCretop({ workspaceId, ui, existing, source, contactName, contactPhone, meetingDate, file })
      const what = res.created ? '잠재고객으로 등록했습니다' : `${res.record.companyName}에 붙였습니다`
      showToast(`${what} — 기본 정보 ${res.filled.length}칸${res.uploaded ? ' · 서류함에 보고서' : ''}.`)
      for (const w of res.warnings) showToast(w)
      navigate(`/sales/meeting?client=${res.record.id}&round=1`)
    } catch (e) {
      showToast(e instanceof Error ? e.message : '등록하지 못했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const reset = () => {
    setUi(null)
    setText('')
    setFile(null)
    setErr('')
    setStatus('')
  }

  const c = digest?.company
  const picks = digest ? digest.refs.map(toPick).filter((p) => p !== null && !p.held).slice(0, 5) : []
  const has = (v: string) => (existing && v.trim() !== '' ? v : undefined)

  return (
    <div className="flex flex-col gap-5">
      <ScreenTitle title="영업 관리" sub={`${today} · 크레탑으로 새 잠재고객 — 보고서 한 번이면 등록 · 기본 정보 · 1차 미팅 전략까지`} />
      <SalesTabs />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Steps at={ui ? 1 : 0} />
        <Link to="/sales/board?new=1" className="t-sub font-semibold text-slate-500 hover:text-brand-700 hover:underline">
          크레탑 없이 직접 입력 →
        </Link>
      </div>

      {target && (
        <p data-testid="intake-target" className="t-sub flex flex-wrap items-center gap-2 rounded-(--radius-control) border border-brand-200 bg-brand-50 px-4 py-2.5 text-brand-800">
          <Building2 aria-hidden="true" className="size-4" />
          <strong className="font-semibold">{target.companyName}</strong> 에 붙입니다 — 빈 칸만 채우고, 적어 둔 값은 그대로 둡니다.
        </p>
      )}

      {/* ① 보고서 넣기 */}
      {!ui ? (
        <section data-testid="intake-input" className="flex flex-col gap-3 rounded-(--radius-panel) border border-slate-200 bg-white p-4 sm:p-5">
          <h2 className="t-card font-bold text-slate-900">크레탑 기업종합보고서를 넣어 주세요</h2>
          <p className="t-sub -mt-1 break-keep text-slate-500">PDF 는 이 브라우저 안에서 글로 읽습니다(바깥으로 보내지 않음). 클라우드 저장을 쓰면 등록할 때 업체 서류함에도 올립니다.</p>
          <div role="group" aria-label="넣는 방법" className="inline-flex self-start rounded-(--radius-control) border border-slate-200 bg-slate-50 p-1">
            {(
              [
                ['pdf', 'PDF 올리기'],
                ['text', '글 붙여넣기'],
              ] as const
            ).map(([k, label]) => (
              <button key={k} type="button" aria-pressed={mode === k} onClick={() => setMode(k)} className={`tap rounded-[8px] px-4 py-1.5 text-[0.9rem] font-semibold ${mode === k ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500'}`}>
                {label}
              </button>
            ))}
          </div>
          {mode === 'pdf' ? (
            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                void onPick(e.dataTransfer.files?.[0])
              }}
              className="flex cursor-pointer flex-col items-center gap-2 rounded-(--radius-control) border-2 border-dashed border-brand-200 bg-brand-50/40 px-4 py-8 text-center hover:bg-brand-50"
            >
              <FileUp aria-hidden="true" className="size-7 text-brand-500" />
              <span className="t-body font-semibold text-brand-700">{busy ? status || '읽는 중…' : '크레탑 PDF 고르기'}</span>
              <span className="t-meta text-slate-500">{file ? file.name : '누르거나 파일을 끌어다 놓으세요 · PDF · TXT'}</span>
              <input type="file" accept="application/pdf,.pdf,.txt,text/plain" aria-label="크레탑 보고서 올리기" className="sr-only" disabled={busy} onChange={(e) => void onPick(e.target.files?.[0])} />
            </label>
          ) : (
            <>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                aria-label="크레탑 보고서 글"
                placeholder="크레탑 기업종합보고서 글을 붙여넣으세요."
                className={`${inputClass} !mt-0 min-h-48 font-mono text-[0.85rem]`}
              />
              <Button variant="primary" className="self-start" onClick={() => analyze(text, null)} disabled={busy}>
                <ScanSearch aria-hidden="true" className="size-4" />
                분석
              </Button>
            </>
          )}
          {err && (
            <p role="alert" className="t-sub rounded-(--radius-control) border border-danger-200 bg-danger-50 px-3 py-2 text-danger-700">
              {err}
            </p>
          )}
        </section>
      ) : (
        c &&
        digest && (
          <>
            {/* 같은 업체 */}
            {match && !target && (
              <section data-testid="intake-match" className="flex flex-col gap-2 rounded-(--radius-control) border border-warning-200 bg-warning-50 px-4 py-3">
                <p className="t-sub flex flex-wrap items-center gap-2 text-slate-800">
                  이미 고객 관리에 있는 업체입니다 — <strong className="font-semibold">{match.companyName}</strong>
                  <StageBadge stage={salesStageOf(match)} />
                </p>
                <div role="radiogroup" aria-label="어디에 등록" className="flex flex-wrap gap-2">
                  {[
                    { v: false, label: '이 업체에 붙이기' },
                    { v: true, label: '새 업체로 만들기' },
                  ].map((o) => (
                    <button key={o.label} type="button" role="radio" aria-checked={asNew === o.v} onClick={() => setAsNew(o.v)} className={`tap t-sub rounded-full border px-3 py-1 font-semibold ${asNew === o.v ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white text-slate-600'}`}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </section>
            )}

            <div className="grid gap-4 lg:grid-cols-2">
              {/* 채울 기본 정보 + 입력 */}
              <section data-testid="intake-company" className="flex flex-col gap-3 rounded-(--radius-panel) border border-slate-200 bg-white p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="t-card font-bold text-slate-900">{c.name || '회사 이름 확인 필요'}</h2>
                  {c.creditGrade && <Badge tone="neutral">신용 {c.creditGrade}</Badge>}
                </div>
                <p className="t-meta -mt-2 text-slate-500">{existing ? '이 업체의 빈 칸에 채웁니다' : '새 잠재고객의 기본 정보로 들어갑니다'}</p>
                <dl className="flex flex-col divide-y divide-slate-100">
                  <Row label="사업자번호" value={c.bizNo} kept={has(existing?.businessNumber ?? '')} />
                  <Row label="법인번호" value={c.corpRegNo} kept={has(existing?.corporateNumber ?? '')} />
                  <Row label="대표자" value={`${c.ceo}${digest.ceoAge ? ` · ${digest.ceoAge}세(추정)` : ''}`.replace(/^ · /, '')} kept={has(existing?.representativeName ?? '')} />
                  <Row label="업종" value={c.industry} kept={has(existing?.industry ?? '')} />
                  <Row label="주요 제품" value={c.mainProduct} kept={has(existing?.businessItem ?? '')} />
                  <Row label="설립일" value={c.established} kept={has(existing?.establishedAt ?? '')} />
                  <Row label="직원" value={c.employees !== null ? `${c.employees}명` : ''} kept={has(existing?.employeeCount ?? '')} />
                  <Row label="주소" value={c.address} kept={has(existing?.businessAddress ?? '')} />
                  <Row label="매출" value={digest.revenueM ? `${(digest.revenueM / 100).toLocaleString('ko-KR', { maximumFractionDigits: 1 })}억` : ''} />
                </dl>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block text-[0.85rem] text-slate-500">
                    유입 경로
                    <select value={source} onChange={(e) => setSource(e.target.value)} className={inputClass}>
                      <option value="">선택</option>
                      {SALES_SOURCES.map((x) => (
                        <option key={x} value={x}>
                          {x}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-[0.85rem] text-slate-500">
                    1차 미팅 날짜
                    <input type="date" value={meetingDate} min={today} onChange={(e) => setMeetingDate(e.target.value)} className={inputClass} />
                  </label>
                  <label className="block text-[0.85rem] text-slate-500">
                    담당자
                    <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder={c.ceo || ''} className={inputClass} />
                  </label>
                  <label className="block text-[0.85rem] text-slate-500">
                    휴대폰번호
                    <input value={contactPhone} inputMode="tel" onChange={(e) => setContactPhone(e.target.value)} placeholder="010-" className={inputClass} />
                  </label>
                </div>
                <p className="t-meta break-keep text-slate-400">크레탑 보고서에는 연락처가 없어 따로 적습니다. 1차 미팅 날짜를 적으면 '1차 미팅 예정' 으로 올라가고 오늘 · 일정에 뜹니다.</p>
              </section>

              {/* 먼저 볼 것 · 추천 전략 · 관심사 */}
              <section data-testid="intake-insight" className="flex flex-col gap-3 rounded-(--radius-panel) border border-slate-200 bg-white p-4 sm:p-5">
                <h2 className="t-card inline-flex items-center gap-2 font-bold text-slate-900">
                  <Sparkles aria-hidden="true" className="size-5 text-brand-600" />
                  1차 미팅 전에 먼저 볼 것
                </h2>
                <ul className="flex flex-col gap-1">
                  {digest.diagnosis.slice(0, 5).map((l) => (
                    <li key={l.text} className="t-sub flex items-start gap-2 break-keep text-slate-700">
                      <span aria-hidden="true" className={`mt-2 size-1.5 shrink-0 rounded-full ${DIAG_DOT[l.tone] ?? 'bg-slate-300'}`} />
                      <span className="min-w-0">{l.text}</span>
                    </li>
                  ))}
                </ul>
                <div>
                  <p className="t-meta mb-1.5 font-semibold text-slate-500">추천 컨설팅 — 미팅 준비에 질문 흐름과 함께 들어갑니다</p>
                  <ol className="flex flex-col gap-1.5">
                    {picks.map((p, i) =>
                      p ? (
                        <li key={p.name} className="relative flex flex-col gap-0.5 overflow-hidden rounded-(--radius-control) border border-slate-200 bg-slate-50 px-3 py-2 pl-3.5">
                          <span aria-hidden="true" className="ramp-bar absolute inset-y-0 left-0 w-[3px]" style={rampAt(i, 5)} />
                          <span className="t-sub inline-flex flex-wrap items-center gap-1.5 font-bold text-slate-900">
                            {p.name}
                            <Badge tone={TIER_TONE[p.tier]}>{CRETOP_TIER_LABEL[p.tier]}</Badge>
                          </span>
                          {p.reasons[0] && <span className="t-meta break-keep text-slate-500">{p.reasons.slice(0, 2).join(' · ')}</span>}
                          {p.flow[0] && <span className="t-meta break-keep text-slate-700">❝ {p.flow[0].q}</span>}
                        </li>
                      ) : null,
                    )}
                  </ol>
                </div>
                <div>
                  <p className="t-meta mb-1.5 font-semibold text-slate-500">영업 관심사로 들어갈 것</p>
                  <PillList items={digest.interests} />
                </div>
                {digest.concern && (
                  <p className="t-meta break-keep text-slate-500">
                    대표 고민 한 줄(비었을 때만): <span className="text-slate-700">{digest.concern}</span>
                  </p>
                )}
              </section>
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button type="button" onClick={reset} className="t-sub self-start font-semibold text-slate-500 hover:text-brand-700 hover:underline">
                ← 다른 보고서 넣기
              </button>
              <div className="flex flex-wrap items-center gap-2">
                {existing && (
                  <Link to={`/ops/clients/${existing.id}`} className={LINK_BUTTON.secondary}>
                    업체 보기
                  </Link>
                )}
                <Button variant="primary" onClick={() => void save()} disabled={saving} data-testid="intake-save">
                  {saving ? '등록 중…' : existing ? `${existing.companyName}에 붙이고 미팅 준비로` : '잠재고객으로 등록하고 미팅 준비로'}
                </Button>
              </div>
            </div>
            <p className="t-meta break-keep text-slate-400">크레탑 원문 기준 규칙 계산입니다(외부 호출 없음). 숫자는 실제 상담 전 원문으로 한 번 더 확인하세요.</p>
          </>
        )
      )}
    </div>
  )
}

export function SalesIntakePage() {
  return <WorkspaceScope>{(ctx) => <IntakeContent workspaceId={ctx.workspaceId} />}</WorkspaceScope>
}
