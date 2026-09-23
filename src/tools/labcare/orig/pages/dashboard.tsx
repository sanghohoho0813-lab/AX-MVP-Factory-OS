import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "../next";
import Layout from "../components/Layout";
import PageGuide from "../components/PageGuide";
import SampleDataBox from "../components/SampleDataBox";
import { saveReturnPoint } from "../lib/uiState";
import MetricCard from "../components/MetricCard";
import {
  currentMonth,
  ensureSeeded,
  getManagementStats,
  getNoteTargets,
  type ManagementStats,
  type NoteTarget,
} from "../lib/storage";
import {
  getSetupPackages,
  type SetupPackage,
  ddayOf,
  docProgress,
  getChangeItems,
  getTodayTasks,
  isSurveySeason,
  missingDocs,
  surveyDeadlineLabel,
  type ChangeItem,
  type TodayTask,
} from "../lib/mockStage1";
import type { NoteStatus } from "../../types";

const NOTE_STATUS_STYLE: Record<NoteStatus, string> = {
  "작성 필요": "bg-amber-50 text-amber-700 ring-amber-200",
  작성중: "bg-blue-50 text-blue-700 ring-blue-200",
  "초안 완료": "bg-indigo-50 text-indigo-700 ring-indigo-200",
  "실사보완 완료": "bg-violet-50 text-violet-700 ring-violet-200",
  "저장 완료": "bg-status-normalBg text-status-normal ring-green-200",
};

const DDAY_STYLE: Record<string, string> = {
  ok: "bg-slate-100 text-slate-600 ring-slate-200",
  warn: "bg-amber-50 text-amber-700 ring-amber-200",
  danger: "bg-status-dangerBg text-status-danger ring-red-200",
  over: "bg-red-600 text-white ring-red-700",
};

const SETUP_STAGES = [
  "가능성 체크 완료",
  "서류 준비중",
  "조직도/도면 필요",
  "최종 검토",
  "신고 준비 완료",
] as const;

