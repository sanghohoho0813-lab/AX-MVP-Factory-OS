import { useEffect, useState } from "react";
import Link from "../next";
import { useParams, useRouter } from "../nav";
import Layout from "../components/Layout";
import StatusBadge from "../components/StatusBadge";
import {
  deleteClient,
  ensureSeeded,
  getChecksByClient,
  getClient,
  updateClient,
} from "../lib/storage";
import { formatManwon, getTaxCreditEstimate } from "../../lib/taxCredit";
import { evaluateRisk } from "../../lib/riskEngine";
import type { Client, MonthlyCheck } from "../../types";

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [client, setClient] = useState<Client | null>(null);
  const [checks, setChecks] = useState<MonthlyCheck[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [taxForm, setTaxForm] = useState({ payroll: 0, material: 0, other: 0 });
  const [taxSaved, setTaxSaved] = useState(false);

  useEffect(() => {
    ensureSeeded();
    const c = getClient(id);
    setClient(c ?? null);
    setChecks(getChecksByClient(id));
    if (c) setTaxForm({ payroll: c.researchersPayrollTotal ?? 0, material: c.rndMaterialCost ?? 0, other: c.rndOtherCost ?? 0 });
    setLoaded(true);
  }, [id]);

  if (loaded && !client) {
    return (
      <Layout title="고객사를 찾을 수 없습니다">
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-card">
          <p className="text-slate-500">존재하지 않는 고객사입니다.</p>
          <Link
            href="/clients"
            className="mt-4 inline-block rounded-lg bg-navy-700 px-5 py-2.5 text-base font-bold text-white"
          >
            고객사 목록으로
          </Link>
        </div>
      </Layout>
    );
  }

  if (!client) return <Layout title="불러오는 중…">{null}</Layout>;

  const latest = checks[0];
  const risk = latest ? evaluateRisk(latest.answers) : null;

  function handleDelete() {
    if (!confirm(`${client?.name} 고객사를 삭제할까요? 점검 이력도 함께 삭제됩니다.`)) return;
    deleteClient(id);
    router.push("/clients");
  }

  return (
    <Layout
      title={client.name}
      subtitle={`${client.labType} · 담당 ${client.consultant || "미지정"}`}
      actions={
        <div className="flex gap-2">
          <Link
            href={`/clients/${id}/report`}
            className="rounded-lg border border-navy-200 bg-white px-5 py-2.5 text-base font-bold text-navy-700 hover:bg-navy-50"
          >
            리포트 보기
          </Link>
          <Link
            href={`/clients/${id}/check`}
            className="rounded-lg bg-navy-700 px-5 py-2.5 text-base font-bold text-white hover:bg-navy-800"
          >
            월간 점검 시작
          </Link>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-5 @2xl:grid-cols-3">
        {/* 좌측: 기본정보 + 연구소 정보 */}
        <div className="space-y-5 @2xl:col-span-2">
          <InfoCard title="회사 기본정보">
            <InfoRow label="상호" value={client.name} />
            <InfoRow label="대표자" value={client.ceoName || "—"} />
            <InfoRow label="업종" value={client.industry || "—"} />
            <InfoRow label="사업장 주소" value={client.address || "—"} />
          </InfoCard>

          <InfoCard title="연구소 정보">
            <InfoRow label="유형" value={client.labType} />
            <InfoRow label="명칭" value={client.labName || "—"} />
            <InfoRow
              label="인정(신고)일"
              value={client.certifiedDate ? client.certifiedDate.replace(/-/g, ".") : "—"}
            />
            <InfoRow label="연구전담요원" value={`${client.researcherCount}명`} />
            <InfoRow label="인정번호" value={client.labRegistrationNumber || "—"} />
            {client.note ? <InfoRow label="비고" value={client.note} /> : null}
          </InfoCard>
        </div>

        {/* 우측: 현재 위험도 */}
        <div className="space-y-5">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-card">
            <p className="text-sm font-medium text-slate-500">현재 위험도</p>
            <div className="mt-3 flex items-center justify-between">
              <StatusBadge status={latest ? latest.level : "미점검"} />
              {risk ? (
                <span className="text-sm text-slate-400">
                  위험점수 <span className="font-bold text-slate-700">{risk.score}</span>/100
                </span>
              ) : null}
            </div>
            {latest ? (
              <p className="mt-3 text-sm text-slate-500">
                최근 점검: {latest.month.replace("-", "년 ")}월
              </p>
            ) : (
              <p className="mt-3 text-sm text-slate-500">아직 점검 이력이 없습니다.</p>
            )}

            {risk && risk.factors.length > 0 ? (
              <ul className="mt-4 space-y-2">
                {risk.factors.slice(0, 4).map((f) => (
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
            ) : latest ? (
              <p className="mt-4 text-sm text-status-normal">감지된 리스크가 없습니다. 👍</p>
            ) : null}
          </div>

          {/* 절세 기준 입력 (검토용) */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-card">
            <p className="text-base font-bold text-slate-800">💰 절세 계산 기준 (원 단위 · 검토용)</p>
            <div className="mt-3 space-y-2">
              {([
                ["연구원 연간 인건비", "payroll"],
                ["연구 재료비/부품비", "material"],
                ["기타 연구개발비", "other"],
              ] as const).map(([label, key]) => (
                <div key={key}>
                  <label className="text-sm font-semibold text-slate-500">{label}</label>
                  <input
                    type="number" min={0}
                    value={taxForm[key] || ""}
                    onChange={(e) => { setTaxForm((f) => ({ ...f, [key]: Number(e.target.value) })); setTaxSaved(false); }}
                    className="mt-0.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-navy-600 focus:outline-none"
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  updateClient(id, { researchersPayrollTotal: taxForm.payroll, rndMaterialCost: taxForm.material, rndOtherCost: taxForm.other });
                  setClient(getClient(id) ?? null);
                  setTaxSaved(true);
                }}
                className="w-full rounded-lg bg-navy-700 px-4 py-2.5 text-base font-bold text-white hover:bg-navy-800"
              >
                {taxSaved ? "저장됨 ✓" : "절세 기준 저장"}
              </button>
              {(() => {
                const est = getTaxCreditEstimate(client);
                return est.available ? (
                  <p className="rounded-lg bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800">
                    예상 연간 절세 효과: 약 {formatManwon(est.annual)} ({est.taxType}, 검토용)
                  </p>
                ) : (
                  <p className="text-sm text-slate-400">금액 입력 시 예상 절세액(검토용)이 표시됩니다.</p>
                );
              })()}
            </div>
          </div>

          <button
            onClick={handleDelete}
            className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-400 hover:border-red-200 hover:text-status-danger"
          >
            고객사 삭제
          </button>
        </div>
      </div>

      {/* 최근 월간 점검 결과 */}
      <section className="mt-6 rounded-xl border border-slate-200 bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-bold text-slate-900">월간 점검 이력</h2>
          <Link
            href={`/clients/${id}/check`}
            className="text-sm font-semibold text-navy-600 hover:text-navy-800"
          >
            새 점검 +
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-6 py-3">점검월</th>
                <th className="px-6 py-3">위험도</th>
                <th className="px-6 py-3">점수</th>
                <th className="px-6 py-3">메모</th>
                <th className="px-6 py-3 text-right">리포트</th>
              </tr>
            </thead>
            <tbody>
              {checks.map((chk) => (
                <tr key={chk.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-6 py-4 font-medium text-slate-800">
                    {chk.month.replace("-", ".")}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={chk.level} size="sm" />
                  </td>
                  <td className="px-6 py-4 text-slate-600">{chk.score}</td>
                  <td className="px-6 py-4 max-w-xs truncate text-slate-500">
                    {chk.answers.memo || "—"}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/clients/${id}/report?month=${chk.month}`}
                      className="text-sm font-semibold text-navy-600 hover:text-navy-800"
                    >
                      보기 →
                    </Link>
                  </td>
                </tr>
              ))}
              {checks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-400">
                    점검 이력이 없습니다. “월간 점검 시작”으로 첫 점검을 진행하세요.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </Layout>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-card">
      <div className="border-b border-slate-200 px-6 py-4">
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      </div>
      <dl className="divide-y divide-slate-50">{children}</dl>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4 px-6 py-3">
      <dt className="w-28 shrink-0 text-sm font-medium text-slate-400">{label}</dt>
      <dd className="text-sm text-slate-800">{value}</dd>
    </div>
  );
}
