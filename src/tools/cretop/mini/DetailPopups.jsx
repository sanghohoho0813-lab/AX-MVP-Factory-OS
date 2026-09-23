// 크레탑 미니앱 — 상세정보/대표자/사업장/관계회사/거래처 팝업. 크레탑 원문 추출값 표시.
import React, { useEffect, useState } from "react";
import { T, FF } from "./theme.js";

const FZ = (n) => Math.round(n * 1.35 * 10) / 10;   // 팝업 글씨 약 +35%(가독성)
const overlay = { position: "fixed", inset: 0, background: "rgba(15,23,42,.5)", zIndex: 80, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "0 14px", overflowY: "auto" };
const panel = { width: "100%", maxWidth: 680, margin: "6vh 0 40px", background: "#fff", borderRadius: 16, boxShadow: "0 12px 40px rgba(15,23,42,.25)", fontFamily: FF, color: T.ink };

// [D-94] Esc 로 닫기 — 원본 팝업은 바깥 누르기·✕ 로만 닫혔다
function useEscClose(onClose) {
  useEffect(() => {
    const f = (e) => { if (e.key === "Escape" && onClose) onClose(); };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [onClose]);
}

// sections: [{ label, value }]  value=null/"" → '크레탑 정보 없음'
export function InfoModal({ title, subtitle, sections, onClose }) {
  useEscClose(onClose);
  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "15px 18px", borderBottom: `1px solid ${T.line}`, position: "sticky", top: 0, background: "#fff", borderTopLeftRadius: 16, borderTopRightRadius: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: FZ(16), fontWeight: 900 }}>{title}</div>
            {subtitle ? <div style={{ fontSize: FZ(11.5), color: T.mute, marginTop: 2 }}>{subtitle}</div> : null}
          </div>
          <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: FZ(20), color: T.mute }}>✕</button>
        </div>
        <div style={{ padding: "14px 18px", display: "grid", gap: 14 }}>
          {sections.map((s, i) => {
            const empty = s.value == null || String(s.value).trim() === "";
            return (
              <div key={i}>
                <div style={{ fontSize: FZ(12.5), fontWeight: 800, color: T.ink, marginBottom: 5 }}>{s.label}</div>
                <div style={{ fontSize: FZ(13), color: empty ? T.mute : T.sub, lineHeight: 1.6, whiteSpace: "pre-wrap", background: "#F8FAFC", border: `1px solid ${T.line}`, borderRadius: 9, padding: "9px 11px" }}>{empty ? "크레탑 정보 없음" : s.value}</div>
              </div>
            );
          })}
        </div>
        <div style={{ padding: "0 18px 18px" }}>
          <div style={{ fontSize: FZ(11), color: T.mute, lineHeight: 1.55, marginBottom: 10 }}>※ 크레탑 원문에서 자동 추출한 참고 정보입니다. 정확한 내용은 원문을 확인하세요.</div>
          <button onClick={onClose} style={{ width: "100%", border: `1px solid ${T.line}`, background: "#fff", borderRadius: 10, padding: "12px", fontSize: FZ(14), fontWeight: 700, fontFamily: FF, color: T.sub, cursor: "pointer" }}>닫기</button>
        </div>
      </div>
    </div>
  );
}

