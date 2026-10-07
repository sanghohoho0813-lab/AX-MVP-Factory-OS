/**
 * 업종 — 공식 분류(AX). 한국표준산업분류(KSIC) 코드가 있을 때만 '확정' 하고, 없으면 '세부 업종 확인 필요'.
 *
 *  - 이노비즈 신청 업종(운영규정 고시 제2026-44호 제3조①): 제조업(C) · 건설업(F) · 농업(A01) · 비제조업(그 밖 전부) ·
 *    소프트웨어업 · 바이오업 · 환경업(별표1 산업분류표) · 전문디자인업(M732). 도소매 · 서비스도 '비제조업' 으로 신청 가능 — 업종만으로 떨어뜨리지 않는다.
 *  - 이노비즈 제외 업종(같은 고시 별표2) — KSIC 세세분류 목록.
 *  - 메인비즈 제외 업종 — 운영규정(고시 제2026-45호) 제3조① 은 '다음 각 호' 라고만 하고 각 호가 없다. KSIC 목록은 메인비즈넷
 *    제도안내에만 있다(공식 안내 상이). '중'(일부만 제외) 표시 업종은 코드만으로 확정하지 않는다.
 *  - 낱말(업종 이름)은 '주의 신호' 일 뿐 — 제외 판정은 KSIC 코드로만.
 *
 * 출처: law.go.kr 고시 원문 · 별표2 파일, smes.go.kr/mainbiz 제도안내 — 2026-10-07 확인.
 */

