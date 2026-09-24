import { useEffect, useMemo, useRef, useState } from "react";
import Link from "../next";
import Layout from "../components/Layout";
import { osClientList } from "../store";
import { useSearchParams } from "../nav";
import PageGuide from "../components/PageGuide";
import StatusBadge from "../components/StatusBadge";
import {
  addClient,
  clearAllClients,
  deleteClient,
  ensureSeeded,
  getClients,
  getLatestCheck,
  getNotesByClient,
} from "../lib/storage";
import { riskSummary } from "../../lib/riskEngine";
import { getHiringSupportTip } from "../lib/hiringTip";
import type { Client, ClientStatus, LabType } from "../../types";

interface Row extends Client {
  status: ClientStatus;
  lastNoteMonth: string | null;
  reason: string;
}

const EMPTY_FORM = {
  name: "", industry: "", labType: "연구개발전담부서" as LabType,
  businessType: "법인사업자" as "법인사업자" | "개인사업자", ceoName: "",
  address: "", foundedDate: "", certifiedDate: "", employeeCount: 10,
  researcherCount: 1, labName: "", consultant: "", coreIssue: "", // [D-94] 원본 기본 담당자(김상호)는 비운다
  labRegistrationNumber: "", osId: "",
  researchersPayrollTotal: 0, rndMaterialCost: 0, rndOtherCost: 0,
  priorYearRndCost: 0, currentYearRndCost: 0,
  taxCreditCategory: "미정" as "일반 R&D" | "신성장·원천기술" | "국가전략기술" | "미정",
  businessTaxType: "" as "" | "법인세" | "종합소득세",
  estimatedTaxCreditRate: 0, taxMemo: "",
};

/** [D-94] 고객 운영 업체 하나로 추가 폼 칸 채우기 (고르기 칸 · 업체에서 연 경우 공용) */
function fillFromOs<F extends typeof EMPTY_FORM>(f: F, id: string): F {
  const os = osClientList().find((c) => c.id === id);
  if (!os) return { ...f, osId: "", name: "" };
  const emp = Number(String(os.employeeCount || "").replace(/[^0-9]/g, "")) || 0;
  return { ...f, osId: os.id, name: os.companyName, ceoName: os.representativeName || os.contactName || f.ceoName, industry: f.industry || os.industry || "", foundedDate: os.establishedAt || f.foundedDate, employeeCount: emp || f.employeeCount, businessType: os.corporateNumber ? "법인사업자" : f.businessType, address: os.businessAddress || f.address };
}

function findOsClientByName(name: string) {
  const norm = (x: string) => x.replace(/\(주\)|㈜|주식회사|\s+/g, "");
  return osClientList().find((c) => norm(c.companyName) === norm(name));
}

const CSV_HEADER = "고객사명,업종,연구소유형,대표자,근로자수,연구원수,법인설립일,인정일,담당컨설턴트";

