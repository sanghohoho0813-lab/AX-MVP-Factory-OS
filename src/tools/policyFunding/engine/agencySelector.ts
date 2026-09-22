// 기관 선택 — knowledge/funding-agencies.json 의 규칙만 참고해 판단.
// 9차: knowledge/agency-exclusion-rules.json 의 체급(연매출)·신용·2금융 보정을 반영해
// "매출 1억 미만인데 신보 TOP3" 같은 비현실적 추천을 차단한다.
// 후순위로 밀린 기관은 사유(deprioritized)와 함께 반환한다.

import type { AgencyRule, KnowledgeBase, Profile } from "./knowledgeEngine";
import type { AgencyRecommendation, DeprioritizedAgency } from "../types";
import exclusionJson from "../knowledge/agency-exclusion-rules.json";

const clamp = (n: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, Math.round(n)));

// ── exclusion-rules 스키마 ──
interface RevenueTier {
  maxEok: number;
  penalty: number;
  label: string;
  reason: string;
}
interface RevenueTierRule {
  agencyKey: string;
  agencyName: string;
  tiers: RevenueTier[];
  exception: {
    minSignals: number;
    signals: string[];
    label: string;
    note: string;
  };
}
interface AdjustEntry {
  condition: string;
  score?: number;
  penalty?: number;
  reason: string;
}
interface AgencyAdjustRule {
  agencyKey: string;
  agencyName: string;
  boosts: AdjustEntry[];
  cautions: AdjustEntry[];
}
const EXCLUSION = exclusionJson as unknown as {
  revenueTierRules: RevenueTierRule[];
  agencyAdjustRules: AgencyAdjustRule[];
};

// JSON 라벨과 프로필을 느슨하게 매칭 (구두점/영문 차이 흡수)
function norm(s: string): string {
  return s.toLowerCase().replace(/[·・/\s()]/g, "");
}

function industryFavored(rule: AgencyRule, profile: Profile): boolean {
  const cat = norm(profile.industryCategory);
  const ind = norm(profile.input.industry);
  return rule.favorableIndustries.some((f) => {
    const nf = norm(f);
    return (
      nf.includes(cat) ||
      cat.includes(nf) ||
      (ind.length > 0 && (nf.includes(ind) || ind.includes(nf)))
    );
  });
}

function purposeMatched(rule: AgencyRule, profile: Profile): boolean {
  const p = norm(profile.input.purpose);
  return rule.mainPurposes.some((m) => norm(m).includes(p));
}

// suitableFor 문구에서 프로필 강점 키워드가 언급되는지
function strengthAligned(rule: AgencyRule, profile: Profile): number {
  const text = rule.suitableFor.join(" ");
  let hits = 0;
  for (const kw of profile.strengthKeywords) if (text.includes(kw)) hits += 1;
  return Math.min(3, hits);
}

// unfavorableConditions 중 프로필로 판단 가능한 항목만 페널티
function unfavorableHits(rule: AgencyRule, profile: Profile): string[] {
  const hits: string[] = [];
  for (const c of rule.unfavorableConditions) {
    const t = c;
    if (t.includes("저신용") && profile.lowCredit) hits.push(c);
    else if (
      (t.includes("상시근로자") || t.includes("규모가 커")) &&
      profile.input.employees === "10명 이상"
    )
      hits.push(c);
    else if (t.includes("기술 강점") && !profile.hasTech) hits.push(c);
    else if (
      (t.includes("단순 도소매") || t.includes("단순 소매") || t.includes("음식")) &&
      (profile.industryCategory === "음식/외식" ||
        profile.industryCategory === "도소매") &&
      (rule.key === "kibo" || rule.key === "kosme")
    )
      hits.push(c);
  }
  return hits;
}

// ── 신보 예외 검토: 강점 신호 카운트 ──
function koditExceptionSignals(profile: Profile): string[] {
  const found: string[] = [];
  if (profile.highCredit) found.push("고신용");
  if (profile.isCorp) found.push("법인사업자");
  if (profile.employeesIdx >= 2) found.push("직원 5명 이상");
  if (profile.growth) found.push("매출 성장세");
  if (profile.hasMajorClients) found.push("주요 거래처 보유");
  if (profile.hasTech || profile.hasCerts) found.push("인증·특허·연구소 보유");
  return found;
}

