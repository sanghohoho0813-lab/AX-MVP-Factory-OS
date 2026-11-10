/**
 * D-571 고객 모으기 기초 7가지 — 어디서부터 해야 할지 모르는 사람이 5분 안에 읽고 바로 해 보게.
 * 대표(2026-11-10): "컨설턴트들이 가장 원하는 건 마케팅(고객 DB 확보) — 어디서부터 어떻게 시작해야 할지 모르는 사람이 대부분.
 *                    이 OS 안에서 해결하고, 교육적인 면에서도 좋고, 매일 들어와서 하게."
 *
 *  - 한 가지마다: 요점 한 줄 · 왜 그런지 · 이렇게 말고(전) → 이렇게(후) · [바로 해 보기](그 일을 하는 화면으로).
 *  - 쉬운 말만(D-507 — 업계 말 없이) · 결과를 약속하지 않는다(D-554 — '무조건 · 보장' 같은 말은 나쁜 보기에만).
 * 규칙 글이다 — AI 가 쓰지 않는다.
 */
export interface MarketingBasic {
  key: string
  title: string
  /** 요점 한 줄 */
  point: string
  /** 왜 그런지 */
  why: string
  /** 이렇게 말고 */
  bad: string
  /** 이렇게 */
  good: string
  /** [바로 해 보기] 단추 글자 · 가는 곳 */
  tryLabel: string
  tryHref: string
}

export const MARKETING_BASICS: readonly MarketingBasic[] = [
  {
    key: 'who',
    title: '한 사람에게 말하기',
    point: '모두에게 쓰면 아무도 읽지 않아요. 딱 한 사람을 떠올리고 쓰세요.',
    why: "사람은 '내 얘기다' 싶을 때만 멈춰서 읽어요. 업종 · 규모 · 고민을 좁힐수록 연락이 와요.",
    bad: '중소기업 대표님들께 유용한 정보를 드립니다.',
    good: '직원 다섯 명 안팎 제조업 대표님, 올해 사람을 뽑을 계획이 있으신가요?',
    tryLabel: '내 분야 · 고객 적기',
    tryHref: '/settings',
  },
  {
    key: 'steady',
    title: '한 주에 세 편, 석 달',
    point: '잘 쓴 한 편보다 꾸준한 서른 편이 고객을 데려와요.',
    why: "처음 보는 사람은 글 하나로 연락하지 않아요. 여러 번 보고 '이 사람은 꾸준하다' 싶을 때 연락해요.",
    bad: '시간 날 때 긴 글 한 편 — 그러고 두 달 쉬기.',
    good: '화 · 목 · 토 아침에 짧은 글 한 편씩. 초안은 프로그램이 써 주고 나는 고치기만.',
    tryLabel: '1주일치 한 번에 만들기',
    tryHref: '/marketing',
  },
  {
    key: 'first',
    title: '첫 줄에서 멈추게 하기',
    point: '첫 줄이 밋밋하면 나머지는 읽히지 않아요.',
    why: '화면을 넘기다 멈추는 데 1초가 걸려요. 첫 줄에 고객의 고민이나 뜻밖의 사실을 두세요.',
    bad: '안녕하세요, ○○컨설팅입니다. 오늘은 정책자금에 대해 알아보겠습니다.',
    good: '대출이 막혔다는 대표님, 은행보다 먼저 볼 곳이 있습니다.',
    tryLabel: '첫마디 10개 보기',
    tryHref: '/marketing/threads',
  },
  {
    key: 'problem',
    title: '내 자랑 말고 고객 고민',
    point: '내가 무엇을 잘하는지보다, 고객이 무엇을 걱정하는지부터 쓰세요.',
    why: '고객은 자기 문제를 풀어 줄 사람을 찾아요. 고민 → 왜 생기는지 → 방법 한 가지 순서면 끝까지 읽혀요.',
    bad: '저희는 오랜 경력의 전문 컨설팅 그룹입니다.',
    good: '서류는 다 냈는데 왜 떨어졌을까요? 자주 빠뜨리는 한 가지를 알려 드립니다.',
    tryLabel: '이번 주 주제 보기',
    tryHref: '/marketing/youtube?view=plan',
  },
  {
    key: 'contact',
    title: '글 끝에 연락 받는 길',
    point: '읽고 나서 무엇을 하면 되는지 한 줄로 알려 주세요.',
    why: '좋은 글을 읽어도 연락할 길이 없으면 그냥 지나가요. 전화 · 카톡 · 상담 신청 가운데 하나만 적으세요.',
    bad: '(좋은 내용인데 글이 그냥 끝남)',
    good: "우리 회사도 되는지 궁금하시면 '상담' 두 글자만 남겨 주세요.",
    tryLabel: '끝인사 적기',
    tryHref: '/settings?brand=more',
  },
  {
    key: 'honest',
    title: '부풀리지 않기',
    point: "'무조건 됩니다' 같은 말은 쓰지 않아요. 믿음이 깨지고 규정에도 걸려요.",
    why: '컨설팅은 결과를 약속할 수 없는 일이에요. 조건과 한계를 같이 말하는 사람이 오래 믿음을 얻어요.',
    bad: '누구나 받는 지원금, 무조건 승인!',
    good: '조건이 맞으면 받을 수 있어요. 우리 회사가 맞는지 세 가지만 확인해 보세요.',
    tryLabel: '올리기 전 점수 보기',
    tryHref: '/marketing/threads',
  },
  {
    key: 'review',
    title: '올린 뒤 돌아보기',
    point: '일주일에 한 번, 어떤 글에 반응이 있었는지 보세요.',
    why: '반응이 좋았던 주제와 첫 줄을 다시 쓰면 돼요. 감으로 하지 않고 기록으로 해요.',
    bad: '올리고 나면 잊어버리기.',
    good: '일요일에 올린 글을 훑어보고, 잘된 것 하나를 골라 다음 주에 비슷하게 한 편 더.',
    tryLabel: '만든 것 보기',
    tryHref: '/marketing/youtube?view=make',
  },
]

/** 읽은 것 표시 — 이 브라우저에 기억(다음에 열면 안 읽은 것부터) */
const READ_KEY = 'axmvp.mk.basics.read'

export function readBasics(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(READ_KEY) ?? '[]')
    const keys = new Set(MARKETING_BASICS.map((b) => b.key))
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && keys.has(x)) : []
  } catch {
    return []
  }
}

export function markBasicRead(key: string): string[] {
  const next = [...new Set([...readBasics(), key])]
  try {
    localStorage.setItem(READ_KEY, JSON.stringify(next))
  } catch {
    /* 못 적어도 이번 화면에서는 따른다 */
  }
  return next
}

/** 다음에 읽을 것(순서대로 첫 안 읽은 것) — 다 읽었으면 null */
export function nextBasic(read: readonly string[]): MarketingBasic | null {
  return MARKETING_BASICS.find((b) => !read.includes(b.key)) ?? null
}
