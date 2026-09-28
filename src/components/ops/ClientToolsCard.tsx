/**
 * 업체 상세 > 이 업체로 전문 모듈 열기 (D-89 · D-90 · D-127).
 *
 * 업체에서 출발한다: "고용지원금 [확인하기] · 정책자금 [진단하기] · 절세 [계산하기]".
 * 누르면 그 기능이 `?client=<id>` 로 열리고, 업체 정보(회사명 · 대표 · 업력 · 업종 · 직원 수)는 다시 적지 않는다.
 * 결과는 단추 한 번에 이 업체로 돌아온다.
 *
 * 모듈(분야)마다 묶는다 — 기능이 늘어도 어느 분야인지 바로 보인다. 잠긴 모듈은 감추지 않고
 * '잠김' 과 [살펴보기] 를 적는다(사는 단추는 없다).
 *
 * 서류가 준비됐는지 먼저 말해 준다(D-90). 없는 서류는 이름을 그대로 적고 서류함으로 가는 길을 붙인다.
 * 도구를 막지는 않는다 — 손으로 붙여넣어 쓰는 길이 늘 있기 때문이다.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Check, FileUp, History, Lock } from 'lucide-react'
import type { ClientOpsRecord, ToolResult } from '../../types/clientOps'
import { latestToolResult } from '../../services/toolResultGroups'
import { activityTimeText } from '../../services/clientOpsActivity'
import { liveTools } from '../../config/toolRegistry'
import { FEATURE_CATALOG, visibleModules, type CatalogFeature } from '../../config/productCatalog'
import { clientEntryHref, featureIcon } from '../../config/featurePaths'
import { useEntitlements } from '../../lib/entitlementsStore'
import { missingDocsForTools, missingDocsText, missingReason, readinessOf } from '../../services/toolReadiness'
import { Badge, Section, Surface } from '../ui/primitives'

/** 휴대폰에서 처음 펼쳐 둘 모듈 수 — 나머지는 누르면 */
const MOBILE_FIRST = 2

export function ClientToolsCard({
  record,
  today,
  onOpenDocs,
}: {
  record: ClientOpsRecord
  today: string
  /** 서류함 탭으로 보내기 */
  onOpenDocs: () => void
}) {
  const { ent } = useEntitlements()
  const tools = liveTools().filter((t) => t.path !== null)
  /** D-125: 휴대폰에서는 앞의 몇 개만 — 나머지는 누르면(업체 개요가 휴대폰에서 너무 길었다) */
  const [showAll, setShowAll] = useState(false)

  const readiness = readinessOf(record, tools, today)
  const readyOf = new Map(readiness.map((r) => [r.tool.key, r]))
  const blockedCount = readiness.filter((r) => !r.ready).length
  const missingAll = missingDocsForTools(record, tools, today)

  // 업체에서 여는 기능이 있는 모듈만, 카탈로그 순서대로
  const groups = visibleModules()
    .map((m) => ({ m, features: FEATURE_CATALOG.filter((f) => f.module === m.key && f.clientEntry) }))
    .filter((g) => g.features.length > 0)
  const count = groups.reduce((n, g) => n + g.features.length, 0)
  if (count === 0) return null

  return (
    <Section title="이 업체로 전문 모듈 열기" count={count}>
      <div className="flex flex-col gap-2.5" data-testid="client-tools">
        {/* 없는 서류를 맨 위에 한 줄로 — 무엇을 받아야 하는지가 먼저다 */}
        {missingAll.length > 0 && (
          <Surface edge="danger" showEdge className="flex flex-col gap-2 p-4" data-testid="client-tools-missing-wrap">
            <div className="flex flex-wrap items-center gap-2">
              <AlertTriangle aria-hidden="true" className="size-4 shrink-0 text-danger-600" />
              <span className="t-card font-bold break-keep text-slate-900">
                도구를 돌리려면 서류 {missingAll.length}건이 더 필요합니다
              </span>
              <Badge tone="danger">{blockedCount}개 도구가 막혀 있음</Badge>
            </div>
            <p className="t-body break-keep text-slate-700" data-testid="client-tools-missing">
              {missingDocsText(missingAll)}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onOpenDocs}
                className="tap inline-flex items-center gap-1.5 rounded-(--radius-control) border border-danger-300 bg-white px-3 py-1.5 text-[0.92rem] font-medium text-danger-700 hover:bg-danger-50"
              >
                <FileUp aria-hidden="true" className="size-4" /> 서류함에서 올리기
              </button>
            </div>
          </Surface>
        )}

        <div className="grid gap-2.5 lg:grid-cols-2">
          {groups.map(({ m, features }, gi) => {
            const me = ent.module(m.key)
            return (
              <section
                key={m.key}
                aria-label={`${m.name} 모듈`}
                data-client-module={m.key}
                className={`overflow-hidden rounded-(--radius-panel) border border-slate-200 bg-white ${gi >= MOBILE_FIRST && !showAll ? 'hidden sm:block' : ''}`}
              >
                <header className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-3.5 py-2">
                  <m.icon aria-hidden="true" className="size-4 shrink-0 text-slate-500" />
                  <h3 className="t-body font-bold text-slate-800">{m.name}</h3>
                  {!me.usable && (
                    <>
                      <span className="t-sub inline-flex items-center gap-1 text-slate-600">
                        <Lock aria-hidden="true" className="size-3.5" /> 잠김
                      </span>
                      <Link to={`${m.route}?client=${encodeURIComponent(record.id)}`} className="tap t-sub ml-auto inline-flex items-center font-semibold text-brand-700 hover:underline">
                        살펴보기
                      </Link>
                    </>
                  )}
                </header>
                <ul className="divide-y divide-slate-100">
                  {features.map((f) => (
                    <FeatureRow key={f.key} f={f} recordId={record.id} ready={readyOf.get(f.key)} usable={ent.feature(f.key).usable} moduleRoute={m.route} last={latestToolResult(record, f.key)} />
                  ))}
                </ul>
              </section>
            )
          })}
        </div>
        {groups.length > MOBILE_FIRST && !showAll && (
          <button
            type="button"
            data-testid="client-tools-more"
            onClick={() => setShowAll(true)}
            className="tap t-sub inline-flex w-full items-center justify-center gap-1.5 rounded-(--radius-control) border border-slate-200 bg-white py-2 font-semibold text-slate-700 hover:bg-slate-50 sm:hidden"
          >
            모듈 {groups.length - MOBILE_FIRST}개 더 보기
          </button>
        )}

        <p className="t-meta break-keep text-slate-500">
          업체 정보는 다시 적지 않습니다. 결과는 단추 한 번으로 이 업체 기록에 붙습니다. 서류가 없어도 열립니다.
        </p>
      </div>
    </Section>
  )
}

