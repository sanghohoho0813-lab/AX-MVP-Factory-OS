/**
 * D-391 원천징수이행상황신고서(홈택스 · 세무대리인이 매월 내는 원천세 신고서) → 그달 급여 받은 근로자 수 · 총지급액.
 *
 * 세무사 사무실에는 늘 있는 서류인데 예전에는 아무것도 읽지 않아, 4대보험 명부가 없는 업체는
 * 직원 수가 비어 고용지원금 · 두루누리 · 연구소 설립 가능성이 '직원 수를 알면' 에 멈췄다.
 *  - 근로소득 '간이세액(A01)' 줄의 인원 · 총지급액만 읽는다(중도퇴사 A02 · 일용근로 A03 · 연말정산 A04 · 사업소득은 직원 수가 아님).
 *  - 귀속연월(그 급여가 몇 월 것인지)을 같이 남긴다. 반기 신고면 신고서에 적힌 그대로.
 *  - 소득자 이름 · 세액은 남기지 않는다. 규칙 계산 — 외부 호출 없음.
 */

export interface WithholdingRead {
  /** 귀속연월 YYYY-MM — 못 읽으면 '' */
  yearMonth: string
  /** 근로소득 간이세액(A01) 인원 */
  employees: number
  /** 근로소득 간이세액(A01) 총지급액(원) — 못 읽으면 null */
  pay: number | null
}

/** 맨 위 몇 줄의 제목이 원천징수이행상황신고서(또는 파일 이름) — 본문에 '원천징수이행상황신고서 제출' 이 있는 안내문은 아니다 */
export function looksLikeWithholdingReport(text: string, fileName = ''): boolean {
  const head = String(text || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).slice(0, 6).join(' ')
  return /원\s*천\s*징\s*수\s*이\s*행\s*상\s*황\s*신\s*고\s*서/.test(head) || /원천세\s*신고|이행\s*상황\s*신고/.test(fileName)
}

export function readWithholdingReport(text: string, fileName = ''): WithholdingRead | null {
  const raw = String(text || '')
  if (!looksLikeWithholdingReport(raw, fileName)) return null
  const ym = /귀\s*속\s*연\s*월\s*[:：]?\s*(20\d{2})\s*[년.\-/]\s*(\d{1,2})/.exec(raw)
  const yearMonth = ym && Number(ym[2]) >= 1 && Number(ym[2]) <= 12 ? `${ym[1]}-${ym[2].padStart(2, '0')}` : ''
  // '간이세액 A01 12 45,000,000 1,234,560' — A01 바로 뒤 쉼표 없는 수(인원) · 그다음 금액(총지급액). 인원 칸이 비면 읽지 않는다
  for (const line of raw.split(/\r?\n/)) {
    const m = /(?<![A-Z0-9])A\s*0\s*1(?!\d)\s*[|│]?\s*(\d{1,4})(?![\d,])\s*[|│]?\s*([\d,]{1,15})?/.exec(line)
    if (!m) continue
    const employees = Number(m[1])
    if (!(employees >= 1 && employees <= 9999)) continue
    const payDigits = m[2]?.replace(/,/g, '') ?? ''
    const pay = payDigits.length >= 4 ? Number(payDigits) : null
    return { yearMonth, employees, pay }
  }
  return null
}

/** 회사 정보 '원천세 신고 인원' 칸 — '2026년 9월분 근로자 12명 · 총지급 4,500만원' */
export function withholdingValue(r: WithholdingRead, won: (n: number) => string): string {
  const when = r.yearMonth ? `${Number(r.yearMonth.slice(0, 4))}년 ${Number(r.yearMonth.slice(5, 7))}월분 ` : ''
  return `${when}근로자 ${r.employees}명${r.pay ? ` · 총지급 ${won(r.pay)}` : ''}`
}
