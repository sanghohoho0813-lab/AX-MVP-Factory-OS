/**
 * 기업인증 공식 기준 (D-170) — 규정이 바뀌면 **이 파일만** 고친다(판정 코드는 그대로).
 *
 * 모든 값은 공식 기관 자료(law.go.kr · innobiz.net · smes.go.kr · iso.org · kab.or.kr)에서 2026-10-07 에 확인했다.
 * 블로그 · 컨설팅 업체 글은 쓰지 않았다. 확인하지 못한 것은 `unverified` 에 적고 화면에 '최신 기준 확인 필요' 로 보인다.
 * 마지막 확인일에서 `FRESH_DAYS` 가 지나면 화면이 '최신 기준 확인 필요' 를 띄운다(Freshness Gate).
 */
import type { CertificationKey } from '../core/types'

export interface OfficialSource {
  /** 기준 이름 */
  name: string
  /** 고시 번호 · 판 */
  version: string
  /** 시행일 'YYYY-MM-DD' */
  effective: string
  url: string
}

export interface BenefitDef {
  id: string
  title: string
  /** 전체 혜택 보기에 보일 설명 */
  detail: string
  /** 이 업체에 맞는지 고르는 꼬리표 */
  tags: BenefitTag[]
  /** 기관 · 시기 · 조건에 따라 달라짐 */
  conditional: boolean
  /** AX: 공식 안내에 적힌 숫자 — 출처와 같이만 보인다(출처 없는 숫자는 쓰지 않는다) */
  figure?: string
  /** AX: 어디서 확인했나 — 없으면 '공고별 확인' */
  source?: string
  /** AX: 누구에게 · 언제 해당하나 */
  target?: string
}

export type BenefitTag = 'funding' | 'guarantee' | 'procurement' | 'rnd' | 'tax_audit' | 'tax_credit' | 'trust' | 'hiring' | 'ip' | 'export'

export interface EvidenceDef {
  /** 증빙 id — 어댑터가 서류함 칸과 이어 준다 */
  id: string
  label: string
  /** 왜 필요한가(쉬운 말) */
  why: string
}

export interface CertRule {
  key: CertificationKey
  label: string
  /** 한 줄 소개 */
  summary: string
  /** 근거 법령 */
  law: string
  sources: OfficialSource[]
  /** 마지막으로 공식 자료를 확인한 날 */
  checkedAt: string
  /** 확인하지 못한 것(화면에 그대로) */
  unverified: string[]
  /** 유효기간(년) — 없으면 null */
  validYears: number | null
  /** 갱신 · 연장 안내 */
  renewalNote: string
  /** 갱신 준비 시작(만료 n일 전) */
  prepareDaysBefore: number
  /**
   * P1: 갱신 일정 — 만료 몇 일 전에 '갱신 준비 시기'(알림) · '갱신 서류 준비'(할 일) · 만료 뒤 며칠까지 연장 가능한지.
   * 유효기간이 없는 인증(연구소)은 없음.
   */
  renewal?: { noticeDays: number; todoDays: number; graceDaysAfter: number; why: string }
  /** 공식 안내끼리 서로 다른 것 — 화면에 '공식 안내 상이 — 제출 전 확인 필요' */
  conflicts?: string[]
  /** 공식 점수 기준(있을 때만 숫자) */
  officialScores?: { label: string; value: string }[]
  procedure: string[]
  benefits: BenefitDef[]
  evidence: EvidenceDef[]
  /** 수수료(공식 안내) */
  fee?: string
}

export const RULES_CHECKED_AT = '2026-10-07'
/** 이 날수가 지나면 '최신 기준 확인 필요' */
export const FRESH_DAYS = 180

/** 혜택 숫자는 관리기관(협회) 안내에서 확인 — 각 기관 규정 원문 대조는 못 함(unverified) */
const INNOBIZ_BENEFIT_SRC = '이노비즈넷 혜택 안내(innobiz.net, 2026-02 갱신) — 2026-10-07 확인 · 기관 규정 원문 대조 전'
const MAINBIZ_BENEFIT_SRC = '중소벤처24 메인비즈 혜택 안내(smes.go.kr/mainbiz) — 2026-10-07 확인 · 기관 규정 원문 대조 전'

