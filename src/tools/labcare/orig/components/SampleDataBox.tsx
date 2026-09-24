import { useEffect, useState } from "react";
import { deleteSampleData, getSampleClientCount } from "../lib/storage";

// 샘플 데이터 관리 박스 — 대시보드/설정에서 공통 사용.
// [D-94] 이 OS 에서는 업체를 고객 운영에서만 만든다 — 샘플 고객사(가짜 업체)를 새로 만드는 단추는 뺐다.
//   예전에 넣어 둔 샘플이 남아 있을 때만 보이고, 지우는 단추 하나만 둔다(직접 등록한 고객사는 그대로).
export default function SampleDataBox({ onChange }: { onChange?: () => void; compact?: boolean }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => { setCount(getSampleClientCount()); }, []);

  function remove() {
    if (!confirm("샘플 데이터를 모두 삭제할까요?\n샘플 고객사와 연결된 오늘 할 일·연구노트·변경사항도 함께 삭제됩니다.\n(직접 등록한 고객/데이터는 그대로 유지됩니다)")) return;
    deleteSampleData();
    setCount(getSampleClientCount());
    onChange?.();
  }

  if (!count) return null;
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5 shadow-card" data-testid="lab-sample-leftover">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-slate-900">🧪 예전에 넣은 샘플 고객사 {count}개</h2>
          <p className="mt-0.5 text-sm text-slate-600">
            고객 관리에 없는 가짜 업체입니다. 실제 등록 고객과 구분되며, 샘플만 따로 삭제할 수 있습니다.
          </p>
        </div>
        <button
          type="button" onClick={remove}
          className="rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-base font-bold text-amber-700 hover:bg-amber-100"
        >
          샘플 데이터 삭제하기
        </button>
      </div>
    </section>
  );
}
