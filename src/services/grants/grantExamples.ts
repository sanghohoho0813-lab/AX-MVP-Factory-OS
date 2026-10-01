/**
 * 예시 공고 (D-141) — 처음 써 볼 때 화면이 어떻게 움직이는지 보여 주는 용도. **실제 공고가 아니다.**
 *  - 제목 앞에 [예시] · 출처 '예시' · 가망고객 공개 화면에는 절대 나가지 않는다(normalizeNotice 가 막는다).
 *  - 마감일은 넣는 날 기준으로 잡는다(오늘 마감 · 이번 주 · 선착순 · 상시가 다 보이게).
 */
import { NO_RULES, type GrantNotice } from './grantMatch'

function plus(today: string, days: number): string {
  const d = new Date(`${today}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function exampleNotices(today: string): Omit<GrantNotice, 'id' | 'createdAt' | 'updatedAt'>[] {
  const base = { operator: '', summary: '예시 공고입니다. 실제 공고를 넣으면 지워 주세요.', url: '', source: 'example' as const, published: false, applyStart: plus(today, -14) }
  return [
    {
      ...base,
      title: '[예시] 지역 중소기업 AI 활용 확산 지원사업',
      agency: '중소벤처기업부',
      category: 'rnd',
      applyEnd: today,
      deadlineKind: 'date',
      amountText: '최대 5천만원',
      target: '중소기업',
      rules: { ...NO_RULES, sizes: ['small'] },
    },
    {
      ...base,
      title: '[예시] 경기 북부 제조기업 스마트공장 구축 지원',
      agency: '경기도',
      category: 'rnd',
      applyEnd: plus(today, 3),
      deadlineKind: 'date',
      amountText: '최대 1억원',
      target: '경기도 소재 제조업 중소기업',
      rules: { ...NO_RULES, regions: ['경기'], industries: ['제조'], sizes: ['small'] },
    },
    {
      ...base,
      title: '[예시] 청년 창업기업 판로 개척 마케팅 바우처',
      agency: '중소벤처기업부',
      category: 'marketing',
      applyEnd: plus(today, 10),
      deadlineKind: 'first_come',
      amountText: '기업당 2천만원',
      target: '창업 7년 이내, 대표 만 39세 이하',
      rules: { ...NO_RULES, withinYears: 7, youthCeo: true },
    },
    {
      ...base,
      title: '[예시] 수출 초보기업 해외 전시회 참가 지원',
      agency: '산업통상부',
      category: 'export',
      applyEnd: plus(today, 20),
      deadlineKind: 'date',
      amountText: '',
      target: '중소기업, 매출 50억원 이하',
      rules: { ...NO_RULES, maxRevenueM: 5000, sizes: ['small'] },
    },
    {
      ...base,
      title: '[예시] 일 · 생활 균형 제도 도입 컨설팅',
      agency: '고용노동부',
      category: 'hr',
      applyEnd: '',
      deadlineKind: 'always',
      amountText: '',
      target: '상시 근로자 5명 이상 기업',
      rules: { ...NO_RULES, minEmployees: 5 },
    },
    {
      ...base,
      title: '[예시] 서울 소상공인 경영안정자금',
      agency: '서울특별시',
      category: 'money',
      applyEnd: plus(today, 5),
      deadlineKind: 'date',
      amountText: '업체당 최대 5천만원 융자',
      target: '서울 소재 소상공인',
      rules: { ...NO_RULES, regions: ['서울'], sizes: ['micro'] },
    },
  ]
}
