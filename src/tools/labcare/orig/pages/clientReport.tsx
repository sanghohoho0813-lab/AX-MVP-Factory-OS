import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "../next";
import { useParams, useRouter, useSearchParams } from "../nav";
import Layout from "../components/Layout";
import OsAttach from "../components/OsAttach";
import { getReturnPoint, clearReturnPoint, type ReturnPoint } from "../lib/uiState";
import {
  currentMonth,
  ensureSeeded,
  getBenefitKeys,
  getChecksByClient,
  getClient,
  getNoteFor,
  getProjectsByClient,
  isReportSent,
  markReportSent,
  setBenefitKeys,
  unmarkReportSent,
} from "../lib/storage";
import { formatKRW, formatManwon, getTaxCreditEstimate } from "../../lib/taxCredit";
import type {
  CheckAnswers,
  Client,
  MonthlyCheck,
  ResearchNote,
  ResearchProject,
} from "../../types";

interface NoteRow {
  project: ResearchProject;
  note: ResearchNote | undefined;
}

type ReportType = "요약" | "상세" | "방문";

/** 추가 혜택 검토 후보 (절세/혜택 빌더 — 검토 가능성 톤 유지) */
const BENEFIT_OPTIONS: { key: string; label: string; sentence: string }[] = [
  { key: "welfareFund", label: "사내근로복지기금", sentence: "사내근로복지기금은 임직원 복지 재원 마련과 법인 비용처리 구조를 함께 검토할 수 있는 영역입니다." },
  { key: "policyFund", label: "정책자금/정부지원사업", sentence: "정책자금 및 정부지원사업 신청 시 기업부설연구소 보유 여부가 기술성·혁신성 판단에 긍정적으로 활용될 수 있습니다." },
  { key: "employTax", label: "통합고용세액공제", sentence: "통합고용세액공제는 고용 증가 여부와 인건비 구조에 따라 추가 절세 가능성을 검토할 수 있습니다." },
  { key: "smeSpecial", label: "중소기업특별세액감면", sentence: "중소기업특별세액감면은 업종·규모·소재지 요건에 따라 적용 가능성을 별도로 확인할 필요가 있습니다." },
  { key: "startupTax", label: "창업중소기업 세액감면", sentence: "창업중소기업 세액감면은 창업 시기·업종·지역 요건 충족 시 세부담 절감 가능성을 검토할 수 있습니다." },
  { key: "rndAllowance", label: "연구활동비 비과세", sentence: "연구전담요원의 연구활동비 비과세(월 한도)는 급여 구조 설계와 함께 검토할 수 있습니다." },
  { key: "hireSupport", label: "고용지원금", sentence: "고용 관련 지원금은 채용 계획과 인원 변동에 따라 신청 가능성을 점검할 수 있습니다." },
  { key: "certify", label: "기업인증/벤처인증", sentence: "기업인증·벤처인증은 연구소 보유와 연계해 가점·우대 혜택으로 이어질 수 있어 단계적 취득을 검토할 수 있습니다." },
  { key: "patent", label: "특허/지식재산권", sentence: "특허·지식재산권은 연구과제 결과물과 연계해 기술보호와 인증·지원사업 가점 활용 가능성을 검토할 수 있습니다." },
  { key: "bylaws", label: "정관/임원보수/퇴직금 규정", sentence: "정관·임원보수·퇴직금 규정 정비는 법인 자금 흐름과 세무 리스크 관리 차원에서 점검할 수 있는 영역입니다." },
  { key: "finance", label: "가지급금/가수금/이익소각", sentence: "가지급금·가수금·이익소각 등 재무구조 점검은 법인 신용도와 세무 리스크 관리를 위해 검토할 수 있습니다." },
];

function consultantOpinion(noteRows: NoteRow[], check: MonthlyCheck | undefined): string {
  const saved = noteRows.filter((r) => r.note?.status === "저장 완료").length;
  const total = noteRows.length;
  const a = check?.answers;
  const hasChange = !!a && (a.personnelChange || a.spaceChange || a.registrationChange);

  if (total > 0 && saved === total && !hasChange) {
    return "이번 달 연구활동과 연구노트가 빠짐없이 정리되었고, 별도의 변경사항도 확인되지 않았습니다. 연구소가 안정적으로 관리되고 있으니 현재 흐름을 그대로 이어가시면 됩니다.";
  }
  if (hasChange) {
    return "이번 달 연구활동을 확인했으며, 변경사항이 일부 확인되어 변경신고 대상 여부를 함께 검토하고 있습니다. 연구노트와 함께 변경 부분을 정리해 연구소 인정 유지에 빈틈이 없도록 관리하겠습니다.";
  }
  return "이번 달 연구활동을 확인하고 연구노트를 정리하고 있습니다. 미작성 과제는 담당 컨설턴트가 함께 보완하여, 매월 연구소 관리가 누락 없이 이어지도록 지원하겠습니다.";
}

