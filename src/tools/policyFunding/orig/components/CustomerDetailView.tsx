

import { useState, useSyncExternalStore } from "react";
import Link from "../next";
import { useRouter } from "../nav";
import type {
  ConsultationChecklist,
  ConsultationChecklistKey,
  Customer,
  CustomerStage,
  LeadReaction,
} from "../../types";
import { CUSTOMER_STAGES } from "../../types";
import { STAGE_BADGE } from "../stages";
import {
  deleteCustomer,
  getServerCustomers,
  getStoredCustomers,
  saveCustomer,
  subscribeCustomers,
} from "../storage";
import {
  CHECKLIST_ITEMS,
  buildConsultationMessages,
  checklistProgress,
  closingVerdict,
  computeClosingScore,
  LEAD_REACTIONS,
  normalizeChecklist,
  reactionResponse,
} from "../../consultation";
import { customerTodayTasks } from "../../coach";
import CopyMessage from "./CopyMessage";

// useSyncExternalStore 로 서버/클라이언트 렌더를 구분해 하이드레이션 안전하게 처리
const noopSubscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

const DOC_CHECKLIST = [
  "사업자등록증",
  "부가세과세표준증명",
  "재무제표 또는 손익자료",
  "4대보험 가입자명부",
  "국세/지방세 납세증명서",
  "신용정보 확인 관련 자료",
  "임대차계약서 또는 사업장 자료",
  "자금 사용 계획 자료",
];

function receivedDocCount(stage: CustomerStage): number {
  switch (stage) {
    case "신규 DB":
    case "재접촉 예정":
      return 0;
    case "1차 상담 완료":
    case "계약 검토":
      return 1;
    case "서류 요청":
      return 2;
    case "보류":
    case "실패":
      return 3;
    case "서류 대기":
      return 4;
    case "접수 준비":
      return 7;
    default:
      return 8;
  }
}

const TONE = {
  green: { text: "text-green-600", chip: "bg-green-100 text-green-700", bar: "bg-green-500" },
  amber: { text: "text-amber-600", chip: "bg-amber-100 text-amber-700", bar: "bg-amber-500" },
  slate: { text: "text-slate-600", chip: "bg-slate-100 text-slate-700", bar: "bg-slate-400" },
} as const;

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section className="mx-auto w-full max-w-4xl px-6 pt-10 pb-20 @min-[640px]:pt-14">
      {children}
    </section>
  );
}

