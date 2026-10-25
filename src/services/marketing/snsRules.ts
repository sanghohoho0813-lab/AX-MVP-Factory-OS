/**
 * D-274 대표 보충본 — 스레드 · 릴스 · 틱톡 규칙 검사가 같이 쓰는 것(규칙 계산, AI 아님).
 *  - 1부 운영 원칙(대표가 대화에서 정한 기준 — 다른 공식보다 먼저): AX 는 '가점' 이 아니라 '눈에 띄게 해 주는 좋은 자료' ·
 *    순서는 기본 컨디션 → AX → 사업 성장 로드맵 · 자금 · 심사를 말하면 괄호 문장 · 벤처 보장 대신 쓸 문장.
 *  - '이렇게 말고 → 이렇게' 바꿔쓰기 표(1-3 "금지 표현은 금지 → 바꿔쓰기 표로").
 *  - 김팀장 사실 목록(이것만 씀) · 사실 목록에 없는 숫자 찾기 — 2~3부에서 가장 흔한 실수가 '숫자를 지어내거나 뜻을 바꾸는 것' 이었다.
 */
import { customerFacts, isMarketingCustomer } from './persona'

export const LINK = /https?:\/\/|www\.|litt\.ly|\b[\w-]+\.(?:com|kr|net|io|co)\b/i
export const HYPE = /100\s*%|무조건|보장|누구나\s*(?:받|가능|됩)|공짜|선착순|마감\s*임박|대박|충격|꿀팁|확실히\s*(?:받|승인|통과)|반드시\s*(?:받|승인|통과)/
/** '그건 따로예요' 처럼 바로 바로잡는 글(대화형)은 괜찮다 */
export const AX_DENIED = /따로예요|따로야|수단이\s*아니|별개|별도\s*(?:기관|심사)/
export const AX_AS_MONEY = /(?:AX|MVP|자동화|화면)[^\n]{0,24}(?:정책\s*자금|지원금|보증|자금)[^\n]{0,12}(?:수단|받는\s*(?:법|방법)|나와요|나온다|받을\s*수\s*있)/
export const EMOJI = /\p{Extended_Pictographic}/u

/** 자금 · 심사와 AX 를 같이 말할 때 꼭 넣는 괄호(1-1) */
export const CONDITION_NOTE = '(기본 컨디션이 가장 중요하며, 그 부분까지 함께 점검·설계합니다 / 결과는 기관 심사로 정해집니다)'
/** 벤처확인 보장 대신 쓰는 문장(1-1 · 대표 확인) */
export const VENTURE_PROMISE = '확인받으실 때까지 재신청 · 이의신청을 추가 비용 없이 함께합니다(심사 수수료 별도, 결과는 확인기관이 정합니다)'

/** 이렇게 말고 → 이렇게(대표 운영 원칙 · 사실 목록 · 넣지 말 것에서) */
export const REWRITES: ReadonlyArray<{ no: string; yes: string }> = [
  { no: 'AX 는 큰 가점 요소예요', yes: 'AX 는 비슷한 회사들 사이에서 눈에 띄게 해 주는 좋은 자료예요' },
  { no: 'AX 하면 정책자금 받을 수 있어요', yes: 'AX 는 일하는 방식을 바꾸는 일이에요. 자금은 별개의 기관 심사예요' },
  { no: '꼭 성공시켜 드립니다', yes: VENTURE_PROMISE },
  { no: '자금 · 심사 이야기에 AX 만', yes: `기본 컨디션(신용 · 재무 · 체납) → AX → 사업 성장 로드맵 순서로 + ${CONDITION_NOTE}` },
  { no: '100% 승인 · 누구나 받는 · 공짜', yes: '(빼기) — "요건 충족 시 · 결과는 기관이 정합니다"' },
  { no: '선착순 N명 · 마감 임박(지어낸 것)', yes: '(빼기) — 실제 수량 · 날짜가 있을 때만' },
  { no: '많은 대표님들이 그러세요(확인 안 된 일반화)', yes: '[실제로 들은 말] 처럼 대괄호로 두고 확인한 뒤 채우기' },
  { no: '본문 · 영상에 "상담 신청은 프로필 링크"', yes: '본인 댓글 · 설명란 · 고정 댓글에 한 줄' },
  { no: '오늘 바로 종이에 적어 보세요(숙제)', yes: '(빼기) — 끝은 짧은 CTA 한 문장 · 다음 편 한 줄' },
  { no: 'N배 빨라진다 · N분 컷 · 퇴근이 빨라진다', yes: '실제로 걸린 시간 · 바뀐 것 하나(사실만)' },
  { no: '후기 N개 → "N명이 선택한"', yes: '받은 숫자의 뜻 그대로(후기 수는 후기 수 · 가격은 단위까지)' },
]

/**
 * 김팀장 사실 목록(이것만 씀) — 서버 기준 묶음(mk_facts)과 같은 줄. 화면에 보여 주고, 숫자 대조의 기준으로 쓴다.
 * 시험(test:threads)이 서버 쪽 사실 목록과 숫자가 어긋나지 않는지 본다.
 */
