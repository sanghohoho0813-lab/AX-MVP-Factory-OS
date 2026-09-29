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

// [D-136] 엔진이 '확인 필요'로 표시한 칸(최신 연도 빈칸 · 단위 모름 · 표끼리 다름)은 평가 조건에 자동으로 채우지 않는다(직접 적는다)
const cpBad = (ui, k) => !!(ui.corePreview && ui.corePreview[k] && ui.corePreview[k].needsCheck);
const tr = (ui, k) => (cpBad(ui, k) ? undefined : (ui.trendRows || []).find((r) => r.key === k && r.trend && r.trend.series));
const latestEok = (row) => (row && row.trend.latest && typeof row.trend.latest.val === "number") ? row.trend.latest.val : null;
const UNIT_WON = { "원": 1, "천원": 1000, "만원": 1e4, "백만원": 1e6, "억원": 1e8 };

/**
 * 재무상태표 계정 금액(원) — 이름이 맞는 줄의 최신 연도 칸 값을 더한다.
 * [D-136] 표의 단위(단위:백만원 등)를 그대로 쓴다 · 최신 연도 칸이 비었으면 예전 연도 값으로 채우지 않는다 · 단위를 모르면 null.
 */
export function bsWon(ui, names) {
  const bs = ui.detailStatements && ui.detailStatements.balanceSheet;
  if (!bs || !bs.items) return null;
  const f = UNIT_WON[bs.unit || "천원"];
  if (f == null) return null;
  let sum = null;
  for (const name of names) {
    const it = bs.items.find((x) => String(x.rawLabel || x.account || "").replace(/[\s()*]/g, "") === name);
    const nc = it ? (it.numberCandidates || []) : [];
    const last = nc.length ? nc[nc.length - 1] : null;
    if (typeof last === "number") sum = (sum || 0) + last * f;
  }
  return sum;
}

/** 원문에서 읽은 3개년 당기순이익(오래된→최근, 숫자 있는 해만) */
export function netIncomeYears(ui) {
  return netIncomeSlots(ui).filter((s) => typeof s.val === "number");
}

/**
 * [D-136] 가중치 자리 [1년전(×1), 직전(×2), 결산연도(×3)] 에 맞춘 당기순이익(억) — 연도로 자리를 정한다.
 * 결산연도 칸이 비었으면 그 자리는 null(예전에는 숫자 있는 해를 뒤에서부터 채워 2023년 값이 결산연도 자리에 앉았다).
 */
export function netIncomeSlots(ui) {
  const row = tr(ui, "netIncome");
  const ser = row ? row.trend.series : [];
  const dated = ser.filter((s) => typeof s.year === "number");
  if (dated.length) {
    const ly = Math.max(...dated.map((s) => s.year));
    return [ly - 2, ly - 1, ly].map((y) => { const hit = dated.find((s) => s.year === y); return { year: y, val: hit && typeof hit.val === "number" ? hit.val : null }; });
  }
  const nums = ser.filter((s) => typeof s.val === "number").slice(-3);
  const out = [{ year: null, val: null }, { year: null, val: null }, { year: null, val: null }];
  nums.forEach((s, i) => { out[3 - nums.length + i] = { year: s.year || null, val: s.val }; });
  return out;
}

/** [D-136] 이 보고서의 결산연도 — 고쳐 둔 평가 조건이 어느 보고서 기준인지 적어 둔다 */
export function svBasis(ui) {
  const fy = ((ui && ui.financialYears) || []).filter((y) => typeof y === "number");
  if (fy.length) return String(Math.max(...fy));
  const ys = netIncomeSlots(ui || {}).map((s) => s.year).filter((y) => typeof y === "number");
  return ys.length ? String(Math.max(...ys)) : "";
}
/** 원문(결산연도)에서 오는 평가 조건 — 다른 보고서(결산연도)에서 고친 값은 가져오지 않는다 */
const REPORT_FIELDS = new Set(["asset", "debt", "reBook", "reFair", "inc0", "inc1", "inc2", "month0", "month1", "month2", "cap0", "cap1", "cap2"]);

export function autoShares(ui) {
  return (ui.shares && ui.shares > 0) ? ui.shares : null;
}

