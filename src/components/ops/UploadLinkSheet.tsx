/**
 * L-41 · D-652 서류 올리기 링크 — 업체 서류함에서.
 *
 *  - 한 줄(UploadLinkBar): 고객이 올리고 아직 칸에 안 넣은 파일 n개 · 열린 링크 기한. 없으면 아무것도 안 그린다.
 *  - 판(UploadLinkSheet): 한 화면에 한 가지 — ① 받을 서류 고르기 → ② 링크 · 카톡 문구 복사 → ③ 고객이 올린 서류 넣기.
 *  - 넣기는 서류 올리기와 같은 길(uploadLinkAccept) — 덮지 않고 '(2)' 칸 · 글자 읽어 회사 정보 · 되돌리기.
 *  - 0031 전 · 로컬 모드 · 쓸 수 없는 사람(허락 없는 대표 등)은 상태가 none/missing → 아무것도 안 그린다.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Copy, Inbox, Link2 } from 'lucide-react'
import type { ClientOpsRecord, DocumentKey } from '../../types/clientOps'
import { BottomSheet } from '../ui/primitives'
import { Button } from '../ui/Button'
import { useToast } from '../ui/toastContext'
import { copyText } from '../../lib/copyText'
import { allDocumentMetas } from '../../services/clientOpsDocuments'
import { collectMissingDocuments } from '../../services/clientOpsMessages'
import { pendingDocKeys, requestLinesOf, requestProgress, sameOpenRequest } from '../../services/docRequests'
import { documentFileUrl } from '../../services/clientOpsService'
import {
  UPLOAD_CHANGED,
  UPLOAD_DAYS,
  UPLOAD_DOCS_MAX,
  decideUploadedFile,
  koDate,
  loadUploadLink,
  offUploadLink,
  rotateUploadLink,
  saveUploadLink,
  sizeText,
  uploadErrorText,
  uploadRequestText,
  uploadUrl,
  type UploadDoc,
  type UploadLinkInfo,
  type UploadLoad,
  type UploadState,
  type UploadedFile,
} from '../../services/uploadLink'

type Writer = Extract<UploadState, { role: 'writer' }>

/** 이 업체 올리기 링크 상태 — 화면으로 돌아오면 · 다른 곳에서 바꾸면 다시 읽는다 */
export function useUploadLink(workspaceId: string | null | undefined, clientId: string | undefined, enabled: boolean): { state: Writer | null; refresh: () => void } {
  const [load, setLoad] = useState<UploadLoad | null>(null)
  const refresh = useCallback(() => {
    if (!enabled || !clientId) return
    void loadUploadLink(workspaceId, clientId).then(setLoad)
  }, [workspaceId, clientId, enabled])
  useEffect(() => {
    refresh()
    if (!enabled) return
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    window.addEventListener(UPLOAD_CHANGED, refresh)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener(UPLOAD_CHANGED, refresh)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh, enabled])
  const state = load?.status === 'ready' && load.state.role === 'writer' ? load.state : null
  return { state: enabled ? state : null, refresh }
}

/** 서류함 한 줄 — 고객이 올린 서류가 있으면 그것 먼저 */
export function UploadLinkBar({ state, today, onOpen }: { state: Writer; today: string; onOpen: (view: 'inbox' | 'ready') => void }) {
  const waiting = state.files.length
  const link = state.link
  if (waiting === 0 && !link) return null
  const expired = Boolean(link && (link.expired || link.expiresAt.slice(0, 10) < today))
  return (
    <button
      type="button"
      onClick={() => onOpen(waiting > 0 ? 'inbox' : 'ready')}
      className="tap flex min-h-11 w-full items-center gap-2 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2 text-left hover:bg-slate-50"
      data-testid="upload-link-bar"
      data-waiting={waiting}
    >
      {waiting > 0 ? <Inbox aria-hidden="true" className="size-4 shrink-0 text-brand-600" /> : <Link2 aria-hidden="true" className="size-4 shrink-0 text-slate-500" />}
      <span className="t-sub min-w-0 flex-1 truncate text-slate-800">
        {waiting > 0 ? (
          <>
            <b className="font-semibold text-brand-700">고객이 올린 서류 {waiting}개</b> — 칸에 넣기
          </>
        ) : expired ? (
          '올리기 링크 기한이 지났어요'
        ) : (
          `올리기 링크 · ${koDate(link?.expiresAt ?? '')}까지 · 받은 ${link?.uploaded ?? 0}개`
        )}
      </span>
    </button>
  )
}

