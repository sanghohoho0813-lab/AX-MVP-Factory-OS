// 크레탑 엔진 골든 회귀 테스트 — 순수 엔진을 직접 import(번들러 불필요). `node packages/cretop-engine/golden.test.mjs`
import { readFileSync } from "node:fs";
import { buildCretopParsedForUi, normalizeCretopLine, cretopSplitLineMetrics, parseAcctRow } from "../engine/index.js";
import { cretopYearPool, cretopFillYears } from "../mini/years.js";
import { extractCeoAge } from "../mini/analysisCore.js";
import { extractShareCount } from "../mini/extract.js";
const FIXTURE = readFileSync(new URL("../../../../e2e/fixtures/cretop-company.txt", import.meta.url), "utf8");
const NOW = new Date().getFullYear();
const near = (a, b, e = 0.3) => typeof a === "number" && Math.abs(a - b) <= e;
let pass = 0, fail = 0, fails = [];
const ok = (c, m) => { if (c) pass++; else { fail++; fails.push(m); } };

// 익명화 픽스처(실제 케이스의 구조만 반영) — 케이스 A(고부채·저커버리지) / 케이스 B(불규칙 회계연도·단일연도 비율표) / 케이스 C(2단 재무비율표·상세표 병합)
const SEBANG = ["기업명 세방형(주)","요약 손익계산서 단위:백만원","구분 2023 2024 2025","매출액 6000 6200 6397","영업이익 90 95 104","당기순이익 150 180 202","요약 재무상태표 단위:백만원","구분 2023 2024 2025","자산총계 12000 11500 11000","부채총계 9800 10100 8740","자본총계 2200 1400 1000","유동자산 3000 2900 2801","유동부채 9500 9800 10000","재무상태표","계정명 2023-12-31 2024-12-31 2025-12-31","감사의견 적정","유동자산 3,000,000 2,900,000 2,801,000","유동부채 9,500,000 9,800,000 10,000,000","부채 9,800,000 10,100,000 8,740,000","자본 2,200,000 1,400,000 1,000,000","손익계산서","계정명 2023-12-31 2024-12-31 2025-12-31","매출액 6,000,000 6,200,000 6,397,000","영업이익 90,000 95,000 104,000","이자비용 173,000 182,000 200,000","당기순이익 150,000 180,000 202,000","재무비율 단위:%","구분 2023 2024 2025","부채비율 445.45 721.43 874.00","유동비율 31.58 29.59 28.01","이자보상배수 0.75 0.61 0.52"].join("\n");
{ const ui = buildCretopParsedForUi(SEBANG), cp = ui.corePreview;
  ok(near(cp.debtRatio && cp.debtRatio.value, 874, 1), "세방 부채비율 874");
  ok(near(cp.currentRatio && cp.currentRatio.value, 28.01, 0.1), "세방 유동비율 28.01");
  ok(near(cp.interestCoverageRatio && cp.interestCoverageRatio.value, 0.52, 0.02), "세방 이자보상 0.52");
  ok(near(cp.netIncome && cp.netIncome.eok, 2.02, 0.02), "세방 당기순이익 2.02억");
  ok(ui.trendRows.find(r => r.key === "netIncome").trend.series.length === 3, "세방 순익추이 3개년");
  ok(JSON.stringify(ui.reportRatioYears) === JSON.stringify([2023, 2024, 2025]), "세방 ratioYears"); }
