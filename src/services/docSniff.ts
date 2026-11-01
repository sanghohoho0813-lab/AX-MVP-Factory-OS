/**
 * 올린 글이 크레탑 보고서인지 · 4대보험 명부인지 알아보기(규칙) — docAutoAnalyze 가 다시 내보낸다.
 * D-481 새 업체 등록 창(고객 관리 첫 화면)이 이 두 함수 때문에 서류 분석 엔진 전체(절세 설계 · 계산기까지)를 받던 것을 떼어 냄. 규칙은 그대로.
 */
type SniffDoc = { key: string; text: string; fileName: string }

const CRETOP_SIGNAL = /크레탑|CRETOP|한국평가데이터|기업종합보고서|KoDATA/i
/** 주민등록번호 모양(앞 6 · 뒤 첫 자리) — 명부인지 가리는 데만 쓴다. 저장하지 않는다 */
const RRN_LIKE = /\d{6}\s*-\s*[1-8]/g

export function looksLikeCretop(doc: SniffDoc): boolean {
  if (doc.key === 'cretopReport') return doc.text.length > 300
  return doc.text.length > 800 && CRETOP_SIGNAL.test(`${doc.fileName} ${doc.text.slice(0, 4000)}`)
}

export function looksLikeRoster(doc: SniffDoc): boolean {
  const n = (doc.text.match(RRN_LIKE) ?? []).length
  if (doc.key === 'payrollRoster' || doc.key === 'healthInsurance') return n >= 1
  return n >= 2 && /(가입자|피보험자|취득일|자격\s*취득|명부)/.test(`${doc.fileName} ${doc.text.slice(0, 3000)}`)
}
