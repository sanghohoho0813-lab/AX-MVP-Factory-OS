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
import { isStageExcluded, stripFrame } from '../../lib/deviceView'
import {
  RECENT_ACCOUNTS_KEY,
  RECENT_LIMIT,
  SWITCH_TO_KEY,
  SWITCH_TTL_MS,
  accountLabel,
  clearSwitchTarget,
  forgetAccount,
  otherAccounts,
  peekSwitchTarget,
  readRecentAccounts,
  rememberAccount,
  setSwitchTarget,
} from '../recentAccounts'
import {
  TUTORIAL_PREFS_KEY,
  TUTORIAL_SHOWN_KEY,
  hideTutorialForever,
  hideTutorialToday,
  markShownThisSession,
  readTutorialPrefs,
  resetTutorialPrefs,
  shouldAutoOpenTutorial,
  wasShownThisSession,
} from '../../services/tutorialPrefs'
import { TUTORIAL_VIDEOS, minutesLabel } from '../../config/tutorialVideos'
import { FEEDBACK_QUESTIONS, answeredCount, cleanAnswers, feedbackRound, summarizeFeedback, type FeedbackEntry } from '../../services/feedbackSurvey'

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
    '/feedback/inbox',
    // D-195: 마케팅 · 브랜딩(콘텐츠 레이더)은 대표 전용
    '/marketing', '/marketing/youtube',
  ]
  for (const p of blocked) check(`주소: Pilot 에게 ${p} 막힘`, isPilotHiddenPath(p))
  const open = ['/', '/today', '/journal', '/ops/clients', '/ops/clients/abc', '/ops/calendar', '/ops/decide', '/grants', '/money', '/sales/board', '/sales/new', '/tools', '/tools/tax', '/settings', '/feedback']
  for (const p of open) check(`주소: Pilot 에게 ${p} 열림`, !isPilotHiddenPath(p))
  check('주소: 비슷한 이름이 잘못 막히지 않음(/ops/clients 와 /clients)', !isPilotHiddenPath('/ops/clients/x') && isPilotHiddenPath('/clients/x'))
  check('메뉴(D-195): Pilot 메뉴에 마케팅 · 브랜딩 없음 · 대표 메뉴에는 있음', !labels.includes('마케팅 · 브랜딩') && ownerMenu.flatMap((g) => g.items).some((m) => m.label === '마케팅 · 브랜딩'))
  check('주소(D-195): 마케팅 아래 모든 주소 막힘 · 비슷한 이름(/marketingx)은 따로', isPilotHiddenPath('/marketing/youtube/x') && !isPilotHiddenPath('/marketingx'))
  check('표(D-195): 마케팅은 대표 전용 줄(ownerOnly) — 따로 만든 권한 없이 같은 표', MODULES.find((m) => m.key === 'marketing')?.ownerOnly === true)
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

// ---------- 보기 방식(D-164): iframe 주소 표시를 떼어 같은 주소로 맞춘다 · 공개 화면은 무대 없음 ----------
{
  check('보기 방식: frame 표시만 뗀다(다른 값 · # 는 그대로)', stripFrame('/ops/clients?frame=mobile&tab=docs#a') === '/ops/clients?tab=docs#a', stripFrame('/ops/clients?frame=mobile&tab=docs#a'))
  check('보기 방식: frame 만 있으면 주소만', stripFrame('/today?frame=pc') === '/today')
  check('보기 방식: 바깥 주소로 바뀌지 않는다', stripFrame('//evil.example/x?frame=pc').startsWith('/') && !stripFrame('//evil.example/x?frame=pc').startsWith('//'), stripFrame('//evil.example/x?frame=pc'))
  check('보기 방식: 설문 · 시험 · 지원사업 찾기(공개 화면)는 무대 없음', isStageExcluded('/survey/abc') && isStageExcluded('/test/abc') && isStageExcluded('/grants/find'))
  check('보기 방식: 내부 화면은 무대', !isStageExcluded('/ops/clients') && !isStageExcluded('/grants') && !isStageExcluded('/'))
}

