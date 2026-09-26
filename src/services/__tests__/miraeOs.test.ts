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
import { MODULES, MODULE_GROUPS, enabledModulesByGroup, moduleForPath, screenGroupForPath, screenTitleForPath } from '../../config/moduleRegistry'
import { identityFromSession } from '../../auth/currentUser'
import { FUTURE_ITEMS } from '../../config/capabilityStatus'
import { REVIEW_HUB_PATH, TOOLS, liveTools, plannedTools, reviewTools, searchTools } from '../../config/toolRegistry'
import { formatClockDate, formatClockTime } from '../../components/layout/HeaderClock'
import {
  CUSTOMER_STAGE_ORDER,
  SERVICE_REGISTRY,
  enabledServices,
  suggestCustomerStage,
  suggestServiceForProduct,
} from '../../config/serviceCatalog'
import { applyJournalFilter, dueFollowUps, postponedDue, shiftDate, weekStart } from '../journalService'
import { wonOf } from '../../lib/format'
import {
  buildDaySummary,
  buildFundingDeadlines,
  buildMoneySignals,
  buildTopActions,
  daySummaryText,
} from '../dailyBriefService'
import { EVENT_TYPE_LABEL, buildProjection, eventSummary, isOpenEvent, sortEvents, waitingDays, waitingLevel } from '../customerBridgeService'
import signupSql from '../../../supabase/migrations/20260925000014_signup_event.sql?raw'
import { normalizeClientOps, withContract, withCustomField, withFee, withNewFee, withNewFunding, withService, withoutCustomField, withoutFee } from '../clientOpsService'
import {
  contractAgeShort,
  contractAgeText,
  doneWorks,
  monthlyPremiumTotal,
  monthsSinceContract,
  summarizeContract,
} from '../contractSummary'
import type { ClientOpsRecord, OpsAlert } from '../../types/clientOps'
import { mergeServices, normalizeCustomService, toServiceMeta } from '../customServiceService'
import { buildKpis, kpisByGroup, kpiStatusSummary } from '../kpiService'
import { svCurrent, svSummaryLines } from '../../tools/cretop/mini/stockValueCalc.js'
import { profileFields, profileFieldsByGroup, regionOf } from '../clientOpsProfile'
import { CONTRACT_STAGE_ORDER, CONTRACT_STAGE_LABEL, contractStageOf, statusForStage } from '../../types/clientOps'
import type { ClientOpsStatus, ContractStage } from '../../types/clientOps'
import { clientOpsProgress } from '../clientOpsAlerts'
import {
  countContractClients,
  daysInStage,
  groupBySalesStage,
  importLegacySalesAccounts,
  isContractClient,
  isProspect,
  normalizeSales,
  salesStageFrom,
  salesInFlow,
  salesStageOf,
  withNewProspect,
  withSalesInfo,
  withSalesStage,
} from '../salesPipeline'
import { SALES_FLOW_STAGES, SALES_STAGE_ORDER } from '../../types/clientOps'
import { SALES_TABS, SALES_TAB_PATHS } from '../../config/salesTabs'
import {
  CUST_FLAGS,
  MEETING_THEMES,
  STRATEGY_LIBRARY,
  analyzeTranscript,
  buildLeadPlan,
  buildMeetingPlan,
  followUpKakao,
  recommendedStrategiesFor,
  scoreLead,
  scoreTier,
} from '../salesEngine'
import { engineIndustry, interestsFromIssues, missingDocSlots, profileFromMemo, roundForStage, stageAfterMeeting, toEngineItem, withDocSlots, withMeetingNote, withSalesProfile } from '../salesMeeting'
import { PATH_TO_KIND, agentRateOf, contractCloseDraft, contractGap, withContractClose } from '../salesContract'
import { withInboxPayload } from '../inboxToSales'
import salesAppSource from '../../tools/salesKit/orig/SalesApp.jsx?raw'
import cretopCompanyText from '../../../e2e/fixtures/cretop-company.txt?raw'
import { analyzeCretopText } from '../../tools/cretop/mini/analysisCore.js'
import { applyCretopToClient, tidyCompanyName, companyKey, cretopForMeeting, cretopResultInput, cretopTier, digestCretop, findClientForCretop, meetingPicks, normalizeEstablished, FLOW_ROUND } from '../salesCretop'
import { SALES_PATH_INFO, buildJourney, journeyTools, withSalesPath } from '../salesJourney'
import { withToolResult } from '../clientOpsService'
import { NEXT_QUICK_DAYS, addDaysLocal, friendlyDate, nextSuggestions, relativeDay, suggestsFirstMeeting, withNextAction } from '../clientOpsNextAction'
import { buildClientSchedule } from '../clientOpsSchedule'
import { localDateOf } from '../../lib/appClock'
import { trialEndDate } from '../moduleAccess'
import {
  CONTRACT_CHECKLIST,
  DEFAULT_PACKAGES,
  PKG_CATEGORIES,
  PROPOSAL_STATES,
  REQUIRED_DOCS,
  affordability,
  buildProposal,
  buildScopeDoc,
  insuranceSim,
  manToText,
  matchPackages,
} from '../salesProposal'
import { CRETOP_WEAPONS, PROPOSAL_TOPICS, TAX_STRATEGIES } from '../salesLibrary'
import { customersForTopic, lastSalesTouch, salesActionPath, salesRecontacts, salesRisks } from '../salesSignals'
import { buildVisitReport } from '../salesProposal'
import { catalogWithPrices, cleanPrices, feeSum, toProposalItem, withContractFromProposal, withContractPrep, withProposal } from '../salesOffer'
import { digitsOf, formatNumberOf, numberSegments } from '../../lib/format'
import { agentLedger, agentLedgerTotals, agentShares, feeMathOf, feeTotals, marginPct, marginText, netAmountOf } from '../feeMath'
import { CLIENT_FILTER_ORDER, filterClients, isClientFilterKey, matchesClientFilter } from '../clientOpsFilter'
import { CLIENT_SORT_ORDER, isClientSortKey, sortClients } from '../clientOpsSort'
import { clientSearchText, matchesClientSearch, searchHit } from '../clientOpsSearch'
import { allDocumentMetas, customDocumentMeta, documentMetaOf, makeCustomDocumentKey } from '../clientOpsDocuments'
import { withCustomDocument, withDocument, withoutCustomDocument } from '../clientOpsService'
import { documentStatus } from '../clientOpsAlerts'
import { DOCUMENTS } from '../../content/clientOpsCatalog'
import { isCustomDocumentKey } from '../../types/clientOps'
import { classifyDocument, findIssuedDate, KNOWN_EXTRA_DOCS } from '../docClassify'
import { TAX_CALCULATORS, calculatorOf, unlistedShareValuation, computeSalary, corpTaxLocal, defaultValues, giftDeduction, incomeTax9, inheritGiftTax, oldBracketTax, pct, salaryBracketTax, won, yearsRoundUp9 } from '../taxCalc'
import { formatYmd, profileAsText, yearsInBusiness } from '../clientOpsProfile'
import { SERVICE_STATUS_ORDER, isServiceOpen, isServiceNotApplicable, normalizeServiceStatus } from '../../content/clientOpsCatalog'
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
check('modules: 홈 /, 이벤트함, 고객 운영이 켜져 있다', ['/', '/ops/inbox', '/ops/clients'].every((p) => MODULES.some((m) => m.path === p && m.enabled)))
// D-103: 기록은 일정 안의 탭 — /journal 주소도 '일정' 메뉴가 맡는다
check('modules: /journal · /journal/week · /journal/all 은 일정이 맡는다', ['/journal', '/journal/week', '/journal/all'].every((p) => moduleForPath(p)?.key === 'calendar'))
check('modules: 모든 모듈의 group 이 정의된 그룹', MODULES.every((m) => MODULE_GROUPS.some((g) => g.key === m.group)))
const grouped = enabledModulesByGroup()
check('modules: 첫 그룹은 오늘', grouped[0]?.group.key === 'today')
check('modules: AX STUDIO 는 접을 수 있고 기본 접힘', MODULE_GROUPS.find((g) => g.key === 'studio')?.collapsible === true && MODULE_GROUPS.find((g) => g.key === 'studio')?.defaultCollapsed === true)

/* 메뉴 재분류 — 자주 쓰는 것이 위, 가끔 쓰는 것이 아래 (D-86) */
{
  const order = MODULE_GROUPS.map((g) => g.key)
  check('메뉴: 순서는 오늘 → 고객 → 영업 → 컨설팅 작업실 → STUDIO → 이 시스템 → 설정 (D-104 가끔 쓰는 것 없앰)',
    order.join() === 'today,clients,sales,tools,studio,about,settings', order.join())
  check('메뉴: 이름 — 고객 관리 · 잠재고객 상담신청 · 컨설팅 작업실(구 도구함) · 특허+벤처 (D-104)',
    MODULES.find((m) => m.key === 'client-ops')?.label === '고객 관리' && MODULES.find((m) => m.key === 'inbox')?.label === '잠재고객 상담신청' &&
    MODULE_GROUPS.find((g) => g.key === 'tools')?.title === '컨설팅 작업실' && MODULES.find((m) => m.key === 'consulting-studio')?.label === '특허+벤처')
  check('메뉴: 숫자 — 고객 관리(고객사 수) · 상담신청 · 1차 미팅',
    MODULES.find((m) => m.key === 'client-ops')?.badge === 'clients' && MODULES.find((m) => m.key === 'inbox')?.badge === 'requests' && MODULES.find((m) => m.key === 'first-meeting')?.badge === 'first-meetings')
  const inGroup = (g: string) => MODULES.filter((m) => m.group === g).map((m) => m.key)
  check('메뉴: 오늘과 일정이 한 묶음', inGroup('today').join() === 'today,calendar')
  check('메뉴: 특허+벤처 · 자금·지원사업이 컨설팅 작업실 안, 작업실 전체보다 위 (D-104) · 검토중 도구가 없으면 도입 검토중 줄도 없다 (D-118)',
    inGroup('tools').slice(-3).join() === 'consulting-studio,funding,tools' && !inGroup('tools').includes('tools-review') && inGroup('occasional').length === 0, inGroup('tools').join())
  check('메뉴: 영업 묶음 = 영업 관리(D-114) · 영업자 정산 · 1차 미팅 체크리스트(준비 중)',
    inGroup('sales').join() === 'sales,agents,first-meeting' && MODULES.find((m) => m.key === 'first-meeting')?.status === 'soon', inGroup('sales').join())
  check('메뉴: 고객 묶음에서 영업자 정산이 빠졌다', !inGroup('clients').includes('agents'))
  check('메뉴: 처음 사용 가이드가 이 시스템 맨 위', inGroup('about')[0] === 'guide' && MODULES.find((m) => m.key === 'guide')?.path === '/getting-started')
  check('메뉴: 향후 확장은 눌러도 이동하지 않고 펼쳐진다', MODULES.find((m) => m.key === 'roadmap')?.expand === 'future-items')
  check('메뉴: 컨설팅 작업실(구 도구함)은 영업 다음', order.indexOf('tools') === order.indexOf('sales') + 1 && order.indexOf('sales') === order.indexOf('clients') + 1)
  check('메뉴: 도구함에 세금 계산기', inGroup('tools').includes('tool-tax'))
  // 도구를 목록에만 더하고 사이드바에 거는 것을 빠뜨리는 일이 없어야 한다 (D-86)
  check('메뉴: 쓸 수 있는 도구는 전부 사이드바 도구함에 걸린다',
    liveTools().every((t) => MODULES.some((m) => m.group === 'tools' && m.path === t.path)))
  check('메뉴: 아직 없는 도구는 사이드바에 걸리지 않는다',
    plannedTools().every((t) => !MODULES.some((m) => m.key === `tool-${t.key}`)))
  check('메뉴: 없어진 그룹을 가리키는 모듈이 없다', MODULES.every((m) => MODULE_GROUPS.some((g) => g.key === m.group)))
  check('메뉴: 모든 모듈 주소가 겹치지 않는다', new Set(MODULES.map((m) => m.path)).size === MODULES.length)
}

/* 지금 쓰는 사람 이름 (D-103) */
{
  const own = identityFromSession(null, null)
  check('이름: 로그인 없으면 대표 이름', own.name === '김상호' && own.title === '대표' && own.initial === '김')
  check('이름: 소유자인데 프로필 이름이 이메일 앞부분뿐이면 대표 이름', identityFromSession({ email: 'sanghohoho0813@gmail.com', user_metadata: { display_name: 'sanghohoho0813' } }, 'owner').name === '김상호')
  const named = identityFromSession({ email: 'park@x.com', user_metadata: { display_name: '박지훈' } }, 'editor')
  check('이름: 프로필에 이름을 넣으면 그 이름 + 역할', named.name === '박지훈' && named.title === '편집자' && named.initial === '박', JSON.stringify(named))
  const plain = identityFromSession({ email: 'choi@x.com', user_metadata: {} }, 'viewer')
  check('이름: 이름 없는 구성원은 이메일 앞부분 (대표 이름을 빌려 쓰지 않는다)', plain.name === 'choi' && plain.title === '보기 전용', JSON.stringify(plain))
  check('이름: 소유자가 이름을 넣으면 그 이름 · 직함은 대표', identityFromSession({ email: 'a@b.c', user_metadata: { full_name: '김상호' } }, 'owner').title === '대표')
}

/* 향후 확장 안내창 내용 (D-103) */
{
  check('향후 확장: 항목마다 돌아가는 순서 3단계 이상과 예시가 있다', FUTURE_ITEMS.every((f) => f.scenario.length >= 3 && f.example.length > 20 && f.short.length > 0))
  check('향후 확장: 짧은 이름이 겹치지 않는다', new Set(FUTURE_ITEMS.map((f) => f.short)).size === FUTURE_ITEMS.length)
}

/* 도구함 — 앞으로 붙을 것까지 목록 하나로 (D-86) */
{
  check('도구함: 세금 계산기는 지금 쓸 수 있다', liveTools().some((t) => t.path === '/tools/tax'))
  check('도구함: 자리만 잡아 둔 것은 주소가 없다', plannedTools().every((t) => t.path === null))
  check('도구함: 자리만 잡아 둔 것은 그렇게 적는다', plannedTools().every((t) => t.desc.includes('아직 없습니다')))
  check('도구함: 자리만 잡아 둔 것은 기업인증 OS 하나 (크레탑은 들어왔다)', plannedTools().map((t) => t.label).join() === '기업인증 OS')
  check('도구함: 옮겨 온 다섯 도구가 전부 쓸 수 있다', ['startup-tax', 'cretop', 'employment', 'labcare', 'policy-funding'].every((k) => liveTools().some((t) => t.key === k)))
  check('도구함: 영업 도구 모음은 영업 관리로 옮겨 감(D-118) — 검토중 도구 없음', reviewTools().length === 0 && TOOLS.find((t) => t.key === 'sales-kit')?.status === 'moved' && TOOLS.find((t) => t.key === 'sales-kit')?.movedTo?.path === '/sales/board')
  check('메뉴: 검토중 도구가 없으면 도입 검토중 줄도 없다', !MODULES.some((m) => m.key === 'tools-review' || m.path === REVIEW_HUB_PATH))
  check('메뉴: 옮겨 간 도구는 사이드바에 이름이 없고, 그 주소는 영업 관리가 맡는다', !MODULES.some((m) => m.path === '/tools/sales-kit') && moduleForPath('/tools/sales-kit/briefing')?.key === 'sales')
  check('메뉴: 옮겨 간 도구 — 머리줄 영업 › 영업 도구 모음 · 검색 · 서류 목록에서 빠짐', screenTitleForPath('/tools/sales-kit/meeting') === '영업 도구 모음' && screenGroupForPath('/tools/sales-kit/meeting')?.title === '영업' && !searchTools('영업').some((t) => t.key === 'sales-kit'))
  check('도구함: 모든 도구 주소가 /tools/ 아래', TOOLS.every((t) => t.path === null || t.path.startsWith('/tools/')))
  check('도구함: 키가 겹치지 않는다', new Set(TOOLS.map((t) => t.key)).size === TOOLS.length)
}

