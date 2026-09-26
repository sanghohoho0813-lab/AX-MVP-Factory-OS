import React, { useState, useEffect, useCallback, createContext, useContext } from "react";
import { useSearchParams } from "react-router-dom"; // [D-94] 하단 탭 = 주소(?view=) → 브라우저 뒤로 가기로 탭을 오간다
import { CORE_LABELS, cretopTrendCommentRich, cretopCashflowGradeInfo, cretopRowTrend, cretopPreviewTone, CRETOP_PREVIEW_TONES } from "../engine/index.js";
import { extractPdfText } from "./pdf.js";
import { cretopYearPool, cretopFillYears } from "./years.js"; // [D-94]
import { brandHex, brandSync, useThemeRerender } from "../../shared/brandHex"; // [D-96] · [D-98] 테마 바로 따라가기
import { T as SHARED_T } from "./theme.js";
import { StockValue } from "./StockValue.jsx";
import { SV_EVENT } from "./stockValueCalc.js";
import { InfoModal, RawTextModal, DetailModal, StakeModal } from "./DetailPopups.jsx";
import { isCorpOnlyStrategy } from "./extract.js";
import { formatPopupSection, CEO_PERSONAL_LABELS, WORK_BASIC_LABELS, WORK_DETAIL_LABELS } from "./popupFormat.js";
import { getSelected, toggleSelected } from "./selection.js";
import { ratioKeys, num, ratioVal, lastStep, coreTrend, buildDiagnosisSummary, CONSULTING_CATEGORIES, CONSULTING_STRATEGIES, rankStrategies, buildMeetingQuestions, analyzeCretopText } from "./analysisCore.js";
import { meetingQuestionFlow, meetingDocs, meetingShort, meetingEffect } from "./meetingFlow.js";

/* ──────────────────────────────────────────────────────────────
   [D-93] 크레탑 원본 분석 앱(cretop-mini-app 브랜치 src/mini/MiniApp.jsx)을 그대로 옮긴 것.
   이 OS 에서 바꾼 것: 로그인·회원가입·무료체험 횟수·설문·관리자 화면은 뺐다(OS 로그인이 대신한다).
   분석 이력은 Supabase 대신 이 OS 의 모듈 기록(cretop/analyses)에 남고, 하단 탭은 화면 안에 붙는다.
   ──────────────────────────────────────────────────────────────
   법인 재무진단 미니앱 (PoC)
   - packages/cretop-engine만 사용하는 단독 셸. 영업 OS 화면/로직과 무관.
   - 로그인·회원가입·결제·저장·Supabase 없음. 입력→진단→표시만.
   - 의도적으로 OS(다크·골드)와 다른 밝은 단일제품 톤으로 구성.
   ────────────────────────────────────────────────────────────── */

const FF = "'Pretendard Variable','Pretendard',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";
const T = {
  bg: "#F8FAFC", surface: "#FFFFFF", ink: "#0F172A", sub: "#475569", mute: "#94A3B8",
  // [D-96] 강조색은 OS 테마를 따른다(원본 #1D4ED8·#EFF4FF). 등급·단계 색은 뜻이 있어 그대로 둔다
  line: "#E2E8F0", lineSoft: "#EEF2F7", brand: brandHex("700", "#1D4ED8"), brandSoft: brandHex("50", "#EFF4FF"),
  teal: "#0D9488", up: "#0F766E", down: "#B91C1C", flat: "#64748B",
  warnBg: "#FEF2F2", warnInk: "#B91C1C", okBg: "#ECFDF5", okInk: "#047857",
};

const card = { background: T.surface, border: `1px solid ${T.line}`, borderRadius: "var(--radius-panel)", boxShadow: "var(--shadow-card)" }; // [D-97] OS 카드 규격
// [D-119] 규칙 계산은 analysisCore.js 로 옮겼다 — 다시 내보내 예전 import 가 그대로 동작한다
export * from "./analysisCore.js";

// [D-113] 휴대폰(640px 미만) — 핵심지표 3칸 · 기본정보 2칸 · 작은 글씨로 한 화면에 더 많이
const NarrowCtx = createContext(false);
const useNarrow = () => useContext(NarrowCtx);

function Section({ id, title, desc, children }) {
  return (
    <section id={id} style={{ marginTop: 22, scrollMarginTop: 12 }}>
      {/* [D-113] 제목은 한 줄로 두고 설명은 옆 → 좁으면 아래로 (예전: 좁은 칸에서 '기업 / 개요' 처럼 제목이 쪼개졌다) */}
      <div style={{ display: "flex", alignItems: "baseline", gap: "2px 10px", marginBottom: 10, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0, fontSize: "calc(17px * var(--fs,1))", fontWeight: 800, color: T.ink, whiteSpace: "nowrap" }}>{title}</h2>
        {desc && <span style={{ fontSize: "calc(12px * var(--fs,1))", color: T.mute, minWidth: 0 }}>{desc}</span>}
      </div>
      {children}
    </section>
  );
}

// 신용등급 — OS 동일 방식(소문자 모의평가 / 대문자 정식 신용평가 / 미확인). 등급별 색상·상태.
const GRADE_GROUPS = [
  ["모의평가 등급(소문자)", ["a", "bbb", "bb", "b", "ccc 이하"]],
  ["정식 신용평가 등급(대문자)", ["A", "BBB", "BB", "B", "CCC 이하"]],
];
export function gradeTone(g) {
  const s = String(g || "").trim().toUpperCase();
  if (!s || s === "미확인" || s.includes("확인")) return { color: "#64748B", status: "미확인", bg: "#F1F5F9", bd: "#E2E8F0" };
  if (/^A/.test(s)) return { color: "#6D28D9", status: "매우 우수", bg: "#F5F3FF", bd: "#DDD6FE" };
  if (/^BBB/.test(s)) return { color: "#1D4ED8", status: "우수", bg: "#EFF6FF", bd: "#BFDBFE" };
  if (/^BB/.test(s)) return { color: "#15803D", status: "양호", bg: "#F0FDF4", bd: "#BBF7D0" };
  if (/^C/.test(s)) return { color: "#B91C1C", status: "위험", bg: "#FEF2F2", bd: "#FECACA" };
  if (/^B/.test(s)) return { color: "#B45309", status: "주의", bg: "#FFFBEB", bd: "#FDE68A" };
  return { color: "#64748B", status: "미확인", bg: "#F1F5F9", bd: "#E2E8F0" };
}
// 원문 등급 → 셀렉트 기본 옵션(대소문자 보존: 원문이 소문자면 모의평가 옵션으로)
export function gradeToOption(parsed) {
  const raw = String(parsed || "").trim();
  if (!raw || raw.includes("확인")) return "미확인";
  const lower = /[a-z]/.test(raw) && !/[A-Z]/.test(raw);
  const s = raw.toUpperCase();
  let base;
  if (/^A/.test(s)) base = "A";                 // AAA/AA/A → A(최고 등급)
  else if (/^BBB/.test(s)) base = "BBB"; else if (/^BB/.test(s)) base = "BB"; else if (/^B/.test(s)) base = "B";
  else if (/^C/.test(s)) base = "CCC 이하"; else return "미확인";
  return lower ? base.toLowerCase() : base;
}
/* [D-113] 핵심지표 카드 크기 — 기본 · 요약(dense) · 휴대폰 3칸(narrow).
   narrow 는 이름표 위 · 값 · 태그 아래로 쌓는다(한 칸이 100px 남짓이라 이름표와 태그가 한 줄에 안 들어간다).
   값이 칸보다 길면 글자를 조금 줄여서라도 끝까지 보이게(… 로 자르지 않음). */
function coreCardSize(dense, narrow) {
  if (narrow) return { pad: "8px 8px", label: 9.5, tag: 8, val: 13, weakVal: 10, sub: 8.5, gap: 3, stack: true };
  const f = dense ? 0.74 : 1;
  // 넓은 화면도 '원문 확인 필요' 는 작게 줄바꿈 — 예전에는 '원문 확…' 으로 잘렸다
  return { pad: dense ? "7px 9px" : "12px 14px", label: 12 * f, tag: 9.5 * f, val: 21 * f, weakVal: 13 * f, sub: 11 * f, gap: dense ? 2 : 5, stack: false };
}
function CardTag({ text, color, z }) {
  return <span style={{ fontSize: `calc(${z.tag}px * var(--fs,1))`, fontWeight: 800, color, background: "#fff", border: `1px solid ${color}55`, borderRadius: 5, padding: "0 5px", whiteSpace: "nowrap", alignSelf: "flex-start" }}>{text}</span>;
}
function CardHead({ label, tag, z }) {
  if (z.stack) return <div style={{ fontSize: `calc(${z.label}px * var(--fs,1))`, color: T.sub, fontWeight: 700, lineHeight: 1.25, wordBreak: "keep-all" }}>{label}</div>;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 5 }}>
      <span style={{ fontSize: `calc(${z.label}px * var(--fs,1))`, color: T.sub, fontWeight: 700 }}>{label}</span>
      {tag}
    </div>
  );
}
function CardValue({ val, color, weak, z }) {
  // 긴 값(약 2,022만원 · 1,298.25% 등)은 조금 작게 — 칸 밖으로 잘리지 않게
  const long = String(val).length > 7;
  const size = weak ? z.weakVal : long ? z.val * 0.82 : z.val;
  const wrap = z.stack || weak;
  return <div style={{ fontSize: `calc(${size}px * var(--fs,1))`, fontWeight: 800, color, marginTop: z.gap, lineHeight: 1.2, ...(wrap ? { overflowWrap: "anywhere", letterSpacing: "-0.02em" } : { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }) }}>{val}</div>;
}

// 핵심지표 신용등급 카드 — 선택/원문 등급 + 색상·상태
function GradeCard({ grade, dense }) {
  const z = coreCardSize(dense, useNarrow());
  const t = gradeTone(grade);
  const show = grade && grade !== "미확인";
  const tag = <CardTag text={t.status} color={t.color} z={z} />;
  return (
    <div style={{ ...card, padding: z.pad, background: t.bg, borderColor: t.bd, minWidth: 0 }}>
      <CardHead label="신용등급" tag={tag} z={z} />
      <CardValue val={show ? grade : "미확인"} color={show ? t.color : T.mute} weak={!show} z={z} />
      {z.stack ? <div style={{ marginTop: 4 }}>{tag}</div> : null}
    </div>
  );
}

// 핵심지표(최근 연도) — 현재 상태를 한눈에 보는 간결 카드. 의미 기반 레벨 색상 + 태그.
const CORE_SUMMARY_KEYS = ["revenue", "operatingProfit", "netIncome", "totalAssets", "totalLiabilities", "totalEquity", "cash", "shortTermBorrowings", "longTermBorrowings", "retainedEarnings", "debtRatio", "currentRatio", "interestCoverageRatio", "creditGrade", "cashflowGrade"];
const CORE_LABEL2 = { creditGrade: "신용등급", cashflowGrade: "현금흐름등급" };
const coreLabel = (k) => CORE_LABEL2[k] || CORE_LABELS[k] || k;

// 최근 연도 표시값
function coreLatestText(key, obj) {
  if (key === "creditGrade") { const v = obj && obj.value; const ok = v && v !== "이미지 원문 확인 필요"; return { val: ok ? v : "원문 확인 필요", weak: !ok }; }
  if (key === "cashflowGrade") { const v = obj && obj.latest; return { val: v || "원문 확인 필요", weak: !v }; }
  if (obj && obj.absent) return { val: "미보유", note: "원문에 차입금 계정 없음(0원)" };
  const isR = !!(obj && obj.isRatio) || ratioKeys.has(key);
  if (isR) { const v = obj && obj.value; return typeof v === "number" ? { val: `${num(v)}${obj.unit || "%"}` } : { val: "원문 확인 필요", weak: true }; }
  if (obj && typeof obj.eok === "number") return { val: fmtTrendVal(obj.eok, "억원") };
  const v = obj && obj.value; if (typeof v === "number") return { val: `${num(v)}${obj.unit || ""}` };
  return { val: "원문 확인 필요", weak: true };
}
// 태그 = 직전연도 대비 방향(증가/감소/변동없음). 일부 지표는 임계값 기반 양호/위험 판정도 함께.
//  * 값/추이/엔진 로직은 읽기만(무수정). 표시 문구·색상만 구성.
const TONE_GOOD = { fg: "#15803D", bg: "#F0FDF4", bd: "#BBF7D0" };
const TONE_BAD = { fg: "#B91C1C", bg: "#FEF2F2", bd: "#FECACA" };
const TONE_WARN = { fg: "#B45309", bg: "#FFFBEB", bd: "#FDE68A" };
const TONE_NEU = { fg: "#64748B", bg: "#FFFFFF", bd: "#E2E8F0" };
// 부채비율/유동비율/이자보상배수 임계값 판정
function ratioVerdict(key, obj) {
  const v = obj && typeof obj.value === "number" ? obj.value : null;
  if (v == null) return null;
  if (key === "debtRatio") return v < 200 ? "양호" : "위험";          // 부채비율 200% 미만 양호
  if (key === "currentRatio") return v > 200 ? "양호" : "위험";        // 유동비율 200% 초과 양호
  if (key === "interestCoverageRatio") return v <= 2 ? "위험" : "양호"; // 이자보상배수 2배 이하 위험
  return null;
}
// 현금흐름등급(CR1~CR6) → 등급 판정
function cashflowVerdict(grade) { const m = String(grade || "").match(/CR\s*([1-6])/i); return m ? ({ 1: "매우우수", 2: "우수", 3: "양호", 4: "양호", 5: "주의", 6: "위험" })[+m[1]] : null; }
const verdictPal = (v) => v === "위험" ? TONE_BAD : v === "주의" ? TONE_WARN : TONE_GOOD;   // 양호/우수/매우우수=초록
function coreToneOf(key, obj) {
  if (key === "cashflowGrade") { const cv = cashflowVerdict(obj && obj.latest); return cv ? { ...verdictPal(cv), tag: cv } : null; }
  // 방향(증가/감소/변동없음 또는 흑자전환 등 전환어)
  const st = lastStep(coreTrend(key, obj));
  let dir = null;
  if (st) { if (st.transition) dir = st.transition; else if (st.dir === "상승") dir = "증가"; else if (st.dir === "하락") dir = "감소"; else dir = "변동없음"; }
  // 임계값 3지표: 방향 + 양호/위험
  const verdict = ratioVerdict(key, obj);
  if (verdict) { const tag = (dir && dir !== "변동없음") ? `${dir}·${verdict}` : verdict; return { ...verdictPal(verdict), tag }; }
  // 그 외: 색은 기존 의미(개선/악화) 유지, 단어는 방향
  let pal = null;
  const tn = cretopPreviewTone(key, obj, null);
  if (tn) { const b = CRETOP_PREVIEW_TONES[tn]; pal = (tn === "blue" || tn === "purple") ? TONE_GOOD : { fg: b.fg, bg: b.bg, bd: b.bd }; }
  else if (st) { const col = stepSemColor(st, key, coreLabel(key)); pal = col === SEM.good ? TONE_GOOD : col === SEM.bad ? TONE_BAD : col === SEM.warn ? TONE_WARN : null; }
  if (!pal) return (dir && dir !== "변동없음") ? { ...TONE_NEU, tag: dir } : null;
  return { ...pal, tag: dir };
}
function CoreCard({ keyName, obj, sub, dense }) {
  const z = coreCardSize(dense, useNarrow());
  const label = coreLabel(keyName);
  const { val, weak, note } = coreLatestText(keyName, obj);
  const tone = weak ? null : coreToneOf(keyName, obj);
  const fg = tone ? tone.fg : (weak ? T.mute : T.ink);
  const tag = tone && tone.tag ? <CardTag text={tone.tag} color={tone.fg} z={z} /> : null;
  return (
    <div data-core-card={keyName} style={{ ...card, padding: z.pad, background: tone ? tone.bg : T.surface, borderColor: tone ? tone.bd : T.line, minWidth: 0 }}>
      <CardHead label={label} tag={tag} z={z} />
      <CardValue val={weak && z.stack ? "원문 확인" : val} color={fg} weak={weak} z={z} />
      {z.stack && tag ? <div style={{ marginTop: 4 }}>{tag}</div> : null}
      {sub ? <div style={{ fontSize: `calc(${z.sub}px * var(--fs,1))`, fontWeight: 600, color: T.mute, marginTop: 2, lineHeight: 1.3 }}>{sub}</div> : null}
      {note ? <div style={{ fontSize: `calc(${z.sub}px * var(--fs,1))`, color: T.mute, marginTop: 2, lineHeight: 1.3 }}>{note}</div> : null}
    </div>
  );
}
// 표시 전용: 최신 연도 영업이익률/당기순이익률(억 단위 값에서만 산출). 매출 0/없으면 미표시. 금액·파싱 무수정.
function marginSub(keyName, cp) {
  if (keyName !== "operatingProfit" && keyName !== "netIncome") return null;
  const rev = cp.revenue && typeof cp.revenue.eok === "number" ? cp.revenue.eok : null;
  const o = cp[keyName];
  const amt = o && typeof o.eok === "number" ? o.eok : null;
  if (rev == null || rev === 0 || amt == null) return null;
  const pct = Math.round((amt / rev) * 100 * 100) / 100;   // 소수 둘째 자리 반올림
  return `${keyName === "operatingProfit" ? "영업이익률" : "당기순이익률"} ${pct}%`;
}

// 예상 법인세(단순 추정) — 당기순이익을 과세표준으로 가정한 누진세율 + 지방소득세(법인세의 10%)
export function estCorpTaxWon(niEok) {
  if (typeof niEok !== "number" || niEok <= 0) return 0;
  const x = niEok * 1e8; // 원
  let base;
  if (x <= 2e8) base = x * 0.09;
  else if (x <= 200e8) base = 0.18e8 + (x - 2e8) * 0.19;          // 2억 이하분 1,800만 + 초과분 19%
  else if (x <= 3000e8) base = 0.18e8 + 198e8 * 0.19 + (x - 200e8) * 0.21;
  else base = 0.18e8 + 198e8 * 0.19 + 2800e8 * 0.21 + (x - 3000e8) * 0.24;
  return base * 1.1; // 지방소득세(법인세의 10%) 포함
}
function fmtTaxWon(won) {
  if (won <= 0) return "약 0원";
  if (won < 1e8) return "약 " + Math.round(won / 1e4).toLocaleString() + "만원";
  return "약 " + (Math.round(won / 1e7) / 10).toLocaleString() + "억원";
}
// 예상 법인세 카드(추정치 · 정보)
function TaxCard({ cp, dense }) {
  const ni = cp.netIncome;
  const niEok = ni && typeof ni.eok === "number" ? ni.eok : null;
  const neg = typeof niEok === "number" && niEok < 0;
  const z = coreCardSize(dense, useNarrow());
  // 휴대폰 3칸에서는 '약' 을 빼고(태그 '추정' 이 같은 뜻) 금액만 — '약 / 2,022만원' 으로 쪼개지던 것
  const full = niEok == null ? (z.stack ? "원문 확인" : "원문 확인 필요") : neg ? "약 0원(적자)" : fmtTaxWon(estCorpTaxWon(niEok));
  const val = z.stack && !neg && niEok != null ? full.replace(/^약\s*/, "") : full;
  const tag = <CardTag text="추정" color={T.flat} z={z} />;
  return (
    <div data-core-card="tax" style={{ ...card, padding: z.pad, borderStyle: "dashed", minWidth: 0 }}>
      <CardHead label="예상 법인세" tag={tag} z={z} />
      <CardValue val={val} color={niEok == null ? T.mute : T.ink} weak={niEok == null} z={z} />
      {z.stack ? <div style={{ marginTop: 4 }}>{tag}</div> : null}
      <div style={{ fontSize: `calc(${z.sub}px * var(--fs,1))`, color: T.mute, marginTop: 2, lineHeight: 1.3 }}>{z.stack ? "당기순이익 기준 단순 추정" : "당기순이익 기준 단순 추정(법인세+지방소득세)"}</div>
    </div>
  );
}

