/**
 * D-381 대표 개인 신용점수 조회서(NICE 지키미 · KCB 올크레딧 · 은행 신용정보 조회) → 정책자금 판정의 '대표 신용' 칸.
 *
 * 정책자금 1차 심사의 첫 질문이 대표 신용점수인데, 업체 기록으로 판정할 때는 늘 '미확인' 이라
 * 엔진이 '대표 신용 미확인 — 조회 전까지 접근 상품이 갈립니다' 를 붙이고 가능성을 깎았다.
 *  - '신용점수 · 신용평점' 바로 뒤의 점수(1~999점)만 읽는다. '1,000점 만점' · 날짜 · 번호는 점수가 아니다.
 *  - NICE · KCB 가 함께 있으면 둘 다 남기고, 판정에는 낮은 쪽(기관마다 보는 곳이 달라 보수적으로).
 *  - 조회서의 다른 내용(대출 · 연체 · 주민등록번호)은 남기지 않는다. 규칙 계산 — 외부 호출 없음.
 */
import type { CreditBand } from '../tools/policyFunding/types'

export interface CreditScoreRead {
  scores: { bureau: 'NICE' | 'KCB' | null; score: number }[]
}

const BUREAU = /NICE|나이스|지키미|KCB|코리아\s*크레딧\s*뷰로|올크레딧|신용\s*정보|신용\s*평가/i

export function looksLikeCreditReport(text: string, fileName = ''): boolean {
  const t = `${fileName} ${String(text || '').slice(0, 4000)}`
  return /신\s*용\s*(?:점\s*수|평\s*점)/.test(t) && BUREAU.test(t)
}

function bureauOf(s: string): 'NICE' | 'KCB' | null {
  if (/KCB|코리아\s*크레딧\s*뷰로|올크레딧/i.test(s)) return 'KCB'
  if (/NICE|나이스|지키미/i.test(s)) return 'NICE'
  return null
}

export function readCreditScore(text: string, fileName = ''): CreditScoreRead | null {
  const raw = String(text || '')
  if (!looksLikeCreditReport(raw, fileName)) return null
  const lines = raw.split(/\r?\n/).map((l) => l.replace(/[ \t ]+/g, ' ').trim())
  const docBureau = bureauOf(`${fileName} ${raw.slice(0, 1500)}`)
  const out: CreditScoreRead['scores'] = []
  lines.forEach((line, i) => {
    // '신용점수 812점' · '신용평점 : 845 점' · '나의 신용점수는 812점' — 점수 바로 뒤 '점'(만점 · 점 만점은 아님)
    for (const m of line.matchAll(/신\s*용\s*(?:점\s*수|평\s*점)\s*(?:는|은)?\s*[:：]?\s*(\d{1,3}(?:,\d{3})?)\s*점(?!\s*만점)/g)) {
      const n = Number(m[1].replace(/,/g, ''))
      if (!(n >= 1 && n <= 999)) continue
      // 같은 줄 · 바로 위 줄에 기관 이름이 있으면 그 기관, 없으면 서류의 기관
      const near = `${lines[i - 1] ?? ''} ${line.slice(0, m.index ?? 0)}`
      const bureau = bureauOf(near) ?? docBureau
      if (!out.some((o) => o.bureau === bureau && o.score === n)) out.push({ bureau, score: n })
    }
  })
  return out.length ? { scores: out } : null
}

/** 회사 정보 '대표 신용점수' 칸 — 'NICE 812점 · KCB 845점' */
export function creditScoreValue(read: CreditScoreRead): string {
  return read.scores.map((s) => `${s.bureau ? `${s.bureau} ` : ''}${s.score}점`).join(' · ')
}

/** 칸 글 → 낮은 점수(판정은 보수적으로). 사람이 '812' · '812점' 으로 적어도 */
export function lowestScoreOf(value: string): number | null {
  const nums = [...String(value || '').matchAll(/(\d{3})\s*점?/g)].map((m) => Number(m[1])).filter((n) => n >= 100 && n <= 999)
  return nums.length ? Math.min(...nums) : null
}

export function creditBandOf(score: number): CreditBand {
  if (score >= 900) return '900점 이상'
  if (score >= 800) return '800점대'
  if (score >= 700) return '700점대'
  if (score >= 600) return '600점대'
  return '600점 미만'
}
