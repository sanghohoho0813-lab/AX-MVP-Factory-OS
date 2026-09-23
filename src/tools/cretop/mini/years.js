// [D-94] 크레탑 미니앱 — 연도 칸 채우기(표시 전용). 엔진·값·계산은 건드리지 않는다.
//   원문에서 어떤 표의 연도 머리줄이 안 잡히면 그 표 행의 연도가 비어 화면에 '?' 로 보였다.
//   같은 보고서에서 엔진이 이미 찾은 결산 연도로 빈 칸만 채운다.

// 이 보고서의 결산 연도(오름차순) — 가장 많은 연도를 가진 출처를 쓴다
export function cretopYearPool(ui) {
  if (!ui) return [];
  const ds = ui.detailStatements || {};
  const cands = [ds.balanceSheet && ds.balanceSheet.years, ds.incomeStatement && ds.incomeStatement.years, ui.financialYears, ui.reportRatioYears, ui.ratioYears];
  let best = [];
  for (const c of cands) {
    const ys = Array.from(new Set((c || []).filter((y) => typeof y === "number"))).sort((a, b) => a - b);
    if (ys.length > best.length) best = ys;
  }
  return best;
}
// 연도 배열(n칸)의 빈 칸 채우기 — 행에 연도가 하나라도 있으면 그 연도에 자리를 맞춘다
export function cretopFillYears(ys, n, pool) {
  const arr = Array.from({ length: n }, (_, i) => (ys && ys[i] != null ? ys[i] : null));
  if (arr.every((y) => y != null) || !pool || !pool.length) return arr;
  const ki = arr.findIndex((y) => y != null);
  let off = pool.length - n; // 알려진 연도가 없으면 최근 연도에 오른쪽 맞춤(크레탑 표는 과거→최근 순)
  if (ki >= 0) { const pi = pool.indexOf(arr[ki]); if (pi < 0) return arr; off = pi - ki; }
  return arr.map((y, i) => (y != null ? y : (pool[i + off] != null ? pool[i + off] : null)));
}
