/**
 * 업종 — 공식 분류(AX). 한국표준산업분류(KSIC) 코드가 있을 때만 '확정' 하고, 없으면 '세부 업종 확인 필요'.
 *
 *  - 이노비즈 신청 업종(운영규정 고시 제2026-44호 제3조①): 제조업(C) · 건설업(F) · 농업(A01) · 비제조업(그 밖 전부) ·
 *    소프트웨어업 · 바이오업 · 환경업(별표1 산업분류표) · 전문디자인업(M732). 도소매 · 서비스도 '비제조업' 으로 신청 가능 — 업종만으로 떨어뜨리지 않는다.
 *  - 이노비즈 제외 업종(같은 고시 별표2) — KSIC 세세분류 목록.
 *  - 메인비즈 제외 업종 — 운영규정(고시 제2026-45호) 제3조① 본문 표(KSIC) · 메인비즈넷 제도안내와 같다.
 *    '중'(일부만 제외) 업종 · 예외 있는 업종(관광숙박업)은 코드만으로 확정하지 않는다.
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

/**
 * 소프트웨어업 — 운영규정 제3조①5호의 닫힌 목록(KSIC 세세분류 7개, 이노비즈넷 업종 안내와 같음).
 * J631(자료처리 · 호스팅 · 포털) 같은 다른 J 코드는 소프트웨어업이 아니다.
 */
export const INNOBIZ_SW_KSIC: readonly string[] = ['58211', '58212', '58219', '58221', '58222', '62010', '62021']

/**
 * 별표1 「바이오산업 및 환경산업 해당 산업분류표」 표1(산업분류) — 중분류(J582 만 소분류).
 * 이 코드만으로는 바이오 · 환경 평가표가 확정되지 않는다 — 신청 기술이 표2 기술분류에도 맞아야 한다(이노비즈넷 적용원칙).
 */
export const INNOBIZ_BIO_KSIC: readonly string[] = ['01', '02', '03', '10', '11', '20', '21', '27', '582', '62', '63', '70', '71', '72', '73', '39', '86']
export const INNOBIZ_ENV_KSIC: readonly string[] = ['20', '21', '29', '41', '70', '71', '72', '73', '39', '37', '38']

/** 특수업종을 빼고 KSIC 로 정하는 일반 업종(제조 C · 건설 F · 농업 A01 · 그 밖 비제조업 · 전문디자인 M732) */
export function innobizGeneralSector(ksic: string): InnobizSector {
  if (ksic.startsWith('732')) return 'design'
  const sec = ksicSection(ksic)
  if (sec === 'C') return 'manufacturing'
  if (sec === 'F') return 'construction'
  if (ksic.startsWith('01')) return 'agriculture'
  return 'non_manufacturing'
}

export interface InnobizSectorJudgment {
  /** 확정된 평가표(못 정하면 null — '업종 평가표 추가 확인 필요') */
  sector: InnobizSector | null
  /** 확정 못 할 때 후보(바이오 · 환경 · 소프트웨어 · 일반 업종) */
  candidates: InnobizSector[]
}

/**
 * KSIC 로 이노비즈 평가표 — 적용원칙: 특수업종(소프트웨어 · 바이오 · 환경) 해당 여부를 먼저 보고, 아니면 KSIC 로 일반 업종.
 *  - 소프트웨어업: 세세분류 7개면 확정. 짧은 코드(예: '582')라 목록과 갈리면 확인 필요.
 *  - 바이오 · 환경: 산업분류만으로 확정 안 함(기술분류도 맞아야) → 후보로 두고 '업종 평가표 추가 확인 필요'.
 *  - 그 밖: 제조 · 건설 · 농업 · 전문디자인 · 비제조업 확정.
 */
