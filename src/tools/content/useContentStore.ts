/**
 * 홍보 글 만들기 저장소 (D-203) — 업체 하나의 고친 홍보 정보 · 보관함 글 · 홈페이지(있으면) 읽기 · 쓰기.
 *
 * 저장: 모듈 기록(moduleData) 'content' 상자 — 'profile'(업체마다 한 줄) · 'items'(글 한 편 = 한 줄).
 * 홈페이지(D-202)는 읽기만 한다('하는 일' 목록을 홍보 정보에 쓰려고).
 * 쓰기는 줄을 세워 한 번에 하나씩 — 빠르게 두 번 눌러도 순서가 섞이지 않는다.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { deleteRow, listRows, saveRow } from '../../services/moduleData'
import {
  CONTENT_MODULE,
  ITEMS_BUCKET,
  PROFILE_BUCKET,
  contentHash,
  itemData,
  nextVersion,
  normalizeItem,
  titleOf,
  normalizeOverrides,
  sameContent,
  withPosted,
  type ContentItem,
  type Draft,
  type DraftBlock,
  type ProfileOverrides,
} from '../../services/contentStudio'
import { normalizeSiteDoc, type SiteDoc } from '../../services/siteBuilder'
import { nowIso } from '../../lib/appClock'
import { generateId } from '../../storage/localStore'
import { SITE_BUCKET, SITE_MODULE } from '../homepage/useSiteDoc'
import { rowSubjectId, subjectRow } from '../../services/marketingTrial'

/** D-221 같은 글에 계획 칸을 달 때 — 올릴 날과 함께 계획(시작 · 주 몇 회)도 */
const planOf = (i: Draft['input']) => ({ planDate: i.planDate, ...(i.planStart && i.planPer ? { planStart: i.planStart, planPer: i.planPer } : {}) })

export interface ContentStore {
  status: 'loading' | 'ready' | 'error'
  overrides: ProfileOverrides
  items: ContentItem[]
  site: SiteDoc | null
  saveOverrides: (ov: ProfileOverrides) => Promise<boolean>
  /** 새 글 넣기 — 같은 글이 있으면 그것을 돌려주고 dup=true */
  addDraft: (d: Draft, blocks?: DraftBlock[]) => Promise<{ item: ContentItem; dup: boolean } | null>
  /** 고친 글을 같은 사슬의 새 판으로 */
  saveVersion: (base: ContentItem, blocks: DraftBlock[]) => Promise<ContentItem | null>
  toggleFavorite: (rootId: string) => Promise<boolean>
  /** D-208 여러 편을 한 번에(상황 묶음 · 한 달 치) — 같은 글은 건너뛴다. 계획 날짜가 없는 같은 글에는 날짜만 단다 */
  addMany: (ds: Draft[]) => Promise<{ items: (ContentItem | null)[]; added: number; dup: number; failed: number }>
  /** D-208 올렸어요 / 아직 */
  setPosted: (rootId: string, on: boolean) => Promise<boolean>
  removeChain: (rootId: string) => Promise<boolean>
}

