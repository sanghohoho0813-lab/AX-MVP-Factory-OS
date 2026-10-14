/**
 * 유튜브 벤치마킹 데이터 받아오기 (D-193 · D-194 콘텐츠 레이더) — Vercel 서버 함수.
 *
 * 대표가 예전에 만든 '김팀장 벤치마킹 대시보드'(Streamlit) 의 수집 부분(youtube_api.py)을 옮긴 것.
 *  - 유튜브 키는 서버 환경변수에서만 읽는다(브라우저 · git · 번들에 넣지 않는다). 응답에 키를 싣지 않는다.
 *  - 정해 둔 채널(내 채널 + 벤치마킹)의 정보 + 채널마다 최근 영상 50편. 채널마다 묶음(group)을 붙여 보낸다:
 *    direct(직접 경쟁 · 시장수요) · ai(AI 실무) · ax(AX · 업무자동화) · format(포맷 벤치마킹).
 *  - 쓰는 할당량: 채널 정보 1단위(50곳까지 한 번에) + 채널마다 2단위(최근 영상 목록 · 영상 정보).
 *    D-197 채널 49곳(모두 채널 번호) → 한 번에 99단위(하루 무료 10,000단위의 1%). 검색(search.list · 100단위)은 쓰지 않는다.
 *  - D-196 6시간 칸: 화면은 ?win=6시간 칸&rev=채널 구성 판 으로 부른다 — 그 칸이 끝날 때까지 Vercel 캐시에 둔다
 *    → 같은 6시간 · 같은 판이면 몇 명이 열어도 유튜브는 한 번(하루 4번 × 67단위). 예전 화면의 ?slot=오늘(9시까지 캐시)도 그대로 받는다.
 *  - [지금 새로 가져오기] 는 ?bucket=30분 칸 — 같은 30분 안에서는 몇 번을 눌러도 한 번만 유튜브를 부른다
 *    (아무나 주소를 두드려 하루 할당량을 다 쓰지 못하게). 정해 둔 칸 · 값 말고는 받지 않는다(400).
 *  - 채널 구성 판(feedRevision): 채널 번호 · 묶음 · 내 채널 · 채널마다 받는 편수 · 응답 모양 판으로 만든 짧은 글(같은 설정이면 늘 같다).
 *    응답마다 싣는다. 화면이 보낸 rev 가 지금 판과 다르면 유튜브를 부르지 않고 409 + 지금 판(화면이 그 판으로 다시 부른다) —
 *    아무 rev 값으로 캐시를 비켜 가며 할당량을 쓰지 못하게.
 *  - ?status=1 이면 키가 있는지 · 채널 수 · 채널 구성 판만 알려 준다(유튜브를 부르지 않는다 · 할당량 0 · 키 값은 절대 안 보낸다).
 *  - 채널 하나가 실패해도 나머지는 보낸다 — 실패한 채널 이름을 같이 보낸다(예전 앱은 조용히 빠졌다).
 *  - D-194 [채널 추가] — ?resolve=@주소(또는 채널 주소 · 번호) 는 채널 한 곳 확인(1~2단위) ·
 *    ?extra=UC…,UC… 는 대표가 더한 채널(10곳까지)의 영상. 둘 다 값이 정해져 있지 않아 캐시로 막을 수 없으므로
 *    OS 에 로그인한 사람만(Supabase 로그인 토큰 확인) · 응답은 캐시하지 않는다(private).
 *  - 다른 파일을 불러오지 않는다(서버 함수 하나로 끝나게). 키워드 · 주제 · 후보 계산은 화면 쪽 규칙(ytBench · ytRadar)이 한다.
 */

// VITE_ 이름은 받지 않는다 — VITE_ 로 넣은 값은 화면 번들에 들어갈 수 있다(키는 서버 이름으로만)
const KEY_NAMES = ['YOUTUBE_API_KEY', 'YOUTUBE_KEY', 'YT_API_KEY', 'YOUTUBE_DATA_API_KEY']
// 로그인 확인용 — Supabase 주소와 '공개' 키(anon). anon 키는 원래 화면에 들어가는 공개 값이라 VITE_ 이름도 읽는다.
// service_role 키는 읽지도 쓰지도 않는다.
const SUPA_URL_NAMES = ['SUPABASE_URL', 'VITE_SUPABASE_URL']
const SUPA_ANON_NAMES = ['SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY']
const API = 'https://www.googleapis.com/youtube/v3'
const PER_CHANNEL = 50
const BUCKET_MS = 30 * 60_000
/** 데이터를 쓰는 최대 시간(D-196) — 화면 저장소(ytFeed)의 FRESH_MS 와 같은 값 */
const WINDOW_MS = 6 * 3_600_000
/** 응답 모양 판 — 채널 칸 · 영상 칸이 바뀌면 올린다(D-194 묶음 · 메모를 실은 것이 2) */
export const FEED_SCHEMA = 2
const POOL = 8
const MAX_EXTRA = 10