/* 최상단 시계 — 초까지 (D-87) */
{
  const d = new Date(2026, 8, 22, 9, 5, 7)
  check('시계: 날짜는 요일까지', formatClockDate(d) === '2026년 9월 22일 (화)', formatClockDate(d))
  check('시계: 시각은 초까지 두 자리', formatClockTime(d) === '09:05:07', formatClockTime(d))
  check('시계: 자정', formatClockTime(new Date(2026, 0, 1, 0, 0, 0)) === '00:00:00')
}
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
// D-106: 홈페이지 회원가입 → 잠재고객 상담신청
{
  const su = eventSummary(ev({ eventType: 'customer_signed_up', payload: { name: '이고객', email: 'lee@x.com', company_name: '새봄식품' } }))
  check('가입: 이름표는 회원가입', EVENT_TYPE_LABEL.customer_signed_up === '회원가입')
  check('가입: 회사가 있으면 회사 · 사람 · 이메일', su.who === '새봄식품' && su.what.includes('회원가입') && su.what.includes('이고객') && su.what.includes('lee@x.com'), JSON.stringify(su))
  const solo = eventSummary(ev({ eventType: 'customer_signed_up', payload: { email: 'k@x.com' } }))
  check('가입: 이름 · 회사 없어도 이메일로', solo.who === '고객' && solo.what.includes('k@x.com'), JSON.stringify(solo))
  check('가입: 처리 전이면 상담신청 숫자에 든다', isOpenEvent(ev({ eventType: 'customer_signed_up', status: 'new' })))
  // 가입을 절대 막지 않는 장치가 SQL 에서 빠지면 여기서 먼저 걸린다 (2026-09-03 가입 장애 재발 방지)
  check('가입 SQL: 오류를 삼켜 가입을 막지 않는다', /exception\s+when\s+others\s+then/i.test(signupSql) && signupSql.includes('raise warning'))
  check('가입 SQL: 기존 가입 트리거 뒤에 돈다 (zzz_)', signupSql.includes('create trigger zzz_bridge_on_auth_user_created') && signupSql.includes('after insert on auth.users'))
  check('가입 SQL: 내부 OS 직원 가입은 뺀다', signupSql.includes("'internal_os'"))
  check('가입 SQL: 표 · 열 삭제 없음', !/drop\s+table|drop\s+column|truncate/i.test(signupSql))
  check('가입 SQL: 기존 종류 여덟 가지를 모두 다시 허용', ['diagnosis_completed', 'consultation_requested', 'service_order_created', 'document_uploaded', 'customer_request_created', 'customer_action_completed', 'customer_reply', 'profile_updated', 'customer_signed_up'].every((t) => signupSql.includes(`'${t}'`)))
}
check('events: 값 없으면 고객', eventSummary(ev({ payload: {} })).who === '고객')
// D-107: 오래 기다린 상담신청 — "N일째 대기" (정오 UTC 로 잡아 시간대가 달라도 같은 날)
{
  const at = (d: string) => `${d}T12:00:00.000Z`
  check('대기: 같은 날은 0일', waitingDays(ev({ occurredAt: at('2026-09-25') }), '2026-09-25') === 0)
  check('대기: 사흘 전 들어온 새 신청은 3일', waitingDays(ev({ occurredAt: at('2026-09-22') }), '2026-09-25') === 3)
  check('대기: 처리 완료·보류는 기다리는 중이 아니다', waitingDays(ev({ status: 'resolved', occurredAt: at('2026-09-01') }), '2026-09-25') === null && waitingDays(ev({ status: 'ignored', occurredAt: at('2026-09-01') }), '2026-09-25') === null)
  check('대기: 연결만 하고 처리 안 한 것도 센다', waitingDays(ev({ status: 'linked', occurredAt: at('2026-09-20') }), '2026-09-25') === 5)
  check('대기: 날짜를 못 읽으면 null', waitingDays(ev({ occurredAt: 'nope' }), '2026-09-25') === null)
  check('대기: 미래 날짜는 0 (음수 없음)', waitingDays(ev({ occurredAt: at('2026-09-30') }), '2026-09-25') === 0)
  check('대기: 1일은 배지 없음 · 2일 주의 · 5일 빨강', waitingLevel(1) === null && waitingLevel(2) === 'warn' && waitingLevel(4) === 'warn' && waitingLevel(5) === 'danger' && waitingLevel(null) === null)
  // 같은 회원가입이라도 오래 기다린 쪽이 오늘 화면에서 먼저 나온다
  const fresh = ev({ id: 'su-fresh', eventType: 'customer_signed_up', occurredAt: at('2026-09-25') })
  const stale = ev({ id: 'su-stale', eventType: 'customer_signed_up', occurredAt: at('2026-09-19') })
  const acts = buildTopActions({ alerts: [], events: [fresh, stale], followUps: [], clientNames: new Map(), today: '2026-09-25' }, 5)
  check('대기: 오래 기다린 가입이 위로', acts[0]?.id === 'event:su-stale' && acts[1]?.id === 'event:su-fresh', acts.map((a) => a.id).join())
  check('대기: 이유에 며칠째인지 적힌다', acts[0]?.reason.includes('6일째 대기') === true && !acts[1]?.reason.includes('대기 중'), acts[0]?.reason)
  check('대기: 점수는 99를 넘지 않는다', acts.every((a) => a.score <= 99))
}
// 상품 코드는 화면에 그대로 나오면 안 된다 — 아는 코드면 한글 이름으로 바꾼다
check(
  'events: 주문 요약이 상품 코드를 한글 이름으로 바꾼다',
  (() => {
    const what = eventSummary(ev({ eventType: 'service_order_created', payload: { product_slug: 'venture-certification' } })).what
    return !what.includes('venture-certification') && what.includes('벤처인증')
  })(),
)
check(
  'events: 모르는 상품 코드는 그대로 둔다',
  eventSummary(ev({ eventType: 'service_order_created', payload: { product_slug: 'zzz-unknown' } })).what.includes('zzz-unknown'),
)

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
/* 성과 지표 — 있는 기록에서만 계산하고 숫자를 지어내지 않는다          */
/* ------------------------------------------------------------------ */
{
  const k1 = normalizeClientOps({
    id: 'k1', companyName: '지표A', status: 'active', createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
    services: { patent: { status: 'in_progress', dueDate: '2026-09-01' }, venture: { status: 'in_progress', dueDate: '2026-09-20' } },
    fees: [
      { id: 'a', kind: 'deposit', label: '계약금', amount: 1_000_000, dueDate: '2026-08-01', receivedAt: '2026-08-05' },
      { id: 'b', kind: 'success', label: '성공보수', amount: 2_000_000, dueDate: '2026-08-30', receivedAt: null },
      { id: 'c', kind: 'interim', label: '중도금', amount: null, dueDate: '2026-09-10', receivedAt: null },
    ],
    fundingApplications: [{ id: 'f1', programName: '놓친 공고', status: 'preparing', applyDueDate: '2026-08-20' }],
    activity: [{ id: 'act1', kind: 'service_status', text: 'x', serviceKey: null, at: '2026-09-02T01:00:00.000Z' }],
  } as unknown as Partial<ClientOpsRecord>)
  const k2 = normalizeClientOps({
    id: 'k2', companyName: '지표B', status: 'archived', archivedAt: '2026-08-01T00:00:00.000Z',
    createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
    fees: [{ id: 'z', kind: 'deposit', label: '보관업체', amount: 9_000_000, dueDate: '2026-01-01', receivedAt: null }],
  } as unknown as Partial<ClientOpsRecord>)
  const kj: JournalEntry[] = [
    { id: 'j1', workspaceId: null, ownerId: null, entryDate: '2026-09-03', entryType: 'note', content: 'a', clientId: null, projectId: null, serviceKey: null, dueDate: '', pinned: false, completed: false, completedAt: null, createdAt: '2026-09-03T00:00:00.000Z', updatedAt: '2026-09-03T00:00:00.000Z' },
    { id: 'j2', workspaceId: null, ownerId: null, entryDate: '2026-07-01', entryType: 'note', content: 'old', clientId: null, projectId: null, serviceKey: null, dueDate: '', pinned: false, completed: false, completedAt: null, createdAt: '2026-07-01T00:00:00.000Z', updatedAt: '2026-07-01T00:00:00.000Z' },
  ]
  const kpis = buildKpis({ records: [k1, k2], journal: kj, events: [], today: TODAY })
  const by = (key: string) => kpis.find((m) => m.key === key)!

  check('kpi: 14개 지표가 5그룹으로 나뉜다 (D-114 영업 3개)', kpis.length === 14 && kpisByGroup(kpis).length === 5 && kpisByGroup(kpis).every((g) => g.items.length >= 2))
  check('kpi: 잴 수 없는 것은 값 없이 방법만', by('first_action_minutes').value === null && by('first_action_minutes').status === 'unknown' && by('first_action_minutes').method.length > 20)
  check('kpi: 예정일 지난 미수금 — 보관 업체는 제외', by('overdue_receivables_now').value === '1건 · 2,000,000원')
  check('kpi: 근거가 적으면 기준선 만드는 중', by('overdue_receivables_now').status === 'baseline_forming')
  check('kpi: 수금 지연 = 입금일 − 예정일 (4일 늦음)', by('collection_delay_days').value === '4일 늦게 · 제때 0/1건')
  check('kpi: 마감 지난 업무 1 / 진행 2', by('overdue_tasks_now').value === '1건 / 진행 2건')
  check('kpi: 놓친 자금 신청 1/1', by('funding_deadlines_missed').value === '1건 / 마감 있는 신청 1건')
  check('kpi: 관리 중 업체는 보관 제외 1곳', by('active_clients').value === '1곳')
  check('kpi: 30일 기록일 = 일기 1일 + 활동 1일 (오래된 일기 제외)', by('active_days_30').value === '2일 / 30일')
  check('kpi: 이벤트 없으면 처리율은 값 없음', by('events_handled_30').value === null)
  check('kpi: 가입 없으면 가입 지표도 값 없음', by('signups_30').value === null && by('signups_30').group === 'adoption')
  {
    const recentAt = `${shiftDate(TODAY, -3)}T12:00:00.000Z`
    const sEvents = [
      ev({ id: 's1', eventType: 'customer_signed_up', status: 'new', occurredAt: recentAt }),
      ev({ id: 's2', eventType: 'customer_signed_up', status: 'linked', operationsClientId: 'k1', occurredAt: recentAt }),
      ev({ id: 's3', eventType: 'customer_signed_up', status: 'ignored', occurredAt: recentAt }),
      ev({ id: 's-old', eventType: 'customer_signed_up', status: 'resolved', occurredAt: `${shiftDate(TODAY, -40)}T12:00:00.000Z` }),
      ev({ id: 'r1', eventType: 'consultation_requested', status: 'resolved', occurredAt: recentAt }),
    ]
    const sk = buildKpis({ records: [k1], journal: [], events: sEvents, today: TODAY }).find((m) => m.key === 'signups_30')!
    check('kpi: 30일 가입 3명 중 고객사 연결 1명 (40일 전 · 상담 신청 제외)', sk.value === '3명 · 고객사 연결 1명', String(sk.value))
    check('kpi: 가입 지표 근거 수 = 가입 수', sk.basis === 3)
  }
  const summary = kpiStatusSummary(kpis)
  check('kpi: 상태 요약 합이 지표 수', summary.measured + summary.baseline_forming + summary.unknown === kpis.length)
  check('kpi: 목표치 필드가 없다 (숫자 발명 금지)', kpis.every((m) => !('target' in m)))
}

/* ------------------------------------------------------------------ */
/* 회사 기본 정보 — 업체를 열면 바로 보이는 값들                          */
/* ------------------------------------------------------------------ */
{
  const TODAY = '2026-09-07'
  const rec = normalizeClientOps({
    id: 'p1',
    companyName: '한솔테크(주)',
    establishedAt: '2019-03-05',
    businessNumber: '123-45-67890',
    corporateNumber: '110111-1234567',
    businessAddress: '서울시 강남구 …',
    representativeName: '김대표',
    representativeBirth: '1980-12-31',
    contactName: '이과장',
    contactTitle: '부장',
    employeeCount: '5명(대표 포함)',
    shareholders: '대표 60% · 배우자 40%',
    contactPhone: '010-1111-2222',
    businessCategory: '제조업',
    businessItem: '간판 및 광고물 제조업',
    businessItemsExtra: '구조용 금속 판제품 및 공작물 제조업 · 전구 및 램프 제조업',
    documents: { jointCertificate: { received: true, issuedAt: '2026-01-10', note: '대표 USB' } },
  } as unknown as Partial<ClientOpsRecord>)
  const fields = profileFields(rec, TODAY)
  const get = (k: string) => fields.find((f) => f.key === k)!

  check('profile: 설립일에 업력이 붙는다', get('establishedAt').value.includes('8년차'))
  check('profile: 대표자와 담당자가 따로 나온다', get('representativeName').value.startsWith('김대표') && get('contactName').value === '이과장 부장')
  check('profile: 상시근로자·지분 구성이 있다', !get('employeeCount').empty && !get('shareholders').empty)
  check('profile: 공동인증서는 받음·발급일·보관 위치만', get('jointCertificate').value === '받음 · 발급 2026-01-10 · 보관: 대표 USB')
  check('profile: 인증서 칸은 복사 버튼을 붙이지 않는다', get('jointCertificate').copyable === false)
  // 자격증명 저장 금지 — 어떤 칸도 비밀번호를 담지 않는다
  check(
    'profile: 비밀번호를 담는 칸이 없다',
    fields.every((f) => !/비밀번호|password|passwd|pw/i.test(f.key + f.label)),
  )
  check('profile: 주민등록번호를 담는 칸이 없다', fields.every((f) => !/주민|resident/i.test(f.label)))
  check('profile: 종목은 대표 하나만 앞에 둔다', get('businessItem').value === '간판 및 광고물 제조업')
  check('profile: 나머지 종목은 따로 한 줄', get('businessItemsExtra').value.includes('전구 및 램프') && get('businessItemsExtra').wide === true)
  // 서류 없이도 채울 수 있어야 한다 — 인증서만 빼고 전부 화면에서 고칠 수 있다
  check(
    'profile: 인증서를 뺀 모든 칸을 화면에서 고칠 수 있다',
    fields.filter((f) => f.group !== 'credential').every((f) => f.edit !== undefined),
  )
  check('profile: 인증서 칸은 화면에서 직접 못 고친다', get('jointCertificate').edit === undefined)
  check('profile: 네 묶음으로 나뉜다', profileFieldsByGroup(rec, TODAY).map((g) => g.group).join() === 'identity,people,contact,credential')

  // 예전 기록 — 대표 이름을 담당자 칸에 넣어 두었던 것
  const old = normalizeClientOps({ id: 'p2', companyName: '옛기록', contactName: '박대표' } as unknown as Partial<ClientOpsRecord>)
  check('profile: 종목이 하나뿐이면 그 외 줄을 두지 않는다', !profileFields(old, TODAY).some((f) => f.key === 'businessItemsExtra'))
  check('profile: 대표자 칸이 비면 담당자 이름으로 대신한다', profileFields(old, TODAY).find((f) => f.key === 'representativeName')!.value === '박대표')
  check('profile: 안 받은 인증서는 미입력이 아니라 안 받음으로 말한다', profileFields(old, TODAY).find((f) => f.key === 'jointCertificate')!.value === '아직 안 받음')
}

/* ------------------------------------------------------------------ */
/* '해당 없음' — 이 회사에는 아예 없는 일                                 */
/* ------------------------------------------------------------------ */
{
  const TODAY = '2026-09-07'
  check('상태: 여섯 단계', SERVICE_STATUS_ORDER.length === 6 && SERVICE_STATUS_ORDER.includes('not_applicable'))
  check('상태: 해당 없음은 굴러가는 중이 아니다', !isServiceOpen('not_applicable'))
  check('상태: 보류도 굴러가는 중이 아니다', !isServiceOpen('on_hold'))
  check('상태: 해당 없음 판정', isServiceNotApplicable('not_applicable') && !isServiceNotApplicable('on_hold'))
  // 예전에 저장해 둔 'not_applicable' 은 원래 뜻으로 되돌아온다 (보류로 바뀌지 않는다)
  check('상태: 저장된 해당 없음을 보류로 바꾸지 않는다', normalizeServiceStatus('not_applicable') === 'not_applicable')
  check('상태: 예전 8단계는 그대로 진행 중으로', normalizeServiceStatus('submitted') === 'in_progress')

  // 특허가 없는 회사에서 특허를 세면 영원히 100% 가 되지 않는다
  const base = normalizeClientOps({ id: 'na1', companyName: '해당없음테스트' } as unknown as Partial<ClientOpsRecord>)
  const allDone = SERVICES.reduce((r, s) => withService(r, s.key, { status: 'done' }), base)
  check('진행률: 전부 완료면 업무 분모를 다 채운다', clientOpsProgress(allDone, TODAY).servicesDone === SERVICES.length)
  const oneNa = withService(allDone, 'patent', { status: 'not_applicable' })
  const p = clientOpsProgress(oneNa, TODAY)
  check('진행률: 해당 없음은 분모에서 빠진다', p.servicesTotal === SERVICES.length - 1 && p.servicesDone === SERVICES.length - 1)
}

/* ------------------------------------------------------------------ */
/* 지역 — 목록에 주소 전체를 늘어놓지 않는다                              */
/* ------------------------------------------------------------------ */
check('지역: 도 + 시 (시·군·구 글자는 그대로 둔다)', regionOf('경기도 남양주시 순화궁로 282, 221호') === '경기 남양주시')
check('지역: 특별시', regionOf('서울특별시 강남구 테헤란로 123') === '서울 강남구')
check('지역: 시·군·구가 아니면 앞말만', regionOf('세종특별자치시 한누리대로 2130') === '세종')
check('지역: 빈 주소는 빈 값', regionOf('') === '' && regionOf('   ') === '')

/* ------------------------------------------------------------------ */
/* 계약 단계 — 화면은 3단계, 저장은 예전 값 그대로                        */
/* ------------------------------------------------------------------ */
{
  check('계약: 세 단계', CONTRACT_STAGE_ORDER.join() === 'pre,signed,closed')
  check(
    '계약: 한글 이름',
    CONTRACT_STAGE_LABEL.pre === '계약 전' && CONTRACT_STAGE_LABEL.signed === '계약 완료' && CONTRACT_STAGE_LABEL.closed === '계약 종료',
  )

  // 예전 네 가지 저장 값이 빠짐없이 세 단계 중 하나로 간다
  const legacy: ClientOpsStatus[] = ['active', 'waiting', 'paused', 'completed']
  check('계약: 예전 값이 모두 옮겨진다', legacy.every((v) => CONTRACT_STAGE_ORDER.includes(contractStageOf(v))))
  check('계약: 진행 중·일시 중지 → 계약 완료', contractStageOf('active') === 'signed' && contractStageOf('paused') === 'signed')
  check('계약: 고객 대기 → 계약 전', contractStageOf('waiting') === 'pre')
  check('계약: 종료 → 계약 종료', contractStageOf('completed') === 'closed')

  // 저장 값은 DB check 제약이 받는 네 가지 안에 있어야 한다 (마이그레이션 없이 쓰기 위해)
  const allowed = new Set<string>(legacy)
  check('계약: 저장 값이 DB 가 받는 범위 안', CONTRACT_STAGE_ORDER.every((s) => allowed.has(statusForStage(s))))
  check(
    '계약: 단계 → 저장 → 단계 왕복',
    CONTRACT_STAGE_ORDER.every((s: ContractStage) => contractStageOf(statusForStage(s)) === s),
  )
}