// ---------- D-184: 이 기기에서 로그인했던 계정 — 이메일 · 이름만(비밀번호 없음) · 금고로 옮기지 않음 ----------
{
  const L = new FakeStorage()
  const t0 = new Date('2026-10-12T09:00:00Z')
  const t1 = new Date('2026-10-12T09:05:00Z')
  rememberAccount({ email: ' CEO@Mirae.KR ', name: '김상호', title: '대표' }, t0, L)
  rememberAccount({ email: 'ceh@mirae.kr', name: '최은혜', title: '팀장' }, t1, L)
  let list = readRecentAccounts(L)
  check('계정: 두 계정 · 최근에 연 것부터', list.length === 2 && list[0].email === 'ceh@mirae.kr' && list[1].email === 'ceo@mirae.kr', JSON.stringify(list))
  check('계정: 이메일은 소문자 · 앞뒤 빈칸 없이', list[1].email === 'ceo@mirae.kr')
  check('계정: 보이는 이름 "최은혜 팀장" · 이름 없으면 이메일', accountLabel(list[0]) === '최은혜 팀장' && accountLabel({ email: 'x@y.kr', name: '', title: '', at: '' }) === 'x@y.kr')
  check('계정: 메뉴에는 지금 계정이 아닌 것만', otherAccounts(list, 'CEO@mirae.kr').map((a) => a.email).join() === 'ceh@mirae.kr')

  // 비밀번호 같은 다른 값이 섞여 들어와도 저장하지 않는다
  rememberAccount({ email: 'ceo@mirae.kr', name: '김상호', title: '대표', password: 'pw-SECRET-123' } as never, new Date('2026-10-12T09:10:00Z'), L)
  const raw = L.getItem(RECENT_ACCOUNTS_KEY) ?? ''
  check('계정: 저장된 값에 비밀번호 없음 · 칸은 email/name/title/at 넷뿐', !raw.includes('pw-SECRET-123') && !raw.toLowerCase().includes('password') && JSON.parse(raw).every((r: Record<string, unknown>) => Object.keys(r).sort().join() === 'at,email,name,title'), raw)
  list = readRecentAccounts(L)
  check('계정: 다시 열면 맨 앞으로 · 겹치지 않음', list.length === 2 && list[0].email === 'ceo@mirae.kr')

  // 이름을 모를 때(이름 아직 안 적음)는 예전 이름을 지우지 않는다
  rememberAccount({ email: 'ceh@mirae.kr', name: '', title: '' }, new Date('2026-10-12T09:20:00Z'), L)
  check('계정: 이름 없이 다시 열려도 예전 이름 · 직함 그대로', accountLabel(readRecentAccounts(L)[0]) === '최은혜 팀장', JSON.stringify(readRecentAccounts(L)[0]))

  // 이메일이 아니면 남기지 않는다 · 깨진 값은 건너뛴다
  rememberAccount({ email: 'not-an-email', name: '이상' }, t1, L)
  check('계정: 이메일이 아니면 남기지 않음', readRecentAccounts(L).length === 2)
  const B = new FakeStorage()
  B.setItem(RECENT_ACCOUNTS_KEY, '{깨짐')
  check('계정: 깨진 값이면 빈 목록(화면이 멈추지 않음)', readRecentAccounts(B).length === 0)
  B.setItem(RECENT_ACCOUNTS_KEY, JSON.stringify([null, 3, { email: 'a@b.kr', name: 5 }, { email: 'A@B.kr' }]))
  check('계정: 이상한 줄은 건너뛰고 · 같은 이메일은 하나', readRecentAccounts(B).length === 1 && readRecentAccounts(B)[0].name === '')

  // 많아야 RECENT_LIMIT 개
  const M = new FakeStorage()
  for (let i = 0; i < RECENT_LIMIT + 3; i += 1) rememberAccount({ email: `u${i}@x.kr` }, new Date(Date.UTC(2026, 9, 12, 9, i)), M)
  check(`계정: 많아야 ${RECENT_LIMIT}개 · 오래된 것부터 빠짐`, readRecentAccounts(M).length === RECENT_LIMIT && readRecentAccounts(M)[0].email === `u${RECENT_LIMIT + 2}@x.kr`)

  // 이 기기에서 지우기
  setSwitchTarget('ceh@mirae.kr', L)
  forgetAccount('CEH@mirae.kr', L)
  check('계정: 이 기기에서 지우기 → 목록에서 빠지고 바꿀 계정 표시도 지움', readRecentAccounts(L).map((a) => a.email).join() === 'ceo@mirae.kr' && peekSwitchTarget(L) === '')

  // 바꿀 계정: 넣고 · 읽고(지우지 않음) · 지운다
  setSwitchTarget(' CEH@mirae.kr', L)
  check('바꾸기: 로그인 화면이 미리 넣을 이메일', peekSwitchTarget(L) === 'ceh@mirae.kr' && peekSwitchTarget(L) === 'ceh@mirae.kr')
  clearSwitchTarget(L)
  check('바꾸기: 한 번 쓰면 지운다', peekSwitchTarget(L) === '' && L.getItem(SWITCH_TO_KEY) === null)
  setSwitchTarget('javascript:alert(1)', L)
  check('바꾸기: 이메일이 아닌 값은 넣지 않음', peekSwitchTarget(L) === '')
  const at = new Date('2026-10-12T09:00:00Z')
  setSwitchTarget('ceh@mirae.kr', L, at)
  check('바꾸기: 9분 뒤에는 아직 · 11분 뒤에는 잊음', peekSwitchTarget(L, new Date(at.getTime() + 9 * 60000)) === 'ceh@mirae.kr' && peekSwitchTarget(L, new Date(at.getTime() + SWITCH_TTL_MS + 60000)) === '')
  L.setItem(SWITCH_TO_KEY, 'ceh@mirae.kr')
  check('바꾸기: 예전 모양 · 깨진 값이면 미리 넣지 않음', peekSwitchTarget(L) === '')
  clearSwitchTarget(L)

  // 금고: 로그인했던 계정 목록 · 바꿀 계정은 사람 것이 아니다(로그아웃해도 로그인 화면에 남는다)
  check('금고: 계정 목록 · 바꿀 계정 키는 옮기지 않는다', !isUserScopedKey(RECENT_ACCOUNTS_KEY) && !isUserScopedKey(SWITCH_TO_KEY))
  const V = new FakeStorage()
  const VS = new FakeStorage()
  vaultSwitchTo(OWNER, 'full', V, VS)
  rememberAccount({ email: 'ceo@mirae.kr', name: '김상호', title: '대표' }, t0, V)
  V.setItem('axmvp.clients', 'OWNER-CLIENTS')
  setSwitchTarget('ceh@mirae.kr', V)
  vaultSignOut(V, VS, OWNER)
  check('금고: 대표 로그아웃 → 업체 값은 금고로 · 계정 목록 · 바꿀 계정은 그대로', V.getItem('axmvp.clients') === null && readRecentAccounts(V).length === 1 && peekSwitchTarget(V) === 'ceh@mirae.kr')
  vaultSwitchTo(PILOT, 'pilot', V, VS)
  check('금고: 팀장 로그인 → 대표 업체 값은 안 보임 · 계정 목록은 그대로', V.getItem('axmvp.clients') === null && readRecentAccounts(V).length === 1)
}

