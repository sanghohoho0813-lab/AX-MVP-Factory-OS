/**
 * 업종 견본 (D-202) — 업종을 알아보고, 그 업종에 맞는 블록 순서와 처음 문구를 준다.
 *
 * 처음 문구는 모두 '견본' 이다 — 업체 사실이 아닌 말(품질 · 정성 같은 다짐)은 업체와 확인하기 전에는 내보내지 않도록
 * 점검이 '견본 문구 그대로' 로 알린다. 숫자 · 이름 · 주소 같은 사실은 업체 기록에서만 가져온다(지어내지 않는다).
 */
import type { BlockType, IndustryKey, ListItem } from './types'

export interface IndustryDef {
  key: IndustryKey
  label: string
  /** 큰 문구 — {item} 은 종목(없으면 fallbackItem) */
  heroTitle: string
  heroSubtitle: string
  fallbackItem: string
  /** 회사 소개 둘째 문장(견본) */
  aboutPromise: string
  servicesTitle: string
  services: ListItem[]
  processTitle: string
  process: ListItem[]
  faq: ListItem[]
  ctaTitle: string
  ctaBody: string
  hours: string
  /** 처음 초안에 넣을 블록(머리 · 바닥 · 사실 블록은 따로 정한다) */
  include: BlockType[]
}

const STEP = (name: string, desc: string): ListItem => ({ name, desc })
const QA = (q: string, a: string): ListItem => ({ q, a })
const CARD = (name: string, desc: string): ListItem => ({ name, desc })

