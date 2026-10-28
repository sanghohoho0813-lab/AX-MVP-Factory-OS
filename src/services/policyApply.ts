/**
 * D-313 정책자금 신청 서류 요청 문구 — 맞춤 추천 정책자금 카드의 [아직 받을 서류 요청 문구].
 *
 * D-311 로 엔진의 '자료 체크' 가 서류함을 보게 됐다(있는 서류는 '확보'). 이제 '요청 필요' 로 남은 것만
 * 고객이 알아듣는 이름 · 어디서 떼는지와 함께 한 장의 카톡 문구로 만든다(지원사업 '신청 준비 → 카톡 요청' 과 같은 길).
 *  - 사업계획서는 고객에게 달라고 하지 않는다 — 저희가 대표님과 함께 쓴다(따로 한 줄).
 *  - 납세 · 완납증명은 서류함에 없는 것만 콕 집어(국세 · 지방세 · 4대보험).
 *  - 신분증은 뒷자리를 가리고 받는다(주민등록번호는 남기지 않는다).
 * 글만 만든다(저장 · 발송 없음 — 복사해서 보낸다). 규칙 계산 — 외부 호출 없음.
 */
import type { ClientOpsRecord } from '../types/clientOps'
import libraryJson from '../tools/policyFunding/knowledge/document-library.json'

const LIB = (libraryJson as unknown as { documents: { key: string; label: string }[] }).documents

/** 엔진 자료 key → 고객에게 받을 이름 · 어디서. ours = 저희가 준비(고객에게 달라고 하지 않음) */
const ASK: Record<string, { label: string; where: string; ours?: boolean }> = {
  bizReg: { label: '사업자등록증 사본', where: '홈택스 › 사업자등록증 발급(PDF) 또는 사진' },
  financial: { label: '표준재무제표증명(최근 3년)', where: '홈택스 › 민원증명 › 표준재무제표증명(PDF) — 3년치' },
  vat: { label: '부가가치세 과세표준증명(최근 3년)', where: '홈택스 › 민원증명 › 부가가치세 과세표준증명(PDF)' },
  taxClear: { label: '국세 · 지방세 납세증명서 · 4대보험 완납증명서', where: '홈택스(납세증명서) · 위택스(지방세 납세증명서) · 4대사회보험 정보연계센터(완납증명서) — 모두 PDF' },
  insuranceList: { label: '4대보험 사업장 가입자 명부', where: '4대사회보험 정보연계센터(4insure.or.kr) › 사업장 가입자 명부 출력(PDF)' },
  bizPlan: { label: '사업계획서', where: '', ours: true },
  quote: { label: '설비 견적서', where: '사려는 기계 · 설비의 공급업체 견적서' },
  machinePhoto: { label: '기계 · 설비 사진', where: '들여놓을 자리 · 지금 쓰는 설비가 보이게 2~3장' },
  factoryPhoto: { label: '공장 · 사업장 사진', where: '간판 · 내부 · 작업 공간이 보이게 3~4장' },
  clientContract: { label: '주요 거래처 계약서 · 발주서', where: '최근 1년 안 것 2~3건(금액이 보이게)' },
  patentCert: { label: '특허증(또는 출원서)', where: '특허증 사진이나 특허로(patent.go.kr) 등록원부' },
  labCert: { label: '기업부설연구소 인정서', where: '한국산업기술진흥협회 인정서 사본' },
  bizCert: { label: '보유 인증서(벤처 · 이노비즈 · 메인비즈 등)', where: '유효기간이 보이게 사진이나 PDF' },
  corpRegistry: { label: '법인 등기사항전부증명서', where: '인터넷등기소 › 법인 등기사항전부증명서(PDF)' },
  shareholders: { label: '주주명부', where: '회사에 보관 중인 주주명부 — 사진도 됩니다' },
  lease: { label: '사업장 임대차계약서', where: '사본(사진) — 계약 기간 · 임대료가 보이게' },
  ownDeed: { label: '사업장 건물 등기사항증명서', where: '인터넷등기소 › 부동산 등기사항증명서(PDF)' },
  adData: { label: '광고 성과 자료', where: '광고 관리 화면 캡처(쓴 돈 · 매출 · 전환)' },
  inventoryData: { label: '재고 · 매입 정산 자료', where: '최근 6개월 재고 · 매입 정산표' },
  exportProof: { label: '수출실적증명', where: '한국무역협회 수출실적증명 또는 수출신고필증' },
  loanStatus: { label: '지금 있는 대출 내역', where: '은행 · 금액 · 만기를 한 줄씩 적어 주셔도 됩니다' },
  idCard: { label: '대표자 신분증 사본', where: '주민등록번호 뒷자리는 가리고 보내 주세요' },
  salesEvidence: { label: '최근 매출 증빙', where: '카드 매출 · 세금계산서 내역(홈택스) 또는 POS 정산 화면' },
}

const keyOf = (label: string) => LIB.find((d) => d.label === label)?.key ?? ''

export interface PolicyApplyAsk {
  /** 고객에게 받을 것(순서 = 엔진 자료 체크 순서) */
  items: { label: string; where: string }[]
  /** 저희가 준비할 것(사업계획서) */
  ours: string[]
}

/**
 * 엔진 자료 체크('요청 필요') → 받을 것 · 저희가 준비할 것.
 * want — 서류함에 없는 체납 증명(policyEvidence.want) — 있으면 '국세 · 지방세 · 4대보험' 을 그것만으로 좁힌다.
 */
export function policyApplyAsk(checks: readonly { label: string; status: string }[], want: readonly string[] = []): PolicyApplyAsk {
  const items: PolicyApplyAsk['items'] = []
  const ours: string[] = []
  for (const c of checks) {
    if (c.status !== '요청 필요') continue
    const k = keyOf(c.label)
    const a = ASK[k]
    if (!a) {
      items.push({ label: c.label.replace(/\s*\(.*\)\s*$/, ''), where: '' })
      continue
    }
    if (a.ours) {
      ours.push(a.label)
      continue
    }
    if (k === 'taxClear' && want.length) items.push({ label: want.join(' · '), where: a.where })
    else items.push({ label: a.label, where: a.where })
  }
  return { items, ours }
}

/** 카톡 문구 — 받을 것이 없으면 '' */
export function policyApplyMessage(record: Pick<ClientOpsRecord, 'contactName' | 'representativeName' | 'companyName'>, ask: PolicyApplyAsk, agency: string): string {
  if (!ask.items.length) return ''
  const who = (record.representativeName || record.contactName || '').trim()
  const name = who ? `${who} 대표님` : '대표님'
  const company = record.companyName.trim()
  const body = ask.items.map((it, i) => [`${i + 1}. ${it.label}`, it.where ? `   - ${it.where}` : ''].filter(Boolean).join('\n')).join('\n')
  return [
    `안녕하세요, ${name}.`,
    '',
    `${company ? `${company} ` : ''}정책자금${agency ? `(${agency})` : ''} 신청을 준비하려고 합니다.`,
    '아래 서류를 보내 주시면 접수 서류를 바로 맞춰 드리겠습니다.',
    '',
    body,
    ...(ask.ours.length ? ['', `※ ${ask.ours.join(' · ')}는 저희가 대표님과 통화로 함께 씁니다.`] : []),
    '',
    '사진이나 PDF로 보내 주셔도 됩니다. 감사합니다.',
  ].join('\n')
}
