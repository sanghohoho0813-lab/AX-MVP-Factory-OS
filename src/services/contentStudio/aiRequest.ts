/**
 * D-228 다른 AI 도구에 붙여 넣을 요청문 — 우리는 부르지 않는다(LLM 호출 0). 대표가 바깥 도구를 쓸 때 복사해 가는 글이다.
 *
 * 이상한AI 3차 관찰(대표 실험 111회)에서:
 *  - 추가 요청 칸에 업체 · 독자 · 알리는 것 · 화자 · 사실 목록 · 넣지 말 것을 적으면 계정 업종(우리는 컨설팅)이 글에 끼어드는 일이 0 이 됐다.
 *  - 다만 '넣지 말 것' 은 다음 단계(주제 → 본문, 기획 → 대본)로 넘어가지 않는다 — 단계마다 다시 붙여야 한다.
 *  - 사실(재료)을 목록으로 주고 "이 외에는 금지" 라고 하면 지어낸 숫자 · 후기 · 혜택이 거의 사라졌다.
 * 그래서 홍보 정보로 6줄을 만들어 준다. 비어 있는 사실은 적지 않는다(지어낸 값을 넣지 않게).
 */
import { industryDef } from '../siteBuilder/industry'
import type { ContentProfile } from './profile'
import { offerLine } from './generate'

/** 계정 업종이 끼어들던 것 + 우리 규칙(지어낸 출처 · 깎아내리기) */
const NEVER = [
  '사업 자금 · 정책자금 · 지원금 · 컨설팅 이야기',
  '창업 · 회사 운영 이야기',
  '다른 업체 · 전자책 · 강의 소개',
  '기관 · 전문가 출처를 지어낸 문장',
  '다른 업체 · 다른 상품을 깎아내리는 말',
]

/** 업종마다 광고 규정 — 의료는 예약 · 상담만 */
function ruleLine(p: ContentProfile): string {
  if (p.industry === 'health') return '의료광고 규정: 가격 · 할인 · 비교 · 순위 · 전후 사진 · 후기 · 효과 보장은 쓰지 마세요. 끝맺음은 예약 · 상담만.'
  if (p.industry === 'professional') return '전문직 광고 규정: 승소율 · 성공률 장담, 의뢰인 후기, 다른 사무소 비교는 쓰지 마세요.'
  if (p.industry === 'education') return '교육 광고: 합격률 · 성적 향상 장담은 쓰지 마세요.'
  if (p.industry === 'food') return '식품 광고: 건강 · 치료 효과(면역력 · 다이어트에 좋은)는 쓰지 마세요.'
  return ''
}

export function aiRequestFacts(p: ContentProfile): string[] {
  return [
    p.years !== null && p.years >= 1 ? `설립 ${p.years}년째${p.since ? `(${p.since}년)` : ''}` : '',
    ...p.strengths.filter((s) => !/^설립 \d+년째$/.test(s)).slice(0, 5),
    p.services.length ? `하는 일: ${p.services.slice(0, 5).join(' · ')}` : '',
    p.differ ? `다른 곳과 다른 점: ${p.differ}` : '',
    p.reviews ? `후기: ${p.reviews}` : '',
    p.voice && p.industry !== 'health' && p.industry !== 'professional' ? `실제 고객 한마디: "${p.voice}"` : '',
    offerLine(p) && p.industry !== 'health' ? `이번 달 혜택: ${offerLine(p)}` : '',
    p.price ? `가격 · 조건: ${p.price}` : '',
    p.phone ? `연락: ${p.phone}${p.hours ? ` · ${p.hours}` : ''}${p.channel ? ` · ${p.channel}` : ''}` : '',
  ].filter(Boolean)
}

/** 붙여 넣을 글(6줄 + 규정 한 줄) */
export function aiRequestText(p: ContentProfile): string {
  const where = [p.region, industryDef(p.industry).label].filter(Boolean).join(', ')
  const facts = aiRequestFacts(p)
  const rule = ruleLine(p)
  return [
    `업체: ${p.company}${where ? `(${where})` : ''}.`,
    `독자(보는 사람): ${p.target}.`,
    `알리는 것: ${p.company}의 ${p.item}${p.services.length ? `(${p.services.slice(0, 3).join(' · ')})` : ''}.`,
    p.speaker ? `화자: ${p.company} ${p.speaker}(이름은 이것만 쓰세요).` : `화자: ${p.company}(사람 이름은 쓰지 마세요).`,
    `사실 목록 — 이 목록 밖의 숫자 · 혜택 · 후기는 쓰지 마세요:\n${facts.length ? facts.map((f) => `- ${f}`).join('\n') : '- (적어 둔 사실이 없어요 — 숫자 · 혜택 · 후기를 넣지 마세요)'}`,
    `넣지 마세요: ${NEVER.join(', ')}.`,
    ...(rule ? [rule] : []),
  ].join('\n')
}

/** 화면에만 보이는 쓰는 법(복사에는 안 들어감) */
export const AI_REQUEST_TIPS = [
  '다음 단계로 넘길 때마다(주제 → 본문, 기획 → 대본) 이 요청문을 다시 붙여 넣으세요 — "넣지 마세요" 는 다음 단계로 넘어가지 않아요.',
  '계정 업종만 쓰는 기능(영상 광고 · 맞춤 추천)은 다른 업체 글에 쓰지 마세요 — 요청문을 무시하고 계정 업종으로 만들어요.',
  '받은 글은 아래 [받은 글 점검] 에 붙여 넣어 한 번 더 보세요 — 숫자의 뜻이 바뀌거나 주지 않은 혜택 · 후기가 끼어들 수 있어요.',
]
