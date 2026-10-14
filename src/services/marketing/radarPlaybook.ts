/**
 * 콘텐츠 레이더 — 주제 분류표 · MIRAE 관점 문장 (D-194).
 *
 * 규칙이다('AI' 아님 · 외부 호출 없음). 사람이 미리 써 둔 문장을 데이터 신호에 맞춰 골라 보여 준다.
 *  - 주제 분류표: 제목을 정규화(표기 차이 합치기)한 뒤 정해 둔 말이 들어 있으면 그 주제로 본다.
 *    정부지원금 · 지원금 · 장려금 처럼 뜻이 비슷해도 같은 말로 합치지 않는다 — 상위 묶음(parent)만 같이 쓴다.
 *  - 관점(angle): 주제마다 '시장형' 과 'MIRAE AX형(BRIDGE)' 두 갈래 — 관점 한 줄 · 제목 후보 3 · 썸네일 문구 2.
 *    경쟁 영상 제목을 바꿔 쓰지 않는다. 모두 우리 말로 새로 쓴 문장이다(기계적으로 '키워드 + 방법' 을 붙이지 않는다).
 *  - 나중에 대본 만들기(LLM)를 붙일 때도 이 관점 · 제목이 '브리프' 의 바탕이 된다(지금은 호출 0).
 */

/** 콘텐츠 3축 — 시장수요형 · AX·AI 실무형 · BRIDGE(시장 주제 + AX) */
export type ContentAxis = 'market' | 'axai' | 'bridge'

/**
 * 내용 영역(D-197) — 채널 묶음(직접 경쟁 · AI 실무 · AX · 포맷 = 채널 출처)과 다르다.
 * 영상 · 주제마다 붙는다: 경제 유튜버가 AI 영상을 올리면 그 영상은 ai, AI 채널이 경영전략을 말하면 business.
 * 메인 추천은 economy · business · ai 안에서만 — 분류표에 없는 영상(other)은 주제 묶음이 생기지 않는다.
 */
export type ContentDomain = 'economy' | 'business' | 'ai' | 'other'
export const CORE_DOMAINS: readonly ContentDomain[] = ['economy', 'business', 'ai']
export const DOMAIN_LABEL: Record<ContentDomain, string> = { economy: '경제', business: '경영', ai: 'AI · AX', other: '기타' }

export interface Angle {
  /** 카드 머리 이름 — BRIDGE 는 '정책자금 × 공고 자동 수집' 처럼 뒤에 붙는다 */
  name?: string
  /** MIRAE 관점 — 우리는 어떻게 비틀어 말하나(한 줄) */
  view: string
  /** 제목 후보 3개 */
  titles: readonly [string, string, string]
  /** 썸네일 문구 후보 2개 */
  thumbs: readonly [string, string]
}

export interface TopicDef {
  id: string
  label: string
  /** 시장수요(market) · AI 실무(ai) · AX/자동화(ax) */
  area: 'market' | 'ai' | 'ax'
  /** 내용 영역 — 없으면 시장수요는 경영(business) · AI/AX 는 ai (D-197 경제 주제만 'economy' 를 적는다) */
  domain?: ContentDomain
  /** 상위 묶음 — 뜻이 비슷한 주제끼리 같은 묶음(합치지는 않는다) */
  parent: string
  /** MIRAE 관점 짧게 — 신호판 한 줄('금리 → 중소기업 대출 · 정책자금 금리'). 경제 · AI 도구 주제만(D-197) */
  focus?: string
  /** 정규화한 제목에서 찾는 말 */
  match: RegExp
  /** 시장형(시장 주제) 또는 실무형(AI · AX 주제) */
  main: Angle
  /** BRIDGE — 시장 주제에만 */
  bridge?: Angle
}

/**
 * 표기 차이 합치기 — 소문자 · 띄어쓰기 · 한글/영문 표기.
 * 정책 자금 → 정책자금 · 챗GPT/챗지피티/ChatGPT → chatgpt · 클로드 → claude · 인공지능 → ai · AI 전환/AI 도입 → ax
 */
const NORMALIZE: ReadonlyArray<readonly [RegExp, string]> = [
  [/정책\s+자금/g, '정책자금'],
  [/업무\s+자동화/g, '업무자동화'],
  [/지원\s+사업/g, '지원사업'],
  [/정부\s+지원금/g, '정부지원금'],
  [/고용\s+(지원금|장려금)/g, '고용$1'],
  [/세무\s+조사/g, '세무조사'],
  [/가업\s+승계/g, '가업승계'],
  [/법인\s+전환/g, '법인전환'],
  [/가족\s+법인/g, '가족법인'],
  [/벤처\s+(인증|기업)/g, '벤처$1'],
  [/기업\s*부설\s*연구소/g, '기업부설연구소'],
  [/창업\s+감면/g, '창업감면'],
  [/구글\s+시트/g, '구글시트'],
  [/앱스\s+스크립트|apps\s*script/g, '앱스스크립트'],
  [/챗\s*gpt|챗\s*지피티|쳇\s*gpt|chat\s*gpt|챗지피티/g, ' chatgpt '],
  [/클로드/g, ' claude '],
  [/제미나이|제미니/g, ' gemini '],
  [/노트북\s*lm|notebook\s+lm|노트북엘엠/g, ' notebooklm '],
  // D-197 AI 세부 도구 — 한글 표기도 같은 말로(아스트라제네카 같은 다른 말은 빼고)
  [/코덱스/g, ' codex '],
  [/아스트라(?!\s?제네카)/g, ' astra '],
  [/소넷/g, ' sonnet '],
  [/오퍼스/g, ' opus '],
  [/인공\s*지능|에이아이/g, ' ai '],
  [/\bai\s*(전환|도입)|디지털\s*전환|에이엑스/g, ' ax '],
  [/바이브\s*코딩/g, '바이브코딩'],
  [/노\s+코드|no-?\s?code/g, '노코드'],
]

/** 제목 → 비교용 글(소문자 · 표기 합침 · 앞뒤 칸) */
export function normalizeTitle(title: string): string {
  let s = ` ${String(title ?? '').toLowerCase()} `
  for (const [re, to] of NORMALIZE) s = s.replace(re, to)
  return s.replace(/\s+/g, ' ')
}

