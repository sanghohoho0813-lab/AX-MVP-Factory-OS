// 크레탑 미니앱 — 예상 주식가치(참고용). 상증세법 보충적 평가방법.
//  * [D-109] 계산식은 세금 계산기 '09 비상장주식 가치평가'와 같은 함수(unlistedShareValuation)를 그대로 쓴다.
//    예전 간이식(손익3:자산2 · 최저 80% 없음 · 있는 해만 평균)을 대체했다. 여기서 식을 따로 고치지 말 것.
//  * 원문에서 자산총계·부채총계·3개년 당기순이익·발행주식수·부동산(토지·건물) 장부가를 읽어 채우고,
//    원문에 없는 값(부동산 시가·퇴직급여추계액·영업권·증자/감자·법인 구분·이자율)은 '평가 조건'에서 고친다.
//  * [D-111] 재료·저장은 stockValueCalc.js — 1장 요약·업체 기록 붙이기도 같은 값을 쓴다. 고친 값은 회사별로 기억한다.
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { T, FF, card } from "./theme.js";
import { autoShares as autoSharesOf, bsWon, commas, netIncomeYears, num, parseShares, pctText, svCompute, svDefaults, svLoad, svSave, won } from "./stockValueCalc.js";

const CORP_TYPES = ["일반법인", "부동산과다보유법인", "특수법인"];
let condOpenMemo = false; // 이 탭을 여는 동안 평가 조건 칸 펼침 상태
const TAX_STORE = "axmvp.tax.t3"; // 세금 계산기 09 가 기억하는 입력 (TaxCalculatorsPage STORAGE_PREFIX + key)

