

import { useSyncExternalStore } from "react";
import Link from "../next";
import type { Customer } from "../../types";
import {
  getServerCustomers,
  getStoredCustomers,
  subscribeCustomers,
} from "../storage";
import { buildReportModel } from "../../report";

const noopSubscribe = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <section className="mx-auto w-full max-w-3xl px-6 py-8">{children}</section>
  );
}

function ReportDocument({ customer }: { customer: Customer }) {
  const r = buildReportModel(customer);

  return (
    <Wrap>
      {/* 액션 버튼 (인쇄 시 숨김) */}
      <div className="no-print mb-6 flex items-center justify-between gap-3">
        <Link
          href={`/customers/${customer.id}`}
          className="text-sm font-medium text-slate-500 transition-colors hover:text-blue-700"
        >
          ← 고객 상세로 돌아가기
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
        >
          🖨️ 인쇄 / PDF 저장
        </button>
      </div>

      {/* 리포트 본문 */}
      <div data-testid="pf-report" className="report-card overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        {/* 헤더 */}
        <div className="report-section border-b border-slate-100 px-8 py-8">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
              PF
            </span>
            <span className="text-sm font-semibold text-slate-500">
              Policy Funding OS · 정책자금 상담 리포트
            </span>
          </div>

          <div className="mt-6 flex flex-col justify-between gap-6 @min-[640px]:flex-row @min-[640px]:items-end">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                {r.companyName}
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                {r.industry} · {r.businessType} · 진단일 {r.diagnosisDate}
              </p>
              <p className="mt-3 text-sm text-slate-600">
                추천 1순위 기관 ·{" "}
                <span className="font-semibold text-blue-700">
                  {r.topAgency}
                </span>
              </p>
            </div>
            <div className="shrink-0 rounded-2xl bg-blue-50 px-6 py-4 text-center">
              <p className="text-xs font-semibold text-blue-700">
                종합 가능성 점수
              </p>
              <p className="text-4xl font-bold text-blue-700">
                {r.score}
                <span className="text-base text-blue-400"> / 100</span>
              </p>
            </div>
          </div>
        </div>

        {/* 대표님 한 페이지 요약 (30초 이해용) */}
        <div className="report-section border-b border-slate-100 bg-blue-50/40 px-8 py-7">
          <p className="text-sm font-bold text-blue-700">대표님 요약</p>
          <div className="mt-4 grid grid-cols-2 gap-4 @min-[640px]:grid-cols-5">
            <div>
              <p className="text-xs font-semibold text-slate-500">추천기관</p>
              <p className="mt-1 text-sm font-bold text-slate-900">{r.topAgency}</p>
              <p className="text-amber-400" aria-label={`${r.stars}점`}>
                {"★".repeat(r.stars)}
                <span className="text-slate-300">{"★".repeat(5 - r.stars)}</span>
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">가능성</p>
              <p
                className={`mt-1 text-2xl font-bold ${
                  r.likelihood === "높음"
                    ? "text-green-600"
                    : r.likelihood === "보통"
                      ? "text-amber-600"
                      : "text-slate-500"
                }`}
              >
                {r.likelihood}
              </p>
              <p className="text-xs text-slate-400">내부 점수 {r.score}점</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">예상 진행기간</p>
              <p className="mt-1 text-lg font-bold text-slate-900">
                {r.estimatedPeriod}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">핵심 리스크</p>
              <p className="mt-1 text-sm font-bold text-amber-700">
                {r.riskKeyword}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">필수 준비</p>
              <p className="mt-1 text-sm font-bold text-slate-900">{r.keyPrep}</p>
            </div>
          </div>
        </div>

        <div className="space-y-8 px-8 py-8">
          {/* 섹션 1. 종합 진단 요약 */}
          <section className="report-section">
            <h2 className="text-lg font-bold text-slate-900">
              1. 종합 진단 요약
            </h2>
            <div className="mt-4 grid gap-3 @min-[640px]:grid-cols-3">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold text-slate-500">핵심 전략</p>
                <p className="mt-1.5 text-sm leading-6 text-slate-800">
                  {r.coreStrategy}
                </p>
              </div>
              <div className="rounded-2xl bg-amber-50 p-4">
                <p className="text-xs font-semibold text-amber-700">
                  가장 큰 리스크
                </p>
                <p className="mt-1.5 text-sm leading-6 text-amber-900">
                  {r.biggestRisk}
                </p>
              </div>
              <div className="rounded-2xl bg-blue-50 p-4">
                <p className="text-xs font-semibold text-blue-700">
                  오늘의 다음 액션
                </p>
                <p className="mt-1.5 text-sm leading-6 text-blue-900">
                  {r.nextAction}
                </p>
              </div>
            </div>
          </section>

          {/* 섹션 1-1. 인콜 체크 요약 (진단 입력이 있는 고객만) */}
          {r.incall && (
            <section className="report-section">
              <h2 className="text-lg font-bold text-slate-900">
                1-1. 인콜 체크 요약
              </h2>
              <div className="mt-4 grid gap-3 @min-[640px]:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-500">
                    대표자 동종업계 경력
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-800">
                    {r.incall.ceoCareer}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-500">
                    매출 체급
                  </p>
                  <p className="mt-1 text-sm font-bold text-slate-800">
                    {r.incall.revenueTier}
                  </p>
                </div>
              </div>
              <div className="mt-3 rounded-2xl bg-amber-50 p-4">
                <p className="text-xs font-semibold text-amber-700">
                  신용 · 체납 · 기대출 리스크
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {r.incall.creditRisk.map((c) => (
                    <span
                      key={c}
                      className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-amber-900 ring-1 ring-amber-200"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
              {r.incall.bonusItems.length > 0 && (
                <div className="mt-3 rounded-2xl bg-blue-50/60 p-4">
                  <p className="text-xs font-semibold text-blue-700">
                    가점 요소 (면담 시 증빙 지참)
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {r.incall.bonusItems.map((b) => (
                      <span
                        key={b}
                        className="rounded-full bg-white px-2.5 py-0.5 text-xs font-medium text-blue-800 ring-1 ring-blue-200"
                      >
                        {b}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {r.incall.deprioritized.length > 0 && (
                <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs font-semibold text-slate-500">
                    후순위 기관과 사유
                  </p>
                  <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-600">
                    {r.incall.deprioritized.map((d) => (
                      <li key={d.name}>
                        <span className="font-semibold">{d.name}</span> —{" "}
                        {d.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {/* 섹션 2. 추천 기관 TOP 3 */}
          <section className="report-section">
            <h2 className="text-lg font-bold text-slate-900">
              2. 추천 기관 TOP 3
            </h2>
            <div className="mt-4 space-y-3">
              {r.agencies.map((a) => (
                <div
                  key={a.name}
                  className="rounded-2xl border border-slate-100 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                        {a.rank}
                      </span>
                      <span className="font-bold text-slate-900">{a.name}</span>
                    </div>
                    {a.score !== null && (
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
                        적합도 {a.score}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 grid gap-3 @min-[640px]:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold text-slate-500">
                        추천 이유
                      </p>
                      <ul className="mt-1 space-y-1 text-sm text-slate-700">
                        {a.reasons.map((x) => (
                          <li key={x} className="flex gap-1.5">
                            <span className="text-blue-500">•</span>
                            {x}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500">
                        주의할 점
                      </p>
                      <ul className="mt-1 space-y-1 text-sm text-slate-700">
                        {a.cautions.map((x) => (
                          <li key={x} className="flex gap-1.5">
                            <span className="text-amber-500">!</span>
                            {x}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 섹션 2-1. 세부 자금 트랙 후보 (11차) */}
          {r.specialTracks.length > 0 && (
            <section className="report-section">
              <h2 className="text-lg font-bold text-slate-900">
                2-1. 세부 자금 트랙 후보
              </h2>
              <div className="mt-4 space-y-3">
                {r.specialTracks.map((t) => (
                  <div
                    key={t.key}
                    className="rounded-2xl border border-slate-100 p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-900">{t.name}</span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          t.level === "높음"
                            ? "bg-green-50 text-green-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        가능성 {t.level}
                      </span>
                    </div>
                    {t.reasons.length > 0 && (
                      <p className="mt-2 text-sm text-slate-600">
                        근거 · {t.reasons.join(" · ")}
                      </p>
                    )}
                    {t.cautions.length > 0 && (
                      <p className="mt-1 text-xs text-amber-700">
                        ⚠ {t.cautions.join(" / ")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 섹션 3. 준비해야 할 서류 */}
          <section className="report-section">
            <h2 className="text-lg font-bold text-slate-900">
              3. 준비해야 할 서류
            </h2>
            <ul className="mt-4 grid gap-2 @min-[640px]:grid-cols-2" data-testid="pf-report-docs">
              {r.documents.map((d) => (
                <li
                  key={d}
                  className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                >
                  <span className="flex h-4 w-4 items-center justify-center rounded border border-blue-300 text-[10px] text-blue-500">
                    ☐
                  </span>
                  {d}
                </li>
              ))}
            </ul>
          </section>

          {/* 섹션 4. 진행 로드맵 */}
          <section className="report-section">
            <h2 className="text-lg font-bold text-slate-900">4. 진행 로드맵</h2>
            <ol className="mt-4 space-y-0">
              {r.roadmap.map((step, idx) => (
                <li key={step} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                      {idx + 1}
                    </span>
                    {idx < r.roadmap.length - 1 && (
                      <span className="my-1 w-px flex-1 bg-blue-200" />
                    )}
                  </div>
                  <div className="pt-1 pb-5">
                    <p className="text-sm font-semibold text-slate-800">
                      {step}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* 섹션 5. 추가로 검토할 수 있는 지원제도 */}
          <section className="report-section">
            <h2 className="text-lg font-bold text-slate-900">
              5. 추가로 검토할 수 있는 지원제도
            </h2>
            <div className="mt-4 grid gap-3 @min-[640px]:grid-cols-2">
              {r.supportPrograms.map((s) => (
                <div
                  key={s.title}
                  className={`rounded-2xl border p-4 ${
                    s.recommended
                      ? "border-blue-200 bg-blue-50/50"
                      : "border-slate-100 bg-white"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-slate-900">
                      {s.title}
                    </p>
                    {s.recommended && (
                      <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                        추천
                      </span>
                    )}
                  </div>
                  <p className="mt-1.5 text-sm leading-6 text-slate-600">
                    {s.desc}
                  </p>
                </div>
              ))}
            </div>
            {r.extraUpsells.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {r.extraUpsells.map((u) => (
                  <span
                    key={u}
                    className="rounded-full border border-blue-100 bg-blue-50/60 px-3 py-1.5 text-sm font-medium text-blue-800"
                  >
                    {u}
                  </span>
                ))}
              </div>
            )}
          </section>

          {/* 섹션 6. 사업계획 초안 (AI 자동 생성 — 진단 고객만) */}
          {r.planDraft && (
            <section className="report-section">
              <h2 className="text-lg font-bold text-slate-900">
                6. 사업계획 초안{" "}
                <span className="text-sm font-medium text-slate-400">
                  (규칙 자동 생성 · {r.planDraft.agency} 기준)
                </span>
              </h2>
              <p className="mt-2 rounded-xl bg-blue-50/60 px-4 py-3 text-xs leading-5 text-blue-800">
                💡 {r.planDraft.emphasis}
              </p>
              <div className="mt-4 space-y-4">
                {r.planDraft.sections.map((s) => (
                  <div key={s.no}>
                    <p className="text-sm font-bold text-slate-800">
                      {s.no}. {s.title}
                    </p>
                    <p className="mt-1 text-sm leading-7 text-slate-600">
                      {s.text}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-slate-400">
                ※ XX 표시는 대표님과 함께 채울 숫자입니다. 초안을 바탕으로 근거
                자료를 붙여 완성하세요.
              </p>
            </section>
          )}

          {/* 섹션 6-1. 사업계획 전략 (12차 — 진단 고객만) */}
          {r.planStrategy && (
            <section className="report-section">
              <h2 className="text-lg font-bold text-slate-900">
                6-1. 사업계획 전략{" "}
                <span className="text-sm font-medium text-slate-400">
                  ({r.planStrategy.agency} 기준)
                </span>
              </h2>

              {/* 6-1-1. 핵심 전략 */}
              <div className="mt-4">
                <p className="text-sm font-bold text-slate-800">핵심 전략</p>
                <p className="mt-1 text-sm text-slate-600">
                  {r.planStrategy.flow.join(" → ")}
                </p>
                <p className="mt-1.5 text-sm leading-6 text-slate-600">
                  {r.planStrategy.summary}
                </p>
                <p className="mt-2 rounded-lg bg-green-50 px-3 py-2 text-sm leading-6 text-green-900">
                  왜 승인될 것 같은가 · {r.planStrategy.winReason}
                </p>
              </div>

              {/* 6-1-2. 심사관이 좋아할 포인트 */}
              {r.reviewFocus && (
                <div className="mt-5">
                  <p className="text-sm font-bold text-slate-800">
                    심사관이 좋아할 포인트
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {r.reviewFocus.focus.map((f) => (
                      <li
                        key={f.label}
                        className="flex items-center justify-between gap-2 text-sm text-slate-700"
                      >
                        <span>{f.label}</span>
                        <span className="text-amber-500">
                          {"★".repeat(f.stars)}
                          <span className="text-slate-300">
                            {"★".repeat(5 - f.stars)}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 6-1-3. 반드시 강조할 내용 (논리 흐름) */}
              {r.planLogic.length > 0 && (
                <div className="mt-5">
                  <p className="text-sm font-bold text-slate-800">
                    반드시 강조할 내용 (논리 흐름)
                  </p>
                  <ol className="mt-2 space-y-1 text-sm text-slate-700">
                    {r.planLogic.map((s) => (
                      <li key={s.key}>
                        {s.no}. {s.title}
                        {s.emphasized && (
                          <span className="ml-1 text-amber-500">★</span>
                        )}{" "}
                        — {s.question}
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* 6-1-4. 반드시 준비할 자료 */}
              {r.documentPriority.length > 0 && (
                <div className="mt-5">
                  <p className="text-sm font-bold text-slate-800">
                    반드시 준비할 자료
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-slate-700">
                    {r.documentPriority.map((d) => (
                      <li key={d.label}>
                        <span className="text-amber-500">
                          {"★".repeat(d.tier)}
                        </span>{" "}
                        {d.label} — {d.why}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 6-1-5. 성장 논리 */}
              {r.growthLogic && (
                <div className="mt-5">
                  <p className="text-sm font-bold text-slate-800">성장 논리</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {r.growthLogic.chain.join(" → ")}
                  </p>
                  <p className="mt-1.5 text-sm leading-6 text-slate-600">
                    {r.growthLogic.logic}
                  </p>
                </div>
              )}

              {/* 6-1-6. 추천 스토리 */}
              {r.storyPack && (
                <div className="mt-5">
                  <p className="text-sm font-bold text-slate-800">추천 스토리</p>
                  <div className="mt-2 space-y-3">
                    {r.storyPack.versions.map((v) => (
                      <div key={v.key}>
                        <p className="text-sm font-semibold text-slate-700">
                          [{v.label}] {v.tone}
                        </p>
                        <p className="mt-0.5 text-sm leading-7 text-slate-600">
                          {v.story}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 6-1-7. 왜 이 기관인가 */}
              {r.agencyComparison.length > 0 && (
                <div className="mt-5">
                  <p className="text-sm font-bold text-slate-800">
                    왜 다른 기관이 아니라 이 기관인가
                  </p>
                  <ul className="mt-2 space-y-1 text-sm leading-6 text-slate-600">
                    {r.agencyComparison.map((c, i) => (
                      <li key={i}>• {c}</li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="mt-4 text-xs text-slate-400">
                ※ XX 표시는 대표님과 함께 채울 숫자입니다.
              </p>
            </section>
          )}

          {/* 섹션 7. 안내 문구 */}
          <section className="report-section border-t border-slate-100 pt-6">
            <p className="text-xs leading-6 text-slate-500">
              ※ {r.disclaimer}
            </p>
          </section>
        </div>
      </div>
    </Wrap>
  );
}

export default function ReportView({
  id,
  initialCustomer,
}: {
  id: string;
  initialCustomer: Customer | null;
}) {
  const isHydrated = useSyncExternalStore(
    noopSubscribe,
    clientSnapshot,
    serverSnapshot,
  );
  const stored = useSyncExternalStore(
    subscribeCustomers,
    getStoredCustomers,
    getServerCustomers,
  );

  if (!isHydrated) {
    return (
      <Wrap>
        <div className="rounded-3xl border border-slate-100 bg-white p-10 text-center text-slate-400 shadow-sm">
          리포트를 준비하는 중…
        </div>
      </Wrap>
    );
  }

  const customer = stored.find((c) => c.id === id) ?? initialCustomer;

  if (!customer) {
    return (
      <Wrap>
        <div className="rounded-3xl border border-slate-100 bg-white p-10 text-center shadow-sm">
          <p className="text-lg font-semibold text-slate-800">
            고객을 찾을 수 없습니다.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-block rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            고객 관리로 돌아가기
          </Link>
        </div>
      </Wrap>
    );
  }

  return <ReportDocument customer={customer} />;
}