const INNOBIZ: CertRule = {
  key: 'innobiz',
  label: '이노비즈',
  summary: '기술혁신형 중소기업 — 기술 경쟁력과 혁신 시스템을 갖춘 중소기업 확인',
  law: '중소기업 기술혁신 촉진법 제15조',
  sources: [
    { name: '기술혁신형 중소기업(Inno-Biz) 제도 운영규정', version: '중소벤처기업부고시 제2026-44호', effective: '2026-06-22', url: 'https://www.law.go.kr/LSW/admRulLsInfoR.do?admRulSeq=2100000280952' },
    { name: '이노비즈넷 인증 안내', version: '공식 누리집', effective: '2026-02-01', url: 'https://www.innobiz.net/authen/authen2_1.asp' },
  ],
  checkedAt: RULES_CHECKED_AT,
  // P1 재확인(2026-10-07): 별표3 기술혁신시스템 평가표(4부문 1,000점 · 업종별 배점) · 별표4 연장 평가표(100점 · 60점 이상) 원문 확인
  unverified: [
    '기술보증기금 개별기술수준 평가표의 항목별 배점(이노비즈넷 한글 파일 — 4영역 · 약 34항목 · 14등급까지만 확인)',
    '혜택 숫자(보증료 · 조달 가점 · 세무조사 유예 기간)는 이노비즈넷 안내 기준 — 기보 · 조달청 · 국세청 규정 원문 대조 전',
    '소프트웨어업 · 바이오업 · 환경업 평가표에 해당하는 KSIC 범위(별표1 산업분류표) — 화면은 KSIC 로 제조 · 건설 · 농업 · 전문디자인 · 비제조업까지만 정함',
  ],
  validYears: 3,
  renewalNote: '확인서 발급일부터 3년(제12조④). 만료 90일 전부터 만료 후 30일까지 연장 신청(제15조①) — 만료 전에 확정되려면 만료 35일 전까지 신청. 연장은 기술 · 경영진단 60점 이상(별표4). 만료 후 30일이 지나면 신규로. 연장되면 번호 앞에 R.',
  prepareDaysBefore: 90,
  renewal: { noticeDays: 120, todoDays: 90, graceDaysAfter: 30, why: '운영규정 제15조① — 만료 90일 전부터 만료 후 30일까지 연장 신청(만료 전 확정은 35일 전까지 신청)' },
  officialScores: [
    { label: '온라인 자가진단', value: '1,000점 중 650점 이상이어야 현장평가 신청' },
    { label: '현장평가(기술보증기금)', value: '기술혁신시스템 700점 이상 그리고 기술평가등급 B등급 이상' },
    { label: '확인서 등급', value: '700~799점 A · 800~899점 AA · 900점 이상 AAA' },
    { label: '기술혁신시스템 평가표(별표3, 제조업)', value: '기술혁신능력 300 · 기술사업화능력 300 · 기술혁신경영능력 200 · 기술혁신성과 200(업종마다 배점 다름)' },
    { label: '연장(별표4 기술 · 경영진단)', value: '100점 중 60점 이상' },
  ],
  procedure: ['이노비즈넷 가입 · 재무 입력', '온라인 자가진단(650점 이상)', '기술사업계획서 작성', '수수료 납부(신규 77만원)', '기술보증기금 현장평가', '지방중소벤처기업청 확인서 발급'],
  fee: '신규 77만원 · 연장 44만원(부가세 포함 · 운영규정 제18조 70만 · 40만원 + 부가세). 벤처(연구개발기업 유형) 확인 6개월 안이면 신규 55만 · 연장 33만원',
  benefits: [
    { id: 'kibo', title: '기술보증 우대', detail: '기술보증기금 보증에서 우대받을 수 있음(한도 · 보증료 — 기보 심사로 정해짐)', tags: ['guarantee', 'funding'], conditional: true, figure: '한도 30억→50억(최대 70억) · 보증료 0.2%p 감면', source: INNOBIZ_BENEFIT_SRC, target: '기보 보증을 쓰는 업체 · 심사 결과에 따라' },
    { id: 'procurement', title: '조달 · 공공 입찰 가점', detail: '조달청 적격심사 신인도 가점을 받을 수 있음 — 공고별 확인', tags: ['procurement', 'trust'], conditional: true, figure: '물품 2.0~2.5점 · 일반용역 1.5점', source: INNOBIZ_BENEFIT_SRC, target: '조달 입찰에 참여하는 업체' },
    { id: 'tax_audit', title: '정기 세무조사 유예', detail: '국세청 정기 세무조사 선정에서 유예될 수 있음', tags: ['tax_audit'], conditional: true, figure: '수도권 2년 · 지방 3년 · 관세조사 1년', source: INNOBIZ_BENEFIT_SRC, target: '국세청 요건에 맞는 업체' },
    { id: 'patent_fast', title: '특허 우선심사', detail: '특허 출원 우선심사를 신청할 수 있음', tags: ['ip'], conditional: true, source: INNOBIZ_BENEFIT_SRC, target: '특허를 출원하는 업체' },
    { id: 'rnd', title: '정부 R&D 우대', detail: '중기부 R&D 과제에서 우대되는 사업이 있음 — 공고별 확인', tags: ['rnd'], conditional: true, source: INNOBIZ_BENEFIT_SRC },
    { id: 'military', title: '병역지정업체 가점', detail: '산업기능요원 · 전문연구요원 지정에 가점이 있음', tags: ['hiring'], conditional: true, figure: '산업기능요원 4점 · 전문연구요원 5점', source: INNOBIZ_BENEFIT_SRC, target: '병역지정업체를 신청하는 업체' },
    { id: 'escrow', title: '기술임치 수수료 감면', detail: '기술임치 수수료를 감면받을 수 있음', tags: ['ip'], conditional: true, figure: '1/3 감면', source: INNOBIZ_BENEFIT_SRC },
  ],
  evidence: [
    { id: 'fin3', label: '최근 3년 재무제표', why: '이노비즈넷 재무 입력 · 현장평가 재무 지표' },
    { id: 'biz_reg', label: '사업자등록증', why: '기본 확인' },
    { id: 'lab_cert', label: '기업부설연구소 · 전담부서 인정서', why: '기술개발 체제(연구조직) 증빙' },
    { id: 'patent', label: '특허 · 지식재산권 등록증', why: '기술 혁신 성과 증빙' },
    { id: 'rnd_records', label: '연구개발 과제 · 연구노트 기록', why: '기술개발 활동 증빙' },
    { id: 'org_chart', label: '조직도 · 인력 현황', why: '기술 인력 · 조직 체계' },
    { id: 'biz_plan', label: '기술사업계획서', why: '현장평가 제출 자료' },
    { id: 'quality', label: '품질 · 인증 현황(ISO 등)', why: '기술사업화 · 품질 관리 증빙' },
  ],
}