// 실제 편집 UI — 고객이 확정된 뒤에만 마운트되어 useState 로 안전하게 초기화된다.
function CustomerEditor({
  customer,
  isStored,
}: {
  customer: Customer;
  isStored: boolean;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<CustomerStage>(customer.stage);
  const [nextAction, setNextAction] = useState(customer.nextAction);
  const [memo, setMemo] = useState(customer.memo);
  const [checklist, setChecklist] = useState<ConsultationChecklist>(() =>
    normalizeChecklist(customer.consultationChecklist),
  );
  const [reaction, setReaction] = useState<LeadReaction | null>(
    customer.leadReaction ?? null,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [doneToday, setDoneToday] = useState<Record<string, boolean>>({});

  const received = receivedDocCount(stage);
  const todayList = customerTodayTasks({ ...customer, stage, nextAction });
  const closing = computeClosingScore({ score: customer.score, memo, consultationChecklist: checklist });
  const verdict = closingVerdict(closing);
  const tone = TONE[verdict.tone];
  const progress = checklistProgress({ consultationChecklist: checklist });

  const messages = buildConsultationMessages({
    ...customer,
    nextAction,
    leadReaction: reaction,
  });

  const showNotice = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(null), 2500);
  };

  // 항상 최신 로컬 상태 + override 를 합쳐 저장하고 closingScore 를 재계산한다.
  const persist = (override: Partial<Customer>, msg = "저장되었습니다.") => {
    const next: Customer = {
      ...customer,
      stage,
      nextAction,
      memo,
      consultationChecklist: checklist,
      leadReaction: reaction,
      ...override,
    };
    next.closingScore = computeClosingScore(next);
    saveCustomer(next);
    showNotice(msg);
  };

  const toggleChecklist = (key: ConsultationChecklistKey) => {
    const nextChecklist = { ...checklist, [key]: !checklist[key] };
    setChecklist(nextChecklist);
    persist({ consultationChecklist: nextChecklist }, "체크리스트 저장됨");
  };

  const chooseReaction = (r: LeadReaction) => {
    const nextReaction = reaction === r ? null : r;
    setReaction(nextReaction);
    persist({ leadReaction: nextReaction }, "대표 반응 저장됨");
  };

  const handleSave = () => persist({});

  const handleDelete = () => {
    const ok = window.confirm(`'${customer.companyName}' 상담 기록을 지울까요? (고객 관리 업체는 그대로 남습니다)`);
    if (!ok) return;
    deleteCustomer(customer.id);
    router.push("/dashboard");
  };

  return (
    <Shell>
      {/* 상단: 뒤로 + 진단 다시하기 */}
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/dashboard"
          className="text-sm font-medium text-slate-500 transition-colors hover:text-blue-700"
        >
          ← 고객관리로
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href={`/customers/${customer.id}/report`}
            className="rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50"
          >
            상담 리포트 보기
          </Link>
          <Link
            href={`/diagnosis?client=${customer.id}`}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            진단 다시하기
          </Link>
        </div>
      </div>

      {/* 저장 안내 */}
      {notice && (
        <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          ✅ {notice}
        </div>
      )}

      {/* 오늘 해야 할 일 (최상단) */}
      <div className="mt-5 rounded-3xl border-2 border-blue-100 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <span className="text-xl">📌</span> 오늘 해야 할 일
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {customer.companyName} · 지금 진행단계에서 챙길 것들이에요.
        </p>
        <div className="mt-4 space-y-2">
          {todayList.map((t) => {
            const done = doneToday[t];
            return (
              <button
                key={t}
                type="button"
                onClick={() => setDoneToday((p) => ({ ...p, [t]: !p[t] }))}
                className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                  done
                    ? "border-slate-100 bg-slate-50 text-slate-400"
                    : "border-blue-100 bg-blue-50/50 text-slate-800 hover:border-blue-300"
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[11px] font-bold ${
                    done ? "bg-slate-400 text-white" : "border border-blue-400 text-transparent"
                  }`}
                >
                  ✓
                </span>
                <span className={done ? "line-through" : "font-medium"}>{t}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 회사 기본 정보 */}
      <div className="mt-5 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm @min-[640px]:p-8">
        <div className="flex flex-col items-start justify-between gap-4 @min-[640px]:flex-row @min-[640px]:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight @min-[640px]:text-3xl">
                {customer.companyName}
              </h1>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${STAGE_BADGE[stage]}`}
              >
                {stage}
              </span>
              {!isStored && (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                  샘플 데이터
                </span>
              )}
            </div>
            <p className="mt-2 text-slate-500">
              {customer.industry} · {customer.businessType}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold text-slate-500">가능성 점수</p>
            <p className="text-3xl font-bold text-blue-600">
              {customer.score}
              <span className="text-base text-slate-400"> / 100</span>
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 @min-[640px]:grid-cols-2">
          <InfoTile label="추천 기관" value={customer.recommendedAgency} />
          <InfoTile
            label="최근 연락 / 업데이트"
            value={`${customer.lastContactedAt} / ${customer.updatedAt}`}
          />
          {/* [D-94] 고객 ID(내부 번호)는 보이지 않는다 — 업체는 고객 운영 업체로 이어진다 */}
        </div>
      </div>

      {/* 계약 가능성 점수 */}
      <div className="mt-6 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm @min-[640px]:p-8">
        <div className="flex flex-col items-start justify-between gap-4 @min-[640px]:flex-row @min-[640px]:items-center">
          <div>
            <p className="text-sm font-semibold text-slate-500">계약 가능성</p>
            <div className="mt-1 flex items-end gap-3">
              <span className={`text-4xl font-bold ${tone.text}`}>{closing}</span>
              <span className="pb-1 text-sm text-slate-400">/ 100</span>
              <span
                className={`mb-1 rounded-full px-3 py-1 text-xs font-semibold ${tone.chip}`}
              >
                {verdict.label}
              </span>
            </div>
          </div>
          <p className="text-sm text-slate-500">
            상담 체크리스트{" "}
            <span className="font-semibold text-slate-700">
              {progress.done}/{progress.total}
            </span>{" "}
            완료
          </p>
        </div>
        <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full ${tone.bar}`}
            style={{ width: `${closing}%` }}
          />
        </div>
      </div>

      {/* 진행 관리 (편집) */}
      <div className="mt-6 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold">⚙️ 진행 관리</h2>
        <div className="mt-4 grid gap-4">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-slate-700">진행단계</span>
            <select
              value={stage}
              data-stage-for={customer.id}
              onChange={(e) => setStage(e.target.value as CustomerStage)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100 @min-[640px]:w-64"
            >
              {CUSTOMER_STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-slate-700">다음 액션</span>
            <input
              value={nextAction}
              onChange={(e) => setNextAction(e.target.value)}
              placeholder="다음에 해야 할 일을 입력하세요"
              className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-slate-700">상담 메모</span>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="상담 내용, 특이사항 등을 기록하세요 (30자 이상이면 계약 가능성 점수 +10)"
              className="min-h-28 w-full resize-y rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </label>

          <div className="flex flex-col gap-3 @min-[640px]:flex-row">
            <button
              type="button"
              onClick={handleSave}
              className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              저장
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="rounded-xl border border-red-200 bg-white px-6 py-3 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
            >
              상담 기록 삭제
            </button>
          </div>
        </div>
      </div>

      {/* 상담 진행 체크리스트 */}
      <div className="mt-6 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">✅ 상담 진행 체크리스트</h2>
          <span className="text-sm font-medium text-slate-500">
            {progress.done} / {progress.total}
          </span>
        </div>
        <div className="mt-4 grid gap-2 @min-[640px]:grid-cols-2">
          {CHECKLIST_ITEMS.map((item) => {
            const done = checklist[item.key];
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => toggleChecklist(item.key)}
                className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-left text-sm transition-colors ${
                  done
                    ? "border-blue-200 bg-blue-50/60 text-blue-900"
                    : "border-slate-100 bg-slate-50 text-slate-600 hover:border-blue-200"
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[11px] font-bold ${
                    done
                      ? "bg-blue-600 text-white"
                      : "border border-slate-300 text-transparent"
                  }`}
                >
                  ✓
                </span>
                <span className={done ? "font-medium" : ""}>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 대표 반응 기록 */}
      <div className="mt-6 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold">🙋 대표 반응</h2>
        <p className="mt-1 text-sm text-slate-500">
          대표님 반응을 선택하면 상황에 맞는 대응 멘트를 추천해드려요.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {LEAD_REACTIONS.map((r) => {
            const active = reaction === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => chooseReaction(r)}
                className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-700"
                }`}
              >
                {r}
              </button>
            );
          })}
        </div>
        {reaction && (
          <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
            <p className="text-xs font-semibold text-blue-700">
              추천 대응 멘트 · {reaction}
            </p>
            <p className="mt-1.5 text-sm leading-6 text-slate-700">
              {reactionResponse(reaction)}
            </p>
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-6 @min-[1024px]:grid-cols-2">
        {/* 서류 체크리스트 */}
        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">📄 서류 체크리스트</h2>
            <span className="text-sm font-medium text-slate-500">
              {received} / {DOC_CHECKLIST.length}
            </span>
          </div>
          <ul className="mt-4 space-y-2">
            {DOC_CHECKLIST.map((doc, idx) => {
              const done = idx < received;
              return (
                <li
                  key={doc}
                  className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                      done
                        ? "bg-green-500 text-white"
                        : "border border-slate-300 text-slate-300"
                    }`}
                  >
                    {done ? "✓" : ""}
                  </span>
                  <span
                    className={
                      done ? "text-slate-400 line-through" : "text-slate-700"
                    }
                  >
                    {doc}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* 업셀링 기회 */}
        <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold">📈 업셀링 기회</h2>
          {customer.upsellOpportunities.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {customer.upsellOpportunities.map((u) => (
                <span
                  key={u}
                  className="rounded-full border border-blue-100 bg-blue-50/60 px-3 py-1.5 text-sm font-medium text-blue-800"
                >
                  {u}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">
              등록된 업셀링 기회가 없습니다.
            </p>
          )}
        </div>
      </div>

      {/* 복사 가능한 상담 메시지 */}
      <div className="mt-6 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold">💬 복사 가능한 상담 메시지</h2>
        <p className="mt-1 text-sm text-slate-500">
          현재 고객 정보·추천기관·대표 반응에 맞춰 자동 생성됩니다.
        </p>
        <div className="mt-4 space-y-4">
          {messages.map((m) => (
            <CopyMessage key={m.key} label={m.label} text={m.text} />
          ))}
        </div>
      </div>
    </Shell>
  );
}

export default function CustomerDetailView({
  id,
  initialCustomer,
}: {
  id: string;
  initialCustomer: Customer | null;
}) {
  const isHydrated = useSyncExternalStore(
    noopSubscribe,
    clientSnapshot,
    serverSnapshot,
  );
  const stored = useSyncExternalStore(
    subscribeCustomers,
    getStoredCustomers,
    getServerCustomers,
  );

  // 하이드레이션 전에는 골격만 보여준다.
  if (!isHydrated) {
    return (
      <Shell>
        <div className="rounded-3xl border border-slate-100 bg-white p-10 text-center text-slate-400 shadow-sm">
          고객 정보를 불러오는 중…
        </div>
      </Shell>
    );
  }

  const storedCustomer = stored.find((c) => c.id === id);
  const customer = storedCustomer ?? initialCustomer;

  if (!customer) {
    return (
      <Shell>
        <div className="rounded-3xl border border-slate-100 bg-white p-10 text-center shadow-sm">
          <p className="text-lg font-semibold text-slate-800">
            고객을 찾을 수 없습니다.
          </p>
          <p className="mt-2 text-sm text-slate-500">
            삭제되었거나 잘못된 주소일 수 있어요.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-block rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            고객 관리로 돌아가기
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <CustomerEditor
      key={customer.id}
      customer={customer}
      isStored={Boolean(storedCustomer)}
    />
  );
}