/** 주제 분류표 — 위에서부터(좁은 것 먼저) */
export const TOPICS: readonly TopicDef[] = [
  /* ---------------- 경제(D-197) — 거시 뉴스가 아니라 '중소기업 대표가 챙길 것' 으로 ---------------- */
  {
    id: 'rate',
    label: '금리 · 대출 환경',
    area: 'market',
    domain: 'economy',
    parent: '금리',
    focus: '중소기업 대출 이자 · 정책자금 금리로',
    // '저금리 2억' 같은 정책자금 안내는 정책자금 주제 — 여기는 기준금리 · 금리 방향 · 대출 시장만
    match: /기준\s?금리|금리\s?(인하|인상|동결|전망|변동|오르|올라|오른|내리|내려|내린|떨어|하락|상승|시대)|고금리|한국은행|연준|\bfed\b|fomc|대출\s?(규제|한도|중단|금리|이자|문턱)|대출\s?(안|못)\s?나|이자\s?(부담|폭탄)|자금\s?(경색|시장)|돈줄|유동성|회사채|신용\s?(경색|등급)/,
    main: {
      view: '금리 뉴스를 전하는 대신 "금리가 바뀌면 우리 회사 대출 이자 · 정책자금에서 무엇이 달라지나" 로 바꿔 말합니다.',
      titles: ['기준금리가 바뀌면 중소기업 대출 이자는 얼마나 달라질까', '금리 내릴 때 대표님이 먼저 갈아탈 대출, 지킬 대출', '정책자금 vs 은행 대출, 지금 금리에서는 무엇이 유리할까'],
      thumbs: ['우리 회사 이자는?', '갈아탈까 지킬까'],
    },
    bridge: {
      name: '자금조달 시뮬레이션',
      view: '금리가 0.5%p 바뀔 때 우리 회사 이자 · 현금 흐름이 어떻게 변하는지 숫자로 바로 보여 주는 장치를 만듭니다.',
      titles: ['금리 바뀔 때 우리 회사 이자, 자동으로 계산해 봤습니다', '대출 여러 개 쓰는 회사, 금리 시뮬레이션 표 만들기', '정책자금과 은행 대출 이자를 한 장으로 비교하는 법'],
      thumbs: ['금리 바뀌면 이자는?', '대출 한 장 비교'],
    },
  },
  {
    id: 'fx',
    label: '환율 · 달러',
    area: 'market',
    domain: 'economy',
    parent: '환율 · 무역',
    focus: '수입 원가 · 수출 대금 · 달러 결제로',
    match: /환율|원\s?달러|강달러|약달러|달러\s?(강세|약세|환율|가치|투자|연금|예금|보험|결제)|달러로\s|엔화|엔저|외환/,
    main: {
      view: '환율 전망 대신 "수입 · 수출하는 중소기업 대표가 이번 달 실제로 확인할 것" 으로 말합니다.',
      titles: ['환율이 오르면 수입하는 회사는 무엇부터 막아야 할까', '수출 중소기업이 환율 변동에 대비하는 현실적인 방법', '달러 결제하는 대표님이 이번 달 꼭 확인할 3가지'],
      thumbs: ['환율, 우리 회사는?', '이번 달 확인할 3가지'],
    },
    bridge: {
      name: '환율 자동 알림',
      view: '거래 통화 · 환율 기준선을 넣어 두면 넘을 때 알려 주고, 원가 변화까지 바로 계산해 주는 흐름을 보여 줍니다.',
      titles: ['환율이 기준을 넘으면 알려 주는 자동 알림 만들기', '수입 원가를 환율에 맞춰 자동으로 다시 계산해봤습니다', '달러 결제 회사의 환율 대시보드, 한 장으로 만들기'],
      thumbs: ['환율 넘으면 알림', '원가 자동 계산'],
    },
  },
  {
    id: 'trade',
    label: '관세 · 수출입',
    area: 'market',
    domain: 'economy',
    parent: '환율 · 무역',
    focus: '우리 회사 납품 · 원가 영향으로',
    match: /관세|수출|수입\s?(물가|규제|단가|원가)|무역|공급망|보호무역/,
    main: {
      view: '관세 뉴스를 전하는 데서 멈추지 않고 "우리 회사 납품 · 원가에 어떤 영향이 오나" 로 정리합니다.',
      titles: ['관세가 바뀌면 중소 제조업 원가는 어떻게 달라질까', '수출하는 중소기업이 지금 챙길 지원 제도 정리', '납품 단가 압박이 올 때 대표님이 먼저 할 일'],
      thumbs: ['관세, 원가 영향은?', '수출 기업 지원'],
    },
    bridge: {
      name: '원가 영향 계산',
      view: '관세 · 환율 변화를 넣으면 품목별 원가가 얼마나 바뀌는지 바로 보여 주는 계산 장치를 만듭니다.',
      titles: ['관세가 오르면 우리 제품 원가는? 자동으로 계산해봤습니다', '품목별 원가 영향표를 한 번에 만드는 방법', '수출 서류 · 일정 관리를 자동으로 챙기는 법'],
      thumbs: ['원가 영향 바로', '수출 서류 자동'],
    },
  },
  {
    id: 'economy_cycle',
    label: '경기 · 소비',
    area: 'market',
    domain: 'economy',
    parent: '경기 · 물가',
    focus: '매출이 줄 때 줄일 비용 · 지킬 현금으로',
    // '경기' 하나만으로는 경기도(지역)와 섞인다 — 경기 + 방향 · 상태 말이 붙을 때만
    match: /경기\s?(침체|회복|전망|둔화|불황|부진|악화|하강|흐름|위축|바닥)|불경기|불황|경제\s?(위기|전망|상황|성장률|흐름)|성장률|소비\s?(위축|심리|부진|침체|쿠폰|트렌드|절벽)|내수/,
    main: {
      view: '경기 전망 대신 "매출이 줄 때 대표가 먼저 줄일 비용과 끝까지 지킬 현금" 으로 바꿔 말합니다.',
      titles: ['경기가 꺾일 때 대표님이 먼저 줄일 비용, 지킬 비용', '매출이 줄어도 버티는 회사들의 현금 관리 습관', '불황에 오히려 고객이 늘어난 작은 회사의 공통점'],
      thumbs: ['줄일 비용, 지킬 비용', '불황에 버티는 법'],
    },
    bridge: {
      name: '현금 버팀 계산',
      view: '매출이 10 · 20% 줄었을 때 몇 달을 버틸 수 있는지 우리 회사 숫자로 바로 계산하는 장치를 보여 줍니다.',
      titles: ['매출이 20% 줄면 몇 달 버틸까? 자동으로 계산해봤습니다', '불황 대비 현금 흐름표를 자동으로 만드는 법', '고정비를 한눈에 보는 대시보드로 비용 줄이기'],
      thumbs: ['몇 달 버틸까?', '고정비 한눈에'],
    },
  },
  {
    id: 'prices',
    label: '물가 · 원가 상승',
    area: 'market',
    domain: 'economy',
    parent: '경기 · 물가',
    focus: '원가 · 인건비 오를 때 가격 · 마진으로',
    match: /물가|인플레|디플레|스태그|원자재\s?(값|가격)|원가\s?(상승|폭등|급등)|인건비\s?(상승|폭등)/,
    main: {
      view: '물가 지표 대신 "원가 · 인건비가 오를 때 가격을 어떻게 올리고 무엇을 줄이나" 로 말합니다.',
      titles: ['물가가 오를 때 작은 회사가 가격을 올리는 순서', '원가 · 인건비가 같이 오를 때 먼저 손볼 3가지', '가격 올렸다가 고객이 떠난 회사, 무엇을 놓쳤나'],
      thumbs: ['가격 올리는 순서', '먼저 손볼 3가지'],
    },
    bridge: {
      name: '원가 자동 점검',
      view: '재료비 · 인건비가 바뀔 때 마진이 얼마나 줄었는지 매달 자동으로 점검하는 흐름을 보여 줍니다.',
      titles: ['물가 올라도 마진 지키는 원가 점검 자동화', '재료비가 오르면 마진이 얼마나 줄까? 자동 계산', '가격 인상 시뮬레이션 표를 1분 만에 만드는 법'],
      thumbs: ['마진 자동 점검', '가격 인상 계산'],
    },
  },
  {
    id: 'sme_economy',
    label: '중소기업 · 소상공인 경기',
    area: 'market',
    domain: 'economy',
    parent: '중소기업 경기',
    focus: '지금 쓸 수 있는 지원 · 먼저 정리할 것으로',
    match: /폐업|줄폐업|매출\s?(감소|급감|반토막|하락|뚝|절벽)|소상공인\s?(경기|위기|부채|빚)|자영업\s?(위기|몰락|경기|부채|빚)|중소기업\s?(경기|위기|부도|자금난)|부도|파산|회생\s?(신청|절차)|경영\s?(위기|악화)|빚\s?(폭탄|탕감)|부채\s?(탕감|조정)|채무\s?조정/,
    main: {
      view: '폐업 · 매출 감소 소식을 전하는 대신 "지금 쓸 수 있는 지원과 먼저 정리할 것" 을 순서대로 말합니다.',
      titles: ['매출이 줄어든 소상공인이 지금 먼저 신청할 것', '폐업을 고민할 때 대표님이 꼭 확인할 제도 정리', '자영업 위기, 버틴 가게와 문 닫은 가게의 차이'],
      thumbs: ['지금 먼저 신청할 것', '버틴 가게의 차이'],
    },
    bridge: {
      name: '위기 신호 알림',
      view: '매출 · 미수금 · 현금 흐름이 위험선에 가까워지면 미리 알려 주는 장치를 보여 줍니다 — 위기를 "늦게 아는 문제" 로 말합니다.',
      titles: ['매출이 위험선에 닿기 전에 알려 주는 알림 만들기', '미수금 · 현금 흐름을 한 장으로 보는 위기 대시보드', '소상공인 지원 공고를 내 조건으로 자동 확인하기'],
      thumbs: ['위험선 알림', '위기 대시보드'],
    },
  },
  {
    id: 'real_estate',
    label: '부동산 · 상가 · 사옥',
    area: 'market',
    domain: 'economy',
    parent: '부동산',
    focus: '사옥 · 상가 · 공장 결정으로',
    // '부동산 과다보유법인'(비상장주식 평가 · 세금 말)은 빼고
    match: /부동산(?!\s?과다)|상가|아파트|집값|전세|월세|임대료|오피스텔|분양|재건축|사옥|공장\s?(부지|매입|임대)/,
    main: {
      view: '집값 이야기 대신 "사업장 · 사옥 · 상가를 둘러싼 대표님의 결정" 으로 좁혀 말합니다.',
      titles: ['사옥을 살까 임대할까, 법인 대표가 따져 볼 숫자', '상가 임대료가 오를 때 사장님이 먼저 볼 계약 조항', '법인으로 부동산 살 때 생각보다 커지는 세금'],
      thumbs: ['살까 임대할까', '계약 조항 먼저'],
    },
    bridge: {
      name: '임대 비교 계산',
      view: '임대 · 매입을 우리 회사 숫자로 나란히 놓고 5년 비용을 바로 비교하는 계산 장치를 보여 줍니다.',
      titles: ['사옥 매입 vs 임대, 5년 비용을 자동으로 비교해봤습니다', '임대료 · 관리비를 한 장으로 보는 사업장 비용표', '상가 계약 갱신일을 놓치지 않게 자동 알림 걸기'],
      thumbs: ['5년 비용 비교', '갱신일 자동 알림'],
    },
  },
  {
    id: 'stocks',
    label: '주식 · 금융시장',
    area: 'market',
    domain: 'economy',
    parent: '금융시장',
    focus: '법인 여유자금 · 투자 세금으로',
    // 비상장주식 · 자기주식 · 주식 평가 · 주식 이동(승계 · 세금 말) · 주식회사는 빼고 — 시장 · 투자 말만.
    // 실제 데이터: "'이 3개 주식' 모아가면" · "삼성전자 … 폭등" 같은 투자 인터뷰가 빠져 있었다(D-197)
    match: /증시|코스피|코스닥|나스닥|주가|(?<![가-힣])주식(?!\s?(평가|가치|명의|이동|양도|증여|보상|회사|매수\s?청구))|금융\s?시장|\betf\b|채권\s?(금리|시장|투자)|배당주|주도주|삼성전자|하이닉스|금값|코인/,
    main: {
      view: '종목 이야기 대신 "법인 여유자금을 어디에 · 어떻게 두는 게 맞나" 로 대표님 관점에서 말합니다.',
      titles: ['법인 여유자금, 통장에 두는 게 맞을까', '증시가 흔들릴 때 법인 대표가 먼저 지킬 돈', '법인 이름으로 투자할 때 꼭 알아야 할 세금'],
      thumbs: ['법인 여유자금 어디에?', '먼저 지킬 돈'],
    },
    bridge: {
      name: '여유자금 대시보드',
      view: '법인 통장 · 예금 · 투자 현황을 한 장으로 모아 언제 쓸 돈인지 나눠 보이게 만드는 과정을 보여 줍니다.',
      titles: ['법인 여유자금 현황을 한 장으로 모으는 대시보드', '운영자금과 여유자금을 자동으로 나눠 보는 법', '법인 통장 잔고를 매일 자동으로 정리해봤습니다'],
      thumbs: ['여유자금 한 장', '통장 자동 정리'],
    },
  },
  {
    id: 'econ_policy',
    label: '정부 경제정책 · 세법 개정',
    area: 'market',
    domain: 'economy',
    parent: '경제 정책',
    focus: '우리 회사에 언제부터 무엇이 달라지나로',
    match: /경제\s?정책|예산안|정부\s?예산|(중기부|중소벤처기업부)\s?예산|추경|최저\s?임금|세제\s?개편|세법\s?개정|개정\s?세법|세법이\s?바뀌|부동산\s?대책|정책\s?발표/,
    main: {
      view: '정책 발표를 그대로 읽지 않고 "우리 회사에 언제부터 무엇이 달라지나" 만 골라 말합니다.',
      titles: ['내년 정부 예산, 중소기업이 실제로 받을 수 있는 것만', '세법이 바뀌기 전에 대표님이 올해 안에 정할 것', '새 경제정책, 우리 회사에 해당하는지 3분 확인'],
      thumbs: ['우리 회사 해당?', '올해 안에 정할 것'],
    },
    bridge: {
      name: '변경 사항 자동 정리',
      view: '정책 · 세법 변경 발표를 우리 회사 조건에 맞는 것만 골라 정리해 주는 흐름을 보여 줍니다.',
      titles: ['세법 개정안에서 우리 회사 해당 내용만 골라 봤습니다', '정부 발표 자료를 AI로 3분 만에 정리하는 법', '바뀌는 제도를 달력에 자동으로 걸어 두기'],
      thumbs: ['해당 내용만', '발표 3분 정리'],
    },
  },

  /* ---------------- 경영 · 시장수요 ---------------- */
  {
    id: 'policy_fund',
    label: '정책자금',
    area: 'market',
    parent: '자금',
    match: /정책자금|직접대출|대리대출|운전자금|시설자금|중진공|소진공|신용보증|기술보증|보증서|정책\s?대출|저금리\s?대출|혁신성장.{0,6}자금|중저신용자/,
    main: {
      view: '자격 설명보다 "요즘 실제로 받는 회사" 의 공통점과 준비 순서를 보여 줍니다.',
      titles: ['정책자금, 올해 실제로 받은 회사들은 이것부터 달랐습니다', '정책자금 신청 전에 대표님이 직접 확인할 5가지', '정책자금 떨어지는 회사의 공통점, 서류보다 먼저 보는 것'],
      thumbs: ['받는 회사는 따로 있다', '신청 전 5가지'],
    },
    bridge: {
      name: '공고 자동 수집',
      view: '공고를 사람이 매일 찾는 대신, 우리 회사 조건에 맞는 공고만 자동으로 걸러 오는 과정을 직접 보여 줍니다.',
      titles: ['정책자금 공고를 매일 찾지 않게 AI로 자동화해봤습니다', '우리 회사가 받을 수 있는 정책자금만 골라 주는 시스템 만들기', '정책자금 마감 놓치지 않는 법, 사람 대신 알림이 챙기게'],
      thumbs: ['공고 찾기, 이제 자동', '놓친 마감 0건'],
    },
  },
  {
    id: 'employ_subsidy',
    label: '고용지원금',
    area: 'market',
    parent: '지원사업 · 지원금',
    match: /고용지원금|고용장려금|일자리.{0,6}장려금|청년.{0,4}도약|채용.{0,6}(지원금|장려금)|두루누리|고용유지/,
    main: {
      view: '채용하기 전에 확인해야 받을 수 있는 지원금을 "채용 순서" 대로 정리합니다.',
      titles: ['직원 뽑기 전에 꼭 확인할 고용지원금, 순서가 중요합니다', '청년 채용하면 받는 지원금, 신청 기한 놓치면 끝입니다', '고용지원금 받고도 다시 돌려주는 회사의 실수'],
      thumbs: ['뽑기 전에 확인', '기한 놓치면 끝'],
    },
    bridge: {
      name: '기한 자동 알림',
      view: '입사일만 넣으면 신청 기한이 저절로 잡히는 장치를 보여 줍니다 — 지원금을 "놓치지 않는 구조" 로 말합니다.',
      titles: ['직원 한 명 채용했는데 지원금을 놓치지 않게 만드는 시스템', '입사일만 넣으면 고용지원금 기한이 알아서 잡히게 해봤습니다', '고용지원금 신청 기한, 엑셀 대신 자동 알림으로 관리하기'],
      thumbs: ['기한 자동 알림', '놓친 지원금 0원'],
    },
  },
  {
    id: 'grant_program',
    label: '정부지원사업',
    area: 'market',
    parent: '지원사업 · 지원금',
    match: /지원사업|정부지원금|정부\s?지원|바우처|창업패키지|모두의창업|사업계획서|발표평가|r&d|공고/,
    main: {
      view: '공고 소개 대신 "선정되는 회사가 먼저 하는 준비" 를 단계로 정리합니다.',
      titles: ['정부지원사업, 공고 뜨고 준비하면 이미 늦습니다', '지원사업 선정되는 사업계획서, 심사위원이 먼저 보는 3가지', '올해 남은 지원사업, 우리 회사가 노릴 만한 것 고르는 법'],
      thumbs: ['공고 뜨면 늦다', '심사위원이 보는 3가지'],
    },
    bridge: {
      name: 'AI 자동 선별',
      view: '지원사업을 설명하는 대신, 공고 100개 중 우리 회사에 맞는 것만 골라내는 과정을 직접 보여 줍니다.',
      titles: ['공고 100개 중 우리 회사에 맞는 사업만 AI가 골라낼 수 있을까?', '지원사업 공고 읽는 데 쓰던 3시간, 10분으로 줄여봤습니다', '기업마당 공고를 매일 자동으로 걸러 받는 방법'],
      thumbs: ['100개 중 3개만', '3시간 → 10분'],
    },
  },
  {
    id: 'sme_subsidy',
    label: '소상공인 지원금',
    area: 'market',
    parent: '지원사업 · 지원금',
    match: /민생.{0,4}지원금|소상공인.{0,6}지원금|지역.{0,4}지원금|손실보상|상생보험|카드수수료.{0,4}지원|지원금/,
    main: {
      view: '지원금 목록을 읽어 주는 대신, 우리 가게가 받을 수 있는 것만 지역 · 업종 기준으로 추려 줍니다.',
      titles: ['소상공인 지원금, 우리 가게가 받을 수 있는 것만 골라봤습니다', '이번 달 소상공인 지원금, 신청 순서대로 정리했습니다', '지원금 안 나온 지역 사장님이 대신 챙길 것'],
      thumbs: ['우리 가게 해당?', '이번 달 신청할 것'],
    },
    bridge: {
      name: '내 조건 알림',
      view: '지역 · 업종 조건을 넣어 두면 새 지원금이 뜰 때 먼저 알려 주는 흐름을 보여 줍니다.',
      titles: ['새 지원금 공고가 뜨면 우리 가게에 맞는지 바로 알려 주게 만들기', '사장님 대신 지원금 공고를 지켜보는 알림 만들기', '지원금 정보, 단톡방 대신 내 조건으로 걸러 받기'],
      thumbs: ['알림이 먼저 온다', '내 조건만 골라'],
    },
  },
  {
    id: 'tax_audit',
    label: '세무조사',
    area: 'market',
    parent: '세금',
    match: /세무조사|국세청|추징|가산세/,
    main: {
      view: '조사 사례를 전하는 데서 멈추지 않고 "평소에 무엇을 남겨 두면 되는지" 로 바꿔 말합니다.',
      titles: ['세무조사 받는 회사들의 공통점, 평소 장부에서 보입니다', '세무조사 통지를 받으면 첫날 해야 할 일', '국세청이 먼저 보는 숫자 3가지'],
      thumbs: ['조사 받는 회사 공통점', '통지 받은 첫날'],
    },
    bridge: {
      name: '자료 자동 보관',
      view: '통장 · 카드 · 증빙을 평소에 자동으로 모아 두면 조사 대응이 쉬워지는 흐름을 보여 줍니다.',
      titles: ['세무조사 대비 자료, 평소에 자동으로 모아 두는 법', '통장 · 카드 내역 정리를 자동화하면 생기는 변화', '조사 대응 자료를 하루 만에 꺼낼 수 있게 만든 방법'],
      thumbs: ['자료는 평소에', '하루 만에 꺼내기'],
    },
  },
  {
    id: 'succession',
    label: '가업승계 · 증여',
    area: 'market',
    parent: '승계 · 법인',
    match: /가업승계|증여|상속|비상장주식|이익소각|자기주식|자사주|승계/,
    main: {
      view: '세법 설명보다 "우리 회사는 언제까지 무엇을 정해야 하나" 로 정리합니다.',
      titles: ['가업승계, 세법 바뀌기 전에 대표님이 정할 것', '비상장주식 증여, 시기 하나로 세금이 몇 배 달라집니다', '자녀에게 회사 넘길 때 가장 많이 하는 실수'],
      thumbs: ['바뀌기 전에 정할 것', '시기가 세금을 바꾼다'],
    },
    bridge: {
      name: '준비 체크리스트',
      view: '주식 가치 · 준비 서류를 해마다 자동으로 다시 점검하는 장치를 보여 줍니다.',
      titles: ['가업승계 준비 서류, AI로 체크리스트부터 만들어 봤습니다', '우리 회사 주식 가치, 해마다 자동으로 다시 계산하게 해 두기', '승계 준비를 10년 계획표로 만드는 방법'],
      thumbs: ['승계 체크리스트', '주식 가치 자동 계산'],
    },
  },
  {
    id: 'ceo_money',
    label: '법인 돈 · 대표 급여',
    area: 'market',
    parent: '승계 · 법인',
    match: /가지급금|가수금|대표\s?급여|대표\s?월급|법인\s?돈|회사\s?돈|법인자금|배당|퇴직금|돈\s?꺼내/,
    main: {
      view: '급여 · 배당 · 퇴직금을 같은 숫자로 나란히 놓고 "실제로 남는 돈" 을 보여 줍니다.',
      titles: ['법인 돈 꺼내는 방법, 급여 · 배당 · 퇴직금 실제로 남는 돈 비교', '가지급금 쌓이기 전에 대표님이 끊어야 할 습관', '대표 월급, 얼마가 가장 유리할까? 숫자로 계산해봤습니다'],
      thumbs: ['실제로 남는 돈', '가지급금 끊기'],
    },
    bridge: {
      name: '돈 흐름 대시보드',
      view: '회사 돈 흐름을 한 장으로 보이게 만들어, 가지급금이 쌓이기 전에 알려 주는 장치를 보여 줍니다.',
      titles: ['가지급금이 쌓이기 전에 알려 주는 회사 돈 관리 자동화', '대표 급여 · 배당 비교표를 자동으로 만들어 봤습니다', '회사 통장 흐름을 한 장으로 보는 대시보드 만들기'],
      thumbs: ['쌓이기 전에 알림', '한 장으로 보는 돈'],
    },
  },
  {
    id: 'incorporation',
    label: '법인전환 · 가족법인',
    area: 'market',
    parent: '승계 · 법인',
    match: /법인전환|가족법인|법인\s?설립|1인\s?법인|정관\s?(변경|점검|정비|개정)|회사\s?정관|상법\s?개정|개정\s?상법/, // '일정관리' 의 '정관' 같은 낱말 속 겹침을 피한다
    main: {
      view: '"법인이 좋다/나쁘다" 대신 "매출이 얼마일 때부터 이득인가" 의 기준선으로 설명합니다.',
      titles: ['법인전환, 매출 얼마부터 이득일까? 기준선 정리', '법인전환하고 후회하는 대표님들의 공통점', '가족법인, 세금 아끼는 원리와 조심할 점'],
      thumbs: ['얼마부터 이득?', '후회하는 이유'],
    },
    bridge: {
      name: '전환 자동 계산',
      view: '전환 전후 세금을 우리 회사 숫자로 바로 비교하는 계산 장치를 보여 줍니다.',
      titles: ['법인전환 할지 말지, 우리 회사 숫자로 자동 계산해봤습니다', '개인 vs 법인 세금 비교표를 1분 만에 만드는 법', '법인전환 준비 서류를 체크리스트로 자동 정리하기'],
      thumbs: ['1분 비교', '할까 말까 계산'],
    },
  },
  {
    id: 'certification',
    label: '기업인증(벤처 · 연구소)',
    area: 'market',
    parent: '인증',
    match: /벤처인증|벤처기업|이노비즈|메인비즈|기업부설연구소|연구소\s?설립|연구전담부서|기업인증|iso\s?인증/,
    main: {
      view: '요건을 나열하지 않고 "우리 회사가 지금 될지" 를 판단하는 기준으로 설명합니다.',
      titles: ['벤처인증, 우리 회사도 될까? 신청 전에 확인할 기준', '기업부설연구소 만들면 실제로 달라지는 것', '이노비즈 · 메인비즈, 무엇부터 준비해야 할까'],
      thumbs: ['우리 회사도 될까?', '인증 전 확인'],
    },
    bridge: {
      name: '준비자료 사전 점검',
      view: '준비자료를 먼저 점검해 빠진 것을 알려 주는 과정을 보여 줍니다 — 인증을 "준비 시스템" 으로 말합니다.',
      titles: ['벤처 · 이노비즈 준비자료를 AI가 먼저 점검한다면?', '인증 신청 서류, 빠진 것을 자동으로 찾아내기', '연구소 인정 요건을 체크리스트로 자동 판정해봤습니다'],
      thumbs: ['빠진 서류 자동 체크', '인증 준비 10분'],
    },
  },
  {
    id: 'startup_tax',
    label: '창업감면',
    area: 'market',
    parent: '세금',
    match: /창업감면|창업중소기업|창업기업|청년창업|세액감면/,
    main: {
      view: '제도 이름 대신 "언제 창업했으면 몇 년 동안 얼마" 로 바꿔 말합니다.',
      titles: ['창업감면, 법인을 만들고도 못 받는 경우가 있습니다', '창업중소기업 세액감면, 5년 동안 얼마나 아낄까', '창업 7년 안에 꼭 챙길 세금 혜택'],
      thumbs: ['만들고도 못 받는다', '5년 동안 얼마?'],
    },
    bridge: {
      name: '혜택 자동 판정',
      view: '설립일 · 업종 · 대표 나이만 넣으면 받을 수 있는지 바로 알려 주는 판정 장치를 보여 줍니다.',
      titles: ['우리 회사 창업감면, 받을 수 있는지 자동으로 판정해봤습니다', '창업 혜택 기한을 달력에 자동으로 걸어 두는 법', '창업기업 혜택을 놓치지 않게 만드는 체크 시스템'],
      thumbs: ['자동 판정', '기한 자동 알림'],
    },
  },
  {
    id: 'tax_saving',
    label: '절세 · 세금 신고',
    area: 'market',
    parent: '세금',
    match: /절세|법인세|종합소득세|종소세|부가세|부가가치세|세액공제|소득공제|세무\s?기장|세제|세법|세금/,
    main: {
      view: '제도 설명보다 "이 상황이면 얼마를 아끼나" 를 숫자로 보여 줍니다.',
      titles: ['법인 대표가 올해 안에 꼭 챙길 절세 3가지', '세금 신고 전에 대표님이 직접 확인할 것', '같은 매출인데 세금이 다른 이유, 장부에서 갈립니다'],
      thumbs: ['올해 안에 3가지', '세금이 다른 이유'],
    },
    bridge: {
      name: '증빙 자동 정리',
      view: '증빙 · 장부 정리를 자동으로 해 두면 절세 판단이 빨라지는 과정을 보여 줍니다.',
      titles: ['세무사에게 넘기기 전에 AI로 증빙을 정리해봤습니다', '영수증 정리를 자동화해서 경비 누락을 줄이는 법', '절세는 연말이 아니라 매달 장부에서 갈립니다, 자동으로 챙기는 법'],
      thumbs: ['증빙 정리 자동', '경비 누락 줄이기'],
    },
  },

  /* ---------------- 경영(D-197 더함) — 인사 · 재무 · 마케팅 · 비용 · 사업전략 · 경영관리 ---------------- */
  {
    id: 'hr',
    label: '인사 · 채용 · 노무',
    area: 'market',
    parent: '인사',
    match: /채용\s?(공고|면접|방법|실패|기준|비용)|직원\s?(채용|관리|교육|퇴사|해고|면접|뽑)|인사\s?(관리|평가|제도)|노무|근로\s?계약|4대\s?보험|퇴사\s?(처리|통보)|해고|주\s?52|연차\s?(수당|휴가)|인건비|급여\s?(계산|명세)|취업\s?규칙|노동법/,
    main: {
      view: '노무 규정 설명 대신 "직원 한 명 뽑고 내보낼 때까지 대표가 챙길 순서" 로 말합니다.',
      titles: ['직원 한 명 뽑을 때 대표님이 놓치기 쉬운 서류', '작은 회사가 직원과 다투지 않는 근로계약 원칙', '퇴사 처리할 때 나중에 문제 되는 3가지'],
      thumbs: ['놓치기 쉬운 서류', '다투지 않는 계약'],
    },
    bridge: {
      name: '입퇴사 자동 체크',
      view: '입사 · 퇴사 때 챙길 서류와 기한을 자동으로 걸어 두는 장치를 보여 줍니다.',
      titles: ['입사부터 퇴사까지 챙길 서류를 자동 체크리스트로', '4대보험 · 근로계약 기한을 놓치지 않게 만드는 법', '직원 관리 엑셀을 사내 시스템으로 옮겨 봤습니다'],
      thumbs: ['입퇴사 자동 체크', '기한 놓침 0'],
    },
  },
  {
    id: 'finance',
    label: '재무 · 현금흐름',
    area: 'market',
    parent: '재무',
    match: /현금\s?흐름|재무\s?(제표|관리|구조)|손익\s?(계산|분기)|원가\s?(관리|계산)|이익률|마진율|흑자|적자|자금\s?(관리|계획|흐름|운용)|매출\s?(관리|분석)|결산/,
    main: {
      view: '재무제표 읽는 법 대신 "다음 달 통장에 얼마가 남나" 를 먼저 보여 줍니다.',
      titles: ['흑자인데 통장이 비는 회사, 현금 흐름에서 갈립니다', '대표님이 매달 볼 숫자는 이 3개면 충분합니다', '매출은 늘었는데 남는 돈이 없는 이유'],
      thumbs: ['흑자인데 통장이 빈다', '매달 볼 숫자 3개'],
    },
    bridge: {
      name: '현금 흐름 대시보드',
      view: '통장 · 매출 · 지출을 한 장으로 모아 다음 달 남는 돈을 미리 보여 주는 대시보드를 만듭니다.',
      titles: ['다음 달 통장 잔고를 미리 보여 주는 대시보드 만들기', '매출 · 지출 정리를 자동으로 돌려 봤습니다', '현금 흐름표를 엑셀 없이 자동으로 만드는 법'],
      thumbs: ['다음 달 잔고 미리', '현금 흐름 자동'],
    },
  },
  {
    id: 'marketing',
    label: '마케팅 · 영업',
    area: 'market',
    parent: '마케팅',
    match: /마케팅|영업\s?(전략|방법|비법|노하우|자동화|관리|잘하)|세일즈|고객\s?(확보|유치|늘리|모으)|매출\s?(올리|늘리|올린|늘린|두\s?배)|브랜딩|광고\s?(비|효율|집행)|홍보\s?(방법|전략)|\bb2b\b|리드\s?(확보|발굴)|블로그\s?(마케팅|수익|자동화|운영)|플레이스\s?(상위|순위)/,
    main: {
      view: '마케팅 기법 대신 "작은 회사가 이번 달 고객 한 명을 더 데려오는 방법" 으로 좁혀 말합니다.',
      titles: ['광고비 없이 작은 회사가 고객을 늘린 방법', 'B2B 영업, 첫 미팅 전에 준비하면 계약률이 달라집니다', '블로그 · 플레이스, 사장님이 먼저 손볼 곳'],
      thumbs: ['광고비 없이 고객', '첫 미팅 준비'],
    },
    bridge: {
      name: 'AI 영업 자동화',
      view: '고객 응대 · 후속 연락 · 제안서 초안을 자동으로 돌려, 영업이 사람 기억에 기대지 않게 만드는 과정을 보여 줍니다.',
      titles: ['고객 후속 연락을 놓치지 않게 자동화해봤습니다', 'AI로 제안서 초안을 10분 만에 만드는 영업 흐름', '문의 응대부터 상담 예약까지 자동으로 이어 보기'],
      thumbs: ['후속 연락 자동', '제안서 10분'],
    },
  },
  {
    id: 'cost_cut',
    label: '비용 절감',
    area: 'market',
    parent: '비용',
    match: /비용\s?(절감|줄이|줄인|아끼|아낀)|비용을\s?줄|고정비|경비\s?(절감|줄이)|원가\s?절감|구독료\s?(정리|줄)/,
    main: {
      view: '"아끼세요" 대신 고정비 항목을 하나씩 펼쳐 실제로 줄인 금액을 보여 줍니다.',
      titles: ['작은 회사 고정비, 항목별로 줄여 본 결과', '대표님이 모르고 새는 비용 5가지', '비용 줄이다 매출까지 줄인 회사의 실수'],
      thumbs: ['새는 비용 5가지', '항목별로 줄였다'],
    },
    bridge: {
      name: '비용 자동 점검',
      view: '카드 · 구독료 · 고정비를 매달 자동으로 모아 늘어난 항목만 알려 주는 흐름을 보여 줍니다.',
      titles: ['회사 구독료 · 고정비를 매달 자동으로 점검해봤습니다', '법인카드 지출을 자동으로 분류해 새는 돈 찾기', '늘어난 비용만 알려 주는 알림 만들기'],
      thumbs: ['고정비 자동 점검', '새는 돈 찾기'],
    },
  },
  {
    id: 'strategy',
    label: '창업 · 사업전략',
    area: 'market',
    parent: '사업 전략',
    // '사업계획서'(지원사업 서류)는 정부지원사업 주제 — 여기는 사업 방향 · 구조 말만
    match: /사업\s?(전략|아이템|모델|확장|구조|방향)|경영\s?(전략|노하우|철학|원칙)|창업\s?(아이템|준비|실패|성공|하기\s?전|초기)|사장\s?(마인드|공부)|대표의\s?(생각|습관|하루|결정)|1인\s?(기업|창업)|스타트업\s?(창업|투자|대표)|사업\s?(망하|실패|성공)/,
    main: {
      view: '성공담 대신 "작은 회사가 다음 1년에 무엇을 하고 무엇을 하지 않을지" 를 정하는 기준으로 말합니다.',
      titles: ['창업 3년 차에 대표님이 다시 점검할 사업 구조', '작은 회사가 하지 말아야 할 확장 3가지', '잘되는 작은 회사는 무엇을 먼저 포기했나'],
      thumbs: ['3년 차 점검', '하지 말 확장'],
    },
    bridge: {
      name: '사업 점검표',
      view: '매출 구조 · 고객 · 비용을 한 장 점검표로 만들어 해마다 다시 보게 하는 장치를 보여 줍니다.',
      titles: ['사업 구조를 한 장 점검표로 만들어 봤습니다', 'AI로 우리 회사 사업 방향 초안을 다시 써 보기', '분기마다 사업 점검을 자동으로 돌리는 법'],
      thumbs: ['한 장 점검표', '분기 자동 점검'],
    },
  },
  {
    id: 'management',
    label: '경영관리 · 생산성',
    area: 'market',
    parent: '경영관리',
    match: /경영\s?관리|생산성|업무\s?(효율|방식)|조직\s?(관리|문화)|리더십|회의\s?(줄이|줄인|방법|문화)|보고\s?체계|성과\s?관리|\bkpi\b|\bokr\b/,
    main: {
      view: '경영 이론 대신 "대표 혼자 붙잡고 있는 일을 어떻게 덜어 내나" 로 말합니다.',
      titles: ['대표님 혼자 하던 일, 직원에게 넘기는 순서', '회의 · 보고를 반으로 줄인 작은 회사의 방식', '직원 10명 회사가 일하는 방식을 바꾼 첫 달'],
      thumbs: ['혼자 하던 일 넘기기', '회의 반으로'],
    },
    bridge: {
      name: '업무 흐름 자동화',
      view: '보고 · 승인 · 일정이 사람 손을 덜 타게 자동으로 이어지는 흐름을 보여 줍니다.',
      titles: ['매주 보고를 자동으로 모으는 흐름 만들기', '결재 · 승인을 카톡 대신 자동으로 돌려 봤습니다', '대표 업무 일정을 한 화면에서 보는 법'],
      thumbs: ['보고 자동 모으기', '결재 자동'],
    },
  },

  /* ---------------- AI 실무 ---------------- */
  {
    id: 'chatgpt',
    label: 'ChatGPT 업무 활용',
    area: 'ai',
    parent: 'AI 도구',
    focus: '보고서 · 견적서 · 제안서 초안 줄이기',
    match: / chatgpt |chatgpt|\bgpts?\b|지피티/,
    main: {
      view: '기능 소개보다 "대표님 회사에서 오늘 바로 쓰는 장면" 으로 보여 줍니다.',
      titles: ['중소기업 대표가 ChatGPT로 가장 먼저 줄일 수 있는 업무 3가지', 'ChatGPT로 견적서 · 제안서 초안을 10분 만에 만드는 과정', '직원 없이 ChatGPT로 해 본 일주일, 실제로 줄어든 일'],
      thumbs: ['오늘 바로 쓰는 3가지', '제안서 10분'],
    },
  },
  {
    id: 'codex',
    label: 'Codex 활용',
    area: 'ai',
    parent: 'AI 도구',
    focus: '개발자 없이 사내 업무 도구 만들기',
    match: /codex/,
    main: {
      view: '"개발자 없는 중소기업도 어디까지 업무 도구를 만들 수 있나" 를 실제로 만들어 보여 줍니다.',
      titles: ['개발자 없는 회사가 Codex로 업무 도구를 만들어 봤습니다', 'Codex로 반복 업무 하나를 자동화해 본 결과', 'Codex와 기존 AI 도구, 회사 일에는 무엇이 다를까'],
      thumbs: ['개발자 없이 만든 도구', '반복 업무 자동'],
    },
  },
  {
    id: 'astra',
    label: 'Astra 활용',
    area: 'ai',
    parent: 'AI 도구',
    focus: '기존 ChatGPT 대비 실무에서 달라진 점',
    match: /\bastra\b/,
    main: {
      view: '새 기능 소개보다 "기존 ChatGPT 대비 회사 실무에서 무엇이 달라졌나" 를 같은 업무로 비교해 보여 줍니다.',
      titles: ['Astra로 회사 업무를 해 보니 달라진 것', '기존 ChatGPT와 Astra, 같은 업무로 비교해봤습니다', 'Astra, 중소기업이 지금 써 볼 만한 업무 3가지'],
      thumbs: ['같은 업무로 비교', '써 볼 만한 3가지'],
    },
  },
  {
    id: 'sol',
    label: 'Sol 활용',
    area: 'ai',
    parent: 'AI 도구',
    focus: '기존 도구 대비 문서 업무에서 달라진 점',
    match: /\bsol\b/,
    main: {
      view: '새 모델 소식보다 "기존 도구 대비 기업 실무에서 무엇이 달라졌나" 로 보여 줍니다.',
      titles: ['Sol로 회사 문서 업무를 해 보니 달라진 것', '새 AI 모델 Sol, 우리 회사 업무에 바로 쓸 만할까', 'Sol과 기존 AI, 같은 업무로 비교해봤습니다'],
      thumbs: ['문서 업무 비교', '바로 쓸 만할까?'],
    },
  },
  {
    id: 'claude',
    label: 'Claude 활용',
    area: 'ai',
    parent: 'AI 도구',
    focus: '긴 문서 · 제안서 · 계약서 업무 줄이기',
    match: /claude/,
    main: {
      view: '도구 비교에서 멈추지 않고 "긴 문서 · 제안서 · 계약서 업무가 얼마나 줄어드나" 로 보여 줍니다.',
      titles: ['Claude로 회사 문서를 정리해 보니 달라진 것', 'ChatGPT와 Claude, 회사 업무에는 무엇이 맞을까?', 'Claude로 긴 계약서 · 공고문을 5분 만에 요약하는 법'],
      thumbs: ['긴 문서 5분 요약', '무엇이 맞을까?'],
    },
  },
  {
    id: 'gemini',
    label: 'Gemini 활용',
    area: 'ai',
    parent: 'AI 도구',
    focus: '구글 메일 · 문서로 바로 해 볼 일',
    match: /gemini/,
    main: {
      view: '구글 도구를 쓰는 회사가 "이미 가진 메일 · 문서" 로 바로 해 볼 수 있는 일로 보여 줍니다.',
      titles: ['구글 Gemini로 회사 메일 · 문서를 정리해봤습니다', '구글 워크스페이스 쓰는 회사라면 먼저 써 볼 기능', 'Gemini로 회의록 · 보고서 초안을 만들어 봤습니다'],
      thumbs: ['메일 정리 자동', '먼저 써 볼 기능'],
    },
  },
  {
    id: 'notebooklm',
    label: 'NotebookLM 활용',
    area: 'ai',
    parent: 'AI 도구',
    focus: '회사 자료에 묻고 답하게 만들기',
    match: /notebooklm/,
    main: {
      view: '"회사에 쌓인 자료에 묻고 답하게 만드는 장면" 을 처음부터 보여 줍니다.',
      titles: ['NotebookLM으로 회사 자료에 묻고 답하게 만들기', '매뉴얼 · 규정을 NotebookLM에 넣었더니 달라진 것', '직원 교육 자료를 NotebookLM으로 정리해봤습니다'],
      thumbs: ['회사 자료에 묻기', '교육 자료 정리'],
    },
  },
  {
    id: 'ai_docs',
    label: 'AI 문서 · 보고서',
    area: 'ai',
    parent: 'AI 도구',
    // AI 와 문서 말이 함께일 때만 — 계약서 · 견적서 · 요약은 도구 주제가 그대로 맡는다(D-195 시험) · 한 도구 이름이 있으면 그 도구 주제(topicsOf)
    match: /(\bai\b|chatgpt|claude|gemini|codex|astra|\bgpt).{0,14}(보고서|제안서|기획서|ppt|회의록|문서\s?(작성|정리|업무))|(보고서|제안서|기획서|ppt|회의록).{0,10}(\bai\b|chatgpt|claude|gemini)/,
    main: {
      view: '"문서 하나 만드는 데 걸리던 시간이 얼마나 줄었나" 를 같은 문서로 전후 비교해 보여 줍니다.',
      titles: ['AI로 보고서 초안을 만들어 보니 줄어든 시간', '제안서 · 기획서, AI에게 맡겨도 되는 부분과 아닌 부분', '회의록 정리를 AI로 자동화해 본 한 달'],
      thumbs: ['보고서 시간 절반', '맡겨도 되는 부분'],
    },
  },
  {
    id: 'ai_marketing',
    label: 'AI 마케팅 · 영업',
    area: 'ai',
    parent: 'AI 도구',
    match: /(\bai\b|chatgpt|claude|gemini|codex|astra|\bgpt).{0,14}(마케팅|영업|블로그|광고|홍보|상세\s?페이지|쇼핑몰|고객\s?응대)|(마케팅|영업|블로그|광고|홍보|상세\s?페이지).{0,10}(\bai\b|chatgpt|claude|gemini)/,
    main: {
      view: '"AI로 고객 한 명 더 데려오는 장면" 을 작은 회사 기준으로 보여 줍니다.',
      titles: ['AI로 블로그 · 상세페이지를 만들어 고객이 늘었을까', '작은 회사의 AI 영업, 문의 응대부터 바꿔 봤습니다', 'AI 마케팅, 광고비 대신 시간을 줄이는 법'],
      thumbs: ['AI로 고객 늘리기', '문의 응대 자동'],
    },
  },
  {
    id: 'ai_agent',
    label: 'AI 에이전트 · 비서',
    area: 'ai',
    parent: 'AI 도구',
    match: /에이전트|agent|ai\s?비서|자동\s?비서|ai\s?직원/,
    main: {
      view: '"AI가 다 해 준다" 가 아니라 맡겨도 되는 일과 아닌 일을 실제 업무로 나눠 보여 줍니다.',
      titles: ['AI 에이전트, 우리 회사 업무에 실제로 맡겨 본 결과', '직원 대신 반복 업무를 처리하는 AI 비서 만들기', 'AI 에이전트에 맡기면 안 되는 일, 맡겨도 되는 일'],
      thumbs: ['실제로 맡겨 봤다', '맡겨도 되는 일'],
    },
  },
  {
    id: 'prompt',
    label: '프롬프트',
    area: 'ai',
    parent: 'AI 도구',
    match: /프롬프트|prompt/,
    main: {
      view: '프롬프트 요령보다 "회사에서 그대로 쓰는 질문 모음" 으로 보여 줍니다.',
      titles: ['대표님이 바로 쓰는 업무 프롬프트 5가지', '같은 AI인데 결과가 다른 이유, 질문 방식 하나', '직원 교육용 프롬프트 모음을 회사에 만들어 두는 법'],
      thumbs: ['바로 쓰는 5가지', '질문 하나 차이'],
    },
  },
  {
    id: 'vibe_coding',
    label: 'AI로 직접 만들기',
    area: 'ai',
    parent: 'AI 도구',
    match: /바이브코딩|cursor|커서\s?ai|코딩\s?없이|앱\s?만들|ai로\s?만들|(ai|앱|프로그램|사이트|툴|화면).{0,8}만들어\s?봤|claude\s?(code|코드)|\bai\s?코딩/,
    main: {
      view: '"코딩 몰라도 된다" 를 말로 하지 않고, 회사에서 쓸 화면 하나를 실제로 만들어 보여 줍니다.',
      titles: ['코딩 몰라도 AI로 사내 프로그램 하나 만들어 봤습니다', '개발자 없이 AI로 만든 고객 관리 화면, 실제로 쓸 만할까?', '외주 맡기기 전에 AI로 시제품부터 만들어 보는 법'],
      thumbs: ['코딩 없이 만들었다', '외주 전에 시제품'],
    },
  },
  {
    id: 'ai_work',
    label: 'AI 업무 활용',
    area: 'ai',
    parent: 'AI 도구',
    match: /\bai\b/,
    main: {
      view: '최신 AI 소식 대신 "중소기업에서 실제로 쓰는 업무" 만 골라 보여 줍니다.',
      titles: ['중소기업에서 AI를 실제로 쓰는 업무 TOP 5', 'AI 도입, 큰돈 들이기 전에 우리 회사가 먼저 해 볼 것', 'AI로 매주 3시간 줄인 대표님의 업무 방식'],
      thumbs: ['실제로 쓰는 TOP 5', '매주 3시간'],
    },
  },

  /* ---------------- AX · 업무자동화 ---------------- */
  {
    id: 'nocode',
    label: '노코드 자동화(n8n · Make)',
    area: 'ax',
    parent: '자동화 · AX',
    match: /노코드|n8n|make\.com|\bmake\s?(로|으로|자동|시나리오)|메이크\s?(닷컴|자동화)|zapier|재피어|자피어/,
    main: {
      view: '도구 사용법보다 "회사 업무 하나가 자동으로 돌아가는 장면" 을 처음부터 끝까지 보여 줍니다.',
      titles: ['n8n으로 회사 업무 하나를 자동으로 돌려 봤습니다', '노코드 자동화, 중소기업이 가장 먼저 만들 흐름 3가지', '개발자 없이 자동화를 만들 때 꼭 막히는 곳'],
      thumbs: ['노코드로 자동화', '먼저 만들 3가지'],
    },
  },
  {
    id: 'sheets',
    label: '엑셀 · 구글시트 자동화',
    area: 'ax',
    parent: '자동화 · AX',
    match: /엑셀|구글시트|스프레드시트|앱스스크립트|vba|매크로/,
    main: {
      view: '함수 강의 대신 "엑셀로 하던 일이 저절로 돌아가게 바뀐 전후" 를 보여 줍니다.',
      titles: ['엑셀로 하던 고객 관리, 자동으로 돌아가게 바꿔 봤습니다', '구글시트 하나로 만드는 사내 업무 자동화', '매달 반복하는 엑셀 정리, AI에게 맡기는 법'],
      thumbs: ['엑셀 업무 자동', '시트 하나로'],
    },
  },
  {
    id: 'ax_adopt',
    label: 'AX · AI 도입',
    area: 'ax',
    parent: '자동화 · AX',
    match: / ax |\bax\b|\bdx\b|기업\s?ai|ai\s?컨설팅/,
    main: {
      view: '거창한 전환 대신 "직원 10명 회사가 첫 3개월에 실제로 바꾼 것" 으로 말합니다.',
      titles: ['중소기업 AX, 큰 시스템보다 먼저 할 일', 'AI 도입했는데 아무도 안 쓰는 회사의 공통점', '직원 10명 회사의 AI 전환, 첫 3개월 기록'],
      thumbs: ['AX 먼저 할 일', '아무도 안 쓰는 이유'],
    },
  },
  {
    id: 'inhouse',
    label: '사내 시스템',
    area: 'ax',
    parent: '자동화 · AX',
    match: /사내\s?(시스템|프로그램|툴)|\berp\b|\bcrm\b|그룹웨어|업무\s?시스템|내부\s?툴|사내\s?챗봇/,
    main: {
      view: '비싼 솔루션 소개 대신 "우리 회사 방식에 맞춰 작게 만든 시스템" 을 보여 줍니다.',
      titles: ['우리 회사에 맞는 사내 프로그램, 직접 만들어 쓰는 법', '엑셀 · 카톡으로 하던 업무를 사내 시스템으로 옮겨 봤습니다', '비싼 ERP 대신 작게 시작하는 사내 시스템'],
      thumbs: ['직접 만든 사내 툴', '작게 시작하기'],
    },
  },
  {
    id: 'automation',
    label: '업무자동화',
    area: 'ax',
    parent: '자동화 · AX',
    match: /업무자동화|자동화|rpa/,
    main: {
      view: '"자동화하면 편하다" 대신 줄어든 시간 · 실수를 숫자로 보여 줍니다.',
      titles: ['회사 반복 업무, 자동화하면 실제로 얼마나 줄까?', '업무자동화 처음 하는 회사가 가장 먼저 바꿀 것 3가지', '매일 하던 보고 업무를 자동으로 돌려 봤습니다'],
      thumbs: ['반복 업무 줄이기', '보고 업무 자동'],
    },
  },
]