const MAINBIZ: CertRule = {
  key: 'mainbiz',
  label: '메인비즈',
  summary: '경영혁신형 중소기업 — 경영 혁신 활동으로 경쟁력을 높인 중소기업 확인',
  law: '중소기업 기술혁신 촉진법 제15조의3',
  sources: [
    { name: '경영혁신형 중소기업(Main-Biz) 제도 운영규정', version: '중소벤처기업부고시 제2026-45호', effective: '2026-06-22', url: 'https://www.law.go.kr/LSW/admRulLsInfoR.do?admRulSeq=2100000280984' },
    { name: '중소벤처24 메인비즈 안내', version: '공식 누리집', effective: '2026-06-22', url: 'https://www.smes.go.kr/mainbiz' },
    { name: '중소벤처24 메인비즈 절차 및 방법(현장평가 준비서류)', version: '공식 누리집', effective: '2026-10-07', url: 'https://www.smes.go.kr/mainbiz/usr/mainbizInfo/mainbizGuide.do' },
  ],
  checkedAt: RULES_CHECKED_AT,
  // P1 재확인(2026-10-07): 별표1 원문 — 평가 영역은 3영역(경영혁신인프라 350 · 활동 400 · 성과 250). '4영역' 으로 보였던 것은
  // 중소벤처24 '현장평가 질문 예시'(전략기획 · 성과관리 · 조직인력 · 사회신뢰) — 3영역 안의 지표다(상이 아님).
  // AX 재확인(2026-10-07): 별표1 은 2022-04-01 개정판 그대로 — 2026 개정(06-22)은 법령위반 제외 조항만 더했다. '2026 새 평가지표' 공식 근거 없음.
  unverified: ['혜택 숫자(보증료 · 조달 가점 · 세무조사 유예 기간)는 중소벤처24 안내 기준 — 기관 규정 원문 대조 전'],
  conflicts: ['제외 업종 — 운영규정 제3조①은 "게임 · 도박 · 사행성 · 불건전 소비업종에 해당하는 다음 각 호" 라고만 하고 각 호가 없음. KSIC 목록은 메인비즈넷 제도안내에만 있음 → 코드가 확인될 때만 제외로 판정'],
  validYears: 3,
  renewalNote: '확인서 발급일부터 3년(제12조③). 만료 90일 전부터 만료 후 30일까지 연장 신청(제15조①) — 만료 전에 확정되려면 만료 35일 전까지 신청. 연장은 경영혁신 진단 700점 이상(별표2). 연장되면 번호 앞에 R.',
  prepareDaysBefore: 90,
  renewal: { noticeDays: 120, todoDays: 90, graceDaysAfter: 30, why: '운영규정 제15조① — 만료 90일 전부터 만료 후 30일까지 연장 신청(만료 전 확정은 35일 전까지 신청)' },
  officialScores: [
    { label: '자가진단', value: '600점 이상' },
    { label: '현장평가(신용보증기금 · 기술보증기금 · 한국생산성본부 중 선택)', value: '1,000점 중 700점 이상' },
    { label: '다른 길', value: '생산성경영시스템(PMS) 3등급 이상 · 인증 후 1년 이내면 자가진단 없이 신청' },
    { label: '평가 영역(별표1)', value: '경영혁신인프라 350 · 경영혁신활동 400 · 경영혁신성과 250 = 1,000점(가족친화기업 가점 20)' },
    { label: '업종 구분(제4조③)', value: '제조 · 도소매 · 건설 · 지식서비스 · 일반서비스 — 지표는 업종별, 영역 배점은 같음' },
    { label: '신청 제외(제3조②)', value: '부채비율 1,000% 이상 · 완전자본잠식 · 연체 · 어음 거래정지 · 파산 · 회생 · 최근 3년 체불 명단공개 · 산재 공표 등' },
  ],
  procedure: ['중소벤처24 기업 등록', '자가진단(600점 이상)', '현장평가 신청 · 평가기관 선택', '현장평가(700점 이상)', '지방중소벤처기업청 선정', '중소벤처24에서 확인서 발급'],
  fee: '신규 55만원 · 연장 44만원(부가세 포함 · 운영규정 제18조 50만 · 40만원 + 부가세)',
  benefits: [
    { id: 'tax_audit', title: '정기 세무조사 유예', detail: '국세청 정기 세무조사에서 유예될 수 있음', tags: ['tax_audit'], conditional: true, figure: '수도권 최대 2년 · 지방 최대 3년 · 관세조사 1년', source: MAINBIZ_BENEFIT_SRC, target: '처음 받은 확인서 유효기간(3년) 안에서만' },
    { id: 'guarantee', title: '보증료 감면', detail: '신용보증기금 · 기술보증기금 보증료를 감면받을 수 있음', tags: ['guarantee', 'funding'], conditional: true, figure: '신보 0.1%p(협회 정회원 0.2%p) · 기보 0.1%p', source: MAINBIZ_BENEFIT_SRC, target: '보증을 쓰는 업체' },
    { id: 'procurement', title: '조달 적격심사 가점', detail: '조달청 적격심사 신인도 가점을 받을 수 있음 — 공고별 확인', tags: ['procurement', 'trust'], conditional: true, figure: '물품 2점(제조기업 자기 제품 2.5점) · 일반용역 1.5점', source: MAINBIZ_BENEFIT_SRC, target: '조달 입찰에 참여하는 업체' },
    { id: 'rnd', title: '중기부 R&D · 수출 사업 가점', detail: '중기부 R&D · 수출 지원사업에서 가점이 있는 사업이 있음 — 공고별 확인', tags: ['rnd'], conditional: true, figure: '가점 1점(사업별)', source: MAINBIZ_BENEFIT_SRC },
    { id: 'military', title: '병역지정업체 가점', detail: '산업기능요원 지정에 가점이 있음', tags: ['hiring'], conditional: true, figure: '산업기능요원 4점', source: MAINBIZ_BENEFIT_SRC, target: '병역지정업체를 신청하는 업체' },
  ],
  evidence: [
    { id: 'fin3', label: '최근 3년 재무제표', why: '부채비율 · 자본잠식 확인 · 경영 성과' },
    { id: 'biz_reg', label: '사업자등록증', why: '기본 확인' },
    { id: 'vision', label: '경영 목표 · 사업계획(연간)', why: '전략 기획 증빙' },
    { id: 'kpi', label: '성과 관리 기록(목표 · 실적 회의록)', why: '성과 관리 증빙' },
    { id: 'hr_rules', label: '취업규칙 · 인사 · 교육 기록', why: '조직 · 인적자원 증빙' },
    { id: 'org_chart', label: '조직도 · 인력 현황', why: '조직 체계' },
    { id: 'esg', label: '사회공헌 · 윤리 · 안전 활동 기록', why: '사회적 신뢰(ESG) 증빙' },
    { id: 'customer', label: '고객 만족 · 품질 개선 기록', why: '경영 혁신 활동 증빙' },
  ],
}