function FeatureRow({
  f,
  recordId,
  ready,
  usable,
  moduleRoute,
  last,
}: {
  f: CatalogFeature
  /** D-134: 이 업체에서 이 기능으로 낸 가장 최근 결과 */
  last: ToolResult | null
  recordId: string
  ready: ReturnType<typeof readinessOf>[number] | undefined
  usable: boolean
  moduleRoute: string
}) {
  const entry = f.clientEntry as NonNullable<CatalogFeature['clientEntry']>
  const Icon = featureIcon(f)
  const own = clientEntryHref(f, recordId)
  // 화면 전체가 잠기는 기능은 모듈 살펴보기로 — 첫 화면이 보이는 도구는 그대로 연다
  const href = usable || f.lockedPreview !== 'intro' ? own : `${moduleRoute}?client=${encodeURIComponent(recordId)}`
  if (!href) return null
  const blocked = ready ? !ready.ready : false
  const isTool = f.source === 'tool'
  return (
    <li>
      <Link
        to={href}
        data-tool={isTool ? f.key : undefined}
        data-feature={f.key}
        data-ready={ready ? (ready.ready ? 'yes' : 'no') : undefined}
        className={`tap flex flex-wrap items-start gap-x-2.5 gap-y-2 px-3.5 py-3 ${blocked ? 'hover:bg-danger-50/50' : 'hover:bg-brand-50/40'}`}
      >
        {Icon && <Icon aria-hidden="true" className={`mt-1 size-4 shrink-0 ${blocked ? 'text-danger-500' : 'text-slate-400'}`} />}
        {/* 좁은 화면 · 큰 글자에서는 동사 단추가 아래 줄로 내려간다(설명이 한 글자씩 쪼개지지 않게) */}
        <span className="flex min-w-0 grow basis-[11rem] flex-col gap-0.5">
          <span className="t-body font-bold break-keep text-slate-900">{entry.topic}</span>
          {ready && blocked ? (
            <span className="t-sub font-medium break-keep text-danger-700">
              서류 {ready.missing.length}건 필요 · {ready.missing.map((need) => (need.received ? `${need.label}(${missingReason(need).replace(/ \(.*\)$/, '')})` : need.label)).join(' · ')}
            </span>
          ) : ready ? (
            <span className="t-sub flex items-center gap-1 text-success-700">
              <Check aria-hidden="true" className="size-3.5 shrink-0" />
              {ready.needsNothing ? '바로 쓸 수 있습니다' : '필요한 서류가 다 있습니다'}
            </span>
          ) : null}
          {ready && ready.missingOptional.length > 0 && <span className="t-meta break-keep text-slate-500">있으면 더 정확 — {missingDocsText(ready.missingOptional)}</span>}
          {last && (
            <span className="t-sub flex items-start gap-1 break-keep text-slate-700" data-testid="feature-last">
              <History aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-slate-500" />
              <span>
                지난번 <b className="font-semibold">{last.verdictLabel || last.title}</b> · {activityTimeText(last.createdAt)}
              </span>
            </span>
          )}
        </span>
        <span className="t-sub ml-auto inline-flex shrink-0 items-center gap-1 rounded-(--radius-control) border border-brand-200 bg-brand-50 px-2.5 py-1 font-semibold text-brand-800">
          {last ? `다시 ${entry.verb}` : entry.verb}
          <ArrowRight aria-hidden="true" className="size-3.5" />
        </span>
      </Link>
    </li>
  )
}