/* ------------------------------------------------------------------ */
/* 번호 서식 — 화면에는 하이픈, 복사는 고를 수 있게                         */
/* ------------------------------------------------------------------ */
{
  // 기록에 어떤 모양으로 들어와 있든 화면은 서류에 적히는 모양으로 보여 준다
  check('번호: 붙은 사업자번호에 하이픈', formatNumberOf('business', '3138112508') === '313-81-12508')
  check('번호: 이미 하이픈이면 그대로', formatNumberOf('business', '313-81-12508') === '313-81-12508')
  check('번호: 법인등록번호 6-7', formatNumberOf('corporate', '1101111234567') === '110111-1234567')
  check('번호: 휴대폰', formatNumberOf('phone', '01023456789') === '010-2345-6789')
  check('번호: 서울 지역번호', formatNumberOf('phone', '0212345678') === '02-1234-5678')
  // 자릿수가 안 맞으면 지어내지 않는다 — 원문 그대로 둔다
  check('번호: 자릿수가 다르면 원문', formatNumberOf('business', '12345') === '12345')
  check('번호: 빈 값은 빈 값', formatNumberOf('phone', '  ') === '')

  check('복사: 숫자만 뽑는다', digitsOf('313-81-12508') === '3138112508')
  check('복사: 숫자가 없으면 원문', digitsOf('없음') === '없음')

  // 설립일이 날것이어도 업력을 읽는다 (날것을 화면에 찍지 않기 위한 전제)
  check('업력: 8자리 설립일', yearsInBusiness('20020216', '2026-09-11')?.nthYear === 25)
  check('업력: 점 구분자', yearsInBusiness('2002.02.16', '2026-09-11')?.nthYear === 25)
  check('업력: 하이픈', yearsInBusiness('2002-02-16', '2026-09-11')?.nthYear === 25)
  check('업력: 못 읽으면 null', yearsInBusiness('언젠가', '2026-09-11') === null)
  check('업력: 말이 안 되는 달은 null', yearsInBusiness('20021316', '2026-09-11') === null)

  // 전체 복사 — 번호에서 하이픈을 뺀 판이 따로 있다
  const rec = normalizeClientOps({
    id: 'c-fmt', companyName: '서식테스트', businessNumber: '3138112508', contactPhone: '01023456789',
  })
  const asIs = profileAsText(rec, '2026-09-11')
  const plain = profileAsText(rec, '2026-09-11', { plainNumbers: true })
  check('전체 복사: 기본은 하이픈 포함', asIs.includes('313-81-12508') && asIs.includes('010-2345-6789'), asIs)
  check('전체 복사: 숫자만 판', plain.includes('3138112508') && plain.includes('01023456789') && !plain.includes('313-81-12508'), plain)
  check('전체 복사: 번호가 아닌 값은 그대로', plain.includes('서식테스트'))

  // 조각마다 따로 복사 — 칸이 나뉜 신청서용
  check('조각: 사업자등록번호 3조각', JSON.stringify(numberSegments('313-81-12508')) === JSON.stringify(['313', '81', '12508']))
  check('조각: 법인등록번호 앞뒤 2조각', JSON.stringify(numberSegments('110111-1234567')) === JSON.stringify(['110111', '1234567']))
  check('조각: 휴대폰 3조각', JSON.stringify(numberSegments('010-2345-6789')) === JSON.stringify(['010', '2345', '6789']))
  check('조각: 나눌 것이 없으면 빈 배열', numberSegments('3138112508').length === 0)
  check('조각: 빈 값', numberSegments('').length === 0 && numberSegments('-').length === 0)
  // 자릿수가 안 맞아 원문 그대로 둔 값은 나누지 않는다 — 조각이 숫자가 아니면 안 나눈다
  check('조각: 숫자가 아닌 조각이 섞이면 안 나눈다', numberSegments('가-나').length === 0 && numberSegments('313-8a-12508').length === 0)
  check('조각: 합치면 보이는 값 그대로', numberSegments('313-81-12508').join('-') === '313-81-12508')
  check('조각: 조각을 이으면 숫자만 판이 된다', numberSegments('313-81-12508').join('') === digitsOf('313-81-12508'))

  // 날짜도 서류 모양으로 — 20020216 을 그대로 찍지 않는다
  check('날짜 서식: 8자리', formatYmd('20020216') === '2002-02-16')
  check('날짜 서식: 점 구분자', formatYmd('2002.2.16') === '2002-02-16')
  check('날짜 서식: 이미 맞는 모양', formatYmd('2002-02-16') === '2002-02-16')
  check('날짜 서식: 못 읽으면 원문 그대로', formatYmd('언젠가') === '언젠가')
  const dated = normalizeClientOps({ id: 'c-date', companyName: '설립일', establishedAt: '20020216' })
  check('설립일 칸: 날것을 찍지 않는다', !profileAsText(dated, '2026-09-11').includes('20020216'), profileAsText(dated, '2026-09-11'))
}

/* ------------------------------------------------------------------ */
/* 계약 — 언제 · 어떤 방식 · 얼마 · 몇 달째                                */
/* ------------------------------------------------------------------ */
{
  const T = '2026-09-11'

  // 사람이 세는 방식 — 계약한 달이 1개월째다
  check('계약 개월: 같은 달', monthsSinceContract('2026-09-01', T) === 1)
  check('계약 개월: 계약일 당일', monthsSinceContract('2026-09-11', T) === 1)
  check('계약 개월: 그 달 계약일 전이면 한 달 덜', monthsSinceContract('2026-08-20', T) === 1)
  check('계약 개월: 그 달 계약일 지나면', monthsSinceContract('2026-08-05', T) === 2)
  check('계약 개월: 해를 넘어', monthsSinceContract('2025-03-15', T) === 18)
  check('계약 개월: 앞날이면 null', monthsSinceContract('2026-12-01', T) === null)
  check('계약 개월: 못 읽으면 null', monthsSinceContract('작년쯤', T) === null)
  check('계약 개월: 빈 칸이면 null', monthsSinceContract('', T) === null)
  check('계약 개월: 8자리도 읽는다', monthsSinceContract('20250315', T) === 18)

  check('계약 표기: 1년 미만', contractAgeText('2026-05-20', T) === '4개월째')
  check('계약 표기: 1년 넘으면 총 개월수 병기', contractAgeText('2025-03-15', T) === '1년 6개월째 (18개월)')
  // 12개월째가 '1년째' 다 — 2025-10-01 계약은 2026-09-11 에 12개월째
  check('계약 표기: 딱 떨어지는 해', contractAgeText('2025-10-01', T) === '1년째 (12개월)', contractAgeText('2025-10-01', T))
  check('계약 표기: 좁은 칸은 괄호 없이', contractAgeShort('2025-03-15', T) === '1년 6개월째')
  check('계약 표기: 못 읽으면 빈 칸', contractAgeText('', T) === '' && contractAgeShort('', T) === '')

  // 요약 — 없는 값을 지어내지 않는다
  const mixed = normalizeClientOps({
    id: 'c-ct1', companyName: '혼합계약',
    contract: {
      signedAt: '2025-03-15', kind: 'mixed', cashAmount: 3_000_000,
      policies: [
        { id: 'p1', insurer: '삼성생명', productName: 'CEO플랜', monthlyPremium: 500_000, startedAt: '2025-04-01', payTerm: '10년납', note: '' },
        { id: 'p2', insurer: '한화손보', productName: '', monthlyPremium: 250_000, startedAt: '', payTerm: '', note: '' },
      ],
      note: '',
    },
  })
  const sm = summarizeContract(mixed.contract, T)
  check('계약 요약: 방식 이름', sm.kindLabel === '현금 + 보험', sm.kindLabel)
  check('계약 요약: 현금과 월납 합계를 한 줄로', sm.moneyText === '현금 3,000,000원 · 월납 750,000원', sm.moneyText)
  check('계약 요약: 보험 건수', sm.policyCount === 2)
  check('계약 요약: 개월수', sm.ageText === '1년 6개월째 (18개월)', sm.ageText)
  check('계약 요약: 월납 합계', monthlyPremiumTotal(mixed.contract) === 750_000)

  const cashOnly = normalizeClientOps({
    id: 'c-ct2', companyName: '현금계약',
    contract: { signedAt: '2024-07-10', kind: 'cash', cashAmount: 8_000_000, policies: [], note: '' },
  })
  const sc = summarizeContract(cashOnly.contract, T)
  check('계약 요약: 현금만이면 월납 줄이 없다', sc.moneyText === '현금 8,000,000원', sc.moneyText)
  check('계약 요약: 보험 없으면 합계 null', monthlyPremiumTotal(cashOnly.contract) === null)

  const empty = normalizeClientOps({ id: 'c-ct3', companyName: '계약없음' })
  const se = summarizeContract(empty.contract, T)
  check('계약 없음: hasAny false', se.hasAny === false)
  check('계약 없음: 모든 줄이 비어 있다', se.ageText === '' && se.kindLabel === '' && se.moneyText === '')
  check('계약 없음: 옛 기록도 빈 계약으로 채워진다', Array.isArray(empty.contract.policies))
  check('계약 있음: hasAny true', sm.hasAny === true)

  // 고쳐 쓰면 활동 기록에 한 줄 남는다
  const changed = withContract(cashOnly, { ...cashOnly.contract, cashAmount: 9_000_000 })
  check('계약 수정: 활동 기록에 남는다', changed.activity[0]?.kind === 'contract', changed.activity[0]?.text)
  const cleared = withContract(cashOnly, { ...cashOnly.contract, cashAmount: null })
  check('계약 수정: 값을 지워도 기록에 남는다', cleared.activity[0]?.kind === 'contract', cleared.activity[0]?.text)
  const untouched = withContract(cashOnly, { ...cashOnly.contract })
  check('계약 수정: 안 바꾸면 기록을 만들지 않는다', untouched.activity.length === cashOnly.activity.length)

  // 해 드린 일 — 이미 저장된 완료 상태를 모아 보여 줄 뿐이다
  const worked = normalizeClientOps({
    id: 'c-ct4', companyName: '이력테스트',
    services: {
      incorporation: { status: 'done', completedAt: '2024-11-08T00:00:00.000Z' },
      patent: { status: 'done', completedAt: '2025-12-03T00:00:00.000Z' },
      venture: { status: 'in_progress' },
      ax: { status: 'waiting_client' },
      policyFund: { status: 'not_started' },
    },
  })
  const dw = doneWorks(worked)
  check('해 드린 일: 끝낸 것만', dw.length === 2, JSON.stringify(dw))
  check('해 드린 일: 최근 것이 위로', dw[0]?.key === 'patent' && dw[1]?.key === 'incorporation')
  check('해 드린 일: 완료 날짜', dw[0]?.at === '2025-12-03', dw[0]?.at)
  check('해 드린 일: 끝나지 않은 것은 빼고', !dw.some((w) => w.key === 'venture' || w.key === 'ax' || w.key === 'policyFund'))
  check('해 드린 일: 아무것도 없으면 빈 목록', doneWorks(empty).length === 0)
}

/* ------------------------------------------------------------------ */
/* 회사 기본 정보 — 직접 만든 칸                                          */
/* ------------------------------------------------------------------ */
{
  const T = '2026-09-11'
  const base = normalizeClientOps({ id: 'c-cf', companyName: '칸테스트', contactName: '김담당' })
  check('직접 만든 칸: 옛 기록은 빈 배열로 채워진다', Array.isArray(base.customFields) && base.customFields.length === 0)

  // 만들기
  const one = withCustomField(base, { group: 'identity', label: '공장 등록번호', value: '충남-2019-0042' })
  check('칸 만들기: 하나 생긴다', one.customFields.length === 1)
  check('칸 만들기: 묶음이 지켜진다', one.customFields[0]?.group === 'identity')
  check('칸 만들기: 활동 기록에 남는다', one.activity[0]?.kind === 'profile' && /공장 등록번호/.test(one.activity[0]?.text ?? ''), one.activity[0]?.text)
  check('칸 만들기: 이름이 비면 만들지 않는다', withCustomField(base, { group: 'people', label: '  ', value: 'x' }).customFields.length === 0)
  check('칸 만들기: 앞뒤 공백은 떼어 낸다', withCustomField(base, { group: 'people', label: ' 세무사 ', value: ' 박세무 ' }).customFields[0]?.label === '세무사')

  // 값이 비어 있어도 칸은 만들어진다 — '아직 안 적은 칸' 으로 남는다
  const blank = withCustomField(base, { group: 'contact', label: '비상 연락처', value: '' })
  check('칸 만들기: 값이 비어도 칸은 남는다', blank.customFields.length === 1 && blank.customFields[0]?.value === '')

  // 고치기 — 이름도 함께
  const id = one.customFields[0]?.id ?? ''
  const fixed = withCustomField(one, { id, group: 'identity', label: '공장등록번호', value: '충남-2019-0043' })
  check('칸 고치기: 새로 만들지 않고 고친다', fixed.customFields.length === 1)
  check('칸 고치기: 이름도 바뀐다', fixed.customFields[0]?.label === '공장등록번호')
  check('칸 고치기: 값도 바뀐다', fixed.customFields[0]?.value === '충남-2019-0043')
  check('칸 고치기: 안 바꾸면 기록을 만들지 않는다', withCustomField(one, { id, group: 'identity', label: '공장 등록번호', value: '충남-2019-0042' }).activity.length === one.activity.length)
  const moved = withCustomField(one, { id, group: 'people', label: '공장 등록번호', value: '충남-2019-0042' })
  check('칸 고치기: 묶음을 옮길 수 있다', moved.customFields[0]?.group === 'people')

  // 지우기
  const gone = withoutCustomField(one, id)
  check('칸 없애기: 사라진다', gone.customFields.length === 0)
  check('칸 없애기: 활동 기록에 남는다', gone.activity[0]?.kind === 'profile' && /지움/.test(gone.activity[0]?.text ?? ''), gone.activity[0]?.text)
  check('칸 없애기: 없는 id 는 아무 일도 없다', withoutCustomField(one, 'nope').customFields.length === 1)

  // 화면 목록에 섞여 나온다
  const shown = profileFields(one, T)
  const mine = shown.find((x) => x.label === '공장 등록번호')
  check('직접 만든 칸: 목록에 나온다', mine !== undefined)
  check('직접 만든 칸: 지울 수 있는 칸으로 표시된다', mine?.custom === id)
  check('직접 만든 칸: 복사할 수 있다', mine?.copyable === true)
  check('직접 만든 칸: 제 묶음에 들어간다', profileFieldsByGroup(one, T).find((g) => g.group === 'identity')?.fields.some((f) => f.custom === id) === true)
  check('직접 만든 칸: 전체 복사에도 들어간다', profileAsText(one, T).includes('공장 등록번호: 충남-2019-0042'))
  check('직접 만든 칸: 값이 비면 아직 안 적은 칸으로 센다', profileFields(blank, T).find((x) => x.label === '비상 연락처')?.empty === true)

  // 표준 칸은 값만 비운다 — 칸 자체는 남는다 (담당자가 대표일 때)
  const cleared = normalizeClientOps({ ...base, contactName: '' })
  const contact = profileFields(cleared, T).find((x) => x.key === 'contactName')
  check('표준 칸: 값을 비우면 빈 칸이 된다', contact?.empty === true)
  check('표준 칸: 비워도 칸은 남는다', contact !== undefined)
  check('표준 칸: 비운 값은 전체 복사에서 빠진다', !profileAsText(cleared, T).includes('담당자:'))

  // 저장된 값이 망가져 있어도 칸을 잃지 않는다
  const messy = normalizeClientOps({
    id: 'c-cf2', companyName: '이상한기록',
    customFields: [
      { id: '', group: 'nowhere', label: '이상한묶음', value: 'v' },
      { id: 'k2', group: 'contact', label: '', value: '이름없음' },
    ] as never,
  })
  check('직접 만든 칸: 묶음이 이상하면 회사로 보낸다', messy.customFields.find((f) => f.label === '이상한묶음')?.group === 'identity')
  check('직접 만든 칸: id 가 없으면 만들어 준다', (messy.customFields.find((f) => f.label === '이상한묶음')?.id ?? '') !== '')
  check('직접 만든 칸: 이름 없는 칸은 버린다', !messy.customFields.some((f) => f.label === ''))
}

/* ------------------------------------------------------------------ */
/* 수금 — 청구액 · 영업자 수수료 · 내 몫 · 이익률                          */
/* ------------------------------------------------------------------ */
{
  // 대표가 든 예시: 2,000만원 중 200만원이 영업자에게 → 내 몫 1,800만원 = 90%
  const m = feeMathOf({ amount: 20_000_000, agentFee: 2_000_000 })
  check('이익률: 2000만 중 200만 나가면 90%', m.marginPct === 90, String(m.marginPct))
  check('내 몫: 1,800만원', m.net === 18_000_000)
  check('이익률 표기: 정수면 소수점 없이', marginText(90) === '90%')
  check('이익률 표기: 소수점 한 자리', marginText(63.6) === '63.6%')

  check('이익률: 수수료가 없으면 100%', feeMathOf({ amount: 5_000_000, agentFee: null }).marginPct === 100)
  check('이익률: 수수료가 0이어도 100%', feeMathOf({ amount: 5_000_000, agentFee: 0 }).marginPct === 100)
  check('이익률: 청구액이 미정이면 null', feeMathOf({ amount: null, agentFee: 1_000_000 }).marginPct === null)
  check('내 몫: 청구액이 미정이면 null', feeMathOf({ amount: null, agentFee: 1_000_000 }).net === null)
  check('이익률: 청구액 0이면 null — 0으로 나누지 않는다', marginPct(0, 100) === null)
  check('이익률: 수수료가 더 크면 음수 그대로', feeMathOf({ amount: 1_000_000, agentFee: 1_500_000 }).marginPct === -50)
  check('이익률: 반올림은 소수점 한 자리', feeMathOf({ amount: 5_500_000, agentFee: 2_000_000 }).marginPct === 63.6)
  check('수수료: 음수는 없는 것으로 본다', feeMathOf({ amount: 1_000_000, agentFee: -5 }).agent === 0)

  // 합계 — 받은 것과 못 받은 것을 '내 몫' 기준으로도 센다
  const rec = normalizeClientOps({
    id: 'c-fee', companyName: '수금테스트',
    fees: [
      { id: 'f1', kind: 'deposit', label: '계약금', amount: 3_000_000, agentFee: null, dueDate: '', receivedAt: '2026-08-25' },
      { id: 'f2', kind: 'success', label: '성공보수', amount: 5_500_000, agentFee: 2_000_000, dueDate: '', receivedAt: null },
      { id: 'f3', kind: 'interim', label: '중도금', amount: null, agentFee: null, dueDate: '', receivedAt: null },
    ] as never,
  })
  const t = feeTotals(rec.fees)
  check('합계: 청구액', t.gross === 8_500_000, String(t.gross))
  check('합계: 영업자 수수료', t.agent === 2_000_000)
  check('합계: 내가 받는 돈', t.net === 6_500_000)
  check('합계: 못 받은 청구액', t.unpaidGross === 5_500_000)
  check('합계: 못 받은 내 돈 — 수수료를 뺀 것', t.unpaidNet === 3_500_000, String(t.unpaidNet))
  check('합계: 이미 받은 내 돈', t.receivedNet === 3_000_000)
  check('합계: 금액 미정은 세되 합산하지 않는다', t.unknownCount === 1)
  check('합계: 전체 이익률', t.marginPct !== null && Math.abs(t.marginPct - 76.5) < 0.05, String(t.marginPct))
  check('합계: 항목이 없으면 0', feeTotals([]).gross === 0 && feeTotals([]).marginPct === null)
  check('수수료: 옛 기록에 칸이 없어도 읽힌다', rec.fees[0]?.agentFee === null)

  // 내 몫 한 줄 — 모든 화면이 같은 함수를 쓴다 (D-74)
  check('내 몫: 청구액 − 수수료', netAmountOf({ amount: 5_500_000, agentFee: 2_000_000 }) === 3_500_000)
  check('내 몫: 수수료가 없으면 청구액 그대로', netAmountOf({ amount: 5_500_000, agentFee: null }) === 5_500_000)
  check('내 몫: 금액 미정은 0 — 합산에서 빠진다', netAmountOf({ amount: null, agentFee: 1_000_000 }) === 0)
  const prog = clientOpsProgress(rec, '2026-09-14')
  check('진행 요약: 못 받은 청구액은 그대로', prog.unpaidAmount === 5_500_000)
  check('진행 요약: 못 받은 내 돈은 수수료를 뺀 것', prog.unpaidNet === 3_500_000, String(prog.unpaidNet))
  const withDue = { ...rec, fees: rec.fees.map((f) => (f.id === 'f2' ? { ...f, dueDate: '2026-09-01' } : f)) }
  const sig = buildMoneySignals([withDue], '2026-09-14')
  check('오늘 돈: 연체 합계는 내 몫', sig.overdue.total === 3_500_000, String(sig.overdue.total))
  check('오늘 돈: 청구 기준은 따로 남긴다', sig.overdue.gross === 5_500_000)
  check('오늘 돈: 수수료가 없는 곳은 내 몫 = 청구', ms.overdue.total === ms.overdue.gross && ms.scheduled.total === ms.scheduled.gross)
  const kpi = buildKpis({ today: '2026-09-14', records: [withDue], journal: [], events: [] }).find((k) => k.key === 'overdue_receivables_now')
  check('KPI: 연체 금액도 내 몫', kpi?.value === '1건 · 3,500,000원', JSON.stringify(kpi))

  // 영업자 이름 — 누구한테 얼마
  const named = withNewFee(rec, { kind: 'success', amount: 4_000_000, agentFee: 1_000_000, agentName: ' 김영업 ' })
  check('영업자 이름: 앞뒤 공백을 지우고 저장', named.fees.at(-1)?.agentName === '김영업')
  check('영업자 이름: 옛 기록에 칸이 없어도 빈 문자열', rec.fees[0]?.agentName === '')
  const named2 = withNewFee(named, { kind: 'interim', amount: 2_000_000, agentFee: 500_000, agentName: '김영업' })
  const shares = agentShares(named2.fees)
  check('영업자별 합계: 같은 이름은 합친다', shares.find((s) => s.name === '김영업')?.amount === 1_500_000, JSON.stringify(shares))
  check('영업자별 합계: 이름 없는 수수료는 "이름 없음"', shares.find((s) => s.name === '이름 없음')?.amount === 2_000_000)
  check('영업자별 합계: 많이 나가는 순', shares[0]?.name === '이름 없음' && shares[1]?.name === '김영업')
  check('영업자별 합계: 수수료 없는 항목은 세지 않는다', agentShares([{ agentFee: null, agentName: '아무개' }]).length === 0)
}

