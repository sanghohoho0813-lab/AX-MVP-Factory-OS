

import type { BonusItem, DiagnosisInput, Strength } from "../../types";
import {
  ACTUAL_BUSINESS_OPTIONS,
  BIZ_PLAN_READINESS_OPTIONS,
  BONUS_ITEM_OPTIONS,
  BUSINESS_TYPES,
  CEO_AGE_OPTIONS,
  CEO_CAREER_OPTIONS,
  CLARITY_OPTIONS,
  CREDIT_BAND_OPTIONS,
  CREDIT_OPTIONS,
  DEBT_RELIEF_OPTIONS,
  EMPLOYEE_OPTIONS,
  EXISTING_DEBT_LEVEL_OPTIONS,
  FACILITY_USE_OPTIONS,
  FUNDING_SIZE_OPTIONS,
  HIRING_PLAN_OPTIONS,
  LAST_YEAR_REVENUE_OPTIONS,
  NET_PROFIT_OPTIONS,
  PREMISES_OPTIONS,
  PURPOSE_OPTIONS,
  REVENUE_OPTIONS,
  REVENUE_TREND_3Y_OPTIONS,
  SECOND_FINANCE_OPTIONS,
  SELF_FUNDING_OPTIONS,
  STRENGTH_OPTIONS,
  THIS_YEAR_TREND_OPTIONS,
  WORKING_CAPITAL_USE_OPTIONS,
  YEARS_OPTIONS,
  YES_NO_UNKNOWN_OPTIONS,
  YOUTH_EMPLOYMENT_OPTIONS,
} from "../../types";

interface Props {
  value: DiagnosisInput;
  onChange: (value: DiagnosisInput) => void;
  onSubmit: () => void;
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}

// 인콜 질문지 섹션 구분 (A~G)
function Section({
  no,
  title,
  desc,
  children,
}: {
  no: string;
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-8 border-t border-slate-100 pt-6 first:mt-0 first:border-t-0 first:pt-0">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-600 text-xs font-bold text-white">
          {no}
        </span>
        <h3 className="text-base font-bold text-slate-800">{title}</h3>
      </div>
      {desc && <p className="mt-1 text-xs text-slate-500">{desc}</p>}
      <div className="mt-4 grid gap-5">{children}</div>
    </div>
  );
}