function ReportBody() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const id = params.id;
  const monthParam = search.get("month");
  const autoPrint = search.get("print") === "1";
  const typeParam = search.get("type");
  const [reportType, setReportType] = useState<ReportType>(
    typeParam === "상세" || typeParam === "방문" ? typeParam : "요약",
  );

  const [client, setClient] = useState<Client | null>(null);
  const [month, setMonth] = useState<string>(monthParam ?? currentMonth());
  const [check, setCheck] = useState<MonthlyCheck | undefined>();
  const [noteRows, setNoteRows] = useState<NoteRow[]>([]);
  const [sent, setSent] = useState(false);
  const [customerView, setCustomerView] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [benefitKeys, setBenefitKeysState] = useState<string[]>([]);
  const [rp, setRp] = useState<ReturnPoint | null>(null);

  useEffect(() => { setRp(getReturnPoint()); }, []);

  useEffect(() => {
    ensureSeeded();
    const c = getClient(id) ?? null;
    setClient(c);

    const checks = getChecksByClient(id);
    const m = monthParam ?? checks[0]?.month ?? currentMonth();
    setMonth(m);
    setCheck(checks.find((x) => x.month === m) ?? checks[0]);

    const projects = getProjectsByClient(id);
    setNoteRows(projects.map((p) => ({ project: p, note: getNoteFor(p.id, m) })));
    setSent(isReportSent(id, m));
    setBenefitKeysState(getBenefitKeys(id));
    setLoaded(true);
  }, [id, monthParam]);

  function toggleBenefit(key: string) {
    setBenefitKeysState((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      setBenefitKeys(id, next);
      return next;
    });
  }

  // ?print=1 로 진입하면 로드 후 인쇄 창 자동 실행
  useEffect(() => {
    if (!autoPrint || !loaded) return;
    const t = setTimeout(() => window.print(), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPrint, loaded]);

  const monthLabel = useMemo(() => month.replace("-", "년 ") + "월", [month]);

  if (!loaded) return <Layout title="불러오는 중…">{null}</Layout>;
  if (!client) {
    return (
      <Layout title="고객사를 찾을 수 없습니다">
        <Link href="/clients" className="text-navy-600">
          ← 고객사 목록으로
        </Link>
      </Layout>
    );
  }

  const a: CheckAnswers | undefined = check?.answers;
  const savedNotes = noteRows.filter((r) => r.note?.status === "저장 완료").length;
  const activityDone = noteRows.filter((r) => r.note && r.note.activities.trim()).length;
  const changes: string[] = [];
  if (a?.personnelChange) changes.push("연구전담요원 변동");
  if (a?.spaceChange) changes.push("연구공간 변경");
  if (a?.registrationChange) changes.push("회사정보(주소·대표자·상호) 변경");

  function handleMarkSent() {
    markReportSent(id, month);
    setSent(true);
  }

  function handleUnmarkSent() {
    unmarkReportSent(id, month);
    setSent(false);
  }

  // 실사 대비 체크 항목
  const auditChecks = [
    { label: "연구노트 작성 (이번 달)", ok: savedNotes > 0 },
    {
      label: "업종·제품·서비스와 직접 관련성 보완",
      ok: noteRows.some((r) => r.note?.auditReviewed),
    },
    { label: "참여 연구원 역할 기재", ok: noteRows.some((r) => (r.note?.roles?.length ?? 0) > 0) },
    { label: "연구과제 진행 확인", ok: a ? a.projectOngoing : noteRows.length > 0 },
    { label: "연구개발비 증빙 정리", ok: a ? a.expenseEvidenceOrganized : false },
  ];

  // 다음 달 조치사항
  const nextActions: string[] = [];
  const pending = noteRows.filter((r) => r.note?.status !== "저장 완료");
  if (pending.length)
    nextActions.push(`미완료 과제 ${pending.length}건의 연구노트를 작성·저장합니다.`);
  if (changes.length)
    nextActions.push("확인된 변경사항의 변경신고 대상 여부를 확정하고 기한 내 처리합니다.");
  nextActions.push("연구개발비 증빙(인건비·재료비)을 결산 전 정리해 둡니다.");
  nextActions.push(`다음 월간 점검(${nextMonthLabel(month)}) 일정을 사전에 확정합니다.`);

  return (
    <Layout
      title="월간 사후관리 리포트"
      subtitle={`${client.name} · ${monthLabel}`}
      actions={
        <div className="flex flex-wrap gap-2 no-print">
          {rp ? (
            <button onClick={() => { clearReturnPoint(); router.push(rp.path); }} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-base font-bold text-slate-600 hover:bg-slate-50">← {rp.label}</button>
          ) : null}
          {customerView ? null : sent ? (
            <div className="flex items-center gap-1.5">
              <span className="rounded-lg bg-status-normalBg px-4 py-2 text-base font-semibold text-status-normal">
                발송 완료
              </span>
              <button
                onClick={handleUnmarkSent}
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-bold text-slate-500 hover:bg-slate-50"
              >
                발송 완료 취소
              </button>
            </div>
          ) : (
            <button
              onClick={handleMarkSent}
              className="rounded-lg border border-navy-200 bg-white px-5 py-2.5 text-base font-bold text-navy-700 hover:bg-navy-50"
            >
              발송 완료 처리
            </button>
          )}
          <button
            onClick={() => setCustomerView((v) => !v)}
            className={`rounded-lg px-5 py-2.5 text-base font-bold ${
              customerView
                ? "bg-amber-400 text-navy-950 hover:bg-amber-300"
                : "border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
            }`}
          >
            {customerView ? "공유 모드 해제" : "고객 공유용 보기"}
          </button>
          <button
            onClick={() => window.print()}
            className="rounded-lg bg-navy-700 px-5 py-2.5 text-base font-bold text-white hover:bg-navy-800"
          >
            PDF 출력
          </button>
          {!customerView ? (
            <Link
              href={`/clients/${id}`}
              className="rounded-lg border border-slate-300 px-5 py-2.5 text-base font-bold text-slate-600 hover:bg-slate-50"
            >
              상세로
            </Link>
          ) : null}
        </div>
      }
    >
      <div className="mx-auto max-w-3xl">
        {customerView ? (
          <div className="no-print mb-4 rounded-xl bg-amber-50 px-5 py-3 text-center text-base font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
            👥 고객 공유용 보기 모드 — 이 화면을 고객에게 그대로 보여주셔도 됩니다
          </div>
        ) : (
          <div className="no-print mb-4">
            <OsAttach
              clientId={client.id}
              title={`${monthLabel} 사후관리 리포트`}
              verdict={check?.level ?? null}
              verdictLabel={check ? `${check.level} · 연구노트 ${noteRows.filter((r) => r.note).length}/${noteRows.length}` : "점검 전"}
              summary={[
                `[${client.name} · ${monthLabel} 사후관리 리포트]`,
                check ? `점검 결과: ${check.level}` : "이번 달 점검 기록 없음",
                `연구노트: ${noteRows.filter((r) => r.note).length}/${noteRows.length}건`,
                changes.length ? `변경사항: ${changes.length}건` : "변경사항 없음",
                "",
                "다음 할 일",
                ...nextActions.map((a) => `· ${a}`),
              ].join("\n")}
              data={{ kind: "report", clientId: client.id, month }}
            />
          </div>
        )}

        {/* 리포트 유형 탭 */}
        <div className="no-print mb-4 flex gap-2 rounded-2xl bg-slate-100 p-1.5">
          {(["요약", "상세", "방문"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setReportType(t)}
              className={`flex-1 whitespace-nowrap rounded-xl px-3 py-2.5 text-base font-bold ${
                reportType === t ? "bg-white text-navy-700 shadow-sm" : "text-slate-500"
              }`}
            >
              {t === "요약" ? "월간 요약" : t === "상세" ? "상세 사후관리" : "방문용 보고서 (절세 포함)"}
            </button>
          ))}
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card">
          {/* 표지 (요약은 1페이지 출력을 위해 compact) */}
          <div className={`bg-navy-900 px-8 text-white ${reportType === "요약" ? "py-4" : "py-7"}`}>
            <p className="text-xs font-medium uppercase tracking-widest text-slate-300">
              {reportType === "방문" ? "Visit Briefing Report" : "Post-Management Monthly Report"}
            </p>
            <h2 className={`font-bold ${reportType === "요약" ? "mt-1 text-xl" : "mt-2 text-2xl"}`}>{client.name}</h2>
            <p className="mt-1 text-sm text-slate-300">
              {client.labType} · {client.labName || "—"} · {monthLabel} {reportType === "방문" ? "방문 미팅 자료" : "사후관리 결과"}
            </p>
            {!customerView && client.labRegistrationNumber && reportType !== "요약" ? (
              <p className="mt-1.5 text-sm text-slate-400">
                인정번호 {client.labRegistrationNumber}
                 (내부용)
              </p>
            ) : null}
          </div>

          {/* 목적 안내 */}
          {reportType === "상세" ? (<div className="border-b border-slate-100 bg-slate-50/70 px-8 py-5">
            <p className="text-base leading-relaxed text-slate-600">
              이번 점검은 <span className="font-semibold text-slate-800">기업부설연구소·연구개발전담부서의
              인정 유지와 세액공제 증빙 리스크를 사전에 확인</span>하기 위한 목적입니다. 연구소는 설립
              이후에도 <span className="font-semibold text-slate-800">연구노트, 연구전담요원 변동,
              연구공간 변경, 세액공제 증빙</span>을 지속적으로 관리해야 하며, 본 리포트는 이를 매월
              관리한 결과입니다.
            </p>
          </div>) : null}

          {/* 관리 요약 */}
          <div className={`grid grid-cols-2 gap-3 border-b border-slate-100 px-8 sm:grid-cols-4 ${reportType === "요약" ? "py-3" : "py-6"}`}>
            <Summary label="연구과제" value={`${noteRows.length}건`} />
            <Summary label="연구활동 확인" value={`${activityDone}/${noteRows.length}건`} />
            <Summary label="연구노트 작성" value={`${savedNotes}/${noteRows.length}건`} />
            <Summary label="변경사항" value={changes.length ? `${changes.length}건` : "없음"} />
          </div>

          {reportType === "상세" ? (
          <div className="space-y-7 px-8 py-7">
            {/* 1. 이번 달 연구활동 확인 현황 */}
            <ReportSection title="이번 달 연구활동 확인 현황">
              <ul className="space-y-2">
                {noteRows.map(({ project, note }) => (
                  <li
                    key={project.id}
                    className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/60 px-4 py-3 text-sm"
                  >
                    <span className="font-medium text-slate-800">{project.name}</span>
                    <span
                      className={
                        note && note.activities.trim()
                          ? "text-status-normal"
                          : "text-amber-600"
                      }
                    >
                      {note && note.activities.trim() ? "활동 확인" : "활동 미입력"}
                    </span>
                  </li>
                ))}
                {noteRows.length === 0 ? (
                  <p className="text-sm text-slate-400">등록된 연구과제가 없습니다.</p>
                ) : null}
              </ul>
            </ReportSection>

            {/* 2. 연구노트 작성 현황 */}
            <ReportSection title="연구노트 작성 현황">
              <ul className="space-y-2">
                {noteRows.map(({ project, note }) => (
                  <li
                    key={project.id}
                    className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3 text-sm"
                  >
                    <span className="text-slate-700">{project.name}</span>
                    <span className="font-semibold text-slate-600">
                      {note ? note.status : "작성 필요"}
                      {note?.auditReviewed ? " · 실사 보완" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </ReportSection>

            {/* 3. 변경사항 확인 결과 */}
            <ReportSection title="변경사항 확인 결과">
              {changes.length ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {changes.map((c) => (
                      <span
                        key={c}
                        className="rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                  <p className="text-sm text-slate-500">
                    변경신고 대상 여부를 검토 중이며, 기한 내 처리하여 인정 유지에 영향이 없도록
                    관리합니다.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-status-normal">이번 달 확인된 변경사항이 없습니다.</p>
              )}
            </ReportSection>

            {/* 4. 실사 대비 체크 항목 */}
            <ReportSection title="실사 대비 체크 항목">
              <ul className="space-y-1.5">
                {auditChecks.map((c) => (
                  <li key={c.label} className="flex items-center gap-2 text-sm">
                    <span className={c.ok ? "text-status-normal" : "text-slate-300"}>
                      {c.ok ? "✓" : "○"}
                    </span>
                    <span className={c.ok ? "text-slate-700" : "text-slate-400"}>{c.label}</span>
                  </li>
                ))}
              </ul>
            </ReportSection>

            {/* 5. 연구개발활동조사 / 연간 관리 안내 */}
            <ReportSection title="연구개발활동조사 · 연간 관리 안내">
              <p className="text-base leading-relaxed text-slate-600">
                매년 진행되는 연구개발활동조사는 기한 내 대응이 중요합니다. 평소 연구노트와 증빙을
                모아두면 조사·실태점검 대응이 한결 수월해집니다. 담당 컨설턴트가 연간 일정에 맞춰
                미리 안내드립니다.
              </p>
            </ReportSection>

            {/* 6. 컨설턴트 의견 */}
            <ReportSection title="컨설턴트 의견">
              <p className="text-base leading-relaxed text-slate-700">
                {consultantOpinion(noteRows, check)}
              </p>
              {a?.memo ? (
                <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-3 text-base text-slate-600">
                  <span className="font-semibold text-slate-500">현장 메모 · </span>
                  {a.memo}
                </div>
              ) : null}
              <p className="mt-3 text-sm text-slate-500">담당 컨설턴트: {client.consultant || "—"}</p>
            </ReportSection>

            {/* 7. 사후관리 미흡 시 리스크 안내 */}
            <ReportSection title="사후관리가 미흡할 경우">
              <ul className="list-inside list-disc space-y-1.5 text-base text-slate-600">
                <li>연구노트가 누락되면 세액공제의 근거가 약해질 수 있습니다.</li>
                <li>변경신고를 놓치면 연구소 인정 유지에 부담이 될 수 있습니다.</li>
                <li>증빙이 정리되지 않으면 추후 세무검증 대응이 어려워질 수 있습니다.</li>
              </ul>
              <p className="mt-2 text-sm text-slate-500">
                매월 사전 관리로 위 리스크를 미리 예방하는 것이 본 서비스의 목적입니다.
              </p>
            </ReportSection>

            {/* 8. 다음 달 조치사항 */}
            <ReportSection title="다음 달 조치사항">
              <ol className="space-y-2">
                {nextActions.map((t, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy-700 text-xs font-bold text-white">
                      {i + 1}
                    </span>
                    <span className="text-slate-700">{t}</span>
                  </li>
                ))}
              </ol>
            </ReportSection>
          </div>
          ) : null}

          {reportType === "요약" ? (
            <SummaryReport
              tax={getTaxCreditEstimate(client)}
              noteRows={noteRows}
              changes={changes}
              nextActions={nextActions}
            />
          ) : null}

          {reportType === "방문" ? (
            <VisitReport
              client={client}
              tax={getTaxCreditEstimate(client)}
              noteRows={noteRows}
              changes={changes}
              auditChecks={auditChecks}
              benefitKeys={benefitKeys}
              onToggleBenefit={toggleBenefit}
              customerView={customerView}
              opinion={consultantOpinion(noteRows, check)}
              monthLabel={monthLabel}
            />
          ) : null}

          {/* 면책 + 발행 */}
          <div className={`space-y-2 border-t border-slate-100 bg-slate-50/70 px-8 ${reportType === "요약" ? "py-3" : "py-5"}`}>
            <p className={`leading-relaxed text-slate-600 ${reportType === "요약" ? "text-sm" : "text-base"}`}>
              ※ 본 리포트는 최종 세무 판단이 아니라 <span className="font-semibold text-slate-600">사전
              점검 자료</span>이며, 세액공제 적용 여부는 세무대리인의 검토가 필요합니다. 변경신고 대상
              여부 등 구체적 처리는 담당 컨설턴트와 함께 확인하시기 바랍니다.
            </p>
            <p className="text-sm text-slate-500">
              담당 컨설턴트 {client.consultant || "—"} · 발행일{" "}
              {new Date().toISOString().slice(0, 10).replace(/-/g, ".")}
            </p>
          </div>
        </div>

        <div className={`mt-4 flex justify-center gap-4 no-print ${customerView ? "hidden" : ""}`}>
          {noteRows[0] ? (
            <Link
              href={`/notes?client=${id}&project=${noteRows[0].project.id}&month=${month}`}
              className="text-sm font-semibold text-navy-600 hover:text-navy-800"
            >
              연구노트 작성하기 →
            </Link>
          ) : null}
          <button
            onClick={() => router.push(`/clients/${id}/check`)}
            className="text-sm font-semibold text-navy-600 hover:text-navy-800"
          >
            변경사항 점검하기 →
          </button>
        </div>
      </div>
    </Layout>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={<Layout title="불러오는 중…">{null}</Layout>}>
      <ReportBody />
    </Suspense>
  );
}

function nextMonthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m, 1); // m은 0-indexed이므로 다음 달
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-0.5 text-lg font-bold text-slate-900">{value}</p>
    </div>
  );
}

function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 border-l-4 border-navy-700 pl-3 text-lg font-bold text-slate-900">
        {title}
      </h3>
      {children}
    </section>
  );
}

