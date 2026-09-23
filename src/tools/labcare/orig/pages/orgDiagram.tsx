import { useEffect, useRef, useState } from "react";
import { useToolClient } from "../../../shared/toolClientContext";
import Link from "../next";
import Layout from "../components/Layout";
import PageGuide from "../components/PageGuide";
import { FloorPlanner } from "../../screens/FloorPlanner";
import { downloadSvgAsJpeg, printSvg } from "../../lib/download";

/* ═══════════════════ 타입 ═══════════════════ */

interface Dept {
  name: string;
  count: number;
}

/** 업무편람 기준 사진촬영 가이드 (촬영 구도 안내용 텍스트 카드) */
interface PhotoGuideItem {
  key: string;
  label: string;
  desc: string;
}

const PHOTO_GUIDE: PhotoGuideItem[] = [
  { key: "sign", label: "전용출입구 현판", desc: "현판 글자가 읽히도록 근접 촬영" },
  { key: "door", label: "출입문 전체", desc: "출입문과 현판 위치가 함께 보이도록 촬영" },
  { key: "front", label: "내부 — 전면", desc: "출입문 기준 정면 방향, 책상·기자재가 보이게" },
  { key: "back", label: "내부 — 후면", desc: "반대 방향에서 공간 전체가 보이게" },
  { key: "left", label: "내부 — 좌측", desc: "좌측 벽면과 기자재·좌석이 보이게" },
  { key: "right", label: "내부 — 우측", desc: "우측 벽면과 기자재·좌석이 보이게" },
  { key: "rooms", label: "2실 이상", desc: "각 실별로 전·후·좌·우 촬영" },
  { key: "building", label: "독립공간 / 층 전체", desc: "필요 시 외부 전경 또는 층 구성 확인 사진 준비" },
];

const PHOTO_GOOD = ["현판 글자가 선명함", "출입문과 현판 위치가 함께 보임", "책상·PC·연구기자재가 함께 보임", "도면상 배치와 사진이 일치함"];
const PHOTO_BAD = ["너무 가까운 부분 사진", "현판 글자가 흐림", "책상 일부만 보임", "도면과 실제 배치가 다름"];

