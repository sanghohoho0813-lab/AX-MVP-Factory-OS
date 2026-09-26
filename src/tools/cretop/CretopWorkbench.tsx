/**
 * 크레탑 분석기 작업대 (D-121) — 원본 분석 앱(MiniApp) + 이 OS 의 업체 연결.
 *
 * 단독 판매 경계
 *   - 분석기 본체는 `mini/` · `engine/` · `lib/` 이다. 이 셋은 OS 를 모른다(업체 · 영업 · 저장소를 부르지 않는다).
 *     예외 하나: 주식가치 계산이 세금 계산기(services/taxCalc)를 쓴다 — 떼어 팔 때 함께 싣는다.
 *   - 이 파일이 OS 연결부다: 분석 이력(모듈 기록 cretop/analyses) · 서류함 보고서 · 업체 기록에 붙이기 · 평가 조건 동기화.
 *   - 영업(잠재고객 등록 · 미팅 준비)은 이 파일도 모른다 — 바깥 화면이 actions · onAnalyzed 로 붙인다.
 *
 * 쓰는 곳: 컨설팅 작업실 › 크레탑 분석기(/tools/cretop/analyze) · 영업 관리 › 미팅 준비 1차(embedded).
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, Check, Copy, FolderOpen } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/toastContext'
import { CretopMiniApp, type CretopMiniHistoryItem, type CretopMiniUi } from './mini/MiniApp.jsx'
import { SV_EVENT, svCurrent, svRestore, svSummaryLines, type SvEntry } from './mini/stockValueCalc.js'
import { useModuleBucket } from '../shared/useModuleBucket'
import { ToolResultAttach } from '../shared/ToolResultAttach'
import { useToolClient } from '../shared/toolClientContext'
import { fetchClientDocFile, hasDocFile } from '../shared/clientDocFile'
import { cretopResultInput } from './lib/cretopResult'

/** 분석 이력 한 줄 — 원본은 Supabase analyses 에, 이 OS 는 모듈 기록(cretop/analyses)에 */
interface AnalysisRow extends Record<string, unknown> {
  company: string
  bizNo: string
  ts: string
  ui: CretopMiniUi
  /** D-112: 주식가치 탭에서 고친 평가 조건(발행주식수 · 법인 구분 …) — 다른 기기 · 다른 직원도 같은 값 */
  sv?: SvEntry | null
}

export interface CretopWorkbenchProps {
  /** 다른 화면 안에 들어갈 때 — 마지막 세션 대신 이 업체의 저장된 분석으로 시작(없으면 보고서 넣기부터) */
  embedded?: boolean
  /** 새로 분석했을 때(이력 저장과 함께) — 바깥 화면이 업체 기록에 반영한다 */
  onAnalyzed?: (ui: CretopMiniUi) => void
  /** 결과 막대에 바깥 화면이 붙이는 단추 (예: 잠재고객 등록 · 미팅 준비) */
  actions?: (ui: CretopMiniUi, selected: string[]) => ReactNode
  /** 주면 '업체 기록에 붙이기' 대신 이것을 보인다 — 바깥 화면이 알아서 붙이는 경우 */
  attachSlot?: (ui: CretopMiniUi, selected: string[]) => ReactNode
}

const digits = (v: string) => v.replace(/[^0-9]/g, '')

