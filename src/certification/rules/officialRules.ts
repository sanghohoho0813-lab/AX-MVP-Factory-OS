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
  unverified: ['기술보증기금 개별기술수준 평가표의 항목별 배점(이노비즈넷 한글 파일 — 4영역 · 약 34항목 · 14등급까지만 확인)'],
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
  fee: '신규 77만원 · 연장 44만원(부가세 포함)',
  benefits: [
    { id: 'kibo', title: '기술보증 우대', detail: '기술보증기금 보증 한도 상향 · 보증료 0.2%p 감면', tags: ['guarantee', 'funding'], conditional: true },
    { id: 'procurement', title: '조달 · 공공 입찰 가점', detail: '조달청 적격심사 가점(물품 2.0~2.5점 · 용역 1.5점)', tags: ['procurement', 'trust'], conditional: true },
    { id: 'tax_audit', title: '정기 세무조사 유예', detail: '국세청 정기 세무조사 선정 유예', tags: ['tax_audit'], conditional: true },
    { id: 'patent_fast', title: '특허 우선심사', detail: '특허 출원 우선심사 대상', tags: ['ip'], conditional: true },
    { id: 'rnd', title: '정부 R&D 우대', detail: '중기부 R&D 과제 우대', tags: ['rnd'], conditional: true },
    { id: 'military', title: '병역지정업체 가점', detail: '산업기능요원 · 전문연구요원 지정 가점', tags: ['hiring'], conditional: true },
    { id: 'escrow', title: '기술임치 수수료 감면', detail: '기술임치 수수료 1/3 감면', tags: ['ip'], conditional: true },
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
  ],
  checkedAt: RULES_CHECKED_AT,
  // P1 재확인(2026-10-07): 별표1 원문 — 평가 영역은 3영역(경영혁신인프라 350 · 활동 400 · 성과 250). '4영역' 으로 보였던 것은
  // 중소벤처24 '현장평가 질문 예시'(전략기획 · 성과관리 · 조직인력 · 사회신뢰) — 3영역 안의 지표다(상이 아님).
  unverified: [],
  validYears: 3,
  renewalNote: '확인서 발급일부터 3년(제12조③). 만료 90일 전부터 만료 후 30일까지 연장 신청(제15조①) — 만료 전에 확정되려면 만료 35일 전까지 신청. 연장은 경영혁신 진단 700점 이상(별표2). 연장되면 번호 앞에 R.',
  prepareDaysBefore: 90,
  renewal: { noticeDays: 120, todoDays: 90, graceDaysAfter: 30, why: '운영규정 제15조① — 만료 90일 전부터 만료 후 30일까지 연장 신청(만료 전 확정은 35일 전까지 신청)' },
  officialScores: [
    { label: '자가진단', value: '600점 이상' },
    { label: '현장평가(신용보증기금 · 기술보증기금 · 한국생산성본부 중 선택)', value: '1,000점 중 700점 이상' },
    { label: '다른 길', value: '생산성경영시스템(PMS) 3등급 이상 · 인증 후 1년 이내면 자가진단 없이 신청' },
    { label: '평가 영역(별표1)', value: '경영혁신인프라 350 · 경영혁신활동 400 · 경영혁신성과 250 = 1,000점(가족친화기업 가점 20)' },
  ],
  procedure: ['중소벤처24 기업 등록', '자가진단(600점 이상)', '현장평가 신청 · 평가기관 선택', '현장평가(700점 이상)', '지방중소벤처기업청 선정', '중소벤처24에서 확인서 발급'],
  fee: '신규 55만원 · 연장 44만원(부가세 포함)',
  benefits: [
    { id: 'tax_audit', title: '정기 세무조사 유예', detail: '국세청 정기 세무조사 유예 · 관세조사 1년 유예', tags: ['tax_audit'], conditional: true },
    { id: 'guarantee', title: '보증료 감면', detail: '신용보증기금 보증료 0.1~0.2%p · 기술보증기금 0.1%p 감면', tags: ['guarantee', 'funding'], conditional: true },
    { id: 'procurement', title: '조달 적격심사 가점', detail: '물품 2점 · 제조 2.5점 · 용역 1.5점', tags: ['procurement', 'trust'], conditional: true },
    { id: 'rnd', title: '중기부 R&D 가점', detail: '중소벤처기업부 R&D 과제 가점 1점', tags: ['rnd'], conditional: true },
    { id: 'military', title: '병역지정업체 가점', detail: '산업기능요원 지정 가점 4점', tags: ['hiring'], conditional: true },
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
  ],
  checkedAt: RULES_CHECKED_AT,
  // P1 재확인(2026-10-07): 확인요령 별표1(업종별 연구개발 투자비율) 원문 확인 → VENTURE_RND_RATIO
  unverified: ['벤처기업확인서 발급번호 형식(고시에 형식 없음 — 서식은 "제 호" 뿐)'],
  validYears: 3,
  renewalNote: '확인일부터 3년(시행령 제18조의4). 만료 6개월 전에 확인기관이 안내 — 끊김 없이 이어가려면 만료 140일 전까지 재확인 신청(확인요령 제19조).',
  prepareDaysBefore: 150,
  renewal: { noticeDays: 180, todoDays: 150, graceDaysAfter: 0, why: '확인요령 제19조 — 만료 140일 전까지 재확인을 신청해야 끊김 없이 이어짐(6개월 전 안내)' },
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
  renewalNote: '유효기간은 없음. 연구전담요원 수 · 독립 공간을 계속 지키고, 바뀌면 30일 안에 변경 신고(시행령 제7조②) — 1년 넘게 안 하면 인정이 취소될 수 있음(법 제8조①5호).',
  prepareDaysBefore: 0,
  procedure: ['연구전담요원 · 공간 갖추기', 'KOITA 신청', '서류 · 현장 확인', '인정서 발급', '변경 신고 · 요건 유지'],
  benefits: [
    { id: 'tax_credit', title: '연구개발 세액공제', detail: '연구 · 인력개발비 세액공제 — 요건 · 금액 세무사 확인', tags: ['tax_credit', 'rnd'], conditional: true },
    { id: 'venture_path', title: '벤처 연구개발유형 · 이노비즈 기반', detail: '연구조직이 벤처 · 이노비즈 평가의 핵심 증빙', tags: ['rnd', 'trust'], conditional: false },
    { id: 'hiring', title: '전문연구요원', detail: '병역특례 전문연구요원 신청 기반', tags: ['hiring'], conditional: true },
  ],
  officialScores: [
    { label: '연구전담요원(시행령 제6조)', value: '소기업 3명(창업 3년 안 2명) · 중기업 5명 · 연구원 · 교원 창업 · 벤처 2명 · 중견 7명 · 그 밖 10명 · 전담부서 1명' },
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
    { name: '한국인정평가원(KAB) 인정 인증기관', version: '공식 누리집', effective: '2026-01-01', url: 'https://kab.or.kr/kor/main/contents.do?menuNo=400064' },
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
    { name: 'ISO 14001:2026 (제4판)', version: '2026-04 발행', effective: '2026-04-15', url: 'https://www.iso.org/news/2026/04/iso-14001-2026-published' },
    { name: 'Global ACI 전환 요건(ISO 14001:2026)', version: 'Global ACI-TECH-3-TR 2029-04-30 (M)', effective: '2026-09-14', url: 'https://global-aci.org/en/news/global-aci-publishes-transition-requirements-for-iso-140012026/' },
  ],
  unverified: ['정확한 발행일(ISO 누리집 접속 막힘 — 발행 달은 Global ACI 안내)'],
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
    { name: 'ISO/TC 283 소식(개정 DIS 투표)', version: 'ISO/DIS 45001 — 투표 2026-08-09 마감', effective: '2026-06-18', url: 'https://committee.iso.org/sites/tc283/home/news/content-left-area/news-and-updates/news.html' },
  ],
  unverified: ['개정판 발행 시점 — ISO/TC 283 은 DIS 투표(2026-08-09 마감)까지만 공지, 발행 목표일 공식 발표 없음'],
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

