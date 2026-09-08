import "@supabase/supabase-js";
//#region \0rolldown/runtime.js
var __commonJSMin = (cb, mod) => () => (mod || (cb((mod = { exports: {} }).exports, mod), cb = null), mod.exports);
//#endregion
//#region src/domain/consulting/workflowDefinition.ts
var STAGE_GROUP_ORDER = [
	"understand",
	"patent",
	"mvp",
	"venture",
	"submit"
];
var STAGES = [
	{
		key: "S0",
		code: "INTAKE",
		label: "회사 이해",
		group: "understand",
		purpose: "회사 기본 사실(대표자·설립·주소·번호·업종·주요 제품)을 사실표에 넣고 출처를 적는다.",
		exitChecklist: [
			"회사 기본 8항목이 사실표에 있다",
			"값마다 출처가 있다",
			"대표자 인터뷰 일정이 잡혔거나 끝났다"
		],
		requiredFacts: [
			"companyName",
			"representative",
			"establishedAt",
			"headOffice",
			"businessNumber",
			"industry",
			"mainProducts"
		],
		requiredArtifacts: [],
		promptTypes: ["GENERAL_PROJECT_REVIEW"],
		activeParts: "PART 1",
		skippable: false
	},
	{
		key: "S1",
		code: "VENTURE GATE",
		label: "GO / HOLD / NO-GO",
		group: "understand",
		purpose: "혁신성장유형에 맞는 회사인지 9개 항목으로 판정한다. HOLD 는 보강 후 GO 로 돌아온다.",
		exitChecklist: [
			"GO 항목을 하나씩 사실대로 표시했다",
			"결정과 이유를 적었다",
			"NO-GO 면 억지로 진행하지 않는다"
		],
		requiredFacts: ["coreProblem", "customers"],
		requiredArtifacts: [],
		promptTypes: ["GENERAL_PROJECT_REVIEW"],
		activeParts: "PART 1 · PART A §4",
		skippable: false
	},
	{
		key: "S2",
		code: "PROBLEM DISCOVERY",
		label: "핵심문제 확정",
		group: "understand",
		purpose: "현장에서 반복되는 문제 하나와 지금 방식의 한계를 한 문장씩 확정한다 (인터뷰 10문항).",
		exitChecklist: [
			"핵심 현장문제 한 문장",
			"기존 해결방식 한 문장",
			"대표자가 \"직접 발명했다\" 고 과장하지 않았다"
		],
		requiredFacts: ["coreProblem", "currentMethod"],
		requiredArtifacts: [],
		promptTypes: ["GENERAL_PROJECT_REVIEW"],
		activeParts: "PART 1 §7",
		skippable: false
	},
	{
		key: "S3",
		code: "PATENT IDEA",
		label: "특허 아이디어",
		group: "patent",
		purpose: "5개 고정 질문(문제·기존방식·차별구조·처리흐름·권리화 포인트)과 제목 후보를 만든다.",
		exitChecklist: [
			"5개 질문에 답이 있다",
			"특허명이 기술구조로 읽힌다(마케팅 문구 아님)",
			"발명자·출원인을 사실대로 정했다"
		],
		requiredFacts: ["coreTech"],
		requiredArtifacts: ["PATENT_IDEA"],
		promptTypes: ["PATENT_IDEA"],
		activeParts: "PART 2 §8·§9",
		skippable: true
	},
	{
		key: "S4",
		code: "PRIOR ART",
		label: "선행기술 검토",
		group: "patent",
		purpose: "KIPRIS 키워드·유사 특허·차별화 포인트를 정리한다. \"완전히 같은 게 없다\" 가 목적이 아니다.",
		exitChecklist: [
			"검색 키워드",
			"유사 목적·구성·처리순서 특허 확인",
			"무엇을 빼고 좁히고 강조할지 정했다"
		],
		requiredFacts: [],
		requiredArtifacts: ["PRIOR_ART_REVIEW"],
		promptTypes: ["PRIOR_ART_REVIEW"],
		activeParts: "PART 2 §10",
		skippable: true
	},
	{
		key: "S5",
		code: "KIPO REFERENCE SELECT",
		label: "참고자료 선정",
		group: "patent",
		purpose: "KIPO 118종에서 2~5종을 고르고 PDF 를 받는다. 받기 전에는 세부 문구를 추측해 쓰지 않는다.",
		exitChecklist: [
			"2~5종 선정",
			"선정 이유(4축)",
			"PDF 첨부 확인"
		],
		requiredFacts: [],
		requiredArtifacts: [],
		promptTypes: [],
		activeParts: "PART 2 §11 · APPENDIX A",
		skippable: true
	},
	{
		key: "S6",
		code: "PATENT DRAFT",
		label: "명세서 작성",
		group: "patent",
		purpose: "명세서·청구범위·요약서·도면 초안을 만들고 요약서 QA 를 통과한다.",
		exitChecklist: [
			"명세서 목차 12항목",
			"청구항 검토",
			"요약서 400자 기준·용어 통일·대표도 부호 일치",
			"예시 문장 복제 없음"
		],
		requiredFacts: ["coreTech"],
		requiredArtifacts: ["PATENT_SPEC_DRAFT"],
		promptTypes: ["PATENT_SPEC_DRAFT", "PATENT_CLAIMS_REVIEW"],
		activeParts: "PART 2 §12·§13",
		skippable: true
	},
	{
		key: "S7",
		code: "PATENT FILED",
		label: "출원 완료",
		group: "patent",
		purpose: "전자출원 후 출원번호·출원일·제출본·납부자료를 보관한다. 출원 ≠ 등록.",
		exitChecklist: [
			"최신 공식 기준 확인(특허로)",
			"출원번호·출원일 기록",
			"제출본·납부자료 보관",
			"심사청구 기한 메모"
		],
		requiredFacts: ["patent"],
		requiredArtifacts: ["PATENT_FILING_RECORD"],
		promptTypes: [],
		activeParts: "PART 2 §14 · K9",
		skippable: true
	},
	{
		key: "S8",
		code: "MVP STRATEGY LOCK",
		label: "MVP 설계 잠금",
		group: "mvp",
		purpose: "MVP_SPEC 을 잠근다 — 핵심 Journey 1개, AX 핵심기능 1개, Platform Surface, LIVE/DEMO/FUTURE, 안 만들 것.",
		exitChecklist: [
			"핵심가설 한 문장",
			"Primary Journey 가 특허 핵심기술과 같다",
			"AX 기능이 실제 AI 가 아니면 AI 라 부르지 않는다",
			"Future Preview 6~10"
		],
		requiredFacts: ["axCore", "platformUsers"],
		requiredArtifacts: ["MVP_SPEC"],
		promptTypes: ["MVP_STRATEGY"],
		activeParts: "PART 3 §2 · PART 4",
		skippable: false
	},
	{
		key: "S9",
		code: "MVP BUILD",
		label: "MVP 구현·QA",
		group: "mvp",
		purpose: "Claude Code 빌드 프롬프트로 구현하고 Render/Click/Mobile QA 를 거쳐 URL 을 확보한다.",
		exitChecklist: [
			"URL 이 열린다",
			"390/430 실측",
			"Primary Journey 클릭 완주",
			"404·Dead CTA 0",
			"3분 Demo 가능"
		],
		requiredFacts: ["mvpUrl"],
		requiredArtifacts: ["MVP_BUILD_PROMPT", "MVP_STATE"],
		promptTypes: ["MVP_CLAUDE_CODE_BUILD"],
		activeParts: "PART 3 §43~53",
		skippable: false
	},
	{
		key: "S10",
		code: "VENTURE FACTSHEET",
		label: "사실표 잠금",
		group: "venture",
		purpose: "숫자·사실의 단일 원본을 잠근다. 숫자마다 기준연도·출처·산식.",
		exitChecklist: [
			"재무·고객·시장·3년 계획 채움",
			"demo 값이 실적처럼 남아 있지 않다",
			"스냅샷 저장"
		],
		requiredFacts: [
			"employees",
			"revenue3y",
			"customers",
			"tam",
			"sam",
			"som",
			"marketFormula",
			"revenueGoal",
			"fundingNeed"
		],
		requiredArtifacts: ["VENTURE_FACTSHEET_SNAPSHOT"],
		promptTypes: [],
		activeParts: "PART 1 §5 · PART 5",
		skippable: false
	},
	{
		key: "S11",
		code: "VENTURE PLAN",
		label: "사업계획서 7항목",
		group: "venture",
		purpose: "개발배경 → 솔루션 → 기술개발 → 시장(TAM/SAM/SOM) → 경쟁사 → 시장진입 → 자금을 순서대로 쓴다.",
		exitChecklist: [
			"7항목 초안",
			"\"경쟁사 없음\" 이 없다",
			"현재/개발중/향후 구분",
			"특허·MVP 와 같은 기술명"
		],
		requiredFacts: [
			"coreTech",
			"tam",
			"sam",
			"som"
		],
		requiredArtifacts: ["VENTURE_PLAN_SECTION"],
		promptTypes: ["VENTURE_PLAN_SECTION", "VENTURE_FULL_REVIEW"],
		activeParts: "PART 5 §26~32",
		skippable: false
	},
	{
		key: "S12",
		code: "EVIDENCE & INFOGRAPHIC",
		label: "증빙 10슬롯",
		group: "venture",
		purpose: "실제 신청화면 10개 첨부 슬롯마다 주장·증빙·인포그래픽 1장(중요한 곳만 2장)을 맞춘다.",
		exitChecklist: [
			"10슬롯 모두 주장·출처",
			"Claim–Evidence Matrix",
			"향후 기능이 현재처럼 그려지지 않았다"
		],
		requiredFacts: [],
		requiredArtifacts: ["CLAIM_EVIDENCE_MATRIX"],
		promptTypes: ["EVIDENCE_REVIEW", "INFOGRAPHIC_BRIEF"],
		activeParts: "PART 5 §33·§34 · PART 6 §36",
		skippable: false
	},
	{
		key: "S13",
		code: "FINAL QA",
		label: "Judge / Devil",
		group: "submit",
		purpose: "P0 Red Flag 12개를 없애고 Judge 10항목을 사람이 매긴다. P0 가 남으면 완료 선언 금지.",
		exitChecklist: [
			"P0 12개 전부 확인",
			"Judge 점수 기록",
			"One Core Thread 경고 0"
		],
		requiredFacts: [],
		requiredArtifacts: ["QA_REPORT"],
		promptTypes: ["VENTURE_FULL_REVIEW", "GENERAL_PROJECT_REVIEW"],
		activeParts: "PART 7 · PART 9 §50~52",
		skippable: false
	},
	{
		key: "S14",
		code: "SUBMITTED",
		label: "신청 완료",
		group: "submit",
		purpose: "신청 당일 최신 공식 기준(글자수·첨부수·용량·발급일)을 확인하고 제출본을 백업한다.",
		exitChecklist: [
			"최신 공식 기준 확인(벤처확인종합관리시스템)",
			"기본서류 8종 발급일",
			"제출본 백업",
			"신청일 기록"
		],
		requiredFacts: [],
		requiredArtifacts: ["SUBMISSION_RECORD"],
		promptTypes: [],
		activeParts: "PART 5 · PART 9 §53 · K9",
		skippable: false
	},
	{
		key: "S15",
		code: "FIELD REVIEW",
		label: "현장실사 준비",
		group: "submit",
		purpose: "대표자 3분 Script · MVP 3분 Demo · 예상 Q&A 10~15 · Evidence Pack · 외울 숫자 · 금지표현 · Mock Review.",
		exitChecklist: [
			"3분 Script",
			"Demo 동선",
			"Q&A 10~15",
			"Evidence Pack 체크",
			"외울 숫자 8~12",
			"Mock Review 1회"
		],
		requiredFacts: [],
		requiredArtifacts: ["FIELD_REVIEW_SCRIPT", "FIELD_REVIEW_QA"],
		promptTypes: ["FIELD_REVIEW_SCRIPT", "FIELD_REVIEW_QA"],
		activeParts: "PART 8 · PART 7",
		skippable: true
	},
	{
		key: "S16",
		code: "RESULT",
		label: "결과·후속",
		group: "submit",
		purpose: "결과를 기록하고 본개발·정책자금·지원사업 연계로 넘긴다.",
		exitChecklist: ["결과 기록", "후속(본개발·자금) 메모"],
		requiredFacts: [],
		requiredArtifacts: ["RESULT_RECORD"],
		promptTypes: ["GENERAL_PROJECT_REVIEW"],
		activeParts: "PART 1 상태판",
		skippable: false
	}
];
var STAGE_ORDER = STAGES.map((s) => s.key);
var BY_KEY = new Map(STAGES.map((s) => [s.key, s]));
function stageDef(key) {
	const def = BY_KEY.get(key);
	if (!def) throw new Error(`알 수 없는 단계: ${key}`);
	return def;
}
function stageIndex(key) {
	return STAGE_ORDER.indexOf(key);
}
function nextStageKey(key) {
	const i = stageIndex(key);
	return i >= 0 && i < STAGE_ORDER.length - 1 ? STAGE_ORDER[i + 1] : null;
}
function prevStageKey(key) {
	const i = stageIndex(key);
	return i > 0 ? STAGE_ORDER[i - 1] : null;
}
function stagesByGroup() {
	return STAGE_GROUP_ORDER.map((group) => ({
		group,
		stages: STAGES.filter((s) => s.group === group)
	}));
}
function isStageKey(v) {
	return typeof v === "string" && STAGE_ORDER.includes(v);
}
//#endregion
//#region src/domain/consulting/factsheetSchema.ts
var FACT_SECTION_LABEL = {
	company: "회사 기본",
	org: "조직",
	finance: "재무",
	business: "고객·사업",
	tech: "기술",
	market: "시장",
	plan3y: "3년 계획"
};
var FACT_SECTION_ORDER = [
	"company",
	"org",
	"finance",
	"business",
	"tech",
	"market",
	"plan3y"
];
var FACT_STATUS_LABEL = {
	confirmed: "확정",
	unverified: "미확인",
	planned: "계획",
	demo: "시연용",
	future: "향후"
};
var NUM_HINT = "숫자 + 기준연도 + 출처 + 산식";
var FACTS = [
	{
		key: "companyName",
		section: "company",
		label: "회사명",
		placeholder: "법인명 그대로",
		numeric: false,
		fromClient: "companyName"
	},
	{
		key: "representative",
		section: "company",
		label: "대표자",
		placeholder: "이름",
		numeric: false,
		fromClient: "representativeName"
	},
	{
		key: "establishedAt",
		section: "company",
		label: "설립일",
		placeholder: "YYYY-MM-DD",
		numeric: false,
		fromClient: "establishedAt"
	},
	{
		key: "headOffice",
		section: "company",
		label: "본점",
		placeholder: "본점 소재지",
		numeric: false,
		fromClient: "businessAddress"
	},
	{
		key: "businessNumber",
		section: "company",
		label: "사업자등록번호",
		placeholder: "000-00-00000",
		numeric: false,
		fromClient: "businessNumber"
	},
	{
		key: "corporateNumber",
		section: "company",
		label: "법인등록번호",
		placeholder: "법인만",
		numeric: false,
		fromClient: "corporateNumber"
	},
	{
		key: "industry",
		section: "company",
		label: "현재 업종",
		placeholder: "업태 · 종목",
		numeric: false,
		fromClient: "industry"
	},
	{
		key: "mainProducts",
		section: "company",
		label: "주요 제품·서비스",
		placeholder: "지금 돈을 버는 것",
		numeric: false,
		multiline: true
	},
	{
		key: "employees",
		section: "org",
		label: "현재 직원수",
		placeholder: "4대보험 기준",
		numeric: true,
		fromClient: "employeeCount"
	},
	{
		key: "rdStaff",
		section: "org",
		label: "R&D 인력",
		placeholder: "명",
		numeric: true
	},
	{
		key: "rdOrg",
		section: "org",
		label: "연구개발조직",
		placeholder: "기업부설연구소 / 전담부서 / 없음",
		numeric: false
	},
	{
		key: "ceoCareer",
		section: "org",
		label: "대표자 핵심 경력",
		placeholder: "업력·현장 경험",
		numeric: false,
		multiline: true
	},
	{
		key: "keyPeople",
		section: "org",
		label: "핵심인력",
		placeholder: "이름 대신 역할로 적어도 된다",
		numeric: false,
		multiline: true
	},
	{
		key: "revenue3y",
		section: "finance",
		label: "최근 3개년 매출",
		placeholder: NUM_HINT,
		numeric: true,
		multiline: true
	},
	{
		key: "profit3y",
		section: "finance",
		label: "최근 3개년 영업이익",
		placeholder: NUM_HINT,
		numeric: true,
		multiline: true
	},
	{
		key: "revenueThisYear",
		section: "finance",
		label: "당해연도 예상매출",
		placeholder: NUM_HINT,
		numeric: true
	},
	{
		key: "fundingNow",
		section: "finance",
		label: "현재 자금조달",
		placeholder: "확보 완료 / 협의 중 / 계획 구분",
		numeric: true,
		multiline: true
	},
	{
		key: "revenueTarget3y",
		section: "finance",
		label: "향후 3개년 목표매출",
		placeholder: NUM_HINT,
		numeric: true,
		multiline: true
	},
	{
		key: "customers",
		section: "business",
		label: "현재 고객수",
		placeholder: NUM_HINT,
		numeric: true
	},
	{
		key: "accounts",
		section: "business",
		label: "현재 거래처수",
		placeholder: NUM_HINT,
		numeric: true
	},
	{
		key: "customerSegments",
		section: "business",
		label: "주요 고객군",
		placeholder: "누구에게 파는가",
		numeric: false
	},
	{
		key: "repeatSignals",
		section: "business",
		label: "주문·문의·예약·반복거래",
		placeholder: "반복 사용의 근거",
		numeric: true,
		multiline: true
	},
	{
		key: "contracts",
		section: "business",
		label: "주요 계약·납품·서비스 실적",
		placeholder: "증빙 가능한 것만",
		numeric: false,
		multiline: true
	},
	{
		key: "coreProblem",
		section: "tech",
		label: "핵심 현장문제",
		placeholder: "반복되는 문제 한 문장",
		numeric: false,
		multiline: true
	},
	{
		key: "currentMethod",
		section: "tech",
		label: "기존 해결방식",
		placeholder: "지금은 어떻게 하는가, 왜 부족한가",
		numeric: false,
		multiline: true
	},
	{
		key: "coreTech",
		section: "tech",
		label: "핵심 해결기술",
		placeholder: "특허·MVP·사업계획서가 같은 이름으로 부를 기술",
		numeric: false,
		multiline: true
	},
	{
		key: "implemented",
		section: "tech",
		label: "현재 구현완료",
		placeholder: "LIVE 인 것만",
		numeric: false,
		multiline: true
	},
	{
		key: "inDevelopment",
		section: "tech",
		label: "개발 중",
		placeholder: "",
		numeric: false,
		multiline: true
	},
	{
		key: "futureDev",
		section: "tech",
		label: "향후 개발",
		placeholder: "FUTURE — 현재처럼 쓰지 않는다",
		numeric: false,
		multiline: true
	},
	{
		key: "patent",
		section: "tech",
		label: "특허",
		placeholder: "출원번호 · 출원일 · \"출원 중\"",
		numeric: false
	},
	{
		key: "mvpUrl",
		section: "tech",
		label: "MVP URL",
		placeholder: "https://",
		numeric: false
	},
	{
		key: "axCore",
		section: "tech",
		label: "AX 핵심기능",
		placeholder: "분석·추천·최적화 중 1개",
		numeric: false
	},
	{
		key: "platformUsers",
		section: "tech",
		label: "Platform 사용자",
		placeholder: "고객 / 거래처 / 현장 직원",
		numeric: false
	},
	{
		key: "tam",
		section: "market",
		label: "TAM",
		placeholder: NUM_HINT,
		numeric: true
	},
	{
		key: "sam",
		section: "market",
		label: "SAM",
		placeholder: NUM_HINT,
		numeric: true
	},
	{
		key: "som",
		section: "market",
		label: "SOM",
		placeholder: NUM_HINT,
		numeric: true
	},
	{
		key: "marketFormula",
		section: "market",
		label: "각 산식",
		placeholder: "예: 사업체 2,800 × 확보율 3% × 연 360만원",
		numeric: false,
		multiline: true
	},
	{
		key: "marketBaseYear",
		section: "market",
		label: "기준연도",
		placeholder: "YYYY",
		numeric: false
	},
	{
		key: "marketSource",
		section: "market",
		label: "출처",
		placeholder: "통계청·협회·보고서 이름",
		numeric: false
	},
	{
		key: "techGoal",
		section: "plan3y",
		label: "기술 목표",
		placeholder: "1년차 / 2년차 / 3년차",
		numeric: false,
		multiline: true
	},
	{
		key: "customerGoal",
		section: "plan3y",
		label: "고객 목표",
		placeholder: "현재 → 3년 후 (산식)",
		numeric: true
	},
	{
		key: "revenueGoal",
		section: "plan3y",
		label: "매출 목표",
		placeholder: NUM_HINT,
		numeric: true
	},
	{
		key: "marketExpansion",
		section: "plan3y",
		label: "시장 확대",
		placeholder: "지역·업종·채널",
		numeric: false,
		multiline: true
	},
	{
		key: "fundingNeed",
		section: "plan3y",
		label: "자금 필요액",
		placeholder: NUM_HINT,
		numeric: true
	},
	{
		key: "fundingUse",
		section: "plan3y",
		label: "자금 사용처",
		placeholder: "개발인력·시스템·인증/특허·마케팅 …",
		numeric: false,
		multiline: true
	}
];
var FACT_BY_KEY = new Map(FACTS.map((f) => [f.key, f]));
function factDef(key) {
	const def = FACT_BY_KEY.get(key);
	if (!def) throw new Error(`알 수 없는 사실 항목: ${key}`);
	return def;
}
function factsBySection() {
	return FACT_SECTION_ORDER.map((section) => ({
		section,
		facts: FACTS.filter((f) => f.section === section)
	}));
}
function emptyFact() {
	return {
		value: "",
		status: "unverified",
		source: "",
		asOfDate: "",
		note: "",
		updatedAt: null
	};
}
function factFilled(v) {
	return !!v && v.value.trim() !== "";
}
function factText(sheet, key) {
	return sheet[key]?.value.trim() ?? "";
}
/** 완성도 — 채운 항목 / 전체. 묶음별로도 낸다 */
function factCompleteness(sheet) {
	const bySection = Object.fromEntries(FACT_SECTION_ORDER.map((s) => [s, {
		filled: 0,
		total: 0
	}]));
	let filled = 0;
	let demoCount = 0;
	let unverifiedCount = 0;
	for (const f of FACTS) {
		bySection[f.section].total += 1;
		const v = sheet[f.key];
		if (factFilled(v)) {
			filled += 1;
			bySection[f.section].filled += 1;
			if (v.status === "demo") demoCount += 1;
			if (v.status === "unverified") unverifiedCount += 1;
		}
	}
	return {
		filled,
		total: FACTS.length,
		bySection,
		demoCount,
		unverifiedCount
	};
}
/** 비어 있는 필수 항목 */
function missingFacts(sheet, required) {
	return required.filter((k) => !factFilled(sheet[k]));
}
/**
* 고객 운영 기록에서 회사 기본값을 가져온다.
* 이미 값이 있는 칸은 건드리지 않는다 — 사실표가 원본이다.
* 출처는 '고객 운영 기록' 으로 적고 상태는 unverified 로 둔다(서류로 확인한 것이 아니므로).
*/
function seedFactsFromClient(sheet, client, at) {
	const out = { ...sheet };
	const industry = [client.businessCategory, client.businessItem].filter((s) => s && s.trim()).join(" · ") || client.industry;
	const pick = {
		companyName: client.companyName,
		representativeName: client.representativeName,
		establishedAt: client.establishedAt,
		businessAddress: client.businessAddress,
		businessNumber: client.businessNumber,
		corporateNumber: client.corporateNumber,
		industry,
		employeeCount: client.employeeCount
	};
	for (const f of FACTS) {
		if (!f.fromClient) continue;
		if (factFilled(out[f.key])) continue;
		const value = (pick[f.fromClient] ?? "").trim();
		if (value === "") continue;
		out[f.key] = {
			value,
			status: "unverified",
			source: "고객 운영 기록",
			asOfDate: at.slice(0, 10),
			note: "",
			updatedAt: at
		};
	}
	return out;
}
/** 사실표를 사람이 읽는 텍스트로 (프롬프트·스냅샷·복사에 쓴다). 빈 항목은 뺀다 */
function factsheetToText(sheet, opts = {}) {
	const lines = [];
	for (const { section, facts } of factsBySection()) {
		const rows = facts.filter((f) => !opts.onlyKeys || opts.onlyKeys.includes(f.key)).filter((f) => factFilled(sheet[f.key]));
		if (rows.length === 0) continue;
		lines.push(`[${FACT_SECTION_LABEL[section]}]`);
		for (const f of rows) {
			const v = sheet[f.key];
			const meta = opts.withMeta === false ? "" : ` (${FACT_STATUS_LABEL[v.status]}${v.asOfDate ? ` · ${v.asOfDate}` : ""}${v.source ? ` · 출처: ${v.source}` : ""})`;
			lines.push(`${f.label}: ${v.value.trim().replace(/\n+/g, " / ")}${meta}`);
			if (v.note.trim()) lines.push(`  산식/비고: ${v.note.trim().replace(/\n+/g, " / ")}`);
		}
		lines.push("");
	}
	return lines.join("\n").trim();
}
//#endregion
//#region src/domain/consulting/projectModel.ts
var CORE_THREAD_KEYS = [
	"fieldProblem",
	"existingMethod",
	"coreTech",
	"patentPoint",
	"axCore",
	"platformSurface",
	"ventureSentence",
	"keyEvidence"
];
var CORE_THREAD_LABEL = {
	fieldProblem: "현장문제",
	existingMethod: "기존방식",
	coreTech: "핵심 해결기술",
	patentPoint: "특허 권리화 포인트",
	axCore: "MVP AX Core",
	platformSurface: "Platform Surface",
	ventureSentence: "벤처 Solution 핵심문장",
	keyEvidence: "핵심 증빙"
};
function emptyStage() {
	return {
		status: "not_started",
		skipReason: "",
		blockedBy: "",
		note: "",
		startedAt: null,
		completedAt: null,
		updatedAt: null
	};
}
function emptyStages() {
	return Object.fromEntries(STAGE_ORDER.map((k) => [k, emptyStage()]));
}
function emptyCoreThread() {
	return Object.fromEntries(CORE_THREAD_KEYS.map((k) => [k, ""]));
}
function emptyPatent() {
	return {
		problem: "",
		existingMethod: "",
		differentStructure: "",
		processFlow: "",
		claimPoint: "",
		titleCandidates: "",
		priorArtKeywords: "",
		priorArtFindings: "",
		inventors: "",
		applicant: "",
		rightsNote: "",
		applicationNumber: "",
		filedAt: "",
		examRequestDue: "",
		filingStatus: "none"
	};
}
function emptyMvp() {
	return {
		productName: "",
		oneLineValue: "",
		targetUser: "",
		primaryJourney: "",
		axCoreFeature: "",
		axMode: "",
		platformSurface: "",
		live: "",
		demo: "",
		future: "",
		notBuilding: "",
		demoDataAssumption: "",
		mvpUrl: "",
		referenceStyle: ""
	};
}
/** 기본 제출서류 8종 (Master §24) — 키는 바꾸지 않는다 */
var VENTURE_DOCUMENTS = [
	{
		key: "sme",
		label: "중소기업확인서",
		hint: "중소기업현황정보시스템"
	},
	{
		key: "bizReg",
		label: "사업자등록증",
		hint: ""
	},
	{
		key: "corpReg",
		label: "법인등기사항전부증명서",
		hint: "법인 · 신청일 근접 발급"
	},
	{
		key: "vat",
		label: "부가가치세 과세표준증명원",
		hint: "요구기간 확인"
	},
	{
		key: "fin",
		label: "재무제표 또는 감사보고서",
		hint: "요구기간 확인"
	},
	{
		key: "empIns",
		label: "고용보험 취득자/가입자 명부",
		hint: "요구기간 확인"
	},
	{
		key: "ins4",
		label: "4대보험 가입자 명부",
		hint: "최신"
	},
	{
		key: "shareholders",
		label: "주주명부",
		hint: "법인 · 최신"
	}
];
function emptyVenture() {
	const section = () => ({
		outline: "",
		done: false
	});
	return {
		sections: {
			1: section(),
			2: section(),
			3: section(),
			4: section(),
			5: section(),
			6: section(),
			7: section()
		},
		documents: Object.fromEntries(VENTURE_DOCUMENTS.map((d) => [d.key, false])),
		judgeScores: {},
		redFlagsCleared: {},
		submittedAt: "",
		submissionNote: ""
	};
}
function emptyFieldReview() {
	return {
		reviewDate: "",
		script: "",
		demoFlow: "",
		qa: [],
		numbersToMemorize: [],
		evidencePackChecked: {},
		mockReviewDone: false,
		result: ""
	};
}
function str(v, fallback = "") {
	return typeof v === "string" ? v : fallback;
}
function normalizeProject(raw) {
	const stages = emptyStages();
	if (raw.stages && typeof raw.stages === "object") for (const k of STAGE_ORDER) {
		const v = raw.stages[k];
		if (v) stages[k] = {
			...stages[k],
			...v
		};
	}
	const factsheet = { ...raw.factsheet ?? {} };
	for (const [k, v] of Object.entries(factsheet)) if (v) factsheet[k] = {
		...emptyFact(),
		...v
	};
	const thread = emptyCoreThread();
	if (raw.coreThread) for (const k of CORE_THREAD_KEYS) thread[k] = str(raw.coreThread[k]);
	return {
		id: raw.id,
		workspaceId: raw.workspaceId ?? null,
		clientId: raw.clientId,
		clientName: str(raw.clientName),
		moduleKey: "patent_venture_mvp",
		title: str(raw.title),
		status: raw.status ?? "active",
		currentStage: isStageKey(raw.currentStage) ? raw.currentStage : "S0",
		stages,
		factsheet,
		coreThread: thread,
		gate: {
			items: {},
			decision: null,
			reason: "",
			decidedAt: null,
			...raw.gate ?? {}
		},
		freshness: Array.isArray(raw.freshness) ? raw.freshness : [],
		kipo: Array.isArray(raw.kipo) ? raw.kipo.map((s) => ({
			code: str(s.code),
			reason: str(s.reason),
			pdfAttached: s.pdfAttached === true
		})) : [],
		patent: {
			...emptyPatent(),
			...raw.patent ?? {}
		},
		mvp: {
			...emptyMvp(),
			...raw.mvp ?? {}
		},
		venture: {
			...emptyVenture(),
			...raw.venture ?? {},
			sections: {
				...emptyVenture().sections,
				...raw.venture?.sections ?? {}
			},
			documents: {
				...emptyVenture().documents,
				...raw.venture?.documents ?? {}
			}
		},
		fieldReview: {
			...emptyFieldReview(),
			...raw.fieldReview ?? {}
		},
		createdAt: raw.createdAt,
		updatedAt: raw.updatedAt
	};
}
/** 진행도 — completed/skipped 단계 수 / 17 */
function projectProgress(p) {
	const done = STAGE_ORDER.filter((k) => p.stages[k].status === "completed" || p.stages[k].status === "skipped").length;
	return {
		done,
		total: STAGE_ORDER.length,
		percent: Math.round(done / STAGE_ORDER.length * 100)
	};
}
/** 지금 막힌 단계들 */
function blockedStages(p) {
	return STAGE_ORDER.filter((k) => p.stages[k].status === "blocked");
}
//#endregion
//#region src/domain/consulting/coreThread.ts
/** 한글·영문 2자 이상 토막 (조사가 붙어도 앞 2~3자는 겹치므로 거칠지만 설명 가능한 기준) */
function contentWords(text) {
	const out = /* @__PURE__ */ new Set();
	const tokens = text.toLowerCase().match(/[가-힣a-z0-9]{2,}/g) ?? [];
	for (const t of tokens) {
		out.add(t);
		if (/^[가-힣]{3,}$/.test(t)) out.add(t.slice(0, 2));
	}
	for (const s of STOP) out.delete(s);
	return out;
}
var STOP = [
	"시스템",
	"방법",
	"기반",
	"통해",
	"위한",
	"있는",
	"하는",
	"및",
	"그리고",
	"기능",
	"서비스",
	"제공",
	"이용",
	"관리",
	"데이터"
];
function sharedWords(a, b) {
	const wa = contentWords(a);
	const wb = contentWords(b);
	return [...wa].filter((w) => wb.has(w));
}
/** 등록 표현 — 출원 상태에서 쓰면 안 되는 말 (§14-2, §49) */
var REGISTERED_WORDS = /특허\s*등록|등록\s*완료|등록특허|등록된\s*특허/;
var AI_WORD = /\bAI\b|인공지능|AI가|AI 가|AI로/;
function coreThreadWarnings(p) {
	const out = [];
	const t = p.coreThread;
	const empty = CORE_THREAD_KEYS.filter((k) => t[k].trim() === "");
	for (const k of empty) out.push({
		code: `thread_empty_${k}`,
		severity: "info",
		message: `${CORE_THREAD_LABEL[k]} 이(가) 비어 있습니다.`,
		tab: "thread",
		focus: k
	});
	const anchor = t.coreTech.trim();
	if (anchor !== "") {
		const pairs = [
			["patentPoint", t.patentPoint],
			["axCore", t.axCore],
			["ventureSentence", t.ventureSentence]
		];
		for (const [k, text] of pairs) {
			if (text.trim() === "") continue;
			if (sharedWords(anchor, text).length === 0) out.push({
				code: `thread_drift_${k}`,
				severity: "p1",
				message: `${CORE_THREAD_LABEL[k]} 이(가) 핵심 해결기술과 같은 낱말을 하나도 쓰지 않습니다 — 서로 다른 기술로 읽힐 수 있습니다 (Master §35-1).`,
				tab: "thread",
				focus: k
			});
		}
	}
	if (p.patent.filingStatus !== "registered") {
		if ([
			t.coreTech,
			t.patentPoint,
			t.ventureSentence,
			factText(p.factsheet, "patent"),
			p.fieldReview.script
		].some((x) => REGISTERED_WORDS.test(x))) out.push({
			code: "patent_registered_wording",
			severity: "p0",
			message: "아직 등록되지 않은 특허를 \"등록\" 으로 적은 곳이 있습니다. 등록 전에는 \"특허출원 중\" 으로 씁니다 (Master §14-2).",
			tab: "patent"
		});
	}
	if ((p.mvp.axMode === "rule" || p.mvp.axMode === "scoring" || p.mvp.axMode === "optimization" || p.mvp.axMode === "demo") && (AI_WORD.test(t.axCore) || AI_WORD.test(p.mvp.axCoreFeature))) out.push({
		code: "ax_called_ai",
		severity: "p1",
		message: `AX 기능 방식이 "${p.mvp.axMode}" 인데 문장에서 AI 라고 부릅니다. 분석로직·자동판단·점수기반 추천처럼 실제에 맞는 말로 바꿉니다 (Master §18-2).`,
		tab: "mvp",
		focus: "axCoreFeature"
	});
	for (const k of p.fieldReview.numbersToMemorize) {
		const f = p.factsheet[k];
		if (f && f.status === "demo") out.push({
			code: `demo_number_memorized_${k}`,
			severity: "p0",
			message: `시연용(demo) 값을 대표가 외울 숫자에 넣었습니다. 실사에서 실적처럼 말하게 됩니다 (Master K10·§49).`,
			tab: "review",
			focus: k
		});
	}
	const factTech = factText(p.factsheet, "coreTech");
	if (factTech !== "" && anchor !== "" && sharedWords(factTech, anchor).length === 0) out.push({
		code: "thread_vs_factsheet_tech",
		severity: "p1",
		message: "사실표의 핵심 해결기술과 핵심 줄기의 핵심 해결기술이 다른 말을 씁니다. 한쪽으로 맞춥니다.",
		tab: "thread",
		focus: "coreTech"
	});
	return out;
}
function coreThreadToText(p) {
	return CORE_THREAD_KEYS.filter((k) => p.coreThread[k].trim() !== "").map((k) => `${CORE_THREAD_LABEL[k]}: ${p.coreThread[k].trim()}`).join("\n");
}
//#endregion
//#region src/domain/consulting/qaRules.ts
var RED_FLAGS = [
	{
		no: 1,
		text: "특허 핵심과 MVP 핵심이 다르다"
	},
	{
		no: 2,
		text: "대표자가 시스템과 기술을 설명하지 못한다"
	},
	{
		no: 3,
		text: "DEMO 를 실제 운영성과처럼 표현했다"
	},
	{
		no: 4,
		text: "Rule 인데 AI 라고 과장했다"
	},
	{
		no: 5,
		text: "TAM / SAM / SOM 근거가 부족하다"
	},
	{
		no: 6,
		text: "매출·고객·직원·시장·자금 숫자가 서로 다르다"
	},
	{
		no: 7,
		text: "외부개발·발명자·권리관계를 설명할 수 없다"
	},
	{
		no: 8,
		text: "Future 기능을 현재 완료기능처럼 표시했다"
	},
	{
		no: 9,
		text: "출원 상태인데 \"특허 등록\" 이라고 적었다"
	},
	{
		no: 10,
		text: "경쟁사 분석 없이 \"경쟁사 없음\" 이라고 썼다"
	},
	{
		no: 11,
		text: "3년 목표가 현재 실적과 아무 연결이 없다"
	},
	{
		no: 12,
		text: "사업계획서 주장에 증빙이 전혀 없다"
	}
];
var JUDGE_AXES = [
	{
		key: "A",
		label: "Problem Reality — 문제가 실제인가"
	},
	{
		key: "B",
		label: "Representative / Team Fit — 대표·팀이 맞는가"
	},
	{
		key: "C",
		label: "Technical Differentiation — 기술 차별성"
	},
	{
		key: "D",
		label: "Patent ↔ MVP Consistency — 특허와 MVP 가 같은 기술인가"
	},
	{
		key: "E",
		label: "MVP Proof — 실제로 동작하는가"
	},
	{
		key: "F",
		label: "TAM/SAM/SOM Credibility — 시장 숫자 신뢰도"
	},
	{
		key: "G",
		label: "Competitive Advantage — 경쟁우위"
	},
	{
		key: "H",
		label: "Market Entry / Growth — 시장진입·성장"
	},
	{
		key: "I",
		label: "Funding Logic — 자금 논리"
	},
	{
		key: "J",
		label: "Evidence / Integrity — 증빙·정직성"
	}
];
/** Judge 합계 해석 (§42) — 점수는 사람이 매긴 값의 합일 뿐이다 */
function judgeVerdict(total) {
	if (total === null) return "아직 매기지 않음";
	if (total >= 90) return "제출 권장";
	if (total >= 80) return "보강 후 제출";
	if (total >= 70) return "주요 약점 수정";
	return "HOLD 재검토";
}
function judgeTotal(scores) {
	const vals = JUDGE_AXES.map((a) => scores[a.key]).filter((v) => typeof v === "number");
	if (vals.length < JUDGE_AXES.length) return null;
	return vals.reduce((a, b) => a + b, 0);
}
var GATE_ITEMS = [
	{
		key: "knowsProblem",
		text: "대표자 또는 조직이 실제 현장문제를 알고 있다"
	},
	{
		key: "repeatedInefficiency",
		text: "현재 업무·제품·서비스에서 반복되는 비효율 또는 고객문제가 있다"
	},
	{
		key: "differentStructure",
		text: "기존 방식과 다른 해결구조를 설계할 수 있다"
	},
	{
		key: "patentPoint",
		text: "특허 또는 기술자산으로 연결할 포인트가 있다"
	},
	{
		key: "mvpShowable",
		text: "핵심기능을 MVP 로 보여줄 수 있다"
	},
	{
		key: "realTarget",
		text: "실제 고객/거래처/이용자 또는 명확한 타깃시장이 있다"
	},
	{
		key: "marketData",
		text: "TAM/SAM/SOM 을 객관적 자료로 구성할 수 있다"
	},
	{
		key: "threeYearPath",
		text: "향후 3년 기술·사업화 경로를 설명할 수 있다"
	},
	{
		key: "ceoCanExplain",
		text: "대표자가 현장실사에서 자기 사업과 기술을 설명할 수 있다"
	}
];
/** 10개 첨부 슬롯 (§33) */
var EVIDENCE_SLOTS = [
	{
		slot: 1,
		where: "개발 배경 및 필요성",
		direction: "Before / 문제구조 / 현장증빙",
		pages: "1~2장"
	},
	{
		slot: 2,
		where: "솔루션 소개",
		direction: "AX+Platform 구조 / 핵심 Solution / MVP",
		pages: "1~2장"
	},
	{
		slot: 3,
		where: "기술개발 — 추진경과",
		direction: "특허 + MVP + 현재 구현범위",
		pages: "1~2장"
	},
	{
		slot: 4,
		where: "기술개발 — 향후 3년",
		direction: "3년 기술 Roadmap",
		pages: "1장"
	},
	{
		slot: 5,
		where: "팀·대표자·기업가정신",
		direction: "대표자 현장경험 / 문제인식 / 실행역량",
		pages: "1장"
	},
	{
		slot: 6,
		where: "목표시장 및 고객",
		direction: "TAM / SAM / SOM",
		pages: "1~2장"
	},
	{
		slot: 7,
		where: "경쟁사 분석",
		direction: "기존방식 / 경쟁사 / 자사 비교",
		pages: "1장"
	},
	{
		slot: 8,
		where: "시장진입·확대 — 추진경과",
		direction: "고객/거래처/매출/Demand Proof",
		pages: "1장"
	},
	{
		slot: 9,
		where: "시장진입·확대 — 향후 3년",
		direction: "고객확대 / 채널 / 지역·업종 확장",
		pages: "1장"
	},
	{
		slot: 10,
		where: "자금운용",
		direction: "자금조달·사용처·Milestone",
		pages: "1장"
	}
];
/** 사업계획서 7항목 (§23) */
var PLAN_SECTIONS = [
	{
		no: 1,
		title: "개발 배경 및 필요성",
		question: "어떤 문제를 해결할 것인가?",
		must: [
			"실제 문제",
			"문제가 생기는 상황",
			"기존 방식의 한계",
			"개발 필요성",
			"객관적 근거",
			"대표자/회사가 왜 이 문제를 잘 아는지"
		],
		slots: [1]
	},
	{
		no: 2,
		title: "솔루션 소개",
		question: "어떻게 해결할 것인가?",
		must: [
			"기술명",
			"주요기능",
			"구성",
			"작동원리(Input→Data→Logic→Output→Action→Result)",
			"기존 대비 차별성",
			"성능·효과의 객관적 근거",
			"특허 핵심구조와 연결"
		],
		slots: [2]
	},
	{
		no: 3,
		title: "기술개발",
		question: "지금까지 무엇을 개발했고 3년간 무엇을 개발할 것인가?",
		must: [
			"현재까지(R&D·MVP·특허·인력·외부협업)",
			"개발 중",
			"1년차·2년차·3년차"
		],
		slots: [3, 4]
	},
	{
		no: 4,
		title: "목표시장 및 고객 정의",
		question: "3년 내 확보할 시장 크기와 성장성은?",
		must: [
			"TAM",
			"SAM",
			"SOM",
			"기준연도",
			"출처",
			"산식",
			"고객단위·단가",
			"현재 영업범위",
			"3년 확보율의 현실성"
		],
		slots: [6]
	},
	{
		no: 5,
		title: "경쟁사 분석",
		question: "비슷한 가치를 주는 대안은 무엇이며 왜 우리가 다른가?",
		must: [
			"수기/엑셀/전화 방식",
			"범용 ERP/CRM/POS",
			"직접 경쟁사",
			"유사 서비스",
			"비교표",
			"자사 차별성 3개",
			"\"경쟁사 없음\" 금지"
		],
		slots: [7]
	},
	{
		no: 6,
		title: "시장진입 및 확대",
		question: "지금 어디까지 왔고 앞으로 어떻게 고객을 확보하는가?",
		must: [
			"현재 추진경과(고객·거래처·매출·문의)",
			"향후 3년 경로",
			"채널전략"
		],
		slots: [8, 9]
	},
	{
		no: 7,
		title: "자금운용",
		question: "얼마가 필요하고 어떻게 조달·사용하는가?",
		must: [
			"자금구분(영업이익·자본금·투자·정부지원·정책금융·보증·대출)",
			"확보 완료/협의 중/계획",
			"3년 사용처",
			"Milestone 연결"
		],
		slots: [10]
	}
];
/** 실사 예상질문 기본 풀 (§46) */
var FIELD_QUESTION_POOL = [
	"이 기술을 왜 개발했습니까?",
	"기존 방식은 무엇이 문제입니까?",
	"대표님이 직접 기여한 부분은 무엇입니까?",
	"미래AI랩은 어떤 역할을 했습니까?",
	"특허의 핵심은 무엇입니까?",
	"현재 MVP 에서 실제 작동하는 기능은 무엇입니까?",
	"AI/분석 기능의 원리는 무엇입니까?",
	"현재 실제 고객이 사용하고 있습니까?",
	"경쟁사 대비 차별점은 무엇입니까?",
	"TAM/SAM/SOM 산출근거는 무엇입니까?",
	"3년 후 고객수와 매출목표의 근거는 무엇입니까?",
	"향후 기술개발 계획은 무엇입니까?",
	"개발비와 사업화 자금은 어떻게 조달합니까?",
	"회사 내부에 개발인력이 없는데 어떻게 유지합니까?",
	"특허가 등록되지 않으면 사업에 문제가 있습니까?"
];
/** 실사 금지 표현 (§49) — 증빙이 없으면 말하지 않는다 */
var FORBIDDEN_PHRASES = [
	{
		phrase: /국내\s*최초/,
		label: "국내 최초",
		why: "근거 없이는 말하지 않는다"
	},
	{
		phrase: /업계\s*최초/,
		label: "업계 최초",
		why: "근거 없이는 말하지 않는다"
	},
	{
		phrase: /유일/,
		label: "유일",
		why: "경쟁사 분석과 모순된다"
	},
	{
		phrase: /특허\s*등록\s*완료|등록특허/,
		label: "특허 등록 완료",
		why: "출원 상태면 \"출원 중\""
	},
	{
		phrase: /완전\s*자동/,
		label: "AI 완전 자동",
		why: "실제가 아니면 금지"
	},
	{
		phrase: /전국\s*확대\s*완료/,
		label: "전국 확대 완료",
		why: "계획이면 계획으로"
	},
	{
		phrase: /투자\s*유치\s*완료/,
		label: "투자유치 완료",
		why: "협의 중이면 협의 중으로"
	},
	{
		phrase: /자체\s*개발팀\s*보유/,
		label: "자체 개발팀 보유",
		why: "실제 없으면 외부 협업으로 적는다"
	}
];
function findForbiddenPhrases(text) {
	return FORBIDDEN_PHRASES.filter((f) => f.phrase.test(text)).map((f) => f.label);
}
/** 3분 Script 뼈대 (§44) */
var SCRIPT_SKELETON = [
	"0:00~0:30 회사와 현재 본업",
	"0:30~1:00 현장에서 반복적으로 겪은 핵심문제",
	"1:00~1:40 그 문제를 해결하기 위해 개발한 핵심기술과 특허(출원 중)",
	"1:40~2:20 현재 MVP 에서 실제로 동작하는 기능 시연",
	"2:20~2:40 현재 고객/시장과 TAM-SAM-SOM",
	"2:40~3:00 향후 3년 기술고도화·고객확대·매출계획"
];
var LIVING = [
	[
		"0101",
		"생활잡화",
		"분리형 헬멧"
	],
	[
		"0102",
		"스포츠레져(골프채)",
		"리브를 갖는 골프 클럽 헤드 및 관련 방법"
	],
	[
		"0103",
		"생활가구",
		"원격지 연출 시스템 및 원격지 연출 방법"
	],
	[
		"0104",
		"주거구조(시공/거푸집)",
		"벽체 거푸집용 데크 구조"
	],
	[
		"0105",
		"주거안전(호흡장치/공기정화기)",
		"이온발생장치를 포함하는 웨어러블 공기정화기"
	],
	[
		"0106",
		"주거건축(창호/블라인드)",
		"블라인드용 안전체인"
	],
	[
		"0107",
		"의류 세탁장치",
		"적층식 의류 처리장치"
	],
	[
		"0108",
		"전자담배",
		"에어로졸 생성장치"
	],
	[
		"0109",
		"저온 저장고",
		"농수산물 저온 저장고"
	]
];
var DIGITAL = [
	[
		"0201",
		"데이터제어(음성처리)",
		"업종별 음성인식 엔진 기반의 음성 데이터 처리 시스템 및 방법"
	],
	[
		"0202",
		"사물인터넷매니징(안전관리)",
		"선로 출입 통제 관리장치 및 이를 이용한 선로 출입 관리 시스템"
	],
	[
		"0203",
		"사물인터넷서비스(연결관리)",
		"통신 네트워크에서 서비스 요청 절차를 처리하는 방법 및 시스템"
	],
	[
		"0204",
		"사물인터넷단말(정보서비스)",
		"메타버스 트레이닝 서비스를 제공하기 위한 시스템"
	],
	[
		"0205",
		"합성 올리고핵산(아토피 치료)",
		"HIF-1α 및 STAT5 전사인자를 억제하는 합성 디코이 올리고핵산 및 이를 유효성분으로 함유하는 아토피 피부염의 예방 또는 치료용 약학적 조성물"
	],
	[
		"0206",
		"바이오응용",
		"크리스피 간섭을 이용한 RNA 번역 조절용 조성물"
	],
	[
		"0207",
		"생물분석, 진단",
		"천식과 COPD 구별용 바이오마커 조성물 및 이를 이용한 천식과 COPD의 구별 방법"
	],
	[
		"0208",
		"의료데이터분석",
		"이종 특성정보 병합 데이터 기반 인공지능 딥러닝 모델을 이용한 약물 적응증 및 반응 예측 시스템 및 방법"
	],
	[
		"0209",
		"의료진단",
		"아밀로이드-펫 예측 알고리즘 생성 시스템 및 방법"
	],
	[
		"0210",
		"생체측정",
		"헬스 케어 장치 및 헬스 케어 장치의 동작 방법"
	],
	[
		"0211",
		"스폿용접",
		"진동 스폿 용접장치 및 진동 스폿 용접방법"
	],
	[
		"0212",
		"수술로봇",
		"의료영상처리방법, 영상유도를 이용한 로봇수술시스템"
	],
	[
		"0213",
		"메니퓰레이터",
		"로봇용 냉각장치"
	],
	[
		"0214",
		"레이더 센서",
		"레이더 기반의 탑승자 인식 장치 및 그 방법"
	],
	[
		"0215",
		"자율주행",
		"V2V 통신 기반 자율주행 차량 협상 방법 및 장치"
	],
	[
		"0216",
		"3D프린팅",
		"출력노즐의 수직 높낮이가 조정되는 듀얼노즐이 구비된 3D프린터용 헤드"
	],
	[
		"0217",
		"디지털트윈",
		"인공 지능 기반의 연속 공정 제어 장치, 이를 이용한 품질 예측 및 수율 개선 방법"
	],
	[
		"0218",
		"스마트가공",
		"2단 작동구조를 가지는 사출 금형용 밀판 조립체"
	]
];
var ELECTRIC = [
	[
		"0301",
		"고압스위치",
		"투입저항을 갖는 초고압 차단기"
	],
	[
		"0302",
		"플라즈마 발생장치",
		"조사위치 제어가능한 금속 스크랩 정련용 플라즈마 장치 및 이를 이용한 금속 스크랩 정련방법"
	],
	[
		"0303",
		"컴퓨터입출력팀",
		"버스 조정 회로 및 그것을 구비한 데이터 전송 시스템"
	],
	[
		"0304",
		"컴퓨터응용팀",
		"빅데이터 플랫폼과 머신 러닝을 이용한 수소 충전소 고장 예지 시스템"
	],
	[
		"0305",
		"컴퓨터 보안팀",
		"스트림 데이터를 처리하는 스토리지 장치, 그것의 포함하는 컴퓨팅 시스템, 그리고 그것의 동작 방법"
	],
	[
		"0306",
		"컴퓨터 제어팀",
		"서비스 응답 블로킹 대기 상태의 트랜잭션 제어 시스템 및 방법"
	],
	[
		"0307",
		"프로토콜(액세스)",
		"CCH 모니터링 능력의 관리를 위한 클라이언트 장치 및 네트워크 액세스 노드"
	],
	[
		"0308",
		"통신(송수신)",
		"적응적 등화를 수행하는 수신 회로 및 이를 포함하는 시스템"
	],
	[
		"0309",
		"통신(신호처리)",
		"신호 처리 방법 및 기기"
	],
	[
		"0310",
		"통신(채널관리)",
		"무선 통신 시스템에서 채널 상태 정보의 송수신 방법 및 그 장치"
	],
	[
		"0311",
		"쇼핑 인터페이스",
		"아이템 정보 제공 방법 및 그 장치"
	],
	[
		"0312",
		"카드지불결제",
		"결제서비스를 위한 카드 등록 방법 및 이를 구현하는 휴대 전자장치"
	],
	[
		"0313",
		"오디오처리(음원 분류)",
		"스파이킹 신경망에서 신경 암호 기반 소리 분류 장치 및 그 방법"
	],
	[
		"0314",
		"이미지를 처리",
		"전자 장치의 지도 병합 방법"
	],
	[
		"0315",
		"이미지를 처리",
		"흐릿함 농도 평가기를 이용한 국부적 연무 제거 시스템 및 국부적 연무 제거 방법"
	],
	[
		"0316",
		"영상압축(MPEG분야)",
		"영상 코딩 시스템에서 레지듀얼 정보를 사용하는 영상 디코딩 방법 및 그 장치"
	]
];
var CHEM = [
	[
		"0401",
		"항체치료제",
		"경쇄 아밀로이드증 및 다른 CD38-양성 혈액학적 악성종양을 치료하기 위한 항-CD38 항체"
	],
	[
		"0402",
		"화장품",
		"천연 복합추출물을 유효성분으로 함유하는 화장료 조성물"
	],
	[
		"0403",
		"바이오의약(백신)",
		"수두 또는 대상포진 백신 조성물 및 이를 이용하는 방법"
	],
	[
		"0404",
		"천연물의약(천연물)",
		"상황버섯 및 단삼 혼합추출물을 유효성분으로 함유하는 색전증 예방 및 치료용 약학적 조성물"
	],
	[
		"0405",
		"착물화학(유기태양전지)",
		"유기 태양전지용 광활성층 및 이를 포함하는 유기태양전지"
	],
	[
		"0406",
		"코팅소재(다공성 실리카)",
		"바이오매스로부터 메조 다공성 실리카를 제조하는 방법"
	],
	[
		"0407",
		"접착소재(점착제)",
		"아크릴레이트계 화합물을 기반으로 하는 감압 점착제 조성물 및 이를 이용한 감압 점착제 필름의 제조 방법"
	],
	[
		"0408",
		"이차전지",
		"열전달 부재를 포함하는 파우치형 이차전지"
	],
	[
		"0409",
		"이차전지",
		"이차전지"
	],
	[
		"0410",
		"고분자(유기 광전소자)",
		"고분자 화합물 및 이를 포함하는 유기 광전소자 및 이의 제조방법"
	],
	[
		"0411",
		"고분자(자동차 내장재)",
		"열가소성 수지 조성물 및 이를 이용한 성형품"
	],
	[
		"0412",
		"수술치료기기(봉합장치)",
		"의료용 피부 봉합기"
	],
	[
		"0413",
		"정형용품(뼈접합기구)",
		"의료용 삽입 장치 및 이를 포함하는 신경감지 시스템"
	],
	[
		"0414",
		"수술치료기기(체외충격파치료기)",
		"의료용 조합 자극기"
	],
	[
		"0415",
		"배기가스처리",
		"배기가스 처리장치 및 배기가스 처리 방법"
	],
	[
		"0416",
		"수처리",
		"수 처리 장치 및 수처리 방법"
	],
	[
		"0417",
		"정수기",
		"정수기 및 정수기 제어방법"
	],
	[
		"0418",
		"식품제조(음료)",
		"기능성이 증진된 귀리 페이스트 및 이를 이용한 음료 제조방법"
	],
	[
		"0419",
		"식품제조(기능성식품)",
		"노각나무 추출물을 유효성분으로 포함하는 시력 보호용 또는 망막 질환의 개선 및 예방용 조성물"
	],
	[
		"0420",
		"신규식물(종자)",
		"리그난 함량이 증가된 신품종 참깨 밀양 74호 및 이의 이용"
	],
	[
		"0421",
		"동물(양봉)",
		"자동으로 출입구 개폐가 가능한 벌통"
	],
	[
		"0422",
		"동물(신규동물)",
		"무당질 항체 생산용 형질전환 마우스 및 이로부터 생산된 무당질 항체의 용도"
	]
];
var MECH = [
	[
		"0501",
		"광학부품(헤드업디스플레이)",
		"차량용 헤드업 디스플레이 장치"
	],
	[
		"0502",
		"광학부품(광 모듈)",
		"복수의 광원을 포함한 광 모듈"
	],
	[
		"0503",
		"기계요소(섀클)",
		"안전 샤클"
	],
	[
		"0504",
		"기계제어(포장장치)",
		"조미김 포장장치"
	],
	[
		"0505",
		"이송제어(키오스크)",
		"도어형 키오스크"
	],
	[
		"0506",
		"제어가공",
		"공작기계 제어장치 및 공작기계의 제어방법"
	],
	[
		"0507",
		"공작기계(절단)",
		"상부 커터 및 하부 커터를 포함하는 전극 시트 재단 장치 및 이를 이용한 전극 시트 재단 방법"
	],
	[
		"0508",
		"제진기",
		"힌지점을 구비한 제진기용 레이크"
	],
	[
		"0509",
		"건설기계",
		"작업 기계 및 제어 시스템"
	],
	[
		"0510",
		"내진구조",
		"내진 보강 지중 박스 구조물"
	],
	[
		"0511",
		"공기청정기",
		"팝업 토출부와 상부 토출부를 포함하는 공기 청정기"
	],
	[
		"0512",
		"도로부대시설",
		"차단봉"
	],
	[
		"0513",
		"차량섀시(시트)",
		"차량 시트 공조장치"
	],
	[
		"0514",
		"파워트레인(변속기)",
		"하이브리드 구동모듈"
	],
	[
		"0515",
		"조명장치(차량조명)",
		"차량의 외부 표시 조명장치"
	],
	[
		"0516",
		"차량공조(화물차)",
		"캠핑카용 가변침대"
	],
	[
		"0517",
		"열교환기",
		"열교환기"
	],
	[
		"0518",
		"배관 단열",
		"진동단열제 제조장치와 제조방법 및 상기 장치와 방법에 의하여 제조된 진공단열재"
	],
	[
		"0519",
		"발전장치",
		"유기 랭킨 사이클 발전시스템"
	],
	[
		"0520",
		"밸브",
		"버터플라이밸브 에어시스템"
	],
	[
		"0521",
		"조선해양시스템(구명조끼)",
		"의식이 없는 사람을 위한 구명조끼"
	],
	[
		"0522",
		"육상운송(전동킥보드)",
		"압력센서를 이용한 방향지시장치가 구비된 전동킥보드 및 그 제어방법"
	],
	[
		"0523",
		"항공우주시스템(항공기)",
		"프로펠러 탈부착 장치"
	],
	[
		"0524",
		"정밀시험",
		"누설감지수단을 통합한 제어밸브"
	],
	[
		"0525",
		"물성분석(광학분석)",
		"곡면 제품 내측 검사장치 및 곡면 제품 내측 검사방법"
	],
	[
		"0526",
		"물성분석(계측기계)",
		"이동 광원의 위치 확인이 가능한 광센서"
	],
	[
		"0527",
		"물성분석(화학바이오)",
		"연구용 전기 영동장치"
	],
	[
		"0528",
		"물성분석(측정시스템)",
		"질량 유량계"
	],
	[
		"0529",
		"전기도금",
		"레벨링제 및 이를 포함하는 전기도금 조성물"
	],
	[
		"0530",
		"적층포장재",
		"이지컷 포장재 및 이의 제조 방법"
	],
	[
		"0531",
		"철강소재",
		"무방향성 전자 강판 및 무방향성 전자 강판의 제조방법"
	],
	[
		"0532",
		"잉크젯인쇄장치",
		"액체 토출장치, 액체 토출방법, 물품의 제조방법"
	]
];
var SEMI = [
	[
		"0601",
		"반도체소자(마이크로LED)",
		"표시 장치 및 그의 제조 방법"
	],
	[
		"0602",
		"반도체제조(배선형성)",
		"수직형 광 비아 및 그 제조방법"
	],
	[
		"0603",
		"반도체제조(질화물반도체기판)",
		"그룹3족 질화물 반도체 템플릿의 제조 방법 및 이에 따라 제조된 그룹3족 질화물 반도체 템플릿"
	],
	[
		"0604",
		"반도체소자(메모리)",
		"3차원 적층 어레이 기반의 원 타임 프로그래머블 메모리와 그 제조 및 동작방법"
	],
	[
		"0605",
		"반도체소자(메모리)",
		"캐패시터를 갖는 반도체 소자 및 그 형성 방법"
	],
	[
		"0606",
		"메모리회로(메모리)",
		"스핀 주입 토크 자성메모리"
	],
	[
		"0607",
		"반도체회로(압전소자)",
		"압전 세라믹, 압전 세라믹의 제조 방법, 압전 소자 및 전자 장치"
	],
	[
		"0608",
		"헤드 장착형 유기발광 표시장치",
		"유기발광 표시장치, 그를 포함한 헤드 장착형 디스플레이, 및 그의 제조방법"
	],
	[
		"0609",
		"유기발광 디스플레이",
		"유기발광 디스플레이 장치 및 그 제조방법"
	],
	[
		"0610",
		"유기발광 디스플레이",
		"유기 발광 디스플레이 장치의 소비전력 감소를 위한 구동전압 설정 방법"
	],
	[
		"0611",
		"반도체공정소재",
		"포토레지스트 조성물, 이를 이용하는 포토리소그라피 공정 및 이를 이용하여 제조된 화소 구획 층"
	],
	[
		"0612",
		"광화학소재",
		"유기전계발광소자"
	],
	[
		"0613",
		"반도체(테스트)",
		"반도체 패키지 테스트 장치"
	],
	[
		"0614",
		"반도체(패키지)",
		"팬 아웃 패널 레벨 패키지의 제조 방법 및 그에사용되는캐리어테이프필름"
	],
	[
		"0615",
		"기판처리장치",
		"기판 처리 장치"
	],
	[
		"0616",
		"기판이송장치(용기)",
		"용기 보관 장치 및 방법"
	],
	[
		"0617",
		"반도체제조장비(기판열처리)",
		"기판 처리 장치, 기판 처리 방법 및 기억 매체."
	],
	[
		"0618",
		"반도체제조장비(기판열처리)",
		"기판 처리 장치, 반도체 장치의 제조 방법 및 히터 유닛"
	],
	[
		"0619",
		"반도체제조장비(기판이송)",
		"기판 이송용 핸드"
	],
	[
		"0620",
		"OLED소자",
		"표시패널 및 이를 포함하는 표시장치"
	],
	[
		"0621",
		"OLED장치",
		"표시장치"
	]
];
function rows(category, list) {
	return list.map(([code, field, title]) => ({
		code,
		category,
		field,
		title
	}));
}
var KIPO_REFERENCES = [
	...rows("living", LIVING),
	...rows("digital", DIGITAL),
	...rows("electric", ELECTRIC),
	...rows("chem", CHEM),
	...rows("mech", MECH),
	...rows("semi", SEMI)
];
function kipoPdfUrl(code) {
	return `https://www.patent.go.kr/smart/jsp/kiponet/common/AllRouteDown.do?fn=example/${code.slice(0, 2)}/${code}&fh=pdf`;
}
function kipoByCode(code) {
	return KIPO_REFERENCES.find((r) => r.code === code) ?? null;
}
/** 코드·분야·명칭에서 낱말 검색 (공백으로 나눈 낱말 전부 포함) */
function searchKipo(query, category = "all") {
	const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
	return KIPO_REFERENCES.filter((r) => {
		if (category !== "all" && r.category !== category) return false;
		if (words.length === 0) return true;
		const hay = `${r.code} ${r.field} ${r.title}`.toLowerCase();
		return words.every((w) => hay.includes(w));
	});
}
/** 선정 규칙: 2~5종, 중복 없음 */
function kipoSelectionIssues(sel) {
	const issues = [];
	const codes = sel.map((s) => s.code);
	if (new Set(codes).size !== codes.length) issues.push("같은 사례가 두 번 들어 있습니다.");
	if (sel.length < 2) issues.push(`참고자료는 최소 2종을 고릅니다 (지금 ${sel.length}종).`);
	if (sel.length > 5) issues.push(`참고자료는 최대 5종입니다 (지금 ${sel.length}종).`);
	const noReason = sel.filter((s) => s.reason.trim() === "").length;
	if (noReason > 0) issues.push(`선정 이유가 없는 사례 ${noReason}종 — 기술분야·발명형태·처리구조·청구항/도면 중 무엇을 참고하는지 적습니다.`);
	const noPdf = sel.filter((s) => !s.pdfAttached).length;
	if (sel.length > 0 && noPdf > 0) issues.push(`PDF 를 아직 받지 않은 사례 ${noPdf}종 — 받기 전에는 세부 문구를 추측해 명세서에 쓰지 않습니다.`);
	return issues;
}
function daysBetween(aIso, bIso) {
	const a = new Date(aIso.slice(0, 10)).getTime();
	const b = new Date(bIso.slice(0, 10)).getTime();
	return Math.floor((b - a) / 864e5);
}
function freshnessOk(p, scope, today) {
	return p.freshness.some((f) => f.scope === scope && daysBetween(f.checkedAt, today) <= 30);
}
function gateCheckedCount(p) {
	return GATE_ITEMS.filter((g) => p.gate.items[g.key] === true).length;
}
function evidenceIssues(evidence) {
	const bySlot = /* @__PURE__ */ new Map();
	for (const e of evidence) bySlot.set(e.slot, [...bySlot.get(e.slot) ?? [], e]);
	return {
		emptySlots: EVIDENCE_SLOTS.map((s) => s.slot).filter((s) => (bySlot.get(s) ?? []).length === 0),
		noSource: evidence.filter((e) => e.claim.trim() !== "" && e.source.trim() === "").length,
		notReady: evidence.filter((e) => !e.ready).length
	};
}
function redFlagsRemaining(p) {
	return RED_FLAGS.filter((f) => p.venture.redFlagsCleared[f.no] !== true).map((f) => f.no);
}
/**
* 단계 완료 가능 여부.
* artifacts / evidence 는 프로젝트 것만 넘긴다.
*/
function canCompleteStage(p, key, ctx) {
	const def = stageDef(key);
	const blockers = [];
	const notes = [];
	const missing = missingFacts(p.factsheet, def.requiredFacts);
	if (missing.length > 0) blockers.push(`사실표에 비어 있는 항목: ${missing.map((k) => factDef(k).label).join(", ")}`);
	const have = new Set(ctx.artifacts.filter((a) => a.projectId === p.id && a.status !== "superseded").map((a) => a.type));
	const lackArtifacts = def.requiredArtifacts.filter((t) => !have.has(t));
	if (lackArtifacts.length > 0) blockers.push(`아직 없는 산출물: ${lackArtifacts.length}종 (${lackArtifacts.join(", ")})`);
	if (key === "S1") {
		if (p.gate.decision === null) blockers.push("GO / HOLD / NO-GO 를 아직 정하지 않았습니다.");
		else if (p.gate.reason.trim() === "") blockers.push("결정 이유를 적어 주세요.");
		if (p.gate.decision === "no_go") notes.push("NO-GO 입니다. 억지로 다음 단계로 가지 않습니다.");
		if (p.gate.decision === "hold") notes.push("HOLD 는 탈락이 아닙니다 — 약한 항목을 보강하고 GO 로 바꿉니다.");
	}
	if (key === "S5") for (const issue of kipoSelectionIssues(p.kipo)) blockers.push(issue);
	if (key === "S7") {
		if (p.patent.filingStatus === "none") blockers.push("출원 상태가 \"미출원\" 입니다.");
		if (p.patent.applicationNumber.trim() === "" || p.patent.filedAt.trim() === "") blockers.push("출원번호와 출원일을 기록해 주세요.");
		if (!freshnessOk(p, "patent_filing", ctx.today)) blockers.push(`출원 직전 최신 공식 기준(특허로) 확인 기록이 30일 안에 없습니다 (Master K9).`);
	}
	const idx = Number(key.slice(1));
	if (idx >= 8 && idx <= 13) {
		const p0 = coreThreadWarnings(p).filter((w) => w.severity === "p0");
		for (const w of p0) blockers.push(w.message);
		if (key === "S8") {
			if (p.mvp.live.trim() === "" || p.mvp.future.trim() === "") blockers.push("LIVE / FUTURE 를 구분해 적어 주세요 (DEMO 는 없으면 비워 둡니다).");
			if (p.mvp.axMode === "") blockers.push("AX 기능 방식(rule / scoring / ml / llm / demo …)을 골라 주세요 — AI 라 부를 수 있는지의 근거입니다.");
			if (p.mvp.notBuilding.trim() === "") notes.push("\"안 만들 것\" 이 비어 있습니다. 범위가 커지는 것을 막는 칸입니다.");
		}
	}
	if (key === "S12") {
		const ev = evidenceIssues(ctx.evidence.filter((e) => e.projectId === p.id));
		if (ev.emptySlots.length > 0) blockers.push(`비어 있는 첨부 슬롯: ${ev.emptySlots.join(", ")}`);
		if (ev.noSource > 0) blockers.push(`출처가 없는 주장 ${ev.noSource}건 — 증빙을 붙이거나 표현을 약하게 하거나 향후계획으로 옮기거나 지웁니다 (Master §36-1).`);
		if (ev.notReady > 0) notes.push(`아직 준비 안 된 첨부 ${ev.notReady}건`);
	}
	if (key === "S13") {
		const remaining = redFlagsRemaining(p);
		if (remaining.length > 0) blockers.push(`P0 Red Flag 미확인 ${remaining.length}개 (#${remaining.join(", #")}) — 하나라도 남으면 완료 선언을 하지 않습니다.`);
		if (judgeTotal(p.venture.judgeScores) === null) blockers.push("Judge 10항목 점수를 아직 다 매기지 않았습니다.");
		const p1 = coreThreadWarnings(p).filter((w) => w.severity === "p1");
		if (p1.length > 0) notes.push(`핵심 줄기 P1 경고 ${p1.length}건이 남아 있습니다.`);
	}
	if (key === "S14") {
		if (!freshnessOk(p, "venture_application", ctx.today)) blockers.push(`신청 직전 최신 공식 기준(벤처확인종합관리시스템) 확인 기록이 30일 안에 없습니다 (Master K9).`);
		if (p.venture.submittedAt.trim() === "") blockers.push("신청일을 기록해 주세요.");
		const docsMissing = Object.values(p.venture.documents).filter((v) => !v).length;
		if (docsMissing > 0) notes.push(`기본 제출서류 미확인 ${docsMissing}종`);
	}
	if (key === "S15") {
		if (p.fieldReview.qa.length < 10) blockers.push(`예상질문이 ${p.fieldReview.qa.length}개입니다 — 10~15개를 준비합니다.`);
		if (p.fieldReview.numbersToMemorize.length < 8) notes.push(`대표가 외울 숫자 ${p.fieldReview.numbersToMemorize.length}개 — 8~12개가 적당합니다.`);
		if (!p.fieldReview.mockReviewDone) blockers.push("실사 전 Mock Review 를 1회 하고 표시해 주세요.");
	}
	return {
		ok: blockers.length === 0,
		blockers,
		notes
	};
}
/** 건너뛰기 가능 여부 */
function canSkipStage(key, reason) {
	const def = stageDef(key);
	if (!def.skippable) return {
		ok: false,
		blockers: [`${def.label} 단계는 건너뛸 수 없습니다.`],
		notes: []
	};
	if (reason.trim().length < 4) return {
		ok: false,
		blockers: ["건너뛰는 이유를 적어 주세요 (예: 이미 등록된 특허 보유)."],
		notes: []
	};
	return {
		ok: true,
		blockers: [],
		notes: []
	};
}
//#endregion
//#region src/domain/consulting/artifactDefinitions.ts
var ARTIFACT_DEFS = [
	{
		type: "PATENT_IDEA",
		label: "특허 아이디어 설계",
		stage: "S3",
		fromPrompt: "PATENT_IDEA"
	},
	{
		type: "PRIOR_ART_REVIEW",
		label: "선행기술 검토",
		stage: "S4",
		fromPrompt: "PRIOR_ART_REVIEW"
	},
	{
		type: "KIPO_REFERENCE_SET",
		label: "KIPO 참고자료 세트",
		stage: "S5",
		fromPrompt: null
	},
	{
		type: "PATENT_SPEC_DRAFT",
		label: "명세서 초안",
		stage: "S6",
		fromPrompt: "PATENT_SPEC_DRAFT"
	},
	{
		type: "PATENT_CLAIMS",
		label: "청구항 검토",
		stage: "S6",
		fromPrompt: "PATENT_CLAIMS_REVIEW"
	},
	{
		type: "PATENT_FILING_RECORD",
		label: "출원 기록",
		stage: "S7",
		fromPrompt: null
	},
	{
		type: "MVP_SPEC",
		label: "MVP_SPEC (전략 잠금)",
		stage: "S8",
		fromPrompt: "MVP_STRATEGY"
	},
	{
		type: "MVP_BUILD_PROMPT",
		label: "MVP 빌드 프롬프트",
		stage: "S9",
		fromPrompt: "MVP_CLAUDE_CODE_BUILD"
	},
	{
		type: "MVP_STATE",
		label: "MVP_STATE / QA",
		stage: "S9",
		fromPrompt: null
	},
	{
		type: "VENTURE_FACTSHEET_SNAPSHOT",
		label: "사실표 스냅샷",
		stage: "S10",
		fromPrompt: null
	},
	{
		type: "VENTURE_PLAN_SECTION",
		label: "사업계획서 항목",
		stage: "S11",
		fromPrompt: "VENTURE_PLAN_SECTION"
	},
	{
		type: "VENTURE_PLAN_FULL",
		label: "사업계획서 전체 검토",
		stage: "S11",
		fromPrompt: "VENTURE_FULL_REVIEW"
	},
	{
		type: "CLAIM_EVIDENCE_MATRIX",
		label: "Claim–Evidence Matrix",
		stage: "S12",
		fromPrompt: "EVIDENCE_REVIEW"
	},
	{
		type: "INFOGRAPHIC_BRIEF",
		label: "인포그래픽 기획",
		stage: "S12",
		fromPrompt: "INFOGRAPHIC_BRIEF"
	},
	{
		type: "QA_REPORT",
		label: "Final QA 보고",
		stage: "S13",
		fromPrompt: "VENTURE_FULL_REVIEW"
	},
	{
		type: "SUBMISSION_RECORD",
		label: "신청 기록",
		stage: "S14",
		fromPrompt: null
	},
	{
		type: "FIELD_REVIEW_SCRIPT",
		label: "대표자 3분 Script",
		stage: "S15",
		fromPrompt: "FIELD_REVIEW_SCRIPT"
	},
	{
		type: "FIELD_REVIEW_QA",
		label: "실사 예상 Q&A",
		stage: "S15",
		fromPrompt: "FIELD_REVIEW_QA"
	},
	{
		type: "RESULT_RECORD",
		label: "결과 기록",
		stage: "S16",
		fromPrompt: null
	},
	{
		type: "GENERAL_REVIEW",
		label: "프로젝트 검토",
		stage: "S0",
		fromPrompt: "GENERAL_PROJECT_REVIEW"
	},
	{
		type: "NOTE",
		label: "메모",
		stage: "S0",
		fromPrompt: null
	}
];
var BY_TYPE = new Map(ARTIFACT_DEFS.map((d) => [d.type, d]));
function isArtifactType(v) {
	return typeof v === "string" && BY_TYPE.has(v);
}
/** 프롬프트 종류 → 결과가 저장될 산출물 종류 */
function artifactTypeForPrompt(p) {
	const hit = ARTIFACT_DEFS.find((d) => d.fromPrompt === p);
	return hit ? hit.type : "GENERAL_REVIEW";
}
//#endregion
//#region src/domain/consulting/nextActionResolver.ts
var MAX = 3;
function resolveNextActions(p, ctx) {
	const out = [];
	const push = (a) => {
		if (out.length < MAX && !out.some((x) => x.kind === a.kind && x.focus === a.focus && x.stageKey === a.stageKey)) out.push(a);
	};
	const cur = p.currentStage;
	const def = stageDef(cur);
	if (p.status === "done" || p.status === "archived") return out;
	for (const k of blockedStages(p)) push({
		kind: "resolve_block",
		stageKey: k,
		tab: "stages",
		focus: k,
		title: `${stageDef(k).label} 막힘 풀기`,
		why: p.stages[k].blockedBy.trim() !== "" ? `막힌 이유: ${p.stages[k].blockedBy.trim()}` : "막힘으로 표시된 단계가 있습니다."
	});
	if (p.gate.decision === null && Number(cur.slice(1)) >= 1) push({
		kind: "answer_gate",
		stageKey: "S1",
		tab: "stages",
		focus: "S1",
		title: "GO / HOLD / NO-GO 정하기",
		why: "판정 없이 특허·MVP 를 시작하면 되돌아오는 비용이 큽니다 (Master §4)."
	});
	const missing = missingFacts(p.factsheet, def.requiredFacts);
	for (const k of missing.slice(0, 2)) push({
		kind: "fill_fact",
		stageKey: cur,
		tab: "factsheet",
		focus: k,
		title: `사실표 · ${factDef(k).label} 채우기`,
		why: `${def.label} 단계를 끝내려면 필요한 사실입니다.`
	});
	if (Number(cur.slice(1)) >= 2) {
		const firstEmpty = CORE_THREAD_KEYS.slice(0, 3).find((k) => p.coreThread[k].trim() === "");
		if (firstEmpty) push({
			kind: "fill_thread",
			stageKey: cur,
			tab: "thread",
			focus: firstEmpty,
			title: `핵심 줄기 · ${CORE_THREAD_LABEL[firstEmpty]} 적기`,
			why: "특허·MVP·사업계획서가 같은 기술을 말하게 하는 한 줄입니다 (Master §35)."
		});
	}
	const mine = ctx.artifacts.filter((a) => a.projectId === p.id && a.status !== "superseded");
	const myPrompts = ctx.prompts.filter((x) => x.projectId === p.id);
	for (const type of def.requiredArtifacts) {
		if (mine.some((a) => a.type === type)) continue;
		const promptType = def.promptTypes.find((pt) => artifactTypeForPrompt(pt) === type) ?? null;
		if (promptType === null) push({
			kind: "import_result",
			stageKey: cur,
			tab: "artifacts",
			focus: type,
			title: `${labelOf(type)} 기록하기`,
			why: "이 단계의 산출물입니다. 직접 적어 저장합니다."
		});
		else if (myPrompts.some((x) => x.type === promptType)) push({
			kind: "import_result",
			stageKey: cur,
			tab: "prompts",
			focus: promptType,
			title: `${labelOf(type)} 결과 들여오기`,
			why: "프롬프트는 만들었는데 결과가 아직 없습니다. 붙여 넣어 저장합니다."
		});
		else push({
			kind: "generate_prompt",
			stageKey: cur,
			tab: "prompts",
			focus: promptType,
			title: `${labelOf(type)} 프롬프트 만들기`,
			why: "이 단계의 산출물을 만들 프롬프트 꾸러미입니다. 복사해 나가서 결과를 가져옵니다."
		});
	}
	if (cur === "S5") {
		if (p.kipo.length < 2) push({
			kind: "select_reference",
			stageKey: cur,
			tab: "patent",
			focus: "kipo",
			title: "KIPO 참고자료 2~5종 고르기",
			why: "명세서 구조·표현을 참고할 사례입니다. 선행기술 조사와는 다릅니다 (Master §11)."
		});
		else if (p.kipo.some((s) => !s.pdfAttached)) push({
			kind: "attach_pdf",
			stageKey: cur,
			tab: "patent",
			focus: "kipo",
			title: "참고자료 PDF 받기",
			why: "PDF 를 받기 전에는 세부 문구를 추측해 쓰지 않습니다."
		});
	}
	if (cur === "S7" && !freshnessOk(p, "patent_filing", ctx.today)) push({
		kind: "check_policy",
		stageKey: cur,
		tab: "patent",
		focus: "freshness",
		title: "특허로 최신 기준 확인 기록",
		why: "출원 직전 공식 기준이 이 Master 보다 우선합니다 (K9)."
	});
	if (cur === "S14" && !freshnessOk(p, "venture_application", ctx.today)) push({
		kind: "check_policy",
		stageKey: cur,
		tab: "venture",
		focus: "freshness",
		title: "벤처확인시스템 최신 기준 확인 기록",
		why: "글자수·첨부수·용량·발급일이 바뀔 수 있습니다 (K9)."
	});
	if (cur === "S15") {
		if (p.fieldReview.qa.length < 10) push({
			kind: "field_review",
			stageKey: cur,
			tab: "review",
			focus: "qa",
			title: "예상질문 10~15개 만들기",
			why: "실사 전 세트: Script · Demo · Q&A · Evidence Pack · 숫자 · 금지표현 · Mock (Master §43)."
		});
		if (!p.fieldReview.mockReviewDone) push({
			kind: "field_review",
			stageKey: cur,
			tab: "review",
			focus: "mock",
			title: "Mock Review 1회",
			why: "실사 전에 한 번은 남이 물어봐야 합니다."
		});
	}
	if (cur === "S16") push({
		kind: "record_result",
		stageKey: cur,
		tab: "review",
		focus: "result",
		title: "결과 기록",
		why: "결과와 후속(본개발·자금)을 남깁니다."
	});
	if (out.length < MAX) {
		const gate = canCompleteStage(p, cur, ctx);
		if (gate.ok) push({
			kind: "complete_stage",
			stageKey: cur,
			tab: "stages",
			focus: cur,
			title: `${def.label} 완료로 넘기기`,
			why: "필요한 사실·산출물이 갖춰졌습니다. exit checklist 를 확인하고 넘깁니다."
		});
		else if (out.length === 0) push({
			kind: "complete_stage",
			stageKey: cur,
			tab: "stages",
			focus: cur,
			title: `${def.label} 완료 조건 채우기`,
			why: gate.blockers[0]
		});
	}
	if (out.length < MAX) {
		const w = coreThreadWarnings(p).find((x) => x.severity !== "info");
		if (w) push({
			kind: "fill_thread",
			stageKey: cur,
			tab: w.tab,
			focus: w.focus,
			title: "핵심 줄기 경고 해결",
			why: w.message
		});
	}
	return out;
}
function labelOf(type) {
	return type.replace(/_/g, " ");
}
/** 단계 자동 이동 — 완료 후 다음 미완료 단계 */
function nextOpenStage(p, from) {
	const order = Object.keys(p.stages);
	const i = order.indexOf(from);
	for (let j = i + 1; j < order.length; j += 1) {
		const s = p.stages[order[j]].status;
		if (s !== "completed" && s !== "skipped") return order[j];
	}
	return from;
}
//#endregion
//#region src/domain/consulting/resultImport.ts
var HEADER = /^\s*\[ARTIFACT\]\s*(.*)$/m;
function parsePastedResult(text) {
	const m = HEADER.exec(text);
	if (!m) return {
		type: null,
		stage: null,
		title: firstHeading(text),
		body: text.trim(),
		hadHeader: false
	};
	const attrs = m[1];
	const type = /type\s*=\s*([A-Z_]+)/.exec(attrs)?.[1] ?? null;
	const stage = /stage\s*=\s*(S\d{1,2})/.exec(attrs)?.[1] ?? null;
	const title = /title\s*=\s*"([^"]*)"|title\s*=\s*([^\s].*)$/.exec(attrs);
	const body = text.replace(HEADER, "").trim();
	return {
		type: isArtifactType(type) ? type : null,
		stage: isStageKey(stage) ? stage : null,
		title: (title?.[1] ?? title?.[2] ?? "").trim() || firstHeading(body),
		body,
		hadHeader: true
	};
}
/** 첫 마크다운 제목 또는 첫 줄 60자 */
function firstHeading(text) {
	const h = /^\s*#{1,3}\s+(.+)$/m.exec(text);
	if (h) return h[1].trim().slice(0, 80);
	return (text.split("\n").map((l) => l.trim()).find((l) => l !== "") ?? "").slice(0, 60);
}
/** 결과 머리줄 — 프롬프트가 요구하는 형식 그대로 */
function artifactHeaderLine(type, stage, title) {
	return `[ARTIFACT] type=${type} stage=${stage} title="${title.replace(/"/g, "'")}"`;
}
//#endregion
//#region src/domain/consulting/privacyFilter.ts
var RULES = [
	{
		kind: "rrn",
		re: /\b\d{6}\s*-\s*[1-8]\d{6}\b/g,
		label: "주민번호"
	},
	{
		kind: "account",
		re: /(계좌(?:번호)?\s*[:：]?\s*)([0-9][0-9-]{8,20}[0-9])/g,
		label: "계좌번호"
	},
	{
		kind: "account",
		re: /((?:국민|신한|우리|하나|농협|기업|카카오|토스|새마을|우체국|SC|씨티)\s*(?:은행)?\s*)([0-9][0-9-]{8,20}[0-9])/g,
		label: "계좌번호"
	},
	{
		kind: "password",
		re: /((?:비밀번호|비번|패스워드|암호|인증서\s*(?:비밀번호|비번)|password|passwd|pwd|pw)\s*[:：=]?\s*)(\S+)/gi,
		label: "비밀번호"
	},
	{
		kind: "secret",
		re: /\b(sk-[A-Za-z0-9_-]{8,}|sb_secret_[A-Za-z0-9_-]+|sb_publishable_[A-Za-z0-9_-]+|AKIA[0-9A-Z]{12,}|ghp_[A-Za-z0-9]{20,}|xox[abp]-[A-Za-z0-9-]{10,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,})\b/g,
		label: "API키"
	},
	{
		kind: "secret",
		re: /((?:api[_ -]?key|secret|token|service_role)\s*[:：=]\s*)(\S+)/gi,
		label: "API키"
	},
	{
		kind: "email",
		re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
		label: "이메일"
	},
	{
		kind: "phone",
		re: /\b01[016789]\s*-?\s*\d{3,4}\s*-?\s*\d{4}\b/g,
		label: "휴대폰"
	}
];
function emptyPrivacyReport() {
	return {
		rrn: 0,
		account: 0,
		password: 0,
		secret: 0,
		email: 0,
		phone: 0,
		total: 0
	};
}
/** 텍스트에서 민감 값을 가리고 개수를 센다 */
/**
* 법인등록번호(6-7자리)는 주민등록번호와 모양이 같다. "법인(등록)번호" 라벨이 앞에 붙은 것은
* 회사 공개 정보이므로 잠시 하이픈을 바꿔 두었다가 필터가 끝난 뒤 되돌린다.
*/
var CORP_LABELLED = /(법인\s*(?:등록)?\s*(?:번호)?\s*[:：]?\s*)(\d{6})-(\d{7})/g;
var KEEP = "⁠";
function redactSensitive(text) {
	const report = emptyPrivacyReport();
	let out = text.replace(CORP_LABELLED, (_m, label, a, b) => `${label}${a}${KEEP}${b}`);
	for (const rule of RULES) out = out.replace(rule.re, (...args) => {
		report[rule.kind] += 1;
		report.total += 1;
		const groups = args.slice(1, -2).filter((g) => typeof g === "string");
		if (groups.length >= 2) return `${groups[0]}[가림:${rule.label}]`;
		return `[가림:${rule.label}]`;
	});
	return {
		text: out.split(KEEP).join("-"),
		report
	};
}
function mergeReports(a, b) {
	return {
		rrn: a.rrn + b.rrn,
		account: a.account + b.account,
		password: a.password + b.password,
		secret: a.secret + b.secret,
		email: a.email + b.email,
		phone: a.phone + b.phone,
		total: a.total + b.total
	};
}
//#endregion
//#region src/domain/consulting/promptPackageBuilder.ts
var PROMPT_TYPE_LABEL = {
	PATENT_IDEA: "특허 아이디어 설계",
	PRIOR_ART_REVIEW: "선행기술 검토",
	PATENT_SPEC_DRAFT: "명세서 초안",
	PATENT_CLAIMS_REVIEW: "청구항 검토",
	MVP_STRATEGY: "MVP 전략 잠금",
	MVP_CLAUDE_CODE_BUILD: "MVP 빌드 (Claude Code)",
	VENTURE_PLAN_SECTION: "사업계획서 항목",
	VENTURE_FULL_REVIEW: "사업계획서 전체 검토",
	EVIDENCE_REVIEW: "Claim–Evidence 검토",
	INFOGRAPHIC_BRIEF: "인포그래픽 기획",
	FIELD_REVIEW_SCRIPT: "실사 3분 Script",
	FIELD_REVIEW_QA: "실사 예상 Q&A",
	GENERAL_PROJECT_REVIEW: "프로젝트 전체 검토"
};
var PROMPT_TYPES = Object.keys(PROMPT_TYPE_LABEL);
/** 종류별 기본 단계 */
var PROMPT_DEFAULT_STAGE = {
	PATENT_IDEA: "S3",
	PRIOR_ART_REVIEW: "S4",
	PATENT_SPEC_DRAFT: "S6",
	PATENT_CLAIMS_REVIEW: "S6",
	MVP_STRATEGY: "S8",
	MVP_CLAUDE_CODE_BUILD: "S9",
	VENTURE_PLAN_SECTION: "S11",
	VENTURE_FULL_REVIEW: "S11",
	EVIDENCE_REVIEW: "S12",
	INFOGRAPHIC_BRIEF: "S12",
	FIELD_REVIEW_SCRIPT: "S15",
	FIELD_REVIEW_QA: "S15",
	GENERAL_PROJECT_REVIEW: "S0"
};
var GLOBAL_RULES = [
	"사실 / LIVE / DEMO / FUTURE / 계획을 섞지 않는다. 모르는 값은 지어내지 말고 \"확인 필요\" 로 남긴다.",
	"특허·MVP·사업계획서·증빙·실사 답변은 같은 핵심기술(아래 핵심 줄기)을 설명해야 한다.",
	"등록되지 않은 특허는 \"특허출원 중\" 으로만 쓴다. 출원번호 ≠ 등록번호.",
	"실제 LLM/ML 이 아닌 규칙·점수·계산 로직을 \"AI\" 라고 부르지 않는다.",
	"근거 없는 숫자(고객수·매출·전환율·점유율)를 만들지 않는다. 시장 숫자에는 기준연도·출처·산식을 붙인다.",
	"대표자가 하지 않은 기술적 발명을 한 것처럼, 없는 자체 개발팀이 있는 것처럼 쓰지 않는다."
];
function factsFor(project, keys) {
	const text = factsheetToText(project.factsheet, keys ? { onlyKeys: keys } : {});
	return text === "" ? "(사실표가 비어 있습니다 — 알려진 것이 없으면 확인 필요로 표시하세요)" : text;
}
function threadBlock(project) {
	const t = coreThreadToText(project);
	return t === "" ? "(핵심 줄기가 아직 비어 있습니다)" : t;
}
function header(project, type, stage) {
	const def = stageDef(stage);
	return [
		`# ${PROMPT_TYPE_LABEL[type]} — ${project.clientName}${project.title ? ` · ${project.title}` : ""}`,
		"",
		"당신은 미래AI랩의 특허·AX/플랫폼 MVP·벤처기업확인(혁신성장유형) 통합 컨설팅 워크플로를 돕는 전문가다.",
		`현재 단계: ${stage} ${def.code} (${def.label}) — 이 단계의 목적: ${def.purpose}`,
		"이 프롬프트는 사람이 복사해 넣은 것이고, 결과도 사람이 검토해 시스템에 붙여 넣는다."
	].join("\n");
}
function globalBlock() {
	return ["## 항상 지킬 것", ...GLOBAL_RULES.map((r) => `- ${r}`)].join("\n");
}
function outputBlock(type, stage, title, sections) {
	return [
		"## 출력 형식",
		`결과의 첫 줄은 정확히 다음 한 줄로 시작한다:`,
		artifactHeaderLine(artifactTypeForPrompt(type), stage, title),
		"그 아래는 마크다운으로, 다음 순서의 제목을 쓴다:",
		...sections.map((s, i) => `${i + 1}. ${s}`),
		"마지막에 \"## 확인 필요\" 절을 두고, 지어내지 않고 남겨 둔 항목을 적는다."
	].join("\n");
}
function targetWrap(target, prompt) {
	switch (target) {
		case "claude_code": return [
			"[이 프롬프트는 Claude Code 세션에 붙여 넣는다. 저장소를 바꾸기 전에 아래 지시를 먼저 읽는다.]",
			"",
			prompt,
			"",
			"작업 규칙: 실제 결제·SMS·복잡한 권한·Production 인프라를 자동으로 추가하지 않는다. 404·Dead CTA·Placeholder 0. 390/430 실측 후 보고한다."
		].join("\n");
		case "chatgpt": return `${prompt}\n\n(답변은 한국어로, 표는 마크다운 표로.)`;
		case "claude": return `${prompt}\n\n(답변은 한국어로. 확실하지 않은 사실은 추측하지 말고 "확인 필요" 로 남겨라.)`;
		default: return prompt;
	}
}
function bodyFor(input) {
	const p = input.project;
	switch (input.type) {
		case "PATENT_IDEA": return {
			title: "특허 아이디어 설계",
			rules: [
				"5개 고정 질문으로 정리한다: ① 현재 문제 ② 기존 방식 ③ 차별 구조 ④ 처리 흐름(입력→데이터 정리→판단/분석/추천/최적화→출력→직원/고객 Action→결과 재반영) ⑤ 권리화 포인트(경쟁사가 가장 쉽게 베낄 구조·처리순서·연결관계).",
				"특허명은 마케팅 문구가 아니라 기술구조가 읽혀야 한다: [대상/데이터] 기반 [핵심 판단·처리] 및 [실행·결과] 시스템/방법/장치.",
				"단순 UI 설명으로 끝내지 않는다. 데이터 저장·정규화 → 판단(Rule/Scoring/Optimization/AI) → 위험도·추천·우선순위 → Action → 실행결과 기록 → 재반영 구조를 쓴다.",
				"발명자는 \"구체적인 기술적 사상의 창작에 실제로 기여했는가\" 로 판단한다. 대표자의 문제 인식·요구사항 정의는 중요한 사업적 기여이지만 자동으로 발명자가 되는 것은 아니다. 사실대로 확인할 항목으로 남긴다.",
				"고객에게 발명설명서·도면파일을 새로 요구하지 않는다. 회사에 이미 있는 자료(업무흐름·사진·엑셀·카톡·오류 사례)만 전제로 한다."
			],
			task: [
				"위 5개 질문에 답하고, 특허 제목 후보 3개를 낸다.",
				"권리화 포인트는 청구항이 될 만한 문장 3개로도 적는다.",
				"발명자·출원인 확인 질문 3개를 만든다."
			],
			sections: [
				"① 현재 문제",
				"② 기존 방식",
				"③ 차별 구조",
				"④ 처리 흐름",
				"⑤ 권리화 포인트",
				"특허 제목 후보 3개",
				"발명자·출원인 확인 질문"
			],
			facts: [
				"companyName",
				"industry",
				"mainProducts",
				"coreProblem",
				"currentMethod",
				"coreTech",
				"implemented",
				"customers",
				"customerSegments"
			]
		};
		case "PRIOR_ART_REVIEW": return {
			title: "선행기술 검토 설계",
			rules: [
				"KIPRIS 선행기술 조사는 신규성·진보성·중복 가능성 검토다. KIPO 명세서 작성 예시와는 역할이 다르다.",
				"최소 확인: 핵심 키워드 / 동일·유사 목적 특허 / 동일·유사 구성요소 / 동일·유사 처리순서 / 유사 청구항 구조 / 고객사 기존 출원과의 중복.",
				"목적은 \"완전히 같은 것이 없다\" 가 아니다. 무엇을 빼고, 좁히고, 추가하고, 어떤 결합관계·처리순서를 강조해야 차별화 논리가 서는지 찾는 것이다.",
				"실제 검색 결과를 아는 척하지 않는다. 검색 키워드 세트와 \"이런 결과가 나오면 이렇게 좁힌다\" 는 판단 규칙을 만든다."
			],
			task: [
				"KIPRIS 검색 키워드 세트(한국어·영어, 동의어 포함) 3묶음.",
				"유사할 가능성이 높은 선행기술 유형 5개와 각각에 대한 차별화 방향.",
				"청구항을 좁힐 후보 요소·강조할 결합관계."
			],
			sections: [
				"검색 키워드 세트",
				"예상 유사 선행기술 유형과 차별화 방향",
				"청구항 좁히기/강조 후보",
				"사람이 KIPRIS 에서 확인할 체크리스트"
			],
			facts: [
				"coreProblem",
				"currentMethod",
				"coreTech",
				"patent"
			]
		};
		case "PATENT_SPEC_DRAFT": {
			const refs = p.kipo.map((s) => kipoByCode(s.code)).filter(Boolean).map((r) => `- ${r.code} ${r.title} (${r.field})`);
			return {
				title: "명세서 초안",
				rules: [
					"명세서 목차: 발명의 명칭 / 기술분야 / 배경기술 / 선행기술문헌 / 발명의 내용(해결하려는 과제·과제 해결 수단·발명의 효과) / 도면의 간단한 설명 / 발명을 실시하기 위한 구체적인 내용 / 부호의 설명 / 청구범위 / 요약서 / 도면.",
					"참고 사례(KIPO 예시)는 목차·문장구조·청구항 형식·도면·요약서 표현만 참고한다. 예시 문장을 그대로 복제하거나 예시의 발명 구성을 이 회사 기술인 것처럼 쓰지 않는다.",
					"첨부된 PDF 가 없는 사례의 세부 문구를 추측해 반영하지 않는다.",
					"도면은 필요한 것만: 시스템 구성도 / 데이터 흐름도 / 핵심 처리순서 / 사용자↔서버↔DB / 분석·추천·제어 흐름 / 결과→실행→피드백. UI 캡처 수십 장보다 발명의 논리가 보이는 도면.",
					"요약서 QA: 기술적 과제·해결수단·효과 명확, 용어 통일, 대표도·인용부호 일치, 마케팅 표현 제거, 400자 이내(출원 직전 실제 서식 글자수 재확인).",
					"\"등록\" 이라 쓰지 않는다. 출원 단계다.",
					...refs.length > 0 ? ["선정된 참고 사례:", ...refs] : ["참고 사례가 아직 선정되지 않았다 — 구조만 제안하고 사례 문구는 쓰지 않는다."]
				],
				task: [
					"위 목차 순서대로 초안을 쓴다. 청구항은 독립항 1 + 종속항 3~6.",
					"도면 목록과 각 도면에 들어갈 부호를 제안한다.",
					"요약서를 400자 이내로 쓴다."
				],
				sections: [
					"발명의 명칭",
					"기술분야",
					"배경기술",
					"발명의 내용",
					"도면의 간단한 설명",
					"구체적인 내용",
					"청구범위",
					"요약서(400자 이내)",
					"도면 목록"
				],
				facts: [
					"companyName",
					"representative",
					"headOffice",
					"coreProblem",
					"currentMethod",
					"coreTech",
					"implemented",
					"axCore",
					"platformUsers"
				]
			};
		}
		case "PATENT_CLAIMS_REVIEW": return {
			title: "청구항 검토",
			rules: [
				"청구항은 권리화 포인트(경쟁사가 베끼기 쉬운 구조·처리순서·연결관계)를 보호해야 한다.",
				"독립항은 넓게, 종속항으로 좁힌다. 각 항이 명세서 본문에서 뒷받침되는지 본다.",
				"용어가 명세서·요약서·도면 부호와 일치하는지 본다.",
				"고가치·복잡한 권리범위·거절 가능성이 높은 경우 변리사 검토를 별도 Gate 로 권한다 — 그 판단 근거를 적는다."
			],
			task: [
				"맥락의 청구항을 항별로 검토한다: 뒷받침 여부 / 명확성 / 너무 넓거나 좁은지 / 용어 일치.",
				"수정 제안을 항별로 낸다.",
				"변리사 검토가 필요한지와 이유."
			],
			sections: [
				"항별 검토표",
				"수정 제안",
				"용어 일치 점검",
				"변리사 검토 필요 여부"
			],
			facts: ["coreTech"]
		};
		case "MVP_STRATEGY": return {
			title: "MVP 전략 잠금 (MVP_SPEC)",
			rules: [
				"Less Scope, Same Polish. 범위는 줄여도 완성도는 낮추지 않는다.",
				"벤처용 최소 구성: AX/관리 대시보드 1 + 고객/거래처/현장용 Platform Surface 1 + Primary Proof Journey 1 + 실제 작동하는 AX 핵심기능 1(최대 2) + Future Preview 총 6~10 + PC/Mobile + 3분 Demo.",
				"Primary Journey 는 특허 핵심기술과 같아야 한다. 핵심가설 문장: \"[대상 고객]이 [기존 문제] 때문에 겪는 불편을 [핵심 기능/방식]으로 해결하면 [핵심 행동/전환]을 만들 수 있다.\"",
				"AX 기능 방식을 정한다(Rule/Scoring/Optimization/예측/추천/RAG/LLM/Demo Logic). 실제 AI 가 아니면 AI 라 부르지 않는다. 결과 아래에 \"왜 이 결과인지\" 근거 2~3개.",
				"LIVE / DEMO / FUTURE 를 구분한다. Future 기능은 Modal/Drawer 로 설명만 하고 빈 페이지·404 를 만들지 않는다.",
				"상한: Journey 1(최대 2), Wow 1(최대 2), Tier A 3~5, Tier B 3~5, 실제 Route 8~12, Mini Admin 0~1, 실제 외부 API 0~1. NOT PRODUCTION: 결제·SMS·OAuth 전체·다중권한·Multi-tenant·정산·Native 는 기본 제외.",
				"Demo Data 는 업종에 맞고 서로 일관되며 실적처럼 위장하지 않는다. 실제 값이 있으면 실제 값을 쓴다."
			],
			task: ["MVP_SPEC 을 채운다: PRODUCT / ONE-LINE VALUE / TARGET USER / CORE PROBLEM / PRIMARY HYPOTHESIS / PRIMARY CTA / PRIMARY PROOF JOURNEY / AX CORE FEATURE(방식 포함) / PLATFORM SURFACE / WOW / COMPLETION STATE / BUSINESS MODEL / LIVE / DEMO / FUTURE 6~10 / TIER A·B / NOT BUILDING / DEMO DATA ASSUMPTION / REFERENCE STYLE / DEFAULT THEME / JUDGE FAST PATH."],
			sections: [
				"MVP_SPEC",
				"핵심가설 문장",
				"Primary Journey (단계별)",
				"AX 핵심기능과 방식·근거 표시",
				"Platform Surface",
				"LIVE / DEMO / FUTURE",
				"Not Building",
				"3분 Demo 동선"
			],
			facts: [
				"companyName",
				"industry",
				"mainProducts",
				"coreProblem",
				"currentMethod",
				"coreTech",
				"implemented",
				"inDevelopment",
				"futureDev",
				"customers",
				"customerSegments",
				"platformUsers",
				"axCore"
			]
		};
		case "MVP_CLAUDE_CODE_BUILD": return {
			title: "MVP 빌드 지시 (Claude Code)",
			rules: [
				"[필수 시작 지시 — RAPID HIGH-FIDELITY MVP v1.1] 이 프로젝트는 미래AI랩 Rapid High-Fidelity MVP System 을 Source of Truth 로 쓴다. 목표는 Production 이 아니라 사업가설 1개를 클릭 가능한 고품질 제품 경험으로 증명하는 것이다.",
				"Hard Blocker 가 없으면 한 번의 실행에서 Strategy 확인 → Build → Desktop/Mobile Render QA → Primary Journey 클릭 QA → Polish → Judge/Devil → P0/P1 수정 → Re-test 까지 간다. \"우선 구현했습니다, 다음에 고도화\" 금지.",
				"Tier A 화면은 첫 Build 부터 Premium: 강한 Hero, 큰 Typography(본문 17~19px)·낮은 Text Density, Pure White #FFFFFF Surface, Sidebar Color Icon, Premium Motion(Hover 160~220ms, Modal 220~320ms, 숫자 450~700ms), Hover/Pressed/Focus.",
				"실제 Route 8~12, 404 0, Placeholder 0, Dead CTA 0. Future Preview 는 Sheet/Modal 로. Journey Completion: 시작→선택 유지→검증→확인→완료화면→다음 행동→My/History 재진입.",
				"Mobile P0: 390/430 실측. 상단 잘림·Bottom CTA 가림·Drawer 닫기 불가·Overlay 잔존·Keyboard 가림·Journey 중단·404·Back 불가 하나라도 있으면 완료 금지.",
				"AI 는 핵심가설일 때만 실제 API. 아니면 신뢰도 높은 Demo Logic + 근거 2~3개 표시. \"AI 분석 중\" 애니메이션만 있고 논리가 없으면 실패.",
				"완료 시 MVP_SPEC.md / MVP_STATE.md / QA_REPORT.md(Score·P0·P1·Journey·Mobile·Future·Known Limitation) 를 남기고 URL 을 보고한다.",
				`MVP_SPEC (아래 맥락 문서에 있음)을 먼저 읽고 그대로 구현한다. 특허 핵심기술 = "${p.coreThread.coreTech || p.factsheet.coreTech?.value || "(핵심 줄기 참조)"}".`
			],
			task: ["맥락의 MVP_SPEC 을 구현한다. 새 기능을 추가하기 전에 \"이 기능이 없으면 심사 결과가 실제로 나빠지는가?\" 를 묻고, NO 면 NEXT 로 보낸다."],
			sections: [
				"구현 요약",
				"Route Map (Tier A/B/C)",
				"Primary Journey 클릭 QA 결과",
				"Mobile 390/430 결과",
				"LIVE/DEMO/FUTURE 표시 위치",
				"QA_REPORT 요약",
				"Known Limitation"
			],
			facts: [
				"companyName",
				"industry",
				"mainProducts",
				"coreTech",
				"axCore",
				"platformUsers",
				"mvpUrl"
			]
		};
		case "VENTURE_PLAN_SECTION": {
			const sec = PLAN_SECTIONS.find((s) => s.no === (input.section ?? 1)) ?? PLAN_SECTIONS[0];
			return {
				title: `사업계획서 ${sec.no}. ${sec.title}`,
				rules: [
					`핵심 질문: ${sec.question}`,
					`반드시 포함: ${sec.must.join(" / ")}`,
					`이 항목의 첨부 슬롯: ${sec.slots.join(", ")} — 1,000자 서술은 논리와 주장, 첨부는 그 주장을 눈으로 이해시키는 증거.`,
					"숫자마다 기준연도·출처·산식. 사실표의 상태(확정/미확인/계획/시연용/향후)를 그대로 존중하고, 시연용·미확인 값을 실적으로 쓰지 않는다.",
					"특허·MVP 와 같은 기술명을 쓴다(핵심 줄기). 현재 / 개발 중 / 향후를 구분한다.",
					sec.no === 5 ? "\"경쟁사가 없다\" 고 쓰지 않는다. 수기/엑셀/전화 방식, 범용 ERP/CRM/POS, 직접 경쟁사, 유사 서비스를 비교한다." : "",
					sec.no === 4 ? "TAM(전체 잠재) → SAM(실제 접근 가능) → SOM(3년 내 현실적 확보). 시장규모만 크게 쓰지 않는다. 현재 거래처 기반 SOM 논리." : "",
					sec.no === 7 ? "자금은 확보 완료 / 신청·협의 중 / 향후 계획으로 구분. 사용처는 개발인력·시스템·장비·인증/특허·마케팅·영업·시설·운영자금. 기술·사업 Milestone 과 연결." : "",
					"외부개발 사실을 숨기지 않는다. 권장 구조: \"대표자와 신청기업이 현장문제·핵심 요구사항·적용방향·사업화 목표를 정의하고, 외부 전문개발 파트너와 협업하여 MVP 를 구현·검증…\"."
				].filter(Boolean),
				task: [
					`${sec.no}. ${sec.title} 본문을 1,000자 내외로 쓴다.`,
					"본문에서 주장한 것마다 어떤 첨부(슬롯)로 증명할지 표로 만든다.",
					"사실표에 없어서 지어낼 뻔한 값은 \"확인 필요\" 로 남긴다."
				],
				sections: [
					"본문(1,000자 내외)",
					"주장–증빙 표",
					"첨부 슬롯 제안",
					"확인 필요"
				]
			};
		}
		case "VENTURE_FULL_REVIEW": return {
			title: "사업계획서 전체 검토 (Judge / Devil)",
			rules: [
				"심사위원이 이해해야 할 8개: 실제 문제 / 왜 대표자가 잘 아는가 / 기존 방식과 무엇이 다른가 / 무엇을 실제로 만들었는가 / 특허와 MVP 가 같은 기술인가 / 누가 돈을 내는가 / 3년 성장 / 왜 이 회사가 실행할 수 있는가.",
				"Devil 질문: ERP/CRM 기능 아닌가 / 실제 AI 어디 있나 / 특허와 MVP 관계 / 경쟁사가 바로 만들 수 있지 않나 / 대표가 직접 뭘 했나 / 외주가 다 만든 것 아닌가 / TAM 만 크고 고객 없지 않나 / SOM 근거 / 숫자 실제인가 Demo 인가 / 자금과 매출 연결.",
				`P0 Red Flag 12개: ${RED_FLAGS.map((f) => `#${f.no} ${f.text}`).join(" / ")}`,
				"Judge Scorecard 10축(각 10점): A Problem Reality / B Team Fit / C Technical Differentiation / D Patent↔MVP Consistency / E MVP Proof / F TAM·SAM·SOM Credibility / G Competitive Advantage / H Market Entry·Growth / I Funding Logic / J Evidence·Integrity. 점수는 근거와 함께.",
				"P0 가 하나라도 남으면 점수와 무관하게 Final 이 아니다."
			],
			task: [
				"맥락의 사업계획서·사실표·핵심 줄기를 읽고 P0 12개를 하나씩 판정한다(있음/없음/근거).",
				"Devil 질문 10개에 대한 현재 답변 가능성과 보강 방향.",
				"Judge 10축 점수(근거 포함)와 총평."
			],
			sections: [
				"P0 Red Flag 판정표",
				"Devil 질문별 취약점",
				"Judge Scorecard",
				"수정 우선순위 (P0 → P1)",
				"확인 필요"
			]
		};
		case "EVIDENCE_REVIEW": {
			const ev = (input.evidence ?? []).filter((e) => e.projectId === p.id);
			return {
				title: "Claim–Evidence Matrix 검토",
				rules: [
					"핵심 주장마다 상태(LIVE/DEMO/FUTURE/시장/목표) · 특허 연결 · MVP 연결 · 객관증빙 · 들어갈 항목/첨부 슬롯을 표로 만든다.",
					"핵심 주장인데 증빙이 비어 있으면: 증빙 확보 / 표현 약화 / 향후계획으로 이동 / 삭제 중 하나를 고른다.",
					"10개 첨부 슬롯: 기본 1장, 중요한 곳만 2장. 총 10~14장. 내용 없는 장수를 늘리지 않는다.",
					"좋은 장: 제목만 봐도 핵심 이해 / 숫자에 출처 / 현재·향후 구분 / MVP 실제 화면 / 특허와 같은 기술명. 나쁜 장: 텍스트 과다 / 문장 복붙 / 향후를 현재처럼 / TAM·SOM 혼동 / 근거 없는 점유율.",
					"현재 슬롯 상태:",
					...EVIDENCE_SLOTS.map((s) => {
						const items = ev.filter((e) => e.slot === s.slot);
						return `- 슬롯 ${s.slot} ${s.where} (${s.direction}, ${s.pages}): ${items.length === 0 ? "비어 있음" : items.map((e) => `[${e.claimStatus}] ${e.claim || e.title}${e.source ? ` ← ${e.source}` : " (출처 없음)"}`).join(" | ")}`;
					})
				],
				task: [
					"Claim–Evidence Matrix 를 완성한다(주장/상태/특허/MVP/증빙/슬롯).",
					"비어 있거나 출처 없는 슬롯마다 처리 방향(확보·약화·이동·삭제)을 정한다.",
					"슬롯별 장수 계획(총 10~14장)."
				],
				sections: [
					"Claim–Evidence Matrix",
					"슬롯별 처리 방향",
					"장수 계획",
					"확인 필요"
				]
			};
		}
		case "INFOGRAPHIC_BRIEF": {
			const s = EVIDENCE_SLOTS.find((x) => x.slot === (input.slot ?? 1)) ?? EVIDENCE_SLOTS[0];
			return {
				title: `인포그래픽 기획 — 슬롯 ${s.slot} ${s.where}`,
				rules: [
					`이 슬롯의 기본 첨부 방향: ${s.direction} (${s.pages}).`,
					"각 장에는 메시지 하나만. 제목만 봐도 핵심이 이해되어야 한다. 디자인보다 메시지가 먼저.",
					"숫자가 있으면 출처·기준연도. 현재와 향후를 시각적으로 구분한다(색·라벨). MVP 는 실제 화면을 쓴다. 특허와 같은 기술명.",
					"사업계획서 문장을 그대로 이미지에 복붙하지 않는다. 향후 기능을 현재처럼 그리지 않는다. TAM 과 SOM 을 혼동하지 않는다.",
					"개인정보(실명·연락처·계좌)가 화면에 노출되지 않게 한다."
				],
				task: ["이 슬롯에 넣을 1장(필요하면 2장)의 기획서를 쓴다: 제목 / 한 줄 메시지 / 구성 요소(도형·표·화면 캡처) / 숫자와 출처 / 현재·향후 구분 표시 / 금지 사항 확인.", "디자이너 또는 이미지 도구에 넘길 수 있는 제작 지시문을 붙인다."],
				sections: [
					"장 제목과 한 줄 메시지",
					"구성 요소",
					"숫자와 출처",
					"현재/향후 구분",
					"제작 지시문",
					"확인 필요"
				]
			};
		}
		case "FIELD_REVIEW_SCRIPT": return {
			title: "대표자 3분 설명 Script + MVP Demo 동선",
			rules: [
				`3분 구조: ${SCRIPT_SKELETON.join(" → ")}`,
				"대표자의 실제 말투와 업종에 맞게 쓴다. 대표자가 직접 하지 않은 기술적 발명을 한 것처럼 말하지 않는다.",
				"MVP 3분 Demo: 문제 → 대시보드 → 핵심 입력 → AX 분석/판단 → 결과 → Action → 고객/거래처 Surface → Future Preview. 모든 메뉴를 보여주지 않는다.",
				`금지 표현(증빙 없으면): ${FORBIDDEN_PHRASES.map((f) => f.label).join(" / ")}`,
				"대표가 외울 숫자는 8~12개만(설립일·최근 매출·직원수·거래처수·특허 출원번호/출원일·TAM·SAM·SOM·3년 목표·필요자금). 사실표의 확정 값만 쓴다."
			],
			task: [
				"3분 Script 를 구간별 시간과 함께 쓴다.",
				"Demo 동선을 클릭 순서로 쓴다.",
				"외울 숫자 목록(사실표 값 그대로, 없으면 \"확인 필요\").",
				"이 회사에서 특히 조심할 표현 5개."
			],
			sections: [
				"3분 Script",
				"MVP Demo 동선",
				"외울 숫자",
				"조심할 표현",
				"확인 필요"
			]
		};
		case "FIELD_REVIEW_QA": return {
			title: "실사 예상 질문 10~15 + 답변 Key Point",
			rules: [
				`기본 질문 풀: ${FIELD_QUESTION_POOL.join(" / ")}`,
				"회사에 맞게 질문을 바꾸고, 답변 Key Point 는 사실표·핵심 줄기와 어긋나지 않게 쓴다.",
				"\"누가 무엇을 했습니까?\" 에 일관되게 답한다: 대표자/신청기업(현장문제·요구사항·피드백·사업화·현장 적용) vs 외부 파트너(문제 구조화·기술 구체화·설계·구현·문서화). 실제 기여대로.",
				"출원 상태면 \"출원 중\". 실제 AI 가 아니면 AI 라 하지 않는다. Demo 숫자를 실적처럼 말하지 않는다.",
				"반드시 준비할 증빙 체크리스트(회사·대표자·기술·개발·사업·시장)를 함께 낸다."
			],
			task: [
				"예상 질문 12개(회사 맞춤)와 답변 Key Point.",
				"가장 위험한 질문 3개와 대응.",
				"증빙 체크리스트.",
				"Mock Review 진행 순서(30분)."
			],
			sections: [
				"예상 질문과 Key Point",
				"위험 질문 3개",
				"증빙 체크리스트",
				"Mock Review 순서",
				"확인 필요"
			]
		};
		default: return {
			title: "프로젝트 전체 검토 · 다음 행동",
			rules: [
				"새 대화에서는 전체 파일을 요약부터 하지 않는다: 상태 → 현재 단계 → 그 단계 규칙 → 필요한 QA → 다음 행동 순.",
				"이미 아는 회사 정보를 다시 묻지 않는다. 현재 단계에 필요한 정보만 최소 묶음으로 요청한다. 다음 단계까지 2~3개만 예고한다.",
				"형식: 현재 단계 / 완료된 것 / 지금 할 것 / 필요한 자료 / 그 다음 단계.",
				"One Core Thread(현장문제→특허→MVP→사업계획서→증빙→실사)가 끊긴 곳이 있으면 먼저 지적한다."
			],
			task: [
				"맥락을 읽고 위 형식으로 답한다.",
				"핵심 줄기가 끊긴 곳과 사실표에서 위험한 값(미확인·시연용이 실적처럼 쓰일 위험)을 짚는다.",
				"다음 행동 3개를 이유와 함께."
			],
			sections: [
				"현재 단계",
				"완료된 것",
				"지금 할 것",
				"필요한 자료",
				"그 다음 단계",
				"핵심 줄기 점검",
				"확인 필요"
			]
		};
	}
}
function buildPromptPackage(input) {
	const p = input.project;
	const stage = PROMPT_DEFAULT_STAGE[input.type];
	const body = bodyFor(input);
	const promptRaw = [
		header(p, input.type, stage),
		"",
		globalBlock(),
		"",
		"## 이 단계의 규칙",
		...body.rules.map((r) => `- ${r}`),
		"",
		"## 회사 사실 (사실표 발췌 — 괄호 안은 값의 상태·기준일·출처)",
		factsFor(p, body.facts),
		"",
		"## 핵심 줄기 (One Core Thread)",
		threadBlock(p),
		"",
		"## 해야 할 일",
		...body.task.map((t, i) => `${i + 1}. ${t}`),
		"",
		outputBlock(input.type, stage, body.title, body.sections),
		"",
		"첨부한 \"Context\" 문서에 사실표 전체·워크스페이스 내용·최근 산출물이 있다. 본문과 다르면 Context 의 최신 값을 따르되, 서로 다른 값을 발견하면 \"확인 필요\" 에 적는다."
	].join("\n");
	const contextRaw = buildContext(p, input);
	const a = redactSensitive(targetWrap(input.target, promptRaw));
	const b = redactSensitive(contextRaw);
	return {
		title: body.title,
		stageKey: stage,
		prompt: a.text,
		context: b.text,
		privacy: mergeReports(a.report, b.report),
		section: input.section ?? null
	};
}
/** Context 문서 — 사실표 전체 + 작업공간 + 최근 산출물 (필터 전) */
function buildContext(p, input) {
	const lines = [];
	lines.push(`# CONTEXT — ${p.clientName}${p.title ? ` · ${p.title}` : ""}`);
	lines.push(`현재 단계: ${p.currentStage} · 게이트: ${p.gate.decision ?? "미결"}`);
	lines.push("");
	lines.push("## 사실표 (VENTURE FACTSHEET)");
	lines.push(factsheetToText(p.factsheet) || "(비어 있음)");
	lines.push("");
	lines.push("## 핵심 줄기");
	lines.push(coreThreadToText(p) || "(비어 있음)");
	lines.push("");
	const patentLines = [
		["현재 문제", p.patent.problem],
		["기존 방식", p.patent.existingMethod],
		["차별 구조", p.patent.differentStructure],
		["처리 흐름", p.patent.processFlow],
		["권리화 포인트", p.patent.claimPoint],
		["제목 후보", p.patent.titleCandidates],
		["선행기술 키워드", p.patent.priorArtKeywords],
		["선행기술 검토", p.patent.priorArtFindings],
		["발명자", p.patent.inventors],
		["출원인", p.patent.applicant],
		["권리귀속 메모", p.patent.rightsNote],
		["출원 상태", p.patent.filingStatus === "none" ? "미출원" : p.patent.filingStatus === "filed" ? `출원 중 (${p.patent.applicationNumber} · ${p.patent.filedAt})` : "등록"]
	].filter(([, v]) => v.trim() !== "");
	if (patentLines.length > 0) {
		lines.push("## 특허 작업공간");
		for (const [k, v] of patentLines) lines.push(`${k}: ${v.trim()}`);
		lines.push("");
	}
	const mvpLines = Object.entries({
		PRODUCT: p.mvp.productName,
		"ONE-LINE VALUE": p.mvp.oneLineValue,
		"TARGET USER": p.mvp.targetUser,
		"PRIMARY JOURNEY": p.mvp.primaryJourney,
		"AX CORE FEATURE": p.mvp.axCoreFeature,
		"AX MODE": p.mvp.axMode,
		"PLATFORM SURFACE": p.mvp.platformSurface,
		LIVE: p.mvp.live,
		DEMO: p.mvp.demo,
		FUTURE: p.mvp.future,
		"NOT BUILDING": p.mvp.notBuilding,
		"DEMO DATA ASSUMPTION": p.mvp.demoDataAssumption,
		URL: p.mvp.mvpUrl,
		"REFERENCE STYLE": p.mvp.referenceStyle
	}).filter(([, v]) => v.trim() !== "");
	if (mvpLines.length > 0) {
		lines.push("## MVP_SPEC (작업공간)");
		for (const [k, v] of mvpLines) lines.push(`${k}: ${v.trim()}`);
		lines.push("");
	}
	const secLines = PLAN_SECTIONS.filter((s) => p.venture.sections[s.no].outline.trim() !== "");
	if (secLines.length > 0) {
		lines.push("## 사업계획서 항목 요지");
		for (const s of secLines) lines.push(`${s.no}. ${s.title}: ${p.venture.sections[s.no].outline.trim()}`);
		lines.push("");
	}
	const arts = (input.artifacts ?? []).filter((a) => a.projectId === p.id && a.status !== "superseded");
	const latest = /* @__PURE__ */ new Map();
	for (const a of arts) {
		const cur = latest.get(a.type);
		if (!cur || cur.version < a.version) latest.set(a.type, a);
	}
	const picked = [...latest.values()].sort((x, y) => y.updatedAt.localeCompare(x.updatedAt)).slice(0, 6);
	if (picked.length > 0) {
		lines.push("## 최근 산출물 (종류별 최신)");
		for (const a of picked) {
			lines.push(`### ${a.title} (${a.type} v${a.version} · ${a.stageKey})`);
			lines.push(a.content.length > 4e3 ? `${a.content.slice(0, 4e3)}\n…(이하 생략)` : a.content);
			lines.push("");
		}
	}
	return lines.join("\n").trim();
}
//#endregion
//#region src/lib/appClock.ts
/**
* 앱 공용 시계 — "오늘 하루 보지 않기" 등 날짜 경계 판단을 한곳에 모은다.
*
* 규칙:
*  - 스누즈/일일 노출은 로컬 "날짜"(YYYY-MM-DD) 기준으로 판단한다(+24시간이 아님).
*  - 테스트에서 시각을 주입할 수 있도록 override 를 둔다(도메인 계산과 무관, UI 안내용).
*/
var nowOverride = null;
/** 현재 시각 (테스트 주입 가능) */
function nowDate() {
	return nowOverride ? nowOverride() : /* @__PURE__ */ new Date();
}
/** ISO 문자열 (저장용) */
function nowIso() {
	return nowDate().toISOString();
}
//#endregion
//#region src/storage/localStore.ts
/**
* localStorage 접근을 한곳에 모은 저장 계층.
* UI 컴포넌트는 이 모듈을 직접 사용하지 않고 Repository를 통해 접근한다.
*/
var KEY_PREFIX = "axmvp";
/**
* 데이터 저장 네임스페이스. 스키마 버전과 분리되어 있으며, 절대 바꾸지 않는다.
* (키 이름을 바꾸면 기존 localStorage 데이터가 고아가 되어 손실된다.)
*/
var DATA_NS = "v1";
`${KEY_PREFIX}`;
`${KEY_PREFIX}${DATA_NS}`, `${KEY_PREFIX}${DATA_NS}`, `${KEY_PREFIX}${DATA_NS}`, `${KEY_PREFIX}${DATA_NS}`, `${KEY_PREFIX}${DATA_NS}`, `${KEY_PREFIX}${DATA_NS}`, `${KEY_PREFIX}${DATA_NS}`, `${KEY_PREFIX}${DATA_NS}`, `${KEY_PREFIX}${DATA_NS}`, `${KEY_PREFIX}${DATA_NS}`, `${KEY_PREFIX}${DATA_NS}`, `${KEY_PREFIX}${DATA_NS}`, `${KEY_PREFIX}${DATA_NS}`, `${KEY_PREFIX}${DATA_NS}`, `${KEY_PREFIX}${DATA_NS}`, `${KEY_PREFIX}${DATA_NS}`, `${KEY_PREFIX}${DATA_NS}`, `${KEY_PREFIX}${DATA_NS}`, `${KEY_PREFIX}${DATA_NS}`, `${KEY_PREFIX}${DATA_NS}`, `${KEY_PREFIX}${DATA_NS}`, `${KEY_PREFIX}${DATA_NS}`, `${KEY_PREFIX}${DATA_NS}`, `${KEY_PREFIX}${DATA_NS}`, `${KEY_PREFIX}${DATA_NS}`, `${KEY_PREFIX}${DATA_NS}`, `${KEY_PREFIX}${DATA_NS}`, `${KEY_PREFIX}${DATA_NS}`, `${KEY_PREFIX}${DATA_NS}`, `${KEY_PREFIX}${DATA_NS}`, `${KEY_PREFIX}${DATA_NS}`, `${KEY_PREFIX}${DATA_NS}`, `${KEY_PREFIX}${DATA_NS}`, `${KEY_PREFIX}${DATA_NS}`, `${KEY_PREFIX}`, `${KEY_PREFIX}${DATA_NS}`, `${KEY_PREFIX}${DATA_NS}`, `${KEY_PREFIX}${DATA_NS}`, `${KEY_PREFIX}${DATA_NS}`, `${KEY_PREFIX}${DATA_NS}`, `${KEY_PREFIX}${DATA_NS}`, `${KEY_PREFIX}${DATA_NS}`, `${KEY_PREFIX}${DATA_NS}`, `${KEY_PREFIX}${DATA_NS}`, `${KEY_PREFIX}${DATA_NS}`, `${KEY_PREFIX}${DATA_NS}`, `${KEY_PREFIX}${DATA_NS}`;
`${KEY_PREFIX}`;
function isStorageAvailable() {
	try {
		const probe = `${KEY_PREFIX}.__probe__`;
		window.localStorage.setItem(probe, "1");
		window.localStorage.removeItem(probe);
		return true;
	} catch {
		return false;
	}
}
typeof window !== "undefined" && isStorageAvailable();
/** crypto.randomUUID 우선, 미지원 환경에서는 안전한 대체 ID */
function generateId() {
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
	return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
//#endregion
//#region src/services/consultingStudioService.ts
/** 같은 type 의 다음 버전 번호 */
function nextVersion(existing, projectId, type) {
	const vs = existing.filter((a) => a.projectId === projectId && a.type === type).map((a) => a.version);
	return vs.length === 0 ? 1 : Math.max(...vs) + 1;
}
//#endregion
//#region node_modules/react/cjs/react.production.js
/**
* @license React
* react.production.js
*
* Copyright (c) Meta Platforms, Inc. and affiliates.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/
var require_react_production = /* @__PURE__ */ __commonJSMin(((exports) => {
	var REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element");
	var REACT_PORTAL_TYPE = Symbol.for("react.portal");
	var REACT_FRAGMENT_TYPE = Symbol.for("react.fragment");
	var REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode");
	var REACT_PROFILER_TYPE = Symbol.for("react.profiler");
	var REACT_CONSUMER_TYPE = Symbol.for("react.consumer");
	var REACT_CONTEXT_TYPE = Symbol.for("react.context");
	var REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref");
	var REACT_SUSPENSE_TYPE = Symbol.for("react.suspense");
	var REACT_MEMO_TYPE = Symbol.for("react.memo");
	var REACT_LAZY_TYPE = Symbol.for("react.lazy");
	var REACT_ACTIVITY_TYPE = Symbol.for("react.activity");
	var MAYBE_ITERATOR_SYMBOL = Symbol.iterator;
	function getIteratorFn(maybeIterable) {
		if (null === maybeIterable || "object" !== typeof maybeIterable) return null;
		maybeIterable = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable["@@iterator"];
		return "function" === typeof maybeIterable ? maybeIterable : null;
	}
	var ReactNoopUpdateQueue = {
		isMounted: function() {
			return !1;
		},
		enqueueForceUpdate: function() {},
		enqueueReplaceState: function() {},
		enqueueSetState: function() {}
	};
	var assign = Object.assign;
	var emptyObject = {};
	function Component(props, context, updater) {
		this.props = props;
		this.context = context;
		this.refs = emptyObject;
		this.updater = updater || ReactNoopUpdateQueue;
	}
	Component.prototype.isReactComponent = {};
	Component.prototype.setState = function(partialState, callback) {
		if ("object" !== typeof partialState && "function" !== typeof partialState && null != partialState) throw Error("takes an object of state variables to update or a function which returns an object of state variables.");
		this.updater.enqueueSetState(this, partialState, callback, "setState");
	};
	Component.prototype.forceUpdate = function(callback) {
		this.updater.enqueueForceUpdate(this, callback, "forceUpdate");
	};
	function ComponentDummy() {}
	ComponentDummy.prototype = Component.prototype;
	function PureComponent(props, context, updater) {
		this.props = props;
		this.context = context;
		this.refs = emptyObject;
		this.updater = updater || ReactNoopUpdateQueue;
	}
	var pureComponentPrototype = PureComponent.prototype = new ComponentDummy();
	pureComponentPrototype.constructor = PureComponent;
	assign(pureComponentPrototype, Component.prototype);
	pureComponentPrototype.isPureReactComponent = !0;
	var isArrayImpl = Array.isArray;
	function noop() {}
	var ReactSharedInternals = {
		H: null,
		A: null,
		T: null,
		S: null
	};
	var hasOwnProperty = Object.prototype.hasOwnProperty;
	function ReactElement(type, key, props) {
		var refProp = props.ref;
		return {
			$$typeof: REACT_ELEMENT_TYPE,
			type,
			key,
			ref: void 0 !== refProp ? refProp : null,
			props
		};
	}
	function cloneAndReplaceKey(oldElement, newKey) {
		return ReactElement(oldElement.type, newKey, oldElement.props);
	}
	function isValidElement(object) {
		return "object" === typeof object && null !== object && object.$$typeof === REACT_ELEMENT_TYPE;
	}
	function escape(key) {
		var escaperLookup = {
			"=": "=0",
			":": "=2"
		};
		return "$" + key.replace(/[=:]/g, function(match) {
			return escaperLookup[match];
		});
	}
	var userProvidedKeyEscapeRegex = /\/+/g;
	function getElementKey(element, index) {
		return "object" === typeof element && null !== element && null != element.key ? escape("" + element.key) : index.toString(36);
	}
	function resolveThenable(thenable) {
		switch (thenable.status) {
			case "fulfilled": return thenable.value;
			case "rejected": throw thenable.reason;
			default: switch ("string" === typeof thenable.status ? thenable.then(noop, noop) : (thenable.status = "pending", thenable.then(function(fulfilledValue) {
				"pending" === thenable.status && (thenable.status = "fulfilled", thenable.value = fulfilledValue);
			}, function(error) {
				"pending" === thenable.status && (thenable.status = "rejected", thenable.reason = error);
			})), thenable.status) {
				case "fulfilled": return thenable.value;
				case "rejected": throw thenable.reason;
			}
		}
		throw thenable;
	}
	function mapIntoArray(children, array, escapedPrefix, nameSoFar, callback) {
		var type = typeof children;
		if ("undefined" === type || "boolean" === type) children = null;
		var invokeCallback = !1;
		if (null === children) invokeCallback = !0;
		else switch (type) {
			case "bigint":
			case "string":
			case "number":
				invokeCallback = !0;
				break;
			case "object": switch (children.$$typeof) {
				case REACT_ELEMENT_TYPE:
				case REACT_PORTAL_TYPE:
					invokeCallback = !0;
					break;
				case REACT_LAZY_TYPE: return invokeCallback = children._init, mapIntoArray(invokeCallback(children._payload), array, escapedPrefix, nameSoFar, callback);
			}
		}
		if (invokeCallback) return callback = callback(children), invokeCallback = "" === nameSoFar ? "." + getElementKey(children, 0) : nameSoFar, isArrayImpl(callback) ? (escapedPrefix = "", null != invokeCallback && (escapedPrefix = invokeCallback.replace(userProvidedKeyEscapeRegex, "$&/") + "/"), mapIntoArray(callback, array, escapedPrefix, "", function(c) {
			return c;
		})) : null != callback && (isValidElement(callback) && (callback = cloneAndReplaceKey(callback, escapedPrefix + (null == callback.key || children && children.key === callback.key ? "" : ("" + callback.key).replace(userProvidedKeyEscapeRegex, "$&/") + "/") + invokeCallback)), array.push(callback)), 1;
		invokeCallback = 0;
		var nextNamePrefix = "" === nameSoFar ? "." : nameSoFar + ":";
		if (isArrayImpl(children)) for (var i = 0; i < children.length; i++) nameSoFar = children[i], type = nextNamePrefix + getElementKey(nameSoFar, i), invokeCallback += mapIntoArray(nameSoFar, array, escapedPrefix, type, callback);
		else if (i = getIteratorFn(children), "function" === typeof i) for (children = i.call(children), i = 0; !(nameSoFar = children.next()).done;) nameSoFar = nameSoFar.value, type = nextNamePrefix + getElementKey(nameSoFar, i++), invokeCallback += mapIntoArray(nameSoFar, array, escapedPrefix, type, callback);
		else if ("object" === type) {
			if ("function" === typeof children.then) return mapIntoArray(resolveThenable(children), array, escapedPrefix, nameSoFar, callback);
			array = String(children);
			throw Error("Objects are not valid as a React child (found: " + ("[object Object]" === array ? "object with keys {" + Object.keys(children).join(", ") + "}" : array) + "). If you meant to render a collection of children, use an array instead.");
		}
		return invokeCallback;
	}
	function mapChildren(children, func, context) {
		if (null == children) return children;
		var result = [], count = 0;
		mapIntoArray(children, result, "", "", function(child) {
			return func.call(context, child, count++);
		});
		return result;
	}
	function lazyInitializer(payload) {
		if (-1 === payload._status) {
			var ctor = payload._result;
			ctor = ctor();
			ctor.then(function(moduleObject) {
				if (0 === payload._status || -1 === payload._status) payload._status = 1, payload._result = moduleObject;
			}, function(error) {
				if (0 === payload._status || -1 === payload._status) payload._status = 2, payload._result = error;
			});
			-1 === payload._status && (payload._status = 0, payload._result = ctor);
		}
		if (1 === payload._status) return payload._result.default;
		throw payload._result;
	}
	var reportGlobalError = "function" === typeof reportError ? reportError : function(error) {
		if ("object" === typeof window && "function" === typeof window.ErrorEvent) {
			var event = new window.ErrorEvent("error", {
				bubbles: !0,
				cancelable: !0,
				message: "object" === typeof error && null !== error && "string" === typeof error.message ? String(error.message) : String(error),
				error
			});
			if (!window.dispatchEvent(event)) return;
		} else if ("object" === typeof process && "function" === typeof process.emit) {
			process.emit("uncaughtException", error);
			return;
		}
		console.error(error);
	};
	var Children = {
		map: mapChildren,
		forEach: function(children, forEachFunc, forEachContext) {
			mapChildren(children, function() {
				forEachFunc.apply(this, arguments);
			}, forEachContext);
		},
		count: function(children) {
			var n = 0;
			mapChildren(children, function() {
				n++;
			});
			return n;
		},
		toArray: function(children) {
			return mapChildren(children, function(child) {
				return child;
			}) || [];
		},
		only: function(children) {
			if (!isValidElement(children)) throw Error("React.Children.only expected to receive a single React element child.");
			return children;
		}
	};
	exports.Activity = REACT_ACTIVITY_TYPE;
	exports.Children = Children;
	exports.Component = Component;
	exports.Fragment = REACT_FRAGMENT_TYPE;
	exports.Profiler = REACT_PROFILER_TYPE;
	exports.PureComponent = PureComponent;
	exports.StrictMode = REACT_STRICT_MODE_TYPE;
	exports.Suspense = REACT_SUSPENSE_TYPE;
	exports.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = ReactSharedInternals;
	exports.__COMPILER_RUNTIME = {
		__proto__: null,
		c: function(size) {
			return ReactSharedInternals.H.useMemoCache(size);
		}
	};
	exports.cache = function(fn) {
		return function() {
			return fn.apply(null, arguments);
		};
	};
	exports.cacheSignal = function() {
		return null;
	};
	exports.cloneElement = function(element, config, children) {
		if (null === element || void 0 === element) throw Error("The argument must be a React element, but you passed " + element + ".");
		var props = assign({}, element.props), key = element.key;
		if (null != config) for (propName in void 0 !== config.key && (key = "" + config.key), config) !hasOwnProperty.call(config, propName) || "key" === propName || "__self" === propName || "__source" === propName || "ref" === propName && void 0 === config.ref || (props[propName] = config[propName]);
		var propName = arguments.length - 2;
		if (1 === propName) props.children = children;
		else if (1 < propName) {
			for (var childArray = Array(propName), i = 0; i < propName; i++) childArray[i] = arguments[i + 2];
			props.children = childArray;
		}
		return ReactElement(element.type, key, props);
	};
	exports.createContext = function(defaultValue) {
		defaultValue = {
			$$typeof: REACT_CONTEXT_TYPE,
			_currentValue: defaultValue,
			_currentValue2: defaultValue,
			_threadCount: 0,
			Provider: null,
			Consumer: null
		};
		defaultValue.Provider = defaultValue;
		defaultValue.Consumer = {
			$$typeof: REACT_CONSUMER_TYPE,
			_context: defaultValue
		};
		return defaultValue;
	};
	exports.createElement = function(type, config, children) {
		var propName, props = {}, key = null;
		if (null != config) for (propName in void 0 !== config.key && (key = "" + config.key), config) hasOwnProperty.call(config, propName) && "key" !== propName && "__self" !== propName && "__source" !== propName && (props[propName] = config[propName]);
		var childrenLength = arguments.length - 2;
		if (1 === childrenLength) props.children = children;
		else if (1 < childrenLength) {
			for (var childArray = Array(childrenLength), i = 0; i < childrenLength; i++) childArray[i] = arguments[i + 2];
			props.children = childArray;
		}
		if (type && type.defaultProps) for (propName in childrenLength = type.defaultProps, childrenLength) void 0 === props[propName] && (props[propName] = childrenLength[propName]);
		return ReactElement(type, key, props);
	};
	exports.createRef = function() {
		return { current: null };
	};
	exports.forwardRef = function(render) {
		return {
			$$typeof: REACT_FORWARD_REF_TYPE,
			render
		};
	};
	exports.isValidElement = isValidElement;
	exports.lazy = function(ctor) {
		return {
			$$typeof: REACT_LAZY_TYPE,
			_payload: {
				_status: -1,
				_result: ctor
			},
			_init: lazyInitializer
		};
	};
	exports.memo = function(type, compare) {
		return {
			$$typeof: REACT_MEMO_TYPE,
			type,
			compare: void 0 === compare ? null : compare
		};
	};
	exports.startTransition = function(scope) {
		var prevTransition = ReactSharedInternals.T, currentTransition = {};
		ReactSharedInternals.T = currentTransition;
		try {
			var returnValue = scope(), onStartTransitionFinish = ReactSharedInternals.S;
			null !== onStartTransitionFinish && onStartTransitionFinish(currentTransition, returnValue);
			"object" === typeof returnValue && null !== returnValue && "function" === typeof returnValue.then && returnValue.then(noop, reportGlobalError);
		} catch (error) {
			reportGlobalError(error);
		} finally {
			null !== prevTransition && null !== currentTransition.types && (prevTransition.types = currentTransition.types), ReactSharedInternals.T = prevTransition;
		}
	};
	exports.unstable_useCacheRefresh = function() {
		return ReactSharedInternals.H.useCacheRefresh();
	};
	exports.use = function(usable) {
		return ReactSharedInternals.H.use(usable);
	};
	exports.useActionState = function(action, initialState, permalink) {
		return ReactSharedInternals.H.useActionState(action, initialState, permalink);
	};
	exports.useCallback = function(callback, deps) {
		return ReactSharedInternals.H.useCallback(callback, deps);
	};
	exports.useContext = function(Context) {
		return ReactSharedInternals.H.useContext(Context);
	};
	exports.useDebugValue = function() {};
	exports.useDeferredValue = function(value, initialValue) {
		return ReactSharedInternals.H.useDeferredValue(value, initialValue);
	};
	exports.useEffect = function(create, deps) {
		return ReactSharedInternals.H.useEffect(create, deps);
	};
	exports.useEffectEvent = function(callback) {
		return ReactSharedInternals.H.useEffectEvent(callback);
	};
	exports.useId = function() {
		return ReactSharedInternals.H.useId();
	};
	exports.useImperativeHandle = function(ref, create, deps) {
		return ReactSharedInternals.H.useImperativeHandle(ref, create, deps);
	};
	exports.useInsertionEffect = function(create, deps) {
		return ReactSharedInternals.H.useInsertionEffect(create, deps);
	};
	exports.useLayoutEffect = function(create, deps) {
		return ReactSharedInternals.H.useLayoutEffect(create, deps);
	};
	exports.useMemo = function(create, deps) {
		return ReactSharedInternals.H.useMemo(create, deps);
	};
	exports.useOptimistic = function(passthrough, reducer) {
		return ReactSharedInternals.H.useOptimistic(passthrough, reducer);
	};
	exports.useReducer = function(reducer, initialArg, init) {
		return ReactSharedInternals.H.useReducer(reducer, initialArg, init);
	};
	exports.useRef = function(initialValue) {
		return ReactSharedInternals.H.useRef(initialValue);
	};
	exports.useState = function(initialState) {
		return ReactSharedInternals.H.useState(initialState);
	};
	exports.useSyncExternalStore = function(subscribe, getSnapshot, getServerSnapshot) {
		return ReactSharedInternals.H.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
	};
	exports.useTransition = function() {
		return ReactSharedInternals.H.useTransition();
	};
	exports.version = "19.2.7";
}));
//#endregion
//#region node_modules/react/cjs/react.development.js
/**
* @license React
* react.development.js
*
* Copyright (c) Meta Platforms, Inc. and affiliates.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/
var require_react_development = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	"production" !== process.env.NODE_ENV && (function() {
		function defineDeprecationWarning(methodName, info) {
			Object.defineProperty(Component.prototype, methodName, { get: function() {
				console.warn("%s(...) is deprecated in plain JavaScript React classes. %s", info[0], info[1]);
			} });
		}
		function getIteratorFn(maybeIterable) {
			if (null === maybeIterable || "object" !== typeof maybeIterable) return null;
			maybeIterable = MAYBE_ITERATOR_SYMBOL && maybeIterable[MAYBE_ITERATOR_SYMBOL] || maybeIterable["@@iterator"];
			return "function" === typeof maybeIterable ? maybeIterable : null;
		}
		function warnNoop(publicInstance, callerName) {
			publicInstance = (publicInstance = publicInstance.constructor) && (publicInstance.displayName || publicInstance.name) || "ReactClass";
			var warningKey = publicInstance + "." + callerName;
			didWarnStateUpdateForUnmountedComponent[warningKey] || (console.error("Can't call %s on a component that is not yet mounted. This is a no-op, but it might indicate a bug in your application. Instead, assign to `this.state` directly or define a `state = {};` class property with the desired state in the %s component.", callerName, publicInstance), didWarnStateUpdateForUnmountedComponent[warningKey] = !0);
		}
		function Component(props, context, updater) {
			this.props = props;
			this.context = context;
			this.refs = emptyObject;
			this.updater = updater || ReactNoopUpdateQueue;
		}
		function ComponentDummy() {}
		function PureComponent(props, context, updater) {
			this.props = props;
			this.context = context;
			this.refs = emptyObject;
			this.updater = updater || ReactNoopUpdateQueue;
		}
		function noop() {}
		function testStringCoercion(value) {
			return "" + value;
		}
		function checkKeyStringCoercion(value) {
			try {
				testStringCoercion(value);
				var JSCompiler_inline_result = !1;
			} catch (e) {
				JSCompiler_inline_result = !0;
			}
			if (JSCompiler_inline_result) {
				JSCompiler_inline_result = console;
				var JSCompiler_temp_const = JSCompiler_inline_result.error;
				var JSCompiler_inline_result$jscomp$0 = "function" === typeof Symbol && Symbol.toStringTag && value[Symbol.toStringTag] || value.constructor.name || "Object";
				JSCompiler_temp_const.call(JSCompiler_inline_result, "The provided key is an unsupported type %s. This value must be coerced to a string before using it here.", JSCompiler_inline_result$jscomp$0);
				return testStringCoercion(value);
			}
		}
		function getComponentNameFromType(type) {
			if (null == type) return null;
			if ("function" === typeof type) return type.$$typeof === REACT_CLIENT_REFERENCE ? null : type.displayName || type.name || null;
			if ("string" === typeof type) return type;
			switch (type) {
				case REACT_FRAGMENT_TYPE: return "Fragment";
				case REACT_PROFILER_TYPE: return "Profiler";
				case REACT_STRICT_MODE_TYPE: return "StrictMode";
				case REACT_SUSPENSE_TYPE: return "Suspense";
				case REACT_SUSPENSE_LIST_TYPE: return "SuspenseList";
				case REACT_ACTIVITY_TYPE: return "Activity";
			}
			if ("object" === typeof type) switch ("number" === typeof type.tag && console.error("Received an unexpected object in getComponentNameFromType(). This is likely a bug in React. Please file an issue."), type.$$typeof) {
				case REACT_PORTAL_TYPE: return "Portal";
				case REACT_CONTEXT_TYPE: return type.displayName || "Context";
				case REACT_CONSUMER_TYPE: return (type._context.displayName || "Context") + ".Consumer";
				case REACT_FORWARD_REF_TYPE:
					var innerType = type.render;
					type = type.displayName;
					type || (type = innerType.displayName || innerType.name || "", type = "" !== type ? "ForwardRef(" + type + ")" : "ForwardRef");
					return type;
				case REACT_MEMO_TYPE: return innerType = type.displayName || null, null !== innerType ? innerType : getComponentNameFromType(type.type) || "Memo";
				case REACT_LAZY_TYPE:
					innerType = type._payload;
					type = type._init;
					try {
						return getComponentNameFromType(type(innerType));
					} catch (x) {}
			}
			return null;
		}
		function getTaskName(type) {
			if (type === REACT_FRAGMENT_TYPE) return "<>";
			if ("object" === typeof type && null !== type && type.$$typeof === REACT_LAZY_TYPE) return "<...>";
			try {
				var name = getComponentNameFromType(type);
				return name ? "<" + name + ">" : "<...>";
			} catch (x) {
				return "<...>";
			}
		}
		function getOwner() {
			var dispatcher = ReactSharedInternals.A;
			return null === dispatcher ? null : dispatcher.getOwner();
		}
		function UnknownOwner() {
			return Error("react-stack-top-frame");
		}
		function hasValidKey(config) {
			if (hasOwnProperty.call(config, "key")) {
				var getter = Object.getOwnPropertyDescriptor(config, "key").get;
				if (getter && getter.isReactWarning) return !1;
			}
			return void 0 !== config.key;
		}
		function defineKeyPropWarningGetter(props, displayName) {
			function warnAboutAccessingKey() {
				specialPropKeyWarningShown || (specialPropKeyWarningShown = !0, console.error("%s: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop. (https://react.dev/link/special-props)", displayName));
			}
			warnAboutAccessingKey.isReactWarning = !0;
			Object.defineProperty(props, "key", {
				get: warnAboutAccessingKey,
				configurable: !0
			});
		}
		function elementRefGetterWithDeprecationWarning() {
			var componentName = getComponentNameFromType(this.type);
			didWarnAboutElementRef[componentName] || (didWarnAboutElementRef[componentName] = !0, console.error("Accessing element.ref was removed in React 19. ref is now a regular prop. It will be removed from the JSX Element type in a future release."));
			componentName = this.props.ref;
			return void 0 !== componentName ? componentName : null;
		}
		function ReactElement(type, key, props, owner, debugStack, debugTask) {
			var refProp = props.ref;
			type = {
				$$typeof: REACT_ELEMENT_TYPE,
				type,
				key,
				props,
				_owner: owner
			};
			null !== (void 0 !== refProp ? refProp : null) ? Object.defineProperty(type, "ref", {
				enumerable: !1,
				get: elementRefGetterWithDeprecationWarning
			}) : Object.defineProperty(type, "ref", {
				enumerable: !1,
				value: null
			});
			type._store = {};
			Object.defineProperty(type._store, "validated", {
				configurable: !1,
				enumerable: !1,
				writable: !0,
				value: 0
			});
			Object.defineProperty(type, "_debugInfo", {
				configurable: !1,
				enumerable: !1,
				writable: !0,
				value: null
			});
			Object.defineProperty(type, "_debugStack", {
				configurable: !1,
				enumerable: !1,
				writable: !0,
				value: debugStack
			});
			Object.defineProperty(type, "_debugTask", {
				configurable: !1,
				enumerable: !1,
				writable: !0,
				value: debugTask
			});
			Object.freeze && (Object.freeze(type.props), Object.freeze(type));
			return type;
		}
		function cloneAndReplaceKey(oldElement, newKey) {
			newKey = ReactElement(oldElement.type, newKey, oldElement.props, oldElement._owner, oldElement._debugStack, oldElement._debugTask);
			oldElement._store && (newKey._store.validated = oldElement._store.validated);
			return newKey;
		}
		function validateChildKeys(node) {
			isValidElement(node) ? node._store && (node._store.validated = 1) : "object" === typeof node && null !== node && node.$$typeof === REACT_LAZY_TYPE && ("fulfilled" === node._payload.status ? isValidElement(node._payload.value) && node._payload.value._store && (node._payload.value._store.validated = 1) : node._store && (node._store.validated = 1));
		}
		function isValidElement(object) {
			return "object" === typeof object && null !== object && object.$$typeof === REACT_ELEMENT_TYPE;
		}
		function escape(key) {
			var escaperLookup = {
				"=": "=0",
				":": "=2"
			};
			return "$" + key.replace(/[=:]/g, function(match) {
				return escaperLookup[match];
			});
		}
		function getElementKey(element, index) {
			return "object" === typeof element && null !== element && null != element.key ? (checkKeyStringCoercion(element.key), escape("" + element.key)) : index.toString(36);
		}
		function resolveThenable(thenable) {
			switch (thenable.status) {
				case "fulfilled": return thenable.value;
				case "rejected": throw thenable.reason;
				default: switch ("string" === typeof thenable.status ? thenable.then(noop, noop) : (thenable.status = "pending", thenable.then(function(fulfilledValue) {
					"pending" === thenable.status && (thenable.status = "fulfilled", thenable.value = fulfilledValue);
				}, function(error) {
					"pending" === thenable.status && (thenable.status = "rejected", thenable.reason = error);
				})), thenable.status) {
					case "fulfilled": return thenable.value;
					case "rejected": throw thenable.reason;
				}
			}
			throw thenable;
		}
		function mapIntoArray(children, array, escapedPrefix, nameSoFar, callback) {
			var type = typeof children;
			if ("undefined" === type || "boolean" === type) children = null;
			var invokeCallback = !1;
			if (null === children) invokeCallback = !0;
			else switch (type) {
				case "bigint":
				case "string":
				case "number":
					invokeCallback = !0;
					break;
				case "object": switch (children.$$typeof) {
					case REACT_ELEMENT_TYPE:
					case REACT_PORTAL_TYPE:
						invokeCallback = !0;
						break;
					case REACT_LAZY_TYPE: return invokeCallback = children._init, mapIntoArray(invokeCallback(children._payload), array, escapedPrefix, nameSoFar, callback);
				}
			}
			if (invokeCallback) {
				invokeCallback = children;
				callback = callback(invokeCallback);
				var childKey = "" === nameSoFar ? "." + getElementKey(invokeCallback, 0) : nameSoFar;
				isArrayImpl(callback) ? (escapedPrefix = "", null != childKey && (escapedPrefix = childKey.replace(userProvidedKeyEscapeRegex, "$&/") + "/"), mapIntoArray(callback, array, escapedPrefix, "", function(c) {
					return c;
				})) : null != callback && (isValidElement(callback) && (null != callback.key && (invokeCallback && invokeCallback.key === callback.key || checkKeyStringCoercion(callback.key)), escapedPrefix = cloneAndReplaceKey(callback, escapedPrefix + (null == callback.key || invokeCallback && invokeCallback.key === callback.key ? "" : ("" + callback.key).replace(userProvidedKeyEscapeRegex, "$&/") + "/") + childKey), "" !== nameSoFar && null != invokeCallback && isValidElement(invokeCallback) && null == invokeCallback.key && invokeCallback._store && !invokeCallback._store.validated && (escapedPrefix._store.validated = 2), callback = escapedPrefix), array.push(callback));
				return 1;
			}
			invokeCallback = 0;
			childKey = "" === nameSoFar ? "." : nameSoFar + ":";
			if (isArrayImpl(children)) for (var i = 0; i < children.length; i++) nameSoFar = children[i], type = childKey + getElementKey(nameSoFar, i), invokeCallback += mapIntoArray(nameSoFar, array, escapedPrefix, type, callback);
			else if (i = getIteratorFn(children), "function" === typeof i) for (i === children.entries && (didWarnAboutMaps || console.warn("Using Maps as children is not supported. Use an array of keyed ReactElements instead."), didWarnAboutMaps = !0), children = i.call(children), i = 0; !(nameSoFar = children.next()).done;) nameSoFar = nameSoFar.value, type = childKey + getElementKey(nameSoFar, i++), invokeCallback += mapIntoArray(nameSoFar, array, escapedPrefix, type, callback);
			else if ("object" === type) {
				if ("function" === typeof children.then) return mapIntoArray(resolveThenable(children), array, escapedPrefix, nameSoFar, callback);
				array = String(children);
				throw Error("Objects are not valid as a React child (found: " + ("[object Object]" === array ? "object with keys {" + Object.keys(children).join(", ") + "}" : array) + "). If you meant to render a collection of children, use an array instead.");
			}
			return invokeCallback;
		}
		function mapChildren(children, func, context) {
			if (null == children) return children;
			var result = [], count = 0;
			mapIntoArray(children, result, "", "", function(child) {
				return func.call(context, child, count++);
			});
			return result;
		}
		function lazyInitializer(payload) {
			if (-1 === payload._status) {
				var ioInfo = payload._ioInfo;
				null != ioInfo && (ioInfo.start = ioInfo.end = performance.now());
				ioInfo = payload._result;
				var thenable = ioInfo();
				thenable.then(function(moduleObject) {
					if (0 === payload._status || -1 === payload._status) {
						payload._status = 1;
						payload._result = moduleObject;
						var _ioInfo = payload._ioInfo;
						null != _ioInfo && (_ioInfo.end = performance.now());
						void 0 === thenable.status && (thenable.status = "fulfilled", thenable.value = moduleObject);
					}
				}, function(error) {
					if (0 === payload._status || -1 === payload._status) {
						payload._status = 2;
						payload._result = error;
						var _ioInfo2 = payload._ioInfo;
						null != _ioInfo2 && (_ioInfo2.end = performance.now());
						void 0 === thenable.status && (thenable.status = "rejected", thenable.reason = error);
					}
				});
				ioInfo = payload._ioInfo;
				if (null != ioInfo) {
					ioInfo.value = thenable;
					var displayName = thenable.displayName;
					"string" === typeof displayName && (ioInfo.name = displayName);
				}
				-1 === payload._status && (payload._status = 0, payload._result = thenable);
			}
			if (1 === payload._status) return ioInfo = payload._result, void 0 === ioInfo && console.error("lazy: Expected the result of a dynamic import() call. Instead received: %s\n\nYour code should look like: \n  const MyComponent = lazy(() => import('./MyComponent'))\n\nDid you accidentally put curly braces around the import?", ioInfo), "default" in ioInfo || console.error("lazy: Expected the result of a dynamic import() call. Instead received: %s\n\nYour code should look like: \n  const MyComponent = lazy(() => import('./MyComponent'))", ioInfo), ioInfo.default;
			throw payload._result;
		}
		function resolveDispatcher() {
			var dispatcher = ReactSharedInternals.H;
			null === dispatcher && console.error("Invalid hook call. Hooks can only be called inside of the body of a function component. This could happen for one of the following reasons:\n1. You might have mismatching versions of React and the renderer (such as React DOM)\n2. You might be breaking the Rules of Hooks\n3. You might have more than one copy of React in the same app\nSee https://react.dev/link/invalid-hook-call for tips about how to debug and fix this problem.");
			return dispatcher;
		}
		function releaseAsyncTransition() {
			ReactSharedInternals.asyncTransitions--;
		}
		function enqueueTask(task) {
			if (null === enqueueTaskImpl) try {
				var requireString = ("require" + Math.random()).slice(0, 7);
				enqueueTaskImpl = (module && module[requireString]).call(module, "timers").setImmediate;
			} catch (_err) {
				enqueueTaskImpl = function(callback) {
					!1 === didWarnAboutMessageChannel && (didWarnAboutMessageChannel = !0, "undefined" === typeof MessageChannel && console.error("This browser does not have a MessageChannel implementation, so enqueuing tasks via await act(async () => ...) will fail. Please file an issue at https://github.com/facebook/react/issues if you encounter this warning."));
					var channel = new MessageChannel();
					channel.port1.onmessage = callback;
					channel.port2.postMessage(void 0);
				};
			}
			return enqueueTaskImpl(task);
		}
		function aggregateErrors(errors) {
			return 1 < errors.length && "function" === typeof AggregateError ? new AggregateError(errors) : errors[0];
		}
		function popActScope(prevActQueue, prevActScopeDepth) {
			prevActScopeDepth !== actScopeDepth - 1 && console.error("You seem to have overlapping act() calls, this is not supported. Be sure to await previous act() calls before making a new one. ");
			actScopeDepth = prevActScopeDepth;
		}
		function recursivelyFlushAsyncActWork(returnValue, resolve, reject) {
			var queue = ReactSharedInternals.actQueue;
			if (null !== queue) if (0 !== queue.length) try {
				flushActQueue(queue);
				enqueueTask(function() {
					return recursivelyFlushAsyncActWork(returnValue, resolve, reject);
				});
				return;
			} catch (error) {
				ReactSharedInternals.thrownErrors.push(error);
			}
			else ReactSharedInternals.actQueue = null;
			0 < ReactSharedInternals.thrownErrors.length ? (queue = aggregateErrors(ReactSharedInternals.thrownErrors), ReactSharedInternals.thrownErrors.length = 0, reject(queue)) : resolve(returnValue);
		}
		function flushActQueue(queue) {
			if (!isFlushing) {
				isFlushing = !0;
				var i = 0;
				try {
					for (; i < queue.length; i++) {
						var callback = queue[i];
						do {
							ReactSharedInternals.didUsePromise = !1;
							var continuation = callback(!1);
							if (null !== continuation) {
								if (ReactSharedInternals.didUsePromise) {
									queue[i] = callback;
									queue.splice(0, i);
									return;
								}
								callback = continuation;
							} else break;
						} while (1);
					}
					queue.length = 0;
				} catch (error) {
					queue.splice(0, i + 1), ReactSharedInternals.thrownErrors.push(error);
				} finally {
					isFlushing = !1;
				}
			}
		}
		"undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ && "function" === typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStart(Error());
		var REACT_ELEMENT_TYPE = Symbol.for("react.transitional.element"), REACT_PORTAL_TYPE = Symbol.for("react.portal"), REACT_FRAGMENT_TYPE = Symbol.for("react.fragment"), REACT_STRICT_MODE_TYPE = Symbol.for("react.strict_mode"), REACT_PROFILER_TYPE = Symbol.for("react.profiler"), REACT_CONSUMER_TYPE = Symbol.for("react.consumer"), REACT_CONTEXT_TYPE = Symbol.for("react.context"), REACT_FORWARD_REF_TYPE = Symbol.for("react.forward_ref"), REACT_SUSPENSE_TYPE = Symbol.for("react.suspense"), REACT_SUSPENSE_LIST_TYPE = Symbol.for("react.suspense_list"), REACT_MEMO_TYPE = Symbol.for("react.memo"), REACT_LAZY_TYPE = Symbol.for("react.lazy"), REACT_ACTIVITY_TYPE = Symbol.for("react.activity"), MAYBE_ITERATOR_SYMBOL = Symbol.iterator, didWarnStateUpdateForUnmountedComponent = {}, ReactNoopUpdateQueue = {
			isMounted: function() {
				return !1;
			},
			enqueueForceUpdate: function(publicInstance) {
				warnNoop(publicInstance, "forceUpdate");
			},
			enqueueReplaceState: function(publicInstance) {
				warnNoop(publicInstance, "replaceState");
			},
			enqueueSetState: function(publicInstance) {
				warnNoop(publicInstance, "setState");
			}
		}, assign = Object.assign, emptyObject = {};
		Object.freeze(emptyObject);
		Component.prototype.isReactComponent = {};
		Component.prototype.setState = function(partialState, callback) {
			if ("object" !== typeof partialState && "function" !== typeof partialState && null != partialState) throw Error("takes an object of state variables to update or a function which returns an object of state variables.");
			this.updater.enqueueSetState(this, partialState, callback, "setState");
		};
		Component.prototype.forceUpdate = function(callback) {
			this.updater.enqueueForceUpdate(this, callback, "forceUpdate");
		};
		var deprecatedAPIs = {
			isMounted: ["isMounted", "Instead, make sure to clean up subscriptions and pending requests in componentWillUnmount to prevent memory leaks."],
			replaceState: ["replaceState", "Refactor your code to use setState instead (see https://github.com/facebook/react/issues/3236)."]
		};
		for (fnName in deprecatedAPIs) deprecatedAPIs.hasOwnProperty(fnName) && defineDeprecationWarning(fnName, deprecatedAPIs[fnName]);
		ComponentDummy.prototype = Component.prototype;
		deprecatedAPIs = PureComponent.prototype = new ComponentDummy();
		deprecatedAPIs.constructor = PureComponent;
		assign(deprecatedAPIs, Component.prototype);
		deprecatedAPIs.isPureReactComponent = !0;
		var isArrayImpl = Array.isArray, REACT_CLIENT_REFERENCE = Symbol.for("react.client.reference"), ReactSharedInternals = {
			H: null,
			A: null,
			T: null,
			S: null,
			actQueue: null,
			asyncTransitions: 0,
			isBatchingLegacy: !1,
			didScheduleLegacyUpdate: !1,
			didUsePromise: !1,
			thrownErrors: [],
			getCurrentStack: null,
			recentlyCreatedOwnerStacks: 0
		}, hasOwnProperty = Object.prototype.hasOwnProperty, createTask = console.createTask ? console.createTask : function() {
			return null;
		};
		deprecatedAPIs = { react_stack_bottom_frame: function(callStackForError) {
			return callStackForError();
		} };
		var specialPropKeyWarningShown, didWarnAboutOldJSXRuntime;
		var didWarnAboutElementRef = {};
		var unknownOwnerDebugStack = deprecatedAPIs.react_stack_bottom_frame.bind(deprecatedAPIs, UnknownOwner)();
		var unknownOwnerDebugTask = createTask(getTaskName(UnknownOwner));
		var didWarnAboutMaps = !1, userProvidedKeyEscapeRegex = /\/+/g, reportGlobalError = "function" === typeof reportError ? reportError : function(error) {
			if ("object" === typeof window && "function" === typeof window.ErrorEvent) {
				var event = new window.ErrorEvent("error", {
					bubbles: !0,
					cancelable: !0,
					message: "object" === typeof error && null !== error && "string" === typeof error.message ? String(error.message) : String(error),
					error
				});
				if (!window.dispatchEvent(event)) return;
			} else if ("object" === typeof process && "function" === typeof process.emit) {
				process.emit("uncaughtException", error);
				return;
			}
			console.error(error);
		}, didWarnAboutMessageChannel = !1, enqueueTaskImpl = null, actScopeDepth = 0, didWarnNoAwaitAct = !1, isFlushing = !1, queueSeveralMicrotasks = "function" === typeof queueMicrotask ? function(callback) {
			queueMicrotask(function() {
				return queueMicrotask(callback);
			});
		} : enqueueTask;
		deprecatedAPIs = Object.freeze({
			__proto__: null,
			c: function(size) {
				return resolveDispatcher().useMemoCache(size);
			}
		});
		var fnName = {
			map: mapChildren,
			forEach: function(children, forEachFunc, forEachContext) {
				mapChildren(children, function() {
					forEachFunc.apply(this, arguments);
				}, forEachContext);
			},
			count: function(children) {
				var n = 0;
				mapChildren(children, function() {
					n++;
				});
				return n;
			},
			toArray: function(children) {
				return mapChildren(children, function(child) {
					return child;
				}) || [];
			},
			only: function(children) {
				if (!isValidElement(children)) throw Error("React.Children.only expected to receive a single React element child.");
				return children;
			}
		};
		exports.Activity = REACT_ACTIVITY_TYPE;
		exports.Children = fnName;
		exports.Component = Component;
		exports.Fragment = REACT_FRAGMENT_TYPE;
		exports.Profiler = REACT_PROFILER_TYPE;
		exports.PureComponent = PureComponent;
		exports.StrictMode = REACT_STRICT_MODE_TYPE;
		exports.Suspense = REACT_SUSPENSE_TYPE;
		exports.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = ReactSharedInternals;
		exports.__COMPILER_RUNTIME = deprecatedAPIs;
		exports.act = function(callback) {
			var prevActQueue = ReactSharedInternals.actQueue, prevActScopeDepth = actScopeDepth;
			actScopeDepth++;
			var queue = ReactSharedInternals.actQueue = null !== prevActQueue ? prevActQueue : [], didAwaitActCall = !1;
			try {
				var result = callback();
			} catch (error) {
				ReactSharedInternals.thrownErrors.push(error);
			}
			if (0 < ReactSharedInternals.thrownErrors.length) throw popActScope(prevActQueue, prevActScopeDepth), callback = aggregateErrors(ReactSharedInternals.thrownErrors), ReactSharedInternals.thrownErrors.length = 0, callback;
			if (null !== result && "object" === typeof result && "function" === typeof result.then) {
				var thenable = result;
				queueSeveralMicrotasks(function() {
					didAwaitActCall || didWarnNoAwaitAct || (didWarnNoAwaitAct = !0, console.error("You called act(async () => ...) without await. This could lead to unexpected testing behaviour, interleaving multiple act calls and mixing their scopes. You should - await act(async () => ...);"));
				});
				return { then: function(resolve, reject) {
					didAwaitActCall = !0;
					thenable.then(function(returnValue) {
						popActScope(prevActQueue, prevActScopeDepth);
						if (0 === prevActScopeDepth) {
							try {
								flushActQueue(queue), enqueueTask(function() {
									return recursivelyFlushAsyncActWork(returnValue, resolve, reject);
								});
							} catch (error$0) {
								ReactSharedInternals.thrownErrors.push(error$0);
							}
							if (0 < ReactSharedInternals.thrownErrors.length) {
								var _thrownError = aggregateErrors(ReactSharedInternals.thrownErrors);
								ReactSharedInternals.thrownErrors.length = 0;
								reject(_thrownError);
							}
						} else resolve(returnValue);
					}, function(error) {
						popActScope(prevActQueue, prevActScopeDepth);
						0 < ReactSharedInternals.thrownErrors.length ? (error = aggregateErrors(ReactSharedInternals.thrownErrors), ReactSharedInternals.thrownErrors.length = 0, reject(error)) : reject(error);
					});
				} };
			}
			var returnValue$jscomp$0 = result;
			popActScope(prevActQueue, prevActScopeDepth);
			0 === prevActScopeDepth && (flushActQueue(queue), 0 !== queue.length && queueSeveralMicrotasks(function() {
				didAwaitActCall || didWarnNoAwaitAct || (didWarnNoAwaitAct = !0, console.error("A component suspended inside an `act` scope, but the `act` call was not awaited. When testing React components that depend on asynchronous data, you must await the result:\n\nawait act(() => ...)"));
			}), ReactSharedInternals.actQueue = null);
			if (0 < ReactSharedInternals.thrownErrors.length) throw callback = aggregateErrors(ReactSharedInternals.thrownErrors), ReactSharedInternals.thrownErrors.length = 0, callback;
			return { then: function(resolve, reject) {
				didAwaitActCall = !0;
				0 === prevActScopeDepth ? (ReactSharedInternals.actQueue = queue, enqueueTask(function() {
					return recursivelyFlushAsyncActWork(returnValue$jscomp$0, resolve, reject);
				})) : resolve(returnValue$jscomp$0);
			} };
		};
		exports.cache = function(fn) {
			return function() {
				return fn.apply(null, arguments);
			};
		};
		exports.cacheSignal = function() {
			return null;
		};
		exports.captureOwnerStack = function() {
			var getCurrentStack = ReactSharedInternals.getCurrentStack;
			return null === getCurrentStack ? null : getCurrentStack();
		};
		exports.cloneElement = function(element, config, children) {
			if (null === element || void 0 === element) throw Error("The argument must be a React element, but you passed " + element + ".");
			var props = assign({}, element.props), key = element.key, owner = element._owner;
			if (null != config) {
				var JSCompiler_inline_result;
				a: {
					if (hasOwnProperty.call(config, "ref") && (JSCompiler_inline_result = Object.getOwnPropertyDescriptor(config, "ref").get) && JSCompiler_inline_result.isReactWarning) {
						JSCompiler_inline_result = !1;
						break a;
					}
					JSCompiler_inline_result = void 0 !== config.ref;
				}
				JSCompiler_inline_result && (owner = getOwner());
				hasValidKey(config) && (checkKeyStringCoercion(config.key), key = "" + config.key);
				for (propName in config) !hasOwnProperty.call(config, propName) || "key" === propName || "__self" === propName || "__source" === propName || "ref" === propName && void 0 === config.ref || (props[propName] = config[propName]);
			}
			var propName = arguments.length - 2;
			if (1 === propName) props.children = children;
			else if (1 < propName) {
				JSCompiler_inline_result = Array(propName);
				for (var i = 0; i < propName; i++) JSCompiler_inline_result[i] = arguments[i + 2];
				props.children = JSCompiler_inline_result;
			}
			props = ReactElement(element.type, key, props, owner, element._debugStack, element._debugTask);
			for (key = 2; key < arguments.length; key++) validateChildKeys(arguments[key]);
			return props;
		};
		exports.createContext = function(defaultValue) {
			defaultValue = {
				$$typeof: REACT_CONTEXT_TYPE,
				_currentValue: defaultValue,
				_currentValue2: defaultValue,
				_threadCount: 0,
				Provider: null,
				Consumer: null
			};
			defaultValue.Provider = defaultValue;
			defaultValue.Consumer = {
				$$typeof: REACT_CONSUMER_TYPE,
				_context: defaultValue
			};
			defaultValue._currentRenderer = null;
			defaultValue._currentRenderer2 = null;
			return defaultValue;
		};
		exports.createElement = function(type, config, children) {
			for (var i = 2; i < arguments.length; i++) validateChildKeys(arguments[i]);
			i = {};
			var key = null;
			if (null != config) for (propName in didWarnAboutOldJSXRuntime || !("__self" in config) || "key" in config || (didWarnAboutOldJSXRuntime = !0, console.warn("Your app (or one of its dependencies) is using an outdated JSX transform. Update to the modern JSX transform for faster performance: https://react.dev/link/new-jsx-transform")), hasValidKey(config) && (checkKeyStringCoercion(config.key), key = "" + config.key), config) hasOwnProperty.call(config, propName) && "key" !== propName && "__self" !== propName && "__source" !== propName && (i[propName] = config[propName]);
			var childrenLength = arguments.length - 2;
			if (1 === childrenLength) i.children = children;
			else if (1 < childrenLength) {
				for (var childArray = Array(childrenLength), _i = 0; _i < childrenLength; _i++) childArray[_i] = arguments[_i + 2];
				Object.freeze && Object.freeze(childArray);
				i.children = childArray;
			}
			if (type && type.defaultProps) for (propName in childrenLength = type.defaultProps, childrenLength) void 0 === i[propName] && (i[propName] = childrenLength[propName]);
			key && defineKeyPropWarningGetter(i, "function" === typeof type ? type.displayName || type.name || "Unknown" : type);
			var propName = 1e4 > ReactSharedInternals.recentlyCreatedOwnerStacks++;
			return ReactElement(type, key, i, getOwner(), propName ? Error("react-stack-top-frame") : unknownOwnerDebugStack, propName ? createTask(getTaskName(type)) : unknownOwnerDebugTask);
		};
		exports.createRef = function() {
			var refObject = { current: null };
			Object.seal(refObject);
			return refObject;
		};
		exports.forwardRef = function(render) {
			null != render && render.$$typeof === REACT_MEMO_TYPE ? console.error("forwardRef requires a render function but received a `memo` component. Instead of forwardRef(memo(...)), use memo(forwardRef(...)).") : "function" !== typeof render ? console.error("forwardRef requires a render function but was given %s.", null === render ? "null" : typeof render) : 0 !== render.length && 2 !== render.length && console.error("forwardRef render functions accept exactly two parameters: props and ref. %s", 1 === render.length ? "Did you forget to use the ref parameter?" : "Any additional parameter will be undefined.");
			null != render && null != render.defaultProps && console.error("forwardRef render functions do not support defaultProps. Did you accidentally pass a React component?");
			var elementType = {
				$$typeof: REACT_FORWARD_REF_TYPE,
				render
			}, ownName;
			Object.defineProperty(elementType, "displayName", {
				enumerable: !1,
				configurable: !0,
				get: function() {
					return ownName;
				},
				set: function(name) {
					ownName = name;
					render.name || render.displayName || (Object.defineProperty(render, "name", { value: name }), render.displayName = name);
				}
			});
			return elementType;
		};
		exports.isValidElement = isValidElement;
		exports.lazy = function(ctor) {
			ctor = {
				_status: -1,
				_result: ctor
			};
			var lazyType = {
				$$typeof: REACT_LAZY_TYPE,
				_payload: ctor,
				_init: lazyInitializer
			}, ioInfo = {
				name: "lazy",
				start: -1,
				end: -1,
				value: null,
				owner: null,
				debugStack: Error("react-stack-top-frame"),
				debugTask: console.createTask ? console.createTask("lazy()") : null
			};
			ctor._ioInfo = ioInfo;
			lazyType._debugInfo = [{ awaited: ioInfo }];
			return lazyType;
		};
		exports.memo = function(type, compare) {
			type ?? console.error("memo: The first argument must be a component. Instead received: %s", null === type ? "null" : typeof type);
			compare = {
				$$typeof: REACT_MEMO_TYPE,
				type,
				compare: void 0 === compare ? null : compare
			};
			var ownName;
			Object.defineProperty(compare, "displayName", {
				enumerable: !1,
				configurable: !0,
				get: function() {
					return ownName;
				},
				set: function(name) {
					ownName = name;
					type.name || type.displayName || (Object.defineProperty(type, "name", { value: name }), type.displayName = name);
				}
			});
			return compare;
		};
		exports.startTransition = function(scope) {
			var prevTransition = ReactSharedInternals.T, currentTransition = {};
			currentTransition._updatedFibers = /* @__PURE__ */ new Set();
			ReactSharedInternals.T = currentTransition;
			try {
				var returnValue = scope(), onStartTransitionFinish = ReactSharedInternals.S;
				null !== onStartTransitionFinish && onStartTransitionFinish(currentTransition, returnValue);
				"object" === typeof returnValue && null !== returnValue && "function" === typeof returnValue.then && (ReactSharedInternals.asyncTransitions++, returnValue.then(releaseAsyncTransition, releaseAsyncTransition), returnValue.then(noop, reportGlobalError));
			} catch (error) {
				reportGlobalError(error);
			} finally {
				null === prevTransition && currentTransition._updatedFibers && (scope = currentTransition._updatedFibers.size, currentTransition._updatedFibers.clear(), 10 < scope && console.warn("Detected a large number of updates inside startTransition. If this is due to a subscription please re-write it to use React provided hooks. Otherwise concurrent mode guarantees are off the table.")), null !== prevTransition && null !== currentTransition.types && (null !== prevTransition.types && prevTransition.types !== currentTransition.types && console.error("We expected inner Transitions to have transferred the outer types set and that you cannot add to the outer Transition while inside the inner.This is a bug in React."), prevTransition.types = currentTransition.types), ReactSharedInternals.T = prevTransition;
			}
		};
		exports.unstable_useCacheRefresh = function() {
			return resolveDispatcher().useCacheRefresh();
		};
		exports.use = function(usable) {
			return resolveDispatcher().use(usable);
		};
		exports.useActionState = function(action, initialState, permalink) {
			return resolveDispatcher().useActionState(action, initialState, permalink);
		};
		exports.useCallback = function(callback, deps) {
			return resolveDispatcher().useCallback(callback, deps);
		};
		exports.useContext = function(Context) {
			var dispatcher = resolveDispatcher();
			Context.$$typeof === REACT_CONSUMER_TYPE && console.error("Calling useContext(Context.Consumer) is not supported and will cause bugs. Did you mean to call useContext(Context) instead?");
			return dispatcher.useContext(Context);
		};
		exports.useDebugValue = function(value, formatterFn) {
			return resolveDispatcher().useDebugValue(value, formatterFn);
		};
		exports.useDeferredValue = function(value, initialValue) {
			return resolveDispatcher().useDeferredValue(value, initialValue);
		};
		exports.useEffect = function(create, deps) {
			create ?? console.warn("React Hook useEffect requires an effect callback. Did you forget to pass a callback to the hook?");
			return resolveDispatcher().useEffect(create, deps);
		};
		exports.useEffectEvent = function(callback) {
			return resolveDispatcher().useEffectEvent(callback);
		};
		exports.useId = function() {
			return resolveDispatcher().useId();
		};
		exports.useImperativeHandle = function(ref, create, deps) {
			return resolveDispatcher().useImperativeHandle(ref, create, deps);
		};
		exports.useInsertionEffect = function(create, deps) {
			create ?? console.warn("React Hook useInsertionEffect requires an effect callback. Did you forget to pass a callback to the hook?");
			return resolveDispatcher().useInsertionEffect(create, deps);
		};
		exports.useLayoutEffect = function(create, deps) {
			create ?? console.warn("React Hook useLayoutEffect requires an effect callback. Did you forget to pass a callback to the hook?");
			return resolveDispatcher().useLayoutEffect(create, deps);
		};
		exports.useMemo = function(create, deps) {
			return resolveDispatcher().useMemo(create, deps);
		};
		exports.useOptimistic = function(passthrough, reducer) {
			return resolveDispatcher().useOptimistic(passthrough, reducer);
		};
		exports.useReducer = function(reducer, initialArg, init) {
			return resolveDispatcher().useReducer(reducer, initialArg, init);
		};
		exports.useRef = function(initialValue) {
			return resolveDispatcher().useRef(initialValue);
		};
		exports.useState = function(initialState) {
			return resolveDispatcher().useState(initialState);
		};
		exports.useSyncExternalStore = function(subscribe, getSnapshot, getServerSnapshot) {
			return resolveDispatcher().useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
		};
		exports.useTransition = function() {
			return resolveDispatcher().useTransition();
		};
		exports.version = "19.2.7";
		"undefined" !== typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ && "function" === typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop && __REACT_DEVTOOLS_GLOBAL_HOOK__.registerInternalModuleStop(Error());
	})();
}));
//#endregion
//#region node_modules/react/index.js
var require_react = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	if (process.env.NODE_ENV === "production") module.exports = require_react_production();
	else module.exports = require_react_development();
}));
//#endregion
//#region node_modules/lucide-react/dist/esm/shared/src/utils/mergeClasses.mjs
/**
* @license lucide-react v1.25.0 - ISC
*
* This source code is licensed under the ISC license.
* See the LICENSE file in the root directory of this source tree.
*/
var mergeClasses = (...classes) => classes.filter((className, index, array) => {
	return Boolean(className) && className.trim() !== "" && array.indexOf(className) === index;
}).join(" ").trim();
//#endregion
//#region node_modules/lucide-react/dist/esm/shared/src/utils/toKebabCase.mjs
/**
* @license lucide-react v1.25.0 - ISC
*
* This source code is licensed under the ISC license.
* See the LICENSE file in the root directory of this source tree.
*/
var toKebabCase = (string) => string.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
//#endregion
//#region node_modules/lucide-react/dist/esm/shared/src/utils/toCamelCase.mjs
/**
* @license lucide-react v1.25.0 - ISC
*
* This source code is licensed under the ISC license.
* See the LICENSE file in the root directory of this source tree.
*/
var toCamelCase = (string) => string.replace(/^([A-Z])|[\s-_]+(\w)/g, (match, p1, p2) => p2 ? p2.toUpperCase() : p1.toLowerCase());
//#endregion
//#region node_modules/lucide-react/dist/esm/shared/src/utils/toPascalCase.mjs
/**
* @license lucide-react v1.25.0 - ISC
*
* This source code is licensed under the ISC license.
* See the LICENSE file in the root directory of this source tree.
*/
var toPascalCase = (string) => {
	const camelCase = toCamelCase(string);
	return camelCase.charAt(0).toUpperCase() + camelCase.slice(1);
};
//#endregion
//#region node_modules/lucide-react/dist/esm/defaultAttributes.mjs
/**
* @license lucide-react v1.25.0 - ISC
*
* This source code is licensed under the ISC license.
* See the LICENSE file in the root directory of this source tree.
*/
var defaultAttributes = {
	xmlns: "http://www.w3.org/2000/svg",
	width: 24,
	height: 24,
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: 2,
	strokeLinecap: "round",
	strokeLinejoin: "round"
};
//#endregion
//#region node_modules/lucide-react/dist/esm/shared/src/utils/hasA11yProp.mjs
/**
* @license lucide-react v1.25.0 - ISC
*
* This source code is licensed under the ISC license.
* See the LICENSE file in the root directory of this source tree.
*/
var hasA11yProp = (props) => {
	for (const prop in props) if (prop.startsWith("aria-") || prop === "role" || prop === "title") return true;
	return false;
};
//#endregion
//#region node_modules/lucide-react/dist/esm/context.mjs
var import_react = require_react();
/**
* @license lucide-react v1.25.0 - ISC
*
* This source code is licensed under the ISC license.
* See the LICENSE file in the root directory of this source tree.
*/
var LucideContext = (0, import_react.createContext)({});
var useLucideContext = () => (0, import_react.useContext)(LucideContext);
//#endregion
//#region node_modules/lucide-react/dist/esm/Icon.mjs
/**
* @license lucide-react v1.25.0 - ISC
*
* This source code is licensed under the ISC license.
* See the LICENSE file in the root directory of this source tree.
*/
var Icon = (0, import_react.forwardRef)(({ color, size, strokeWidth, absoluteStrokeWidth, className = "", children, iconNode, ...rest }, ref) => {
	const { size: contextSize = 24, strokeWidth: contextStrokeWidth = 2, absoluteStrokeWidth: contextAbsoluteStrokeWidth = false, color: contextColor = "currentColor", className: contextClass = "" } = useLucideContext() ?? {};
	const calculatedStrokeWidth = absoluteStrokeWidth ?? contextAbsoluteStrokeWidth ? Number(strokeWidth ?? contextStrokeWidth) * 24 / Number(size ?? contextSize) : strokeWidth ?? contextStrokeWidth;
	return (0, import_react.createElement)("svg", {
		ref,
		...defaultAttributes,
		width: size ?? contextSize ?? defaultAttributes.width,
		height: size ?? contextSize ?? defaultAttributes.height,
		stroke: color ?? contextColor,
		strokeWidth: calculatedStrokeWidth,
		className: mergeClasses("lucide", contextClass, className),
		...!children && !hasA11yProp(rest) && { "aria-hidden": "true" },
		...rest
	}, [...iconNode.map(([tag, attrs]) => (0, import_react.createElement)(tag, attrs)), ...Array.isArray(children) ? children : [children]]);
});
//#endregion
//#region node_modules/lucide-react/dist/esm/createLucideIcon.mjs
/**
* @license lucide-react v1.25.0 - ISC
*
* This source code is licensed under the ISC license.
* See the LICENSE file in the root directory of this source tree.
*/
var createLucideIcon = (iconName, iconNode) => {
	const Component = (0, import_react.forwardRef)(({ className, ...props }, ref) => (0, import_react.createElement)(Icon, {
		ref,
		iconNode,
		className: mergeClasses(`lucide-${toKebabCase(toPascalCase(iconName))}`, `lucide-${iconName}`, className),
		...props
	}));
	Component.displayName = toPascalCase(iconName);
	return Component;
};
/**
* @license lucide-react v1.25.0 - ISC
*
* This source code is licensed under the ISC license.
* See the LICENSE file in the root directory of this source tree.
*/
var BookOpenText = createLucideIcon("book-open-text", [
	["path", {
		d: "M12 7v14",
		key: "1akyts"
	}],
	["path", {
		d: "M16 12h2",
		key: "7q9ll5"
	}],
	["path", {
		d: "M16 8h2",
		key: "msurwy"
	}],
	["path", {
		d: "M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z",
		key: "ruj8y"
	}],
	["path", {
		d: "M6 12h2",
		key: "32wvfc"
	}],
	["path", {
		d: "M6 8h2",
		key: "30oboj"
	}]
]);
/**
* @license lucide-react v1.25.0 - ISC
*
* This source code is licensed under the ISC license.
* See the LICENSE file in the root directory of this source tree.
*/
var Building2 = createLucideIcon("building-2", [
	["path", {
		d: "M10 12h4",
		key: "a56b0p"
	}],
	["path", {
		d: "M10 8h4",
		key: "1sr2af"
	}],
	["path", {
		d: "M14 21v-3a2 2 0 0 0-4 0v3",
		key: "1rgiei"
	}],
	["path", {
		d: "M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2",
		key: "secmi2"
	}],
	["path", {
		d: "M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16",
		key: "16ra0t"
	}]
]);
/**
* @license lucide-react v1.25.0 - ISC
*
* This source code is licensed under the ISC license.
* See the LICENSE file in the root directory of this source tree.
*/
var CalendarDays = createLucideIcon("calendar-days", [
	["path", {
		d: "M8 2v4",
		key: "1cmpym"
	}],
	["path", {
		d: "M16 2v4",
		key: "4m81vk"
	}],
	["rect", {
		width: "18",
		height: "18",
		x: "3",
		y: "4",
		rx: "2",
		key: "1hopcy"
	}],
	["path", {
		d: "M3 10h18",
		key: "8toen8"
	}],
	["path", {
		d: "M8 14h.01",
		key: "6423bh"
	}],
	["path", {
		d: "M12 14h.01",
		key: "1etili"
	}],
	["path", {
		d: "M16 14h.01",
		key: "1gbofw"
	}],
	["path", {
		d: "M8 18h.01",
		key: "lrp35t"
	}],
	["path", {
		d: "M12 18h.01",
		key: "mhygvu"
	}],
	["path", {
		d: "M16 18h.01",
		key: "kzsmim"
	}]
]);
/**
* @license lucide-react v1.25.0 - ISC
*
* This source code is licensed under the ISC license.
* See the LICENSE file in the root directory of this source tree.
*/
var ClipboardList = createLucideIcon("clipboard-list", [
	["rect", {
		width: "8",
		height: "4",
		x: "8",
		y: "2",
		rx: "1",
		ry: "1",
		key: "tgr4d6"
	}],
	["path", {
		d: "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2",
		key: "116196"
	}],
	["path", {
		d: "M12 11h4",
		key: "1jrz19"
	}],
	["path", {
		d: "M12 16h4",
		key: "n85exb"
	}],
	["path", {
		d: "M8 11h.01",
		key: "1dfujw"
	}],
	["path", {
		d: "M8 16h.01",
		key: "18s6g9"
	}]
]);
/**
* @license lucide-react v1.25.0 - ISC
*
* This source code is licensed under the ISC license.
* See the LICENSE file in the root directory of this source tree.
*/
var Compass = createLucideIcon("compass", [["circle", {
	cx: "12",
	cy: "12",
	r: "10",
	key: "1mglay"
}], ["path", {
	d: "m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z",
	key: "9ktpf1"
}]]);
/**
* @license lucide-react v1.25.0 - ISC
*
* This source code is licensed under the ISC license.
* See the LICENSE file in the root directory of this source tree.
*/
var FileCheckCorner = createLucideIcon("file-check-corner", [
	["path", {
		d: "M10.5 22H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.706.706l3.588 3.588A2.4 2.4 0 0 1 20 8v6",
		key: "g5mvt7"
	}],
	["path", {
		d: "M14 2v5a1 1 0 0 0 1 1h5",
		key: "wfsgrz"
	}],
	["path", {
		d: "m14 20 2 2 4-4",
		key: "15kota"
	}]
]);
/**
* @license lucide-react v1.25.0 - ISC
*
* This source code is licensed under the ISC license.
* See the LICENSE file in the root directory of this source tree.
*/
var FlaskConical = createLucideIcon("flask-conical", [
	["path", {
		d: "M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2",
		key: "18mbvz"
	}],
	["path", {
		d: "M6.453 15h11.094",
		key: "3shlmq"
	}],
	["path", {
		d: "M8.5 2h7",
		key: "csnxdl"
	}]
]);
/**
* @license lucide-react v1.25.0 - ISC
*
* This source code is licensed under the ISC license.
* See the LICENSE file in the root directory of this source tree.
*/
var Funnel = createLucideIcon("funnel", [["path", {
	d: "M10 20a1 1 0 0 0 .553.895l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .517-1.341L21.74 4.67A1 1 0 0 0 21 3H3a1 1 0 0 0-.742 1.67l7.225 7.989A2 2 0 0 1 10 14z",
	key: "sc7q7i"
}]]);
/**
* @license lucide-react v1.25.0 - ISC
*
* This source code is licensed under the ISC license.
* See the LICENSE file in the root directory of this source tree.
*/
var Gauge = createLucideIcon("gauge", [["path", {
	d: "m12 14 4-4",
	key: "9kzdfg"
}], ["path", {
	d: "M3.34 19a10 10 0 1 1 17.32 0",
	key: "19p75a"
}]]);
/**
* @license lucide-react v1.25.0 - ISC
*
* This source code is licensed under the ISC license.
* See the LICENSE file in the root directory of this source tree.
*/
var Inbox = createLucideIcon("inbox", [["polyline", {
	points: "22 12 16 12 14 15 10 15 8 12 2 12",
	key: "o97t9d"
}], ["path", {
	d: "M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z",
	key: "oot6mr"
}]]);
/**
* @license lucide-react v1.25.0 - ISC
*
* This source code is licensed under the ISC license.
* See the LICENSE file in the root directory of this source tree.
*/
var Landmark = createLucideIcon("landmark", [
	["path", {
		d: "M10 18v-7",
		key: "wt116b"
	}],
	["path", {
		d: "M11.119 2.205a2 2 0 0 1 1.762 0l7.84 3.846A.5.5 0 0 1 20.5 7h-17a.5.5 0 0 1-.22-.949z",
		key: "yxxwt6"
	}],
	["path", {
		d: "M14 18v-7",
		key: "vav6t3"
	}],
	["path", {
		d: "M18 18v-7",
		key: "aexdmj"
	}],
	["path", {
		d: "M3 22h18",
		key: "8prr45"
	}],
	["path", {
		d: "M6 18v-7",
		key: "1ivflk"
	}]
]);
/**
* @license lucide-react v1.25.0 - ISC
*
* This source code is licensed under the ISC license.
* See the LICENSE file in the root directory of this source tree.
*/
var LayoutGrid = createLucideIcon("layout-grid", [
	["rect", {
		width: "7",
		height: "7",
		x: "3",
		y: "3",
		rx: "1",
		key: "1g98yp"
	}],
	["rect", {
		width: "7",
		height: "7",
		x: "14",
		y: "3",
		rx: "1",
		key: "6d4xhi"
	}],
	["rect", {
		width: "7",
		height: "7",
		x: "14",
		y: "14",
		rx: "1",
		key: "nxv5o0"
	}],
	["rect", {
		width: "7",
		height: "7",
		x: "3",
		y: "14",
		rx: "1",
		key: "1bb6yr"
	}]
]);
/**
* @license lucide-react v1.25.0 - ISC
*
* This source code is licensed under the ISC license.
* See the LICENSE file in the root directory of this source tree.
*/
var Library = createLucideIcon("library", [
	["path", {
		d: "m16 6 4 14",
		key: "ji33uf"
	}],
	["path", {
		d: "M12 6v14",
		key: "1n7gus"
	}],
	["path", {
		d: "M8 8v12",
		key: "1gg7y9"
	}],
	["path", {
		d: "M4 4v16",
		key: "6qkkli"
	}]
]);
/**
* @license lucide-react v1.25.0 - ISC
*
* This source code is licensed under the ISC license.
* See the LICENSE file in the root directory of this source tree.
*/
var ListChecks = createLucideIcon("list-checks", [
	["path", {
		d: "M13 5h8",
		key: "a7qcls"
	}],
	["path", {
		d: "M13 12h8",
		key: "h98zly"
	}],
	["path", {
		d: "M13 19h8",
		key: "c3s6r1"
	}],
	["path", {
		d: "m3 17 2 2 4-4",
		key: "1jhpwq"
	}],
	["path", {
		d: "m3 7 2 2 4-4",
		key: "1obspn"
	}]
]);
/**
* @license lucide-react v1.25.0 - ISC
*
* This source code is licensed under the ISC license.
* See the LICENSE file in the root directory of this source tree.
*/
var NotebookPen = createLucideIcon("notebook-pen", [
	["path", {
		d: "M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4",
		key: "re6nr2"
	}],
	["path", {
		d: "M2 6h4",
		key: "aawbzj"
	}],
	["path", {
		d: "M2 10h4",
		key: "l0bgd4"
	}],
	["path", {
		d: "M2 14h4",
		key: "1gsvsf"
	}],
	["path", {
		d: "M2 18h4",
		key: "1bu2t1"
	}],
	["path", {
		d: "M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z",
		key: "pqwjuv"
	}]
]);
/**
* @license lucide-react v1.25.0 - ISC
*
* This source code is licensed under the ISC license.
* See the LICENSE file in the root directory of this source tree.
*/
var Palette = createLucideIcon("palette", [
	["path", {
		d: "M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z",
		key: "e79jfc"
	}],
	["circle", {
		cx: "13.5",
		cy: "6.5",
		r: ".5",
		fill: "currentColor",
		key: "1okk4w"
	}],
	["circle", {
		cx: "17.5",
		cy: "10.5",
		r: ".5",
		fill: "currentColor",
		key: "f64h9f"
	}],
	["circle", {
		cx: "6.5",
		cy: "12.5",
		r: ".5",
		fill: "currentColor",
		key: "qy21gx"
	}],
	["circle", {
		cx: "8.5",
		cy: "7.5",
		r: ".5",
		fill: "currentColor",
		key: "fotxhn"
	}]
]);
/**
* @license lucide-react v1.25.0 - ISC
*
* This source code is licensed under the ISC license.
* See the LICENSE file in the root directory of this source tree.
*/
var PencilRuler = createLucideIcon("pencil-ruler", [
	["path", {
		d: "M13 7 8.7 2.7a2.41 2.41 0 0 0-3.4 0L2.7 5.3a2.41 2.41 0 0 0 0 3.4L7 13",
		key: "orapub"
	}],
	["path", {
		d: "m8 6 2-2",
		key: "115y1s"
	}],
	["path", {
		d: "m18 16 2-2",
		key: "ee94s4"
	}],
	["path", {
		d: "m17 11 4.3 4.3c.94.94.94 2.46 0 3.4l-2.6 2.6c-.94.94-2.46.94-3.4 0L11 17",
		key: "cfq27r"
	}],
	["path", {
		d: "M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z",
		key: "1a8usu"
	}],
	["path", {
		d: "m15 5 4 4",
		key: "1mk7zo"
	}]
]);
/**
* @license lucide-react v1.25.0 - ISC
*
* This source code is licensed under the ISC license.
* See the LICENSE file in the root directory of this source tree.
*/
var Settings = createLucideIcon("settings", [["path", {
	d: "M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915",
	key: "1i5ecw"
}], ["circle", {
	cx: "12",
	cy: "12",
	r: "3",
	key: "1v7zrd"
}]]);
/**
* @license lucide-react v1.25.0 - ISC
*
* This source code is licensed under the ISC license.
* See the LICENSE file in the root directory of this source tree.
*/
var Sun = createLucideIcon("sun", [
	["circle", {
		cx: "12",
		cy: "12",
		r: "4",
		key: "4exip2"
	}],
	["path", {
		d: "M12 2v2",
		key: "tus03m"
	}],
	["path", {
		d: "M12 20v2",
		key: "1lh1kg"
	}],
	["path", {
		d: "m4.93 4.93 1.41 1.41",
		key: "149t6j"
	}],
	["path", {
		d: "m17.66 17.66 1.41 1.41",
		key: "ptbguv"
	}],
	["path", {
		d: "M2 12h2",
		key: "1t8f8n"
	}],
	["path", {
		d: "M20 12h2",
		key: "1q8mjw"
	}],
	["path", {
		d: "m6.34 17.66-1.41 1.41",
		key: "1m8zz5"
	}],
	["path", {
		d: "m19.07 4.93-1.41 1.41",
		key: "1shlcs"
	}]
]);
/**
* @license lucide-react v1.25.0 - ISC
*
* This source code is licensed under the ISC license.
* See the LICENSE file in the root directory of this source tree.
*/
var Workflow = createLucideIcon("workflow", [
	["rect", {
		width: "8",
		height: "8",
		x: "3",
		y: "3",
		rx: "2",
		key: "by2w9f"
	}],
	["path", {
		d: "M7 11v4a2 2 0 0 0 2 2h4",
		key: "xkn7yn"
	}],
	["rect", {
		width: "8",
		height: "8",
		x: "13",
		y: "13",
		rx: "2",
		key: "1cgmvn"
	}]
]);
//#endregion
//#region src/config/moduleRegistry.ts
var MODULE_GROUPS = [
	{
		key: "today",
		title: "오늘",
		accent: "overview"
	},
	{
		key: "clients",
		title: "고객",
		accent: "ops"
	},
	{
		key: "consulting",
		title: "컨설팅",
		accent: "ai"
	},
	{
		key: "calendar",
		title: "일정",
		accent: "evidence"
	},
	{
		key: "funding",
		title: "자금·지원",
		accent: "revenue"
	},
	{
		key: "journal",
		title: "업무 일기",
		accent: "customer"
	},
	{
		key: "studio",
		title: "AX STUDIO",
		accent: "ai",
		collapsible: true,
		defaultCollapsed: true
	},
	{
		key: "about",
		title: "이 시스템",
		accent: "system",
		collapsible: true,
		defaultCollapsed: true
	},
	{
		key: "tools",
		title: "도구함",
		accent: "system"
	},
	{
		key: "settings",
		title: "설정",
		accent: "system"
	}
];
var MODULES = [
	{
		key: "today",
		label: "오늘",
		path: "/",
		icon: Sun,
		group: "today",
		accent: "overview",
		enabled: true,
		exact: true
	},
	{
		key: "client-ops",
		label: "고객 운영",
		path: "/ops/clients",
		icon: ListChecks,
		group: "clients",
		accent: "ops",
		enabled: true
	},
	{
		key: "inbox",
		label: "고객 이벤트함",
		path: "/ops/inbox",
		icon: Inbox,
		group: "clients",
		accent: "alert",
		enabled: true
	},
	{
		key: "consulting-studio",
		label: "컨설팅 작업실",
		path: "/studio",
		icon: Workflow,
		group: "consulting",
		accent: "ai",
		enabled: true,
		hint: "특허 · 벤처인증 · MVP 단계 관리"
	},
	{
		key: "calendar",
		label: "일정",
		path: "/ops/calendar",
		icon: CalendarDays,
		group: "calendar",
		accent: "evidence",
		enabled: true
	},
	{
		key: "funding",
		label: "자금·지원사업",
		path: "/funding",
		icon: Landmark,
		group: "funding",
		accent: "revenue",
		enabled: true
	},
	{
		key: "journal-today",
		label: "오늘 기록",
		path: "/journal",
		icon: NotebookPen,
		group: "journal",
		accent: "customer",
		enabled: true,
		exact: true
	},
	{
		key: "journal-week",
		label: "주간 돌아보기",
		path: "/journal/week",
		icon: NotebookPen,
		group: "journal",
		accent: "customer",
		enabled: true
	},
	{
		key: "journal-all",
		label: "전체 기록",
		path: "/journal/all",
		icon: NotebookPen,
		group: "journal",
		accent: "customer",
		enabled: true
	},
	{
		key: "diagnosis",
		label: "기업 진단",
		path: "/diagnosis",
		icon: ClipboardList,
		group: "studio",
		accent: "ai",
		enabled: true,
		hint: "진단 스튜디오"
	},
	{
		key: "selection",
		label: "만들 업무",
		path: "/selection",
		icon: Funnel,
		group: "studio",
		accent: "ai",
		enabled: true,
		hint: "과제 선별"
	},
	{
		key: "mvp-design",
		label: "AX 설계",
		path: "/mvp-design",
		icon: PencilRuler,
		group: "studio",
		accent: "ai",
		enabled: true,
		hint: "MVP 설계"
	},
	{
		key: "website-studio",
		label: "홈페이지 설계",
		path: "/website-studio",
		icon: Palette,
		group: "studio",
		accent: "ai",
		enabled: true
	},
	{
		key: "validation",
		label: "검증",
		path: "/validation",
		icon: FlaskConical,
		group: "studio",
		accent: "ai",
		enabled: true,
		hint: "현장 검증"
	},
	{
		key: "deliverables",
		label: "결과자료",
		path: "/deliverables",
		icon: FileCheckCorner,
		group: "studio",
		accent: "ai",
		enabled: true
	},
	{
		key: "institutions",
		label: "기관 전략",
		path: "/funding/catalog",
		icon: Landmark,
		group: "studio",
		accent: "ai",
		enabled: true,
		hint: "기관·프로그램 목록"
	},
	{
		key: "cases",
		label: "사례",
		path: "/cases",
		icon: Library,
		group: "studio",
		accent: "ai",
		enabled: true
	},
	{
		key: "clients",
		label: "고객사·프로젝트",
		path: "/clients",
		icon: Building2,
		group: "studio",
		accent: "ai",
		enabled: true,
		hint: "AX 프로젝트 단위 관리"
	},
	{
		key: "why",
		label: "기획의도",
		path: "/why",
		icon: BookOpenText,
		group: "about",
		accent: "system",
		enabled: true,
		hint: "이 시스템을 왜 만들었는가"
	},
	{
		key: "kpi",
		label: "성과 지표",
		path: "/kpi",
		icon: Gauge,
		group: "about",
		accent: "system",
		enabled: true,
		hint: "돈·시간·규모·사용 지표"
	},
	{
		key: "roadmap",
		label: "향후 확장",
		path: "/roadmap",
		icon: Compass,
		group: "about",
		accent: "system",
		enabled: true,
		status: "next",
		hint: "아직 없는 기능과 계획"
	},
	{
		key: "tools",
		label: "전체 기능",
		path: "/tools",
		icon: LayoutGrid,
		group: "tools",
		accent: "system",
		enabled: true
	},
	{
		key: "settings",
		label: "설정",
		path: "/settings",
		icon: Settings,
		group: "settings",
		accent: "system",
		enabled: true
	}
];
/** 경로에 해당하는 모듈 — 가장 긴 접두가 일치하는 것을 고른다 */
function moduleForPath(pathname) {
	let best = null;
	for (const m of MODULES) {
		if (!m.enabled) continue;
		if ((m.exact ? pathname === m.path : pathname === m.path || pathname.startsWith(`${m.path}/`)) && (best === null || m.path.length > best.path.length)) best = m;
	}
	return best;
}
/**
* 화면이 실제로 쓰는 업무 목록 = 기본 6종 + 대표가 직접 만든 항목.
*
* 배열 자체를 통째로 갈아 끼우지 않고 내용만 바꾼다 — 여러 파일이 이 배열을
* 그대로 import 해서 그릴 때마다 훑기 때문이다.
*/
var SERVICES = [...[
	{
		key: "incorporation",
		label: "법인설립",
		shortLabel: "법인설립",
		description: "개인사업자이거나 법인이 없는 경우에만 진행합니다. 이미 법인이면 \"해당 없음\"으로 두세요.",
		requiredDocuments: [
			"representativeId",
			"representativePhone",
			"businessAddress"
		],
		recurring: false,
		order: 1,
		accent: "neutral"
	},
	{
		key: "businessScope",
		label: "업종 추가 · 목적사항 추가",
		shortLabel: "업종·목적",
		description: "사업자등록증에 업종을 추가하고, 법인등기부등본 목적사항에 해당 사업을 넣습니다. 특허·벤처인증·정책자금의 사전 요건이 되는 경우가 많습니다.",
		requiredDocuments: [
			"businessRegistration",
			"corporateRegistry",
			"jointCertificate"
		],
		recurring: false,
		order: 2,
		accent: "doc"
	},
	{
		key: "patent",
		label: "특허 출원",
		shortLabel: "특허",
		description: "발명 내용을 정리하고 선행기술을 검토한 뒤 출원합니다. 벤처인증 혁신성장유형의 근거가 됩니다.",
		requiredDocuments: ["businessRegistration", "representativeId"],
		recurring: false,
		order: 3,
		accent: "plan"
	},
	{
		key: "venture",
		label: "벤처인증 (혁신성장유형)",
		shortLabel: "벤처인증",
		description: "기술의 혁신성·사업성 평가를 거쳐 벤처기업 확인을 받습니다. 정책자금 조건이 크게 좋아집니다.",
		requiredDocuments: [
			"businessRegistration",
			"corporateRegistry",
			"smeCertificate",
			"representativeId"
		],
		recurring: false,
		order: 4,
		accent: "money"
	},
	{
		key: "ax",
		label: "AX 기획 및 개발",
		shortLabel: "AX 개발",
		description: "기업 진단 → 먼저 만들 업무 선택 → 기능·화면 설계 → 결과자료까지 진행합니다. 결과물이 정책자금 신청의 사업계획 근거가 됩니다.",
		requiredDocuments: ["businessRegistration"],
		recurring: false,
		order: 5,
		accent: "client"
	},
	{
		key: "policyFund",
		label: "정책자금 · 정부지원금",
		shortLabel: "정책자금",
		description: "앞 단계 결과물을 근거로 주기적으로 신청합니다. 공고 시기마다 반복되므로 마감일을 계속 갱신하며 관리하세요.",
		requiredDocuments: [
			"businessRegistration",
			"corporateRegistry",
			"smeCertificate",
			"healthInsurance",
			"jointCertificate",
			"corporateNumber"
		],
		recurring: true,
		order: 6,
		accent: "fund"
	}
]];
SERVICES.map((s) => s.key);
/**
* 저장된 상태를 현재 6단계로 옮긴다.
* 예전 8단계 데이터를 고쳐 쓰지 않고, 읽을 때마다 여기서 변환한다.
*
* 예전에 '해당 없음' 으로 저장해 둔 값은 한동안 보류로 보여 주고 있었는데,
* 이제 원래 뜻대로 되돌린다(저장된 글자는 처음부터 그대로였다).
*/
function normalizeServiceStatus(value) {
	switch (value) {
		case "preparing":
		case "submitted": return "in_progress";
		case "not_started":
		case "in_progress":
		case "waiting_client":
		case "done":
		case "on_hold":
		case "not_applicable": return value;
		default: return "not_started";
	}
}
var DOCUMENTS = [
	{
		key: "businessRegistration",
		label: "사업자등록증",
		validMonths: null,
		needsFile: true,
		sensitive: false,
		hint: "업종 추가 등으로 내용이 바뀌면 새로 받아 두세요."
	},
	{
		key: "corporateRegistry",
		label: "법인등기부등본",
		validMonths: 3,
		needsFile: true,
		sensitive: false,
		hint: "대부분의 기관이 3개월 이내 발급본을 요구합니다."
	},
	{
		key: "representativeId",
		label: "대표자 신분증 사본",
		validMonths: null,
		needsFile: true,
		sensitive: true,
		hint: "주민등록번호 뒷자리는 가린 사본을 받아 두세요."
	},
	{
		key: "representativePhone",
		label: "대표자 휴대폰번호",
		validMonths: null,
		needsFile: false,
		sensitive: false,
		hint: "본인인증·서류 발급 때 계속 필요합니다."
	},
	{
		key: "businessNumber",
		label: "사업자등록번호",
		validMonths: null,
		needsFile: false,
		sensitive: false,
		hint: "000-00-00000 형식으로 적어 두세요."
	},
	{
		key: "corporateNumber",
		label: "법인번호",
		validMonths: null,
		needsFile: false,
		sensitive: false,
		hint: "법인등기부등본 상단에서 확인할 수 있습니다."
	},
	{
		key: "jointCertificate",
		label: "공동인증서 전달",
		validMonths: 12,
		needsFile: false,
		sensitive: true,
		hint: "비밀번호는 이 시스템에 저장하지 마세요. 보관 위치만 메모에 적습니다."
	},
	{
		key: "businessAddress",
		label: "사업장 주소",
		validMonths: null,
		needsFile: false,
		sensitive: false,
		hint: "등기부상 주소와 실제 사업장이 다르면 함께 적어 두세요."
	},
	{
		key: "smeCertificate",
		label: "중소기업 확인서",
		validMonths: 12,
		needsFile: true,
		sensitive: false,
		hint: "매년 갱신됩니다. 만료되면 벤처인증·정책자금 신청이 막힙니다."
	},
	{
		key: "healthInsurance",
		label: "대표자 건강보험 득실확인서",
		validMonths: 3,
		needsFile: true,
		sensitive: true,
		hint: "정책자금 신청 시 최근 발급본을 요구하는 경우가 많습니다."
	}
];
DOCUMENTS.map((d) => d.key);
var FEE_KIND_LABEL = {
	deposit: "계약금",
	interim: "중도금",
	success: "성공보수"
};
//#endregion
//#region src/types/clientOps.ts
/** 대표가 직접 만든 항목인지 */
function isCustomServiceKey(key) {
	return key.startsWith("custom_");
}
//#endregion
//#region src/services/clientOpsService.ts
function defaultService() {
	return {
		status: "not_started",
		dueDate: "",
		nextStep: "",
		note: "",
		startedAt: null,
		completedAt: null,
		waitingSince: null
	};
}
function defaultServices() {
	return Object.fromEntries(SERVICES.map((s) => [s.key, defaultService()]));
}
function defaultDocument() {
	return {
		received: false,
		issuedAt: "",
		fileName: "",
		fileSize: 0,
		storagePath: "",
		note: "",
		updatedAt: null
	};
}
function defaultDocuments() {
	return Object.fromEntries(DOCUMENTS.map((d) => [d.key, defaultDocument()]));
}
function upgradeServices(raw) {
	const base = defaultServices();
	if (raw.services && typeof raw.services === "object") {
		const stored = raw.services;
		const keys = /* @__PURE__ */ new Set([...SERVICES.map((s) => s.key), ...Object.keys(stored).filter(isCustomServiceKey)]);
		for (const key of keys) {
			const v = stored[key];
			base[key] ??= defaultService();
			if (!v) continue;
			base[key] = {
				...base[key],
				...v,
				status: normalizeServiceStatus(v.status)
			};
		}
		return base;
	}
	if (raw.tasks && typeof raw.tasks === "object") for (const s of SERVICES) {
		const legacy = raw.tasks[s.key];
		if (!legacy) continue;
		base[s.key] = {
			...base[s.key],
			status: legacy.completed ? "done" : "not_started",
			dueDate: typeof legacy.dueDate === "string" ? legacy.dueDate : "",
			note: typeof legacy.note === "string" ? legacy.note : "",
			completedAt: legacy.completed ? nowIso() : null
		};
	}
	const fundingText = [raw.fundingStatus, raw.fundingNote].filter(Boolean).join(" / ").trim();
	if (fundingText) base.policyFund = {
		...base.policyFund,
		status: base.policyFund.status === "not_started" ? "in_progress" : base.policyFund.status,
		note: [base.policyFund.note, fundingText].filter(Boolean).join("\n")
	};
	return base;
}
function upgradeFees(raw) {
	if (Array.isArray(raw.fees)) return raw.fees.map((f) => ({
		id: f.id ?? generateId(),
		serviceKey: f.serviceKey ?? null,
		kind: f.kind ?? "deposit",
		label: f.label ?? FEE_KIND_LABEL[f.kind ?? "deposit"],
		amount: typeof f.amount === "number" ? f.amount : null,
		dueDate: typeof f.dueDate === "string" ? f.dueDate : "",
		receivedAt: typeof f.receivedAt === "string" ? f.receivedAt : null,
		note: f.note ?? ""
	}));
	const out = [];
	const today = nowIso().slice(0, 10);
	if (raw.contractDepositAmount != null || raw.contractDepositReceived) out.push({
		id: "legacy-deposit",
		serviceKey: null,
		kind: "deposit",
		label: "계약금",
		amount: raw.contractDepositAmount ?? null,
		dueDate: "",
		receivedAt: raw.contractDepositReceived ? today : null,
		note: ""
	});
	if (raw.successFeeAmount != null || raw.successFeeReceived) out.push({
		id: "legacy-success",
		serviceKey: null,
		kind: "success",
		label: "성공보수",
		amount: raw.successFeeAmount ?? null,
		dueDate: "",
		receivedAt: raw.successFeeReceived ? today : null,
		note: ""
	});
	return out;
}
function normalizeClientOps(value) {
	const now = nowIso();
	const documents = defaultDocuments();
	if (value.documents && typeof value.documents === "object") for (const d of DOCUMENTS) {
		const v = value.documents[d.key];
		if (!v) continue;
		documents[d.key] = {
			...documents[d.key],
			...v
		};
	}
	return {
		id: value.id ?? generateId(),
		workspaceId: value.workspaceId ?? null,
		companyName: value.companyName ?? "",
		contactName: value.contactName ?? "",
		contactPhone: value.contactPhone ?? "",
		contactEmail: value.contactEmail ?? "",
		businessNumber: value.businessNumber ?? "",
		corporateNumber: value.corporateNumber ?? "",
		businessAddress: value.businessAddress ?? "",
		industry: value.industry ?? "",
		representativeName: value.representativeName ?? "",
		representativeBirth: value.representativeBirth ?? "",
		employeeCount: value.employeeCount ?? "",
		shareholders: value.shareholders ?? "",
		establishedAt: value.establishedAt ?? "",
		businessCategory: value.businessCategory ?? "",
		businessItem: value.businessItem ?? "",
		businessItemsExtra: value.businessItemsExtra ?? "",
		contactTitle: value.contactTitle ?? "",
		companyPhone: value.companyPhone ?? "",
		homepage: value.homepage ?? "",
		status: value.status ?? "active",
		nextAction: value.nextAction ?? "",
		nextActionDueDate: value.nextActionDueDate ?? "",
		notes: value.notes ?? "",
		services: upgradeServices(value),
		documents,
		fees: upgradeFees(value),
		notes_list: Array.isArray(value.notes_list) ? value.notes_list.map((n) => ({
			id: n.id ?? generateId(),
			text: typeof n.text === "string" ? n.text : "",
			pinned: n.pinned === true,
			createdAt: n.createdAt ?? now,
			updatedAt: n.updatedAt ?? now
		})) : [],
		fundingApplications: Array.isArray(value.fundingApplications) ? value.fundingApplications.map((a) => ({
			id: a.id ?? generateId(),
			programName: a.programName ?? "",
			institution: a.institution ?? "",
			status: a.status ?? "watching",
			applyDueDate: a.applyDueDate ?? "",
			submittedAt: a.submittedAt ?? null,
			resultAt: a.resultAt ?? null,
			requestedAmount: typeof a.requestedAmount === "number" ? a.requestedAmount : null,
			approvedAmount: typeof a.approvedAmount === "number" ? a.approvedAmount : null,
			note: a.note ?? "",
			createdAt: a.createdAt ?? now,
			updatedAt: a.updatedAt ?? now
		})) : [],
		activity: Array.isArray(value.activity) ? value.activity.filter((a) => a && typeof a.text === "string" && typeof a.at === "string").map((a) => ({
			id: a.id ?? generateId(),
			kind: a.kind ?? "profile",
			text: a.text,
			serviceKey: a.serviceKey ?? null,
			at: a.at
		})).slice(0, 200) : [],
		archivedAt: typeof value.archivedAt === "string" ? value.archivedAt : null,
		createdAt: value.createdAt ?? now,
		updatedAt: value.updatedAt ?? now
	};
}
//#endregion
//#region src/services/__tests__/consulting.test.ts
/**
* 컨설팅 워크플로 엔진 · 계약 테스트
*  - 단계 정의 S0~S16 · 사실표 스키마 · 핵심 줄기 경고 · 게이트 · 다음 행동 결정성
*  - 프롬프트 꾸러미 결정성(같은 입력 → 같은 출력) · 개인정보 필터 · 결과 들여오기
*  - KIPO 118종 · 금지어 · 저장 모델 정규화 · 모듈 레지스트리 항목
* 실행: npm run test:consulting
*/
var passed = 0;
var failed = 0;
function check(name, cond, detail) {
	if (cond) passed += 1;
	else {
		failed += 1;
		console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
	}
}
var TODAY = "2026-09-08";
var NOW = "2026-09-08T09:00:00.000Z";
function project(p = {}) {
	return normalizeProject({
		id: "p1",
		clientId: "c1",
		clientName: "한솔테크",
		title: "특허·벤처",
		createdAt: NOW,
		updatedAt: NOW,
		...p
	});
}
function client(p = {}) {
	return normalizeClientOps({
		id: "c1",
		companyName: "한솔테크",
		representativeName: "김대표",
		establishedAt: "2019-03-02",
		businessAddress: "경기도 남양주시 진접읍 1",
		businessNumber: "123-45-67890",
		corporateNumber: "110111-1234567",
		businessCategory: "제조업",
		businessItem: "간판",
		employeeCount: "7",
		...p
	});
}
check("stages: S0~S16 17개", STAGES.length === 17 && STAGE_ORDER[0] === "S0" && STAGE_ORDER[16] === "S16");
check("stages: 키 중복 없음", new Set(STAGE_ORDER).size === 17);
check("stages: 다섯 묶음 순서", stagesByGroup().map((g) => g.group).join() === "understand,patent,mvp,venture,submit");
check("stages: 특허 묶음 = S3~S7", stagesByGroup()[1].stages.map((s) => s.key).join() === "S3,S4,S5,S6,S7");
check("stages: 모든 단계에 목적·exit checklist", STAGES.every((s) => s.purpose.length > 10 && s.exitChecklist.length >= 2));
check("stages: next/prev", nextStageKey("S0") === "S1" && nextStageKey("S16") === null && prevStageKey("S0") === null && prevStageKey("S9") === "S8");
check("stages: 특허 단계는 건너뛸 수 있고 MVP 잠금은 못 건너뛴다", stageDef("S3").skippable && !stageDef("S8").skippable);
check("stages: 필요 사실 키가 모두 스키마에 있다", STAGES.every((s) => s.requiredFacts.every((k) => FACTS.some((f) => f.key === k))));
check("stages: 프롬프트 종류가 정의된 것만", STAGES.every((s) => s.promptTypes.every((t) => PROMPT_TYPES.includes(t))));
check("facts: 45항목 · 7묶음", FACTS.length === 45 && new Set(FACTS.map((f) => f.section)).size === 7);
check("facts: 키 중복 없음", new Set(FACTS.map((f) => f.key)).size === FACTS.length);
check("facts: 주민번호·비밀번호·계좌 항목이 없다", !FACTS.some((f) => /주민|비밀번호|계좌|password/i.test(f.label + f.key)));
{
	const seeded = seedFactsFromClient({}, client(), NOW);
	check("facts: 고객 기록에서 회사 기본값을 가져온다", seeded.companyName?.value === "한솔테크" && seeded.representative?.value === "김대표" && seeded.employees?.value === "7");
	check("facts: 가져온 값은 미확인 · 출처 표시", seeded.companyName?.status === "unverified" && seeded.companyName?.source === "고객 운영 기록");
	check("facts: 업태·종목을 합쳐 업종으로", seeded.industry?.value === "제조업 · 간판");
	check("facts: 이미 있는 값은 덮지 않는다", seedFactsFromClient({ companyName: {
		value: "이미 확정",
		status: "confirmed",
		source: "등기",
		asOfDate: "",
		note: "",
		updatedAt: null
	} }, client(), NOW).companyName?.value === "이미 확정");
	const c = factCompleteness(seeded);
	check("facts: 완성도 계산", c.total === 45 && c.filled === 8 && c.bySection.company.filled === 7);
	check("facts: 빈 필수 항목", missingFacts(seeded, ["companyName", "coreProblem"]).join() === "coreProblem");
	const text = factsheetToText(seeded);
	check("facts: 텍스트에 묶음 제목과 상태", text.includes("[회사 기본]") && text.includes("회사명: 한솔테크 (미확인"));
}
check("thread: 8칸", CORE_THREAD_KEYS.length === 8);
check("thread: 낱말 겹침 — 작업지연 위험분석 vs 작업지연 위험도 예측", sharedWords("작업지연 위험분석 시스템", "작업지연 위험도를 예측한다").length > 0);
check("thread: 낱말 겹침 없음 — 예약 플랫폼 vs 재고 최적화", sharedWords("고객 예약 플랫폼", "재고 최적화").length === 0);
{
	const p = project({ coreThread: {
		fieldProblem: "x",
		existingMethod: "y",
		coreTech: "작업지연 위험분석",
		patentPoint: "고객 예약 플랫폼",
		axCore: "재고 최적화",
		platformSurface: "",
		ventureSentence: "",
		keyEvidence: ""
	} });
	check("thread: 다른 기술로 읽히면 p1 두 건", coreThreadWarnings(p).filter((x) => x.severity === "p1" && x.code.startsWith("thread_drift")).length === 2);
	const ok = project({ coreThread: {
		...p.coreThread,
		patentPoint: "작업지연 위험 산출 순서",
		axCore: "작업지연 위험 점수"
	} });
	check("thread: 같은 낱말이면 경고 없음", coreThreadWarnings(ok).filter((x) => x.code.startsWith("thread_drift")).length === 0);
	const reg = project({ coreThread: {
		...ok.coreThread,
		ventureSentence: "당사는 특허 등록 완료한 작업지연 기술로…"
	} });
	check("thread: 출원 상태에서 \"등록\" 은 p0", coreThreadWarnings(reg).some((x) => x.code === "patent_registered_wording" && x.severity === "p0"));
	check("thread: 실제 등록이면 경고 없음", !coreThreadWarnings(project({
		...reg,
		patent: {
			...reg.patent,
			filingStatus: "registered"
		}
	})).some((x) => x.code === "patent_registered_wording"));
	check("thread: Rule 인데 AI 라 부르면 p1", coreThreadWarnings(project({
		coreThread: {
			...ok.coreThread,
			axCore: "AI가 작업지연을 판단"
		},
		mvp: {
			...ok.mvp,
			axMode: "rule"
		}
	})).some((x) => x.code === "ax_called_ai"));
	check("thread: 시연용 숫자를 외우게 하면 p0", coreThreadWarnings(project({
		factsheet: { som: {
			value: "300억",
			status: "demo",
			source: "",
			asOfDate: "",
			note: "",
			updatedAt: null
		} },
		fieldReview: {
			...ok.fieldReview,
			numbersToMemorize: ["som"]
		}
	})).some((x) => x.code.startsWith("demo_number_memorized") && x.severity === "p0"));
}
{
	const base = project();
	const ctx = {
		artifacts: [],
		evidence: [],
		today: TODAY
	};
	const s0 = canCompleteStage(base, "S0", ctx);
	check("gate: S0 는 회사 기본 사실이 없으면 막힌다", !s0.ok && s0.blockers[0].includes("사실표"));
	const seeded = project({ factsheet: seedFactsFromClient({}, client(), NOW) });
	const s0b = canCompleteStage(seeded, "S0", { ...ctx });
	check("gate: 회사 기본 8항목 중 주요제품이 비어 있으면 아직 막힘", !s0b.ok && s0b.blockers[0].includes("주요 제품"));
	check("gate: S1 은 결정이 없으면 막힌다", canCompleteStage(seeded, "S1", ctx).blockers.some((b) => b.includes("GO / HOLD / NO-GO")));
	check("gate: GO 체크 수", gateCheckedCount(project({ gate: {
		items: {
			knowsProblem: true,
			mvpShowable: true
		},
		decision: null,
		reason: "",
		decidedAt: null
	} })) === 2);
	check("gate: S3 는 산출물(PATENT_IDEA)이 없으면 막힌다", canCompleteStage(project({ factsheet: { coreTech: {
		value: "x",
		status: "confirmed",
		source: "",
		asOfDate: "",
		note: "",
		updatedAt: null
	} } }), "S3", ctx).blockers.some((b) => b.includes("PATENT_IDEA")));
	const art = {
		id: "a1",
		workspaceId: null,
		projectId: "p1",
		type: "PATENT_IDEA",
		title: "t",
		stageKey: "S3",
		version: 1,
		status: "draft",
		content: "c",
		source: "llm_paste",
		promptPackageId: null,
		fileName: "",
		createdAt: NOW,
		updatedAt: NOW
	};
	const s3ok = canCompleteStage(project({ factsheet: { coreTech: {
		value: "x",
		status: "confirmed",
		source: "",
		asOfDate: "",
		note: "",
		updatedAt: null
	} } }), "S3", {
		...ctx,
		artifacts: [art]
	});
	check("gate: 산출물이 있으면 S3 통과", s3ok.ok, s3ok.blockers.join(" | "));
	check("gate: 대체된 산출물은 세지 않는다", !canCompleteStage(project({ factsheet: { coreTech: {
		value: "x",
		status: "confirmed",
		source: "",
		asOfDate: "",
		note: "",
		updatedAt: null
	} } }), "S3", {
		...ctx,
		artifacts: [{
			...art,
			status: "superseded"
		}]
	}).ok);
	check("gate: S7 은 최신 기준 확인이 없으면 막힌다 (K9)", canCompleteStage(project({
		patent: {
			...base.patent,
			filingStatus: "filed",
			applicationNumber: "10-2026-0001",
			filedAt: "2026-09-01"
		},
		factsheet: { patent: {
			value: "출원 중",
			status: "confirmed",
			source: "",
			asOfDate: "",
			note: "",
			updatedAt: null
		} }
	}), "S7", {
		...ctx,
		artifacts: [{
			...art,
			type: "PATENT_FILING_RECORD"
		}]
	}).blockers.some((b) => b.includes("최신 공식 기준")));
	const fresh = project({ freshness: [{
		scope: "patent_filing",
		checkedAt: "2026-08-20",
		source: "특허로",
		differences: ""
	}] });
	check("gate: 30일 이내 확인은 유효", freshnessOk(fresh, "patent_filing", TODAY) && !freshnessOk(fresh, "venture_application", TODAY));
	check("gate: 30일 지난 확인은 무효", !freshnessOk(project({ freshness: [{
		scope: "patent_filing",
		checkedAt: "2026-07-01",
		source: "특허로",
		differences: ""
	}] }), "patent_filing", TODAY));
	check("gate: S13 은 P0 12개 확인 없이는 막힌다", canCompleteStage(project(), "S13", {
		...ctx,
		artifacts: [{
			...art,
			type: "QA_REPORT"
		}]
	}).blockers.some((b) => b.includes("P0 Red Flag 미확인 12개")));
	check("gate: S12 는 빈 슬롯을 알려 준다", canCompleteStage(project(), "S12", {
		...ctx,
		artifacts: [{
			...art,
			type: "CLAIM_EVIDENCE_MATRIX"
		}]
	}).blockers.some((b) => b.includes("비어 있는 첨부 슬롯: 1, 2, 3")));
	check("skip: 이유 없이 못 건너뛴다", !canSkipStage("S3", "").ok && canSkipStage("S3", "이미 등록 특허 보유").ok);
	check("skip: 못 건너뛰는 단계", !canSkipStage("S8", "이유").ok);
}
{
	const ctx = {
		artifacts: [],
		prompts: [],
		evidence: [],
		today: TODAY
	};
	const p = project();
	const a = resolveNextActions(p, ctx);
	const b = resolveNextActions(p, ctx);
	check("next: 같은 입력 → 같은 출력", JSON.stringify(a) === JSON.stringify(b));
	check("next: 최대 3개", a.length <= 3 && a.length > 0);
	check("next: 빈 프로젝트의 첫 행동은 사실표 채우기", a[0].kind === "fill_fact" && a[0].tab === "factsheet");
	const stages = emptyStages();
	stages.S4 = {
		...stages.S4,
		status: "blocked",
		blockedBy: "KIPRIS 접속 불가"
	};
	const blocked = resolveNextActions(project({
		stages,
		currentStage: "S4"
	}), ctx);
	check("next: 막힘이 있으면 맨 앞", blocked[0].kind === "resolve_block" && blocked[0].why.includes("KIPRIS"));
	const s3 = project({
		currentStage: "S3",
		gate: {
			items: {},
			decision: "go",
			reason: "ok",
			decidedAt: NOW
		},
		factsheet: { coreTech: {
			value: "작업지연 위험분석",
			status: "confirmed",
			source: "",
			asOfDate: "",
			note: "",
			updatedAt: null
		} },
		coreThread: {
			fieldProblem: "a",
			existingMethod: "b",
			coreTech: "c",
			patentPoint: "",
			axCore: "",
			platformSurface: "",
			ventureSentence: "",
			keyEvidence: ""
		}
	});
	check("next: S3 에서 산출물이 없으면 프롬프트 만들기", resolveNextActions(s3, ctx).some((x) => x.kind === "generate_prompt" && x.focus === "PATENT_IDEA"));
	check("next: 프롬프트는 있고 결과가 없으면 들여오기", resolveNextActions(s3, {
		...ctx,
		prompts: [{
			id: "q",
			workspaceId: null,
			projectId: "p1",
			type: "PATENT_IDEA",
			target: "general",
			stageKey: "S3",
			title: "",
			prompt: "",
			context: "",
			privacy: {
				rrn: 0,
				account: 0,
				password: 0,
				secret: 0,
				email: 0,
				phone: 0,
				total: 0
			},
			section: null,
			createdAt: NOW
		}]
	}).some((x) => x.kind === "import_result" && x.focus === "PATENT_IDEA"));
	check("next: 게이트 미결이면 GO/HOLD 먼저", resolveNextActions(project({ currentStage: "S3" }), ctx)[0].kind === "answer_gate");
	check("next: 완료된 프로젝트는 행동 없음", resolveNextActions(project({ status: "done" }), ctx).length === 0);
	const st = emptyStages();
	st.S0.status = "completed";
	st.S1.status = "completed";
	st.S2.status = "skipped";
	check("next: 다음 미완료 단계", nextOpenStage(project({ stages: st }), "S0") === "S3");
}
{
	const p = project({
		factsheet: {
			...seedFactsFromClient({}, client(), NOW),
			coreTech: {
				value: "작업지연 위험분석",
				status: "confirmed",
				source: "인터뷰",
				asOfDate: "2026-09-01",
				note: "",
				updatedAt: NOW
			},
			som: {
				value: "300억원",
				status: "planned",
				source: "통계청",
				asOfDate: "2025",
				note: "2,800개 × 3% × 360만원",
				updatedAt: NOW
			}
		},
		coreThread: {
			fieldProblem: "납기 지연",
			existingMethod: "엑셀",
			coreTech: "작업지연 위험분석",
			patentPoint: "위험 산출 순서",
			axCore: "위험 점수",
			platformSurface: "거래처 포털",
			ventureSentence: "작업지연 위험분석 기반 …",
			keyEvidence: "MVP 화면"
		}
	});
	for (const type of PROMPT_TYPES) {
		const x = buildPromptPackage({
			project: p,
			type,
			target: "general",
			section: 4,
			slot: 6
		});
		const y = buildPromptPackage({
			project: p,
			type,
			target: "general",
			section: 4,
			slot: 6
		});
		check(`prompt ${type}: 결정성`, x.prompt === y.prompt && x.context === y.context);
		check(`prompt ${type}: 머리줄 요구`, x.prompt.includes(`[ARTIFACT] type=${artifactTypeForPrompt(type)} stage=${PROMPT_DEFAULT_STAGE[type]}`));
		check(`prompt ${type}: 크기 상한 (Master 통째로 넣지 않음)`, x.prompt.length < 9e3, String(x.prompt.length));
		check(`prompt ${type}: 항상 지킬 것 포함`, x.prompt.includes("특허출원 중") && x.prompt.includes("AI"));
	}
	const g = buildPromptPackage({
		project: p,
		type: "PATENT_IDEA",
		target: "general"
	});
	check("prompt: 사실표 발췌에 상태·출처", g.prompt.includes("핵심 해결기술: 작업지연 위험분석 (확정 · 2026-09-01 · 출처: 인터뷰)"));
	check("prompt: PATENT_IDEA 는 시장 숫자를 싣지 않는다 (SCOPED)", !g.prompt.includes("SOM: 300억원"));
	check("prompt: Context 에는 사실표 전체", g.context.includes("SOM: 300억원") && g.context.includes("산식/비고: 2,800개"));
	const v4 = buildPromptPackage({
		project: p,
		type: "VENTURE_PLAN_SECTION",
		target: "chatgpt",
		section: 4
	});
	check("prompt: 사업계획서 4 = 목표시장", v4.title.includes("4. 목표시장") && v4.prompt.includes("TAM(전체 잠재)") && v4.section === 4);
	check("prompt: Claude Code 대상은 세션 안내로 시작", buildPromptPackage({
		project: p,
		type: "MVP_CLAUDE_CODE_BUILD",
		target: "claude_code"
	}).prompt.startsWith("[이 프롬프트는 Claude Code"));
	check("prompt: 개인정보 없음이면 가림 0", g.privacy.total === 0);
	const lp = buildPromptPackage({
		project: project({ factsheet: { ceoCareer: {
			value: "주민 900101-1234567, 계좌번호 110-123-456789, 비밀번호: abcd1234, 연락 010-1234-5678, kim@example.com, key sk-abcdefghijklmnop",
			status: "confirmed",
			source: "",
			asOfDate: "",
			note: "",
			updatedAt: null
		} } }),
		type: "GENERAL_PROJECT_REVIEW",
		target: "general"
	});
	check("privacy: 주민번호가 나가지 않는다", !lp.prompt.includes("900101-1234567") && !lp.context.includes("900101-1234567"));
	check("privacy: 계좌·비밀번호·휴대폰·이메일·API키 가림", !/110-123-456789|abcd1234|010-1234-5678|kim@example\.com|sk-abcdefghijklmnop/.test(lp.prompt + lp.context));
	check("privacy: 보고서 합계 (본문+맥락)", lp.privacy.rrn >= 1 && lp.privacy.account >= 1 && lp.privacy.password >= 1 && lp.privacy.phone >= 1 && lp.privacy.email >= 1 && lp.privacy.secret >= 1);
	const r = redactSensitive("사업자등록번호 123-45-67890 은 그대로, 법인 110111-1234567 도 그대로");
	check("privacy: 사업자·법인번호는 가리지 않는다", r.report.total === 0 && r.text.includes("123-45-67890") && r.text.includes("110111-1234567"));
	const r2 = redactSensitive("인증서 비밀번호 Qwer!234 를 전달");
	check("privacy: 인증서 비밀번호 값만 가림", r2.text.includes("[가림:비밀번호]") && !r2.text.includes("Qwer!234"));
	check("privacy: JWT 형태 비밀 가림", !redactSensitive("service_role=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.abcdefghijklmnopqrstuvwxyz").text.includes("eyJhbGci"));
}
{
	const parsed = parsePastedResult(`${artifactHeaderLine("PATENT_IDEA", "S3", "특허 아이디어 \"1차\"")}\n\n# 결과\n본문`);
	check("import: 머리줄 인식", parsed.hadHeader && parsed.type === "PATENT_IDEA" && parsed.stage === "S3" && parsed.title === "특허 아이디어 '1차'");
	check("import: 본문에서 머리줄 제거", parsed.body.startsWith("# 결과"));
	const noHead = parsePastedResult("## 선행기술 검토 결과\n내용");
	check("import: 머리줄 없으면 제목만 추출", !noHead.hadHeader && noHead.type === null && noHead.title === "선행기술 검토 결과");
	const bad = parsePastedResult("[ARTIFACT] type=NOPE stage=S99\n본문");
	check("import: 모르는 종류·단계는 null", bad.hadHeader && bad.type === null && bad.stage === null);
	const arts = [
		{
			id: "1",
			workspaceId: null,
			projectId: "p1",
			type: "PATENT_IDEA",
			title: "",
			stageKey: "S3",
			version: 1,
			status: "superseded",
			content: "",
			source: "manual",
			promptPackageId: null,
			fileName: "",
			createdAt: NOW,
			updatedAt: NOW
		},
		{
			id: "2",
			workspaceId: null,
			projectId: "p1",
			type: "PATENT_IDEA",
			title: "",
			stageKey: "S3",
			version: 2,
			status: "draft",
			content: "",
			source: "manual",
			promptPackageId: null,
			fileName: "",
			createdAt: NOW,
			updatedAt: NOW
		},
		{
			id: "3",
			workspaceId: null,
			projectId: "p2",
			type: "PATENT_IDEA",
			title: "",
			stageKey: "S3",
			version: 7,
			status: "draft",
			content: "",
			source: "manual",
			promptPackageId: null,
			fileName: "",
			createdAt: NOW,
			updatedAt: NOW
		}
	];
	check("version: 같은 프로젝트·같은 종류에서만 +1", nextVersion(arts, "p1", "PATENT_IDEA") === 3 && nextVersion(arts, "p1", "MVP_SPEC") === 1);
}
check("kipo: 118종", KIPO_REFERENCES.length === 118 && new Set(KIPO_REFERENCES.map((r) => r.code)).size === 118);
check("kipo: 분야별 수 9/18/16/22/32/21", [
	"living",
	"digital",
	"electric",
	"chem",
	"mech",
	"semi"
].map((c) => KIPO_REFERENCES.filter((r) => r.category === c).length).join() === "9,18,16,22,32,21");
check("kipo: PDF 주소 규칙", kipoPdfUrl("0217") === "https://www.patent.go.kr/smart/jsp/kiponet/common/AllRouteDown.do?fn=example/02/0217&fh=pdf");
check("kipo: 검색 (머신 러닝)", searchKipo("머신 러닝").some((r) => r.code === "0304"));
check("kipo: 검색 분야 제한", searchKipo("", "semi").length === 21);
check("kipo: 1종은 부족", kipoSelectionIssues([{
	code: "0208",
	reason: "r",
	pdfAttached: true
}]).some((i) => i.includes("최소 2종")));
check("kipo: 6종은 초과", kipoSelectionIssues([
	"0208",
	"0217",
	"0304",
	"0306",
	"0201",
	"0202"
].map((c) => ({
	code: c,
	reason: "r",
	pdfAttached: true
}))).some((i) => i.includes("최대 5종")));
check("kipo: PDF 미첨부 안내", kipoSelectionIssues([{
	code: "0208",
	reason: "r",
	pdfAttached: false
}, {
	code: "0217",
	reason: "r",
	pdfAttached: true
}]).some((i) => i.includes("PDF")));
check("kipo: 2종 · 이유 · PDF 면 통과", kipoSelectionIssues([{
	code: "0208",
	reason: "r",
	pdfAttached: true
}, {
	code: "0217",
	reason: "r",
	pdfAttached: true
}]).length === 0);
check("qa: P0 12 · Judge 10 · 슬롯 10 · 항목 7", RED_FLAGS.length === 12 && JUDGE_AXES.length === 10 && EVIDENCE_SLOTS.length === 10 && PLAN_SECTIONS.length === 7);
check("qa: 금지어 탐지", findForbiddenPhrases("국내 최초로 특허 등록 완료한 유일한").length === 3);
check("qa: judge 합계는 10축 다 있어야", judgeTotal({ A: 9 }) === null && judgeTotal({
	A: 9,
	B: 9,
	C: 9,
	D: 9,
	E: 9,
	F: 9,
	G: 9,
	H: 9,
	I: 9,
	J: 9
}) === 90 && judgeVerdict(90) === "제출 권장" && judgeVerdict(69) === "HOLD 재검토");
{
	const raw = normalizeProject({
		id: "x",
		clientId: "c",
		createdAt: NOW,
		updatedAt: NOW,
		currentStage: "S99",
		stages: { S3: { status: "completed" } }
	});
	check("model: 잘못된 단계는 S0 로, 일부 단계만 있어도 17개 채움", raw.currentStage === "S0" && Object.keys(raw.stages).length === 17 && raw.stages.S3.status === "completed");
	check("model: 진행도", projectProgress(raw).done === 1 && projectProgress(raw).total === 17);
	check("model: 기본 제출서류 8종", Object.keys(raw.venture.documents).length === 8);
}
check("registry: 컨설팅 작업실 모듈이 /studio 로 켜져 있다", MODULES.some((m) => m.path === "/studio" && m.enabled));
check("registry: 그룹 정의", MODULE_GROUPS.some((g) => g.key === "consulting"));
check("registry: /studio/abc → 컨설팅 작업실", moduleForPath("/studio/abc")?.path === "/studio");
console.log(`\n컨설팅 엔진: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
//#endregion
