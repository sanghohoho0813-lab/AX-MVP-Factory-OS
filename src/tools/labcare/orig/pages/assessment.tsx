import { useMemo, useRef, useState } from "react";
import { useRouter } from "../nav";
import Layout from "../components/Layout";
import OsAttach from "../components/OsAttach";
import PageGuide from "../components/PageGuide";
import { downloadSvgAsJpeg, printSvg } from "../../lib/download";
import { addTempCompany } from "../lib/storage";
import { assessFeasibility, requiredForLab } from "../../lib/feasibility";
import type { FeasibilityResult } from "../../types";
import type {
  ActivityNature,
  ActivityVerdict,
  CandidateVerdict,
  CertLevel,
  CompanySize,
  EducationLevel,
  EligibilityVerdict,
  FacilityVerdict,
  FeasibilityVerdict,
  IndustryField,
  LabTypeChoice,
  MajorField,
  NegativeActivity,
  ResearcherCandidate,
} from "../../types";

/* ───────────────── 스타일 매핑 ───────────────── */

const VERDICT_STYLE: Record<FeasibilityVerdict, string> = {
  "기업부설연구소 가능": "bg-status-normalBg text-status-normal ring-green-200",
  "연구개발전담부서 우선 추천": "bg-indigo-50 text-indigo-700 ring-indigo-200",
  "보완 후 가능": "bg-amber-50 text-amber-700 ring-amber-200",
  "현재 진행 비추천": "bg-status-dangerBg text-status-danger ring-red-200",
  "추가 확인 필요": "bg-slate-100 text-slate-600 ring-slate-200",
};

const CAND_STYLE: Record<CandidateVerdict, string> = {
  "인정 가능": "bg-status-normalBg text-status-normal ring-green-200",
  "추가 확인 필요": "bg-amber-50 text-amber-700 ring-amber-200",
  "인정 어려움": "bg-status-dangerBg text-status-danger ring-red-200",
};

// 후보자 카드 상단 최종 판정 표시 라벨
const CAND_LABEL: Record<CandidateVerdict, string> = {
  "인정 가능": "가능성 높음",
  "추가 확인 필요": "추가 확인 필요",
  "인정 어려움": "부적합 가능성",
};

const CEO_STYLE: Record<string, string> = {
  "가능성 있음": "bg-status-normalBg text-status-normal ring-green-200",
  "추가 확인 필요": "bg-amber-50 text-amber-700 ring-amber-200",
  "인정 어려움": "bg-status-dangerBg text-status-danger ring-red-200",
  "해당 없음": "bg-white text-slate-500 ring-slate-200",
};

const SECTION_TONE: Record<string, string> = {
  // 신고대상
  "신고대상으로 보임": "bg-status-normalBg text-status-normal ring-green-200",
  "신고대상 부적합 가능성": "bg-status-dangerBg text-status-danger ring-red-200",
  // 활동
  "연구개발활동 적합": "bg-status-normalBg text-status-normal ring-green-200",
  "보완 필요": "bg-amber-50 text-amber-700 ring-amber-200",
  "부적합 가능성": "bg-status-dangerBg text-status-danger ring-red-200",
  // 물적
  "물적요건 충족": "bg-status-normalBg text-status-normal ring-green-200",
  "진행 어려움": "bg-status-dangerBg text-status-danger ring-red-200",
  // 공통
  "추가 확인 필요": "bg-amber-50 text-amber-700 ring-amber-200",
};

const EDU_OPTS: EducationLevel[] = [
  "박사",
  "석사",
  "학사",
  "전문학사(3년제)",
  "전문학사(2년제)",
  "마이스터고·특성화고 졸업",
  "고졸 이하",
];
const MAJOR_OPTS: MajorField[] = ["자연계열", "공학계열", "의약계열", "기타 이공계", "비이공계"];
const CERT_OPTS: CertLevel[] = ["기사 이상", "산업기사", "기능사", "없음"];
const SIZE_OPTS: CompanySize[] = ["소기업", "중기업", "중견기업", "대기업"];
const FIELD_OPTS: IndustryField[] = ["과학기술 분야", "서비스 분야", "산업디자인 분야"];
const NATURE_OPTS: ActivityNature[] = [
  "새로운 제품·공정·서비스 개발",
  "기존 제품·서비스의 기술적 개선",
  "애매함",
  "해당 없음",
];
const NEGATIVE_OPTS: NegativeActivity[] = [
  "단순 유지보수",
  "단순 기술지원",
  "일상적 품질관리",
  "시장조사·판촉활동",
  "일반 관리·경영개선",
  "단순 소프트웨어 개선",
  "보편화된 기술의 단순 활용",
  "수익 목적의 위탁연구 중심",
];

// 업종 대분류 → 분야 자동 추천 + 안내
interface IndustryCategory {
  label: string;
  field: IndustryField;
  hint?: string;
}
const INDUSTRY_CATEGORIES: IndustryCategory[] = [
  { label: "제조업", field: "과학기술 분야" },
  { label: "전기전자/기계부품", field: "과학기술 분야" },
  { label: "소프트웨어/정보서비스", field: "과학기술 분야" },
  { label: "도소매업", field: "서비스 분야", hint: "도소매업도 서비스 분야 연구개발전담부서 가능성이 있습니다. 주문·재고 연동, 서비스 전달체계 개선, PB상품 포장디자인 개선 등으로 과제를 설계할 수 있습니다." },
  { label: "디자인/포장디자인", field: "산업디자인 분야", hint: "산업디자인 분야는 '제품디자인'과 '포장디자인'에 한해 인정 가능합니다. 단순 외관·브랜딩·홍보 디자인은 제외됩니다." },
  { label: "음식/프랜차이즈", field: "서비스 분야", hint: "서비스 분야 — 표준 레시피·주방 공정·서비스 전달체계 개선 등으로 과제를 설계할 수 있습니다." },
  { label: "건설/인테리어", field: "서비스 분야" },
  { label: "전문서비스업", field: "서비스 분야" },
  { label: "기타 서비스업", field: "서비스 분야" },
];
// 명백한 제외 업종 (선택 시 경고)
const EXCLUDED_INDUSTRIES = ["유흥주점", "카지노/사행시설", "가상자산 매매중개", "기타 제외 업종"];

// 물적요건 비교 (연구소 / 전담부서)
const FACILITY_LAB = [
  "독립된 연구공간",
  "고정벽체 또는 별도 출입문",
  "전용 출입구 현판",
  "연구기자재 확보",
  "연구전담요원 상시 근무 가능",
  "타 부서와 명확히 구분되는 공간",
];
const FACILITY_DEPT = [
  "기업 내 하부조직으로 표시 가능",
  "연구전담요원 1명 이상",
  "연구개발 업무 전담 가능",
  "연구공간 또는 좌석 구분 가능",
  "연구기자재 확보",
  "도면·사진상 연구업무 공간 확인 가능",
  "타 업무 겸직 여부 확인",
];

