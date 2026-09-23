import { useEffect, useMemo, useState } from "react";
import Link from "../next";
import Layout from "../components/Layout";
import PageGuide from "../components/PageGuide";
import { saveReturnPoint } from "../lib/uiState";
import {
  currentMonth,
  ensureSeeded,
  getClients,
  getNoteTargets,
  isReportSent,
} from "../lib/storage";
import type { Client } from "../../types";

interface ReportRow {
  client: Client;
  notesReady: boolean;
  sent: boolean;
}

const REPORT_SECTIONS = [
  { icon: "📊", title: "이번 달 연구소 관리 요약", desc: "연구노트·변경사항·연구전담요원·연구공간 현황" },
  { icon: "📓", title: "연구활동/연구노트 현황", desc: "과제별 활동 요약과 작성 상태" },
  { icon: "🏛️", title: "설립/인정요건 유지 현황", desc: "전담요원 수·물적요건·기자재 상태" },
  { icon: "🔄", title: "변경신고 관리 현황", desc: "확인된 변경사항·기한·진행 상태" },
  { icon: "💎", title: "기대 혜택/활용 가능성", desc: "세액공제 검토 가능성 · 요건 충족 시 활용 가능" },
  { icon: "🛡️", title: "리스크 관리 현황", desc: "미작성·신고누락·실사·조사 리스크 점검" },
  { icon: "📅", title: "다음 달 조치사항", desc: "고객 준비 자료와 컨설턴트 처리 항목" },
  { icon: "💬", title: "컨설턴트 의견", desc: "관리 상태 평가와 보완 권장사항" },
];

