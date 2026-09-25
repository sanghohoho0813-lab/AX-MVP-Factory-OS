/**
 * 크레탑 분석기 (D-88) — corp-consult-sales-os 의 `cretop-engine` 을 한 글자도 바꾸지 않고 옮긴 것.
 *
 * 흐름: 크레탑 기업종합보고서 PDF 를 넣거나 원문을 붙여넣는다 → 엔진이 회사 정보·핵심 15개·3개년 추이·
 * 재무비율 5영역을 뽑는다 → 1차 미팅 포인트(원본 영업 OS 의 15개 규칙)를 만든다 → 업체 기록에 붙인다.
 *
 * 모든 수치는 '후보' 다 — 엔진이 그렇게 설계됐고(비단정 톤), 화면도 그 말을 지운다거나 바꾸지 않는다.
 * 골든 회귀 3벌(`npm run test:cretop`)이 원본과 같은 숫자를 지킨다. OCR 은 하지 않는다.
 */

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, FolderOpen, Copy, Check } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { toolOf } from '../../config/toolRegistry'
import { ModuleDashboard } from '../shared/ModuleDashboard'
import { useModuleSection } from '../shared/ModuleRoute'
import { ExtractorScreen } from './screens/ExtractorScreen'
import { CoreCheckScreen } from './screens/CoreCheckScreen'
import { Button } from '../../components/ui/Button'
import { CretopMiniApp, buildOneLiner, oneLinerText, type CretopMiniHistoryItem, type CretopMiniUi } from './mini/MiniApp.jsx'
import { svCurrent, svSummaryLines } from './mini/stockValueCalc.js'
import { useModuleBucket } from '../shared/useModuleBucket'
import { useToast } from '../../components/ui/toastContext'
import { ToolResultAttach } from '../shared/ToolResultAttach'
import { useToolClient } from '../shared/toolClientContext'
import { fetchClientDocFile, hasDocFile } from '../shared/clientDocFile'

/** 분석 이력 한 줄 — 원본은 Supabase analyses 에, 이 OS 는 모듈 기록(cretop/analyses)에 */
interface AnalysisRow extends Record<string, unknown> {
  company: string
  bizNo: string
  ts: string
  ui: CretopMiniUi
}

/** 원본 크레탑 분석 앱(D-93) + 이 OS 의 업체 연결(서류함 보고서 · 업체 기록에 붙이기 · 이력) */
function CretopScreen() {
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

  const onSaved = (ui: CretopMiniUi) => {
    const co = ui.companyInfo ?? {}
    const company = co.companyName || '기업명 미상'
    const bizNo = co.businessNo || ''
    // 같은 회사(사업자번호·이름)의 이전 이력은 새 것으로 바꾼다 — 원본 비회원 이력과 같은 규칙
    const prev = (bucket.rows ?? []).find((r) => (bizNo && r.data.bizNo === bizNo) || r.data.company === company)
    // 원본처럼 저장이 안 되면 알려 준다 ('분석 저장 실패') — 결과 화면은 그대로 남는다
    bucket.save({ id: prev?.id, clientId: clientId ?? prev?.clientId ?? '', data: { company, bizNo, ts: new Date().toISOString(), ui } }).catch((e: unknown) => {
      showToast(`분석 저장 실패: ${e instanceof Error ? e.message : '오류'} — 연결을 확인하세요. 결과는 화면에 그대로 있습니다.`)
    })
  }

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
    const one = buildOneLiner(ui)
    // D-111: 주식가치 탭에서 본(고친) 값 그대로 — 계산이 안 되면(발행주식수 없음 등) 줄을 넣지 않는다
    const sv = svCurrent(ui)
    const svLines = svSummaryLines(ui)
    const summary = [
      oneLinerText(one),
      ...(selected.length ? ['', '■ 최종 선택 컨설팅 항목', ...selected.map((n, i) => `${i + 1}. ${n}`)] : []),
      ...(svLines.length ? ['', ...svLines] : []),
      '',
      '※ 크레탑 원문 기준 참고용 분석이며, 실제 상담 전 원문 확인이 필요합니다.',
    ].join('\n')
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
        <ToolResultAttach
          toolKey="cretop"
          title="크레탑 분석"
          verdict={null}
          verdictLabel={one.risks[0] ?? ''}
          summary={summary}
          data={{
            companyInfo: ui.companyInfo,
            corePreview: ui.corePreview,
            oneLiner: one,
            selected,
            stockValue: sv.r ? { perShare: Math.round(sv.r.finalPerShare), total: Math.round(sv.r.totalValue), shares: sv.shares, corpType: sv.r.corpType, edited: sv.edited } : null,
          }}
          subject={{ name: ui.companyInfo?.companyName, bizNo: ui.companyInfo?.businessNo }}
        />
        <span className="t-meta text-slate-500">분석 결과를 고객 관리 업체 기록에 붙입니다.</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <CretopMiniApp
        history={history}
        onSaved={onSaved}
        onDelete={(h) => void bucket.remove(h.id)}
        extraInput={extraInput}
        resultBar={resultBar}
        pendingFile={pendingFile}
        onPendingDone={() => setPendingFile(null)}
      />
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* 목차                                                                 */
/* ------------------------------------------------------------------ */

/** 목차에서 고른 화면 → 이 자리에 선다. 목차 자체는 `toolRegistry` 의 sections 가 정한다. */
export function CretopPage() {
  const section = useModuleSection()
  const meta = toolOf('cretop')?.sections?.find((s) => s.key === section)

  if (section === 'analyze') return <CretopScreen />

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="크레탑 분석기"
        description={meta?.hint ? `${meta.label} — ${meta.hint}` : '크레탑 기업종합보고서를 넣으면 핵심 재무와 미팅 포인트를 뽑습니다.'}
      />
      {section === 'core-check' && <CoreCheckScreen />}
      {section === 'extractor' && <ExtractorScreen />}
      {section !== 'core-check' && section !== 'extractor' && <ModuleDashboard toolKey="cretop" />}
    </div>
  )
}