const VENTURE: CertRule = {
  key: 'venture',
  label: '벤처기업',
  summary: '벤처기업확인 — 투자 · 연구개발 · 혁신성장 유형 중 하나로 확인',
  law: '벤처기업육성에 관한 특별법 제2조의2',
  sources: [
    { name: '벤처기업육성에 관한 특별법 · 시행령', version: '법률 제21447호 · 대통령령 제36480호', effective: '2026-07-01', url: 'https://www.law.go.kr' },
    { name: '벤처기업확인요령', version: '중소벤처기업부고시 제2026-68호', effective: '2026-08-20', url: 'https://www.law.go.kr/LSW/admRulLsInfoR.do?admRulSeq=2100000284090' },
    { name: '벤처기업확인제도 가이드북(별표1 업종 코드)', version: '2023 · 벤처확인종합관리시스템', effective: '2023-01-01', url: 'https://www.smes.go.kr/venturein' },
  ],
  checkedAt: RULES_CHECKED_AT,
  // P1 재확인(2026-10-07): 확인요령 별표1(업종별 연구개발 투자비율) 원문 확인 → VENTURE_RND_RATIO
  unverified: ['벤처기업확인서 발급번호 형식(고시에 형식 없음 — 서식은 "제 호" 뿐)', "별표1 '인터넷산업' 줄의 업종 코드(가이드북에도 코드 없음 — 기타 산업과 같은 5%)"],
  validYears: 3,
  renewalNote: '확인일부터 3년(시행령 제18조의4). 2027-02-19까지는 만료 2개월 전 ~ 만료 후 1개월 안에 재확인을 신청하면 이어짐(이전 확인요령 제19조). 2027-02-20부터는 만료 6개월 전 안내 · 만료 전에 확인받으려면 만료 140일 전까지 신청(고시 제2026-68호 제19조, 고시 후 6개월 뒤 시행). 화면 준비일은 더 이른 쪽(140일 전)으로 잡음.',
  prepareDaysBefore: 150,
  renewal: { noticeDays: 180, todoDays: 150, graceDaysAfter: 0, why: '확인요령 제19조(2027-02-20 시행) — 만료 140일 전까지 재확인 신청해야 만료 전 확인(6개월 전 안내). 그 전까지는 만료 2개월 전 ~ 만료 후 1개월' },
  procedure: ['유형 고르기(투자 · 연구개발 · 혁신성장 · 예비벤처)', '벤처확인종합관리시스템 신청', '확인기관 평가', '벤처기업확인위원회 심의', '확인서 발급'],
  benefits: [
    { id: 'tax_credit', title: '세제 혜택 검토', detail: '창업벤처 세액감면 등 — 요건 · 시기 확인 필요', tags: ['tax_credit'], conditional: true },
    { id: 'funding', title: '정책자금 · 보증 연계', detail: '정책자금 · 보증 심사에서 우대될 수 있음', tags: ['funding', 'guarantee'], conditional: true },
    { id: 'trust', title: '대외 신뢰', detail: '투자 유치 · 거래처 신뢰', tags: ['trust'], conditional: false },
    { id: 'hiring', title: '병역지정업체 · 인력', detail: '산업기능요원 등 가점', tags: ['hiring'], conditional: true },
  ],
  evidence: [
    { id: 'biz_reg', label: '사업자등록증', why: '기본 확인' },
    { id: 'fin3', label: '최근 재무제표', why: '매출 대비 연구개발비 · 성장성' },
    { id: 'lab_cert', label: '기업부설연구소 · 전담부서 인정서', why: '연구개발유형 필수' },
    { id: 'patent', label: '특허 · 지식재산권', why: '혁신성 증빙' },
    { id: 'biz_plan', label: '사업계획서', why: '혁신성장유형 평가' },
  ],
}

