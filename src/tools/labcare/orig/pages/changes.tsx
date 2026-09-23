import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import OsAttach from "../components/OsAttach";
import { changeDeadlines } from "../../lib/toolDeadlines";
import PageGuide from "../components/PageGuide";
import { useScrollRestore, setSession, getSession } from "../lib/uiState";
import {
  addChangeRecord,
  deleteChangeRecord,
  ensureSeeded,
  getChangeRecordsByClient,
  getCheckLogs,
  getClients,
  getReminder,
  isCheckDue,
  markReminderChecked,
  nextCheckDate,
  setReminderCycle,
  updateChangeRecord,
  type ChangeRecord,
  type ChangeRecStatus,
} from "../lib/storage";
import { ddayOf } from "../lib/mockStage1";
import type { Client } from "../../types";

// 실무에서 자주 쓰는 변경사유 (인력 관련이 가장 빈번 → 상단)
const REASONS = [
  "연구전담요원 퇴사",
  "연구전담요원 입사/충원",
  "연구전담요원 교체",
  "연구원 연봉 변경",
  "연구소 소재지 이전",
  "연구공간 변경",
  "연구기자재 변경",
];

const STATUSES: ChangeRecStatus[] = ["확인 필요", "변경 예정", "신고 준비중", "신고 완료"];
const STATUS_STYLE: Record<ChangeRecStatus, string> = {
  "확인 필요": "bg-amber-50 text-amber-700 ring-amber-200",
  "변경 예정": "bg-blue-50 text-blue-700 ring-blue-200",
  "신고 준비중": "bg-indigo-50 text-indigo-700 ring-indigo-200",
  "신고 완료": "bg-status-normalBg text-status-normal ring-green-200",
};
const DDAY_STYLE: Record<string, string> = {
  ok: "bg-slate-100 text-slate-600 ring-slate-200",
  warn: "bg-amber-50 text-amber-700 ring-amber-200",
  danger: "bg-status-dangerBg text-status-danger ring-red-200",
  over: "bg-red-600 text-white ring-red-700",
};

const CYCLES: { m: number; desc: string }[] = [
  { m: 1, desc: "매월 말 정기 확인이 필요한 고객사" },
  { m: 2, desc: "비교적 변동 가능성이 있는 고객사" },
  { m: 3, desc: "일반 관리 고객사" },
  { m: 6, desc: "변동이 적은 고객사" },
  { m: 12, desc: "최소 관리 고객사 — 장기간 방치 주의" },
];

function defaultRequestText(): string {
  const now = new Date();
  const ym = `${now.getFullYear()}년 ${now.getMonth() + 1}월`;
  return [
    "대표님, 안녕하세요.",
    "",
    `${ym} 연구소/연구개발전담부서 사후관리 안내드립니다.`,
    "",
    "이번 달 연구노트 작성과 함께, 아래 변경사항이 있는지도 확인 부탁드립니다.",
    "",
    "- 연구전담요원 퇴사/입사/교체",
    "- 연구전담요원 담당업무 또는 연봉 변동",
    "- 연구소/전담부서 소재지 또는 연구공간 변경",
    "- 연구기자재 변경",
    "- 기타 신고정보 변경사항",
    "",
    "위 사유들 중 해당되는 부분이 있으면 발생일로부터 30일 이내에 변경신고가 필수입니다.",
    "해당되는 내용이 있으면 미리 알려주시기 바랍니다.",
    "",
    "이번 달 연구노트도 함께 전달해드리겠습니다.",
    "",
    "감사합니다.",
  ].join("\n");
}

