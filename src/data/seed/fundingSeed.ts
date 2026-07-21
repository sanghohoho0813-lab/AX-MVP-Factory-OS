import type { Institution, SupportProgram } from '../../types/funding'

/**
 * 최소 참고 시드. 실제 최신 공고·금리·한도·접수기간을 담지 않는다.
 * 모든 항목은 reference_only 이며 lastVerifiedAt=null(최신성 unknown)이다.
 * 사용자가 공식 URL·확인일을 직접 입력해 검증한다.
 */
const SEED_ISO = '2026-01-01T00:00:00.000Z'

function inst(
  id: string,
  name: string,
  shortName: string,
  category: Institution['category'],
  description: string,
  typicalReviewFocus: string[],
  requiredBaselineEvidence: string[],
): Institution {
  return {
    id,
    name,
    shortName,
    category,
    description,
    officialUrl: '',
    contactChannels: [],
    regions: ['전국'],
    targetIndustries: [],
    targetCompanyStages: [],
    targetCompanySizes: ['중소기업', '소상공인'],
    typicalReviewFocus,
    requiredBaselineEvidence,
    cautionNotes: '실제 지원 조건·한도·금리·접수기간은 공식 공고에서 반드시 확인해야 합니다.',
    sourceStatus: 'reference_only',
    lastVerifiedAt: null,
    validUntil: null,
    createdAt: SEED_ISO,
    updatedAt: SEED_ISO,
    archivedAt: null,
  }
}

export const SEED_INSTITUTIONS: Institution[] = [
  inst('inst-kosme', '중소벤처기업진흥공단', '중진공', 'policy_finance', '중소·벤처기업 정책자금 융자·연수·수출 등을 지원하는 기관 (참고용).', ['사업성·기술성', '재무 건전성', '자금 용도 타당성'], ['사업자등록증', '재무제표', '사업계획서']),
  inst('inst-kodit', '신용보증기금', '신보', 'credit_guarantee', '기업의 채무를 보증해 금융기관 대출을 돕는 기관 (참고용).', ['신용도', '매출·현금흐름', '보증 필요성'], ['재무제표', '부가세 신고자료', '신용 정보']),
  inst('inst-kibo', '기술보증기금', '기보', 'technology_guarantee', '기술력 기반으로 보증을 제공하는 기관 (참고용).', ['기술성·혁신성', '기술 사업화 가능성', '연구개발 역량'], ['기술 관련 증빙', '지식재산권', '연구개발 인력 현황']),
  inst('inst-tipa', '중소기업기술정보진흥원', '기정원', 'rnd_support', '중소기업 연구개발(R&D) 지원 사업을 운영하는 기관 (참고용).', ['기술 개발 계획', '연구개발 체계', '사업화 계획'], ['연구개발계획서', '연구 인력·시설', '기술 근거']),
  inst('inst-kised', '창업진흥원', '창진원', 'startup_support', '창업기업 지원 사업을 운영하는 기관 (참고용).', ['창업 아이템 차별성', '팀 역량', '성장 가능성'], ['사업계획서', '창업 관련 증빙']),
  inst('inst-semas', '소상공인시장진흥공단', '소진공', 'startup_support', '소상공인 정책자금·교육·컨설팅을 지원하는 기관 (참고용).', ['업력·매출', '자금 용도', '상환 능력'], ['사업자등록증', '매출 증빙']),
  inst('inst-moel', '고용노동부·고용센터', '고용센터', 'employment_support', '고용창출·유지 관련 지원금을 운영하는 기관 (참고용).', ['고용 계획·실적', '고용유지 요건', '4대보험 가입'], ['고용보험 자료', '급여 대장', '고용 계획']),
  inst('inst-region-guarantee', '지역신용보증재단', '지역신보', 'credit_guarantee', '지역 소상공인·중소기업 보증을 지원하는 기관 (참고용).', ['지역 소재', '매출·신용', '보증 필요성'], ['사업자등록증', '매출 증빙', '지역 소재 증빙']),
  inst('inst-local-gov', '지자체·지역산업진흥기관', '지자체', 'local_government', '지역 산업 특성에 맞춘 지원 사업을 운영하는 기관 (참고용).', ['지역 기여도', '사업 적합성', '지역 산업 연계'], ['지역 소재 증빙', '사업계획서']),
  inst('inst-private-invest', '민간 투자기관', '투자기관', 'investment', '지분 투자·엑셀러레이팅 등을 제공하는 민간 기관 (참고용).', ['시장성·성장성', '팀·기술', '수익 모델'], ['IR 자료', '재무·시장 근거']),
]