/** 원문 값으로 채운 평가 조건 (문자열 — 입력 칸 그대로) */
export function svDefaults(ui) {
  const slots = netIncomeSlots(ui);
  const eqRow = tr(ui, "totalEquity");
  const equityEok = latestEok(eqRow) != null ? latestEok(eqRow)
    : (!cpBad(ui, "totalEquity") && ui.corePreview && ui.corePreview.totalEquity && typeof ui.corePreview.totalEquity.eok === "number" ? ui.corePreview.totalEquity.eok : null);
  const assetEok = latestEok(tr(ui, "totalAssets"));
  const debtEok = latestEok(tr(ui, "totalLiabilities"));
  const reBookAuto = bsWon(ui, ["토지", "건물", "구축물", "투자부동산"]);
  // [1년전(가중1), 직전(가중2), 결산연도(가중3)] — 연도로 자리를 정한다(D-136)
  const yearsWon = slots.map((s) => (typeof s.val === "number" ? s.val * 1e8 : null));
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

/** 이 회사에 대해 사람이 고쳐 둔 값 — { shares?: string, cond?: object, basis?: 결산연도, v?: 2 } */
export function svLoad(ui) {
  try { const all = JSON.parse(localStorage.getItem(KEY) || "{}"); const v = all[selKey(ui)]; return v && typeof v === "object" ? v : {}; } catch { return {}; }
}

/**
 * [D-136] 저장해 둔 값 + 이 보고서의 원문 값 → 화면 조건.
 *  - 사람이 고친 칸만 덮는다(예전에는 한 칸만 고쳐도 조건 전체를 저장해 자산 · 부채 · 순이익이 그때 값으로 굳었다).
 *  - 원문에서 오는 칸(자산 · 부채 · 부동산 · 3개년 순이익 · 증자/감자)은 같은 결산연도 보고서에서 고친 것만 — 새 보고서는 자기 숫자를 쓴다.
 *    예전 모양(결산연도 표시 없음)의 저장값은 원문 칸을 버리고 이자율 · 법인 구분 · 퇴직급여 · 영업권만 살린다.
 *  - 발행주식수도 같은 결산연도에서 고친 것만(새 보고서에 자동값이 없으면 고친 값을 그대로).
 */
export function svMerge(ui, saved, defaults) {
  const basis = svBasis(ui);
  const sameReport = !!saved && saved.v === 2 && saved.basis === basis && basis !== "";
  const cond = { ...defaults };
  for (const [k, v] of Object.entries((saved && saved.cond) || {})) {
    if (!(k in defaults) || typeof v !== "string") continue;
    if (REPORT_FIELDS.has(k) && !sameReport) continue;
    cond[k] = v;
  }
  const keepShares = !!saved && saved.shares != null && (sameReport || !autoShares(ui));
  const sharesText = keepShares ? String(saved.shares) : (autoShares(ui) ? String(autoShares(ui)) : "");
  return { cond, sharesText, sharesEdited: keepShares, edited: Object.keys(defaults).some((k) => cond[k] !== defaults[k]) };
}

/**
 * 고친 칸만 남긴다(원문 값과 다른 칸) — 원문 그대로면 칸을 비운 표시({at})만 남긴다(열어 보기만 해서는 값이 쌓이지 않게).
 * D-112: 바뀔 때마다 알림에 회사 · 값 · 시각을 실어 보낸다 — 크레탑 화면이 분석 이력(클라우드)에 같이 저장한다.
 * D-136: 어느 보고서(결산연도) 기준으로 고쳤는지(basis)를 함께 남긴다.
 */
export function svSave(ui, { shares, cond }) {
  const co = (ui && ui.companyInfo) || {};
  const at = new Date().toISOString();
  const entry = { at, v: 2, basis: svBasis(ui) };
  if (shares !== undefined && shares !== null) entry.shares = shares;
  if (cond) {
    const defaults = svDefaults(ui);
    const edits = {};
    for (const k of Object.keys(cond)) { if (cond[k] !== defaults[k]) edits[k] = cond[k]; }
    if (Object.keys(edits).length) entry.cond = edits;
  }
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
  // [D-136] 결산연도 순이익 칸이 비었으면(원문 최신 연도 빈칸) 0 으로 계산하지 않는다 — 직접 적으면 계산
  if (!shares || cond.asset === "" || cond.inc2 === "" || yearsFound === 0) return null;
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
  const defaults = svDefaults(ui);
  const m = svMerge(ui, svLoad(ui), defaults);
  const cond = m.cond;
  const shares = parseShares(m.sharesText);
  const bf = ui.bizForm || {};
  const r = bf.isPersonal ? null : svCompute(ui, shares, cond);
  return { r, shares, cond, edited: m.edited, sharesEdited: m.sharesEdited };
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