const LAB: CertRule = {
  key: 'lab',
  label: '기업부설연구소',
  summary: '기업부설연구소 · 연구개발전담부서 인정',
  law: '기업부설연구소등의 연구개발 지원에 관한 법률(2026-02-01 시행)',
  sources: [
    { name: '기업부설연구소등의 연구개발 지원에 관한 법률 · 시행령', version: '법률 제21309호 · 대통령령 제36055호', effective: '2026-02-01', url: 'https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=282553' },
    { name: '같은 법 시행규칙(연구공간 · 연구전담요원 자격)', version: '과학기술정보통신부령 제163호', effective: '2026-02-01', url: 'https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=283223' },
  ],
  checkedAt: RULES_CHECKED_AT,
  // P1 재확인(2026-10-07): 시행규칙(과기정통부령 제163호) 연구공간 · 연구전담요원 자격 원문 확인
  unverified: [],
  validYears: null,
  renewalNote: '유효기간은 없음. 연구전담요원 수 · 독립 공간을 계속 지키고, 회사(이름 · 소재지 · 대표자 · 업종) · 연구소(연구소장 · 연구개발인력 · 연구공간)가 바뀌면 30일 안에 변경 신고(시행령 제7조④ · 시행규칙 제5조①) — 1년 넘게 안 하면 인정이 취소될 수 있음(법 제8조①).',
  prepareDaysBefore: 0,
  procedure: ['연구전담요원 · 공간 갖추기', 'KOITA 신청', '서류 · 현장 확인', '인정서 발급', '변경 신고 · 요건 유지'],
  benefits: [
    { id: 'tax_credit', title: '연구개발 세액공제', detail: '연구 · 인력개발비 세액공제를 검토할 수 있음 — 요건 · 금액은 세무사 확인', tags: ['tax_credit', 'rnd'], conditional: true, figure: '일반 연구 · 인력개발비 당기분 중소기업 25%', source: '조세특례제한법 제10조(2026-09-18 시행) — 2026-10-07 확인 · 인건비 인정 범위(시행령 별표6)는 확인 전', target: '연구소 · 전담부서 인력의 연구개발비' },
    { id: 'venture_path', title: '벤처 연구개발유형 · 이노비즈 기반', detail: '연구조직이 벤처 · 이노비즈 평가의 핵심 증빙', tags: ['rnd', 'trust'], conditional: false },
    { id: 'hiring', title: '전문연구요원', detail: '병역특례 전문연구요원 신청 기반', tags: ['hiring'], conditional: true },
  ],
  officialScores: [
    { label: '연구전담요원(시행령 제6조①)', value: '소기업 3명(창업 3년 안 2명) · 중기업 5명(소기업에서 커진 뒤 1년은 3명) · 연구원 · 교원 창업 · 벤처 2명 · 중견 7명 · 그 밖 10명 · 전담부서 1명' },
    { label: '연구공간(시행규칙 제2조②)', value: '고정 벽 · 별도 출입문. 중소 · 벤처 · SW 기업이 50㎡ 넘게 확보할 수 없으면 칸막이로 구분 가능' },
    { label: '연구전담요원 자격(시행규칙 제2조④)', value: '자연계 학사 이상 · 기사 이상(중소기업은 전문학사 + 경력 2년 · 산업기사 + 2년 등도)' },
  ],
  evidence: [
    { id: 'researchers', label: '연구전담요원 학력 · 경력 자료', why: '인원 요건' },
    { id: 'lab_space', label: '연구공간 도면 · 사진', why: '독립 공간 요건' },
    { id: 'org_chart', label: '조직도', why: '연구조직 확인' },
  ],
}

const ISO_COMMON = {
  checkedAt: RULES_CHECKED_AT,
  prepareDaysBefore: 90,
  renewal: { noticeDays: 120, todoDays: 90, graceDaysAfter: 0, why: '인증기관 갱신심사 일정(3년) — 인증기관과 심사 날짜를 먼저 잡기' },
  renewalNote: '인증 후 매년 사후심사 · 3년마다 갱신심사(인증기관 일정).',
  validYears: 3,
  procedure: ['필요한 표준 고르기', '인증기관(KAB 인정) 선택 · 견적', '문서 · 절차 갖추기(매뉴얼 · 기록)', '내부심사 · 경영검토', '인증심사(1 · 2단계)', '인증서 · 매년 사후심사'],
}

const ISO9001: CertRule = {
  ...ISO_COMMON,
  key: 'iso9001',
  label: 'ISO 9001',
  summary: '품질경영시스템 — B2B 납품 · 품질 관리 체계가 중요한 업체에서 검토',
  law: '국제표준(인증은 KAB 인정 인증기관)',
  sources: [
    { name: 'ISO 9001:2026 (제6판)', version: '2026-09-16 발행', effective: '2026-09-16', url: 'https://committee.iso.org/sites/tc176/home/news/content-left-area/news-and-updates/news.html' },
    { name: 'Global ACI 전환 요건(ISO 9001:2026)', version: 'Global ACI-TECH-3-TR 2029-09-30 (M)', effective: '2026-09-16', url: 'https://global-aci.org/en/news/global-aci-publishes-transition-requirements-for-iso-90012026/' },
    { name: '한국인정평가원 ISO 9001:2026 전환지침 공고', version: 'KAB-TR-QMS/26-6', effective: '2026-10-07', url: 'https://kab.or.kr/kor/bbs/B0000092/view.do?nttId=8233&menuNo=400014' },
    { name: '한국인정평가원(KAB) 인증기관 현황', version: '공식 누리집', effective: '2026-10-07', url: 'https://kab.or.kr/kor/kcn/kcn/list.do?pSiteId=kor&schParent=1&menuNo=400010' },
  ],
  unverified: [],
  renewalNote: '2028-03-31 부터 신규 인증은 2026판으로만. 2015판 인증은 2029-09-30 까지 2026판으로 전환. 매년 사후심사 · 3년 갱신.',
  benefits: [
    { id: 'trust', title: '거래처 · 납품 신뢰', detail: '대기업 · 공공 납품에서 품질 체계 증빙', tags: ['trust', 'procurement'], conditional: false },
    { id: 'procurement', title: '입찰 · 조달 평가', detail: '입찰에서 가점 · 참가 자격이 되는 경우가 있음', tags: ['procurement'], conditional: true },
    { id: 'export', title: '수출 · 해외 거래', detail: '해외 바이어 요구', tags: ['export'], conditional: true },
  ],
  evidence: [
    { id: 'org_chart', label: '조직도', why: '책임 · 권한' },
    { id: 'quality', label: '품질 관리 현황 · 공정도', why: '품질 체계 출발점' },
    { id: 'biz_reg', label: '사업자등록증', why: '기본 확인' },
  ],
}

