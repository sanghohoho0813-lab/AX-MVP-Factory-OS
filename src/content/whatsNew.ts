/**
 * D-593 새로 생긴 것 — 쓰는 사람이 '뭐가 바뀌었지?' 를 화면 안에서 바로 보고 한 번 눌러 써 볼 수 있게.
 *
 * 사용법 안내 화면의 접힌 한 줄('새로 생긴 것 — 최근 n가지')에 나온다. 최근 것이 위.
 *  - 쉬운 말로 한 줄(무엇이 생겼나) + 한 줄(이렇게 써 보세요) + 갈 화면(있을 때만).
 *  - 고객 계정에도 보이는 글이다 — 모듈 · 판정 · 예상 금액을 쓰지 않는다. 고객에게 닫힌 화면으로 보내지 않는다(시험 K31).
 *  - 열 개까지만 둔다(오래된 것은 아래에서 뺀다 — 기능을 지우는 것이 아니라 이 목록에서만).
 * 규칙 글이다 — AI 가 쓰지 않는다.
 */
export interface WhatsNewItem {
  id: string
  /** 생긴 날(YYYY-MM-DD) */
  date: string
  title: string
  /** 이렇게 써 보세요 */
  how: string
  /** 한 번 눌러 가 볼 화면 — 없으면 단추 없이 글만 */
  path?: string
  cta?: string
  /** 마케팅 · 브랜딩 화면이 열린 계정에만 */
  marketing?: boolean
}

export const WHATS_NEW_MAX = 10

export const WHATS_NEW: ReadonlyArray<WhatsNewItem> = [
  {
    id: 'youtube-calm',
    date: '2026-11-12',
    title: '유튜브 · 내 콘텐츠 화면도 한 판으로 깔끔해졌어요',
    how: "유튜브는 이번 주 뜨는 주제가 번호 붙은 목록으로 바뀌었고, 하나를 누르면 제목 · 대본이 한 판 안에 나와요. 내 콘텐츠도 만든 것 · 긴 영상 진행판 · 채널 기준이 한 판 안에 줄로 나뉘어요.",
    path: '/marketing?view=plan',
    cta: '유튜브 열기',
    marketing: true,
  },
  {
    id: 'sns-calm',
    date: '2026-11-12',
    title: '스레드 · 릴스 쓰는 화면이 한 판으로 깔끔해졌어요',
    how: "1번 칸에서 '우리 분야 주제'(정관 · 가지급금 · 정책자금 같은 상담 주제)를 하나 누르고 [AI로 완성 글 쓰기] 를 누르면 돼요. 이번 주 키워드 · 직접 고르기는 접어 뒀어요.",
    path: '/marketing/threads',
    cta: '스레드 열기',
    marketing: true,
  },
  {
    id: 'contact-path',
    date: '2026-11-11',
    title: '연락 받는 길 만드는 법을 알려 줘요',
    how: "카카오톡 오픈채팅을 다섯 걸음으로 만들고, 그 한 줄을 프로필 소개 글에 바로 넣어요. 기초 7가지 화면 아래에 있어요.",
    path: '/marketing/basics',
    cta: '기초 7가지 열기',
    marketing: true,
  },
  {
    id: 'search-screens',
    date: '2026-11-11',
    title: '찾기에 하고 싶은 일을 적어도 찾아 줘요',
    how: "맨 위 [찾기]에 '스레드' · '엑셀' · '일정' 처럼 적으면 그 화면으로 바로 가요.",
  },
  {
    id: 'bulk-email-address',
    date: '2026-11-11',
    title: '엑셀 고객 목록의 이메일 · 주소도 같이 들어가요',
    how: '목록을 넣으면 이메일 · 주소 칸도 알아서 찾아 업체 기록에 넣어요.',
    path: '/ops/clients?bulk=1',
    cta: '엑셀 목록 넣어 보기',
  },
  {
    id: 'profile-bio',
    date: '2026-11-11',
    title: '프로필 소개 글을 만들어 줘요',
    how: '이름 · 분야 · 누구를 돕는지만 적으면 스레드 · 인스타그램 · 틱톡 · 유튜브 프로필 글이 세 가지로 나와요.',
    path: '/marketing/basics',
    cta: '소개 글 만들어 보기',
    marketing: true,
  },
  {
    id: 'home-screen',
    date: '2026-11-11',
    title: '휴대폰 홈 화면에 아이콘으로 넣을 수 있어요',
    how: "이 화면 아래 '휴대폰 홈 화면에 넣는 법' 을 따라 하면 아이콘 한 번으로 열려요.",
  },
  {
    id: 'screen-guide-phone',
    date: '2026-11-11',
    title: '휴대폰에서 맨 위 화면 이름을 누르면 그 화면 안내가 떠요',
    how: '어느 화면에서든 맨 위 이름 옆 ⓘ 를 눌러 보세요 — 무엇을 하는 곳인지 바로 나와요.',
  },
  {
    id: 'bulk-clients',
    date: '2026-11-10',
    title: '여러 업체를 한 번에 등록해요',
    how: '엑셀에서 목록을 복사해 붙여넣거나 엑셀 파일을 그대로 고르면 돼요. 이미 있는 업체는 건너뛰어요.',
    path: '/ops/clients?bulk=1',
    cta: '한 번에 등록해 보기',
  },
  {
    id: 'clients-csv',
    date: '2026-11-10',
    title: '업체 목록을 엑셀 파일로 내려받아요',
    how: '고객 관리 화면의 [더보기] 안에 [업체 목록 엑셀 파일로] 가 있어요.',
    path: '/ops/clients',
    cta: '고객 관리 열기',
  },
]

/** 이 계정에 보일 것만 — 마케팅 화면이 닫힌 계정에는 마케팅 줄을 빼고, 열 개까지 */
export function whatsNewFor(opts: { marketingOpen: boolean }): WhatsNewItem[] {
  return WHATS_NEW.filter((x) => opts.marketingOpen || !x.marketing).slice(0, WHATS_NEW_MAX)
}

/** '2026-11-11' → '11월 11일' */
export function whatsNewDateLabel(date: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  return m ? `${Number(m[2])}월 ${Number(m[3])}일` : date
}