export const KIM_FACTS: readonly string[] = [
  '김팀장(김상호), 미래AI랩 대표 · 중소기업 경영컨설팅 9년',
  '자금 · 지원금 100억+ · 사례 250건 · 특허 5건',
  '하는 일: 맞춤형 AX 구축 · 기술사업화 · MVP · 벤처기업확인 · 정책자금 · 인증 컨설팅 · 컨설턴트 협업(컨설턴트용 운영 OS 11월 오픈 예정)',
  '2주 안에 아이디어 → 작동하는 웹앱(MVP) → 벤처기업확인 신청 준비',
  '3분 AX Fit 진단(로그인 없이, 결과 먼저)',
  '의료폐기물 수집 · 운반 고객: 연구개발전담부서 → 특허 출원 → AX MVP + 홈페이지 → 벤처기업확인(심사 수수료 입금 후 약 한 달, 이의신청 없이 확인) → 이후 IR 발표 요청받음(결과는 아직 모름)',
  '벤처기업확인 세금(대표 계산): 창업 3년 안에 확인받으면 요건 충족 시 법인세 · 소득세 5년간 50% 감면 · 한 해 이익 1억 · 5년 동일 단순 계산 시 법인 약 1,650만 원, 개인사업자 약 4,890만 원',
  '배포 자료: 벤처기업확인 셀프 체크리스트(4칸: 업종 · 기본 조건 / 유형 / 기술 근거 / 조직 · 준비 · DM용 카드 6장)',
]

/** SAAS-2 사실 목록 — 대표 계정은 김팀장 사실 목록 · 고객은 설정 › 내 브랜드 '확인된 사실' 칸(비었으면 빈 목록) */
export function ourFactsList(): readonly string[] {
  return isMarketingCustomer() ? customerFacts() : KIM_FACTS
}

/** D-274 나눠 줄 자료 — 대표가 만들어 둔 벤처기업확인 셀프 체크리스트 카드 6장(1080×1350 · 보충본 부록 A) */
export const VENTURE_CARDS = {
  title: '벤처기업확인 셀프 체크리스트 카드 6장',
  how: '댓글에 키워드(예: "점검표") 남긴 분께 DM 으로 직접 보내요 — 자동 발송은 쓰지 않아요',
  cards: [
    { file: '/sns/venture-check-01.png', label: '표지' },
    { file: '/sns/venture-check-02.png', label: '업종 · 기본 조건' },
    { file: '/sns/venture-check-03.png', label: '유형 고르기' },
    { file: '/sns/venture-check-04.png', label: '기술 근거' },
    { file: '/sns/venture-check-05.png', label: '조직 · 준비' },
    { file: '/sns/venture-check-06.png', label: '결과 읽는 법' },
  ],
} as const

export type LintLevel = 'ok' | 'warn' | 'bad'
export interface RuleLine {
  key: string
  level: LintLevel
  text: string
}

/** 1부 운영 원칙 — 가점 · 성공 약속 · 자금과 AX 를 같이 말할 때 괄호 */
export function principleLint(text: string): RuleLine[] {
  const out: RuleLine[] = []
  if (/큰\s*가점|가점\s*요소|가점을\s*(?:받|챙|주)|가산점/.test(text)) out.push({ key: 'gajeom', level: 'bad', text: '"가점" 대신 — "비슷한 회사들 사이에서 눈에 띄게 해 주는 좋은 자료"' })
  if (/꼭\s*성공시켜|반드시\s*성공|성공시켜\s*드(?:립|려)|성공\s*보장/.test(text)) out.push({ key: 'promise', level: 'bad', text: `성공 약속 대신 — "${VENTURE_PROMISE}"` })
  const money = /정책\s*자금|자금|보증|심사|지원금/.test(text)
  const ax = /AX|MVP|업무\s*자동화|작동하는\s*화면/.test(text)
  if (money && ax && !/기본\s*컨디션/.test(text) && !AX_DENIED.test(text)) out.push({ key: 'condition', level: 'warn', text: `자금 · 심사와 AX 를 같이 말할 땐 괄호를 넣어요 — "${CONDITION_NOTE}"` })
  return out
}

/* ------------------------------------------------------------------ */
/* 숫자 대조                                                            */
/* ------------------------------------------------------------------ */

/** 사실 숫자(돈 · 사람 · 비율 · 기간 · 횟수) — '2가지 · 3단계 · 1번' 같은 구조 숫자는 보지 않는다(규칙집 1-5) */
const FACT_NUM = /(\d[\d,]*(?:\.\d+)?)\s*(%|퍼센트|억|천만|만\s*원|만|원|명|건|개사|곳|배|년|개월|주|일|시간|분)(?![가-힣]*가지)/g
const norm = (s: string) => s.replace(/[\s,]/g, '')

/** 글 속 사실 숫자 가운데 사실 목록 · 더 쓸 사실에 없는 것(겹치면 하나) */
export function unknownNumbers(text: string, facts: string): string[] {
  const known = norm([...ourFactsList(), facts].join('\n'))
  const out: string[] = []
  for (const m of text.matchAll(FACT_NUM)) {
    const n = m[1]
    const unit = m[2]
    // 고르기 쉬운 질문의 보기('1년 / 2년 / 3년')는 사실이 아니다
    const at = m.index ?? 0
    if (/\/\s*$/.test(text.slice(Math.max(0, at - 3), at)) || /^\s*\//.test(text.slice(at + m[0].length, at + m[0].length + 3))) continue
    if (unit === '년' && /^(19|20)\d\d$/.test(n.replace(/,/g, ''))) continue // 연도
    const tok = norm(`${n}${unit}`)
    if (known.includes(tok)) continue
    const shown = `${n}${unit.replace(/\s/g, ' ')}`
    if (!out.includes(shown)) out.push(shown)
  }
  return out
}

export function numberLint(text: string, facts: string): RuleLine[] {
  const unk = unknownNumbers(text, facts)
  if (!unk.length) return []
  return [{ key: 'numbers', level: 'warn', text: `사실 목록에 없는 숫자: ${unk.slice(0, 4).join(' · ')}${unk.length > 4 ? ` 외 ${unk.length - 4}` : ''} — 맞으면 [이번에 더 쓸 사실] 에 적고, 모르면 [대괄호] 로(지어낸 숫자 · 뜻이 바뀐 숫자가 가장 흔한 실수)` }]
}
