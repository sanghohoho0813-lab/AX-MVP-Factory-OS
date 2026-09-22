// Document Priority Engine — 고객 조건에 맞는 자료를 중요도 등급으로 묶는다.
// '무엇을 반드시 준비해야 하는가'를 document-priority.json 에서 조건 평가로 선별한다.

import type { Profile } from "./knowledgeEngine";
import type { DocPriorityItem } from "../types";
import priorityJson from "../knowledge/document-priority.json";

interface DocDef {
  key: string;
  label: string;
  tier: number;
  condition: string;
  why: string;
}
const DOCS = (priorityJson as unknown as { documents: DocDef[] }).documents;

// condition — 이 자료가 이 고객에게 필요한가? (documentEngine 과 동일 신호 + planCritical)
function isNeeded(condition: string, p: Profile): boolean {
  switch (condition) {
    case "always":
      return true;
    case "hasEmployees":
      return p.input.employees !== "0명";
    case "facility":
      return p.facilityIntent;
    case "manufacturingOrFacility":
      return p.hasManufacturing || p.facilityIntent;
    case "majorClients":
      return p.input.majorClients !== "없음";
    case "patent":
      return p.hasPatent;
    case "lab":
      return p.hasLab;
    case "certs":
      return p.hasCerts || p.hasVenture;
    case "leased":
      return p.input.premises === "임차" || p.input.premises === "미확인";
    case "advertising":
      return p.input.workingCapitalUse === "광고비";
    case "inventory":
      return p.input.workingCapitalUse === "재고매입";
    case "export":
      return p.hasExport;
    case "hasDebt":
      return (
        p.input.existingDebtLevel !== "없음" &&
        p.input.existingDebtLevel !== undefined
      );
    case "planCritical":
      // 사업계획서가 승인을 좌우하는 경우: 시설투자·기술평가·법인
      return p.facilityIntent || p.hasTech || p.isCorp;
    default:
      return false;
  }
}

export function getDocumentPriority(profile: Profile): DocPriorityItem[] {
  const out: DocPriorityItem[] = [];
  for (const d of DOCS) {
    if (!isNeeded(d.condition, profile)) continue;
    out.push({ label: d.label, tier: d.tier, why: d.why });
  }
  // 중요도(tier) 높은 순 정렬
  return out.sort((a, b) => b.tier - a.tier);
}

export function documentPriorityCount(): number {
  return DOCS.length;
}
