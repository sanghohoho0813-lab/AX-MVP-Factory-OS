/**
 * '받으면 더 추천' → 고객에게 보낼 자료 요청 문구 (D-191).
 *
 * 아직 판정하지 못한 모듈(정보가 더 필요해요)이 말하는 '있으면 더 정확' 항목을 고객이 알아듣는 서류 이름으로 바꾸고,
 * 어디서 떼는지 · 어느 모듈 때문에 필요한지를 붙여 한 장의 카톡 문구로 만든다.
 *  - 크레탑 보고서처럼 우리가 조회하는 것은 고객에게 달라고 하지 않는다(따로 알려 준다).
 *  - 같은 서류로 풀리는 것(설립일 · 주소 · 업종 → 사업자등록증)은 하나로 묶는다.
 *  - 주민등록번호는 받지 않는다 — 생년월일만.
 * 계산 · 글 만들기만 한다(저장 · 발송 없음 — 복사해서 보낸다).
 */
import type { ClientOpsRecord } from '../types/clientOps'
import type { Insight } from './clientInsights'

interface RequestDef {
  match: RegExp
  label: string
  where: string
  /** 우리가 조회한다 — 고객에게 달라고 하지 않는다 */
  ours?: boolean
}

const DEFS: RequestDef[] = [
  { match: /크레탑/, label: '크레탑 기업종합보고서', where: '', ours: true },
  { match: /4대보험|가입자 명부|직원 수/, label: '4대보험 사업장 가입자 명부', where: '4대사회보험 정보연계센터(4insure.or.kr) › 사업장 가입자 명부 출력(PDF)' },
  { match: /주주명부/, label: '주주명부(최근 것)', where: '회사에 보관 중인 주주명부 — 사진도 됩니다' },
  { match: /대표 (월 )?급여/, label: '대표님 급여(월 세전)', where: '급여대장이나 원천징수영수증이면 됩니다' },
  { match: /설립일|창업일|회사 주소|업종|업력|사업자등록증|법인 · 개인/, label: '사업자등록증 사본', where: '홈택스 › 사업자등록증 발급(PDF) 또는 사진' },
  { match: /생년월일|대표 나이/, label: '대표님 생년월일', where: '날짜만 알려 주셔도 됩니다(주민등록번호는 받지 않습니다)' },
  { match: /매출|재무|부채비율|자본잠식|영업이익|자산 · 순이익|주식가치|배당 가능한 이익/, label: '최근 재무제표(표준재무제표증명)', where: '홈택스 › 표준재무제표증명 발급(PDF)' },
  // D-199 상황 예시(절세)에서 쓰는 것
  { match: /대표 취임일|1주 액면가/, label: '법인 등기사항전부증명서', where: '인터넷등기소 › 법인 등기사항전부증명서(PDF) — 대표 취임일 · 1주 금액이 나옵니다' },
  { match: /경영한 햇수/, label: '대표님이 회사를 경영한 기간', where: '설립 때부터 대표였는지 한 줄이면 됩니다' },
  { match: /가업자산 비율/, label: '사업용 자산 비율', where: '담당 세무사께 여쭤 보셔도 됩니다(모르면 비워 둡니다)' },
  { match: /부동산 · 금융재산/, label: '대표님 부동산 · 금융재산 대략 금액', where: '대략적인 금액이면 됩니다' },
  { match: /자녀 수/, label: '자녀 수', where: '숫자만 알려 주시면 됩니다' },
  { match: /가지급금 잔액/, label: '가지급금 잔액', where: '최근 재무제표나 담당 세무사께 확인한 금액' },
  { match: /연구조직|전담부서/, label: '연구소(전담부서) 인정서', where: '한국산업기술진흥협회 인정서 사본 — 없으면 "없음" 이라고만 알려 주세요' },
  { match: /연구개발비|연구개발 활동/, label: '연구개발비 · 하고 있는 연구 내용', where: '대략적인 금액과 연구 내용 한두 줄이면 됩니다' },
  { match: /특허|지식재산/, label: '특허 · 상표 등록 현황', where: '등록번호나 등록증 사진 — 없으면 "없음" 이라고만 알려 주세요' },
  { match: /중소기업 여부/, label: '중소기업확인서', where: '중소기업현황정보시스템(sminfo.mss.go.kr) › 확인서 발급(PDF)' },
  { match: /체납|회생|제외 사유/, label: '국세 · 지방세 완납증명서', where: '홈택스 · 위택스에서 발급(PDF)' },
  { match: /유효기간/, label: '보유 인증서 사본', where: '유효기간이 보이게 사진이면 됩니다' },
  { match: /B2B|거래처/, label: '주요 거래처가 요구하는 인증', where: '한 줄로 알려 주시면 됩니다' },
  { match: /연구 인력|연구전담요원|학위|경력/, label: '연구 담당 직원의 최종 학력 · 경력', where: '이름 · 학위(전공) · 경력 연수만 알려 주셔도 됩니다' },
  { match: /연구 ?공간/, label: '연구 공간 사진(또는 도면)', where: '연구 공간 전체가 보이게 2~3장' },
  { match: /창업 형태/, label: '창업 형태(새로 창업했는지 · 이어받았는지)', where: '한 줄로 알려 주시면 됩니다' },
]

