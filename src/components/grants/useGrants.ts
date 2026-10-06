/**
 * 지원사업 알림 — 불러오기 · 알리기(카톡 문구 · 찾기 링크 · 고객 화면) (D-141).
 * 알림 화면 · 업체 상세 · 오늘이 같은 동작을 쓴다. 알릴 때마다 '보낸 기록' 을 남긴다(다시 보낼 때 날짜가 보인다).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { brand } from '../../brand/brand.config'
import { listLinks, publishUpdate } from '../../services/customerBridgeService'
import { listNotices, listSent, recordSent, type SentChannel, type SentRecord } from '../../services/grants/grantStore'
import type { GrantMatch, GrantNotice } from '../../services/grants/grantMatch'
import { noticeMessage, shareMessage } from '../../services/grants/grantText'
import { profileLine } from '../../services/grants/grantProfile'
import { copyText, finderLink, fitSummary, grantClients, grantIndex, type GrantClient } from '../../services/grants/grantView'
import type { ClientOpsRecord } from '../../types/clientOps'
import { mergeNotices, useGrantFeed } from '../../services/grants/grantFeed'
import type { PortalClientLink } from '../../types/bridge'
import { useIsPilot } from '../../auth/osAccess'

export function useGrantData(workspaceId: string | null) {
  const [notices, setNotices] = useState<GrantNotice[]>([])
  const [sent, setSent] = useState<SentRecord[]>([])
  const [links, setLinks] = useState<PortalClientLink[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  // D-165: 작업공간이 바뀌면 앞 작업공간의 늦은 답은 버린다(새 목록을 덮지 않게)
  const latest = useRef(0)
  const reload = useCallback(async () => {
    const ticket = ++latest.current
    try {
      const [n, s, l] = await Promise.all([listNotices(workspaceId), listSent(workspaceId).catch(() => [] as SentRecord[]), listLinks(workspaceId).catch(() => [] as PortalClientLink[])])
      if (ticket !== latest.current) return
      setNotices(n)
      setSent(s)
      setLinks(l)
      setError('')
    } catch (cause) {
      if (ticket !== latest.current) return
      setError(cause instanceof Error ? cause.message : '지원사업 공고를 불러오지 못했습니다.')
    } finally {
      if (ticket === latest.current) setLoaded(true)
    }
  }, [workspaceId])
  useEffect(() => {
    void reload()
  }, [reload])
  const linkOf = useCallback((clientId: string) => links.find((l) => l.operationsClientId === clientId && l.status === 'active') ?? null, [links])
  // D-143: 기업마당에서 받은 공고(모든 화면이 같은 것을 같이 쓴다)를 직접 넣은 공고와 합친다
  const feed = useGrantFeed()
  const all = useMemo(() => mergeNotices(notices, feed.notices), [notices, feed.notices])
  return { notices: all, manualNotices: notices, setNotices, sent, setSent, links, linkOf, loaded, error, reload, feed }
}

export interface ClientGrantSummary {
  fit: number
  check: number
  urgentFit: number
}

/**
 * 고객 관리 · 영업 보드 · 미팅 준비 — 업체마다 '맞는 지원사업 N건' (D-143).
 * 공고는 같은 저장소(기업마당 하루 한 번 + 직접 넣은 공고)에서, 업체 × 공고 계산은 한 번만.
 */
export function useClientGrantSummaries(workspaceId: string | null, records: readonly ClientOpsRecord[], today: string): Map<string, ClientGrantSummary> {
  const [manual, setManual] = useState<GrantNotice[]>([])
  useEffect(() => {
    let alive = true
    listNotices(workspaceId)
      .then((n) => alive && setManual(n))
      .catch(() => {
        // 직접 넣은 공고를 못 읽어도 기업마당 공고로 센다
      })
    return () => {
      alive = false
    }
  }, [workspaceId])
  const feed = useGrantFeed()
  const notices = useMemo(() => mergeNotices(manual, feed.notices), [manual, feed.notices])
  const clients = useMemo(() => grantClients(records as ClientOpsRecord[], today), [records, today])
  return useMemo(() => {
    const out = new Map<string, ClientGrantSummary>()
    if (notices.length === 0 || clients.length === 0) return out
    const index = grantIndex(notices, clients, today)
    for (const [id, ms] of index.byClient) {
      const s = fitSummary(ms)
      out.set(id, { fit: s.fit, check: s.check, urgentFit: s.urgentFit })
    }
    return out
  }, [notices, clients, today])
}

