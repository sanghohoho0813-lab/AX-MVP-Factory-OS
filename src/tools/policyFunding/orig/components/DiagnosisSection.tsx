

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "../next";
import type { DiagnosisInput, DiagnosisResult } from "../../types";
import { DEFAULT_INPUT, runDiagnosis, SAMPLE_INPUT } from "../../diagnosis";
import { buildCustomerFromDiagnosis, getStoredCustomerById, pfOsClients, saveCustomer } from "../storage";
import QuickDiagnosisForm from "./QuickDiagnosisForm";
import DeepDiagnosisForm from "./DeepDiagnosisForm";
import ResultCard from "./ResultCard";
import { ClientPickerOptions } from '../../../../components/ops/ClientPickerOptions'

// 진단 결과를 고객으로 저장하는 카드. result 가 바뀌면 key 로 리셋된다.
// 이 OS 에서는 고객 = 고객 운영 업체 — 저장할 업체를 고른다(업체에서 열었으면 그 업체가 골라져 있다).
function SaveCustomerBar({
  input,
  result,
  quickInput,
  deepInput,
  presetClientId,
}: {
  input: DiagnosisInput;
  result: DiagnosisResult;
  quickInput: DiagnosisInput | null;
  deepInput: DiagnosisInput | null;
  presetClientId?: string;
}) {
  const clients = pfOsClients().filter((c) => c.archivedAt === null);
  const byName = clients.find((c) => input.companyName && c.companyName.replace(/\s|\(주\)|주식회사/g, "") === input.companyName.replace(/\s|\(주\)|주식회사/g, ""));
  const [clientId, setClientId] = useState(presetClientId && clients.some((c) => c.id === presetClientId) ? presetClientId : byName?.id ?? "");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const already = clientId ? getStoredCustomerById(clientId) : undefined;

  const handleSave = () => {
    if (!clientId || saving) return;
    setSaving(true);
    setFailed(false);
    // D-224 실제로 저장된 뒤에 '저장했습니다' — 예전에는 실패해도 저장했다고 보였다
    void saveCustomer(
      buildCustomerFromDiagnosis(input, result, {
        quickInput: quickInput ?? undefined,
        deepInput: deepInput ?? undefined,
        clientId,
      }),
    ).then((ok) => {
      setSaving(false);
      if (ok) setSaved(true);
      else setFailed(true);
    });
  };

  return (
    <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 text-center" data-testid="pf-save-bar">
      {saved ? (
        <div className="flex flex-col items-center gap-3">
          <p className="font-semibold text-blue-900">
            이 업체 상담으로 저장했습니다. 업체 목록 · 결과서에서 이어서 볼 수 있습니다.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link
              href={`/customers/${clientId}`}
              className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              업체 목록 보기
            </Link>
            <Link
              href={`/customers/${clientId}/report`}
              className="rounded-xl border border-blue-200 bg-white px-6 py-3 text-sm font-semibold text-blue-700 transition-colors hover:border-blue-400"
              data-testid="pf-save-report"
            >
              결과서 보기
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <p className="break-keep text-sm text-slate-600">
            업체 기록에는 붙이지 않고 정책자금 업체 목록(진행 단계 · 메모)과 결과서에만 저장해요. 위 ‘기록에 붙이기’ 를 눌렀으면 이미 함께 저장돼 있어 또 누르지 않아도 돼요.
          </p>
          <label className="flex w-full max-w-md flex-col gap-1 text-left text-sm font-medium text-slate-700">
            저장할 고객 관리 업체
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              data-testid="pf-save-client"
              className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 focus:border-blue-500 focus:outline-none"
            >
              <option value="">업체 고르기</option>
              <ClientPickerOptions clients={clients} />
            </select>
          </label>
          {clients.length === 0 ? (
            <p className="text-xs text-slate-500">
              고객 관리에 업체가 없습니다. <a href="/ops/clients" className="font-semibold text-blue-700 underline">고객 관리</a>에서 업체를 먼저 만드세요.
            </p>
          ) : already ? (
            <p className="text-xs text-slate-500">이미 상담 중인 업체입니다 — 진단 결과만 새로 바뀌고 단계·메모는 이어집니다.</p>
          ) : null}
          {failed ? (
            <p className="text-sm font-semibold text-red-700" role="alert" data-testid="pf-save-failed">
              저장하지 못했습니다. 인터넷 연결을 확인하고 다시 눌러 주세요.
            </p>
          ) : null}
          <button
            type="button"
            onClick={handleSave}
            disabled={!clientId || saving}
            data-testid="pf-save-consult"
            className="rounded-xl border border-blue-300 bg-white px-6 py-3 text-base font-semibold text-blue-700 transition-colors hover:border-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "저장하는 중…" : "이 업체 상담으로 저장(업체 목록 · 결과서만)"}
          </button>
        </div>
      )}
    </div>
  );
}

