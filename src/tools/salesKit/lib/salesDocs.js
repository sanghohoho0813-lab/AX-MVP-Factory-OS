// 기업컨설팅 세일즈 OS(corp-consult-sales-os · src/App.jsx)의 문서·제안·계약 준비 규칙을 그대로 옮긴 것 (D-92).
// 방문용 리포트 · 제안서 초안 · 업무범위서/견적 · 제안 상태 · 계약 체크리스트 · 제안 우선순위 TOP3 ·
// 후속 카톡 · 1장 요약 · 녹취 분석 · 2차 미팅 자료 · 월납 시뮬레이션 · 로드맵 · 제안거리 연결 · 계약 준비팩.
// 문자열·숫자·순서를 바꾸지 않는다(각 줄 위에 원본 줄 번호). 바꾼 것은 하나 — 리포트 기본 이메일을 비웠다
// (대표 개인 주소가 번들에 들어가지 않게. 설정에서 적는다).
// 화면 상태를 바꾸던 함수(updateCust·addTodo·setProposalStatus 등)는 옮기지 않았다 — 저장은 화면이 moduleData 로 한다.
import {
  DEFAULT_PACKAGES,
  buildMeetingPlan,
  detectTheme,
  financeSignal,
  getCompanyName,
  missedConsultItems,
  recommendedStrategiesFor,
  safe,
  stageOf,
  todayISO,
} from "./salesData.js";

// 원본이 부르던 작은 도우미 (값 그대로)
const C = { ok: "#059669", warn: "#D97706", err: "#DC2626", textM: "#64748B", greenBg: "#E7F6EF", warnBg: "#FDF1E1", redBg: "#FDECEC" };
function money(n) {
  const v = Number(n) || 0;
  if (!v) return "-";
  if (Math.abs(v) >= 100000000) return (v / 100000000).toFixed(1).replace(".0", "") + "억원";
  if (Math.abs(v) >= 10000) return Math.round(v / 10000).toLocaleString() + "만원";
  return v.toLocaleString() + "원";
}
export function wonFromMillion(m) { return money((Number(m) || 0) * 1000000); }
function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
function sourceTag(rec) {
  if (rec && rec.fromLead) return { label: "신규 고객 발굴 전환" };
  if (rec && (rec.source === "manual" || rec.sample === false)) return { label: "직접 등록" };
  return { label: "직접 등록" };
}