export const TOPIC_BY_ID: ReadonlyMap<string, TopicDef> = new Map(TOPICS.map((t) => [t.id, t]))

/** 주제의 내용 영역(D-197) — 적지 않았으면 시장수요는 경영 · AI/AX 는 ai */
export const domainOfTopic = (t: Pick<TopicDef, 'area' | 'domain'> | undefined): ContentDomain => (t ? (t.domain ?? (t.area === 'market' ? 'business' : 'ai')) : 'other')
export const topicDomain = (id: string): ContentDomain => domainOfTopic(TOPIC_BY_ID.get(id))

/* ------------------------------------------------------------------ */
/* AI 도구 — 회사(OpenAI · Anthropic · Google)와 세부 이름(D-197)            */
/* ------------------------------------------------------------------ */

export type AiVendor = 'openai' | 'anthropic' | 'google'
export const VENDOR_LABEL: Record<AiVendor, string> = { openai: 'OpenAI', anthropic: 'Anthropic', google: 'Google AI' }

export interface AiKeywordDef {
  id: string
  label: string
  vendor: AiVendor
  /** 정규화한 제목에서 찾는 말 */
  match: RegExp
  /** 이 이름이 맞으면 들어가는 주제(묶음) — Opus · Sonnet 은 Claude, GPT(모델 이름)는 ChatGPT */
  topic: string
}