// ── agencyAdjustRules 의 자연어 조건을 프로필로 평가 ──
function adjustApplies(agencyKey: string, e: AdjustEntry, p: Profile): boolean {
  const c = e.condition;
  switch (agencyKey) {
    case "kibo":
      if (c.includes("기술·특허·연구소"))
        return (
          p.industryCategory === "제조" ||
          p.industryCategory === "IT/지식서비스" ||
          p.hasTech
        );
      if (c.includes("시설자금")) return p.facilityIntent;
      if (c.includes("매출 1억 미만")) return p.revenueEok < 1;
      if (c.includes("기술성 증빙")) return !p.hasPatent && !p.hasLab && !p.hasCerts && !p.hasVenture;
      return false;
    case "kosme":
      if (c.includes("제조/시설투자"))
        return (
          p.hasManufacturing ||
          p.facilityIntent ||
          p.growth ||
          p.hasEmploymentGrowth ||
          p.hasExport ||
          p.hasTech ||
          (p.isCorp && p.revenueEok >= 5)
        );
      if (c.includes("소액")) return p.smallFundOnly;
      return false;
    case "semas":
      if (c.includes("연매출 5억 미만")) return p.revenueEok < 5;
      if (c.includes("창업 초기"))
        return (
          p.input.years === "1년 미만" ||
          p.industryCategory === "음식/외식" ||
          p.industryCategory === "서비스" ||
          p.industryCategory === "도소매" ||
          p.employeesIdx <= 1
        );
      return false;
    case "regional":
      if (c.includes("연매출 5억 미만")) return p.revenueEok < 5;
      if (c.includes("저신용")) return p.lowCredit || p.heavySecondFinance || p.someSecondFinance;
      return false;
    case "misaeng":
      if (c.includes("저신용")) return p.lowCredit;
      if (c.includes("카드론")) return p.heavySecondFinance;
      if (c.includes("정상 신용")) return !p.lowCredit && p.revenueEok >= 5;
      return false;
    default:
      return false;
  }
}

interface Scored {
  rule: AgencyRule;
  score: number;
  reasons: string[];
  cautions: string[];
  exceptionalReview?: boolean;
  exceptionalNote?: string;
  deprioritizedReason?: string;
}

function scoreAgency(rule: AgencyRule, profile: Profile): Scored {
  let s = 50;
  const reasons: string[] = [];
  const cautions: string[] = [];
  let exceptionalReview = false;
  let exceptionalNote: string | undefined;
  let deprioritizedReason: string | undefined;

  if (industryFavored(rule, profile)) {
    s += 18;
    reasons.push(`${profile.industryCategory} 업종에 적합한 기관이에요.`);
  }
  if (purposeMatched(rule, profile)) {
    s += 14;
    reasons.push(`${profile.input.purpose} 목적과 맞는 자금이 있습니다.`);
  }
  const sa = strengthAligned(rule, profile);
  if (sa > 0) {
    s += sa * 6;
    reasons.push(
      `보유 강점(${profile.strengthKeywords.join("·")})이 이 기관 평가에 유리해요.`,
    );
  }

  // 일반 신용 보정
  if (profile.highCredit) s += 6;
  else if (!profile.lowCredit) s += 3;
  else s -= 6;

  // 저신용/영세 계층은 미소금융·지역재단·소진공 가점 (tier 문구 기반)
  if (
    profile.lowCredit &&
    /저신용|초저신용|소상공인|영세/.test(rule.tier)
  ) {
    s += 8;
    reasons.push("저신용·소상공인 계층 접근성이 좋은 기관이에요.");
  }

  const unf = unfavorableHits(rule, profile);
  s -= unf.length * 9;
  for (const u of unf.slice(0, 1)) cautions.push(u);

  // ── 9차 보정 1: 연매출 체급 티어 (신보) ──
  const tierRule = EXCLUSION.revenueTierRules.find(
    (r) => r.agencyKey === rule.key,
  );
  if (tierRule) {
    const tier = tierRule.tiers.find((t) => profile.revenueEok < t.maxEok);
    if (tier) {
      const signals = koditExceptionSignals(profile);
      const isException = signals.length >= tierRule.exception.minSignals;
      const penalty = isException ? Math.round(tier.penalty / 2) : tier.penalty;
      s -= penalty;
      if (isException) {
        exceptionalReview = true;
        exceptionalNote = `${tierRule.exception.label} — 강점(${signals.slice(0, 3).join("·")})이 많아 예외적으로 검토 가능하나 신중 접근이 필요합니다.`;
        cautions.unshift(tier.reason);
      } else {
        deprioritizedReason = tier.reason;
        cautions.unshift(tier.reason);
      }
    }
  }

  // ── 9차 보정 2: 기관별 가점/감점 (exclusion-rules) ──
  const adjust = EXCLUSION.agencyAdjustRules.find(
    (r) => r.agencyKey === rule.key,
  );
  if (adjust) {
    for (const b of adjust.boosts) {
      if (adjustApplies(rule.key, b, profile)) {
        s += b.score ?? 0;
        if (reasons.length < 3) reasons.push(b.reason);
      }
    }
    for (const c of adjust.cautions) {
      if (adjustApplies(rule.key, c, profile)) {
        s -= c.penalty ?? 0;
        cautions.push(c.reason);
        if (!deprioritizedReason) deprioritizedReason = c.reason;
      }
    }
  }

  // JSON 주의사항 보강
  for (const c of rule.cautions.slice(0, 2)) if (!cautions.includes(c)) cautions.push(c);
  if (reasons.length === 0) reasons.push(rule.consultingScript);

  return {
    rule,
    score: clamp(s),
    reasons: reasons.slice(0, 3),
    cautions: cautions.slice(0, 2),
    exceptionalReview,
    exceptionalNote,
    deprioritizedReason,
  };
}

