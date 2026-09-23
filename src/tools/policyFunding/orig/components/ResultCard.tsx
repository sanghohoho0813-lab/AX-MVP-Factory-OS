

import { useState } from "react";
import type { DiagnosisInput, DiagnosisResult } from "../../types";
import { likelihoodOf } from "../../types";
import {
  aiReasoning,
  buildCoachChat,
  oneLineConclusion,
  progressStars,
  todayTasks,
} from "../../coach";
import ChatBubble from "./ChatBubble";
import PlanChecklistCard from "./PlanChecklistCard";

// 심사 포인트 별점 (1~5)
function FocusStars({ n }: { n: number }) {
  return (
    <span className="shrink-0 text-sm tracking-tight" aria-label={`${n}점`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={i < n ? "text-amber-400" : "text-slate-200"}>
          ★
        </span>
      ))}
    </span>
  );
}

// 전략/논리 흐름을 화살표 사슬로 표시
function FlowChain({ steps }: { steps: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {steps.map((s, i) => (
        <span key={`${s}-${i}`} className="flex items-center gap-1.5">
          <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">
            {s}
          </span>
          {i < steps.length - 1 && <span className="text-slate-300">→</span>}
        </span>
      ))}
    </div>
  );
}

// 3단계 가능성 배지 (퍼센트 대신)
function LikelihoodBadge({ score }: { score: number }) {
  const level = likelihoodOf(score);
  const cls =
    level === "높음"
      ? "bg-green-50 text-green-700 ring-green-200"
      : level === "보통"
        ? "bg-amber-50 text-amber-700 ring-amber-200"
        : "bg-slate-100 text-slate-500 ring-slate-200";
  return (
    <span className={`rounded-full px-3 py-1 text-sm font-bold ring-1 ${cls}`}>
      가능성 {level}
    </span>
  );
}

function Card({
  title,
  emoji,
  children,
}: {
  title: string;
  emoji: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
      <h3 className="flex items-center gap-2 text-lg font-bold">
        <span className="text-xl">{emoji}</span>
        {title}
      </h3>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function SectionLabel({ step, title }: { step: string; title: string }) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-bold text-white">
        {step}
      </span>
      <h2 className="text-base font-bold text-slate-700">{title}</h2>
    </div>
  );
}

function Stars({ score }: { score: number }) {
  const n = progressStars(score);
  return (
    <span className="text-xl tracking-tight" aria-label={`${n}점 만점 별점`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} className={i < n ? "text-amber-400" : "text-slate-200"}>
          ★
        </span>
      ))}
    </span>
  );
}

function CopyBlock({ label, text }: { label: string; text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-slate-700">{label}</span>
        <button
          type="button"
          onClick={copy}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
            copied ? "bg-green-600 text-white" : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          {copied ? "복사됨 ✓" : "복사"}
        </button>
      </div>
      <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-sm leading-6 text-slate-600">
        {text}
      </pre>
    </div>
  );
}

const rankBadge = ["bg-blue-600", "bg-blue-400", "bg-slate-400"];

