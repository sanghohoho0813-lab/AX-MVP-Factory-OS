// @ts-nocheck — 원본 JS 를 그대로 옮긴 규칙 엔진(타입은 salesEngine.d.ts)
/**
 * 영업 규칙 엔진 (D-114 2단계) — 기업컨설팅 OS(영업 도구 모음 · SalesApp.jsx)에서 화면 없이 계산만 옮겼다.
 *  - 전략 17 · 리드 점수 · 전략 추천 TOP3 · 미팅 테마 8 · 1·2·3차 미팅 대본 · 콜드콜 · 후속 카톡 · 고객 플래그 17 · 메모 자동 채우기 · 미팅 메모 분석
 *  - 문구 · 숫자 · 규칙은 원본 그대로. 원본의 색(C.*)만 뺐다 — 화면 색은 운영 OS 테마가 정한다.
 *  - 규칙 계산이다(LLM 호출 없음). 화면에서 'AI' 라고 부르지 않는다.
 * 원본 앱(영업 도구 모음)은 아직 자기 복사본을 쓴다 — 영업 도구 모음을 내릴 때(4단계) 한 벌로 합친다.
 */

// [D-120] 로컬(한국) 날짜 — 원본은 UTC 날짜라 오전 9시 전에는 어제로 찍혔다
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function money(n) {
  const v = Number(n) || 0;
  if (!v) return "-";
  if (Math.abs(v) >= 100000000) return (v / 100000000).toFixed(1).replace(/\.0$/, "") + "억원";
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

export const STRATEGY_LIBRARY = [
  {
    id: "charter",
    name: "정관정비 및 임원보수 규정",
    fields: ["정관정비", "임원퇴직금", "절세"],
    fit: "법인 설립 후 정관을 오래 방치했거나 임원보수·퇴직금 지급근거가 불명확한 법인",
    pitch: "대표님, 이 부분은 절세보다 먼저 방어입니다. 비용처리한 금액을 나중에 문제 없이 지키려면 지급근거가 먼저 정리되어 있어야 합니다.",
    questions: ["최근 정관을 언제 개정하셨나요?", "임원보수와 퇴직금 규정은 별도로 정리되어 있으신가요?", "주주총회 의사록을 매년 작성하고 계신가요?"],
    docs: ["정관", "법인등기부등본", "주주명부", "최근 임원보수 지급내역", "주주총회 의사록"],
    risk: "임원보수·퇴직금 지급근거가 약하면 세무조사 시 소명 부담이 커질 수 있습니다. 세무사 검토가 필요합니다.",
    fee: "100만~250만 원",
    close: "대표님, 이건 큰 절세를 약속드리는 일이 아니라 회사의 기본 방어장치를 정리하는 작업으로 보시면 됩니다.",
    level: "낮음",
    needTaxPro: true,
  },
  {
    id: "retained",
    name: "미처분이익잉여금 정리 전략",
    fields: ["미처분이익잉여금", "가업승계", "주식이동", "절세"],
    fit: "자본금 대비 이익잉여금이 크고 대표 지분이 높은 가족법인",
    pitch: "이익잉여금이 많다는 건 회사가 잘 버텨왔다는 뜻이지만, 동시에 주식가치가 올라가서 증여·상속 때 부담이 커질 수 있다는 뜻이기도 합니다.",
    questions: ["현재 주주 구성이 어떻게 되어 있으세요?", "자녀분이 회사에 들어와 계신가요?", "배당이나 퇴직금 설계를 검토해보신 적 있으세요?"],
    docs: ["최근 3개년 재무제표", "주주명부", "정관", "법인등기부등본", "임원 현황"],
    risk: "주식가치 평가와 세무 검토 없이 단정적으로 절세효과를 안내하면 위험합니다.",
    fee: "200만~700만 원",
    close: "대표님, 지금 바로 실행보다 먼저 주식가치와 세금 영향을 숫자로 확인해보는 게 순서입니다.",
    level: "보통",
    needTaxPro: true,
  },
  {
    id: "succession",
    name: "가업승계 사전준비 플랜",
    fields: ["가업승계", "상속", "증여", "주식이동"],
    fit: "대표 50세 이상, 업력 10년 이상, 자녀 또는 가족 승계 가능성이 있는 법인",
    pitch: "가업승계는 은퇴 직전에 준비하면 늦는 경우가 많습니다. 지금은 실행보다 요건과 주식가치부터 점검하는 단계로 보시면 됩니다.",
    questions: ["자녀분 중 회사에 관여하시는 분이 있으신가요?", "대표님 지분은 몇 % 정도 되시나요?", "승계는 생각만 해보신 건지, 실제로 준비 중이신지요?"],
    docs: ["재무제표", "주주명부", "정관", "가족관계", "임원/근로자 현황", "주식이동 내역"],
    risk: "가업승계 특례·공제는 요건과 사후관리가 중요하므로 세무사 검토 없이 확정 안내하면 안 됩니다.",
    fee: "300만~1,500만 원",
    close: "대표님, 승계는 절세보다 먼저 경영권과 가족 간 분쟁 리스크를 줄이는 관점에서 보시는 게 좋습니다.",
    level: "높음",
    needTaxPro: true,
  },
  {
    id: "suspense",
    name: "가지급금 리스크 정리",
    fields: ["가지급금", "법인세", "종소세", "법인자금"],
    fit: "대표자 가지급금·단기대여금이 있거나 인정이자 처리 여부가 불명확한 법인",
    pitch: "가지급금은 회사 돈이 대표님께 나간 것으로 보일 수 있어서, 세무와 신용평가 양쪽에서 모두 부담이 될 수 있습니다.",
    questions: ["재무제표에 가지급금이나 단기대여금이 잡혀 있나요?", "인정이자는 매년 처리하고 계신가요?", "가지급금이 생긴 이유가 명확히 남아 있나요?"],
    docs: ["계정별원장", "가지급금 명세", "대여금 약정서", "인정이자 처리내역", "재무제표"],
    risk: "정리 방식은 상여·배당·대물변제·상환 등 케이스별로 달라 세무사 검토가 필요합니다.",
    fee: "200만~800만 원",
    close: "대표님, 가지급금은 시간이 지날수록 설명이 어려워질 수 있어서 먼저 규모와 원인을 확인해보셔야 합니다.",
    level: "보통",
    needTaxPro: true,
  },
  {
    id: "rd",
    name: "연구소/세액공제 점검",
    fields: ["연구소", "벤처인증", "법인세", "정책자금"],
    fit: "제조·IT·제품개발 기업 중 연구인력 또는 개발성 비용이 있는 법인",
    pitch: "연구소는 인증 하나로 끝나는 게 아니라 세액공제, 정책자금, 기술평가까지 연결될 수 있어 회사 상황을 먼저 점검해볼 만합니다.",
    questions: ["개발·설계·품질개선 담당 인력이 있나요?", "연구개발비나 인건비 세액공제를 검토해보셨나요?", "벤처나 연구소 인증은 보유 중이신가요?"],
    docs: ["조직도", "직원명부", "업무분장표", "연구개발 관련 자료", "재무제표"],
    risk: "형식만 맞춘 연구소는 사후관리 리스크가 있어 실제 연구활동과 기록 관리가 중요합니다.",
    fee: "150만~500만 원",
    close: "대표님, 연구소는 받을 수 있냐보다 유지 가능한 구조인지 먼저 보는 게 중요합니다.",
    level: "낮음",
    needTaxPro: false,
  },
  {
    id: "welfare",
    name: "사내근로복지기금/복지제도",
    fields: ["사내근로복지기금", "절세", "인사노무"],
    fit: "직원 수가 있고 장기근속·복지·법인세 절세를 함께 고민하는 법인",
    pitch: "복지제도는 단순 비용이 아니라 직원 만족도와 법인 비용처리를 함께 보는 구조로 검토할 수 있습니다.",
    questions: ["직원 복지비를 별도로 쓰고 계신가요?", "장기근속 유도나 핵심인력 이탈 고민이 있으신가요?", "복지비 지출의 세무처리는 어떻게 하고 계신가요?"],
    docs: ["직원 수", "급여대장", "복지비 지출내역", "정관", "재무제표"],
    risk: "기금 목적과 집행 기준을 맞춰야 하며 노무·세무 검토가 함께 필요할 수 있습니다.",
    fee: "200만~600만 원",
    close: "대표님, 직원 복지는 쓰는 돈이 아니라 관리되는 제도로 바꾸는 게 핵심입니다.",
    level: "보통",
    needTaxPro: true,
  },
  {
    id: "venture", name: "벤처기업 인증", fields: ["벤처인증", "정책자금", "법인세"],
    fit: "기술성·성장성이 있는 제조·IT·제품개발 법인 중 인증 미보유 기업",
    pitch: "벤처 인증은 그 자체보다 세제·정책자금·정부지원사업 가점으로 연결되는 출발점으로 보시면 됩니다. 적용 여부는 세부 요건 확인이 필요합니다.",
    questions: ["주력 제품·기술의 자체 개발 비중은 어느 정도이신가요?", "벤처·이노비즈 인증을 검토해보신 적 있으신가요?", "투자유치나 정부지원사업 참여 계획이 있으신가요?"],
    docs: ["사업자등록증", "재무제표", "기술 관련 자료", "연구개발/특허 현황", "조직도"],
    risk: "인증 유형별 요건과 사후관리가 다르므로 자료 확인 후 판단이 필요합니다.",
    fee: "150만~500만 원", close: "대표님, 우선 우리 회사가 어떤 인증 유형에 맞는지부터 점검해보는 게 순서입니다.", level: "보통", needTaxPro: false,
  },
  {
    id: "mainbiz", name: "메인비즈/이노비즈 인증", fields: ["벤처인증", "정책자금"],
    fit: "업력이 있고 경영·기술 혁신 활동이 있는 중소법인",
    pitch: "메인비즈·이노비즈는 정책자금·입찰 가점 등에서 활용될 수 있어 회사 상황에 맞는지 우선 점검해볼 만합니다.",
    questions: ["경영혁신·기술혁신 관련 활동이 있으신가요?", "정책자금이나 입찰 참여 계획이 있으신가요?", "기존 인증 보유 현황은 어떻게 되시나요?"],
    docs: ["재무제표", "사업계획 관련 자료", "조직도", "인증 보유 현황"],
    risk: "평가지표 충족 여부는 자료 확인 후 판단이 필요합니다.", fee: "150만~400만 원",
    close: "대표님, 인증은 받는 것보다 활용 계획과 함께 보는 게 중요합니다.", level: "낮음", needTaxPro: false,
  },
  {
    id: "policyfund", name: "정책자금 점검", fields: ["정책자금", "법인세"],
    fit: "운전·시설자금 수요가 있는 성장기 법인(재무·신용 상태 점검 선행)",
    pitch: "정책자금은 금리보다 우리 회사가 어떤 자금에 적합한지와 재무·신용 상태 점검이 먼저입니다. 가능 여부는 추가 확인이 필요합니다.",
    questions: ["현재 운전자금·시설자금 중 어느 쪽 수요가 크신가요?", "최근 재무제표상 부채비율·신용등급은 점검해보셨나요?", "기존에 정책자금을 이용해보신 적 있으신가요?"],
    docs: ["최근 3개년 재무제표", "부채/대출 현황", "사업계획 관련 자료", "신용 관련 자료"],
    risk: "재무·신용 상태에 따라 가능성이 달라지므로 단정하지 않고 자료 확인 후 판단이 필요합니다.",
    fee: "착수금+성공보수 협의", close: "대표님, 우선 재무제표 기준으로 가능성과 보완 항목을 먼저 정리해보겠습니다.", level: "보통", needTaxPro: false,
  },
  {
    id: "employ", name: "고용지원금 점검", fields: ["고용지원금"],
    fit: "채용 예정이거나 최근 인원이 늘고 있는 법인",
    pitch: "고용지원금은 금액보다 채용 순서가 중요할 때가 많습니다. 채용 전 점검이 우선이며, 수급 여부는 추가 확인이 필요합니다.",
    questions: ["올해 채용 계획과 예상 입사 시점은 어떻게 되시나요?", "청년·고령자 등 채용 대상 연령대는 어떻게 되시나요?", "근로계약·4대보험 등 노무 서류는 정비되어 있으신가요?"],
    docs: ["4대보험 가입자명부", "근로계약서", "급여대장", "채용계획 자료"],
    risk: "지원금별 요건·신청 순서가 다르므로 노무사 협업과 자료 확인이 필요합니다.", fee: "200만~500만 원",
    close: "대표님, 채용 전에 신청 순서부터 점검해두면 놓치는 부분을 줄일 수 있습니다.", level: "낮음", needTaxPro: false,
  },
  {
    id: "rndtax", name: "연구인력개발비 세액공제 점검", fields: ["연구소", "법인세", "정책자금"],
    fit: "개발성 비용(인건비·재료비 등)을 쓰고 있는 제조·IT 법인",
    pitch: "이미 R&D 비용을 쓰고 계신다면 연구인력개발비 세액공제 적용 가능성을 함께 점검해볼 만합니다. 적용 여부는 세부 요건 확인이 필요합니다.",
    questions: ["개발·설계 인력의 인건비 규모는 어느 정도이신가요?", "연구개발 활동 기록(연구노트 등)은 관리되고 있으신가요?", "기존에 세액공제를 적용해보신 적 있으신가요?"],
    docs: ["조직도", "직원명부", "연구개발비 내역", "재무제표", "연구활동 기록"],
    risk: "사후관리·소명 리스크가 있어 실제 연구활동 근거와 세무사 검토 권장이 필요합니다.", fee: "150만~600만 원",
    close: "대표님, 공제는 받는 것보다 소명 가능한 구조인지 먼저 보는 게 안전합니다.", level: "보통", needTaxPro: true,
  },
  {
    id: "integemploy", name: "통합고용세액공제 점검", fields: ["고용지원금", "법인세"],
    fit: "상시근로자 수가 늘고 있는 법인",
    pitch: "고용을 늘리고 계신다면 통합고용세액공제 적용 가능성을 함께 점검해볼 만합니다. 적용 여부는 세부 요건 확인이 필요합니다.",
    questions: ["최근 1~2년 상시근로자 수 변화는 어떠셨나요?", "청년·장애인 등 우대 대상 채용이 있으셨나요?", "4대보험 가입자명부는 정리되어 있으신가요?"],
    docs: ["4대보험 가입자명부", "급여대장", "재무제표", "근로계약서"],
    risk: "근로자 수 산정·사후관리 요건이 있어 세무사 검토 권장이 필요합니다.", fee: "200만~600만 원",
    close: "대표님, 공제는 인원 산정 기준이 핵심이라 자료부터 정리해보겠습니다.", level: "보통", needTaxPro: true,
  },
  {
    id: "execretire", name: "임원퇴직금 규정 정비", fields: ["임원퇴직금", "정관정비", "법인보험"],
    fit: "임원퇴직금 지급규정이 없거나 오래되어 지급근거가 불명확한 법인",
    pitch: "임원퇴직금은 규정과 지급근거가 먼저 정비되어 있어야 나중에 문제 없이 활용할 수 있습니다. 한도·손금 인정은 자료 확인 후 판단이 필요합니다.",
    questions: ["임원퇴직금 지급규정이 별도로 마련되어 있으신가요?", "정관에 위임 근거가 반영되어 있으신가요?", "퇴직금 재원 마련은 어떻게 준비하고 계신가요?"],
    docs: ["정관", "임원퇴직금 지급규정", "주주총회 의사록", "재무제표"],
    risk: "한도 초과·지급근거 미비 시 손금 부인 가능성이 있어 세무사 검토 권장이 필요합니다.", fee: "150만~400만 원",
    close: "대표님, 퇴직금은 받는 시점이 아니라 규정부터 정리해두는 게 순서입니다.", level: "낮음", needTaxPro: true,
  },
  {
    id: "gasugeum", name: "가수금 출자전환 검토", fields: ["가수금", "정관정비"],
    fit: "대표가 회사에 빌려준 가수금(대표 대여금)이 누적된 법인",
    pitch: "가수금은 정리 방식에 따라 재무구조와 세무에 영향을 줄 수 있어, 출자전환 등은 자료 확인 후 판단이 필요합니다.",
    questions: ["재무제표에 가수금(대표 대여금)이 잡혀 있는지 알고 계신가요?", "가수금이 생긴 원인이 명확히 남아 있나요?", "증자나 출자전환을 검토해보신 적 있으신가요?"],
    docs: ["계정별원장", "가수금 명세", "정관", "재무제표"],
    risk: "출자전환·정리 방식은 세무·법률 영향이 있어 세무사 검토 권장이 필요합니다.", fee: "200만~600만 원",
    close: "대표님, 가수금도 규모와 원인부터 확인한 뒤 정리 방향을 잡는 게 안전합니다.", level: "보통", needTaxPro: true,
  },
  {
    id: "stockvalue", name: "주식가치평가", fields: ["주식이동", "미처분이익잉여금", "가업승계"],
    fit: "승계·증여·주식이동을 검토 중인 비상장 가족법인",
    pitch: "주식이동이나 승계는 비상장주식 가치 평가가 모든 판단의 출발점입니다. 평가 결과에 따라 전략이 달라지므로 자료 확인 후 판단이 필요합니다.",
    questions: ["최근 비상장주식 가치를 평가해보신 적 있으신가요?", "주주 구성과 지분율은 어떻게 되어 있으신가요?", "증여·양도·소각 중 검토 중인 방향이 있으신가요?"],
    docs: ["최근 3개년 재무제표", "주주명부", "정관", "주식이동 내역"],
    risk: "평가 방법·시점에 따라 결과가 달라지므로 세무사 검토 권장이 필요합니다.", fee: "150만~500만 원",
    close: "대표님, 숫자부터 확인한 뒤 증여·이동 방향을 정하는 게 순서입니다.", level: "보통", needTaxPro: true,
  },
  {
    id: "profitcancel", name: "이익소각 검토", fields: ["미처분이익잉여금", "주식이동", "법인세"],
    fit: "이익잉여금이 크고 자기주식 취득·소각 여력이 있는 가족법인",
    pitch: "이익소각은 미처분이익잉여금과 주식가치 관리의 한 방법으로 검토될 수 있으나, 절차·세무 영향이 커서 자료 확인 후 판단이 필요합니다.",
    questions: ["미처분이익잉여금 규모는 어느 정도이신가요?", "자기주식 취득·소각을 검토해보신 적 있으신가요?", "정관에 관련 근거가 마련되어 있으신가요?"],
    docs: ["재무제표", "주주명부", "정관", "주주총회/이사회 의사록"],
    risk: "절차 위반·과세 리스크가 있어 반드시 세무사 검토 권장이 필요합니다.", fee: "300만~1,000만 원",
    close: "대표님, 이익소각은 효과보다 절차와 세무 리스크를 먼저 점검해야 합니다.", level: "높음", needTaxPro: true,
  },
  {
    id: "corpinsure", name: "법인보험·대표 퇴직금 플랜", fields: ["법인보험", "임원퇴직금", "절세"],
    fit: "대표 퇴직금 재원·법인자금 운용을 함께 고민하는 법인",
    pitch: "법인보험은 상품 가입이 목적이 아니라 퇴직금 재원·자금 운용 관점에서 규정 정비와 함께 검토되어야 합니다. 효과는 자료 확인 후 판단이 필요합니다.",
    questions: ["대표 퇴직금 재원은 어떻게 준비하고 계신가요?", "임원퇴직금 규정은 정비되어 있으신가요?", "기존 법인보험 가입 현황은 어떻게 되시나요?"],
    docs: ["정관", "임원퇴직금 규정", "재무제표", "기존 보험 증권"],
    risk: "상품 권유보다 규정·세무 정비가 먼저이며, 손금·과세는 세무사 검토 권장이 필요합니다.", fee: "규정 정비 기준 협의",
    close: "대표님, 보험보다 먼저 퇴직금 규정과 재원 구조를 정리하는 게 순서입니다.", level: "보통", needTaxPro: true,
  },
];

export const NEED_WEIGHT = {
  "가업승계": 9, "미처분이익잉여금": 6, "가지급금": 6, "정관정비": 4, "주식이동": 3,
  "연구소": 5, "벤처인증": 3, "정책자금": 3, "사내근로복지기금": 4, "임원퇴직금": 3,
  "법인세": 2, "종소세": 2, "절세": 1, "고용지원금": 3, "법인전환": 3, "법인보험": 2,
};
// 진행단계가 뒤로 갈수록(=상담/미팅 이력) 따뜻한 고객.
const STAGE_WEIGHT = {
  lead: 0, contacted: 2, meeting_proposed: 3, meeting1_scheduled: 4, meeting1_done: 5,
  docs_requested: 6, meeting2_scheduled: 7, meeting2_done: 8, proposal_sent: 9,
  closing_scheduled: 10, decision_pending: 8, contracted: 5, hold: 1, lost: 0,
};
function scoreLead(l) {
  let s = 40;
  const rev = Number(l.revenue) || 0;
  const emp = Number(l.empCount) || 0;
  const age = Number(l.ceoAge) || 0;
  const years = Number(l.estYears) || 0;
  const interests = l.interests || [];
  // 규모
  if (rev >= 1000) s += 3;
  if (rev >= 3000) s += 3;
  if (rev >= 6000) s += 3;
  if (emp >= 5) s += 2;
  if (emp >= 20) s += 2;
  // 대표 연령·업력(승계 적합성)
  if (age >= 50) s += 3;
  if (age >= 50 && years >= 10) s += 3;
  // 니즈 뚜렷도(상한 16)
  let nw = 0;
  interests.forEach((i) => { nw += NEED_WEIGHT[i] || 1; });
  s += Math.min(16, nw);
  // 접근경로
  if (["소개", "교육/세미나"].includes(l.source)) s += 3;
  else if (["유튜브", "블로그"].includes(l.source)) s += 2;
  else if (["인스타", "광고", "전화"].includes(l.source)) s += 1;
  // 진행단계
  s += STAGE_WEIGHT[l.stage] || 0;
  if (l.nextDate) s += 1;
  // 100점은 쓰지 않는다. 현실적인 상한 88.
  return Math.max(20, Math.min(88, s));
}
// 점수 → 등급 라벨/색상

/** 점수 → 등급 (원본 scoreBand 에서 색만 뺐다) */
export const SCORE_TIERS = [
  { min: 85, key: "high", label: "계약 가능성 높음", short: "높음" },
  { min: 70, key: "chase", label: "적극 추적", short: "적극추적" },
  { min: 55, key: "nurture", label: "관심 유도 필요", short: "관심유도" },
  { min: 40, key: "long", label: "장기 육성", short: "장기육성" },
  { min: 0, key: "low", label: "낮음", short: "낮음" },
];
export function scoreTier(score) {
  return SCORE_TIERS.find((t) => score >= t.min) || SCORE_TIERS[SCORE_TIERS.length - 1];
}

export function recommendedStrategiesFor(item) {
  const tags = item?.interests || [];
  const text = `${item?.concern || ""} ${item?.memo || ""} ${item?.industry || ""} ${item?.field || ""} ${item?.keywords || ""} ${item?.summary || ""}`;
  let arr = STRATEGY_LIBRARY.map((s) => {
    let score = 0;
    s.fields.forEach((f) => {
      if (tags.includes(f)) score += 15;
      if (text.includes(f)) score += 10;
    });
    if (s.id === "succession" && Number(item?.ceoAge) >= 50 && Number(item?.estYears) >= 10) score += 20;
    if (s.id === "rd" && ["제조업", "IT/소프트웨어"].includes(item?.industry)) score += 10;
    return { ...s, score };
  });
  arr = arr.filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
  return arr.length ? arr.slice(0, 3) : STRATEGY_LIBRARY.slice(0, 3);
}

export function buildLeadPlan(lead) {
  const score = scoreLead(lead);
  const strategies = recommendedStrategiesFor(lead);
  const main = strategies[0];
  const interestText = (lead.interests || []).join(", ") || "세금·자금·인증";
  return {
    priority: scoreTier(score).label,
    tier: scoreTier(score).key,
    score,
    target: `${safe(lead.industry, "해당 업종")} / 매출 ${wonFromMillion(lead.revenue)} / 직원 ${safe(lead.empCount, "-")}명 / 관심주제: ${interestText}`,
    hook: `대표님, ${safe(lead.industry, "법인")} 기준으로 ${main.name} 쪽은 한 번 점검해볼 필요가 있어 보여서 연락드렸습니다. 확정적인 안내보다 현재 자료 기준으로 가능성과 리스크를 먼저 확인드리는 방식입니다.`,
    phone: `안녕하세요 대표님. 저는 법인 세무·자금 구조를 점검해드리는 컨설턴트입니다.\n${safe(lead.name, "대표님 회사")}처럼 ${safe(lead.industry, "법인")}이고 업력이 ${safe(lead.estYears, "-")}년 정도 되는 회사는 ${main.name}을 단순 절세가 아니라 리스크 관리 관점에서 한 번 보는 경우가 많습니다.\n혹시 정관, 주주구성, 세액공제, 승계나 법인자금 구조 쪽을 최근에 점검해보신 적 있으실까요?`,
    kakao: `대표님, 안녕하세요. 오늘 통화드린 내용 간단히 정리드립니다.\n\n대표님 회사 상황에서는 ${main.name} 관련해서 먼저 자료 기준 점검을 해보면 좋을 것 같습니다.\n확정적으로 가능하다는 의미는 아니고, 정관·재무제표·주주구성 등을 확인한 뒤 적용 가능성과 리스크를 구분해서 보자는 취지입니다.\n\n가능하시면 1차로 현재 상황만 짧게 확인드리고, 필요 시 2차 미팅에서 구체적으로 정리해드리겠습니다.`,
    objections: [
      ["지금 바빠요", "네 대표님, 그래서 길게 설명드리기보다 해당 여부만 먼저 체크해드리는 방식으로 진행드리겠습니다. 지금이 어려우시면 편하신 시간에 10분만 잡아도 충분합니다."],
      ["세무사가 있어요", "당연히 세무사님 검토가 가장 중요합니다. 저는 세무사님이 보시기 전에 대표님 회사에서 어떤 항목을 질문하고 확인해야 하는지 정리해드리는 역할로 보시면 됩니다."],
      ["보험 얘기인가요?", "보험을 먼저 말씀드리는 건 아닙니다. 회사 상황에 따라 여러 선택지가 있을 수 있고, 먼저 정관·재무·세무 리스크를 보는 게 순서입니다."],
    ],
    meetingBridge: `1차 미팅에서는 상품 제안보다 대표님 회사의 현재 상황을 듣고, ${main.name}이 실제로 검토할 만한지 확인하는 데 집중하는 것이 좋습니다.`,
    products: strategies.map((s) => s.name),
  };
}

// 관심주제 → 미팅 테마 매핑
const INTEREST_THEME = {
  "가업승계": "succession", "미처분이익잉여금": "succession", "주식이동": "succession",
  "가지급금": "suspense",
  "연구소": "rd", "벤처인증": "rd",
  "고용지원금": "employment",
  "사내근로복지기금": "welfare",
  "법인전환": "conversion",
  "정관정비": "charter", "임원퇴직금": "charter",
};
// 미팅 테마 감지 — 가장 앞선(우선순위 높은) 관심주제를 기준으로 1차 질문 세트를 결정한다.
function detectTheme(item) {
  const it = item?.interests || [];
  for (const i of it) { if (INTEREST_THEME[i]) return INTEREST_THEME[i]; }
  const text = `${item?.concern || ""} ${item?.memo || ""} ${item?.field || ""} ${item?.keywords || ""}`;
  const keys = ["가업승계", "미처분이익잉여금", "주식이동", "가지급금", "연구소", "벤처인증", "고용지원금", "사내근로복지기금", "법인전환", "정관정비", "임원퇴직금"];
  for (const k of keys) { if (text.includes(k)) return INTEREST_THEME[k]; }
  return "general";
}
const DEFAULT_M2_OBJ = [
  ["세무사에게 물어볼게요", "좋습니다. 오히려 세무사님께 확인하실 수 있도록 검토 포인트를 정리해드리겠습니다. (세무사 검토 권장)"],
  ["지금 당장 급한 건 아닌 것 같은데요", "맞습니다. 다만 이런 구조는 급할 때 처리하면 선택지가 줄어드는 경우가 있어, 우선 현황만 점검해두시길 권드립니다."],
  ["비용이 얼마나 드나요?", "정확한 비용은 범위에 따라 달라집니다. 우선 필수 점검 범위와 선택 가능한 확장 범위를 나눠서 제안드리겠습니다."],
];
const MEETING_THEMES = {
  succession: {
    label: "가업승계·주식가치",
    openFocus: "주식가치 상승과 상속·증여 부담, 가족 승계 구조에서 먼저 점검할 부분이 있는지",
    avoid: "정책자금이나 단기 절세보다 승계·주식가치·상속세 리스크를 우선 점검 주제로 잡으세요. 절세효과는 자료 확인 후 판단.",
    m1q: [
      "대표님 지분과 가족 주주 구성은 현재 어떻게 되어 있으신가요?",
      "자녀분이나 가족이 회사 경영에 관여하고 계신가요?",
      "최근 비상장주식 가치(주식가치 평가)를 확인해보신 적 있으신가요?",
      "이익잉여금이 매년 쌓이고 있다면 배당·퇴직금 설계는 검토해보셨는지요?",
      "정관과 임원퇴직금 규정은 승계를 염두에 두고 정비되어 있으신가요?",
      "승계는 구상 단계이신지, 실제 준비를 시작하신 단계인지 궁금합니다.",
      "대표님 은퇴·승계 시점은 대략 어떻게 그리고 계신가요?",
      "상속·증여세 부담에 대해 미리 점검해보신 적 있으신가요?",
    ],
  },
  suspense: {
    label: "가지급금·법인자금",
    openFocus: "법인 통장에서 나간 자금이 재무제표에 어떻게 남아 있는지, 정리 방향을",
    avoid: "가지급금을 바로 '문제'로 단정하지 말고 규모와 원인 확인이 먼저임을 설명하세요. 정리 방식은 세무사 검토 권장.",
    m1q: [
      "재무제표에 가지급금이나 대표자 단기대여금이 잡혀 있는지 알고 계신가요?",
      "법인 통장에서 개인 용도로 나간 자금이 있었다면 정리 근거가 남아 있나요?",
      "인정이자는 매년 처리되고 있는지 확인해보셨는지요?",
      "가지급금이 생긴 원인(설립초기·자금융통 등)이 명확히 남아 있나요?",
      "정관·임원보수·퇴직금 규정은 최근 정비하셨나요?",
      "기존 세무사님과 가지급금 정리 방안을 논의해보신 적 있으신가요?",
      "급여·상여·배당 중 어떤 방식이 가능한지 검토해보셨는지요?",
      "법인 신용평가나 대출 심사에서 가지급금이 언급된 적 있으신가요?",
    ],
  },
  rd: {
    label: "연구소·세액공제·인증",
    openFocus: "이미 쓰고 계신 개발성 비용을 세액공제·인증과 함께 점검할 수 있는지",
    avoid: "받을 수 있다고 단정하지 말고, 요건과 사후관리까지 유지 가능한 구조인지 함께 점검한다고 안내하세요.",
    m1q: [
      "개발·설계·품질개선을 담당하는 인력이 있으신가요?",
      "연구개발성 비용(인건비·재료비 등) 규모는 어느 정도이신가요?",
      "기업부설연구소나 연구개발전담부서는 보유하고 계신가요?",
      "연구·인력개발비 세액공제를 적용해보신 적 있으신가요?",
      "벤처·이노비즈 등 인증은 보유 또는 검토 중이신가요?",
      "정부지원사업(R&D 과제 등) 참여 경험이나 계획이 있으신가요?",
      "인증·세액공제 사후관리(연구활동 기록 등)는 준비되어 있으신가요?",
      "투자유치나 기업가치 평가가 필요한 상황이신가요?",
    ],
  },
  employment: {
    label: "고용지원금·노무",
    openFocus: "채용 순서와 노무 리스크를 먼저 점검할 부분이 있는지",
    avoid: "지원 금액이나 수급 가능 여부를 단정하지 말고, 채용 순서·노무 리스크를 먼저 점검해야 한다는 흐름으로 접근하세요.",
    m1q: [
      "올해 직원 채용 계획이 있으신가요? 예상 입사 시점은 언제쯤인가요?",
      "지금까지 고용 관련 지원금을 신청해보신 적 있으신가요?",
      "채용 전후 지원금 신청 순서를 확인해보신 적 있으신가요?",
      "근로계약서·4대보험 등 기본 노무 서류는 정비되어 있으신가요?",
      "청년·고령자 등 채용 대상의 연령대는 어떻게 되시나요?",
      "기존 직원의 근속·이직 현황은 어떤 편인가요?",
      "노무 관련해서 최근 부담되거나 헷갈리는 부분이 있으셨나요?",
      "복지제도나 사내 규정은 별도로 운영하고 계신가요?",
    ],
  },
  welfare: {
    label: "사내근로복지기금·복지",
    openFocus: "직원 복지·장기근속과 법인 비용처리를 함께 보는 구조가 맞을지",
    avoid: "복지·소득공제 효과를 단정하지 말고(특히 병의원 등 업종 특성은 추가 확인 필요), 제도화 관점에서 우선 점검하세요.",
    m1q: [
      "현재 직원 복지비나 복지제도는 어떻게 운영하고 계신가요?",
      "핵심 인력의 장기근속이나 이탈에 대한 고민이 있으신가요?",
      "복지비 지출의 세무처리(비용 인정 등)는 어떻게 하고 계신가요?",
      "임직원 만족도나 동기부여 관련해서 고민이 있으셨나요?",
      "법인세 절세와 복지를 함께 보는 구조를 검토해보신 적 있으신가요?",
      "급여대장·복지비 지출내역 등 자료는 정리되어 있으신가요?",
      "대표님 본인의 소득세 부담도 함께 고민이 되시는 상황인가요?",
      "업종 특성상 복지·인증 구조가 일반 법인과 다를 수 있는데, 들어보신 내용이 있으신가요?",
    ],
  },
  conversion: {
    label: "법인전환·소득세",
    openFocus: "개인사업자 소득세 부담과 법인 전환 타당성을 점검할 부분이 있는지",
    avoid: "전환이 무조건 유리하다고 단정하지 말고, 타당성은 자료 확인 후 판단해야 함을 안내하세요.",
    m1q: [
      "현재 개인사업자이신가요, 법인이신가요?",
      "종합소득세 부담이 어느 정도 되시는지 체감하고 계신가요?",
      "법인 전환을 고려하시게 된 계기가 있으신가요?",
      "전환 시 자산·부채·영업권 이전에 대해 들어보신 적 있으신가요?",
      "4대보험·급여체계 변화에 대한 고민이 있으신가요?",
      "전환 이후 대표님 급여·배당 설계는 검토해보셨는지요?",
      "기존 세무사님과 전환 타당성을 논의해보신 적 있으신가요?",
      "전환 시점이나 목표가 정해져 있으신가요?",
    ],
  },
  charter: {
    label: "정관정비·임원보수",
    openFocus: "정관과 임원보수·퇴직금 지급근거가 정비되어 있는지",
    avoid: "큰 절세를 약속하기보다, 비용처리한 금액을 지키는 '방어장치' 정비 관점으로 접근하세요.",
    m1q: [
      "정관을 마지막으로 개정하신 게 언제쯤이신가요?",
      "임원보수와 퇴직금 규정은 별도로 정리되어 있으신가요?",
      "주주총회·이사회 의사록은 매년 작성하고 계신가요?",
      "비용처리한 임원보수의 지급근거가 정관·규정에 반영되어 있나요?",
      "최근 임원 변경이나 보수 조정이 있으셨나요?",
      "정관상 사업목적이 현재 사업과 일치하나요?",
      "향후 배당·퇴직금·승계를 염두에 둔 조항이 있으신가요?",
      "기존 세무사님과 정관 관련 점검을 해보신 적 있으신가요?",
    ],
  },
  general: {
    label: "세무·자금 구조 전반",
    openFocus: "세금·자금·승계·인증 쪽에서 먼저 점검할 부분이 있는지",
    avoid: "처음부터 보험·고액 컨설팅·확정 절세금액을 말하지 말고, 대표님이 반응하는 주제를 먼저 확인하세요.",
    m1q: [
      "최근 회사에서 가장 부담되는 비용이나 세금 항목은 무엇인가요?",
      "정관이나 임원퇴직금 규정은 최근에 점검해보신 적 있으세요?",
      "대표님 지분과 가족 주주 구성은 어떻게 되어 있으세요?",
      "자녀분이나 가족이 회사에 관여하고 계신가요?",
      "법인세나 종소세 부담 때문에 고민하신 적 있으세요?",
      "가지급금이나 대표자 대여금 계정이 있는지 알고 계신가요?",
      "기업부설연구소나 벤처·이노비즈 인증은 검토해보셨나요?",
      "직원 채용 계획이나 고용지원금 검토 경험이 있으세요?",
    ],
  },
};
function buildMeetingPlan(item, stage) {
  const strategies = recommendedStrategiesFor(item);
  const main = strategies[0];
  const name = getCompanyName(item) || item.name || "대표님 회사";
  const theme = detectTheme(item);
  const pb = MEETING_THEMES[theme] || MEETING_THEMES.general;
  const age = Number(item?.ceoAge) || 0;
  const emp = Number(item?.empCount) || 0;
  const industry = item?.industry || "법인";
  // 대표나이·직원수·업종 기반 동적 질문(테마와 겹치지 않을 때만 추가)
  const dynamic = [];
  if (age >= 55 && theme !== "succession") dynamic.push("대표님 연령·업력을 고려하면 승계나 주식가치 쪽도 언젠가 점검이 필요할 수 있는데, 생각해보신 적 있으신가요?");
  if (emp >= 20 && !["employment", "welfare"].includes(theme)) dynamic.push(`직원이 ${emp}명 규모이신데, 인력·노무나 복지제도 쪽 고민도 함께 있으신가요?`);
  if (["제조업", "IT/소프트웨어"].includes(industry) && theme !== "rd") dynamic.push("개발·설계 인력이 있으시면 연구소·세액공제도 함께 점검해볼 수 있는데, 해당되실까요?");
  const finQ = (item && item.financialSummary && item.financialSummary.questions) || [];
  const finDocs = (item && item.financialSummary && item.financialSummary.docs) || [];
  const m1Questions = [...finQ, ...pb.m1q, ...dynamic].slice(0, 12);
  if (stage === "m1") {
    return {
      title: "1차 미팅 준비",
      goal: `상품을 바로 파는 자리가 아니라, ${industry} 특성과 대표님 상황에서 ${pb.label} 쪽을 우선 점검할 만한지 확인해 2차 미팅 명분을 만드는 단계입니다.`,
      opening: `대표님, 오늘은 무언가를 바로 결정하시는 자리가 아니라 ${name}의 ${pb.openFocus} 확인하는 자리로 봐주시면 됩니다.`,
      questions: m1Questions,
      avoid: pb.avoid,
      next: `2차 미팅에서는 ${main.name}을 중심으로 자료 기반 진단을 보여주는 흐름이 좋습니다. (적용 가능성과 리스크는 자료 확인 후 판단)`,
      kakao: `대표님, 오늘 말씀 나눈 내용을 정리해보니 ${pb.label} 관련해서 ${main.name} 쪽은 한 번 자료 기준으로 확인해볼 필요가 있어 보입니다.\n정확한 판단은 ${main.docs.slice(0, 3).join(", ")} 등을 본 뒤 가능하므로, 우선 필요한 자료를 정리해서 보내드리겠습니다. (세무사 검토 권장 부분은 함께 안내드리겠습니다.)`,
      docs: Array.from(new Set([...finDocs, ...main.docs])),
    };
  }
  if (stage === "m2") {
    return {
      title: "2차 미팅 준비",
      goal: `${pb.label}을(를) 첫 번째 축으로, 전문성을 보여주되 겁주기보다 '우선순위'를 정리해주는 단계입니다.`,
      topIssues: strategies.map((s, idx) => `${idx + 1}. ${s.name} — ${s.pitch}`),
      approach: `이번 미팅은 ${main.name}을 첫 번째 이슈로 잡고, 이후 ${strategies.slice(1).map((s) => s.name).join(" → ") || "추가 점검"} 순서로 확장하는 것이 좋습니다. (각 항목은 자료 확인 후 판단)`,
      objections: DEFAULT_M2_OBJ,
      close: `대표님, 오늘 바로 전부 진행하자는 의미는 아닙니다. 우선 ${main.name}부터 정리하고, 나머지는 회사 상황에 맞춰 단계적으로 보시는 게 좋겠습니다.`,
      docs: Array.from(new Set(strategies.flatMap((s) => s.docs))).slice(0, 10),
      fee: strategies.map((s) => `${s.name}: ${s.fee}`).join("\n"),
    };
  }
  return {
    title: "3차 클로징 준비",
    goal: `고객의 의사결정 장애물을 제거하고, ${pb.label} 중심으로 첫 계약 범위를 명확히 정하는 단계입니다.`,
    strategy: `처음부터 전체 패키지를 강하게 밀기보다 ${main.name}을 1차 계약으로 제안하고, 이후 자료 검토 결과에 따라 확장하는 방식이 안정적입니다.`,
    proposal: `${main.name}\n- 예상 범위: ${main.fee}\n- 필요자료: ${main.docs.join(", ")}\n- 세무사 검토 필요 여부: ${main.needTaxPro ? "필요(세무사 검토 권장)" : "상황에 따라 추가 확인 필요"}`,
    priceTalk: `대표님, 이 비용은 단순 서류 작성비가 아니라 회사의 세무 리스크와 향후 법인자금 구조를 점검하는 설계 비용으로 보시면 됩니다. 다만 처음부터 모든 범위를 진행하기보다, 우선 점검이 필요한 항목부터 단계적으로 진행드릴 수 있습니다.`,
    holdTalk: `대표님, 충분히 고민해보셔도 됩니다. 다만 이 부분은 시간이 지나면 자료 확인이 어려워지거나 주식가치·세금 부담이 달라질 수 있어, 최소한 현재 상태 점검까지만이라도 먼저 진행해보시길 권드립니다.`,
    contractKakao: `대표님, 말씀드린 내용 기준으로 우선 ${main.name} 범위부터 진행하는 안으로 정리드리겠습니다.\n진행 전 필요한 자료와 검토 범위를 다시 한 번 안내드리고, 세무사 검토가 필요한 부분은 단정하지 않고 확인 절차를 거쳐 진행하겠습니다.`,
  };
}

// 고객 유형별 다음 연락 문구
function followUpKakao(item) {
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

export const CUST_FLAGS = [
  ["gajigeup", "가지급금 있음", "재무/세무 이슈"],
  ["gasugeum", "가수금 있음", "재무/세무 이슈"],
  ["corpTaxBurden", "법인세 부담 있음", "재무/세무 이슈"],
  ["hasLoan", "기존 대출/보증 있음", "재무/세무 이슈"],
  ["rndStaff", "연구개발 인력 있음", "인증/지원금 이슈"],
  ["hasLab", "기업부설연구소 보유", "인증/지원금 이슈"],
  ["venture", "벤처기업 인증 보유", "인증/지원금 이슈"],
  ["patent", "특허 보유", "인증/지원금 이슈"],
  ["hiring", "채용 예정", "인증/지원금 이슈"],
  ["policyFund", "정책자금 관심", "인증/지원금 이슈"],
  ["employSubsidy", "고용지원금 관심", "인증/지원금 이슈"],
  ["childWorks", "자녀 근무", "승계/정관/복지 이슈"],
  ["familyEmp", "가족 직원 근무", "승계/정관/복지 이슈"],
  ["succession", "가업승계 관심", "승계/정관/복지 이슈"],
  ["charterFixed", "정관 정비 완료", "승계/정관/복지 이슈"],
  ["execRetire", "임원퇴직금 규정 있음", "승계/정관/복지 이슈"],
  ["welfareFund", "사내근로복지기금 관심", "승계/정관/복지 이슈"],
];
const CUST_SECTIONS = ["재무/세무 이슈", "인증/지원금 이슈", "승계/정관/복지 이슈"];
// 입력 플래그 → 분석 엔진이 쓰는 interests 배열로 변환(저장 시 자동 분석의 기반)
function deriveInterests(f) {
  const set = new Set(f.interests || []);
  const fl = f.flags || {};
  if (fl.gajigeup || fl.gasugeum) set.add("가지급금");
  if (fl.gasugeum) set.add("가수금");
  if (fl.corpTaxBurden) set.add("법인세");
  if (fl.policyFund || fl.hasLoan) set.add("정책자금");
  if (fl.rndStaff && !fl.hasLab) set.add("연구소");
  if (fl.patent) set.add("연구소");
  if (fl.venture) set.add("벤처인증");
  if (fl.hiring || fl.employSubsidy) set.add("고용지원금");
  if (fl.welfareFund) set.add("사내근로복지기금");
  if (fl.succession || fl.childWorks) { set.add("가업승계"); set.add("미처분이익잉여금"); }
  if (fl.familyEmp) set.add("주식이동");
  if (!fl.charterFixed && (fl.succession || fl.childWorks || fl.gajigeup || fl.familyEmp)) set.add("정관정비");
  return Array.from(set);
}
// 메모 텍스트 → 키워드/정규식 기반 자동 채우기(MVP, 완벽하지 않아도 됨)
function parseMemo(text) {
  const t = text || "";
  const out = { flags: {} };
  const ind = [["제조", "제조업"], ["소프트", "IT/소프트웨어"], ["IT", "IT/소프트웨어"], ["도소매", "도소매업"], ["유통", "도소매업"], ["건설", "건설업"], ["병의원", "병의원"], ["의원", "병의원"], ["음식", "음식/숙박"], ["숙박", "음식/숙박"], ["서비스", "서비스업"]];
  for (const [k, v] of ind) { if (t.includes(k)) { out.industry = v; break; } }
  let m;
  if ((m = t.match(/매출\s*([0-9]+(?:\.[0-9]+)?)\s*억/)) || (m = t.match(/([0-9]+(?:\.[0-9]+)?)\s*억/))) out.revenue = Math.round(parseFloat(m[1]) * 100);
  if ((m = t.match(/직원\s*([0-9]+)\s*명?/)) || (m = t.match(/([0-9]+)\s*명/))) out.empCount = parseInt(m[1]);
  if ((m = t.match(/대표\s*([0-9]+)\s*세/)) || (m = t.match(/([0-9]+)\s*세/))) out.ceoAge = parseInt(m[1]);
  if ((m = t.match(/업력\s*([0-9]+)\s*년/))) out.estYears = parseInt(m[1]);
  if (/자녀.*(근무|재직)|자녀\s*근무/.test(t)) { out.flags.childWorks = true; out.flags.succession = true; }
  if (/승계|가업/.test(t)) out.flags.succession = true;
  if (/연구|개발/.test(t)) out.flags.rndStaff = true;
  if (/연구소\s*(없|미보유)/.test(t)) out.flags.hasLab = false;
  else if (/연구소\s*(있|보유)/.test(t)) out.flags.hasLab = true;
  if (/가지급금/.test(t)) out.flags.gajigeup = true;
  if (/가수금/.test(t)) out.flags.gasugeum = true;
  if (/채용/.test(t)) out.flags.hiring = true;
  if (/고용지원금|지원금/.test(t)) out.flags.employSubsidy = true;
  if (/법인세/.test(t)) out.flags.corpTaxBurden = true;
  if (/벤처/.test(t)) out.flags.venture = true;
  if (/특허/.test(t)) out.flags.patent = true;
  if (/복지기금|사내근로복지/.test(t)) out.flags.welfareFund = true;
  return out;
}

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

export { detectTheme, buildMeetingPlan, MEETING_THEMES, INTEREST_THEME, DEFAULT_M2_OBJ, STAGE_WEIGHT, scoreLead, followUpKakao, CUST_SECTIONS, deriveInterests, parseMemo };
