/**
 * D-228 다른 AI 도구에 붙여 넣을 요청문 — 우리는 부르지 않는다(LLM 호출 0). 대표가 바깥 도구를 쓸 때 복사해 가는 글이다.
 *
 * 이상한AI 3차 관찰(대표 실험 111회)에서:
 *  - 추가 요청 칸에 업체 · 독자 · 알리는 것 · 화자 · 사실 목록 · 넣지 말 것을 적으면 계정 업종(우리는 컨설팅)이 글에 끼어드는 일이 0 이 됐다.
 *  - 다만 '넣지 말 것' 은 다음 단계(주제 → 본문, 기획 → 대본)로 넘어가지 않는다 — 단계마다 다시 붙여야 한다.
 *  - 사실(재료)을 목록으로 주고 "이 외에는 금지" 라고 하면 지어낸 숫자 · 후기 · 혜택이 거의 사라졌다.
 * 그래서 홍보 정보로 6줄을 만들어 준다. 비어 있는 사실은 적지 않는다(지어낸 값을 넣지 않게).
 * D-229 콘텐츠 작성 규칙집(1~3차 합본) — 브리프 보조 칸(채널 · 길이 · 지역 방침 · 걱정 · 흔한 반박)과 업종별 마지막 제안,
 *        업체가 막은 말을 함께 적는다. 길이는 숫자로(규칙집 0-9: 길이 선택만으로는 넘친 적이 있다).
 * D-234 규칙집 ⟲4차(이상한AI 4차 실험 — 규칙집을 그대로 넣어 본 검증):
 *  - 7칸(+ 구매·문의처) — 구매처가 비면 계정 기본 업체의 판매 플랫폼 이름이 들어왔다(꽃집 카드 5/5). 후기에는 출처까지.
 *  - 이름표 줄 그대로 — '화자는 ~입니다' 처럼 문장으로 쓰면 블로그 작성자 소개 표가 계정 업체 정보로 채워졌다(2/2), 이름표 줄은 4/4 바뀌었다.
 *  - 받은 숫자의 뜻을 바꾸지 말라고 적는다(후기 N개 → 'N명이 선택' 이 10/12) · 가격은 단위 그대로.
 *  - 규제 업종 4곳(건강기능식품 · 보험 · 부동산 중개 · 법률) 금지 목록 + 필수 안내 문구 + 카드뉴스는 두 안만.
 */
import { industryDef } from '../siteBuilder/industry'
import type { ContentProfile } from './profile'
import { contentLib } from './library'
import { cardFiveTypes, isB2B, noOfferAd, noPriceAd, noReviewAd, noVoiceAd, offerLine, withoutArea, AD_TYPE_LABEL, type BlogType, type ContentKind, type ShortLen } from './generate'
import { contactOf } from './profile'
import { regulatedOf } from './regulated'

/** 계정 업종이 끼어들던 것 + 우리 규칙(지어낸 출처 · 깎아내리기) */
const NEVER = [
  '사업 자금 · 정책자금 · 지원금 · 컨설팅 이야기',
  '창업 · 회사 운영 이야기',
  '다른 업체 · 전자책 · 강의 소개',
  '기관 · 전문가 출처를 지어낸 문장',
  '다른 업체 · 다른 상품을 깎아내리는 말',
]