/**
 * 내 채널 1 + 벤치마킹.
 * 2026-10-14: 핸들(@주소)은 채널이 바꾸면 끊긴다 — 바뀌지 않는 채널 번호(id)로 부른다. handle · name 은 화면 · '못 받은 채널' 이름표.
 *  - @엘아이파트너스여팀장 → 지금 주소 @정책자금해답사여팀장(같은 채널 · 주소만 바뀜)
 *  - @사장노트 는 유튜브에 그 주소가 없어(404) 대표 지시로 목록에서 뺐다(2026-10-14)
 * D-194: 묶음(group) · 메모(note). AI 실무 8 · AX 4 · 포맷 2 를 더했다 — 모두 2026-10-14 유튜브 채널 화면에서
 *   채널 번호 · 이름 · 구독자를 직접 확인한 곳만(지어낸 채널 없음). 구독자 수는 그날 화면에 보인 값.
 * D-197: AI 실무 11 · AX 5 를 더 더했다(AI 19 · AX 9 · 모두 49곳) — 후보 70여 곳을 채널 화면으로 확인해
 *   최근 30~60일 업로드 · 실무 활용 중심만. 메모(note)는 화면 '왜 보는 채널인지' 에 그대로 보인다.
 *   49곳이라 채널 정보는 여전히 한 번(50곳까지) · 한 번 받기 1 + 49 × 2 = 99단위.
 */
