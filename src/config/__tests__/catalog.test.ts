/**
 * 제품 카탈로그 · 요금제 · 권한 계약 시험 (D-127)
 *  - 카탈로그가 코드의 기능을 빠짐없이 가리키는가 (새 도구가 어느 모듈에도 안 들면 여기서 걸린다)
 *  - BASIC · GROWTH(2) · PRO(4) · ALL 이 요금제 표 그대로 권한이 되는가
 *  - 체험 · 열기 · 잠그기 · 요금제 따름이 요금제와 어떻게 겹치는가
 *  - 가격(창립 · 연 결제 · 행사)을 바꿔도 권한 계산은 그대로인가
 * 실행: npm run test:catalog
 */

import {
  FEATURE_CATALOG,
  MODULE_CATALOG,
  MODULE_CATEGORIES,
  PLAN_CATALOG,
  DEFAULT_PLAN_KEY,
  selectableModules,
  visibleModules,
  type CatalogModule,
} from '../productCatalog'
import { TOOLS } from '../toolRegistry'
import { MODULES, enabledModulesByGroup, screenGroupForPath } from '../moduleRegistry'
import { LAUNCHER_ALL, LAUNCHER_ENTRIES, LAUNCHER_SLOTS, moduleTone, toneClass, type FeatureTone } from '../featureVisual'
import { clientEntryHref, featureForPath, featurePath } from '../featurePaths'
import { ICON_SLOTS, ICON_SPRITE, customIcon, slotIcon, spriteIcon } from '../iconSlots'
import { DEFAULT_CATALOG, defaultSubscription, quote, resolveEntitlements, validateSelection, type Subscription } from '../../services/entitlements'
import type { ModuleAccess } from '../../services/moduleAccess'
import { loadSubscription, saveSubscription } from '../../services/subscription'

