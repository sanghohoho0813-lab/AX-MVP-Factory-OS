/**
 * 지원사업 신청 준비 — 낼 서류 체크 (D-151).
 *
 * 업체의 신청 건 하나에 붙는다. 서류함에 있는 서류는 서류함을 보고 저절로(마감일 기준),
 * 신청서 · 사업계획서처럼 서류함에 없는 것은 체크해서 챙긴다. 모자란 것만 카톡 문구로 복사.
 */
import { Link } from 'react-router-dom'
import { Send, AlertTriangle, CheckCircle2, Copy, ExternalLink, FolderOpen, XCircle } from 'lucide-react'
import type { ClientOpsRecord, FundingApplication } from '../../types/clientOps'
import { applyReadiness, grantDocRequestMessage, portalRequestTitles, type ApplyDocView } from '../../services/grants/grantApply'
import { copyText } from '../consulting/studioParts'
import { useToast } from '../ui/toastContext'
import { Button } from '../ui/Button'

const ICON: Record<ApplyDocView['state'], { Icon: typeof CheckCircle2; cls: string; word: string }> = {
  ok: { Icon: CheckCircle2, cls: 'text-success-600', word: '있음' },
  manual_done: { Icon: CheckCircle2, cls: 'text-success-600', word: '준비됨' },
  expires_before_due: { Icon: AlertTriangle, cls: 'text-warning-600', word: '다시 발급' },
  expired: { Icon: XCircle, cls: 'text-danger-600', word: '만료' },
  missing: { Icon: XCircle, cls: 'text-danger-600', word: '없음' },
  manual_todo: { Icon: XCircle, cls: 'text-slate-400', word: '준비 전' },
}