export const CHANNELS = [
  // ---- 직접 경쟁 · 시장수요(예전 앱 20곳 — 주소가 없어진 @사장노트 만 뺌) ----
  { id: 'UCjXWwM0_25vl1Mpr2Pc5amQ', handle: '@김팀장의경영노트', name: '김팀장의 경영노트', group: 'direct', mine: true, note: '내 채널 — 벤치마킹과 견줄 평소 조회수 · 잘된 주제 기준' },
  { id: 'UCnnqB7SaH8o-NHLonSFfE3A', handle: '@yoido', name: '여의도 정보맨', group: 'direct', note: '소상공인 정책자금 · 지원금 속보 — (속보) 말머리 · 공문 화법은 포맷 참고로도 좋다' },
  { id: 'UC5EQkCVDppT_5B9X7i6TIWg', handle: '@소상공인도우미', name: '소상공인 도우미 | 정책원', group: 'direct', note: '소상공인 지원 정책 · 쇼츠 위주' },
  { id: 'UCaiqXSUrOib0SZjBIvXTzjw', handle: '@onetop-1', name: 'ONETOP_경영컨설팅', group: 'direct', note: '정책자금 · 경영컨설팅' },
  { id: 'UCkA6KFq2mI76yexZAqX8dDA', handle: '@정책자금해답사여팀장', name: '여팀장 여바른 l 정책자금 l 엘아이파트너스', group: 'direct', note: '정책자금(예전 주소 @엘아이파트너스여팀장)' },
  { id: 'UCgq3pl1WHBorKFlu4yBr1TQ', handle: '@giupinfo', name: '기업꿀정보TV', group: 'direct', note: '정부지원사업 · 바우처' },
  { id: 'UCOsUUoxhs69bPAi1N03D9Og', handle: '@jeongel', name: '정엘 가업승계 연구소', group: 'direct', note: '가업승계 · 법인 자금' },
  { id: 'UC_IJ2OlHt3dS7uuEHu3Dvhw', handle: '@kstartuptv', name: '스타트업TV', group: 'direct', note: '창업자금 · 소상공인 정책자금' },
  { id: 'UCb1KRnbtUYVb1thGLOtBEAQ', handle: '@richceo', name: '부자사장연구소', group: 'direct', note: '법인 대표 돈 · 법인전환' },
  { id: 'UC73RuX0YCYWBJoDHMCnfNIQ', handle: '@businesshelperJo', name: '비즈니스헬퍼', group: 'direct', note: '사업자 지원 제도 설명 — 대표님이 찾는 지원 주제 수요 확인' },
  { id: 'UC4-jNRLcNNcPHG864icJcKQ', handle: '@bogopatv', name: '보고파TV', group: 'direct', note: '가업승계 · 세제 개편' },
  { id: 'UC3kRdLEVPaFmr3obvmNafNA', handle: '@money_recipe', name: '머니해결사 정대표', group: 'direct', note: '정책자금 · 법인영업' },
  { id: 'UCX_Jg2GJWeSy2jGd7M0bRlQ', handle: '@사장님성장솔루션', name: '준쌤 l 사장님성장솔루션', group: 'direct', note: '소상공인 지원금 · 창업지원' },
  { id: 'UCgHvFTVYFo-oWV6vu7it1PQ', handle: '@슬기로운정책지원', name: '슬기로운 정책지원', group: 'direct', note: '소상공인 정책지원' },
  { id: 'UCO6JRTAtKstRDZww8qGUcxg', handle: '@rodemtax', name: '로뎀세무법인', group: 'direct', note: '세무 · 가족법인' },
  { id: 'UCSYUQrcXUnRuvqBdqDlT74g', handle: '@nicetax', name: '이상화세무사의 모래세무', group: 'direct', note: '법인세 · 세무조사' },
  { id: 'UC2ByczqyZtt0Lj2DCkQuXJA', handle: '@세금전문회계사김희연', name: '절세미녀 김희연 회계사', group: 'direct', note: '절세 · 연금 — 쇼츠 화법도 참고' },
  { id: 'UCOrN9I5NyZ7ZQWW30togg-w', handle: '@dowssem', name: '도혜연세무사', group: 'direct', note: '자본거래 · 가업승계' },
  { id: 'UCFSVU2_P0L2n21_d2J-ZQ2Q', handle: '@세무사', name: '이상호 세무사 씽크택스', group: 'direct', note: '세금 일반 — 절세 · 세금 신고 주제 수요 확인' },
  // ---- AI 실무(D-194 · 구독자 약 10만 이하 · 최근 30일 업로드 · 실무 적용) ----
  { id: 'UCgi5InkiecEitESPWd-n0vA', handle: '@HappyAI_0612', name: '해피AI | 이진규', group: 'ai', note: 'Claude · 에이전트로 업무자동화 실습 — 구독자 1만대인데 조회가 강함' },
  { id: 'UCDq9_N34UnlMSlFB4kWE15w', handle: '@routeai', name: '이동훈의 루트AI', group: 'ai', note: "ChatGPT 업무 활용 · '우리 회사 업무자동화' 실습 파일" },
  { id: 'UCblD_mr7VjQcToS_5WweDhA', handle: '@오늘쓰는AI', name: '오늘 쓰는 AI', group: 'ai', note: '직장인 AI 실무만 — 작은 채널인데 조회 강함' },
  { id: 'UC8s9VGbVI2od-UlFfacV27Q', handle: '@lo_sajang', name: '로사장 김다솔', group: 'ai', note: '자동화 도구 — 훅(첫 문장) 연구용' },
  { id: 'UCWt2bPyw2ZNweIxpSnB36Ew', handle: '@헤이디', name: '헤이디_일잘러의 업무스킬', group: 'ai', note: 'AI로 PPT · 문서 · 노션(보고서 · 제안서에 가까움)' },
  { id: 'UCFmYIak2sRBXt2M3ep6U3QA', handle: '@jayychoii', name: 'Jay Choi | 인디해커 라이프', group: 'ai', note: 'AI로 직접 만들기 · 긴 실전 가이드' },
  { id: 'UCZ-cyNeQAQfcZt-gEuX06Zg', handle: '@SURVIVALAI2025', name: '생존AI', group: 'ai', note: '경영관리 직장인의 AI 실험(에이전트에게 일 맡기기)' },
  { id: 'UCn26HGVN_pmHzMHZDWOiKZA', handle: '@choiceuniverse', name: '시간기획자 최민정', group: 'ai', note: '1~10인 회사 생산성 · 노션 + AI' },
  // D-197 AI 실무 더함(2026-10-14 채널 화면에서 번호 · 이름 · 구독자 · 최근 업로드 직접 확인 — 지어낸 채널 없음)
  { id: 'UC1L4zVeBF0UNt3lDPgTDm7w', handle: '@ai.dingco', name: '딩코의 AI 심야 아지트', group: 'ai', note: '주간보고 · 회의록 · 엑셀을 Claude · ChatGPT · Codex 로 — 60~70분 총정리 강의 포맷' },
  { id: 'UCztt42h03X49HFRGW9--Bhg', handle: '@aiadjunct', name: 'AI 겸임교수 이종범', group: 'ai', note: '보고서 · 기획서 · 엑셀 · 회의록 실무 AI — AX · AI 네이티브 회사 이야기도' },
  { id: 'UCc3-QWjpSyx7D_x7kh3TdgQ', handle: '@Vibe_RaiN', name: '레인 | AI 바이브코딩', group: 'ai', note: '비개발자의 Claude 업무 연결(보고서 · 에이전트) — 작은 채널인데 조회 강함' },
  { id: 'UCtuLRvs6DgN5DZvxbNoL5IQ', handle: '@digital_ggultip', name: '디꿀방', group: 'ai', note: 'Gemini · NotebookLM 으로 업무 에이전트(계약 검토 · 일정) — 구글 도구 실무' },
  { id: 'UCWRWkyubH0HCnjLsXoCCLzQ', handle: '@라핀_AI_자동화', name: '직장인 AI 업무 자동화 | 라핀', group: 'ai', note: '보고서 · 엑셀 취합 · 회의록을 코딩 없이 나만의 프로그램으로' },
  { id: 'UCBlTB7GyNQLqZMDRFEZ_cSg', handle: '@ai.yeongseon', name: '신영선의 AI탐구', group: 'ai', note: '대표 · 사장님 사례로 보는 AI 자동화(블로그 · 마케팅 · 에이전트) — 사업자 눈높이' },
  { id: 'UCCw1Ng1uXaemhIMYRyla7Vw', handle: '@online_techtree', name: '온라인 사업 전략, 온크트리', group: 'ai', note: '온라인 사업자용 AI 자동화 — "(N분 완성)" 제목 공식' },
  { id: 'UCXVkzJyouB52ycIz40VPQcg', handle: '@workai_lab', name: '외부강사 김지백 (모두의 AI 교육)', group: 'ai', note: '직장인 · 사장님용 오늘 바로 쓰는 AI — 회의 · 보고 도구 · 프롬프트 배포형' },
  { id: 'UC6PuL8-eXqizOYtvLCK9iJQ', handle: '@에이커-돈이되는AI', name: '에이커, 돈이되는 AI와 이커머스', group: 'ai', note: 'ChatGPT · Gemini · Claude "기능 N가지" — 조회 강한 제목 · 썸네일 공식(업로드는 드문 편)' },
  { id: 'UCidyOPC0asenYpq_Mgbfa0w', handle: '@honjobs', name: '혼잡스', group: 'ai', note: '"지도 한 장으로 끝내기" 정리 포맷 · 모조리 자동화 연재(대형 · 일반 IT 도 섞임)' },
  { id: 'UCN3c2S-RZCh1PIVpkL4STVg', handle: '@engine_excel_AI', name: 'AI도 엑셀 이것만!', group: 'ai', note: '엑셀 실무자에게 Claude(파워쿼리 · 엑셀 보고서) — 쉬운 설명' },
  // ---- AX · 업무자동화(D-194) ----
  { id: 'UCDLlMjELbrJdETmSiAB68AA', handle: '@citizendev9c', name: '시민개발자 구씨', group: 'ax', note: '노코드 + AI 사내 시스템' },
  { id: 'UCXKXULkq--aSgzScYeLYJog', handle: '@dante-labs', name: '단테랩스', group: 'ax', note: '에이전트 · n8n 직접 구축' },
  { id: 'UCYg51KBo-UcA4QILcYl5LEw', handle: '@yunjadong', name: '윤자동', group: 'ax', note: '기업 대상 시스템 구축 · 교육 — 사업 모델이 가장 비슷' },
  { id: 'UChu25pJgVZB3p0dVEgmU0PQ', handle: '@mcodeM', name: '메타코드M', group: 'ax', note: '기업 AX · DX 강의' },
  // D-197 AX · 업무자동화 더함(같은 날 직접 확인)
  { id: 'UCDieGYS2T1fy-j9_GZeZeqQ', handle: '@stevesurfing', name: '스티브의 파도타기', group: 'ax', note: '아버지 제조업 회사에 AI 영업비서 · 프로젝트 비서 구축 — 중소기업 사내 시스템 실사례' },
  { id: 'UCWyi-m_CdIbRpcwZN6MgBfg', handle: '@naminsoo_aimax', name: '나민수 AI', group: 'ax', note: '"AI 직원" 연재(잠재고객 · 제안메일 · 영업 준비) · AX 컨설팅 — 사업 모델이 비슷' },
  { id: 'UC2z8dKsrZIiuGiIVNsRfD1A', handle: '@workbyax', name: '신성진 · Work by AX', group: 'ax', note: '기업 출강 AX 강사의 업무별 실습 · 에이전트 업무자동화 연재 구성' },
  { id: 'UCxj3eVTAv9KLdrowXcuCFDQ', handle: '@builderjoshkim', name: '빌더 조쉬 Builder Josh', group: 'ax', note: 'AI 네이티브 회사 인터뷰 — 기업 AX 사례 · 대표 인터뷰 포맷' },
  { id: 'UCKdKdx5-eLZUmAgsdvxkKiA', handle: '@VibecodingUniversity', name: '양실장의 바이브코딩대학', group: 'ax', note: '비개발자 바이브코딩 · AX 컨설턴트 양성 — 교육 사업 모델' },
  // ---- 포맷 벤치마킹(D-194 · 주제가 아니라 제목 · 구성 참고) ----
  { id: 'UCxKStIHz831RiHAiiCY3pnQ', handle: '@교양식', name: '교양식', group: 'format', note: '정부지원 주제를 전문가 인터뷰로 — 인용형 제목' },
  { id: 'UCvil4OAt-zShzkKHsg9EQAw', handle: '@lucky_tv', name: '김작가 TV', group: 'format', note: "'이것' + 출연자 제목 공식 · 인터뷰 구성(대형 채널)" },
]

