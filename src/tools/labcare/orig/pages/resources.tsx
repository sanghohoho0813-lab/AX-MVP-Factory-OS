import { useState } from "react";
import Layout from "../components/Layout";
import PageGuide from "../components/PageGuide";
import {
  RESOURCE_TEMPLATES,
  type ResourceCategory,
  type ResourceTemplate,
} from "../lib/mockStage1";

const CATEGORIES: ("전체" | ResourceCategory)[] = ["전체", "사후관리", "설립", "조사·실사", "영업"];

export default function ResourcesPage() {
  const [selected, setSelected] = useState<ResourceTemplate | null>(RESOURCE_TEMPLATES[0]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [category, setCategory] = useState<"전체" | ResourceCategory>("전체");

  const visible = RESOURCE_TEMPLATES.filter(
    (t) => category === "전체" || t.category === category,
  );

  async function copy(t: ResourceTemplate) {
    try {
      await navigator.clipboard.writeText(t.body);
      setCopiedId(t.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      /* 클립보드 미지원 환경 무시 */
    }
  }

  return (
    <Layout
      title="안내문/자료실"
      subtitle="고객 요청·안내에 바로 쓰는 템플릿 — {고객사명}·{월}·{기한}만 바꿔 보내세요"
    >
      <PageGuide
        id="resources"
        purpose="고객에게 보낼 안내문·요청문·사후관리 설명자료를 모아둡니다."
        when="고객에게 카톡·문자·메일을 보낼 때 사용합니다."
        result="카톡/문자/메일용 안내문, 고객 요청자료 문구를 얻습니다."
        steps={["상황 선택", "문구 복사", "고객에게 발송", "필요 시 수정"]}
      />
      {/* 카테고리 필터 */}
      <div className="mb-5 flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory(c)}
            className={`rounded-xl border px-5 py-2.5 text-base font-bold ${
              category === c
                ? "border-navy-600 bg-navy-700 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 @4xl:grid-cols-3">
        {/* 템플릿 목록 */}
        <section className="@4xl:col-span-2">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {visible.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelected(t)}
                className={`rounded-2xl border bg-white p-4 text-left shadow-card transition-shadow hover:shadow-md ${
                  selected?.id === t.id ? "border-navy-400 ring-1 ring-navy-300" : "border-slate-200"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xl">{t.icon}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                      copiedId === t.id
                        ? "bg-status-normalBg text-status-normal"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {copiedId === t.id ? "복사됨 ✓" : t.category}
                  </span>
                </div>
                <p className="mt-2 text-base font-bold text-slate-900">{t.title}</p>
                <p className="mt-0.5 text-sm leading-snug text-slate-500">{t.desc}</p>
              </button>
            ))}
          </div>
        </section>

        {/* 미리보기 + 복사 */}
        <section className="@2xl:col-span-1">
          <div className="space-y-4 @2xl:sticky @2xl:top-24">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
              {selected ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{selected.icon}</span>
                    <h3 className="text-lg font-bold text-slate-900">{selected.title}</h3>
                  </div>
                  <div className="mt-3 whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-base leading-relaxed text-slate-700">
                    {selected.body}
                  </div>
                  <button
                    type="button"
                    onClick={() => copy(selected)}
                    className="mt-3 w-full rounded-lg bg-navy-700 px-5 py-3 text-base font-bold text-white hover:bg-navy-800"
                  >
                    {copiedId === selected.id ? "복사 완료 ✓" : "본문 복사하기"}
                  </button>
                  <p className="mt-2 text-center text-xs text-slate-500">
                    {"{고객사명}·{월}·{기한}"} 부분을 바꿔서 사용하세요
                  </p>
                </>
              ) : (
                <div className="py-12 text-center">
                  <p className="text-2xl">📚</p>
                  <p className="mt-2 text-base text-slate-500">
                    왼쪽에서 템플릿을 선택하면
                    <br />
                    내용 미리보기와 복사 버튼이 표시됩니다
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-base leading-relaxed text-slate-600">
                💡 다음 단계에서 고객사·월을 선택하면 자동으로 치환된 문구를 생성하고, AI 문구
                다듬기와 연결할 수 있는 구조로 확장됩니다.
              </p>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