const ISO14001: CertRule = {
  ...ISO_COMMON,
  key: 'iso14001',
  label: 'ISO 14001',
  summary: '환경경영시스템 — 환경 관리 요구가 있는 업종(제조 · 건설 · 화학 등)에서 검토',
  law: '국제표준(인증은 KAB 인정 인증기관)',
  sources: [
    { name: 'ISO 14001:2026 (제4판)', version: '2026-04-15 발행', effective: '2026-04-15', url: 'https://www.iso.org/news/2026/04/iso-14001-2026-published' },
    { name: 'Global ACI 전환 요건(ISO 14001:2026)', version: 'Global ACI-TECH-3-TR 2029-04-30 (M)', effective: '2026-09-14', url: 'https://global-aci.org/en/news/global-aci-publishes-transition-requirements-for-iso-140012026/' },
    { name: '한국인정평가원 ISO 14001:2026 전환지침 공고', version: 'KAB-TR-EMS 26-5', effective: '2026-10-07', url: 'https://kab.or.kr/kor/bbs/B0000092/view.do?nttId=8232&menuNo=400014' },
  ],
    // AX: 발행일은 ISO 소식(2026-04-15)으로 확인 — 예전 '발행일 확인 못 함' 은 출처와 모순이라 지웠다
  unverified: [],
  renewalNote: '2027-10-31 부터 신규 인증은 2026판으로만. 2015판 인증은 2029-04-30 까지 2026판으로 전환(Global ACI — IAF 를 이은 국제인정협력기구). 매년 사후심사 · 3년 갱신.',
  benefits: [
    { id: 'trust', title: '거래처 환경 요구 대응', detail: '대기업 협력사 · 해외 바이어 환경 요구', tags: ['trust', 'export'], conditional: false },
    { id: 'procurement', title: '입찰 · 녹색 조달', detail: '공공 입찰 평가에 쓰이는 경우가 있음', tags: ['procurement'], conditional: true },
  ],
  evidence: [
    { id: 'org_chart', label: '조직도', why: '책임 · 권한' },
    { id: 'env', label: '환경 관련 인허가 · 배출 관리 현황', why: '환경 측면 파악' },
  ],
}

const ISO45001: CertRule = {
  ...ISO_COMMON,
  key: 'iso45001',
  label: 'ISO 45001',
  summary: '안전보건경영시스템 — 현장 · 제조 · 건설처럼 안전보건 관리가 중요한 사업장에서 검토',
  law: '국제표준(인증은 KAB 인정 인증기관)',
  sources: [
    { name: 'ISO 45001:2018 + Amd 1:2024', version: '현재 유효판', effective: '2024-02-01', url: 'https://www.iso.org/standard/88428.html' },
    { name: 'ISO/TC 283 개정 소식', version: '개정판 준비 중(ISO 안내: 2027년 상반기 예상)', effective: '2026-06-18', url: 'https://committee.iso.org/sites/tc283/home/news/content-left-area/news-and-updates/news.html' },
  ],
  // AX: 투표 마감일 같은 개정 과정 날짜는 화면에 내지 않는다 — 발행 전까지 2018 + Amd 1:2024 가 유효
  unverified: ['개정판 발행 시점 — ISO 는 2027년 상반기 예상으로만 안내(확정 발표 없음) · 발행 전까지 지금 판으로 인증'],
  benefits: [
    { id: 'trust', title: '안전보건 체계 증빙', detail: '원청 · 발주처 안전보건 요구 대응', tags: ['trust', 'procurement'], conditional: false },
    { id: 'procurement', title: '입찰 · 협력사 평가', detail: '협력사 평가 · 입찰에서 쓰이는 경우가 있음', tags: ['procurement'], conditional: true },
  ],
  evidence: [
    { id: 'org_chart', label: '조직도', why: '책임 · 권한' },
    { id: 'safety', label: '안전보건 관리 기록 · 위험성평가', why: '안전보건 체계 출발점' },
  ],
}

export const CERT_RULES: Record<CertificationKey, CertRule> = {
  venture: VENTURE,
  lab: LAB,
  innobiz: INNOBIZ,
  mainbiz: MAINBIZ,
  iso9001: ISO9001,
  iso14001: ISO14001,
  iso45001: ISO45001,
}

// 업종(이노비즈 8가지 평가표 · 별표2 제외 · 메인비즈 제외)은 rules/industryMap.ts — KSIC 코드로만 확정한다(AX)

/** 기업부설연구소 연구전담요원 기준(시행령 제6조) */
export const LAB_RESEARCHERS = {
  venture: 2,
  small: 3,
  smallStartup: 2,
  medium: 5,
  mediumFromSmallFirstYear: 3,
  midLarge: 7,
  large: 10,
  dept: 1,
} as const

/** 벤처 연구개발유형(시행령 제2조의3) */
export const VENTURE_RND = { minExpenseWon: 50_000_000, minRatio: 0.05 } as const

/**
 * 벤처 연구개발유형 — 업종별 연구개발 투자비율(%) · 매출 50억 미만 / 50~100억 / 100억 이상
 * (확인요령 별표1, 고시 제2026-68호 — 업종 코드는 벤처기업확인제도 가이드북 2023 p.12).
 * AX: 세부 업종(KSIC)을 모르면 비율을 고르지 않는다 — '제조업이면 5%' 같은 기본값 없음(기계 7% · 의료 · 정밀 8% 등 업종마다 다르다).
 * 법 제2조의2①2호나목 단서: 창업 3년 미만은 매출 대비 비율 미적용(5천만원 이상은 그대로).
 */
export const VENTURE_RND_RATIO: { row: string; ksic: string[]; pct: [number, number, number] }[] = [
  { row: '의약품', ksic: ['21'], pct: [6, 6, 6] },
  { row: '사무용기계 및 장비', ksic: ['2918'], pct: [6, 6, 5] },
  { row: '기계 및 장비 제조(사무용기계 제외)', ksic: ['29'], pct: [7, 5, 5] },
  { row: '컴퓨터 및 주변장치', ksic: ['263'], pct: [6, 6, 5] },
  { row: '반도체 및 전자부품', ksic: ['261', '262'], pct: [6, 5, 5] },
  { row: '전기장비', ksic: ['28'], pct: [6, 5, 5] },
  { row: '의료 · 정밀 · 광학기기 및 시계', ksic: ['27'], pct: [8, 7, 6] },
  { row: '도매 및 소매업', ksic: ['45', '46', '47'], pct: [5, 5, 5] },
  { row: '통신업', ksic: ['61'], pct: [7, 5, 5] },
  { row: '소프트웨어 개발 · 공급업', ksic: ['582'], pct: [10, 8, 8] },
  { row: '컴퓨터 프로그래밍 · 시스템 통합 관리업', ksic: ['62'], pct: [10, 8, 8] },
  { row: '정보서비스업', ksic: ['63'], pct: [10, 8, 8] },
]
const VENTURE_OTHER_MFG = { row: '기타 제조업', pct: [5, 5, 5] as [number, number, number] }
const VENTURE_OTHER = { row: '기타 산업', pct: [5, 5, 5] as [number, number, number] }

