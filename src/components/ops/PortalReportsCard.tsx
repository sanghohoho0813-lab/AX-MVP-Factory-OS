/**
 * D-681 업체 상세 › 고객 플랫폼 탭 — 고객에게 보낸 보고서 · 고객이 열어 봤는지 · 확인했는지.
 *
 * 첫 화면은 한 줄(보고서 n · [보고서 만들기]) + 최근 3편 — 나머지는 [n편 더 보기].
 * 한 편마다: 종류 · 제목 · 발행일 · 판(정정) · 고객 계정마다 '열어 봄 m/d · 확인 m/d' 또는 '아직 안 봄'.
 * 단추: [고객 화면으로 보기](미리보기 — 기록 0) · [안내 문구] · [정정] · [내리기](까닭은 내부에만).
 * 열람 기록은 고객 계정만 남길 수 있다(직원이 만들 수 없다 — 0033). 연습 모드에는 열람 기록이 없다.
 */
import { useState } from 'react'
import { ClipboardCopy, Eye, FilePlus2, PencilLine, Undo2 } from 'lucide-react'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { HelpHeading } from '../ui/fold'
import { useToast } from '../ui/toastContext'
import type { ClientOpsRecord } from '../../types/clientOps'
import type { PortalClientLink } from '../../types/bridge'
import { brand } from '../../brand/brand.config'
import { copyText } from '../../services/grants/grantView'
import { localDateOf } from '../../lib/appClock'
import { REPORT_KIND_LABEL, reportNoticeText } from '../../services/portalGrowthRules'
import { growthErrorText, previewReport, reportCustomerUrl, withdrawReport, type PortalReceipt, type PortalReport } from '../../services/portalGrowth'
import { PortalReportView } from './PortalReportView'

const SHOW = 3
const md = (iso?: string | null) => {
  const d = localDateOf(iso ?? '')
  return d ? `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}` : ''
}