/** 업종(대분류) — 이노비즈 신청 가능 업종(운영규정 제3조①) */
export const INNOBIZ_INDUSTRY_OK = ['manufacturing', 'construction', 'software', 'bio', 'environment', 'design', 'service', 'food'] as const

/** 메인비즈 제외 업종 낱말(게임 · 도박 · 사행성 · 불건전 소비) */
export const MAINBIZ_EXCLUDED_WORDS = /도박|사행|카지노|경마|복권|유흥|주점|게임장|성인/

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
 * 벤처 연구개발유형 — 업종별 연구개발 투자비율(%) · 매출 50억 미만 / 50~100억 / 100억 이상 (확인요령 별표1, 고시 제2026-68호).
 * 업체 업종은 대분류로만 알기 때문에 가장 가까운 줄을 쓰고 화면에 '세부 업종 확인' 을 붙인다.
 */
export const VENTURE_RND_RATIO: { row: string; groups: string[]; pct: [number, number, number] }[] = [
  { row: '소프트웨어 개발 · 공급업 · 정보서비스업', groups: ['software'], pct: [10, 8, 8] },
  { row: '의약품', groups: ['bio'], pct: [6, 6, 6] },
  { row: '기타 제조업(세부 업종: 기계 7/5/5 · 전기장비 6/5/5 · 반도체 · 전자부품 6/5/5 · 의료 · 정밀 · 광학 8/7/6)', groups: ['manufacturing', 'food'], pct: [5, 5, 5] },
  { row: '도매 및 소매업', groups: ['retail'], pct: [5, 5, 5] },
  { row: '기타 산업', groups: [], pct: [5, 5, 5] },
]

/** 매출(원)과 업종 대분류 → 별표1 비율(소수) · 그 줄 이름 */
export function ventureRndRatio(group: string, revenue: number | null): { ratio: number; row: string } {
  const line = VENTURE_RND_RATIO.find((r) => r.groups.includes(group)) ?? VENTURE_RND_RATIO[VENTURE_RND_RATIO.length - 1]
  const band = revenue === null || revenue < 5_000_000_000 ? 0 : revenue < 10_000_000_000 ? 1 : 2
  return { ratio: line.pct[band] / 100, row: line.row }
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

/** FV: 신청에 꼭 쓰는 자료(OS 기준 — 이게 없으면 제출 준비가 안 된 것). 나머지는 실사 · 평가 보강 자료 */
export const REQUIRED_EVIDENCE: Partial<Record<CertificationKey, readonly string[]>> = {
  innobiz: ['fin3', 'biz_reg', 'biz_plan'],
  mainbiz: ['fin3', 'biz_reg', 'vision'],
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
