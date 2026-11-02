/**
 * D-502 대화창에서 말한 업체 사정 → 상황 예시 질문의 답.
 *
 * 대표: "초보자가 써도 바로 컨설팅 전문가가 되게 — 사람에게는 정말 최종 확인이 필요한 것만 묻는다."
 * 업체 상세 › 맞춤 추천 '상황 예시' 는 기록에 없는 사정(채용 계획 · 설비 · 가지급금 …)을 예/아니요로 하나씩 묻는다.
 * 미팅에서 들은 말을 대화창에 그대로 적으면("한솔테크 대표님이 내년에 청년 2명 뽑는대, 설비도 살 계획이래")
 * 그 말에서 답을 읽어 → 한 번 [기록] 으로 업체에 남기고 → 새로 맞게 된 상황을 그 업체 숫자로 바로 설계한다.
 *
 *  - 규칙(낱말)으로 읽는다 — 'AI' 라고 부르지 않는다. 확실한 말만: 주제 낱말 + 행동 낱말이 한 마디 안에 같이 있을 때.
 *  - '없어 · 안 뽑아 · 않' 이 같은 마디에 있으면 '없음'.
 *  - '~하면 · ~한다면 · ~할 경우 · 물음표' 는 사실이 아니라 가정 — 기록하자고 하지 않고, 그 가정으로 설계만 보여 준다.
 *  - 저장은 대표가 [기록] 을 누를 때만(최종 확인 한 번).
 */
import type { QuestionKey } from '../scenarioFit'

export type TalkMode = 'fact' | 'if'

export interface TalkAnswer {
  key: QuestionKey
  a: 'yes' | 'no'
  mode: TalkMode
  /** 화면에 쓰는 짧은 이름(청년 채용 계획 …) */
  label: string
  /** 읽은 마디(근거) */
  phrase: string
}

/** 짧은 이름 — 상황 예시 질문과 같은 뜻 */
export const TALK_LABEL: Record<QuestionKey, string> = {
  hireYouth: '청년(만 15~34세) 채용 계획',
  hireSenior: '만 60세 이상 채용 계획',
  childcare: '육아휴직 쓰는(쓸) 직원',
  contract: '계약직(기간제) 직원',
  researchStaff: '연구 · 개발 맡을 직원',
  prototype: '올해 시제품 · 개발 재료비',
  conversion: '개인사업자 → 법인 전환한 회사',
  facility: '기계 · 설비 살 계획',
  succession: '자녀에게 지분 넘길 계획',
  loan: '가지급금',
  retire: '대표 퇴임 · 퇴직금 중간정산 생각',
  lendToCorp: '대표가 회사에 빌려준 돈(가수금)',
  giftToCorp: '대표가 회사에 현금 · 부동산 넣을 계획',
  hireWoman: '경력단절 여성 채용 계획',
  hireDisabled: '장애인 채용 계획',
  flexWork: '유연근무(시차 · 재택) 도입 계획',
  retireKeep: '정년이 됐거나 곧 될 직원',
  interior: '매장 · 사무실 인테리어 계획',
  highRateLoan: '금리 높은 대출(제2금융권 등)',
  salesDrop: '최근 매출 크게 줄어듦',
  acquired: '남의 사업을 넘겨받아 시작',
  reopened: '같은 업종을 접었다가 다시 시작',
}