export default function ClientsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  // [D-94] 업체 상세에서 열었는데 아직 연구소 고객사가 아니면 — 그 업체를 골라 둔 채 추가 창을 연다
  const sp = useSearchParams();
  const addId = sp.get("add");
  useEffect(() => {
    if (!addId || getClients().some((c) => c.id === addId)) return;
    setForm((f) => fillFromOs(f, addId));
    setOpen(true);
  }, [addId]);
  const [search, setSearch] = useState("");
  const [fIndustry, setFIndustry] = useState("전체");
  const [fType, setFType] = useState<"전체" | LabType>("전체");
  const [fStatus, setFStatus] = useState<"전체" | ClientStatus>("전체");
  const fileRef = useRef<HTMLInputElement>(null);
  const [subsidyClient, setSubsidyClient] = useState<Row | null>(null);

  function refresh() {
    const built: Row[] = getClients().map((c) => {
      const latest = getLatestCheck(c.id);
      return {
        ...c,
        status: latest ? latest.level : "미점검",
        lastNoteMonth: getNotesByClient(c.id)[0]?.month ?? null,
        reason: latest ? riskSummary(latest.answers) : "점검 이력 없음",
      };
    });
    built.sort((a, b) => a.name.localeCompare(b.name));
    setRows(built);
  }

  useEffect(() => {
    ensureSeeded();
    refresh();
  }, []);

  const industries = useMemo(
    () => ["전체", ...Array.from(new Set(rows.map((r) => r.industry).filter(Boolean)))],
    [rows],
  );

  const filtered = rows.filter((r) => {
    if (search && !`${r.name} ${r.ceoName} ${r.industry}`.toLowerCase().includes(search.toLowerCase()))
      return false;
    if (fIndustry !== "전체" && r.industry !== fIndustry) return false;
    if (fType !== "전체" && r.labType !== fType) return false;
    if (fStatus !== "전체" && r.status !== fStatus) return false;
    return true;
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.osId) return;
    const { osId, ...rest } = form;
    addClient({
      ...rest,
      id: osId,
      name: form.name.trim(),
      employeeCount: Number(form.employeeCount) || 0,
      researcherCount: Number(form.researcherCount) || 0,
      researchersPayrollTotal: Number(form.researchersPayrollTotal) || undefined,
      rndMaterialCost: Number(form.rndMaterialCost) || undefined,
      rndOtherCost: Number(form.rndOtherCost) || undefined,
      priorYearRndCost: Number(form.priorYearRndCost) || undefined,
      currentYearRndCost: Number(form.currentYearRndCost) || undefined,
      estimatedTaxCreditRate: Number(form.estimatedTaxCreditRate) || undefined,
      businessTaxType: form.businessTaxType || undefined,
    });
    setForm(EMPTY_FORM);
    setOpen(false);
    refresh();
  }

  function handleDelete(id: string, name: string) {
    if (!confirm(`${name} 고객사를 삭제할까요?\n연결된 오늘 할 일·연구노트·변경사항·점검 이력도 함께 정리됩니다.`)) return;
    deleteClient(id);
    refresh();
  }

  function handleClearAll() {
    if (!confirm("모든 고객사를 삭제할까요? 되돌릴 수 없습니다.\n연결된 오늘 할 일·연구노트·변경사항 등도 모두 함께 삭제됩니다.")) return;
    clearAllClients();
    refresh();
  }

  function downloadTemplate() {
    const sample = "(주)예시기업,식품 제조업,연구개발전담부서,홍길동,20,2,2019-03-01,2023-05-10,김상호";
    const blob = new Blob(["﻿" + CSV_HEADER + "\n" + sample + "\n"], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "고객사_업로드_양식.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result).replace(/^﻿/, "");
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      let added = 0;
      const skipped: string[] = [];
      for (const line of lines) {
        const cols = line.split(",").map((s) => s.trim());
        if (cols[0] === "고객사명" || !cols[0]) continue; // 헤더/빈 줄 스킵
        const labType: LabType = cols[2] === "기업부설연구소" ? "기업부설연구소" : "연구개발전담부서";
        // 이 OS 에서는 고객 운영에 있는 업체만 연구소 고객사로 붙인다 (이름으로 맞춘다)
        const os = findOsClientByName(cols[0]);
        if (!os) { skipped.push(cols[0]); continue; }
        addClient({
          id: os.id,
          name: cols[0], industry: cols[1] ?? "", labType, ceoName: cols[3] ?? "",
          address: "", employeeCount: Number(cols[4]) || 0, researcherCount: Number(cols[5]) || 1,
          foundedDate: cols[6] ?? "", certifiedDate: cols[7] ?? "", labName: "",
          consultant: cols[8] ?? "", coreIssue: "",
        });
        added += 1;
      }
      refresh();
      alert((added ? `${added}개 고객사를 추가했습니다.` : "추가된 행이 없습니다. 양식을 확인해 주세요.") + (skipped.length ? `\n고객 관리에 없는 업체라 건너뜀: ${skipped.join(", ")}` : ""));
    };
    reader.readAsText(file, "utf-8");
    e.target.value = "";
  }

  const STATUS_FILTERS: ("전체" | ClientStatus)[] = ["전체", "즉시 확인", "위험", "주의", "정상", "미점검"];

  return (
    <Layout
      title="고객사 관리"
      subtitle={`총 ${rows.length}개 고객사 · 표시 ${filtered.length}개`}
      actions={
        <button
          onClick={() => setOpen(true)} data-testid="lab-client-add"
          className="rounded-xl bg-navy-700 px-5 py-3 text-lg font-bold text-white transition-colors hover:bg-navy-800"
        >
          + 고객사 추가
        </button>
      }
    >
      <PageGuide
        id="clients"
        purpose="연구소/전담부서 고객사의 기본정보와 관리 상태를 등록·관리합니다."
        when="신규 고객사를 추가하거나 정보를 갱신할 때 사용합니다."
        result="고객사 기본정보, 인정번호, 연구과제, 사후관리 대상 정보를 정리합니다."
        steps={["고객사 추가", "연구소 유형·인정번호 입력", "사후관리 항목 연결"]}
      />
      {/* 도구 모음 */}
      <section className="mb-5 space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:p-5">
        <div className="flex flex-wrap gap-2">
          <button onClick={() => fileRef.current?.click()} className="rounded-lg border border-navy-200 bg-white px-4 py-2.5 text-base font-bold text-navy-700 hover:bg-navy-50">
            CSV 업로드
          </button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleCsvUpload} className="hidden" />
          <button onClick={downloadTemplate} className="rounded-lg border border-slate-200 px-4 py-2.5 text-base font-bold text-slate-600 hover:bg-slate-50">
            업로드 양식 다운로드
          </button>
          <button onClick={handleClearAll} className="rounded-lg border border-red-200 px-4 py-2.5 text-base font-bold text-status-danger hover:bg-red-50">
            전체 삭제
          </button>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 @2xl:grid-cols-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 고객사명·대표자·업종 검색"
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-base focus:border-navy-600 focus:outline-none focus:ring-1 focus:ring-navy-600"
          />
          <select value={fIndustry} onChange={(e) => setFIndustry(e.target.value)} className={SELECT}>
            {industries.map((i) => <option key={i}>{i === "전체" ? "업종: 전체" : i}</option>)}
          </select>
          <select value={fType} onChange={(e) => setFType(e.target.value as typeof fType)} className={SELECT}>
            <option value="전체">유형: 전체</option>
            <option value="기업부설연구소">기업부설연구소</option>
            <option value="연구개발전담부서">연구개발전담부서</option>
          </select>
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value as typeof fStatus)} className={SELECT}>
            {STATUS_FILTERS.map((s) => <option key={s} value={s}>{s === "전체" ? "상태: 전체" : s}</option>)}
          </select>
        </div>
      </section>

      {/* 데스크톱 테이블 */}
      <section className="hidden rounded-2xl border border-slate-200 bg-white shadow-card @min-[1024px]:block">{/* [D-94] OS 목차 옆 칸이 표(1150px)보다 좁으면 카드로 */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1150px] text-base">
            <thead>
              <tr className="whitespace-nowrap border-b border-slate-100 text-left text-sm font-bold uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3.5">고객사 / 대표자</th>
                <th className="px-5 py-3.5">업종</th>
                <th className="px-5 py-3.5">유형 / 연구원</th>
                <th className="px-5 py-3.5">근로자</th>
                <th className="px-5 py-3.5">지원금 Tip</th>
                <th className="px-5 py-3.5">설립일 / 인정일</th>
                <th className="px-5 py-3.5">최근 노트</th>
                <th className="px-5 py-3.5">상태</th>
                <th className="px-5 py-3.5 text-right">관리</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} data-client={c.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                  <td className="px-5 py-4">
                    <Link href={`/clients/${c.id}`} className="whitespace-nowrap text-lg font-bold text-slate-900 hover:text-navy-700">{c.name}</Link>
                    <div className="flex items-center gap-1.5 whitespace-nowrap text-sm text-slate-500">
                      <span className={`whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-bold ${c.businessType === "개인사업자" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"}`}>{c.businessType ?? "법인사업자"}</span>
                      {c.ceoName} 대표
                    </div>
                    {c.labRegistrationNumber ? (
                      <div className="whitespace-nowrap text-xs text-slate-400">인정 {c.labRegistrationNumber}</div>
                    ) : null}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-slate-700">{c.industry}</td>
                  <td className="px-5 py-4">
                    <span className="whitespace-nowrap rounded bg-navy-50 px-2 py-0.5 text-sm font-bold text-navy-700">{c.labType}</span>
                    <div className="mt-1 text-sm text-slate-500">연구원 {c.researcherCount}명</div>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-slate-700">{c.employeeCount ?? "—"}명</td>
                  <td className="px-5 py-4">
                    <button
                      type="button"
                      onClick={() => setSubsidyClient(c)}
                      className="whitespace-nowrap rounded-full bg-sky-50 px-2.5 py-1 text-sm font-bold text-sky-700 ring-1 ring-inset ring-sky-200 hover:bg-sky-100"
                      title="고용지원금 추가 점검"
                    >
                      💼 {getHiringSupportTip(c)}
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-sm text-slate-600">
                    <span className="text-slate-400">{c.businessType === "개인사업자" ? "개업" : "설립"}</span>{" "}
                    {c.foundedDate ? c.foundedDate.replace(/-/g, ".") : "—"}
                    <div className="text-slate-400">인정 {c.certifiedDate ? c.certifiedDate.replace(/-/g, ".") : "—"}</div>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-slate-700">{c.lastNoteMonth ? c.lastNoteMonth.replace("-", ".") : "—"}</td>
                  <td className="px-5 py-4">
                    <StatusBadge status={c.status} size="sm" />
                    {c.coreIssue ? <div className="mt-1 max-w-[180px] truncate text-sm text-slate-500">{c.coreIssue}</div> : null}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <Link href={`/clients/${c.id}`} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-navy-700 hover:bg-navy-50">상세</Link>
                      <button onClick={() => handleDelete(c.id, c.name)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-400 hover:border-red-200 hover:text-status-danger">삭제</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-5 py-14 text-center text-base text-slate-400">조건에 맞는 고객사가 없습니다.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {/* 모바일 카드 */}
      <section className="space-y-3 @min-[1024px]:hidden">
        {filtered.map((c) => (
          <div key={c.id} data-client={c.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link href={`/clients/${c.id}`} className="text-lg font-bold text-slate-900">{c.name}</Link>
                <p className="text-sm text-slate-500">{c.ceoName} 대표 · {c.industry}</p>
                {c.labRegistrationNumber ? <p className="text-xs text-slate-400">인정 {c.labRegistrationNumber}</p> : null}
              </div>
              <StatusBadge status={c.status} size="sm" />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-600">
              <span className="rounded bg-navy-50 px-2 py-0.5 font-bold text-navy-700">{c.labType}</span>
              <span className={`rounded px-2 py-0.5 font-bold ${c.businessType === "개인사업자" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"}`}>{c.businessType ?? "법인사업자"}</span>
              <span>연구원 {c.researcherCount}명</span>
              <span>근로자 {c.employeeCount ?? "—"}명</span>
              <span>최근 노트 {c.lastNoteMonth ? c.lastNoteMonth.replace("-", ".") : "—"}</span>
            </div>
            {c.coreIssue ? <p className="mt-1.5 text-sm font-medium text-slate-600">{c.coreIssue}</p> : null}
            <button
              type="button"
              onClick={() => setSubsidyClient(c)}
              className="mt-2 whitespace-nowrap rounded-full bg-sky-50 px-2.5 py-1 text-sm font-bold text-sky-700 ring-1 ring-inset ring-sky-200"
            >
              💼 {getHiringSupportTip(c)}
            </button>
            <div className="mt-3 flex gap-2">
              <Link href={`/clients/${c.id}`} className="flex-1 rounded-lg bg-navy-700 px-3 py-2.5 text-center text-base font-bold text-white">상세보기</Link>
              <button onClick={() => handleDelete(c.id, c.name)} className="rounded-lg border border-slate-200 px-4 py-2.5 text-base font-bold text-slate-500">삭제</button>
            </div>
          </div>
        ))}
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-base text-slate-400">조건에 맞는 고객사가 없습니다.</div>
        ) : null}
      </section>

      {open ? <AddClientModal form={form} setForm={setForm} onClose={() => { setOpen(false); setForm(EMPTY_FORM); }} onSubmit={handleSubmit} /> : null}
      {subsidyClient ? (
        <SubsidyModal client={subsidyClient} onClose={() => setSubsidyClient(null)} />
      ) : null}
    </Layout>
  );
}

