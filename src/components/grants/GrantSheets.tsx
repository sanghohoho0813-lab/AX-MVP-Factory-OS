/**
 * 지원사업 알림 — 공고 창(맞는 업체 · 알리기) · 업체 창(맞는 공고 · 문구 · 링크) (D-141).
 */
import { useState } from 'react'
import { ArrowRight, Copy, Link2, Send } from 'lucide-react'
import { BottomSheet } from '../ui/primitives'
import { Button } from '../ui/Button'
import { GRANT_CATEGORY_LABEL, GRANT_SOURCE_LABEL, deadlineOf, rulesText, type GrantMatch, type GrantNotice } from '../../services/grants/grantMatch'
import { missingForMatch, profileLine } from '../../services/grants/grantProfile'
import { CLIENT_KIND_LABEL, type ClientMatch, type GrantClient } from '../../services/grants/grantView'
import { DeadlineText, MatchList, NoticeLink, ReasonList, VerdictBadge } from './GrantParts'

const mdOf = (iso: string) => (iso ? `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}` : '')

export function NoticeSheet({
  notice,
  today,
  matches,
  sentOf,
  linked,
  onCopy,
  onPortal,
  onEdit,
  onTogglePublish,
  onDelete,
  onOpenClient,
  onClose,
}: {
  notice: GrantNotice
  today: string
  matches: ClientMatch[]
  sentOf: (clientId: string) => string
  linked: (clientId: string) => boolean
  onCopy: (x: ClientMatch) => void
  onPortal: (x: ClientMatch) => void
  onEdit: () => void
  onTogglePublish: () => void
  onDelete: () => void
  onOpenClient: (clientId: string) => void
  onClose: () => void
}) {
  const [open, setOpen] = useState<string>('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const d = deadlineOf(notice, today)
  const rules = rulesText(notice.rules)
  const fit = matches.filter((m) => m.match.verdict === 'fit')
  const check = matches.filter((m) => m.match.verdict === 'check')
  return (
    <BottomSheet title="공고" onClose={onClose}>
      <div className="flex flex-col gap-4" data-testid="notice-sheet">
        <div className="flex flex-col gap-1.5">
          <h3 className="t-section break-keep text-slate-900">{notice.title}</h3>
          <div className="t-sub flex flex-wrap items-center gap-x-2 gap-y-1 text-slate-600">
            <span>{notice.agency || '소관 미기재'}</span>
            <span>· {GRANT_CATEGORY_LABEL[notice.category]}</span>
            <DeadlineText d={d} />
            {notice.applyEnd && <span className="text-slate-500">({notice.applyStart ? `${mdOf(notice.applyStart)} ~ ` : '~ '}{mdOf(notice.applyEnd)})</span>}
          </div>
          {notice.amountText && <p className="t-body font-semibold text-slate-800">{notice.amountText}</p>}
          {notice.source === 'example' && <p className="t-sub rounded-(--radius-control) bg-slate-100 px-3 py-2 text-slate-600">예시 공고입니다 — 실제 공고가 아니라서 가망고객 화면에는 나가지 않아요.</p>}
          <div className="flex flex-wrap gap-1.5" data-testid="notice-rules">
            {rules.length === 0 ? <span className="t-sub text-slate-500">조건 없음(전국 · 누구나)</span> : rules.map((r) => <span key={r} className="t-sub rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-slate-700">{r}</span>)}
          </div>
          {notice.target && <p className="t-sub break-keep text-slate-600">지원대상: {notice.target}</p>}
          <NoticeLink url={notice.url} />
        </div>

        <section className="flex flex-col gap-2" aria-label="맞는 업체">
          <h4 className="t-body font-semibold text-slate-900" data-testid="notice-reach">
            맞는 업체 {fit.length}곳{check.length ? ` · 확인 필요 ${check.length}곳` : ''}
          </h4>
          {matches.length === 0 ? (
            <p className="t-sub text-slate-500">지금 업체 중에는 이 공고 조건에 맞는 곳이 없습니다.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-slate-100 rounded-(--radius-control) border border-slate-200">
              {matches.map((x) => {
                const id = x.client.record.id
                const sent = sentOf(id)
                return (
                  <li key={id} className="flex flex-col gap-2 px-3 py-3" data-testid="notice-client" data-client={id}>
                    <div className="flex items-start gap-2">
                      <button type="button" onClick={() => onOpenClient(id)} className="tap t-body inline-flex min-w-0 flex-1 items-center gap-1 text-left font-semibold text-slate-900 hover:text-brand-700">
                        <span className="truncate">{x.client.record.companyName}</span>
                        <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
                      </button>
                      <VerdictBadge v={x.match.verdict} />
                    </div>
                    <div className="t-sub flex flex-wrap items-center gap-x-2 text-slate-500">
                      <span className={x.client.kind === 'prospect' ? 'font-semibold text-cat-client-700' : ''}>{CLIENT_KIND_LABEL[x.client.kind]}</span>
                      {profileLine(x.client.profile) && <span>· {profileLine(x.client.profile)}</span>}
                      {sent && <span data-testid="notice-sent">· 알림 보냄 {mdOf(sent)}</span>}
                    </div>
                    <button type="button" onClick={() => setOpen(open === id ? '' : id)} className="tap t-sub self-start font-semibold text-brand-700 hover:underline" aria-expanded={open === id}>
                      {open === id ? '이유 접기' : x.match.verdict === 'check' ? `확인할 것 ${x.match.unknownCount}가지 보기` : '맞는 이유 보기'}
                    </button>
                    {open === id && <ReasonList reasons={x.match.reasons} />}
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" onClick={() => onCopy(x)} data-testid="notice-copy">
                        <Copy aria-hidden="true" className="size-4" /> 카톡 문구 복사
                      </Button>
                      {linked(id) && (
                        <Button size="sm" variant="secondary" onClick={() => onPortal(x)} data-testid="notice-portal">
                          <Send aria-hidden="true" className="size-4" /> 고객 화면에 올리기
                        </Button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          <Button size="sm" variant="secondary" onClick={onEdit} data-testid="notice-edit">
            고치기
          </Button>
          {notice.source !== 'example' && (
            <Button size="sm" variant="secondary" onClick={onTogglePublish} data-testid="notice-publish">
              {notice.published ? '찾기 화면에서 내리기' : '찾기 화면에 보이기'}
            </Button>
          )}
          {confirmDelete ? (
            <span className="flex flex-wrap items-center gap-2">
              <span className="t-sub text-danger-700">이 공고를 지울까요?</span>
              <Button size="sm" variant="danger" onClick={onDelete} data-testid="notice-delete-yes">
                네, 지우기
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                아니요
              </Button>
            </span>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)} data-testid="notice-delete">
              지우기
            </Button>
          )}
        </div>
        <p className="t-meta text-slate-400">출처: {GRANT_SOURCE_LABEL[notice.source]} · 판정은 공고 조건과 업체 정보를 맞춰 본 것이며 선정 가능성이 아닙니다.</p>
      </div>
    </BottomSheet>
  )
}

export function ClientGrantPanel({
  client,
  matches,
  sentOf,
  linked,
  onCopyAll,
  onCopyLink,
  onPortal,
  onPick,
  onFill,
  compact,
}: {
  client: GrantClient
  matches: GrantMatch[]
  sentOf: (noticeId: string) => string
  linked: boolean
  onCopyAll: () => void
  onCopyLink: () => void
  onPortal?: () => void
  onPick?: (m: GrantMatch) => void
  onFill?: () => void
  compact?: number
}) {
  const fit = matches.filter((m) => m.verdict === 'fit').length
  const check = matches.length - fit
  const missing = missingForMatch(client.profile)
  const shown = compact ? matches.slice(0, compact) : matches
  return (
    <div className="flex flex-col gap-3" data-testid="client-grants">
      <p className="t-sub break-keep text-slate-600">
        {profileLine(client.profile) || '업체 정보가 아직 비어 있어요'} — 지금 접수 중인 공고 중 <strong className="text-slate-900" data-testid="client-grants-count">조건 맞음 {fit}건</strong>
        {check ? ` · 확인 필요 ${check}건` : ''}
      </p>
      {missing.length > 0 && (
        <p className="t-sub break-keep rounded-(--radius-control) border border-warning-200 bg-warning-50 px-3 py-2 text-warning-800" data-testid="client-grants-missing">
          {missing.join(' · ')}을(를) 적으면 더 정확해져요.
          {onFill && (
            <button type="button" onClick={onFill} className="tap ml-1 font-semibold text-brand-700 underline">
              회사 정보 적기
            </button>
          )}
        </p>
      )}
      {shown.length > 0 ? <MatchList matches={shown} sentOf={sentOf} onPick={onPick} /> : <p className="t-sub text-slate-500">지금 맞는 공고가 없습니다. 새 공고가 들어오면 여기에 바로 보여요.</p>}
      {compact && matches.length > compact && <p className="t-sub text-slate-500">그 외 {matches.length - compact}건</p>}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="primary" onClick={onCopyAll} disabled={matches.length === 0} data-testid="client-grants-copy">
          <Copy aria-hidden="true" className="size-4" /> 카톡 문구 복사
        </Button>
        <Button size="sm" variant="secondary" onClick={onCopyLink} data-testid="client-grants-link">
          <Link2 aria-hidden="true" className="size-4" /> 찾기 링크 복사
        </Button>
        {linked && onPortal && (
          <Button size="sm" variant="secondary" onClick={onPortal} disabled={matches.length === 0} data-testid="client-grants-portal">
            <Send aria-hidden="true" className="size-4" /> 고객 화면에 올리기
          </Button>
        )}
      </div>
    </div>
  )
}