export default function ChangesPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [activeId, setActiveId] = useState("");
  const [records, setRecords] = useState<ChangeRecord[]>([]);
  const [cycle, setCycle] = useState(1);
  const [pickReasons, setPickReasons] = useState<string[]>([]);
  const [customReason, setCustomReason] = useState("");
  const [memo, setMemo] = useState("");
  const [reqOpen, setReqOpen] = useState(false);
  const [reqText, setReqText] = useState("");
  const [copied, setCopied] = useState(false);
  const [checkedMsg, setCheckedMsg] = useState(false);
  const [tick, setTick] = useState(0); // 재조회용

  useEffect(() => {
    ensureSeeded();
    const list = getClients();
    setClients(list);
    // 딥링크: /changes?client=xxx → 해당 고객사 선택 (없으면 직전 선택 복원)
    const param = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("lab") ?? new URLSearchParams(window.location.search).get("client") : null;
    const stored = getSession("changes:active");
    if (param && list.some((c) => c.id === param)) setActiveId(param);
    else if (stored && list.some((c) => c.id === stored)) setActiveId(stored);
    else if (list[0]) setActiveId(list[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { if (activeId) setSession("changes:active", activeId); }, [activeId]);
  useScrollRestore("changes", clients.length > 0);

  useEffect(() => {
    if (!activeId) return;
    setRecords(getChangeRecordsByClient(activeId));
    setCycle(getReminder(activeId).cycleMonths);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, tick]);

  const active = clients.find((c) => c.id === activeId);
  const dueClients = clients.filter((c) => isCheckDue(getReminder(c.id)));
  const reminder = activeId ? getReminder(activeId) : null;
  const checkLogs = activeId ? getCheckLogs(activeId) : [];

  function toggleReason(r: string) {
    setPickReasons((arr) => (arr.includes(r) ? arr.filter((x) => x !== r) : [...arr, r]));
  }

  function addRecord() {
    const reasons = [...pickReasons];
    if (customReason.trim()) reasons.push(customReason.trim());
    if (!activeId || !reasons.length) return;
    addChangeRecord({ clientId: activeId, reasons, memo: memo.trim() });
    setPickReasons([]);
    setCustomReason("");
    setMemo("");
    setTick((t) => t + 1);
  }

  function setStatus(id: string, status: ChangeRecStatus) {
    updateChangeRecord(id, { status, completedDate: status === "신고 완료" ? new Date().toISOString().slice(0, 10) : undefined });
    setTick((t) => t + 1);
  }
  function remove(id: string) {
    deleteChangeRecord(id);
    setTick((t) => t + 1);
  }
  function changeCycle(m: number) {
    if (!activeId) return;
    setReminderCycle(activeId, m);
    setCycle(m);
    setTick((t) => t + 1);
  }
  function checkedNow() {
    if (!activeId) return;
    markReminderChecked(activeId);
    setCheckedMsg(true);
    setTimeout(() => setCheckedMsg(false), 2500);
    setTick((t) => t + 1);
  }

  function openRequest() {
    setReqText(defaultRequestText());
    setReqOpen(true);
    setCopied(false);
  }
  async function copyReq() {
    try { await navigator.clipboard.writeText(reqText); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* 무시 */ }
  }

  return (
    <Layout
      title="변경사항 관리"
      subtitle="고객사별 변경 확인 주기를 관리하고, 변경사항을 추적해 30일 기한을 지킵니다"
      actions={
        <div className="flex items-center gap-2">
          <a href="https://www.rnd.or.kr/user/main.do" target="_blank" rel="noopener noreferrer"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-base font-bold text-slate-600 hover:bg-slate-50">
            KOITA 신고관리 ↗
          </a>
          <button
            type="button"
            onClick={openRequest}
            className="rounded-xl bg-status-danger px-5 py-2.5 text-base font-bold text-white shadow-sm hover:bg-red-700"
          >
            📨 변경 확인 요청문 만들기
          </button>
        </div>
      }
    >
      <PageGuide
        id="changes"
        purpose="연구전담요원·연구공간·기자재 등 변경신고 대상 사유를 정기적으로 확인합니다."
        when="월 단위로 변경 발생 여부를 점검할 때 사용합니다."
        result="변경 확인 주기, 확인 이력, 변경사유 기록, 카톡 요청문을 얻습니다."
        steps={["고객사 선택", "확인 주기 설정", "변경사유 확인", "요청문 복사", "확인 완료 처리"]}
      />
      {/* ── 관리할 고객사 선택 (최상단) ── */}
      <section className="mb-5 rounded-2xl border-2 border-navy-300 bg-white p-5 shadow-card">
        <label className="text-lg font-bold text-navy-800">① 관리할 고객사 선택</label>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <select
            value={activeId}
            onChange={(e) => setActiveId(e.target.value)}
            className="min-w-[280px] flex-1 rounded-xl border-2 border-slate-300 px-4 py-3 text-lg font-semibold focus:border-navy-600 focus:outline-none focus:ring-1 focus:ring-navy-600"
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.labType}{isCheckDue(getReminder(c.id)) ? " ● 확인 필요" : ""}
              </option>
            ))}
          </select>
          {active ? (
            <div className="rounded-xl bg-navy-50 px-4 py-2.5">
              <p className="text-lg font-bold text-navy-800">{active.name}</p>
              <p className="text-sm text-navy-700/70">{active.ceoName} 대표 · {active.labType}</p>
            </div>
          ) : null}
        </div>
        {active ? (
          <OsAttach
            clientId={active.id}
            title="연구소 기한"
            verdictLabel={`변경신고 ${records.filter((r) => r.status !== "신고 완료").length}건 · 활동조사 4/30`}
            summary={[
              `[${active.name} 연구소 기한 안내]`,
              ...changeDeadlines(records, new Date()).map((d) => `· ${d.date.replace(/-/g, ".")} — ${d.title}${d.note ? ` (${d.note})` : ""}`),
              "",
              "변경신고는 사유 발생일부터 30일 이내입니다. 기한을 넘기면 인정취소 사유가 될 수 있습니다.",
            ].join("\n")}
            data={{ kind: "deadlines", records }}
            deadlines={changeDeadlines(records, new Date())}
          />
        ) : null}
      </section>

      {/* ── 상단 핵심: 주기 알림 / 월간 루틴 / 요청문 ── */}
      <section className="mb-5 grid grid-cols-1 gap-4 @2xl:grid-cols-3">
        {/* 변경 확인 주기 알림 (선택 고객사 기준) */}
        <div className="rounded-2xl border-2 border-navy-200 bg-white p-5 shadow-card">
          <h3 className="text-base font-bold text-navy-800">⏰ 변경 확인 주기 알림</h3>
          <p className="mt-0.5 text-sm text-slate-500">선택 고객사 관리 주기{active ? <> — 현재: <b className="text-slate-700">{active.name}</b></> : ""}</p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {CYCLES.map(({ m }) => (
              <button key={m} type="button" onClick={() => changeCycle(m)}
                className={`rounded-lg border px-3 py-2 text-sm font-bold ${cycle === m ? "border-navy-600 bg-navy-700 text-white" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                {m}개월
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{CYCLES.find((c) => c.m === cycle)?.desc}</p>
          {reminder ? (
            <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2.5 text-sm">
              <p className="text-slate-600">마지막 확인: <b>{reminder.lastCheck.replace(/-/g, ".")}</b></p>
              <p className="mt-0.5 text-slate-600">
                다음 확인 예정: <b className={isCheckDue(reminder) ? "text-status-danger" : "text-navy-700"}>{nextCheckDate(reminder).replace(/-/g, ".")}</b>
                {isCheckDue(reminder) ? <span className="ml-1.5 rounded bg-status-danger px-1.5 py-0.5 text-xs font-bold text-white">이번 달 확인</span> : null}
              </p>
            </div>
          ) : null}
          <button type="button" onClick={checkedNow} className="mt-2 w-full rounded-lg border border-navy-200 px-4 py-2.5 text-base font-bold text-navy-700 hover:bg-navy-50">확인 완료 처리</button>
          {checkedMsg ? (
            <p className="mt-2 rounded-lg bg-status-normalBg px-3 py-2 text-sm font-bold text-status-normal">
              ✓ 확인 완료 처리되었습니다. 다음 확인일이 갱신되었습니다.
            </p>
          ) : null}
          {checkLogs.length ? (
            <div className="mt-2 max-h-24 overflow-y-auto rounded-lg border border-slate-100 px-3 py-2">
              <p className="text-xs font-bold text-slate-500">확인 이력</p>
              <ul className="mt-1 space-y-0.5">
                {checkLogs.slice(0, 6).map((l, i) => (
                  <li key={i} className="text-xs text-slate-500">{l.at.replace(/-/g, ".")} 변경사항 정기 확인 완료</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        {/* 월간 관리 루틴 */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <h3 className="text-base font-bold text-slate-800">📅 월간 관리 루틴</h3>
          <p className="mt-0.5 text-sm text-slate-500">매월 말 또는 설정 주기마다 함께 진행</p>
          <ul className="mt-2.5 space-y-2 text-base leading-relaxed text-slate-700">
            <li className="flex items-start gap-2"><span className="mt-1 h-5 w-5 shrink-0 rounded-full bg-navy-700 text-center text-xs font-bold leading-5 text-white">1</span>연구노트 작성 확인</li>
            <li className="flex items-start gap-2"><span className="mt-1 h-5 w-5 shrink-0 rounded-full bg-navy-700 text-center text-xs font-bold leading-5 text-white">2</span>변경사유 확인 (아래 사유 체크)</li>
            <li className="flex items-start gap-2"><span className="mt-1 h-5 w-5 shrink-0 rounded-full bg-navy-700 text-center text-xs font-bold leading-5 text-white">3</span>필요 시 변경신고 안내문 발송</li>
          </ul>
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">
            변경사항은 고객사가 먼저 알려주지 않는 경우가 많아, 컨설턴트의 정기 확인이 핵심입니다.
          </p>
        </div>

        {/* 변경 확인 요청문 */}
        <div className="rounded-2xl border-2 border-red-200 bg-red-50/40 p-5 shadow-card">
          <h3 className="text-base font-bold text-red-800">📨 변경 확인 요청문</h3>
          <p className="mt-0.5 text-sm leading-relaxed text-slate-600">
            연구노트와 변경사항 확인을 함께 안내하는 카톡용 요청문입니다. 내용을 수정한 뒤 복사해 사용하세요.
          </p>
          <button type="button" onClick={openRequest} className="mt-3 w-full rounded-xl bg-status-danger px-4 py-3 text-base font-bold text-white hover:bg-red-700">
            요청문 만들기 / 열기
          </button>
        </div>
      </section>

      {/* 요청문 편집 (열렸을 때 전체 폭) */}
      {reqOpen ? (
        <section className="mb-5 rounded-2xl border-2 border-red-200 bg-white p-5 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-bold text-slate-800">📨 변경 확인 요청문 (카톡용 · 수정 가능)</h3>
            <button type="button" onClick={() => setReqOpen(false)} className="text-xl text-slate-400 hover:text-slate-700">✕</button>
          </div>
          <p className="mt-1 text-sm text-slate-500">월·문구를 자유롭게 수정하세요. 복사는 아래 내용 그대로 복사됩니다.</p>
          <textarea
            value={reqText}
            onChange={(e) => setReqText(e.target.value)}
            rows={14}
            className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 text-base leading-relaxed text-slate-700 focus:border-navy-600 focus:outline-none"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={copyReq} className="flex-1 rounded-lg bg-navy-700 px-5 py-3 text-base font-bold text-white hover:bg-navy-800">{copied ? "복사 완료 ✓" : "본문 복사하기"}</button>
            <button type="button" onClick={() => setReqText(defaultRequestText())} className="rounded-lg border border-slate-300 px-4 py-3 text-base font-bold text-slate-600 hover:bg-slate-50">기본 문구로 초기화</button>
          </div>
        </section>
      ) : null}

      {/* 이번에 확인할 고객사 */}
      <section className="mb-5 rounded-2xl border-2 border-amber-200 bg-amber-50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-base font-bold text-amber-900">이번에 확인할 고객사 ({dueClients.length})</p>
          <p className="text-sm text-amber-800/80">클릭하면 해당 고객사가 바로 선택됩니다</p>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {dueClients.length ? dueClients.map((c) => (
            <button key={c.id} type="button" onClick={() => setActiveId(c.id)}
              className={`rounded-lg border px-3.5 py-2 text-sm font-bold ${c.id === activeId ? "border-amber-500 bg-amber-500 text-white" : "border-amber-300 bg-white text-amber-800 hover:bg-amber-100"}`}>
              {c.name}
            </button>
          )) : <p className="text-sm text-amber-800/70">지금 확인 주기가 도래한 고객사가 없습니다.</p>}
        </div>
      </section>

      {/* 변경사유 확인 */}
      <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        {active ? (
          <div>
            <p className="text-base font-bold text-slate-800">② {active.name} 변경사유 확인 <span className="ml-1 text-sm font-medium text-slate-400">(복수 선택 가능)</span></p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {REASONS.map((r) => {
                const on = pickReasons.includes(r);
                return (
                  <button key={r} type="button" onClick={() => toggleReason(r)}
                    className={`rounded-full border px-3.5 py-2 text-sm font-semibold ${on ? "border-navy-600 bg-navy-700 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                    {on ? "✓ " : ""}{r}
                  </button>
                );
              })}
              <input value={customReason} onChange={(e) => setCustomReason(e.target.value)} placeholder="기타 직접입력"
                className="min-w-[150px] rounded-full border border-dashed border-slate-300 px-3.5 py-2 text-sm focus:border-navy-600 focus:outline-none" />
            </div>
            <textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={2} placeholder="간단 메모 (예: 7/1자 퇴사, 후임 채용 진행)"
              className="mt-2 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-base focus:border-navy-600 focus:outline-none" />
            <button type="button" onClick={addRecord} disabled={!pickReasons.length && !customReason.trim()}
              className="mt-2 rounded-xl bg-navy-700 px-5 py-2.5 text-base font-bold text-white hover:bg-navy-800 disabled:opacity-40">
              변경사항 추가
            </button>
          </div>
        ) : null}
      </section>

      {/* 변경 기록 */}
      {active ? (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-card">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-bold text-slate-900">{active.name} 변경 기록 ({records.length})</h2>
            <p className="mt-0.5 text-sm text-slate-500">발생일 기준 30일 신고기한 자동 계산 · 신고는 KOITA 신고관리시스템에서 진행</p>
          </div>
          {records.length ? (
            <div className="divide-y divide-slate-50">
              {records.map((r) => {
                const done = r.status === "신고 완료";
                const d = ddayOf(r.deadline);
                return (
                  <div key={r.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-base font-semibold text-slate-900">{r.reasons.join(", ")}</p>
                        {r.memo ? <p className="mt-0.5 text-sm text-slate-600">{r.memo}</p> : null}
                        <p className="mt-0.5 text-sm text-slate-500">발생 {r.occurredDate.replace(/-/g, ".")} · 기한 {r.deadline.replace(/-/g, ".")}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {!done ? <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-sm font-bold ring-1 ring-inset ${DDAY_STYLE[d.tone]}`}>{d.label}</span> : null}
                        <select value={r.status} onChange={(e) => setStatus(r.id, e.target.value as ChangeRecStatus)}
                          className={`rounded-full border-0 px-3 py-1.5 text-sm font-bold ring-1 ring-inset focus:outline-none ${STATUS_STYLE[r.status]}`}>
                          {STATUSES.map((s) => <option key={s}>{s}</option>)}
                        </select>
                        <button type="button" onClick={() => remove(r.id)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-400 hover:border-red-200 hover:text-status-danger">✕</button>
                      </div>
                    </div>
                    {d.tone === "over" && !done ? (
                      <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">⚠ 신고기한(30일)이 지났습니다. 빠른 신고가 필요합니다.</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="px-5 py-8 text-center text-base text-slate-400">아직 등록된 변경 기록이 없습니다. 위에서 변경사유를 선택해 추가하세요.</p>
          )}
        </section>
      ) : null}

      {/* 안내 */}
      <section className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-5">
        <p className="text-sm leading-relaxed text-slate-500">
          💡 변경신고는 사유 발생일로부터 <b>30일 이내</b> 신고관리시스템(www.RND.or.kr)에서 진행합니다.
          연구전담요원·연구공간·소재지·기자재 변경 등이 대상이며, 사소한 변경도 수시 신고 대상일 수 있습니다.
        </p>
      </section>
    </Layout>
  );
}