const ENE = ["기업명 확인이엔이(주)","MY 재무 Data 단위:백만원","구분 2019 2021","매출액 2010 2368","당기순이익 55 99","요약 손익계산서 단위:백만원","구분 2018 2019 2021","매출액 1820 2010 2368","영업이익 70 88 111","당기순이익 40 55 99","요약 재무상태표 단위:백만원","구분 2018 2019 2021","자산총계 316 400 744","부채총계 227 216 385","자본총계 90 184 359","재무상태표","계정명 2018-12-31 2019-12-31 2021-12-31","감사의견 적정","유동자산 301,139 385,367 728,494","유동부채 200,000 245,000 345,986","부채 227,000 216,000 384,875","자본 90,000 184,000 358,654","손익계산서","계정명 2018-12-31 2019-12-31 2021-12-31","매출액 1,820,000 2,010,000 2,368,313","영업이익 70,000 88,000 111,000","이자비용 800 900 1,100","당기순이익 40,000 55,000 98,880","재무비율 단위:%","구분 2019","부채비율 117.32","유동비율 178.28"].join("\n");
{ const ui = buildCretopParsedForUi(ENE), cp = ui.corePreview;
  ok(cp.debtRatio && cp.debtRatio.value > 100 && cp.debtRatio.value < 200, "이앤이 부채비율 107대");
  ok(cp.currentRatio && cp.currentRatio.value >= 208 && cp.currentRatio.value <= 213, "이앤이 유동비율 211대");
  ok(near(cp.netIncomeMargin && cp.netIncomeMargin.value, 4.18, 0.1), "이앤이 순이익률 4.18");
  ok(near(cp.totalLiabilities && cp.totalLiabilities.eok, 3.85, 0.05), "이앤이 부채총계 3.85억");
  ok(ui.detailStatements.balanceSheet.items[0].rawLabel === "감사의견", "이앤이 상세BS 감사의견 시작"); }
const HYO = ["기업명 효성형(주)","요약 손익계산서 단위:백만원","구분 2022 2023 2024","매출액 6472 6775 6704","영업이익 -19 58 41","당기순이익 136 123 92","요약 재무상태표 단위:백만원","구분 2022 2023 2024","자산총계 5509 5622 5716","부채총계 2136 2151 2179","자본총계 3373 3471 3537","재무상태표 단위:천원","구분 2022-12-31 2023-12-31 2024-12-31","감사의견 적정","유동자산 4,351,000 4,355,000 4,453,000","유동부채 270,000 440,000 343,000","부채 2,136,112 2,151,348 2,178,842","자본 3,372,527 3,470,689 3,537,221","손익계산서 단위:천원","구분 2022-12-31 2023-12-31 2024-12-31","매출액 6,472,000 6,775,000 6,703,634","영업이익 -18,752 58,000 41,000","* 당기순이익 135,583 123,162 92,443","요약 재무비율 단위:%","성장성 2022 2023 2024 수익성 2022 2023 2024","총자산증가율 2.32 2.06 1.67 영업이익률 -0.29 0.86 0.62","매출액증가율 -37.46 4.68 -1.06 ROE 4.09 3.6 2.64","안정성 2022 2023 2024 활동성 2022 2023 2024","부채비율 63.34 61.99 61.6 매출채권회전율(회) 6.31 5.52 5.76","재무비율 단위:%","구분 2022 2023 2024","유동비율 1611.91 988.04 1296.96","EBITDA/총차입금 5.24 9.61 7.91","차입금/매출액 28.58 24.91 27.04"].join("\n");
{ const ui = buildCretopParsedForUi(HYO), cp = ui.corePreview;
  ok(near(cp.debtRatio && cp.debtRatio.value, 61.6, 1) && cp.debtRatio.value < 1000, "효성 부채비율 61.6");
  ok(ui.trendRows.find(r => r.key === "netIncome").trend.series.length === 3, "효성 순익추이 3개년");
  ok(JSON.stringify(ui.reportRatioYears) === JSON.stringify([2022, 2023, 2024]), "효성 ratioYears");
  const fa = (ak, mk) => { const a = ui.ratioAreas.find(x => x.key === ak); return a && a.metrics.find(m => m.key === mk); };
  ok(fa("structure", "currentRatio") && fa("coverage", "ebitdaToDebt") && fa("activity", "equityTurnover"), "효성 5영역 보강 유지"); }

