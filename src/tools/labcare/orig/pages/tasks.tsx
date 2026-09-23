import { useEffect, useState } from "react";
import Link from "../next";
import Layout from "../components/Layout";
import PageGuide from "../components/PageGuide";
import { saveReturnPoint } from "../lib/uiState";
import { ensureSeeded } from "../lib/storage";
import { getTodayTasks, type TaskKind, type TodayTask } from "../lib/mockStage1";

const KIND_ORDER: TaskKind[] = ["변경신고", "설립서류", "연구노트", "리포트", "사진요청"];

const KIND_STYLE: Record<TaskKind, string> = {
  변경신고: "bg-status-dangerBg text-status-danger ring-red-200",
  설립서류: "bg-navy-50 text-navy-700 ring-navy-100",
  연구노트: "bg-blue-50 text-blue-700 ring-blue-200",
  리포트: "bg-status-normalBg text-status-normal ring-green-200",
  사진요청: "bg-amber-50 text-amber-700 ring-amber-200",
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<TodayTask[]>([]);
  const [done, setDone] = useState<Set<string>>(new Set());

  useEffect(() => {
    ensureSeeded();
    setTasks(getTodayTasks());
  }, []);

  function toggle(id: string) {
    setDone((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const urgent = tasks.filter((t) => t.urgent);
  const normal = tasks.filter((t) => !t.urgent);
  const doneCount = tasks.filter((t) => done.has(t.id)).length;

  return (
    <Layout
      title="오늘 할 일"
      subtitle={`총 ${tasks.length}건 · 완료 ${doneCount}건 · 긴급 ${urgent.length}건`}
    >
      <PageGuide
        id="tasks"
        purpose="오늘 처리해야 할 사후관리 업무를 모아보는 화면입니다."
        when="그날 처리할 업무를 순서대로 정리할 때 사용합니다."
        result="연구노트 작성, 변경 확인, 활동조사, 리포트 발송 등 처리 대상을 확인합니다."
        steps={["긴급·기한 임박 항목부터 처리", "완료 체크", "다음 고객사로 이동"]}
      />
      {/* 진행률 */}
      <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">오늘 처리 진행률</p>
          <p className="text-sm font-bold text-navy-700">
            {tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0}%
          </p>
        </div>
        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full bg-navy-600 transition-all"
            style={{ width: `${tasks.length ? (doneCount / tasks.length) * 100 : 0}%` }}
          />
        </div>
      </section>

      {urgent.length ? (
        <TaskGroup title="🚨 긴급 (기한 임박·초과)" tasks={urgent} done={done} onToggle={toggle} />
      ) : null}
      <TaskGroup title="오늘 처리할 일" tasks={normal} done={done} onToggle={toggle} />

      {tasks.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-card">
          <p className="text-3xl">🎉</p>
          <p className="mt-2 text-sm text-slate-500">오늘 처리할 일이 없습니다.</p>
        </div>
      ) : null}
    </Layout>
  );
}

function TaskGroup({
  title,
  tasks,
  done,
  onToggle,
}: {
  title: string;
  tasks: TodayTask[];
  done: Set<string>;
  onToggle: (id: string) => void;
}) {
  if (!tasks.length) return null;
  const sorted = [...tasks].sort(
    (a, b) => KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind),
  );
  return (
    <section className="mb-5 rounded-2xl border border-slate-200 bg-white shadow-card">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      </div>
      <div className="divide-y divide-slate-50">
        {sorted.map((t) => {
          const isDone = done.has(t.id);
          return (
            <div key={t.id} className="flex items-center gap-3 px-5 py-3.5">
              <button
                type="button"
                onClick={() => onToggle(t.id)}
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors ${
                  isDone
                    ? "border-status-normal bg-status-normal text-white"
                    : "border-slate-300 text-transparent hover:border-navy-500"
                }`}
              >
                ✓
              </button>
              <div className={`min-w-0 flex-1 ${isDone ? "opacity-40" : ""}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-bold ring-1 ring-inset ${KIND_STYLE[t.kind]}`}>
                    {t.kind}
                  </span>
                  <p className={`text-base font-medium text-slate-800 ${isDone ? "line-through" : ""}`}>
                    {t.title}
                  </p>
                </div>
                <p className="mt-0.5 truncate text-sm text-slate-500">
                  {t.clientName}
                  {t.meta ? ` · ${t.meta}` : ""}
                </p>
              </div>
              <Link
                href={t.href}
                onClick={() => saveReturnPoint("/tasks", "오늘 할 일")}
                className="shrink-0 rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-navy-700 hover:bg-navy-50"
              >
                이동 →
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}