/* ───────────────── 월간 요약 리포트 (1~2페이지 컴팩트) ───────────────── */

function SummaryReport({
  tax,
  noteRows,
  changes,
  nextActions,
}: {
  tax: ReturnType<typeof getTaxCreditEstimate>;
  noteRows: { project: ResearchProject; note: ResearchNote | undefined }[];
  changes: string[];
  nextActions: string[];
}) {
  const savedNotes = noteRows.filter((r) => r.note?.status === "저장 완료").length;
  const notesOk = noteRows.length > 0 && savedNotes === noteRows.length;
  // A4 1페이지 출력에 맞춘 compact 레이아웃
  return (
    <div className="space-y-4 px-8 py-4">
      {/* 1. 이번 달 관리 상태 */}
      <section>
        <h3 className="mb-2 border-l-4 border-navy-700 pl-3 text-base font-bold text-slate-900">이번 달 관리 상태</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <CheckLine ok={notesOk} okText={`연구노트 작성 완료 (${savedNotes}/${noteRows.length}건)`} warnText={`연구노트 작성 필요 (${savedNotes}/${noteRows.length}건)`} />
          <CheckLine ok={changes.length === 0} okText="변경신고 대상 없음" warnText={`변경사항 ${changes.length}건 — 신고 검토 중`} />
        </div>
      </section>

      {/* 2. 예상 절세 효과 */}
      <section>
        <h3 className="mb-2 border-l-4 border-navy-700 pl-3 text-base font-bold text-slate-900">예상 절세 효과 (검토용)</h3>
        {tax.available ? (
          <>
            <div className="rounded-xl bg-navy-900 px-5 py-3.5 text-white">
              <p className="text-sm text-slate-300">요건 충족 시 연간 {tax.taxType} 절감 검토 가능액</p>
              <p className="mt-0.5 text-2xl font-bold text-amber-300">
                약 {formatKRW(tax.annual)}
                <span className="ml-3 text-sm font-medium text-slate-300">월 환산 약 {formatKRW(tax.monthly)} · 일 환산 약 {formatKRW(tax.daily)}</span>
              </p>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
              연구개발비 {formatManwon(tax.totalRnd)} × {tax.rate}% ({tax.category}) 기준. 본 금액은
              확정 공제액이 아닌 <b>사전 검토용 추정치</b>이며, 실제 적용 여부는 연구개발비 범위·인건비·
              구분경리·세법 요건·세무조정에 따라 달라질 수 있습니다 (세무 전문가 검토 필요).
            </p>
          </>
        ) : (
          <p className="rounded-xl bg-slate-50 px-4 py-2.5 text-sm text-slate-500">
            연구원 인건비·연구개발비를 입력하면 예상 절세액(검토용)이 표시됩니다. (고객사 관리에서 입력)
          </p>
        )}
      </section>

      {/* 3. 다음 달 조치사항 */}
      <section>
        <h3 className="mb-2 border-l-4 border-navy-700 pl-3 text-base font-bold text-slate-900">다음 달 조치사항</h3>
        <ol className="space-y-1.5">
          {nextActions.slice(0, 4).map((t, i) => (
            <li key={i} className="flex gap-2.5 text-sm">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy-700 text-xs font-bold text-white">
                {i + 1}
              </span>
              <span className="text-slate-700">{t}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function CheckLine({ ok, okText, warnText }: { ok: boolean; okText: string; warnText: string }) {
  return (
    <p className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold ${ok ? "bg-status-normalBg text-status-normal" : "bg-amber-50 text-amber-700"}`}>
      <span>{ok ? "✓" : "⚠"}</span>
      {ok ? okText : warnText}
    </p>
  );
}

/* ───────────────── 방문용 종합 보고서 (절세 + 추가 혜택 통합) ───────────────── */

function VisitReport({
  client, tax, noteRows, changes, auditChecks, benefitKeys, onToggleBenefit, customerView, opinion, monthLabel,
}: {
  client: Client;
  tax: ReturnType<typeof getTaxCreditEstimate>;
  noteRows: NoteRow[];
  changes: string[];
  auditChecks: { label: string; ok: boolean }[];
  benefitKeys: string[];
  onToggleBenefit: (key: string) => void;
  customerView: boolean;
  opinion: string;
  monthLabel: string;
}) {
  const savedNotes = noteRows.filter((r) => r.note?.status === "저장 완료").length;
  const notesOk = noteRows.length > 0 && savedNotes === noteRows.length;
  const selectedBenefits = benefitKeys
    .map((k) => BENEFIT_OPTIONS.find((b) => b.key === k))
    .filter((b): b is (typeof BENEFIT_OPTIONS)[number] => Boolean(b));

  // 다음 미팅 제안 포인트
  const meetingPoints: string[] = [];
  if (!notesOk) meetingPoints.push("연구노트 미완료 과제의 작성 일정과 자료 협조 방안 협의");
  if (changes.length) meetingPoints.push("확인된 변경사항의 변경신고 진행 일정 확정");
  for (const b of selectedBenefits.slice(0, 3)) meetingPoints.push(`${b.label} 적용 가능성 검토 결과 안내 및 필요 자료 협의`);
  if (!meetingPoints.length) meetingPoints.push("현재 관리 상태 양호 — 다음 분기 연구과제 방향과 추가 혜택 검토 주제 협의");
  meetingPoints.push("다음 월간 점검 일정 확정");

  // 대표님 설명용 요약 문구
  const ceoSummary = [
    `${monthLabel} 기준 ${client.name}의 연구소 관리 현황을 점검했습니다.`,
    notesOk ? "연구노트가 빠짐없이 정리되어 인정 유지와 증빙 측면에서 안정적입니다." : "연구노트 일부가 보완 중이며, 완료되도록 함께 챙기고 있습니다.",
    tax.available ? `연구개발비 기준으로 연간 약 ${formatKRW(tax.annual)}의 ${tax.taxType} 절감 가능성을 검토하고 있습니다 (사전 검토용).` : "",
    selectedBenefits.length ? `이와 함께 ${selectedBenefits.map((b) => b.label).slice(0, 3).join(", ")} 등 추가 혜택의 검토 가능성을 안내드립니다.` : "",
  ].filter(Boolean).join(" ");

  return (
    <div className="space-y-6 px-8 py-6">
      {/* 1. 한눈에 보는 이번 달 요약 */}
      <ReportSection title="한눈에 보는 이번 달 요약">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <CheckLine ok={notesOk} okText={`연구노트 작성 완료 (${savedNotes}/${noteRows.length}건)`} warnText={`연구노트 작성 필요 (${savedNotes}/${noteRows.length}건)`} />
          <CheckLine ok={changes.length === 0} okText="변경신고 대상 없음" warnText={`변경사항 ${changes.length}건 — 신고 검토 중`} />
        </div>
        {tax.available ? (
          <div className="mt-2 rounded-xl bg-navy-900 px-5 py-3.5 text-white">
            <p className="text-sm text-slate-300">요건 충족 시 연간 {tax.taxType} 절감 검토 가능액</p>
            <p className="mt-0.5 text-2xl font-bold text-amber-300">약 {formatKRW(tax.annual)} <span className="ml-2 text-sm font-medium text-slate-300">({tax.category} {tax.rate}% 기준 · 사전 검토용)</span></p>
          </div>
        ) : null}
      </ReportSection>

      {/* 2. 사후관리 핵심 점검 */}
      <ReportSection title="사후관리 핵심 점검">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-100 p-3.5">
            <p className="text-sm font-bold text-slate-600">변경사항</p>
            {changes.length ? (
              <ul className="mt-1 space-y-0.5 text-sm text-amber-700">{changes.map((c) => <li key={c}>⚠ {c}</li>)}</ul>
            ) : (
              <p className="mt-1 text-sm text-status-normal">이번 달 확인된 변경사항 없음</p>
            )}
          </div>
          <div className="rounded-xl border border-slate-100 p-3.5">
            <p className="text-sm font-bold text-slate-600">실사 대비 체크</p>
            <ul className="mt-1 space-y-0.5">
              {auditChecks.map((c) => (
                <li key={c.label} className="flex items-center gap-1.5 text-sm">
                  <span className={c.ok ? "text-status-normal" : "text-slate-300"}>{c.ok ? "✓" : "○"}</span>
                  <span className={c.ok ? "text-slate-700" : "text-slate-400"}>{c.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </ReportSection>

      {/* 3. 연구개발비 세액공제 예상 (상세) */}
      <ReportSection title={`연구개발비 세액공제 예상 (${tax.taxType} · 검토용)`}>
        {tax.available ? (
          <>
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-base">
                <tbody>
                  <Tr label="연구전담요원 연간 인건비" value={formatKRW(tax.payroll)} />
                  <Tr label="연구 재료비/부품비" value={formatKRW(tax.material)} />
                  <Tr label="기타 연구개발비" value={formatKRW(tax.other)} />
                  <Tr label="연구개발비 총액" value={formatKRW(tax.totalRnd)} bold />
                  <Tr label={`적용 공제율 (${tax.category})`} value={`${tax.rate}%`} bold />
                  <Tr label="예상 절세액(연간, 검토용)" value={`약 ${formatKRW(tax.annual)}`} bold />
                </tbody>
              </table>
            </div>
            <div className="mt-3 rounded-xl bg-slate-50 px-4 py-3">
              <p className="text-sm font-bold text-slate-600">적용 가정</p>
              <ul className="mt-1 space-y-0.5 text-sm leading-relaxed text-slate-500">
                {tax.assumptions.map((a, i) => <li key={i}>· {a}</li>)}
              </ul>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              ※ 본 금액은 확정 공제액이 아닌 <b>사전 검토용 추정치</b>이며, 실제 적용 여부는 연구개발비 범위·인건비·구분경리·세법 요건·세무조정에 따라 달라질 수 있습니다 (세무 전문가 검토 필요).
            </p>
          </>
        ) : (
          <p className="rounded-xl bg-slate-50 px-4 py-3 text-base text-slate-500">
            연구원 인건비·연구개발비를 입력하면 예상 절세액(검토용)이 표시됩니다. (고객사 관리에서 입력)
          </p>
        )}
      </ReportSection>

      {/* 추가 혜택 후보 선택 (컨설턴트 편집용 — 고객 공유/출력 시 숨김) */}
      {!customerView ? (
        <section className="no-print rounded-xl border-2 border-dashed border-violet-200 bg-violet-50/40 p-4">
          <h3 className="text-base font-bold text-violet-800">
            추가 혜택 후보 선택
            <span className="ml-1 text-sm font-medium text-violet-600/70">(컨설턴트 편집용 — 출력물·고객 화면에는 선택된 항목만 표시)</span>
          </h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {BENEFIT_OPTIONS.map((b) => {
              const on = benefitKeys.includes(b.key);
              return (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => onToggleBenefit(b.key)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${
                    on ? "border-violet-500 bg-violet-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {on ? "✓ " : "+ "}{b.label}
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* 4. 추가 혜택 검토 가능성 (선택된 항목 — 출력/고객 화면 포함) */}
      <ReportSection title="추가 혜택 검토 가능성">
        {selectedBenefits.length ? (
          <ul className="space-y-2 text-base leading-relaxed text-slate-700">
            {selectedBenefits.map((b) => (
              <li key={b.key} className="flex gap-2"><span>💎</span><span><b>{b.label}</b> — {b.sentence}</span></li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl bg-slate-50 px-4 py-3 text-base text-slate-500">
            {customerView
              ? "추가 혜택 검토는 담당 컨설턴트와의 상담을 통해 진행할 수 있습니다."
              : "위 ‘추가 혜택 후보 선택’에서 항목을 고르면 여기에 검토 가능성 문장이 표시되고, 출력물에도 포함됩니다."}
          </p>
        )}
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">
          ※ 위 항목은 확정 혜택이 아닌 검토 가능성 안내이며, 적용 여부는 개별 요건 확인과 세무전문가 검토가 필요합니다.
        </p>
      </ReportSection>

      {/* 4. 다음 미팅 제안 포인트 */}
      <ReportSection title="다음 미팅 제안 포인트">
        <ol className="space-y-2">
          {meetingPoints.map((t, i) => (
            <li key={i} className="flex gap-2.5 text-base">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy-700 text-xs font-bold text-white">{i + 1}</span>
              <span className="text-slate-700">{t}</span>
            </li>
          ))}
        </ol>
      </ReportSection>

      {/* 5. 대표님 설명용 요약 문구 */}
      <ReportSection title="대표님 설명용 요약">
        <div className="rounded-xl border-l-4 border-navy-700 bg-slate-50 px-4 py-3.5">
          <p className="text-base leading-relaxed text-slate-700">“{ceoSummary}”</p>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">{opinion}</p>
      </ReportSection>
    </div>
  );
}

function Tr({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className={`bg-slate-50/60 px-4 py-2.5 ${bold ? "font-bold text-slate-800" : "text-slate-600"}`}>{label}</td>
      <td className={`px-4 py-2.5 text-right ${bold ? "font-bold text-navy-700" : "text-slate-800"}`}>{value}</td>
    </tr>
  );
}
