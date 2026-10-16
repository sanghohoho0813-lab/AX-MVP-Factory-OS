/**
 * 업체 홈페이지 한 장 읽기 · 저장 · 되돌리기 (D-202).
 *
 * 저장: 모듈 기록(moduleData) 'homepage' 상자 · 'site' 갈래 — 업체마다 한 줄(clientId). 클라우드 모드면 module_data 표,
 * 아니면 이 브라우저. DB 를 새로 만들지 않는다(이미 있는 추가 전용 표).
 * 고치면 0.7초 뒤 저장(타자 중에는 기다렸다가 한 번). 저장이 겹치지 않게 줄을 세운다.
 * 되돌리기: 이 화면에 있는 동안 50번까지. 같은 칸을 이어서 치는 것은 한 번으로 묶는다.
 * D-208 고침: 저장이 실패하면 5초 · 15초 · 30초 · 60초 뒤 다시 저장(그 사이 또 고치면 그것까지). 실패한 채 창을 닫으려 하면 묻는다.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { listRows, saveRow } from '../../services/moduleData'
import { normalizeSiteDoc, type SiteDoc } from '../../services/siteBuilder'

export const SITE_MODULE = 'homepage'
export const SITE_BUCKET = 'site'
const SAVE_DELAY = 700
const UNDO_LIMIT = 50
const RETRY_MS = [5000, 15000, 30000, 60000]

export type SaveState = 'saved' | 'pending' | 'saving' | 'error'

export interface SiteStore {
  status: 'loading' | 'ready' | 'error'
  doc: SiteDoc | null
  save: SaveState
  /** 고친 것 반영 — group 이 같으면(같은 칸 이어 치기) 되돌리기 한 번으로 묶는다 */
  change: (next: SiteDoc, group?: string) => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  /** 지금 바로 저장(내려받기 · 붙이기 전에) */
  flush: () => Promise<boolean>
}

export function useSiteDoc(clientId: string | null, workspaceId: string | null): SiteStore {
  const [status, setStatus] = useState<SiteStore['status']>('loading')
  const [doc, setDoc] = useState<SiteDoc | null>(null)
  const [save, setSave] = useState<SaveState>('saved')
  // 되돌리기 기록은 ref 에 — 상태 갱신 함수 안에서 다른 상태를 바꾸지 않게(개발 모드는 갱신 함수를 두 번 부른다)
  const hist = useRef<{ undo: SiteDoc[]; redo: SiteDoc[] }>({ undo: [], redo: [] })
  const [, setHistVersion] = useState(0)
  const bump = () => setHistVersion((v) => v + 1)
  const rowId = useRef<string | null>(null)
  const latest = useRef<SiteDoc | null>(null)
  const timer = useRef<number | null>(null)
  const chain = useRef<Promise<boolean>>(Promise.resolve(true))
  const lastGroup = useRef<{ key: string; at: number } | null>(null)
  const retry = useRef<{ timer: number | null; n: number }>({ timer: null, n: 0 })

  useEffect(() => {
    let alive = true
    setStatus('loading')
    setDoc(null)
    hist.current = { undo: [], redo: [] }
    bump()
    rowId.current = null
    latest.current = null
    if (!clientId) {
      setStatus('ready')
      return
    }
    listRows(workspaceId, SITE_MODULE, SITE_BUCKET)
      .then((rows) => {
        if (!alive) return
        const row = rows.filter((r) => r.clientId === clientId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
        const d = row ? normalizeSiteDoc((row.data as { doc?: unknown }).doc) : null
        rowId.current = row?.id ?? null
        latest.current = d
        setDoc(d)
        setStatus('ready')
      })
      .catch(() => {
        if (alive) setStatus('error')
      })
    return () => {
      alive = false
    }
  }, [clientId, workspaceId])

  const write = useCallback((): Promise<boolean> => {
    const d = latest.current
    if (!d || !clientId) return Promise.resolve(true)
    chain.current = chain.current.then(async () => {
      setSave('saving')
      try {
        const row = await saveRow(workspaceId, SITE_MODULE, SITE_BUCKET, { id: rowId.current ?? undefined, clientId, data: { doc: d } })
        rowId.current = row.id
        retry.current.n = 0
        // 저장하는 동안 또 고쳤으면 기다리는 중으로 남긴다
        setSave(latest.current === d ? 'saved' : 'pending')
        return true
      } catch {
        setSave('error')
        // 잠시 뒤 다시 — 네 번까지(그 뒤에는 [지금 다시 저장] 단추)
        if (retry.current.timer === null && retry.current.n < RETRY_MS.length) {
          const wait = RETRY_MS[retry.current.n]
          retry.current.n += 1
          retry.current.timer = window.setTimeout(() => {
            retry.current.timer = null
            void writeRef.current()
          }, wait)
        }
        return false
      }
    })
    return chain.current
  }, [clientId, workspaceId])
  const writeRef = useRef(write)
  writeRef.current = write

  // 저장에 실패한 채 창을 닫으려 하면 묻는다(0.7초 대기 중은 화면을 떠날 때 마저 저장하므로 묻지 않는다)
  useEffect(() => {
    if (save !== 'error') return
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [save])

  // 화면을 떠나면 다시 저장 예약을 지운다
  useEffect(
    () => () => {
      if (retry.current.timer !== null) window.clearTimeout(retry.current.timer)
      retry.current.timer = null
    },
    [],
  )

  const schedule = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current)
    setSave('pending')
    timer.current = window.setTimeout(() => {
      timer.current = null
      void write()
    }, SAVE_DELAY)
  }, [write])

  const flush = useCallback(async () => {
    if (timer.current) {
      window.clearTimeout(timer.current)
      timer.current = null
      return write()
    }
    // 실패한 채 남아 있으면 지금 다시
    if (retry.current.timer !== null) {
      window.clearTimeout(retry.current.timer)
      retry.current.timer = null
    }
    const ok = await chain.current
    if (!ok) {
      retry.current.n = 0
      return write()
    }
    return ok
  }, [write])

  // 화면을 떠날 때 기다리던 저장을 마저 한다
  useEffect(
    () => () => {
      if (timer.current) {
        window.clearTimeout(timer.current)
        timer.current = null
        void write()
      }
    },
    [write],
  )

  const change = useCallback(
    (next: SiteDoc, group?: string) => {
      const prev = latest.current
      const nowMs = Date.now()
      const same = group && lastGroup.current && lastGroup.current.key === group && nowMs - lastGroup.current.at < 1500
      lastGroup.current = group ? { key: group, at: nowMs } : null
      hist.current = { undo: prev && !same ? [...hist.current.undo, prev].slice(-UNDO_LIMIT) : hist.current.undo, redo: [] }
      bump()
      latest.current = next
      setDoc(next)
      schedule()
    },
    [schedule],
  )

  const step = useCallback(
    (dir: 'undo' | 'redo') => {
      const h = hist.current
      const from = dir === 'undo' ? h.undo : h.redo
      if (!from.length || !latest.current) return
      const target = from[from.length - 1]
      const cur = latest.current
      hist.current = dir === 'undo' ? { undo: h.undo.slice(0, -1), redo: [...h.redo, cur] } : { undo: [...h.undo, cur], redo: h.redo.slice(0, -1) }
      latest.current = target
      lastGroup.current = null
      setDoc(target)
      bump()
      schedule()
    },
    [schedule],
  )
  const undo = useCallback(() => step('undo'), [step])
  const redo = useCallback(() => step('redo'), [step])

  return { status, doc, save, change, undo, redo, canUndo: hist.current.undo.length > 0, canRedo: hist.current.redo.length > 0, flush }
}