const SELECT = "rounded-lg border border-slate-300 px-4 py-2.5 text-base focus:border-navy-600 focus:outline-none focus:ring-1 focus:ring-navy-600";

function AddClientModal({
  form, setForm, onClose, onSubmit,
}: {
  form: typeof EMPTY_FORM;
  setForm: React.Dispatch<React.SetStateAction<typeof EMPTY_FORM>>;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const field = "mt-1 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-base focus:border-navy-600 focus:outline-none focus:ring-1 focus:ring-navy-600";
  const labelCls = "text-sm font-bold text-slate-600";
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 className="text-xl font-bold text-slate-900">고객사 추가</h3>
          <button onClick={onClose} className="text-2xl text-slate-400 hover:text-slate-700">✕</button>
        </div>
        <form onSubmit={onSubmit} className="px-6 py-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div><label className={labelCls}>회사명 * (고객 관리 업체에서 고르기)</label>
              <select className={field} value={form.osId} required data-testid="lab-client-pick"
                onChange={(e) => setForm((f) => fillFromOs(f, e.target.value))}>
                <option value="">업체 고르기</option>
                {osClientList().filter((c) => c.archivedAt === null && !getClients().some((x) => x.id === c.id)).map((c) => (
                  <option key={c.id} value={c.id}>{c.companyName}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-400">업체가 없으면 먼저 <a href="/ops/clients" className="font-bold text-navy-700 underline">고객 관리</a>에 등록하세요.</p>
            </div>
            <div><label className={labelCls}>업종</label><input className={field} value={form.industry} onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))} placeholder="예) 식품 제조업" /></div>
            <div><label className={labelCls}>연구소 유형</label>
              <select className={field} value={form.labType} onChange={(e) => setForm((f) => ({ ...f, labType: e.target.value as LabType }))}>
                <option value="연구개발전담부서">연구개발전담부서</option>
                <option value="기업부설연구소">기업부설연구소</option>
              </select>
            </div>
            <div><label className={labelCls}>대표자</label><input className={field} value={form.ceoName} onChange={(e) => setForm((f) => ({ ...f, ceoName: e.target.value }))} /></div>
            <div><label className={labelCls}>근로자 수</label><input type="number" min={0} className={field} value={form.employeeCount} onChange={(e) => setForm((f) => ({ ...f, employeeCount: Number(e.target.value) }))} /></div>
            <div><label className={labelCls}>연구전담요원 수</label><input type="number" min={0} className={field} value={form.researcherCount} onChange={(e) => setForm((f) => ({ ...f, researcherCount: Number(e.target.value) }))} /></div>
            <div><label className={labelCls}>법인 설립일</label><input type="date" className={field} value={form.foundedDate} onChange={(e) => setForm((f) => ({ ...f, foundedDate: e.target.value }))} /></div>
            <div><label className={labelCls}>인정일</label><input type="date" className={field} value={form.certifiedDate} onChange={(e) => setForm((f) => ({ ...f, certifiedDate: e.target.value }))} /></div>
            <div><label className={labelCls}>담당 컨설턴트</label><input className={field} value={form.consultant} onChange={(e) => setForm((f) => ({ ...f, consultant: e.target.value }))} /></div>
            <div><label className={labelCls}>사업자 유형</label>
              <select className={field} value={form.businessType} onChange={(e) => setForm((f) => ({ ...f, businessType: e.target.value as "법인사업자" | "개인사업자" }))}>
                <option value="법인사업자">법인사업자</option>
                <option value="개인사업자">개인사업자</option>
              </select>
            </div>
            <div><label className={labelCls}>고용지원금 Tip (자동)</label>
              <p className="mt-1 break-keep rounded-lg bg-sky-50 px-3.5 py-2.5 text-base font-bold text-sky-700 ring-1 ring-inset ring-sky-200">{/* [D-94] 옆 칸으로 넘치던 것 — 줄바꿈 허용 */}
                💼 {getHiringSupportTip({ employeeCount: Number(form.employeeCount) || 0, researcherCount: Number(form.researcherCount) || 0, coreIssue: form.coreIssue })}
              </p>
            </div>
            <div><label className={labelCls}>연구소 인정번호</label><input className={field} value={form.labRegistrationNumber} onChange={(e) => setForm((f) => ({ ...f, labRegistrationNumber: e.target.value }))} placeholder="예) 제2024-000000호" /></div>
            <div className="sm:col-span-2 rounded-xl bg-slate-50 p-4">
              <p className="text-base font-bold text-slate-700">절세 계산 기준 (선택 · 원 단위)</p>
              <p className="mt-0.5 text-sm text-slate-500">입력하면 고객 리포트에 예상 절세액(검토용)이 표시됩니다</p>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div><label className={labelCls}>연구원 연간 인건비 합계 (원)</label><input type="number" min={0} className={field} value={form.researchersPayrollTotal || ""} onChange={(e) => setForm((f) => ({ ...f, researchersPayrollTotal: Number(e.target.value) }))} placeholder="예) 38000000" /></div>
                <div><label className={labelCls}>연구 재료비/부품비 (원)</label><input type="number" min={0} className={field} value={form.rndMaterialCost || ""} onChange={(e) => setForm((f) => ({ ...f, rndMaterialCost: Number(e.target.value) }))} /></div>
                <div><label className={labelCls}>기타 연구개발비 (원)</label><input type="number" min={0} className={field} value={form.rndOtherCost || ""} onChange={(e) => setForm((f) => ({ ...f, rndOtherCost: Number(e.target.value) }))} /></div>
                <div><label className={labelCls}>당해연도 연구개발비 (원, 선택)</label><input type="number" min={0} className={field} value={form.currentYearRndCost || ""} onChange={(e) => setForm((f) => ({ ...f, currentYearRndCost: Number(e.target.value) }))} placeholder="미입력 시 위 합계로 추정" /></div>
                <div><label className={labelCls}>전년도 연구개발비 (원, 선택)</label><input type="number" min={0} className={field} value={form.priorYearRndCost || ""} onChange={(e) => setForm((f) => ({ ...f, priorYearRndCost: Number(e.target.value) }))} /></div>
                <div><label className={labelCls}>공제 유형</label>
                  <select className={field} value={form.taxCreditCategory} onChange={(e) => setForm((f) => ({ ...f, taxCreditCategory: e.target.value as typeof f.taxCreditCategory }))}>
                    <option value="미정">미정 (25% 예시)</option>
                    <option value="일반 R&D">일반 R&D (25%)</option>
                    <option value="신성장·원천기술">신성장·원천기술 (30%)</option>
                    <option value="국가전략기술">국가전략기술 (40%)</option>
                  </select>
                </div>
                <div><label className={labelCls}>세금 유형</label>
                  <select className={field} value={form.businessTaxType} onChange={(e) => setForm((f) => ({ ...f, businessTaxType: e.target.value as typeof f.businessTaxType }))}>
                    <option value="">자동 (법인=법인세 / 개인=종합소득세)</option>
                    <option value="법인세">법인세</option>
                    <option value="종합소득세">종합소득세</option>
                  </select>
                </div>
                <div><label className={labelCls}>예상 공제율(%) (선택)</label><input type="number" min={0} max={50} className={field} value={form.estimatedTaxCreditRate || ""} onChange={(e) => setForm((f) => ({ ...f, estimatedTaxCreditRate: Number(e.target.value) }))} placeholder="미입력 시 유형 기본값" /></div>
                <div className="sm:col-span-2"><label className={labelCls}>절세 검토 메모</label><input className={field} value={form.taxMemo} onChange={(e) => setForm((f) => ({ ...f, taxMemo: e.target.value }))} /></div>
              </div>
            </div>
            <div className="sm:col-span-2"><label className={labelCls}>핵심 이슈</label><input className={field} value={form.coreIssue} onChange={(e) => setForm((f) => ({ ...f, coreIssue: e.target.value }))} placeholder="예) 이번 달 연구노트 미작성" /></div>
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-5 py-3 text-base font-bold text-slate-600 hover:bg-slate-50">취소</button>
            <button type="submit" className="rounded-lg bg-navy-700 px-5 py-3 text-base font-bold text-white hover:bg-navy-800">저장</button>
          </div>
        </form>
      </div>
    </div>
  );
}