/** 링크를 처음 만들 때 고를 서류 — 요청해 둔 것 · 진행 업무에 아직 없는 것 먼저 */
export function suggestedUploadDocs(record: ClientOpsRecord, today: string): { picked: DocumentKey[]; options: UploadDoc[] } {
  const metas = allDocumentMetas(record).filter((m) => m.needsFile)
  const want = new Set<string>([...pendingDocKeys(record, today).keys(), ...collectMissingDocuments(record, today).map((l) => l.key)])
  const picked = metas.filter((m) => want.has(m.key)).map((m) => m.key).slice(0, 12)
  const options = [...metas.filter((m) => want.has(m.key)), ...metas.filter((m) => !want.has(m.key))].map((m) => ({ key: m.key, label: m.label }))
  return { picked, options }
}

export function UploadLinkSheet({
  record,
  workspaceId,
  today,
  state,
  initialView,
  onClose,
  onCommit,
  current,
  onLink,
  onSent,
}: {
  record: ClientOpsRecord
  workspaceId: string
  today: string
  state: Writer
  initialView?: 'make' | 'ready' | 'inbox'
  onClose: () => void
  onCommit: (next: ClientOpsRecord) => Promise<boolean>
  /** 지금 화면의 가장 새 기록 */
  current: () => ClientOpsRecord | null
  /** D-656 링크를 만들거나 · 바꾸거나 · 닫았다 — 업체 기록의 사본도 같이(다시 부탁 문구에 주소) */
  onLink?: (link: UploadLinkInfo | null) => void
  /** D-656 문구를 보냈다 — 서류함 '요청한 서류' · 3일 뒤 할 일로 잇는다(성공하면 보일 글 · 실패면 false) */
  onSent?: (text: string) => Promise<string | false>
}) {
  const { showToast } = useToast()
  const [view, setView] = useState<'make' | 'ready' | 'inbox'>(initialView ?? (state.files.length ? 'inbox' : state.link ? 'ready' : 'make'))
  const title = view === 'inbox' ? '고객이 올린 서류' : view === 'make' ? '받을 서류 고르기' : '서류 올리기 링크'
  return (
    <BottomSheet title={title} onClose={onClose}>
      <div className="flex flex-col gap-3" data-testid="upload-link-sheet" data-view={view}>
        {view === 'make' && (
          <MakeView
            record={record}
            workspaceId={workspaceId}
            today={today}
            state={state}
            onDone={() => setView('ready')}
            onCancel={state.link ? () => setView('ready') : undefined}
            onLink={onLink}
          />
        )}
        {view === 'ready' && state.link && (
          <ReadyView record={record} workspaceId={workspaceId} today={today} state={state} onEdit={() => setView('make')} onInbox={() => setView('inbox')} onLink={onLink} onSent={onSent} />
        )}
        {view === 'ready' && !state.link && <MakeView record={record} workspaceId={workspaceId} today={today} state={state} onDone={() => setView('ready')} onLink={onLink} />}
        {view === 'inbox' && (
          <InboxView
            record={record}
            state={state}
            onCommit={onCommit}
            current={current}
            onEmpty={() => (state.link ? setView('ready') : onClose())}
            showToast={showToast}
          />
        )}
      </div>
    </BottomSheet>
  )
}