export function PortalReportsCard({
  record,
  links,
  reports,
  receipts,
  readOnly,
  onCreate,
  onCorrect,
  onChanged,
}: {
  record: ClientOpsRecord
  links: readonly PortalClientLink[]
  reports: readonly PortalReport[]
  receipts: readonly PortalReceipt[]
  /** 대표가 팀장 화면을 보는 중 등 — 발행 · 내리기 단추 없음 */
  readOnly?: boolean
  onCreate: () => void
  onCorrect: (r: PortalReport) => void
  onChanged: () => void
}) {
  const { showToast } = useToast()
  const [all, setAll] = useState(false)
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null)
  const [withdrawing, setWithdrawing] = useState<{ id: string; reason: string } | null>(null)
  const [busy, setBusy] = useState(false)
  // 정정된 예전 판은 목록에서 접는다(새 판 아래 '정정 전 판 n' 으로) — 같은 보고서가 두 번 보이지 않게
  const visible = reports.filter((r) => r.status !== 'superseded')
  const shown = all ? visible : visible.slice(0, SHOW)
  const people = links.filter((l) => l.status === 'active' || l.status === 'paused')
  const who = record.representativeName ? `${record.representativeName} 대표님` : `${record.companyName} 담당자님`

  const seenLine = (r: PortalReport) => {
    if (r.status !== 'published') return null
    if (!people.length) return <span className="text-slate-500">연결된 고객 계정이 없어요 — 연결하면 보여요</span>
    return people.map((l) => {
      const rc = receipts.find((x) => x.itemKind === 'report' && x.itemId === r.id && x.linkId === l.id)
      const name = l.profileEmail || '고객 계정'
      return (
        <span key={l.id} className={rc ? 'text-slate-700' : 'text-danger-700'} data-testid="report-seen" data-seen={rc ? '1' : '0'} data-ack={rc?.acknowledgedAt ? '1' : '0'}>
          {name} · {rc ? `열어 봄 ${md(rc.firstSeenAt)}${rc.acknowledgedAt ? ` · 확인 ${md(rc.acknowledgedAt)}` : ' · 확인 전'}` : '아직 안 봄'}
        </span>
      )
    })
  }

  const doWithdraw = async () => {
    if (!withdrawing || busy) return
    setBusy(true)
    try {
      await withdrawReport(withdrawing.id, withdrawing.reason)
      setWithdrawing(null)
      showToast('고객 화면에서 내렸어요. 기록은 남아 있어요.')
      onChanged()
    } catch (cause) {
      showToast(growthErrorText(cause, '내리지 못했어요 — 잠시 뒤 다시 눌러 주세요.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-(--radius-panel) border border-slate-200 bg-white p-4 shadow-(--shadow-card)" data-testid="portal-reports">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <HelpHeading as="h3" tight label="고객에게 보낸 보고서" className="text-[1rem] font-bold text-slate-900">
          고객에게 보낸 보고서 <span className="text-slate-400">{visible.filter((r) => r.status === 'published').length}</span>
        </HelpHeading>
        {!readOnly && (
          <Button variant="primary" onClick={onCreate} data-testid="report-create" data-guide="fn-portal-report">
            <FilePlus2 aria-hidden="true" className="size-4" /> 보고서 만들기
          </Button>
        )}
      </div>
      {visible.length === 0 ? (
        <p className="mt-2 text-[0.9375rem] break-keep text-slate-500">아직 보낸 보고서가 없어요. 업체 기록으로 경과 보고 초안을 만들어 고객 화면에 올릴 수 있어요.</p>
      ) : (
        <ol className="mt-3 flex flex-col gap-2">
          {shown.map((r) => {
            const older = reports.filter((x) => x.reportGroup === r.reportGroup && x.status === 'superseded').length
            return (
              <li key={r.id} className="rounded-(--radius-card) border border-slate-200 p-3" data-testid="report-row" data-status={r.status} data-version={r.version}>
                <div className="flex flex-wrap items-center gap-2 text-[0.875rem]">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">{REPORT_KIND_LABEL[r.kind]}</span>
                  <span className="text-slate-500">{md(r.publishedAt)} 발행</span>
                  {r.version > 1 && <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">{r.version}판 · 정정</span>}
                  {r.status === 'withdrawn' && <span className="rounded-full bg-danger-50 px-2 py-0.5 font-semibold text-danger-700">내림 {md(r.withdrawnAt)}</span>}
                </div>
                <p className={`mt-1 text-[1rem] font-semibold break-keep ${r.status === 'withdrawn' ? 'text-slate-500 line-through' : 'text-slate-900'}`}>{r.title}</p>
                {r.status === 'withdrawn' && r.withdrawnReason && <p className="t-sub text-slate-500">내린 까닭(내부에만): {r.withdrawnReason}</p>}
                <p className="t-sub mt-1 flex flex-col gap-0.5">{seenLine(r)}</p>
                {older > 0 && <p className="t-meta mt-1 text-slate-500">정정 전 판 {older}개는 고객 화면에서 '새 판 있음' 으로만 보여요.</p>}
                {r.status === 'published' && (
                  withdrawing?.id === r.id ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2" data-testid="report-withdraw-form">
                      <input value={withdrawing.reason} maxLength={300} onChange={(e) => setWithdrawing({ id: r.id, reason: e.target.value })} placeholder="내리는 까닭(내부에만 남아요)" className="t-sub min-h-10 min-w-0 flex-1 basis-56 rounded-(--radius-control) border border-slate-300 px-2.5" data-testid="report-withdraw-reason" />
                      <Button size="sm" variant="danger" disabled={busy} onClick={() => void doWithdraw()} data-testid="report-withdraw-go">고객 화면에서 내리기</Button>
                      <Button size="sm" variant="ghost" onClick={() => setWithdrawing(null)}>취소</Button>
                    </div>
                  ) : (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Button size="sm" variant="secondary" data-testid="report-preview-open" onClick={() => void previewReport(r.id).then(setPreview).catch((c) => showToast(growthErrorText(c, '미리보기를 열지 못했어요.')))}>
                        <Eye aria-hidden="true" className="size-4" /> 고객 화면으로 보기
                      </Button>
                      <Button size="sm" variant="secondary" data-testid="report-notice-again" onClick={() => void copyText(reportNoticeText({ who, kindLabel: REPORT_KIND_LABEL[r.kind], title: r.title, url: reportCustomerUrl(brand.customerPlatformUrl, r.id), corrected: r.version > 1 })).then((ok) => showToast(ok ? '안내 문구를 복사했어요.' : '복사하지 못했어요.'))}>
                        <ClipboardCopy aria-hidden="true" className="size-4" /> 안내 문구
                      </Button>
                      {!readOnly && (
                        <>
                          <Button size="sm" variant="ghost" data-testid="report-correct" onClick={() => onCorrect(r)}>
                            <PencilLine aria-hidden="true" className="size-4" /> 정정
                          </Button>
                          <Button size="sm" variant="ghost" data-testid="report-withdraw" onClick={() => setWithdrawing({ id: r.id, reason: '' })}>
                            <Undo2 aria-hidden="true" className="size-4" /> 내리기
                          </Button>
                        </>
                      )}
                    </div>
                  )
                )}
              </li>
            )
          })}
        </ol>
      )}
      {visible.length > SHOW && (
        <button type="button" onClick={() => setAll((v) => !v)} className="tap t-sub mt-2 min-h-10 font-semibold text-brand-700 hover:underline" data-testid="report-more">
          {all ? '접기' : `${visible.length - SHOW}편 더 보기`}
        </button>
      )}
      <Modal open={preview !== null} title="고객 화면 미리보기 (기록되지 않아요)" size="lg" onClose={() => setPreview(null)}>
        {preview && (
          <PortalReportView
            report={{
              kind: (preview.kind as PortalReport['kind']) ?? 'progress',
              title: String(preview.title ?? ''),
              periodStart: (preview.period_start as string | null) ?? null,
              periodEnd: (preview.period_end as string | null) ?? null,
              summary: String(preview.summary ?? ''),
              sections: Array.isArray(preview.sections) ? (preview.sections as PortalReport['sections']) : [],
              staffNote: (preview.staff_note as string | null) ?? null,
              version: Number(preview.version) || 1,
              correctionNote: (preview.correction_note as string | null) ?? null,
              publishedAt: (preview.published_at as string | null) ?? null,
            }}
          />
        )}
      </Modal>
    </section>
  )
}