export const INDUSTRIES: IndustryDef[] = [
  {
    key: 'manufacturing',
    label: '제조 · 생산',
    heroTitle: '약속한 품질과 납기를 지키는\n제조 파트너',
    heroSubtitle: '{item} — 설계 검토부터 생산 · 품질 관리 · 납품까지 직접 챙깁니다.',
    fallbackItem: '맞춤 제조',
    aboutPromise: '도면 한 장, 시제품 하나부터 꼼꼼히 확인하고 약속한 일정을 지키는 것을 가장 중요하게 생각합니다.',
    servicesTitle: '주요 사업',
    services: [CARD('제품 생산', '보유 설비로 정해진 사양에 맞춰 생산합니다.'), CARD('맞춤 제작(OEM)', '도면과 요구 사항에 맞춰 시제품부터 양산까지 진행합니다.'), CARD('품질 관리', '공정마다 검사 기준을 두고 출하 전에 다시 확인합니다.')],
    processTitle: '주문은 이렇게 진행돼요',
    process: [STEP('문의 · 도면 검토', '필요한 사양과 수량을 알려 주세요.'), STEP('견적 · 일정 협의', '단가와 납기를 정리해 드립니다.'), STEP('생산 · 검사', '정해진 기준으로 만들고 검사합니다.'), STEP('납품 · 사후 관리', '납품 뒤에도 문제가 없는지 확인합니다.')],
    faq: [QA('적은 수량도 주문할 수 있나요?', '품목에 따라 다릅니다. 필요한 수량을 알려 주시면 가능한 방법을 안내해 드립니다.'), QA('견적은 얼마나 걸리나요?', '도면과 사양을 받은 뒤 보통 며칠 안에 회신해 드립니다.'), QA('시제품 제작도 하나요?', '네, 양산 전에 시제품으로 먼저 확인할 수 있습니다.')],
    ctaTitle: '견적 · 제작 문의',
    ctaBody: '도면이나 사양을 보내 주시면 검토 후 연락드립니다.',
    hours: '평일 09:00 – 18:00 (주말 · 공휴일 휴무)',
    include: ['about', 'services', 'process', 'faq', 'cta', 'contact'],
  },
  {
    key: 'it',
    label: 'IT · 소프트웨어',
    heroTitle: '일을 더 쉽고 빠르게 만드는\n소프트웨어',
    heroSubtitle: '{item} — 꼭 필요한 기능부터 만들고, 오픈 뒤 운영까지 함께합니다.',
    fallbackItem: '소프트웨어 개발',
    aboutPromise: '현장에서 실제로 쓰이는지를 기준으로 만들고, 만든 뒤에도 계속 다듬습니다.',
    servicesTitle: '서비스',
    services: [CARD('맞춤 개발', '업무에 맞는 웹 · 앱 · 관리 화면을 만듭니다.'), CARD('솔루션 도입', '이미 있는 제품을 업무에 맞게 설정하고 연결합니다.'), CARD('운영 · 유지보수', '오픈 뒤 문제 대응과 기능 개선을 이어 갑니다.')],
    processTitle: '프로젝트는 이렇게 진행돼요',
    process: [STEP('요구 사항 상담', '지금 업무와 바라는 결과를 듣습니다.'), STEP('기획 · 설계', '화면과 기능 범위를 함께 정합니다.'), STEP('개발 · 시험', '만들고, 실제 자료로 시험합니다.'), STEP('오픈 · 운영 지원', '오픈 뒤에도 안정적으로 쓰도록 돕습니다.')],
    faq: [QA('작은 기능 하나도 맡길 수 있나요?', '네, 범위를 함께 정해 작게 시작할 수 있습니다.'), QA('개발 기간은 얼마나 걸리나요?', '범위에 따라 다릅니다. 상담 뒤 일정표를 드립니다.'), QA('오픈 뒤 관리도 되나요?', '유지보수 범위를 따로 정해 이어서 관리합니다.')],
    ctaTitle: '프로젝트 상담',
    ctaBody: '하고 싶은 일을 편하게 알려 주세요. 가능한 방법과 일정을 정리해 드립니다.',
    hours: '평일 10:00 – 19:00',
    include: ['about', 'services', 'process', 'faq', 'cta', 'contact'],
  },
  {
    key: 'trade',
    label: '도소매 · 유통',
    heroTitle: '좋은 상품을 제때,\n정직한 가격에',
    heroSubtitle: '{item} — 공급 · 납품 문의를 기다립니다.',
    fallbackItem: '상품 공급',
    aboutPromise: '필요한 물건을 필요한 때에 받을 수 있도록 재고와 배송을 꼼꼼히 챙깁니다.',
    servicesTitle: '취급 품목',
    services: [CARD('주요 품목', '취급하는 대표 상품을 적어 주세요.'), CARD('도매 · 납품', '사업자 고객께 정기 납품을 합니다.'), CARD('배송', '지역과 수량에 맞춰 배송 일정을 맞춥니다.')],
    processTitle: '주문은 이렇게 해요',
    process: [STEP('문의', '품목과 수량을 알려 주세요.'), STEP('견적', '가격과 배송 일정을 안내합니다.'), STEP('주문 · 출고', '확정되면 바로 준비합니다.'), STEP('배송 · 확인', '받으신 뒤 문제가 없는지 확인합니다.')],
    faq: [QA('사업자가 아니어도 살 수 있나요?', '품목에 따라 다릅니다. 문의해 주세요.'), QA('정기 납품도 되나요?', '네, 주기와 수량을 정해 정기 납품할 수 있습니다.'), QA('배송은 얼마나 걸리나요?', '지역과 재고에 따라 다릅니다. 주문 때 안내해 드립니다.')],
    ctaTitle: '납품 · 구매 문의',
    ctaBody: '필요한 품목과 수량을 알려 주시면 견적을 보내 드립니다.',
    hours: '평일 09:00 – 18:00',
    include: ['about', 'services', 'process', 'cta', 'contact'],
  },
  {
    key: 'food',
    label: '음식 · 카페',
    heroTitle: '정성껏 준비한\n한 그릇',
    heroSubtitle: '{item} — 편하게 들러 주세요.',
    fallbackItem: '음식점',
    aboutPromise: '매일 손님을 맞는 마음으로 준비합니다.',
    servicesTitle: '대표 메뉴',
    services: [CARD('대표 메뉴', '가장 많이 찾는 메뉴를 적어 주세요.'), CARD('추천 메뉴', '함께 즐기기 좋은 메뉴를 적어 주세요.'), CARD('포장 · 단체', '포장과 단체 주문 가능 여부를 적어 주세요.')],
    processTitle: '이용 안내',
    process: [STEP('예약', '전화로 예약할 수 있어요.'), STEP('방문', '편한 시간에 들러 주세요.')],
    faq: [QA('주차할 수 있나요?', '주차 가능 여부를 적어 주세요.'), QA('단체 예약이 되나요?', '인원과 시간을 알려 주시면 안내해 드립니다.'), QA('포장 주문이 되나요?', '전화로 미리 주문하시면 준비해 둡니다.')],
    ctaTitle: '예약 · 포장 주문',
    ctaBody: '전화 한 통이면 됩니다.',
    hours: '매일 11:00 – 21:00 (쉬는 날은 적어 주세요)',
    include: ['about', 'services', 'faq', 'contact'],
  },
  {
    key: 'health',
    label: '병의원 · 뷰티 · 건강',
    heroTitle: '편안하고 꼼꼼한\n관리',
    heroSubtitle: '{item} — 상담부터 관리까지 차분하게 안내해 드립니다.',
    fallbackItem: '건강 관리',
    aboutPromise: '처음 오신 분도 편하게 상담받으실 수 있도록 충분히 설명하고 진행합니다.',
    servicesTitle: '진료 · 관리 항목',
    services: [CARD('상담', '현재 상태와 원하는 점을 먼저 듣습니다.'), CARD('주요 항목', '대표 진료 · 관리 항목을 적어 주세요.'), CARD('사후 관리', '이후 관리 방법을 함께 안내합니다.')],
    processTitle: '방문 순서',
    process: [STEP('예약', '전화로 편한 시간을 정해 주세요.'), STEP('상담', '상태와 원하는 점을 확인합니다.'), STEP('진행', '안내드린 내용대로 진행합니다.'), STEP('사후 관리', '다음 방문과 관리 방법을 안내합니다.')],
    faq: [QA('예약 없이 방문해도 되나요?', '가능하지만 예약하시면 기다리지 않으셔도 됩니다.'), QA('상담만 받아도 되나요?', '네, 상담만 받으셔도 됩니다.'), QA('주차할 수 있나요?', '주차 가능 여부를 적어 주세요.')],
    ctaTitle: '상담 · 예약',
    ctaBody: '궁금한 점은 전화로 편하게 물어봐 주세요.',
    hours: '평일 10:00 – 19:00 · 토요일 10:00 – 14:00',
    include: ['about', 'services', 'process', 'faq', 'cta', 'contact'],
  },
  {
    key: 'professional',
    label: '전문 서비스(세무 · 법률 · 컨설팅)',
    heroTitle: '복잡한 일을\n쉽게 풀어 드립니다',
    heroSubtitle: '{item} — 처음 상담부터 마무리까지 책임지고 안내합니다.',
    fallbackItem: '전문 상담',
    aboutPromise: '고객의 상황을 먼저 듣고, 꼭 필요한 일부터 정직하게 제안합니다.',
    servicesTitle: '업무 분야',
    services: [CARD('상담', '지금 상황을 듣고 해야 할 일을 정리합니다.'), CARD('대행 · 실행', '서류 준비부터 진행까지 맡아 처리합니다.'), CARD('사후 관리', '마무리 뒤에도 필요한 일을 챙겨 드립니다.')],
    processTitle: '이렇게 진행돼요',
    process: [STEP('상담', '전화나 방문으로 상황을 듣습니다.'), STEP('자료 검토', '필요한 자료를 받아 검토합니다.'), STEP('진행 · 보고', '진행 상황을 그때그때 알려 드립니다.'), STEP('마무리', '결과를 설명하고 다음 일을 안내합니다.')],
    faq: [QA('상담 비용이 있나요?', '첫 상담 조건을 적어 주세요.'), QA('어떤 자료를 준비하면 되나요?', '상담 때 필요한 자료 목록을 안내해 드립니다.'), QA('지방도 가능한가요?', '전화 · 온라인으로도 진행할 수 있습니다.')],
    ctaTitle: '상담 신청',
    ctaBody: '상황을 짧게 알려 주시면 확인 후 연락드립니다.',
    hours: '평일 09:00 – 18:00',
    include: ['about', 'services', 'process', 'faq', 'cta', 'contact'],
  },
  {
    key: 'education',
    label: '교육 · 학원',
    heroTitle: '한 사람 한 사람에게\n맞춘 배움',
    heroSubtitle: '{item} — 수준에 맞춘 과정으로 함께합니다.',
    fallbackItem: '교육',
    aboutPromise: '배우는 사람의 속도에 맞추고, 무엇이 달라졌는지 함께 확인합니다.',
    servicesTitle: '과정 안내',
    services: [CARD('기초 과정', '처음 시작하는 분을 위한 과정입니다.'), CARD('심화 과정', '실력을 더 키우고 싶은 분을 위한 과정입니다.'), CARD('맞춤 상담', '목표에 맞는 과정을 함께 정합니다.')],
    processTitle: '등록은 이렇게 해요',
    process: [STEP('상담', '목표와 지금 수준을 확인합니다.'), STEP('과정 안내', '맞는 과정과 일정을 안내합니다.'), STEP('수업', '정해진 과정대로 진행합니다.'), STEP('확인', '달라진 점을 함께 확인합니다.')],
    faq: [QA('체험 수업이 있나요?', '체험 가능 여부를 적어 주세요.'), QA('수업 시간은 어떻게 되나요?', '과정마다 다릅니다. 상담 때 안내해 드립니다.'), QA('중간에 과정을 바꿀 수 있나요?', '상담 뒤 바꿀 수 있습니다.')],
    ctaTitle: '수강 상담',
    ctaBody: '목표를 알려 주시면 맞는 과정을 안내해 드립니다.',
    hours: '평일 14:00 – 22:00 · 토요일 10:00 – 17:00',
    include: ['about', 'services', 'process', 'faq', 'cta', 'contact'],
  },
  {
    key: 'construction',
    label: '건설 · 인테리어',
    heroTitle: '꼼꼼한 시공,\n끝까지 책임지는 관리',
    heroSubtitle: '{item} — 상담 · 견적 · 시공 · 사후 관리까지 직접 합니다.',
    fallbackItem: '시공',
    aboutPromise: '현장을 직접 보고 정직하게 견적을 드리며, 끝난 뒤에도 책임지고 관리합니다.',
    servicesTitle: '시공 분야',
    services: [CARD('주요 시공', '대표 시공 분야를 적어 주세요.'), CARD('부분 시공 · 보수', '작은 공사도 상담해 드립니다.'), CARD('사후 관리(A/S)', '시공 뒤 문제가 생기면 다시 확인합니다.')],
    processTitle: '시공은 이렇게 진행돼요',
    process: [STEP('상담 · 현장 방문', '현장을 직접 보고 필요한 일을 확인합니다.'), STEP('설계 · 견적', '범위와 비용을 정리해 드립니다.'), STEP('시공', '정한 일정대로 진행하고 그때그때 알려 드립니다.'), STEP('준공 · A/S', '마무리 점검 뒤에도 관리합니다.')],
    faq: [QA('견적은 무료인가요?', '견적 조건을 적어 주세요.'), QA('공사 기간은 얼마나 걸리나요?', '범위에 따라 다릅니다. 견적 때 일정표를 드립니다.'), QA('A/S 기간이 있나요?', '보증 기간을 적어 주세요.')],
    ctaTitle: '견적 · 현장 상담',
    ctaBody: '공사할 곳과 원하는 내용을 알려 주시면 일정을 잡아 방문합니다.',
    hours: '평일 08:00 – 18:00 · 토요일 상담 가능',
    include: ['about', 'services', 'process', 'faq', 'cta', 'contact'],
  },
  {
    key: 'design',
    label: '디자인 · 광고 · 간판 · 인쇄',
    heroTitle: '보는 순간 기억되는\n간판과 디자인',
    heroSubtitle: '{item} — 상담 · 시안 · 제작 · 설치까지 한 곳에서 챙깁니다.',
    fallbackItem: '간판 · 광고물 제작',
    aboutPromise: '가게와 회사의 얼굴이 되는 일이라, 시안 한 장부터 설치 마무리까지 직접 확인합니다.',
    servicesTitle: '하는 일',
    services: [CARD('간판 제작 · 설치', '가게 · 건물 외부 간판을 디자인하고 만들어 설치합니다.'), CARD('실내 사인 · 안내물', '안내판 · 실내 사인 · 시트 작업을 합니다.'), CARD('인쇄물 · 현수막', '현수막 · 배너 · 전단 · 명함을 만듭니다.'), CARD('디자인', '로고 · 브랜드 · 홍보물 디자인을 합니다.')],
    processTitle: '제작은 이렇게 진행돼요',
    process: [STEP('상담 · 현장 실측', '설치할 곳을 보고 크기와 조건을 확인합니다.'), STEP('시안 · 견적', '디자인 시안과 비용을 함께 드립니다.'), STEP('제작', '확정한 시안대로 만듭니다.'), STEP('설치 · A/S', '설치 뒤에도 문제가 없는지 챙깁니다.')],
    faq: [QA('설치까지 해 주나요?', '설치 가능 지역과 조건을 적어 주세요.'), QA('허가 · 신고도 도와주나요?', '설치할 곳에 따라 필요한 절차가 다릅니다. 상담 때 확인해 안내해 드립니다.'), QA('시안은 몇 번 고칠 수 있나요?', '시안 수정 횟수와 조건을 적어 주세요.')],
    ctaTitle: '시안 · 견적 문의',
    ctaBody: '설치할 곳 사진과 원하는 느낌을 보내 주시면 시안과 견적을 드립니다.',
    hours: '평일 09:00 – 18:00 · 토요일 상담 가능',
    include: ['about', 'services', 'process', 'faq', 'cta', 'contact'],
  },
  {
    key: 'consultant',
    label: '컨설턴트 · 전문가(개인)',
    heroTitle: '대표님 회사에 맞는 길을\n함께 찾아 드립니다',
    heroSubtitle: '{item} — 첫 상담부터 실행 · 사후 관리까지 한 사람이 끝까지 챙깁니다.',
    fallbackItem: '중소기업 경영 컨설팅',
    aboutPromise: '회사 사정을 먼저 듣고, 지금 할 수 있는 일부터 정직하게 제안합니다.',
    servicesTitle: '도와드리는 일',
    services: [CARD('회사 진단', '지금 회사가 받을 수 있는 것과 챙겨야 할 것을 정리합니다.'), CARD('자금 · 지원사업', '맞는 정책자금과 지원사업을 찾고 신청 준비를 함께합니다.'), CARD('인증 · 절세 · 고용', '기업 인증, 절세, 고용 지원금처럼 놓치기 쉬운 것을 챙깁니다.')],
    processTitle: '이렇게 진행돼요',
    process: [STEP('첫 상담', '전화나 방문으로 회사 상황을 듣습니다.'), STEP('진단 · 제안', '자료를 보고 할 수 있는 일을 정리해 드립니다.'), STEP('실행', '서류 준비부터 신청까지 함께 진행합니다.'), STEP('사후 관리', '결과가 나온 뒤에도 다음 일을 챙깁니다.')],
    faq: [QA('상담 비용이 있나요?', '첫 상담 조건을 적어 주세요.'), QA('어떤 회사를 주로 돕나요?', '주로 돕는 업종 · 규모를 적어 주세요.'), QA('멀리 있는 회사도 가능한가요?', '전화 · 온라인으로도 진행할 수 있습니다.')],
    ctaTitle: '상담 신청',
    ctaBody: '회사 이름과 고민을 짧게 남겨 주시면 확인 후 연락드립니다.',
    hours: '평일 09:00 – 18:00',
    include: ['about', 'services', 'process', 'faq', 'cta', 'contact'],
  },
  {
    key: 'general',
    label: '기타',
    heroTitle: '찾아 주셔서\n감사합니다',
    heroSubtitle: '{item} — 궁금한 점은 언제든 문의해 주세요.',
    fallbackItem: '고객 서비스',
    aboutPromise: '한 분 한 분의 문의에 성실하게 답하겠습니다.',
    servicesTitle: '하는 일',
    services: [CARD('주요 사업', '대표 사업을 적어 주세요.'), CARD('서비스', '제공하는 서비스를 적어 주세요.'), CARD('문의', '문의 방법을 적어 주세요.')],
    processTitle: '이렇게 진행돼요',
    process: [STEP('문의', '전화나 메일로 알려 주세요.'), STEP('상담', '필요한 내용을 확인합니다.'), STEP('진행', '정한 내용대로 진행합니다.'), STEP('마무리', '결과를 확인합니다.')],
    faq: [QA('문의는 어떻게 하나요?', '아래 연락처로 전화나 메일을 주세요.'), QA('운영 시간은 어떻게 되나요?', '아래 운영 시간을 확인해 주세요.')],
    ctaTitle: '문의하기',
    ctaBody: '궁금한 점을 편하게 남겨 주세요.',
    hours: '평일 09:00 – 18:00',
    include: ['about', 'services', 'cta', 'contact'],
  },
]