// [D-94] 연도 칸 채우기 — 표시 전용(엔진 결과는 그대로)
{ const ui = buildCretopParsedForUi(HYO);
  const pool = cretopYearPool(ui);
  ok(JSON.stringify(pool) === JSON.stringify([2022, 2023, 2024]), "연도풀: 효성 결산연도 2022~2024");
  ok(JSON.stringify(cretopFillYears([], 3, pool)) === JSON.stringify([2022, 2023, 2024]), "연도 없는 표: 최근 3개년으로");
  ok(JSON.stringify(cretopFillYears([null, 2023, null], 3, pool)) === JSON.stringify([2022, 2023, 2024]), "연도 하나 있으면 그 자리에 맞춤");
  ok(JSON.stringify(cretopFillYears([2021, null, null], 3, pool)) === JSON.stringify([2021, null, null]), "풀에 없는 연도면 건드리지 않음");
  ok(JSON.stringify(cretopFillYears([2022, 2023, 2024], 3, pool)) === JSON.stringify([2022, 2023, 2024]), "이미 있으면 그대로");
  ok(JSON.stringify(cretopFillYears([], 2, pool)) === JSON.stringify([2023, 2024]), "2칸이면 최근 2개년");
  ok(JSON.stringify(cretopFillYears([], 3, [])) === JSON.stringify([null, null, null]), "풀이 없으면 비운 채로");
  const e = buildCretopParsedForUi(ENE);
  ok(JSON.stringify(cretopYearPool(e)) === JSON.stringify([2018, 2019, 2021]), "연도풀: 불규칙 결산연도 그대로(2020 끼워 넣지 않음)"); }
