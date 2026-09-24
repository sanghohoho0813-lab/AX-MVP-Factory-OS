import { useRef, useState } from "react";
import { flushLabStore } from "../store";
import Layout from "../components/Layout";
import SampleDataBox from "../components/SampleDataBox";
import { exportData, importData, resetData } from "../lib/localData";

export default function SettingsPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [resetText, setResetText] = useState("");


  function flash(tone: "ok" | "err", text: string) {
    setMsg({ tone, text });
    setTimeout(() => setMsg(null), 2500);
  }

  function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const r = importData(String(reader.result));
      if (r.ok) {
        flash("ok", `${r.message} 새로고침 후 반영됩니다.`);
        void flushLabStore().then(() => setTimeout(() => window.location.reload(), 600));
      } else {
        flash("err", r.message);
      }
    };
    reader.readAsText(f);
  }

  function onReset() {
    if (resetText.trim() !== "초기화") return;
    resetData();
    setResetText("");
    flash("ok", "로컬 데이터를 초기화했습니다. 새로고침 후 데모 데이터가 다시 채워집니다.");
    void flushLabStore().then(() => setTimeout(() => window.location.reload(), 600));
  }


  const field = "mt-1 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-base focus:border-navy-600 focus:outline-none focus:ring-1 focus:ring-navy-600";

  return (
    <Layout title="설정 · 데이터 관리" subtitle="저장 안내 · 백업/복원 · 초기화">
      {/* 로컬 MVP 안내 */}
      <section className="mb-5 rounded-2xl border border-sky-200 bg-sky-50 p-5">
        <p className="text-base font-bold text-sky-900">ℹ️ 이 모듈의 기록은 미래에이아이랩 OS 의 모듈 기록으로 저장됩니다.</p>
        <p className="mt-1 text-sm leading-relaxed text-sky-900/80">
          클라우드 모드에서는 작업실 안의 다른 기기에서도 같은 기록이 보이고, 로컬 모드에서는 이 브라우저에만 남습니다. 고객사(회사명·대표자·주소)는 <b>고객 관리</b> 업체를 그대로 씁니다.
        </p>
        <ul className="mt-2 space-y-1 text-sm leading-relaxed text-sky-900/80">
          <li>· <b>주 1회 백업</b>을 권장합니다 (아래 “백업 내보내기”).</li>
          <li>· <b>화면 잠금</b>은 OS 로그인이 맡습니다 — 원본의 PIN 잠금은 두지 않았습니다.</li>
          <li>· <b>비밀번호는 저장하지 않습니다</b> — 신고시스템 비밀번호 칸은 옮기지 않았습니다.</li>
        </ul>
      </section>

      {msg ? (
        <div className={`mb-5 rounded-xl px-4 py-3 text-base font-bold ${msg.tone === "ok" ? "bg-status-normalBg text-status-normal" : "bg-status-dangerBg text-status-danger"}`}>
          {msg.text}
        </div>
      ) : null}

      {/* 샘플 데이터 관리 */}
      <div className="mb-5">
        <SampleDataBox />
      </div>

      <div className="grid grid-cols-1 gap-5 @2xl:grid-cols-2">
        {/* 백업 / 복원 */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
          <h2 className="text-lg font-bold text-slate-900">백업 · 복원</h2>
          <p className="mt-1 text-sm text-slate-500">전체 데이터를 JSON 파일로 내보내고, 같은 형식의 파일로 복원합니다.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => { exportData(); flash("ok", "백업 파일을 내보냈습니다."); }}
              className="rounded-xl bg-navy-700 px-5 py-2.5 text-base font-bold text-white hover:bg-navy-800">백업 내보내기 (JSON)</button>
            <button type="button" onClick={() => fileRef.current?.click()}
              className="rounded-xl border border-navy-200 bg-white px-5 py-2.5 text-base font-bold text-navy-700 hover:bg-navy-50">백업 파일로 복원</button>
            <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={onImportFile} />
          </div>
          <p className="mt-2 text-xs text-slate-400">복원 시 같은 항목은 백업 내용으로 덮어쓰며, 완료 후 새로고침됩니다.</p>
        </section>

        {/* 초기화 */}
        <section className="rounded-2xl border-2 border-red-200 bg-white p-5 shadow-card @2xl:col-span-2">
          <h2 className="text-lg font-bold text-status-danger">로컬 데이터 초기화</h2>
          <p className="mt-1 text-sm text-slate-500">
            이 브라우저의 모든 앱 데이터(고객사·연구노트·변경·활동조사 등)를 삭제합니다. 되돌릴 수 없으니 먼저 백업하세요.
            실수 방지를 위해 아래에 <b className="text-status-danger">초기화</b>라고 입력해야 실행됩니다.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input value={resetText} onChange={(e) => setResetText(e.target.value)} placeholder="초기화"
              className={`${field} max-w-[200px]`} />
            <button type="button" onClick={onReset} disabled={resetText.trim() !== "초기화"}
              className="rounded-xl bg-status-danger px-5 py-2.5 text-base font-bold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40">전체 초기화 실행</button>
          </div>
        </section>
      </div>
    </Layout>
  );
}