/* ------------------------------------------------------------------ */
/* 업체 검색 — 회사명 말고도 내가 적어 둔 것 전부에서 (D-76)               */
/* ------------------------------------------------------------------ */
{
  let r = normalizeClientOps({
    id: 's1', companyName: '한솔테크', contactName: '박담당', contactPhone: '010-1234-5678',
    corporateNumber: '110111-1234567', businessNumber: '123-45-67890',
  })
  r = withCustomField(r, { group: 'contact', label: '담당 세무사', value: '김세무' })
  r = withNewFee(r, { kind: 'success', amount: 1_000_000, agentFee: 100_000, agentName: '최영업' })
  check('검색: 회사명', matchesClientSearch(r, '한솔'))
  check('검색: 대소문자 무시', matchesClientSearch(r, 'ㅎ') === false && matchesClientSearch(normalizeClientOps({ id: 'x', companyName: 'Acme' }), 'acme'))
  check('검색: 빈 검색어는 전부', matchesClientSearch(r, '  '))
  check('검색: 직접 만든 칸의 값', matchesClientSearch(r, '김세무'))
  check('검색: 직접 만든 칸의 이름', matchesClientSearch(r, '세무사'))
  check('검색: 영업자 이름', matchesClientSearch(r, '최영업'))
  check('검색: 법인번호', matchesClientSearch(r, '110111'))
  check('검색: 전화 뒷자리 — 하이픈 없이', matchesClientSearch(r, '5678'))
  check('검색: 사업자번호 — 하이픈 있게 적어도', matchesClientSearch(r, '123-45'))
  check('검색: 사업자번호 — 하이픈 없이 적어도', matchesClientSearch(r, '12345'))
  check('검색: 없는 말은 안 맞는다', matchesClientSearch(r, '없는회사') === false)
  check('검색: 없는 번호는 안 맞는다', matchesClientSearch(r, '9999') === false)
  check('검색 문자열: 업무 일기 내용은 넣지 않는다', !clientSearchText(r).includes('활동'))

  // 검색 근거 — 어느 칸이 맞았는지 (D-80)
  check('검색 근거: 회사명이 맞으면 말하지 않는다', searchHit(r, '한솔') === null)
  check('검색 근거: 직접 만든 칸', JSON.stringify(searchHit(r, '김세무')) === JSON.stringify({ label: '담당 세무사', value: '김세무' }))
  check('검색 근거: 전화 뒷자리', searchHit(r, '5678')?.label === '담당자 휴대폰')
  check('검색 근거: 영업자', searchHit(r, '최영업')?.label === '영업자')
  check('검색 근거: 안 맞으면 null', searchHit(r, '없음') === null)
  check('검색 근거: 빈 검색어는 null', searchHit(r, '') === null)
}

/* ------------------------------------------------------------------ */
/* 서류 칸 직접 만들기 (D-82)                                            */
/* ------------------------------------------------------------------ */
{
  const T = '2026-09-14'
  let r = normalizeClientOps({ id: 'doc1', companyName: '서류테스트' })
  check('서류 칸: 처음에는 없다', r.customDocuments.length === 0)
  check('서류 칸: 기본 13종', allDocumentMetas(r).length === DOCUMENTS.length)

  r = withCustomDocument(r, { label: ' 법인인감증명서 ', validMonths: 3 })
  const made = r.customDocuments[0]
  check('서류 칸: 앞뒤 공백을 지우고 만든다', made?.label === '법인인감증명서')
  check('서류 칸: 키는 customdoc_ 로 시작한다', isCustomDocumentKey(made?.key ?? ''))
  check('서류 칸: 유효기간이 남는다', made?.validMonths === 3)
  check('서류 칸: 기본 칸 뒤에 붙는다', allDocumentMetas(r).length === DOCUMENTS.length + 1 && allDocumentMetas(r).at(-1)?.label === '법인인감증명서')
  check('서류 칸: 만들면 상태 칸도 생긴다', r.documents[made.key]?.received === false)
  check('서류 칸: 파일을 받는 칸이다', customDocumentMeta(made).needsFile === true)
  check('서류 칸: 이름 없는 칸은 만들지 않는다', withCustomDocument(r, { label: '   ' }).customDocuments.length === 1)
  check('서류 칸: 만든 것이 활동 기록에 남는다', r.activity[0]?.text === '서류 칸 추가 — 법인인감증명서')

  // 진행률·만료가 기본 서류와 똑같이 돈다
  r = withDocument(r, made.key, { received: true, issuedAt: '2026-01-01' })
  const view = documentStatus(made.key, r.documents[made.key], T, documentMetaOf(r, made.key))
  check('서류 칸: 유효기간이 지나면 만료로 본다', view.expired === true && view.expiresOn === '2026-04-01', JSON.stringify(view.expiresOn))
  check('서류 칸: 이름으로 활동 기록', r.activity[0]?.text === '법인인감증명서 받음')
  check('서류 칸: 진행률 분모에 들어간다', clientOpsProgress(r, T).documentsTotal === DOCUMENTS.length + 1)
  r = withDocument(r, made.key, { issuedAt: '2026-09-01' })
  check('서류 칸: 유효하면 보유로 센다', clientOpsProgress(r, T).documentsUsable === 1)

  // 이름 고치기 — 키는 그대로여야 파일이 떨어지지 않는다
  const renamed = withCustomDocument(r, { id: made.id, label: '법인 인감증명서(최신)' })
  check('서류 칸: 이름을 고쳐도 키는 그대로', renamed.customDocuments[0]?.key === made.key)
  check('서류 칸: 이름 변경이 기록에 남는다', renamed.activity[0]?.text.includes('서류 칸 이름 변경'))

  // 없애기 — 정의만 지우고 상태는 남긴다
  const gone = withoutCustomDocument(renamed, made.id)
  check('서류 칸: 없애면 목록에서 빠진다', gone.customDocuments.length === 0)
  check('서류 칸: 없애도 올린 파일 경로는 남는다', gone.documents[made.key]?.received === true)
  check('서류 칸: 없앤 것이 기록에 남는다', gone.activity[0]?.text.includes('서류 칸 없앰'))
  check('서류 칸: 지운 칸의 이름은 기본 서류로 떨어지지 않는다', documentMetaOf(gone, made.key).label === '(지운 서류 칸)')
  check('서류 칸: 없는 id 는 아무 일도 없다', withoutCustomDocument(gone, 'nope') === gone)

  // 다시 읽어도 살아남는다 (payload 저장 — 마이그레이션 없음)
  const round = normalizeClientOps(JSON.parse(JSON.stringify(renamed)))
  check('서류 칸: 저장했다 읽어도 남는다', round.customDocuments[0]?.label === '법인 인감증명서(최신)')
  check('서류 칸: 상태도 함께 남는다', round.documents[made.key]?.issuedAt === '2026-09-01')
  const orphan = normalizeClientOps({ id: 'o', companyName: '고아', documents: { customdoc_zzz: { received: true, storagePath: 'p' } } as never })
  check('서류 칸: 정의가 없어진 상태도 버리지 않는다', orphan.documents.customdoc_zzz?.storagePath === 'p')
  check('서류 칸: 이름 없는 정의는 버린다', normalizeClientOps({ id: 'x', companyName: 'x', customDocuments: [{ label: '  ' }] as never }).customDocuments.length === 0)
  check('서류 칸: 유효기간이 0 이하면 없는 것으로', withCustomDocument(normalizeClientOps({ id: 'y', companyName: 'y' }), { label: 'ㄱ', validMonths: 0 }).customDocuments[0]?.validMonths === null)
  check('서류 칸: 키는 매번 다르다', makeCustomDocumentKey() !== makeCustomDocumentKey())
}

/* ------------------------------------------------------------------ */
/* 서류 종류 판별 — 한꺼번에 올리기 (D-84)                                */
/* ------------------------------------------------------------------ */
{
  const base = normalizeClientOps({ id: 'cls', companyName: '판별' })
  const withSeal = withCustomDocument(base, { label: '법인인감증명서', validMonths: 3 })
  const metas = allDocumentMetas(base)
  const metasSeal = allDocumentMetas(withSeal)
  const biz = `사업자등록증 ( 법인사업자 )
등록번호 : 123-45-67890
법인명(단체명) : 주식회사 한솔테크
개업연월일 : 2020 년 03 월 02 일
사업장 소재지 : 서울특별시 강남구
업 태 : 정보통신업   종 목 : 소프트웨어 개발
교부일자 : 2026 년 08 월 20 일`
  const reg = `등기사항전부증명서(말소사항 포함) - 법인
등기번호 012345   등록번호 110111-1234567
상호 주식회사 한솔테크
회사성립연월일 2020 년 02 월 28 일
1주의 금액 금 5,000 원
임원에 관한 사항  사내이사 김대표  대표이사 김대표
2026년 09월 01일  서울중앙지방법원 등기국`
  const idc = `주민등록증
홍 길 동
900101-1234567
서울특별시 종로구
2015. 03. 02.  서울특별시 종로구청장`
  const sme = `중소기업확인서
확인서 번호 제 2026-1234 호   기업구분 소기업
유효기간 2026.04.01 ~ 2027.03.31
중소벤처기업부장관`
  const hi = `건강보험 자격득실 확인서
가입자 구분 직장가입자  사업장명칭 주식회사 한솔테크
자격취득일 2020.03.02
발급일자 2026년 09월 10일  국민건강보험공단`
  const seal = `법인인감증명서
상호 주식회사 한솔테크   인감 (인)
발급일자 2026년 09월 12일`

  const c1 = classifyDocument({ text: biz, fileName: 'scan001.pdf' }, metas)
  check('판별: 사업자등록증 — 확실', c1.key === 'businessRegistration' && c1.confidence === 'sure', JSON.stringify(c1))
  check('판별: 교부일자를 발급일로 읽는다', c1.issuedAt === '2026-08-20', String(c1.issuedAt))
  check('판별: 근거를 사람 말로', c1.reason.includes('사업자등록증'))
  const c2 = classifyDocument({ text: reg, fileName: 'x.pdf' }, metas)
  check('판별: 등기부등본 — 확실', c2.key === 'corporateRegistry' && c2.confidence === 'sure', JSON.stringify(c2.scores))
  check('판별: 등기부의 마지막 날짜가 발급일', c2.issuedAt === '2026-09-01', String(c2.issuedAt))
  const c3 = classifyDocument({ text: idc, fileName: 'IMG_0001.jpg' }, metas)
  check('판별: 신분증 — 확실', c3.key === 'representativeId' && c3.confidence === 'sure', JSON.stringify(c3.scores))
  const c4 = classifyDocument({ text: sme, fileName: 'a.pdf' }, metas)
  check('판별: 중소기업확인서 — 확실', c4.key === 'smeCertificate' && c4.confidence === 'sure', JSON.stringify(c4.scores))
  const c5 = classifyDocument({ text: hi, fileName: 'b.pdf' }, metas)
  check('판별: 건강보험 득실확인서 — 확실 + 발급일', c5.key === 'healthInsurance' && c5.confidence === 'sure' && c5.issuedAt === '2026-09-10', JSON.stringify(c5))

  // 칸이 없는 알려진 서류 → 이름을 제안한다
  const c6 = classifyDocument({ text: seal, fileName: 'seal.pdf' }, metas)
  check('판별: 칸이 없는 인감증명서는 새 칸을 제안한다', c6.key === null && c6.suggestedLabel === '법인인감증명서' && c6.confidence === 'maybe', JSON.stringify(c6))
  // 같은 이름의 칸이 있으면 그 칸으로
  const c7 = classifyDocument({ text: seal, fileName: 'seal.pdf' }, metasSeal)
  check('판별: 인감증명서 칸이 있으면 그 칸으로 확실', c7.key === withSeal.customDocuments[0].key && c7.confidence === 'sure', JSON.stringify(c7))

  // 글자를 못 읽었을 때 — 파일 이름만으로는 확인 필요
  const c8 = classifyDocument({ text: '', fileName: '한솔 사업자등록증.hwp' }, metas)
  check('판별: 이름만 맞으면 확인 필요', c8.key === 'businessRegistration' && c8.confidence === 'maybe', JSON.stringify(c8))
  const c9 = classifyDocument({ text: '', fileName: 'scan_0042.jpg' }, metas)
  check('판별: 아무 힌트도 없으면 모름', c9.key === null && c9.confidence === 'unknown')
  // 문구가 한둘만 겹치면 확인 필요
  const c10 = classifyDocument({ text: '대표이사 김대표 귀하. 업태 서비스업.', fileName: 'memo.txt' }, metas)
  check('판별: 약한 근거는 확실로 올리지 않는다', c10.confidence !== 'sure', JSON.stringify(c10))
  // 파일을 받지 않는 칸은 후보가 아니다
  check('판별: 휴대폰번호 칸은 후보가 아니다', !Object.keys(c1.scores).includes('representativePhone'))
  // 직접 만든 칸 이름 그대로도 맞춘다
  const withTax = withCustomDocument(base, { label: '국세완납증명서' })
  const c11 = classifyDocument({ text: '국세완납증명서 발급 — 체납액 없음', fileName: 'x.txt' }, allDocumentMetas(withTax))
  check('판별: 직접 만든 칸 이름이 본문에 있으면 그 칸', c11.key === withTax.customDocuments[0].key, JSON.stringify(c11))
  check('발급일: 라벨 뒤 날짜', findIssuedDate('발급일자: 2026.09.10') === '2026-09-10')
  check('발급일: 말이 안 되는 해는 버린다', findIssuedDate('발급일자 1850년 1월 1일') === null)
  check('발급일: 없으면 null', findIssuedDate('아무 날짜 없음') === null)
  check('판별: 알려진 추가 서류 목록에 중복 이름이 없다', new Set(KNOWN_EXTRA_DOCS.map((k) => k.label)).size === KNOWN_EXTRA_DOCS.length)
}

/* ------------------------------------------------------------------ */
/* 세금 계산기 — 원본 계산식 그대로 (D-85). 화면 대조는 e2e/tax-parity.mjs */
/* ------------------------------------------------------------------ */
{
  check('세금: won 은 원본 모양', won(1234567.6) === '1,234,568원' && won(-5) === '-5원' && won(NaN) === '-')
  check('세금: pct 는 소수 한 자리', pct(0.123456) === '12.3%' && pct(0.4, 0) === '40%')
  check('세금: 근로소득 누진세율 — 1억 4천만 원 경계', salaryBracketTax(14000000) === 840000 && Math.round(salaryBracketTax(50000000)) === 6240000)
  check('세금: 상속·증여 세율 — 10억 경계', inheritGiftTax(1000000000) === 240000000)
  check('세금: 증여공제 — 배우자 6억', giftDeduction('배우자') === 600000000 && giftDeduction('타인') === 0)
  check('세금: 예전 누진세율표(퇴직) — 4,600만 경계', Math.round(oldBracketTax(46000000)) === 5820000)
  check('세금: 법인세(지방세 포함) — 2억 경계', corpTaxLocal(200000000) === 20000000)
  check('세금: 2026 종합소득세 — 5천만 원', Math.round(incomeTax9(50000000)) === 6240000)
  check('세금: 근속연수 1년 미만 절상', yearsRoundUp9('2016-01-01', '2026-03-02') === 11 && yearsRoundUp9('2020-01-01', '2020-06-01') === 1)
  const s = computeSalary(10000000)
  check('세금: 월 1,000만 급여의 4대보험(연)', s.insTotal === s.pension + s.health + s.ltc && s.pension === 3756300, String(s.pension))
  check('세금: 계산기 9종, 번호 01~09', TAX_CALCULATORS.length === 9 && TAX_CALCULATORS.map((c) => c.no).join() === '01,02,03,04,05,06,07,08,09')
  for (const c of TAX_CALCULATORS) {
    const v = defaultValues(c)
    for (const sub of c.subs) {
      const out = sub.compute(v)
      check(`세금: ${c.key}/${sub.key} 기본값으로 결과가 나온다`, out.blocks.length > 0 && out.blocks.every((b) => b.lines.length > 0))
      const bad = out.blocks.flatMap((b) => b.lines).filter((l) => l.cls !== 'divider' && (l.v === '' || l.v.includes('NaN') || l.v.includes('undefined')))
      check(`세금: ${c.key}/${sub.key} 값이 비거나 NaN 이 없다`, bad.length === 0, JSON.stringify(bad.slice(0, 2)))
    }
  }
  const ids = new Set<string>()
  let dup = ''
  for (const c of TAX_CALCULATORS) for (const g of [...(c.shared ?? []), ...c.subs.flatMap((s) => s.groups)]) for (const f of g.fields) { if (ids.has(f.id)) dup = f.id; ids.add(f.id) }
  check('세금: 입력 칸 id 가 겹치지 않는다', dup === '', dup)
  // D-109: 09 비상장주식 가치평가 — 크레탑 주식가치 탭과 같은 함수. 기본값을 손으로 푼 값과 맞춘다.
  const base = {
    shares: 138000, ratePct: 10, asset: 3e9, debt: 1e9, reBook: 6e8, reFair: 8e8, severance: 0, goodwill: 0, corpType: '일반법인',
    income: [2.5e8, 5e8, 4.2e8] as [number, number, number], months: [8, 3, 10] as [number, number, number], caps: [0, -2e8, 0] as [number, number, number],
  }
  const uv = unlistedShareValuation(base)
  check('비상장: 순자산가액 = 자산 − 부채 + 부동산 평가차액', uv.netAssetValue === 2.2e9)
  check('비상장: 감자 조정 순손익 (−2천만 · −5백만 · 0)', uv.netIncome.join() === [2.3e8, 4.95e8, 4.2e8].join(), uv.netIncome.join())
  check('비상장: 기업가치 = 순자산 40% + 순손익가치 60% = 33.6억', Math.abs(uv.totalValue - 3.36e9) < 1, String(uv.totalValue))
  check('비상장: 부동산 비율 25% → 자동판정 일반법인', Math.abs(uv.reRatio - 0.25) < 1e-12 && uv.autoType === '일반법인')
  const t3 = calculatorOf('t3')!
  const t3line = t3.subs[0].compute(defaultValues(t3)).blocks[0].lines.find((l) => l.k.startsWith('1주당 평가액'))
  check('비상장: 세금 계산기 09 화면 값 = 같은 함수 값', t3line?.v === won(uv.finalPerShare), `${t3line?.v} vs ${won(uv.finalPerShare)}`)
  const loss = unlistedShareValuation({ ...base, income: [0, 0, -1e8] })
  check('비상장: 손실이면 최저 한도(순자산 × 80%)가 걸린다', loss.finalPerShare === loss.minFloor && loss.minFloor > loss.weightedValue)
  const special = unlistedShareValuation({ ...base, corpType: '특수법인' })
  check('비상장: 특수법인은 순자산 100%', special.wNetAsset === 1 && special.weightedValue === special.perShareNetAsset)
  const heavy = unlistedShareValuation({ ...base, reBook: 1.5e9, reFair: 2e9, corpType: '부동산과다보유법인' })
  check('비상장: 부동산 비율 57% → 자동판정 부동산과다 · 가중 60:40', heavy.autoType === '부동산과다보유법인' && heavy.wNetAsset === 0.6, `${heavy.reRatio}`)
  // D-111: 크레탑 원문 → 주식가치 요약 줄 (저장소 없이도 원문 값으로 계산)
  const tr = (key: string, vals: number[]) => ({ key, trend: { series: vals.map((val, i) => ({ year: 2023 + i, val })), latest: { val: vals[vals.length - 1] } } })
  const cui = { companyInfo: { companyName: '시험회사' }, shares: 200000, trendRows: [tr('netIncome', [1.5, 1.8, 2.02]), tr('totalAssets', [120, 115, 110]), tr('totalLiabilities', [98, 101, 87.4])] }
  const svc = svCurrent(cui as never)
  check('크레탑 주식가치: 원문 값으로 1주당 10,100원', !!svc.r && Math.round(svc.r.finalPerShare) === 10100, String(svc.r?.finalPerShare))
  const lines = svSummaryLines(cui as never)
  check('크레탑 주식가치: 1장 요약 줄 = 1주당 · 기업가치 · 원문 값', lines.length === 3 && lines[1].includes('10,100원') && lines[1].includes('2,020,000,000원') && lines[2].includes('크레탑 원문 값'), lines.join(' / '))
  check('크레탑 주식가치: 발행주식수 없으면 요약 줄 없음', svSummaryLines({ ...cui, shares: null } as never).length === 0)
  check('크레탑 주식가치: 개인사업자는 요약 줄 없음', svSummaryLines({ ...cui, bizForm: { isPersonal: true } } as never).length === 0)
  // 예전 크레탑 간이식((손익×3 + 자산×2) ÷ 5, 최저 한도 없음)과 달라지는 경우 — 손실 법인
  const oldSimple = (loss.perShareIncomeValue * 3 + loss.perShareNetAsset * 2) / 5
  check('비상장: 손실 법인은 예전 간이식보다 높게(최저 한도) 나온다', loss.finalPerShare > oldSimple)
}

