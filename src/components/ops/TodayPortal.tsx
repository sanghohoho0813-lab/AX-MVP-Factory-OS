/**
 * D-681 오늘 — 고객 화면(My MIRAE) 챙길 것. 보고서 안 열어 봄 3일 · 경과 보고 14일 공백 · 연결 뒤 첫 방문 없음 3일 ·
 * 가입 안내 뒤 연결 없음 3일 · 30일 안 오심. 있을 때만 단추 하나 → 판(업체마다 한 줄 · [열기] → 그 업체 고객 플랫폼 탭).
 * 내부에만 뜬다 — 고객에게 저절로 보내지 않는다. 조건이 풀리면(열어 봄 · 새 보고서 · 첫 방문) 저절로 빠진다.
 * 0033 을 아직 넣지 않았거나(읽기 실패) 연습 모드면 아무것도 그리지 않는다(연습 모드에는 고객 방문 기록이 없다).
 * D-685 0034 가 있으면 '공유한 결과 자료 7일째 안 열어 보심' 줄도(없으면 그 줄만 빠진다).
 * D-689 0036 이 있으면 '추천에 관심 있다고 하셨어요 — 연락드려 주세요' 줄을 맨 앞에(연락했어요 · 안부 연락 날 뒤의 관심만 · 없으면 그 줄만 빠진다).
 */
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { ArrowRight, UserRoundCheck } from 'lucide-react'
import type { ClientOpsRecord } from '../../types/clientOps'
import { contractStageOf } from '../../types/clientOps'
import type { PortalClientLink } from '../../types/bridge'
import { BottomSheet } from '../ui/primitives'
import { getDataModeConfig } from '../../data/dataMode'
import { listLinks } from '../../services/customerBridgeService'
import { listPublishedReports, listSharedResults, listWorkspaceReceipts, resultReceiptsSince, type PortalReceipt, type SharedResult } from '../../services/portalGrowth'
import { currentTermEnd } from '../../services/contractRenewal'
import { followUpReportKind, hasActiveWork, portalFollowUps, type PortalFollowUp, type PortalReportKind, type PortalSeen } from '../../services/portalGrowthRules'
import { listRecoInterests, listShownRecos, type PortalReco, type PortalRecoInterest } from '../../services/portalReco'
import { recoInterestFollowUps } from '../../services/portalRecoRules'

const SHOW = 5

interface Loaded {
  links: PortalClientLink[]
  reports: { id: string; clientId: string; status: 'published' | 'superseded' | 'withdrawn'; publishedAt: string; kind?: PortalReportKind }[]
  receipts: PortalReceipt[]
  /** D-685 공유한 결과 자료 · 기록을 남기기 시작한 때(0034 없으면 null · 빈 목록) */
  results: SharedResult[]
  resultsSince: string | null
  /** D-689 올라와 있는 추천 · 고객이 누른 [관심 있어요](0036 없으면 빈 목록) */
  recos: PortalReco[]
  interests: PortalRecoInterest[]
}

export function usePortalFollowUps(workspaceId: string | null, clients: readonly ClientOpsRecord[], today: string): PortalFollowUp[] {
  const [data, setData] = useState<Loaded | null>(null)
  useEffect(() => {
    if (getDataModeConfig().mode === 'local' || !workspaceId) return
    let alive = true
    Promise.all([listLinks(workspaceId), listPublishedReports(workspaceId), listWorkspaceReceipts(workspaceId), resultReceiptsSince()])
      .then(async ([links, reports, receipts, resultsSince]) => {
        // D-685 결과 자료는 0034 가 있을 때만 읽는다(못 읽어도 다른 줄은 그대로)
        const results = resultsSince ? await listSharedResults(workspaceId, links).catch(() => []) : []
        // D-689 추천 · 관심은 0036 이 있을 때만(못 읽어도 다른 줄은 그대로)
        const [recos, interests] = await Promise.all([listShownRecos(workspaceId).catch(() => []), listRecoInterests(workspaceId).catch(() => [])])
        if (alive) setData({ links, reports, receipts, results, resultsSince, recos, interests })
      })
      .catch(() => alive && setData(null))
    return () => {
      alive = false
    }
  }, [workspaceId])
  return useMemo(() => {
    if (!data) return []
    const byClient = new Map<string, PortalClientLink[]>()
    for (const l of data.links) byClient.set(l.operationsClientId, [...(byClient.get(l.operationsClientId) ?? []), l])
    const homeSeen = new Map<string, PortalSeen>()
    const reportSeen = new Set<string>()
    const resultSeen = new Set<string>()
    for (const r of data.receipts) {
      if (r.itemKind === 'home') homeSeen.set(r.linkId, { first: r.firstSeenAt, last: r.lastSeenAt })
      else if (r.itemKind === 'report') reportSeen.add(r.itemId)
      else resultSeen.add(r.itemId)
    }
    const out: PortalFollowUp[] = []
    const hot: PortalFollowUp[] = []
    for (const c of clients) {
      if (c.archivedAt) continue
      // D-689 관심 있다고 하신 곳 — 연결 · 안내 여부와 상관없이(관심은 연결된 고객만 누를 수 있다)
      const recos = data.recos.filter((r) => r.clientId === c.id)
      if (recos.length) hot.push(...recoInterestFollowUps({ clientId: c.id, recos, interests: data.interests.filter((i) => i.clientId === c.id), lastContactAt: c.care?.lastContactAt ?? null }, today))
      const links = byClient.get(c.id) ?? []
      if (!links.length && !c.portalInvite?.at) continue
      out.push(
        ...portalFollowUps(
          {
            clientId: c.id,
            invitedAt: c.portalInvite?.at ?? null,
            links: links.map((l) => ({ id: l.id, status: l.status, linkedAt: l.linkedAt, profileEmail: l.profileEmail })),
            homeSeen,
            reports: data.reports.filter((r) => r.clientId === c.id),
            reportSeen,
            activeWork: hasActiveWork(c),
            contracted: contractStageOf(c.status) === 'signed',
            contractEndsAt: currentTermEnd(c.contract, today),
            results: data.results.filter((r) => r.clientId === c.id),
            resultSeen,
            resultsSince: data.resultsSince,
          },
          today,
        ),
      )
    }
    return [...hot.sort((a, b) => b.days - a.days), ...out]
  }, [data, clients, today])
}