const HIRE = /뽑|채용|고용|구인|들이|들일|입사|모집|충원/
/** 주제 낱말 + (있으면) 행동 낱말 — 둘 다 한 마디 안에 있어야 읽는다 */
const RULES: readonly { key: QuestionKey; topic: RegExp; act?: RegExp }[] = [
  { key: 'hireYouth', topic: /청년|20\s*대|신입|사회\s*초년/, act: HIRE },
  { key: 'hireSenior', topic: /(만\s*)?6\d\s*세|고령|어르신|시니어|노인/, act: HIRE },
  { key: 'hireWoman', topic: /경력\s*단절|경단녀/, act: HIRE },
  { key: 'hireDisabled', topic: /장애인/, act: HIRE },
  { key: 'childcare', topic: /육아\s*휴직|육휴|출산\s*휴가/ },
  { key: 'contract', topic: /계약직|기간제|비정규/ },
  { key: 'researchStaff', topic: /연구원|연구\s*인력|개발자|엔지니어|이공계|개발\s*인력|연구\s*전담/, act: /있|두|둔|뽑|채용|근무|일하|맡/ },
  { key: 'prototype', topic: /시제품|시작품|프로토\s*타입|개발\s*재료|재료비/ },
  { key: 'conversion', topic: /법인\s*전환|법인으로\s*(바꿨|바꾼|전환)|개인(사업자)?에서\s*법인/, act: /했|한\s*(회사|곳|업체)|됐|된|바꿨|바꾼|전환한/ },
  { key: 'facility', topic: /설비|기계|장비|생산\s*라인|공장\s*증설/, act: /사|살|구입|구매|투자|들이|들일|견적|도입|증설|바꾸|교체/ },
  { key: 'succession', topic: /자녀|아들|딸|자식|2\s*세|가업/, act: /지분|주식|물려|넘기|넘겨|승계|증여/ },
  { key: 'loan', topic: /가지급금/ },
  { key: 'retire', topic: /퇴임|은퇴|퇴직금\s*(중간\s*)?정산|물러나/ },
  { key: 'lendToCorp', topic: /가수금|회사에\s*(돈을?\s*)?빌려|회사에\s*빌려\s*준/ },
  { key: 'giftToCorp', topic: /회사에\s*(현금|부동산|건물|땅|자산)|(현금|부동산|건물|땅|자산)(을|를)?\s*회사에/, act: /넣|증여|출자|이전|옮기/ },
  { key: 'flexWork', topic: /유연\s*근무|재택|시차\s*출퇴근|원격\s*근무/ },
  { key: 'retireKeep', topic: /정년/, act: /됐|된|되는|될|앞둔|넘은|넘긴|곧|다가/ },
  { key: 'interior', topic: /인테리어|리모델링|매장\s*공사|사무실\s*공사/ },
  { key: 'highRateLoan', topic: /고금리|제\s*2\s*금융|저축\s*은행|캐피탈|카드\s*론|대부\s*업/ },
  { key: 'salesDrop', topic: /매출/, act: /줄었|줄어|떨어|급감|반\s*토막|감소|빠졌/ },
  { key: 'acquired', topic: /인수|양수|넘겨\s*받|사업\s*양도|권리금/ },
  { key: 'reopened', topic: /재창업|다시\s*창업|폐업.*다시|접었다가/ },
]

/** '없음' 으로 읽는 말 — 같은 마디 안에서만 */
const NEG = /없|않|아니|안\s*(뽑|해|하|할|사|살|들|써|쓸|넣|넘|줄|둬|둘)|못\s*(뽑|사|해)|말고/
/** 가정(사실이 아님) — 기록하자고 하지 않는다 */
const IF = /하면|한다면|할\s*경우|된다면|되면|라면|이면|으면|\?|까요|ㄹ까/

/** 마디로 나누기 — 문장 부호 · 줄 · '는데 · 고 · 하고 · 대 · 래' 같은 이음말 */
export function clausesOf(text: string): string[] {
  return String(text ?? '')
    .replace(/(는데|인데|은데|하고|이고|고요|구요|대요|래요|대|래|고)(\s|$)/g, '$1|')
    .split(/[|.!\n,;·]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2)
}

/**
 * 말에서 상황 질문의 답 읽기 — 같은 질문이 여러 번 나오면 마지막 말이 이긴다(말을 고쳐 말한 것).
 * 질문 전체가 가정이면(… 하면 얼마?) 모두 가정.
 */
