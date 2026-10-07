/**
 * 인증을 받은 뒤 다음에 할 일 (P1) — 사실에 맞는 것만 1~3개. 화면 주소는 모른다(OS 연결층이 kind 로 길을 붙인다).
 */
import type { CertificationClientContext, CertificationKey } from './types'

export type AfterKind = 'policy_fund' | 'tax_credit' | 'venture' | 'innobiz' | 'mainbiz' | 'lab_keep' | 'patent' | 'procurement' | 'iso_audit'

export interface AfterAction {
  kind: AfterKind
  label: string
  why: string
}

const has = (c: CertificationClientContext, k: CertificationKey) => c.held.some((h) => h.key === k)

export function nextAfterCertified(cert: CertificationKey, c: CertificationClientContext): AfterAction[] {
  const out: AfterAction[] = []
  const add = (a: AfterAction) => out.length < 3 && !out.some((x) => x.kind === a.kind) && out.push(a)
  const funding = c.policyFundPlan !== false
  const yearsOk = c.years !== null && c.years >= 3
  if (cert === 'innobiz' || cert === 'mainbiz' || cert === 'venture') {
    if (funding) add({ kind: 'policy_fund', label: '정책자금 · 보증 검토', why: `${cert === 'venture' ? '벤처' : cert === 'innobiz' ? '이노비즈' : '메인비즈'} 확인 기업은 보증 · 정책자금 심사에서 우대될 수 있음(기관 · 시기 확인)` })
  }
  if (cert === 'lab') {
    add({ kind: 'tax_credit', label: '연구 · 인력개발비 세액공제 검토', why: '연구소 인정 뒤 연구원 인건비 · 연구비가 공제 대상이 될 수 있음(세무사 확인)' })
    if (!has(c, 'venture')) add({ kind: 'venture', label: '벤처 연구개발유형 검토', why: '연구소 + 연구개발비 5천만원 이상이면 연구개발유형 길이 열림' })
    add({ kind: 'lab_keep', label: '연구 인력 · 공간 유지 확인', why: '바뀌면 30일 안에 변경 신고(시행령 제7조②)' })
  }
  if (cert === 'venture') {
    add({ kind: 'tax_credit', label: '벤처 세제 혜택 확인', why: '창업벤처 세액감면 등 — 업력 · 업종 요건 확인' })
    if (yearsOk && !has(c, 'innobiz')) add({ kind: 'innobiz', label: '이노비즈 검토', why: `업력 ${c.years}년 — 기술 기반이 있으면 다음 인증으로` })
  }
  if (cert === 'innobiz' || cert === 'mainbiz') {
    if (c.procurement || c.b2b) add({ kind: 'procurement', label: '조달 · 입찰 가점 활용', why: '조달청 적격심사 가점(물품 · 용역)' })
    if (cert === 'innobiz' && (c.patents ?? 0) === 0) add({ kind: 'patent', label: '특허 출원 검토', why: '연장 평가에서 기술 성과로 쓰임 — 지금 특허가 없음' })
    if (cert === 'mainbiz' && c.researchUnit !== 'lab' && c.researchUnit !== 'dept') add({ kind: 'innobiz', label: '연구조직 갖추고 이노비즈 검토', why: '기술 기반을 쌓으면 이노비즈까지' })
  }
  if (cert === 'iso9001' || cert === 'iso14001' || cert === 'iso45001') {
    add({ kind: 'iso_audit', label: '사후심사 일정 잡기', why: '인증 뒤 매년 사후심사 · 3년마다 갱신심사' })
    if (c.procurement || c.b2b) add({ kind: 'procurement', label: '거래처 · 입찰 자료에 넣기', why: '납품 · 입찰 평가에 인증서 사본' })
  }
  return out
}
