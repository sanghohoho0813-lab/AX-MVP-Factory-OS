/**
 * AI 도우미 — 화면마다 미리 만든 질문 단추의 이름표(D-239).
 * 지시문은 서버(api/_ai/assists.js)에만 있다. 여기는 id · page · label · kind 가 서버와 같아야 한다(단위 시험이 맞춘다).
 */

export type AssistPage = 'today' | 'sales' | 'clients' | 'inbox' | 'agents' | 'money' | 'calendar' | 'grants' | 'client' | 'module' | 'radar' | 'content' | 'venture' | 'patent' | 'cert'

export interface AssistPreset {
  id: string
  page: AssistPage
  label: string
  kind: 'list' | 'write'
  /** 단추 아래 한 줄 — 누르면 무엇을 받는지 */
  hint: string
}

export const ASSIST_PRESETS: readonly AssistPreset[] = [
  { id: 'today.top3', page: 'today', label: '오늘 제일 중요한 것 3개만', kind: 'list', hint: '놓치면 안 되는 것부터 이유와 함께' },
  { id: 'today.deadline', page: 'today', label: '놓치면 끝나는 것만', kind: 'list', hint: '기한 있는 일만 급한 순서로' },
  { id: 'today.order', page: 'today', label: '오늘 순서 짜기 (오전 · 오후)', kind: 'list', hint: '시간대별로 묶어서' },
  { id: 'today.calls', page: 'today', label: '오늘 연락할 곳 + 첫마디', kind: 'list', hint: '전화 첫마디까지' },
  { id: 'sales.brief', page: 'sales', label: '건마다 특징 한 번에 정리', kind: 'list', hint: '단계 · 핵심 · 다음 한 걸음' },
  { id: 'sales.push', page: 'sales', label: '이번 주 밀어붙일 건 3개', kind: 'list', hint: '계약에 가장 가까운 건' },
  { id: 'sales.stuck', page: 'sales', label: '멈춘 건 · 살릴 방법', kind: 'list', hint: '왜 멈췄는지 · 보낼 첫 줄' },
  { id: 'sales.money', page: 'sales', label: '계약 가능 금액 정리', kind: 'list', hint: '단계별 예상 수수료' },
  { id: 'clients.quiet', page: 'clients', label: '여러 달 연락 안 된 곳 + 그때 메모', kind: 'list', hint: '마지막 메모 · 다시 연락할 이유' },
  { id: 'clients.convert', page: 'clients', label: '계약 가능성 높은 순', kind: 'list', hint: '잠재고객을 근거와 함께' },
  { id: 'clients.reco', page: 'clients', label: '추천 많은 업체부터 이번 주 제안', kind: 'list', hint: '업체마다 제안할 모듈 · 한 문장' },
  { id: 'clients.care', page: 'clients', label: '손 안 댄 계약 고객 · 안부 문구', kind: 'list', hint: '보낼 안부 카톡까지' },
  { id: 'inbox.rank', page: 'inbox', label: '전환 가능성 높은 순 정리', kind: 'list', hint: '문의 내용 · 기다린 날 근거' },
  { id: 'inbox.first', page: 'inbox', label: '먼저 연락할 곳 + 첫마디', kind: 'list', hint: '오늘 먼저 전화할 3곳' },
  { id: 'inbox.waiting', page: 'inbox', label: '오래 기다린 신청', kind: 'list', hint: '사흘 넘은 것부터' },
  { id: 'agents.soon', page: 'agents', label: '곧 줘야 할 정산', kind: 'list', hint: '지금 줄 돈 · 곧 생길 돈' },
  { id: 'agents.year', page: 'agents', label: '올해 총 지급 예상', kind: 'list', hint: '준 돈 + 줄 돈 + 예정' },
  { id: 'agents.by', page: 'agents', label: '영업자별 정리', kind: 'list', hint: '줄 돈 · 준 돈 · 맡은 업체' },
  { id: 'money.top', page: 'money', label: '가장 큰 비용 TOP5', kind: 'list', hint: '정기 결제는 1년치도' },
  { id: 'money.year', page: 'money', label: '1년 예상 지출', kind: 'list', hint: '분류별 · 계산식까지' },
  { id: 'money.cut', page: 'money', label: '줄일 수 있는 비용', kind: 'list', hint: '겹치는 구독 · 연 결제' },
  { id: 'money.in', page: 'money', label: '이번 달 · 다음 달 들어올 돈', kind: 'list', hint: '밀린 돈부터' },
  { id: 'calendar.week', page: 'calendar', label: '이번 주 일정 한눈에', kind: 'list', hint: '날짜별로 묶어서' },
  { id: 'calendar.busy', page: 'calendar', label: '빡빡한 날 · 겹치는 날', kind: 'list', hint: '옮길 만한 것 제안' },
  { id: 'calendar.month', page: 'calendar', label: '이번 달 꼭 지킬 마감', kind: 'list', hint: '되돌릴 수 없는 것만' },
  { id: 'grants.best', page: 'grants', label: '우리 고객에게 맞는 공고 TOP5', kind: 'list', hint: '맞는 업체 · 마감' },
  { id: 'grants.client', page: 'grants', label: '업체별 도전할 공고', kind: 'list', hint: '업체마다 1~2개' },
  { id: 'grants.soon', page: 'grants', label: '마감 임박 · 도전 체크한 것', kind: 'list', hint: '남은 준비 한 가지' },
  { id: 'client.brief', page: 'client', label: '이 업체 한 장 요약', kind: 'list', hint: '처음 보는 사람도 알게' },
  { id: 'client.next', page: 'client', label: '다음에 할 일 3가지', kind: 'list', hint: '기한 · 서류 · 제안' },
  { id: 'client.meeting', page: 'client', label: '미팅 전 물어볼 질문 10개', kind: 'list', hint: '모자란 자료부터' },
  { id: 'client.pitch', page: 'client', label: '제안할 모듈과 말할 순서', kind: 'list', hint: '첫 문장 · 받을 서류' },
  { id: 'module.all', page: 'module', label: '고객 전체에서 받을 수 있는 것 정리', kind: 'list', hint: '업체별 · 금액 · 할 일' },
  { id: 'module.first', page: 'module', label: '먼저 연락할 업체 3곳', kind: 'list', hint: '가장 빨리 돈이 되는 곳' },
  { id: 'module.missing', page: 'module', label: '서류만 받으면 되는 업체', kind: 'list', hint: '받을 서류 이름까지' },
  { id: 'radar.top5', page: 'radar', label: '미래AI랩 맞춤 이번 주 TOP5 기획', kind: 'write', hint: '주제 · 구성 · 첫 15초 대본' },
  { id: 'radar.view', page: 'radar', label: '지금 순위로 미래AI랩 관점 새로 쓰기', kind: 'write', hint: '순위가 바뀌면 관점도 새로' },
  { id: 'bench.why', page: 'radar', label: '잘 나가는 채널 · 영상 왜 잘 됐나', kind: 'list', hint: '제목 틀 · 길이 · 주제 · 때' },
  { id: 'bench.copy', page: 'radar', label: '미래AI랩이 따라 할 틀 3개', kind: 'write', hint: '우리 주제로 바꾼 예시' },
  { id: 'rising.ref', page: 'radar', label: '인기 급상승 — 미래AI랩이 참고할 것', kind: 'list', hint: '우리 고객과 이어지는 것만' },
  { id: 'rising.shorts', page: 'radar', label: '급상승 키워드로 쇼츠 아이디어 5', kind: 'write', hint: '제목 · 3컷 · 첫 3초' },
  { id: 'mine.detail', page: 'radar', label: '내 콘텐츠 — 만든 것 자세히 정리', kind: 'list', hint: '다룬 것 · 단계 · 메모 · 숫자' },
  { id: 'mine.next', page: 'radar', label: '잘 된 것 기준 다음에 찍을 것', kind: 'write', hint: '공통점에서 다음 3개' },
  // D-241 기획 답의 [대본 끝까지] 로만 부른다(띠 · 판 단추 목록에는 넣지 않는다)
  { id: 'radar.script', page: 'radar', label: '대본 끝까지 쓰기', kind: 'write', hint: '구간별 대사 · 화면 글 · 제목 · 썸네일 · 설명란' },
  { id: 'content.blog', page: 'content', label: '블로그 글 한 번에 (규칙집 반영)', kind: 'write', hint: '제목 각도 · 구성 · 본문 전체' },
  { id: 'content.place', page: 'content', label: '플레이스 소개글 한 번에', kind: 'write', hint: '한 줄 소개 · 소개글 · 소식 아이디어' },
  { id: 'content.titles', page: 'content', label: '제목 후보 5개 (각도 다르게)', kind: 'list', hint: '검색 의도가 다르게' },
  { id: 'content.keywords', page: 'content', label: '키워드 · 해시태그 정리', kind: 'list', hint: '키워드 10 · 해시태그 15' },
  // D-246 벤처 사업계획서 — 기업인증 › 벤처 › 사업계획서 쓰기의 [AI 초안] 이 차례로 부른다(띠 · 판 단추에는 없음)
  { id: 'venture.p1', page: 'venture', label: '벤처 사업계획서 — 개발 배경 · 경쟁력', kind: 'write', hint: '[1] 1 · 2' },
  { id: 'venture.p2', page: 'venture', label: '벤처 사업계획서 — 기술개발 경과 · 3년 계획', kind: 'write', hint: '[1] 3-1 · 3-2' },
  { id: 'venture.g1', page: 'venture', label: '벤처 사업계획서 — 목표시장 · 경쟁사', kind: 'write', hint: '[2] 1 · 2' },
  { id: 'venture.g2', page: 'venture', label: '벤처 사업계획서 — 시장진입 경과 · 3년 계획', kind: 'write', hint: '[2] 3' },
  { id: 'venture.x', page: 'venture', label: '벤처 사업계획서 — 기업가정신 · 자금운용', kind: 'write', hint: '[1] 4 · [2] 5' },
  { id: 'venture.sum', page: 'venture', label: '벤처 사업계획서 — 요약 · 핵심 요약', kind: 'write', hint: '기술명 · 요약 · 핵심 요약 7칸' },
  // D-247 특허 명세서 — 특허·MVP › 명세서 쓰기의 [AI 초안] 이 차례로 부른다(띠 · 판 단추에는 없음)
  { id: 'spec.a', page: 'patent', label: '명세서 — 기술분야 · 배경 · 과제 · 효과', kind: 'write', hint: '앞부분 네 칸' },
  { id: 'spec.b', page: 'patent', label: '명세서 — 과제의 해결 수단 · 요약', kind: 'write', hint: '해결 수단 · 요약 400자' },
  { id: 'spec.c', page: 'patent', label: '명세서 — 구체적인 내용 ① 구성', kind: 'write', hint: '도 1 · 구성요소마다' },
  { id: 'spec.d', page: 'patent', label: '명세서 — 구체적인 내용 ② 흐름 · 도면', kind: 'write', hint: '도 2 이후 · 단계 · 변형예' },
  { id: 'spec.e', page: 'patent', label: '명세서 — 청구항', kind: 'write', hint: '시스템 · 종속 · 방법' },
  // D-250 대화창 — 질문창에 직접 쓴 말에 답(띠 · 판 단추에는 없음)
  // D-251 마케팅 첫 화면 키워드 묶음 — 묶음 화면이 세 갈래를 동시에 부른다(띠에는 없음)
  { id: 'radar.pack.video', page: 'radar', label: '키워드 묶음 — 유튜브 대본 · 제목', kind: 'write', hint: '이번 주 키워드 하나로 · 규칙집대로' },
  { id: 'radar.pack.short', page: 'radar', label: '키워드 묶음 — 릴스 · 카드뉴스 · 올릴 때 글', kind: 'write', hint: '이번 주 키워드 하나로 · 규칙집대로' },
  { id: 'radar.pack.blog', page: 'radar', label: '키워드 묶음 — 블로그 글', kind: 'write', hint: '이번 주 키워드 하나로 · 규칙집대로' },
  { id: 'pv.chat', page: 'patent', label: '특허 · 벤처 — 물어본 것에 답', kind: 'list', hint: '이 회사 명세서 · 사업계획서 기록으로' },
  { id: 'cert.chat', page: 'cert', label: '기업인증 — 물어본 것에 답', kind: 'list', hint: '이 회사 인증 판정 · 빠진 서류로' },
]

export function presetOf(id: string): AssistPreset | undefined {
  return ASSIST_PRESETS.find((p) => p.id === id)
}

export function presetsFor(ids: readonly string[]): AssistPreset[] {
  return ids.map((id) => presetOf(id)).filter((p): p is AssistPreset => !!p)
}