export default function ResultCard({
  input,
  result,
}: {
  input: DiagnosisInput;
  result: DiagnosisResult;
}) {
  const conclusion = oneLineConclusion(result);
  const tasks = todayTasks(input, result);
  const reasoning = aiReasoning(input, result);
  const chat = buildCoachChat(result);

  return (
    <div className="space-y-6">
      {/* ── ① 지금 당장 해야 하는 것 ───────────────────────── */}
      {/* 코치의 한 줄 결론 */}
      <div className="rounded-3xl bg-gradient-to-br from-blue-600 to-blue-700 p-6 text-white shadow-sm @min-[640px]:p-8">
        <div className="flex items-center gap-2 text-sm font-medium text-blue-100">
          <span className="text-lg">🧭</span> 코치의 한 줄 결론
        </div>
        <p className="mt-3 text-2xl font-bold leading-snug @min-[640px]:text-3xl" data-testid="pf-conclusion">
          “{conclusion}”
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-white/15 px-3 py-1.5">
            <Stars score={result.overallScore} />
          </span>
          <span className="text-lg font-bold">
            진행 가능성 {result.likelihoodLevel ?? likelihoodOf(result.overallScore)}
          </span>
          <span className="rounded-full bg-white/15 px-3 py-1 text-sm font-medium">
            1순위 · {result.topAgency}
          </span>
        </div>

        <div className="mt-6 rounded-2xl bg-white/10 p-5">
          <p className="text-sm font-semibold text-blue-50">✅ 오늘 해야 할 일</p>
          <ol className="mt-3 space-y-2">
            {tasks.map((t, i) => (
              <li key={t} className="flex gap-2.5 text-sm @min-[640px]:text-base">
                <span className="font-bold text-blue-200">{i + 1}</span>
                <span className="font-medium">{t}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* 김팀장 AI 한마디 (10차) */}
      {result.coachMessage && (
        <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-600 text-lg">
            🧭
          </span>
          <div>
            <p className="text-xs font-bold text-blue-700">김팀장 한마디</p>
            <p className="mt-1 text-sm leading-6 text-slate-800">
              {result.coachMessage}
            </p>
          </div>
        </div>
      )}

      {/* ── ② 추천 기관 & 세부 자금 트랙 ───────────────────────── */}
      <SectionLabel step="②" title="추천 기관 & 세부 자금 트랙" />

      {/* 추천 기관 TOP 3 (GOOD / BAD) */}
      <Card title="추천 기관 TOP 3" emoji="🏦">
        <div className="space-y-4" data-testid="pf-agencies">
          {result.agencies.map((a, idx) => (
            <div key={a.name} data-agency-rank={a.rank} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white ${
                      rankBadge[idx] ?? "bg-slate-400"
                    }`}
                  >
                    {a.rank}
                  </span>
                  <span className="font-bold">{a.name}</span>
                  {a.exceptionalReview && (
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-700">
                      예외 검토
                    </span>
                  )}
                </div>
                <LikelihoodBadge score={a.score} />
              </div>
              {a.exceptionalReview && a.exceptionalNote && (
                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                  {a.exceptionalNote}
                </p>
              )}
              <div className="mt-3 grid gap-3 @min-[640px]:grid-cols-2">
                <div className="rounded-lg border border-green-100 bg-green-50/50 p-3">
                  <p className="text-xs font-bold text-green-700">👍 좋은 이유</p>
                  <ul className="mt-1.5 space-y-1 text-sm text-slate-700">
                    {a.reasons.map((r) => (
                      <li key={r} className="flex gap-1.5">
                        <span className="text-green-500">+</span>
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg border border-amber-100 bg-amber-50/50 p-3">
                  <p className="text-xs font-bold text-amber-700">⚠ 주의</p>
                  <ul className="mt-1.5 space-y-1 text-sm text-slate-700">
                    {a.cautions.map((c) => (
                      <li key={c} className="flex gap-1.5">
                        <span className="text-amber-500">!</span>
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 후순위/제외 기관 사유 */}
        {result.deprioritized && result.deprioritized.length > 0 && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-bold text-slate-500">
              🚫 이번 추천에서 후순위로 밀린 기관과 그 이유
            </p>
            <ul className="mt-2 space-y-1.5 text-sm text-slate-600">
              {result.deprioritized.map((d) => (
                <li key={d.name} className="flex gap-1.5">
                  <span className="shrink-0 font-semibold text-slate-500">
                    {d.name}
                  </span>
                  <span className="text-slate-400">—</span>
                  <span>{d.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {/* 세부 자금 트랙 후보 (11차) */}
      {result.specialTracks && result.specialTracks.length > 0 && (
        <Card title="세부 자금 트랙 후보" emoji="🎯">
          <p className="-mt-2 mb-4 text-sm text-slate-500">
            일반 자금보다 한도·금리가 유리할 수 있는 우대 트랙이에요.
          </p>
          <div className="space-y-3">
            {result.specialTracks.map((t) => (
              <div
                key={t.key}
                className="rounded-xl border border-slate-100 bg-slate-50 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-slate-800">{t.name}</span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${
                      t.level === "높음"
                        ? "bg-green-50 text-green-700 ring-green-200"
                        : "bg-amber-50 text-amber-700 ring-amber-200"
                    }`}
                  >
                    가능성 {t.level}
                  </span>
                </div>
                {t.reasons.length > 0 && (
                  <p className="mt-2 text-sm text-slate-600">
                    <span className="font-semibold text-slate-500">근거</span> ·{" "}
                    {t.reasons.join(" · ")}
                  </p>
                )}
                {t.cautions.length > 0 && (
                  <p className="mt-1 text-xs text-amber-700">
                    ⚠ {t.cautions.join(" / ")}
                  </p>
                )}
                <p className="mt-2 rounded-lg bg-white px-3 py-2 text-xs leading-5 text-slate-600 ring-1 ring-slate-100">
                  💬 {t.consultingScript}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── ③ 왜 이렇게 판단했는지 ───────────────────────── */}
      <SectionLabel step="③" title="왜 이렇게 판단했을까요" />

      <div className="grid gap-3 @min-[640px]:grid-cols-2">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold text-blue-700">핵심 전략</p>
          <p className="mt-1.5 text-sm font-medium leading-6 text-slate-800">
            {result.summary.coreStrategy}
          </p>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-5">
          <p className="text-xs font-semibold text-amber-700">가장 큰 리스크</p>
          <p className="mt-1.5 text-sm font-medium leading-6 text-amber-900">
            {result.summary.biggestRisk}
          </p>
        </div>
      </div>

      {/* AI 판단 근거 */}
      <Card title="판단 근거" emoji="🧠">
        <p className="text-sm text-slate-500">이 신호들을 종합해 판단했어요.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {reasoning.signals.map((s) => (
            <span
              key={s}
              className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700"
            >
              <span className="text-green-500">✓</span>
              {s}
            </span>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2">
          <span className="text-slate-300">↓</span>
          <span className="rounded-lg bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-800">
            {reasoning.conclusion}
          </span>
        </div>
      </Card>

      {/* 김팀장 실전 코치 인사이트 */}
      <Card title="김팀장 실전 코치 인사이트" emoji="🧭">
        <div className="grid gap-4 @min-[640px]:grid-cols-2">
          <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
            <p className="text-sm font-bold text-blue-900">✅ 가장 먼저 확인할 것</p>
            <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
              {result.coachInsight.firstChecks.map((t) => (
                <li key={t} className="flex gap-1.5">
                  <span className="text-blue-500">•</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-4">
            <p className="text-sm font-bold text-amber-900">⚠️ 리스크</p>
            <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
              {result.coachInsight.risks.map((t) => (
                <li key={t} className="flex gap-1.5">
                  <span className="text-amber-500">•</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-green-100 bg-green-50/50 p-4">
            <p className="text-sm font-bold text-green-900">🎯 상담 전략</p>
            <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
              {result.coachInsight.strategies.map((t) => (
                <li key={t} className="flex gap-1.5">
                  <span className="text-green-500">•</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-red-100 bg-red-50/50 p-4">
            <p className="text-sm font-bold text-red-900">🚫 절대 약속하면 안 되는 것</p>
            <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
              {result.coachInsight.neverPromise.map((t) => (
                <li key={t} className="flex gap-1.5">
                  <span className="text-red-500">•</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      {/* ── ④ 세부 내용 ───────────────────────── */}
      <SectionLabel step="④" title="세부 내용" />

      {/* AI 상담 코치 (채팅형) */}
      <Card title="상담 코치" emoji="🎯">
        <p className="text-sm text-slate-500">
          실제 상담처럼, 상황별로 이렇게 말해보세요.
        </p>
        <div className="mt-4 space-y-2.5">
          {chat.map((item, i) => (
            <ChatBubble key={i} item={item} />
          ))}
        </div>
      </Card>

      {/* 서류 요청 체크리스트 */}
      <Card title="서류 요청 체크리스트" emoji="📄">
        <ul className="grid gap-2 @min-[640px]:grid-cols-2">
          {result.documents.map((d) => (
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
      </Card>

      {/* 유사 사례 */}
      <Card title="유사 사례 (자동 매칭)" emoji="📚">
        <p className="-mt-2 mb-4 text-sm text-slate-500">
          입력하신 고객 정보와 가장 가까운 실제 승인 사례예요.
        </p>
        <div className="grid gap-4 @min-[640px]:grid-cols-3">
          {result.cases.map((c) => (
            <div
              key={c.title}
              className="flex flex-col rounded-xl border border-slate-100 bg-slate-50 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-bold text-slate-800">{c.title}</p>
                {typeof c.matchRate === "number" && (
                  <span className="shrink-0 rounded-full bg-blue-600 px-2 py-0.5 text-[11px] font-bold text-white">
                    {c.matchRate}%
                  </span>
                )}
              </div>
              <div className="mt-2 space-y-0.5 text-xs text-slate-500">
                <p>{c.industry}</p>
                <p>
                  {c.years} · {c.revenue}
                </p>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                  {c.agency}
                </span>
                <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                  {c.approved}
                </span>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-600">{c.note}</p>
              {c.lesson && (
                <p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs leading-5 text-slate-700 ring-1 ring-slate-100">
                  💡 {c.lesson}
                </p>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* 업셀링 추천 */}
      <Card title="업셀링 추천" emoji="📈">
        <div className="grid gap-3 @min-[640px]:grid-cols-2">
          {result.upsells.map((u) => (
            <div key={u.title} className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
              <p className="text-sm font-bold text-blue-900">{u.title}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">{u.desc}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* ── ④ 사업계획 & 심사 대비 (10차) ───────────────────────── */}
      {(result.planScore || result.reviewSim) && (
        <SectionLabel step="⑤" title="사업계획 & 심사 대비" />
      )}

      {/* 사업계획 완성도 */}
      {result.planScore && (
        <Card title="사업계획 완성도" emoji="📝">
          <div className="flex items-end gap-3">
            <span
              className={`text-4xl font-bold ${
                result.planScore.total >= 70
                  ? "text-green-600"
                  : result.planScore.total >= 50
                    ? "text-amber-600"
                    : "text-red-500"
              }`}
            >
              {result.planScore.total}
            </span>
            <span className="pb-1 text-sm text-slate-400">/ 100</span>
          </div>
          <div className="mt-4 grid gap-2 @min-[640px]:grid-cols-3">
            {result.planScore.dimensions.map((d) => (
              <div key={d.key} className="rounded-lg bg-slate-50 px-3 py-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-600">{d.label}</span>
                  <span
                    className={`font-bold ${
                      d.score >= d.max * 0.5 ? "text-slate-700" : "text-red-500"
                    }`}
                  >
                    {d.score}/{d.max}
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className={`h-full rounded-full ${
                      d.score >= d.max * 0.5 ? "bg-blue-500" : "bg-red-400"
                    }`}
                    style={{ width: `${(d.score / d.max) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          {result.planScore.weakPoints.length > 0 && (
            <div className="mt-4 rounded-xl border border-red-100 bg-red-50/50 p-4">
              <p className="text-xs font-bold text-red-700">
                ⚠ 보완이 필요한 부분
              </p>
              <ul className="mt-2 space-y-1 text-sm text-slate-700">
                {result.planScore.weakPoints.map((w) => (
                  <li key={w} className="flex gap-1.5">
                    <span className="text-red-400">•</span>
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      {/* 사업계획서 작성 질문 */}
      {result.planQuestions && result.planQuestions.length > 0 && (
        <Card title="사업계획서를 쓰기 위해 대표에게 물어볼 것" emoji="❓">
          <ol className="space-y-1.5 text-sm text-slate-700">
            {result.planQuestions.map((q, i) => (
              <li key={q} className="flex gap-2">
                <span className="font-semibold text-blue-600">{i + 1}.</span>
                {q}
              </li>
            ))}
          </ol>
        </Card>
      )}

      {/* 심사관 시뮬레이터 */}
      {result.reviewSim && (
        <Card title={`심사관 시뮬레이터 · ${result.reviewSim.agency}`} emoji="🧑‍⚖️">
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
            심사관의 관점: {result.reviewSim.mindset}
          </p>
          <div className="mt-4 space-y-3">
            {result.reviewSim.items.map((qa) => (
              <div
                key={qa.question}
                className="rounded-xl border border-slate-100 bg-slate-50 p-4"
              >
                <p className="text-sm font-bold text-slate-800">
                  Q. {qa.question}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  <span className="font-semibold text-blue-600">A.</span>{" "}
                  {qa.answer}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-400">
            ※ XX는 대표와 함께 채울 숫자입니다. 답은 인정→근거→숫자→계획 순서로.
          </p>
        </Card>
      )}

      {/* 자료 체크 */}
      {result.documentChecks && result.documentChecks.length > 0 && (
        <Card title="자료 체크 (부족 자료 자동 탐지)" emoji="🗂️">
          <ul className="grid gap-2 @min-[640px]:grid-cols-2">
            {result.documentChecks.map((d) => (
              <li
                key={d.label}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                  d.status === "확보"
                    ? "border-green-100 bg-green-50/50 text-slate-500"
                    : "border-amber-100 bg-amber-50/50 text-slate-700"
                }`}
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] font-bold ${
                    d.status === "확보"
                      ? "border-green-400 bg-green-500 text-white"
                      : "border-amber-400 text-amber-500"
                  }`}
                >
                  {d.status === "확보" ? "✓" : "!"}
                </span>
                {d.label}
                <span
                  className={`ml-auto text-xs font-semibold ${
                    d.status === "확보" ? "text-green-600" : "text-amber-600"
                  }`}
                >
                  {d.status}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* 기관별 진행 로드맵 */}
      {result.roadmap && (
        <Card
          title={`진행 로드맵${result.roadmap.agency ? ` · ${result.roadmap.agency}` : ""}`}
          emoji="🗓️"
        >
          <ol className="space-y-0">
            {result.roadmap.steps.map((s, idx) => (
              <li key={`${s.offsetDays}-${s.task}`} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">
                    {s.offsetLabel}
                  </span>
                  {idx < result.roadmap!.steps.length - 1 && (
                    <span className="my-0.5 w-px flex-1 bg-blue-100" />
                  )}
                </div>
                <p className="pt-2 pb-4 text-sm text-slate-700">{s.task}</p>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {/* ── ⑥ AI 사업계획 전략 (12차) ───────────────────────── */}
      {result.planStrategy && (
        <SectionLabel step="⑥" title="사업계획 전략" />
      )}

      {/* 1. 핵심 전략 (작업1) */}
      {result.planStrategy && (
        <Card
          title={`핵심 전략 · ${result.planStrategy.agency}`}
          emoji="♟️"
        >
          <FlowChain steps={result.planStrategy.flow} />
          <p className="mt-4 text-sm leading-7 text-slate-700">
            {result.planStrategy.summary}
          </p>
          <p className="mt-3 rounded-xl bg-green-50/70 px-4 py-3 text-sm leading-6 text-green-900">
            <span className="font-bold">왜 승인될 것 같은가 · </span>
            {result.planStrategy.winReason}
          </p>
        </Card>
      )}

      {/* 2. 심사관이 좋아할 포인트 (작업5) */}
      {result.reviewFocus && (
        <Card
          title={`심사관이 좋아할 포인트 · ${result.reviewFocus.agency}`}
          emoji="🧑‍⚖️"
        >
          <p className="-mt-2 mb-4 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-500">
            심사관의 관점: {result.reviewFocus.mindset}
          </p>
          <ul className="space-y-2.5">
            {result.reviewFocus.focus.map((f) => (
              <li
                key={f.label}
                className="rounded-xl border border-slate-100 bg-slate-50 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-slate-800">
                    {f.label}
                  </span>
                  <FocusStars n={f.stars} />
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-600">{f.note}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* 3. 반드시 강조할 논리 흐름 (작업2) */}
      {result.planLogic && result.planLogic.length > 0 && (
        <Card title="반드시 강조할 논리 흐름 (7단계)" emoji="🧩">
          <p className="-mt-2 mb-4 text-sm text-slate-500">
            문장보다 순서입니다. 이 사슬이 끊기지 않게 써야 승인돼요.
            <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-700">
              ★ = 이 기관이 특히 보는 단계
            </span>
          </p>
          <ol className="space-y-3">
            {result.planLogic.map((step) => (
              <li
                key={step.key}
                className={`rounded-xl border p-4 ${
                  step.emphasized
                    ? "border-amber-200 bg-amber-50/60"
                    : "border-slate-100 bg-slate-50"
                }`}
              >
                <p className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-xs text-white">
                    {step.no}
                  </span>
                  {step.title}
                  {step.emphasized && <span className="text-amber-500">★</span>}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  <span className="font-semibold text-blue-600">묻기 · </span>
                  {step.question}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {step.guide}
                </p>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {/* 4. 성장 논리 (작업4) */}
      {result.growthLogic && (
        <Card
          title={`성장 논리 · ${result.growthLogic.category}`}
          emoji="📈"
        >
          <FlowChain steps={result.growthLogic.chain} />
          <p className="mt-4 text-sm leading-7 text-slate-700">
            {result.growthLogic.logic}
          </p>
          <p className="mt-3 rounded-xl bg-blue-50/60 px-4 py-3 text-xs leading-6 text-blue-900">
            💡 {result.growthLogic.reviewerNote}
          </p>
          {result.growthLogic.keywords.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {result.growthLogic.keywords.map((k) => (
                <span
                  key={k}
                  className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600"
                >
                  #{k}
                </span>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* 5. 추천 스토리 3버전 (작업3) */}
      {result.storyPack && (
        <Card
          title={`추천 스토리 3버전 · ${result.storyPack.category}`}
          emoji="📖"
        >
          <div className="mb-4">
            <FlowChain steps={result.storyPack.chain} />
          </div>
          <div className="space-y-3">
            {result.storyPack.versions.map((v) => (
              <div
                key={v.key}
                className="rounded-xl border border-slate-100 bg-slate-50 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-bold text-white">
                    {v.label}
                  </span>
                  <span className="text-xs text-slate-400">{v.tone}</span>
                </div>
                <p className="mt-2 text-sm leading-7 text-slate-700">
                  {v.story}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-400">
            ※ XX는 대표와 함께 채울 숫자입니다. 대표 성향에 맞는 버전을 골라 쓰세요.
          </p>
        </Card>
      )}

      {/* 6. 반드시 준비할 자료 (작업6) */}
      {result.documentPriority && result.documentPriority.length > 0 && (
        <Card title="반드시 준비할 자료 (중요도순)" emoji="🗂️">
          <div className="space-y-4">
            {[
              { tier: 5, label: "반드시 필요", cls: "text-red-600" },
              { tier: 4, label: "있으면 매우 좋음", cls: "text-amber-600" },
              { tier: 3, label: "보완 자료", cls: "text-slate-500" },
            ].map((group) => {
              const items = result.documentPriority!.filter(
                (d) => d.tier === group.tier,
              );
              if (items.length === 0) return null;
              return (
                <div key={group.tier}>
                  <p className={`text-xs font-bold ${group.cls}`}>
                    {"★".repeat(group.tier)}
                    <span className="text-slate-200">
                      {"★".repeat(5 - group.tier)}
                    </span>{" "}
                    {group.label}
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {items.map((d) => (
                      <li
                        key={d.label}
                        className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                      >
                        <p className="text-sm font-semibold text-slate-800">
                          {d.label}
                        </p>
                        <p className="text-xs leading-5 text-slate-500">
                          {d.why}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* 7. 왜 이 기관인가 — 기관 비교 근거 (작업10) */}
      {result.agencyComparison && result.agencyComparison.length > 0 && (
        <Card title="왜 다른 기관이 아니라 이 기관인가" emoji="⚖️">
          <ul className="space-y-2.5">
            {result.agencyComparison.map((c, i) => (
              <li
                key={i}
                className="flex gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm leading-6 text-slate-700"
              >
                <span className="text-blue-500">•</span>
                {c}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* 8. 사업계획 체크리스트 (작업9 — 체크 시 저장) */}
      <PlanChecklistCard
        storageKey={`${result.companyName}-${result.topAgency}`}
      />

      {/* 다음 연락 메시지 */}
      <Card title="다음 연락 메시지" emoji="💬">
        <div className="space-y-4">
          <CopyBlock label="서류 요청 카톡 메시지" text={result.documentMessage} />
          <CopyBlock label="재상담 유도 메시지" text={result.followUpMessage} />
        </div>
      </Card>
    </div>
  );
}