function MakeView({
  record,
  workspaceId,
  today,
  state,
  onDone,
  onCancel,
  onLink,
}: {
  record: ClientOpsRecord
  workspaceId: string
  today: string
  state: Writer
  onDone: () => void
  onCancel?: () => void
  onLink?: (link: UploadLinkInfo | null) => void
}) {
  const { showToast } = useToast()
  const sug = useMemo(() => suggestedUploadDocs(record, today), [record, today])
  const [picked, setPicked] = useState<Set<string>>(() => new Set(state.link ? state.link.docs.map((d) => d.key) : sug.picked))
  const [days, setDays] = useState<number>(14)
  const [more, setMore] = useState(false)
  const [busy, setBusy] = useState(false)
  const shown = more ? sug.options : sug.options.filter((o, i) => i < 6 || picked.has(o.key))
  const hidden = sug.options.length - shown.length

  const toggle = (key: string) =>
    setPicked((cur) => {
      const next = new Set(cur)
      if (next.has(key)) next.delete(key)
      else if (next.size < UPLOAD_DOCS_MAX) next.add(key)
      return next
    })

  const save = async () => {
    if (busy) return
    setBusy(true)
    try {
      const docs = sug.options.filter((o) => picked.has(o.key))
      const next = await saveUploadLink(workspaceId, record.id, docs, days)
      if (next.role === 'writer') onLink?.(next.link)
      onDone()
    } catch (cause) {
      showToast(uploadErrorText(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <p className="t-sub break-keep text-slate-700">대표님이 휴대폰으로 바로 올려요 · 로그인 없이</p>
      <fieldset className="flex flex-col gap-1" data-testid="upload-link-docs">
        <legend className="sr-only">받을 서류</legend>
        {shown.map((o) => {
          const on = picked.has(o.key)
          return (
            <label key={o.key} className="tap flex min-h-11 cursor-pointer items-center gap-2.5 rounded-(--radius-control) px-2 hover:bg-slate-50" data-testid="upload-link-doc" data-key={o.key}>
              <input type="checkbox" checked={on} onChange={() => toggle(o.key)} className="size-5 shrink-0 accent-brand-600" />
              <span className="t-body min-w-0 truncate text-slate-800">{o.label}</span>
            </label>
          )
        })}
        {hidden > 0 && (
          <button type="button" onClick={() => setMore(true)} className="tap t-sub min-h-11 self-start px-2 font-semibold text-brand-700 hover:underline" data-testid="upload-link-more">
            서류 더 고르기 {hidden}
          </button>
        )}
      </fieldset>
      <div role="group" aria-label="열어 둘 기간" className="flex flex-wrap items-center gap-1.5">
        {UPLOAD_DAYS.map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={days === d}
            onClick={() => setDays(d)}
            className={`tap t-sub min-h-10 rounded-full border px-3.5 font-semibold ${days === d ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}`}
            data-testid="upload-link-days"
            data-days={d}
          >
            {d}일
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={() => void save()} disabled={busy} data-testid="upload-link-save">
          <Link2 aria-hidden="true" className="size-4" />
          {busy ? '만드는 중…' : state.link ? '이대로 고치기' : `링크 만들기${picked.size ? ` · ${picked.size}가지` : ''}`}
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            그만두기
          </Button>
        )}
      </div>
    </>
  )
}

function ReadyView({
  record,
  workspaceId,
  today,
  state,
  onEdit,
  onInbox,
  onLink,
  onSent,
}: {
  record: ClientOpsRecord
  workspaceId: string
  today: string
  state: Writer
  onEdit: () => void
  onInbox: () => void
  onLink?: (link: UploadLinkInfo | null) => void
  onSent?: (text: string) => Promise<string | false>
}) {
  const { showToast } = useToast()
  const link = state.link!
  const url = uploadUrl(link.slug)
  const [confirm, setConfirm] = useState<'rotate' | 'off' | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [sent, setSent] = useState<{ busy: boolean; done: string }>({ busy: false, done: '' })
  const message = uploadRequestText({ contactName: record.contactName, link })
  /** 받을 서류를 골라 둔 링크만 '요청한 서류' 로 잇는다(그 밖의 서류만 받는 링크는 셀 줄이 없다) */
  const canMark = Boolean(onSent && link.docs.length && !link.expired)
  /** D-665 이 문구로 이미 부탁해 둔 열린 요청 — 판을 다시 열어도(다음 날 · 다른 기기) 처음처럼 보이지 않게 */
  const asked = useMemo(() => {
    if (!canMark) return null
    const req = sameOpenRequest(record, requestLinesOf(message).map((l) => l.label))
    return req ? requestProgress(record, req, today) : null
  }, [canMark, record, message, today])

  const copy = async (what: 'msg' | 'url') => {
    const ok = await copyText(what === 'msg' ? message : url)
    if (ok && what === 'msg') setCopied(true)
    showToast(
      ok
        ? what === 'msg'
          ? canMark
            ? '문구를 복사했어요 — 카톡 · 문자에 붙여 보내고 [보냈어요] 를 눌러 주세요'
            : '문구를 복사했어요 — 카톡 · 문자에 붙여 보내세요'
          : '주소를 복사했어요'
        : '복사하지 못했어요 — 주소를 길게 눌러 복사해 주세요',
    )
  }
  const markSent = async () => {
    if (!onSent || sent.busy || sent.done) return
    setSent({ busy: true, done: '' })
    const r = await onSent(message).catch(() => false as const)
    setSent({ busy: false, done: r || '' })
    if (!r) showToast('적지 못했어요 — 다시 눌러 주세요')
  }
  const act = async (kind: 'rotate' | 'off') => {
    if (confirm !== kind) {
      setConfirm(kind)
      return
    }
    setBusy(true)
    try {
      const next = kind === 'rotate' ? await rotateUploadLink(workspaceId, record.id) : await offUploadLink(workspaceId, record.id)
      if (next.role === 'writer') onLink?.(next.link)
      showToast(kind === 'rotate' ? '새 주소를 만들었어요 — 예전 주소는 이제 안 열려요' : '링크를 닫았어요 — 받은 서류는 그대로예요')
      setConfirm(null)
    } catch (cause) {
      showToast(uploadErrorText(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="t-sub h-11 w-full rounded-(--radius-control) border border-slate-300 bg-white px-3 text-slate-800" aria-label="서류 올리기 주소" data-testid="upload-link-url" />
      <div className="flex flex-wrap items-center gap-2">
        <Button variant={copied && canMark && !sent.done ? 'secondary' : 'primary'} onClick={() => void copy('msg')} data-testid="upload-link-copy-msg">
          {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
          카톡 문구 복사
        </Button>
        {canMark && (
          <Button variant={copied && !sent.done ? 'primary' : 'secondary'} disabled={sent.busy || !!sent.done} onClick={() => void markSent()} data-testid="upload-link-sent">
            {sent.done ? <Check aria-hidden="true" className="size-4" /> : null}
            {sent.busy ? '적는 중…' : sent.done ? '보낸 것으로 적음' : asked ? '다시 보냈어요' : '보냈어요'}
          </Button>
        )}
        <button type="button" onClick={() => void copy('url')} className="tap t-sub min-h-10 font-semibold text-brand-700 hover:underline" data-testid="upload-link-copy-url">
          주소만 복사
        </button>
      </div>
      {sent.done ? (
        <p role="status" className="t-sub break-keep text-success-700" data-testid="upload-link-sent-done">
          {sent.done}
        </p>
      ) : (
        asked && (
          <p className={`t-sub break-keep ${!asked.done && asked.waitingDays >= 3 ? 'font-semibold text-danger-700' : 'text-slate-700'}`} data-testid="upload-link-asked" data-days={asked.waitingDays}>
            {asked.done ? '부탁한 서류를 다 받았어요' : `${asked.waitingDays === 0 ? '오늘 부탁함' : `부탁한 지 ${asked.waitingDays}일째`} · 받은 ${asked.got}/${asked.total}`}
          </p>
        )
      )}
      <p className="t-sub text-slate-600" data-testid="upload-link-meta">
        {link.expired ? '기한이 지났어요 — [받을 서류 고치기] 로 다시 열어요' : `${koDate(link.expiresAt)}까지 · 받은 ${link.uploaded}개`} · 서류 {link.docs.length}가지
      </p>
      {state.files.length > 0 && (
        <Button variant="secondary" onClick={onInbox} data-testid="upload-link-to-inbox">
          <Inbox aria-hidden="true" className="size-4" />
          고객이 올린 서류 {state.files.length}개 넣기
        </Button>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-200 pt-2">
        <button type="button" onClick={onEdit} className="tap t-sub min-h-10 font-semibold text-slate-700 hover:underline" data-testid="upload-link-edit">
          받을 서류 고치기
        </button>
        <button type="button" disabled={busy} onClick={() => void act('rotate')} className="tap t-sub min-h-10 font-semibold text-slate-700 hover:underline" data-testid="upload-link-rotate">
          {confirm === 'rotate' ? '예전 주소를 막고 새로 만들기' : '새 주소'}
        </button>
        <button type="button" disabled={busy} onClick={() => void act('off')} className="tap t-sub min-h-10 font-semibold text-danger-700 hover:underline" data-testid="upload-link-off">
          {confirm === 'off' ? '정말 닫기' : '링크 닫기'}
        </button>
      </div>
    </>
  )
}

const INBOX_SHOWN = 5

function InboxView({
  record,
  state,
  onCommit,
  current,
  onEmpty,
  showToast,
}: {
  record: ClientOpsRecord
  state: Writer
  onCommit: (next: ClientOpsRecord) => Promise<boolean>
  current: () => ClientOpsRecord | null
  onEmpty: () => void
  showToast: ReturnType<typeof useToast>['showToast']
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [all, setAll] = useState(false)
  const [chosen, setChosen] = useState<Record<string, string>>({})
  const metas = useMemo(() => allDocumentMetas(record).filter((m) => m.needsFile), [record])
  const files = state.files
  const shown = all ? files : files.slice(0, INBOX_SHOWN)

  useEffect(() => {
    if (files.length === 0 && !busy) onEmpty()
  }, [files.length, busy, onEmpty])

  const preview = async (f: UploadedFile) => {
    const w = window.open('', '_blank')
    const url = await documentFileUrl(f.storagePath)
    if (!url) {
      w?.close()
      showToast('파일을 열지 못했어요 — 잠시 뒤 다시 눌러 주세요')
      return
    }
    if (w) w.location.href = url
    else window.open(url, '_blank')
  }

  /** 파일들을 칸에 넣고 한 번에 저장 — 실패하면 받은 상태로 되돌린다 */
  const accept = async (list: UploadedFile[]) => {
    const base = current() ?? record
    let rec = base
    const taken: UploadedFile[] = []
    const labels: string[] = []
    let entered = 0
    try {
      const { placeUploadedFile } = await import('../../services/uploadLinkAccept')
      for (const f of list) {
        const d = await decideUploadedFile(f.id, 'accepted')
        if (!d.changed) continue
        taken.push(f)
        const out = await placeUploadedFile(rec, f, (chosen[f.id] ?? f.docKey) as DocumentKey | '')
        rec = out.record
        labels.push(out.label)
        entered += out.entered
      }
      if (taken.length === 0) {
        showToast('이미 넣은 서류예요')
        return
      }
      if (!(await onCommit(rec))) throw new Error('save')
      const head = taken.length === 1 ? `'${labels[0]}' 칸에 넣었어요` : `서류 ${taken.length}개를 칸에 넣었어요`
      showToast(`${head}${entered ? ` · 회사 정보 ${entered}개 채움` : ''}`, {
        label: '되돌리기',
        onClick: () => {
          void (async () => {
            if (!(await onCommit(base))) return showToast('되돌리지 못했어요 — 다시 눌러 주세요')
            await Promise.all(taken.map((f) => decideUploadedFile(f.id, 'uploaded').catch(() => null)))
            showToast('되돌렸어요 — 고객이 올린 서류로 다시 보여요')
          })()
        },
      })
    } catch (cause) {
      await Promise.all(taken.map((f) => decideUploadedFile(f.id, 'uploaded').catch(() => null)))
      showToast(cause instanceof Error && cause.message === 'save' ? '서류함에 넣지 못했어요 — 다시 눌러 주세요' : uploadErrorText(cause))
    }
  }

  const run = async (id: string, job: () => Promise<void>) => {
    if (busy) return
    setBusy(id)
    try {
      await job()
    } finally {
      setBusy(null)
    }
  }

  const dismiss = async (f: UploadedFile) => {
    try {
      const d = await decideUploadedFile(f.id, 'dismissed')
      if (!d.changed) return
      showToast(`'${f.fileName}' 은 넣지 않았어요`, {
        label: '되돌리기',
        onClick: () => void decideUploadedFile(f.id, 'uploaded').then(() => showToast('되돌렸어요')).catch(() => showToast('되돌리지 못했어요')),
      })
    } catch (cause) {
      showToast(uploadErrorText(cause))
    }
  }

  return (
    <>
      {files.length > 1 && (
        <Button variant="primary" disabled={Boolean(busy)} onClick={() => void run('all', () => accept(files))} data-testid="upload-inbox-all">
          <Check aria-hidden="true" className="size-4" />
          {busy === 'all' ? '넣는 중…' : `모두 칸에 넣기 · ${files.length}개`}
        </Button>
      )}
      <ul className="flex flex-col" data-testid="upload-inbox">
        {shown.map((f) => (
          <li key={f.id} className="flex flex-col gap-1.5 border-t border-slate-200 py-2.5 first:border-t-0" data-testid="upload-inbox-row" data-id={f.id}>
            <div className="flex items-center gap-2">
              <span className="t-body min-w-0 flex-1 truncate font-semibold text-slate-900" title={f.fileName}>
                {f.fileName}
              </span>
              <span className="t-meta shrink-0 text-slate-500">{sizeText(f.fileSize)}</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <select
                value={chosen[f.id] ?? f.docKey}
                onChange={(e) => setChosen((c) => ({ ...c, [f.id]: e.target.value }))}
                aria-label="넣을 칸"
                className="t-sub h-10 min-w-0 max-w-full flex-1 rounded-(--radius-control) border border-slate-300 bg-white px-2 text-slate-800"
                data-testid="upload-inbox-slot"
              >
                <option value="">알아서 칸 정하기</option>
                {metas.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.label}
                  </option>
                ))}
              </select>
              <Button size="sm" variant="primary" disabled={Boolean(busy)} onClick={() => void run(f.id, () => accept([f]))} data-testid="upload-inbox-accept">
                {busy === f.id ? '넣는 중…' : '넣기'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void preview(f)} data-testid="upload-inbox-view" title="미리 보기">
                보기
              </Button>
              <Button size="sm" variant="ghost" disabled={Boolean(busy)} onClick={() => void run(`x${f.id}`, () => dismiss(f))} data-testid="upload-inbox-dismiss" title="칸에 넣지 않고 목록에서 빼기(파일은 지우지 않아요)">
                빼기
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {!all && files.length > INBOX_SHOWN && (
        <button type="button" onClick={() => setAll(true)} className="tap t-sub min-h-10 self-start font-semibold text-brand-700 hover:underline" data-testid="upload-inbox-more">
          {files.length - INBOX_SHOWN}개 더 보기
        </button>
      )}
    </>
  )
}
