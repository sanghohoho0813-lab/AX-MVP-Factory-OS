// 사례 매칭 — knowledge/funding-cases.json (64건) 과 유사도 계산.
// 업종·업력·매출·직원수·신용·자금목적·기술력·특허·연구소·법인여부·추천기관·searchTags 를
// 종합해 유사도(%)를 구하고 TOP5 사례를 반환한다.

import type { CaseRecord, KnowledgeBase, Profile } from "./knowledgeEngine";
import type { SimilarCase } from "../types";

// ── 파서: 사례 문자열 → 수치 ──
function parseYears(s: string | null): number | null {
  if (!s) return null;
  const m = s.match(/(\d+(?:\.\d+)?)\s*년/);
  if (m) return parseFloat(m[1]);
  const mo = s.match(/(\d+)\s*개월/);
  if (mo) return parseInt(mo[1], 10) / 12;
  return null;
}
function inputYears(idx: number): number {
  return [0.5, 2, 5, 8][idx] ?? 2;
}

// 억 단위로 정규화 (연매출 기준, 월매출은 ×12)
function parseRevenueEok(s: string | null): number | null {
  if (!s) return null;
  const monthly = /월\s*매출/.test(s);
  const eok = [...s.matchAll(/(\d+(?:\.\d+)?)\s*억/g)].map((m) =>
    parseFloat(m[1]),
  );
  if (eok.length) {
    const v = eok[eok.length - 1]; // 최근값
    return v;
  }
  const man = s.match(/(\d[\d,]*)\s*만/);
  if (man) {
    const v = parseInt(man[1].replace(/,/g, ""), 10) / 10000; // 만→억
    return monthly ? v * 12 : v;
  }
  return null;
}
function inputRevenueEok(idx: number): number {
  return [0.5, 3, 7.5, 20, 40][idx] ?? 3;
}

function parseCredit(s: string | null): number | null {
  if (!s) return null;
  if (/900|우수/.test(s)) return 3;
  if (/800|700|보통/.test(s)) return 2;
  if (/600|낮|저신용|등급 하락/.test(s)) return 1;
  if (/300|초저신용|바닥/.test(s)) return 0;
  return null;
}
function inputCredit(c: string): number | null {
  if (c === "우수") return 3;
  if (c === "보통") return 2;
  if (c === "낮음") return 1;
  return null;
}

function parseEmployees(s: string | null): number | null {
  if (!s) return null;
  if (/1인|0명|없/.test(s)) return 0;
  const m = s.match(/(\d+)\s*명/);
  if (m) return parseInt(m[1], 10);
  return null;
}
function inputEmployees(idx: number): number {
  return [0, 2, 7, 12][idx] ?? 2;
}

function prox(a: number | null, b: number | null, scale: number, weight: number) {
  if (a === null || b === null) return weight * 0.5; // 결측 → 중립 부분점수
  return weight * Math.max(0, 1 - Math.abs(a - b) / scale);
}

// 자금목적 태그
function purposeTag(purpose: string): string {
  return (
    {
      운전자금: "운전자금",
      시설자금: "시설자금",
      창업자금: "창업초기",
      저신용자금: "저신용",
      긴급자금: "긴급자금",
    }[purpose] ?? "운전자금"
  );
}

interface Scored {
  c: CaseRecord;
  rate: number;
}

function scoreCase(
  c: CaseRecord,
  profile: Profile,
  topAgency: string,
): number {
  let s = 0;

  // 업종 (24)
  if (c.industryCategory === profile.industryCategory) s += 24;

  // 자금목적 (14)
  const pt = purposeTag(profile.input.purpose);
  if (c.fundingPurpose.includes(profile.input.purpose) || c.searchTags.includes(pt))
    s += 14;

  // searchTags 교집합 (10, 업종/기관 제외한 나머지)
  const caseTags = new Set(c.searchTags);
  const overlap = profile.tags.filter(
    (t) => t !== profile.industryCategory && caseTags.has(t),
  ).length;
  s += Math.min(10, overlap * 4);

  // 기술력·특허·연구소 등 강점 (12) — 사례 본문/태그에서 키워드 탐색
  const caseText =
    c.searchTags.join(" ") + " " + c.situation + " " + c.strategy + " " + c.keyPoint;
  let strengthHit = 0;
  for (const kw of profile.strengthKeywords)
    if (caseText.includes(kw)) strengthHit += 1;
  s += Math.min(12, strengthHit * 4);

  // 추천기관 (10)
  if (c.institutions.some((i) => i.includes(topAgency) || topAgency.includes(i)))
    s += 10;

  // 업력 (8)
  s += prox(parseYears(c.businessAge), inputYears(profile.yearsIdx), 8, 8);
  // 매출 (8)
  s += prox(
    parseRevenueEok(c.revenue),
    inputRevenueEok(profile.revenueIdx),
    15,
    8,
  );
  // 신용 (6)
  s += prox(parseCredit(c.creditStatus), inputCredit(profile.input.credit), 3, 6);
  // 법인여부 (4)
  const caseCorp = /법인/.test(c.industry + c.title + caseText);
  if (caseCorp === profile.isCorp) s += 4;
  // 직원수 (4)
  s += prox(
    parseEmployees(c.employees),
    inputEmployees(profile.employeesIdx),
    10,
    4,
  );

  return Math.round(Math.min(100, s));
}

function toSimilarCase(c: CaseRecord, rate: number): SimilarCase {
  return {
    title: c.title,
    industry: c.industry,
    years: c.businessAge ?? "-",
    revenue: c.revenue ?? "-",
    agency: `${c.institutions[0] ?? "정책기관"} 추천`,
    approved: c.approvedAmount,
    note: c.keyPoint || c.situation,
    lesson: c.lesson,
    matchRate: rate,
  };
}

export function matchCases(
  profile: Profile,
  kb: KnowledgeBase,
  topAgency: string,
): SimilarCase[] {
  const scored: Scored[] = kb.cases.map((c) => ({
    c,
    rate: scoreCase(c, profile, topAgency),
  }));
  scored.sort((a, b) => b.rate - a.rate);
  return scored.slice(0, 5).map((x) => toSimilarCase(x.c, x.rate));
}
