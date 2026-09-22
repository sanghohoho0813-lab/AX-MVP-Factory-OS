// Track Engine — 세부 자금 트랙(혁신성장촉진자금·스마트공장 등) 후보 판정.
// 트랙 정의·조건·멘트는 전부 knowledge/special-funding-tracks.json 에서 읽고,
// 엔진은 signals 키를 프로필로 평가해 가능성(높음/보통)과 근거를 조립한다.

import type { Profile } from "./knowledgeEngine";
import type { LikelihoodLevel, SpecialTrackCandidate } from "../types";
import tracksJson from "../knowledge/special-funding-tracks.json";

interface TrackDef {
  key: string;
  name: string;
  agencies: string[];
  recommendConditions: string[];
  signals: { all?: string[]; any?: string[]; boost?: string[] };
  checkQuestions: string[];
  requiredDocuments: string[];
  favorableIndustries: string[];
  cautions: string[];
  consultingScript: string;
}
const TRACKS = (tracksJson as unknown as { tracks: TrackDef[] }).tracks;

// signal 키 → 프로필 평가 (+근거 문구)
function evalSignal(key: string, p: Profile): { hit: boolean; reason?: string } {
  const industryText = (
    (p.input.actualBusiness ?? "") + (p.input.industry ?? "")
  ).toLowerCase();
  switch (key) {
    case "manufacturing":
      return { hit: p.hasManufacturing, reason: "제조업" };
    case "facilityIntent":
      return { hit: p.facilityIntent, reason: "시설투자(설비) 목적" };
    case "automation":
      return {
        hit:
          /자동화|로봇|키오스크|테이블오더|스마트/.test(industryText) ||
          (p.facilityIntent &&
            (p.input.facilityUse === "설비교체" ||
              p.input.facilityUse === "기계구입")),
        reason: "자동화·설비 도입",
      };
    case "onlineSales":
      return {
        hit:
          /온라인|쇼핑몰|커머스|플랫폼|스토어/.test(industryText) ||
          (p.industryCategory === "도소매" &&
            p.input.workingCapitalUse === "광고비") ||
          (p.industryCategory === "도소매" &&
            p.input.workingCapitalUse === "재고매입"),
        reason: "온라인 판매 기반",
      };
    case "itService":
      return { hit: p.industryCategory === "IT/지식서비스", reason: "IT·플랫폼 업종" };
    case "export":
      return { hit: p.hasExport, reason: "수출 실적·계획" };
    case "tech":
      return { hit: p.hasTech, reason: "기술·특허·연구소 보유" };
    case "youth":
      return { hit: p.isYouth, reason: "만 39세 이하 청년 대표" };
    case "earlyStage":
      return { hit: p.yearsIdx <= 1, reason: "창업 초기(3년 이내)" };
    case "womenCert":
      return {
        hit: (p.input.bonusItems ?? []).includes("여성기업"),
        reason: "여성기업 인증",
      };
    case "reliefHistory":
      return {
        hit:
          p.input.debtRelief === "신용회복" ||
          p.input.debtRelief === "회생" ||
          p.input.debtRelief === "파산",
        reason: "재기(신용회복·회생) 이력",
      };
    case "hiring":
      return { hit: p.hasEmploymentGrowth, reason: "채용 계획·고용 증가" };
    case "smallBiz":
      return {
        hit: p.revenueEok < 10 && p.employeesIdx <= 2,
        reason: "소상공인 규모",
      };
    case "growth":
      return { hit: p.growth, reason: "매출 성장세" };
    default:
      return { hit: false };
  }
}

export function detectSpecialTracks(profile: Profile): SpecialTrackCandidate[] {
  const out: SpecialTrackCandidate[] = [];

  for (const t of TRACKS) {
    const reasons: string[] = [];
    let ok = true;

    for (const k of t.signals.all ?? []) {
      const r = evalSignal(k, profile);
      if (!r.hit) {
        ok = false;
        break;
      }
      if (r.reason) reasons.push(r.reason);
    }
    if (!ok) continue;

    const anyList = t.signals.any ?? [];
    if (anyList.length > 0) {
      const hits = anyList
        .map((k) => evalSignal(k, profile))
        .filter((r) => r.hit);
      if (hits.length === 0) continue;
      for (const h of hits) if (h.reason && !reasons.includes(h.reason)) reasons.push(h.reason);
    }

    // boost 신호로 높음/보통 판정
    let boostHits = 0;
    for (const k of t.signals.boost ?? []) {
      const r = evalSignal(k, profile);
      if (r.hit) {
        boostHits += 1;
        if (r.reason && !reasons.includes(r.reason)) reasons.push(r.reason);
      }
    }
    // 업종 적합 추가 근거
    if (
      t.favorableIndustries.some(
        (f) => f === "전 업종" || f.includes(profile.industryCategory),
      )
    ) {
      boostHits += 1;
    }

    const level: LikelihoodLevel =
      reasons.length >= 2 || boostHits >= 1 ? "높음" : "보통";

    out.push({
      key: t.key,
      name: t.name,
      level,
      reasons: reasons.slice(0, 4),
      cautions: t.cautions.slice(0, 2),
      requiredDocuments: t.requiredDocuments.slice(0, 3),
      consultingScript: t.consultingScript,
    });
  }

  // 높음 먼저, 최대 5개
  return out
    .sort((a, b) => (a.level === b.level ? 0 : a.level === "높음" ? -1 : 1))
    .slice(0, 5);
}

export function trackCount(): number {
  return TRACKS.length;
}