export default function OrgDiagramPage() {
  /* ── 조직도 입력 ── */
  const [company, setCompany] = useState("(주)다온식품");
  const [ceo, setCeo] = useState("김영호");
  const [depts, setDepts] = useState<Dept[]>([
    { name: "경영지원팀", count: 2 },
    { name: "영업팀", count: 3 },
  ]);
  const [labHead, setLabHead] = useState("박지원");
  const [researchers, setResearchers] = useState("이수민, 최현우");
  const [assistants, setAssistants] = useState("정나래");
  const [managers, setManagers] = useState("");
  const [insuranceFile, setInsuranceFile] = useState<string | null>(null);
  // [D-94] 업체에서 열었으면(?client=) 원본 예시 회사 대신 그 업체 이름·대표로 시작한다
  const { clientRecord } = useToolClient();
  useEffect(() => {
    if (!clientRecord) return;
    setCompany(clientRecord.companyName);
    setCeo(clientRecord.representativeName || clientRecord.contactName || "");
  }, [clientRecord]);

  const orgRef = useRef<SVGSVGElement>(null);

  const researcherList = researchers.split(",").map((s) => s.trim()).filter(Boolean);
  const assistantList = assistants.split(",").map((s) => s.trim()).filter(Boolean);
  const managerList = managers.split(",").map((s) => s.trim()).filter(Boolean);

  return (
    <Layout
      title="조직도 / 도면 생성"
      subtitle="입력값으로 신고용 조직도·도면을 만들고 JPEG/PDF로 저장합니다"
    >
      <PageGuide
        id="org-diagram"
        purpose="신고용 회사 조직도와 연구공간 도면 초안을 만듭니다."
        when="설립서류에 넣을 조직도·도면이 필요할 때 사용합니다."
        result="JPEG 조직도, JPEG 도면, PDF 출력물, 사진촬영 가이드를 얻습니다."
        steps={["조직도 입력", "도면 크기 설정", "공간·기자재 배치", "JPEG/PDF 저장", "사진 촬영"]}
      />
      <div className="mx-auto grid max-w-[1140px] grid-cols-1 gap-5">
        {/* ════════ 조직도 ════════ */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-card">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="whitespace-nowrap text-xl font-bold text-slate-900">회사 / 연구소 조직도</h2>
            <p className="mt-0.5 text-base text-slate-500">설립신고 구비서류 ⑥ 조직도</p>
          </div>
          <div className="space-y-4 p-5">
            <div className="grid grid-cols-2 gap-3">
              <Field label="회사명"><input className={INPUT} value={company} onChange={(e) => setCompany(e.target.value)} /></Field>
              <Field label="대표자명"><input className={INPUT} value={ceo} onChange={(e) => setCeo(e.target.value)} /></Field>
            </div>

            {/* 일반부서 입력 — 부서명 크게 / 인원 작게 */}
            <div className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <p className="text-base font-bold text-slate-800">일반부서 입력</p>
                <button
                  type="button"
                  onClick={() => setDepts((d) => [...d, { name: "", count: 1 }])}
                  className="whitespace-nowrap rounded-lg bg-navy-700 px-4 py-2 text-base font-bold text-white hover:bg-navy-800"
                >
                  + 부서 추가
                </button>
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                연구소는 기업의 하부조직이어야 하므로, 경영지원팀·영업팀·생산팀 등 일반부서와
                연구소 조직이 함께 보이도록 구성하는 것이 좋습니다.
              </p>
              <div className="mt-3 grid grid-cols-[1fr_88px_40px] items-end gap-2">
                <p className="text-sm font-bold text-slate-500">부서명</p>
                <p className="whitespace-nowrap text-center text-sm font-bold text-slate-500">인원</p>
                <span />
                {depts.map((d, i) => (
                  <Frag key={i}>
                    <input
                      className={`${INPUT} !mt-0 text-lg font-semibold`}
                      placeholder={i === 0 ? "예) 경영지원팀" : i === 1 ? "예) 영업팀" : "부서명 입력"}
                      value={d.name}
                      onChange={(e) => setDepts((arr) => arr.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                    />
                    <input
                      type="number" min={0}
                      className={`${INPUT} !mt-0 text-center`}
                      value={d.count}
                      onChange={(e) => setDepts((arr) => arr.map((x, j) => j === i ? { ...x, count: Number(e.target.value) } : x))}
                    />
                    {depts.length > 1 ? (
                      <button type="button" onClick={() => setDepts((arr) => arr.filter((_, j) => j !== i))} className="rounded-lg border border-slate-200 py-2 text-base text-slate-400 hover:border-red-200 hover:text-status-danger">✕</button>
                    ) : <span />}
                  </Frag>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-2">
              <Field label="연구소장"><input className={INPUT} value={labHead} onChange={(e) => setLabHead(e.target.value)} /></Field>
              <Field label="연구전담요원 (쉼표 구분)"><input className={INPUT} value={researchers} onChange={(e) => setResearchers(e.target.value)} /></Field>
              <Field label="연구보조원 (쉼표 구분)"><input className={INPUT} value={assistants} onChange={(e) => setAssistants(e.target.value)} /></Field>
              <Field label="연구관리직원 (쉼표 구분)"><input className={INPUT} value={managers} onChange={(e) => setManagers(e.target.value)} /></Field>
            </div>

            <div className="rounded-xl border border-dashed border-slate-300 p-4">
              <label className={LABEL}>4대보험 가입자 명부 업로드</label>
              <input type="file" onChange={(e) => setInsuranceFile(e.target.files?.[0]?.name ?? null)} className="mt-1.5 block w-full min-w-0 max-w-full text-base text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-navy-50 file:px-4 file:py-2 file:text-base file:font-bold file:text-navy-700" />
              <p className="mt-1.5 text-sm text-slate-500">
                {insuranceFile ? `첨부됨: ${insuranceFile} · 추후 자동분석 예정` : "업로드 시 추후 연구원 자동 분류에 활용될 예정입니다."}
              </p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
              <OrgChartSvg innerRef={orgRef} company={company} ceo={ceo} depts={depts} labHead={labHead} researchers={researcherList} assistants={assistantList} managers={managerList} />
            </div>

            {/* 범례 — 화면 표시용(출력물 미포함) */}
            <p className="print-hide text-sm font-semibold text-slate-600">
              전담 = 연구전담요원 · 보조 = 연구보조원 · 관리 = 연구관리직원 — 연구전담요원·보조원은 타 업무 겸직 불가
            </p>

            <div className="flex gap-2">
              <button type="button" onClick={() => downloadSvgAsJpeg(orgRef.current, `${company}_조직도.jpg`)} className="flex-1 whitespace-nowrap rounded-xl bg-navy-700 px-4 py-3 text-base font-bold text-white hover:bg-navy-800">JPEG 다운로드</button>
              <button type="button" onClick={() => printSvg(orgRef.current, `${company} 조직도`)} className="flex-1 whitespace-nowrap rounded-xl border border-navy-200 px-4 py-3 text-base font-bold text-navy-700 hover:bg-navy-50">PDF 저장 (인쇄)</button>
            </div>
          </div>
        </section>

        {/* ════════ 도면 (FloorPlanner) ════════ */}
        <section className="rounded-2xl border border-slate-200 bg-white shadow-card">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="whitespace-nowrap text-xl font-bold text-slate-900">층 전체 / 연구소 도면</h2>
            <p className="mt-0.5 text-base text-slate-500">
              설립신고 구비서류 ⑦ — 도면 편집(공간·요소) → 출력 미리보기
            </p>
          </div>
          <div className="p-5" data-testid="lab-floorplanner">
            <FloorPlanner company={company} />
          </div>
        </section>
      </div>

      {/* ════════ 사진촬영 가이드 (구비서류 ⑧) — 단일 체크리스트 카드 ════════ */}
      <section className="mx-auto mt-5 w-full max-w-[1140px] rounded-2xl border border-slate-200 bg-white shadow-card">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-xl font-bold text-slate-900">현판·내부 사진촬영 가이드</h2>
          <p className="mt-0.5 text-base text-slate-500">신고 전 아래 구도로 사진을 준비하면 보완 요청을 줄일 수 있습니다.</p>
        </div>
        <ul className="divide-y divide-slate-100 px-5">
          {PHOTO_GUIDE.map((g) => (
            <li key={g.key} className="flex items-start gap-3 py-2.5">
              <span className="mt-0.5 shrink-0 text-status-normal">✓</span>
              <p className="text-base leading-relaxed text-slate-700">
                <span className="font-bold text-navy-800">{g.label}</span>
                <span className="text-slate-500"> — {g.desc}</span>
              </p>
            </li>
          ))}
        </ul>
        <div className="grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-2">
          <div className="rounded-xl border border-green-200 bg-status-normalBg/60 p-4">
            <p className="text-base font-bold text-status-normal">좋은 예</p>
            <ul className="mt-1.5 space-y-1 text-base leading-relaxed text-slate-700">
              {PHOTO_GOOD.map((t) => <li key={t}>· {t}</li>)}
            </ul>
          </div>
          <div className="rounded-xl border border-red-200 bg-status-dangerBg/60 p-4">
            <p className="text-base font-bold text-status-danger">피할 것</p>
            <ul className="mt-1.5 space-y-1 text-base leading-relaxed text-slate-700">
              {PHOTO_BAD.map((t) => <li key={t}>· {t}</li>)}
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-5 flex w-full max-w-[1140px] flex-wrap items-center justify-between gap-3 rounded-2xl border border-navy-100 bg-navy-50 px-5 py-4">
        <p className="text-base font-bold text-navy-800">설립서류 체크리스트와 연결됩니다 (다음 단계)</p>
        <Link href="/setup-documents" className="whitespace-nowrap rounded-xl bg-navy-700 px-5 py-2.5 text-base font-bold text-white hover:bg-navy-800">설립서류 관리로 →</Link>
      </section>
    </Layout>
  );
}

/* ═══════════════════ 공용 ═══════════════════ */

const INPUT = "mt-1 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-base focus:border-navy-600 focus:outline-none focus:ring-1 focus:ring-navy-600";
const LABEL = "text-sm font-bold text-slate-600";

function Frag({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className={`${LABEL} whitespace-nowrap`}>{label}</label>{children}</div>;
}

/* ═══════════════════ 조직도 SVG ═══════════════════ */

function OrgChartSvg({
  innerRef, company, ceo, depts, labHead, researchers, assistants, managers,
}: {
  innerRef: React.Ref<SVGSVGElement>;
  company: string; ceo: string; depts: Dept[]; labHead: string;
  researchers: string[]; assistants: string[]; managers: string[];
}) {
  const cols = depts.length + 1;
  const colW = 158;
  const gap = 18;
  const totalW = Math.max(560, cols * colW + (cols - 1) * gap + 48);
  const startX = (totalW - (cols * colW + (cols - 1) * gap)) / 2;
  const labX = startX + depts.length * (colW + gap);
  const labMembers = [
    ...researchers.map((r) => ({ t: "전담", n: r, c: "#1d4ed8" })),
    ...assistants.map((a) => ({ t: "보조", n: a, c: "#7c3aed" })),
    ...managers.map((m) => ({ t: "관리", n: m, c: "#64748b" })),
  ];
  const labBoxH = 92 + labMembers.length * 30;
  const totalH = 150 + Math.max(110, labBoxH) + 16;
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, ".");

  return (
    <svg ref={innerRef} viewBox={`0 0 ${totalW} ${totalH}`} className="w-full rounded-lg bg-white ring-1 ring-slate-200">
      <rect x="0" y="0" width={totalW} height="44" fill="#13233b" />
      <text x="20" y="28" fontSize="17" fontWeight="bold" fill="#ffffff">{company} 조직도</text>
      <text x={totalW - 20} y="19" fontSize="11" fill="#cbd5e1" textAnchor="end">설립신고 첨부용 조직도 초안</text>
      <text x={totalW - 20} y="35" fontSize="11" fill="#94a3b8" textAnchor="end">작성일 {today}</text>

      <rect x={totalW / 2 - 90} y={60} width="180" height="44" rx="10" fill="#1b2d49" />
      <text x={totalW / 2} y={79} fontSize="11" fill="#93c5fd" textAnchor="middle">대표이사</text>
      <text x={totalW / 2} y={96} fontSize="15" fontWeight="bold" fill="#ffffff" textAnchor="middle">{ceo || "-"}</text>

      <line x1={totalW / 2} y1={104} x2={totalW / 2} y2={126} stroke="#94a3b8" strokeWidth="1.5" />
      <line x1={startX + colW / 2} y1={126} x2={labX + colW / 2} y2={126} stroke="#94a3b8" strokeWidth="1.5" />

      {depts.map((d, i) => {
        const x = startX + i * (colW + gap);
        return (
          <g key={i}>
            <line x1={x + colW / 2} y1={126} x2={x + colW / 2} y2={146} stroke="#94a3b8" strokeWidth="1.5" />
            <rect x={x} y={146} width={colW} height="54" rx="10" fill="#ffffff" stroke="#cbd5e1" strokeWidth="1.5" />
            <rect x={x} y={146} width={colW} height="7" fill="#cbd5e1" />
            <text x={x + colW / 2} y={174} fontSize="14" fontWeight="bold" fill="#334155" textAnchor="middle">{d.name || "부서"}</text>
            <text x={x + colW / 2} y={192} fontSize="12" fill="#64748b" textAnchor="middle">{d.count}명</text>
          </g>
        );
      })}

      <line x1={labX + colW / 2} y1={126} x2={labX + colW / 2} y2={146} stroke="#1d4ed8" strokeWidth="2" />
      <rect x={labX} y={146} width={colW} height={labBoxH} rx="12" fill="#eff6ff" stroke="#1d4ed8" strokeWidth="2.5" />
      <rect x={labX} y={146} width={colW} height="30" rx="10" fill="#1d4ed8" />
      <text x={labX + colW / 2} y={166} fontSize="13" fontWeight="bold" fill="#ffffff" textAnchor="middle">연구소 / 전담부서</text>
      <rect x={labX + 14} y={186} width={colW - 28} height="32" rx="8" fill="#ffffff" stroke="#1d4ed8" strokeWidth="1.5" />
      <text x={labX + colW / 2} y={207} fontSize="13" fontWeight="bold" fill="#1d4ed8" textAnchor="middle">연구소장 {labHead || "-"}</text>
      {labMembers.map((m, i) => (
        <g key={i}>
          <rect x={labX + 14} y={228 + i * 30} width={colW - 28} height="24" rx="6" fill="#ffffff" stroke="#dbeafe" />
          <rect x={labX + 18} y={232 + i * 30} width="34" height="16" rx="4" fill={m.c} />
          <text x={labX + 35} y={244 + i * 30} fontSize="10" fontWeight="bold" fill="#ffffff" textAnchor="middle">{m.t}</text>
          <text x={labX + 60} y={245 + i * 30} fontSize="12" fill="#1e293b">{m.n}</text>
        </g>
      ))}
    </svg>
  );
}