// 원문 텍스트 보기/복사 — 추출이 비면 이 화면 내용을 그대로 개발자에게 전달하면 파서를 맞출 수 있음.
export function RawTextModal({ text, pages, onClose }) {
  const [copied, setCopied] = useState("");
  const copy = (key, val) => { try { if (typeof navigator !== "undefined" && navigator.clipboard) navigator.clipboard.writeText(val || "").then(() => { setCopied(key); setTimeout(() => setCopied(""), 1500); }); } catch (e) {} };
  const full = text || (pages || []).map((p) => `===== page ${p.pageNo} =====\n${p.text}`).join("\n\n");
  useEscClose(onClose);
  return (
    <div style={overlay} onClick={onClose}>
      <div style={{ ...panel, maxWidth: 560 }} role="dialog" aria-modal="true" aria-label="원문 텍스트" onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "15px 18px", borderBottom: `1px solid ${T.line}`, position: "sticky", top: 0, background: "#fff", borderTopLeftRadius: 16, borderTopRightRadius: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: FZ(16), fontWeight: 900 }}>🔎 원문 텍스트 (PDF 에서 읽은 글)</div>
            <div style={{ fontSize: FZ(11.5), color: T.mute, marginTop: 2 }}>{pages && pages.length ? `${pages.length}쪽` : "텍스트 입력"} · 추출이 비면 이 내용을 복사해 전달해주세요</div>
          </div>
          <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: FZ(20), color: T.mute }}>✕</button>
        </div>
        <div style={{ padding: "12px 18px", display: "grid", gap: 12 }}>
          <button onClick={() => copy("all", full)} style={{ border: `1px solid ${T.brand}`, background: copied === "all" ? T.brand : "#fff", color: copied === "all" ? "#fff" : T.brand, borderRadius: 9, padding: "10px 12px", fontSize: FZ(13), fontWeight: 800, fontFamily: FF, cursor: "pointer" }}>{copied === "all" ? "복사됨 ✓" : "전체 원문 복사"}</button>
          {(pages && pages.length ? pages : [{ pageNo: 0, text: text || "" }]).map((p) => (
            <div key={p.pageNo}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <span style={{ fontSize: FZ(12), fontWeight: 800, color: T.sub }}>{p.pageNo ? `page ${p.pageNo}` : "전체"}</span>
                <button onClick={() => copy("p" + p.pageNo, p.text)} style={{ border: `1px solid ${T.line}`, background: copied === "p" + p.pageNo ? T.ink : "#fff", color: copied === "p" + p.pageNo ? "#fff" : T.sub, borderRadius: 7, padding: "3px 9px", fontSize: FZ(11), fontWeight: 700, fontFamily: FF, cursor: "pointer" }}>{copied === "p" + p.pageNo ? "복사됨" : "복사"}</button>
              </div>
              <pre style={{ margin: 0, fontSize: FZ(11), lineHeight: 1.5, color: T.ink, background: "#F8FAFC", border: `1px solid ${T.line}`, borderRadius: 8, padding: "8px 10px", maxHeight: 220, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all", fontFamily: "monospace" }}>{p.text || "(빈 페이지)"}</pre>
            </div>
          ))}
        </div>
        <div style={{ padding: "0 18px 18px" }}>
          <button onClick={onClose} style={{ width: "100%", border: `1px solid ${T.line}`, background: "#fff", borderRadius: 10, padding: "12px", fontSize: FZ(14), fontWeight: 700, fontFamily: FF, color: T.sub, cursor: "pointer" }}>닫기</button>
        </div>
      </div>
    </div>
  );
}