export function useContentStore(clientId: string | null, workspaceId: string | null): ContentStore {
  const [status, setStatus] = useState<ContentStore['status']>('loading')
  const [overrides, setOverrides] = useState<ProfileOverrides>({})
  const [items, setItems] = useState<ContentItem[]>([])
  const [site, setSite] = useState<SiteDoc | null>(null)
  const profileRowId = useRef<string | null>(null)
  const itemsRef = useRef<ContentItem[]>([])
  const chain = useRef<Promise<unknown>>(Promise.resolve())

  const setAll = (list: ContentItem[]) => {
    itemsRef.current = list
    setItems(list)
  }

  useEffect(() => {
    let alive = true
    setStatus('loading')
    profileRowId.current = null
    setAll([])
    setOverrides({})
    setSite(null)
    if (!clientId) {
      setStatus('ready')
      return
    }
    Promise.all([
      listRows(workspaceId, CONTENT_MODULE, PROFILE_BUCKET),
      listRows(workspaceId, CONTENT_MODULE, ITEMS_BUCKET),
      listRows(workspaceId, SITE_MODULE, SITE_BUCKET).catch(() => []),
    ])
      .then(([profiles, rows, sites]) => {
        if (!alive) return
        // D-220: 가상 업체 · 컨설턴트 줄은 업체 칸이 비고 내용에 가상 id 가 있다
        const prof = profiles.find((r) => rowSubjectId(r) === clientId)
        profileRowId.current = prof?.id ?? null
        setOverrides(normalizeOverrides(prof?.data.overrides))
        setAll(
          rows
            .filter((r) => rowSubjectId(r) === clientId)
            .map((r) => normalizeItem(r.id, r.data, r.createdAt, r.updatedAt))
            .filter((x): x is ContentItem => !!x),
        )
        const s = sites.find((r) => rowSubjectId(r) === clientId)
        setSite(s ? normalizeSiteDoc(s.data.doc) : null)
        setStatus('ready')
      })
      .catch(() => alive && setStatus('error'))
    return () => {
      alive = false
    }
  }, [clientId, workspaceId])

  /** 쓰기 줄 세우기 */
  const queue = useCallback(<T,>(job: () => Promise<T>): Promise<T> => {
    const next = chain.current.then(job, job)
    chain.current = next.catch(() => undefined)
    return next
  }, [])

  const saveOverrides = useCallback(
    (ov: ProfileOverrides) =>
      queue(async () => {
        if (!clientId) return false
        const clean = normalizeOverrides(ov)
        try {
          const row = await saveRow(workspaceId, CONTENT_MODULE, PROFILE_BUCKET, { id: profileRowId.current ?? undefined, ...subjectRow(clientId, { overrides: clean }) })
          profileRowId.current = row.id
          setOverrides(clean)
          return true
        } catch {
          return false
        }
      }),
    [clientId, workspaceId, queue],
  )

  const put = useCallback(
    async (item: ContentItem): Promise<ContentItem> => {
      const row = await saveRow(workspaceId, CONTENT_MODULE, ITEMS_BUCKET, { id: item.id, ...subjectRow(clientId ?? '', itemData(item)) })
      const saved = { ...item, id: row.id, updatedAt: row.updatedAt }
      setAll([...itemsRef.current.filter((x) => x.id !== saved.id), saved])
      return saved
    },
    [clientId, workspaceId],
  )

  const addDraft = useCallback(
    (d: Draft, blocks?: DraftBlock[]) =>
      queue(async () => {
        if (!clientId) return null
        const bl = blocks ?? d.blocks
        const dup = sameContent(itemsRef.current, d.kind, bl)
        const plan = d.input.planDate
        // D-208 고침: 계획 칸에서 만든 글 — 날짜 없는 같은 글이면 날짜만 달고, 다른 날 계획의 같은 글이면 새로 넣는다
        if (dup && plan && !dup.input.planDate) {
          try {
            return { item: await put({ ...dup, input: { ...dup.input, ...planOf(d.input) } }), dup: true }
          } catch {
            return null
          }
        }
        if (dup && !(plan && dup.input.planDate !== plan)) return { item: dup, dup: true }
        const id = generateId()
        const now = nowIso()
        const item: ContentItem = { id, kind: d.kind, title: titleOf(bl, d.title), blocks: bl, input: d.input, rootId: id, version: 1, favorite: false, hash: contentHash(d.kind, bl), createdAt: now, updatedAt: now }
        try {
          return { item: await put(item), dup: false }
        } catch {
          return null
        }
      }),
    [clientId, put, queue],
  )

  const saveVersion = useCallback(
    (base: ContentItem, blocks: DraftBlock[]) =>
      queue(async () => {
        if (contentHash(base.kind, blocks) === base.hash) return base
        const v = nextVersion(itemsRef.current, base, blocks, generateId(), nowIso())
        try {
          return await put(v)
        } catch {
          return null
        }
      }),
    [put, queue],
  )

  const toggleFavorite = useCallback(
    (rootId: string) =>
      queue(async () => {
        const list = itemsRef.current.filter((x) => x.rootId === rootId)
        if (!list.length) return false
        const on = !list.some((x) => x.favorite)
        const latest = [...list].sort((a, b) => b.version - a.version)[0]
        try {
          for (const it of list) {
            const want = on ? it.id === latest.id : false
            if (it.favorite !== want) await put({ ...it, favorite: want })
          }
          return true
        } catch {
          return false
        }
      }),
    [put, queue],
  )

  const removeChain = useCallback(
    (rootId: string) =>
      queue(async () => {
        const list = itemsRef.current.filter((x) => x.rootId === rootId)
        try {
          for (const it of list) {
            await deleteRow(workspaceId, CONTENT_MODULE, ITEMS_BUCKET, it.id)
            setAll(itemsRef.current.filter((x) => x.id !== it.id))
          }
          return true
        } catch {
          return false
        }
      }),
    [workspaceId, queue],
  )

  const addMany = useCallback(
    (ds: Draft[]) =>
      queue(async () => {
        const out = { items: [] as (ContentItem | null)[], added: 0, dup: 0, failed: 0 }
        if (!clientId) return { ...out, items: ds.map(() => null), failed: ds.length }
        for (const d of ds) {
          try {
            const dup = sameContent(itemsRef.current, d.kind, d.blocks)
            const plan = d.input.planDate
            // D-208 고침: 다른 날 계획에 이미 쓴 같은 글이면 건너뛰지 않고 그 날짜로 새로 넣는다(건너뛰면 칸이 영영 빈다)
            if (dup && !(plan && dup.input.planDate && dup.input.planDate !== plan)) {
              out.dup += 1
              out.items.push(plan && !dup.input.planDate ? await put({ ...dup, input: { ...dup.input, ...planOf(d.input) } }) : dup)
              continue
            }
            const id = generateId()
            const now = nowIso()
            out.items.push(await put({ id, kind: d.kind, title: titleOf(d.blocks, d.title), blocks: d.blocks, input: d.input, rootId: id, version: 1, favorite: false, hash: contentHash(d.kind, d.blocks), createdAt: now, updatedAt: now }))
            out.added += 1
          } catch {
            out.items.push(null)
            out.failed += 1
          }
        }
        return out
      }),
    [clientId, put, queue],
  )

  const setPosted = useCallback(
    (rootId: string, on: boolean) =>
      queue(async () => {
        try {
          const list = withPosted(itemsRef.current, rootId, on ? nowIso() : null)
          if (!list.length) return false
          for (const it of list) await put(it)
          return true
        } catch {
          return false
        }
      }),
    [put, queue],
  )

  return { status, overrides, items, site, saveOverrides, addDraft, saveVersion, toggleFavorite, removeChain, addMany, setPosted }
}
