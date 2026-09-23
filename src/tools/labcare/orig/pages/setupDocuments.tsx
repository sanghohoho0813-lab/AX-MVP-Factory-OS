import { useEffect, useState } from "react";
import Link from "../next";
import Layout from "../components/Layout";
import {
  buildSetupPackage,
  buildTempPackage,
  DEMO_INITIAL_IDS,
  docProgress,
  getSetupPackages,
  groupProgress,
  missingDocs,
  SETUP_GROUPS,
  type DocClass,
  type DocStatus,
  type PromptKey,
  type SetupDoc,
  type SetupPackage,
} from "../lib/mockStage1";
import StatusBadge from "../components/StatusBadge";
import PageGuide from "../components/PageGuide";
import { useScrollRestore, setSession, getSession, saveReturnPoint } from "../lib/uiState";
import {
  addSetupTargetId,
  addTempCompany,
  ensureSeeded,
  getAddedSetupIds,
  getClients,
  getHiddenSetupIds,
  getLatestCheck,
  getProjectsByClient,
  getTempCompanies,
  hideSetupTarget,
  removeTempCompany,
  restoreSetupSamples,
} from "../lib/storage";
import { sampleClients } from "../lib/sampleData";
import type { Client, LabType } from "../../types";

const STATUS_OPTS: DocStatus[] = ["준비중", "고객 요청중", "완료", "해당 없음"];

const DOC_STATUS_STYLE: Record<DocStatus, string> = {
  준비중: "bg-blue-50 text-blue-700 ring-blue-200",
  "고객 요청중": "bg-amber-50 text-amber-700 ring-amber-200",
  완료: "bg-status-normalBg text-status-normal ring-green-200",
  "해당 없음": "bg-slate-50 text-slate-400 ring-slate-200",
};

const CLASS_STYLE: Record<DocClass, string> = {
  필수: "bg-navy-700 text-white",
  작성보조: "bg-sky-100 text-sky-700",
  요청시: "bg-violet-100 text-violet-700",
  해당시: "bg-amber-100 text-amber-800",
};

