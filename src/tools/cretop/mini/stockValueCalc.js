// 크레탑 미니앱 — 예상 주식가치 계산 재료 (D-111).
//  * 주식가치 탭(StockValue.jsx) · 1장 요약 복사 · 업체 기록 붙이기가 모두 여기서 같은 값을 얻는다.
//  * 계산식 자체는 세금 계산기 09 의 unlistedShareValuation() — 여기서 식을 새로 만들지 않는다 (D-109).
//  * 사람이 고친 값(발행주식수 · 평가 조건)은 회사별(사업자번호/회사명)로 이 브라우저에 기억한다 — 선택 항목(selection.js)과 같은 규칙.
import { unlistedShareValuation } from "../../../services/taxCalc";
import { selKey } from "./selection.js";

const KEY = "mini_stock_value_v1";
/** 주식가치 조건이 바뀌면 알린다 — 결과 위 요약 막대가 다시 그린다 */
export const SV_EVENT = "cretop-stock-value";

export const num = (v) => { const n = parseFloat(String(v ?? "").replace(/[^0-9.-]/g, "")); return isFinite(n) ? n : 0; };
export const commas = (v) => { const t = String(v ?? "").trim(); if (t === "" || t === "-") return t; return num(t).toLocaleString("en-US", { maximumFractionDigits: 4 }); };
export const won = (n) => (n == null || !isFinite(n)) ? "—" : Math.round(n).toLocaleString() + "원";
export const pctText = (x, d = 1) => (x == null || !isFinite(x)) ? "—" : (x * 100).toFixed(d) + "%";

const tr = (ui, k) => (ui.trendRows || []).find((r) => r.key === k && r.trend && r.trend.series);
const latestEok = (row) => (row && row.trend.latest && typeof row.trend.latest.val === "number") ? row.trend.latest.val : null;

/** 재무상태표 계정 금액(원) — 이름이 맞는 줄의 마지막(최근) 값을 더한다 */
export function bsWon(ui, names) {
  const bs = ui.detailStatements && ui.detailStatements.balanceSheet;
  if (!bs || !bs.items) return null;
  const u = bs.unit || "천원"; const f = u === "원" ? 1 : u === "천원" ? 1000 : u === "백만원" ? 1e6 : u === "억원" ? 1e8 : 1000;
  let sum = null;
  for (const name of names) {
    const it = bs.items.find((x) => String(x.rawLabel || x.account || "").replace(/[\s()*]/g, "") === name);
    const vals = it ? (it.numberCandidates || []).filter((v) => typeof v === "number") : [];
    if (vals.length) sum = (sum || 0) + vals[vals.length - 1] * f;
  }
  return sum;
}

/** 원문에서 읽은 3개년 당기순이익(오래된→최근) */
export function netIncomeYears(ui) {
  const niRow = tr(ui, "netIncome");
  const niSeries = niRow ? niRow.trend.series.filter((s) => typeof s.val === "number") : [];
  return niSeries.slice(-3).slice().sort((a, b) => (a.year || 0) - (b.year || 0));
}

export function autoShares(ui) {
  return (ui.shares && ui.shares > 0) ? ui.shares : null;
}

/** 원문 값으로 채운 평가 조건 (문자열 — 입력 칸 그대로) */
export function svDefaults(ui) {
  const last3 = netIncomeYears(ui);
  const eqRow = tr(ui, "totalEquity");
  const equityEok = latestEok(eqRow) != null ? latestEok(eqRow)
    : (ui.corePreview && ui.corePreview.totalEquity && typeof ui.corePreview.totalEquity.eok === "number" ? ui.corePreview.totalEquity.eok : null);
  const assetEok = latestEok(tr(ui, "totalAssets"));
  const debtEok = latestEok(tr(ui, "totalLiabilities"));
  const reBookAuto = bsWon(ui, ["토지", "건물", "구축물", "투자부동산"]);
  const yearsWon = [null, null, null];
  // 오래된→최근을 [1년전(가중1), 직전(가중2), 결산연도(가중3)] 자리에 뒤에서부터 채운다
  last3.forEach((s, i) => { yearsWon[3 - last3.length + i] = s.val * 1e8; });
  const asset = assetEok != null ? assetEok * 1e8 : (equityEok != null ? equityEok * 1e8 + (debtEok != null ? debtEok * 1e8 : 0) : null);
  const debt = debtEok != null ? debtEok * 1e8 : (asset != null && equityEok != null ? asset - equityEok * 1e8 : null);
  const s = (n) => (n == null ? "" : commas(String(Math.round(n))));
  return {
    rate: "10", type: "일반법인",
    asset: s(asset), debt: s(debt),
    reBook: s(reBookAuto ?? 0), reFair: s(reBookAuto ?? 0), severance: "0", goodwill: "0",
    inc0: s(yearsWon[0]), inc1: s(yearsWon[1]), inc2: s(yearsWon[2]),
    month0: "0", month1: "0", month2: "0", cap0: "0", cap1: "0", cap2: "0",
  };
}

