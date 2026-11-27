import { useCallback, useEffect, useMemo, useState } from 'react'
import { localDateOf, todayLocalDate } from '../../lib/appClock'
import { Link } from 'react-router-dom'
import { CheckCircle2, ClipboardCopy, ExternalLink, Eye, Link2, MessageSquareReply, Pause, Play, Plus, Send, Share2, Sparkles, Unlink, Upload } from 'lucide-react'
import { InlineConfirm } from '../ui/InlineConfirm'
import type { ClientOpsRecord, DocumentKey } from '../../types/clientOps'
import { contractStageOf } from '../../types/clientOps'
import { withDocument } from '../../services/clientOpsService'
import { filePortalDocument } from '../../services/docShelf'
import type { CustomerEvent, PortalClientLink, PortalDocument, PortalProjection, PortalRequest, PortalUpdate } from '../../types/bridge'
import { Button } from '../ui/Button'
import { HelpHeading } from '../ui/fold'
import { Modal } from '../ui/Modal'
import { useToast } from '../ui/toastContext'
import { EventCard } from './EventCard'
import { PublishUpdateModal } from './PublishUpdateModal'
import {
  DOCUMENT_STATUS_LABEL,
  EVENT_TYPE_LABEL,
  REQUEST_STATUS_LABEL,
  REQUEST_TYPE_LABEL,
  UPDATE_CATEGORY_LABEL,
  answerRequest,
  archiveUpdate,
  createLink,
  eventSummary,
  findProfileByEmail,
  listDocuments,
  listEvents,
  listLinksForClient,
  listRequests,
  listUpdates,
  previewProjection,
  requestDocument,
  reviewDocument,
  seedDemoRequest,
  seedDemoUpload,
  shareDocument,
  updateEvent,
  updateLink,
} from '../../services/customerBridgeService'
import { activityTimeText } from '../../services/clientOpsActivity'
import { CUSTOMER_STAGE_LABEL, CUSTOMER_STAGE_ORDER, type CustomerStage } from '../../config/serviceCatalog'
import { DOCUMENTS } from '../../content/clientOpsCatalog'
import { DELETED_DOC_LABEL, documentMetaOf } from '../../services/clientOpsDocuments'
import { getDataModeConfig } from '../../data/dataMode'
import { brand } from '../../brand/brand.config'
import { useIsPilot, useViewingPilot } from '../../auth/osAccess'
import { copyText } from '../../services/grants/grantView'
import { isGrowthOff, listClientReports, listLinkAccounts, listReceipts, type PortalReceipt, type PortalReport } from '../../services/portalGrowth'
import { PORTAL_USAGE_LABEL, hasActiveWork, portalFollowUps, portalInviteText, portalUsage, daysBetween, type PortalSeen } from '../../services/portalGrowthRules'
import { PortalReportsCard } from './PortalReportsCard'
import { PortalReportSheet } from './PortalReportSheet'

function isNotReadyError(cause: unknown): boolean {
  const o = cause as { message?: unknown; code?: unknown; details?: unknown } | null
  const msg = [o?.message, o?.code, o?.details].filter((v) => typeof v === 'string').join(' ') || String(cause)
  // D-153: 표가 아직 없을 때만 — 예전에는 'PGRST' · 'portal_' 이 들어간 모든 오류(로그인 만료 PGRST301 · 권한 오류)를 '아직 안 켬' 으로 숨겼다
  return /relation .* does not exist|42P01|PGRST205|schema cache|Could not find the (?:table|function)/i.test(msg)
}

/**
 * 업체 상세 > 고객 플랫폼 탭.
 * 연결 계정 · 고객 이벤트 · 고객 요청(답변) · 공유 서류(요청/확인/공유) · 공개한 업데이트 · 고객 화면 미리보기.
 * 고객 인증을 우회하지 않는다 — 미리보기는 고객 투영과 같은 함수를 워크스페이스 권한으로 부른 결과다.
 */