// D-185: 안내 영상 — 팀장님(Pilot)이 들어오면 먼저 영상부터 · 오늘 하루 안 보기 · 앞으로 보지 않기 · 머리줄로 언제든
{
  const L = new FakeStorage()
  const S = new FakeStorage()
  const base = { access: 'pilot', prefs: readTutorialPrefs(L), today: '2026-10-12', hiddenInAccount: false, shownThisSession: wasShownThisSession(S) }
  check('안내 영상: 팀장님 첫 로그인 → 저절로 띄운다', shouldAutoOpenTutorial(base))
  check('안내 영상: 대표(full) · 고객 · 접근 없음에는 저절로 띄우지 않는다', ['full', 'portal', 'none', null, undefined].every((a) => !shouldAutoOpenTutorial({ ...base, access: a as string | null })))
  markShownThisSession(S)
  check('안내 영상: 한 번 띄운 창(탭)에서는 화면을 옮겨도 다시 안 뜬다', wasShownThisSession(S) && !shouldAutoOpenTutorial({ ...base, shownThisSession: wasShownThisSession(S) }) && S.getItem(TUTORIAL_SHOWN_KEY) === '1')
  hideTutorialToday('2026-10-12', L)
  check('안내 영상: 오늘 하루 안 보기 → 오늘은 안 뜬다', !shouldAutoOpenTutorial({ ...base, prefs: readTutorialPrefs(L) }))
  check('안내 영상: 오늘 하루 안 보기 → 내일은 다시 뜬다', shouldAutoOpenTutorial({ ...base, prefs: readTutorialPrefs(L), today: '2026-10-13' }))
  hideTutorialForever(L)
  check('안내 영상: 앞으로 보지 않기 → 날이 바뀌어도 안 뜬다', !shouldAutoOpenTutorial({ ...base, prefs: readTutorialPrefs(L), today: '2027-01-01' }))
  check('안내 영상: 다른 기기에서 앞으로 보지 않기(계정 정보) → 이 기기에서도 안 뜬다', !shouldAutoOpenTutorial({ ...base, hiddenInAccount: true }))
  resetTutorialPrefs(L)
  check('안내 영상: 되돌리면 다시 뜬다', shouldAutoOpenTutorial({ ...base, prefs: readTutorialPrefs(L) }))
  L.setItem(TUTORIAL_PREFS_KEY, '{"hiddenOn":"<script>","never":"yes"}')
  check('안내 영상: 깨진 값은 무시(날짜 모양 · true 만)', JSON.stringify(readTutorialPrefs(L)) === '{}')
  L.setItem(TUTORIAL_PREFS_KEY, 'not json')
  check('안내 영상: 읽을 수 없는 값이어도 멈추지 않는다', JSON.stringify(readTutorialPrefs(L)) === '{}')
  const full = new FakeStorage()
  full.quota = 0
  hideTutorialToday('2026-10-12', full)
  check('안내 영상: 저장 공간이 가득해도 멈추지 않는다', JSON.stringify(readTutorialPrefs(full)) === '{}')
  check('안내 영상: 키는 사람별 금고로 나뉜다(대표가 끈 것이 팀장님 쪽에 번지지 않음)', isUserScopedKey(TUTORIAL_PREFS_KEY) && isUserScopedKey(TUTORIAL_SHOWN_KEY))
  check('안내 영상: 1편 · 2편 — 가로(16:9) · 세로(9:16) 두 벌씩', TUTORIAL_VIDEOS.length === 2 && TUTORIAL_VIDEOS.every((v) => /-wide\.mp4$/.test(v.wide) && /-tall\.mp4$/.test(v.tall) && v.seconds > 60))
  check('안내 영상: 길이 표시 "약 5분"', minutesLabel(309) === '약 5분' && minutesLabel(20) === '약 1분')
}