// D-110: 휴대폰 머리줄 위 작은 묶음 이름
check('묶음 표시: 영업자 정산 → 영업', screenGroupForPath('/ops/agents')?.title === '영업')
check('묶음 표시: 세금 계산기 → 컨설팅 작업실', screenGroupForPath('/tools/tax')?.title === '컨설팅 작업실')
check('묶음 표시: 모듈 안쪽 화면도 → 컨설팅 작업실', screenGroupForPath('/tools/employment/roster')?.title === '컨설팅 작업실')
check('묶음 표시: 상담신청 · 고객 관리 → 고객', screenGroupForPath('/ops/inbox')?.title === '고객' && screenGroupForPath('/ops/clients/abc')?.title === '고객')
check('묶음 표시: 일정 → 오늘', screenGroupForPath('/ops/calendar')?.title === '오늘')
check('묶음 표시: 오늘 화면은 오늘 › 오늘 이 되므로 없음', screenGroupForPath('/') === null)
check('묶음 표시: 메뉴에 없는 주소는 없음', screenGroupForPath('/zzz-none') === null)

/* ------------------------------------------------------------------ */
/* 영업자 정산 — 누구한테 지금 얼마 (D-78)                               */
/* ------------------------------------------------------------------ */
{
  const fee = (id: string, agentFee: number | null, agentName: string, receivedAt: string | null, agentPaidAt: string | null, label = '성공보수') => ({
    id, label, amount: 1_000_000, agentFee, agentName, receivedAt, agentPaidAt,
  })
  const rows = agentLedger([
    { id: 'a', companyName: '가나', archivedAt: null, fees: [fee('f1', 300_000, '김영업', '2026-09-01', null), fee('f2', 100_000, '김영업', null, null)] },
    { id: 'b', companyName: '다라', archivedAt: null, fees: [fee('f3', 500_000, ' 김영업 ', '2026-08-01', '2026-08-05'), fee('f4', 200_000, '', '2026-09-02', null)] },
    { id: 'c', companyName: '보관', archivedAt: '2026-01-01T00:00:00.000Z', fees: [fee('f5', 900_000, '김영업', '2026-09-01', null)] },
    { id: 'd', companyName: '수수료 없음', archivedAt: null, fees: [fee('f6', null, '박영업', '2026-09-01', null)] },
  ])
  const kim = rows.find((r) => r.name === '김영업')
  check('정산: 같은 이름은 공백을 무시하고 합친다', kim?.total === 900_000, JSON.stringify(kim))
  check('정산: 지금 줄 돈 = 고객 입금됨 · 미지급', kim?.payable === 300_000)
  check('정산: 고객 입금 전은 줄 돈이 아니다', kim?.waiting === 100_000)
  check('정산: 준 돈', kim?.paid === 500_000)
  check('정산: 보관한 업체는 넣지 않는다', !kim?.items.some((i) => i.clientId === 'c'))
  check('정산: 수수료 없는 항목은 넣지 않는다', !rows.some((r) => r.name === '박영업'))
  check('정산: 이름 없는 수수료는 "이름 없음"', rows.find((r) => r.name === '이름 없음')?.payable === 200_000)
  check('정산: 줄 돈 많은 사람이 위', rows[0]?.name === '김영업')
  check('정산: 항목은 줄 돈 → 입금 전 → 준 돈 순', kim?.items.map((i) => i.feeId).join() === 'f1,f2,f3', kim?.items.map((i) => i.feeId).join())
  const t = agentLedgerTotals(rows)
  check('정산 합계: 줄 돈 · 입금 전 · 준 돈 · 전체', t.payable === 500_000 && t.waiting === 100_000 && t.paid === 500_000 && t.total === 1_100_000 && t.agents === 2, JSON.stringify(t))
  check('정산: 비어 있으면 0', agentLedgerTotals(agentLedger([])).agents === 0)
  // 정규화 — 옛 기록에 지급일 칸이 없어도 null
  const old = normalizeClientOps({ id: 'o', companyName: '옛', fees: [{ id: 'x', kind: 'deposit', label: '계약금', amount: 1, dueDate: '', receivedAt: null }] as never })
  check('정산: 옛 기록의 지급일은 null', old.fees[0]?.agentPaidAt === null)
  const paid = withFee(old, 'x', { agentPaidAt: '2026-09-10' })
  check('정산: 지급일을 적으면 남는다', paid.fees[0]?.agentPaidAt === '2026-09-10')
}

/* ------------------------------------------------------------------ */
/* 고객 목록 보기 (D-79)                                                 */
/* ------------------------------------------------------------------ */
{
  const T = '2026-09-14'
  const base = (id: string, extra: Record<string, unknown>) => normalizeClientOps({ id, companyName: id, ...extra } as never)
  const cash = base('현금', { status: 'active', contract: { signedAt: '2026-01-01', kind: 'cash', cashAmount: 1, policies: [], note: '' } })
  const ins = base('보험', { status: 'active', contract: { signedAt: '2026-01-01', kind: 'insurance', cashAmount: null, policies: [], note: '' } })
  const mixed = base('혼합', { status: 'active', contract: { signedAt: '2026-01-01', kind: 'mixed', cashAmount: 1, policies: [], note: '' } })
  const lead = base('계약전', { status: 'waiting' })
  const closed = base('종료', { status: 'completed' })
  let unpaid = base('미수', { status: 'active' })
  unpaid = withNewFee(unpaid, { kind: 'success', amount: 2_000_000, agentFee: 500_000, dueDate: '2026-09-01' })
  let paidAll = base('완납', { status: 'active' })
  paidAll = withNewFee(paidAll, { kind: 'deposit', amount: 1_000_000, receivedAt: '2026-09-01' })
  const all = [cash, ins, mixed, lead, closed, unpaid, paidAll]
  const names = (k: Parameters<typeof filterClients>[1]) => filterClients(all, k, T).map((r) => r.companyName).join()
  check('보기: 전체는 그대로', filterClients(all, 'all', T).length === 7)
  check('보기: 현금 계약', names('cash') === '현금')
  check('보기: 보험 계약', names('insurance') === '보험')
  check('보기: 현금 + 보험', names('mixed') === '혼합')
  check('보기: 계약 전 — 계약 단계 기준, 종료는 빠진다', names('unsigned') === '계약전', names('unsigned'))
  check('보기: 못 받은 돈 있음 — 내 몫 기준', names('unpaid') === '미수')
  check('보기: 연체 있음 — 예정일 지난 미수금', names('overdue') === '미수')
  check('보기: 완납은 못 받은 돈에 안 나온다', !matchesClientFilter(paidAll, 'unpaid', T))
  check('보기: 키 검사', isClientFilterKey('overdue') && !isClientFilterKey('x') && CLIENT_FILTER_ORDER[0] === 'all')
}

/* ------------------------------------------------------------------ */
/* 고객 목록 정렬                                                        */
/* ------------------------------------------------------------------ */
{
  const T = '2026-09-14'
  const mk = (id: string, name: string, est: string, signed: string) =>
    normalizeClientOps({ id, companyName: name, establishedAt: est, contract: { signedAt: signed, kind: 'cash', cashAmount: null, policies: [], note: '' } as never })
  const list = [
    mk('a', '하늘기업', '2019-01-01', '2026-01-10'),
    mk('b', '가나테크', '2002-02-16', '2024-07-10'),
    mk('c', '나라산업', '', ''),
  ]

  check('정렬: 네 가지', CLIENT_SORT_ORDER.length === 4)
  check('정렬: 모르는 값은 거른다', isClientSortKey('name') && !isClientSortKey('아무거나'))
  check('정렬: 원본을 건드리지 않는다', sortClients(list, 'name', T) !== list && list[0]?.id === 'a')

  const byName = sortClients(list, 'name', T).map((r) => r.companyName)
  check('정렬: 가나다순', JSON.stringify(byName) === JSON.stringify(['가나테크', '나라산업', '하늘기업']), JSON.stringify(byName))

  const byYears = sortClients(list, 'years', T).map((r) => r.id)
  check('정렬: 업력순 — 오래된 회사가 위로', byYears[0] === 'b' && byYears[1] === 'a', JSON.stringify(byYears))
  check('정렬: 업력을 모르는 업체는 맨 뒤', byYears[2] === 'c')

  const byContract = sortClients(list, 'contract', T).map((r) => r.id)
  check('정렬: 계약 오래된 순', byContract[0] === 'b' && byContract[1] === 'a', JSON.stringify(byContract))
  check('정렬: 계약일이 없으면 맨 뒤', byContract[2] === 'c')
  check('정렬: 급한 순도 모두 돌려준다', sortClients(list, 'urgency', T).length === 3)
}


/* ------------------------------------------------------------------ */
/* D-114 영업 통합 1단계 — 영업 칸 · 단계 · 계약 고객 수 · 옛 기록 옮기기     */
/* ------------------------------------------------------------------ */
{
  const at = '2026-09-26T01:00:00.000Z'
  const mk = (id: string, status: ClientOpsStatus, extra: Record<string, unknown> = {}) =>
    normalizeClientOps({ id, workspaceId: null, companyName: `업체${id}`, status, createdAt: at, updatedAt: at, ...extra })

  // 원본 15단계 → 8단계 (PIPE6 대응표)
  const legacyMap: [string, string][] = [
    ['lead', 'lead'], ['contacted', 'lead'], ['meeting_proposed', 'lead'],
    ['meeting1_scheduled', 'm1sched'], ['meeting1_done', 'm1done'], ['docs_requested', 'm1done'], ['docs_received', 'm1done'],
    ['proposal_sent', 'm2'], ['meeting2_scheduled', 'm2'], ['meeting2_done', 'm2'],
    ['closing_scheduled', 'closing'], ['decision_pending', 'closing'], ['contracted', 'contracted'], ['hold', 'hold'], ['lost', 'lost'],
  ]
  check('영업: 원본 15단계가 모두 8단계로 간다', legacyMap.every(([a, b]) => salesStageFrom(a) === b), JSON.stringify(legacyMap.map(([a]) => salesStageFrom(a))))
  check('영업: 새 단계 키는 그대로 · 모르는 값은 null', salesStageFrom('m2') === 'm2' && salesStageFrom('아무거나') === null && salesStageFrom(3) === null)
  check('영업: 8단계 · 흐름 6칸', SALES_STAGE_ORDER.length === 8 && SALES_FLOW_STAGES.length === 6 && !SALES_FLOW_STAGES.includes('hold'))

  // 정규화 — 없으면 null, 이상한 값은 걸러낸다
  check('영업: 영업 칸 없는 옛 업체는 null', mk('x', 'active').sales === null && normalizeSales(undefined) === null && normalizeSales({ stage: '??' }) === null)
  const ns = normalizeSales({ stage: 'docs_requested', source: ' 소개 ', interests: ['절세', '절세', '', 3], expectedFee: -5, history: [{ at, from: null, to: 'contacted' }, { bad: 1 }] })
  check('영업: 정규화 — 옛 단계 키 · 공백 · 중복 관심사 · 음수 수임료 · 깨진 이력',
    ns !== null && ns.stage === 'm1done' && ns.source === '소개' && JSON.stringify(ns.interests) === '["절세"]' && ns.expectedFee === null && ns.history.length === 1 && ns.history[0].to === 'lead',
    JSON.stringify(ns))
  const round = mk('r', 'waiting', { sales: { stage: 'm2', source: '전화', referrer: '', interests: [], concern: '', expectedFee: 3_000_000, history: [], movedAt: at } })
  check('영업: 고객 기록 정규화가 영업 칸을 지킨다(저장 → 다시 읽기)', round.sales?.stage === 'm2' && round.sales.expectedFee === 3_000_000 && normalizeClientOps(JSON.parse(JSON.stringify(round))).sales?.stage === 'm2')

  // 계약 고객 · 잠재고객
  const list = [mk('a', 'active'), mk('b', 'waiting'), mk('c', 'completed'), mk('d', 'paused'), { ...mk('e', 'active'), archivedAt: at }, { ...mk('f', 'waiting'), archivedAt: at }]
  check('영업: 계약 고객 = 보관 안 함 · 계약 전 아님 (a · c · d)', countContractClients(list) === 3 && isContractClient(list[0]) && !isContractClient(list[1]) && !isContractClient(list[4]))
  check('영업: 잠재고객 = 보관 안 함 · 계약 전 (b)', list.filter(isProspect).map((r) => r.id).join() === 'b')
  check('영업: 영업 칸 없는 업체의 칸 — 계약 전이면 잠재, 계약했으면 계약 완료', salesStageOf(list[1]) === 'lead' && salesStageOf(list[0]) === 'contracted' && salesStageOf(list[2]) === 'contracted')
  const groups = groupBySalesStage(list)
  check('영업: 보드 묶음 — 보관한 업체는 빠진다', groups.lead.map((r) => r.id).join() === 'b' && groups.contracted.length === 3 && SALES_STAGE_ORDER.every((s) => Array.isArray(groups[s])))
  const flow = salesInFlow([...list, round])
  check('영업: 진행 중 — 영업 칸 없는 계약 전 업체도 잠재로 센다(보드 · 오늘 · KPI 같은 기준)', flow.list.map((r) => r.id).sort().join() === 'b,r' && flow.fee === 3_000_000, flow.list.map((r) => r.id).join())

  // 단계 옮기기
  const p0 = withNewProspect(mk('p', 'waiting'), '홈페이지 상담신청', at)
  check('영업: 잠재고객 등록 — 잠재 고객 칸 · 유입 · 이력 1 · 활동 기록', p0.sales?.stage === 'lead' && p0.sales.source === '홈페이지 상담신청' && p0.sales.history.length === 1 && p0.activity[0]?.kind === 'sales' && p0.activity[0].text.includes('잠재고객 등록'))
  check('영업: 이미 영업 칸이 있으면 잠재고객 등록은 그대로', withNewProspect(p0, '전화') === p0)
  const at2 = '2026-09-27T02:00:00.000Z'
  const p1 = withSalesStage(p0, 'm1sched', at2)
  check('영업: 단계 옮김 — 이력 · movedAt · 활동 기록 문구', p1.sales?.stage === 'm1sched' && p1.sales.history.length === 2 && p1.sales.history[1].from === 'lead' && p1.sales.movedAt === at2 && p1.activity[0].text === '영업 단계 잠재 고객 → 1차 미팅 예정')
  check('영업: 같은 단계로는 아무것도 안 바뀐다', withSalesStage(p1, 'm1sched') === p1)
  check('영업: 중간 단계는 계약 단계를 건드리지 않는다', p1.status === 'waiting')
  const p2 = withSalesStage(p1, 'contracted', '2026-09-28T03:00:00.000Z')
  check('영업: 계약 완료 → 계약함(진행 중) · 계약일 비어 있으면 그날', p2.status === 'active' && p2.contract.signedAt === '2026-09-28' && isContractClient(p2))
  const signed = { ...p1, contract: { ...p1.contract, signedAt: '2026-09-01' } }
  check('영업: 계약일이 이미 있으면 그대로', withSalesStage(signed, 'contracted').contract.signedAt === '2026-09-01')
  const back = withSalesStage(p2, 'hold')
  check('영업: 계약 뒤 영업 단계를 되돌려도 계약은 취소하지 않는다', back.status === 'active' && back.sales?.stage === 'hold')
  const old = withSalesStage(mk('o', 'active'), 'hold', at2)
  check('영업: 영업 칸 없던 계약 고객 — 계약 완료 칸에서 출발', old.sales?.history[0].from === 'contracted' && old.activity[0].text === '영업 단계 계약 완료 → 보류·장기관리')
  check('영업: 머문 날 수', daysInStage(p1, new Date('2026-10-01T02:00:00.000Z')) === 4 && daysInStage(mk('z', 'active')) === null)

  // 영업 정보 고치기
  const i1 = withSalesInfo(p1, { referrer: '김소개', expectedFee: 5_000_000, interests: ['가업승계'] }, at2)
  check('영업: 정보 수정 — 바뀐 칸 이름만 활동 기록에', i1.sales?.referrer === '김소개' && i1.sales.expectedFee === 5_000_000 && i1.activity[0].text === '영업 정보 수정 — 소개자 · 관심사 · 예상 수임료')
  check('영업: 안 바뀌면 그대로', withSalesInfo(i1, { referrer: '김소개' }) === i1)

  // 영업 도구 모음 기록 옮기기
  const recs = [mk('k1', 'waiting'), mk('k2', 'active'), round, mk('k4', 'waiting')]
  const rows = [
    { clientId: 'k1', data: { stage: 'docs_received', dbSource: '소개', referrer: '박소개', interests: ['가지급금'], concern: '가지급금 1.5억', expectedFee: 600, memo: '메모' } },
    { clientId: 'k2', data: { stage: 'contracted', source: '전화', expectedFee: '1,200' } },
    { clientId: 'r', data: { stage: 'lead' } },
    { clientId: 'zz', data: { stage: 'lead' } },
  ]
  const moved = importLegacySalesAccounts(recs, rows, at)
  const k1 = moved.find((r) => r.id === 'k1')
  check('영업: 옮기기 — 영업 칸 없는 업체만 (k1 · k2), 이미 있는 r · 없는 업체 zz 는 건너뜀', moved.map((r) => r.id).join() === 'k1,k2', moved.map((r) => r.id).join())
  check('영업: 옮기기 — 단계 · 유입 · 소개자 · 관심사 · 고민 · 만원→원', k1?.sales?.stage === 'm1done' && k1.sales.source === '소개' && k1.sales.referrer === '박소개' && k1.sales.interests[0] === '가지급금' && k1.sales.concern === '가지급금 1.5억' && k1.sales.expectedFee === 6_000_000)
  check('영업: 옮기기 — 원래 기록 전체를 imported 에 · 활동 기록', k1?.sales?.imported?.memo === '메모' && k1.activity[0].text.includes('영업 도구 모음 기록 옮김'))
  check('영업: 옮기기 — 글자로 적힌 수임료 · source 도 읽는다', moved[1].sales?.expectedFee === 12_000_000 && moved[1].sales.source === '전화')
  check('영업: 옮기기 — 두 번 불러도 같은 결과(이미 옮긴 업체는 건너뜀)', importLegacySalesAccounts(recs.map((r) => moved.find((m) => m.id === r.id) ?? r), rows, at).length === 0)
  check('영업: 옮기기 — 계약 단계는 건드리지 않는다', k1?.status === 'waiting')

  // 메뉴 — 사이드바는 한 줄, 안에서 탭
  const salesItems = MODULES.filter((m) => m.group === 'sales' && m.enabled).map((m) => m.key)
  check('영업: 영업 묶음 = 영업 관리 · 영업자 정산 · 1차 미팅 체크리스트 자리', salesItems.join() === 'sales,agents,first-meeting', salesItems.join())
  check('영업: 영업 관리가 탭 주소를 모두 맡는다', SALES_TAB_PATHS.every((p) => moduleForPath(p)?.key === 'sales') && SALES_TABS[0].to === '/sales/board')
  check('영업: 1차 미팅 체크리스트 자리는 따로 남는다', moduleForPath('/sales/first-meeting')?.key === 'first-meeting' && MODULES.find((m) => m.key === 'first-meeting')?.status === 'soon')
  check('영업: 머리줄 — 영업 › 영업 관리', screenGroupForPath('/sales/board')?.title === '영업')
}

