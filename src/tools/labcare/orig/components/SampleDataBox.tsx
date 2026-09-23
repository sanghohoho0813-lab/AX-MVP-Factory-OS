import { useEffect, useState } from "react";
import { generateSampleData, deleteSampleData, getSampleClientCount } from "../lib/storage";

// 샘플 데이터 관리 박스 — 대시보드/설정에서 공통 사용.
// 샘플 식별자(isSample/source/sampleBatchId)를 가진 데이터만 생성/삭제하며, 직접 등록 데이터는 보존한다.
const COUNTS = [3, 5, 10, 20, 30];

export default function SampleDataBox({ onChange, compact = false }: { onChange?: () => void; compact?: boolean }) {
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setCount(getSampleClientCount()); }, []);

  function gen(n: number) {
    setBusy(true);
    // 기존 샘플을 정리한 뒤 n개로 다시 생성(누적되지 않음). 직접 등록 데이터는 유지.
    generateSampleData(n);
    setCount(getSampleClientCount());
    setBusy(false);
    onChange?.();
  }

  function remove() {
    if (!confirm("샘플 데이터를 모두 삭제할까요?\n샘플 고객사와 연결된 오늘 할 일·연구노트·변경사항도 함께 삭제됩니다.\n(직접 등록한 고객/데이터는 그대로 유지됩니다)")) return;
    deleteSampleData();
    setCount(getSampleClientCount());
    onChange?.();
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900">🧪 샘플 데이터 관리</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            처음이라면 샘플 3개만 넣고 흐름을 먼저 확인해보세요. 실제 등록 고객과 구분되며, 샘플만 따로 삭제할 수 있습니다.
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-600">
          현재 샘플 고객: {count ?? 0}개
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {/* 처음 사용자에게 가장 눈에 띄는 기본 버튼 */}
        <button
          type="button" disabled={busy} onClick={() => gen(3)}
          className="rounded-xl bg-navy-700 px-5 py-2.5 text-base font-bold text-white hover:bg-navy-800 disabled:opacity-50"
        >
          샘플 3개로 먼저 보기
        </button>
        {/* 보조 개수 */}
        {COUNTS.filter((n) => n !== 3).map((n) => (
          <button
            key={n} type="button" disabled={busy} onClick={() => gen(n)}
            className="rounded-xl border border-navy-200 bg-white px-4 py-2.5 text-base font-bold text-navy-700 hover:bg-navy-50 disabled:opacity-50"
          >
            샘플 {n}개{compact ? "" : " 넣어보기"}
          </button>
        ))}
        <button
          type="button" onClick={remove}
          className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-base font-bold text-amber-700 hover:bg-amber-100"
        >
          샘플 데이터 삭제하기
        </button>
      </div>
    </section>
  );
}