export function industryDef(key: string): IndustryDef {
  return INDUSTRIES.find((i) => i.key === key) ?? INDUSTRIES[INDUSTRIES.length - 1]
}

/** 음식 견본 안에서도 빵집 · 카페는 '한 그릇' 이 어색하다 — 첫 화면 큰 문구만 바꾼다 */
export function heroTitleFor(key: string, text: string): string {
  const ind = industryDef(key)
  if (ind.key !== 'food') return ind.heroTitle
  if (/베이커리|제과|빵|디저트|케이크/.test(text)) return '매일 아침\n정성껏 굽습니다'
  if (/카페|커피|찻집/.test(text)) return '정성껏 내린\n한 잔'
  return ind.heroTitle
}

/**
 * 업태 · 종목 · 업종 글로 업종을 알아본다.
 *  1) 간판 · 광고물 · 인쇄 · 디자인은 '제조' 가 붙어 있어도 디자인 · 광고(D-205 — '간판 및 광고물 제조업' 이 제조 견본으로 나가던 것)
 *  2) 그다음 '제조' 가 들어 있으면 제조(식품 제조는 제조)
 *  3) 그다음 겹치지 않는 낱말 순서로. 모르면 '기타'.
 */
const RULES: { key: IndustryKey; re: RegExp }[] = [
  { key: 'construction', re: /건설|건축|인테리어|시공|토목|공사업|설비공사|전기공사|조경|리모델링|도배|타일/ },
  { key: 'food', re: /음식점|식당|카페|커피|베이커리|제과점|외식|주점|휴게음식|일반음식|분식|치킨|한식|중식|일식|양식/ },
  { key: 'health', re: /의원|병원|한의원|치과|약국|의료|뷰티|미용|피부|네일|헬스|필라테스|요가|마사지|에스테틱/ },
  { key: 'education', re: /교육|학원|교습|강의|코칭|훈련|어학|과외/ },
  // D-220: '컨설턴트' 라고 적은 사람(개인 전문가)은 사무소 견본보다 개인 컨설턴트 견본으로
  { key: 'consultant', re: /컨설턴트/ },
  { key: 'professional', re: /세무|회계|법률|법무|노무|변리|컨설팅|경영자문|자문|번역|감정평가|행정사/ },
  { key: 'it', re: /소프트웨어|정보통신|플랫폼|응용|시스템\s*통합|데이터|인공지능|컴퓨터|프로그램|웹|앱|IT|SI\b|클라우드/i },
  { key: 'trade', re: /도매|소매|유통|무역|상사|수출|수입|전자상거래|통신판매|쇼핑/ },
  { key: 'manufacturing', re: /생산|가공|금속|부품|기계|플라스틱|화학|섬유|소재|주조|금형|사출|도금|용접/ },
]

