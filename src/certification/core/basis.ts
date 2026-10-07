/**
 * '이 답변은 무엇을 근거로 만들었나요?' (P1) — 판정에 쓴 사실 하나하나가 어디서 왔고 확인됐는지.
 *   ✓ 확인된 사실(서류 · 회사 정보 확인 · 연구소 관리 기록)  △ 추정 · 미확인(입력값 · 컨설턴트가 고른 칩)  ? 모름
 * Core 는 출처를 만들지 않는다 — OS 연결층이 ctx.basis 로 넘긴 것만 보여 준다.
 */
import type { BasisField, BasisItem, CertificationClientContext, CertificationKey } from './types'

const FIELDS: Record<CertificationKey, BasisField[]> = {
  innobiz: ['years', 'industry', 'size', 'researchUnit', 'patents', 'rndExpense', 'revenue', 'operatingProfit', 'exclusion'],
  mainbiz: ['years', 'industry', 'size', 'totalAssets', 'totalLiabilities', 'operatingProfit', 'employees', 'exclusion'],
  venture: ['researchUnit', 'rndExpense', 'revenue', 'patents', 'years'],
  lab: ['researchUnit', 'researchers', 'size', 'employees', 'rndExpense'],
  iso9001: ['industry', 'employees', 'b2b', 'procurement', 'exportPlan'],
  iso14001: ['industry', 'employees', 'b2b', 'procurement', 'exportPlan'],
  iso45001: ['industry', 'employees', 'b2b', 'procurement'],
}

export function basisFor(key: CertificationKey, c: CertificationClientContext): BasisItem[] {
  const list = c.basis ?? []
  return FIELDS[key].map((f) => list.find((b) => b.field === f) ?? { field: f, label: BASIS_LABEL[f], value: '', state: 'missing', from: '' })
}

export const BASIS_LABEL: Record<BasisField, string> = {
  years: '업력(설립일)',
  industry: '업종',
  size: '기업 규모',
  employees: '직원 수',
  revenue: '매출',
  operatingProfit: '영업이익',
  totalAssets: '자산',
  totalLiabilities: '부채',
  rndExpense: '연구개발비',
  researchUnit: '연구조직',
  researchers: '연구전담요원',
  patents: '특허',
  b2b: 'B2B 납품',
  procurement: '공공 조달',
  exportPlan: '수출',
  exclusion: '제외 사유(체납 · 회생 등)',
}
