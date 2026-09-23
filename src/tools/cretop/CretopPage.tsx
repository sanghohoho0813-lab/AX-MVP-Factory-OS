/**
 * 크레탑 분석기 (D-88) — corp-consult-sales-os 의 `cretop-engine` 을 한 글자도 바꾸지 않고 옮긴 것.
 *
 * 흐름: 크레탑 기업종합보고서 PDF 를 넣거나 원문을 붙여넣는다 → 엔진이 회사 정보·핵심 15개·3개년 추이·
 * 재무비율 5영역을 뽑는다 → 1차 미팅 포인트(원본 영업 OS 의 15개 규칙)를 만든다 → 업체 기록에 붙인다.
 *
 * 모든 수치는 '후보' 다 — 엔진이 그렇게 설계됐고(비단정 톤), 화면도 그 말을 지운다거나 바꾸지 않는다.
 * 골든 회귀 3벌(`npm run test:cretop`)이 원본과 같은 숫자를 지킨다. OCR 은 하지 않는다.
 */

import { useMemo, useRef, useState } from 'react'
import { AlertTriangle, FileUp, FolderOpen, RotateCcw, Copy, Check } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Badge, Disclosure, Section, Surface, type Tone } from '../../components/ui/primitives'
import { ToolResultAttach } from '../shared/ToolResultAttach'
import { useToolClient } from '../shared/toolClientContext'
import { fetchClientDocFile, hasDocFile } from '../shared/clientDocFile'
import {
  buildCretopParsedForUi,
  cretopCashflowGradeInfo,
  cretopPreviewTone,
  cretopTrendCommentRich,
  extractCretopCore,
  CORE_LABELS,
  CORE_PREVIEW_ORDER,
} from './engine/index.js'
import type { CretopAmount, CretopParsedForUi, CretopTrendRow } from './engine/index.js'
import { buildCretopMeetingPoints, type MeetingPoints } from './lib/meetingPoints'
import { extractPdfLayout } from './lib/pdfLayout'

const STORAGE_KEY = 'axmvp.tools.cretop'

