/**
 * D-234 규제 업종 — 콘텐츠 작성 규칙집 5장(⟲4차: 참고한 외부 방법 4차 실험 · 규제 업종 4곳 17회).
 *
 * 업종 칸(견본 11가지)만으로는 나뉘지 않는 네 업종 — 건강기능식품 · 보험 · 부동산 중개 · 법률 — 을
 * 대표 상품 · 하는 일 · 업체 이름 글로 알아보고, 의료 · 교육은 업종 칸 그대로 쓴다.
 * 업종마다: 넣지 말 것(요청문) · 꼭 넣을 안내 문구(우리 글 · 요청문) · 받은 글 점검 정규식 · 카드뉴스 5안 중 남길 안.
 *
 * 4차에서 본 것: 금지 목록을 넣으면 금지 '단어' 는 사라지지만 카드뉴스 틀(전후 변화 · 문제 해결 · 권위)이 사례 · 금액 · 손실 압박 ·
 * 실적을 다시 만들었다 — 그래서 규제 업종 카드뉴스는 ①반박 없애기 · ④궁금증 두 안만 만든다.
 * 금지한 판촉은 다른 이름으로 돌아온다(할인 → 1+1, 대출 알선 → '대출 · 세금 원스톱') — 그 다른 이름까지 점검한다.
 *
 * 이 목록은 실험에서 실제로 본 위험을 모은 최소 목록이다 — 업종 법규 검토를 대신하지 않는다.
 */
import type { ContentProfile } from './profile'

export type RegulatedKind = 'medical' | 'hfood' | 'insurance' | 'realty' | 'law' | 'education'

/** 카드뉴스 5안 이름(generate.ts AdType 중 5안에 쓰는 것) — 순환 import 를 피하려고 글자로 둔다 */
export type CardFiveType = 'objection' | 'problem' | 'before' | 'curious' | 'proof'

export interface RegulatedRule {
  kind: RegulatedKind
  label: string
  /** 요청문 '넣지 말 것' 에 그대로 붙이는 금지 표현 */
  never: string[]
  /** 꼭 넣을 안내 문구 — 우리 글(블로그 · 영상 · 카드 · 릴스 끝)과 요청문에. 없으면 '' */
  notice: string
  /** 받은 글에 안내 문구가 들어갔는지 보는 말 */
  noticeRe: RegExp | null
  /** 받은 글 점검 — 이 업종에서 쓰면 안 되는 표현 */
  risky: { re: RegExp; word: string; why: string }[]
  /** 카드뉴스 5안 중 만들 안 */
  cardsKeep: CardFiveType[]
}

const KEEP_SAFE: CardFiveType[] = ['objection', 'curious']

/** 의료 — 개인차 · 부작용 안내(규칙집 5장 규제 업종: 꼭 넣을 것) */
export const CARE_NOTE = '개인에 따라 결과가 다를 수 있고 부작용이 생길 수 있어요. 자세한 주의 사항은 상담 때 꼭 안내받으세요.'