export function StockValue({ ui }) {
  const navigate = useNavigate();
  const niRow = (ui.trendRows || []).find((r) => r.key === "netIncome" && r.trend && r.trend.series);
  const niSeries = niRow ? niRow.trend.series.filter((s) => typeof s.val === "number") : [];
  const eqRow = (ui.trendRows || []).find((r) => r.key === "totalEquity" && r.trend && r.trend.series);
  const equityEok = (eqRow && eqRow.trend.latest && typeof eqRow.trend.latest.val === "number") ? eqRow.trend.latest.val
    : (ui.corePreview && ui.corePreview.totalEquity && typeof ui.corePreview.totalEquity.eok === "number" ? ui.corePreview.totalEquity.eok : null);
  const last3 = netIncomeYears(ui); // 오래된→최근

  const bf = ui.bizForm || {};
  const [override, setOverride] = useState(false);   // 개인사업자 계산 강제(검증용 고급 옵션)
  // 발행주식수: 주주현황 합산 자동값 기본 → 사용자 수정 가능 (고친 값은 회사별로 기억)
  const autoShares = autoSharesOf(ui);
  const autoSource = ui.sharesSource || null;
  const defaults = svDefaults(ui);
  const initial = () => { const saved = svLoad(ui); return { shares: saved.shares != null ? saved.shares : (autoShares ? String(autoShares) : ""), sharesEdited: saved.shares != null, cond: saved.cond ? { ...defaults, ...saved.cond } : defaults }; };
  const [st, setSt] = useState(initial);
  // 다른 보고서를 분석하면 그 회사 값으로
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setSt(initial()); }, [ui]);
  const sharesInput = st.shares;
  const userEdited = st.sharesEdited;
  const cond = st.cond;
  const edited = Object.keys(defaults).some((k) => cond[k] !== defaults[k]);
  // 바뀔 때마다 이 회사 값으로 저장 — 원문 그대로인 칸은 저장하지 않는다
  const persist = (next) => {
    const condEdited = Object.keys(defaults).some((k) => next.cond[k] !== defaults[k]);
    svSave(ui, { shares: next.sharesEdited ? next.shares : undefined, cond: condEdited ? next.cond : undefined });
  };
  // 저장은 그린 뒤에 — 그리는 도중에 저장 알림(SV_EVENT)을 보내면 요약 막대가 같은 틈에 다시 그려져 React 가 경고한다
  const dirty = useRef(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (dirty.current) { dirty.current = false; persist(st); } }, [st]);
  const update = (fn) => { dirty.current = true; setSt(fn); };
  const onShares = (v) => update((c) => ({ ...c, shares: v, sharesEdited: true }));
  const setC = (k, v) => update((c) => ({ ...c, cond: { ...c.cond, [k]: v } }));
  const resetCond = () => update((c) => ({ ...c, cond: defaults }));
  // 업체 기록에 붙이면 업체 목록을 다시 읽으면서 이 화면이 새로 그려진다 — 펼친 채로 두던 조건 칸이 접히지 않게 기억
  const [openCond, setOpenCondState] = useState(() => condOpenMemo);
  const setOpenCond = (fn) => setOpenCondState((o) => { const v = typeof fn === "function" ? fn(o) : fn; condOpenMemo = v; return v; });

  const shares = parseShares(sharesInput);
  // 자본금(원) — 추정 액면가 역산용. detailStatements BS의 '자본금' 계정에서 추출(읽기 전용, 계산식 무관).
  const capitalWon = bsWon(ui, ["자본금"]) ?? bsWon(ui, ["보통주자본금"]);
  const estParValue = (capitalWon && shares) ? Math.round(capitalWon / shares) : null;   // 추정 액면가
  // 액면가 sanity check — 일반적인 액면가 후보와 비교(불일치 시 발행주식수/자본금 추출 오류 경고)
  const COMMON_PAR = [100, 500, 1000, 2500, 5000, 10000];
  const parCheck = (() => {
    if (!estParValue) return null;
    let cand = null, rel = Infinity;
    for (const c of COMMON_PAR) { const d = Math.abs(estParValue - c) / c; if (d < rel) { rel = d; cand = c; } }
    return { cand, rel, ok: rel <= 0.005 };   // 0.5% 이내면 일반 액면가와 일치로 간주
  })();

  const reBookAuto = bsWon(ui, ["토지", "건물", "구축물", "투자부동산"]);
  const yearsFound = last3.length;
  const r = svCompute(ui, shares, cond);
  const finalValue = r ? r.finalPerShare : null;
  const floorApplied = r ? r.minFloor > r.weightedValue : false;

  /** 세금 계산기 09 로 같은 값을 넘겨 자세히 본다 */
  const openInTaxCalc = () => {
    const name = (ui.companyInfo && ui.companyInfo.companyName) || ui.companyName || "";
    const v = {
      v_name: String(name || "ㅇㅇㅇ"), v_shares: shares ? shares.toLocaleString("en-US") : "", v_par: estParValue ? estParValue.toLocaleString("en-US") : "",
      v_rate: cond.rate, v_asset: cond.asset, v_debt: cond.debt, v_re_book: cond.reBook, v_re_fair: cond.reFair,
      v_severance: cond.severance, v_goodwill: cond.goodwill, v_type: cond.type,
      v_inc0: cond.inc0, v_month0: cond.month0, v_cap0: cond.cap0,
      v_inc1: cond.inc1, v_month1: cond.month1, v_cap1: cond.cap1,
      v_inc2: cond.inc2, v_month2: cond.month2, v_cap2: cond.cap2,
    };
    try { localStorage.setItem(TAX_STORE, JSON.stringify(v)); } catch { /* 못 넘겨도 계산기는 열린다 */ }
    navigate("/tools/tax?c=t3");
  };

  // 상승/하락 요인(자동)
  const up = [], down = [];
  const niLast = niSeries.length ? niSeries[niSeries.length - 1].val : null;
  const niPrev = niSeries.length >= 2 ? niSeries[niSeries.length - 2].val : null;
  if (typeof niLast === "number" && typeof niPrev === "number") { if (niLast > niPrev) up.push("최근 당기순이익 증가"); else if (niLast < niPrev) down.push("최근 당기순이익 감소"); }
  if (typeof niLast === "number" && niLast < 0) down.push("최근 순손실(결손) 발생");
  const eqSeries = eqRow ? eqRow.trend.series.filter((s) => typeof s.val === "number") : [];
  if (eqSeries.length >= 2) { const a = eqSeries[eqSeries.length - 2].val, b = eqSeries[eqSeries.length - 1].val; if (b > a) up.push("순자산(자본총계) 증가"); else if (b < a) down.push("순자산(자본총계) 감소"); }
  if (typeof equityEok === "number" && equityEok < 0) down.push("자본잠식 위험(자본총계 마이너스)");
  const reEok = ui.corePreview && ui.corePreview.retainedEarnings && typeof ui.corePreview.retainedEarnings.eok === "number" ? ui.corePreview.retainedEarnings.eok : null;
  if (typeof reEok === "number" && reEok >= 5) up.push("이익잉여금 누적");
  if (typeof reEok === "number" && reEok < 0) down.push("결손금 누적");
  if (!up.length) up.push("뚜렷한 상승 요인은 원문 확인이 필요합니다.");
  if (!down.length) down.push("뚜렷한 하락 요인은 확인되지 않았습니다.");

  // 연도 자리: [1년전(가중1), 직전(가중2), 결산연도(가중3)]
  const slotYear = [null, null, null];
  last3.forEach((x, i) => { slotYear[3 - last3.length + i] = x.year || null; });
  const yl = (i, fb) => slotYear[i] ? `${slotYear[i]}년` : fb;
  const tableRows = r ? [
    ["순자산가액 (자산 − 부채 ± 조정)", won(r.netAssetValue)],
    ["1주당 순자산가치", won(r.perShareNetAsset)],
    [`${yl(2, "결산연도")} 1주당 순손익 (×3)`, won(r.perShareIncome[2])],
    [`${yl(1, "직전연도")} 1주당 순손익 (×2)`, won(r.perShareIncome[1])],
    [`${yl(0, "전전연도")} 1주당 순손익 (×1)`, won(r.perShareIncome[0])],
    ["가중평균 1주당 순손익 (÷6)", won(r.weightedAvg)],
    [`1주당 순손익가치 (가중평균 ÷ ${num(cond.rate)}%)`, won(r.perShareIncomeValue)],
    ["법인 구분 (반영값)", r.corpType],
    ["가중치 (순자산 / 순손익)", `${pctText(r.wNetAsset, 0)} / ${pctText(r.wIncome, 0)}`],
    ["A. 가중평균액", won(r.weightedValue)],
    ["B. 최저 한도 (순자산가치 × 80%)", won(r.minFloor)],
    ["1주당 평가액 (A·B 중 큰 값)", won(r.finalPerShare)],
    ["기업가치 평가액 (1주당 × 발행주식수)", won(r.totalValue)],
    ["순자산 대비 주가 비율", pctText(r.priceRatio)],
  ] : [];
  const lastIdx = 11; // 1주당 평가액 줄을 강조

  // 개인사업자 차단(기본) — 고급 옵션으로만 강제 계산
  if (bf.isPersonal && !override) {
    return (
      <div style={{ display: "grid", gap: 12 }}>
        <div style={{ ...card, padding: "18px 20px", textAlign: "center", borderColor: "#FDE68A", background: "#FFFBEB" }}>
          <div style={{ fontSize: "calc(28px * var(--fs,1))", marginBottom: 6 }}>🚫</div>
          <div style={{ fontSize: "calc(15px * var(--fs,1))", fontWeight: 900, color: "#92400E", lineHeight: 1.4 }}>개인사업자는 1주당 주식가치 산정 대상이 아닙니다.</div>
          <div style={{ fontSize: "calc(12.5px * var(--fs,1))", color: T.sub, marginTop: 8, lineHeight: 1.6 }}>법인 전환 또는 법인 사업자 자료에서만 참고용 주식가치 계산을 사용할 수 있습니다.</div>
        </div>
        <button onClick={() => setOverride(true)} style={{ justifySelf: "center", border: `1px solid ${T.line}`, background: "#fff", color: T.mute, borderRadius: 9, padding: "8px 14px", fontSize: "calc(11.5px * var(--fs,1))", fontWeight: 700, fontFamily: FF, cursor: "pointer" }}>고급 옵션: 계산식 검증용으로 강제 표시 ▾</button>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {bf.isPersonal && override ? (
        <div style={{ fontSize: "calc(11.5px * var(--fs,1))", color: "#991B1B", background: "#FEF2F2", border: `1px solid #FCA5A5`, borderRadius: 10, padding: "10px 12px", lineHeight: 1.55, fontWeight: 700 }}>
          🧪 비법인 자료이므로 실무 적용 불가. 계산식 검증용으로만 표시합니다.
        </div>
      ) : null}
      {/* 안내문(필수) */}
      <div style={{ fontSize: "calc(11.5px * var(--fs,1))", color: "#92400E", background: "#FFFBEB", border: `1px solid #FDE68A`, borderRadius: 10, padding: "10px 12px", lineHeight: 1.55 }}>
        ⚠️ 참고용 계산입니다. 크레탑 원문(당기순이익·장부가)으로 채웠으므로, 세무조정 순손익액 · 부동산 시가 · 퇴직급여추계액 등은 ‘평가 조건’에서 고쳐야 실제 상증세법 평가액에 가까워집니다.
      </div>

      {/* 발행주식수 — 주주현황 자동 합산값 기본, 수정 가능 */}
      <div style={{ ...card, padding: "12px 14px", display: "grid", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: "calc(12.5px * var(--fs,1))", fontWeight: 800, color: T.ink }}>발행주식수</span>
          <input value={sharesInput} onChange={(e) => onShares(e.target.value)} inputMode="numeric" placeholder="예: 50,000"
            style={{ flex: "1 1 120px", minWidth: 0, border: `1px solid ${shares ? T.line : "#F59E0B"}`, borderRadius: 8, padding: "8px 11px", fontSize: "calc(13px * var(--fs,1))", fontFamily: FF, color: T.ink, outline: "none" }} />
          <span style={{ fontSize: "calc(13px * var(--fs,1))", fontWeight: 800, color: T.ink, whiteSpace: "nowrap" }}>{shares ? `${shares.toLocaleString()}주` : ""}</span>
        </div>
        {userEdited
          ? <div style={{ fontSize: "calc(10.5px * var(--fs,1))", color: T.brand, fontWeight: 700 }}>✎ 사용자 직접 입력값 사용 중{autoShares ? ` (자동값 ${autoShares.toLocaleString()}주)` : ""}</div>
          : autoShares
            ? <div style={{ fontSize: "calc(10.5px * var(--fs,1))", color: T.mute }}>출처: {autoSource || "크레탑 자동 추출"}</div>
            : <div style={{ fontSize: "calc(10.5px * var(--fs,1))", color: "#92400E" }}>원문에서 발행주식수를 찾지 못했습니다. 직접 입력해주세요.</div>}
      </div>

      {/* 액면가 — 추정(자본금÷발행주식수) + sanity check + 안내 */}
      <div style={{ ...card, padding: "12px 14px", display: "grid", gap: 5 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: "calc(12.5px * var(--fs,1))", fontWeight: 800, color: T.ink }}>액면가</span>
          {estParValue ? <span style={{ fontSize: "calc(13px * var(--fs,1))", fontWeight: 800, color: (parCheck && !parCheck.ok) ? T.down : T.brand }}>추정 {estParValue.toLocaleString()}원</span> : <span style={{ fontSize: "calc(12px * var(--fs,1))", color: T.mute }}>확인 필요</span>}
          {estParValue ? <span style={{ fontSize: "calc(10.5px * var(--fs,1))", color: T.mute }}>(자본금 ÷ 발행주식수)</span> : null}
        </div>
        {estParValue && parCheck && !parCheck.ok
          ? <div style={{ fontSize: "calc(11px * var(--fs,1))", color: "#991B1B", background: "#FEF2F2", border: `1px solid #FCA5A5`, borderRadius: 8, padding: "7px 10px", lineHeight: 1.55, fontWeight: 600 }}>⚠️ 추정 액면가 계산값이 일반적인 액면가(100·500·1,000·2,500·5,000·10,000원)와 맞지 않습니다. 발행주식수 또는 자본금 추출 오류 가능성이 있으니 확인이 필요합니다.</div>
          : null}
        {estParValue
          ? <div style={{ fontSize: "calc(10.5px * var(--fs,1))", color: "#92400E", lineHeight: 1.55 }}>※ 추정값입니다. 증자·감자·자기주식·우선주 등이 있으면 실제와 다를 수 있어 확정값이 아닙니다. 실제 액면가는 법인등기부등본/정관/주주명부 확인이 필요합니다.</div>
          : <div style={{ fontSize: "calc(10.5px * var(--fs,1))", color: "#92400E", lineHeight: 1.55 }}>액면가는 크레탑에서 확인되지 않을 수 있습니다. 정확한 액면가는 법인등기부등본, 정관, 주주명부 또는 주식등변동상황명세서 확인이 필요합니다.</div>}
      </div>

      {/* 예상 주식가치(크게) */}
      <div data-testid="stock-value-final" style={{ ...card, padding: "18px 20px", textAlign: "center", borderColor: T.brand + "33", background: T.brandSoft }}>
        <div style={{ fontSize: "calc(13px * var(--fs,1))", fontWeight: 700, color: T.sub }}>예상 주식가치 (1주당)</div>
        <div style={{ fontSize: "calc(30px * var(--fs,1))", fontWeight: 900, color: T.brand, lineHeight: 1.2, marginTop: 4, wordBreak: "break-all" }}>{finalValue != null ? Math.round(finalValue).toLocaleString() : "—"}<span style={{ fontSize: "calc(15px * var(--fs,1))", fontWeight: 800 }}> 원 / 주</span></div>
        {r ? <div style={{ fontSize: "calc(12px * var(--fs,1))", color: T.sub, marginTop: 6 }}>기업가치 <b style={{ color: T.ink }}>{won(r.totalValue)}</b> · {r.corpType} · 순자산 {pctText(r.wNetAsset, 0)} : 순손익 {pctText(r.wIncome, 0)}{floorApplied ? " · 최저 한도(순자산 80%) 적용" : ""}</div> : null}
        {!r ? <div style={{ fontSize: "calc(11.5px * var(--fs,1))", color: T.mute, marginTop: 6 }}>발행주식수 · 자산/부채(또는 자본총계) · 순이익이 있어야 계산됩니다.</div> : null}
        <div style={{ fontSize: "calc(10.5px * var(--fs,1))", color: T.mute, marginTop: 8 }}>세금 계산기 ‘09 비상장주식 가치평가’와 같은 계산식 (상증세법 보충적 평가)</div>
      </div>

      {r && yearsFound < 3 ? (
        <div style={{ fontSize: "calc(11.5px * var(--fs,1))", color: "#92400E", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "10px 12px", lineHeight: 1.55 }}>
          ⚠️ 원문에서 순이익을 {yearsFound}개년만 찾았습니다. 없는 해는 0원으로 계산했습니다 — 아래 ‘평가 조건’에서 직접 적어 주세요.
          사업 개시 3년 미만 법인은 법상 순자산가치로만 평가합니다(법인 구분을 ‘특수법인’으로 두면 순자산 100%).
        </div>
      ) : null}

      {/* 계산 표 — 세금 계산기 09 의 결과 줄과 같은 순서 */}
      {r ? (
        <div data-testid="stock-value-table" style={{ ...card, padding: "6px 8px" }}>
          {tableRows.map(([k, v], i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "9px 10px", borderTop: i ? `1px solid ${T.lineSoft}` : "none", background: i === lastIdx ? T.brandSoft : "transparent", borderRadius: i === lastIdx ? 8 : 0 }}>
              <span style={{ fontSize: "calc(12px * var(--fs,1))", color: T.sub, fontWeight: i === lastIdx ? 800 : 600, minWidth: 0 }}>{k}</span>
              <span style={{ fontSize: "calc(13px * var(--fs,1))", fontWeight: i === lastIdx ? 900 : 700, color: i === lastIdx ? T.brand : T.ink, whiteSpace: "nowrap" }}>{v}</span>
            </div>
          ))}
          {r ? <div style={{ fontSize: "calc(10.5px * var(--fs,1))", color: T.mute, padding: "6px 10px 8px", lineHeight: 1.5 }}>참고 자동판정: {r.autoType} (부동산 비율 {pctText(r.reRatio)}) — 반영값은 ‘평가 조건’의 법인 구분입니다.</div> : null}
        </div>
      ) : null}

      {/* [D-109] 평가 조건 — 원문 값 + 원문에 없는 값 */}
      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        <button type="button" data-testid="stock-value-cond-toggle" aria-expanded={openCond} onClick={() => setOpenCond((o) => !o)}
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 14px", border: 0, background: "transparent", cursor: "pointer", fontFamily: FF, textAlign: "left" }}>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: "block", fontSize: "calc(13px * var(--fs,1))", fontWeight: 800, color: T.ink }}>평가 조건 {edited ? <span style={{ color: T.brand }}>· 고친 값 사용 중</span> : null}</span>
            <span style={{ display: "block", fontSize: "calc(11px * var(--fs,1))", color: T.mute, marginTop: 2 }}>법인 구분 · 이자율 · 부동산 시가 · 퇴직급여 · 영업권 · 연도별 순손익 · 증자/감자</span>
          </span>
          <span aria-hidden="true" style={{ color: T.mute, fontSize: "calc(14px * var(--fs,1))" }}>{openCond ? "▴" : "▾"}</span>
        </button>
        {openCond ? (
          <div data-testid="stock-value-cond" style={{ borderTop: `1px solid ${T.lineSoft}`, padding: "12px 14px", display: "grid", gap: 14 }}>
            <CondGroup title="법인 구분 · 이자율">
              <label style={lblStyle}>
                <span style={lblText}>법인 구분</span>
                <select aria-label="법인 구분" value={cond.type} onChange={(e) => setC("type", e.target.value)} style={inputStyle}>
                  {CORP_TYPES.map((t) => <option key={t} value={t}>{t}{r && r.autoType === t ? " (자동판정)" : ""}</option>)}
                </select>
                <span style={hintText}>일반 40:60 · 부동산과다 60:40 · 특수 100:0 (순자산:순손익)</span>
              </label>
              <CondField k="rate" label="적용이자율 (%)" hint="순손익가치 환원율 · 기획재정부 고시 10%" cond={cond} setC={setC} plain />
            </CondGroup>
            <CondGroup title="재무상태 (원문 최근 결산)">
              <CondField k="asset" label="자산총계 (원)" cond={cond} setC={setC} />
              <CondField k="debt" label="부채총계 (원)" cond={cond} setC={setC} />
              <CondField k="reBook" label="부동산 장부가 (원)" hint={reBookAuto != null ? "원문 토지·건물 등 합계" : "원문에 없음 — 있으면 적어 주세요"} cond={cond} setC={setC} />
              <CondField k="reFair" label="부동산 시가 (원)" hint="모르면 장부가와 같게 두세요" cond={cond} setC={setC} />
              <CondField k="severance" label="미반영 퇴직급여추계액 (원)" cond={cond} setC={setC} />
              <CondField k="goodwill" label="영업권 상당액 (원)" cond={cond} setC={setC} />
            </CondGroup>
            {[2, 1, 0].map((i) => (
              <CondGroup key={i} title={`${i === 2 ? "결산연도" : i === 1 ? "직전연도" : "전전연도"}${slotYear[i] ? ` (${slotYear[i]}년)` : ""} · 가중 ${i + 1}`}>
                <CondField k={`inc${i}`} label="순손익액 (원)" hint="원문 당기순이익 — 세무조정 순손익액이 있으면 그 값으로" cond={cond} setC={setC} />
                <CondField k={`month${i}`} label="유상증(감)자 실시월 (1~12)" cond={cond} setC={setC} plain />
                <CondField k={`cap${i}`} label="유상증(감)자 금액 (감자는 −)" cond={cond} setC={setC} />
              </CondGroup>
            ))}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" onClick={resetCond} disabled={!edited}
                style={{ border: `1px solid ${T.line}`, background: "#fff", color: edited ? T.sub : T.mute, borderRadius: 9, padding: "8px 12px", fontSize: "calc(12px * var(--fs,1))", fontWeight: 700, fontFamily: FF, cursor: edited ? "pointer" : "default" }}>원문 값으로 되돌리기</button>
            </div>
          </div>
        ) : null}
      </div>

      <button type="button" data-testid="stock-value-open-tax" onClick={openInTaxCalc} disabled={!r}
        style={{ justifySelf: "start", border: `1px solid ${T.brand}55`, background: "#fff", color: r ? T.brand : T.mute, borderRadius: 9, padding: "9px 14px", fontSize: "calc(12.5px * var(--fs,1))", fontWeight: 800, fontFamily: FF, cursor: r ? "pointer" : "default" }}>
        세금 계산기 ‘09 비상장주식 가치평가’에서 같은 값으로 열기 →
      </button>

      {/* 상승/하락 요인 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,230px),1fr))", gap: 10 }}>
        <div style={{ ...card, padding: "12px 14px" }}>
          <div style={{ fontSize: "calc(12.5px * var(--fs,1))", fontWeight: 800, color: T.up, marginBottom: 7 }}>📈 주식가치 상승 요인</div>
          <ul style={{ margin: 0, paddingLeft: 16, display: "grid", gap: 3 }}>{up.map((x, i) => <li key={i} style={{ fontSize: "calc(12px * var(--fs,1))", color: T.sub, lineHeight: 1.5 }}>{x}</li>)}</ul>
        </div>
        <div style={{ ...card, padding: "12px 14px" }}>
          <div style={{ fontSize: "calc(12.5px * var(--fs,1))", fontWeight: 800, color: T.down, marginBottom: 7 }}>📉 주식가치 하락 요인</div>
          <ul style={{ margin: 0, paddingLeft: 16, display: "grid", gap: 3 }}>{down.map((x, i) => <li key={i} style={{ fontSize: "calc(12px * var(--fs,1))", color: T.sub, lineHeight: 1.5 }}>{x}</li>)}</ul>
        </div>
      </div>
    </div>
  );
}

const lblStyle = { display: "grid", gap: 4, minWidth: 0 };
const lblText = { fontSize: "calc(11.5px * var(--fs,1))", fontWeight: 700, color: T.sub };
const hintText = { fontSize: "calc(10.5px * var(--fs,1))", color: T.mute, lineHeight: 1.45 };
const inputStyle = { width: "100%", minWidth: 0, boxSizing: "border-box", border: `1px solid ${T.line}`, borderRadius: 8, padding: "8px 10px", fontSize: "calc(13px * var(--fs,1))", fontFamily: FF, color: T.ink, background: "#fff", outline: "none" };

function CondGroup({ title, children }) {
  return (
    <fieldset style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
      <legend style={{ fontSize: "calc(12px * var(--fs,1))", fontWeight: 800, color: T.ink, marginBottom: 8, padding: 0 }}>{title}</legend>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,190px),1fr))", gap: 10 }}>{children}</div>
    </fieldset>
  );
}

/** 금액 칸은 세금 계산기처럼 손을 떼면 쉼표. plain 은 이자율·월처럼 쉼표 없는 숫자 */
function CondField({ k, label, hint, cond, setC, plain }) {
  return (
    <label style={lblStyle}>
      <span style={lblText}>{label}</span>
      <input aria-label={label} inputMode="decimal" value={cond[k]} onChange={(e) => setC(k, e.target.value)} onBlur={plain ? undefined : (e) => setC(k, commas(e.target.value))}
        style={{ ...inputStyle, textAlign: "right", fontVariantNumeric: "tabular-nums" }} />
      {hint ? <span style={hintText}>{hint}</span> : null}
    </label>
  );
}