/**
 * AI 세부 이름 — 화면 'AI 핵심 키워드' 는 이 표 그대로(실제 최근 영상에 나온 것만 보인다 · 늘 띄우지 않는다).
 * ChatGPT · Claude · Gemini · Codex 를 하나의 'AI' 로 뭉개지 않는다.
 */
export const AI_KEYWORDS: readonly AiKeywordDef[] = [
  { id: 'chatgpt', label: 'ChatGPT', vendor: 'openai', match: / chatgpt |chatgpt|\bgpts\b|지피티/, topic: 'chatgpt' },
  // 'GPT-6' 같은 모델 이름(ChatGPT 는 위에서 따로 — 정규화로 'chatgpt' 가 되어 여기에 안 걸린다)
  { id: 'gpt', label: 'GPT', vendor: 'openai', match: /(?<![a-z])gpt(?![a-z])/, topic: 'chatgpt' },
  { id: 'codex', label: 'Codex', vendor: 'openai', match: /codex/, topic: 'codex' },
  { id: 'astra', label: 'Astra', vendor: 'openai', match: /\bastra\b/, topic: 'astra' },
  { id: 'sol', label: 'Sol', vendor: 'openai', match: /\bsol\b/, topic: 'sol' },
  { id: 'claude', label: 'Claude', vendor: 'anthropic', match: /claude/, topic: 'claude' },
  { id: 'opus', label: 'Opus', vendor: 'anthropic', match: /\bopus\b/, topic: 'claude' },
  { id: 'sonnet', label: 'Sonnet', vendor: 'anthropic', match: /\bsonnet\b/, topic: 'claude' },
  { id: 'gemini', label: 'Gemini', vendor: 'google', match: /gemini/, topic: 'gemini' },
  { id: 'notebooklm', label: 'NotebookLM', vendor: 'google', match: /notebooklm/, topic: 'notebooklm' },
]
export const AI_KEYWORD_BY_ID: ReadonlyMap<string, AiKeywordDef> = new Map(AI_KEYWORDS.map((k) => [k.id, k]))

