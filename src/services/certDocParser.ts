/**
 * 인증서 · 확인서 · 인정서 읽기 (D-129) — 서류에서 회사 기본 정보로.
 *
 * 연구개발전담부서 인정서를 올리면 "연구개발전담부서 — 인정번호 · 인정일 · 인정기관" 을 찾아
 * 회사 기본 정보의 '인증서' 묶음에 넣자고 **제안**한다(확정은 대표가).
 *
 * 규칙 계산이다(외부 호출 없음). 제목 · 라벨 뒤의 값만 읽고, 못 읽은 것은 비운다 — 짐작하지 않는다.
 * 순수 함수. 단위 시험으로 고정한다.
 */

import { parseKoreanDate } from './koreanDocParser'

export interface ParsedCertificate {
  /** 인증 이름 — 회사 기본 정보 칸 이름으로 쓴다('연구개발전담부서') */
  name: string
  /** 인정 · 확인 · 인증 · 등록 번호 */
  number: string
  /** 인정일 · 확인일 · 인증일 · 등록일 (YYYY-MM-DD) */
  date: string
  /** 유효기간 끝 (YYYY-MM-DD) */
  validUntil: string
  /** 인정기관 · 발급기관 */
  issuer: string
  /** 번호 · 날짜 앞에 붙는 말('인정' · '확인' · '인증' · '등록') */
  verb: string
}

/** 알아보는 인증 — 제목 글자(느슨하게) → 칸 이름 · 동사 */
const KINDS: { re: RegExp; name: string; verb: string }[] = [
  { re: /연구\s*개발\s*전담\s*부서/, name: '연구개발전담부서', verb: '인정' },
  { re: /기업\s*부설\s*연구소/, name: '기업부설연구소', verb: '인정' },
  { re: /벤처\s*기업\s*확인/, name: '벤처기업', verb: '확인' },
  { re: /이노\s*비즈|기술\s*혁신형\s*중소기업/, name: '이노비즈', verb: '확인' },
  { re: /메인\s*비즈|경영\s*혁신형\s*중소기업/, name: '메인비즈', verb: '확인' },
  { re: /여성\s*기업\s*확인/, name: '여성기업', verb: '확인' },
  { re: /뿌리\s*기업\s*확인/, name: '뿌리기업', verb: '확인' },
  { re: /소재\s*[·ㆍ.]?\s*부품\s*(?:·\s*장비\s*)?전문\s*기업/, name: '소재부품장비 전문기업', verb: '확인' },
  { re: /중소\s*기업\s*(?:\(소상공인\)\s*)?확인서/, name: '중소기업 확인', verb: '확인' },
  { re: /ISO\s*9001/i, name: 'ISO 9001', verb: '인증' },
  { re: /ISO\s*14001/i, name: 'ISO 14001', verb: '인증' },
  { re: /ISO\s*45001/i, name: 'ISO 45001', verb: '인증' },
  { re: /녹색\s*(?:기술|인증)/, name: '녹색인증', verb: '인증' },
  { re: /특\s*허\s*증/, name: '특허', verb: '등록' },
]

/** 알려진 발급기관 — 라벨이 없을 때 본문에서 찾는다 */
const ISSUERS = [
  '한국산업기술진흥협회',
  '중소벤처기업부',
  '벤처기업협회',
  '기술보증기금',
  '중소기업기술정보진흥원',
  '한국여성경제인협회',
  '특허청',
  '한국경영혁신중소기업협회',
  '한국산업기술진흥원',
  '산업통상자원부',
]

function firstDate(s: string): string {
  const m = /(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*일?/.exec(s)
  return m ? (parseKoreanDate(m[0]) ?? '') : ''
}

/** 한 서류에서 인증 하나 — 모르는 서류면 null */
export function parseCertificateDocument(raw: string): ParsedCertificate | null {
  const text = (raw ?? '').replace(/\r/g, '')
  if (text.replace(/\s/g, '').length < 10) return null
  const kind = KINDS.find((k) => k.re.test(text))
  if (!kind) return null

  // 번호 — '인정번호 : 2024123456' · '확인번호 제 20240101-01 호' · '특허 제 10-1234567 호' · '인증번호 KR-QMS-123'
  let number = ''
  const labeled = /(?:인정|확인|인증|등록|지정|관리)\s*번\s*호\s*[:：]?\s*(?:제\s*)?([A-Za-z0-9][A-Za-z0-9_/.-]{2,30})/.exec(text)
  if (labeled) number = labeled[1]
  if (!number) {
    const je = /제\s*([0-9][0-9-]{3,20})\s*호/.exec(text)
    if (je) number = je[1]
  }
  number = number.replace(/[.-]+$/, '')

  // 날짜 — 라벨 뒤 날짜 먼저
  let date = ''
  const dl = /(?:인정|확인|인증|등록|지정)\s*(?:일|일자|연월일)\s*[:：]?\s*([^\n]{6,24})/.exec(text)
  if (dl) date = firstDate(dl[1])
  let validUntil = ''
  const vl = /유\s*효\s*기\s*간\s*[:：]?\s*([^\n]{6,60})/.exec(text)
  if (vl) {
    const dates = [...vl[1].matchAll(/(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/g)].map((m) => parseKoreanDate(m[0]) ?? '').filter(Boolean)
    if (dates.length >= 2) {
      if (!date) date = dates[0]
      validUntil = dates[dates.length - 1]
    } else if (dates.length === 1) validUntil = dates[0]
  }

  // 기관 — 라벨 → 알려진 기관 이름
  let issuer = ''
  const il = /(?:인정|확인|발급|인증|발행)\s*기\s*관\s*[:：]?\s*([가-힣A-Za-z()·\s]{2,30})/.exec(text)
  if (il) issuer = il[1].trim().split(/\s{2,}|\n/)[0].trim()
  if (!issuer) issuer = ISSUERS.find((n) => text.replace(/\s/g, '').includes(n)) ?? ''

  if (!number && !date && !issuer) return { name: kind.name, number: '', date: '', validUntil: '', issuer: '', verb: kind.verb }
  return { name: kind.name, number, date, validUntil, issuer, verb: kind.verb }
}

/** 회사 기본 정보 한 칸의 값 — '인정번호 2024-1234 · 인정일 2024-03-05 · 한국산업기술진흥협회' */
export function certificateValue(c: ParsedCertificate): string {
  const parts = [
    c.number ? `${c.verb}번호 ${c.number}` : '',
    c.date ? `${c.verb}일 ${c.date}` : '',
    c.validUntil ? `${c.validUntil}까지` : '',
    c.issuer,
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : '있음'
}
