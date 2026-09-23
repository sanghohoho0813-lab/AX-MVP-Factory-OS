// 크레탑 엔진 골든 회귀 테스트 — 순수 엔진을 직접 import(번들러 불필요). `node packages/cretop-engine/golden.test.mjs`
import { buildCretopParsedForUi } from "../engine/index.js";
import { cretopYearPool, cretopFillYears } from "../mini/years.js";
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
console.log(`크레탑 엔진 골든 ${pass} PASS / ${fail} FAIL`);
if (fail) { fails.forEach(f => console.log("  ✗ " + f)); process.exit(1); }