/** 업종마다 광고 규정 — 의료는 예약 · 상담만. D-234 규제 업종은 규칙집 5장 표(금지 · 꼭 넣을 문구 · 카드뉴스 두 안) */
function ruleLines(p: ContentProfile, kind?: ContentKind): string[] {
  const rule = regulatedOf(p)
  if (rule && rule.kind !== 'medical' && rule.kind !== 'education') {
    const keep = cardFiveTypes(p).map((a) => AD_TYPE_LABEL[a].replace(/형$/, ''))
    return [
      `${rule.label} 광고 규정 — 넣지 말 것: ${rule.never.join(', ')}.`,
      ...(rule.notice ? [`꼭 넣을 안내 문구(글 끝에 그대로): "${rule.notice}"`] : []),
      ...(!kind || kind === 'cards' ? [`카드뉴스는 ${keep.join(' · ')} 안만 만드세요(전후 변화 · 문제 해결 · 권위 안은 쓰지 않기).`] : []),
      '금지한 것을 다른 이름으로 바꿔 넣지 마세요(할인 → 1+1, 대출 알선 → 원스톱 안내, 상담 건수 → 경력 · 인원).',
    ]
  }
  if (p.industry === 'health') return [`의료광고 규정: 가격 · 할인 · 비교 · 순위 · 전후 사진 · 후기 · 효과 보장은 쓰지 마세요. 끝맺음은 예약 · 상담만. 꼭 넣을 안내 문구: "${rule?.notice ?? ''}"`]
  if (p.industry === 'professional') return ['전문직 광고 규정: 승소율 · 성공률 장담, 의뢰인 후기, 다른 사무소 비교는 쓰지 마세요.']
  if (p.industry === 'education') return ["교육 광고: 합격률 · 성적 향상 장담, 압박하는 말('지금 안 하면 후회')은 쓰지 마세요."]
  if (p.industry === 'food') return ['식품 광고: 건강 · 치료 효과(면역력 · 다이어트에 좋은)는 쓰지 마세요.']
  return []
}

/** 직함 낱말 — '대표 김한솔' · '김한솔 대표' 둘 다 읽는다 */
const TITLE_WORD = /^(?:대표|원장|실장|팀장|이사|사장|소장|관장|점장|매니저|디자이너|선생님|강사|MD|변호사|세무사|노무사|약사|부장|과장|차장|주임|셰프|플로리스트|중개사|공인중개사|설계사|코치|에디터)(?:님)?$/

/** D-234 이름표 줄의 화자 — `화자: [업체명]의 [직함] '[이름]'` (규칙집 0장 필수 7칸) */
export function speakerLine(p: ContentProfile): string {
  const sp = p.speaker.trim()
  if (!sp) return `화자: ${p.company} (사람 이름은 쓰지 마세요).`
  const t = sp.split(/\s+/)
  if (t.length === 1) return TITLE_WORD.test(sp) ? `화자: ${p.company}의 ${sp} (사람 이름은 쓰지 마세요).` : `화자: ${p.company}의 '${sp}' (이름은 이것만 쓰세요).`
  const nameFirst = TITLE_WORD.test(t[t.length - 1]) && !TITLE_WORD.test(t[0])
  const title = nameFirst ? t[t.length - 1] : t.slice(0, -1).join(' ')
  const name = nameFirst ? t.slice(0, -1).join(' ') : t[t.length - 1]
  return `화자: ${p.company}의 ${title} '${name}' (이름은 이것만 쓰세요).`
}

/** D-234 구매·문의처 줄 — 비면 판매처 · 플랫폼 이름을 넣지 말라고 적는다(빈칸을 계정 업체 플랫폼으로 채웠다) */
export function contactLine(p: ContentProfile): string {
  const c = contactOf(p)
  return c.length ? `구매·문의처: ${[p.phone ? `전화 ${p.phone}` : '', p.channel, p.homepage, p.address ? `매장 ${p.address}` : ''].filter(Boolean).join(' / ')}${p.hours ? ` (${p.hours})` : ''}.` : '구매·문의처: (아직 없음 — 판매처 · 플랫폼 이름을 넣지 마세요).'
}

export function aiRequestFacts(p: ContentProfile): string[] {
  return [
    p.years !== null && p.years >= 1 ? `설립 ${p.years}년째${p.since ? `(${p.since}년)` : ''}` : '',
    ...p.strengths.filter((s) => !/^설립 \d+년째$/.test(s)).slice(0, 5),
    p.services.length ? `하는 일: ${p.services.slice(0, 5).join(' · ')}` : '',
    p.differ ? `다른 곳과 다른 점: ${p.differ}` : '',
    // D-234 후기는 출처까지(출처가 없으면 다른 도구가 후기 위치를 지어냈다) · 의료 · 건강기능식품 · 법률은 후기를 싣지 않는다
    p.reviews && !noReviewAd(p) ? `후기·평점: ${p.reviews} / 후기 출처: ${p.reviewSource || '(적지 않음 — 후기를 볼 수 있는 곳을 쓰지 마세요)'}` : '',
    p.voice && !noVoiceAd(p) ? `실제 고객 한마디: "${p.voice}"` : '',
    offerLine(p) && !noOfferAd(p) ? `이번 달 혜택: ${offerLine(p)}` : '',
    p.price && !noPriceAd(p) ? `가격: ${p.price} (단위 그대로 — 1회 가격을 '월' 로 바꾸지 마세요)` : '',
    p.shipping ? `배송 · 교환 조건: ${p.shipping}` : '',
  ].filter(Boolean)
}