let cidSeq = 0;
function newCandidate(): ResearcherCandidate {
  cidSeq += 1;
  return {
    id: `cand-${Date.now()}-${cidSeq}`,
    name: "",
    isCeo: false,
    isRegisteredExec: false,
    fullTime: true,
    insured: true,
    researchDedicated: true,
    hasOtherDuties: false,
    daytimeGradSchool: false,
    education: "학사",
    major: "공학계열",
    cert: "없음",
    researchYears: 0,
    dutyDescription: "",
  };
}

export default function AssessmentPage() {
  /* ① 설립 유형 */
  const [desiredType, setDesiredType] = useState<LabTypeChoice>("아직 모름");

  /* ② 기업 기본요건 */
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("");
  const [customIndustry, setCustomIndustry] = useState(false);
  const [industryField, setIndustryField] = useState<IndustryField>("과학기술 분야");
  const [isExcludedIndustry, setIsExcludedIndustry] = useState(false);
  const [companySize, setCompanySize] = useState<CompanySize>("소기업");
  const [isVenture, setIsVenture] = useState(false);
  const [isResearcherFounded, setIsResearcherFounded] = useState(false);
  const [years, setYears] = useState(3);
  const [becameMediumWithinYear, setBecameMediumWithinYear] = useState(false);
  const [employeeCount, setEmployeeCount] = useState(10);
  const [isOverseasLab, setIsOverseasLab] = useState(false);

  /* 신고대상 */
  const [isForProfit, setIsForProfit] = useState(true);
  const [hasBusinessOps, setHasBusinessOps] = useState(true);
  const [rndOnlyCompany, setRndOnlyCompany] = useState(false);
  const [isSubUnit, setIsSubUnit] = useState(true);

  /* ③ 연구개발활동 */
  const [projectName, setProjectName] = useState("");
  const [preCommercial, setPreCommercial] = useState(true);
  const [activityNature, setActivityNature] = useState<ActivityNature>(
    "새로운 제품·공정·서비스 개발",
  );
  const [negativeActivities, setNegativeActivities] = useState<NegativeActivity[]>([]);

  /* ④ 물적요건 */
  const [hasSpace] = useState(true);
  const [independentSpace, setIndependentSpace] = useState(true);
  const [fixedWallsAndDoor, setFixedWallsAndDoor] = useState(true);
  const [movableWallPossible, setMovableWallPossible] = useState(false);
  const [spaceUnder50] = useState(true);
  const [adequateArea, setAdequateArea] = useState(true);
  const [equipmentInSpace, setEquipmentInSpace] = useState(true);
  const [isInfoServiceOrSW, setIsInfoServiceOrSW] = useState(false);

  /* 연구전담요원 후보 수 (UI 추천용 — 1~5, 5는 5명 이상) */
  const [pick, setPick] = useState(1);

  /* ⑤ 후보자 */
  const [candidates, setCandidates] = useState<ResearcherCandidate[]>([newCandidate()]);

  /* 연구과제 추천 프롬프트 모달 */
  const [promptOpen, setPromptOpen] = useState(false);

  /* 결과 저장/출력 */
  const reportRef = useRef<SVGSVGElement>(null);
  const [saved, setSaved] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [sentMsg, setSentMsg] = useState<string | null>(null);
  const router = useRouter();

  const result = useMemo(
    () =>
      assessFeasibility({
        desiredType,
        companyName,
        industry,
        industryField,
        isExcludedIndustry,
        companySize,
        isVenture,
        isResearcherFounded,
        businessMonths: Math.round(years * 12),
        becameMediumWithinYear: companySize === "중기업" ? becameMediumWithinYear : false,
        employeeCount,
        isOverseasLab,
        isForProfit,
        hasBusinessOps,
        rndOnlyCompany,
        isSubUnit,
        projectName,
        preCommercial,
        activityNature,
        negativeActivities,
        hasSpace,
        independentSpace,
        fixedWallsAndDoor,
        movableWallPossible,
        spaceUnder50,
        adequateArea,
        equipmentInSpace,
        isInfoServiceOrSW,
        candidates,
      }),
    [
      desiredType, companyName, industry, industryField, isExcludedIndustry,
      companySize, isVenture, isResearcherFounded, years, becameMediumWithinYear,
      employeeCount, isOverseasLab, isForProfit, hasBusinessOps, rndOnlyCompany,
      isSubUnit, projectName, preCommercial, activityNature, negativeActivities,
      hasSpace, independentSpace, fixedWallsAndDoor, movableWallPossible,
      spaceUnder50, adequateArea, equipmentInSpace, isInfoServiceOrSW, candidates,
    ],
  );

  function updateCandidate(id: string, patch: Partial<ResearcherCandidate>) {
    setCandidates((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  function toggleNegative(n: NegativeActivity) {
    setNegativeActivities((arr) =>
      arr.includes(n) ? arr.filter((x) => x !== n) : [...arr, n],
    );
  }

  function saveResult() {
    try {
      localStorage.setItem(
        "assessment:last",
        JSON.stringify({ companyName, industry, verdict: result.verdict, recommendedType: result.recommendedType, savedAt: new Date().toISOString() }),
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch { /* 무시 */ }
  }

  /** 임시 저장 → 설립서류 관리 대상으로 전달. 성공 시 true */
  function sendToSetup(): boolean {
    if (!companyName.trim()) {
      alert("기업명을 입력해 주세요.");
      return false;
    }
    const labType = desiredType === "기업부설연구소" ? "기업부설연구소" : "연구개발전담부서";
    addTempCompany({
      name: companyName.trim(),
      industry: industry || undefined,
      labType,
      projectName: projectName || undefined,
      researcherCount: pick,
    });
    setSentMsg(`‘${companyName.trim()}’이(가) 설립서류 관리에 임시 저장되었습니다.`);
    return true;
  }

  /* 설립 유형 1차 추천 (연구소 vs 전담부서) */
  const labReachable = result.eligibleCount >= result.requiredForLab;
  const deptReachable = result.eligibleCount >= 1;
  const firstReco: { tone: "green" | "indigo" | "amber"; lines: string[] } = !deptReachable
    ? { tone: "amber", lines: ["현재 입력 기준으로는 자격을 갖춘 연구전담요원 확보가 우선입니다.", "전담요원 1명 확보 시 연구개발전담부서부터 검토할 수 있습니다."] }
    : labReachable
      ? { tone: "green", lines: ["연구소/전담부서 모두 가능성이 있으나, 세액공제·인증 활용 목적에 따라 선택이 필요합니다."] }
      : { tone: "indigo", lines: ["현재 입력 기준으로는 연구개발전담부서 설립이 더 현실적입니다.", "연구소 설립은 연구전담요원 추가 확보 후 검토하는 것이 안전합니다."] };
  const recoToneCls = firstReco.tone === "green" ? "border-green-200 bg-status-normalBg" : firstReco.tone === "indigo" ? "border-indigo-200 bg-indigo-50" : "border-amber-200 bg-amber-50";

  /* 후보 수(pick) 기반 UI 추천 — 법령 판정(feasibility)은 그대로, 표시용 계산만 분리 */
  const reqLab = requiredForLab({
    companySize, isVenture, isResearcherFounded,
    businessMonths: Math.round(years * 12),
    becameMediumWithinYear: companySize === "중기업" ? becameMediumWithinYear : false,
    isOverseasLab,
  });
  // 후보 수별 기업부설연구소 가능성 (1명 불가 / 2명 조건부 / 3명↑ requiredForLab 기준)
  const labState: "가능" | "조건부 검토" | "불가" =
    pick <= 1 ? "불가"
    : pick === 2 ? "조건부 검토"
    : pick >= reqLab ? "가능"
    : pick >= reqLab - 1 ? "조건부 검토"
    : "불가";
  const pickVerdict =
    pick <= 1 ? "현재 인원 기준으로는 연구개발전담부서가 현실적입니다."
    : pick === 2 ? "벤처기업 등 예외 요건에 해당하는 경우에만 기업부설연구소 검토가 가능합니다."
    : labState === "가능" ? "기업부설연구소도 검토 가능합니다."
    : labState === "조건부 검토" ? `기업 규모 기준 인원(필요 ${reqLab}명)에 가까워, 추가 인원 확보 시 연구소 검토가 가능합니다.`
    : `현재 기업 규모 기준(필요 ${reqLab}명)에는 인원이 부족합니다. 연구개발전담부서부터 검토하세요.`;
  const LAB_STATE_CLS: Record<string, string> = {
    가능: "border-green-300 bg-status-normalBg text-status-normal",
    "조건부 검토": "border-amber-300 bg-amber-50 text-amber-700",
    불가: "border-red-300 bg-status-dangerBg text-status-danger",
  };

  /* 물적요건 체크 — 선택 유형에 따라 필요한 항목만 노출 */
  const isDept = desiredType === "연구개발전담부서";
  const facilityChecks: { key: string; label: string; value: boolean; set: (v: boolean) => void; showFor: "both" | "lab" | "dept" }[] = [
    { key: "independent", label: isDept ? "연구공간 또는 좌석이 구분된다" : "독립된 연구공간이다", value: independentSpace, set: setIndependentSpace, showFor: "both" },
    { key: "walls", label: "고정벽체 + 별도 출입문이 있다", value: fixedWallsAndDoor, set: setFixedWallsAndDoor, showFor: "lab" },
    { key: "movable", label: "분리·이동형 벽체(2m 이상) 적용 가능", value: movableWallPossible, set: setMovableWallPossible, showFor: "dept" },
    { key: "adequate", label: "전담요원이 상시 근무 가능한 면적이다", value: adequateArea, set: setAdequateArea, showFor: "both" },
    { key: "equip", label: "연구기자재가 연구공간 안에 있다", value: equipmentInSpace, set: setEquipmentInSpace, showFor: "both" },
    { key: "infosw", label: "정보서비스·SW개발공급 업종이다", value: isInfoServiceOrSW, set: setIsInfoServiceOrSW, showFor: "dept" },
  ];
  const facilityShown = facilityChecks.filter((c) => c.showFor === "both" || (isDept ? c.showFor === "dept" : c.showFor === "lab"));
  const facilityMet = facilityShown.filter((c) => c.value);
  const facilityGap = facilityShown.filter((c) => !c.value);

  return (
    <Layout
      title="연구소 설립 가능성 체크"
      subtitle="기업 정보와 연구인력 조건을 바탕으로 연구소/전담부서 설립 가능성을 빠르게 검토합니다"
    >
      <PageGuide
        id="assessment"
        purpose="기업부설연구소·연구개발전담부서 설립 가능성을 1차 검토합니다."
        when="설립 상담 초기, 가능성과 유형을 빠르게 판단할 때 사용합니다."
        result="추천 유형, 부족 요건, 보완 항목, 설립 가능성 검토 결과서를 얻습니다."
        steps={["기업정보 입력", "연구전담요원 후보 수 선택", "물적요건 확인", "결과서 확인", "설립서류 관리로 임시 저장"]}
      />
      <div className="grid grid-cols-1 gap-5 @4xl:grid-cols-3 print-hide">
        {/* ───────── 입력 (좌측 2/3) ───────── */}
        <div className="space-y-5 @4xl:col-span-2">
          {/* ① 기업 기본요건 */}
          <Card title="① 기업 기본요건">
            {/* 기업명 — 기본요건 시작 */}
            <Field label="기업명">
              <input className={INPUT} value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="예) 오로라테크 주식회사" />
            </Field>

            {/* 업종 대분류 선택 (객관식) */}
            <div className="mb-4 mt-4">
              <label className={LABEL}>업종 대분류 선택</label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {INDUSTRY_CATEGORIES.map((c) => (
                  <button
                    key={c.label}
                    type="button"
                    onClick={() => {
                      setIndustry(c.label);
                      setIndustryField(c.field);
                      setIsExcludedIndustry(false);
                      setCustomIndustry(false);
                    }}
                    className={`rounded-xl border px-4 py-2.5 text-base font-bold ${
                      industry === c.label && !isExcludedIndustry
                        ? "border-navy-600 bg-navy-50 text-navy-700"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => { setCustomIndustry(true); setIndustry(""); setIsExcludedIndustry(false); }}
                  className={`rounded-xl border border-dashed px-4 py-2.5 text-base font-bold ${
                    customIndustry ? "border-navy-600 bg-navy-50 text-navy-700" : "border-slate-300 text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  + 기타 직접입력
                </button>
              </div>
              {customIndustry ? (
                <input
                  autoFocus
                  className={`${INPUT} max-w-md`}
                  value={industry}
                  onChange={(e) => {
                    const v = e.target.value;
                    setIndustry(v);
                    setIsExcludedIndustry(/유흥|카지노|사행|도박|가상자산|블록체인.?매매/.test(v));
                  }}
                  placeholder="업종을 직접 입력 (대분류에 없을 때) — 아래 분야 구분도 선택하세요"
                />
              ) : null}
              {/* 분야 자동 추천 / 업종별 안내 */}
              {(() => {
                const cat = INDUSTRY_CATEGORIES.find((c) => c.label === industry);
                if (!cat || isExcludedIndustry) return null;
                return (
                  <div className="mt-2 rounded-lg bg-navy-50 px-4 py-2.5 text-base text-navy-800">
                    추천 분야: <span className="font-bold">{cat.field}</span> (자동 선택됨)
                    {cat.hint ? <p className="mt-1 text-sm leading-relaxed text-navy-700/80">💡 {cat.hint}</p> : null}
                  </div>
                );
              })()}
              {/* 제외 업종 */}
              <div className="mt-2 flex flex-wrap gap-2">
                {EXCLUDED_INDUSTRIES.map((x) => (
                  <button
                    key={x}
                    type="button"
                    onClick={() => { setIndustry(x); setIsExcludedIndustry(true); setCustomIndustry(false); }}
                    className={`rounded-full border px-3 py-1.5 text-sm font-bold ${
                      industry === x && isExcludedIndustry
                        ? "border-red-300 bg-status-dangerBg text-status-danger"
                        : "border-slate-200 text-slate-400 hover:bg-slate-50"
                    }`}
                  >
                    ⚠ {x}
                  </button>
                ))}
              </div>
              {isExcludedIndustry ? (
                <div className="mt-2 rounded-lg bg-status-dangerBg px-4 py-2.5 text-base font-semibold text-status-danger">
                  ⚠ 제외 업종에 해당할 가능성이 높습니다. 연구소/전담부서 신고대상이 아닐 수 있어 업종 분류 재확인이 필요합니다.
                </div>
              ) : null}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="분야 구분">
                <div className="mt-1 flex gap-1.5">
                  {FIELD_OPTS.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setIndustryField(f)}
                      className={`flex-1 rounded-lg border px-1 py-2 text-xs font-semibold ${
                        industryField === f
                          ? "border-navy-600 bg-navy-50 text-navy-700"
                          : "border-slate-200 text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      {f.replace(" 분야", "")}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="기업 규모">
                <select className={INPUT} value={companySize} onChange={(e) => setCompanySize(e.target.value as CompanySize)}>
                  {SIZE_OPTS.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="업력 (년)">
                <input type="number" min={0} step={0.5} className={INPUT} value={years} onChange={(e) => setYears(Number(e.target.value))} />
                {companySize === "소기업" && years <= 3 ? (
                  <p className="mt-1 text-xs text-navy-600">창업 3년 이내 소기업 — 전담요원 2명 기준 + 대표자 예외 검토 대상</p>
                ) : null}
              </Field>
              <Field label="상시 종업원 수 (명)">
                <input type="number" min={0} className={INPUT} value={employeeCount} onChange={(e) => setEmployeeCount(Number(e.target.value))} />
              </Field>
            </div>

            {/* 연구전담요원 후보 수 + 설립 유형 추천 */}
            <div className="mt-4 border-t border-slate-100 pt-3">
              <label className={LABEL}>연구전담요원으로 둘 인원 (후보 수)</label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => setPick(n)}
                    className={`rounded-lg border px-4 py-2.5 text-base font-bold ${pick === n ? "border-navy-600 bg-navy-700 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                    {n === 5 ? "5명 이상" : `${n}명`}
                  </button>
                ))}
              </div>
              {/* 유형별 가능성 칩 */}
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className={`rounded-xl border px-4 py-2.5 text-base font-bold ${LAB_STATE_CLS[labState]}`}>
                  기업부설연구소 — {labState}
                </div>
                <div className="rounded-xl border border-green-300 bg-status-normalBg px-4 py-2.5 text-base font-bold text-status-normal">
                  연구개발전담부서 — 가능
                </div>
              </div>
              <p className="mt-2 rounded-lg bg-navy-50 px-4 py-2.5 text-base font-bold text-navy-800">
                💡 {pickVerdict}
              </p>

              {/* 설립 유형 선택 (물적요건과 동기화) */}
              <label className={`${LABEL} mt-3 block`}>설립 유형 선택</label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {(["기업부설연구소", "연구개발전담부서", "아직 모름"] as LabTypeChoice[]).map((t) => (
                  <button key={t} type="button" onClick={() => setDesiredType(t)}
                    className={`rounded-lg border px-4 py-2.5 text-base font-bold ${desiredType === t ? "border-navy-600 bg-navy-50 text-navy-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-1.5 border-t border-slate-100 pt-3 sm:grid-cols-2">
              <Toggle label="벤처기업 (확인서 유효)" value={isVenture} onChange={setIsVenture} />
              <Toggle label="연구원·교원 창업기업" value={isResearcherFounded} onChange={setIsResearcherFounded} />
              <Toggle label="해외소재 연구소로 설립 검토" value={isOverseasLab} onChange={setIsOverseasLab} />
              {companySize === "중기업" ? (
                <Toggle label="소기업→중기업 전환 1년 이내" value={becameMediumWithinYear} onChange={setBecameMediumWithinYear} />
              ) : null}
            </div>
            <div className="mt-3 rounded-lg bg-slate-50 p-3">
              <p className="mb-2 text-xs font-bold text-slate-500">신고대상 확인</p>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                <Toggle label="영리활동을 하는 기업이다" value={isForProfit} onChange={setIsForProfit} />
                <Toggle label="생산·판매·관리 등 경영조직(인력)이 있다" value={hasBusinessOps} onChange={setHasBusinessOps} />
                <Toggle label="연구개발활동만 수행하는 회사다" value={rndOnlyCompany} onChange={setRndOnlyCompany} />
                <Toggle label="연구소를 기업 내 하부조직으로 둔다" value={isSubUnit} onChange={setIsSubUnit} />
              </div>
            </div>
          </Card>

          {/* ③ 연구개발활동 적합성 */}
          <Card title="② 연구개발활동 적합성">
            <div className="space-y-4">
              <Field label="연구과제명 (예정)">
                <input className={INPUT} value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="예) 추천엔진 정확도 고도화 연구" />
              </Field>
              <Field label="활동 성격">
                <div className="mt-1 grid grid-cols-2 gap-1.5">
                  {NATURE_OPTS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setActivityNature(n)}
                      className={`rounded-lg border px-2 py-2 text-xs font-semibold leading-tight ${
                        activityNature === n
                          ? "border-navy-600 bg-navy-50 text-navy-700"
                          : "border-slate-200 text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </Field>
              <Toggle label="사업화 이전 단계의 연구이다" value={preCommercial} onChange={setPreCommercial} />
              <div>
                <p className="text-xs font-semibold text-slate-600">
                  해당하는 활동이 있으면 체크 (연구개발 범위 제외 활동)
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {NEGATIVE_OPTS.map((n) => {
                    const on = negativeActivities.includes(n);
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() => toggleNegative(n)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                          on
                            ? "border-amber-300 bg-amber-50 text-amber-700"
                            : "border-slate-200 text-slate-400 hover:bg-slate-50"
                        }`}
                      >
                        {on ? "✓ " : ""}{n}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 연구과제 추천 프롬프트 */}
              <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-4">
                <p className="text-base font-bold text-violet-800">
                  어떤 연구과제로 잡을지 막막하신가요?
                </p>
                <p className="mt-1 text-sm leading-relaxed text-violet-700/80">
                  회사 정보를 바탕으로 외부 GPT에 붙여넣어 연구과제 후보를 도출할 수 있는
                  프롬프트를 만들어 드립니다. (현재 입력 정보 기준 후보 도출용)
                </p>
                <button
                  type="button"
                  onClick={() => setPromptOpen(true)}
                  className="mt-3 rounded-xl bg-violet-600 px-5 py-3 text-base font-bold text-white hover:bg-violet-700"
                >
                  연구과제 추천 프롬프트 만들기
                </button>
              </div>
            </div>
          </Card>

          {/* ④ 물적요건 */}
          <Card title="③ 물적요건 (연구공간·기자재)">
            {/* 연구소 / 전담부서 물적요건 비교 — 위치 고정(좌: 전담부서 / 우: 연구소), 클릭 시 선택 동기화 */}
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                { type: "연구개발전담부서" as const, title: "연구개발전담부서 물적요건", items: FACILITY_DEPT, tone: "emerald" as const },
                { type: "기업부설연구소" as const, title: "기업부설연구소 물적요건", items: FACILITY_LAB, tone: "navy" as const },
              ]
                .map((c) => {
                  const active = desiredType === c.type;
                  const cls = c.tone === "navy"
                    ? (active ? "border-navy-600 bg-navy-50 ring-2 ring-navy-200" : "border-navy-200 bg-navy-50/30 hover:border-navy-400")
                    : (active ? "border-emerald-600 bg-emerald-50 ring-2 ring-emerald-200" : "border-emerald-200 bg-emerald-50/30 hover:border-emerald-400");
                  const titleCls = c.tone === "navy" ? "text-navy-800" : "text-emerald-800";
                  const badgeCls = c.tone === "navy" ? "bg-navy-700" : "bg-emerald-600";
                  return (
                    <button key={c.type} type="button" onClick={() => setDesiredType(c.type)}
                      className={`rounded-xl border-2 p-4 text-left transition ${cls}`}>
                      <div className="flex items-center justify-between">
                        <p className={`text-base font-bold ${titleCls}`}>{c.title}</p>
                        {active ? <span className={`rounded-full px-2 py-0.5 text-xs font-bold text-white ${badgeCls}`}>선택됨</span> : <span className="text-xs text-slate-400">클릭해 선택</span>}
                      </div>
                      <ul className="mt-2 space-y-1 text-sm leading-relaxed text-slate-600">
                        {c.items.map((t) => <li key={t}>· {t}</li>)}
                      </ul>
                    </button>
                  );
                })}
            </div>

            {/* 좌: 체크 항목 / 우: 충족·보완 고정 카드 */}
            <div className="grid grid-cols-1 gap-3 @2xl:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="mb-1.5 text-sm font-bold text-slate-600">{isDept ? "연구개발전담부서" : "기업부설연구소"} 공간 점검</p>
                <div className="grid grid-cols-1 gap-0.5">
                  {facilityShown.map((c) => (
                    <Toggle key={c.key} label={c.label} value={c.value} onChange={c.set} />
                  ))}
                </div>
              </div>
              <div className="grid grid-rows-2 gap-3">
                <div className="rounded-xl border border-green-200 bg-status-normalBg/50 p-3">
                  <p className="text-sm font-bold text-status-normal">충족 항목 ({facilityMet.length})</p>
                  <ul className="mt-1 space-y-0.5 text-sm text-slate-700">
                    {facilityMet.length ? facilityMet.map((c) => <li key={c.key}>✓ {c.label}</li>) : <li className="text-slate-400">—</li>}
                  </ul>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                  <p className="text-sm font-bold text-amber-700">보완 필요 ({facilityGap.length})</p>
                  <ul className="mt-1 space-y-0.5 text-sm text-slate-700">
                    {facilityGap.length ? facilityGap.map((c) => <li key={c.key}>⚠ {c.label}</li>) : <li className="text-status-normal">현재 보완 필요 항목 없음</li>}
                  </ul>
                </div>
              </div>
            </div>
          </Card>

          {/* ⑤ 연구원 후보자 */}
          <Card
            title="④ 연구전담요원 후보자 (상세)"
            action={
              <button
                type="button"
                onClick={() => setCandidates((cs) => [...cs, newCandidate()])}
                className="text-xs font-semibold text-navy-600 hover:text-navy-800"
              >
                + 후보자 추가
              </button>
            }
          >
            <div className="space-y-4">
              {candidates.map((c, idx) => {
                const ca = result.candidates.find((x) => x.candidate.id === c.id);
                return (
                  <div key={c.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-500">후보자 {idx + 1}{c.name ? ` · ${c.name}` : ""}</span>
                      <div className="flex items-center gap-2">
                        {ca ? (
                          <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-bold ring-1 ring-inset ${CAND_STYLE[ca.verdict]}`}>
                            {CAND_LABEL[ca.verdict]}
                          </span>
                        ) : null}
                        {candidates.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => setCandidates((cs) => cs.filter((x) => x.id !== c.id))}
                            className="text-slate-400 hover:text-status-danger"
                          >
                            ✕
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Field label="이름">
                        <input className={INPUT} value={c.name} onChange={(e) => updateCandidate(c.id, { name: e.target.value })} />
                      </Field>
                      <Field label="연구개발 경력 (년)">
                        <input type="number" min={0} step={0.5} className={INPUT} value={c.researchYears} onChange={(e) => updateCandidate(c.id, { researchYears: Number(e.target.value) })} />
                      </Field>
                      <Field label="최종학력">
                        <select className={INPUT} value={c.education} onChange={(e) => updateCandidate(c.id, { education: e.target.value as EducationLevel })}>
                          {EDU_OPTS.map((o) => (
                            <option key={o}>{o}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="전공 계열">
                        <select className={INPUT} value={c.major} onChange={(e) => updateCandidate(c.id, { major: e.target.value as MajorField })}>
                          {MAJOR_OPTS.map((o) => (
                            <option key={o}>{o}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="국가기술자격">
                        <select className={INPUT} value={c.cert} onChange={(e) => updateCandidate(c.id, { cert: e.target.value as CertLevel })}>
                          {CERT_OPTS.map((o) => (
                            <option key={o}>{o}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="실제 담당할 연구업무">
                        <input className={INPUT} value={c.dutyDescription} onChange={(e) => updateCandidate(c.id, { dutyDescription: e.target.value })} placeholder="예) 알고리즘 설계·성능 시험" />
                      </Field>
                    </div>

                    <EduGuide education={c.education} cert={c.cert} researchYears={c.researchYears} />

                    <div className="mt-3 grid grid-cols-2 gap-1.5 border-t border-slate-100 pt-3 sm:grid-cols-3">
                      <Toggle small label="대표자" value={c.isCeo} onChange={(v) => updateCandidate(c.id, { isCeo: v })} />
                      <Toggle small label="등기임원" value={c.isRegisteredExec} onChange={(v) => updateCandidate(c.id, { isRegisteredExec: v })} />
                      <Toggle small label="상근" value={c.fullTime} onChange={(v) => updateCandidate(c.id, { fullTime: v })} />
                      <Toggle small label="4대보험 가입(예정)" value={c.insured} onChange={(v) => updateCandidate(c.id, { insured: v })} />
                      <Toggle small label="연구업무 전담" value={c.researchDedicated} onChange={(v) => updateCandidate(c.id, { researchDedicated: v })} />
                      <Toggle small label="다른 업무 겸직" value={c.hasOtherDuties} onChange={(v) => updateCandidate(c.id, { hasOtherDuties: v })} />
                      <Toggle small label="주간 대학원 재학" value={c.daytimeGradSchool} onChange={(v) => updateCandidate(c.id, { daytimeGradSchool: v })} />
                    </div>

                    {ca && ca.notes.length ? (
                      <ul className="mt-3 space-y-1">
                        {ca.notes.map((n, i) => (
                          <li key={i} className="text-xs leading-relaxed text-slate-500">
                            · {n}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* ───────── 판정 결과 (우측 1/3) ───────── */}
        <div className="@2xl:col-span-1">
          <div className="space-y-4 @2xl:sticky @2xl:top-24">
            {/* 설립 유형 1차 추천 */}
            <div className={`rounded-2xl border-2 p-5 ${recoToneCls}`}>
              <p className="text-sm font-bold text-slate-700">설립 유형 1차 추천{desiredType === "아직 모름" ? "" : ` (희망: ${desiredType})`}</p>
              <ul className="mt-1.5 space-y-1">
                {firstReco.lines.map((t, i) => (
                  <li key={i} className="text-base font-semibold leading-relaxed text-slate-800">· {t}</li>
                ))}
              </ul>
            </div>

            {/* 최종 판정 */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6">
              <p className="text-sm font-medium text-slate-500">설립 가능성 검토 결과 (현재 입력 기준)</p>
              <div className="mt-2">
                <span className={`inline-flex items-center rounded-lg px-4 py-2 text-base font-bold ring-1 ring-inset ${VERDICT_STYLE[result.verdict]}`}>
                  {result.verdict}
                </span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">{result.summary}</p>
              <p className="mt-2 text-xs text-slate-400">
                추천 추진 유형:{" "}
                <span className="font-semibold text-slate-700">{result.recommendedType}</span>
              </p>
              <OsAttach
                title="설립 가능성 체크"
                verdict={result.verdict}
                verdictLabel={result.verdict}
                summary={[`[설립 가능성 검토 — ${companyName || "업체"}]`, `판정: ${result.verdict}`, `추천 유형: ${result.recommendedType}`, "", result.summary].join("\n")}
                data={{ kind: "assess", companyName, industry, verdict: result.verdict, recommendedType: result.recommendedType }}
              />
            </div>

            {/* 인원 현황 */}
            <div className="grid grid-cols-3 gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-card">
              <Stat label="필요 인원" value={`${result.requiredResearchers}명`} />
              <Stat label="인정 가능" value={`${result.eligibleCount}명`} tone="good" />
              <Stat label="부족 인원" value={`${result.shortage}명`} tone={result.shortage > 0 ? "warn" : "good"} />
              <Stat label="확인 필요" value={`${result.reviewCount}명`} tone="warn" />
              <Stat label="연구소 기준" value={`${result.requiredForLab}명`} />
              <Stat label="전담부서 기준" value="1명" />
            </div>

            {/* 대표자 포함 가능성 — 강조 카드 */}
            <div className="rounded-2xl border-2 border-navy-200 bg-navy-50 p-5">
              <p className="text-sm font-bold text-navy-800">대표자 연구전담요원 포함 가능성</p>
              <div className="mt-2">
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-inset ${CEO_STYLE[result.ceo.verdict]}`}>
                  {result.ceo.verdict}
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-navy-900/80">{result.ceo.basis}</p>
              {result.ceo.cautions.length ? (
                <ul className="mt-2 space-y-1">
                  {result.ceo.cautions.map((t, i) => (
                    <li key={i} className="text-xs leading-relaxed text-navy-900/60">
                      ⚠ {t}
                    </li>
                  ))}
                </ul>
              ) : null}
              {result.ceo.threeYearNote ? (
                <p className="mt-2 rounded-lg bg-white/70 px-3 py-2 text-xs leading-relaxed text-navy-800">
                  📌 {result.ceo.threeYearNote}
                </p>
              ) : null}
            </div>

            {/* 3대 섹션 판정 */}
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
              <SectionRow label="신고대상 기업 여부" verdict={result.eligibility.verdict} notes={result.eligibility.notes} />
              <SectionRow label="연구개발활동 적합성" verdict={result.activity.verdict} notes={result.activity.notes} />
              <SectionRow label="물적요건" verdict={result.facility.verdict} notes={result.facility.notes} />
            </div>

            {/* 보완 항목 */}
            {result.improvements.length ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
                <p className="mb-2 text-sm font-bold text-slate-800">보완해야 할 항목</p>
                <ul className="space-y-1.5">
                  {result.improvements.map((t, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-slate-600">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-status-warning" />
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {/* 진행 전략 */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
              <p className="mb-2 text-sm font-bold text-slate-800">추천 진행전략</p>
              <ul className="space-y-1.5">
                {result.strategy.map((t, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-slate-700">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-navy-600" />
                    {t}
                  </li>
                ))}
              </ul>
              <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-400">
                ※ 본 판정은 현재 입력 기준의 사전 검토이며, 실제 인정 여부는 한국산업기술진흥협회
                심사와 증빙자료 확인에 따라 달라질 수 있습니다. 설립 전 증빙자료 확인이 필요합니다.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ───────── 임시 저장 → 설립서류 관리 연결 ───────── */}
      <section className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-navy-200 bg-navy-50 p-4 print-hide">
        <div>
          <p className="text-base font-bold text-navy-800">이 회사로 설립서류 체크를 시작할까요?</p>
          <p className="mt-0.5 text-sm text-navy-700/80">현재 입력한 기업명·업종·규모·추천 유형·연구과제명을 임시 저장하면, 설립서류 관리에서 ‘임시 저장’으로 바로 체크할 수 있습니다.</p>
          {sentMsg ? <p className="mt-1 text-sm font-bold text-status-normal">{sentMsg}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={sendToSetup} className="rounded-xl bg-navy-700 px-5 py-2.5 text-base font-bold text-white hover:bg-navy-800">임시 저장</button>
          <button type="button" onClick={() => { if (sendToSetup()) router.push("/setup-documents"); }} className="rounded-xl border border-navy-300 bg-white px-5 py-2.5 text-base font-bold text-navy-700 hover:bg-navy-100">설립서류 관리로 보내기 →</button>
        </div>
      </section>

      {/* ───────── 결과서 저장·출력 (기본 접힘) ───────── */}
      <section className="mt-5 print-full">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-card print-hide">
          <div>
            <h3 className="text-lg font-bold text-slate-900">설립 가능성 검토 결과서</h3>
            <p className="text-sm text-slate-500">현재 입력 기준 결과서를 저장하거나 JPEG/PDF로 출력할 수 있습니다.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setReportOpen((o) => !o)} className="rounded-xl border border-navy-300 bg-navy-50 px-4 py-2.5 text-base font-bold text-navy-700 hover:bg-navy-100">{reportOpen ? "결과서 접기" : "결과서 펼쳐보기"}</button>
            <button type="button" onClick={saveResult} className="rounded-xl border border-slate-300 px-4 py-2.5 text-base font-bold text-slate-600 hover:bg-slate-50">{saved ? "저장됨 ✓" : "결과 저장"}</button>
            <button type="button" onClick={() => downloadSvgAsJpeg(reportRef.current, `${companyName || "기업"}_설립가능성검토.jpg`)} className="rounded-xl bg-navy-700 px-5 py-2.5 text-base font-bold text-white hover:bg-navy-800">JPEG 다운로드</button>
            <button type="button" onClick={() => printSvg(reportRef.current, `${companyName || "기업"} 설립 가능성 검토 결과서`)} className="rounded-xl border border-navy-200 px-5 py-2.5 text-base font-bold text-navy-700 hover:bg-navy-50">PDF 저장 (인쇄)</button>
          </div>
        </div>
        <div className={`mt-3 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-card ${reportOpen ? "" : "hidden"}`}>
          <AssessmentReportSvg
            innerRef={reportRef}
            companyName={companyName}
            industry={industry}
            industryField={industryField}
            companySize={companySize}
            desiredType={desiredType}
            result={result}
          />
        </div>
      </section>

      {promptOpen ? (
        <ProjectPromptModal
          companyName={companyName}
          industry={industry}
          onClose={() => setPromptOpen(false)}
        />
      ) : null}
    </Layout>
  );
}

/* ───────────────── 결과서 SVG (PNG/PDF 출력용) ───────────────── */

function AssessmentReportSvg({
  innerRef, companyName, industry, industryField, companySize, desiredType, result,
}: {
  innerRef: React.Ref<SVGSVGElement>;
  companyName: string; industry: string; industryField: IndustryField;
  companySize: CompanySize; desiredType: LabTypeChoice; result: FeasibilityResult;
}) {
  const W = 700;
  const PX = 24;
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, ".");
  const nodes: React.ReactNode[] = [];
  let y = 46;
  const key = () => nodes.length;

  const line = (text: string, opts: { size?: number; bold?: boolean; color?: string; gap?: number; x?: number } = {}) => {
    const { size = 11.5, bold = false, color = "#334155", gap = 15, x = PX } = opts;
    nodes.push(<text key={key()} x={x} y={y} fontSize={size} fontWeight={bold ? "bold" : "normal"} fill={color}>{text}</text>);
    y += gap;
  };
  const wrapLines = (text: string, max: number) => {
    const out: string[] = []; let cur = "";
    for (const word of text.split(/(\s+)/)) {
      if ((cur + word).length > max && cur) { out.push(cur.trim()); cur = word; }
      else cur += word;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  };
  const note = (text: string, color = "#475569") => {
    for (const l of wrapLines(text, 52)) line(`· ${l}`, { size: 10.5, color, gap: 13.5 });
  };
  const section = (title: string) => {
    y += 5;
    nodes.push(<rect key={key()} x={PX} y={y - 11} width="3.5" height="13" rx="2" fill="#334e76" />);
    line(title, { size: 12.5, bold: true, color: "#0f172a", x: PX + 10 });
    y += 1;
  };

  // 1. 기업 정보
  section("1. 기업 정보");
  line(`기업명: ${companyName || "(미입력)"}   |   업종: ${industry || "(미입력)"} (${industryField})`);
  line(`기업 규모: ${companySize}   |   희망 유형: ${desiredType}`);

  // 2. 설립 유형 추천
  section("2. 설립 유형 추천");
  line(`추천 유형: ${result.recommendedType}   |   판정: ${result.verdict}`, { size: 11.5, bold: true, color: "#1d4ed8" });
  for (const l of wrapLines(result.summary, 56)) line(l, { size: 10.5, color: "#475569", gap: 13.5 });

  // 3. 연구전담요원 후보 판단
  section("3. 연구전담요원 후보 판단");
  line(`필요 ${result.requiredResearchers}명 · 인정 가능 ${result.eligibleCount}명 · 부족 ${result.shortage}명 · 추가 확인 ${result.reviewCount}명 (연구소 기준 ${result.requiredForLab}명 / 전담부서 1명)`, { size: 10.5, color: "#475569" });
  if (result.candidates.length) {
    const labelMap: Record<string, string> = { "인정 가능": "가능성 높음", "추가 확인 필요": "추가 확인 필요", "인정 어려움": "부적합 가능성" };
    for (const c of result.candidates) {
      line(`· ${c.candidate.name || "(이름 미입력)"} — ${labelMap[c.verdict] ?? c.verdict} (${c.candidate.education}/${c.candidate.major})`, { size: 10.5, color: "#334155", gap: 14 });
    }
  }

  // 4. 물적요건 체크
  section("4. 물적요건 체크");
  line(`판정: ${result.facility.verdict}`, { size: 11, bold: true });
  if (result.facility.notes[0]) note(result.facility.notes[0]);

  // 5. 보완 필요 항목
  section("5. 보완 필요 항목");
  if (result.improvements.length) result.improvements.slice(0, 5).forEach((t) => note(t));
  else line("· 현재 입력 기준 특이 보완사항이 없습니다.", { size: 10.5, color: "#16a34a", gap: 14 });

  // 6. 추천 진행전략
  section("6. 추천 진행전략");
  result.strategy.slice(0, 4).forEach((t) => note(t));

  // 7. 사전 검토용 고지
  y += 5;
  nodes.push(<rect key={key()} x={PX} y={y - 11} width={W - PX * 2} height="1" fill="#e2e8f0" />);
  y += 6;
  for (const l of wrapLines("본 결과서는 사전 검토용이며 최종 인정 여부를 보장하지 않습니다. 실제 인정은 한국산업기술진흥협회 심사와 증빙자료 확인에 따라 달라질 수 있습니다.", 58))
    line(l, { size: 10, color: "#94a3b8", gap: 14 });

  const H = y + 12;
  return (
    <svg ref={innerRef} viewBox={`0 0 ${W} ${H}`} className="w-full bg-white" style={{ minWidth: 520 }}>
      <rect x="0" y="0" width={W} height="32" fill="#13233b" />
      <text x={PX} y="21" fontSize="14" fontWeight="bold" fill="#ffffff">연구소 설립 가능성 검토 결과서</text>
      <text x={W - PX} y="21" fontSize="10" fill="#cbd5e1" textAnchor="end">작성일 {today}</text>
      {nodes}
    </svg>
  );
}

/* ───────────────── 연구과제 추천 프롬프트 모달 ───────────────── */

function ProjectPromptModal({
  companyName,
  industry,
  onClose,
}: {
  companyName: string;
  industry: string;
  onClose: () => void;
}) {
  const [products, setProducts] = useState("");
  const [customers, setCustomers] = useState("");
  const [workflow, setWorkflow] = useState("");
  const [problems, setProblems] = useState("");
  const [resources, setResources] = useState("");
  const [purpose, setPurpose] = useState("연구개발전담부서 설립 후 기업부설연구소 전환 검토");
  const [copied, setCopied] = useState(false);

  const prompt = [
    "당신은 기업부설연구소/연구개발전담부서 설립을 돕는 R&D 컨설턴트입니다.",
    "아래 회사 정보를 바탕으로, 현재 입력 정보 기준 이 회사에 맞는 연구과제 후보 5개를 도출해 주세요.",
    "",
    "[회사 정보]",
    `- 회사명: ${companyName || "(미입력)"}`,
    `- 업종: ${industry || "(미입력)"}`,
    `- 주요 제품/서비스: ${products || "(미입력)"}`,
    `- 주요 고객층: ${customers || "(미입력)"}`,
    `- 현재 업무 방식: ${workflow || "(미입력)"}`,
    `- 개선하고 싶은 문제: ${problems || "(미입력)"}`,
    `- 보유 인력/장비: ${resources || "(미입력)"}`,
    `- 연구소/전담부서 설립 목적: ${purpose || "(미입력)"}`,
    "",
    "[요청 사항]",
    "1. 실제 사업과 직접 연결되는 연구과제명 5개를 추천해 주세요.",
    "2. 각 연구과제마다 아래 항목을 정리해 주세요.",
    "   - 연구과제명",
    "   - 연구개발 목표",
    "   - 연구내용 (무엇을·어떻게)",
    "   - 사업과의 직접 관련성",
    "   - 향후 벤처기업확인(혁신성장유형) 등과 연결 가능성",
    "   - 연구노트 작성 시 핵심 키워드",
    "3. 단순 유지보수, 단순 판매촉진, 일상적 품질관리처럼 보일 수 있는 표현이 있으면 지적하고 더 적합한 표현으로 바꿔 주세요.",
    "",
    "[주의]",
    "- 사업화 이전 단계의 새로운 제품·공정·서비스 개발 또는 기술적 개선에 해당해야 합니다.",
    "- 실제로 수행 가능한 범위에서 제안해 주세요. 허위·과장 활동을 전제로 하지 마세요.",
    "- 인정 여부를 단정하지 말고, '후보'로 제안해 주세요.",
  ].join("\n");

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 무시 */
    }
  }

  const F = "mt-1 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-base focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500";

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-xl font-bold text-slate-900">연구과제 추천 프롬프트</h3>
            <p className="text-sm text-slate-500">회사 정보를 채울수록 좋은 과제 후보가 나옵니다 · 외부 GPT에 붙여넣어 사용</p>
          </div>
          <button onClick={onClose} className="text-2xl text-slate-400 hover:text-slate-700">✕</button>
        </div>
        <div className="grid grid-cols-1 gap-5 p-6 @2xl:grid-cols-2">
          <div className="space-y-3">
            <div><label className={LABEL}>주요 제품/서비스</label><input className={F} value={products} onChange={(e) => setProducts(e.target.value)} placeholder="예) 저당 소스, 가정용 반찬" /></div>
            <div><label className={LABEL}>주요 고객층</label><input className={F} value={customers} onChange={(e) => setCustomers(e.target.value)} placeholder="예) 대형마트 납품, 온라인 소비자" /></div>
            <div><label className={LABEL}>현재 업무 방식</label><textarea rows={2} className={F} value={workflow} onChange={(e) => setWorkflow(e.target.value)} placeholder="예) 수작업 배합 후 OEM 생산" /></div>
            <div><label className={LABEL}>개선하고 싶은 문제</label><textarea rows={2} className={F} value={problems} onChange={(e) => setProblems(e.target.value)} placeholder="예) 유통기한이 짧음, 불량률 높음" /></div>
            <div><label className={LABEL}>보유 인력/장비</label><input className={F} value={resources} onChange={(e) => setResources(e.target.value)} placeholder="예) 식품기사 1명, 배합 설비" /></div>
            <div><label className={LABEL}>설립 목적</label><input className={F} value={purpose} onChange={(e) => setPurpose(e.target.value)} /></div>
          </div>
          <div className="flex flex-col">
            <label className={LABEL}>생성된 프롬프트</label>
            <textarea
              readOnly
              value={prompt}
              className="mt-1 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm leading-relaxed text-slate-700"
              rows={16}
            />
            <button
              type="button"
              onClick={copy}
              className="mt-3 w-full rounded-xl bg-violet-600 px-5 py-3.5 text-lg font-bold text-white hover:bg-violet-700"
            >
              {copied ? "복사 완료 ✓ — GPT에 붙여넣으세요" : "프롬프트 복사"}
            </button>
            <p className="mt-2 text-center text-sm text-slate-500">
              현재 입력 정보 기준 연구과제 후보를 도출하는 용도입니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────── 공용 컴포넌트 ───────────────── */

const INPUT =
  "mt-1 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-base focus:border-navy-600 focus:outline-none focus:ring-1 focus:ring-navy-600";

const LABEL = "text-sm font-bold text-slate-600";

function Card({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold text-slate-600">{label}</label>
      {children}
    </div>
  );
}

/** 최종학력별 연구개발 경력 요건 안내 박스 */
function EduGuide({ education, cert, researchYears }: { education: EducationLevel; cert: CertLevel; researchYears: number }) {
  const proExpert = education === "전문학사(3년제)" || education === "전문학사(2년제)";
  const highschool = education === "마이스터고·특성화고 졸업" || education === "고졸 이하";
  const needsCareer = proExpert || highschool;
  const certBased = cert !== "없음";

  let box: { tone: "blue" | "amber"; text: string };
  if (proExpert) box = { tone: "amber", text: "전문학사는 연구개발 경력 요건 확인이 필요합니다. (자연계 2년제 전문학사: 경력 2년 이상 / 3년제: 1년 이상)" };
  else if (highschool) box = { tone: "amber", text: "고졸 이하 후보자는 연구개발 경력 및 자격요건 확인이 중요합니다. (마이스터고·특성화고 졸업·기능사: 경력 4년 이상)" };
  else box = { tone: "blue", text: "해당 전공 학위 기준으로 경력 없이도 검토 가능합니다. (전공이 자연계 계열인지 확인하세요)" };

  const cls = box.tone === "blue" ? "border-sky-200 bg-sky-50 text-sky-800" : "border-amber-200 bg-amber-50 text-amber-800";
  return (
    <div className={`mt-3 rounded-lg border px-3 py-2 text-sm leading-relaxed ${cls}`}>
      {box.text}
      {certBased ? <p className="mt-1 text-sky-800">국가기술자격({cert}) 기반 검토 가능 — 자격증 사본을 준비하세요.</p> : null}
      {needsCareer && researchYears <= 0 ? (
        <p className="mt-1 inline-block rounded-md bg-status-danger px-2 py-0.5 text-xs font-bold text-white">경력 0년 — 경력 확인 필요</p>
      ) : null}
    </div>
  );
}

function SectionRow({
  label,
  verdict,
  notes,
}: {
  label: string;
  verdict: EligibilityVerdict | ActivityVerdict | FacilityVerdict;
  notes: string[];
}) {
  return (
    <div className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-700">{label}</p>
        <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${SECTION_TONE[verdict] ?? "bg-slate-100 text-slate-600 ring-slate-200"}`}>
          {verdict}
        </span>
      </div>
      {notes.length ? (
        <ul className="mt-1.5 space-y-1">
          {notes.map((n, i) => (
            <li key={i} className="text-xs leading-relaxed text-slate-500">
              · {n}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "good" | "warn";
}) {
  const color =
    tone === "good" ? "text-status-normal" : tone === "warn" ? "text-status-warning" : "text-slate-900";
  return (
    <div>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      <p className="text-[11px] text-slate-400">{label}</p>
    </div>
  );
}

function Toggle({
  label,
  value,
  onChange,
  small,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  small?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left ${
        small ? "text-xs" : "text-sm"
      } text-slate-700 hover:bg-slate-50`}
    >
      <span className="leading-tight">{label}</span>
      <span
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
          value ? "bg-navy-700" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
            value ? "left-4" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}
