/**
 * [D-119] 크레탑 분석의 규칙 계산 — 화면(MiniApp.jsx) 밖에서도 부를 수 있게 떼어 낸 것.
 *
 * 원본 MiniApp.jsx 의 줄을 글자 그대로 옮겼다(진단 요약 · 26개 컨설팅 전략 · 미팅 질문 · 1장 요약 ·
 * 대표 나이 · 주주 복수 · 현금흐름등급). `analyzeCretopText` 는 원본 `buildResult` 와 같은 순서다.
 * MiniApp.jsx 는 이 파일을 다시 내보내므로 예전 import 는 그대로 동작한다.
 * 외부 호출 없음 — 규칙 계산이다.
 */
import { buildCretopParsedForUi, cretopRowTrend } from "../engine/index.js";
import { extractAll, detectBizForm } from "./extract.js";

export const ratioKeys = new Set(["netIncomeMargin", "debtRatio", "currentRatio", "interestCoverageRatio"]);

export function num(n) {
  if (n == null || typeof n !== "number" || !isFinite(n)) return "-";
  return (Math.round(n * 100) / 100).toLocaleString();
}
/* ──────────────────────────────────────────────────────────────
   룰 기반 컨설팅 엔진 (외부 AI 미사용) — ui 한 객체에서
   ① 종합 진단 요약 ② 추천 컨설팅 전략 ③ 실전 미팅 질문 ④ 1장 요약 을 생성.
   ────────────────────────────────────────────────────────────── */
// 비율 최신값
export function ratioVal(cp, key) { const o = cp[key]; return o && typeof o.value === "number" ? o.value : null; }
// 금액 항목 3개년 방향(첫 연도 대비 최근)
export function dir3(t) {
  if (!t || !t.series || t.series.length < 2) return null;
  const a = t.series[0].val, b = t.latest && t.latest.val;
  if (typeof a !== "number" || typeof b !== "number") return null;
  return b > a * 1.001 ? "증가" : b < a * 0.999 ? "감소" : "유지";
}
export function lastStep(t) { return t && t.steps && t.steps.length ? t.steps[t.steps.length - 1] : null; }
export function lastUp(t) { const s = lastStep(t); return !!(s && s.dir === "상승"); }
// 상세재무제표(BS/IS)에서 라벨로 항목 추이 찾기
export function detailTrend(ui, re) {
  const ds = ui.detailStatements || {};
  for (const k of ["balanceSheet", "incomeStatement"]) {
    const s = ds[k]; if (!s || !s.items) continue;
    const it = s.items.find((x) => re.test(String(x.rawLabel || x.account || "")));
    if (it) {
      const vals = (it.numberCandidates || []).slice();
      const years = (it.yearCandidates && it.yearCandidates.length === vals.length) ? it.yearCandidates : s.years;
      return cretopRowTrend({ isRatio: false, numberCandidates: vals, yearCandidates: years, unit: s.unit });
    }
  }
  return null;
}
export const hasAmt = (o) => o && !o.absent && ((typeof o.eok === "number" && o.eok > 0.005) || (o.series || []).some((v) => typeof v === "number" && v > 0));

// ① 종합 진단 요약 — 4~6줄(룰 기반). tone: bad/warn/good/info
export function buildDiagnosisSummary(ui) {
  const cp = ui.corePreview || {};
  const lines = [];
  const push = (text, tone) => lines.push({ text, tone });
  const rev = coreTrend("revenue", cp.revenue), op = coreTrend("operatingProfit", cp.operatingProfit), ni = coreTrend("netIncome", cp.netIncome), cash = coreTrend("cash", cp.cash);
  const rd = dir3(rev), cd = dir3(cash);
  if (rd === "감소") push("매출은 최근 3개년 기준 감소 추세입니다. 주요 거래처·단가·수주 변화 점검이 필요합니다.", "bad");
  else if (rd === "증가") push("매출은 최근 3개년 기준 증가 추세입니다. 성장 지속성과 거래처 구조를 함께 보면 좋습니다.", "good");
  const opLast = op && op.latest && op.latest.val, opStep = lastStep(op);
  if (opStep && opStep.transition === "흑자전환") push("영업이익은 흑자 전환되었으나 이익 규모는 아직 점검이 필요합니다.", "warn");
  else if (typeof opLast === "number" && opLast < 0) push("영업이익이 적자 구간입니다. 원가율·판관비·고정비 구조 점검이 필요합니다.", "bad");
  const niLast = ni && ni.latest && ni.latest.val;
  if (typeof niLast === "number" && niLast < 0) push("당기순이익이 적자입니다. 영업외·이자비용·일회성 비용 여부 확인이 필요합니다.", "bad");
  const dr = ratioVal(cp, "debtRatio"), cr = ratioVal(cp, "currentRatio"), icr = ratioVal(cp, "interestCoverageRatio");
  if (cp.debtRatio && cp.debtRatio.capitalErosion) push("자기자본이 마이너스(자본잠식 신호)로 보입니다. 자본확충·차입구조 점검이 시급합니다.", "bad");
  else if (dr != null && dr >= 200) push(`부채비율이 ${num(dr)}%로 높아 차입금 상환 계획과 운전자금 부담 확인이 필요합니다.`, "bad");
  else if (dr != null && dr <= 100) push(`부채비율이 ${num(dr)}%로 비교적 안정적입니다. 잉여현금·이익잉여금 활용 여력을 볼 수 있습니다.`, "good");
  if (cr != null && cr < 100) push(`유동비율이 ${num(cr)}%로 100% 미만입니다. 단기 유동성과 운전자금 점검이 필요합니다.`, "bad");
  if (icr != null && icr < 1) push(`이자보상배수가 ${num(icr)}배로 1배 미만입니다. 영업이익으로 이자비용 감당이 어려운지 확인이 필요합니다.`, "bad");
  if (cd === "감소") push("현금성 자산이 줄어드는 추세로 단기 유동성 점검이 필요합니다.", "warn");
  const re = cp.retainedEarnings && typeof cp.retainedEarnings.eok === "number" ? cp.retainedEarnings.eok : null;
  if (re != null && re >= 10) push(`미처분이익잉여금이 약 ${num(re)}억원 누적되어 배당·승계·이익소각 등 활용 검토 여지가 있습니다.`, "info");
  // 양호 신호(건강한 기업도 요약이 4~6줄이 되도록)
  if (typeof opLast === "number" && opLast > 0 && opStep && opStep.dir === "상승") push("영업이익이 흑자이며 전년 대비 개선 흐름입니다. 원가·판관비 구조의 지속성을 확인해볼 수 있습니다.", "good");
  if (typeof niLast === "number" && niLast > 0 && lastUp(ni)) push("당기순이익이 흑자이며 개선되고 있습니다. 이익의 반복 가능성을 함께 보면 좋습니다.", "good");
  if (cr != null && cr >= 200) push(`유동비율이 ${num(cr)}%로 단기 지급능력은 양호한 편입니다.`, "good");
  if (icr != null && icr >= 2) push(`이자보상배수가 ${num(icr)}배로 이자 감당 여력은 양호한 편입니다.`, "good");
  // 우선 확인 화두(클로징)
  const focus = [];
  if (rd === "감소") focus.push("매출 감소 원인");
  if (dr != null && dr >= 200) focus.push("차입금 사용처·상환 계획");
  if (typeof opLast === "number" && opLast < 0) focus.push("고정비 구조");
  if (cd === "감소") focus.push("단기 유동성");
  if (re != null && re >= 10) focus.push("이익잉여금 활용");
  if (!focus.length) focus.push("매출·이익 흐름", "차입 구조", "자금 운용");
  // 우선순위 정렬(위험→주의→기회→정보) 후 5줄 + 클로징
  const order = { bad: 0, warn: 1, good: 2, info: 3 };
  lines.sort((a, b) => order[a.tone] - order[b.tone]);
  const out = lines.slice(0, 5);
  out.push({ text: `미팅에서는 ${focus.slice(0, 3).join(", ")}을(를) 우선 확인해볼 수 있습니다.`, tone: "info" });
  if (out.length < 2) out.unshift({ text: "자동 산출 지표가 부족합니다. 원문 재무비율·재무제표 표를 직접 확인해보세요.", tone: "info" });
  return out;
}