/** 간판 · 광고 · 인쇄 · 디자인 — '제조' 보다 먼저 본다 */
const DESIGN = /간판|광고물|옥외광고|사인물|사인\s*제작|현수막|실사\s*출력|인쇄|디자인|광고|마케팅|브랜딩/

/** 인테리어 · 시공 회사는 '디자인' 이 붙어 있어도 공사 견본(간판 · 광고물 · 인쇄 말이 같이 있으면 디자인) */
const BUILD_WORK = /인테리어|시공|리모델링|건축|공사업/
const SIGN_WORK = /간판|광고물|옥외광고|사인물|사인\s*제작|현수막|실사\s*출력|인쇄/

export function industryOf(...texts: string[]): IndustryKey {
  const text = texts.filter(Boolean).join(' ')
  if (!text.trim()) return 'general'
  const buildNotSign = BUILD_WORK.test(text) && !SIGN_WORK.test(text.replace(/인쇄\s*회로/g, ''))
  // 인쇄회로기판(PCB)은 전자부품 제조
  if (DESIGN.test(text.replace(/인쇄\s*회로/g, '')) && !/음식점|식당|카페|의원|병원/.test(text) && !buildNotSign) return 'design'
  if (/제조/.test(text) && !/음식점|식당|카페/.test(text)) return 'manufacturing'
  for (const r of RULES) if (r.re.test(text)) return r.key
  return 'general'
}
