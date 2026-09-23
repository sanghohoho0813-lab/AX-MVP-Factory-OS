import { useEffect, useMemo, useState } from "react";
import Link from "../next";
import { useParams, useRouter } from "../nav";
import Layout from "../components/Layout";
import StatusBadge from "../components/StatusBadge";
import {
  currentMonth,
  ensureSeeded,
  getChecksByClient,
  getClient,
  saveCheck,
} from "../lib/storage";
import { evaluateRisk, LEVEL_META, urgentReason } from "../../lib/riskEngine";
import type {
  CheckAnswers,
  Client,
  PersonnelChangeType,
} from "../../types";

const DEFAULT_ANSWERS: CheckAnswers = {
  personnelChange: false,
  spaceChange: false,
  registrationChange: false,
  projectOngoing: true,
  researchNotesWritten: true,
  expenseEvidenceOrganized: true,
  taxDocsPrepared: true,
  surveyResponseNeeded: false,
  memo: "",
};

export default function CheckPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [client, setClient] = useState<Client | null>(null);
  const [month, setMonth] = useState(currentMonth());
  const [answers, setAnswers] = useState<CheckAnswers>(DEFAULT_ANSWERS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    ensureSeeded();
    setClient(getClient(id) ?? null);
    // 가장 최근 점검 응답을 기본값으로 가져와 편집 편의 제공
    const prev = getChecksByClient(id)[0];
    if (prev) setAnswers(prev.answers);
    setLoaded(true);
  }, [id]);

  const preview = useMemo(() => evaluateRisk(answers), [answers]);

  function set<K extends keyof CheckAnswers>(key: K, value: CheckAnswers[K]) {
    setAnswers((a) => ({ ...a, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { score, level } = evaluateRisk(answers);
    saveCheck({ clientId: id, month, answers, score, level });
    router.push(`/clients/${id}/report?month=${month}`);
  }

  if (loaded && !client) {
    return (
      <Layout title="고객사를 찾을 수 없습니다">
        <Link href="/clients" className="text-navy-600">
          ← 고객사 목록으로
        </Link>
      </Layout>
    );
  }
  if (!client) return <Layout title="불러오는 중…">{null}</Layout>;

  return (
    <Layout
      title="월간 사후관리 점검"
      subtitle={`${client.name} · ${client.labType}`}
      actions={
        <Link
          href={`/clients/${id}`}
          className="rounded-lg border border-slate-300 px-5 py-2.5 text-base font-bold text-slate-600 hover:bg-slate-50"
        >
          ← 상세로
        </Link>
      }
    >
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-5 @4xl:grid-cols-3">
        {/* 체크리스트 */}
        <div className="space-y-5 @4xl:col-span-2">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-card">
            <label className="text-sm font-semibold text-slate-700">점검 대상 월</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="mt-1 block w-48 rounded-lg border border-slate-300 px-3.5 py-2.5 text-base focus:border-navy-600 focus:outline-none focus:ring-1 focus:ring-navy-600"
            />
          </div>

          <CheckSection title="① 인적·물적 변동 (변경신고 검토)">
            <YesNo
              label="연구전담요원 입사/퇴사/부서이동이 있었나요?"
              hint="인원 요건 및 변경신고 검토 대상"
              riskyWhen="yes"
              value={answers.personnelChange}
              onChange={(v) => set("personnelChange", v)}
            />
            {answers.personnelChange ? (
              <div className="ml-1 mt-2 flex gap-2">
                {(["입사", "퇴사", "부서이동"] as PersonnelChangeType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => set("personnelChangeType", t)}
                    className={`rounded-lg border px-4 py-2 text-sm font-bold ${
                      answers.personnelChangeType === t
                        ? "border-navy-600 bg-navy-50 text-navy-700"
                        : "border-slate-200 text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            ) : null}
            <YesNo
              label="연구소 전용공간(면적·위치) 변경이 있었나요?"
              hint="전용공간 요건 / 변경신고 대상"
              riskyWhen="yes"
              value={answers.spaceChange}
              onChange={(v) => set("spaceChange", v)}
            />
            <YesNo
              label="주소·대표자·상호 등 인정사항 변경이 있었나요?"
              hint="변경신고 누락 시 직권취소 위험"
              riskyWhen="yes"
              value={answers.registrationChange}
              onChange={(v) => set("registrationChange", v)}
            />
          </CheckSection>

          <CheckSection title="② 연구개발 활동">
            <YesNo
              label="연구과제가 정상적으로 진행되고 있나요?"
              hint="활동 부재 시 실태조사 리스크"
              riskyWhen="no"
              value={answers.projectOngoing}
              onChange={(v) => set("projectOngoing", v)}
            />
            <YesNo
              label="연구노트가 작성되고 있나요?"
              hint="세액공제·인정 유지의 핵심 증빙"
              riskyWhen="no"
              value={answers.researchNotesWritten}
              onChange={(v) => set("researchNotesWritten", v)}
            />
          </CheckSection>

          <CheckSection title="③ 세액공제·증빙">
            <YesNo
              label="연구개발비 증빙이 정리되어 있나요?"
              hint="인건비·재료비 증빙"
              riskyWhen="no"
              value={answers.expenseEvidenceOrganized}
              onChange={(v) => set("expenseEvidenceOrganized", v)}
            />
            <YesNo
              label="세무사 전달자료가 준비되어 있나요?"
              hint="연구개발비 명세서 등"
              riskyWhen="no"
              value={answers.taxDocsPrepared}
              onChange={(v) => set("taxDocsPrepared", v)}
            />
          </CheckSection>

          <CheckSection title="④ 외부 대응">
            <YesNo
              label="연구개발활동조사 대응이 필요한가요?"
              hint="KOITA 활동조사 기한 대응"
              riskyWhen="yes"
              value={answers.surveyResponseNeeded}
              onChange={(v) => set("surveyResponseNeeded", v)}
            />
          </CheckSection>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-card">
            <label className="text-sm font-semibold text-slate-700">특이사항 메모</label>
            <textarea
              value={answers.memo}
              onChange={(e) => set("memo", e.target.value)}
              rows={4}
              placeholder="현장 점검 중 확인된 특이사항, 고객 요청, 후속 일정 등을 기록하세요."
              className="mt-2 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-base focus:border-navy-600 focus:outline-none focus:ring-1 focus:ring-navy-600"
            />
          </div>
        </div>

        {/* 실시간 위험도 미리보기 (sticky) */}
        <div className="@2xl:col-span-1">
          <div className="sticky top-24 space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-card">
            <p className="text-sm font-medium text-slate-500">실시간 위험도 미리보기</p>
            <div className="flex items-center justify-between">
              <StatusBadge status={preview.level} />
              <span className="text-sm text-slate-400">
                <span className="text-lg font-bold text-slate-800">{preview.score}</span>/100
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full transition-all ${
                  preview.level === "즉시 확인"
                    ? "bg-red-600"
                    : preview.level === "위험"
                      ? "bg-status-danger"
                      : preview.level === "주의"
                        ? "bg-status-warning"
                        : "bg-status-normal"
                }`}
                style={{ width: `${preview.score}%` }}
              />
            </div>

            {/* 등급에 대한 친절한 설명 */}
            <p className="text-sm leading-relaxed text-slate-500">
              {LEVEL_META[preview.level].customerMessage}
            </p>

            {/* '즉시 확인'일 때 왜 시급한지 설명 */}
            {preview.level === "즉시 확인" ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="mb-1 text-xs font-bold text-status-danger">왜 즉시 확인이 필요한가요?</p>
                <p className="text-xs leading-relaxed text-slate-600">{urgentReason(answers)}</p>
              </div>
            ) : null}

            {preview.factors.length ? (
              <div className="border-t border-slate-100 pt-3">
                <p className="mb-2 text-xs font-semibold text-slate-400">확인된 항목</p>
                <ul className="space-y-2">
                  {preview.factors.map((f) => (
                    <li key={f.key} className="flex items-start gap-2 text-sm">
                      <span
                        className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                          f.severity === "high"
                            ? "bg-status-danger"
                            : f.severity === "medium"
                              ? "bg-status-warning"
                              : "bg-slate-400"
                        }`}
                      />
                      <span className="text-slate-600">{f.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="border-t border-slate-100 pt-3 text-sm text-status-normal">
                현재 확인된 리스크가 없습니다. 양호한 상태입니다. 👍
              </p>
            )}

            <button
              type="submit"
              className="w-full rounded-lg bg-navy-700 px-5 py-3 text-base font-bold text-white hover:bg-navy-800"
            >
              점검 제출 및 위험도 저장
            </button>
            <p className="text-center text-sm text-slate-500">
              제출 시 리포트 화면으로 이동합니다.
            </p>
          </div>
        </div>
      </form>
    </Layout>
  );
}

function CheckSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-card">
      <div className="border-b border-slate-100 px-6 py-3">
        <h3 className="text-base font-bold text-slate-800">{title}</h3>
      </div>
      <div className="divide-y divide-slate-50 px-6">{children}</div>
    </div>
  );
}

function YesNo({
  label,
  hint,
  value,
  onChange,
  riskyWhen,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  /** 위험에 해당하는 응답 방향 (강조 표시용) */
  riskyWhen: "yes" | "no";
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div>
        <p className="text-base font-medium text-slate-800">{label}</p>
        {hint ? <p className="mt-0.5 text-sm text-slate-500">{hint}</p> : null}
      </div>
      <div className="flex shrink-0 overflow-hidden rounded-lg border border-slate-200">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`px-4 py-1.5 text-sm font-semibold transition-colors ${
            value
              ? riskyWhen === "yes"
                ? "bg-status-dangerBg text-status-danger"
                : "bg-status-normalBg text-status-normal"
              : "text-slate-400 hover:bg-slate-50"
          }`}
        >
          예
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`border-l border-slate-200 px-4 py-1.5 text-sm font-semibold transition-colors ${
            !value
              ? riskyWhen === "no"
                ? "bg-status-dangerBg text-status-danger"
                : "bg-status-normalBg text-status-normal"
              : "text-slate-400 hover:bg-slate-50"
          }`}
        >
          아니오
        </button>
      </div>
    </div>
  );
}