const RULES: Record<RegulatedKind, Omit<RegulatedRule, 'kind' | 'notice'> & { notice: (p: Pick<ContentProfile, 'company' | 'address' | 'region'>) => string }> = {
  medical: {
    label: '의료',
    never: ['가격 표시 · 가격 비교', '할인 · 선착순 할인', '순위([지역] 1위)', '후기 · 후기 수', '전후 비교(사진 · 카드)', '효과 보장', '압박하는 말(지금 안 하면 후회)', '주차 무료 같은 편의 혜택을 미끼로 앞세우기'],
    notice: () => CARE_NOTE,
    noticeRe: /개인차|개인에\s*따라/,
    risky: [
      { re: /전후\s*(?:사진|비교)|비포\s*애프터/, word: '전후 비교', why: '의료 광고에서 전후 비교는 쓰지 않아요' },
      { re: /평균\s*[\d,]+\s*만?\s*원|[\d,]+\s*만?\s*원\s*(?:부터|만에)/, word: '가격 표시', why: '의료 광고에서 가격 · 가격 비교는 쓰지 않아요' },
    ],
    cardsKeep: KEEP_SAFE,
  },
  hfood: {
    label: '건강기능식품',
    never: ['질병의 예방 · 치료 · 완화 표현(변비 해결 · 장염 · 면역 질환)', '의약품처럼 보이는 표현', '부작용 없음 · 100% 효과', '체험기 · 후기', "전문가 추천 · '직접 개발'", '주지 않은 특허 · 인증 · 기관 인정', '1위 · 최고', "다른 제품 비방('일반 유산균은~')", '할인과 그 대체(1+1)', "'[N주] 만에 달라졌어요' 같은 전후 이야기"],
    notice: () => '이 제품은 질병의 예방 및 치료를 위한 의약품이 아닙니다. 개인에 따라 차이가 있을 수 있으니, 질환이 있으면 전문가와 상담하세요.',
    noticeRe: /의약품이\s*아닙니다/,
    risky: [
      { re: /예방|치료|완화|변비\s*(?:해결|개선|탈출)|장염|면역\s*(?:력\s*)?(?:강화|증진|질환)/, word: '질병 예방 · 치료', why: '건강기능식품은 질병의 예방 · 치료 효과를 말할 수 없어요' },
      { re: /특허|식약처\s*(?:인정|인증)/, word: '특허 · 식약처 인정', why: '받은 특허 · 인정이 사실 목록에 있을 때만 써요' },
      { re: /만에\s*(?:달라|바뀌|효과)/, word: '전후 체험', why: "'○주 만에 달라졌어요' 같은 체험 · 전후 이야기는 쓰지 않아요" },
      { re: /전문가\s*(?:추천|가\s*추천)|직접\s*개발/, word: '전문가 추천', why: '전문가 추천 · 개발 표현은 쓰지 않아요' },
    ],
    cardsKeep: KEEP_SAFE,
  },
  insurance: {
    label: '보험',
    never: ['무조건 · 100% 보장', '최저 보험료 · 업계 1위', '다른 보험사 · 상품 비교 · 비방', '원금 · 수익 보장', "가입 · 전환 압박('그대로 두면 손해' · '지금 가입 안 하면')", '해지 · 갈아타기 권유', '지어낸 보험금 · 보장 사례와 금액', '지어낸 상담 건수 · 평점', '확인 안 된 제도 변경 이야기', '무료 선물'],
    notice: () => '보험 계약 전 상품설명서와 약관을 꼭 확인하세요. 기존 계약을 해지하고 새 계약을 하면 불이익이 생길 수 있습니다.',
    noticeRe: /약관/,
    risky: [
      { re: /그대로\s*두면\s*손해|지금\s*가입\s*(?:안|하지\s*않)|가입\s*안\s*하면/, word: '가입 압박', why: '보험 광고에서 가입 · 전환을 압박하는 말은 쓰지 않아요' },
      { re: /갈아타|해지하고|해지\s*후\s*(?:새|재)\s*가입/, word: '갈아타기', why: '해지 · 갈아타기 권유는 쓰지 않아요' },
      { re: /최저\s*보험료|원금\s*보장|수익\s*보장/, word: '최저 · 원금 보장', why: '최저 보험료 · 원금 · 수익 보장 표현은 쓰지 않아요' },
      { re: /보장\s*(?:이\s*)?[\d두세]\s*배|상담\s*[\d,]+\s*건/, word: '보장 배수 · 상담 건수', why: '지어낸 보장 사례 · 상담 건수는 쓰지 않아요' },
      { re: /무료\s*선물|사은품/, word: '무료 선물', why: '보험 가입 선물은 쓰지 않아요' },
    ],
    cardsKeep: KEEP_SAFE,
  },
  realty: {
    label: '부동산 중개',
    never: ['확정 수익 · 시세 차익 · 프리미엄 보장', "급매 · 마지막 기회 · '먼저 연락한 분만'", '지어낸 시세 · 거래가 · 매물 · 단지 정보', '지어낸 거래 사례(가린 이름 포함)', '지어낸 거래 건수 · 평점', "지역 1위 · '가장 많이 찾는'", '집값 예측', '중개수수료 할인', "대출 알선과 그 다른 이름('대출 · 세금 원스톱')"],
    notice: (p) => `중개사무소 정보: ${p.company} / 소재지 ${p.address || p.region || '[소재지]'} / 등록번호 [중개사무소 등록번호] / 대표자 [대표자 이름]`,
    noticeRe: /등록번호/,
    risky: [
      { re: /확정\s*수익|시세\s*차익|프리미엄\s*(?:보장|확정)/, word: '확정 수익', why: '확정 수익 · 시세 차익 · 프리미엄 보장은 쓰지 않아요' },
      { re: /급매|마지막\s*기회|먼저\s*(?:연락|전화)\s*(?:한|주신|하신)\s*분/, word: '급매 · 마지막 기회', why: '급하게 만드는 말은 쓰지 않아요' },
      { re: /수수료\s*(?:\d+\s*%\s*)?할인/, word: '수수료 할인', why: '중개수수료 할인은 쓰지 않아요' },
      { re: /대출\s*(?:알선|연결)|원스톱/, word: '대출 알선 · 원스톱', why: "대출 알선(그 다른 이름 '대출 · 세금 원스톱' 포함)은 쓰지 않아요" },
      { re: /가장\s*많이\s*찾는/, word: '가장 많이 찾는', why: '최상급 표현은 쓰지 않아요' },
    ],
    cardsKeep: KEEP_SAFE,
  },
  law: {
    label: '법률(변호사)',
    never: ['승소율 · 승소 건수 · 상담 건수', "결과 보장('반드시 받아낸다')", "최고 · 1위 · 유일 · '전문 변호사' 표시", '수임료 할인 · 무료 상담 미끼', "지어낸 사건 사례 · 의뢰인 후기 · 판결 금액 · 합의금 숫자('[A]원 → [B]원')", '다른 변호사 비교', '상대방(보험사) 비방'],
    notice: () => '개별 사건의 결과는 사실관계에 따라 달라질 수 있습니다.',
    noticeRe: /사실관계에\s*따라/,
    risky: [
      { re: /승소율|승소\s*[\d,]+\s*건|상담\s*[\d,]+\s*건/, word: '승소율 · 건수', why: '승소율 · 승소 건수 · 상담 건수는 쓰지 않아요' },
      { re: /반드시\s*받아|결과\s*보장/, word: '결과 보장', why: '사건 결과를 장담하는 말은 쓰지 않아요' },
      { re: /전문\s*변호사/, word: '전문 변호사', why: "'전문 변호사' 표시는 쓰지 않아요" },
      { re: /무료\s*상담|수임료\s*할인/, word: '무료 상담 · 수임료 할인', why: '수임료 할인 · 무료 상담 미끼는 쓰지 않아요' },
      { re: /(?:합의금|보상금|배상금)[^\n.]{0,12}[\d,]+\s*만?\s*원|[\d,]+\s*만?\s*원\s*[→➜>]\s*[\d,]+\s*만?\s*원/, word: '금액 사례', why: '지어낸 합의금 · 판결 금액 사례는 쓰지 않아요' },
    ],
    cardsKeep: KEEP_SAFE,
  },
  education: {
    label: '교육',
    never: ["압박형('지금 안 하면 [다음 학년]에서 후회')", '지어낸 성적 향상 폭 · 순위 · 실적'],
    notice: () => '',
    noticeRe: null,
    risky: [{ re: /성적\s*(?:이\s*)?[\d,]+\s*점\s*(?:올|상승|향상)|합격률\s*\d/, word: '성적 향상 · 합격률', why: '지어낸 성적 향상 폭 · 합격률은 쓰지 않아요' }],
    // 교육은 ③전후 변화(성적 향상) · ⑤권위(실적 · 순위)를 뺀다
    cardsKeep: ['objection', 'problem', 'curious'],
  },
}

