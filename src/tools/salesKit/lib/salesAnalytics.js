// 기업컨설팅 세일즈 OS 의 성과 분석 규칙을 그대로 옮긴 것 (D-92) — 기간·퍼널 11단계·이번 달 vs 지난 달·
// 월별 추이·상품별 성과·상품별 월 비교·목표·CSV. 문자열·숫자·순서를 바꾸지 않았다(각 줄 위에 원본 줄 번호).
// 원본은 data(leads+companies)를 받았다. 여기서는 data = { list, packages, goals } 로 넘긴다 —
// getUniqueCustomers 가 list 를 돌려준다. 업체 명단은 고객 운영에 있기 때문이다.
import { scoreLead, getCompanyName, stageOf, todayISO } from "./salesData.js";
import { getPackages, insuranceSim, followStatus } from "./salesDocs.js";

const C = { text: "#0F172A", blue: "#2563EB", sky: "#0284C7", purple: "#7C3AED", ok: "#059669", warn: "#D97706", err: "#DC2626", gold: "#B45309", textM: "#64748B", greenBg: "#E7F6EF", warnBg: "#FDF1E1", blueBg: "#E8F1FE" };
function getUniqueCustomers(data) { return (data && data.list) || []; }
function dday(ymd) { if (!ymd) return 0; const a = new Date(String(ymd).slice(0, 10) + "T00:00:00").getTime(); const t = new Date(); const b = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime(); return Math.round((a - b) / 86400000); }