// 구조화 상세 팝업 — sections:[{ label, fmt }] (fmt=formatPopupSection 결과). kv/history/career/opinion/lines/text 렌더.
function SectionBody({ fmt, raw }) {
  const [showRaw, setShowRaw] = useState(false);
  const rawToggle = raw ? (
    <div style={{ marginTop: 8 }}>
      <button onClick={() => setShowRaw((v) => !v)} style={{ border: "none", background: "transparent", color: T.mute, fontSize: FZ(11.5), fontWeight: 700, fontFamily: FF, cursor: "pointer", padding: 0 }}>{showRaw ? "원문 접기 ▲" : "원문 보기 ▾"}</button>
      {showRaw ? <pre style={{ margin: "6px 0 0", fontSize: FZ(11), lineHeight: 1.5, color: T.sub, background: "#F8FAFC", border: `1px solid ${T.line}`, borderRadius: 8, padding: "8px 10px", maxHeight: 200, overflow: "auto", whiteSpace: "pre-wrap", wordBreak: "break-all", fontFamily: "monospace" }}>{raw}</pre> : null}
    </div>
  ) : null;
  let body;
  if (!fmt || fmt.empty) body = <div style={{ fontSize: FZ(13), color: T.mute, background: "#F8FAFC", border: `1px solid ${T.line}`, borderRadius: 8, padding: "9px 11px" }}>크레탑 정보 없음</div>;
  else if (fmt.noData) body = <div style={{ fontSize: FZ(13), color: T.sub, background: "#F8FAFC", border: `1px solid ${T.line}`, borderRadius: 8, padding: "9px 11px" }}>조회된 자료가 없습니다.</div>;
  else if (fmt.mode === "kv") body = (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))", gap: 8 }}>
      {fmt.rows.map((r, i) => (
        <div key={i} style={{ display: "flex", gap: 8, padding: "8px 11px", background: "#F8FAFC", border: `1px solid ${T.line}`, borderRadius: 8 }}>
          <span style={{ flex: "0 0 auto", minWidth: 76, fontSize: FZ(12), fontWeight: 700, color: T.sub, wordBreak: "keep-all" }}>{r.label}</span>
          <span style={{ flex: 1, fontSize: FZ(12.5), color: T.ink, lineHeight: 1.5, wordBreak: "break-word" }}>{r.value || "—"}</span>
        </div>
      ))}
    </div>
  );
  else if (fmt.mode === "history") body = (
    <div style={{ display: "grid", gap: 5 }}>
      {fmt.rows.map((r, i) => (
        <div key={i} style={{ display: "flex", gap: 10, fontSize: FZ(12.5), lineHeight: 1.5 }}>
          {r.date ? <span style={{ flex: "0 0 96px", color: T.brand, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{r.date}</span> : null}
          <span style={{ flex: 1, color: T.ink, wordBreak: "break-word" }}>{r.desc}</span>
        </div>
      ))}
    </div>
  );
  else if (fmt.mode === "career") body = (
    <div style={{ display: "grid", gap: 8 }}>
      {fmt.rows.map((r, i) => (
        <div key={i} style={{ display: "flex", gap: 12, fontSize: FZ(12.5), lineHeight: 1.5, alignItems: "baseline", borderTop: i ? `1px solid ${T.line}` : "none", paddingTop: i ? 8 : 0 }}>
          <span style={{ flex: "0 0 auto", minWidth: 124, color: T.brand, fontWeight: 800, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{r.period || "—"}</span>
          <span style={{ flex: 1, color: T.ink, wordBreak: "break-word" }}>{r.desc}</span>
        </div>
      ))}
    </div>
  );
  else if (fmt.mode === "opinion") {
    // 하나의 읽기 쉬운 문단형 영역 — 문장(마침표 기준)별 줄바꿈 + 문단 간격
    body = (
      <div style={{ display: "grid", gap: 10 }}>
        {fmt.blocks.map((b, i) => (
          <div key={i} style={{ border: `1px solid ${T.line}`, borderRadius: 10, padding: "11px 13px", background: "#F8FAFC" }}>
            {b.title && b.title !== "종합의견" ? <div style={{ fontSize: FZ(12), fontWeight: 800, color: T.brand, marginBottom: 6 }}>[{b.title}]</div> : null}
            <div style={{ display: "grid", gap: 8 }}>
              {String(b.body || "").split(/\n/).map((l) => l.trim()).filter(Boolean).map((p, j) => (
                <div key={j} style={{ fontSize: FZ(12.5), color: T.ink, lineHeight: 1.65, wordBreak: "break-word" }}>{p}</div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }
  else if (fmt.mode === "lines") body = (
    <div style={{ display: "grid", gap: 5 }}>
      {fmt.items.map((it, i) => (
        <div key={i} style={{ display: "flex", gap: 7, fontSize: FZ(12.5), color: T.ink, lineHeight: 1.55, wordBreak: "break-word" }}>
          <span style={{ flex: "0 0 auto", color: T.brand, fontWeight: 800 }}>1.</span>
          <span style={{ flex: 1 }}>{it}</span>
        </div>
      ))}
    </div>
  );
  else body = <div style={{ fontSize: FZ(12.5), color: T.sub, lineHeight: 1.65, whiteSpace: "pre-wrap", wordBreak: "break-word", background: "#F8FAFC", border: `1px solid ${T.line}`, borderRadius: 8, padding: "9px 11px" }}>{fmt.text}</div>;
  return <div>{body}{rawToggle}</div>;
}

// 이해관계자 목록 팝업(관계회사/거래처) — groups:[{ label, source, noData, note, rows:["이름 12.3%", …] }]
export function StakeModal({ title, subtitle, groups, onClose }) {
  const splitRow = (r) => { const m = String(r).match(/^(.*?)[\s]*(\d{1,3}(?:\.\d+)?\s*%)\s*$/); return m ? [m[1].trim(), m[2].replace(/\s+/g, "")] : [String(r).trim(), null]; };
  useEscClose(onClose);
  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "15px 18px", borderBottom: `1px solid ${T.line}`, position: "sticky", top: 0, background: "#fff", borderTopLeftRadius: 16, borderTopRightRadius: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: FZ(16), fontWeight: 900 }}>{title}</div>
            {subtitle ? <div style={{ fontSize: FZ(11.5), color: T.mute, marginTop: 2 }}>{subtitle}</div> : null}
          </div>
          <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: FZ(20), color: T.mute }}>✕</button>
        </div>
        <div style={{ padding: "14px 18px", display: "grid", gap: 16 }}>
          {groups.map((g, i) => (
            <div key={i}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: FZ(13), fontWeight: 800, color: T.ink }}>{g.label}</span>
                {g.source ? <span style={{ fontSize: FZ(10.5), color: T.mute, fontWeight: 600 }}>출처: {g.source}</span> : null}
              </div>
              {g.noData ? (
                <div style={{ fontSize: FZ(12.5), color: T.sub, background: "#F8FAFC", border: `1px solid ${T.line}`, borderRadius: 8, padding: "9px 11px" }}>{g.note || "해당사항없음"}</div>
              ) : (g.rows && g.rows.length) ? (
                <div style={{ border: `1px solid ${T.line}`, borderRadius: 9, overflow: "hidden" }}>
                  {g.rows.map((r, j) => { const [nm, pct] = splitRow(r); return (
                    <div key={j} style={{ display: "flex", gap: 10, alignItems: "center", padding: "9px 11px", borderTop: j ? `1px solid ${T.line}` : "none", background: j % 2 ? "#F8FAFC" : "#fff" }}>
                      <span style={{ flex: "0 0 auto", fontSize: FZ(11), color: T.mute, fontWeight: 700, minWidth: 16 }}>{j + 1}</span>
                      <span style={{ flex: 1, fontSize: FZ(12.5), color: T.ink, fontWeight: 600, wordBreak: "break-word" }}>{nm}</span>
                      {pct ? <span style={{ flex: "0 0 auto", fontSize: FZ(12.5), color: T.brand, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{pct}</span> : null}
                    </div>
                  ); })}
                </div>
              ) : (
                <div style={{ fontSize: FZ(12.5), color: T.mute, background: "#F8FAFC", border: `1px solid ${T.line}`, borderRadius: 8, padding: "9px 11px" }}>정보 없음</div>
              )}
            </div>
          ))}
        </div>
        <div style={{ padding: "0 18px 18px" }}>
          <div style={{ fontSize: FZ(11), color: T.mute, lineHeight: 1.55, marginBottom: 10 }}>※ 크레탑 원문에서 자동 추출한 참고 정보입니다. 정확한 내용은 원문을 확인하세요.</div>
          <button onClick={onClose} style={{ width: "100%", border: `1px solid ${T.line}`, background: "#fff", borderRadius: 10, padding: "12px", fontSize: FZ(14), fontWeight: 700, fontFamily: FF, color: T.sub, cursor: "pointer" }}>닫기</button>
        </div>
      </div>
    </div>
  );
}

export function DetailModal({ title, subtitle, sections, onClose }) {
  useEscClose(onClose);
  return (
    <div style={overlay} onClick={onClose}>
      <div style={panel} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div style={{ padding: "15px 18px", borderBottom: `1px solid ${T.line}`, position: "sticky", top: 0, background: "#fff", borderTopLeftRadius: 16, borderTopRightRadius: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: FZ(16), fontWeight: 900 }}>{title}</div>
            {subtitle ? <div style={{ fontSize: FZ(11.5), color: T.mute, marginTop: 2 }}>{subtitle}</div> : null}
          </div>
          <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: FZ(20), color: T.mute }}>✕</button>
        </div>
        <div style={{ padding: "14px 18px", display: "grid", gap: 16 }}>
          {sections.map((s, i) => (
            <div key={i}>
              <div style={{ fontSize: FZ(12.5), fontWeight: 800, color: T.ink, marginBottom: 6 }}>{s.label}</div>
              <SectionBody fmt={s.fmt} raw={s.raw} />
            </div>
          ))}
        </div>
        <div style={{ padding: "0 18px 18px" }}>
          <div style={{ fontSize: FZ(11), color: T.mute, lineHeight: 1.55, marginBottom: 10 }}>※ 크레탑 원문에서 자동 추출·정리한 참고 정보입니다. 정확한 내용은 원문을 확인하세요.</div>
          <button onClick={onClose} style={{ width: "100%", border: `1px solid ${T.line}`, background: "#fff", borderRadius: 10, padding: "12px", fontSize: FZ(14), fontWeight: 700, fontFamily: FF, color: T.sub, cursor: "pointer" }}>닫기</button>
        </div>
      </div>
    </div>
  );
}