export default function SetupDocumentsPage() {
  // 고객사 관리에 등록된 실제 고객사 기준으로 패키지 구성 (추가/삭제 자동 반영)
  const [packages, setPackages] = useState<SetupPackage[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [activeId, setActiveId] = useState("");
  const [requestMsg, setRequestMsg] = useState<string | null>(null);
  const [showFinalCheck, setShowFinalCheck] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pickId, setPickId] = useState("");
  // 신고 입력자료 정리 — 메모 / 체크리스트 / 프롬프트 모달
  const [memos, setMemos] = useState<Record<string, string>>({});
  const [openMemo, setOpenMemo] = useState<Record<string, boolean>>({});
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [promptKind, setPromptKind] = useState<PromptKey | null>(null);
  const [tempOpen, setTempOpen] = useState(false);

  function loadPackages(selectId?: string) {
    const all2 = getSetupPackages();
    const hidden = getHiddenSetupIds();
    // 기본 노출 = 데모 2개 + 직접 추가한 등록 고객사 — 숨김(삭제) 목록 제외 (새로고침에도 유지)
    const baseIds = [...DEMO_INITIAL_IDS, ...getAddedSetupIds().filter((id) => !DEMO_INITIAL_IDS.includes(id))];
    const base = baseIds
      .filter((id) => !hidden.includes(id))
      .map((id) => all2.find((p) => p.clientId === id))
      .filter((p): p is SetupPackage => Boolean(p));
    const temps = getTempCompanies().map((t) => buildTempPackage(t));
    const next = [...base, ...temps];
    setPackages(next);
    if (selectId) setActiveId(selectId);
    else if (!next.some((p) => p.id === activeId)) {
      // 뒤로가기 복원: 직전에 보던 고객사가 목록에 있으면 그대로 선택
      const stored = getSession("setupdoc:active");
      setActiveId(stored && next.some((p) => p.id === stored) ? stored : next[0]?.id ?? "");
    }
  }

  useEffect(() => {
    ensureSeeded();
    setClients(getClients());
    loadPackages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 선택 고객사 유지(뒤로가기 복원용) + 스크롤 위치 복원
  useEffect(() => { if (activeId) setSession("setupdoc:active", activeId); }, [activeId]);
  useScrollRestore("setup-documents", packages.length > 0);

  function addTemp(input: { name: string; ceoName?: string; businessType?: "법인사업자" | "개인사업자"; industry?: string; labType: LabType; projectName?: string }) {
    const t = addTempCompany(input);
    loadPackages(`temp-${t.id}`);
    setTempOpen(false);
  }

  function addTarget() {
    const c = clients.find((x) => x.id === pickId);
    if (!c) return;
    if (packages.some((p) => p.clientId === c.id)) return; // 중복 방지
    addSetupTargetId(c.id);
    const pkg = buildSetupPackage(c);
    setPackages((arr) => [...arr, pkg]);
    setActiveId(pkg.id);
    setPickId("");
  }

  /** 관리 대상에서 제거 — 임시 업체는 삭제, 그 외는 목록에서만 숨김(고객사 원본 유지) */
  function removeTarget(p: SetupPackage) {
    if (p.temp) {
      removeTempCompany(p.clientId);
    } else {
      hideSetupTarget(p.clientId);
    }
    const rest = packages.filter((x) => x.id !== p.id);
    setPackages(rest);
    if (activeId === p.id) setActiveId(rest[0]?.id ?? "");
  }

  function restoreSamples() {
    restoreSetupSamples(DEMO_INITIAL_IDS);
    loadPackages();
  }
  const samplesHidden = DEMO_INITIAL_IDS.some((id) => getHiddenSetupIds().includes(id));

  const pkg = packages.find((p) => p.id === activeId) ?? packages[0];
  const client = clients.find((c) => c.id === pkg?.clientId);
  const temp = pkg?.temp ? getTempCompanies().find((t) => `temp-${t.id}` === pkg.id) : undefined;
  const project = pkg && client ? getProjectsByClient(pkg.clientId)[0] : undefined;

  const progress = pkg ? docProgress(pkg) : 0;
  const missing = pkg ? missingDocs(pkg) : [];
  const review = pkg ? pkg.docs.filter((d) => d.status === "준비중") : [];
  const inProgress = packages.filter((p) => docProgress(p) < 100);
  const done = packages.filter((p) => docProgress(p) >= 100);

  function setDocStatus(docKey: string, status: DocStatus) {
    setPackages((pkgs) =>
      pkgs.map((p) =>
        p.id === pkg!.id
          ? { ...p, docs: p.docs.map((d) => (d.key === docKey ? { ...d, status } : d)) }
          : p,
      ),
    );
  }

  const mkey = (k: string) => `${pkg?.id}:${k}`;
  const renderDoc = (d: SetupDoc) =>
    d.group === "prep" ? (
      <PrepRow
        key={d.key}
        doc={d}
        memo={memos[mkey(d.key)] ?? ""}
        open={!!openMemo[mkey(d.key)]}
        checks={checks}
        ckPrefix={mkey(d.key)}
        onMemo={(v) => setMemos((m) => ({ ...m, [mkey(d.key)]: v }))}
        onToggle={() => setOpenMemo((o) => ({ ...o, [mkey(d.key)]: !o[mkey(d.key)] }))}
        onCheck={(i) => setChecks((c) => ({ ...c, [`${mkey(d.key)}:${i}`]: !c[`${mkey(d.key)}:${i}`] }))}
        onChange={(st) => setDocStatus(d.key, st)}
        onPrompt={(pk) => setPromptKind(pk)}
      />
    ) : (
      <DocRow key={d.key} doc={d} onChange={(st) => setDocStatus(d.key, st)} />
    );

  function generateRequestMsg() {
    const names = missing.map((d) => d.label).join(", ");
    setRequestMsg(
      missing.length
        ? `대표님, ${pkg!.labType} 설립신고 준비를 위해 현재 누락된 자료를 요청드립니다.\n\n현재 필요한 자료는 ${names}입니다.\n\n준비되는 대로 보내주시면 바로 신고 준비를 이어가겠습니다. 감사합니다.`
        : `대표님, ${pkg!.labType} 설립신고 서류가 모두 준비되었습니다. 최종 검토 후 신고 일정을 안내드리겠습니다.`,
    );
    setShowFinalCheck(false);
    setCopied(false);
  }

  async function copyRequestMsg() {
    if (!requestMsg) return;
    try {
      await navigator.clipboard.writeText(requestMsg);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* 무시 */ }
  }

  const foundedLabel = client?.businessType === "개인사업자" ? "사업개시일" : "법인 설립일";

  return (
    <Layout
      title="설립서류 관리"
      subtitle={`고객사 관리와 연동 · 진행중 ${inProgress.length}건 / 완료 보관 ${done.length}건`}
    >
      <PageGuide
        id="setup-documents"
        purpose="설립신고에 필요한 서류와 입력자료의 준비 상태를 고객사별로 관리합니다."
        when="설립 가능성 체크 이후, 실제 신고 서류를 모으고 점검할 때 사용합니다."
        result="필수서류 준비율, 누락 항목, 고객 요청문, 조직도/도면 작업 연결을 얻습니다."
        steps={["고객사 선택", "필수서류 체크", "신고 입력자료 정리", "누락서류 요청", "조직도/도면 생성"]}
      />
      {/* 고객사 선택/추가 (고객사 관리 데이터 연동) */}
      <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <p className="text-base font-bold text-slate-800">설립서류 관리 대상</p>
        <p className="mt-0.5 text-sm text-slate-500">
          고객사 관리에 등록된 업체를 선택해 설립서류 준비 현황을 관리할 수 있습니다.
          칩의 <b>✕</b>를 누르면 이 목록에서만 제거되며, 고객사 원본 데이터는 삭제되지 않습니다.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <select
            value={pickId}
            onChange={(e) => setPickId(e.target.value)}
            className="min-w-[240px] flex-1 rounded-lg border border-slate-300 px-3.5 py-2.5 text-base focus:border-navy-600 focus:outline-none focus:ring-1 focus:ring-navy-600"
          >
            <option value="">고객사 선택…</option>
            {clients
              .filter((c) => !packages.some((p) => p.clientId === c.id))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.labType} · {c.industry}
                </option>
              ))}
          </select>
          <button
            type="button"
            onClick={addTarget}
            disabled={!pickId}
            className="whitespace-nowrap rounded-lg bg-navy-700 px-5 py-2.5 text-base font-bold text-white hover:bg-navy-800 disabled:opacity-40"
          >
            설립서류 관리 대상 추가
          </button>
          <button
            type="button"
            onClick={() => setTempOpen(true)}
            className="whitespace-nowrap rounded-lg border border-navy-300 bg-navy-50 px-5 py-2.5 text-base font-bold text-navy-700 hover:bg-navy-100"
          >
            + 임시 체크 시작 (등록 전)
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {packages.map((p) => {
            const isSample = !p.temp && DEMO_INITIAL_IDS.includes(p.clientId) && sampleClients.some((sc) => sc.id === p.clientId);
            const badge = p.temp ? { t: "임시 저장", c: "bg-amber-100 text-amber-800" } : isSample ? { t: "예시 데이터", c: "bg-slate-100 text-slate-500" } : { t: "등록 고객사", c: "bg-sky-50 text-sky-700" };
            return (
              <div
                key={p.id}
                className={`flex items-center overflow-hidden rounded-lg border ${
                  p.id === pkg?.id ? "border-navy-600 bg-navy-50" : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <button
                  type="button"
                  onClick={() => { setActiveId(p.id); setRequestMsg(null); setShowFinalCheck(false); }}
                  className={`whitespace-nowrap px-4 py-2.5 text-base font-bold ${p.id === pkg?.id ? "text-navy-700" : "text-slate-500"}`}
                >
                  {p.clientName}
                  <span className="ml-2 text-sm font-bold text-navy-600">{docProgress(p)}%</span>
                  <span className={`ml-2 rounded px-1.5 py-0.5 text-xs font-bold ${badge.c}`}>{badge.t}</span>
                </button>
                <button
                  type="button"
                  onClick={() => removeTarget(p)}
                  title="관리 대상 목록에서 제거 (고객사 원본은 유지)"
                  aria-label={`${p.clientName} 관리 대상에서 제거`}
                  className="self-stretch border-l border-slate-200 px-3 text-base font-bold text-slate-400 transition hover:bg-red-50 hover:text-status-danger"
                >
                  ✕
                </button>
              </div>
            );
          })}
          {samplesHidden ? (
            <button type="button" onClick={restoreSamples} className="rounded-lg border border-dashed border-slate-300 px-3.5 py-2.5 text-sm font-bold text-slate-500 hover:bg-slate-50">
              ↺ 샘플 복원
            </button>
          ) : null}
          {packages.length === 0 ? (
            <p className="text-base text-slate-400">설립서류 관리 대상을 추가하거나 임시 체크를 시작하세요.</p>
          ) : null}
        </div>
      </section>

      {pkg ? (<>
      {/* 요약 — 등록 고객사 / 임시 저장 업체 */}
      {client ? (
        <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900">{client.name}</h2>
              <p className="mt-0.5 text-base text-slate-500">
                {client.ceoName} 대표 · {client.businessType ?? "법인사업자"} · {client.industry}
              </p>
            </div>
            <Link href={`/clients/${client.id}`} onClick={() => saveReturnPoint("/setup-documents", "설립서류 관리")} className="whitespace-nowrap rounded-lg border border-navy-200 px-4 py-2 text-base font-bold text-navy-700 hover:bg-navy-50">
              고객사 상세 →
            </Link>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-base sm:grid-cols-3 @2xl:grid-cols-4">
            <Info label="연구소 유형" value={client.labType} />
            <Info label="연구원" value={`${client.researcherCount}명`} />
            <Info label="근로자" value={`${client.employeeCount ?? "—"}명`} />
            <Info label={foundedLabel} value={client.foundedDate ? client.foundedDate.replace(/-/g, ".") : "—"} />
            <Info label="인정일" value={client.certifiedDate ? client.certifiedDate.replace(/-/g, ".") : "—"} />
            <Info label="연구과제" value={project?.name ?? "—"} wide />
            <Info label="인정번호" value={client.labRegistrationNumber ?? "—"} />
            <div>
              <p className="whitespace-nowrap text-sm text-slate-400">관리 상태</p>
              <div className="mt-0.5"><StatusBadge status={getLatestCheck(client.id)?.level ?? "미점검"} size="sm" /></div>
            </div>
          </div>
        </section>
      ) : (
        <section className="mb-5 rounded-2xl border-2 border-dashed border-navy-200 bg-navy-50/40 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900">{pkg.clientName} <span className="ml-1 rounded bg-amber-100 px-2 py-0.5 text-sm font-bold text-amber-800">임시 저장</span></h2>
              <p className="mt-0.5 text-base text-slate-500">
                {(temp?.ceoName ? `${temp.ceoName} 대표 · ` : "")}{temp?.businessType ?? "사업자 유형 미입력"} · {temp?.industry ?? "업종 미입력"}
              </p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-base sm:grid-cols-4">
            <Info label="연구소 유형" value={pkg.labType} />
            <Info label="연구과제" value={temp?.projectName ?? "—"} wide />
            <Info label="상태" value="고객사 등록 전 임시 체크" />
          </div>
          <p className="mt-2 text-sm text-slate-500">고객사 관리에는 아직 등록되지 않았습니다. 정식 등록은 추후 지원 예정(TODO)입니다.</p>
        </section>
      )}

      <div className="grid grid-cols-1 gap-5 @2xl:grid-cols-3">
        {/* 체크리스트 */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-card @2xl:col-span-2">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-bold text-slate-900">설립서류 체크리스트</h2>
                <p className="text-sm text-slate-500">{pkg.labType} · {pkg.stage}</p>
              </div>
              <div className="text-right">
                <p className="text-4xl font-bold text-navy-700">{progress}%</p>
                <p className="text-xs text-slate-500">전체 준비율</p>
              </div>
            </div>
            {/* 그룹별 준비율 4분할 */}
            <div className="mt-3 grid grid-cols-3 gap-3">
              <MiniBar label="필수서류" value={groupProgress(pkg, "essential")} tone="navy" />
              <MiniBar label="작성 보조" value={groupProgress(pkg, "prep")} tone="sky" />
              <MiniBar label="요청 시" value={groupProgress(pkg, "optional")} tone="violet" />
            </div>
            {/* 분류 범례 */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {(["필수", "작성보조", "요청시", "해당시"] as DocClass[]).map((c) => (
                <span key={c} className={`rounded-md px-2 py-0.5 text-xs font-bold ${CLASS_STYLE[c]}`}>{c}</span>
              ))}
              <span className="ml-1 text-xs text-slate-400">· 항목명에 마우스를 올리면 기준 설명 표시 · 준비율은 ‘해당 없음’ 제외</span>
            </div>
          </div>
          <div>
            {SETUP_GROUPS.map((g) => {
              const all = pkg.docs.filter((d) => d.group === g.id);
              if (!all.length) return null;
              const docs = all.filter((d) => !d.collapsed);
              const collapsed = all.filter((d) => d.collapsed);
              const naAll = all.every((d) => d.status === "해당 없음");
              return (
                <div key={g.id} className="border-t border-slate-100">
                  <div className="flex items-baseline justify-between gap-2 bg-slate-50/70 px-5 py-2.5">
                    <p className="text-base font-bold text-slate-800">{g.title}</p>
                    <p className="hidden text-xs text-slate-400 sm:block">{g.desc}</p>
                  </div>
                  {naAll ? (
                    <p className="px-5 py-2.5 text-sm text-slate-400">이 고객사에는 해당 없는 그룹입니다.</p>
                  ) : (
                    <>
                      <div className="divide-y divide-slate-50">
                        {docs.map((d) => renderDoc(d))}
                      </div>
                      {collapsed.length ? (
                        <details className="border-t border-slate-100 px-5 py-2.5">
                          <summary className="cursor-pointer text-sm font-bold text-slate-500">요청 시 기타서류 {collapsed.length}건 펼치기</summary>
                          <div className="mt-1 divide-y divide-slate-50">
                            {collapsed.map((d) => renderDoc(d))}
                          </div>
                        </details>
                      ) : null}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* 우측: 누락/주의 + 액션 */}
        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <h3 className="text-base font-bold text-slate-800">누락 · 주의 항목</h3>
            {missing.length === 0 && review.length === 0 ? (
              <p className="mt-2 text-base text-status-normal">모든 서류가 준비되었습니다. 👍</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {missing.map((d) => (
                  <li key={d.key} className="flex items-start gap-2 text-base font-semibold text-amber-700">
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-status-warning" />
                    {d.label}
                    <span className="text-sm text-slate-500">({d.status})</span>
                  </li>
                ))}
                {review.map((d) => (
                  <li key={d.key} className="flex items-start gap-2 text-base text-slate-600">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                    {d.label}
                    <span className="text-sm text-slate-500">(준비중)</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <h3 className="mb-1 text-base font-bold text-slate-800">빠른 작업</h3>
            <Link href="/org-diagram" onClick={() => saveReturnPoint("/setup-documents", "설립서류 관리")} className="block rounded-lg bg-navy-700 px-4 py-3 text-center text-base font-bold text-white hover:bg-navy-800">
              조직도 생성
            </Link>
            <Link href="/org-diagram" onClick={() => saveReturnPoint("/setup-documents", "설립서류 관리")} className="block rounded-lg border border-navy-200 px-4 py-3 text-center text-base font-bold text-navy-700 hover:bg-navy-50">
              도면 생성
            </Link>
            <button
              type="button"
              onClick={generateRequestMsg}
              className="block w-full rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-center text-base font-bold text-amber-700 hover:bg-amber-100"
            >
              누락서류 요청문 생성
            </button>
            <button
              type="button"
              onClick={() => { setShowFinalCheck(true); setRequestMsg(null); }}
              className="block w-full rounded-lg border border-slate-300 px-4 py-3 text-center text-base font-bold text-slate-600 hover:bg-slate-50"
            >
              최종 점검 리포트
            </button>
          </section>

          {requestMsg ? (
            <section className="rounded-2xl border-2 border-amber-200 bg-white p-5 shadow-card">
              <h3 className="text-base font-bold text-slate-800">📩 고객 요청문 (카톡용)</h3>
              <div className="mt-2 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-base leading-relaxed text-slate-700">
                {requestMsg}
              </div>
              <button
                type="button"
                onClick={copyRequestMsg}
                className="mt-3 w-full rounded-lg bg-navy-700 px-5 py-3 text-base font-bold text-white hover:bg-navy-800"
              >
                {copied ? "복사 완료 ✓" : "본문 복사하기"}
              </button>
            </section>
          ) : null}

          {showFinalCheck ? (
            <section className="rounded-2xl border-2 border-navy-200 bg-white p-5 shadow-card">
              <h3 className="text-base font-bold text-navy-800">📋 최종 점검 요약</h3>
              <div className="mt-3 grid grid-cols-2 gap-3 text-center">
                <div className="rounded-xl bg-navy-50 p-3">
                  <p className="text-3xl font-bold text-navy-700">{progress}%</p>
                  <p className="text-sm text-slate-500">전체 준비율</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-3xl font-bold text-slate-700">
                    {pkg.docs.filter((d) => d.status === "완료").length}/{pkg.docs.length}
                  </p>
                  <p className="text-sm text-slate-500">완료 서류</p>
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                {missing.length ? (
                  <p className="text-base text-slate-700">
                    <span className="font-bold text-status-danger">누락 {missing.length}건</span> —{" "}
                    {missing.map((d) => d.label).join(", ")}
                  </p>
                ) : (
                  <p className="text-base font-semibold text-status-normal">누락 서류가 없습니다.</p>
                )}
                {review.length ? (
                  <p className="text-base text-slate-700">
                    <span className="font-bold text-blue-600">준비중 {review.length}건</span> —{" "}
                    {review.map((d) => d.label).join(", ")}
                  </p>
                ) : null}
                <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
                  {progress >= 100
                    ? "✅ 신고 준비가 완료되었습니다. 신고관리시스템(www.RND.or.kr)에서 제출을 진행하세요."
                    : progress >= 70
                      ? "거의 다 왔습니다. 누락·검토 항목만 마무리하면 신고할 수 있습니다."
                      : "고객 요청문을 보내 누락 자료부터 수집하는 것을 권장합니다."}
                </p>
              </div>
            </section>
          ) : null}

          <section className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
            <p className="text-base font-bold text-amber-800">📷 사진·도면은 별도 메뉴에서</p>
            <p className="mt-1 text-sm leading-relaxed text-amber-800/90">
              현판 근접 1장 · 출입문 전체 1장 · 내부 전·후·좌·우 4장. 촬영 구도 가이드와 조직도·도면
              생성은 <b>조직도/도면 페이지</b>에서 진행합니다.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-sm leading-relaxed text-slate-500">
              💡 <b>신고 입력자료 정리</b>(과제명·연구내용·인력/기자재 현황)는 신고관리시스템에서 직접
              작성하지만 미리 정리해두면 작성이 빨라집니다. 각 항목의 <b>프롬프트</b> 버튼으로 GPT 정리를
              도울 수 있습니다. 벤처·중견·연구원창업·10인 이상 등은 <b>요청 시/해당 시</b>에서 관리합니다.
            </p>
          </section>
        </div>
      </div>
      </>) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-card">
          <p className="text-lg text-slate-500">설립서류 관리 대상을 추가하거나 임시 체크를 시작하세요.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={() => setTempOpen(true)} className="rounded-xl border border-navy-300 bg-navy-50 px-5 py-3 text-base font-bold text-navy-700 hover:bg-navy-100">+ 임시 체크 시작</button>
            <Link href="/clients" className="inline-block rounded-xl bg-navy-700 px-5 py-3 text-base font-bold text-white">고객사 관리로 이동</Link>
          </div>
        </div>
      )}

      {promptKind ? (
        <SetupPromptModal
          kind={promptKind}
          clientName={client?.name ?? pkg?.clientName ?? ""}
          industry={client?.industry ?? temp?.industry ?? ""}
          projectName={project?.name ?? temp?.projectName ?? ""}
          onClose={() => setPromptKind(null)}
        />
      ) : null}

      {tempOpen ? <TempCheckModal onClose={() => setTempOpen(false)} onSave={addTemp} /> : null}
    </Layout>
  );
}

function TempCheckModal({
  onClose, onSave,
}: {
  onClose: () => void;
  onSave: (input: { name: string; ceoName?: string; businessType?: "법인사업자" | "개인사업자"; industry?: string; labType: LabType; projectName?: string }) => void;
}) {
  const [name, setName] = useState("");
  const [ceoName, setCeoName] = useState("");
  const [businessType, setBusinessType] = useState<"법인사업자" | "개인사업자">("법인사업자");
  const [industry, setIndustry] = useState("");
  const [labType, setLabType] = useState<LabType>("연구개발전담부서");
  const [projectName, setProjectName] = useState("");
  const F = "mt-1 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-base focus:border-navy-600 focus:outline-none";
  const L = "text-sm font-bold text-slate-600";
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 className="text-xl font-bold text-slate-900">임시 체크 시작 (고객사 등록 전)</h3>
          <button onClick={onClose} className="text-2xl text-slate-400 hover:text-slate-700">✕</button>
        </div>
        <div className="overflow-y-auto p-6">
          <p className="mb-3 text-sm text-slate-500">정식 고객사 등록 전, 서류 준비 현황을 임시로 체크할 수 있습니다.</p>
          <label className={L}>기업명 *</label>
          <input className={F} value={name} onChange={(e) => setName(e.target.value)} placeholder="예) 새빛테크 주식회사" />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div><label className={L}>대표자명</label><input className={F} value={ceoName} onChange={(e) => setCeoName(e.target.value)} placeholder="선택" /></div>
            <div>
              <label className={L}>사업자 유형</label>
              <select className={F} value={businessType} onChange={(e) => setBusinessType(e.target.value as "법인사업자" | "개인사업자")}>
                <option>법인사업자</option><option>개인사업자</option>
              </select>
            </div>
            <div><label className={L}>업종</label><input className={F} value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="예) 소프트웨어 개발" /></div>
            <div>
              <label className={L}>연구소/전담부서 유형</label>
              <select className={F} value={labType} onChange={(e) => setLabType(e.target.value as LabType)}>
                <option>연구개발전담부서</option><option>기업부설연구소</option>
              </select>
            </div>
          </div>
          <label className={`${L} mt-3 block`}>연구과제명</label>
          <input className={F} value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="선택" />
          <button
            type="button"
            onClick={() => { if (!name.trim()) { alert("기업명을 입력해 주세요."); return; } onSave({ name: name.trim(), ceoName: ceoName.trim() || undefined, businessType, industry: industry.trim() || undefined, labType, projectName: projectName.trim() || undefined }); }}
            className="mt-4 w-full rounded-xl bg-navy-700 px-5 py-3 text-base font-bold text-white hover:bg-navy-800"
          >
            임시 저장하고 체크 시작
          </button>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2" : ""}>
      <p className="whitespace-nowrap text-sm text-slate-400">{label}</p>
      <p className="font-semibold text-slate-800">{value}</p>
    </div>
  );
}

function MiniBar({ label, value, tone }: { label: string; value: number; tone: "navy" | "sky" | "violet" }) {
  const bar = tone === "navy" ? "bg-navy-700" : tone === "sky" ? "bg-sky-500" : "bg-violet-500";
  const txt = tone === "navy" ? "text-navy-700" : tone === "sky" ? "text-sky-600" : "text-violet-600";
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold text-slate-500">{label}</span>
        <span className={`text-sm font-bold ${txt}`}>{value}%</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div className={`h-full ${bar}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function DocRow({ doc, onChange }: { doc: SetupDoc; onChange: (s: DocStatus) => void }) {
  const na = doc.status === "해당 없음";
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className={doc.status === "완료" ? "text-status-normal" : na ? "text-slate-300" : "text-slate-300"}>
          {doc.status === "완료" ? "✓" : na ? "–" : "○"}
        </span>
        <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-bold ${CLASS_STYLE[doc.cls]}`}>{doc.cls}</span>
        <p
          title={doc.tip}
          className={`cursor-help text-base font-medium ${
            doc.status === "완료" ? "text-slate-400" : na ? "text-slate-400 line-through" : "text-slate-800"
          }`}
        >
          {doc.label}
        </p>
      </div>
      <select
        value={doc.status}
        onChange={(e) => onChange(e.target.value as DocStatus)}
        className={`rounded-full border-0 px-3.5 py-1.5 text-sm font-bold ring-1 ring-inset focus:outline-none ${DOC_STATUS_STYLE[doc.status]}`}
      >
        {STATUS_OPTS.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
    </div>
  );
}

const PROMPT_BTN: Record<PromptKey, string> = {
  project: "연구과제 추천 프롬프트",
  content: "주요 연구내용 프롬프트",
  equip: "연구기자재 정리 프롬프트",
  personnel: "연구인력 검토 프롬프트",
};
const PREP_STATUS: DocStatus[] = ["준비중", "완료", "고객 요청중"];

function PrepRow({
  doc, memo, open, checks, ckPrefix, onMemo, onToggle, onCheck, onChange, onPrompt,
}: {
  doc: SetupDoc; memo: string; open: boolean; checks: Record<string, boolean>; ckPrefix: string;
  onMemo: (v: string) => void; onToggle: () => void; onCheck: (i: number) => void;
  onChange: (s: DocStatus) => void; onPrompt: (k: PromptKey) => void;
}) {
  return (
    <div className="px-5 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={doc.status === "완료" ? "text-status-normal" : "text-slate-300"}>{doc.status === "완료" ? "✓" : "○"}</span>
          <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-bold ${CLASS_STYLE[doc.cls]}`}>{doc.cls}</span>
          <p title={doc.tip} className={`cursor-help text-base font-medium ${doc.status === "완료" ? "text-slate-400" : "text-slate-800"}`}>{doc.label}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={onToggle} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-50">{open ? "메모 접기" : "메모"}</button>
          {doc.promptKey ? (
            <button type="button" onClick={() => onPrompt(doc.promptKey!)} className="rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs font-bold text-violet-700 hover:bg-violet-100">프롬프트</button>
          ) : null}
          <select value={doc.status} onChange={(e) => onChange(e.target.value as DocStatus)} className={`rounded-full border-0 px-3.5 py-1.5 text-sm font-bold ring-1 ring-inset focus:outline-none ${DOC_STATUS_STYLE[doc.status]}`}>
            {PREP_STATUS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>
      {open ? (
        <div className="mt-2.5 rounded-lg bg-slate-50 p-3">
          {doc.promptKey ? (
            <button type="button" onClick={() => onPrompt(doc.promptKey!)} className="mb-2 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-violet-700">{PROMPT_BTN[doc.promptKey]} 보기</button>
          ) : null}
          {doc.checklist ? (
            <div className="mb-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
              {doc.checklist.map((c, i) => {
                const on = !!checks[`${ckPrefix}:${i}`];
                return (
                  <button key={i} type="button" onClick={() => onCheck(i)} className="flex items-center gap-2 text-left text-sm text-slate-700">
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 text-xs font-bold ${on ? "border-status-normal bg-status-normal text-white" : "border-slate-300 text-transparent"}`}>✓</span>
                    {c}
                  </button>
                );
              })}
            </div>
          ) : null}
          <textarea
            value={memo}
            onChange={(e) => onMemo(e.target.value)}
            rows={2}
            placeholder="정리 메모 (예: 과제명 후보, 담당자 회신 내용 등)"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-navy-600 focus:outline-none"
          />
        </div>
      ) : null}
    </div>
  );
}

function SetupPromptModal({
  kind, clientName, industry, projectName, onClose,
}: {
  kind: PromptKey; clientName: string; industry: string; projectName: string; onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const head = [
    "당신은 기업부설연구소/연구개발전담부서 설립을 돕는 R&D 컨설턴트입니다.",
    "",
    `[회사 정보]`,
    `- 회사명: ${clientName || "(미입력)"}`,
    `- 업종: ${industry || "(미입력)"}`,
    `- 현재 연구과제(있으면): ${projectName || "(미입력)"}`,
    "",
  ];
  const bodyMap: Record<PromptKey, string[]> = {
    project: [
      "[요청] 위 회사의 실제 매출 제품/서비스, 고객, 현재 업무방식, 개선하고 싶은 문제, 보유 인력/장비를 바탕으로",
      "신고에 적합한 연구과제명 후보 5개를 제안해 주세요.",
      "- 향후 연구노트 작성이 수월하고, 벤처인증·기업인증·특허출원으로 연결될 방향을 우선하세요.",
      "- 단순 영업/관리/일상적 품질관리/시장조사처럼 보이지 않도록 표현 주의점도 함께 제시하세요.",
      "- 각 후보마다: 과제명 / 연구개발 목표 / 핵심 연구내용 / 사업과의 직접 관련성.",
    ],
    content: [
      "[요청] 위 회사의 업종·제품/서비스·주요 고객·현재 업무방식·개선하고 싶은 문제·보유 인력/장비·선정 예정 연구과제명을 바탕으로,",
      "신고에 적합한 주요 연구내용 후보 3~5개를 제안해 주세요.",
      "- 각 후보마다: 연구목표 / 월별 연구활동 방향 / 테스트·검증 방법 / 연구기자재 활용계획 / 향후 연구노트 작성 방향.",
      "- 단순 영업·일반 관리·일상적 품질관리·시장조사처럼 보이지 않도록 주의 표현도 함께 제시하세요.",
    ],
    equip: [
      "[요청] 위 회사가 연구기자재 현황에 기재할 항목을 정리해 주세요.",
      "- 연구개발에 직접 사용하는 장비/소프트웨어와 단순 사무용 비품을 구분해 표로 제시하세요.",
      "- 각 기자재: 명칭 / 용도(어떤 연구에 사용) / 연구기자재 해당 여부(O/X)와 사유.",
    ],
    personnel: [
      "[요청] 직원 명단을 바탕으로 연구전담요원 후보 적합성을 분류해 주세요.",
      "- 직원별: 학력 / 전공 / 자격증 / 연구개발 경력 / 실제 담당 업무 / 겸직 여부.",
      "- 학사 이상 / 전문학사 / 고졸 이하로 나눠 추가 확인사항을 제시하세요.",
      "  (전문학사·고졸 이하는 연구개발 경력 요건 확인 필요)",
      "- 4대보험 미가입자, 대표자 겸직 등 등록 제한 가능성도 표시하세요.",
    ],
  };
  const prompt = [...head, ...bodyMap[kind], "", "[주의] 인정 여부를 단정하지 말고 '후보'로 제안하고, 허위·과장 활동을 전제로 하지 마세요."].join("\n");

  async function copy() {
    try { await navigator.clipboard.writeText(prompt); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* 무시 */ }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 className="text-xl font-bold text-slate-900">{PROMPT_BTN[kind]}</h3>
          <button onClick={onClose} className="text-2xl text-slate-400 hover:text-slate-700">✕</button>
        </div>
        <div className="overflow-y-auto p-6">
          <p className="mb-2 text-sm text-slate-500">외부 GPT에 붙여넣어 사용하세요. 회사 정보가 채워질수록 결과가 좋아집니다.</p>
          <textarea readOnly value={prompt} rows={16} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-sm leading-relaxed text-slate-700" />
          <button type="button" onClick={copy} className="mt-3 w-full rounded-xl bg-violet-600 px-5 py-3 text-base font-bold text-white hover:bg-violet-700">{copied ? "복사 완료 ✓" : "프롬프트 복사"}</button>
        </div>
      </div>
    </div>
  );
}
