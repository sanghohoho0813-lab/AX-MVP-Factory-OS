import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import PageGuide from "../components/PageGuide";
import { ensureSeeded, getClients, getInspectionChecks, setInspectionChecks } from "../lib/storage";
import { INSPECTION_ITEMS, INSPECTION_POINTS } from "../lib/mockStage1";
import type { Client } from "../../types";

export default function InspectionPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState("");
  // D-94: 고객사마다 저장한다 (원본은 화면 안 ‘데모 체크’ — 나가면 사라졌다)
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    setChecked(new Set(getInspectionChecks(clientId)));
  }, [clientId]);

  useEffect(() => {
    ensureSeeded();
    const list = getClients();
    setClients(list);
    if (list[0]) setClientId(list[0].id);
  }, []);

  function toggle(key: string) {
    setChecked((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      setInspectionChecks(clientId, [...next]);
      return next;
    });
  }

  const total = INSPECTION_ITEMS.length;
  const done = checked.size;
  const rate = Math.round((done / total) * 100);
  const client = clients.find((c) => c.id === clientId);

  return (
    <Layout
      title="현장조사 대비"
      subtitle="현장조사 거부·방해·기피 시 인정취소 사유 — 평소에 준비해 둡니다"
    >
      <PageGuide
        id="inspection"
        purpose="현장실사·보완 요청에 대비해 연구공간·현판·연구기자재 상태를 점검합니다."
        when="실사 통보를 받았거나 평소 미리 대비할 때 사용합니다."
        result="실사 체크리스트, 보완 필요 항목, 사진 준비 상태를 얻습니다."
        steps={["공간요건 확인", "현판·사진 확인", "연구기자재 확인", "보완항목 정리"]}
      />
      {/* 고객사 선택 + 준비도 */}
      <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-semibold text-slate-700">점검 대상 고객사</label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-base focus:border-navy-600 focus:outline-none focus:ring-1 focus:ring-navy-600"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {client ? (
              <p className="mt-1.5 text-sm text-slate-500">
                {client.labType} · {client.labName || "—"}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-4">
            <div className="relative flex h-20 w-20 shrink-0 items-center justify-center">
              <svg viewBox="0 0 36 36" className="h-20 w-20 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="3.5" />
                <circle
                  cx="18" cy="18" r="15.9" fill="none"
                  stroke={rate >= 80 ? "#16a34a" : rate >= 50 ? "#3b82f6" : "#ca8a04"}
                  strokeWidth="3.5"
                  strokeDasharray={`${rate} 100`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute text-base font-bold text-slate-800">{rate}%</span>
            </div>
            <div>
              <p className="text-base font-bold text-slate-800">실사 대비 준비도</p>
              <p className="text-sm text-slate-500">{done}/{total} 항목 준비됨</p>
              <p className="mt-1 text-sm font-medium text-navy-600">
                {rate >= 80 ? "현장조사 대응 준비가 양호합니다" : rate >= 50 ? "일부 항목 보완을 권장합니다" : "보완 필요 항목이 많습니다"}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 현장조사 핵심 3대 포인트 */}
      <section className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {INSPECTION_POINTS.map((p) => {
          const items = INSPECTION_ITEMS.filter((i) => i.point === p.id);
          const done = items.filter((i) => checked.has(i.key)).length;
          return (
            <div key={p.id} className="rounded-2xl border-2 border-navy-100 bg-navy-50/60 p-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{p.icon}</span>
                <div>
                  <p className="text-lg font-bold text-navy-800">{p.title}</p>
                  <p className="text-xs text-navy-700/70">{p.desc}</p>
                </div>
                <span className="ml-auto text-sm font-bold text-navy-700">{done}/{items.length}</span>
              </div>
            </div>
          );
        })}
      </section>

      {/* 체크리스트 (3대 포인트별) */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-card">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">실사 대비 체크리스트</h2>
          <p className="mt-0.5 text-sm text-slate-500">편람 현장조사 보고서 체크포인트 기반 · <span className="font-semibold text-amber-700">노란색 강조</span> 항목은 현장조사에서 자주 문제됩니다</p>
        </div>
        {INSPECTION_POINTS.map((p) => {
          const items = INSPECTION_ITEMS.filter((i) => i.point === p.id);
          return (
            <div key={p.id} className="border-t border-slate-100 first:border-t-0">
              <p className="bg-slate-50/70 px-5 py-2 text-sm font-bold text-slate-600">{p.icon} {p.title} — {p.desc}</p>
              <div className="divide-y divide-slate-50">
                {items.map((item) => {
                  const on = checked.has(item.key);
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => toggle(item.key)}
                      className={`flex w-full items-start gap-3 px-5 py-4 text-left hover:bg-slate-50/60 ${item.emphasis ? "bg-amber-50/40" : ""}`}
                    >
                      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold ${on ? "border-status-normal bg-status-normal text-white" : "border-slate-300 text-transparent"}`}>✓</span>
                      <div>
                        <p className={`text-base font-semibold ${item.emphasis ? "text-amber-800" : on ? "text-slate-800" : "text-slate-600"}`}>
                          {item.emphasis ? "★ " : ""}{item.label}
                        </p>
                        <p className="mt-0.5 text-sm text-slate-500">{item.hint}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>

      {/* 안내 */}
      <section className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-5">
        <p className="text-base leading-relaxed text-slate-600">
          💡 사후관리 요구 시 <span className="font-semibold text-slate-600">설립·변경신고 서류 사본, 연구전담요원
          자격증명·인사발령 서류, 연구개발활동 증명 문서(연구노트·연구보고서 등)</span>는 언제든지 제출할 수
          있어야 합니다. 매월 연구노트를 정리해 두는 것이 가장 확실한 실사 대비입니다.
        </p>
      </section>
    </Layout>
  );
}