// 원본 App.jsx 764줄
export function matchPackages(item, packages) {
  const strats = recommendedStrategiesFor(item);
  const out = []; const seen = new Set();
  for (const s of strats) { const pkg = packages.find((p) => p.strat === s.id && !seen.has(p.id)); if (pkg) { seen.add(pkg.id); out.push({ pkg, reason: recoReason(item, s) }); } if (out.length >= 3) break; }
  if (out.length < 3) { for (const pkg of packages) { if (!seen.has(pkg.id)) { seen.add(pkg.id); out.push({ pkg, reason: "고객 상황에 따라 검토 가능성이 있는 항목입니다." }); } if (out.length >= 3) break; } }
  return out;
}
// 원본 App.jsx 763줄
export function getPackages(data) { return (data && data.packages && data.packages.length) ? data.packages : DEFAULT_PACKAGES; }
// 원본 App.jsx 775줄
export function buildProposal(item, pkgs, mode, profile) {
  const p = profile || REPORT_PROFILE_DEFAULT;
  const name = getCompanyName(item) || item.name;
  const div = "━━━━━━━━━━━━━━━━";
  const dateK = todayISO().replace(/-/g, ".");
  const feeSum = pkgs.reduce((s, x) => s + (Number(x.fee) || 0), 0);
  const docs = Array.from(new Set(pkgs.flatMap((x) => x.docs || []))).slice(0, 12);
  const L = [];
  L.push(div, `[${name} 법인컨설팅 제안 초안]`, `작성일: ${dateK}`, `담당: ${p.consultant} ${p.title} · ${p.org}`, `구분: ${mode === "internal" ? "내부 검토용" : "대표님 공유용"}`, div, "");
  L.push("■ 고객 현황 요약", `${safe(item.industry, "-")} · 매출 ${wonFromMillion(item.revenue)} · 직원 ${safe(item.empCount, "-")}명 · 업력 ${safe(item.estYears, "-")}년 · 단계 ${stageOf(item.stage).label}`);
  if (item.concern) L.push(`주요 고민: ${item.concern}`);
  L.push("", "■ 현재 확인이 필요한 이슈", visitReasonText(item, mode), "");
  L.push("■ 제안 패키지");
  pkgs.forEach((x, i) => { L.push(`${i + 1}. ${x.name} (${x.cat})`, `   - 검토 내용: ${x.simple || x.point || consultDesc(x.name)}`); });
  { const br = bundleReason(pkgs.map((x) => x.name)); if (br) L.push(`   ※ 함께 검토 이유: ${br}`); }
  L.push("", "■ 진행 절차", "1) 자료 확인 → 2) 우선순위 정리 → 3) 진행 범위 정리 → 4) 실무 진행 (각 단계는 자료 확인 후 판단)", "");
  const mpl = monthlyPlanText(item, null, mode); if (mpl.length) { L.push(...mpl, ""); }
  L.push("■ 요청자료"); docs.forEach((d) => L.push(`☐ ${d}`));
  if (mode === "internal") { L.push("", "■ [내부] 영업·클로징 포인트", `· 영업 포인트: ${pkgs[0] ? pkgs[0].point : ""}`, "· 클로징: 우선 1개 패키지부터 단계적으로 진행 제안", "· 예상 반론: \"세무사 있어요 / 비용?\" → 검토 포인트 정리·단계적 범위 제안으로 대응", `· 다음 액션: ${item.nextAction || "자료 요청"}`); }
  else { L.push("", "■ 제안 금액 안내", "제안 금액은 월납 플랜 기준으로 협의 후 정리되며, 고객 재무상황을 확인한 뒤 조정될 수 있습니다."); }
  L.push("", "■ 다음 미팅 제안", "자료 확인 후 실제 적용 가능성이 있는 부분만 추려서 다시 정리드리겠습니다. 부담 없이 우선순위만 함께 확인하는 자리로 봐주시면 됩니다.", "");
  L.push("■ 주의", "적용 여부는 회사 자료 확인과 세무사·전문가 검토가 필요합니다. 본 문서는 제안 초안입니다.", div, `담당: ${p.consultant} ${p.title} · ${p.org}${p.phone ? ` · ${p.phone}` : ""}${p.email ? ` · ${p.email}` : ""}`, div);
  return L.join("\n");
}
// 원본 App.jsx 800줄
export const SCOPE_TEMPLATES = {
  rd: ["설립 가능성 사전 점검", "연구전담요원 요건 확인", "조직도/도면/연구공간 요건 점검", "설립신고 서류 준비 지원", "보완 요청 대응 범위 안내"],
  charter: ["현 정관 주요 조항 검토", "임원퇴직금 규정 관련 조항 점검", "주식/배당/이익소각 관련 조항 확인", "세무사/법무사 검토 필요사항 정리"],
  succession: ["주주구성 확인", "주식가치 변동 가능성 점검", "자녀 근무/임원 여부 확인", "승계 관련 세무 이슈 사전 정리", "전문가 검토 필요사항 정리"],
  suspense: ["가지급금 발생 원인 확인", "인정이자/세무 리스크 가능성 점검", "정관/임원보수/퇴직금 규정 연계 검토", "정리 가능 구조 후보 정리"],
  gasugeum: ["가수금 발생 원인 확인", "재무구조 영향 점검", "출자전환/정리 구조 후보 정리", "세무 리스크 가능성 점검"],
  venture: ["인증 유형 적합성 점검", "기술성/사업성 관련 자료 검토", "신청 요건 정리", "사후관리 유의사항 안내"],
  mainbiz: ["인증 유형 적합성 점검", "평가지표 충족 여부 점검", "신청 준비 자료 정리"],
  policyfund: ["재무/신용 상태 점검", "적합 자금 후보 정리", "보완 항목 정리", "신청 절차 안내"],
  employ: ["채용 계획/순서 점검", "지원금 유형 적합성 확인", "노무 서류 점검", "신청 순서 정리"],
  execretire: ["임원퇴직금 규정 점검", "정관 위임 근거 확인", "지급 한도/근거 정리", "재원 마련 방안 검토"],
  welfare: ["복지 현황/장기근속 점검", "기금 목적/집행 기준 검토", "비용처리 관점 정리", "노무/세무 검토 필요사항 정리"],
  stockvalue: ["재무제표 기반 가치 산정", "주주구성/지분 확인", "평가 방법/시점 검토", "증여/이동 영향 정리"],
  profitcancel: ["미처분이익잉여금 규모 확인", "자기주식 취득/소각 검토", "정관 근거 확인", "절차/세무 영향 정리"],
  corpinsure: ["퇴직금 재원 현황 점검", "임원퇴직금 규정 연계 검토", "자금 운용 관점 정리", "기존 보험 점검"],
};
// 원본 App.jsx 816줄
export const PKG_DURATION = { rd: "2~4주", venture: "4~8주", mainbiz: "4~8주", policyfund: "2~6주", employ: "2~4주", charter: "1~3주", execretire: "1~3주", suspense: "2~6주", gasugeum: "2~6주", welfare: "4~8주", succession: "4~8주", stockvalue: "1~3주", profitcancel: "2~6주", corpinsure: "2~4주" };
// 원본 App.jsx 817줄
export const SCOPE_EXCLUDED = ["세무 신고 대리 업무는 별도 협의", "법무 등기 대행은 별도 협의", "노무 자문 및 신고 대행은 별도 협의", "정책자금 승인 또는 인증 결과를 보장하지 않음", "자료 미제공 또는 요건 미충족 시 진행 범위가 조정될 수 있음"];
// 원본 App.jsx 818줄
export function scopeItems(pkg) { return SCOPE_TEMPLATES[pkg.strat] || (pkg.docs || []).map((d) => `${d} 확인`) || ["현황 점검", "자료 확인", "우선순위 정리"]; }
// 원본 App.jsx 819줄
export function pkgDuration(pkg) { return PKG_DURATION[pkg.strat] || "2~6주"; }
// 원본 App.jsx 820줄
export function buildScopeDoc(item, pkg, profile) {
  const p = profile || REPORT_PROFILE_DEFAULT;
  const name = getCompanyName(item) || item.name;
  const div = "━━━━━━━━━━━━━━━━";
  const items = scopeItems(pkg);
  const L = [];
  L.push(div, "[업무범위서 초안]", `고객사: ${name}`, `제안 항목: ${pkg.name}`, `예상 진행 기간: ${pkgDuration(pkg)}`, `제안 금액: 월납 플랜 기준으로 협의 후 정리`, `작성일: ${todayISO().replace(/-/g, ".")} · ${p.consultant} ${p.title}`, div, "");
  L.push("[업무 범위]");
  items.forEach((x, i) => L.push(`${i + 1}. ${x}`));
  L.push("", "[별도 협의 범위]");
  SCOPE_EXCLUDED.forEach((x) => L.push(`· ${x}`));
  L.push("", "[고객 준비자료]");
  (pkg.docs || []).forEach((d) => L.push(`☐ ${d}`));
  L.push("", "[진행 절차]", "1) 자료 확인 → 2) 우선순위 정리 → 3) 진행 범위 정리 → 4) 실무 진행 (각 단계는 자료 확인 후 판단)");
  const mpl = monthlyPlanText(item, null, "internal"); if (mpl.length) { L.push("", ...mpl); }
  L.push("", "[확인이 필요한 사항]", `${pkg.caution || "적용 여부는 세부 요건 확인 필요, 세무사 검토 권장"}`);
  L.push("", "[주의사항]", "본 내용은 업무범위 초안이며, 실제 진행 범위와 수임료는 자료 확인 및 협의 후 조정될 수 있습니다. 예상 진행 기간은 자료 준비 상황과 검토 범위에 따라 달라질 수 있습니다.", div);
  return L.join("\n");
}
// 원본 App.jsx 839줄
export function buildQuoteText(item, pkg) {
  const name = getCompanyName(item) || item.name;
  const mo = Number(item.proposalMonthlyPremium) || 0;
  const feeLine = mo > 0 ? `· 제안 기준: 월납 ${manToText(mo)} (${Number(item.proposalMonths) || 84}개월 기준, 협의 후 정리)` : `· 제안 금액: 월납 플랜 기준으로 협의 후 정리`;
  return `대표님, ${name} 기준 ${pkg.name} 예상 진행안을 정리해 드립니다.\n· 예상 진행 기간: ${pkgDuration(pkg)} (자료 준비 상황에 따라 조정)\n${feeLine}\n실제 진행 범위와 금액은 자료 확인 및 협의 후 조정될 수 있습니다.`;
}
// 원본 App.jsx 845줄
export function scopeKakaoSet(item, pkg) {
  const name = getCompanyName(item) || item.name;
  return [
    ["업무범위서 전달", `대표님, 말씀 나눈 ${pkg.name} 기준으로 업무범위 초안을 정리해 보내드립니다. 실제 진행 범위와 수임료는 자료 확인 및 협의 후 조정될 수 있으니, 편하게 보시고 궁금한 부분만 말씀 주세요.`],
    ["견적 확인 요청", `대표님, 보내드린 업무범위 기준 제안 금액은 월납 플랜 기준으로 정리해 드릴 수 있습니다. 다만 자료 범위와 현금흐름에 따라 달라질 수 있어, 우선 자료만 확인한 뒤 범위를 같이 정리해보면 좋겠습니다.`],
    ["검토 후 미팅 제안", `대표님, 업무범위 초안 검토하시고 한 번 짧게 정리해서 설명드리면 좋을 것 같습니다. 부담 없이 우선순위와 범위만 같이 확인하는 자리로 봐주시면 됩니다.`],
    ["보류 고객 재연락", `대표님, 지난번 말씀 주셨던 ${pkg.name} 건은 지금 당장이 아니어도 괜찮습니다. 다만 자료 확인이 늦어지면 선택지가 줄어들 수 있어, 시간 되실 때 현황만 가볍게 점검해두시길 권드립니다.`],
    ["계약 전 최종 확인", `대표님, 진행 전에 업무 범위·제외 범위·예상 수임료·필요 자료를 다시 한 번 정리해 확인 부탁드립니다. 협의 후 정리되면 바로 착수 일정 잡아 진행하겠습니다.`],
  ];
}
// 원본 App.jsx 856줄
export const PROPOSAL_STATES = ["제안 전", "제안서 작성", "제안 완료", "견적 전달", "검토 중", "조건 조율", "계약 예정", "계약 완료", "보류"];
// 원본 App.jsx 868줄
export const CONTRACT_CHECKLIST = ["고객사 기본정보 확인", "담당자/대표 연락처 확인", "제안 범위 확인", "예상 수임료 확인", "제외 업무 설명 완료", "필요자료 목록 전달", "세무사/전문가 검토 필요사항 안내", "계약서 또는 업무범위서 발송", "착수금/입금 조건 협의", "다음 미팅 일정 정리"];
// 원본 App.jsx 870줄
export function recoReason(item, s) {
  const bits = [];
  if (Number(item?.ceoAge) >= 55) bits.push(`대표 ${item.ceoAge}세`);
  if (Number(item?.estYears) >= 10) bits.push(`업력 ${item.estYears}년`);
  if (Number(item?.empCount) >= 20) bits.push(`직원 ${item.empCount}명`);
  const its = (item?.interests || []).filter((i) => s.fields.includes(i));
  if (its.length) bits.push(`${its.join("·")} 관심`);
  return (bits.length ? bits.join(", ") + " → " : "") + `${s.name} 검토 가능성(자료 확인 후 판단)`;
}
// 원본 App.jsx 879줄
export function topRecommendations(item) {
  return recommendedStrategiesFor(item).slice(0, 3).map((s) => ({
    name: s.name, reason: recoReason(item, s), docs: s.docs.slice(0, 4),
    risk: s.risk, pitch: s.pitch, needTaxPro: s.needTaxPro,
  }));
}
// 원본 App.jsx 886줄
export function buildKakaoSet(item) {
  const main = recommendedStrategiesFor(item)[0];
  const docs = main.docs.slice(0, 3).join(", ");
  return [
    ["1차 연락용", `대표님, 안녕하세요. ${safe(item.industry, "법인")} 대표님들 중에 ${main.name} 쪽을 미리 점검해두면 도움이 되는 경우가 많아 연락드렸습니다. 바로 무언가를 결정하시는 자리가 아니라 현재 상황만 짧게 확인드리는 자리로 봐주시면 됩니다.`],
    ["자료 요청용", `대표님, 말씀 주신 부분을 정확히 보려면 ${docs} 정도를 먼저 확인하면 좋겠습니다. 보내주시면 자료 확인 후 적용 가능성과 우선 점검이 필요한 항목만 추려서 정리드리겠습니다. (적용 여부는 세부 요건 확인이 필요합니다.)`],
    ["미팅 후 정리용", `대표님, 오늘 말씀 나눈 내용 기준으로 보면 바로 결론을 내리기보다 먼저 ${docs} 쪽을 같이 확인해보는 게 좋을 것 같습니다. 자료 확인 후 실제 적용 가능성이 있는 부분만 추려 다시 정리드리겠습니다. (세무사 검토가 필요한 부분은 함께 안내드리겠습니다.)`],
  ];
}
// 원본 App.jsx 895줄
export function buildDocRequestText(item) {
  const main = recommendedStrategiesFor(item)[0];
  const name = getCompanyName(item) || item.name;
  return `대표님, ${name} 관련 ${main.name} 검토를 위해 ${main.docs.join(", ")} 정도를 확인하면 좋겠습니다. 자료 확인 후 적용 가능성과 우선 점검이 필요한 항목을 정리드리겠습니다. (적용 여부는 세부 요건 확인이 필요합니다.)`;
}
// 원본 App.jsx 901줄
export function buildMeetingReport(item) {
  const name = getCompanyName(item) || item.name;
  const m1 = buildMeetingPlan(item, "m1");
  const recos = topRecommendations(item);
  return [
    `[${name} 미팅 준비 리포트]`, "",
    `■ 고객 현황: ${safe(item.industry, "-")} · 매출 ${wonFromMillion(item.revenue)} · 직원 ${safe(item.empCount, "-")}명 · 업력 ${safe(item.estYears, "-")}년 · 대표 ${safe(item.ceoAge, "-")}세`,
    `■ 오늘 미팅 목표: ${m1.goal}`,
    `■ 첫 질문: ${m1.questions[0]}`,
    `■ 핵심 확인자료: ${m1.docs.slice(0, 5).join(", ")}`,
    `■ 제안 우선순위 TOP3: ${recos.map((r, i) => `${i + 1}) ${r.name}`).join(" / ")}`,
    `■ 말하면 안 되는 단정 표현: 효과·수급·인증을 단정하지 말 것 → "검토 가능성 · 자료 확인 후 판단 · 세무사 검토 권장"으로 표현`, "",
    `[미팅 후 카톡]`, buildKakaoSet(item)[2][1],
  ].join("\n");
}
// 원본 App.jsx 930줄
export const NEXT_ACTIONS = ["자료 요청", "1차 미팅 제안", "2차 미팅 준비", "세무사 검토 연결", "보류/장기관리"];
// 원본 App.jsx 931줄
export const TODO_KINDS = ["1차 연락", "자료 요청", "미팅 준비", "후속 카톡", "세무사 검토 연결", "제안서/리포트 발송", "기타"];
// 원본 App.jsx 932줄
export const CONTACT_TYPES = ["전화", "카톡", "방문 미팅", "자료 요청", "자료 수령", "제안서 발송", "기타"];
// 원본 App.jsx 964줄
export function followUpKakao(item) {
  const theme = detectTheme(item);
  const map = {
    succession: "지난번 말씀 나눈 주식가치·승계 쪽은 시간이 지날수록 선택지가 줄어들 수 있어, 자료 확인 후 검토 가능성이 있는 부분만 정리드리려고 연락드렸습니다.",
    rd: "지난번 말씀 주신 연구개발·인증 쪽은 자료를 보면 적용 가능성을 함께 판단해볼 수 있어, 관련 자료를 한 번 확인해보면 좋겠습니다.",
    suspense: "지난번 재무제표상 가지급금·정관 쪽은 우선 점검이 필요한 부분이라, 자료 확인 후 정리 방향만 같이 보면 좋겠습니다. (세무사 검토 권장 부분은 함께 안내드리겠습니다.)",
    employment: "지난번 말씀 주신 채용·고용지원 쪽은 신청 순서가 중요해, 입사 예정일 등 일정만 먼저 확인해보면 좋겠습니다.",
    welfare: "지난번 말씀 주신 직원 복지·복지기금 쪽은 자료를 보면 제도화 방향을 같이 볼 수 있어, 관련 내용을 한 번 확인해보면 좋겠습니다.",
    charter: "지난번 정관·임원보수 쪽은 비용처리한 금액을 지키는 방어장치 관점에서 우선 점검이 필요해, 정관 등 자료를 한 번 확인해보면 좋겠습니다.",
  };
  const body = map[theme] || "지난번 말씀 나눈 내용 기준으로 자료 확인이 필요했던 부분이 있어 연락드렸습니다.";
  return `대표님, ${body} 급하게 결정하실 내용은 아니고, 자료 확인 후 검토 가능성이 있는 부분만 정리드리겠습니다.`;
}
// 원본 App.jsx 984줄
export function currentIssueSummary(item) {
  const main = recommendedStrategiesFor(item)[0];
  const facts = [];
  if (Number(item.ceoAge) >= 55) facts.push(`대표 ${item.ceoAge}세`);
  if (Number(item.estYears) >= 10) facts.push(`업력 ${item.estYears}년`);
  if (Number(item.empCount) >= 20) facts.push(`직원 ${item.empCount}명`);
  const f = facts.length ? facts.join("·") + " 기준, " : "";
  const concern = item.concern ? ` 대표 고민(${item.concern})과 연결됩니다.` : "";
  return `${f}${main.name}이(가) 우선 점검 포인트로 보입니다.${concern} 단정하기보다 자료 확인 후 검토 가능성을 판단하는 흐름을 권합니다.`;
}
// 원본 App.jsx 995줄
export const REPORT_PROFILE_DEFAULT = { consultant: "김팀장", org: "기업컨설팅 세일즈 OS", title: "컨설턴트", phone: "", email: "", footer: "본 리포트는 상담 전 사전 점검용 자료이며, 실제 적용 여부는 회사의 세부 자료 확인과 세무사·노무사·전문가 검토가 필요합니다." };
// 원본 App.jsx 996줄
export function getReportProfile(data) { return { ...REPORT_PROFILE_DEFAULT, ...(data && data.reportProfile ? data.reportProfile : {}) }; }
// 원본 App.jsx 997줄
export const VISIT_BASE_DOCS = ["재무제표(최근 3개년)", "법인등기부등본", "사업자등록증", "정관", "주주명부", "4대보험 사업장 가입자명부", "대출/보증 내역"];
// 원본 App.jsx 998줄
export const EXTRA_CHECK_MAP = { "정관정비": "정관·임원보수 규정", "임원퇴직금": "임원퇴직금 규정", "가지급금": "가지급금/가수금 정리", "연구소": "기업부설연구소/벤처", "벤처인증": "벤처·이노비즈 인증", "고용지원금": "고용지원금/통합고용세액공제", "법인세": "연구·인력개발비 세액공제", "정책자금": "정책자금", "사내근로복지기금": "사내근로복지기금", "가업승계": "가업승계/주식가치평가", "미처분이익잉여금": "미처분이익잉여금/이익소각", "주식이동": "주식가치평가" };
// 원본 App.jsx 999줄
export function extraCheckItems(item) {
  const out = [];
  (item.interests || []).forEach((i) => { const v = EXTRA_CHECK_MAP[i]; if (v && !out.includes(v)) out.push(v); });
  ["정관·임원보수 규정", "가지급금/가수금 정리", "기업부설연구소/벤처"].forEach((v) => { if (out.length < 3 && !out.includes(v)) out.push(v); });
  return out.slice(0, 6);
}
// 원본 App.jsx 1005줄
export function visitRequestDocs(item) {
  const recoDocs = topRecommendations(item).flatMap((r) => r.docs);
  return Array.from(new Set([...VISIT_BASE_DOCS, ...recoDocs])).slice(0, 12);
}
// 원본 App.jsx 1009줄
export function visitReasonText(item, mode) {
  const main = recommendedStrategiesFor(item)[0];
  const facts = [];
  if (Number(item.ceoAge) >= 55) facts.push(`대표님 연령(${item.ceoAge}세)`);
  if (Number(item.estYears) >= 10) facts.push(`업력 ${item.estYears}년`);
  if (Number(item.empCount) >= 20) facts.push(`직원 ${item.empCount}명 규모`);
  const f = facts.join(", ");
  if (mode === "internal") return `${f ? f + " 기준, " : ""}${main.name} 접근 가능성이 있어 보입니다.${item.concern ? ` 대표 고민(${item.concern})과 연결됩니다.` : ""} 우선 점검 후보로 잡고, 자료 확인 후 적용 가능성과 리스크를 구분해 판단하는 흐름을 권합니다.`;
  return `${f ? f + " 등을 보면, " : "대표님 회사 상황을 보면, "}${main.name} 쪽은 시간이 지날수록 선택지가 줄어들 수 있는 부분이라 지금 한 번 가볍게 점검해두시면 좋습니다. 지금 무엇을 결정하시는 자리가 아니라, 혹시 놓치고 있을 수 있는 부분만 함께 확인해보는 자리로 편하게 봐주시면 됩니다.`;
}
// 원본 App.jsx 1019줄
export function buildVisitKakaoSet(item) {
  const docs = recommendedStrategiesFor(item)[0].docs.slice(0, 3).join(", ");
  return [
    ["1차 상담 후 자료 요청", `대표님, 오늘 시간 내주셔서 감사합니다. 말씀 주신 내용을 좀 더 정확히 보려면 ${docs} 정도를 먼저 확인해보면 좋을 것 같습니다. 편하실 때 보내주시면, 자료 확인 후 우선 점검이 필요한 부분만 추려서 정리해 드리겠습니다.`],
    ["자료 수령 후 검토 안내", `대표님, 자료 잘 받았습니다. 바로 결론을 내리기보다 내용을 차분히 살펴본 뒤, 실제 검토 가능성이 있는 항목만 추려서 다시 정리해 연락드리겠습니다. 세무사 검토가 필요한 부분은 따로 표시해서 함께 안내드리겠습니다.`],
    ["검토 후 2차 미팅 제안", `대표님, 검토한 내용을 한 번 정리해서 보여드리면 좋을 것 같습니다. 부담 없이 현재 상황과 우선순위만 같이 확인하는 자리로, 편하신 시간에 30분 정도만 잡아주시면 정리해서 설명드리겠습니다.`],
  ];
}
// 원본 App.jsx 1027줄
export function buildVisitReport(item, mode, profile) {
  const p = profile || REPORT_PROFILE_DEFAULT;
  const name = getCompanyName(item) || item.name;
  const recos = topRecommendations(item);
  const div = "━━━━━━━━━━━━━━━━";
  const dateK = todayISO().replace(/-/g, ".");
  const L = [];
  L.push(div, "[법인컨설팅 사전 점검 리포트]", `고객사: ${name}`, `작성일: ${dateK}`, `담당: ${p.consultant} ${p.title} · ${p.org}`, `구분: ${mode === "internal" ? "내부 검토용" : "대표님 공유용"}`, div, "");
  L.push("■ 회사 현황 요약", `${safe(item.industry, "-")} · 매출 ${wonFromMillion(item.revenue)} · 직원 ${safe(item.empCount, "-")}명 · 업력 ${safe(item.estYears, "-")}년 · 상담 단계 ${stageOf(item.stage).label}`);
  if (item.concern) L.push(`주요 고민: ${item.concern}`);
  if (item.financialSummary) {
    const fs = item.financialSummary;
    if (mode === "internal") {
      L.push("", "■ [내부] 재무자료 1차 분석(추출 후보 · 확정 아님)");
      if ((fs.numbers || []).length) L.push("· 주요 숫자: " + fs.numbers.map((n) => `${n.label} ${n.display}`).join(" · "));
      if ((fs.highlights || []).length) L.push("· 눈에 띄는 항목: " + fs.highlights.join(" · "));
      (fs.reviewCandidates || []).slice(0, 4).forEach((r) => L.push("· 검토 후보: " + r));
    } else {
      L.push("", "■ 재무자료 참고", "제공된 자료 기준으로 일부 재무 항목은 추가 확인해보면 좋겠습니다. 실제 적용 여부는 재무제표 원본과 세부 계정 확인 후 판단이 필요합니다.");
    }
  }
  L.push("", "■ 지금 점검이 필요한 이유", visitReasonText(item, mode), "");
  L.push("■ 우선 검토 후보 TOP 3");
  recos.forEach((r, i) => { L.push(`${i + 1}. ${r.name}`, `   · 점검 포인트: ${mode === "internal" ? r.reason : "대표님 상황에서 한 번 확인해보면 좋은 부분입니다."}`, `   · 필요 자료: ${r.docs.join(", ")}`, `   · 유의: ${r.risk}`); });
  if (mode === "internal") {
    L.push("", "■ [내부] 영업 포인트 · 리스크 · 다음 액션", `· 핵심 영업 포인트: ${recos[0].name} 중심${recos.length > 1 ? ` → ${recos.slice(1).map((r) => r.name).join(" / ")} 확장` : ""}`, `· 예상 리스크: ${recos[0].risk}`, `· 조심할 표현: 효과·수급·인증을 단정하지 말 것 → "검토 가능성 · 자료 확인 후 판단 · 세무사 검토 권장"으로`, `· 다음 액션: ${item.nextAction || "자료 요청"} → 자료 확인 후 2차 미팅 제안`);
  }
  L.push("", "■ 추가로 확인하면 좋은 항목", extraCheckItems(item).join(", "), "");
  L.push("■ 요청 자료 체크리스트");
  visitRequestDocs(item).forEach((d) => L.push(`☐ ${d}`));
  L.push("", "■ 다음 미팅 제안", "자료 확인 후 실제 적용 가능성이 있는 부분만 추려서 다시 정리드리겠습니다. 부담 없이 현재 상황과 우선순위만 함께 확인하는 자리로 봐주시면 됩니다.", "");
  L.push(div, `담당: ${p.consultant} ${p.title} · ${p.org}`);
  if (p.phone) L.push(`연락처: ${p.phone}`);
  if (p.email) L.push(`이메일: ${p.email}`);
  L.push("", `※ ${p.footer}`, div);
  return L.join("\n");
}
// 원본 App.jsx 1064줄
export function customerShareSummary(item, profile) {
  const p = profile || REPORT_PROFILE_DEFAULT;
  const name = getCompanyName(item) || item.name;
  const recos = topRecommendations(item).map((r) => r.name).join(", ");
  return `${name} 대표님, 오늘 말씀 나눈 내용 기준으로 사전 점검 포인트를 짧게 정리해 드립니다.\n\n먼저 확인해보면 좋을 항목: ${recos}\n\n바로 결론을 내리기보다 재무제표·정관 등 자료를 먼저 함께 확인한 뒤, 실제 검토 가능성이 있는 부분만 추려서 다시 정리드리겠습니다. 적용 여부는 세부 요건 확인과 세무사 검토가 필요합니다.\n\n${p.consultant} ${p.title} · ${p.org}${p.phone ? "\n" + p.phone : ""}`;
}
// 원본 App.jsx 1120줄
export const DB_SOURCES = ["회사 제공 DB", "사업단 제공 DB", "온라인 광고 DB", "기존 고객 소개", "지인 소개", "세미나/교육 유입", "콘텐츠 유입", "직접 발굴", "기타"];
// 원본 App.jsx 1122줄
export const DEAL_RESULTS = ["미정", "계약", "보류", "거절", "장기관리"];
// 원본 App.jsx 1125줄
export const REQUIRED_DOCS = ["사업자등록증", "법인등기부등본", "정관", "주주명부", "4대보험 사업장 가입자명부", "재무제표", "부가세 신고서", "법인세 신고서", "계정별원장", "급여대장", "근로계약서", "임원명부", "특허/인증 서류", "대출/보증 내역"];
// 원본 App.jsx 1126줄
export const DOC_STATUSES = ["미요청", "요청완료", "수령완료", "보완필요"];
// 원본 App.jsx 1128줄
export const CONSULT_ITEMS = ["기업부설연구소", "연구소 사후관리", "연구인력개발비 세액공제", "벤처기업 인증", "메인비즈/이노비즈", "정책자금", "고용지원금", "통합고용세액공제", "정관정비", "임원퇴직금 규정", "가지급금 정리", "가수금 출자전환", "사내근로복지기금", "가업승계", "주식가치평가", "이익소각", "법인보험/대표 퇴직금 플랜", "특허/상표 지식재산", "홈페이지/브랜딩/마케팅", "정부지원사업/바우처"];
// 원본 App.jsx 1129줄
export const MANAGE_MSG_KINDS = ["최근 제도/공고 이슈 공유", "세액공제/고용지원금 점검 안내", "정관/임원퇴직금 점검 안내", "정책자금/인증 이슈 공유", "가벼운 안부/자료 공유", "재미팅 제안"];
// 원본 App.jsx 1130줄
export function manToText(man) { const m = Math.round(Number(man) || 0); const won = m * 10000; if (won >= 1e8) { const eok = Math.floor(won / 1e8); const rest = Math.round((won % 1e8) / 1e4); return `${eok}억${rest ? " " + rest.toLocaleString() + "만원" : "원"}`; } return m.toLocaleString() + "만원"; }
// 원본 App.jsx 1167줄
export function buildOnePager(item, profile) {
  const p = profile || REPORT_PROFILE_DEFAULT; const name = getCompanyName(item) || item.name;
  const sig = financeSignal(item); const fs = item.financialSummary; const L = [];
  L.push(`[${name} · 1차 미팅 한 장 요약]`, `${todayISO().replace(/-/g, ".")} · 담당 ${p.consultant} ${p.title}`, "");
  L.push("■ 업체 기본정보", `${safe(item.industry, "-")} · 매출 ${wonFromMillion(item.revenue)} · 직원 ${safe(item.empCount, "-")}명 · 업력 ${safe(item.estYears, "-")}년 · 대표 ${safe(item.ceoAge, "-")}세`, `유입경로: ${item.dbSource || sourceTag(item).label}${item.homepage ? ` · ${item.homepage}` : ""}`, "");
  L.push(`■ 재무 신호등: ${sig.label}`); sig.reasons.forEach((r) => L.push(`· ${r}`)); L.push(`· 접근 방향: ${sig.advice}`, "");
  if (fs && (fs.numbers || []).length) L.push("■ 재무요약(추출 후보 · 확정 아님)", fs.numbers.map((n) => `${n.label} ${n.display}`).join(" · "), "");
  const pts = [];
  if (item.flags?.gajigeup || item.flags?.gasugeum) pts.push("회사 돈이 대표 쪽으로 빠진 구조(가지급금/가수금) 정리 필요성 점검 필요");
  if ((item.interests || []).includes("미처분이익잉여금")) pts.push("회사는 이익이 쌓이는데 대표가 가져가는 구조·승계 부담은 점검이 필요해 보임");
  if (item.flags?.corpTaxBurden) pts.push("세금이 빠지는 구조 — 비용·공제·정관/임원퇴직금 점검 필요");
  if (item.flags?.rndStaff || item.flags?.venture || item.flags?.patent) pts.push("외부자금·세액공제·인증(연구소/벤처/특허) 기회 누락 가능성 점검 필요");
  if (item.flags?.hiring || item.flags?.employSubsidy) pts.push("고용지원금·통합고용세액공제 점검 필요");
  if (!pts.length) pts.push("재무제표 원본과 주요 계정 세부내역을 우선 확인할 필요가 있어 보임");
  L.push("■ 1차 문제제기 포인트(점검 가능성)"); pts.forEach((x) => L.push(`· ${x}`)); L.push("");
  const miss = missedConsultItems(item); if (miss.length) L.push("■ 놓치기 쉬운 점검 항목", miss.join(", "), "");
  L.push("■ 방치 시 생길 수 있는 부담(추정)", "· 법인세 부담 증가 가능성", "· 대표 개인 현금흐름 부담 가능성", "· 주식가치 상승에 따른 승계 부담 가능성", "· 가지급금/가수금 정리 부담 누적 가능성", "· 자금조달·고용/세액공제 기회 상실 가능성", "");
  L.push("■ 미팅에서 꺼낼 핵심 질문"); buildMeetingPlan(item, "m1").questions.slice(0, 5).forEach((q, i) => L.push(`${i + 1}) ${q}`)); L.push("");
  L.push("■ 오늘 제안할 컨설팅 후보 TOP 5"); recommendedStrategiesFor(item).slice(0, 5).forEach((s, i) => L.push(`${i + 1}. ${s.name}`)); L.push("");
  L.push("■ 대표님께 던질 한 문장", "대표님, 사업으로 버신 이익을 제대로 남기고 회사 성장 기회를 놓치지 않으시려면 지금 구조를 한 번 점검해볼 시점으로 보입니다. (단정이 아니라 자료 확인 후 함께 판단하는 자리로 봐주시면 됩니다.)", "");
  L.push("■ 다음 단계", "1차 미팅에서 위 항목 확인 → 필요자료 수령 → 2차 미팅에서 자료 기반 점검 결과·로드맵 공유");
  return L.join("\n");
}
// 원본 App.jsx 1191줄
export function analyzeTranscript(text) {
  const t = (text || "").replace(/\s+/g, " ");
  const TOPIC = [["가지급금", /가지급금/], ["가수금", /가수금/], ["미처분이익잉여금", /이익잉여금|잉여금/], ["가업승계", /승계|가업/], ["정관정비", /정관/], ["임원퇴직금", /퇴직금/], ["연구소/세액공제", /연구소|연구개발|세액공제|개발인력/], ["벤처/인증", /벤처|이노비즈|인증/], ["정책자금", /정책자금|운전자금|시설자금/], ["고용지원금", /고용|채용|지원금/], ["법인보험", /보험/], ["특허/상표", /특허|상표/]];
  const issues = TOPIC.filter(([, re]) => re.test(t)).map(([n]) => n);
  const interested = issues.filter(() => /관심|좋|해보|진행|하고\s*싶|필요하겠|궁금/.test(t));
  const hesitant = [];
  if (/부담|비싸|비용|수임료/.test(t)) hesitant.push("비용/수임료 부담");
  if (/세무사|상의|가족|배우자|와이프/.test(t)) hesitant.push("가족/세무사 상의 필요");
  if (/나중|다음에|시간|바쁘|급하지/.test(t)) hesitant.push("시급성·타이밍");
  if (/믿|신뢰|글쎄|모르겠/.test(t)) hesitant.push("신뢰 형성 단계");
  let reaction = "보통 반응 추정";
  if (/긍정|좋|관심|해보|진행/.test(t) && !/부담|비싸/.test(t)) reaction = "긍정적 반응 추정";
  if (/부담|비싸|곤란|어렵|글쎄|고민|상의/.test(t)) reaction = "신중·부담 반응 추정";
  const newInfo = (t.match(/지분\s*[0-9]+\s*%|주주\s*[0-9]+|자녀\s*[0-9]*\s*명?|배우자|매출\s*[0-9,]+|직원\s*[0-9]+\s*명/g) || []).slice(0, 6);
  const summary = `미팅에서 ${issues.slice(0, 4).join(", ") || "주요 주제"} 등이 언급되었고, 대표 반응은 ${reaction}으로 보입니다. (텍스트 기반 추정이며 실제 맥락은 추가 확인 필요)`;
  const secondPoints = Array.from(new Set([...interested, ...issues])).slice(0, 5).map((x) => `${x} 관련 자료 기반 점검 결과 공유`);
  const strategy = `${interested[0] || issues[0] || "핵심 이슈"}을(를) 중심으로, '문제 제기 → 방치 시 부담 → 해결 방향 → 로드맵 → 플랜' 순으로 2차 미팅을 구성하는 흐름을 권합니다. (협의 후 정리)`;
  const nextDocs = Array.from(new Set(["재무제표(최근 3개년)", "주주명부", "정관", "계정별원장", ...(issues.includes("가지급금") ? ["가지급금 명세"] : []), ...(issues.includes("고용지원금") ? ["근로계약·4대보험 현황"] : [])])).slice(0, 8);
  const kakao = `대표님, 오늘 시간 내주셔서 감사합니다. 말씀 주신 ${issues.slice(0, 2).join(", ") || "부분"} 중심으로 자료를 확인한 뒤, 실제 적용 가능성이 있는 부분만 추려 2차 미팅에서 정리해 드리겠습니다. (적용 여부는 세부 요건 확인이 필요하며, 세무사 검토가 필요한 부분은 함께 안내드리겠습니다.)`;
  return { summary, reaction, interested, hesitant, newInfo, issues, secondPoints, strategy, nextDocs, kakao, analyzedAt: todayISO() };
}
// 원본 App.jsx 1212줄
export function insuranceSim(monthly, months, rate) { const mo = Number(monthly) || 0, mm = Number(months) || 84, rt = isFinite(Number(rate)) ? Number(rate) : 100; const total = mo * mm; const base = Math.round(total * rt / 100); return { total, base, months: mm, rate: rt }; }
// 원본 App.jsx 1214줄
export function getAffordSettings(data) { const s = (data && data.affordSettings) || {}; return { greenPerEok: Number(s.greenPerEok) > 0 ? Number(s.greenPerEok) : 300, yellowPerEok: Number(s.yellowPerEok) > 0 ? Number(s.yellowPerEok) : 600, defMonths: Number(s.defMonths) > 0 ? Number(s.defMonths) : 84, defRate: isFinite(Number(s.defRate)) ? Number(s.defRate) : 100 }; }
// 원본 App.jsx 1216줄
export function manFromDisplay(s) { if (!s) return null; const t = String(s); let m; if ((m = t.match(/([0-9.,]+)\s*억/))) return Math.round(parseFloat(m[1].replace(/,/g, "")) * 10000); if ((m = t.match(/([0-9.,]+)\s*만원/))) return Math.round(parseFloat(m[1].replace(/,/g, ""))); if ((m = t.match(/([0-9,]+)\s*원/))) return Math.round(parseFloat(m[1].replace(/,/g, "")) / 1e4); return null; }
// 원본 App.jsx 1218줄
export function custNetIncomeMan(item) {
  if (!item) return null;
  if (isFinite(Number(item.proposalNetIncomeBase)) && Number(item.proposalNetIncomeBase) > 0) return Number(item.proposalNetIncomeBase);
  if (isFinite(Number(item.netIncome)) && Number(item.netIncome) > 0) return Number(item.netIncome);
  const nums = item.financialNumbers || [];
  const hit = nums.find((n) => /당기순이익|순이익/.test(n.label || ""));
  if (hit) { const v = manFromDisplay(hit.display); if (v) return v; }
  return null;
}
// 원본 App.jsx 1228줄
export function affordability(monthlyMan, netIncomeMan, settings) {
  const st = settings || { greenPerEok: 300, yellowPerEok: 600 };
  const mo = Number(monthlyMan) || 0;
  if (!isFinite(Number(netIncomeMan)) || Number(netIncomeMan) <= 0) return { level: "none", label: "기준 정보 없음", color: C.textM, bg: "#EEF2F7", msg: "직전년도 당기순이익을 입력하면 월납 적정성을 확인할 수 있습니다.", greenLimit: 0, yellowLimit: 0, hasBase: false };
  const eok = Number(netIncomeMan) / 10000;
  const greenLimit = Math.round(eok * st.greenPerEok), yellowLimit = Math.round(eok * st.yellowPerEok);
  let level, label, color, bg, msg;
  if (mo <= greenLimit) { level = "green"; label = "초록 · 검토 여지"; color = C.ok; bg = C.greenBg; msg = "직전년도 이익 기준으로는 비교적 검토 여지가 있는 월납 규모입니다. 다만 실제 현금흐름과 대표님 의사 확인이 필요합니다."; }
  else if (mo <= yellowLimit) { level = "yellow"; label = "노랑 · 주의"; color = C.warn; bg = C.warnBg; msg = "직전년도 이익 대비 월납 부담이 다소 커질 수 있습니다. 관계사 현금흐름, 기존 보험료, 대표님 목적자금을 함께 확인하는 것이 좋습니다."; }
  else { level = "red"; label = "빨강 · 부담 큼"; color = C.err; bg = C.redBg; msg = "직전년도 이익만 보면 월납 부담이 클 가능성이 있습니다. 특별한 목적자금이나 관계사 현금흐름이 없다면 금액 조정 검토가 필요합니다."; }
  return { level, label, color, bg, msg, greenLimit, yellowLimit, hasBase: true, note: "관계사 수익·대표 개인 자금·기존 보험 리모델링 등 예외가 있을 수 있어, 최종 판단은 현금흐름 확인 후 컨설턴트가 조정합니다." };
}
// 원본 App.jsx 1241줄
export function monthlyPlanText(item, settings, mode) {
  if (!item || !(Number(item.proposalMonthlyPremium) > 0)) return [];
  const mo = Number(item.proposalMonthlyPremium), mm = Number(item.proposalMonths) || 84, rt = isFinite(Number(item.proposalRefundRate)) ? Number(item.proposalRefundRate) : 100;
  const r = insuranceSim(mo, mm, rt);
  const L = ["■ 월납 플랜 검토안 (100% 기준 단순 시뮬레이션)", `· 월납 보험료: ${manToText(mo)}`, `· ${mm}개월 총 납입 기준: ${manToText(r.total)}`, `· 7년차 ${rt}% 기준 예상 목적자금: ${manToText(r.base)}`];
  if (mode === "internal") { const net = custNetIncomeMan(item); const aff = affordability(mo, net, settings || getAffordSettings(null)); if (aff.hasBase) L.push(`· [내부] 직전년도 이익 대비 적정성: ${aff.label}`); }
  L.push("· 해당 금액은 대표 퇴직금·가지급금 정리·세무/승계 목적자금 등으로 검토할 수 있습니다.", "· 상품 조건에 따라 실제 수치가 달라질 수 있으며, 청약 전 상품설명서와 전문가 설명 확인이 필요합니다.");
  return L;
}
// 원본 App.jsx 1250줄
export function buildSecondMeetingDoc(item, profile, sim) {
  const p = profile || REPORT_PROFILE_DEFAULT; const name = getCompanyName(item) || item.name; const sig = financeSignal(item);
  const ta = item.transcriptAnalysis; const recos = recommendedStrategiesFor(item).slice(0, 4); const L = [];
  L.push(`[${name} · 2차 미팅 전략자료]`, `${todayISO().replace(/-/g, ".")} · 담당 ${p.consultant} ${p.title} · ${p.org}`, "");
  L.push("■ 대표님 상황 요약", `${safe(item.industry, "-")} · 매출 ${wonFromMillion(item.revenue)} · 직원 ${safe(item.empCount, "-")}명 · 업력 ${safe(item.estYears, "-")}년`, `재무 신호등: ${sig.label}`, "");
  L.push("■ 1차 미팅에서 확인된 문제"); (ta ? ta.issues : missedConsultItems(item)).slice(0, 5).forEach((x) => L.push(`· ${x} 관련 점검 필요성`)); if (sig.reasons[0]) L.push(`· ${sig.reasons[0]}`); L.push("");
  L.push("■ 방치 시 생길 수 있는 부담(추정)", "· 법인세 부담·대표 현금흐름·승계 부담이 누적될 가능성", "· 자금조달·고용/세액공제·인증 기회를 놓칠 가능성", "");
  L.push("■ 해결 방향", "회사가 번 이익을 제대로 남기고 성장 기회를 놓치지 않도록, 우선순위가 높은 항목부터 단계적으로 점검·정리하는 방향을 권합니다. (자료 확인 후 판단)", "");
  L.push("■ 추천 컨설팅 조합"); recos.forEach((s, i) => L.push(`${i + 1}. ${s.name} — ${s.fit}`)); L.push("");
  L.push("■ 예상 진행 로드맵"); (item.roadmap && item.roadmap.length ? item.roadmap : defaultRoadmap(item)).slice(0, 6).forEach((r) => L.push(`· ${r.month}: ${r.task}`)); L.push("");
  L.push("■ 필요자료"); (ta ? ta.nextDocs : ["재무제표", "주주명부", "정관", "계정별원장"]).forEach((d) => L.push(`☐ ${d}`)); L.push("");
  if (sim) { L.push("■ 월납 시뮬레이션(설명용 · 단순 계산)", `월납 ${manToText(sim.monthlyMan)} × ${sim.months}개월 = 총 납입액 ${manToText(insuranceSim(sim.monthlyMan, sim.months, sim.rate).total)}`, `환급률 ${sim.rate}% 기준 시 ${sim.months}개월 후 기준액 ${manToText(insuranceSim(sim.monthlyMan, sim.months, sim.rate).base)}`, "※ 상품별 실제 환급률과 조건은 달라질 수 있으며, 청약 전 상품설명서와 전문가 설명이 필요합니다.", ""); }
  L.push("■ 다음 진행 제안", "오늘 논의 기준으로 우선순위를 정하고, 자료 준비 상황에 따라 일정을 협의 후 정리하는 흐름을 제안드립니다.");
  return L.join("\n");
}
// 원본 App.jsx 1265줄
export function defaultRoadmap(item) {
  const its = item.interests || [], fl = item.flags || {}; const base = new Date(); let i = 0;
  const mon = (n) => { const d = new Date(base.getFullYear(), base.getMonth() + n, 1); return `${d.getFullYear()}년 ${d.getMonth() + 1}월`; };
  const steps = []; const add = (task, purpose, docs) => steps.push({ id: uid(), month: mon(i++), task, purpose, docs, owner: "컨설턴트", status: "예정" });
  add("계약 및 정관정비 착수", "임원보수·퇴직금 지급근거 등 기본 방어 정리", "정관·주주명부");
  if (fl.rndStaff || its.includes("연구소")) add("기업부설연구소 설립 준비", "연구개발 인정·세액공제 점검", "조직도·연구개발 자료");
  if (fl.patent || its.includes("연구소")) add("특허/상표 출원 검토", "지식재산 확보·가점", "기술 자료");
  if (fl.venture || its.includes("벤처인증")) add("벤처기업/이노비즈 인증 검토", "세제·정책자금 가점 점검", "기술/재무 자료");
  if (fl.policyFund || fl.hasLoan || its.includes("정책자금")) add("정책자금/고용지원금 점검", "자금·고용 기회 점검", "재무제표·고용 현황");
  if (its.includes("가업승계") || fl.succession) add("주식가치평가·승계 사전 점검", "승계 부담 사전 정리", "재무제표·주주명부");
  if (steps.length < 2) add("자료 확인 및 우선순위 정리", "검토 가능성 판단", "재무제표");
  return steps;
}
// 원본 App.jsx 1426줄
export function buildTimeline(item) {
  const ev = [];
  if (item.createdAt || item.dbDate) ev.push({ date: item.dbDate || item.createdAt, type: "DB 등록", memo: item.dbSource || "" });
  if (item.financialAnalyzedAt) ev.push({ date: item.financialAnalyzedAt, type: "크레탑/재무 분석", memo: item.financialSourceType || "" });
  if (item.transcriptAnalysis && item.transcriptAnalysis.analyzedAt) ev.push({ date: item.transcriptAnalysis.analyzedAt, type: "1차 미팅 녹취 분석", memo: "" });
  (item.stageHistory || []).forEach((h) => ev.push({ date: h.date, type: "단계 변경", memo: `${h.from} → ${h.to}` }));
  if (item.proposedAt) ev.push({ date: item.proposedAt, type: "제안", memo: (item.proposedPackages || []).slice(0, 2).join(", ") });
  if (item.quotedAt) ev.push({ date: item.quotedAt, type: "견적 전달", memo: "" });
  if (item.contractedAt) ev.push({ date: item.contractedAt, type: "계약 완료", memo: "" });
  if (item.dealResult && ["보류", "거절"].includes(item.dealResult)) ev.push({ date: item.updatedAt || todayISO(), type: item.dealResult, memo: item.dealReason || "" });
  return ev.filter((e) => e.date).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
}
// 원본 App.jsx 1439줄
export const PROPOSAL_TOPICS = [
  { key: "employ", name: "고용지원금", kw: ["직원", "채용", "4대보험", "급여", "청년", "고용", "인원", "근로자"], cats: ["고용지원금"], pkgCats: ["자금/지원금", "복지/노무"], action: "고용지원금 재점검 안내" },
  { key: "fund", name: "정책자금", kw: ["자금", "보증", "대출", "운전자금", "시설자금", "신보", "기보", "중진공", "차입", "리파이낸싱"], cats: ["정책자금"], pkgCats: ["자금/지원금", "신용/보증/성장지원"], action: "정책자금 준비자료 안내" },
  { key: "rd", name: "연구소/인증", kw: ["연구소", "연구개발", "제조", "특허", "벤처", "메인비즈", "이노비즈", "ISO", "인증", "개발", "기술"], cats: ["연구소"], industries: ["제조업", "IT/소프트웨어"], pkgCats: ["인증/연구소", "지식재산/브랜딩"], action: "연구소/인증 가능성 점검" },
  { key: "tax", name: "세무/정관", kw: ["정관", "임원퇴직금", "법인세", "배당", "이익잉여금", "미처분", "가지급금", "가수금"], cats: ["정관정비", "법인세", "가지급금", "미처분이익잉여금"], pkgCats: ["세무/정관", "보험/퇴직금"], action: "정관/임원퇴직금 점검 연락" },
  { key: "succ", name: "승계/지분", kw: ["승계", "주식", "지분", "자녀", "가족", "가업승계", "주식가치", "2세"], cats: ["가업승계"], pkgCats: ["승계/지분"], action: "가업승계/주식가치 점검 안내" },
  { key: "labor", name: "노무/복지", kw: ["근로계약서", "취업규칙", "복지", "사내근로복지기금", "노무", "급여대장"], cats: [], pkgCats: ["복지/노무"], action: "노무/복지 점검 연락" },
  { key: "insure", name: "보험/대표 퇴직금", kw: ["대표 퇴직금", "법인보험", "목적자금", "월납", "퇴직연금"], cats: [], pkgCats: ["보험/퇴직금"], action: "대표 퇴직금/목적자금 점검" },
];
// 원본 App.jsx 1448줄
export function topicMatchCustomer(c, topic) {
  const hay = `${c.industry || ""} ${(c.interests || []).join(" ")} ${c.concern || ""} ${c.memo || ""}`;
  const hits = topic.kw.filter((k) => hay.includes(k));
  let score = hits.length; const reasons = [];
  if (hits.length) reasons.push(`고객 메모·관심사에 '${hits.slice(0, 2).join(", ")}' 키워드가 있어`);
  if (topic.industries && topic.industries.includes(c.industry)) { score += 2; reasons.push(`업종이 ${c.industry}여서`); }
  const emp = Number(c.empCount) || 0, ni = Number(c.netIncome) || 0, age = Number(c.ceoAge) || 0;
  if (topic.key === "employ" && emp > 0) { score += 2; reasons.push(`직원 ${emp}명이 있어`); }
  if (topic.key === "fund" && (Number(c.revenue) || 0) > 0) { score += 1; reasons.push(`매출 규모가 있어`); }
  if (topic.key === "rd" && /제조|IT/.test(c.industry || "") && !/연구소/.test(hay)) { score += 1; reasons.push(`연구소 정보가 없어`); }
  if (topic.key === "tax" && ni >= 10000) { score += 2; reasons.push(`이익 규모가 있어`); }
  if (topic.key === "succ" && age >= 55) { score += 2; reasons.push(`대표 연령(${age}세)을 고려해`); }
  if (topic.key === "labor" && emp >= 5) { score += 1; reasons.push(`직원 ${emp}명 규모로`); }
  const reason = score > 0 ? `${reasons.join(", ")} ${topic.name} 점검 주제로 분류했습니다. (관련 가능성 · 자료 확인 후 판단)` : "";
  return { match: score > 0, score, reason };
}
// 원본 App.jsx 1464줄
export function classifyTopicsFromText(text) {
  const t = String(text || "");
  return PROPOSAL_TOPICS.filter((tp) => tp.kw.some((k) => t.includes(k)) || (tp.cats || []).some((c) => t.includes(c))).map((tp) => tp.key);
}
// 원본 App.jsx 1474줄
export function relatedTopicsForCustomer(item) {
  return PROPOSAL_TOPICS.map((tp) => ({ topic: tp, ...topicMatchCustomer(item, tp) })).filter((x) => x.match).sort((a, b) => b.score - a.score);
}
// 원본 App.jsx 1477줄
export function topicKakao(c, topic) {
  const name = getCompanyName(c) || c.name || "대표님";
  return `${name} 대표님, 최근 ${topic.name} 관련 제도나 지원사업 변경사항이 있어 기존에 검토했던 부분을 다시 한번 점검해보면 좋을 것 같아 연락드렸습니다. 바로 결론을 내리기보다 자료 확인 후 적용 여부와 우선순위를 정리해보겠습니다. (적용 여부는 세부 요건 확인이 필요합니다.)`;
}
// 원본 App.jsx 1481줄
export function topicPackages(topic, data) { const pkgs = getPackages(data); return pkgs.filter((p) => (topic.pkgCats || []).includes(p.cat)).slice(0, 3); }
// 원본 App.jsx 1566줄
export function prepSufficiency(item) {
  let pts = 0;
  if (item.revenue) pts++; if (item.empCount) pts++; if (item.industry) pts++;
  if ((item.interests || []).length) pts++; if (item.concern || item.memo) pts++;
  if (item.netIncome) pts++; if (item.financialSummary) pts++;
  const level = pts >= 4 ? "충분" : pts >= 2 ? "보통" : "부족";
  return { level, pts, color: level === "충분" ? C.ok : level === "보통" ? C.warn : C.err, bg: level === "충분" ? C.greenBg : level === "보통" ? C.warnBg : C.redBg };
}
// 원본 App.jsx 1574줄
export function prepBriefing(item) {
  const name = getCompanyName(item) || item.name || "이 고객사";
  const rev = item.revenue ? wonFromMillion(item.revenue) : "매출 미입력";
  const emp = item.empCount ? `${item.empCount}명` : "직원 수 미입력";
  const ind = item.industry || "업종 미입력";
  const ints = (item.interests || []).slice(0, 4).join(", ") || "미입력";
  const strats = recommendedStrategiesFor(item).slice(0, 3).map((s) => s.name);
  const L = [];
  L.push(`■ 회사 규모: ${name} · ${ind} · 매출 ${rev} · 직원 ${emp}`);
  L.push(`■ 현재 눈에 띄는 정보: 관심·이슈 ${ints}${item.concern ? ` · 대표 고민: ${String(item.concern).slice(0, 60)}` : ""}`);
  L.push(`■ 먼저 확인할 항목: ${strats.join(", ") || "기본 재무·정관·인력 현황"} (모두 자료 확인 후 판단)`);
  L.push(`■ 오늘 미팅의 목적: 현재 상황을 듣고, 우선 점검할 항목과 필요한 자료를 정리하는 1차 미팅입니다.`);
  L.push(`■ 주의할 점: 적용 여부·금액은 단정하지 않고, 자료 확인 후 검토 가능성과 우선순위만 정리합니다. 세무·보험 관련은 세무사 검토 권장.`);
  return L.join("\n");
}
// 원본 App.jsx 1589줄
export function prepQuestions(item) {
  const memo = `${item.concern || ""} ${item.memo || ""}`;
  const emp = Number(item.empCount) || 0;
  const ni = Number(item.netIncome) || 0;
  const age = Number(item.ceoAge) || 0;
  const ind = item.industry || "";
  const has = (k) => (item.interests || []).includes(k);
  const Q = [];
  Q.push(["재무/자금", ni >= 10000 ? "이익이 꾸준히 나는 편이신데 법인세·임원보수·배당·이익잉여금 정리는 어떻게 보고 계신가요?" : "최근 3개년 매출·이익 흐름은 어떻게 되시나요?"]);
  Q.push(["고용/지원금", emp > 0 ? `직원 ${emp}명 기준으로 최근 채용이나 인원 변동이 있으셨나요?` : "최근 채용 계획이나 인원 변동이 있으신가요?"]);
  Q.push(["연구소/인증", /제조|IT|소프트|건설/.test(ind) || has("연구소") ? "연구개발 인력이나 개발 활동이 있으신가요? (연구소·벤처·특허 검토 가능성)" : "연구개발이나 기술·품질 인증을 검토해보신 적이 있으신가요?"]);
  Q.push(["정관/임원퇴직금", "정관이나 임원 보수·퇴직금 규정을 최근에 점검해보신 적이 있으신가요?"]);
  Q.push(["가지급금/가수금", /가지급|가수금/.test(memo) ? "대표님 가지급금/가수금 정리 방향을 검토해보신 적이 있으신가요?" : "대표님과 법인 간 자금 거래(가지급금 등) 중 정리가 필요한 부분이 있으신가요?"]);
  Q.push(["승계/주식가치", age >= 55 || /자녀|승계|2세/.test(memo) ? "가업승계나 주식 이동을 염두에 두고 계신가요? 가족 임직원이 있으신가요?" : "향후 지분 구조나 승계를 염두에 두신 부분이 있으신가요?"]);
  Q.push(["보험/대표 퇴직금", "대표님 퇴직금 재원이나 법인 자금 운용 관점에서 검토해보신 부분이 있으신가요?"]);
  Q.push(["노무/복지", emp >= 10 ? "근로계약서·취업규칙·4대보험 구조는 정비되어 있으신가요?" : "직원 복지나 노무 관리에서 신경 쓰시는 부분이 있으신가요?"]);
  Q.push(["기존 컨설팅 이력", "이전에 세무·노무·경영 컨설팅을 받아보신 적이 있으신가요? 어떤 부분이었나요?"]);
  Q.push(["대표 개인 관심사", "대표님께서 요즘 가장 신경 쓰고 계신 부분은 무엇인가요?"]);
  return Q.slice(0, 10);
}
// 원본 App.jsx 1609줄
export function prepPoints(item) {
  return topRecommendations(item).slice(0, 3).map((r) => ({ name: r.name, why: r.reason, ment: `대표님, ${r.name} 관련해서 ${(r.docs || []).slice(0, 2).join(", ") || "관련 자료"}를 먼저 확인해보고 검토 가능성과 우선순위를 정리드리겠습니다.`, docs: r.docs || [], caution: r.risk }));
}
// 원본 App.jsx 1612줄
export const PREP_DOC_STATES = ["요청 전", "요청 완료", "수령 완료", "검토 완료"];
// 원본 App.jsx 1613줄
export function prepDocs(item) {
  const base = ["사업자등록증", "법인등기부등본", "최근 3개년 재무제표", "주주명부", "정관", "4대보험 사업장 가입자명부", "급여대장", "고용 관련 자료", "대출/보증 내역", "기존 보험/퇴직연금 내역"];
  const add = []; const push = (x) => { if (!base.includes(x) && !add.includes(x)) add.push(x); };
  const memo = `${item.concern || ""} ${item.memo || ""}`;
  const has = (k) => (item.interests || []).includes(k);
  if (has("연구소") || /제조|IT|소프트/.test(item.industry || "")) ["연구개발 인력 현황", "연구개발 자료", "연구노트 여부"].forEach(push);
  if (Number(item.empCount) > 0) ["최근 입사자 명단", "근로계약서", "4대보험 취득일"].forEach(push);
  if (has("가업승계") || /승계|자녀|2세/.test(memo)) ["가족 임직원 현황", "주식 보유 현황"].forEach(push);
  if (has("가지급금") || /가지급/.test(memo)) ["계정별원장", "대표자 거래 내역"].forEach(push);
  if (has("정책자금") || /정책자금/.test(memo)) ["차입금 내역", "신용보증/담보 내역"].forEach(push);
  return [...base, ...add];
}
// 원본 App.jsx 1625줄
export function prepKakaos(item) {
  return [
    ["1차 미팅 후 감사·자료 요청", `대표님, 오늘 말씀 나눠주셔서 감사합니다. 말씀 주신 내용 기준으로 우선 점검할 항목을 정리해보겠습니다. 다음 자료를 확인해주시면 검토 가능성과 우선순위를 정리드리겠습니다. (자료 준비 상황에 따라 조정될 수 있습니다)`],
    ["2차 미팅 제안 안내", `대표님, 지난번 내용 바탕으로 우선 점검 항목을 정리했습니다. 자료 확인 후 검토 가능성과 진행 방향을 짧게 정리드리는 2차 미팅을 잡아보면 좋을 것 같습니다. 편하신 시점 알려주시면 일정 맞추겠습니다.`],
    ["보류 고객 재접촉", `대표님, 최근 제도나 지원사업 변경사항이 있어 기존에 검토했던 부분을 다시 한번 점검해보면 좋을 것 같아 연락드렸습니다. 부담 없이 현황만 가볍게 확인해보시죠. 자료 확인 후 우선순위만 정리드리겠습니다.`],
  ];
}
// 원본 App.jsx 1632줄
export const PREP_NEXT_ACTIONS = ["자료 요청", "크레탑/재무자료 확인", "2차 미팅 일정 조율", "제안서 초안 작성", "고용지원금 별도 점검", "연구소/인증 가능성 검토", "정관/임원퇴직금 검토", "보류 고객 재접촉"];
// 원본 App.jsx 1633줄
export function prepDiagText(item) {
  const pts = prepPoints(item); const docs = prepDocs(item).slice(0, 5);
  const L = [`[대표용 1페이지 진단] ${getCompanyName(item) || item.name}`, "대표님 회사는 현재 아래 항목을 우선 점검해볼 수 있습니다.", ""];
  L.push(`1. 회사 기본 요약: ${item.industry || "업종 미입력"} · 매출 ${item.revenue ? wonFromMillion(item.revenue) : "미입력"} · 직원 ${item.empCount || "-"}명`);
  L.push(`2. 현재 우선 점검 항목: ${pts.map((p, i) => `${i + 1}) ${p.name}`).join(" / ") || "기본 재무·정관·인력"}`);
  L.push(`3. 놓치기 쉬운 리스크: ${item.concern || "정관·임원규정·자금거래 정리 여부는 자료 확인 후 판단이 필요합니다."}`);
  L.push(`4. 추가 확인자료: ${docs.join(", ")}`);
  L.push(`5. 다음 미팅 방향: 위 자료를 기준으로 1차 검토를 진행하고, 검토 가능성과 우선순위를 정리드리겠습니다.`);
  L.push("", "정확한 판단은 자료 확인 후 정리드리겠습니다. (적용 여부는 세부 요건 확인 필요, 세무사 검토 권장)");
  return L.join("\n");
}
// 원본 App.jsx 4437줄
export const CONSULT_CATALOG = [
  { cat: "인증·연구소", items: [["기업부설연구소 설립", "연구개발 활동과 인력 구조를 확인해 설립 여부를 검토합니다."], ["연구소 사후관리", "설립 후 인력·활동 요건 유지 상태를 점검합니다."], ["벤처기업 인증", "기술성·성장성 요건을 확인해 인증 가능성을 검토합니다."], ["메인비즈/이노비즈", "경영·기술 혁신 평가지표 충족 여부를 점검합니다."]] },
  { cat: "세무·정관", items: [["정관정비", "임원보수·퇴직금 지급근거 등 정관 조항을 점검합니다."], ["임원보수 규정 정비", "임원 보수 지급 기준과 근거 규정을 점검합니다."], ["임원퇴직금 규정", "임원 퇴직금 지급 근거와 한도 규정을 검토합니다."], ["가지급금 정리", "발생 원인과 인정이자 처리 여부를 확인해 정리 방향을 검토합니다."], ["가수금 출자전환", "가수금 발생 경위와 재무 영향, 정리 구조를 점검합니다."], ["미처분이익잉여금 정리 전략", "잉여금 누적에 따른 주식가치·배당·소각 방향을 검토합니다."], ["이익소각/자기주식 검토", "자기주식 취득·이익소각 절차와 세무 영향을 검토합니다."], ["차등배당/배당정책 검토", "주주 구성에 맞는 배당 정책 방향을 점검합니다."], ["법인세 신고 전 사전 점검", "신고 전 주요 계정과 공제 항목을 사전 점검합니다."], ["세무조사 리스크 점검", "거래·계정 구조상 점검이 필요한 부분을 확인합니다."]] },
  { cat: "자금·지원금", items: [["정책자금", "재무구조와 신용상태를 기준으로 자금 조달 방향을 점검합니다."], ["고용지원금", "채용 계획과 신청 순서를 점검합니다."], ["통합고용세액공제", "고용 증가 요건과 적용 가능성을 검토합니다."], ["정부지원사업/바우처 검토", "업종·규모에 맞는 지원사업 후보를 점검합니다."], ["스마트공장/자동화 지원사업 검토", "제조·자동화 분야 지원사업 적합성을 검토합니다."], ["수출바우처/해외진출 지원사업 검토", "수출·해외진출 관련 지원 후보를 점검합니다."], ["보증/대출 리파이낸싱 검토", "기존 차입 구조와 조건 개선 방향을 점검합니다."], ["기업신용등급 관리", "신용평가 항목과 개선 포인트를 점검합니다."]] },
  { cat: "승계·지배구조", items: [["가업승계", "주주구성과 승계 요건, 세무 이슈를 사전 점검합니다."], ["주식가치평가", "재무제표 기반으로 주식가치를 산정해 검토합니다."], ["가족법인/관계사 구조 점검", "관계사 간 거래·지분 구조를 점검합니다."], ["법인전환 검토", "개인사업자 대비 손익과 절차를 비교 검토합니다."], ["개인사업자 법인전환", "전환 시점과 자산 이전 방식을 검토합니다."], ["지배구조 정리", "지분·임원 구조의 정비 방향을 점검합니다."], ["주주간계약/동업 리스크 점검", "동업 구조의 권리·의무와 리스크를 점검합니다."], ["스톡옵션/성과보상제도", "성과 보상 설계 방향을 검토합니다(법률 검토 필요)."]] },
  { cat: "노무·복지", items: [["사내근로복지기금", "복지제도·장기근속과 비용처리 관점을 함께 검토합니다."], ["노무관리 기본 점검", "근로기준·노무 리스크를 기본 점검합니다(노무사 협업)."], ["근로계약서/취업규칙 점검", "계약서·취업규칙의 정비 상태를 점검합니다."], ["4대보험/급여 구조 점검", "급여 구조와 4대보험 적정성을 점검합니다."]] },
  { cat: "지식재산·브랜딩", items: [["특허/상표/디자인권 검토", "보유·출원 가능한 지식재산 범위를 점검합니다."], ["직무발명보상제도", "직무발명 보상 규정 도입 방향을 검토합니다."], ["ESG/기업 신뢰도 자료 정비", "대외 신뢰도 자료의 정비 방향을 점검합니다."], ["홈페이지/브랜딩/마케팅 자동화", "온라인 채널과 마케팅 자동화 방향을 검토합니다."]] },
  { cat: "기타 성장지원", items: [["ISO 인증 검토", "필요 인증 유형과 준비 사항을 점검합니다."], ["법인보험/대표 퇴직금 플랜", "대표 퇴직금·목적자금 재원 마련 방향을 검토합니다."]] },
];
// 원본 App.jsx 4446줄
export const CONSULT_DESC = (() => { const m = {}; CONSULT_CATALOG.forEach((g) => g.items.forEach(([n, d]) => { m[n] = d; })); return m; })();
// 원본 App.jsx 4447줄
export function consultDesc(name) { return CONSULT_DESC[name] || "관련 요건과 자료를 확인해 검토합니다."; }
// 원본 App.jsx 4448줄
export function bundleReason(names) { const a = (names || []).filter(Boolean); if (a.length < 2) return ""; return `${a.slice(0, 3).join(" · ")}${a.length > 3 ? " 등" : ""}은 기업 신뢰도와 자금·세무 흐름에서 서로 연결될 수 있어, 우선순위와 순서를 함께 정리해보는 것이 좋습니다.`; }
// 원본 App.jsx 4449줄
export const PROPOSAL_ADD_ITEMS = CONSULT_CATALOG.flatMap((g) => g.items.map((x) => x[0]));
// 원본 App.jsx 4450줄
export const MONTHLY_QUICK = [100, 200, 300, 500, 1000];
// 원본 App.jsx 4649줄
export function lastActivityOf(c) { const ds = [(c.contacts && c.contacts[0] && c.contacts[0].date), c.stageMovedAt, c.proposedAt, c.nextDate].filter(Boolean); return ds.sort().slice(-1)[0] || ""; }

