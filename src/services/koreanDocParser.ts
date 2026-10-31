/**
 * 한국 기업 서류(사업자등록증·법인등기부등본)에서 기본 정보를 뽑아내는 파서.
 *
 * 입력은 "글자"다. PDF 텍스트 추출·이미지 OCR·직접 붙여넣기 어디서 왔든
 * 동일하게 처리한다. 순수 함수이므로 단위 테스트로 검증한다.
 *
 * OCR 결과는 깨질 수 있으므로, 확신이 서는 항목만 돌려주고 나머지는 비운다.
 * (잘못된 값을 자동으로 채우는 것보다 비워두는 편이 안전하다.)
 */

import { readBusinessNumber } from './bizNoRead'

export { readBusinessNumber }

export type DocSource = 'business_registration' | 'corporate_registry' | 'unknown'

export interface ParsedCompanyInfo {
  source: DocSource
  companyName?: string
  businessNumber?: string
  corporateNumber?: string
  representativeName?: string
  /** YYYY-MM-DD */
  representativeBirth?: string
  /** 개업연월일 / 회사성립연월일 — YYYY-MM-DD */
  establishedAt?: string
  address?: string
  /** 업태 */
  businessCategory?: string
  /** 종목 — 대표 종목 하나 */
  businessItem?: string
  /** 대표 종목을 뺀 나머지 종목들 (' · ' 로 이음). 버리지 않되 화면 앞에 두지 않는다 */
  businessItemsExtra?: string
}

/* ------------------------------------------------------------------ */
/* 공통 유틸                                                            */
/* ------------------------------------------------------------------ */