// ---------- D-188: 개발자에게 피드백 — 설문 규칙 ----------
{
  check('피드백 회차: 1~15일 = 1차 · 16일~ = 2차(2주마다)', feedbackRound('2026-10-13').id === '2026-10-A' && feedbackRound('2026-10-13').label === '10월 1차 설문' && feedbackRound('2026-10-16').id === '2026-10-B' && feedbackRound('2026-12-31').label === '12월 2차 설문')
  const kinds = FEEDBACK_QUESTIONS.map((q) => q.kind)
  check('피드백 설문: 1~5점 · 여러 개 고르기 · 하나 고르기 · 직접 쓰기가 다 있다(마지막은 직접 쓰기)', ['rating', 'multi', 'single', 'text'].every((k) => kinds.includes(k as never)) && kinds[kinds.length - 1] === 'text')
  check('피드백 설문: 여러 개 고르기 질문은 보기 5개 이상', FEEDBACK_QUESTIONS.filter((q) => q.kind === 'multi').every((q) => q.kind === 'multi' && q.options.length >= 5))
  const raw = { easy: 4, docs: 9, reco: 2.5, used: ['고객 관리', '없는 보기', '서류 올리기'], pain: [], first: '서류함', note: '  업체 상세가 길어요  ' }
  const clean = cleanAnswers(raw)
  check('피드백 답 정리: 1~5 정수만 · 보기 밖 값 · 빈 고르기 · 앞뒤 빈칸 정리', clean.easy === 4 && clean.docs === undefined && clean.reco === undefined && JSON.stringify(clean.used) === JSON.stringify(['고객 관리', '서류 올리기']) && clean.pain === undefined && clean.first === '서류함' && clean.note === '업체 상세가 길어요')
  check('피드백: 답한 질문 수 · 아무것도 안 했으면 0', answeredCount(raw) === 4 && answeredCount({}) === 0 && answeredCount({ note: '   ' }) === 0)
  const mk = (id: string, answers: Record<string, unknown>): FeedbackEntry => ({ id, workspaceId: 'w', round: '2026-10-A', roundLabel: '10월 1차 설문', answers: cleanAnswers(answers as never), author: { id: 'u', name: '최은혜', title: '팀장', email: '' }, at: `2026-10-1${id}T09:00:00Z`, readAt: null, device: 'PC' })
  const sum = summarizeFeedback([mk('1', { easy: 4, used: ['고객 관리', '서류 올리기'], note: '좋아요' }), mk('2', { easy: 5, used: ['고객 관리'], first: '서류함' })])
  check('피드백 모아 보기: 점수 평균(4.5) · 많이 고른 것 순 · 하나 고르기 · 직접 쓴 말', sum.responses === 2 && sum.ratings.find((r) => r.id === 'easy')?.average === 4.5 && sum.ratings.find((r) => r.id === 'docs')?.average === null && sum.choices.find((c) => c.id === 'used')?.counts[0]?.option === '고객 관리' && sum.choices.find((c) => c.id === 'used')?.counts[0]?.count === 2 && sum.choices.find((c) => c.id === 'first')?.counts[0]?.option === '서류함' && sum.texts.length === 1 && sum.texts[0].text === '좋아요')
  // D-222 같은 팀장이 두 번 보내도 '2명' 이 아니라 응답 2건 · 1명
  const sum2 = summarizeFeedback([mk('1', { easy: 4 }), mk('2', { easy: 5 }), { ...mk('3', { easy: 3 }), author: { id: 'u2', name: '박팀장', title: '팀장', email: '' } }])
  check('피드백 모아 보기: 응답 3건 · 보낸 사람 2명(같은 사람 여러 번은 1명)', sum2.responses === 3 && sum2.people === 2 && sum.people === 1, { r: sum2.responses, p: sum2.people })
}

console.log(`pilot: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
