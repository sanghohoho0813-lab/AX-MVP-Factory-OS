/**
 * D-476 다른 회사 서류 가려내기 — 대표 "서류는 대충 올려도 알아서".
 *
 * 폴더째 올리면 다른 고객사의 사업자등록증 · 납세증명서가 섞일 수 있다. 예전에는 비어 있던 대표자 · 주소 · 업태 칸에 그 회사 값이 말없이 들어가고,
 * 납세증명서 칸에 들어가 정책자금 '체납 없음' 근거로도 쓰였다.
 *  - 서류 주인의 번호가 적힌 서류(사업자등록증 · 사업자등록증명 · 납세증명서 · 완납증명서 · 확인서 · 인정서 · 홈택스 증명)만 본다.
 *  - 확실하게 읽힌 사업자등록번호(글 PDF 는 번호 하나 · 스캔은 두 번 읽어 같음 · 검증 숫자 맞음)가 이 업체 번호와 다르고,
 *    글 어디에도 이 업체 번호가 없을 때만 '다른 회사 서류' 로 본다(계약서처럼 두 회사가 같이 적힌 서류는 그대로).
 *  - 이 업체 번호: 업체 기록의 번호(검증 숫자 맞음) — 없으면 이번 묶음의 사업자등록증 가운데 이름이 이 업체와 맞는 것 하나.
 * 규칙 계산 — 외부 호출 없음.
 */
import { bizNoChecksumOk, formatBizNoDigits, readBusinessNumber } from './bizNoRead'
import { isBizRegCertificate, parseKoreanBusinessDocument } from './koreanDocParser'

/** 회사 이름 · 번호 · 대표자 · 주소가 같이 적힌 증명서 · 확인서(사업자등록증 · 등기부 말고) — D-475 맞춰 보기 · D-476 다른 회사 가려내기 */
export const ID_CERT_RE =
  /납\s*세\s*증\s*명|완\s*납\s*증\s*명|중\s*소\s*기\s*업\s*(?:\(\s*소\s*상\s*공\s*인\s*\)\s*)?확\s*인|소\s*상\s*공\s*인\s*확\s*인|벤\s*처\s*기\s*업\s*확\s*인|이\s*노\s*비\s*즈|메\s*인\s*비\s*즈|여\s*성\s*기\s*업\s*확\s*인|연\s*구\s*(?:소|개\s*발\s*전\s*담\s*부\s*서)\s*인\s*정|과\s*세\s*표\s*준\s*증\s*명|소\s*득\s*금\s*액\s*증\s*명|표\s*준\s*재\s*무\s*제\s*표\s*증\s*명/

const BIZ_REG_TITLE = /사\s*업\s*자\s*등\s*록\s*증/

export interface ForeignDoc {
  /** 서류에 적힌 번호(000-00-00000) */
  no: string
  /** 서류에 적힌 회사 이름(못 읽으면 '') */
  name: string
}

interface DocLike {
  key: string
  text: string
  /** 'ocr' 이면 스캔 — 번호는 두 번 읽어 같아야 확실(번호 다시 읽기 줄이 없어도) */
  method?: string
}

const digits = (v: string) => v.replace(/\D/g, '')

function companyKey(name: string): string {
  return name
    .replace(/\(\s*주\s*\)|㈜|주식회사|\(\s*유\s*\)|유한회사/g, '')
    .replace(/\s+/g, '')
    .toLowerCase()
}

/** 서류 주인의 번호가 적힌 서류인가 */
function namesHolder(doc: DocLike): boolean {
  const head = doc.text.slice(0, 600)
  return doc.key === 'businessRegistration' || isBizRegCertificate(doc.text) || BIZ_REG_TITLE.test(head) || ID_CERT_RE.test(head)
}

/** 확실하게 읽힌 서류 주인의 번호(숫자 10자리) — 모르면 '' */
function holderNo(doc: DocLike): string {
  if (!namesHolder(doc)) return ''
  const r = readBusinessNumber(doc.text, doc.method === 'ocr' ? { scanned: true } : {})
  const d = digits(r.value)
  return r.sure && d.length === 10 && bizNoChecksumOk(d) ? d : ''
}

/** 이 업체 사업자등록번호(숫자 10자리) — 업체 기록 · 없으면 이번 묶음 사업자등록증 가운데 이름이 맞는 것 하나 · 모르면 '' */
export function companyNoAnchor(record: { businessNumber: string; companyName: string }, docs: readonly DocLike[]): string {
  const own = digits(record.businessNumber)
  if (own.length === 10 && bizNoChecksumOk(own)) return own
  const mine = companyKey(record.companyName)
  if (!mine) return ''
  const found = new Set<string>()
  for (const d of docs) {
    if (!(d.key === 'businessRegistration' || isBizRegCertificate(d.text) || BIZ_REG_TITLE.test(d.text.slice(0, 600)))) continue
    const no = holderNo(d)
    const name = companyKey(parseKoreanBusinessDocument(d.text).companyName ?? '')
    if (no && name && (name.includes(mine) || mine.includes(name))) found.add(no)
  }
  return found.size === 1 ? [...found][0] : ''
}

/**
 * 이 서류가 다른 회사 것인가 — 아니면 null.
 * 서류의 회사 이름이 이 업체 이름과 같으면(띄어쓰기 · (주) 빼고) 다른 회사로 보지 않는다 — 업체 번호를 잘못 적어 둔 것일 수 있어 예전처럼 '어느 쪽이 맞나요' 로 묻는다.
 */
export function foreignDocOf(doc: DocLike, anchor: string, companyName = ''): ForeignDoc | null {
  if (anchor.length !== 10) return null
  const no = holderNo(doc)
  if (!no || no === anchor) return null
  if (digits(doc.text).includes(anchor)) return null
  const name = (parseKoreanBusinessDocument(doc.text).companyName ?? '').replace(/\s+/g, ' ').trim().slice(0, 30)
  if (name && companyName && companyKey(name) === companyKey(companyName)) return null
  return { no: formatBizNoDigits(no), name }
}

/** 화면 한 줄 */
export function foreignDocNote(fileName: string, f: ForeignDoc, anchor: string): string {
  return `${fileName}: 다른 회사(${f.name ? `${f.name} · ` : ''}${f.no}) 서류 같아 회사 정보에 쓰지 않았어요(이 업체 ${formatBizNoDigits(anchor)}). 다른 회사 것이면 서류 탭에서 지워 주세요.`
}
