import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, ExternalLink, Eye, Link2, MessageSquareReply, Plus, Send, Sparkles, Upload } from 'lucide-react'
import type { ClientOpsRecord, DocumentKey } from '../../types/clientOps'
import type { CustomerEvent, PortalClientLink, PortalDocument, PortalProjection, PortalRequest, PortalUpdate } from '../../types/bridge'
import { Button } from '../ui/Button'
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
import { getDataModeConfig } from '../../data/dataMode'
import { brand } from '../../brand/brand.config'

function isNotReadyError(cause: unknown): boolean {
  const o = cause as { message?: unknown; code?: unknown; details?: unknown } | null
  const msg = [o?.message, o?.code, o?.details].filter((v) => typeof v === 'string').join(' ') || String(cause)
  return /relation .* does not exist|portal_|42P01|schema cache|PGRST/i.test(msg)
}

/**
 * 업체 상세 > 고객 플랫폼 탭.
 * 연결 계정 · 고객 이벤트 · 고객 요청(답변) · 공유 서류(요청/확인/공유) · 공개한 업데이트 · 고객 화면 미리보기.
 * 고객 인증을 우회하지 않는다 — 미리보기는 고객 투영과 같은 함수를 워크스페이스 권한으로 부른 결과다.
 */
export function PortalTab({ record, workspaceId }: { record: ClientOpsRecord; workspaceId: string | null }) {
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

  const link = links.find((l) => l.status === 'active') ?? links[0] ?? null

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

  const run = async (fn: () => Promise<unknown>, done?: string) => {
    try {
      await fn()
      await load()
      if (done) showToast(done)
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : '저장하지 못했습니다.')
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

  const docOptions = useMemo(() => DOCUMENTS.filter((d) => d.needsFile), [])
  const openRequests = requests.filter((r) => r.status === 'open' || r.status === 'answered')
  const published = updates.filter((u) => u.status === 'published')

  if (notReady) {
    return (
      <div className="rounded-(--radius-panel) border border-warning-200 bg-warning-50 p-4">
        <p className="text-[0.98rem] font-semibold text-warning-700">고객 플랫폼 연결 준비 중 (READY)</p>
        <p className="mt-1 text-[0.92rem] break-keep text-slate-700">
          클라우드에 브릿지 테이블이 아직 없습니다. <code className="rounded bg-white px-1">docs/SETUP.md</code> 의 순서대로 마이그레이션을 적용하면 이 탭이 켜집니다.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {/* 연결 상태 */}
      <section className="rounded-(--radius-panel) border border-slate-200 bg-white p-4 shadow-(--shadow-card)">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-[1.05rem] font-bold text-slate-900">
              <Link2 aria-hidden="true" className="size-4 text-slate-400" /> {brand.customerPlatformLabel} 연결
            </h3>
            {loading ? (
              <p className="mt-1 text-[0.92rem] text-slate-500">확인 중…</p>
            ) : link ? (
              <div className="mt-1 text-[0.92rem] text-slate-600">
                <p>
                  <span className="font-semibold text-success-700">연결됨</span> · {link.profileEmail || '(계정)'} · 연결일 {link.linkedAt.slice(0, 10)}
                  {isLocal && <span className="ml-2 rounded-full bg-highlight-100 px-2 py-0.5 text-[0.78rem] font-semibold text-highlight-700">DEMO</span>}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <label className="text-[0.88rem] text-slate-500">
                    고객에게 보이는 단계
                    <select
                      value={link.customerStage}
                      onChange={(e) => void run(() => updateLink(link, { customerStage: e.target.value as CustomerStage }), '고객 단계를 바꿨습니다.')}
                      className="ml-2 rounded-(--radius-control) border border-slate-300 px-2 py-1.5 text-[0.9rem] text-slate-800"
                    >
                      {CUSTOMER_STAGE_ORDER.map((s) => (
                        <option key={s} value={s}>{CUSTOMER_STAGE_LABEL[s]}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-[0.88rem] text-slate-500">
                    프로젝트명
                    <input
                      defaultValue={link.displayName}
                      placeholder={record.companyName}
                      onBlur={(e) => { if (e.target.value !== link.displayName) void run(() => updateLink(link, { displayName: e.target.value }), '저장했습니다.') }}
                      className="ml-2 w-44 rounded-(--radius-control) border border-slate-300 px-2 py-1.5 text-[0.9rem] text-slate-800"
                    />
                  </label>
                </div>
              </div>
            ) : (
              <p className="mt-1 text-[0.92rem] break-keep text-slate-600">
                이 고객은 아직 {brand.customerPlatformUrl.replace('https://', '')} 계정과 연결되지 않았습니다. 고객이 가입한 이메일을 넣고 연결하면 고객 화면(My MIRAE)이 열립니다.
              </p>
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
              <label className="min-w-0 flex-1 text-[0.85rem] text-slate-500 sm:w-64">
                고객 계정 이메일
                <input
                  value={linkEmail}
                  onChange={(e) => setLinkEmail(e.target.value)}
                  placeholder="customer@example.com"
                  className="mt-1 w-full rounded-(--radius-control) border border-slate-300 px-3 py-2 text-[0.95rem] text-slate-800 focus:border-brand-500 focus:outline-none"
                />
              </label>
              <Button variant="primary" onClick={() => void connect()} disabled={linkBusy}>
                <Link2 aria-hidden="true" className="size-4" /> {linkBusy ? '연결 중…' : '연결'}
              </Button>
            </div>
          )}
        </div>
        {link && (
          <p className="mt-3 text-[0.82rem] text-slate-400">
            고객은 로그인 후{' '}
            <a href={`${brand.customerPlatformUrl}${brand.customerProjectsPath}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-brand-700 hover:underline">
              {brand.customerPlatformUrl.replace('https://', '')}{brand.customerProjectsPath} <ExternalLink aria-hidden="true" className="size-3" />
            </a>
            에서 봅니다. 여기 "고객 화면 보기"는 고객과 같은 투영을 내 권한으로 읽은 것이며 고객 로그인을 대신하지 않습니다.
          </p>
        )}
      </section>

      {link && (
        <>
          {/* 공유 서류 */}
          <section className="rounded-(--radius-panel) border border-slate-200 bg-white p-4 shadow-(--shadow-card)">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-[1.05rem] font-bold text-slate-900">고객과 주고받는 서류 <span className="text-slate-400">{documents.length}</span></h3>
              <Button variant="secondary" onClick={() => setDocForm((f) => ({ ...f, open: true }))}>
                <Plus aria-hidden="true" className="size-4" /> 서류 요청
              </Button>
            </div>
            {documents.length === 0 ? (
              <p className="mt-2 text-[0.92rem] text-slate-500">요청하거나 공유한 서류가 없습니다. "서류 요청"을 누르면 고객 화면의 "해야 할 일"에 나타납니다.</p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100">
                {documents.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center gap-2 py-2.5">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.95rem] font-semibold text-slate-800">{d.title}</span>
                      <span className="block text-[0.85rem] text-slate-500">
                        {DOCUMENT_STATUS_LABEL[d.status]}
                        {d.visibility === 'shared_with_customer' && ' · 고객에게 공유됨'}
                        {d.fileName && ` · ${d.fileName}`}
                        {d.uploadedAt && ` · ${activityTimeText(d.uploadedAt)}`}
                        {d.customerNote && ` · 안내: ${d.customerNote}`}
                      </span>
                    </span>
                    {d.status === 'uploaded' && (
                      <>
                        <Button variant="primary" size="sm" onClick={() => void run(() => reviewDocument(d, 'verified'), '확인 완료로 표시했습니다.')}>
                          <CheckCircle2 aria-hidden="true" className="size-4" /> 확인 완료
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => void run(() => reviewDocument(d, 'rejected'), '고객에게 다시 요청했습니다.')}>
                          다시 요청
                        </Button>
                      </>
                    )}
                    {isLocal && d.status === 'requested' && (
                      <Button variant="secondary" size="sm" onClick={() => void run(async () => seedDemoUpload(d), '고객 업로드를 흉내 냈습니다 (DEMO).')}>
                        <Upload aria-hidden="true" className="size-4" /> 고객 업로드 흉내 (DEMO)
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {/* 내부 파일 공유 */}
            {Object.entries(record.documents).some(([, v]) => v.storagePath) && (
              <div className="mt-3 rounded-(--radius-control) bg-slate-50 p-3">
                <p className="text-[0.88rem] font-semibold text-slate-600">내 서류함 파일을 고객에게 공유</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {(Object.entries(record.documents) as [DocumentKey, ClientOpsRecord['documents'][DocumentKey]][])
                    .filter(([, v]) => v.storagePath && !documents.some((d) => d.storagePath === v.storagePath))
                    .map(([key, v]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() =>
                          void run(
                            () => shareDocument(workspaceId, { linkId: link.id, operationsClientId: record.id, documentType: key, title: DOCUMENTS.find((x) => x.key === key)?.label ?? key, storagePath: v.storagePath, fileName: v.fileName }),
                            '고객에게 공유했습니다.',
                          )
                        }
                        className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[0.85rem] text-slate-700 hover:border-brand-300 hover:text-brand-700"
                      >
                        {DOCUMENTS.find((x) => x.key === key)?.label ?? key} 공유
                      </button>
                    ))}
                </div>
              </div>
            )}
          </section>

          {/* 고객 요청 */}
          <section className="rounded-(--radius-panel) border border-slate-200 bg-white p-4 shadow-(--shadow-card)">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-[1.05rem] font-bold text-slate-900">고객이 보낸 요청 <span className="text-slate-400">{openRequests.length} 열림</span></h3>
              {isLocal && (
                <Button variant="secondary" size="sm" onClick={() => void run(async () => seedDemoRequest(link.id, workspaceId), '샘플 요청을 만들었습니다 (DEMO).')}>
                  <Sparkles aria-hidden="true" className="size-4" /> 샘플 요청 (DEMO)
                </Button>
              )}
            </div>
            {requests.length === 0 ? (
              <p className="mt-2 text-[0.92rem] text-slate-500">아직 요청이 없습니다.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-3">
                {requests.map((r) => (
                  <li key={r.id} className="rounded-(--radius-card) border border-slate-200 p-3">
                    <div className="flex flex-wrap items-center gap-2 text-[0.85rem]">
                      <span className="rounded-full bg-cat-fund-50 px-2 py-0.5 font-semibold text-cat-fund-700">{REQUEST_TYPE_LABEL[r.requestType]}</span>
                      <span className="text-slate-500">{REQUEST_STATUS_LABEL[r.status]}</span>
                      <span className="text-slate-400">{activityTimeText(r.createdAt)}</span>
                    </div>
                    <p className="mt-1 text-[0.98rem] font-semibold text-slate-900">{r.title}</p>
                    {r.body && <p className="text-[0.92rem] break-keep whitespace-pre-wrap text-slate-600">{r.body}</p>}
                    {r.answer && (
                      <p className="mt-2 rounded-(--radius-control) bg-success-50 px-3 py-2 text-[0.92rem] text-success-700">
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
                          className="min-w-0 flex-1 rounded-(--radius-control) border border-slate-300 px-3 py-2 text-[0.95rem] focus:border-brand-500 focus:outline-none"
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
            <h3 className="text-[1.05rem] font-bold text-slate-900">고객에게 공개한 업데이트 <span className="text-slate-400">{published.length}</span></h3>
            {published.length === 0 ? (
              <p className="mt-2 text-[0.92rem] text-slate-500">아직 공개한 업데이트가 없습니다. 내부 상태는 자동으로 나가지 않으니, "고객에게 업데이트"로 알려 주세요.</p>
            ) : (
              <ol className="mt-3 flex flex-col gap-2">
                {published.map((u) => (
                  <li key={u.id} className="rounded-(--radius-card) border border-slate-200 p-3">
                    <div className="flex flex-wrap items-center gap-2 text-[0.85rem]">
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 font-semibold text-brand-700">{UPDATE_CATEGORY_LABEL[u.category]}</span>
                      <span className="text-slate-400">{u.publishedAt ? activityTimeText(u.publishedAt) : ''}</span>
                      {u.customerActionRequired && (
                        <span className={`rounded-full px-2 py-0.5 font-semibold ${u.customerCompletedAt ? 'bg-success-50 text-success-700' : 'bg-warning-50 text-warning-700'}`}>
                          {u.customerCompletedAt ? '고객 조치 완료' : `고객 조치 대기${u.dueDate ? ` · ${u.dueDate}까지` : ''}`}
                        </span>
                      )}
                      <button type="button" onClick={() => void run(() => archiveUpdate(u), '고객 화면에서 내렸습니다.')} className="ml-auto text-slate-400 hover:text-danger-600">
                        내리기
                      </button>
                    </div>
                    <p className="mt-1 text-[0.98rem] font-semibold text-slate-900">{u.title}</p>
                    {u.body && <p className="text-[0.92rem] break-keep whitespace-pre-wrap text-slate-600">{u.body}</p>}
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
          <h3 className="text-[1.05rem] font-bold text-slate-900">이 고객의 이벤트 <span className="text-slate-400">{events.length}</span></h3>
          <Link to="/ops/inbox" className="text-[0.9rem] font-medium text-brand-700 hover:underline">이벤트함</Link>
        </div>
        {events.length === 0 ? (
          <p className="mt-2 text-[0.92rem] text-slate-500">아직 이 고객과 연결된 이벤트가 없습니다.</p>
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
          <p className="mt-2 text-[0.82rem] text-slate-400">
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
              onClick={() =>
                link &&
                void run(
                  () => requestDocument(workspaceId, { linkId: link.id, operationsClientId: record.id, documentType: docForm.key, title: docForm.title, customerNote: docForm.note }),
                  '고객 화면에 서류 요청을 올렸습니다.',
                ).then(() => setDocForm((f) => ({ ...f, open: false })))
              }
            >
              요청
            </Button>
          </>
        }
      >
        <label className="block text-[0.9rem] font-medium text-slate-600">
          서류 종류
          <select
            value={docForm.key}
            onChange={(e) => {
              const key = e.target.value
              const meta = docOptions.find((d) => d.key === key)
              setDocForm((f) => ({ ...f, key, title: meta?.label ?? f.title }))
            }}
            className="mt-1 w-full rounded-(--radius-control) border border-slate-300 px-3 py-2 text-[0.98rem]"
          >
            {docOptions.map((d) => (
              <option key={d.key} value={d.key}>{d.label}</option>
            ))}
            <option value="other">기타</option>
          </select>
        </label>
        <label className="mt-3 block text-[0.9rem] font-medium text-slate-600">
          고객에게 보일 이름
          <input value={docForm.title} onChange={(e) => setDocForm((f) => ({ ...f, title: e.target.value }))} className="mt-1 w-full rounded-(--radius-control) border border-slate-300 px-3 py-2 text-[0.98rem]" />
        </label>
        <label className="mt-3 block text-[0.9rem] font-medium text-slate-600">
          안내 (선택)
          <input value={docForm.note} onChange={(e) => setDocForm((f) => ({ ...f, note: e.target.value }))} placeholder="예: 최근 3개월 이내 발급분" className="mt-1 w-full rounded-(--radius-control) border border-slate-300 px-3 py-2 text-[0.98rem]" />
        </label>
      </Modal>

      {/* 고객 화면 미리보기 */}
      <Modal open={preview !== null} title="고객 화면 미리보기 (고객이 보는 것과 동일)" size="lg" onClose={() => setPreview(null)}>
        {preview?.project && (
          <div className="rounded-(--radius-panel) border border-slate-200 bg-slate-50 p-4">
            <p className="text-[0.8rem] font-semibold tracking-wide text-slate-400 uppercase">{brand.customerPortalLabel} · 내 프로젝트</p>
            <h3 className="mt-1 text-[1.2rem] font-bold text-slate-900">{preview.project.name}</h3>
            <p className="text-[0.9rem] text-slate-500">
              {CUSTOMER_STAGE_LABEL[preview.project.stage]}{preview.project.consultant_name ? ` · 담당 ${preview.project.consultant_name}` : ''}
            </p>
            <ol className="mt-3 flex flex-wrap gap-1">
              {CUSTOMER_STAGE_ORDER.map((s, i) => {
                const idx = CUSTOMER_STAGE_ORDER.indexOf(preview.project!.stage)
                return (
                  <li key={s} className={`rounded-full px-2 py-0.5 text-[0.78rem] font-semibold ${i <= idx ? 'bg-brand-600 text-white' : 'bg-white text-slate-400'}`}>
                    {CUSTOMER_STAGE_LABEL[s]}
                  </li>
                )
              })}
            </ol>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-[0.88rem] font-semibold text-slate-700">해야 할 일</p>
                <ul className="mt-1 text-[0.9rem] text-slate-700">
                  {preview.updates.filter((u) => u.action_required && !u.completed_at).map((u) => <li key={u.id}>· {u.action_label ?? u.title}</li>)}
                  {preview.documents.filter((d) => d.status === 'requested' || d.status === 'rejected').map((d) => <li key={d.id}>· {d.title} 올리기</li>)}
                  {preview.updates.filter((u) => u.action_required && !u.completed_at).length + preview.documents.filter((d) => d.status === 'requested' || d.status === 'rejected').length === 0 && <li className="text-slate-400">없음</li>}
                </ul>
              </div>
              <div>
                <p className="text-[0.88rem] font-semibold text-slate-700">진행 업데이트</p>
                <ul className="mt-1 text-[0.9rem] text-slate-700">
                  {preview.updates.slice(0, 4).map((u) => <li key={u.id}>· [{UPDATE_CATEGORY_LABEL[u.category]}] {u.title}</li>)}
                  {preview.updates.length === 0 && <li className="text-slate-400">없음</li>}
                </ul>
              </div>
              <div>
                <p className="text-[0.88rem] font-semibold text-slate-700">서류</p>
                <ul className="mt-1 text-[0.9rem] text-slate-700">
                  {preview.documents.map((d) => <li key={d.id}>· {d.title} — {DOCUMENT_STATUS_LABEL[d.status]}</li>)}
                  {preview.documents.length === 0 && <li className="text-slate-400">없음</li>}
                </ul>
              </div>
              <div>
                <p className="text-[0.88rem] font-semibold text-slate-700">내가 보낸 요청</p>
                <ul className="mt-1 text-[0.9rem] text-slate-700">
                  {preview.requests.slice(0, 4).map((r) => <li key={r.id}>· {r.title} — {REQUEST_STATUS_LABEL[r.status]}</li>)}
                  {preview.requests.length === 0 && <li className="text-slate-400">없음</li>}
                </ul>
              </div>
            </div>
            <p className="mt-3 text-[0.8rem] text-slate-400">내부 메모·수임료·업무 세부 단계·활동 기록은 포함되지 않습니다.</p>
          </div>
        )}
      </Modal>
    </div>
  )
}
