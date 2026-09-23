

import { useState, useSyncExternalStore } from "react";
import type { PlanChecklist, PlanChecklistKey } from "../../types";
import { PLAN_CHECKLIST_ITEMS } from "../../types";

// 작업9: 사업계획 체크리스트 — 체크하면 localStorage 에 저장되어 새로고침해도 유지된다.
// storageKey 로 고객/회사를 구분한다(리포트·상세 어디서든 재사용 가능).

const STORAGE_PREFIX = "planChecklist:";
const noopSubscribe = () => () => {};

const EMPTY: PlanChecklist = PLAN_CHECKLIST_ITEMS.reduce((acc, item) => {
  acc[item.key] = false;
  return acc;
}, {} as PlanChecklist);

function load(key: string): PlanChecklist {
  if (typeof window === "undefined") return { ...EMPTY };
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return { ...EMPTY };
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<PlanChecklist>) };
  } catch {
    return { ...EMPTY };
  }
}

function save(key: string, value: PlanChecklist) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch {
    /* 저장 실패는 무시 (프라이빗 모드 등) */
  }
}

export default function PlanChecklistCard({ storageKey }: { storageKey: string }) {
  // SSR 안전: 하이드레이션 전에는 항상 미체크로 렌더해 서버/클라이언트 불일치를 막는다.
  const isHydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const [state, setState] = useState<PlanChecklist>(() => load(storageKey));

  const toggle = (key: PlanChecklistKey) => {
    const next = { ...state, [key]: !state[key] };
    setState(next);
    save(storageKey, next);
  };

  const done = isHydrated
    ? PLAN_CHECKLIST_ITEMS.filter((i) => state[i.key]).length
    : 0;
  const total = PLAN_CHECKLIST_ITEMS.length;

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-lg font-bold">
          <span className="text-xl">✅</span>
          사업계획 체크리스트
        </h3>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-blue-700">
          {done} / {total}
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        승인되는 사업계획의 10가지 논리 — 체크하면 자동 저장돼요.
      </p>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-blue-500 transition-all"
          style={{ width: `${(done / total) * 100}%` }}
        />
      </div>
      <ul className="mt-4 grid gap-2 @min-[640px]:grid-cols-2">
        {PLAN_CHECKLIST_ITEMS.map((item) => {
          const checked = isHydrated && state[item.key];
          return (
            <li key={item.key}>
              <button
                type="button"
                onClick={() => toggle(item.key)}
                className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  checked
                    ? "border-green-200 bg-green-50/60 text-slate-500"
                    : "border-slate-100 bg-slate-50 text-slate-700 hover:border-blue-200"
                }`}
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold ${
                    checked
                      ? "border-green-400 bg-green-500 text-white"
                      : "border-blue-300 text-blue-500"
                  }`}
                >
                  {checked ? "✓" : "☐"}
                </span>
                <span className={checked ? "line-through" : ""}>{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