export default function DashboardPage() {
  const month = useMemo(() => currentMonth(), []);
  const [stats, setStats] = useState<ManagementStats | null>(null);
  const [noteTargets, setNoteTargets] = useState<NoteTarget[]>([]);
  const [tasks, setTasks] = useState<TodayTask[]>([]);
  const [changes, setChanges] = useState<ChangeItem[]>([]);
  const [setupPkgs, setSetupPkgs] = useState<SetupPackage[]>([]);

  const load = useCallback(() => {
    setStats(getManagementStats(month));
    const targets = getNoteTargets(month);
    const order: Record<NoteStatus, number> = {
      "작성 필요": 0,
      작성중: 1,
      "초안 완료": 2,
      "실사보완 완료": 3,
      "저장 완료": 4,
    };
    targets.sort((a, b) => order[a.status] - order[b.status]);
    setNoteTargets(targets);
    setTasks(getTodayTasks());
    setChanges(getChangeItems());
    setSetupPkgs(getSetupPackages());
  }, [month]);

  useEffect(() => {
    ensureSeeded();
    load();
  }, [load]);

  const monthLabel = month.replace("-", "년 ") + "월";
  const setupInProgress = setupPkgs.filter((p) => docProgress(p) < 100);
  const docsInProgress = setupInProgress.length;
  const pendingChanges = changes.filter(
    (c) => c.status !== "신고 완료" && c.status !== "해당 없음",
  );
  const sentReports = (stats?.managedClients ?? 0) - (stats?.reportPending ?? 0);
  const reportReadyRate = stats?.managedClients
    ? Math.round(((stats.managedClients - stats.notesNeeded === 0 ? 0 : stats.managedClients - Math.min(stats.notesNeeded, stats.managedClients)) / stats.managedClients) * 100)
    : 0;

  return (
    <Layout
      title="대시보드"
      subtitle={`${monthLabel} · 설립부터 사후관리까지 한눈에`}
      actions={
        <Link
          href="/tasks"
          className="rounded-lg bg-navy-700 px-5 py-2.5 text-base font-bold text-white transition-colors hover:bg-navy-800"
        >
          오늘 할 일 {tasks.length}건
        </Link>
      }
    >
      <PageGuide
        id="dashboard"
        purpose="오늘 처리할 일과 고객사 관리 현황을 한눈에 보는 첫 화면입니다."
        when="매일 업무를 시작할 때 가장 먼저 봅니다."
        result="오늘 할 일, 변경 확인 대상, 연구노트·활동조사·리포트 진행 상황을 확인합니다."
        steps={["오늘 할 일 확인", "지연 항목 처리", "고객 리포트·변경사항으로 이동"]}
      />
      {/* ── 히어로 ── */}
      <section className="mb-5 overflow-hidden rounded-2xl bg-navy-900 px-6 py-6 text-white shadow-card sm:px-7">
        <p className="text-xl font-bold sm:text-2xl">
          기업부설연구소, <span className="text-amber-300">설립부터 사후관리까지</span> 한 번에
          관리합니다.
        </p>
        <p className="mt-2 max-w-3xl text-base leading-relaxed text-slate-300">
          {monthLabel} 현재 <span className="font-semibold text-white">{stats?.managedClients ?? 0}개 고객사</span>를
          관리 중입니다. 오늘 처리할 일 <span className="font-semibold text-amber-300">{tasks.length}건</span>,
          변경신고 진행 <span className="font-semibold text-white">{pendingChanges.length}건</span>,
          설립 진행 <span className="font-semibold text-white">{docsInProgress}건</span>이 있습니다.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <HeroBtn href="/assessment" label="설립 가능성 체크" primary />
          <HeroBtn href="/setup-documents" label="설립서류 관리" />
          <HeroBtn href="/notes" label="연구노트 작성" />
          <HeroBtn href="/reports" label="고객 리포트" />
        </div>
      </section>

      {/* ── 샘플 데이터 관리 (대시보드 상단) ── */}
      <div className="mb-5">
        <SampleDataBox onChange={load} />
      </div>

      {/* ── 활동조사 시즌 배너 ── */}
      {isSurveySeason() ? (
        <section className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📋</span>
            <div>
              <p className="text-base font-bold text-amber-800">연구개발활동조사 시즌입니다</p>
              <p className="text-sm text-amber-700">
                {surveyDeadlineLabel()}까지 제출 — 미제출 시 인정취소 사유가 됩니다
              </p>
            </div>
          </div>
          <Link
            href="/activity-survey"
            className="rounded-lg bg-amber-600 px-5 py-2.5 text-base font-bold text-white hover:bg-amber-700"
          >
            제출 현황 보기
          </Link>
        </section>
      ) : null}

      {/* ── KPI 6종 ── */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4 @2xl:grid-cols-3 @4xl:grid-cols-6">
        <MetricCard label="관리 고객사" value={stats?.managedClients ?? 0} unit="개사" tone="navy" icon="🏢" />
        <MetricCard label="설립 진행중" value={docsInProgress} unit="건" tone="navy" icon="🚀" hint="가능성 체크~신고 준비" />
        <MetricCard label="서류 준비중" value={docsInProgress} unit="건" tone="warning" icon="📁" hint="설립서류 미완료" />
        <MetricCard label="연구노트 작성 필요" value={stats?.notesNeeded ?? 0} unit="건" tone="warning" icon="📓" hint="이번 달 미완료" />
        <MetricCard label="변경사항 확인 필요" value={pendingChanges.length} unit="건" tone="danger" icon="🔄" hint="30일 기한 관리" />
        <MetricCard label="리포트 발송 대기" value={stats?.reportPending ?? 0} unit="개사" tone="navy" icon="📤" />
      </section>

      <div className="mt-6 grid grid-cols-1 gap-5 @4xl:grid-cols-3">
        {/* ── 오늘 할 일 ── */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-card @4xl:col-span-1">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-bold text-slate-900">오늘 할 일</h2>
            <Link href="/tasks" className="text-sm font-bold text-navy-600 hover:text-navy-800">
              전체 보기 →
            </Link>
          </div>
          <div className="divide-y divide-slate-50">
            {tasks.slice(0, 6).map((t) => (
              <Link
                key={t.id}
                href={t.href}
                onClick={() => saveReturnPoint("/dashboard", "대시보드")}
                className="flex items-start gap-3 px-5 py-3.5 hover:bg-slate-50/60"
              >
                <span className="mt-0.5 text-base">{t.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-medium leading-tight text-slate-800">
                    {t.urgent ? <span className="mr-1 rounded bg-red-600 px-1.5 py-0.5 text-xs font-bold text-white">긴급</span> : null}
                    {t.title}
                  </p>
                  <p className="mt-0.5 truncate text-sm text-slate-500">
                    {t.clientName}
                    {t.meta ? ` · ${t.meta}` : ""}
                  </p>
                </div>
              </Link>
            ))}
            {tasks.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-400">
                오늘 처리할 일이 없습니다. 👍
              </p>
            ) : null}
          </div>
        </section>

        {/* ── 설립 진행 현황 + 서류 준비율 ── */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-card @4xl:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-bold text-slate-900">설립 진행 현황</h2>
            <Link href="/setup-documents" className="text-sm font-bold text-navy-600 hover:text-navy-800">
              설립서류 관리 →
            </Link>
          </div>
          <div className="space-y-5 px-5 py-5">
            {setupInProgress.map((pkg) => {
              const progress = docProgress(pkg);
              const missing = missingDocs(pkg);
              const stageIdx = SETUP_STAGES.indexOf(pkg.stage);
              return (
                <div key={pkg.id} className="rounded-xl border border-slate-100 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">{pkg.clientName}</p>
                      <p className="text-sm text-slate-500">{pkg.labType}</p>
                    </div>
                    <span className="rounded-full bg-navy-50 px-3.5 py-1.5 text-sm font-semibold text-navy-700 ring-1 ring-inset ring-navy-100">
                      {pkg.stage}
                    </span>
                  </div>
                  {/* 단계 표시 */}
                  <div className="mt-3 flex items-center gap-1">
                    {SETUP_STAGES.map((s, i) => (
                      <div
                        key={s}
                        className={`h-1.5 flex-1 rounded-full ${
                          i <= stageIdx ? "bg-navy-600" : "bg-slate-100"
                        }`}
                        title={s}
                      />
                    ))}
                  </div>
                  {/* 준비율 */}
                  <div className="mt-3 flex items-center gap-3">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full ${progress >= 80 ? "bg-status-normal" : progress >= 50 ? "bg-blue-500" : "bg-status-warning"}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className="text-lg font-bold text-slate-700">{progress}%</span>
                  </div>
                  {missing.length ? (
                    <p className="mt-2 text-base text-slate-600">
                      누락: <span className="font-medium text-amber-700">{missing.slice(0, 3).map((d) => d.label).join(", ")}{missing.length > 3 ? ` 외 ${missing.length - 3}건` : ""}</span>
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-status-normal">서류 준비 완료 — 최종 점검 단계</p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 @4xl:grid-cols-2">
        {/* ── 연구노트 작성 대상 ── */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-card">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-bold text-slate-900">이번 달 연구노트 작성 대상</h2>
            <Link href="/notes" className="text-sm font-bold text-navy-600 hover:text-navy-800">
              연구노트 →
            </Link>
          </div>
          <div className="divide-y divide-slate-50">
            {noteTargets.map((t) => (
              <div key={t.project.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-slate-900">{t.client?.name ?? "—"}</p>
                  <p className="truncate text-sm text-slate-500">
                    {t.project.name} · 마지막 작성 {t.lastMonth ? t.lastMonth.replace("-", ".") : "—"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ring-inset ${NOTE_STATUS_STYLE[t.status]}`}>
                    {t.status}
                  </span>
                  <Link
                    href={`/notes?client=${t.project.clientId}&project=${t.project.id}&month=${month}`}
                    className={`rounded-lg px-4 py-2 text-sm font-bold ${
                      t.status === "저장 완료"
                        ? "border border-slate-300 text-slate-600 hover:bg-slate-50"
                        : "bg-navy-700 text-white hover:bg-navy-800"
                    }`}
                  >
                    {t.status === "저장 완료" ? "보기" : "생성"}
                  </Link>
                </div>
              </div>
            ))}
            {noteTargets.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-400">진행 중인 연구과제가 없습니다.</p>
            ) : null}
          </div>
        </section>

        {/* ── 변경사항 관리 (D-day) ── */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-card">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-bold text-slate-900">변경사항 관리</h2>
            <Link href="/changes" className="text-sm font-bold text-navy-600 hover:text-navy-800">
              전체 보기 →
            </Link>
          </div>
          <div className="divide-y divide-slate-50">
            {changes.map((c) => {
              const d = ddayOf(c.deadline);
              const done = c.status === "신고 완료";
              return (
                <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-slate-900">{c.item}</p>
                    <p className="truncate text-sm text-slate-500">
                      {c.clientName} · 기한 {c.deadline.replace(/-/g, ".")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {!done ? (
                      <span className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm font-bold ring-1 ring-inset ${DDAY_STYLE[d.tone]}`}>
                        {d.label}
                      </span>
                    ) : null}
                    <span className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ring-inset ${
                      done
                        ? "bg-status-normalBg text-status-normal ring-green-200"
                        : "bg-slate-100 text-slate-600 ring-slate-200"
                    }`}>
                      {c.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* ── 고객 리포트 현황 ── */}
      <section className="mt-5 rounded-2xl border border-slate-200 bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">고객 리포트</h2>
          <Link href="/reports" className="text-sm font-bold text-navy-600 hover:text-navy-800">
            리포트 센터 →
          </Link>
        </div>
        <div className="grid grid-cols-3 divide-x divide-slate-100 px-2 py-5 text-center">
          <div>
            <p className="text-3xl font-bold text-status-warning">{stats?.reportPending ?? 0}</p>
            <p className="mt-1 text-sm text-slate-500">발송 대기</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-status-normal">{Math.max(0, sentReports)}</p>
            <p className="mt-1 text-sm text-slate-500">발송 완료/관리중</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-navy-700">{reportReadyRate}%</p>
            <p className="mt-1 text-sm text-slate-500">이번 달 리포트 준비율</p>
          </div>
        </div>
      </section>
    </Layout>
  );
}

function HeroBtn({ href, label, primary }: { href: string; label: string; primary?: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-xl px-5 py-2.5 text-base font-bold transition-colors ${
        primary
          ? "bg-amber-400 text-navy-950 hover:bg-amber-300"
          : "bg-white/10 text-white ring-1 ring-inset ring-white/20 hover:bg-white/20"
      }`}
    >
      {label}
    </Link>
  );
}