// 빠른 진단 → 1차 판단 → 필요한 심층 질문만 추가 → 결과 업데이트 (11차 UX)
// 이 OS 에서 더한 것: 업체 정보로 채운 첫 값(initialInput) · 결과 아래 '업체 기록에 붙이기'(extras) · 입력 기억(onInputChange)
export default function DiagnosisSection({
  autoSample = false,
  autoRun = false,
  initialInput,
  presetClientId,
  extras,
  onInputChange,
}: {
  autoSample?: boolean;
  /** D-199 상황 예시 — 첫 값(initialInput)으로 바로 진단해 결과를 보여 준다 */
  autoRun?: boolean;
  initialInput?: DiagnosisInput;
  presetClientId?: string;
  extras?: (input: DiagnosisInput, result: DiagnosisResult) => ReactNode;
  onInputChange?: (input: DiagnosisInput) => void;
}) {
  const [input, setInput] = useState<DiagnosisInput>(
    autoSample ? SAMPLE_INPUT : initialInput ?? DEFAULT_INPUT,
  );
  useEffect(() => {
    onInputChange?.(input);
  }, [input, onInputChange]);
  const [result, setResult] = useState<DiagnosisResult | null>(
    autoSample ? runDiagnosis(SAMPLE_INPUT) : autoRun && initialInput ? runDiagnosis(initialInput) : null,
  );
  const [quickInput, setQuickInput] = useState<DiagnosisInput | null>(
    autoSample ? SAMPLE_INPUT : autoRun && initialInput ? initialInput : null,
  );
  const [deepInput, setDeepInput] = useState<DiagnosisInput | null>(null);
  // D-224 결과를 낸 그때의 입력 — 결과를 본 뒤 칸을 고치면 결과 카드 · 붙이기 · 저장이 새 칸 + 옛 결과로 섞이던 것
  const [resultInput, setResultInput] = useState<DiagnosisInput | null>(
    autoSample ? SAMPLE_INPUT : autoRun && initialInput ? initialInput : null,
  );
  const [deepOpen, setDeepOpen] = useState(false);
  const [deepApplied, setDeepApplied] = useState(false);
  const [runId, setRunId] = useState(0);
  const resultRef = useRef<HTMLDivElement>(null);
  const deepRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (result) {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [result, runId]);

  const handleQuickSubmit = () => {
    setResult(runDiagnosis(input));
    setResultInput(input);
    setQuickInput(input);
    setDeepOpen(false);
    setDeepApplied(false);
    setRunId((r) => r + 1);
  };

  const handleDeepSubmit = () => {
    setResult(runDiagnosis(input));
    setResultInput(input);
    setDeepInput(input);
    setDeepApplied(true);
    setRunId((r) => r + 1);
  };

  const openDeep = () => {
    setDeepOpen(true);
    window.setTimeout(
      () => deepRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      80,
    );
  };

  const topAgencies = result?.agencies.map((a) => a.name) ?? [];
  const shown = resultInput ?? input;
  const stale = !!result && !!resultInput && (Object.keys(input) as (keyof DiagnosisInput)[]).some((k) => input[k] !== resultInput[k]);

  return (
    <div className="mx-auto max-w-6xl">
      <QuickDiagnosisForm
        value={input}
        onChange={setInput}
        onSubmit={handleQuickSubmit}
      />

      {result && (
        <div ref={resultRef} id="result" className="mt-14 scroll-mt-24">
          {deepApplied && (
            <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">
              🔍 심층 진단이 반영된 결과입니다.
            </div>
          )}
          {stale && (
            <div className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-amber-900" data-testid="pf-stale">
              칸을 바꿨어요. 아래 결과는 바꾸기 전 값 기준입니다 — {deepOpen ? "[심층 진단 반영해 결과 업데이트]" : "[진단 결과 보기]"} 를 누르면 새 값으로 바뀝니다.
            </div>
          )}
          <ResultCard input={shown} result={result} />
          {extras ? <div className="mt-4">{extras(shown, result)}</div> : null}

          {/* 심층 진단으로 정확도 높이기 */}
          <div ref={deepRef} className="mt-6 scroll-mt-24">
            {!deepOpen ? (
              <button
                type="button"
                onClick={openDeep}
                className="w-full rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-5 text-center transition-colors hover:border-blue-400 hover:bg-blue-50"
              >
                <span className="text-base font-bold text-blue-700">
                  🔍 심층 진단으로 정확도 높이기
                </span>
                <p className="mt-1 text-xs text-slate-500">
                  빠른 진단 결과에 맞는 질문만 추가로 확인해요 (1~2분)
                </p>
              </button>
            ) : (
              <DeepDiagnosisForm
                value={input}
                onChange={setInput}
                onSubmit={handleDeepSubmit}
                topAgencies={topAgencies}
              />
            )}
          </div>

          <SaveCustomerBar
            key={runId}
            input={shown}
            result={result}
            quickInput={quickInput}
            deepInput={deepInput}
            presetClientId={presetClientId}
          />
        </div>
      )}
    </div>
  );
}