// ② 추가 제안 포인트 — 적합도 점수(base+signals) + 근거(매칭 신호) + 상세(관심/질문/자료/멘트/기대효과)
// 법인컨설팅 수익화 항목 중심. signals: [ctx플래그, 가중치, 근거 문구]. always: 항상 표시 근거.
const NOW_YEAR = new Date().getFullYear();
export const CONSULTING_CATEGORIES = ["자금조달", "고용·인력", "연구소·인증", "지식재산", "자본·세무", "승계·리스크", "재무관리"];
export const CONSULTING_STRATEGIES = [
  // ── 자금조달 ──
  { cat: "자금조달", name: "정책자금", base: 58, signals: [["revDown", 10, "최근 매출 감소"], ["cashDown", 10, "현금흐름 주의(현금성자산 감소)"], ["borrowingsUp", 10, "차입금 증가"], ["drHigh", 10, "부채비율 높음"], ["crLow", 8, "유동비율 낮음"], ["hasBorrowings", 6, "차입금 보유"], ["smallScale", 4, "소규모 요건 충족"]],
    why: "매출·차입금·운전자금 상황에 따라 저리 정책자금 활용 여지가 있습니다. 활용 창구: 소상공인시장진흥공단(소진공)·중소벤처기업진흥공단(중진공) 직접대출, 신용보증기금(신보)·기술보증기금(기보) 보증서 발급 후 은행 보증부 대출, 시중·국책 은행 정책성 자금까지 함께 검토합니다.",
    interest: ["저리 운전·시설자금", "대출금리·만기 구조", "신보·기보·중진공·소진공·은행 창구"],
    questions: ["현재 사용 중인 대출 금리·만기는 어떻게 되시나요?", "추가 자금 수요가 있으신가요?", "올해 설비·운전 투자 계획이 있으신가요?", "확보한 자금을 매출 확대·설비·인력 중 어디에 우선 투입하고 싶으신가요?"], docs: ["부채현황표", "대출내역서", "사업계획서", "최근 재무제표"],
    problem: "고금리·단기 차입이 그대로면 이자비용이 이익을 잠식하고 있을 수 있습니다.", implication: "이 상태가 지속되면 운전자금이 묶이고 신규 투자 여력이 줄어 성장 기회를 놓치게 됩니다.", ment: "정책자금으로 이자 부담을 줄이고 확보한 자금을 성장에 투입하면, 매출 확대와 현금흐름 개선으로 이어질 수 있습니다.", effects: ["금리 절감", "운전자금 확보", "신용도 개선"] },
  { cat: "자금조달", name: "차입금 구조개선", base: 52, signals: [["borrowingsUp", 14, "차입금 증가"], ["drHigh", 12, "부채비율 높음"], ["icrLow", 10, "이자 부담 큼"], ["hasBorrowings", 6, "차입금 보유"]],
    why: "단기·고금리 차입 비중이 높으면 장기·저금리 전환으로 이자부담을 낮출 여지가 있습니다.", interest: ["단기→장기 전환", "금리 인하", "대환"],
    questions: ["단기차입 비중과 만기 집중도는 어떻게 되나요?", "고금리 대출의 대환 여지가 있나요?", "만기 도래가 몰린 시점이 있나요?", "이자비용을 줄이면 그 여력을 어디에 쓰고 싶으신가요?"], docs: ["대출잔액증명", "여신거래약정서", "재무제표"],
    problem: "단기·고금리 차입 비중이 높으면 만기 집중·금리 인상에 그대로 노출됩니다.", implication: "방치하면 차환 부담이 커지고 이자비용이 이익을 계속 깎아먹습니다.", ment: "고금리·단기 차입을 저금리·장기로 바꾸면 이자비용이 줄어 그만큼 이익과 신용도가 함께 올라갑니다.", effects: ["이자비용 절감", "만기 분산", "유동성 개선"] },
  { cat: "자금조달", name: "부채비율 개선", base: 50, signals: [["drHigh", 16, "부채비율 높음"], ["capitalErosion", 14, "자본잠식 신호"], ["borrowingsUp", 6, "차입 증가"]],
    why: "부채비율이 높거나 자본잠식 신호가 있으면 자본확충·구조개선이 필요합니다.", interest: ["가수금 출자전환", "증자", "이익 누적"],
    questions: ["증자·가수금 출자전환을 검토해 보셨나요?", "대표 가수금이 누적되어 있나요?", "자본 확충 계획이 있으신가요?", "신용평가·입찰에서 재무구조 때문에 불이익을 느끼신 적 있으신가요?"], docs: ["재무제표", "주주명부", "가수금 명세", "정관"],
    problem: "부채비율이 높으면 신용평가·입찰·금리에서 불이익을 받습니다.", implication: "개선하지 않으면 조달 비용이 오르고 외부에서 위험한 회사로 평가됩니다.", ment: "재무구조가 좋아지면 신용등급과 조달 조건이 개선되어, 외부에서 더 탄탄한 회사로 평가받게 됩니다.", effects: ["신용등급 개선", "조달 조건 개선", "재무 안정성"] },
  // ── 고용·인력 ──
  { cat: "고용·인력", name: "고용지원금", base: 46, signals: [["emp5", 20, "직원 5인 이상"], ["hasEmp", 6, "종업원 보유"], ["revUp", 4, "성장 채용 여력"]],
    why: "직원이 5인 이상이거나 채용 계획이 있으면 고용 관련 지원금 점검 대상이 됩니다.", interest: ["고용유지", "채용 지원", "인건비 부담"],
    questions: ["최근 6개월 내 채용했거나 채용 예정 인원이 있으신가요?", "청년·고령자 채용이 있으셨나요?", "고용유지 지원금을 받아보셨나요?", "인재를 더 늘리고 싶은데 인건비 부담이 걸림돌이 되고 계신가요?"], docs: ["4대보험 가입자명부", "근로계약서", "급여대장"],
    problem: "받을 수 있는 고용 지원금을 놓치면 인건비를 그대로 다 부담하게 됩니다.", implication: "지원 제도를 모르고 지나가면 매년 수천만 원의 절감 기회를 흘려보냅니다.", ment: "채용·고용유지 지원금으로 인건비 부담을 줄이면, 인재를 늘리면서도 이익을 지킬 수 있습니다.", effects: ["인건비 절감", "채용 지원금", "고용유지 지원"] },
  { cat: "고용·인력", name: "청년채용 지원", base: 44, signals: [["emp5", 14, "직원 5인 이상"], ["hasEmp", 6, "종업원 보유"]],
    why: "청년 신규 채용 시 지원금·세액공제 활용 여지가 있습니다.", interest: ["청년 정규직 채용", "인건비 세액공제"],
    questions: ["만 34세 이하 청년을 정규직으로 채용하셨나요?", "청년 채용 계획이 있으신가요?", "정규직 전환 예정 인원이 있나요?", "앞으로 어떤 직무에 청년 인재를 충원하실 계획이 있으신가요?"], docs: ["근로계약서", "4대보험 가입자명부", "급여대장"],
    problem: "청년 채용 지원·세액공제를 적용하지 않으면 인건비 부담만 커집니다.", implication: "우수 인재 확보 비용을 줄이지 못하면 성장 속도와 수익성이 함께 눌립니다.", ment: "청년 채용 지원금·세액공제를 활용하면 우수 인재 확보와 인건비 절감을 동시에 얻을 수 있습니다.", effects: ["청년채용 지원금", "인건비 세액공제"] },
  // ── 연구소·인증 ──
  { cat: "연구소·인증", name: "기업부설연구소 / 연구개발전담부서", base: 50, signals: [["isMfg", 12, "제조업종"], ["isTech", 12, "기술개발 가능성"], ["noRndLab", 10, "연구소·전담부서 미보유"], ["hasEmp", 6, "인력 규모"]],
    why: "제조·기술·제품개발 기업은 부설연구소 또는 연구개발전담부서 설립으로 R&D 세액공제·인증 기반을 마련할 수 있습니다. (요건이 부담되면 전담부서부터 단계적 설립)", interest: ["연구인력", "R&D 세액공제", "인증 기반"],
    questions: ["제품개발·공정개선·품질개선 담당 인력이 따로 있으신가요?", "연구개발 활동을 별도로 관리하시나요?", "연구소·전담부서 인정을 받아두셨나요?", "기술력·연구인력을 대외적으로 인정받는 것이 사업에 도움이 되시겠나요?"], docs: ["조직도", "연구인력 이력", "개발자료", "급여대장"],
    problem: "R&D 활동을 인정받지 못하면 받을 수 있는 세액공제를 매년 놓칩니다.", implication: "기술력을 권리·인증으로 만들어 두지 않으면 세제 혜택도, 대외 평가도 챙기지 못합니다.", ment: "연구소·전담부서를 갖추면 R&D 세액공제로 세금을 줄이면서, 기술력과 인재 수준까지 외부에 인정받을 수 있습니다.", effects: ["R&D 세액공제", "인력 세제 혜택", "인증 기반 마련"] },
  { cat: "연구소·인증", name: "벤처기업 인증", base: 60, always: "법인컨설팅 공통 중상위 검토 항목", signals: [["noVenture", 8, "벤처 미인증"], ["isTech", 6, "기술업종"], ["isMfg", 4, "제조업종"]],
    why: "벤처 확인은 세제·자금·입찰 우대의 기반이 됩니다.", interest: ["법인세 감면", "정책자금 우대", "대외신뢰"],
    questions: ["벤처기업 확인을 받아두셨나요?", "갱신·신규가 필요하신가요?", "벤처 우대 혜택을 활용하고 계신가요?", "법인세 감면과 대외 신뢰도 향상 중 어느 쪽이 더 필요하신가요?"], docs: ["벤처확인서", "재무제표", "기술자료", "사업계획서"],
    problem: "벤처 확인이 없으면 법인세 감면·정책자금 우대를 받지 못합니다.", implication: "미인증 상태가 길어질수록 절세와 자금 우대 기회를 계속 놓칩니다.", ment: "벤처 확인을 받으면 법인세 감면과 정책자금·입찰 우대로, 절세와 대외 신뢰도를 함께 높일 수 있습니다.", effects: ["법인세 감면", "정책자금 우대", "입찰 가점"] },
  { cat: "연구소·인증", name: "이노비즈(기술혁신형)", base: 58, always: "법인컨설팅 공통 중상위 검토 항목", signals: [["noInnobiz", 8, "이노비즈 미인증"], ["isTech", 8, "기술혁신 역량"], ["isMfg", 4, "제조업종"]],
    why: "기술혁신 역량이 있는 기업은 이노비즈 인증 대상이 될 수 있습니다.", interest: ["기술혁신 평가", "정책자금·입찰 우대"],
    questions: ["기술혁신형(이노비즈) 인증을 검토해 보셨나요?", "기술 경쟁력을 평가받아 보셨나요?", "입찰 가점이 필요하신가요?", "기술 경쟁력을 공인받아 자금·입찰에서 우대받는 것에 관심 있으신가요?"], docs: ["기술자료", "재무제표", "특허·인증 현황"],
    problem: "기술 경쟁력을 공인받지 못하면 자금·입찰 우대에서 밀립니다.", implication: "인증 없이는 기술이 있어도 외부 평가와 조달에서 불리해집니다.", ment: "이노비즈 인증은 기술 경쟁력을 공인받아 자금·입찰에서 우대받고, 회사 가치를 높이는 발판이 됩니다.", effects: ["정책자금 우대", "입찰 가점", "기술 신뢰도"] },
  { cat: "연구소·인증", name: "메인비즈(경영혁신형)", base: 58, always: "법인컨설팅 공통 중상위 검토 항목", signals: [["noMainbiz", 8, "메인비즈 미인증"], ["revUp", 4, "경영 성장"]],
    why: "경영혁신 활동이 있으면 메인비즈 인증으로 우대 혜택을 받을 수 있습니다.", interest: ["경영혁신 평가", "금융·판로 우대"],
    questions: ["경영혁신형(메인비즈) 인증을 고려해 보셨나요?", "마케팅·조직 혁신 활동이 있으신가요?", "금융·판로 우대가 필요하신가요?", "금융·판로 우대가 성장에 도움이 되실 상황이신가요?"], docs: ["사업계획서", "재무제표", "조직·매출 자료"],
    problem: "경영혁신을 인정받지 못하면 금융·판로 우대를 놓칩니다.", implication: "성장하고 있어도 인증이 없으면 우대 기회를 매번 흘려보냅니다.", ment: "메인비즈 인증으로 금융·판로 우대를 받으면, 성장 기반과 대외 평가를 함께 끌어올릴 수 있습니다.", effects: ["금융 우대", "판로 지원", "대외신뢰"] },
  { cat: "연구소·인증", name: "ISO 인증(품질·환경)", base: 58, always: "법인컨설팅 공통 중상위 검토 항목", signals: [["isMfg", 8, "제조업종"], ["bid", 8, "공공 입찰 이력"]],
    why: "품질·환경 경영시스템 인증은 입찰 가점과 거래 신뢰도에 도움이 됩니다.", interest: ["ISO 9001/14001", "입찰 가점", "거래처 요구"],
    questions: ["거래처·입찰에서 인증을 요구받으신 적이 있나요?", "품질·환경 시스템을 운영 중이신가요?", "공공 납품을 확대하실 계획이 있나요?", "거래처 확대나 입찰 참여를 늘리실 계획이 있으신가요?"], docs: ["품질매뉴얼", "공정자료", "조직도"],
    problem: "인증이 없으면 입찰 가점과 거래처 신뢰 확보에서 불리합니다.", implication: "품질 체계를 공인받지 못하면 큰 거래·공공 납품 기회를 놓칠 수 있습니다.", ment: "ISO 인증은 입찰 가점과 거래 신뢰를 높여, 매출처 확대와 기업 이미지 향상으로 이어집니다.", effects: ["입찰 가점", "거래처 신뢰", "품질 체계"] },
  // ── 지식재산 ──
  { cat: "지식재산", name: "특허·상표·디자인", base: 66, always: "법인컨설팅 공통 상위 검토 항목(권리화·세제·평가)", signals: [["isTech", 8, "기술업종"], ["isMfg", 6, "제조·제품 보유"], ["noIP", 8, "산업재산권 미보유"]],
    why: "제품·기술·브랜드가 있으면 지식재산권 확보로 보호·세제·평가 기반을 만들 수 있습니다.", interest: ["권리 보호", "기술평가", "직무발명 보상"],
    questions: ["출원했거나 출원이 필요한 제품·기술·브랜드가 있으신가요?", "경쟁사 모방 우려가 있으신가요?", "직무발명 보상제도를 운영하시나요?", "지키고 싶은 기술·브랜드가 있으신가요? 기술평가·세제 활용도 고려하시나요?"], docs: ["제품·기술자료", "기존 등록현황", "브랜드 사용자료"],
    problem: "권리화하지 않은 제품·기술·브랜드는 모방·분쟁에 그대로 노출됩니다.", implication: "방치하면 경쟁사 모방으로 가치가 희석되고, 세제·평가 활용 기회도 사라집니다.", ment: "지식재산권을 확보하면 기술력을 권리로 지키고, 기술평가·세제 활용으로 기업가치와 절세를 함께 도모할 수 있습니다.", effects: ["권리 보호", "기술평가 가점", "세제 활용"] },
  { cat: "지식재산", name: "조달·나라장터", base: 46, signals: [["bid", 34, "공공 입찰 이력 있음(최상위)"], ["isMfg", 8, "납품 가능 품목"]],
    why: "공공 납품 가능 품목이 있거나 입찰 이력이 있으면 조달 등록·입찰로 판로를 넓힐 수 있습니다.", interest: ["조달 등록", "입찰 참여", "공공 판로"],
    questions: ["공공기관 납품이나 나라장터 입찰을 해보셨나요?", "조달 등록 품목이 있으신가요?", "공공 판로를 확대하실 계획이 있나요?", "공공 매출처를 새로운 성장축으로 가져가실 의향이 있으신가요?"], docs: ["사업자등록증", "제품 카탈로그", "인증서", "실적자료"],
    problem: "입찰 이력이 있는데 조달 등록·가점 인증이 없으면 공공 매출을 키우지 못합니다.", implication: "등록·가점을 갖추지 않으면 안정적 매출처 확보 기회를 경쟁사에 넘기게 됩니다.", ment: "조달 등록·입찰로 공공 판로를 확보하면 안정적인 매출처가 더해져 외형이 단단해집니다.", effects: ["공공 판로 확대", "안정적 매출처"] },
  // ── 자본·세무 ──
  { cat: "자본·세무", name: "가수금 정리", base: 52, signals: [["hasGasu", 22, "가수금 추정 계정 존재"], ["drHigh", 10, "부채비율 높음"], ["hasBorrowings", 6, "차입금 보유"]],
    why: "대표 가수금이 누적되면 출자전환·상환으로 재무구조 개선 여지가 있습니다.", interest: ["가수금 출자전환", "부채비율 개선"],
    questions: ["대표님이 법인에 빌려준 가수금이 누적되어 있나요?", "출자전환을 검토해 보셨나요?", "가수금 상환 계획이 있으신가요?", "재무구조가 좋아져 대외 평가가 올라가는 것이 필요하신 상황인가요?"], docs: ["계정별원장", "주주명부", "재무제표", "정관"],
    problem: "대표 가수금이 쌓이면 부채비율을 높이고 재무구조를 왜곡합니다.", implication: "정리하지 않으면 신용평가·조달에서 불이익이 계속됩니다.", ment: "대표님 가수금을 출자전환·정리하면 부채비율이 낮아져 재무구조와 대외 평가가 함께 좋아집니다.", effects: ["부채비율 개선", "자본 확충", "재무 안정"] },
  { cat: "자본·세무", name: "가지급금 정리", base: 54, signals: [["hasGagj", 22, "가지급금 계정 존재"], ["retHigh", 6, "이익잉여금 누적"]],
    why: "가지급금은 인정이자·세무 리스크가 있어 정리 플랜 점검이 필요합니다.", interest: ["인정이자", "대손 리스크", "정리 방안"],
    questions: ["대표님 개인자금과 법인자금이 섞인 거래가 있으셨나요?", "가지급금 인정이자를 인지하고 계신가요?", "정리 플랜을 검토해 보셨나요?", "법인 자금을 깨끗하게 정리해 세무 리스크를 없애는 것이 시급하신가요?"], docs: ["계정별원장", "가지급금 명세", "재무제표"],
    problem: "가지급금은 매년 인정이자가 붙고 세무조사 리스크를 키웁니다.", implication: "방치하면 법인세·소득세 추징과 가산세로 이어질 수 있습니다.", ment: "가지급금을 합법적으로 정리하면 인정이자·세무 리스크를 줄이고, 그만큼 법인 자금을 깨끗하게 운용할 수 있습니다.", effects: ["세무 리스크 완화", "인정이자 부담 감소"] },
  { cat: "자본·세무", name: "미처분이익잉여금", base: 54, signals: [["retHigh", 16, "이익잉여금 누적"], ["retMid", 6, "잉여금 보유"]],
    why: "이익잉여금이 누적되면 향후 세부담·승계 관점에서 활용 플랜이 필요합니다.", interest: ["잉여금 활용", "향후 배당·승계 부담"],
    questions: ["누적된 이익잉여금의 활용 방향을 검토해 보셨나요?", "향후 배당·승계 시 세부담을 고려하고 계신가요?", "자기주식·소각을 검토해 보셨나요?", "쌓인 법인 자금을 향후 배당·승계·개인화 중 어떻게 활용하고 싶으신가요?"], docs: ["재무제표", "주주명부", "정관"],
    problem: "이익잉여금이 쌓일수록 미래 배당·승계 시 세부담이 눈덩이처럼 커집니다.", implication: "지금 설계하지 않으면 나중에 훨씬 큰 세금을 한꺼번에 내게 됩니다.", ment: "쌓인 이익잉여금을 미리 설계해 두면, 향후 세부담을 줄이면서 법인의 돈을 합법적으로 대표님 자산으로 이전할 수 있습니다.", effects: ["미래 세부담 분산", "자본 구조 정비"] },
  { cat: "자본·세무", name: "이익소각", base: 50, signals: [["retHigh", 16, "미처분이익잉여금 누적"], ["cashPos", 8, "현금성자산 보유"]],
    why: "미처분이익잉여금이 많고 현금성자산이 있으면 자기주식 취득·이익소각으로 지분·세무를 정비할 수 있습니다.", interest: ["자기주식 취득", "지분 정리", "세무 효율"],
    questions: ["지분 정리·잉여금 활용을 위해 이익소각을 검토해 보셨나요?", "자기주식 취득 여력(현금)이 있으신가요?", "주주 간 지분 조정 필요가 있나요?", "법인에 모인 자금을 합법적으로 대표님 자산으로 가져오는 것에 관심 있으신가요?"], docs: ["주주명부", "재무제표", "정관"],
    problem: "잉여금이 많은데 활용 플랜이 없으면 법인 자금이 묶인 채 세부담만 키웁니다.", implication: "방치하면 지분·세무 정비 기회를 놓치고 개인 자산화도 어려워집니다.", ment: "이익소각을 활용하면 잉여금을 정리하면서, 합법적인 절세로 법인 자금을 대표님 개인 자산으로 가져올 수 있습니다.", effects: ["지분 구조 정비", "세무 효율", "잉여금 정리"] },
  { cat: "자본·세무", name: "배당정책 정비", base: 48, signals: [["retHigh", 14, "미처분이익잉여금 충분"], ["retMid", 8, "배당 재원 보유"]],
    why: "미처분이익잉여금이 일정 수준 이상이면 배당정책·차등배당 설계로 자금 회수·승계를 준비할 수 있습니다.", interest: ["정기·차등 배당", "가족 주주 활용"],
    questions: ["그동안 배당을 실시해 오셨나요?", "가족 주주가 있으신가요?", "배당정책 계획이 있으신가요?", "가족 주주를 활용한 소득 분산·절세에 관심이 있으신가요?"], docs: ["주주명부", "재무제표", "정관"],
    problem: "배당 설계가 없으면 법인 자금을 비효율적·고세율로 회수하게 됩니다.", implication: "가족 주주·차등배당을 활용하지 않으면 매년 더 많은 세금을 부담합니다.", ment: "배당정책을 가족 주주까지 설계하면, 소득을 분산해 세부담을 낮추고 법인 자금을 안정적으로 회수할 수 있습니다.", effects: ["자금 회수", "승계 준비", "소득 분산"] },
  { cat: "자본·세무", name: "임원 퇴직금 재원", base: 56, always: "법인 공통 검토(퇴직금 규정·재원)", signals: [["retMid", 6, "재원 여력"], ["retHigh", 4, "잉여금 누적"]],
    why: "임원 퇴직금 규정·재원이 정비되면 비용 처리·승계 자금에 유리합니다.", interest: ["퇴직금 규정", "재원 마련", "비용 인정"],
    questions: ["임원 퇴직금 지급 규정이 마련되어 있으신가요?", "퇴직금 재원을 준비하고 계신가요?", "정관에 근거가 반영되어 있나요?", "대표님 노후·퇴직 재원을 비용으로 인정받아 준비하고 싶으신가요?"], docs: ["임원 보수·퇴직금 규정", "정관", "주주총회 의사록"],
    problem: "퇴직금 규정·재원이 없으면 비용 인정도, 노후·승계 자금도 준비되지 않습니다.", implication: "미비 상태로 두면 추후 퇴직금 지급 시 비용 부인·세무 리스크가 생깁니다.", ment: "임원 퇴직금 규정·재원을 갖추면 비용으로 인정받아 절세하면서, 대표님 노후·승계 자금까지 준비됩니다.", effects: ["비용 인정", "승계 재원", "리스크 대비"] },
  { cat: "자본·세무", name: "정관 정비", base: 72, always: "모든 법인 공통 기본 점검(임원보수·퇴직금·배당 근거)", signals: [["retMid", 4, "자본거래 근거 필요"]],
    why: "임원보수·퇴직금·배당 근거가 정관에 없으면 세무 인정에 제약이 생길 수 있어, 모든 법인에 기본 점검이 필요합니다.", interest: ["임원보수·퇴직금·배당 근거 조항"],
    questions: ["정관을 최근 정비하신 적이 있나요?", "임원보수·퇴직금 규정이 반영되어 있나요?", "배당·주식 관련 근거가 있나요?", "임원보수·퇴직금·배당을 세무상 안전하게 인정받는 것이 필요하신가요?"], docs: ["정관", "주주총회 의사록", "등기부등본"],
    problem: "정관에 근거가 없으면 임원보수·퇴직금·배당이 세무상 부인될 수 있습니다.", implication: "방치하면 합법적 절세의 기본 토대 자체가 흔들립니다.", ment: "정관만 제대로 정비해도 임원보수·퇴직금·배당이 세무상 인정되어, 합법적 절세의 기본 토대가 마련됩니다.", effects: ["세무 인정 기반", "자본거래 안정성"] },
  { cat: "자본·세무", name: "주주구성 점검", base: 56, always: "승계·세무 공통 점검", signals: [["multiOwner", 16, "주주 복수(지분 분산) 추정"], ["retHigh", 6, "승계·세무 영향"]],
    why: "차명·명의신탁·과도한 1인 지분 등은 승계·세무 리스크가 됩니다.", interest: ["명의신탁", "지분 분산", "승계 구도"],
    questions: ["현재 주주 구성과 지분율은 어떻게 되나요?", "명의신탁 주식이 있으신가요?", "지분 분산·승계를 고려하고 계신가요?", "향후 가업승계나 절세 설계를 염두에 두고 계신가요?"], docs: ["주주명부", "주식변동상황명세서", "정관"],
    problem: "명의신탁·과도한 1인 지분은 승계·세무 시 큰 리스크가 됩니다.", implication: "정리하지 않으면 가업승계·증여 단계에서 예상치 못한 세금과 분쟁이 생깁니다.", ment: "주주구성을 미리 정리하면 승계·세무 리스크를 줄이고, 향후 가업승계와 절세 설계가 한결 수월해집니다.", effects: ["승계 리스크 완화", "지분 안정", "세무 대비"] },
  { cat: "자본·세무", name: "세액공제·세액감면 검토", base: 56, signals: [["niPos", 14, "당기순이익 발생(세부담 존재)"], ["hasRndLab", 10, "연구소 보유"], ["isTech", 8, "기술업종"], ["hasEmp", 6, "고용 보유"], ["opUp", 6, "투자·이익 개선"], ["emp5", 4, "직원 5인 이상"]],
    why: "당기순이익이 있어 세부담이 있는 법인은 통합고용세액공제·통합투자세액공제·연구인력개발비(R&D) 세액공제, 중소기업 특별세액감면 적용 여지가 있는지 점검할 수 있습니다.", interest: ["통합고용세액공제", "통합투자세액공제", "연구인력개발비(R&D) 세액공제", "중소기업 특별세액감면"],
    questions: ["연구개발·설비투자·고용 증가에 세액공제를 적용해 보셨나요?", "통합고용/통합투자 세액공제를 검토해 보셨나요?", "중소기업 특별세액감면을 받고 계신가요?", "낸 세금을 합법적으로 돌려받을 여지가 있다면 검토해 보시겠어요?"], docs: ["재무제표", "법인세 신고서", "투자·고용 증빙"],
    problem: "당기순이익이 있는데 적용 가능한 세액공제를 놓치면 세금을 더 냅니다.", implication: "미적용분을 점검하지 않으면 합법적으로 돌려받을 돈을 매년 흘려보냅니다.", ment: "통합고용·통합투자·R&D 세액공제를 적용하면, 낸 세금을 합법적으로 돌려받아 이익과 현금흐름이 함께 좋아집니다.", effects: ["법인세 절감", "현금흐름 개선"] },
  // ── 승계·리스크 ──
  { cat: "승계·리스크", name: "가업승계", base: 50, signals: [["ceoOld", 24, "대표자 60대 이상(최상위)"], ["ceo50s", 12, "대표자 50대(중상위)"], ["retHigh", 12, "이익잉여금 누적"], ["oldBiz", 8, "업력 20년 이상"]],
    why: "대표자 연령이 높거나 업력·자산이 있는 법인은 가업상속공제·증여특례 등 승계 플랜을 준비할 수 있습니다.", interest: ["가업상속공제", "사전 증여", "승계 구도"],
    questions: ["자녀 등 후계자에게 승계 계획이 있으신가요?", "가업상속공제 요건을 검토해 보셨나요?", "사전 증여를 고려하고 계신가요?", "키워온 회사를 세부담 없이 자녀에게 물려주는 것이 목표이신가요?"], docs: ["주주명부", "재무제표", "가족관계 자료", "정관"],
    problem: "대표자 연령이 높아지는데 승계 설계가 없으면 상속세 부담이 급증합니다.", implication: "준비 없이 유고·승계 시점이 오면 회사 매각까지 내몰릴 수 있습니다.", ment: "지금부터 가업상속공제·사전 증여를 설계하면, 키워온 회사를 세부담 없이 다음 세대로 안전하게 넘길 수 있습니다.", effects: ["승계 세부담 완화", "경영권 안정"] },
  { cat: "승계·리스크", name: "상속·증여 설계", base: 48, signals: [["ceoOld", 22, "대표자 60대 이상(최상위)"], ["ceo50s", 10, "대표자 50대(중상위)"], ["retHigh", 12, "주식가치 상승"], ["oldBiz", 6, "업력 오래"]],
    why: "대표자 연령이 높거나 주식가치가 높아지면 사전 증여·지분 이전으로 미래 세부담을 분산할 수 있습니다.", interest: ["주식가치 평가", "사전 증여", "세부담 분산"],
    questions: ["법인 주식의 사전 증여를 검토해 보셨나요?", "주식가치를 평가해 보신 적 있나요?", "지분 이전 시점을 고민하고 계신가요?", "주식가치가 더 오르기 전에 미리 이전해 세금을 줄이고 싶으신가요?"], docs: ["주주명부", "재무제표", "주식가치 평가자료"],
    problem: "주식가치가 오를수록 나중에 증여·상속 세금이 기하급수로 커집니다.", implication: "미루면 미룰수록 더 큰 세금을 부담하고 가족 자산 이전이 어려워집니다.", ment: "주식가치가 더 오르기 전에 증여를 설계하면, 미래 세금을 크게 줄이면서 법인 가치를 가족 자산으로 이전할 수 있습니다.", effects: ["세부담 분산", "지분 이전 준비"] },
  // ── 재무관리 ──
  { cat: "재무관리", name: "현금흐름 개선", base: 48, signals: [["cashDown", 16, "현금성자산 감소"], ["crLow", 10, "유동비율 낮음"], ["icrLow", 6, "이자 부담"]],
    why: "현금성 자산 감소·유동성 저하 시 운전자금·사이클 점검이 필요합니다.", interest: ["운전자금", "회수·지급 사이클", "단기 유동성"],
    questions: ["월별 자금 사정에서 부담이 큰 시점이 있나요?", "운전자금은 주로 어떻게 조달하시나요?", "회수·지급 사이클을 관리하고 계신가요?", "자금이 안정되면 매출·설비·인력 중 어디에 투자하고 싶으신가요?"], docs: ["자금수지표", "재무제표", "대출 현황"],
    problem: "현금이 마르면 흑자라도 자금 경색으로 위기에 몰릴 수 있습니다.", implication: "사이클을 관리하지 않으면 운전자금 부족으로 성장 투자도 막힙니다.", ment: "현금흐름을 안정시키면 흑자도산을 막고, 확보한 자금을 성장에 투입해 매출·이익을 키울 수 있습니다.", effects: ["단기 유동성 확보", "자금 안정"] },
  // ── 복지/인력 ──
  { cat: "고용·인력", name: "사내(공동)근로복지기금", base: 46, signals: [["emp5", 16, "직원 5인 이상"], ["niPos", 10, "당기순이익 발생"], ["retMid", 6, "이익 누적"], ["hasEmp", 6, "종업원 보유"]],
    why: "직원이 일정 규모 이상이고 이익이 나는 기업은 사내(공동)근로복지기금으로 직원 복지를 체계화하면서 출연금의 손금산입 등 세무상 효율을 함께 검토할 수 있습니다. 단독 설립이 부담되면 여러 기업이 함께 만드는 공동근로복지기금도 대안입니다.",
    interest: ["직원 복지 체계화", "장기근속 유인", "출연금 손금산입(절세)"],
    questions: ["직원 복지비나 성과급을 별도로 운영하고 계신가요?", "장기근속 유도나 핵심인력 이탈 방지 고민이 있으신가요?", "복지제도를 세무상 효율적으로 정리하고 싶으신가요?", "직원 수와 이익 규모를 고려할 때 복지기금 설립 검토가 필요할 수 있는데, 검토해보신 적 있으신가요?"],
    docs: ["4대보험 가입자명부", "급여대장", "복리후생 운영내역", "재무제표"],
    problem: "복지비를 그때그때 비용 처리만 하면 직원 체감도도 낮고 세무상 효율도 떨어집니다.", implication: "복지제도가 정비되지 않으면 핵심인력 이탈과 비효율적 복지비 지출이 계속됩니다.", ment: "사내(공동)근로복지기금으로 복지를 제도화하면 직원 만족·장기근속과 함께 출연금 손금산입 등 절세 효과까지 노릴 수 있습니다.",
    effects: ["직원 복지제도 체계화", "장기근속 유도", "복지비 운영 효율화", "법인세/소득세 절세 검토", "기업 이미지 개선"] },
  // ── 투자/인증 ──
  { cat: "연구소·인증", name: "벤처투자유형", base: 50, personalNote: "개인사업자 자료에서는 벤처투자유형 검토가 제한됩니다. 법인 전환 또는 법인 자료 기준으로 검토가 필요합니다.", signals: [["isTech", 10, "기술·성장 업종"], ["revUp", 8, "성장성"], ["multiOwner", 6, "주주·투자자 구조"], ["isMfg", 4, "제조업종"]],
    why: "벤처기업 확인은 인증(보증·평가)뿐 아니라 '벤처투자유형'으로도 받을 수 있습니다. 적격 투자(개인투자조합·벤처투자조합·전문엔젤·지인/임직원 적격투자 등)를 유치하면 벤처 확인과 함께 투자자는 소득공제, 기업은 자본확충 효과를 동시에 노릴 수 있습니다. (일반 벤처인증 가능성 검토와는 별개 항목)",
    interest: ["적격 투자 유치", "투자자 소득공제", "자본 확충·벤처 확인"],
    questions: ["외부 투자 유치 계획이 있으신가요?", "가족/지인/임직원 투자 구조를 검토해본 적이 있으신가요?", "투자자 소득공제 혜택까지 고려한 벤처투자유형을 검토해보신 적 있으신가요?", "기존 벤처 인증과 별도로 투자유형 요건을 검토할 필요가 있는데, 관심 있으신가요?"],
    docs: ["주주명부", "재무제표", "사업계획서", "투자 관련 자료"],
    problem: "투자 유치를 막연히 미루면 자본확충 시점과 투자자 절세 기회를 모두 놓칠 수 있습니다.", implication: "벤처투자유형 요건을 모르면 적격투자 구조를 못 짜 소득공제·벤처 확인 기회를 흘려보냅니다.", ment: "벤처투자유형은 적격 투자 유치로 벤처 확인을 받으면서, 투자자에게는 소득공제, 회사에는 자본확충과 정책자금·인증 연계 효과까지 줄 수 있습니다.",
    effects: ["벤처기업 확인", "투자자 소득공제 가능성", "자본 확충", "정책자금/인증 연계", "기업 신뢰도 제고"] },
];
// 상세재무제표(BS/IS)에 특정 계정 존재 여부
// 상세재무제표에 계정이 0원 초과로 존재하는지(값 후보 중 양수)
export function detailHasPositive(ui, re) {
  const ds = ui.detailStatements || {};
  for (const k of ["balanceSheet", "incomeStatement"]) {
    const s = ds[k]; if (!s || !s.items) continue;
    if (s.items.some((x) => re.test(String(x.rawLabel || x.account || "")) && (x.numberCandidates || []).some((v) => typeof v === "number" && v > 0))) return true;
  }
  return false;
}
// 원문에서 대표자 생년 추정 → 연령(best-effort). 못 찾으면 null.
export function extractCeoAge(raw) {
  const t = String(raw || "");
  let m = t.match(/대표[자이][^\n]{0,40}((?:19|20)\d{2})[.\-년/\s]/) || t.match(/생년(?:월일)?[^\d]{0,6}((?:19|20)\d{2})/);
  if (!m) return null;
  const by = parseInt(m[1], 10);
  if (by < 1930 || by > NOW_YEAR - 18) return null;
  return NOW_YEAR - by;
}
// 원문에서 주주 복수 여부 추정(best-effort) — 주주현황/주주명에 2명 이상 또는 1인 지분<100%
export function extractMultiOwner(raw) {
  const t = String(raw || "");
  const seg = (t.match(/주주\s*(?:현황|명부|구성)[\s\S]{0,400}/) || [])[0] || "";
  if (!seg) return false;
  const pcts = (seg.match(/\d{1,3}(?:\.\d+)?\s*%/g) || []).map((x) => parseFloat(x));
  if (pcts.length >= 2) return true;          // 지분율이 2개 이상 → 복수 주주
  if (pcts.length === 1 && pcts[0] < 99.5) return true; // 1인 지분 100% 미만 → 타 주주 존재
  const names = seg.match(/[가-힣]{2,4}(?=\s*\d|\s*주|\s*%)/g) || [];
  return names.length >= 2;
}
// 원문에서 현금흐름등급 추출(엔진 미인식 시 폴백). CF3/CR6/B5/숫자 등급 등 대응.
export function extractCashflowGrade(raw) {
  const t = String(raw || "").replace(/\s+/g, " ");
  // '현금흐름(등급)' 인근의 등급 코드(영문 1~3자+숫자 또는 숫자 등급)
  let m = t.match(/현금\s*흐름\s*(?:등급|평가|분석)?[^A-Za-z0-9]{0,12}([A-Za-z]{1,3}\s?-?\s?\d{1,2})/);
  if (m) return m[1].replace(/\s|-/g, "").toUpperCase();
  m = t.match(/현금\s*흐름\s*등급[^0-9]{0,6}(\d{1,2})\s*(?:등급|점)?/);
  if (m) return m[1] + "등급";
  return null;
}
function consultingCtx(ui) {
  const cp = ui.corePreview || {}, co = ui.companyInfo || {}, certInfo = ui.certInfo || {}, ipInfo = ui.ipInfo || {};
  const ind = String(co.industry || co.standardIndustry || co.industry10 || co.stdIndustry10 || co.mainProduct || "");
  const dr = ratioVal(cp, "debtRatio"), cr = ratioVal(cp, "currentRatio"), icr = ratioVal(cp, "interestCoverageRatio");
  const rev = coreTrend("revenue", cp.revenue), op = coreTrend("operatingProfit", cp.operatingProfit), ni = coreTrend("netIncome", cp.netIncome), cash = coreTrend("cash", cp.cash);
  const opLast = op && op.latest && op.latest.val, opStep = lastStep(op), cashLast = cash && cash.latest && cash.latest.val;
  const niLast = ni && ni.latest && ni.latest.val;
  const revEok = cp.revenue && typeof cp.revenue.eok === "number" ? cp.revenue.eok : null;
  const emp = parseInt(co.employees, 10) || 0;
  const re = cp.retainedEarnings && typeof cp.retainedEarnings.eok === "number" ? cp.retainedEarnings.eok : null;
  const estY = (() => { const m = String(co.established || "").match(/(19|20)\d{2}/); return m ? parseInt(m[0], 10) : null; })();
  const bizAge = estY ? NOW_YEAR - estY : null;
  const ceoAge = typeof ui.ceoAge === "number" ? ui.ceoAge : null;
  return {
    revDown: dir3(rev) === "감소", revUp: dir3(rev) === "증가",
    opNeg: typeof opLast === "number" && opLast < 0, opDown: !!(opStep && opStep.dir === "하락"), opUp: !!(opStep && opStep.dir === "상승"),
    cashDown: dir3(cash) === "감소", cashPos: typeof cashLast === "number" && cashLast > 0,
    niPos: typeof niLast === "number" && niLast > 0,
    drHigh: dr != null && dr >= 200, capitalErosion: !!(cp.debtRatio && cp.debtRatio.capitalErosion),
    crLow: cr != null && cr < 100, icrLow: icr != null && icr < 1,
    hasBorrowings: hasAmt(cp.shortTermBorrowings) || hasAmt(cp.longTermBorrowings),
    borrowingsUp: lastUp(coreTrend("shortTermBorrowings", cp.shortTermBorrowings)) || lastUp(coreTrend("longTermBorrowings", cp.longTermBorrowings)),
    hasEmp: emp > 0, emp5: emp >= 5,
    isTech: /기술|전자|기계|화학|연구|소프트|반도체|엔지니어|바이오|의료|정보통신/i.test(ind),
    isMfg: /제조|생산|가공|장치|제품|섬유|식품|금속|부품/.test(ind),
    hasRndLab: certInfo.rndLab === "인증",
    noRndLab: certInfo.rndLab !== "인증" && certInfo.rndDept !== "인증",
    noVenture: certInfo.venture !== "인증", noInnobiz: certInfo.innobiz !== "인증", noMainbiz: certInfo.mainbiz !== "인증",
    noIP: !["patent", "utility", "design", "trademark"].some((k) => typeof ipInfo[k] === "number" && ipInfo[k] >= 1),
    bid: !!(co.bid && (co.bid.tenders || co.bid.wins)),
    retHigh: re != null && re >= 10, retMid: re != null && re >= 3,
    smallScale: (revEok != null && revEok < 80) || (emp > 0 && emp <= 10),
    hasGasu: detailHasPositive(ui, /가\s*수\s*금/), hasGagj: detailHasPositive(ui, /가\s*지\s*급\s*금/),
    ceoOld: ceoAge != null && ceoAge >= 60, ceo50s: ceoAge != null && ceoAge >= 50 && ceoAge < 60, oldBiz: bizAge != null && bizAge >= 20,
    multiOwner: !!ui.multiOwner,
  };
}
// 적합도 점수(0~98) = base + 매칭 signal 가중치 합. 근거 = (always) + 매칭 signal 문구.
function scoreOf(s, ctx) { let sc = s.base; for (const [f, w] of s.signals) { if (ctx[f]) sc += w; } return Math.max(0, Math.min(98, Math.round(sc))); }
function reasonsOf(s, ctx) { const m = s.signals.filter(([f]) => ctx[f]).map(([, , t]) => t); return s.always ? [s.always, ...m] : m; }
// 전체를 적합도 점수 내림차순으로 — [{ s, score, reasons }]
// 이미 보유한 인증/산업재산권 → 해당 제안 우선순위 최하위 + 사유. (전략명 기준)
function heldStatus(ui) {
  const c = ui.certInfo || {}, ip = ui.ipInfo || {};
  const cert = (k) => c[k] === "인증";
  const map = {};
  if (cert("venture")) map["벤처기업 인증"] = "이미 보유중 — 이미 벤처 인증을 보유하고 있어 신규 검토 우선순위는 낮습니다. 사후관리·갱신 여부를 확인하세요.";
  if (cert("innobiz")) map["이노비즈(기술혁신형)"] = "이미 보유중 — 이노비즈 인증 보유. 사후관리·갱신 여부를 확인하세요.";
  if (cert("mainbiz")) map["메인비즈(경영혁신형)"] = "이미 보유중 — 메인비즈 인증 보유. 사후관리·갱신 여부를 확인하세요.";
  if (cert("rndLab") || cert("rndDept")) map["기업부설연구소 / 연구개발전담부서"] = "이미 보유중 — 연구소·전담부서 인정 보유. 인정 유지·연구활동 관리 여부를 확인하세요.";
  const ipCount = ["patent", "utility", "design", "trademark"].reduce((a, k) => a + (typeof ip[k] === "number" ? ip[k] : 0), 0);
  if (ipCount >= 1) map["특허·상표·디자인"] = "이미 보유중 — 산업재산권 보유. 신규 확보보다 IP 포트폴리오 점검·추가 출원·권리 유지관리 관점으로 검토하세요.";
  return map;
}
export function rankStrategies(ui) {
  const ctx = consultingCtx(ui);
  const held = heldStatus(ui);
  return CONSULTING_STRATEGIES.map((s) => {
    let score = scoreOf(s, ctx); let reasons = reasonsOf(s, ctx); let isHeld = false;
    const note = held[s.name];
    if (note) { isHeld = true; score = Math.min(score, 12); reasons = [note, ...reasons]; }   // 점수 비노출 — 내부적으로 최하위 강등
    return { s, score, reasons, held: isHeld };
  }).sort((a, b) => b.score - a.score || CONSULTING_STRATEGIES.indexOf(a.s) - CONSULTING_STRATEGIES.indexOf(b.s));
}
// 1장 요약/상단 표기용 — 점수 상위 전략(strategy 객체)
export function selectConsultingStrategies(ui) { return rankStrategies(ui).map((r) => r.s); }