/* ------------------------------------------------------------------ */
/* D-114 2단계 — 미팅 준비 (원본 영업 규칙 엔진 · 고객 기록 다리)            */
/* ------------------------------------------------------------------ */
{
  const at = '2026-09-26T01:00:00.000Z'
  // 원본과 같은가 — 문구가 원본 파일에 그대로 있다
  check('미팅: 전략 17 · 테마 8 · 고객 체크 17', STRATEGY_LIBRARY.length === 17 && Object.keys(MEETING_THEMES).length === 8 && CUST_FLAGS.length === 17)
  check('미팅: 전략 이름 · 맞는 고객 문구가 원본 그대로', STRATEGY_LIBRARY.every((st) => salesAppSource.includes(`name: "${st.name}"`) && salesAppSource.includes(st.pitch)))
  check('미팅: 테마 질문이 원본 그대로', Object.values(MEETING_THEMES).every((t) => t.m1q.every((q) => salesAppSource.includes(q))))

  // 원본 샘플 고객(대성정밀)로 점수 · 추천 · 대본
  const ds = { name: '대성정밀', industry: '제조업', revenue: 3500, empCount: 26, estYears: 18, ceoAge: 58, interests: ['가업승계', '미처분이익잉여금', '주식이동', '정관정비'], concern: '장남 승계', stage: 'meeting2_scheduled', source: '소개', nextDate: '2026-09-30' }
  const sc = scoreLead(ds)
  check('미팅: 원본 샘플 점수 20~88 사이 · 등급', sc >= 20 && sc <= 88 && scoreTier(sc).label.length > 0, String(sc))
  check('미팅: 점수 상한 88 · 하한 20', scoreLead({ ...ds, revenue: 99999, empCount: 999, interests: Object.keys({ 가업승계: 1, 미처분이익잉여금: 1, 가지급금: 1, 연구소: 1 }), stage: 'closing_scheduled' }) === 88 && scoreLead({}) >= 20)
  check('미팅: 등급 경계 85 · 70 · 55 · 40', scoreTier(85).key === 'high' && scoreTier(84).key === 'chase' && scoreTier(70).key === 'chase' && scoreTier(55).key === 'nurture' && scoreTier(40).key === 'long' && scoreTier(39).key === 'low')
  const top = recommendedStrategiesFor(ds)
  check('미팅: 전략 TOP3 — 승계 고객은 가업승계가 먼저', top.length === 3 && top[0].name.includes('가업승계'), top.map((t) => t.name).join())
  check('미팅: 관심사가 없어도 전략 3개', recommendedStrategiesFor({}).length === 3)
  const m1 = buildMeetingPlan(ds, 'm1')
  check('미팅: 1차 — 질문 12개 이하 · 오프닝에 회사 이름 · 자료', m1.questions.length > 0 && m1.questions.length <= 12 && m1.opening.includes('대성정밀') && m1.docs.length > 0)
  const m2 = buildMeetingPlan(ds, 'm2')
  check('미팅: 2차 — 이슈 3 · 거절 대응 · 수임료', m2.topIssues.length === 3 && m2.objections.length >= 3 && m2.fee.includes('만'))
  const m3 = buildMeetingPlan(ds, 'm3')
  check('미팅: 3차 — 제안 · 가격 · 보류 · 계약 카톡', [m3.proposal, m3.priceTalk, m3.holdTalk, m3.contractKakao].every((t) => t.length > 20))
  const lp = buildLeadPlan(ds)
  check('미팅: 첫 연락 — 전화 대본 · 거절 3 · 등급 키', lp.phone.includes('대성정밀') && lp.objections.length === 3 && lp.tier === scoreTier(lp.score).key)
  check('미팅: 후속 카톡은 테마별', followUpKakao(ds).includes('승계') && followUpKakao({ interests: ['연구소'] }).includes('연구개발'))
  const ta = analyzeTranscript('가지급금 정리는 관심 있는데 비용이 부담되고 세무사랑 상의해볼게요')
  check('미팅: 메모 나누기 — 주제 · 망설임 · 반응', ta.issues.includes('가지급금') && ta.hesitant.includes('비용/수임료 부담') && ta.hesitant.includes('가족/세무사 상의 필요') && ta.reaction === '신중·부담 반응 추정', JSON.stringify(ta.hesitant))

  // 고객 기록 → 엔진
  check('미팅: 업종 글 → 원본 업종', engineIndustry('금속 제조') === '제조업' && engineIndustry('소프트웨어 개발') === 'IT/소프트웨어' && engineIndustry('') === '' && engineIndustry('농업') === '농업')
  const rec = normalizeClientOps({ id: 'mt', workspaceId: null, companyName: '미팅테크', industry: '정밀기계 제조', employeeCount: '26명', establishedAt: '2008-03-02', status: 'waiting', nextActionDueDate: '2026-10-01', createdAt: at, updatedAt: at, sales: { stage: 'm1sched', source: '소개', referrer: '', interests: ['절세'], concern: '승계 고민', expectedFee: null, history: [], movedAt: at, ceoAge: 58, revenueM: 3500, flags: { gajigeup: true, childWorks: true }, memo: '메모' } })
  const it = toEngineItem(rec, new Date('2026-09-26T00:00:00Z'))
  check('미팅: 고객 기록 → 엔진 한 줄 (업종 · 직원 · 업력 · 나이 · 매출 · 단계 · 다음 날짜)', it.industry === '제조업' && it.empCount === 26 && it.estYears === 18 && it.ceoAge === 58 && it.revenue === 3500 && it.stage === 'meeting1_scheduled' && it.nextDate === '2026-10-01', JSON.stringify(it))
  check('미팅: 체크 → 관심사 (가지급금 · 자녀 근무 → 가업승계 · 정관정비)', ['절세', '가지급금', '가업승계', '미처분이익잉여금', '정관정비'].every((x) => it.interests?.includes(x)), JSON.stringify(it.interests))
  check('미팅: 영업 칸 새 값이 저장 → 다시 읽기에서 살아남는다', normalizeClientOps(JSON.parse(JSON.stringify(rec))).sales?.flags?.gajigeup === true && rec.sales?.revenueM === 3500 && rec.sales.memo === '메모')
  check('미팅: 차수 — 단계별 기본값 · 기록 뒤 단계', roundForStage('lead') === 1 && roundForStage('m1done') === 2 && roundForStage('closing') === 3 && stageAfterMeeting(1) === 'm1done' && stageAfterMeeting(3) === 'closing')

  // 고객 정보 고치기 · 메모 채우기
  const p1 = withSalesProfile(rec, { ceoAge: 60, flags: { gajigeup: true, childWorks: true } }, at)
  check('미팅: 고객 정보 — 바뀐 것만 기록 (체크는 같아서 빠짐)', p1.sales?.ceoAge === 60 && p1.activity[0].text === '영업 고객 정보 수정 — 대표 나이')
  check('미팅: 고객 정보 — 안 바뀌면 그대로', withSalesProfile(rec, { ceoAge: 58, memo: '메모' }) === rec)
  const bare = normalizeClientOps({ id: 'b', workspaceId: null, companyName: '빈', status: 'waiting', createdAt: at, updatedAt: at, sales: { stage: 'lead', source: '', referrer: '', interests: [], concern: '', expectedFee: null, history: [], movedAt: at } })
  const fm = profileFromMemo(bare, '제조업 매출 35억 직원 26명 대표 58세 자녀 근무 가지급금')
  check('미팅: 메모로 빈 칸 채우기 — 나이 · 매출 · 체크', fm.patch.ceoAge === 58 && fm.patch.revenueM === 3500 && fm.patch.flags?.childWorks === true && fm.patch.flags?.gajigeup === true && fm.filled.length === 3, JSON.stringify(fm))
  check('미팅: 메모로 채우기 — 이미 적은 값은 덮지 않는다', profileFromMemo(rec, '대표 40세 매출 10억').filled.length === 0)

  // 미팅 기록
  const mn = withMeetingNote(rec, { round: 1, text: ' 가지급금 관심 있어요 ', analysis: ta, nextAction: '2차 미팅 준비', nextActionDueDate: '2026-09-30' }, at)
  check('미팅: 기록 — 미팅 목록 · 다음 할 일 · 활동 기록', mn.sales?.meetings?.[0].round === 1 && mn.sales.meetings[0].text === '가지급금 관심 있어요' && mn.nextAction === '2차 미팅 준비' && mn.nextActionDueDate === '2026-09-30' && mn.activity[0].text.startsWith('1차 미팅 기록 — 신중·부담 반응 추정'))
  check('미팅: 기록 — 다음 할 일을 비우면 그대로', withMeetingNote(rec, { round: 2, text: 'x', analysis: ta, nextAction: '' }).nextAction === rec.nextAction)
  check('미팅: 기록 — 단계는 따로 옮긴다(기록만으로는 안 바뀜)', mn.sales?.stage === 'm1sched')

  // 옮기기가 2단계 칸도 가져온다
  const mv = importLegacySalesAccounts([normalizeClientOps({ id: 'lg', workspaceId: null, companyName: '옛', status: 'waiting', createdAt: at, updatedAt: at })], [{ clientId: 'lg', data: { stage: 'lead', ceoAge: 61, revenue: '2000', flags: { hiring: true }, memo: '옛 메모' } }], at)
  check('미팅: 옛 기록 옮기기 — 나이 · 매출 · 체크 · 메모도', mv[0].sales?.ceoAge === 61 && mv[0].sales.revenueM === 2000 && mv[0].sales.flags?.hiring === true && mv[0].sales.memo === '옛 메모')

  check('미팅: 탭 — 영업 보드 · 미팅 준비, 1차 미팅 체크리스트 자리와 다른 주소', SALES_TABS.map((t) => t.to).slice(0, 2).join() === '/sales/board,/sales/meeting' && moduleForPath('/sales/meeting')?.key === 'sales' && moduleForPath('/sales/first-meeting')?.key === 'first-meeting')
}

/* ------------------------------------------------------------------ */
/* D-114 3단계 — 상품 · 제안 · 월납 · 계약 준비                           */
/* ------------------------------------------------------------------ */
{
  const at = '2026-09-26T01:00:00.000Z'
  check('제안: 상품 40 · 8분류 · 제안 상태 9 · 계약 체크 10 · 필수 서류 14', DEFAULT_PACKAGES.length === 40 && PKG_CATEGORIES.length === 8 && PROPOSAL_STATES.length === 9 && CONTRACT_CHECKLIST.length === 10 && REQUIRED_DOCS.length === 14)
  check('제안: 상품 이름 · 가격이 원본 그대로', DEFAULT_PACKAGES.every((p) => salesAppSource.includes(`["${p.name}", "${p.cat}", ${p.fee},`)), DEFAULT_PACKAGES.find((p) => !salesAppSource.includes(`["${p.name}", "${p.cat}", ${p.fee},`))?.name)
  check('제안: 가격 합계(원본 40종) 8,320만원', feeSum(DEFAULT_PACKAGES) === 8320)
  const ds = { name: '대성정밀', industry: '제조업', revenue: 3500, empCount: 26, estYears: 18, ceoAge: 58, interests: ['가업승계', '미처분이익잉여금'], stage: 'meeting2_scheduled', concern: '승계' }
  const mp = matchPackages(ds, DEFAULT_PACKAGES)
  check('제안: 추천 상품 3 — 승계 고객은 가업승계 사전점검 먼저', mp.length === 3 && mp[0].pkg.name === '가업승계 사전점검 패키지', mp.map((x) => x.pkg.name).join())
  const pc = buildProposal(ds, mp.map((x) => x.pkg), 'client')
  const pi = buildProposal(ds, mp.map((x) => x.pkg), 'internal')
  check('제안: 공유용 제안서 — 회사 · 상품 · 요청자료, 내부 영업 포인트 없음', pc.includes('[대성정밀 법인컨설팅 제안 초안]') && pc.includes('가업승계 사전점검 패키지') && pc.includes('■ 요청자료') && !pc.includes('[내부]'))
  check('제안: 내부용 제안서 — 영업 · 클로징 포인트', pi.includes('[내부]'))
  const sd = buildScopeDoc(ds, mp[0].pkg)
  check('제안: 업무범위서 — 범위 · 별도 협의 · 기간', sd.includes('[업무 범위]') && sd.includes('[별도 협의 범위]') && sd.includes('4~8주'))
  // 월납
  const sim = insuranceSim(300, 84, 100)
  check('월납: 300만 × 84개월 = 2억 5,200만', sim.total === 25200 && sim.base === 25200 && manToText(sim.total) === '2억 5,200만원')
  check('월납: 환급률 90% → 목적자금 90%', insuranceSim(100, 84, 90).base === 7560)
  check('월납: 순이익 3.1억 · 월 300만 = 초록(한도 930만)', affordability(300, 31000).level === 'green' && affordability(300, 31000).greenLimit === 930)
  check('월납: 순이익 1억 · 월 500만 = 노랑, 월 700만 = 빨강', affordability(500, 10000).level === 'yellow' && affordability(700, 10000).level === 'red')
  check('월납: 순이익 모르면 판정 안 함', affordability(300, null).level === 'none' && !affordability(300, null).hasBase)
  check('월납: 원본 색 값이 빠졌다', !('color' in affordability(300, 31000)))

  // 가격 고치기
  const first = DEFAULT_PACKAGES[0]
  check('상품표: 고친 가격만 덮는다', catalogWithPrices({ [first.id]: 999 })[0].fee === 999 && catalogWithPrices({})[0].fee === first.fee && catalogWithPrices(null)[1].fee === DEFAULT_PACKAGES[1].fee)
  check('상품표: 원본과 같은 값 · 이상한 값은 저장에서 빠진다', JSON.stringify(cleanPrices({ [first.id]: first.fee, [DEFAULT_PACKAGES[1].id]: 50, zz: 1, [DEFAULT_PACKAGES[2].id]: -1 })) === JSON.stringify({ [DEFAULT_PACKAGES[1].id]: 50 }))

  // 고객 기록 쪽
  const rec = normalizeClientOps({ id: 'pr', workspaceId: null, companyName: '제안상사', industry: '제조', status: 'waiting', createdAt: at, updatedAt: at, sales: { stage: 'closing', source: '소개', referrer: '', interests: ['가업승계'], concern: '', expectedFee: null, history: [], movedAt: at } })
  const pkgs = mp.map((x) => x.pkg)
  const p1 = withProposal(rec, { packages: pkgs.map((p) => p.name), feeManwon: feeSum(pkgs), status: '견적 전달', monthly: { premium: 300, months: 84, rate: 100, netIncome: 31000 } }, at)
  check('제안 저장: 상품 · 합계 · 상태 · 월납 · 예상 수임료(원) · 활동', p1.sales?.proposal?.packages.length === 3 && p1.sales.proposal.feeManwon === 900 && p1.sales.proposal.status === '견적 전달' && p1.sales.proposal.monthly?.premium === 300 && p1.sales.expectedFee === 9_000_000 && p1.activity[0].text.startsWith('제안 저장 — 견적 전달 · 3개 · 900만원 · 월납 300만원'), JSON.stringify(p1.sales?.proposal))
  check('제안 저장: 같은 값이면 그대로', withProposal(p1, { packages: p1.sales!.proposal!.packages, feeManwon: 900, status: '견적 전달', monthly: { premium: 300, months: 84, rate: 100, netIncome: 31000 } }, '2026-09-27T00:00:00.000Z') === p1)
  check('제안 저장: 저장 → 다시 읽기', normalizeClientOps(JSON.parse(JSON.stringify(p1))).sales?.proposal?.monthly?.netIncome === 31000)
  const pit = toProposalItem(p1)
  check('제안 문서 한 줄: 월납 값 · 순이익이 들어간다', pit.proposalMonthlyPremium === 300 && pit.proposalMonths === 84 && pit.netIncome === 31000 && pit.industry === '제조업')
  const c1 = withContractPrep(p1, '제안 범위 확인', true)
  check('계약 준비: 켜고 끄기 · 같은 값이면 그대로', c1.sales?.contractPrep?.includes('제안 범위 확인') === true && withContractPrep(c1, '제안 범위 확인', true) === c1 && withContractPrep(c1, '제안 범위 확인', false).sales?.contractPrep?.length === 0)
  const k1 = withContractFromProposal(c1, pkgs, '2026-09-28T03:00:00.000Z')
  check('계약 완료: 계약함 · 계약일 · 영업 단계 · 제안 상태', k1.status === 'active' && k1.contract.signedAt === '2026-09-28' && k1.sales?.stage === 'contracted' && k1.sales.proposal?.status === '계약 완료')
  check('계약 완료: 상품마다 수금 항목(계약금 · 상품표 가격 원)', k1.fees.length === rec.fees.length + 3 && k1.fees.some((f) => f.label === '가업승계 사전점검 패키지' && f.amount === 5_000_000 && f.kind === 'deposit'))
  check('계약 완료: 두 번 눌러도 수금 항목은 한 번', withContractFromProposal(k1, pkgs).fees.length === k1.fees.length)
  check('탭: 영업 보드 · 미팅 준비 · 상품·제안', SALES_TABS.map((t) => t.label).slice(0, 3).join() === '영업 보드,미팅 준비,상품·제안' && moduleForPath('/sales/proposal')?.key === 'sales')
}

