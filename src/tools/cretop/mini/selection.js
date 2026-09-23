// 크레탑 미니앱 — 사용자가 미팅에서 제안할 '최종 선택 컨설팅 항목'. 기업별 localStorage 저장.
//  * 분석 이력을 다시 열어도 유지(사업자번호/회사명 키). 추천 점수 로직과 무관(표시/선택만).
const KEY = "mini_selected_strategies_v1";

export function selKey(ui) {
  const co = (ui && ui.companyInfo) || {};
  return String(co.businessNo || co.companyName || "unknown").trim() || "unknown";
}
export function getSelected(ui) {
  try { const all = JSON.parse(localStorage.getItem(KEY) || "{}"); const v = all[selKey(ui)]; return Array.isArray(v) ? v : []; } catch (e) { return []; }
}
export function toggleSelected(ui, name) {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) || "{}");
    const k = selKey(ui); const cur = Array.isArray(all[k]) ? all[k] : [];
    const next = cur.includes(name) ? cur.filter((x) => x !== name) : [...cur, name];   // 중복 선택 금지(토글)
    all[k] = next; localStorage.setItem(KEY, JSON.stringify(all));
    return next;
  } catch (e) { return getSelected(ui); }
}