export function CretopWorkbench({ embedded = false, onAnalyzed, actions, attachSlot }: CretopWorkbenchProps) {
  const { clientRecord, clientName, clientId, loadClients } = useToolClient()
  const [names, setNames] = useState<Record<string, string>>({})
  useEffect(() => {
    let alive = true
    void loadClients().then((list) => {
      if (alive) setNames(Object.fromEntries(list.map((c) => [c.id, c.companyName])))
    })
    return () => {
      alive = false
    }
  }, [loadClients])
  const clientNameOf = (id: string) => names[id] ?? ''
  const bucket = useModuleBucket<AnalysisRow>('cretop', 'analyses')
  const { showToast } = useToast()
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [docBusy, setDocBusy] = useState(false)
  const [docError, setDocError] = useState('')
  const [copied, setCopied] = useState(false)

  const history: CretopMiniHistoryItem[] = useMemo(
    () =>
      [...(bucket.rows ?? [])]
        .sort((a, b) => String(b.data.ts).localeCompare(String(a.data.ts)))
        .map((r) => ({ id: r.id, company: r.data.company, ts: r.data.ts, ui: r.data.ui, clientName: r.clientId ? clientNameOf(r.clientId) : '' })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bucket.rows, names],
  )

  /** embedded: 이 업체의 가장 새 분석 — 업체 id → 사업자번호 → 이름 순으로 찾는다 */
  const initialUi = useMemo<CretopMiniUi | null>(() => {
    if (!embedded || !clientRecord || !bucket.rows) return null
    const rows = [...bucket.rows].sort((a, b) => String(b.data.ts).localeCompare(String(a.data.ts)))
    const biz = digits(clientRecord.businessNumber)
    const hit =
      rows.find((r) => r.clientId === clientRecord.id) ??
      (biz.length === 10 ? rows.find((r) => digits(r.data.bizNo) === biz) : undefined) ??
      rows.find((r) => r.data.company === clientRecord.companyName)
    return hit?.data.ui ?? null
  }, [embedded, clientRecord, bucket.rows])

  const onSaved = (ui: CretopMiniUi) => {
    const co = ui.companyInfo ?? {}
    const company = co.companyName || '기업명 미상'
    const bizNo = co.businessNo || ''
    // 같은 회사(사업자번호·이름)의 이전 이력은 새 것으로 바꾼다 — 원본 비회원 이력과 같은 규칙
    const prev = (bucket.rows ?? []).find((r) => (bizNo && r.data.bizNo === bizNo) || r.data.company === company)
    // 원본처럼 저장이 안 되면 알려 준다 ('분석 저장 실패') — 결과 화면은 그대로 남는다
    bucket.save({ id: prev?.id, clientId: clientId ?? prev?.clientId ?? '', data: { company, bizNo, ts: new Date().toISOString(), ui, sv: prev?.data.sv ?? null } }).catch((e: unknown) => {
      showToast(`분석 저장 실패: ${e instanceof Error ? e.message : '오류'} — 연결을 확인하세요. 결과는 화면에 그대로 있습니다.`)
    })
    onAnalyzed?.(ui)
  }

  // D-112: 이력(클라우드)에 있던 평가 조건을 이 브라우저로 — 이 브라우저 값이 더 새것이면 그대로 둔다
  useEffect(() => {
    let changed = false
    for (const r of bucket.rows ?? []) {
      if (r.data.sv && svRestore({ companyInfo: { companyName: r.data.company, businessNo: r.data.bizNo } }, r.data.sv)) changed = true
    }
    if (changed) window.dispatchEvent(new Event(SV_EVENT))
  }, [bucket.rows])

  // D-112: 평가 조건을 고치면 그 회사 이력에 같이 저장한다. 칸마다 저장하지 않게 잠깐(0.8초) 모았다가 한 번에.
  const rowsRef = useRef(bucket.rows)
  rowsRef.current = bucket.rows
  const saveRef = useRef(bucket.save)
  saveRef.current = bucket.save
  useEffect(() => {
    const pending = new Map<string, { company: string; bizNo: string; entry: SvEntry }>()
    let timer: number | undefined
    const flush = () => {
      for (const p of pending.values()) {
        const row = (rowsRef.current ?? []).find((r) => (p.bizNo && r.data.bizNo === p.bizNo) || r.data.company === p.company)
        if (!row) continue
        void saveRef.current({ id: row.id, clientId: row.clientId, data: { ...row.data, sv: p.entry } }).catch(() => {
          /* 이력 저장에 실패해도 이 브라우저에는 남아 있다 */
        })
      }
      pending.clear()
    }
    const onChange = (e: Event) => {
      const d = (e as CustomEvent<{ company: string; bizNo: string; entry: SvEntry } | undefined>).detail
      if (!d || !d.entry) return
      pending.set(d.bizNo || d.company, d)
      window.clearTimeout(timer)
      timer = window.setTimeout(flush, 800)
    }
    window.addEventListener(SV_EVENT, onChange)
    return () => {
      window.removeEventListener(SV_EVENT, onChange)
      window.clearTimeout(timer)
      flush()
    }
  }, [])

  /** 업체 서류함에 올려 둔 크레탑 보고서로 바로 분석 (D-90) */
  const runFromDocbox = async () => {
    setDocError('')
    setDocBusy(true)
    try {
      const got = await fetchClientDocFile(clientRecord, 'cretopReport')
      if (!got) {
        setDocError('서류함에 올려 둔 파일이 없습니다. 파일을 먼저 올려 주세요.')
        return
      }
      setPendingFile(got.file)
    } catch (cause) {
      setDocError(cause instanceof Error ? cause.message : '서류함 파일을 읽지 못했습니다.')
    } finally {
      setDocBusy(false)
    }
  }

  const extraInput = clientRecord ? (
    <div className="flex flex-col gap-1.5">
      {hasDocFile(clientRecord, 'cretopReport') ? (
        <Button variant="secondary" onClick={() => void runFromDocbox()} disabled={docBusy} className="w-full sm:w-auto" data-testid="cretop-from-docbox">
          <FolderOpen aria-hidden="true" className="size-4" />
          {docBusy ? '서류함에서 읽는 중…' : `${clientName} 서류함의 보고서로 분석`}
        </Button>
      ) : (
        <span className="t-sub flex items-center gap-1.5 break-keep text-danger-700" data-testid="cretop-docbox-missing">
          <AlertTriangle aria-hidden="true" className="size-4 shrink-0" />
          서류함에 크레탑 기업종합보고서가 없습니다 — 올려 두면 여기서 바로 분석합니다
        </span>
      )}
      {docError && <span className="t-sub text-danger-700">{docError}</span>}
    </div>
  ) : null

  const resultBar = (ui: CretopMiniUi, selected: string[]) => {
    // D-111: 주식가치 탭에서 본(고친) 값 그대로 — 계산이 안 되면(발행주식수 없음 등) 줄을 넣지 않는다
    const sv = svCurrent(ui)
    const svLines = svSummaryLines(ui)
    // D-119: 붙이는 모양은 영업 쪽과 한 함수(순위 · 진단 요약까지 실어 미팅 준비가 다시 꺼낸다)
    const input = cretopResultInput(ui, selected, {
      stockValue: sv.r ? { perShare: Math.round(sv.r.finalPerShare), total: Math.round(sv.r.totalValue), shares: sv.shares, corpType: sv.r.corpType, edited: sv.edited } : null,
      extraLines: svLines,
    })
    const summary = input.summary
    const copy = async () => {
      try {
        await navigator.clipboard.writeText(summary)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1800)
      } catch {
        /* 요약 탭에서 손으로 */
      }
    }
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3" data-testid="cretop-result-bar">
        <Button size="sm" onClick={() => void copy()}>
          {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
          {copied ? '복사됨' : '1장 요약 복사'}
        </Button>
        {attachSlot ? (
          attachSlot(ui, selected)
        ) : (
          <ToolResultAttach
            toolKey="cretop"
            title={input.title}
            verdict={null}
            verdictLabel={input.verdictLabel}
            summary={summary}
            data={input.data}
            subject={{ name: ui.companyInfo?.companyName, bizNo: ui.companyInfo?.businessNo }}
          />
        )}
        {actions?.(ui, selected)}
      </div>
    )
  }

  // embedded 는 이력을 다 읽은 뒤에 연다 — 이 업체의 지난 분석으로 시작해야 하므로
  if (embedded && bucket.rows === null) return <p className="t-sub px-1 py-6 text-slate-500">크레탑 분석을 불러오는 중…</p>

  return (
    <div className="flex flex-col gap-4">
      <CretopMiniApp
        key={embedded ? (clientRecord?.id ?? 'none') : 'tool'}
        history={history}
        onSaved={onSaved}
        onDelete={(h) => void bucket.remove(h.id)}
        extraInput={extraInput}
        resultBar={resultBar}
        pendingFile={pendingFile}
        onPendingDone={() => setPendingFile(null)}
        initialUi={initialUi}
        embedded={embedded}
      />
    </div>
  )
}