/**
 * KSIC(숫자) · 매출(원) → 별표1 비율(소수) · 그 줄 이름. KSIC 가 없거나 너무 짧아 줄이 갈리면(예: '29' → 기계 7% · 사무용기계 6%) null = 세부 업종 확인 필요.
 */
export function ventureRndRatio(ksic: string | null | undefined, revenue: number | null): { ratio: number; row: string } | null {
  if (!ksic || !/^\d{2,5}$/.test(ksic)) return null
  const band = revenue === null || revenue < 5_000_000_000 ? 0 : revenue < 10_000_000_000 ? 1 : 2
  let best: { p: string; line: (typeof VENTURE_RND_RATIO)[number] } | null = null
  for (const line of VENTURE_RND_RATIO) for (const p of line.ksic) if (ksic.startsWith(p) && (!best || p.length > best.p.length)) best = { p, line }
  // 더 세부 줄이 이 코드 아래에 있고 비율이 다르면 아직 모른다
  const deeper = VENTURE_RND_RATIO.filter((l) => l.ksic.some((p) => p.length > ksic.length && p.startsWith(ksic)))
  const pick = best ? best.line : null
  const mfg = Number(ksic.slice(0, 2)) >= 10 && Number(ksic.slice(0, 2)) <= 34
  const base = pick ?? (mfg ? VENTURE_OTHER_MFG : VENTURE_OTHER)
  if (deeper.some((l) => l.pct.join() !== base.pct.join())) return null
  return { ratio: base.pct[band] / 100, row: base.row }
}

/** 공식 기준 신선도 — 마지막 확인에서 FRESH_DAYS 넘게 지났나 */
export function rulesStale(rule: CertRule, today: string): boolean {
  const a = Date.parse(`${rule.checkedAt}T00:00:00Z`)
  const b = Date.parse(`${today}T00:00:00Z`)
  return Number.isFinite(a) && Number.isFinite(b) && (b - a) / 86_400_000 > FRESH_DAYS
}

/**
 * FV: 고객에게 자료를 부탁할 때 쓰는 말 — 내부 용어 대신 '무엇을 보내면 되는지'. 없는 자료를 새로 만들라고 하지 않는다.
 * 증빙 id 하나에 한 줄(인증마다 이름이 조금 달라도 같은 자료).
 */
export const EVIDENCE_ASK: Record<string, string> = {
  biz_reg: '사업자등록증 사본',
  fin3: '최근 3년 재무제표(세무사 사무실에 요청하시면 바로 받을 수 있습니다)',
  lab_cert: '기업부설연구소(또는 연구개발전담부서) 인정서',
  patent: '특허 · 상표 등록증 사본',
  rnd_records: '최근 개발 과제나 연구 기록이 있다면 보내 주세요. 예: 연구노트, 개발 보고서, 시험 성적서',
  org_chart: '조직도와 직원 명단(부서 · 직책). 엑셀이나 사진도 괜찮습니다',
  biz_plan: '회사 소개서나 사업계획서(최근 것)',
  quality: '품질 관련 인증서(ISO 등)나 검사 기록이 있다면 보내 주세요',
  vision: '올해 사업계획이나 목표를 적어 둔 자료가 있다면 보내 주세요',
  kpi: '목표 · 실적을 점검한 자료가 있다면 보내 주세요. 예: 월간 회의록, 실적 보고 엑셀',
  hr_rules: '취업규칙과 직원 교육을 한 기록(교육 일지 · 사진 등)',
  esg: '봉사 · 기부 · 안전교육 같은 활동 기록이 있다면 보내 주세요. 예: 사진, 영수증, 교육 일지',
  customer: '고객 불만 처리나 만족도 조사 기록이 있다면 보내 주세요. 예: 상담 기록, 설문 결과',
  researchers: '연구원 학력 · 경력 자료(졸업증명서 · 경력증명서)',
  lab_space: '연구 공간 사진과 간단한 도면(손으로 그린 것도 괜찮습니다)',
  env: '환경 관련 인허가 서류나 배출 관리 기록',
  safety: '안전보건 관리 기록(안전교육 일지 · 점검표 등)',
}

/**
 * 자료의 근거 구분 (FV Final) — OS 가 '필수' 라고 말하는 것은 정말 공식 필수여야 한다.
 *   official  : 공식 기관 안내의 제출서류 목록에 '권장' 표시 없이 있는 것 — 없으면 제출 전 확인에서 '반드시 확인'
 *   if_held   : 공식 목록에 있지만 보유한 경우에만 내는 것(특허 등록원부 · 연구소 인정서 등)
 *   process   : 공식 절차 안에서 작성 · 입력하는 것(서류함 파일이 아니라 기관 시스템에서 작성)
 *   mirae     : 공식 필수라고 확인되지 않았지만 MIRAE 실무상 준비를 권하는 자료
 *   unverified: 공식 필수 여부를 확인하지 못함 — '필수' 라고 말하지 않는다
 * 공식 근거 순서: 법령 · 행정규칙 → 중소벤처기업부 → 운영기관(이노비즈넷 · 중소벤처24) → 평가기관. 블로그 · 컨설팅 글은 쓰지 않는다.
 */
