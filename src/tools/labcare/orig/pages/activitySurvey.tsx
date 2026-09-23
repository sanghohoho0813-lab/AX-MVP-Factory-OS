import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import PageGuide from "../components/PageGuide";
import { useScrollRestore, setSession, getSession } from "../lib/uiState";
import {
  addSurveyMemo,
  ensureSeeded,
  getClients,
  getSurveyState,
  setSurveyYearStatus,
  SURVEY_YEARS,
  type SurveySimpleStatus,
} from "../lib/storage";
import { isSurveySeason, surveyDeadlineLabel } from "../lib/mockStage1";
import type { Client } from "../../types";

const STATUSES: SurveySimpleStatus[] = ["제출 전", "자료 요청 중", "제출 완료"];
const STATUS_STYLE: Record<SurveySimpleStatus, string> = {
  "제출 전": "bg-slate-100 text-slate-600 ring-slate-200",
  "자료 요청 중": "bg-amber-50 text-amber-700 ring-amber-200",
  "제출 완료": "bg-status-normalBg text-status-normal ring-green-200",
};

export default function ActivitySurveyPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [activeId, setActiveId] = useState("");
  const [memo, setMemo] = useState("");
  const [tick, setTick] = useState(0); // 재조회용

  useEffect(() => {
    ensureSeeded();
    const list = getClients();
    setClients(list);
    const stored = getSession("survey:active");
    if (stored && list.some((c) => c.id === stored)) setActiveId(stored);
    else if (list[0]) setActiveId(list[0].id);
  }, []);

  useEffect(() => { if (activeId) setSession("survey:active", activeId); }, [activeId]);
  useScrollRestore("activity-survey", clients.length > 0);

  const active = clients.find((c) => c.id === activeId);
  const state = activeId ? getSurveyState(activeId) : null;

  // 올해(마지막 연도) 기준 제출 완료율
  const thisYear = SURVEY_YEARS[SURVEY_YEARS.length - 1];
  const submitted = clients.filter((c) => getSurveyState(c.id).years[String(thisYear)] === "제출 완료").length;
  const rate = clients.length ? Math.round((submitted / clients.length) * 100) : 0;

  function setStatus(year: number, status: SurveySimpleStatus) {
    if (!activeId) return;
    setSurveyYearStatus(activeId, year, status);
    setTick((t) => t + 1);
  }

  function saveMemo() {
    if (!activeId || !memo.trim()) return;
    addSurveyMemo(activeId, memo.trim());
    setMemo("");
    setTick((t) => t + 1);
  }

  return (
    <Layout
      title="연구개발활동조사 관리"
      subtitle="실제 제출은 신고관리시스템에서 — 여기서는 업체별 연도 상태와 이력만 관리합니다"
      actions={
        <a href="https://www.rnd.or.kr/user/main.do" target="_blank" rel="noopener noreferrer"
          className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-base font-bold text-slate-600 hover:bg-slate-50">
          KOITA 신고관리 ↗
        </a>
      }
    >
      <PageGuide
        id="activity-survey"
        purpose="연도별 연구개발활동조사 제출 상태를 관리합니다."
        when="매년 활동조사 시즌(4월) 전후 점검할 때 사용합니다."
        result="2024/2025/2026 제출 상태, 업체별 이력, KOITA 신고관리시스템 연결을 얻습니다."
        steps={["고객사 선택", "연도 선택", "상태 저장", "필요 시 KOITA 신고관리시스템 접속"]}
      />
      {/* 마감 안내 배너 */}
      <section className={`mb-5 rounded-2xl px-6 py-5 shadow-card ${isSurveySeason() ? "bg-amber-500 text-white" : "bg-navy-900 text-white"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-lg font-bold">다음 제출 마감: {surveyDeadlineLabel()}</p>
            <p className="mt-1 text-sm opacity-80">
              {isSurveySeason()
                ? "지금이 활동조사 시즌입니다. 고객사별 자료 수집과 제출을 서둘러 주세요."
                : "시즌 전입니다. 평소 연구노트·연구개발비 자료를 모아두면 4월 대응이 수월합니다."}
            </p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-bold">{rate}%</p>
            <p className="text-xs opacity-80">{thisYear}년 제출 완료율</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 @2xl:grid-cols-3" key={tick}>
        {/* 좌: 고객사 선택 + 연도별 상태 */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-card @2xl:col-span-2">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-bold text-slate-900">업체별 연도 상태</h2>
            <p className="mt-0.5 text-sm text-slate-500">고객사를 선택하고, 연도별 상태를 클릭으로 선택하세요</p>
          </div>
          <div className="p-5">
            <label className="text-lg font-bold text-navy-800">활동조사 관리할 고객사 선택</label>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <select
                value={activeId}
                onChange={(e) => { setActiveId(e.target.value); setMemo(""); }}
                className="min-w-[260px] flex-1 rounded-xl border-2 border-slate-300 px-4 py-3 text-lg font-semibold focus:border-navy-600 focus:outline-none focus:ring-1 focus:ring-navy-600"
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} · {c.labType}</option>
                ))}
              </select>
              {active ? (
                <div className="rounded-xl bg-navy-50 px-4 py-2.5">
                  <p className="text-lg font-bold text-navy-800">{active.name}</p>
                  <p className="text-sm text-navy-700/70">{active.ceoName} 대표 · {active.labType}</p>
                </div>
              ) : null}
            </div>

            {active && state ? (
              <div className="mt-4 space-y-3">
                {SURVEY_YEARS.map((year) => {
                  const cur = state.years[String(year)];
                  return (
                    <div key={year} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-4 py-3">
                      <p className="text-lg font-bold text-slate-800">{year}년</p>
                      <div className="flex flex-wrap gap-1.5">
                        {STATUSES.map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setStatus(year, s)}
                            className={`rounded-full px-3.5 py-2 text-sm font-bold ring-1 ring-inset ${
                              cur === s ? STATUS_STYLE[s] + " ring-2" : "bg-white text-slate-400 ring-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            {cur === s ? "✓ " : ""}{s}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            {/* 메모 입력 */}
            {active ? (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <label className="text-sm font-bold text-slate-600">메모 추가</label>
                <div className="mt-1 flex gap-2">
                  <input
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") saveMemo(); }}
                    placeholder="예: 2026년 자료 요청 중, 연구노트 보완 필요"
                    className="flex-1 rounded-lg border border-slate-300 px-3.5 py-2.5 text-base focus:border-navy-600 focus:outline-none"
                  />
                  <button type="button" onClick={saveMemo} disabled={!memo.trim()}
                    className="whitespace-nowrap rounded-lg bg-navy-700 px-4 py-2.5 text-base font-bold text-white hover:bg-navy-800 disabled:opacity-40">
                    저장
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {/* 우: 이력 로그 */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-card">
          <div className="border-b border-slate-200 px-5 py-4">
            <h3 className="text-base font-bold text-slate-800">{active?.name ?? ""} 이력</h3>
            <p className="mt-0.5 text-sm text-slate-500">상태 변경·메모가 누적됩니다</p>
          </div>
          <div className="max-h-[420px] overflow-y-auto p-5">
            {state?.logs.length ? (
              <ul className="space-y-2">
                {state.logs.map((l, i) => (
                  <li key={i} className="rounded-lg bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-700">
                    <span className="mr-2 font-mono text-xs text-slate-400">{l.at.replace(/-/g, ".")}</span>
                    {l.text}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-400">아직 기록이 없습니다. 연도 상태를 변경하거나 메모를 남기면 여기에 쌓입니다.</p>
            )}
          </div>
        </section>
      </div>

      {/* 전체 업체 활동조사 현황 */}
      <section className="mt-5 rounded-2xl border border-slate-200 bg-white shadow-card" key={`board-${tick}`}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">전체 업체 활동조사 현황</h2>
            <p className="mt-0.5 text-sm text-slate-500">행을 클릭하면 해당 업체가 선택됩니다</p>
          </div>
          <p className="rounded-lg bg-navy-50 px-3 py-1.5 text-sm font-bold text-navy-700">{thisYear}년 제출 완료 {submitted}/{clients.length} ({rate}%)</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-base">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-sm text-slate-500">
                <th className="px-5 py-2.5 font-bold">고객사</th>
                {SURVEY_YEARS.map((y) => <th key={y} className="px-3 py-2.5 text-center font-bold">{y}년</th>)}
                <th className="hidden px-3 py-2.5 font-bold @2xl:table-cell">최근 메모</th>
                <th className="hidden px-3 py-2.5 font-bold sm:table-cell">최종 수정일</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => {
                const s = getSurveyState(c.id);
                const last = s.logs[0];
                return (
                  <tr
                    key={c.id}
                    onClick={() => { setActiveId(c.id); setMemo(""); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                    className={`cursor-pointer border-b border-slate-50 hover:bg-slate-50/70 ${c.id === activeId ? "bg-navy-50/50" : ""}`}
                  >
                    <td className="px-5 py-3 font-semibold text-slate-800">{c.name}</td>
                    {SURVEY_YEARS.map((y) => {
                      const st = s.years[String(y)];
                      return (
                        <td key={y} className="px-3 py-3 text-center">
                          <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${STATUS_STYLE[st]}`}>{st}</span>
                        </td>
                      );
                    })}
                    <td className="hidden max-w-[260px] truncate px-3 py-3 text-sm text-slate-500 @2xl:table-cell">{last?.text ?? "—"}</td>
                    <td className="hidden whitespace-nowrap px-3 py-3 text-sm text-slate-500 sm:table-cell">{last ? last.at.replace(/-/g, ".") : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* 안내 */}
      <section className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-5">
        <p className="text-sm leading-relaxed text-slate-500">
          ⚠ 연구개발활동조사표는 매년 4월 30일까지 제출 의무이며, 미제출 시 인정취소 사유입니다 (법 제9조).
          실제 제출·작성은 <a href="https://www.rnd.or.kr/user/main.do" target="_blank" rel="noopener noreferrer" className="font-bold text-navy-700 underline">KOITA 신고관리시스템 ↗</a>에서 진행하세요.
        </p>
      </section>
    </Layout>
  );
}