// ③ 실전 미팅 질문 — 추이/지표에서 바로 읽을 수 있는 문장 생성
export function buildMeetingQuestions(ui) {
  const cp = ui.corePreview || {}, co = ui.companyInfo || {};
  const Q = [];
  const rev = coreTrend("revenue", cp.revenue), op = coreTrend("operatingProfit", cp.operatingProfit);
  const rd = dir3(rev);
  if (rd === "감소") Q.push("매출이 감소한 원인은 주요 거래처 이탈, 단가 하락, 수주 감소 중 어디에 가깝나요?");
  else if (rd === "증가") Q.push("매출 증가가 특정 거래처·일회성 수주 때문인가요, 반복 가능한 구조인가요?");
  if (lastUp(coreTrend("shortTermBorrowings", cp.shortTermBorrowings)) || lastUp(coreTrend("longTermBorrowings", cp.longTermBorrowings)))
    Q.push("차입금 증가는 운전자금 부족 때문인가요, 설비투자 때문인가요?");
  const opStep = lastStep(op);
  if (opStep && (opStep.dir === "상승" || opStep.transition === "흑자전환")) Q.push("영업이익이 개선된 이유는 원가율 개선인가요, 판관비 절감인가요?");
  if (lastUp(detailTrend(ui, /매출채권/)) || lastUp(detailTrend(ui, /재고자산/))) Q.push("매출채권이나 재고자산 증가가 실제 현금흐름 부담으로 이어지고 있나요?");
  const dr = ratioVal(cp, "debtRatio"), cr = ratioVal(cp, "currentRatio");
  if (dr != null && dr >= 200) Q.push("현재 차입금의 금리·만기 구조와 상환 계획은 어떻게 되어 있으신가요?");
  if (cr != null && cr < 100) Q.push("단기 지급 부담이 큰 시점이 있나요? 운전자금은 주로 어떻게 조달하고 계신가요?");
  if ((parseInt(co.employees, 10) || 0) > 0) Q.push("최근 채용했거나 앞으로 채용 예정인 인원이 있으신가요?");
  const ind = String(co.industry || co.standardIndustry || co.mainProduct || "");
  if (/제조|기술|전자|기계|화학|제품|연구|가공|생산|바이오|의료/.test(ind)) Q.push("연구개발, 제품개선, 공정개선 업무를 담당하는 인력이 있으신가요?");
  Q.push("현재 보유 중인 인증이나 앞으로 필요한 인증이 있으신가요?");
  const re = cp.retainedEarnings && cp.retainedEarnings.eok;
  if (typeof re === "number" && re >= 10) Q.push("누적된 이익잉여금의 활용(배당·퇴직재원·승계) 계획을 검토해 보신 적 있으신가요?");
  return Array.from(new Set(Q)).slice(0, 10);
}

