/**
 * 1인 Pilot 계약 시험 (D-162)
 *  - 브라우저 저장소 금고: 사람이 바뀌면 앞사람 값이 보이지 않는다 · 아무것도 지우지 않는다 · 주인 모르는 예전 자료는 full 만
 *  - Pilot 메뉴 · 주소: 대표 전용 줄은 메뉴에서 빠지고 주소로도 막힌다 · 쓰는 화면은 열린다
 * 실행: npm run test:pilot
 */

import { isUserScopedKey, vaultSignOut, vaultSwitchTo } from '../storageVault'
import { MODULES, enabledModulesByGroup, isPilotHiddenPath } from '../../config/moduleRegistry'
import { identityFromSession } from '../currentUser'
import { brand } from '../../brand/brand.config'

let passed = 0
let failed = 0
function check(name: string, cond: boolean, detail?: string): void {
  if (cond) passed += 1
  else {
    failed += 1
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

/** 메모리 Storage — quota 를 주면 그 수를 넘는 setItem 은 던진다(저장 공간 가득) */
class FakeStorage implements Storage {
  private map = new Map<string, string>()
  quota = Infinity
  get length(): number {
    return this.map.size
  }
  key(i: number): string | null {
    return [...this.map.keys()][i] ?? null
  }
  getItem(k: string): string | null {
    return this.map.has(k) ? (this.map.get(k) as string) : null
  }
  setItem(k: string, v: string): void {
    if (!this.map.has(k) && this.map.size >= this.quota) throw new Error('QuotaExceededError')
    this.map.set(k, String(v))
  }
  removeItem(k: string): void {
    this.map.delete(k)
  }
  clear(): void {
    this.map.clear()
  }
  values(): string[] {
    return [...this.map.values()]
  }
  dump(): Record<string, string> {
    return Object.fromEntries(this.map)
  }
}

const OWNER = 'owner-uuid'
const PILOT = 'pilot-uuid'

// ---------- 어떤 키를 옮기나 ----------
check('키: axmvp.clients 는 사람 것', isUserScopedKey('axmvp.clients'))
check('키: axmvp:module:x 는 사람 것', isUserScopedKey('axmvp:module:x'))
check('키: 옛 도구 planChecklist:회사 는 사람 것', isUserScopedKey('planChecklist:한빛정밀'))
check('키: 로그인 토큰 sb-* 는 옮기지 않는다', !isUserScopedKey('sb-abc-auth-token'))
check('키: 금고 안 키는 다시 옮기지 않는다', !isUserScopedKey('axmvp.u.x.axmvp.clients'))
check('키: 공용 값(판 번호 · 공개 공고 캐시)은 옮기지 않는다', !isUserScopedKey('axmvp.schema_version') && !isUserScopedKey('axmvp.grants.feed.v1') && !isUserScopedKey('axmvp.vault.live'))
check('키: 상관없는 다른 사이트 값은 옮기지 않는다', !isUserScopedKey('theme') && !isUserScopedKey(''))

// ---------- 1. 이 기능 전부터 쓰던 브라우저에 Pilot 이 먼저 로그인 ----------
{
  const L = new FakeStorage()
  const S = new FakeStorage()
  L.setItem('axmvp.clients', 'OWNER-CLIENTS')
  L.setItem('planChecklist:대표고객', 'OWNER-PLAN')
  L.setItem('sb-proj-auth-token', 'TOKEN')
  L.setItem('axmvp.schema_version', '9')
  S.setItem('axmvp.draft', 'OWNER-DRAFT')
  const before = L.values().length + S.values().length

  const r = vaultSwitchTo(PILOT, 'pilot', L, S)
  check('1 Pilot 첫 로그인: 새로 불러야 함', r.changed && !r.blocked, JSON.stringify(r))
  check('1 Pilot 첫 로그인: 주인 모르는 고객 목록이 안 보임', L.getItem('axmvp.clients') === null)
  check('1 Pilot 첫 로그인: 옛 도구 값도 안 보임', L.getItem('planChecklist:대표고객') === null)
  check('1 Pilot 첫 로그인: 작성 중 글(session)도 안 보임', S.getItem('axmvp.draft') === null)
  check('1 Pilot 첫 로그인: 로그인 토큰 · 공용 값은 그대로', L.getItem('sb-proj-auth-token') === 'TOKEN' && L.getItem('axmvp.schema_version') === '9')
  check('1 Pilot 첫 로그인: Pilot 금고에 넣지 않고 주인 모름 금고로', L.getItem(`axmvp.u.${PILOT}.axmvp.clients`) === null && L.getItem('axmvp.u.unclaimed.axmvp.clients') === 'OWNER-CLIENTS')
  check('1 Pilot 첫 로그인: 지운 값 없음(옮기기만)', L.values().includes('OWNER-CLIENTS') && L.values().includes('OWNER-PLAN') && S.values().includes('OWNER-DRAFT') && L.values().length + S.values().length >= before)
  check('1 Pilot 첫 로그인: 지금 꺼내 놓은 사람 = Pilot', L.getItem('axmvp.vault.live') === PILOT)

  // Pilot 이 쓰고 로그아웃
  L.setItem('axmvp.clients', 'PILOT-CLIENTS')
  const f = vaultSignOut(L, S)
  check('1 Pilot 로그아웃: 못 옮긴 키 0', f === 0)
  check('1 Pilot 로그아웃: 자리가 빔', L.getItem('axmvp.clients') === null && L.getItem('axmvp.vault.live') === null)
  check('1 Pilot 로그아웃: Pilot 금고에 들어감', L.getItem(`axmvp.u.${PILOT}.axmvp.clients`) === 'PILOT-CLIENTS')

  // 대표(full) 로그인 — 주인 모름 자료를 되찾고, Pilot 것은 안 보임
  const r2 = vaultSwitchTo(OWNER, 'full', L, S)
  check('1 대표 로그인: 예전 자료가 돌아옴', !r2.blocked && L.getItem('axmvp.clients') === 'OWNER-CLIENTS' && L.getItem('planChecklist:대표고객') === 'OWNER-PLAN' && S.getItem('axmvp.draft') === 'OWNER-DRAFT')
  check('1 대표 로그인: Pilot 값은 금고에 그대로(안 보임)', L.getItem(`axmvp.u.${PILOT}.axmvp.clients`) === 'PILOT-CLIENTS' && !Object.entries(L.dump()).some(([k, v]) => !k.startsWith('axmvp.u.') && v === 'PILOT-CLIENTS'))

  // 로그아웃 없이 바로 Pilot 으로(다른 계정으로 다시 로그인)
  const r3 = vaultSwitchTo(PILOT, 'pilot', L, S)
  check('1 대표 → Pilot 바로: 대표 값이 안 보임', !r3.blocked && L.getItem('axmvp.clients') === 'PILOT-CLIENTS' && L.getItem('planChecklist:대표고객') === null && S.getItem('axmvp.draft') === null)
  check('1 대표 → Pilot 바로: 대표 값은 대표 금고로', L.getItem(`axmvp.u.${OWNER}.axmvp.clients`) === 'OWNER-CLIENTS' && S.getItem(`axmvp.u.${OWNER}.axmvp.draft`) === 'OWNER-DRAFT')

  // 같은 사람이 다시 로그인 — 아무것도 안 함
  const r4 = vaultSwitchTo(PILOT, 'pilot', L, S)
  check('1 같은 사람 다시: 바뀜 없음', !r4.changed && !r4.blocked)

  // 처음 값들이 하나도 사라지지 않았다
  const all = [...L.values(), ...S.values()]
  check('1 끝: 대표 값 셋 · Pilot 값 하나 모두 남아 있음', ['OWNER-CLIENTS', 'OWNER-PLAN', 'OWNER-DRAFT', 'PILOT-CLIENTS'].every((v) => all.includes(v)))
}

// ---------- 2. 이 기능 전부터 쓰던 브라우저에 대표(full)가 먼저 ----------
{
  const L = new FakeStorage()
  const S = new FakeStorage()
  L.setItem('axmvp.clients', 'OWNER-CLIENTS')
  const r = vaultSwitchTo(OWNER, 'full', L, S)
  check('2 대표 첫 로그인: 제자리 그대로 · 새로 부를 필요 없음', !r.changed && !r.blocked && L.getItem('axmvp.clients') === 'OWNER-CLIENTS' && L.getItem('axmvp.vault.live') === OWNER)
  // 그 다음 Pilot — 대표 값이 대표 금고로
  const r2 = vaultSwitchTo(PILOT, 'pilot', L, S)
  check('2 다음에 Pilot: 대표 값 안 보임', r2.changed && L.getItem('axmvp.clients') === null && L.getItem(`axmvp.u.${OWNER}.axmvp.clients`) === 'OWNER-CLIENTS')
}

// ---------- 3. 빈 브라우저 ----------
{
  const L = new FakeStorage()
  const S = new FakeStorage()
  const r = vaultSwitchTo(PILOT, 'pilot', L, S)
  check('3 빈 브라우저: 바뀜 없음 · 막힘 없음', !r.changed && !r.blocked && L.getItem('axmvp.vault.live') === PILOT)
}

// ---------- 4. 저장 공간 가득 — 옮기지 못하면 막고, 지우지 않는다 ----------
{
  const L = new FakeStorage()
  const S = new FakeStorage()
  L.setItem('axmvp.vault.live', OWNER)
  L.setItem('axmvp.clients', 'OWNER-CLIENTS')
  L.setItem('axmvp.journal', 'OWNER-JOURNAL')
  L.quota = L.length // 새 키를 하나도 못 넣는다
  const r = vaultSwitchTo(PILOT, 'pilot', L, S)
  check('4 가득: 막힘으로 알림(앱을 열지 않게)', r.blocked, JSON.stringify(r))
  check('4 가득: 대표 값은 그대로 제자리(지우지 않음)', L.getItem('axmvp.clients') === 'OWNER-CLIENTS' && L.getItem('axmvp.journal') === 'OWNER-JOURNAL')
  check('4 가득: 지금 사람 표시를 Pilot 으로 바꾸지 않음', L.getItem('axmvp.vault.live') === OWNER)
  const f = vaultSignOut(L, S)
  check('4 가득 로그아웃: 못 옮긴 수를 알림 · 값은 남음', f === 2 && L.getItem('axmvp.clients') === 'OWNER-CLIENTS')

  // 주인 모르는 자료 + 가득 + Pilot
  const L2 = new FakeStorage()
  L2.setItem('axmvp.clients', 'OLD')
  L2.quota = 1
  const r2 = vaultSwitchTo(PILOT, 'pilot', L2, new FakeStorage())
  check('4 가득(주인 모름): Pilot 은 막힘', r2.blocked && L2.getItem('axmvp.clients') === 'OLD')
}

// ---------- 4-1. 여러 창 — 다른 창이 먼저 로그아웃해도 이 창의 sessionStorage 는 주인 금고로 ----------
{
  const L = new FakeStorage()
  const SA = new FakeStorage() // 창 A
  const SB = new FakeStorage() // 창 B
  vaultSwitchTo(OWNER, 'full', L, SA)
  L.setItem('axmvp.clients', 'OWNER-CLIENTS')
  SB.setItem('axmvp.meetingDraft.x', 'OWNER-B-DRAFT')
  vaultSignOut(L, SA, OWNER) // 창 A 로그아웃
  vaultSwitchTo(PILOT, 'pilot', L, SA) // 창 A 에서 Pilot 로그인
  vaultSignOut(L, SB, OWNER) // 창 B 가 알아차림(이 창은 대표였다)
  check('4-1 여러 창: 창 B 의 작성 중 값이 대표 금고로(Pilot 에게 안 보임)', SB.getItem('axmvp.meetingDraft.x') === null && SB.getItem(`axmvp.u.${OWNER}.axmvp.meetingDraft.x`) === 'OWNER-B-DRAFT')
  check('4-1 여러 창: Pilot 이 꺼내 놓은 localStorage 는 건드리지 않음', L.getItem('axmvp.vault.live') === PILOT && L.getItem(`axmvp.u.${OWNER}.axmvp.clients`) === 'OWNER-CLIENTS')
  // 아무도 로그인 안 한 상태에서 창 B 가 늦게 알아차림 — local · session 모두 그 사람 금고로
  const L2 = new FakeStorage()
  const S2 = new FakeStorage()
  L2.setItem('axmvp.late', 'OWNER-LATE')
  S2.setItem('axmvp.s', 'OWNER-S')
  vaultSignOut(L2, S2, OWNER)
  check('4-1 늦게 알아차린 창: 남은 값도 그 사람 금고로', L2.getItem('axmvp.late') === null && L2.getItem(`axmvp.u.${OWNER}.axmvp.late`) === 'OWNER-LATE' && S2.getItem(`axmvp.u.${OWNER}.axmvp.s`) === 'OWNER-S')
}

// ---------- 5. 무작위 순서로 로그인 · 로그아웃 · 쓰기 — 값은 늘 주인에게만, 하나도 안 사라짐 ----------
{
  let seed = 7
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
  const L = new FakeStorage()
  const S = new FakeStorage()
  const users = [OWNER, PILOT, 'pilot2']
  const tier = (u: string) => (u === OWNER ? 'full' : 'pilot') as 'full' | 'pilot'
  const written = new Map<string, string>() // 값 → 주인
  let current: string | null = null
  let leaks = 0
  let lost = 0
  for (let step = 0; step < 400; step++) {
    const a = rnd()
    if (a < 0.35) {
      const u = users[Math.floor(rnd() * users.length)]
      const r = vaultSwitchTo(u, tier(u), L, S)
      if (!r.blocked) current = u
    } else if (a < 0.5) {
      vaultSignOut(L, S)
      current = null
    } else if (current) {
      const key = ['axmvp.clients', 'axmvp.draft', 'pm:회사', 'axmvp:module:x'][Math.floor(rnd() * 4)]
      const v = `${current}#${step}`
      const store = key === 'axmvp.draft' ? S : L
      store.setItem(key, v)
      written.set(v, current)
    }
    // 지금 꺼내 놓은 값은 모두 지금 사람 것
    if (current) {
      for (const st of [L, S]) {
        for (const [k, v] of Object.entries(st.dump())) {
          if (isUserScopedKey(k) && written.has(v) && written.get(v) !== current) leaks += 1
        }
      }
    }
  }
  // 마지막에 덮어쓴 값만 남는 게 맞다 — 키마다 사람별 마지막 값이 어딘가에 있어야 한다
  const last = new Map<string, string>()
  for (const [v, owner] of written) {
    const key = v // 값 자체로 찾는다
    void key
    last.set(owner, v)
  }
  const all = new Set([...L.values(), ...S.values()])
  for (const v of last.values()) if (!all.has(v)) lost += 1
  check('5 무작위 400걸음: 남의 값이 보인 적 0', leaks === 0, `leaks=${leaks}`)
  check('5 무작위 400걸음: 사람마다 마지막에 쓴 값이 사라진 적 0', lost === 0, `lost=${lost}`)
}

// ---------- Pilot 메뉴 · 주소 ----------
{
  const pilotMenu = enabledModulesByGroup({ advanced: true, pilot: true })
  const ownerMenu = enabledModulesByGroup({ advanced: true, pilot: false })
  const titles = pilotMenu.map((g) => g.group.title)
  const labels = pilotMenu.flatMap((g) => g.items.map((m) => m.label))
  check('메뉴: Pilot 에게 \'잘 안 쓰는 기능\' 묶음 없음', !titles.includes('잘 안 쓰는 기능'), titles.join(','))
  check('메뉴: Pilot 에게 \'이 시스템\' 묶음 없음', !titles.includes('이 시스템'), titles.join(','))
  check('메뉴: Pilot 에게 영업자 정산 · 1차 미팅 체크리스트 · 상담신청 없음', !labels.includes('영업자 정산') && !labels.includes('1차 미팅 체크리스트') && !labels.some((l) => l.includes('상담신청')), labels.join(','))
  check('메뉴: Pilot 에게 고급(검증 · 기관 전략) 없음 — 고급 켜도', !pilotMenu.some((g) => g.items.some((m) => m.advanced)))
  check('메뉴: 대표에게는 그대로(묶음 · 줄 수 더 많음)', ownerMenu.length > pilotMenu.length && ownerMenu.flatMap((g) => g.items).length > labels.length)
  check('메뉴: Pilot 메뉴의 모든 줄은 주소로도 열림', pilotMenu.every((g) => g.items.every((m) => !isPilotHiddenPath(m.path))), pilotMenu.flatMap((g) => g.items.filter((m) => isPilotHiddenPath(m.path)).map((m) => m.path)).join(','))
  check('메뉴: Pilot 메뉴에 빠진 대표 줄은 주소로도 막힘', ownerMenu.flatMap((g) => g.items).filter((m) => !labels.includes(m.label)).every((m) => isPilotHiddenPath(m.path)), ownerMenu.flatMap((g) => g.items).filter((m) => !labels.includes(m.label) && !isPilotHiddenPath(m.path)).map((m) => m.path).join(','))

  const blocked = [
    '/ops/agents', '/sales/first-meeting', '/ops/inbox', '/getting-started', '/why', '/kpi', '/roadmap',
    '/studio', '/studio/abc', '/ax/open', '/clients', '/clients/org-1', '/projects/p1', '/diagnosis/surveys', '/website-studio',
    '/modules/tech-biz', '/modules/ax-studio', '/modules/web-studio', '/funding', '/funding/catalog', '/reports', '/tools/review', '/today/legacy',
  ]
  for (const p of blocked) check(`주소: Pilot 에게 ${p} 막힘`, isPilotHiddenPath(p))
  const open = ['/', '/today', '/journal', '/ops/clients', '/ops/clients/abc', '/ops/calendar', '/ops/decide', '/grants', '/money', '/sales/board', '/sales/new', '/tools', '/tools/tax', '/settings']
  for (const p of open) check(`주소: Pilot 에게 ${p} 열림`, !isPilotHiddenPath(p))
  check('주소: 비슷한 이름이 잘못 막히지 않음(/ops/clients 와 /clients)', !isPilotHiddenPath('/ops/clients/x') && isPilotHiddenPath('/clients/x'))
  check('표: 대표 전용 줄이 메뉴 표에 표시돼 있음(한 표에서 계산)', MODULES.filter((m) => m.ownerOnly).length >= 3)
}

// ---------- 이름: Pilot 은 대표 이름을 빌리지 않는다 ----------
{
  const pilotNoName = identityFromSession({ email: 'eunhye@x.kr', user_metadata: {} }, 'owner', 'pilot')
  check('이름: Pilot(이름 없음 · 자기 작업공간 소유자) → 이메일 앞부분도 대표 이름도 아닌 "사용자"(D-163)', pilotNoName.name === '사용자' && pilotNoName.title === '' && pilotNoName.name !== brand.ownerName, JSON.stringify(pilotNoName))
  const pilotTitled = identityFromSession({ email: 'eunhye@x.kr', user_metadata: { display_name: '최은혜', title: '팀장' } }, 'owner', 'pilot')
  check('이름: Pilot 이 적은 이름 · 직함 → "최은혜 팀장"(D-163)', pilotTitled.name === '최은혜' && pilotTitled.title === '팀장')
  const pilotNamed = identityFromSession({ email: 'eunhye@x.kr', user_metadata: { display_name: '최은혜' } }, 'owner', 'pilot')
  check('이름: Pilot(이름 있음) → 그 이름', pilotNamed.name === '최은혜' && pilotNamed.title === '')
  const owner = identityFromSession({ email: 'ceo@x.kr', user_metadata: {} }, 'owner', 'full')
  check('이름: 대표(full · 이름 없음) → 지금처럼 대표 이름', owner.name === brand.ownerName)
}

console.log(`pilot: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
