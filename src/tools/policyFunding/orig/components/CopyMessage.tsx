

import { useState } from "react";

// 복사 가능한 메시지 블록 (고객 상세의 재접촉 메시지 등에서 재사용).
export default function CopyMessage({
  label,
  text,
}: {
  label: string;
  text: string;
}) {
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
            copied
              ? "bg-green-600 text-white"
              : "bg-blue-600 text-white hover:bg-blue-700"
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
