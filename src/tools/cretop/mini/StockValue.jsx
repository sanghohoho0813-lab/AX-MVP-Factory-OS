// 크레탑 미니앱 — 예상 주식가치(참고용 간이). 상증세법 보충적 평가방법 '구조 준용'.
//  * 읽기 전용: ui.trendRows(순이익·자본총계, 억원)만 사용. 엔진/재무계산 무수정.
//  * 발행주식수는 원문 추출(ui.shares) 또는 수동 입력. 정식 평가 아님(안내문 명시).
import React, { useState } from "react";
import { T, FF, card } from "./theme.js";

const won = (n) => (n == null || !isFinite(n)) ? "—" : Math.round(n).toLocaleString() + "원";
const tr = (ui, k) => (ui.trendRows || []).find((r) => r.key === k && r.trend && r.trend.series);

export function StockValue({ ui }) {
  const niRow = tr(ui, "netIncome");
  const eqRow = tr(ui, "totalEquity");
  const niSeries = niRow ? niRow.trend.series.filter((s) => typeof s.val === "number") : [];
  const last3 = niSeries.slice(-3).slice().sort((a, b) => (a.year || 0) - (b.year || 0)); // 오래된→최근
  const rev = last3.slice().reverse(); // 최근→과거
  const equityEok = (eqRow && eqRow.trend.latest && typeof eqRow.trend.latest.val === "number") ? eqRow.trend.latest.val
    : (ui.corePreview && ui.corePreview.totalEquity && typeof ui.corePreview.totalEquity.eok === "number" ? ui.corePreview.totalEquity.eok : null);

  const bf = ui.bizForm || {};
  const [override, setOverride] = useState(false);   // 개인사업자 계산 강제(검증용 고급 옵션)
  // 발행주식수: 주주현황 합산 자동값 기본 → 사용자 수정 가능
  const autoShares = (ui.shares && ui.shares > 0) ? ui.shares : null;
  const autoSource = ui.sharesSource || null;
  const [sharesInput, setSharesInput] = useState(autoShares ? String(autoShares) : "");
  const [userEdited, setUserEdited] = useState(false);
  const onShares = (v) => { setSharesInput(v); setUserEdited(true); };
  const shares = (() => { const n = parseInt(String(sharesInput).replace(/[^0-9]/g, ""), 10); return (n && n > 0) ? n : null; })();
  // 자본금(원) — 추정 액면가 역산용. detailStatements BS의 '자본금' 계정에서 추출(읽기 전용, 계산식 무관).
  const capitalWon = (() => {
    const bs = ui.detailStatements && ui.detailStatements.balanceSheet;
    if (!bs || !bs.items) return null;
    const it = bs.items.find((x) => { const l = String(x.rawLabel || x.account || "").replace(/[\s()*]/g, ""); return l === "자본금" || l === "보통주자본금"; });
    if (!it) return null;
    const vals = (it.numberCandidates || []).filter((v) => typeof v === "number");
    if (!vals.length) return null;
    const u = bs.unit || "천원"; const f = u === "원" ? 1 : u === "천원" ? 1000 : u === "백만원" ? 1e6 : u === "억원" ? 1e8 : 1000;
    return vals[vals.length - 1] * f;
  })();
  const estParValue = (capitalWon && shares) ? Math.round(capitalWon / shares) : null;   // 추정 액면가
  // 액면가 sanity check — 일반적인 액면가 후보와 비교(불일치 시 발행주식수/자본금 추출 오류 경고)
  const COMMON_PAR = [100, 500, 1000, 2500, 5000, 10000];
  const parCheck = (() => {
    if (!estParValue) return null;
    let cand = null, rel = Infinity;
    for (const c of COMMON_PAR) { const d = Math.abs(estParValue - c) / c; if (d < rel) { rel = d; cand = c; } }
    return { cand, rel, ok: rel <= 0.005 };   // 0.5% 이내면 일반 액면가와 일치로 간주
  })();

  const eps = (s) => (shares && s && typeof s.val === "number") ? (s.val * 1e8) / shares : null; // 1주당 순손익(원)
  const epsRecent = rev[0] ? eps(rev[0]) : null, epsPrev = rev[1] ? eps(rev[1]) : null, epsPrev2 = rev[2] ? eps(rev[2]) : null;
  let wsum = 0, wnum = 0; [[epsRecent, 3], [epsPrev, 2], [epsPrev2, 1]].forEach(([e, w]) => { if (typeof e === "number") { wsum += w; wnum += e * w; } });
  const weightedEps = wsum ? wnum / wsum : null;          // 가중평균 1주당 순손익
  const earningsValue = weightedEps != null ? weightedEps / 0.10 : null; // 순손익가치
  const assetValue = (shares && equityEok != null) ? (equityEok * 1e8) / shares : null; // 순자산가치
  const finalValue = (earningsValue != null && assetValue != null) ? (earningsValue * 3 + assetValue * 2) / 5 : null;

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

  const ylabel = (s, fallback) => (s && s.year) ? `${s.year}년` : fallback;
  const tableRows = [
    [`최근연도(${ylabel(rev[0], "—")}) 1주당 순손익`, won(epsRecent)],
    [`직전연도(${ylabel(rev[1], "—")}) 1주당 순손익`, won(epsPrev)],
    [`전전연도(${ylabel(rev[2], "—")}) 1주당 순손익`, won(epsPrev2)],
    ["가중평균 순손익 (3:2:1)", won(weightedEps)],
    ["순손익가치 (가중평균 ÷ 0.10)", won(earningsValue)],
    ["순자산가치 (순자산 ÷ 주식수)", won(assetValue)],
    ["최종 예상 주식가치 (손익3 : 자산2)", won(finalValue)],
  ];

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
        ⚠️ 참고용 간이 계산입니다. 실제 상증세법상 평가액은 세무조정 및 추가 자료에 따라 달라질 수 있습니다.
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
      <div style={{ ...card, padding: "18px 20px", textAlign: "center", borderColor: T.brand + "33", background: T.brandSoft }}>
        <div style={{ fontSize: "calc(13px * var(--fs,1))", fontWeight: 700, color: T.sub }}>예상 주식가치</div>
        <div style={{ fontSize: "calc(30px * var(--fs,1))", fontWeight: 900, color: T.brand, lineHeight: 1.2, marginTop: 4, wordBreak: "break-all" }}>{finalValue != null ? Math.round(finalValue).toLocaleString() : "—"}<span style={{ fontSize: "calc(15px * var(--fs,1))", fontWeight: 800 }}> 원 / 주</span></div>
        {finalValue == null ? <div style={{ fontSize: "calc(11.5px * var(--fs,1))", color: T.mute, marginTop: 6 }}>발행주식수와 3개년 순이익·순자산이 있어야 계산됩니다.</div> : null}
      </div>

      {/* 계산 표 */}
      <div style={{ ...card, padding: "6px 8px" }}>
        {tableRows.map(([k, v], i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "10px 10px", borderTop: i ? `1px solid ${T.lineSoft}` : "none" }}>
            <span style={{ fontSize: "calc(12px * var(--fs,1))", color: T.sub, fontWeight: i === tableRows.length - 1 ? 800 : 600 }}>{k}</span>
            <span style={{ fontSize: "calc(13px * var(--fs,1))", fontWeight: i === tableRows.length - 1 ? 900 : 700, color: i === tableRows.length - 1 ? T.brand : T.ink, whiteSpace: "nowrap" }}>{v}</span>
          </div>
        ))}
      </div>

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