let passed = 0
let failed = 0
function check(name: string, cond: boolean, detail?: string): void {
  if (cond) passed += 1
  else {
    failed += 1
    console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

const T = '2026-09-27'
const sub = (planKey: string, selectedModules: string[] = []): Subscription => ({ planKey, selectedModules, updatedAt: '' })
const acc = (moduleKey: string, state: ModuleAccess['state'], trialEndsAt = ''): [string, ModuleAccess] => [moduleKey, { moduleKey, state, trialEndsAt, updatedAt: '' }]
const none = new Map<string, ModuleAccess>()

/* ---- 카탈로그가 코드와 맞는가 ---- */
{
  const moduleKeys = new Set(MODULE_CATALOG.map((m) => m.key))
  check('카탈로그: 모듈 key 가 겹치지 않는다', moduleKeys.size === MODULE_CATALOG.length)
  const ents = MODULE_CATALOG.map((m) => m.entitlementKey)
  check('카탈로그: 권한 이름이 겹치지 않는다', new Set(ents).size === ents.length)
  const toolKeys = new Set(TOOLS.map((t) => t.key))
  check('카탈로그: 모듈 권한 이름이 도구 key 와 겹치지 않는다(예전 도구별 기록과 섞이지 않게)', ents.every((e) => !toolKeys.has(e)))
  check('카탈로그: 모든 기능이 있는 모듈을 가리킨다', FEATURE_CATALOG.every((f) => moduleKeys.has(f.module)), FEATURE_CATALOG.filter((f) => !moduleKeys.has(f.module)).map((f) => f.key).join())
  check('카탈로그: 도구 기능은 toolRegistry 에 있다', FEATURE_CATALOG.filter((f) => f.source === 'tool').every((f) => toolKeys.has(f.key)))
  check('카탈로그: 메뉴 기능은 moduleRegistry 에 있다(D-167: 숨긴 기능은 메뉴에 없다)', FEATURE_CATALOG.filter((f) => f.source === 'nav').every((f) => f.hidden ? !MODULES.some((m) => m.key === f.key) : MODULES.some((m) => m.key === f.key)))
  const orphan = TOOLS.filter((t) => (t.status === 'live' || t.status === 'review' || t.status === 'planned') && !FEATURE_CATALOG.some((f) => f.key === t.key))
  check('카탈로그: 쓰는 도구 · 자리 잡은 도구는 모두 어느 모듈에 든다', orphan.length === 0, orphan.map((t) => t.key).join())
  check('카탈로그: 모든 모듈이 있는 분야를 가리킨다', MODULE_CATALOG.every((m) => MODULE_CATEGORIES.some((c) => c.key === m.category)))
  const vis = visibleModules()
  check('카탈로그: 전문 모듈 다섯 — 기업성장 · 절세·재무 · 기술사업화 · AX 스튜디오 · 웹 스튜디오(정부지원사업은 기업성장 안, D-163)', vis.map((m) => m.name).join('|') === '기업성장|절세·재무|기술사업화|AX 스튜디오|웹 스튜디오', vis.map((m) => m.name).join('|'))
  check('카탈로그: 기본 OS 는 요금제 모듈 목록에 없다', !vis.some((m) => m.includedInBase))
  check('카탈로그: 모든 모듈에 필요한 칸이 있다', MODULE_CATALOG.every((m) => m.key && m.name && m.description && m.category && m.route && m.icon && m.status && typeof m.includedInBase === 'boolean' && typeof m.addonEligible === 'boolean' && 'listPrice' in m && m.entitlementKey && Array.isArray(m.dependencies) && typeof m.visible === 'boolean' && typeof m.order === 'number'))
  check('카탈로그: 모듈마다 쓸 수 있는 기능이 하나 이상', vis.every((m) => FEATURE_CATALOG.some((f) => f.module === m.key && featurePath(f) !== null)))
  check('카탈로그: 가격은 아직 정하지 않음(null) — 화면에 가짜 가격이 없다', MODULE_CATALOG.every((m) => m.listPrice === null) && PLAN_CATALOG.every((p) => p.listPrice === null))
}

/* ---- 요금제 표 ---- */
{
  const by = (k: string) => PLAN_CATALOG.find((p) => p.key === k)
  check('요금제: BASIC · GROWTH · PRO · ALL 순서', PLAN_CATALOG.map((p) => p.key).join() === 'BASIC,GROWTH,PRO,ALL')
  check('요금제: GROWTH 는 2개 · PRO 는 4개 고른다', by('GROWTH')?.selectableModules === 2 && by('PRO')?.selectableModules === 4)
  check('요금제: ALL 은 전부', by('ALL')?.includesAllModules === true && by('BASIC')?.includesAllModules === false)
  check('요금제: 모두 기본 OS 를 담는다', PLAN_CATALOG.every((p) => p.includesBase))
  check('요금제: 아직 고르지 않았으면 ALL — 지금 쓰는 것을 잠그지 않는다', DEFAULT_PLAN_KEY === 'ALL' && defaultSubscription().planKey === 'ALL')
  check('요금제: 고를 수 있는 모듈은 다섯(PRO 4개를 골라도 남는다, D-163)', selectableModules().length === 5)
}

/* ---- 권한 계산 ---- */
{
  const all = resolveEntitlements(defaultSubscription(), none, T)
  check('ALL: 전문 모듈 전부 쓴다', visibleModules().every((m) => all.module(m.key).usable && all.module(m.key).source === 'plan'))
  check('ALL: 기능 전부 쓴다', FEATURE_CATALOG.filter((f) => f.key !== 'cert-os').every((f) => all.feature(f.key).usable))
  check('기본 화면(카탈로그에 없는 기능)은 늘 쓴다', all.feature('client-ops').usable && all.feature('client-ops').source === 'base' && all.feature('client-ops').moduleKey === null)

  const basic = resolveEntitlements(sub('BASIC'), none, T)
  check('BASIC: 기본 OS 는 쓴다', basic.module('basic-os').usable && basic.feature('today').usable)
  check('BASIC: 전문 모듈은 잠김 · 요금제에 없음', visibleModules().every((m) => !basic.module(m.key).usable && basic.module(m.key).source === 'not-in-plan'))
  check('BASIC: 고용지원금 기능 → 기업성장 모듈에 묶여 잠김', !basic.feature('employment').usable && basic.feature('employment').moduleKey === 'growth')
  check('BASIC: 세금 계산기는 한 장짜리라 잠겨도 다 보인다(미리 보기 full)', basic.feature('tax').lockedPreview === 'full')

  const growth = resolveEntitlements(sub('GROWTH', ['growth', 'tax-finance']), none, T)
  check('GROWTH: 고른 둘은 쓴다', growth.module('growth').usable && growth.module('tax-finance').usable && growth.module('growth').source === 'selected')
  check('GROWTH: 안 고른 것은 잠김', !growth.module('ax-studio').usable && !growth.module('web-studio').usable)
  check('GROWTH: 기능이 모듈을 따른다', growth.feature('labcare').usable && growth.feature('cretop').usable && !growth.feature('diagnosis').usable)

  const growth3 = resolveEntitlements(sub('GROWTH', ['growth', 'tax-finance', 'ax-studio']), none, T)
  check('GROWTH: 셋을 골라도 둘만 — 앞의 둘', growth3.module('growth').usable && growth3.module('tax-finance').usable && !growth3.module('ax-studio').usable)

  const pro = resolveEntitlements(sub('PRO', ['growth', 'tax-finance', 'tech-biz', 'ax-studio']), none, T)
  check('PRO: 넷을 쓴다 · 나머지 하나는 잠김', ['growth', 'tax-finance', 'tech-biz', 'ax-studio'].every((k) => pro.module(k).usable) && !pro.module('web-studio').usable)
  check('D-163: 지원사업 알림 · 자금 연계는 기업성장 기능 · 지원사업 알림은 요금제와 상관없이 열림', featureForPath('/grants')?.module === 'growth' && featureForPath('/grants')?.lockedPreview === 'full' && featureForPath('/funding')?.module === 'growth')

  const v1 = validateSelection('GROWTH', ['growth', 'tax-finance', 'ax-studio'])
  check('고르기 검사: 넘치면 알려 준다', !v1.ok && v1.errors.some((e) => e.includes('2개까지')) && v1.selected.length === 2, v1.errors.join())
  const v2 = validateSelection('PRO', ['basic-os', 'growth'])
  check('고르기 검사: 기본 OS 는 고를 것이 아니다', !v2.ok && v2.selected.join() === 'growth', v2.errors.join())
  check('고르기 검사: ALL · BASIC 은 고르지 않는다', validateSelection('ALL', []).ok && validateSelection('BASIC', []).ok && validateSelection('BASIC', ['growth']).selected.length === 0)
  check('고르기 검사: 모르는 요금제는 기본 요금제로', resolveEntitlements(sub('NOPE'), none, T).plan.key === 'ALL')

  // 대표가 따로 정한 것
  const lockedAll = resolveEntitlements(defaultSubscription(), new Map([acc('module.growth', 'locked')]), T)
  check('잠그기: 요금제에 있어도 대표가 잠그면 잠김', !lockedAll.module('growth').usable && lockedAll.module('growth').source === 'locked' && !lockedAll.feature('labcare').usable)
  const trialBasic = resolveEntitlements(sub('BASIC'), new Map([acc('module.ax-studio', 'trial', '2026-10-05')]), T)
  check('체험: 요금제에 없어도 체험 중이면 쓴다 · 남은 날', trialBasic.module('ax-studio').usable && trialBasic.module('ax-studio').label === '체험 8일 남음', trialBasic.module('ax-studio').label)
  const trialOver = resolveEntitlements(sub('BASIC'), new Map([acc('module.ax-studio', 'trial', '2026-09-01')]), T)
  check('체험: 끝나면 잠김 · 체험 끝남', !trialOver.module('ax-studio').usable && trialOver.module('ax-studio').source === 'trial-ended')
  const granted = resolveEntitlements(sub('BASIC'), new Map([acc('module.web-studio', 'open')]), T)
  check('열기: 대표가 열어 두면 쓴다', granted.module('web-studio').usable && granted.module('web-studio').source === 'granted')
  const inherit = resolveEntitlements(sub('BASIC'), new Map([acc('module.web-studio', 'inherit')]), T)
  check('요금제 따름: 따로 정한 것을 무르면 요금제대로', !inherit.module('web-studio').usable && inherit.module('web-studio').source === 'not-in-plan')
  // D-91 때 도구마다 남긴 기록 — 그대로 지킨다
  const legacy = resolveEntitlements(defaultSubscription(), new Map([acc('policy-funding', 'locked')]), T)
  check('예전 도구별 잠금: 그 기능만 잠김 · 모듈의 다른 기능은 쓴다', !legacy.feature('policy-funding').usable && legacy.feature('employment').usable && legacy.module('growth').usable)
  const legacyTrial = resolveEntitlements(sub('BASIC'), new Map([acc('labcare', 'trial', '2026-10-01')]), T)
  check('예전 도구별 체험: 그 기능만 쓴다', legacyTrial.feature('labcare').usable && !legacyTrial.feature('employment').usable)

  // 함께 필요한 모듈 (지금 카탈로그에는 없음 — 카탈로그를 바꿔 끼워 시험)
  const mods: CatalogModule[] = DEFAULT_CATALOG.modules.map((m) => (m.key === 'web-studio' ? { ...m, dependencies: ['ax-studio'] } : m))
  const cat = { ...DEFAULT_CATALOG, modules: mods }
  const dep = resolveEntitlements(sub('GROWTH', ['web-studio', 'growth']), none, T, cat)
  check('함께 필요: WEB STUDIO 가 AX STUDIO 를 요구하면 혼자서는 못 쓴다', !dep.module('web-studio').usable && dep.module('web-studio').source === 'needs-dependency')
  check('함께 필요: 고르기 검사가 먼저 알려 준다', validateSelection('GROWTH', ['web-studio', 'growth'], cat).errors.some((e) => e.includes('AX 스튜디오')))
  const depOk = resolveEntitlements(sub('GROWTH', ['web-studio', 'ax-studio']), none, T, cat)
  check('함께 필요: 둘 다 고르면 쓴다', depOk.module('web-studio').usable && depOk.module('ax-studio').usable)
}

/* ---- 가격 — 기능 코드를 건드리지 않고 바꾼다 ---- */
{
  check('가격: 정하지 않았으면 셈하지 않는다', quote({ kind: 'module', key: 'growth' }, 'month', T) === null)
  const priced = {
    ...DEFAULT_CATALOG,
    modules: DEFAULT_CATALOG.modules.map((m) => (m.key === 'growth' ? { ...m, listPrice: 149000 } : m.key === 'web-studio' ? { ...m, listPrice: 99000 } : m)),
  }
  const m = quote({ kind: 'module', key: 'growth' }, 'month', T, { catalog: priced, rules: [] })
  check('가격: 월 정가', m?.amount === 149000 && m.applied.length === 0)
  const y = quote({ kind: 'module', key: 'growth' }, 'year', T, { catalog: priced, rules: [{ key: 'annual', label: '연 결제 2개월 무료', appliesTo: { kind: 'module' }, period: 'year', kind: 'months-free', value: 2 }] })
  check('가격: 연 결제 — 규칙 한 줄로 2개월 무료', y?.amount === 1490000 && y.applied.join() === '연 결제 2개월 무료', JSON.stringify(y))
  const founder = quote({ kind: 'module', key: 'growth' }, 'month', T, { catalog: priced, rules: [{ key: 'founder', label: '창립 회원가', appliesTo: { kind: 'module', keys: ['growth'] }, kind: 'fixed-monthly', value: 99000 }] })
  check('가격: 창립 회원가 — 규칙 한 줄', founder?.amount === 99000 && founder.applied.join() === '창립 회원가')
  const promo = [{ key: 'fall', label: '가을 행사 20%', appliesTo: { kind: 'module' as const }, kind: 'percent-off' as const, value: 20, validFrom: '2026-09-01', validTo: '2026-09-30' }]
  check('가격: 행사 기간 안', quote({ kind: 'module', key: 'web-studio' }, 'month', T, { catalog: priced, rules: promo })?.amount === 79200)
  check('가격: 행사 기간 밖이면 정가', quote({ kind: 'module', key: 'web-studio' }, 'month', '2026-10-01', { catalog: priced, rules: promo })?.amount === 99000)
  const a = resolveEntitlements(sub('GROWTH', ['growth', 'web-studio']), none, T, DEFAULT_CATALOG)
  const b = resolveEntitlements(sub('GROWTH', ['growth', 'web-studio']), none, T, priced)
  check('가격을 바꿔도 권한은 그대로', [...a.modules.values()].map((e) => `${e.moduleKey}:${e.usable}`).join() === [...b.modules.values()].map((e) => `${e.moduleKey}:${e.usable}`).join())
}

/* ---- 주소 → 기능 · 업체로 열기 ---- */
{
  check('주소: 연구소 안쪽 화면 → labcare', featureForPath('/tools/labcare/reports')?.key === 'labcare')
  check('주소: /funding/catalog → 기관 전략(더 긴 주소가 이김)', featureForPath('/funding/catalog')?.key === 'institutions' && featureForPath('/funding')?.key === 'funding')
  check('주소: 진단 안쪽 → AX STUDIO 진단', featureForPath('/diagnosis/surveys')?.module === 'ax-studio')
  check('주소: 기본 화면은 기능이 아니다', featureForPath('/ops/clients/abc') === null && featureForPath('/') === null && featureForPath('/modules/growth') === null)
  const emp = FEATURE_CATALOG.find((f) => f.key === 'employment')!
  check('업체로 열기: ?client= 를 붙인다', clientEntryHref(emp, 'c1') === '/tools/employment?client=c1')
  const st = FEATURE_CATALOG.find((f) => f.key === 'consulting-studio')!
  check('업체로 열기: 업체 안 탭은 {client} 를 바꾼다', clientEntryHref(st, 'c1') === '/ops/clients/c1?tab=consulting')
  const cert = FEATURE_CATALOG.find((f) => f.key === 'cert-os')!
  check('업체로 열기: 기업인증(D-170) — 업체로 열면 ?client=', clientEntryHref(cert, 'c1') === '/tools/cert-os?client=c1', clientEntryHref(cert, 'c1'))
  const topics = FEATURE_CATALOG.filter((f) => f.clientEntry).map((f) => `${f.clientEntry!.topic}:${f.clientEntry!.verb}`)
  check('업체로 열기: 고용지원금 확인하기 · 정책자금 진단하기 · 절세 계산하기', topics.includes('고용지원금:확인하기') && topics.includes('정책자금:진단하기') && topics.includes('절세:계산하기'), topics.join())
}

/* ---- 메뉴 — 모듈이 늘어도 줄이 늘지 않는다 ---- */
{
  const groups = enabledModulesByGroup()
  const mod = groups.find((g) => g.group.key === 'modules')
  const top = mod?.items.filter((i) => !i.parent) ?? []
  const rare = groups.find((g) => g.group.key === 'rare')?.items.filter((i) => !i.parent) ?? []
  check('메뉴: 전문 모듈 맨 윗줄 = 자주 쓰는 분야 + 출시 예정(D-169) + 모듈 전체, 나머지 분야는 잘 안 쓰는 기능 (D-136)', top.length === visibleModules().filter((m) => !m.rarelyUsed).length + 2 && top.some((i) => i.key === 'cat-upcoming') && rare.length === visibleModules().filter((m) => m.rarelyUsed).length && rare.length === 3, `${top.map((i) => i.label).join('|')} / ${rare.map((i) => i.label).join('|')}`)
  check('메뉴: 도구는 분야 줄 아래에 든다', (mod?.items.filter((i) => i.parent === 'cat-growth').map((i) => i.key) ?? []).includes('tool-employment'))
  check('메뉴: 옛 컨설팅 작업실 · AX 스튜디오 묶음이 없다', !groups.some((g) => g.group.key === 'tools' || g.group.key === 'studio'))
  check('머리줄 묶음: 세금 계산기 → 절세·재무', screenGroupForPath('/tools/tax')?.title === '절세·재무', screenGroupForPath('/tools/tax')?.title)
  check('머리줄 묶음: 기업 진단 → AX 스튜디오', screenGroupForPath('/diagnosis')?.title === 'AX 스튜디오')
}

/* ---- 저장 — 고른 요금제 ---- */
async function storage() {
  const store = new Map<string, string>()
  ;(globalThis as unknown as { localStorage: unknown }).localStorage = {
    get length() {
      return store.size
    },
    key: (i: number) => [...store.keys()][i] ?? null,
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  }
  const first = await loadSubscription(null)
  check('저장: 처음에는 ALL', first.planKey === 'ALL' && first.selectedModules.length === 0)
  await saveSubscription(null, 'GROWTH', ['growth', 'tax-finance', 'ax-studio'])
  const again = await loadSubscription(null)
  check('저장: GROWTH · 둘만 남는다', again.planKey === 'GROWTH' && again.selectedModules.join() === 'growth,tax-finance', JSON.stringify(again))
  await saveSubscription(null, 'PRO', ['growth', 'tax-finance', 'ax-studio', 'web-studio'])
  const rows = JSON.parse(store.get('axmvp.module.system.plan') ?? '[]') as unknown[]
  check('저장: 한 줄을 고쳐 쓴다(쌓이지 않는다)', rows.length === 1)
  check('저장: PRO · 넷', (await loadSubscription(null)).selectedModules.length === 4)
}

await storage()

/* D-282 기능 색 · 바로가기 — 메뉴 표와 같은 줄을 가리키고, 대표 전용 줄은 팀장 메뉴처럼 빠진다 */
{
  const keys = new Set(MODULES.map((m) => m.key))
  check('D-282 바로가기 줄은 모두 메뉴 표에 있다(새 길을 만들지 않는다)', [...LAUNCHER_ENTRIES, LAUNCHER_ALL].every((e) => keys.has(e.module)), [...LAUNCHER_ENTRIES, LAUNCHER_ALL].filter((e) => !keys.has(e.module)).map((e) => e.module).join())
  const visibleFor = (pilot: boolean, caps: string[]) => {
    const vis = new Set(enabledModulesByGroup({ advanced: true, pilot, caps: new Set(caps) }).flatMap((g) => g.items.map((m) => m.key)))
    return LAUNCHER_ENTRIES.filter((e) => vis.has(e.module)).slice(0, LAUNCHER_SLOTS).map((e) => e.module)
  }
  const owner = visibleFor(false, ['can_use_owner_ai_workspace'])
  const pilot = visibleFor(true, [])
  check('D-282 대표 바로가기 7 + 전체 도구 — 고객 관리 · AI 전략실 · 특허 · 벤처 · 자금 · 지원사업 · 영업 · 마케팅 · 일정', owner.join() === 'client-ops,ai-workspace,patent-venture,cat-growth,sales,marketing,calendar', owner.join())
  check('D-282 팀장 바로가기 — 대표 전용(AI 전략실 · 특허 · 벤처 · 마케팅) 없음 · 예비 줄이 채움', !pilot.some((k) => ['ai-workspace', 'patent-venture', 'marketing'].includes(k)) && pilot.length === LAUNCHER_SLOTS, pilot.join())
  check('D-282 기능 권한 없는 대표(구성원)에게도 AI 전략실 바로가기 없음', !visibleFor(false, []).includes('ai-workspace'))
  const want: Record<string, FeatureTone> = { 'client-ops': 'blue', 'ai-workspace': 'purple', 'patent-venture': 'amber', 'cat-growth': 'green', sales: 'orange', marketing: 'coral', calendar: 'teal' }
  check('D-282 기능 색 — 고객 파랑 · AI 보라 · 특허 · 벤처 호박 · 정책자금 초록 · 영업 주황 · 마케팅 산호 · 일정 청록', Object.entries(want).every(([k, t]) => moduleTone(k) === t), Object.keys(want).map((k) => `${k}:${moduleTone(k)}`).join())
  check('D-282 모르는 줄은 회색', moduleTone('settings') === 'slate' && moduleTone('없는줄') === 'slate')
  const tones: FeatureTone[] = ['indigo', 'teal', 'blue', 'purple', 'amber', 'orange', 'coral', 'green', 'cyan', 'rose', 'slate']
  check('D-282 색 클래스는 통째로 적힘(이어 붙이지 않음 — D-26)', tones.every((t) => Object.values(toneClass(t)).every((c) => typeof c === 'string' && c.length > 0 && !c.includes('${'))))
}

/* D-283 아이콘 자리 표 · D-284 대표 아이콘 21개(한 장 그림) — 화면 코드는 그대로, 표에서만 바꾼다 */
{
  const slotKeys = ICON_SLOTS.map((s) => s.key)
  check('D-283 자리 key 겹침 없음', new Set(slotKeys).size === slotKeys.length)
  const catKeys = new Set(MODULE_CATALOG.map((m) => `cat-${m.key}`))
  const known = new Set([...MODULES.map((m) => m.key), ...catKeys, 'more'])
  check('D-283 자리마다 실제 메뉴 줄 · 분야 · 더보기를 가리킴', slotKeys.every((k) => known.has(k)), slotKeys.filter((k) => !known.has(k)).join())
  const need = [...LAUNCHER_ENTRIES.map((e) => e.module), LAUNCHER_ALL.module, 'today', 'calendar', 'client-ops', 'inbox', 'sales', 'more', ...MODULES.filter((m) => moduleTone(m.key) !== 'slate').map((m) => m.key)]
  check('D-283 바로가기 · 아래 메뉴 · 기능 색 줄은 모두 자리 표에 있음(대표가 만들 아이콘 목록)', need.every((k) => slotKeys.includes(k)), need.filter((k) => !slotKeys.includes(k)).join())
  type El = { type: string; props: Record<string, unknown> }
  // D-284 대표 아이콘 21개 — 한 장 그림의 칸 번호 = 받은 파일 번호 - 1
  const idx = ICON_SLOTS.map((s) => s.sprite)
  check('D-284 21곳 모두 대표 아이콘 · 칸 번호 0~20 차례대로(받은 파일 01~21)', ICON_SPRITE.count === 21 && ICON_SLOTS.length === 21 && idx.every((n, i) => n === i), idx.join())
  const name = (ic: unknown) => String((ic as { displayName?: string }).displayName ?? '')
  const slotSet = new Set(slotKeys)
  const slotRows = MODULES.filter((m) => slotSet.has(m.key))
  check('D-284 메뉴 표의 자리 줄은 대표 아이콘 · 자리 없는 줄(전문 모듈 안 기능)은 예전 아이콘 그대로', slotRows.length >= 15 && slotRows.every((m) => name(m.icon) === `SlotIcon(${m.key})`) && MODULES.filter((m) => !slotSet.has(m.key)).every((m) => !name(m.icon).startsWith('SlotIcon(')), slotRows.filter((m) => name(m.icon) !== `SlotIcon(${m.key})`).map((m) => m.key).join())
  check('D-284 제품 카탈로그 분야도 같은 대표 아이콘(모듈 전체 · 업체 화면 모듈 줄)', name(MODULE_CATALOG.find((m) => m.key === 'growth')?.icon) === 'SlotIcon(cat-growth)' && name(MODULE_CATALOG.find((m) => m.key === 'tax-finance')?.icon) === 'SlotIcon(cat-tax-finance)')
  const art = (i: number, key: string, cls: string) => (spriteIcon(i, key) as unknown as (p: { className?: string }) => El)({ className: cls })
  const first = art(0, 'today', 'size-4')
  const mid = art(10, 'marketing', 'size-6')
  const last = art(20, 'settings', 'size-[22px]')
  const st = (e: El) => e.props.style as Record<string, string>
  check('D-284 한 장에서 제 칸만 — 크기는 부르는 쪽 클래스 · 위치 0% / 50% / 100%', [first, mid, last].every((e) => e.type === 'span' && String(st(e).backgroundImage).includes(String(ICON_SPRITE.src)) && st(e).backgroundSize === '2100% 100%') && st(first).backgroundPosition === '0% 0' && st(mid).backgroundPosition === '50% 0' && st(last).backgroundPosition === '100% 0' && String(first.props.className).includes('size-4') && String(last.props.className).includes('size-[22px]') && first.props['data-icon-slot'] === 'today')
  check('D-284 slotIcon 은 같은 자리에 같은 그림(한 번 만들어 다시 씀)', slotIcon('sales', MODULES[0].icon) === slotIcon('sales', MODULES[1].icon) && name(slotIcon('없는자리', MODULES[0].icon)) === name(MODULES[0].icon))
  const Tint = customIcon('/icons/x.svg', true, 'client-ops') as unknown as (p: { className?: string }) => El
  const el = Tint({ className: 'size-4 text-blue-600' })
  const style = el.props.style as Record<string, string>
  check('D-283 한 색 새 아이콘 → 글자색으로 칠한 모양(기능 색 그대로) · 크기는 부르는 쪽 클래스', el.type === 'span' && String(style.mask).includes('/icons/x.svg') && String(el.props.className).includes('size-4') && String(el.props.className).includes('bg-current'))
  const Img = customIcon('/icons/y.png', false, 'sales') as unknown as (p: { className?: string }) => El
  const img = Img({ className: 'size-6' })
  check('D-283 여러 색 새 아이콘 → 그림 그대로(alt 비움 · 이름은 옆 글자가 말함)', img.type === 'img' && img.props.src === '/icons/y.png' && img.props.alt === '')
}

console.log(`\ncatalog: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