// 원본 App.jsx 246줄
export const PIPELINE = [
  { key: "lead", label: "잠재고객", match: ["lead"] },
  { key: "contacted", label: "1차 연락", match: ["contacted", "meeting_proposed"] },
  { key: "meeting1_scheduled", label: "1차 미팅 예정", match: ["meeting1_scheduled", "meeting1_done"] },
  { key: "docs_requested", label: "자료 요청", match: ["docs_requested"] },
  { key: "docs_received", label: "자료 수령", match: ["docs_received"] },
  { key: "proposal_sent", label: "제안서/리포트 발송", match: ["proposal_sent"] },
  { key: "meeting2_scheduled", label: "2차 미팅", match: ["meeting2_scheduled", "meeting2_done"] },
  { key: "decision_pending", label: "계약 검토", match: ["decision_pending", "closing_scheduled"] },
  { key: "contracted", label: "계약 완료", match: ["contracted"] },
  { key: "hold", label: "보류/장기관리", match: ["hold", "lost"] },
];
// 원본 App.jsx 258줄
export function pipeColOf(stage) { const c = PIPELINE.find((p) => p.match.includes(stage)); return c ? c.key : "lead"; }
// 원본 App.jsx 4683줄
export function dParse(s) { if (!s) return null; if (s instanceof Date) return isNaN(s.getTime()) ? null : s; const d = new Date(s); return isNaN(d.getTime()) ? null : d; }
// 원본 App.jsx 4684줄
export function dymd(s) { const d = dParse(s); if (!d) return ""; const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0"); return `${y}-${m}-${day}`; }
// 원본 App.jsx 4685줄
export function dMonthKey(s) { const d = dParse(s); return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` : ""; }
// 원본 App.jsx 4686줄
export function monthKeyOffset(off) { const n = new Date(); const d = new Date(n.getFullYear(), n.getMonth() + off, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
// 원본 App.jsx 4687줄
export function monthLabel(key) { if (!key) return ""; const [y, m] = key.split("-"); return `${y.slice(2)}.${m}`; }
// 원본 App.jsx 4277줄
export function feeMoney(m) { const v = Math.round(Number(m) || 0); return v.toLocaleString() + "만원"; }
// 원본 App.jsx 4278줄
export function expFee(x) { return Number(x && x.expectedFee) || 0; }
// 원본 App.jsx 4616줄
export function getGoals(data) { return { feeGoal: 1000, contractGoal: 3, proposalGoal: 10, ...(data && data.goals ? data.goals : {}) }; }
// 원본 App.jsx 4617줄
export const FUNNEL = [["f_lead", "잠재고객"], ["f_contacted", "1차 연락"], ["f_m1", "1차 미팅 예정"], ["f_docs_req", "자료 요청"], ["f_docs_recv", "자료 수령"], ["f_proposal", "제안서/리포트 발송"], ["f_quote", "견적 전달"], ["f_negotiate", "조건 조율"], ["f_preContract", "계약 예정"], ["f_contracted", "계약 완료"], ["f_hold", "보류"]];
// 원본 App.jsx 4618줄
export function funnelStageOf(c) {
  const ps = c.proposalStatus;
  if (c.stage === "contracted" || ps === "계약 완료") return "f_contracted";
  if (ps === "보류" || c.stage === "hold" || c.stage === "lost") return "f_hold";
  if (ps === "계약 예정") return "f_preContract";
  if (ps === "조건 조율") return "f_negotiate";
  if (ps === "견적 전달") return "f_quote";
  const map = { lead: "f_lead", contacted: "f_contacted", meeting1_scheduled: "f_m1", docs_requested: "f_docs_req", docs_received: "f_docs_recv", proposal_sent: "f_proposal", decision_pending: "f_proposal", contracted: "f_contracted", hold: "f_hold" };
  return map[pipeColOf(c.stage)] || "f_lead";
}
// 원본 App.jsx 4628줄
export function analyticsFunnel(data) {
  const all = getUniqueCustomers(data);
  const rows = FUNNEL.map(([key, label]) => { const cs = all.filter((c) => funnelStageOf(c) === key); return { key, label, count: cs.length, fee: cs.reduce((s, x) => s + expFee(x), 0) }; });
  const total = all.length || 1;
  let prev = null;
  return rows.map((r) => { const share = Math.round((r.count / total) * 100); let conv = null; if (r.key !== "f_hold" && r.key !== "f_lead" && prev !== null) conv = prev > 0 ? Math.round((r.count / prev) * 100) : 0; if (r.key !== "f_hold") prev = r.count; return { ...r, share, conv }; });
}
// 원본 App.jsx 4635줄
export function productPerformance(data) {
  const all = getUniqueCustomers(data);
  const pkgs = getPackages(data);
  return pkgs.map((p) => {
    const proposed = all.filter((c) => (c.proposedPackages || []).includes(p.name));
    const quote = proposed.filter((c) => c.proposalStatus === "견적 전달");
    const contracted = proposed.filter((c) => c.proposalStatus === "계약 완료" || c.stage === "contracted");
    const propFee = proposed.reduce((s, x) => s + (Number(x.proposedFee) || Number(p.fee) || 0), 0);
    const contFee = contracted.reduce((s, x) => s + (Number(x.proposedFee) || Number(p.fee) || 0), 0);
    const avgFee = proposed.length ? Math.round(propFee / proposed.length) : (Number(p.fee) || 0);
    const conv = proposed.length ? Math.round((contracted.length / proposed.length) * 100) : 0;
    return { name: p.name, cat: p.cat, proposed: proposed.length, quote: quote.length, contracted: contracted.length, propFee, contFee, avgFee, conv };
  });
}
// 원본 App.jsx 4279줄
export function salesMetrics(data) {
  const all = getUniqueCustomers(data);
  const thisWeek = all.filter((c) => c.nextDate && dday(c.nextDate) >= 0 && dday(c.nextDate) <= 7 && !["contracted", "lost"].includes(c.stage));
  const overdue = all.filter((c) => { const f = followStatus(c); return f && f.kind === "overdue"; });
  const review = all.filter((c) => pipeColOf(c.stage) === "decision_pending");
  const done = all.filter((c) => c.stage === "contracted");
  const feeSum = all.reduce((s, x) => s + expFee(x), 0);
  const top5 = all.map((x) => ({ x, s: scoreLead(x) })).sort((a, b) => b.s - a.s).slice(0, 5);
  const top5Fee = top5.reduce((s, o) => s + expFee(o.x), 0);
  const proposed = all.filter((c) => c.proposalStatus === "제안 완료" || c.proposedAt);
  const proposedFeeSum = proposed.reduce((s, x) => s + (Number(x.proposedFee) || expFee(x)), 0);
  const byPs = (ps) => all.filter((c) => c.proposalStatus === ps);
  const quoteSent = byPs("견적 전달"), negotiating = byPs("조건 조율"), preContract = byPs("계약 예정"), onhold = byPs("보류");
  const contractedFeeSum = all.filter((c) => c.proposalStatus === "계약 완료" || c.stage === "contracted").reduce((s, x) => s + (Number(x.proposedFee) || expFee(x)), 0);
  const quoteFeeSum = quoteSent.reduce((s, x) => s + (Number(x.proposedFee) || expFee(x)), 0);
  // 월납 보험료 기준 제안 지표(수임료와 구분)
  const monthlyProp = all.filter((c) => Number(c.proposalMonthlyPremium) > 0);
  const monthlyPremiumSum = monthlyProp.reduce((s, x) => s + (Number(x.proposalMonthlyPremium) || 0), 0);
  const projectedSum = monthlyProp.reduce((s, x) => s + (Number(x.proposalProjectedValue) || insuranceSim(x.proposalMonthlyPremium, x.proposalMonths, x.proposalRefundRate).base), 0);
  const affordN = { green: 0, yellow: 0, red: 0 };
  monthlyProp.forEach((c) => { const lv = c.proposalAffordabilityStatus; if (lv === "green" || lv === "yellow" || lv === "red") affordN[lv]++; });
  return { total: all.length, thisWeek: thisWeek.length, overdue: overdue.length, review: review.length, done: done.length, feeSum, top5Fee, proposed: proposed.length, proposedFeeSum, contractedFeeSum, quoteFeeSum, quoteSent: quoteSent.length, negotiating: negotiating.length, preContract: preContract.length, onhold: onhold.length, monthlyPropCount: monthlyProp.length, monthlyPremiumSum, projectedSum, affordN };
}
// 원본 App.jsx 4753줄
export const PERIOD_OPTIONS = [["all", "전체"], ["thisMonth", "이번 달"], ["lastMonth", "지난 달"], ["7d", "최근 7일"], ["30d", "최근 30일"], ["custom", "직접 선택"]];
// 원본 App.jsx 4754줄
export function periodRange(period, cs, ce) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const monthStart = (off) => new Date(today.getFullYear(), today.getMonth() + off, 1);
  const monthEnd = (off) => new Date(today.getFullYear(), today.getMonth() + off + 1, 0);
  if (period === "thisMonth") return { start: dymd(monthStart(0)), end: dymd(monthEnd(0)) };
  if (period === "lastMonth") return { start: dymd(monthStart(-1)), end: dymd(monthEnd(-1)) };
  if (period === "7d") { const s = new Date(today); s.setDate(s.getDate() - 6); return { start: dymd(s), end: dymd(today) }; }
  if (period === "30d") { const s = new Date(today); s.setDate(s.getDate() - 29); return { start: dymd(s), end: dymd(today) }; }
  if (period === "custom") { const start = dymd(cs), end = dymd(ce); if (!start && !end) return null; return { start: start || "0000-01-01", end: end || "9999-12-31" }; }
  return null;
}
// 원본 App.jsx 4765줄
export function periodLabel(range) { if (!range) return "전체 기간"; return `${range.start.replace(/-/g, ".")} ~ ${range.end.replace(/-/g, ".")}`; }
// 원본 App.jsx 4766줄
export function inRange(dateStr, range) { if (!range) return true; const d = dymd(dateStr); if (!d) return false; return d >= range.start && d <= range.end; }
// 원본 App.jsx 4767줄
export function custDates(c) { return [c.createdAt, c.proposedAt, c.quotedAt, c.contractedAt, c.stageMovedAt, c.nextDate, c.lastContactAt, ...((c.contacts || []).map((x) => x.date))].filter(Boolean); }
// 원본 App.jsx 4768줄
export function custInRange(c, range) { if (!range) return true; return custDates(c).some((d) => inRange(d, range)); }
// 원본 App.jsx 4771줄
export function isContractedCust(c) { return c.proposalStatus === "계약 완료" || c.stage === "contracted"; }
// 원본 App.jsx 4772줄
export function contractDateOf(c) { return c.contractedAt ? dymd(c.contractedAt) : (isContractedCust(c) ? dymd(c.stageMovedAt || c.updatedAt) : ""); }
// 원본 App.jsx 4773줄
export function monthlyStats(data, mkey) {
  const all = getUniqueCustomers(data);
  const inM = (s) => !!mkey && dMonthKey(s) === mkey;
  const newCust = all.filter((c) => inM(c.createdAt));
  const proposed = all.filter((c) => inM(c.proposedAt));
  const quote = all.filter((c) => inM(c.quotedAt));
  const contracted = all.filter((c) => isContractedCust(c) && inM(contractDateOf(c)));
  const contractFee = contracted.reduce((s, x) => s + (Number(x.proposedFee) || expFee(x)), 0);
  const today = todayISO();
  const followLate = all.filter((c) => c.nextDate && dMonthKey(c.nextDate) === mkey && dymd(c.nextDate) < today && !["contracted", "lost"].includes(c.stage));
  return { mkey, newCust: newCust.length, proposed: proposed.length, quote: quote.length, contracted: contracted.length, contractFee, followLate: followLate.length };
}
// 원본 App.jsx 4785줄
export function monthCompare(data) { return { cur: monthlyStats(data, monthKeyOffset(0)), prev: monthlyStats(data, monthKeyOffset(-1)) }; }
// 원본 App.jsx 4786줄
export function monthlyTrend(data, n) { const out = []; for (let i = (n || 6) - 1; i >= 0; i--) out.push(monthlyStats(data, monthKeyOffset(-i))); return out; }
// 원본 App.jsx 4787줄
export function deltaInfo(cur, prev) { const diff = cur - prev; if (prev === 0) return { diff, txt: cur === 0 ? "0%" : "신규 발생", col: cur === 0 ? C.textM : C.ok }; const r = Math.round((diff / prev) * 100); return { diff, txt: (r > 0 ? "+" : "") + r + "%", col: r > 0 ? C.ok : r < 0 ? C.err : C.textM }; }
// 원본 App.jsx 4788줄
export function productMonthlyCompare(data) {
  const all = getUniqueCustomers(data);
  const cm = monthKeyOffset(0), lm = monthKeyOffset(-1);
  return getPackages(data).map((p) => {
    const pool = all.filter((c) => (c.proposedPackages || []).includes(p.name));
    const propCur = pool.filter((c) => dMonthKey(c.proposedAt) === cm).length;
    const propPrev = pool.filter((c) => dMonthKey(c.proposedAt) === lm).length;
    const contCur = pool.filter((c) => isContractedCust(c) && dMonthKey(contractDateOf(c)) === cm).length;
    const contPrev = pool.filter((c) => isContractedCust(c) && dMonthKey(contractDateOf(c)) === lm).length;
    let badge = null;
    if (contCur > contPrev) badge = { t: "성장", col: C.ok, bg: C.greenBg };
    else if (contCur > 0) badge = { t: "계약 발생", col: C.gold, bg: C.warnBg };
    else if (propCur > propPrev) badge = { t: "제안 증가", col: C.sky, bg: C.blueBg };
    else if (propCur || propPrev || contCur || contPrev) badge = { t: "검토 필요", col: C.warn, bg: C.warnBg };
    return { name: p.name, cat: p.cat, propCur, propPrev, contCur, contPrev, badge };
  }).filter((r) => r.propCur || r.propPrev || r.contCur || r.contPrev).sort((a, b) => (b.contCur - a.contCur) || (b.propCur - a.propCur));
}
// 원본 App.jsx 4806줄
export function csvCell(v) { const s = (v === undefined || v === null) ? "" : String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
// 원본 App.jsx 4807줄
export function buildCSV(headers, rows) { const lines = [headers.map(csvCell).join(",")]; rows.forEach((r) => lines.push(r.map(csvCell).join(","))); return "﻿" + lines.join("\r\n"); }
// 원본 App.jsx 4823줄
export function csvAnalytics(data) {
  const f = analyticsFunnel(data);
  const headers = ["퍼널 단계", "고객 수", "예상 수임료(만원)", "비중(%)", "전환율(%)"];
  const rows = f.map((r) => [r.label, r.count, r.fee, r.share, r.conv === null ? "" : r.conv]);
  return { headers, rows };
}
// 원본 App.jsx 4829줄
export function csvProducts(data) {
  const p = productPerformance(data);
  const headers = ["상품/패키지", "카테고리", "제안 건수", "견적 건수", "계약 건수", "제안 수임료(만원)", "계약 수임료(만원)", "평균 수임료(만원)", "계약 준비율(%)"];
  const rows = p.map((x) => [x.name, x.cat, x.proposed, x.quote, x.contracted, x.propFee, x.contFee, x.avgFee, x.conv]);
  return { headers, rows };
}

// 원본 4769줄 filterDataByPeriod — list 판
export function filterDataByPeriod(data, range) { if (!range) return data; return { ...data, list: getUniqueCustomers(data).filter((c) => custInRange(c, range)) }; }
// 원본 4817줄 csvCustomers — list 판
export function csvCustomers(data) {
  const all = getUniqueCustomers(data);
  const headers = ["업체명", "대표", "업종", "지역", "영업단계", "제안상태", "관심주제", "예상수임료(만원)", "제안수임료(만원)", "유입경로", "등록일", "제안일", "견적일", "계약일", "다음 연락예정일", "최근활동일"];
  const rows = all.map((c) => [getCompanyName(c) || c.name || "", c.ceoName || "", c.industry || "", c.region || "", stageOf(c.stage).label, c.proposalStatus || "제안 전", (c.interests || []).join(" / "), Number(c.expectedFee) || 0, Number(c.proposedFee) || 0, c.dbSource || "", c.createdAt || "", c.proposedAt || "", c.quotedAt || "", c.contractedAt || "", c.nextDate || "", c.lastContactAt || ""]);
  return { headers, rows };
}
// 원본 4835줄 csvFollowups — list 판
export function csvFollowups(data) {
  const all = getUniqueCustomers(data);
  const headers = ["업체명", "다음 연락 상태", "다음 연락 예정일", "영업단계", "제안상태", "다음 액션", "예상수임료(만원)"];
  const rows = [];
  all.forEach((c) => { const fs = followStatus(c); if (fs) rows.push([getCompanyName(c) || c.name || "", fs.t, c.nextDate || "", stageOf(c.stage).label, c.proposalStatus || "제안 전", c.nextAction || "", Number(c.expectedFee) || 0]); });
  return { headers, rows };
}
