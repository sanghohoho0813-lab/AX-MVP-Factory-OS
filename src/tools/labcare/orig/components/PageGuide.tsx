import { useEffect, useState } from "react";
import { useRouter, usePathname } from "../nav";
import { getReturnPoint, clearReturnPoint, type ReturnPoint } from "../lib/uiState";

/**
 * 페이지 상단 초보자 안내 카드 (compact).
 *  - 기본 접힘: "처음 쓰는 분 안내" 버튼만 표시 → 클릭 시 목적/언제/결과물/순서 펼침
 *  - 펼침/접힘 상태를 localStorage에 기억 (id별)
 *  - sessionStorage에 returnPoint가 있으면 "← 이전 작업 위치로" 버튼 표시
 *  - 안내 영상 placeholder (추후 연결)
 */
export default function PageGuide({
  id,
  purpose,
  when,
  result,
  steps,
}: {
  id: string;
  purpose: string;
  when: string;
  result: string;
  steps: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [rp, setRp] = useState<ReturnPoint | null>(null);

  useEffect(() => {
    try {
      setOpen(window.localStorage.getItem(`guide:${id}`) === "open");
    } catch { /* 무시 */ }
    const r = getReturnPoint();
    // 같은 페이지로의 returnPoint는 표시하지 않음
    if (r && r.path && !pathname.startsWith(r.path.split("?")[0])) setRp(r);
  }, [id, pathname]);

  function toggle() {
    const next = !open;
    setOpen(next);
    try {
      window.localStorage.setItem(`guide:${id}`, next ? "open" : "closed");
    } catch { /* 무시 */ }
  }

  function goReturn() {
    if (!rp) return;
    clearReturnPoint();
    router.push(rp.path);
  }

  return (
    <div className="mb-4">
      {rp ? (
        <button
          type="button"
          onClick={goReturn}
          className="mb-2 inline-flex items-center gap-1.5 rounded-lg border border-navy-200 bg-white px-3.5 py-2 text-sm font-bold text-navy-700 shadow-sm transition hover:bg-navy-50"
        >
          ← 이전 작업 위치로 <span className="font-medium text-slate-400">({rp.label})</span>
        </button>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button type="button" onClick={toggle} className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-navy-700">
            <span className="text-base">💡</span>
            {open ? "안내 접기" : "처음 쓰는 분 안내"}
            <span className="text-slate-400">{open ? "▲" : "▼"}</span>
          </button>
          <button
            type="button"
            onClick={() => alert("안내 영상은 추후 연결 예정입니다.")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-50"
          >
            ▶ 1분 사용법 영상
          </button>
        </div>

        {open ? (
          <div className="mt-3 grid grid-cols-1 gap-3 border-t border-slate-200 pt-3 sm:grid-cols-2">
            <Item icon="🎯" label="이 화면의 목적" text={purpose} />
            <Item icon="🕒" label="언제 쓰나요" text={when} />
            <Item icon="📦" label="얻는 결과물" text={result} />
            <div>
              <p className="text-xs font-bold text-slate-500">🪜 추천 사용 순서</p>
              <ol className="mt-1 space-y-1">
                {steps.map((s, i) => (
                  <li key={i} className="flex gap-2 text-sm leading-relaxed text-slate-700">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-navy-700 text-[11px] font-bold text-white">{i + 1}</span>
                    {s}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Item({ icon, label, text }: { icon: string; label: string; text: string }) {
  return (
    <div>
      <p className="text-xs font-bold text-slate-500">{icon} {label}</p>
      <p className="mt-1 text-sm leading-relaxed text-slate-700">{text}</p>
    </div>
  );
}