// 설립일 → 업력(년). 현재월 기준 경과연수.
function bizAgeYears(established) {
  const m = String(established || "").match(/((?:19|20)\d{2})[-.\/]?(\d{1,2})?/);
  if (!m) return null;
  const ey = +m[1], em = +(m[2] || 1), now = new Date();
  const y = now.getFullYear() - ey - (em > (now.getMonth() + 1) ? 1 : 0);
  return (y >= 0 && y < 200) ? y : null;
}
function CoreGrid({ ui, grade, lastY, compact }) {
  const narrow = useNarrow();
  const cp = ui.corePreview || {};
  const co = ui.companyInfo || {};
  const personal = !!(ui.bizForm && ui.bizForm.isPersonal);
  const bizType = personal ? "개인사업자" : (co.corpType || "법인");
  const age = bizAgeYears(co.established);
  const industry = co.industry11 || co.stdIndustry11 || co.standardIndustry || co.industry || co.mainProduct || null;
  const infoChip = { fontSize: "calc(13.5px * var(--fs,1))", fontWeight: 800, color: T.ink, background: "#fff", border: `1px solid ${T.line}`, borderRadius: 9, padding: "6px 13px", whiteSpace: "nowrap" };
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {!compact ? <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <span style={{ fontSize: "calc(12.5px * var(--fs,1))", fontWeight: 800, color: T.brand, background: T.brandSoft, border: `1px solid ${T.brand}22`, borderRadius: 999, padding: "5px 12px" }}>📅 크레탑 상 최신 자료: {lastY ? `${lastY}년 결산 기준` : "최근 결산 기준"}</span>
        <div style={{ flexBasis: "100%", height: 0 }} />
        {/* [D-113] 휴대폰은 한 줄 요약 — 긴 설명 상자가 지표보다 먼저 화면을 차지했다 */}
        {narrow
          ? <span style={{ fontSize: "calc(10px * var(--fs,1))", fontWeight: 700, color: T.sub, lineHeight: 1.5 }}>최신 연도 값 · 태그 = 전년 대비 <b style={{ color: T.up }}>증가</b>/<b style={{ color: T.down }}>감소</b> · 비율은 <b>양호/주의/위험</b></span>
          : <span style={{ fontSize: "calc(11.5px * var(--fs,1))", fontWeight: 700, color: "#3B5BA9", background: T.brandSoft, border: `1px solid ${T.brand}1A`, borderRadius: 8, padding: "5px 11px", lineHeight: 1.5 }}>각 지표는 <b>최신 연도 기준</b>이며, 직전연도 대비 <b style={{ color: T.up }}>증가</b>·<b style={{ color: T.down }}>감소</b>·<b style={{ color: T.flat }}>변동없음</b>을 표시합니다. 부채비율·유동비율·이자보상배수·현금흐름등급은 <b>양호/주의/위험</b> 판정도 함께 표시합니다.</span>}
      </div> : null}
      {/* 회사 한눈에 — 기업유형 · 업력 · 업종(요약 브리핑에서는 숨김) */}
      {!compact ? <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        <span style={infoChip}>🏢 {bizType}</span>
        {age != null ? <span style={infoChip}>📅 업력 {age}년{co.established ? ` (${String(co.established).slice(0, 4)}년 설립)` : ""}</span> : null}
        {industry ? <span style={{ ...infoChip, whiteSpace: "normal", color: T.sub }}>🏭 {industry}</span> : null}
      </div> : null}
      {/* [D-113] 휴대폰은 3칸 — 예전에는 한 칸에 하나씩 세로로 길게 내려갔다 */}
      <div data-testid="cretop-core-grid" style={{ display: "grid", gridTemplateColumns: narrow ? "repeat(3,minmax(0,1fr))" : `repeat(auto-fill,minmax(min(100%,${compact ? 124 : 160}px),1fr))`, gap: narrow ? 6 : compact ? 6 : 10 }}>
        {CORE_SUMMARY_KEYS.map((key) => key === "creditGrade" ? <GradeCard key={key} grade={grade} dense={compact} /> : <CoreCard key={key} keyName={key} obj={cp[key]} sub={marginSub(key, cp)} dense={compact} />)}
        <TaxCard cp={cp} dense={compact} />
      </div>
    </div>
  );
}

/* ── 변화 포착 핵심: 모든 3개년 값에 [연도 → 증감액/증감률 → 연도] 스택 + 의미 색상 ──
   의미 색상: 개선=초록 / 악화=빨강 / 적자폭 축소=주황 / 변화없음=회색.
   '내려갈수록 좋은' 항목(부채·차입금·의존도)은 감소를 초록(개선)으로 칠한다. */
const SEM = { good: "#15803D", bad: "#B91C1C", warn: "#B45309", neutral: "#64748B" };
const DOWN_GOOD = new Set(["totalLiabilities", "debtRatio", "shortTermBorrowings", "longTermBorrowings", "debtDependency", "debtToSales", "ebitdaToDebt"]);
function downIsGood(key, label) {
  if (key && DOWN_GOOD.has(key)) return true;
  return /부채|차입금|차입부채|의존도|매입채무|미지급|사채|선수금/.test(String(label || ""));
}
// step(전년 대비 변화)의 개선/악화 색
function stepSemColor(st, key, label) {
  if (!st) return SEM.neutral;
  if (st.transition) return st.transition === "흑자전환" ? SEM.good : st.transition === "적자폭 축소" ? SEM.warn : SEM.bad;
  if (st.dir === "유지" || st.dir == null) return SEM.neutral;
  const improved = downIsGood(key, label) ? st.dir === "하락" : st.dir === "상승";
  return improved ? SEM.good : SEM.bad;
}
// 항목 전체(최신 전년 대비) 색 — 헤드라인 값 강조용
function trendSemColor(t, key, label) {
  if (!t || !t.steps || !t.steps.length) return T.ink;
  return stepSemColor(t.steps[t.steps.length - 1], key, label);
}
function fmtTrendVal(v, unit) {
  if (v == null) return "—";
  if (typeof v !== "number") return String(v); // '흑자전환' 등 텍스트형
  if (unit === "억원") { if (v !== 0 && Math.abs(v) < 0.005) return (v < 0 ? "-" : "") + "0.01억↓"; return `${(Math.round(v * 100) / 100).toLocaleString()}억`; }
  return `${(Math.round(v * 100) / 100).toLocaleString()}${unit || ""}`;
}
const y2 = (y) => String(y == null ? "?" : y).slice(-2);
// [D-94] 이 보고서의 결산 연도 — 연도가 빈 칸을 표시할 때만 쓴다(years.js). 값·계산은 그대로.
const YearPoolCtx = createContext([]);