export function innobizSectorOfKsic(ksic: string): InnobizSectorJudgment {
  const general = innobizGeneralSector(ksic)
  if (ksic.length === 5 && INNOBIZ_SW_KSIC.includes(ksic)) return { sector: 'software', candidates: [] }
  // 전문디자인업은 운영규정이 KSIC(M732)로 직접 정함 — M73 이 별표1 후보에 들어도 디자인으로
  if (ksic.startsWith('732')) return { sector: 'design', candidates: [] }
  const swMaybe = ksic.length < 5 && INNOBIZ_SW_KSIC.some((c) => c.startsWith(ksic))
  const bio = INNOBIZ_BIO_KSIC.some((p) => ksic.startsWith(p) || (ksic.length < p.length && p.startsWith(ksic)))
  const env = INNOBIZ_ENV_KSIC.some((p) => ksic.startsWith(p) || (ksic.length < p.length && p.startsWith(ksic)))
  const candidates: InnobizSector[] = [...(swMaybe ? (['software'] as const) : []), ...(bio ? (['bio'] as const) : []), ...(env ? (['environment'] as const) : [])]
  if (!candidates.length) return { sector: general, candidates: [] }
  return { sector: null, candidates: [...candidates, general] }
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
    const j = innobizSectorOfKsic(ksic)
    const tail = ksic.length < 5 ? ' · 세세분류로 제외 업종 최종 확인' : ''
    // 신청 가능은 확정(8가지 평가표 중 하나) — 어느 평가표인지가 갈리면 '업종 평가표 추가 확인 필요'(틀린 확정보다 확인 필요)
    if (!j.sector) return { weight: 'core', state: 'ok', text: `신청 가능한 업종(KSIC ${ksic}) — 업종 평가표 추가 확인 필요: ${j.candidates.map((x) => INNOBIZ_SECTOR_LABEL[x]).join(' · ')} 중(바이오 · 환경은 신청 기술 분야로 정함)${tail}` }
    return { weight: 'core', state: 'ok', text: `신청 가능한 업종 — ${INNOBIZ_SECTOR_LABEL[j.sector]} 평가표(KSIC ${ksic}${tail})` }
  }
  if (!group && !text) return { weight: 'core', state: 'unknown', text: '업종 — 확인 필요' }
  if (INNOBIZ_EXCLUDED_HINT.test(text.replace(/\s+/g, ''))) return { weight: 'note', state: 'warn', text: '세부 업종 확인 필요 — 업종 이름이 제외 업종(별표2 숙박 · 음식 · 부동산 · 개인서비스 등)과 비슷함 · KSIC 코드로 확인' }
  const g = innobizSectorGuess(group)
  return { weight: 'note', state: 'unknown', text: `세부 업종 확인 필요 — ${g ? `${INNOBIZ_SECTOR_LABEL[g]} 평가표로 보임 · ` : ''}제외 업종(별표2) 여부는 KSIC 코드로 확인` }
}

/* ------------------------------------------------------------------ */
/* 메인비즈                                                               */
/* ------------------------------------------------------------------ */

/** 운영규정 제3조① 표 — 코드 전체가 제외(접두어): 주점업 · 주류 도매 · 담배 도매 */
const MAINBIZ_EXCLUDED_FULL: [string, string][] = [
  ['5621', '주점업'],
  ['46331', '주류 도매업'],
  ['46333', '담배 도매업'],
]
/** 제외 업종 한 줄(운영규정 제3조① 표 요약) — 게임 · 오락용품은 '불건전' 한 것만이라 일부 */
const MAINBIZ_EXCLUDED_SUMMARY = '주점 · 주류/담배 도매 · 숙박(관광숙박 제외), 불건전 게임 · 오락용품은 일부'
/** '중'(일부만 제외) · 예외 있는 업종 · 표 이름에 없는 코드 — 코드만으로 확정하지 않는다(세부 사업 내용 확인) */
const MAINBIZ_EXCLUDED_PART: [string, string][] = [
  ['33402', '불건전 영상게임기 제조만'],
  ['33409', '도박게임장비 등 불건전 오락용품 제조만'],
  ['46102', '담배 중개만'],
  ['5821', '불건전 게임 소프트웨어만'],
  ['55', '숙박업(관광진흥법상 관광숙박업은 신청 가능)'],
  ['561', "음식점업(표 코드 I55~56 에 들지만 표 이름은 '숙박업 및 주점업' — 고객센터 확인)"],
  ['5622', "비알콜 음료점(표 이름에 없음 — 고객센터 확인)"],
]
/** 낱말 신호(도박 · 사행 · 유흥 · 주점 · 담배 · 숙박 …) — 판정 아님, '세부 업종 확인 필요' 로만 */
export const MAINBIZ_CAUTION_WORDS = /도박|사행|카지노|경마|복권|유흥|주점|게임장|성인|담배|주류\s*도매|숙박|모텔/

export function mainbizIndustry(ksic: string | null | undefined, text: string): IndustryJudgment {
  if (ksic) {
    const full = MAINBIZ_EXCLUDED_FULL.find(([p]) => ksic.startsWith(p))
    if (full) return { weight: 'must', state: 'no', text: `메인비즈 제외 업종(운영규정 제3조① — KSIC ${ksic} ${full[1]})` }
    const part = MAINBIZ_EXCLUDED_PART.find(([p]) => ksic.startsWith(p))
    if (part) return { weight: 'note', state: 'warn', text: `세부 사업내용 확인 필요 — KSIC ${ksic}: ${part[1]} 제외 · 실제 사업 내용으로 확인` }
    return { weight: 'must', state: 'ok', text: `제외 업종 아님(KSIC ${ksic})` }
  }
  if (!text) return { weight: 'must', state: 'unknown', text: '업종 — 확인 필요' }
  if (MAINBIZ_CAUTION_WORDS.test(text)) return { weight: 'note', state: 'warn', text: `세부 업종 확인 필요 — 업종 이름에 제외 업종(${MAINBIZ_EXCLUDED_SUMMARY})과 비슷한 말이 있음 · KSIC 코드 · 실제 사업 내용으로 확인` }
  return { weight: 'note', state: 'unknown', text: `세부 업종 확인 필요 — 제외 업종(${MAINBIZ_EXCLUDED_SUMMARY}) 여부는 KSIC 코드로 확인` }
}
