

import type { BonusItem, DiagnosisInput } from "../../types";
import {
  CLARITY_OPTIONS,
  DEBT_RELIEF_OPTIONS,
  EXISTING_DEBT_LEVEL_OPTIONS,
  FACILITY_USE_OPTIONS,
  HIRING_PLAN_OPTIONS,
  NET_PROFIT_OPTIONS,
  PREMISES_OPTIONS,
  REVENUE_TREND_3Y_OPTIONS,
  SECOND_FINANCE_OPTIONS,
  WORKING_CAPITAL_USE_OPTIONS,
  YES_NO_UNKNOWN_OPTIONS,
  YOUTH_EMPLOYMENT_OPTIONS,
} from "../../types";

// 심층 진단 — 빠른 진단 TOP3 결과에 따라 필요한 질문 섹션만 조건부로 노출.
// 아코디언(details) 구조로 처음부터 40개 항목을 펼치지 않는다.

interface Props {
  value: DiagnosisInput;
  onChange: (value: DiagnosisInput) => void;
  onSubmit: () => void;
  topAgencies: string[]; // 빠른 진단 TOP3 기관명
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
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
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

function Accordion({
  title,
  badge,
  defaultOpen = false,
  children,
}: {
  title: string;
  badge: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-2xl border border-slate-100 bg-white shadow-sm"
    >
      <summary className="flex cursor-pointer items-center gap-2 px-5 py-4 text-sm font-bold text-slate-800 [&::-webkit-details-marker]:hidden">
        <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
          {badge}
        </span>
        {title}
        <span className="ml-auto text-slate-400 transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="grid gap-4 border-t border-slate-100 px-5 py-5">
        {children}
      </div>
    </details>
  );
}

const DEEP_BONUS: BonusItem[] = [
  "벤처기업",
  "이노비즈",
  "메인비즈",
  "여성기업",
  "사회적기업",
  "수출 실적",
  "정부 R&D 성공",
  "만39세 이하 청년기업",
  "매출 또는 영업이익 10% 이상 증가",
];

export default function DeepDiagnosisForm({
  value,
  onChange,
  onSubmit,
  topAgencies,
}: Props) {
  const set = <K extends keyof DiagnosisInput>(
    key: K,
    v: DiagnosisInput[K],
  ) => onChange({ ...value, [key]: v });

  const bonusItems = value.bonusItems ?? [];
  const toggleBonus = (b: BonusItem) => {
    const withoutNone: BonusItem[] = bonusItems.filter((x) => x !== "없음");
    const next = withoutNone.includes(b)
      ? withoutNone.filter((x) => x !== b)
      : [...withoutNone, b];
    onChange({ ...value, bonusItems: next });
  };
  const bonusChip = (b: BonusItem) => {
    const active = bonusItems.includes(b);
    return (
      <button
        key={b}
        type="button"
        onClick={() => toggleBonus(b)}
        className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
          active
            ? "border-blue-600 bg-blue-50 text-blue-700"
            : "border-slate-200 bg-white text-slate-600 hover:border-blue-300"
        }`}
      >
        {active ? "✓ " : ""}
        {b}
      </button>
    );
  };

  const has = (name: string) => topAgencies.some((a) => a.includes(name));
  const showTech = has("기술보증") || has("중소벤처");
  const showFinance = has("신용보증기금");
  const showSmallBiz = has("소상공인") || has("지역신용") || has("미소금융");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="space-y-4"
    >
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white">
          🔍 심층 진단
        </span>
        <span className="text-xs text-slate-500">
          빠른 진단 결과에 맞춰 필요한 질문만 골랐어요
        </span>
      </div>

      {/* 기보/중진공 후보 → 기술·시설 섹션 */}
      {showTech && (
        <Accordion title="기술·시설 확인 (기보/중진공 후보)" badge="기술" defaultOpen>
          <Field label="특허 / 기업부설연구소 보유">
            <div className="flex flex-wrap gap-2">
              {(["특허 보유", "기업부설연구소 보유"] as BonusItem[]).map(bonusChip)}
            </div>
          </Field>
          <Field label="기술성 설명 가능 여부">
            <ButtonGroup
              options={CLARITY_OPTIONS}
              value={value.techClarity ?? "미확인"}
              onSelect={(v) => set("techClarity", v)}
            />
          </Field>
          <Field label="시설투자 목적">
            <ButtonGroup
              options={FACILITY_USE_OPTIONS}
              value={value.facilityUse ?? "해당없음"}
              onSelect={(v) => set("facilityUse", v)}
            />
          </Field>
          <Field label="기계/설비 견적서 보유">
            <ButtonGroup
              options={YES_NO_UNKNOWN_OPTIONS}
              value={value.quoteReady ?? "미확인"}
              onSelect={(v) => set("quoteReady", v)}
            />
          </Field>
          <Field label="주요 거래처 보유">
            <ButtonGroup
              options={YES_NO_UNKNOWN_OPTIONS}
              value={value.majorClients ?? "미확인"}
              onSelect={(v) => set("majorClients", v)}
            />
          </Field>
          <Field label="생산성 개선 근거 보유">
            <ButtonGroup
              options={YES_NO_UNKNOWN_OPTIONS}
              value={value.productivityEvidence ?? "미확인"}
              onSelect={(v) => set("productivityEvidence", v)}
            />
          </Field>
        </Accordion>
      )}

      {/* 신보 후보 → 재무 섹션 */}
      {showFinance && (
        <Accordion title="재무·상환능력 확인 (신보 후보)" badge="재무" defaultOpen={!showTech}>
          <Field label="최근 3년 매출 추세">
            <ButtonGroup
              options={REVENUE_TREND_3Y_OPTIONS}
              value={value.revenueTrend3y ?? "미확인"}
              onSelect={(v) => set("revenueTrend3y", v)}
            />
          </Field>
          <Field label="당기순이익 상태">
            <ButtonGroup
              options={NET_PROFIT_OPTIONS}
              value={value.netProfit ?? "미확인"}
              onSelect={(v) => set("netProfit", v)}
            />
          </Field>
          <Field label="기대출 수준 (매출 대비)">
            <ButtonGroup
              options={EXISTING_DEBT_LEVEL_OPTIONS}
              value={value.existingDebtLevel ?? "미확인"}
              onSelect={(v) => set("existingDebtLevel", v)}
            />
          </Field>
          <Field label="부채비율 상태">
            <ButtonGroup
              options={["양호", "보통", "높음", "미확인"] as const}
              value={value.debtRatioStatus ?? "미확인"}
              onSelect={(v) => set("debtRatioStatus", v)}
            />
          </Field>
          <Field label="이자보상배수 상태">
            <ButtonGroup
              options={["양호", "보통", "낮음", "미확인"] as const}
              value={value.interestCoverage ?? "미확인"}
              onSelect={(v) => set("interestCoverage", v)}
            />
          </Field>
          {!showTech && (
            <Field label="주요 거래처 보유">
              <ButtonGroup
                options={YES_NO_UNKNOWN_OPTIONS}
                value={value.majorClients ?? "미확인"}
                onSelect={(v) => set("majorClients", v)}
              />
            </Field>
          )}
          <div className="grid gap-4 @min-[640px]:grid-cols-2">
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
        </Accordion>
      )}

      {/* 소진공/지역신보/미소금융 후보 → 소상공인 섹션 */}
      {showSmallBiz && (
        <Accordion
          title="소상공인 확인 (소진공/지역신보/미소금융 후보)"
          badge="소상공인"
          defaultOpen={!showTech && !showFinance}
        >
          <Field label="사업장 형태">
            <ButtonGroup
              options={PREMISES_OPTIONS}
              value={value.premises ?? "미확인"}
              onSelect={(v) => set("premises", v)}
            />
          </Field>
          <div className="grid gap-4 @min-[640px]:grid-cols-2">
            <Field label="최근 연체 여부">
              <ButtonGroup
                options={YES_NO_UNKNOWN_OPTIONS}
                value={value.recentDelinquency ?? "미확인"}
                onSelect={(v) => set("recentDelinquency", v)}
              />
            </Field>
            <Field label="신용회복·회생·파산 이력">
              <ButtonGroup
                options={DEBT_RELIEF_OPTIONS}
                value={value.debtRelief ?? "미확인"}
                onSelect={(v) => set("debtRelief", v)}
              />
            </Field>
          </div>
          <Field label="카드론/2금융권 사용">
            <ButtonGroup
              options={SECOND_FINANCE_OPTIONS}
              value={value.secondFinance ?? "미확인"}
              onSelect={(v) => set("secondFinance", v)}
            />
          </Field>
          <Field label="운전자금 사용 목적 (고금리 대환 포함)">
            <ButtonGroup
              options={WORKING_CAPITAL_USE_OPTIONS}
              value={value.workingCapitalUse ?? "해당없음"}
              onSelect={(v) => set("workingCapitalUse", v)}
            />
          </Field>
          <div className="grid gap-4 @min-[640px]:grid-cols-2">
            <Field label="임대차계약서 보유">
              <ButtonGroup
                options={YES_NO_UNKNOWN_OPTIONS}
                value={value.leaseReady ?? "미확인"}
                onSelect={(v) => set("leaseReady", v)}
              />
            </Field>
            <Field label="매출 증빙 가능">
              <ButtonGroup
                options={YES_NO_UNKNOWN_OPTIONS}
                value={value.salesEvidenceReady ?? "미확인"}
                onSelect={(v) => set("salesEvidenceReady", v)}
              />
            </Field>
          </div>
        </Accordion>
      )}

      {/* 고용/업셀링 판단 (공통) */}
      <Accordion title="고용·업셀링 판단" badge="고용">
        <div className="grid gap-4 @min-[640px]:grid-cols-2">
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
        <Field label="가족직원/등기임원 근무">
          <ButtonGroup
            options={YES_NO_UNKNOWN_OPTIONS}
            value={value.familyStaff ?? "미확인"}
            onSelect={(v) => set("familyStaff", v)}
          />
        </Field>
        <Field label="고용지원금 참여 이력">
          <div className="flex flex-wrap gap-2">
            {(["고용지원금 참여"] as BonusItem[]).map(bonusChip)}
          </div>
        </Field>
      </Accordion>

      {/* 가점 판단 (공통) */}
      <Accordion title="가점 판단" badge="가점">
        <Field label="보유 인증·가점 (복수 선택)">
          <div className="flex flex-wrap gap-2">{DEEP_BONUS.map(bonusChip)}</div>
        </Field>
      </Accordion>

      <button
        type="submit"
        className="w-full rounded-xl bg-slate-900 px-8 py-4 text-base font-semibold text-white shadow-sm transition-colors hover:bg-slate-800"
      >
        🔍 심층 진단 반영해 결과 업데이트
      </button>
    </form>
  );
}