export function talkAnswers(text: string): TalkAnswer[] {
  const out = new Map<QuestionKey, TalkAnswer>()
  for (const c of clausesOf(text)) {
    for (const r of RULES) {
      if (!r.topic.test(c)) continue
      if (r.act && !r.act.test(c.replace(r.topic, ' '))) continue
      out.delete(r.key)
      out.set(r.key, { key: r.key, a: NEG.test(c) ? 'no' : 'yes', mode: IF.test(c) ? 'if' : 'fact', label: TALK_LABEL[r.key], phrase: c.slice(0, 60) })
    }
  }
  return [...out.values()]
}

/** 이미 업체에 같은 답이 적혀 있으면 뺀다(다시 기록하자고 하지 않게) — 사실만 */
export function newFacts(answers: readonly TalkAnswer[], stored: (key: QuestionKey) => 'yes' | 'no' | null): TalkAnswer[] {
  return answers.filter((t) => t.mode === 'fact' && stored(t.key) !== t.a)
}

/* ------------------------------------------------------------------ */
/* D-503 말한 숫자 → 회사 정보(사실 창고) — 매출 · 영업이익 · 순이익 · 자산 · 부채 · 올해 예상 매출 · 직원 수        */
/* ------------------------------------------------------------------ */

export type TalkNumberKey = 'revenue' | 'expectedRevenue' | 'operatingProfit' | 'netIncome' | 'totalAssets' | 'totalLiabilities' | 'employeeCount'

export interface TalkNumber {
  key: TalkNumberKey
  /** 저장할 값(사실 창고 모양 — 원은 숫자 글자, 직원 수는 'N명') */
  value: string
  /** 화면 값(35억원 · 18명) */
  display: string
  /** 몇 년 숫자인지('2025' · 모르면 '') */
  asOf: string
  label: string
  phrase: string
}

export const TALK_NUMBER_LABEL: Record<TalkNumberKey, string> = {
  revenue: '매출',
  expectedRevenue: '올해 예상 매출',
  operatingProfit: '영업이익',
  netIncome: '순이익',
  totalAssets: '자산',
  totalLiabilities: '부채',
  employeeCount: '직원 수',
}

/** 돈 글자 → 원(12억 · 12억 5천만 · 3억5000만 · 8천만 · 1,200만 · 1.5억) — 못 읽으면 null */
export function wonOfTalk(text: string): number | null {
  const t = String(text ?? '').replace(/[\s,원]/g, '')
  const m = /^(?:(\d+(?:\.\d+)?)억)?(?:(\d+(?:\.\d+)?)천만)?(?:(\d+(?:\.\d+)?)만)?$/.exec(t)
  if (!m || (!m[1] && !m[2] && !m[3])) return null
  return Math.round(Number(m[1] ?? 0) * 1e8 + Number(m[2] ?? 0) * 1e7 + Number(m[3] ?? 0) * 1e4)
}

/** 12억 3,400만원 · 8,000만원 */
export function wonText(won: number): string {
  const eok = Math.floor(won / 1e8)
  const man = Math.round((won % 1e8) / 1e4)
  return eok > 0 ? `${eok.toLocaleString('ko-KR')}억${man > 0 ? ` ${man.toLocaleString('ko-KR')}만` : ''}원` : `${man.toLocaleString('ko-KR')}만원`
}

const MONEY = /\d[\d,]*(?:\.\d+)?\s*억(?:\s*\d[\d,]*\s*천?\s*만)?|\d[\d,]*(?:\.\d+)?\s*천\s*만|\d[\d,]*\s*만/
/** 돈 주제 — 앞의 것이 먼저(매출총이익 · 매출원가는 매출이 아니다) */
const MONEY_TOPICS: readonly { key: TalkNumberKey; re: RegExp }[] = [
  { key: 'operatingProfit', re: /영업\s*이익/ },
  { key: 'netIncome', re: /당기\s*순\s*이익|순\s*이익/ },
  { key: 'revenue', re: /(?:연\s*)?매출(?:액)?(?!\s*(?:총\s*이익|원가))/ },
  { key: 'totalLiabilities', re: /부채(?:\s*총액)?(?!\s*비율)/ },
  { key: 'totalAssets', re: /자산(?:\s*총액)?/ },
]
const EXPECT = /예상|목표|전망|될\s*것|예정|정도\s*될|찍을|바라보/
const STAFF = /(?:직원|근로자|인원|사원|상시\s*근로자|식구)\s*(?:이|은|는|수|수가|가)?\s*(?:총|모두|전부)?\s*(?:약)?\s*(\d{1,4})\s*명/

