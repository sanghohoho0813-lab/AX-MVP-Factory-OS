import type {
  Client,
  MonthlyCheck,
  CheckAnswers,
  ResearchProject,
  ResearchNote,
} from "../../types";
import { evaluateRisk } from "../../lib/riskEngine";

/* ───────────────── 고객사 (현실적인 10개사) ───────────────── */
// 연구개발전담부서 7 / 기업부설연구소 3, 흔한 업종 위주, "(주)" 앞붙임 통일

export const sampleClients: Client[] = [
  {
    id: "c-daon", name: "다온푸드", businessType: "개인사업자", industry: "식품 제조업", labType: "연구개발전담부서",
    ceoName: "김영호", address: "충북 청주시 흥덕구 산단로 88", foundedDate: "2018-04-10",
    certifiedDate: "2023-06-15", employeeCount: 4, researcherCount: 1,
    labName: "다온푸드 기술연구개발전담부서", consultant: "김상호",
    labRegistrationNumber: "제2023-115202호", labPortalPassword: "demo-1234",
    researchersPayrollTotal: 38000000, rndMaterialCost: 6000000, rndOtherCost: 2000000,
    taxCreditCategory: "일반 R&D",
    coreIssue: "연구노트 매월 작성 정착 필요", createdAt: "2024-01-10T09:00:00.000Z",
  },
  {
    id: "c-gear", name: "(주)정밀기어", businessType: "법인사업자", hiringTip: "고용증대 점검", industry: "기계부품 제조업", labType: "기업부설연구소",
    ceoName: "박성근", address: "경남 창원시 성산구 공단로 210", foundedDate: "2012-09-01",
    certifiedDate: "2021-03-02", employeeCount: 24, researcherCount: 4,
    labName: "정밀기어 부설연구소", consultant: "김상호",
    labRegistrationNumber: "제2021-031177호", labPortalPassword: "demo-5678",
    researchersPayrollTotal: 168000000, rndMaterialCost: 32000000, rndOtherCost: 8000000,
    taxCreditCategory: "일반 R&D",
    coreIssue: "연구전담요원 1명 퇴사 예정 — 충원 검토", createdAt: "2024-01-12T09:00:00.000Z",
  },
  {
    id: "c-retail", name: "(주)리테일브릿지", businessType: "법인사업자", hiringTip: "신규채용 시 확인", industry: "도소매업", labType: "연구개발전담부서",
    ceoName: "이지현", address: "서울 마포구 양화로 45", foundedDate: "2020-02-20",
    certifiedDate: "2024-02-10", employeeCount: 5, researcherCount: 1,
    labName: "리테일브릿지 서비스연구전담부서", consultant: "김상호",
    labRegistrationNumber: "제2024-042311호",
    researchersPayrollTotal: 36000000, rndMaterialCost: 2000000, rndOtherCost: 2000000,
    taxCreditCategory: "미정",
    coreIssue: "서비스 분야 연구활동 입증자료 보강 필요", createdAt: "2024-02-05T09:00:00.000Z",
  },
  {
    id: "c-packing", name: "(주)패킹스튜디오", businessType: "법인사업자", hiringTip: "연구인력 채용 확인", industry: "포장디자인/제품디자인", labType: "연구개발전담부서",
    ceoName: "최민서", address: "경기 고양시 일산동구 정발산로 24", foundedDate: "2019-07-15",
    certifiedDate: "2023-11-20", employeeCount: 6, researcherCount: 2,
    labName: "패킹스튜디오 디자인연구전담부서", consultant: "최유나",
    labRegistrationNumber: "제2023-208645호", labPortalPassword: "demo-2468",
    researchersPayrollTotal: 72000000, rndMaterialCost: 9000000, rndOtherCost: 3000000,
    taxCreditCategory: "일반 R&D",
    coreIssue: "산업디자인 분야 — 제품/포장디자인 범위 관리", createdAt: "2024-02-18T09:00:00.000Z",
  },
  {
    id: "c-code", name: "(주)코드웨이브", businessType: "법인사업자", hiringTip: "IT 인력 채용지원 확인", industry: "소프트웨어 개발", labType: "기업부설연구소",
    ceoName: "정우성", address: "서울 강남구 테헤란로 322", foundedDate: "2017-05-30",
    certifiedDate: "2020-12-01", employeeCount: 16, researcherCount: 4,
    labName: "코드웨이브 부설연구소", consultant: "최유나",
    labRegistrationNumber: "제2020-300842호", labPortalPassword: "demo-1357",
    researchersPayrollTotal: 220000000, rndMaterialCost: 10000000, rndOtherCost: 20000000,
    taxCreditCategory: "신성장·원천기술",
    coreIssue: "세액공제 증빙 정리 양호 — 유지 관리", createdAt: "2024-01-22T09:00:00.000Z",
  },
  {
    id: "c-hansol", name: "한솔인테리어", businessType: "개인사업자", industry: "인테리어/건설 서비스", labType: "연구개발전담부서",
    ceoName: "강도현", address: "부산 해운대구 센텀중앙로 90", foundedDate: "2016-03-12",
    certifiedDate: "2024-04-05", employeeCount: 3, researcherCount: 1,
    labName: "한솔인테리어 기술연구전담부서", consultant: "김상호",
    labRegistrationNumber: "제2024-077520호",
    researchersPayrollTotal: 34000000, rndMaterialCost: 4000000, rndOtherCost: 1000000,
    taxCreditCategory: "미정",
    coreIssue: "연구공간 독립성 — 현판/도면 점검 필요", createdAt: "2024-03-12T09:00:00.000Z",
  },
  {
    id: "c-living", name: "(주)리빙웰", businessType: "법인사업자", industry: "생활용품 제조", labType: "연구개발전담부서",
    ceoName: "윤서연", address: "인천 서구 정서진로 120", foundedDate: "2019-11-08",
    certifiedDate: "2023-08-22", employeeCount: 8, researcherCount: 2,
    labName: "리빙웰 제품연구전담부서", consultant: "최유나",
    labRegistrationNumber: "제2023-156090호", labPortalPassword: "demo-9012",
    researchersPayrollTotal: 70000000, rndMaterialCost: 12000000, rndOtherCost: 3000000,
    taxCreditCategory: "일반 R&D",
    coreIssue: "이번 달 연구노트 미작성", createdAt: "2024-02-28T09:00:00.000Z",
  },
  {
    id: "c-market", name: "(주)마켓플로우", businessType: "법인사업자", hiringTip: "채용대상별 확인", industry: "온라인 유통", labType: "연구개발전담부서",
    ceoName: "임재훈", address: "서울 성동구 성수이로 51", foundedDate: "2021-01-18",
    certifiedDate: "2024-05-30", employeeCount: 7, researcherCount: 1,
    labName: "마켓플로우 서비스연구전담부서", consultant: "김상호",
    labRegistrationNumber: "제2024-118734호",
    researchersPayrollTotal: 35000000, rndMaterialCost: 1500000, rndOtherCost: 2500000,
    taxCreditCategory: "미정",
    coreIssue: "신규 설립 — 연구과제 정착 단계", createdAt: "2024-04-02T09:00:00.000Z",
  },
  {
    id: "c-miga", name: "(주)미가푸드", businessType: "법인사업자", hiringTip: "신규매장 채용계획 확인", industry: "프랜차이즈/음식 서비스", labType: "연구개발전담부서",
    ceoName: "한지수", address: "대구 수성구 동대구로 33", foundedDate: "2015-06-25",
    certifiedDate: "2023-03-14", employeeCount: 9, researcherCount: 2,
    labName: "미가푸드 메뉴연구전담부서", consultant: "최유나",
    labRegistrationNumber: "제2023-064419호", labPortalPassword: "demo-3456",
    researchersPayrollTotal: 66000000, rndMaterialCost: 14000000, rndOtherCost: 2000000,
    taxCreditCategory: "일반 R&D",
    coreIssue: "대표자 변경 — 변경신고 검토 필요", createdAt: "2024-01-30T09:00:00.000Z",
  },
  {
    id: "c-bolt", name: "(주)볼트일렉", businessType: "법인사업자", hiringTip: "연구인력 채용지원 확인", industry: "전기전자 부품 제조", labType: "기업부설연구소",
    ceoName: "오세훈", address: "경기 화성시 동탄첨단산업1로 15", foundedDate: "2013-10-02",
    certifiedDate: "2020-07-09", employeeCount: 12, researcherCount: 3,
    labName: "볼트일렉 부설연구소", consultant: "김상호",
    labRegistrationNumber: "제2020-244501호", labPortalPassword: "demo-7890",
    researchersPayrollTotal: 150000000, rndMaterialCost: 28000000, rndOtherCost: 10000000,
    taxCreditCategory: "신성장·원천기술",
    coreIssue: "연구개발활동조사 제출 완료 — 양호", createdAt: "2024-01-08T09:00:00.000Z",
  },
];