export interface AiRequestOpts {
  kind?: ContentKind
  blogType?: BlogType
  shortLen?: ShortLen
  /** 블로그 제목 맨 앞에 둘 검색 키워드 */
  keyword?: string
}

export const AI_CHANNEL_LABEL: Record<ContentKind, string> = {
  blog: '네이버 블로그 글(업체가 직접 쓰는 브랜드형)',
  shorts: '유튜브 쇼츠 · 인스타 릴스 대본',
  video: '유튜브 긴 영상 기획 · 대본',
  cards: '인스타 카드뉴스',
  kakao: '카카오톡 채널 소식',
  place: '네이버 플레이스 소개글',
  keywords: '검색 키워드 목록',
}

/** 규칙집 3장 채널별 틀 — 길이 · 개수는 숫자로 */
function lengthLine(p: ContentProfile, o: AiRequestOpts): string {
  switch (o.kind) {
    case 'blog':
      return o.blogType === 'review'
        ? '1,800자 안팎 · 해요체 · 소제목 2개(써 보기 전 실패 → 써 보고 알게 된 것) · 맨 위에 광고 표시 문구 · 작성자 소개 표는 넣지 않기'
        : '공백 포함 2,100~3,000자 · 제목 25~35자 · 소제목 3개(기준 2개 + 정리) · 사진 자리 4~7곳 · 표는 1개'
    case 'video':
      return `썸네일 문구 20~35자(숫자 넣기) · 제목 ${isB2B(p) ? '괄호 없이 25~35자' : "'본제목 (괄호 꼬리말)' 40~55자"} · 도입부 3~5문장(100~160자) · 소제목 4개(체크포인트 3 + 마무리) · 말 분량 2,200~3,200자(7~11분)`
    case 'shorts':
      return o.shortLen === '30-60'
        ? '60초 이내 · 컷 15개 이하 · 상단 문구 14~22자 · 인사 없이 바로 첫 번째 · 끝은 3줄 요약(업체 말은 한 줄만)'
        : '30초 이내 · 컷 12개 이하 · 상단 문구 14~22자 · 인사 없이 바로 첫 번째 · 캡션 230~300자 · 해시태그 5개'
    case 'cards':
      return '7장 · 장마다 문구 1줄(20~35자) + 이미지 지시 1줄 · 5안을 만들면 순서는 반박 없애기 → 문제 해결 → 전후 변화 → 궁금증 → 권위'
    case 'kakao':
      return '맨 앞에 (광고) · 5~8줄 · 혜택은 실제 기한과 함께'
    case 'place':
      return '한 줄 소개 · 하는 일 · 이용 안내 · 찾아오는 길'
    case 'keywords':
      return '월 검색량 100 이상만'
    default:
      return ''
  }
}

/** 규칙집 1-11 채널별 지역 방침 */
function regionLine(p: ContentProfile, o: AiRequestOpts): string {
  const kw = o.keyword?.trim()
  switch (o.kind) {
    case 'blog':
      return kw ? `검색 키워드 "${kw}" 를 띄어쓰기까지 그대로 제목 맨 앞에(바로 뒤에 쉼표)` : ''
    case 'video':
      return `지역명은 제목 · 썸네일에 넣지 말고 전국 주제로${kw ? `("${withoutArea(p, kw) || p.item}")` : ''} — 지역은 사례로만`
    case 'cards':
      return '지역은 1장이나 위치 장에 한 번만'
    case 'shorts':
      return '지역은 고정 문구나 해시태그(지역 + 업종 + 고민)에만'
    default:
      return ''
  }
}