/**
 * 업종 칸으로 안 나뉘는 업종 — 상품 · 하는 일 · 업체 이름에 이 말이 있으면.
 * 넓게 잡으면 엉뚱한 업체가 걸린다(세무사의 '부동산 양도세' · 병원의 '실손 청구' · 식당의 '홍삼 삼계탕') —
 * 그래서 중개 · 설계 · 건강기능식품처럼 하는 일을 말하는 낱말만 보고, 의료(업종 칸 health)는 의료 규칙이 먼저다.
 */
const DETECT: { kind: Exclude<RegulatedKind, 'medical' | 'education'>; re: RegExp; company?: RegExp; not?: RegExp; skip?: ContentProfile['industry'][] }[] = [
  { kind: 'law', re: /변호사|법률\s*사무소|법무\s*법인/ },
  { kind: 'realty', re: /공인\s*중개|중개\s*사무소|중개사|부동산\s*중개/, company: /부동산\s*$|부동산\s*(?:중개|사무소)/ },
  { kind: 'insurance', re: /보험\s*(?:설계|대리점|상담|가입|리모델링|비교|보장\s*분석)|손해\s*보험|생명\s*보험|암\s*보험/, not: /4대\s*보험/, skip: ['health'] },
  { kind: 'hfood', re: /건강\s*기능\s*식품|건기식/ },
  { kind: 'hfood', re: /유산균|프로바이오틱스|영양제|비타민|오메가\s*3|홍삼|콜라겐|루테인|밀크\s*씨슬/, skip: ['health', 'food'] },
]

/** 이 업체가 규제 업종이면 그 규칙(아니면 null) */
export function regulatedOf(p: Pick<ContentProfile, 'industry' | 'item' | 'services' | 'company' | 'address' | 'region'>): RegulatedRule | null {
  const text = [p.item, ...p.services, p.company].join(' ')
  const hit = DETECT.find((d) => !(d.skip ?? []).includes(p.industry) && (d.re.test(text) || !!d.company?.test(p.company.trim())) && !d.not?.test(text))
  const kind: RegulatedKind | null = hit ? hit.kind : p.industry === 'health' ? 'medical' : p.industry === 'education' ? 'education' : null
  if (!kind) return null
  const r = RULES[kind]
  return { kind, label: r.label, never: r.never, notice: r.notice(p), noticeRe: r.noticeRe, risky: r.risky, cardsKeep: r.cardsKeep }
}

/** 혜택 · 판촉을 글에 싣지 않는 업종(할인 · 무료 선물 · 수수료 할인 · 수임료 할인이 다 금지) */
export function noPromo(rule: RegulatedRule | null): boolean {
  return !!rule && (rule.kind === 'medical' || rule.kind === 'hfood' || rule.kind === 'insurance' || rule.kind === 'realty' || rule.kind === 'law')
}

/** 고객 후기 · 체험 문장과 후기 수를 싣지 않는 업종(의료 후기 · 건강기능식품 체험기 · 의뢰인 후기) */
export function noTestimonial(rule: RegulatedRule | null): boolean {
  return !!rule && (rule.kind === 'medical' || rule.kind === 'hfood' || rule.kind === 'law')
}

/** 가격을 글에 싣지 않는 업종(의료 — 가격 표시 · 가격 비교 금지) */
export function noPrice(rule: RegulatedRule | null): boolean {
  return !!rule && rule.kind === 'medical'
}