/* ───────────────── 연구과제 (고객사당 1개) ───────────────── */

export const sampleProjects: ResearchProject[] = [
  { id: "p-daon", clientId: "c-daon", name: "저당 소스 배합 개선 연구", productService: "저당 소스 제품", startDate: "2024-01-02", status: "진행중" },
  { id: "p-gear", clientId: "c-gear", name: "정밀 감속기 내구성 향상 연구", productService: "정밀 감속기", startDate: "2023-09-01", status: "진행중" },
  { id: "p-retail", clientId: "c-retail", name: "온라인 주문·재고 연동 서비스 프로세스 개선 연구", productService: "주문·재고 연동 서비스", startDate: "2024-03-01", status: "진행중" },
  { id: "p-packing", clientId: "c-packing", name: "친환경 포장재 구조 디자인 개선 연구", productService: "친환경 포장재", startDate: "2024-01-15", status: "진행중" },
  { id: "p-code", clientId: "c-code", name: "물류 최적화 알고리즘 고도화 연구", productService: "물류 최적화 SaaS", startDate: "2023-06-01", status: "진행중" },
  { id: "p-hansol", clientId: "c-hansol", name: "모듈형 시공 공법 개선 연구", productService: "모듈형 시공 공법", startDate: "2024-04-10", status: "진행중" },
  { id: "p-living", clientId: "c-living", name: "항균 주방용품 소재 적용 연구", productService: "항균 주방용품", startDate: "2024-02-01", status: "진행중" },
  { id: "p-market", clientId: "c-market", name: "PB상품 포장디자인 개선 연구", productService: "PB상품 포장", startDate: "2024-05-01", status: "진행중" },
  { id: "p-miga", clientId: "c-miga", name: "프랜차이즈 주방 표준 공정 개선 연구", productService: "표준 레시피·주방 공정", startDate: "2023-10-01", status: "진행중" },
  { id: "p-bolt", clientId: "c-bolt", name: "전력변환 모듈 효율 개선 연구", productService: "전력변환 모듈", startDate: "2023-04-01", status: "진행중" },
];

