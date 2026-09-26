// @ts-nocheck — 원본 JS 를 그대로 옮긴 규칙(타입은 salesProposal.d.ts)
/**
 * 상품 · 견적 · 제안 규칙 (D-114 3단계) — 기업컨설팅 OS(영업 도구 모음 · SalesApp.jsx)에서 화면 없이 옮겼다.
 *  - 상품 40종(8분류 · 원본 가격 그대로 — 대표 결정 D-114 ④) · 고객별 추천 상품 3
 *  - 제안서 초안(공유용 · 내부용) · 업무범위서 · 견적 카톡 · 상황별 카톡 · 자료 요청 문구
 *  - 월납 보험료 제안(84개월 단순 시뮬레이션) · 직전년도 순이익 대비 적정성(초록 · 노랑 · 빨강 기준 값)
 *  - 계약 준비 체크 10 · 필수 서류 14
 * 원본의 색(C.*)만 뺐다. 규칙 계산이다(LLM 호출 없음).
 */
import { STRATEGY_LIBRARY, recommendedStrategiesFor } from "./salesEngine.js";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function money(n) {
  const v = Number(n) || 0;
  if (!v) return "-";
  if (Math.abs(v) >= 100000000) return (v / 100000000).toFixed(1).replace(".0", "") + "억원";
  if (Math.abs(v) >= 10000) return Math.round(v / 10000).toLocaleString() + "만원";
  return v.toLocaleString() + "원";
}
function wonFromMillion(m) {
  return money((Number(m) || 0) * 1000000);
}
function safe(v, fallback = "") {
  return v === undefined || v === null || v === "" ? fallback : v;
}
function getCompanyName(c) {
  if (!c) return "";
  if (c.corpType === "주식회사") return c.juPosition === "뒤" ? `${c.name}(주)` : `(주)${c.name}`;
  return c.name || "";
}
/** 원본 15단계 이름 (제안서 '단계' 줄에만 쓴다) */
const DEAL_STAGE_LABEL = { lead: "발굴대상", contacted: "첫 연락", meeting_proposed: "미팅제안", meeting1_scheduled: "1차예정", meeting1_done: "1차완료", docs_requested: "자료요청", docs_received: "자료수령", meeting2_scheduled: "2차예정", meeting2_done: "2차완료", proposal_sent: "제안발송", closing_scheduled: "클로징", decision_pending: "검토중", contracted: "계약완료", hold: "보류", lost: "이탈" };
function stageOf(key) {
  return { label: DEAL_STAGE_LABEL[key] || DEAL_STAGE_LABEL.lead };
}

