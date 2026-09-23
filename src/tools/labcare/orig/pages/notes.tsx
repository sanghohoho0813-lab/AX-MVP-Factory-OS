import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "../next";
import { useSearchParams } from "../nav";
import Layout from "../components/Layout";
import PageGuide from "../components/PageGuide";
import {
  currentMonth,
  ensureSeeded,
  getClient,
  getClients,
  getNoteFor,
  getProject,
  getProjectsByClient,
  saveNote,
} from "../lib/storage";
import { checkRelevance, enhanceForAudit, generateNoteDraft } from "../lib/noteDraft";
import type {
  Client,
  NoteStatus,
  ResearcherRole,
  ResearchProject,
} from "../../types";

const NOTE_STATUS_STYLE: Record<NoteStatus, string> = {
  "작성 필요": "bg-amber-50 text-amber-700 ring-amber-200",
  작성중: "bg-blue-50 text-blue-700 ring-blue-200",
  "초안 완료": "bg-indigo-50 text-indigo-700 ring-indigo-200",
  "실사보완 완료": "bg-violet-50 text-violet-700 ring-violet-200",
  "저장 완료": "bg-status-normalBg text-status-normal ring-green-200",
};

function NotesWorkspace() {
  const search = useSearchParams();

  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<ResearchProject[]>([]);

  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [month, setMonth] = useState(currentMonth());

  const [activities, setActivities] = useState("");
  const [tests, setTests] = useState("");
  const [problems, setProblems] = useState("");
  const [nextPlan, setNextPlan] = useState("");
  const [roles, setRoles] = useState<ResearcherRole[]>([{ name: "", role: "" }]);
  const [relevance, setRelevance] = useState("");

  const [draft, setDraft] = useState("");
  const [tab, setTab] = useState<"app" | "gpt">("app");
  const [promptCopied, setPromptCopied] = useState(false);
  const [showStorage, setShowStorage] = useState(false);
  const [showFolder, setShowFolder] = useState(false);
  const [confirmedReal, setConfirmedReal] = useState(false);
  const [auditReviewed, setAuditReviewed] = useState(false);
  const [status, setStatus] = useState<NoteStatus>("작성 필요");
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // 초기 로드 + 쿼리 파라미터 선택
  useEffect(() => {
    ensureSeeded();
    setClients(getClients());
    const c = search.get("client") ?? "";
    const p = search.get("project") ?? "";
    const m = search.get("month") ?? currentMonth();
    if (c) setClientId(c);
    if (p) setProjectId(p);
    setMonth(m);
  }, [search]);

  // 고객사 변경 시 과제 목록 갱신
  useEffect(() => {
    if (!clientId) {
      setProjects([]);
      return;
    }
    const list = getProjectsByClient(clientId);
    setProjects(list);
    // 선택된 과제가 이 고객사 소속이 아니면 초기화
    if (projectId && !list.some((p) => p.id === projectId)) setProjectId("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  // 과제+월 확정 시 기존 노트 불러오기 (편집)
  useEffect(() => {
    if (!projectId || !month) return;
    const existing = getNoteFor(projectId, month);
    if (existing) {
      setActivities(existing.activities);
      setTests(existing.tests);
      setProblems(existing.problems);
      setNextPlan(existing.nextPlan);
      setRoles(existing.roles.length ? existing.roles : [{ name: "", role: "" }]);
      setRelevance(existing.relevance);
      setDraft(existing.draft);
      setAuditReviewed(existing.auditReviewed);
      setStatus(existing.status);
    } else {
      setActivities("");
      setTests("");
      setProblems("");
      setNextPlan("");
      setRoles([{ name: "", role: "" }]);
      setRelevance("");
      setDraft("");
      setAuditReviewed(false);
      setStatus("작성 필요");
    }
    setSavedAt(null);
  }, [projectId, month]);

  const client = clientId ? getClient(clientId) : undefined;
  const project = projectId ? getProject(projectId) : undefined;

  const relevanceCheck = useMemo(() => {
    if (!project) return null;
    return checkRelevance({ activities, relevance }, project);
  }, [project, activities, relevance]);

  const noteInput = () => ({
    activities,
    tests,
    problems,
    nextPlan,
    roles: roles.filter((r) => r.name || r.role),
    relevance,
    month,
  });

  function handleGenerate() {
    if (!client || !project) return;
    setDraft(generateNoteDraft(noteInput(), client, project));
    setAuditReviewed(false);
    setStatus("초안 완료");
    setSavedAt(null);
  }

  function handleAudit() {
    if (!project || !draft) return;
    setDraft(enhanceForAudit(draft, project));
    setAuditReviewed(true);
    setStatus("실사보완 완료");
    setSavedAt(null);
  }

  /** 초안 뒤에 보강 블록을 덧붙이는 공통 처리 */
  function appendBlock(title: string, lines: string[]) {
    if (!draft) return;
    setDraft(draft + "\n\n─────────────────────────────\n" + `[${title}]\n` + lines.join("\n"));
    setSavedAt(null);
    if (status === "저장 완료") setStatus("작성중");
  }

  function handleProjectLink() {
    if (!project) return;
    appendBlock("연구과제 연결성 강화", [
      `· 본 활동은 연구과제 '${project.name}'의 ${month.replace("-", "년 ")}월 수행 내용입니다.`,
      "· 과제 목표 대비 이번 달 진척 사항과 해결한 기술적 문제를 위 본문에 구체적으로 연결했습니다.",
      "· 다음 달 계획은 과제의 잔여 목표와 직접 이어집니다.",
    ]);
  }

  function handleIndustryLink() {
    if (!project || !client) return;
    appendBlock("업종 관련성 보완", [
      `· 본 연구는 ${client.industry || "당사 업종"} 분야의 제품/서비스 '${project.productService || "주력 제품"}'와(과) 직접 연결됩니다.`,
      "· 연구 결과는 해당 제품/서비스의 성능·품질·공정 개선에 적용될 예정입니다.",
      "· 일반론이 아닌, 당사 제품 고유의 기술적 과제를 다루고 있음을 본문에서 확인할 수 있습니다.",
    ]);
  }

  function handleSplitRoles() {
    const filled = roles.filter((r) => r.name || r.role);
    if (!filled.length) return;
    appendBlock("연구원별 역할 구분", [
      ...filled.map(
        (r) => `· ${r.name || "(이름 미입력)"}: ${r.role || "(역할 미입력)"} — 수행 내용과 산출물을 개인별로 기록`,
      ),
      "· 각 연구원의 수행 일자·내용은 본문 활동 기록과 대응됩니다.",
    ]);
  }

  function handleSave() {
    if (!client || !project || !confirmedReal) return;
    saveNote({
      clientId: client.id,
      projectId: project.id,
      ...noteInput(),
      draft,
      auditReviewed,
      status: "저장 완료",
    });
    setStatus("저장 완료");
    setSavedAt(new Date().toLocaleString("ko-KR"));
  }

  const inputCls =
    "mt-1 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-base focus:border-navy-600 focus:outline-none focus:ring-1 focus:ring-navy-600";
  const labelCls = "text-sm font-semibold text-slate-700";

  return (
    <Layout
      title="연구노트 작성"
      subtitle="고객사 활동을 입력하면 연구노트 초안을 생성합니다"
      actions={
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-inset ${NOTE_STATUS_STYLE[status]}`}
        >
          {status}
        </span>
      }
    >
      <PageGuide
        id="notes"
        purpose="월별 연구활동과 연구노트 작성 상태를 관리합니다."
        when="매월 연구활동을 기록하고 점검할 때 사용합니다."
        result="연구활동 기록, 연구노트 작성 여부, 미작성 항목을 확인합니다."
        steps={["연구과제 선택", "월별 활동 입력", "연구노트 작성 상태 확인", "월간 리포트 반영"]}
      />
      {/* 법적 고지 / 면책 안내 */}
      <section className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
        <p className="text-base font-bold text-slate-800">⚖️ 이 기능을 사용하기 전에 확인해 주세요</p>
        <ul className="mt-2 space-y-1 text-sm leading-relaxed text-slate-600">
          <li>· 이 기능은 <b>실제 연구를 수행하는 회사</b>가 연구노트 작성 방법을 모를 때 참고하는 <b>보조자료</b>입니다.</li>
          <li>· 실제 연구활동 없이 연구노트만 작성한다고 연구소/전담부서 인정요건이 충족되는 것은 아닙니다.</li>
          <li>· 허위 연구활동 작성, 소급 작성, 실제와 다른 자료 작성은 금지됩니다.</li>
          <li>· 세액공제·사후관리·현장조사·인정취소·세금 추징 관련 최종 결과는 회사와 담당 전문가의 실제 검토에 따라 달라질 수 있으며, 본 서비스는 법적·세무적 결과를 보장하지 않습니다.</li>
        </ul>
      </section>

      <div className="grid grid-cols-1 gap-5 @4xl:grid-cols-2">{/* [D-94] OS 목차 옆 칸에서는 좌우로 나누면 칸이 너무 좁다 */}
        {/* 좌: 입력 */}
        <div className="space-y-5">
          {/* 1. 대상 선택 */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-card">
            <h3 className="text-base font-bold text-slate-800">① 대상 선택</h3>
            <div className="mt-3 grid grid-cols-1 gap-3 @2xl:grid-cols-3 @4xl:grid-cols-1 @6xl:grid-cols-3">
              <div>
                <label className={labelCls}>고객사</label>
                <select
                  className={inputCls}
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                >
                  <option value="">선택</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>연구과제</label>
                <select
                  className={inputCls}
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  disabled={!clientId}
                >
                  <option value="">선택</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>대상 월</label>
                <input
                  type="month"
                  className={inputCls}
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                />
              </div>
            </div>
            {project ? (
              <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-base text-slate-600">
                제품/서비스: <span className="font-semibold text-slate-700">{project.productService}</span>
              </p>
            ) : null}
          </div>

          {project ? (
            <>
              {/* 2. 연구활동 입력 */}
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-card">
                <h3 className="text-base font-bold text-slate-800">② 이번 달 연구활동</h3>
                <div className="mt-3 space-y-3">
                  <div>
                    <label className={labelCls}>연구활동 (무엇을·어떻게·왜)</label>
                    <textarea
                      rows={3}
                      className={inputCls}
                      value={activities}
                      onChange={(e) => setActivities(e.target.value)}
                      placeholder="이번 달 실제로 진행한 연구개발 활동을 구체적으로 입력하세요."
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className={labelCls}>테스트 / 개선</label>
                      <textarea
                        rows={3}
                        className={inputCls}
                        value={tests}
                        onChange={(e) => setTests(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>문제점</label>
                      <textarea
                        rows={3}
                        className={inputCls}
                        value={problems}
                        onChange={(e) => setProblems(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>다음 계획</label>
                    <textarea
                      rows={2}
                      className={inputCls}
                      value={nextPlan}
                      onChange={(e) => setNextPlan(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* 3. 참여 연구원 역할 */}
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-card">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-800">③ 참여 연구원별 역할</h3>
                  <button
                    type="button"
                    onClick={() => setRoles((r) => [...r, { name: "", role: "" }])}
                    className="text-sm font-bold text-navy-600 hover:text-navy-800"
                  >
                    + 연구원 추가
                  </button>
                </div>
                <div className="mt-3 space-y-2">
                  {roles.map((r, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        className="w-32 rounded-lg border border-slate-300 px-3.5 py-2.5 text-base focus:border-navy-600 focus:outline-none focus:ring-1 focus:ring-navy-600"
                        placeholder="이름"
                        value={r.name}
                        onChange={(e) =>
                          setRoles((rs) =>
                            rs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)),
                          )
                        }
                      />
                      <input
                        className="flex-1 rounded-lg border border-slate-300 px-3.5 py-2.5 text-base focus:border-navy-600 focus:outline-none focus:ring-1 focus:ring-navy-600"
                        placeholder="역할 (예: 알고리즘 설계, 시험 평가)"
                        value={r.role}
                        onChange={(e) =>
                          setRoles((rs) =>
                            rs.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)),
                          )
                        }
                      />
                      {roles.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => setRoles((rs) => rs.filter((_, j) => j !== i))}
                          className="px-2 text-slate-400 hover:text-status-danger"
                        >
                          ✕
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              {/* 4. 업종/제품/서비스 관련성 */}
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-card">
                <h3 className="text-base font-bold text-slate-800">
                  ④ 업종·제품·서비스와의 직접 관련성
                </h3>
                <textarea
                  rows={3}
                  className={inputCls}
                  value={relevance}
                  onChange={(e) => setRelevance(e.target.value)}
                  placeholder={`'${project.productService}'와(과) 이 연구활동이 어떻게 직접 연결되는지 구체적으로 적으세요.`}
                />
                {relevanceCheck ? (
                  <div
                    className={`mt-3 rounded-lg p-3 text-xs ${
                      relevanceCheck.ok
                        ? "bg-status-normalBg text-status-normal"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    <p className="font-bold">
                      {relevanceCheck.ok
                        ? "✓ 업종·제품·서비스와의 직접 연결이 확인됩니다."
                        : "실사 대비 보완 권장 (일반적 서술은 지적 대상이 될 수 있습니다)"}
                    </p>
                    {!relevanceCheck.ok ? (
                      <ul className="mt-1 list-inside list-disc space-y-0.5">
                        {relevanceCheck.hints.map((h) => (
                          <li key={h}>{h}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-400">
              고객사와 연구과제를 먼저 선택하세요.
            </div>
          )}
        </div>

        {/* 우: 초안 미리보기 + 액션 (sticky) */}
        <div className="@4xl:col-span-1">
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-6 @4xl:sticky @4xl:top-24">
            {/* 탭: 앱 내 초안 / GPT 프롬프트 */}
            <div className="flex gap-2 rounded-xl bg-slate-100 p-1">
              <button type="button" onClick={() => setTab("app")} className={`flex-1 rounded-lg px-3 py-2.5 text-base font-bold ${tab === "app" ? "bg-white text-navy-700 shadow-sm" : "text-slate-500"}`}>앱 내 초안</button>
              <button type="button" onClick={() => setTab("gpt")} className={`flex-1 rounded-lg px-3 py-2.5 text-base font-bold ${tab === "gpt" ? "bg-white text-navy-700 shadow-sm" : "text-slate-500"}`}>GPT 프롬프트</button>
            </div>

            {tab === "gpt" ? (
              <GptPromptPanel
                prompt={buildGptPrompt({
                  clientName: client?.name, industry: client?.industry,
                  projectName: project?.name, month,
                  activities, tests, problems, nextPlan, relevance,
                  roles: roles.filter((r) => r.name || r.role),
                })}
                copied={promptCopied}
                onCopy={async (text) => {
                  try { await navigator.clipboard.writeText(text); setPromptCopied(true); setTimeout(() => setPromptCopied(false), 1500); } catch { /* 무시 */ }
                }}
                disabled={!project}
              />
            ) : (
            <>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800">연구노트 초안</h3>
              <span
                className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ring-inset ${NOTE_STATUS_STYLE[status]}`}
              >
                {status}
              </span>
            </div>

            <textarea
              rows={16}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm leading-relaxed text-slate-700 focus:border-navy-600 focus:outline-none focus:ring-1 focus:ring-navy-600"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="‘연구노트 초안 생성’을 누르면 입력한 활동을 바탕으로 초안이 생성됩니다."
            />

            {auditReviewed ? (
              <p className="text-xs font-semibold text-violet-700">
                ✓ 실사 대응 관점 보완이 반영되었습니다.
              </p>
            ) : null}

            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={!project}
                className="w-full rounded-xl bg-navy-700 px-5 py-3.5 text-lg font-bold text-white hover:bg-navy-800 disabled:opacity-40"
              >
                연구노트 초안 생성
              </button>
              <p className="text-center text-xs leading-relaxed text-slate-400">
                실제 수행한 활동 입력을 정리하는 초안입니다 — 허위·소급 작성 금지
              </p>

              {/* 실사 방어형 보강 버튼 4종 */}
              <div className="grid grid-cols-2 gap-2">
                <EnhanceBtn label="연구과제 연결성 강화" onClick={handleProjectLink} disabled={!draft} />
                <EnhanceBtn label="업종 관련성 보완" onClick={handleIndustryLink} disabled={!draft} />
                <EnhanceBtn label="실사 대응 문구 보완" onClick={handleAudit} disabled={!draft} />
                <EnhanceBtn label="연구원별 역할 나누기" onClick={handleSplitRoles} disabled={!draft} />
              </div>

              <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-3">
                <input
                  type="checkbox"
                  checked={confirmedReal}
                  onChange={(e) => setConfirmedReal(e.target.checked)}
                  className="mt-1 h-5 w-5 accent-navy-700"
                />
                <span className="text-sm leading-relaxed text-slate-700">
                  실제 수행한 연구활동을 바탕으로 작성하는 <b>보조자료</b>임을 확인했습니다.
                </span>
              </label>
              <button
                type="button"
                onClick={handleSave}
                disabled={!draft || !confirmedReal}
                title={!confirmedReal ? "위 확인 체크 후 저장할 수 있습니다" : undefined}
                className="w-full rounded-xl bg-status-normal px-5 py-3 text-base font-bold text-white hover:opacity-90 disabled:opacity-40"
              >
                연구노트 저장{!confirmedReal ? " (확인 체크 필요)" : ""}
              </button>
            </div>

            {savedAt ? (
              <p className="text-center text-sm font-semibold text-status-normal">
                저장 완료 · {savedAt}
              </p>
            ) : (
              <p className="text-center text-sm text-slate-500">
                생성 → 보강 → 저장 순으로 진행하세요.
              </p>
            )}

            {/* 보관 안내 버튼 3종 */}
            <div className="grid grid-cols-3 gap-2">
              <button type="button" onClick={() => { setShowStorage((v) => !v); setShowFolder(false); }} className={`break-keep rounded-lg border px-2 py-2.5 text-sm font-bold ${showStorage ? "border-navy-600 bg-navy-50 text-navy-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                보관 안내
              </button>
              <button type="button" onClick={() => { setShowFolder((v) => !v); setShowStorage(false); }} className={`break-keep rounded-lg border px-2 py-2.5 text-sm font-bold ${showFolder ? "border-navy-600 bg-navy-50 text-navy-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                폴더 예시
              </button>
              <button
                type="button"
                onClick={async () => {
                  const p = buildGptPrompt({
                    clientName: client?.name, industry: client?.industry,
                    projectName: project?.name, month,
                    activities, tests, problems, nextPlan, relevance,
                    roles: roles.filter((r) => r.name || r.role),
                  });
                  try { await navigator.clipboard.writeText(p); setPromptCopied(true); setTimeout(() => setPromptCopied(false), 1500); } catch { /* 무시 */ }
                }}
                className="break-keep rounded-lg border border-violet-300 bg-violet-50/50 px-2 py-2.5 text-sm font-bold text-violet-700 hover:bg-violet-100"
              >
                {promptCopied ? "복사됨 ✓" : "GPT 프롬프트 복사"}
              </button>
            </div>

            {showStorage ? (
              <div className="rounded-xl border border-navy-100 bg-navy-50 px-4 py-3">
                <p className="text-base font-bold text-navy-800">연구노트 보관 안내</p>
                <p className="mt-1 text-sm leading-relaxed text-navy-900/80">
                  연구노트는 이 화면에서 작성하는 것으로 끝내지 말고, <b>실제 연구전담요원이 접근
                  가능한 회사 PC·공유폴더·노션·구글드라이브</b> 등에 <b>월별로</b> 보관해 두는 것을
                  권장합니다.
                </p>
                <ul className="mt-2 space-y-1 text-sm leading-relaxed text-navy-900/70">
                  <li>· 월별 폴더 + 연구과제별 파일명 권장</li>
                  <li>· 사진·회의록·테스트 결과·시제품 자료도 함께 보관</li>
                  <li>· 현장조사·사후관리 자료 요청 시 연구개발활동 증빙으로 제시</li>
                  <li>· 허위 작성 금지 — 실제 활동 기반으로만 기록</li>
                </ul>
              </div>
            ) : null}

            {showFolder ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-base font-bold text-slate-800">폴더 구조 예시</p>
                <pre className="mt-2 whitespace-pre rounded-lg bg-white p-3 font-mono text-sm leading-relaxed text-slate-700 ring-1 ring-slate-200">{`📁 2026_기업부설연구소
 ├─ 📁 06월_연구노트
 ├─ 📁 회의록
 ├─ 📁 테스트사진
 ├─ 📁 결과보고서
 └─ 📁 연구기자재자료`}</pre>
              </div>
            ) : null}

            <div className="rounded-xl bg-slate-50 px-4 py-3">
              <p className="text-sm leading-relaxed text-slate-600">
                ℹ️ <span className="font-semibold">실제 연구활동 입력 기반 초안</span>입니다. 허위
                활동 작성 목적이 아닌, 실제 수행 내용을 실사 대응 관점으로 정리하기 위한 기능입니다.
              </p>
            </div>

            {client ? (
              <Link
                href={`/clients/${client.id}/report?month=${month}`}
                className="block text-center text-sm font-bold text-navy-600 hover:text-navy-800"
              >
                이 고객사 월간 리포트 보기 →
              </Link>
            ) : null}
            </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

interface PromptInput {
  clientName?: string; industry?: string; projectName?: string; month: string;
  activities: string; tests: string; problems: string; nextPlan: string; relevance: string;
  roles: { name: string; role: string }[];
}

function buildGptPrompt(i: PromptInput): string {
  const monthLabel = i.month.replace("-", "년 ") + "월";
  const roleLines = i.roles.length
    ? i.roles.map((r) => `  - ${r.name || "(이름)"}: ${r.role || "(역할)"}`).join("\n")
    : "  - (미입력)";
  return [
    "당신은 기업부설연구소/연구개발전담부서 사후관리를 돕는 컨설턴트의 보조자입니다.",
    "아래 '실제 수행한 연구활동' 입력만을 근거로, 실사(현장조사) 대응이 가능한 월간 연구노트 초안을 작성해 주세요.",
    "",
    "[작성 규칙]",
    "- 입력된 실제 활동 내용에만 기반할 것. 허위·과장 내용을 새로 만들지 말 것.",
    "- 연구과제·업종·제품과 직접 연결되도록 구체적으로 서술할 것.",
    "- 연구수행일시/연구인력/구체적 연구내용이 드러나도록 정리할 것.",
    "- 목표: 실제 연구활동을 했음을 설명할 수 있는 실사 대응형 연구노트 초안.",
    "",
    "[고객사 정보]",
    `- 고객사명: ${i.clientName || "(미선택)"}`,
    `- 업종: ${i.industry || "(미입력)"}`,
    `- 연구과제명: ${i.projectName || "(미선택)"}`,
    `- 대상 월: ${monthLabel}`,
    "",
    "[이번 달 실제 연구활동]",
    i.activities || "(미입력)",
    "",
    "[해결하려던 문제]",
    i.problems || "(미입력)",
    "",
    "[테스트/시도한 내용]",
    i.tests || "(미입력)",
    "",
    "[실패/수정/개선사항]",
    "(위 내용에서 개선·수정 사항을 정리)",
    "",
    "[다음 달 계획]",
    i.nextPlan || "(미입력)",
    "",
    "[참여 연구원별 역할]",
    roleLines,
    "",
    "[업종·제품과의 관련성]",
    i.relevance || "(미입력)",
    "",
    "위 내용을 바탕으로 1) 연구개요 2) 수행내용 3) 결과·개선 4) 다음 계획 5) 연구원별 역할 순으로 연구노트 초안을 작성해 주세요.",
  ].join("\n");
}

function GptPromptPanel({
  prompt, copied, onCopy, disabled,
}: {
  prompt: string; copied: boolean; onCopy: (t: string) => void; disabled: boolean;
}) {
  return (
    <div className="space-y-3">
      <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-800">
        입력한 실제 연구활동을 바탕으로 외부 GPT에서 연구노트 초안을 정리할 수 있는
        프롬프트를 제공합니다. 실제 연구활동 입력 기반으로만 작성하세요. 허위·소급 작성은
        금지되며, 본 기능은 실제 활동을 정리하는 보조도구로 법적·세무적 결과를 보장하지 않습니다.
      </p>
      <textarea
        rows={18}
        readOnly
        value={prompt}
        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm leading-relaxed text-slate-700"
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => onCopy(prompt)}
        className="w-full rounded-xl bg-navy-700 px-5 py-3.5 text-lg font-bold text-white hover:bg-navy-800 disabled:opacity-40"
      >
        {copied ? "복사 완료 ✓ — GPT에 붙여넣으세요" : "GPT용 프롬프트 복사"}
      </button>
    </div>
  );
}

function EnhanceBtn({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg border border-violet-300 bg-violet-50/50 px-3 py-2.5 text-sm font-bold leading-tight text-violet-700 hover:bg-violet-100 disabled:opacity-40"
    >
      {label}
    </button>
  );
}

export default function NotesPage() {
  return (
    <Suspense fallback={<Layout title="불러오는 중…">{null}</Layout>}>
      <NotesWorkspace />
    </Suspense>
  );
}