export type EvidenceBasis = 'official' | 'if_held' | 'process' | 'mirae' | 'unverified'

export const EVIDENCE_BASIS_LABEL: Record<EvidenceBasis, string> = {
  official: '공식 제출서류',
  if_held: '공식 목록 · 해당 시',
  process: '공식 절차에서 작성',
  mirae: 'MIRAE 실무 준비자료',
  unverified: '공식 필수 여부 확인 필요',
}

export interface EvidenceClass {
  basis: EvidenceBasis
  /** 어디서 확인했나(공식 출처 · 확인일) — mirae · unverified 는 왜 그렇게 두었나 */
  source: string
}

const INNOBIZ_DOCS = '이노비즈넷 신규신청 · 현장평가 제출서류 표(innobiz.net/authen/authen2_1.asp, 2026-10-07 확인)'
const MAINBIZ_DOCS = '중소벤처24 메인비즈 절차 및 방법 · 현장평가 준비서류 표(smes.go.kr/mainbiz/usr/mainbizInfo/mainbizGuide.do, 2026-10-07 확인)'

/** 인증별 자료 근거 — 여기에 없는 이노비즈 · 메인비즈 자료는 'mirae'(실무 준비자료)로 본다 */
export const EVIDENCE_CLASS: Partial<Record<CertificationKey, Record<string, EvidenceClass>>> = {
  innobiz: {
    biz_reg: { basis: 'official', source: `${INNOBIZ_DOCS} 1번 — 사업자등록증 사본 또는 사업자등록증명원` },
    org_chart: { basis: 'official', source: `${INNOBIZ_DOCS} 3번 — 주주명부, 회사 조직도` },
    fin3: { basis: 'official', source: `${INNOBIZ_DOCS} 4번 — 표준재무제표증명원(최근 3개년)` },
    patent: { basis: 'if_held', source: `${INNOBIZ_DOCS} 10번 — 지식재산권 등록원부(보유 시)` },
    lab_cert: { basis: 'if_held', source: `${INNOBIZ_DOCS} 11번 — 연구소 · 전담부서 인정서(미보유 시 연구부서 증빙)` },
    biz_plan: { basis: 'process', source: '이노비즈넷 신청 절차 3단계 — 기술사업계획서는 이노비즈넷에서 작성(첨부 서류 아님)' },
    rnd_records: { basis: 'mirae', source: '공식 제출서류 표에 따로 없음 — 실사(기술혁신 활동) 설명용 실무 준비' },
    quality: { basis: 'if_held', source: `${INNOBIZ_DOCS} 13번 — 기타 증빙(각종 인증 등, 권장 · 보유 시)` },
  },
  mainbiz: {
    fin3: { basis: 'official', source: `${MAINBIZ_DOCS} 기본서류 — 표준재무제표 증명원(최근 3년)` },
    biz_reg: { basis: 'unverified', source: '중소벤처24 현장평가 준비서류 표에 없음 — 기업등록 단계에서 쓰지만 제출서류로는 확인 못 함' },
    vision: { basis: 'if_held', source: `${MAINBIZ_DOCS} 경영관련 — 경영계획서(필수 표시 없음)` },
    org_chart: { basis: 'if_held', source: `${MAINBIZ_DOCS} 경영관련 — 기업소개자료 · 조직도(자유양식)` },
    hr_rules: { basis: 'if_held', source: `${MAINBIZ_DOCS} 조직관리 — 기업 경영방침 · 사내규정` },
    customer: { basis: 'if_held', source: `${MAINBIZ_DOCS} 조직관리 — 고객관리 매뉴얼 등` },
    kpi: { basis: 'mirae', source: '공식 준비서류 표에 따로 없음 — 성과 관리(경영혁신 활동) 설명용 실무 준비' },
    esg: { basis: 'mirae', source: '공식 준비서류 표에 따로 없음 — 사회적 책임 설명용 실무 준비' },
  },
}

/** 자료 하나의 근거(인증별) — 표에 없으면 MIRAE 실무 준비자료 */
export function evidenceClassOf(cert: CertificationKey, id: string): EvidenceClass {
  return EVIDENCE_CLASS[cert]?.[id] ?? { basis: 'mirae', source: '공식 필수로 확인되지 않음 — MIRAE 실무 준비자료' }
}

/** 공식 안내에는 있지만 OS 서류함이 따로 챙기지 않는 서류(신청 직전 발급 · 1개월 이내 등) — 제출 전 확인에 한 줄로 */
export const OFFICIAL_FRESH_DOCS: Partial<Record<CertificationKey, string>> = {
  innobiz: '법인등기부등본 · 부가세 과세표준증명 · 국세 · 지방세 납세증명 · 4대보험 완납증명 · 가입자 명부(대부분 1개월 이내 발급분)',
  mainbiz: '법인등기부등본 · 신용정보조회서 · 산업재해율 조회(제조 · 건설)',
}

/** 화면 이름(라벨) → 증빙 id(여러 인증에서 같은 자료를 한 번만 부탁하려고) */
export function evidenceIdOf(label: string): string | null {
  for (const r of Object.values(CERT_RULES)) for (const e of r.evidence) if (e.label === label) return e.id
  return null
}

/** 고객에게 부탁할 말(없으면 화면 이름 그대로) */
export function evidenceAsk(idOrLabel: string): string {
  return EVIDENCE_ASK[idOrLabel] ?? EVIDENCE_ASK[evidenceIdOf(idOrLabel) ?? ''] ?? idOrLabel
}

/** 없는 자료를 만들라고 하지 않는다는 한 줄 — 자료 요청 글 끝에 */
export const NO_FABRICATE_LINE = '없는 자료는 "없음"이라고만 알려 주셔도 됩니다. 새로 만드실 필요는 없습니다.'