function ButtonGroup<T extends string>({
  options,
  value,
  onSelect,
}: {
  options: readonly T[];
  value: T;
  onSelect: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = opt === value;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onSelect(opt)}
            className={`rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors ${
              active
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-700"
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

export default function DiagnosisForm({ value, onChange, onSubmit }: Props) {
  const set = <K extends keyof DiagnosisInput>(
    key: K,
    v: DiagnosisInput[K],
  ) => onChange({ ...value, [key]: v });

  const toggleStrength = (s: Strength) => {
    if (s === "없음") {
      onChange({ ...value, strengths: value.strengths.includes("없음") ? [] : ["없음"] });
      return;
    }
    const withoutNone = value.strengths.filter((x) => x !== "없음");
    const next = withoutNone.includes(s)
      ? withoutNone.filter((x) => x !== s)
      : [...withoutNone, s];
    onChange({ ...value, strengths: next });
  };

  const bonusItems = value.bonusItems ?? [];
  const toggleBonus = (b: BonusItem) => {
    if (b === "없음") {
      onChange({ ...value, bonusItems: bonusItems.includes("없음") ? [] : ["없음"] });
      return;
    }
    const withoutNone = bonusItems.filter((x) => x !== "없음");
    const next = withoutNone.includes(b)
      ? withoutNone.filter((x) => x !== b)
      : [...withoutNone, b];
    onChange({ ...value, bonusItems: next });
  };

  const inputClass =
    "w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm @min-[640px]:p-8"
    >
      {/* ── A. 기본 정보 ── */}
      <Section no="A" title="기본 정보" desc="인콜 1~2번 질문 — 무슨 일을, 얼마나 오래">
        <div className="grid gap-5 @min-[640px]:grid-cols-2">
          <Field label="회사명">
            <input
              className={inputClass}
              placeholder="예: (주)한빛정밀"
              value={value.companyName}
              onChange={(e) => set("companyName", e.target.value)}
            />
          </Field>
          <Field label="업종 (업태/주 생산품목)">
            <input
              className={inputClass}
              placeholder="예: 자동차부품 제조"
              value={value.industry}
              onChange={(e) => set("industry", e.target.value)}
            />
          </Field>
        </div>
        <Field label="실제 하는 일 분류">
          <ButtonGroup
            options={ACTUAL_BUSINESS_OPTIONS}
            value={value.actualBusiness ?? "기타"}
            onSelect={(v) => set("actualBusiness", v)}
          />
        </Field>
        <Field label="사업자 구분">
          <ButtonGroup
            options={BUSINESS_TYPES}
            value={value.businessType}
            onSelect={(v) => set("businessType", v)}
          />
        </Field>
        <Field label="업력">
          <ButtonGroup
            options={YEARS_OPTIONS}
            value={value.years}
            onSelect={(v) => set("years", v)}
          />
        </Field>
        <Field label="대표자 동종업계 경력">
          <ButtonGroup
            options={CEO_CAREER_OPTIONS}
            value={value.ceoCareer ?? "미확인"}
            onSelect={(v) => set("ceoCareer", v)}
          />
        </Field>
        <Field label="대표자 나이">
          <ButtonGroup
            options={CEO_AGE_OPTIONS}
            value={value.ceoAge ?? "미확인"}
            onSelect={(v) => set("ceoAge", v)}
          />
        </Field>
        <Field label="사업장 형태">
          <ButtonGroup
            options={PREMISES_OPTIONS}
            value={value.premises ?? "미확인"}
            onSelect={(v) => set("premises", v)}
          />
        </Field>
      </Section>

      {/* ── B. 매출 상세 ── */}
      <Section no="B" title="매출 상세" desc="인콜 5번 질문 — 상환 능력 (기관이 가장 중요하게 봄)">
        <Field label="연매출 (간이)">
          <ButtonGroup
            options={REVENUE_OPTIONS}
            value={value.revenue}
            onSelect={(v) => set("revenue", v)}
          />
        </Field>
        <Field label="전년도 매출 구간 (정확 신고 기준)">
          <ButtonGroup
            options={LAST_YEAR_REVENUE_OPTIONS}
            value={value.lastYearRevenue ?? "미확인"}
            onSelect={(v) => set("lastYearRevenue", v)}
          />
        </Field>
        <Field label="최근 3년 매출 추세">
          <ButtonGroup
            options={REVENUE_TREND_3Y_OPTIONS}
            value={value.revenueTrend3y ?? "미확인"}
            onSelect={(v) => set("revenueTrend3y", v)}
          />
        </Field>
        <Field label="올해 현재 매출 추세">
          <ButtonGroup
            options={THIS_YEAR_TREND_OPTIONS}
            value={value.thisYearTrend ?? "미확인"}
            onSelect={(v) => set("thisYearTrend", v)}
          />
        </Field>
        <Field label="당기순이익 상태">
          <ButtonGroup
            options={NET_PROFIT_OPTIONS}
            value={value.netProfit ?? "미확인"}
            onSelect={(v) => set("netProfit", v)}
          />
        </Field>
      </Section>

      {/* ── C. 신용/부채/체납 ── */}
      <Section no="C" title="신용 · 부채 · 체납" desc="인콜 7~8번 질문 — 대출 한도와 신용 기본 조건">
        <Field label="대표자 신용 상태 (간이)">
          <ButtonGroup
            options={CREDIT_OPTIONS}
            value={value.credit}
            onSelect={(v) => set("credit", v)}
          />
        </Field>
        <Field label="KCB/NICE 신용 구간">
          <ButtonGroup
            options={CREDIT_BAND_OPTIONS}
            value={value.creditBand ?? "미확인"}
            onSelect={(v) => set("creditBand", v)}
          />
        </Field>
        <Field label="최근 연체 여부">
          <ButtonGroup
            options={YES_NO_UNKNOWN_OPTIONS}
            value={value.recentDelinquency ?? "미확인"}
            onSelect={(v) => set("recentDelinquency", v)}
          />
        </Field>
        <Field label="신용회복 · 회생 · 파산 이력">
          <ButtonGroup
            options={DEBT_RELIEF_OPTIONS}
            value={value.debtRelief ?? "미확인"}
            onSelect={(v) => set("debtRelief", v)}
          />
        </Field>
        <div className="grid gap-5 @min-[640px]:grid-cols-2">
          <Field label="국세/지방세 체납">
            <ButtonGroup
              options={YES_NO_UNKNOWN_OPTIONS}
              value={value.taxArrears ?? "미확인"}
              onSelect={(v) => set("taxArrears", v)}
            />
          </Field>
          <Field label="4대보험 체납">
            <ButtonGroup
              options={YES_NO_UNKNOWN_OPTIONS}
              value={value.insuranceArrears ?? "미확인"}
              onSelect={(v) => set("insuranceArrears", v)}
            />
          </Field>
        </div>
        <Field label="기대출 수준 (매출 대비)">
          <ButtonGroup
            options={EXISTING_DEBT_LEVEL_OPTIONS}
            value={value.existingDebtLevel ?? "미확인"}
            onSelect={(v) => set("existingDebtLevel", v)}
          />
        </Field>
        <Field label="2금융권 / 카드론 / 현금서비스 사용">
          <ButtonGroup
            options={SECOND_FINANCE_OPTIONS}
            value={value.secondFinance ?? "미확인"}
            onSelect={(v) => set("secondFinance", v)}
          />
        </Field>
      </Section>

      {/* ── D. 자금 목적 ── */}
      <Section no="D" title="자금 목적" desc="운전/시설 구분과 필요 규모 — 자기자금 준비 여부까지">
        <Field label="자금 목적 (대분류)">
          <ButtonGroup
            options={PURPOSE_OPTIONS}
            value={value.purpose}
            onSelect={(v) => set("purpose", v)}
          />
        </Field>
        <Field label="운전자금 세부 목적">
          <ButtonGroup
            options={WORKING_CAPITAL_USE_OPTIONS}
            value={value.workingCapitalUse ?? "해당없음"}
            onSelect={(v) => set("workingCapitalUse", v)}
          />
        </Field>
        <Field label="시설자금 세부 목적">
          <ButtonGroup
            options={FACILITY_USE_OPTIONS}
            value={value.facilityUse ?? "해당없음"}
            onSelect={(v) => set("facilityUse", v)}
          />
        </Field>
        <div className="grid gap-5 @min-[640px]:grid-cols-2">
          <Field label="필요자금 규모">
            <ButtonGroup
              options={FUNDING_SIZE_OPTIONS}
              value={value.fundingSize ?? "미확인"}
              onSelect={(v) => set("fundingSize", v)}
            />
          </Field>
          <Field label="자기자금 준비 여부">
            <ButtonGroup
              options={SELF_FUNDING_OPTIONS}
              value={value.selfFunding ?? "미확인"}
              onSelect={(v) => set("selfFunding", v)}
            />
          </Field>
        </div>
      </Section>

      {/* ── E. 고용/운영 ── */}
      <Section no="E" title="고용 · 운영" desc="인콜 3번 질문 — 운영 능력">
        <Field label="4대보험 가입 직원 수">
          <ButtonGroup
            options={EMPLOYEE_OPTIONS}
            value={value.employees}
            onSelect={(v) => set("employees", v)}
          />
        </Field>
        <div className="grid gap-5 @min-[640px]:grid-cols-2">
          <Field label="추가채용 계획">
            <ButtonGroup
              options={HIRING_PLAN_OPTIONS}
              value={value.hiringPlan ?? "미확인"}
              onSelect={(v) => set("hiringPlan", v)}
            />
          </Field>
          <Field label="청년 고용 여부">
            <ButtonGroup
              options={YOUTH_EMPLOYMENT_OPTIONS}
              value={value.youthEmployment ?? "미확인"}
              onSelect={(v) => set("youthEmployment", v)}
            />
          </Field>
        </div>
        <Field label="가족 직원 / 등기임원 근무 여부">
          <ButtonGroup
            options={YES_NO_UNKNOWN_OPTIONS}
            value={value.familyStaff ?? "미확인"}
            onSelect={(v) => set("familyStaff", v)}
          />
        </Field>
      </Section>

      {/* ── F. 가점/강점 ── */}
      <Section no="F" title="가점 · 강점" desc="가점 리스트 기반 — 면담 때 눈으로 보여줄 수 있는 것들 (복수 선택)">
        <Field label="보유 강점 (간이, 복수 선택)">
          <div className="flex flex-wrap gap-2">
            {STRENGTH_OPTIONS.map((s) => {
              const active = value.strengths.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleStrength(s)}
                  className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-slate-200 bg-white text-slate-600 hover:border-blue-300"
                  }`}
                >
                  {active ? "✓ " : ""}
                  {s}
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="가점 항목 (복수 선택)">
          <div className="flex flex-wrap gap-2">
            {BONUS_ITEM_OPTIONS.map((b) => {
              const active = bonusItems.includes(b);
              return (
                <button
                  key={b}
                  type="button"
                  onClick={() => toggleBonus(b)}
                  className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-slate-200 bg-white text-slate-600 hover:border-blue-300"
                  }`}
                >
                  {active ? "✓ " : ""}
                  {b}
                </button>
              );
            })}
          </div>
        </Field>
      </Section>

      {/* ── G. 사업계획/실사 준비 ── */}
      <Section no="G" title="사업계획 · 실사 준비" desc="면담 포인트 — 말보다 눈으로 보여줄 준비">
        <div className="grid gap-5 @min-[640px]:grid-cols-2">
          <Field label="자금 사용처 설명 가능">
            <ButtonGroup
              options={CLARITY_OPTIONS}
              value={value.fundUseClarity ?? "미확인"}
              onSelect={(v) => set("fundUseClarity", v)}
            />
          </Field>
          <Field label="향후 성장계획">
            <ButtonGroup
              options={CLARITY_OPTIONS}
              value={value.growthPlan ?? "미확인"}
              onSelect={(v) => set("growthPlan", v)}
            />
          </Field>
          <Field label="주요 거래처 보유">
            <ButtonGroup
              options={YES_NO_UNKNOWN_OPTIONS}
              value={value.majorClients ?? "미확인"}
              onSelect={(v) => set("majorClients", v)}
            />
          </Field>
          <Field label="기계/설비/제품 사진·자료">
            <ButtonGroup
              options={YES_NO_UNKNOWN_OPTIONS}
              value={value.assetEvidence ?? "미확인"}
              onSelect={(v) => set("assetEvidence", v)}
            />
          </Field>
        </div>
        <Field label="사업계획서 준비 수준">
          <ButtonGroup
            options={BIZ_PLAN_READINESS_OPTIONS}
            value={value.bizPlanReadiness ?? "미확인"}
            onSelect={(v) => set("bizPlanReadiness", v)}
          />
        </Field>
        <Field label="상담 메모">
          <textarea
            className={`${inputClass} min-h-24 resize-y`}
            placeholder="상담 중 파악한 특이사항, 대표 니즈 등을 적어두세요."
            value={value.memo}
            onChange={(e) => set("memo", e.target.value)}
          />
        </Field>
      </Section>

      <button
        type="submit"
        className="mt-8 w-full rounded-xl bg-blue-600 px-8 py-4 text-base font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
      >
        진단 결과 보기
      </button>
    </form>
  );
}