// 핵심 6개 기관만 후보로 스코어링 (funding-agency-rules)
const CORE_KEYS = ["semas", "regional", "kodit", "kibo", "kosme", "misaeng"];

export interface AgencySelection {
  recommendations: AgencyRecommendation[];
  deprioritized: DeprioritizedAgency[];
}

export function selectAgencies(
  profile: Profile,
  kb: KnowledgeBase,
): AgencySelection {
  const candidates = kb.agencies.filter((a) => CORE_KEYS.includes(a.key));
  const scored = candidates
    .map((rule) => scoreAgency(rule, profile))
    .sort((a, b) => b.score - a.score);

  const top3 = scored.slice(0, 3);
  const rest = scored.slice(3);

  const recommendations: AgencyRecommendation[] = top3.map((x, idx) => ({
    rank: idx + 1,
    name: x.rule.name,
    score: x.score,
    reasons: x.reasons,
    cautions: x.cautions,
    ...(x.exceptionalReview
      ? { exceptionalReview: true, exceptionalNote: x.exceptionalNote }
      : {}),
  }));

  // 후순위/제외 사유: TOP3 밖으로 밀린 기관 중 명시적 사유가 있는 것 우선,
  // 없으면 기관 특성 기반의 일반 사유를 생성.
  const deprioritized: DeprioritizedAgency[] = rest
    .map((x) => ({
      name: x.rule.name,
      reason:
        x.deprioritizedReason ??
        genericDeprioritizedReason(x.rule, profile),
    }))
    .filter((d): d is DeprioritizedAgency => Boolean(d.reason));

  return { recommendations, deprioritized };
}

function genericDeprioritizedReason(
  rule: AgencyRule,
  profile: Profile,
): string | null {
  switch (rule.key) {
    case "kodit":
      return profile.revenueEok < 5
        ? "전년도 매출 5억 미만으로 기업 체급상 신보보다 지역신보·소진공이 현실적입니다."
        : "현재 조건에서는 상위 기관 대비 우선순위가 낮습니다.";
    case "kibo":
      return !profile.hasTech
        ? "기술성 증빙(특허·연구소·인증)이 부족해 기술평가 통과 가능성이 낮습니다."
        : "현재 조건에서는 상위 기관 대비 우선순위가 낮습니다.";
    case "kosme":
      return profile.smallFundOnly
        ? "소액 운전자금만 필요해 중진공 직접대출보다 소진공·지역신보가 빠릅니다."
        : !profile.facilityIntent && !profile.growth && !profile.hasManufacturing
          ? "시설투자·성장성 자료가 부족해 중진공 우선순위가 낮습니다."
          : "현재 조건에서는 상위 기관 대비 우선순위가 낮습니다.";
    case "misaeng":
      return !profile.lowCredit
        ? "정상 신용이라 미소금융보다 더 큰 기관이 유리합니다."
        : "현재 조건에서는 상위 기관 대비 우선순위가 낮습니다.";
    case "semas":
      return profile.revenueEok >= 10
        ? "매출 체급이 커서 소상공인 기관 한도로는 부족할 수 있습니다."
        : "현재 조건에서는 상위 기관 대비 우선순위가 낮습니다.";
    case "regional":
      return profile.revenueEok >= 10
        ? "규모가 커져 지역재단 소액 보증보다 신보·중진공이 적합합니다."
        : "현재 조건에서는 상위 기관 대비 우선순위가 낮습니다.";
    default:
      return null;
  }
}
