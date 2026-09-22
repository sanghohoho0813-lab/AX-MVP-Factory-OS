// Document Engine — 현재 입력을 보고 없는(요청해야 할) 자료를 자동 탐지.
// 자료 목록·필요 조건은 전부 knowledge/document-library.json 에서 읽는다.

import type { Profile } from "./knowledgeEngine";
import type { DocumentCheck } from "../types";
import libraryJson from "../knowledge/document-library.json";

interface DocDef {
  key: string;
  label: string;
  condition: string;
  haveHint: string | null;
}
const LIB = (libraryJson as unknown as { documents: DocDef[] }).documents;

// condition — 이 자료가 이 고객에게 필요한가?
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
      return p.input.majorClients !== "없음"; // 있음/미확인 → 확보 필요
    case "patent":
      return p.hasPatent;
    case "lab":
      return p.hasLab;
    case "certs":
      return p.hasCerts || p.hasVenture;
    case "corp":
      return p.isCorp;
    case "leased":
      return p.input.premises === "임차" || p.input.premises === "미확인";
    case "owned":
      return p.input.premises === "자가";
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
    default:
      return false;
  }
}

// haveHint — 입력만으로 '확보됨'을 추정할 수 있는가?
function isSecured(hint: string | null, p: Profile): boolean {
  if (!hint) return false;
  switch (hint) {
    case "assetEvidence":
      return p.input.assetEvidence === "있음";
    case "majorClients":
      return p.input.majorClients === "있음";
    case "patent":
      return p.hasPatent;
    case "lab":
      return p.hasLab;
    case "certs":
      return p.hasCerts;
    case "export":
      return p.hasExport;
    case "bizPlanReady":
      return p.input.bizPlanReadiness === "자료 충분";
    case "taxClear":
      return p.input.taxArrears === "없음" && p.input.insuranceArrears === "없음";
    case "quoteReady":
      return p.input.quoteReady === "있음";
    case "leaseReady":
      return p.input.leaseReady === "있음";
    case "salesEvidenceReady":
      return p.input.salesEvidenceReady === "있음";
    default:
      return false;
  }
}

export function checkDocuments(profile: Profile): DocumentCheck[] {
  const out: DocumentCheck[] = [];
  for (const d of LIB) {
    if (!isNeeded(d.condition, profile)) continue;
    const secured = isSecured(d.haveHint, profile);
    out.push({
      label: d.label,
      status: secured ? "확보" : "요청 필요",
      note:
        !secured && d.condition !== "always"
          ? "이 고객 조건에서 심사에 필요한 자료입니다."
          : undefined,
    });
  }
  // 요청 필요 항목이 먼저 보이게 정렬
  return out.sort((a, b) =>
    a.status === b.status ? 0 : a.status === "요청 필요" ? -1 : 1,
  );
}

export function documentLibraryCount(): number {
  return LIB.length;
}