/** KSIC 코드(숫자 2~5자리)를 글에서 찾는다 — 'KSIC · 업종코드 · 산업분류' 옆이거나 괄호 안 알파벳+5자리일 때만(엉뚱한 숫자를 업종으로 읽지 않게) */
export function parseKsic(text: string): string | null {
  const t = text.replace(/\s+/g, ' ')
  const near = /(?:KSIC|업종\s*코드|산업\s*분류(?:\s*코드)?|표준산업분류)\s*[:：(]?\s*[A-U]?\s*(\d{2,5})/i.exec(t)
  if (near) return near[1]
  const paren = /[(（]\s*[A-U]\s*(\d{5})\s*[)）]/.exec(t)
  return paren ? paren[1] : null
}

/** KSIC 대분류 알파벳(중분류 두 자리로) */
export function ksicSection(ksic: string): string {
  const d = Number(ksic.slice(0, 2))
  if (d <= 3) return 'A'
  if (d <= 8) return 'B'
  if (d <= 34) return 'C'
  if (d === 35) return 'D'
  if (d <= 39) return 'E'
  if (d <= 42) return 'F'
  if (d <= 47) return 'G'
  if (d <= 52) return 'H'
  if (d <= 56) return 'I'
  if (d <= 63) return 'J'
  if (d <= 66) return 'K'
  if (d === 68) return 'L'
  if (d <= 73) return 'M'
  if (d <= 76) return 'N'
  if (d === 84) return 'O'
  if (d === 85) return 'P'
  if (d <= 87) return 'Q'
  if (d <= 91) return 'R'
  if (d <= 96) return 'S'
  if (d <= 98) return 'T'
  return 'U'
}

/* ------------------------------------------------------------------ */
/* 이노비즈                                                               */
/* ------------------------------------------------------------------ */

export type InnobizSector = 'manufacturing' | 'construction' | 'agriculture' | 'non_manufacturing' | 'software' | 'bio' | 'environment' | 'design'

export const INNOBIZ_SECTOR_LABEL: Record<InnobizSector, string> = {
  manufacturing: '제조업',
  construction: '건설업',
  agriculture: '농업',
  non_manufacturing: '비제조업',
  software: '소프트웨어업',
  bio: '바이오업',
  environment: '환경업',
  design: '전문디자인업',
}

/** 별표2 「이노비즈 대상에서 제외되는 업종」(KSIC 세세분류) */
export const INNOBIZ_EXCLUDED_KSIC: readonly string[] = [
  // 숙박 · 음식점 · 주점
  '55112', '55113', '55119', '55909',
  '56111', '56112', '56113', '56114', '56119', '56120', '56131', '56132', '56191', '56192', '56193', '56194', '56199',
  '56211', '56212', '56219', '56220',
  // 부동산 · 임대
  '68111', '68112', '68119', '68121', '68122', '68129', '68221',
  // 오락 · 문화
  '91121', '91223', '91291', '91249',
  // 개인 서비스
  '96111', '96112', '96113', '96119', '96121', '96122', '96129', '96912', '96913', '96921', '96922', '96991', '96992', '96993', '96999',
]

/** 업종 이름에 별표2 업종 같은 낱말 — 판정이 아니라 'KSIC 확인' 을 부르는 신호 */
const INNOBIZ_EXCLUDED_HINT = /숙박|모텔|여관|음식점|식당|한식|카페|커피|제과점|주점|호프|부동산\s*(임대|중개|개발|공급)|임대업|골프장|노래\s*연습|노래방|무도장|갬블|이용업|미용|네일|피부\s*관리|세탁|목욕|사우나|마사지|결혼\s*상담|예식장|점술/

/** KSIC 로 이노비즈 업종 평가표(8가지) — KSIC 없으면 null */
export function innobizSectorOfKsic(ksic: string): InnobizSector {
  const sec = ksicSection(ksic)
  if (ksic.startsWith('732')) return 'design'
  if (sec === 'C') return 'manufacturing'
  if (sec === 'F') return 'construction'
  if (ksic.startsWith('01')) return 'agriculture'
  // 소프트웨어 개발 · 공급(582) · 컴퓨터 프로그래밍 · 시스템 통합(620) — 운영규정 별도 평가표가 있음(비제조업 평가표도 신청은 가능)
  if (ksic.startsWith('582') || ksic.startsWith('620')) return 'software'
  return 'non_manufacturing'
}

/** 업종 글(대분류 추정)로 '보이는' 평가표 — 확정 아님 */
export function innobizSectorGuess(group: string): InnobizSector | null {
  switch (group) {
    case 'manufacturing':
    case 'food':
      return 'manufacturing'
    case 'construction':
      return 'construction'
    case 'software':
      return 'software'
    case 'bio':
      return 'bio'
    case 'environment':
      return 'environment'
    case 'design':
      return 'design'
    case 'agriculture':
      return 'agriculture'
    case 'retail':
    case 'service':
    case 'other':
      return 'non_manufacturing'
    default:
      return null
  }
}

export interface IndustryJudgment {
  /** must: 확정 제외 · core: 확정 업종 · note: KSIC 없음(보이기만, 준비도에 안 넣음) */
  weight: 'must' | 'core' | 'note'
  state: 'ok' | 'warn' | 'no' | 'unknown'
  text: string
}

export function innobizIndustry(ksic: string | null | undefined, group: string, text: string): IndustryJudgment {
  if (ksic && ksic.length === 5 && INNOBIZ_EXCLUDED_KSIC.includes(ksic)) return { weight: 'must', state: 'no', text: `이노비즈 제외 업종(별표2 · KSIC ${ksic})` }
  if (ksic) {
    const s = innobizSectorOfKsic(ksic)
    return { weight: 'core', state: 'ok', text: `신청 가능한 업종 — ${INNOBIZ_SECTOR_LABEL[s]} 평가표(KSIC ${ksic}${ksic.length < 5 ? ' · 세세분류로 제외 업종 최종 확인' : ''})` }
  }
  if (!group && !text) return { weight: 'core', state: 'unknown', text: '업종 — 확인 필요' }
  if (INNOBIZ_EXCLUDED_HINT.test(text.replace(/\s+/g, ''))) return { weight: 'note', state: 'warn', text: '세부 업종 확인 필요 — 업종 이름이 제외 업종(별표2 숙박 · 음식 · 부동산 · 개인서비스 등)과 비슷함 · KSIC 코드로 확인' }
  const g = innobizSectorGuess(group)
  return { weight: 'note', state: 'unknown', text: `세부 업종 확인 필요 — ${g ? `${INNOBIZ_SECTOR_LABEL[g]} 평가표로 보임 · ` : ''}제외 업종(별표2) 여부는 KSIC 코드로 확인` }
}

/* ------------------------------------------------------------------ */
/* 메인비즈                                                               */
/* ------------------------------------------------------------------ */

/** 메인비즈넷 제도안내 — 코드 전체가 제외(접두어) */
const MAINBIZ_EXCLUDED_FULL = ['56', '46331', '46333']
/** '중'(일부만 제외) · 예외 있는 업종 — 코드만으로 확정하지 않는다 */
const MAINBIZ_EXCLUDED_PART: [string, string][] = [
  ['33402', '불건전 영상게임기 제조 일부'],
  ['33409', '도박게임장비 등 제조 일부'],
  ['46102', '담배 중개 일부'],
  ['5821', '불건전 게임 소프트웨어 일부'],
  ['55', '숙박업(관광진흥법상 관광숙박업은 가능)'],
]
/** 낱말 신호(게임 · 도박 · 사행성 · 불건전 소비) — 판정 아님 */
export const MAINBIZ_CAUTION_WORDS = /도박|사행|카지노|경마|복권|유흥|주점|게임장|성인|담배|주류\s*도매|숙박|모텔/

export function mainbizIndustry(ksic: string | null | undefined, text: string): IndustryJudgment {
  if (ksic) {
    if (MAINBIZ_EXCLUDED_FULL.some((p) => ksic.startsWith(p))) return { weight: 'must', state: 'no', text: `메인비즈 제외 업종(KSIC ${ksic} — 게임 · 사행성 · 불건전 소비업종)` }
    const part = MAINBIZ_EXCLUDED_PART.find(([p]) => ksic.startsWith(p))
    if (part) return { weight: 'note', state: 'warn', text: `세부 업종 확인 필요 — KSIC ${ksic}는 ${part[1]}만 제외 · 실제 사업 내용으로 확인` }
    return { weight: 'must', state: 'ok', text: `제외 업종 아님(KSIC ${ksic})` }
  }
  if (!text) return { weight: 'must', state: 'unknown', text: '업종 — 확인 필요' }
  if (MAINBIZ_CAUTION_WORDS.test(text)) return { weight: 'note', state: 'warn', text: '세부 업종 확인 필요 — 업종 이름에 제외 업종(게임 · 사행성 · 불건전 소비)과 비슷한 말이 있음 · KSIC 코드로 확인' }
  return { weight: 'note', state: 'unknown', text: '세부 업종 확인 필요 — 제외 업종(게임 · 사행성 · 불건전 소비) 여부는 KSIC 코드로 확인' }
}