/**
 * 채널 구성 판(D-196) — 결과에 영향을 주는 설정(채널 번호 · 묶음 · 내 채널 · 채널마다 받는 편수 · 응답 모양 판)만으로 만든다.
 * 같은 설정이면 언제 어디서 만들어도 같은 글. 채널 이름 · 메모처럼 결과에 영향이 없는 칸은 넣지 않는다.
 * 꼴: '응답판-채널수-요약값'(예: 2-33-1k9x0qz) — 사람이 봐도 채널 수는 알 수 있게.
 */
export function feedRevisionOf(list = CHANNELS, schema = FEED_SCHEMA) {
  const basis = [`schema:${schema}`, `per:${PER_CHANNEL}`, ...list.map((c) => `${c.id || c.handle}|${c.group || ''}|${c.mine ? 1 : 0}`)].join('\n')
  // FNV-1a 32비트 — 다른 파일 · 모듈을 부르지 않고 늘 같은 값
  let h = 0x811c9dc5
  for (let i = 0; i < basis.length; i++) {
    h ^= basis.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return `${schema}-${list.length}-${h.toString(36)}`
}
export const FEED_REVISION = feedRevisionOf()

const envFirst = (names) => {
  for (const name of names) {
    const v = process.env[name]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

function keyFromEnv() {
  for (const name of KEY_NAMES) {
    const v = process.env[name]
    if (typeof v === 'string' && v.trim()) return { name, value: v.trim() }
  }
  return null
}

/** 다음 한국 시간 오전 9시까지 남은 초(최소 60초) */
export function secondsUntilNine(now = Date.now()) {
  const kst = new Date(now + 9 * 3600_000)
  const next = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate(), 9, 0, 0) - 9 * 3600_000
  const target = next > now ? next : next + 86_400_000
  return Math.max(60, Math.round((target - now) / 1000))
}

/** 가장 최근 한국 시간 오전 9시의 날짜 칸(= 세계 표준시 날짜) */
export const slotOf = (now = Date.now()) => new Date(now).toISOString().slice(0, 10)
export const bucketOf = (now = Date.now()) => Math.floor(now / BUCKET_MS)
/** 6시간 칸(D-196) — 세계 표준시 0 · 6 · 12 · 18시(한국 9 · 15 · 21 · 3시)에 바뀐다 */
export const windowOf = (now = Date.now()) => Math.floor(now / WINDOW_MS)
/** 지금 6시간 칸이 끝날 때까지 남은 초(최소 60초) */
export const secondsUntilWindowEnd = (now = Date.now()) => Math.max(60, Math.round(((windowOf(now) + 1) * WINDOW_MS - now) / 1000))

/** 주소의 칸이 받을 만한지 — 지금 칸이나 바로 앞 칸만(시계가 조금 어긋나도 되게) */
export function checkQuery(searchParams, now = Date.now()) {
  const keys = [...searchParams.keys()]
  const allowed = new Set(['status', 'slot', 'bucket', 'win', 'rev', 'resolve', 'extra'])
  if (keys.some((k) => !allowed.has(k)) || new Set(keys).size !== keys.length) return { ok: false }
  // rev(채널 구성 판)는 6시간 칸 · 30분 칸과만 같이 — 그 밖에 두 칸을 같이 보내면 받지 않는다
  const main = keys.filter((k) => k !== 'rev')
  if (main.length > 1 || (keys.includes('rev') && !['win', 'bucket'].includes(main[0]))) return { ok: false }
  const rev = searchParams.has('rev') ? String(searchParams.get('rev')) : null
  if (searchParams.has('status')) return { ok: true, kind: 'status' }
  if (searchParams.has('resolve')) {
    const target = parseChannelInput(searchParams.get('resolve'))
    return target ? { ok: true, kind: 'resolve', target } : { ok: false }
  }
  if (searchParams.has('extra')) {
    const ids = String(searchParams.get('extra') ?? '').split(',').map((x) => x.trim()).filter(Boolean)
    const fine = ids.length >= 1 && ids.length <= MAX_EXTRA && new Set(ids).size === ids.length && ids.every((x) => /^UC[\w-]{22}$/.test(x))
    return fine ? { ok: true, kind: 'extra', ids } : { ok: false }
  }
  if (searchParams.has('win')) {
    const w = Number(searchParams.get('win'))
    const cur = windowOf(now)
    return Number.isInteger(w) && (w === cur || w === cur - 1) ? { ok: true, kind: 'window', rev } : { ok: false }
  }
  if (searchParams.has('bucket')) {
    const b = Number(searchParams.get('bucket'))
    const cur = bucketOf(now)
    return Number.isInteger(b) && (b === cur || b === cur - 1) ? { ok: true, kind: 'fresh', rev } : { ok: false }
  }
  if (searchParams.has('slot')) {
    const s = searchParams.get('slot')
    return s === slotOf(now) || s === slotOf(now - 86_400_000) ? { ok: true, kind: 'daily' } : { ok: false }
  }
  return { ok: true, kind: 'daily' }
}

/**
 * [채널 추가] 에 넣은 글 → 찾을 것. '@주소' · 'youtube.com/@주소' · 'youtube.com/channel/UC…' · 'UC…' · 'youtube.com/c/이름' · '주소'(@ 없이).
 * 알아볼 수 없으면 null(유튜브를 부르지 않는다).
 */
export function parseChannelInput(raw) {
  let s = String(raw ?? '').trim()
  if (!s || s.length > 200) return null
  try {
    s = decodeURIComponent(s)
  } catch {
    // 그대로
  }
  const id = /(?:^|\/channel\/)(UC[\w-]{22})(?:[/?#]|$)/.exec(s)
  if (id) return { id: id[1] }
  const h = /(?:^|youtube\.com\/|\s)@([^/?#\s]{2,100})/.exec(s)
  if (h) return { handle: `@${h[1]}` }
  const c = /youtube\.com\/(?:c|user)\/([^/?#\s]{2,100})/.exec(s)
  if (c) return { username: c[1] }
  if (/^[\w.\-가-힣]{2,100}$/.test(s)) return { handle: `@${s}` }
  return null
}

/** 'PT1H2M3S' → 3723 */
export function parseDuration(iso) {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(String(iso ?? ''))
  if (!m) return 0
  return Number(m[1] ?? 0) * 86400 + Number(m[2] ?? 0) * 3600 + Number(m[3] ?? 0) * 60 + Number(m[4] ?? 0)
}

const num = (v) => {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0
}

class QuotaError extends Error {}
class KeyError extends Error {}

/** 동시에 n개씩 */
async function pool(items, n, fn) {
  const out = new Array(items.length)
  let i = 0
  const run = async () => {
    while (i < items.length) {
      const k = i++
      out[k] = await fn(items[k], k)
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, run))
  return out
}

/** 로그인한 OS 사용자인가 — Supabase 로그인 토큰을 Supabase 에 물어본다(토큰을 저장하지 않는다) */
async function signedIn(req) {
  const raw = req.headers?.authorization ?? req.headers?.Authorization ?? ''
  const m = /^Bearer\s+([\w.-]{20,4096})$/.exec(String(raw))
  if (!m) return { ok: false, reason: 'login_required' }
  const base = envFirst(SUPA_URL_NAMES)
  const anon = envFirst(SUPA_ANON_NAMES)
  if (!base || !anon) return { ok: false, reason: 'no_auth_config' }
  try {
    const r = await fetch(`${base.replace(/\/$/, '')}/auth/v1/user`, { headers: { apikey: anon, Authorization: `Bearer ${m[1]}` } })
    if (!r.ok) return { ok: false, reason: 'login_required' }
    const u = await r.json().catch(() => null)
    return u && typeof u.id === 'string' && u.id ? { ok: true } : { ok: false, reason: 'login_required' }
  } catch {
    return { ok: false, reason: 'login_required' }
  }
}

/** 유튜브 부르기(할당량 세기 · 오류 갈래) */
function caller(key, signal) {
  const meter = { units: 0 }
  const call = async (path, params) => {
    meter.units += 1
    const qs = new URLSearchParams({ ...params, key: key.value })
    const r = await fetch(`${API}/${path}?${qs.toString()}`, { signal, headers: { Accept: 'application/json' } })
    let body = null
    try {
      body = await r.json()
    } catch {
      body = null
    }
    if (!r.ok) {
      const reason = String(body?.error?.errors?.[0]?.reason ?? '')
      const message = String(body?.error?.message ?? '')
      if (/quotaExceeded|dailyLimitExceeded|rateLimitExceeded/i.test(reason)) throw new QuotaError(reason)
      // 키 자체가 틀렸거나 막힌 것만 전체 실패 — 채널 하나의 '없음 · 비공개' 는 그 채널만 실패
      if (/keyInvalid|keyExpired|accessNotConfigured|ipRefererBlocked/i.test(reason) || /API key/i.test(message)) throw new KeyError(reason || String(r.status))
      throw new Error(`status_${r.status}`)
    }
    return body ?? {}
  }
  return { call, meter }
}

/** 채널 목록 → 채널 정보 + 채널마다 최근 영상(정해 둔 목록 · 대표가 더한 목록 같은 길) */
async function fetchFeed(list, call) {
  // 1) 핸들 → 채널 번호(핸들이 없으면 예전 사용자 이름으로 한 번 더)
  const failed = []
  const ids = await pool(list, POOL, async (ch) => {
    if (ch.id) return ch.id
    try {
      const a = await call('channels', { part: 'id', forHandle: ch.handle })
      if (a.items?.[0]?.id) return a.items[0].id
      const b = await call('channels', { part: 'id', forUsername: ch.handle.replace(/^@/, '') })
      if (b.items?.[0]?.id) return b.items[0].id
    } catch (e) {
      if (e instanceof QuotaError || e instanceof KeyError) throw e
    }
    failed.push(ch.handle)
    return null
  })
  const known = ids.filter(Boolean)
  if (known.length === 0) return { channels: [], videos: [], failed }

  // 2) 채널 정보 — 50곳씩 한 번에
  const byId = new Map()
  for (let k = 0; k < known.length; k += 50) {
    const info = await call('channels', { part: 'snippet,statistics,contentDetails', id: known.slice(k, k + 50).join(','), maxResults: '50' })
    for (const it of info.items ?? []) byId.set(it.id, it)
  }
  const channels = []
  const uploads = []
  list.forEach((ch, i) => {
    const id = ids[i]
    const it = id ? byId.get(id) : null
    if (!it) {
      if (id) failed.push(ch.handle ?? id)
      return
    }
    const sn = it.snippet ?? {}
    const st = it.statistics ?? {}
    channels.push({
      id,
      handle: ch.handle ?? sn.customUrl ?? '',
      title: String(sn.title ?? ch.name ?? '').slice(0, 80),
      customUrl: String(sn.customUrl ?? '').slice(0, 80),
      thumb: String(sn.thumbnails?.default?.url ?? '').slice(0, 300),
      subs: num(st.subscriberCount),
      videoCount: num(st.videoCount),
      views: num(st.viewCount),
      mine: !!ch.mine,
      ...(ch.group ? { group: ch.group } : {}),
      ...(ch.note ? { note: String(ch.note).slice(0, 120) } : {}),
    })
    const up = it.contentDetails?.relatedPlaylists?.uploads
    if (up) uploads.push({ id, up, label: ch.handle ?? id })
  })

  // 3) 채널마다 최근 영상 50편 → 4) 영상 정보 한 번에
  const lists = await pool(uploads, POOL, async (u) => {
    try {
      const pl = await call('playlistItems', { part: 'contentDetails', playlistId: u.up, maxResults: String(PER_CHANNEL) })
      const vids = (pl.items ?? []).map((x) => x.contentDetails?.videoId).filter(Boolean).slice(0, PER_CHANNEL)
      if (vids.length === 0) return []
      const v = await call('videos', { part: 'snippet,statistics,contentDetails', id: vids.join(','), maxResults: '50' })
      return (v.items ?? []).map((it) => ({
        id: String(it.id ?? ''),
        ch: u.id,
        t: String(it.snippet?.title ?? '').slice(0, 200),
        at: String(it.snippet?.publishedAt ?? ''),
        d: parseDuration(it.contentDetails?.duration),
        v: num(it.statistics?.viewCount),
        l: num(it.statistics?.likeCount),
        c: num(it.statistics?.commentCount),
      }))
    } catch (e) {
      if (e instanceof QuotaError || e instanceof KeyError) throw e
      failed.push(u.label)
      return []
    }
  })
  return { channels, videos: lists.flat().filter((x) => x.id && x.at), failed }
}

const fail = (res, status, body) => {
  res.setHeader('Cache-Control', 'no-store')
  res.status(status).json(body)
}

export default async function handler(req, res) {
  const url = new URL(req.url || '/', 'http://localhost')
  const q = checkQuery(url.searchParams)
  const key = keyFromEnv()

  if (!q.ok) return fail(res, 400, { error: 'bad_query' })
  // 유튜브를 부르지 않는다(할당량 0) — 화면은 이것으로 저장해 둔 데이터의 채널 구성 판이 지금과 같은지 본다
  if (q.kind === 'status') return fail(res, 200, { configured: !!key, keyName: key ? key.name : null, channels: CHANNELS.length, feedRevision: FEED_REVISION })
  // 화면이 아는 판이 지금과 다르다(그사이 배포로 채널 구성이 바뀜) — 유튜브를 부르지 않고 지금 판만 알려 준다
  if (q.rev !== undefined && q.rev !== null && q.rev !== FEED_REVISION) return fail(res, 409, { error: 'revision', feedRevision: FEED_REVISION })
  if (!key) return fail(res, 503, { error: 'no_key', message: '유튜브 API 키가 서버 환경변수에 없습니다(YOUTUBE_API_KEY).' })
  // 값이 정해져 있지 않은 두 갈래는 로그인한 사람만 — 남이 주소를 바꿔 가며 할당량을 쓰지 못하게
  if (q.kind === 'resolve' || q.kind === 'extra') {
    const who = await signedIn(req)
    if (!who.ok) return fail(res, who.reason === 'no_auth_config' ? 503 : 401, { error: who.reason })
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 25_000)
  const { call, meter } = caller(key, controller.signal)

  try {
    if (q.kind === 'resolve') {
      const t = q.target
      let it = null
      if (t.id) it = (await call('channels', { part: 'snippet,statistics', id: t.id })).items?.[0] ?? null
      else if (t.handle) {
        it = (await call('channels', { part: 'snippet,statistics', forHandle: t.handle })).items?.[0] ?? null
        if (!it) it = (await call('channels', { part: 'snippet,statistics', forUsername: t.handle.replace(/^@/, '') })).items?.[0] ?? null
      } else if (t.username) it = (await call('channels', { part: 'snippet,statistics', forUsername: t.username })).items?.[0] ?? null
      if (!it) return fail(res, 404, { error: 'not_found', units: meter.units })
      const sn = it.snippet ?? {}
      const st = it.statistics ?? {}
      return fail(res, 200, {
        channel: {
          id: String(it.id ?? ''),
          handle: String(sn.customUrl ?? (t.handle || '')).slice(0, 80),
          title: String(sn.title ?? '').slice(0, 80),
          thumb: String(sn.thumbnails?.default?.url ?? '').slice(0, 300),
          subs: num(st.subscriberCount),
          videoCount: num(st.videoCount),
          already: CHANNELS.some((c) => c.id === it.id),
        },
        units: meter.units,
      })
    }

    if (q.kind === 'extra') {
      // 정해 둔 채널과 겹치는 번호는 빼고 부른다(두 번 부르지 않게)
      const list = q.ids.filter((id) => !CHANNELS.some((c) => c.id === id)).map((id) => ({ id }))
      const out = list.length ? await fetchFeed(list, call) : { channels: [], videos: [], failed: [] }
      return fail(res, 200, { fetchedAt: new Date().toISOString(), ...out, units: meter.units })
    }

    const { channels, videos, failed } = await fetchFeed(CHANNELS, call)
    if (channels.length === 0) throw new Error('no_channels')
    if (videos.length === 0) return fail(res, 502, { error: 'upstream_empty', failed })
    // 절반 넘게 실패하면 캐시하지 않는다(덜 받은 것이 하루 종일 보이지 않게)
    const degraded = failed.length > CHANNELS.length / 2
    res.setHeader(
      'Cache-Control',
      degraded
        ? 'no-store'
        : q.kind === 'fresh'
          ? `public, max-age=0, s-maxage=${BUCKET_MS / 1000}`
          : q.kind === 'window'
            ? `public, max-age=0, s-maxage=${secondsUntilWindowEnd()}, stale-while-revalidate=300`
            : `public, max-age=0, s-maxage=${secondsUntilNine()}, stale-while-revalidate=300`,
    )
    res.status(200).json({ fetchedAt: new Date().toISOString(), feedRevision: FEED_REVISION, channels, videos, failed, units: meter.units })
  } catch (e) {
    if (e instanceof QuotaError) fail(res, 429, { error: 'quota' })
    else if (e instanceof KeyError) fail(res, 502, { error: 'bad_key' })
    else fail(res, 504, { error: e && e.name === 'AbortError' ? 'timeout' : 'fetch_failed' })
  } finally {
    clearTimeout(timer)
  }
}