/* ───────────────── 고용지원금 점검 모달 (고용지원금 SaaS 연계 예정) ───────────────── */

function SubsidyModal({ client, onClose }: { client: Row; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 className="text-xl font-bold text-slate-900">고용지원금 추가 점검</h3>
          <button onClick={onClose} className="text-2xl text-slate-400 hover:text-slate-700">✕</button>
        </div>
        <div className="space-y-4 px-6 py-5">
          <div className="rounded-xl bg-sky-50 px-4 py-3 ring-1 ring-inset ring-sky-100">
            <p className="text-lg font-bold text-sky-800">{client.name}</p>
            <p className="mt-0.5 text-base text-sky-700">
              근로자 {client.employeeCount ?? "—"}명 · 연구원 {client.researcherCount}명 ·{" "}
              <span className="font-bold">💼 {getHiringSupportTip(client)}</span>
            </p>
          </div>
          <p className="text-base leading-relaxed text-slate-700">
            이 고객사는 근로자 수와 연구인력 변동 내역을 기준으로 <b>고용지원금 점검을 함께
            진행해볼 수 있습니다.</b>
          </p>
          <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-500">
            실제 지원 가능 여부는 채용일, 근로자 연령, 고용보험 이력, 기업 요건, 신청기한 등을
            별도로 확인해야 합니다.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl bg-navy-700 px-5 py-3 text-base font-bold text-white hover:bg-navy-800">
              확인
            </button>
            <button type="button" disabled className="flex-1 whitespace-nowrap rounded-xl border border-sky-200 bg-sky-50 px-5 py-3 text-base font-bold text-sky-400">
              고용지원금 SaaS 연결 예정
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
