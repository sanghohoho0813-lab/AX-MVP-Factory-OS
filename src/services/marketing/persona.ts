/**
 * SAAS-2 마케팅 · 브랜딩의 '누구 이름으로 쓰나' — 대표 계정은 지금 그대로(미래AI랩 · 김팀장의 경영노트 · 대표 사실 목록),
 * 대표가 아닌 계정(구독 고객 · 팀장)은 그 사람이 설정 › 내 브랜드에 적은 것만.
 *
 *  - 화면 자료(AI 로 가는 [자료] · 규칙 초안 · 기본 채널 기준)와 화면 글(관점 · 추천 이름)이 이 파일 하나를 본다.
 *  - 고객 쪽에서는 대표 이름 · 회사 · 경력 숫자 · 대표 고객 사례를 하나도 쓰지 않는다 — 비어 있으면 [대괄호] 로 비우게 한다
 *    (이름만 바꾸면 대표 경력이 고객 경력처럼 된다).
 *  - 서버(api/_ai/customerMarketing.js)도 한 번 더 거른다 — 옛 화면이 대표 기본값을 보내도 그 줄을 빼고 AI 에 보낸다.
 * AppShell 이 로그인 등급을 보고 setMarketingCustomer 를 정한다(팀장 등급 = 고객 쪽).
 */
import { brandForRequest, type BrandProfile } from '../brandProfile'
import type { ChannelBrief } from './radarStore'

let customer = false

export function setMarketingCustomer(on: boolean) {
  customer = on
}

/** 지금 계정이 고객 쪽인가(대표 계정이면 false) */
export function isMarketingCustomer(): boolean {
  return customer
}

const brandNow = (): BrandProfile | null => (customer ? brandForRequest() : null)

/** 회사 · 채널 이름 — 대표: 미래AI랩 · 고객: 회사 → 이름 → '우리 회사' */
export function ourName(): string {
  if (!customer) return '미래AI랩'
  const b = brandNow()
  return b?.company || b?.name || '우리 회사'
}

/** 화자 이름 — 대표: 김팀장 · 고객: 적은 이름(없으면 빈 글) */
export function speakerName(): string {
  if (!customer) return '김팀장'
  return brandNow()?.name || ''
}

/** 고객 브랜드에서 AI 에 줄 '나는 누구인가' 줄 — 적은 칸만(경력 · 숫자는 '확인된 사실' 칸 그대로) */
export function customerProfileLines(): string[] {
  const b = brandNow()
  const who = b?.company || b?.name || ''
  const lines = [
    who ? `${who}: ${[b?.industry, b?.specialties && `전문 ${b.specialties}`].filter(Boolean).join(' · ') || '컨설팅'}` : '',
    b?.audience ? `시청자 · 고객 = ${b.audience}` : '',
    b?.tone ? `말투: ${b.tone}` : '',
    b?.intro ? `하는 일 · 강점: ${b.intro}` : '',
    b?.facts ? `확인된 사실(이것만 사실로): ${b.facts}` : '',
  ].filter(Boolean)
  return lines.length ? lines : ['채널 주인의 브랜드 설정이 비어 있다 — 이름 · 경력 · 사례 수 · 숫자는 쓰지 말고 [대괄호] 로 비워 둔다(설정 › 내 브랜드에서 채움).']
}

/** 고객 '확인된 사실' 칸 → 줄 목록(· ; 줄바꿈으로 나눔) */
export function customerFacts(): string[] {
  const f = brandNow()?.facts ?? ''
  return f
    .split(/\s*(?:[·;\n]|\s\/\s)\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** 고객 기본 채널 기준 — 설정 › 내 브랜드에서(비었으면 일반 컨설턴트 채널) */
export function customerBrief(): ChannelBrief {
  const b = brandNow()
  const who = b?.company || b?.name || ''
  const field = b?.industry || '중소기업 대표를 돕는 컨설팅'
  return {
    channel: who ? `${who} 채널 — ${field} 이야기` : `내 채널 — ${field} 이야기`,
    host: b?.name ? `${b.name}${b.company ? `(${b.company})` : ''} — ${b.industry || '컨설턴트'}` : '채널 주인(컨설턴트) — 이름 · 경력은 설정 › 내 브랜드에 적은 것만',
    audience: b?.audience || '중소기업 · 소상공인 대표와 실무자',
    covers: b?.specialties || b?.industry || '정책자금 · 지원금 · 절세 같은 중소기업 대표의 돈 문제',
    avoid: [b?.avoid, '근거 없는 금액 약속 · "N배 빨라진다 · 꿀팁 · 충격" 같은 상투어 · 남의 영상 제목 · 대사 베끼기'].filter(Boolean).join(' · '),
    tone: b?.tone || '쉬운 말, 과장 없이, 실제 상담에서 본 장면과 숫자로',
    format: '롱폼 10~15분(0~15초 증거 장면 → 결론 먼저 → 번호형 챕터) + 쇼츠 · 릴스 · 스레드로 나눠 쓰기',
    ending: b?.ending || '궁금한 점은 댓글로 남겨 주세요.',
  }
}

/**
 * 화면 글(이름표 · 안내 · 추천 이유)의 대표 이름 → 고객 쪽 말. 대표 계정은 그대로.
 * 사실 · 경력 문장에는 쓰지 않는다(그런 줄은 고객 쪽에서 아예 빼거나 고객 설정으로 바꾼다).
 */
export function mkText(s: string): string
export function mkText(s: string | undefined): string | undefined
export function mkText(s: string | undefined): string | undefined {
  if (!customer || !s) return s
  const name = ourName()
  return s
    .replace(/김팀장의\s*경영\s*노트/g, '내 채널')
    .replace(/MIRAE\s*AI\s*LAB\s*의|MIRAE\s*의|MIRAE\s*가|미래AI랩이/g, (m) => (/의$/.test(m) ? '우리의' : '내가'))
    .replace(/MIRAE\s*AI\s*LAB|MIRAE|미래AI랩/g, name === '우리 회사' ? '우리' : name)
    .replace(/김팀장/g, speakerName() || '[이름]')
    // 카드뉴스는 1차 상품에서 고객에게 보이지 않는다 — 안내 글의 '· 카드뉴스' 도 뺀다
    .replace(/\s*·\s*카드뉴스/g, '')
    .replace(/카드뉴스\s*·\s*/g, '')
}

/** 시험용 */
export function __setMarketingCustomerForTest(on: boolean) {
  customer = on
}
