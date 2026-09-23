import type { ClientStatus } from "../../types";

const STYLES: Record<ClientStatus, string> = {
  정상: "bg-status-normalBg text-status-normal ring-1 ring-inset ring-green-200",
  주의: "bg-status-warningBg text-status-warning ring-1 ring-inset ring-yellow-200",
  위험: "bg-status-dangerBg text-status-danger ring-1 ring-inset ring-red-200",
  "즉시 확인": "bg-red-600 text-white ring-1 ring-inset ring-red-700 shadow-sm",
  미점검: "bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-200",
};

const DOT: Record<ClientStatus, string> = {
  정상: "bg-status-normal",
  주의: "bg-status-warning",
  위험: "bg-status-danger",
  "즉시 확인": "bg-white",
  미점검: "bg-slate-400",
};

// 화면 표시용 라벨 (내부 등급값은 유지하되 "겁주는" 표현은 완화)
const LABEL: Record<ClientStatus, string> = {
  정상: "정상",
  주의: "주의",
  위험: "관리 필요",
  "즉시 확인": "우선 관리",
  미점검: "미점검",
};

export default function StatusBadge({
  status,
  size = "md",
}: {
  status: ClientStatus;
  size?: "sm" | "md";
}) {
  const pad = size === "sm" ? "px-2.5 py-1 text-sm" : "px-3.5 py-1.5 text-base";
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold ${pad} ${STYLES[status]}`}
    >
      <span className={`h-2 w-2 rounded-full ${DOT[status]}`} />
      {LABEL[status]}
    </span>
  );
}