export interface RequestItem {
  label: string
  where: string
  /** 이 자료로 판정할 모듈(맞춤 추천 이름) */
  for: string[]
}

/** 정보가 더 필요한 모듈의 빠진 항목 → 고객에게 받을 자료(겹치지 않게) · 우리가 조회할 것 */
export function requestItemsFrom(insights: readonly Insight[]): { items: RequestItem[]; ours: string[] } {
  const items: RequestItem[] = []
  const ours: string[] = []
  for (const ins of insights) {
    if (ins.tone !== 'need') continue
    for (const raw of ins.missing) {
      const def = DEFS.find((d) => d.match.test(raw))
      const label = def?.label ?? raw.trim()
      if (!label) continue
      if (def?.ours) {
        if (!ours.includes(label)) ours.push(label)
        continue
      }
      const have = items.find((x) => x.label === label)
      if (have) {
        if (!have.for.includes(ins.label)) have.for.push(ins.label)
      } else items.push({ label, where: def?.where ?? '', for: [ins.label] })
    }
  }
  return { items, ours }
}

/** 카톡으로 보낼 자료 요청 문구 — 받을 것이 없으면 '' */
export function recoRequestMessage(record: Pick<ClientOpsRecord, 'contactName' | 'representativeName' | 'companyName'>, insights: readonly Insight[]): string {
  return requestMessage(record, requestItemsFrom(insights).items)
}

/** 빠진 항목(사람 말) 하나 → 고객에게 받을 자료(우리가 조회하는 것이면 null) — D-199 상황 예시도 같은 표를 쓴다 */
export function requestItemFor(raw: string, forLabel: string): RequestItem | null {
  const def = DEFS.find((d) => d.match.test(raw))
  if (def?.ours) return null
  const label = def?.label ?? raw.trim()
  return label ? { label, where: def?.where ?? '', for: [forLabel] } : null
}

/** 자료 목록 → 카톡 문구(같은 자료는 하나로) */
export function requestMessage(record: Pick<ClientOpsRecord, 'contactName' | 'representativeName' | 'companyName'>, list: readonly RequestItem[]): string {
  const items: RequestItem[] = []
  for (const it of list) {
    const have = items.find((x) => x.label === it.label)
    if (have) for (const f of it.for) if (!have.for.includes(f)) have.for.push(f)
    if (!have) items.push({ ...it, for: [...it.for] })
  }
  if (items.length === 0) return ''
  const who = (record.representativeName || record.contactName || '').trim()
  const name = who ? `${who} 대표님` : '대표님'
  const company = record.companyName.trim()
  const body = items.map((it, i) => [`${i + 1}. ${it.label} — ${it.for.join(' · ')} 확인용`, it.where ? `   - ${it.where}` : ''].filter(Boolean).join('\n')).join('\n')
  return [
    `안녕하세요, ${name}.`,
    '',
    `${company ? `${company}에 ` : ''}맞는 지원 제도를 더 정확히 찾아 드리려고 합니다.`,
    '아래 자료를 보내 주시면 바로 검토해 드리겠습니다.',
    '',
    body,
    '',
    '사진이나 PDF로 보내 주셔도 됩니다. 감사합니다.',
  ].join('\n')
}
