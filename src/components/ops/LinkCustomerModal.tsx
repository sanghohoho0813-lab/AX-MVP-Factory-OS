import { useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import type { ClientOpsRecord } from '../../types/clientOps'
import type { CustomerEvent, PortalClientLink } from '../../types/bridge'
import { Modal } from '../ui/Modal'
import { Button } from '../ui/Button'
import { createClient, saveClient } from '../../services/clientOpsService'
import { withNewProspect } from '../../services/salesPipeline'
import { splitContact, withInboxPayload } from '../../services/inboxToSales'
import { CLIENT_TYPE_LABEL, clientTypeOf, rememberClientTypeView, suggestClientType, withClientType, type ClientType } from '../../services/clientType'
import { useIsPilot } from '../../auth/osAccess'
import { ClientTypePicker } from './ClientTypePicker'
import { todayLocalDate } from '../../lib/appClock'
import { withActivity } from '../../services/clientOpsActivity'
import { createLink, findProfileByEmail, listLinksForClient, updateEvent } from '../../services/customerBridgeService'
import { normalizeQuery } from '../../lib/format'

/**
 * 고객 이벤트를 고객사에 연결한다.
 *  - 기존 고객사 고르기 / 고객이 제출한 값으로 새 고객사 만들기
 *  - 고객 플랫폼 계정(이메일)이 확인되면 함께 연결(portal_client_links). 확인되지 않으면 고객사에만 붙이고 계정은 나중에.
 * 이메일·전화가 같다는 이유로 자동 연결하지 않는다 — 항상 사람이 이 화면에서 확정한다.
 */
/** D-150: 신청(이벤트)별로 이미 만든 업체 — 연결이 실패해 창을 다시 열어도 새로 만들지 않는다 */
const madeFromEvent = new Map<string, { created: ClientOpsRecord; saved: ClientOpsRecord | null }>()

export function LinkCustomerModal({
  event,
  clients,
  workspaceId,
  initialTab = 'existing',
  onClose,
  onDone,
}: {
  event: CustomerEvent
  clients: ClientOpsRecord[]
  workspaceId: string | null
  initialTab?: 'existing' | 'new'
  onClose: () => void
  /** created — '새 업체 만들기' 로 만든 업체(기존 업체에 붙였으면 null) */
  onDone: (updated: CustomerEvent, link: PortalClientLink | null, created: ClientOpsRecord | null) => void
}) {
  const pilot = useIsPilot()
  const p = event.payload
  const str = (k: string) => (typeof p[k] === 'string' ? (p[k] as string) : '')
  const guessName = str('company_name') || str('company')
  const guessContact = str('representative_name') || str('buyer_name') || str('name')
  // D-182: 한 칸에 '메일 / 전화' 를 같이 적어 보낸 신청도 휴대폰 · 이메일 칸으로 나눠 채운다
  const contact = splitContact(str('phone') || str('buyer_phone') || str('contact'), str('email') || str('buyer_email'))
  const guessPhone = contact.phone
  const guessEmail = contact.email
  const guessIndustry = str('industry')

  const [tab, setTab] = useState<'existing' | 'new'>(initialTab)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string>('')
  const [form, setForm] = useState({ companyName: guessName, contactName: guessContact, contactPhone: guessPhone, contactEmail: guessEmail, industry: guessIndustry })
  const [accountEmail, setAccountEmail] = useState(guessEmail)
  const [profile, setProfile] = useState<{ id: string; email: string } | null>(null)
  const [profileChecked, setProfileChecked] = useState(false)
  const [linkAccount, setLinkAccount] = useState(true)
  // D-182: 어디로 분류할지(대표만) — 신청서에 컨설턴트라고 드러나 있으면 컨설턴트로 골라 둔다. 고르는 것은 사람이
  const suggested = useMemo(() => suggestClientType(p, event.sourceType), [p, event.sourceType])
  const [ctype, setCtype] = useState<ClientType>(suggested.type)
  const asType: ClientType = pilot ? 'sme' : ctype
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // 고객 계정 찾기 — 이벤트에 계정이 있으면 그것, 없으면 이메일로 후보만 보여준다
  useEffect(() => {
    let alive = true
    ;(async () => {
      if (event.profileId) {
        if (alive) {
          setProfile({ id: event.profileId, email: guessEmail || '(계정 확인됨)' })
          setProfileChecked(true)
        }
        return
      }
      if (!accountEmail.trim()) {
        if (alive) { setProfile(null); setProfileChecked(true) }
        return
      }
      try {
        const found = await findProfileByEmail(accountEmail)
        if (alive) { setProfile(found); setProfileChecked(true) }
      } catch {
        if (alive) { setProfile(null); setProfileChecked(true) }
      }
    })()
    return () => { alive = false }
  }, [event.profileId, accountEmail, guessEmail])

  // 같은 회사명·전화·이메일을 가진 기존 고객사를 위로 올려 후보로 보여준다(자동 확정은 하지 않는다)
  const candidates = useMemo(() => {
    const q = normalizeQuery(query)
    const score = (c: ClientOpsRecord) => {
      let s = 0
      if (guessName && c.companyName.replace(/\s/g, '') === guessName.replace(/\s/g, '')) s += 3
      if (guessPhone && c.contactPhone.replace(/\D/g, '') === guessPhone.replace(/\D/g, '') && guessPhone.replace(/\D/g, '')) s += 2
      if (guessEmail && c.contactEmail.toLowerCase() === guessEmail.toLowerCase()) s += 2
      return s
    }
    return clients
      .filter((c) => c.archivedAt === null)
      .filter((c) => (q ? normalizeQuery(`${c.companyName} ${c.contactName} ${c.businessNumber}`).includes(q) : true))
      .map((c) => ({ c, s: score(c) }))
      .sort((a, b) => b.s - a.s || a.c.companyName.localeCompare(b.c.companyName))
  }, [clients, query, guessName, guessPhone, guessEmail])

  const likely = candidates.filter((x) => x.s > 0)

  const finish = async (client: ClientOpsRecord, created: ClientOpsRecord | null = null) => {
    let link: PortalClientLink | null = null
    if (linkAccount && profile) {
      try {
        link = await createLink(workspaceId, {
          operationsClientId: client.id,
          profileId: profile.id,
          profileEmail: profile.email,
          displayName: '',
        })
      } catch {
        // 이미 연결된 경우 기존 연결을 쓴다
        const existing = await listLinksForClient(workspaceId, client.id)
        link = existing.find((l) => l.profileId === profile.id) ?? null
        if (!link) throw new Error('고객 계정을 연결하지 못했습니다.')
      }
    }
    const updated = await updateEvent(event, {
      status: 'linked',
      operationsClientId: client.id,
      portalClientLinkId: link?.id ?? event.portalClientLinkId,
    })
    onDone(updated, link, created)
  }

  const submitExisting = async () => {
    const client = clients.find((c) => c.id === selectedId)
    if (!client) { setError('연결할 업체를 골라 주세요.'); return }
    setBusy(true); setError('')
    try {
      await finish(client)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '연결하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  // D-150: 창을 닫았다 다시 열어도 같은 신청으로 업체를 또 만들지 않게 — 이 화면을 연 동안(새로고침 전까지) 신청별로 기억한다
  const createdRef = useRef<ClientOpsRecord | null>(madeFromEvent.get(event.id)?.created ?? null)
  const savedRef = useRef<ClientOpsRecord | null>(madeFromEvent.get(event.id)?.saved ?? null)
  const submitNew = async () => {
    if (!form.companyName.trim()) { setError('회사명을 입력해 주세요.'); return }
    setBusy(true); setError('')
    try {
      // D-114: 상담신청에서 만든 업체는 계약 전 — 잠재고객(영업 단계 '잠재 고객', 유입 '홈페이지 상담신청')으로 시작한다
      // D-122: 만든 뒤 다음 걸음(저장 · 연결)이 실패해 다시 누르면 같은 업체를 또 만들지 않는다
      const created =
        createdRef.current ??
        (await createClient(workspaceId, {
          companyName: form.companyName,
          contactName: form.contactName,
          contactPhone: form.contactPhone,
          industry: form.industry,
          status: 'waiting',
          ...(asType === 'consultant' ? { clientType: 'consultant' as const } : {}),
        }))
      createdRef.current = created
      madeFromEvent.set(event.id, { created, saved: savedRef.current })
      // D-222 실패 뒤 다시 누를 때 창에서 고친 칸(회사명 · 담당자 · 전화 · 업종 · 메일)을 이어서 쓴다 — 예전에는 처음 만든 값이 그대로 남고 메일만 바뀌었다
      const formFields = { companyName: form.companyName.trim(), contactName: form.contactName, contactPhone: form.contactPhone, industry: form.industry, contactEmail: form.contactEmail.trim() }
      let saved =
        savedRef.current ??
        (await saveClient(
        // D-122: 고객이 적어 보낸 문의 · 진행 방식 · 희망 연락 시간도 영업 칸으로
        withInboxPayload(withNewProspect(
          withActivity(
            // D-182: 만든 뒤 종류를 바꿔 다시 눌러도 고른 쪽으로 저장한다(팀장 화면은 손대지 않는다)
            pilot ? { ...created, ...formFields } : withClientType({ ...created, ...formFields }, asType),
            'profile',
            `고객 플랫폼 이벤트(${event.eventType})에서 업체 생성${pilot ? '' : ` · ${CLIENT_TYPE_LABEL[asType]}`}`,
          ),
          event.sourceType === 'grant_finder' ? '지원사업 찾기' : '홈페이지 상담신청',
        ),
        event.payload,
        todayLocalDate(),
      )))
      if (savedRef.current && (Object.keys(formFields) as (keyof typeof formFields)[]).some((k) => saved[k] !== formFields[k])) {
        saved = await saveClient(withActivity({ ...saved, ...formFields }, 'profile', '상담신청 연결 — 창에서 고친 업체 정보 반영'))
      }
      // 연결이 실패한 뒤 종류를 바꿔 다시 누른 경우 — 이미 저장한 업체를 고른 쪽으로 옮겨 둔다
      if (!pilot && clientTypeOf(saved) !== asType) {
        saved = await saveClient(withActivity(withClientType(saved, asType), 'profile', `고객 종류 → ${CLIENT_TYPE_LABEL[asType]}`))
      }
      savedRef.current = saved
      madeFromEvent.set(event.id, { created, saved })
      // 고객 관리를 열면 방금 넣은 쪽이 바로 보이게
      if (!pilot) rememberClientTypeView(clientTypeOf(saved))
      await finish(saved, saved)
    } catch (cause) {
      const msg = cause instanceof Error ? cause.message : '만들지 못했습니다.'
      setError(createdRef.current ? `${msg} — 업체는 이미 만들었습니다. 다시 누르면 새로 만들지 않고 이어서 연결합니다.` : msg)
    } finally {
      setBusy(false)
    }
  }

  const accountBlock = (
    <div className="mt-4 rounded-(--radius-control) border border-slate-200 bg-slate-50 p-3">
      <p className="text-[0.9rem] font-semibold text-slate-700">고객 플랫폼 계정</p>
      {event.profileId ? (
        <p className="mt-1 text-[0.9rem] text-slate-600">이 이벤트를 만든 계정이 확인되었습니다{guessEmail ? ` · ${guessEmail}` : ''}.</p>
      ) : (
        <>
          <label className="mt-1 block text-[0.875rem] text-slate-500">
            계정 이메일
            <input
              value={accountEmail}
              onChange={(e) => { setAccountEmail(e.target.value); setProfile(null); setProfileChecked(false) }}
              placeholder="고객이 miraeailab.com 에 가입한 이메일"
              className="mt-1 w-full rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2 text-[0.95rem] focus:border-brand-500 focus:outline-none"
            />
          </label>
          {profileChecked && accountEmail.trim() && !profile && (
            <p className="mt-1 text-[0.875rem] text-slate-500">
              이 이메일로 가입한 계정을 찾지 못했습니다. 업체에는 연결되고, 계정은 나중에 업체 상세 &gt; 고객 플랫폼 탭에서 연결할 수 있습니다.
            </p>
          )}
        </>
      )}
      {profile && (
        <label className="mt-2 flex cursor-pointer items-center gap-2 text-[0.9rem] text-slate-700">
          <input type="checkbox" checked={linkAccount} onChange={(e) => setLinkAccount(e.target.checked)} className="size-4 accent-brand-600" />
          이 계정({profile.email})을 업체와 연결해 고객 화면(My MIRAE)을 열어 준다
        </label>
      )}
    </div>
  )

  return (
    <Modal
      open
      title="업체와 연결"
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>취소</Button>
          <Button variant="primary" onClick={() => void (tab === 'existing' ? submitExisting() : submitNew())} disabled={busy || (!event.profileId && !!accountEmail.trim() && !profileChecked)}>
            {busy ? '연결 중…' : tab === 'existing' ? '이 업체에 연결' : '만들고 연결'}
          </Button>
        </>
      }
    >
      <div role="tablist" className="flex rounded-(--radius-control) border border-slate-200 bg-slate-50 p-0.5">
        {(['existing', 'new'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => { setTab(t); setError('') }}
            className={`tap flex-1 rounded-[8px] px-3 py-1.5 text-[0.92rem] font-semibold ${tab === t ? 'bg-white text-slate-900 shadow-(--shadow-card)' : 'text-slate-500'}`}
          >
            {t === 'existing' ? '기존 업체' : '새 업체 만들기'}
          </button>
        ))}
      </div>

      {tab === 'existing' ? (
        <div className="mt-4">
          {likely.length > 0 && !query && (
            <p className="mb-2 text-[0.88rem] text-slate-500">
              회사명·연락처가 같은 업체가 위에 있습니다. 맞는지 확인하고 고르세요 — 자동으로 합치지 않습니다.
            </p>
          )}
          <div className="relative">
            <Search aria-hidden="true" className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="업체명·대표자·사업자번호로 찾기"
              aria-label="업체 검색"
              className="w-full rounded-(--radius-control) border border-slate-300 py-2 pr-3 pl-9 text-[0.95rem] focus:border-brand-500 focus:outline-none"
            />
          </div>
          <ul role="radiogroup" aria-label="업체" className="mt-2 max-h-64 overflow-y-auto rounded-(--radius-control) border border-slate-200">
            {candidates.length === 0 && <li className="px-3 py-4 text-center text-[0.9rem] text-slate-500">일치하는 업체가 없습니다.</li>}
            {candidates.map(({ c, s }) => (
              <li key={c.id} className="border-b border-slate-100 last:border-0">
                <button
                  type="button"
                  role="radio"
                  aria-checked={selectedId === c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-slate-50 ${selectedId === c.id ? 'bg-brand-50' : ''}`}
                >
                  <span className="min-w-0">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-[0.95rem] font-semibold text-slate-800">{c.companyName}</span>
                      {!pilot && clientTypeOf(c) === 'consultant' && <span className="shrink-0 rounded-full bg-slate-100 px-1.5 t-meta font-semibold text-slate-600">컨설턴트</span>}
                    </span>
                    <span className="block truncate text-[0.875rem] text-slate-500">{[c.contactName, c.contactPhone, c.industry].filter(Boolean).join(' · ') || '정보 없음'}</span>
                  </span>
                  {s > 0 && <span className="shrink-0 rounded-full bg-highlight-100 px-2 py-0.5 t-meta font-semibold text-highlight-700">후보</span>}
                </button>
              </li>
            ))}
          </ul>
          {accountBlock}
        </div>
      ) : (
        <div className="mt-4">
          {/* D-182: 어디로 분류할지 먼저 — 고른 쪽(고객 관리 › 중소기업 고객 · 컨설턴트 고객)으로 바로 들어간다 */}
          {!pilot && (
            <div className="mb-4">
              <ClientTypePicker value={ctype} onChange={setCtype} testId="link-client-type" hint={ctype === suggested.type ? suggested.reason : ''} />
            </div>
          )}
          <p className="text-[0.88rem] break-keep text-slate-500">
            고객이 제출한 값으로 채웠습니다. 저장 전 확인하세요. 계약 전이라 <strong className="font-semibold text-slate-700">잠재고객</strong>으로 등록되고,{' '}
            {pilot ? '' : <>고객 관리 <strong className="font-semibold text-slate-700">'{CLIENT_TYPE_LABEL[asType]}'</strong> 쪽과 </>}영업 관리 보드의 '잠재 고객' 칸에 올라갑니다.
          </p>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(
              [
                ['companyName', asType === 'consultant' ? '이름(회사명) *' : '회사명 *'],
                ['contactName', '대표자·담당자'],
                ['contactPhone', '휴대폰번호'],
                ['contactEmail', '이메일'],
                ['industry', '업종'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="block text-[0.875rem] text-slate-500">
                {label}
                <input
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  className="mt-1 w-full rounded-(--radius-control) border border-slate-300 px-3 py-2 text-[0.95rem] text-slate-800 focus:border-brand-500 focus:outline-none"
                />
              </label>
            ))}
          </div>
          {accountBlock}
        </div>
      )}
      {error && <p role="alert" className="mt-3 text-[0.9rem] text-danger-600">{error}</p>}
    </Modal>
  )
}
