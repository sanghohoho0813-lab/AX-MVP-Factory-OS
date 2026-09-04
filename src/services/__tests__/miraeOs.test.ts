/**
 * MIRAE AI LAB OS 통합 재구축 · 계약 테스트
 *  - 브랜드 설정 · 모듈/서비스 레지스트리
 *  - 업무 일기 순수 함수
 *  - 오늘 브리핑(Top 3 규칙·하루 정리·돈·자금)
 *  - 고객 브릿지 순수 함수(정렬·요약·고객 투영 allowlist)
 * 실행: npm run test:mirae-os
 */

import { brand, documentTitle } from '../../brand/brand.config'
import { UI_THEMES, isThemeKey } from '../../lib/uiTheme'
import { MODULES, MODULE_GROUPS, enabledModulesByGroup, moduleForPath } from '../../config/moduleRegistry'
import {
  CUSTOMER_STAGE_ORDER,
  SERVICE_REGISTRY,
  enabledServices,
  suggestCustomerStage,
  suggestServiceForProduct,
} from '../../config/serviceCatalog'
import { applyJournalFilter, dueFollowUps, shiftDate, weekStart } from '../journalService'
import {
  buildDaySummary,
  buildFundingDeadlines,
  buildMoneySignals,
  buildTopActions,
  daySummaryText,
} from '../dailyBriefService'
import { buildProjection, eventSummary, isOpenEvent, sortEvents } from '../customerBridgeService'
import { normalizeClientOps, withFee, withNewFee, withNewFunding, withService } from '../clientOpsService'
import type { ClientOpsRecord, OpsAlert } from '../../types/clientOps'
import { mergeServices, normalizeCustomService, toServiceMeta } from '../customServiceService'
import { BUILTIN_SERVICES, SERVICES, registerCustomServices } from '../../content/clientOpsCatalog'
import type { CustomerEvent, JournalEntry, PortalClientLink, PortalDocument, PortalRequest, PortalUpdate } from '../../types/bridge'

