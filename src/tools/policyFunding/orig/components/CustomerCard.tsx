import { memo } from "react";
import Link from "../next";
import type { Customer } from "../../types";
import { STAGE_BADGE } from "../stages";
import {
  checklistProgress,
  closingVerdict,
  computeClosingScore,
} from "../../consultation";

function CustomerCardBase({
  customer: c,
  isStored,
  borderClass,
}: {
  customer: Customer;
  isStored: boolean;
  borderClass: string;
}) {
  const closing = computeClosingScore(c);
  const verdict = closingVerdict(closing);
  const closingCls =
    verdict.tone === "green"
      ? "bg-green-50 text-green-700"
      : verdict.tone === "amber"
        ? "bg-amber-50 text-amber-700"
        : "bg-slate-100 text-slate-600";
  const { done, total } = checklistProgress(c);

  return (
    <Link
      href={`/customers/${c.id}`}
      className={`group flex flex-col rounded-2xl border border-l-4 border-slate-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md ${borderClass}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-base font-bold text-slate-900 group-hover:text-blue-700">
              {c.companyName}
            </p>
            {isStored && (
              <span className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-600">
                저장됨
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-slate-500">{c.industry}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${STAGE_BADGE[c.stage]}`}
        >
          {c.stage}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-blue-50 px-2.5 py-0.5 font-medium text-blue-700">
          {c.recommendedAgency}
        </span>
        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-600">
          가능성 {c.score}점
        </span>
        <span className={`rounded-full px-2.5 py-0.5 font-medium ${closingCls}`}>
          계약 {closing}점 · {verdict.label}
        </span>
        {c.leadReaction && (
          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 font-medium text-indigo-700">
            {c.leadReaction}
          </span>
        )}
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>상담 체크리스트</span>
          <span className="font-medium text-slate-600">
            {done}/{total}
          </span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-blue-500"
            style={{ width: `${(done / total) * 100}%` }}
          />
        </div>
      </div>

      <div className="mt-4 border-t border-slate-100 pt-3">
        <p className="text-xs font-semibold text-slate-500">다음 액션</p>
        <p className="mt-1 text-sm text-slate-700">{c.nextAction}</p>
      </div>

      <p className="mt-3 text-xs text-slate-400">최근 업데이트 {c.updatedAt}</p>
    </Link>
  );
}

export default memo(CustomerCardBase);
