/**
 * D-554 컨설팅 · AX 글 점검 — 대표가 정책자금 · 보증 · 인증 · 법인 세무 · AX 주제로 AI 결과를 크게 돌려 보고(대화 120회 · 생성 455건)
 * 규칙집에 더한 것(금지 목록 · 체크리스트). 규칙 계산이다(AI 아님).
 *
 *  - 금지 목록을 고쳐 넣으면 말(가산점 · 숫자 늘리기 · 승인률 · 지어낸 사례)은 줄었지만,
 *    그림(기관 로고 · 도장)과 영상 기획 제목의 % 는 거의 그대로였다 — 그래서 마지막에 사람이 고칠 곳을 화면이 먼저 짚는다.
 *  - 스레드 · 릴스 · 틱톡 점검(대표 채널) · 1주일치 롱폼 점검 · 홍보 글(경영컨설팅 업종) 받은 글 점검이 같은 표현을 쓴다.
 *  - 100% · 무조건 · 보장 · 마감 임박은 기존 점검(HYPE)이 이미 잡으므로 여기서는 겹치지 않게 뺀다.
 */

export type ConsultLevel = 'bad' | 'warn'
export interface ConsultLine {
  key: string
  level: ConsultLevel
  text: string
}

/** 수치 후킹 — 99% · 90%가 · N배 · 'N명 중 M명' · 승인률 · 통과율(부정형 · 비율형 포함). 100% 는 기존 점검이 잡는다 */
export const PCT_HOOK =
  /(?<!\d)9\d\s*%|\d+\s*명\s*중\s*\d+\s*명|\d+(?:\.\d+)?\s*배(?=\s|[,.!?)」"'’]|$|로|나|씩|까지|가|는|의|차이|빠르|높|많|늘|더)|(?:승인|통과|선정|합격)\s*률|(?:승인|선정|합격)\s*확률/

/** 받은 숫자 늘려 말하기 — '250건 이상 · 넘게 · 수백 건 · 100억 넘게 · 9년 넘게' */
export const INFLATE = /\d[\d,]*\s*(?:건|억|곳|명|개사)\s*(?:이상|넘게|넘는|넘어|여\s*(?:건|곳|명)?|가\s*넘|이\s*넘)|\d+\s*년\s*(?:넘게|이\s*넘)|수백\s*(?:건|곳|명|개사)/

/** 받은 숫자 뜻 좁히기 — '250건의 연구소 상담' · '250건의 성장 사례' */
export const NARROWED = /\d[\d,]*\s*건의\s*[가-힣A-Za-z ]{1,10}(?:상담|사례|컨설팅|승인)/

/** 기관 일을 대신해 주는 것처럼 들리는 말 — 심사 대응 · 담당자 동행 · 대행 */
export const PROXY_WORK = /심사\s*대응|동행|대행/

/** 성공보수 · 승인 후 수수료 */
export const SUCCESS_FEE = /성공\s*보수|성과\s*보수|승인\s*(?:후|뒤|되면)[^\n]{0,8}(?:수수료|비용|보수)/

/** 시간 압박 — 연말 · 예산 소진(마감 임박은 기존 점검이 잡는다) */
export const TIME_PRESSURE = /연말(?:\s*전|까지|이\s*지나|\s*안에|\s*되면)|예산\s*(?:소진|이\s*(?:떨어|바닥)|다\s*쓰)|곧\s*마감/

/** 이미지 · 장면 지시의 기관 로고 · 인증 마크 · 도장 · 공문 모양 */
export const LOGO_STAMP =
  /(?:기관|중진공|소진공|신보|기보|신용\s*보증|기술\s*보증|정부|공공|인증|이노비즈|메인비즈|벤처|중기부|은행|협회)[^\n]{0,12}(?:로고|마크)|도장|직인|스탬프|공문\s*(?:모양|양식|느낌)/

/** 지어낸 사례 — '실제로 한 대표님은' · 'A사' · '확정서' */
export const MADE_CASE = /한\s*대표님[은이께]|(?<![A-Za-z])[A-Z]사(?=[\s,.은는이가의를에도와]|$)|확정서/

/** 도구가 지어내는 요건 · 기준 — '신용 6등급이면 탈락' · '업력 1년 이상' · '부채비율 400%' */
export const MADE_CRITERIA = /신용\s*(?:등급\s*)?\d+\s*등급|\d+\s*등급\s*(?:이상|이하|이면)|업력\s*\d+\s*년\s*(?:이상|미만|넘)|부채\s*비율\s*\d+\s*%|신용\s*점수\s*\d{3}\s*점/

/** 다른 업체를 겨냥한 말 */
export const RIVAL = /\d+\s*%\s*(?:가\s*)?사기|사기(?:입니다|예요|일\s*확률)|(?:무조건|100\s*%)\s*(?:해\s*준다|받게\s*해\s*준다|된다)는\s*곳/

/** AX 를 심사 이점으로 키우기 · 인증 · 보험처럼 말하기 */
export const AX_INFLATE =
  /(?:AX|업무\s*자동화)[^\n]{0,40}(?:심사(?:에서)?\s*유리|유리하게\s*작용|좋은\s*평가|차별화|눈에\s*띄게\s*만들어|가산|가점|승인\s*(?:률|확률|가능성))|AX\s*(?:인증|자격|보험)|AX\s*(?:를\s*)?받(?:으면|고\s)/

/** 컨설팅 · AX 글 점검 — 걸린 것만(통과 줄 없음) */
export function consultLint(text: string): ConsultLine[] {
  const out: ConsultLine[] = []
  if (!text.trim()) return out
  const hit = (re: RegExp) => re.exec(text)?.[0]?.trim() ?? ''
  const add = (key: string, level: ConsultLevel, msg: string) => out.push({ key, level, text: msg })
  const pct = hit(PCT_HOOK)
  if (pct) add('pct-hook', 'bad', `"${pct}" — 수치 후킹(99% · 10명 중 8명 · N배 · 승인률)은 쓰지 않아요. "모르고 신청하면 손해 봅니다" · "부결된 회사에서 자주 보이는 것" 처럼`)
  const inflate = hit(INFLATE)
  if (inflate) add('inflate', 'bad', `"${inflate}" — 받은 숫자는 그대로(이상 · 넘게 · 수백을 붙이지 않기)`)
  const narrowed = hit(NARROWED)
  if (narrowed) add('narrowed', 'warn', `"${narrowed}" — 숫자의 뜻을 좁히지 않았는지 봐요(받은 뜻 그대로)`)
  const proxy = hit(PROXY_WORK)
  if (proxy) add('proxy', 'bad', `"${proxy}" — 기관 일을 대신해 주는 말 대신 "예상 질문 준비" · "신청 전 점검"`)
  const fee = hit(SUCCESS_FEE)
  if (fee) add('success-fee', 'bad', `"${fee}" — 성공보수 · 승인 후 수수료 이야기는 쓰지 않아요`)
  const press = hit(TIME_PRESSURE)
  if (press) add('pressure', 'warn', `"${press}" — 연말 · 예산 소진 같은 시간 압박은 빼요`)
  const logo = hit(LOGO_STAMP)
  if (logo) add('logo', 'bad', `"${logo}" — 이미지 · 장면에 기관 로고 · 인증 마크 · 도장 · 공문 모양은 넣지 않아요. 사람 · 서류 · 실제 화면으로`)
  const made = hit(MADE_CASE)
  if (made) add('made-case', 'warn', `"${made}" — 지어낸 사례일 수 있어요. 사실 목록에 있는 실제 사례가 아니면 빼요`)
  const crit = hit(MADE_CRITERIA)
  if (crit) add('criteria', 'warn', `"${crit}" — 확인 안 된 기준 · 요건일 수 있어요. "기관 공고 확인" 으로 쓰거나 공고 원문으로 확인해요`)
  const rival = hit(RIVAL)
  if (rival) add('rival', 'bad', `"${rival}" — 다른 업체를 겨냥한 말 대신 우리 방식만 말해요`)
  const ax = hit(AX_INFLATE)
  if (ax) add('ax-inflate', 'bad', `"${ax}" — AX 는 업무 자동화 시스템이에요(인증 · 보험 · 심사 이점 아님). 자금 · 인증 글에는 넣지 않고 따로 써요`)
  return out
}

/** 사람이 마지막에 볼 칸(발행 전 확인) — 화면 · 복사 글에 그대로 */
export const CONSULT_CHECKS: readonly string[] = [
  '□ 이미지 · 장면 · 썸네일 지시에 기관 로고 · 인증 마크 · 도장 · 공문 모양이 없다(사람 · 서류 · 화면으로)',
  '□ 제목 · 첫마디에 "99% · 90%가 모르는 · 10명 중 8명 · N배 · 승인률" 같은 수치 후킹이 없다',
  '□ 경력 · 건수 · 금액이 받은 그대로다("이상 · 넘게 · 수백" 이나 뜻을 좁힌 말이 없다)',
  '□ "한 대표님은 …" · "A사" · "확정서" 같은 지어낸 사례 · 금액이 없다',
  '□ 가산점 · 성공보수 · "동행 · 대행 · 심사 대응" 같은 말이 없다',
  '□ 제도 숫자(한도 · 감면율 · 기간 · 요건)는 공고 원문으로 확인했다',
  '□ AX 는 업무 자동화로만 나온다(인증 · 자금 수단 아님) — 자금 글에 엮었다면 괄호 문장을 붙였다',
  '□ 많이 보이게 할 글이면 끝에 진단 · 상담 안내가 없다',
  '□ 글자 수 · 키워드 횟수는 AI 가 적은 값 말고 직접 셌다',
]