const PKG_CATEGORIES = ["인증/연구소", "자금/지원금", "세무/정관", "승계/지분", "복지/노무", "보험/퇴직금", "지식재산/브랜딩", "신용/보증/성장지원"];
function buildDefaultPackages() {
  const defs = [
    ["기업부설연구소 설립 패키지", "인증/연구소", 200, "rd", "개발·설계 인력과 개발성 비용이 있다면 연구소 설립과 세액공제·인증을 함께 점검합니다."],
    ["연구소 사후관리 패키지", "인증/연구소", 80, "rd", "인정 이후 연구활동 기록·요건 유지·변경신고를 정기적으로 관리합니다."],
    ["벤처기업 인증 패키지", "인증/연구소", 150, "venture", "기술성·성장성 기준으로 벤처 인증 유형 적합성을 점검합니다."],
    ["메인비즈/이노비즈 인증 패키지", "인증/연구소", 150, "mainbiz", "경영·기술 혁신 활동 기준으로 인증 유형 적합성을 점검합니다."],
    ["정책자금 컨설팅 패키지", "자금/지원금", 300, "policyfund", "재무·신용 상태를 점검해 적합한 정책자금 가능성과 보완 항목을 정리합니다."],
    ["고용지원금 점검 패키지", "자금/지원금", 100, "employ", "채용 순서와 노무 리스크를 먼저 점검합니다. 수급 여부는 추가 확인이 필요합니다."],
    ["정관정비 패키지", "세무/정관", 150, "charter", "정관·임원보수·퇴직금 지급근거를 정비해 방어장치를 마련합니다."],
    ["임원퇴직금 규정 정비 패키지", "보험/퇴직금", 150, "execretire", "임원퇴직금 규정과 지급근거·재원을 점검·정비합니다."],
    ["가지급금 리스크 정리 패키지", "세무/정관", 300, "suspense", "가지급금 규모·원인을 확인하고 정리 방향을 검토합니다. 정리 방식은 세무사 검토 권장."],
    ["가수금 출자전환 패키지", "세무/정관", 300, "gasugeum", "대표 가수금 규모·원인을 확인하고 정리·출자전환 방향을 검토합니다."],
    ["사내근로복지기금 설립 검토 패키지", "복지/노무", 300, "welfare", "직원 복지·장기근속과 비용처리를 함께 보는 제도화 관점에서 검토합니다."],
    ["가업승계 사전점검 패키지", "승계/지분", 500, "succession", "승계 요건·주식가치·정관을 사전에 점검합니다. 특례·공제는 세무사 검토 권장."],
    ["주식가치평가 패키지", "승계/지분", 200, "stockvalue", "비상장주식 가치를 평가해 승계·증여·주식이동 판단의 기준을 만듭니다."],
    ["이익소각 구조 검토 패키지", "승계/지분", 500, "profitcancel", "미처분이익잉여금·주식가치 관리 관점에서 이익소각 절차·세무 영향을 검토합니다."],
    ["법인보험/대표 퇴직금 플랜 검토 패키지", "보험/퇴직금", 200, "corpinsure", "퇴직금 재원·자금 운용 관점에서 규정 정비와 함께 검토합니다."],
    ["특허/상표/디자인권 검토", "지식재산/브랜딩", 150, "", "보유·개발 중인 기술·브랜드의 특허·상표·디자인권 출원 여부와 우선순위를 점검합니다.", "기술·브랜드를 보유했거나 개발 중인 기업", ["사업자등록증", "제품·기술 개요", "기존 출원 내역"], "지식재산 점검 후 연구소·인증과 연계 제안. 적용 여부는 세부 요건 확인 필요."],
    ["직무발명보상제도 도입 검토", "지식재산/브랜딩", 120, "", "임직원 발명에 대한 보상 규정을 마련해 기술 보호와 세무 처리를 함께 점검합니다.", "연구·개발 인력이 있는 기업", ["임직원 명부", "기존 사규", "특허 출원 내역"], "직무발명보상 규정 정비 후 연구소·세무와 연계. 세무사 검토 권장."],
    ["스톡옵션/성과보상제도 검토", "복지/노무", 150, "", "핵심 인력 유지·동기부여를 위한 성과보상 설계 방향을 검토합니다.", "핵심 인력 이탈이 고민인 기업", ["임직원 명부", "정관", "급여 구조"], "성과보상 설계 후 복지·정관과 연계. 적용 여부는 세부 요건 확인 필요."],
    ["가족법인/관계사 구조 점검", "승계/지분", 300, "", "가족법인·관계사 간 거래·지분 구조의 리스크와 정리 방향을 점검합니다.", "관계사·가족법인이 있는 기업", ["주주명부", "관계사 현황", "거래내역"], "구조 점검 후 승계·정관과 연계. 세무사 검토 권장."],
    ["법인전환 검토", "세무/정관", 250, "", "개인기업의 법인전환 타당성을 자료 기준으로 검토합니다. 전환이 유리한지는 자료 확인 후 판단합니다.", "성장 중인 개인사업자", ["재무제표", "사업 현황", "자산 목록"], "법인전환 타당성 검토 후 정관·세무와 연계. 타당성은 자료 확인 후 판단."],
    ["개인사업자 법인전환 실무", "세무/정관", 250, "", "법인 설립·자산 이전·세무 처리 등 전환 실무 절차를 단계별로 정리합니다.", "법인전환을 결정한 개인사업자", ["재무제표", "자산 목록", "사업자등록증"], "전환 실무 진행 후 정관·복지와 연계. 세무사 검토 권장."],
    ["지배구조 정리 검토", "승계/지분", 300, "", "주주·임원·의결권 구조를 점검해 승계·경영권 관점의 정리 방향을 검토합니다.", "지분이 분산됐거나 승계를 준비하는 기업", ["주주명부", "정관", "임원 현황"], "지배구조 점검 후 승계·주식가치와 연계. 세무사 검토 권장."],
    ["차등배당/배당정책 검토", "승계/지분", 200, "", "배당 여력과 주주 구성을 기준으로 배당정책 방향을 검토합니다.", "이익잉여금이 누적된 기업", ["재무제표", "주주명부", "정관"], "배당정책 검토 후 이익잉여금·승계와 연계. 세무사 검토 권장."],
    ["임원보수 규정 정비", "세무/정관", 150, "", "임원 보수·상여 지급근거를 규정으로 정비해 손금 처리 근거를 점검합니다.", "임원 보수 근거가 불명확한 기업", ["정관", "이사회 의사록", "급여 지급 내역"], "임원보수 규정 정비 후 정관·퇴직금과 연계. 세무사 검토 권장."],
    ["주주간계약/동업 리스크 점검", "승계/지분", 200, "", "공동 창업·동업 구조의 분쟁 리스크와 주주간계약 필요성을 점검합니다.", "공동 주주·동업 구조 기업", ["주주명부", "정관", "동업 합의 내역"], "동업 리스크 점검 후 지배구조·승계와 연계. 자료 확인 후 판단."],
    ["미처분이익잉여금 정리 전략", "승계/지분", 300, "", "누적 이익잉여금의 규모와 정리 방향(배당·소각 등)을 자료 기준으로 검토합니다.", "이익잉여금이 크게 쌓인 기업", ["재무제표", "주주명부", "정관"], "이익잉여금 정리 검토 후 이익소각·배당과 연계. 세무사 검토 권장."],
    ["자기주식/이익소각 검토", "승계/지분", 400, "", "자기주식 취득·이익소각 절차와 세무 영향을 검토합니다.", "주식가치·이익잉여금 관리가 필요한 기업", ["재무제표", "주주명부", "정관"], "이익소각 검토 후 주식가치·승계와 연계. 세무사 검토 권장."],
    ["법인세 신고 전 사전 점검", "세무/정관", 120, "", "결산·신고 전 손금·공제·리스크 항목을 사전에 점검합니다.", "결산·법인세 신고를 앞둔 기업", ["재무제표", "계정별원장", "전기 신고서"], "신고 전 점검 후 정관·연구소 공제와 연계. 세무사 검토 권장."],
    ["세무조사 리스크 점검", "세무/정관", 200, "", "거래·계정 구조에서 세무조사 관점의 리스크 항목을 사전 점검합니다.", "거래 규모가 커지는 기업", ["재무제표", "계정별원장", "주요 거래내역"], "리스크 점검 후 정관·가지급금과 연계. 세무사 검토 권장."],
    ["노무관리 기본 점검", "복지/노무", 100, "", "근로시간·휴가·임금 등 기본 노무 항목의 리스크를 점검합니다.", "직원 수가 늘어나는 기업", ["근로계약서", "급여대장", "취업규칙"], "노무 기본 점검 후 복지·지원금과 연계. 추가 확인 필요."],
    ["근로계약서/취업규칙 점검", "복지/노무", 100, "", "근로계약서·취업규칙의 누락·법 개정 반영 여부를 점검합니다.", "계약서·규칙 정비가 필요한 기업", ["근로계약서", "취업규칙", "직원 명부"], "계약·규칙 점검 후 노무·복지와 연계. 추가 확인 필요."],
    ["4대보험/급여 구조 점검", "복지/노무", 100, "", "4대보험·급여 구조의 적정성과 비용 관점을 점검합니다.", "인건비 비중이 큰 기업", ["급여대장", "4대보험 내역", "근로계약서"], "급여 구조 점검 후 복지·지원금과 연계. 숫자 단위 확인 필요."],
    ["ISO 인증 검토", "인증/연구소", 150, "", "ISO 등 경영·품질 인증의 적합성과 준비 항목을 검토합니다.", "거래처 인증 요건이 있는 기업", ["사업자등록증", "조직도", "품질 관리 현황"], "ISO 검토 후 메인비즈·이노비즈와 연계. 적용 여부는 세부 요건 확인 필요."],
    ["ESG/기업 신뢰도 자료 정비", "신용/보증/성장지원", 150, "", "거래·금융 관점의 기업 신뢰도 자료를 정비합니다.", "거래처·금융 신뢰도 자료가 필요한 기업", ["회사 소개자료", "재무제표", "인증 현황"], "신뢰도 자료 정비 후 신용등급·브랜딩과 연계. 추가 확인 필요."],
    ["홈페이지/브랜딩/마케팅 자동화 검토", "지식재산/브랜딩", 150, "", "홈페이지·브랜딩·마케팅 자동화의 우선순위를 점검합니다.", "온라인 노출·브랜딩이 약한 기업", ["회사 소개자료", "기존 홈페이지 주소", "제품 정보"], "브랜딩 점검 후 지식재산·신뢰도와 연계. 추가 확인 필요."],
    ["정부지원사업/바우처 검토", "자금/지원금", 150, "", "기업 현황 기준으로 검토 가능한 정부지원사업·바우처 후보를 정리합니다. 수급 여부는 추가 확인이 필요합니다.", "정부지원사업이 처음인 기업", ["사업자등록증", "재무제표", "사업 계획"], "지원사업 후보 검토 후 정책자금과 연계. 수급 여부는 추가 확인 필요."],
    ["스마트공장/자동화 지원사업 검토", "자금/지원금", 200, "", "제조 공정 자동화·스마트공장 지원사업의 적합성을 검토합니다. 수급 여부는 추가 확인이 필요합니다.", "제조 공정 개선이 필요한 기업", ["사업자등록증", "공정 현황", "투자 계획"], "스마트공장 검토 후 정책자금과 연계. 수급 여부는 추가 확인 필요."],
    ["수출바우처/해외진출 지원사업 검토", "자금/지원금", 200, "", "수출·해외진출 관련 지원사업 후보를 검토합니다. 수급 여부는 추가 확인이 필요합니다.", "수출·해외진출을 준비하는 기업", ["사업자등록증", "수출 실적", "해외진출 계획"], "수출 지원사업 검토 후 정책자금과 연계. 수급 여부는 추가 확인 필요."],
    ["기업신용등급 관리", "신용/보증/성장지원", 150, "", "기업 신용등급에 영향을 주는 재무·비재무 항목을 점검합니다.", "대출·보증·입찰을 준비하는 기업", ["재무제표", "신용평가 내역", "거래 현황"], "신용등급 점검 후 보증·정책자금과 연계. 자료 확인 후 판단."],
    ["보증/대출 리파이낸싱 검토", "신용/보증/성장지원", 200, "", "기존 보증·대출 구조와 조건을 점검해 정리 방향을 검토합니다.", "금융비용 부담이 큰 기업", ["대출·보증 내역", "재무제표", "상환 계획"], "리파이낸싱 검토 후 신용등급·정책자금과 연계. 고객 현금흐름 확인 필요."],
  ];
  return defs.map((d, i) => { const s = STRATEGY_LIBRARY.find((x) => x.id === d[3]) || {}; const fit = d[5] || s.fit || "상담 과정에서 확인 필요"; const docs = d[6] || s.docs || ["재무제표", "정관"]; const point = d[7] || `${d[0]} 중심 제안 후 연계 패키지로 확장. 적용 여부는 세부 요건 확인 필요.`; return { id: "pkg" + i, name: d[0], cat: d[1], fee: d[2], strat: d[3], desc: d[4], fit, docs, caution: s.risk || "적용 여부는 세부 요건 확인 필요, 세무사 검토 권장", simple: s.pitch || d[4], kakao: `대표님, ${d[0]} 관련해서 ${docs.slice(0, 2).join(", ")} 정도를 먼저 확인해보면 좋겠습니다. 자료 확인 후 검토 가능성이 있는 부분만 정리드리겠습니다.`, point, sample: true }; });
}
const DEFAULT_PACKAGES = buildDefaultPackages();
function matchPackages(item, packages) {
  const strats = recommendedStrategiesFor(item);
  const out = []; const seen = new Set();
  for (const s of strats) { const pkg = packages.find((p) => p.strat === s.id && !seen.has(p.id)); if (pkg) { seen.add(pkg.id); out.push({ pkg, reason: recoReason(item, s) }); } if (out.length >= 3) break; }
  if (out.length < 3) { for (const pkg of packages) { if (!seen.has(pkg.id)) { seen.add(pkg.id); out.push({ pkg, reason: "고객 상황에 따라 검토 가능성이 있는 항목입니다." }); } if (out.length >= 3) break; } }
  return out;
}
function buildProposal(item, pkgs, mode, profile) {
  const p = profile || REPORT_PROFILE_DEFAULT;
  const name = getCompanyName(item) || item.name;
  const div = "━━━━━━━━━━━━━━━━";
  const dateK = todayISO().replace(/-/g, ".");
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
const SCOPE_TEMPLATES = {
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
const PKG_DURATION = { rd: "2~4주", venture: "4~8주", mainbiz: "4~8주", policyfund: "2~6주", employ: "2~4주", charter: "1~3주", execretire: "1~3주", suspense: "2~6주", gasugeum: "2~6주", welfare: "4~8주", succession: "4~8주", stockvalue: "1~3주", profitcancel: "2~6주", corpinsure: "2~4주" };
const SCOPE_EXCLUDED = ["세무 신고 대리 업무는 별도 협의", "법무 등기 대행은 별도 협의", "노무 자문 및 신고 대행은 별도 협의", "정책자금 승인 또는 인증 결과를 보장하지 않음", "자료 미제공 또는 요건 미충족 시 진행 범위가 조정될 수 있음"];
function scopeItems(pkg) { return SCOPE_TEMPLATES[pkg.strat] || (pkg.docs || []).map((d) => `${d} 확인`) || ["현황 점검", "자료 확인", "우선순위 정리"]; }
function pkgDuration(pkg) { return PKG_DURATION[pkg.strat] || "2~6주"; }
function buildScopeDoc(item, pkg, profile) {
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
function buildQuoteText(item, pkg) {
  const name = getCompanyName(item) || item.name;
  const mo = Number(item.proposalMonthlyPremium) || 0;
  const feeLine = mo > 0 ? `· 제안 기준: 월납 ${manToText(mo)} (${Number(item.proposalMonths) || 84}개월 기준, 협의 후 정리)` : `· 제안 금액: 월납 플랜 기준으로 협의 후 정리`;
  return `대표님, ${name} 기준 ${pkg.name} 예상 진행안을 정리해 드립니다.\n· 예상 진행 기간: ${pkgDuration(pkg)} (자료 준비 상황에 따라 조정)\n${feeLine}\n실제 진행 범위와 금액은 자료 확인 및 협의 후 조정될 수 있습니다.`;
}
function scopeKakaoSet(item, pkg) {
  return [
    ["업무범위서 전달", `대표님, 말씀 나눈 ${pkg.name} 기준으로 업무범위 초안을 정리해 보내드립니다. 실제 진행 범위와 수임료는 자료 확인 및 협의 후 조정될 수 있으니, 편하게 보시고 궁금한 부분만 말씀 주세요.`],
    ["견적 확인 요청", `대표님, 보내드린 업무범위 기준 제안 금액은 월납 플랜 기준으로 정리해 드릴 수 있습니다. 다만 자료 범위와 현금흐름에 따라 달라질 수 있어, 우선 자료만 확인한 뒤 범위를 같이 정리해보면 좋겠습니다.`],
    ["검토 후 미팅 제안", `대표님, 업무범위 초안 검토하시고 한 번 짧게 정리해서 설명드리면 좋을 것 같습니다. 부담 없이 우선순위와 범위만 같이 확인하는 자리로 봐주시면 됩니다.`],
    ["보류 고객 재연락", `대표님, 지난번 말씀 주셨던 ${pkg.name} 건은 지금 당장이 아니어도 괜찮습니다. 다만 자료 확인이 늦어지면 선택지가 줄어들 수 있어, 시간 되실 때 현황만 가볍게 점검해두시길 권드립니다.`],
    ["계약 전 최종 확인", `대표님, 진행 전에 업무 범위·제외 범위·예상 수임료·필요 자료를 다시 한 번 정리해 확인 부탁드립니다. 협의 후 정리되면 바로 착수 일정 잡아 진행하겠습니다.`],
  ];
}
const PROPOSAL_STATES = ["제안 전", "제안서 작성", "제안 완료", "견적 전달", "검토 중", "조건 조율", "계약 예정", "계약 완료", "보류"];
const CONTRACT_CHECKLIST = ["고객사 기본정보 확인", "담당자/대표 연락처 확인", "제안 범위 확인", "예상 수임료 확인", "제외 업무 설명 완료", "필요자료 목록 전달", "세무사/전문가 검토 필요사항 안내", "계약서 또는 업무범위서 발송", "착수금/입금 조건 협의", "다음 미팅 일정 정리"];
function recoReason(item, s) {
  const bits = [];
  if (Number(item?.ceoAge) >= 55) bits.push(`대표 ${item.ceoAge}세`);
  if (Number(item?.estYears) >= 10) bits.push(`업력 ${item.estYears}년`);
  if (Number(item?.empCount) >= 20) bits.push(`직원 ${item.empCount}명`);
  const its = (item?.interests || []).filter((i) => s.fields.includes(i));
  if (its.length) bits.push(`${its.join("·")} 관심`);
  return (bits.length ? bits.join(", ") + " → " : "") + `${s.name} 검토 가능성(자료 확인 후 판단)`;
}
function topRecommendations(item) {
  return recommendedStrategiesFor(item).slice(0, 3).map((s) => ({
    name: s.name, reason: recoReason(item, s), docs: s.docs.slice(0, 4),
    risk: s.risk, pitch: s.pitch, needTaxPro: s.needTaxPro,
  }));
}
function buildKakaoSet(item) {
  const main = recommendedStrategiesFor(item)[0];
  const docs = main.docs.slice(0, 3).join(", ");
  return [
    ["1차 연락용", `대표님, 안녕하세요. ${safe(item.industry, "법인")} 대표님들 중에 ${main.name} 쪽을 미리 점검해두면 도움이 되는 경우가 많아 연락드렸습니다. 바로 무언가를 결정하시는 자리가 아니라 현재 상황만 짧게 확인드리는 자리로 봐주시면 됩니다.`],
    ["자료 요청용", `대표님, 말씀 주신 부분을 정확히 보려면 ${docs} 정도를 먼저 확인하면 좋겠습니다. 보내주시면 자료 확인 후 적용 가능성과 우선 점검이 필요한 항목만 추려서 정리드리겠습니다. (적용 여부는 세부 요건 확인이 필요합니다.)`],
    ["미팅 후 정리용", `대표님, 오늘 말씀 나눈 내용 기준으로 보면 바로 결론을 내리기보다 먼저 ${docs} 쪽을 같이 확인해보는 게 좋을 것 같습니다. 자료 확인 후 실제 적용 가능성이 있는 부분만 추려 다시 정리드리겠습니다. (세무사 검토가 필요한 부분은 함께 안내드리겠습니다.)`],
  ];
}
function buildDocRequestText(item) {
  const main = recommendedStrategiesFor(item)[0];
  const name = getCompanyName(item) || item.name;
  return `대표님, ${name} 관련 ${main.name} 검토를 위해 ${main.docs.join(", ")} 정도를 확인하면 좋겠습니다. 자료 확인 후 적용 가능성과 우선 점검이 필요한 항목을 정리드리겠습니다. (적용 여부는 세부 요건 확인이 필요합니다.)`;
}
const REPORT_PROFILE_DEFAULT = { consultant: "김팀장", org: "미래에이아이랩", /* [D-94] 고객에게 나가는 리포트 머리 — 원본 앱 이름 대신 회사 이름 */ title: "컨설턴트", phone: "", email: "", footer: "본 리포트는 상담 전 사전 점검용 자료이며, 실제 적용 여부는 회사의 세부 자료 확인과 세무사·노무사·전문가 검토가 필요합니다." };
const VISIT_BASE_DOCS = ["재무제표(최근 3개년)", "법인등기부등본", "사업자등록증", "정관", "주주명부", "4대보험 사업장 가입자명부", "대출/보증 내역"];
const EXTRA_CHECK_MAP = { "정관정비": "정관·임원보수 규정", "임원퇴직금": "임원퇴직금 규정", "가지급금": "가지급금/가수금 정리", "연구소": "기업부설연구소/벤처", "벤처인증": "벤처·이노비즈 인증", "고용지원금": "고용지원금/통합고용세액공제", "법인세": "연구·인력개발비 세액공제", "정책자금": "정책자금", "사내근로복지기금": "사내근로복지기금", "가업승계": "가업승계/주식가치평가", "미처분이익잉여금": "미처분이익잉여금/이익소각", "주식이동": "주식가치평가" };
function extraCheckItems(item) {
  const out = [];
  (item.interests || []).forEach((i) => { const v = EXTRA_CHECK_MAP[i]; if (v && !out.includes(v)) out.push(v); });
  ["정관·임원보수 규정", "가지급금/가수금 정리", "기업부설연구소/벤처"].forEach((v) => { if (out.length < 3 && !out.includes(v)) out.push(v); });
  return out.slice(0, 6);
}
function visitRequestDocs(item) {
  const recoDocs = topRecommendations(item).flatMap((r) => r.docs);
  return Array.from(new Set([...VISIT_BASE_DOCS, ...recoDocs])).slice(0, 12);
}
function visitReasonText(item, mode) {
  const main = recommendedStrategiesFor(item)[0];
  const facts = [];
  if (Number(item.ceoAge) >= 55) facts.push(`대표님 연령(${item.ceoAge}세)`);
  if (Number(item.estYears) >= 10) facts.push(`업력 ${item.estYears}년`);
  if (Number(item.empCount) >= 20) facts.push(`직원 ${item.empCount}명 규모`);
  const f = facts.join(", ");
  if (mode === "internal") return `${f ? f + " 기준, " : ""}${main.name} 접근 가능성이 있어 보입니다.${item.concern ? ` 대표 고민(${item.concern})과 연결됩니다.` : ""} 우선 점검 후보로 잡고, 자료 확인 후 적용 가능성과 리스크를 구분해 판단하는 흐름을 권합니다.`;
  return `${f ? f + " 등을 보면, " : "대표님 회사 상황을 보면, "}${main.name} 쪽은 시간이 지날수록 선택지가 줄어들 수 있는 부분이라 지금 한 번 가볍게 점검해두시면 좋습니다. 지금 무엇을 결정하시는 자리가 아니라, 혹시 놓치고 있을 수 있는 부분만 함께 확인해보는 자리로 편하게 봐주시면 됩니다.`;
}
function buildVisitKakaoSet(item) {
  const docs = recommendedStrategiesFor(item)[0].docs.slice(0, 3).join(", ");
  return [
    ["1차 상담 후 자료 요청", `대표님, 오늘 시간 내주셔서 감사합니다. 말씀 주신 내용을 좀 더 정확히 보려면 ${docs} 정도를 먼저 확인해보면 좋을 것 같습니다. 편하실 때 보내주시면, 자료 확인 후 우선 점검이 필요한 부분만 추려서 정리해 드리겠습니다.`],
    ["자료 수령 후 검토 안내", `대표님, 자료 잘 받았습니다. 바로 결론을 내리기보다 내용을 차분히 살펴본 뒤, 실제 검토 가능성이 있는 항목만 추려서 다시 정리해 연락드리겠습니다. 세무사 검토가 필요한 부분은 따로 표시해서 함께 안내드리겠습니다.`],
    ["검토 후 2차 미팅 제안", `대표님, 검토한 내용을 한 번 정리해서 보여드리면 좋을 것 같습니다. 부담 없이 현재 상황과 우선순위만 같이 확인하는 자리로, 편하신 시간에 30분 정도만 잡아주시면 정리해서 설명드리겠습니다.`],
  ];
}
const REQUIRED_DOCS = ["사업자등록증", "법인등기부등본", "정관", "주주명부", "4대보험 사업장 가입자명부", "재무제표", "부가세 신고서", "법인세 신고서", "계정별원장", "급여대장", "근로계약서", "임원명부", "특허/인증 서류", "대출/보증 내역"];
function manToText(man) { const m = Math.round(Number(man) || 0); const won = m * 10000; if (won >= 1e8) { const eok = Math.floor(won / 1e8); const rest = Math.round((won % 1e8) / 1e4); return `${eok}억${rest ? " " + rest.toLocaleString() + "만원" : "원"}`; } return m.toLocaleString() + "만원"; }
function insuranceSim(monthly, months, rate) { const mo = Number(monthly) || 0, mm = Number(months) || 84, rt = isFinite(Number(rate)) ? Number(rate) : 100; const total = mo * mm; const base = Math.round(total * rt / 100); return { total, base, months: mm, rate: rt }; }
function getAffordSettings(data) { const s = (data && data.affordSettings) || {}; return { greenPerEok: Number(s.greenPerEok) > 0 ? Number(s.greenPerEok) : 300, yellowPerEok: Number(s.yellowPerEok) > 0 ? Number(s.yellowPerEok) : 600, defMonths: Number(s.defMonths) > 0 ? Number(s.defMonths) : 84, defRate: isFinite(Number(s.defRate)) ? Number(s.defRate) : 100 }; }
function manFromDisplay(s) { if (!s) return null; const t = String(s); let m; if ((m = t.match(/([0-9.,]+)\s*억/))) return Math.round(parseFloat(m[1].replace(/,/g, "")) * 10000); if ((m = t.match(/([0-9.,]+)\s*만원/))) return Math.round(parseFloat(m[1].replace(/,/g, ""))); if ((m = t.match(/([0-9,]+)\s*원/))) return Math.round(parseFloat(m[1].replace(/,/g, "")) / 1e4); return null; }
function custNetIncomeMan(item) {
  if (!item) return null;
  if (isFinite(Number(item.proposalNetIncomeBase)) && Number(item.proposalNetIncomeBase) > 0) return Number(item.proposalNetIncomeBase);
  if (isFinite(Number(item.netIncome)) && Number(item.netIncome) > 0) return Number(item.netIncome);
  const nums = item.financialNumbers || [];
  const hit = nums.find((n) => /당기순이익|순이익/.test(n.label || ""));
  if (hit) { const v = manFromDisplay(hit.display); if (v) return v; }
  return null;
}
function affordability(monthlyMan, netIncomeMan, settings) {
  const st = settings || { greenPerEok: 300, yellowPerEok: 600 };
  const mo = Number(monthlyMan) || 0;
  if (!isFinite(Number(netIncomeMan)) || Number(netIncomeMan) <= 0) return { level: "none", label: "기준 정보 없음", msg: "직전년도 당기순이익을 입력하면 월납 적정성을 확인할 수 있습니다.", greenLimit: 0, yellowLimit: 0, hasBase: false };
  const eok = Number(netIncomeMan) / 10000;
  const greenLimit = Math.round(eok * st.greenPerEok), yellowLimit = Math.round(eok * st.yellowPerEok);
  let level, label, msg;
  if (mo <= greenLimit) { level = "green"; label = "초록 · 검토 여지"; msg = "직전년도 이익 기준으로는 비교적 검토 여지가 있는 월납 규모입니다. 다만 실제 현금흐름과 대표님 의사 확인이 필요합니다."; }
  else if (mo <= yellowLimit) { level = "yellow"; label = "노랑 · 주의"; msg = "직전년도 이익 대비 월납 부담이 다소 커질 수 있습니다. 관계사 현금흐름, 기존 보험료, 대표님 목적자금을 함께 확인하는 것이 좋습니다."; }
  else { level = "red"; label = "빨강 · 부담 큼"; msg = "직전년도 이익만 보면 월납 부담이 클 가능성이 있습니다. 특별한 목적자금이나 관계사 현금흐름이 없다면 금액 조정 검토가 필요합니다."; }
  return { level, label, msg, greenLimit, yellowLimit, hasBase: true, note: "관계사 수익·대표 개인 자금·기존 보험 리모델링 등 예외가 있을 수 있어, 최종 판단은 현금흐름 확인 후 컨설턴트가 조정합니다." };
}
function monthlyPlanText(item, settings, mode) {
  if (!item || !(Number(item.proposalMonthlyPremium) > 0)) return [];
  const mo = Number(item.proposalMonthlyPremium), mm = Number(item.proposalMonths) || 84, rt = isFinite(Number(item.proposalRefundRate)) ? Number(item.proposalRefundRate) : 100;
  const r = insuranceSim(mo, mm, rt);
  const L = ["■ 월납 플랜 검토안 (100% 기준 단순 시뮬레이션)", `· 월납 보험료: ${manToText(mo)}`, `· ${mm}개월 총 납입 기준: ${manToText(r.total)}`, `· 7년차 ${rt}% 기준 예상 목적자금: ${manToText(r.base)}`];
  if (mode === "internal") { const net = custNetIncomeMan(item); const aff = affordability(mo, net, settings || getAffordSettings(null)); if (aff.hasBase) L.push(`· [내부] 직전년도 이익 대비 적정성: ${aff.label}`); }
  L.push("· 해당 금액은 대표 퇴직금·가지급금 정리·세무/승계 목적자금 등으로 검토할 수 있습니다.", "· 상품 조건에 따라 실제 수치가 달라질 수 있으며, 청약 전 상품설명서와 전문가 설명 확인이 필요합니다.");
  return L;
}
const CONSULT_CATALOG = [
  { cat: "인증·연구소", items: [["기업부설연구소 설립", "연구개발 활동과 인력 구조를 확인해 설립 여부를 검토합니다."], ["연구소 사후관리", "설립 후 인력·활동 요건 유지 상태를 점검합니다."], ["벤처기업 인증", "기술성·성장성 요건을 확인해 인증 가능성을 검토합니다."], ["메인비즈/이노비즈", "경영·기술 혁신 평가지표 충족 여부를 점검합니다."]] },
  { cat: "세무·정관", items: [["정관정비", "임원보수·퇴직금 지급근거 등 정관 조항을 점검합니다."], ["임원보수 규정 정비", "임원 보수 지급 기준과 근거 규정을 점검합니다."], ["임원퇴직금 규정", "임원 퇴직금 지급 근거와 한도 규정을 검토합니다."], ["가지급금 정리", "발생 원인과 인정이자 처리 여부를 확인해 정리 방향을 검토합니다."], ["가수금 출자전환", "가수금 발생 경위와 재무 영향, 정리 구조를 점검합니다."], ["미처분이익잉여금 정리 전략", "잉여금 누적에 따른 주식가치·배당·소각 방향을 검토합니다."], ["이익소각/자기주식 검토", "자기주식 취득·이익소각 절차와 세무 영향을 검토합니다."], ["차등배당/배당정책 검토", "주주 구성에 맞는 배당 정책 방향을 점검합니다."], ["법인세 신고 전 사전 점검", "신고 전 주요 계정과 공제 항목을 사전 점검합니다."], ["세무조사 리스크 점검", "거래·계정 구조상 점검이 필요한 부분을 확인합니다."]] },
  { cat: "자금·지원금", items: [["정책자금", "재무구조와 신용상태를 기준으로 자금 조달 방향을 점검합니다."], ["고용지원금", "채용 계획과 신청 순서를 점검합니다."], ["통합고용세액공제", "고용 증가 요건과 적용 가능성을 검토합니다."], ["정부지원사업/바우처 검토", "업종·규모에 맞는 지원사업 후보를 점검합니다."], ["스마트공장/자동화 지원사업 검토", "제조·자동화 분야 지원사업 적합성을 검토합니다."], ["수출바우처/해외진출 지원사업 검토", "수출·해외진출 관련 지원 후보를 점검합니다."], ["보증/대출 리파이낸싱 검토", "기존 차입 구조와 조건 개선 방향을 점검합니다."], ["기업신용등급 관리", "신용평가 항목과 개선 포인트를 점검합니다."]] },
  { cat: "승계·지배구조", items: [["가업승계", "주주구성과 승계 요건, 세무 이슈를 사전 점검합니다."], ["주식가치평가", "재무제표 기반으로 주식가치를 산정해 검토합니다."], ["가족법인/관계사 구조 점검", "관계사 간 거래·지분 구조를 점검합니다."], ["법인전환 검토", "개인사업자 대비 손익과 절차를 비교 검토합니다."], ["개인사업자 법인전환", "전환 시점과 자산 이전 방식을 검토합니다."], ["지배구조 정리", "지분·임원 구조의 정비 방향을 점검합니다."], ["주주간계약/동업 리스크 점검", "동업 구조의 권리·의무와 리스크를 점검합니다."], ["스톡옵션/성과보상제도", "성과 보상 설계 방향을 검토합니다(법률 검토 필요)."]] },
  { cat: "노무·복지", items: [["사내근로복지기금", "복지제도·장기근속과 비용처리 관점을 함께 검토합니다."], ["노무관리 기본 점검", "근로기준·노무 리스크를 기본 점검합니다(노무사 협업)."], ["근로계약서/취업규칙 점검", "계약서·취업규칙의 정비 상태를 점검합니다."], ["4대보험/급여 구조 점검", "급여 구조와 4대보험 적정성을 점검합니다."]] },
  { cat: "지식재산·브랜딩", items: [["특허/상표/디자인권 검토", "보유·출원 가능한 지식재산 범위를 점검합니다."], ["직무발명보상제도", "직무발명 보상 규정 도입 방향을 검토합니다."], ["ESG/기업 신뢰도 자료 정비", "대외 신뢰도 자료의 정비 방향을 점검합니다."], ["홈페이지/브랜딩/마케팅 자동화", "온라인 채널과 마케팅 자동화 방향을 검토합니다."]] },
  { cat: "기타 성장지원", items: [["ISO 인증 검토", "필요 인증 유형과 준비 사항을 점검합니다."], ["법인보험/대표 퇴직금 플랜", "대표 퇴직금·목적자금 재원 마련 방향을 검토합니다."]] },
];
const CONSULT_DESC = (() => { const m = {}; CONSULT_CATALOG.forEach((g) => g.items.forEach(([n, d]) => { m[n] = d; })); return m; })();
function consultDesc(name) { return CONSULT_DESC[name] || "관련 요건과 자료를 확인해 검토합니다."; }
function bundleReason(names) { const a = (names || []).filter(Boolean); if (a.length < 2) return ""; return `${a.slice(0, 3).join(" · ")}${a.length > 3 ? " 등" : ""}은 기업 신뢰도와 자금·세무 흐름에서 서로 연결될 수 있어, 우선순위와 순서를 함께 정리해보는 것이 좋습니다.`; }

export {
  PKG_CATEGORIES, buildDefaultPackages, DEFAULT_PACKAGES, matchPackages, buildProposal,
  SCOPE_TEMPLATES, PKG_DURATION, SCOPE_EXCLUDED, scopeItems, pkgDuration, buildScopeDoc, buildQuoteText, scopeKakaoSet,
  PROPOSAL_STATES, CONTRACT_CHECKLIST, recoReason, topRecommendations, buildKakaoSet, buildDocRequestText,
  REPORT_PROFILE_DEFAULT, VISIT_BASE_DOCS, extraCheckItems, visitRequestDocs, visitReasonText, buildVisitKakaoSet,
  REQUIRED_DOCS, manToText, insuranceSim, getAffordSettings, manFromDisplay, custNetIncomeMan, affordability, monthlyPlanText,
  CONSULT_CATALOG, consultDesc, bundleReason,
};