function yearOf(clause: string, thisYear: number): string {
  if (/재작년/.test(clause)) return String(thisYear - 2)
  if (/작년|지난\s*해|전년/.test(clause)) return String(thisYear - 1)
  const y = /(20\d{2})\s*년/.exec(clause)
  if (y) return y[1]
  if (/올해|금년|이번\s*해/.test(clause)) return String(thisYear)
  return ''
}

/**
 * 말에서 회사 숫자 읽기 — 주제 낱말 바로 뒤(없으면 바로 앞) 25자 안의 돈 · 사람 수만. 가정(…이면?)은 읽지 않는다.
 * 같은 숫자가 여러 번 나오면 마지막 말.
 */
export function talkNumbers(text: string, thisYear: number): TalkNumber[] {
  const out = new Map<TalkNumberKey, TalkNumber>()
  const put = (n: TalkNumber) => {
    out.delete(n.key)
    out.set(n.key, n)
  }
  for (const c of clausesOf(text)) {
    if (IF.test(c)) continue
    let rest = c
    for (const t of MONEY_TOPICS) {
      const m = t.re.exec(rest)
      if (!m) continue
      const after = rest.slice(m.index + m[0].length, m.index + m[0].length + 25)
      const before = rest.slice(Math.max(0, m.index - 14), m.index)
      // 뒤에 없으면 바로 앞에 붙은 숫자만('35억 매출') — 앞 주제의 숫자를 가져오지 않게
      const a = MONEY.exec(after)
      const b = a ? null : new RegExp(`(${MONEY.source})\\s*(?:의|짜리)?\\s*$`).exec(before)
      const moneyText = a ? a[0] : b ? b[1] : ''
      // 한 마디에 '매출 35억에 영업이익 3억' 처럼 두 주제가 있으면 앞 주제가 쓴 부분은 지운다
      rest = rest.slice(0, m.index) + ' '.repeat(m[0].length) + rest.slice(m.index + m[0].length)
      const won = moneyText ? wonOfTalk(moneyText) : null
      if (won === null || won <= 0) continue
      rest = rest.replace(moneyText, ' '.repeat(moneyText.length))
      const key: TalkNumberKey = t.key === 'revenue' && EXPECT.test(c) ? 'expectedRevenue' : t.key
      put({ key, value: String(won), display: wonText(won), asOf: key === 'expectedRevenue' ? String(thisYear) : yearOf(c, thisYear), label: TALK_NUMBER_LABEL[key], phrase: c.slice(0, 60) })
    }
    const s = STAFF.exec(c)
    if (s && !HIRE.test(c.replace(STAFF, ' '))) {
      const n = Number(s[1])
      if (n > 0 && n < 5000) put({ key: 'employeeCount', value: `${n}명`, display: `${n}명`, asOf: '', label: TALK_NUMBER_LABEL.employeeCount, phrase: c.slice(0, 60) })
    }
  }
  return [...out.values()]
}

/** 이미 같은 숫자가 적혀 있으면 뺀다 — stored 는 사실 창고의 지금 값(원 숫자 글자 · '12명(대표 포함)') */
export function newNumbers(nums: readonly TalkNumber[], stored: (key: TalkNumberKey) => string): TalkNumber[] {
  return nums.filter((n) => {
    const cur = String(stored(n.key) ?? '').trim()
    if (!cur) return true
    if (n.key === 'employeeCount') return Number(/\d+/.exec(cur)?.[0] ?? NaN) !== Number(/\d+/.exec(n.value)?.[0])
    return Number(cur.replace(/[^\d.-]/g, '')) !== Number(n.value)
  })
}