/**
 * 붙여 넣을 글 — 규칙집 ⟲4차 필수 7칸을 이름표 줄 그대로(업체 / 독자 / 알리는 것 / 화자 / 사실 목록 / 구매·문의처 / 넣지 말 것)
 * + 고른 채널이면 채널 · 길이 · 지역 · 걱정 · 반박 · 마지막 제안 + 업종 규정.
 */
export function aiRequestText(p: ContentProfile, o: AiRequestOpts = {}): string {
  const where = [p.region, industryDef(p.industry).label].filter(Boolean).join(', ')
  const facts = aiRequestFacts(p)
  const len = lengthLine(p, o)
  const region = regionLine(p, o)
  const never = [...NEVER, ...p.avoid.map((w) => `"${w}"`)]
  return [
    `업체: ${p.company}${where ? `(${where})` : ''}.`,
    `독자(보는 사람): ${p.target}.`,
    `알리는 것: ${p.company}의 ${p.item}${p.services.length ? `(${p.services.slice(0, 3).join(' · ')})` : ''}.`,
    speakerLine(p),
    ...(o.kind ? [`채널 · 종류: ${o.kind === 'blog' && o.blogType === 'review' ? '네이버 블로그 체험단 후기' : AI_CHANNEL_LABEL[o.kind]}.`] : []),
    ...(len ? [`길이: ${len}.`] : []),
    ...(region ? [`지역: ${region}.`] : []),
    ...(p.objection ? [`독자의 걱정 1개: "${p.objection}"`] : []),
    ...(p.rebuttal ? [`흔한 반박 1개: "${p.rebuttal}" — 이 생각을 풀어 주며 시작하세요.`] : []),
    `사실 목록 — 이 목록 밖의 숫자 · 혜택 · 후기 · 정책 · 사례는 쓰지 마세요. 받은 숫자의 뜻(후기 수 · 평점 · 가격 단위)을 바꾸지 마세요:\n${facts.length ? facts.map((f) => `- ${f}`).join('\n') : '- (적어 둔 사실이 없어요 — 숫자 · 혜택 · 후기를 넣지 마세요)'}`,
    contactLine(p),
    ...(o.kind && o.kind !== 'keywords' ? [`${contentLib(p.industry).offerRule}.`] : []),
    `넣지 말 것: ${never.join(', ')}.`,
    ...ruleLines(p, o.kind),
  ].join('\n')
}

/** 화면에만 보이는 쓰는 법(복사에는 안 들어감) — D-234 규칙집 ⟲4차 부록 A 를 더했다 */
export const AI_REQUEST_TIPS = [
  '다음 단계로 넘길 때마다(주제 → 본문, 기획 → 대본) 이 요청문을 줄 이름 그대로 다시 붙여 넣으세요 — "넣지 말 것" 은 다음 단계로 넘어가지 않아요.',
  '넘기기 전에 넘어가는 칸의 숫자부터 고치세요 — 앞 단계에서 비틀린 숫자(\'고객 620명\')는 요청문을 다시 붙여도 고쳐지지 않았어요.',
  '한 번 깨끗하게 나왔다고 요청문을 빼지 마세요 — 같은 입력도 다른 업종 이야기가 나왔다 안 나왔다 해요. 릴스 · 영상 기획은 요청문 없이 쓰지 마세요.',
  '계정 업종만 쓰는 기능(영상 광고 · 맞춤 추천)은 다른 업체 글에 쓰지 마세요 — 요청문을 무시하고 계정 업종으로 만들어요.',
  '카드뉴스(광고 기획)에는 수정 요청 단추가 없어요 — 다시 만들거나 사람이 고치고, 기간 한정 문구(\'3월 한정\')는 실제 날짜로 고치세요.',
  '영상 기획 · 대본은 숫자(% · 배수 · 기간)를 가장 많이 지어내요 — 숫자를 두 번 확인하세요.',
  '키워드 검색량 조회는 하루 500번 한도에서 빠져요 — 한 번에 여러 개(최대 50개)를 같이 조회하세요.',
  '받은 글은 아래 [받은 글 점검] 에 붙여 넣어 한 번 더 보세요 — 숫자의 뜻 · 가격 단위 · 판매처 이름이 바뀌거나 주지 않은 혜택 · 후기가 끼어들 수 있어요.',
]
