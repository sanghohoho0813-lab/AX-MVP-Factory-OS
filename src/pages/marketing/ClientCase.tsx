/**
 * D-680 마케팅 ↔ 고객사 — 글 쓰기 화면(스레드 · 릴스/틱톡)에서 고객 사례를 쓸 때의 확인 단계(LINK-4).
 *
 *  1) [내 고객 사례 넣기](사실 목록 칸) → 업체 고르기 → 이름을 가린 한 줄 미리 보기 → [사실 목록에 넣기].
 *     회사 이름 · 사람 이름 · 번호 · 매출 · 금액 · 서류 내용은 넣지 않는다(재료로 읽지도 않는다 — services/marketing/clientCase).
 *  2) 고객 이름 확인 줄 — 주제 · 사실 · 글에 내 고객 이름 · 번호가 있으면 짚는다.
 *     [가리기](그 자리만 '한 ○○ 회사' 로) · [허락받았어요](한 번 더 묻고 그 업체 기록에 날짜로) · [고객 이름 아님](이 글에서만 넘김).
 *     번호 · 전화는 허락과 상관없이 늘 짚는다.
 * 📐 평소에는 아무것도 그리지 않는다 — 단추는 접힌 사실 목록 안, 확인 줄은 이름이 있을 때만(글자 수 한도 D-630).
 * 규칙만 본다(AI 를 부르지 않는다). 고객 목록은 이 작업공간 것만(listClients — 서버 규칙 그대로).
 * 박스는 흰 바탕 + 얇은 회색 테두리 · 강조는 글자색 · 15px 이상 · 쉬운 말(D-507).
 */
import { useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { EyeOff, ShieldCheck, UserRoundSearch } from 'lucide-react'
import { AuthContext } from '../../auth/authContext'
import { Button } from '../../components/ui/Button'
import { BottomSheet } from '../../components/ui/primitives'
import { useToast } from '../../components/ui/toastContext'
import { allServiceMetas, isServiceStarted, normalizeServiceStatus } from '../../content/clientOpsCatalog'
import { errorText } from '../../lib/errorText'
import { withActivity } from '../../services/clientOpsActivity'
import { listClients, saveClient } from '../../services/clientOpsService'
import {
  CASE_PART_KEYS,
  CASE_PART_LABEL,
  buildNameIndex,
  caseLine,
  caseParts,
  caseTopic,
  consentDayText,
  findClientNames,
  hitKey,
  hitText,
  maskClientNames,
  withCaseConsent,
  type CasePartKey,
  type CaseWork,
  type NameHit,
} from '../../services/marketing/clientCase'
import type { ClientOpsRecord } from '../../types/clientOps'

/** 이 업체와 함께 한 일 — 마친 일 먼저 · 진행 중인 일(업무 이름만 · 금액 · 메모는 읽지 않는다) */
export function caseWorkOf(record: Pick<ClientOpsRecord, 'services'>): CaseWork[] {
  const done: CaseWork[] = []
  const going: CaseWork[] = []
  for (const meta of allServiceMetas()) {
    const status = normalizeServiceStatus(record.services?.[meta.key]?.status)
    if (status === 'done') done.push({ label: meta.label, done: true })
    else if (isServiceStarted(status)) going.push({ label: meta.label, done: false })
  }
  return [...done, ...going]
}

export interface ClientCaseApi {
  /** 사실 목록 칸의 [내 고객 사례 넣기] */
  open: () => void
  /** 고객 이름 확인 줄 — 이름이 없으면 null. at = 어디에 그리나(시험 이름) */
  guard: (at: 'start' | 'edit' | 'output') => ReactNode
  /** 사례 넣기 판(열려 있을 때만) */
  sheet: ReactNode
  /**
   * D-691 밖으로 나가는 글(복사 · 내려받기) — 허락받지 않은 고객 이름은 가리고 번호는 지운다.
   * 허락받은 이름 · [고객 이름 아님] 으로 넘긴 낱말은 그대로. 이름이 없으면 글 그대로.
   */
  clean: (text: string) => string
  /** 지금 짚은 것 수(허락받은 것 빼고) — 0 이면 clean 은 글을 바꾸지 않는다 */
  pending: number
}

const SHOWN = 5
/** 확인 줄은 처음 세 줄 — 더 있으면 [n개 더 보기](하나씩 처리하면 다음 줄이 올라온다) */
const GUARD_SHOWN = 3
const btnLine = 'tap t-sub inline-flex min-h-10 items-center gap-1.5 rounded-(--radius-control) border border-slate-300 bg-white px-3 font-semibold whitespace-nowrap text-slate-800 hover:bg-slate-50 disabled:opacity-60'
const btnText = 'tap t-sub inline-flex min-h-10 items-center rounded-(--radius-control) px-2 font-semibold whitespace-nowrap text-slate-600 underline-offset-2 hover:bg-slate-50 hover:underline disabled:opacity-60'

export function useClientCase({
  testPrefix,
  today,
  fields,
  onFields,
  onInsert,
  openFor,
  onOpened,
  readOnly = false,
  output = false,
}: {
  testPrefix: string
  today: string
  /** 이름을 찾는 칸들 — 주제 · 사실 · 공개 글(열쇠는 화면의 초안 칸 이름) */
  fields: Record<string, string>
  /** 가린 글로 바꾸기(바뀐 칸만) — 결과 글 보기(output)에는 없다 */
  onFields?: (next: Record<string, string>) => void
  /** 가린 한 줄을 사실 목록에 — topic 은 주제 칸이 비어 있을 때 넣을 주제 */
  onInsert?: (line: string, topic: string) => void
  /**
   * D-691 결과 글 보기(1주일치 · 유튜브 묶음) — 고칠 칸이 없다. [가리기] 대신 복사 · 내려받기가 clean() 으로 가린 채 나가고,
   * 확인 줄은 그 말을 한 줄 더 한다([허락받았어요] · [고객 이름 아님] 은 그대로).
   */
  output?: boolean
  /** 주소 ?case=<업체> 로 들어왔을 때 그 업체로 판을 연다 */
  openFor?: string | null
  /** openFor 를 썼다(주소에서 지우라고) */
  onOpened?: () => void
  /** 대표가 팀장 화면을 보는 중 — 업체 기록에 적는 단추(허락 · 허락 취소)는 없다 */
  readOnly?: boolean
}): ClientCaseApi {
  const auth = useContext(AuthContext)
  const ws = auth?.currentWorkspaceId ?? null
  const { showToast } = useToast()
  const [clients, setClients] = useState<ClientOpsRecord[] | null>(null)
  const [sheet, setSheet] = useState<{ id: string | null } | null>(null)
  const [skip, setSkip] = useState<ReadonlySet<string>>(() => new Set())
  const [asking, setAsking] = useState('')
  const [busy, setBusy] = useState('')
  const [allHits, setAllHits] = useState(false)

  useEffect(() => {
    let alive = true
    listClients(ws)
      .then((list) => alive && setClients(list))
      .catch(() => alive && setClients([]))
    return () => {
      alive = false
    }
  }, [ws])

  // 주소로 들어온 업체 — 한 번만
  const opened = useRef(false)
  useEffect(() => {
    if (!openFor || opened.current) return
    opened.current = true
    setSheet({ id: openFor })
    onOpened?.()
  }, [openFor, onOpened])

  const index = useMemo(() => buildNameIndex(clients ?? []), [clients])
  const text = Object.values(fields).join('\n')
  const hits = useMemo(() => findClientNames(text, index).filter((h) => !skip.has(hitKey(h))), [text, index, skip])

  /** 그 자리만 가린다(다른 이름 · 넘긴 것은 그대로) */
  const hide = (h: NameHit) => {
    const others = new Set([...skip, ...hits.filter((x) => hitKey(x) !== hitKey(h)).map(hitKey)])
    const next: Record<string, string> = {}
    for (const [k, v] of Object.entries(fields)) {
      const masked = maskClientNames(v, index, { skip: others })
      if (masked !== v) next[k] = masked
    }
    if (Object.keys(next).length) onFields?.(next)
    showToast(h.kind === 'number' ? '번호를 지웠어요.' : '이름을 가렸어요.')
  }

  const pending = hits.filter((h) => !h.consent).length
  // 짚은 칸 밖의 글이 들어와도 같은 규칙으로(가릴 것이 없으면 글 그대로)
  const clean = useCallback((t: string) => (index.matchers.length ? maskClientNames(t, index, { keepConsented: true, skip }) : t), [index, skip])

  const setConsent = useCallback(
    async (h: NameHit, on: boolean) => {
      if (busy) return
      setBusy(hitKey(h))
      try {
        // 열어 둔 사이 다른 창 · 다른 사람이 이 업체를 고쳤을 수 있다 — 지금 판을 다시 읽고 그 위에 적는다
        const fresh = (await listClients(ws).catch(() => null))?.find((c) => c.id === h.clientId) ?? clients?.find((c) => c.id === h.clientId)
        if (!fresh) throw new Error('이 업체를 찾지 못했어요 — 고객 관리에서 확인해 주세요.')
        const saved = await saveClient(withActivity(withCaseConsent(fresh, on, today), 'profile', on ? '사례 공개 허락받음 — 공개 글에 회사 이름을 써도 됨' : '사례 공개 허락 취소 — 공개 글에 회사 이름을 쓰지 않음'))
        setClients((list) => (list ?? []).map((c) => (c.id === saved.id ? saved : c)))
        setAsking('')
        showToast(on ? `${saved.companyName} — 허락받은 날을 업체 기록에 남겼어요.` : `${saved.companyName} — 허락을 취소했어요.`)
      } catch (cause) {
        showToast(errorText(cause, '업체 기록에 적지 못했어요 — 잠시 뒤 다시 눌러 주세요.'))
      } finally {
        setBusy('')
      }
    },
    [busy, clients, showToast, today, ws],
  )

  const guard = (at: 'start' | 'edit' | 'output'): ReactNode => {
    if (!hits.length) return null
    return (
      <div className="flex flex-col gap-2 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2.5" data-testid={`${testPrefix}-case-guard`} data-at={at} data-count={hits.length} data-pending={pending}>
        <p className="t-sub flex items-center gap-1.5 font-bold text-slate-900">
          <UserRoundSearch aria-hidden="true" className="size-4 shrink-0 text-slate-500" />
          고객 이름 확인
        </p>
        {output && pending > 0 && (
          <p className="t-sub break-keep text-slate-700" data-testid={`${testPrefix}-case-output`}>
            복사 · 내려받기에는 가린 채로 나가요.
          </p>
        )}
        <ul className="flex flex-col gap-2">
          {(allHits ? hits : hits.slice(0, GUARD_SHOWN)).map((h) => {
            const key = hitKey(h)
            const ask = asking === key
            return (
              <li key={key} className="flex flex-wrap items-center gap-x-2 gap-y-1.5" data-testid={`${testPrefix}-case-hit`} data-kind={h.kind} data-consent={h.consent ? '1' : '0'}>
                {ask ? (
                  <>
                    <span className="t-sub min-w-0 flex-1 basis-56 break-keep text-slate-800" data-testid={`${testPrefix}-case-ask`}>
                      <b>{h.company}</b> 에게 "글에 회사 이름을 써도 된다" 고 허락받았나요? 업체 기록에 오늘 날짜로 남아요.
                    </span>
                    <span className="ml-auto flex flex-wrap items-center gap-1.5">
                      <button type="button" className={btnLine} disabled={!!busy} onClick={() => void setConsent(h, true)} data-testid={`${testPrefix}-case-yes`}>
                        <ShieldCheck aria-hidden="true" className="size-4" /> 네, 받았어요
                      </button>
                      <button type="button" className={btnText} disabled={!!busy} onClick={() => setAsking('')} data-testid={`${testPrefix}-case-no`}>
                        취소
                      </button>
                    </span>
                  </>
                ) : (
                  <>
                    <span className={`t-sub min-w-0 flex-1 basis-56 break-keep [overflow-wrap:anywhere] ${h.consent ? 'text-slate-700' : 'text-danger-700'}`} data-testid={`${testPrefix}-case-text`}>
                      {hitText(h)}
                    </span>
                    <span className="ml-auto flex flex-wrap items-center gap-1.5">
                      {!output && (
                        <button type="button" className={btnLine} onClick={() => hide(h)} data-testid={`${testPrefix}-case-hide`} data-guide="fn-mk-case-hide">
                          <EyeOff aria-hidden="true" className="size-4" /> {h.kind === 'number' ? '지우기' : '가리기'}
                        </button>
                      )}
                      {h.kind !== 'number' && !h.consent && !readOnly && (
                        <button type="button" className={btnLine} onClick={() => setAsking(key)} data-testid={`${testPrefix}-case-consent`}>
                          허락받았어요
                        </button>
                      )}
                      {h.kind !== 'number' && h.consent && !readOnly && (
                        <button type="button" className={btnText} disabled={!!busy} onClick={() => void setConsent(h, false)} data-testid={`${testPrefix}-case-revoke`}>
                          허락 취소
                        </button>
                      )}
                      {h.kind !== 'number' && !h.consent && (
                        <button type="button" className={btnText} onClick={() => setSkip((s) => new Set([...s, key]))} title="이 낱말은 고객 이름이 아니에요 — 이 글에서는 더 묻지 않아요." data-testid={`${testPrefix}-case-skip`}>
                          고객 이름 아님
                        </button>
                      )}
                    </span>
                  </>
                )}
              </li>
            )
          })}
        </ul>
        {!allHits && hits.length > GUARD_SHOWN && (
          <button type="button" onClick={() => setAllHits(true)} className="tap t-sub min-h-10 self-start font-semibold text-brand-700 hover:underline" data-testid={`${testPrefix}-case-hits-more`}>
            {hits.length - GUARD_SHOWN}개 더 보기
          </button>
        )}
      </div>
    )
  }

  return {
    open: () => setSheet({ id: null }),
    guard,
    clean,
    pending,
    sheet: sheet ? (
      <CaseSheet
        clients={clients}
        today={today}
        initialId={sheet.id}
        testPrefix={testPrefix}
        onClose={() => setSheet(null)}
        onInsert={(line, topic) => {
          onInsert?.(line, topic)
          setSheet(null)
          showToast('사실 목록에 넣었어요 — 이 사례로 글을 써요.')
        }}
      />
    ) : null,
  }
}

function CaseSheet({
  clients,
  today,
  initialId,
  testPrefix,
  onClose,
  onInsert,
}: {
  clients: ClientOpsRecord[] | null
  today: string
  initialId: string | null
  testPrefix: string
  onClose: () => void
  onInsert: (line: string, topic: string) => void
}) {
  const [picked, setPicked] = useState<string | null>(initialId)
  const [q, setQ] = useState('')
  const [shown, setShown] = useState(SHOWN)
  const [off, setOff] = useState<CasePartKey[]>([])
  const list = useMemo(() => {
    const key = q.replace(/\s+/g, '').toLowerCase()
    return (clients ?? [])
      .filter((c) => !c.archivedAt && c.companyName.trim())
      .filter((c) => !key || c.companyName.replace(/\s+/g, '').toLowerCase().includes(key))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [clients, q])
  const record = picked ? (clients ?? []).find((c) => c.id === picked) ?? null : null
  const parts = useMemo(() => (record ? caseParts(record, today, caseWorkOf(record)) : null), [record, today])

  if (clients === null) {
    return (
      <BottomSheet title="내 고객 사례 넣기" onClose={onClose}>
        <p className="t-body text-slate-600" data-testid={`${testPrefix}-case-loading`}>
          고객 목록을 불러오는 중…
        </p>
      </BottomSheet>
    )
  }

  if (record && parts) {
    const line = caseLine(parts, off)
    const has = CASE_PART_KEYS.filter((k) => parts[k])
    return (
      <BottomSheet
        title="이렇게 들어가요"
        onClose={onClose}
        footer={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" className="w-full sm:w-auto" onClick={() => onInsert(line, caseTopic(parts, off))} data-testid={`${testPrefix}-case-insert`}>
              사실 목록에 넣기
            </Button>
            <Button variant="ghost" onClick={() => { setPicked(null); setOff([]) }} data-testid={`${testPrefix}-case-back`}>
              다른 업체
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3" data-testid={`${testPrefix}-case-preview`}>
          <p className="t-sub break-keep text-slate-600">
            <b className="text-slate-900">{record.companyName}</b> — 이름은 글에 들어가지 않아요.
            {record.caseConsent && <span className="ml-1 text-slate-600" data-testid={`${testPrefix}-case-consented`}>(허락받음 · {consentDayText(record.caseConsent)})</span>}
          </p>
          <p className="t-body rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2.5 font-semibold break-keep text-slate-900 [overflow-wrap:anywhere]" data-testid={`${testPrefix}-case-line`}>
            {line}
          </p>
          {has.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="t-sub break-keep text-slate-600">누가 봐도 그 회사인 줄 알 것 같으면 눌러서 빼세요.</p>
              <div className="flex flex-wrap gap-1.5">
                {has.map((k) => {
                  const on = !off.includes(k)
                  return (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setOff((v) => (on ? [...v, k] : v.filter((x) => x !== k)))}
                      className={`tap t-sub inline-flex min-h-10 items-center rounded-full border px-3 font-semibold ${on ? 'border-brand-600 bg-white text-brand-700' : 'border-slate-300 bg-white text-slate-500 line-through'}`}
                      data-testid={`${testPrefix}-case-part`}
                      data-part={k}
                    >
                      {CASE_PART_LABEL[k]}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          <p className="t-sub break-keep text-slate-600">회사 이름 · 사람 이름 · 번호 · 매출 · 금액 · 서류 내용은 넣지 않아요.</p>
        </div>
      </BottomSheet>
    )
  }

  return (
    <BottomSheet title="내 고객 사례 넣기" onClose={onClose}>
      <div className="flex flex-col gap-3" data-testid={`${testPrefix}-case-pick`}>
        {list.length === 0 && !q ? (
          <p className="t-body break-keep text-slate-700" data-testid={`${testPrefix}-case-empty`}>
            고객 관리에 업체가 아직 없어요.{' '}
            <Link to="/ops/clients" className="font-semibold text-brand-700 underline">
              고객 관리로 →
            </Link>
          </p>
        ) : (
          <>
            <input
              value={q}
              onChange={(e) => { setQ(e.target.value); setShown(SHOWN) }}
              placeholder="업체 이름으로 찾기"
              aria-label="업체 이름으로 찾기"
              className="t-body min-h-12 w-full min-w-0 rounded-(--radius-control) border border-slate-300 bg-white px-3"
              data-testid={`${testPrefix}-case-search`}
            />
            <ul className="flex flex-col gap-1.5">
              {list.slice(0, shown).map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setPicked(c.id)}
                    className="tap t-body flex min-h-12 w-full items-center gap-2 rounded-(--radius-control) border border-slate-200 bg-white px-3 text-left font-semibold text-slate-900 hover:bg-slate-50"
                    data-testid={`${testPrefix}-case-client`}
                  >
                    <span className="min-w-0 flex-1 truncate">{c.companyName}</span>
                    {c.caseConsent && <span className="t-sub shrink-0 font-normal text-slate-600">허락받음</span>}
                  </button>
                </li>
              ))}
            </ul>
            {list.length === 0 && <p className="t-sub text-slate-600">그 이름의 업체가 없어요.</p>}
            {list.length > shown && (
              <button type="button" onClick={() => setShown((n) => n + 20)} className="tap t-sub min-h-10 self-start font-semibold text-brand-700 hover:underline" data-testid={`${testPrefix}-case-more`}>
                {list.length - shown}곳 더 보기
              </button>
            )}
          </>
        )}
      </div>
    </BottomSheet>
  )
}