/* ------------------------------------------------------------------ */
/* D-114 4단계 — 전략 라이브러리 · 영업 신호 · 성과 지표 영업 묶음            */
/* ------------------------------------------------------------------ */
{
  const now = new Date('2026-09-26T03:00:00.000Z')
  const today = '2026-09-26'
  const ago = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString()
  check('라이브러리: 크레탑 무기 34(5분류) · 절세 전략 25 · 제안 주제 7', CRETOP_WEAPONS.reduce((n, g) => n + g.items.length, 0) === 34 && CRETOP_WEAPONS.length === 5 && TAX_STRATEGIES.length === 25 && PROPOSAL_TOPICS.length === 7)
  check('라이브러리: 문구가 원본 그대로', CRETOP_WEAPONS.every((g) => g.items.every((w) => salesAppSource.includes(w.q))) && TAX_STRATEGIES.every((t) => salesAppSource.includes(`["${t.name}", "${t.cat}"`)))

  const mk = (id: string, extra: Record<string, unknown>) =>
    normalizeClientOps({ id, workspaceId: null, companyName: id, status: 'waiting', createdAt: ago(100), updatedAt: ago(100), ...extra })
  const sales = (stage: string, more: Record<string, unknown> = {}) => ({ stage, source: '', referrer: '', interests: [], concern: '', expectedFee: null, history: [{ at: ago(10), from: null, to: stage }], movedAt: ago(10), ...more })
  const overdue = mk('지난일', { nextActionDueDate: '2026-09-20', sales: sales('m1done') })
  const proposed = mk('제안후', { sales: sales('m2', { proposal: { packages: ['a'], feeManwon: 100, status: '제안 완료', at: '2026-09-10' } }), activity: [{ id: 'x', kind: 'sales', text: 't', serviceKey: null, at: ago(9) }] })
  const quoted = mk('견적후', { sales: sales('m2', { proposal: { packages: ['a'], feeManwon: 100, status: '견적 전달', at: '2026-09-10' } }), activity: [{ id: 'y', kind: 'sales', text: 't', serviceKey: null, at: ago(1) }] })
  const bigFee = mk('큰수임료', { sales: sales('lead', { expectedFee: 5_000_000 }), activity: [{ id: 'z', kind: 'sales', text: 't', serviceKey: null, at: ago(1) }], nextAction: '연락' })
  const won = mk('계약함', { status: 'active', nextActionDueDate: '2026-09-01', sales: sales('contracted') })
  const calm = mk('조용함', { sales: sales('lead'), nextAction: '연락', activity: [{ id: 'w', kind: 'sales', text: 't', serviceKey: null, at: ago(1) }] })
  const risks = salesRisks([overdue, proposed, quoted, bigFee, won, calm], today, now)
  const reasonOf = (id: string) => risks.find((r) => r.record.id === id)?.reason ?? ''
  check('신호: 다음 할 일 날짜 지남 (6일)', reasonOf('지난일') === '다음 할 일 날짜 6일 지남', reasonOf('지난일'))
  check('신호: 제안 완료 7일 후속 없음', reasonOf('제안후') === '제안 완료 후 7일 이상 후속 없음', reasonOf('제안후'))
  check('신호: 견적 전달 7일 변화 없음', reasonOf('견적후') === '견적 전달 후 7일 이상 변화 없음')
  check('신호: 예상 수임료 300만+ 인데 미팅 기록 없음', reasonOf('큰수임료') === '예상 수임료 높은데 미팅 기록 없음')
  check('신호: 계약 완료 · 이상 없는 곳은 안 뜬다', reasonOf('계약함') === '' && reasonOf('조용함') === '')
  check('신호: 마지막 활동 = 활동 · 미팅 · 단계 · 수정 중 가장 최근', lastSalesTouch(quoted) === ago(1) && lastSalesTouch(mk('빈', {})) === ago(100))

  const old = mk('오래됨', { employeeCount: '12명', sales: sales('m1done', { interests: ['연구소'], movedAt: ago(80), history: [{ at: ago(80), from: null, to: 'm1done' }] }) })
  const held = mk('보류됨', { sales: sales('hold', { movedAt: ago(40), history: [{ at: ago(40), from: null, to: 'hold' }] }), activity: [{ id: 'h', kind: 'sales', text: 't', serviceKey: null, at: ago(40) }] })
  const fresh = mk('최근', { employeeCount: '30', sales: sales('lead'), activity: [{ id: 'f', kind: 'sales', text: 't', serviceKey: null, at: ago(2) }] })
  const rc = salesRecontacts([old, held, fresh], now)
  check('다시 연락: 60일 조용 · 보류 30일 지남만, 오래된 순', rc.map((r) => r.record.id).join() === '오래됨,보류됨', rc.map((r) => r.record.id).join())
  check('다시 연락: 직원만 있다고 올리지 않는다(원본과 다른 점)', !rc.some((r) => r.record.id === '최근'))
  check('다시 연락: 이유 2개까지 · 연락 문구', rc[0].reasons.length === 2 && rc[0].reasons[1].includes('고용지원금') && rc[0].ment.startsWith('오래됨 대표님, 최근 60일'))

  const topicRd = PROPOSAL_TOPICS.find((t) => t.key === 'rd')!
  const rdHit = customersForTopic([mk('연구', { sales: sales('lead', { interests: ['연구소'] }) }), mk('제조사', { industry: '금속 제조', sales: sales('lead') }), mk('무관', { sales: sales('lead') }), { ...mk('보관', { sales: sales('lead', { interests: ['연구소'] }) }), archivedAt: ago(1) }], topicRd)
  check('주제별 고객: 관심사 · 업종 낱말로, 보관 · 이탈 빼고', rdHit.map((r) => r.id).join() === '연구,제조사', rdHit.map((r) => r.id).join())

  const vr = buildVisitReport({ name: '대성정밀', industry: '제조업', revenue: 3500, empCount: 26, estYears: 18, ceoAge: 58, interests: ['가업승계'], stage: 'meeting1_scheduled' }, 'client', { consultant: '김상호', title: '대표', org: '미래' })
  check('방문 리포트: 사전 점검 · TOP3 · 담당자 줄', vr.includes('[법인컨설팅 사전 점검 리포트]') && vr.includes('우선 검토 후보 TOP 3') && vr.includes('담당: 김상호 대표 · 미래'))

  // 성과 지표 — 영업 묶음
  const k1 = mk('k1', { sales: { ...sales('contracted'), history: [{ at: ago(30), from: null, to: 'lead' }, { at: ago(10), from: 'lead', to: 'contracted' }] } })
  const k2 = mk('k2', { sales: { ...sales('lost'), history: [{ at: ago(30), from: null, to: 'lead' }, { at: ago(5), from: 'lead', to: 'lost' }] } })
  const k3 = mk('k3', { sales: sales('m2', { expectedFee: 2_000_000, history: [{ at: ago(3), from: null, to: 'lead' }] }) })
  const kp = buildKpis({ records: [k1, k2, k3], journal: [], events: [], today })
  const kv = (key: string) => kp.find((m) => m.key === key)
  check('성과 지표: 영업 묶음 — 진행 중 1곳 · 예상 수임료', kv('sales_pipeline')?.value?.startsWith('1곳') === true && kv('sales_pipeline')?.group === 'sales', kv('sales_pipeline')?.value ?? '')
  check('성과 지표: 전환 50% (1/2, 진행 중은 빼고)', kv('sales_win_rate')?.value === '50% (1/2)' && kv('sales_win_rate')?.status === 'baseline_forming', kv('sales_win_rate')?.value ?? '')
  check('성과 지표: 계약까지 20일', kv('sales_days_to_win')?.value === '20일')
  check('성과 지표: 묶음 순서 — 매출 다음 영업', kpisByGroup(kp).map((g) => g.group).join() === 'cost,revenue,sales,scale,adoption')
  check('탭: 영업 보드 · 미팅 준비 · 상품·제안 · 전략', SALES_TABS.map((t) => t.label).join() === '영업 보드,미팅 준비,상품·제안,전략' && moduleForPath('/sales/strategy')?.key === 'sales')
}

/* ------------------------------------------------------------------ */
/* D-119 영업 흐름 한몸 — 크레탑 → 잠재고객 · 미팅 준비 · 영업 흐름 · 작업실 도구 */
/* ------------------------------------------------------------------ */
{
  const at = '2026-09-26T09:00:00.000Z'
  const today = '2026-09-26'
  // 크레탑 규칙 계산을 화면 밖에서 — 원본 buildResult 와 같은 칸
  const ui = analyzeCretopText(cretopCompanyText, null)
  const co = ui.companyInfo ?? {}
  check('크레탑(화면 밖): 회사 · 사업자번호 · 대표 · 대표 나이', co.companyName === '한빛정밀(주)' && co.businessNo === '214-87-35291' && (co as Record<string, unknown>).ceoName === '김한빛' && ui.ceoAge === 64, JSON.stringify(co).slice(0, 200))
  check('크레탑(화면 밖): 주식가치 · 개인사업자 판별 칸도 만든다', 'bizForm' in ui && 'shares' in ui && 'stakeholders' in ui)

  const d = digestCretop(ui)
  check('다리: 회사 정보 — 설립일 YYYY-MM-DD · 직원 23 · 업종', d.company.established === '2008-04-15' && d.company.employees === 23 && d.company.industry.includes('제조업'))
  check('다리: 매출 67억 → 6704 백만원 · 대표 64세', d.revenueM === 6704 && d.ceoAge === 64, `${d.revenueM}`)
  check('다리: 관심사 — 크레탑 추천(검토 권장 이상)에서 · 최대 5', d.interests.length > 0 && d.interests.length <= 5 && d.interests.includes('정책자금') && d.interests.includes('가업승계'), d.interests.join())
  check('다리: 체크 — 가지급금 · 대출', d.flags.gajigeup === true && d.flags.hasLoan === true, JSON.stringify(d.flags))
  check('다리: 고민 한 줄은 진단 요약의 가장 급한 줄', d.concern.includes('현금성 자산'), d.concern)
  check('다리: 순위 26개 · 등급 문턱 80/60/40', d.refs.length === 26 && cretopTier(80) === 'top' && cretopTier(60) === 'rec' && cretopTier(40) === 'cond' && cretopTier(39) === 'low')
  check('다리: PDF 이름 띄어쓰기 정리', tidyCompanyName('테스트산업 ( 주 )') === '테스트산업(주)' && tidyCompanyName('( 주 ) 한빛') === '(주)한빛' && tidyCompanyName('한빛정밀(주)') === '한빛정밀(주)')
  check('다리: 설립일 모양 맞추기', normalizeEstablished('2008.4.5') === '2008-04-05' && normalizeEstablished('2011년') === '2011-01-01' && normalizeEstablished('모름') === '')
  check('다리: 질문 흐름 차수 — A·B·C 1차 · D 2차 · E 3차', FLOW_ROUND.A === 1 && FLOW_ROUND.C === 1 && FLOW_ROUND.D === 2 && FLOW_ROUND.E === 3)

  // 같은 업체 찾기
  const mkc = (id: string, extra: Record<string, unknown> = {}) => normalizeClientOps({ id, workspaceId: null, companyName: id, status: 'waiting', createdAt: at, updatedAt: at, ...extra })
  const other = mkc('다른회사')
  const byBiz = mkc('한빛', { businessNumber: '2148735291' })
  const byName = mkc('한빛정밀 주식회사')
  check('같은 업체: 사업자번호(숫자만) 먼저', findClientForCretop([other, byBiz, byName], d.company)?.id === '한빛')
  check('같은 업체: 이름 — (주) · 주식회사 · 띄어쓰기 무시', findClientForCretop([other, byName], d.company)?.id === '한빛정밀 주식회사' && companyKey('㈜ 한빛 정밀') === '한빛정밀')
  check('같은 업체: 없으면 null', findClientForCretop([other], d.company) === null)

  // 고객 기록에 채우기 — 빈 칸만
  const fresh = mkc('한빛정밀(주)', { representativeName: '직접적은대표' })
  const { record: filled, filled: labels } = applyCretopToClient(fresh, d, { at, source: '소개' })
  check('채우기: 빈 칸만 — 사람이 적은 대표는 그대로', filled.representativeName === '직접적은대표' && filled.businessNumber === '214-87-35291' && filled.employeeCount === '23명' && filled.establishedAt === '2008-04-15' && !labels.includes('대표자'), labels.join())
  check('채우기: 영업 칸 — 잠재 고객 · 유입 경로 · 관심사 · 대표 나이 · 매출', filled.sales?.stage === 'lead' && filled.sales.source === '소개' && filled.sales.interests.includes('정책자금') && filled.sales.ceoAge === 64 && filled.sales.revenueM === 6704)
  check('채우기: 활동 기록 두 줄(등록 · 채움)', filled.activity.length === 2 && filled.activity.some((a) => a.text.startsWith('잠재고객 등록 · 크레탑')) && filled.activity.some((a) => a.text.startsWith('크레탑으로 기본 정보 채움')))
  const withOwn = mkc('기존', { sales: { stage: 'm1done', source: '전화', referrer: '', interests: ['절세'], concern: '내 고민', expectedFee: null, history: [], movedAt: at, ceoAge: 50 } })
  const again = applyCretopToClient(withOwn, d, { at }).record
  check('채우기: 이미 있는 영업 칸 — 단계 · 고민 · 대표 나이는 그대로, 관심사는 합친다', again.sales?.stage === 'm1done' && again.sales.concern === '내 고민' && again.sales.ceoAge === 50 && again.sales.interests[0] === '절세' && again.sales.interests.includes('정책자금'))
  check('채우기: 저장 → 다시 읽기', normalizeClientOps(JSON.parse(JSON.stringify(filled))).sales?.revenueM === 6704)

  // 도구 결과 — 크레탑 분석기 '붙이기' 와 같은 모양 + 순위 · 진단
  const input = cretopResultInput(ui, ['가업승계'])
  check('도구 결과: 제목 · 1장 요약 · 선택 항목', input.toolKey === 'cretop' && input.title === '크레탑 분석' && input.summary.includes('[한빛정밀(주)] 미팅 전 1장 요약') && input.summary.includes('■ 최종 선택 컨설팅 항목'))
  const attached = withToolResult(filled, input)
  const m = cretopForMeeting(attached)
  check('미팅 준비: 붙인 결과에서 순위 · 진단을 다시 꺼낸다', m !== null && m.picks.length === 26 && m.diagnosis.length > 0 && m.selected.join() === '가업승계')
  check('미팅 준비: 선택한 항목이 있으면 그것부터', meetingPicks(m!).map((p) => p.name).join() === '가업승계')
  check('미팅 준비: 전략마다 질문 흐름 A~E · 요청 자료', m!.picks[0].flow.length === 5 && m!.picks[0].flow[0].step === 'A' && m!.picks[0].docs.length > 0)
  const noSel = cretopForMeeting(withToolResult(filled, cretopResultInput(ui)))!
  const top = meetingPicks(noSel)
  check('미팅 준비: 선택이 없으면 검토 권장 이상 · 보유 아님 · 5개', top.length === 5 && top.every((p) => p.score >= 60 && !p.held) && top[0].name === '정책자금', top.map((p) => p.name).join())
  const legacy = withToolResult(fresh, { toolKey: 'cretop', title: '크레탑 분석', verdict: null, verdictLabel: '', summary: '', data: { oneLiner: { company: 'x', risks: ['위험 한 줄'], questions: [], strategies: ['정책자금', '없는전략'] }, selected: [] } })
  const lm = cretopForMeeting(legacy)
  check('미팅 준비: 예전 결과(순위 없음)는 추천 이름으로 · 모르는 이름은 뺀다', lm !== null && lm.picks.map((p) => p.name).join() === '정책자금' && lm.diagnosis[0].text === '위험 한 줄')

  // 작업실 도구 — 관심사 · 크레탑 근거로, 이 업체로 열림, 잠금 표시
  const tools = journeyTools(attached, { today })
  const key = tools.map((t) => t.key)
  check('작업실 도구: 정책자금 · 가업승계 → 정책자금 진단 · 주식가치 · 세금 계산기', key.includes('policy-funding') && key.includes('cretop-value') && key.includes('tax'), key.join())
  check('작업실 도구: 이 업체로 열린다(?client=)', tools.every((t) => t.to.includes(attached.id)))
  check('작업실 도구: 크레탑 근거를 이유로', tools.find((t) => t.key === 'policy-funding')?.reason.startsWith('크레탑 · 정책자금') === true)
  check('작업실 도구: 업력 18년이면 창업감면은 빼고', !key.includes('startup-tax'))
  const young = journeyTools({ ...attached, establishedAt: '2023-03-01' }, { today })
  check('작업실 도구: 업력 7년 이하면 창업감면 판정기', young.some((t) => t.key === 'startup-tax'))
  const locked = journeyTools(attached, { today, access: new Map([['policy-funding', { moduleKey: 'policy-funding', state: 'locked', trialEndsAt: '', updatedAt: '' }]]) })
  check('작업실 도구: 잠긴 모듈은 감추지 않고 잠김', locked.find((t) => t.key === 'policy-funding')?.locked === true && locked.find((t) => t.key === 'tax')?.locked === false)

  // 영업 흐름 여섯 걸음
  const j0 = buildJourney(attached, { today })
  check('영업 흐름: 여섯 걸음 · 잠재 고객은 1차 준비', j0.steps.map((s) => s.key).join() === 'prep,m1,m2,closing,contract,after' && j0.current === 'prep' && j0.steps[0].state === 'now')
  check('영업 흐름: 크레탑을 붙였으면 1차 준비 첫 할 일 체크', j0.steps[0].tasks[0].label === '크레탑 분석' && j0.steps[0].tasks[0].done)
  check('영업 흐름: 1차 미팅 체크리스트(AX) 자리 — 준비 중', j0.steps[0].tasks.some((t) => t.soon === true && t.to === '/sales/first-meeting'))
  const m1 = { ...attached, sales: { ...attached.sales!, stage: 'm1done' as const, meetings: [{ id: 'n', at, round: 1 as const, text: '', reaction: '', issues: [], hesitant: [], nextDocs: ['재무제표', '주주명부'] }] } }
  const j1 = buildJourney(m1, { today })
  check('영업 흐름: 1차 완료 → 1차 미팅 걸음, 기록 체크 · 요청 자료 이름', j1.current === 'm1' && j1.steps[0].state === 'done' && j1.steps[1].tasks[0].done && j1.steps[1].tasks[1].note === '재무제표 · 주주명부')
  const cash = buildJourney(withSalesPath(m1, 'cash', at), { today })
  check('영업 흐름: 현금 계약이면 3차 · 클로징은 건너뛸 수 있음', cash.path === 'cash' && cash.steps[3].state === 'optional' && SALES_PATH_INFO.cash.hint.includes('2차'))
  check('영업 흐름: 법인보험은 3·4차 안내 · 건너뛰지 않음', buildJourney(withSalesPath(m1, 'insurance', at), { today }).steps[3].state === 'next' && SALES_PATH_INFO.insurance.hint.includes('4차'))
  check('계약 경로: 저장 → 다시 읽기 · 활동 기록', normalizeClientOps(JSON.parse(JSON.stringify(withSalesPath(m1, 'step', at)))).sales?.path === 'step' && withSalesPath(m1, 'step', at).activity[0].text === '계약 경로 · 단계별')
  check('계약 경로: 이상한 값은 버린다', normalizeClientOps(JSON.parse(JSON.stringify({ ...m1, sales: { ...m1.sales, path: 'weird' } }))).sales?.path === undefined)
  const won = { ...attached, status: 'active' as const, sales: { ...attached.sales!, stage: 'contracted' as const, proposal: { packages: ['정책자금 컨설팅'], feeManwon: 300, status: '계약 완료', at: today } }, fees: [{ id: 'f', serviceKey: 'policyFund' as never, kind: 'deposit' as const, label: '착수금', amount: 1000000, agentFee: 0, agentName: '', agentPaidAt: '', dueDate: '', receivedAt: '', note: '' }] }
  const jw = buildJourney(won, { today })
  check('영업 흐름: 계약 · 수금 항목까지 → 계약 후 관리', jw.current === 'after' && jw.steps[4].state === 'done')
  check('영업 흐름: 계약 뒤 추가 제안 — 이미 제안한 정책자금은 빼고 크레탑 추천에서', jw.steps[5].tasks.length > 0 && jw.steps[5].tasks.every((t) => t.label.startsWith('추가 제안 · ') && !t.label.includes('정책자금')), jw.steps[5].tasks.map((t) => t.label).join())
  const held = { ...m1, sales: { ...m1.sales, stage: 'hold' as const, history: [{ at, from: null, to: 'lead' as const }, { at, from: 'lead' as const, to: 'm2' as const }, { at, from: 'm2' as const, to: 'hold' as const }] } }
  check('영업 흐름: 보류는 거기까지 갔던 걸음(2차)에서', buildJourney(held, { today }).current === 'm2')
}