// ④ 미팅 전 1장 요약(복사용) — 구조화 + 평문 변환
export function buildOneLiner(ui) {
  const co = ui.companyInfo || {};
  const summary = buildDiagnosisSummary(ui).filter((l) => l.tone !== "info").slice(0, 3).map((l) => l.text);
  const risks = summary.length ? summary : ["핵심 위험/기회 신호가 뚜렷하지 않습니다. 원문 확인을 권장합니다."];
  const strategies = selectConsultingStrategies(ui).slice(0, 5);
  // 우선 미팅 질문 = 상위 추천 항목의 핵심 질문(질문은 추천 항목과 연결)
  const questions = strategies.map((s) => s.questions[0]).filter(Boolean).slice(0, 5);
  return { company: co.companyName || "기업명 확인 필요", risks, questions, strategies: strategies.map((s) => s.name) };
}
export function oneLinerText(o) {
  return [
    `[${o.company}] 미팅 전 1장 요약`, "",
    "■ 핵심 위험/기회",
    ...o.risks.map((r, i) => `${i + 1}. ${r}`), "",
    "■ 우선 미팅 질문",
    ...o.questions.map((q, i) => `${i + 1}. ${q}`), "",
    "■ 추천 컨설팅 항목",
    ...o.strategies.map((s, i) => `${i + 1}. ${s}`),
  ].join("\n");
}