// 연도별 값 박스 — 타임라인의 메인(크게). 연도 + 실제 값.
function YearBox({ yr, body, neg, compact }) {
  return (
    <div style={{ flex: "1 1 0", minWidth: compact ? 80 : 96, textAlign: "center", background: "#F8FAFC", border: `1px solid ${T.lineSoft}`, borderRadius: 12, padding: compact ? "9px 8px" : "12px 10px" }}>
      <div style={{ color: T.mute, fontSize: compact ? 10.5 : 11.5, fontWeight: 700, letterSpacing: 0.2 }}>{yr == null ? "?" : yr + "년"}</div>
      <div style={{ fontWeight: 900, fontSize: compact ? 17 : 22, color: neg ? SEM.bad : T.ink, whiteSpace: "nowrap", marginTop: 2 }}>{body}</div>
    </div>
  );
}
// 증감 칩 — 보조(작게). 화살표 + 증감값(+상대%) 한 줄 알약. 연도 사이 중앙.
function ChangeChip({ main, sub, col, dir, compact }) {
  const arrow = dir === "상승" ? "▲" : dir === "하락" ? "▼" : "·";
  return (
    <div style={{ flexShrink: 0, alignSelf: "center", display: "inline-flex", alignItems: "center", gap: 3, background: col + "14", border: `1px solid ${col}40`, color: col, borderRadius: 999, padding: compact ? "2px 7px" : "3px 9px", fontWeight: 800, fontSize: compact ? 9.5 : 11, whiteSpace: "nowrap" }}>
      <span style={{ fontSize: compact ? 8 : 9 }}>{arrow}</span><span>{main}</span>{sub ? <span style={{ fontWeight: 700, opacity: 0.8 }}>{sub}</span> : null}
    </div>
  );
}
// 한 step → 칩. 금액형=억원증감 + 증감률(%) / 비율형=증감폭(%p·회·배) + 상대 변화율(%). 색=의미 기반.
function StepChip({ st, isRatio, unit, semKey, semLabel, prevVal, compact }) {
  const col = stepSemColor(st, semKey, semLabel);
  let main, sub;
  if (!isRatio) {
    main = `${st.deltaAbs > 0 ? "+" : ""}${fmtTrendVal(st.deltaAbs, unit)}`;
    sub = st.transition ? st.transition : (st.deltaPct != null ? `${st.deltaPct > 0 ? "+" : ""}${st.deltaPct}%` : "");
  } else {
    const diffUnit = unit === "%" ? "%p" : (unit || "");
    main = `${st.deltaAbs > 0 ? "+" : ""}${(Math.round(st.deltaAbs * 100) / 100).toLocaleString()}${diffUnit}`;
    const rel = (typeof prevVal === "number" && prevVal !== 0) ? Math.round((st.deltaAbs / Math.abs(prevVal)) * 1000) / 10 : null;
    sub = rel != null ? `${rel > 0 ? "+" : ""}${rel}%` : "";
  }
  const dir = st.transition ? (st.transition === "흑자전환" || st.transition === "적자폭 축소" ? "상승" : "하락") : st.dir;
  return <ChangeChip main={main} sub={sub} col={col} dir={dir} compact={compact} />;
}
// 연도 → 증감칩 → 연도 … 타임라인(가로). 모든 섹션 공용.
// 3개년 좌우 비교표 — 연도 열(grid 1fr×N, minWidth:0 → 모바일 좌우 스크롤 없음).
// 각 열: 연도 / 값(메인) / 전년 대비 증감(보조·작게). 색=의미 기반.
function TrendStack({ trend, semKey, semLabel, compact }) {
  const t = trend; if (!t || !t.series || !t.series.length) return null;
  const unit = t.unit; const isRatio = !!t.isRatio;
  const n = t.series.length;
  const shownYears = cretopFillYears(t.series.map((s) => s.year), n, useContext(YearPoolCtx)); // [D-94]
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${n}, minmax(0,1fr))`, gap: 6 }}>
      {t.series.map((s, i) => {
        const st = i > 0 ? t.steps[i - 1] : null; // 전년(i-1) → 올해(i)
        const neg = typeof s.val === "number" && s.val < 0;
        let txt = "", col = SEM.neutral, arrow = "";
        if (st) {
          col = stepSemColor(st, semKey, semLabel);
          arrow = st.dir === "상승" ? "▲" : st.dir === "하락" ? "▼" : "·";
          if (!isRatio) {
            const abs = `${st.deltaAbs > 0 ? "+" : ""}${fmtTrendVal(st.deltaAbs, unit)}`;
            const pct = st.transition ? st.transition : (st.deltaPct != null ? `${st.deltaPct > 0 ? "+" : ""}${st.deltaPct}%` : "");
            txt = pct ? `${abs} · ${pct}` : abs;
          } else {
            const du = unit === "%" ? "%p" : (unit || "");
            const abs = `${st.deltaAbs > 0 ? "+" : ""}${(Math.round(st.deltaAbs * 100) / 100).toLocaleString()}${du}`;
            const prev = t.series[i - 1].val;
            const rel = (typeof prev === "number" && prev !== 0) ? Math.round((st.deltaAbs / Math.abs(prev)) * 1000) / 10 : null;
            txt = rel != null ? `${abs} · ${rel > 0 ? "+" : ""}${rel}%` : abs;
          }
        }
        const tinted = !!st; // 전년 대비 변화가 있으면 박스 전체를 의미색으로
        return (
          <div key={i} style={{ minWidth: 0, textAlign: "center", background: tinted ? col + "1A" : "#F1F5F9", border: `1.5px solid ${tinted ? col + "66" : T.line}`, borderRadius: 10, padding: compact ? "7px 4px" : "9px 6px" }}>
            <div style={{ color: tinted ? col : T.sub, fontSize: "calc(11px * var(--fs,1))", fontWeight: 900 }}>{shownYears[i] == null ? "?" : shownYears[i] + "년"}</div>
            <div style={{ fontWeight: 900, fontSize: `calc(${compact ? 14 : 17}px * var(--fs,1))`, color: neg ? SEM.bad : T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{fmtTrendVal(s.val, unit)}</div>
            <div style={{ marginTop: 2, minHeight: 13, fontSize: "calc(9px * var(--fs,1))", fontWeight: 800, color: st ? col : "transparent", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{st ? `${arrow} ${txt}` : "·"}</div>
          </div>
        );
      })}
    </div>
  );
}

// 금액/비율 한 항목 행 — 항목명 + 최신값(의미색) + 좌우 비교표
function MetricRow({ row }) {
  const t = row.trend; if (!t || !t.series || !t.series.length) return null;
  const latestNeg = t.latest && typeof t.latest.val === "number" && t.latest.val < 0;
  return (
    <div style={{ display: "grid", gap: 5 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: "calc(12.5px * var(--fs,1))", fontWeight: 800, color: T.ink }}>{row.label}</span>
        <span style={{ fontSize: "calc(11.5px * var(--fs,1))", fontWeight: 800, color: latestNeg ? SEM.bad : trendSemColor(t, row.key, row.label) }}>{t.latest ? fmtTrendVal(t.latest.val, t.unit) : "—"}</span>
      </div>
      <TrendStack trend={t} semKey={row.key} semLabel={row.label} compact />
    </div>
  );
}
// 현금흐름등급 행 — 연도별 등급 + 개선/악화(보조)
function GradeRow({ row }) {
  const ser = row.gradeSeries || []; const yrs = cretopFillYears(row.years || [], ser.length, useContext(YearPoolCtx)); // [D-94]
  const gi = cretopCashflowGradeInfo(ser[ser.length - 1]);
  const gnum = (g) => { const n = parseInt(String(g).replace(/\D/g, ""), 10); return isNaN(n) ? null : n; };
  return (
    <div style={{ display: "grid", gap: 5 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: "calc(12.5px * var(--fs,1))", fontWeight: 800, color: T.ink }}>현금흐름등급</span>
        <span style={{ fontSize: "calc(10.5px * var(--fs,1))", fontWeight: 800, color: "#fff", background: gi.color, borderRadius: 6, padding: "1px 7px" }}>{ser[ser.length - 1]} · {gi.level}</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${ser.length}, minmax(0,1fr))`, gap: 6 }}>
        {ser.map((gv, i) => {
          let txt = "·", col = SEM.neutral;
          if (i > 0) { const a = gnum(ser[i - 1]), b = gnum(gv); const d = (a == null || b == null) ? "확인" : (b > a ? "악화" : b < a ? "개선" : "유지"); col = d === "악화" ? SEM.bad : d === "개선" ? SEM.good : SEM.neutral; txt = d; }
          const tinted = i > 0;
          return (
            <div key={i} style={{ minWidth: 0, textAlign: "center", background: tinted ? col + "1A" : "#F1F5F9", border: `1.5px solid ${tinted ? col + "66" : T.line}`, borderRadius: 10, padding: "7px 4px" }}>
              <div style={{ color: tinted ? col : T.sub, fontSize: "calc(11px * var(--fs,1))", fontWeight: 900 }}>{yrs[i] != null ? yrs[i] + "년" : "?"}</div>
              <div style={{ fontWeight: 900, fontSize: "calc(14px * var(--fs,1))", color: T.ink }}>{gv}</div>
              <div style={{ marginTop: 2, minHeight: 13, fontSize: "calc(9px * var(--fs,1))", fontWeight: 800, color: tinted ? col : "transparent" }}>{txt}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
// 3개년 추이 — 콤팩트 비교표(한 카드에 항목 행). 세로 카드 누적 지양.
function TrendBlock({ ui }) {
  const rows = (ui.trendRows || []).filter((r) => r.isGrade ? (r.gradeSeries && r.gradeSeries.length) : (r.trend && r.trend.series && r.trend.series.length && !r.missing));
  if (!rows.length) return <div style={{ ...card, padding: 16, color: T.mute, fontSize: "calc(13px * var(--fs,1))" }}>3개년 추이를 산출할 데이터가 부족합니다.</div>;
  return (
    <div style={{ ...card, padding: "10px 12px", display: "grid", gap: 12 }}>
      {rows.map((r, i) => (
        <div key={r.key} style={{ borderTop: i ? `1px solid ${T.lineSoft}` : "none", paddingTop: i ? 12 : 0 }}>
          {r.isGrade ? <GradeRow row={r} /> : <MetricRow row={r} />}
        </div>
      ))}
    </div>
  );
}

// ── 5대 재무비율: 엔진이 '보고서 재무비율 표'에서 추출한 값(ui.ratioAreas)을 그대로 사용 ──
// 영역·지표·순서는 고정 템플릿. 어떤 크레탑 PDF든 항상 5개 영역 × 3지표 × 3개년 박스를 동일하게 노출.
const RATIO_AREA_TEMPLATE = [
  { key: "growth", name: "성장성", hint: "매출·영업이익·자산이 어느 방향으로 움직이는지(증가율)를 추이로 확인합니다.", metrics: [
    { key: "salesGrowth", label: "매출액증가율", unit: "%" },
    { key: "opGrowth", label: "영업이익증가율", unit: "%" },
    { key: "assetGrowth", label: "총자산증가율", unit: "%" },
  ] },
  { key: "profit", name: "수익성", hint: "매출·자산 대비 이익 창출력(영업이익률·EBITDA마진·ROA).", metrics: [
    { key: "opMargin", label: "영업이익률", unit: "%" },
    { key: "ebitdaMargin", label: "EBITDA마진율", unit: "%" },
    { key: "roa", label: "총자산순이익률(ROA)", unit: "%" },
  ] },
  { key: "structure", name: "재무구조", hint: "차입 수준과 단기 지급능력의 안정성(차입금의존도·부채비율·유동비율).", metrics: [
    { key: "debtDependency", label: "차입금의존도", unit: "%" },
    { key: "debtRatio", label: "부채비율", unit: "%" },
    { key: "currentRatio", label: "유동비율", unit: "%" },
  ] },
  { key: "coverage", name: "부채상환능력", hint: "영업이익·EBITDA로 이자·차입금을 감당하는 수준.", metrics: [
    { key: "interestCoverageRatio", label: "이자보상배수", unit: "배" },
    { key: "ebitdaToDebt", label: "EBITDA/총차입금", unit: "배" },
    { key: "debtToSales", label: "차입금/매출액", unit: "%" },
  ] },
  { key: "activity", name: "활동성", hint: "자산·자본이 매출로 얼마나 회전하는지(회전율).", metrics: [
    { key: "arTurnover", label: "매출채권회전율", unit: "회" },
    { key: "totalCapitalTurnover", label: "총자본회전율", unit: "회" },
    { key: "equityTurnover", label: "자기자본회전율", unit: "회" },
  ] },
];
// 보고서 비율표 기준 3개년 프레임 — 항상 길이 3. 자료가 부족하면 좌측(과거 연도)을 채워 박스 3칸을 유지.
function ratioFrameYears(ui) {
  let ys = ((ui.reportRatioYears && ui.reportRatioYears.length) ? ui.reportRatioYears
          : (ui.ratioYears && ui.ratioYears.length) ? ui.ratioYears
          : (ui.financialYears || [])).filter((y) => typeof y === "number");
  ys = Array.from(new Set(ys)).sort((a, b) => a - b).slice(-3);
  while (ys.length < 3) ys.unshift(ys.length ? ys[0] - 1 : null);
  if (ys.every((y) => y == null)) { const pool = cretopYearPool(ui); if (pool.length) return cretopFillYears([], 3, pool); } // [D-94] 비율표 연도가 없으면 결산 연도로
  return ys;
}
// ui.ratioAreas(엔진) → 지표 key별 metric 평탄화(트렌드 포함)
function ratioMetricMap(ui) {
  const m = {};
  (ui.ratioAreas || []).forEach((a) => (a.metrics || []).forEach((x) => { if (x && x.key && !m[x.key]) m[x.key] = x; }));
  return m;
}
// 엔진 트렌드(보고서 비율표 값)를 고정 3개년 프레임에 연도 정렬 — 누락 연도는 공란(null). TrendStack과 호환.
function padTrendToFrame(trend, frameYears, fallbackUnit) {
  const isRatio = trend ? !!trend.isRatio : true;
  const unit = (trend && trend.unit) || fallbackUnit || "%";
  const byYear = {};
  if (trend && trend.series) trend.series.forEach((s) => { if (s.year != null) byYear[s.year] = s; });
  const series = frameYears.map((y) => { const s = (y != null) ? byYear[y] : null; return { year: y, raw: s ? s.raw : null, val: s ? s.val : null }; });
  const steps = [];
  for (let i = 1; i < series.length; i++) {
    const a = series[i - 1], b = series[i];
    if (typeof a.val === "number" && typeof b.val === "number") {
      const da = Math.round((b.val - a.val) * 100) / 100;
      const dp = isRatio ? da : (a.val !== 0 ? Math.round((da / Math.abs(a.val)) * 1000) / 10 : null);
      let transition = null;
      if (a.val < 0 && b.val >= 0) transition = "흑자전환";
      else if (a.val >= 0 && b.val < 0) transition = "적자전환";
      else if (a.val < 0 && b.val < 0) transition = b.val < a.val ? "적자폭 확대" : "적자폭 축소";
      steps.push({ fromYear: a.year, toYear: b.year, deltaAbs: da, deltaPct: dp, transition, dir: da > 0.0001 ? "상승" : (da < -0.0001 ? "하락" : "유지") });
    } else steps.push(null);   // 한쪽이라도 비면 증감 표시 없음(텍스트형 '흑자전환' 등은 박스 값으로 직접 노출)
  }
  const latest = [...series].reverse().find((s) => s.val != null) || null;
  return { series, steps, latest, isRatio, unit, pUnit: isRatio ? "%p" : "%" };
}

function RatioAreas({ ui }) {
  const frame = ratioFrameYears(ui);
  const mmap = ratioMetricMap(ui);
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {RATIO_AREA_TEMPLATE.map((area) => (
        <div key={area.key} style={{ ...card, padding: "12px 14px", display: "grid", gap: 11 }}>
          <div style={{ fontSize: "calc(14px * var(--fs,1))", fontWeight: 800, color: T.brand }}>{area.name}</div>
          {area.metrics.map((tm, mi) => {
            const em = mmap[tm.key];
            const t = padTrendToFrame((em && !em.missing) ? em.trend : null, frame, (em && em.unit) || tm.unit);
            const latest = t.latest;
            const latestNum = latest && typeof latest.val === "number";
            return (
              <div key={tm.key} style={{ display: "grid", gap: 5, borderTop: mi ? `1px solid ${T.lineSoft}` : "none", paddingTop: mi ? 11 : 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontSize: "calc(12.5px * var(--fs,1))", color: T.sub, fontWeight: 700 }}>{tm.label}</span>
                  {latest && latest.val != null
                    ? <span style={{ fontSize: "calc(13px * var(--fs,1))", fontWeight: 800, color: latestNum ? trendSemColor(t, tm.key, tm.label) : T.ink }}>{fmtTrendVal(latest.val, t.unit)}</span>
                    : <span style={{ fontSize: "calc(12px * var(--fs,1))", color: T.mute }}>자료 없음</span>}
                </div>
                <TrendStack trend={t} semKey={tm.key} semLabel={tm.label} compact />
              </div>
            );
          })}
          <div style={{ fontSize: "calc(11px * var(--fs,1))", color: T.mute, lineHeight: 1.5 }}>{area.hint}</div>
        </div>
      ))}
    </div>
  );
}

// 상세재무제표 한 표 — 각 계정을 억원 환산 3개년 스택(증감액+증감률+색)으로
// 상세재무제표 — 내부 탭(표 선택). 없는 표는 안내. 긴 스크롤 방지.
const STMT_TABS = [["balanceSheet", "재무상태표"], ["incomeStatement", "손익계산서"], ["manufacturingCost", "제조원가"], ["retainedEarnings", "이익잉여금"]];
function StatementSection({ ui }) {
  const ds = ui.detailStatements || {};
  const [sub, setSub] = useState("balanceSheet");
  const stmt = ds[sub];
  const has = stmt && stmt.items && stmt.items.length;
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {STMT_TABS.map(([k, label]) => (
          <button key={k} onClick={() => setSub(k)} style={{ flex: "1 1 auto", minWidth: 0, border: `1px solid ${sub === k ? T.brand : T.line}`, background: sub === k ? T.brandSoft : "#fff", color: sub === k ? T.brand : T.sub, fontWeight: sub === k ? 800 : 600, borderRadius: 9, padding: "7px 8px", fontSize: "calc(12px * var(--fs,1))", fontFamily: FF, cursor: "pointer", whiteSpace: "nowrap" }}>{label}</button>
        ))}
      </div>
      {has ? <StatementTrend stmt={stmt} /> : <div style={{ ...card, padding: 18, color: T.mute, fontSize: "calc(13px * var(--fs,1))", textAlign: "center", lineHeight: 1.6 }}>원문에서 확인되지 않았습니다.</div>}
    </div>
  );
}
function StatementTrend({ stmt }) {
  if (!stmt || !stmt.items || !stmt.items.length) return null;
  const unit = stmt.unit || "천원";
  const gYears = stmt.years || [];
  return (
    <div style={{ ...card, padding: "12px 14px", marginBottom: 12, display: "grid", gap: 10 }}>
      <div style={{ fontSize: "calc(13.5px * var(--fs,1))", fontWeight: 800, color: T.ink }}>{stmt.name}<span style={{ fontSize: "calc(11px * var(--fs,1))", color: T.mute, fontWeight: 600, marginLeft: 8 }}>원값 단위: {unit} · 박스=억원 환산</span></div>
      <div style={{ display: "grid", gap: 9 }}>
        {stmt.items.map((it, idx) => {
          const vals = (it.numberCandidates || []).slice();
          const years = (it.yearCandidates && it.yearCandidates.length === vals.length) ? it.yearCandidates : (gYears.length === vals.length ? gYears : (it.yearCandidates && it.yearCandidates.length ? it.yearCandidates : gYears));
          const t = cretopRowTrend({ isRatio: false, numberCandidates: vals, yearCandidates: years, unit });
          const label = it.rawLabel || it.account;
          const ok = t && t.series && t.series.length;
          const latest = ok && t.latest;
          return (
            <div key={idx} style={{ display: "grid", gap: 5, borderTop: idx ? `1px dashed ${T.lineSoft}` : "none", paddingTop: idx ? 9 : 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontSize: "calc(12.5px * var(--fs,1))", color: T.sub, fontWeight: 700 }}>{label}</span>
                {latest && typeof latest.val === "number" ? <span style={{ fontSize: "calc(13px * var(--fs,1))", fontWeight: 800, color: trendSemColor(t, null, label) }}>{fmtTrendVal(latest.val, t.unit)}</span> : null}
              </div>
              {ok ? <TrendStack trend={t} semKey={null} semLabel={label} compact /> : <span style={{ fontSize: "calc(11px * var(--fs,1))", color: T.mute }}>값 후보 없음</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 기업 개요 — OS '크레탑 핵심지표 점검' 기업개요와 동일 항목을 미니앱 톤으로 표시
const CERT_ROWS = [["벤처", "venture"], ["이노비즈", "innobiz"], ["메인비즈", "mainbiz"], ["연구개발전담부서", "rndDept"], ["부설연구소", "rndLab"]];
const IP_ROWS = [["특허", "patent"], ["실용신안", "utility"], ["디자인", "design"], ["상표권", "trademark"]];

// 주요주주 표 — PDF 주요주주현황 구조(주주명/구분/소유주식수/지분율/관계). 가로 스크롤(모바일).
function ShareholderTable({ st }) {
  const cols = (st && st.cols) || [];
  if (st && st.noData) return <div style={{ fontSize: "calc(12px * var(--fs,1))", color: T.sub }}>{st.note || "조회된 자료가 없습니다."}</div>;
  if (!cols.length) return <div style={{ fontSize: "calc(12px * var(--fs,1))", color: T.mute }}>주요주주 정보 없음</div>;
  const th = { padding: "7px 9px", textAlign: "left", fontWeight: 800, color: T.sub, whiteSpace: "nowrap", borderBottom: `1px solid ${T.line}` };
  const td = { padding: "7px 9px", color: T.ink, whiteSpace: "nowrap", verticalAlign: "top" };
  return (
    <div style={{ minWidth: 0, maxWidth: "100%" }}>
      {st.source ? <div style={{ fontSize: "calc(10px * var(--fs,1))", color: T.mute, marginBottom: 4 }}>출처: {st.source}</div> : null}
      <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", maxWidth: "100%", border: `1px solid ${T.line}`, borderRadius: 10, background: "#fff" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 460, fontSize: "calc(11.5px * var(--fs,1))" }}>
          <thead><tr style={{ background: "#F1F5F9" }}>
            {["주주명", "구분", "소유주식수", "지분율", "경영실권자와의 관계", "회사와의 관계"].map((h) => <th key={h} style={th}>{h}</th>)}
          </tr></thead>
          <tbody>
            {cols.map((c, i) => (
              <tr key={i} style={{ borderTop: `1px solid ${T.line}` }}>
                <td style={{ ...td, fontWeight: 800 }}>{c.name}</td>
                <td style={{ ...td, color: T.sub }}>{c.kind || "—"}</td>
                <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{c.shares != null ? c.shares.toLocaleString() : "—"}</td>
                <td style={{ ...td, textAlign: "right", fontWeight: 700, color: T.brand }}>{c.pct != null ? c.pct + "%" : "—"}</td>
                <td style={{ ...td, color: T.sub }}>{c.relMgr || "—"}</td>
                <td style={{ ...td, color: T.sub }}>{c.relCo || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function CompanyHeader({ ui, grade, manualGrade, setGrade, isAdmin, compact }) {
  const co = ui.companyInfo || {};
  const certInfo = ui.certInfo || {};
  const ipInfo = ui.ipInfo || {};
  const ex = ui.companyExtras || {}, sh = ui.stakeholders || {}, cd = ui.ceoDetail || {}, wp = ui.workplace || {};
  const bf = ui.bizForm || {};
  const dbg = ui._extractDebug || null;
  const [popup, setPopup] = useState(null);   // 'company' | 'ceo' | 'workplace' | 'debug'
  const narrowHdr = useNarrow();
  const popBtn = { border: `1px solid ${T.brand}55`, background: "#fff", color: T.brand, borderRadius: 8, padding: narrowHdr ? "5px 4px" : "4px 10px", fontSize: narrowHdr ? "calc(9.5px * var(--fs,1))" : "calc(11px * var(--fs,1))", fontWeight: 800, fontFamily: FF, cursor: "pointer", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", minWidth: 0 };
  const cg = co.creditGrade;
  const hasCg = cg && cg !== "이미지 원문 확인 필요";
  const cfG = co.cashflowGrade;
  const cfInfo = cfG ? cretopCashflowGradeInfo(cfG.latest) : null;

  // 기본 정보 라벨/값 (있는 항목만)
  const narrow = useNarrow();
  const rows = [];
  const add = (k, v) => { if (v) rows.push([k, v]); };
  // [D-113] 긴 값(주소·업종·제품)은 한 줄을 다 쓰고, 짧은 값은 두 칸씩 — 휴대폰에서 한 줄에 하나씩 길게 내려가던 것
  const WIDE = new Set(["주소", "표준산업분류 10차", "표준산업분류 11차", "표준산업분류", "주요제품"]);
  add("사업자번호", co.businessNo);
  add("법인번호", co.corpRegNo);
  add("대표자", co.ceoName);
  add("종업원 수", co.employees ? co.employees + "명" : "");
  add("설립일", co.established);
  add("결산월", co.settleMonth ? co.settleMonth + "월" : "");
  add("기업유형", co.corpType);
  add("기업규모", co.scale);
  add("주소", co.address);
  add("표준산업분류 10차", co.industry10 || co.stdIndustry10);
  add("표준산업분류 11차", co.industry11 || co.stdIndustry11);
  if (!(co.industry10 || co.stdIndustry10 || co.industry11 || co.stdIndustry11)) add("표준산업분류", co.standardIndustry || co.industry);
  add("주요제품", co.mainProduct);

  const hasCert = CERT_ROWS.some(([, k]) => certInfo[k]);
  const hasIp = IP_ROWS.some(([, k]) => ipInfo[k] != null);
  const bid = co.bid;
  const subHdr = { fontWeight: 800, color: T.sub, fontSize: "calc(11.5px * var(--fs,1))", marginBottom: 5 };

  return (
    <div style={{ ...card, padding: "18px 20px", borderColor: T.brand + "33", background: T.brandSoft, minWidth: 0, maxWidth: "100%", overflowWrap: "anywhere" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: "calc(20px * var(--fs,1))", fontWeight: 800, color: T.ink }}>{co.companyName || "기업명 확인 필요"}</div>
        {(() => { const t = gradeTone(grade); const show = grade && grade !== "미확인"; return (
          <span style={{ fontSize: "calc(12px * var(--fs,1))", fontWeight: 800, color: "#fff", background: t.color, borderRadius: 6, padding: "3px 10px", whiteSpace: "nowrap" }}>신용등급 {show ? grade : "미확인"} · {t.status}</span>
        ); })()}
        {bf.isPersonal ? <span title="법인전용 컨설팅 항목은 자동 비활성화됩니다" style={{ fontSize: "calc(11.5px * var(--fs,1))", fontWeight: 800, color: "#92400E", background: "#FEF3C7", border: `1px solid #FCD34D`, borderRadius: 6, padding: "3px 10px", whiteSpace: "nowrap" }}>개인사업자</span> : bf.possible ? <span style={{ fontSize: "calc(11.5px * var(--fs,1))", fontWeight: 700, color: "#92400E", background: "#FFFBEB", border: `1px solid #FDE68A`, borderRadius: 6, padding: "3px 10px", whiteSpace: "nowrap" }}>개인사업자 가능성</span> : null}
      </div>
      {bf.isPersonal ? <div style={{ marginTop: 7, fontSize: "calc(11px * var(--fs,1))", color: "#92400E", lineHeight: 1.5 }}>일부 법인전용 컨설팅 항목(정관·이익소각·주식가치 등)은 자동 비활성화됩니다.</div> : null}

      {/* 신용등급 직접 선택 (OS 동일 · 소문자 모의평가/대문자 정식 · 선택 즉시 전체 반영) */}
      {!compact ? <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: "calc(11.5px * var(--fs,1))", color: T.sub, fontWeight: 700, whiteSpace: "nowrap" }}>신용등급 직접 선택</span>
        <select value={grade || "미확인"} onChange={(e) => setGrade(e.target.value)} style={{ fontSize: "calc(12.5px * var(--fs,1))", fontFamily: FF, color: T.ink, border: `1px solid ${gradeTone(grade).color}66`, borderRadius: 8, padding: "5px 10px", background: "#fff", cursor: "pointer" }}>
          {GRADE_GROUPS.map(([label, opts]) => <optgroup key={label} label={label}>{opts.map((g) => <option key={g} value={g}>{g}</option>)}</optgroup>)}
          <option value="미확인">미확인</option>
        </select>
        {manualGrade ? <button onClick={() => setGrade(null)} title="원문 기준으로 되돌리기" style={{ fontSize: "calc(10.5px * var(--fs,1))", fontFamily: FF, border: `1px solid ${T.line}`, color: T.sub, borderRadius: 7, padding: "4px 8px", background: "#fff", cursor: "pointer", whiteSpace: "nowrap" }}>↺ 직접입력 해제</button> : null}
        <span style={{ fontSize: "calc(10.5px * var(--fs,1))", color: T.mute }}>소문자=모의평가 · 대문자=정식</span>
      </div> : null}

      {/* 현금흐름·EW·기술력 등급 칩 */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
        {cfInfo && cfG ? <span style={{ fontSize: "calc(11.5px * var(--fs,1))", fontWeight: 800, color: "#fff", background: cfInfo.color, borderRadius: 6, padding: "3px 9px" }}>현금흐름 {cfG.latest} · {cfInfo.level}</span> : null}
        {co.ewGrade ? <span style={{ fontSize: "calc(11.5px * var(--fs,1))", fontWeight: 700, color: T.sub, background: "#fff", border: `1px solid ${T.line}`, borderRadius: 6, padding: "3px 9px" }}>EW등급 {co.ewGrade}</span> : null}
        {co.techEval ? <span style={{ fontSize: "calc(11.5px * var(--fs,1))", fontWeight: 800, color: T.brand, background: "#fff", border: `1px solid ${T.brand}33`, borderRadius: 6, padding: "3px 9px" }}>기술력 {co.techEval}</span> : null}
      </div>

      {/* 상세정보 팝업 버튼 — 기업/대표자/사업장 (요약 브리핑에서는 숨김) */}
      {/* [D-113] 휴대폰은 세 칸 격자 — 세 줄로 흩어지던 단추를 두 줄로 */}
      {!compact ? <div style={narrow ? { display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 5, marginTop: 10 } : { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
        <button onClick={() => setPopup("company")} style={popBtn}>📄 상세정보</button>
        <button onClick={() => setPopup("ceo")} style={popBtn}>👤 대표자 상세</button>
        <button onClick={() => setPopup("workplace")} style={popBtn}>🏢 사업장 현황</button>
        <button onClick={() => setPopup("affil")} style={popBtn}>🧩 관계회사 현황</button>
        <button onClick={() => setPopup("trade")} style={popBtn}>🤝 거래처 현황</button>
        {isAdmin && dbg ? <button onClick={() => setPopup("debug")} style={{ ...popBtn, color: T.mute, borderColor: T.line }}>원문 추출 상태</button> : null}
      </div> : null}

      {/* 기본 정보 — 라벨 위·값 아래(스택)로 큰 글자에서도 안 눌리게 */}
      {rows.length ? (
        <div data-testid="cretop-basic-info" style={{ display: "grid", gridTemplateColumns: narrow ? "repeat(2,minmax(0,1fr))" : "repeat(auto-fill,minmax(min(100%,150px),1fr))", gap: narrow ? "8px 12px" : "10px 16px", marginTop: 13 }}>
          {rows.map(([k, v], i) => (
            <div key={i} data-wide={WIDE.has(k) ? "1" : undefined} style={{ minWidth: 0, gridColumn: WIDE.has(k) ? (narrow ? "1 / -1" : "span 2") : undefined }}>
              <div style={{ color: T.mute, fontSize: "calc(11px * var(--fs,1))", fontWeight: 700, marginBottom: 2 }}>{k}</div>
              <div style={{ color: T.ink, fontWeight: 700, fontSize: "calc(13px * var(--fs,1))", lineHeight: 1.45, wordBreak: "break-word" }}>{v}</div>
            </div>
          ))}
        </div>
      ) : null}

      {/* 기업인증 */}
      {hasCert ? (
        <div style={{ marginTop: 14 }}>
          <div style={subHdr}>기업인증 <span style={{ color: T.mute, fontWeight: 600 }}>(인증 표 기준)</span></div>
          {/* [D-113] 휴대폰은 두 칸 격자 — 한 줄에 하나씩 다섯 줄로 내려가던 것 */}
          <div data-testid="cretop-cert-chips" style={narrow ? { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 5 } : { display: "flex", flexWrap: "wrap", gap: 5 }}>
            {CERT_ROWS.map(([nm, k], i) => {
              const st = certInfo[k]; const ok = st === "인증"; const no = st === "미인증";
              const col = ok ? T.okInk : no ? T.mute : T.warnInk; const bg = ok ? T.okBg : no ? T.lineSoft : T.warnBg;
              const word = st ? (narrow && st.includes("원문") ? "확인 필요" : st) : "확인 필요";
              return <span key={i} style={{ fontSize: "calc(11px * var(--fs,1))", fontWeight: 700, color: col, background: bg, border: `1px solid ${col}33`, borderRadius: 6, padding: "2px 8px", minWidth: 0, overflowWrap: "anywhere" }}>{nm} {word}</span>;
            })}
          </div>
        </div>
      ) : null}

      {/* 산업재산권 */}
      {hasIp ? (
        <div style={{ marginTop: 10 }}>
          <div style={subHdr}>산업재산권</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {IP_ROWS.map(([nm, k], i) => {
              const c = ipInfo[k]; const has = typeof c === "number" && c >= 1;
              return <span key={i} style={{ fontSize: "calc(11px * var(--fs,1))", fontWeight: has ? 800 : 700, color: has ? "#fff" : T.sub, background: has ? T.brand : "#fff", border: `1px solid ${has ? T.brand : T.line}`, borderRadius: 6, padding: "2px 8px" }}>{nm} {c != null ? c + "건" : "원문 확인 필요"}</span>;
            })}
          </div>
        </div>
      ) : null}

      {/* 나라장터 입찰/낙찰 */}
      {bid && (bid.tenders || bid.wins) ? (
        <div style={{ marginTop: 10, fontSize: "calc(11.5px * var(--fs,1))", color: T.sub }}>
          나라장터 {bid.tenders ? <b style={{ color: T.brand, fontWeight: 800 }}>입찰 {bid.tenders.toLocaleString()}건</b> : null}{bid.wins ? <> · <b style={{ color: T.up, fontWeight: 800 }}>낙찰 {bid.wins.toLocaleString()}건</b></> : null}
        </div>
      ) : null}

      {/* 주요주주 — 표 형태(PDF 주요주주현황 구조). 관계회사/거래처는 상단 버튼 팝업으로 분리. */}
      <div style={{ marginTop: 14 }}>
        <div style={subHdr}>주요주주 <span style={{ color: T.mute, fontWeight: 600 }}>(관계회사·거래처는 위 버튼에서 확인)</span></div>
        <ShareholderTable st={sh.majorShareholders} />
      </div>

      {popup === "company" ? <DetailModal title="기업 상세정보" subtitle={co.companyName || ""} onClose={() => setPopup(null)} sections={[
        { label: "연혁", fmt: formatPopupSection(ex.history, { mode: "history" }) },
        { label: "사업목적", fmt: formatPopupSection(ex.bizPurpose, { mode: "lines" }), raw: ex.bizPurpose },
        { label: "종합의견", fmt: formatPopupSection(ex.opinion, { mode: "opinion" }), raw: ex.opinion },
      ]} /> : null}
      {popup === "ceo" ? <DetailModal title="대표자 상세" subtitle={co.ceoName || ""} onClose={() => setPopup(null)} sections={[
        { label: "인적사항", fmt: formatPopupSection(cd.personal, { mode: "kv", labels: CEO_PERSONAL_LABELS }) },
        { label: "주요경력사항", fmt: formatPopupSection(cd.career, { mode: "career" }) },
        { label: "학력", fmt: formatPopupSection(cd.education, { mode: "text" }) },
        { label: "자격", fmt: formatPopupSection(cd.license, { mode: "text" }) },
      ]} /> : null}
      {popup === "workplace" ? <DetailModal title="사업장 현황" subtitle={co.address || ""} onClose={() => setPopup(null)} sections={[
        { label: "주소", fmt: formatPopupSection(co.address, { mode: "text" }) },
        { label: "사업장 현황", fmt: formatPopupSection(wp.basic, { mode: "kv", labels: WORK_BASIC_LABELS }) },
        { label: "사업장 세부현황", fmt: formatPopupSection(wp.detail, { mode: "kv", labels: WORK_DETAIL_LABELS }) },
      ]} /> : null}
      {popup === "affil" ? <StakeModal title="🧩 관계회사 현황" subtitle={co.companyName || ""} onClose={() => setPopup(null)} groups={[
        { label: "관계회사", source: sh.affiliates && sh.affiliates.source, noData: !!(sh.affiliates && sh.affiliates.noData), note: sh.affiliates && sh.affiliates.note, rows: (sh.affiliates && sh.affiliates.rows) || [] },
      ]} /> : null}
      {popup === "trade" ? <StakeModal title="🤝 거래처 현황" subtitle={co.companyName || ""} onClose={() => setPopup(null)} groups={[
        { label: "주요구매처", source: sh.purchaseSuppliers && sh.purchaseSuppliers.source, noData: !!(sh.purchaseSuppliers && sh.purchaseSuppliers.noData), note: sh.purchaseSuppliers && sh.purchaseSuppliers.note, rows: (sh.purchaseSuppliers && sh.purchaseSuppliers.rows) || [] },
        { label: "주요판매처", source: sh.salesCustomers && sh.salesCustomers.source, noData: !!(sh.salesCustomers && sh.salesCustomers.noData), note: sh.salesCustomers && sh.salesCustomers.note, rows: (sh.salesCustomers && sh.salesCustomers.rows) || [] },
      ]} /> : null}
      {popup === "debug" && isAdmin && dbg ? <InfoModal title="원문 추출 상태" subtitle={dbg.hasPages ? `PDF ${dbg.pageCount}쪽 · 페이지 기반` : "전체 raw 기반(페이지 정보 없음)"} onClose={() => setPopup(null)} sections={dbg.sections.map((s) => ({ label: `${s.ok ? "✅" : "❌"} ${s.label}`, value: s.preview ? `[매칭 미리보기 300자]\n${s.preview}` : "(매칭 실패 — 추출 안 됨)" }))} /> : null}
    </div>
  );
}

// 접기/펼치기 섹션 — 각자 open 상태 관리(defaultOpen)
function Collapsible({ id, title, desc, defaultOpen, count, children }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <section id={id} style={{ marginTop: 16, scrollMarginTop: 12 }}>
      <button onClick={() => setOpen((o) => !o)} style={{ width: "100%", textAlign: "left", border: `1px solid ${T.line}`, background: "#fff", cursor: "pointer", borderRadius: 12, padding: "12px 14px", fontFamily: FF, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: "calc(12px * var(--fs,1))", color: T.mute }}>{open ? "▾" : "▸"}</span>
        <span style={{ fontSize: "calc(15px * var(--fs,1))", fontWeight: 800, color: T.ink }}>{title}</span>
        {count != null ? <span style={{ fontSize: "calc(12px * var(--fs,1))", color: T.mute, fontWeight: 700 }}>({count})</span> : null}
        {desc ? <span style={{ marginLeft: "auto", fontSize: "calc(11px * var(--fs,1))", color: T.mute, fontWeight: 500 }}>{desc}</span> : null}
      </button>
      {open ? <div style={{ marginTop: 10 }}>{children}</div> : null}
    </section>
  );
}

const TONE_COL = { bad: { fg: SEM.bad, bg: "#FEF2F2", bd: "#FECACA" }, warn: { fg: SEM.warn, bg: "#FFFBEB", bd: "#FDE68A" }, good: { fg: SEM.good, bg: "#F0FDF4", bd: "#BBF7D0" }, info: { fg: T.sub, bg: T.lineSoft, bd: T.line } };

// 종합 진단 요약 카드
function DiagnosisSummary({ ui }) {
  const lines = buildDiagnosisSummary(ui);
  return (
    <div style={{ ...card, padding: "16px 18px" }}>
      <div style={{ display: "grid", gap: 8 }}>
        {lines.map((l, i) => { const c = TONE_COL[l.tone] || TONE_COL.info; return (
          <div key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
            <span style={{ marginTop: 5, width: 8, height: 8, borderRadius: 8, background: c.fg, flexShrink: 0 }} />
            <span style={{ fontSize: "calc(13px * var(--fs,1))", lineHeight: 1.55, color: l.tone === "info" ? T.sub : c.fg, fontWeight: 600 }}>{l.text}</span>
          </div>
        ); })}
      </div>
      <div style={{ fontSize: "calc(11px * var(--fs,1))", color: T.mute, marginTop: 10 }}>※ 룰 기반 자동 요약입니다. 실제 상담 전 원문·전문가 검토를 권장합니다.</div>
    </div>
  );
}

// 상세(펼침) 한 묶음 리스트
function DetailList({ title, items, accent }) {
  if (!items || !items.length) return null;
  return (
    <div>
      <div style={{ fontSize: "calc(11px * var(--fs,1))", color: T.mute, fontWeight: 700, marginBottom: 4 }}>{title}</div>
      <ul style={{ margin: 0, paddingLeft: 16, display: "grid", gap: 2 }}>{items.map((x, i) => <li key={i} style={{ fontSize: "calc(12px * var(--fs,1))", lineHeight: 1.5, color: accent ? T.brand : T.sub, fontWeight: accent ? 600 : 400 }}>{x}</li>)}</ul>
    </div>
  );
}
// ── 추천 컨설팅: 점수 비노출, 4단계 우선순위 + 추천 모드 + 관심 항목 ──
// 점수(scoreOf)는 내부에서만 사용 → 티어로 변환해 표시.
const REC_TIERS = [
  { key: "top", emoji: "🔥", label: "최우선 추천 검토", min: 80, col: "#B91C1C", bg: "#FEF2F2", bd: "#FECACA" },
  { key: "rec", emoji: "🟢", label: "검토 권장", min: 60, col: "#15803D", bg: "#ECFDF5", bd: "#BBF7D0" },
  { key: "cond", emoji: "🟡", label: "조건 확인 필요", min: 40, col: "#B45309", bg: "#FFFBEB", bd: "#FDE68A" },
  { key: "low", emoji: "⚪", label: "현재 가능성 낮음", min: 0, col: "#64748B", bg: "#F8FAFC", bd: "#E2E8F0" },
];
function tierOf(score) { return REC_TIERS.find((t) => score >= t.min) || REC_TIERS[REC_TIERS.length - 1]; }
// 추천 모드 — 모드별로 관련 카테고리/이름에 정렬 가중치(표시 점수 아님). 종합=가중치 없음.
const REC_MODES = [
  { key: "all", label: "종합 컨설팅", cats: [], names: null },
  { key: "policy", label: "정책자금 중심", cats: ["자금조달"], names: /정책자금|보증|신보|기보|중진공|소진공|대출|차입/ },
  { key: "tax", label: "절세 중심", cats: ["자본·세무"], names: /세액공제|절세|가지급금|이익소각|연구소|세금|소득|공제/ },
  { key: "rnd", label: "연구소·인증 중심", cats: ["연구소·인증", "지식재산"], names: /연구소|연구개발|벤처|이노비즈|메인비즈|ISO|인증|특허|지식재산/ },
  { key: "employ", label: "고용지원금 중심", cats: ["고용·인력"], names: /고용|채용|청년|인건비|일자리/ },
  { key: "capital", label: "자본거래 중심", cats: ["자본·세무", "재무관리"], names: /이익소각|배당|잉여금|가수금|자본|주주|증자/ },
  { key: "succession", label: "가업승계 중심", cats: ["승계·리스크"], names: /승계|가업|상속|증여|주주|지분/ },
];
function modeBoost(s, mode) {
  const m = REC_MODES.find((x) => x.key === mode) || REC_MODES[0];
  if (m.key === "all") return 0;
  if (m.names && m.names.test(s.name)) return 2;   // 모드 핵심 항목
  if (m.cats.includes(s.cat)) return 1;            // 모드 관련 카테고리
  return 0;
}
const RECO_MODE_KEY = "mini_reco_mode_v1";
const RECO_INTEREST_KEY = "mini_reco_interests_v1";
function loadRecoMode() { try { return localStorage.getItem(RECO_MODE_KEY) || "all"; } catch (e) { return "all"; } }
function loadRecoInterests() { try { return JSON.parse(localStorage.getItem(RECO_INTEREST_KEY) || "[]"); } catch (e) { return []; } }

// 미팅 질문 흐름(5단계: 오프닝→현황→문제인식→제안연결→다음액션) — 대표가 니즈를 느끼도록 설계
const STEP_COL = { A: "#0D9488", B: "#1D4ED8", C: "#B45309", D: "#7C3AED", E: "#15803D" };
// [D-119] 질문 5단계를 미팅 차수에 나눈다 — 1차 A·B·C · 2차 D(제안 연결) · 3차 E(다음 액션). 영업 관리 › 미팅 준비와 같은 규칙
const FLOW_ROUND = { A: 1, B: 1, C: 1, D: 2, E: 3 };
function MeetingFlow({ s, title = "대표에게 던질 질문 흐름" }) {
  const flow = meetingQuestionFlow(s);
  if (!flow.length) return null;
  return (
    <div style={{ border: `1px solid ${T.line}`, borderRadius: 9, background: "#FAFBFD", padding: "10px 12px" }}>
      <div style={{ fontSize: "calc(11px * var(--fs,1))", fontWeight: 800, color: T.brand, marginBottom: 8 }}>💬 {title}</div>
      <div style={{ display: "grid", gap: 10 }}>
        {flow.map((x, i) => (
          <div key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
            <span style={{ flex: "0 0 auto", fontSize: "calc(9px * var(--fs,1))", fontWeight: 800, color: STEP_COL[x.step] || T.brand, background: "#fff", border: `1px solid ${STEP_COL[x.step] || T.brand}55`, borderRadius: 4, padding: "1px 0", marginTop: 1, width: 16, textAlign: "center" }}>{x.step}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "calc(9.5px * var(--fs,1))", fontWeight: 700, color: T.mute, marginBottom: 1 }}>{x.label} · {FLOW_ROUND[x.step] || 1}차</div>
              <div style={{ fontSize: "calc(12.5px * var(--fs,1))", lineHeight: 1.55, color: T.ink, wordBreak: "keep-all" }}>{x.q}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
// 상세 보기 본문 — 추천이유·핵심확인·미팅질문흐름(5단계)·문제제기·멘트·요청자료·기대효과
// [D-119] 대표 지시 "하나하나 누르면 이것저것 많이 써 있어 정신없다 — 지우지 말고 합리적으로".
//   앞에는 미팅에서 바로 쓰는 것만(추천 이유 · 추천 멘트 · 차수별 질문 흐름), 나머지(핵심 확인사항 · 문제 제기 ·
//   이대로 두면 · 요청 자료 · 기대 효과)는 '더 보기' 안에. 글은 하나도 지우지 않았다.
function StrategyDetail({ s, reasons }) {
  const why = (reasons && reasons.length) ? reasons : [s.why];
  const [more, setMore] = useState(false);
  return (
    <div style={{ display: "grid", gap: 9 }}>
      <DetailList title="추천 이유" items={why} />
      <div style={{ fontSize: "calc(12.5px * var(--fs,1))", color: T.ink, background: T.brandSoft, border: `1px solid ${T.brand}22`, borderRadius: 8, padding: "8px 10px", lineHeight: 1.5 }}>
        <span style={{ fontSize: "calc(10.5px * var(--fs,1))", fontWeight: 800, color: T.brand }}>추천 멘트 💡</span><div style={{ marginTop: 2 }}>“{s.ment}”</div>
      </div>
      <MeetingFlow s={s} title="대표에게 던질 질문 흐름 · 차수별" />
      <button type="button" data-testid="cretop-detail-more" aria-expanded={more} onClick={() => setMore((o) => !o)} style={{ justifySelf: "start", border: `1px solid ${T.line}`, background: "#fff", color: T.sub, borderRadius: 8, padding: "5px 11px", fontSize: "calc(11.5px * var(--fs,1))", fontWeight: 700, fontFamily: FF, cursor: "pointer", textAlign: "left", wordBreak: "keep-all" }}>
        {more ? "접기 ▲" : "더 보기 — 핵심 확인사항 · 문제 제기 · 이대로 두면 · 요청 자료 · 기대 효과 ▼"}
      </button>
      {more ? (
        <div style={{ display: "grid", gap: 9 }}>
          <DetailList title="핵심 확인사항" items={s.interest} />
          {s.problem ? (
            <div style={{ fontSize: "calc(12.5px * var(--fs,1))", color: "#991B1B", background: "#FEF2F2", border: `1px solid #FCA5A5`, borderRadius: 8, padding: "8px 10px", lineHeight: 1.5 }}>
              <span style={{ fontSize: "calc(10.5px * var(--fs,1))", fontWeight: 800, color: SEM.bad }}>문제 제기 ⚠️</span>
              <div style={{ marginTop: 2, fontWeight: 600 }}>{s.problem}</div>
            </div>
          ) : null}
          {s.implication ? (
            <div style={{ fontSize: "calc(12.5px * var(--fs,1))", color: "#92400E", background: "#FFFBEB", border: `1px solid #FDE68A`, borderRadius: 8, padding: "8px 10px", lineHeight: 1.5 }}>
              <span style={{ fontSize: "calc(10.5px * var(--fs,1))", fontWeight: 800, color: SEM.warn }}>이대로 두면</span>
              <div style={{ marginTop: 2 }}>{s.implication}</div>
            </div>
          ) : null}
          <DetailList title="요청 자료" items={meetingDocs(s)} />
          <DetailList title="기대 효과" items={s.effects} />
        </div>
      ) : null}
    </div>
  );
}
// 추천 카드 — 점수 비노출. 티어 칩 + 추천 근거 + 상세 보기 + 최종 선택 버튼
function RecCard({ rk, selected, onToggle }) {
  const { s, reasons } = rk;
  const tier = tierOf(rk.score);
  const keyQ = (meetingQuestionFlow(s)[0] || {}).q || (s.questions && s.questions[0]) || "";
  const [open, setOpen] = useState(false);
  return (
    <div style={{ ...card, padding: 0, overflow: "hidden", borderColor: selected ? T.brand : tier.bd, boxShadow: selected ? `0 0 0 2px ${T.brand}33` : card.boxShadow }}>
      <div style={{ padding: "11px 13px", background: tier.bg, display: "grid", gap: 7 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: "calc(15px * var(--fs,1))", fontWeight: 900, color: T.ink, lineHeight: 1.3 }}>{s.name}</span>
          <span style={{ fontSize: "calc(10.5px * var(--fs,1))", color: T.mute, fontWeight: 700 }}>· {s.cat}</span>
        </div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}><span style={{ fontSize: "calc(11px * var(--fs,1))", fontWeight: 800, color: tier.col, background: "#fff", border: `1px solid ${tier.col}44`, borderRadius: 999, padding: "2px 9px", whiteSpace: "nowrap" }}>{tier.emoji} {tier.label}</span>{rk.held ? <span style={{ fontSize: "calc(11px * var(--fs,1))", fontWeight: 800, color: "#92400E", background: "#FEF3C7", border: `1px solid #FCD34D`, borderRadius: 999, padding: "2px 9px", whiteSpace: "nowrap" }}>이미 보유중</span> : null}{selected ? <span style={{ fontSize: "calc(11px * var(--fs,1))", fontWeight: 800, color: "#fff", background: T.brand, borderRadius: 999, padding: "2px 9px", whiteSpace: "nowrap" }}>✅ 선택됨</span> : null}</div>
        <div>
          <div style={{ fontSize: "calc(10.5px * var(--fs,1))", color: tier.col, fontWeight: 800, marginBottom: 3 }}>추천 근거</div>
          <ul style={{ margin: 0, paddingLeft: 16, display: "grid", gap: 2 }}>{(reasons.length ? reasons : [s.why]).slice(0, 2).map((r, i) => <li key={i} style={{ fontSize: "calc(12px * var(--fs,1))", lineHeight: 1.5, color: T.sub }}>{r}</li>)}</ul>
        </div>
        {keyQ ? <div style={{ fontSize: "calc(11.5px * var(--fs,1))", color: T.ink, background: "#fff", border: `1px solid ${tier.col}33`, borderRadius: 7, padding: "5px 9px", lineHeight: 1.5, wordBreak: "keep-all" }}>❓ {keyQ}</div> : null}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button onClick={() => setOpen((o) => !o)} style={{ border: `1px solid ${T.brand}`, background: open ? T.brand : "#fff", color: open ? "#fff" : T.brand, borderRadius: 8, padding: "5px 12px", fontSize: "calc(12px * var(--fs,1))", fontWeight: 800, fontFamily: FF, cursor: "pointer" }}>{open ? "닫기 ▲" : "상세 보기"}</button>
          {onToggle ? <button onClick={() => onToggle(s.name)} style={{ border: `1px solid ${selected ? T.brand : T.line}`, background: selected ? T.brand : "#fff", color: selected ? "#fff" : T.sub, borderRadius: 8, padding: "5px 12px", fontSize: "calc(12px * var(--fs,1))", fontWeight: 800, fontFamily: FF, cursor: "pointer" }}>{selected ? "✓ 선택 취소" : "＋ 선택하기"}</button> : null}
        </div>
      </div>
      {open ? <div style={{ padding: "10px 13px 12px", borderTop: `1px solid ${T.line}` }}><StrategyDetail s={s} reasons={reasons} /></div> : null}
    </div>
  );
}
// 티어 그룹(헤더 + 카드들)
// [D-119] 조건 확인 · 가능성 낮음 등급은 접어 둔다(펼치면 그대로) — 먼저 볼 것만 앞에
function TierGroup({ emoji, label, col, items, selectedSet, onToggle, folded }) {
  const [open, setOpen] = useState(!folded);
  if (!open) return (
    <button type="button" data-testid="cretop-tier-folded" onClick={() => setOpen(true)} style={{ display: "flex", alignItems: "center", gap: 7, width: "100%", border: `1px dashed ${T.line}`, background: "#fff", borderRadius: 10, padding: "9px 12px", fontFamily: FF, cursor: "pointer", textAlign: "left", boxSizing: "border-box" }}>
      <span style={{ fontSize: "calc(14px * var(--fs,1))" }}>{emoji}</span>
      <span style={{ fontSize: "calc(13px * var(--fs,1))", fontWeight: 800, color: col }}>{label}</span>
      <span style={{ fontSize: "calc(11.5px * var(--fs,1))", color: T.mute, fontWeight: 700 }}>({items.length})</span>
      <span style={{ marginLeft: "auto", fontSize: "calc(11px * var(--fs,1))", color: T.brand, fontWeight: 800, whiteSpace: "nowrap" }}>펼치기 ▾</span>
    </button>
  );
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 7, margin: "2px 0 8px" }}>
        <span style={{ fontSize: "calc(15px * var(--fs,1))" }}>{emoji}</span>
        <span style={{ fontSize: "calc(14px * var(--fs,1))", fontWeight: 900, color: col }}>{label}</span>
        <span style={{ fontSize: "calc(11.5px * var(--fs,1))", color: T.mute, fontWeight: 700 }}>({items.length})</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(min(100%,360px),1fr))", gap: 10 }}>{items.map((rk) => <RecCard key={rk.s.name} rk={rk} selected={selectedSet && selectedSet.has(rk.s.name)} onToggle={onToggle} />)}</div>
    </div>
  );
}
// 추천 설정(모드 + 관심 항목)
// [D-119] 추천 기준은 한 번 정하면 잘 바꾸지 않는다 — 접어 두고, 이미 고른 것이 있으면 한 줄로 보여 준다
function RecoSettings({ mode, setMode, interests, toggle }) {
  const [open, setOpen] = useState(false);
  const modeLabel = (REC_MODES.find((m) => m.key === mode) || REC_MODES[0]).label;
  if (!open) return (
    <button type="button" data-testid="cretop-reco-settings" aria-expanded="false" onClick={() => setOpen(true)} style={{ ...card, display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", fontFamily: FF, cursor: "pointer", textAlign: "left", width: "100%", boxSizing: "border-box" }}>
      <span style={{ fontSize: "calc(12.5px * var(--fs,1))", fontWeight: 800, color: T.ink }}>🎚️ 추천 기준</span>
      <span style={{ fontSize: "calc(11.5px * var(--fs,1))", color: T.sub, minWidth: 0, flex: 1, wordBreak: "keep-all" }}>{modeLabel}{interests.length ? ` · 관심 ${interests.join("·")}` : ""}</span>
      <span style={{ fontSize: "calc(11px * var(--fs,1))", color: T.brand, fontWeight: 800, whiteSpace: "nowrap" }}>바꾸기 ▾</span>
    </button>
  );
  return (
    <div style={{ ...card, padding: "12px 14px", display: "grid", gap: 11 }}>
      <button type="button" aria-expanded="true" onClick={() => setOpen(false)} style={{ justifySelf: "end", border: "none", background: "transparent", color: T.mute, fontFamily: FF, fontSize: "calc(11px * var(--fs,1))", fontWeight: 700, cursor: "pointer", padding: 0 }}>접기 ▴</button>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: "calc(12.5px * var(--fs,1))", fontWeight: 800, color: T.ink }}>🎚️ 추천 모드</span>
        <select value={mode} onChange={(e) => setMode(e.target.value)} style={{ border: `1px solid ${T.line}`, borderRadius: 8, padding: "6px 10px", fontSize: "calc(12.5px * var(--fs,1))", fontFamily: FF, color: T.ink, background: "#fff", cursor: "pointer", fontWeight: 700 }}>
          {REC_MODES.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
        </select>
      </div>
      <div>
        <div style={{ fontSize: "calc(11.5px * var(--fs,1))", color: T.sub, fontWeight: 700, marginBottom: 6 }}>관심 항목 <span style={{ color: T.mute, fontWeight: 600 }}>(체크 시 항상 상단 고정)</span></div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {CONSULTING_CATEGORIES.map((cat) => { const on = interests.includes(cat); return (
            <button key={cat} onClick={() => toggle(cat)} style={{ border: `1.5px solid ${on ? T.brand : T.line}`, background: on ? T.brandSoft : "#fff", color: on ? T.brand : T.sub, borderRadius: 999, padding: "5px 11px", fontSize: "calc(11.5px * var(--fs,1))", fontWeight: on ? 800 : 600, fontFamily: FF, cursor: "pointer", whiteSpace: "nowrap" }}>{on ? "☑" : "☐"} {cat}</button>
          ); })}
        </div>
      </div>
    </div>
  );
}
// 개인사업자일 때 모드별 안내(표시 전용)
const MODE_NOTICE = {
  capital: "개인사업자 자료에서는 주식·자본거래 컨설팅 항목이 제한됩니다. 법인 전환 후 검토가 필요합니다.",
  succession: "개인사업자 승계는 법인 지분승계와 구조가 다르므로 별도 검토가 필요합니다.",
  tax: "법인세 절세가 아닌 종합소득세/사업소득세 관점 검토가 필요합니다.",
};
// 법인전용 비활성화 묶음(개인사업자) — 삭제 대신 접힘 상태로 표시
function CorpOnlyFold({ items }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} style={{ width: "100%", textAlign: "left", border: `1px solid ${T.line}`, background: "#fff", cursor: "pointer", borderRadius: 10, padding: "9px 12px", fontFamily: FF, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: "calc(12px * var(--fs,1))", color: T.mute }}>{open ? "▾" : "▸"}</span>
        <span style={{ fontSize: "calc(13px * var(--fs,1))", fontWeight: 800, color: "#92400E" }}>🔒 법인전용 항목 {items.length}개 비활성화됨</span>
        {!open ? <span style={{ marginLeft: "auto", fontSize: "calc(10.5px * var(--fs,1))", color: T.mute }}>개인사업자 자료</span> : null}
      </button>
      {open ? <div style={{ marginTop: 8, display: "grid", gap: 6 }}>{items.map((rk) => (
        <div key={rk.s.name} style={{ border: `1px dashed ${T.line}`, borderRadius: 9, padding: "9px 11px", background: "#F8FAFC" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: "calc(12.5px * var(--fs,1))", fontWeight: 700, color: T.sub }}>{rk.s.name}</span>
            <span style={{ fontSize: "calc(10px * var(--fs,1))", fontWeight: 800, color: "#92400E", background: "#FEF3C7", border: `1px solid #FCD34D`, borderRadius: 5, padding: "1px 6px" }}>법인전용</span>
          </div>
          <div style={{ fontSize: "calc(11px * var(--fs,1))", color: T.mute, marginTop: 3 }}>{rk.s.personalNote || "개인사업자 자료에서는 적용 대상이 아닙니다."}</div>
        </div>
      ))}</div> : null}
    </div>
  );
}
// 최종 선택 항목 — 기본은 접힘(항목명/상세보기/선택취소만). '상세 보기' 클릭 시 기존 카드 상세(StrategyDetail) 펼침.
function SelectedDetailCard({ rk, onToggle }) {
  const { s, reasons } = rk;
  const tier = tierOf(rk.score);
  const keyQ = (meetingQuestionFlow(s)[0] || {}).q || (s.questions && s.questions[0]) || "";
  const [open, setOpen] = useState(false);
  return (
    <div style={{ border: `1px solid ${T.brand}55`, borderRadius: 10, background: "#fff", overflow: "hidden", boxShadow: `0 0 0 2px ${T.brand}1A` }}>
      <div style={{ padding: "10px 12px", background: T.brandSoft }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
          <span style={{ fontSize: "calc(13.5px * var(--fs,1))", fontWeight: 900, color: T.ink }}>{s.name}</span>
          <span style={{ fontSize: "calc(10px * var(--fs,1))", fontWeight: 800, color: tier.col, background: "#fff", border: `1px solid ${tier.col}44`, borderRadius: 999, padding: "1px 8px", whiteSpace: "nowrap" }}>{tier.emoji} {tier.label}</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            <button onClick={() => setOpen((o) => !o)} style={{ border: `1px solid ${T.brand}`, background: open ? T.brand : "#fff", color: open ? "#fff" : T.brand, borderRadius: 7, padding: "4px 11px", fontSize: "calc(11px * var(--fs,1))", fontWeight: 800, fontFamily: FF, cursor: "pointer" }}>{open ? "접기 ▲" : "상세 보기 ▼"}</button>
            <button onClick={() => onToggle(s.name)} style={{ border: `1px solid ${T.line}`, background: "#fff", color: T.mute, borderRadius: 7, padding: "4px 10px", fontSize: "calc(11px * var(--fs,1))", fontWeight: 700, fontFamily: FF, cursor: "pointer" }}>선택 취소</button>
          </div>
        </div>
        {keyQ ? <div style={{ fontSize: "calc(11.5px * var(--fs,1))", color: T.sub, marginTop: 6, lineHeight: 1.5, wordBreak: "keep-all" }}>❓ {keyQ}</div> : null}
      </div>
      {open ? <div style={{ padding: "10px 12px 12px", borderTop: `1px solid ${T.line}` }}><StrategyDetail s={s} reasons={reasons} /></div> : null}
    </div>
  );
}
// 추천 우선순위 보드 — ⭐관심 + 🔥/🟢/🟡/⚪ 4단계 그룹(점수 비노출). 개인사업자=법인전용 OFF.
function RecommendationBoard({ ui }) {
  const ranked = rankStrategies(ui);
  const personal = !!(ui.bizForm && ui.bizForm.isPersonal);
  const [mode, setMode] = useState(loadRecoMode);
  const [interests, setInterests] = useState(loadRecoInterests);
  const setModeP = (v) => { setMode(v); try { localStorage.setItem(RECO_MODE_KEY, v); } catch (e) {} };
  const toggle = (cat) => setInterests((arr) => { const next = arr.includes(cat) ? arr.filter((x) => x !== cat) : [...arr, cat]; try { localStorage.setItem(RECO_INTEREST_KEY, JSON.stringify(next)); } catch (e) {} return next; });
  const sortKey = (a, b) => (modeBoost(b.s, mode) - modeBoost(a.s, mode)) || (b.score - a.score);
  const corpOnly = personal ? ranked.filter((rk) => isCorpOnlyStrategy(rk.s.name)) : [];
  const usable = personal ? ranked.filter((rk) => !isCorpOnlyStrategy(rk.s.name)) : ranked;
  const interestSet = new Set(interests);
  const pinned = usable.filter((rk) => interestSet.has(rk.s.cat)).slice().sort(sortKey);
  const rest = usable.filter((rk) => !interestSet.has(rk.s.cat));
  const groups = REC_TIERS.map((t) => ({ t, items: rest.filter((rk) => tierOf(rk.score).key === t.key).slice().sort(sortKey) }));
  const modeNotice = personal ? MODE_NOTICE[mode] : null;
  // 최종 선택(기업별 localStorage)
  const [selected, setSelected] = useState(() => getSelected(ui));
  const onToggle = (name) => setSelected(toggleSelected(ui, name));
  const selectedSet = new Set(selected);
  const selectedRanked = selected.map((nm) => ranked.find((rk) => rk.s.name === nm)).filter(Boolean);
  return (
    <div style={{ display: "grid", gap: 14 }}>
      {/* 미팅 준비 흐름 안내(작고 세련되게) */}
      <div style={{ ...card, padding: "11px 14px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", background: "#FAFBFD" }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: "calc(13px * var(--fs,1))", fontWeight: 900, color: T.ink }}>🎯 미팅 제안 항목 선택</div>
          <div style={{ fontSize: "calc(11px * var(--fs,1))", color: T.mute, marginTop: 2, lineHeight: 1.5 }}>자동 추천 항목 중 실제 미팅에서 꺼낼 항목을 선택하면, 요약 탭에서 질문지와 체크리스트가 자동으로 정리됩니다.</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
          {[["1", "후보 확인"], ["2", "항목 선택"], ["3", "요약/PDF"]].map(([n, t], i) => (
            <span key={n} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              {i ? <span style={{ color: T.mute, fontSize: "calc(11px * var(--fs,1))" }}>›</span> : null}
              <span style={{ fontSize: "calc(11px * var(--fs,1))", fontWeight: 700, color: T.sub, whiteSpace: "nowrap" }}><b style={{ color: T.brand }}>{n}</b> {t}</span>
            </span>
          ))}
        </div>
      </div>
      {/* ✅ 최종 선택한 미팅 제안 항목 — 제안 탭 최상단(추천 후보보다 위) */}
      <div style={{ ...card, padding: "13px 15px", borderColor: T.brand + "66", background: selected.length ? T.brandSoft : "#fff" }}>
        <div style={{ fontSize: "calc(14.5px * var(--fs,1))", fontWeight: 900, color: T.brand }}>✅ 최종 선택한 미팅 제안 항목 {selected.length ? `(${selected.length})` : ""}</div>
        {selectedRanked.length
          ? <div style={{ fontSize: "calc(11.5px * var(--fs,1))", color: T.sub, marginTop: 2, marginBottom: 9 }}>대표님과 실제로 논의할 항목입니다. ‘상세 보기’로 질문지를 확인할 수 있습니다.</div>
          : <div style={{ fontSize: "calc(12px * var(--fs,1))", color: T.sub, marginTop: 6, lineHeight: 1.55 }}>아직 선택한 항목이 없습니다. 아래 추천 항목에서 미팅에 사용할 항목을 선택해주세요.</div>}
        {selectedRanked.length ? <div style={{ display: "grid", gap: 9 }}>{selectedRanked.map((rk) => (
          <SelectedDetailCard key={rk.s.name} rk={rk} onToggle={onToggle} />
        ))}</div> : null}
      </div>
      <RecoSettings mode={mode} setMode={setModeP} interests={interests} toggle={toggle} />
      {modeNotice ? <div style={{ fontSize: "calc(12px * var(--fs,1))", color: "#92400E", background: "#FFFBEB", border: `1px solid #FDE68A`, borderRadius: 9, padding: "10px 12px", lineHeight: 1.55, fontWeight: 700 }}>ℹ️ {modeNotice}</div> : null}
      {pinned.length ? <TierGroup emoji="⭐" label="관심 항목" col={T.brand} items={pinned} selectedSet={selectedSet} onToggle={onToggle} /> : null}
      {groups.map((g) => g.items.length ? <TierGroup key={g.t.key} emoji={g.t.emoji} label={g.t.label} col={g.t.col} items={g.items} selectedSet={selectedSet} onToggle={onToggle} folded={g.t.key === "cond" || g.t.key === "low"} /> : null)}
      {corpOnly.length ? <CorpOnlyFold items={corpOnly} /> : null}
    </div>
  );
}

// ── 별도 버튼: 추가 제안 포인트 전체(카테고리별 브라우저) — 점수 비노출, 티어 표시 ──
function ConsultingPoint({ rk }) {
  const { s, reasons } = rk;
  const [open, setOpen] = useState(false);
  const tier = tierOf(rk.score);
  const hi = rk.score >= 60;   // 🔥/🟢 강조(내부 점수, 표시 안 함)
  return (
    <div style={{ border: `1px solid ${hi ? T.brand + "55" : T.line}`, borderRadius: 10, overflow: "hidden", background: hi ? T.brandSoft : "#fff" }}>
      <button onClick={() => setOpen((o) => !o)} style={{ width: "100%", textAlign: "left", border: "none", background: "transparent", cursor: "pointer", padding: "9px 12px", fontFamily: FF, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: "calc(11px * var(--fs,1))", color: T.mute }}>{open ? "▾" : "▸"}</span>
        <span style={{ fontSize: "calc(13px * var(--fs,1))", fontWeight: 800, color: T.ink }}>{s.name}</span>
        <span title={tier.label} style={{ marginLeft: "auto", fontSize: "calc(12px * var(--fs,1))", whiteSpace: "nowrap" }}>{tier.emoji}</span>
      </button>
      {open ? <div style={{ padding: "0 12px 12px" }}><StrategyDetail s={s} reasons={reasons} /></div> : null}
    </div>
  );
}
function CategoryBlock({ cat, items }) {
  const [open, setOpen] = useState(false);
  const hiN = items.filter((rk) => rk.score >= 60).length;   // 🔥/🟢 개수(점수 비노출)
  return (
    <div style={{ border: `1px solid ${T.line}`, borderRadius: 12, overflow: "hidden" }}>
      <button onClick={() => setOpen((o) => !o)} style={{ width: "100%", textAlign: "left", border: "none", background: open ? "#F8FAFC" : "#fff", cursor: "pointer", padding: "11px 14px", fontFamily: FF, display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: "calc(12px * var(--fs,1))", color: T.mute }}>{open ? "▾" : "▸"}</span>
        <span style={{ fontSize: "calc(14px * var(--fs,1))", fontWeight: 800, color: T.ink }}>{cat}</span>
        <span style={{ fontSize: "calc(11.5px * var(--fs,1))", color: T.mute, fontWeight: 700 }}>({items.length})</span>
        {hiN ? <span style={{ marginLeft: "auto", fontSize: "calc(10.5px * var(--fs,1))", fontWeight: 800, color: T.brand, background: T.brandSoft, border: `1px solid ${T.brand}33`, borderRadius: 999, padding: "2px 9px" }}>우선 {hiN}</span> : null}
      </button>
      {open ? <div style={{ padding: 10, display: "grid", gap: 7, borderTop: `1px solid ${T.line}` }}>{items.map((rk) => <ConsultingPoint key={rk.s.name} rk={rk} />)}</div> : null}
    </div>
  );
}
function ConsultingStrategies({ ui }) {
  const ranked = rankStrategies(ui);
  const byCat = {}; ranked.forEach((rk) => { (byCat[rk.s.cat] = byCat[rk.s.cat] || []).push(rk); });
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ fontSize: "calc(11.5px * var(--fs,1))", color: T.mute, lineHeight: 1.5 }}>전체 {CONSULTING_STRATEGIES.length}개를 카테고리별로 정리했습니다. 우선순위는 🔥최우선 · 🟢권장 · 🟡조건확인 · ⚪낮음으로 표시되며, 항목을 클릭하면 추천 이유·핵심 확인사항·질문·요청 자료·기대 효과가 펼쳐집니다.</div>
      {CONSULTING_CATEGORIES.map((cat) => {
        const items = byCat[cat] || [];
        return items.length ? <CategoryBlock key={cat} cat={cat} items={items} /> : null;
      })}
    </div>
  );
}

// 실전 미팅 질문
function MeetingQuestions({ ui }) {
  const qs = buildMeetingQuestions(ui);
  return (
    <div style={{ ...card, padding: "14px 16px" }}>
      <div style={{ display: "grid", gap: 9 }}>
        {qs.map((q, i) => (
          <div key={i} style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
            <span style={{ fontSize: "calc(12px * var(--fs,1))", fontWeight: 800, color: T.brand, minWidth: 20 }}>Q{i + 1}</span>
            <span style={{ fontSize: "calc(13px * var(--fs,1))", lineHeight: 1.55, color: T.ink }}>{q}</span>
          </div>
        ))}
      </div>
      <div style={{ fontSize: "calc(11px * var(--fs,1))", color: T.mute, marginTop: 10 }}>※ 미팅에서 바로 읽을 수 있는 질문 형태로 자동 생성됩니다. 상황에 맞게 조정해 사용하세요.</div>
    </div>
  );
}

// 미팅 전 1장 요약(복사용) — 추후 PDF 저장으로 확장 가능하도록 구조화
// ── 요약 탭(미팅용 1~2장) — 모두 읽기 전용(ui + 기존 export 헬퍼 재사용). 재무 계산/매핑 무수정 ──
const SUMMARY_TONE = { bad: { label: "위험", color: SEM.bad, bg: "#FEF2F2" }, warn: { label: "주의", color: SEM.warn, bg: "#FFFBEB" }, good: { label: "기회", color: SEM.good, bg: "#ECFDF5" }, info: { label: "참고", color: SEM.neutral, bg: "#F1F5F9" } };
const SUMMARY_DOC_CATS = [
  { name: "재무/세무 자료", re: /재무제표|부가세|세무|결산|원가|손익|재무|잔액/, def: ["최근 3개년 재무제표", "부가세 신고서", "세무조정계산서"] },
  { name: "인사/고용 자료", re: /근로|4대보험|급여|조직도|인력|고용|임원/, def: ["4대보험 가입자명부", "급여대장", "조직도"] },
  { name: "인증/연구소 자료", re: /인증|연구|특허|기술|품질|벤처|개발|공정/, def: ["보유 인증 현황", "연구인력·조직 자료", "기술·특허 자료"] },
  { name: "주주/정관 자료", re: /주주|정관|가수금|의사록|지분|명부/, def: ["주주명부", "정관", "가수금 명세"] },
  { name: "금융/대출 자료", re: /대출|부채현황|여신|차입|금융|잔액증명/, def: ["대출내역서", "부채현황표"] },
];
function summaryDocBuckets(strategies) {
  const all = []; (strategies || []).forEach((s) => (s.docs || []).forEach((d) => all.push(d)));
  return SUMMARY_DOC_CATS.map((c) => { const matched = Array.from(new Set(all.filter((d) => c.re.test(d)))); return { name: c.name, items: matched.length ? matched : c.def }; });
}
function summaryEok(o) { return (o && typeof o.eok === "number") ? `${num(o.eok)}억` : "확인 필요"; }

const PRINT_CSS = "@media print{body *{visibility:hidden!important}.mini-print-area,.mini-print-area *{visibility:visible!important}.mini-print-area{position:absolute!important;left:0;top:0;width:100%;padding:0!important;--fs:0.86!important}.mini-no-print{display:none!important}.mini-print-only{display:block!important}.brief-page{break-after:page;page-break-after:always}.mini-print-area .avoid-break{break-inside:avoid;page-break-inside:avoid}@page{size:A4;margin:9mm}}";

// 요약 탭 = 미팅용 체크리스트(최종 선택 항목 중심). PDF/인쇄(window.print) 지원.
function OneLinerSummary({ ui, onTab, grade, manualGrade }) {
  const co = ui.companyInfo || {}, cp = ui.corePreview || {};
  const personal = !!(ui.bizForm && ui.bizForm.isPersonal);
  const ranked = rankStrategies(ui);
  const usableRanked = personal ? ranked.filter((r) => !isCorpOnlyStrategy(r.s.name)) : ranked;
  const top = usableRanked.slice(0, 5).map((r) => r.s);
  const selectedStrategies = getSelected(ui).map((nm) => CONSULTING_STRATEGIES.find((s) => s.name === nm)).filter(Boolean);
  const hasSelection = selectedStrategies.length > 0;
  const focus = selectedStrategies.map((s) => s.name);
  const diag = buildDiagnosisSummary(ui);
  const oneDiag = (diag.find((l) => l.tone !== "info") || diag[0] || {}).text || "";
  const fy = (ui.financialYears || []).filter((y) => typeof y === "number");
  const lastY = fy.length ? Math.max(...fy) : (cp.revenue && cp.revenue.year) || null;
  const dr = ratioVal(cp, "debtRatio");
  const cf = (cp.cashflowGrade && cp.cashflowGrade.latest) || (co.cashflowGrade && co.cashflowGrade.latest) || null;
  const industry = co.industry11 || co.stdIndustry11 || co.industry || co.standardIndustry || co.mainProduct || "확인 필요";
  const mq = buildMeetingQuestions(ui);
  const issues = diag.filter((l) => l.tone !== "info").slice(0, 5).map((l, i) => ({ tone: l.tone, text: l.text, q: mq[i] || "" }));
  const direction = hasSelection
    ? `이번 미팅에서는 ${focus.slice(0, 4).join(", ")}${focus.length > 4 ? " 등" : ""}을(를) 중심으로 확인하면 좋습니다.`
    : "제안 탭에서 항목을 선택하면 미팅 방향과 질문지가 여기에 자동으로 정리됩니다.";
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfUrl, setPdfUrl] = useState("");     // 생성된 PDF blob URL(수동 열기/저장 링크용)
  const [pdfName, setPdfName] = useState("");
  // 인앱 브라우저(카톡·네이버 등) 감지 — 인앱은 파일 다운로드/저장이 막혀 있어 기본 브라우저로 유도해야 함.
  const inApp = (() => { try { const ua = (typeof navigator !== "undefined" && navigator.userAgent) || ""; if (/KAKAOTALK/i.test(ua)) return "kakao"; if (/NAVER\(inapp/i.test(ua)) return "naver"; if (/Instagram|FBAN|FBAV|FB_IAB|Line\//i.test(ua)) return "other"; return ""; } catch (e) { return ""; } })();
  const openExternal = () => {
    try {
      const u = window.location.href;
      if (inApp === "kakao") window.location.href = "kakaotalk://web/openExternal?url=" + encodeURIComponent(u);
      else if (inApp === "naver") window.location.href = "intent:" + u.replace(/^https?:/, "") + "#Intent;scheme=https;package=com.android.chrome;end";
    } catch (e) {}
  };
  // 최후 폴백: 같은 페이지 브라우저 인쇄
  const printInline = () => { try { if (typeof window !== "undefined" && typeof window.print === "function") { window.focus(); setTimeout(() => { try { window.print(); } catch (e) {} }, 60); } } catch (e) {} };
  // PDF 저장 — 실제 PDF 파일을 만들어 모바일은 공유/저장 시트, 데스크톱은 다운로드.
  //  ※ 휴대폰/인앱 브라우저(카톡·네이버 등)에서 window.print()·새 창이 막히는 문제 해결. 라이브러리는 클릭 시 동적 로드.
  const doPrint = async () => {
    const node = (typeof document !== "undefined") ? document.querySelector(".mini-print-area") : null;
    if (!node) { printInline(); return; }
    setPdfBusy(true);
    try {
      const [h2cMod, jspdfMod] = await Promise.all([import("html2canvas"), import("jspdf")]);
      const html2canvas = h2cMod.default || h2cMod;
      const JsPDF = jspdfMod.jsPDF || jspdfMod.default;
      const canvas = await html2canvas(node, {
        backgroundColor: "#ffffff", scale: 2, useCORS: true, windowWidth: 820,
        onclone: (doc) => {
          const el = doc.querySelector(".mini-print-area");
          if (el) { el.style.setProperty("--fs", "0.92"); el.style.maxWidth = "780px"; el.style.margin = "0 auto"; el.style.padding = "0"; }
          doc.querySelectorAll(".mini-print-only").forEach((e) => { e.style.display = "block"; });
          doc.querySelectorAll(".mini-no-print").forEach((e) => { e.style.display = "none"; });
        },
      });
      const pdf = new JsPDF({ unit: "mm", format: "a4", compress: true });
      const pageW = 210, pageH = 297, margin = 8;
      const imgW = pageW - margin * 2, usableH = pageH - margin * 2;
      const imgH = (canvas.height * imgW) / canvas.width;
      const img = canvas.toDataURL("image/jpeg", 0.92);
      let heightLeft = imgH, pos = margin;
      pdf.addImage(img, "JPEG", margin, pos, imgW, imgH);
      heightLeft -= usableH;
      while (heightLeft > 0) { pos = margin - (imgH - heightLeft); pdf.addPage(); pdf.addImage(img, "JPEG", margin, pos, imgW, imgH); heightLeft -= usableH; }
      const safeName = String(co.companyName || "기업").replace(/[\\/:*?"<>|]/g, "").slice(0, 30);
      const fname = `미팅체크리스트_${safeName}.pdf`;
      const blob = pdf.output("blob");
      const file = (typeof File !== "undefined") ? new File([blob], fname, { type: "application/pdf" }) : null;
      // 1) 모바일: 파일 공유(저장) 시트 우선 — 가장 안정적(아이폰/안드로이드 정식 브라우저)
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: "미팅 체크리스트" }); return; }
        catch (e) { if (e && e.name === "AbortError") return; /* 공유 실패 → 아래 링크 노출 */ }
      }
      // 2) blob URL을 화면에 '열기/저장' 링크로 노출(사용자가 직접 탭 = 웹뷰에서도 가장 잘 동작).
      //    ※ 안드로이드 다운로드매니저는 blob: 자동 다운로드를 못 받는 경우가 많아 자동 a.click()은 데스크톱에서만.
      try { if (pdfUrl) URL.revokeObjectURL(pdfUrl); } catch (e) {}
      const url = URL.createObjectURL(blob);
      setPdfUrl(url); setPdfName(fname);
      const isMobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test((typeof navigator !== "undefined" && navigator.userAgent) || "");
      if (!isMobileUA) {
        try { const a = document.createElement("a"); a.href = url; a.download = fname; document.body.appendChild(a); a.click(); a.remove(); } catch (e) {}
      }
    } catch (e) {
      printInline();   // PDF 생성 실패 시 브라우저 인쇄로 폴백
    } finally { setPdfBusy(false); }
  };
  const today = (() => { try { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; } catch (e) { return ""; } })();

  const Sec = ({ n, title, sub, children }) => (
    <div style={{ ...card, padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: sub ? 3 : 10 }}>
        <span style={{ fontSize: "calc(11px * var(--fs,1))", fontWeight: 900, color: "#fff", background: T.brand, borderRadius: 6, padding: "2px 8px" }}>{n}</span>
        <span style={{ fontSize: "calc(14px * var(--fs,1))", fontWeight: 800, color: T.ink }}>{title}</span>
      </div>
      {sub ? <div style={{ fontSize: "calc(11px * var(--fs,1))", color: T.mute, marginBottom: 9 }}>{sub}</div> : null}
      {children}
    </div>
  );
  const kv = (k, v) => (<div style={{ display: "flex", gap: 8, fontSize: "calc(12.5px * var(--fs,1))", lineHeight: 1.5 }}><span style={{ color: T.mute, minWidth: 64, flexShrink: 0 }}>{k}</span><span style={{ color: T.ink, fontWeight: 700 }}>{v}</span></div>);

  return (
    <section style={{ marginTop: 16 }}>
      <style>{PRINT_CSS}</style>
      <div className="mini-no-print" style={{ display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: "calc(17px * var(--fs,1))", fontWeight: 900, color: T.ink }}>📝 미팅용 체크리스트</div>
          <div style={{ fontSize: "calc(11.5px * var(--fs,1))", color: T.mute, marginTop: 2, lineHeight: 1.5 }}>선택한 제안 항목을 기준으로 1차 미팅 질문과 요청자료를 정리했습니다.</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
          <button onClick={doPrint} disabled={pdfBusy} style={{ border: `1px solid ${T.brand}`, background: pdfBusy ? T.mute : T.brand, color: "#fff", borderRadius: 9, padding: "9px 15px", fontSize: "calc(12.5px * var(--fs,1))", fontWeight: 800, fontFamily: FF, cursor: pdfBusy ? "default" : "pointer", whiteSpace: "nowrap", opacity: pdfBusy ? 0.85 : 1 }}>{pdfBusy ? "PDF 만드는 중…" : "📄 미팅 체크리스트 PDF 저장"}</button>
          <span style={{ fontSize: "calc(9.5px * var(--fs,1))", color: T.mute, textAlign: "right", lineHeight: 1.4 }}>휴대폰: 공유 시트 ‘파일에 저장’ · PC: 자동 다운로드</span>
          {inApp ? (
            <div style={{ marginTop: 7, background: T.warnBg, border: `1px solid ${T.warnInk}33`, borderRadius: 9, padding: "8px 10px", maxWidth: 244 }}>
              <div style={{ fontSize: "calc(10.5px * var(--fs,1))", color: T.warnInk, fontWeight: 800, lineHeight: 1.5, textAlign: "right" }}>⚠️ {inApp === "kakao" ? "카카오톡" : inApp === "naver" ? "네이버" : "인앱"} 브라우저에서는 파일 저장이 막혀 있어요. 기본 브라우저로 열면 정상 저장됩니다.</div>
              {inApp === "kakao" || inApp === "naver" ? (
                <button onClick={openExternal} style={{ marginTop: 7, width: "100%", border: "none", borderRadius: 8, padding: "10px 10px", fontSize: "calc(11.5px * var(--fs,1))", fontWeight: 800, fontFamily: FF, color: "#fff", background: `linear-gradient(135deg,${T.brand},${T.teal})`, cursor: "pointer" }}>🌐 기본 브라우저(Chrome/Safari)로 열기</button>
              ) : (
                <div style={{ marginTop: 5, fontSize: "calc(10px * var(--fs,1))", color: T.sub, textAlign: "right", lineHeight: 1.5 }}>우측 상단 ⋮ 메뉴 → ‘다른 브라우저로 열기’</div>
              )}
            </div>
          ) : null}
          {pdfUrl ? (
            <div style={{ marginTop: 7, textAlign: "right" }}>
              <a href={pdfUrl} download={pdfName} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", textDecoration: "none", borderRadius: 9, padding: "10px 15px", fontSize: "calc(12.5px * var(--fs,1))", fontWeight: 800, fontFamily: FF, color: "#fff", background: `linear-gradient(135deg,${T.brand},${T.teal})` }}>📄 PDF 열기 / 저장</a>
              <div style={{ fontSize: "calc(9.5px * var(--fs,1))", color: T.sub, marginTop: 6, lineHeight: 1.5, maxWidth: 230, textAlign: "right" }}>저장이 안 되면 이 버튼을 <b>길게 눌러 ‘링크 저장’</b>, 카톡·네이버 인앱이면 우측 상단 메뉴 → <b>다른 브라우저로 열기</b> 후 다시 시도하세요.</div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mini-print-area" style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
        <div className="mini-print-only" style={{ display: "none", borderBottom: `2px solid ${T.ink}`, paddingBottom: 8 }}>
          <div style={{ fontSize: 18, fontWeight: 900 }}>크레탑 미팅 체크리스트</div>
          <div style={{ fontSize: 12, color: "#475569", marginTop: 3 }}>{co.companyName || "회사"} · 출력일 {today}{lastY ? ` · ${lastY}년 결산 기준` : ""}</div>
        </div>

        {/* 1. 미팅 전 30초 브리핑 — 기업 개요 + 핵심지표 16(인쇄 시 1페이지로 압축) */}
        <div className="brief-page">
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 9 }}>
            <span style={{ fontSize: "calc(11px * var(--fs,1))", fontWeight: 900, color: "#fff", background: T.brand, borderRadius: 6, padding: "2px 8px" }}>1</span>
            <span style={{ fontSize: "calc(14px * var(--fs,1))", fontWeight: 800, color: T.ink }}>미팅 전 30초 브리핑</span>
          </div>
          <div style={{ fontSize: "calc(12.5px * var(--fs,1))", color: T.ink, fontWeight: 700, background: T.brandSoft, border: `1px solid ${T.brand}22`, borderRadius: 9, padding: "9px 11px", lineHeight: 1.55, marginBottom: 11 }}>{oneDiag ? oneDiag + " " : ""}{direction}</div>
          <CompanyHeader ui={ui} grade={grade} manualGrade={manualGrade} setGrade={() => {}} isAdmin={false} compact />
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: "calc(12.5px * var(--fs,1))", fontWeight: 800, color: T.sub, marginBottom: 7 }}>핵심지표 <span style={{ fontWeight: 600, color: T.mute }}>· {lastY ? `${lastY}년 결산 기준` : "최근 결산"}</span></div>
            <CoreGrid ui={ui} grade={grade} lastY={lastY} compact />
          </div>
        </div>

        <Sec n="2" title={`오늘 반드시 확인할 핵심 이슈 (${issues.length})`}>
          <div style={{ display: "grid", gap: 9 }}>
            {issues.length ? issues.map((r, i) => { const tn = SUMMARY_TONE[r.tone] || SUMMARY_TONE.info; return (
              <div key={i} style={{ borderLeft: `3px solid ${tn.color}`, background: tn.bg, borderRadius: 8, padding: "8px 11px" }}>
                <span style={{ fontSize: "calc(10.5px * var(--fs,1))", fontWeight: 900, color: tn.color }}>{tn.label}</span>
                <div style={{ fontSize: "calc(12.5px * var(--fs,1))", color: T.ink, lineHeight: 1.5, marginTop: 2 }}>{r.text}</div>
                {r.q ? <div style={{ fontSize: "calc(11.5px * var(--fs,1))", color: T.sub, marginTop: 4 }}>❓ {r.q}</div> : null}
              </div>
            ); }) : <div style={{ fontSize: "calc(12px * var(--fs,1))", color: T.mute }}>자동 산출된 핵심 이슈가 적습니다. 원문 확인을 권장합니다.</div>}
          </div>
        </Sec>

        <Sec n="3" title={hasSelection ? `미팅 제안 예정 항목 (${selectedStrategies.length})` : "미팅 제안 예정 항목"}>
          {hasSelection ? (
            <div style={{ display: "grid", gap: 12 }}>
              {selectedStrategies.map((s, i) => (
                <div key={s.name} className="avoid-break" style={{ border: `1px solid ${T.brand}33`, borderRadius: 10, padding: "11px 13px", background: "#fff" }}>
                  <div style={{ fontSize: "calc(14px * var(--fs,1))", fontWeight: 900, color: T.brand }}>{i + 1}. {s.name}</div>
                  <div style={{ fontSize: "calc(11.5px * var(--fs,1))", color: T.sub, marginTop: 3, lineHeight: 1.5 }}>왜 제안 · {meetingShort(s)}</div>
                  <div style={{ marginTop: 8 }}><MeetingFlow s={s} title="대표에게 던질 핵심 질문 (5단계)" /></div>
                  <div style={{ marginTop: 8, fontSize: "calc(11.5px * var(--fs,1))", color: T.mute, lineHeight: 1.55 }}>📎 요청 자료 · {meetingDocs(s).join(", ")}</div>
                  <div style={{ fontSize: "calc(11.5px * var(--fs,1))", color: T.mute, lineHeight: 1.55 }}>🎯 기대 효과 · {meetingEffect(s)}</div>
                </div>
              ))}
            </div>
          ) : (
            <div>
              <div style={{ fontSize: "calc(12.5px * var(--fs,1))", color: "#92400E", background: "#FFFBEB", border: `1px solid #FDE68A`, borderRadius: 9, padding: "11px 13px", lineHeight: 1.6 }}>아직 미팅에서 제안할 항목을 선택하지 않았습니다. 제안 탭에서 대표님과 논의할 항목을 먼저 선택하면, 이곳에 미팅 질문지와 체크리스트가 자동으로 정리됩니다.</div>
              {onTab ? <button className="mini-no-print" onClick={() => onTab("reco")} style={{ marginTop: 10, border: "none", background: T.brand, color: "#fff", borderRadius: 9, padding: "10px 16px", fontSize: "calc(13px * var(--fs,1))", fontWeight: 800, fontFamily: FF, cursor: "pointer" }}>제안 탭으로 이동 →</button> : null}
              {top.length ? <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: "calc(11px * var(--fs,1))", color: T.mute, fontWeight: 700, marginBottom: 5 }}>참고 · 자동 추천 상위 항목(선택 전)</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{top.map((s) => <span key={s.name} style={{ fontSize: "calc(11.5px * var(--fs,1))", color: T.sub, background: "#F1F5F9", border: `1px solid ${T.line}`, borderRadius: 7, padding: "3px 9px" }}>{s.name}</span>)}</div>
              </div> : null}
            </div>
          )}
        </Sec>
      </div>
      <div className="mini-no-print" style={{ fontSize: "calc(10.5px * var(--fs,1))", color: T.mute, lineHeight: 1.5, padding: "8px 4px 0" }}>※ 자동 룰 기반 정리(외부 AI 미사용) · 참고용. 실제 상담 전 원문 확인이 필요합니다.</div>
    </section>
  );
}

// 하단 고정 탭 네비게이션 — 4개 탭, 각 1/4 폭, 넓은 클릭 영역
const TABS = [["overview", "개요", "🏢"], ["detail", "재무상세", "📊"], ["value", "주식가치", "💎"], ["reco", "제안", "🎯"], ["summary", "요약", "📝"]];
function BottomNav({ tab, onTab }) {
  return (
    <nav className="cretop-mini-tabs" data-testid="cretop-mini-tabs" style={{ position: "sticky", bottom: 0, background: "#fff", borderTop: `1px solid ${T.line}`, boxShadow: "0 -2px 12px rgba(15,23,42,.08)", zIndex: 30, borderRadius: "0 0 var(--radius-panel) var(--radius-panel)" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", display: "flex" }}>
        {TABS.map(([k, label, icon]) => (
          <button key={k} data-tab={k} aria-current={tab === k ? "page" : undefined} onClick={() => onTab(k)} style={{ flex: "1 1 20%", minWidth: 0, border: "none", background: tab === k ? T.brandSoft : "transparent", cursor: "pointer", padding: "9px 1px 11px", fontFamily: FF, color: tab === k ? T.brand : T.sub, fontWeight: tab === k ? 800 : 600, fontSize: "calc(11.5px * var(--fs,1))", borderTop: `2px solid ${tab === k ? T.brand : "transparent"}`, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, whiteSpace: "nowrap" }}>
            <span style={{ fontSize: "calc(18px * var(--fs,1))", lineHeight: 1 }}>{icon}</span><span>{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}

// 결과 영역 — 컨트롤드(현재 탭만 렌더). 탭 상태·입력영역·하단네비는 MiniApp이 소유.
export function MiniResults(props) {
  // [D-94] 이 보고서의 결산 연도 — 연도가 빈 칸을 채우는 데만 쓴다
  return <YearPoolCtx.Provider value={cretopYearPool(props.ui)}><MiniResultsInner {...props} /></YearPoolCtx.Provider>;
}
function MiniResultsInner({ ui, tab = "overview", grade, manualGrade, setGrade, lastY, isAdmin, onTab }) {
  if (!ui) {
    if (tab === "overview") return null; // 개요 탭은 상단 입력 카드만(부모가 렌더)
    return <div style={{ ...card, padding: 22, color: T.mute, fontSize: "calc(13px * var(--fs,1))", textAlign: "center", lineHeight: 1.6 }}>먼저 <b style={{ color: T.brand }}>🏢 개요</b> 탭에서 크레탑 보고서를 업로드해 분석을 실행하세요.</div>;
  }
  if (tab === "overview") return (<>
    <Section title="기업 개요" desc="크레탑 원문 기준 · 있는 항목만 표시"><CompanyHeader ui={ui} grade={grade} manualGrade={manualGrade} setGrade={setGrade} isAdmin={isAdmin} /></Section>
    <Section title="종합 진단 요약" desc="룰 기반 자동 요약(외부 AI 미사용)"><DiagnosisSummary ui={ui} /></Section>
    <Section title="핵심지표" desc="최근 결산연도 기준 · 색상=양호/위험/주의/정보"><CoreGrid ui={ui} grade={grade} lastY={lastY} /></Section>
  </>);
  if (tab === "detail") return (<>
    <Section title="3개년 핵심 추이" desc="연도 좌우 비교 · 증감은 보조"><TrendBlock ui={ui} /></Section>
    <Section title="5대 재무비율" desc="보고서 재무비율 표 기준 · 3개년(자료 없으면 공란)"><RatioAreas ui={ui} /></Section>
    <Section title="상세 재무제표" desc="표를 선택해 해당 항목만 보기"><StatementSection ui={ui} /></Section>
  </>);
  if (tab === "value") return <Section title="📊 예상 주식가치" desc="상증세법 보충적 평가방법 · 세금 계산기 09와 같은 계산식 · 참고용"><StockValue ui={ui} /></Section>;
  if (tab === "reco") return (<>
    <Section title="추천 컨설팅 우선순위" desc="🔥최우선 · 🟢권장 · 🟡조건확인 · ⚪낮음 · 모드/관심 항목으로 정렬"><RecommendationBoard ui={ui} /></Section>
    <Collapsible title="추가 제안 포인트 (전체)" count={CONSULTING_STRATEGIES.length} desc="카테고리별 · 항목 클릭 시 상세"><ConsultingStrategies ui={ui} /></Collapsible>
  </>);
  if (tab === "summary") return <OneLinerSummary ui={ui} onTab={onTab} grade={grade} manualGrade={manualGrade} lastY={lastY} />;
  return null;
}

const FONT_SCALES = [["기본", 1.3], ["크게", 1.55]];
// 분석 이력은 Supabase(analyses)에 저장 — data.js(listAnalyses/createAnalysis/getAnalysisResult) 사용.
// 사이드 패널 — 계정(Supabase Auth) + 분석 이력(서버) + 새 분석/로그아웃.
function Sidebar({ history, onClose, onOpen, onNew, onDelete }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.38)", zIndex: 60 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: "min(86vw,340px)", background: "#fff", boxShadow: "2px 0 18px rgba(15,23,42,.2)", display: "flex", flexDirection: "column", overflowY: "auto", "--fs": 1.15 }}>
        <div style={{ padding: "16px 16px 14px", borderBottom: `1px solid ${T.line}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: "calc(15px * var(--fs,1))", fontWeight: 900, color: T.ink }}>분석 이력</div>
            <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: "calc(18px * var(--fs,1))", color: T.mute }}>✕</button>
          </div>
          <button onClick={onNew} style={{ marginTop: 12, width: "100%", boxSizing: "border-box", border: `1px solid ${T.brand}`, borderRadius: 9, padding: "10px 12px", fontSize: "calc(13px * var(--fs,1))", fontWeight: 800, fontFamily: FF, color: T.brand, background: "#fff", cursor: "pointer", whiteSpace: "nowrap" }}>+ 새 분석 시작</button>
        </div>
        <div style={{ padding: "12px 16px" }}>
          <div style={{ fontSize: "calc(12px * var(--fs,1))", fontWeight: 800, color: T.sub, marginBottom: 8 }}>분석 이력 {history.length ? `(${history.length})` : ""}</div>
          <div style={{ fontSize: "calc(10.5px * var(--fs,1))", color: T.mute, marginBottom: 8, lineHeight: 1.5 }}>※ 누르면 재분석 없이 다시 열립니다. 원문은 저장하지 않고 분석 결과만 남깁니다.</div>
          {history.length ? (
            <div style={{ display: "grid", gap: 6 }} data-testid="cretop-mini-history">
              {history.map((h) => (
                <div key={h.id} style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => onOpen(h)} style={{ flex: 1, minWidth: 0, boxSizing: "border-box", textAlign: "left", border: `1px solid ${T.line}`, borderRadius: 9, padding: "9px 11px", background: "#fff", cursor: "pointer", fontFamily: FF }}>
                    <div style={{ fontSize: "calc(13px * var(--fs,1))", fontWeight: 800, color: T.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h.company}{h.clientName ? <span style={{ color: T.teal, fontWeight: 700 }}> · {h.clientName}</span> : null}</div>
                    <div style={{ fontSize: "calc(10.5px * var(--fs,1))", color: T.mute, marginTop: 2 }}>{(() => { try { return new Date(h.ts).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } })()}</div>
                  </button>
                  {onDelete ? <button onClick={() => onDelete(h)} title="이력에서 지우기" style={{ border: `1px solid ${T.line}`, borderRadius: 9, background: "#fff", color: T.mute, cursor: "pointer", padding: "0 10px", fontFamily: FF }}>✕</button> : null}
                </div>
              ))}
            </div>
          ) : <div style={{ fontSize: "calc(12px * var(--fs,1))", color: T.mute }}>아직 분석 이력이 없습니다.</div>}
        </div>
        <div style={{ marginTop: "auto", padding: "10px 16px", borderTop: `1px solid ${T.line}`, display: "grid", gap: 8 }}>
          <div style={{ fontSize: "calc(10.5px * var(--fs,1))", color: T.mute, lineHeight: 1.5 }}>※ 분석 이력은 이 OS 의 모듈 기록에 저장됩니다(클라우드 모드면 작업실 안 다른 기기에서도 보입니다).</div>
        </div>
      </div>
    </div>
  );
}

// 분석 앱 — 원본 AnalysisApp 에서 인증·체험 한도만 걷어냈다. 화면 구성(상단·입력·결과·하단 탭)은 그대로.
//  extraInput: 입력 카드 아래(업체 서류함 보고서로 분석 등) · resultBar(ui): 결과 위(복사·업체 기록에 붙이기)
//  history / onSaved / onDelete: 분석 이력(모듈 기록) · initial: 화면을 옮겼다 돌아왔을 때 이어 보기
let lastSession = null;
/** [D-94] 방금 분석한 보고서 원문 — 핵심지표 검수·숫자 추출기가 같은 글로 바로 시작하게 */
export function lastCretopSource() {
  return lastSession && lastSession.text ? { text: lastSession.text, fileName: lastSession.fileName || "" } : null;
}
// [D-98] 테마를 바꾸면 새로고침 없이 따라간다 — 이 파일의 T 와 다른 화면(주식가치·상세 창)이 쓰는 theme.js 의 T 둘 다
const syncBrand = brandSync({ brand: ["700", "#1D4ED8"], brandSoft: ["50", "#EFF4FF"] }, [T, SHARED_T]);

export function CretopMiniApp({ history = [], onSaved, onDelete, extraInput, resultBar, pendingFile, onPendingDone }) {
  useThemeRerender();
  syncBrand();
  const [mode, setMode] = useState("pdf"); // pdf | text
  const [text, setText] = useState(() => (lastSession ? lastSession.text : ""));
  const [fileName, setFileName] = useState(() => (lastSession ? lastSession.fileName : ""));
  const [pdfPages, setPdfPages] = useState(() => (lastSession ? lastSession.pdfPages : null));   // PDF 페이지별 텍스트(섹션 추출 정확도용)
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [ui, setUi] = useState(() => (lastSession ? lastSession.ui : null));
  // [D-111] 주식가치 조건을 고치면 결과 위 요약 막대(1장 요약 · 업체 기록 붙이기)도 새 값으로
  const [, setSvTick] = useState(0);
  useEffect(() => { const f = () => setSvTick((n) => n + 1); window.addEventListener(SV_EVENT, f); return () => window.removeEventListener(SV_EVENT, f); }, []);
  const [err, setErr] = useState("");
  // [D-94] 하단 탭 화면은 주소에 둔다 — 원본의 앱 안 ‘← 뒤로 / 앞으로 →’ 단추 대신 브라우저 뒤로 가기가 탭을 오간다
  const [searchParams, setSearchParams] = useSearchParams();
  const viewParam = searchParams.get("view");
  const tab = TABS.some(([k]) => k === viewParam) ? viewParam : "overview";
  const setTab = useCallback((t, replace = false) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (t === "overview") next.delete("view"); else next.set("view", t);
      return next;
    }, { replace });
  }, [setSearchParams]);
  // 화면을 옮겼다 돌아왔을 때(주소에 view 가 없을 때) 보던 탭으로 이어 보기 — 원본 동작
  useEffect(() => {
    if (!viewParam && lastSession && lastSession.ui && lastSession.tab && lastSession.tab !== "overview") setTab(lastSession.tab, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [manualGrade, setManualGrade] = useState(null); // 신용등급 직접 선택
  const [sidebar, setSidebar] = useState(false);     // 햄버거 사이드 패널
  // 글자 크기 — 2단계 폰트 배율(박스 X, 글자만). 기본 1.3 / 크게 1.55. localStorage 저장.
  const [fontScale, setFontScale] = useState(() => {
    try { const v = parseFloat(localStorage.getItem("mini_fontScale")); return [1.3, 1.55].includes(v) ? v : 1.3; } catch (e) { return 1.3; }
  });
  const [isMobile, setIsMobile] = useState(() => { try { return window.innerWidth < 640; } catch (e) { return false; } });
  // [D-113] 입력 칸 펼침 — 결과가 없으면 늘 펼침, 새로 분석하면 접는다
  const [inputOpen, setInputOpen] = useState(false);
  useEffect(() => { setInputOpen(false); }, [ui]);
  useEffect(() => {
    const f = () => { try { setIsMobile(window.innerWidth < 640); } catch (e) {} };
    f(); window.addEventListener("resize", f); return () => window.removeEventListener("resize", f);
  }, []);
  useEffect(() => { lastSession = { text, fileName, pdfPages, ui, tab }; }, [text, fileName, pdfPages, ui, tab]);
  const pickScale = (v) => { setFontScale(v); try { localStorage.setItem("mini_fontScale", String(v)); } catch (e) {} };
  const [rawViewOpen, setRawViewOpen] = useState(false);   // 원문 텍스트 보기(추출 디버그)
  useEffect(() => { setManualGrade(null); }, [ui]); // 새 분석/이력 열람 시 직접선택 초기화
  const scrollTop = () => { try { window.scrollTo({ top: 0, behavior: "auto" }); } catch (e) {} };

  // [D-94] 원본의 앱 안 뒤로/앞으로(스냅샷 스택)는 뺐다 — OS 안에서는 브라우저 뒤로 가기와 두 갈래가 되어 헷갈렸다
  const goTab = (t) => { if (t !== tab) setTab(t); scrollTop(); };  // 탭 전환 = 화면 전환 + 주소 기록
  useEffect(() => { scrollTop(); }, [tab]); // 브라우저 뒤로 가기로 탭이 바뀌어도 맨 위부터
  // 저장된 분석 다시 열기 — 재분석 없음
  const openHistory = (h) => {
    setSidebar(false); setErr("");
    setUi(h.ui); setTab("overview"); scrollTop();
  };
  const newAnalysis = () => { setUi(null); setText(""); setFileName(""); setPdfPages(null); setStatus(""); setErr(""); setSidebar(false); setTab("overview"); scrollTop(); };
  const parsedGrade = (ui && ui.companyInfo && ui.companyInfo.creditGrade) || null;
  const grade = manualGrade || gradeToOption(parsedGrade);
  const fy = ui ? (ui.financialYears || []).filter((y) => typeof y === "number") : [];
  const lastY = fy.length ? Math.max(...fy) : (ui && ui.corePreview && ui.corePreview.revenue && ui.corePreview.revenue.year) || null;
  const isAdmin = true;   // 이 OS 에서는 대표가 곧 관리자 — 원문 추출 상태(🐞)를 볼 수 있다

  async function readFile(file) {
    if (!file) return;
    setErr(""); setUi(null); setBusy(true); setFileName(file.name);
    if (!/\.pdf$/i.test(file.name)) {
      try { const t = await file.text(); setText(t); setPdfPages(null); setMode("text"); setStatus(`읽기 완료 · ${t.length.toLocaleString()}자. '재무진단 실행'을 눌러주세요.`); }
      catch (e2) { setErr("파일을 읽지 못했습니다."); setStatus(""); }
      finally { setBusy(false); }
      return;
    }
    setStatus("PDF에서 텍스트를 추출하는 중…");
    try {
      const { text: extracted, pages } = await extractPdfText(file, (p, total) => setStatus(`PDF 텍스트 추출 중… (${p}/${total}쪽)`));
      setText(extracted); setPdfPages(pages || null);
      setStatus(`추출 완료 · ${extracted.length.toLocaleString()}자 · ${pages ? pages.length : 0}쪽.`);
      setBusy(false);
      // [D-94] 추출이 끝나면 바로 진단한다 — 원본은 ‘재무진단 실행’ 을 한 번 더 눌러야 했다. 엔진·입력은 같다(buildResult 그대로)
      await runDiagnosis(extracted, pages || null);
    } catch (e2) {
      setErr("PDF에서 텍스트를 읽지 못했습니다. 텍스트 붙여넣기로 시도해보세요. (" + (e2 && e2.message ? e2.message : "오류") + ")");
      setStatus("");
    } finally { setBusy(false); }
  }
  function onPickFile(e) { const file = e.target.files && e.target.files[0]; void readFile(file); }
  // 업체 서류함에서 가져온 파일(바깥에서 넘겨줌)
  useEffect(() => {
    if (!pendingFile) return;
    void readFile(pendingFile).then(() => { if (onPendingDone) onPendingDone(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingFile]);

  // 엔진 분석 — 원본 buildResult 그대로
  const buildResult = (raw, pages) => analyzeCretopText(raw, pages);   // [D-119] 원본 buildResult 그대로 — analysisCore.js 로 옮김
  async function runDiagnosis(rawArg, pagesArg) {
    setErr("");
    const fromArg = typeof rawArg === "string";   // [D-94] 막 추출한 글을 바로 넘겨받을 때(상태 반영 전)
    const raw = ((fromArg ? rawArg : text) || "").trim();
    const pagesIn = fromArg ? pagesArg : pdfPages;
    if (!raw) { setErr("크레탑 PDF를 업로드하거나 보고서 텍스트를 붙여넣어 주세요."); return; }
    setBusy(true); setStatus("재무진단 분석 중…");
    await new Promise((r) => setTimeout(r, 20)); // 동기 엔진 — UI 끊김 방지용 한 틱
    let result;
    try {
      result = buildResult(raw, pagesIn);
    } catch (e) {
      setErr("분석 중 오류가 발생했습니다: " + (e && e.message ? e.message : "알 수 없는 오류"));
      setBusy(false); setStatus(""); return;
    }
    setUi(result); setStatus(""); setBusy(false); setTab("overview"); scrollTop();
    if (onSaved) onSaved(result);
  }

  return (
    <div className="cretop-mini" data-testid="cretop-mini" style={{ fontFamily: FF, background: T.bg, color: T.ink, overflowX: "clip", "--fs": 1, borderRadius: "var(--radius-panel)", border: `1px solid ${T.line}` }}>{/* [D-94] hidden → clip: hidden 이면 이 상자가 스크롤 상자가 되어 하단 탭이 화면에 붙지 않고 맨 끝 내용을 가렸다 */}
      {/* 상단: 햄버거 + 서비스명 + 글자 크기 (정상 크기 — 콘텐츠만 확대) */}
      <header style={{ background: T.surface, borderBottom: `1px solid ${T.line}`, borderRadius: "var(--radius-panel) var(--radius-panel) 0 0" }}>
        <div style={{ maxWidth: 1040, margin: "0 auto", padding: "10px 12px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {/* [D-94] OS 모듈 머리줄이 이미 '크레탑 분석기' 를 보여 준다 — 원본의 로고·'법인 재무진단' 제목은 겹쳐서 뺐다. ☰ 는 무엇을 여는지 글로 적는다 */}
          <button onClick={() => setSidebar(true)} title="분석 이력" data-testid="cretop-mini-menu" style={{ border: `1px solid ${T.line}`, background: "#fff", cursor: "pointer", borderRadius: 9, height: 36, padding: "0 12px", fontSize: "calc(13px * var(--fs,1))", fontWeight: 800, fontFamily: FF, color: T.ink, flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}><span aria-hidden="true" style={{ fontSize: "calc(16px * var(--fs,1))" }}>☰</span>분석 이력{history.length ? ` ${history.length}` : ""}</button>
          <div style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 6 }}>
            {!isMobile ? <span style={{ fontSize: "calc(11px * var(--fs,1))", color: T.mute, fontWeight: 700 }}>글자크기</span> : null}
            <div style={{ display: "inline-flex", background: T.lineSoft, borderRadius: 9, padding: 2 }}>
              {FONT_SCALES.map(([label, v]) => (
                <button key={v} onClick={() => pickScale(v)} title={`${label} (${Math.round(v * 100)}%)`} style={{ border: "none", cursor: "pointer", borderRadius: 7, padding: isMobile ? "4px 8px" : "6px 12px", fontSize: isMobile ? 11 : 12.5, fontWeight: 800, fontFamily: FF, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 4, background: fontScale === v ? T.surface : "transparent", color: fontScale === v ? T.brand : T.sub, boxShadow: fontScale === v ? "0 1px 2px rgba(15,23,42,.08)" : "none" }}>
                  <span style={{ fontSize: isMobile ? 10 : 12.5, fontWeight: 900, letterSpacing: -0.5 }}>Aa</span>{label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* 안내 (원본 상단 안내에서 '정식 출시 전·기기별 저장' 부분은 이 OS 에 맞지 않아 뺐다) */}
      <div style={{ background: "#FFF7ED", borderBottom: `1px solid #F59E0B40` }}>
        <div style={{ maxWidth: 1040, margin: "0 auto", padding: "11px 14px", color: "#92400E", fontSize: 12.5, lineHeight: 1.6 }}>
          분석 결과는 참고용이며, 실제 상담 전 원문 확인이 필요합니다. 규칙 계산이며 외부 호출은 없습니다.
        </div>
      </div>

      {sidebar ? <Sidebar history={history} onClose={() => setSidebar(false)} onOpen={openHistory} onNew={newAnalysis} onDelete={onDelete} /> : null}
      {rawViewOpen ? <RawTextModal text={text} pages={pdfPages} onClose={() => setRawViewOpen(false)} /> : null}

      {/* 콘텐츠(main)만 --fs로 글자 확대 → 박스는 그대로, 헤더/하단탭/사이드바는 정상 크기 */}
      <div style={{ maxWidth: tab === "reco" ? 980 : 720, margin: "0 auto", padding: "16px 14px 16px", width: "100%", boxSizing: "border-box", overflowX: "hidden", "--fs": fontScale }}>
        {/* 개요 탭에서만 입력/업로드 영역 노출.
            [D-113] 분석이 끝나면 한 줄로 접는다 — 휴대폰에서 결과를 보려면 입력 칸을 한참 내려야 했다. 누르면 다시 펼친다. */}
        {tab === "overview" && ui && !inputOpen ? (
          <button type="button" data-testid="cretop-input-collapsed" onClick={() => setInputOpen(true)}
            style={{ ...card, width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", marginBottom: 8, cursor: "pointer", fontFamily: FF, textAlign: "left", boxSizing: "border-box" }}>
            <span aria-hidden="true" style={{ fontSize: "calc(15px * var(--fs,1))" }}>📄</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: "calc(11.5px * var(--fs,1))", fontWeight: 800, color: T.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fileName || "붙여넣은 원문"} 분석 결과</span>
              <span style={{ display: "block", fontSize: "calc(9.5px * var(--fs,1))", color: T.mute, marginTop: 1 }}>다른 보고서로 새로 분석하려면 누르세요</span>
            </span>
            <span style={{ fontSize: "calc(10.5px * var(--fs,1))", fontWeight: 800, color: T.brand, border: `1px solid ${T.brand}55`, borderRadius: 8, padding: "5px 9px", whiteSpace: "nowrap", background: "#fff" }}>새 분석 ▾</span>
          </button>
        ) : null}
        {tab === "overview" && (!ui || inputOpen) ? (
          <div style={{ ...card, padding: isMobile ? 16 : 22, marginBottom: 8, "--fs": isMobile ? fontScale : fontScale * 1.3 }}>
            {ui ? <button type="button" onClick={() => setInputOpen(false)} style={{ float: "right", border: "none", background: "transparent", color: T.mute, fontFamily: FF, fontSize: "calc(11px * var(--fs,1))", fontWeight: 700, cursor: "pointer", padding: "2px 4px" }}>접기 ▴</button> : null}
            <div style={{ fontSize: "calc(14.5px * var(--fs,1))", fontWeight: 800, marginBottom: 6 }}>{ui ? "새 분석 / 다시 분석" : "크레탑 보고서로 재무진단 시작"}</div>
            <div style={{ fontSize: "calc(12px * var(--fs,1))", color: T.sub, marginBottom: 16, lineHeight: 1.5 }}>크레탑(KRD) 기업종합보고서 PDF를 올리거나 텍스트를 붙여넣고 진단을 실행하세요. 데이터는 브라우저에서만 처리됩니다.</div>
            <div style={{ display: "flex", width: "100%", maxWidth: 380, background: T.lineSoft, borderRadius: 10, padding: 4, marginBottom: 16 }}>{/* [D-94] 좁은 칸에서도 두 단추가 한 줄에 반씩 */}
              {[["pdf", "PDF 업로드"], ["text", "텍스트 붙여넣기"]].map(([k, label]) => (
                <button key={k} onClick={() => setMode(k)} style={{ flex: "1 1 0", minWidth: 0, border: "none", cursor: "pointer", borderRadius: 8, padding: "9px 10px", fontSize: "calc(12.5px * var(--fs,1))", fontWeight: 700, fontFamily: FF, wordBreak: "keep-all", background: mode === k ? T.surface : "transparent", color: mode === k ? T.brand : T.sub, boxShadow: mode === k ? "0 1px 2px rgba(15,23,42,.08)" : "none" }}>{label}</button>
              ))}
            </div>
            {mode === "pdf" ? (
              <label style={{ display: "block", border: `1.5px dashed ${T.brand}55`, borderRadius: 14, background: T.brandSoft, padding: "30px 18px", textAlign: "center", cursor: "pointer" }}>
                <input type="file" accept="application/pdf,.pdf,.txt,text/plain" aria-label="크레탑 보고서 파일" onChange={onPickFile} style={{ display: "none" }} />
                <div style={{ fontSize: "calc(13.5px * var(--fs,1))", fontWeight: 700, color: T.brand }}>📄 크레탑 PDF 선택</div>
                <div style={{ fontSize: "calc(11.5px * var(--fs,1))", color: T.sub, marginTop: 8, wordBreak: "break-all" }}>{fileName ? `선택됨: ${fileName}` : "클릭해서 PDF 파일을 선택하세요"}</div>
              </label>
            ) : (
              <textarea aria-label="크레탑 원문" value={text} onChange={(e) => { setText(e.target.value); setPdfPages(null); }} placeholder="크레탑 기업종합보고서 텍스트를 붙여넣으세요."
                style={{ width: "100%", minHeight: 172, boxSizing: "border-box", border: `1px solid ${T.line}`, borderRadius: 10, padding: 14, fontSize: "calc(12px * var(--fs,1))", fontFamily: FF, color: T.ink, lineHeight: 1.55, resize: "vertical", outline: "none" }} />
            )}
            {extraInput ? <div style={{ marginTop: 12 }}>{extraInput}</div> : null}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
              <button onClick={runDiagnosis} disabled={busy} data-testid="cretop-run" style={{ border: "none", borderRadius: 11, padding: "14px 26px", fontSize: "calc(13.5px * var(--fs,1))", fontWeight: 800, fontFamily: FF, whiteSpace: "nowrap", cursor: busy ? "default" : "pointer", color: "#fff", background: busy ? T.mute : `linear-gradient(135deg,${T.brand},${T.teal})`, opacity: busy ? 0.8 : 1 }}>{busy ? "처리 중…" : "재무진단 실행"}</button>
              {status ? <span style={{ fontSize: "calc(12px * var(--fs,1))", color: T.sub }}>{status}</span> : null}
            </div>
            {err ? <div style={{ marginTop: 12, fontSize: "calc(12px * var(--fs,1))", color: T.warnInk, background: T.warnBg, border: `1px solid ${T.warnInk}22`, borderRadius: 8, padding: "10px 12px" }}>{err}</div> : null}
            {(text || (pdfPages && pdfPages.length)) ? <button onClick={() => setRawViewOpen(true)} style={{ marginTop: 12, border: `1px solid ${T.line}`, background: "#fff", color: T.mute, borderRadius: 8, padding: "7px 12px", fontSize: "calc(11.5px * var(--fs,1))", fontWeight: 700, fontFamily: FF, cursor: "pointer" }}>🔎 PDF 에서 읽은 원문 보기</button> : null}
          </div>
        ) : null}

        {ui && resultBar ? <div style={{ margin: "8px 0" }}>{resultBar(ui, getSelected(ui))}</div> : null}

        <div id="mini-results">
          <NarrowCtx.Provider value={isMobile}>
            <MiniResults ui={ui} tab={tab} grade={grade} manualGrade={manualGrade} setGrade={setManualGrade} lastY={lastY} isAdmin={isAdmin} onTab={goTab} />
          </NarrowCtx.Provider>
        </div>
      </div>

      <BottomNav tab={tab} onTab={goTab} />
    </div>
  );
}