/** OCR 흔한 오인식 보정 + 공백 정리 */
function normalize(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/[〇○]/g, '0')
    .replace(/[ \t ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim()
}

/** 숫자만 남긴다 */
function digits(s: string): string {
  return s.replace(/[^0-9]/g, '')
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** 'YYYY년 MM월 DD일' / 'YYYY-MM-DD' / 'YYYY.MM.DD' → YYYY-MM-DD */
export function parseKoreanDate(input: string): string | undefined {
  const s = input.trim()
  let m = /(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/.exec(s)
  if (!m) m = /(\d{4})\s*[.\-/]\s*(\d{1,2})\s*[.\-/]\s*(\d{1,2})/.exec(s)
  if (!m) {
    const d = digits(s)
    if (d.length === 8) m = [s, d.slice(0, 4), d.slice(4, 6), d.slice(6, 8)] as unknown as RegExpExecArray
  }
  if (!m) return undefined
  const y = Number(m[1])
  const mo = Number(m[2])
  const da = Number(m[3])
  if (y < 1900 || y > 2200 || mo < 1 || mo > 12 || da < 1 || da > 31) return undefined
  return `${y}-${pad2(mo)}-${pad2(da)}`
}

/** 주민등록번호 앞 6자리 → 생년월일 (성별코드로 세기 판별) */
export function birthFromRrnPrefix(prefix6: string, genderCode?: string): string | undefined {
  const d = digits(prefix6)
  if (d.length !== 6) return undefined
  const yy = Number(d.slice(0, 2))
  const mm = Number(d.slice(2, 4))
  const dd = Number(d.slice(4, 6))
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return undefined
  let century = 1900
  if (genderCode === '3' || genderCode === '4' || genderCode === '7' || genderCode === '8') century = 2000
  else if (genderCode === '9' || genderCode === '0') century = 1800
  return `${century + yy}-${pad2(mm)}-${pad2(dd)}`
}

/** 000-00-00000 형식으로 정리 */
export function formatBusinessNumber(raw: string): string | undefined {
  const d = digits(raw)
  if (d.length !== 10) return undefined
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`
}

/** 000000-0000000 형식으로 정리 */
export function formatCorporateNumber(raw: string): string | undefined {
  const d = digits(raw)
  if (d.length !== 13) return undefined
  return `${d.slice(0, 6)}-${d.slice(6)}`
}

/*
 * 값에서 뒤따르는 라벨을 잘라낸다 (한 줄에 여러 항목이 붙어 나오는 경우).
 *
 * 국세청 사업자등록증은 라벨을 "본 점 소 재 지" 처럼 글자마다 띄어 인쇄한다.
 * 그래서 라벨은 글자 그대로 적어 두고, 비교할 때 글자 사이에 공백을 허용하는
 * 정규식으로 바꾼다. (예전에는 '본 ?점' 처럼 손으로 공백을 넣어 두었는데,
 * 글자마다 띄어진 실제 인쇄물과 맞지 않아 잘라내기가 통째로 실패했다.
 * 그 결과 주소 칸에 그 뒤의 '사업의 종류' 까지 다 딸려 들어왔다.)
 */
const LABELS = [
  '법인등록번호',
  '등록번호',
  '사업자등록번호',
  '상호',
  '법인명',
  '성명',
  '대표자',
  '대표이사',
  '개업연월일',
  '생년월일',
  '사업장소재지',
  '본점소재지',
  '본점',
  '소재지',
  '사업의종류',
  '업태',
  '종목',
  '발급사유',
  '발급기관',
  '공동사업자',
  '사업자단위과세',
  '전자세금계산서',
  '회사성립연월일',
  '교부일자',
  '주소',
]

/** '본점소재지' → /본\s*점\s*소\s*재\s*지/ — 글자마다 띄어 인쇄된 라벨도 잡는다 */
function spacedLabel(label: string): string {
  return label.split('').join('\\s*')
}

function cutAtNextLabel(value: string): string {
  let out = value
  for (const l of LABELS) {
    const re = new RegExp(`\\s*\\(?${spacedLabel(l)}\\)?\\s*[:：]`)
    const m = re.exec(out)
    if (m && m.index > 0) out = out.slice(0, m.index)
  }
  return out.trim()
}

/** 라벨 뒤의 값을 찾는다 (같은 줄 우선, 없으면 다음 줄) */
function valueAfter(text: string, labelPattern: string): string | undefined {
  const re = new RegExp(`${labelPattern}\\s*[:：]?\\s*(.*)`, 'm')
  const m = re.exec(text)
  if (!m) return undefined
  let v = cutAtNextLabel(m[1] ?? '')
  if (v === '') {
    // 값이 다음 줄에 있는 경우
    const after = text.slice((m.index ?? 0) + m[0].length)
    const next = after.split('\n').find((l) => l.trim() !== '')
    v = cutAtNextLabel(next ?? '')
  }
  // '(단체명) : 값' 처럼 라벨 조각이 앞에 남는 경우를 제거한다.
  // 단, 회사명 앞의 '(주)' 는 이름의 일부이므로 건드리지 않는다 — 쌍점이 뒤따르거나
  // 괄호 안이 라벨 낱말일 때만 지운다.
  v = v.replace(/^\s*\([^)]{0,12}\)\s*[:：]\s*/, '')
  v = v.replace(/^\s*\(\s*(?:단체명|법인명|상호|성명|대표자)\s*\)\s*/, '')
  v = v.replace(/^(소재지|성명|법인명|상호|단체명)\s*[:：]\s*/, '')
  v = v.replace(/^[)\]}·.-]+/, '').trim()
  return v === '' ? undefined : v
}

/* ------------------------------------------------------------------ */
/* 문서 종류 판별                                                       */
/* ------------------------------------------------------------------ */

/**
 * D-371 부동산(건물 · 토지 · 집합건물) 등기부 — 법인 등기부와 제목이 같다('등기사항전부증명서').
 * 예전에는 법인 등기부 칸에 '확실' 로 들어가 정책자금 준비 서류가 '법인 등기부 확보' 로 잘못 셌다.
 * 표제부 · 소유권 같은 부동산 표시가 있고 법인 등기부 표시(회사성립연월일 · 임원 · 1주의 금액 · 본점)가 없을 때만.
 */
export function looksLikeRealEstateRegistry(text: string): boolean {
  const t = normalize(text ?? '')
  if (/회사\s?성립\s?연월일|임원에\s?관한\s?사항|1\s?주의\s?금액|발행할\s?주식의\s?총수|본\s?점\s*[:：]?\s*\S/.test(t)) return false
  if (/등기사항\s?(?:전부|일부)?\s?증명서[^\n]{0,24}(?:건물|토지|집합\s?건물)/.test(t)) return true
  return [/표\s?제\s?부/, /(?:건물|토지)의\s?표시/, /소유권에\s?관한\s?사항/, /소재\s?지번/, /고유\s?번호/].filter((re) => re.test(t)).length >= 2
}

export function detectDocSource(text: string): DocSource {
  const t = normalize(text)
  if (looksLikeRealEstateRegistry(t)) return 'unknown'
  const count = (patterns: RegExp[]) => patterns.reduce((n, re) => n + (re.test(t) ? 1 : 0), 0)

  const registry = count([
    /등기사항전부증명서/,
    /말소사항\s?포함/,
    /등기기록/,
    /회사성립연월일/,
    /등기번호/,
    /공고방법/,
    /1주의\s?금액/,
    /임원에\s?관한\s?사항/,
    /대표이사/,
  ])
  const business = count([
    /사업자등록증/,
    /개업연월일/,
    /업\s?태\s*[:：]/,
    /종\s?목\s*[:：]/,
    /사업장소재지/,
    /법인명\s?\(단체명\)/,
    /교부일자/,
  ])

  if (registry === 0 && business === 0) return 'unknown'
  // 제목이 명시된 경우를 우선한다
  if (/사업자등록증/.test(t) && !/등기사항전부증명서/.test(t)) return 'business_registration'
  if (/등기사항전부증명서/.test(t) && !/사업자등록증/.test(t)) return 'corporate_registry'
  return registry > business ? 'corporate_registry' : 'business_registration'
}

/* ------------------------------------------------------------------ */
/* 파서                                                                 */
/* ------------------------------------------------------------------ */

/**
 * 사업자등록번호 (000-00-00000) — D-255: 국세청 검증 숫자가 맞는 번호만 돌려준다(bizNoRead).
 * 안 맞으면 비운다 — 후보 · 확실한지는 받는 쪽이 readBusinessNumber 로 따로 본다.
 */
function findBusinessNumber(t: string): string | undefined {
  return readBusinessNumber(t).value || undefined
}

/** 법인등록번호 검증 숫자 — 앞 12자리에 1 · 2 를 번갈아 곱한 합 → (10 - 합 % 10) % 10 */
export function corpNoChecksumOk(value: string): boolean {
  const d = digits(value).split('').map(Number)
  if (d.length !== 13) return false
  let sum = 0
  for (let i = 0; i < 12; i += 1) sum += d[i] * (i % 2 === 0 ? 1 : 2)
  return (10 - (sum % 10)) % 10 === d[12]
}

/** 사업자등록번호 가운데 두 자리로 본 사업자 종류(81~88 법인 · 01~79 · 90~99 개인) */
export function bizNoKind(bizNo: string | undefined): 'corp' | 'individual' | 'unknown' {
  const d = digits(bizNo ?? '')
  if (d.length !== 10) return 'unknown'
  const mid = Number(d.slice(3, 5))
  if (mid >= 81 && mid <= 88) return 'corp'
  if ((mid >= 1 && mid <= 79) || mid >= 90) return 'individual'
  return 'unknown'
}

/**
 * 법인등록번호 (000000-0000000).
 * D-210: 개인사업자 사업자등록증명의 '주민(법인)등록번호' 칸이나 이름표 없는 13자리는 **주민등록번호**일 수 있다 —
 * 예전에는 그대로 법인등록번호로 넣어 주민등록번호를 저장했다(절대 규칙 위반). 이제
 *  - '법인등록번호' 이름표 → 그대로
 *  - '주민(법인)등록번호' · 등기부 '등록번호' → 법인 서류(사업자번호 가운데 81~88 · 등기부)일 때만
 *  - 이름표 없는 13자리 → 법인 서류 + 법인번호 검증 숫자가 맞고 + 바로 앞이 사람 이름 · '주민' 이 아닐 때만
 */
function findCorporateNumber(t: string, source: DocSource, bizNo: string | undefined): string | undefined {
  const labeled = /법\s*인\s*등\s*록\s*번\s*호\s*[:：]?\s*(\d{6}\s*-\s*\d{7})/.exec(t)
  if (labeled) return formatCorporateNumber(labeled[1])
  const kind = bizNoKind(bizNo)
  const corpDoc = kind === 'corp' || (source === 'corporate_registry' && kind !== 'individual')
  if (!corpDoc) return undefined
  const mixed = /주\s*민\s*\(\s*법\s*인\s*\)\s*등\s*록\s*번\s*호\s*[:：]?\s*(\d{6}\s*-\s*\d{7})/.exec(t)
  if (mixed) return formatCorporateNumber(mixed[1])
  // 등기부 맨 위 '등기번호 012345  등록번호 110111-0123456' — 사업자 · 주민 등록번호 이름표는 아님
  const plain = /(?<![가-힣)]\s*)등\s*록\s*번\s*호\s*[:：]?\s*(\d{6}\s*-\s*\d{7})/.exec(t)
  if (plain && source === 'corporate_registry') return formatCorporateNumber(plain[1])
  const re = /\b(\d{6}\s*-\s*\d{7})\b/g
  let m: RegExpExecArray | null
  while ((m = re.exec(t)) !== null) {
    // 같은 줄 앞부분만 본다(윗줄 회사 이름을 사람 이름으로 읽지 않게)
    const before = t.slice(Math.max(0, m.index - 16, t.lastIndexOf('\n', m.index) + 1), m.index)
    const after = t.slice(m.index + m[0].length, m.index + m[0].length + 12).split('\n')[0]
    if (/주\s*민/.test(before)) continue
    // '홍길동 800101-1234567' · '800101-1234567 홍길동' — 사람 이름 옆의 13자리는 주민등록번호
    if (/[가-힣]{2,6}[ \t]*$/.test(before) && !/(번호|등록)[ \t]*[:：]?[ \t]*$/.test(before)) continue
    if (/^[ \t]*[가-힣]{2,4}(?:[ \t]|$)/.test(after)) continue
    if (corpNoChecksumOk(m[1])) return formatCorporateNumber(m[1])
  }
  return undefined
}

/** 회사명 */
function findCompanyName(t: string, source: DocSource): string | undefined {
  // 실제 인쇄물은 "법 인 명 ( 단 체 명 )" 처럼 글자마다 띄어 있다
  const nameInBracket = `${spacedLabel('법인명')}\\s*\\(?\\s*${spacedLabel('단체명')}\\s*\\)?`
  const patterns =
    source === 'corporate_registry'
      ? [spacedLabel('상호'), nameInBracket, spacedLabel('법인명'), spacedLabel('회사명')]
      : [
          nameInBracket,
          `${spacedLabel('상호')}\\s*\\(?\\s*${spacedLabel('법인명')}\\s*\\)?`,
          spacedLabel('상호'),
          spacedLabel('법인명'),
          spacedLabel('회사명'),
        ]
  for (const p of patterns) {
    const v = valueAfter(t, p)
    if (v && v.length >= 2 && v.length <= 60) return v
  }
  return undefined
}

/** 대표자 이름 */
function findRepresentative(t: string, source: DocSource): string | undefined {
  const patterns =
    source === 'corporate_registry'
      ? ['대\\s*표\\s*이\\s*사', '사내이사', '대\\s*표\\s*자']
      : ['성\\s*명\\s*\\(대표자\\)', '대\\s*표\\s*자\\s*\\(성명\\)', '성\\s*명', '대\\s*표\\s*자']
  for (const p of patterns) {
    const v = valueAfter(t, p)
    if (!v) continue
    // 이름만 남긴다 (뒤에 붙은 주민번호·주소 제거)
    const name = /^([가-힣]{2,6}|[A-Za-z][A-Za-z .]{1,40})/.exec(v.trim())
    if (name) return name[1].trim()
  }
  return undefined
}

/**
 * 대표자 생년월일 — 등기부의 '홍길동 801231-1******' 형태.
 * D-210: 등기부에는 이사 · 감사가 여럿 적힌다 — 예전에는 처음 나온 사람의 생년월일을 대표 것으로 넣었다.
 * 대표 이름을 알면 그 이름이 붙은 것만, 모르면 '대표' 가 붙은 줄의 것만 쓴다.
 */
function findRepresentativeBirth(t: string, repName: string | undefined): string | undefined {
  // 성별코드 뒤에 마스킹(*)이 오거나 6자리가 더 이어져야 주민등록번호로 본다.
  const re = /([가-힣]{2,6})\s+(\d{6})\s*[-–]\s*([1-8])(\*{4,7}|\d{6})/g
  let m: RegExpExecArray | null
  const found: { name: string; birth: string; line: string }[] = []
  while ((m = re.exec(t)) !== null) {
    // '법인등록번호 131111-0098765' 같은 항목은 이름이 아니므로 제외
    if (/번호$|번호\s*$/.test(m[1])) continue
    const b = birthFromRrnPrefix(m[2], m[3])
    if (!b) continue
    const lineStart = t.lastIndexOf('\n', m.index) + 1
    found.push({ name: m[1], birth: b, line: t.slice(lineStart, m.index) })
  }
  const mine = repName ? found.find((f) => f.name === repName) : found.find((f) => /대\s*표/.test(f.line))
  if (mine) return mine.birth
  // 사람이 한 명뿐이면 그 사람(개인사업자 등록증 · 대표만 적힌 서류)
  if (found.length === 1 && (!repName || found[0].name === repName)) return found[0].birth
  const labeled = valueAfter(t, '생\\s*년\\s*월\\s*일')
  return labeled ? parseKoreanDate(labeled) : undefined
}

/** 설립일 — 개업연월일(사업자등록증) 또는 회사성립연월일(등기부) */
function findEstablishedAt(t: string, source: DocSource): string | undefined {
  const keys =
    source === 'corporate_registry'
      ? ['회\\s*사\\s*성\\s*립\\s*연\\s*월\\s*일', '설\\s*립\\s*등\\s*기', '개업연월일']
      : ['개\\s*업\\s*연\\s*월\\s*일', '개\\s*업\\s*일(?!\\s*자)', '설\\s*립\\s*일', '회\\s*사\\s*성\\s*립\\s*연\\s*월\\s*일']
  for (const k of keys) {
    const v = valueAfter(t, k)
    if (!v) continue
    const d = parseKoreanDate(v)
    if (d) return d
  }
  return undefined
}

/**
 * 주소 — 본점 소재지를 먼저 찾는다.
 *
 * 사업자등록증에는 '사업장 소재지' 와 '본 점 소 재 지' 가 나란히 찍히고 보통 같은
 * 값이다. 다를 때 컨설팅에서 쓰는 것은 등기부상 본점이므로 그쪽을 먼저 본다.
 */
function findAddress(t: string, source: DocSource): string | undefined {
  const keys =
    source === 'corporate_registry'
      ? ['본점소재지', '본점', '주사무소', '소재지']
      : ['본점소재지', '사업장소재지', '사업장', '소재지', '주소']
  for (const k of keys) {
    const v = valueAfter(t, spacedLabel(k))
    if (v && v.length >= 5 && /[가-힣]/.test(v)) return v
  }
  return undefined
}

/**
 * 업태·종목 정리.
 *
 * 사업자등록증의 '사업의 종류' 는 표다. 업태 칸에 '제조업' 이 일곱 줄, 종목 칸에
 * 서로 다른 일곱 개가 들어간다. 그런데 PDF 에서 글자를 뽑으면 칸 단위로 이어
 * 붙어 한 줄이 된다 — "제조업 제조업 제조업 …" 과
 * "간판 및 광고물 제조업 구조용 금속 판제품 및 공작물 제조업 …".
 * 그대로 넣으면 화면이 문단으로 뒤덮인다.
 *
 * 업태: 같은 말이 반복되므로 중복을 없앤다 → "제조업"
 * 종목: 항목이 거의 예외 없이 '…업' 으로 끝나므로 그 경계로 나눈다.
 *       첫 항목이 대표 종목이고 나머지는 따로 보관한다(버리지 않는다).
 */
function splitIndustryItems(value: string): string[] {
  let flat = value.replace(/\s+/g, ' ').trim()
  // '사 업 의 종 류 : 업태 … 종목 …' 처럼 칸 제목에 쌍점이 없을 때가 있다.
  // 그때는 다음 칸 제목에서 끊어 준다(cutAtNextLabel 은 쌍점을 요구한다).
  flat = flat.replace(/\s*종\s*목\s.*$/, '').replace(/\s*\(\s*별\s*지.*$/, '')
  if (flat === '') return []
  // '…업' 으로 끝나는 덩어리를 차례로 떼어낸다
  const chunks = flat.match(/\S(?:.*?)업(?=\s|$)/g)
  const items = chunks && chunks.length > 0 ? chunks : [flat]
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of items) {
    const s = raw.trim()
    if (s === '' || seen.has(s)) continue
    seen.add(s)
    out.push(s)
  }
  return out
}

/**
 * D-344 홈택스 '사업자등록증명' — 사업자등록증과 같은 정보지만 표 모양이라 '이름표 값 이름표 값' 이 쌍점 없이 한 줄에 붙는다
 * ('상호(법인명) 가나테크 사업자등록번호 123-45-67890'). 예전에는 회사명에 번호까지 딸려 왔고 '개업일' 을 못 읽었다.
 * 맨 위 제목이 사업자등록증명일 때만 — 신청서 본문의 '사업자등록증명 1부' 같은 글은 아니다.
 */
export function isBizRegCertificate(text: string): boolean {
  return String(text || '')
    .split(/\r?\n/)
    .map((l) => l.replace(/[\s()（）\[\]·ㆍ.:：]/g, ''))
    .filter(Boolean)
    .slice(0, 10)
    .some((l) => /^사업자등록증명(?:원)?$/.test(l))
}

const CERT_LABELS = ['사업자등록번호', '주민(법인)등록번호', '법인등록번호', '성명(대표자)', '사업장소재지', '개업일', '사업자등록일', '업태', '종목', '공동사업자']

/** 사업자등록증명 — 줄 가운데 이름표 앞에서 줄을 나눠 '이름표 값' 한 줄씩으로 */
function certLines(t: string): string {
  let out = t
  for (const l of CERT_LABELS) {
    const pat = l.split('').map((ch) => ch.replace(/[()]/g, '\\$&')).join('\\s*')
    out = out.replace(new RegExp(`[ \\t]+(?=${pat}(?![가-힣]))`, 'g'), '\n')
  }
  return out
}

/** 파싱 본체 */
export function parseKoreanBusinessDocument(raw: string): ParsedCompanyInfo {
  const t0 = normalize(raw)
  const t = isBizRegCertificate(t0) ? certLines(t0) : t0
  const source = detectDocSource(t)

  const out: ParsedCompanyInfo = { source }
  const set = <K extends keyof ParsedCompanyInfo>(k: K, v: ParsedCompanyInfo[K] | undefined) => {
    if (v !== undefined && v !== '') out[k] = v
  }

  set('companyName', findCompanyName(t, source))
  const bizNo = findBusinessNumber(t)
  set('businessNumber', bizNo)
  set('corporateNumber', findCorporateNumber(t, source, bizNo))
  const rep = findRepresentative(t, source)
  set('representativeName', rep)
  set('representativeBirth', findRepresentativeBirth(t, rep))
  set('establishedAt', findEstablishedAt(t, source))
  set('address', findAddress(t, source))

  const categories = splitIndustryItems(valueAfter(t, spacedLabel('업태')) ?? '')
  set('businessCategory', categories.join(' · '))

  const items = splitIndustryItems(valueAfter(t, spacedLabel('종목')) ?? '')
  set('businessItem', items[0])
  set('businessItemsExtra', items.slice(1).join(' · '))

  return out
}

/** 사람이 읽는 항목 이름 */
export const PARSED_FIELD_LABEL: Record<keyof Omit<ParsedCompanyInfo, 'source'>, string> = {
  companyName: '회사명',
  businessNumber: '사업자등록번호',
  corporateNumber: '법인등록번호',
  representativeName: '대표자 이름',
  representativeBirth: '대표자 생년월일',
  establishedAt: '설립일(개업일)',
  address: '주소',
  businessCategory: '업태',
  businessItem: '종목',
  businessItemsExtra: '종목(그 외)',
}

export const DOC_SOURCE_LABEL: Record<DocSource, string> = {
  business_registration: '사업자등록증',
  corporate_registry: '법인등기부등본',
  unknown: '문서 종류를 알 수 없음',
}