// corePreview 한 항목(시계열 보유) → 추이 객체
export function coreTrend(key, obj) {
  if (!obj || !obj.series || !obj.series.length) return null;
  const isR = !!obj.isRatio || ratioKeys.has(key);
  const t = cretopRowTrend({ isRatio: isR, numberCandidates: obj.series, yearCandidates: obj.years, unit: isR ? (obj.unit || "%") : (obj.unit || "천원") });
  return (t && t.series && t.series.length) ? t : null;
}

/**
 * 크레탑 원문 → 화면이 읽는 결과(ui). 원본 MiniApp `buildResult` 그대로.
 * @param {string} raw 보고서 원문(PDF 에서 뽑은 글 또는 붙여넣은 글)
 * @param {Array<{pageNo:number,text:string}>|null} [pages] PDF 쪽별 글(있으면 섹션 추출이 더 정확)
 */
export function analyzeCretopText(raw, pages) {
  const result = buildCretopParsedForUi(raw);
  result.ceoAge = extractCeoAge(raw); // 대표자 연령(추정)
  result.multiOwner = extractMultiOwner(raw); // 주주 복수 여부(추정)
  const cfHas = result.companyInfo && result.companyInfo.cashflowGrade && result.companyInfo.cashflowGrade.latest;
  if (!cfHas) { const cf = extractCashflowGrade(raw); if (cf) { const cfo = { latest: cf, series: null, years: [] }; if (result.companyInfo) result.companyInfo.cashflowGrade = cfo; if (result.corePreview) result.corePreview.cashflowGrade = cfo; } }
  // 기업개요 확장·팝업·주식가치용 원문 추출(페이지 우선 + raw fallback). 엔진 무관, 읽기 전용 추가 필드.
  const ex = extractAll(raw, pages || null);
  result.companyExtras = ex.companyExtras;
  result.stakeholders = ex.stakeholders;
  result.ceoDetail = ex.ceoDetail;
  result.workplace = ex.workplace;
  result.shares = ex.shares; result.parValue = ex.parValue; result.sharesSource = ex.sharesSource;
  result._extractDebug = ex._extractDebug;
  result.bizForm = detectBizForm(result);   // 개인사업자 감지
  return result;
}
