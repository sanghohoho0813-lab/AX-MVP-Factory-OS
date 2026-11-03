/**
 * D-513 쓰던 글 이어 쓰기 — 스레드 · 릴스/틱톡 쓰기 화면이 같이 쓴다(services/marketing/draftSync 규칙).
 *
 *  - 화면을 열 때 한 번 · 다른 창에 갔다 돌아올 때 클라우드 글을 본다(쓰는 중 · 올리는 중에는 보지 않음).
 *  - 고치면 이 기기에 적은 시각을 바로 남기고, 1.2초 멈추면 클라우드에 올린다. 못 올리면 한 줄로 알리고 다음에 다시.
 *  - 팀장 화면 보기(readOnly) · 브라우저 저장 모드에서는 아무것도 하지 않는다(예전처럼 이 기기에만).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { CloudOff, MonitorSmartphone, X } from 'lucide-react'
import { nowIso } from '../../lib/appClock'
import {
  chooseDraft,
  cloudDraftOn,
  loadCloudDraft,
  readLocalAt,
  saveCloudDraft,
  sameDraft,
  whenWhere,
  writeLocalAt,
  type DraftDevice,
  type DraftEnvelope,
  type DraftKind,
} from '../../services/marketing/draftSync'

const DEBOUNCE_MS = 1200

const deviceNow = (): DraftDevice => (typeof window !== 'undefined' && window.innerWidth < 640 ? 'phone' : 'pc')

export interface DraftSyncNote<T> {
  /** 이어서 연 글을 적은 때 · 기기 */
  from: string
  /** 바꾸기 전 이 기기 글 — 비어 있지 않을 때만 [이 기기 글로 되돌리기] */
  prev: T | null
}

export function useDraftSync<T>(opts: {
  kind: DraftKind
  workspaceId: string | null
  readOnly: boolean
  draft: T
  /** 글을 통째로 바꾼다(이 기기 저장까지) */
  replace: (d: T) => void
  /** 주소로 주제 · 글을 들고 왔으면 true — 클라우드 글로 바꾸지 않는다 */
  blocked: boolean
  empty: (d: T) => boolean
  clean: (v: unknown) => T
}) {
  const { kind, workspaceId, readOnly, draft, replace, blocked, empty, clean } = opts
  const on = !readOnly && cloudDraftOn(workspaceId)
  const [note, setNote] = useState<DraftSyncNote<T> | null>(null)
  const [failed, setFailed] = useState(false)
  // 처음 맞추기가 끝나기 전에는 올리지 않는다(빈 글로 클라우드를 덮지 않게)
  const ready = useRef(false)
  // 처음 맞추기 전에 사람이 고치기 시작했으면 클라우드 글로 바꾸지 않는다
  const touched = useRef(false)
  const timer = useRef<number | null>(null)
  const pending = useRef<DraftEnvelope<T> | null>(null)
  // 클라우드에서 가져와 바꾼 글은 '고친 것' 으로 세지 않는다(바로 다시 올리지 않게)
  const skipNext = useRef<T | null>(null)
  const latest = useRef(draft)
  latest.current = draft
  const blockedAtOpen = useRef(blocked)
  const firstDraft = useRef(draft)
  // 화면이 다시 그려질 때마다 바뀌는 함수는 ref 로 — 구독을 다시 걸면 '멈추면 올리기' 가 매번 바로 올라간다
  const fns = useRef({ replace, empty, clean })
  fns.current = { replace, empty, clean }

  const push = useCallback(
    async (env: DraftEnvelope<T>) => {
      if (!workspaceId) return
      try {
        await saveCloudDraft(workspaceId, kind, env)
        if (pending.current === env) pending.current = null
        setFailed(false)
      } catch {
        setFailed(true)
      }
    },
    [kind, workspaceId],
  )

  const flush = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
    const env = pending.current
    if (env) void push(env)
  }, [push])

  /** 클라우드를 보고 더 나중 글이면 그 글로 */
  const pull = useCallback(
    async (first: boolean) => {
      if (!on || !workspaceId) return
      const { replace, empty, clean } = fns.current
      let cloud: DraftEnvelope<T> | null
      try {
        cloud = await loadCloudDraft(workspaceId, kind, clean)
      } catch {
        if (first) ready.current = true
        setFailed(true)
        return
      }
      const local = latest.current
      const choice = chooseDraft({
        local,
        localAt: readLocalAt(kind),
        cloud,
        blocked: first ? blockedAtOpen.current || touched.current : pending.current !== null || timer.current !== null,
        same: sameDraft,
        empty,
      })
      if (choice === 'cloud' && cloud) {
        skipNext.current = cloud.draft
        replace(cloud.draft)
        writeLocalAt(kind, cloud.at)
        setNote({ from: whenWhere(cloud), prev: empty(local) ? null : local })
      } else if (choice === 'push' && first) {
        const at = readLocalAt(kind) || nowIso()
        writeLocalAt(kind, at)
        void push({ draft: local, at, device: deviceNow() })
      }
      if (first) ready.current = true
    },
    [on, workspaceId, kind, push],
  )

  // 열 때 한 번
  useEffect(() => {
    if (!on) return
    void pull(true)
  }, [on]) // eslint-disable-line react-hooks/exhaustive-deps

  // 고칠 때마다 — 적은 시각 바로 · 1.2초 멈추면 클라우드
  useEffect(() => {
    if (!on) return
    if (draft === firstDraft.current && !ready.current) return
    if (skipNext.current !== null && sameDraft(draft, skipNext.current)) {
      skipNext.current = null
      return
    }
    skipNext.current = null
    if (!ready.current) touched.current = true
    const at = nowIso()
    writeLocalAt(kind, at)
    pending.current = { draft, at, device: deviceNow() }
    if (!ready.current) return
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      timer.current = null
      const env = pending.current
      if (env) void push(env)
    }, DEBOUNCE_MS)
  }, [draft]) // eslint-disable-line react-hooks/exhaustive-deps

  // 처음 맞추기가 끝난 뒤 그 사이 고친 것이 있으면 올린다
  useEffect(() => {
    if (!on) return
    const id = window.setInterval(() => {
      if (ready.current && pending.current && timer.current === null) void push(pending.current)
    }, 5000)
    return () => window.clearInterval(id)
  }, [on, push])

  // 다른 창에 갔다 돌아오면 · 인터넷이 다시 되면
  useEffect(() => {
    if (!on) return
    const onVisible = () => {
      if (document.visibilityState === 'visible') void pull(false)
      else flush()
    }
    const onOnline = () => {
      if (pending.current) void push(pending.current)
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('pagehide', flush)
    }
  }, [on, pull, push, flush])

  // 화면을 떠날 때 기다리던 글을 바로 올린다
  const flushRef = useRef(flush)
  flushRef.current = flush
  useEffect(() => () => flushRef.current(), [])

  const undo = useCallback(() => {
    if (note?.prev) fns.current.replace(note.prev)
    setNote(null)
  }, [note])

  return { on, note, failed, undo, dismiss: () => setNote(null) }
}