/** AI 도구 주제(묶음) — ChatGPT · Codex · Astra · Sol · Claude · Gemini · NotebookLM. 상위 개념은 'AI 업무 활용'(ai_work) */
export const AI_TOOL_TOPICS: readonly string[] = [...new Set(AI_KEYWORDS.map((k) => k.topic))]
/** OpenAI 안에서 ChatGPT(일반)보다 좁은 제품 — 같이 나오면 좁은 쪽으로 센다('챗GPT는 못 열던 파일, 코덱스는 …' → Codex) */
const OPENAI_SPECIFIC = new Set(['codex', 'astra', 'sol'])

/** 제목에 나온 AI 세부 이름(키워드 판) — 본문(# 꼬리표 뺀 것)에서 먼저, 본문에 없을 때만 꼬리표에서 */
export function aiMentions(title: string): string[] {
  const raw = String(title ?? '')
  const find = (s: string) => {
    const n = normalizeTitle(s)
    return AI_KEYWORDS.filter((k) => k.match.test(n)).map((k) => k.id)
  }
  const body = find(raw.replace(/#[^\s#]+/g, ' '))
  return body.length ? body : find((raw.match(/#[^\s#]+/g) ?? []).map((t) => t.slice(1)).join(' '))
}

/**
 * 제목이 다루는 AI 도구 주제(묶음 단위) — Opus · Sonnet → Claude · GPT 모델 → ChatGPT.
 * D-195: 두 도구 이상을 함께 말하는 제목(비교 · 나열)은 어느 한 도구 주제로 세지 않고 'AI 업무 활용' 으로 센다.
 */
export function aiToolsOf(title: string): string[] {
  return [...new Set(aiMentions(title).map((id) => AI_KEYWORD_BY_ID.get(id)?.topic ?? id))]
}

/**
 * 도구 주제로 셀 것(D-197) — 한 회사 도구만 말할 때만:
 *  - 회사가 둘 이상(Claude vs GPT · 제미나이에 클로드) → 비교 · 나열 → 도구 주제 없음('AI 업무 활용')
 *  - OpenAI 하나: 좁은 제품(Codex · Astra · Sol)이 있으면 그것만 · 없으면 ChatGPT
 *  - Google 하나: Gemini · NotebookLM 각각 / Anthropic: Claude
 */
export function toolTopicsOf(title: string): string[] {
  const mentions = aiMentions(title)
  const vendors = new Set(mentions.map((id) => AI_KEYWORD_BY_ID.get(id)?.vendor))
  if (vendors.size !== 1) return []
  const topics = [...new Set(mentions.map((id) => AI_KEYWORD_BY_ID.get(id)?.topic ?? id))]
  if (vendors.has('openai')) {
    const specific = topics.filter((t) => OPENAI_SPECIFIC.has(t))
    return specific.length ? specific : topics.filter((t) => t === 'chatgpt')
  }
  return topics
}

/* ------------------------------------------------------------------ */
/* 경제 주제 지킴이 · 형식 꼬리표(D-197)                                     */
/* ------------------------------------------------------------------ */

const POLITICS = /탄핵|대선|총선|지방\s?선거|선거|여당|야당|민주당|국민의힘|국회의원|대통령실|좌파|우파|정치|정당|특검/
const BIZ_LINK = /중소기업|소상공인|자영업|사업자|대표|사장|법인|회사|기업|자금|대출|세금|세법|지원금|정책자금|매출/

/** 정치 일반 뉴스 — 기업 · 돈 말이 없으면 경제 주제로 세지 않는다(정치 뉴스가 레이더를 차지하지 않게) */
export const politicsOnly = (normalized: string) => POLITICS.test(normalized) && !BIZ_LINK.test(normalized)

export type FormatTag = 'interview' | 'vlog' | 'selfdev' | 'career'
export const FORMAT_LABEL: Record<FormatTag, string> = { interview: '전문가 인터뷰', vlog: '일상 · 브이로그', selfdev: '자기계발 · 성공', career: '직장 · 커리어' }
const FORMAT_RULES: ReadonlyArray<readonly [FormatTag, RegExp]> = [
  ['interview', /인터뷰|대담|초대석|토크쇼|만나\s?(다|보|봤)|만났|(대표|ceo|교수|전문가|변호사|세무사|회계사|노무사)(님)?(을|를|와|과)\s?(만나|함께)|(대표|ceo|전문가)\s?(에게|한테)\s?(물었|들었)|ep\.?\s?\d+\s?(\||-)/],
  ['vlog', /브이로그|vlog|일상|하루\s?(루틴|일과)|루틴|퇴근\s?후|출근길/],
  ['selfdev', /자기\s?계발|습관|성공한\s?사람|부자\s?(되|들|의)|마인드셋|동기\s?부여|독서/],
  ['career', /직장인|이직|연봉|퇴사|커리어|사회\s?초년생|면접\s?(꿀팁|후기)/],
]

/**
 * 영상 형식 꼬리표 — 제목 · 채널 설명(인터뷰 구성 채널)으로 규칙 판정. 사이드 급상승에서 '무엇을 참고할지' 에 쓴다.
 * 채널 메모에 '인터뷰' 가 있는 포맷 채널(교양식 · 김작가 TV)은 영상 제목에 말이 없어도 인터뷰로 본다.
 */
export function formatTagsOf(title: string, channelNote = ''): FormatTag[] {
  const t = String(title ?? '').toLowerCase()
  const out = FORMAT_RULES.filter(([, re]) => re.test(t)).map(([tag]) => tag)
  if (!out.includes('interview') && /인터뷰|대담/.test(channelNote)) out.unshift('interview')
  return out
}

/**
 * 제목(정규화 전) → 맞는 주제들. 같은 묶음(parent) 안에서는 먼저 맞은 좁은 주제 하나만 —
 * '고용지원금' 이 맞으면 같은 묶음의 넓은 '지원금' 으로 또 세지 않는다. 'AI 업무 활용' 은 다른 AI 주제가 없을 때만.
 * AI 도구는 한 회사 도구만 말하는 제목일 때만 그 도구 주제(toolTopicsOf) — 회사가 둘 이상이면 'AI 업무 활용'.
 * D-197: 경제 주제는 정치 일반 뉴스(기업 · 돈 말 없음)면 세지 않는다.
 */
export function topicsOf(title: string): string[] {
  const s = normalizeTitle(title)
  const mentioned = aiToolsOf(title)
  const tools = toolTopicsOf(title)
  const politics = politicsOnly(s)
  const out: string[] = []
  const parents = new Set<string>()
  for (const t of TOPICS) {
    if (AI_TOOL_TOPICS.includes(t.id)) {
      if (!tools.includes(t.id)) continue
    } else if (t.id === 'ai_work') {
      if (!t.match.test(s) && mentioned.length < 2) continue
    } else if (!t.match.test(s)) continue
    // AI 문서 · AI 마케팅은 '어느 도구' 가 아닌 영상만 — 한 도구를 말하면 그 도구 주제가 맡는다('클로드로 회의록' → Claude)
    if ((t.id === 'ai_docs' || t.id === 'ai_marketing') && tools.length > 0) continue
    if (politics && t.domain === 'economy') continue
    if (t.id === 'ai_work' && out.some((id) => TOPIC_BY_ID.get(id)?.area === 'ai')) continue
    if (t.id === 'automation' && out.some((id) => TOPIC_BY_ID.get(id)?.area === 'ax')) continue
    // 시장 묶음은 좁은 주제 하나만(지원금 계열 · 세금 계열이 겹쳐 세지지 않게)
    if (t.area === 'market' && parents.has(t.parent)) continue
    out.push(t.id)
    parents.add(t.parent)
  }
  return out
}

/** 영상(제목)의 내용 영역 — 주제가 있으면 그 영역들(경제 → 경영 → AI 순) · 없으면 ['other'] */
export function domainsOf(topics: readonly string[]): ContentDomain[] {
  const set = new Set(topics.map(topicDomain))
  const out = CORE_DOMAINS.filter((d) => set.has(d))
  return out.length ? out : ['other']
}