function loadText(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

/** 엔진의 카드 색(red/green) → OS 색 */
const TONE_MAP: Record<string, Tone> = { red: 'danger', green: 'success', amber: 'warning', blue: 'brand', purple: 'brand' }

function previewValue(k: string, p: CretopAmount | null | undefined): { text: string; year: number | null } {
  if (!p) return { text: '원문 확인 필요', year: null }
  if (k === 'creditGrade') return { text: p.value != null ? String(p.value) : '원문 확인 필요', year: null }
  if (k === 'cashflowGrade') {
    const latest = (p as unknown as { latest?: string }).latest
    return { text: latest || '원문 확인 필요', year: null }
  }
  if (p.isRatio) {
    return { text: p.value != null ? `${Math.round(p.value * 100) / 100}${p.unit || ''}` : '원문 확인 필요', year: p.year ?? null }
  }
  if (p.absent) return { text: '0원', year: null }
  if (p.eok != null) return { text: Math.abs(p.eok) < 0.005 ? '0.01억 미만' : `${p.eok.toLocaleString()}억`, year: p.year ?? null }
  return { text: '원문 확인 필요', year: null }
}

function fmtTrend(v: number | null, unit: string): string {
  if (v == null) return '—'
  if (unit === '%' || unit === '배' || unit === '회') return `${Math.round(v * 100) / 100}${unit}`
  return `${Math.round(v * 100) / 100}억`
}

function TrendCard({ row }: { row: CretopTrendRow }) {
  if (row.isGrade) {
    const ser = row.gradeSeries ?? []
    if (!ser.length) return null
    const info = cretopCashflowGradeInfo(ser[ser.length - 1])
    return (
      <Surface className="flex flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="t-card font-bold text-slate-900">현금흐름등급</span>
          <Badge tone={info.level === '현금흐름 주의' ? 'danger' : info.level === '현금흐름 양호' ? 'success' : 'neutral'}>
            {ser[ser.length - 1]} · {info.level}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-1.5 t-meta text-slate-600">
          {ser.map((g, i) => (
            <span key={i} className="rounded-(--radius-control) border border-slate-200 px-2 py-0.5">
              {row.years?.[i] ?? ''} {g}
            </span>
          ))}
        </div>
        <p className="t-sub break-keep text-slate-600">{info.text}</p>
      </Surface>
    )
  }
  const t = row.trend
  if (!t || !t.series.length) return null
  const rc = cretopTrendCommentRich(row.key, t)
  const tone: Tone = rc.tone === 'red' ? 'danger' : rc.tone === 'green' ? 'success' : 'neutral'
  const latestNeg = t.latest && typeof t.latest.val === 'number' && t.latest.val < 0
  return (
    <Surface edge={tone} className="flex flex-col gap-2 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <span className="t-card font-bold text-slate-900">{row.label}</span>
        <span className={`t-num ${latestNeg ? 'text-danger-700' : 'text-slate-900'}`}>{t.latest ? fmtTrend(t.latest.val, t.unit) : '—'}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 t-meta text-slate-600">
        {t.series.map((s, i) => {
          const st = t.steps[i]
          return (
            <span key={i} className="inline-flex items-center gap-1.5">
              <span className={`rounded-(--radius-control) border px-2 py-0.5 ${typeof s.val === 'number' && s.val < 0 ? 'border-danger-200 text-danger-700' : 'border-slate-200'}`}>
                {s.year ?? ''} {fmtTrend(s.val, t.unit)}
              </span>
              {st && (
                <span className={`${st.dir === '상승' ? 'text-success-700' : st.dir === '하락' ? 'text-danger-700' : 'text-slate-400'}`}>
                  {st.dir}
                  {st.deltaPct != null ? ` ${st.deltaPct > 0 ? '+' : ''}${Math.round(st.deltaPct * 10) / 10}%` : ''}
                </span>
              )}
            </span>
          )
        })}
      </div>
      <p className={`t-sub break-keep ${tone === 'danger' ? 'text-danger-700' : tone === 'success' ? 'text-success-700' : 'text-slate-600'}`}>{rc.text}</p>
    </Surface>
  )
}

export function CretopPage() {
  const [text, setText] = useState<string>(() => loadText())
  const [fileName, setFileName] = useState('')
  const [progress, setProgress] = useState('')
  const [docBusy, setDocBusy] = useState(false)
  const { clientRecord, clientName } = useToolClient()
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [copied, setCopied] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const ui: CretopParsedForUi | null = useMemo(() => {
    if (!submitted || !text.trim()) return null
    try {
      return buildCretopParsedForUi(text)
    } catch {
      return null
    }
  }, [submitted, text])

  const points: MeetingPoints | null = useMemo(() => {
    if (!ui || !text.trim()) return null
    try {
      const core = extractCretopCore(text)
      return buildCretopMeetingPoints({
        rows: core.rows,
        company: { industry: ui.companyInfo.standardIndustry || ui.companyInfo.industry || '', employees: ui.companyInfo.employees },
        computed: ui.corePreview,
      })
    } catch {
      return null
    }
  }, [ui, text])

  const persist = (next: string) => {
    setText(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* 저장 못 해도 분석은 된다 */
    }
  }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setError('')
    setFileName(file.name)
    if (!/\.pdf$/i.test(file.name)) {
      // 글자 파일이면 그대로 읽는다
      const t = await file.text()
      persist(t)
      setSubmitted(true)
      return
    }
    try {
      setProgress('PDF 읽는 중…')
      const r = await extractPdfLayout(file, (p, n) => setProgress(`PDF ${p}/${n}쪽 읽는 중`))
      setProgress('')
      if (r.chars < 200) {
        setError('PDF 에서 글자를 거의 읽지 못했습니다. 스캔본이면 원문 텍스트를 붙여넣어 주세요 — 이 도구는 OCR 을 하지 않습니다.')
        return
      }
      persist(r.layoutText || r.rawText)
      setSubmitted(true)
    } catch (cause) {
      setProgress('')
      setError(cause instanceof Error ? cause.message : 'PDF 를 읽지 못했습니다.')
    }
  }

  /** 업체 서류함에 올려 둔 크레탑 보고서로 바로 분석 (D-90) */
  const runFromDocbox = async () => {
    setError('')
    setDocBusy(true)
    try {
      const got = await fetchClientDocFile(clientRecord, 'cretopReport')
      if (!got) {
        setError('서류함에 올려 둔 파일이 없습니다. 파일을 먼저 올려 주세요.')
        return
      }
      await onFile(got.file)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '서류함 파일을 읽지 못했습니다.')
    } finally {
      setDocBusy(false)
    }
  }

  const summaryText = useMemo(() => {
    if (!ui) return ''
    const co = ui.companyInfo
    const cp = ui.corePreview
    const line = (k: string, label: string) => {
      const v = previewValue(k, cp[k])
      return `${label} ${v.text}${v.year ? `(${v.year})` : ''}`
    }
    const lines = [
      `[크레탑 분석 요약] ${co.companyName ?? ''}`.trim(),
      [line('revenue', '매출'), line('operatingProfit', '영업이익'), line('netIncome', '당기순이익')].join(' · '),
      [line('debtRatio', '부채비율'), line('currentRatio', '유동비율'), line('interestCoverageRatio', '이자보상배수')].join(' · '),
    ]
    if (points && points.topPoints.length) {
      lines.push('[1차 미팅 포인트]')
      points.topPoints.forEach((p, i) => lines.push(`${i + 1}. ${p}`))
    }
    lines.push('※ 모든 수치는 후보이며 원문 기준 확인이 필요합니다.')
    return lines.join('\n')
  }, [ui, points])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(summaryText)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      /* 아래 미리보기에서 손으로 */
    }
  }

  const reset = () => {
    persist('')
    setFileName('')
    setSubmitted(false)
    setError('')
  }

  const reportName = ui?.companyInfo.companyName || fileName || '크레탑 보고서'

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="크레탑 분석기"
        description="크레탑 기업종합보고서를 넣으면 핵심 재무·3개년 추이·재무비율 5영역과 1차 미팅 포인트를 뽑습니다. 숫자는 전부 후보이고 원문 확인이 필요합니다."
        actions={
          <Button variant="ghost" size="sm" onClick={reset}>
            <RotateCcw aria-hidden="true" className="size-4" /> 비우기
          </Button>
        }
      />

      <Surface className="flex flex-col gap-3 p-4 sm:p-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.txt,.csv,text/plain,application/pdf"
            className="sr-only"
            aria-label="크레탑 보고서 파일"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          <Button variant="primary" onClick={() => fileRef.current?.click()} className="w-full sm:w-auto">
            <FileUp aria-hidden="true" className="size-4" /> PDF·텍스트 파일 넣기
          </Button>
          {/* 업체 서류함에 올려 둔 보고서로 바로 (D-90) */}
          {clientRecord && (
            hasDocFile(clientRecord, 'cretopReport') ? (
              <Button variant="secondary" onClick={() => void runFromDocbox()} disabled={docBusy} className="w-full sm:w-auto" data-testid="cretop-from-docbox">
                <FolderOpen aria-hidden="true" className="size-4" />
                {docBusy ? '서류함에서 읽는 중…' : `${clientName} 서류함의 보고서로 분석`}
              </Button>
            ) : (
              <span className="t-sub flex items-center gap-1.5 break-keep text-danger-700" data-testid="cretop-docbox-missing">
                <AlertTriangle aria-hidden="true" className="size-4 shrink-0" />
                서류함에 크레탑 기업종합보고서가 없습니다 — 올려 두면 여기서 바로 분석합니다
              </span>
            )
          )}
          <span className="t-sub text-slate-500">{progress || (fileName ? `읽은 파일: ${fileName}` : '또는 아래에 원문을 붙여넣으세요')}</span>
        </div>
        <textarea
          aria-label="크레탑 원문"
          value={text}
          onChange={(e) => {
            persist(e.target.value)
            setSubmitted(false)
          }}
          rows={6}
          placeholder="크레탑 보고서 원문을 붙여넣으세요 — 요약 손익계산서 · 요약 재무상태표 · 재무비율 표가 있으면 가장 정확합니다."
          className="w-full rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2 t-sub text-slate-900 focus:border-brand-500 focus:outline-none"
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button variant="primary" disabled={!text.trim()} onClick={() => setSubmitted(true)} className="w-full sm:w-auto" data-testid="cretop-run">
            분석하기
          </Button>
          <span className="t-meta text-slate-400">글자 {text.length.toLocaleString()}자 · 스캔본(그림) PDF 는 읽지 못합니다</span>
        </div>
        {error && <p className="t-sub break-keep text-danger-700">{error}</p>}
      </Surface>

      {ui && (
        <>
          <Surface className="flex flex-col gap-2 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="t-card font-bold text-slate-900" data-testid="cretop-company">
                  {reportName}
                </p>
                <p className="t-sub break-keep text-slate-500">
                  {[
                    ui.companyInfo.ceoName ? `대표 ${ui.companyInfo.ceoName}` : '',
                    ui.companyInfo.standardIndustry || ui.companyInfo.industry || '',
                    ui.companyInfo.employees ? `직원 ${ui.companyInfo.employees}` : '',
                    ui.companyInfo.established ? `설립 ${ui.companyInfo.established}` : '',
                    ui.financialYears.length ? `재무 ${ui.financialYears.join('·')}년` : '',
                  ]
                    .filter(Boolean)
                    .join(' · ') || '회사 정보를 원문에서 찾지 못했습니다'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={copy}>
                  {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
                  {copied ? '복사됨' : '요약 복사'}
                </Button>
                <ToolResultAttach
                  toolKey="cretop"
                  title="크레탑 분석"
                  verdict={null}
                  verdictLabel={points?.topPoints[0] ?? ''}
                  summary={summaryText}
                  data={{ companyInfo: ui.companyInfo, corePreview: ui.corePreview, topPoints: points?.topPoints ?? [], fileName }}
                />
              </div>
            </div>
          </Surface>

          <Section title="핵심 재무 미리보기" count={CORE_PREVIEW_ORDER.length}>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5" data-testid="cretop-preview">
              {CORE_PREVIEW_ORDER.map((k) => {
                const p = ui.corePreview[k]
                const v = previewValue(k, p)
                const tn = cretopPreviewTone(k, p ?? null, null)
                const tone: Tone | null = tn ? (TONE_MAP[tn] ?? 'neutral') : null
                const label = k === 'creditGrade' ? '신용등급' : k === 'cashflowGrade' ? '현금흐름등급' : (CORE_LABELS[k] ?? k)
                return (
                  <Surface key={k} edge={tone ?? 'neutral'} showEdge={tone !== null} className="flex flex-col gap-0.5 p-3">
                    <span className="t-meta truncate text-slate-500">
                      {label}
                      {v.year ? ` (${v.year})` : ''}
                    </span>
                    <span className={`t-body font-bold break-keep ${tone === 'danger' ? 'text-danger-700' : tone === 'success' ? 'text-success-700' : v.text === '원문 확인 필요' ? 'text-slate-400' : 'text-slate-900'}`} data-k={k}>
                      {v.text}
                    </span>
                    {k === 'debtRatio' && p && p.capitalErosion && <span className="t-meta text-danger-700">자본잠식 위험 — 원문 확인 필요</span>}
                  </Surface>
                )
              })}
            </div>
          </Section>

          {points && points.topPoints.length > 0 && (
            <Section title="1차 미팅 포인트" count={points.topPoints.length}>
              <Surface className="flex flex-col gap-3 p-4">
                <ol className="flex flex-col gap-2" data-testid="cretop-points">
                  {points.pointPairs.map((p, i) => (
                    <li key={p.title} className="flex gap-2.5">
                      <span className="t-meta mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-slate-900 font-bold text-white">{i + 1}</span>
                      <span className="min-w-0">
                        <span className="t-body block font-medium break-keep text-slate-800">{p.title}</span>
                        {p.q && <span className="t-sub block break-keep text-slate-500">질문: {p.q}</span>}
                      </span>
                    </li>
                  ))}
                </ol>
                {points.docs.length > 0 && (
                  <p className="t-sub break-keep border-t border-slate-100 pt-2 text-slate-600">
                    <b>요청 자료</b> {points.docs.join(' · ')}
                  </p>
                )}
                {points.proposals.length > 0 && (
                  <p className="t-sub break-keep text-slate-600">
                    <b>제안 후보</b> {points.proposals.join(' / ')}
                  </p>
                )}
              </Surface>
            </Section>
          )}

          <Section title="3개년 추이">
            <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              {ui.trendRows
                .filter((r) => (r.isGrade ? (r.gradeSeries?.length ?? 0) > 0 : (r.trend?.series.length ?? 0) > 0))
                .map((r) => (
                  <TrendCard key={r.key} row={r} />
                ))}
            </div>
          </Section>

          <Section title="재무비율 5영역">
            <div className="flex flex-col gap-2.5">
              {ui.ratioAreas.map((a) => (
                <Disclosure key={a.key} title={a.name} hint={a.hint}>
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {a.metrics.map((m) =>
                      m.missing ? (
                        <Surface key={m.key} className="p-3">
                          <span className="t-sub font-medium text-slate-700">{m.label}</span>
                          <span className="t-meta block text-slate-400">원문 확인 필요</span>
                        </Surface>
                      ) : (
                        <TrendCard key={m.key} row={m} />
                      ),
                    )}
                  </div>
                </Disclosure>
              ))}
            </div>
          </Section>

          <p className="t-meta break-keep text-slate-400">
            연도 근거: 재무제표 {ui.financialYears.join('·') || '—'} / 비율표 {ui.reportRatioYears.join('·') || '—'} ({ui.ratioYearSource}, {ui.ratioYearConfidence}). 모든
            수치는 후보이며 원문 기준 확인이 필요합니다. 외부 호출 없음.
          </p>
        </>
      )}
    </div>
  )
}