// ── 목록을 받는 판 (D-92) ─────────────────────────────────────────
// 원본은 data(leads+companies)를 받아 getUniqueCustomers 로 펼쳤다. 여기서는 업체는 고객 운영에 있으므로
// 화면이 이미 펼친 고객 목록(list)을 넘긴다. 규칙·문장·문턱값은 원본 그대로다.
function dday(ymd) { if (!ymd) return 0; const a = new Date(String(ymd).slice(0, 10) + "T00:00:00").getTime(); const t = new Date(); const b = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime(); return Math.round((a - b) / 86400000); }
// 원본 App.jsx 956줄 followStatus
export function followStatus(item) {
  if (!item || !item.nextDate || ["contracted", "lost"].includes(item.stage)) return null;
  const d = dday(item.nextDate);
  if (d < 0) return { t: "다음 연락 지연", c: C.err, b: C.redBg, kind: "overdue" };
  if (d === 0) return { t: "오늘 연락", c: C.warn, b: C.warnBg, kind: "today" };
  if (d <= 3) return { t: `곧 연락 D-${d}`, c: "#2563EB", b: "#E8F1FE", kind: "upcoming" };
  return null;
}
// 원본 1464줄 relatedCustomersForTopic
export function relatedCustomersForTopicOf(list, topicKey, limit) {
  const topic = PROPOSAL_TOPICS.find((t) => t.key === topicKey); if (!topic) return [];
  const out = [];
  (list || []).forEach((c) => { const m = topicMatchCustomer(c, topic); if (m.match) out.push({ c, reason: m.reason, score: m.score, topic }); });
  return out.sort((a, b) => b.score - a.score).slice(0, limit || 50);
}
// 원본 1548줄 TodayProposalIdeas 의 줄 만들기
export function todayProposalRows(list) {
  const baseRows = PROPOSAL_TOPICS.map((tp) => ({ key: tp.key, name: tp.name, tp, list: relatedCustomersForTopicOf(list, tp.key, 50) })).filter((x) => x.list.length).sort((a, b) => b.list.length - a.list.length).slice(0, 5);
  const stratRows = [["미처분이익잉여금 점검", "tax"], ["고용세액공제 점검", "employ"], ["연구개발비 세액공제 점검", "rd"]].map(([name, tk]) => ({ key: "s_" + name, name, tp: PROPOSAL_TOPICS.find((t) => t.key === tk), list: relatedCustomersForTopicOf(list, tk, 50) })).filter((x) => x.list.length);
  return [...baseRows, ...stratRows].slice(0, 7);
}
// 원본 4650줄 focusCustomers (scoreLead 는 화면이 넘긴다 — salesData 와 순환을 피하려고)
export function focusCustomersOf(list, scoreLead) {
  const all = (list || []).filter((c) => !["contracted", "lost"].includes(c.stage));
  return all.map((c) => {
    let s = scoreLead(c) * 0.5;
    s += Math.min(40, (Number(c.expectedFee) || 0) / 20);
    const fs = followStatus(c); if (fs && fs.kind === "overdue") s += 20;
    if (["견적 전달", "조건 조율", "계약 예정"].includes(c.proposalStatus)) s += 25;
    const la = lastActivityOf(c); if (!la || dday(la) < -10) s += 10;
    const why = [];
    if (scoreLead(c) >= 70) why.push("계약 가능성 높음");
    if ((Number(c.expectedFee) || 0) >= 300) why.push("예상 수임료 높음");
    if (fs && fs.kind === "overdue") why.push("다음 연락 지연");
    if (c.proposalStatus && c.proposalStatus !== "제안 전") why.push(c.proposalStatus);
    if (!la || dday(la) < -10) why.push("최근 활동 없음");
    return { c, s, why: why.slice(0, 3).join(" · ") || "우선 점검 필요" };
  }).sort((a, b) => b.s - a.s).slice(0, 6);
}
// 원본 4667줄 riskSignals
export function riskSignalsOf(list, scoreLead) {
  const all = (list || []).filter((c) => !["contracted", "lost"].includes(c.stage));
  const out = [];
  for (const c of all) {
    const la = lastActivityOf(c);
    let reason = "", action = "";
    if (c.nextDate && dday(c.nextDate) < 0) { reason = `다음 연락 예정일 ${Math.abs(dday(c.nextDate))}일 지남`; action = "다음 연락 연락"; }
    else if (c.proposalStatus === "제안 완료" && (!la || dday(la) <= -7)) { reason = "제안 완료 후 7일 이상 후속 없음"; action = "견적/업무범위서 전달"; }
    else if (c.proposalStatus === "견적 전달" && (!c.stageMovedAt || dday(c.stageMovedAt) <= -7)) { reason = "견적 전달 후 7일 이상 변화 없음"; action = "검토 상황 확인"; }
    else if (scoreLead(c) >= 70 && !c.nextAction) { reason = "계약 가능성 높은데 다음 액션 없음"; action = "다음 액션 지정"; }
    else if ((Number(c.expectedFee) || 0) >= 300 && (c.contacts || []).length === 0) { reason = "예상 수임료 높은데 미팅 이력 없음"; action = "1차 미팅 제안"; }
    if (reason) out.push({ c, reason, last: la ? la.replace(/-/g, ".") : "기록 없음", action });
  }
  return out.slice(0, 10);
}
// 원본 1645줄 recontactList
export function recontactListOf(list) {
  const out = [];
  (list || []).forEach((c) => {
    const reasons = [];
    const last = (c.contacts || [])[0] && c.contacts[0].date;
    const ds = last ? -dday(last) : (c.stageMovedAt ? -dday(c.stageMovedAt) : 999);
    if (ds >= 60) reasons.push("최근 60일 이상 연락 이력이 없어 관리 접점 회복이 필요합니다.");
    if (c.stage === "hold" && c.stageMovedAt && -dday(c.stageMovedAt) >= 30) reasons.push("보류 후 30일이 지나 재접촉 타이밍으로 볼 수 있습니다.");
    if (Number(c.empCount) > 0) reasons.push("직원 수 변동 여부에 따라 고용지원금 검토 가능성을 다시 점검해볼 수 있습니다.");
    if ((c.interests || []).includes("연구소")) reasons.push("연구소·인증 요건 재점검 가능성이 있습니다.");
    if ((c.interests || []).includes("정책자금")) reasons.push("정책자금·보증 관련 재점검 가능성이 있습니다.");
    if (reasons.length) out.push({ c, reasons: reasons.slice(0, 2), ment: `${getCompanyName(c) || c.name} 대표님, ${reasons[0]} 부담 없이 현황만 가볍게 점검해보시죠. 자료 확인 후 우선순위만 정리드리겠습니다.`, ds });
  });
  return out.sort((a, b) => b.ds - a.ds).slice(0, 12);
}