/** 이 회사에 대해 사람이 고쳐 둔 값 — { shares?: string, cond?: object } */
export function svLoad(ui) {
  try { const all = JSON.parse(localStorage.getItem(KEY) || "{}"); const v = all[selKey(ui)]; return v && typeof v === "object" ? v : {}; } catch { return {}; }
}

/**
 * 고친 값만 남긴다 — 원문 그대로면 칸을 비운 표시({at})만 남긴다(열어 보기만 해서는 값이 쌓이지 않게).
 * D-112: 바뀔 때마다 알림에 회사 · 값 · 시각을 실어 보낸다 — 크레탑 화면이 분석 이력(클라우드)에 같이 저장한다.
 */
export function svSave(ui, { shares, cond }) {
  const co = (ui && ui.companyInfo) || {};
  const at = new Date().toISOString();
  const entry = { at };
  if (shares !== undefined && shares !== null) entry.shares = shares;
  if (cond) entry.cond = cond;
  try {
    const all = JSON.parse(localStorage.getItem(KEY) || "{}");
    all[selKey(ui)] = entry;
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch { /* 저장 못 해도 화면 계산은 된다 */ }
  try { window.dispatchEvent(new CustomEvent(SV_EVENT, { detail: { company: co.companyName || "", bizNo: co.businessNo || "", entry } })); } catch { /* 무시 */ }
}

/**
 * D-112: 분석 이력(클라우드)에 있던 값을 이 브라우저로 — 이 브라우저 값보다 새것일 때만 덮는다.
 * 다른 기기 · 다른 직원이 고친 평가 조건이 여기서도 보이게. 바꿨으면 true.
 */
export function svRestore(ui, entry) {
  if (!entry || typeof entry !== "object" || typeof entry.at !== "string") return false;
  try {
    const all = JSON.parse(localStorage.getItem(KEY) || "{}");
    const k = selKey(ui);
    const cur = all[k];
    if (cur && typeof cur.at === "string" && cur.at >= entry.at) return false;
    all[k] = entry;
    localStorage.setItem(KEY, JSON.stringify(all));
    return true;
  } catch { return false; }
}

export function parseShares(v) {
  const n = parseInt(String(v ?? "").replace(/[^0-9]/g, ""), 10);
  return (n && n > 0) ? n : null;
}

/** 조건 → 09 계산 결과 (계산할 재료가 없으면 null) */
export function svCompute(ui, shares, cond) {
  const yearsFound = netIncomeYears(ui).length;
  if (!shares || cond.asset === "" || yearsFound === 0) return null;
  return unlistedShareValuation({
    shares, ratePct: num(cond.rate), asset: num(cond.asset), debt: num(cond.debt),
    reBook: num(cond.reBook), reFair: num(cond.reFair), severance: num(cond.severance), goodwill: num(cond.goodwill),
    corpType: cond.type,
    income: [num(cond.inc0), num(cond.inc1), num(cond.inc2)],
    months: [num(cond.month0), num(cond.month1), num(cond.month2)],
    caps: [num(cond.cap0), num(cond.cap1), num(cond.cap2)],
  });
}

/** 지금 이 회사의 주식가치 — 고친 값이 있으면 그것, 없으면 원문 값 */
export function svCurrent(ui) {
  const saved = svLoad(ui);
  const defaults = svDefaults(ui);
  const cond = saved.cond ? { ...defaults, ...saved.cond } : defaults;
  const sharesText = saved.shares != null ? saved.shares : (autoShares(ui) ? String(autoShares(ui)) : "");
  const shares = parseShares(sharesText);
  const bf = ui.bizForm || {};
  const r = bf.isPersonal ? null : svCompute(ui, shares, cond);
  return { r, shares, cond, edited: !!saved.cond, sharesEdited: saved.shares != null };
}

/** 1장 요약 · 업체 기록에 붙일 줄 (계산이 안 되면 빈 배열) */
export function svSummaryLines(ui) {
  const { r, shares, edited } = svCurrent(ui);
  if (!r) return [];
  return [
    "■ 예상 주식가치 (세금 계산기 09 · 상증세법 보충적 평가)",
    `1주당 ${won(r.finalPerShare)} · 기업가치 ${won(r.totalValue)} (발행주식수 ${shares.toLocaleString()}주)`,
    `${r.corpType} · 순자산 ${pctText(r.wNetAsset, 0)} : 순손익 ${pctText(r.wIncome, 0)}${r.minFloor > r.weightedValue ? " · 최저 한도(순자산 80%) 적용" : ""}${edited ? " · 평가 조건 고친 값" : " · 크레탑 원문 값"}`,
  ];
}