/* ───────────────── 월간 점검 (일부 고객사) ───────────────── */

function baseAnswers(overrides: Partial<CheckAnswers> = {}): CheckAnswers {
  return {
    personnelChange: false, spaceChange: false, registrationChange: false,
    projectOngoing: true, researchNotesWritten: true, expenseEvidenceOrganized: true,
    taxDocsPrepared: true, surveyResponseNeeded: false, memo: "", ...overrides,
  };
}

interface SeedCheck { clientId: string; month: string; answers: CheckAnswers }

const seedChecks: SeedCheck[] = [
  { clientId: "c-daon", month: "2026-05", answers: baseAnswers({ researchNotesWritten: false, memo: "5월 연구노트 미작성 — 작성 요청함" }) },
  { clientId: "c-gear", month: "2026-05", answers: baseAnswers({ personnelChange: true, personnelChangeType: "퇴사", memo: "연구전담요원 1명 퇴사 예정" }) },
  { clientId: "c-retail", month: "2026-05", answers: baseAnswers({ expenseEvidenceOrganized: false, memo: "서비스 분야 증빙 보강 필요" }) },
  { clientId: "c-code", month: "2026-05", answers: baseAnswers({ memo: "전 항목 양호" }) },
  { clientId: "c-living", month: "2026-05", answers: baseAnswers({ researchNotesWritten: false, expenseEvidenceOrganized: false, memo: "노트·증빙 동시 보완 필요" }) },
  { clientId: "c-miga", month: "2026-05", answers: baseAnswers({ registrationChange: true, memo: "대표자 변경 — 변경신고 검토" }) },
  { clientId: "c-bolt", month: "2026-05", answers: baseAnswers({ surveyResponseNeeded: true, memo: "활동조사 제출 완료" }) },
];