// ── [D-136] 틀린 숫자가 사실로 흘러가지 않게 — 한 자리 칸 · 빈칸 '-' · 최신 연도 빈칸 · 음수 3모양 · 단위 · 최신→과거 순 · 자본 0 · 회사 정보 · 대표 나이 ──
{
  const J = (x) => JSON.stringify(x);
  const cpOf = (lines) => buildCretopParsedForUi(lines.join("\n")).corePreview;
  const BS = ["요약 재무상태표 단위:백만원", "구분 2022 2023 2024", "자산총계 5509 5622 5716", "부채총계 2136 2151 2179", "자본총계 3373 3471 3537"];
  const IS = (rows, head = ["요약 손익계산서 단위:백만원", "구분 2022 2023 2024"]) => [...head, ...rows, ...BS];

  // 1. 한 자리 숫자 칸은 붙이지 않는다(연도 칸마다 따로인 값)
  { const cp = cpOf(IS(["매출액 6472 6775 6704", "영업이익 5 8 9", "당기순이익 0 0 0"]));
    ok(J(cp.operatingProfit.series) === J([5, 8, 9]) && cp.operatingProfit.value === 9, "D-136 한 자리: 영업이익 5 8 9 → [5,8,9]");
    ok(J(cp.netIncome.series) === J([0, 0, 0]) && cp.netIncome.value === 0, "D-136 한 자리: 0 0 0 → 세 칸 0");
    const cp2 = cpOf(IS(["매출액 6472 6775 6704", "당기순이익 5 8 9"]));
    ok(J(cp2.netIncome.series) === J([5, 8, 9]), "D-136 한 자리: 당기순이익 5 8 9 → 589 로 붙지 않음");
    ok(normalizeCretopLine("당기순이익 5 8 9") === "당기순이익 5 8 9" && normalizeCretopLine("이익잉여금처분액 0 0 0") === "이익잉여금처분액 0 0 0", "D-136 한 자리: 정규화가 숫자 칸을 붙이지 않음");
    ok(normalizeCretopLine("구 분 2 0 2 2 2 0 2 3 2 0 2 4") === "구분 2022 2023 2024" && normalizeCretopLine("매 출 액 6 , 4 7 2 6 , 7 7 5 6 , 7 0 4") === "매출액 6,472 6,775 6,704", "D-136 한 자리: 글자 단위 PDF(연도 · 콤마 숫자)는 그대로 복원");
    const pdf = buildCretopParsedForUi(["재 무 상 태 표", "단위 : 천원", "구분 2022-12-31 2023-12-31 2024-12-31", "감사의견 적정 적정 적정", "유동자산 4,351,000 4,355,000 4,453,000", "이익잉 여 금 처 분 계 산 서", "단위 : 천원", "구분 2022-12-31 2023-12-31 2024-12-31", "미처분이익잉여금 900,000 1,000,000 1,090,000", "이익잉여금처분액 0 0 0"].join("\n"));
    const re = pdf.detailStatements.retainedEarnings.items.find((i) => i.rawLabel === "이익잉여금처분액");
    ok(re && J(re.numberCandidates) === J([0, 0, 0]), "D-136 한 자리: PDF 이익잉여금처분액 0 0 0 → [0,0,0] (예전 [0,null,null])"); }

  // 2. 단독 '-'는 빈칸 · 음수는 붙은 '-' · 괄호 · 세모
  { const cp = cpOf(IS(["매출액 - 6775 6704", "영업이익 -19 (58) △41", "당기순이익 136 123 92"]));
    ok(J(cp.revenue.series) === J([null, 6775, 6704]) && cp.revenue.value === 6704 && !cp.revenue.needsCheck, "D-136 빈칸: 매출액 - 6775 6704 → [null,6775,6704]");
    ok(J(cp.operatingProfit.series) === J([-19, -58, -41]), "D-136 음수: -19 · (58) · △41 → 모두 음수");
    const d = buildCretopParsedForUi(["손익계산서 단위:천원", "구분 2022-12-31 2023-12-31 2024-12-31", "매출액 6,472,000 6,775,000 6,703,634", "영업이익 (18,752) △58,000 -41,000", "이자비용 - 44,000 47,000", "당기순이익 △ 5,000 123,162 92,443"].join("\n"));
    const it = (n) => d.detailStatements.incomeStatement.items.find((i) => i.rawLabel === n);
    ok(it("영업이익") && J(it("영업이익").numberCandidates) === J([-18752, -58000, -41000]), "D-136 음수: 상세 손익 (18,752) · △58,000 · -41,000");
    ok(it("이자비용") && J(it("이자비용").numberCandidates) === J([null, 44000, 47000]), "D-136 빈칸: 상세 손익 '-' → null");
    ok(it("당기순이익") && J(it("당기순이익").numberCandidates) === J([-5000, 123162, 92443]), "D-136 음수: 떨어진 세모 '△ 5,000'");
    const sp = cretopSplitLineMetrics("매출액 - 6775 6704", undefined, undefined, 3);
    ok(sp.length === 1 && J(sp[0].values) === J([null, 6775, 6704]), "D-136 빈칸: 줄 나누기에서도 '-' = 빈칸");
    ok(J(cretopSplitLineMetrics("영업이익 - 18,752 58,000 41,000", undefined, undefined, 3)[0].values) === J([-18752, 58000, 41000]), "D-136 음수: 글자 단위 PDF의 떨어진 부호(숫자 수 = 연도 수)는 음수");
    ok(J(parseAcctRow("영업이익 (1,234) △5 -")) === J({ label: "영업이익", values: [-1234, -5, null] }), "D-136 음수: 숫자 추출기 행도 괄호 · 세모 음수"); }

  // 3. 최신 연도 칸이 비면 예전 값을 최신으로 쓰지 않는다
  { const cp = cpOf(IS(["매출액 6472 6775 -", "영업이익 210 258 241"]));
    ok(cp.revenue.value === null && cp.revenue.eok === null && cp.revenue.year === 2024 && cp.revenue.latestMissing === true && cp.revenue.needsCheck === true, "D-136 최신 빈칸: 2024=null · 확인 필요(6775 를 2024 로 쓰지 않음)");
    ok(J(cp.revenue.series) === J([6472, 6775, null]), "D-136 최신 빈칸: 추이는 제 연도에");
    const r = buildCretopParsedForUi(IS(["매출액 6472 6775 6704"], ["요약 손익계산서 단위:백만원", "구분 2022 2023 2024"]).concat(["재무비율 단위:%", "구분 2022 2023 2024", "부채비율 63.34 61.99 -", "유동비율 - 302.4 331.6"]).join("\n"));
    const dr = r.ratioAreas.find((a) => a.key === "structure").metrics.find((m) => m.key === "debtRatio");
    ok(dr && dr.trend && J(dr.trend.series.map((x) => x.val)) === J([63.34, 61.99, null]), "D-136 최신 빈칸: 재무비율 표도 2024 칸은 빈칸(61.99 를 2024 로 올리지 않음)"); }

  // 4. 단위 — 백만원 · 천원 · 원 · 없음
  { const a = cpOf(IS(["매출액 6472 6775 6704"]));
    ok(a.revenue.unit === "백만원" && a.revenue.eok === 67.04 && !a.revenue.unitAssumed, "D-136 단위: 백만원");
    const b = cpOf(["손익계산서", "단위 : 천원", "구분 2022-12-31 2023-12-31 2024-12-31", "매출액 6,472,000 6,775,000 6,703,634", ...BS]);
    ok(b.revenue.unit === "천원" && b.revenue.eok === 67.04 && !b.revenue.unitAssumed, "D-136 단위: 제목 다음 줄의 단위:천원");
    const c = cpOf(["손익계산서", "구분 2022-12-31 2023-12-31 2024-12-31", "매출액 6,472,000,000 6,775,000,000 6,703,634,000", "(단위: 원)", ...BS]);
    ok(c.revenue.unit === "원" && c.revenue.eok === 67.04 && !c.revenue.unitAssumed, "D-136 단위: 표 아래 (단위: 원)도 같은 섹션이면 씀");
    const d = cpOf(["요약 손익계산서", "구분 2022 2023 2024", "매출액 6,472,000 6,775,000 6,703,634", ...BS]);
    ok(d.revenue.unitAssumed === true && d.revenue.needsCheck === true, "D-136 단위: 없음 + 백만원 추정 시 67,036억(현실 범위 밖) → 확인 필요");
    const e = cpOf(["손익계산서", "구분 2022-12-31 2023-12-31 2024-12-31", "매출액 6,472,000 6,775,000 6,703,634", ...BS]);
    ok(e.revenue.unit === "천원" && e.revenue.unitAssumed === true && e.revenue.eok === 67.04, "D-136 단위: 상세 손익 단위 없음 → 천원 추정(예전 백만원 가정 X) · 추정 표시");
    const f = cpOf(["요약 손익계산서 단위:백만원", "구분 2022 2023 2024", "매출액 6472 6775 6704", "손익계산서 단위:천원", "구분 2022-12-31 2023-12-31 2024-12-31", "매출액 6,472 6,775 6,704", "영업이익 1 2 3", ...BS]);
    ok(f.revenue.needsCheck === true && f.revenue.checkReasons.some((x) => /다른 표/.test(x)), "D-136 단위: 요약(백만원)과 상세(천원) 금액이 1000배 다르면 확인 필요");
    const g = buildCretopParsedForUi(["재무상태표 단위:백만원", "구분 2022-12-31 2023-12-31 2024-12-31", "감사의견 적정", "유동자산 4351 4355 4453", "토지 100 100 120"].join("\n"));
    ok(g.detailStatements.balanceSheet.unit === "백만원" && g.detailStatements.balanceSheet.items.filter((i) => !i.isHeader).every((i) => i.unit === "백만원"), "D-136 단위: 상세 재무상태표 제목의 단위:백만원 을 행에 적용(예전 천원)"); }

  // 6. 최신→과거 순 표
  { const cp = cpOf(["요약 손익계산서 단위:백만원", "구분 2024 2023 2022", "매출액 6704 6775 6472", "영업이익 41 58 -19", "요약 재무상태표 단위:백만원", "구분 2024 2023 2022", "자산총계 5716 5622 5509", "부채총계 2179 2151 2136", "자본총계 3537 3471 3373"]);
    ok(cp.revenue.value === 6704 && cp.revenue.year === 2024 && J(cp.revenue.series) === J([6472, 6775, 6704]) && J(cp.revenue.years) === J([2022, 2023, 2024]), "D-136 최신→과거: 매출 2024=6704");
    ok(J(cp.operatingProfit.series) === J([-19, 58, 41]) && cp.totalEquity.value === 3537, "D-136 최신→과거: 영업이익 · 자본도 제 연도");
    ok(cp.debtRatio && Math.abs(cp.debtRatio.value - 61.61) < 0.01 && cp.debtRatio.year === 2024, "D-136 최신→과거: 부채비율 2024 = 61.61");
    const d = buildCretopParsedForUi(["재무상태표 단위:천원", "구분 2024-12-31 2023-12-31 2022-12-31", "감사의견 적정", "현금및현금성자산 760,000 820,000 900,000", "단기차입금 700,000 620,000 500,000"].join("\n"));
    ok(d.corePreview.cash && d.corePreview.cash.value === 760000 && J(d.corePreview.cash.series) === J([900000, 820000, 760000]) && J(d.detailStatements.balanceSheet.years) === J([2022, 2023, 2024]), "D-136 최신→과거: 상세 재무상태표 현금 2024=760,000");
    const r = buildCretopParsedForUi(["재무비율 단위:%", "구분 2024 2023 2022", "부채비율 61.6 61.99 63.34"].join("\n"));
    const dr = r.ratioAreas.find((a) => a.key === "structure").metrics.find((m) => m.key === "debtRatio");
    ok(dr && J(dr.trend.series.map((x) => [x.year, x.val])) === J([[2022, 63.34], [2023, 61.99], [2024, 61.6]]), "D-136 최신→과거: 재무비율 표도 짝지어 정렬"); }

  // 10. 자본총계 0 · 음수
  { const z = cpOf(["요약 재무상태표 단위:백만원", "구분 2022 2023 2024", "자산총계 5509 5622 5716", "부채총계 2136 2151 5716", "자본총계 3373 3471 0"]);
    ok(z.debtRatio && z.debtRatio.capitalErosion === true && z.debtRatio.value === null && z.debtRatio.display === "계산 불가(자본잠식)" && z.debtRatio.year === 2024, "D-136 자본 0: 부채비율 계산 불가(자본잠식) · 2023 값을 최신으로 쓰지 않음");
    const n = cpOf(["요약 재무상태표 단위:백만원", "구분 2022 2023 2024", "자산총계 5509 5622 5716", "부채총계 2136 2151 6000", "자본총계 3373 3471 -284"]);
    ok(n.debtRatio && n.debtRatio.capitalErosion === true && n.debtRatio.display === "계산 불가(자본잠식)" && n.totalEquity.value === -284, "D-136 자본 음수: 자본잠식"); }

  // 8 · 15. 회사 정보
  { const co = buildCretopParsedForUi("기업명 : 한빛정밀(주)\n사업자번호 : 214 - 87 - 35291\n대표이사 : 김한빛, 이두리\n종업원수 1,234명\n설립일 : 2008년 04월 15일").companyInfo;
    ok(co.ceoName === "김한빛", `D-136 회사: 대표이사 여럿 → 첫 사람(예전 '이사') [${co.ceoName}]`);
    ok(co.employees === "1234", `D-136 회사: 종업원수 1,234명 → 1234 [${co.employees}]`);
    ok(co.established === "2008-04-15", `D-136 회사: 설립일 2008년 04월 15일 → 2008-04-15 [${co.established}]`);
    ok(co.businessNo === "214-87-35291", `D-136 회사: 띄어 쓴 사업자번호 [${co.businessNo}]`);
    const y = buildCretopParsedForUi("대표이사 생년월일 1962.03.02\n대표자 : 김한빛\n설립 2011년").companyInfo;
    ok(y.ceoName === "김한빛" && y.established === "2011", "D-136 회사: '대표이사 생년월일' 을 이름으로 읽지 않음 · 연도만 있는 설립일은 연도 그대로(날짜 지어내지 않음)"); }

  // 9. 대표 나이 — 대놓고 적힌 생년만
  { ok(extractCeoAge("대표이사 생년월일 1962.03.02") === NOW - 1962, "D-136 나이: 생년월일");
    ok(extractCeoAge("대표자 김한빛(1962년생)") === NOW - 1962, "D-136 나이: ○○○○년생");
    ok(extractCeoAge("대표자 : 김한빛 설립일 2008.04.15") === null, "D-136 나이: 대표자 줄의 설립 연도를 생년으로 읽지 않음");
    ok(extractCeoAge("대표이사 김한빛 취임일 2015.03.01") === null, "D-136 나이: 취임 연도를 생년으로 읽지 않음");
    ok(extractCeoAge("생년월일 1962.03.02\n출생 1970") === null, "D-136 나이: 생년이 둘(서로 다름) → 모름"); }

  // 12. 발행주식수 — 합계 행 없으면 확인 필요
  { const withTotal = extractShareCount("주주현황\n김한빛 최대주주 6,000 60.0\n이두리 특수관계인 4,000 40.0\n합계 10,000 100\n임원현황", null);
    ok(withTotal.count === 10000, "D-136 주식수: 합계 행 있으면 합계");
    const noTotal = extractShareCount("주주현황\n김한빛 최대주주 6,000 60.0\n이두리 특수관계인 1,000 10.0\n임원현황", null);
    ok(noTotal.count === null && noTotal.needsCheck === true && noTotal.candidate === 7000, "D-136 주식수: 합계 행 없으면 개별합(7,000)을 쓰지 않고 확인 필요"); }

  // 기존 픽스처(업체 등록 시험용) — 숫자가 예전과 같다
  { const ui = buildCretopParsedForUi(FIXTURE), cp = ui.corePreview;
    ok(cp.revenue.value === 6704 && cp.revenue.eok === 67.04 && cp.revenue.year === 2024 && !cp.revenue.needsCheck, "D-136 픽스처: 매출 6704백만원 · 2024 · 확인 필요 아님");
    ok(cp.netIncome.value === 192 && cp.totalAssets.value === 5716 && cp.totalLiabilities.value === 2179 && cp.totalEquity.value === 3537, "D-136 픽스처: 순이익 · 자산 · 부채 · 자본 그대로");
    ok(near(cp.debtRatio.value, 61.61, 0.01) && cp.cash.value === 760000 && cp.shortTermBorrowings.value === 700000, "D-136 픽스처: 부채비율 61.61 · 현금 · 단기차입금 그대로");
    ok(["revenue", "operatingProfit", "netIncome", "totalAssets", "totalLiabilities", "totalEquity", "cash", "retainedEarnings"].every((k) => !cp[k].needsCheck), "D-136 픽스처: 확인 필요 표시 없음");
    const co = ui.companyInfo;
    ok(co.ceoName === "김한빛" && co.businessNo === "214-87-35291" && co.established === "2008-04-15" && co.employees === "23", "D-136 픽스처: 회사 정보 그대로"); }
}
console.log(`크레탑 엔진 골든 ${pass} PASS / ${fail} FAIL`);
if (fail) { fails.forEach(f => console.log("  ✗ " + f)); process.exit(1); }