const md = (ymd: string) => (ymd ? `${Number(ymd.slice(5, 7))}월 ${Number(ymd.slice(8, 10))}일` : '')

export function useGrantActions(o: {
  workspaceId: string | null
  setSent: (fn: (prev: SentRecord[]) => SentRecord[]) => void
  linkOf: (clientId: string) => PortalClientLink | null
  toast: (msg: string) => void
}) {
  const { workspaceId, setSent, linkOf, toast } = o
  // D-162: 공개 찾기 화면의 알림 신청은 대표 상담신청함으로 들어간다 — Pilot 은 그 링크를 나누지 않는다
  const pilot = useIsPilot()
  const remember = useCallback(
    async (clientId: string, ids: string[], channel: SentChannel) => {
      try {
        const rec = await recordSent(workspaceId, clientId, ids, channel)
        setSent((prev) => [rec, ...prev])
      } catch {
        // 보낸 기록을 못 남겨도 문구 복사는 된 것이다
      }
    },
    [workspaceId, setSent],
  )

  const copyNotice = useCallback(
    async (client: GrantClient, match: GrantMatch) => {
      const ok = await copyText(noticeMessage({ companyName: client.record.companyName, match, sender: brand.brandNameKo }))
      toast(ok ? `${client.record.companyName} — 카톡 문구를 복사했습니다` : '복사하지 못했습니다')
      if (ok) await remember(client.record.id, [match.notice.id], 'kakao')
    },
    [remember, toast],
  )

  const copyAll = useCallback(
    async (client: GrantClient, matches: GrantMatch[]) => {
      const link = pilot ? '' : finderLink(window.location.origin, client.profile)
      const text = shareMessage({ companyName: client.record.companyName, profileLine: profileLine(client.profile), matches, link, sender: brand.brandNameKo })
      const ok = await copyText(text)
      toast(ok ? `${client.record.companyName} — 맞는 공고 ${matches.length}건 문구를 복사했습니다` : '복사하지 못했습니다')
      if (ok) await remember(client.record.id, matches.slice(0, 5).map((m) => m.notice.id), 'kakao')
    },
    [remember, toast, pilot],
  )

  const copyLink = useCallback(
    async (client: GrantClient | null) => {
      if (pilot) return
      const ok = await copyText(finderLink(window.location.origin, client?.profile ?? null))
      toast(ok ? (client ? `${client.record.companyName} 조건으로 찾기 링크를 복사했습니다` : '지원사업 찾기 링크를 복사했습니다') : '복사하지 못했습니다')
      if (ok && client) await remember(client.record.id, [], 'link')
    },
    [remember, toast, pilot],
  )

  /** 계약 고객(고객 화면 계정이 연결된 업체) — 고객 화면 '안내' 로 올린다 */
  const toPortal = useCallback(
    async (client: GrantClient, matches: GrantMatch[]) => {
      const link = linkOf(client.record.id)
      if (!link || matches.length === 0) return
      const one = matches.length === 1 ? matches[0] : null
      const title = one ? `맞는 지원사업: ${one.notice.title}`.slice(0, 120) : `맞는 지원사업 ${matches.length}건이 있습니다`
      const body = (one ? [one] : matches.slice(0, 8))
        .map((m) => `· ${m.notice.title} — ${m.deadline.label}${m.notice.applyEnd ? ` (${md(m.notice.applyEnd)})` : ''}${m.verdict === 'check' ? ' · 확인 필요' : ''}${m.notice.url ? `\n  ${m.notice.url}` : ''}`)
        .join('\n')
      const due = matches.map((m) => m.notice.applyEnd).filter(Boolean).sort()[0] ?? ''
      try {
        await publishUpdate(workspaceId, {
          linkId: link.id,
          category: 'notice',
          title,
          body: `${body}\n\n신청을 원하시면 이 화면에서 '추가 상담' 으로 남겨 주세요. 서류 준비부터 도와드립니다.`,
          customerActionRequired: false,
          dueDate: due,
        })
        toast(`${client.record.companyName} 고객 화면에 올렸습니다`)
        await remember(client.record.id, matches.map((m) => m.notice.id), 'portal')
      } catch (cause) {
        toast(cause instanceof Error ? cause.message : '고객 화면에 올리지 못했습니다')
      }
    },
    [linkOf, workspaceId, remember, toast],
  )

  return { copyNotice, copyAll, copyLink: pilot ? null : copyLink, toPortal }
}