export function PortalTab({
  record,
  workspaceId,
  onRecordChange,
  latest,
}: {
  record: ClientOpsRecord
  workspaceId: string | null
  /** D-153: 확인 완료를 기다리는 동안 고친 것을 덮지 않게 — 저장 직전의 최신 기록 */
  latest?: () => ClientOpsRecord
  /** D-122: 고객이 올린 서류를 확인하면 내부 서류함에도 '받음' 으로 — 업체 기록 저장 */
  onRecordChange?: (next: ClientOpsRecord) => Promise<boolean>
}) {
  const { showToast } = useToast()
  const isLocal = getDataModeConfig().mode === 'local'
  const [links, setLinks] = useState<PortalClientLink[]>([])
  const [events, setEvents] = useState<CustomerEvent[]>([])
  const [updates, setUpdates] = useState<PortalUpdate[]>([])
  const [requests, setRequests] = useState<PortalRequest[]>([])
  const [documents, setDocuments] = useState<PortalDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [notReady, setNotReady] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const [preview, setPreview] = useState<PortalProjection | null>(null)
  const [linkEmail, setLinkEmail] = useState(record.contactEmail)
  const [linkBusy, setLinkBusy] = useState(false)
  const [docForm, setDocForm] = useState<{ open: boolean; key: string; title: string; note: string }>({ open: false, key: 'businessRegistration', title: '사업자등록증', note: '' })
  const [answerDraft, setAnswerDraft] = useState<Record<string, string>>({})
  // D-681 고객성장관리 — 보고서 · 고객 열람 기록(0033). off = 아직 안 켬(그 칸만 숨기고 나머지는 예전 그대로)
  const [growth, setGrowth] = useState<{ off: boolean; reports: PortalReport[]; receipts: PortalReceipt[] }>({ off: true, reports: [], receipts: [] })
  const [reportSheet, setReportSheet] = useState<{ correcting: PortalReport | null } | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  // 끊기 한 번 더 묻는 중인 연결 id · 연결된 계정 이메일(연결 id → 이메일 — 0033 서버 함수)
  const [revoking, setRevoking] = useState('')
  const [accounts, setAccounts] = useState<Map<string, string>>(new Map())
  const readOnly = useViewingPilot() !== null
  const pilot = useIsPilot()
  const today = todayLocalDate()

  const link = links.find((l) => l.status === 'active') ?? links[0] ?? null
  const emailOf = (l: PortalClientLink) => l.profileEmail || accounts.get(l.id) || ''

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const ls = await listLinksForClient(workspaceId, record.id)
      setLinks(ls)
      const active = ls.find((l) => l.status === 'active') ?? ls[0]
      const ev = await listEvents(workspaceId)
      setEvents(ev.filter((e) => e.operationsClientId === record.id || (active && e.portalClientLinkId === active.id)))
      if (active) {
        const [u, r, d] = await Promise.all([
          listUpdates(workspaceId, active.id),
          listRequests(workspaceId, active.id),
          listDocuments(workspaceId, active.id),
        ])
        setUpdates(u)
        setRequests(r)
        setDocuments(d)
      } else {
        setUpdates([]); setRequests([]); setDocuments([])
      }
      setNotReady(false)
      // 보고서 · 열람 기록 — 따로 읽는다(0033 이 없어도 이 탭의 나머지는 예전 그대로)
      try {
        const [reps, rcs, accs] = await Promise.all([
          listClientReports(workspaceId, record.id),
          listReceipts(workspaceId, record.id),
          listLinkAccounts(workspaceId, record.id).catch(() => new Map<string, string>()),
        ])
        setGrowth({ off: false, reports: reps, receipts: rcs })
        setAccounts(accs)
      } catch (cause) {
        setGrowth({ off: true, reports: [], receipts: [] })
        if (!isGrowthOff(cause)) showToast('보고서 기록을 읽지 못했어요 — 잠시 뒤 다시 열어 주세요.')
      }
    } catch (cause) {
      if (isNotReadyError(cause)) setNotReady(true)
      else showToast(cause instanceof Error ? cause.message : '불러오지 못했습니다.')
    } finally {
      setLoading(false)
    }
  }, [workspaceId, record.id, showToast])

  useEffect(() => {
    void load()
  }, [load])

  /** 됐으면 true. 도는 동안에는 같은 단추를 다시 못 누른다(D-120 — 두 번 눌러 두 번 요청되던 것) */
  const [running, setRunning] = useState(false)
  const run = async (fn: () => Promise<unknown>, done?: string): Promise<boolean> => {
    setRunning(true)
    try {
      await fn()
      await load()
      if (done) showToast(done)
      return true
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : '저장하지 못했습니다.')
      return false
    } finally {
      setRunning(false)
    }
  }

  const connect = async () => {
    const email = linkEmail.trim()
    if (!email) { showToast('고객 계정 이메일을 입력해 주세요.'); return }
    setLinkBusy(true)
    try {
      const profile = await findProfileByEmail(email)
      if (!profile) {
        showToast(`${email} 로 가입한 ${brand.customerPlatformLabel} 계정을 찾지 못했습니다. 고객이 먼저 가입해야 합니다.`)
        return
      }
      await createLink(workspaceId, { operationsClientId: record.id, profileId: profile.id, profileEmail: profile.email })
      await load()
      showToast('고객 계정을 연결했습니다. 이제 고객이 My MIRAE 에서 이 프로젝트를 봅니다.')
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : '연결하지 못했습니다.')
    } finally {
      setLinkBusy(false)
    }
  }

  const openPreview = async () => {
    if (!link) return
    try {
      setPreview(await previewProjection(workspaceId, link, record.companyName))
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : '미리보기를 불러오지 못했습니다.')
    }
  }

  const homeSeen = useMemo(() => {
    const m = new Map<string, PortalSeen>()
    for (const r of growth.receipts) if (r.itemKind === 'home') m.set(r.linkId, { first: r.firstSeenAt, last: r.lastSeenAt })
    return m
  }, [growth.receipts])
  const linkLites = useMemo(() => links.map((l) => ({ id: l.id, status: l.status, linkedAt: l.linkedAt, profileEmail: l.profileEmail })), [links])
  const usage = portalUsage({ links: linkLites, homeSeen, invitedAt: record.portalInvite?.at ?? null }, today)
  const followUps = useMemo(
    () =>
      growth.off
        ? []
        : portalFollowUps(
            {
              clientId: record.id,
              invitedAt: record.portalInvite?.at ?? null,
              links: linkLites,
              homeSeen,
              reports: growth.reports.map((r) => ({ id: r.id, status: r.status, publishedAt: r.publishedAt })),
              reportSeen: new Set(growth.receipts.filter((r) => r.itemKind === 'report').map((r) => r.itemId)),
              activeWork: hasActiveWork(record),
              visitsKnown: !isLocal,
              contracted: contractStageOf(record.status) === 'signed',
            },
            today,
          ),
    [growth, linkLites, homeSeen, record, today, isLocal],
  )
  const inviteText = portalInviteText({
    who: record.representativeName ? `${record.representativeName} 대표님` : `${record.companyName} 담당자님`,
    signupUrl: `${brand.customerPlatformUrl}/signup?next=${encodeURIComponent(brand.customerProjectsPath)}`,
    email: record.contactEmail || undefined,
  })
  const markInvited = async () => {
    if (!onRecordChange) return
    const fresh = latest?.() ?? record
    if (await onRecordChange({ ...fresh, portalInvite: { at: today } })) {
      setInviteOpen(false)
      showToast('가입 안내를 보냈다고 적었어요. 3일 지나도 연결이 없으면 다시 알려 드려요.')
    }
  }

  const docOptions = useMemo(() => DOCUMENTS.filter((d) => d.needsFile), [])
  const openRequests = requests.filter((r) => r.status === 'open' || r.status === 'answered')
  const published = updates.filter((u) => u.status === 'published')

  if (notReady) {
    return (
      <div className="rounded-(--radius-panel) border border-warning-200 bg-warning-50 p-4">
        {/* D-122: 개발자 말(READY · 브릿지 테이블 · 마이그레이션 · 파일 경로)을 앞에 두지 않는다 */}
        <p className="text-[1rem] font-semibold text-warning-700">고객 플랫폼 연결을 아직 켜지 않았습니다</p>
        <p className="mt-1 text-[0.9375rem] break-keep text-slate-700">연결이 켜지면 이 탭에서 고객에게 소식 · 서류 요청을 보낼 수 있습니다. 관리자에게 '고객 플랫폼 연결을 켜 달라' 고 알려 주세요.</p>
        <details className="mt-2 text-[0.875rem] text-slate-500">
          <summary className="sum-chev cursor-pointer">관리자용 안내</summary>
          <p className="mt-1 break-keep">클라우드에 브릿지 테이블이 없습니다. docs/SETUP.md 의 순서대로 마이그레이션을 적용하면 켜집니다.</p>
        </details>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* 연결 상태 */}
      <section className="rounded-(--radius-panel) border border-slate-200 bg-white p-4 shadow-(--shadow-card)">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <HelpHeading as="h3" tight label="고객 화면 연결" className="flex items-center gap-2 text-[1rem] font-bold text-slate-900">
              <Link2 aria-hidden="true" className="size-4 text-slate-400" /> {brand.customerPlatformLabel} 연결
            </HelpHeading>
            {loading ? (
              <p className="mt-1 text-[0.9375rem] text-slate-500">확인 중…</p>
            ) : link ? (
              <div className="mt-1 text-[0.9375rem] text-slate-600">
                <p data-testid="portal-usage" data-state={growth.off ? 'off' : usage.state}>
                  <span className={`font-semibold ${link.status === 'active' ? 'text-success-700' : 'text-danger-700'}`}>{link.status === 'active' ? '연결됨' : link.status === 'paused' ? '잠시 멈춤' : '연결 끊음'}</span> · {emailOf(link) || '(계정)'} · 연결일 {localDateOf(link.linkedAt)}
                  {!growth.off && link.status === 'active' && (
                    <span className="ml-1 text-slate-700">
                      · {PORTAL_USAGE_LABEL[usage.state]}
                      {usage.lastVisit ? ` · 최근 방문 ${usage.lastVisit.slice(5).replace('-', '/')}` : ''}
                      {usage.state === 'linked_unvisited' ? ` · ${daysBetween(localDateOf(link.linkedAt), today)}일째` : ''}
                    </span>
                  )}
                  {isLocal && <span className="ml-2 rounded-full bg-highlight-100 px-2 py-0.5 t-meta font-semibold text-highlight-700">연습용</span>}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <label className="text-[0.875rem] text-slate-500">
                    고객에게 보이는 단계
                    <select
                      value={link.customerStage}
                      onChange={(e) => void run(() => updateLink(link, { customerStage: e.target.value as CustomerStage }), '고객 단계를 바꿨습니다.')}
                      className="ml-2 rounded-(--radius-control) border border-slate-300 px-2 py-1.5 text-[0.875rem] text-slate-800"
                    >
                      {CUSTOMER_STAGE_ORDER.map((s) => (
                        <option key={s} value={s}>{CUSTOMER_STAGE_LABEL[s]}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-[0.875rem] text-slate-500">
                    프로젝트명
                    <input
                      defaultValue={link.displayName}
                      placeholder={record.companyName}
                      onBlur={(e) => { if (e.target.value !== link.displayName) void run(() => updateLink(link, { displayName: e.target.value }), '저장했습니다.') }}
                      className="ml-2 w-44 rounded-(--radius-control) border border-slate-300 px-2 py-1.5 text-[0.875rem] text-slate-800"
                    />
                  </label>
                </div>
                {/* D-681 계정마다 한 줄 — 열어 두기 · 잠시 멈춤 · 끊기. 서버가 그 순간부터 막는다(0006 portal_link_owned 는 active 만) */}
                <ul className="mt-2 flex flex-col gap-1.5" data-testid="portal-accounts">
                  {links.map((l) => {
                    const seen = homeSeen.get(l.id)
                    return (
                      <li key={l.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-(--radius-control) border border-slate-200 px-3 py-2" data-testid="portal-account" data-status={l.status} data-email={emailOf(l)}>
                        <span className="t-sub min-w-0 flex-1 break-all text-slate-800">
                          {emailOf(l) || '고객 계정'}
                          <span className={`ml-1.5 font-semibold ${l.status === 'active' ? 'text-success-700' : 'text-danger-700'}`}>{l.status === 'active' ? '연결됨' : l.status === 'paused' ? '잠시 멈춤' : '연결 끊음'}</span>
                          {!growth.off && !isLocal && l.status === 'active' && (
                            <span className="ml-1.5 text-slate-500">{seen ? `최근 방문 ${localDateOf(seen.last).slice(5).replace('-', '/')}` : '아직 안 오심'}</span>
                          )}
                        </span>
                        {!readOnly && !pilot && (
                          revoking === l.id ? (
                            <span className="flex flex-wrap items-center gap-2" data-testid="portal-revoke-confirm">
                              <span className="t-sub text-danger-700">이 계정은 고객 화면을 더는 못 봐요. 끊을까요?</span>
                              <Button size="sm" variant="danger" disabled={running} onClick={() => void run(() => updateLink(l, { status: 'revoked' }), '연결을 끊었어요. 기록은 남아 있어요.').then(() => setRevoking(''))} data-testid="portal-revoke-go">끊기</Button>
                              <Button size="sm" variant="ghost" onClick={() => setRevoking('')}>취소</Button>
                            </span>
                          ) : l.status === 'active' ? (
                            <span className="flex flex-wrap gap-1.5">
                              <Button size="sm" variant="ghost" disabled={running} onClick={() => void run(() => updateLink(l, { status: 'paused' }), '잠시 멈췄어요. 이 계정은 다시 켤 때까지 못 봐요.')} data-testid="portal-pause">
                                <Pause aria-hidden="true" className="size-4" /> 잠시 멈춤
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setRevoking(l.id)} data-testid="portal-revoke">
                                <Unlink aria-hidden="true" className="size-4" /> 연결 끊기
                              </Button>
                            </span>
                          ) : (
                            <Button size="sm" variant="secondary" disabled={running} onClick={() => void run(() => updateLink(l, { status: 'active' }), '다시 열었어요. 이 계정이 다시 볼 수 있어요.')} data-testid="portal-resume">
                              <Play aria-hidden="true" className="size-4" /> 다시 켜기
                            </Button>
                          )
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            ) : (
              <div className="mt-1 flex flex-col gap-1.5">
                <p className="text-[0.9375rem] break-keep text-slate-600">
                  이 고객은 아직 {brand.customerPlatformUrl.replace('https://', '')} 계정과 연결되지 않았습니다. 고객이 가입한 이메일을 넣고 연결하면 고객 화면(My MIRAE)이 열립니다.
                </p>
                {/* D-681 가입 안내 — 문구 복사 → [보냈어요] 로 날짜를 남긴다(이메일이 같다고 저절로 잇지 않는다 — 연결은 담당자가) */}
                <p className="t-sub flex flex-wrap items-center gap-2" data-testid="portal-invite" data-state={record.portalInvite?.at ? 'sent' : 'none'}>
                  {record.portalInvite?.at && <span className="text-slate-700">가입 안내 보냄 {record.portalInvite.at.slice(5).replace('-', '/')} · {daysBetween(record.portalInvite.at, today)}일째</span>}
                  {!readOnly && (
                    <Button size="sm" variant="secondary" onClick={() => setInviteOpen(true)} data-testid="portal-invite-open">
                      <ClipboardCopy aria-hidden="true" className="size-4" /> 가입 안내 문구
                    </Button>
                  )}
                </p>
              </div>
            )}
          </div>
          {link ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => void openPreview()}>
                <Eye aria-hidden="true" className="size-4" /> 고객 화면 보기
              </Button>
              <Button variant="primary" onClick={() => setPublishOpen(true)}>
                <Send aria-hidden="true" className="size-4" /> 고객에게 업데이트
              </Button>
            </div>
          ) : (
            <div className="flex w-full flex-wrap items-end gap-2 sm:w-auto">
              <label className="min-w-0 flex-1 text-[0.875rem] text-slate-500 sm:w-64">
                고객 계정 이메일
                <input
                  value={linkEmail}
                  onChange={(e) => setLinkEmail(e.target.value)}
                  placeholder="customer@example.com"
                  className="mt-1 w-full rounded-(--radius-control) border border-slate-300 px-3 py-2 text-[0.9375rem] text-slate-800 focus:border-brand-500 focus:outline-none"
                />
              </label>
              <Button variant="primary" onClick={() => void connect()} disabled={linkBusy}>
                <Link2 aria-hidden="true" className="size-4" /> {linkBusy ? '연결 중…' : '연결'}
              </Button>
            </div>
          )}
        </div>
        {link && (
          <p className="mt-3 text-[0.875rem] text-slate-400">
            고객은 로그인 후{' '}
            <a href={`${brand.customerPlatformUrl}${brand.customerProjectsPath}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-brand-700 hover:underline">
              {brand.customerPlatformUrl.replace('https://', '')}{brand.customerProjectsPath} <ExternalLink aria-hidden="true" className="size-3" />
            </a>
            에서 봅니다. 여기 "고객 화면 보기"는 고객이 보는 것과 같은 내용을 내 계정으로 읽은 것입니다. 고객 로그인을 대신하지는 않습니다.
          </p>
        )}
        {/* D-681 챙길 것 — 보고서 안 열어 봄 · 보고 공백 · 첫 방문 없음 · 가입 안내 뒤 연결 없음(내부에만 · 저절로 보내지 않음) */}
        {followUps.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1 border-t border-slate-100 pt-3" data-testid="portal-followups">
            {followUps.map((f) => (
              <li key={f.key} className="t-sub break-keep text-danger-700" data-testid="portal-followup" data-rule={f.rule}>· {f.text}</li>
            ))}
          </ul>
        )}
      </section>

      {/* D-681 고객에게 보낸 보고서 — 연결 전에도 발행해 둘 수 있다(연결되면 그때부터 보임) */}
      {!growth.off && !loading && (
        <PortalReportsCard
          record={record}
          links={links.map((l) => ({ ...l, profileEmail: emailOf(l) }))}
          reports={growth.reports}
          receipts={growth.receipts}
          readOnly={readOnly}
          onCreate={() => setReportSheet({ correcting: null })}
          onCorrect={(r) => setReportSheet({ correcting: r })}
          onChanged={() => void load()}
        />
      )}

      {link && (
        <>
          {/* 공유 서류 */}
          <section className="rounded-(--radius-panel) border border-slate-200 bg-white p-4 shadow-(--shadow-card)">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <HelpHeading as="h3" tight label="고객과 주고받는 서류" className="text-[1rem] font-bold text-slate-900">고객과 주고받는 서류 <span className="text-slate-400">{documents.length}</span></HelpHeading>
              <Button variant="secondary" onClick={() => setDocForm((f) => ({ ...f, open: true }))}>
                <Plus aria-hidden="true" className="size-4" /> 서류 요청
              </Button>
            </div>
            {documents.length === 0 ? (
              <p className="mt-2 text-[0.9375rem] text-slate-500">요청하거나 공유한 서류가 없습니다. "서류 요청"을 누르면 고객 화면의 "해야 할 일"에 나타납니다.</p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100">
                {documents.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center gap-2 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.9375rem] font-semibold text-slate-800">{d.title}</span>
                      <span className="block text-[0.875rem] text-slate-500">
                        {DOCUMENT_STATUS_LABEL[d.status]}
                        {d.visibility === 'shared_with_customer' && ' · 고객에게 공유됨'}
                        {d.fileName && ` · ${d.fileName}`}
                        {d.uploadedAt && ` · ${activityTimeText(d.uploadedAt)}`}
                        {d.customerNote && ` · 안내: ${d.customerNote}`}
                      </span>
                    </span>
                    {d.status === 'uploaded' && (
                      <>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            let filed = ''
                            void run(async () => {
                              await reviewDocument(d, 'verified')
                              // D-122: 내부 서류함도 '받음' — 예전에는 고객 화면만 바뀌어 '없는 서류' 경고 · 서류 요청 문구가 계속 이 서류를 달라고 했다
                              // D-148: 칸에 이미 파일이 있으면 덮지 않는다('(2)' 칸) · 종류가 '기타' 여도 제목 · 파일 이름으로 칸을 찾아 넣는다
                              if (!onRecordChange) return
                              const fresh = latest?.() ?? record
                              if (d.storagePath && !d.storagePath.startsWith('demo/')) {
                                const out = filePortalDocument(fresh, d, '')
                                if (out && (await onRecordChange(out.record))) filed = out.label
                              } else if (d.documentType in fresh.documents && !fresh.documents[d.documentType as DocumentKey].received) {
                                if (await onRecordChange(withDocument(fresh, d.documentType as DocumentKey, { received: true, ...(d.fileName ? { fileName: d.fileName } : {}) }))) filed = DOCUMENTS.find((x) => x.key === d.documentType)?.label ?? ''
                              }
                            }).then((ok) => {
                              if (ok) showToast(filed ? `확인 완료 · 서류함 '${filed}' 칸에도 넣었습니다.` : '확인 완료로 표시했습니다.')
                            })
                          }}
                        >
                          <CheckCircle2 aria-hidden="true" className="size-4" /> 확인 완료
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => void run(() => reviewDocument(d, 'rejected'), '고객에게 다시 요청했습니다.')}>
                          다시 요청
                        </Button>
                      </>
                    )}
                    {isLocal && d.status === 'requested' && (
                      <Button variant="secondary" size="sm" onClick={() => void run(async () => seedDemoUpload(d), '고객 업로드를 흉내 냈습니다 (연습용).')}>
                        <Upload aria-hidden="true" className="size-4" /> 고객 업로드 흉내 (연습용)
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {/* 내부 파일 공유 — D-212: 제목은 그 칸의 이름(직접 만든 칸 · (2) 칸도). 예전에는 'customdoc_…' 가 고객 화면 제목이 됐다 */}
            {Object.entries(record.documents).some(([, v]) => v.storagePath) && (
              <div className="mt-3 rounded-(--radius-control) bg-slate-50 p-3">
                <p className="text-[0.875rem] font-semibold text-slate-600">내 서류함 파일을 고객에게 공유</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {(Object.entries(record.documents) as [DocumentKey, ClientOpsRecord['documents'][DocumentKey]][])
                    // D-212: 지운 칸에 남은 파일은 내놓지 않는다
                    .filter(([key, v]) => v.storagePath && !documents.some((d) => d.storagePath === v.storagePath) && documentMetaOf(record, key).label !== DELETED_DOC_LABEL)
                    .map(([key, v]) => (
                      // D-122: 누르면 바로 고객 화면에 올라가던 것을 한 번 묻는다
                      <InlineConfirm
                        key={key}
                        icon={<Share2 aria-hidden="true" className="size-4" />}
                        label={`${documentMetaOf(record, key).label} 공유`}
                        question="고객 화면에 보입니다. 공유할까요?"
                        confirmLabel="공유"
                        className="!text-slate-700 hover:!bg-brand-50 hover:!text-brand-700"
                        onConfirm={() =>
                          void run(
                            () => shareDocument(workspaceId, { linkId: link.id, operationsClientId: record.id, documentType: key, title: documentMetaOf(record, key).label, storagePath: v.storagePath, fileName: v.fileName }),
                            '고객에게 공유했습니다.',
                          )
                        }
                      />
                    ))}
                </div>
              </div>
            )}
          </section>

          {/* 고객 요청 */}
          <section className="rounded-(--radius-panel) border border-slate-200 bg-white p-4 shadow-(--shadow-card)">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <HelpHeading as="h3" tight label="고객이 보낸 요청" className="text-[1rem] font-bold text-slate-900">고객이 보낸 요청 <span className="text-slate-400">{openRequests.length} 열림</span></HelpHeading>
              {isLocal && (
                <Button variant="secondary" size="sm" onClick={() => void run(async () => seedDemoRequest(link.id, workspaceId), '샘플 요청을 만들었습니다 (연습용).')}>
                  <Sparkles aria-hidden="true" className="size-4" /> 샘플 요청 (연습용)
                </Button>
              )}
            </div>
            {requests.length === 0 ? (
              <p className="mt-2 text-[0.9375rem] text-slate-500">아직 요청이 없습니다.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-3">
                {requests.map((r) => (
                  <li key={r.id} className="rounded-(--radius-card) border border-slate-200 p-3">
                    <div className="flex flex-wrap items-center gap-2 text-[0.875rem]">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">{REQUEST_TYPE_LABEL[r.requestType]}</span>
                      <span className="text-slate-500">{REQUEST_STATUS_LABEL[r.status]}</span>
                      <span className="text-slate-400">{activityTimeText(r.createdAt)}</span>
                    </div>
                    <p className="mt-1 text-[1rem] font-semibold text-slate-900">{r.title}</p>
                    {r.body && <p className="text-[0.9375rem] break-keep whitespace-pre-wrap text-slate-600">{r.body}</p>}
                    {r.answer && (
                      <p className="mt-2 rounded-(--radius-control) bg-success-50 px-3 py-2 text-[0.9375rem] text-success-700">
                        <MessageSquareReply aria-hidden="true" className="mr-1 inline size-4" /> 답변: {r.answer}
                      </p>
                    )}
                    {(r.status === 'open' || r.status === 'answered') && (
                      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                        <input
                          value={answerDraft[r.id] ?? r.answer}
                          onChange={(e) => setAnswerDraft((d) => ({ ...d, [r.id]: e.target.value }))}
                          placeholder="고객에게 보일 답변"
                          aria-label="답변"
                          className="min-w-0 flex-1 rounded-(--radius-control) border border-slate-300 px-3 py-2 text-[0.9375rem] focus:border-brand-500 focus:outline-none"
                        />
                        <Button variant="primary" size="sm" onClick={() => void run(() => answerRequest(r, answerDraft[r.id] ?? r.answer, 'answered'), '답변을 보냈습니다.')}>
                          답변
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => void run(() => answerRequest(r, answerDraft[r.id] ?? r.answer, 'resolved'), '해결로 표시했습니다.')}>
                          해결
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 공개한 업데이트 */}
          <section className="rounded-(--radius-panel) border border-slate-200 bg-white p-4 shadow-(--shadow-card)">
            <HelpHeading as="h3" tight label="고객에게 공개한 업데이트" className="text-[1rem] font-bold text-slate-900">고객에게 공개한 업데이트 <span className="text-slate-400">{published.length}</span></HelpHeading>
            {published.length === 0 ? (
              <p className="mt-2 text-[0.9375rem] text-slate-500">아직 공개한 업데이트가 없습니다. 내부 상태는 자동으로 나가지 않으니, "고객에게 업데이트"로 알려 주세요.</p>
            ) : (
              <ol className="mt-3 flex flex-col gap-2">
                {published.map((u) => (
                  <li key={u.id} className="rounded-(--radius-card) border border-slate-200 p-3">
                    <div className="flex flex-wrap items-center gap-2 text-[0.875rem]">
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 font-semibold text-brand-700">{UPDATE_CATEGORY_LABEL[u.category]}</span>
                      <span className="text-slate-400">{u.publishedAt ? activityTimeText(u.publishedAt) : ''}</span>
                      {u.customerActionRequired && (
                        <span className={`rounded-full px-2 py-0.5 font-semibold ${u.customerCompletedAt ? 'bg-success-50 text-success-700' : 'bg-warning-50 text-warning-700'}`}>
                          {u.customerCompletedAt ? '고객 조치 완료' : `고객 조치 대기${u.dueDate ? ` · ${u.dueDate}까지` : ''}`}
                        </span>
                      )}
                      <InlineConfirm
                        className="ml-auto"
                        icon={null}
                        label="내리기"
                        question="고객 화면에서 내릴까요?"
                        confirmLabel="내리기"
                        onConfirm={() => void run(() => archiveUpdate(u), '고객 화면에서 내렸습니다.')}
                      />
                    </div>
                    <p className="mt-1 text-[1rem] font-semibold text-slate-900">{u.title}</p>
                    {u.body && <p className="text-[0.9375rem] break-keep whitespace-pre-wrap text-slate-600">{u.body}</p>}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      )}

      {/* 고객 이벤트 */}
      <section className="rounded-(--radius-panel) border border-slate-200 bg-white p-4 shadow-(--shadow-card)">
        <div className="flex items-center justify-between gap-2">
          <HelpHeading as="h3" tight label="이 고객의 상담신청 · 요청" className="text-[1rem] font-bold text-slate-900">이 고객의 상담신청 · 요청 <span className="text-slate-400">{events.length}</span></HelpHeading>
          <Link to="/ops/inbox" className="text-[0.875rem] font-medium text-brand-700 hover:underline">상담신청함</Link>
        </div>
        {events.length === 0 ? (
          <p className="mt-2 text-[0.9375rem] text-slate-500">아직 이 고객과 연결된 이벤트가 없습니다.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {events.slice(0, 6).map((e) => (
              <li key={e.id}>
                <EventCard
                  event={e}
                  compact
                  clientName={record.companyName}
                  onLink={() => undefined}
                  onCreateClient={() => undefined}
                  onStatus={(status) => void run(() => updateEvent(e, { status }))}
                />
              </li>
            ))}
          </ul>
        )}
        {events.length > 0 && (
          <p className="mt-2 text-[0.875rem] text-slate-400">
            최근: {events.slice(0, 3).map((e) => `${EVENT_TYPE_LABEL[e.eventType]} — ${eventSummary(e).what}`).join(' · ')}
          </p>
        )}
      </section>

      {publishOpen && link && (
        <PublishUpdateModal
          link={link}
          record={record}
          workspaceId={workspaceId}
          onClose={() => setPublishOpen(false)}
          onPublished={() => { setPublishOpen(false); void load(); showToast('고객에게 공개했습니다.') }}
        />
      )}

      {/* 서류 요청 */}
      <Modal
        open={docForm.open}
        title="고객에게 서류 요청"
        onClose={() => setDocForm((f) => ({ ...f, open: false }))}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDocForm((f) => ({ ...f, open: false }))}>취소</Button>
            <Button
              variant="primary"
              disabled={running}
              onClick={() =>
                link &&
                void run(
                  () => requestDocument(workspaceId, { linkId: link.id, operationsClientId: record.id, documentType: docForm.key, title: docForm.title, customerNote: docForm.note }),
                  '고객 화면에 서류 요청을 올렸습니다.',
                ).then((ok) => {
                  // 실패하면 창을 닫지 않는다 — 적은 내용 그대로 다시 누를 수 있게
                  if (ok) setDocForm((f) => ({ ...f, open: false }))
                })
              }
            >
              {running ? '요청 중…' : '요청'}
            </Button>
          </>
        }
      >
        <label className="block text-[0.875rem] font-medium text-slate-600">
          서류 종류
          <select
            value={docForm.key}
            onChange={(e) => {
              const key = e.target.value
              const meta = docOptions.find((d) => d.key === key)
              setDocForm((f) => ({ ...f, key, title: meta?.label ?? f.title }))
            }}
            className="mt-1 w-full rounded-(--radius-control) border border-slate-300 px-3 py-2 text-[1rem]"
          >
            {docOptions.map((d) => (
              <option key={d.key} value={d.key}>{d.label}</option>
            ))}
            <option value="other">기타</option>
          </select>
        </label>
        <label className="mt-3 block text-[0.875rem] font-medium text-slate-600">
          고객에게 보일 이름
          <input value={docForm.title} onChange={(e) => setDocForm((f) => ({ ...f, title: e.target.value }))} className="mt-1 w-full rounded-(--radius-control) border border-slate-300 px-3 py-2 text-[1rem]" />
        </label>
        <label className="mt-3 block text-[0.875rem] font-medium text-slate-600">
          안내 (선택)
          <input value={docForm.note} onChange={(e) => setDocForm((f) => ({ ...f, note: e.target.value }))} placeholder="예: 최근 3개월 이내 발급분" className="mt-1 w-full rounded-(--radius-control) border border-slate-300 px-3 py-2 text-[1rem]" />
        </label>
      </Modal>

      {reportSheet && (
        <PortalReportSheet
          record={latest?.() ?? record}
          workspaceId={workspaceId}
          today={today}
          docs={documents.map((d) => ({ id: d.id, title: d.title, status: d.status, verifiedAt: d.verifiedAt }))}
          updates={updates.map((u) => ({ id: u.id, title: u.title, status: u.status, actionRequired: u.customerActionRequired, actionLabel: u.customerActionLabel, completedAt: u.customerCompletedAt }))}
          reports={growth.reports}
          correcting={reportSheet.correcting}
          linked={links.some((l) => l.status === 'active')}
          seenReportIds={new Set(growth.receipts.filter((r) => r.itemKind === 'report').map((r) => r.itemId))}
          onClose={() => setReportSheet(null)}
          onPublished={() => void load()}
        />
      )}

      <Modal
        open={inviteOpen}
        title="고객 화면 가입 안내"
        onClose={() => setInviteOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => void copyText(inviteText).then((ok) => showToast(ok ? '문구를 복사했어요.' : '복사하지 못했어요 — 글을 직접 골라 복사해 주세요.'))} data-testid="portal-invite-copy">
              <ClipboardCopy aria-hidden="true" className="size-4" /> 문구 복사
            </Button>
            {onRecordChange && <Button variant="primary" onClick={() => void markInvited()} data-testid="portal-invite-sent">보냈어요</Button>}
          </>
        }
      >
        <p className="t-sub mb-2 break-keep text-slate-600">카톡 · 문자로 보내 주세요(자동으로 보내지 않아요). 고객이 가입하면 그 이메일로 위에서 [연결] 을 눌러 주세요.</p>
        <textarea readOnly value={inviteText} rows={9} className="t-sub w-full rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2 text-slate-800" data-testid="portal-invite-text" />
      </Modal>

      {/* 고객 화면 미리보기 */}
      <Modal open={preview !== null} title="고객 화면 미리보기 (고객이 보는 것과 동일)" size="lg" onClose={() => setPreview(null)}>
        {preview?.project && (
          <div className="rounded-(--radius-panel) border border-slate-200 bg-slate-50 p-4">
            <p className="text-[0.875rem] font-semibold tracking-wide text-slate-400 uppercase">{brand.customerPortalLabel} · 내 프로젝트</p>
            <h3 className="mt-1 text-[1.2rem] font-bold text-slate-900">{preview.project.name}</h3>
            <p className="text-[0.875rem] text-slate-500">
              {CUSTOMER_STAGE_LABEL[preview.project.stage]}{preview.project.consultant_name ? ` · 담당 ${preview.project.consultant_name}` : ''}
            </p>
            <ol className="mt-3 flex flex-wrap gap-1">
              {CUSTOMER_STAGE_ORDER.map((s, i) => {
                const idx = CUSTOMER_STAGE_ORDER.indexOf(preview.project!.stage)
                return (
                  <li key={s} className={`rounded-full px-2 py-0.5 t-meta font-semibold ${i <= idx ? 'bg-brand-600 text-white' : 'bg-white text-slate-400'}`}>
                    {CUSTOMER_STAGE_LABEL[s]}
                  </li>
                )
              })}
            </ol>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-[0.875rem] font-semibold text-slate-700">해야 할 일</p>
                <ul className="mt-1 text-[0.875rem] text-slate-700">
                  {preview.updates.filter((u) => u.action_required && !u.completed_at).map((u) => <li key={u.id}>· {u.action_label ?? u.title}</li>)}
                  {preview.documents.filter((d) => d.status === 'requested' || d.status === 'rejected').map((d) => <li key={d.id}>· {d.title} 올리기</li>)}
                  {preview.updates.filter((u) => u.action_required && !u.completed_at).length + preview.documents.filter((d) => d.status === 'requested' || d.status === 'rejected').length === 0 && <li className="text-slate-400">없음</li>}
                </ul>
              </div>
              <div>
                <p className="text-[0.875rem] font-semibold text-slate-700">진행 업데이트</p>
                <ul className="mt-1 text-[0.875rem] text-slate-700">
                  {preview.updates.slice(0, 4).map((u) => <li key={u.id}>· [{UPDATE_CATEGORY_LABEL[u.category]}] {u.title}</li>)}
                  {preview.updates.length === 0 && <li className="text-slate-400">없음</li>}
                </ul>
              </div>
              <div>
                <p className="text-[0.875rem] font-semibold text-slate-700">서류</p>
                <ul className="mt-1 text-[0.875rem] text-slate-700">
                  {preview.documents.map((d) => <li key={d.id}>· {d.title} — {DOCUMENT_STATUS_LABEL[d.status]}</li>)}
                  {preview.documents.length === 0 && <li className="text-slate-400">없음</li>}
                </ul>
              </div>
              <div>
                <p className="text-[0.875rem] font-semibold text-slate-700">내가 보낸 요청</p>
                <ul className="mt-1 text-[0.875rem] text-slate-700">
                  {preview.requests.slice(0, 4).map((r) => <li key={r.id}>· {r.title} — {REQUEST_STATUS_LABEL[r.status]}</li>)}
                  {preview.requests.length === 0 && <li className="text-slate-400">없음</li>}
                </ul>
              </div>
            </div>
            <p className="mt-3 text-[0.875rem] text-slate-400">내부 메모·수임료·업무 세부 단계·활동 기록은 포함되지 않습니다.</p>
          </div>
        )}
      </Modal>
    </div>
  )
}
