

import { useMemo, useState, useSyncExternalStore } from "react";
import Link from "../next";
import type { Customer, CustomerStage } from "../../types";
import { CUSTOMER_STAGES } from "../../types";
import { MOCK_CUSTOMERS } from "../stages";
import {
  getServerCustomers,
  getStoredCustomers,
  subscribeCustomers,
} from "../storage";
import { URGENCY_TIERS } from "../../coach";
import CustomerCard from "./CustomerCard";

function countStages(list: Customer[], stages: CustomerStage[]) {
  return list.filter((c) => stages.includes(c.stage)).length;
}

export default function DashboardView() {
  // localStorage 고객 (SSR 안전) — 저장 시 자동 갱신
  const stored = useSyncExternalStore(
    subscribeCustomers,
    getStoredCustomers,
    getServerCustomers,
  );

  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<"전체" | CustomerStage>("전체");

  // 저장 고객 우선, 동일 id의 Mock 고객은 제외하고 합친다.
  const merged = useMemo<Customer[]>(() => {
    const storedIds = new Set(stored.map((c) => c.id));
    return [...stored, ...MOCK_CUSTOMERS.filter((m) => !storedIds.has(m.id))];
  }, [stored]);

  const summaryCards = useMemo(
    () => [
      { label: "전체 고객", value: merged.length, accent: "text-slate-900" },
      {
        label: "상담 필요",
        value: countStages(merged, ["신규 DB", "재접촉 예정"]),
        accent: "text-blue-600",
      },
      {
        label: "서류 대기",
        value: countStages(merged, ["서류 요청", "서류 대기"]),
        accent: "text-amber-600",
      },
      {
        label: "접수 준비",
        value: countStages(merged, ["접수 준비", "접수 완료", "심사 중"]),
        accent: "text-violet-600",
      },
      {
        label: "승인 완료",
        value: countStages(merged, ["승인"]),
        accent: "text-green-600",
      },
    ],
    [merged],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return merged.filter((c) => {
      const matchStage = stageFilter === "전체" || c.stage === stageFilter;
      const matchQuery =
        q === "" ||
        c.companyName.toLowerCase().includes(q) ||
        c.industry.toLowerCase().includes(q);
      return matchStage && matchQuery;
    });
  }, [merged, query, stageFilter]);

  const storedIds = useMemo(() => new Set(stored.map((c) => c.id)), [stored]);

  return (
    <section className="mx-auto w-full max-w-6xl px-6 pt-12 pb-20 @min-[640px]:pt-16">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight @min-[640px]:text-3xl">
          고객 관리 대시보드
        </h1>
        <p className="text-slate-600">
          관리 중인 고객의 진행 상태와 다음 액션을 한눈에 확인하세요.
        </p>
      </div>

      {/* 상단 요약 카드 */}
      <div className="mt-8 grid grid-cols-2 gap-4 @min-[640px]:grid-cols-3 @min-[1024px]:grid-cols-5">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
          >
            <p className="text-sm text-slate-500">{card.label}</p>
            <p className={`mt-2 text-3xl font-bold ${card.accent}`}>
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* 검색 + 필터 + 새 진단 */}
      <div className="mt-10 flex flex-col gap-3 @min-[640px]:flex-row @min-[640px]:items-center @min-[640px]:justify-between">
        <h2 className="text-lg font-bold">고객 리스트</h2>
        <div className="flex flex-col gap-3 @min-[640px]:flex-row @min-[640px]:items-center">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="회사명·업종 검색"
            className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100 @min-[640px]:w-56"
          />
          <select
            value={stageFilter}
            onChange={(e) =>
              setStageFilter(e.target.value as "전체" | CustomerStage)
            }
            className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-100 @min-[640px]:w-auto"
          >
            <option value="전체">전체 단계</option>
            {CUSTOMER_STAGES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <Link
            href="/diagnosis"
            className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-center text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            + 새 진단하기
          </Link>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-10 rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-slate-500">
          {merged.length === 0 ? "아직 상담 중인 업체가 없습니다. 진단 결과 아래 '고객으로 저장하기' 에서 고객 운영 업체를 고르면 여기에 올라옵니다." : "조건에 맞는 고객이 없습니다."}
        </p>
      ) : (
        <div className="mt-6 space-y-8" data-testid="pf-customer-list">
          {URGENCY_TIERS.map((tier) => {
            const group = filtered.filter((c) => tier.stages.includes(c.stage));
            if (group.length === 0) return null;
            return (
              <div key={tier.key}>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{tier.emoji}</span>
                  <h3 className="text-base font-bold text-slate-800">
                    {tier.label}
                  </h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tier.chip}`}
                  >
                    {group.length}
                  </span>
                </div>
                <div className="mt-3 grid gap-4 @min-[640px]:grid-cols-2">
                  {group.map((c) => (
                    <CustomerCard
                      key={c.id}
                      customer={c}
                      isStored={storedIds.has(c.id)}
                      borderClass={tier.border}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