function program(
  id: string,
  institutionId: string,
  name: string,
  supportType: SupportProgram['supportType'],
  summary: string,
  reviewFocus: string[],
  requiredDocuments: string[],
): SupportProgram {
  return {
    id,
    institutionId,
    name,
    supportType,
    summary,
    targetCompanies: '중소기업·소상공인 (실제 대상은 공식 공고 확인 필요)',
    targetIndustries: [],
    regions: ['전국'],
    companyAgeRules: '공식 공고 확인 필요',
    revenueRules: '공식 공고 확인 필요',
    employeeRules: '공식 공고 확인 필요',
    creditRules: '공식 공고 확인 필요',
    technologyRules: '공식 공고 확인 필요',
    certificationRules: '공식 공고 확인 필요',
    requiredDocuments,
    reviewFocus,
    disqualifiers: [],
    supportDescription: '지원 방식은 공식 공고에서 확인해야 합니다.',
    amountDescription: '공식 공고 확인 필요',
    costShareDescription: '',
    scheduleDescription: '공식 공고 확인 필요',
    applicationMethod: '공식 공고·기관 문의 확인 필요',
    officialUrl: '',
    announcementUrl: '',
    sourceStatus: 'reference_only',
    lastVerifiedAt: null,
    validUntil: null,
    notes: '실제 공고명이 아닌 검토용 템플릿입니다.',
    isTemplate: true,
    createdAt: SEED_ISO,
    updatedAt: SEED_ISO,
    archivedAt: null,
  }
}

export const SEED_PROGRAMS: SupportProgram[] = [
  program('prog-policy-loan', 'inst-kosme', '정책자금 융자 검토', 'loan', '정책자금 융자 연계 가능성을 검토하는 템플릿입니다.', ['사업성·기술성', '재무 건전성', '자금 용도'], ['사업계획서', '재무제표', '사업자등록증']),
  program('prog-credit-guarantee', 'inst-kodit', '신용보증 연계 검토', 'guarantee', '신용보증 연계 가능성을 검토하는 템플릿입니다.', ['신용도', '매출·현금흐름'], ['재무제표', '부가세 신고자료']),
  program('prog-tech-guarantee', 'inst-kibo', '기술보증 연계 검토', 'guarantee', '기술보증 연계 가능성을 검토하는 템플릿입니다.', ['기술성·혁신성', '사업화 가능성'], ['기술 증빙', '지식재산권', '사업계획서']),
  program('prog-rnd', 'inst-tipa', '연구개발 지원 검토', 'rnd', 'R&D 지원 사업 연계 가능성을 검토하는 템플릿입니다.', ['기술 개발 계획', '연구개발 체계'], ['연구개발계획서', '연구 인력 현황']),
  program('prog-employment', 'inst-moel', '고용지원 검토', 'employment', '고용 관련 지원금 연계 가능성을 검토하는 템플릿입니다.', ['고용 계획·실적', '고용유지 요건'], ['고용보험 자료', '고용 계획']),
  program('prog-local', 'inst-local-gov', '지자체 지원 검토', 'subsidy', '지자체 지원 사업 연계 가능성을 검토하는 템플릿입니다.', ['지역 기여도', '사업 적합성'], ['지역 소재 증빙', '사업계획서']),
  program('prog-export', 'inst-kosme', '수출지원 검토', 'export', '수출 지원 사업 연계 가능성을 검토하는 템플릿입니다.', ['수출 계획', '해외 시장성'], ['수출 관련 증빙', '사업계획서']),
  program('prog-certification', 'inst-kibo', '기업인증 연계 검토', 'certification', '기업 인증(벤처·이노비즈 등) 연계 가능성을 검토하는 템플릿입니다.', ['기술·혁신 근거', '인증 요건 충족'], ['기술 증빙', '재무제표']),
  program('prog-investment', 'inst-private-invest', '투자 연계 검토', 'investment', '민간 투자 연계 가능성을 검토하는 템플릿입니다.', ['시장성·성장성', '팀·기술', '수익 모델'], ['IR 자료', '재무·시장 근거']),
]
