// packages/cretop-engine — 크레탑 재무진단 순수 엔진(파서/계산). UI·React·localStorage·pdfjs 의존 없음.
// 기업컨설팅 OS와 신규 미니앱이 공유. 핵심 진입점: buildCretopParsedForUi(rawText)

const CRETOP_UNIT_EOK = { "억원": 1, "억": 1, "백만원": 0.01, "백만": 0.01, "천원": 1e-5, "천": 1e-5, "만원": 1e-4, "만": 1e-4, "원": 1e-8 };
function cretopToEok(v, unit) { const f = CRETOP_UNIT_EOK[unit]; return (f == null || v == null) ? null : v * f; }
function cretopEokText(eok) { if (eok == null) return ""; const r = Math.round(eok * 100) / 100; return `약 ${r.toLocaleString()}억원`; }
const CRETOP_ACCT = [[/^매출액$|^매출$|^영업수익$|^수입금액$/, "매출액"], [/^매출원가$/, "매출원가"], [/^판매비와?관리비$|^판관비$/, "판매비와관리비"], [/^영업이익$/, "영업이익"], [/^당기순이익$|^순이익$/, "당기순이익"], [/^법인세비용$|^법인세$/, "법인세비용"], [/^이자비용$/, "이자비용"], [/^자산총계$|^자산$|^총자산$/, "자산총계"], [/^부채총계$|^부채$|^총부채$/, "부채총계"], [/^자본총계$|^자본$|^자기자본$/, "자본총계"], [/^유동자산$/, "유동자산"], [/^비유동자산$/, "비유동자산"], [/^유동부채$/, "유동부채"], [/^비유동부채$/, "비유동부채"], [/^단기차입금$/, "단기차입금"], [/^장기차입금$/, "장기차입금"], [/^가지급금$/, "가지급금"], [/^가수금$/, "가수금"], [/^미처분이익잉여금$/, "미처분이익잉여금"], [/^이익잉여금$/, "이익잉여금"], [/^유형자산$/, "유형자산"], [/^임차?보증금$/, "보증금"]];
const CRETOP_RATIO = [[/^부채비율$/, "부채비율", "%"], [/^유동비율$/, "유동비율", "%"], [/^차입금의존도$/, "차입금의존도", "%"], [/^영업이익률$/, "영업이익률", "%"], [/^(당기)?순이익률$/, "당기순이익률", "%"], [/^매출액?(증가|성장)율$/, "매출액증가율", "%"], [/^자기자본비율$/, "자기자본비율", "%"], [/총자산.{0,2}이익률|ROA/i, "ROA", "%"], [/자기자본.{0,2}이익률|ROE/i, "ROE", "%"], [/^이자보상배수$|^이자보상배율$/, "이자보상배수", "배"]];
function cretopNum(tok) { if (tok == null) return null; let s = String(tok).trim(); if (s === "-" || s === "") return null; let neg = false; if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); } if (/^[△▲▽-]/.test(s)) { neg = true; s = s.replace(/^[△▲▽-]/, ""); } if (!/^[0-9][0-9,]*(\.[0-9]+)?$/.test(s)) return null; const n = parseFloat(s.replace(/,/g, "")); return isFinite(n) ? (neg ? -n : n) : null; }
function cretopRowNums(line) { const toks = line.split(" ").filter(Boolean); const isN = (t) => t === "-" || /^[(]?[△▲▽-]?[0-9][0-9,]*(\.[0-9]+)?[)]?$/.test(t); let i = toks.length; const numToks = []; while (i > 0 && isN(toks[i - 1])) { numToks.unshift(toks[i - 1]); i--; } const label = toks.slice(0, i).join("").replace(/\([^)]*\)/g, "").replace(/\*/g, "").trim(); return { label, numToks }; }
// 비율 행(라벨로 시작) 판별 — 숫자가 여러 개여도(업종평균 등) 마지막 숫자를 조회기업 값으로 사용.
const CRETOP_HEADER_WORD = /^(구분|연도|기준|기준일|기준일자|기말|기초|항목|항목명|과목|과목명|계정|계정명|계정과목|분기|년|기|기업|당기|전기|전전기)$/;
function matchRatioLead(line) { const lw = (String(line).match(/^([가-힣A-Za-z]+)/) || [])[1]; if (!lw) return null; for (const [re, k, u] of CRETOP_RATIO) { if (re.test(lw)) return { key: k, unit: u }; } return null; }
function cretopSection(l) { if (/MY\s*재무/i.test(l)) return ["MY 재무 Data", "백만원", 1]; if (/요약\s*재무상태표/.test(l)) return ["요약 재무상태표", "백만원", 2]; if (/요약\s*손익계산서/.test(l)) return ["요약 손익계산서", "백만원", 2]; if (/재무비율|재무진단/.test(l)) return ["재무비율", "%", 0]; if (/재무상태표/.test(l)) return ["재무상태표", "천원", 3]; if (/손익계산서/.test(l)) return ["손익계산서", "천원", 3]; return null; }
function parseCretopTables(raw) {
  const lines = String(raw || "").split(/\r?\n/).map((l) => l.replace(/[ \t\u3000]+/g, " ").trim()).filter(Boolean);
  const accounts = {}, ratios = {}, years = new Set();
  let curUnit = null, curYears = [], curSection = "", curPrio = 1, queryDate = null, pending = [];
  const remapPending = () => { if (!curYears.length) return; for (const pr of pending) { const ny2 = curYears.length; for (let k = 0; k < pr.nums.length; k++) { const v = pr.nums[k]; if (v == null) continue; const idx = ny2 - pr.nums.length + k; if (idx < 0 || idx >= ny2) continue; const yr = curYears[idx]; const eok = cretopToEok(v, pr.unit); const entry = { year: yr, rawNum: v, unit: pr.unit, section: pr.section, eok, prio: pr.prio }; const ex = pr.rec.byYear[yr]; if (!ex || pr.prio >= ex.prio) { pr.rec.byYear[yr] = entry; years.add(yr); } } const ys = Object.keys(pr.rec.byYear).sort(); if (ys.length) pr.rec.latest = pr.rec.byYear[ys[ys.length - 1]]; } pending = []; };
  for (const line of lines) {
    let qm; if (!queryDate && (qm = line.match(/(?:조회일시|조회일자)\s*[:：]?\s*((?:19|20)\d{2}[-.\/]\d{1,2}[-.\/]\d{1,2})/))) queryDate = qm[1].replace(/[.\/]/g, "-");
    const sec = cretopSection(line); if (sec) { remapPending(); curSection = sec[0]; curUnit = sec[1]; curPrio = sec[2]; curYears = []; pending = []; }
    const um = line.match(/단위\s*[:：(]?\s*(백만원|천원|만원|억원|원|%)/); if (um) curUnit = um[1];
    const toks = line.split(" ").filter(Boolean); const yrs = []; let nonYear = 0;
    for (const tk of toks) { const ym = tk.match(/^((?:19|20)\d{2})(?:[-.\/]\d{1,2}(?:[-.\/]\d{1,2})?|년)?$/); if (ym) yrs.push(ym[1]); else if (CRETOP_HEADER_WORD.test(tk)) { } else nonYear++; }
    if (yrs.length >= 1 && nonYear === 0 && new Set(yrs).size === yrs.length) { curYears = yrs; yrs.forEach((y) => years.add(y)); remapPending(); continue; }
    const rlead = matchRatioLead(line);
    if (rlead) { const allNums = line.match(/-?[0-9][0-9,]*(?:\.[0-9]+)?/g) || []; if (allNums.length && ratios[rlead.key] == null) { const v = parseNumLoose(allNums[allNums.length - 1]); const yr = curYears.length ? curYears[curYears.length - 1] : null; ratios[rlead.key] = { key: rlead.key, value: v, unit: rlead.unit, year: yr, section: curSection || "재무비율" }; } continue; }
    const rn = cretopRowNums(line); const label = rn.label, numToks = rn.numToks; if (!label || !numToks.length) continue;
    let ak = null; for (const [re, k] of CRETOP_ACCT) { if (re.test(label)) { ak = k; break; } }
    if (!ak || !curUnit || curUnit === "%") continue;
    const nums = numToks.map(cretopNum); const ny = curYears.length;
    const rec = accounts[ak] || (accounts[ak] = { key: ak, byYear: {}, latest: null });
    const mismatch = ny > 0 && nums.filter((x) => x != null).length !== ny;
    for (let k = 0; k < nums.length; k++) { const v = nums[k]; if (v == null) continue; let yr = null; if (ny) { const idx = ny - nums.length + k; if (idx >= 0 && idx < ny) yr = curYears[idx]; } const eok = cretopToEok(v, curUnit); const entry = { year: yr, rawNum: v, unit: curUnit, section: curSection, eok, prio: curPrio, mismatch }; if (yr) { const ex = rec.byYear[yr]; if (!ex || curPrio >= ex.prio) { rec.byYear[yr] = entry; years.add(yr); } } else rec._noYear = entry; }
    if (!ny) pending.push({ rec, nums, unit: curUnit, section: curSection, prio: curPrio });
    const ys = Object.keys(rec.byYear).sort(); if (ys.length) rec.latest = rec.byYear[ys[ys.length - 1]]; else if (rec._noYear) rec.latest = rec._noYear;
  }
  const yearsArr = Array.from(years).sort(); const baseYear = yearsArr.length ? yearsArr[yearsArr.length - 1] : null;
  return { accounts, ratios, years: yearsArr, baseYear, queryDate, hasTable: Object.keys(accounts).length + Object.keys(ratios).length > 0 };
}
// ── 좌표 기반 PDF 표 복원 ──
// pdf.js textContent item의 x/y(transform[4]/[5])로 같은 행(y 유사)·열(x 정렬)을 복원해 표를 재구성한다.
// y가 비슷한 item을 한 줄로 묶고, 줄 안에서 x 오름차순 정렬 → 셀 순서가 보장된 줄 텍스트 생성(셀 합산 방지).
function groupItemsIntoLines(items) {
  if (!items || !items.length) return [];
  const arr = items.slice().sort((a, b) => (b.y - a.y) || (a.x - b.x));
  const lines = []; let cur = null;
  for (const it of arr) {
    const tol = Math.max(3, Math.min(8, (it.h || 10) * 0.7));
    if (cur && Math.abs(cur.y - it.y) <= tol) cur.cells.push(it);
    else { cur = { y: it.y, cells: [it] }; lines.push(cur); }
  }
  for (const l of lines) { l.cells.sort((a, b) => a.x - b.x); l.text = l.cells.map((c) => c.text).join(" ").replace(/[ \t　]+/g, " ").trim(); }
  return lines;
}
function splitLabelNumCells(cells) {
  const isN = (t) => t === "-" || /^[(]?[△▲▽-]?[0-9][0-9,]*(\.[0-9]+)?[)]?$/.test(t);
  let i = cells.length; const numCells = [];
  while (i > 0 && isN(cells[i - 1].text)) { numCells.unshift(cells[i - 1]); i--; }
  const label = cells.slice(0, i).map((c) => c.text).join("").replace(/\([^)]*\)/g, "").replace(/\*/g, "").trim();
  return { label, numCells };
}
// 좌표 레이아웃(pages[].lines[].cells) → 계정/비율 구조. 숫자셀은 x 최근접 연도컬럼에 매핑.
function parseCretopLayout(layout) {
  const pages = (layout && layout.pages) || [];
  const accounts = {}, ratios = {}, years = new Set();
  let curUnit = null, curYearCols = [], curSection = "", curPrio = 1, queryDate = null;
  for (const pg of pages) {
    for (const line of (pg.lines || [])) {
      const lt = line.text || "";
      let qm; if (!queryDate && (qm = lt.match(/(?:조회일시|조회일자)\s*[:：]?\s*((?:19|20)\d{2}[-.\/]\d{1,2}[-.\/]\d{1,2})/))) queryDate = qm[1].replace(/[.\/]/g, "-");
      const sec = cretopSection(lt); if (sec) { curSection = sec[0]; curUnit = sec[1]; curPrio = sec[2]; curYearCols = []; }
      const um = lt.match(/단위\s*[:：(]?\s*(백만원|천원|만원|억원|원|%)/); if (um) curUnit = um[1];
      const yearCells = (line.cells || []).map((c) => { const ym = String(c.text).match(/^((?:19|20)\d{2})(?:[-.\/]\d{1,2}(?:[-.\/]\d{1,2})?|년)?$/); return ym ? { year: ym[1], x: c.x + (c.w || 0) / 2 } : null; }).filter(Boolean);
      const others = (line.cells || []).filter((c) => !/^((?:19|20)\d{2})/.test(c.text) && !CRETOP_HEADER_WORD.test(c.text));
      if (yearCells.length >= 1 && others.length === 0 && new Set(yearCells.map((y) => y.year)).size === yearCells.length) { curYearCols = yearCells; yearCells.forEach((y) => years.add(y.year)); continue; }
      const rlead = matchRatioLead(lt);
      if (rlead) { const allNums = lt.match(/-?[0-9][0-9,]*(?:\.[0-9]+)?/g) || []; if (allNums.length && ratios[rlead.key] == null) { const v = parseNumLoose(allNums[allNums.length - 1]); const yr = curYearCols.length ? curYearCols[curYearCols.length - 1].year : null; ratios[rlead.key] = { key: rlead.key, value: v, unit: rlead.unit, year: yr, section: curSection || "재무비율" }; } continue; }
      const { label, numCells } = splitLabelNumCells(line.cells || []);
      if (!label || !numCells.length) continue;
      let ak = null; for (const [re, k] of CRETOP_ACCT) { if (re.test(label)) { ak = k; break; } }
      if (!ak || !curUnit || curUnit === "%") continue;
      const rec = accounts[ak] || (accounts[ak] = { key: ak, byYear: {}, latest: null });
      numCells.forEach((c) => { const v = cretopNum(c.text); if (v == null) return; let yr = null;
        if (curYearCols.length) { let best = null, bd = 1e9; const cx = c.x + (c.w || 0) / 2; for (const yc of curYearCols) { const d = Math.abs(yc.x - cx); if (d < bd) { bd = d; best = yc; } } yr = best ? best.year : null; }
        const eok = cretopToEok(v, curUnit); const entry = { year: yr, rawNum: v, unit: curUnit, section: curSection, eok, prio: curPrio };
        if (yr) { const ex = rec.byYear[yr]; if (!ex || curPrio >= ex.prio) { rec.byYear[yr] = entry; years.add(yr); } } else rec._noYear = entry;
      });
      const ys = Object.keys(rec.byYear).sort(); if (ys.length) rec.latest = rec.byYear[ys[ys.length - 1]]; else if (rec._noYear) rec.latest = rec._noYear;
    }
  }
  const yearsArr = Array.from(years).sort(); const baseYear = yearsArr.length ? yearsArr[yearsArr.length - 1] : null;
  return { accounts, ratios, years: yearsArr, baseYear, queryDate, hasTable: Object.keys(accounts).length + Object.keys(ratios).length > 0 };
}
// 좌표 레이아웃 디버그 요약(섹션/단위/연도/키워드/숫자행 후보) — 실패 시 사용자에게 표시·복사
function cretopDebug(layout, fileName) {
  const pages = (layout && layout.pages) || [];
  const allLines = [];
  pages.forEach((p) => (p.lines || []).forEach((l) => allLines.push(l.text)));
  const sections = []; const units = new Set(); const yearsSet = new Set();
  allLines.forEach((lt) => { const s = cretopSection(lt); if (s && !sections.includes(s[0])) sections.push(s[0]); const um = lt.match(/단위\s*[:：(]?\s*(백만원|천원|만원|억원|원|%)/); if (um) units.add(um[1]); (lt.match(/\b(19|20)\d{2}\b/g) || []).forEach((y) => yearsSet.add(y)); });
  const acctKw = ["매출액", "영업이익", "당기순이익", "자산총계", "부채총계", "자본총계", "유동자산", "비유동자산", "유동부채", "비유동부채", "단기차입금", "장기차입금", "가지급금", "가수금", "미처분이익잉여금", "이익잉여금", "부채비율", "유동비율", "이자보상"];
  const kw = acctKw.filter((k) => allLines.some((l) => l.includes(k)));
  const numRows = allLines.filter((l) => /[0-9],[0-9]{3}|[0-9]{3,}/.test(l)).slice(0, 12);
  const near = (key) => allLines.filter((l) => l.includes(key)).slice(0, 3);
  const L = [`[크레탑 디버그 정보]`, `파일: ${fileName || "-"}`, `페이지 수: ${pages.length}`, `추출 글자 수: ${(layout && layout.chars) || 0}`, `복원 줄 수: ${allLines.length}`, `감지된 섹션: ${sections.join(", ") || "(없음)"}`, `감지된 단위: ${Array.from(units).join(", ") || "(없음)"}`, `감지된 연도: ${Array.from(yearsSet).sort().join(", ") || "(없음)"}`, `발견된 재무 키워드: ${kw.join(", ") || "(없음)"}`, "", "[매출/영업이익/당기순이익 주변 줄]", ...["매출액", "영업이익", "당기순이익"].flatMap((k) => near(k)), "", "[숫자 행 후보(상위 12)]", ...numRows, "", "[복원 줄(첫 100)]", ...allLines.slice(0, 100)];
  return { text: L.join("\n"), sections, units: Array.from(units), years: Array.from(yearsSet).sort(), keywords: kw, numRows, pages: pages.length, chars: (layout && layout.chars) || 0, lineCount: allLines.length };
}
// ── 재무 숫자 현실성 검증(중소법인 기준) — 파서가 틀린 값을 만들어도 자동 적용을 막는 안전 레이어 ──
// 단위: 억원. normal(적용 가능) / large(확인 필요·적용 가능) / suspect·error·exclude(자동 적용 제외)
function validateAmountEok(eok, key) {
  const a = Math.abs(Number(eok) || 0);
  const autoMax = key === "보증금" ? 100 : 1000;
  if (a > 100000) return { level: "exclude", reason: "일반 중소기업 범위를 크게 초과 — 명백한 파싱 오류로 판단(자동 적용 제외)" };
  if (a > 10000) return { level: "error", reason: "비현실적 금액 — 파싱 오류 의심(자동 적용 제외)" };
  if (a > autoMax) return { level: "suspect", reason: `현실 범위(${autoMax.toLocaleString()}억원) 초과 — 단위/연도 확인 필요(자동 적용 제외)` };
  if (a > 300) return { level: "large", reason: "대형 업체 가능성 — 확인 필요" };
  return { level: "normal", reason: "" };
}
function parseNumLoose(s) { const n = parseFloat(String(s).replace(/,/g, "")); return isFinite(n) ? n : null; }
// 원문(공백 보존)에서 라벨 바로 뒤 숫자 토큰들을 본다 — 여러 개면 '여러 연도 숫자 붙임'으로 의심.
function inlineNums(labels, t) {
  for (const lab of labels) {
    try {
      const re = new RegExp(lab + "[^0-9\\-]{0,6}((?:[0-9][0-9,]*(?:\\.[0-9]+)?\\s*(?:억원|억|백만원|백만|천원|천|만원|만|원)?\\s*){1,5})");
      const mm = t.match(re);
      if (mm) { const seg = mm[1]; const unitM = seg.match(/(억원|억|백만원|백만|천원|천|만원|만|원)/); const unit = unitM ? unitM[1] : null; const candidates = seg.replace(/(억원|억|백만원|백만|천원|천|만원|만|원)/g, " ").match(/[0-9][0-9,]*(?:\.[0-9]+)?/g) || []; if (candidates.length) return { candidates, unit }; }
    } catch (e) {}
  }
  return null;
}
// 가장 최근 연도 값 선택 — 연도는 숫자 최댓값(Math.max). 표 표시 순서와 무관, 오래된 연도 금지.
function cretopPickLatest(rec) {
  if (!rec) return null;
  const yrs = Object.keys(rec.byYear || {}).map(Number).filter((y) => y >= 1900 && y <= 2100);
  if (yrs.length) { const ly = Math.max(...yrs); const e = rec.byYear[String(ly)]; if (e) return { year: String(ly), eok: e.eok, unit: e.unit, rawNum: e.rawNum, section: e.section, hasYear: true }; }
  if (rec._noYear) return { year: null, eok: rec._noYear.eok, unit: rec._noYear.unit, rawNum: rec._noYear.rawNum, section: rec._noYear.section, hasYear: false };
  return null;
}
// 크레탑 핵심 재무지표 — 폼 적용 필드 유무와 무관하게 항상 10개를 산출(화면 핵심지표 카드용)
function buildCoreMetrics(cre) {
  const amount = (names) => {
    for (const nm of names) { const L = cretopPickLatest(cre.accounts[nm]); if (L && L.eok != null) {
      const v = validateAmountEok(L.eok, nm);
      if (v.level === "normal" || v.level === "large") return { found: true, year: L.year, text: cretopEokText(L.eok), raw: `${Number(L.rawNum).toLocaleString()}${L.unit}`, section: L.section, note: L.hasYear ? "" : "연도 확인 필요", warn: v.level === "large" };
      return { found: false, bad: true, year: L.year, text: "원문 확인 필요 (현실 범위 초과)", raw: `${Number(L.rawNum).toLocaleString()}${L.unit}`, section: L.section };
    } }
    return { found: false, text: "추출 실패 — 원문/표 구조 확인 필요" };
  };
  const ratio = (nm) => { const r = cre.ratios[nm]; if (r) return { found: true, year: r.year, text: `${r.value.toLocaleString()}${r.unit}`, section: r.section }; return { found: false, text: "추출 실패 — 원문 확인 필요" }; };
  const allYears = (cre.years || []).map(Number).filter((y) => y >= 1900 && y <= 2100);
  const baseYear = allYears.length ? String(Math.max(...allYears)) : null;
  return { baseYear, years: cre.years || [], queryDate: cre.queryDate || null, rows: [
    ["매출액", amount(["매출액"])], ["영업이익", amount(["영업이익"])], ["당기순이익", amount(["당기순이익"])],
    ["자산총계", amount(["자산총계"])], ["부채총계", amount(["부채총계"])], ["자본총계", amount(["자본총계"])],
    ["미처분이익잉여금", amount(["미처분이익잉여금", "이익잉여금"])],
    ["부채비율", ratio("부채비율")], ["유동비율", ratio("유동비율")], ["이자보상배수", ratio("이자보상배수")],
  ] };
}
// ── 크레탑 핵심 재무지표 최종 전용 파서 ──
// 기존 parsed.items/apply/category와 무관하게 rawText에서 직접 핵심표를 찾아 연도-index-value를 명시적으로 매칭한다.
// 핵심 원칙: latestYear = Math.max(years); latestIndex = years.indexOf(latestYear); selectedValue = values[latestIndex]
function normalizeAccountLabel(s) { return String(s || "").replace(/\([^)]*\)/g, "").replace(/[\*\s　]/g, "").replace(/[:：].*$/, "").trim(); }
const CRETOP_FINAL_ACCT = { "매출액": "revenue", "매출": "revenue", "영업수익": "revenue", "수입금액": "revenue", "영업이익": "operatingProfit", "당기순이익": "netIncome", "순이익": "netIncome", "자산총계": "totalAssets", "총자산": "totalAssets", "자산": "totalAssets", "부채총계": "totalLiabilities", "총부채": "totalLiabilities", "부채": "totalLiabilities", "자본총계": "totalEquity", "자기자본": "totalEquity", "자본": "totalEquity", "미처분이익잉여금": "retainedEarnings", "이익잉여금": "retainedEarnings" };
const CRETOP_FINAL_RATIO = { "부채비율": ["debtRatio", "%"], "유동비율": ["currentRatio", "%"], "이자보상배수": ["interestCoverageRatio", "배"], "이자보상배율": ["interestCoverageRatio", "배"] };
const FINAL_UNIT_EOK = { "백만원": 0.01, "백만": 0.01, "천원": 1e-5, "천": 1e-5, "만원": 1e-4, "억원": 1, "억": 1, "원": 1e-8 };
const CORE_LABEL_KR = { revenue: "매출액", operatingProfit: "영업이익", netIncome: "당기순이익", totalAssets: "자산총계", totalLiabilities: "부채총계", totalEquity: "자본총계", retainedEarnings: "미처분이익잉여금", debtRatio: "부채비율", currentRatio: "유동비율", interestCoverageRatio: "이자보상배수" };
const CORE_ORDER = ["revenue", "operatingProfit", "netIncome", "totalAssets", "totalLiabilities", "totalEquity", "retainedEarnings", "debtRatio", "currentRatio", "interestCoverageRatio"];
function cretopYearHeader(l) { const toks = String(l).split(" ").filter(Boolean); const yrs = []; let other = 0; for (const t of toks) { const m = t.match(/^((?:19|20)\d{2})(?:[-.\/]\d{1,2}(?:[-.\/]\d{1,2})?|년)?$/); if (m) yrs.push(+m[1]); else if (/^(구분|연도|기준|기준일|기준일자|기말|기초|항목|항목명|과목|과목명|계정|계정명|계정과목|분기|년|기|기업|당기|전기|전전기)$/.test(t)) { } else other++; } return (yrs.length >= 1 && other === 0 && new Set(yrs).size === yrs.length) ? yrs : null; }
function parseAcctRow(line) { const toks = String(line).split(" ").filter(Boolean); const isNumDash = (t) => t === "-" || /^[(]?-?[0-9][0-9,]*(?:\.[0-9]+)?[)]?$/.test(t); let i = 0; while (i < toks.length && !isNumDash(toks[i])) i++; if (i === 0 || i >= toks.length) return null; const label = normalizeAccountLabel(toks.slice(0, i).join("")); const values = toks.slice(i).map((t) => (t === "-" ? null : parseNumLoose(String(t).replace(/[()]/g, "")))); return { label, values }; }
// ── 크레탑 숫자 추출기(Stage 1) — 재무표 섹션에서 계정-숫자 후보를 '검수용 표'로 추출(자동 적용 X) ──
// buildCretopFinalCoreMetrics와 동일한 섹션 판별 규칙(추출 대상 한정: 업계순위/동종업계/거래처 등 제외)
function cretopSecOf(l) {
  if (/업계\s*순위|동종\s*업계|동업종|업종\s*평균|거래처\s*현황|매입처|매출처|판매처|구매처|사업장\s*현황|주주\s*현황|임원\s*현황|연혁|사업\s*목적|상품\s*정보|특허\s*현황|인증\s*현황|소송|담보\s*현황|채권추심|채권보전|부실채권|등기\s*현황|구성비|매출액\s*분포/.test(l)) return { name: "기타정보(제외)", unit: null, prio: -1, amountOk: false, ratioOk: false };
  if (/MY\s*재무/i.test(l)) return { name: "MY 재무 Data", unit: "백만원", prio: 1, amountOk: true, ratioOk: false };
  if (/요약\s*재무상태표/.test(l)) return { name: "요약 재무상태표", unit: "백만원", prio: 2, amountOk: true, ratioOk: false };
  if (/요약\s*손익계산서/.test(l)) return { name: "요약 손익계산서", unit: "백만원", prio: 2, amountOk: true, ratioOk: false };
  if (/재무비율|재무진단|재무구조|부채상환|성장성|수익성|활동성|안정성/.test(l)) return { name: "재무비율", unit: "%", prio: 0, amountOk: false, ratioOk: true };
  if (/현금\s*흐름/.test(l)) return { name: "현금흐름분석", unit: null, prio: 1, amountOk: false, ratioOk: false };
  if (/이익잉여금\s*처분\s*계산서|잉여금\s*처분\s*계산서/.test(l)) return { name: "이익잉여금처분계산서", unit: "천원", prio: 3, amountOk: true, ratioOk: false };
  if (/제조원가\s*명세서/.test(l)) return { name: "제조원가명세서", unit: "천원", prio: 3, amountOk: true, ratioOk: false };
  if (/재무상태표/.test(l)) return { name: "재무상태표", unit: "천원", prio: 3, amountOk: true, ratioOk: false };
  if (/손익계산서/.test(l)) return { name: "손익계산서", unit: "천원", prio: 3, amountOk: true, ratioOk: false };
  return null;
}
function cretopBuildBlocks(rawText) {
  const lines = String(rawText || "").split(/\r?\n/).map((l) => l.replace(/[ \t　]+/g, " ").trim()).filter(Boolean);
  const blocks = []; let cur = { name: "", unit: null, prio: 1, lines: [], amountOk: true, ratioOk: true };
  for (const l of lines) { const s = cretopSecOf(l); if (s) { if (cur.lines.length) blocks.push(cur); cur = { name: s.name, unit: s.unit, prio: s.prio, lines: [], amountOk: s.amountOk, ratioOk: s.ratioOk }; } cur.lines.push(l); }
  if (cur.lines.length) blocks.push(cur);
  return blocks;
}
const CRETOP_EXTRACT_ACCT = { "매출액": "revenue", "매출": "revenue", "상품매출액": "revenue", "상품매출": "revenue", "국내매출": "revenue", "영업수익": "revenue", "수입금액": "revenue", "영업이익": "operatingProfit", "당기순이익": "netIncome", "순이익": "netIncome", "자산총계": "totalAssets", "총자산": "totalAssets", "자산": "totalAssets", "부채총계": "totalLiabilities", "총부채": "totalLiabilities", "부채": "totalLiabilities", "자본총계": "totalEquity", "자기자본": "totalEquity", "자본": "totalEquity", "미처분이익잉여금": "retainedEarnings", "이익잉여금": "retainedEarnings", "단기차입금": "shortTermBorrowings", "장기차입금": "longTermBorrowings" };
const CRETOP_EXTRACT_RATIO = { "부채비율": ["debtRatio", "%"], "유동비율": ["currentRatio", "%"], "이자보상배수": ["interestCoverageRatio", "배"], "이자보상배율": ["interestCoverageRatio", "배"] };
const EXTRACT_LABEL_KR = { revenue: "매출액", operatingProfit: "영업이익", netIncome: "당기순이익", totalAssets: "자산총계", totalLiabilities: "부채총계", totalEquity: "자본총계", retainedEarnings: "미처분이익잉여금", shortTermBorrowings: "단기차입금", longTermBorrowings: "장기차입금", debtRatio: "부채비율", currentRatio: "유동비율", interestCoverageRatio: "이자보상배수" };
const EXTRACT_ORDER = ["revenue", "operatingProfit", "netIncome", "totalAssets", "totalLiabilities", "totalEquity", "retainedEarnings", "shortTermBorrowings", "longTermBorrowings", "debtRatio", "currentRatio", "interestCoverageRatio"];
const EXTRACT_STATUS = ["적용 후보", "검수 필요", "단위 확인 필요", "연도 확인 필요", "오류 의심", "제외"];
const EXTRACT_UNITS = ["백만원", "천원", "억원", "%", "배", "확인 필요"];
function extractRowEok(row) { if (!row || row.isRatio) return null; const v = typeof row.rawValue === "number" ? row.rawValue : parseNumLoose(row.rawValue); const uf = FINAL_UNIT_EOK[row.unit]; return (v != null && uf != null) ? v * uf : null; }
function extractEokText(row) { if (row.isRatio) return "-"; const e = extractRowEok(row); return e == null ? "단위 확인 필요" : `${(Math.round(e * 100) / 100).toLocaleString()}억원`; }
// rawText에서 재무표 섹션의 계정-숫자 후보를 행 단위로 모두 추출(자동 적용 X, 사람이 검수)
function extractCretopNumbers(rawText) {
  const blocks = cretopBuildBlocks(rawText);
  const rows = []; const detectedYears = []; const sections = []; let queryDate = null; let idc = 0;
  for (const b of blocks) {
    let unit = b.unit;
    for (const l of b.lines) { const um = l.match(/단위\s*[:：(]?\s*(백만원|천원|만원|억원|원|%)/); if (um) unit = um[1]; const qm = l.match(/(?:조회일시|조회일자)\s*[:：]?\s*((?:19|20)\d{2}[-.\/]\d{1,2}[-.\/]\d{1,2})/); if (qm && !queryDate) queryDate = qm[1].replace(/[.\/]/g, "-"); }
    let years = null; for (const l of b.lines) { const y = cretopYearHeader(l); if (y) { years = y; break; } }
    if (years) years.forEach((y) => { if (!detectedYears.includes(y)) detectedYears.push(y); });
    if (b.prio >= 0 && b.name && !sections.includes(b.name)) sections.push(b.name);
    for (const l of b.lines) {
      if (cretopYearHeader(l)) continue;
      const lwn = normalizeAccountLabel((l.match(/^([가-힣A-Za-z]+)/) || [])[1] || "");
      const rr = CRETOP_EXTRACT_RATIO[lwn];
      if (rr) {
        if (!b.ratioOk) continue;
        const allNums = (l.match(/-?[0-9][0-9,]*(?:\.[0-9]+)?/g) || []).map(parseNumLoose).filter((x) => x != null);
        if (!allNums.length) continue;
        const noYear = !(years && years.length); let v, idx;
        if (years && years.length && allNums.length === years.length) { const ly = Math.max(...years); idx = years.indexOf(ly); v = allNums[idx]; }
        else { idx = allNums.length - 1; v = allNums[idx]; }
        rows.push({ id: `x${idc++}`, accountKey: rr[0], account: EXTRACT_LABEL_KR[rr[0]], rawLabel: lwn, year: noYear ? null : Math.max(...years), values: allNums, latestIndex: idx, rawValue: v, unit: rr[1], section: b.name || "재무비율", rowText: l, confidence: noYear ? "보통" : "높음", status: noYear ? "연도 확인 필요" : "적용 후보", isRatio: true, sel: !noYear });
        continue;
      }
      if (!b.amountOk) continue;
      const parsed = parseAcctRow(l); if (!parsed) continue;
      const mkey = CRETOP_EXTRACT_ACCT[parsed.label]; if (!mkey) continue;
      const valsAll = parsed.values;
      let latestYear = null, latestIndex = -1, selected = null;
      if (years && years.length) { latestYear = Math.max(...years); latestIndex = years.indexOf(latestYear);
        if (valsAll.length === years.length) selected = valsAll[latestIndex];
        else { const off = years.length - valsAll.length; const aligned = years.map((y, i) => (i - off >= 0 ? valsAll[i - off] : null)); selected = aligned[latestIndex]; }
      } else { for (let i = valsAll.length - 1; i >= 0; i--) { if (valsAll[i] != null) { selected = valsAll[i]; latestIndex = i; break; } } }
      if (selected == null) continue;
      const uf = unit && FINAL_UNIT_EOK[unit] != null ? FINAL_UNIT_EOK[unit] : null;
      const eok = uf != null ? selected * uf : null;
      const valid = eok != null ? validateAmountEok(eok, parsed.label) : { level: "normal" };
      const badRange = valid.level === "suspect" || valid.level === "error" || valid.level === "exclude";
      const noYear = !(years && years.length); const noUnit = uf == null;
      let status, confidence;
      if (badRange) { status = "오류 의심"; confidence = "낮음"; }
      else if (noUnit) { status = "단위 확인 필요"; confidence = "보통"; }
      else if (noYear) { status = "연도 확인 필요"; confidence = "보통"; }
      else { status = "적용 후보"; confidence = valsAll.length === (years ? years.length : 0) ? "높음" : "보통"; }
      rows.push({ id: `x${idc++}`, accountKey: mkey, account: EXTRACT_LABEL_KR[mkey], rawLabel: parsed.label, year: latestYear, values: valsAll, latestIndex, rawValue: selected, unit: unit || "", section: b.name || "표", rowText: l, confidence, status, isRatio: false, sel: status === "적용 후보" });
    }
  }
  return { rows, detectedYears: detectedYears.slice().sort((a, b) => a - b), sections, queryDate };
}
function extractRowsToCsv(rows) {
  const header = ["계정명", "기준연도", "원문값", "원문단위", "억원환산값", "출처섹션", "원문행", "신뢰도", "상태"];
  const esc = (v) => { const s = String(v == null ? "" : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const out = [header.join(",")];
  rows.forEach((r) => { out.push([r.account, r.year == null ? "" : r.year, r.rawValue == null ? "" : r.rawValue, r.unit || "확인 필요", extractEokText(r), r.section, r.rowText, r.confidence, r.status].map(esc).join(",")); });
  return String.fromCharCode(0xFEFF) + out.join("\r\n");
}
function extractRowsToText(rows) {
  const head = "계정명\t기준연도\t원문값\t단위\t억원환산\t출처\t신뢰도\t상태";
  const body = rows.map((r) => `${r.account}\t${r.year == null ? "-" : r.year}\t${r.rawValue == null ? "-" : r.rawValue}\t${r.unit || "확인 필요"}\t${extractEokText(r)}\t${r.section}\t${r.confidence}\t${r.status}`);
  return [head, ...body].join("\n");
}
const CRETOP_EXTRACT_SAMPLE = "기업명 샘플정밀(주)\n대표자 김샘플\n사업자번호 000-00-00000\n\n요약 손익계산서 단위:백만원\n매출액 1,250 1,860 2,430\n영업이익 80 140 210\n당기순이익 55 100 160\n구분 2021 2022 2023\n\n요약 재무상태표 단위:백만원\n자산총계 900 1,150 1,420\n부채총계 520 610 720\n자본총계 380 540 700\n구분 2021 2022 2023\n\n상세 재무상태표 단위:천원\n미처분이익잉여금 320,000 410,000 520,000\n단기차입금 100,000 80,000 50,000\n장기차입금 200,000 180,000 150,000\n구분 2021 2022 2023\n\n재무구조\n부채비율 136.8 113.0 102.9\n유동비율 145.2 168.4 191.7\n이자보상배수 8.5 12.3 18.6\n구분 2021 2022 2023";
// ── 크레탑 숫자 추출기 실전형 — 실제 PDF rawText(줄/열/페이지 깨짐) 대응 라인 기반 후보 추출 ──
// ── 크레탑 rawText 정규화(글자/숫자 단위 띄어쓰기 PDF 대응) — 글자 단위 라인만 정규화(정상 텍스트 무영향) ──
function cretopCharSpaced(line) { const t = String(line || "").trim().split(/\s+/).filter(Boolean); if (t.length < 4) return false; const single = t.filter((x) => x.length === 1 && /[가-힣0-9]/.test(x)).length; return single / t.length >= 0.5; }
// 점이 여러 개 붙은 비율 연속(63.3461.9961.6)·음수 섞인 연속(1.05-7.070.52)을 각 숫자로 분해
function cretopTileDecimalRun(blob) {
  const b = String(blob || "");
  if (!/\./.test(b) || !/^-?[\d.]+(?:-[\d.]+)*$/.test(b)) return null;
  // 한 부호 세그먼트(마이너스 없음)를 점 단위 2자리 우선으로 타일
  const tileSeg = (seg) => {
    if (!/^\d+(?:\.\d+)+$/.test(seg)) return /^\d+(?:\.\d+)?$/.test(seg) ? [seg] : null;
    const dotCount = (seg.match(/\./g) || []).length;
    const out = []; const firstDot = seg.indexOf("."); let intPart = seg.slice(0, firstDot); let s = seg.slice(firstDot + 1);
    for (let d = 0; d < dotCount; d++) {
      const nextDot = s.indexOf(".");
      if (nextDot < 0) { if (s.length > 2) { out.push(intPart + "." + s.slice(0, 2)); const rest = s.slice(2); if (/^\d+$/.test(rest)) out.push(rest); } else out.push(intPart + "." + s); break; }
      const group = s.slice(0, nextDot); const fracLen = Math.min(2, Math.max(1, group.length - 1));
      out.push(intPart + "." + group.slice(0, fracLen)); intPart = group.slice(fracLen); s = s.slice(nextDot + 1);
    }
    return out.length ? out : null;
  };
  // 내부 '숫자-숫자' 마이너스를 값 구분자로 보고 분할(각 부호 뒤 첫 값만 음수)
  const segs = b.split("-"); const out = [];
  for (let si = 0; si < segs.length; si++) {
    const seg = segs[si]; if (seg === "") continue;
    const neg = (si > 0) || (si === 0 && b[0] === "-");
    const tiled = tileSeg(seg); if (!tiled) return null;
    tiled.forEach((v, vi) => out.push((vi === 0 && neg) ? "-" + v : v));
  }
  return out.length >= 2 && out.every((x) => /^-?\d+(?:\.\d+)?$/.test(x)) ? out : null;
}
function cretopReassembleNumberRun(run) {
  const blob = String(run).replace(/\s+/g, "");
  if (!/\d/.test(blob)) return blob;
  // 날짜형(YYYY-MM-DD / YYYY.MM.DD / YYYY/MM/DD) → 날짜 토큰으로 분리
  if (/(?:19|20)\d{2}[-.\/]\d{1,2}[-.\/]\d{1,2}/.test(blob)) {
    const ds = blob.match(/(?:19|20)\d{2}[-.\/]\d{1,2}[-.\/]\d{1,2}/g);
    return ds ? ds.join(" ") : blob;
  }
  // 연도 연속(201820192021) → 4자리 연도로 분리
  if (/^(?:(?:19|20)\d{2})+$/.test(blob)) return (blob.match(/(?:19|20)\d{2}/g) || []).join(" ");
  // 콤마 천단위 → 경계 명확, 소수는 2자리까지(예 "265.841,138.53874" → 265.84 1,138.53 874)
  if (blob.includes(",")) { const nums = blob.match(/-?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?/g); return nums ? nums.join(" ") : blob; }
  // 소수점 포함 → 단일 소수는 그대로, 연속 소수(비율)는 점 단위로 분해(소수 2자리 우선)
  if (blob.includes(".")) {
    if (/^-?\d+\.\d+$/.test(blob)) return blob;
    const tiled = cretopTileDecimalRun(blob); if (tiled) return tiled.join(" ");
    const nums = blob.match(/-?\d{1,3}\.\d|-?\d+/g);
    return nums ? nums.join(" ") : blob;
  }
  // 순수 숫자열(콤마·소수 없음) → 분리하면 모호, 하나로 유지(추출기에서 연도 수만큼 재분할)
  return blob;
}
function compactKoreanAndNumberSpacing(line) {
  let s = String(line || "").replace(/[\t　]+/g, " ").trim();
  if (!cretopCharSpaced(s)) return s;
  let prev; do { prev = s; s = s.replace(/([가-힣])\s+([가-힣])/g, "$1$2"); } while (s !== prev);
  s = s.replace(/([가-힣])\s+([:：])/g, "$1$2").replace(/([:：])\s+([가-힣])/g, "$1$2");
  // 숫자/구분자(콤마·소수점·날짜) 연속 토큰을 한 덩어리로 모아 재조립
  // '-'는 뒤에 숫자가 올 때만 묶고(음수/날짜/연속비율), 빈칸 '-'(뒤가 숫자 아님)는 보존 → "11,000 - -" 유지
  s = s.replace(/-?\d(?:\s*[\d.,\/]|\s*-(?=\s*\d))*/g, (run) => cretopReassembleNumberRun(run));
  s = s.replace(/단위\s*[:：]\s*/g, "단위:");
  return s.replace(/\s{2,}/g, " ").trim();
}
function normalizeCretopLine(line) { return compactKoreanAndNumberSpacing(line); }
function normalizeCretopPdfText(rawText) { return String(rawText || "").split(/\r?\n/).map(normalizeCretopLine).join("\n"); }
function extractNumbersFromCretopLine(line) { const s = normalizeCretopLine(line); return (s.match(/-?\d{1,3}(?:,\d{3})*(?:\.\d+)?|-?\d+(?:\.\d+)?/g) || []).filter((t) => !cretopIsBareYear(t)).map(parseNumLoose).filter((x) => x != null); }
function cretopNumTokens(text) { return String(text).match(/-?\d[\d,]*(?:\.\d+)?/g) || []; }
function cretopIsBareYear(tok) { return /^(19|20)\d{2}$/.test(String(tok)); }
function cretopValuesIn(text) { return cretopNumTokens(text).filter((t) => !cretopIsBareYear(t)).map(parseNumLoose).filter((x) => x != null); }
function cretopLineYears(line) {
  const toks = String(line).split(/\s+/).filter(Boolean); if (!toks.length) return null;
  // char-spaced 추출 시 '구분 계정명'이 '구분계정명'처럼 합쳐지므로 라벨어 연속(concat)도 라벨토큰으로 허용
  const LABELTOK = /^(?:구분|연도|기준일자|기준일|기준연도|기준|기말|기초|항목명|항목|과목명|과목|계정과목|계정명|계정|분기|당기|전기|전전기|반기|년도|년|기|제\d+기|단위)+(?:[(][^)]*[)])?[:：]?$/;
  const yrs = []; let other = 0;
  for (const t of toks) { if (cretopIsBareYear(t)) { yrs.push(+t); continue; } const dm = t.match(/^((?:19|20)\d{2})[-.\/]\d{1,2}(?:[-.\/]\d{1,2})?$/); if (dm) { yrs.push(+dm[1]); continue; } if (LABELTOK.test(t) || /^[(]?단위[)]?[:：]?/.test(t) || t === ":" || t === "：") {} else other++; }
  return (yrs.length >= 1 && other === 0) ? Array.from(new Set(yrs)) : null;
}
function cretopLineAcct(line, am, rm) {
  const A = am || CRETOP_EXTRACT_ACCT; const R = rm || CRETOP_EXTRACT_RATIO;
  const head = String(line).split(/\d/)[0].replace(/[\s△▲▼▽()*+\-]+$/, ""); const norm = normalizeAccountLabel(head);
  if (A[norm]) return { key: A[norm], label: norm, isRatio: false };
  if (R[norm]) return { key: R[norm][0], label: norm, isRatio: true, unit: R[norm][1] };
  return null;
}
// rawText 진단: 라인/숫자/계정/단위/연도/섹션 후보를 모두 표면화(디버그 복사용)
function analyzeCretopRaw(rawText, am, rm) {
  const raw = String(rawText || "");
  const rawLines = raw.split(/\r?\n/);
  const lines = []; let curSection = "(머리말)"; let curPrio = 1; let curBlocked = false;
  const detectedSections = []; const detectedYears = []; const detectedUnits = [];
  rawLines.forEach((rl, idx) => {
    const text = rl.replace(/[ \t　]+/g, " ").trim(); if (!text) return;
    const ntext = normalizeCretopLine(text);                 // 글자 단위 띄어쓰기 정규화(파싱용)
    const sec = cretopSecOf(ntext);
    if (sec) { curSection = sec.name; curPrio = sec.prio; curBlocked = sec.prio < 0; if (sec.prio >= 0 && !detectedSections.includes(sec.name)) detectedSections.push(sec.name); }
    const um = ntext.match(/단위\s*[:：(]?\s*(백만원|천원|만원|억원|원)/); if (um && !detectedUnits.includes(um[1])) detectedUnits.push(um[1]);
    const yrs = cretopLineYears(ntext); if (yrs) yrs.forEach((y) => { if (!detectedYears.includes(y)) detectedYears.push(y); });
    const acct = cretopLineAcct(ntext, am, rm);
    lines.push({ i: idx, li: lines.length, text, ntext, section: curSection, prio: curPrio, blocked: curBlocked, hasNum: cretopNumTokens(ntext).length > 0, hasAcct: !!acct, isYear: !!yrs, acctKey: acct ? acct.key : null, unit: um ? um[1] : null });
  });
  const fp = buildFinPreview(normalizeCretopPdfText(raw));
  return { rawText: raw, chars: raw.length, rawLineCount: rawLines.length, lineCount: lines.length, lines, numberLineCount: lines.filter((l) => l.hasNum).length, acctLineCount: lines.filter((l) => l.hasAcct).length, detectedSections, detectedYears: detectedYears.slice().sort((a, b) => a - b), detectedUnits, companyName: fp.companyName, businessNo: fp.businessNo, ceoName: fp.ceoName };
}
// 글자 단위 PDF 추출로 3개년 숫자가 콤마·소수 없이 붙어버린 경우(예: "56106111"),
// 연도 수만큼 가능한 모든 분할 후보를 만들고 가장 자연스러운(완만한 흐름) 조합을 선택한다.
function splitCretopCompactNumbersByYears(rawNumberString, years, metricName) {
  const neg = /^-/.test(String(rawNumberString || "").trim());
  const digits = String(rawNumberString == null ? "" : rawNumberString).replace(/[^\d]/g, "");
  const N = Array.isArray(years) ? years.length : Number(years) || 0;
  if (N < 2 || digits.length < N || digits.length > N * 4) return null;
  // N개 조각(각 1~4자리) 합이 전체 길이가 되는 모든 분할 폭 조합 생성
  const comps = [];
  (function rec(start, parts) {
    if (parts.length === N - 1) { const last = digits.length - start; if (last >= 1 && last <= 4) comps.push([...parts, last]); return; }
    for (let w = 1; w <= 4; w++) { if (start + w > digits.length) break; rec(start + w, [...parts, w]); }
  })(0, []);
  let best = null, bestScore = Infinity;
  for (const widths of comps) {
    const segs = []; let idx = 0, ok = true;
    for (const w of widths) { const seg = digits.slice(idx, idx + w); idx += w; if (w > 1 && seg[0] === "0") { ok = false; break; } segs.push(seg); }
    if (!ok) continue;
    const vals = segs.map((s) => parseInt(s, 10));
    // 부드러움 점수: 연도별 값 변화(로그비)가 완만할수록 낮음 — 비현실적 급변(예: [56,10,6111]) 회피
    let smooth = 0;
    for (let i = 1; i < vals.length; i++) { const a = vals[i - 1], b = vals[i]; if (a > 0 && b > 0) smooth += Math.abs(Math.log(b / a)); else smooth += 4; }
    // 자릿수 균형(조각 길이 편차)·앞자리 0 방지 보조 점수
    const spread = Math.max(...widths) - Math.min(...widths);
    const score = smooth + spread * 0.15;
    if (score < bestScore) { bestScore = score; best = vals; }
  }
  if (best && neg) best = best.map((v, i) => i === 0 ? -v : v);
  return best;
}
// 같은 지표 후보가 여러 개일 때 어느 후보를 우선 적용/미리보기에 올릴지 점수화
// (정확한 계정명 일치 > 요약 재무표 > 상세 재무표 > MY 재무 Data, 상태가 좋을수록 가점)
function cretopRowRank(r) {
  if (!r) return -Infinity;
  let s = 0;
  if (r.status === "적용 후보") s += 100; else if (r.status === "연도 확인 필요") s += 60; else if (r.status === "단위 확인 필요") s += 45; else if (r.status === "검수 필요") s += 25; else if (r.status === "오류 의심") s += 5; else if (r.status === "제외") s -= 1000;
  const sec = r.section || "";
  if (/요약\s*재무상태표|요약\s*손익계산서/.test(sec)) s += 30;
  else if (/상세|^재무상태표|^손익계산서/.test(sec)) s += 20;
  else if (/MY/.test(sec)) s += 8;
  const lab = r.rawLabel || r.account || "";
  if (/총계$/.test(lab)) s += 12;                 // 부채총계/자본총계/자산총계 정확 일치 우선
  else if (/^(부채|자본|자산)$/.test(lab)) s -= 6; // 일반 부채/자본/자산 라인은 후순위
  if (/(자본금|자본잉여금)/.test(lab)) s -= 40;     // 자본금은 자본총계 후보에서 사실상 제외
  // 비율은 '재무비율 전체표'에서 직접 뽑은 값을 요약 카드보다 최우선
  if (r.fromFullTable) s += 200;
  if (r.isAggregate && !r.isRatio) s += 18;   // (*) 집계행을 하위 세부행보다 우선(단기차입금 등)
  return s;
}
// 한 라인에 지표명이 2개 이상 있는 경우(예: "부채비율 63.34 61.99 61.6 매출채권회전율 6.31 5.52 5.76")
// 지표명 기준으로 분할해 각 지표의 값 배열을 따로 뽑는다. 음수(- / △)도 인식.
function cretopSplitLineMetrics(line, am, rm) {
  const A = am || CRETOP_EXTRACT_ACCT, R = rm || CRETOP_EXTRACT_RATIO;
  const toks = String(line).split(/\s+/).filter(Boolean);
  const matchAcct = (s) => { const norm = normalizeAccountLabel(String(s).replace(/[\s△▲▼▽()*+\-]+$/, "")); if (A[norm]) return { key: A[norm], label: norm, isRatio: false }; if (R[norm]) return { key: R[norm][0], label: norm, isRatio: true, unit: R[norm][1] }; return null; };
  const asNum = (t) => { const m = String(t).match(/^([△▽(]?)(-?)([\d,]+(?:\.\d+)?)\)?$/); if (!m) return null; const v = parseNumLoose(m[3]); if (v == null) return null; return (m[1] || m[2] === "-") ? -Math.abs(v) : v; };
  const segs = []; let cur = null; let neg = false;
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t === "-" || t === "△" || t === "▽") { neg = true; continue; }            // 음수 부호(공백 분리)
    if (t === "▲" || t === "▼") { neg = false; continue; }                          // 증감 화살표(부호 아님)
    const v = asNum(t);
    if (v != null) { if (cur) cur.values.push(neg && v > 0 ? -v : v); neg = false; continue; }
    neg = false;
    let acct = matchAcct(t), consumed = 1;
    if (!acct) { let merged = t; for (let j = i + 1; j < toks.length && j <= i + 3 && asNum(toks[j]) == null && toks[j] !== "-"; j++) { merged += toks[j]; const a2 = matchAcct(merged); if (a2) { acct = a2; consumed = j - i + 1; break; } } }
    if (acct) { cur = { key: acct.key, label: acct.label, isRatio: !!acct.isRatio, unit: acct.unit, values: [] }; segs.push(cur); i += consumed - 1; }
  }
  return segs.filter((s) => s.values.length);
}
// 한 줄만 보지 않고 계정명 발견 시 주변 라인의 숫자/연도를 모아 후보 행 생성(형태 A~E 대응)
function extractCretopCandidatesFromLines(rawText, opts) {
  const am = opts && opts.acct; const rm = opts && opts.ratio; const labels = (opts && opts.labels) || EXTRACT_LABEL_KR;
  const dbg = analyzeCretopRaw(rawText, am, rm); const lines = dbg.lines; const rows = []; let idc = 0;
  // 섹션 단위 연도축 산출(연도 헤더가 표 위/아래 어디 있거나 줄이 깨져 있어도 같은 섹션이면 공유)
  const lineSecYears = new Array(lines.length).fill(null);
  { let start = 0; const flush = (s, e) => { const ys = []; for (let k = s; k < e; k++) { const yl = cretopLineYears(lines[k].ntext); if (yl) yl.forEach((y) => { if (!ys.includes(y)) ys.push(y); }); } const sorted = ys.slice().sort((a, b) => a - b); for (let k = s; k < e; k++) lineSecYears[k] = sorted; };
    for (let k = 0; k < lines.length; k++) { if (k > 0 && cretopSecOf(lines[k].ntext)) { flush(start, k); start = k; } } flush(start, lines.length); }
  const addRow = (L, acct, valueNumsIn, years, unitIn, ctx) => {
    let valueNums = (valueNumsIn || []).slice(); if (!valueNums.length) return;
    let unit = acct.isRatio ? acct.unit : unitIn;
    // 붙어버린 다년치 정수(금액) 재분할 — 음수 부호는 첫 값에 적용
    let splitNote = "";
    if (!acct.isRatio && valueNums.length === 1 && years.length >= 2 && Number.isInteger(valueNums[0])) {
      const ds = String(valueNums[0]);
      if (ds.replace(/^-/, "").length > years.length) { const split = splitCretopCompactNumbersByYears(ds, years, acct.label); if (split && split.length === years.length) { valueNums = split; splitNote = ` · 글자 단위 PDF로 ${years.length}개년 숫자가 붙어 ${years.length}분할 후 자연스러운 조합 선택`; } }
    }
    // 최대 연도 수(지표명 뒤 N개)만 — 5개년처럼 과다 표시 방지
    if (years.length && valueNums.length > years.length) valueNums = valueNums.slice(0, years.length);
    let selected = null, latestIndex = -1, latestYear = null, reason = "", status = "", confidence = "보통";
    const tooMany = valueNums.length > (years.length ? years.length : 4) + 1;
    if (years.length && valueNums.length === years.length) { latestYear = Math.max(...years); latestIndex = years.indexOf(latestYear); selected = valueNums[latestIndex]; reason = `연도 ${years.join("/")} 중 최신 ${latestYear} → index ${latestIndex}`; status = "적용 후보"; confidence = "높음"; }
    else if (tooMany) { selected = valueNums[valueNums.length - 1]; latestIndex = valueNums.length - 1; latestYear = years.length ? Math.max(...years) : null; reason = `숫자 후보 ${valueNums.length}개 과다 — 자동 선택 보류(오른쪽 값 임시)`; status = "검수 필요"; confidence = "낮음"; }
    else if (years.length) { latestYear = Math.max(...years); selected = valueNums[valueNums.length - 1]; latestIndex = valueNums.length - 1; reason = `값 개수(${valueNums.length})≠연도(${years.length}) — 오른쪽 값 사용`; status = "검수 필요"; confidence = "보통"; }
    else { selected = valueNums[valueNums.length - 1]; latestIndex = valueNums.length - 1; reason = "연도 미감지 — 오른쪽 끝(최신) 값 사용"; status = "연도 확인 필요"; confidence = "보통"; }
    if (splitNote) reason += splitNote;
    const uf = unit && FINAL_UNIT_EOK[unit] != null ? FINAL_UNIT_EOK[unit] : null;
    if (!acct.isRatio) {
      if (uf == null && status === "적용 후보") { status = "단위 확인 필요"; confidence = "보통"; }
      if (uf != null && selected != null) { const v = validateAmountEok(selected * uf, acct.label); if (v.level === "suspect" || v.level === "error" || v.level === "exclude") { status = "오류 의심"; confidence = "낮음"; } }
    }
    const hardBlock = /동종\s*업계|업계\s*순위|상위|하위|업종\s*평균|평균/.test(L.ntext || "");
    if (acct.isRatio) { if (hardBlock) { status = "제외"; confidence = "낮음"; reason = "동종업계/업계순위 비교값으로 보여 자사 지표에서 제외"; } }
    else if (L.blocked) { status = "제외"; confidence = "낮음"; reason = `차단 섹션(${L.section}) — 다른 회사 숫자 가능성`; }
    const isAggregate = /\(\s*\*\s*\)/.test(L.ntext || "");   // 집계행((*) 표기) 우선용
    rows.push({ id: `c${idc++}`, accountKey: acct.key, account: labels[acct.key] || acct.label, rawLabel: acct.label, isRatio: !!acct.isRatio, lineIndex: L.li, rawLineIndex: L.i, contextLines: ctx, rowText: L.text, normLine: L.ntext, numberCandidates: valueNums, yearCandidates: years, rawValue: selected, latestIndex, year: latestYear, selectedReason: reason, unit, section: L.section, confidence, status, isAggregate, sel: status === "적용 후보" });
  };
  for (let li = 0; li < lines.length; li++) {
    const L = lines[li]; if (!L.acctKey) continue;
    let unit = "";
    for (let k = li; k >= 0; k--) { if (lines[k].unit) { unit = lines[k].unit; break; } if (lines[k].section !== L.section) break; }
    if (!unit) { if (/요약|MY/.test(L.section)) unit = "백만원"; else if (/재무상태표|손익계산서/.test(L.section)) unit = "천원"; }
    const years = (lineSecYears[li] || []).slice();
    const ctx = [{ i: L.i, li: L.li, text: L.text, ntext: L.ntext }];
    // 한 라인에 여러 지표가 함께 있으면 지표별로 분할해 각각 행 생성
    const segs = cretopSplitLineMetrics(L.ntext, am, rm);
    if (segs.length) { for (const seg of segs) addRow(L, seg, seg.values, years, unit, ctx); }
    else {
      // 계정명만 있고 값은 다음 줄 — 주변 라인에서 값 수집(형태 A~E)
      const acct = cretopLineAcct(L.ntext, am, rm); if (!acct) continue;
      const valueNums = []; let started = false;
      for (let k = li + 1; k <= Math.min(li + 8, lines.length - 1); k++) {
        const W = lines[k]; ctx.push({ i: W.i, li: W.li, text: W.text, ntext: W.ntext });
        if (W.acctKey || cretopSecOf(W.ntext)) break;
        if (cretopLineYears(W.ntext)) continue;
        const vs = cretopValuesIn(W.ntext);
        if (vs.length) { valueNums.push(...vs); started = true; }
        else if (started) break;
      }
      if (valueNums.length) addRow(L, acct, valueNums, years, unit, ctx);
    }
  }
  // 같은 지표가 여러 후보면 순위(정확 계정명·요약 재무표·상태) 점수로 최우선 1건만 자동선택/미리보기 대표로
  { const bestByKey = {}; rows.forEach((r) => { const k = r.accountKey; if (!bestByKey[k] || cretopRowRank(r) > cretopRowRank(bestByKey[k])) bestByKey[k] = r; });
    rows.forEach((r) => { const isBest = bestByKey[r.accountKey] === r; r.isPrimary = isBest; if (!isBest && r.sel) r.sel = false; }); }
  return { rows, debug: dbg, detectedYears: dbg.detectedYears, sections: dbg.detectedSections, detectedUnits: dbg.detectedUnits };
}
// 지표별 대표 후보 1개만 추천으로, 나머지는 대체/검수/제외로 분리(중복 후보 정리)
function selectBestCretopCoreCandidates(rows) {
  const all = rows || [];
  const okStatus = (s) => s === "적용 후보" || s === "연도 확인 필요";
  const reviewStatus = (s) => s === "검수 필요" || s === "단위 확인 필요" || s === "오류 의심";
  const primary = {};
  all.forEach((r) => { if (r.status === "제외") return; const k = r.accountKey; if (!primary[k] || cretopRowRank(r) > cretopRowRank(primary[k])) primary[k] = r; });
  const recommended = [], alternates = [], review = [], excluded = [];
  all.forEach((r) => {
    if (r.status === "제외") { excluded.push(r); return; }
    const isPrim = primary[r.accountKey] === r;
    if (isPrim && okStatus(r.status)) recommended.push(r);
    else if (reviewStatus(r.status)) review.push(r);
    else alternates.push(r);
  });
  const ord = (r) => { const i = CORE_PREVIEW_ORDER.indexOf(r.accountKey); return i < 0 ? 999 : i; };
  recommended.sort((a, b) => ord(a) - ord(b));
  return { primary, recommended, alternates, review, excluded };
}
// ── 크레탑 핵심지표(1단계) — 핵심 재무/신용 지표 후보 추출 + 수동확인 저장 ──
const CORE_ACCT = Object.assign({}, CRETOP_EXTRACT_ACCT, { "현금및현금성자산": "cash", "현금성자산": "cash", "현금및현금등가물": "cash", "매출원가": "cogs", "판매비와관리비": "sga", "판매관리비": "sga", "판관비": "sga" });
const CORE_RATIO = Object.assign({}, CRETOP_EXTRACT_RATIO, {
  // 수익성
  "영업이익률": ["opMargin", "%"], "매출액영업이익률": ["opMargin", "%"], "순이익률": ["netMargin", "%"], "매출액순이익률": ["netMargin", "%"],
  "EBITDA마진율": ["ebitdaMargin", "%"], "EBITDA마진": ["ebitdaMargin", "%"],
  "총자산수익률": ["roa", "%"], "총자산순이익률": ["roa", "%"], "총자산법인세차감전순이익률": ["roa", "%"], "ROA": ["roa", "%"],
  // 성장성
  "매출증가율": ["salesGrowth", "%"], "매출액증가율": ["salesGrowth", "%"], "영업이익증가율": ["opGrowth", "%"], "순이익증가율": ["niGrowth", "%"], "당기순이익증가율": ["niGrowth", "%"], "총자산증가율": ["assetGrowth", "%"], "자산증가율": ["assetGrowth", "%"], "자기자본증가율": ["equityGrowth", "%"], "재고자산회전율": ["inventoryTurnover", "회"],
  // 재무구조
  "자기자본비율": ["equityRatio", "%"], "차입금의존도": ["debtDependency", "%"],
  // 부채상환능력
  "EBITDA총차입금": ["ebitdaToDebt", ""], "EBITDA/총차입금": ["ebitdaToDebt", ""], "총차입금EBITDA": ["ebitdaToDebt", ""],
  "차입금매출액": ["debtToSales", "%"], "차입금/매출액": ["debtToSales", "%"],
  // 활동성
  "매출채권회전율": ["arTurnover", "회"], "총자본회전율": ["totalCapitalTurnover", "회"], "총자산회전율": ["totalCapitalTurnover", "회"], "자기자본회전율": ["equityTurnover", "회"],
});
const CORE_LABELS = Object.assign({}, EXTRACT_LABEL_KR, { cash: "현금및현금성자산", cogs: "매출원가", sga: "판매비와관리비", netIncomeMargin: "당기순이익률", opMargin: "영업이익률", netMargin: "순이익률", salesGrowth: "매출액증가율", equityRatio: "자기자본비율", ebitdaMargin: "EBITDA마진율", roa: "총자산순이익률(ROA)", opGrowth: "영업이익증가율", niGrowth: "순이익증가율", assetGrowth: "총자산증가율", debtDependency: "차입금의존도", ebitdaToDebt: "EBITDA/총차입금", debtToSales: "차입금/매출액", arTurnover: "매출채권회전율(회)", totalCapitalTurnover: "총자본회전율(회)", equityTurnover: "자기자본회전율(회)", equityGrowth: "자기자본증가율", inventoryTurnover: "재고자산회전율(회)" });
const CORE_PREVIEW_ORDER = ["revenue", "operatingProfit", "netIncome", "netIncomeMargin", "totalAssets", "totalLiabilities", "totalEquity", "retainedEarnings", "cash", "creditGrade", "debtRatio", "currentRatio", "interestCoverageRatio", "shortTermBorrowings", "longTermBorrowings"];
// 재무비율 표의 '구분(카테고리)' 라벨 — char-spaced로 지표명과 붙었을 때 이 접두어만 떼서 매칭(임의 접미 매칭 금지 → '금융비용대총부채비율'→부채비율 오매칭 차단)
const CRETOP_RATIO_CATS = ["성장성", "수익성", "안정성", "활동성", "생산성", "재무구조", "부채상환능력", "유동성", "레버리지", "효율성", "손익", "현금흐름"];
// 3개년 추이 표시 대상(금액·핵심비율)
const CORE_TREND_ORDER = ["revenue", "operatingProfit", "netIncome", "totalAssets", "totalLiabilities", "totalEquity", "cash", "retainedEarnings", "shortTermBorrowings", "longTermBorrowings", "debtRatio", "currentRatio", "interestCoverageRatio"];
// 재무비율 5개 영역(각 3개 지표)
const CRETOP_RATIO_AREAS = [
  { key: "growth", name: "성장성", metrics: ["salesGrowth", "opGrowth", "assetGrowth"], hint: "매출·영업이익·자산이 어느 방향으로 움직이는지 추이 확인이 필요합니다." },
  { key: "profit", name: "수익성", metrics: ["opMargin", "ebitdaMargin", "roa"], hint: "이익률 수준과 자산 대비 수익성은 원가·판관비 구조와 함께 확인이 필요합니다." },
  { key: "structure", name: "재무구조", metrics: ["debtDependency", "debtRatio", "currentRatio"], hint: "부채 수준과 단기 지급능력은 현금성 자산·단기채무 구조와 함께 확인이 필요합니다." },
  { key: "coverage", name: "부채상환능력", metrics: ["interestCoverageRatio", "ebitdaToDebt", "debtToSales"], hint: "영업이익·EBITDA로 이자·차입금을 감당하는 수준은 원문 기준 확인이 필요합니다." },
  { key: "activity", name: "활동성", metrics: ["arTurnover", "totalCapitalTurnover", "equityTurnover", "inventoryTurnover"], hint: "자산·자본이 매출로 얼마나 회전하는지 회수기간과 함께 확인이 필요합니다." },
];
// 상세 재무제표(참고용) — 재무상태표/손익계산서/이익잉여금처분/제조원가 주요 항목
// 명세서별 계정과목 표시 순서(원문 우선순서) — 가능한 한 모두 추출/정렬
const CRETOP_DETAIL_GROUPS = [
  { key: "bs", name: "재무상태표", secRe: /재무상태표|MY/, names: ["유동자산", "당좌자산", "현금및현금성자산", "기타현금및예금", "단기예금", "단기금융상품", "매출채권", "기타매출채권", "미수금", "기타미수금", "재고자산", "비유동자산", "투자자산", "유형자산", "무형자산", "기타비유동자산", "자산총계", "유동부채", "매입채무", "단기차입금", "미지급금", "기타유동부채", "비유동부채", "장기차입금", "퇴직급여충당부채", "부채총계", "자본금", "자본잉여금", "이익잉여금", "미처분이익잉여금", "자본총계"] },
  { key: "is", name: "손익계산서", secRe: /손익계산서/, names: ["매출액", "상품매출액", "국내매출", "제품매출액", "공사수익", "매출원가", "상품매출원가", "제품매출원가", "공사원가", "매출총이익", "판매비와관리비", "급여", "퇴직급여", "복리후생비", "여비교통비", "접대비", "기업업무추진비", "통신비", "수도광열비", "세금과공과", "감가상각비", "지급임차료", "보험료", "차량유지비", "운반비", "교육훈련비", "도서인쇄비", "지급수수료", "광고선전비", "소모품비", "대손상각비", "영업이익", "영업외수익", "이자수익", "외환차익", "기타영업외수익", "영업외비용", "이자비용", "외환차손", "기타영업외비용", "법인세비용차감전순손익", "법인세차감전순이익", "법인세비용", "계속사업이익", "당기순이익"] },
  { key: "re", name: "이익잉여금처분계산서", secRe: /이익잉여금처분/, names: ["미처분이익잉여금", "전기이월미처분이익잉여금", "전기오류수정이익", "중간배당액", "당기순이익", "이익잉여금처분액", "이익준비금", "배당금", "현금배당", "차기이월미처분이익잉여금"] },
  { key: "mc", name: "제조원가명세서", secRe: /제조원가/, names: ["원재료비", "기초원재료재고", "당기매입액", "기말원재료재고", "노동관계비용", "노무비", "급여", "퇴직급여", "복리후생비", "경비", "외주비", "외주가공비", "감가상각비", "보험료", "전력비", "운반비", "지급수수료", "소모품비", "포장비", "경상개발비", "차량유지비", "당기총제조비용", "기초재공품재고", "기말재공품재고", "당기제품제조원가"] },
];
const CRETOP_DETAIL_NONFIN = /조회일시|COPYRIGHT|페이지|단위\s*[:：]|^주소|^전화|사업\s*목적|^연혁|감사\s*의견|기업\s*개요|구분\s*계정명|^계정명|^업종|^대표자|사업자\s*번호|법인\s*번호|표준\s*산업|주요\s*제품|동종\s*업계|업계\s*순위|현금\s*흐름/;
// 계정명 정규화(괄호·콤마 보존, 공백만 제거) — (기말원재료재고)·공구,기구,비품 등 유지
function normalizeDetailLabel(s) { return String(s || "").replace(/[\*　]/g, "").replace(/\s+/g, "").trim(); }
// 상세 재무상태표 원문 표시 순서(감사의견 → 자산 → 유동자산 → 당좌자산 …) — 핵심항목 우선정렬 제거용 강제 order map
const CRETOP_BS_ORDER = ["감사의견", "자산", "유동자산", "당좌자산", "현금및현금성자산", "기타현금및예금", "단기예금", "기타", "매출채권", "미수금", "기타미수금", "선급금", "선급비용", "재고자산", "원재료", "비유동자산", "투자자산", "기타투자자산", "유형자산", "토지", "건물및부속설비", "감가상각누계액", "구축물", "기계장치", "시설장치", "차량운반구", "공구,기구,비품", "기타유형자산", "무형자산", "산업재산권", "개발비", "기타비유동자산", "장기성매출채권", "보증금등", "부채", "유동부채", "매입채무", "단기차입금", "주주임원종업원단기차입금", "기타단기차입금", "미지급금", "미지급배당금", "기타미지급금", "예수금", "부가세예수금", "기타예수금", "비유동부채", "장기차입금", "기타장기차입금", "자본", "자본금", "보통주자본금", "자본잉여금", "자본준비금", "기타자본잉여금", "이익잉여금", "이익준비금", "미처분이익잉여금", "당기순이익"];
const CRETOP_BS_ORDER_MAP = (() => { const m = {}; CRETOP_BS_ORDER.forEach((nm, i) => { if (m[nm] == null) m[nm] = i; }); return m; })();
// 집계행 '(*)'→'()' 잔여 괄호를 떼어 base 계정명으로 order 조회(단기차입금()·유동자산() 등도 매칭)
function cretopBsOrderIndex(rawLabel) { const base = String(rawLabel || "").replace(/\([^)]*\)/g, ""); const i = CRETOP_BS_ORDER_MAP[rawLabel] != null ? CRETOP_BS_ORDER_MAP[rawLabel] : CRETOP_BS_ORDER_MAP[base]; return i == null ? 999 : i; }
// 재무상태표 items를 원문 순서(order map)로 강제 정렬 — 동일 index는 원래 순서 유지(stable)
function cretopSortBsItems(items) { return (items || []).map((it, i) => ({ it, i, o: cretopBsOrderIndex(it.rawLabel) })).sort((a, b) => a.o - b.o || a.i - b.i).map((x) => x.it); }
// 상세 명세서 한 줄에서 '계정명 + 연도값(숫자/빈칸 -)' 일반 추출(사전에 없는 계정도 수집)
// yearN: 연도 수(있으면 단독 '-'가 음수부호인지 빈칸인지 개수로 판정 — char-spaced "- 129,326" 누락/밀림 방지)
function parseCretopDetailRow(ntext, yearN) {
  if (!ntext || CRETOP_DETAIL_NONFIN.test(ntext)) return null;
  const toks = String(ntext).split(/\s+/).filter(Boolean);
  const isNum = (t) => /^-?[\d,]+(?:\.\d+)?$/.test(t);   // 붙은 음수(-123)는 숫자로 인식
  const isDash = (t) => t === "-" || t === "－";
  let fv = -1;
  for (let i = 0; i < toks.length; i++) { const t = toks[i]; if (isNum(t) || isDash(t)) { fv = i; break; } if ((t === "△" || t === "▽") && i + 1 < toks.length && isNum(toks[i + 1])) { fv = i; break; } }
  if (fv <= 0) return null;
  const name = normalizeDetailLabel(toks.slice(0, fv).join(""));
  if (!/[가-힣]/.test(name) || /^[(]?(구분|계정명)[)]?$/.test(name)) return null;
  // 토큰 → 셀 분류: num(부호포함 숫자) / dash(단독 '-', 다음이 숫자인지 표시)
  const cells = []; let pendingNeg = false;
  for (let i = fv; i < toks.length; i++) { const t = toks[i];
    if (t === "△" || t === "▽") { pendingNeg = true; continue; }
    if (t === "▲" || t === "▼") { pendingNeg = false; continue; }
    if (isDash(t)) { cells.push({ type: "dash", beforeNum: (i + 1 < toks.length) && isNum(toks[i + 1]) }); continue; }
    if (isNum(t)) { let v = parseFloat(t.replace(/,/g, "")); if (pendingNeg) v = -Math.abs(v); cells.push({ type: "num", val: v }); pendingNeg = false; continue; }
    break;
  }
  const numCount = cells.filter((c) => c.type === "num").length;
  const dashCount = cells.length - numCount;
  let vals;
  if (yearN >= 2 && numCount === yearN && (numCount + dashCount) > yearN) {
    // 숫자 개수가 연도 수와 같고 '-'가 초과 → 숫자 앞 '-'는 음수부호(병합), 단독 '-'는 무시
    vals = [];
    for (let i = 0; i < cells.length; i++) { const c = cells[i]; if (c.type === "dash") { if (c.beforeNum && cells[i + 1] && cells[i + 1].type === "num") cells[i + 1].val = -Math.abs(cells[i + 1].val); continue; } vals.push(c.val); }
  } else {
    vals = cells.map((c) => c.type === "num" ? c.val : null);   // '-'는 빈칸(null)
  }
  if (vals.filter((v) => v != null).length < 1) return null;
  return { name, values: vals };
}
// 상세 재무제표 — 섹션 안에서 계정명+숫자 행을 가능한 한 모두(사전 미등록 포함) 원문 순서대로 수집
function extractCretopDetail(rawText) {
  const dbg = analyzeCretopRaw(rawText); const lines = dbg.lines;
  const lineSecYears = new Array(lines.length).fill(null);
  { let start = 0; const flush = (s, e) => { const ys = []; for (let k = s; k < e; k++) { const yl = cretopLineYears(lines[k].ntext); if (yl) yl.forEach((y) => { if (!ys.includes(y)) ys.push(y); }); } const sorted = ys.slice().sort((a, b) => a - b); for (let k = s; k < e; k++) lineSecYears[k] = sorted; };
    for (let k = 0; k < lines.length; k++) { if (k > 0 && cretopSecOf(lines[k].ntext)) { flush(start, k); start = k; } } flush(start, lines.length); }
  const groupOf = (sec) => { if (/이익잉여금처분/.test(sec)) return "re"; if (/제조원가/.test(sec)) return "mc"; if (/손익계산서/.test(sec)) return "is"; if (/재무상태표|MY/.test(sec)) return "bs"; return null; };
  const bySec = { bs: {}, is: {}, re: {}, mc: {} }; const secYears = { bs: {}, is: {}, re: {}, mc: {} }; const secDateHdr = { bs: {}, is: {}, re: {}, mc: {} }; const noData = {};
  lines.forEach((L, li) => {
    const gk = groupOf(L.section || ""); if (!gk) return;
    if (/조회된\s*자료가\s*없|자료가\s*없습니다|해당\s*자료\s*없/.test(L.ntext)) { noData[gk] = true; return; }
    // 상세 명세서 신호: 'YYYY-MM-DD' 날짜 헤더가 있는 섹션은 상세표(요약/MY가 아님)로 표시
    if (cretopLineYears(L.ntext) && /(?:19|20)\d{2}\s*[-.\/]\s*\d{1,2}\s*[-.\/]\s*\d{1,2}/.test(L.ntext)) secDateHdr[gk][L.section || "?"] = true;
    if (cretopSecOf(L.ntext) || cretopLineYears(L.ntext)) return;
    const years = (lineSecYears[li] || []).slice(); const yearN = years.length || 3;
    const sn0 = L.section || "?";
    // 구조 헤더(감사의견/자산/부채/자본/당좌자산 등 — 숫자 없는 행)도 원문 순서대로 포함('감사의견'부터 시작)
    const lab0 = normalizeDetailLabel(L.ntext);
    // 감사의견은 의견 텍스트(적정/한정/부적정/의견거절)가 붙어도 헤더성 첫 행으로 보존 — lineIndex가 가장 앞이면 그대로 첫 행
    const isAudit = /^감사의견/.test(lab0);
    if (isAudit || /^(자산|부채|자본|당좌자산)$/.test(lab0)) { const auditOpinion = isAudit ? ((L.ntext.match(/적정|한정|부적정|의견거절|비적정/) || [])[0] || null) : null; (bySec[gk][sn0] = bySec[gk][sn0] || []).push({ id: `d_${gk}_${li}`, accountKey: "d_" + (isAudit ? "감사의견" : lab0), account: isAudit ? "감사의견" : lab0, rawLabel: isAudit ? "감사의견" : lab0, isRatio: false, lineIndex: L.li, contextLines: [], rowText: L.text, normLine: L.ntext, numberCandidates: Array.from({ length: yearN }, () => null), yearCandidates: years.length ? years : [], rawValue: auditOpinion, year: years[years.length - 1] || null, unit: L.unit || "천원", section: sn0, status: "연도 확인 필요", confidence: "보통", isHeader: true, sel: false }); secYears[gk][sn0] = years; return; }
    const seg = parseCretopDetailRow(L.ntext, yearN); if (!seg) return;
    let vals = seg.values.slice();
    // 글자단위로 붙어버린 다년치 순수정수(예 "410256102")를 연도 수만큼 재분할
    // 단, '-'(빈칸) 칸이 있는 행(예 "88470 - -")은 단일연도 실제값이므로 분할 금지 → 토큰이 정확히 1개(placeholder 없음)일 때만 적용
    if (vals.length === 1 && yearN >= 2) { const only = vals[0]; if (only != null && Number.isInteger(only) && only >= 0 && String(only).length > yearN && !/[,.]/.test(seg.name)) { const sp = splitCretopCompactNumbersByYears(String(only), years.length ? years : Array.from({ length: yearN }, (_, i) => i), seg.name); if (sp && sp.length === yearN) vals = sp; } }
    vals = vals.slice(0, yearN); while (vals.length < yearN) vals.push(null);  // 3개년 컬럼 유지(빈칸은 null)
    const unit = L.unit || (/요약|MY/.test(L.section) ? "백만원" : "천원"); const sn = L.section || "?";
    const nz = vals.slice().reverse().find((v) => v != null);
    (bySec[gk][sn] = bySec[gk][sn] || []).push({ id: `d_${gk}_${li}`, accountKey: "d_" + seg.name, account: seg.name, rawLabel: seg.name, isRatio: false, lineIndex: L.li, contextLines: [], rowText: L.text, normLine: L.ntext, numberCandidates: vals, yearCandidates: years.length ? years : [], rawValue: nz != null ? nz : null, year: years[years.length - 1] || null, unit, section: sn, status: "연도 확인 필요", confidence: "보통", sel: false });
    secYears[gk][sn] = years;
  });
  const DETAIL_ONLY_ACCT = /당좌자산|기타현금및예금|단기대여금|기타단기대여금|선급법인세|선급부가세|매출채권|선급금|선급비용/;
  const groups = CRETOP_DETAIL_GROUPS.map((g) => {
    const secs = bySec[g.key]; const secNames = Object.keys(secs);
    // 상세표 우선순위 점수: ① YYYY-MM-DD 날짜헤더(상세 명세서 신호) ② 요약/MY 아님 ③ 상세 전용 계정 보유 ④ 행 수
    // → MY 재무 Data/요약표를 상세 재무상태표 표시용으로 끌어오지 않도록 함(상세 구간이 있으면 반드시 상세 우선)
    const score = (sn) => { const rws = secs[sn] || []; let s = 0; if (secDateHdr[g.key] && secDateHdr[g.key][sn]) s += 1000; if (!/요약|MY/.test(sn)) s += 100; if (rws.some((r) => DETAIL_ONLY_ACCT.test(r.rawLabel || ""))) s += 40; s += Math.min(rws.length, 60); return s; };
    const bestSec = secNames.length ? secNames.slice().sort((a, b) => score(b) - score(a))[0] : null;
    const rows = bestSec ? secs[bestSec] : [];
    const bsSource = g.key === "bs" ? (bestSec == null ? null : (/MY/.test(bestSec) ? "myData" : (/요약/.test(bestSec) ? "summary" : "detailedStatement"))) : null;
    let items;
    if (g.key === "bs") {
      // 재무상태표는 원문 순서(lineIndex ASC) 그대로 유지 — account order map/핵심항목·대표계정·금액·status 정렬 금지, 중복 계정명도 lineIndex가 다르면 별도 행으로 보존
      items = rows.slice().sort((a, b) => ((a.lineIndex == null ? 0 : a.lineIndex) - (b.lineIndex == null ? 0 : b.lineIndex)));
      // MY 재무 Data/요약표 행이 상세 재무상태표 섹션에 섞여 들어온 경우(같은 '재무상태표' 섹션명): 상세표는 '감사의견'에서 시작하므로 그 앞 행(요약 2개년 등)을 제거
      const auditIdx = items.findIndex((it) => /^감사의견/.test(it.rawLabel || ""));
      if (auditIdx > 0) items = items.slice(auditIdx);
    } else {
      const seen = new Set(); items = [];
      rows.forEach((r) => { if (seen.has(r.rawLabel)) { const ex = items.find((x) => x.rawLabel === r.rawLabel); if (ex && (r.numberCandidates || []).filter((v) => v != null).length > (ex.numberCandidates || []).filter((v) => v != null).length) items[items.indexOf(ex)] = r; return; } seen.add(r.rawLabel); items.push(r); });
    }
    const liArr = items.map((it) => it.lineIndex).filter((n) => typeof n === "number");
    const grpUnit = (items.find((it) => it.unit) || {}).unit || null;
    return { key: g.key, name: g.name, items, noData: !!noData[g.key], years: (bestSec && secYears[g.key][bestSec]) || [], secStart: liArr.length ? Math.min(...liArr) : null, secEnd: liArr.length ? Math.max(...liArr) : null, source: bsSource, unit: grpUnit, sectionName: bestSec || null };
  }).filter((g) => g.items.length || g.noData);
  return groups;
}
// 재무비율 지표명 → CORE_RATIO 키 정규화
function normalizeRatioMetricName(name) {
  const norm = normalizeAccountLabel(String(name || ""));
  if (CORE_RATIO[norm]) return CORE_RATIO[norm][0];
  return null;
}
const CRETOP_RATIO_TEXTVAL = /^(적자전환|흑자전환|적자지속|흑자지속|조회된자료가없습니다|자료없음|해당없음)$/;
// 한 줄에서 '지표명 + 최대 N개 값(숫자/텍스트형)' 추출
function parseRatioRow(line, N) {
  const toks = String(line).split(/\s+/).filter(Boolean);
  const isNum = (t) => /^-?[\d,]+(?:\.\d+)?$/.test(t);
  const nameToks = []; const vals = []; let started = false, neg = false;
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (!started) {
      if (t === "△" || t === "▽") { neg = true; started = true; continue; }
      if (t === "-" && i + 1 < toks.length && isNum(toks[i + 1])) { neg = true; started = true; continue; }
      if (isNum(t) || CRETOP_RATIO_TEXTVAL.test(t) || t === "*") { started = true; i--; continue; }
      nameToks.push(t); continue;
    }
    if (t === "▲" || t === "▼") { continue; }
    if (t === "△" || t === "▽" || (t === "-" && i + 1 < toks.length && isNum(toks[i + 1]))) { neg = true; continue; }
    if (isNum(t)) { let v = parseFloat(t.replace(/,/g, "")); if (neg) v = -Math.abs(v); vals.push(v); neg = false; }
    else if (CRETOP_RATIO_TEXTVAL.test(t)) { vals.push(t); neg = false; }
    else if (/^(?:적자전환|흑자전환|적자지속|흑자지속){2,}$/.test(t)) { (t.match(/적자전환|흑자전환|적자지속|흑자지속/g) || []).forEach((x) => vals.push(x)); neg = false; }   // char-spaced로 합쳐진 텍스트형(적자전환흑자전환) 분리
    else if (t === "*") { vals.push("*"); }
    else break;
    if (vals.length >= N) break;
  }
  const name = nameToks.join("");
  if (!name || !vals.length) return null;
  return { name, values: vals.slice(0, N) };
}
// 재무비율 '전체 표'(재무비율 단위:% + 연도/날짜 헤더)에서 각 지표의 3개년 값을 직접 추출(요약 카드 혼입 방지)
function extractCretopFullRatioTable(rawText) {
  const lines = normalizeCretopPdfText(rawText).split(/\r?\n/).map((l) => l.trim());
  let start = -1, years = null;
  for (let i = 0; i < lines.length; i++) {
    if (/재무\s*비율/.test(lines[i]) && !/동종|업계|순위/.test(lines[i])) {
      for (let j = i; j <= Math.min(i + 5, lines.length - 1); j++) { const yl = cretopLineYears(lines[j]); if (yl && yl.length >= 2) { start = j + 1; years = yl.slice().sort((a, b) => a - b); break; } }
      if (start >= 0) break;
    }
  }
  if (start < 0 || !years) return null;
  const N = years.length;
  const stopRe = /현금\s*흐름|기업\s*개요|감사\s*의견|재무상태표|손익계산서|제조원가|이익잉여금처분|동종\s*업계|업계\s*순위|COPYRIGHT|페이지|주요\s*주주|거래처/;
  const catRe = /^(성장성|수익성|안정성|활동성|생산성|재무구조|부채상환능력|손익|현금흐름)$/;
  const metrics = {};
  for (let i = start; i < lines.length; i++) {
    const ln = lines[i]; if (!ln) continue;
    if (stopRe.test(ln)) break;
    if (catRe.test(ln)) continue;
    const seg = parseRatioRow(ln, N); if (!seg) continue;
    const key = normalizeRatioMetricName(seg.name);
    if (key && !metrics[key]) metrics[key] = { key, name: normalizeAccountLabel(seg.name), values: seg.values, years };
  }
  return Object.keys(metrics).length ? { years, metrics } : null;
}
// 재무비율 전체표 결과 → 후보 행(가장 높은 신뢰도)로 변환해 기존 행과 병합
function cretopFullRatioRows(rawText) {
  const ft = extractCretopFullRatioTable(rawText); if (!ft) return [];
  const out = []; let idc = 0;
  Object.keys(ft.metrics).forEach((key) => {
    const m = ft.metrics[key]; const years = ft.years; const N = years.length;
    const nums = m.values.filter((v) => typeof v === "number");
    const latestNum = nums.length ? m.values.slice().reverse().find((v) => typeof v === "number") : null;
    const latestRaw = m.values[m.values.length - 1];
    const unit = (CORE_RATIO[m.name] && CORE_RATIO[m.name][1]) || "%";
    out.push({ id: `ft${idc++}`, accountKey: key, account: CORE_LABELS[key] || m.name, rawLabel: m.name, isRatio: true, lineIndex: -1, contextLines: [], rowText: `${m.name} ${m.values.join(" ")}`, normLine: `${m.name} ${m.values.join(" ")}`, numberCandidates: nums, yearCandidates: years.slice(), textValues: m.values, rawValue: typeof latestRaw === "number" ? latestRaw : (latestNum != null ? latestNum : latestRaw), latestIndex: m.values.length - 1, year: years[years.length - 1], selectedReason: "재무비율 전체표에서 직접 추출(요약 카드보다 우선)", unit, section: "재무비율(전체표)", confidence: "높음", status: "적용 후보", sel: false, fromFullTable: true });
  });
  return out;
}
// 행의 3개년 값/전년 대비 증감 산출(금액은 억원 환산, 비율은 원값·%p)
function cretopRowTrend(row) {
  if (!row || row.isGrade) return null;
  const ys = (row.yearCandidates || []).slice();
  const isR = !!row.isRatio;
  const vals = (row.textValues && row.textValues.length) ? row.textValues.slice() : (row.numberCandidates || []).slice();   // 텍스트형(적자전환 등) 포함
  const uf = isR ? 1 : (FINAL_UNIT_EOK[row.unit] != null ? FINAL_UNIT_EOK[row.unit] : null);
  const conv = (v) => (v == null ? null : (typeof v !== "number" ? v : (isR ? v : (uf != null ? Math.round(v * uf * 100) / 100 : null))));
  let series;
  if (ys.length && vals.length === ys.length) series = ys.map((y, i) => ({ year: y, raw: vals[i], val: conv(vals[i]) }));
  else series = vals.map((v) => ({ year: null, raw: v, val: conv(v) }));
  series = series.slice().sort((a, b) => (a.year || 0) - (b.year || 0));
  const n = series.length; const latest = n ? series[n - 1] : null; const prev = n >= 2 ? series[n - 2] : null;
  const stepOf = (a, b) => { if (!a || !b || typeof a.val !== "number" || typeof b.val !== "number") return null; const da = Math.round((b.val - a.val) * 100) / 100; const dp = isR ? da : (a.val !== 0 ? Math.round((da / Math.abs(a.val)) * 1000) / 10 : null); let transition = null; if (a.val < 0 && b.val >= 0) transition = "흑자전환"; else if (a.val >= 0 && b.val < 0) transition = "적자전환"; else if (a.val < 0 && b.val < 0) transition = b.val < a.val ? "적자폭 확대" : "적자폭 축소"; return { fromYear: a.year, toYear: b.year, deltaAbs: da, deltaPct: dp, transition, dir: da > 0.0001 ? "상승" : (da < -0.0001 ? "하락" : "유지") }; };
  const steps = []; for (let i = 1; i < n; i++) { const st = stepOf(series[i - 1], series[i]); if (st) steps.push(st); }
  let deltaAbs = null, deltaPct = null, dir = "확인 필요";
  const last = steps.length ? steps[steps.length - 1] : null; if (last) { deltaAbs = last.deltaAbs; deltaPct = last.deltaPct; dir = last.dir; }
  return { series, steps, latest, prev, deltaAbs, deltaPct, dir, isRatio: isR, unit: isR ? (row.unit || "") : "억원", pUnit: isR ? "%p" : "%" };
}
// 추이 한 줄 해석(비단정 톤)
function cretopTrendComment(key, t) {
  if (!t || t.dir === "확인 필요") return "추이는 원문 기준 확인이 필요합니다.";
  const d = t.dir;
  const M = {
    revenue: { 하락: "매출이 전년 대비 감소했습니다. 주요 거래처·수주·단가·제품군 변화를 확인해볼 수 있습니다.", 상승: "매출이 늘었습니다. 성장 동력과 지속성은 자료 확인 후 판단이 필요합니다.", 유지: "매출은 비슷한 수준입니다." },
    operatingProfit: { 하락: "영업이익이 줄었습니다. 원가율·판관비·인건비·외주비를 확인해볼 수 있습니다.", 상승: "영업이익이 늘었습니다.", 유지: "영업이익은 비슷한 수준입니다." },
    netIncome: { 하락: "당기순이익이 줄었습니다. 영업외비용·이자비용·법인세·일회성 비용을 확인해볼 수 있습니다.", 상승: "당기순이익이 늘었습니다.", 유지: "당기순이익은 비슷한 수준입니다." },
    totalLiabilities: { 상승: "부채가 늘었습니다. 차입 구조·금융비용을 확인해볼 수 있습니다.", 하락: "부채가 줄었습니다.", 유지: "부채는 비슷한 수준입니다." },
    totalEquity: { 상승: "자본이 늘었습니다.", 하락: "자본이 줄었습니다. 손실·배당 영향을 확인해볼 수 있습니다.", 유지: "자본은 비슷한 수준입니다." },
    cash: { 하락: "현금성 자산이 줄었습니다. 운전자금·회수기간을 확인해볼 수 있습니다.", 상승: "현금성 자산이 늘었습니다.", 유지: "현금성 자산은 비슷한 수준입니다." },
    retainedEarnings: { 상승: "이익잉여금이 누적되고 있습니다. 배당정책·임원퇴직금·목적자금·이익소각은 자료 확인 후 검토 후보로 볼 수 있습니다.", 하락: "이익잉여금이 줄었습니다.", 유지: "이익잉여금은 비슷한 수준입니다." },
  };
  return (M[key] && M[key][d]) || `전년 대비 ${d} 추세입니다. 원문 기준 확인이 필요합니다.`;
}
// 영업용 코멘트(색상 톤 포함) — 빨강(위험/악화)·초록(개선/양호)·회색(중립/확인). 비단정 톤.
function cretopTrendCommentRich(key, t) {
  if (!t || !t.series || !t.series.length || t.dir === "확인 필요") return { text: "추이는 원문 기준 확인이 필요합니다.", tone: "gray" };
  const lv = (t.latest && typeof t.latest.val === "number") ? t.latest.val : null;
  const up = t.dir === "상승", down = t.dir === "하락"; const R = "red", G = "green", N = "gray";
  switch (key) {
    case "revenue": return down ? { text: "매출이 전년 대비 감소했습니다. 주요 거래처·수주·단가·제품군 변화를 확인해볼 수 있습니다.", tone: R } : up ? { text: "매출이 전년 대비 증가했습니다. 증가 요인과 반복 가능한 거래처 구조를 확인해볼 수 있습니다.", tone: G } : { text: "매출은 비슷한 수준입니다. 거래처·단가 구조를 확인해볼 수 있습니다.", tone: N };
    case "operatingProfit": return up ? { text: "영업이익이 개선되었습니다. 원가율·판관비·단가 조정 효과를 함께 확인해볼 수 있습니다.", tone: G } : down ? { text: "영업이익이 악화되었습니다. 원가·판관비·가격정책 점검이 필요합니다.", tone: R } : { text: "영업이익은 비슷한 수준입니다. 원가·판관비 구조를 확인해볼 수 있습니다.", tone: N };
    case "netIncome": return up ? { text: "당기순이익이 개선되었습니다. 영업외손익·이자비용·법인세 영향을 함께 확인해볼 수 있습니다.", tone: G } : down ? { text: "당기순이익이 악화되었습니다. 영업외비용·이자비용·일회성 비용 여부를 확인해볼 수 있습니다.", tone: R } : { text: "당기순이익은 비슷한 수준입니다. 영업외·이자·법인세 항목을 확인해볼 수 있습니다.", tone: N };
    case "totalAssets": return up ? { text: "자산이 증가했습니다. 재고·매출채권·설비투자 증가 요인을 확인해볼 수 있습니다.", tone: G } : { text: "자산이 감소했습니다. 현금성자산·재고·유형자산 변동을 확인해볼 수 있습니다.", tone: N };
    case "totalLiabilities": return up ? { text: "부채가 증가했습니다. 차입금 증가 사유와 상환·차환 계획을 확인해볼 수 있습니다.", tone: N } : { text: "부채가 감소했습니다. 차입 구조 개선이나 상환 여력을 확인해볼 수 있습니다.", tone: G };
    case "totalEquity": return up ? { text: "자본이 증가했습니다. 이익 누적, 증자, 자본구조 개선 여부를 확인해볼 수 있습니다.", tone: G } : { text: "자본이 감소했습니다. 결손, 배당, 자본잠식 가능성을 확인해볼 수 있습니다.", tone: N };
    case "cash": return down ? { text: "현금성자산이 감소했습니다. 단기 운전자금과 매출채권 회수기간을 확인해볼 수 있습니다.", tone: R } : { text: "현금성자산이 증가했습니다. 여유자금 운용과 단기 유동성을 확인해볼 수 있습니다.", tone: G };
    case "shortTermBorrowings": return up ? { text: "단기차입금이 증가했습니다. 대표자 가수금 여부, 단기차입금의 장기차입금 전환 가능성, 유동비율 개선 여지를 확인해볼 수 있습니다.", tone: R } : { text: "단기차입금이 감소했습니다. 단기 상환 부담이 줄었는지 확인해볼 수 있습니다.", tone: N };
    case "longTermBorrowings": return up ? { text: "장기차입금이 증가했습니다. 조달 기관, 정책자금 여부, 추가 자금 필요성과 상환 계획을 확인해볼 수 있습니다.", tone: N } : { text: "장기차입금이 감소했습니다. 상환 여력과 기존 차입 조건을 확인해볼 수 있습니다.", tone: N };
    case "retainedEarnings": return (lv != null && lv < 0) ? { text: "미처분결손이 확인됩니다. 손실 원인과 자본구조 개선 방향을 확인해볼 수 있습니다.", tone: R } : { text: "이익잉여금이 누적되고 있습니다. 배당정책, 임원퇴직금, 목적자금, 이익소각은 자료 확인 후 검토 후보로 볼 수 있습니다.", tone: N };
    case "debtRatio": return (lv != null && lv > 200) ? { text: "부채비율이 높은 편입니다. 가수금 출자전환, 자본금 증가, 이익 개선을 통한 자본구조 보완을 검토해볼 수 있습니다.", tone: R } : { text: "부채비율은 비교적 안정 구간입니다. 다만 차입금 구성과 상환 조건은 함께 확인해볼 수 있습니다.", tone: G };
    case "currentRatio": return (lv == null) ? { text: "유동비율은 원문 기준 확인이 필요합니다.", tone: N } : lv < 100 ? { text: "유동비율이 낮은 편입니다. 유동부채를 비유동부채로 전환할 수 있는지, 단기 운전자금 구조를 확인해볼 수 있습니다.", tone: R } : lv < 200 ? { text: "유동비율은 추가 확인이 필요합니다. 단기채무와 현금성자산 흐름을 함께 점검해볼 수 있습니다.", tone: N } : { text: "유동비율은 양호한 편입니다. 단기 지급능력과 여유자금 운용 방향을 확인해볼 수 있습니다.", tone: G };
    case "interestCoverageRatio": return (lv == null) ? { text: "이자보상배수는 원문 기준 확인이 필요합니다.", tone: N } : lv < 1 ? { text: "이자보상배수가 낮은 편입니다. 영업이익으로 이자비용을 감당하기 어려운 구조인지 확인해볼 수 있습니다.", tone: R } : lv < 2 ? { text: "이자보상배수는 주의 구간입니다. 금융비용 부담과 차입 조건을 확인해볼 수 있습니다.", tone: N } : { text: "이자보상배수는 비교적 안정 구간입니다. 다만 차입금 증가 추이는 함께 확인해볼 수 있습니다.", tone: G };
    default: return { text: cretopTrendComment(key, t), tone: N };
  }
}
// 핵심지표 미리보기 카드 위험/양호 색상 톤
const CRETOP_PREVIEW_TONES = {
  red: { bg: "#FEF2F2", bd: "#FECACA", fg: "#B91C1C", tag: "위험" },
  green: { bg: "#F0FDF4", bd: "#BBF7D0", fg: "#15803D", tag: "양호" },
  blue: { bg: "#EFF6FF", bd: "#BFDBFE", fg: "#1D4ED8", tag: "우수" },
  purple: { bg: "#F5F3FF", bd: "#DDD6FE", fg: "#6D28D9", tag: "우수" },
  amber: { bg: "#FFFBEB", bd: "#FDE68A", fg: "#B45309", tag: "주의" },
};
function cretopGradeTone(g) { const s = String(g || "").toLowerCase().trim(); if (!s || s === "이미지 원문 확인 필요" || s === "미확인") return null; if (s.indexOf("ccc") === 0) return "red"; if (/^bbb/.test(s)) return "blue"; if (/^bb/.test(s)) return "green"; if (/^b/.test(s)) return "amber"; if (/^a/.test(s)) return "purple"; return null; }
function cretopPreviewTone(k, p, manualGrade) {
  if (k === "creditGrade") return cretopGradeTone(manualGrade || (p && p.value));
  if (k === "cashflowGrade") { const n = parseInt(String((p && p.latest) || "").replace(/\D/g, ""), 10); if (isNaN(n)) return null; return n >= 5 ? "red" : n <= 2 ? "green" : null; }
  if (!p) return null;
  const v = p.value; const nums = (p.series || []).filter((x) => typeof x === "number"); const dir = nums.length >= 2 ? (nums[nums.length - 1] > nums[0] ? "up" : nums[nums.length - 1] < nums[0] ? "down" : "flat") : null;
  if (k === "debtRatio") return (p.capitalErosion || (typeof v === "number" && (v < 0 || v > 200))) ? "red" : (typeof v === "number" ? "green" : null);
  if (k === "currentRatio") return typeof v === "number" ? (v < 200 ? "red" : "green") : null;
  if (k === "interestCoverageRatio") return typeof v === "number" ? (v < 2 ? "red" : "green") : null;
  if (k === "netIncomeMargin") return typeof v === "number" ? (v < 0 ? "red" : "green") : null;
  if (k === "totalEquity") return (typeof v === "number" && v < 0) ? "red" : (dir === "up" ? "green" : null);
  if (k === "cash") { const dec2 = nums.length >= 3 ? (nums[1] < nums[0] && nums[2] < nums[1]) : (nums.length === 2 ? nums[1] < nums[0] : false); return dec2 ? "red" : (dir === "up" ? "green" : null); }
  if (k === "shortTermBorrowings") return dir === "up" ? "red" : (dir === "down" ? "green" : null);
  return null;
}
function cretopGradeRow(key, label, val, li, lines) {
  const ctx = []; if (li >= 0) { for (let k = Math.max(0, li - 2); k <= Math.min(lines.length - 1, li + 2); k++) ctx.push({ i: lines[k].i, li: lines[k].li, text: lines[k].text }); }
  return { id: "g_" + key, accountKey: key, account: label, isGrade: true, isRatio: false, lineIndex: li, contextLines: ctx, rowText: li >= 0 ? lines[li].text : "", numberCandidates: [], yearCandidates: [], rawValue: String(val), unit: "", year: null, selectedReason: "등급/평점 후보 — 원문 기준 확인 필요", section: "기업개요", confidence: "보통", status: "적용 후보", sel: true };
}
function extractCretopGrades(rawText, dbg) {
  const t = normalizeCretopPdfText(rawText); const lines = (dbg && dbg.lines) || analyzeCretopRaw(rawText).lines;
  const lineOf = (kw) => { const l = lines.find((x) => (x.ntext || x.text || "").includes(kw)); return l ? l.li : -1; };
  const out = [];
  const credit = t.match(/기업\s*신용\s*등급\s*[:：]?\s*([A-D]{1,3}[+\-0]?)/) || t.match(/신용\s*등급\s*[:：]?\s*([A-D]{1,3}[+\-0]?)/);
  if (credit) out.push(cretopGradeRow("creditGrade", "기업신용등급", credit[1], lineOf("신용등급"), lines));
  // 현금흐름등급 — CR5/CR5/CR6 같은 3개년 등급 추이까지 추출
  const cfLine = lines.find((x) => /현금\s*흐름\s*등급/.test(x.ntext || x.text || ""));
  if (cfLine) {
    const after = String(cfLine.ntext || cfLine.text || "").replace(/^[\s\S]*?현금\s*흐름\s*등급\s*[:：]?/, "").replace(/\s+/g, "");
    const series = (after.match(/(?:CR|CF)\d{1,2}|[A-D]\d?/gi) || []).map((x) => x.toUpperCase()).slice(0, 3);
    if (series.length) { const row = cretopGradeRow("cashflowGrade", "현금흐름등급", series[series.length - 1], cfLine.li, lines); row.gradeSeries = series;
      // 연도는 현금흐름등급 라인 바로 위(1~6줄)의 '구분 YYYY YYYY YYYY'를 우선 사용(조회일시/기준일 2026 등 혼입 방지)
      let yrs = []; for (let k = cfLine.li; k >= Math.max(0, cfLine.li - 6); k--) { const yl = cretopLineYears((lines[k] && (lines[k].ntext || lines[k].text)) || ""); if (yl && yl.length >= series.length) { yrs = yl.slice().sort((a, b) => a - b).slice(-series.length); break; } }
      row.yearCandidates = yrs; out.push(row); }
    else { const cf = t.match(/현금\s*흐름\s*등급\s*[:：]?\s*(CR\s*\d+|CF\s*\d+|[A-D]\d?)/i); if (cf) out.push(cretopGradeRow("cashflowGrade", "현금흐름등급", cf[1].replace(/\s+/g, "").toUpperCase(), cfLine.li, lines)); }
  }
  const score = t.match(/신용\s*평점\s*[:：]?\s*([\d.]+)/);
  if (score) out.push(cretopGradeRow("creditScore", "신용평점", score[1], lineOf("신용평점"), lines));
  return out;
}
function extractCretopCompanyInfo(rawText, dbg) {
  const d = dbg || analyzeCretopRaw(rawText); const t = normalizeCretopPdfText(rawText);
  // 표준산업분류: "표준 산업 분류 (10차) (C13402) 직물, 편조원단 및 의복류 염색가공업" 형태 대응
  const indEndRe = "(?:제조업|가공업|판매업|도소매업|도매업|소매업|서비스업|건설업|공급업|운송업|임대업|개발업|중개업|음식점업|업)";
  const indValCap = "((?:[(（][A-Za-z]?\\d{2,6}[)）]\\s*)?[가-힣A-Za-z0-9·,()\\s]{2,60}?" + indEndRe + ")";
  const cleanInd = (s) => s ? String(s).replace(/\s+/g, " ").trim() : "";
  const stdRe = (n) => new RegExp("표준\\s*산업\\s*분류\\s*[(（]?\\s*" + n + "\\s*차\\s*[)）]?\\s*[:：]?\\s*" + indValCap);
  const std10 = cleanInd((t.match(stdRe("10")) || [])[1]);
  const std11 = cleanInd((t.match(stdRe("11")) || [])[1]);
  const std = std10 || std11 || cleanInd((t.match(new RegExp("표준\\s*산업\\s*분류\\s*[(（]?\\s*1?[01]?\\s*차?\\s*[)）]?\\s*[:：]?\\s*" + indValCap)) || [])[1]);
  const ind = std || (t.match(/(?:^|\n)\s*업종\s*[:：]\s*([가-힣A-Za-z·/()\s]{2,24}?(?:제조업|서비스업|도매업|소매업|건설업|업))/) || [])[1];
  const est = (t.match(/(?:설립(?:일|년월|일자)?|법인설립)\s*[:：]?\s*((?:19|20)\d{2}(?:[-.\/]\d{1,2}(?:[-.\/]\d{1,2})?)?)/) || [])[1];
  const emp = (t.match(/(?:종업원|직원|상시\s*근로자)\s*수?\s*[:：]?\s*(\d{1,5})\s*명?/) || [])[1];
  const product = (t.match(/주요\s*제품(?:\s*[(（]?상품[)）]?)?\s*[:：]?\s*([가-힣A-Za-z0-9·,()\s]{2,40}?)(?:\n|업종|대표|설립|$)/) || [])[1];
  const corpType = (t.match(/기업\s*유형\s*[:：]?\s*(주식회사|유한회사|유한책임회사|합자회사|합명회사|일반법인|개인사업자|[가-힣]{2,4}법인)/) || [])[1];
  const scale = (t.match(/기업\s*규모\s*[:：]?\s*(대기업|중견기업|중소기업|소상공인|소기업|중기업|벤처기업)/) || [])[1];
  const corpRegNo = (t.match(/법인\s*(?:\([^)]*\)|등록)?\s*(?:\([^)]*\)\s*)?번호\s*[:：]?\s*(\d{6}-\d{7}|\d{13})/) || [])[1];   // '법인(주민)번호' 형태 포함
  const settleMonth = (t.match(/결산\s*월\s*[:：]?\s*(\d{1,2})\s*월/) || [])[1];   // 결산월(대부분 12월, 간혹 3월 등)
  // 주소 — char-spaced + 우편번호(11138) 선행 케이스 대응: 우편번호는 건너뛰고 시·도부터 캡처
  const addrRaw = (t.match(/주\s*소\s*[:：]?\s*(?:[(（]\s*\d{4,6}\s*[)）]\s*)?((?:서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)[가-힣0-9·\-,()번길로대동읍면리\s]{4,60}?)(?:\n|전화|대표|업종|설립|$)/) || [])[1];
  const tidyAddr = (a) => !a ? "" : String(a).replace(/\s+/g, "").replace(/^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)/, "$1 ").replace(/(시|군|구)(?=[가-힣])/g, "$1 ").replace(/(읍|면|동)(?=[가-힣])/g, "$1 ").replace(/(번길|로|길|대로)(\d)/g, "$1$2").replace(/(\d+)(?=\()/g, "$1 ").replace(/(번길|길)(?=\d)/g, "$1 ").replace(/\s{2,}/g, " ").trim();
  const ew = (t.match(/EW\s*등급\s*[:：]?\s*([A-D]{1,2}[+\-0]?\d?|EW\d{1,2})\b/) || [])[1];
  return { companyName: d.companyName || "", businessNo: d.businessNo || "", corpRegNo: corpRegNo || "", settleMonth: settleMonth || "", ceoName: d.ceoName || "", industry: ind ? ind.trim() : "", standardIndustry: std ? std.trim() : "", stdIndustry10: std10 || "", stdIndustry11: std11 || "", industry10: std10 || "", industry11: std11 || "", mainProduct: product ? product.trim() : "", established: est || "", employees: emp || "", corpType: corpType || "", scale: scale || "", address: tidyAddr(addrRaw), ewGrade: ew || "" };
}
// 기업 신뢰도·외부정보(인증/산업재산권/입찰) — 원문 기준 참고용(best-effort)
function extractCretopExternalInfo(rawText) {
  const t = normalizeCretopPdfText(rawText);
  const lines = t.split(/\r?\n/).map((l) => l.trim());
  const certNames = ["벤처", "이노비즈", "메인비즈", "연구개발전담부서", "부설연구소"];
  // crETOP는 글자단위(char-spaced)로 추출돼 "벤 처 이 노 비 즈 …"가 한 토큰으로 합쳐지는 경우가 많음
  // → 공백 제거 후 '부분문자열' 등장 순서로 인증명을, '인증/미인증' 시퀀스로 상태를 매칭(토큰 분할 비의존)
  const compact = (s) => String(s).replace(/\s+/g, "");
  const orderedCert = (line) => { const c = compact(line); return certNames.map((n) => ({ n, idx: c.indexOf(n) })).filter((x) => x.idx >= 0).sort((a, b) => a.idx - b.idx).map((x) => x.n); };
  const certStatusSeq = (line) => (compact(line).match(/미인증|인증/g) || []);
  const certStatus = {};
  // 1) 이름행(상태 없음) + 다음 1~4줄 상태행
  for (let i = 0; i < lines.length && !Object.keys(certStatus).length; i++) {
    const names = orderedCert(lines[i]);
    if (names.length >= 2 && certStatusSeq(lines[i]).length === 0) {
      for (let j = i + 1; j <= Math.min(i + 4, lines.length - 1); j++) {
        const sts = certStatusSeq(lines[j]);
        if (sts.length === names.length && orderedCert(lines[j]).length < 2) { names.forEach((nm, idx) => { certStatus[nm] = sts[idx]; }); break; }
      }
    }
  }
  // 2) 한 줄에 이름+상태가 함께 합쳐진 경우(이름 순서 ↔ 상태 순서)
  if (!Object.keys(certStatus).length) {
    for (let i = 0; i < lines.length; i++) { const names = orderedCert(lines[i]); const sts = certStatusSeq(lines[i]); if (names.length >= 2 && sts.length === names.length) { names.forEach((nm, idx) => { certStatus[nm] = sts[idx]; }); break; } }
  }
  // 인증표가 최우선 — 연혁('기업부설연구소 인정') 등 표 밖의 텍스트는 사용하지 않음(미검출 시 '원문 확인 필요')
  const certs = certNames.map((name) => ({ name, status: certStatus[name] || "원문 확인 필요" }));
  const techEval = (t.match(/기술력\s*평가\s*[:：]?\s*([가-힣A-Za-z+]{1,8})/) || [])[1];
  // 산업재산권 — 이름행(특허 실용신안 …) + 값행(- - - - / 0 0 …). char-spaced/라벨토큰('평가기준연도 정보없음')에 강건
  const ipNames = [["특허", "patent"], ["실용신안", "utility"], ["디자인", "design"], ["상표권", "trademark"]];
  const orderedIp = (line) => { const c = compact(line); return ipNames.map(([nm, k]) => ({ nm, k, idx: c.indexOf(nm) })).filter((x) => x.idx >= 0).sort((a, b) => a.idx - b.idx); };
  const ipSeq = (line) => (compact(line).match(/\d{1,4}|[-－]/g) || []);
  const ipVal = {};
  for (let i = 0; i < lines.length && !Object.keys(ipVal).length; i++) {
    const names = orderedIp(lines[i]);
    if (names.length >= 2 && ipSeq(lines[i]).length < names.length) {
      for (let j = i + 1; j <= Math.min(i + 5, lines.length - 1); j++) {
        const vt = ipSeq(lines[j]);
        if (vt.length >= names.length) { const use = vt.slice(-names.length); names.forEach((x, idx) => { ipVal[x.k] = use[idx]; }); break; }
      }
    }
  }
  const ip = ipNames.reduce((acc, [kw, k]) => {
    let count = null, text = "원문 확인 필요";
    if (ipVal[k] != null) { if (/[-－]/.test(ipVal[k])) { count = 0; text = "0건"; } else { count = +ipVal[k]; text = count + "건"; } }
    else { const num = t.match(new RegExp(kw + "\\s*[:：(]?\\s*(\\d{1,4})\\s*건")); const dash = new RegExp(kw + "\\s*[:：(]?\\s*[-－]").test(t); if (num) { count = +num[1]; text = count + "건"; } else if (dash) { count = 0; text = "0건"; } }
    acc.push({ key: k, name: kw, count, text }); return acc;
  }, []);
  const bid = {};
  // '입찰건수 낙찰건수' 헤더 다음 값행('940건 -') — 첫 숫자=입찰건수, 둘째=낙찰건수('-'면 없음). 입찰은 많아도 낙찰은 드물어 숫자 있을 때만 기록.
  const bidHdr = t.match(/입\s*찰\s*건\s*수\s*낙\s*찰\s*건\s*수\s*([\d,]+)\s*건?(?:\s*([\d,]+)\s*건|\s*[-－])/);
  if (bidHdr) { bid.tenders = +bidHdr[1].replace(/,/g, ""); if (bidHdr[2]) bid.wins = +bidHdr[2].replace(/,/g, ""); }
  else { const bm = t.match(/입찰\s*건수\s*[:：]?\s*([\d,]+)\s*건/); if (bm) bid.tenders = +bm[1].replace(/,/g, ""); const wm = t.match(/낙찰\s*건수\s*[:：]?\s*([\d,]+)\s*건/); if (wm) { const w = +wm[1].replace(/,/g, ""); if (w !== bid.tenders) bid.wins = w; } }
  return { techEval: techEval || "", certs, certNames: certs.filter((c) => c.status === "인증").map((c) => c.name), ip, bid, hasResearchInst: certs.some((c) => /연구|부설/.test(c.name) && c.status === "인증") };
}
function extractCretopCore(rawText) {
  const res = extractCretopCandidatesFromLines(rawText, { acct: CORE_ACCT, ratio: CORE_RATIO, labels: CORE_LABELS });
  const grades = extractCretopGrades(rawText, res.debug);
  const company = extractCretopCompanyInfo(rawText, res.debug);
  const detail = extractCretopDetail(rawText);
  const external = extractCretopExternalInfo(rawText);
  const fullRatio = cretopFullRatioRows(rawText);   // 재무비율 전체표 우선 행(요약 카드 혼입 방지)
  return { rows: [...fullRatio, ...grades, ...res.rows], debug: res.debug, company, detail, external, detectedYears: res.detectedYears };
}
const CRETOP_UF = { "백만원": 0.01, "백만": 0.01, "천원": 1e-5, "천": 1e-5, "만원": 1e-4, "억원": 1, "억": 1, "원": 1e-8 };
// 계산형 비율의 단위 혼합 차단 — 모든 값을 '백만원' 공통 단위로 변환 후 계산(천원 값 / 백만원 값 같은 혼합 금지)
const UF_TO_MILLION = { "천원": 0.001, "천": 0.001, "백만원": 1, "백만": 1, "억원": 100, "억": 100, "만원": 0.01, "원": 1e-6 };
function toMillionWon(value, unit) { if (value == null || !Number.isFinite(Number(value))) return null; const f = UF_TO_MILLION[unit]; if (f != null) return Number(value) * f; return (unit == null || unit === "") ? null : Number(value); }
// ── 실제 UI가 사용하는 단일 최종 데이터 객체(화면은 detectedCandidates를 직접 쓰지 않음) ──
function buildCretopParsedForUi(rawText) {
  const core = extractCretopCore(rawText);
  const groups = selectBestCretopCoreCandidates(core.rows);
  const ft = extractCretopFullRatioTable(rawText);
  const det = {}; (core.detail || []).forEach((g) => { det[g.key] = g; });
  // 재무상태표(bs)는 원문 lineIndex ASC로만 정렬 — 어떤 UI용 정렬(account order map/핵심항목·대표계정·금액·status)도 적용하지 않는다
  const stmt = (g, isBs) => g ? { name: g.name, items: isBs ? (g.items || []).slice().sort((a, b) => ((a.lineIndex == null ? 0 : a.lineIndex) - (b.lineIndex == null ? 0 : b.lineIndex))) : g.items, years: g.years || [], noData: !!g.noData, secStart: g.secStart != null ? g.secStart : null, secEnd: g.secEnd != null ? g.secEnd : null, source: g.source || null, unit: g.unit || null, sectionName: g.sectionName || null } : { items: [], years: [], noData: false, secStart: null, secEnd: null, source: null, unit: null, sectionName: null };
  const detailStatements = { balanceSheet: stmt(det.bs, true), incomeStatement: stmt(det.is), retainedEarnings: stmt(det.re), manufacturingCost: stmt(det.mc) };
  // 기업개요 + 등급
  const creditRow = core.rows.find((r) => r.accountKey === "creditGrade");
  const cfRow = core.rows.find((r) => r.accountKey === "cashflowGrade");
  const companyInfo = Object.assign({}, core.company, { creditGrade: (creditRow && creditRow.rawValue) ? creditRow.rawValue : "이미지 원문 확인 필요", cashflowGrade: cfRow ? { latest: cfRow.gradeSeries ? cfRow.gradeSeries[cfRow.gradeSeries.length - 1] : cfRow.rawValue, series: cfRow.gradeSeries || null, years: cfRow.yearCandidates || [] } : null });
  // 인증/IP — 고정 키
  const ext = core.external || { certs: [], ip: [] };
  const certKey = { "벤처": "venture", "이노비즈": "innobiz", "메인비즈": "mainbiz", "연구개발전담부서": "rndDept", "부설연구소": "rndLab" };
  const certInfo = {}; (ext.certs || []).forEach((c) => { certInfo[certKey[c.name] || c.name] = c.status; });
  const ipInfo = {}; (ext.ip || []).forEach((p) => { ipInfo[p.key] = p.count; });
  companyInfo.techEval = ext.techEval || ""; companyInfo.bid = ext.bid || null;
  // 상세 재무상태표에서 최신값(집계행 (*) 우선)
  // 집계행((*) 표기, normalizeDetailLabel가 *를 지워 "단기차입금()"으로 남음) 우선, 없으면 최대 magnitude(하위행 11,000보다 집계 우선)
  const bsRow = (names) => { const g = det.bs; if (!g) return null; for (const nm of names) { const cands = g.items.filter((it) => (it.rawLabel || "").replace(/\([^)]*\)/g, "") === nm || it.rawLabel === nm); if (!cands.length) continue; const agg = cands.find((c) => /\(\s*\*?\s*\)/.test(c.rawLabel || "")); if (agg) return agg; if (cands.length === 1) return cands[0]; return cands.slice().sort((a, b) => { const av = Math.max(...(a.numberCandidates || []).map((v) => Math.abs(v || 0))), bv = Math.max(...(b.numberCandidates || []).map((v) => Math.abs(v || 0))); return bv - av; })[0]; } return null; };
  const fromRow = (r, isRatio) => { if (!r) return null; const vals = (r.numberCandidates || []).slice(); const years = (r.yearCandidates && r.yearCandidates.length) ? r.yearCandidates : (det.bs ? det.bs.years : []); const latest = vals.slice().reverse().find((v) => v != null); const uf = CRETOP_UF[r.unit]; return { value: latest, unit: r.unit, eok: (!isRatio && latest != null && uf != null) ? Math.round(latest * uf * 100) / 100 : null, year: (years && years.length) ? years[years.length - 1] : (r.year || null), series: vals, years: years || [], isRatio: !!isRatio, rawLabel: r.rawLabel }; };
  // 재무비율 행을 원문에서 직접 스캔 — 한 줄에 여러 지표가 붙어도 분해, 업종평균/재무진단 섹션은 제외(조회기업 값만)
  const ratioScan = (() => {
    const ls = normalizeCretopPdfText(rawText).split(/\r?\n/).map((l) => l.trim());
    // '재무비율' 헤더 + 카테고리 헤더(성장성/수익성/안정성/활동성/생산성/재무구조/부채상환능력)를 모두 비율표 시작점으로(상세표는 카테고리별로만 나뉘어 있을 수 있음)
    const starts = []; for (let i = 0; i < ls.length; i++) { if ((/재무\s*비율/.test(ls[i]) || /^(?:성장성|수익성|안정성|활동성|생산성|재무구조|부채상환능력)/.test(ls[i])) && !/동종|업계|순위/.test(ls[i])) starts.push(i); }
    const map = {}; let hdrYears = []; let yearSource = "none";
    if (starts.length) {
      // 재무진단(업종평균·전년대비) 섹션 진입 시 중단 — 업종평균 값이 비율로 섞이지 않게
      const breakRe = /재무\s*진단|업종\s*평균|전년\s*대비|^재무상태표|^손익계산서|제조원가|이익잉여금처분|현금\s*흐름\s*분석|주요\s*주주|^거래처/;
      const skipRe = /동종\s*업계|업계\s*순위|COPYRIGHT|페이지|감사\s*의견|기업\s*개요|조회/;
      const isNum = (t) => /^-?[\d,]+(?:\.\d+)?$/.test(t); const isDash = (t) => t === "-" || t === "－"; const isTxt = (t) => /^(?:적자전환|흑자전환|적자지속|흑자지속)+$/.test(t);
      // char-spaced로 '성장성매출액증가율'처럼 구분+지표명이 한 토큰으로 붙어도, 문자열 접미사에서 알려진 지표명을 찾음
      const matchName = (buf) => { const joined = normalizeAccountLabel(buf.join("")); if (!joined) return null;
        if (CORE_RATIO[joined]) return CORE_RATIO[joined][0];   // 전체 일치 우선
        for (const cat of CRETOP_RATIO_CATS) { if (joined.length > cat.length && joined.startsWith(cat)) { const rest = joined.slice(cat.length); if (CORE_RATIO[rest]) return CORE_RATIO[rest][0]; } }   // 알려진 구분 접두어만 제거('성장성매출액증가율'→매출액증가율). 임의 접미 매칭 안 함
        return null; };
      const numCnt = (arr) => arr.filter((v) => typeof v === "number" || /전환|지속/.test(String(v))).length;
      // 모든 '재무비율' 섹션 순회(요약 2단표 + 상세 단일컬럼표 둘 다) — 값 개수 많은 것 우선 병합(유동비율/EBITDA·차입금 등 상세표에만 있는 지표 포함)
      for (const s of starts) {
        for (let i = s + 1; i < ls.length; i++) { const ln = ls[i]; if (!ln) continue; if (breakRe.test(ln)) break; if (skipRe.test(ln)) continue;
          if (!hdrYears.length) { const yl = cretopLineYears(ln); if (yl && yl.length >= 1) { hdrYears = yl.slice().sort((a, b) => a - b); yearSource = "ratioTable"; continue; }
            // 2단 헤더(예: '성장성 2022 2023 2024 수익성 2022 2023 2024') — 카테고리어가 섞여 일반 연도행 판별엔 실패하지만 연도는 추출
            if (/성장성|수익성|안정성|활동성|생산성|재무구조|부채상환/.test(ln)) { const ys = (ln.match(/(?:19|20)\d{2}/g) || []).map(Number); if (ys.length >= 2) { hdrYears = Array.from(new Set(ys)).sort((a, b) => a - b); yearSource = "ratioTable2col"; continue; } } }
          // 카테고리 헤더 행(성장성/수익성/안정성/활동성 + 연도만, 지표명 없음)은 지표로 파싱하지 않고 건너뜀
          { const stripped = ln.replace(/성장성|수익성|안정성|활동성|생산성|재무구조|부채상환능력/g, "").replace(/(?:19|20)\d{2}/g, "").replace(/[\s\-.,]/g, ""); if (!stripped && /(?:19|20)\d{2}/.test(ln)) continue; }
          const toks = ln.split(/\s+/).filter(Boolean); let nameBuf = []; let j = 0;
          while (j < toks.length) { const t = toks[j];
            if (isNum(t) || isDash(t) || t === "△" || t === "▽" || isTxt(t)) {
              const key = matchName(nameBuf); const vals = []; let neg = false;
              while (j < toks.length && (isNum(toks[j]) || isDash(toks[j]) || toks[j] === "△" || toks[j] === "▽" || isTxt(toks[j]))) { const tt = toks[j]; if (tt === "△" || tt === "▽") { neg = true; j++; continue; } if (isDash(tt)) { if (j + 1 < toks.length && isNum(toks[j + 1])) { neg = true; j++; continue; } vals.push(null); j++; continue; } if (isTxt(tt)) { (tt.match(/적자전환|흑자전환|적자지속|흑자지속/g) || []).forEach((x) => vals.push(x)); j++; continue; } let v = parseFloat(tt.replace(/,/g, "")); if (neg) v = -Math.abs(v); vals.push(v); neg = false; j++; }
              if (key) { const nums = vals.filter((v) => typeof v === "number" || /전환|지속/.test(String(v))); if (nums.length && (!map[key] || numCnt(nums) > numCnt(map[key]))) map[key] = nums; }
              nameBuf = [];
            } else { nameBuf.push(t); j++; }
          }
        }
      }
    }
    return { map, hdrYears, yearSource };
  })();
  const ratioRowSeries = ratioScan.map;
  // 재무 연도(BS/IS 표)와 비율 연도(재무비율 표) 분리 — 조회일시/설립/법인등기 등 비재무 연도는 ratioYears에 절대 넣지 않음
  const financialYears = (det.bs && det.bs.years && det.bs.years.length) ? det.bs.years.slice() : ((det.is && det.is.years && det.is.years.length) ? det.is.years.slice() : (core.detectedYears || []).slice().filter((y) => typeof y === "number").sort((a, b) => a - b));
  // ratioYears: 재무비율 표 헤더(단일연도도 허용) > 전체비율표(ft). 비재무 연도(조회일시/설립/연혁 등) 절대 금지.
  // 원문에서 설립/조회/연혁/법인등기/평가일자 연도를 수집 → ratioYears 오염 차단(효성 1999, 조회 2026 등)
  const nonFinancialYearSet = (() => { const set = new Set(); const t = normalizeCretopPdfText(rawText); const grab = (re) => { const rx = new RegExp(re, "g"); let x; while ((x = rx.exec(t))) { const y = +x[1]; if (y) set.add(y); } };
    grab("조회일시[^0-9]{0,6}((?:19|20)\\d{2})"); grab("조회일자[^0-9]{0,6}((?:19|20)\\d{2})"); grab("설립[^0-9]{0,8}((?:19|20)\\d{2})"); grab("연혁[^0-9]{0,10}((?:19|20)\\d{2})"); grab("법인\\s*설립[^0-9]{0,8}((?:19|20)\\d{2})"); grab("법인등기[^0-9]{0,18}((?:19|20)\\d{2})"); grab("기준일자[^0-9]{0,6}((?:19|20)\\d{2})"); grab("평가일자[^0-9]{0,6}((?:19|20)\\d{2})");
    return set; })();
  const finMin = financialYears.length ? Math.min(...financialYears) : null;
  const finMax = financialYears.length ? Math.max(...financialYears) : null;
  // 비율 연도로 부적격: 재무연도 창([min-1, max+1]) 밖 또는 설립/조회 등 비재무 연도(단, 실제 재무연도면 허용)
  const isForbiddenRatioYear = (y) => { if (typeof y !== "number") return true; if (financialYears.includes(y)) return false; if (finMin != null && (y < finMin - 1 || y > finMax + 1)) return true; if (nonFinancialYearSet.has(y)) return true; return false; };
  const rawRatioYears = (() => {
    if (ratioScan.hdrYears.length >= 1) return ratioScan.hdrYears.slice(-3);
    if (ft && ft.years && ft.years.length >= 2) return ft.years.slice(-3);
    return [];
  })();
  const forbiddenYearsDetectedInRatio = rawRatioYears.filter(isForbiddenRatioYear);
  const ratioYears = rawRatioYears.filter((y) => !isForbiddenRatioYear(y));
  const ratioYearSource = ratioScan.hdrYears.length ? ratioScan.yearSource : (ft && ft.years && ft.years.length >= 2 ? "fullRatioTable" : "none");
  const ratioYearConfidence = ratioScan.hdrYears.length >= 2 ? "high" : ratioScan.hdrYears.length === 1 ? "partial" : (ft && ft.years && ft.years.length >= 2 ? "high" : "yearUnknown");
  const fySet = new Set([...(financialYears || []), ...ratioYears]);
  // 비재무 연도(조회일시/설립/법인등기 등) — 디버그용. 재무·비율 연도가 아닌 것만.
  const ignoredYears = (() => { const set = new Set(); const t = normalizeCretopPdfText(rawText); const grab = (re) => { const rx = new RegExp(re, "g"); let x; while ((x = rx.exec(t))) { const y = +x[1]; if (y && !fySet.has(y)) set.add(y); } };
    grab("조회일시[^0-9]{0,6}((?:19|20)\\d{2})"); grab("설립[^0-9]{0,8}((?:19|20)\\d{2})"); grab("법인등기[^0-9]{0,18}((?:19|20)\\d{2})"); grab("조회일자[^0-9]{0,6}((?:19|20)\\d{2})");
    (core.detectedYears || []).forEach((y) => { if (typeof y === "number" && !fySet.has(y)) set.add(y); });
    return Array.from(set).sort((a, b) => a - b); })();
  const alignRatioYears = (series) => { if (!ratioYears.length || !series || !series.length) return []; if (series.length === ratioYears.length) return ratioYears.slice(); if (series.length < ratioYears.length) return ratioYears.slice(-series.length); return ratioYears.slice(-ratioYears.length); };
  const ratioUnitOf = (key) => { const nm = Object.keys(CORE_RATIO).find((n) => CORE_RATIO[n][0] === key); return (nm && CORE_RATIO[nm][1]) || "%"; };
  const ratioLatest = (key) => {
    const series = ratioRowSeries[key];
    if (series && series.length) { const use = ratioYears.length && series.length > ratioYears.length ? series.slice(-ratioYears.length) : series; const yrs = alignRatioYears(use); const lastNum = [...use].reverse().find((v) => typeof v === "number"); return { value: lastNum != null ? lastNum : use[use.length - 1], year: yrs.length ? yrs[yrs.length - 1] : null, series: use, years: yrs, isRatio: true, unit: ratioUnitOf(key), confidence: yrs.length ? ratioYearConfidence : "yearUnknown" }; }
    if (ft && ft.metrics[key]) { const m = ft.metrics[key]; const v = [...m.values].reverse().find((x) => typeof x === "number"); if (v != null) { const yrs = (m.years && m.years.length === m.values.length) ? m.years : alignRatioYears(m.values); return { value: v, year: yrs.length ? yrs[yrs.length - 1] : null, series: m.values, years: yrs, isRatio: true, unit: ratioUnitOf(key), confidence: ratioYearConfidence }; } }
    return null;   // 후보행(업종평균·조회일시 2025 혼입 가능) 미사용 — 비율은 재무비율 표/전체표에서만
  };
  // 요약 손익계산서 행을 원문에서 직접 스캔 — 후보 절단(값 개수>연도 시 slice)·연도 미검출로 2023이 누락되는 문제 우회
  const summaryISseries = (() => {
    const ls = normalizeCretopPdfText(rawText).split(/\r?\n/).map((l) => l.trim());
    const map = {}; let inSec = false, curUnit = "백만원", curYears = [];
    for (let i = 0; i < ls.length; i++) {
      const ln = ls[i]; if (!ln) continue;
      if (/손익\s*계산서/.test(ln)) { inSec = true; const um = ln.match(/단위\s*[:：]?\s*(백만원|천원|억원|원)/); curUnit = um ? um[1] : "백만원"; curYears = []; continue; }
      if (/재무상태표|재무\s*비율|현금\s*흐름|제조원가|이익잉여금처분|기업\s*개요|COPYRIGHT|페이지/.test(ln)) { inSec = false; continue; }
      if (!inSec) continue;
      const yl = cretopLineYears(ln); if (yl && yl.length >= 2) { curYears = yl.slice().sort((a, b) => a - b); continue; }
      const um2 = ln.match(/단위\s*[:：]?\s*(백만원|천원|억원|원)/); if (um2) { curUnit = um2[1]; continue; }
      const segs = cretopSplitLineMetrics(ln, CORE_ACCT, CORE_RATIO);
      for (const seg of segs) { if (seg.isRatio || !seg.values.length) continue; if (!map[seg.key] || seg.values.length > map[seg.key].values.length) map[seg.key] = { values: seg.values.slice(), unit: curUnit, years: curYears.slice() }; }
    }
    return map;
  })();
  const SUMMARY_IS_KEYS = new Set(["revenue", "operatingProfit", "netIncome"]);
  const IS_NAMES = { revenue: ["매출액", "매출"], operatingProfit: ["영업이익"], netIncome: ["당기순이익", "순이익"] };
  // 상세 손익계산서 행 찾기('* 당기순이익'처럼 머리 '*'·'(순손실)' 접미 포함도 parseCretopDetailRow가 정규화) — 콤마로 3개년이 안정적
  const isRowFor = (names) => { const g = det.is; if (!g) return null; for (const nm of names) { const c = (g.items || []).filter((it) => (it.rawLabel || "").replace(/\([^)]*\)/g, "") === nm || it.rawLabel === nm); if (c.length) { const agg = c.find((x) => /\(\s*\*?\s*\)/.test(x.rawLabel || "")); return agg || c.slice().sort((a, b) => (b.numberCandidates || []).filter((v) => typeof v === "number").length - (a.numberCandidates || []).filter((v) => typeof v === "number").length)[0]; } } return null; };
  const numCntR = (r) => r ? (r.numberCandidates || []).filter((v) => typeof v === "number").length : 0;
  const amtPrimary = (key) => {
    const cands = [];
    if (SUMMARY_IS_KEYS.has(key)) { const sm = summaryISseries[key]; if (sm && sm.values.length) cands.push({ numberCandidates: sm.values, yearCandidates: (sm.years.length === sm.values.length) ? sm.years : [], unit: sm.unit, rawLabel: CORE_LABELS[key] || key }); const ir = isRowFor(IS_NAMES[key] || []); if (ir) cands.push(ir); }
    const gp = groups.primary[key]; if (gp) cands.push(gp);
    if (!cands.length) return null;
    // 숫자 값 개수(=연도 수) 최다 소스 우선 — 콤마 없는 요약이 '136 123 92'를 한 숫자로 뭉칠 때 콤마 있는 상세 손익으로 3개년 복원
    cands.sort((a, b) => numCntR(b) - numCntR(a));
    return fromRow(cands[0], false);
  };
  // 비율 계산도 '미리보기 금액과 동일한 출처'에서 — 금액 카드가 맞으면(부채총계 21.79억 등) 비율도 맞음.
  // amtPrimary 결과 {series, unit, years}를 백만원으로 정규화(상세 BS 섹션 로컬 행이 단위 오라벨일 때 61,601% 튀던 문제 차단)
  const amtSeriesD = (key) => { const a = amtPrimary(key); const out = { map: {}, prov: {} }; if (!a || !a.series || !a.series.length) return out; const yrs = a.years || []; a.series.forEach((v, i) => { const y = yrs[i]; if (y != null && typeof v === "number") { const mm = toMillionWon(v, a.unit); if (mm != null) { out.map[y] = mm; out.prov[y] = { label: CORE_LABELS[key] || key, value: v, unit: a.unit }; } } }); return out; };
  // ── 미리보기/추이 비율은 '재무비율 표(보고서값)'가 아니라 '최신 재무제표 연도' 기준으로 직접 계산 ──
  // (재무비율 표는 단일/과거 연도일 수 있어 5개 영역에만 사용. 미리보기·추이는 재무제표 BS/IS에서 연도별로 산출)
  const bsYears = (det.bs && det.bs.years && det.bs.years.length) ? det.bs.years.slice() : [];
  const isYears = (det.is && det.is.years && det.is.years.length) ? det.is.years.slice() : [];
  const isRow = (names) => { const g = det.is; if (!g) return null; for (const nm of names) { const cands = g.items.filter((it) => (it.rawLabel || "").replace(/\([^)]*\)/g, "") === nm || it.rawLabel === nm); if (!cands.length) continue; const agg = cands.find((c) => /\(\s*\*?\s*\)/.test(c.rawLabel || "")); if (agg) return agg; if (cands.length === 1) return cands[0]; return cands.slice().sort((a, b) => Math.max(...(b.numberCandidates || []).map((v) => Math.abs(v || 0))) - Math.max(...(a.numberCandidates || []).map((v) => Math.abs(v || 0))))[0]; } return null; };
  // 행 → { map:{연도:백만원 환산값}, prov:{연도:{label,value,unit}} } — 단위 혼합 차단(모든 값을 백만원으로 정규화 후 비율 계산)
  const rowSeriesD = (r, grpYears) => { const out = { map: {}, prov: {} }; if (!r) return out; const unit = r.unit; let vals = (r.numberCandidates || []).slice(); let yrs = (r.yearCandidates && r.yearCandidates.length) ? r.yearCandidates.slice() : (grpYears || []).slice(); if (!yrs.length) return out; if (vals.length !== yrs.length) { if (vals.length > yrs.length) vals = vals.slice(vals.length - yrs.length); else yrs = yrs.slice(yrs.length - vals.length); } yrs.forEach((y, i) => { const v = vals[i]; if (typeof v === "number") { const mm = toMillionWon(v, unit); if (mm != null) { out.map[y] = mm; out.prov[y] = { label: r.rawLabel || r.account || "", value: v, unit }; } } }); return out; };
  const mergeD = (a, b) => ({ map: Object.assign({}, a.map, b.map), prov: Object.assign({}, a.prov, b.prov) });   // b(상세) 우선
  const addD = (a, b) => { const map = {}; new Set([...Object.keys(a.map), ...Object.keys(b.map)]).forEach((k) => { const av = a.map[+k], bv = b.map[+k]; if (typeof av === "number" || typeof bv === "number") map[+k] = (typeof av === "number" ? av : 0) + (typeof bv === "number" ? bv : 0); }); return { map, prov: Object.assign({}, a.prov, b.prov) }; };
  // BS 계정 시계열 — 상세 BS 행(집계행 우선) + 후보행 보강(둘 다 백만원으로 정규화 후 병합 → 천원/백만원 혼합 방지)
  const numericBsRows = (names) => { const g = det.bs; if (!g) return []; return (g.items || []).filter((it) => { const norm = (it.rawLabel || "").replace(/\([^)]*\)/g, ""); return (names.includes(norm) || names.includes(it.rawLabel)) && (it.numberCandidates || []).some((v) => typeof v === "number"); }); };
  const bestBsRow = (names) => { const rws = numericBsRows(names); if (!rws.length) return null; const agg = rws.find((c) => /\(\s*\*?\s*\)/.test(c.rawLabel || "")); return agg || rws.slice().sort((a, b) => ((b.numberCandidates || []).filter((v) => typeof v === "number").length - (a.numberCandidates || []).filter((v) => typeof v === "number").length) || (Math.max(...(b.numberCandidates || []).map((v) => Math.abs(v || 0))) - Math.max(...(a.numberCandidates || []).map((v) => Math.abs(v || 0)))))[0]; };
  const candSeriesD = (coreKey) => { if (!coreKey) return { map: {}, prov: {} }; const r = groups.primary[coreKey]; const yrs = (r && r.yearCandidates && r.yearCandidates.length) ? r.yearCandidates : bsYears; return rowSeriesD(r, yrs); };
  const bsSeriesD = (names, coreKey) => mergeD(candSeriesD(coreKey), rowSeriesD(bestBsRow(names), bsYears));
  // 비율의 분자/분모를 '같은 출처'에서 가져와 단위 혼합을 원천 차단(상세 BS 둘 다 → 상세, 아니면 후보 둘 다 → 후보, 그래도 안되면 혼합 fallback)
  const cy = (r) => (r && r.yearCandidates && r.yearCandidates.length) ? r.yearCandidates : bsYears;
  const bsPairD = (numNames, numKey, denNames, denKey) => {
    const numDet = bestBsRow(numNames), denDet = bestBsRow(denNames);
    if (numDet && denDet) return { num: rowSeriesD(numDet, bsYears), den: rowSeriesD(denDet, bsYears), mixed: false };
    const numCand = numKey ? groups.primary[numKey] : null, denCand = denKey ? groups.primary[denKey] : null;
    if (numCand && denCand) return { num: rowSeriesD(numCand, cy(numCand)), den: rowSeriesD(denCand, cy(denCand)), mixed: false };
    return { num: bsSeriesD(numNames, numKey), den: bsSeriesD(denNames, denKey), mixed: true };
  };
  // 손익 계정 시계열 — 상세 손익계산서 행(섹션 단위 정확) 우선, 없으면 요약 손익 스캔(단위:없으면 백만원 추정될 수 있어 후순위). 각자 단위로 백만원 정규화
  const isSeriesD = (key, names) => { const d = rowSeriesD(isRow(names), isYears); if (Object.keys(d.map).length) return d; const sm = summaryISseries[key]; if (sm && sm.values.length && sm.years.length === sm.values.length) { const out = { map: {}, prov: {} }; sm.years.forEach((y, i) => { if (typeof sm.values[i] === "number") { const mm = toMillionWon(sm.values[i], sm.unit); if (mm != null) { out.map[y] = mm; out.prov[y] = { label: CORE_LABELS[key] || key, value: sm.values[i], unit: sm.unit }; } } }); return out; } return d; };
  const opD = isSeriesD("operatingProfit", ["영업이익"]);
  const revD = isSeriesD("revenue", ["매출액", "매출"]);
  const niD = isSeriesD("netIncome", ["당기순이익", "순이익"]);
  const interestD = rowSeriesD(isRow(["이자비용"]), isYears);   // 이자비용 미검출 시 비움 → 이자보상배수 '원문 확인 필요'(영업외비용을 이자비용으로 가정하지 않음)
  const computedRatioYears = financialYears.slice();
  const unitMixWarnings = [];
  const hasMap = (d) => d && Object.keys(d.map).length > 0;
  // 금액 출처(amtSeriesD) 우선 — 분자·분모가 같은 '미리보기 금액 출처'라 단위 일관 보장. 둘 다 있을 때만 사용, 아니면 BS행 fallback
  const amtPair = (numKey, denKey, fallback) => { const num = amtSeriesD(numKey), den = amtSeriesD(denKey); if (hasMap(num) && hasMap(den)) return { num, den, mixed: false }; return fallback(); };
  const COMPUTED_RATIO_DEFS = {
    debtRatio: { unit: "%", formula: "부채총계 / 자본총계 × 100", factor: 100, pair: () => amtPair("totalLiabilities", "totalEquity", () => bsPairD(["부채총계", "부채", "총부채"], "totalLiabilities", ["자본총계", "자본", "자기자본"], "totalEquity")) },
    currentRatio: { unit: "%", formula: "유동자산 / 유동부채 × 100", factor: 100, pair: () => bsPairD(["유동자산"], null, ["유동부채"], null) },
    interestCoverageRatio: { unit: "배", formula: "영업이익 / 이자비용", factor: 1, pair: () => ({ num: opD, den: interestD, mixed: false }) },
    debtDependency: { unit: "%", formula: "(단기차입금 + 장기차입금) / 자산총계 × 100", factor: 100, pair: () => { const den = hasMap(amtSeriesD("totalAssets")) ? amtSeriesD("totalAssets") : bsSeriesD(["자산총계", "자산", "총자산"], "totalAssets"); const stb = hasMap(amtSeriesD("shortTermBorrowings")) ? amtSeriesD("shortTermBorrowings") : bsSeriesD(["단기차입금"], "shortTermBorrowings"); const ltb = hasMap(amtSeriesD("longTermBorrowings")) ? amtSeriesD("longTermBorrowings") : bsSeriesD(["장기차입금"], "longTermBorrowings"); return { num: addD(stb, ltb), den, mixed: false }; } },
    netIncomeMargin: { unit: "%", formula: "당기순이익 / 매출액 × 100", factor: 100, computedOnly: true, pair: () => amtPair("netIncome", "revenue", () => ({ num: niD, den: revD, mixed: false })) },   // 매출액 대비 순이익률(ROA와 혼동 금지)
  };
  const SANITY_MAX = { debtRatio: 1000, netIncomeMargin: 1000 };   // 이 값을 넘으면 단위 혼합 의심
  const computeRatio = (key) => {
    const def = COMPUTED_RATIO_DEFS[key]; if (!def) return null;
    const P = def.pair(); const numMap = P.num.map, denMap = P.den.map;   // 분자·분모 같은 출처/같은 단위(백만원 정규화) → 단위 혼합 없음
    const ys = computedRatioYears.filter((y) => typeof numMap[y] === "number" && typeof denMap[y] === "number" && denMap[y] !== 0);
    if (!ys.length) return null;
    const values = ys.map((y) => Math.round((numMap[y] / denMap[y]) * def.factor * 100) / 100);
    const lastY = ys[ys.length - 1];
    const capitalErosion = key === "debtRatio" && typeof denMap[lastY] === "number" && denMap[lastY] < 0;   // 자본총계 음수 → 자본잠식 위험
    const res = { value: values[values.length - 1], year: lastY, series: values, years: ys, isRatio: true, unit: def.unit, source: "computedFromFinancialStatements", formula: def.formula, confidence: "computed", capitalErosion, _numProv: P.num.prov[lastY] || null, _denProv: P.den.prov[lastY] || null };
    // 방어: 부채비율/당기순이익률이 비정상적으로 큼(>1000) → 단위 혼합 의심. 혼합 출처면 폐기(원문 확인 필요), 일관 출처면 경고만 남기고 표시
    const lim = SANITY_MAX[key];
    if (lim != null && !capitalErosion && Math.abs(res.value) > lim) { unitMixWarnings.push(`${key}=${res.value}${def.unit} > ${lim}(${P.mixed ? "혼합출처·폐기" : "일관출처·표시"})`); if (P.mixed) return null; }
    return res;
  };
  const reportRatioYears = ratioYears.slice();   // 재무비율 표(보고서값) 연도 — 5개 영역 전용
  const latestFinYear = financialYears.length ? financialYears[financialYears.length - 1] : null;
  const reportLatestYear = reportRatioYears.length ? reportRatioYears[reportRatioYears.length - 1] : null;
  const corePreviewRatioSource = {};
  // 미리보기 비율: ① 재무제표 직접 계산(최신연도) → ② 보조: 재무비율 표(단, 표 최신연도 == 재무제표 최신연도일 때만) → ③ 원문 확인 필요
  const previewRatio = (key) => {
    const comp = computeRatio(key);
    if (comp && typeof comp.value === "number") { corePreviewRatioSource[key] = "computedFromFinancialStatements"; return comp; }
    const def = COMPUTED_RATIO_DEFS[key] || {};
    if (!def.computedOnly && reportLatestYear != null && latestFinYear != null && reportLatestYear === latestFinYear) { const rl = ratioLatest(key); if (rl && typeof rl.value === "number") { corePreviewRatioSource[key] = "reportRatioTable"; return Object.assign({}, rl, { source: "reportRatioTable", formula: def.formula || null }); } }
    corePreviewRatioSource[key] = "unavailable"; return null;   // null → 카드에 '원문 확인 필요'
  };
  const corePreview = {
    revenue: amtPrimary("revenue"), operatingProfit: amtPrimary("operatingProfit"), netIncome: amtPrimary("netIncome"),
    netIncomeMargin: previewRatio("netIncomeMargin"),
    totalAssets: amtPrimary("totalAssets"), totalLiabilities: amtPrimary("totalLiabilities"), totalEquity: amtPrimary("totalEquity"),
    cash: fromRow(bsRow(["현금및현금성자산"]), false) || amtPrimary("cash"),
    // 차입금 계정이 원문에 아예 없으면 '원문 확인 필요'가 아니라 0원(미보유)으로 — 추이도 3개년 모두 0원
    shortTermBorrowings: fromRow(bsRow(["단기차입금"]), false) || amtPrimary("shortTermBorrowings") || { value: 0, unit: "백만원", eok: 0, year: (financialYears.length ? financialYears[financialYears.length - 1] : null), series: financialYears.map(() => 0), years: financialYears.slice(), absent: true },
    longTermBorrowings: fromRow(bsRow(["장기차입금"]), false) || amtPrimary("longTermBorrowings") || { value: 0, unit: "백만원", eok: 0, year: (financialYears.length ? financialYears[financialYears.length - 1] : null), series: financialYears.map(() => 0), years: financialYears.slice(), absent: true },
    retainedEarnings: fromRow(bsRow(["미처분이익잉여금"]), false) || amtPrimary("retainedEarnings"),
    debtRatio: previewRatio("debtRatio"), currentRatio: previewRatio("currentRatio"), interestCoverageRatio: previewRatio("interestCoverageRatio"), debtDependency: previewRatio("debtDependency"),
    creditGrade: companyInfo.creditGrade ? { value: companyInfo.creditGrade } : null, cashflowGrade: companyInfo.cashflowGrade,
  };
  // 3개년 핵심 추이(금액=억원, 비율=원값) — corePreview 소스 재사용
  const trendDefs = [["revenue", false], ["operatingProfit", false], ["netIncome", false], ["totalAssets", false], ["totalLiabilities", false], ["totalEquity", false], ["cash", false], ["shortTermBorrowings", false], ["longTermBorrowings", false], ["retainedEarnings", false], ["debtRatio", true], ["currentRatio", true], ["interestCoverageRatio", true]];
  const trendRows = trendDefs.map(([key, isR]) => { const src = corePreview[key]; if (!src || !src.series || !src.series.length) return { key, label: CORE_LABELS[key] || key, isRatio: isR, missing: true }; const synth = { isRatio: isR, numberCandidates: src.series, yearCandidates: src.years, unit: isR ? (src.unit || "%") : (src.unit || "천원"), isGrade: false }; const t = cretopRowTrend(synth); return { key, label: CORE_LABELS[key] || key, isRatio: isR, trend: t, cashflowGrade: null }; }).filter(Boolean);
  // cashflowGrade를 추이에 등급 형태로 추가
  if (companyInfo.cashflowGrade && companyInfo.cashflowGrade.series) trendRows.push({ key: "cashflowGrade", label: "현금흐름등급", isGrade: true, gradeSeries: companyInfo.cashflowGrade.series, years: companyInfo.cashflowGrade.years });
  // 금액 시계열 → 전년 대비 증가율(적자전환/흑자전환 포함). 보고서에 없는 영업이익증가율을 영업이익 시계열에서 계산
  const computeGrowthSeries = (amtObj) => { if (!amtObj || !amtObj.series || amtObj.series.length < 2) return null; const ser = amtObj.series, yrs = amtObj.years || []; const out = [{ year: yrs[0] != null ? yrs[0] : null, val: (typeof ser[0] === "number" && ser[0] < 0) ? "적자전환" : null }]; for (let i = 1; i < ser.length; i++) { const prev = ser[i - 1], cur = ser[i], yr = yrs[i] != null ? yrs[i] : null; if (typeof prev !== "number" || typeof cur !== "number") { out.push({ year: yr, val: null }); continue; } let val; if (prev < 0 && cur >= 0) val = "흑자전환"; else if (prev >= 0 && cur < 0) val = "적자전환"; else if (prev < 0 && cur < 0) val = "적자지속"; else val = prev !== 0 ? Math.round((cur - prev) / Math.abs(prev) * 100 * 100) / 100 : null; out.push({ year: yr, val }); } return out.some((p) => p.val != null) ? out : null; };   // 첫 연도(직전 데이터 없음): 해당 연도가 적자면 '적자전환', 흑자면 빈 슬롯 — 3개년 프레임 유지
  // 재무비율 5개 영역 — 영업이익증가율(opGrowth)만 텍스트형(적자전환/흑자전환) 허용, 나머지는 숫자형
  const ratioAreas = CRETOP_RATIO_AREAS.map((a) => {
    const metrics = a.metrics.map((k) => { const r = ratioLatest(k); const hasVals = r && r.series && r.series.some((v) => typeof v === "number" || /전환|지속/.test(String(v)));
      // 영업이익증가율: 보고서 재무비율 표에 없으면 영업이익 시계열에서 계산(흑자전환/적자전환/증감률)
      if (!hasVals && k === "opGrowth") { const og = computeGrowthSeries(corePreview.operatingProfit); if (og && og.length) { const synth = { isRatio: true, numberCandidates: og.map((p) => p.val), textValues: og.some((p) => typeof p.val !== "number") ? og.map((p) => p.val) : null, yearCandidates: og.map((p) => p.year), unit: "%" }; return { key: k, label: CORE_LABELS[k] || k, trend: cretopRowTrend(synth), unit: "%", rawLabel: null, source: "computedFromFinancialStatements" }; } }
      // 자기자본회전율: 보고서에 없으면 매출액/자본총계로 계산(같은 금액 출처 → 단위 일관)
      if (!hasVals && k === "equityTurnover") { const rv = amtSeriesD("revenue"), eq = amtSeriesD("totalEquity"); const ys = financialYears.filter((y) => typeof rv.map[y] === "number" && typeof eq.map[y] === "number" && eq.map[y] !== 0); if (ys.length) { const vals = ys.map((y) => Math.round((rv.map[y] / eq.map[y]) * 100) / 100); const synth = { isRatio: true, numberCandidates: vals, yearCandidates: ys, unit: "회" }; return { key: k, label: CORE_LABELS[k] || k, trend: cretopRowTrend(synth), unit: "회", rawLabel: null, source: "computedFromFinancialStatements" }; } }
      if (!hasVals) return { key: k, label: CORE_LABELS[k] || k, missing: true, source: "reportRatioTable" }; const hasText = r.series.some((v) => v != null && typeof v !== "number"); const synth = { isRatio: true, numberCandidates: r.series, textValues: hasText ? r.series : null, yearCandidates: r.years, unit: r.unit }; return { key: k, label: CORE_LABELS[k] || k, trend: cretopRowTrend(synth), unit: r.unit, rawLabel: r.rawLabel, source: "reportRatioTable" }; });
    const usable = metrics.filter((m) => !m.missing);
    const cap = a.key === "activity" ? 4 : 3;   // 활동성은 매출채권·총자본·자기자본·재고자산 회전율 4종 허용
    return { key: a.key, name: a.name, hint: a.hint, metrics: usable.length ? usable.slice(0, cap) : metrics.slice(0, cap) };
  });
  // 재무상태표 순서 검증(디버그) — lineIndex 오름차순/중복 보존/누락 후보 점검
  const balanceSheetOrderDebug = (() => {
    const bsItems = (detailStatements.balanceSheet && detailStatements.balanceSheet.items) || [];
    const lineIndexes = bsItems.map((it) => it.lineIndex).filter((n) => typeof n === "number");
    const isSortedByLineIndex = lineIndexes.every((v, i, a) => i === 0 || a[i - 1] <= v);
    const labelCounts = {}; bsItems.forEach((it) => { labelCounts[it.rawLabel] = (labelCounts[it.rawLabel] || 0) + 1; });
    const duplicatedAccountsKept = Object.keys(labelCounts).some((k) => labelCounts[k] > 1);
    const sectionStartLine = detailStatements.balanceSheet.secStart != null ? detailStatements.balanceSheet.secStart : (lineIndexes.length ? Math.min(...lineIndexes) : null);
    const sectionEndLine = detailStatements.balanceSheet.secEnd != null ? detailStatements.balanceSheet.secEnd : (lineIndexes.length ? Math.max(...lineIndexes) : null);
    // 누락 후보: 섹션 범위 내, 계정명+숫자가 있는데 items에 없는 원문 라인
    const dlines = (core.debug && core.debug.lines) || []; const itemLi = new Set(lineIndexes); const skippedBalanceSheetRows = [];
    if (sectionStartLine != null && sectionEndLine != null) dlines.forEach((l) => { const li = l.li; if (li > sectionStartLine && li < sectionEndLine && !itemLi.has(li)) { const t = (l.ntext || l.text || ""); if (/[가-힣]/.test(t) && /\d/.test(t) && !CRETOP_DETAIL_NONFIN.test(t) && !cretopLineYears(t)) skippedBalanceSheetRows.push((`L${li}: ${t}`).slice(0, 80)); } });
    return { source: detailStatements.balanceSheet.source || null, unit: detailStatements.balanceSheet.unit || null, sectionName: detailStatements.balanceSheet.sectionName || null, sectionStartLine, sectionEndLine, itemCount: bsItems.length, lineIndexes, isSortedByLineIndex, duplicatedAccountsKept, firstAccounts: bsItems.slice(0, 5).map((it) => it.rawLabel), skippedBalanceSheetRows: skippedBalanceSheetRows.slice(0, 20) };
  })();
  // 단위 검증 디버그 — 분자/분모의 라벨·원값·단위·백만원 환산값을 남겨 단위 혼합 여부를 즉시 확인
  const provBlock = (mObj) => (mObj && mObj._numProv && mObj._denProv) ? { source: mObj.source, numerator: { label: mObj._numProv.label, value: mObj._numProv.value, unit: mObj._numProv.unit, normalizedMillion: Math.round(toMillionWon(mObj._numProv.value, mObj._numProv.unit) * 1000) / 1000 }, denominator: { label: mObj._denProv.label, value: mObj._denProv.value, unit: mObj._denProv.unit, normalizedMillion: Math.round(toMillionWon(mObj._denProv.value, mObj._denProv.unit) * 1000) / 1000 }, result: mObj.value } : null;
  const unitDebug = { corePreviewDebtRatio: provBlock(corePreview.debtRatio), netIncomeMargin: provBlock(corePreview.netIncomeMargin), currentRatio: provBlock(corePreview.currentRatio), interestCoverageRatio: provBlock(corePreview.interestCoverageRatio) };
  // 회귀 방지 점검용 — 연도 오염·단위 혼합·source 역할을 한 곳에서 확인
  const companyType = (() => { const fy = financialYears; if (!fy.length) return "unknown"; const mx = Math.max(...fy); if (fy.includes(2018) && fy.includes(2021)) return "ene-like"; if (mx === 2024 && fy.includes(2022)) return "hyosung-like"; if (mx === 2025 && fy.includes(2023)) return "sebang-like"; return "unknown"; })();
  const trendRowSource = {}; (trendRows || []).forEach((t) => { if (t.isGrade) return; trendRowSource[t.key] = t.isRatio ? "computedFromFinancialStatements" : ((corePreview[t.key] && corePreview[t.key].source) || "summaryFinancial"); });
  const regressionGuard = { companyType, financialYears, ratioYears, forbiddenYearsDetectedInRatio, unitMixWarnings, corePreviewRatioSource, trendRowSource, ratioAreaSource: "reportRatioTable", balanceSheetSource: detailStatements.balanceSheet.source || null };
  return { companyInfo, certInfo, ipInfo, corePreview, trendRows, ratioAreas, ratioYears, reportRatioYears, computedRatioYears, financialYears, ignoredYears, forbiddenYearsDetectedInRatio, ratioYearSource, ratioYearConfidence, corePreviewRatioSource, ratioAreasSource: "reportRatioTable", detailStatements, balanceSheetOrderDebug, unitDebug, regressionGuard, _meta: { source: "buildCretopParsedForUi", rows: core.rows.length, hasFullRatioTable: !!ft, financialYears, ratioYears, reportRatioYears, computedRatioYears, ignoredYears, ratioYearSource, ratioYearConfidence, corePreviewRatioSource, ratioAreasSource: "reportRatioTable", balanceSheetOrderDebug, unitDebug, regressionGuard } };
}
// 현금흐름등급(CR1~CR6 등) 해석 — 비단정 톤
function cretopCashflowGradeInfo(grade) {
  const n = parseInt(String(grade || "").replace(/\D/g, ""), 10);
  if (isNaN(n)) return { level: "확인 필요", color: "#64748B", text: "현금흐름등급을 원문 기준으로 확인이 필요합니다." };
  if (n <= 2) return { level: "현금흐름 양호", color: "#2563EB", text: "현금흐름은 비교적 양호한 편으로 보이나 원문 기준 확인이 필요합니다." };
  if (n <= 4) return { level: "무난하나 확인 필요", color: "#16A34A", text: "현금흐름은 무난한 구간으로 볼 수 있으나 납입 여력은 추가 확인이 필요합니다." };
  return { level: "현금흐름 주의", color: "#DC2626", text: "현금흐름 주의 구간입니다. 보험료 납입 유지, 운전자금, 매출채권 회수기간을 반드시 확인하세요." };
}
// 1차 미팅 추가 제안 포인트 선택 목록(카테고리별) — 대표자 관심 포인트/검토 포인트/핵심 질문/관련 혜택·자료. 비단정 톤.
// 필드: p=대표자 관심 포인트, r=검토 포인트, q=핵심 질문, d=관련 혜택/자료
function cretopCoreDebug(core, points, fileName) {
  const dbg = core.debug; const rows = core.rows || []; const lines = (dbg && dbg.lines) || [];
  const numLines = lines.filter((l) => l.hasNum).slice(0, 100).map((l) => `L${l.li}: ${l.text}`);
  const acctLines = lines.filter((l) => l.hasAcct).slice(0, 100).map((l) => `L${l.li}: ${l.text}`);
  const cnt = (st) => rows.filter((r) => r.status === st).length;
  const L = ["[크레탑 핵심지표 실패 분석용 디버그]", "※ 원문 일부가 포함됩니다. 외부 공유 전 민감정보(기업명·사업자번호 등)를 확인하세요.", "",
    `· 파일명: ${fileName || "(직접 붙여넣기/미상)"}`, `· rawText 글자 수: ${dbg ? dbg.chars : 0} · 라인 수: ${dbg ? dbg.lineCount : 0}`,
    `· 감지 지표 후보 수: ${rows.length} · 적용 후보: ${cnt("적용 후보")} · 오류 의심: ${cnt("오류 의심")} · 제외: ${cnt("제외")}`,
    `· 감지 연도: ${((dbg && dbg.detectedYears) || []).join(", ") || "(없음)"} · 단위: ${((dbg && dbg.detectedUnits) || []).join(", ") || "(없음)"}`,
    `· 기업명: ${core.company.companyName || "-"} · 사업자번호: ${core.company.businessNo || "-"} · 업종: ${core.company.industry || "-"} · 직원: ${core.company.employees || "-"}`, "",
    "[추출 결과 JSON]", JSON.stringify(rows.map((r) => ({ 지표: r.account, 값: r.rawValue, 단위: r.unit, 억원: r.isGrade ? "-" : extractEokText(r), 연도: r.year, 상태: r.status, 라인: r.lineIndex })), null, 1), "",
    "[미팅 포인트 JSON]", JSON.stringify(points || {}, null, 1), "",
    "[숫자 포함 라인 상위 100]", numLines.join("\n") || "(없음)", "", "[지표명 후보 라인 상위 100]", acctLines.join("\n") || "(없음)", "",
    "[rawText 첫 5000자]", ((dbg && dbg.rawText) || "").slice(0, 5000)];
  return L.join("\n");
}
const CRETOP_CORE_SAMPLE = "기업명 샘플정밀(주)\n대표자 김샘플\n사업자번호 000-00-00000\n업종 제조업\n종업원 수 12명\n기업신용등급 BB+\n현금흐름등급 CF3\n\n요약 손익계산서 단위:백만원\n구분 2021 2022 2023\n매출액 1,250 1,860 2,430\n매출원가 850 1,250 1,620\n판매비와관리비 320 470 600\n영업이익 80 140 210\n당기순이익 55 100 160\n\n요약 재무상태표 단위:백만원\n구분 2021 2022 2023\n자산총계 900 1,150 1,420\n부채총계 520 610 720\n자본총계 380 540 700\n현금및현금성자산 80 95 120\n미처분이익잉여금 320 410 520\n단기차입금 100 80 50\n장기차입금 200 180 150\n\n재무비율\n구분 2021 2022 2023\n부채비율 136.8 113.0 102.9\n유동비율 145.2 168.4 191.7\n이자보상배수 8.5 12.3 18.6\n영업이익률 6.4 7.5 8.6\n순이익률 4.4 5.4 6.6";
function cretopDebugJson(dbg, rows) {
  if (!dbg) return "{}";
  const obj = { rawTextHead: (dbg.rawText || "").slice(0, 3000), chars: dbg.chars, rawLineCount: dbg.rawLineCount, lineCount: dbg.lineCount, numberLineCount: dbg.numberLineCount, acctLineCount: dbg.acctLineCount, detectedSections: dbg.detectedSections, detectedYears: dbg.detectedYears, detectedUnits: dbg.detectedUnits, companyName: dbg.companyName, businessNo: dbg.businessNo, lines: (dbg.lines || []).map((l) => l.text), accountCandidateLines: (dbg.lines || []).filter((l) => l.hasAcct).map((l) => ({ li: l.li, text: l.text, section: l.section })), numberCandidateLines: (dbg.lines || []).filter((l) => l.hasNum).map((l) => ({ li: l.li, text: l.text })), parserResult: (rows || []).map((r) => ({ account: r.account, year: r.year, rawValue: r.rawValue, unit: r.unit, eok: extractRowEok(r), section: r.section, status: r.status, line: r.lineIndex, candidates: r.numberCandidates })) };
  try { return JSON.stringify(obj, null, 2); } catch (e) { return "{}"; }
}
function buildCretopFinalCoreMetrics(rawText) {
  const lines = String(rawText || "").split(/\r?\n/).map((l) => l.replace(/[ \t　]+/g, " ").trim()).filter(Boolean);
  const secOf = (l) => {
    if (/업계\s*순위|동종\s*업계|동업종|업종\s*평균|거래처\s*현황|매입처|매출처|사업장\s*현황|주주\s*현황|임원\s*현황|연혁|사업\s*목적|상품\s*정보|특허\s*현황|인증\s*현황|소송|담보\s*현황|채권추심|채권보전|부실채권|등기\s*현황|구성비|매출액\s*분포/.test(l)) return { name: "기타정보(제외)", unit: null, prio: -1, amountOk: false, ratioOk: false };
    if (/MY\s*재무/i.test(l)) return { name: "MY 재무 Data", unit: "백만원", prio: 1, amountOk: true, ratioOk: false };
    if (/요약\s*재무상태표/.test(l)) return { name: "요약 재무상태표", unit: "백만원", prio: 2, amountOk: true, ratioOk: false };
    if (/요약\s*손익계산서/.test(l)) return { name: "요약 손익계산서", unit: "백만원", prio: 2, amountOk: true, ratioOk: false };
    if (/재무비율|재무진단|재무구조|부채상환|성장성|수익성|활동성|안정성/.test(l)) return { name: "재무비율", unit: "%", prio: 0, amountOk: false, ratioOk: true };
    if (/재무상태표/.test(l)) return { name: "재무상태표", unit: "천원", prio: 3, amountOk: true, ratioOk: false };
    if (/손익계산서/.test(l)) return { name: "손익계산서", unit: "천원", prio: 3, amountOk: true, ratioOk: false };
    return null;
  };
  const blocks = []; let cur = { name: "", unit: null, prio: 1, lines: [], amountOk: true, ratioOk: true };
  for (const l of lines) { const s = secOf(l); if (s) { if (cur.lines.length) blocks.push(cur); cur = { name: s.name, unit: s.unit, prio: s.prio, lines: [], amountOk: s.amountOk, ratioOk: s.ratioOk }; } cur.lines.push(l); }
  if (cur.lines.length) blocks.push(cur);
  const metrics = {}, warnings = []; let detectedYears = []; let queryDate = null;
  for (const b of blocks) {
    let unit = b.unit; for (const l of b.lines) { const um = l.match(/단위\s*[:：(]?\s*(백만원|천원|만원|억원|원|%)/); if (um) unit = um[1]; const qm = l.match(/(?:조회일시|조회일자)\s*[:：]?\s*((?:19|20)\d{2}[-.\/]\d{1,2}[-.\/]\d{1,2})/); if (qm && !queryDate) queryDate = qm[1].replace(/[.\/]/g, "-"); }
    let years = null; for (const l of b.lines) { const y = cretopYearHeader(l); if (y) { years = y; break; } }
    if (years) years.forEach((y) => { if (!detectedYears.includes(y)) detectedYears.push(y); });
    for (const l of b.lines) {
      if (cretopYearHeader(l)) continue;
      // 비율(라벨 시작) — 숫자 여러 개여도 마지막(조회기업) 값
      const lwn = normalizeAccountLabel((l.match(/^([가-힣A-Za-z]+)/) || [])[1] || "");
      const rr = CRETOP_FINAL_RATIO[lwn];
      if (rr) { if (b.ratioOk) { const allNums = (l.match(/-?[0-9][0-9,]*(?:\.[0-9]+)?/g) || []).map(parseNumLoose).filter((x) => x != null); if (allNums.length) { let v, idx; if (years && years.length && allNums.length === years.length) { const ly = Math.max(...years); idx = years.indexOf(ly); v = allNums[idx]; } else { idx = allNums.length - 1; v = allNums[idx]; } const key = rr[0]; if (v != null && (!metrics[key] || b.prio >= metrics[key]._prio)) metrics[key] = { key, label: CORE_LABEL_KR[key], year: years && years.length ? Math.max(...years) : null, rawValue: v, values: allNums, latestIndex: idx, unit: rr[1], eok: null, display: `${v.toLocaleString()}${rr[1]}`, source: b.name || "재무비율", rowText: l, _prio: b.prio }; } } continue; }
      if (!b.amountOk) continue;  // 금액은 재무표 블록 안에서만 추출(업계순위/동종업계/구성비 등 제외)
      const parsed = parseAcctRow(l); if (!parsed) continue;
      const mkey = CRETOP_FINAL_ACCT[parsed.label]; if (!mkey) continue;
      const valsAll = parsed.values;
      let latestYear = null, latestIndex = -1, selected = null;
      if (years && years.length) { latestYear = Math.max(...years); latestIndex = years.indexOf(latestYear);
        if (valsAll.length === years.length) selected = valsAll[latestIndex];
        else { const off = years.length - valsAll.length; const aligned = years.map((y, i) => (i - off >= 0 ? valsAll[i - off] : null)); selected = aligned[latestIndex]; warnings.push(`${parsed.label}: 값 개수(${valsAll.length})≠연도(${years.length}) 우측정렬 적용`); }
      } else { for (let i = valsAll.length - 1; i >= 0; i--) { if (valsAll[i] != null) { selected = valsAll[i]; latestIndex = i; break; } } warnings.push(`${parsed.label}: 연도 헤더 미감지 — 마지막 값 사용(연도 확인 필요)`); }
      if (selected == null) continue;
      const uf = unit && FINAL_UNIT_EOK[unit] != null ? FINAL_UNIT_EOK[unit] : null;
      const eok = uf != null ? selected * uf : null;
      const valid = eok != null ? validateAmountEok(eok, parsed.label) : { level: "normal" };
      const bad = valid.level === "suspect" || valid.level === "error" || valid.level === "exclude";
      const noYear = !(years && years.length);
      const caveat = [eok == null ? "단위 확인 필요" : null, noYear ? "연도 확인 필요(오른쪽 끝 값 사용)" : null].filter(Boolean).join(" · ");
      const display = bad ? `원문 확인 필요 (${cretopEokText(eok)} · 현실 범위 초과)` : (eok == null ? `${selected.toLocaleString()}${caveat ? " · " + caveat : ""}` : `${cretopEokText(eok)}${caveat ? " (" + caveat + ")" : ""}`);
      const rec = { key: mkey, label: parsed.label, year: latestYear, latestIndex, values: valsAll, rawValue: selected, unit: unit || "", eok, display, source: b.name || "표", rowText: l, _prio: b.prio, bad, noYear };
      if (!metrics[mkey] || b.prio >= metrics[mkey]._prio) metrics[mkey] = rec;
    }
  }
  const latestYear = detectedYears.length ? Math.max(...detectedYears) : null;
  return { latestYear, detectedYears: detectedYears.slice().sort((a, b) => a - b), queryDate, metrics, warnings, found: Object.keys(metrics).length };
}
// 현재 첨부 파일 원문 미리보기 — 첫 500자 + 기업명/사업자번호/대표자 후보(현재 파일이 맞는지 화면에서 확인용)
function buildFinPreview(text) {
  const t = String(text || "");
  const head = t.replace(/\s+/g, " ").trim().slice(0, 500);
  const LABELS = ["영문기업명", "영문명", "사업자번호", "사업자등록번호", "사업자", "법인번호", "법인등록번호", "대표자명", "대표자", "대표이사", "종업원수", "종업원", "업종", "설립일", "설립", "주소", "전화", "기업유형", "기업규모", "결산", "조회"];
  // 1) '기업명 : VALUE'에서 VALUE를 라벨어 전까지 자르기(헤더 행의 다음 라벨을 기업명으로 오인 방지)
  let nm = "";
  const m = t.match(/기업\s*명\s*[:：]?\s*([^\n]{2,40})/);
  if (m) { let s = m[1]; for (const lb of LABELS) { const idx = s.indexOf(lb); if (idx > 0) { s = s.slice(0, idx); } } s = s.replace(/[,\/|].*$/, "").replace(/\s+/g, " ").trim(); if (s && !LABELS.some((lb) => s === lb || s.startsWith(lb))) nm = s; }
  // 2) 라벨 매칭이 비거나 라벨어면, 표지/기업개요 앞부분의 (주)/㈜/주식회사 상호 토큰을 사용
  if (!nm) { const comp = (t.slice(0, 1500).match(/(?:\(주\)|㈜)\s?[가-힣A-Za-z0-9]{2,20}|[가-힣A-Za-z0-9]{2,20}\s?(?:\(주\)|㈜)|주식회사\s?[가-힣A-Za-z0-9]{2,20}|[가-힣A-Za-z0-9]{2,20}\s?주식회사/g) || [])[0]; if (comp) nm = comp.replace(/\s+/g, ""); }
  const biz = (t.match(/(?:사업자\s*(?:등록)?번호|사업자번호)\s*[:：]?\s*([0-9]{3}-?[0-9]{2}-?[0-9]{5})/) || [])[1];
  const ceo = (t.match(/대표(?:자|이사)?\s*명?\s*[:：]?\s*([가-힣]{2,4})(?=\s|종업원|사업자|$)/) || [])[1];
  return { head, companyName: nm ? nm.trim().replace(/\s+/g, " ") : "", businessNo: biz || "", ceoName: (ceo && !LABELS.includes(ceo)) ? ceo : "" };
}
// 가상 크레탑 표 샘플(붙여넣기 칸용) — 전부 가상 데이터(실제 업체 아님)
const CRETOP_SAMPLE_TABLES = {
  income: "요약 손익계산서 단위:백만원\n매출액 1,250 1,860 2,430\n영업이익 80 140 210\n당기순이익 55 100 160\n구분 2021 2022 2023",
  balance: "요약 재무상태표 단위:백만원\n자산총계 900 1,150 1,420\n부채총계 520 610 720\n자본총계 380 540 700\n구분 2021 2022 2023",
  ratio: "재무구조\n부채비율 136.8 113.0 102.9\n유동비율 145.2 168.4 191.7\n이자보상배수 8.5 12.3 18.6\n구분 2021 2022 2023",
  detail: "재무상태표 단위 :천원\n자산총계 900,000 1,150,000 1,420,000\n미처분이익잉여금 250,000 380,000 520,000\n구분 2021 2022 2023",
};
// 붙여넣은 표 텍스트만 분석(PDF 전체 원문 아님) — 각 칸에 섹션 제목/단위가 없으면 보강 후 블록 파서로 핵심지표 산출
function parseCretopPastedTables({ incomeText, balanceText, ratioText, detailText }) {
  const parts = [];
  const add = (title, txt) => { const t = String(txt || "").trim(); if (!t) return; const hasSec = /MY\s*재무|요약|손익계산서|재무상태표|재무비율|재무구조|부채상환|성장성|수익성/.test(t); parts.push(hasSec ? t : `${title}\n${t}`); };
  add("요약 손익계산서 단위:백만원", incomeText);
  add("요약 재무상태표 단위:백만원", balanceText);
  add("재무구조", ratioText);
  add("재무상태표 단위 :천원", detailText);
  const combined = parts.join("\n");
  return { combined, finalCore: buildCretopFinalCoreMetrics(combined) };
}
const CRETOP_CORE6 = ["revenue", "operatingProfit", "netIncome", "totalAssets", "totalLiabilities", "totalEquity"];
function cretopCoreFoundCount(rows) { const ks = new Set((rows || []).filter((r) => r.status !== "제외").map((r) => r.accountKey)); return CRETOP_CORE6.filter((k) => ks.has(k)).length; }
// 검색어 하이라이트(JSX)

export { CRETOP_UNIT_EOK, cretopToEok, cretopEokText, CRETOP_ACCT, CRETOP_RATIO, cretopNum, cretopRowNums, CRETOP_HEADER_WORD, matchRatioLead, cretopSection, parseCretopTables, groupItemsIntoLines, splitLabelNumCells, parseCretopLayout, cretopDebug, validateAmountEok, parseNumLoose, inlineNums, cretopPickLatest, buildCoreMetrics, normalizeAccountLabel, CRETOP_FINAL_ACCT, CRETOP_FINAL_RATIO, FINAL_UNIT_EOK, CORE_LABEL_KR, CORE_ORDER, cretopYearHeader, parseAcctRow, cretopSecOf, cretopBuildBlocks, CRETOP_EXTRACT_ACCT, CRETOP_EXTRACT_RATIO, EXTRACT_LABEL_KR, EXTRACT_ORDER, EXTRACT_STATUS, EXTRACT_UNITS, extractRowEok, extractEokText, extractCretopNumbers, extractRowsToCsv, extractRowsToText, CRETOP_EXTRACT_SAMPLE, cretopCharSpaced, cretopTileDecimalRun, cretopReassembleNumberRun, compactKoreanAndNumberSpacing, normalizeCretopLine, normalizeCretopPdfText, extractNumbersFromCretopLine, cretopNumTokens, cretopIsBareYear, cretopValuesIn, cretopLineYears, cretopLineAcct, analyzeCretopRaw, splitCretopCompactNumbersByYears, cretopRowRank, cretopSplitLineMetrics, extractCretopCandidatesFromLines, selectBestCretopCoreCandidates, CORE_ACCT, CORE_RATIO, CORE_LABELS, CORE_PREVIEW_ORDER, CRETOP_RATIO_CATS, CORE_TREND_ORDER, CRETOP_RATIO_AREAS, CRETOP_DETAIL_GROUPS, CRETOP_DETAIL_NONFIN, normalizeDetailLabel, CRETOP_BS_ORDER, CRETOP_BS_ORDER_MAP, cretopBsOrderIndex, cretopSortBsItems, parseCretopDetailRow, extractCretopDetail, normalizeRatioMetricName, CRETOP_RATIO_TEXTVAL, parseRatioRow, extractCretopFullRatioTable, cretopFullRatioRows, cretopRowTrend, cretopTrendComment, cretopTrendCommentRich, CRETOP_PREVIEW_TONES, cretopGradeTone, cretopPreviewTone, cretopGradeRow, extractCretopGrades, extractCretopCompanyInfo, extractCretopExternalInfo, extractCretopCore, CRETOP_UF, UF_TO_MILLION, toMillionWon, buildCretopParsedForUi, cretopCashflowGradeInfo, cretopCoreDebug, CRETOP_CORE_SAMPLE, cretopDebugJson, buildCretopFinalCoreMetrics, buildFinPreview, CRETOP_SAMPLE_TABLES, parseCretopPastedTables, CRETOP_CORE6, cretopCoreFoundCount };