/* ------------------------------------------------------------------ */
/* D-120 다음 약속 · 로컬 날짜                                            */
/* ------------------------------------------------------------------ */
{
  const at = '2026-09-26T09:00:00.000Z'
  const mk = (extra: Record<string, unknown> = {}) => normalizeClientOps({ id: 'n1', workspaceId: null, companyName: '약속상사', status: 'waiting', createdAt: at, updatedAt: at, ...extra })
  const lead = mk({ sales: { stage: 'lead', source: '', referrer: '', interests: [], concern: '', expectedFee: null, history: [], movedAt: at } })

  // 날짜 말
  check('다음 약속: 날짜 더하기(달 넘김)', addDaysLocal('2026-09-29', 3) === '2026-10-02' && addDaysLocal('2026-12-31', 1) === '2027-01-01')
  check('다음 약속: 9월 29일(화)', friendlyDate('2026-09-29') === '9월 29일(화)' && friendlyDate('모름') === '모름')
  check('다음 약속: 오늘 · 내일 · 모레 · n일 뒤 · n일 지남', relativeDay('2026-09-26', '2026-09-26') === '오늘' && relativeDay('2026-09-27', '2026-09-26') === '내일' && relativeDay('2026-09-28', '2026-09-26') === '모레' && relativeDay('2026-10-03', '2026-09-26') === '7일 뒤' && relativeDay('2026-09-24', '2026-09-26') === '2일 지남')
  check('다음 약속: 빨리 고르기 5개(오늘 ~ 2주 뒤)', NEXT_QUICK_DAYS.map((q) => q.days).join() === '0,1,3,7,14')
  check('다음 약속: 단계별 자주 쓰는 말', nextSuggestions(lead)[0] === '1차 미팅' && nextSuggestions(mk({ status: 'active' }))[0] === '진행 상황 보고')

  // 바꾸기
  const a = withNextAction(lead, ' 1차 미팅 ', '2026-09-29', { at })
  check('다음 약속: 적기 — 글 · 날짜 · 활동 기록', a.nextAction === '1차 미팅' && a.nextActionDueDate === '2026-09-29' && a.activity[0].text === '다음 할 일 · 1차 미팅 · 2026-09-29')
  check('다음 약속: 같으면 그대로(기록도 안 늘어남)', withNextAction(a, '1차 미팅', '2026-09-29', { at }) === a)
  check('다음 약속: 이상한 날짜는 비운다', withNextAction(lead, '전화', '9/29', { at }).nextActionDueDate === '')
  check('다음 약속: 비우기', withNextAction(a, '', '', { at }).nextAction === '' && withNextAction(a, '', '', { at }).activity[0].text === '다음 할 일 비움')
  check('다음 약속: 잠재 + 1차 미팅 + 날짜면 1차 미팅 예정으로 옮길지 묻는다', suggestsFirstMeeting(lead, '1차 미팅', '2026-09-29') && !suggestsFirstMeeting(lead, '1차 미팅', '') && !suggestsFirstMeeting(lead, '전화', '2026-09-29'))
  const moved = withNextAction(lead, '1차 미팅', '2026-09-29', { moveToM1: true, at })
  check('다음 약속: 옮기기를 고르면 1차 미팅 예정', moved.sales?.stage === 'm1sched' && withNextAction(lead, '1차 미팅', '2026-09-29', { moveToM1: false, at }).sales?.stage === 'lead')

  // 일정 · 오늘
  const ev = buildClientSchedule(a, '2026-09-26').filter((e) => e.kind === 'next')
  check('일정: 다음 약속이 달력에 — 제목 · 남은 날', ev.length === 1 && ev[0].title === '1차 미팅' && ev[0].daysLeft === 3 && ev[0].done === false)
  check('일정: 지나도 끝난 것으로 치지 않는다(바꿀 때까지)', buildClientSchedule(a, '2026-10-05').find((e) => e.kind === 'next')?.done === false)
  check('일정: 날짜가 없으면 달력에 없다', buildClientSchedule(withNextAction(lead, '전화', '', { at }), '2026-09-26').every((e) => e.kind !== 'next'))
  check('일정: 보관한 업체는 없다', buildClientSchedule({ ...a, archivedAt: at }, '2026-09-26').length === 0)

  // 로컬 날짜
  const kstEarly = new Date(2026, 8, 26, 7, 30) // 로컬 9월 26일 오전 7:30
  check('로컬 날짜: 저장 시각 → 로컬 날짜(UTC 가 전날이어도)', localDateOf(kstEarly.toISOString()) === '2026-09-26')
  check('로컬 날짜: 날짜는 그대로 · 빈 값은 빈 글자', localDateOf('2026-09-26') === '2026-09-26' && localDateOf('') === '' && localDateOf(null) === '')
  check('체험 끝나는 날: 오늘 + 14일(하루 당겨지지 않음)', trialEndDate('2026-09-26') === '2026-10-10' && trialEndDate('2026-12-25', 14) === '2027-01-08')
}

/* ------------------------------------------------------------------ */
/* D-121 크레탑 분석기 단독 판매 경계 — 본체(mini · engine · lib)는 OS 를 모른다 */
/* ------------------------------------------------------------------ */
{
  const files = import.meta.glob('../../tools/cretop/{mini,engine,lib}/**/*.{js,jsx,ts}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
  const bad: string[] = []
  for (const [path, src] of Object.entries(files)) {
    if (path.endsWith('.d.ts')) continue
    for (const m of src.matchAll(/(?:import|export)[^'"]*from\s*['"]([^'"]+)['"]/g)) {
      const spec = m[1]
      if (!spec.startsWith('.')) continue
      // 본체 안(./ ../mini ../engine ../lib)만 허용. 예외 둘: 주식가치 계산의 세금 계산(services/taxCalc) ·
      // 테마 색 읽기(tools/shared/brandHex — OS 밖에서는 기본 색으로 돈다)
      const allowed = /services\/taxCalc$|shared\/brandHex$/.test(spec)
      const outside = /^(\.\.\/){2,}/.test(spec) && !allowed
      const toOs = /\/(services|pages|components|config|types|repositories|auth|data)\//.test(spec) && !allowed
      const toSibling = /^\.\.\/(shared|CretopPage|CretopWorkbench|screens)/.test(spec)
      if (outside || toOs || toSibling) bad.push(`${path.replace('../../tools/cretop/', '')} → ${spec}`)
    }
  }
  check('크레탑 단독 경계: 본체 파일이 있다', Object.keys(files).length >= 10, String(Object.keys(files).length))
  check('크레탑 단독 경계: 본체(mini · engine · lib)는 OS(업체 · 영업 · 화면 · 저장소)를 import 하지 않는다 — 예외 taxCalc · brandHex', bad.length === 0, bad.join(' | '))
}

/* ------------------------------------------------------------------ */
/* D-122 안정화 — 돈 칸 · 미루기 · 지운 수금 기록                              */
/* ------------------------------------------------------------------ */
{
  check('돈 칸: 자리점 · 소수점 붙여넣기는 100배가 되지 않는다', wonOf('3,300,000.00') === 3_300_000 && wonOf('1,500,000원') === 1_500_000 && wonOf('1.5') === 1)
  check('돈 칸: 숫자가 없으면 null', wonOf('') === null && wonOf('원') === null && wonOf('.50') === null)
  check('내일로 미루기: 기한이 지났거나 오늘이면 오늘+1', postponedDue('2026-09-20', '2026-09-26') === '2026-09-27' && postponedDue('2026-09-26', '2026-09-26') === '2026-09-27' && postponedDue('', '2026-09-26') === '2026-09-27')
  check('내일로 미루기: 기한이 뒤면 그 다음 날(당겨지지 않는다)', postponedDue('2026-10-05', '2026-09-26') === '2026-10-06')
  const base = normalizeClientOps({ id: 'c_fee', companyName: '지움상사' })
  const withTwo = withNewFee(withNewFee(base, { kind: 'deposit', amount: 3_300_000 }), { kind: 'success', amount: 5_000_000 })
  const target = withTwo.fees[0]
  const paid = withFee(withTwo, target.id, { receivedAt: '2026-09-20' })
  const gone = withoutFee(paid, target.id)
  check('수금 항목 삭제: 그 하나만 지운다', gone.fees.length === 1 && gone.fees[0].id !== target.id)
  check('수금 항목 삭제: 무엇을 얼마 · 입금일까지 활동 기록에 남긴다', gone.activity[0]?.text.includes('수금 항목 삭제') && gone.activity[0].text.includes('3,300,000원') && gone.activity[0].text.includes('입금 2026-09-20'), gone.activity[0]?.text)
  check('수금 항목 삭제: 없는 id 면 그대로', withoutFee(paid, 'nope').fees.length === 2)
}

/* ------------------------------------------------------------------ */
/* D-122 흐름 잇기 — 계약 완료 한 번에 · 차이 · 미팅 → 관심사 · 서류 칸 · 상담신청 · 링크 */
/* ------------------------------------------------------------------ */
{
  const at = '2026-09-26T03:00:00.000Z'
  const lead = withSalesInfo(withNewProspect(normalizeClientOps({ id: 'c_close', companyName: '한번에상사', status: 'waiting' }), '소개', at), { referrer: '최영업', expectedFee: 5_000_000 }, at)
  const past = normalizeClientOps({ id: 'c_past', companyName: '예전', fees: [{ id: 'f1', serviceKey: null, kind: 'deposit', label: 'x', amount: 10_000_000, agentFee: 1_000_000, agentName: '최영업', agentPaidAt: null, dueDate: '', receivedAt: null, note: '' }] })
  check('계약 완료 초안: 영업자 = 소개한 사람 · 예전에 쓴 율(10%)', agentRateOf([past], '최영업') === 10 && contractCloseDraft(lead, { today: '2026-09-26', records: [past, lead] }).agentRatePct === 10)
  const d0 = contractCloseDraft(lead, { today: '2026-09-26' })
  check('계약 완료 초안: 계약일 오늘 · 받을 날 7일 뒤 · 예상 수임료 한 줄', d0.signedAt === '2026-09-26' && d0.dueDate === '2026-10-03' && d0.lines.length === 1 && d0.lines[0].amount === 5_000_000)
  const withProducts = contractCloseDraft(lead, { today: '2026-09-26', products: [{ name: '벤처인증 패키지', fee: 300 }, { name: '정책자금 컨설팅', fee: 500 }] })
  check('계약 완료 초안: 상품마다 한 줄(만원 → 원) · 업무 짐작(벤처 · 정책자금)', withProducts.lines.length === 2 && withProducts.lines[1].amount === 5_000_000 && withProducts.services.includes('venture') && withProducts.services.includes('policyFund'), JSON.stringify(withProducts.services))
  const closed = withContractClose(lead, { ...withProducts, agentName: '최영업', agentRatePct: 10, kind: 'mixed', monthlyPremium: 3_000_000 }, at)
  check('계약 완료: 계약 고객 · 영업 단계 계약 완료', closed.status === 'active' && closed.sales?.stage === 'contracted')
  check('계약 완료: 수금 항목 2개 — 받을 날 · 영업자 · 수수료 10%', closed.fees.length === 2 && closed.fees.every((f) => f.dueDate === '2026-10-03' && f.agentName === '최영업') && closed.fees[0].agentFee === 300_000)
  check('계약 완료: 계약 정보 — 현금 + 보험 · 현금 800만 · 월납 보험 한 줄', closed.contract.kind === 'mixed' && closed.contract.cashAmount === 8_000_000 && closed.contract.policies.length === 1 && closed.contract.policies[0].monthlyPremium === 3_000_000)
  check('계약 완료: 고른 업무는 진행 중으로', closed.services.venture.status === 'in_progress' && closed.services.policyFund.status === 'in_progress')
  const twice = withContractClose(closed, { ...withProducts, agentName: '', agentRatePct: null, kind: 'mixed', monthlyPremium: 3_000_000 }, at)
  check('계약 완료: 두 번 눌러도 수금 · 보험이 두 번 생기지 않는다', twice.fees.length === 2 && twice.contract.policies.length === 1)
  check('계약 · 수금 차이: 같으면 없음 · 다르면 차이', contractGap(closed) === null && contractGap({ ...closed, contract: { ...closed.contract, cashAmount: 10_000_000 } })?.gap === 2_000_000)
  check('계약 경로 → 방식: 현금 · 법인보험 · 종합', PATH_TO_KIND.cash === 'cash' && PATH_TO_KIND.insurance === 'insurance' && PATH_TO_KIND.total === 'mixed')

  check('미팅 주제 → 관심사: 목록에 있는 것만', JSON.stringify(interestsFromIssues(['가지급금', '연구소/세액공제', '특허/상표'])) === JSON.stringify(['가지급금', '연구소']))
  const ta2 = analyzeTranscript('가지급금 정리가 필요하고 연구소도 궁금합니다')
  const met = withMeetingNote(lead, { round: 1, text: '가지급금 정리가 필요하고 연구소도 궁금합니다', analysis: ta2 }, at)
  check('미팅 기록: 나온 주제가 관심사에 더해진다(빼지 않음)', (met.sales?.interests ?? []).includes('가지급금') && (met.sales?.interests ?? []).includes('연구소'))
  const slots = missingDocSlots(lead, ['재무제표(최근 3개년)', '주주명부', '정관', '계정별원장'])
  check('서류 칸: 표준 칸(최근 3개년 재무제표)은 다시 만들지 않는다', !slots.some((x) => x.includes('재무제표')) && slots.includes('주주명부'), JSON.stringify(slots))
  const slotted = withDocSlots(lead, ['주주명부', '정관'])
  check('서류 칸: 만들고, 두 번째에는 없는 것만', slotted.customDocuments.length === 2 && missingDocSlots(slotted, ['주주명부', '정관']).length === 0)

  const fromInbox = withInboxPayload(lead, { message: '가지급금 때문에 상담 받고 싶습니다', program: '정책자금', preferred_contact_time: '평일 오후' }, '2026-09-26')
  check('상담신청 → 영업: 문의 내용 = 대표 고민 · 관심사 · 희망 연락 = 다음 약속', fromInbox.sales?.concern === '가지급금 때문에 상담 받고 싶습니다' && (fromInbox.sales?.interests ?? []).includes('정책자금') && (fromInbox.sales?.interests ?? []).includes('가지급금') && fromInbox.nextAction.startsWith('첫 연락') && fromInbox.nextActionDueDate === '2026-09-26')
  check('영업 신호 링크: 견적 → 상품·제안 · 다음 할 일 → 업체 · 그 밖 → 미팅 준비', salesActionPath('견적 · 업무범위서 보내기', 'x') === '/sales/proposal?client=x' && salesActionPath('다음 할 일 정하기', 'x') === '/ops/clients/x' && salesActionPath('연락하기', 'x') === '/sales/meeting?client=x')
  const withReport = { ...lead, documents: { ...lead.documents, cretopReport: { ...lead.documents.cretopReport, received: true } } }
  const contractStep = buildJourney(withReport, { today: '2026-09-26' }).steps.find((st) => st.key === 'contract')
  check('영업 흐름: 크레탑 보고서만으로는 계약 서류가 끝나지 않는다', contractStep?.tasks.find((t) => t.label === '계약 서류')?.done === false)
}

console.log(`\nmirae-os: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
void (0 as unknown as ClientOpsRecord)