export function TodayPortal({ clients, workspaceId, today, chip = false }: { clients: ClientOpsRecord[]; workspaceId: string | null; today: string; chip?: boolean }) {
  const items = usePortalFollowUps(workspaceId, clients, today)
  const [open, setOpen] = useState(false)
  if (!items.length) return null
  const names = new Map(clients.map((c) => [c.id, c.companyName]))
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={chip
          ? 'tap inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-left hover:border-slate-300 hover:bg-slate-50'
          : 'tap t-sub inline-flex shrink-0 items-center gap-1.5 font-semibold text-brand-700 hover:underline'}
        data-testid="today-portal-open"
        data-count={items.length}
        data-guide="fn-today-portal"
      >
        <UserRoundCheck aria-hidden="true" className={chip ? 'size-4 shrink-0 text-slate-500' : 'size-4'} />
        {chip ? (
          <>
            <span className="t-sub whitespace-nowrap text-slate-600">고객 화면</span>
            <strong className="t-body font-bold whitespace-nowrap text-brand-700 tabular-nums">{items.length}건</strong>
          </>
        ) : (
          <>고객 화면 챙길 것 {items.length}건</>
        )}
      </button>
      {open && createPortal(<PortalSheet items={items} names={names} onClose={() => setOpen(false)} />, document.body)}
    </>
  )
}

/** [열기] — 그 업체 고객 플랫폼 탭. 보고서를 만들라는 줄(월말 · 재계약 · 보고 공백)이면 그 종류로 보고서 창까지 바로(D-684) */
function openPath(f: PortalFollowUp): string {
  const kind = followUpReportKind(f.rule)
  return `/ops/clients/${encodeURIComponent(f.clientId)}?tab=portal${kind ? `&make=${kind}` : ''}`
}

function PortalSheet({ items, names, onClose }: { items: PortalFollowUp[]; names: ReadonlyMap<string, string>; onClose: () => void }) {
  const [all, setAll] = useState(false)
  const shown = all ? items : items.slice(0, SHOW)
  return (
    <BottomSheet title="고객 화면 챙길 것" onClose={onClose}>
      <ul className="flex flex-col gap-2" data-testid="today-portal-sheet">
        {shown.map((f) => (
          <li key={f.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2.5" data-testid="today-portal-row" data-rule={f.rule}>
            <span className="min-w-0 flex-1 basis-48">
              <span className="t-body block font-semibold break-keep text-slate-900 [overflow-wrap:anywhere]">{names.get(f.clientId) ?? '(이름 없음)'}</span>
              <span className="t-sub block break-keep text-danger-700">{f.text}</span>
            </span>
            <Link to={openPath(f)} onClick={onClose} data-testid="today-portal-go" className="tap t-sub inline-flex min-h-10 shrink-0 items-center gap-1 rounded-(--radius-control) border border-slate-300 bg-white px-3 font-semibold text-slate-800 hover:bg-slate-50">
              열기 <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </li>
        ))}
      </ul>
      {items.length > SHOW && (
        <button type="button" onClick={() => setAll((v) => !v)} className="tap t-sub mt-2 min-h-10 font-semibold text-brand-700 hover:underline">
          {all ? '접기' : `${items.length - SHOW}건 더 보기`}
        </button>
      )}
      <p className="t-meta mt-3 break-keep text-slate-500">내부에만 보여요. 고객에게 저절로 보내지 않아요 — 열어서 안내 문구를 보내거나 보고서를 만들어 주세요.</p>
    </BottomSheet>
  )
}