/** 쓰기 화면 맨 위 한 줄 — 이어서 열었을 때 · 못 올렸을 때만(평소에는 아무것도 없다) */
export function DraftSyncLine<T>({ sync, testPrefix }: { sync: ReturnType<typeof useDraftSync<T>>; testPrefix: string }) {
  if (!sync.on || (!sync.note && !sync.failed)) return null
  return (
    <div className="flex flex-col gap-1.5" data-testid={`${testPrefix}-sync`}>
      {sync.note && (
        <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2" data-testid={`${testPrefix}-sync-note`}>
          <MonitorSmartphone aria-hidden="true" className="size-4 shrink-0 text-brand-700" />
          <span className="t-sub min-w-0 flex-1 basis-48 break-keep text-slate-800">
            <b className="font-bold text-slate-900">다른 기기에서 쓰던 글</b>을 이어서 열었어요 · {sync.note.from}
          </span>
          {sync.note.prev && (
            <button type="button" onClick={sync.undo} data-testid={`${testPrefix}-sync-undo`} className="tap t-sub inline-flex min-h-10 shrink-0 items-center rounded-(--radius-control) border border-slate-200 bg-white px-3 font-semibold text-slate-700 hover:bg-slate-50">
              이 기기 글로 되돌리기
            </button>
          )}
          <button type="button" aria-label="알림 닫기" onClick={sync.dismiss} data-testid={`${testPrefix}-sync-close`} className="tap inline-flex size-10 shrink-0 items-center justify-center rounded-(--radius-control) text-slate-500 hover:bg-slate-50">
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
      )}
      {sync.failed && (
        <p role="status" className="t-sub flex items-center gap-1.5 break-keep text-slate-700" data-testid={`${testPrefix}-sync-failed`}>
          <CloudOff aria-hidden="true" className="size-4 shrink-0 text-slate-500" />
          인터넷이 불안해 쓰던 글을 이 기기에만 남겼어요 — 연결되면 다시 올려요.
        </p>
      )}
    </div>
  )
}