let passed = 0
let failed = 0
function check(name: string, cond: boolean, detail?: string): void {
  if (cond) passed += 1
  else {
    failed += 1
    console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

const TODAY = '2026-09-03'

/* ------------------------------------------------------------------ */
/* 1. 브랜드 · 테마                                                       */
/* ------------------------------------------------------------------ */
check('brand: 제품명이 Factory 를 포함하지 않는다', !/factory/i.test(brand.productName + brand.productNameKo + brand.productSubtitle))
check('brand: 기본 테마는 9종 중 하나', isThemeKey(brand.defaultThemeId))
check('brand: 기본 테마는 deep-teal', brand.defaultThemeId === 'deep-teal')
check('brand: 고객 플랫폼 URL 은 https', brand.customerPlatformUrl.startsWith('https://'))
check('brand: 로고 경로는 /brand 아래', brand.logoLight.startsWith('/brand/') && brand.logoDark.startsWith('/brand/'))
check('brand: 문서 제목 형식', documentTitle('오늘') === `오늘 | ${brand.productName}` && documentTitle() === brand.productName)
check('theme: 9종', UI_THEMES.length === 9 && new Set(UI_THEMES.map((t) => t.key)).size === 9)

/* ------------------------------------------------------------------ */
/* 2. 모듈 레지스트리                                                     */
/* ------------------------------------------------------------------ */
const paths = MODULES.map((m) => m.path)
check('modules: 경로 중복 없음', new Set(paths).size === paths.length)
check('modules: 홈 /, 이벤트함, 일기, 고객 운영이 켜져 있다', ['/', '/ops/inbox', '/journal', '/ops/clients'].every((p) => MODULES.some((m) => m.path === p && m.enabled)))
check('modules: 모든 모듈의 group 이 정의된 그룹', MODULES.every((m) => MODULE_GROUPS.some((g) => g.key === m.group)))
const grouped = enabledModulesByGroup()
check('modules: 첫 그룹은 오늘', grouped[0]?.group.key === 'today')
check('modules: AX STUDIO 는 접을 수 있고 기본 접힘', MODULE_GROUPS.find((g) => g.key === 'studio')?.collapsible === true && MODULE_GROUPS.find((g) => g.key === 'studio')?.defaultCollapsed === true)
check('modules: 일기 그룹이 AX STUDIO 보다 앞', grouped.findIndex((g) => g.group.key === 'journal') < grouped.findIndex((g) => g.group.key === 'studio'))
check('moduleForPath: 정확 일치 홈', moduleForPath('/')?.key === 'today')
check('moduleForPath: 하위 경로 → 가장 긴 접두', moduleForPath('/funding/catalog/programs/x')?.key === 'institutions')
check('moduleForPath: 업체 상세 → 고객 운영', moduleForPath('/ops/clients/abc')?.key === 'client-ops')
check('moduleForPath: 홈은 접두 매칭하지 않음', moduleForPath('/nowhere') === null)

/* ------------------------------------------------------------------ */
/* 3. 서비스 레지스트리                                                   */
/* ------------------------------------------------------------------ */
check('services: 기존 6종 보존', SERVICE_REGISTRY.length === 6 && ['incorporation', 'businessScope', 'patent', 'venture', 'ax', 'policyFund'].every((k) => SERVICE_REGISTRY.some((s) => s.key === k)))
check('services: enabledServices 는 order 순', enabledServices().every((s, i, arr) => i === 0 || arr[i - 1].order <= s.order))
check('services: 주문 slug → 업무 추천 (venture-certification)', suggestServiceForProduct('venture-certification')?.key === 'venture')
check('services: 주문 slug → 업무 추천 (funding-consulting)', suggestServiceForProduct('funding-consulting')?.key === 'policyFund')
check('services: 모르는 slug 는 null', suggestServiceForProduct('coffee') === null && suggestServiceForProduct('') === null)
check('stage: 순서 6단계', CUSTOMER_STAGE_ORDER.length === 6 && CUSTOMER_STAGE_ORDER[0] === 'preparing' && CUSTOMER_STAGE_ORDER[5] === 'completed')
check('stage: 아무것도 시작 안 함 → 준비 중', suggestCustomerStage(['not_started', 'on_hold']) === 'preparing')
check('stage: 모두 완료 → 완료', suggestCustomerStage(['done', 'on_hold', 'done']) === 'completed')
// 업무 상태가 5단계로 줄면서 '접수 완료' 가 없어졌다. 고객 단계 '기관 접수' 는 남아
// 있지만 자동 추천 대상이 아니며, 발행 모달에서 사람이 직접 고른다.
check('stage: 진행 중이 섞이면 진행 중', suggestCustomerStage(['in_progress', 'done']) === 'in_progress')
check('stage: 진행 중', suggestCustomerStage(['in_progress', 'not_started']) === 'in_progress')
check('stage: 고객 대기·준비 → 자료 확인 중', suggestCustomerStage(['waiting_client']) === 'reviewing_docs')

/* ------------------------------------------------------------------ */
/* 4. 업무 일기 순수 함수                                                 */
/* ------------------------------------------------------------------ */
function entry(p: Partial<JournalEntry>): JournalEntry {
  return {
    id: p.id ?? Math.random().toString(36).slice(2),
    workspaceId: null,
    ownerId: null,
    entryDate: p.entryDate ?? TODAY,
    entryType: p.entryType ?? 'note',
    content: p.content ?? 'x',
    clientId: p.clientId ?? null,
    projectId: null,
    serviceKey: null,
    dueDate: p.dueDate ?? '',
    pinned: p.pinned ?? false,
    completed: p.completed ?? false,
    completedAt: p.completedAt ?? null,
    createdAt: p.createdAt ?? '2026-09-03T09:00:00.000Z',
    updatedAt: '2026-09-03T09:00:00.000Z',
  }
}
check('journal: shiftDate 월 경계', shiftDate('2026-09-01', -1) === '2026-08-31' && shiftDate('2026-12-31', 1) === '2027-01-01')
check('journal: weekStart 수요일→월요일', weekStart('2026-09-03') === '2026-08-31')
check('journal: weekStart 일요일→직전 월요일', weekStart('2026-09-06') === '2026-08-31')
const J = [
  entry({ id: 'a', entryDate: TODAY, entryType: 'call', createdAt: '2026-09-03T08:00:00.000Z' }),
  entry({ id: 'b', entryDate: TODAY, entryType: 'decision', pinned: true, createdAt: '2026-09-03T07:00:00.000Z' }),
  entry({ id: 'c', entryDate: '2026-09-01', entryType: 'follow_up', dueDate: '2026-09-02', clientId: 'c1' }),
  entry({ id: 'd', entryDate: '2026-08-20', entryType: 'follow_up', dueDate: '2026-09-10', completed: true }),
  entry({ id: 'e', entryDate: '2026-08-20', entryType: 'note' }),
]
check('journal: 오늘 필터', applyJournalFilter(J, { range: 'today' }, TODAY).map((e) => e.id).join() === 'b,a')
check('journal: 고정이 먼저', applyJournalFilter(J, { range: 'today' }, TODAY)[0].id === 'b')
check('journal: 이번 주 필터(8/31~)', applyJournalFilter(J, { range: 'week' }, TODAY).map((e) => e.id).sort().join() === 'a,b,c')
check('journal: 전체', applyJournalFilter(J, { range: 'all' }, TODAY).length === 5)
check('journal: 고객 필터', applyJournalFilter(J, { range: 'all', clientId: 'c1' }, TODAY).map((e) => e.id).join() === 'c')
check('journal: 종류 필터', applyJournalFilter(J, { range: 'all', type: 'follow_up' }, TODAY).length === 2)
check('journal: 안 끝난 후속조치만', applyJournalFilter(J, { range: 'all', openFollowUpsOnly: true }, TODAY).map((e) => e.id).join() === 'c')
check('journal: 기한 지난 후속조치', dueFollowUps(J, TODAY).map((e) => e.id).join() === 'c')

/* ------------------------------------------------------------------ */
/* 5. 고객 브릿지 순수 함수                                               */
/* ------------------------------------------------------------------ */
function ev(p: Partial<CustomerEvent>): CustomerEvent {
  return {
    id: p.id ?? Math.random().toString(36).slice(2),
    workspaceId: null,
    portalClientLinkId: p.portalClientLinkId ?? null,
    operationsClientId: p.operationsClientId ?? null,
    profileId: null,
    eventType: p.eventType ?? 'customer_request_created',
    sourceType: 'test',
    sourceId: p.id ?? 'x',
    dedupeKey: `test:${p.id}`,
    payloadVersion: 1,
    payload: p.payload ?? {},
    priority: p.priority ?? 'medium',
    status: p.status ?? 'new',
    occurredAt: p.occurredAt ?? '2026-09-03T08:00:00.000Z',
    receivedAt: '2026-09-03T08:00:00.000Z',
    handledAt: p.handledAt ?? null,
    handlingNote: '',
    createdAt: '2026-09-03T08:00:00.000Z',
    updatedAt: '2026-09-03T08:00:00.000Z',
  }
}
const E = [
  ev({ id: 'resolved', status: 'resolved', priority: 'high' }),
  ev({ id: 'low-new', status: 'new', priority: 'low' }),
  ev({ id: 'high-new-old', status: 'new', priority: 'high', occurredAt: '2026-09-01T00:00:00.000Z' }),
  ev({ id: 'high-new-recent', status: 'new', priority: 'high', occurredAt: '2026-09-03T00:00:00.000Z' }),
  ev({ id: 'linked', status: 'linked', priority: 'high' }),
]
check('events: 정렬 = 상태 → 우선순위 → 최신', sortEvents(E).map((e) => e.id).join() === 'high-new-recent,high-new-old,low-new,linked,resolved')
check('events: 열린 것 판정', isOpenEvent(E[1]) && !isOpenEvent(E[0]))
check('events: 주문 요약', eventSummary(ev({ eventType: 'service_order_created', payload: { company_name: '한빛', product_slug: 'venture', order_number: 'SO-1' } })).what.includes('SO-1'))
check('events: 요약 who 는 회사명 우선', eventSummary(ev({ payload: { company_name: '한빛', buyer_name: '김' } })).who === '한빛')
check('events: 값 없으면 고객', eventSummary(ev({ payload: {} })).who === '고객')

// 고객 투영 — SQL portal_project_projection 과 같은 규칙이어야 한다
const link: PortalClientLink = {
  id: 'L1', workspaceId: null, operationsClientId: 'cli', profileId: 'p', organizationId: null, primaryProjectId: null,
  status: 'active', customerStage: 'in_progress', displayName: '한빛 벤처인증', consultantName: '김팀장',
  linkedAt: '2026-09-01T00:00:00.000Z', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z', profileEmail: 'a@b.c', profileName: '',
}
const upd = (p: Partial<PortalUpdate>): PortalUpdate => ({
  id: p.id ?? 'u', workspaceId: null, portalClientLinkId: 'L1', projectId: null, category: p.category ?? 'progress', title: p.title ?? 't', body: p.body ?? '',
  status: p.status ?? 'published', customerActionRequired: p.customerActionRequired ?? false, customerActionLabel: '', dueDate: '', customerCompletedAt: null,
  publishedAt: p.publishedAt ?? '2026-09-02T00:00:00.000Z', createdAt: '2026-09-02T00:00:00.000Z', updatedAt: '2026-09-02T00:00:00.000Z',
})
const doc = (p: Partial<PortalDocument>): PortalDocument => ({
  id: p.id ?? 'd', workspaceId: null, portalClientLinkId: 'L1', projectId: null, operationsClientId: 'cli', documentType: 'x', title: p.title ?? 'doc',
  storagePath: p.storagePath ?? 'ws/cli/x.pdf', fileName: 'x.pdf', fileSize: null, mimeType: '', source: p.source ?? 'internal',
  visibility: p.visibility ?? 'internal_only', status: p.status ?? 'verified', customerNote: '', internalNote: p.internalNote ?? '',
  requestedAt: p.requestedAt ?? null, uploadedAt: p.uploadedAt ?? null, verifiedAt: null, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z',
})
const req = (p: Partial<PortalRequest>): PortalRequest => ({
  id: p.id ?? 'r', workspaceId: null, portalClientLinkId: 'L1', projectId: null, requestType: 'status', title: 't', body: '', status: 'open', answer: '',
  createdAt: p.createdAt ?? '2026-09-02T00:00:00.000Z', answeredAt: null, resolvedAt: null, updatedAt: '2026-09-02T00:00:00.000Z',
})
const proj = buildProjection(
  link,
  '한빛정밀',
  [upd({ id: 'pub', publishedAt: '2026-09-03T00:00:00.000Z' }), upd({ id: 'draft', status: 'draft', title: '초안 비밀' }), upd({ id: 'old', publishedAt: '2026-09-01T00:00:00.000Z' })],
  [
    doc({ id: 'secret', visibility: 'internal_only', title: '내부검토', internalNote: '비밀' }),
    doc({ id: 'shared', visibility: 'shared_with_customer', title: '결과보고서', internalNote: '원본은 드라이브' }),
    doc({ id: 'req', status: 'requested', title: '사업자등록증', requestedAt: '2026-09-02T00:00:00.000Z', storagePath: '' }),
    doc({ id: 'up', status: 'uploaded', source: 'customer', visibility: 'customer_uploaded', uploadedAt: '2026-09-03T00:00:00.000Z' }),
  ],
  [req({ id: 'r1', createdAt: '2026-09-01T00:00:00.000Z' }), req({ id: 'r2', createdAt: '2026-09-02T00:00:00.000Z' })],
)
const projText = JSON.stringify(proj)
check('projection: 이름은 display_name 우선', proj.project?.name === '한빛 벤처인증' && proj.project?.company_name === '한빛정밀')
check('projection: 공개 업데이트만, 최신순', proj.updates.map((u) => u.id).join() === 'pub,old')
check('projection: 초안 제외', !projText.includes('초안 비밀'))
check('projection: internal_only 서류 제외', !proj.documents.some((d) => d.id === 'secret'))
check('projection: 요청받은 서류가 먼저', proj.documents[0].id === 'req')
check('projection: internal_note 절대 없음', !projText.includes('internal_note') && !projText.includes('비밀') && !projText.includes('드라이브'))
check('projection: 내부 id 노출 없음', !projText.includes('workspace') && !projText.includes('operations_client') && !projText.includes('profile'))
check('projection: 요청 최신순', proj.requests.map((r) => r.id).join() === 'r2,r1')
check('projection: updated_at 은 최신 공개일', proj.project?.updated_at === '2026-09-03T00:00:00.000Z')
check('projection: 필드 집합 고정', Object.keys(proj).sort().join() === 'documents,project,requests,updates')

/* ------------------------------------------------------------------ */
/* 6. 오늘 브리핑                                                         */
/* ------------------------------------------------------------------ */
function alert(p: Partial<OpsAlert>): OpsAlert {
  return { id: p.id ?? 'a', clientId: p.clientId ?? 'c1', clientName: p.clientName ?? '한빛', kind: p.kind ?? 'task_due_soon', severity: p.severity ?? 'warning', title: p.title ?? 't', detail: '', serviceKey: null, dueDate: '', daysLeft: null }
}
const names = new Map([['c1', '한빛'], ['c2', '푸른']])
const top = buildTopActions(
  {
    alerts: [alert({ id: 'w', kind: 'task_due_soon', severity: 'warning' }), alert({ id: 'o', kind: 'task_overdue', severity: 'critical' }), alert({ id: 'f', kind: 'funding_overdue', severity: 'critical' })],
    events: [ev({ id: 'order', eventType: 'service_order_created', priority: 'high' }), ev({ id: 'done', eventType: 'service_order_created', status: 'resolved' })],
    followUps: [entry({ id: 'fu', entryType: 'follow_up', dueDate: '2026-09-01', clientId: 'c2' }), entry({ id: 'fu-later', entryType: 'follow_up', dueDate: '2026-09-20' })],
    clientNames: names,
    today: TODAY,
  },
  5,
)
check('top: 자금 마감 지남 > 업무 마감 지남 > 결제 주문 > 지난 후속조치 > 임박', top.map((a) => a.id).join() === 'alert:f,alert:o,event:order,follow:fu,alert:w')
check('top: 모든 항목에 이유', top.every((a) => a.reason.length > 0))
check('top: 처리 완료 이벤트·미래 후속조치 제외', !top.some((a) => a.id === 'event:done' || a.id === 'follow:fu-later'))
check('top: 후속조치 이유에 며칠 지났는지', top.find((a) => a.id === 'follow:fu')?.reason.includes('2일') === true)
check('top: limit', buildTopActions({ alerts: [], events: [], followUps: [], clientNames: names, today: TODAY }).length === 0)

// 하루 정리
let rec = normalizeClientOps({ id: 'c1', companyName: '한빛', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' })
rec = withService(rec, 'venture', { status: 'submitted' })
rec.activity = rec.activity.map((a) => ({ ...a, at: '2026-09-03T02:00:00.000Z' }))
const summary = buildDaySummary({
  today: TODAY,
  journal: [
    entry({ id: 'dec', entryType: 'decision', content: '성공보수 10%로 결정', clientId: 'c1' }),
    entry({ id: 'blk', entryType: 'blocker', content: '등기부 미수령' }),
    entry({ id: 'fu', entryType: 'follow_up', dueDate: TODAY, content: '서류 재요청' }),
    entry({ id: 'fu-done', entryType: 'follow_up', dueDate: TODAY, content: '견적 발송', completed: true, completedAt: '2026-09-03T05:00:00.000Z' }),
  ],
  clients: [rec],
  alerts: [alert({ id: 'o', kind: 'task_overdue', severity: 'critical', title: '특허 마감 지남' })],
  events: [ev({ id: 'new', status: 'new', payload: { company_name: '푸른' } }), ev({ id: 'res', status: 'resolved', handledAt: '2026-09-03T04:00:00.000Z', payload: { company_name: '한빛' } })],
  clientNames: names,
})
check('summary: 오늘 처리 = 활동 + 완료 후속 + 처리 이벤트', summary.done.length === 3 && summary.done.some((d) => d.includes('견적 발송')))
check('summary: 아직 남음 = 심각 경고 + 열린 이벤트', summary.remaining.length === 2 && summary.remaining[0].includes('특허'))
check('summary: 내일로 넘김 = 오늘까지 미완 후속조치', summary.carriedOver.join() === '서류 재요청')
check('summary: 결정에 고객명 접두', summary.decisions[0] === '한빛 · 성공보수 10%로 결정')
check('summary: 이슈 = 막힘 + 새 이벤트', summary.issues.length === 2)
check('summary: 텍스트에 5개 블록', (daySummaryText(summary).match(/\n\n/g) ?? []).length === 5)

// 돈 · 자금
let money = normalizeClientOps({ id: 'm', companyName: '돈', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' })
money = withNewFee(money, { kind: 'deposit', amount: 1000000, dueDate: '2026-09-01' })
money = withNewFee(money, { kind: 'success', amount: 3000000, dueDate: '2026-09-30' })
money = withNewFee(money, { kind: 'interim', amount: null, dueDate: '2026-09-10' })
money = withNewFee(money, { kind: 'deposit', amount: 500000, dueDate: '2026-08-01' })
money = withFee(money, money.fees[3].id, { receivedAt: '2026-08-02' })
const ms = buildMoneySignals([money], TODAY)
check('money: 연체 = 예정일 지난 미수금', ms.overdue.count === 1 && ms.overdue.total === 1000000)
check('money: 예정 = 아직 안 온 돈', ms.scheduled.count === 1 && ms.scheduled.total === 3000000)
check('money: 금액 미정은 합산 제외', ms.unknownAmount === 1)
check('money: 받은 돈 제외', !ms.overdue.items.some((i) => i.amount === 500000))
let fund = normalizeClientOps({ id: 'f', companyName: '자금', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' })
fund = withNewFunding(fund, { programName: '곧 마감', applyDueDate: '2026-09-05', status: 'preparing' })
fund = withNewFunding(fund, { programName: '멀었음', applyDueDate: '2026-10-30', status: 'watching' })
fund = withNewFunding(fund, { programName: '이미 접수', applyDueDate: '2026-09-04', status: 'submitted' })
const fd = buildFundingDeadlines([fund], TODAY)
check('funding: 14일 내 미접수만', fd.length === 1 && fd[0].programName === '곧 마감' && fd[0].daysLeft === 2)


/* ------------------------------------------------------------------ */
/* 직접 만든 업무 항목                                                   */
/* ------------------------------------------------------------------ */
{
  const custom = normalizeCustomService({ key: 'custom_iso1', label: 'ISO 인증', order: 100 })
  check('custom: 짧은 이름은 라벨에서 만든다', custom.shortLabel === 'ISO 인')
  const merged = mergeServices([custom])
  check('custom: 기본 6종 뒤에 붙는다', merged.length === BUILTIN_SERVICES.length + 1 && merged[merged.length - 1].key === 'custom_iso1')
  check('custom: 내린 항목은 빠진다', mergeServices([{ ...custom, archived: true }]).length === BUILTIN_SERVICES.length)

  registerCustomServices([toServiceMeta(custom)])
  check('custom: 목록에 실제로 올라간다', SERVICES.some((s) => s.key === 'custom_iso1'))
  const withCustom = normalizeClientOps({
    id: 'c1', companyName: '커스텀', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z',
    services: { custom_iso1: { status: 'in_progress' } },
  } as unknown as Partial<ClientOpsRecord>)
  check('custom: 상태가 저장·복원된다', withCustom.services.custom_iso1.status === 'in_progress')

  // 목록에서 내려도(등록 해제) 이미 적어 둔 기록은 지키다
  registerCustomServices([])
  const kept = normalizeClientOps({
    id: 'c2', companyName: '보관', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z',
    services: { custom_iso1: { status: 'done' } },
  } as unknown as Partial<ClientOpsRecord>)
  check('custom: 목록에 없어도 기록은 남는다', kept.services.custom_iso1?.status === 'done')
}

/* ------------------------------------------------------------------ */
console.log(`\nmirae-os: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
void (0 as unknown as ClientOpsRecord)