export function GrantApplyChecklist({
  record,
  app,
  today,
  onToggle,
  docsHref,
  portal,
}: {
  /** D-152: 고객 플랫폼에 연결된 업체면 모자란 서류를 고객 화면에 요청(고객이 올리면 서류함으로) */
  portal?: { requested: string[]; request: (items: { title: string; documentType: string }[]) => Promise<number> } | null
  record: ClientOpsRecord
  app: FundingApplication
  today: string
  onToggle: (label: string, done: boolean) => void
  /** 서류 탭 주소 */
  docsHref?: string
}) {
  const { showToast } = useToast()
  const r = applyReadiness(record, app, today)
  const toAsk = portal ? portalRequestTitles(record, app, today, portal.requested) : []
  const ask = async () => {
    if (!portal || toAsk.length === 0) return
    try {
      // 서류함에 그 칸이 있으면 칸 이름(key)으로 — 고객이 올리면 바로 그 칸에 들어간다
      const n = await portal.request(toAsk.map((title) => ({ title, documentType: r.views.find((v) => v.label === title)?.docKey ?? 'grant_apply' })))
      showToast(`고객 화면에 서류 ${n}가지를 요청했습니다 — 고객이 올리면 서류함으로 들어와요`)
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : '요청하지 못했습니다')
    }
  }
  const copy = async () => {
    const ok = await copyText(grantDocRequestMessage(record, app, today))
    showToast(ok ? (r.needFromClient.length ? `서류 요청 문구를 복사했습니다 — ${r.needFromClient.length}가지` : '다 받았다는 문구를 복사했습니다') : '복사하지 못했습니다')
  }
  return (
    <div className="flex flex-col gap-2 rounded-(--radius-control) border border-brand-100 bg-brand-50/40 p-3" data-testid="apply-checklist" data-app={app.id}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="t-body font-semibold text-slate-900" data-testid="apply-count">
          낼 서류 {r.ready === r.total ? <span className="text-success-700">다 모음 ({r.total}가지)</span> : `${r.ready}/${r.total}`}
          {app.applyDueTime && app.applyDueDate && <span className="t-sub font-normal text-slate-600"> · 마감 {app.applyDueDate.slice(5).replace('-', '/')} {app.applyDueTime}</span>}
        </p>
        {app.noticeUrl && (
          <a href={app.noticeUrl} target="_blank" rel="noreferrer" className="tap t-sub inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline">
            공고 원문 <ExternalLink aria-hidden="true" className="size-3.5" />
          </a>
        )}
      </div>
      <ul className="flex flex-col gap-1">
        {r.views.map((v) => {
          const { Icon, cls, word } = ICON[v.state]
          const manual = v.state === 'manual_done' || v.state === 'manual_todo'
          const outside = v.state === 'manual_done' && v.note.startsWith('받았다고')
          const fromClient = v.state === 'missing' || v.state === 'expired' || v.state === 'expires_before_due'
          const body = (
            <>
              <Icon aria-hidden="true" className={`mt-0.5 size-5 shrink-0 ${cls}`} />
              <span className="flex min-w-0 flex-col">
                <span className="t-body [overflow-wrap:anywhere] text-slate-900">
                  {v.label} <span className={`t-sub font-semibold ${cls}`}>· {word}</span>
                </span>
                {!manual && v.state !== 'ok' && <span className="t-sub break-keep text-slate-600">{v.note}</span>}
                {v.state === 'ok' && v.expiresOn && <span className="t-meta text-slate-500">{v.note}</span>}
              </span>
            </>
          )
          return (
            <li key={v.label} data-testid="apply-doc" data-state={v.state}>
              {manual ? (
                <label className="flex min-h-11 cursor-pointer items-start gap-2 rounded-(--radius-control) px-1 py-1.5 hover:bg-white">
                  <input
                    type="checkbox"
                    checked={v.state === 'manual_done'}
                    onChange={(e) => onToggle(v.label, e.target.checked)}
                    className="mt-1 size-5 shrink-0 accent-brand-600"
                    aria-label={`${v.label} 준비됨`}
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="t-body [overflow-wrap:anywhere] text-slate-900">{v.label}</span>
                    <span className="t-sub text-slate-500">{outside ? '카톡 · 메일로 받음 — 서류함에도 올려 두면 다음에 다시 안 받아요' : '우리가 챙길 것 — 다 되면 체크'}</span>
                  </span>
                </label>
              ) : (
                <div className="flex min-h-11 flex-wrap items-start gap-2 px-1 py-1.5">
                  {body}
                  {fromClient && (
                    <label className="tap t-sub ml-auto inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-(--radius-control) px-2 font-medium text-slate-600 hover:bg-white">
                      <input type="checkbox" checked={false} onChange={() => onToggle(v.label, true)} className="size-5 accent-brand-600" aria-label={`${v.label} 받았어요`} />
                      받았어요
                    </label>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={r.needFromClient.length ? 'primary' : 'secondary'} onClick={() => void copy()} data-testid="apply-copy">
          <Copy aria-hidden="true" className="size-4" /> {r.needFromClient.length ? `서류 요청 카톡 문구 (${r.needFromClient.length}가지)` : '다 받았다는 카톡 문구'}
        </Button>
        {portal && toAsk.length > 0 && (
          <Button size="sm" variant="secondary" onClick={() => void ask()} data-testid="apply-portal">
            <Send aria-hidden="true" className="size-4" /> 고객 화면에 요청 ({toAsk.length}가지)
          </Button>
        )}
        {portal && toAsk.length === 0 && r.needFromClient.length > 0 && (
          <span className="t-sub inline-flex min-h-11 items-center px-1 text-slate-600" data-testid="apply-portal-done">
            고객 화면에 요청함 — 올리면 서류함으로 들어와요
          </span>
        )}
        {docsHref && (
          <Link to={docsHref} className="tap t-sub inline-flex min-h-11 items-center gap-1 px-1 font-semibold text-brand-700 hover:underline">
            <FolderOpen aria-hidden="true" className="size-4" /> 서류함 열기
          </Link>
        )}
      </div>
    </div>
  )
}