export const sampleChecks: MonthlyCheck[] = seedChecks.map((s, i) => {
  const { score, level } = evaluateRisk(s.answers);
  return {
    id: `chk-seed-${i + 1}`, clientId: s.clientId, month: s.month, answers: s.answers,
    score, level, createdAt: `${s.month}-26T10:00:00.000Z`,
  };
});

/* ───────────────── 연구노트 (일부 고객사) ───────────────── */

export const sampleNotes: ResearchNote[] = [
  // 볼트일렉: 이번 달(2026-06) 저장 완료 → 리포트 발송 대기
  {
    id: "note-bolt-202606", clientId: "c-bolt", projectId: "p-bolt", month: "2026-06",
    activities: "전력변환 모듈의 스위칭 손실을 줄이기 위해 게이트 드라이버 제어 파형을 개선하고, 부하 조건별 효율을 측정했다.",
    tests: "부하 25/50/100% 조건에서 변환효율 측정 — 중부하 효율 94.1% → 95.3% 개선.",
    problems: "경부하 구간 효율 개선폭이 작아 제어 로직 추가 검토 필요.",
    nextPlan: "경부하 대응 제어 알고리즘 적용 후 재측정.",
    roles: [{ name: "오세훈", role: "연구 총괄" }, { name: "김태리", role: "회로 설계·시험" }],
    relevance: "당사 주력 제품인 전력변환 모듈의 효율 경쟁력과 직접 연결됩니다.",
    draft: "(저장된 초안 본문)", auditReviewed: true, status: "저장 완료",
    createdAt: "2026-06-05T09:00:00.000Z", updatedAt: "2026-06-05T09:00:00.000Z",
  },
  // 코드웨이브: 이번 달 작성중
  {
    id: "note-code-202606", clientId: "c-code", projectId: "p-code", month: "2026-06",
    activities: "물류 최적화 알고리즘의 경로 탐색 성능을 개선하기 위한 휴리스틱을 시험 중.",
    tests: "", problems: "", nextPlan: "",
    roles: [{ name: "정우성", role: "연구소장" }],
    relevance: "", draft: "", auditReviewed: false, status: "작성중",
    createdAt: "2026-06-08T09:00:00.000Z", updatedAt: "2026-06-08T09:00:00.000Z",
  },
  // 정밀기어: 지난 달(2026-05) 저장 완료, 이번 달 미작성 → 작성 필요
  {
    id: "note-gear-202605", clientId: "c-gear", projectId: "p-gear", month: "2026-05",
    activities: "감속기 기어 치형을 개선해 내구 시험을 진행하고 마모량을 측정했다.",
    tests: "가속 내구시험 200시간 — 마모량 기준 대비 18% 감소.",
    problems: "고온 조건에서 윤활 성능 저하 관찰.", nextPlan: "고온용 윤활 사양 변경 후 재시험.",
    roles: [{ name: "박성근", role: "연구소장" }, { name: "이준호", role: "시험 평가" }],
    relevance: "정밀 감속기 제품의 내구 수명과 직접 연결.",
    draft: "(저장된 초안 본문)", auditReviewed: true, status: "저장 완료",
    createdAt: "2026-05-27T09:00:00.000Z", updatedAt: "2026-05-27T09:00:00.000Z",
  },
];
