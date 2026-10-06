/**
 * 지원사업 알림 — 공고 창(맞는 업체 · 알리기) · 업체 창(맞는 공고 · 문구 · 링크) (D-141).
 */
import { useState } from 'react'
import { ArrowRight, ClipboardCheck, Copy, Link2, Send } from 'lucide-react'
import { BottomSheet } from '../ui/primitives'
import { Button } from '../ui/Button'
import { AiSoonButton } from '../ui/AiSoonButton'
import { GRANT_CATEGORY_LABEL, GRANT_SOURCE_LABEL, deadlineOf, rulesText, type GrantMatch, type GrantNotice } from '../../services/grants/grantMatch'
import { missingForMatch, profileLine } from '../../services/grants/grantProfile'
import { CLIENT_KIND_LABEL, type ClientMatch, type GrantClient } from '../../services/grants/grantView'
import { ChallengeButton, DeadlineText, MatchList, NoticeLink, ReasonList, VerdictBadge, type ChallengeControl } from './GrantParts'
import { applicationFor, applyReadiness } from '../../services/grants/grantApply'

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
  readOnly,
  onApply,
  onOpenApply,
  onChallenge,
  challengeBusy,
}: {
  /** D-156: 이 업체에 '도전해 볼 만함' 체크 · 풀기 */
  onChallenge?: (x: ClientMatch) => void
  challengeBusy?: boolean
  /** D-151: 이 업체로 신청 준비 — 없으면 단추를 숨긴다 */
  onApply?: (x: ClientMatch) => void
  /** 이미 신청 준비 중인 건 열기(업체 상세 · 신청 탭) */
  onOpenApply?: (clientId: string) => void
  /** 기업마당에서 매일 받는 공고 — 고치기 · 지우기 없음 */
  readOnly?: boolean
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
            <p className="t-sub break-keep text-slate-500">
              {rules.length === 0 ? '업체를 가려 받는 조건이 없는 전국 공통 공고예요. 업체마다 따로 알리기보다 필요한 곳에 안내해 주세요.' : '지금 업체 중에는 이 공고 조건(지역 · 업력 · 업종 등)에 맞는 곳이 없습니다.'}
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-slate-100 rounded-(--radius-control) border border-slate-200">
              {matches.map((x) => {
                const id = x.client.record.id
                const sent = sentOf(id)
                const applied = applicationFor(x.client.record, notice)
                const ready = applied?.docs ? applyReadiness(x.client.record, applied, today) : null
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
                      {onChallenge && !ready && (
                        <ChallengeButton app={applied} onToggle={() => onChallenge(x)} busy={challengeBusy} closed={d.state === 'closed'} />
                      )}
                      <Button size="sm" variant="secondary" onClick={() => onCopy(x)} data-testid="notice-copy">
                        <Copy aria-hidden="true" className="size-4" /> 카톡 문구 복사
                      </Button>
                      {linked(id) && (
                        <Button size="sm" variant="secondary" onClick={() => onPortal(x)} data-testid="notice-portal">
                          <Send aria-hidden="true" className="size-4" /> 고객 화면에 올리기
                        </Button>
                      )}
                      {onApply && d.state !== 'closed' && !ready && (
                        <Button size="sm" variant="primary" onClick={() => onApply(x)} data-testid="notice-apply">
                          <ClipboardCheck aria-hidden="true" className="size-4" /> 신청 준비
                        </Button>
                      )}
                    </div>
                    {ready && (
                      <button
                        type="button"
                        onClick={() => onOpenApply?.(id)}
                        className="tap t-sub inline-flex items-center gap-1.5 self-start rounded-full border border-brand-200 bg-brand-50 px-3 py-1 font-semibold text-brand-800 hover:bg-brand-100"
                        data-testid="notice-applied"
                      >
                        <ClipboardCheck aria-hidden="true" className="size-4 shrink-0" />
                        신청 준비 중 · {ready.ready === ready.total ? '서류 다 모음' : `서류 ${ready.ready}/${ready.total}`}
                        <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {readOnly ? (
          <p className="t-sub break-keep border-t border-slate-100 pt-3 text-slate-500" data-testid="notice-feed-note">
            기업마당에서 매일 아침 9시에 받아 오는 공고라 여기서 고치거나 지우지 않아요. 내용이 바뀌면 다음 받을 때 같이 바뀝니다.
          </p>
        ) : (
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
        )}
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
  challenge,
}: {
  /** D-156: 공고마다 '도전해 볼 만함' 체크 */
  challenge?: ChallengeControl
  client: GrantClient
  matches: GrantMatch[]
  sentOf: (noticeId: string) => string
  linked: boolean
  onCopyAll: () => void
  /** 없으면 '찾기 링크 복사' 단추를 그리지 않는다(Pilot) */
  onCopyLink?: () => void
  onPortal?: () => void
  onPick?: (m: GrantMatch) => void
  onFill?: () => void
  compact?: number
}) {
  const [showGeneral, setShowGeneral] = useState(false)
  const [limit, setLimit] = useState(30)
  // 업체를 겨냥한 공고(맞음 · 확인 필요)를 먼저, 누구나 되는 '전국 공통' 은 접어 둔다
  const targeted = matches.filter((m) => m.verdict === 'fit' || m.verdict === 'check')
  const general = matches.filter((m) => m.verdict === 'general')
  const fit = targeted.filter((m) => m.verdict === 'fit').length
  const check = targeted.length - fit
  const missing = missingForMatch(client.profile)
  // 1,000건이면 맞는 공고도 수백 건 — 30건씩 이어 본다
  const shown = compact ? targeted.slice(0, compact) : targeted.slice(0, limit)
  return (
    <div className="flex flex-col gap-3" data-testid="client-grants">
      {challenge && (
        <p className="t-sub break-keep text-slate-500" data-testid="challenge-hint">
          맞는 공고는 알림으로 띄우지 않아요. 해 볼 만한 공고만 <b className="font-semibold text-slate-700">☆ 도전해 볼 만함</b> 을 누르면 그 마감만 일정 · 오늘에 뜹니다.
        </p>
      )}
      <p className="t-sub break-keep text-slate-600">
        {profileLine(client.profile) || '업체 정보가 아직 비어 있어요'} — 지금 접수 중인 공고 중 <strong className="text-slate-900" data-testid="client-grants-count">조건 맞음 {fit}건</strong>
        {check ? ` · 확인 필요 ${check}건` : ''}
        {general.length ? ` · 전국 공통 ${general.length}건` : ''}
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
      {shown.length > 0 ? (
        <MatchList matches={shown} sentOf={sentOf} onPick={onPick} challenge={challenge} />
      ) : (
        <p className="t-sub break-keep text-slate-500">지역 · 업력 · 업종까지 맞는 공고가 지금은 없습니다. 새 공고가 들어오면 여기에 바로 보여요.</p>
      )}
      {compact && targeted.length > compact && <p className="t-sub text-slate-500">그 외 {targeted.length - compact}건</p>}
      {!compact && targeted.length > limit && (
        <Button size="sm" variant="secondary" onClick={() => setLimit((v) => v + 60)} className="self-center" data-testid="client-grants-more">
          더 보기 (남은 {targeted.length - limit}건)
        </Button>
      )}
      {!compact && general.length > 0 && (
        <div className="flex flex-col gap-2">
          <button type="button" onClick={() => setShowGeneral((v) => !v)} aria-expanded={showGeneral} data-testid="client-grants-general" className="tap t-sub self-start font-semibold text-brand-700 hover:underline">
            전국 공통 공고 {general.length}건 {showGeneral ? '접기' : '보기'} (누구나 신청 · 업체 조건 없음)
          </button>
          {showGeneral && <MatchList matches={general.slice(0, 100)} sentOf={sentOf} onPick={onPick} challenge={challenge} />}
          {showGeneral && general.length > 100 && <p className="t-sub text-slate-500">그 외 {general.length - 100}건은 지원사업 알림 화면에서 찾아 보세요.</p>}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="primary" onClick={onCopyAll} disabled={targeted.length === 0} data-testid="client-grants-copy">
          <Copy aria-hidden="true" className="size-4" /> 카톡 문구 복사
        </Button>
        <AiSoonButton size="sm" label="AI로 맞춤 안내문" what="이 업체 사정에 맞춰 공고 안내 문구와 준비 서류 목록을 써 줍니다" />
        {onCopyLink && (
          <Button size="sm" variant="secondary" onClick={onCopyLink} data-testid="client-grants-link">
            <Link2 aria-hidden="true" className="size-4" /> 찾기 링크 복사
          </Button>
        )}
        {linked && onPortal && (
          <Button size="sm" variant="secondary" onClick={onPortal} disabled={targeted.length === 0} data-testid="client-grants-portal">
            <Send aria-hidden="true" className="size-4" /> 고객 화면에 올리기
          </Button>
        )}
      </div>
    </div>
  )
}