export default function ReportsPage() {
  const month = useMemo(() => currentMonth(), []);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [reportType, setReportType] = useState<"요약" | "상세" | "절세" | "방문">("요약");

  useEffect(() => {
    ensureSeeded();
    const targets = getNoteTargets(month);
    const readyClients = new Set(
      targets.filter((t) => t.status === "저장 완료").map((t) => t.project.clientId),
    );
    setRows(
      getClients().map((client) => ({
        client,
        notesReady: readyClients.has(client.id),
        sent: isReportSent(client.id, month),
      })),
    );
  }, [month]);

  const pending = rows.filter((r) => !r.sent);
  const monthLabel = month.replace("-", "년 ") + "월";

  return (
    <Layout
      title="고객 리포트"
      subtitle={`${monthLabel} · 고객에게 "이렇게 관리하고 있습니다"를 보여주는 영업 자료`}
    >
      <PageGuide
        id="reports"
        purpose="사후관리 결과를 고객에게 설명하거나 방문 미팅 자료로 활용합니다."
        when="월간 리포트 발송이나 방문 미팅을 준비할 때 사용합니다."
        result="월간 요약, 상세 사후관리, 절세/혜택, 방문용 보고서를 얻습니다."
        steps={["고객사 선택", "리포트 보기", "추가 혜택 후보 선택", "공유 모드 또는 PDF 출력"]}
      />
      {/* 요약 */}
      <section className="mb-5 grid grid-cols-3 gap-3 sm:gap-4">
        <Summary label="전체 고객사" value={rows.length} tone="text-navy-700" />
        <Summary label="발송 대기" value={pending.length} tone="text-status-warning" />
        <Summary label="발송 완료" value={rows.length - pending.length} tone="text-status-normal" />
      </section>

      {/* 리포트 유형 선택 */}
      <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-card">
        <p className="text-base font-bold text-slate-700">리포트 유형 선택</p>
        <div className="mt-2 grid grid-cols-2 gap-2 @2xl:grid-cols-4">
          {(["요약", "상세", "절세", "방문"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setReportType(t)}
              className={`whitespace-nowrap rounded-xl border px-3 py-3 text-base font-bold ${
                reportType === t
                  ? "border-navy-600 bg-navy-50 text-navy-700"
                  : "border-slate-200 text-slate-500 hover:bg-slate-50"
              }`}
            >
              {t === "요약" ? "📄 월간 요약" : t === "상세" ? "📚 상세 사후관리" : t === "절세" ? "💰 절세/혜택" : "🤝 방문용 보고서"}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-slate-500">
          {reportType === "요약"
            ? "이번 달 관리 상태 + 예상 절세액 + 다음 조치 — 매월 보내기 좋은 1페이지"
            : reportType === "상세"
              ? "연구노트·인력·공간·변경신고·조사·실사·리스크까지 전체 점검 내용"
              : reportType === "절세"
                ? "연구개발비 세액공제 예상(연/월/일 환산)과 추가 혜택 검토 가능성 중심"
                : "방문 미팅용 종합 보고서 — 관리 결과 + 추가 컨설팅 제안 포인트까지 한 번에"}
        </p>
      </section>

      <div className="grid grid-cols-1 gap-5 @4xl:grid-cols-2">
        {/* 고객사별 리포트 */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-card">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-bold text-slate-900">고객사별 월간 리포트</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {rows.map(({ client, notesReady, sent }) => (
              <div key={client.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
                <div className="min-w-0">
                  <p className="text-base font-semibold text-slate-900">{client.name}</p>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {client.labType} · 연구노트 {notesReady ? "완료" : "준비중"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ring-inset ${
                      sent
                        ? "bg-status-normalBg text-status-normal ring-green-200"
                        : "bg-amber-50 text-amber-700 ring-amber-200"
                    }`}
                  >
                    {sent ? "발송 완료" : "발송 대기"}
                  </span>
                  <Link
                    href={`/clients/${client.id}/report?month=${month}&type=${reportType}`}
                    onClick={() => saveReturnPoint("/reports", "고객 리포트")}
                    className="whitespace-nowrap rounded-xl bg-navy-700 px-5 py-2.5 text-base font-bold text-white shadow-sm hover:bg-navy-800"
                  >
                    📄 리포트 보기
                  </Link>
                  <Link
                    href={`/clients/${client.id}/report?month=${month}&type=${reportType}&print=1`}
                    className="whitespace-nowrap rounded-xl border border-navy-200 px-4 py-2.5 text-sm font-bold text-navy-700 hover:bg-navy-50"
                  >
                    출력
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 리포트 구성 미리보기 (영업용 설명) */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-card">
          <div className="border-b border-slate-200 bg-navy-900 px-5 py-4 rounded-t-2xl">
            <h2 className="text-base font-bold text-white">월간 리포트 구성</h2>
            <p className="mt-0.5 text-sm text-slate-300">
              10개 섹션 — 단순 점검표가 아닌, 고객이 관리 가치를 체감하는 자료
            </p>
          </div>
          <div className="divide-y divide-slate-50">
            {REPORT_SECTIONS.map((s) => (
              <div key={s.title} className="flex items-start gap-3 px-5 py-3">
                <span className="mt-0.5 text-base">{s.icon}</span>
                <div>
                  <p className="text-base font-semibold text-slate-800">{s.title}</p>
                  <p className="text-sm text-slate-500">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-2 border-t border-slate-100 p-5">
            <div className="flex gap-2">
              <p className="flex-1 rounded-lg bg-navy-50 px-3 py-2.5 text-sm font-semibold text-navy-700">
                💡 "출력"을 누르면 리포트가 열리며 인쇄(PDF 저장) 창이 자동으로 뜹니다
              </p>
              <button type="button" className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-400" disabled>
                고객 공유 링크 (준비중)
              </button>
            </div>
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-500">
              ※ 기대 혜택은 "세액공제 검토 가능성", "요건 충족 시 활용 가능"으로 안내합니다. 확정
              세액·확정 혜택처럼 표현하지 않으며, 본 리포트는 사전 점검자료입니다.
            </p>
          </div>
        </section>
      </div>
    </Layout>
  );
}

function Summary({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 text-center shadow-card">
      <p className={`text-3xl font-bold ${tone}`}>{value}</p>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
    </div>
  );
}
