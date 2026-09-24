/* [D-93] 원본 영업 OS(corp-consult-sales-os main · src/App.jsx)를 그대로 옮긴 것.
   이 OS 에서 바꾼 것 — 나머지 글자·배치·색·계산은 원본 그대로:
   · 저장: load()/save() 가 localStorage 대신 모듈 기록(./store.ts)
   · 업체: 신규 고객·고객사의 한 줄 = 고객 운영 업체(업체명은 고객 운영에서 고른다)
   · 뺀 것: PIN 앱 잠금 · 샘플 데이터 넣기 · 다른 SaaS 바로가기 · 브라우저 전체 스캔 정리(scrub)
   · 원본의 왼쪽 메뉴는 이 OS 의 모듈 목차가 대신한다(화면 = /tools/sales-kit/<화면>) */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { brandHex, brandSync, useThemeRerender } from "../../shared/brandHex"; // [D-96] · [D-98] 테마 바로 따라가기
import { salesLoad, salesSave, salesOsClients, salesOsClientOf, salesResetAll } from "./store";
import { createPortal } from "react-dom";
// PDF: 정적 import(동적 import 청크 fetch 실패 방지) — pdf.js 본체는 메인 번들에, 워커는 ?url 정적 에셋으로.
import * as pdfjsLib from "pdfjs-dist-v4/build/pdf.min.mjs"; // [D-94] 원본과 같은 pdf.js 4 계열
import pdfWorkerUrl from "pdfjs-dist-v4/build/pdf.worker.min.mjs?url";
const FIN_MODULE_VERSION = "pdf-static-import-v2-current-file-only";
// 정식 출시 전 릴리즈 정보(오류 제보·버전 표시용). 출시 단계가 바뀌면 여기만 수정.
const APP_RELEASE = { name: "법인컨설팅 세일즈 OS", version: "Release Candidate v0.9", build: "2026-06-16", storage: "localStorage(브라우저 임시 저장)", finModule: "table-paste-first / PDF·숫자추출기 BETA" };
// 문제 제보용 최근 오류 메시지 캡처(원문/민감정보는 저장하지 않음 — 메시지만)
let _LAST_ERROR = "";
if (typeof window !== "undefined") { try { window.addEventListener("error", (e) => { try { _LAST_ERROR = `${(e && e.message) || e} @ ${((e && e.filename) || "").split("/").pop() || "?"}:${(e && e.lineno) || ""}`.slice(0, 300); } catch (_) {} }); window.addEventListener("unhandledrejection", (e) => { try { _LAST_ERROR = ("promise: " + String((e && e.reason && e.reason.message) || (e && e.reason) || "")).slice(0, 300); } catch (_) {} }); } catch (_) {} }
try { if (pdfjsLib && pdfjsLib.GlobalWorkerOptions) pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl; } catch (e) {}

/* ═══════════════════════════════════════════════════════
   기업컨설팅 세일즈 OS v1
   - 신규 고객 발굴 / 콘텐츠 / 미팅전략 / 교육아카이브 / 법령업데이트 / 고객사 관리
   - Supabase 이전 전 localStorage MVP
   ═══════════════════════════════════════════════════════ */

const SK = "corp-consult-sales-os-v1";
const FF = "'Pretendard Variable','Pretendard',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";

// ── 외부 SaaS / 현재 앱 URL (운영 주소가 바뀌면 여기만 수정) ──────────────
const EMPLOYMENT_SAAS_URL = "https://hr-subsidy-pro.vercel.app";   // 고용지원금 SaaS
const RND_OS_URL = "https://labcare-rnd-os.vercel.app";            // 연구소 사후관리 OS
const CURRENT_APP_URL = "https://corp-sales-os.vercel.app";        // 현재 앱(법인컨설팅 세일즈 OS)
const EXTERNAL_APPS = [
  { icon: "💼", label: "고용지원금 SaaS", url: EMPLOYMENT_SAAS_URL },
  { icon: "🧪", label: "연구소 사후관리 OS", url: RND_OS_URL },
];

// 화면 글자 크기 배율 — 40~60대 사용자를 위해 기본값을 '크게'로 둔다.
// [이름, 배율(--s), 설명]
const FONT_SCALES = [
  ["기본", 0.95, "일반 SaaS보다 살짝 큰 밀도 높은 화면"],
  ["크게", 1.12, "보기 편한 표준 크기 — 권장(기본값)"],
  ["아주 크게", 1.32, "조금 더 큰 글자 — 화면 공유·상담 현장용"],
];
const DEFAULT_FONT_SCALE = "크게";
function scaleOf(name) {
  const f = FONT_SCALES.find((x) => x[0] === name);
  return f ? f[1] : 1.3;
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function load() {
  return salesLoad();
}
function save(data) {
  salesSave(data);
}
// ── 로컬 화면 잠금(PIN) ── 서버 인증이 아닌, 같은 브라우저 공용 사용 대비용 ──
const LK = "corp-sales-os-lock-v1";        // PIN 해시 저장(데이터 백업에는 포함되지 않음)
const LA = "corp-sales-os-lastactive-v1";  // 마지막 활동 시각(자동 잠금 판단용)
const AUTO_LOCK_MS = 30 * 60 * 1000;       // 30분 무조작 시 자동 잠금
function loadLock() { return { prompted: true }; } // [D-93] PIN 잠금 없음 — OS 로그인이 대신한다
function saveLock(rec) { void rec; }
function clearLock() {}
function markActive() {}
function randSalt() {
  try { if (typeof crypto !== "undefined" && crypto.getRandomValues) { const a = new Uint8Array(16); crypto.getRandomValues(a); return Array.from(a).map((b) => b.toString(16).padStart(2, "0")).join(""); } } catch (e) {}
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
async function sha256Hex(str) {
  const data = new TextEncoder().encode(str);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
// PIN은 평문 저장하지 않고 (가능하면) SHA-256 + salt 다중 라운드 해시로 저장. 미지원 환경은 비암호 해시로 대체.
async function hashPin(pin, salt) {
  const base = `${salt}:${pin}:corp-sales-os-lock`;
  try {
    if (typeof crypto !== "undefined" && crypto.subtle) {
      let h = base;
      for (let i = 0; i < 4; i++) h = await sha256Hex(h + ":" + i);
      return "s256$" + h;
    }
  } catch (e) {}
  let h = 5381; for (let r = 0; r < 3000; r++) { for (let i = 0; i < base.length; i++) h = ((h << 5) + h + base.charCodeAt(i) + r) >>> 0; }
  return "djb2$" + (h >>> 0).toString(16);
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
function dday(ds) {
  if (!ds) return null;
  const a = new Date();
  const b = new Date(ds);
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  return Math.ceil((b - a) / 86400000);
}
function ddayText(d) {
  if (d === null) return "";
  if (d === 0) return "D-Day";
  if (d < 0) return "D+" + Math.abs(d);
  return "D-" + d;
}
function copyText(txt, cb) {
  try {
    navigator.clipboard.writeText(txt);
    cb && cb(true);
  } catch (e) {
    const ta = document.createElement("textarea");
    ta.value = txt;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    cb && cb(true);
  }
}
function safe(v, fallback = "") {
  return v === undefined || v === null || v === "" ? fallback : v;
}
function getCompanyName(c) {
  if (!c) return "";
  if (c.corpType === "주식회사") return c.juPosition === "뒤" ? `${c.name}(주)` : `(주)${c.name}`;
  return c.name || "";
}

/* 토스 계열 라이트 톤 — 옅은 회색 배경 + 흰 카드 + 읽히는 강조색 + 파스텔 칩 배경 */
const C = {
  bg: "#F8FAFC", // [D-97] OS 바탕(slate-50)과 같게 (원본 #F4F6F8)
  card: "#FFFFFF",
  card2: "#F8FAFC",
  hover: "#F1F5F9",
  input: "#FFFFFF",
  gold: "#B45309",
  goldL: "#D97706",
  goldD: "#92400E",
  // [D-96] 강조색은 OS 테마를 따른다(원본 #2563EB · #0284C7 · #E8F1FE) — 모든 모듈이 같은 색으로 보이게
  blue: brandHex("600", "#2563EB"),
  sky: brandHex("500", "#0284C7"),
  text: "#0F172A",
  textS: "#334155",
  textM: "#64748B",
  bdr: "#E2E8F0", // [D-97] OS 테두리(slate-200)와 같게 (원본 #E6EAF0)
  bdrL: "#D4DBE5",
  ok: "#059669",
  warn: "#D97706",
  err: "#DC2626",
  purple: "#7C3AED",
  pink: "#DB2777",
  greenBg: "#E7F6EF",
  redBg: "#FDECEC",
  warnBg: "#FDF1E1",
  blueBg: brandHex("50", "#E8F1FE"),
  purpleBg: "#F2ECFE",
};

const inp = {
  width: "100%",
  padding: "calc(var(--s,1.3)*11px) 16px",
  borderRadius: "var(--radius-control)", // [D-97] OS 단추·입력칸(10px)
  border: "1px solid " + C.bdrL,
  fontSize: "calc(var(--s,1.3)*16px)",
  outline: "none",
  boxSizing: "border-box",
  fontFamily: FF,
  background: C.input,
  color: C.text,
  fontWeight: 500,
};
const btnP = {
  background: C.blue,
  color: "#FFFFFF",
  border: "none",
  borderRadius: "var(--radius-control)", // [D-97] OS 단추·입력칸(10px)
  padding: "calc(var(--s,1.3)*12px) calc(var(--s,1.3)*20px)",
  fontSize: "calc(var(--s,1.3)*16px)",
  fontWeight: 800,
  cursor: "pointer",
  fontFamily: FF,
  boxShadow: "none", // [D-97] 원본의 파란 그림자 — OS 단추에는 그림자가 없다
};
const btnS = {
  background: "#FFFFFF",
  color: C.textS,
  border: "1px solid " + C.bdrL,
  borderRadius: "var(--radius-control)", // [D-97] OS 단추·입력칸(10px)
  padding: "calc(var(--s,1.3)*12px) calc(var(--s,1.3)*18px)",
  fontSize: "calc(var(--s,1.3)*16px)",
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: FF,
};
const btnSm = {
  background: "#FFFFFF",
  color: C.textS,
  border: "1px solid " + C.bdrL,
  borderRadius: "var(--radius-control)", // [D-97]
  padding: "calc(var(--s,1.3)*11px) calc(var(--s,1.3)*15px)",
  fontSize: "calc(var(--s,1.3)*14px)",
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: FF,
};
// 화면 어디서나 띄우는 가벼운 토스트(복사·샘플 추가 안내 등)
function showToast(msg) {
  if (typeof document === "undefined") return;
  const t = document.createElement("div");
  t.textContent = msg;
  t.style.cssText = `position:fixed;left:50%;bottom:40px;transform:translateX(-50%);z-index:3000;background:${C.card};color:${C.text};border:1px solid ${C.gold};padding:15px 26px;border-radius:13px;font-weight:800;font-size:17px;box-shadow:0 10px 34px rgba(0,0,0,.55);font-family:${FF}`;
  document.body.appendChild(t);
  setTimeout(() => { t.style.transition = "opacity .35s"; t.style.opacity = "0"; }, 1400);
  setTimeout(() => t.remove(), 1800);
}

const DEAL_STAGES = [
  { key: "lead", label: "발굴대상", icon: "🔎", color: C.textM, bg: "#EEF2F7" },
  { key: "contacted", label: "첫 연락", icon: "📞", color: C.sky, bg: C.blueBg },
  { key: "meeting_proposed", label: "미팅제안", icon: "💬", color: C.blue, bg: C.blueBg },
  { key: "meeting1_scheduled", label: "1차예정", icon: "📅", color: C.warn, bg: C.warnBg },
  { key: "meeting1_done", label: "1차완료", icon: "✅", color: C.warn, bg: C.warnBg },
  { key: "docs_requested", label: "자료요청", icon: "📂", color: C.purple, bg: C.purpleBg },
  { key: "docs_received", label: "자료수령", icon: "📥", color: C.sky, bg: C.blueBg },
  { key: "meeting2_scheduled", label: "2차예정", icon: "📊", color: C.blue, bg: C.blueBg },
  { key: "meeting2_done", label: "2차완료", icon: "📋", color: C.blue, bg: C.blueBg },
  { key: "proposal_sent", label: "제안발송", icon: "📨", color: C.purple, bg: C.purpleBg },
  { key: "closing_scheduled", label: "클로징", icon: "🎯", color: C.gold, bg: "#FCEFDA" },
  { key: "decision_pending", label: "검토중", icon: "⏳", color: C.warn, bg: C.warnBg },
  { key: "contracted", label: "계약완료", icon: "🏆", color: C.ok, bg: C.greenBg },
  { key: "hold", label: "보류", icon: "⏸️", color: C.textM, bg: "#EEF2F7" },
  { key: "lost", label: "이탈", icon: "🚪", color: C.err, bg: C.redBg },
];
// 영업 진행 현황 10단계(보드 컬럼). match: 기존 stage 키를 컬럼에 매핑.
const PIPELINE = [
  { key: "lead", label: "잠재고객", match: ["lead"] },
  { key: "contacted", label: "1차 연락", match: ["contacted", "meeting_proposed"] },
  { key: "meeting1_scheduled", label: "1차 미팅 예정", match: ["meeting1_scheduled", "meeting1_done"] },
  { key: "docs_requested", label: "자료 요청", match: ["docs_requested"] },
  { key: "docs_received", label: "자료 수령", match: ["docs_received"] },
  { key: "proposal_sent", label: "제안서/리포트 발송", match: ["proposal_sent"] },
  { key: "meeting2_scheduled", label: "2차 미팅", match: ["meeting2_scheduled", "meeting2_done"] },
  { key: "decision_pending", label: "계약 검토", match: ["decision_pending", "closing_scheduled"] },
  { key: "contracted", label: "계약 완료", match: ["contracted"] },
  { key: "hold", label: "보류/장기관리", match: ["hold", "lost"] },
];
function pipeColOf(stage) { const c = PIPELINE.find((p) => p.match.includes(stage)); return c ? c.key : "lead"; }
// 영업 진행 현황 핵심 6단계(보드 컬럼 단순화). set=컬럼 선택 시 저장할 대표 stage. 보류/장기관리는 별도.
const PIPE6 = [
  { key: "lead", label: "잠재 고객", desc: "발굴·첫 연락 단계", set: "lead", match: ["lead", "contacted", "meeting_proposed"] },
  { key: "m1sched", label: "1차 미팅 예정", desc: "일정 조율·확정", set: "meeting1_scheduled", match: ["meeting1_scheduled"] },
  { key: "m1done", label: "1차 미팅 완료", desc: "자료 요청·수령·제안 준비", set: "meeting1_done", match: ["meeting1_done", "docs_requested", "docs_received"] },
  { key: "m2", label: "2차 미팅", desc: "제안서·견적 전달, 2차 진행", set: "meeting2_scheduled", match: ["proposal_sent", "meeting2_scheduled", "meeting2_done"] },
  { key: "closing", label: "3차 클로징", desc: "조건 조율·의사결정·청약 준비", set: "closing_scheduled", match: ["closing_scheduled", "decision_pending"] },
  { key: "contracted", label: "계약 완료", desc: "계약 완료·관리 시작", set: "contracted", match: ["contracted"] },
];
const PIPE6_HOLD = { key: "hold", label: "보류·장기관리", set: "hold", match: ["hold", "lost"] };
const PIPE6_ALL = [...PIPE6, PIPE6_HOLD];
function pipe6Of(stage) { if (PIPE6_HOLD.match.includes(stage)) return "hold"; const c = PIPE6.find((p) => p.match.includes(stage)); return c ? c.key : "lead"; }

const INTERESTS = ["절세", "가업승계", "가지급금", "미처분이익잉여금", "정관정비", "임원퇴직금", "법인세", "종소세", "연구소", "벤처인증", "정책자금", "고용지원금", "법인보험", "사내근로복지기금", "법인전환", "주식이동"];
const INDUSTRIES = ["제조업", "도소매업", "건설업", "서비스업", "IT/소프트웨어", "음식/숙박", "병의원", "전문직", "운송업", "기타"];
const SOURCES = ["전화", "소개", "광고", "블로그", "유튜브", "인스타", "기존인맥", "교육/세미나", "기타"];
const EDUCATION_FIELDS = ["가업승계", "가지급금", "미처분이익잉여금", "정관정비", "법인세", "종소세", "세액공제", "법인보험", "정책자금", "고용지원금", "인증", "판례/예규", "기타"];
const UPDATE_SOURCES = ["국세청", "법제처", "조세심판원", "대법원", "기업마당", "고용노동부", "중기부", "중진공", "기타"];

const STRATEGY_LIBRARY = [
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

const CONTENT_SEEDS = [
  { cat: "정관정비", title: "대표님 퇴직금, 정관 없으면 나중에 문제가 될 수 있습니다", target: "업력 3년 이상 법인, 임원보수·퇴직금 규정 미점검 회사", hook: "법인 대표님이 가장 많이 놓치는 게 세금보다 먼저 정관입니다.", cta: "정관을 최근에 본 기억이 없다면 먼저 점검해보세요." },
  { cat: "가지급금", title: "법인 통장에서 빠져나간 돈, 가지급금으로 쌓이면 위험합니다", target: "대표자 대여금·가지급금이 있는 법인", hook: "회사 돈을 잠깐 쓴 것뿐이라고 생각했는데, 재무제표에는 리스크로 남을 수 있습니다.", cta: "가지급금 규모를 모른다면 재무제표부터 확인해보세요." },
  { cat: "가업승계", title: "가업승계는 은퇴 직전에 준비하면 늦습니다", target: "대표 50세 이상, 업력 10년 이상 가족법인", hook: "승계는 세금을 줄이는 문제가 아니라 경영권을 지키는 문제입니다.", cta: "자녀 승계를 조금이라도 생각 중이라면 요건부터 점검하세요." },
  { cat: "미처분이익잉여금", title: "회사에 이익이 쌓일수록 주식가치도 올라갑니다", target: "이익잉여금이 큰 흑자 법인", hook: "돈을 잘 벌수록 나중에 증여·상속 부담이 커질 수 있습니다.", cta: "이익잉여금과 주식가치 관계를 한 번 확인해보세요." },
  { cat: "연구소", title: "연구소 설립, 단순 인증이 아니라 세금과 자금에도 연결됩니다", target: "제조·IT·제품개발 법인", hook: "개발 인력이 있는데 연구소가 없다면 놓치는 제도가 있을 수 있습니다.", cta: "우리 회사가 연구소 요건이 되는지 먼저 점검해보세요." },
  { cat: "법인세", title: "법인세 줄이려다 세무조사 리스크가 커지는 경우", target: "법인세 부담이 큰 흑자 법인", hook: "절세는 많이 줄이는 것보다 문제 없이 줄이는 게 먼저입니다.", cta: "세무사 검토가 필요한 항목부터 구분해보세요." },
  { cat: "고용지원금", title: "직원 채용 후 알아보면 늦는 지원금이 있습니다", target: "채용 예정 기업", hook: "지원금은 금액보다 순서가 더 중요할 때가 많습니다.", cta: "직원 채용 전 신청 순서부터 확인해보세요." },
  { cat: "정책자금", title: "매출은 늘었는데 통장에 돈이 없다면 먼저 봐야 할 것", target: "운전자금이 필요한 성장기업", hook: "정책자금은 급할 때 찾으면 이미 늦는 경우가 많습니다.", cta: "재무제표 기준으로 가능성을 먼저 점검해보세요." },
];

function Label({ children, color }) {
  return <label style={{ display: "block", marginBottom: 6, fontSize: "calc(var(--s,1.3)*14px)", fontWeight: 800, color: color || C.textM, letterSpacing: .2 }}>{children}</label>;
}
function Card({ children, style, onClick }) {
  return <div className="ui-card ui-hover" onClick={onClick} style={{ background: C.card, border: "1px solid " + C.bdr, borderRadius: "var(--radius-panel)", ...style }}>{/* [D-97] 카드 모서리 = OS 판(14px) */}{children}</div>;
}
function Badge({ children, color, bg, style }) {
  return <span style={{ display: "inline-block", padding: "5px 12px", borderRadius: 999, fontSize: "calc(var(--s,1.3)*13px)", fontWeight: 800, color: color || C.gold, background: bg || "#EEF2F7", whiteSpace: "nowrap", ...style }}>{children}</span>;
}
function PillButton({ active, children, onClick, color }) {
  return <button onClick={onClick} style={{ ...btnSm, background: active ? (color || C.gold) + "25" : C.input, color: active ? color || C.gold : C.textM, border: active ? `1px solid ${color || C.gold}` : "1px solid " + C.bdr }}>{children}</button>;
}
// 초보자 안내 모드: beginnerMode가 false가 아니면 ON(처음 사용자 배려). '오늘 하루 숨기기'는 별도 처리.
// [D-94] 이 OS 에서는 기본 꺼짐 — 목차에서 화면을 고르면 안내·‘시작하기’ 없이 바로 본문. 설정에서 ‘안내 켜기’ 를 누른 사람만 켜진다
function beginnerOn(data) { return !!data && data.beginnerMode === true; }
// 실제로 안내(설명 박스·접힘 구조)를 보여줄지 — 켜짐이면서 오늘 숨김이 아닐 때
function guideActive(data) { return beginnerOn(data) && !(data && data.beginnerGuideHiddenDate === todayISO()); }
// 화면별 안내 숨김 상태: "off"=계속 숨김, "YYYY-MM-DD"=그 날짜만 숨김
function screenGuideState(data, key) { const g = data && data.screenGuide; return (g && g[key]) || ""; }
function screenGuideVisible(data, key) { if (!key) return guideActive(data); const st = screenGuideState(data, key); if (st === "off") return false; if (st === todayISO()) return false; return guideActive(data); }
function setScreenGuide(setData, key, val) { setData((d) => ({ ...d, screenGuide: { ...(d.screenGuide || {}), [key]: val } })); }
// 화면별 펼침 상태 저장(expandedSectionsByScreen[screenKey][sectionKey]) — 다른 메뉴 갔다 와도 유지
function getExpand(data, screenKey, sectionKey, def) { const m = data && data.expandedSectionsByScreen && data.expandedSectionsByScreen[screenKey]; if (m && Object.prototype.hasOwnProperty.call(m, sectionKey)) return !!m[sectionKey]; return !!def; }
function setExpand(setData, screenKey, sectionKey, val) { setData((d) => { const all = { ...(d.expandedSectionsByScreen || {}) }; const sc = { ...(all[screenKey] || {}) }; sc[sectionKey] = val; all[screenKey] = sc; return { ...d, expandedSectionsByScreen: all }; }); }
// 화면 상단 "이 화면에서 하는 일" 안내 박스 — 화면별 안내가 보일 때만 표시. 숨김 버튼 포함.
function ScreenIntro({ data, setData, screenKey, icon, title, desc, actions, tone, steps, footer }) {
  if (screenKey ? !screenGuideVisible(data, screenKey) : !guideActive(data)) return null;
  const bg = tone === "warn" ? C.warnBg : C.blueBg;
  const bd = tone === "warn" ? C.warn : C.blue;
  const canHide = screenKey && setData;
  return <Card style={{ padding: "18px 20px", marginBottom: 14, background: bg, border: `1px solid ${bd}55` }}>
    <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
      <div style={{ fontSize: "calc(var(--s,1.3)*28px)", lineHeight: 1.1 }}>{icon || "💡"}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 900, fontSize: "calc(var(--s,1.3)*19px)", color: C.text, marginBottom: 6 }}>이 화면에서 하는 일 · {title}</div>
        <div style={{ color: C.textS, fontSize: "calc(var(--s,1.3)*16px)", lineHeight: 1.85 }}>{desc}</div>
        {steps && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 12 }}>{steps.map((s, i) => <React.Fragment key={i}>{i > 0 && <span style={{ color: bd, fontWeight: 900 }}>→</span>}<span style={{ background: C.card, color: bd, border: `1px solid ${bd}55`, borderRadius: 999, padding: "4px 12px", fontSize: "calc(var(--s,1.3)*13px)", fontWeight: 800 }}>{s}</span></React.Fragment>)}</div>}
        {actions && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>{actions}</div>}
        {footer}
        {canHide && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          <button style={{ ...btnSm }} onClick={() => { setScreenGuide(setData, screenKey, todayISO()); showToast("오늘 하루 이 화면 안내를 숨겼습니다. 내일 다시 표시됩니다."); }}>오늘 하루 더 이상 보지 않기</button>
          <button style={{ ...btnSm }} onClick={() => { setScreenGuide(setData, screenKey, "off"); showToast("이 화면 안내를 껐습니다. 설정에서 다시 켤 수 있습니다."); }}>앞으로 계속 보지 않기</button>
        </div>}
      </div>
    </div>
  </Card>;
}
// 화면 단위 시작 게이트: 메뉴 진입 직후엔 '이 화면에서 하는 일' 안내 + [시작하기] 버튼만 보이고,
// 시작하기를 눌러야 본문이 펼쳐진다. key={tab}로 매 진입 리마운트되어 항상 게이트부터 시작.
// autoOpen(딥링크: 고객 선택·미팅 이동 등)일 때는 바로 본문을 연다.
function TabFrame({ data, setData, cfg, screenKey, children, autoOpen }) {
  const [open, setOpen] = useState(!!autoOpen);
  useEffect(() => { if (autoOpen) setOpen(true); }, [autoOpen]);
  if (!cfg) return <>{children}</>;
  if (open) {
    return <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        <button style={{ ...btnSm, fontWeight: 800, color: C.textM }} onClick={() => setOpen(false)}>↑ 처음 안내 화면으로</button>
      </div>
      {children}
    </>;
  }
  const startLabel = cfg.start || ((cfg.title || "") + " 시작하기");
  const introVis = screenKey ? screenGuideVisible(data, screenKey) : guideActive(data);
  const startBtn = <button style={btnP} onClick={() => setOpen(true)}>▶ {startLabel}</button>;
  const extraBtn = (cfg.primary && cfg.primary.act && cfg.primary.act !== "expand") ? <button style={btnS} onClick={cfg.primary.act}>{cfg.primary.label}</button> : null;
  if (introVis) {
    return <ScreenIntro data={data} setData={setData} screenKey={screenKey} icon={cfg.icon} title={cfg.title} desc={cfg.desc} tone={cfg.tone} steps={cfg.steps} actions={<>{startBtn}{extraBtn}</>} footer={setData && cfg.sample !== false ? <SampleMini data={data} setData={setData} /> : null} />;
  }
  // [D-94] 안내를 끈 상태면 게이트 없이 바로 본문 — 원본은 여기서도 ‘시작하기’ 작은 카드를 한 번 더 세웠다
  return <>{children}</>;
}
// 초보자 안내 ON: 화면 본문을 기본 접고 대표 버튼 + "펼쳐보기"만 노출. 안내 OFF면 본문을 그대로 표시.
function GuideExpand({ data, expandLabel, primary, children }) {
  const [open, setOpen] = useState(false);
  if (!guideActive(data)) return <>{children}</>;
  const primaryNode = typeof primary === "function" ? primary(() => setOpen(true)) : primary;
  return <>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: open ? 14 : 2 }}>
      {primaryNode}
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} style={{ ...btnS, fontWeight: 800 }}>{open ? "간단히 보기 ▲" : (expandLabel || "상세 기능 펼쳐보기") + " ▾"}</button>
    </div>
    {open && <div>{children}</div>}
  </>;
}
// 재사용 목차형 접기/펼치기 — 펼침 상태를 화면별로 localStorage에 저장(50대 컨설턴트 기준 정보 목차화)
function AccordionSection({ data, setData, screenKey, sectionKey, title, subtitle, badge, count, important, defaultOpen, children }) {
  const open = getExpand(data, screenKey, sectionKey, defaultOpen);
  const toggle = () => setExpand(setData, screenKey, sectionKey, !open);
  return <Card style={{ padding: 0, marginBottom: 12, overflow: "hidden", border: important ? `1.5px solid ${C.blue}55` : `1px solid ${C.bdr}` }}>
    <button onClick={toggle} aria-expanded={open} style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: open ? (important ? C.blueBg : C.bg) : "transparent", border: "none", cursor: "pointer", fontFamily: FF, padding: "14px 18px", minHeight: 44 }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}><span style={{ fontWeight: 800, fontSize: "calc(var(--s,1.3)*17px)", color: important ? C.blue : C.text }}>{title}</span>{count != null && <Badge color={C.blue} bg={C.blueBg}>{count}</Badge>}{badge}</div>
        {subtitle && <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*13px)", marginTop: 3, lineHeight: 1.5 }}>{subtitle}</div>}
      </div>
      <span style={{ color: open ? C.blue : C.textM, fontWeight: 900, fontSize: "calc(var(--s,1.3)*15px)", flex: "none", whiteSpace: "nowrap" }}>{open ? "▲ 접기" : "▼ 펼치기"}</span>
    </button>
    {open && <div style={{ padding: "2px 18px 18px" }}>{children}</div>}
  </Card>;
}
// 어려운 용어 옆 작은 ? 도움말 — hover(title)·클릭(토스트) 모두 지원, 모바일도 동작
function Help({ text }) {
  return <span title={text} onClick={(e) => { e.stopPropagation(); showToast(text); }} role="button" tabIndex={0} aria-label={text}
    style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "calc(var(--s,1.3)*17px)", height: "calc(var(--s,1.3)*17px)", borderRadius: 999, background: C.bdr, color: C.textM, fontSize: "calc(var(--s,1.3)*11px)", fontWeight: 900, cursor: "help", marginLeft: 4, verticalAlign: "middle", flex: "none" }}>?</span>;
}
// 보조 버튼 묶음을 "더보기"로 접어 한 번에 보이는 버튼 수를 줄인다
function MoreActions({ children, label, openLabel }) {
  const [open, setOpen] = useState(false);
  return <>
    <button style={{ ...btnSm }} onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }} aria-expanded={open}>{open ? (openLabel || "접기 ▲") : (label || "더보기 ▾")}</button>
    {open && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", width: "100%", marginTop: 2 }} onClick={(e) => e.stopPropagation()}>{children}</div>}
  </>;
}
// 모달 뒤로가기 처리 — 브라우저 뒤로가기/ESC로 최상위 모달만 닫기(LIFO), 히스토리 중복 방지
const _modalStack = []; let _modalIgnorePop = 0; let _modalPopInit = false;
function _modalInitPop() {
  if (_modalPopInit || typeof window === "undefined") return; _modalPopInit = true;
  window.addEventListener("popstate", () => {
    if (_modalIgnorePop > 0) { _modalIgnorePop--; return; }
    const top = _modalStack[_modalStack.length - 1];
    if (top) top.onBack();
  });
}
function Modal({ open, title, children, onClose, width = 720 }) {
  const ref = useRef(null);
  // 열릴 때: 모달 내부 스크롤 맨 위로, 배경(본문) 스크롤 잠금 — 어디서 열든 화면 상단에 바로 보이게
  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    if (ref.current) ref.current.scrollTop = 0;
    const mc = document.querySelector ? document.querySelector(".mainCol") : null;
    const prevB = document.body ? document.body.style.overflow : "";
    const prevM = mc ? mc.style.overflow : "";
    if (document.body) document.body.style.overflow = "hidden";
    if (mc) mc.style.overflow = "hidden";
    return () => { if (document.body) document.body.style.overflow = prevB; if (mc) mc.style.overflow = prevM; };
  }, [open]);
  // 모달 뒤로가기/ESC — 최상위 모달만 닫기
  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    _modalInitPop();
    let closedByBack = false;
    const entry = { onBack: () => { closedByBack = true; onClose && onClose(); } };
    _modalStack.push(entry);
    try { window.history.pushState({ __modal: true }, ""); } catch (e) {}
    const onKey = (e) => { if (e.key === "Escape" && _modalStack[_modalStack.length - 1] === entry) onClose && onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      const i = _modalStack.indexOf(entry); if (i >= 0) _modalStack.splice(i, 1);
      // [D-93] 닫는 사이에 화면(주소)이 바뀌었으면 되돌리지 않는다 — 이 OS 는 화면을 주소로 옮긴다
      const stillOnModal = (() => { try { return !!(window.history.state && window.history.state.__modal); } catch (e) { return false; } })();
      if (!closedByBack && stillOnModal) { _modalIgnorePop++; try { window.history.back(); } catch (e) { _modalIgnorePop--; } }
    };
  }, [open]);
  if (!open) return null;
  const content = (
    <div className="ui-modal-bg" style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,.4)", backdropFilter: "blur(3px)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "clamp(12px,3vw,18px)", paddingTop: "clamp(16px,6vh,64px)", overflowY: "auto" }} onClick={onClose}>
      <div ref={ref} className="ui-modal" style={{ width: "100%", maxWidth: width, maxHeight: "calc(100vh - 80px)", overflow: "auto", background: C.card, border: "1px solid " + C.bdr, borderRadius: 18, boxShadow: "0 24px 60px rgba(15,23,42,.22)" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ position: "sticky", top: 0, zIndex: 2, background: C.card, borderBottom: "1px solid " + C.bdr, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <button onClick={onClose} aria-label="뒤로" title="뒤로" style={{ background: C.bg, border: "1px solid " + C.bdr, borderRadius: 10, width: 44, height: 44, color: C.textS, fontSize: 22, cursor: "pointer", lineHeight: 1, flexShrink: 0 }}>←</button>
            <h3 style={{ margin: 0, fontSize: "calc(var(--s,1.3)*22px)", color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</h3>
          </div>
          <button onClick={onClose} aria-label="닫기" title="닫기" style={{ background: C.bg, border: "1px solid " + C.bdr, borderRadius: 10, width: 44, height: 44, color: C.textS, fontSize: 26, cursor: "pointer", lineHeight: 1, flexShrink: 0 }}>×</button>
        </div>
        <div style={{ padding: 24, maxWidth: "100%", overflowX: "hidden", boxSizing: "border-box" }}>{children}</div>
      </div>
    </div>
  );
  // body로 포털 → 조상 transform의 영향을 받지 않고 항상 뷰포트 기준으로 표시(아래쪽에서 열리는 문제 해결)
  if (typeof window !== "undefined" && typeof document !== "undefined" && document.body && document.body.nodeType === 1) return createPortal(content, document.body);
  return content;
}
function TextBlock({ title, text, copy }) {
  const [ok, setOk] = useState(false);
  return (
    <Card style={{ padding: 18, background: C.card2 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: "calc(var(--s,1.3)*16px)", color: C.gold, fontWeight: 800 }}>{title}</div>
        {copy && <button style={{ ...btnSm }} onClick={() => copyText(text, () => { setOk(true); showToast("복사되었습니다."); setTimeout(() => setOk(false), 1200); })}>{ok ? "✓ 복사됨" : "📋 복사"}</button>}
      </div>
      <div style={{ whiteSpace: "pre-line", color: C.textS, fontSize: "calc(var(--s,1.3)*16px)", lineHeight: 1.8 }}>{text}</div>
    </Card>
  );
}
// 샘플 넣기 단일 버튼 — 기본 3개. 교체 방식. setData는 함수형으로 최신 상태에 적용.
function SampleCTA({ data, setData, style, label, n }) {
  return null; // [D-93] 샘플 고객은 넣지 않는다 — 업체는 고객 운영에서
  // eslint-disable-next-line no-unreachable
  const cnt = n || 3;
  return (
    <button style={{ ...btnP, ...style }} onClick={() => { setData((prev) => replaceSamples(prev, cnt).data); showToast(`샘플 데이터를 ${cnt}개로 맞췄습니다.`); }}>{label || `🎁 샘플 ${cnt}개로 먼저 보기`}</button>
  );
}
// 샘플 3/5/10개 넣기(교체) + 샘플만 삭제 — 설정의 샘플 데이터 관리에서 사용
function SampleControls({ data, setData, hint }) {
  return null; // [D-93]
  // eslint-disable-next-line no-unreachable
  const cnt = sampleCount(data);
  const add = (c) => { setData((prev) => replaceSamples(prev, c).data); showToast(`샘플 데이터를 ${c}개로 맞췄습니다.`); };
  const del = () => { if (!window.confirm("샘플 데이터만 삭제할까요? 직접 등록한 고객 데이터는 유지됩니다.")) return; setData((prev) => stripSamples(prev).data); showToast("샘플 데이터가 삭제되었습니다."); };
  return <div>
    {hint && <p style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*14px)", lineHeight: 1.6, margin: "0 0 8px" }}>{hint}</p>}
    <div style={{ color: C.textS, fontSize: "calc(var(--s,1.3)*14px)", fontWeight: 700, marginBottom: 8 }}>현재 샘플 고객: <b style={{ color: cnt > 0 ? C.blue : C.textM }}>{cnt}개</b></div>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button style={btnP} onClick={() => add(3)}>🎁 샘플 3개 넣기</button>
      <button style={btnS} onClick={() => add(5)}>샘플 5개 넣기</button>
      <button style={btnS} onClick={() => add(10)}>샘플 10개 넣기</button>
      <button style={btnS} onClick={() => add(20)}>샘플 20개 넣기</button>
      <button style={{ ...btnS, color: C.err, borderColor: C.err }} onClick={del}>🧹 샘플 데이터만 삭제</button>
    </div>
  </div>;
}
// 안내 박스 안에 작게 들어가는 샘플 미니 컨트롤 — '샘플 3개로 먼저 보기'만 강조, 나머지는 더보기
function SampleMini({ data, setData }) {
  return null; // [D-93]
  // eslint-disable-next-line no-unreachable
  const cnt = sampleCount(data);
  const add = (c) => { setData((prev) => replaceSamples(prev, c).data); showToast(`샘플 데이터를 ${c}개로 맞췄습니다.`); };
  const del = () => { setData((prev) => stripSamples(prev).data); showToast("샘플 데이터가 삭제되었습니다."); };
  return <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.blue}33` }}>
    <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*14px)", lineHeight: 1.6, marginBottom: 8 }}>처음이라면 샘플 3개만 넣고 흐름을 먼저 확인해보세요. <b style={{ color: C.textS }}>현재 샘플 고객 {cnt}개</b></div>
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
      <button style={{ ...btnSm, background: C.blue, color: "#fff", border: "none" }} onClick={() => add(3)}>🎁 샘플 3개로 먼저 보기</button>
      <MoreActions label="샘플 더보기 ▾"><button style={btnSm} onClick={() => add(5)}>샘플 5개 보기</button><button style={btnSm} onClick={() => add(10)}>샘플 10개 보기</button><button style={btnSm} onClick={() => add(20)}>샘플 20개 보기</button><button style={{ ...btnSm, color: C.err }} onClick={del}>샘플만 삭제</button></MoreActions>
    </div>
  </div>;
}
// 전략(절세 솔루션)에 연결되는 기존 고객 자동 매칭 — 관심주제(fields) 교집합 기준
function relatedClientsForStrategy(s, data) {
  const pool = [...(data.companies || []), ...(data.leads || [])];
  const seen = new Set();
  const out = [];
  for (const c of pool) {
    if (seen.has(c.name)) continue;
    const its = c.interests || [];
    if (s.fields.some((f) => its.includes(f))) { seen.add(c.name); out.push(c); }
    if (out.length >= 4) break;
  }
  return out;
}

// ── 고객 중심 실무 헬퍼 ───────────────────────────────────────────
// ── 컨설팅 컨설팅 상품 ───────────────────────────────────────
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
function getPackages(data) { return (data && data.packages && data.packages.length) ? data.packages : DEFAULT_PACKAGES; }
function matchPackages(item, packages) {
  const strats = recommendedStrategiesFor(item);
  const out = []; const seen = new Set();
  for (const s of strats) { const pkg = packages.find((p) => p.strat === s.id && !seen.has(p.id)); if (pkg) { seen.add(pkg.id); out.push({ pkg, reason: recoReason(item, s) }); } if (out.length >= 3) break; }
  if (out.length < 3) { for (const pkg of packages) { if (!seen.has(pkg.id)) { seen.add(pkg.id); out.push({ pkg, reason: "고객 상황에 따라 검토 가능성이 있는 항목입니다." }); } if (out.length >= 3) break; } }
  return out;
}
function recordProposal(data, setData, item, pkgs) {
  const fee = pkgs.reduce((s, x) => s + (Number(x.fee) || 0), 0);
  updateCust(data, setData, item.id, { proposedPackages: pkgs.map((x) => x.name), proposedAt: todayISO(), proposedFee: fee, proposalStatus: "제안 완료" });
}
function buildProposal(item, pkgs, mode, profile) {
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
// ── 견적/업무범위서 ───────────────────────────────────────────────
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
  const name = getCompanyName(item) || item.name;
  return [
    ["업무범위서 전달", `대표님, 말씀 나눈 ${pkg.name} 기준으로 업무범위 초안을 정리해 보내드립니다. 실제 진행 범위와 수임료는 자료 확인 및 협의 후 조정될 수 있으니, 편하게 보시고 궁금한 부분만 말씀 주세요.`],
    ["견적 확인 요청", `대표님, 보내드린 업무범위 기준 제안 금액은 월납 플랜 기준으로 정리해 드릴 수 있습니다. 다만 자료 범위와 현금흐름에 따라 달라질 수 있어, 우선 자료만 확인한 뒤 범위를 같이 정리해보면 좋겠습니다.`],
    ["검토 후 미팅 제안", `대표님, 업무범위 초안 검토하시고 한 번 짧게 정리해서 설명드리면 좋을 것 같습니다. 부담 없이 우선순위와 범위만 같이 확인하는 자리로 봐주시면 됩니다.`],
    ["보류 고객 재연락", `대표님, 지난번 말씀 주셨던 ${pkg.name} 건은 지금 당장이 아니어도 괜찮습니다. 다만 자료 확인이 늦어지면 선택지가 줄어들 수 있어, 시간 되실 때 현황만 가볍게 점검해두시길 권드립니다.`],
    ["계약 전 최종 확인", `대표님, 진행 전에 업무 범위·제외 범위·예상 수임료·필요 자료를 다시 한 번 정리해 확인 부탁드립니다. 협의 후 정리되면 바로 착수 일정 잡아 진행하겠습니다.`],
  ];
}
// 제안 상태 관리
const PROPOSAL_STATES = ["제안 전", "제안서 작성", "제안 완료", "견적 전달", "검토 중", "조건 조율", "계약 예정", "계약 완료", "보류"];
const PROPOSAL_STATE_STYLE = { "제안 전": [C.textM, "#EEF2F7"], "제안서 작성": [C.blue, C.blueBg], "제안 완료": [C.sky, C.blueBg], "견적 전달": [C.purple, C.purpleBg], "검토 중": [C.warn, C.warnBg], "조건 조율": [C.warn, C.warnBg], "계약 예정": [C.gold, "#FCEFDA"], "계약 완료": [C.ok, C.greenBg], "보류": [C.textM, "#EEF2F7"] };
function setProposalStatus(data, setData, item, status) {
  if (!item || (item.proposalStatus || "제안 전") === status) return;
  const entry = { date: todayISO(), from: "[제안] " + (item.proposalStatus || "제안 전"), to: "[제안] " + status };
  const extra = {};
  if (status === "견적 전달" && !item.quotedAt) extra.quotedAt = todayISO();
  if (status === "계약 완료" && !item.contractedAt) extra.contractedAt = todayISO();
  updateCust(data, setData, item.id, { proposalStatus: status, stageHistory: [...(item.stageHistory || []), entry], ...extra });
  showToast(`제안 상태: ${status}`);
}
// 계약 준비 체크리스트
const CONTRACT_CHECKLIST = ["고객사 기본정보 확인", "담당자/대표 연락처 확인", "제안 범위 확인", "예상 수임료 확인", "제외 업무 설명 완료", "필요자료 목록 전달", "세무사/전문가 검토 필요사항 안내", "계약서 또는 업무범위서 발송", "착수금/입금 조건 협의", "다음 미팅 일정 정리"];
// 제안 우선순위 TOP3(규칙 기반: recommendedStrategiesFor 점수 + 고객 사실 근거)
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
// 상황별 후속 카톡 3종(1차 연락 / 자료 요청 / 미팅 후 정리) — 비단정 톤
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
// 미팅 준비 리포트(복사용 텍스트)
function buildMeetingReport(item) {
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
// 오늘 할 일 추가
function addTodo(data, setData, customer, title, kind, due) {
  const todos = data.todos || [];
  const name = getCompanyName(customer) || customer?.name || "";
  const finalTitle = title || `${name} 다음 액션 점검`;
  if (todos.some((x) => x.title === finalTitle && x.customerName === name)) { showToast("이미 오늘 할 일에 있습니다."); return; }
  const t = { id: uid(), title: finalTitle, customerId: customer?.id || "", customerName: name, status: "대기", priority: "보통", kind: kind || "기타", due: due || customer?.nextDate || "", createdAt: todayISO() };
  setData({ ...data, todos: [t, ...todos] });
  showToast("오늘 할 일에 추가했습니다.");
}
const TODO_NEXT = { "대기": "진행중", "진행중": "완료", "완료": "대기" };
const TODO_STYLE = { "대기": [C.textM, "#EEF2F7"], "진행중": [C.blue, C.blueBg], "완료": [C.ok, C.greenBg] };
const TODO_PRIO_NEXT = { "높음": "보통", "보통": "낮음", "낮음": "높음" };
const TODO_PRIO_STYLE = { "높음": [C.err, C.redBg], "보통": [C.gold, "#FCEFDA"], "낮음": [C.textM, "#EEF2F7"] };
const NEXT_ACTIONS = ["자료 요청", "1차 미팅 제안", "2차 미팅 준비", "세무사 검토 연결", "보류/장기관리"];
const TODO_KINDS = ["1차 연락", "자료 요청", "미팅 준비", "후속 카톡", "세무사 검토 연결", "제안서/리포트 발송", "기타"];
const CONTACT_TYPES = ["전화", "카톡", "방문 미팅", "자료 요청", "자료 수령", "제안서 발송", "기타"];
// 고객 1명을 leads/companies 어느 쪽에 있든 patch 병합
function updateCust(data, setData, id, patch) {
  const p = { ...patch, updatedAt: todayISO() };
  const upd = (arr) => (arr || []).map((x) => (x.id === id ? { ...x, ...p } : x));
  setData({ ...data, leads: upd(data.leads), companies: upd(data.companies) });
}
function changeStage(data, setData, item, newStage) {
  if (!item || item.stage === newStage) return;
  const entry = { date: todayISO(), from: stageOf(item.stage).label, to: stageOf(newStage).label };
  const extra = (newStage === "contracted" && !item.contractedAt) ? { contractedAt: todayISO() } : {};
  updateCust(data, setData, item.id, { stage: newStage, stageHistory: [...(item.stageHistory || []), entry], stageMovedAt: todayISO(), ...extra });
  showToast(`단계 변경: ${entry.from} → ${entry.to}`);
}
function addContact(data, setData, item, contact) {
  const c = { id: uid(), date: contact.date || todayISO(), type: contact.type || "전화", memo: contact.memo || "", nextAction: contact.nextAction || "" };
  updateCust(data, setData, item.id, { contacts: [c, ...(item.contacts || [])], lastContactAt: c.date });
  showToast("이력을 추가했습니다.");
}
function delContact(data, setData, item, cid) {
  updateCust(data, setData, item.id, { contacts: (item.contacts || []).filter((x) => x.id !== cid) });
}
// 다음 연락 상태: nextDate 기준
function followStatus(item) {
  if (!item || !item.nextDate || ["contracted", "lost"].includes(item.stage)) return null;
  const d = dday(item.nextDate);
  if (d < 0) return { t: "다음 연락 지연", c: C.err, b: C.redBg, kind: "overdue" };
  if (d === 0) return { t: "오늘 연락", c: C.warn, b: C.warnBg, kind: "today" };
  if (d <= 3) return { t: `곧 연락 D-${d}`, c: C.blue, b: C.blueBg, kind: "upcoming" };
  return null;
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
// 데이터 출처 배지: 신규 고객 발굴 전환 / 직접 등록 / 샘플
function sourceTag(rec) {
  if (rec && rec.fromLead) return { label: "신규 고객 발굴 전환", color: C.ok, bg: C.greenBg };
  if (rec && (rec.source === "manual" || rec.sample === false)) return { label: "직접 등록", color: C.sky, bg: C.blueBg };
  return { label: "샘플", color: C.textM, bg: "#EEF2F7" };
}
// 이 고객을 왜 지금 봐야 하는지 2~3줄 요약
function currentIssueSummary(item) {
  const main = recommendedStrategiesFor(item)[0];
  const facts = [];
  if (Number(item.ceoAge) >= 55) facts.push(`대표 ${item.ceoAge}세`);
  if (Number(item.estYears) >= 10) facts.push(`업력 ${item.estYears}년`);
  if (Number(item.empCount) >= 20) facts.push(`직원 ${item.empCount}명`);
  const f = facts.length ? facts.join("·") + " 기준, " : "";
  const concern = item.concern ? ` 대표 고민(${item.concern})과 연결됩니다.` : "";
  return `${f}${main.name}이(가) 우선 점검 포인트로 보입니다.${concern} 단정하기보다 자료 확인 후 검토 가능성을 판단하는 흐름을 권합니다.`;
}
// ── 방문용 1페이지 리포트 ─────────────────────────────────────────
const REPORT_PROFILE_DEFAULT = { consultant: "김팀장", org: "미래에이아이랩", /* [D-94] 고객에게 나가는 리포트 머리 — 원본 앱 이름 대신 회사 이름 */ title: "컨설턴트", phone: "", email: "", footer: "본 리포트는 상담 전 사전 점검용 자료이며, 실제 적용 여부는 회사의 세부 자료 확인과 세무사·노무사·전문가 검토가 필요합니다." };
function getReportProfile(data) { return { ...REPORT_PROFILE_DEFAULT, ...(data && data.reportProfile ? data.reportProfile : {}) }; }
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
function buildVisitReport(item, mode, profile) {
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
function customerShareSummary(item, profile) {
  const p = profile || REPORT_PROFILE_DEFAULT;
  const name = getCompanyName(item) || item.name;
  const recos = topRecommendations(item).map((r) => r.name).join(", ");
  return `${name} 대표님, 오늘 말씀 나눈 내용 기준으로 사전 점검 포인트를 짧게 정리해 드립니다.\n\n먼저 확인해보면 좋을 항목: ${recos}\n\n바로 결론을 내리기보다 재무제표·정관 등 자료를 먼저 함께 확인한 뒤, 실제 검토 가능성이 있는 부분만 추려서 다시 정리드리겠습니다. 적용 여부는 세부 요건 확인과 세무사 검토가 필요합니다.\n\n${p.consultant} ${p.title} · ${p.org}${p.phone ? "\n" + p.phone : ""}`;
}
function VisitReport({ open, item, data, setData, onClose }) {
  const [mode, setMode] = useState("customer");
  if (!open || !item) return null;
  const p = getReportProfile(data);
  const name = getCompanyName(item) || item.name;
  const recos = topRecommendations(item);
  const extra = extraCheckItems(item);
  const docs = visitRequestDocs(item);
  const kakaos = buildVisitKakaoSet(item);
  const dateK = todayISO().replace(/-/g, ".");
  const R = { bg: "#FBF9F3", text: "#222730", sub: "#5C6470", bd: "#E3DCCB", accent: "#9A7B2E", card: "#FFFFFF" };
  const sec = (title, children) => <div className="repSec" style={{ background: R.card, border: `1px solid ${R.bd}`, borderRadius: 12, padding: 16, marginBottom: 12, breakInside: "avoid" }}><div style={{ color: R.accent, fontWeight: 900, fontSize: "calc(var(--s,1.3)*16px)", marginBottom: 8 }}>{title}</div>{children}</div>;
  const doPrint = () => { setMode("customer"); setTimeout(() => { try { window.print(); } catch (e) {} }, 80); };
  return <Modal open={open} onClose={onClose} title={`${name} · 방문용 리포트`} width={860}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{[["customer", "대표님 공유용"], ["internal", "내부 검토용"]].map((m) => <button key={m[0]} onClick={() => setMode(m[0])} style={{ ...(mode === m[0] ? btnP : btnS) }}>{m[1]}</button>)}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button style={btnS} onClick={() => copyText(buildVisitReport(item, "customer", p), () => showToast("복사되었습니다."))}>대표님용 복사</button>
        <button style={btnS} onClick={() => copyText(buildVisitReport(item, "internal", p), () => showToast("복사되었습니다."))}>내부용 복사</button>
        <button style={btnS} onClick={() => copyText(visitRequestDocs(item).map((d) => "☐ " + d).join("\n"), () => showToast("복사되었습니다."))}>요청자료 복사</button>
        <button style={btnP} onClick={doPrint}>🖨 PDF 저장/인쇄</button>
      </div>
    </div>
    <div id="visitReport" style={{ background: R.bg, borderRadius: 14, padding: "clamp(18px,4vw,30px)", color: R.text, maxWidth: 760, margin: "0 auto" }}>
      <div className="repSec" style={{ borderBottom: `2px solid ${R.accent}`, paddingBottom: 14, marginBottom: 18, breakInside: "avoid" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div><div style={{ color: R.accent, letterSpacing: 2, fontSize: "calc(var(--s,1.3)*12px)", fontWeight: 900 }}>{p.org}</div><h2 style={{ margin: "6px 0 0", fontSize: "calc(var(--s,1.3)*23px)", color: R.text }}>법인컨설팅 사전 점검 리포트</h2></div>
          <div style={{ textAlign: "right", color: R.sub, fontSize: "calc(var(--s,1.3)*13px)", lineHeight: 1.6 }}><div>{p.consultant} {p.title}</div><div>작성일 {dateK}</div></div>
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 16, flexWrap: "wrap", fontSize: "calc(var(--s,1.3)*15px)" }}><div><b>고객사</b> {name}</div><div><b>상담 단계</b> {stageOf(item.stage).label}</div><div style={{ color: R.sub }}>{mode === "customer" ? "대표님 공유용" : "내부 검토용"}</div></div>
      </div>
      {sec("1. 회사 현황 요약", <div style={{ fontSize: "calc(var(--s,1.3)*15px)", lineHeight: 1.7 }}>{item.industry} · 매출 {wonFromMillion(item.revenue)} · 직원 {item.empCount || "-"}명 · 업력 {item.estYears || "-"}년 · 상담 단계 {stageOf(item.stage).label}{item.concern && <div style={{ marginTop: 6, color: R.sub }}>주요 고민: {item.concern}</div>}</div>)}
      {sec("2. 지금 점검이 필요한 이유", <div style={{ fontSize: "calc(var(--s,1.3)*15px)", lineHeight: 1.75 }}>{visitReasonText(item, mode)}</div>)}
      {sec("3. 우선 검토 후보 TOP 3", <div style={{ display: "grid", gap: 10 }}>{recos.map((r, i) => <div key={i} style={{ borderLeft: `3px solid ${R.accent}`, paddingLeft: 12 }}><div style={{ fontWeight: 800, fontSize: "calc(var(--s,1.3)*15px)" }}>{i + 1}. {r.name}</div><div style={{ color: R.sub, fontSize: "calc(var(--s,1.3)*14px)", marginTop: 3, lineHeight: 1.6 }}>· 점검 포인트: {mode === "internal" ? r.reason : "대표님 상황에서 한 번 확인해보면 좋은 부분입니다."}</div><div style={{ color: R.sub, fontSize: "calc(var(--s,1.3)*14px)", lineHeight: 1.6 }}>· 필요 자료: {r.docs.join(", ")}</div><div style={{ color: "#9A4A2E", fontSize: "calc(var(--s,1.3)*14px)", lineHeight: 1.6 }}>· 유의: {r.risk}</div></div>)}</div>)}
      {mode === "internal" && sec("3-1. [내부] 영업 포인트 · 리스크 · 다음 액션", <div style={{ fontSize: "calc(var(--s,1.3)*14px)", lineHeight: 1.7, display: "grid", gap: 4 }}><div>· 핵심 영업 포인트: <b>{recos[0].name}</b>{recos.length > 1 ? ` → ${recos.slice(1).map((r) => r.name).join(" / ")} 확장` : ""}</div><div>· 예상 리스크: {recos[0].risk}</div><div>· 조심할 표현: 효과·수급·인증 단정 금지 → “검토 가능성 · 자료 확인 후 판단 · 세무사 검토 권장”</div><div>· 다음 액션: {item.nextAction || "자료 요청"} → 자료 확인 후 2차 미팅 제안</div>{expFee(item) > 0 && <div>· 예상 수임료(내부): {feeMoney(item.expectedFee)}</div>}<div>· 추천 상품/패키지: {matchPackages(item, getPackages(data)).map((m) => m.pkg.name).join(" / ")}</div></div>)}
      {mode === "internal" && (item.contacts || []).length > 0 && sec("3-2. [내부] 최근 연락 이력", <div style={{ display: "grid", gap: 5, fontSize: "calc(var(--s,1.3)*14px)" }}>{(item.contacts || []).slice(0, 5).map((ct) => <div key={ct.id}>{ct.date.replace(/-/g, ".")} · {ct.type}{ct.memo ? ` — ${ct.memo}` : ""}{ct.nextAction ? ` (다음: ${ct.nextAction})` : ""}</div>)}</div>)}
      {sec("4. 추가로 확인하면 좋은 항목", <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{extra.map((x) => <span key={x} style={{ background: "#F0EADA", color: R.text, padding: "5px 12px", borderRadius: 999, fontSize: "calc(var(--s,1.3)*14px)", fontWeight: 700 }}>{x}</span>)}</div>)}
      {sec("5. 요청 자료 체크리스트", <div style={{ display: "grid", gap: 6 }}>{docs.map((d) => <div key={d} style={{ fontSize: "calc(var(--s,1.3)*15px)" }}>☐ {d}</div>)}</div>)}
      {sec("6. 다음 미팅 제안", <div style={{ fontSize: "calc(var(--s,1.3)*15px)", lineHeight: 1.7 }}>자료 확인 후 실제 적용 가능성이 있는 부분만 추려서 다시 정리드리겠습니다. 부담 없이 현재 상황과 우선순위만 함께 확인하는 자리로 봐주시면 됩니다.</div>)}
      <div className="repSec" style={{ background: "#F3EEE0", border: `1px solid ${R.bd}`, borderRadius: 10, padding: 14, breakInside: "avoid" }}><div style={{ color: R.text, fontSize: "calc(var(--s,1.3)*13px)", lineHeight: 1.6, marginBottom: 8 }}>※ {p.footer}</div><div style={{ color: R.sub, fontSize: "calc(var(--s,1.3)*13px)", lineHeight: 1.6 }}>{p.consultant} {p.title} · {p.org}{p.phone ? ` · ${p.phone}` : ""}{p.email ? ` · ${p.email}` : ""}</div></div>
    </div>
    <div style={{ marginTop: 16 }}><div style={{ fontWeight: 900, color: C.gold, fontSize: "calc(var(--s,1.3)*16px)", marginBottom: 8 }}>💬 후속 카톡 문구 (상황별 3종)</div><div style={{ display: "grid", gap: 10 }}>{kakaos.map((k, i) => <TextBlock key={i} title={k[0]} text={k[1]} copy />)}</div></div>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
      <button style={btnS} onClick={() => addTodo(data, setData, item, `${name} 자료 요청`, "자료 요청")}>➕ 자료 요청을 오늘 할 일로</button>
      <button style={btnS} onClick={() => addTodo(data, setData, item, `${name} 2차 미팅 제안`, "미팅 준비")}>➕ 2차 미팅 제안을 오늘 할 일로</button>
    </div>
  </Modal>;
}
// 고객 1명 실무 요약판(신규 고객 발굴·고객사 관리 공용) — 7섹션 + TOP3 + 미팅 리포트 + 상황별 카톡
// ── 영업 프로세스(DB→미팅→계약/보류→관리) ─────────────────────────
const DB_SOURCES = ["회사 제공 DB", "사업단 제공 DB", "온라인 광고 DB", "기존 고객 소개", "지인 소개", "세미나/교육 유입", "콘텐츠 유입", "직접 발굴", "기타"];
const DB_SOURCE_STYLE = { "기존 고객 소개": [C.ok, C.greenBg], "지인 소개": [C.ok, C.greenBg], "온라인 광고 DB": [C.purple, C.purpleBg], "회사 제공 DB": [C.blue, C.blueBg], "사업단 제공 DB": [C.blue, C.blueBg], "직접 발굴": [C.sky, C.blueBg] };
const DEAL_RESULTS = ["미정", "계약", "보류", "거절", "장기관리"];
const HOLD_REASONS = ["가격 부담", "필요성 부족", "가족/세무사 상의 필요", "자금 여력 부족", "신뢰 형성 부족", "시급성 부족", "타이밍 문제", "기타"];
const MANAGE_CYCLES = [["2주", 14], ["1개월", 30], ["2개월", 60], ["3개월", 90], ["6개월", 180]];
const REQUIRED_DOCS = ["사업자등록증", "법인등기부등본", "정관", "주주명부", "4대보험 사업장 가입자명부", "재무제표", "부가세 신고서", "법인세 신고서", "계정별원장", "급여대장", "근로계약서", "임원명부", "특허/인증 서류", "대출/보증 내역"];
const DOC_STATUSES = ["미요청", "요청완료", "수령완료", "보완필요"];
const DOC_STATUS_STYLE = { "미요청": [C.textM, "#EEF2F7"], "요청완료": [C.blue, C.blueBg], "수령완료": [C.ok, C.greenBg], "보완필요": [C.warn, C.warnBg] };
const CONSULT_ITEMS = ["기업부설연구소", "연구소 사후관리", "연구인력개발비 세액공제", "벤처기업 인증", "메인비즈/이노비즈", "정책자금", "고용지원금", "통합고용세액공제", "정관정비", "임원퇴직금 규정", "가지급금 정리", "가수금 출자전환", "사내근로복지기금", "가업승계", "주식가치평가", "이익소각", "법인보험/대표 퇴직금 플랜", "특허/상표 지식재산", "홈페이지/브랜딩/마케팅", "정부지원사업/바우처"];
const MANAGE_MSG_KINDS = ["최근 제도/공고 이슈 공유", "세액공제/고용지원금 점검 안내", "정관/임원퇴직금 점검 안내", "정책자금/인증 이슈 공유", "가벼운 안부/자료 공유", "재미팅 제안"];
function manToText(man) { const m = Math.round(Number(man) || 0); const won = m * 10000; if (won >= 1e8) { const eok = Math.floor(won / 1e8); const rest = Math.round((won % 1e8) / 1e4); return `${eok}억${rest ? " " + rest.toLocaleString() + "만원" : "원"}`; } return m.toLocaleString() + "만원"; }
// 재무구조 신호등(빨강/노랑/초록) — 단정 금지, '우선 점검 필요' 톤
function financeSignal(item) {
  const fl = (item && item.flags) || {};
  const nums = (item && item.financialNumbers) || [];
  const reasons = []; let red = 0, yellow = 0;
  const dr = nums.find((n) => n.label === "부채비율"); const drv = dr ? parseFloat(String(dr.display).replace(/[^0-9.]/g, "")) : null;
  if (drv != null) { if (drv >= 250) { red++; reasons.push(`부채비율 ${dr.display} — 재무구조 관리 필요성이 있어 보임`); } else if (drv >= 150) { yellow++; reasons.push(`부채비율 ${dr.display} — 우선 점검 필요`); } }
  if (fl.gajigeup) { yellow++; reasons.push("가지급금 정리 필요성 우선 점검 필요"); }
  if (fl.gasugeum) { yellow++; reasons.push("가수금 정리/출자전환 검토 가능성"); }
  if (fl.hasLoan) { yellow++; reasons.push("차입금/대출 — 현금흐름·이자부담 점검 필요"); }
  if ((item && (item.interests || [])).includes("미처분이익잉여금")) { yellow++; reasons.push("미처분이익잉여금 누적 가능성 — 주식가치/배당/승계 점검 필요"); }
  if (fl.corpTaxBurden) { yellow++; reasons.push("법인세 부담 가능성 — 비용·공제 점검 필요"); }
  const opportunities = [];
  if (fl.rndStaff && !fl.hasLab) opportunities.push("기업부설연구소·세액공제 검토 가능성");
  if (fl.hiring || fl.employSubsidy) opportunities.push("고용지원금·통합고용세액공제 점검 가능성");
  if (fl.venture || fl.patent) opportunities.push("벤처·이노비즈·지식재산 활용 가능성");
  let level, label, color, bg;
  if (red >= 1) { level = "red"; label = "🔴 빨간불 · 재무구조 관리 필요성"; color = C.err; bg = C.redBg; }
  else if (yellow >= 1) { level = "yellow"; label = "🟡 노란불 · 일부 점검 필요"; color = C.warn; bg = C.warnBg; }
  else { level = "green"; label = "🟢 초록불 · 재무구조 양호 추정"; color = C.ok; bg = C.greenBg; }
  const advice = level === "red" ? "차입/부채/현금흐름/가지급금/유동성 이슈를 우선 점검하는 흐름이 보입니다." : level === "yellow" ? "자금·정관·세액공제·인증 기회를 함께 점검해볼 만합니다." : "이익·세금·승계·자산관리 중심으로 접근해볼 만합니다.";
  return { level, label, color, bg, reasons, opportunities, advice };
}
// 놓치기 쉬운 컨설팅 점검 항목(플래그 기반 추천)
function missedConsultItems(item) {
  const fl = (item && item.flags) || {}; const out = [];
  if (fl.rndStaff && !fl.hasLab) out.push("기업부설연구소", "연구인력개발비 세액공제");
  if (fl.hiring || fl.employSubsidy) out.push("고용지원금", "통합고용세액공제");
  if ((item.interests || []).includes("미처분이익잉여금")) out.push("주식가치평가", "이익소각");
  if (fl.gajigeup) out.push("가지급금 정리"); if (fl.gasugeum) out.push("가수금 출자전환");
  if (fl.succession || fl.childWorks) out.push("가업승계");
  if (!fl.charterFixed) out.push("정관정비"); if (!fl.execRetire) out.push("임원퇴직금 규정");
  if (fl.venture || fl.patent) out.push("벤처기업 인증", "특허/상표 지식재산");
  if (fl.policyFund || fl.hasLoan) out.push("정책자금");
  return Array.from(new Set(out)).slice(0, 8);
}
function buildOnePager(item, profile) {
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
// 1차 미팅 녹취록/스크립트 텍스트 분석(키워드 기반 추정)
function analyzeTranscript(text) {
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
function insuranceSim(monthly, months, rate) { const mo = Number(monthly) || 0, mm = Number(months) || 84, rt = isFinite(Number(rate)) ? Number(rate) : 100; const total = mo * mm; const base = Math.round(total * rt / 100); return { total, base, months: mm, rate: rt }; }
// 월납 적정성 기준(컨설턴트 설정) — 직전년도 당기순이익 1억원당 초록/노랑 월납 한도(만원), 기본 납입기간·환급률
function getAffordSettings(data) { const s = (data && data.affordSettings) || {}; return { greenPerEok: Number(s.greenPerEok) > 0 ? Number(s.greenPerEok) : 300, yellowPerEok: Number(s.yellowPerEok) > 0 ? Number(s.yellowPerEok) : 600, defMonths: Number(s.defMonths) > 0 ? Number(s.defMonths) : 84, defRate: isFinite(Number(s.defRate)) ? Number(s.defRate) : 100 }; }
// 표시문자열(예: "3.1억원", "8,000만원", "310,000원")에서 만원 단위 숫자 추출
function manFromDisplay(s) { if (!s) return null; const t = String(s); let m; if ((m = t.match(/([0-9.,]+)\s*억/))) return Math.round(parseFloat(m[1].replace(/,/g, "")) * 10000); if ((m = t.match(/([0-9.,]+)\s*만원/))) return Math.round(parseFloat(m[1].replace(/,/g, ""))); if ((m = t.match(/([0-9,]+)\s*원/))) return Math.round(parseFloat(m[1].replace(/,/g, "")) / 1e4); return null; }
// 고객의 직전년도 당기순이익(만원) — 우선순위: 제안 저장값 → netIncome 필드 → 재무 추출값
function custNetIncomeMan(item) {
  if (!item) return null;
  if (isFinite(Number(item.proposalNetIncomeBase)) && Number(item.proposalNetIncomeBase) > 0) return Number(item.proposalNetIncomeBase);
  if (isFinite(Number(item.netIncome)) && Number(item.netIncome) > 0) return Number(item.netIncome);
  const nums = item.financialNumbers || [];
  const hit = nums.find((n) => /당기순이익|순이익/.test(n.label || ""));
  if (hit) { const v = manFromDisplay(hit.display); if (v) return v; }
  return null;
}
// 직전년도 당기순이익 대비 월납 적정성 신호등(초록/노랑/빨강) — 단정 금지, 컨설턴트 최종 판단용 참고
function affordability(monthlyMan, netIncomeMan, settings) {
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
// 저장된 월납 제안 → 문서용 텍스트 라인. mode "internal"이면 적정성 신호까지 포함.
function monthlyPlanText(item, settings, mode) {
  if (!item || !(Number(item.proposalMonthlyPremium) > 0)) return [];
  const mo = Number(item.proposalMonthlyPremium), mm = Number(item.proposalMonths) || 84, rt = isFinite(Number(item.proposalRefundRate)) ? Number(item.proposalRefundRate) : 100;
  const r = insuranceSim(mo, mm, rt);
  const L = ["■ 월납 플랜 검토안 (100% 기준 단순 시뮬레이션)", `· 월납 보험료: ${manToText(mo)}`, `· ${mm}개월 총 납입 기준: ${manToText(r.total)}`, `· 7년차 ${rt}% 기준 예상 목적자금: ${manToText(r.base)}`];
  if (mode === "internal") { const net = custNetIncomeMan(item); const aff = affordability(mo, net, settings || getAffordSettings(null)); if (aff.hasBase) L.push(`· [내부] 직전년도 이익 대비 적정성: ${aff.label}`); }
  L.push("· 해당 금액은 대표 퇴직금·가지급금 정리·세무/승계 목적자금 등으로 검토할 수 있습니다.", "· 상품 조건에 따라 실제 수치가 달라질 수 있으며, 청약 전 상품설명서와 전문가 설명 확인이 필요합니다.");
  return L;
}
function buildSecondMeetingDoc(item, profile, sim) {
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
function defaultRoadmap(item) {
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
// 인쇄/복사용 텍스트 모달(#visitReport로 인쇄 영역 지정)
function PrintModal({ open, title, text, onClose }) {
  if (!open) return null;
  return <Modal open={open} title={title} width={840} onClose={onClose}>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}><button style={btnP} onClick={() => copyText(text, () => showToast("복사되었습니다."))}>📋 복사</button><button style={btnS} onClick={() => { if (typeof window !== "undefined") window.print(); }}>🖨️ 인쇄</button></div>
    <div id="visitReport" style={{ background: "#fff", color: "#222", border: `1px solid ${C.bdr}`, borderRadius: 10, padding: 20, whiteSpace: "pre-wrap", fontSize: "calc(var(--s,1.3)*14px)", lineHeight: 1.7 }}>{text}</div>
  </Modal>;
}
function HubSection({ title, sub, open, onToggle, color, children }) {
  return <Card style={{ padding: 0, overflow: "hidden" }}>
    <button onClick={onToggle} aria-expanded={open} style={{ width: "100%", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "14px 16px", background: "transparent", border: "none", cursor: "pointer", fontFamily: FF }}>
      <span style={{ fontWeight: 900, color: color || C.gold, fontSize: "calc(var(--s,1.3)*16px)" }}>{title}{sub ? <span style={{ color: C.textM, fontWeight: 600, fontSize: "calc(var(--s,1.3)*13px)", marginLeft: 8 }}>· {sub}</span> : null}</span>
      <span style={{ color: C.textM }}>{open ? "▲" : "▼"}</span>
    </button>
    {open && <div style={{ padding: "0 16px 16px" }}>{children}</div>}
  </Card>;
}
// 영업 프로세스 허브 — 고객 상세에 통합되는 단계별 관리 카드 묶음
function ProcessHub({ item, data, setData, goMeeting }) {
  const open = (data.expandedSectionsByScreen && data.expandedSectionsByScreen.custDetail) || {};
  const [tr, setTr] = useState(item.transcript || "");
  const [pm, setPm] = useState(null);
  const [sim, setSim] = useState({ monthlyMan: item.simMonthly || 200, months: 84, rate: 100 });
  const upd = (patch) => updateCust(data, setData, item.id, patch);
  const tog = (k) => setExpand(setData, "custDetail", k, !open[k]);
  const profile = getReportProfile(data);
  const sig = financeSignal(item);
  const docList = item.docChecklist && item.docChecklist.length ? item.docChecklist : null;
  const docProgress = docList ? `${docList.filter((d) => d.status === "수령완료").length}/${docList.length} 수령` : "";
  const ta = item.transcriptAnalysis;
  const trAnalyze = () => { if (!tr.trim()) { showToast("녹취록/스크립트 텍스트를 붙여넣어 주세요."); return; } const a = analyzeTranscript(tr); upd({ transcript: tr.slice(0, 20000), transcriptAnalysis: a }); showToast("녹취록을 분석해 저장했습니다. 결과를 확인해주세요."); };
  const setResult = (r) => {
    const patch = { dealResult: r };
    if (r === "계약") { patch.proposalStatus = "계약 완료"; patch.stage = "contracted"; if (!item.contractedAt) patch.contractedAt = todayISO(); if (!(item.roadmap && item.roadmap.length)) patch.roadmap = defaultRoadmap(item); if (!(item.docChecklist && item.docChecklist.length)) patch.docChecklist = REQUIRED_DOCS.map((n) => ({ name: n, status: "미요청", requestedAt: "", receivedAt: "", memo: "", location: "" })); showToast("계약 완료로 처리하고 로드맵·필수서류를 준비했습니다."); }
    else if (r === "보류") { patch.proposalStatus = "보류"; if (!item.nextDate) patch.nextDate = ymdAdd(30); showToast("보류로 처리했습니다. 사유와 다음 연락일을 정리해주세요."); }
    else if (r === "거절") { showToast("거절로 처리했습니다. 사유와 재접촉 시점을 정리해주세요."); }
    else if (r === "장기관리") { if (!item.manageCycle) patch.manageCycle = 60; if (!item.nextDate) patch.nextDate = ymdAdd(60); showToast("장기관리로 전환했습니다."); }
    upd(patch);
  };
  const setDoc = (idx, key, val) => { const list = (item.docChecklist || []).slice(); if (!list[idx]) return; list[idx] = { ...list[idx], [key]: val }; if (key === "status" && val === "요청완료" && !list[idx].requestedAt) list[idx].requestedAt = todayISO(); if (key === "status" && val === "수령완료" && !list[idx].receivedAt) list[idx].receivedAt = todayISO(); upd({ docChecklist: list }); };
  const genDocs = () => upd({ docChecklist: REQUIRED_DOCS.map((n) => ({ name: n, status: "미요청", requestedAt: "", receivedAt: "", memo: "", location: "" })) });
  const setRoad = (idx, key, val) => { const list = (item.roadmap || []).slice(); if (!list[idx]) return; list[idx] = { ...list[idx], [key]: val }; upd({ roadmap: list }); };
  const timeline = buildTimeline(item);
  const onePagerText = buildOnePager(item, profile);
  return <div style={{ display: "grid", gap: 10 }}>
    <Card style={{ padding: "12px 14px", background: sig.bg, border: `1px solid ${sig.color}40` }}>
      <div style={{ fontWeight: 900, color: sig.color, fontSize: "calc(var(--s,1.3)*15px)" }}>{sig.label}</div>
      <div style={{ color: C.textS, fontSize: "calc(var(--s,1.3)*13px)", marginTop: 4, lineHeight: 1.6 }}>{sig.advice}{sig.reasons.length ? ` · ${sig.reasons.slice(0, 2).join(" / ")}` : ""}{sig.opportunities.length ? ` · 기회: ${sig.opportunities[0]}` : ""}</div>
    </Card>
    <HubSection title="📝 1차 미팅 한 장 요약" open={open.one} onToggle={() => tog("one")}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        <button style={btnP} onClick={() => setPm({ title: "1차 미팅 한 장 요약", text: onePagerText })}>📄 요약 보기 / 인쇄</button>
        <button style={btnS} onClick={() => copyText(onePagerText, () => showToast("복사되었습니다."))}>요약 복사</button>
        <button style={btnS} onClick={() => copyText(buildMeetingPlan(item, "m1").questions.slice(0, 6).map((q, i) => `${i + 1}) ${q}`).join("\n"), () => showToast("미팅 질문을 복사했습니다."))}>미팅 질문 복사</button>
      </div>
      {missedConsultItems(item).length > 0 && <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*13px)", lineHeight: 1.6 }}>놓치기 쉬운 점검 항목: <b style={{ color: C.textS }}>{missedConsultItems(item).join(", ")}</b></div>}
    </HubSection>
    <HubSection title="🎙️ 1차 미팅 녹취록 분석" sub={ta ? `분석됨 ${(ta.analyzedAt || "").replace(/-/g, ".")}` : ""} open={open.tr} onToggle={() => tog("tr")}>
      <p style={{ margin: "0 0 8px", color: C.textM, fontSize: "calc(var(--s,1.3)*13px)", lineHeight: 1.6 }}>녹음 파일의 직접 음성 변환은 지원하지 않습니다. 클로바노트·다글로 등에서 변환한 텍스트를 붙여넣어 주세요.</p>
      <textarea style={{ ...inp, height: 90, resize: "vertical" }} value={tr} onChange={(e) => setTr(e.target.value)} placeholder="1차 미팅 녹취록/스크립트 텍스트를 붙여넣어 주세요." />
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
        <label style={{ ...btnS, display: "inline-flex", alignItems: "center", cursor: "pointer" }}>📎 TXT 첨부<input type="file" accept=".txt,audio/*" style={{ display: "none" }} onChange={(e) => { const file = e.target.files && e.target.files[0]; if (!file) return; e.target.value = ""; if ((file.name || "").toLowerCase().endsWith(".txt") || file.type === "text/plain") { const r = new FileReader(); r.onload = () => setTr((s) => (s ? s + "\n" : "") + String(r.result || "")); r.readAsText(file); } else { showToast("오디오 직접 변환은 지원하지 않습니다. 클로바노트/다글로 등에서 변환한 텍스트를 붙여넣어 주세요."); } }} /></label>
        <button style={btnP} onClick={trAnalyze}>🔍 녹취록 분석</button>
      </div>
      {ta && <div style={{ marginTop: 10, border: `1px solid ${C.bdr}`, borderRadius: 10, padding: 12 }}>
        <div style={{ color: C.textS, fontSize: "calc(var(--s,1.3)*14px)", lineHeight: 1.7 }}>
          <div><b>요약</b> · {ta.summary}</div>
          <div style={{ marginTop: 4 }}><b>대표 반응</b> · {ta.reaction}</div>
          {ta.interested.length > 0 && <div><b>관심</b> · {ta.interested.join(", ")}</div>}
          {ta.hesitant.length > 0 && <div><b>부담</b> · {ta.hesitant.join(", ")}</div>}
          {ta.newInfo.length > 0 && <div><b>새 정보</b> · {ta.newInfo.join(", ")}</div>}
          <div style={{ marginTop: 4 }}><b>2차 미팅 전략</b> · {ta.strategy}</div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
          <button style={btnS} onClick={() => copyText([`[전략노트]`, ta.summary, "", "■ 2차 미팅 때 다시 짚을 내용", ...ta.secondPoints.map((x) => "· " + x), "", "■ 다음 요청자료", ...ta.nextDocs.map((x) => "· " + x), "", "■ 후속 카톡", ta.kakao].join("\n"), () => showToast("전략노트를 복사했습니다."))}>전략노트 복사</button>
          <button style={btnS} onClick={() => copyText(ta.kakao, () => showToast("후속 카톡을 복사했습니다."))}>후속 카톡 복사</button>
          <button style={btnS} onClick={() => { tog("second"); showToast("2차 미팅 자료 섹션을 펼쳤습니다."); setOpen((o) => ({ ...o, second: true })); }}>2차 미팅 준비로 보내기</button>
          <button style={btnS} onClick={() => { upd({ nextDate: ymdAdd(7), nextAction: "2차 미팅 준비" }); showToast("다음 연락일을 7일 후로 설정했습니다."); }}>다음 연락 일정 만들기</button>
        </div>
      </div>}
    </HubSection>
    <HubSection title="📑 2차 미팅 전략자료 · 월납 시뮬레이터" open={open.second} onToggle={() => tog("second")}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 8, marginBottom: 10 }}>
        <div><Label>월납(만원)</Label><input type="number" style={inp} value={sim.monthlyMan} onChange={(e) => setSim((s) => ({ ...s, monthlyMan: e.target.value }))} /></div>
        <div><Label>납입기간(개월)</Label><input type="number" style={inp} value={sim.months} onChange={(e) => setSim((s) => ({ ...s, months: e.target.value }))} /></div>
        <div><Label>예상 환급률(%)</Label><input type="number" style={inp} value={sim.rate} onChange={(e) => setSim((s) => ({ ...s, rate: e.target.value }))} /></div>
      </div>
      {(() => { const r = insuranceSim(sim.monthlyMan, sim.months, sim.rate); return <div style={{ background: C.bg, borderRadius: 10, padding: "10px 12px", fontSize: "calc(var(--s,1.3)*14px)", color: C.textS, lineHeight: 1.7 }}>
        월납 <b>{manToText(sim.monthlyMan)}</b> × {sim.months}개월 = 총 납입액 <b style={{ color: C.blue }}>{manToText(r.total)}</b><br />환급률 {sim.rate}% 기준 시 {sim.months}개월 후 기준액 <b style={{ color: C.gold }}>{manToText(r.base)}</b>
        <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*12px)", marginTop: 6 }}>※ 본 계산은 2차 미팅 설명용 단순 시뮬레이션입니다. 상품별 실제 환급률·조건은 달라질 수 있으며, 청약 전 상품설명서와 전문가 설명이 필요합니다.</div>
      </div>; })()}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
        <button style={btnP} onClick={() => { upd({ simMonthly: Number(sim.monthlyMan) || 0 }); setPm({ title: "2차 미팅 전략자료", text: buildSecondMeetingDoc(item, profile, sim) }); }}>📄 2차 자료 보기 / 인쇄</button>
        <button style={btnS} onClick={() => copyText(buildSecondMeetingDoc(item, profile, sim), () => showToast("2차 자료를 복사했습니다."))}>2차 자료 복사</button>
      </div>
    </HubSection>
    <HubSection title="🧭 계약 / 보류 분기" sub={item.dealResult && item.dealResult !== "미정" ? item.dealResult : ""} open={open.result} onToggle={() => tog("result")}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>{DEAL_RESULTS.filter((r) => r !== "미정").map((r) => { const on = item.dealResult === r; const col = r === "계약" ? C.ok : r === "보류" ? C.warn : r === "거절" ? C.err : C.blue; return <button key={r} onClick={() => setResult(r)} style={{ ...btnSm, color: on ? "#fff" : col, background: on ? col : C.input, border: `1px solid ${col}`, fontWeight: 800 }}>{on ? "✓ " : ""}{r}</button>; })}</div>
      {(item.dealResult === "보류" || item.dealResult === "거절" || item.dealResult === "장기관리") && <div style={{ display: "grid", gap: 8 }}>
        <div><Label>{item.dealResult} 사유</Label><div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>{HOLD_REASONS.map((h) => <PillButton key={h} active={item.dealReason === h} onClick={() => upd({ dealReason: h })}>{h}</PillButton>)}</div></div>
        {item.dealReason && <div style={{ background: C.bg, borderRadius: 9, padding: "8px 10px", color: C.textS, fontSize: "calc(var(--s,1.3)*13px)", lineHeight: 1.6 }}>{holdReasonAdvice(item.dealReason)}</div>}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}><div><Label>다음 연락일</Label><input type="date" style={{ ...inp, width: "auto", marginBottom: 0 }} value={item.nextDate || ""} onChange={(e) => upd({ nextDate: e.target.value })} /></div><button style={btnS} onClick={() => copyText(holdReasonMessage(item), () => showToast("재접촉 메시지를 복사했습니다."))}>재접촉 메시지 복사</button></div>
      </div>}
    </HubSection>
    <HubSection title="🗂️ 계약업체 필수서류" sub={docProgress} open={open.docs} onToggle={() => tog("docs")}>
      {!docList ? <div><p style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*14px)", margin: "0 0 8px" }}>필수서류 체크리스트가 아직 없습니다.</p><button style={btnP} onClick={genDocs}>필수서류 체크리스트 만들기</button></div> : <div>
        <p style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*12px)", margin: "0 0 8px", lineHeight: 1.6 }}>※ 원본 파일은 서버에 저장하지 않습니다. 이 MVP는 상태·메모·PC 폴더 위치만 기록합니다(파일 보관은 PC 폴더 권장).</p>
        <div style={{ display: "grid", gap: 6 }}>{docList.map((d, idx) => { const st = DOC_STATUS_STYLE[d.status] || DOC_STATUS_STYLE["미요청"]; return <div key={d.name} style={{ background: C.bg, borderRadius: 9, padding: "8px 10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}><b style={{ fontSize: "calc(var(--s,1.3)*14px)" }}>{d.name}</b><select style={{ ...inp, width: "auto", marginBottom: 0, padding: "6px 10px", color: st[0] }} value={d.status} onChange={(e) => setDoc(idx, "status", e.target.value)}>{DOC_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}><input style={{ ...inp, flex: 1, minWidth: 120, marginBottom: 0, padding: "6px 10px" }} value={d.location || ""} onChange={(e) => setDoc(idx, "location", e.target.value)} placeholder="PC 폴더 위치/메모" /></div>
        </div>; })}</div>
        <button style={{ ...btnS, marginTop: 8 }} onClick={() => copyText(`대표님, 진행을 위해 아래 서류를 준비 부탁드립니다.\n` + docList.filter((d) => d.status !== "수령완료").map((d) => `☐ ${d.name}`).join("\n") + `\n자료 준비 상황에 따라 일정은 조정될 수 있습니다.`, () => showToast("서류 요청 문구를 복사했습니다."))}>서류 요청 문구 복사</button>
      </div>}
    </HubSection>
    <HubSection title="🗺️ 진행 로드맵" sub={item.roadmap && item.roadmap.length ? `${item.roadmap.length}단계` : ""} open={open.road} onToggle={() => tog("road")}>
      {!(item.roadmap && item.roadmap.length) ? <button style={btnP} onClick={() => upd({ roadmap: defaultRoadmap(item) })}>추천 로드맵 자동 생성</button> : <div style={{ display: "grid", gap: 6 }}>{item.roadmap.map((r, idx) => { const sc = { "예정": C.textM, "진행중": C.blue, "완료": C.ok, "보류": C.warn }; return <div key={r.id} style={{ background: C.bg, borderRadius: 9, padding: "8px 10px", borderLeft: `3px solid ${sc[r.status] || C.textM}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}><div><b style={{ fontSize: "calc(var(--s,1.3)*14px)" }}>{r.month} · {r.task}</b><div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*12px)", marginTop: 2 }}>{r.purpose}{r.docs ? ` · 자료: ${r.docs}` : ""}</div></div><select style={{ ...inp, width: "auto", marginBottom: 0, padding: "5px 9px" }} value={r.status} onChange={(e) => setRoad(idx, "status", e.target.value)}>{["예정", "진행중", "완료", "보류"].map((s) => <option key={s}>{s}</option>)}</select></div>
      </div>; })}<button style={{ ...btnS, marginTop: 4 }} onClick={() => copyText("[진행 로드맵]\n" + item.roadmap.map((r) => `· ${r.month}: ${r.task} (${r.status})`).join("\n"), () => showToast("로드맵을 복사했습니다."))}>로드맵 복사</button></div>}
    </HubSection>
    <HubSection title="🔁 장기관리 / 추가제안" open={open.manage} onToggle={() => tog("manage")}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 8 }}>
        <div><Label>관리 주기</Label><select style={{ ...inp, width: "auto", marginBottom: 0 }} value={item.manageCycle || ""} onChange={(e) => { const days = Number(e.target.value) || 0; upd({ manageCycle: days, nextDate: days ? ymdAdd(days) : item.nextDate }); }}><option value="">선택</option>{MANAGE_CYCLES.map(([l, d]) => <option key={d} value={d}>{l}</option>)}</select></div>
        <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*13px)" }}>{(() => { const la = lastActivityOf(item); const days = la ? Math.abs(dday(la)) : null; return days != null ? `마지막 활동 후 ${days}일 · 관리받는 인상을 줄 짧은 이슈 공유를 보내보세요.` : "관리 주기를 설정하면 다음 연락일이 자동으로 잡힙니다."; })()}</div>
      </div>
      <Label>보낼 관리 메시지</Label>
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>{MANAGE_MSG_KINDS.map((k) => <button key={k} style={btnSm} onClick={() => copyText(manageMessage(item, k), () => showToast("관리 메시지를 복사했습니다."))}>{k}</button>)}</div>
      <div style={{ marginTop: 10, color: C.textS, fontSize: "calc(var(--s,1.3)*13px)", lineHeight: 1.6 }}>추가계약/소개 추천: {referralAdvice(item)}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}><button style={btnS} onClick={() => copyText(referralMessage(item), () => showToast("소개 요청 문구를 복사했습니다."))}>소개 요청 문구 복사</button></div>
    </HubSection>
    <HubSection title="🕒 진행 타임라인" sub={`${timeline.length}건`} open={open.tl} onToggle={() => tog("tl")}>
      {timeline.length === 0 ? <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*14px)" }}>아직 기록된 진행 이력이 없습니다.</div> : <div style={{ display: "grid", gap: 6 }}>{timeline.map((e, i) => <div key={i} style={{ display: "flex", gap: 8, fontSize: "calc(var(--s,1.3)*14px)" }}><span style={{ color: C.textM, minWidth: 86 }}>{(e.date || "").replace(/-/g, ".")}</span><span style={{ color: C.textS }}><b style={{ color: C.text }}>{e.type}</b>{e.memo ? ` · ${e.memo}` : ""}</span></div>)}</div>}
    </HubSection>
    <PrintModal open={!!pm} title={pm && pm.title} text={pm && pm.text} onClose={() => setPm(null)} />
  </div>;
}
function ymdAdd(days) { const d = new Date(); d.setDate(d.getDate() + (Number(days) || 0)); return dymd(d); }
function holdReasonAdvice(reason) {
  const M = { "가격 부담": "수임료 부담이 큰 것으로 추정됩니다. 우선순위 1개 항목부터 단계적으로 진행하는 방식이 부담을 낮출 가능성이 있어 보입니다.", "필요성 부족": "필요성 체감이 낮은 것으로 추정됩니다. 방치 시 부담을 숫자로 보여주는 접근이 도움이 될 수 있습니다.", "가족/세무사 상의 필요": "내부 상의가 필요한 상황으로 추정됩니다. 가족·세무사에게 보여줄 한 장 요약을 제공하는 방식을 권합니다.", "자금 여력 부족": "자금 여력이 부담인 것으로 추정됩니다. 시점을 조정하거나 비용 부담이 낮은 항목부터 제안하는 흐름을 권합니다.", "신뢰 형성 부족": "신뢰 형성 단계로 추정됩니다. 자료 공유·정보 제공으로 관계를 이어가는 접근이 필요해 보입니다.", "시급성 부족": "시급성 체감이 낮은 것으로 추정됩니다. 제도/공고 마감 등 타이밍 이슈를 환기하는 접근을 권합니다.", "타이밍 문제": "타이밍 이슈로 추정됩니다. 재접촉 시점을 명확히 잡아두는 것이 좋겠습니다.", "기타": "사유를 메모로 남기고 다음 연락 시점을 정해두는 것을 권합니다." };
  return M[reason] || M["기타"];
}
function holdReasonMessage(item) { const name = getCompanyName(item) || item.name; return `대표님, ${name} 관련해 지난번 말씀 주신 부분 잘 기억하고 있습니다. 부담 없이 진행하실 수 있도록 우선순위가 높은 항목부터 다시 정리해 보겠습니다. 자료 준비 상황에 따라 시점은 협의 후 정리하면 되니, 편하실 때 다시 말씀 나눠요.`; }
function manageMessage(item, kind) {
  const name = getCompanyName(item) || item.name;
  const B = { "최근 제도/공고 이슈 공유": "최근 관련 제도·공고 변화가 있어 공유드립니다. 바로 적용된다는 의미는 아니지만, 대표님 회사도 검토 가능성이 있어 보여 우선 점검을 권드립니다.", "세액공제/고용지원금 점검 안내": "세액공제·고용지원금 점검 시점이 있어 안내드립니다. 적용 여부는 세부 요건 확인이 필요합니다.", "정관/임원퇴직금 점검 안내": "정관·임원퇴직금 규정 점검이 필요한 시점이 있어 공유드립니다. 자료 확인 후 판단하시면 됩니다.", "정책자금/인증 이슈 공유": "정책자금·인증 관련 이슈가 있어 공유드립니다. 적용 여부는 재무·요건 점검 후 판단이 필요합니다.", "가벼운 안부/자료 공유": "잘 지내시죠? 도움이 될 만한 자료가 있어 가볍게 공유드립니다.", "재미팅 제안": "한 번 짧게 점검 미팅을 잡아보면 좋겠습니다. 편하신 시점 말씀 주시면 맞춰 보겠습니다." };
  return `대표님, ${name} 대표님께 ${B[kind] || B["가벼운 안부/자료 공유"]}`;
}
function referralAdvice(item) { if (item.dealResult === "계약" || item.stage === "contracted") { const done = (item.roadmap || []).some((r) => r.status === "완료"); return done ? "로드맵 1단계 완료·반응 양호 시 추가 컨설팅 제안과 소개 요청 타이밍으로 보입니다." : "계약 초기에는 진행 상황을 충실히 공유해 만족도를 쌓은 뒤 소개를 요청하는 흐름을 권합니다."; } return "계약 완료 후 일정 기간 경과·로드맵 1단계 완료·반응 양호 시 추가 제안/소개 타이밍을 권합니다."; }
function referralMessage(item) { const name = getCompanyName(item) || item.name; return `대표님, ${name} 진행 잘 도와드리고 있어 감사합니다. 혹시 주변에 비슷한 점검이 필요해 보이는 대표님이 계시면 가볍게 소개해 주셔도 좋겠습니다. 부담드리려는 건 아니고, 도움이 될 만한 부분만 우선 점검해 드리겠습니다.`; }
function buildTimeline(item) {
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
// ── 제안거리 연결 엔진(rule-based) — 교육/법령/콘텐츠 ↔ 고객 자동 연결 ──────────
const PROPOSAL_TOPICS = [
  { key: "employ", name: "고용지원금", kw: ["직원", "채용", "4대보험", "급여", "청년", "고용", "인원", "근로자"], cats: ["고용지원금"], pkgCats: ["자금/지원금", "복지/노무"], action: "고용지원금 재점검 안내" },
  { key: "fund", name: "정책자금", kw: ["자금", "보증", "대출", "운전자금", "시설자금", "신보", "기보", "중진공", "차입", "리파이낸싱"], cats: ["정책자금"], pkgCats: ["자금/지원금", "신용/보증/성장지원"], action: "정책자금 준비자료 안내" },
  { key: "rd", name: "연구소/인증", kw: ["연구소", "연구개발", "제조", "특허", "벤처", "메인비즈", "이노비즈", "ISO", "인증", "개발", "기술"], cats: ["연구소"], industries: ["제조업", "IT/소프트웨어"], pkgCats: ["인증/연구소", "지식재산/브랜딩"], action: "연구소/인증 가능성 점검" },
  { key: "tax", name: "세무/정관", kw: ["정관", "임원퇴직금", "법인세", "배당", "이익잉여금", "미처분", "가지급금", "가수금"], cats: ["정관정비", "법인세", "가지급금", "미처분이익잉여금"], pkgCats: ["세무/정관", "보험/퇴직금"], action: "정관/임원퇴직금 점검 연락" },
  { key: "succ", name: "승계/지분", kw: ["승계", "주식", "지분", "자녀", "가족", "가업승계", "주식가치", "2세"], cats: ["가업승계"], pkgCats: ["승계/지분"], action: "가업승계/주식가치 점검 안내" },
  { key: "labor", name: "노무/복지", kw: ["근로계약서", "취업규칙", "복지", "사내근로복지기금", "노무", "급여대장"], cats: [], pkgCats: ["복지/노무"], action: "노무/복지 점검 연락" },
  { key: "insure", name: "보험/대표 퇴직금", kw: ["대표 퇴직금", "법인보험", "목적자금", "월납", "퇴직연금"], cats: [], pkgCats: ["보험/퇴직금"], action: "대표 퇴직금/목적자금 점검" },
];
function topicMatchCustomer(c, topic) {
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
function classifyTopicsFromText(text) {
  const t = String(text || "");
  return PROPOSAL_TOPICS.filter((tp) => tp.kw.some((k) => t.includes(k)) || (tp.cats || []).some((c) => t.includes(c))).map((tp) => tp.key);
}
function relatedCustomersForTopic(data, topicKey, limit) {
  const topic = PROPOSAL_TOPICS.find((t) => t.key === topicKey); if (!topic) return [];
  const out = [];
  getUniqueCustomers(data).forEach((c) => { const m = topicMatchCustomer(c, topic); if (m.match) out.push({ c, reason: m.reason, score: m.score, topic }); });
  return out.sort((a, b) => b.score - a.score).slice(0, limit || 50);
}
function relatedTopicsForCustomer(item) {
  return PROPOSAL_TOPICS.map((tp) => ({ topic: tp, ...topicMatchCustomer(item, tp) })).filter((x) => x.match).sort((a, b) => b.score - a.score);
}
function topicKakao(c, topic) {
  const name = getCompanyName(c) || c.name || "대표님";
  return `${name} 대표님, 최근 ${topic.name} 관련 제도나 지원사업 변경사항이 있어 기존에 검토했던 부분을 다시 한번 점검해보면 좋을 것 같아 연락드렸습니다. 바로 결론을 내리기보다 자료 확인 후 적용 여부와 우선순위를 정리해보겠습니다. (적용 여부는 세부 요건 확인이 필요합니다.)`;
}
function topicPackages(topic, data) { const pkgs = getPackages(data); return pkgs.filter((p) => (topic.pkgCats || []).includes(p.cat)).slice(0, 3); }
function relatedMaterials(data, topicKey) {
  const laws = (data.lawUpdates || []).filter((u) => classifyTopicsFromText(`${u.title} ${u.field} ${u.summary || ""}`).includes(topicKey)).slice(0, 3);
  const edus = (data.educationItems || []).filter((e) => classifyTopicsFromText(`${e.title} ${e.field} ${e.keywords || ""}`).includes(topicKey)).slice(0, 3);
  const contents = CONTENT_SEEDS.filter((s) => classifyTopicsFromText(`${s.cat} ${s.title}`).includes(topicKey)).slice(0, 3);
  return { laws, edus, contents };
}
// 추천 고객 1명 카드(공용) — 이유·제안항목·카톡·다음연락·계약준비팩
function ProposalCustomerCard({ r, data, setData, goMeeting, onPrep }) {
  const c = r.c; const topic = r.topic; const kk = topicKakao(c, topic); const pkgs = topicPackages(topic, data);
  const saveNext = () => { updateCust(data, setData, c.id, { nextDate: c.nextDate || ymdAdd(3), nextAction: topic.action, memo: `${c.memo ? c.memo + "\n" : ""}[제안거리] ${topic.name} — ${topic.action}` }); showToast("다음 연락에 저장했습니다. (다음 연락 관리·고객 상세에 반영)"); };
  return <div style={{ background: C.bg, border: `1px solid ${C.bdr}`, borderRadius: 11, padding: 14 }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}><b style={{ fontSize: "calc(var(--s,1.3)*16px)" }}>{getCompanyName(c) || c.name}</b><Badge color={stageOf(c.stage).color} bg={stageOf(c.stage).bg}>{stageOf(c.stage).label}</Badge></div>
    <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*13px)", margin: "4px 0 6px" }}>{c.industry || "업종 미입력"} · 직원 {c.empCount || "-"}명 · 매출 {c.revenue ? wonFromMillion(c.revenue) : "미입력"}</div>
    <div style={{ color: C.textS, fontSize: "calc(var(--s,1.3)*14px)", lineHeight: 1.6 }}>· 왜 관련: {r.reason}</div>
    <div style={{ color: C.textS, fontSize: "calc(var(--s,1.3)*14px)", marginTop: 3 }}>· 제안 가능 항목: <b style={{ color: C.blue }}>{topic.name}</b>{pkgs[0] ? ` · ${pkgs[0].name}` : ""}</div>
    <div style={{ marginTop: 8, background: "#fff", border: `1px solid ${C.bdr}`, borderRadius: 8, padding: "8px 10px", color: C.textM, fontSize: "calc(var(--s,1.3)*12px)", lineHeight: 1.6, maxHeight: 60, overflow: "hidden" }}>{kk}</div>
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
      <button style={btnSm} onClick={() => copyText(kk, () => showToast("카톡 문구를 복사했습니다."))}>💬 카톡 복사</button>
      <button style={btnSm} onClick={saveNext}>📌 다음 연락에 저장</button>
      {onPrep && <button style={{ ...btnSm, color: C.blue, borderColor: C.blue }} onClick={() => onPrep(c.id)}>🎁 계약 준비팩</button>}
      {goMeeting && <button style={btnSm} onClick={() => goMeeting(c.id)}>미팅 준비</button>}
    </div>
  </div>;
}
// 자료(법령/교육/콘텐츠) → 관련 고객 블록(자체 계약 준비팩 모달 포함)
function RelatedTopicBlock({ data, setData, text, topicKey, title, goMeeting, limit }) {
  const [prepId, setPrepId] = useState(null);
  const keys = topicKey ? [topicKey] : classifyTopicsFromText(text);
  const map = new Map();
  keys.forEach((k) => relatedCustomersForTopic(data, k, 50).forEach((r) => { const ex = map.get(r.c.id); if (!ex || r.score > ex.score) map.set(r.c.id, r); }));
  const list = [...map.values()].sort((a, b) => b.score - a.score).slice(0, limit || 6);
  const topicNames = keys.map((k) => (PROPOSAL_TOPICS.find((t) => t.key === k) || {}).name).filter(Boolean);
  return <Card style={{ padding: 16, marginTop: 10 }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}><div style={{ fontWeight: 900, color: C.gold, fontSize: "calc(var(--s,1.3)*16px)" }}>🔗 {title || "관련 가능성 있는 고객"} ({list.length})</div>{topicNames.length ? <span style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*12px)" }}>분류 주제: {topicNames.join(", ")}</span> : null}</div>
    {list.length === 0 ? <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*14px)", lineHeight: 1.6 }}>관련 가능성이 보이는 고객이 아직 없습니다. 고객 정보(직원 수·관심사·메모)를 추가하면 자동으로 연결됩니다.</div> : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 10 }}>{list.map((r) => <ProposalCustomerCard key={r.c.id} r={r} data={data} setData={setData} goMeeting={goMeeting} onPrep={setPrepId} />)}</div>}
    <ContractPrepPack open={!!prepId} initialId={prepId} data={data} setData={setData} goMeeting={goMeeting} onClose={() => setPrepId(null)} />
  </Card>;
}
// 고객 상세 → 제안거리·연락거리(관련 주제·자료·상품·카톡)
function CustomerProposalIdeas({ item, data, setData, goMeeting }) {
  const [prepId, setPrepId] = useState(null);
  const topics = relatedTopicsForCustomer(item);
  if (!topics.length) return <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*14px)", lineHeight: 1.6 }}>관련 제안거리가 아직 분류되지 않았습니다. 관심사·직원 수·메모를 추가하면 자동으로 연결됩니다.</div>;
  return <div style={{ display: "grid", gap: 10 }}>
    {topics.slice(0, 5).map((x) => { const tp = x.topic; const mat = relatedMaterials(data, tp.key); const pkgs = topicPackages(tp, data); const kk = topicKakao(item, tp); const saveNext = () => { updateCust(data, setData, item.id, { nextDate: item.nextDate || ymdAdd(3), nextAction: tp.action, memo: `${item.memo ? item.memo + "\n" : ""}[제안거리] ${tp.name} — ${tp.action}` }); showToast("다음 연락에 저장했습니다."); }; return <div key={tp.key} style={{ background: C.bg, borderRadius: 11, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}><b style={{ fontSize: "calc(var(--s,1.3)*16px)", color: C.blue }}>{tp.name}</b><Badge color={C.gold} bg="#FCEFDA">제안거리</Badge></div>
      <div style={{ color: C.textS, fontSize: "calc(var(--s,1.3)*14px)", margin: "6px 0", lineHeight: 1.6 }}>· 관련 이유: {x.reason}</div>
      <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*13px)", lineHeight: 1.6 }}>· 연결 상품: {pkgs.map((p) => p.name).join(", ") || "관련 상품 확인 필요"}</div>
      {(mat.laws.length || mat.edus.length || mat.contents.length) ? <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*13px)", marginTop: 3, lineHeight: 1.6 }}>· 관련 자료: {[...mat.laws.map((l) => "📋 " + l.title), ...mat.edus.map((e) => "🎓 " + e.title), ...mat.contents.map((s) => "📣 " + s.cat)].slice(0, 3).join(" / ")}</div> : null}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}><button style={btnSm} onClick={() => copyText(kk, () => showToast("카톡 문구를 복사했습니다."))}>💬 카톡 복사</button><button style={btnSm} onClick={saveNext}>📌 다음 연락에 저장</button><button style={{ ...btnSm, color: C.blue, borderColor: C.blue }} onClick={() => setPrepId(item.id)}>🎁 계약 준비팩</button></div>
    </div>; })}
    {(() => { const tkeys = topics.map((x) => x.topic.key); const strats = TAX_STRATEGIES.filter((s) => tkeys.includes(s.topic)).slice(0, 3); if (!strats.length) return null; return <div style={{ background: C.bg, borderRadius: 11, padding: 14 }}>
      <div style={{ fontWeight: 800, color: C.gold, fontSize: "calc(var(--s,1.3)*15px)", marginBottom: 8 }}>📚 관련 절세전략</div>
      <div style={{ display: "grid", gap: 8 }}>{strats.map((s) => { const kk = strategyKakao(item, s); const saveNext = () => { updateCust(data, setData, item.id, { nextDate: item.nextDate || ymdAdd(3), nextAction: s.name, memo: `${item.memo ? item.memo + "\n" : ""}[제안거리] ${s.name}` }); showToast("다음 연락에 저장했습니다."); }; return <div key={s.id} style={{ background: "#fff", border: `1px solid ${C.bdr}`, borderRadius: 9, padding: "10px 12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}><b style={{ fontSize: "calc(var(--s,1.3)*15px)" }}>{s.name}</b><Badge color={C.warn} bg={C.warnBg}>세무사 검토 권장</Badge></div>
        <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*13px)", marginTop: 4, lineHeight: 1.6 }}>· 대표에게 물어볼 질문: {s.question}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}><button style={btnSm} onClick={() => copyText(kk, () => showToast("카톡 문구를 복사했습니다."))}>💬 카톡 복사</button><button style={btnSm} onClick={saveNext}>📌 다음 연락에 저장</button><button style={{ ...btnSm, color: C.blue, borderColor: C.blue }} onClick={() => setPrepId(item.id)}>🎁 계약 준비팩</button></div>
      </div>; })}</div>
    </div>; })()}
    <ContractPrepPack open={!!prepId} initialId={prepId} data={data} setData={setData} goMeeting={goMeeting} onClose={() => setPrepId(null)} />
  </div>;
}
// 오늘의 브리핑 → 오늘의 제안거리(주제별 관련 고객 수 + 우선 연락 3명)
function TodayProposalIdeas({ data, setData, goMeeting }) {
  const [openKey, setOpenKey] = useState(null);
  const [prepId, setPrepId] = useState(null);
  const baseRows = PROPOSAL_TOPICS.map((tp) => ({ key: tp.key, name: tp.name, tp, list: relatedCustomersForTopic(data, tp.key, 50) })).filter((x) => x.list.length).sort((a, b) => b.list.length - a.list.length).slice(0, 5);
  const stratRows = [["미처분이익잉여금 점검", "tax"], ["고용세액공제 점검", "employ"], ["연구개발비 세액공제 점검", "rd"]].map(([name, tk]) => ({ key: "s_" + name, name, tp: PROPOSAL_TOPICS.find((t) => t.key === tk), list: relatedCustomersForTopic(data, tk, 50) })).filter((x) => x.list.length);
  const rows = [...baseRows, ...stratRows].slice(0, 7);
  if (!rows.length) return null;
  return <Card style={{ padding: 18, marginBottom: 16, border: `1px solid ${C.gold}55` }}>
    <h3 style={{ margin: "0 0 10px", fontSize: "calc(var(--s,1.3)*18px)" }}>💡 오늘의 제안거리 <span style={{ color: C.textM, fontWeight: 600, fontSize: "calc(var(--s,1.3)*13px)" }}>(콘텐츠·교육·법령·절세전략 기반)</span></h3>
    <div style={{ display: "grid", gap: 8 }}>{rows.map(({ key, name, tp, list }) => { const top3 = list.slice(0, 3); const open = openKey === key; return <div key={key} style={{ background: C.bg, borderRadius: 11, padding: "12px 14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontSize: "calc(var(--s,1.3)*15px)", color: C.text }}><b style={{ color: C.blue }}>{name}</b> 점검 주제와 관련 가능성 있는 고객 <b>{list.length}</b>명</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><button style={btnSm} onClick={() => setOpenKey(open ? null : key)}>{open ? "접기" : "관련 고객 보기"}</button><button style={btnSm} onClick={() => copyText(topicKakao(top3[0].c, tp), () => showToast("카톡 문구를 복사했습니다."))}>카톡 복사</button></div>
      </div>
      <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*13px)", marginTop: 4 }}>우선 연락: {top3.map((r) => getCompanyName(r.c) || r.c.name).join(", ")}</div>
      {open && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 10, marginTop: 10 }}>{list.slice(0, 6).map((r) => <ProposalCustomerCard key={r.c.id} r={r} data={data} setData={setData} goMeeting={goMeeting} onPrep={setPrepId} />)}</div>}
    </div>; })}</div>
    <ContractPrepPack open={!!prepId} initialId={prepId} data={data} setData={setData} goMeeting={goMeeting} onClose={() => setPrepId(null)} />
  </Card>;
}
// ── 계약 준비팩 — 고객 1명 → 미팅 질문·제안 포인트·1페이지 진단·후속 카톡까지 한 번에 ──
function prepSufficiency(item) {
  let pts = 0;
  if (item.revenue) pts++; if (item.empCount) pts++; if (item.industry) pts++;
  if ((item.interests || []).length) pts++; if (item.concern || item.memo) pts++;
  if (item.netIncome) pts++; if (item.financialSummary) pts++;
  const level = pts >= 4 ? "충분" : pts >= 2 ? "보통" : "부족";
  return { level, pts, color: level === "충분" ? C.ok : level === "보통" ? C.warn : C.err, bg: level === "충분" ? C.greenBg : level === "보통" ? C.warnBg : C.redBg };
}
function prepBriefing(item) {
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
function prepQuestions(item) {
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
function prepPoints(item) {
  return topRecommendations(item).slice(0, 3).map((r) => ({ name: r.name, why: r.reason, ment: `대표님, ${r.name} 관련해서 ${(r.docs || []).slice(0, 2).join(", ") || "관련 자료"}를 먼저 확인해보고 검토 가능성과 우선순위를 정리드리겠습니다.`, docs: r.docs || [], caution: r.risk }));
}
const PREP_DOC_STATES = ["요청 전", "요청 완료", "수령 완료", "검토 완료"];
function prepDocs(item) {
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
function prepKakaos(item) {
  return [
    ["1차 미팅 후 감사·자료 요청", `대표님, 오늘 말씀 나눠주셔서 감사합니다. 말씀 주신 내용 기준으로 우선 점검할 항목을 정리해보겠습니다. 다음 자료를 확인해주시면 검토 가능성과 우선순위를 정리드리겠습니다. (자료 준비 상황에 따라 조정될 수 있습니다)`],
    ["2차 미팅 제안 안내", `대표님, 지난번 내용 바탕으로 우선 점검 항목을 정리했습니다. 자료 확인 후 검토 가능성과 진행 방향을 짧게 정리드리는 2차 미팅을 잡아보면 좋을 것 같습니다. 편하신 시점 알려주시면 일정 맞추겠습니다.`],
    ["보류 고객 재접촉", `대표님, 최근 제도나 지원사업 변경사항이 있어 기존에 검토했던 부분을 다시 한번 점검해보면 좋을 것 같아 연락드렸습니다. 부담 없이 현황만 가볍게 확인해보시죠. 자료 확인 후 우선순위만 정리드리겠습니다.`],
  ];
}
const PREP_NEXT_ACTIONS = ["자료 요청", "크레탑/재무자료 확인", "2차 미팅 일정 조율", "제안서 초안 작성", "고용지원금 별도 점검", "연구소/인증 가능성 검토", "정관/임원퇴직금 검토", "보류 고객 재접촉"];
function prepDiagText(item) {
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
// 재접촉 명분 리스트(오래된 연락/보류 등)
function recontactList(data) {
  const all = getUniqueCustomers(data);
  const out = [];
  all.forEach((c) => {
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
// 주 단위 체감 지표 카운터(localStorage)
function prepWeekKey() { const d = new Date(); const onejan = new Date(d.getFullYear(), 0, 1); const wk = Math.ceil(((d - onejan) / 86400000 + onejan.getDay() + 1) / 7); return `${d.getFullYear()}-W${wk}`; }
function bumpPrepStat(setData, key) { setData((d) => { const wk = prepWeekKey(); const ps = { ...(d.prepStats || {}) }; const w = { ...(ps[wk] || {}) }; w[key] = (w[key] || 0) + 1; ps[wk] = w; return { ...d, prepStats: ps }; }); }
function getPrepStats(data) { const wk = prepWeekKey(); return (data && data.prepStats && data.prepStats[wk]) || {}; }
function ContractPrepPack({ open, initialId, data, setData, goMeeting, setTab, onClose }) {
  const all = getUniqueCustomers(data);
  const [id, setId] = useState(initialId || (all[0] && all[0].id) || "");
  const [na, setNa] = useState({ date: ymdAdd(7), action: PREP_NEXT_ACTIONS[0], memo: "" });
  const opened = useRef(false);
  useEffect(() => { if (open) setId(initialId || (all[0] && all[0].id) || ""); }, [open, initialId]);
  const item = all.find((x) => x.id === id) || (all.length ? all[0] : null);
  useEffect(() => { if (open && !opened.current && item) { opened.current = true; bumpPrepStat(setData, "packs"); updateCust(data, setData, item.id, { prepPackCreatedAt: todayISO() }); } if (!open) opened.current = false; }, [open, item]);
  if (!open) return null;
  const acc = (key, title, defOpen, children) => <AccordionSection data={data} setData={setData} screenKey="prepPack" sectionKey={key} title={title} important={defOpen} defaultOpen={defOpen}>{children}</AccordionSection>;
  const copyK = (text) => copyText(text, () => { bumpPrepStat(setData, "kakao"); showToast("복사했습니다."); });
  const sec = { fontSize: "calc(var(--s,1.3)*15px)", color: C.textS, lineHeight: 1.7 };
  let body = null;
  if (item) {
    const suf = prepSufficiency(item); const points = prepPoints(item); const docs = prepDocs(item); const docState = item.prepDocs || {}; const qs = prepQuestions(item); const kakaos = prepKakaos(item);
    const cycle = (d) => { const cur = docState[d] || "요청 전"; const idx = PREP_DOC_STATES.indexOf(cur); const nx = PREP_DOC_STATES[(idx + 1) % PREP_DOC_STATES.length]; updateCust(data, setData, item.id, { prepDocs: { ...docState, [d]: nx } }); };
    const saveNext = () => { updateCust(data, setData, item.id, { nextDate: na.date || item.nextDate, nextAction: na.action, memo: na.memo ? `${item.memo ? item.memo + "\n" : ""}[다음 액션] ${na.memo}` : item.memo }); bumpPrepStat(setData, "nextSaved"); showToast("고객 다음 액션·다음 연락일을 저장했습니다."); };
    body = <>
      <Card style={{ padding: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "end", marginBottom: 10 }}><div><Label>고객 선택</Label><select style={inp} value={id} onChange={(e) => setId(e.target.value)}>{all.map((x) => <option key={x.id} value={x.id}>{getCompanyName(x) || x.name}</option>)}</select></div><Badge color={suf.color} bg={suf.bg}>데이터 {suf.level}</Badge></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", color: C.textM, fontSize: "calc(var(--s,1.3)*14px)" }}><span>{item.industry || "업종 미입력"}</span><span>· 매출 {item.revenue ? wonFromMillion(item.revenue) : "미입력"}</span><span>· 직원 {item.empCount || "-"}명</span><span>· 단계 {stageOf(item.stage).label}</span><span>· 다음 연락 {item.nextDate || "미정"}</span></div>
        {suf.level === "부족" && <div style={{ marginTop: 10, background: C.warnBg, border: `1px solid ${C.warn}40`, borderRadius: 9, padding: "8px 10px", color: C.textS, fontSize: "calc(var(--s,1.3)*13px)", lineHeight: 1.6 }}>정보가 부족해 일부 항목은 질문형으로 표시됩니다. 크레탑 요약, 직원 수, 대표 관심사를 추가하면 더 구체적으로 정리됩니다.</div>}
      </Card>
      {acc("brief", "1. 미팅 전 브리핑", true, <div>{item.cretopCore ? <div style={{ marginBottom: 10, border: `1px solid ${C.gold}40`, borderRadius: 10, padding: 12, background: "#FFFCF5" }}><div style={{ fontWeight: 800, color: C.gold, fontSize: "calc(var(--s,1.3)*14px)", marginBottom: 8 }}>🔢 크레탑 핵심지표 요약 (저장됨 · 원문 확인 필요)</div><CretopCoreView core={item.cretopCore} /></div> : null}<pre style={{ whiteSpace: "pre-wrap", fontFamily: FF, ...sec, margin: 0 }}>{prepBriefing(item)}</pre><button style={{ ...btnSm, marginTop: 8 }} onClick={() => copyText(prepBriefing(item), () => showToast("복사했습니다."))}>브리핑 복사</button></div>)}
      {acc("diag", "4. 대표용 1페이지 진단", false, <div style={{ border: `2px solid ${C.gold}55`, borderRadius: 12, padding: 16, background: "#FFFCF5" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}><b style={{ color: C.gold, fontSize: "calc(var(--s,1.3)*16px)" }}>📄 대표용 1페이지 진단</b><div style={{ display: "flex", gap: 6 }}><button style={btnSm} onClick={() => copyText(prepDiagText(item), () => showToast("복사했습니다."))}>복사</button><button style={btnSm} onClick={() => { try { window.print(); } catch (e) {} }}>인쇄</button></div></div>
        <div style={{ color: C.text, fontWeight: 700, fontSize: "calc(var(--s,1.3)*15px)", marginBottom: 8 }}>대표님 회사는 현재 아래 항목을 우선 점검해볼 수 있습니다.</div>
        {item.cretopCore ? <div style={{ marginBottom: 10, borderBottom: `1px dashed ${C.bdr}`, paddingBottom: 10 }}><CretopCoreView core={item.cretopCore} /></div> : null}
        <div style={{ display: "grid", gap: 8 }}>
          <div style={sec}><b>1. 회사 기본 요약</b> · {item.industry || "업종 미입력"} · 매출 {item.revenue ? wonFromMillion(item.revenue) : "미입력"} · 직원 {item.empCount || "-"}명 · 업력 {item.estYears || "-"}년</div>
          <div style={sec}><b>2. 현재 우선 점검 항목</b><div style={{ display: "grid", gap: 4, marginTop: 4 }}>{points.map((p, i) => <div key={i}>· {i + 1}) {p.name} <span style={{ color: C.textM }}>— {p.why}</span></div>)}</div></div>
          <div style={sec}><b>3. 놓치기 쉬운 리스크</b> · {item.concern || "정관·임원규정·자금거래 정리 여부는 자료 확인 후 판단이 필요합니다."}</div>
          <div style={sec}><b>4. 추가 확인자료</b> · {docs.slice(0, 5).join(", ")}</div>
          <div style={sec}><b>5. 다음 미팅 방향</b> · 위 자료를 기준으로 1차 검토를 진행하고, 검토 가능성과 우선순위를 정리드리겠습니다.</div>
        </div>
        <div style={{ marginTop: 10, color: C.textM, fontSize: "calc(var(--s,1.3)*12px)", lineHeight: 1.6 }}>정확한 판단은 자료 확인 후 정리드리겠습니다. 적용 여부는 세부 요건 확인이 필요하며, 세무·보험 관련은 세무사 검토를 권장합니다.</div>
      </div>)}
      {acc("q", "2. 오늘 물어볼 질문 10개", false, <div style={{ display: "grid", gap: 6 }}><button style={{ ...btnSm, justifySelf: "start", marginBottom: 4 }} onClick={() => copyText(qs.map((q, i) => `${i + 1}. [${q[0]}] ${q[1]}`).join("\n"), () => showToast("질문 10개를 복사했습니다."))}>질문 전체 복사</button>{qs.map((q, i) => <div key={i} style={{ background: C.bg, borderRadius: 9, padding: "9px 12px" }}><Badge color={C.blue} bg={C.blueBg}>{q[0]}</Badge><div style={{ marginTop: 4, color: C.textS, fontSize: "calc(var(--s,1.3)*15px)", lineHeight: 1.55 }}>{i + 1}. {q[1]}</div></div>)}</div>)}
      {acc("points", "3. 우선 제안 포인트 TOP 3", false, <div style={{ display: "grid", gap: 10 }}>{points.map((p, i) => <div key={i} style={{ background: C.bg, borderRadius: 11, padding: 14 }}><b style={{ fontSize: "calc(var(--s,1.3)*16px)" }}>{i + 1}. {p.name}</b><div style={{ ...sec, marginTop: 6 }}>· 왜 지금: {p.why}</div><div style={{ ...sec, marginTop: 3 }}>· 대표 멘트: {p.ment}</div><div style={{ ...sec, marginTop: 3 }}>· 필요자료: {(p.docs || []).join(", ") || "관련 자료 확인 필요"}</div><div style={{ color: C.warn, fontSize: "calc(var(--s,1.3)*14px)", marginTop: 3, lineHeight: 1.6 }}>· 주의: {p.caution}</div><button style={{ ...btnSm, marginTop: 8 }} onClick={() => copyText(`[${p.name}] ${p.ment}`, () => showToast("대표 멘트를 복사했습니다."))}>대표 멘트 복사</button></div>)}</div>)}
      {acc("docs", "5. 요청자료 체크리스트", false, <div style={{ display: "grid", gap: 6 }}>{docs.map((d) => { const st = docState[d] || "요청 전"; const col = st === "검토 완료" ? C.ok : st === "수령 완료" ? C.blue : st === "요청 완료" ? C.warn : C.textM; return <button key={d} onClick={() => cycle(d)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, textAlign: "left", background: C.bg, border: "1px solid " + C.bdr, borderRadius: 10, padding: "9px 12px", cursor: "pointer", fontFamily: FF, fontSize: "calc(var(--s,1.3)*15px)", color: C.text }}><span>{d}</span><Badge color={col} bg={st === "요청 전" ? "#EEF2F7" : col + "22"}>{st}</Badge></button>; })}<button style={{ ...btnSm, justifySelf: "start", marginTop: 4 }} onClick={() => copyText("요청 자료\n" + docs.map((d) => "· " + d).join("\n"), () => showToast("요청자료 목록을 복사했습니다."))}>요청자료 목록 복사</button></div>)}
      {acc("kakao", "6. 미팅 후 보낼 카톡 문구 3종", false, <div style={{ display: "grid", gap: 10 }}>{kakaos.map((k, i) => <div key={i} style={{ background: C.bg, borderRadius: 11, padding: 12 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}><b style={{ fontSize: "calc(var(--s,1.3)*15px)" }}>{i + 1}. {k[0]}</b><button style={btnSm} onClick={() => copyK(k[1])}>복사</button></div><div style={{ ...sec, marginTop: 6 }}>{k[1]}</div></div>)}</div>)}
      {acc("next", "7. 다음 액션 / 다음 연락일", false, <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}><div><Label>다음 연락일</Label><input type="date" style={inp} value={na.date} onChange={(e) => setNa({ ...na, date: e.target.value })} /></div><div><Label>다음 액션</Label><select style={inp} value={na.action} onChange={(e) => setNa({ ...na, action: e.target.value })}>{PREP_NEXT_ACTIONS.map((a) => <option key={a}>{a}</option>)}</select></div></div>
        <div><Label>액션·담당자 메모</Label><input style={inp} value={na.memo} onChange={(e) => setNa({ ...na, memo: e.target.value })} placeholder="예: 4대보험 명부 수령 후 고용지원금 별도 점검" /></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button style={btnP} onClick={saveNext}>💾 고객 다음 액션에 저장</button><button style={btnS} onClick={() => copyK(kakaos[0][1])}>카톡 문구 복사</button><button style={btnS} onClick={() => { onClose && onClose(); goMeeting && goMeeting(item.id); }}>🤝 미팅 준비 화면으로</button>{setTab && <button style={btnS} onClick={() => { onClose && onClose(); setTab("reports"); }}>📄 제안서/견적으로</button>}</div>
      </div>)}
    </>;
  }
  return <Modal open={open} onClose={onClose} title="🎁 계약 준비팩" width={920}>
    {all.length === 0 ? <Card style={{ padding: 30, textAlign: "center" }}><p style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*16px)", lineHeight: 1.7, marginBottom: 14 }}>아직 고객이 없습니다. 고객 1명을 등록하면 계약 준비팩(미팅 질문·제안 포인트·1페이지 진단·후속 카톡)을 만들 수 있습니다.</p><SampleCTA data={data} setData={setData} /></Card> : <div style={{ display: "grid", gap: 12 }}>{body}</div>}
  </Modal>;
}
// 저장된 크레탑 핵심지표 표시(고객 상세·계약 준비팩·미팅 준비 공용, 읽기 전용)
function CretopCoreView({ core }) {
  if (!core || !core.confirmedMetrics) return null;
  const cm = core.confirmedMetrics; const keys = CORE_PREVIEW_ORDER.filter((k) => cm[k]); const mp = core.meetingPoints || {};
  return <div style={{ display: "grid", gap: 10 }}>
    <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*12px)" }}>저장 {core.savedAt || ""} · 출처 크레탑 · 모두 ‘후보’이며 원문 기준 확인 필요</div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 6 }}>{keys.map((k) => { const m = cm[k]; const val = m.isGrade ? m.value : (m.eok != null ? cretopEokText(m.eok) : `${m.value}${m.unit || ""}`); return <div key={k} style={{ padding: "7px 10px", background: "#fff", borderRadius: 8, border: `1px solid ${C.bdr}` }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 6, alignItems: "baseline" }}><span style={{ color: C.textS, fontSize: "calc(var(--s,1.3)*13px)", fontWeight: 700 }}>{m.label}{m.year ? <span style={{ color: C.textM, fontWeight: 400 }}> ({m.year})</span> : null}</span><span style={{ fontSize: "calc(var(--s,1.3)*14px)", fontWeight: 800, color: C.text, textAlign: "right" }}>{val}</span></div>
    <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*10px)", marginTop: 2 }}>{m.status} · 원문 확인 필요</div>
  </div>; })}</div>
    {(core.company && core.company.companyName) || core.cashflowGrade || (core.external && (core.external.certNames || []).length) ? <div style={{ border: `1px solid ${C.bdr}`, borderRadius: 10, padding: 12, fontSize: "calc(var(--s,1.3)*12px)", color: C.textS, lineHeight: 1.6 }}>
      <div style={{ fontWeight: 800, color: C.text, fontSize: "calc(var(--s,1.3)*14px)", marginBottom: 4 }}>🏢 기업개요</div>
      {core.company ? <div>{core.company.companyName || "(기업명 미감지)"}{core.company.standardIndustry || core.company.industry ? ` · ${core.company.standardIndustry || core.company.industry}` : ""}{core.company.employees ? ` · 종업원 ${core.company.employees}명` : ""}</div> : null}
      {core.cashflowGrade ? <div>현금흐름등급: {core.cashflowGrade.series ? core.cashflowGrade.series.join(" → ") : core.cashflowGrade.latest}</div> : null}
      {core.external && (((core.external.certNames || []).length) || (core.external.ip && core.external.ip.some((x) => x.count != null)) || (core.external.bid && (core.external.bid.tenders || core.external.bid.wins))) ? <div>신뢰도·외부정보: {[(core.external.certNames || []).length ? "인증 " + core.external.certNames.join("·") : "", (core.external.ip || []).filter((x) => x.count != null).map((x) => `${x.name} ${x.text}`).join(",") || "", core.external.bid && core.external.bid.tenders ? `입찰 ${core.external.bid.tenders}건` : ""].filter(Boolean).join(" / ")} <span style={{ color: C.textM }}>(원문 기준 참고용)</span></div> : null}
    </div> : null}
    {core.trends && Object.keys(core.trends).length ? (() => { const dirCol = (d) => d === "상승" ? C.ok : d === "하락" ? C.err : C.textM; const fmt = (v, u) => v == null ? "—" : `${(Math.round(v * 100) / 100).toLocaleString()}${u === "억원" ? "억" : (u || "")}`; return <div style={{ border: `1px solid ${C.bdr}`, borderRadius: 10, padding: 12 }}><div style={{ fontWeight: 800, color: C.text, fontSize: "calc(var(--s,1.3)*14px)", marginBottom: 6 }}>📈 3개년 핵심 추이</div><div style={{ display: "grid", gap: 5 }}>{Object.keys(core.trends).map((k) => { const t = core.trends[k]; return <div key={k} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "baseline", fontSize: "calc(var(--s,1.3)*12px)" }}><span style={{ fontWeight: 700, color: C.textS, minWidth: 92 }}>{t.label}</span><span style={{ color: C.textS }}>{t.series.map((s) => `${s.year || "?"} ${fmt(s.val, t.unit)}`).join("  ·  ")}</span>{t.deltaAbs != null ? <span style={{ marginLeft: "auto", fontWeight: 800, color: dirCol(t.dir) }}>{t.dir} {t.deltaAbs > 0 ? "+" : ""}{fmt(t.deltaAbs, t.unit)}{t.deltaPct != null ? ` / ${t.deltaPct > 0 ? "+" : ""}${t.deltaPct}${t.pUnit}` : ""}</span> : null}</div>; })}</div></div>; })() : null}
    {core.ratioAreas && core.ratioAreas.some((a) => a.metrics.some((mm) => mm.latest != null)) ? <div style={{ border: `1px solid ${C.bdr}`, borderRadius: 10, padding: 12 }}><div style={{ fontWeight: 800, color: C.text, fontSize: "calc(var(--s,1.3)*14px)", marginBottom: 6 }}>📊 재무비율 5개 영역</div><div style={{ display: "grid", gap: 6 }}>{core.ratioAreas.map((a) => <div key={a.key} style={{ fontSize: "calc(var(--s,1.3)*12px)", lineHeight: 1.5 }}><b style={{ color: C.blue }}>{a.name}</b> <span style={{ color: C.textS }}>{a.metrics.filter((mm) => mm.latest != null).map((mm) => `${mm.label} ${mm.latest}${mm.unit || ""}`).join(" · ") || "원문 확인 필요"}</span></div>)}</div></div> : null}
    {(mp.topPoints || []).length ? <div style={{ background: "#FFFCF5", border: `1px solid ${C.gold}55`, borderRadius: 10, padding: 12 }}><div style={{ fontWeight: 800, color: C.gold, fontSize: "calc(var(--s,1.3)*14px)", marginBottom: 6 }}>🎯 1차 미팅 포인트 TOP{(mp.topPoints || []).length}</div><div style={{ display: "grid", gap: 4 }}>{mp.topPoints.map((t, i) => <div key={i} style={{ color: C.textS, fontSize: "calc(var(--s,1.3)*13px)", lineHeight: 1.5 }}>· {t}</div>)}</div></div> : null}
  </div>;
}
// 크레탑 핵심지표 점검 패널(모달) — 추출 → 미리보기 → 미팅포인트 → 확인 테이블 → 저장
function CretopCoreCheck({ open, initialRaw, existingCore, fileName, onSave, onClose, onApplyToCustomer, applyLabel }) {
  const seed0 = () => String(initialRaw || (existingCore && existingCore.rawTextSummary) || "");
  const [input, setInput] = useState(seed0);
  const [core, setCore] = useState(() => { const s = seed0(); return open && s.trim() ? extractCretopCore(s) : null; });
  const [rows, setRows] = useState(() => { const s = seed0(); return open && s.trim() ? extractCretopCore(s).rows : null; });
  const [selLi, setSelLi] = useState(null);
  const [openRows, setOpenRows] = useState({});
  const [openSec, setOpenSec] = useState({});   // 핵심지표 미리보기만 항상 노출 · 1차 미팅/추이/5영역/상세/디버그는 기본 접힘(원할 때 펼침)
  const [showHelp, setShowHelp] = useState(false);
  const [manualGrade, setManualGrade] = useState("");   // 신용등급 직접 입력(화면 즉시 반영)
  const [weapons, setWeapons] = useState([]);   // 1차 미팅 추가 제안 포인트 선택(내부 state)
  const [weaponsOpen, setWeaponsOpen] = useState(true);
  const toggleRow = (id) => setOpenRows((o) => ({ ...o, [id]: !o[id] }));
  const secToggle = (k) => setOpenSec((o) => ({ ...o, [k]: !o[k] }));
  useEffect(() => { if (open) { const s = seed0(); setInput(s); setSelLi(null); setOpenRows({}); setManualGrade(""); setWeapons([]); if (s.trim()) { const c = extractCretopCore(s); setCore(c); setRows(c.rows); } else { setCore(null); setRows(null); } } }, [open, initialRaw]);
  if (!open) return null;
  const runEx = (text) => { const c = extractCretopCore(String(text || "")); setCore(c); setRows(c.rows); setSelLi(null); if (!c.rows.length) showToast("핵심지표 후보를 찾지 못했습니다. 크레탑 표 텍스트를 복사해 붙여넣어 다시 시도해주세요."); else showToast(`핵심지표 후보 ${c.rows.length}건을 추출했습니다. 원문 확인 후 저장해주세요. (모두 ‘후보’)`); };
  const update = (id, patch) => setRows((rs) => (rs || []).map((r) => r.id === id ? { ...r, ...patch } : r));
  const del = (id) => setRows((rs) => (rs || []).filter((r) => r.id !== id));
  const addRow = () => setRows((rs) => [...(rs || []), { id: `n${Date.now()}`, accountKey: "", account: "", isGrade: false, isRatio: false, rawValue: "", unit: "백만원", year: "", lineIndex: -1, contextLines: [], status: "검수 필요", confidence: "직접", section: "직접입력", sel: false }]);
  // ── 실제 화면이 쓰는 단일 최종 데이터 객체(detectedCandidates 직접 참조 금지) ── (pts보다 먼저: 미팅 포인트 비율 판단에 계산값 사용)
  const ui = (core && rows && rows.length) ? buildCretopParsedForUi(input) : null;
  const pts = rows ? buildCretopMeetingPoints(rows, core ? core.company : {}, core ? core.external : {}, ui ? ui.corePreview : null) : null;
  const cnt = (st) => (rows || []).filter((r) => r.status === st).length;
  const eokOf = (r) => r.isGrade ? "-" : extractEokText(r);
  const stColor = (st) => st === "적용 후보" ? C.ok : st === "오류 의심" ? C.err : st === "제외" ? C.textM : "#C77700";
  const stBg = (st) => st === "적용 후보" ? "#EAF7EE" : st === "오류 의심" ? "#FDECEC" : st === "제외" ? "#F2F2F2" : "#FFF7E6";
  const cellInp = (w) => ({ width: w, maxWidth: w, padding: "4px 6px", border: `1px solid ${C.bdr}`, borderRadius: 6, fontFamily: FF, fontSize: "calc(var(--s,1.3)*12px)", color: C.text, background: "#fff" });
  const cellSel = { padding: "4px 4px", border: `1px solid ${C.bdr}`, borderRadius: 6, fontFamily: FF, fontSize: "calc(var(--s,1.3)*12px)", background: "#fff" };
  const th = { padding: "6px 8px", fontSize: "calc(var(--s,1.3)*11px)", color: C.textM, fontWeight: 800, textAlign: "left", whiteSpace: "nowrap", borderBottom: `1px solid ${C.bdr}`, background: C.bg, position: "sticky", top: 0 };
  const td = { padding: "4px 8px", borderBottom: `1px solid ${C.bdr}`, verticalAlign: "middle", whiteSpace: "nowrap" };
  const cardLbl = { display: "inline-flex", alignItems: "center", gap: 4, fontSize: "calc(var(--s,1.3)*11px)", color: C.textM, fontWeight: 700 };
  const doSave = () => { const sel = (rows || []).filter((r) => r.sel && r.status !== "제외"); if (!sel.length) { showToast("저장할 지표를 선택해주세요. (카드에서 체크)"); return; } const cm = {}; sel.forEach((r) => { cm[r.accountKey || r.id] = { label: r.account, value: r.rawValue, unit: r.unit, eok: r.isGrade ? null : extractRowEok(r), year: r.year, status: r.status, isGrade: !!r.isGrade, line: r.lineIndex }; });
    const trends = {}; CORE_TREND_ORDER.forEach((k) => { const r = groups.primary[k]; const t = r ? cretopRowTrend(r) : null; if (t && t.series.length >= 2) trends[k] = { label: CORE_LABELS[k] || k, series: t.series.map((s) => ({ year: s.year, val: s.val })), latest: t.latest ? t.latest.val : null, deltaAbs: t.deltaAbs, deltaPct: t.deltaPct, dir: t.dir, unit: t.unit, pUnit: t.pUnit }; });
    const ratioAreas = CRETOP_RATIO_AREAS.map((a) => ({ key: a.key, name: a.name, hint: a.hint, metrics: a.metrics.map((k) => { const r = groups.primary[k]; const t = r ? cretopRowTrend(r) : null; return { label: CORE_LABELS[k] || k, rawLabel: r ? r.rawLabel : null, series: t ? t.series.map((s) => s.val) : [], latest: r ? Number(r.rawValue) : null, unit: r ? (r.unit || "") : "", dir: t ? t.dir : null, deltaAbs: t ? t.deltaAbs : null, pUnit: t ? t.pUnit : "%" }; }) }));
    const cfRow = (rows || []).find((r) => r.accountKey === "cashflowGrade");
    const cashflowGrade = cfRow ? { latest: cfRow.rawValue, series: cfRow.gradeSeries || null } : null;
    onSave && onSave({ confirmedMetrics: cm, company: Object.assign({}, core ? core.company : {}, manualGrade ? { creditGradeManual: manualGrade } : {}), external: core ? core.external : null, cashflowGrade, creditGradeManual: manualGrade || "", meetingPoints: pts, trends, ratioAreas, rawTextSummary: String(input).slice(0, 800), source: "cretop", savedAt: todayISO() }); showToast("확인한 핵심지표를 고객 정보에 저장했습니다."); onClose && onClose(); };
  const debugBtn = () => { if (!core) { showToast("먼저 원문을 넣고 추출해주세요."); return; } copyText(cretopCoreDebug({ ...core, rows }, pts, fileName), () => showToast("실패 분석용 디버그를 복사했습니다. (원문 일부 포함 — 외부 공유 전 확인)")); };
  const applyToCustomer = () => { if (!ui) { showToast("먼저 원문을 넣고 추출해주세요."); return; } if (!onApplyToCustomer) return; const patch = buildCretopCustomerPatch(ui, pts, weapons, manualGrade); onApplyToCustomer(patch); };
  const visible = rows || [];
  const groups = rows ? selectBestCretopCoreCandidates(rows) : { recommended: [], alternates: [], review: [], excluded: [], primary: {} };
  const dlines = core && core.debug ? core.debug.lines : [];
  const renderCard = (r) => { const opn = !!openRows[r.id]; const cfColor2 = r.confidence === "높음" ? C.ok : r.confidence === "낮음" ? C.err : C.warn; return <div key={r.id} style={{ border: `1px solid ${C.bdr}`, borderLeft: `4px solid ${stColor(r.status)}`, borderRadius: 10, background: stBg(r.status), padding: "8px 10px", maxWidth: "100%", boxSizing: "border-box" }}>
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
      <input type="checkbox" checked={!!r.sel} onChange={(e) => update(r.id, { sel: e.target.checked })} title="저장 대상 선택" />
      <span style={{ fontWeight: 800, color: C.text, fontSize: "calc(var(--s,1.3)*14px)" }}>{r.account || "(미지정)"}</span>
      <span style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*12px)" }}>{r.isGrade ? "등급" : (r.rawValue == null || r.rawValue === "" ? "—" : `${r.rawValue}${r.isRatio ? (r.unit || "") : ""}`)}</span>
      {!r.isGrade ? <span style={{ fontWeight: 800, color: r.isRatio ? C.blue : C.text, fontSize: "calc(var(--s,1.3)*14px)" }}>{eokOf(r)}</span> : null}
      {r.year ? <span style={{ fontSize: "calc(var(--s,1.3)*11px)", color: C.textM, background: "#fff", border: `1px solid ${C.bdr}`, borderRadius: 6, padding: "1px 6px" }}>{r.year}년 기준</span> : null}
      <span style={{ fontSize: "calc(var(--s,1.3)*11px)", fontWeight: 800, color: "#fff", background: stColor(r.status), borderRadius: 6, padding: "2px 7px" }}>{r.status}</span>
      <span style={{ fontSize: "calc(var(--s,1.3)*10px)", color: C.textM }}>L{r.lineIndex}</span>
      <span style={{ fontSize: "calc(var(--s,1.3)*11px)", fontWeight: 800, color: cfColor2, border: `1px solid ${cfColor2}66`, borderRadius: 6, padding: "1px 6px" }}>{r.confidence}</span>
      <button onClick={() => toggleRow(r.id)} style={{ ...btnSm, marginLeft: "auto", padding: "3px 9px", background: opn ? C.blue : "#fff", color: opn ? "#fff" : C.textS }}>{opn ? "접기" : "상세 보기"}</button>
    </div>
    {opn ? <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${C.bdr}`, display: "grid", gap: 8 }}>
      <div style={{ fontSize: "calc(var(--s,1.3)*11px)", color: C.textM, lineHeight: 1.6, wordBreak: "break-all" }}>
        <div><b style={{ color: C.textS }}>원문 라인</b> · L{r.lineIndex}: {r.rowText || "-"}</div>
        {r.normLine && r.normLine !== r.rowText ? <div><b style={{ color: C.textS }}>정규화 라인</b> · {r.normLine}</div> : null}
        <div><b style={{ color: C.textS }}>원문 섹션</b> · {r.section || "-"}</div>
        <div><b style={{ color: C.textS }}>후보 배열</b> · [{(r.numberCandidates || []).join(", ") || "없음"}]</div>
        <div><b style={{ color: C.textS }}>판단 이유</b> · {r.selectedReason || "-"}</div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <label style={cardLbl}>지표명<input value={r.account} onChange={(e) => update(r.id, { account: e.target.value })} style={cellInp(120)} /></label>
        {!r.isGrade ? <label style={cardLbl}>후보값<input value={r.rawValue == null ? "" : r.rawValue} onChange={(e) => update(r.id, { rawValue: e.target.value })} style={cellInp(90)} /></label> : null}
        {!r.isGrade ? <label style={cardLbl}>단위<select value={r.unit || "확인 필요"} onChange={(e) => update(r.id, { unit: e.target.value === "확인 필요" ? "" : e.target.value })} style={cellSel}>{EXTRACT_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</select></label> : null}
        <label style={cardLbl}>기준연도<input value={r.year == null ? "" : r.year} onChange={(e) => update(r.id, { year: e.target.value === "" ? null : e.target.value })} style={cellInp(60)} /></label>
        <label style={cardLbl}>상태<select value={r.status} onChange={(e) => update(r.id, { status: e.target.value })} style={{ ...cellSel, color: stColor(r.status), fontWeight: 700 }}>{EXTRACT_STATUS.map((st) => <option key={st} value={st}>{st}</option>)}</select></label>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={() => setSelLi(r.lineIndex)} style={{ ...btnSm }} disabled={r.lineIndex < 0}>📍 원문에서 보기</button>
        <button onClick={() => del(r.id)} style={{ ...btnSm, color: C.err, borderColor: `${C.err}66` }}>✕ 삭제</button>
      </div>
    </div> : null}
  </div>; };
  const renderSec = (key, title, list, color) => list.length ? <div style={{ border: `1px solid ${C.bdr}`, borderRadius: 10, overflow: "hidden" }}>
    <button onClick={() => secToggle(key)} style={{ width: "100%", textAlign: "left", border: "none", background: openSec[key] ? "#F5F7FA" : "#fff", cursor: "pointer", padding: "9px 12px", fontFamily: FF, fontWeight: 800, fontSize: "calc(var(--s,1.3)*13px)", color: color || C.textS, display: "flex", alignItems: "center", gap: 6 }}>{openSec[key] ? "▾" : "▸"} {title} <span style={{ color: C.textM, fontWeight: 700 }}>({list.length})</span></button>
    {openSec[key] ? <div style={{ padding: 8, display: "grid", gap: 8, maxHeight: 360, overflowY: "auto", overflowX: "hidden", borderTop: `1px solid ${C.bdr}` }}>{list.map(renderCard)}</div> : null}
  </div> : null;
  return <Modal open={open} onClose={onClose} title="🔢 크레탑 핵심지표 점검" width={980}>
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ color: C.textS, fontSize: "calc(var(--s,1.3)*13px)", lineHeight: 1.55 }}>PDF 원문에서 핵심지표 <b>후보</b>를 추출합니다. 저장 전 숫자와 원문을 확인하세요.</div>
      <div><Label>크레탑 원문 (PDF 추출 텍스트 붙여넣기)</Label><textarea style={{ ...inp, height: 96, resize: "vertical", fontFamily: "ui-monospace, Menlo, monospace", fontSize: "calc(var(--s,1.3)*12px)" }} value={input} onChange={(e) => setInput(e.target.value)} placeholder={"크레탑 보고서 원문을 붙여넣으세요."} /></div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button style={btnP} onClick={() => runEx(input)}>🔢 핵심지표 후보 추출</button>
        {String(initialRaw || "").trim() ? <button style={btnS} onClick={() => { setInput(String(initialRaw || "")); runEx(String(initialRaw || "")); }}>📄 PDF에서 추출한 원문 불러오기</button> : null}
        <button style={btnS} onClick={() => { setInput(CRETOP_CORE_SAMPLE); runEx(CRETOP_CORE_SAMPLE); }}>🧪 가상 샘플 넣기</button>
        <button style={{ ...btnS, color: C.textM }} onClick={() => { setInput(""); setCore(null); setRows(null); setSelLi(null); }}>↺ 원문 초기화</button>
      </div>
      {ui && ui.companyInfo && (ui.companyInfo.companyName || ui.companyInfo.industry || ui.companyInfo.employees) ? (() => { const co = ui.companyInfo; const cg = manualGrade || co.creditGrade; const needGrade = !manualGrade && (!co.creditGrade || co.creditGrade === "이미지 원문 확인 필요"); const cfG = co.cashflowGrade; const cfInfo = cfG ? cretopCashflowGradeInfo(cfG.latest) : null;
        const rowsInfo = []; const add2 = (k, v) => { if (v) rowsInfo.push([k, v]); };
        add2("사업자번호", co.businessNo); add2("법인번호", co.corpRegNo); add2("대표자", co.ceoName); add2("종업원", co.employees ? co.employees + "명" : ""); add2("설립일", co.established); add2("결산월", co.settleMonth ? co.settleMonth + "월" : ""); add2("기업유형", co.corpType); add2("기업규모", co.scale); add2("주소", co.address);
        add2("표준산업분류 10차", co.industry10 || co.stdIndustry10); add2("표준산업분류 11차", co.industry11 || co.stdIndustry11); if (!(co.industry10 || co.stdIndustry10 || co.industry11 || co.stdIndustry11)) add2("표준산업분류", co.standardIndustry || co.industry); add2("주요제품", co.mainProduct);
        const certRows = [["벤처", "venture"], ["이노비즈", "innobiz"], ["메인비즈", "mainbiz"], ["연구개발전담부서", "rndDept"], ["부설연구소", "rndLab"]];
        const ipRows = [["특허", "patent"], ["실용신안", "utility"], ["디자인", "design"], ["상표권", "trademark"]];
        return <div style={{ border: `1px solid ${C.bdr}`, borderRadius: 12, padding: 12, background: "#fff" }}>
        <div style={{ fontSize: "calc(var(--s,1.3)*18px)", fontWeight: 900, color: C.text }}>🏢 {co.companyName || "(기업명 원문 확인 필요)"}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
          {cg && cg !== "이미지 원문 확인 필요" ? <span style={{ fontSize: "calc(var(--s,1.3)*11px)", fontWeight: 800, color: "#fff", background: C.purple, borderRadius: 6, padding: "2px 8px" }}>신용등급 {cg}</span> : <span style={{ fontSize: "calc(var(--s,1.3)*11px)", color: C.textM, background: C.bg, borderRadius: 6, padding: "2px 8px" }}>신용등급 이미지 원문 확인 필요</span>}
          {needGrade ? <select value="" onChange={(e) => { const v = e.target.value; if (!v) return; setManualGrade(v === "미확인" ? "" : v); }} title="소문자=모의평가, 대문자=정식 신용평가 기준으로 구분해 입력" style={{ fontSize: "calc(var(--s,1.3)*11px)", fontFamily: FF, border: `1px solid ${C.purple}66`, color: C.purple, borderRadius: 6, padding: "1px 4px", background: "#fff", cursor: "pointer", maxWidth: 180 }}><option value="">＋ 신용등급 직접 입력</option><optgroup label="모의평가 등급(소문자)">{["aaa", "aa", "a", "bbb", "bb", "b", "ccc 이하"].map((g) => <option key={g} value={g}>{g}</option>)}</optgroup><optgroup label="정식 신용평가 등급(대문자)">{["AAA", "AA", "A", "BBB", "BB", "B", "CCC 이하"].map((g) => <option key={g} value={g}>{g}</option>)}</optgroup><option value="미확인">미확인</option></select> : null}
          {needGrade ? <span style={{ fontSize: "calc(var(--s,1.3)*10px)", color: C.textM }}>소문자=모의평가 · 대문자=정식 신용평가</span> : null}
          {manualGrade ? <button onClick={() => setManualGrade("")} title="직접 입력 취소" style={{ fontSize: "calc(var(--s,1.3)*10px)", fontFamily: FF, border: `1px solid ${C.bdr}`, color: C.textM, borderRadius: 6, padding: "1px 5px", background: "#fff", cursor: "pointer" }}>↺ 직접입력 해제</button> : null}
          {cfInfo && cfG ? <span style={{ fontSize: "calc(var(--s,1.3)*11px)", fontWeight: 800, color: "#fff", background: cfInfo.color, borderRadius: 6, padding: "2px 8px" }}>현금흐름 {cfG.latest} · {cfInfo.level}</span> : null}
          {co.ewGrade ? <span style={{ fontSize: "calc(var(--s,1.3)*11px)", fontWeight: 800, color: C.textS, background: C.bg, border: `1px solid ${C.bdr}`, borderRadius: 6, padding: "2px 8px" }}>EW등급 {co.ewGrade}</span> : null}
          {co.techEval ? <span style={{ fontSize: "calc(var(--s,1.3)*11px)", fontWeight: 800, color: C.blue, background: C.blueBg, borderRadius: 6, padding: "2px 8px" }}>기술력 {co.techEval}</span> : null}
        </div>
        <div style={{ display: "grid", gap: 2, marginTop: 7 }}>{rowsInfo.map(([k, v], i) => <div key={i} style={{ fontSize: "calc(var(--s,1.3)*12px)", color: C.textS }}><span style={{ color: C.textM, display: "inline-block", minWidth: 86 }}>{k}</span> {v}</div>)}</div>
        <div style={{ marginTop: 8 }}>
          <div style={{ fontWeight: 800, color: C.textS, fontSize: "calc(var(--s,1.3)*11px)", marginBottom: 4 }}>기업인증 <span style={{ color: C.textM, fontWeight: 600 }}>(인증 표 기준)</span></div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>{certRows.map(([nm, key], i) => { const st = co && ui.certInfo[key]; const col = st === "인증" ? C.ok : st === "미인증" ? C.textM : C.warn; return <span key={i} style={{ fontSize: "calc(var(--s,1.3)*11px)", fontWeight: 700, color: "#fff", background: col, borderRadius: 6, padding: "2px 7px" }}>{nm} {st || "확인 필요"}</span>; })}</div>
          <div style={{ fontWeight: 800, color: C.textS, fontSize: "calc(var(--s,1.3)*11px)", margin: "8px 0 4px" }}>산업재산권</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>{ipRows.map(([nm, key], i) => { const c = ui.ipInfo[key]; const has = typeof c === "number" && c >= 1; return <span key={i} style={{ fontSize: "calc(var(--s,1.3)*11px)", fontWeight: has ? 800 : 700, color: has ? "#fff" : C.textS, background: has ? C.purple : C.bg, border: has ? `1px solid ${C.purple}` : `1px solid ${C.bdr}`, borderRadius: 6, padding: "2px 7px" }}>{nm} {c != null ? c + "건" : "원문 확인 필요"}</span>; })}</div>
          {co.bid && (co.bid.tenders || co.bid.wins) ? <div style={{ marginTop: 6, fontSize: "calc(var(--s,1.3)*11px)", color: C.textS }}>나라장터 {co.bid.tenders ? <b style={{ color: C.blue, fontWeight: 900 }}>입찰 {co.bid.tenders.toLocaleString()}건</b> : ""}{co.bid.wins ? <> · <b style={{ color: C.gold, fontWeight: 900 }}>낙찰 {co.bid.wins.toLocaleString()}건</b></> : ""}</div> : null}
        </div>
      </div>; })() : null}
      {rows ? (rows.length ? <>
        <div style={{ border: `2px solid ${C.gold}55`, borderRadius: 12, padding: 14, background: "#FFFCF5" }}>
          <div style={{ fontWeight: 900, color: C.gold, fontSize: "calc(var(--s,1.3)*16px)", marginBottom: 2 }}>⭐ 핵심지표 미리보기</div>
          <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*11px)", marginBottom: 6, lineHeight: 1.5 }}>금액·비율은 <b style={{ color: C.textS }}>최신 재무제표 연도</b> 기준 계산값입니다. (부채비율=부채총계/자본총계, 유동비율=유동자산/유동부채, 이자보상배수=영업이익/이자비용 — 산출 불가 시 ‘원문 확인 필요’) · 재무비율 5개 영역은 보고서 재무비율 표(과거 연도일 수 있음) 기준</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 6 }}>{CORE_PREVIEW_ORDER.map((k) => { const p = ui ? ui.corePreview[k] : null; const lbl = k === "creditGrade" ? "신용등급" : (CORE_LABELS[k] || k); let val = null, yr = null; if (k === "creditGrade") { val = manualGrade || (p ? p.value : null); } else if (p) { if (k === "cashflowGrade") { val = p.latest || null; } else if (p.isRatio) { val = p.value != null ? `${Math.round(p.value * 100) / 100}${p.unit || ""}` : null; yr = p.year; } else { val = p.absent ? "0원" : (p.eok != null ? (Math.abs(p.eok) < 0.005 ? "0.01억 미만" : `${p.eok.toLocaleString()}억`) : null); yr = p.absent ? null : p.year; } } const tn = cretopPreviewTone(k, p, manualGrade); const T = tn ? CRETOP_PREVIEW_TONES[tn] : null; return <div key={k} style={{ padding: "7px 10px", background: T ? T.bg : "#fff", borderRadius: 8, border: T ? `1px solid ${T.bd}` : `1px solid ${C.bdr}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 6, alignItems: "center" }}><span style={{ color: C.textS, fontSize: "calc(var(--s,1.3)*12px)", fontWeight: 700 }}>{lbl}{yr ? ` (${yr}년)` : ""}</span>{T ? <span style={{ fontSize: "calc(var(--s,1.3)*9px)", fontWeight: 800, color: T.fg, background: "#fff", border: `1px solid ${T.fg}55`, borderRadius: 5, padding: "0 5px", whiteSpace: "nowrap" }}>{T.tag}</span> : null}</div>
            <div style={{ fontSize: "calc(var(--s,1.3)*16px)", fontWeight: 900, color: T ? T.fg : (val ? C.text : C.textM), whiteSpace: "nowrap", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis" }}>{val || "원문 확인 필요"}</div>
            {k === "debtRatio" && p && p.capitalErosion ? <div style={{ fontSize: "calc(var(--s,1.3)*9px)", fontWeight: 800, color: "#B91C1C", marginTop: 1 }}>자본잠식 위험 — 원문 확인 필요</div> : null}
          </div>; })}</div>
        </div>
        {onApplyToCustomer ? <div style={{ border: `1px solid ${C.gold}66`, borderRadius: 12, padding: "12px 14px", background: "#FFFCF5", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button style={{ ...btnP, background: C.gold, borderColor: C.gold }} onClick={applyToCustomer}>📥 {applyLabel || "이 분석 결과로 고객 정보 채우기"}</button>
          <span style={{ color: C.textS, fontSize: "calc(var(--s,1.3)*12px)", flex: 1, minWidth: 180, lineHeight: 1.5 }}>회사명·대표자·매출·핵심비율·1차 미팅 포인트·선택한 추가 제안 포인트를 고객 정보에 반영합니다. 모든 값은 후보이며 저장 전 확인이 필요합니다.</span>
        </div> : null}
        {pts && pts.topPoints.length ? <div style={{ border: `1px solid ${C.blue}40`, borderRadius: 12, overflow: "hidden" }}>
          <button onClick={() => secToggle("mp")} style={{ width: "100%", textAlign: "left", border: "none", background: openSec.mp ? C.blueBg : "#fff", cursor: "pointer", padding: "10px 12px", fontFamily: FF, fontWeight: 900, fontSize: "calc(var(--s,1.3)*15px)", color: C.blue, display: "flex", alignItems: "center", gap: 6 }}>{openSec.mp ? "▾" : "▸"} 🎯 1차 미팅 포인트 <span style={{ color: C.textM, fontWeight: 700, fontSize: "calc(var(--s,1.3)*12px)" }}>{pts.topPoints.length}개 보기</span></button>
          {openSec.mp ? (() => { const pairs = pts.pointPairs && pts.pointPairs.length ? pts.pointPairs : pts.topPoints.map((t, i) => ({ title: t, q: pts.questions[i] || "" }));
            const selW = weapons.map((nm) => CRETOP_WEAPON_MAP[nm]).filter(Boolean);
            const copyMp = `[1차 미팅 포인트]\n${pairs.map((p, i) => `${i + 1}. ${p.title}${p.q ? `\n   질문: ${p.q}` : ""}`).join("\n")}` + (selW.length ? `\n\n[선택한 추가 제안 포인트]\n${selW.map((w, i) => `${i + 1}. ${w.name}\n대표자 관심 포인트: ${w.p}\n검토 포인트: ${w.r}\n핵심 질문: ${w.q}\n관련 혜택/자료: ${w.d}`).join("\n\n")}` : "") + (pts.docs.length ? `\n\n[요청자료]\n${pts.docs.join(", ")}` : "");
            return <div style={{ padding: 14, borderTop: `1px solid ${C.blue}30` }}>
            <div style={{ display: "grid", gap: 10 }}>{pairs.map((p, i) => <div key={i}>
              <div style={{ color: C.textS, fontSize: "calc(var(--s,1.3)*14px)", lineHeight: 1.55, fontWeight: 700 }}>{i + 1}. {p.title}</div>
              {p.q ? <div style={{ color: C.blue, fontSize: "calc(var(--s,1.3)*13px)", lineHeight: 1.5, marginTop: 2, paddingLeft: 12 }}>↳ 질문: {p.q}</div> : null}
            </div>)}</div>
            <div style={{ marginTop: 14, border: `1px solid ${C.purple}33`, borderRadius: 10, overflow: "hidden" }}>
              <button onClick={() => setWeaponsOpen((v) => !v)} style={{ width: "100%", textAlign: "left", border: "none", background: weaponsOpen ? "#F5F1FF" : "#fff", cursor: "pointer", padding: "9px 12px", fontFamily: FF, fontWeight: 800, fontSize: "calc(var(--s,1.3)*13px)", color: C.purple, display: "flex", alignItems: "center", gap: 6 }}>{weaponsOpen ? "▾" : "▸"} 🧩 추가 제안 포인트 선택 {weapons.length ? <span style={{ background: C.purple, color: "#fff", borderRadius: 6, padding: "1px 7px", fontSize: "calc(var(--s,1.3)*11px)" }}>{weapons.length}개 선택</span> : null}</button>
              {weaponsOpen ? <div style={{ padding: "8px 12px 12px", borderTop: `1px solid ${C.purple}22` }}>
                <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*12px)", marginBottom: 8, lineHeight: 1.5 }}>이번 미팅에서 함께 확인할 제안 주제를 선택하세요. 선택한 항목은 1차 미팅 포인트와 복사 내용에 함께 포함됩니다.</div>
                {CRETOP_WEAPONS.map((g) => <div key={g.cat} style={{ marginBottom: 8 }}>
                  <div style={{ fontWeight: 800, color: C.textS, fontSize: "calc(var(--s,1.3)*11px)", marginBottom: 4 }}>{g.cat}</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>{g.items.map((it) => { const on = weapons.includes(it.name); return <button key={it.name} onClick={() => setWeapons((w) => w.includes(it.name) ? w.filter((x) => x !== it.name) : [...w, it.name])} title={it.p} style={{ fontSize: "calc(var(--s,1.3)*11px)", fontFamily: FF, cursor: "pointer", borderRadius: 7, padding: "3px 9px", border: on ? `1px solid ${C.purple}` : `1px solid ${C.bdr}`, background: on ? C.purple : "#fff", color: on ? "#fff" : C.textS, fontWeight: on ? 800 : 600 }}>{on ? "✓ " : ""}{it.name}</button>; })}</div>
                </div>)}
              </div> : null}
            </div>
            {selW.length ? <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 900, color: C.purple, fontSize: "calc(var(--s,1.3)*14px)", marginBottom: 6 }}>선택한 추가 제안 포인트 <span style={{ color: C.textM, fontWeight: 700, fontSize: "calc(var(--s,1.3)*12px)" }}>({selW.length})</span></div>
              <div style={{ display: "grid", gap: 8 }}>{selW.map((w) => <div key={w.name} style={{ background: C.purpleBg, border: `1px solid ${C.purple}22`, borderRadius: 8, padding: "9px 11px" }}>
                <div style={{ color: C.purple, fontWeight: 900, fontSize: "calc(var(--s,1.3)*13px)", marginBottom: 3 }}>+ {w.name}</div>
                <div style={{ color: C.textS, fontSize: "calc(var(--s,1.3)*12px)", lineHeight: 1.55 }}><b style={{ color: C.text }}>대표자 관심 포인트</b> · {w.p}</div>
                <div style={{ color: C.textS, fontSize: "calc(var(--s,1.3)*12px)", lineHeight: 1.55, marginTop: 2 }}><b style={{ color: C.text }}>검토 포인트</b> · {w.r}</div>
                <div style={{ color: C.blue, fontSize: "calc(var(--s,1.3)*12px)", lineHeight: 1.55, marginTop: 2 }}><b>핵심 질문</b> · {w.q}</div>
                <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*11px)", lineHeight: 1.5, marginTop: 2 }}><b>관련 혜택/자료</b> · {w.d}</div>
              </div>)}</div>
            </div> : null}
            {pts.docs.length ? <div style={{ marginTop: 10, color: C.textM, fontSize: "calc(var(--s,1.3)*12px)" }}>요청자료: {pts.docs.join(", ")}</div> : null}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}><button style={btnSm} onClick={() => copyText(copyMp, () => showToast("미팅 포인트를 복사했습니다."))}>미팅 포인트 복사</button></div>
          </div>; })() : null}
        </div> : null}
        {(() => {
          const dirCol = (d) => d === "상승" ? C.ok : d === "하락" ? C.err : d === "유지" ? C.textM : C.warn;
          const fmt = (v, u) => v == null ? "—" : (typeof v !== "number" ? String(v) : `${(Math.round(v * 100) / 100).toLocaleString()}${u === "억원" ? "억" : (u || "")}`);
          const transCol = (tr) => tr === "흑자전환" ? C.ok : tr === "적자폭 축소" ? C.warn : C.err;
          const y2 = (y) => String(y == null ? "?" : y).slice(-2);
          const yearBox = (yr, body, neg, key) => <div key={key} style={{ textAlign: "center", background: "#fff", border: `1px solid ${C.bdr}`, borderRadius: 9, padding: "6px 12px", minWidth: 72, flexShrink: 0 }}><div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*11px)", fontWeight: 700 }}>{yr == null ? "?" : yr + "년"}</div><div style={{ fontWeight: 900, fontSize: "calc(var(--s,1.3)*14px)", color: neg ? C.err : C.text, whiteSpace: "nowrap" }}>{body}</div></div>;
          const changeChip = (fromY, toY, deltaTxt, pctTxt, col, key) => <div key={key} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1px 5px", borderRadius: 7, background: col + "14", border: `1px solid ${col}40`, minWidth: 46, flexShrink: 0, alignSelf: "center" }}><span style={{ fontSize: "calc(var(--s,1.3)*8px)", color: C.textM, fontWeight: 700 }}>{y2(fromY)}→{y2(toY)}</span><span style={{ fontSize: "calc(var(--s,1.3)*10px)", fontWeight: 800, color: col, whiteSpace: "nowrap" }}>{deltaTxt}</span>{pctTxt ? <span style={{ fontSize: "calc(var(--s,1.3)*8px)", fontWeight: 700, color: col, whiteSpace: "nowrap" }}>{pctTxt}</span> : null}</div>;
          const gradeNum = (g) => { const n = parseInt(String(g).replace(/\D/g, ""), 10); return isNaN(n) ? null : n; };
          // 변화칩: 금액형=억원변화+증감률, 비율형=차이(%p/배/회, 중복 % 제거)
          const round2 = (v) => Math.round(v * 100) / 100;
          const stepChip = (st, t, u, key) => {
            const isAmt = !t.isRatio;
            if (isAmt) { const main = `${st.deltaAbs > 0 ? "+" : ""}${fmt(st.deltaAbs, u)}`;
              // 부호 전환 구간(흑자전환/적자전환/적자폭 확대·축소)은 %가 오해를 주므로 전환문구를 보조로, 금액을 메인으로(% 미표시)
              const sub = st.transition ? st.transition : (st.deltaPct != null ? `${st.deltaPct > 0 ? "+" : ""}${st.deltaPct}%` : "비교 불가");
              return changeChip(st.fromYear, st.toYear, main, sub, st.transition ? transCol(st.transition) : dirCol(st.dir), key); }
            const diffUnit = u === "%" ? "%p" : (u || "");
            return changeChip(st.fromYear, st.toYear, `${st.deltaAbs > 0 ? "+" : ""}${round2(st.deltaAbs).toLocaleString()}${diffUnit}`, "", dirCol(st.dir), key);
          };
          const trendCard = (tr) => {
            if (tr.isGrade) { const ser = tr.gradeSeries; if (!ser || !ser.length) return null; const yrs = tr.years || []; const gi = cretopCashflowGradeInfo(ser[ser.length - 1]); return <div key={tr.key} style={{ padding: "7px 9px", border: `1px solid ${C.bdr}`, borderRadius: 9, background: "#fff", display: "grid", gap: 5, maxWidth: "100%", boxSizing: "border-box" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}><span style={{ fontWeight: 800, color: C.text, fontSize: "calc(var(--s,1.3)*13px)" }}>현금흐름등급</span><span style={{ fontSize: "calc(var(--s,1.3)*11px)", fontWeight: 800, color: "#fff", background: gi.color, borderRadius: 6, padding: "2px 8px" }}>{ser[ser.length - 1]} · {gi.level}</span></div>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>{ser.map((gv, i) => { const out = [yearBox(yrs[i], gv, false, "y" + i)]; if (i < ser.length - 1) { const a = gradeNum(ser[i]), b = gradeNum(ser[i + 1]); const d = (a == null || b == null) ? "확인 필요" : (b > a ? "악화" : b < a ? "개선" : "유지"); const col = d === "악화" ? C.err : d === "개선" ? C.ok : C.textM; out.push(changeChip(yrs[i], yrs[i + 1], d, "", col, "s" + i)); } return out; })}</div>
              <div style={{ fontSize: "calc(var(--s,1.3)*11px)", lineHeight: 1.5, color: gi.level === "현금흐름 주의" ? "#991B1B" : C.textS, background: gi.color + "14", border: `1px solid ${gi.color}40`, borderRadius: 8, padding: "6px 9px" }}><b style={{ color: gi.color }}>{gi.level}</b> · {gi.text}</div>
            </div>; }
            const t = tr.trend; if (!t || !t.series.length) return null; const u = t.unit;
            return <div key={tr.key} style={{ padding: "7px 9px", border: `1px solid ${C.bdr}`, borderRadius: 9, background: "#fff", display: "grid", gap: 5, maxWidth: "100%", boxSizing: "border-box" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}><span style={{ fontWeight: 800, color: C.text, fontSize: "calc(var(--s,1.3)*13px)" }}>{tr.label}</span><span style={{ fontWeight: 800, color: t.latest && t.latest.val < 0 ? C.err : C.text }}>{t.latest ? fmt(t.latest.val, u) : "—"}</span></div>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>{t.series.map((s, i) => { const out = [yearBox(s.year, fmt(s.val, u), typeof s.val === "number" && s.val < 0, "y" + i)]; const st = t.steps[i]; if (st) out.push(stepChip(st, t, u, "s" + i)); return out; })}</div>
              {(() => { const rc = cretopTrendCommentRich(tr.key, t); const tc = rc.tone === "red" ? { bg: "#FEF2F2", fg: "#B91C1C", bd: "#FCA5A5" } : rc.tone === "green" ? { bg: "#F0FDF4", fg: "#15803D", bd: "#86EFAC" } : { bg: C.blueBg, fg: "#334155", bd: "#CBD5E1" }; return <div style={{ fontSize: "calc(var(--s,1.3)*12px)", lineHeight: 1.55, color: tc.fg, background: tc.bg, border: `1px solid ${tc.bd}`, borderRadius: 8, padding: "7px 10px", fontWeight: 700 }}>{rc.text}</div>; })()}
            </div>;
          };
          const trendCards = (ui ? ui.trendRows : []).filter((tr) => tr.isGrade ? (tr.gradeSeries && tr.gradeSeries.length) : (tr.trend && tr.trend.series && tr.trend.series.length)).map(trendCard).filter(Boolean);
          const areaCard = (m) => { const t = m.trend; const u = (t && t.unit) || m.unit || "%"; const usable = t && t.series && t.series.length; return <div key={m.key} style={{ padding: "6px 0", borderTop: `1px dashed ${C.bdr}` }}>
            <div style={{ fontWeight: 700, color: C.textS, fontSize: "calc(var(--s,1.3)*12px)", marginBottom: 3 }}>{m.label}{m.rawLabel && m.label !== m.rawLabel ? <span style={{ color: C.textM, fontWeight: 400, fontSize: "calc(var(--s,1.3)*10px)" }}> · 원문 {m.rawLabel}</span> : null}</div>
            {usable ? <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 5 }}>{t.series.map((s, i) => { const out = [yearBox(s.year, fmt(s.val, u), typeof s.val === "number" && s.val < 0, "y" + i)]; const st = t.steps[i]; if (st) out.push(stepChip(st, t, u, "s" + i)); return out; })}</div> : <span style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*11px)" }}>원문 후보 없음</span>}
          </div>; };
          return <>
            <div style={{ border: `1px solid ${C.bdr}`, borderRadius: 10, overflow: "hidden" }}>
              <button onClick={() => secToggle("trend")} style={{ width: "100%", textAlign: "left", border: "none", background: openSec.trend ? "#F5F7FA" : "#fff", cursor: "pointer", padding: "9px 12px", fontFamily: FF, fontWeight: 800, fontSize: "calc(var(--s,1.3)*13px)", color: C.text, display: "flex", alignItems: "center", gap: 6 }}>{openSec.trend ? "▾" : "▸"} 📈 3개년 핵심 추이 <span style={{ color: C.textM, fontWeight: 700 }}>({trendCards.length})</span></button>
              {openSec.trend ? <div style={{ padding: 8, display: "grid", gap: 6, borderTop: `1px solid ${C.bdr}`, maxHeight: 420, overflowY: "auto", overflowX: "hidden" }}>{trendCards.length ? trendCards : <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*12px)", padding: 6 }}>3개년 추이를 만들 금액 후보가 없습니다.</div>}</div> : null}
            </div>
            <div style={{ border: `1px solid ${C.bdr}`, borderRadius: 10, overflow: "hidden" }}>
              <button onClick={() => secToggle("areas")} style={{ width: "100%", textAlign: "left", border: "none", background: openSec.areas ? "#F5F7FA" : "#fff", cursor: "pointer", padding: "9px 12px", fontFamily: FF, fontWeight: 800, fontSize: "calc(var(--s,1.3)*13px)", color: C.text, display: "flex", alignItems: "center", gap: 6 }}>{openSec.areas ? "▾" : "▸"} 📊 재무비율 5개 영역 <span style={{ color: C.textM, fontWeight: 700 }}>(성장성·수익성·재무구조·부채상환능력·활동성)</span></button>
              {openSec.areas ? <div style={{ padding: 8, display: "grid", gap: 8, borderTop: `1px solid ${C.bdr}`, maxHeight: 460, overflowY: "auto", overflowX: "hidden" }}>{(ui ? ui.ratioAreas : []).map((a) => { const mlist = a.metrics || []; const got = mlist.filter((m) => !m.missing && m.trend && m.trend.series && m.trend.series.length).length; return <div key={a.key} style={{ border: `1px solid ${C.bdr}`, borderRadius: 9, background: "#fff", overflow: "hidden" }}>
                <button onClick={() => secToggle("area_" + a.key)} style={{ width: "100%", textAlign: "left", border: "none", background: openSec["area_" + a.key] ? "#FAFBFD" : "#fff", cursor: "pointer", padding: "8px 10px", fontFamily: FF, fontWeight: 800, fontSize: "calc(var(--s,1.3)*13px)", color: C.blue, display: "flex", alignItems: "center", gap: 6 }}>{openSec["area_" + a.key] ? "▾" : "▸"} {a.name} <span style={{ color: C.textM, fontWeight: 700, fontSize: "calc(var(--s,1.3)*11px)" }}>지표 {got}/{mlist.length}</span></button>
                {openSec["area_" + a.key] ? <div style={{ padding: "2px 10px 10px" }}>{mlist.map(areaCard)}<div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*11px)", marginTop: 6, lineHeight: 1.5 }}>해석: {a.hint}</div></div> : null}
              </div>; })}</div> : null}
            </div>
            {(() => { const STMT_META = [["bs", "재무상태표", "balanceSheet"], ["is", "손익계산서", "incomeStatement"], ["re", "이익잉여금처분계산서", "retainedEarnings"], ["mc", "제조원가명세서", "manufacturingCost"]]; const ds = ui ? ui.detailStatements : null; const det = STMT_META.map(([key, defName, prop]) => { const s = (ds && ds[prop]) || { items: [], years: [], noData: false }; return { key, name: s.name || defName, items: s.items || [], years: s.years || [], noData: !!s.noData }; }).filter((g) => g.items.length || g.noData);
              const detItem = (r, gYears) => { const vals = r.numberCandidates || []; const ys = (r.yearCandidates && r.yearCandidates.length) ? r.yearCandidates : (gYears && gYears.length ? gYears : vals.map(() => null)); const u = r.unit || "천원"; const uf = CRETOP_UF[u] != null ? CRETOP_UF[u] : 1e-5; const eokVals = vals.map((v) => v == null ? null : Math.round(v * uf * 100) / 100); const small = (v) => v != null && Math.abs(v * uf) < 0.005; const boxTxt = (i) => { const v = vals[i]; if (v == null) return "-"; if (small(v)) return "0.01억 미만"; return `${eokVals[i].toLocaleString()}억`; }; let lastIdx = -1; for (let i = vals.length - 1; i >= 0; i--) { if (vals[i] != null) { lastIdx = i; break; } } const latestTxt = lastIdx < 0 ? "" : (small(vals[lastIdx]) ? `0.01억 미만 (${vals[lastIdx].toLocaleString()}${u})` : `${eokVals[lastIdx].toLocaleString()}억`); const rawLine = vals.map((v) => v == null ? "-" : v.toLocaleString()).join(" / ");
                return <div key={r.id} style={{ padding: "6px 0", borderTop: `1px dashed ${C.bdr}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6, alignItems: "baseline" }}><span style={{ fontWeight: 700, color: C.textS, fontSize: "calc(var(--s,1.3)*12px)" }}>{r.rawLabel || r.account}</span>{latestTxt ? <span style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*10px)" }}>최신 {latestTxt}</span> : null}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 3, alignItems: "center" }}>{eokVals.map((v, i) => { const out = [yearBox(ys[i] != null ? ys[i] : (gYears && gYears[i]) || "—", boxTxt(i), typeof v === "number" && v < 0, "y" + i)]; if (i < eokVals.length - 1) { const a = eokVals[i], b = eokVals[i + 1]; if (a != null && b != null) { const d = Math.round((b - a) * 100) / 100; const col = d > 0 ? C.ok : d < 0 ? C.err : C.textM; out.push(changeChip(ys[i], ys[i + 1], `${d > 0 ? "+" : ""}${d.toLocaleString()}억`, "", col, "s" + i)); } } return out; })}</div>
                <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*9px)", marginTop: 2 }}>단위 {u} · 원값 {rawLine}</div>
              </div>; };
            return <div style={{ border: `1px solid ${C.bdr}`, borderRadius: 10, overflow: "hidden" }}>
              <button onClick={() => secToggle("detail")} style={{ width: "100%", textAlign: "left", border: "none", background: openSec.detail ? "#F5F7FA" : "#fff", cursor: "pointer", padding: "9px 12px", fontFamily: FF, fontWeight: 800, fontSize: "calc(var(--s,1.3)*13px)", color: C.text, display: "flex", alignItems: "center", gap: 6 }}>{openSec.detail ? "▾" : "▸"} 📑 상세 재무제표 보기 <span style={{ color: C.textM, fontWeight: 700, fontSize: "calc(var(--s,1.3)*11px)" }}>(원문 기준 참고용 · {det.length}개 명세서)</span></button>
              {openSec.detail ? (det.length ? <div style={{ padding: 8, display: "grid", gap: 8, borderTop: `1px solid ${C.bdr}`, maxHeight: 480, overflowY: "auto", overflowX: "hidden" }}>{det.map((g) => <div key={g.key} style={{ border: `1px solid ${C.bdr}`, borderRadius: 9, background: "#fff", overflow: "hidden" }}>
                <button onClick={() => secToggle("det_" + g.key)} style={{ width: "100%", textAlign: "left", border: "none", background: openSec["det_" + g.key] ? "#FAFBFD" : "#fff", cursor: "pointer", padding: "8px 10px", fontFamily: FF, fontWeight: 800, fontSize: "calc(var(--s,1.3)*13px)", color: C.blue, display: "flex", alignItems: "center", gap: 6 }}>{openSec["det_" + g.key] ? "▾" : "▸"} {g.name} <span style={{ color: C.textM, fontWeight: 700, fontSize: "calc(var(--s,1.3)*11px)" }}>{g.noData && !g.items.length ? "원문 자료 없음" : g.items.length + "개 항목"}</span></button>
                {openSec["det_" + g.key] ? <div style={{ padding: "2px 10px 10px" }}>{g.noData && !g.items.length ? <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*12px)", padding: "4px 0" }}>{g.name} 원문 자료가 없습니다.</div> : g.items.map((it) => detItem(it, g.years))}</div> : null}
              </div>)}</div> : <div style={{ padding: 10, color: C.textM, fontSize: "calc(var(--s,1.3)*12px)", borderTop: `1px solid ${C.bdr}` }}>상세 재무제표 후보를 찾지 못했습니다(원문에 상세표가 없을 수 있습니다).</div>) : null}
            </div>; })()}
          </>;
        })()}
        <div style={{ border: `1px solid ${C.bdr}`, borderRadius: 10, overflow: "hidden" }}>
          <button onClick={() => secToggle("admin")} style={{ width: "100%", textAlign: "left", border: "none", background: openSec.admin ? "#F5F7FA" : "#fff", cursor: "pointer", padding: "9px 12px", fontFamily: FF, fontWeight: 800, fontSize: "calc(var(--s,1.3)*12px)", color: C.textM, display: "flex", alignItems: "center", gap: 6 }}>{openSec.admin ? "▾" : "▸"} 🛠 관리자용 / 디버그 도구 <span style={{ color: C.textM, fontWeight: 700, fontSize: "calc(var(--s,1.3)*10px)" }}>(추천·후보·검수·제외·원문 디버그)</span></button>
          {openSec.admin ? <div style={{ padding: 8, borderTop: `1px solid ${C.bdr}`, display: "grid", gap: 8 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontWeight: 900, color: C.text, fontSize: "calc(var(--s,1.3)*14px)" }}>✅ 최종 추천 핵심지표 <span style={{ color: C.ok }}>{groups.recommended.length}</span></span>
              <button style={{ ...btnSm, marginLeft: "auto" }} onClick={addRow}>＋ 행 추가</button>
            </div>
            <div style={{ border: `1px solid ${C.bdr}`, borderRadius: 10, maxHeight: 360, overflowY: "auto", overflowX: "hidden", padding: 8, display: "grid", gap: 8, boxSizing: "border-box" }}>
              {groups.recommended.length ? groups.recommended.map(renderCard) : <div style={{ padding: 10, color: C.textM, fontSize: "calc(var(--s,1.3)*12px)" }}>추천 핵심지표가 없습니다. ‘검수 필요 후보’를 확인하거나 원문을 다시 점검하세요.</div>}
            </div>
            {renderSec("alt", "다른 후보 보기", groups.alternates, C.textS)}
            {renderSec("review", "검수 필요 후보 보기", groups.review, "#C77700")}
            {renderSec("excluded", "제외된 후보 보기", groups.excluded, C.textM)}
            <div style={{ border: `1px solid ${C.bdr}`, borderRadius: 10, overflow: "hidden" }}>
              <button onClick={() => secToggle("debug")} style={{ width: "100%", textAlign: "left", border: "none", background: openSec.debug ? "#F5F7FA" : "#fff", cursor: "pointer", padding: "9px 12px", fontFamily: FF, fontWeight: 800, fontSize: "calc(var(--s,1.3)*13px)", color: C.textM, display: "flex", alignItems: "center", gap: 6 }}>{openSec.debug ? "▾" : "▸"} 원문 디버그 보기</button>
              {openSec.debug ? <div style={{ padding: 8, borderTop: `1px solid ${C.bdr}`, display: "grid", gap: 8 }}>
                {selLi != null && selLi >= 0 ? <div style={{ border: `1px solid ${C.gold}55`, borderRadius: 8, padding: "8px 10px", background: "#FFFCF5" }}><div style={{ fontWeight: 800, color: C.gold, fontSize: "calc(var(--s,1.3)*12px)", marginBottom: 4 }}>📍 원문 주변 (라인 {selLi})</div><div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: "calc(var(--s,1.3)*11px)", lineHeight: 1.6, wordBreak: "break-all" }}>{dlines.filter((l) => l.li >= selLi - 4 && l.li <= selLi + 4).map((l) => <div key={l.li} style={{ color: l.li === selLi ? C.err : C.textS, fontWeight: l.li === selLi ? 800 : 400 }}>{l.li}: {l.text}{l.ntext && l.ntext !== l.text ? <span style={{ color: C.gold }}> ⟶ {l.ntext}</span> : null}</div>)}</div></div> : <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*11px)" }}>후보 카드의 ‘상세 보기 → 원문에서 보기’를 누르면 해당 원문 주변이 표시됩니다.</div>}
                <button style={btnS} onClick={debugBtn}>🧷 크레탑 실패 분석용 디버그 복사</button>
                <button style={btnS} onClick={() => { if (!ui) { showToast("먼저 원문을 넣고 추출해주세요."); return; } copyText(JSON.stringify(ui, null, 2), () => showToast("실제 화면이 사용하는 UI 데이터(JSON)를 복사했습니다.")); }}>🧪 실제 UI 사용 데이터 JSON 복사</button>
                {ui ? <div style={{ fontSize: "calc(var(--s,1.3)*11px)", color: C.textS, background: C.bg, border: `1px solid ${C.bdr}`, borderRadius: 8, padding: "7px 9px", lineHeight: 1.6, wordBreak: "break-all" }}>
                  <div><b>financialYears</b> {JSON.stringify(ui.financialYears || [])} <span style={{ color: C.textM }}>(금액형·미리보기/추이 비율 계산 연도)</span></div>
                  <div><b>computedRatioYears</b> {JSON.stringify(ui.computedRatioYears || [])} <span style={{ color: C.textM }}>(재무제표 직접 계산 비율 연도 — 미리보기·추이)</span></div>
                  <div><b>reportRatioYears</b> {JSON.stringify(ui.reportRatioYears || ui.ratioYears || [])} · <b>source</b> {ui.ratioYearSource} · <b>confidence</b> {ui.ratioYearConfidence} <span style={{ color: C.textM }}>(재무비율 표 연도 — 5개 영역 전용)</span></div>
                  <div><b>corePreviewRatioSource</b> {JSON.stringify(ui.corePreviewRatioSource || {})} <span style={{ color: C.textM }}>(미리보기 비율 출처: computed/report/unavailable)</span></div>
                  <div><b>ratioAreasSource</b> {String(ui.ratioAreasSource || "reportRatioTable")} <span style={{ color: C.textM }}>(5개 영역 출처)</span></div>
                  <div><b>ignoredYears</b> {JSON.stringify(ui.ignoredYears || [])} <span style={{ color: C.textM }}>(조회일시·설립·법인등기 등 비재무 연도 — 비율 연도에서 제외)</span></div>
                  {ui.balanceSheetOrderDebug ? (() => { const b = ui.balanceSheetOrderDebug; const okSrc = b.source === "detailedStatement"; return <div style={{ marginTop: 4, paddingTop: 4, borderTop: `1px dashed ${C.bdr}` }}>
                    <div><b>balanceSheet.source</b> <b style={{ color: okSrc ? C.ok : C.warn }}>{String(b.source)}</b> · <b>unit</b> {String(b.unit)} · 섹션 {String(b.sectionName)} <span style={{ color: C.textM }}>(detailedStatement이어야 정상 · MY/요약이면 상세구간 미검출)</span></div>
                    <div><b>balanceSheetOrder</b> 섹션 L{b.sectionStartLine}~L{b.sectionEndLine} · 항목 {b.itemCount}개 · lineIndex오름차순 <b style={{ color: b.isSortedByLineIndex ? C.ok : C.err }}>{String(b.isSortedByLineIndex)}</b> · 중복보존 {String(b.duplicatedAccountsKept)} · 첫행 {(b.firstAccounts || []).join("/")}</div>
                    {(b.skippedBalanceSheetRows || []).length ? <div style={{ color: C.warn }}>skippedBalanceSheetRows({b.skippedBalanceSheetRows.length}): {b.skippedBalanceSheetRows.join(" | ")}</div> : <div style={{ color: C.textM }}>skippedBalanceSheetRows: 없음</div>}
                  </div>; })() : null}
                  {ui.unitDebug ? (() => { const u = ui.unitDebug; const fmtP = (p) => p ? `${p.numerator.label} ${p.numerator.value}${p.numerator.unit}(${p.numerator.normalizedMillion}백만)  /  ${p.denominator.label} ${p.denominator.value}${p.denominator.unit}(${p.denominator.normalizedMillion}백만) = ${p.result}` : "—"; return <div style={{ marginTop: 4, paddingTop: 4, borderTop: `1px dashed ${C.bdr}` }}>
                    <div><b>unitDebug.부채비율</b> {fmtP(u.corePreviewDebtRatio)}</div>
                    <div><b>unitDebug.당기순이익률</b> {fmtP(u.netIncomeMargin)}</div>
                    <div><b>unitDebug.이자보상배수</b> {fmtP(u.interestCoverageRatio)}</div>
                  </div>; })() : null}
                  {ui.regressionGuard ? (() => { const g = ui.regressionGuard; const bad = (g.forbiddenYearsDetectedInRatio || []).length || (g.unitMixWarnings || []).length; return <div style={{ marginTop: 4, paddingTop: 4, borderTop: `1px dashed ${C.bdr}` }}>
                    <div><b>regressionGuard</b> type {String(g.companyType)} · ratioYears {JSON.stringify(g.ratioYears)} · BS source {String(g.balanceSheetSource)}</div>
                    <div style={{ color: bad ? C.err : C.ok }}>forbiddenYearsInRatio {JSON.stringify(g.forbiddenYearsDetectedInRatio || [])} · unitMixWarnings {JSON.stringify(g.unitMixWarnings || [])}</div>
                  </div>; })() : null}
                </div> : null}
              </div> : null}
            </div>
          </div> : null}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button style={btnP} onClick={doSave}>💾 선택한 핵심지표 저장</button>
          <span style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*11px)", flex: "1 1 200px", minWidth: 0, lineHeight: 1.5 }}>체크한 지표만 저장됩니다. 단위·기준연도·원문값을 확인한 뒤 저장하세요.</span>
        </div>
        <div>
          <button onClick={() => setShowHelp((v) => !v)} style={{ border: "none", background: "transparent", color: C.textM, cursor: "pointer", fontFamily: FF, fontSize: "calc(var(--s,1.3)*12px)", fontWeight: 700, padding: 0 }}>{showHelp ? "▾ 도움말 닫기" : "▸ 도움말 보기"}</button>
          {showHelp ? <div style={{ marginTop: 6, color: C.textM, fontSize: "calc(var(--s,1.3)*11px)", lineHeight: 1.6 }}>· 모든 값은 ‘후보’이며 자동으로 고객 정보에 덮어쓰지 않습니다.<br />· 크레탑 표는 보통 오른쪽으로 갈수록 최신연도이며, 연도 행이 없으면 오른쪽 끝 값을 최신 후보로 표시합니다.<br />· 단위(백만원/천원)와 기준연도는 원문 기준 확인이 필요합니다.<br />· 1,000억원 이상 값은 단위 오류 가능성을 우선 점검합니다.<br />· PDF 원문 추출이 불안정하면 디버그 복사로 원문 상태를 점검하세요.</div> : null}
        </div>
      </> : <div style={{ color: C.textS, fontSize: "calc(var(--s,1.3)*13px)", lineHeight: 1.6 }}>핵심지표 후보를 찾지 못했습니다. 요약 손익계산서·재무상태표·재무비율 표 부분이 원문에 포함됐는지 확인하세요.</div>) : null}
    </div>
  </Modal>;
}
function CustomerPanel({ item, data, setData, goMeeting, onConvert, inDB }) {
  const [rep, setRep] = useState(false);
  const [prep, setPrep] = useState(false);
  const [coreOpen, setCoreOpen] = useState(false);
  const [prop, setProp] = useState(false);
  const [scope, setScope] = useState(false);
  const [cf, setCf] = useState({ date: todayISO(), type: "전화", memo: "", nextAction: "" });
  const matchedPkgs = matchPackages(item, getPackages(data));
  const bd = scoreBand(scoreLead(item));
  const recos = topRecommendations(item);
  const docs = Array.from(new Set(recommendedStrategiesFor(item).flatMap((s) => s.docs))).slice(0, 12);
  const kakaos = buildKakaoSet(item);
  const sec = { fontSize: "calc(var(--s,1.3)*18px)", fontWeight: 900, color: C.gold, marginBottom: 12 };
  const cell = (label, val, color) => <div><Label>{label}</Label><b style={{ fontSize: "calc(var(--s,1.3)*16px)", color: color || C.text }}>{val}</b></div>;
  return <div style={{ display: "grid", gap: 12 }}>
    <Card style={{ padding: 18 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}><div style={{ ...sec, margin: 0 }}>🏢 회사 기본정보</div><div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>{item.dbSource && (() => { const ds = DB_SOURCE_STYLE[item.dbSource] || [C.textM, "#EEF2F7"]; return <Badge color={ds[0]} bg={ds[1]}>📥 {item.dbSource}</Badge>; })()}{item.cretopChecked && <Badge color={C.ok} bg={C.greenBg}>크레탑 확인</Badge>}{(() => { const sg = sourceTag(item); return <Badge color={sg.color} bg={sg.bg}>{sg.label}</Badge>; })()}</div></div><div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>{cell("업체명", getCompanyName(item) || item.name)}{cell("업종", item.industry || "-")}{cell("매출", wonFromMillion(item.revenue), C.blue)}{cell("직원", (item.empCount || "-") + "명")}{cell("업력", (item.estYears || "-") + "년")}{cell("대표 나이", (item.ceoAge || "-") + "세")}{cell("미팅 단계", stageOf(item.stage).label)}{cell(<>가능성 점수<Help text="고객 정보를 바탕으로 계약 가능성을 0~100으로 추정한 참고 점수입니다. 단정이 아니라 우선순위 참고용입니다." /></>, scoreLead(item) + " · " + bd.short, bd.color)}</div></Card>
    {(() => { const ps = item.proposalStatus; let hint, step; if (item.stage === "contracted" || ps === "계약 완료") { hint = "계약 완료 고객입니다. 다음 연락 일정을 정해 관계를 이어가세요."; step = "다음 연락"; } else if (["견적 전달", "조건 조율", "계약 예정"].includes(ps)) { hint = "견적·조건을 협의 중입니다. 업무범위서를 확인하고 다음 연락을 잡으세요."; step = "견적/계약"; } else if (ps === "제안 완료" || item.stage === "proposal_sent") { hint = "제안을 전달했습니다. 견적/업무범위서를 만들어 다음 미팅을 준비하세요."; step = "리포트/제안서"; } else if (["meeting1_scheduled", "meeting2_scheduled", "meeting_proposed", "contacted", "docs_requested", "docs_received"].includes(item.stage)) { hint = "미팅 준비가 필요합니다. 질문과 확인자료를 정리하세요."; step = "미팅 준비"; } else { hint = "먼저 미팅 준비를 만들고, 방문용 리포트로 첫 상담을 준비하세요."; step = "미팅 준비"; } return <Card style={{ padding: "14px 16px", background: C.blueBg, border: `1px solid ${C.blue}40` }}><div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}><span style={{ fontSize: "calc(var(--s,1.3)*20px)" }}>👉</span><div style={{ flex: 1, minWidth: 180 }}><div style={{ fontWeight: 900, color: C.blue, fontSize: "calc(var(--s,1.3)*14px)" }}>지금 해야 할 다음 행동 · {step}</div><div style={{ color: C.textS, fontSize: "calc(var(--s,1.3)*15px)", marginTop: 2, lineHeight: 1.5 }}>{hint}</div></div></div></Card>; })()}
    <Card style={{ padding: "12px 14px", background: C.blueBg, border: `1px solid ${C.blue}40` }}><div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><button style={btnP} onClick={() => setPrep(true)}>🎁 계약 준비팩 만들기</button><button style={btnS} onClick={() => setCoreOpen(true)}>🔢 크레탑 핵심지표 점검</button>{item.cretopCore && <Badge color={C.ok} bg={C.greenBg}>크레탑 핵심지표 있음</Badge>}<span style={{ color: C.textS, fontSize: "calc(var(--s,1.3)*13px)", flex: 1, minWidth: 160, lineHeight: 1.5 }}>미팅 질문·제안 포인트·1페이지 진단·후속 카톡, 크레탑 핵심지표 후보까지 정리합니다.</span></div></Card>
    <ContractPrepPack open={prep} initialId={item.id} data={data} setData={setData} goMeeting={goMeeting} onClose={() => setPrep(false)} />
    <CretopCoreCheck open={coreOpen} initialRaw={item.financialRawText || ""} existingCore={item.cretopCore} fileName={getCompanyName(item) || item.name} onSave={(c) => updateCust(data, setData, item.id, { cretopCore: c })} applyLabel="현재 고객 정보에 반영" onApplyToCustomer={(patch) => { if (typeof window !== "undefined" && window.confirm && !window.confirm("크레탑 분석 결과를 현재 고객 정보에 반영할까요? 기존 메모에 분석 요약이 추가되고 회사명·대표자·매출·핵심비율 등이 갱신됩니다.")) return; const prevMemo = item.memo || ""; const merged = { ...patch, memo: prevMemo ? prevMemo + "\n\n" + patch.memo : patch.memo }; updateCust(data, setData, item.id, merged); showToast("고객 정보에 반영했습니다."); }} onClose={() => setCoreOpen(false)} />
    {item.cretopCore && <AccordionSection data={data} setData={setData} screenKey="custDetail" sectionKey="cretopCore" title="🔢 크레탑 핵심지표" subtitle="저장된 핵심 재무·신용 지표 후보 + 1차 미팅 포인트 (원문 확인 필요)" defaultOpen={false}><CretopCoreView core={item.cretopCore} /><div style={{ marginTop: 10 }}><button style={btnSm} onClick={() => setCoreOpen(true)}>핵심지표 다시 점검/수정</button></div></AccordionSection>}
    <div className="heroBtns" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}><button style={btnP} onClick={() => setRep(true)}>📄 방문용 리포트 보기</button><button style={btnS} onClick={() => goMeeting && goMeeting(item.id)}>🤝 미팅 준비 보기</button><MoreActions label="다른 작업 더보기 ▾"><button style={btnS} onClick={() => copyText(buildVisitReport(item, "internal", getReportProfile(data)), () => showToast("복사되었습니다."))}>리포트 복사</button><button style={btnS} onClick={() => copyText(customerShareSummary(item, getReportProfile(data)), () => showToast("복사되었습니다."))}>대표님 공유용 요약 복사</button><button style={btnS} onClick={() => addTodo(data, setData, item, `${getCompanyName(item) || item.name} 다음 액션 점검`)}>➕ 오늘 할 일</button>{onConvert && <button style={{ ...btnS, color: inDB ? C.textM : C.sky, borderColor: inDB ? C.bdr : C.sky }} onClick={() => onConvert(item)}>{inDB ? "고객사에 있음 ↗" : "고객사로 전환"}</button>}</MoreActions></div>
    <VisitReport open={rep} item={item} data={data} setData={setData} onClose={() => setRep(false)} />
    <FinancialDetailCard item={item} />
    <ProcessHub item={item} data={data} setData={setData} goMeeting={goMeeting} />
    <AccordionSection data={data} setData={setData} screenKey="custDetail" sectionKey="proposalIdeas" title="🔗 제안거리·연락거리" subtitle="관련 법령·교육·콘텐츠 주제와 연결 상품, 추천 연락 문구를 자동으로 정리합니다." defaultOpen={false}><CustomerProposalIdeas item={item} data={data} setData={setData} goMeeting={goMeeting} /></AccordionSection>
    <Card style={{ padding: 18 }}><div style={sec}>🚦 영업 단계 · 다음 연락</div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <div><Label>영업 단계 변경</Label><select style={inp} value={pipeColOf(item.stage)} onChange={(e) => changeStage(data, setData, item, e.target.value)}>{PIPELINE.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}</select></div>
      <div><Label>다음 연락 예정일</Label><input type="date" style={inp} value={item.nextDate || ""} onChange={(e) => updateCust(data, setData, item.id, { nextDate: e.target.value })} /></div>
    </div>{(() => { const fs = followStatus(item); return fs ? <div style={{ marginTop: 10 }}><Badge color={fs.c} bg={fs.b}>{fs.t}</Badge></div> : null; })()}<button style={{ ...btnS, marginTop: 12 }} onClick={() => copyText(followUpKakao(item), () => showToast("복사되었습니다."))}>💬 다음 연락 문구 복사</button></Card>
    <AccordionSection data={data} setData={setData} screenKey="custDetail" sectionKey="history" title="📒 미팅/연락 이력">
    {(item.stageHistory || []).length > 0 && <Card style={{ padding: 18 }}><div style={sec}>🧭 진행 이력</div><div style={{ display: "grid", gap: 6 }}>{[...item.stageHistory].reverse().map((h, i) => <div key={i} style={{ fontSize: "calc(var(--s,1.3)*15px)", color: C.textS }}>{h.date.replace(/-/g, ".")} · {h.from} → <b style={{ color: C.gold }}>{h.to}</b></div>)}</div></Card>}
    <Card style={{ padding: 18 }}><div style={sec}>📒 미팅/연락 이력</div>
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 8, marginBottom: 8 }}>
        <input type="date" style={{ ...inp, width: "auto" }} value={cf.date} onChange={(e) => setCf({ ...cf, date: e.target.value })} />
        <select style={inp} value={cf.type} onChange={(e) => setCf({ ...cf, type: e.target.value })}>{CONTACT_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
      </div>
      <input style={{ ...inp, marginBottom: 8 }} value={cf.memo} onChange={(e) => setCf({ ...cf, memo: e.target.value })} placeholder="메모 내용" />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><input style={{ ...inp, flex: 1, minWidth: 160 }} value={cf.nextAction} onChange={(e) => setCf({ ...cf, nextAction: e.target.value })} placeholder="다음 액션(선택)" /><button style={btnP} onClick={() => { if (!cf.memo.trim() && !cf.nextAction.trim()) { showToast("메모를 입력해주세요."); return; } addContact(data, setData, item, cf); setCf({ date: todayISO(), type: "전화", memo: "", nextAction: "" }); }}>이력 추가</button></div>
      <div style={{ display: "grid", gap: 8, marginTop: 12 }}>{(item.contacts || []).length === 0 ? <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*15px)" }}>아직 기록된 이력이 없습니다.</div> : (item.contacts || []).map((ct) => <div key={ct.id} style={{ background: C.bg, borderRadius: 10, padding: 12 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}><div style={{ fontSize: "calc(var(--s,1.3)*15px)" }}><b>{ct.date.replace(/-/g, ".")}</b> · <Badge color={C.sky} bg={C.blueBg}>{ct.type}</Badge></div><button style={{ ...btnSm, color: C.err }} onClick={() => delContact(data, setData, item, ct.id)}>✕</button></div>{ct.memo && <div style={{ fontSize: "calc(var(--s,1.3)*15px)", color: C.textS, marginTop: 6, lineHeight: 1.6 }}>{ct.memo}</div>}{ct.nextAction && <div style={{ fontSize: "calc(var(--s,1.3)*14px)", color: C.textM, marginTop: 4 }}>→ 다음 액션: {ct.nextAction}</div>}</div>)}</div>
    </Card>
    </AccordionSection>
    <AccordionSection data={data} setData={setData} screenKey="custDetail" sectionKey="issue" title="📌 현재 이슈 요약">
    <TextBlock title="📌 현재 이슈 요약 (왜 지금 봐야 하나)" text={currentIssueSummary(item)} />
    </AccordionSection>
    <AccordionSection data={data} setData={setData} screenKey="custDetail" sectionKey="concern" title="🗣 대표님 고민">
    <TextBlock title="🗣 대표님 고민" text={item.concern || item.memo || "입력된 고민 메모가 없습니다. 상담 과정에서 확인이 필요합니다."} />
    </AccordionSection>
    <AccordionSection data={data} setData={setData} screenKey="custDetail" sectionKey="needs" title="🧩 예상 니즈">
    <Card style={{ padding: 18 }}><Label>예상 니즈</Label><div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>{(item.interests || []).length ? item.interests.map((x) => <Badge key={x} color={C.sky} bg={C.blueBg}>{x}</Badge>) : <span style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*15px)" }}>상담 과정에서 확인 필요</span>}</div></Card>
    </AccordionSection>
    <AccordionSection data={data} setData={setData} screenKey="custDetail" sectionKey="reco" title="🎯 제안 우선순위 TOP 3">
    <Card style={{ padding: 18 }}><div style={sec}>🎯 제안 우선순위 TOP 3</div><div style={{ display: "grid", gap: 10 }}>{recos.map((r, i) => <div key={i} style={{ padding: 14, background: C.bg, borderRadius: 12 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}><b style={{ fontSize: "calc(var(--s,1.3)*17px)" }}>{i + 1}. {r.name}</b><Badge color={r.needTaxPro ? C.warn : C.ok} bg={r.needTaxPro ? C.warnBg : C.greenBg}>{r.needTaxPro ? "세무사 검토 권장" : "컨설턴트 설명 가능"}</Badge></div><div style={{ color: C.textS, fontSize: "calc(var(--s,1.3)*15px)", marginTop: 8, lineHeight: 1.6 }}>· 추천 이유: {r.reason}</div><div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*15px)", marginTop: 4, lineHeight: 1.6 }}>· 확인자료: {r.docs.join(", ")}</div><div style={{ color: C.warn, fontSize: "calc(var(--s,1.3)*15px)", marginTop: 4, lineHeight: 1.6 }}>· 주의: {r.risk}</div><div style={{ color: C.textS, fontSize: "calc(var(--s,1.3)*15px)", marginTop: 4, lineHeight: 1.6 }}>· 쉬운 설명: {r.pitch}</div></div>)}</div></Card>
    </AccordionSection>
    <AccordionSection data={data} setData={setData} screenKey="custDetail" sectionKey="pkg" title="📦 추천 상품/패키지 TOP 3">
    <Card style={{ padding: 18 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}><div style={{ ...sec, margin: 0 }}>📦 추천 상품/패키지 TOP 3</div><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><button style={btnP} onClick={() => setProp(true)}>📝 제안서 초안</button><button style={btnS} onClick={() => setScope(true)}>📑 견적/업무범위서</button></div></div><div style={{ display: "grid", gap: 10 }}>{matchedPkgs.map((m, i) => <div key={i} style={{ padding: 14, background: C.bg, borderRadius: 12 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}><b style={{ fontSize: "calc(var(--s,1.3)*16px)" }}>{i + 1}. {m.pkg.name}</b><Badge color={C.blue} bg={C.blueBg}>{m.pkg.cat}</Badge></div><div style={{ color: C.textS, fontSize: "calc(var(--s,1.3)*14px)", marginTop: 6, lineHeight: 1.6 }}>· 추천 이유: {m.reason}</div><div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*14px)", marginTop: 3 }}>· 필요 자료: {(m.pkg.docs || []).slice(0, 4).join(", ")}</div><div style={{ color: C.textS, fontSize: "calc(var(--s,1.3)*14px)", marginTop: 3, lineHeight: 1.6 }}>· 대표님 설명: {m.pkg.simple}</div><div style={{ display: "flex", gap: 6, marginTop: 8 }}><button style={btnSm} onClick={() => copyText(m.pkg.kakao, () => showToast("복사되었습니다."))}>후속 카톡 복사</button></div></div>)}</div></Card>
    </AccordionSection>
    <ProposalDraft open={prop} item={item} pkgs={matchedPkgs.map((m) => m.pkg)} data={data} setData={setData} onClose={() => setProp(false)} />
    <ScopeDoc open={scope} item={item} pkg={matchedPkgs[0] && matchedPkgs[0].pkg} data={data} setData={setData} onClose={() => setScope(false)} />
    <AccordionSection data={data} setData={setData} screenKey="custDetail" sectionKey="pstat" title="🧾 제안 상태">
    <Card style={{ padding: 18 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}><div style={{ ...sec, margin: 0 }}>🧾 제안 상태</div><Badge color={(PROPOSAL_STATE_STYLE[item.proposalStatus || "제안 전"])[0]} bg={(PROPOSAL_STATE_STYLE[item.proposalStatus || "제안 전"])[1]}>{item.proposalStatus || "제안 전"}</Badge></div><select style={inp} value={item.proposalStatus || "제안 전"} onChange={(e) => setProposalStatus(data, setData, item, e.target.value)}>{PROPOSAL_STATES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
      {Number(item.proposalMonthlyPremium) > 0 && (() => { const rr = insuranceSim(item.proposalMonthlyPremium, item.proposalMonths, item.proposalRefundRate); const a = affordability(item.proposalMonthlyPremium, custNetIncomeMan(item), getAffordSettings(data)); return <div style={{ marginTop: 10, padding: "10px 12px", background: C.bg, borderRadius: 10, fontSize: "calc(var(--s,1.3)*13px)", color: C.textS, lineHeight: 1.7 }}>📅 월납 <b>{manToText(item.proposalMonthlyPremium)}</b> × {rr.months}개월 → 7년차 목적자금 <b style={{ color: C.gold }}>{manToText(rr.base)}</b>{(item.proposedPackages || []).length ? <div style={{ color: C.textM, marginTop: 2 }}>제안 항목: {(item.proposedPackages || []).join(" · ")}</div> : null}{a.hasBase ? <div style={{ marginTop: 2 }}>적정성: <b style={{ color: a.color }}>{a.label}</b></div> : null}</div>; })()}
    </Card>
    </AccordionSection>
    <AccordionSection data={data} setData={setData} screenKey="custDetail" sectionKey="contract" title="✅ 계약 준비 체크리스트">
    <Card style={{ padding: 18 }}><div style={sec}>✅ 계약 준비 체크리스트</div><div style={{ display: "grid", gap: 6 }}>{CONTRACT_CHECKLIST.map((c, i) => { const checked = (item.contractChecklist || {})[i]; return <button key={i} onClick={() => updateCust(data, setData, item.id, { contractChecklist: { ...(item.contractChecklist || {}), [i]: !checked } })} style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "left", background: C.bg, border: "1px solid " + C.bdr, borderRadius: 10, padding: "10px 12px", cursor: "pointer", fontFamily: FF, color: checked ? C.ok : C.textS, fontSize: "calc(var(--s,1.3)*15px)" }}><span style={{ fontSize: "calc(var(--s,1.3)*18px)" }}>{checked ? "☑" : "☐"}</span>{c}</button>; })}</div></Card>
    </AccordionSection>
    <AccordionSection data={data} setData={setData} screenKey="custDetail" sectionKey="docs" title="📄 필요한 확인자료">
    <TextBlock title="📄 필요한 확인자료" text={docs.join("\n")} copy />
    </AccordionSection>
    <AccordionSection data={data} setData={setData} screenKey="custDetail" sectionKey="nextact" title="🧭 다음 액션 · 자료 요청">
    <Card style={{ padding: 18 }}><Label>다음 액션</Label><div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "6px 0 12px" }}>{NEXT_ACTIONS.map((a) => <Badge key={a} color={C.gold} bg="#FCEFDA">{a}</Badge>)}</div><button style={btnSm} onClick={() => copyText(buildDocRequestText(item), () => showToast("복사되었습니다."))}>📄 자료 요청 문구 복사</button></Card>
    </AccordionSection>
    <AccordionSection data={data} setData={setData} screenKey="custDetail" sectionKey="report" title="📝 미팅 준비 리포트">
    <Card style={{ padding: 18 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}><div style={sec}>📝 미팅 준비 리포트</div><div className="heroBtns" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button style={btnP} onClick={() => copyText(buildMeetingReport(item), () => showToast("미팅 리포트를 복사했습니다."))}>📋 미팅 리포트 복사</button><button style={btnS} onClick={() => copyText(buildDocRequestText(item), () => showToast("복사되었습니다."))}>📄 확인자료 요청 복사</button><button style={btnS} onClick={() => copyText(kakaos[2][1], () => showToast("복사되었습니다."))}>💬 미팅 후 카톡 복사</button></div></div><div style={{ whiteSpace: "pre-line", color: C.textS, fontSize: "calc(var(--s,1.3)*16px)", lineHeight: 1.8, background: C.card2, border: `1px solid ${C.bdr}`, borderRadius: 12, padding: 16 }}>{buildMeetingReport(item)}</div></Card>
    </AccordionSection>
    <AccordionSection data={data} setData={setData} screenKey="custDetail" sectionKey="kakao" title="💬 상황별 후속 카톡 3종">
    <Card style={{ padding: 18 }}><div style={sec}>💬 상황별 후속 카톡 3종</div><div style={{ display: "grid", gap: 10 }}>{kakaos.map((k, i) => <TextBlock key={i} title={k[0]} text={k[1]} copy />)}</div></Card>
    </AccordionSection>
  </div>;
}

// ── 고객 직접 등록(수동) 지원 ─────────────────────────────────────
const CUST_FLAGS = [
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
// ── 재무자료 자동 추출(텍스트 기반 · 100% 확정 아님, 모두 '추출 후보') ──────────
const FIN_SOURCES = ["크레탑", "나이스비즈라인", "보험사 재무자료", "재무제표 PDF", "스크린샷", "기타"];
const FIN_SOURCE_LABEL = {
  "크레탑": "크레탑 기업종합보고서 (현재 분석 지원)",
  "나이스비즈라인": "나이스비즈라인 (추후 보완 예정)",
  "보험사 재무자료": "보험사 재무자료 (추후 보완 예정)",
  "재무제표 PDF": "일반 재무제표 PDF (추후 보완 예정)",
  "스크린샷": "스크린샷/이미지 (추후 고도화 예정)",
  "기타": "기타 (텍스트 붙여넣기만 참고 분석)",
};
const FIN_SOURCE_HINT = {
  "크레탑": "크레탑 기업종합보고서 PDF를 우선 지원합니다. 섹션별 단위(백만원/천원)와 연도를 구분해 추출합니다.",
  "나이스비즈라인": "추후 보완 예정입니다. 지금은 표 부분을 복사해 붙여넣으면 참고 분석됩니다.",
  "보험사 재무자료": "추후 보완 예정입니다. 단위 표기를 확인 후 텍스트로 붙여넣어 주세요.",
  "재무제표 PDF": "추후 보완 예정입니다. 계정명·금액 단위를 확인 후 텍스트로 붙여넣어 주세요.",
  "스크린샷": "이미지 인식(OCR)은 추후 고도화 예정입니다. 텍스트 복사 입력을 권장합니다.",
  "기타": "자료 형식에 따라 일부 항목만 참고 분석됩니다.",
};
const FIN_WARNING = "자동 추출 결과는 1차 검토용입니다. 자료 형식·단위·OCR 상태에 따라 오류가 있을 수 있으므로 저장 전 반드시 확인해주세요. 적용 여부는 세부 요건 확인과 세무사 검토가 필요합니다.";
const FIN_SAMPLE = "대성정밀(주), 제조업, 매출액 35억원, 직원 26명, 대표 58세, 가지급금 2.4억원, 미처분이익잉여금 8억원, 단기차입금 5억원, 연구소 없음, 자녀 근무, 정관 미점검";
// 크레탑 요약형(단위 천원·단일 표) 테스트 샘플 — '크레탑 샘플 텍스트 넣기' 버튼이 사용
const CRETOP_SAMPLE = "단위 : 천원\n기업명 대성정밀(주)\n대표자 김상호\n업종 제조업\n종업원수 26명\n매출액 3,500,000\n영업이익 420,000\n당기순이익 310,000\n자산총계 5,800,000\n부채총계 2,700,000\n자본총계 3,100,000\n부채비율 87.1\n유동비율 145.2\n단기차입금 500,000\n장기차입금 700,000\n가지급금 240,000\n미처분이익잉여금 800,000\n연구소 없음\n자녀 근무\n정관 미점검";
// 크레탑 다년 표(섹션별 단위·연도 구분) 테스트 샘플 — 전부 가상 데이터(실제 업체 정보 아님)
const CRETOP_SAMPLE_MULTI = ["기업종합보고서 (가상 예시)",
  "조회일시 : 2024-03-10 09:00:00",
  "기업개요",
  "기업명 샘플정밀(주)",
  "대표자명 김샘플",
  "사업자번호 000-00-00000",
  "종업원수 26명",
  "설립년월 2016-03-15",
  "업종 전자부품 제조업",
  "기업규모 소기업",
  "요약 손익계산서 단위:백만원",
  "구분 2021 2022 2023",
  "매출액 1,250 1,860 2,430",
  "영업이익 80 140 210",
  "당기순이익 55 100 160",
  "요약 재무상태표 단위:백만원",
  "구분 2021 2022 2023",
  "자산총계 900 1,150 1,420",
  "부채총계 520 610 720",
  "자본총계 380 540 700",
  "재무상태표 단위 :천원",
  "구분 2021 2022 2023",
  "자산총계 900,000 1,150,000 1,420,000",
  "부채총계 520,000 610,000 720,000",
  "자본총계 380,000 540,000 700,000",
  "미처분이익잉여금 250,000 380,000 520,000",
  "재무구조",
  "구분 2021 2022 2023",
  "부채비율 136.8 113.0 102.9",
  "유동비율 145.2 168.4 191.7",
  "이자보상배수 8.5 12.3 18.6"].join("\n");
// PDF 텍스트 추출 — pdf.js는 상단에서 정적 import(pdfjsLib). 워커는 ?url 정적 에셋(workerSrc).
function getPdfjs() { return pdfjsLib; }
async function extractPdfText(file, onProgress) {
  const pdfjs = getPdfjs();
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false, useSystemFonts: true }).promise;
  let out = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let line = "";
    content.items.forEach((it) => { if (it && typeof it.str === "string") line += it.str + (it.hasEOL ? "\n" : " "); });
    out += line + "\n";
    if (onProgress) onProgress(i, doc.numPages);
  }
  try { await doc.destroy(); } catch (e) {}
  return out;
}
// 좌표 기반 추출 — page별 text item의 x/y/width/height를 보존하고, 행/열을 복원한 lines와 rawText·layoutText를 함께 반환.
async function extractPdfLayout(file, onProgress) {
  const pdfjs = await getPdfjs();
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false, useSystemFonts: true }).promise;
  const pages = []; let rawText = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const items = [];
    let rline = "";
    content.items.forEach((it) => {
      if (!it || typeof it.str !== "string") return;
      rline += it.str + (it.hasEOL ? "\n" : " ");
      if (it.str.trim() === "") return;
      const tr = it.transform || [1, 0, 0, 1, 0, 0];
      items.push({ text: it.str, x: tr[4], y: tr[5], w: it.width || 0, h: it.height || Math.abs(tr[3]) || 10 });
    });
    rawText += rline + "\n";
    const lines = groupItemsIntoLines(items);
    pages.push({ pageNo: i, items, lines });
    if (onProgress) onProgress(i, doc.numPages);
  }
  try { await doc.destroy(); } catch (e) {}
  const layoutText = pages.map((p) => (p.lines || []).map((l) => l.text).join("\n")).join("\n").trim();
  return { rawText, layoutText, pages, numPages: doc.numPages, chars: (layoutText || rawText || "").length, fileName: file && file.name };
}
const FIN_UNIT_WON = { "억원": 1e8, "억": 1e8, "백만원": 1e6, "백만": 1e6, "천원": 1e3, "천": 1e3, "만원": 1e4, "만": 1e4, "원": 1 };
function finParseWon(numStr, unit) { const n = parseFloat(String(numStr).replace(/,/g, "")); if (!isFinite(n)) return null; if (unit && FIN_UNIT_WON[unit] != null) return { won: n * FIN_UNIT_WON[unit], sure: true }; return { won: n, sure: false }; }
function finWonDisplay(won) { const a = Math.abs(won); if (a >= 1e8) return (Math.round((won / 1e8) * 10) / 10).toLocaleString() + "억원"; if (a >= 1e4) return Math.round(won / 1e4).toLocaleString() + "만원"; return Math.round(won).toLocaleString() + "원"; }
function finGrab(text, labels, gu) { for (const lab of labels) { try { const re = new RegExp(lab + "[^0-9\\-]{0,6}([0-9][0-9,\\.]*)\\s*(억원|억|백만원|백만|천원|천|만원|만|원)?", ""); const m = text.match(re); if (m) { const inlineU = m[2]; const p = finParseWon(m[1], inlineU || gu); if (p) return { ...p, raw: m[0].trim(), unitSrc: inlineU ? "inline" : (gu ? "global" : "none") }; } } catch (e) {} } return null; }
// ── 크레탑 기업종합보고서 표 전용 파서 ──
// 핵심: 공백을 없애지 않고 줄/컬럼을 보존해 '계정명 + 연도별 숫자'를 분리한다(여러 해 숫자를 절대 합치지 않음).
// 섹션별로 단위(백만원/천원/%)가 다르므로 섹션 단위로 단위를 적용하고, 최신 연도 값을 기본 적용 후보로 쓴다.
import { CRETOP_UNIT_EOK, cretopToEok, cretopEokText, CRETOP_ACCT, CRETOP_RATIO, cretopNum, cretopRowNums, CRETOP_HEADER_WORD, matchRatioLead, cretopSection, parseCretopTables, groupItemsIntoLines, splitLabelNumCells, parseCretopLayout, cretopDebug, validateAmountEok, parseNumLoose, inlineNums, cretopPickLatest, buildCoreMetrics, normalizeAccountLabel, CRETOP_FINAL_ACCT, CRETOP_FINAL_RATIO, FINAL_UNIT_EOK, CORE_LABEL_KR, CORE_ORDER, cretopYearHeader, parseAcctRow, cretopSecOf, cretopBuildBlocks, CRETOP_EXTRACT_ACCT, CRETOP_EXTRACT_RATIO, EXTRACT_LABEL_KR, EXTRACT_ORDER, EXTRACT_STATUS, EXTRACT_UNITS, extractRowEok, extractEokText, extractCretopNumbers, extractRowsToCsv, extractRowsToText, CRETOP_EXTRACT_SAMPLE, cretopCharSpaced, cretopTileDecimalRun, cretopReassembleNumberRun, compactKoreanAndNumberSpacing, normalizeCretopLine, normalizeCretopPdfText, extractNumbersFromCretopLine, cretopNumTokens, cretopIsBareYear, cretopValuesIn, cretopLineYears, cretopLineAcct, analyzeCretopRaw, splitCretopCompactNumbersByYears, cretopRowRank, cretopSplitLineMetrics, extractCretopCandidatesFromLines, selectBestCretopCoreCandidates, CORE_ACCT, CORE_RATIO, CORE_LABELS, CORE_PREVIEW_ORDER, CRETOP_RATIO_CATS, CORE_TREND_ORDER, CRETOP_RATIO_AREAS, CRETOP_DETAIL_GROUPS, CRETOP_DETAIL_NONFIN, normalizeDetailLabel, CRETOP_BS_ORDER, CRETOP_BS_ORDER_MAP, cretopBsOrderIndex, cretopSortBsItems, parseCretopDetailRow, extractCretopDetail, normalizeRatioMetricName, CRETOP_RATIO_TEXTVAL, parseRatioRow, extractCretopFullRatioTable, cretopFullRatioRows, cretopRowTrend, cretopTrendComment, cretopTrendCommentRich, CRETOP_PREVIEW_TONES, cretopGradeTone, cretopPreviewTone, cretopGradeRow, extractCretopGrades, extractCretopCompanyInfo, extractCretopExternalInfo, extractCretopCore, CRETOP_UF, UF_TO_MILLION, toMillionWon, buildCretopParsedForUi, cretopCashflowGradeInfo, cretopCoreDebug, CRETOP_CORE_SAMPLE, cretopDebugJson, buildCretopFinalCoreMetrics, buildFinPreview, CRETOP_SAMPLE_TABLES, parseCretopPastedTables, CRETOP_CORE6, cretopCoreFoundCount } from "../../cretop/engine/index.js";
function downloadTextFile(text, filename, mime) { if (typeof document === "undefined") return false; try { const blob = new Blob([text], { type: mime || "text/plain;charset=utf-8;" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 1000); return true; } catch (e) { return false; } }
const CRETOP_WEAPONS = [
  { cat: "자금·보증·정부사업", items: [
    { name: "정책자금·보증·대출", p: "운전자금 부담이나 고금리 대출이 있는 대표자는 바로 관심을 가질 수 있는 주제입니다.", r: "차입금 증가, 보증 한도, 기존 대출 금리와 만기를 함께 확인해볼 수 있습니다.", q: "현재 이용 중인 대출·보증 기관과 금리, 만기는 어떻게 구성되어 있으신가요?", d: "정책자금 공고, 보증서, 대출잔액증명, 금리조건, 최근 재무제표" },
    { name: "대환대출·금리조건 점검", p: "기존 대출금리가 높거나 만기가 몰려 있으면 비용 절감 체감이 클 수 있는 주제입니다.", r: "기존 금리, 만기, 보증기관, 담보 여부를 기준으로 대환 또는 조건 조정 여지를 확인해볼 수 있습니다.", q: "현재 가장 부담되는 대출의 금리와 만기는 어떻게 되어 있으신가요?", d: "대출내역, 금리조건, 보증서, 담보내역" },
    { name: "정부지원사업", p: "신규 투자나 마케팅·수출·고용 계획이 있으면 관심을 가질 수 있는 주제입니다.", r: "업종, 지역, 투자계획, 고용계획에 맞는 공고를 검토 후보로 볼 수 있습니다.", q: "올해 새로 투자하거나 확장하려는 사업 방향이 있으신가요?", d: "정부지원사업 공고, 사업계획서, 매출자료, 고용계획" },
    { name: "R&D 과제/정부과제", p: "개발비가 계속 들어가는데 자체 비용으로만 처리 중이라면 관심을 가질 수 있는 주제입니다.", r: "개발 아이템, 전담 인력, 기존 연구개발비, 과제 수행 가능성을 확인해볼 수 있습니다.", q: "현재 개발 중인 제품이나 공정 개선 과제가 있으신가요?", d: "개발계획서, 연구인력 현황, 개발비 내역, 기술자료" },
    { name: "수출바우처/마케팅지원사업", p: "수출이나 신규 판로·마케팅을 준비 중인 대표자가 관심을 가질 수 있는 주제입니다.", r: "수출 실적, 목표 시장, 마케팅 계획을 기준으로 지원사업 적합성을 확인해볼 수 있습니다.", q: "수출이나 온라인·해외 판로 확대를 계획하고 계신가요?", d: "수출실적, 사업계획, 마케팅 계획, 매출자료" },
  ] },
  { cat: "인증·R&D·지식재산", items: [
    { name: "연구소/전담부서", p: "법인세나 종합소득세 부담을 줄일 방법을 찾는 대표자에게 관심도가 높은 주제입니다.", r: "연구인력, 연구공간, 개발비 구분, 연구노트 관리 여부를 확인해볼 수 있습니다.", q: "개발 업무를 담당하는 인력이나 연구개발성 비용이 따로 있으신가요?", d: "연구개발비 세액공제 검토, 연구인력 현황, 개발비 계정, 연구노트" },
    { name: "벤처인증", p: "자금·세제·부동산 취득 비용까지 연결될 수 있어 성장기업 대표가 관심을 가질 수 있는 주제입니다.", r: "벤처유형, 기술성, 투자유형, 연구개발비, 인증 갱신 시점을 확인해볼 수 있습니다.", q: "벤처 인증을 자금, 정부사업, 세제 검토 자료로 활용하고 계신가요?", d: "법인세/소득세 감면 검토, 취득세 감면 검토, 정책자금·정부사업 가점 검토, 인증서" },
    { name: "이노비즈", p: "기술기업으로 보이는 자료가 필요하거나 자금·입찰·거래처 신뢰도 자료가 필요한 대표자가 관심을 가질 수 있습니다.", r: "기술혁신성, 인증 갱신, 정책자금·입찰 활용 여부를 확인해볼 수 있습니다.", q: "이노비즈 인증을 자금이나 입찰, 거래처 신뢰도 자료로 활용하고 계신가요?", d: "인증서, 기술자료, 정책자금 자료, 입찰자료" },
    { name: "메인비즈", p: "기술보다 경영혁신·마케팅·조직운영 강점이 있는 회사라면 검토해볼 수 있는 주제입니다.", r: "경영혁신 활동, 조직관리, 마케팅·운영 개선 자료를 확인해볼 수 있습니다.", q: "경영혁신이나 조직운영 측면에서 외부 인증을 검토하신 적이 있으신가요?", d: "경영혁신 활동자료, 인증요건표, 기업소개서" },
    { name: "ISO 인증", p: "거래처 요구나 입찰 가점이 필요한 대표자가 관심을 가질 수 있는 주제입니다.", r: "거래처 요구 수준, 품질·환경·안전 체계, 입찰 가점 여부를 확인해볼 수 있습니다.", q: "거래처에서 ISO 등 품질·환경 인증을 요구받으신 적이 있으실까요?", d: "거래처 요구사항, 품질매뉴얼, 입찰 자격요건" },
    { name: "특허/지식재산권", p: "기술이나 브랜드를 보호하고 싶거나 인증·정책자금 가점이 필요한 대표자가 관심을 가질 수 있습니다.", r: "보유 권리, 출원 계획, 직무발명보상제도 요건을 확인해볼 수 있습니다.", q: "특허·상표·디자인 등 보유 권리나 출원 계획이 있으실까요?", d: "보유 권리 목록, 직무발명보상 규정, 기술·브랜드 자료" },
    { name: "소재·부품·장비/기술기업 인증 후보", p: "제조·기술 기반 기업이 거래처 신뢰도나 정부사업 가점을 원할 때 검토해볼 수 있는 주제입니다.", r: "주력 품목, 기술 분류, 인증 요건 적합성을 확인해볼 수 있습니다.", q: "소재·부품·장비나 특정 기술 분야로 분류될 만한 주력 제품이 있으실까요?", d: "제품 자료, 기술 분류 자료, 거래처 현황" },
  ] },
  { cat: "인사·고용·복지", items: [
    { name: "고용지원금", p: "직원을 뽑았거나 채용 계획이 있으면 놓치기 쉬운 현금성 혜택 검토 주제입니다.", r: "최근 채용자, 청년 여부, 고용보험 가입기간, 지원금 신청 이력을 확인해볼 수 있습니다.", q: "최근 1년 내 채용한 직원이나 올해 채용 계획이 있으신가요?", d: "청년일자리도약장려금 등 고용지원금 검토, 근로계약서, 급여대장, 4대보험 가입내역" },
    { name: "통합고용세액공제", p: "직원 수가 늘어난 회사는 세금 부담과 연결해 관심을 가질 수 있는 주제입니다.", r: "상시근로자 수 증가, 청년·장애인·경력단절 인력 여부, 전년 대비 고용 변화를 확인해볼 수 있습니다.", q: "전년 대비 직원 수가 늘었거나 올해 채용 계획이 있으신가요?", d: "상시근로자 수, 급여대장, 원천세 신고자료, 고용보험 자료" },
    { name: "청년고용/인건비 지원", p: "청년 인력을 채용했거나 인건비 부담이 큰 대표자가 관심을 가질 수 있는 주제입니다.", r: "청년 채용 여부, 고용 유지기간, 인건비 지원 요건을 확인해볼 수 있습니다.", q: "청년 인력 채용이나 인건비 부담에 대한 고민이 있으신가요?", d: "근로계약서, 급여대장, 4대보험 가입내역, 채용계획" },
    { name: "사내근로복지기금", p: "직원 복지를 늘리면서 법인 자금 운용과 비용처리 구조를 함께 고민하는 대표자가 관심을 가질 수 있습니다.", r: "직원 수, 복지비 지출, 장기근속자 관리, 기금 출연 여력을 확인해볼 수 있습니다.", q: "직원 복지나 장기근속자 관리를 위해 별도로 고민 중인 제도가 있으신가요?", d: "복지비 내역, 직원 수, 급여대장, 기금 설립 자료" },
    { name: "급여대장/4대보험 점검", p: "인건비·4대보험 신고 구조를 정리하면 지원사업·세액공제와 연결될 수 있는 주제입니다.", r: "급여대장과 4대보험 신고 일치 여부, 비과세 항목, 지원사업 연계를 확인해볼 수 있습니다.", q: "급여대장이나 4대보험 신고는 어떻게 관리하고 계신가요?", d: "급여대장, 4대보험 가입내역, 원천세 신고자료" },
    { name: "임금체계/상여금/퇴직금 점검", p: "임금·상여·퇴직금 규정이 정리되지 않은 회사는 비용처리나 분쟁 리스크 관점에서 관심을 가질 수 있습니다.", r: "임금체계, 상여 지급 기준, 퇴직금 규정과 적립 방식을 확인해볼 수 있습니다.", q: "임금·상여·퇴직금 지급 기준이 규정으로 정리되어 있으신가요?", d: "급여대장, 취업규칙, 퇴직금 규정, 보수규정" },
  ] },
  { cat: "세무·자본거래", items: [
    { name: "가지급금", p: "대표자 가지급금은 인정이자, 상여처분, 세무 리스크로 이어질 수 있어 민감도가 높은 주제입니다.", r: "가지급금 잔액, 발생 원인, 특수관계자 거래, 상환 계획을 확인해볼 수 있습니다.", q: "대표님이나 특수관계자와 회사 간 미정리 자금거래가 있으실까요?", d: "계정별원장, 가지급금 잔액, 주주임원 거래내역" },
    { name: "가수금 출자전환", p: "대표자 개인자금이 회사에 들어가 있다면 부채비율 개선과 자본구조 정리에 연결될 수 있는 주제입니다.", r: "가수금 잔액, 대표자 자금 투입 내역, 자본금·부채비율 변화를 확인해볼 수 있습니다.", q: "대표님 개인자금이 회사 운영자금으로 들어간 내역이 있으신가요?", d: "가수금 계정, 주주임원 차입금 내역, 법인등기부, 정관" },
    { name: "미처분이익잉여금", p: "이익은 쌓였는데 정리 방향이 없으면 배당·퇴직금·주식가치·승계 이슈로 연결될 수 있습니다.", r: "누적 이익, 배당 이력, 임원퇴직금 규정, 주주구성을 확인해볼 수 있습니다.", q: "누적 이익을 배당, 퇴직금, 목적자금 중 어떤 방향으로 정리할 계획이 있으신가요?", d: "이익잉여금, 정관, 임원퇴직금 규정, 주주명부" },
    { name: "이익소각", p: "주식가치가 높아 승계·양도 부담이 큰 대표자가 검토해볼 수 있는 주제입니다.", r: "주주구성, 이익잉여금, 주식가치, 소각 재원을 확인해볼 수 있습니다.", q: "주주구성이나 지분 정리, 주식가치 관리에 대한 고민이 있으실까요?", d: "주주명부, 이익잉여금, 주식가치 자료, 정관" },
    { name: "배당정책", p: "이익이 쌓였지만 배당 기준이 없는 회사가 검토해볼 수 있는 주제입니다.", r: "이익 수준, 주주구성, 배당 이력과 세부담을 확인해볼 수 있습니다.", q: "배당을 정기적으로 하고 계신지, 어떤 기준으로 보고 계신가요?", d: "이익잉여금, 주주명부, 배당 이력, 재무제표" },
    { name: "임원보수/임원퇴직금", p: "대표자 퇴직금은 사전에 규정이 없으면 나중에 비용처리나 세무 이슈가 생길 수 있습니다.", r: "정관, 보수규정, 퇴직금 지급규정, 재직기간과 보수 수준을 확인해볼 수 있습니다.", q: "임원 보수와 퇴직금 지급 기준이 정관이나 규정에 정리되어 있으신가요?", d: "정관, 임원퇴직금 규정, 이사회/주총 의사록, 급여대장" },
    { name: "정관정비", p: "임원보수·퇴직금·주식양도·배당 조항이 오래된 회사는 정비 필요성을 검토해볼 수 있습니다.", r: "현행 정관 조항, 임원퇴직금·보수 규정, 주식양도 제한 조항을 확인해볼 수 있습니다.", q: "최근 정관이나 임원퇴직금 규정을 점검하신 적이 있으신가요?", d: "정관, 임원퇴직금 규정, 주주명부, 등기부" },
    { name: "특수관계자 거래 점검", p: "가족·관계회사와 거래가 많은 회사는 세무 리스크 관점에서 관심을 가질 수 있는 주제입니다.", r: "특수관계자 범위, 거래 유형, 가격 적정성, 가지급·가수금을 확인해볼 수 있습니다.", q: "가족이나 관계회사와의 거래, 자금 대여가 있으실까요?", d: "계정별원장, 특수관계자 거래내역, 법인등기부" },
    { name: "법인세/소득세 절세 구조 검토", p: "세부담이 커지는 구간의 대표자가 합법적 절세 구조를 검토해볼 수 있는 주제입니다.", r: "이익 수준, 비용 구조, 인증·세액공제 적용 여지, 자본거래 여부를 확인해볼 수 있습니다.", q: "최근 세부담이 커졌다고 느끼시거나 정리하고 싶은 항목이 있으실까요?", d: "재무제표, 세무조정계산서, 계정별원장, 인증·공제 자료" },
  ] },
  { cat: "승계·지분·리스크", items: [
    { name: "가업승계", p: "자녀 승계나 지분 이전을 고민하는 대표자에게 장기적으로 중요한 주제입니다.", r: "주주구성, 후계자 참여 여부, 기업가치, 가업승계 요건을 확인해볼 수 있습니다.", q: "향후 자녀 승계나 지분 이전 계획을 고민하고 계신가요?", d: "주주명부, 가족관계, 기업가치 자료, 정관, 재무제표" },
    { name: "지분구조 정리", p: "주주가 분산되어 있거나 명의 정리가 필요한 회사가 검토해볼 수 있는 주제입니다.", r: "주주구성, 지분 비율, 명의신탁·차명 여부를 확인해볼 수 있습니다.", q: "현재 주주구성이나 지분 비율에 정리하고 싶은 부분이 있으실까요?", d: "주주명부, 등기부, 주식변동 내역" },
    { name: "자녀법인/관계회사 구조", p: "관계회사나 자녀법인과 거래가 있는 회사가 구조 점검을 검토해볼 수 있는 주제입니다.", r: "관계회사 거래 구조, 일감 배분, 세무·승계 영향을 확인해볼 수 있습니다.", q: "관계회사나 가족이 운영하는 법인과의 거래가 있으실까요?", d: "법인등기부, 거래내역, 지분구조 자료" },
    { name: "M&A/양수도 검토", p: "사업 일부 매각이나 인수합병을 고민하는 대표자가 장기 검토해볼 수 있는 주제입니다.", r: "사업 구조, 기업가치, 양수도 방식, 세무 영향을 확인해볼 수 있습니다.", q: "사업 매각이나 인수에 대해 고민해보신 적이 있으실까요?", d: "재무제표, 기업가치 자료, 사업 현황, 주주명부" },
    { name: "법인보험/목적자금", p: "대표자 유고, 상속·승계 재원, 임원퇴직금 준비와 연결되는 주제입니다.", r: "기존 보험, 보장 공백, 목적자금 규모, 납입 유지 가능성을 확인해볼 수 있습니다.", q: "대표자 리스크나 퇴직·승계 목적자금은 별도로 준비하고 계신가요?", d: "기존 보험증권, 임원퇴직금 규정, 재무제표, 현금흐름" },
    { name: "대표자 유고/상속재원 점검", p: "대표자 의존도가 높은 회사는 유고 시 자금·승계 공백을 검토해볼 수 있는 주제입니다.", r: "대표자 의존도, 상속 대상 자산, 재원 준비 여부를 확인해볼 수 있습니다.", q: "대표님 유고 시 회사 운영과 상속 재원에 대해 준비하고 계신 부분이 있으실까요?", d: "주주명부, 자산 현황, 보험증권, 재무제표" },
    { name: "주주간 리스크 점검", p: "공동대표나 다수 주주가 있는 회사가 분쟁·이탈 리스크를 검토해볼 수 있는 주제입니다.", r: "주주구성, 주주간 약정, 의결권·지분 분포를 확인해볼 수 있습니다.", q: "주주간 약정이나 지분 정리에 대해 정해둔 기준이 있으실까요?", d: "주주명부, 주주간 약정서, 정관, 등기부" },
  ] },
];
const CRETOP_WEAPON_MAP = (() => { const m = {}; CRETOP_WEAPONS.forEach((g) => g.items.forEach((it) => { m[it.name] = it; })); return m; })();
// 신용등급이 낮은 편(CCC 이하·C·D)인지 — 1차 미팅 포인트 판단용(비단정 톤). 텍스트 신용등급이 추출됐을 때만 사용
function cretopGradeIsLow(grade) { const s = String(grade || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); if (!s) return false; return /^(CCC|CC|C|D|R)/.test(s); }
// 핵심지표 후보 → 1차 미팅 포인트(비단정 톤). computed=corePreview(최신 재무제표 연도 계산비율) — 비율 판단은 계산값을 우선
function buildCretopMeetingPoints(rows, company, external, computed) {
  const m = {}; (rows || []).forEach((r) => { if (r.status === "제외") return; if (!m[r.accountKey] || cretopRowRank(r) > cretopRowRank(m[r.accountKey])) m[r.accountKey] = r; });
  const eok = (k) => { const r = m[k]; return r && !r.isGrade ? extractRowEok(r) : null; };
  const ratio = (k) => { const r = m[k]; return r ? parseNumLoose(r.rawValue) : null; };
  const cp = computed || {}; const cpVal = (k) => (cp[k] && typeof cp[k].value === "number") ? cp[k].value : null;
  const revE = eok("revenue"), opE = eok("operatingProfit"), niE = eok("netIncome"), retE = eok("retainedEarnings");
  // 비율은 최신 재무제표 기준 계산값 우선(없으면 후보행 값). 유동비율 200%+인데 '낮은 편'으로 잘못 나오는 문제 방지
  const debt = cpVal("debtRatio") != null ? cpVal("debtRatio") : ratio("debtRatio");
  const cur = cpVal("currentRatio") != null ? cpVal("currentRatio") : ratio("currentRatio");
  const icr = cpVal("interestCoverageRatio") != null ? cpVal("interestCoverageRatio") : ratio("interestCoverageRatio");
  let opMargin = ratio("opMargin"); if (opMargin == null && revE && opE != null) opMargin = revE > 0 ? (opE / revE * 100) : null;
  let netMargin = ratio("netMargin"); if (netMargin == null && revE && niE != null) netMargin = revE > 0 ? (niE / revE * 100) : null;
  const grade = m.creditGrade ? m.creditGrade.rawValue : null;
  const ind = company && company.industry || ""; const emp = Number(company && company.employees) || 0;
  // 3개년 추이/비율 기반 동적 포인트(전년 대비 방향 반영)
  const trend = (k) => { const r = m[k]; return r ? cretopRowTrend(r) : null; };
  const tRev = trend("revenue"), tOp = trend("operatingProfit"), tNi = trend("netIncome");
  const debtDep = trend("debtDependency");
  const cfRow = m.cashflowGrade; const cfSeries = cfRow && cfRow.gradeSeries ? cfRow.gradeSeries : null;
  const cfWorse = cfSeries && cfSeries.length >= 2 && (() => { const a = parseInt(String(cfSeries[cfSeries.length - 2]).replace(/\D/g, ""), 10), b = parseInt(String(cfSeries[cfSeries.length - 1]).replace(/\D/g, ""), 10); return !isNaN(a) && !isNaN(b) && b > a; })();
  const ext = external || {};
  const points = []; const questions = []; const risks = []; const proposals = []; const docs = new Set();
  const add = (title, q, r, p, dd, sev) => { points.push({ title, q: q || "", sev: sev || 1 }); if (q) questions.push(q); if (r) risks.push(r); if (p) proposals.push(p); (dd || []).forEach((x) => docs.add(x)); };
  if (cfWorse) add(`현금흐름등급이 악화된 편(${cfSeries.join("→")}) — 운전자금·회수기간·재고·차입구조 점검 후보`, "현금흐름이 빡빡해진 부분이 있으신가요? 매출채권 회수나 재고는 어떠신가요?", "현금흐름등급 악화는 운전자금·회수기간·재고·차입 구조 자료 확인 후 판단 필요", "자금·지원금 / 운전자금 점검", ["현금흐름표", "매출채권·재고 명세"], 6);
  if (ext.hasResearchInst || /제조|IT|소프트|개발|기술|연구/.test(ind)) add("연구개발 활동/부설연구소 관련 — 연구소·전담부서·연구개발비 세액공제 점검 후보", "연구개발 인력이나 부설연구소 운영 현황은 어떻게 되시나요?", "연구개발 활동이 있으면 연구소·전담부서·세액공제 요건 자료 확인 후 판단 필요", "인증·연구소 / 지식재산", ["연구개발 인력 현황", "연구개발비 내역"]);
  if (ext.certNames && ext.certNames.length) add(`기업인증 보유(${ext.certNames.join("·")}) — 인증 갱신·활용·신뢰도 자료 점검 후보`, "보유하신 인증의 갱신 시점이나 활용 계획은 어떻게 보고 계신가요?", "인증은 갱신·활용·요건 유지 자료 확인 후 판단 필요", "인증·연구소", ["인증서 사본", "인증 갱신 일정"]);
  if (ext.ip && ext.ip.some((x) => x.count > 0)) add("산업재산권 보유 — 지식재산 관리·직무발명보상제도 점검 후보", "특허·디자인 등 지식재산 관리나 직무발명보상제도 운영은 어떠신가요?", "산업재산권은 권리 유지·직무발명보상제도 요건 자료 확인 후 판단 필요", "지식재산·브랜딩", ["산업재산권 목록", "직무발명보상 규정"]);
  if (ext.bid && (ext.bid.tenders || ext.bid.wins)) add("나라장터 입찰 이력 — 공공조달·입찰·정책자금·신용도 관리 점검 후보", "공공조달이나 입찰 비중이 어느 정도이신가요? 신용도 관리는 어떻게 하고 계신가요?", "공공조달 비중·입찰 신용도는 자료 확인 후 판단 필요", "신용·보증·성장지원 / 자금·지원금", ["입찰·낙찰 내역", "신용평가 내역"]);
  if (tRev && tRev.dir === "하락") add("매출이 전년 대비 감소 — 주요 거래처·수주·단가·제품군 변화 점검 후보", "최근 매출이 줄어든 데에는 어떤 요인이 있었나요? (거래처·단가·수주)", "매출 감소 원인은 거래처·단가·제품군 자료 확인 후 판단 필요", "원가·매출 구조 점검", ["손익계산서", "거래처별 매출"], 5);
  if (tNi && tNi.dir === "하락") add("당기순이익 감소 — 영업외비용·이자비용·법인세·일회성 비용 점검 후보", "순이익이 줄어든 부분에 영업외비용이나 이자비용 영향이 있었나요?", "순이익 감소는 영업외·이자·법인세 항목 자료 확인 후 판단 필요", "세무·정관 / 비용 구조 점검", ["손익계산서", "이자비용 내역"], 5);
  if (debt != null && cur != null && debt < 100 && cur >= 150) add("부채비율 낮고 유동비율 높은 편 — 재무 안정성은 양호해 보이나 현금흐름·운전자금 구조 확인 후보", "재무는 안정적으로 보이는데, 현금흐름이나 운전자금 운용은 어떻게 하고 계신가요?", "안정성은 양호해 보이나 현금흐름·운전자금 구조는 원문 기준 확인 필요", "자금·지원금 / 운전자금 점검", ["재무제표", "현금흐름표"]);
  if (cur != null && cur >= 150 && eok("cash") != null && eok("cash") < 1) add("유동비율은 높지만 현금성자산이 적은 편 — 재고·매출채권·단기자산 구성 확인 후보", "유동자산 중 현금 외에 재고나 매출채권 비중은 어느 정도인가요?", "유동비율이 높아도 현금성자산이 적으면 자산 구성 확인 필요", "운전자금 점검", ["재무상태표", "재고·매출채권 명세"], 4);
  if (debtDep && debtDep.dir === "상승") add("차입금의존도 상승 — 보증·대출 구조와 리파이낸싱 검토 후보", "차입금이 늘어난 배경과 상환·차환 계획은 어떻게 보고 계신가요?", "차입금의존도 상승은 보증·대출 구조 자료 확인 후 판단 필요", "신용·보증·성장지원 / 자금·지원금", ["대출/보증 내역", "재무제표"], 5);
  if (revE && opMargin != null && opMargin < 5) add("매출 대비 영업이익률이 낮은 편 — 원가·판관비·가격정책 점검 후보", "매출원가나 판관비 중 부담이 큰 항목은 무엇인가요?", "영업이익률이 낮으면 비용 구조 점검이 우선 필요", "세무·정관 / 원가·비용 구조 점검", ["손익계산서", "계정별원장"], 4);
  if (niE != null && (niE >= 1.5 || (netMargin != null && netMargin >= 7))) add("이익이 쌓이는 구조 — 법인세·이익잉여금·배당·임원퇴직금·목적자금 검토 후보", "이익이 꾸준한 편인데 법인세·배당·이익잉여금 정리는 어떻게 보고 계신가요?", "이익이 쌓일수록 주식가치·세부담이 커질 수 있어 사전 점검 필요", "세무·정관 / 보험·퇴직금", ["재무제표", "주주명부", "정관"], 4);
  if (debt != null && debt >= 150) add("부채비율이 높은 편 — 보증/대출/리파이낸싱/정책자금 구조 점검 후보", "차입 구조나 금융비용 부담은 어느 정도이신가요?", "부채비율이 높으면 자금 구조·금융비용 점검 필요", "신용·보증·성장지원 / 자금·지원금", ["대출/보증 내역", "재무제표"], 6);
  if (cur != null && cur < 100) add("유동비율이 낮은 편 — 현금흐름·단기차입금·운전자금 점검 후보", "단기 운전자금 흐름은 어떻게 관리하고 계신가요?", "유동비율이 낮으면 단기 자금 흐름 점검 필요(고객 현금흐름 확인 필요)", "자금·지원금 / 운전자금 점검", ["재무제표", "차입금 내역"], 7);
  if (icr != null && icr < 3) add("이자보상배수가 낮은 편 — 금융비용 부담·차입구조 점검 후보", "이자 비용 대비 영업이익 수준은 어떻게 보고 계신가요?", "이자보상배수가 낮으면 금융비용 부담 점검 필요", "신용·보증·성장지원", ["대출/보증 내역", "손익계산서"], 7);
  if (grade && cretopGradeIsLow(grade)) add(`신용등급(${grade})이 낮은 편 — 신용등급 관리·재무구조 개선·보증기관 대응 점검 후보`, "신용등급 관리나 보증기관 대응에서 신경 쓰시는 부분이 있으신가요?", "신용등급이 낮으면 보증·대출·입찰에 영향, 재무구조 개선 점검 필요", "신용·보증·성장지원", ["신용평가 내역", "재무제표"], 6);
  if (retE != null && retE >= 3) add("미처분이익잉여금이 큰 편 — 배당정책·이익소각·임원퇴직금·목적자금 검토 후보", "이익잉여금이 쌓여 있는데 배당이나 정리 계획을 생각해보신 적 있으신가요?", "이익잉여금이 크면 승계·증여·주식가치 부담 사전 점검 필요", "승계·지분 / 보험·퇴직금", ["재무제표", "주주명부", "정관"], 4);
  if (emp > 0) add(`직원이 있는 기업(${emp}명) — 고용지원금·노무·사내근로복지기금 점검 후보`, "최근 채용이나 인원 변동이 있으셨나요? 노무 관리는 어떻게 하고 계신가요?", "직원이 있으면 고용·노무 리스크와 지원사업 점검 필요", "자금·지원금 / 복지·노무", ["4대보험 가입자명부", "급여대장"]);
  if (/제조|IT|소프트|개발|기술|연구/.test(ind)) add("제조·IT·연구개발 키워드 — 기업부설연구소·벤처·특허·인증 점검 후보", "연구개발 인력이나 개발 활동이 있으신가요?", "개발 활동이 있으면 연구소·인증·세액공제 검토 가능성 점검 필요", "인증·연구소 / 지식재산·브랜딩", ["연구개발 인력 현황", "특허 출원 내역"]);
  // 심각도(sev) 높은 포인트 우선 — 유동비율 낮음·이자보상 낮음 같은 핵심 위험이 상위 5개 밖으로 밀리지 않게(동일 sev는 원래 순서 유지)
  const ordered = points.map((p, i) => ({ p, i })).sort((a, b) => ((b.p.sev || 1) - (a.p.sev || 1)) || (a.i - b.i)).map((x) => x.p);
  return { topPoints: ordered.slice(0, 5).map((p) => p.title), pointPairs: ordered.slice(0, 5).map((p) => ({ title: p.title, q: p.q })), questions: questions.slice(0, 8), risks, proposals: Array.from(new Set(proposals)), docs: Array.from(docs) };
}
// 크레탑 분석 결과(ui) → 고객(leads/companies) 자동 입력용 패치 — 회사명·대표자·매출·핵심비율·미팅 포인트·추가 제안 포인트를 메모로 정리. 모든 수치는 후보(비단정 톤).
function buildCretopCustomerPatch(ui, pts, weapons, manualGrade) {
  const co = (ui && ui.companyInfo) || {};
  const cp = (ui && ui.corePreview) || {};
  const eok = (m) => (m && typeof m.eok === "number") ? m.eok : null;
  const ratioTxt = (m, unit) => (m && typeof m.value === "number") ? `${m.value}${m.unit || unit || ""}${m.year ? `(${m.year})` : ""}` : "원문 확인 필요";
  const patch = {};
  if (co.companyName) patch.name = co.companyName;
  if (co.ceoName) patch.ceoName = co.ceoName;
  if (co.employees) { const e = String(co.employees).replace(/[^0-9]/g, ""); if (e) patch.empCount = e; }
  const estY = parseInt(String(co.established || "").slice(0, 4), 10);
  if (estY && estY > 1900) { const yrs = (new Date().getFullYear()) - estY; if (yrs >= 0 && yrs < 200) patch.estYears = String(yrs); }
  const rev = eok(cp.revenue); if (rev != null) patch.revenue = String(Math.round(rev * 100));      // 폼 매출 단위: 억×100(백만원)
  const ni = eok(cp.netIncome); if (ni != null) patch.netIncome = String(Math.round(ni * 10000));   // 폼 당기순이익 단위: 억→만원
  const indSrc = co.standardIndustry || co.industry || "";
  const indMap = [["제조", "제조업"], ["도소매", "도소매업"], ["도매", "도소매업"], ["소매", "도소매업"], ["건설", "건설업"], ["소프트", "IT/소프트웨어"], ["정보통신", "IT/소프트웨어"], ["운송", "운송업"], ["운수", "운송업"], ["음식", "음식/숙박"], ["숙박", "음식/숙박"], ["의료", "병의원"], ["병원", "병의원"], ["의원", "병의원"], ["서비스", "서비스업"]];
  const hit = indMap.find(([kw]) => indSrc.includes(kw)); if (hit) patch.industry = hit[1];
  patch.cretopChecked = true; patch.financialSecured = true;
  const dr = cp.debtRatio, cur = cp.currentRatio, icr = cp.interestCoverageRatio;
  const concerns = [];
  if (dr && typeof dr.value === "number" && dr.value >= 200) concerns.push(`부채비율 ${dr.value}% — 재무구조 점검 후보`);
  if (cur && typeof cur.value === "number" && cur.value < 100) concerns.push(`유동비율 ${cur.value}% — 단기 유동성 점검 후보`);
  if (icr && typeof icr.value === "number" && icr.value < 2) concerns.push(`이자보상배수 ${icr.value}배 — 금융비용 부담 점검 후보`);
  if (concerns.length) patch.concern = concerns.join(" / ");
  const credit = manualGrade || co.creditGrade || "";
  const selW = (weapons || []).map((nm) => CRETOP_WEAPON_MAP[nm]).filter(Boolean);
  const lines = [`[크레탑 분석 완료 · ${todayISO()}]`];
  const idLine = [co.businessNo ? `사업자번호 ${co.businessNo}` : "", co.corpRegNo ? `법인번호 ${co.corpRegNo}` : "", (credit && credit !== "이미지 원문 확인 필요") ? `신용등급 ${credit}` : ""].filter(Boolean).join(" · ");
  if (idLine) lines.push(idLine);
  const amtLine = [eok(cp.revenue) != null ? `매출 ${eok(cp.revenue)}억${cp.revenue && cp.revenue.year ? `(${cp.revenue.year})` : ""}` : "", eok(cp.operatingProfit) != null ? `영업이익 ${eok(cp.operatingProfit)}억` : "", eok(cp.netIncome) != null ? `당기순이익 ${eok(cp.netIncome)}억` : ""].filter(Boolean).join(" · ");
  if (amtLine) lines.push(amtLine);
  lines.push(`부채비율 ${ratioTxt(dr)} · 유동비율 ${ratioTxt(cur)} · 이자보상배수 ${ratioTxt(icr, "배")}`);
  if (pts && pts.topPoints && pts.topPoints.length) { lines.push("[1차 미팅 포인트]"); pts.topPoints.forEach((t, i) => lines.push(`${i + 1}. ${t}`)); }
  if (selW.length) { lines.push("[추가 제안 포인트]"); selW.forEach((w) => lines.push(`· ${w.name}`)); }
  lines.push("※ 모든 수치는 후보이며 원문 기준 확인이 필요합니다.");
  patch.memo = lines.join("\n");
  return patch;
}
function parseFinancials(text, layout) {
  const raw = text || "";
  const t = raw.replace(/\s+/g, " ");                 // 공백 정규화(키워드/이름용)
  const tc = raw.replace(/[\s 　]+/g, "");    // 공백 제거(계정-금액 매칭, 줄깨짐 대응)
  const items = [], flags = {}, fields = {}, interests = new Set(), concerns = [], numbers = [];
  const push = (key, label, display, confidence, note, apply) => items.push({ key, label, display, confidence, note: note || "", apply: apply || null });
  let m;
  const gu = (tc.match(/단위[:：(]?(백만원|천원|백만|천|억원|억|만원|원)/) || t.match(/단위\s*[:：(]?\s*(백만원|천원|백만|천|억원|억|만원|원)/) || [])[1] || null;
  const amtConf = (g) => g.unitSrc === "inline" ? "높음" : "보통";
  const amtNote = (g) => g.unitSrc === "inline" ? "" : (g.unitSrc === "global" ? `표 단위(${gu}) 기준 — 확인 권장` : "단위 확인 필요");
  if ((m = t.match(/(?:기업명|법인명|회사명|상호|업체명)\s*[:：]?\s*([가-힣A-Za-z0-9㈜()·\s]{2,24}?(?:\(주\)|㈜)?)\s*(?:,|\/|\||대표|업종|설립|종업원|$)/))) { const nm = m[1].trim().replace(/\s+/g, " "); if (nm.length >= 2) { fields.name = nm; push("name", "업체명", nm, "보통", "기업명 표기·괄호 위치 확인", { field: "name", val: nm }); } }
  const indMap = [["제조", "제조업"], ["소프트", "IT/소프트웨어"], ["IT", "IT/소프트웨어"], ["도소매", "도소매업"], ["도매", "도소매업"], ["소매", "도소매업"], ["유통", "도소매업"], ["건설", "건설업"], ["병의원", "병의원"], ["의원", "병의원"], ["음식", "음식/숙박"], ["숙박", "음식/숙박"], ["운송", "운송업"], ["물류", "운송업"], ["서비스", "서비스업"]];
  for (const [k, v] of indMap) { if (t.includes(k)) { fields.industry = v; push("industry", "업종", v, "보통", "", { field: "industry", val: v }); break; } }
  if ((m = t.match(/대표(?:자|이사)?\s*(?:명)?\s*[:：]\s*([가-힣]{2,4})/)) || (m = t.match(/대표(?:자|이사)?\s*명?\s+([가-힣]{2,4})(?:\s|,|·|\(|업종|$)/)) || (m = t.match(/([가-힣]{2,4})\s*대표(?:이사)?(?:\s|,|$)/))) { fields.ceoName = m[1]; push("ceoName", "대표자명", m[1], "보통", "동명이인·오인식 주의", { field: "ceoName", val: m[1] }); }
  if ((m = t.match(/대표[^0-9]{0,6}([0-9]{2})\s*세/))) { fields.ceoAge = +m[1]; push("ceoAge", "대표 나이", m[1] + "세", "높음", "", { field: "ceoAge", val: +m[1] }); }
  if ((m = t.match(/(?:임직원|직원|종업원\s*수?|종업원|상시\s*근로자)[^0-9]{0,4}([0-9]{1,5})\s*명/))) { fields.empCount = +m[1]; push("empCount", "임직원 수", m[1] + "명", "높음", "", { field: "empCount", val: +m[1] }); }
  if ((m = t.match(/(?:사업자\s*(?:등록)?번호|사업자번호)\s*[:：]?\s*([0-9]{3}-?[0-9]{2}-?[0-9]{5})/))) { fields.businessNo = m[1]; numbers.push({ label: "사업자번호", display: m[1] }); push("businessNo", "사업자번호", m[1], "높음", "참고 정보", null); }
  if ((m = t.match(/(?:설립년월|설립일자?|설립일|설립연월)\s*[:：]?\s*((?:19|20)[0-9]{2}[-.\/년][\s]*[0-9]{1,2}(?:[-.\/월][\s]*[0-9]{0,2})?)/))) { fields.foundedAt = m[1].trim().replace(/\s+/g, ""); push("foundedAt", "설립년월", fields.foundedAt, "보통", "참고 정보", null); }
  if ((m = t.match(/기업규모\s*[:：]?\s*(소기업|중기업|중소기업|중견기업|대기업|소상공인)/))) { fields.scale = m[1]; push("scale", "기업규모", m[1], "보통", "참고 정보", null); }
  if ((m = t.match(/신용등급[^A-Za-z0-9가-힣]{0,4}([A-Da-d]{1,3}[+\-0]?|[A-Da-d][0-9]?)/))) { const g = m[1].toUpperCase(); numbers.push({ label: "신용등급", display: g }); push("credit", "신용등급", g, "보통", "발급기관·시점 확인", null); }
  if ((m = t.match(/업력[^0-9]{0,3}([0-9]{1,3})\s*년/))) { fields.estYears = +m[1]; push("estYears", "업력", m[1] + "년", "높음", "", { field: "estYears", val: +m[1] }); }
  else if ((m = t.match(/설립(?:일자?)?[^0-9]{0,6}((?:19|20)[0-9]{2})/))) { const yr = +m[1], est = new Date().getFullYear() - yr; if (est >= 0 && est < 120) { fields.estYears = est; push("estYears", "설립연도→업력", `${yr}년 설립(약 ${est}년)`, "보통", "설립월 기준 차이 확인", { field: "estYears", val: est }); } }
  if ((m = t.match(/(?:조회일시|결산기준일|결산일|기준일자|기준일)\s*[:：]?\s*((?:19|20)[0-9]{2}[.\-/년\s]*[0-9]{1,2}[.\-/월\s]*[0-9]{0,2})/))) { const d = m[1].trim().replace(/\s+/g, ""); numbers.push({ label: "조회/기준일", display: d }); push("baseDate", "조회/기준일", d, "보통", "참고 정보", null); }
  // ── 금액: 좌표 레이아웃이 있으면 좌표 기반 표 파서, 없으면 텍스트 표 파서. 항목 0이면 텍스트 표 파서로 보강 ──
  let cre = (layout && layout.pages && layout.pages.length) ? parseCretopLayout(layout) : parseCretopTables(raw);
  if (!cre.hasTable) { const t2 = parseCretopTables(raw); if (t2.hasTable) cre = t2; }
  const eokByKey = {};
  // 검증 통과 값만 적용 가능 항목으로, 비현실 값은 bad(오류 의심/자동 제외) 항목으로 분기
  const pushAmount = (key, name, o, info) => {
    const v = validateAmountEok(info.eok, key);
    if (v.level === "exclude" || v.level === "error" || v.level === "suspect") {
      push(key, o.label || name, `파싱값 ${cretopEokText(info.eok)} — ${v.reason}`, "오류 의심", info.note || "", null);
      items[items.length - 1].bad = { reason: v.reason, candidates: info.rawNumStr ? [info.rawNumStr] : [], parsed: cretopEokText(info.eok), level: v.level };
      return true;
    }
    const apply = o.field === "revenue" ? { field: "revenue", val: Math.round(info.eok * 100) } : o.field === "netIncome" ? { field: "netIncome", val: Math.round(info.eok * 1e4) } : o.flag ? { flag: o.flag, val: true } : o.interest ? { interest: o.interest, val: true } : null;
    const note = (v.level === "large" ? "대형 업체 가능성 — 확인 필요" + (info.note ? " · " : "") : "") + (info.note || "");
    push(key, o.label || name, info.disp, info.conf, note, apply);
    numbers.push({ label: name, display: `${info.year ? info.year + " " : ""}${cretopEokText(info.eok)}` });
    if (o.flag) flags[o.flag] = true; if (o.interest) interests.add(o.interest);
    eokByKey[key] = info.eok;
    return true;
  };
  const acctItem = (name, key, o) => {
    o = o || {}; const a = cre.accounts[name];
    if (a && a.latest && a.latest.eok != null) {
      const L = a.latest;
      const disp = `${L.year ? L.year + "년 " : ""}${L.rawNum.toLocaleString()}${L.unit} → ${cretopEokText(L.eok)}` + (o.field === "revenue" ? ` (입력 ${Math.round(L.eok * 100).toLocaleString()})` : "");
      return pushAmount(key, name, o, { eok: L.eok, year: L.year, disp, conf: L.mismatch ? "보통" : "높음", note: `출처: ${L.section || "재무표"}${L.mismatch ? " · 연도·값 개수 불일치(확인 필요)" : ""}${o.note ? " · " + o.note : ""}`, rawNumStr: `${L.rawNum.toLocaleString()}${L.unit}` });
    }
    if (o.fg) {
      const inl = inlineNums(o.fg, t); if (!inl) return false;
      if (inl.candidates.length >= 2) {  // 여러 연도 후보 → 자동 적용은 보류하되 '단위/연도 확인 필요'로 후보 표시(아예 안 보이는 것보다 낫게)
        const unit = inl.unit || gu; const latest = inl.candidates[inl.candidates.length - 1]; const latestEok = unit ? cretopToEok(parseNumLoose(latest), unit) : null;
        const estTxt = unit ? inl.candidates.map((c) => cretopEokText(cretopToEok(parseNumLoose(c), unit))).join(" / ") : "";
        // 최신 후보가 비현실적 금액이면 오류 의심으로 분기
        if (latestEok != null && (validateAmountEok(latestEok, key).level === "suspect" || validateAmountEok(latestEok, key).level === "error" || validateAmountEok(latestEok, key).level === "exclude")) {
          push(key, o.label || name, `후보: ${inl.candidates.join(" / ")}`, "오류 의심", "값이 현실 범위를 벗어남 — 단위/표 구조 확인 필요(자동 적용 제외)", null);
          items[items.length - 1].bad = { reason: "후보 값이 현실 범위를 벗어남 — 단위/표 구조 확인 필요", candidates: inl.candidates, level: "multiYear" }; return true;
        }
        push(key, o.label || name, `후보: ${inl.candidates.join(" / ")}${unit ? ` · 단위 ${unit}이면 ${estTxt} 수준 (최신 ${cretopEokText(latestEok)})` : ""}`, "보통", `여러 연도 값으로 보입니다 — 연도 매핑 확인 필요(최신연도 자동 적용은 보류). 단위 확인 필요${unit ? `(${unit}으로 보임)` : ""}`, null);
        return true;
      }
      const num = parseNumLoose(inl.candidates[0]); const unit = inl.unit || gu;
      if (!unit) {  // 단위 없음
        if (num >= 1000) { push(key, o.label || name, `원문값 ${inl.candidates[0]} · 단위 확인 필요`, "보통", "단위가 없어 자동 적용은 보류 — 백만원/천원 등 단위 확인 필요", null); return true; }
        push(key, o.label || name, `원문값 ${inl.candidates[0]} · 단위 확인 필요`, "낮음", "단위 확인 필요 — 원문 단위(백만원/천원) 확인 후 적용", null); return true;
      }
      const eok = cretopToEok(num, unit);
      const disp = `${inl.candidates[0]}${unit} → ${cretopEokText(eok)}` + (o.field === "revenue" ? ` (입력 ${Math.round(eok * 100).toLocaleString()})` : "");
      return pushAmount(key, name, o, { eok, year: null, disp, conf: inl.unit ? "높음" : "보통", note: inl.unit ? "" : (gu ? `표 단위(${gu}) 기준 — 확인 권장` : "단위 확인 필요"), rawNumStr: `${inl.candidates[0]}${unit}` });
    }
    return false;
  };
  const _finGrabUnused = finGrab; // (구 인라인 매처 — 좌표/안전 파서 도입 후 미사용)
  acctItem("매출액", "revenue", { field: "revenue", label: "매출액", fg: ["매출액", "영업수익", "수입금액", "연매출", "매출"] });
  acctItem("영업이익", "영업이익", { fg: ["영업이익"] });
  acctItem("당기순이익", "당기순이익", { field: "netIncome", fg: ["당기순이익", "순이익"] });
  acctItem("자산총계", "자산총계", { fg: ["자산총계", "총자산"] });
  acctItem("부채총계", "부채총계", { fg: ["부채총계", "총부채"] });
  acctItem("자본총계", "자본총계", { fg: ["자본총계", "자기자본"] });
  acctItem("유동자산", "유동자산", {});
  acctItem("비유동자산", "비유동자산", { fg: ["비유동자산"] });
  acctItem("유동부채", "유동부채", {});
  acctItem("비유동부채", "비유동부채", {});
  acctItem("매출원가", "매출원가", {});
  acctItem("판매비와관리비", "판관비", {});
  acctItem("법인세비용", "법인세비용", {});
  acctItem("유형자산", "유형자산", { fg: ["유형자산"] });
  acctItem("보증금", "보증금", { fg: ["임차보증금", "보증금"] });
  acctItem("단기차입금", "단기차입금", { flag: "hasLoan", note: "차입금 — 기존 대출/보증 점검", fg: ["단기차입금"] });
  acctItem("장기차입금", "장기차입금", { flag: "hasLoan", note: "차입금 — 기존 대출/보증 점검", fg: ["장기차입금"] });
  // 비율/배수 현실 범위 점검(금액 변환 안 함)
  const ratioRangeNote = (unit, v) => { const a = Number(v); if (unit === "배") return (a < -100 || a > 1000) ? "현실 범위(-100~1,000배) 밖 — 확인 필요" : ""; if (unit === "%") return (a < -100 || a > 1000) ? "현실 범위(0~1,000%) 밖 — 확인 필요" : ""; return ""; };
  const ratioItem = (name, key, o) => {
    o = o || {}; const r = cre.ratios[name];
    const u = o.unit || "%";
    if (r) { const high = o.highAt && r.value >= o.highAt; const rn = ratioRangeNote(r.unit, r.value); numbers.push({ label: name, display: r.value + r.unit }); push(key, o.label || name, `${r.value.toLocaleString()}${r.unit}${r.year ? ` (${r.year} 기준)` : ""}${high ? " (높은 편)" : ""}`, rn ? "보통" : "높음", `출처: ${r.section} · 비율/배수(금액 변환 안 함)${rn ? " · " + rn : ""}`, high && o.flag ? { flag: o.flag, val: true } : null); if (high && o.flag) flags[o.flag] = true; return true; }
    if (o.re) { const mm = tc.match(o.re); if (mm) { const v = parseFloat(mm[1]); const high = o.highAt && v >= o.highAt; const rn = ratioRangeNote(u, v); numbers.push({ label: name, display: v + u }); push(key, o.label || name, `${v}${u}${high ? " (높은 편)" : ""}`, "보통", `원문 수치 기준 표시(비율/배수)${rn ? " · " + rn : ""}`, high && o.flag ? { flag: o.flag, val: true } : null); if (high && o.flag) flags[o.flag] = true; return true; } }
    return false;
  };
  const debtHigh = ratioItem("부채비율", "debtRatio", { flag: "hasLoan", highAt: 200, re: /부채비율[^0-9.\-]{0,4}([0-9]{1,4}(?:\.[0-9]+)?)/ });
  if (flags.hasLoan && ((cre.ratios["부채비율"] && cre.ratios["부채비율"].value >= 200) || false)) { interests.add("정책자금"); concerns.push("부채비율이 높은 편으로 재무구조 안정성 및 정책자금 가능성 검토 필요"); }
  ratioItem("유동비율", "currentRatio", { re: /유동비율[^0-9.\-]{0,4}([0-9]{1,4}(?:\.[0-9]+)?)/ });
  ratioItem("이자보상배수", "interestCover", { unit: "배", re: /이자보상(?:배율|배수)[^0-9.\-]{0,4}([0-9]{1,4}(?:\.[0-9]+)?)/ });
  ratioItem("차입금의존도", "debtDep", {});
  ratioItem("영업이익률", "opMargin", {});
  ratioItem("당기순이익률", "netMargin", {});
  ratioItem("매출액증가율", "salesGrowth", {});
  ratioItem("ROA", "roa", {});
  ratioItem("ROE", "roe", {});
  const gajiFound = acctItem("가지급금", "gajigeup", { flag: "gajigeup", note: "정리 방식은 세무사 검토 권장", fg: ["가지급금"] });
  if (!gajiFound && /가지급금/.test(t)) { push("gajigeup", "가지급금", "키워드 확인", "낮음", "키워드만 확인됨 — 금액 확인 필요", { flag: "gajigeup", val: true }); }
  if (/가지급금/.test(t)) { flags.gajigeup = true; concerns.push("가지급금 정리 필요성 검토 — 발생 원인·인정이자 처리 여부 확인 필요(세무사 검토 권장)"); }
  const gasuFound = acctItem("가수금", "gasugeum", { flag: "gasugeum", fg: ["가수금"] });
  if (!gasuFound && /가수금/.test(t)) { push("gasugeum", "가수금", "키워드 확인", "낮음", "키워드만 확인됨", { flag: "gasugeum", val: true }); }
  if (/가수금/.test(t)) { flags.gasugeum = true; concerns.push("가수금 정리 및 출자전환 검토 — 발생 원인 확인 필요"); }
  let mibunFound = acctItem("미처분이익잉여금", "retained", { interest: "미처분이익잉여금", note: "주식가치·배당·이익소각은 세무사 검토 권장", fg: ["미처분이익잉여금", "이익잉여금"] });
  if (!mibunFound) mibunFound = acctItem("이익잉여금", "retained", { interest: "미처분이익잉여금", label: "이익잉여금", fg: [] });
  if (!mibunFound && /미처분이익잉여금|이익잉여금/.test(t)) { push("retained", "미처분이익잉여금", "키워드 확인", "낮음", "키워드만 확인됨", { interest: "미처분이익잉여금", val: true }); }
  if (/미처분이익잉여금|이익잉여금/.test(t)) { interests.add("미처분이익잉여금"); concerns.push("미처분이익잉여금 누적에 따른 주식가치/배당/이익소각 검토 — 자료 확인 후 판단"); }
  // ── 회계 상식 검증: 위반 시 해당 항목을 bad(오류 의심)로 강등 + 경고 ──
  const eokV = (k) => eokByKey[k];
  const markBad = (key, reason) => { const it = items.find((x) => x.key === key && !x.bad); if (it) { it.bad = { reason, candidates: [], parsed: it.display, level: "sanity" }; it.confidence = "오류 의심"; it.apply = null; const ni = numbers.findIndex((n) => n.label === it.label); if (ni >= 0) numbers.splice(ni, 1); delete eokByKey[key]; concerns.push(`${it.label}: ${reason}`); } };
  if (eokV("revenue") != null) {
    if (eokV("영업이익") != null && eokV("영업이익") > eokV("revenue") * 1.05) markBad("영업이익", "영업이익이 매출액보다 큼 — 원문/연도 확인 필요(자동 적용 제외)");
    if (eokV("당기순이익") != null && eokV("당기순이익") > eokV("revenue") * 1.05) markBad("당기순이익", "당기순이익이 매출액보다 큼 — 원문/연도 확인 필요(자동 적용 제외)");
  }
  if (eokV("자산총계") != null) {
    if (eokV("부채총계") != null && eokV("부채총계") > eokV("자산총계") * 1.2) markBad("부채총계", "부채총계가 자산총계를 크게 초과 — 계정 간 관계가 맞지 않아 원문 확인 필요");
    if (eokV("자본총계") != null && eokV("자본총계") > eokV("자산총계") * 1.2) markBad("자본총계", "자본총계가 자산총계를 크게 초과 — 계정 간 관계가 맞지 않아 원문 확인 필요");
    if (eokV("보증금") != null && eokV("보증금") > eokV("자산총계") * 1.05) markBad("보증금", "보증금이 자산총계를 초과 — 원문 확인 필요");
    if (eokV("부채총계") != null && eokV("자본총계") != null) { const s = eokV("부채총계") + eokV("자본총계"); if (Math.abs(s - eokV("자산총계")) / Math.max(eokV("자산총계"), 0.01) > 0.2) concerns.push("자산총계 ≈ 부채총계 + 자본총계 관계가 맞지 않아 계정 세부내역 확인 필요"); }
  }
  const kw = [
    [/법인세/, "corpTaxBurden", "법인세 부담 키워드", "법인세 부담 점검 필요"],
    [/연구개발|개발인력|연구인력|연구개발비|R&D/i, "rndStaff", "연구개발 관련 키워드", "기업부설연구소 및 연구인력개발비 세액공제 검토 — 자료 확인 후 판단"],
    [/특허/, "patent", "특허 키워드", "지식재산(특허) 활용 가능성 점검"],
    [/벤처|이노비즈|메인비즈/, "venture", "벤처/인증 키워드", "벤처·이노비즈 인증 적용 여부는 세부 요건 확인 필요"],
    [/채용|고용\s*증가|신규\s*채용|인원\s*증가/, "hiring", "채용/고용증가 키워드", "고용지원금 및 통합고용세액공제 검토 — 적용 여부는 세부 요건 확인 필요"],
    [/고용지원금/, "employSubsidy", "고용지원금 키워드", ""],
    [/정책자금|운전자금|시설자금/, "policyFund", "정책자금 키워드", "정책자금 가능성은 재무·신용 점검 후 판단"],
    [/자녀.{0,6}(근무|재직)/, "childWorks", "자녀 근무 키워드", "가업승계 사전 점검 권장"],
    [/가족.{0,4}(근무|직원|임원)/, "familyEmp", "가족 직원 키워드", ""],
    [/가업|승계/, "succession", "가업승계 키워드", "가업승계 요건·주식가치 사전 점검 권장"],
    [/임원퇴직금/, "execRetire", "임원퇴직금 규정 키워드", ""],
    [/복지기금|사내근로복지/, "welfareFund", "사내근로복지기금 키워드", ""],
  ];
  for (const [re, flag, label, concern] of kw) { if (re.test(t) && !flags[flag]) { flags[flag] = true; push(flag, label, "키워드 확인", "낮음", "키워드만 확인됨 — 실제 여부 확인 필요", { flag, val: true }); if (concern) concerns.push(concern); } }
  if (flags.childWorks && !flags.succession) flags.succession = true;
  if (/연구소\s*(없|미보유|미설립)/.test(t)) { flags.hasLab = false; flags.rndStaff = true; push("noLab", "기업부설연구소", "미보유로 보임", "보통", "설립 가능성은 요건 확인 필요", { flag: "rndStaff", val: true }); }
  else if (/연구소\s*(있|보유|설립)/.test(t)) { flags.hasLab = true; push("hasLab", "기업부설연구소", "보유로 보임", "보통", "사후관리 요건 점검 권장", { flag: "hasLab", val: true }); }
  if (/정관\s*(미점검|미정비|방치)/.test(t)) { concerns.push("정관 정비 상태 점검 필요 — 임원보수·퇴직금 지급근거 확인 권장"); push("charter", "정관", "미점검으로 보임", "낮음", "정관 정비 점검 권장", null); }
  else if (/정관\s*(정비|완료|개정)/.test(t)) { flags.charterFixed = true; push("charterFixed", "정관", "정비 완료로 보임", "보통", "", { flag: "charterFixed", val: true }); }
  const acctKw = ["매출액", "영업이익", "당기순이익", "자산총계", "부채총계", "자본총계", "비유동자산", "유형자산", "보증금", "단기차입금", "장기차입금", "가지급금", "가수금", "미처분이익잉여금", "이익잉여금", "부채비율", "유동비율", "이자보상"];
  const foundKw = acctKw.filter((k) => tc.includes(k));
  const numCands = Array.from(new Set(raw.match(/[0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]+)?/g) || [])).slice(0, 8);
  const dateCands = Array.from(new Set(raw.match(/(?:19|20)[0-9]{2}[.\-/년][\s]*[0-9]{1,2}[.\-/월][\s]*[0-9]{0,2}/g) || [])).slice(0, 3);
  // 연도별 재무 요약 카드 데이터(억원 환산)
  const cardKeys = ["매출액", "영업이익", "당기순이익", "자산총계", "부채총계", "자본총계"];
  const yearTable = {};
  const keyMap = { "매출액": "revenue" };
  cardKeys.forEach((k) => { const a = cre.accounts[k]; if (a && Object.keys(a.byYear).length) { const yt = {}; Object.keys(a.byYear).forEach((y) => { const e = a.byYear[y].eok; if (validateAmountEok(e, k).level === "normal" || validateAmountEok(e, k).level === "large") yt[y] = cretopEokText(e); }); if (Object.keys(yt).length) yearTable[k] = yt; } });
  const ratioTable = {};
  ["부채비율", "유동비율", "이자보상배수"].forEach((k) => { const r = cre.ratios[k]; if (r) ratioTable[k] = { value: r.value.toLocaleString() + r.unit, year: r.year }; });
  const badItems = items.filter((it) => it.bad);
  const coreMetrics = buildCoreMetrics(cre);
  const cretop = { years: cre.years, baseYear: coreMetrics.baseYear || cre.baseYear, queryDate: cre.queryDate, hasTable: cre.hasTable, yearTable, ratioTable, hasBad: badItems.length > 0 };
  // ── 구조화 결과(financialStructured) ──
  const acctOut = (name) => { const a = cre.accounts[name]; if (!a || !a.latest || a.latest.eok == null) return null; const lv = validateAmountEok(a.latest.eok, name).level; if (lv === "suspect" || lv === "error" || lv === "exclude") return null; const vby = {}; Object.keys(a.byYear).forEach((y) => { vby[y] = Math.round(a.byYear[y].eok * 100) / 100; }); return { valuesByYear: vby, latestYear: a.latest.year || cre.baseYear || null, latestValueEok: Math.round(a.latest.eok * 100) / 100, sourceSection: a.latest.section || "", unit: a.latest.unit || "" }; };
  const ratioOut = (name) => { const r = cre.ratios[name]; if (!r) return null; return { value: r.value, latestYear: r.year || null, unit: r.unit, sourceSection: r.section || "" }; };
  const structured = {
    sourceType: "cretop", parseWarnings: [],
    companyOverview: { companyName: fields.name || "", ceoName: fields.ceoName || "", businessNo: fields.businessNo || "", employeeCount: fields.empCount != null ? fields.empCount : "", foundedAt: fields.foundedAt || "", industry: fields.industry || "", scale: fields.scale || "", creditRating: "", queryDate: cre.queryDate || "" },
    statements: { sales: acctOut("매출액"), operatingProfit: acctOut("영업이익"), netIncome: acctOut("당기순이익"), totalAssets: acctOut("자산총계"), totalLiabilities: acctOut("부채총계"), totalEquity: acctOut("자본총계"), retainedEarnings: acctOut("미처분이익잉여금") || acctOut("이익잉여금"), shortTermBorrowings: acctOut("단기차입금"), longTermBorrowings: acctOut("장기차입금") },
    ratios: { debtRatio: ratioOut("부채비율"), currentRatio: ratioOut("유동비율"), interestCoverageRatio: ratioOut("이자보상배수") },
    certifications: { lab: flags.hasLab === true ? true : (flags.hasLab === false ? false : null), venture: flags.venture || null, innobiz: null, mainbiz: null, patents: flags.patent || null },
  };
  if (!cre.hasTable) structured.parseWarnings.push("표 구조를 인식하지 못해 구조화 결과가 비어 있을 수 있습니다. 디버그 정보를 확인하거나 표 부분을 붙여넣어 주세요.");
  if (badItems.length) structured.parseWarnings.push(`현실 범위를 벗어나거나 계정 관계가 맞지 않는 항목 ${badItems.length}건은 자동 적용에서 제외했습니다(단위/연도/표 구조 확인 필요).`);
  const debug = layout && layout.pages ? cretopDebug(layout, layout.fileName) : null;
  const finalCore = buildCretopFinalCoreMetrics(raw);
  return { items, flags, fields, interests: Array.from(interests), concerns, numbers, gu, cretop, coreMetrics, finalCore, structured, debug, fallback: { keywords: foundKw, numbers: numCands, dates: dateCands } };
}
function buildFinancialSummary(parsed, sourceType) {
  const p = parsed || { items: [], numbers: [], concerns: [], flags: {}, interests: [] };
  const fl = p.flags || {};
  const highlights = [], reviewCandidates = Array.from(new Set(p.concerns || [])), questions = [], docs = new Set(["최근 3개년 재무제표", "계정별원장(주요 계정)"]);
  if (fl.gajigeup) { highlights.push("가지급금 항목 확인"); questions.push("가지급금 발생 원인과 인정이자 처리 여부를 확인해볼 수 있을까요?"); docs.add("가지급금 명세·약정서"); }
  if (fl.gasugeum) { highlights.push("가수금 항목 확인"); questions.push("가수금이 생긴 경위와 정리 계획을 확인해볼 수 있을까요?"); docs.add("가수금 내역"); }
  if ((p.interests || []).includes("미처분이익잉여금")) { highlights.push("미처분이익잉여금 누적 가능성"); questions.push("배당·퇴직금·이익소각 등 잉여금 활용을 검토해보신 적이 있으신가요?"); docs.add("주주명부·정관"); }
  if (fl.hasLoan) { highlights.push("차입금/부채 부담 가능성"); docs.add("차입금 내역"); }
  if (fl.rndStaff) { highlights.push("연구개발 인력/비용 관련 단서"); docs.add("조직도·연구개발 관련 자료"); }
  if (fl.hiring || fl.employSubsidy) { highlights.push("채용/고용 증가 단서"); docs.add("근로계약·4대보험 현황"); }
  if (fl.succession || fl.childWorks) { highlights.push("가업승계 관련 단서"); docs.add("가족관계·주식이동 내역"); }
  if (!reviewCandidates.length) reviewCandidates.push("제공된 자료 범위에서는 우선 재무제표 원본과 주요 계정 세부내역을 확인할 필요가 있어 보입니다.");
  if (!questions.length) questions.push("최근 재무제표와 주요 계정 세부내역을 함께 확인해볼 수 있을까요?");
  // 크레탑 표가 있으면 최신연도 기준 헤드라인 문구 생성(숫자 오류 방지: 표 환산값 사용)
  let headline = "";
  const cr = p.cretop;
  if (cr && cr.baseYear && cr.yearTable) {
    const by = cr.baseYear; const yt = cr.yearTable; const rt = cr.ratioTable || {};
    const g = (k) => (yt[k] && yt[k][by]) ? yt[k][by].replace("약 ", "약 ") : null;
    const parts = [];
    if (g("매출액")) parts.push(`매출은 ${g("매출액")}`);
    if (g("영업이익")) parts.push(`영업이익은 ${g("영업이익")}`);
    if (g("당기순이익")) parts.push(`당기순이익은 ${g("당기순이익")}`);
    let s = `제공된 크레탑 자료 기준 ${by}년 ${parts.join(", ")}으로 확인됩니다.`;
    const rp = [];
    if (rt["부채비율"]) rp.push(`부채비율은 자료상 ${rt["부채비율"].value}`);
    if (rt["유동비율"]) rp.push(`유동비율은 ${rt["유동비율"].value}`);
    if (rp.length) s += ` ${rp.join(", ")}로 표시되어 있으며, 실제 검토 시 기준연도와 계정 세부내역 확인이 필요합니다.`;
    else s += " 실제 검토 시 기준연도와 계정 세부내역 확인이 필요합니다.";
    headline = s;
  }
  // 자동 적용 제외 항목이 있으면 헤드라인/검토 후보에 안내(요약엔 검증 통과 값만 사용)
  if (cr && cr.hasBad) {
    const note = "제공된 크레탑 자료에서 일부 숫자가 추출되었으나, 단위 또는 표 구조 확인이 필요한 항목이 있어 자동 적용은 제한했습니다. 매출액·이익·자산·부채는 원문 표의 연도와 단위를 확인한 뒤 적용해주세요.";
    if (!headline) headline = note; else headline += " (일부 항목은 단위/표 구조 확인 필요로 자동 적용에서 제외했습니다.)";
    reviewCandidates.unshift(note);
  }
  return { numbers: p.numbers || [], headline, baseYear: cr && cr.baseYear, queryDate: cr && cr.queryDate, hasBad: cr && cr.hasBad, highlights, reviewCandidates, questions, docs: Array.from(docs), warning: FIN_WARNING, sourceType: sourceType || "", analyzedAt: todayISO() };
}
function finSummaryCopyText(sum, name) {
  if (!sum) return "";
  const L = [`[${name || "고객"} 재무자료 1차 검토 요약]`, `분석일: ${(sum.analyzedAt || "").replace(/-/g, ".")}${sum.sourceType ? ` · 출처: ${sum.sourceType}` : ""}${sum.baseYear ? ` · 재무 기준연도 ${sum.baseYear}` : ""}${sum.queryDate ? ` · 조회일시 ${sum.queryDate}` : ""}`, ""];
  if (sum.headline) { L.push(sum.headline, ""); }
  const add = (title, arr, fmt) => { if (arr && arr.length) { L.push("■ " + title); arr.forEach((x) => L.push("· " + (fmt ? fmt(x) : x))); L.push(""); } };
  add("확인된 주요 숫자(추출 후보)", sum.numbers, (n) => `${n.label}: ${n.display}`);
  add("눈에 띄는 항목", sum.highlights); add("1차 검토 후보", sum.reviewCandidates); add("미팅 전 확인 질문", sum.questions); add("추가 요청자료", sum.docs);
  L.push("■ 주의", sum.warning);
  return L.join("\n");
}
function FinConfBadge({ c }) { const map = { "높음": [C.ok, C.greenBg], "보통": [C.warn, C.warnBg], "낮음": [C.textM, "#EEF2F7"] }; const s = map[c] || map["보통"]; return <Badge color={s[0]} bg={s[1]}>{c}</Badge>; }
// 크레탑 핵심 재무지표 카드 — buildCretopFinalCoreMetrics(연도-index 매칭) 결과를 최우선 사용
function CoreMetricsCard({ final }) {
  if (!final) return null;
  const dy = final.detectedYears || []; const ly = final.latestYear;
  const yearOk = ly != null && dy.length && ly === Math.max(...dy);
  const cell = (key) => {
    const label = CORE_LABEL_KR[key]; const m = final.metrics ? final.metrics[key] : null;
    const found = !!m; const isRatio = key === "debtRatio" || key === "currentRatio" || key === "interestCoverageRatio";
    return <div key={key} style={{ padding: "7px 10px", background: "#fff", borderRadius: 8, border: `1px solid ${found && m.bad ? C.err + "55" : C.bdr}`, minWidth: 0, maxWidth: "100%", overflow: "hidden", boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline", minWidth: 0 }}>
        <span style={{ color: C.textS, fontSize: "calc(var(--s,1.3)*13px)", fontWeight: 700, flexShrink: 0 }}>{label}{found && m.year ? <span style={{ color: C.textM, fontWeight: 400 }}> ({m.year})</span> : null}</span>
        <span style={{ fontSize: "calc(var(--s,1.3)*14px)", fontWeight: 800, color: found ? (m.bad ? C.err : (isRatio ? C.blue : C.text)) : C.textM, textAlign: "right", wordBreak: "break-all", minWidth: 0 }}>{found ? m.display : "원문 확인 필요"}</span>
      </div>
      {found && (m.rowText || m.source) ? <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*10px)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "100%" }}>{m.source ? m.source : ""}{m.unit ? ` · ${m.unit}` : ""}{m.rowText ? ` · 원문: ${m.rowText}` : ""}</div> : null}
    </div>;
  };
  return <div style={{ border: `2px solid ${C.gold}55`, borderRadius: 12, padding: 14, marginBottom: 10, background: "#FFFCF5", maxWidth: "100%", overflow: "hidden", boxSizing: "border-box" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6, marginBottom: 4 }}>
      <div style={{ fontWeight: 900, color: C.gold, fontSize: "calc(var(--s,1.3)*16px)" }}>⭐ 핵심 재무지표</div>
      <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*12px)", wordBreak: "keep-all" }}>감지 연도 {dy.length ? dy.join(", ") : "(없음)"} · 대표 기준연도 <b style={{ color: yearOk ? C.text : C.err }}>{ly != null ? ly : "-"}</b> · 가장 큰 연도 기준{final.queryDate ? ` · 조회 ${final.queryDate}` : ""}</div>
    </div>
    {!yearOk && ly != null ? <div style={{ color: C.err, fontSize: "calc(var(--s,1.3)*12px)", fontWeight: 700, marginBottom: 6 }}>⚠️ 대표 기준연도가 최신연도와 일치하지 않습니다. 파서 점검 필요.</div> : null}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 6, marginTop: 6 }}>{CORE_ORDER.map(cell)}</div>
    <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*11px)", marginTop: 6, lineHeight: 1.5 }}>가장 최근 연도(연도 index 매칭) 값을 기본 표시합니다 — 오래된 연도/첫 숫자 대표값 사용 안 함. 모두 ‘추출 후보’이며 단위·기준연도 확인 후 적용해주세요.</div>
  </div>;
}
// 재무 1차 분석 결과 보기(고객 등록 모달·고객 상세 공용)
function FinancialAnalysis({ summary, name, raw }) {
  const [showRaw, setShowRaw] = useState(false);
  if (!summary) return null;
  const s = summary;
  const block = (title, arr, fmt) => arr && arr.length ? <div style={{ marginTop: 10 }}><div style={{ fontWeight: 800, fontSize: "calc(var(--s,1.3)*15px)", color: C.text, marginBottom: 4 }}>{title}</div><ul style={{ margin: 0, paddingLeft: 18, color: C.textS, fontSize: "calc(var(--s,1.3)*14px)", lineHeight: 1.7 }}>{arr.map((x, i) => <li key={i}>{fmt ? fmt(x) : x}</li>)}</ul></div> : null;
  return <div>
    {s.headline ? <div style={{ padding: "10px 12px", background: C.greenBg, border: `1px solid ${C.ok}40`, borderRadius: 10, color: C.text, fontSize: "calc(var(--s,1.3)*14px)", lineHeight: 1.7, marginBottom: 6 }}>📌 {s.headline}</div> : null}
    {block("① 확인된 주요 숫자", s.numbers, (n) => `${n.label}: ${n.display}`)}
    {block("② 눈에 띄는 항목", s.highlights)}
    {block("③ 1차 검토 후보", s.reviewCandidates)}
    {block("④ 미팅 전 확인 질문", s.questions)}
    {block("⑤ 추가 요청자료", s.docs)}
    <div style={{ marginTop: 10, padding: "10px 12px", background: C.warnBg, border: `1px solid ${C.warn}40`, borderRadius: 10, color: C.textS, fontSize: "calc(var(--s,1.3)*13px)", lineHeight: 1.6 }}>⚠️ {s.warning}</div>
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
      <button style={btnSm} onClick={() => copyText(finSummaryCopyText(s, name), () => showToast("재무 검토 요약을 복사했습니다."))}>재무 검토 요약 복사</button>
      <button style={btnSm} onClick={() => copyText("추가 요청자료\n" + (s.docs || []).map((d) => "· " + d).join("\n"), () => showToast("복사했습니다."))}>추가 요청자료 복사</button>
      <button style={btnSm} onClick={() => copyText("미팅 전 확인 질문\n" + (s.questions || []).map((q) => "· " + q).join("\n"), () => showToast("복사했습니다."))}>미팅 질문 복사</button>
      {raw && <button style={btnSm} onClick={() => setShowRaw((v) => !v)}>{showRaw ? "원문 닫기" : "원문 일부 보기"}</button>}
    </div>
    {showRaw && raw && <pre style={{ marginTop: 8, padding: 10, background: C.bg, border: `1px solid ${C.bdr}`, borderRadius: 8, fontSize: 12, color: C.textM, whiteSpace: "pre-wrap", maxHeight: 160, overflow: "auto" }}>{raw}</pre>}
  </div>;
}
// 고객 상세의 "재무자료 1차 분석" 섹션 — 길면 접힘
function FinancialDetailCard({ item }) {
  const [open, setOpen] = useState(false);
  const sum = item && item.financialSummary;
  if (!sum) return null;
  return <Card style={{ padding: 18 }}>
    <button onClick={() => setOpen((o) => !o)} aria-expanded={open} style={{ width: "100%", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, background: "transparent", border: "none", cursor: "pointer", fontFamily: FF, padding: 0 }}>
      <span style={{ fontSize: "calc(var(--s,1.3)*18px)", fontWeight: 900, color: C.gold }}>🧾 재무자료 1차 분석</span>
      <span style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*14px)" }}>{(sum.analyzedAt || "").replace(/-/g, ".")}{sum.sourceType ? ` · ${sum.sourceType}` : ""} {open ? "▲" : "▼"}</span>
    </button>
    {open && <div style={{ marginTop: 12 }}><FinancialAnalysis summary={sum} name={getCompanyName(item) || item.name} raw={item.financialRawText} /></div>}
  </Card>;
}
// 고객 주요 이슈 태그(필터가 아니라 상담 이슈) — 카테고리별. f.issues 배열에 저장.
const CUST_ISSUE_CATS = [
  ["자금·보증", ["운전자금 부족", "시설자금 필요", "고금리 대출 부담", "보증한도 부족", "정책자금 검토", "대환대출/금리조건 점검", "정부지원사업 검토"]],
  ["재무구조", ["부채비율 높음", "유동비율 낮음", "현금흐름 불안", "단기차입금 증가", "가수금 정리", "가지급금 정리", "매출채권 회수 지연", "재고 부담"]],
  ["세무·자본거래", ["미처분이익잉여금 누적", "배당정책 검토", "임원퇴직금 규정", "정관정비", "이익소각 검토", "법인세 부담", "특수관계자 거래 점검"]],
  ["인증·R&D", ["기업부설연구소/전담부서", "벤처인증", "이노비즈", "메인비즈", "ISO 인증", "특허/지식재산권", "R&D 과제/정부과제"]],
  ["고용·노무", ["고용지원금", "통합고용세액공제", "청년고용/인건비 지원", "사내근로복지기금", "4대보험/급여대장 점검", "근로계약서/취업규칙 점검"]],
  ["승계·지분", ["가업승계", "지분구조 정리", "자녀법인/관계회사 구조", "주주간 리스크", "법인보험/목적자금", "대표자 유고/상속재원"]],
];
// [D-94] 고객 운영 업체 기록으로 고객 칸 채우기 — 빈 칸만(적어 둔 값은 덮지 않는다)
function osToCust(os, p) {
  const yr = new Date().getFullYear();
  const y4 = (d) => { const n = Number(String(d || "").slice(0, 4)); return n > 1900 ? n : null; };
  const emp = String(os.employeeCount || "").replace(/[^0-9]/g, "");
  const est = y4(os.establishedAt); const birth = y4(os.representativeBirth);
  return { ...p, osId: os.id, name: os.companyName,
    ceoName: p.ceoName || os.representativeName || os.contactName || "",
    empCount: p.empCount || emp, estYears: p.estYears || (est ? String(Math.max(0, yr - est)) : ""), ceoAge: p.ceoAge || (birth ? String(yr - birth) : ""),
    managerName: p.managerName || (os.representativeName && os.contactName !== os.representativeName ? os.contactName || "" : ""),
    managerPhone: p.managerPhone || os.contactPhone || "", homepage: p.homepage || os.homepage || "" };
}
const CUST_EMPTY = { name: "", industry: "제조업", ceoName: "", empCount: "", revenue: "", netIncome: "", estYears: "", ceoAge: "", stage: "lead", concern: "", nextAction: "자료 요청", nextDate: todayISO(), memo: "", expectedFee: "", expectedPremium: "", premiumFeeRate: "", issues: [], flags: {}, interests: [], dbSource: "", referrer: "", referrerPhone: "", dbDate: "", firstContactDate: "", ceoPhone: "", managerName: "", managerPhone: "", homepage: "", cretopChecked: false, financialSecured: false };
// ── 크레탑 숫자 추출기 전용 큰 화면(오버레이) — 원문 확인 → 후보 추출 → 검수 → 미리보기 ──
// ── 실전 검증 모드 — 실패 원인 수집용 디버그·체크리스트 보조 ──────────────
const CRETOP_QA_ITEMS = [
  ["p1_ok", "PDF 1번 추출 성공"], ["p1_rev", "PDF 1번 매출액 후보 확인"], ["p1_bs", "PDF 1번 자산/부채/자본 후보 확인"], ["p1_ratio", "PDF 1번 비율 후보 확인"],
  ["p2_ok", "PDF 2번 추출 성공"], ["p2_rev", "PDF 2번 매출액 후보 확인"], ["p2_bs", "PDF 2번 자산/부채/자본 후보 확인"], ["p2_ratio", "PDF 2번 비율 후보 확인"],
  ["p3_ok", "PDF 3번 추출 성공"], ["p3_rev", "PDF 3번 매출액 후보 확인"], ["p3_bs", "PDF 3번 자산/부채/자본 후보 확인"], ["p3_ratio", "PDF 3번 비율 후보 확인"],
];
function loadCretopQa() { try { return JSON.parse(localStorage.getItem("cretop-qa3") || "{}") || {}; } catch (e) { return {}; } }
function saveCretopQa(o) { try { localStorage.setItem("cretop-qa3", JSON.stringify(o)); } catch (e) {} }
function cretopHl(text, q) { const t = String(text || ""); if (!q) return t; const i = t.indexOf(q); if (i < 0) return t; return <>{t.slice(0, i)}<mark style={{ background: "#FDE68A", color: "#7c2d12", padding: 0 }}>{t.slice(i, i + q.length)}</mark>{cretopHl(t.slice(i + q.length), q)}</>; }
// 핵심 재무지표 미리보기 결과(텍스트)
function cretopPreviewResult(rows) {
  const sel = (rows || []).filter((r) => r.sel && r.status === "적용 후보");
  return EXTRACT_ORDER.map((k) => { const r = sel.find((x) => x.accountKey === k); const v = r ? (r.isRatio ? `${r.rawValue}${r.unit}` : extractEokText(r)) : "선택 없음"; return `${EXTRACT_LABEL_KR[k]}: ${v}${r ? ` (연도 ${r.year == null ? "-" : r.year}, ${r.section}, L${r.lineIndex})` : ""}`; }).join("\n");
}
// 실패 분석용 디버그 한 번에 — 원문 라인/주변 라인 포함(외부 공유 전 민감정보 확인 필요)
function cretopFailDebug({ dbg, rows, fileName, screen, errMsg }) {
  const lines = (dbg && dbg.lines) || [];
  const numLines = lines.filter((l) => l.hasNum).slice(0, 100).map((l) => `L${l.li}: ${l.text}`);
  const acctLines = lines.filter((l) => l.hasAcct).slice(0, 100).map((l) => `L${l.li}: ${l.text}`);
  const near = (kw) => { const out = []; const seen = new Set(); lines.forEach((l, idx) => { if (l.text.includes(kw) || (l.ntext || "").includes(kw)) { for (let j = Math.max(0, idx - 3); j <= Math.min(lines.length - 1, idx + 3); j++) { if (!seen.has(j)) { seen.add(j); out.push(`L${lines[j].li}: ${lines[j].text}${lines[j].ntext && lines[j].ntext !== lines[j].text ? "  ⟶ " + lines[j].ntext : ""}`); } } } }); return out.slice(0, 40); };
  const cnt = (st) => (rows || []).filter((r) => r.status === st).length;
  const L = ["[크레탑 숫자 추출기 실패 분석용 디버그]", "※ 원문 일부가 포함됩니다. 외부 공유 전 민감정보(기업명·사업자번호 등)를 확인해주세요.", "",
    `· 앱: ${APP_RELEASE.name} ${APP_RELEASE.version} (빌드 ${APP_RELEASE.build})`, `· 현재 화면: ${screen || "크레탑 숫자 추출기"}`, `· 파일명: ${fileName || "(직접 붙여넣기/미상)"}`,
    `· 추출 글자 수: ${dbg ? dbg.chars : 0} · 원문 라인 수: ${dbg ? dbg.lineCount : 0}`, `· 숫자 포함 라인: ${dbg ? dbg.numberLineCount : 0} · 계정명 후보 라인: ${dbg ? dbg.acctLineCount : 0}`,
    `· 감지 기업명 후보: ${(dbg && dbg.companyName) || "-"} · 사업자번호 후보: ${(dbg && dbg.businessNo) || "-"}`,
    `· 감지 섹션 후보: ${((dbg && dbg.detectedSections) || []).join(", ") || "(없음)"}`, `· 감지 단위 후보: ${((dbg && dbg.detectedUnits) || []).join(", ") || "(없음)"}`, `· 감지 연도 후보: ${((dbg && dbg.detectedYears) || []).join(", ") || "(없음)"}`,
    `· 추출 후보: ${(rows || []).length} · 적용 후보: ${cnt("적용 후보")} · 검수 필요: ${cnt("검수 필요") + cnt("단위 확인 필요") + cnt("연도 확인 필요")} · 오류 의심: ${cnt("오류 의심")} · 제외: ${cnt("제외")}`,
    `· 핵심6 후보 확보: ${cretopCoreFoundCount(rows)}/6`, `· 최근 오류 메시지: ${errMsg || _LAST_ERROR || "없음"}`, "",
    "[핵심 재무지표 미리보기]", cretopPreviewResult(rows), "", "[추출 결과 CSV]", extractRowsToCsv(rows || []).replace(/^﻿/, ""), "",
    "[숫자 포함 라인 상위 100]", numLines.join("\n") || "(없음)", "", "[계정명 후보 라인 상위 100]", acctLines.join("\n") || "(없음)", ""];
  ["매출액", "영업이익", "당기순이익", "자산", "부채", "자본", "부채비율", "유동비율", "이자보상"].forEach((kw) => { L.push(`[‘${kw}’ 주변 라인]`, near(kw).join("\n") || "(없음)", ""); });
  L.push("[rawText 첫 5000자]", ((dbg && dbg.rawText) || "").slice(0, 5000));
  return L.join("\n");
}
function CretopExtractorScreen({ open, seedRaw, seedName, source, onClose, onSend }) {
  const _seed0 = () => String(seedRaw || "");
  const _init0 = () => { const s = _seed0(); return open && s.trim() ? extractCretopCandidatesFromLines(s) : null; };
  const [input, setInput] = useState(_seed0);
  const [rows, setRows] = useState(() => { const r = _init0(); return r ? r.rows : null; });
  const [dbg, setDbg] = useState(() => { const r = _init0(); return r ? r.debug : null; });
  const [fStatus, setFStatus] = useState("전체");
  const [fSection, setFSection] = useState("전체");
  const [fConf, setFConf] = useState("전체");
  const [q, setQ] = useState("");
  const [lineQ, setLineQ] = useState("");
  const [expandRow, setExpandRow] = useState(null);
  const [qa, setQa] = useState(loadCretopQa);
  const [hideExcluded, setHideExcluded] = useState(false);
  const [selLi, setSelLi] = useState(null);
  const [showRaw, setShowRaw] = useState(false);
  const [lineView, setLineView] = useState("all");
  useEffect(() => { if (open) { const seed = String(seedRaw || ""); setInput(seed); setFStatus("전체"); setFSection("전체"); setFConf("전체"); setQ(""); setLineQ(""); setExpandRow(null); setSelLi(null); setShowRaw(false); setLineView("all"); setHideExcluded(false); if (seed.trim()) { const res = extractCretopCandidatesFromLines(seed); setRows(res.rows); setDbg(res.debug); } else { setRows(null); setDbg(null); } } }, [open, seedRaw]);
  if (!open) return null;
  const run = (text) => { const res = extractCretopCandidatesFromLines(String(text || "")); setRows(res.rows); setDbg(res.debug); setSelLi(null); if (!res.rows.length) showToast("숫자 후보를 찾지 못했습니다. 좌측 ‘원문 확인·디버그’에서 rawText 상태(계정명/숫자 라인 수)를 점검해주세요."); else showToast(`숫자 후보 ${res.rows.length}건을 추출했습니다. 우측 표에서 연도·단위·값을 검수해주세요. (자동 반영 안 함)`); };
  const update = (id, patch) => setRows((rs) => (rs || []).map((r) => r.id === id ? { ...r, ...patch } : r));
  const del = (id) => setRows((rs) => (rs || []).filter((r) => r.id !== id));
  const addRow = () => setRows((rs) => [...(rs || []), { id: `n${Date.now()}`, account: "", accountKey: "", isRatio: false, lineIndex: -1, contextLines: [], rowText: "(직접 추가)", numberCandidates: [], yearCandidates: [], rawValue: "", year: "", selectedReason: "직접 추가", unit: "백만원", section: "직접입력", confidence: "직접", status: "검수 필요", sel: false }]);
  const bulkUnit = (u) => setRows((rs) => (rs || []).map((r) => r.sel && !r.isRatio ? { ...r, unit: u === "확인 필요" ? "" : u } : r));
  const ymd = todayISO().replace(/-/g, "");
  const copyRowsBtn = () => { if (!rows || !rows.length) { showToast("복사할 결과가 없습니다."); return; } copyText(extractRowsToText(rows), () => showToast("추출 결과를 복사했습니다.")); };
  const csvBtn = () => { if (!rows || !rows.length) { showToast("다운로드할 결과가 없습니다."); return; } downloadTextFile(extractRowsToCsv(rows), `cretop-extracted-numbers-${ymd}.csv`, "text/csv;charset=utf-8;") ? showToast("CSV를 다운로드했습니다.") : showToast("CSV 생성 중 오류가 발생했습니다."); };
  const copyRawBtn = () => { if (!dbg) { showToast("원문이 없습니다."); return; } copyText(dbg.rawText, () => showToast("원문 전체를 복사했습니다.")); };
  const txtBtn = () => { if (!dbg) { showToast("원문이 없습니다."); return; } downloadTextFile(dbg.rawText, `cretop-rawtext-${ymd}.txt`, "text/plain;charset=utf-8;") ? showToast("원문 TXT를 다운로드했습니다.") : showToast("다운로드 중 오류가 발생했습니다."); };
  const jsonBtn = () => { if (!dbg) { showToast("원문이 없습니다."); return; } copyText(cretopDebugJson(dbg, rows), () => showToast("디버그 JSON을 복사했습니다.")); };
  const failBtn = () => { if (!dbg) { showToast("먼저 원문을 넣고 숫자 후보를 추출해주세요."); return; } copyText(cretopFailDebug({ dbg, rows: rows || [], fileName: seedName, screen: "크레탑 숫자 추출기", errMsg: "" }), () => showToast("실패 분석용 디버그를 복사했습니다. (원문 일부 포함 — 외부 공유 전 확인)")); };
  const qaToggle = (id) => setQa((o) => { const n = { ...o, [id]: !o[id] }; saveCretopQa(n); return n; });
  const sendBtn = () => { const sel = (rows || []).filter((r) => r.sel && r.status !== "제외"); if (!sel.length) { showToast("보낼 행을 선택해주세요. (카드에서 체크)"); return; } const yrs = (dbg && dbg.detectedYears) || []; const g = { is: [], bs: [], ratio: [], my: [] }; const gu = {}; sel.forEach((r) => { const s = r.section || ""; const cat = /손익계산서/.test(s) ? "is" : /재무비율|재무구조|부채상환/.test(s) ? "ratio" : /요약\s*재무상태표|MY/.test(s) ? "bs" : "my"; const line = r.numberCandidates && r.numberCandidates.length ? `${r.account} ${r.numberCandidates.join(" ")}` : `${r.account} ${r.rawValue}`; g[cat].push(line); if (!gu[cat] && r.unit && !r.isRatio) gu[cat] = r.unit; }); const build = (cat, title) => { if (!g[cat].length) return ""; const head = gu[cat] ? `${title} 단위:${gu[cat]}` : title; const yr = yrs.length ? `\n구분 ${yrs.join(" ")}` : ""; return `${head}\n${g[cat].join("\n")}${yr}`; }; onSend && onSend({ pasteIs: build("is", "요약 손익계산서"), pasteBs: build("bs", "요약 재무상태표"), pasteRatio: build("ratio", "재무구조"), pasteMy: build("my", "재무상태표") }); };
  const stColor = (st) => st === "적용 후보" ? C.ok : st === "오류 의심" ? C.err : st === "제외" ? C.textM : st === "검수 필요" ? "#C77700" : C.warn;
  const stBg = (st) => st === "적용 후보" ? "#EAF7EE" : st === "오류 의심" ? "#FDECEC" : st === "제외" ? "#F2F2F2" : st === "검수 필요" ? "#FFF7E6" : "#FFFBEC";
  const cfColor = (c) => c === "높음" ? C.ok : c === "낮음" ? C.err : c === "직접" ? C.blue : C.warn;
  const cellInp = (w) => ({ width: w, maxWidth: w, padding: "4px 6px", border: `1px solid ${C.bdr}`, borderRadius: 6, fontFamily: FF, fontSize: "calc(var(--s,1.3)*12px)", color: C.text, background: "#fff" });
  const cellSel = { padding: "4px 4px", border: `1px solid ${C.bdr}`, borderRadius: 6, fontFamily: FF, fontSize: "calc(var(--s,1.3)*12px)", background: "#fff" };
  const th = { padding: "6px 8px", fontSize: "calc(var(--s,1.3)*11px)", color: C.textM, fontWeight: 800, textAlign: "left", whiteSpace: "nowrap", borderBottom: `1px solid ${C.bdr}`, background: C.bg, position: "sticky", top: 0 };
  const td = { padding: "4px 8px", borderBottom: `1px solid ${C.bdr}`, verticalAlign: "middle", whiteSpace: "nowrap" };
  const cardLbl = { display: "inline-flex", alignItems: "center", gap: 4, fontSize: "calc(var(--s,1.3)*11px)", color: C.textM, fontWeight: 700 };
  const stepBadge = (n, t) => <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "2px 0 8px" }}><span style={{ background: C.blue, color: "#fff", fontWeight: 900, fontSize: "calc(var(--s,1.3)*12px)", borderRadius: 999, padding: "2px 10px" }}>{n}단계</span><span style={{ fontWeight: 900, color: C.text, fontSize: "calc(var(--s,1.3)*15px)" }}>{t}</span></div>;
  const cnt = (st) => (rows || []).filter((r) => r.status === st).length;
  const cardBox = { background: "#fff", border: `1px solid ${C.bdr}`, borderRadius: 12, padding: 14 };
  let visible = rows || [];
  if (hideExcluded) visible = visible.filter((r) => r.status !== "제외");
  if (fStatus !== "전체") visible = visible.filter((r) => r.status === fStatus);
  if (fSection !== "전체") visible = visible.filter((r) => r.section === fSection);
  if (fConf !== "전체") visible = visible.filter((r) => r.confidence === fConf);
  if (q.trim()) visible = visible.filter((r) => (r.account || "").includes(q.trim()) || (r.rowText || "").includes(q.trim()));
  const sectionOpts = Array.from(new Set([...(dbg ? dbg.detectedSections : []), ...((rows || []).map((r) => r.section))])).filter(Boolean);
  const selApply = (rows || []).filter((r) => r.sel && r.status === "적용 후보");
  const pick = (k) => selApply.find((r) => r.accountKey === k);
  let dl = dbg ? dbg.lines : [];
  if (lineView === "num") dl = dl.filter((l) => l.hasNum); else if (lineView === "acct") dl = dl.filter((l) => l.hasAcct); else if (lineView === "sec") dl = dl.filter((l) => !!cretopSecOf(l.ntext || l.text));
  if (lineQ.trim()) dl = dl.filter((l) => l.text.includes(lineQ.trim()) || (l.ntext || "").includes(lineQ.trim()));
  const content = <div style={{ position: "fixed", inset: 0, zIndex: 1200, background: "rgba(15,23,42,.5)", backdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "clamp(6px,2vw,20px)" }}>
    <div style={{ width: "min(1360px, 96vw)", height: "90vh", background: C.bg, borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,.3)", display: "flex", flexDirection: "column", overflow: "hidden" }} onClick={(e) => e.stopPropagation()}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "14px 18px", background: C.card, borderBottom: `1px solid ${C.bdr}`, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}><span style={{ fontSize: "calc(var(--s,1.3)*22px)" }}>🔢</span><span style={{ fontWeight: 900, color: C.blue, fontSize: "calc(var(--s,1.3)*19px)" }}>크레탑 숫자 추출기</span><Badge color={C.gold} bg="#FCEFDA">검수용 · 자동 반영 안 함</Badge></div>
        <button onClick={onClose} style={{ border: `1px solid ${C.bdr}`, background: "#fff", borderRadius: 9, padding: "7px 14px", cursor: "pointer", fontFamily: FF, fontWeight: 800, color: C.textS, fontSize: "calc(var(--s,1.3)*14px)" }}>✕ 닫기</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px" }}>
        {(() => { const coreN = cretopCoreFoundCount(rows); const ok = coreN >= 4; const sectionsN = dbg ? (dbg.detectedSections || []).length : 0; const stat = [["파일명", seedName || (input.trim() ? "직접 붙여넣기" : "-")], ["추출 글자 수", dbg ? dbg.chars.toLocaleString() : 0], ["원문 라인 수", dbg ? dbg.lineCount : 0], ["숫자 포함 라인", dbg ? dbg.numberLineCount : 0], ["계정명 후보 라인", dbg ? dbg.acctLineCount : 0], ["감지 섹션 수", sectionsN], ["추출 후보 수", rows ? rows.length : 0], ["적용 후보 수", cnt("적용 후보")], ["검수 필요 수", cnt("검수 필요") + cnt("단위 확인 필요") + cnt("연도 확인 필요")], ["오류 의심 수", cnt("오류 의심")], ["제외 수", cnt("제외")]]; return <div style={{ background: "#fff", border: `2px solid ${C.blue}55`, borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 6 }}><span style={{ fontSize: "calc(var(--s,1.3)*18px)" }}>🔬</span><b style={{ fontSize: "calc(var(--s,1.3)*17px)", color: C.blue }}>실전 검증 모드</b><span style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*12px)" }}>실제 크레탑 PDF 2~3개를 넣어보고, 어떤 원문과 숫자 후보가 잡혔는지 확인하는 용도입니다.</span></div>
          <div style={{ background: C.bg, border: `1px solid ${C.bdr}`, borderRadius: 9, padding: "9px 12px", color: C.textS, fontSize: "calc(var(--s,1.3)*12px)", lineHeight: 1.6, marginBottom: 10 }}>· 현재 목표는 <b>PDF 한 번에 완벽 분석</b>이 아니라, 실제 크레탑 PDF에서 <b>숫자 후보를 충분히 뽑아내고 사람이 검수</b>할 수 있게 만드는 것입니다.<br />· 매출액·영업이익·당기순이익·자산총계·부채총계·자본총계 중 <b>4개 이상 후보</b>가 잡히면 1차 성공으로 봅니다.<br />· 틀린 숫자가 확정값처럼 들어가는 것보다, <b>후보와 원문 라인을 보여주는 것</b>이 우선입니다.</div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: ok ? C.greenBg : C.warnBg, border: `1px solid ${ok ? C.ok : C.warn}55`, borderRadius: 999, padding: "5px 14px", marginBottom: 10 }}><b style={{ color: ok ? C.ok : C.warn, fontSize: "calc(var(--s,1.3)*14px)" }}>핵심6 후보 {coreN}/6</b><span style={{ color: C.textS, fontSize: "calc(var(--s,1.3)*12px)" }}>{ok ? "1차 성공 기준 충족" : "4개 이상이면 1차 성공"}</span></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(108px, 1fr))", gap: 6, marginBottom: 10 }}>{stat.map(([k, v]) => <div key={k} style={{ background: C.bg, borderRadius: 8, padding: "6px 9px", minWidth: 0 }}><div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*11px)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{k}</div><div style={{ fontWeight: 800, color: C.text, fontSize: "calc(var(--s,1.3)*15px)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{v}</div></div>)}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 6 }}><button style={btnP} onClick={failBtn}>🧷 실패 분석용 디버그 복사</button><span style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*11px)", lineHeight: 1.5, flex: "1 1 220px", minWidth: 0 }}>디버그에는 원문 일부가 포함될 수 있습니다. 외부 공유 전 민감정보를 확인해주세요.</span></div>
          <details style={{ marginTop: 4 }}>
            <summary style={{ cursor: "pointer", fontWeight: 800, color: C.textS, fontSize: "calc(var(--s,1.3)*13px)", padding: "4px 0" }}>📋 실제 PDF 3건 검증 체크리스트 (이 브라우저에 저장)</summary>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 6, marginTop: 8 }}>{CRETOP_QA_ITEMS.map(([id, label]) => <label key={id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: qa[id] ? C.greenBg : C.bg, borderRadius: 8, cursor: "pointer", border: `1px solid ${qa[id] ? C.ok + "40" : C.bdr}` }}><input type="checkbox" checked={!!qa[id]} onChange={() => qaToggle(id)} /><span style={{ fontSize: "calc(var(--s,1.3)*13px)", color: C.text }}>{label}</span></label>)}</div>
          </details>
          <div style={{ marginTop: 10, padding: "8px 12px", background: C.bg, border: `1px dashed ${C.bdr}`, borderRadius: 8, color: C.textM, fontSize: "calc(var(--s,1.3)*12px)", lineHeight: 1.6 }}>🔒 고객 정보 반영 — <b>실전 검증 후 활성화 예정</b>. 실제 PDF 정확도가 검증되기 전까지 잘못된 숫자가 고객 정보에 들어가지 않도록 자동 반영은 비활성 상태입니다.</div>
        </div>; })()}
        <div className="cretopCols">
          <div style={{ display: "grid", gap: 12, minWidth: 0 }}>
            <div style={cardBox}>
              {stepBadge(1, "원문 가져오기")}
              <textarea style={{ ...inp, height: 150, resize: "vertical", fontFamily: "ui-monospace, Menlo, monospace", fontSize: "calc(var(--s,1.3)*12px)" }} value={input} onChange={(e) => setInput(e.target.value)} placeholder={"크레탑 PDF에서 추출한 원문 전체를 붙여넣으세요. 실제 PDF는 줄/열이 깨져 있어도 됩니다.\n예)\n매출액\n1,250\n1,860\n2,430"} />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                <button style={btnP} onClick={() => run(input)}>🔢 숫자 후보 추출</button>
                {String(seedRaw || "").trim() ? <button style={btnS} onClick={() => { setInput(String(seedRaw || "")); run(String(seedRaw || "")); }}>📄 PDF 추출 원문 다시 넣기</button> : null}
                <button style={btnS} onClick={() => { setInput(CRETOP_EXTRACT_SAMPLE); run(CRETOP_EXTRACT_SAMPLE); }}>🧪 가상 샘플 넣기</button>
                <button style={{ ...btnS, color: C.textM }} onClick={() => { setInput(""); setRows(null); setDbg(null); setSelLi(null); showToast("원문/결과를 초기화했습니다."); }}>↺ 원문 초기화</button>
              </div>
            </div>
            <div style={cardBox}>
              {stepBadge(2, "원문 확인 · 디버그")}
              {dbg ? <>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 6, marginBottom: 8 }}>
                  {[["글자 수", dbg.chars.toLocaleString()], ["라인 수", dbg.lineCount.toLocaleString()], ["숫자 포함 라인", dbg.numberLineCount], ["계정명 후보 라인", dbg.acctLineCount]].map(([k, v]) => <div key={k} style={{ background: C.bg, borderRadius: 8, padding: "6px 8px" }}><div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*11px)" }}>{k}</div><div style={{ fontWeight: 800, color: C.text, fontSize: "calc(var(--s,1.3)*15px)" }}>{v}</div></div>)}
                </div>
                <div style={{ fontSize: "calc(var(--s,1.3)*12px)", color: C.textS, lineHeight: 1.7 }}>· 기업명 후보: <b>{dbg.companyName || "(미감지)"}</b>{dbg.businessNo ? ` · 사업자번호: ${dbg.businessNo}` : ""}{dbg.ceoName ? ` · 대표자: ${dbg.ceoName}` : ""}<br />· 감지 섹션: <b>{(dbg.detectedSections || []).join(", ") || "(없음)"}</b><br />· 감지 연도: <b>{(dbg.detectedYears || []).join(", ") || "(없음)"}</b> · 감지 단위: <b>{(dbg.detectedUnits || []).join(", ") || "(없음)"}</b></div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "8px 0" }}>
                  {[["all", "전체 라인"], ["num", "숫자 포함만"], ["acct", "계정명 후보만"], ["sec", "섹션 후보만"]].map(([k, t]) => <button key={k} onClick={() => setLineView(k)} style={{ ...btnSm, background: lineView === k ? C.blue : "#fff", color: lineView === k ? "#fff" : C.textS }}>{t}</button>)}
                  <button style={btnSm} onClick={copyRawBtn}>원문 전체 복사</button>
                  <button style={btnSm} onClick={txtBtn}>원문 TXT 다운로드</button>
                  <button style={btnSm} onClick={jsonBtn}>디버그 JSON 복사</button>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 6 }}>
                  <input value={lineQ} onChange={(e) => setLineQ(e.target.value)} placeholder="원문 라인 검색" style={{ ...cellInp(130), width: 130 }} />
                  {lineQ ? <button style={{ ...btnSm, color: C.textM }} onClick={() => setLineQ("")}>지우기</button> : null}
                  {["매출액", "영업이익", "당기순이익", "자산총계", "부채총계", "자본총계", "부채비율", "유동비율", "이자보상"].map((kw) => <button key={kw} onClick={() => setLineQ(kw)} style={{ ...btnSm, padding: "3px 8px", background: lineQ === kw ? C.gold : "#fff", color: lineQ === kw ? "#fff" : C.textS }}>{kw}</button>)}
                </div>
                <div style={{ border: `1px solid ${C.bdr}`, borderRadius: 8, maxHeight: 220, overflow: "auto", background: "#fff", fontFamily: "ui-monospace, Menlo, monospace", fontSize: "calc(var(--s,1.3)*11px)" }}>
                  {dl.length === 0 ? <div style={{ padding: "8px", color: C.textM }}>표시할 라인이 없습니다{lineQ ? ` (검색: ‘${lineQ}’)` : ""}.</div> : dl.slice(0, 400).map((l) => <div key={l.li} onClick={() => setSelLi(l.li)} style={{ display: "flex", gap: 6, padding: "2px 8px", cursor: "pointer", background: selLi === l.li ? "#FFF3D6" : (l.hasAcct ? C.blueBg : "transparent"), borderBottom: `1px solid ${C.bg}` }}><span style={{ color: C.textM, minWidth: 34, textAlign: "right", flexShrink: 0 }}>L{l.li}</span><span style={{ color: l.hasAcct ? C.blue : C.text, wordBreak: "break-all" }}>{lineQ ? cretopHl(l.text, lineQ.trim()) : l.text}</span></div>)}
                  {dl.length > 400 ? <div style={{ padding: "4px 8px", color: C.textM }}>… {dl.length - 400}줄 더 (TXT 다운로드로 전체 확인)</div> : null}
                </div>
                {selLi != null ? <div style={{ marginTop: 8, border: `1px solid ${C.gold}55`, borderRadius: 8, padding: "8px 10px", background: "#FFFCF5" }}>
                  <div style={{ fontWeight: 800, color: C.gold, fontSize: "calc(var(--s,1.3)*12px)", marginBottom: 4 }}>📍 선택한 원문 주변 (라인 {selLi})</div>
                  <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: "calc(var(--s,1.3)*11px)", lineHeight: 1.6 }}>{(dbg.lines || []).filter((l) => l.li >= selLi - 5 && l.li <= selLi + 5).map((l) => <div key={l.li} style={{ color: l.li === selLi ? C.err : C.textS, fontWeight: l.li === selLi ? 800 : 400 }}>{l.li}: {l.text}{l.ntext && l.ntext !== l.text ? <span style={{ color: C.gold }}> ⟶ {l.ntext}</span> : null}</div>)}</div>
                </div> : null}
              </> : <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*13px)", padding: "8px 2px" }}>원문을 넣고 ‘숫자 후보 추출’을 누르면, 라인/숫자/계정/단위/연도/섹션 디버그 정보가 여기에 표시됩니다.</div>}
            </div>
          </div>
          <div style={{ display: "grid", gap: 12, minWidth: 0 }}>
            <div style={{ ...cardBox, border: `2px solid ${C.gold}55`, background: "#FFFCF5" }}>
              {stepBadge(4, "핵심 재무지표 미리보기")}
              <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*12px)", marginBottom: 6 }}>선택된 ‘적용 후보’ {selApply.length}건 기준 · 모두 추출 후보이며 고객 정보에 자동 반영되지 않습니다.</div>
              {selApply.length ? <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 6 }}>{EXTRACT_ORDER.map((key) => { const r = pick(key); const val = r ? (r.isRatio ? `${r.rawValue}${r.unit}` : extractEokText(r)) : null; return <div key={key} style={{ padding: "7px 10px", background: "#fff", borderRadius: 8, border: `1px solid ${C.bdr}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}><span style={{ color: C.textS, fontSize: "calc(var(--s,1.3)*13px)", fontWeight: 700 }}>{EXTRACT_LABEL_KR[key]}{r && r.year ? <span style={{ color: C.textM, fontWeight: 400 }}> ({r.year})</span> : null}</span><span style={{ fontSize: "calc(var(--s,1.3)*14px)", fontWeight: 800, color: val ? C.text : C.textM, textAlign: "right" }}>{val || "선택된 값 없음"}</span></div>
                {r ? <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*10px)", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.section} · 라인 {r.lineIndex} · {r.status}</div> : null}
              </div>; })}</div> : <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*13px)", padding: "6px 2px" }}>선택된 값 없음 — 아래 표에서 사용할 항목을 체크하고 상태를 ‘적용 후보’로 두면 여기에 표시됩니다.</div>}
            </div>
            <div style={cardBox}>
              {stepBadge(3, "숫자 후보 표 (검수)")}
              {rows ? (rows.length ? <>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", fontSize: "calc(var(--s,1.3)*12px)", marginBottom: 8 }}>
                  <span style={{ background: C.bg, borderRadius: 7, padding: "3px 8px" }}>전체 <b>{rows.length}</b></span>
                  <span style={{ background: "#EAF7EE", borderRadius: 7, padding: "3px 8px", color: C.ok }}>적용 후보 <b>{cnt("적용 후보")}</b></span>
                  <span style={{ background: "#FFF7E6", borderRadius: 7, padding: "3px 8px", color: "#C77700" }}>검수 필요 <b>{cnt("검수 필요") + cnt("단위 확인 필요") + cnt("연도 확인 필요")}</b></span>
                  <span style={{ background: "#FDECEC", borderRadius: 7, padding: "3px 8px", color: C.err }}>오류 의심 <b>{cnt("오류 의심")}</b></span>
                  <span style={{ background: "#F2F2F2", borderRadius: 7, padding: "3px 8px", color: C.textM }}>제외 <b>{cnt("제외")}</b></span>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="계정명 검색" style={{ ...cellInp(110), width: 110 }} />
                  <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} style={cellSel}><option>전체</option>{EXTRACT_STATUS.map((s) => <option key={s}>{s}</option>)}</select>
                  <select value={fSection} onChange={(e) => setFSection(e.target.value)} style={cellSel}><option>전체</option>{sectionOpts.map((s) => <option key={s}>{s}</option>)}</select>
                  <select value={fConf} onChange={(e) => setFConf(e.target.value)} style={cellSel}><option>전체</option>{["높음", "보통", "낮음", "직접"].map((s) => <option key={s}>{s}</option>)}</select>
                  <button style={{ ...btnSm, background: hideExcluded ? C.blue : "#fff", color: hideExcluded ? "#fff" : C.textS }} onClick={() => setHideExcluded((v) => !v)}>{hideExcluded ? "제외 숨김 ON" : "제외 숨기기"}</button>
                  <button style={btnSm} onClick={addRow}>＋ 행 추가</button>
                  <select style={cellSel} value="" onChange={(e) => { if (e.target.value) bulkUnit(e.target.value); }}><option value="">단위 일괄(선택 행)</option>{EXTRACT_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</select>
                </div>
                <div style={{ border: `1px solid ${C.bdr}`, borderRadius: 10, maxHeight: 460, overflowY: "auto", overflowX: "hidden", padding: 8, display: "grid", gap: 8, boxSizing: "border-box" }}>
                  {visible.map((r) => { const opn = expandRow === r.id; return <div key={r.id} style={{ border: `1px solid ${C.bdr}`, borderLeft: `4px solid ${stColor(r.status)}`, borderRadius: 10, background: stBg(r.status), padding: "8px 10px", maxWidth: "100%", boxSizing: "border-box" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                      <input type="checkbox" checked={!!r.sel} onChange={(e) => update(r.id, { sel: e.target.checked })} title="보낼 행 선택" />
                      <span style={{ fontWeight: 800, color: C.text, fontSize: "calc(var(--s,1.3)*14px)" }}>{r.account || "(미지정)"}</span>
                      <span style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*12px)" }}>{r.rawValue == null || r.rawValue === "" ? "—" : `${r.rawValue}${r.isRatio ? (r.unit || "") : (r.unit ? " " + r.unit : "")}`}</span>
                      <span style={{ fontWeight: 800, color: r.isRatio ? C.blue : C.text, fontSize: "calc(var(--s,1.3)*14px)" }}>{extractEokText(r)}</span>
                      {r.year ? <span style={{ fontSize: "calc(var(--s,1.3)*11px)", color: C.textM, background: "#fff", border: `1px solid ${C.bdr}`, borderRadius: 6, padding: "1px 6px" }}>{r.year}년</span> : null}
                      <span style={{ fontSize: "calc(var(--s,1.3)*11px)", fontWeight: 800, color: "#fff", background: stColor(r.status), borderRadius: 6, padding: "2px 7px" }}>{r.status}</span>
                      <span style={{ fontSize: "calc(var(--s,1.3)*11px)", fontWeight: 800, color: cfColor(r.confidence), border: `1px solid ${cfColor(r.confidence)}66`, borderRadius: 6, padding: "1px 6px" }}>{r.confidence}</span>
                      <span style={{ fontSize: "calc(var(--s,1.3)*10px)", color: C.textM }}>{r.section} · L{r.lineIndex}</span>
                      <button onClick={() => setExpandRow((v) => v === r.id ? null : r.id)} style={{ ...btnSm, marginLeft: "auto", padding: "3px 9px", background: opn ? C.blue : "#fff", color: opn ? "#fff" : C.textS }}>{opn ? "접기" : "상세 보기"}</button>
                    </div>
                    {opn ? <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${C.bdr}`, display: "grid", gap: 8 }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                        <label style={cardLbl}>계정명<input value={r.account} onChange={(e) => update(r.id, { account: e.target.value })} style={cellInp(110)} /></label>
                        <label style={cardLbl}>연도<input value={r.year == null ? "" : r.year} onChange={(e) => update(r.id, { year: e.target.value === "" ? null : e.target.value })} style={cellInp(56)} /></label>
                        <label style={cardLbl}>원문값<input value={r.rawValue == null ? "" : r.rawValue} onChange={(e) => update(r.id, { rawValue: e.target.value })} style={cellInp(84)} /></label>
                        <label style={cardLbl}>단위<select value={r.unit || "확인 필요"} onChange={(e) => update(r.id, { unit: e.target.value === "확인 필요" ? "" : e.target.value })} style={cellSel}>{EXTRACT_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}</select></label>
                        <label style={cardLbl}>상태<select value={r.status} onChange={(e) => update(r.id, { status: e.target.value })} style={{ ...cellSel, color: stColor(r.status), fontWeight: 700 }}>{EXTRACT_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
                      </div>
                      <div style={{ fontSize: "calc(var(--s,1.3)*11px)", color: C.textM, lineHeight: 1.7, wordBreak: "break-all" }}>
                        <div><b style={{ color: C.textS }}>원문 라인</b> · L{r.lineIndex}: {r.rowText || "-"}</div>
                        {r.normLine && r.normLine !== r.rowText ? <div><b style={{ color: C.textS }}>정규화 라인</b> · {r.normLine}</div> : null}
                        <div><b style={{ color: C.textS }}>후보 숫자</b> · [{(r.numberCandidates || []).join(", ") || "없음"}] · <b style={{ color: C.textS }}>연도</b> [{(r.yearCandidates || []).join(", ") || "없음"}]</div>
                        <div><b style={{ color: C.textS }}>판단 이유</b> · {r.selectedReason || "-"}</div>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button onClick={() => setSelLi(r.lineIndex)} style={{ ...btnSm }} title="좌측 원문에서 보기">📍 원문에서 보기</button>
                        <button onClick={() => del(r.id)} style={{ ...btnSm, color: C.err, borderColor: `${C.err}66` }}>✕ 삭제</button>
                      </div>
                    </div> : null}
                  </div>; })}
                  {!visible.length ? <div style={{ padding: 10, color: C.textM, fontSize: "calc(var(--s,1.3)*12px)" }}>표시할 후보가 없습니다.</div> : null}
                </div>
                <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*11px)", margin: "6px 0", lineHeight: 1.55 }}>표시 {visible.length} / 전체 {rows.length}건 · 모든 값은 ‘추출 후보’입니다. 카드의 ‘상세 보기’에서 단위·연도·상태를 수정할 수 있고, 단위 변경 시 억원이 즉시 재계산됩니다 · 업계순위/동종업계 등 차단 섹션 숫자는 상태 ‘제외’로 표시됩니다.</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button style={btnS} onClick={copyRowsBtn}>📋 추출 결과 복사</button>
                  <button style={btnS} onClick={csvBtn}>⬇️ CSV 다운로드</button>
                  <button style={btnP} onClick={sendBtn}>➡️ 선택한 숫자를 ‘표 텍스트 분석’으로 보내기</button>
                  <button style={{ ...btnS, opacity: 0.5, cursor: "not-allowed" }} disabled title="실제 PDF 3건 이상 실전 검증 후 활성화 예정">🔒 고객 정보 반영 — 실전 검증 후 활성화 예정</button>
                </div>
              </> : <div style={{ background: C.warnBg, border: `1px solid ${C.warn}40`, borderRadius: 8, padding: "10px 12px", color: C.textS, fontSize: "calc(var(--s,1.3)*13px)", lineHeight: 1.6 }}>숫자 후보를 찾지 못했습니다. 좌측 ‘원문 확인·디버그’에서 계정명 후보 라인/숫자 포함 라인 수를 확인하고, 요약 손익계산서·요약 재무상태표·재무비율 부분이 원문에 포함됐는지 점검해주세요. 디버그 JSON을 복사해 보정에 활용할 수 있습니다.</div>) : <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*13px)", padding: "8px 2px" }}>좌측 1단계에서 원문을 넣고 ‘숫자 후보 추출’을 누르면 여기에 검수용 표가 표시됩니다.</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>;
  if (typeof window !== "undefined" && typeof document !== "undefined" && document.body && document.body.nodeType === 1) return createPortal(content, document.body);
  return content;
}
function CustomerForm({ open, initial, mode, defaultDest, data, onSave, onClose, presetOsId }) {
  const [f, setF] = useState(CUST_EMPTY);
  const [dest, setDest] = useState(defaultDest || "lead");
  const [paste, setPaste] = useState("");
  const [openIssueCat, setOpenIssueCat] = useState("");   // 주요 이슈 태그: 펼친 카테고리
  const FIN_INIT = { open: false, finTab: "pdf", text: "", source: FIN_SOURCES[0], parsed: null, apply: {}, showRaw: false, saveRaw: true, file: null, layout: null, currentFileId: null, parsedFileId: null, preview: null, pasteOpen: false, pasteMy: "", pasteBs: "", pasteIs: "", pasteRatio: "", extractInput: "", extractRows: null, extractMeta: null, screenOpen: false, screenRaw: "" };
  const [fin, setFin] = useState(FIN_INIT);
  const [coreOpen, setCoreOpen] = useState(false);
  const [extHideErr, setExtHideErr] = useState(false);
  // [D-94] 업체에서 열었으면(?client=) 그 업체를 골라 둔 채로 연다
  useEffect(() => { if (open) { const presetOs = !initial && presetOsId ? salesOsClientOf(presetOsId) : null; setF(initial ? { ...CUST_EMPTY, ...initial, flags: initial.flags || {} } : presetOs ? osToCust(presetOs, CUST_EMPTY) : CUST_EMPTY); setDest(defaultDest || "lead"); setPaste(""); setFin(FIN_INIT); setExtHideErr(false); } }, [open, initial, defaultDest, presetOsId]);
  if (!open) return null;
  const upd = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const toggleFlag = (k) => setF((p) => ({ ...p, flags: { ...p.flags, [k]: !p.flags?.[k] } }));
  const autofill = () => { const p = parseMemo(paste); setF((cur) => ({ ...cur, ...p, flags: { ...cur.flags, ...p.flags }, memo: cur.memo ? cur.memo + "\n" + paste : paste })); showToast("메모에서 자동으로 채웠습니다. 값을 확인·수정해주세요."); };
  // ── 재무자료 자동입력 ──
  const analyzeText = (text, quiet, layout) => { const parsed = parseFinancials(text, layout); const apply = {}; parsed.items.forEach((it) => { apply[it.key] = !!it.apply && it.confidence !== "낮음" && !it.bad; }); setFin((s) => ({ ...s, parsed, apply, parsedFileId: s.currentFileId })); if (!quiet) { if (!parsed.items.length) { const fb = parsed.fallback || {}; const hint = (fb.keywords || []).length ? ` (발견 키워드: ${fb.keywords.slice(0, 4).join(", ")})` : ""; showToast(`명확한 계정-금액 구조를 찾지 못했습니다. 아래 디버그 정보·후보를 확인하거나 표 부분을 붙여넣어 주세요.${hint}`); } else { showToast(`추출 후보 ${parsed.items.length}건을 정리했습니다. 단위·계정명 확인 후 적용해주세요.`); } } return parsed; };
  const finAnalyze = () => { if (!fin.text.trim()) { showToast("재무자료 텍스트를 붙여넣거나 PDF/텍스트 파일을 첨부해주세요."); return; } analyzeText(fin.text, false, fin.layout); };
  // 가상 크레탑 표 샘플(전부 가상 데이터) → 4개 붙여넣기 칸에 채움
  const fillSampleTables = () => { setFin((s) => ({ ...s, pasteIs: CRETOP_SAMPLE_TABLES.income, pasteBs: CRETOP_SAMPLE_TABLES.balance, pasteRatio: CRETOP_SAMPLE_TABLES.ratio, pasteMy: CRETOP_SAMPLE_TABLES.detail, text: "", parsed: null, apply: {}, file: null, currentFileId: null, parsedFileId: null, preview: null, source: "크레탑" })); showToast("가상 크레탑 샘플(전부 가상 데이터)을 4개 칸에 넣었습니다. ‘크레탑 표 분석 시작’을 눌러주세요."); };
  // 붙여넣은 표 텍스트만 분석(PDF 전체 원문 아님) → 핵심 재무지표 산출
  const finPasteAnalyze = () => { const r = parseCretopPastedTables({ incomeText: fin.pasteIs, balanceText: fin.pasteBs, ratioText: fin.pasteRatio, detailText: fin.pasteMy }); if (!r.combined.trim()) { showToast("표 부분을 한 곳 이상 붙여넣어 주세요. (요약 손익계산서·요약 재무상태표·재무비율 중)"); return; } setFin((s) => ({ ...s, text: r.combined, layout: null, file: null, currentFileId: null, parsedFileId: null, parsed: null, apply: {}, preview: null })); const parsed = analyzeText(r.combined, true, null); const found = parsed && parsed.finalCore ? parsed.finalCore.found : 0; if (!found) { showToast("표에서 핵심 항목을 찾지 못했습니다. 요약 손익계산서, 요약 재무상태표, 재무비율 표 부분을 복사했는지 확인해주세요. 크레탑 표는 보통 계정명과 3개년 숫자가 한 줄에 있어야 인식률이 높습니다."); } else { showToast(`핵심 재무지표 ${found}건을 정리했습니다. 기준연도·단위를 확인해주세요. (모두 ‘추출 후보’입니다)`); } };
  // ── 크레탑 숫자 추출기(Stage 1) 핸들러 — 추출 결과는 검수용 표로만, 자동 적용 안 함 ──
  const runExtract = (srcText) => { const text = String(srcText || "").trim(); if (!text) { showToast("원문 텍스트를 붙여넣거나 PDF에서 추출한 원문을 불러와 주세요."); return; } const res = extractCretopNumbers(text); setFin((s) => ({ ...s, extractInput: text, extractRows: res.rows, extractMeta: { detectedYears: res.detectedYears, sections: res.sections, queryDate: res.queryDate } })); if (!res.rows.length) { showToast("재무표에서 숫자 후보를 찾지 못했습니다. 요약 손익계산서·요약 재무상태표·재무비율 표 부분이 원문에 포함됐는지 확인해주세요. 계정명과 연도별 숫자가 한 줄에 있어야 인식률이 높습니다."); } else { showToast(`숫자 후보 ${res.rows.length}건을 추출했습니다. 표에서 연도·단위·원문값을 확인·수정한 뒤 사용해주세요. (자동 반영되지 않습니다)`); } };
  const extractFromPaste = () => runExtract(fin.extractInput);
  const extractLoadPdf = () => { if (!fin.text.trim()) { showToast("먼저 ‘PDF 텍스트 추출만 시도’ 탭에서 PDF를 첨부해 원문을 추출해주세요."); return; } runExtract(fin.text); };
  const extractFillSample = () => { setFin((s) => ({ ...s, extractInput: CRETOP_EXTRACT_SAMPLE })); runExtract(CRETOP_EXTRACT_SAMPLE); };
  const extractReset = () => { setFin((s) => ({ ...s, extractInput: "", extractRows: null, extractMeta: null })); showToast("추출 결과를 초기화했습니다."); };
  const extractUpdateRow = (id, patch) => setFin((s) => ({ ...s, extractRows: (s.extractRows || []).map((r) => r.id === id ? { ...r, ...patch } : r) }));
  const extractDeleteRow = (id) => setFin((s) => ({ ...s, extractRows: (s.extractRows || []).filter((r) => r.id !== id) }));
  const extractAddRow = () => setFin((s) => ({ ...s, extractRows: [...(s.extractRows || []), { id: `n${Date.now()}`, accountKey: "", account: "", rawLabel: "", year: (s.extractMeta && s.extractMeta.detectedYears || []).slice(-1)[0] || "", values: [], latestIndex: -1, rawValue: "", unit: "백만원", section: "직접입력", rowText: "(직접 추가)", confidence: "직접", status: "단위 확인 필요", isRatio: false, sel: false }] }));
  const extractBulkUnit = (unit) => setFin((s) => ({ ...s, extractRows: (s.extractRows || []).map((r) => r.sel && !r.isRatio ? { ...r, unit: unit === "확인 필요" ? "" : unit } : r) }));
  const extractDownloadCsv = () => { const rows = fin.extractRows || []; if (!rows.length) { showToast("다운로드할 추출 결과가 없습니다."); return; } try { const csv = extractRowsToCsv(rows); const ymd = todayISO().replace(/-/g, ""); if (typeof document !== "undefined") { const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `cretop-extracted-numbers-${ymd}.csv`; document.body.appendChild(a); a.click(); document.body.removeChild(a); setTimeout(() => URL.revokeObjectURL(url), 1000); showToast("추출 결과 CSV를 다운로드했습니다."); } } catch (e) { showToast("CSV 생성 중 오류가 발생했습니다."); } };
  const extractCopy = () => { const rows = fin.extractRows || []; if (!rows.length) { showToast("복사할 추출 결과가 없습니다."); return; } copyText(extractRowsToText(rows), () => showToast("추출 결과를 복사했습니다.")); };
  // 선택한 행(원문행 보존)을 ‘표 텍스트 붙여넣기 분석’ 탭으로 전달
  const extractSendToPaste = () => { const rows = (fin.extractRows || []).filter((r) => r.sel && r.status !== "제외"); if (!rows.length) { showToast("선택된 행이 없습니다. 표에서 보낼 항목을 선택해주세요."); return; } const yrs = (fin.extractMeta && fin.extractMeta.detectedYears) || []; const groups = { is: [], bs: [], ratio: [], my: [] }; const gunits = {}; rows.forEach((r) => { const sec = r.section || ""; const cat = /손익계산서/.test(sec) ? "is" : /재무비율|재무구조|부채상환/.test(sec) ? "ratio" : /요약\s*재무상태표|MY/.test(sec) ? "bs" : "my"; groups[cat].push(r.rowText); if (!gunits[cat] && r.unit && !r.isRatio) gunits[cat] = r.unit; }); const build = (cat, title) => { if (!groups[cat].length) return ""; const head = gunits[cat] ? `${title} 단위:${gunits[cat]}` : title; const yr = yrs.length ? `\n구분 ${yrs.join(" ")}` : ""; return `${head}\n${groups[cat].join("\n")}${yr}`; }; setFin((s) => ({ ...s, finTab: "paste", pasteIs: build("is", "요약 손익계산서"), pasteBs: build("bs", "요약 재무상태표"), pasteRatio: build("ratio", "재무구조"), pasteMy: build("my", "재무상태표") })); showToast("선택한 숫자를 ‘표 텍스트 붙여넣기 분석’ 탭으로 보냈습니다. ‘크레탑 표 분석 시작’을 눌러주세요."); };
  const finApplyItems = (all) => { const parsed = fin.parsed; if (!parsed) return; setF((cur) => { const nf = { ...cur, flags: { ...cur.flags }, interests: [...(cur.interests || [])] }; parsed.items.forEach((it) => { if (!it.apply) return; if (!all && !fin.apply[it.key]) return; const a = it.apply; if (a.field) nf[a.field] = a.val; else if (a.flag) nf.flags[a.flag] = a.val; else if (a.interest && !nf.interests.includes(a.interest)) nf.interests.push(a.interest); }); const c0 = (parsed.concerns || [])[0]; if (c0 && !(nf.concern || "").includes(c0.slice(0, 8))) nf.concern = nf.concern ? nf.concern + " / " + c0 : c0; return nf; }); showToast(all ? "추출 결과를 전체 적용했습니다. 값을 확인·수정해주세요." : "선택한 항목을 적용했습니다. 값을 확인·수정해주세요."); };
  const finFile = async (e) => {
    const file = e.target.files && e.target.files[0]; if (!file) return; e.target.value = "";
    const nm = (file.name || "").toLowerCase();
    const isImg = /^image\//.test(file.type) || /\.(png|jpe?g|gif|webp|bmp|heic)$/.test(nm);
    if (nm.endsWith(".txt") || file.type === "text/plain") {
      setFin((s) => ({ ...s, file: { name: file.name, type: "TXT", status: "extracting", chars: 0 } }));
      const r = new FileReader();
      r.onload = () => { const txt = String(r.result || ""); setFin((s) => ({ ...s, text: (s.text ? s.text + "\n" : "") + txt, file: { name: file.name, type: "TXT", status: "done", chars: txt.length } })); analyzeText((fin.text ? fin.text + "\n" : "") + txt, true); showToast(`텍스트 ${txt.length.toLocaleString()}자를 불러와 분석했습니다.`); };
      r.onerror = () => { setFin((s) => ({ ...s, file: { name: file.name, type: "TXT", status: "failed", chars: 0 } })); showToast("텍스트 파일을 읽지 못했습니다."); };
      r.readAsText(file); return;
    }
    if (nm.endsWith(".pdf") || file.type === "application/pdf") {
      // 새 파일 첨부 시작 → 이전 원문/분석 결과/레이아웃을 완전히 초기화(이전 파일·샘플 잔재 제거). 출처는 유지.
      const fileId = `${file.name}|${file.size}|${file.lastModified}`;
      setFin((s) => ({ ...s, text: "", parsed: null, apply: {}, layout: null, preview: null, parsedFileId: null, currentFileId: fileId, file: { name: file.name, type: "PDF", status: "extracting", chars: 0 } }));
      try {
        const layout = await extractPdfLayout(file);          // 좌표 기반 추출(행/열 복원)
        const disp = (layout.layoutText || layout.rawText || "").trim();
        if (disp.replace(/\s/g, "").length < 15) { setFin((s) => ({ ...s, layout, currentFileId: fileId, file: { name: file.name, type: "PDF", status: "empty", chars: disp.length, pages: layout.numPages } })); showToast("이 PDF에서는 텍스트를 읽지 못했습니다. 스캔 이미지 PDF이거나 PDF 구조가 텍스트 추출을 지원하지 않을 수 있습니다. 표 부분을 복사해 붙여넣어 주세요."); return; }
        const preview = buildFinPreview(disp);
        // 현재 파일 원문만 사용(append/merge 금지) + 분석 결과는 비워 새 파일 기준으로 다시 분석하게 함
        setFin((s) => ({ ...s, text: disp, layout, parsed: null, apply: {}, parsedFileId: null, currentFileId: fileId, preview, file: { name: file.name, type: "PDF", status: "done", chars: disp.length, pages: layout.numPages, fileId } }));
        showToast(`PDF에서 원문 텍스트 ${disp.length.toLocaleString()}자(${layout.numPages}페이지)를 추출했습니다(확인용). 자동 분석은 실행하지 않았습니다. 표 부분을 위 붙여넣기 칸에 복사해주세요.`);
      } catch (err) { if (typeof console !== "undefined") console.error("[pdf] 추출 오류", err); setFin((s) => ({ ...s, currentFileId: fileId, file: { name: file.name, type: "PDF", status: "failed", chars: 0, err: String((err && err.message) || err) } })); showToast("PDF 텍스트 추출에 실패했습니다. 스캔 이미지 PDF이거나 PDF 구조가 텍스트 추출을 지원하지 않을 수 있습니다. 표 부분을 복사해 붙여넣어 주세요."); }
      return;
    }
    if (isImg) { setFin((s) => ({ ...s, file: { name: file.name, type: "이미지", status: "failed", chars: 0 } })); showToast("PDF 파일만 분석 대상입니다. 크레탑 PDF 파일을 선택해주세요. (이미지·스크린샷은 텍스트로 복사해 붙여넣어 주세요)"); return; }
    setFin((s) => ({ ...s, file: { name: file.name, type: "기타", status: "failed", chars: 0 } })); showToast("PDF 파일만 분석 대상입니다. 크레탑 PDF 파일을 선택해주세요.");
  };
  const finSummary = fin.parsed ? buildFinancialSummary(fin.parsed, fin.source) : null;
  const pool = mode === "edit" ? [] : [...(dest !== "company" ? (data.leads || []) : []), ...(dest !== "lead" ? (data.companies || []) : [])];
  const dupName = mode !== "edit" && f.name.trim() && pool.some((x) => x.name === f.name.trim());
  const save = () => { if (!f.name.trim()) { showToast("업체명을 입력해주세요."); return; } let extra = {}; if (fin.parsed) { const sum = buildFinancialSummary(fin.parsed, fin.source); extra = { financialExtracted: fin.parsed.items.map((it) => ({ key: it.key, label: it.label, display: it.display, confidence: it.confidence })), financialStructured: fin.parsed.structured || null, financialNumbers: fin.parsed.numbers, financialSummary: sum, financialWarnings: [sum.warning], financialSourceType: fin.source, financialAnalyzedAt: todayISO(), financialRawText: fin.saveRaw ? fin.text.slice(0, 20000) : "", financialRawTruncated: fin.saveRaw && fin.text.length > 20000 }; } const rec = { ...f, ...extra, name: f.name.trim(), interests: deriveInterests(f), source: "manual", sample: false }; onSave(rec, dest); };
  const lab = (t) => <div style={{ fontSize: "calc(var(--s,1.3)*17px)", fontWeight: 900, color: C.gold, margin: "6px 0 10px" }}>{t}</div>;
  return <Modal open={open} onClose={onClose} title={mode === "edit" ? "고객 정보 수정" : "+ 고객 등록"} width={760}>
    <div style={{ display: "grid", gap: 16, gridTemplateColumns: "minmax(0,1fr)" }}>{/* [D-94] 좁은 화면에서 칸이 창보다 넓어지지 않게 */}
      <Card style={{ padding: 14, background: C.bg }}><Label>① 메모 붙여넣기 (선택) — 받아온 텍스트로 자동 채우기</Label><textarea style={{ ...inp, height: 80, resize: "vertical" }} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="예: 제조업, 매출 35억, 직원 12명, 대표 58세, 자녀 근무, 연구소 없음, 가지급금 있음, 정관 미점검" /><button style={{ ...btnS, marginTop: 8 }} onClick={autofill}>🪄 메모에서 자동 채우기</button></Card>
      <Card style={{ padding: 0, background: C.blueBg, border: `2px solid ${C.blue}55`, overflow: "hidden" }}>
        <button onClick={() => setFin((s) => ({ ...s, open: !s.open }))} aria-expanded={fin.open} style={{ width: "100%", textAlign: "left", display: "block", background: "transparent", border: "none", cursor: "pointer", fontFamily: FF, padding: "16px 18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}><span style={{ fontSize: "calc(var(--s,1.3)*22px)" }}>📊</span><span style={{ color: C.blue, fontWeight: 900, fontSize: "calc(var(--s,1.3)*19px)" }}>크레탑 표 텍스트 분석</span><Badge color={C.gold} bg="#FCEFDA">추천</Badge></div>
            <span style={{ color: C.blue, fontWeight: 800, fontSize: "calc(var(--s,1.3)*14px)" }}>{fin.open ? "▲ 접기" : "▼ 펼쳐서 시작"}</span>
          </div>
          <div style={{ color: C.textS, fontSize: "calc(var(--s,1.3)*14px)", marginTop: 6, lineHeight: 1.6 }}><b style={{ color: C.text }}>크레탑 PDF를 올려 원문을 추출하고, 바로 핵심지표 점검으로 보냅니다.</b></div>
        </button>
        {fin.open && <div style={{ padding: "0 18px 18px", display: "grid", gap: 10 }}>
          <div style={{ background: "#FFFCF5", border: `1px solid ${C.gold}55`, borderRadius: 10, padding: "10px 12px", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}><button style={btnP} onClick={() => setCoreOpen(true)}>🔢 크레탑 핵심지표 점검</button>{f.cretopCore && <Badge color={C.ok} bg={C.greenBg}>핵심지표 저장됨</Badge>}<span style={{ color: C.textS, fontSize: "calc(var(--s,1.3)*12px)", flex: 1, minWidth: 160, lineHeight: 1.5 }}>크레탑 원문에서 1차 미팅용 핵심 재무·신용 지표 후보를 뽑아 확인 후 저장합니다.</span></div>
          <CretopCoreCheck open={coreOpen} initialRaw={fin.text || ""} existingCore={f.cretopCore} fileName={f.name || (fin.file && fin.file.name)} onSave={(c) => upd("cretopCore", c)} applyLabel="이 분석 결과로 고객 입력칸 채우기" onApplyToCustomer={(patch) => { setF((cur) => { const stage = (!cur.stage || cur.stage === "lead") ? "contacted" : cur.stage; const memo = cur.memo ? cur.memo + "\n\n" + patch.memo : patch.memo; return { ...cur, ...patch, stage, memo }; }); showToast("고객 정보에 반영했습니다. 저장 전 값을 확인해주세요."); }} onClose={() => setCoreOpen(false)} />
          <details style={{ background: C.warnBg, border: `1px solid ${C.warn}40`, borderRadius: 10, padding: "10px 12px" }}>
            <summary style={{ cursor: "pointer", color: C.textS, fontSize: "calc(var(--s,1.3)*13px)", fontWeight: 700, lineHeight: 1.5 }}>⚠️ 재무자료는 자동 추출값이 틀릴 수 있습니다 — 사용 전 꼭 확인 (자세히 보기)</summary>
            <div style={{ marginTop: 8, color: C.textS, fontSize: "calc(var(--s,1.3)*13px)", lineHeight: 1.7 }}>
              <div>• 크레탑 PDF는 표 구조와 단위가 섞여 있어 자동 추출값이 틀릴 수 있습니다.</div>
              <div>• 매출액·이익·자산·부채·비율은 반드시 <b>원문 기준연도와 단위</b>를 확인해주세요.</div>
              <div>• 정식 제안 전에는 <b>세무사 또는 담당 전문가 검토</b>가 필요합니다.</div>
            </div>
          </details>
          {/* 표 텍스트 분석(보조)·숫자 추출기(BETA) 보조 탭 제거 — PDF 추출 → 핵심지표 점검 단일 흐름으로 단순화(내부 유틸 함수는 유지) */}
          {fin.finTab === "paste" && <div style={{ display: "grid", gap: 10 }}>
          <p style={{ margin: 0, color: C.textM, fontSize: "calc(var(--s,1.3)*13px)", lineHeight: 1.65 }}>아래 3개 표(요약 손익계산서 · 요약 재무상태표 · 재무비율/재무구조)를 크레탑 보고서에서 복사해 붙여넣으면 1차 미팅 전 핵심 재무지표를 정리합니다. 모든 값은 ‘추출 후보’이며 단위·기준연도 확인 후 적용해주세요.</p>
          <div style={{ background: C.warnBg, border: `1px solid ${C.warn}40`, borderRadius: 8, padding: "8px 10px", color: C.textS, fontSize: "calc(var(--s,1.3)*12px)", lineHeight: 1.6 }}>크레탑 표는 보통 <b>오른쪽으로 갈수록 최신연도</b>입니다. 연도 행이 없으면 오른쪽 끝 값을 최신 후보로 표시합니다. 단위(백만원/천원)와 기준연도를 꼭 확인해주세요. 1,000억원 이상 값은 단위 오류 가능성을 우선 점검합니다(자동 적용 제외).</div>
          <div><Label>자료 출처</Label><select style={inp} value={fin.source} onChange={(e) => setFin((s) => ({ ...s, source: e.target.value }))}>{FIN_SOURCES.map((x) => <option key={x} value={x}>{FIN_SOURCE_LABEL[x] || x}</option>)}</select></div>
          {[["① 요약 손익계산서 붙여넣기", "pasteIs", "매출액 1,250 1,860 2,430\n영업이익 80 140 210\n당기순이익 55 100 160\n구분 2021 2022 2023", false], ["② 요약 재무상태표 붙여넣기", "pasteBs", "자산총계 900 1,150 1,420\n부채총계 520 610 720\n자본총계 380 540 700\n구분 2021 2022 2023", false], ["③ 재무비율 / 재무구조 붙여넣기", "pasteRatio", "부채비율 136.8 113.0 102.9\n유동비율 145.2 168.4 191.7\n이자보상배수 8.5 12.3 18.6\n구분 2021 2022 2023", false], ["④ 상세 재무상태표 / 손익계산서 붙여넣기", "pasteMy", "재무상태표 단위:천원\n자산총계 900,000 1,150,000 1,420,000\n미처분이익잉여금 250,000 380,000 520,000", true]].map(([labl, key, ex, opt]) => <div key={key}>
            <Label>{labl}{opt ? " · 선택사항" : ""}</Label>
            <textarea style={{ ...inp, height: 68, resize: "vertical", fontFamily: "ui-monospace, Menlo, monospace", fontSize: "calc(var(--s,1.3)*13px)" }} value={fin[key]} onChange={(e) => setFin((s) => ({ ...s, [key]: e.target.value }))} placeholder={`예시 (계정명 + 연도별 숫자 한 줄):\n${ex}`} />
            <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*11px)", marginTop: 3, lineHeight: 1.55 }}>입력 예시 — {ex.split("\n").join(" · ")}</div>
          </div>)}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button style={btnS} onClick={fillSampleTables}>🧪 가상 크레탑 샘플 넣기</button>
            <button style={btnP} onClick={finPasteAnalyze}>🔍 크레탑 표 분석 시작</button>
            <button style={btnS} onClick={() => { setFin((s) => ({ ...s, pasteIs: "", pasteBs: "", pasteRatio: "", pasteMy: "", text: "", parsed: null, apply: {}, file: null, currentFileId: null, parsedFileId: null, preview: null })); showToast("입력값을 초기화했습니다."); }}>↺ 입력값 초기화</button>
            <button style={{ ...btnS, color: C.textM }} onClick={() => { setFin((s) => ({ ...FIN_INIT, open: s.open, source: s.source })); try { scrubLocalStorageOnce(); } catch (e) {} showToast("이전 재무자료 임시 저장값을 삭제했습니다."); }}>🧹 이전 재무자료 캐시 삭제</button>
          </div>
          <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*11px)" }}>재무자료 분석 모듈: {FIN_MODULE_VERSION}</div>
          {fin.parsed && (!fin.currentFileId || fin.parsedFileId === fin.currentFileId) && <div style={{ border: `1px solid ${C.bdr}`, borderRadius: 12, padding: 12, background: C.card, maxWidth: "100%", overflowX: "hidden", boxSizing: "border-box" }}>
            <CoreMetricsCard final={fin.parsed.finalCore} />
            {(() => {
              const items = fin.parsed.items || [];
              const fb = fin.parsed.fallback || { keywords: [], numbers: [], dates: [] };
              const isUnit = (it) => /단위 확인|단위 불명확/.test(((it.display || "") + " " + (it.note || "")));
              const g = { apply: [], unit: [], ref: [], bad: [] };
              items.forEach((it) => { if (it.bad || it.confidence === "오류 의심") g.bad.push(it); else if (it.confidence === "낮음") g.ref.push(it); else if (isUnit(it)) g.unit.push(it); else g.apply.push(it); });
              const row = (it) => <label key={it.key} style={{ display: "flex", gap: 8, alignItems: "flex-start", padding: "8px 10px", background: C.bg, borderRadius: 9, cursor: it.apply ? "pointer" : "default" }}>
                <input type="checkbox" checked={!!fin.apply[it.key]} disabled={!it.apply} onChange={(e) => setFin((s) => ({ ...s, apply: { ...s.apply, [it.key]: e.target.checked } }))} style={{ marginTop: 4 }} />
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}><b style={{ fontSize: "calc(var(--s,1.3)*14px)" }}>{it.label}</b><FinConfBadge c={it.confidence} />{!it.apply && <span style={{ color: C.textM, fontSize: 12 }}>참고용</span>}</div><div style={{ color: C.textS, fontSize: "calc(var(--s,1.3)*14px)", marginTop: 2, wordBreak: "break-all" }}>{it.display}</div>{it.note && <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*12px)", marginTop: 2 }}>· {it.note}</div>}</div>
              </label>;
              const section = (title, color, list) => list.length ? <div style={{ marginBottom: 8 }}><div style={{ fontWeight: 800, color, fontSize: "calc(var(--s,1.3)*13px)", margin: "6px 0 4px" }}>{title} ({list.length})</div><div style={{ display: "grid", gap: 6 }}>{list.map(row)}</div></div> : null;
              const hasFb = (fb.keywords || []).length || (fb.numbers || []).length || (fb.dates || []).length;
              return <>
                <div style={{ background: C.blueBg, border: `1px solid ${C.blue}40`, borderRadius: 8, padding: "8px 10px", color: C.textS, fontSize: "calc(var(--s,1.3)*13px)", marginBottom: 10, lineHeight: 1.6 }}>추출 후보 <b>{items.length}</b>건 — 적용 가능 <b style={{ color: C.ok }}>{g.apply.length}</b> · 단위 확인 필요 <b style={{ color: C.warn }}>{g.unit.length}</b> · 참고 <b style={{ color: C.textM }}>{g.ref.length}</b> · 오류 의심/자동 제외 <b style={{ color: C.err }}>{g.bad.length}</b>. 숫자 단위·계정명을 확인한 뒤 적용해주세요. (모두 ‘추출 후보’입니다){fin.parsed.gu ? ` · 원문 표 단위: ${fin.parsed.gu}` : ""}</div>
                {(() => { const cr = fin.parsed.cretop; if (!cr || !cr.years || cr.years.length < 1 || !Object.keys(cr.yearTable || {}).length) return null; const yrs = cr.years; const rowKeys = ["매출액", "영업이익", "당기순이익", "자산총계", "부채총계", "자본총계"]; const td = { padding: "5px 8px", borderBottom: `1px solid ${C.bdr}`, fontSize: "calc(var(--s,1.3)*13px)", textAlign: "right", whiteSpace: "nowrap" }; return <div style={{ border: `1px solid ${C.blue}40`, borderRadius: 10, padding: 12, marginBottom: 10, background: "#fff" }}>
                  <div style={{ fontWeight: 900, color: C.blue, fontSize: "calc(var(--s,1.3)*14px)", marginBottom: 2 }}>📊 연도별 재무 요약 (억원 환산)</div>
                  <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*12px)", marginBottom: 8 }}>재무 기준연도 <b style={{ color: C.text }}>{cr.baseYear || "-"}</b>{cr.queryDate ? ` · 조회일시 ${cr.queryDate}` : ""} · 최근 재무자료가 최신 신고연도와 다를 수 있어 확인이 필요합니다.</div>
                  <div style={{ overflowX: "auto" }}><table style={{ borderCollapse: "collapse", width: "100%", minWidth: 320 }}><thead><tr><th style={{ ...td, textAlign: "left", color: C.textM, fontWeight: 700 }}>계정</th>{yrs.map((y) => <th key={y} style={{ ...td, color: y === cr.baseYear ? C.blue : C.textM, fontWeight: 800 }}>{y}</th>)}</tr></thead>
                  <tbody>{rowKeys.filter((k) => cr.yearTable[k]).map((k) => <tr key={k}><td style={{ ...td, textAlign: "left", fontWeight: 700 }}>{k}</td>{yrs.map((y) => <td key={y} style={td}>{(cr.yearTable[k][y] || "-").replace("약 ", "")}</td>)}</tr>)}
                    {Object.keys(cr.ratioTable || {}).map((k) => { const r = cr.ratioTable[k]; return <tr key={k}><td style={{ ...td, textAlign: "left", fontWeight: 700 }}>{k}</td>{yrs.map((y) => <td key={y} style={td}>{r.year === y ? r.value : "-"}</td>)}</tr>; })}
                  </tbody></table></div>
                  <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*12px)", marginTop: 6 }}>· 값이 없는 연도는 “-”로 표시되며, 추정하지 않습니다. 비율은 금액이 아닌 %/배로 표기합니다.</div>
                </div>; })()}
                {section("✅ 추출 결과 — 확인 후 적용 (체크 항목만 폼에 반영)", C.ok, g.apply)}
                {section("📐 단위 확인 필요 항목 (원문에 단위가 명확치 않음)", C.warn, g.unit)}
                {section("📎 참고 항목 (키워드·낮은 신뢰도)", C.textM, g.ref)}
                {g.bad.length ? <div style={{ marginBottom: 8, border: `1px solid ${C.err}40`, borderRadius: 9, padding: "8px 10px", background: C.redBg }}>
                  <div style={{ fontWeight: 800, color: C.err, fontSize: "calc(var(--s,1.3)*13px)", margin: "2px 0 6px" }}>🚫 오류 의심 / 자동 적용 제외 ({g.bad.length}) — 고객 폼에 자동 반영되지 않습니다</div>
                  {g.bad.map((it) => <div key={it.key} style={{ padding: "6px 8px", background: "#fff", borderRadius: 8, marginBottom: 5, fontSize: "calc(var(--s,1.3)*13px)", color: C.textS, lineHeight: 1.6 }}>
                    <b>{it.label}</b> · 파싱값 {it.bad ? it.bad.parsed || "" : ""} <span style={{ color: C.textM }}>{it.display}</span>
                    <div style={{ color: C.err, marginTop: 2 }}>제외 이유: {it.bad ? it.bad.reason : it.note}</div>
                    {it.bad && (it.bad.candidates || []).length ? <div style={{ color: C.textM, marginTop: 1 }}>원문 후보: {it.bad.candidates.join(" / ")}</div> : null}
                    <div style={{ color: C.textM, marginTop: 1 }}>확인 필요: 원문 표의 단위/연도/계정명을 확인해주세요.</div>
                  </div>)}
                </div> : null}
                {items.length === 0 && <div style={{ background: C.warnBg, border: `1px solid ${C.warn}40`, borderRadius: 8, padding: "10px 12px", color: C.textS, fontSize: "calc(var(--s,1.3)*13px)", lineHeight: 1.6, marginBottom: 8 }}>텍스트는 추출됐지만 명확한 ‘계정-금액’ 구조를 찾지 못했습니다. 아래 후보를 참고해, 재무요약 표 부분이 포함되어 있는지 확인해주세요.</div>}
                {hasFb ? <div style={{ background: C.bg, border: `1px dashed ${C.bdr}`, borderRadius: 9, padding: "10px 12px", fontSize: "calc(var(--s,1.3)*13px)", color: C.textS, lineHeight: 1.7 }}>
                  <div style={{ fontWeight: 800, color: C.textM, marginBottom: 4 }}>🔎 원문에서 발견한 후보</div>
                  {(fb.keywords || []).length ? <div>· 발견된 키워드: {fb.keywords.join(", ")}</div> : null}
                  {(fb.numbers || []).length ? <div>· 발견된 숫자 후보: {fb.numbers.join(" / ")}</div> : null}
                  {(fb.dates || []).length ? <div>· 발견된 날짜 후보: {fb.dates.join(" / ")}</div> : null}
                  {(fb.keywords || []).length >= 2 ? <div style={{ color: C.textM, marginTop: 4 }}>재무요약 표가 포함된 것으로 보입니다. 표 부분을 복사해 붙여넣으면 인식률이 높아집니다.</div> : null}
                </div> : null}
                {(() => { const fc = fin.parsed.finalCore || { metrics: {}, detectedYears: [], warnings: [] }; const dbg = fin.parsed.debug; const coreLines = CORE_ORDER.map((k) => { const m = fc.metrics[k]; if (!m) return `· ${CORE_LABEL_KR[k]}: 추출 실패`; return `· ${CORE_LABEL_KR[k]}: row="${m.rowText}" | years=[${(fc.detectedYears || []).join(", ")}] | latestYear=${m.year} | latestIndex=${m.latestIndex} | values=[${(m.values || []).join(", ")}] | selectedValue=${m.rawValue} | ${m.display}${m.unit ? " (" + m.unit + ")" : ""} | ${m.source || ""}`; }).join("\n"); const dbgText = `[크레탑 핵심지표 디버그] 모듈 ${FIN_MODULE_VERSION}\ncurrentFileId: ${fin.currentFileId || "(없음)"}\nparsedFileId: ${fin.parsedFileId || "(없음)"}\nselectedFileName: ${(fin.file && fin.file.name) || "(없음)"}\n감지 기업명: ${(fin.preview && fin.preview.companyName) || "-"} · 사업자번호: ${(fin.preview && fin.preview.businessNo) || "-"}\n감지 연도: ${(fc.detectedYears || []).join(", ") || "(없음)"} | latestYear=${fc.latestYear}\n${dbg ? `페이지 ${dbg.pages} · 추출 ${dbg.chars}자 · 섹션 ${dbg.sections.join(", ") || "-"} · 단위 ${dbg.units.join(", ") || "-"}` : `텍스트 입력 ${(fin.text || "").length}자`}\n${(fc.warnings || []).length ? "경고: " + fc.warnings.join(" / ") + "\n" : ""}\n[연도-index-value 매칭]\n${coreLines}\n\n[원문 첫 1000자]\n${(fin.text || "").slice(0, 1000)}`; return <div style={{ marginTop: 8, background: "#0F172A08", border: `1px solid ${C.bdr}`, borderRadius: 9, padding: "10px 12px", fontSize: "calc(var(--s,1.3)*12px)", color: C.textS, lineHeight: 1.6 }}>
                  <details><summary style={{ fontWeight: 800, color: C.textM, cursor: "pointer" }}>🛠 디버그 — 연도-index-value 매칭 (복사용)</summary>
                  <div style={{ marginTop: 6 }}>· 감지 연도 <b>{(fc.detectedYears || []).join(", ") || "(없음)"}</b> · latestYear <b>{fc.latestYear != null ? fc.latestYear : "-"}</b>{dbg ? ` · 페이지 ${dbg.pages} · 섹션 ${dbg.sections.join(", ") || "(없음)"} · 단위 ${dbg.units.join(", ") || "(없음)"}` : ` · 텍스트 ${(fin.text || "").length}자`}</div>
                  <div style={{ marginTop: 4, whiteSpace: "pre-wrap", maxHeight: 200, overflow: "auto", background: "#fff", border: `1px solid ${C.bdr}`, borderRadius: 6, padding: 8, fontSize: "calc(var(--s,1.3)*11px)" }}>{coreLines}</div>
                  </details>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                    <button style={btnSm} onClick={() => copyText(dbgText, () => showToast("디버그 정보를 복사했습니다."))}>디버그 정보 복사</button>
                    <button style={btnSm} onClick={() => setFin((s) => ({ ...s, showRaw: !s.showRaw }))}>{fin.showRaw ? "원문 닫기" : "원문 보기"}</button>
                  </div>
                </div>; })()}
              </>;
            })()}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
              <button style={btnP} onClick={() => finApplyItems(false)}>선택 항목 적용</button>
              <button style={btnS} onClick={() => finApplyItems(true)}>전체 적용</button>
              <button style={btnS} onClick={() => setFin((s) => ({ ...s, parsed: null, apply: {} }))}>초기화</button>
              <button style={btnS} onClick={() => setFin((s) => ({ ...s, showRaw: !s.showRaw }))}>{fin.showRaw ? "원문 닫기" : "원문 보기"}</button>
            </div>
            {fin.showRaw && <pre style={{ marginTop: 8, padding: 10, background: C.bg, border: `1px solid ${C.bdr}`, borderRadius: 8, fontSize: 12, color: C.textM, whiteSpace: "pre-wrap", maxHeight: 160, overflow: "auto" }}>{fin.text}</pre>}
            <label style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 10, color: C.textM, fontSize: "calc(var(--s,1.3)*13px)" }}><input type="checkbox" checked={fin.saveRaw} onChange={(e) => setFin((s) => ({ ...s, saveRaw: e.target.checked }))} />원문 텍스트도 함께 저장(최대 20,000자){fin.text.length > 20000 ? " · 원문이 길어 일부만 저장됩니다" : ""}</label>
            <div style={{ marginTop: 12, borderTop: `1px solid ${C.bdr}`, paddingTop: 10 }}><div style={{ fontWeight: 900, color: C.gold, fontSize: "calc(var(--s,1.3)*15px)", marginBottom: 4 }}>🧾 1차 재무 검토 요약</div><FinancialAnalysis summary={finSummary} name={f.name || "고객"} raw={fin.saveRaw ? fin.text.slice(0, 20000) : ""} /></div>
          </div>}
          </div>}
          {fin.finTab === "extract" && <div style={{ display: "grid", gap: 12 }}>
            <div style={{ background: C.blueBg, border: `1px solid ${C.blue}40`, borderRadius: 10, padding: "12px 14px", color: C.textS, fontSize: "calc(var(--s,1.3)*13px)", lineHeight: 1.6 }}><b style={{ color: C.blue }}>⭐ 크레탑 숫자 추출기</b> — 실제 크레탑 PDF처럼 줄/열이 깨진 원문에서도 계정명 주변 숫자를 후보로 모아 <b>검수용 표</b>로 정리합니다. 좁은 모달 대신 <b>넓은 전용 화면</b>에서 원문 확인 → 후보 추출 → 검수 → 미리보기 순서로 작업하세요. 추출값은 ‘추출 후보’이며 고객 정보에 자동 반영되지 않습니다.</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button style={{ ...btnP, fontSize: "calc(var(--s,1.3)*15px)", padding: "12px 18px" }} onClick={() => setFin((s) => ({ ...s, screenOpen: true, screenRaw: s.extractInput || s.text || "" }))}>🔢 크레탑 숫자 추출기 크게 열기</button>
              <button style={btnS} onClick={() => setFin((s) => ({ ...s, screenOpen: true, screenRaw: CRETOP_EXTRACT_SAMPLE }))}>🧪 가상 샘플로 크게 열기</button>
            </div>
            <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*12px)", lineHeight: 1.6 }}>· PDF는 ‘PDF 텍스트 추출만 시도’ 탭에서 원문을 추출한 뒤, 그 탭의 ‘숫자 추출기로 보내기’를 누르면 추출 원문이 전용 화면으로 전달됩니다.<br />· 전용 화면에서 ‘표 텍스트 분석으로 보내기’를 누르면 선택한 숫자가 ‘표 텍스트 붙여넣기 분석’ 탭으로 들어갑니다.</div>
          </div>}
          {fin.finTab === "pdf" && <div style={{ display: "grid", gap: 10 }}>
            <div style={{ padding: "0 0 10px", display: "grid", gap: 8 }}>
              <div style={{ color: C.textS, fontSize: "calc(var(--s,1.3)*12px)", lineHeight: 1.6 }}>크레탑 PDF를 올리면 원문 텍스트를 추출합니다. 추출 후 <b>‘핵심지표 점검’</b>으로 보내 후보를 확인하세요.</div>
              <label style={{ ...btnP, display: "inline-flex", alignItems: "center", cursor: "pointer", alignSelf: "flex-start" }}>📎 PDF 파일 선택 (휴대폰 파일 앱/드라이브)<input type="file" accept=".pdf,application/pdf,application/x-pdf" onChange={finFile} style={{ display: "none" }} /></label>
              {fin.file && (() => { const st = fin.file.status; const STAT = { extracting: ["⏳ PDF 텍스트 추출 중…", C.blue], done: ["✅ 추출 완료(확인용)", C.ok], failed: ["⚠️ 추출 실패", C.err], empty: ["⚠️ 텍스트를 읽지 못함(스캔 PDF 가능성)", C.err], image: ["🖼️ 이미지 OCR 미지원", C.warn] }; const s = STAT[st] || ["대기", C.textM]; return <div style={{ background: "#fff", border: `1px solid ${C.bdr}`, borderRadius: 10, padding: "10px 12px", fontSize: "calc(var(--s,1.3)*13px)", color: C.textS, lineHeight: 1.6 }}>
                <div>선택 파일: <b>{fin.file.name}</b> · 형식 {fin.file.type}{fin.file.pages ? ` · ${fin.file.pages}페이지` : ""}</div>
                <div style={{ color: s[1], fontWeight: 800, marginTop: 2 }}>{s[0]}{st === "done" ? ` · 텍스트 ${(fin.file.chars || 0).toLocaleString()}자 추출` : ""}{st === "failed" && fin.file.err ? ` · ${fin.file.err}` : ""}</div>
                {st === "done" && <div style={{ color: C.textM, marginTop: 2 }}>자동 분석은 실행하지 않았습니다. 아래 원문에서 표 부분(계정명 + 연도별 숫자)을 복사해 위 붙여넣기 칸에 넣은 뒤 ‘크레탑 표 분석 시작’을 눌러주세요.</div>}
                {st === "empty" && <div style={{ color: C.textM, marginTop: 2 }}>PDF가 이미지로만 구성된 경우 텍스트 추출이 되지 않을 수 있습니다. 표 부분을 직접 복사해 위 붙여넣기 칸에 넣어주세요.</div>}
                {st === "image" && <div style={{ color: C.textM, marginTop: 2 }}>스크린샷의 내용을 텍스트로 복사해 위 붙여넣기 칸에 넣어주세요. OCR 기능은 추후 고도화 예정입니다.</div>}
                {st === "failed" && <div style={{ color: C.textM, marginTop: 2 }}>텍스트가 포함된 PDF인지 확인하거나, 표 부분을 복사해 위 붙여넣기 칸에 넣어주세요.</div>}
              </div>; })()}
              {fin.preview && <div style={{ color: C.textS, fontSize: "calc(var(--s,1.3)*12px)" }}>· 기업명 후보: <b>{fin.preview.companyName || "(미감지)"}</b>{fin.preview.businessNo ? ` · 사업자번호: ${fin.preview.businessNo}` : ""}{fin.preview.ceoName ? ` · 대표자: ${fin.preview.ceoName}` : ""}</div>}
              {fin.text && fin.file ? <div style={{ display: "grid", justifyItems: "center", gap: 4, padding: "4px 0" }}>
                <button style={{ background: C.purple, color: "#fff", border: "none", borderRadius: 12, height: 50, padding: "0 22px", fontWeight: 900, fontSize: "calc(var(--s,1.3)*16px)", cursor: "pointer", width: "100%", maxWidth: 440, boxShadow: `0 6px 18px ${C.purple}44` }} onClick={() => setCoreOpen(true)}>➡️ 추출한 원문으로 핵심지표 점검하기</button>
                <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*12px)", textAlign: "center" }}>PDF 원문을 기준으로 핵심 재무지표 후보를 확인합니다.</div>
              </div> : null}
              {fin.text && fin.file ? <details style={{ border: `1px solid ${C.bdr}`, borderRadius: 8, padding: "6px 10px" }}>
                <summary style={{ cursor: "pointer", color: C.textM, fontSize: "calc(var(--s,1.3)*11px)", fontWeight: 700 }}>관리자용 / 디버그 도구 (추출 원문·숫자 추출기)</summary>
                <div style={{ marginTop: 6, display: "grid", gap: 6 }}>
                  <textarea readOnly style={{ ...inp, height: 120, resize: "vertical", fontFamily: "ui-monospace, Menlo, monospace", fontSize: "calc(var(--s,1.3)*12px)", background: "#fff" }} value={fin.text} />
                </div>
              </details> : null}
            </div>
          </div>}
        </div>}
      </Card>
      {/* 숫자 추출기(보조) 전용 화면 제거 — 내부 컴포넌트는 유지하되 화면에서는 노출하지 않음 */}
      <div>{lab("② 기본정보")}<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{ gridColumn: "1 / -1" }}>{/* [D-94] 업체 고르기는 한 줄 전체 — 좁은 폭에서 이름표가 세 줄로 찌그러지던 것 */}<Label>업체명 * <span style={{ fontWeight: 600, color: C.textM }}>(고객 운영 업체에서 고르기)</span></Label>{mode === "edit" ? <input style={{ ...inp, background: C.bg }} value={f.name} readOnly /> : <select style={inp} data-testid="sales-client-pick" value={f.osId || ""} onChange={(e) => { const os = salesOsClientOf(e.target.value); if (!os) { setF((p) => ({ ...p, osId: "", name: "" })); return; } setF((p) => osToCust(os, p)); }}><option value="">업체 고르기</option>{salesOsClients().map((c) => <option key={c.id} value={c.id}>{c.companyName}</option>)}</select>}{mode !== "edit" && salesOsClients().length === 0 ? <div style={{ color: C.warn, fontSize: "calc(var(--s,1.3)*14px)", marginTop: 4 }}>고객 운영에 업체가 없습니다. 먼저 <a href="/ops/clients" style={{ color: C.blue, fontWeight: 800 }}>고객 운영</a>에 업체를 등록하세요.</div> : null}{dupName && <div style={{ color: C.warn, fontSize: "calc(var(--s,1.3)*14px)", marginTop: 4 }}>같은 이름의 고객이 이미 있습니다. 저장하면 기존 고객을 수정합니다.</div>}</div>
        <div><Label>업종</Label><select style={inp} value={f.industry} onChange={(e) => upd("industry", e.target.value)}>{INDUSTRIES.map((x) => <option key={x}>{x}</option>)}</select></div>
        <div><Label>대표자명</Label><input style={inp} value={f.ceoName} onChange={(e) => upd("ceoName", e.target.value)} /></div>
        <div><Label>대표 나이</Label><input type="number" style={inp} value={f.ceoAge} onChange={(e) => upd("ceoAge", e.target.value)} /></div>
        <div><Label>직원 수</Label><input type="number" style={inp} value={f.empCount} onChange={(e) => upd("empCount", e.target.value)} /></div>
        <div><Label>연매출</Label><input type="number" style={inp} value={f.revenue} onChange={(e) => upd("revenue", e.target.value)} placeholder="예: 3500" /><div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*12px)", marginTop: 3 }}>백만원 단위로 입력하세요. (억 기준 ×100, 예: 35억 → 3500) 모르면 비워두어도 됩니다.</div></div>
        <div><Label>직전 연도 당기순이익</Label><input type="number" style={inp} value={f.netIncome} onChange={(e) => upd("netIncome", e.target.value)} placeholder="예: 10000" /><div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*12px)", marginTop: 3 }}>최근 결산 기준 순이익(만원)을 입력하세요. 모르면 비워두어도 됩니다. (1억원 → 10000)</div></div>
        <div><Label>업력 (년)</Label><input type="number" style={inp} value={f.estYears} onChange={(e) => upd("estYears", e.target.value)} /></div>
        <div><Label>미팅 단계</Label><select style={inp} value={f.stage} onChange={(e) => upd("stage", e.target.value)}>{DEAL_STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></div>
        <div style={{ gridColumn: "1/-1", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, background: C.bg, borderRadius: 10, padding: 12 }}>
          <div style={{ gridColumn: "1/-1", fontWeight: 800, color: C.gold, fontSize: "calc(var(--s,1.3)*15px)" }}>💼 예상 수임료·보험료 <span style={{ color: C.textM, fontWeight: 600, fontSize: "calc(var(--s,1.3)*12px)" }}>(내부 영업 관리용 · 확정 아님)</span></div>
          <div><Label>예상 수임료 (만원)</Label><input type="number" style={inp} value={f.expectedFee} onChange={(e) => upd("expectedFee", e.target.value)} placeholder="예) 200" /></div>
          <div><Label>예상 월납 보험료 (만원)</Label><input type="number" style={inp} value={f.expectedPremium || ""} onChange={(e) => upd("expectedPremium", e.target.value)} placeholder="예) 50" /></div>
          <div><Label>예상 수수료율 (%)</Label><input type="number" style={inp} value={f.premiumFeeRate || ""} onChange={(e) => upd("premiumFeeRate", e.target.value)} placeholder="예) 30" /></div>
          {(() => { const prem = Number(f.expectedPremium) || 0; const rate = Number(f.premiumFeeRate) || 0; const exp = prem > 0 && rate > 0 ? Math.round(prem * 12 * rate / 100) : null; return <div style={{ gridColumn: "1/-1", color: C.textM, fontSize: "calc(var(--s,1.3)*12px)", lineHeight: 1.6 }}>{exp != null ? <span><b style={{ color: C.textS }}>예상 보험 수입료(가정·검토용)</b>: 약 {exp.toLocaleString()}만원/년 <span style={{ color: C.textM }}>(월납 × 12 × 수수료율 가정)</span></span> : "월납 보험료·수수료율을 입력하면 예상 수입료(가정)를 참고용으로 보여드립니다."} 모두 예상값이며 확정 수익이 아닙니다. 보험 제안이 아니면 비워두어도 됩니다.</div>; })()}
        </div>
      </div></div>
      <div>{lab("②-1 DB 유입경로 · 연락처")}<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div><Label>DB 유입경로</Label><select style={inp} value={f.dbSource || ""} onChange={(e) => upd("dbSource", e.target.value)}><option value="">선택</option>{DB_SOURCES.map((x) => <option key={x}>{x}</option>)}</select></div>
        <div><Label>홈페이지 URL</Label><input style={inp} value={f.homepage || ""} onChange={(e) => upd("homepage", e.target.value)} placeholder="https://" /></div>
        <div><Label>소개자명</Label><input style={inp} value={f.referrer || ""} onChange={(e) => upd("referrer", e.target.value)} /></div>
        <div><Label>소개자 연락처</Label><input style={inp} value={f.referrerPhone || ""} onChange={(e) => upd("referrerPhone", e.target.value)} placeholder="010-" /></div>
        <div><Label>DB 받은 날짜</Label><input type="date" style={inp} value={f.dbDate || ""} onChange={(e) => upd("dbDate", e.target.value)} /></div>
        <div><Label>최초 연락일</Label><input type="date" style={inp} value={f.firstContactDate || ""} onChange={(e) => upd("firstContactDate", e.target.value)} /></div>
        <div><Label>대표자 휴대폰</Label><input style={inp} value={f.ceoPhone || ""} onChange={(e) => upd("ceoPhone", e.target.value)} placeholder="010-" /></div>
        <div><Label>담당자명</Label><input style={inp} value={f.managerName || ""} onChange={(e) => upd("managerName", e.target.value)} /></div>
        <div><Label>담당자 연락처</Label><input style={inp} value={f.managerPhone || ""} onChange={(e) => upd("managerPhone", e.target.value)} placeholder="010-" /></div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 6 }}><PillButton active={!!f.cretopChecked} onClick={() => upd("cretopChecked", !f.cretopChecked)}>{f.cretopChecked ? "✓ " : ""}크레탑 확인</PillButton><PillButton active={!!f.financialSecured} onClick={() => upd("financialSecured", !f.financialSecured)}>{f.financialSecured ? "✓ " : ""}재무자료 확보</PillButton></div>
      </div></div>
      {(() => { const issues = f.issues || []; const toggleIssue = (t) => setF((p) => { const cur = p.issues || []; return { ...p, issues: cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t] }; }); return <div>{lab("③ 주요 이슈 · 상담 이슈")}
        <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*13px)", marginBottom: 8, lineHeight: 1.6 }}>이 고객의 재무·세무·자금·노무·승계 관련 상담 이슈를 골라두면 제안 포인트와 컨설팅 상품 연결에 활용됩니다. (검색 필터와는 별개입니다)</div>
        {issues.length ? <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>{issues.map((t) => <button key={t} onClick={() => toggleIssue(t)} style={{ fontSize: "calc(var(--s,1.3)*12px)", fontFamily: FF, cursor: "pointer", border: `1px solid ${C.blue}`, background: C.blue, color: "#fff", borderRadius: 999, padding: "3px 10px", fontWeight: 700 }}>✓ {t} ✕</button>)}</div> : null}
        <div style={{ display: "grid", gap: 6 }}>{CUST_ISSUE_CATS.map(([cat, tags]) => { const on = openIssueCat === cat; const cnt = tags.filter((t) => issues.includes(t)).length; return <div key={cat} style={{ border: `1px solid ${C.bdr}`, borderRadius: 9, overflow: "hidden" }}>
          <button type="button" onClick={() => setOpenIssueCat(on ? "" : cat)} style={{ width: "100%", textAlign: "left", border: "none", background: on ? C.bg : "#fff", cursor: "pointer", padding: "9px 12px", fontFamily: FF, fontWeight: 800, fontSize: "calc(var(--s,1.3)*14px)", color: C.text, display: "flex", alignItems: "center", gap: 8 }}>{on ? "▾" : "▸"} {cat}{cnt ? <span style={{ background: C.blue, color: "#fff", borderRadius: 999, padding: "1px 8px", fontSize: "calc(var(--s,1.3)*11px)" }}>{cnt}</span> : null}</button>
          {on ? <div style={{ padding: "4px 12px 12px", display: "flex", gap: 5, flexWrap: "wrap" }}>{tags.map((t) => { const sel = issues.includes(t); return <button key={t} type="button" onClick={() => toggleIssue(t)} style={{ fontSize: "calc(var(--s,1.3)*12px)", fontFamily: FF, cursor: "pointer", borderRadius: 999, padding: "4px 11px", border: sel ? `1px solid ${C.blue}` : `1px solid ${C.bdr}`, background: sel ? C.blueBg : "#fff", color: sel ? C.blue : C.textS, fontWeight: sel ? 800 : 600 }}>{sel ? "✓ " : ""}{t}</button>; })}</div> : null}
        </div>; })}</div>
      </div>; })()}
      {CUST_SECTIONS.map((secName, si) => <div key={secName}>{lab(`${["④", "⑤", "⑥"][si]} ${secName}`)}<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{CUST_FLAGS.filter((fl) => fl[2] === secName).map((fl) => <PillButton key={fl[0]} active={!!f.flags?.[fl[0]]} onClick={() => toggleFlag(fl[0])}>{f.flags?.[fl[0]] ? "✓ " : ""}{fl[1]}</PillButton>)}</div></div>)}
      <div>{lab("⑦ 메모와 다음 액션")}<div style={{ display: "grid", gap: 10 }}>
        <div><Label>주요 고민</Label><input style={inp} value={f.concern} onChange={(e) => upd("concern", e.target.value)} placeholder="예: 이익잉여금 누적·승계 부담, 가지급금 정리 필요 등" /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}><div><Label>다음 액션</Label><select style={inp} value={f.nextAction} onChange={(e) => upd("nextAction", e.target.value)}>{NEXT_ACTIONS.map((x) => <option key={x}>{x}</option>)}</select></div><div><Label>다음 액션일</Label><input type="date" style={inp} value={f.nextDate || ""} onChange={(e) => upd("nextDate", e.target.value)} /></div></div>
        <div><Label>메모</Label><textarea style={{ ...inp, height: 70, resize: "vertical" }} value={f.memo} onChange={(e) => upd("memo", e.target.value)} /></div>
      </div></div>
      {mode !== "edit" && <div>{lab("⑦ 등록 위치")}<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{[["lead", "신규 고객 발굴 리드"], ["company", "고객사 관리 고객사"], ["both", "둘 다 등록"]].map((d) => <PillButton key={d[0]} active={dest === d[0]} onClick={() => setDest(d[0])}>{d[1]}</PillButton>)}</div></div>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap", position: "sticky", bottom: 0, background: C.card, paddingTop: 10 }}><button style={btnS} onClick={onClose}>취소</button><button style={btnP} onClick={save}>{mode === "edit" ? "수정 저장" : "고객 저장"}</button></div>
    </div>
  </Modal>;
}

export function emptyData() {
  return {
    profile: { name: "", title: "컨설턴트" },
    leads: [],
    companies: [],
    educationItems: [],
    lawUpdates: [],
    strategies: STRATEGY_LIBRARY,
    packages: DEFAULT_PACKAGES,
    contentIdeas: [],
    templates: [],
  };
}
// 업종 정규화 이름(중복 집계 방지용) — 공백·괄호·법인 표기 제거
function normName(n) { return String(n || "").replace(/\s+/g, "").replace(/주식회사|유한회사|\(주\)|\(유\)|㈜|\(|\)/g, "").toLowerCase(); }
// 전체 고객을 '중복 없이' 반환 — 고객발굴(leads)과 고객사(companies) 양쪽에 같은 업체가 있으면 1명으로 집계.
// 같은 정규화 업체명은 1건만(고객사 우선: 정보가 더 많은 쪽). KPI·다음 연락·성과 분석·파이프라인·고객 리포트 공용.
function getUniqueCustomers(data) {
  const out = [], seen = new Set();
  const all = [...((data && data.companies) || []), ...((data && data.leads) || [])];
  for (const x of all) {
    if (!x) continue;
    const nm = normName(x.name);
    const k = nm ? "n:" + nm : "id:" + (x.id || "");
    if (k !== "id:" && seen.has(k)) continue;
    seen.add(k); out.push(x);
  }
  return out;
}
// 샘플 고객 시드 — 20개 서로 다른 업체. 각 업체는 leads(고객발굴) 또는 companies(고객사) '한 곳에만' 존재(중복 집계 방지).
// 업종 구성: 제조 7 · 도소매 4 · 서비스 3 · IT/소프트웨어 2 · 건설 1 · 음식/숙박 1 · 병의원 1 · 운송 1 = 20. 병의원은 1곳만.
// 순서대로 n개를 골라 넣으므로(샘플 3개=앞 3개) 단계·제안상태가 고르게 섞이도록 배치.
function sampleSeedList() {
  const plus = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  return [
    { dest: "lead", name: "대성정밀", ceoName: "김성호", industry: "제조업", region: "경기 안산", revenue: 3500, empCount: 26, estYears: 18, ceoAge: 58, interests: ["가업승계", "미처분이익잉여금", "주식이동", "정관정비"], concern: "장남 승계 예정, 이익잉여금 누적으로 주식가치가 올라 상속·증여세 부담이 커지는 상황", stage: "meeting2_scheduled", proposalStatus: "제안 전", nextDate: plus(2), expectedFee: 1200, memo: "[현재상황] 대표 지분 100%, 장남 공장장 재직, 주식가치 평가 선행 필요. [추천전략] 가업승계 플랜·미처분이익잉여금 정리·정관정비. [다음액션] 2차 미팅서 주식가치 평가결과 공유 + 정비 우선순위 제시. [예상수임료] 1,000만~1,500만 원." },
    { dest: "lead", name: "한울유통", ceoName: "이정훈", industry: "도소매업", region: "서울 강서", revenue: 2000, empCount: 12, estYears: 13, ceoAge: 55, interests: ["가지급금", "정관정비", "임원퇴직금", "법인세"], concern: "대표 가지급금 누적 + 설립 후 정관 미정비로 임원보수·퇴직금 지급근거가 불명확", stage: "docs_requested", proposalStatus: "제안 전", nextDate: plus(1), expectedFee: 600, memo: "[현재상황] 대표 지분 100%, 가지급금 약 1.5억 추정. [추천전략] 가지급금 정리·정관정비·임원퇴직금 규정. [다음액션] 계정별원장·정관 수령 후 규모 정리 → 상환/배당/퇴직금 시나리오 검토(세무사 협업). [예상수임료] 400만~700만 원." },
    { dest: "company", name: "삼정기계", corpType: "주식회사", juPosition: "뒤", ceoName: "한정수", industry: "제조업", region: "경남 창원", revenue: 8000, empCount: 60, estYears: 22, ceoAge: 61, interests: ["가업승계", "미처분이익잉여금", "주식이동", "정관정비"], concern: "이익잉여금 과다로 주식가치 급등, 가업승계 시 상속세 리스크가 큼", stage: "proposal_sent", proposalStatus: "제안 완료", nextDate: plus(4), expectedFee: 2500, memo: "[현재상황] 대표 지분 80%·자녀 임원 재직, 미처분이익잉여금 과다. 승계·주식가치·상속세 리스크로 접근. [추천전략] 가업승계 플랜·주식가치평가·정관정비·이익소각 검토. [다음액션] 제안서 회신 확인 + 주식가치 평가 착수 동의. [예상수임료] 1,500만~3,000만 원." },
    { dest: "lead", name: "맘스키친", ceoName: "최유리", industry: "음식/숙박", region: "경기 수원", revenue: 1200, empCount: 28, estYears: 5, ceoAge: 45, interests: ["고용지원금", "절세", "정책자금"], concern: "신규 매장 오픈으로 직원 채용 예정, 채용 전 고용지원금 신청 순서 확인 필요", stage: "contacted", proposalStatus: "제안 전", nextDate: todayISO(), expectedFee: 300, memo: "[현재상황] 직영 3개점 + 가맹 확장 중. 청년채용·고용증대 지원금은 채용 '전' 순서 점검이 핵심. [추천전략] 고용지원금 점검·복지제도·정책자금. [다음액션] 채용 일정 확인 후 신청 순서 안내(고용지원금 파트 연계). [예상수임료] 200만~400만 원." },
    { dest: "lead", name: "코어소재", ceoName: "오현석", industry: "제조업", region: "충북 청주", revenue: 2500, empCount: 22, estYears: 7, ceoAge: 47, interests: ["연구소", "벤처인증", "법인세", "정책자금"], concern: "연구개발 인력은 있으나 기업부설연구소 미보유, 법인세 부담이 있음", stage: "meeting1_scheduled", proposalStatus: "제안 전", nextDate: plus(2), expectedFee: 350, memo: "[현재상황] 개발·설계 인력 보유, 연구소·세액공제 미적용. '이미 R&D 비용을 쓰고 있다면 세액공제와 인증을 함께 점검' 흐름. [추천전략] 기업부설연구소 설립·연구인력개발비 세액공제 점검·벤처인증·정책자금 검토. [다음액션] 1차 미팅서 조직도·직원명부·R&D비용 확인. [예상수임료] 150만~500만 원." },
    { dest: "company", name: "동방상사", corpType: "주식회사", juPosition: "앞", ceoName: "김상철", industry: "도소매업", region: "서울 중구", revenue: 4500, empCount: 20, estYears: 16, ceoAge: 57, interests: ["가지급금", "정관정비", "임원퇴직금", "법인세"], concern: "대표 가지급금 누적·정관 미점검, 가족 직원 급여/퇴직금 지급근거가 불명확", stage: "meeting2_scheduled", proposalStatus: "견적 전달", nextDate: plus(2), expectedFee: 800, memo: "[현재상황] 대표 지분 100%, 가족 3명 재직. 가지급금을 바로 문제삼기보다 '법인 통장에서 빠진 돈이 재무제표에 어떻게 남는지' 쉽게 설명. [추천전략] 정관정비·가지급금 정리·임원퇴직금 플랜. [다음액션] 견적 전달 후 계정별원장·정관·급여대장 확인. [예상수임료] 300만~800만 원." },
    { dest: "lead", name: "정도건설", ceoName: "정도현", industry: "건설업", region: "인천 남동", revenue: 2800, empCount: 16, estYears: 9, ceoAge: 51, interests: ["정책자금", "법인세", "절세"], concern: "운전자금 부족으로 정책자금 문의, 다만 신용등급 낮고 부채비율이 높아 재무구조 개선이 선행되어야 함", stage: "contacted", proposalStatus: "제안 전", nextDate: plus(1), expectedFee: 400, memo: "[현재상황] 부채비율 높은 편·신용등급 미흡. 정책자금 가능 여부는 재무구조·신용평가 점검 선행 필요. [추천전략] 정책자금 점검·재무구조 개선·법인세 점검. [다음액션] 재무제표 수령 후 가능성 점검 + 재무개선 항목 정리. [예상수임료] 300만~500만 원." },
    { dest: "lead", name: "테크브릿지", ceoName: "이준호", industry: "IT/소프트웨어", region: "서울 강남", revenue: 1200, empCount: 8, estYears: 3, ceoAge: 38, interests: ["벤처인증", "연구소", "정책자금"], concern: "시리즈A 투자유치 준비, 기업가치·인증·정부지원사업 가점이 필요", stage: "contacted", proposalStatus: "제안 전", nextDate: plus(1), expectedFee: 350, memo: "[현재상황] 개발인력 중심 8명, 매출 성장기. 절세보다 기업가치·투자유치·인증·정부지원사업 가점 중심으로 접근. [추천전략] 벤처인증·기업부설연구소·정부지원사업 로드맵·스톡옵션 정비(스톡옵션은 별도 법률검토 필요). [다음액션] 인증 요건·정부지원사업 일정 정리해 회신. [예상수임료] 150만~500만 원." },
    { dest: "lead", name: "서울연합내과", ceoName: "박상우", industry: "병의원", region: "서울 송파", revenue: 3000, empCount: 20, estYears: 9, ceoAge: 51, interests: ["사내근로복지기금", "절세"], concern: "의료진·직원 복지와 장기근속 유도 고민, 대표 소득세 부담도 큼", stage: "meeting_proposed", proposalStatus: "제안 전", nextDate: plus(3), expectedFee: 400, memo: "[현재상황] 직원 20명, 복지제도 미비·핵심인력 이탈 우려. 법인전환보다 복지·소득공제·장기근속 중심 접근. [주의] 병의원은 일반 제조·IT 법인과 구조가 달라 벤처·소득공제 적용은 단정 금지, 반드시 추가 검토 필요. [추천전략] 사내근로복지기금·복지제도 설계 우선. [다음액션] 1차 미팅서 복지·소득공제 니즈 확인 + 급여대장·복지비 지출내역 요청. [예상수임료] 200만~600만 원(검토 후 정리)." },
    { dest: "lead", name: "한빛서비스", ceoName: "윤지훈", industry: "서비스업", region: "경기 성남", revenue: 1800, empCount: 15, estYears: 6, ceoAge: 48, interests: ["고용지원금", "사내근로복지기금", "절세"], concern: "직원을 지속 채용 중이나 고용지원금 미점검·노무관리 미흡", stage: "lead", proposalStatus: "제안 전", nextDate: todayISO(), expectedFee: 300, memo: "[현재상황] 직원 15명, 추가 채용 예정. '계속 뽑고 있다면 지원금보다 먼저 채용 순서와 노무 리스크 점검' 흐름. 4대보험·노무는 노무사 협업 필요. [추천전략] 고용지원금 점검·노무제도 정비·사내근로복지기금. [다음액션] 채용계획·근로계약·4대보험 현황 확인. [예상수임료] 200만~600만 원." },
    { dest: "company", name: "광림전자", corpType: "주식회사", juPosition: "뒤", ceoName: "장세훈", industry: "제조업", region: "경기 화성", revenue: 5200, empCount: 38, estYears: 15, ceoAge: 56, interests: ["정관정비", "임원퇴직금", "법인보험"], concern: "정관정비·임원퇴직금 규정 정비 완료, 계약 후 사후관리 단계로 정기 점검 필요", stage: "contracted", proposalStatus: "계약 완료", nextDate: plus(20), expectedFee: 900, memo: "[현재상황] 정관정비·임원퇴직금 규정 정비 완료(계약 완료). 사후관리로 매 분기 점검·증빙 관리 진행. [추천전략] 임원퇴직금 적립·법인보험 활용 검토·정기 정관 점검. [다음액션] 사후관리 일정 공유 + 다음 점검일 안내. [수임료] 계약 완료(약 900만 원)." },
    { dest: "lead", name: "가온패션", ceoName: "서지원", industry: "도소매업", region: "서울 동대문", revenue: 1600, empCount: 11, estYears: 8, ceoAge: 49, interests: ["법인전환", "절세", "정책자금"], concern: "개인사업자에서 법인전환 검토했으나 시즌 비수기로 일정 보류, 자금 여유 생기면 재개 희망", stage: "hold", proposalStatus: "보류", nextDate: plus(30), expectedFee: 250, memo: "[현재상황] 법인전환 관심 있으나 비수기로 검토 보류. 무리한 권유보다 시점 협의 후 재개. [추천전략] 법인전환 손익 비교·절세 시뮬레이션·정책자금 점검. [다음액션] 성수기 진입 시 재연락(약 한 달 뒤). [예상수임료] 150만~400만 원." },
    { dest: "lead", name: "정밀나노", ceoName: "임도현", industry: "제조업", region: "대전 유성", revenue: 3200, empCount: 24, estYears: 11, ceoAge: 53, interests: ["연구소", "벤처인증", "정책자금", "법인세"], concern: "연구개발 인력 보유·개발성 비용 지출 중이나 세액공제·인증 미점검", stage: "meeting1_scheduled", proposalStatus: "제안 전", nextDate: plus(3), expectedFee: 450, memo: "[현재상황] 연구·설계 인력 다수, R&D 비용 지출 중. 연구소·연구인력개발비 세액공제·벤처인증 함께 점검 흐름. [추천전략] 기업부설연구소 설립·세액공제 점검·벤처인증·정책자금. [다음액션] 1차 미팅서 조직도·R&D 비용·과제 자료 확인. [예상수임료] 200만~600만 원." },
    { dest: "company", name: "페이코어", corpType: "주식회사", juPosition: "앞", ceoName: "노윤재", industry: "IT/소프트웨어", region: "서울 마포", revenue: 2200, empCount: 14, estYears: 5, ceoAge: 41, interests: ["벤처인증", "연구소", "정책자금", "주식이동"], concern: "투자유치 라운드 준비로 벤처인증·연구소·정부지원사업 가점이 필요, 스톡옵션 정비도 검토", stage: "proposal_sent", proposalStatus: "견적 전달", nextDate: plus(2), expectedFee: 600, memo: "[현재상황] 개발 중심 14명, 투자 라운드 준비. 절세보다 기업가치·인증·정부지원 가점 중심. [추천전략] 벤처인증·기업부설연구소·정부지원사업 로드맵·스톡옵션 정비(법률검토 필요). [다음액션] 견적 회신 확인 + 인증 요건·일정 정리. [예상수임료] 300만~800만 원." },
    { dest: "lead", name: "미래교육", ceoName: "한소영", industry: "서비스업", region: "경기 고양", revenue: 1400, empCount: 18, estYears: 7, ceoAge: 46, interests: ["사내근로복지기금", "고용지원금", "절세"], concern: "강사·직원 장기근속 유도와 복지제도 설계 고민, 채용도 이어지는 중", stage: "contacted", proposalStatus: "제안 전", nextDate: plus(1), expectedFee: 300, memo: "[현재상황] 직원 18명, 복지·장기근속 관심. 채용 지속 중이라 고용지원금 순서도 함께 점검. [추천전략] 사내근로복지기금·복지제도 설계·고용지원금 점검(노무사 협업). [다음액션] 급여대장·복지비·채용계획 확인. [예상수임료] 200만~500만 원." },
    { dest: "lead", name: "한성식품", ceoName: "조한별", industry: "제조업", region: "충남 천안", revenue: 4200, empCount: 32, estYears: 14, ceoAge: 54, interests: ["가지급금", "정관정비", "법인세", "정책자금"], concern: "대표 가지급금 누적·정관 미정비, 시설투자 위한 정책자금도 관심", stage: "docs_requested", proposalStatus: "제안 전", nextDate: plus(1), expectedFee: 550, memo: "[현재상황] 식품제조, 대표 지분 100%, 가지급금 누적 추정. 정관정비·가지급금 정리 + 시설자금 점검 흐름. [추천전략] 가지급금 정리·정관정비·정책자금(시설자금) 점검. [다음액션] 계정별원장·정관·시설투자 계획 수령 후 규모 정리. [예상수임료] 300만~700만 원." },
    { dest: "lead", name: "대한로지스", ceoName: "백승현", industry: "운송업", region: "경기 광주", revenue: 3800, empCount: 34, estYears: 12, ceoAge: 52, interests: ["정책자금", "고용지원금", "법인세", "절세"], concern: "운전자금·차량 확충 위한 정책자금 관심, 기사 채용도 늘고 있어 고용지원금 점검 필요", stage: "contacted", proposalStatus: "제안 전", nextDate: plus(2), expectedFee: 400, memo: "[현재상황] 운송·물류, 기사 채용 증가 중. 정책자금(운전·시설)과 고용지원금 순서 점검 흐름. 신용·재무 점검 선행 필요. [추천전략] 정책자금 점검·고용지원금 점검·법인세 점검. [다음액션] 재무제표·채용계획 수령 후 가능성 점검. [예상수임료] 250만~500만 원." },
    { dest: "company", name: "신영식자재", corpType: "주식회사", juPosition: "앞", ceoName: "구본승", industry: "도소매업", region: "부산 사상", revenue: 6000, empCount: 28, estYears: 19, ceoAge: 59, interests: ["가업승계", "법인전환", "정책자금", "정관정비"], concern: "2세 경영 참여 시작·승계 구조 검토 중, 조건 조율 단계로 범위·수임료 협의 중", stage: "decision_pending", proposalStatus: "조건 조율", nextDate: plus(3), expectedFee: 1500, memo: "[현재상황] 식자재 유통, 2세 경영 참여. 승계 구조·주식가치·정관정비 검토. 견적 후 범위·수임료 조건 조율 중. [추천전략] 가업승계 플랜·주식가치평가·정관정비·정책자금. [다음액션] 조건 협의 마무리 + 착수 시점 협의 후 정리. [예상수임료] 1,000만~2,000만 원." },
    { dest: "lead", name: "우진화학", ceoName: "양태식", industry: "제조업", region: "울산 남구", revenue: 7200, empCount: 45, estYears: 20, ceoAge: 60, interests: ["미처분이익잉여금", "가업승계", "주식이동", "정관정비"], concern: "이익잉여금 누적으로 주식가치 상승, 배당·이익소각·승계 활용을 검토하려는 상황", stage: "meeting2_scheduled", proposalStatus: "제안 전", nextDate: plus(4), expectedFee: 1800, memo: "[현재상황] 화학소재, 대표 지분 90%, 미처분이익잉여금 과다 추정. 배당·이익소각·승계 시나리오로 접근. [추천전략] 미처분이익잉여금 정리·주식가치평가·가업승계·정관정비. [다음액션] 2차 미팅서 주식가치 평가 결과·시나리오 공유. [예상수임료] 1,500만~2,500만 원." },
    { dest: "lead", name: "그로스마케팅", ceoName: "신가람", industry: "서비스업", region: "서울 영등포", revenue: 900, empCount: 9, estYears: 4, ceoAge: 36, interests: ["절세", "연구소", "벤처인증"], concern: "성장 초기로 절세·인증 기초 점검 필요, 아직 자료가 정리되지 않은 단계", stage: "lead", proposalStatus: "제안 전", nextDate: plus(5), expectedFee: 200, memo: "[현재상황] 디지털 마케팅 대행 9명, 성장 초기. 기초 절세·인증·자료정리부터 접근. [추천전략] 절세 기초 점검·벤처인증·연구소 검토(요건 확인 필요). [다음액션] 재무·인력 자료 정리 요청 후 기초 진단. [예상수임료] 150만~300만 원." },
  ];
}
// 시드 1건 → 저장용 고객 레코드. companies는 법인표기·feePotential 추가.
function mkSampleCust(b) {
  const c = { id: uid(), name: b.name, ceoName: b.ceoName, industry: b.industry, region: b.region, revenue: b.revenue, empCount: b.empCount, estYears: b.estYears, ceoAge: b.ceoAge, interests: b.interests, concern: b.concern, stage: b.stage, proposalStatus: b.proposalStatus, nextDate: b.nextDate, expectedFee: b.expectedFee, memo: b.memo, sample: true, source: "sample" };
  if (b.dest === "company") return { ...c, corpType: b.corpType || "주식회사", juPosition: b.juPosition || "앞", feePotential: (Number(b.expectedFee) || 0) * 10000, notes: [], docs: [] };
  return c;
}
function demoData() {
  const d = emptyData();
  const plus = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  d.profile = { name: "김팀장", title: "기업컨설턴트" };
  const seedList = sampleSeedList();
  d.leads = seedList.filter((b) => b.dest !== "company").map(mkSampleCust);
  d.companies = seedList.filter((b) => b.dest === "company").map(mkSampleCust);
  d.educationItems = [
    { id: uid(), title: "가업승계 기본요건과 사전증여 포인트", date: todayISO(), instructor: "중기이코노미 교육", field: "가업승계", importance: "high", keywords: "가업승계, 사전증여, 주식가치", transcript: "대표 50세 이상, 업력 10년 이상 기업은 승계 가능성을 사전에 점검해야 한다. 주식가치가 계속 오르기 전에 가족 지분 구조와 정관, 임원퇴직금 규정을 함께 확인해야 한다." },
    { id: uid(), title: "가지급금 발생 원인과 정리 시나리오", date: plus(-7), instructor: "법인세무 실무교육", field: "가지급금", importance: "high", keywords: "가지급금, 인정이자, 정관, 임원퇴직금", transcript: "가지급금은 발생 원인을 먼저 정리해야 한다. 무리한 일시 상환보다 정관·임원보수·퇴직금 규정을 정비한 뒤 상여·배당·퇴직금 등 케이스별로 접근해야 하며, 인정이자 처리 누락 여부를 매년 확인해야 한다." },
    { id: uid(), title: "기업부설연구소와 연구인력개발비 세액공제 실무", date: plus(-10), instructor: "R&D 세제 교육", field: "세액공제", importance: "high", keywords: "연구소, 세액공제, 벤처인증, 사후관리", transcript: "개발·설계·품질개선 인력이 있고 개발성 비용을 쓰고 있다면 기업부설연구소 인증과 연구인력개발비 세액공제를 함께 점검해야 한다. 형식만 갖춘 연구소는 사후관리 리스크가 있어 실제 연구활동과 기록 관리가 중요하다." },
    { id: uid(), title: "사내근로복지기금과 직원 복지제도 설계", date: plus(-14), instructor: "복지·노무 교육", field: "법인보험", importance: "medium", keywords: "사내근로복지기금, 복지제도, 장기근속, 비용처리", transcript: "복지제도는 단순 비용이 아니라 직원 만족도·장기근속과 법인 비용처리를 함께 보는 구조로 설계할 수 있다. 기금 목적과 집행 기준을 맞춰야 하며 노무·세무 검토가 함께 필요하다. 업종별 특성(예: 병의원)은 단정하지 말고 추가 검토가 필요하다." },
  ];
  d.lawUpdates = [
    { id: uid(), title: "가업승계 증여세 과세특례 요건·사후관리 점검 필요", source: "국세청", date: todayISO(), field: "가업승계", importance: "high", summary: "가업승계 관련 요건과 사후관리 변경 여부를 고객별로 확인해야 함. 대표 50세 이상·업력 10년 이상 가족법인은 미처분이익잉여금·주식가치와 함께 점검.", link: "" },
    { id: uid(), title: "대표자 가지급금 인정이자 처리 관련 유의사항", source: "국세청", date: plus(-3), field: "가지급금", importance: "medium", summary: "가지급금 보유 법인은 인정이자 처리와 정관·임원보수 규정 정비 여부를 함께 확인할 필요가 있음.", link: "" },
    { id: uid(), title: "연구·인력개발비 세액공제 적용요건 점검 안내", source: "국세청", date: plus(-5), field: "세액공제", importance: "medium", summary: "연구소 보유·개발성 비용이 있는 제조·IT 법인은 연구인력개발비 세액공제 요건과 사후관리를 점검할 필요가 있음. 형식적 연구소는 리스크가 있으므로 실제 연구활동 기록 확인 필요.", link: "" },
    { id: uid(), title: "청년채용·고용증대 지원금 신청 순서 안내", source: "고용노동부", date: plus(-1), field: "고용지원금", importance: "medium", summary: "채용 전 신청 순서가 중요하며, 채용 후에는 일부 지원금 신청이 제한될 수 있어 채용 예정 기업은 사전 점검이 필요.", link: "" },
  ];
  // 고객(leads/companies)은 mkSampleCust에서 이미 sample 태그·expectedFee 부여. 교육/법령 자료만 추가 태깅.
  ["educationItems", "lawUpdates"].forEach((k) => { d[k] = d[k].map((x) => ({ ...x, sample: true, source: "sample" })); });
  return d;
}

// 기존 데이터는 그대로 두고, 아직 없는 샘플만 추가한다(중복 생성 방지).
// 기준: 리드/업체는 업체명(name), 교육/법령은 제목(title).
function addOnly(seedArr, curArr, keyFn) {
  const cur = curArr || [];
  const curKeys = new Set(cur.map(keyFn));
  const fresh = seedArr.filter((x) => !curKeys.has(keyFn(x)));
  return { merged: [...cur, ...fresh], added: fresh.length };
}
function mergeSamples(current) {
  const cur = current || emptyData();
  const seed = demoData();
  const L = addOnly(seed.leads, cur.leads, (x) => x.name);
  const Co = addOnly(seed.companies, cur.companies, (x) => x.name);
  const E = addOnly(seed.educationItems, cur.educationItems, (x) => x.title);
  const U = addOnly(seed.lawUpdates, cur.lawUpdates, (x) => x.title);
  return {
    data: { ...cur, leads: L.merged, companies: Co.merged, educationItems: E.merged, lawUpdates: U.merged },
    added: L.added + Co.added + E.added + U.added,
    detail: { leads: L.added, companies: Co.added, education: E.added, updates: U.added },
  };
}
// 샘플 판별 — 직접 등록/수정(manual)은 항상 보존. 태그가 빠진 '전환된 샘플'은 이름+전환표시로 보강 판별.
let _SAMPLE_NAMES = null;
function sampleNameSet() { if (!_SAMPLE_NAMES) { _SAMPLE_NAMES = new Set(); const d = demoData(); [...(d.leads || []), ...(d.companies || [])].forEach((x) => _SAMPLE_NAMES.add(x.name)); } return _SAMPLE_NAMES; }
function isSample(x) {
  if (!x) return false;
  if (x.manual === true) return false;                 // 사용자가 직접 등록/수정한 데이터는 보존
  if (x.source === "manual") return false;             // 직접 등록 표시는 보존
  if (x.sample === true || x.fromSample === true) return true;
  if (x.source === "sample" || x.source === "샘플") return true;
  if (x.name && sampleNameSet().has(x.name)) return true; // 샘플 고정 업체명 패턴(전환·태그 유실 대비)
  return false;
}
// 현재 샘플 고객 수 — 각 샘플 업체는 leads 또는 companies 중 한 곳에만 있으므로 합산.
function sampleCount(data) { return ((data && data.leads) || []).filter(isSample).length + ((data && data.companies) || []).filter(isSample).length; }
// 샘플을 정확히 n개(고객 기준)로 '교체' — 기존 샘플은 먼저 비우고 새로 넣는다. 직접 등록 데이터는 유지.
// 시드 순서대로 앞 n개를 골라, 각 업체의 designated 위치(leads/companies)에만 넣는다 → 전체 고객 수 = n.
function addSampleN(current, n) {
  const base = removeSamples(current || emptyData()).data; // 기존 샘플 제거(직접 등록은 보존)
  const pick = sampleSeedList().slice(0, Math.max(0, n | 0));
  const leadRecs = pick.filter((b) => b.dest !== "company").map(mkSampleCust);
  const compRecs = pick.filter((b) => b.dest === "company").map(mkSampleCust);
  const L = addOnly(leadRecs, base.leads, (x) => x.name);   // 직접 등록과 이름 충돌 시 건너뜀
  const Co = addOnly(compRecs, base.companies, (x) => x.name);
  let edu = base.educationItems || [], law = base.lawUpdates || [], eAdded = 0, uAdded = 0;
  if (n >= 10) {
    const seed = demoData();
    const E = addOnly(seed.educationItems, base.educationItems, (x) => x.title);
    const U = addOnly(seed.lawUpdates, base.lawUpdates, (x) => x.title);
    edu = E.merged; law = U.merged; eAdded = E.added; uAdded = U.added;
  }
  const data = migrateData({ ...base, leads: L.merged, companies: Co.merged, educationItems: edu, lawUpdates: law });
  return { data, added: L.added + Co.added + eAdded + uAdded };
}
// 샘플(sample/source/전환된 샘플)만 삭제하고 직접 등록 데이터는 유지. 샘플 고객과 연결된 할 일도 정리.
function removeSamples(current) {
  const cur = current || emptyData();
  const removedIds = new Set();
  const keepCust = (arr) => (arr || []).filter((x) => { if (isSample(x)) { if (x.id) removedIds.add(x.id); return false; } return true; });
  const keepDoc = (arr) => (arr || []).filter((x) => !isSample(x));
  const leads = keepCust(cur.leads), companies = keepCust(cur.companies);
  const educationItems = keepDoc(cur.educationItems), lawUpdates = keepDoc(cur.lawUpdates);
  const todos = (cur.todos || []).filter((t) => !(t.customerId && removedIds.has(t.customerId)));
  const before = ["leads", "companies", "educationItems", "lawUpdates"].reduce((s, k) => s + (cur[k] || []).length, 0);
  const data = { ...cur, leads, companies, educationItems, lawUpdates, todos };
  const after = leads.length + companies.length + educationItems.length + lawUpdates.length;
  return { data, removed: before - after };
}
// 명시적 이름 별칭 — 샘플만 제거 / 샘플을 count개로 교체
function stripSamples(data) { return removeSamples(data); }
function replaceSamples(data, count) { return addSampleN(data, count); }

// 니즈 뚜렷도 가중치 — 가업승계·미처분이익잉여금·가지급금처럼 수임으로 이어지기 쉬운 주제를 높게.
const NEED_WEIGHT = {
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
function scoreBand(score) {
  if (score >= 85) return { label: "계약 가능성 높음", short: "높음", color: C.ok, bg: C.greenBg };
  if (score >= 70) return { label: "적극 추적", short: "적극추적", color: C.gold, bg: "#FCEFDA" };
  if (score >= 55) return { label: "관심 유도 필요", short: "관심유도", color: C.warn, bg: C.warnBg };
  if (score >= 40) return { label: "장기 육성", short: "장기육성", color: C.blue, bg: C.blueBg };
  return { label: "낮음", short: "낮음", color: C.textM, bg: "#EEF2F7" };
}
function stageOf(key) {
  return DEAL_STAGES.find((s) => s.key === key) || DEAL_STAGES[0];
}
function recommendedStrategiesFor(item) {
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
function buildLeadPlan(lead) {
  const score = scoreLead(lead);
  const strategies = recommendedStrategiesFor(lead);
  const main = strategies[0];
  const interestText = (lead.interests || []).join(", ") || "세금·자금·인증";
  return {
    priority: scoreBand(score).label,
    priorityColor: scoreBand(score).color,
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
function digestEducation(e) {
  const strats = recommendedStrategiesFor({ field: e.field, keywords: e.keywords, memo: e.transcript, interests: [e.field] });
  const main = strats[0];
  return {
    summary: `${e.title || "교육"}의 핵심은 ${safe(e.field, "관련 분야")}를 고객 미팅에서 단순 지식이 아니라 ${main.name} 제안 포인트로 연결하는 것입니다. 원문 내용은 반드시 세무사 검토가 필요한 부분과 고객 설명용 표현을 구분해서 사용해야 합니다.`,
    simple: main.pitch,
    q: main.questions,
    taxReq: `${main.name} 관련하여 ${main.docs.join(", ")} 확인이 필요합니다. 적용 가능 여부와 세무 리스크는 세무사 검토 후 안내하는 것이 안전합니다.`,
    sales: `1차 미팅에서는 "대표님 회사도 해당될 수 있는지 점검"으로 접근하고, 2차 미팅에서는 자료 기반으로 ${main.name}의 필요성을 설명하는 흐름이 좋습니다.`,
    content: CONTENT_SEEDS.filter((c) => c.cat === e.field || main.fields.includes(c.cat)).slice(0, 3),
    targets: main.fit,
    kakao: `대표님, 안녕하세요. 최근 ${safe(e.field, "관련 주제")} 관련 내용을 정리하다 보니 ${main.name} 쪽은 대표님 회사도 한 번 점검해보면 좋겠다는 생각이 들었습니다. 바로 결론을 내리기보다 ${main.docs.slice(0, 2).join(", ")} 정도를 먼저 확인한 뒤 검토 가능성을 같이 판단해보면 좋겠습니다. (적용 여부는 세부 요건 확인이 필요합니다.)`,
    contentTopics: [
      `대표님이 놓치기 쉬운 ${safe(e.field, "체크포인트")}, 지금 점검이 필요할 수 있습니다`,
      `${main.name}, 받는 것보다 유지·소명 가능한 구조인지 먼저 봐야 합니다`,
      `세무사가 있어도 대표님이 직접 챙겨야 하는 ${safe(e.field, "포인트")}`,
    ],
    solutionTags: strats.map((s) => s.name),
    clientType: main.fit,
  };
}
function digestUpdate(u, companies = []) {
  const text = `${u.field || ""} ${u.summary || ""} ${u.title || ""}`;
  const related = companies
    .map((c) => {
      const its = c.interests || [];
      const facts = `대표 ${safe(c.ceoAge, "?")}세·업력 ${safe(c.estYears, "?")}년·직원 ${safe(c.empCount, "?")}명`;
      let reason = "";
      if (text.includes("가업승계")) {
        if (Number(c.ceoAge) >= 50 || its.includes("가업승계")) reason = `${facts}${its.includes("가업승계") ? "·가업승계 관심" : ""} → 가업승계 점검 관련(추가 확인 필요)`;
      } else if (text.includes("연구소") || text.includes("세액공제")) {
        if (["제조업", "IT/소프트웨어"].includes(c.industry) || its.includes("연구소")) reason = `${c.industry}${its.includes("연구소") ? "·연구소 관심" : ""} → 연구·인력개발비 세액공제 관련(요건 추가 확인 필요)`;
      } else if (text.includes("고용")) {
        if (Number(c.empCount) > 0 || its.includes("고용지원금")) reason = `직원 ${safe(c.empCount, "?")}명${its.includes("고용지원금") ? "·고용지원금 관심" : ""} → 고용지원금/복지제도 관련(채용 순서 우선 점검)`;
      } else if (text.includes("정관")) {
        if (its.includes("정관정비")) reason = `정관정비 관심 → 정관·임원보수 점검 관련`;
      } else {
        const hit = its.find((i) => text.includes(i));
        if (hit) reason = `${hit} 관심 → 관련 가능성(자료 확인 후 판단)`;
      }
      return reason ? { ...c, reason } : null;
    })
    .filter(Boolean);
  return {
    impact: `${u.source || "관련 기관"} 업데이트는 ${safe(u.field, "해당 분야")} 고객에게 상담 명분으로 활용할 수 있습니다. 다만 원문 확인과 세무사 검토가 필요한 내용은 단정적으로 안내하지 않아야 합니다.`,
    leadPoint: `${safe(u.field, "관련 주제")}를 아직 점검하지 않은 기존 고객과 신규 법인에게 "개정/업데이트 이후 점검 필요" 메시지로 접근할 수 있습니다.`,
    content: `${u.title || "업데이트"} 관련 내용을 대표님이 이해하기 쉬운 방식으로 콘텐츠화하세요. 제목 예시: "대표님 회사도 이번 ${safe(u.field, "변경사항")} 점검이 필요할 수 있습니다"`,
    kakao: `대표님, 최근 ${safe(u.field, "관련 제도")} 관련 업데이트가 있어 공유드립니다.\n대표님 회사에 바로 적용된다고 단정할 수는 없지만, 기존 구조에 영향을 줄 수 있는 부분은 한 번 확인해보시는 게 좋겠습니다. 원문과 자료 기준으로 점검 후 필요하면 세무사 검토까지 연결드리겠습니다.`,
    related,
  };
}

function Onboarding({ onDone }) {
  const [form, setForm] = useState({ name: "", title: "컨설턴트" });
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: `linear-gradient(135deg,${C.bg},${C.card},${C.bg})`, fontFamily: FF, color: C.text }}>
      <Card style={{ width: "100%", maxWidth: 480, borderColor: C.gold + "80", overflow: "hidden" }}>
        <div style={{ padding: 42, textAlign: "center", background: `linear-gradient(135deg,${C.bg},${C.gold}18)` }}>
          <div style={{ letterSpacing: 5, fontSize: 12, color: C.gold, fontWeight: 900, marginBottom: 10 }}>SALES OS</div>
          <h1 style={{ margin: 0, fontSize: 28 }}>영업 도구 모음</h1>
          <p style={{ color: C.textM, marginTop: 10, fontSize: "calc(var(--s,1.3)*16px)" }}>신규 고객 발굴 · 미팅전략 · 교육/법령 업데이트 · 클로징</p>
        </div>
        <div style={{ padding: 32 }}>
          <div style={{ marginBottom: 14 }}><Label>이름 *</Label><input style={inp} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="예: 김팀장" /></div>
          <div style={{ marginBottom: 22 }}><Label>직함</Label><input style={inp} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="예: 기업컨설턴트" /></div>
          <button style={{ ...btnP, width: "100%", padding: 15, fontSize: 15 }} onClick={() => form.name.trim() && onDone({ name: form.name.trim(), title: form.title.trim() || "컨설턴트" })}>시작하기</button>
        </div>
      </Card>
    </div>
  );
}

function Briefing({ data, setData, setTab, selectCompany, goMeeting, openAdd }) {
  const todos = data.todos || [];
  const [hideDone, setHideDone] = useState(false);
  const [scope, setScope] = useState(null);
  const [prep, setPrep] = useState(false);
  const cycleTodo = (id) => setData({ ...data, todos: todos.map((t) => (t.id === id ? { ...t, status: TODO_NEXT[t.status] || "대기" } : t)) });
  const cyclePrio = (id) => setData({ ...data, todos: todos.map((t) => (t.id === id ? { ...t, priority: TODO_PRIO_NEXT[t.priority || "보통"] } : t)) });
  const delTodo = (id) => setData({ ...data, todos: todos.filter((t) => t.id !== id) });
  const companies = data.companies || [];
  const leads = data.leads || [];
  const updates = data.lawUpdates || [];
  const educations = data.educationItems || [];
  const todayLeads = leads.filter((l) => l.nextDate && dday(l.nextDate) <= 0 && !["contracted", "lost"].includes(l.stage));
  const allCust = getUniqueCustomers(data); // 중복 제거(leads+companies 양쪽의 같은 고객은 1명)
  const meetings = allCust.filter((x) => ["meeting1_scheduled", "meeting2_scheduled", "closing_scheduled"].includes(x.stage));
  const hot = allCust.map((x) => ({ ...x, score: scoreLead(x) })).sort((a, b) => b.score - a.score).slice(0, 5);
  const fOf = (k) => allCust.filter((c) => { const fs = followStatus(c); return fs && fs.kind === k; });
  const followToday = fOf("today"), followOver = fOf("overdue"), followSoon = fOf("upcoming");
  const recentlyMoved = allCust.filter((c) => c.stageMovedAt && dday(c.stageMovedAt) >= -7).sort((a, b) => (b.stageMovedAt || "").localeCompare(a.stageMovedAt || "")).slice(0, 6);
  const doneTodos = todos.filter((t) => t.status === "완료");
  const relatedPairs = updates.flatMap((u) => digestUpdate(u, companies).related.map((c) => ({ u, c })));
  const contentSeed = CONTENT_SEEDS[(new Date().getDate() - 1) % CONTENT_SEEDS.length];
  const proposalN = allCust.filter((c) => c.proposalStatus && c.proposalStatus !== "제안 전").length;
  const contractPrepN = allCust.filter((c) => ["견적 전달", "조건 조율", "계약 예정"].includes(c.proposalStatus)).length;
  const nextContactN = followToday.length + followOver.length;
  const realN = allCust.filter((c) => !isSample(c)).length;
  const sampleN = allCust.filter(isSample).length;
  const holdN = allCust.filter((c) => c.stage === "hold" || c.proposalStatus === "보류" || c.dealResult === "보류").length;
  const contractedN = allCust.filter((c) => c.stage === "contracted" || c.proposalStatus === "계약 완료" || c.dealResult === "계약").length;
  const finN = allCust.filter((c) => c.financialSummary).length;
  const flowSteps = [
    { n: 1, icon: "🙋", title: "고객 등록", desc: "받은 DB·메모를 붙여넣어 새 고객을 등록하면 검토 포인트가 정리됩니다.", count: `전체 ${allCust.length}명`, btn: "고객 등록하기", go: () => openAdd && openAdd("lead") },
    { n: 2, icon: "📊", title: "재무자료/크레탑 숫자 확인", desc: "고객 등록 화면의 재무자료 분석에서 매출·이익·자산을 정리합니다. 숫자는 반드시 원문 확인이 필요합니다.", count: `재무 정리 ${finN}명`, btn: "재무자료 확인하기", go: () => openAdd && openAdd("lead") },
    { n: 3, icon: "🤝", title: "1차 미팅 요약 만들기", desc: "고객별 질문·확인자료·상담 흐름을 준비합니다.", count: `미팅 예정 ${meetings.length}건`, btn: "1차 미팅 준비하기", go: () => setTab("meetings") },
    { n: 4, icon: "📄", title: "제안 항목·월납 플랜 검토", desc: "제안서·견적·업무범위서와 월납 플랜을 정리합니다.", count: `제안 진행 ${proposalN}명`, btn: "제안서/견적 만들기", go: () => setTab("reports") },
    { n: 5, icon: "🔔", title: "다음 연락·계약/보류 관리", desc: "다시 연락할 고객과 계약·보류 후속을 놓치지 않게 관리합니다.", count: `오늘·지연 ${nextContactN}명`, btn: "다음 연락 관리하기", go: () => setTab("followup") },
  ];
  const hideTodayGuide = () => { setData({ ...data, beginnerMode: true, beginnerGuideHiddenDate: todayISO() }); showToast("오늘 하루 안내를 숨겼습니다. 내일 다시 표시됩니다."); };
  const disableGuide = () => { setData({ ...data, beginnerMode: false }); showToast("초보자 안내를 껐습니다. 설정·브리핑에서 다시 켤 수 있습니다."); };
  const enableGuide = () => { setData({ ...data, beginnerMode: true, beginnerGuideHiddenDate: "" }); showToast("초보자 안내를 다시 켰습니다."); };
  return (
    <div>
      <Card style={{ padding: "clamp(14px,3.5vw,20px)", marginBottom: 16, background: `linear-gradient(135deg,${C.card},${C.blue}10)`, border: `1px solid ${C.blue}33` }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ fontSize: 13, letterSpacing: 4, color: C.blue, fontWeight: 900 }}>TODAY · 오늘의 브리핑</div>
          {guideActive(data) ? <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><button onClick={hideTodayGuide} style={{ ...btnSm }}>오늘 하루 안내 숨기기</button><button onClick={disableGuide} style={{ ...btnSm }}>계속 안내 보지 않기</button></div> : <button onClick={enableGuide} style={{ ...btnSm, background: C.blueBg, color: C.blue, borderColor: C.blue }}>🔰 초보자 안내 다시 켜기</button>}
        </div>
        <h2 style={{ margin: "8px 0 6px", fontSize: "calc(var(--s,1.3)*30px)", lineHeight: 1.28 }}>오늘은 이 순서로 진행하세요.</h2>
        <p style={{ color: C.textS, fontSize: "calc(var(--s,1.3)*17px)", margin: 0, lineHeight: 1.6 }}>법인컨설턴트가 <b>DB를 받은 순간부터 1차 미팅 준비·제안·계약/보류 후속관리까지</b> 놓치지 않게 도와주는 영업 운영 도구입니다.<span className="pcOnly"> 아래 5단계 순서대로 따라가 보세요.</span></p>
        <div style={{ marginTop: 8, padding: "8px 12px", background: C.card, border: `1px solid ${C.bdr}`, borderRadius: 10, color: C.textM, fontSize: "calc(var(--s,1.3)*14px)", lineHeight: 1.6 }}>이 도구는 컨설팅 판단을 대신하지 않습니다. 고객 자료를 빠르게 정리하고, 미팅 전 놓치기 쉬운 포인트를 점검하는 용도이며, 재무 숫자는 반드시 원문 확인이 필요합니다.</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          {/* [D-94] 샘플 고객은 없다 — 칸에서 뺐다 */}{[["고객", realN, C.sky], ["보류", holdN, C.warn], ["계약", contractedN, C.ok]].map((x) => <div key={x[0]} style={{ display: "flex", alignItems: "baseline", gap: 6, background: C.card, border: `1px solid ${C.bdr}`, borderRadius: 999, padding: "6px 14px" }}><span style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*13px)", fontWeight: 700 }}>{x[0]}</span><span style={{ color: x[2], fontWeight: 900, fontSize: "calc(var(--s,1.3)*17px)" }}>{x[1]}</span><span style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*13px)" }}>명</span></div>)}
        </div>
        <div className="heroBtns" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
          <button style={btnP} onClick={() => setPrep(true)}>🎁 계약 준비팩 만들기</button>
          <button style={btnS} onClick={() => openAdd && openAdd("lead")}>+ 고객 등록</button>
        </div>
        <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*13px)", marginTop: 8, lineHeight: 1.5 }}>고객 1명을 선택하면 미팅 질문, 제안 포인트, 1페이지 진단, 후속 카톡까지 한 번에 정리합니다.</div>
        <div style={{ marginTop: 12 }}><SampleControls data={data} setData={setData} hint="처음이라면 샘플 3개만 넣고 흐름을 먼저 확인해보세요. 더 보고 싶으면 5개·10개로 늘리거나 샘플만 지울 수 있습니다." /></div>
      </Card>
      <ContractPrepPack open={prep} initialId={null} data={data} setData={setData} goMeeting={goMeeting} setTab={setTab} onClose={() => setPrep(false)} />
      {(() => { const ps = getPrepStats(data); const m3 = data.mission3 || {}; const allCust2 = getUniqueCustomers(data); const d1 = allCust2.length > 0; const d2 = (ps.packs || 0) > 0 || m3.d2; const d3 = ((ps.kakao || 0) > 0 && (ps.nextSaved || 0) > 0) || m3.d3; const rc = recontactList(data); const missions = [["Day 1", "고객 1명 등록하기", d1], ["Day 2", "계약 준비팩 만들기", d2], ["Day 3", "후속 카톡 복사 + 다음 연락일 저장", d3]]; const doneN = missions.filter((x) => x[2]).length; return <>
        <Card style={{ padding: 18, marginBottom: 16, border: `1px solid ${C.gold}55` }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 6 }}><h3 style={{ margin: 0, fontSize: "calc(var(--s,1.3)*18px)" }}>✅ 시작 점검 ({doneN}/3)</h3><span style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*13px)" }}>고객 등록 → 계약 준비팩 → 후속 연락까지 한 번 해 보면 흐름이 잡힙니다.</span></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 8 }}>{missions.map((mi, i) => <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: mi[2] ? C.greenBg : C.bg, borderRadius: 10, border: `1px solid ${mi[2] ? C.ok + "40" : C.bdr}` }}><span style={{ fontSize: "calc(var(--s,1.3)*20px)" }}>{mi[2] ? "✅" : "⬜"}</span><div><div style={{ fontWeight: 800, color: mi[2] ? C.ok : C.text, fontSize: "calc(var(--s,1.3)*14px)" }}>{mi[0]}</div><div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*13px)" }}>{mi[1]}</div></div></div>)}</div>
        </Card>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>{[["이번 주 계약 준비팩", ps.packs || 0, C.gold], ["복사한 후속 카톡", ps.kakao || 0, C.blue], ["다음 액션 저장", ps.nextSaved || 0, C.ok], ["재접촉 명분 고객", rc.length, C.purple]].map((x) => <div key={x[0]} style={{ flex: "1 1 150px", background: C.card, border: `1px solid ${C.bdr}`, borderRadius: 12, padding: "12px 16px" }}><div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*13px)", fontWeight: 700 }}>{x[0]}</div><div style={{ color: x[2], fontWeight: 900, fontSize: "calc(var(--s,1.3)*24px)", marginTop: 2 }}>{x[1]}</div></div>)}</div>
        <AccordionSection data={data} setData={setData} screenKey="briefing" sectionKey="recontact" title="🔁 기존 고객 재접촉 명분" count={rc.length} important defaultOpen={false}>
          {rc.length === 0 ? <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*14px)", padding: 4 }}>지금 재접촉이 필요한 고객이 없습니다. (최근 60일 이상 연락 없음·보류 30일 경과 등 기준)</div> : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 10 }}>{rc.map((r) => <div key={r.c.id} style={{ background: C.bg, borderRadius: 11, padding: 14 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}><b style={{ fontSize: "calc(var(--s,1.3)*16px)" }}>{getCompanyName(r.c) || r.c.name}</b><Badge color={C.purple} bg={C.purpleBg}>{stageOf(r.c.stage).label}</Badge></div><div style={{ color: C.textS, fontSize: "calc(var(--s,1.3)*14px)", margin: "6px 0", lineHeight: 1.6 }}>{r.reasons.map((x, i) => <div key={i}>· {x}</div>)}</div><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><button style={btnSm} onClick={() => copyText(r.ment, () => { bumpPrepStat(setData, "kakao"); showToast("재접촉 문구를 복사했습니다."); })}>💬 연락 문구 복사</button><button style={btnSm} onClick={() => goMeeting && goMeeting(r.c.id)}>다음 액션</button></div></div>)}</div>}
        </AccordionSection>
      </>; })()}
      <TodayProposalIdeas data={data} setData={setData} goMeeting={goMeeting} />
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}><h3 style={{ margin: 0, fontSize: "calc(var(--s,1.3)*18px)" }}>📌 업무 흐름 5단계</h3><span style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*14px)" }}>각 단계를 눌러 바로 이동하세요</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 10 }}>
          {flowSteps.map((s) => <Card key={s.n} onClick={s.go} style={{ padding: 16, cursor: "pointer", display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: "calc(var(--s,1.3)*26px)", height: "calc(var(--s,1.3)*26px)", borderRadius: 999, background: C.blue, color: "#fff", fontWeight: 900, fontSize: "calc(var(--s,1.3)*14px)", flex: "none" }}>{s.n}</span><span style={{ fontSize: "calc(var(--s,1.3)*17px)" }}>{s.icon}</span><b style={{ fontSize: "calc(var(--s,1.3)*16px)" }}>{s.title}</b></div>
            <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*14px)", lineHeight: 1.55, flex: 1 }}>{s.desc}</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 2 }}><Badge color={C.blue} bg={C.blueBg}>{s.count}</Badge><span style={{ color: C.blue, fontWeight: 800, fontSize: "calc(var(--s,1.3)*14px)" }}>{s.btn} →</span></div>
          </Card>)}
        </div>
      </div>
      <GuideExpand data={data} expandLabel="상세 현황 펼쳐보기">
      <SalesMetrics data={data} />
      <Card style={{ padding: 20, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 10, flexWrap: "wrap" }}><h3 style={{ margin: 0, fontSize: "calc(var(--s,1.3)*20px)" }}>📋 오늘 할 일 ({todos.filter((t) => t.status !== "완료").length})</h3>{todos.some((t) => t.status === "완료") && <button style={btnSm} onClick={() => setHideDone((v) => !v)}>{hideDone ? "완료된 할 일 보기" : "완료된 할 일 숨기기"}</button>}</div>
        {todos.length === 0 ? <p style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*16px)", lineHeight: 1.7, margin: 0 }}>아직 등록된 할 일이 없습니다. 신규 고객 등록·고객사 관리·미팅 준비 화면에서 ‘➕ 오늘 할 일로 추가’를 눌러보세요.</p> : <div style={{ display: "grid", gap: 8 }}>{todos.filter((t) => !(hideDone && t.status === "완료")).map((t) => { const st = TODO_STYLE[t.status] || TODO_STYLE["대기"]; const pr = TODO_PRIO_STYLE[t.priority || "보통"]; return <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: "12px 14px", background: C.bg, borderRadius: 11, flexWrap: "wrap" }}><div style={{ minWidth: 0 }}><div style={{ fontSize: "calc(var(--s,1.3)*16px)", fontWeight: 700, textDecoration: t.status === "완료" ? "line-through" : "none", opacity: t.status === "완료" ? .6 : 1 }}>{t.title}</div><div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 4, alignItems: "center" }}>{t.customerName && <span style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*14px)" }}>{t.customerName}</span>}{t.kind && t.kind !== "기타" && <Badge color={C.sky} bg={C.blueBg}>{t.kind}</Badge>}{t.due && <Badge color={dday(t.due) < 0 ? C.err : C.textM} bg={dday(t.due) < 0 ? C.redBg : "#EEF2F7"}>📅 {t.due}{dday(t.due) < 0 ? " 지남" : ""}</Badge>}</div></div><div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}><button onClick={() => cyclePrio(t.id)} title="우선순위 변경" style={{ ...btnSm, color: pr[0], borderColor: pr[0], background: pr[1] }}>{t.priority || "보통"}</button><button onClick={() => cycleTodo(t.id)} title="상태 변경" style={{ ...btnSm, color: st[0], borderColor: st[0], background: st[1] }}>{t.status} ↻</button><button onClick={() => delTodo(t.id)} title="삭제" style={{ ...btnSm, color: C.err }}>✕</button></div></div>; })}</div>}
      </Card>
      <Card style={{ padding: 20, marginBottom: 14 }}>
        <h3 style={{ margin: "0 0 12px", fontSize: "calc(var(--s,1.3)*20px)" }}>📌 다음 연락 현황</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
          {[["📞 오늘 연락", followToday, C.warn], ["⏰ 다음 연락 지연", followOver, C.err], ["🔜 곧 연락", followSoon, C.blue]].map((g) => <div key={g[0]} style={{ background: C.bg, borderRadius: 11, padding: 14 }}><div style={{ fontSize: "calc(var(--s,1.3)*15px)", fontWeight: 800, color: g[2], marginBottom: 8 }}>{g[0]} ({g[1].length})</div>{g[1].length === 0 ? <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*14px)" }}>없음</div> : g[1].slice(0, 5).map((c) => <div key={c.id} onClick={() => goMeeting && goMeeting(c.id)} style={{ cursor: "pointer", fontSize: "calc(var(--s,1.3)*15px)", padding: "6px 0", borderBottom: "1px solid " + C.bdr }}>{getCompanyName(c) || c.name} <span style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*13px)" }}>{c.nextDate ? ddayText(dday(c.nextDate)) : ""}</span></div>)}</div>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 12, marginTop: 12 }}>
          <div style={{ background: C.bg, borderRadius: 11, padding: 14 }}><div style={{ fontSize: "calc(var(--s,1.3)*15px)", fontWeight: 800, color: C.gold, marginBottom: 8 }}>🧭 최근 단계 변경 ({recentlyMoved.length})</div>{recentlyMoved.length === 0 ? <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*14px)" }}>없음</div> : recentlyMoved.map((c) => { const last = (c.stageHistory || []).slice(-1)[0]; return <div key={c.id} onClick={() => goMeeting && goMeeting(c.id)} style={{ cursor: "pointer", fontSize: "calc(var(--s,1.3)*15px)", padding: "6px 0", borderBottom: "1px solid " + C.bdr }}>{getCompanyName(c) || c.name} <span style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*13px)" }}>{last ? `${last.from}→${last.to}` : stageOf(c.stage).label}</span></div>; })}</div>
          <div style={{ background: C.bg, borderRadius: 11, padding: 14 }}><div style={{ fontSize: "calc(var(--s,1.3)*15px)", fontWeight: 800, color: C.ok, marginBottom: 8 }}>✅ 오늘 완료한 할 일 ({doneTodos.length})</div>{doneTodos.length === 0 ? <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*14px)" }}>없음</div> : doneTodos.slice(0, 6).map((t) => <div key={t.id} style={{ fontSize: "calc(var(--s,1.3)*15px)", padding: "6px 0", borderBottom: "1px solid " + C.bdr, color: C.textM, textDecoration: "line-through" }}>{t.title}</div>)}</div>
        </div>
      </Card>
      <Card style={{ padding: 20, marginBottom: 14 }}>
        <h3 style={{ margin: "0 0 12px", fontSize: "calc(var(--s,1.3)*20px)" }}>🤝 계약 준비</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
          {[["🎯 계약 준비 후보", "계약 예정", C.gold], ["📑 견적 전달 후 대기", "견적 전달", C.purple], ["🔄 조건 조율 중", "조건 조율", C.warn], ["🏆 계약 완료", "계약 완료", C.ok]].map((g) => { const lst = allCust.filter((c) => c.proposalStatus === g[1]); return <div key={g[0]} style={{ background: C.bg, borderRadius: 11, padding: 14 }}><div style={{ fontSize: "calc(var(--s,1.3)*15px)", fontWeight: 800, color: g[2], marginBottom: 8 }}>{g[0]} ({lst.length})</div>{lst.length === 0 ? <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*14px)" }}>없음</div> : lst.slice(0, 5).map((c) => { const pk = matchPackages(c, getPackages(data))[0]; return <div key={c.id} style={{ padding: "8px 0", borderBottom: "1px solid " + C.bdr }}><div onClick={() => goMeeting && goMeeting(c.id)} style={{ cursor: "pointer", fontSize: "calc(var(--s,1.3)*15px)", fontWeight: 700 }}>{getCompanyName(c) || c.name}</div><div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*13px)", marginTop: 2 }}>{(c.proposedPackages && c.proposedPackages[0]) || (pk && pk.pkg.name) || "상품 미선택"} · {Number(c.proposalMonthlyPremium) > 0 ? `월납 ${manToText(c.proposalMonthlyPremium)}` : feeMoney(c.proposedFee || expFee(c))}</div><div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 5 }}><button style={{ ...btnSm, padding: "5px 9px" }} onClick={() => pk && setScope({ item: c, pkg: pk.pkg })}>업무범위서</button><button style={{ ...btnSm, padding: "5px 9px" }} onClick={() => copyText(followUpKakao(c), () => showToast("복사되었습니다."))}>다음 연락 문구</button></div></div>; })}</div>; })}
        </div>
      </Card>
      {(() => { const sm = salesMetrics(data); const gl = getGoals(data); const ach = gl.feeGoal > 0 ? Math.round((sm.contractedFeeSum / gl.feeGoal) * 100) : 0; const cmpB = monthCompare(data); const dNew = deltaInfo(cmpB.cur.newCust, cmpB.prev.newCust); const dCon = deltaInfo(cmpB.cur.contracted, cmpB.prev.contracted); const dFee = deltaInfo(cmpB.cur.contractFee, cmpB.prev.contractFee); return <Card style={{ padding: 20, marginBottom: 14 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}><h3 style={{ margin: 0, fontSize: "calc(var(--s,1.3)*20px)" }}>📈 성과 분석 요약</h3><button style={btnS} onClick={() => setTab("analytics")}>성과 분석으로 이동 →</button></div><div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>{[["이번 달 목표 달성률", ach + "%", C.gold], ["계약 완료 수임료", feeMoney(sm.contractedFeeSum), C.ok], ["견적 전달 대기", feeMoney(sm.quoteFeeSum), C.purple], ["이번 주 집중 고객", focusCustomers(data).length + "명", C.blue], ["위험 신호", riskSignals(data).length + "명", C.err]].map((x) => <div key={x[0]} style={{ flex: "1 1 150px", minWidth: 0, background: C.bg, borderRadius: 11, padding: 14 }}><div style={{ fontSize: "calc(var(--s,1.3)*14px)", color: C.textM, fontWeight: 700 }}>{x[0]}</div><div style={{ fontSize: "calc(var(--s,1.3)*22px)", fontWeight: 900, color: x[2], marginTop: 4 }}>{x[1]}</div></div>)}</div><div style={{ marginTop: 12, padding: "10px 14px", background: C.bg, borderRadius: 11, fontSize: "calc(var(--s,1.3)*14px)", color: C.textS, lineHeight: 1.7 }}>이번 달 vs 지난 달 · 신규 <b>{cmpB.cur.newCust}</b><span style={{ color: C.textM }}>(지난달 {cmpB.prev.newCust})</span> <b style={{ color: dNew.col }}>{dNew.txt}</b> · 계약 <b>{cmpB.cur.contracted}</b><span style={{ color: C.textM }}>(지난달 {cmpB.prev.contracted})</span> <b style={{ color: dCon.col }}>{dCon.txt}</b> · 계약 수임료 <b>{feeMoney(cmpB.cur.contractFee)}</b> <b style={{ color: dFee.col }}>{dFee.txt}</b></div></Card>; })()}
      <ScopeDoc open={!!scope} item={scope && scope.item} pkg={scope && scope.pkg} data={data} setData={setData} onClose={() => setScope(null)} />
      <div style={{ display: "grid", gridTemplateColumns: "1.1fr .9fr", gap: 14 }}>
        <Card style={{ overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", background: `linear-gradient(135deg,${C.warnBg},${C.bg})`, fontWeight: 900 }}>📞 오늘 바로 움직일 고객</div>
          <div style={{ padding: 14 }}>
            {todayLeads.length === 0 ? <p style={{ color: C.textM, fontSize: 16, lineHeight: 1.7 }}>아직 오늘 연락할 고객이 없습니다. 샘플 데이터를 넣거나 신규 고객 등록·발굴에서 첫 잠재고객을 등록해보세요.</p> : todayLeads.map((l) => {
              const plan = buildLeadPlan(l);
              return <div key={l.id} style={{ padding: 12, background: C.bg, border: "1px solid " + C.bdr, borderRadius: 10, marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><b>{l.name}</b><Badge color={C.gold} bg="#FCEFDA">점수 {plan.score}</Badge></div>
                <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*15px)", margin: "5px 0 8px" }}>{l.industry} · {l.concern || "고민 미입력"}</div>
                <div style={{ color: C.textS, fontSize: "calc(var(--s,1.3)*16px)", lineHeight: 1.6 }}>{plan.hook}</div>
              </div>;
            })}
            <button style={btnP} onClick={() => setTab("prospecting")}>신규 고객 등록·발굴로 이동</button>
          </div>
        </Card>
        <Card style={{ overflow: "hidden" }}>
          <div style={{ padding: "14px 18px", background: `linear-gradient(135deg,${C.blueBg},${C.bg})`, fontWeight: 900 }}>🔥 오늘의 콘텐츠 발굴 주제</div>
          <div style={{ padding: 16 }}>
            <Badge color={C.sky} bg={C.blueBg}>{contentSeed.cat}</Badge>
            <h3 style={{ margin: "10px 0 6px", fontSize: 17 }}>{contentSeed.title}</h3>
            <p style={{ color: C.textS, fontSize: "calc(var(--s,1.3)*16px)", lineHeight: 1.6 }}>{contentSeed.hook}</p>
            <div style={{ marginTop: 10, color: C.textM, fontSize: "calc(var(--s,1.3)*15px)" }}>타깃: {contentSeed.target}</div>
            <button style={{ ...btnS, marginTop: 12 }} onClick={() => setTab("content")}>콘텐츠 전략실로 이동</button>
          </div>
        </Card>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
        <Card style={{ padding: 16 }}>
          <h3 style={{ margin: "0 0 14px", fontSize: "calc(var(--s,1.3)*20px)" }}>🎯 계약 가능성 높은 고객 TOP 5</h3>
          {hot.length === 0 ? <p style={{ color: C.textM, fontSize: 16, lineHeight: 1.7 }}>고객사 관리가 비어 있습니다. 잠재고객을 고객사로 전환하면 미팅전략과 제안 흐름을 만들 수 있습니다.</p> : hot.map((h) => <div key={h.id} style={{ padding: "12px 14px", borderRadius: 10, background: C.bg, marginBottom: 7 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}><span style={{ fontSize: "calc(var(--s,1.3)*17px)", fontWeight: 700 }}>{h.name}</span><Badge color={scoreBand(h.score).color} bg={scoreBand(h.score).bg}>{h.score} · {scoreBand(h.score).short}</Badge></div>
            <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*14px)", margin: "5px 0 8px" }}>{stageOf(h.stage).label} · {(h.interests || []).slice(0, 2).join(", ") || "니즈 미입력"} · 다음: {h.nextAction || "점검"}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><button style={btnSm} onClick={() => goMeeting && goMeeting(h.id)}>🤝 미팅 준비 보기</button></div>
          </div>)}
        </Card>
        <Card style={{ padding: 16 }}>
          <h3 style={{ margin: "0 0 14px", fontSize: "calc(var(--s,1.3)*20px)" }}>🔔 업데이트 영향 고객</h3>
          {relatedPairs.length === 0 ? <p style={{ color: C.textM, fontSize: 16, lineHeight: 1.7 }}>아직 업데이트와 연결된 고객이 없습니다. 고객사 관리에 고객을 추가하면 법령/공고와 자동으로 연결됩니다.</p> : relatedPairs.slice(0, 6).map((p, idx) => <div key={idx} style={{ padding: "12px 14px", borderRadius: 10, background: C.bg, marginBottom: 7, fontSize: 16 }}>
            <b>{p.c.name}</b><span style={{ color: C.textM }}> · {p.u.field} 업데이트</span><div style={{ color: C.textS, fontSize: "calc(var(--s,1.3)*16px)", marginTop: 5, lineHeight: 1.6 }}>{p.c.reason}</div>
          </div>)}
        </Card>
      </div>
      </GuideExpand>
    </div>
  );
}

function LeadForm({ initial, onSave, onCancel }) {
  const [f, setF] = useState(initial || { name: "", industry: "제조업", region: "", revenue: "", empCount: "", estYears: "", ceoAge: "", source: "전화", interests: [], concern: "", stage: "lead", nextDate: todayISO(), memo: "" });
  const upd = (k, v) => setF({ ...f, [k]: v });
  const toggle = (it) => upd("interests", (f.interests || []).includes(it) ? (f.interests || []).filter((x) => x !== it) : [...(f.interests || []), it]);
  return <div style={{ display: "grid", gap: 12 }}>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}><div><Label>업체명 *</Label><input style={inp} value={f.name} onChange={(e) => upd("name", e.target.value)} /></div><div><Label>지역</Label><input style={inp} value={f.region} onChange={(e) => upd("region", e.target.value)} /></div></div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}><div><Label>업종</Label><select style={inp} value={f.industry} onChange={(e) => upd("industry", e.target.value)}>{INDUSTRIES.map((x) => <option key={x}>{x}</option>)}</select></div><div><Label>접근경로</Label><select style={inp} value={f.source} onChange={(e) => upd("source", e.target.value)}>{SOURCES.map((x) => <option key={x}>{x}</option>)}</select></div><div><Label>딜 단계</Label><select style={inp} value={f.stage} onChange={(e) => upd("stage", e.target.value)}>{DEAL_STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></div></div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}><div><Label>예상 매출(백만원)</Label><input type="number" style={inp} value={f.revenue} onChange={(e) => upd("revenue", e.target.value)} /></div><div><Label>직원 수</Label><input type="number" style={inp} value={f.empCount} onChange={(e) => upd("empCount", e.target.value)} /></div><div><Label>업력</Label><input type="number" style={inp} value={f.estYears} onChange={(e) => upd("estYears", e.target.value)} /></div><div><Label>대표 나이</Label><input type="number" style={inp} value={f.ceoAge} onChange={(e) => upd("ceoAge", e.target.value)} /></div></div>
    <div><Label>관심/예상 니즈</Label><div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>{INTERESTS.map((it) => <PillButton key={it} active={(f.interests || []).includes(it)} onClick={() => toggle(it)}>{it}</PillButton>)}</div></div>
    <div><Label>대표 예상 고민</Label><input style={inp} value={f.concern} onChange={(e) => upd("concern", e.target.value)} placeholder="예: 법인세 부담, 승계, 자금 부족, 세무사 외 추가 전략 필요" /></div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}><div><Label>다음 액션일</Label><input type="date" style={inp} value={f.nextDate || ""} onChange={(e) => upd("nextDate", e.target.value)} /></div><div><Label>메모</Label><input style={inp} value={f.memo} onChange={(e) => upd("memo", e.target.value)} /></div></div>
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}><button style={btnS} onClick={onCancel}>취소</button><button style={btnP} onClick={() => f.name.trim() && onSave({ ...f, id: f.id || uid() })}>저장</button></div>
  </div>;
}

// 고객 상태 필터 — 컨설팅 주제(가지급금/연구소/정책자금 등)는 상품 제안용이라 상태 필터에서 제외.
// 매핑은 기존 status 값을 바꾸지 않고 필터 시점에만 적용(stage 키 + 한글 상태값 + proposalStatus).
function leadStageKey(l) { return String((l && l.stage) || "").toLowerCase(); }
function leadPropStatus(l) { return String((l && l.proposalStatus) || ""); }
// 신규 고객 등록·발굴 — 계약 전 잠재고객의 '영업 단계' 기준(계약 완료는 제외)
const PROSPECT_FILTERS = [
  ["전체", () => true],
  ["계약 가능성 높음", (l) => scoreLead(l) >= 70 || /high|hot|계약\s*가능성\s*높음/i.test(leadStageKey(l))],
  ["신규 연락", (l) => /^(lead|new|prospect|contacted|meeting_proposed|잠재|신규)$/.test(leadStageKey(l))],
  ["1차 미팅 예정", (l) => /meeting1|(^|[^0-9])1차/.test(leadStageKey(l))],
  ["2차 미팅 예정", (l) => /meeting2|(^|[^0-9])2차/.test(leadStageKey(l))],
  ["3차 미팅 예정", (l) => /meeting3|closing|(^|[^0-9])3차/.test(leadStageKey(l))],
  ["자료 요청", (l) => /docs_requested|requested|자료\s*요청/.test(leadStageKey(l))],
  ["보류", (l) => /^(hold|보류)$/.test(leadStageKey(l))],
  ["장기관리", (l) => /^(long|장기관리)$/.test(leadStageKey(l)) || !!l.longTerm],
];
// 고객사 관리 — 상담/계약/관리 단계에 들어온 고객의 '관리 상태' 기준
const COMPANY_FILTERS = [
  ["전체", () => true],
  ["계약 완료", (l) => leadStageKey(l) === "contracted" || /기존\s*계약/.test(leadStageKey(l)) || /계약\s*완료/.test(leadPropStatus(l))],
  ["계약 예정", (l) => /closing|decision_pending|contracting|계약\s*예정/.test(leadStageKey(l)) || /계약\s*예정|견적\s*전달|조건\s*조율/.test(leadPropStatus(l))],
  ["계약 가능성 높음", (l) => scoreLead(l) >= 70 || /high|hot|계약\s*가능성\s*높음/i.test(leadStageKey(l))],
  ["관리 필요", (l) => /need_care|관리\s*필요/.test(leadStageKey(l)) || !!l.needCare],
  ["오늘 연락", (l) => (l.nextDate && dday(l.nextDate) <= 0) || /today|오늘\s*연락/.test(leadStageKey(l))],
  ["자료 요청", (l) => /docs_requested|requested|자료\s*요청/.test(leadStageKey(l)) || /자료\s*요청/.test(leadPropStatus(l))],
  ["보류·장기관리", (l) => /^(hold|lost|long)$/.test(leadStageKey(l)) || /보류|장기관리/.test(leadStageKey(l)) || !!l.longTerm],
];
function matchSearch(l, q) {
  if (!q.trim()) return true;
  const hay = `${l.name} ${l.industry || ""} ${(l.interests || []).join(" ")} ${l.concern || ""} ${l.memo || ""} ${recommendedStrategiesFor(l).map((s) => s.name).join(" ")}`;
  return hay.includes(q.trim());
}
function Prospecting({ data, setData, setTab, goMeeting, openAdd, selectId, recentId, onSelected }) {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [q, setQ] = useState("");
  const [flt, setFlt] = useState("전체");
  const [selected, setSelected] = useState(null);
  const leads = data.leads || [];
  useEffect(() => { if (selectId && leads.some((l) => l.id === selectId)) { setSelected(selectId); onSelected && onSelected(); } }, [selectId]);
  // 신규 고객 등록·발굴는 '계약 전 잠재고객' 중심(계약완료·이탈 제외).
  // 단, 샘플은 요청 개수(3/5/10/20)가 그대로 보이도록 leads + 샘플 고객사를 합쳐 중복 없이 표시.
  const prospectSource = (() => { const base = [...leads, ...((data.companies || []).filter(isSample))]; const seen = new Set(); return base.filter((x) => { const k = x.id || normName(x.name); if (seen.has(k)) return false; seen.add(k); return true; }); })();
  const prospects = prospectSource.filter((l) => isSample(l) || !["contracted", "lost"].includes(l.stage));
  const fObj = PROSPECT_FILTERS.find((x) => x[0] === flt);
  const filtered = prospects.filter((l) => (!fObj || fObj[1](l)) && matchSearch(l, q)).slice().sort((a, b) => scoreLead(b) - scoreLead(a));
  const filterActive = q.trim() || flt !== "전체";
  const saveLead = (leadIn) => {
    const lead = { ...leadIn, manual: true, sample: false };
    const exists = leads.some((l) => l.id === lead.id);
    setData({ ...data, leads: exists ? leads.map((l) => l.id === lead.id ? lead : l) : [lead, ...leads] });
    setOpen(false); setEdit(null); setSelected(lead.id);
  };
  const del = (id) => { if (window.confirm("이 업체의 영업 기록을 삭제할까요? 고객 운영 업체는 그대로 남습니다.")) { setData({ ...data, leads: leads.filter((l) => l.id !== id) }); setSelected(null); showToast("고객을 삭제했습니다."); } };
  // 리드 → 고객사 관리 전환(같은 업체명이 있으면 중복 생성 없이 고객사 관리로 이동)
  // 전환된 리드는 convertedToDB 플래그로 '고객사 관리 전환 완료' 상태를 남긴다.
  const toCompany = (l) => {
    const companies = data.companies || [];
    const markLead = (lds) => lds.map((x) => (x.id === l.id ? { ...x, convertedToDB: true, convertedAt: todayISO() } : x));
    if (companies.some((c) => c.name === l.name)) {
      setData({ ...data, leads: markLead(leads) });
      window.alert(`이미 고객사 관리에 '${l.name}'이(가) 등록되어 있습니다. 리드를 '고객사 관리 전환 완료'로 표시하고 고객사 관리 탭으로 이동합니다.`);
      setTab && setTab("companies");
      return;
    }
    const company = { id: uid(), name: l.name, corpType: "주식회사", juPosition: "앞", ceoName: "", industry: l.industry, region: l.region, revenue: l.revenue, empCount: l.empCount, estYears: l.estYears, ceoAge: l.ceoAge, stage: l.stage, interests: l.interests || [], concern: l.concern, memo: l.memo, nextDate: l.nextDate, notes: [], docs: [], feePotential: "", fromLead: true, ...(isSample(l) ? { sample: true, source: "sample" } : { manual: true }) };
    setData({ ...data, companies: [company, ...companies], leads: markLead(leads) });
    window.alert(`'${l.name}'을(를) 고객사 관리에 등록하고 리드를 '고객사 관리 전환 완료'로 표시했습니다. 고객사 관리 탭으로 이동합니다.`);
    setTab && setTab("companies");
  };
  const lead = leads.find((l) => l.id === selected) || prospects[0];
  const plan = lead ? buildLeadPlan(lead) : null;
  // 고객사 관리 전환 여부: 전환 플래그가 있거나 같은 업체명이 고객사 관리에 존재하면 전환 완료로 본다.
  const isConverted = (l) => !!(l && (l.convertedToDB || (data.companies || []).some((c) => c.name === l.name)));
  const inDB = isConverted(lead);
  // 리드 카드 상단 상태 배지(우선순위 1개)
  const leadStatus = (l) => {
    if (isConverted(l)) return { t: "✅ 고객사 관리 전환 완료", c: C.ok, b: C.greenBg };
    if (l.nextDate && dday(l.nextDate) <= 0) return { t: "📞 오늘 연락", c: C.warn, b: C.warnBg };
    if (l.stage === "docs_requested") return { t: "📂 자료 요청", c: C.purple, b: C.purpleBg };
    if (["meeting_proposed", "meeting1_scheduled", "contacted"].includes(l.stage)) return { t: "🤝 1차 미팅 필요", c: C.blue, b: C.blueBg };
    return { t: stageOf(l.stage).label, c: stageOf(l.stage).color, b: stageOf(l.stage).bg };
  };
  // 왜 이 고객을 공략해야 하는지 한 줄 요약
  const whyAttack = (l) => {
    const main = recommendedStrategiesFor(l)[0];
    const bits = [];
    if (Number(l.ceoAge) >= 55) bits.push(`대표 ${l.ceoAge}세`);
    if (Number(l.estYears) >= 10) bits.push(`업력 ${l.estYears}년`);
    if (Number(l.empCount) >= 20) bits.push(`직원 ${l.empCount}명`);
    const head = bits.length ? bits.join("·") + " · " : "";
    return `${head}${main ? main.name : "세무·자금 점검"} 우선 점검 필요`;
  };
  return <div>
    {null}
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 12, flexWrap: "wrap" }}><p style={{ color: C.textS, margin: 0, fontSize: "calc(var(--s,1.3)*16px)", lineHeight: 1.7, maxWidth: 640 }}>계약 전 <b>잠재고객을 영업 단계별로 관리</b>합니다. 연락 예정, 미팅 예정, 자료 요청 고객을 놓치지 않도록 정리하세요.</p><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button style={btnP} onClick={() => openAdd && openAdd("lead")}>+ 고객 등록</button></div></div>
    <div style={{ marginBottom: 14 }}><div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}><input style={{ ...inp, flex: 1, minWidth: 220, marginBottom: 0 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 업체명, 업종, 니즈, 대표 고민으로 검색" />{q.trim() && <button style={btnSm} onClick={() => setQ("")}>✕ 검색 초기화</button>}</div><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{PROSPECT_FILTERS.map((f) => <PillButton key={f[0]} active={flt === f[0]} onClick={() => setFlt(f[0])}>{f[0]}</PillButton>)}</div><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, gap: 8, flexWrap: "wrap" }}><span style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*14px)" }}>총 {prospects.length}개 중 <b style={{ color: C.text }}>{filtered.length}개</b> 표시{flt !== "전체" ? ` · 필터: ${flt}` : ""}</span>{filterActive && <button style={btnSm} onClick={() => { setQ(""); setFlt("전체"); }}>필터 초기화</button>}</div></div>
    <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 16 }}>
      <Card style={{ padding: 12 }}>
        {prospects.length === 0 ? <div style={{ padding: 18, textAlign: "center" }}><p style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*16px)", lineHeight: 1.7, marginBottom: 14 }}>아직 등록된 고객이 없습니다. 첫 고객을 등록하면 미팅 준비와 리포트가 자동으로 만들어집니다.</p><div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}><button style={btnP} onClick={() => openAdd && openAdd("lead")}>+ 고객 등록하기</button><SampleCTA data={data} setData={setData} label="🎁 샘플로 먼저 보기" /></div></div> : filtered.length === 0 ? <p style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*16px)", lineHeight: 1.7, padding: 8 }}>검색 결과가 없습니다. 다른 키워드로 검색하거나 신규 고객을 등록해보세요.</p> : filtered.map((l) => { const active = lead && lead.id === l.id; const bd = scoreBand(scoreLead(l)); const s = leadStatus(l); const src = sourceTag(l); return <div key={l.id} onClick={() => setSelected(l.id)} style={{ padding: 14, borderRadius: 12, background: active ? C.gold + "18" : C.bg, border: active ? "1px solid " + C.gold : "1px solid " + C.bdr, cursor: "pointer", marginBottom: 9 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}><b style={{ fontSize: "calc(var(--s,1.3)*19px)" }}>{l.name}</b><Badge color={s.c} bg={s.b}>{s.t}</Badge></div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 6 }}><Badge color={src.color} bg={src.bg}>{src.label}</Badge>{recentId === l.id && <Badge color={C.gold} bg="#FCEFDA">✨ 방금 등록</Badge>}</div>
          <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*14px)", marginTop: 6 }}>{l.industry} · {wonFromMillion(l.revenue)} · {l.empCount || "-"}명</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}><div><span style={{ fontSize: "calc(var(--s,1.3)*30px)", fontWeight: 900, color: bd.color }}>{scoreLead(l)}</span><span style={{ fontSize: "calc(var(--s,1.3)*14px)", color: C.textM, marginLeft: 6 }}>{bd.label}</span></div>{l.nextDate && <Badge color={dday(l.nextDate) <= 0 ? C.err : C.blue} bg={dday(l.nextDate) <= 0 ? C.redBg : C.blueBg}>{ddayText(dday(l.nextDate))}</Badge>}</div>
          <div style={{ marginTop: 9, fontSize: "calc(var(--s,1.3)*15px)", color: C.textS, lineHeight: 1.5 }}>💡 {whyAttack(l)}</div>
        </div>; })}
      </Card>
      <div>{!lead ? <Card style={{ padding: 40, textAlign: "center", color: C.textM }}>리드를 선택하세요.</Card> : <div style={{ display: "grid", gap: 12 }}>
        <Card style={{ padding: 18, background: `linear-gradient(135deg,${C.card},${C.gold}12)` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 10 }}><div><div style={{ display: "flex", alignItems: "center", gap: 8 }}><h3 style={{ margin: 0, fontSize: "calc(var(--s,1.3)*22px)" }}>{lead.name}</h3>{inDB && <Badge color={C.ok} bg={C.greenBg}>✅ 고객사 관리 전환 완료</Badge>}</div><p style={{ color: C.textM, margin: "6px 0 0" }}>{plan.target}</p></div><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><button style={{ ...btnP }} onClick={() => goMeeting && goMeeting(lead.id)}>🤝 1차 미팅 준비</button><button style={{ ...btnSm, color: inDB ? C.textM : C.sky, borderColor: inDB ? C.bdr : C.sky }} onClick={() => toCompany(lead)}>{inDB ? "고객사에 있음 ↗" : "고객사로 전환"}</button><button style={btnSm} onClick={() => addTodo(data, setData, lead, `${lead.name} 1차 연락·자료 확인`)}>➕ 오늘 할 일</button><button style={btnSm} onClick={() => openAdd && openAdd("lead", lead, "lead")}>수정</button><button style={{ ...btnSm, color: C.err }} onClick={() => del(lead.id)}>삭제</button></div></div>
        </Card>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}><Card style={{ padding: 16 }}><Label>공략 우선순위</Label><div style={{ fontSize: 20, color: plan.priorityColor, fontWeight: 900 }}>{plan.priority}</div></Card><Card style={{ padding: 16 }}><Label>계약 가능성 점수</Label><div style={{ fontSize: "calc(var(--s,1.3)*40px)", color: C.gold, fontWeight: 900 }}>{plan.score}</div></Card><Card style={{ padding: 16 }}><Label>추천 상품</Label><div style={{ fontSize: 15, color: C.textS }}>{plan.products.slice(0, 2).join(" / ")}</div></Card></div>
        <CustomerPanel item={lead} data={data} setData={setData} goMeeting={goMeeting} onConvert={toCompany} inDB={inDB} />
        <div style={{ fontSize: "calc(var(--s,1.3)*18px)", fontWeight: 900, color: C.gold, marginTop: 8 }}>📞 발굴 단계 콜드콜 스크립트</div>
        <TextBlock title="접근 포인트 · 첫 연락 후킹 문구" text={plan.hook} copy />
        <TextBlock title="전화 스크립트" text={plan.phone} copy />
        <TextBlock title="카톡/DM 문구" text={plan.kakao} copy />
        <Card style={{ padding: 14 }}><div style={{ fontWeight: 900, color: C.gold, marginBottom: 8 }}>예상 거절 & 대응</div>{plan.objections.map((o, i) => <div key={i} style={{ padding: 10, background: C.bg, borderRadius: 8, marginBottom: 7, fontSize: "calc(var(--s,1.3)*15px)", lineHeight: 1.7 }}><b style={{ color: C.warn }}>{o[0]}</b><br /><span style={{ color: C.textS }}>{o[1]}</span></div>)}</Card>
        <TextBlock title="미팅 전환 전략" text={plan.meetingBridge} copy />
      </div>}</div>
    </div>
    <Modal open={open} onClose={() => { setOpen(false); setEdit(null); }} title={edit ? "리드 수정" : "리드 등록"} width={820}><LeadForm initial={edit} onSave={saveLead} onCancel={() => { setOpen(false); setEdit(null); }} /></Modal>
  </div>;
}

function ContentLab({ data, setData }) {
  const [bench, setBench] = useState("");
  const items = [...CONTENT_SEEDS, ...((data.contentIdeas || []))];
  const rot = new Date().getDate() % Math.max(1, items.length);
  const top = items.slice(rot).concat(items).slice(0, 3);
  const intro = <><h2 style={{ margin: "0 0 4px", fontSize: "calc(var(--s,1.3)*22px)" }}>📣 콘텐츠 전략</h2><p style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*15px)", lineHeight: 1.6, margin: "0 0 8px" }}>콘텐츠 주제를 신규 고객 발굴·미팅 전환 문구와 <b>관련 고객 연락거리</b>로 연결합니다. 카테고리를 눌러 주제를 펼쳐보세요.</p></>;
  const analysis = bench.trim() ? [bench.replace(/무조건|반드시/g, "먼저 확인해야 할"), "대표님, 이 순서 놓치면 나중에 비용이 더 커질 수 있습니다", "세무사가 있어도 대표님이 직접 챙겨야 하는 법인 체크포인트", "법인세 줄이기 전에 먼저 봐야 할 위험 신호", "가업승계·정관·가지급금, 미루면 왜 불리해질까?"] : null;
  return <div>
    <CatLibrary screenKey="content" data={data} setData={setData} intro={intro} items={items} getCat={contentCat} getText={(s) => `${s.cat} ${s.title} ${s.hook || ""} ${s.target || ""}`} topItems={top} topTitle="🔥 이번 주 추천 콘텐츠 3개" CardComp={ContentCard} minCard={300} />
    <AccordionSection data={data} setData={setData} screenKey="content" sectionKey="bench" title="✏️ 콘텐츠 아이디어 추가 · 벤치마킹 변환" defaultOpen={false}>
      <p style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*14px)", lineHeight: 1.6, margin: "0 0 8px" }}>경쟁 콘텐츠 제목·문구를 붙여넣으면 비단정 톤의 제목 후보로 변환합니다.</p>
      <textarea style={{ ...inp, height: 90, resize: "vertical" }} value={bench} onChange={(e) => setBench(e.target.value)} placeholder="예: 직원 먼저 뽑으면 지원금 못 받습니다" />
      {analysis && <div style={{ marginTop: 10, display: "grid", gap: 6 }}>{analysis.map((t, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8, background: C.bg, borderRadius: 9, padding: "8px 12px" }}><span style={{ fontSize: "calc(var(--s,1.3)*14px)" }}>{t}</span><button style={{ ...btnSm, padding: "3px 8px" }} onClick={() => copyText(t, () => showToast("복사했습니다."))}>복사</button></div>)}</div>}
    </AccordionSection>
  </div>;
}

function MeetingLab({ data, setData, focusId }) {
  const [scope, setScope] = useState(false);
  const all = getUniqueCustomers(data);
  const [id, setId] = useState(focusId || all[0]?.id || "");
  const [stage, setStage] = useState("m1");
  const [rep, setRep] = useState(false);
  const [prep, setPrep] = useState(false);
  useEffect(() => { if (focusId) setId(focusId); }, [focusId]);
  const item = all.find((x) => x.id === id) || all[0];
  const plan = item ? buildMeetingPlan(item, stage) : null;
  const matchedPkgs = item ? matchPackages(item, getPackages(data)) : [];
  const STAGE_INFO = { m1: { label: "1차 미팅 준비", purpose: "문제 발견 · 니즈 파악 · 자료 요청", color: C.warn, bg: C.warnBg }, m2: { label: "2차 미팅 준비", purpose: "해결 방향 제시 · 컨설팅 조합 제안 · 월납 검토", color: C.blue, bg: C.blueBg }, m3: { label: "3차 클로징", purpose: "의사결정 장애 제거 · 계약/청약 준비 · 후속 확신", color: C.gold, bg: "#FCEFDA" } };
  const info = STAGE_INFO[stage] || STAGE_INFO.m1;
  const acc = (key, title, important, children) => <AccordionSection data={data} setData={setData} screenKey="meetings" sectionKey={key} title={title} important={important} defaultOpen={false}>{children}</AccordionSection>;
  return <div>
    <Card style={{ padding: "12px 14px", marginBottom: 12, background: C.blueBg, border: `1px solid ${C.blue}40` }}><div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}><button style={btnP} onClick={() => setPrep(true)}>🎁 계약 준비팩 만들기</button><span style={{ color: C.textS, fontSize: "calc(var(--s,1.3)*13px)", flex: 1, minWidth: 180, lineHeight: 1.5 }}>고객 1명을 선택하면 미팅 질문, 제안 포인트, 1페이지 진단, 후속 카톡까지 한 번에 정리합니다.</span></div></Card>
    <ContractPrepPack open={prep} initialId={item && item.id} data={data} setData={setData} goMeeting={(cid) => { setPrep(false); setId(cid); }} onClose={() => setPrep(false)} />
    <p style={{ color: C.textS, fontSize: "calc(var(--s,1.3)*15px)", margin: "0 0 14px", lineHeight: 1.6 }}>고객과 단계(1·2·3차)를 선택하면 <b>현재 단계 목적</b>과 단계별 핵심 섹션이 바뀝니다. 제안 우선순위·리포트·카톡 등 상세는 아래에서 펼쳐 보세요.</p>
    <Card style={{ padding: 16, marginBottom: 14 }}><div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "end" }}><div><Label>고객 선택</Label><select style={inp} value={id} onChange={(e) => setId(e.target.value)}>{all.map((x) => <option key={x.id} value={x.id}>{getCompanyName(x) || x.name}</option>)}</select></div><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{[["m1", "1차 미팅"], ["m2", "2차 미팅"], ["m3", "3차 클로징"]].map((x) => <PillButton key={x[0]} active={stage === x[0]} onClick={() => setStage(x[0])}>{x[1]}</PillButton>)}</div></div></Card>
    {!item ? <Card style={{ padding: 40, textAlign: "center" }}><p style={{ color: C.textM, fontSize: 16, lineHeight: 1.7, marginBottom: 14 }}>고객을 선택하면 1·2·3차 미팅 준비가 자동으로 만들어집니다. 샘플 데이터를 넣거나 신규 고객 발굴·고객사 관리에서 고객을 먼저 등록하세요.</p><SampleCTA data={data} setData={setData} /></Card> : <div style={{ display: "grid", gap: 12 }}>
      <Card style={{ padding: 18, background: `linear-gradient(135deg,${C.card},${C.gold}12)` }}><div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}><div><div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}><h3 style={{ margin: 0, fontSize: "calc(var(--s,1.3)*24px)" }}>{getCompanyName(item) || item.name}</h3>{(() => { const sg = sourceTag(item); return <Badge color={sg.color} bg={sg.bg}>{sg.label}</Badge>; })()}</div><p style={{ color: C.textM, margin: "6px 0 0", fontSize: "calc(var(--s,1.3)*15px)" }}>{item.industry} · 관심주제 {(item.interests || []).join(", ") || "미입력"}</p></div><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button style={btnP} onClick={() => setRep(true)}>📄 방문용 리포트 보기</button><button style={btnS} onClick={() => setScope(true)}>📑 견적/업무범위서</button><button style={btnS} onClick={() => addTodo(data, setData, item, `${getCompanyName(item) || item.name} 미팅 준비·자료 확인`)}>➕ 오늘 할 일로 추가</button></div></div></Card>
      <ScopeDoc open={scope} item={item} pkg={matchedPkgs[0] && matchedPkgs[0].pkg} data={data} setData={setData} onClose={() => setScope(false)} />
      <VisitReport open={rep} item={item} data={data} setData={setData} onClose={() => setRep(false)} />
      <Card style={{ padding: "14px 16px", background: info.bg, border: `1px solid ${info.color}55` }}><div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}><Badge color={info.color} bg="#fff">현재 선택</Badge><b style={{ fontSize: "calc(var(--s,1.3)*18px)", color: info.color }}>{info.label}</b><span style={{ color: C.textS, fontSize: "calc(var(--s,1.3)*14px)" }}>목적: {info.purpose}</span></div></Card>
      <div style={{ border: `1px solid ${info.color}55`, borderRadius: 12, padding: 14, background: C.card }}><div style={{ fontWeight: 800, color: info.color, fontSize: "calc(var(--s,1.3)*15px)", marginBottom: 10 }}>📍 {info.label} 핵심 섹션</div><div style={{ display: "grid", gap: 10 }}>{stage === "m1" && <><TextBlock title="미팅 목표" text={plan.goal} copy /><TextBlock title="첫 5분 오프닝" text={plan.opening} copy /><Card style={{ padding: 14 }}><div style={{ color: C.gold, fontWeight: 900, marginBottom: 8 }}>핵심 질문 10개</div>{plan.questions.map((q, i) => <div key={i} style={{ padding: "7px 0", borderBottom: i < plan.questions.length - 1 ? "1px solid " + C.bdr : "none", color: C.textS, fontSize: "calc(var(--s,1.3)*15px)" }}>{i + 1}. {q}</div>)}</Card><TextBlock title="조심할 주제" text={plan.avoid} /><TextBlock title="2차 미팅 연결" text={plan.next} copy /><TextBlock title="미팅 후 카톡" text={plan.kakao} copy /><TextBlock title="요청자료" text={plan.docs.join("\n")} copy /></>}{stage === "m2" && <><TextBlock title="미팅 목표" text={plan.goal} /><Card style={{ padding: 14 }}><div style={{ color: C.gold, fontWeight: 900, marginBottom: 8 }}>먼저 보여줄 이슈 TOP 3</div>{plan.topIssues.map((q, i) => <div key={i} style={{ padding: "8px 0", borderBottom: i < plan.topIssues.length - 1 ? "1px solid " + C.bdr : "none", color: C.textS, fontSize: "calc(var(--s,1.3)*15px)", lineHeight: 1.7 }}>{q}</div>)}</Card><TextBlock title="제안 순서" text={plan.approach} copy /><Card style={{ padding: 14 }}><div style={{ color: C.gold, fontWeight: 900, marginBottom: 8 }}>예상 반박 대응</div>{plan.objections.map((o, i) => <div key={i} style={{ padding: 10, background: C.bg, borderRadius: 8, marginBottom: 7, fontSize: "calc(var(--s,1.3)*15px)", lineHeight: 1.7 }}><b style={{ color: C.warn }}>{o[0]}</b><br />{o[1]}</div>)}</Card><TextBlock title="2차 마무리 멘트" text={plan.close} copy /><TextBlock title="예상 수임료 범위" text={plan.fee} /></>}{stage === "m3" && <><TextBlock title="클로징 목표" text={plan.goal} /><TextBlock title="클로징 전략" text={plan.strategy} copy /><TextBlock title="제안 구성" text={plan.proposal} copy /><TextBlock title="가격 저항 대응" text={plan.priceTalk} copy /><TextBlock title="보류 대응" text={plan.holdTalk} copy /><TextBlock title="계약서 발송 카톡" text={plan.contractKakao} copy /></>}</div></div>
      {item.cretopCore ? acc("cretopCore", "🔢 크레탑 핵심지표 (저장됨)", false, <CretopCoreView core={item.cretopCore} />) : null}
      {acc("reco", "🎯 제안 우선순위 TOP 3", true, <div style={{ display: "grid", gap: 10 }}>{topRecommendations(item).map((r, i) => <div key={i} style={{ padding: 14, background: C.bg, borderRadius: 12 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}><b style={{ fontSize: "calc(var(--s,1.3)*17px)" }}>{i + 1}. {r.name}</b><Badge color={r.needTaxPro ? C.warn : C.ok} bg={r.needTaxPro ? C.warnBg : C.greenBg}>{r.needTaxPro ? "세무사 검토 권장" : "컨설턴트 설명 가능"}</Badge></div><div style={{ color: C.textS, fontSize: "calc(var(--s,1.3)*15px)", marginTop: 8, lineHeight: 1.6 }}>· 추천 이유: {r.reason}</div><div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*15px)", marginTop: 4, lineHeight: 1.6 }}>· 확인자료: {r.docs.join(", ")}</div><div style={{ color: C.warn, fontSize: "calc(var(--s,1.3)*15px)", marginTop: 4, lineHeight: 1.6 }}>· 주의: {r.risk}</div><div style={{ color: C.textS, fontSize: "calc(var(--s,1.3)*15px)", marginTop: 4, lineHeight: 1.6 }}>· 쉬운 설명: {r.pitch}</div></div>)}</div>)}
      {acc("report", "📝 미팅 준비 리포트", false, <><div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}><button style={btnP} onClick={() => copyText(buildMeetingReport(item), () => showToast("미팅 리포트를 복사했습니다."))}>📋 미팅 리포트 복사</button><button style={btnS} onClick={() => copyText(buildKakaoSet(item)[2][1], () => showToast("복사되었습니다."))}>💬 카톡 문구 복사</button><button style={btnS} onClick={() => copyText(buildDocRequestText(item), () => showToast("복사되었습니다."))}>📄 확인자료 요청 문구 복사</button></div><div style={{ whiteSpace: "pre-line", color: C.textS, fontSize: "calc(var(--s,1.3)*16px)", lineHeight: 1.8, background: C.card2, border: `1px solid ${C.bdr}`, borderRadius: 12, padding: 16 }}>{buildMeetingReport(item)}</div></>)}
      {acc("kakao", "💬 상황별 후속 카톡 3종", false, <div style={{ display: "grid", gap: 10 }}>{buildKakaoSet(item).map((k, i) => <TextBlock key={i} title={k[0]} text={k[1]} copy />)}</div>)}
      {acc("pkg", "📦 추천 상품 패키지 TOP 3", false, <div style={{ display: "grid", gap: 10 }}>{matchedPkgs.map((m, i) => <div key={i} style={{ padding: 14, background: C.bg, borderRadius: 12 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}><b style={{ fontSize: "calc(var(--s,1.3)*16px)" }}>{i + 1}. {m.pkg.name}</b><Badge color={C.blue} bg={C.blueBg}>{m.pkg.cat}</Badge></div><div style={{ color: C.textS, fontSize: "calc(var(--s,1.3)*14px)", marginTop: 6, lineHeight: 1.6 }}>· 추천 이유: {m.reason}</div><div style={{ color: C.textS, fontSize: "calc(var(--s,1.3)*14px)", marginTop: 3, lineHeight: 1.6 }}>· 대표님 설명: {m.pkg.simple}</div><div style={{ display: "flex", gap: 6, marginTop: 8 }}><button style={btnSm} onClick={() => copyText(m.pkg.kakao, () => showToast("복사되었습니다."))}>후속 카톡 복사</button></div></div>)}</div>)}
      {acc("contract", "✅ 계약 준비 체크리스트", false, <div style={{ display: "grid", gap: 6 }}>{CONTRACT_CHECKLIST.map((c, i) => { const checked = (item.contractChecklist || {})[i]; return <button key={i} onClick={() => updateCust(data, setData, item.id, { contractChecklist: { ...(item.contractChecklist || {}), [i]: !checked } })} style={{ display: "flex", alignItems: "center", gap: 10, textAlign: "left", background: C.bg, border: "1px solid " + C.bdr, borderRadius: 10, padding: "10px 12px", cursor: "pointer", fontFamily: FF, color: checked ? C.ok : C.textS, fontSize: "calc(var(--s,1.3)*15px)" }}><span style={{ fontSize: "calc(var(--s,1.3)*18px)" }}>{checked ? "☑" : "☐"}</span>{c}</button>; })}</div>)}
    </div>}
  </div>;
}

// ── 공통 분류체계(컨설팅 상품/콘텐츠/교육/절세전략 통일) ───────────────────
const UNIFIED_CATS = [
  { key: "인증·연구소", desc: "연구소·벤처·메인비즈·이노비즈·ISO 등 기업 신뢰도·인증 관련" },
  { key: "자금·지원금", desc: "정책자금·보증·고용지원금·정부지원사업 등 외부 자금·지원사업" },
  { key: "세무·정관", desc: "법인세·정관·임원보수·배당·가지급금·이익잉여금 등 세무·규정" },
  { key: "승계·지분", desc: "가업승계·주식가치·지분구조·증여 등 승계·지분 관련" },
  { key: "복지·노무", desc: "근로계약·취업규칙·복지·사내근로복지기금 등 노무·복지" },
  { key: "보험·퇴직금", desc: "대표 퇴직금·법인보험·목적자금 등 보험·퇴직 재원" },
  { key: "지식재산·브랜딩", desc: "특허·상표·디자인·ESG·신뢰도 자료·브랜딩" },
  { key: "신용·보증·성장지원", desc: "기업 신용등급·보증·대출·성장지원사업 등" },
];
const CONTENT_CAT_MAP = { "정관정비": "세무·정관", "가지급금": "세무·정관", "법인세": "세무·정관", "미처분이익잉여금": "세무·정관", "가업승계": "승계·지분", "연구소": "인증·연구소", "고용지원금": "자금·지원금", "정책자금": "자금·지원금" };
function contentCat(seed) { if (UNIFIED_CATS.some((u) => u.key === seed.cat)) return seed.cat; return CONTENT_CAT_MAP[seed.cat] || "세무·정관"; }
const EDU_CAT_MAP = { "가업승계": "승계·지분", "가지급금": "세무·정관", "미처분이익잉여금": "세무·정관", "정관정비": "세무·정관", "법인세": "세무·정관", "종소세": "세무·정관", "세액공제": "인증·연구소", "법인보험": "보험·퇴직금", "정책자금": "자금·지원금", "고용지원금": "자금·지원금", "인증": "인증·연구소", "판례/예규": "세무·정관", "기타": "세무·정관" };
function eduCat(e) { return e.cat || EDU_CAT_MAP[e.field] || "세무·정관"; }
const EDU_LEVELS = ["입문", "실무", "심화"];
const EDU_AUDIENCE = ["초보 컨설턴트", "경력 컨설턴트", "고객 설명용"];
// 절세전략 라이브러리(상담 전 점검용 참고 — 세무 판단 대체 아님)
const TAX_STRAT_DEFS = [
  ["미처분이익잉여금 정리 전략", "세무·정관", "tax", "누적 이익잉여금 규모와 정리 방향(배당·소각 등)을 자료 기준으로 검토합니다.", "이익이 꾸준히 나고 이익잉여금이 쌓인 법인", "이익잉여금이 어느 정도 쌓여 있는지, 배당이나 정리 계획을 생각해보신 적 있으신가요?", ["재무제표", "주주명부", "정관"], "정리 방식·세무 영향은 세무사 검토 권장, 적용 여부는 세부 요건 확인 필요"],
  ["정관 정비 및 임원보수 규정 점검", "세무·정관", "tax", "정관·임원 보수·상여 지급근거를 정비해 손금 처리 근거를 점검합니다.", "설립 후 정관·임원규정을 점검한 적 없는 법인", "정관이나 임원 보수·상여 규정을 최근에 점검해보신 적이 있으신가요?", ["정관", "이사회 의사록", "급여 지급 내역"], "지급근거·한도는 세부 요건 확인 필요, 세무사 검토 권장"],
  ["임원퇴직금 규정 점검", "보험·퇴직금", "tax", "임원퇴직금 규정과 지급근거·재원을 점검·정비합니다.", "임원퇴직금 규정·재원이 불명확한 법인", "임원 퇴직금 규정과 재원 마련은 어떻게 보고 계신가요?", ["정관", "임원퇴직금 규정", "재무제표"], "지급배수·재원은 세부 요건 확인 필요, 세무사 검토 권장"],
  ["가지급금 정리 전략", "세무·정관", "tax", "가지급금 규모·원인을 확인하고 정리 방향(상환·배당·퇴직금 등)을 검토합니다.", "대표 가지급금이 누적된 법인", "대표님과 법인 간 자금 거래(가지급금)가 어느 정도인지 파악하고 계신가요?", ["계정별원장", "대표자 거래 내역", "재무제표"], "정리 방식은 세무사 검토 권장, 자료 확인 후 판단"],
  ["가수금 출자전환 검토", "세무·정관", "tax", "대표 가수금 규모·원인을 확인하고 정리·출자전환 방향을 검토합니다.", "대표 가수금이 있는 법인", "대표님이 법인에 빌려준 자금(가수금) 정리 계획이 있으신가요?", ["계정별원장", "주주명부", "재무제표"], "출자전환 영향은 세무사 검토 권장, 세부 요건 확인 필요"],
  ["배당정책/차등배당 검토", "승계·지분", "tax", "배당 여력과 주주 구성을 기준으로 배당정책 방향을 검토합니다.", "이익잉여금이 누적된 다주주 법인", "배당을 정기적으로 하고 계신가요? 주주 구성은 어떻게 되시나요?", ["재무제표", "주주명부", "정관"], "차등배당 적용 여부는 세부 요건 확인 필요, 세무사 검토 권장"],
  ["자기주식/이익소각 검토", "승계·지분", "tax", "자기주식 취득·이익소각 절차와 세무 영향을 검토합니다.", "주식가치·이익잉여금 관리가 필요한 법인", "주식가치나 이익잉여금 관리를 생각해보신 적 있으신가요?", ["재무제표", "주주명부", "정관"], "절차·세무 영향은 세무사 검토 권장, 적용 여부는 세부 요건 확인 필요"],
  ["주식가치 평가 및 사전 증여 검토", "승계·지분", "succ", "비상장주식 가치를 평가해 승계·증여·주식이동 판단 기준을 만듭니다.", "승계·증여를 염두에 둔 법인", "주식가치를 평가해보신 적이 있으신가요? 증여를 생각 중이신가요?", ["재무제표", "주주명부", "가족 현황"], "평가·증여 시점은 세무사 검토 권장, 세부 요건 확인 필요"],
  ["가업승계 증여특례 검토", "승계·지분", "succ", "승계 요건·주식가치·정관을 사전에 점검합니다.", "대표 고령·자녀 경영 참여 법인", "자녀 승계나 가업승계를 염두에 두고 계신가요? 가족 임직원이 있으신가요?", ["주주명부", "가족 임직원 현황", "재무제표"], "특례·공제 요건은 세무사 검토 권장, 적용 여부는 세부 요건 확인 필요"],
  ["사내근로복지기금 검토", "복지·노무", "labor", "직원 복지·장기근속과 비용처리를 함께 보는 제도화 관점에서 검토합니다.", "직원 수가 있고 복지·이탈이 고민인 법인", "직원 복지나 장기근속 유도에서 신경 쓰시는 부분이 있으신가요?", ["급여대장", "재무제표", "직원 현황"], "설립 요건·운영은 세부 요건 확인 필요, 세무사 검토 권장"],
  ["법인전환 검토", "세무·정관", "tax", "개인기업의 법인전환 타당성을 자료 기준으로 검토합니다.", "성장 중인 개인사업자", "법인전환을 생각해보신 적이 있으신가요? 현재 매출·이익 흐름은 어떠신가요?", ["재무제표", "사업 현황", "자산 목록"], "전환 타당성은 자료 확인 후 판단, 세무사 검토 권장"],
  ["개인사업자 법인전환 실무", "세무·정관", "tax", "법인 설립·자산 이전·세무 처리 등 전환 실무 절차를 정리합니다.", "법인전환을 결정한 개인사업자", "법인전환을 진행한다면 자산 이전이나 일정은 어떻게 보고 계신가요?", ["재무제표", "자산 목록", "사업자등록증"], "이전 방식·세무는 세무사 검토 권장, 세부 요건 확인 필요"],
  ["법인세 신고 전 사전 점검", "세무·정관", "tax", "결산·신고 전 손금·공제·리스크 항목을 사전에 점검합니다.", "결산·법인세 신고를 앞둔 법인", "결산이나 법인세 신고 전에 미리 점검해보고 싶은 부분이 있으신가요?", ["재무제표", "계정별원장", "전기 신고서"], "공제·손금 적용은 세무사 검토 권장, 세부 요건 확인 필요"],
  ["세무조사 리스크 점검", "세무·정관", "tax", "거래·계정 구조에서 세무조사 관점의 리스크 항목을 사전 점검합니다.", "거래 규모가 커지는 법인", "거래 규모가 커지면서 세무 리스크가 걱정되는 부분이 있으신가요?", ["재무제표", "계정별원장", "주요 거래내역"], "리스크 판단은 세무사 검토 권장, 자료 확인 후 판단"],
  ["연구인력개발비 세액공제 검토", "인증·연구소", "rd", "연구개발 인력·비용 기준으로 세액공제 검토 가능성을 점검합니다.", "연구개발 인력·활동이 있는 제조·IT 법인", "연구개발 인력이나 개발 활동이 있으신가요? 연구소는 있으신가요?", ["연구개발 인력 현황", "연구개발비 자료", "재무제표"], "공제 요건·증빙은 세부 요건 확인 필요, 세무사 검토 권장"],
  ["통합고용세액공제 검토", "자금·지원금", "employ", "최근 채용·고용 증감 기준으로 고용 관련 세액공제 검토 가능성을 점검합니다.", "직원이 있고 최근 채용·변동이 있는 법인", "최근 채용이나 직원 인원 변동이 있으셨나요?", ["4대보험 가입자명부", "최근 입사자 명단", "급여대장"], "요건·신청 시점은 세부 요건 확인 필요, 세무사 검토 권장"],
  ["투자세액공제 검토", "세무·정관", "tax", "설비·시설 투자 기준으로 투자 관련 세액공제 검토 가능성을 점검합니다.", "설비·시설 투자가 있는 법인", "최근이나 향후 설비·시설 투자 계획이 있으신가요?", ["투자 내역", "재무제표", "고정자산 명세"], "공제 대상·요건은 세부 요건 확인 필요, 세무사 검토 권장"],
  ["임원상여/성과급 규정 점검", "복지·노무", "tax", "임원 상여·성과급 지급근거를 규정으로 점검합니다.", "임원 상여·성과급 지급이 있는 법인", "임원 상여나 성과급 지급 근거(규정)는 마련되어 있으신가요?", ["정관", "이사회 의사록", "급여 지급 내역"], "손금 처리 근거는 세부 요건 확인 필요, 세무사 검토 권장"],
  ["가족 임직원 급여 적정성 점검", "복지·노무", "labor", "가족 임직원 급여의 적정성과 근거를 점검합니다.", "가족이 임직원으로 재직 중인 법인", "가족분이 임직원으로 계신가요? 급여 지급 근거는 어떻게 두고 계신가요?", ["급여대장", "근로계약서", "가족 임직원 현황"], "적정성은 자료 확인 후 판단, 세무사 검토 권장"],
  ["관계사 거래/특수관계자 거래 점검", "세무·정관", "tax", "관계사·특수관계자 간 거래 구조의 리스크를 점검합니다.", "관계사·특수관계자 거래가 있는 법인", "관계사나 특수관계자와의 거래가 있으신가요?", ["거래내역", "관계사 현황", "재무제표"], "거래 적정성은 세무사 검토 권장, 세부 요건 확인 필요"],
  ["대표 가지급금·대여금 점검", "세무·정관", "tax", "대표 가지급금·대여금 규모와 정리 방향을 점검합니다.", "대표 대여금·가지급금이 있는 법인", "대표님 대여금이나 가지급금 정리를 생각해보신 적 있으신가요?", ["계정별원장", "대표자 거래 내역", "재무제표"], "정리 방식은 세무사 검토 권장, 자료 확인 후 판단"],
  ["퇴직연금/법인보험 리모델링 검토", "보험·퇴직금", "insure", "기존 퇴직연금·법인보험 구조를 점검해 정리 방향을 검토합니다.", "기존 퇴직연금·법인보험이 있는 법인", "기존 퇴직연금이나 법인보험을 점검해보신 적이 있으신가요?", ["기존 보험/퇴직연금 내역", "재무제표", "급여대장"], "상품 조건은 자료 확인 후 판단, 청약 전 상품설명서·전문가 설명 확인 필요"],
  ["이익잉여금과 대표 목적자금 설계", "보험·퇴직금", "insure", "이익잉여금·퇴직금 재원 관점에서 대표 목적자금 흐름을 설계합니다.", "이익잉여금이 쌓이고 대표 목적자금이 필요한 법인", "대표님 퇴직금이나 목적자금 재원은 어떻게 보고 계신가요?", ["재무제표", "정관", "기존 보험/퇴직연금 내역"], "설계는 고객 현금흐름 확인 필요, 세무사·전문가 검토 권장"],
  ["부동산 취득/보유 관련 법인 구조 점검", "세무·정관", "tax", "부동산 취득·보유 시 법인 구조·세무 영향을 점검합니다.", "부동산 취득·보유를 검토하는 법인", "법인 명의 부동산 취득이나 보유를 검토 중이신가요?", ["등기부등본", "재무제표", "자금 계획"], "취득·보유 세무는 세무사 검토 권장, 세부 요건 확인 필요"],
  ["자본금/주주구성 변경 전 세무 영향 점검", "승계·지분", "succ", "증자·주주구성 변경 전 세무 영향을 사전 점검합니다.", "증자·주주변경을 검토하는 법인", "증자나 주주 구성 변경을 검토 중이신가요?", ["주주명부", "정관", "재무제표"], "변경 영향은 세무사 검토 권장, 세부 요건 확인 필요"],
];
function buildTaxStrategies() { return TAX_STRAT_DEFS.map((d, i) => ({ id: "tax" + i, name: d[0], cat: d[1], topic: d[2], concept: d[3], who: d[4], question: d[5], docs: d[6], caution: d[7], ment: `대표님, ${d[0].replace(/ 검토| 전략| 점검| 실무/g, "")} 관련해서 ${d[6].slice(0, 2).join(", ")}를 먼저 확인해보고 검토 가능성과 우선순위를 정리드리겠습니다. (적용 여부는 세부 요건 확인 필요, 세무사 검토 권장)` })); }
const TAX_STRATEGIES = buildTaxStrategies();
function strategyKakao(c, strat) { const name = getCompanyName(c) || c.name || "대표님"; return `${name} 대표님, ${strat.name.replace(/ 검토| 전략| 점검| 실무/g, "")} 관련해서 점검해보면 좋을 부분이 있어 연락드립니다. 바로 결론을 내리기보다 자료 확인 후 적용 여부와 우선순위를 정리해보겠습니다. (적용 여부는 세부 요건 확인 필요, 세무사 검토 권장)`; }
function relatedCountForTopics(data, keys) { const m = new Set(); keys.forEach((k) => relatedCustomersForTopic(data, k, 50).forEach((r) => m.add(r.c.id))); return m.size; }
function contentConvert(seed) {
  return {
    blog: `${seed.title}｜대표님이 놓치기 쉬운 체크포인트`, youtube: seed.title.slice(0, 48),
    insta: `${seed.hook}\n\n해당된다면 지금은 실행보다 점검이 먼저입니다.`,
    script: `대표님, ${seed.hook}\n많은 분들이 이걸 당장 절세나 지원금으로만 보시는데, 실제로는 순서와 자료 확인이 더 중요합니다.\n${seed.cta}\n궁금하시면 댓글이나 메시지로 회사 상황을 남겨주세요.`,
    cta: `댓글에 '${seed.cat}' 남겨주시면 대표님 회사 기준으로 먼저 확인할 항목을 정리해드리겠습니다.`,
    bridge: `이 콘텐츠를 보고 문의한 고객에게는 "대표님 회사가 실제로 해당되는지는 자료를 봐야 하니 1차로 현재 상황만 확인해보자"는 흐름으로 미팅을 잡습니다.`,
    short: `대표님, 최근 ${seed.cat} 관련해서 점검해보면 좋을 부분이 있어 연락드립니다. ${seed.hook} 바로 결론을 내리기보다 자료 확인 후 적용 가능성을 함께 점검해보시길 권드립니다.`,
  };
}
// 공통 카테고리 라이브러리(검색 + 카테고리 필터 + 대표 N + 카테고리 아코디언 + 압축 카드)
function CatLibrary({ screenKey, data, setData, intro, items, getCat, getText, topItems, topTitle, headerRight, CardComp, minCard }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("전체");
  const present = UNIFIED_CATS.filter((uc) => items.some((it) => getCat(it) === uc.key));
  const filtered = items.filter((it) => (cat === "전체" || getCat(it) === cat) && (!q.trim() || getText(it).includes(q.trim())));
  const searching = !!q.trim() || cat !== "전체";
  const mw = minCard || 320;
  const grid = (arr) => <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill,minmax(${mw}px,1fr))`, gap: 12 }}>{arr.map((it, i) => <CardComp key={it.id || it._k || i} item={it} data={data} setData={setData} />)}</div>;
  return <div>
    {intro}
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}><input style={{ ...inp, flex: 1, minWidth: 220, marginBottom: 0 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 제목·카테고리·내용 검색" />{q.trim() && <button style={btnSm} onClick={() => setQ("")}>✕</button>}{headerRight}</div>
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{["전체", ...present.map((p) => p.key)].map((c) => <PillButton key={c} active={cat === c} onClick={() => setCat(c)}>{c}</PillButton>)}</div><span style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*14px)", fontWeight: 700 }}>전체 {items.length}개{searching ? ` · ${filtered.length}개` : ""}</span></div>
    {!searching && topItems && topItems.length ? <Card style={{ padding: 14, marginBottom: 12, background: C.blueBg, border: `1px solid ${C.blue}30` }}><div style={{ fontWeight: 800, color: C.blue, fontSize: "calc(var(--s,1.3)*15px)", marginBottom: 8 }}>{topTitle}</div>{grid(topItems)}</Card> : null}
    {searching ? (filtered.length ? grid(filtered) : <Card style={{ padding: 28, textAlign: "center", color: C.textM, fontSize: "calc(var(--s,1.3)*15px)" }}>검색·필터 결과가 없습니다.</Card>)
      : <div>{present.map((uc) => { const arr = items.filter((it) => getCat(it) === uc.key); return <AccordionSection key={uc.key} data={data} setData={setData} screenKey={screenKey} sectionKey={"cat_" + uc.key} title={uc.key} subtitle={uc.desc} count={arr.length} defaultOpen={false}>{grid(arr)}</AccordionSection>; })}</div>}
  </div>;
}
function ContentCard({ item, data, setData }) {
  const [open, setOpen] = useState(false); const seed = item; const cat = contentCat(seed);
  const keys = classifyTopicsFromText(`${seed.cat} ${seed.title}`); const n = relatedCountForTopics(data, keys); const cv = contentConvert(seed);
  return <Card style={{ padding: 14 }}>
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}><Badge color={C.sky} bg={C.blueBg}>{cat}</Badge>{n > 0 && <Badge color={C.gold} bg="#FCEFDA">관련 고객 {n}</Badge>}</div>
    <h3 style={{ margin: "8px 0 6px", fontSize: "calc(var(--s,1.3)*17px)", lineHeight: 1.4 }}>{seed.title}</h3>
    <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*13px)", marginBottom: 4 }}>대상: {seed.target}</div>
    <div style={{ color: C.textS, fontSize: "calc(var(--s,1.3)*14px)", lineHeight: 1.6 }}>후킹: {seed.hook}</div>
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}><button style={btnSm} onClick={() => setOpen((o) => !o)}>{open ? "접기" : "자세히"}</button><button style={btnSm} onClick={() => copyText(cv.short, () => showToast("카톡 문구를 복사했습니다."))}>💬 카톡 복사</button></div>
    {open && <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
      <TextBlock title="블로그 제목" text={cv.blog} copy /><TextBlock title="유튜브 쇼츠 제목" text={cv.youtube} copy /><TextBlock title="인스타 릴스 문구" text={cv.insta} copy /><TextBlock title="상담 전환 멘트(CTA)" text={cv.cta} copy /><TextBlock title="미팅 연결 멘트" text={cv.bridge} copy />
      <RelatedTopicBlock data={data} setData={setData} text={`${seed.cat} ${seed.title}`} title="이 주제로 연락할 고객" />
    </div>}
  </Card>;
}
function EduCard({ item, data, setData }) {
  const [open, setOpen] = useState(false); const e = item; const cat = eduCat(e); const digest = digestEducation(e);
  const keys = classifyTopicsFromText(`${e.title} ${e.field || ""} ${e.keywords || ""}`); const n = relatedCountForTopics(data, keys);
  const learn = e.purpose || (digest.summary || "").slice(0, 50);
  return <Card style={{ padding: 14 }}>
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}><Badge color={C.sky} bg={C.blueBg}>{cat}</Badge>{e.level && <Badge color={C.purple} bg={C.purpleBg}>{e.level}</Badge>}{e.audience && <Badge color={C.textM} bg="#EEF2F7">{e.audience}</Badge>}{n > 0 && <Badge color={C.gold} bg="#FCEFDA">관련 고객 {n}</Badge>}</div>
    <h3 style={{ margin: "8px 0 6px", fontSize: "calc(var(--s,1.3)*17px)", lineHeight: 1.4 }}>{e.title}</h3>
    <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*13px)", marginBottom: 4 }}>{e.date} · {e.instructor || "강사 미입력"}</div>
    <div style={{ color: C.textS, fontSize: "calc(var(--s,1.3)*14px)", lineHeight: 1.6 }}>핵심 배울 점: {learn || "요약 미입력"}</div>
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}><button style={btnSm} onClick={() => setOpen((o) => !o)}>{open ? "접기" : "자세히"}</button><button style={btnSm} onClick={() => copyText(`[교육 메모] ${e.title}\n${digest.summary}\n활용 멘트: ${e.useMent || digest.simple}`, () => showToast("교육 메모를 복사했습니다."))}>📋 교육 메모 복사</button></div>
    {open && <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
      <TextBlock title="교육 요약" text={digest.summary} copy /><TextBlock title="고객 상담 활용 포인트" text={e.useMent || digest.simple} copy />{e.link ? <div style={{ fontSize: "calc(var(--s,1.3)*13px)" }}>참고 링크: <a href={e.link} target="_blank" rel="noopener noreferrer" style={{ color: C.sky }}>{e.link}</a></div> : null}<TextBlock title="카톡 후속 문구" text={digest.kakao} copy />
      <RelatedTopicBlock data={data} setData={setData} text={`${e.title} ${e.field || ""} ${e.keywords || ""}`} title="이 교육을 적용해볼 고객" />
    </div>}
  </Card>;
}
function StratCard({ item, data, setData }) {
  const [open, setOpen] = useState(false); const [prepId, setPrepId] = useState(null); const s = item;
  const rel = relatedCustomersForTopic(data, s.topic, 50); const pkgs = topicPackages(PROPOSAL_TOPICS.find((t) => t.key === s.topic) || { pkgCats: [] }, data);
  return <Card style={{ padding: 14 }}>
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}><Badge color={C.sky} bg={C.blueBg}>{s.cat}</Badge><Badge color={C.warn} bg={C.warnBg}>세무사 검토 권장</Badge>{rel.length > 0 && <Badge color={C.gold} bg="#FCEFDA">관련 고객 {rel.length}</Badge>}</div>
    <h3 style={{ margin: "8px 0 6px", fontSize: "calc(var(--s,1.3)*17px)", lineHeight: 1.4 }}>{s.name}</h3>
    <div style={{ color: C.textS, fontSize: "calc(var(--s,1.3)*14px)", lineHeight: 1.6 }}>어떤 고객에게: {s.who}</div>
    <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*13px)", marginTop: 3 }}>핵심 질문: {s.question}</div>
    <div style={{ color: C.warn, fontSize: "calc(var(--s,1.3)*12px)", marginTop: 3, lineHeight: 1.5 }}>주의: {s.caution}</div>
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}><button style={btnSm} onClick={() => setOpen((o) => !o)}>{open ? "접기" : "자세히"}</button><button style={btnSm} onClick={() => copyText(s.ment, () => showToast("상담 멘트를 복사했습니다."))}>💬 상담 멘트 복사</button></div>
    {open && <div style={{ marginTop: 12, display: "grid", gap: 8, fontSize: "calc(var(--s,1.3)*14px)", color: C.textS, lineHeight: 1.7 }}>
      <div><b>개념 요약</b> · {s.concept}</div>
      <div><b>필요한 자료</b> · {s.docs.join(", ")}</div>
      <div><b>연결 가능한 컨설팅 상품</b> · {pkgs.map((p) => p.name).join(", ") || "관련 상품 확인 필요"}</div>
      <TextBlock title="후속 카톡 문구" text={rel[0] ? strategyKakao(rel[0].c, s) : strategyKakao({ name: "" }, s)} copy />
      <div style={{ background: C.bg, borderRadius: 10, padding: 12 }}><div style={{ fontWeight: 800, color: C.gold, fontSize: "calc(var(--s,1.3)*14px)", marginBottom: 8 }}>🔗 관련 가능성 있는 고객 ({rel.length})</div>{rel.length === 0 ? <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*13px)" }}>관련 고객이 등록되면 자동 표시됩니다.</div> : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 8 }}>{rel.slice(0, 6).map((r) => <ProposalCustomerCard key={r.c.id} r={r} data={data} setData={setData} onPrep={setPrepId} />)}</div>}</div>
      <ContractPrepPack open={!!prepId} initialId={prepId} data={data} setData={setData} onClose={() => setPrepId(null)} />
    </div>}
  </Card>;
}
function StrategyLibrary({ data, setData }) {
  const intro = <>
    <h2 style={{ margin: "0 0 4px", fontSize: "calc(var(--s,1.3)*22px)" }}>📚 절세전략 라이브러리</h2>
    <p style={{ color: C.textS, fontSize: "calc(var(--s,1.3)*15px)", lineHeight: 1.65, margin: "0 0 6px" }}>절세전략은 세무 판단을 대신하는 기능이 아니라, 고객 상담 전 점검할 <b>세무·정관·자금 흐름 이슈를 정리하는 참고 라이브러리</b>입니다.</p>
    <div style={{ background: C.warnBg, border: `1px solid ${C.warn}40`, borderRadius: 8, padding: "8px 10px", color: C.textS, fontSize: "calc(var(--s,1.3)*13px)", lineHeight: 1.6, marginBottom: 8 }}>모든 항목은 “검토 가능성” 기준이며 <b>세무사 검토 권장</b>입니다. 적용 여부는 세부 요건 확인이 필요합니다.</div>
  </>;
  return <CatLibrary screenKey="strategies" data={data} setData={setData} intro={intro} items={TAX_STRATEGIES} getCat={(s) => s.cat} getText={(s) => `${s.name} ${s.cat} ${s.who} ${s.concept} ${s.question}`} topItems={TAX_STRATEGIES.slice(0, 5)} topTitle="⭐ 대표 전략 5개" CardComp={StratCard} minCard={340} />;
}

function EducationArchive({ data, setData }) {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const items = data.educationItems || [];
  const empty = { title: "", date: todayISO(), instructor: "", cat: "세무·정관", field: "가업승계", level: "실무", audience: "경력 컨설턴트", purpose: "", useMent: "", link: "", importance: "medium", keywords: "", transcript: "" };
  const [form, setForm] = useState(empty);
  function openForm(item) { setEdit(item || null); setForm(item ? { ...empty, ...item } : empty); setOpen(true); }
  function saveItem() { if (!form.title.trim()) { showToast("교육 제목을 입력해주세요."); return; } const item = { ...form, id: form.id || uid() }; const exists = items.some((x) => x.id === item.id); setData({ ...data, educationItems: exists ? items.map((x) => x.id === item.id ? item : x) : [item, ...items] }); setOpen(false); showToast("교육 자료를 저장했습니다."); }
  const intro = <><div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 4 }}><h2 style={{ margin: 0, fontSize: "calc(var(--s,1.3)*22px)" }}>🎓 교육 아카이브 · 나만의 교육 보관소</h2><button style={btnP} onClick={() => openForm(null)}>+ 교육 자료 등록</button></div><p style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*15px)", lineHeight: 1.6, margin: "0 0 8px" }}>배운 교육을 카테고리·난이도·활용 멘트로 정리해 <b>내 컨설팅 교육 자산</b>으로 쌓고, 고객 상담·제안으로 연결합니다.</p></>;
  const modal = <Modal open={open} onClose={() => setOpen(false)} title={edit ? "교육 수정" : "교육 자료 등록"} width={840}><div style={{ display: "grid", gap: 12 }}>
    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}><div><Label>교육 제목 *</Label><input style={inp} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div><div><Label>교육일</Label><input type="date" style={inp} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div><div><Label>강사명</Label><input style={inp} value={form.instructor} onChange={(e) => setForm({ ...form, instructor: e.target.value })} /></div></div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}><div><Label>카테고리</Label><select style={inp} value={form.cat} onChange={(e) => setForm({ ...form, cat: e.target.value })}>{UNIFIED_CATS.map((u) => <option key={u.key}>{u.key}</option>)}</select></div><div><Label>난이도</Label><select style={inp} value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>{EDU_LEVELS.map((x) => <option key={x}>{x}</option>)}</select></div><div><Label>대상</Label><select style={inp} value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>{EDU_AUDIENCE.map((x) => <option key={x}>{x}</option>)}</select></div></div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}><div><Label>세부 분야(태그)</Label><select style={inp} value={form.field} onChange={(e) => setForm({ ...form, field: e.target.value })}>{EDUCATION_FIELDS.map((x) => <option key={x}>{x}</option>)}</select></div><div><Label>키워드</Label><input style={inp} value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} placeholder="가업승계, 주식가치..." /></div></div>
    <div><Label>교육 목적 · 핵심 배울 점</Label><input style={inp} value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} placeholder="이 교육에서 배운 핵심 한 줄" /></div>
    <div><Label>고객 상담에 활용할 멘트</Label><textarea style={{ ...inp, height: 70, resize: "vertical" }} value={form.useMent} onChange={(e) => setForm({ ...form, useMent: e.target.value })} placeholder="상담에서 이렇게 꺼낸다 — 비단정 톤" /></div>
    <div><Label>참고 링크</Label><input style={inp} value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="https://" /></div>
    <div><Label>교육 원문/녹취·메모</Label><textarea style={{ ...inp, height: 160, resize: "vertical" }} value={form.transcript} onChange={(e) => setForm({ ...form, transcript: e.target.value })} placeholder="교육 녹취나 핵심 메모를 붙여넣으세요." /></div>
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button style={btnS} onClick={() => setOpen(false)}>취소</button><button style={btnP} onClick={saveItem}>저장</button></div>
  </div></Modal>;
  if (items.length === 0) return <div>{intro}<Card style={{ padding: 36, textAlign: "center" }}><p style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*16px)", lineHeight: 1.7, marginBottom: 14 }}>아직 등록된 교육 자료가 없습니다. 교육을 등록하면 카테고리별 교육 보관소가 만들어지고, 관련 고객과 자동 연결됩니다.</p><div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}><button style={btnP} onClick={() => openForm(null)}>+ 교육 자료 등록</button></div><div style={{ marginTop: 12 }}><SampleCTA data={data} setData={setData} /></div></Card>{modal}</div>;
  return <div><CatLibrary screenKey="education" data={data} setData={setData} intro={intro} items={items} getCat={eduCat} getText={(e) => `${e.title} ${eduCat(e)} ${e.field || ""} ${e.keywords || ""} ${e.purpose || ""}`} topItems={items.slice(0, 3)} topTitle="🆕 최근 등록 교육 3개" CardComp={EduCard} minCard={320} />{modal}</div>;
}

function UpdatesCenter({ data, setData, setTab }) {
  const IMPACT = { high: ["높음", C.err, C.redBg], medium: ["보통", C.gold, C.warnBg], low: ["낮음", C.blue, C.blueBg] };
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const empty = { title: "", source: "국세청", date: todayISO(), field: "가업승계", importance: "medium", summary: "", link: "" };
  const [form, setForm] = useState(empty);
  const items = data.lawUpdates || [];
  function saveItem() { if (!form.title.trim()) return; const item = { ...form, id: form.id || uid() }; const exists = items.some((x) => x.id === item.id); setData({ ...data, lawUpdates: exists ? items.map((x) => x.id === item.id ? item : x) : [item, ...items] }); setOpen(false); setSelected(item.id); }
  const item = items.find((x) => x.id === selected) || items[0];
  const digest = item ? digestUpdate(item, data.companies || []) : null;
  return <div><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}><div><h2 style={{ margin: 0 }}>⚖️ 법령/판례/공고 업데이트</h2><p style={{ color: C.textM, margin: "6px 0 0" }}>수동 입력 기반 업데이트를 기존 고객, 콘텐츠, 미팅 명분으로 연결합니다.</p></div><button style={btnP} onClick={() => { setForm(empty); setOpen(true); }}>+ 업데이트 등록</button></div><div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 14 }}><Card style={{ padding: 12 }}>{items.length === 0 ? <div style={{ padding: 8 }}><p style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*16px)", lineHeight: 1.7, marginTop: 0 }}>아직 등록된 업데이트가 없습니다. 샘플을 넣으면 국세청·고용노동부 공고가 관련 고객과 자동 연결됩니다.</p><SampleCTA data={data} setData={setData} /></div> : items.map((u) => { const im = IMPACT[u.importance] || IMPACT.medium; return <div key={u.id} onClick={() => setSelected(u.id)} style={{ padding: 14, borderRadius: 11, background: item?.id === u.id ? C.gold + "18" : C.bg, border: item?.id === u.id ? "1px solid " + C.gold : "1px solid " + C.bdr, marginBottom: 8, cursor: "pointer" }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}><b style={{ fontSize: 16, lineHeight: 1.4 }}>{u.title}</b><Badge color={im[1]} bg={im[2]}>영향도 {im[0]}</Badge></div><div style={{ marginTop: 7, fontSize: "calc(var(--s,1.3)*15px)", color: C.textM }}>{u.source} · {u.date} · {u.field}</div></div>; })}</Card><div>{!item ? <Card style={{ padding: 40, color: C.textM, textAlign: "center" }}>업데이트를 선택하세요.</Card> : <div style={{ display: "grid", gap: 10 }}><Card style={{ padding: 18 }}><h3 style={{ margin: 0 }}>{item.title}</h3><p style={{ color: C.textM, margin: "6px 0 0" }}>{item.source} · {item.date} · {item.field}</p></Card><TextBlock title="핵심 영향" text={digest.impact} copy /><TextBlock title="신규 신규 고객 발굴 포인트" text={digest.leadPoint} copy /><TextBlock title="콘텐츠화 아이디어" text={digest.content} copy /><TextBlock title="기존 고객 후속 연락 문구" text={digest.kakao} copy /><Card style={{ padding: 18 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}><div style={{ color: C.gold, fontWeight: 900, fontSize: 18 }}>🔔 관련 가능 고객 ({digest.related.length})</div><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button style={btnSm} onClick={() => copyText(digest.kakao, () => showToast("관련 고객 연락 문구를 복사했습니다."))}>📋 관련 고객 연락 문구 만들기</button><button style={btnSm} onClick={() => setTab && setTab("content")}>📣 콘텐츠 주제로 보내기</button></div></div>{digest.related.length === 0 ? <p style={{ color: C.textM, fontSize: 16, lineHeight: 1.7 }}>아직 연결된 고객이 없습니다. 고객사 관리에 고객 정보를 추가하면 업데이트와 자동 연결됩니다.</p> : digest.related.map((c) => <div key={c.id} style={{ padding: 14, background: C.bg, borderRadius: 11, marginBottom: 8 }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}><b style={{ fontSize: "calc(var(--s,1.3)*17px)" }}>{c.name}</b><Badge color={C.sky} bg={C.blueBg}>{c.industry}</Badge></div><div style={{ color: C.textS, fontSize: "calc(var(--s,1.3)*15px)", marginTop: 6, lineHeight: 1.6 }}>{c.reason}</div><button style={{ ...btnSm, marginTop: 10 }} onClick={() => copyText(`${c.name} 대표님, 최근 ${safe(item.field, "관련 제도")} 관련 내용(${safe(item.title, "업데이트")})이 있어 공유드립니다. 이번 내용이 바로 적용된다는 의미는 아니지만, 대표님 회사도 검토 가능성이 있어 보여 우선 점검을 권드립니다. 자료 확인 후 적용 여부를 판단해보는 게 좋겠고, 세무사 검토가 필요한 부분은 함께 안내드리겠습니다.`, () => showToast("연락 문구를 복사했습니다."))}>📋 {c.name} 연락 문구 복사</button></div>)}</Card><RelatedTopicBlock data={data} setData={setData} text={`${item.title} ${item.field} ${item.summary || ""}`} title="이 내용과 관련 가능성 있는 고객" /></div>}</div></div><Modal open={open} onClose={() => setOpen(false)} title="업데이트 등록" width={820}><div style={{ display: "grid", gap: 12 }}><div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}><div><Label>제목 *</Label><input style={inp} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div><div><Label>출처</Label><select style={inp} value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>{UPDATE_SOURCES.map((x) => <option key={x}>{x}</option>)}</select></div><div><Label>발표일</Label><input type="date" style={inp} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div></div><div><Label>분야</Label><select style={inp} value={form.field} onChange={(e) => setForm({ ...form, field: e.target.value })}>{EDUCATION_FIELDS.map((x) => <option key={x}>{x}</option>)}</select></div><div><Label>원문 요약</Label><textarea style={{ ...inp, height: 160, resize: "vertical" }} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} /></div><div><Label>링크</Label><input style={inp} value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} /></div><div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button style={btnS} onClick={() => setOpen(false)}>취소</button><button style={btnP} onClick={saveItem}>저장</button></div></div></Modal></div>;
}

function CompaniesDB({ data, setData, goMeeting, openAdd, selectId, recentId, onSelected }) {
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [q, setQ] = useState("");
  const [flt, setFlt] = useState("전체");
  const [custTab, setCustTab] = useState("잠재·신규");
  const delCompany = (id) => { if (window.confirm("이 업체의 영업 기록을 삭제할까요? 고객 운영 업체는 그대로 남습니다.")) { setData({ ...data, companies: (data.companies || []).filter((c) => c.id !== id) }); setDetail(null); showToast("고객을 삭제했습니다."); } };
  const allCompanies = data.companies || [];
  const TAB_DEFS = [["잠재·신규", (c) => c.stage !== "contracted" && pipe6Of(c.stage) !== "hold"], ["기존 계약", (c) => c.stage === "contracted"], ["전체", () => true], ["보류·장기관리", (c) => pipe6Of(c.stage) === "hold"]];
  const tabFn = (TAB_DEFS.find((t) => t[0] === custTab) || TAB_DEFS[0])[1];
  const tabList = allCompanies.filter(tabFn);
  const fObj = COMPANY_FILTERS.find((x) => x[0] === flt);
  const companies = tabList.filter((c) => (!fObj || fObj[1](c)) && matchSearch(c, q));
  const nextList = tabList.filter((c) => followStatus(c)).sort((a, b) => (a.nextDate || "").localeCompare(b.nextDate || ""));
  const empty = { name: "", corpType: "주식회사", juPosition: "앞", ceoName: "", industry: "제조업", revenue: "", empCount: "", estYears: "", ceoAge: "", stage: "lead", interests: [], nextDate: todayISO(), feePotential: "", notes: [] };
  const [form, setForm] = useState(empty);
  const [detail, setDetail] = useState(null);
  const filterActive = q.trim() || flt !== "전체";
  useEffect(() => { if (selectId) { const c = (data.companies || []).find((x) => x.id === selectId); if (c) { setDetail(c); onSelected && onSelected(); } } }, [selectId]);
  function openForm(c) { setEdit(c || null); setForm(c || empty); setOpen(true); }
  function saveCompany() { if (!form.name.trim()) return; const item = { ...form, id: form.id || uid(), manual: true, sample: false }; const exists = companies.some((x) => x.id === item.id); setData({ ...data, companies: exists ? companies.map((x) => x.id === item.id ? item : x) : [item, ...companies] }); setOpen(false); }
  function toggle(it) { setForm({ ...form, interests: (form.interests || []).includes(it) ? (form.interests || []).filter((x) => x !== it) : [...(form.interests || []), it] }); }
  return <div><div style={{ display: "flex", gap: 4, background: "#fff", border: `1px solid ${C.blue}30`, borderRadius: 12, padding: 4, flexWrap: "wrap", marginBottom: 14 }}>{TAB_DEFS.map(([t, fn]) => <button key={t} onClick={() => setCustTab(t)} aria-pressed={custTab === t} style={{ flex: "1 1 auto", minWidth: 120, padding: "10px 12px", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: FF, fontWeight: 800, fontSize: "calc(var(--s,1.3)*14px)", background: custTab === t ? C.blue : "transparent", color: custTab === t ? "#fff" : C.textS }}>{t} {allCompanies.filter(fn).length}</button>)}</div><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, gap: 12, flexWrap: "wrap" }}><p style={{ color: C.textS, margin: 0, fontSize: 16, lineHeight: 1.7, maxWidth: 660 }}>{custTab === "기존 계약" ? "계약 완료 고객을 관리합니다. 진행 중 업무·로드맵·서류·추가 제안·정기 점검을 이어갈 수 있습니다." : custTab === "보류·장기관리" ? "보류·장기관리 고객입니다. 시점을 보며 가볍게 점검을 이어가세요." : "상담이 시작되었거나 계약·관리 단계에 들어온 고객사를 관리합니다. 계약 예정, 관리 필요, 자료 요청 고객을 상태별로 확인하세요."}</p><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button style={btnP} onClick={() => openAdd && openAdd("company")}>+ 고객 등록</button></div></div><div style={{ marginBottom: 14 }}><div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}><input style={{ ...inp, flex: 1, minWidth: 220, marginBottom: 0 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 업체명, 업종, 니즈, 대표 고민으로 검색" />{q.trim() && <button style={btnSm} onClick={() => setQ("")}>✕ 검색 초기화</button>}</div><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{COMPANY_FILTERS.map((f) => <PillButton key={f[0]} active={flt === f[0]} onClick={() => setFlt(f[0])}>{f[0]}</PillButton>)}</div><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, gap: 8, flexWrap: "wrap" }}><span style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*14px)" }}>총 {allCompanies.length}개 중 <b style={{ color: C.text }}>{companies.length}개</b> 표시{flt !== "전체" ? ` · 필터: ${flt}` : ""}</span>{filterActive && <button style={btnSm} onClick={() => { setQ(""); setFlt("전체"); }}>필터 초기화</button>}</div></div><AccordionSection data={data} setData={setData} screenKey="companies" sectionKey={"next_" + custTab} title={custTab === "기존 계약" ? "🔔 정기 점검 · 다음 연락" : "🔔 다음 연락"} count={nextList.length} important defaultOpen={false}>{nextList.length === 0 ? <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*14px)", padding: 4 }}>이 그룹에 다음 연락 대상이 없습니다.</div> : <div style={{ display: "grid", gap: 6 }}>{nextList.slice(0, 12).map((c) => { const fs = followStatus(c); return <div key={c.id} onClick={() => setDetail(c)} style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap", background: C.bg, borderRadius: 9, padding: "9px 12px", cursor: "pointer" }}><b style={{ fontSize: "calc(var(--s,1.3)*15px)" }}>{getCompanyName(c) || c.name}</b><span style={{ display: "flex", gap: 6, alignItems: "center" }}>{fs && <Badge color={fs.c} bg={fs.b}>{fs.t}</Badge>}<span style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*13px)" }}>{c.nextDate || "-"}</span></span></div>; })}</div>}</AccordionSection><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(360px,1fr))", gap: 16 }}>{companies.length === 0 ? <Card style={{ padding: 40, textAlign: "center", gridColumn: "1/-1" }}>{allCompanies.length === 0 ? <><p style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*16px)", lineHeight: 1.7, marginBottom: 14 }}>고객사 관리가 비어 있습니다. 샘플 데이터를 넣거나, 신규 고객 발굴에서 잠재고객을 고객사로 전환해보세요.</p><SampleCTA data={data} setData={setData} /></> : <p style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*16px)", lineHeight: 1.7, margin: 0 }}>검색 결과가 없습니다. 다른 키워드로 검색하거나 신규 고객을 등록해보세요.</p>}</Card> : companies.map((c) => { const st = stageOf(c.stage); const strats = recommendedStrategiesFor(c); const bd = scoreBand(scoreLead(c)); const src = sourceTag(c); return <Card key={c.id} style={{ padding: 20, border: recentId === c.id ? `1px solid ${C.gold}` : "1px solid " + C.bdr }}><div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "start" }}><div><h3 style={{ margin: 0, fontSize: "calc(var(--s,1.3)*21px)" }}>{getCompanyName(c)}</h3><p style={{ color: C.textM, margin: "6px 0 0", fontSize: "calc(var(--s,1.3)*15px)" }}>{c.ceoName || "대표 미입력"} · {c.industry}</p></div><div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-end" }}><Badge color={st.color} bg={st.bg}>{st.icon} {st.label}</Badge><Badge color={src.color} bg={src.bg}>{src.label}</Badge>{recentId === c.id && <Badge color={C.gold} bg="#FCEFDA">✨ 방금 등록</Badge>}</div></div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, margin: "14px 0" }}><div><Label>매출</Label><b style={{ color: C.blue, fontSize: 18 }}>{wonFromMillion(c.revenue)}</b></div><div><Label>직원</Label><b style={{ fontSize: 18 }}>{c.empCount || "-"}명</b></div><div><Label>가능성</Label><b style={{ color: bd.color, fontSize: 18 }}>{scoreLead(c)} · {bd.short}</b></div></div><Label>주요 니즈</Label><div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "4px 0 12px" }}>{(c.interests || []).length ? (c.interests || []).slice(0, 5).map((x) => <Badge key={x} color={C.sky} bg={C.blueBg}>{x}</Badge>) : <span style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*15px)" }}>미입력</span>}</div><div style={{ fontSize: "calc(var(--s,1.3)*15px)", color: C.textM, marginBottom: 6 }}>다음 액션: {c.nextDate ? `${c.nextDate} (${ddayText(dday(c.nextDate))})` : "미정"}</div><div style={{ fontSize: "calc(var(--s,1.3)*15px)", color: C.textM, marginBottom: 14, lineHeight: 1.5 }}>추천: {strats.map((s) => s.name).join(" / ")}</div><div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}><button style={{ ...btnP, flex: 1 }} onClick={() => setDetail(c)}>📋 상세 보기</button><MoreActions label="더보기 ▾"><button style={btnS} onClick={() => goMeeting && goMeeting(c.id)}>🤝 미팅 준비 보기</button><button style={btnS} onClick={() => openAdd && openAdd("company", c, "company")}>수정</button><button style={{ ...btnSm, color: C.err }} onClick={() => delCompany(c.id)}>삭제</button></MoreActions></div></Card>; })}</div><Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? `${getCompanyName(detail)} · 고객 상세` : ""} width={900}>{detail && <div style={{ display: "grid", gap: 12 }}><CustomerPanel item={detail} data={data} setData={setData} goMeeting={(id) => { setDetail(null); goMeeting && goMeeting(id); }} /><div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}><button style={{ ...btnS, color: C.err }} onClick={() => delCompany(detail.id)}>삭제</button><button style={btnS} onClick={() => { const c = detail; setDetail(null); openAdd && openAdd("company", c, "company"); }}>정보 수정</button><button style={btnP} onClick={() => setDetail(null)}>닫기</button></div></div>}</Modal><Modal open={open} onClose={() => setOpen(false)} title={edit ? "업체 수정" : "업체 등록"} width={860}><div style={{ display: "grid", gap: 12 }}><div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}><div><Label>기업명 *</Label><input style={inp} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div><div><Label>기업형태</Label><select style={inp} value={form.corpType} onChange={(e) => setForm({ ...form, corpType: e.target.value })}><option>주식회사</option><option>유한회사</option><option>개인사업자</option><option>기타</option></select></div><div><Label>딜 단계</Label><select style={inp} value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })}>{DEAL_STAGES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></div></div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}><div><Label>대표자</Label><input style={inp} value={form.ceoName} onChange={(e) => setForm({ ...form, ceoName: e.target.value })} /></div><div><Label>업종</Label><select style={inp} value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })}>{INDUSTRIES.map((x) => <option key={x}>{x}</option>)}</select></div><div><Label>다음 액션일</Label><input type="date" style={inp} value={form.nextDate || ""} onChange={(e) => setForm({ ...form, nextDate: e.target.value })} /></div></div><div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10 }}><div><Label>매출(백만원)</Label><input type="number" style={inp} value={form.revenue} onChange={(e) => setForm({ ...form, revenue: e.target.value })} /></div><div><Label>직원</Label><input type="number" style={inp} value={form.empCount} onChange={(e) => setForm({ ...form, empCount: e.target.value })} /></div><div><Label>업력</Label><input type="number" style={inp} value={form.estYears} onChange={(e) => setForm({ ...form, estYears: e.target.value })} /></div><div><Label>대표 나이</Label><input type="number" style={inp} value={form.ceoAge} onChange={(e) => setForm({ ...form, ceoAge: e.target.value })} /></div><div><Label>예상 수임료</Label><input type="number" style={inp} value={form.feePotential} onChange={(e) => setForm({ ...form, feePotential: e.target.value })} /></div></div><div><Label>관심/이슈</Label><div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>{INTERESTS.map((it) => <PillButton key={it} active={(form.interests || []).includes(it)} onClick={() => toggle(it)}>{it}</PillButton>)}</div></div><div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button style={btnS} onClick={() => setOpen(false)}>취소</button><button style={btnP} onClick={saveCompany}>저장</button></div></div></Modal></div>;
}

// 금액(만원) 표기: 850→"850만원", 1200→"1,200만원"
function feeMoney(m) { const v = Math.round(Number(m) || 0); return v.toLocaleString() + "만원"; }
function expFee(x) { return Number(x && x.expectedFee) || 0; }
function salesMetrics(data) {
  const all = getUniqueCustomers(data);
  const thisWeek = all.filter((c) => c.nextDate && dday(c.nextDate) >= 0 && dday(c.nextDate) <= 7 && !["contracted", "lost"].includes(c.stage));
  const overdue = all.filter((c) => { const f = followStatus(c); return f && f.kind === "overdue"; });
  const review = all.filter((c) => pipeColOf(c.stage) === "decision_pending");
  const done = all.filter((c) => c.stage === "contracted");
  const feeSum = all.reduce((s, x) => s + expFee(x), 0);
  const top5 = all.map((x) => ({ x, s: scoreLead(x) })).sort((a, b) => b.s - a.s).slice(0, 5);
  const top5Fee = top5.reduce((s, o) => s + expFee(o.x), 0);
  const proposed = all.filter((c) => c.proposalStatus === "제안 완료" || c.proposedAt);
  const proposedFeeSum = proposed.reduce((s, x) => s + (Number(x.proposedFee) || expFee(x)), 0);
  const byPs = (ps) => all.filter((c) => c.proposalStatus === ps);
  const quoteSent = byPs("견적 전달"), negotiating = byPs("조건 조율"), preContract = byPs("계약 예정"), onhold = byPs("보류");
  const contractedFeeSum = all.filter((c) => c.proposalStatus === "계약 완료" || c.stage === "contracted").reduce((s, x) => s + (Number(x.proposedFee) || expFee(x)), 0);
  const quoteFeeSum = quoteSent.reduce((s, x) => s + (Number(x.proposedFee) || expFee(x)), 0);
  // 월납 보험료 기준 제안 지표(수임료와 구분)
  const monthlyProp = all.filter((c) => Number(c.proposalMonthlyPremium) > 0);
  const monthlyPremiumSum = monthlyProp.reduce((s, x) => s + (Number(x.proposalMonthlyPremium) || 0), 0);
  const projectedSum = monthlyProp.reduce((s, x) => s + (Number(x.proposalProjectedValue) || insuranceSim(x.proposalMonthlyPremium, x.proposalMonths, x.proposalRefundRate).base), 0);
  const affordN = { green: 0, yellow: 0, red: 0 };
  monthlyProp.forEach((c) => { const lv = c.proposalAffordabilityStatus; if (lv === "green" || lv === "yellow" || lv === "red") affordN[lv]++; });
  return { total: all.length, thisWeek: thisWeek.length, overdue: overdue.length, review: review.length, done: done.length, feeSum, top5Fee, proposed: proposed.length, proposedFeeSum, contractedFeeSum, quoteFeeSum, quoteSent: quoteSent.length, negotiating: negotiating.length, preContract: preContract.length, onhold: onhold.length, monthlyPropCount: monthlyProp.length, monthlyPremiumSum, projectedSum, affordN };
}
function SalesMetrics({ data }) {
  const m = salesMetrics(data);
  const cards = [["전체 고객", m.total + "명", C.text], ["이번 주 다음 연락", m.thisWeek + "명", C.blue], ["다음 연락 지연", m.overdue + "명", C.err], ["제안 완료", m.proposed + "명", C.sky], ["견적 전달", m.quoteSent + "명", C.purple], ["조건 조율", m.negotiating + "명", C.warn], ["계약 예정", m.preContract + "명", C.gold], ["계약 완료", m.done + "명", C.ok], ["보류", m.onhold + "명", C.textM], ["예상 수임료 합계(컨설팅)", feeMoney(m.feeSum), C.gold], ["계약 완료 수임료", feeMoney(m.contractedFeeSum), C.ok]];
  const monthlyCards = [["월납 제안 고객", m.monthlyPropCount + "명", C.blue], ["월납 제안액 합계(월)", feeMoney(m.monthlyPremiumSum), C.blue], ["84개월 목적자금 합계", manToText(m.projectedSum), C.gold], ["적정성 초록/노랑/빨강", `${m.affordN.green} / ${m.affordN.yellow} / ${m.affordN.red}`, C.ok]];
  const cardEl = (c) => <Card key={c[0]} style={{ flex: "1 1 140px", minWidth: 0, padding: "clamp(12px,3vw,18px)" }}><div style={{ fontSize: "calc(var(--s,1.3)*14px)", color: C.textM, fontWeight: 700 }}>{c[0]}</div><div style={{ fontSize: "calc(var(--s,1.3)*22px)", fontWeight: 900, color: c[2], marginTop: 4, lineHeight: 1.2 }}>{c[1]}</div></Card>;
  return <div style={{ marginBottom: 16 }}>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>{cards.map(cardEl)}</div>
    <div style={{ marginTop: 12, fontSize: "calc(var(--s,1.3)*14px)", fontWeight: 800, color: C.blue }}>📅 월납 보험료 제안 지표 <span style={{ color: C.textM, fontWeight: 600 }}>(컨설팅 수임료와 구분된 지표입니다)</span></div>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8 }}>{monthlyCards.map(cardEl)}</div>
  </div>;
}
// 고객 상세 모달(리포트/제안서·다음 연락 관리 공용)
function CustDetailModal({ open, item, data, setData, goMeeting, onClose }) {
  return <Modal open={open} onClose={onClose} title={item ? `${getCompanyName(item) || item.name} · 고객 상세` : ""} width={900}>{item && <div style={{ display: "grid", gap: 12 }}><CustomerPanel item={item} data={data} setData={setData} goMeeting={(id) => { onClose(); goMeeting && goMeeting(id); }} /><div style={{ display: "flex", justifyContent: "flex-end" }}><button style={btnP} onClick={onClose}>닫기</button></div></div>}</Modal>;
}
function CustomerReports({ data, setData, goMeeting }) {
  const [q, setQ] = useState("");
  const [rep, setRep] = useState(null);
  const [scope, setScope] = useState(null);
  const [detail, setDetail] = useState(null);
  const allRaw = getUniqueCustomers(data);
  const all = allRaw.filter((c) => matchSearch(c, q));
  return <div>
    {null}
    <p style={{ color: C.textS, fontSize: "calc(var(--s,1.3)*16px)", lineHeight: 1.6, margin: "0 0 12px" }}>신규 고객 발굴·고객사 관리 고객을 한 곳에서 보고, <b>방문용 리포트</b>를 바로 열거나 복사할 수 있습니다.</p>
    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}><input style={{ ...inp, flex: 1, minWidth: 220, marginBottom: 0 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 업체명, 업종, 니즈, 대표 고민으로 검색" />{q.trim() && <button style={btnSm} onClick={() => setQ("")}>✕ 검색 초기화</button>}</div>
    <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*14px)", marginBottom: 12 }}>총 {allRaw.length}개 중 {all.length}개 표시</div>
    {all.length === 0 ? <Card style={{ padding: 40, textAlign: "center" }}><p style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*16px)", lineHeight: 1.7, marginBottom: 14 }}>아직 고객이 없습니다. 고객을 등록하면 그 고객을 골라 방문용 리포트·제안서·견적서를 만들 수 있습니다.</p><SampleCTA data={data} setData={setData} label="🎁 샘플로 먼저 보기" /></Card> : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(340px,1fr))", gap: 14 }}>{all.map((c) => { const bd = scoreBand(scoreLead(c)); const src = sourceTag(c); return <Card key={c.id} style={{ padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "start" }}><div><h3 style={{ margin: 0, fontSize: "calc(var(--s,1.3)*20px)" }}>{getCompanyName(c) || c.name}</h3><p style={{ color: C.textM, margin: "5px 0 0", fontSize: "calc(var(--s,1.3)*14px)" }}>{c.industry} · {stageOf(c.stage).label}</p></div><div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}><Badge color={src.color} bg={src.bg}>{src.label}</Badge>{c.proposalStatus && c.proposalStatus !== "제안 전" && <Badge color={(PROPOSAL_STATE_STYLE[c.proposalStatus] || PROPOSAL_STATE_STYLE["제안 전"])[0]} bg={(PROPOSAL_STATE_STYLE[c.proposalStatus] || PROPOSAL_STATE_STYLE["제안 전"])[1]}>{c.proposalStatus}</Badge>}</div></div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "10px 0" }}>{(c.interests || []).slice(0, 4).map((x) => <Badge key={x} color={C.sky} bg={C.blueBg}>{x}</Badge>)}</div>
      <div style={{ fontSize: "calc(var(--s,1.3)*15px)", marginBottom: 12 }}>계약 가능성 <b style={{ color: bd.color, fontSize: "calc(var(--s,1.3)*18px)" }}>{scoreLead(c)}</b> · {bd.short}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}><button style={{ ...btnP, flex: 1 }} onClick={() => setRep(c)}>📄 방문용 리포트 만들기</button><MoreActions label="더보기 ▾"><button style={btnSm} onClick={() => setScope(c)}>📑 견적/업무범위서</button><button style={btnSm} onClick={() => copyText(customerShareSummary(c, getReportProfile(data)), () => showToast("복사되었습니다."))}>대표님용 요약 복사</button><button style={btnSm} onClick={() => setDetail(c)}>상세 보기</button></MoreActions></div>
    </Card>; })}</div>}
    <VisitReport open={!!rep} item={rep} data={data} setData={setData} onClose={() => setRep(null)} />
    <ScopeDoc open={!!scope} item={scope} pkg={scope && matchPackages(scope, getPackages(data))[0] && matchPackages(scope, getPackages(data))[0].pkg} data={data} setData={setData} onClose={() => setScope(null)} />
    <CustDetailModal open={!!detail} item={detail} data={data} setData={setData} goMeeting={goMeeting} onClose={() => setDetail(null)} />
  </div>;
}
function FollowUps({ data, setData, goMeeting }) {
  const [detail, setDetail] = useState(null);
  const active = getUniqueCustomers(data).filter((c) => !["contracted", "lost"].includes(c.stage));
  const fk = (k) => active.filter((c) => { const f = followStatus(c); return f && f.kind === k; });
  const today = fk("today"), over = fk("overdue"), soon = fk("upcoming");
  const none = active.filter((c) => !c.nextDate);
  const recent = getUniqueCustomers(data).filter((c) => (c.contacts || []).length > 0).sort((a, b) => ((b.contacts[0] || {}).date || "").localeCompare((a.contacts[0] || {}).date || "")).slice(0, 12);
  const card = (c) => { const bd = scoreBand(scoreLead(c)); const fs = followStatus(c); return <div key={c.id} style={{ background: C.bg, border: "1px solid " + C.bdr, borderRadius: 11, padding: 14, marginBottom: 8 }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}><b style={{ fontSize: "calc(var(--s,1.3)*17px)" }}>{getCompanyName(c) || c.name}</b><div style={{ display: "flex", gap: 5 }}><Badge color={stageOf(c.stage).color} bg={stageOf(c.stage).bg}>{stageOf(c.stage).label}</Badge>{fs && <Badge color={fs.c} bg={fs.b}>{fs.t}</Badge>}</div></div>
    <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*14px)", margin: "6px 0" }}>예정 {c.nextDate ? `${c.nextDate} (${ddayText(dday(c.nextDate))})` : "미정"} · 점수 {scoreLead(c)} · {(c.interests || []).slice(0, 2).join(", ") || "니즈 미입력"}</div>
    <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*14px)", marginBottom: 10 }}>다음 액션: {c.nextAction || (recommendedStrategiesFor(c)[0] && recommendedStrategiesFor(c)[0].name) || "점검"}</div>
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><button style={btnSm} onClick={() => copyText(followUpKakao(c), () => showToast("복사되었습니다."))}>💬 다음 연락 문구</button><button style={btnSm} onClick={() => goMeeting && goMeeting(c.id)}>🤝 미팅 준비</button><button style={btnSm} onClick={() => setDetail(c)}>고객 상세</button></div>
  </div>; };
  const acc = (sk, title, list, urgent) => <AccordionSection data={data} setData={setData} screenKey="followup" sectionKey={sk} title={title} count={list.length} important={urgent} defaultOpen={urgent && list.length > 0}>
    {list.length === 0 ? <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*15px)", padding: "4px 0" }}>해당 고객이 없습니다.</div> : list.map(card)}
  </AccordionSection>;
  const summary = [["📞 오늘 연락", today.length, C.warn], ["⏰ 지연", over.length, C.err], ["🔜 이번 주", soon.length, C.blue]];
  return <div>
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>{summary.map((x) => <div key={x[0]} style={{ flex: "1 1 130px", background: C.bg, border: `1px solid ${C.bdr}`, borderRadius: 12, padding: "12px 16px" }}><div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*14px)", fontWeight: 700 }}>{x[0]}</div><div style={{ color: x[2], fontWeight: 900, fontSize: "calc(var(--s,1.3)*26px)" }}>{x[1]}<span style={{ fontSize: "calc(var(--s,1.3)*15px)", color: C.textM }}> 명</span></div></div>)}</div>
    <p style={{ color: C.textS, fontSize: "calc(var(--s,1.3)*15px)", lineHeight: 1.6, margin: "0 0 12px" }}>아래 항목을 눌러 펼치면 해당 고객 목록이 나옵니다. 한 번 펼친 항목은 다른 메뉴에 갔다 와도 유지됩니다.</p>
    {acc("today", "📞 오늘 연락할 고객", today, true)}
    {acc("over", "⏰ 다음 연락 지연 고객", over, true)}
    {acc("soon", "🔜 곧 연락할 고객", soon, false)}
    {acc("none", "📭 다음 연락 예정일 없는 고객", none, false)}
    {acc("recent", "📒 최근 연락 이력 있는 고객", recent, false)}
    <CustDetailModal open={!!detail} item={detail} data={data} setData={setData} goMeeting={goMeeting} onClose={() => setDetail(null)} />
  </div>;
}
function ScopeDoc({ open, item, pkg, data, setData, onClose }) {
  if (!open || !item || !pkg) return null;
  const p = getReportProfile(data);
  const name = getCompanyName(item) || item.name;
  const items = scopeItems(pkg);
  const kakaos = scopeKakaoSet(item, pkg);
  const R = { bg: "#FBF9F3", text: "#222730", sub: "#5C6470", bd: "#E3DCCB", accent: "#9A7B2E", card: "#FFFFFF" };
  const sec = (t, c) => <div className="repSec" style={{ background: R.card, border: `1px solid ${R.bd}`, borderRadius: 12, padding: 16, marginBottom: 12, breakInside: "avoid" }}><div style={{ color: R.accent, fontWeight: 900, fontSize: "calc(var(--s,1.3)*16px)", marginBottom: 8 }}>{t}</div>{c}</div>;
  return <Modal open={open} onClose={onClose} title={`${name} · 견적/업무범위서`} width={840}>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
      <button style={btnP} onClick={() => copyText(buildScopeDoc(item, pkg, p), () => showToast("복사되었습니다."))}>📋 업무범위 복사</button>
      <button style={btnS} onClick={() => copyText(buildQuoteText(item, pkg), () => showToast("복사되었습니다."))}>💰 견적 문구 복사</button>
      <button style={btnS} onClick={() => { try { window.print(); } catch (e) {} }}>🖨 PDF 저장/인쇄</button>
      <button style={btnS} onClick={() => setProposalStatus(data, setData, item, "견적 전달")}>제안 상태 ‘견적 전달’</button>
    </div>
    <div id="visitReport" style={{ background: R.bg, borderRadius: 14, padding: "clamp(18px,4vw,30px)", color: R.text, maxWidth: 760, margin: "0 auto" }}>
      <div className="repSec" style={{ borderBottom: `2px solid ${R.accent}`, paddingBottom: 14, marginBottom: 18, breakInside: "avoid" }}><div style={{ color: R.accent, letterSpacing: 2, fontSize: "calc(var(--s,1.3)*12px)", fontWeight: 900 }}>{p.org}</div><h2 style={{ margin: "6px 0 0", fontSize: "calc(var(--s,1.3)*22px)", color: R.text }}>업무범위서 초안</h2><div style={{ color: R.sub, fontSize: "calc(var(--s,1.3)*13px)", marginTop: 4 }}>{name} · {todayISO().replace(/-/g, ".")} · {p.consultant} {p.title}</div></div>
      {sec("1. 고객사 / 2. 제안 상품·패키지", <div style={{ fontSize: "calc(var(--s,1.3)*15px)", lineHeight: 1.7 }}>고객사: <b>{name}</b><div style={{ marginTop: 4 }}>제안 항목: <b>{pkg.name}</b> <span style={{ color: R.sub }}>({pkg.cat})</span></div></div>)}
      {sec("3. 업무 범위", <div style={{ display: "grid", gap: 6 }}>{items.map((x, i) => <div key={i} style={{ fontSize: "calc(var(--s,1.3)*15px)", lineHeight: 1.6 }}>{i + 1}. {x}</div>)}</div>)}
      {sec("4. 제외 업무 (별도 협의가 필요한 범위)", <div style={{ display: "grid", gap: 5 }}>{SCOPE_EXCLUDED.map((x) => <div key={x} style={{ fontSize: "calc(var(--s,1.3)*14px)", color: R.sub, lineHeight: 1.6 }}>· {x}</div>)}</div>)}
      {sec("5. 고객 준비자료", <div style={{ display: "grid", gap: 6 }}>{(pkg.docs || []).map((d) => <div key={d} style={{ fontSize: "calc(var(--s,1.3)*15px)" }}>☐ {d}</div>)}</div>)}
      {sec("6. 예상 진행 기간", <div style={{ fontSize: "calc(var(--s,1.3)*15px)", lineHeight: 1.7 }}><b>{pkgDuration(pkg)}</b><div style={{ color: R.sub, marginTop: 4 }}>자료 준비 상황과 검토 범위에 따라 달라질 수 있습니다.</div></div>)}
      {(() => { const mo = Number(item.proposalMonthlyPremium) || 0; if (!(mo > 0)) return sec("7. 제안 금액 안내", <div style={{ fontSize: "calc(var(--s,1.3)*15px)", lineHeight: 1.7, color: R.sub }}>제안 금액은 월납 플랜 기준으로 협의 후 정리됩니다. 고정 금액은 표시하지 않습니다.</div>); const rr = insuranceSim(mo, item.proposalMonths, item.proposalRefundRate); return sec("7. 월납 플랜 검토안 (100% 기준 단순 시뮬레이션)", <div style={{ fontSize: "calc(var(--s,1.3)*15px)", lineHeight: 1.8 }}>월납 <b>{manToText(mo)}</b> × {rr.months}개월 = 총 납입 기준 <b style={{ color: R.accent }}>{manToText(rr.total)}</b><br />7년차 {rr.rate}% 기준 예상 목적자금 <b style={{ color: R.accent }}>{manToText(rr.base)}</b><div style={{ color: R.sub, marginTop: 4 }}>상품 조건에 따라 실제 수치가 달라질 수 있으며, 청약 전 상품설명서와 전문가 설명 확인이 필요합니다. 실제 진행 범위·금액은 협의 후 정리됩니다.</div></div>); })()}
      {sec("8. 진행 절차", <div style={{ fontSize: "calc(var(--s,1.3)*15px)", lineHeight: 1.7 }}>1) 자료 확인 → 2) 우선순위 정리 → 3) 진행 범위 정리 → 4) 실무 진행 (각 단계는 자료 확인 후 판단)</div>)}
      {sec("9. 확인이 필요한 사항", <div style={{ fontSize: "calc(var(--s,1.3)*15px)", lineHeight: 1.7 }}>{pkg.caution || "적용 여부는 세부 요건 확인 필요, 세무사 검토 권장"}</div>)}
      <div className="repSec" style={{ background: "#F3EEE0", border: `1px solid ${R.bd}`, borderRadius: 10, padding: 14, breakInside: "avoid" }}><div style={{ color: R.text, fontSize: "calc(var(--s,1.3)*13px)", lineHeight: 1.6 }}>※ 본 내용은 업무범위 초안이며, 실제 진행 범위와 수임료는 자료 확인 및 협의 후 조정될 수 있습니다. 계약서가 아니며, 실제 계약 조건은 협의 후 정리됩니다.</div></div>
    </div>
    <div style={{ marginTop: 14 }}><div style={{ fontWeight: 900, color: C.gold, fontSize: "calc(var(--s,1.3)*16px)", marginBottom: 8 }}>💬 견적/업무범위 전달 카톡 (5종)</div><div style={{ display: "grid", gap: 10 }}>{kakaos.map((k, i) => <TextBlock key={i} title={k[0]} text={k[1]} copy />)}</div></div>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}><button style={btnS} onClick={() => addTodo(data, setData, item, `${name} 업무범위서/견적 전달`, "제안서/리포트 발송")}>➕ 오늘 할 일로</button></div>
  </Modal>;
}
function ProposalDraft({ open, item, pkgs, data, setData, onClose }) {
  const [mode, setMode] = useState("customer");
  if (!open || !item) return null;
  const p = getReportProfile(data);
  const list = (pkgs && pkgs.length) ? pkgs : matchPackages(item, getPackages(data)).map((m) => m.pkg);
  const name = getCompanyName(item) || item.name;
  const feeSum = list.reduce((s, x) => s + (Number(x.fee) || 0), 0);
  const docs = Array.from(new Set(list.flatMap((x) => x.docs || []))).slice(0, 12);
  const R = { bg: "#FBF9F3", text: "#222730", sub: "#5C6470", bd: "#E3DCCB", accent: "#9A7B2E", card: "#FFFFFF" };
  const sec = (t, c) => <div className="repSec" style={{ background: R.card, border: `1px solid ${R.bd}`, borderRadius: 12, padding: 16, marginBottom: 12, breakInside: "avoid" }}><div style={{ color: R.accent, fontWeight: 900, fontSize: "calc(var(--s,1.3)*16px)", marginBottom: 8 }}>{t}</div>{c}</div>;
  const advance = () => { const entry = { date: todayISO(), from: stageOf(item.stage).label, to: stageOf("proposal_sent").label }; const patch = { proposedPackages: list.map((x) => x.name), proposedAt: todayISO(), proposedFee: feeSum, proposalStatus: "제안 완료" }; if (item.stage !== "proposal_sent") { patch.stage = "proposal_sent"; patch.stageHistory = [...(item.stageHistory || []), entry]; patch.stageMovedAt = todayISO(); } updateCust(data, setData, item.id, patch); showToast("제안 기록 + 단계를 '제안서/리포트 발송'으로 변경했습니다."); };
  return <Modal open={open} onClose={onClose} title={`${name} · 제안서 초안`} width={860}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{[["customer", "대표님 공유용"], ["internal", "내부 검토용"]].map((m) => <button key={m[0]} onClick={() => setMode(m[0])} style={{ ...(mode === m[0] ? btnP : btnS) }}>{m[1]}</button>)}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button style={btnS} onClick={() => copyText(buildProposal(item, list, "customer", p), () => showToast("복사되었습니다."))}>대표님용 복사</button>
        <button style={btnS} onClick={() => copyText(buildProposal(item, list, "internal", p), () => showToast("복사되었습니다."))}>내부용 복사</button>
        <button style={btnS} onClick={() => copyText(docs.map((d) => "☐ " + d).join("\n"), () => showToast("복사되었습니다."))}>요청자료 복사</button>
      </div>
    </div>
    <div id="visitReport" style={{ background: R.bg, borderRadius: 14, padding: "clamp(18px,4vw,30px)", color: R.text, maxWidth: 760, margin: "0 auto" }}>
      <div className="repSec" style={{ borderBottom: `2px solid ${R.accent}`, paddingBottom: 14, marginBottom: 18, breakInside: "avoid" }}><div style={{ color: R.accent, letterSpacing: 2, fontSize: "calc(var(--s,1.3)*12px)", fontWeight: 900 }}>{p.org}</div><h2 style={{ margin: "6px 0 0", fontSize: "calc(var(--s,1.3)*22px)", color: R.text }}>{name} 법인컨설팅 제안 초안</h2><div style={{ color: R.sub, fontSize: "calc(var(--s,1.3)*13px)", marginTop: 4 }}>{p.consultant} {p.title} · {todayISO().replace(/-/g, ".")} · {mode === "customer" ? "대표님 공유용" : "내부 검토용"}</div></div>
      {sec("1. 고객 현황 요약", <div style={{ fontSize: "calc(var(--s,1.3)*15px)", lineHeight: 1.7 }}>{item.industry} · 매출 {wonFromMillion(item.revenue)} · 직원 {item.empCount || "-"}명 · 업력 {item.estYears || "-"}년 · 단계 {stageOf(item.stage).label}{item.concern && <div style={{ marginTop: 6, color: R.sub }}>주요 고민: {item.concern}</div>}</div>)}
      {sec("2. 현재 확인이 필요한 이슈", <div style={{ fontSize: "calc(var(--s,1.3)*15px)", lineHeight: 1.75 }}>{visitReasonText(item, mode)}</div>)}
      {sec("3. 제안 패키지", <div style={{ display: "grid", gap: 10 }}>{list.map((x, i) => <div key={i} style={{ borderLeft: `3px solid ${R.accent}`, paddingLeft: 12 }}><div style={{ fontWeight: 800, fontSize: "calc(var(--s,1.3)*15px)" }}>{i + 1}. {x.name} <span style={{ color: R.sub, fontWeight: 600, fontSize: "calc(var(--s,1.3)*13px)" }}>({x.cat})</span></div><div style={{ color: R.sub, fontSize: "calc(var(--s,1.3)*14px)", marginTop: 3, lineHeight: 1.6 }}>· 검토 내용: {x.simple || x.point || consultDesc(x.name)}</div></div>)}{(() => { const br = bundleReason(list.map((x) => x.name)); return br ? <div style={{ color: R.accent, fontSize: "calc(var(--s,1.3)*14px)", lineHeight: 1.6, marginTop: 4 }}>※ 함께 검토 이유: {br}</div> : null; })()}</div>)}
      {sec("4. 진행 절차", <div style={{ fontSize: "calc(var(--s,1.3)*15px)", lineHeight: 1.7 }}>1) 자료 확인 → 2) 우선순위 정리 → 3) 진행 범위 정리 → 4) 실무 진행 (각 단계는 자료 확인 후 판단)</div>)}
      {sec("5. 요청자료", <div style={{ display: "grid", gap: 6 }}>{docs.map((d) => <div key={d} style={{ fontSize: "calc(var(--s,1.3)*15px)" }}>☐ {d}</div>)}</div>)}
      {(() => { const mo = Number(item.proposalMonthlyPremium) || 0; if (!(mo > 0)) return sec("6. 제안 금액 안내", <div style={{ fontSize: "calc(var(--s,1.3)*15px)", color: R.sub, lineHeight: 1.7 }}>제안 금액은 월납 플랜 기준으로 협의 후 정리되며, 고객 재무상황을 확인한 뒤 조정될 수 있습니다.</div>); const rr = insuranceSim(mo, item.proposalMonths, item.proposalRefundRate); const aff = affordability(mo, custNetIncomeMan(item), getAffordSettings(data)); return sec("6. 월납 플랜 검토안 (100% 기준 단순 시뮬레이션)", <div style={{ fontSize: "calc(var(--s,1.3)*15px)", lineHeight: 1.8 }}>월납 <b>{manToText(mo)}</b> × {rr.months}개월 = 총 납입 기준 <b style={{ color: R.accent }}>{manToText(rr.total)}</b><br />7년차 {rr.rate}% 기준 예상 목적자금 <b style={{ color: R.accent }}>{manToText(rr.base)}</b>{mode === "internal" && aff.hasBase && <div style={{ marginTop: 6 }}>· [내부] 직전년도 이익 대비 적정성: <b style={{ color: aff.level === "green" ? "#2E7D32" : aff.level === "yellow" ? "#B26A00" : "#B3261E" }}>{aff.label}</b></div>}<div style={{ color: R.sub, marginTop: 6, fontSize: "calc(var(--s,1.3)*13px)", lineHeight: 1.6 }}>해당 금액은 대표 퇴직금·가지급금 정리·세무/승계 목적자금 등으로 검토할 수 있습니다. 상품 조건에 따라 실제 수치가 달라질 수 있으며, 청약 전 상품설명서와 전문가 설명 확인이 필요합니다.</div></div>); })()}
      {mode === "internal" && sec("6-1. [내부] 영업·클로징 포인트", <div style={{ fontSize: "calc(var(--s,1.3)*14px)", lineHeight: 1.7, display: "grid", gap: 4 }}><div>· 영업 포인트: {list[0] ? list[0].point : ""}</div><div>· 클로징: 우선 1개 패키지부터 단계적으로 진행 제안</div><div>· 예상 반론: “세무사 있어요 / 비용?” → 검토 포인트 정리·단계적 범위 제안</div><div>· 다음 액션: {item.nextAction || "자료 요청"}</div></div>)}
      {sec("7. 다음 미팅 제안", <div style={{ fontSize: "calc(var(--s,1.3)*15px)", lineHeight: 1.7 }}>자료 확인 후 실제 적용 가능성이 있는 부분만 추려서 다시 정리드리겠습니다. 부담 없이 우선순위만 함께 확인하는 자리로 봐주시면 됩니다.</div>)}
      <div className="repSec" style={{ background: "#F3EEE0", border: `1px solid ${R.bd}`, borderRadius: 10, padding: 14, breakInside: "avoid" }}><div style={{ color: R.text, fontSize: "calc(var(--s,1.3)*13px)", lineHeight: 1.6 }}>※ 적용 여부는 회사 자료 확인과 세무사·전문가 검토가 필요합니다. 예상 수임료는 내부 영업 관리용이며 실제 제안 금액은 고객 상황·자료 범위·전문가 검토 범위에 따라 달라질 수 있습니다.</div></div>
    </div>
    <div style={{ marginTop: 14 }}><div style={{ fontWeight: 900, color: C.gold, fontSize: "calc(var(--s,1.3)*16px)", marginBottom: 8 }}>💬 후속 카톡 문구</div><TextBlock title="제안 후 후속 카톡" text={list[0] ? list[0].kakao : followUpKakao(item)} copy /></div>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}><button style={btnS} onClick={() => addTodo(data, setData, item, `${name} 제안서 발송`, "제안서/리포트 발송")}>➕ 오늘 할 일로</button><button style={btnP} onClick={advance}>📨 제안 기록 + 단계 '제안서/리포트 발송'</button></div>
  </Modal>;
}
// 월납 보험료 중심 제안 흐름 — 상품 + 추가항목 묶음 → 월납 입력 → 84개월/7년차 목적자금 → 적정성 신호 → 저장/문서
// 컨설팅 항목 카탈로그(카테고리별) — 추후 중기이코노미 공식 항목을 이 배열에 추가만 하면 됨. {n: 항목명, d: 1줄 설명}
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
const PROPOSAL_ADD_ITEMS = CONSULT_CATALOG.flatMap((g) => g.items.map((x) => x[0]));
const MONTHLY_QUICK = [100, 200, 300, 500, 1000];
const AFFORD_DEFAULTS = { greenPerEok: 300, yellowPerEok: 600, defMonths: 84, defRate: 100 };
function MonthlyProposalModal({ open, base, data, setData, onClose, onProposal, onScope }) {
  const allCust = getUniqueCustomers(data);
  const [custId, setCustId] = useState("");
  const [extra, setExtra] = useState([]);
  const [monthly, setMonthly] = useState("");
  const [months, setMonths] = useState(84);
  const [rate, setRate] = useState(100);
  const [memo, setMemo] = useState("");
  const [netEok, setNetEok] = useState("");
  const [q, setQ] = useState("");
  const [affEdit, setAffEdit] = useState(false);
  const [affSet, setAffSet] = useState(getAffordSettings(data));
  useEffect(() => { if (open) { const s = getAffordSettings(data); setCustId((getUniqueCustomers(data)[0] || {}).id || ""); setExtra([]); setMonthly(""); setMonths(s.defMonths); setRate(s.defRate); setMemo(""); setNetEok(""); setQ(""); setAffEdit(false); setAffSet(s); } }, [open, base]); // eslint-disable-line
  if (!open || !base) return null;
  const cust = allCust.find((c) => c.id === custId);
  const sim = insuranceSim(monthly, months, rate);
  const derivedNet = cust ? custNetIncomeMan(cust) : null;
  const netMan = derivedNet != null ? derivedNet : (netEok ? Math.round(Number(netEok) * 10000) : null);
  const aff = affordability(monthly, netMan, affSet); // 모달 내 기준(affSet)으로 즉시 재계산
  const toggle = (x) => setExtra((p) => (p.includes(x) ? p.filter((y) => y !== x) : [...p, x]));
  const pkgNames = [base.name, ...extra];
  const pkgObjs = pkgNames.map((nm) => getPackages(data).find((p) => p.name === nm) || { name: nm, cat: "추가 항목", desc: consultDesc(nm), simple: consultDesc(nm), point: consultDesc(nm), docs: [], caution: "적용 여부는 세부 요건 확인 필요, 세무사 검토 권장", fee: 0 });
  const buildPatch = () => ({ proposedPackages: pkgNames, proposalMonthlyPremium: Number(monthly) || 0, proposalMonths: Number(months) || 84, proposalRefundRate: isFinite(Number(rate)) ? Number(rate) : 100, proposalTotalPaid: sim.total, proposalProjectedValue: sim.base, proposalAffordabilityStatus: aff.level, proposalAffordabilityMemo: memo || "", proposalNetIncomeBase: netMan || (cust && cust.proposalNetIncomeBase) || 0, proposalUpdatedAt: todayISO(), proposedAt: todayISO() });
  const persist = (then) => {
    if (!cust) { showToast("고객을 먼저 선택해주세요."); return; }
    if (!(Number(monthly) > 0)) { showToast("월납 보험료를 입력해주세요."); return; }
    const patch = buildPatch();
    updateCust(data, setData, cust.id, patch);
    const merged = { ...cust, ...patch };
    showToast("월납 제안 내용을 저장했습니다. 금액·조건은 협의 후 정리됩니다.");
    if (then === "proposal") { onClose(); onProposal && onProposal({ item: merged, pkgs: pkgObjs }); }
    else if (then === "scope") { onClose(); onScope && onScope({ item: merged, pkg: base }); }
    else onClose();
  };
  const saveAff = () => { const s = { greenPerEok: Number(affSet.greenPerEok) || 300, yellowPerEok: Number(affSet.yellowPerEok) || 600, defMonths: Number(affSet.defMonths) || 84, defRate: isFinite(Number(affSet.defRate)) ? Number(affSet.defRate) : 100 }; setData({ ...data, affordSettings: s }); setAffSet(s); setAffEdit(false); showToast("월납 적정성 기준을 저장했습니다. 다른 고객 제안에도 같은 기준이 적용됩니다."); };
  const resetAff = () => { setAffSet({ ...AFFORD_DEFAULTS }); showToast("기본값(초록 300 / 노랑 600 / 84개월 / 100%)으로 되돌렸습니다. ‘기준 저장’을 눌러 적용하세요."); };
  const lab = (t) => <div style={{ fontWeight: 800, color: C.gold, fontSize: "calc(var(--s,1.3)*15px)", margin: "4px 0 8px" }}>{t}</div>;
  const qf = q.trim();
  return <Modal open={open} onClose={onClose} title={`${base.name} · 월납 기준 제안`} width={680}>
    <div style={{ display: "grid", gap: 14 }}>
      <Card style={{ padding: 14, background: C.blueBg, border: `1px solid ${C.blue}40` }}><div style={{ fontWeight: 900, color: C.blue, fontSize: "calc(var(--s,1.3)*16px)" }}>① 선택한 컨설팅 상품</div><div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}><Badge color={C.blue} bg="#fff">{base.name}</Badge><span style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*13px)" }}>{base.cat}</span></div></Card>
      {allCust.length === 0 ? <p style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*15px)" }}>등록된 고객이 없습니다. 먼저 고객을 등록하거나 샘플을 넣어주세요.</p> : <>
        <div>{lab("② 고객 선택")}<select style={inp} value={custId} onChange={(e) => setCustId(e.target.value)}>{allCust.map((c) => <option key={c.id} value={c.id}>{getCompanyName(c) || c.name}</option>)}</select></div>
        <div>{lab("③ 추가 제안 항목 (카테고리별 묶음 선택)")}
          {extra.length > 0 && <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>{extra.map((x) => <button key={x} onClick={() => toggle(x)} style={{ ...btnSm, background: C.blue, color: "#fff", border: "none" }}>✓ {x} ✕</button>)}</div>}
          <input style={{ ...inp, marginBottom: 8 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 항목 검색 (예: 정관, 정책자금, 승계, 특허)" />
          <div style={{ display: "grid", gap: 8, maxHeight: 240, overflowY: "auto", padding: 2 }}>{CONSULT_CATALOG.map((grp) => { const items = grp.items.map((x) => x[0]).filter((x) => x !== base.name && (!qf || x.includes(qf) || grp.cat.includes(qf))); if (!items.length) return null; return <div key={grp.cat}><div style={{ fontSize: "calc(var(--s,1.3)*12px)", fontWeight: 800, color: C.textM, marginBottom: 5 }}>{grp.cat}</div><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{items.map((x) => { const on = extra.includes(x); return <button key={x} onClick={() => toggle(x)} title={consultDesc(x)} style={{ ...btnSm, background: on ? C.blue : "#fff", color: on ? "#fff" : C.textS, border: `1px solid ${on ? C.blue : C.bdr}` }}>{on ? "✓ " : "+ "}{x}</button>; })}</div></div>; })}</div>
          {extra.length > 0 && <div style={{ marginTop: 8, color: C.textM, fontSize: "calc(var(--s,1.3)*13px)" }}>선택({pkgNames.length}): {pkgNames.join(" · ")}</div>}
        </div>
        <div>{lab("④ 월납 보험료 입력")}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>{MONTHLY_QUICK.map((v) => <button key={v} onClick={() => setMonthly(v)} style={{ ...btnSm, background: Number(monthly) === v ? C.gold : "#fff", color: Number(monthly) === v ? "#fff" : C.textS, border: `1px solid ${Number(monthly) === v ? C.gold : C.bdr}` }}>{v.toLocaleString()}만원</button>)}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <div><Label>월납(만원)</Label><input type="number" style={inp} value={monthly} onChange={(e) => setMonthly(e.target.value)} placeholder="예) 240" /></div>
            <div><Label>납입기간(개월)</Label><input type="number" style={inp} value={months} onChange={(e) => setMonths(e.target.value)} placeholder="84" /></div>
            <div><Label>기준 환급률(%)</Label><input type="number" style={inp} value={rate} onChange={(e) => setRate(e.target.value)} placeholder="100" /></div>
          </div>
          <div><Label>메모(선택)</Label><input style={inp} value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="목적자금·관계사·기존 보험 등 참고 메모" /></div>
        </div>
        <Card style={{ padding: 14, background: C.bg }}>
          {lab("⑤ 84개월·7년차 목적자금 (100% 기준 단순 시뮬레이션)")}
          {Number(monthly) > 0 ? <div style={{ fontSize: "calc(var(--s,1.3)*15px)", color: C.textS, lineHeight: 1.8 }}>
            월납 <b>{manToText(monthly)}</b> × {Number(months) || 84}개월 = 총 납입 기준 <b style={{ color: C.blue }}>{manToText(sim.total)}</b><br />
            7년차 {sim.rate}% 기준 예상 목적자금 <b style={{ color: C.gold, fontSize: "calc(var(--s,1.3)*18px)" }}>{manToText(sim.base)}</b>
            <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*13px)", marginTop: 6, lineHeight: 1.6 }}>해당 금액은 대표 퇴직금, 가지급금 정리, 세무/승계 목적자금 등으로 검토할 수 있습니다. 상품 조건에 따라 실제 수치가 달라질 수 있으며, 청약 전 상품설명서와 전문가 설명 확인이 필요합니다.</div>
          </div> : <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*14px)" }}>월납 보험료를 입력하면 84개월 누적액과 7년차 기준 목적자금을 계산합니다.</div>}
        </Card>
        <Card style={{ padding: 14, background: aff.bg, border: `1px solid ${aff.color}55` }}>
          {lab("⑥ 직전년도 당기순이익 대비 월납 보험료 적정성 (내부 검토용)")}
          <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*13px)", lineHeight: 1.6, marginBottom: 8 }}>직전년도 당기순이익을 기준으로 입력한 월납 보험료의 부담 수준을 참고용으로 표시합니다. 실제 판단은 현금흐름, 기존 보험료, 관계사 상황, 대표님 목적자금 등을 함께 확인한 뒤 컨설턴트가 조정해주세요.</div>
          {derivedNet == null && <div style={{ marginBottom: 8 }}><Label>직전년도 당기순이익 (억원)</Label><input type="number" style={{ ...inp, marginBottom: 4 }} value={netEok} onChange={(e) => setNetEok(e.target.value)} placeholder="예) 1 = 1억원" /><div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*12px)" }}>고객 재무자료/고객 정보에 당기순이익이 있으면 자동으로 사용합니다.</div></div>}
          {aff.hasBase ? <div style={{ fontSize: "calc(var(--s,1.3)*14px)", color: C.textS, lineHeight: 1.7 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}><Badge color={aff.color} bg="#fff">{aff.label}</Badge><span style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*13px)" }}>기준: 당기순이익 {manToText(netMan)} · 초록 ≤{aff.greenLimit.toLocaleString()}만 · 노랑 ≤{aff.yellowLimit.toLocaleString()}만</span></div>
            {aff.msg}<div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*12px)", marginTop: 6 }}>{aff.note}</div>
          </div> : <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*14px)" }}>{aff.msg}</div>}
          <div style={{ marginTop: 10, borderTop: `1px solid ${aff.color}33`, paddingTop: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ fontSize: "calc(var(--s,1.3)*13px)", color: C.textM }}>현재 기준 · 초록 ≤<b>{affSet.greenPerEok}</b>만 / 노랑 ≤<b>{affSet.yellowPerEok}</b>만 (당기순이익 1억원당) · {affSet.defMonths}개월 · {affSet.defRate}%</div>
              <button style={btnSm} onClick={() => setAffEdit((v) => !v)}>{affEdit ? "기준 닫기" : "⚙ 기준 조정"}</button>
            </div>
            {affEdit && <div style={{ marginTop: 8, background: "#fff", border: `1px solid ${C.bdr}`, borderRadius: 10, padding: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div><Label>초록 기준 (1억원당 월납, 만원)</Label><input type="number" style={inp} value={affSet.greenPerEok} onChange={(e) => setAffSet((s) => ({ ...s, greenPerEok: e.target.value }))} placeholder="300" /></div>
                <div><Label>노랑 기준 (1억원당 월납, 만원)</Label><input type="number" style={inp} value={affSet.yellowPerEok} onChange={(e) => setAffSet((s) => ({ ...s, yellowPerEok: e.target.value }))} placeholder="600" /></div>
                <div><Label>기본 납입기간(개월)</Label><input type="number" style={inp} value={affSet.defMonths} onChange={(e) => setAffSet((s) => ({ ...s, defMonths: e.target.value }))} placeholder="84" /></div>
                <div><Label>기본 환급률(%)</Label><input type="number" style={inp} value={affSet.defRate} onChange={(e) => setAffSet((s) => ({ ...s, defRate: e.target.value }))} placeholder="100" /></div>
              </div>
              <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*12px)", margin: "8px 0" }}>값을 바꾸면 위 신호등이 즉시 재계산됩니다. 저장하면 설정 화면·다른 고객 제안에도 같은 기준이 적용됩니다. 빨강은 노랑 기준 초과입니다.</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><button style={btnP} onClick={saveAff}>기준 저장</button><button style={btnS} onClick={resetAff}>기본값으로 되돌리기</button></div>
            </div>}
          </div>
        </Card>
      </>}
    </div>
    {allCust.length > 0 && <div style={{ position: "sticky", bottom: -24, marginTop: 14, marginLeft: -24, marginRight: -24, marginBottom: -24, padding: "12px 24px", background: C.card, borderTop: `1px solid ${C.bdr}`, display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
      <button style={btnS} onClick={onClose}>취소</button>
      <button style={btnS} onClick={() => persist("save")}>💾 저장만</button>
      <button style={btnS} onClick={() => persist("scope")}>📑 견적/업무범위서</button>
      <button style={btnP} onClick={() => persist("proposal")}>📝 제안서 초안</button>
    </div>}
  </Modal>;
}
function Packages({ data, setData, goMeeting }) {
  const [cat, setCat] = useState("전체");
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState(null);
  const [pickFor, setPickFor] = useState(null);
  const [pickId, setPickId] = useState("");
  const [proposal, setProposal] = useState(null);
  const [scope, setScope] = useState(null);
  const base = (data.packages && data.packages.length) ? data.packages : DEFAULT_PACKAGES;
  const list = base.filter((pp) => (cat === "전체" || pp.cat === cat) && (!q.trim() || `${pp.name} ${pp.cat} ${pp.fit} ${pp.desc}`.includes(q.trim())));
  const persist = (arr) => setData({ ...data, packages: arr });
  const openForm = (pp) => setForm(pp ? { ...pp, docs: (pp.docs || []).join(", ") } : { name: "", cat: "인증/연구소", fee: "", desc: "", fit: "", docs: "", caution: "", simple: "", kakao: "", point: "" });
  const saveForm = () => { if (!form.name.trim()) { showToast("상품명을 입력해주세요."); return; } const item = { ...form, id: form.id || ("pkg" + uid()), fee: Number(form.fee) || 0, docs: typeof form.docs === "string" ? form.docs.split(",").map((s) => s.trim()).filter(Boolean) : (form.docs || []) }; const exists = base.some((pp) => pp.id === item.id); persist(exists ? base.map((pp) => (pp.id === item.id ? item : pp)) : [item, ...base]); setForm(null); showToast("저장했습니다."); };
  const del = (id) => { if (window.confirm("이 상품을 삭제할까요?")) { persist(base.filter((pp) => pp.id !== id)); setDetail(null); showToast("삭제했습니다."); } };
  const restore = () => { const cur = data.packages || []; const names = new Set(cur.map((pp) => pp.name)); const add = DEFAULT_PACKAGES.filter((pp) => !names.has(pp.name)); persist([...cur, ...add]); showToast(add.length ? `샘플 상품 ${add.length}건을 복원했습니다.` : "이미 모두 들어가 있습니다."); };
  const allCust = getUniqueCustomers(data);
  const cardOf = (pp) => <Card key={pp.id} style={{ padding: "12px 14px" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 240px", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}><b style={{ fontSize: "calc(var(--s,1.3)*16px)" }}>{pp.name}</b><Badge color={C.sky} bg={C.blueBg}>{pp.cat}</Badge></div>
          <div style={{ color: C.textS, fontSize: "calc(var(--s,1.3)*13px)", lineHeight: 1.5, marginTop: 4 }}>{pp.desc}</div>
          <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*12px)", marginTop: 2 }}>적합: {pp.fit}</div>
        </div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
          <button style={{ ...btnSm, background: C.blue, color: "#fff", borderColor: C.blue, fontWeight: 800 }} onClick={() => { setPickFor(pp); setPickId(allCust[0] ? allCust[0].id : ""); }}>🎁 제안하기</button>
          <button style={btnSm} onClick={() => setDetail(pp)}>상세</button>
          <button style={btnSm} onClick={() => openForm(pp)}>수정</button>
          <button style={{ ...btnSm, color: C.err }} onClick={() => del(pp.id)}>삭제</button>
        </div>
      </div>
    </Card>;
  const grid = (arr) => <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(420px,1fr))", gap: 10 }}>{arr.map(cardOf)}</div>;
  const searching = !!q.trim() || cat !== "전체";
  return <div>
    {null}
    <div style={{ background: C.bg, border: `1px solid ${C.bdr}`, borderRadius: 11, padding: 14, marginBottom: 14, color: C.textM, fontSize: "calc(var(--s,1.3)*14px)", lineHeight: 1.6 }}>상품 카드에는 고정 금액을 표시하지 않습니다. 제안 금액은 고객 선택 후 <b>월납 보험료 기준</b>으로 입력하며, 월납 플랜은 고객 재무상황을 확인한 뒤 조정합니다. 실제 조건은 협의 후 정리됩니다.</div>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}><p style={{ color: C.textS, margin: 0, fontSize: "calc(var(--s,1.3)*16px)", lineHeight: 1.6, maxWidth: 600 }}>법인컨설팅 상품/패키지를 관리하고, 고객에게 바로 제안서 초안을 만들 수 있습니다.</p><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button style={btnP} onClick={() => openForm(null)}>+ 상품 추가</button><button style={btnS} onClick={restore}>샘플 상품 복원</button></div></div>
    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}><input style={{ ...inp, flex: 1, minWidth: 220, marginBottom: 0 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="🔍 상품명·카테고리·적합 고객 검색" />{q.trim() && <button style={btnSm} onClick={() => setQ("")}>✕</button>}</div>
    <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", marginBottom: 10 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{["전체", ...PKG_CATEGORIES].map((c) => <PillButton key={c} active={cat === c} onClick={() => setCat(c)}>{c}</PillButton>)}</div>
      <span style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*14px)", fontWeight: 700 }}>전체 상품 {base.length}개{searching ? ` · 검색/필터 ${list.length}개` : ""}</span>
    </div>
    {searching ? (list.length ? grid(list) : <Card style={{ padding: 28, textAlign: "center", color: C.textM, fontSize: "calc(var(--s,1.3)*15px)" }}>검색·필터 결과가 없습니다. 다른 검색어나 카테고리를 선택해보세요.</Card>)
      : <div>{PKG_CATEGORIES.map((c) => { const items = base.filter((pp) => pp.cat === c); if (!items.length) return null; return <AccordionSection key={c} data={data} setData={setData} screenKey="packages" sectionKey={"cat_" + c} title={c} count={items.length} defaultOpen={false}>{grid(items)}</AccordionSection>; })}</div>}
    <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? detail.name : ""} width={760}>{detail && <div style={{ display: "grid", gap: 10 }}><div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}><Badge color={C.sky} bg={C.blueBg}>{detail.cat}</Badge><span style={{ color: C.blue, fontSize: "calc(var(--s,1.3)*13px)", fontWeight: 700 }}>💡 고정 금액 없음 · 제안 시 월납 입력</span></div><TextBlock title="설명" text={detail.desc} /><TextBlock title="적합한 고객 조건" text={detail.fit} /><TextBlock title="필요한 자료" text={(detail.docs || []).join("\n")} copy /><TextBlock title="주의 문구" text={detail.caution} /><TextBlock title="대표님에게 설명할 쉬운 문장" text={detail.simple} copy /><TextBlock title="후속 카톡 문구" text={detail.kakao} copy /><TextBlock title="내부 영업 포인트" text={detail.point} /><div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}><button style={btnS} onClick={() => { const d = detail; setDetail(null); openForm(d); }}>수정</button><button style={btnP} onClick={() => { const d = detail; setDetail(null); setPickFor(d); setPickId(allCust[0] ? allCust[0].id : ""); }}>🎁 고객에게 제안하기</button></div></div>}</Modal>
    <Modal open={!!form} onClose={() => setForm(null)} title={form && form.id ? "상품 수정" : "상품 추가"} width={760}>{form && <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}><div><Label>상품명 *</Label><input style={inp} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div><div><Label>카테고리</Label><select style={inp} value={form.cat} onChange={(e) => setForm({ ...form, cat: e.target.value })}>{PKG_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></div><div><Label>내부 참고가(만원·화면 비노출)</Label><input type="number" style={inp} value={form.fee} onChange={(e) => setForm({ ...form, fee: e.target.value })} placeholder="내부 메모용(선택)" /></div></div>
      <div><Label>설명</Label><input style={inp} value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} /></div>
      <div><Label>적합한 고객 조건</Label><input style={inp} value={form.fit} onChange={(e) => setForm({ ...form, fit: e.target.value })} /></div>
      <div><Label>필요한 자료 (쉼표로 구분)</Label><input style={inp} value={form.docs} onChange={(e) => setForm({ ...form, docs: e.target.value })} placeholder="재무제표, 정관, 주주명부" /></div>
      <div><Label>주의 문구</Label><input style={inp} value={form.caution} onChange={(e) => setForm({ ...form, caution: e.target.value })} /></div>
      <div><Label>대표님에게 설명할 쉬운 문장</Label><input style={inp} value={form.simple} onChange={(e) => setForm({ ...form, simple: e.target.value })} /></div>
      <div><Label>후속 카톡 문구</Label><textarea style={{ ...inp, height: 70, resize: "vertical" }} value={form.kakao} onChange={(e) => setForm({ ...form, kakao: e.target.value })} /></div>
      <div><Label>내부 영업 포인트</Label><input style={inp} value={form.point} onChange={(e) => setForm({ ...form, point: e.target.value })} /></div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}><button style={btnS} onClick={() => setForm(null)}>취소</button><button style={btnP} onClick={saveForm}>저장</button></div>
    </div>}</Modal>
    <MonthlyProposalModal open={!!pickFor} base={pickFor} data={data} setData={setData} onClose={() => setPickFor(null)} onProposal={(o) => setProposal(o)} onScope={(o) => setScope(o)} />
    <ProposalDraft open={!!proposal} item={proposal && proposal.item} pkgs={proposal && proposal.pkgs} data={data} setData={setData} onClose={() => setProposal(null)} />
    <ScopeDoc open={!!scope} item={scope && scope.item} pkg={scope && scope.pkg} data={data} setData={setData} onClose={() => setScope(null)} />
  </div>;
}
// ── 성과 분석 ─────────────────────────────────────────────────────
function getGoals(data) { return { feeGoal: 1000, contractGoal: 3, proposalGoal: 10, ...(data && data.goals ? data.goals : {}) }; }
const FUNNEL = [["f_lead", "잠재고객"], ["f_contacted", "1차 연락"], ["f_m1", "1차 미팅 예정"], ["f_docs_req", "자료 요청"], ["f_docs_recv", "자료 수령"], ["f_proposal", "제안서/리포트 발송"], ["f_quote", "견적 전달"], ["f_negotiate", "조건 조율"], ["f_preContract", "계약 예정"], ["f_contracted", "계약 완료"], ["f_hold", "보류"]];
function funnelStageOf(c) {
  const ps = c.proposalStatus;
  if (c.stage === "contracted" || ps === "계약 완료") return "f_contracted";
  if (ps === "보류" || c.stage === "hold" || c.stage === "lost") return "f_hold";
  if (ps === "계약 예정") return "f_preContract";
  if (ps === "조건 조율") return "f_negotiate";
  if (ps === "견적 전달") return "f_quote";
  const map = { lead: "f_lead", contacted: "f_contacted", meeting1_scheduled: "f_m1", docs_requested: "f_docs_req", docs_received: "f_docs_recv", proposal_sent: "f_proposal", decision_pending: "f_proposal", contracted: "f_contracted", hold: "f_hold" };
  return map[pipeColOf(c.stage)] || "f_lead";
}
function analyticsFunnel(data) {
  const all = getUniqueCustomers(data);
  const rows = FUNNEL.map(([key, label]) => { const cs = all.filter((c) => funnelStageOf(c) === key); return { key, label, count: cs.length, fee: cs.reduce((s, x) => s + expFee(x), 0) }; });
  const total = all.length || 1;
  let prev = null;
  return rows.map((r) => { const share = Math.round((r.count / total) * 100); let conv = null; if (r.key !== "f_hold" && r.key !== "f_lead" && prev !== null) conv = prev > 0 ? Math.round((r.count / prev) * 100) : 0; if (r.key !== "f_hold") prev = r.count; return { ...r, share, conv }; });
}
function productPerformance(data) {
  const all = getUniqueCustomers(data);
  const pkgs = getPackages(data);
  return pkgs.map((p) => {
    const proposed = all.filter((c) => (c.proposedPackages || []).includes(p.name));
    const quote = proposed.filter((c) => c.proposalStatus === "견적 전달");
    const contracted = proposed.filter((c) => c.proposalStatus === "계약 완료" || c.stage === "contracted");
    const propFee = proposed.reduce((s, x) => s + (Number(x.proposedFee) || Number(p.fee) || 0), 0);
    const contFee = contracted.reduce((s, x) => s + (Number(x.proposedFee) || Number(p.fee) || 0), 0);
    const avgFee = proposed.length ? Math.round(propFee / proposed.length) : (Number(p.fee) || 0);
    const conv = proposed.length ? Math.round((contracted.length / proposed.length) * 100) : 0;
    return { name: p.name, cat: p.cat, proposed: proposed.length, quote: quote.length, contracted: contracted.length, propFee, contFee, avgFee, conv };
  });
}
function lastActivityOf(c) { const ds = [(c.contacts && c.contacts[0] && c.contacts[0].date), c.stageMovedAt, c.proposedAt, c.nextDate].filter(Boolean); return ds.sort().slice(-1)[0] || ""; }
function focusCustomers(data) {
  const all = getUniqueCustomers(data).filter((c) => !["contracted", "lost"].includes(c.stage));
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
function riskSignals(data) {
  const all = getUniqueCustomers(data).filter((c) => !["contracted", "lost"].includes(c.stage));
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
// ── 날짜 안전 유틸 · 데이터 마이그레이션 ─────────────────────────────
function dParse(s) { if (!s) return null; if (s instanceof Date) return isNaN(s.getTime()) ? null : s; const d = new Date(s); return isNaN(d.getTime()) ? null : d; }
function dymd(s) { const d = dParse(s); if (!d) return ""; const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0"); return `${y}-${m}-${day}`; }
function dMonthKey(s) { const d = dParse(s); return d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` : ""; }
function monthKeyOffset(off) { const n = new Date(); const d = new Date(n.getFullYear(), n.getMonth() + off, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
function monthLabel(key) { if (!key) return ""; const [y, m] = key.split("-"); return `${y.slice(2)}.${m}`; }
// 기존 고객 데이터에 날짜 필드(createdAt/updatedAt/proposedAt/quotedAt/contractedAt/lastContactAt)를 보강한다. 없을 때만 채운다.
function migrateCustomerDates(c) {
  const hist = c.stageHistory || [];
  const histTo = (label) => { const e = hist.find((h) => h.to === label); return e ? dymd(e.date) : ""; };
  const contactDates = (c.contacts || []).map((x) => dymd(x.date)).filter(Boolean).sort();
  const lastContactAt = c.lastContactAt || (contactDates.length ? contactDates[contactDates.length - 1] : "");
  const proposedAt = c.proposedAt ? dymd(c.proposedAt) : (histTo("[제안] 제안 완료") || "");
  const quotedAt = c.quotedAt ? dymd(c.quotedAt) : (histTo("[제안] 견적 전달") || "");
  const isContracted = c.stage === "contracted" || c.proposalStatus === "계약 완료";
  const contractedAt = c.contractedAt ? dymd(c.contractedAt) : (histTo("[제안] 계약 완료") || (isContracted ? dymd(c.stageMovedAt) : ""));
  const createCand = [c.createdAt, proposedAt, dymd(c.stageMovedAt), ...contactDates, c.nextDate].map(dymd).filter(Boolean).sort();
  const createdAt = c.createdAt ? dymd(c.createdAt) : (createCand.length ? createCand[0] : todayISO());
  const updCand = [c.updatedAt, dymd(c.stageMovedAt), proposedAt, quotedAt, contractedAt, lastContactAt].map(dymd).filter(Boolean).sort();
  const updatedAt = c.updatedAt ? dymd(c.updatedAt) : (updCand.length ? updCand[updCand.length - 1] : createdAt);
  const fields = { createdAt, updatedAt, proposedAt, quotedAt, contractedAt, lastContactAt };
  let changed = false; const next = { ...c };
  Object.keys(fields).forEach((k) => { if (fields[k] && !c[k]) { next[k] = fields[k]; changed = true; } });
  return { rec: next, changed };
}
// 과거 샘플(현재 미배포)로 저장됐을 수 있는 원문 텍스트 정리 — 코드에 실제 업체명을 남기지 않도록
// 식별 문자열 대신 base64로 인코딩한 마커로만 비교(소스/번들에 평문 노출 안 함).
// 과거 샘플(현재 미배포)로 저장됐을 수 있는 실제 업체명 식별자 — 평문 노출 방지 위해 base64로만 보관 후 디코드해 비교
const _SAMPLE_SCRUB_MARKERS = ["7J207JWk7J207J2064W467Kg7J207IWY", "7ZmN6riw7KCV", "MTEzLTg2LTgyOTU3"]; // base64 인코딩 식별자(과거 샘플 원문 정리용) — 평문 미포함
let _SCRUB_DECODED = null;
function _scrubDecoded() { if (!_SCRUB_DECODED) { _SCRUB_DECODED = _SAMPLE_SCRUB_MARKERS.map((mk) => { try { return (typeof atob === "function") ? atob(mk) : (typeof Buffer !== "undefined" ? Buffer.from(mk, "base64").toString("utf8") : ""); } catch (e) { return ""; } }).filter(Boolean); } return _SCRUB_DECODED; }
function _scrubMatch(raw) { if (!raw) return false; const s = String(raw); return _scrubDecoded().some((m) => m && s.indexOf(m) >= 0); }
// 고객 레코드 정리: 샘플+실제업체명 → 삭제 / 직접 등록 → 이름 유지·재무텍스트만 제거 / 재무 관련 필드의 마커 제거
function scrubCustomerRecord(c) {
  if (!c) return { rec: c, changed: false, drop: false };
  const isSampleRec = c.sample === true || c.source === "sample" || c.source === "샘플";
  const nameHit = _scrubMatch(c.name) || _scrubMatch(c.ceoName) || _scrubMatch(getCompanyName ? getCompanyName(c) : "");
  if (isSampleRec && nameHit) return { rec: c, changed: true, drop: true };
  let changed = false; const rec = { ...c };
  const finFields = ["financialRawText", "financialSummary", "financialExtracted", "financialNumbers", "financialStructured", "financialSourceType", "financialWarnings", "memo", "concern"];
  for (const f of finFields) { const v = rec[f]; if (v != null && _scrubMatch(typeof v === "string" ? v : JSON.stringify(v))) { rec[f] = typeof v === "string" ? "" : (Array.isArray(v) ? [] : null); changed = true; } }
  if (nameHit && !isSampleRec) { rec.financialRawText = ""; changed = true; }
  if (changed) rec.financialScrubbed = true; // 민감정보 감지됨 — 재무자료만 제거(직접 등록 고객 이름은 유지)
  return { rec, changed, drop: false };
}
function _deepScrub(v) { if (typeof v === "string") { return _scrubMatch(v) ? { v: "", c: true } : { v, c: false }; } if (Array.isArray(v)) { let c = false; const out = v.map((x) => { const r = _deepScrub(x); if (r.c) c = true; return r.v; }); return { v: out, c }; } if (v && typeof v === "object") { let c = false; const o = {}; for (const k of Object.keys(v)) { const r = _deepScrub(v[k]); if (r.c) c = true; o[k] = r.v; } return { v: o, c }; } return { v, c: false }; }
// 앱 시작 시 localStorage 전체 key를 스캔해 실제 업체 식별자가 든 값 정리(메인 데이터는 고객 단위 처리)
function scrubLocalStorageOnce() { return 0; // [D-93] 이 OS 의 다른 기록까지 훑지 않는다
}
function _scrubLocalStorageOnceOrig() {
  if (typeof localStorage === "undefined") return 0;
  let total = 0;
  try {
    const keys = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k) keys.push(k); }
    for (const key of keys) {
      const raw = localStorage.getItem(key); if (!raw || !_scrubMatch(raw)) continue;
      if (key === SK) {
        try { const obj = JSON.parse(raw); let changed = false; const proc = (arr) => { const out = []; for (const c of (arr || [])) { const r = scrubCustomerRecord(c); if (r.changed) changed = true; if (!r.drop) out.push(r.rec); else total++; } return out; }; const nd = { ...obj, leads: proc(obj.leads), companies: proc(obj.companies) }; if (changed) { localStorage.setItem(SK, JSON.stringify(nd)); total++; } } catch (e) { }
      } else {
        try { const obj = JSON.parse(raw); const r = _deepScrub(obj); if (r.c) { localStorage.setItem(key, JSON.stringify(r.v)); total++; } } catch (e) { localStorage.removeItem(key); total++; }
      }
    }
  } catch (e) { if (typeof console !== "undefined") console.warn("[scrub] localStorage scrub 실패", e); }
  return total;
}
function migrateData(data) {
  if (!data) return data;
  let changed = false;
  const proc = (arr) => { const out = []; for (const c of (arr || [])) { let rec = c; const d = migrateCustomerDates(rec); if (d.changed) { changed = true; rec = d.rec; } const s = scrubCustomerRecord(rec); if (s.changed) { changed = true; if (s.drop) continue; rec = s.rec; } out.push(rec); } return out; };
  const leads = proc(data.leads), companies = proc(data.companies);
  return changed ? { ...data, leads, companies } : data;
}
// ── 기간 필터 ───────────────────────────────────────────────────────
const PERIOD_OPTIONS = [["all", "전체"], ["thisMonth", "이번 달"], ["lastMonth", "지난 달"], ["7d", "최근 7일"], ["30d", "최근 30일"], ["custom", "직접 선택"]];
function periodRange(period, cs, ce) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const monthStart = (off) => new Date(today.getFullYear(), today.getMonth() + off, 1);
  const monthEnd = (off) => new Date(today.getFullYear(), today.getMonth() + off + 1, 0);
  if (period === "thisMonth") return { start: dymd(monthStart(0)), end: dymd(monthEnd(0)) };
  if (period === "lastMonth") return { start: dymd(monthStart(-1)), end: dymd(monthEnd(-1)) };
  if (period === "7d") { const s = new Date(today); s.setDate(s.getDate() - 6); return { start: dymd(s), end: dymd(today) }; }
  if (period === "30d") { const s = new Date(today); s.setDate(s.getDate() - 29); return { start: dymd(s), end: dymd(today) }; }
  if (period === "custom") { const start = dymd(cs), end = dymd(ce); if (!start && !end) return null; return { start: start || "0000-01-01", end: end || "9999-12-31" }; }
  return null;
}
function periodLabel(range) { if (!range) return "전체 기간"; return `${range.start.replace(/-/g, ".")} ~ ${range.end.replace(/-/g, ".")}`; }
function inRange(dateStr, range) { if (!range) return true; const d = dymd(dateStr); if (!d) return false; return d >= range.start && d <= range.end; }
function custDates(c) { return [c.createdAt, c.proposedAt, c.quotedAt, c.contractedAt, c.stageMovedAt, c.nextDate, c.lastContactAt, ...((c.contacts || []).map((x) => x.date))].filter(Boolean); }
function custInRange(c, range) { if (!range) return true; return custDates(c).some((d) => inRange(d, range)); }
function filterDataByPeriod(data, range) { if (!range) return data; return { ...data, leads: (data.leads || []).filter((c) => custInRange(c, range)), companies: (data.companies || []).filter((c) => custInRange(c, range)) }; }
// ── 월별 집계 · 비교 ────────────────────────────────────────────────
function isContractedCust(c) { return c.proposalStatus === "계약 완료" || c.stage === "contracted"; }
function contractDateOf(c) { return c.contractedAt ? dymd(c.contractedAt) : (isContractedCust(c) ? dymd(c.stageMovedAt || c.updatedAt) : ""); }
function monthlyStats(data, mkey) {
  const all = getUniqueCustomers(data);
  const inM = (s) => !!mkey && dMonthKey(s) === mkey;
  const newCust = all.filter((c) => inM(c.createdAt));
  const proposed = all.filter((c) => inM(c.proposedAt));
  const quote = all.filter((c) => inM(c.quotedAt));
  const contracted = all.filter((c) => isContractedCust(c) && inM(contractDateOf(c)));
  const contractFee = contracted.reduce((s, x) => s + (Number(x.proposedFee) || expFee(x)), 0);
  const today = todayISO();
  const followLate = all.filter((c) => c.nextDate && dMonthKey(c.nextDate) === mkey && dymd(c.nextDate) < today && !["contracted", "lost"].includes(c.stage));
  return { mkey, newCust: newCust.length, proposed: proposed.length, quote: quote.length, contracted: contracted.length, contractFee, followLate: followLate.length };
}
function monthCompare(data) { return { cur: monthlyStats(data, monthKeyOffset(0)), prev: monthlyStats(data, monthKeyOffset(-1)) }; }
function monthlyTrend(data, n) { const out = []; for (let i = (n || 6) - 1; i >= 0; i--) out.push(monthlyStats(data, monthKeyOffset(-i))); return out; }
function deltaInfo(cur, prev) { const diff = cur - prev; if (prev === 0) return { diff, txt: cur === 0 ? "0%" : "신규 발생", col: cur === 0 ? C.textM : C.ok }; const r = Math.round((diff / prev) * 100); return { diff, txt: (r > 0 ? "+" : "") + r + "%", col: r > 0 ? C.ok : r < 0 ? C.err : C.textM }; }
function productMonthlyCompare(data) {
  const all = getUniqueCustomers(data);
  const cm = monthKeyOffset(0), lm = monthKeyOffset(-1);
  return getPackages(data).map((p) => {
    const pool = all.filter((c) => (c.proposedPackages || []).includes(p.name));
    const propCur = pool.filter((c) => dMonthKey(c.proposedAt) === cm).length;
    const propPrev = pool.filter((c) => dMonthKey(c.proposedAt) === lm).length;
    const contCur = pool.filter((c) => isContractedCust(c) && dMonthKey(contractDateOf(c)) === cm).length;
    const contPrev = pool.filter((c) => isContractedCust(c) && dMonthKey(contractDateOf(c)) === lm).length;
    let badge = null;
    if (contCur > contPrev) badge = { t: "성장", col: C.ok, bg: C.greenBg };
    else if (contCur > 0) badge = { t: "계약 발생", col: C.gold, bg: C.warnBg };
    else if (propCur > propPrev) badge = { t: "제안 증가", col: C.sky, bg: C.blueBg };
    else if (propCur || propPrev || contCur || contPrev) badge = { t: "검토 필요", col: C.warn, bg: C.warnBg };
    return { name: p.name, cat: p.cat, propCur, propPrev, contCur, contPrev, badge };
  }).filter((r) => r.propCur || r.propPrev || r.contCur || r.contPrev).sort((a, b) => (b.contCur - a.contCur) || (b.propCur - a.propCur));
}
// ── CSV 내보내기 ────────────────────────────────────────────────────
function csvCell(v) { const s = (v === undefined || v === null) ? "" : String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
function buildCSV(headers, rows) { const lines = [headers.map(csvCell).join(",")]; rows.forEach((r) => lines.push(r.map(csvCell).join(","))); return "﻿" + lines.join("\r\n"); }
function downloadCSV(name, headers, rows) {
  if (!rows || rows.length === 0) { showToast("내보낼 데이터가 없습니다."); return; }
  if (typeof document === "undefined") return;
  const blob = new Blob([buildCSV(headers, rows)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `corp-sales-${name}-${todayISO().replace(/-/g, "")}.csv`; a.click(); URL.revokeObjectURL(url);
  showToast("CSV 파일을 내려받습니다.");
}
function csvCustomers(data) {
  const all = [...(data.leads || []), ...(data.companies || [])];
  const headers = ["업체명", "대표", "업종", "지역", "영업단계", "제안상태", "관심주제", "예상수임료(만원)", "제안수임료(만원)", "유입경로", "등록일", "제안일", "견적일", "계약일", "다음 연락예정일", "최근활동일"];
  const rows = all.map((c) => [getCompanyName(c) || c.name || "", c.ceoName || "", c.industry || "", c.region || "", stageOf(c.stage).label, c.proposalStatus || "제안 전", (c.interests || []).join(" / "), Number(c.expectedFee) || 0, Number(c.proposedFee) || 0, (c.source === "sample" ? "샘플" : c.source) || "", c.createdAt || "", c.proposedAt || "", c.quotedAt || "", c.contractedAt || "", c.nextDate || "", lastActivityOf(c) || ""]);
  return { headers, rows };
}
function csvAnalytics(data) {
  const f = analyticsFunnel(data);
  const headers = ["퍼널 단계", "고객 수", "예상 수임료(만원)", "비중(%)", "전환율(%)"];
  const rows = f.map((r) => [r.label, r.count, r.fee, r.share, r.conv === null ? "" : r.conv]);
  return { headers, rows };
}
function csvProducts(data) {
  const p = productPerformance(data);
  const headers = ["상품/패키지", "카테고리", "제안 건수", "견적 건수", "계약 건수", "제안 수임료(만원)", "계약 수임료(만원)", "평균 수임료(만원)", "계약 준비율(%)"];
  const rows = p.map((x) => [x.name, x.cat, x.proposed, x.quote, x.contracted, x.propFee, x.contFee, x.avgFee, x.conv]);
  return { headers, rows };
}
function csvFollowups(data) {
  const all = [...(data.leads || []), ...(data.companies || [])];
  const headers = ["업체명", "다음 연락 상태", "다음 연락 예정일", "영업단계", "제안상태", "다음 액션", "예상수임료(만원)"];
  const rows = [];
  all.forEach((c) => { const fs = followStatus(c); if (fs) rows.push([getCompanyName(c) || c.name || "", fs.t, c.nextDate || "", stageOf(c.stage).label, c.proposalStatus || "제안 전", c.nextAction || "", Number(c.expectedFee) || 0]); });
  return { headers, rows };
}
function Analytics({ data, setData, goMeeting }) {
  const [sortBy, setSortBy] = useState("contFee");
  const [catF, setCatF] = useState("전체");
  const [scope, setScope] = useState(null);
  const [g, setG] = useState(getGoals(data));
  const [period, setPeriod] = useState("all");
  const [cs, setCs] = useState("");
  const [ce, setCe] = useState("");
  const [applied, setApplied] = useState({ s: "", e: "" });
  const [showAllKpi, setShowAllKpi] = useState(false);
  const range = period === "custom" ? periodRange("custom", applied.s, applied.e) : periodRange(period);
  const fdata = filterDataByPeriod(data, range);
  const fAll = (fdata.leads || []).length + (fdata.companies || []).length;
  const m = salesMetrics(data);
  const funnel = analyticsFunnel(fdata);
  const maxCount = Math.max(1, ...funnel.map((f) => f.count));
  const goals = getGoals(data);
  const pct = (cur, goal) => goal > 0 ? Math.min(100, Math.round((cur / goal) * 100)) : 0;
  let perf = productPerformance(fdata).filter((p) => catF === "전체" || p.cat === catF);
  perf = perf.sort((a, b) => sortBy === "contFee" ? b.contFee - a.contFee : sortBy === "propFee" ? b.propFee - a.propFee : sortBy === "conv" ? b.conv - a.conv : b.proposed - a.proposed);
  const focus = focusCustomers(fdata);
  const risks = riskSignals(fdata);
  const cmp = monthCompare(data);
  const cmpRows = [
    { label: "신규 고객", cur: cmp.cur.newCust, prev: cmp.prev.newCust, unit: "명", col: C.blue },
    { label: "제안", cur: cmp.cur.proposed, prev: cmp.prev.proposed, unit: "명", col: C.sky },
    { label: "견적", cur: cmp.cur.quote, prev: cmp.prev.quote, unit: "명", col: C.purple },
    { label: "계약", cur: cmp.cur.contracted, prev: cmp.prev.contracted, unit: "건", col: C.ok },
    { label: "계약 수임료", cur: cmp.cur.contractFee, prev: cmp.prev.contractFee, unit: "fee", col: C.gold },
    { label: "다음 연락 지연", cur: cmp.cur.followLate, prev: cmp.prev.followLate, unit: "건", col: C.err, inverse: true },
  ];
  const trend = monthlyTrend(data, 6);
  const maxFee = Math.max(1, ...trend.map((t) => t.contractFee));
  const trendEmpty = trend.every((t) => !t.newCust && !t.proposed && !t.contracted && !t.contractFee);
  const pmc = productMonthlyCompare(data);
  const riskNow = riskSignals(data).length;
  const focusNow = focusCustomers(data).length;
  const bar = (w, col) => <div style={{ height: 10, background: "#EEF2F7", borderRadius: 6, overflow: "hidden", marginTop: 6 }}><div style={{ width: `${Math.max(0, Math.min(100, w))}%`, height: "100%", background: col, borderRadius: 6 }} /></div>;
  return <div>
    <SalesMetrics data={fdata} />
    <AccordionSection data={data} setData={setData} screenKey="analytics" sectionKey="detail" title="📊 상세 분석 (기간·퍼널·월별 추이·상품별 성과·CSV)" subtitle="기간 선택, 단계 퍼널, 월별 추이, 상품별 성과, CSV 내보내기를 펼쳐서 봅니다. 위 핵심 지표는 항상 표시됩니다." important defaultOpen={false}>
    <Card style={{ padding: 20, marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}><h3 style={{ margin: 0, fontSize: "calc(var(--s,1.3)*20px)" }}>🗓️ 기간 · 내보내기</h3><span style={{ fontSize: "calc(var(--s,1.3)*14px)", color: C.textM }}>기간 <b style={{ color: C.textS }}>{periodLabel(range)}</b> · 대상 {fAll}명</span></div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>{PERIOD_OPTIONS.map(([k, l]) => <PillButton key={k} active={period === k} onClick={() => setPeriod(k)}>{l}</PillButton>)}</div>
      {period === "custom" && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 10 }}>
        <div><Label>시작일</Label><input type="date" style={{ ...inp, width: "auto", marginBottom: 0 }} value={cs} onChange={(e) => setCs(e.target.value)} /></div>
        <div><Label>종료일</Label><input type="date" style={{ ...inp, width: "auto", marginBottom: 0 }} value={ce} onChange={(e) => setCe(e.target.value)} /></div>
        <button style={btnP} onClick={() => { if (!cs && !ce) { showToast("시작일 또는 종료일을 선택하세요."); return; } setApplied({ s: cs, e: ce }); showToast("기간을 적용했습니다."); }}>적용</button>
        {(applied.s || applied.e) && <button style={btnSm} onClick={() => { setCs(""); setCe(""); setApplied({ s: "", e: "" }); }}>초기화</button>}
      </div>}
      <div style={{ borderTop: `1px solid ${C.bdr}`, paddingTop: 10 }}>
        <div style={{ fontSize: "calc(var(--s,1.3)*14px)", color: C.textM, fontWeight: 700, marginBottom: 6 }}>엑셀로 내보내기(CSV)<Help text="CSV는 엑셀에서 바로 열 수 있는 표 형식 파일입니다. 한글이 깨지지 않게 저장되며, 선택한 기간이 반영됩니다." /> · 선택한 기간 반영</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button style={btnSm} onClick={() => { const r = csvCustomers(fdata); downloadCSV("customers", r.headers, r.rows); }}>📥 고객 목록</button>
          <button style={btnSm} onClick={() => { const r = csvAnalytics(fdata); downloadCSV("analytics", r.headers, r.rows); }}>📥 성과 분석</button>
          <button style={btnSm} onClick={() => { const r = csvProducts(fdata); downloadCSV("products", r.headers, r.rows); }}>📥 상품별 성과</button>
          <button style={btnSm} onClick={() => { const r = csvFollowups(fdata); downloadCSV("followups", r.headers, r.rows); }}>📥 다음 연락 대상</button>
        </div>
      </div>
    </Card>
    <Card style={{ padding: 20, marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}><h3 style={{ margin: 0, fontSize: "calc(var(--s,1.3)*20px)" }}>📊 이번 달 vs 지난 달</h3><span style={{ fontSize: "calc(var(--s,1.3)*14px)", color: C.textM }}>{monthLabel(monthKeyOffset(0))} 기준 · 지난달 {monthLabel(monthKeyOffset(-1))}</span></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10 }}>{cmpRows.map((r) => { const d = deltaInfo(r.cur, r.prev); const dcol = r.inverse ? (d.col === C.ok ? C.err : d.col === C.err ? C.ok : d.col) : d.col; const curTxt = r.unit === "fee" ? feeMoney(r.cur) : r.cur + r.unit; const prevTxt = r.unit === "fee" ? feeMoney(r.prev) : r.prev + r.unit; return <div key={r.label} style={{ background: C.bg, borderRadius: 11, padding: 14 }}>
        <div style={{ fontSize: "calc(var(--s,1.3)*14px)", color: C.textM, fontWeight: 700 }}>{r.label}</div>
        <div style={{ fontSize: "calc(var(--s,1.3)*22px)", fontWeight: 900, color: r.col, marginTop: 4, lineHeight: 1.2 }}>{curTxt}</div>
        <div style={{ fontSize: "calc(var(--s,1.3)*13px)", color: C.textM, marginTop: 4 }}>지난달 {prevTxt} · <b style={{ color: dcol }}>{d.txt}</b></div>
      </div>; })}</div>
      <div style={{ marginTop: 10, fontSize: "calc(var(--s,1.3)*14px)", color: C.textM }}>현재 시점 기준 · 위험 신호 <b style={{ color: C.err }}>{riskNow}건</b> · 이번 주 집중 고객 <b style={{ color: C.blue }}>{focusNow}명</b></div>
    </Card>
    <Card style={{ padding: 20, marginBottom: 14 }}>
      <h3 style={{ margin: "0 0 12px", fontSize: "calc(var(--s,1.3)*20px)" }}>📈 월별 추이 (최근 6개월)</h3>
      {trendEmpty ? <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*15px)" }}>표시할 월별 데이터가 아직 없습니다. 고객을 등록하고 제안·계약 상태를 갱신하면 추이가 쌓입니다.</div> : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10 }}>{trend.map((t) => <div key={t.mkey} style={{ background: C.bg, borderRadius: 11, padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}><b style={{ fontSize: "calc(var(--s,1.3)*15px)" }}>{monthLabel(t.mkey)}</b><Badge color={C.ok} bg={C.greenBg}>{t.contracted}건</Badge></div>
        <div style={{ fontSize: "calc(var(--s,1.3)*18px)", fontWeight: 900, color: C.gold, margin: "6px 0 2px" }}>{feeMoney(t.contractFee)}</div>
        {bar(Math.round((t.contractFee / maxFee) * 100), C.gold)}
        <div style={{ fontSize: "calc(var(--s,1.3)*13px)", color: C.textM, marginTop: 8, lineHeight: 1.6 }}>신규 {t.newCust} · 제안 {t.proposed} · 견적 {t.quote}</div>
      </div>)}</div>}
    </Card>
    <Card style={{ padding: 20, marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}><h3 style={{ margin: 0, fontSize: "calc(var(--s,1.3)*20px)" }}>🎯 이번 달 목표</h3><button style={btnP} onClick={() => { setData({ ...data, goals: { feeGoal: Number(g.feeGoal) || 0, contractGoal: Number(g.contractGoal) || 0, proposalGoal: Number(g.proposalGoal) || 0 } }); showToast("목표를 저장했습니다."); }}>저장</button></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 12 }}>
        {[["목표 수임료(만원)", "feeGoal", m.contractedFeeSum, goals.feeGoal, C.gold, feeMoney(m.contractedFeeSum) + " / " + feeMoney(goals.feeGoal)], ["목표 계약 건수", "contractGoal", m.done, goals.contractGoal, C.ok, m.done + " / " + goals.contractGoal + "건"], ["목표 제안 건수", "proposalGoal", m.proposed, goals.proposalGoal, C.sky, m.proposed + " / " + goals.proposalGoal + "건"]].map((row) => <div key={row[1]} style={{ background: C.bg, borderRadius: 11, padding: 14 }}>
          <Label>{row[0]}</Label><input type="number" style={{ ...inp, marginBottom: 8 }} value={g[row[1]]} onChange={(e) => setG({ ...g, [row[1]]: e.target.value })} />
          <div style={{ fontSize: "calc(var(--s,1.3)*15px)", color: C.textS }}>{row[5]} · <b style={{ color: row[4] }}>{pct(row[2], row[3])}%</b></div>{bar(pct(row[2], row[3]), row[4])}
        </div>)}
      </div>
    </Card>
    <Card style={{ padding: 20, marginBottom: 14 }}>
      <h3 style={{ margin: "0 0 12px", fontSize: "calc(var(--s,1.3)*20px)" }}>📉 영업 퍼널</h3>
      <div style={{ display: "grid", gap: 8 }}>{funnel.map((f) => <div key={f.key} style={{ background: C.bg, borderRadius: 11, padding: "12px 14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}><b style={{ fontSize: "calc(var(--s,1.3)*15px)" }}>{f.label}</b><span style={{ fontSize: "calc(var(--s,1.3)*14px)", color: C.textM }}>{f.count}명 · {feeMoney(f.fee)} · 비중 {f.share}%{f.conv !== null ? ` · 전환 ${f.conv}%` : ""}</span></div>
        {bar(Math.round((f.count / maxCount) * 100), f.key === "f_hold" ? C.textM : f.key === "f_contracted" ? C.ok : C.gold)}
      </div>)}</div>
    </Card>
    <Card style={{ padding: 20, marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}><h3 style={{ margin: 0, fontSize: "calc(var(--s,1.3)*20px)" }}>📦 상품/패키지별 성과</h3><select style={{ ...inp, width: "auto", marginBottom: 0 }} value={sortBy} onChange={(e) => setSortBy(e.target.value)}><option value="contFee">계약 수임료 높은 순</option><option value="propFee">제안 수임료 높은 순</option><option value="conv">계약 준비율 높은 순</option><option value="proposed">제안 고객 수 많은 순</option></select></div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>{["전체", ...PKG_CATEGORIES].map((c) => <PillButton key={c} active={catF === c} onClick={() => setCatF(c)}>{c}</PillButton>)}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 12 }}>{perf.map((p) => <div key={p.name} style={{ background: C.bg, borderRadius: 11, padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "start" }}><b style={{ fontSize: "calc(var(--s,1.3)*15px)" }}>{p.name}</b><Badge color={C.sky} bg={C.blueBg}>{p.cat}</Badge></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, margin: "10px 0", fontSize: "calc(var(--s,1.3)*14px)" }}><div><Label>제안</Label><b>{p.proposed}건</b></div><div><Label>견적</Label><b>{p.quote}건</b></div><div><Label>계약</Label><b style={{ color: C.ok }}>{p.contracted}건</b></div></div>
        <div style={{ fontSize: "calc(var(--s,1.3)*14px)", color: C.textM, lineHeight: 1.7 }}>제안 수임료 {feeMoney(p.propFee)} · 계약 {feeMoney(p.contFee)}<br />평균 {feeMoney(p.avgFee)} · 전환율 <b style={{ color: C.gold }}>{p.conv}%</b></div>
      </div>)}</div>
    </Card>
    <Card style={{ padding: 20, marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}><h3 style={{ margin: 0, fontSize: "calc(var(--s,1.3)*20px)" }}>🆚 상품별 월간 성과 비교</h3><span style={{ fontSize: "calc(var(--s,1.3)*14px)", color: C.textM }}>{monthLabel(monthKeyOffset(0))} vs {monthLabel(monthKeyOffset(-1))}</span></div>
      {pmc.length === 0 ? <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*15px)" }}>이번 달·지난 달 제안/계약 활동이 있는 상품이 아직 없습니다. 제안·계약 상태를 갱신하면 비교가 채워집니다.</div> : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 12 }}>{pmc.map((p) => <div key={p.name} style={{ background: C.bg, borderRadius: 11, padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "start" }}><b style={{ fontSize: "calc(var(--s,1.3)*15px)" }}>{p.name}</b>{p.badge && <Badge color={p.badge.col} bg={p.badge.bg}>{p.badge.t}</Badge>}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 10, fontSize: "calc(var(--s,1.3)*14px)" }}>
          <div><Label>제안 이번/지난</Label><b style={{ color: C.sky }}>{p.propCur}</b> <span style={{ color: C.textM }}>/ {p.propPrev}</span></div>
          <div><Label>계약 이번/지난</Label><b style={{ color: C.ok }}>{p.contCur}</b> <span style={{ color: C.textM }}>/ {p.contPrev}</span></div>
        </div>
      </div>)}</div>}
    </Card>
    <Card style={{ padding: 20, marginBottom: 14 }}>
      <h3 style={{ margin: "0 0 12px", fontSize: "calc(var(--s,1.3)*20px)" }}>🔥 이번 주 집중 고객</h3>
      {focus.length === 0 ? <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*15px)" }}>표시할 고객이 없습니다. 샘플 데이터를 넣거나 고객을 등록해보세요.</div> : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 12 }}>{focus.map((o) => { const c = o.c; const bd = scoreBand(scoreLead(c)); const pk = matchPackages(c, getPackages(data))[0]; return <div key={c.id} style={{ background: C.bg, borderRadius: 11, padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}><b style={{ fontSize: "calc(var(--s,1.3)*16px)" }}>{getCompanyName(c) || c.name}</b><Badge color={bd.color} bg={bd.bg}>{scoreLead(c)} · {bd.short}</Badge></div>
        <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*14px)", margin: "6px 0" }}>{stageOf(c.stage).label}{c.proposalStatus && c.proposalStatus !== "제안 전" ? ` · ${c.proposalStatus}` : ""} · {feeMoney(c.expectedFee || (pk && pk.pkg.fee) || 0)}</div>
        <div style={{ color: C.textS, fontSize: "calc(var(--s,1.3)*14px)", marginBottom: 4 }}>💡 {o.why}</div>
        <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*14px)", marginBottom: 10 }}>다음 액션: {c.nextAction || (pk && pk.pkg.name) || "점검"}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><button style={btnSm} onClick={() => goMeeting && goMeeting(c.id)}>미팅 준비</button>{pk && <button style={btnSm} onClick={() => setScope({ item: c, pkg: pk.pkg })}>업무범위서</button>}<button style={btnSm} onClick={() => copyText(followUpKakao(c), () => showToast("복사되었습니다."))}>다음 연락 문구</button></div>
      </div>; })}</div>}
    </Card>
    <Card style={{ padding: 20, marginBottom: 14 }}>
      <h3 style={{ margin: "0 0 12px", fontSize: "calc(var(--s,1.3)*20px)", color: C.err }}>⚠️ 영업 위험 신호 ({risks.length})</h3>
      {risks.length === 0 ? <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*15px)" }}>현재 감지된 위험 신호가 없습니다.</div> : <div style={{ display: "grid", gap: 8 }}>{risks.map((r) => <div key={r.c.id} style={{ background: C.bg, borderRadius: 11, padding: 14, borderLeft: `3px solid ${C.err}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap" }}><b style={{ fontSize: "calc(var(--s,1.3)*16px)" }}>{getCompanyName(r.c) || r.c.name}</b><span style={{ color: C.err, fontSize: "calc(var(--s,1.3)*14px)", fontWeight: 700 }}>{r.reason}</span></div>
        <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*14px)", margin: "6px 0" }}>마지막 활동: {r.last} · 권장: {r.action}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><button style={btnSm} onClick={() => goMeeting && goMeeting(r.c.id)}>미팅 준비</button><button style={btnSm} onClick={() => copyText(followUpKakao(r.c), () => showToast("복사되었습니다."))}>다음 연락 문구</button></div>
      </div>)}</div>}
    </Card>
    </AccordionSection>
    <ScopeDoc open={!!scope} item={scope && scope.item} pkg={scope && scope.pkg} data={data} setData={setData} onClose={() => setScope(null)} />
  </div>;
}
function Pipeline({ data, setData, goMeeting }) {
  const [pick, setPick] = useState("전체");
  const [rep, setRep] = useState(null);
  const all = getUniqueCustomers(data);
  const byCol = (key) => all.filter((c) => pipe6Of(c.stage) === key);
  const holdList = all.filter((c) => pipe6Of(c.stage) === "hold");
  const cols = pick === "전체" ? PIPE6 : PIPE6.filter((p) => p.key === pick);
  const card = (c) => {
    const src = sourceTag(c); const bd = scoreBand(scoreLead(c)); const fs = followStatus(c);
    return <div key={c.id} style={{ background: C.bg, border: "1px solid " + C.bdr, borderRadius: 11, padding: 12, marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}><b style={{ fontSize: "calc(var(--s,1.3)*16px)" }}>{getCompanyName(c) || c.name}</b><div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}><Badge color={src.color} bg={src.bg}>{src.label}</Badge>{c.proposalStatus && c.proposalStatus !== "제안 전" && <Badge color={(PROPOSAL_STATE_STYLE[c.proposalStatus] || PROPOSAL_STATE_STYLE["제안 전"])[0]} bg={(PROPOSAL_STATE_STYLE[c.proposalStatus] || PROPOSAL_STATE_STYLE["제안 전"])[1]}>{c.proposalStatus}</Badge>}</div></div>
      <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*12px)", margin: "2px 0 4px" }}>세부 단계: {stageOf(c.stage).label}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "6px 0" }}>{(c.interests || []).slice(0, 3).map((x) => <Badge key={x} color={C.sky} bg={C.blueBg}>{x}</Badge>)}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}><span><b style={{ color: bd.color, fontSize: "calc(var(--s,1.3)*18px)" }}>{scoreLead(c)}</b> <span style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*14px)" }}>{bd.short}</span></span>{fs && <Badge color={fs.c} bg={fs.b}>{fs.t}</Badge>}</div>
      <div style={{ fontSize: "calc(var(--s,1.3)*14px)", color: C.textM, marginTop: 6 }}>다음 액션: {c.nextAction || (recommendedStrategiesFor(c)[0] && recommendedStrategiesFor(c)[0].name) || "점검"}{c.nextDate ? ` · ${c.nextDate}` : ""}</div>
      {c.memo && <div style={{ fontSize: "calc(var(--s,1.3)*14px)", color: C.textS, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>📝 {c.memo}</div>}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
        <select style={{ ...inp, padding: "calc(var(--s,1.3)*8px) 10px", flex: 1, minWidth: 130 }} value={pipe6Of(c.stage)} onChange={(e) => { const col = e.target.value; if (col !== pipe6Of(c.stage)) { const t = PIPE6_ALL.find((p) => p.key === col); if (t) changeStage(data, setData, c, t.set); } }}>{PIPE6_ALL.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}</select>
        <button style={btnSm} onClick={() => goMeeting && goMeeting(c.id)}>미팅</button>
        <button style={btnSm} onClick={() => setRep(c)}>리포트</button>
      </div>
    </div>;
  };
  return <div>
    <SalesMetrics data={data} />
    <p style={{ color: C.textS, fontSize: "calc(var(--s,1.3)*16px)", lineHeight: 1.6, margin: "0 0 12px" }}>핵심 <b>6단계</b>로 영업 진행을 관리합니다. 카드의 단계 드롭다운으로 단계를 바꾸면 진행 이력이 기록됩니다(세부 단계는 카드 안에 표시). 보류·장기관리 고객은 아래 별도 섹션에 있습니다.</p>
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>{[["전체", all.length - holdList.length]].concat(PIPE6.map((p) => [p.key, byCol(p.key).length])).map((kn) => { const k = kn[0]; const lbl = k === "전체" ? "전체" : PIPE6.find((p) => p.key === k).label; return <PillButton key={k} active={pick === k} onClick={() => setPick(k)}>{lbl} {kn[1]}</PillButton>; })}</div>
    <AccordionSection data={data} setData={setData} screenKey="pipeline" sectionKey="board" title="📋 단계별 파이프라인 (핵심 6단계)" subtitle="위 단계 필터로 좁히고, 카드의 단계 드롭다운으로 단계를 바꿀 수 있습니다." count={all.length - holdList.length} important defaultOpen={false}>
    {all.length === 0 ? <Card style={{ padding: 40, textAlign: "center" }}><p style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*16px)", lineHeight: 1.7, marginBottom: 14 }}>관리할 고객이 없습니다. 샘플 데이터를 넣거나 고객을 등록해보세요.</p><SampleCTA data={data} setData={setData} /></Card> : <div className="pipeBoard" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-start" }}>
      {cols.map((p) => { const list = byCol(p.key).slice().sort((a, b) => scoreLead(b) - scoreLead(a)); const colFee = list.reduce((s, c) => s + expFee(c), 0); const avg = list.length ? Math.round(list.reduce((s, c) => s + scoreLead(c), 0) / list.length) : 0; const colOver = list.filter((c) => { const f = followStatus(c); return f && f.kind === "overdue"; }).length; return <div key={p.key} className="pipeCol" style={{ flex: "1 1 300px", minWidth: 0, background: C.card2, border: "1px solid " + C.bdr, borderRadius: 14, padding: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}><b style={{ fontSize: "calc(var(--s,1.3)*16px)" }}>{p.label}</b><Badge color={C.gold} bg="#FCEFDA">{list.length}건</Badge></div>
        <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*12px)", marginBottom: 6 }}>{p.desc}</div>
        <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*13px)", marginBottom: 10, lineHeight: 1.5 }}>예상 {feeMoney(colFee)} · 평균 {avg}점{colOver > 0 ? <span style={{ color: C.err }}> · 지연 {colOver}건</span> : ""}</div>
        {list.length === 0 ? <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*14px)", padding: 6 }}>—</div> : list.map(card)}
      </div>; })}
    </div>}
    </AccordionSection>
    <AccordionSection data={data} setData={setData} screenKey="pipeline" sectionKey="hold" title="⏸️ 보류·장기관리 고객" count={holdList.length} defaultOpen={false}>
      {holdList.length === 0 ? <div style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*14px)", padding: 4 }}>보류·장기관리 고객이 없습니다.</div> : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 8 }}>{holdList.map(card)}</div>}
    </AccordionSection>
    <VisitReport open={!!rep} item={rep} data={data} setData={setData} onClose={() => setRep(null)} />
  </div>;
}

// ── 출시 전 점검(QA)·문제 제보·버전 표시 ──────────────────────────────
function lsBytes() { try { return (localStorage.getItem(SK) || "").length; } catch (e) { return 0; } }
// 실제 업체 잔재(과거 샘플 원문) 노출 여부 자동 점검 — base64 마커 디코드 후 고객 텍스트 스캔(평문 미포함)
function hasRealCompanyResidue(data) {
  try { const marks = _scrubDecoded(); if (!marks.length) return false; const cust = [...((data && data.leads) || []), ...((data && data.companies) || [])]; const blob = cust.map((c) => `${c.name || ""} ${c.ceoName || ""} ${c.memo || ""} ${c.concern || ""} ${c.financialRawText || ""}`).join(" "); return marks.some((m) => m && blob.includes(m)); } catch (e) { return false; }
}
function buildProblemReport(data, tabKey, includeStats) {
  const cust = [...((data && data.leads) || []), ...((data && data.companies) || [])];
  const sample = cust.filter(isSample).length;
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "(unknown)";
  const vw = typeof window !== "undefined" ? `${window.innerWidth}x${window.innerHeight}` : "-";
  const L = ["[법인컨설팅 세일즈 OS 문제 제보용 정보]", "아래 내용을 개발자에게 전달해주세요. (고객 원문·재무 rawText는 포함되지 않습니다)", "",
    `· 앱: ${APP_RELEASE.name} ${APP_RELEASE.version}`, `· 빌드: ${APP_RELEASE.build}`, `· 저장방식: ${APP_RELEASE.storage}`, `· 재무분석 모듈: ${APP_RELEASE.finModule}`,
    `· 현재 화면/메뉴: ${tabKey || "-"}`, `· 브라우저: ${ua}`, `· 화면 크기: ${vw}`, `· localStorage 사용량: ${(lsBytes() / 1024).toFixed(1)} KB`, `· 최근 오류 메시지: ${_LAST_ERROR || "없음"}`];
  if (includeStats) L.push(`· 데이터 통계(개수만): 전체 ${cust.length} · 샘플 ${sample} · 직접등록 ${cust.length - sample} · 리드 ${(data.leads || []).length} · 고객사 ${(data.companies || []).length} · 할일 ${(data.todos || []).length}`);
  return L.join("\n");
}
const RELEASE_CHECKS = [
  { id: "sample", label: "샘플 데이터 삭제/교체 정상 작동" },
  { id: "cust", label: "고객 등록/수정/삭제 정상 작동" },
  { id: "paste", label: "재무자료 표 텍스트 분석 정상 작동" },
  { id: "beta", label: "크레탑 숫자 추출기 BETA 표시", auto: () => true },
  { id: "meeting", label: "1차 미팅 요약 생성 정상 작동" },
  { id: "report", label: "제안서 초안 생성 정상 작동" },
  { id: "quote", label: "견적/업무범위서 생성 정상 작동" },
  { id: "sim", label: "월납 시뮬레이터 정상 작동" },
  { id: "followup", label: "다음 연락 관리 정상 작동" },
  { id: "backup", label: "백업/복원 정상 작동" },
  { id: "mobile", label: "모바일 화면 깨짐 없음" },
  { id: "phrase", label: "금지 표현 없음" },
  { id: "realco", label: "실제 업체 샘플 노출 없음", auto: (data) => !hasRealCompanyResidue(data) },
];
function ReleaseChecklist({ data, setData }) {
  const checks = (data && data.qaChecks) || {};
  const items = RELEASE_CHECKS.map((it) => { const auto = it.auto ? it.auto(data) : null; const done = auto != null ? auto : !!checks[it.id]; return { ...it, auto, done }; });
  const total = items.length; const doneN = items.filter((x) => x.done).length; const pct = Math.round((doneN / total) * 100);
  const toggle = (id) => setData({ ...data, qaChecks: { ...checks, [id]: !checks[id] } });
  return <Card style={{ padding: 20, border: `1px solid ${C.gold}55` }}>
    <h3 style={{ marginTop: 0, fontSize: "calc(var(--s,1.3)*20px)" }}>✅ 출시 전 점검 (QA 체크리스트)</h3>
    <p style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*14px)", lineHeight: 1.6, margin: "0 0 12px" }}>정식 배포 전 아래 항목을 직접 점검하고 체크하세요. 일부는 자동 점검됩니다. 체크 상태는 이 브라우저에 저장됩니다.</p>
    <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
      <div style={{ flex: "1 1 200px", minWidth: 160, height: 12, background: C.bg, borderRadius: 999, overflow: "hidden", border: `1px solid ${C.bdr}` }}><div style={{ width: pct + "%", height: "100%", background: pct >= 100 ? C.ok : pct >= 70 ? C.gold : C.warn }} /></div>
      <div style={{ fontWeight: 900, fontSize: "calc(var(--s,1.3)*18px)", color: pct >= 100 ? C.ok : C.gold }}>출시 준비도 {pct}%</div>
    </div>
    <div style={{ color: C.textS, fontSize: "calc(var(--s,1.3)*14px)", marginBottom: 12 }}>{pct >= 100 ? "모든 점검 항목을 확인했습니다. 정식 배포 준비 완료." : `정식 배포 전 ${total - doneN}개 항목을 더 확인해주세요.`}</div>
    <div style={{ display: "grid", gap: 6 }}>
      {items.map((x) => <label key={x.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: x.done ? C.greenBg : C.bg, borderRadius: 9, cursor: x.auto != null ? "default" : "pointer", border: `1px solid ${x.done ? C.ok + "40" : C.bdr}` }}>
        <input type="checkbox" checked={x.done} disabled={x.auto != null} onChange={() => x.auto == null && toggle(x.id)} />
        <span style={{ flex: 1, fontSize: "calc(var(--s,1.3)*15px)", color: C.text }}>{x.label}</span>
        {x.auto != null ? <Badge color={x.auto ? C.ok : C.err} bg={x.auto ? C.greenBg : C.redBg}>{x.auto ? "자동 통과" : "자동 점검 실패"}</Badge> : (x.done ? <Badge color={C.ok} bg={C.greenBg}>확인</Badge> : <Badge color={C.textM} bg="#EEF2F7">미확인</Badge>)}
      </label>)}
    </div>
  </Card>;
}
function ProblemReport({ data }) {
  const [stats, setStats] = useState(true);
  return <Card style={{ padding: 20 }}>
    <h3 style={{ marginTop: 0, fontSize: "calc(var(--s,1.3)*20px)" }}>🐞 문제 제보용 정보</h3>
    <p style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*14px)", lineHeight: 1.6, margin: "0 0 10px" }}>오류가 나면 아래 버튼으로 환경 정보를 복사해 개발자에게 전달해주세요. <b>고객 원문·재무 rawText는 포함되지 않습니다.</b></p>
    <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "calc(var(--s,1.3)*14px)", color: C.textS, marginBottom: 10 }}><input type="checkbox" checked={stats} onChange={(e) => setStats(e.target.checked)} />데이터 통계(개수만) 포함</label>
    <div><button style={btnP} onClick={() => copyText(buildProblemReport(data, "설정", stats), () => showToast("문제 제보용 정보를 복사했습니다."))}>🐞 문제 제보용 정보 복사</button></div>
  </Card>;
}
function VersionCard() {
  return <Card style={{ padding: 18, background: C.bg }}>
    <h3 style={{ marginTop: 0, fontSize: "calc(var(--s,1.3)*18px)" }}>ℹ️ 앱 버전 정보</h3>
    <div style={{ fontSize: "calc(var(--s,1.3)*15px)", color: C.textS, lineHeight: 1.9 }}>
      <div><b>{APP_RELEASE.name}</b></div>
      <div>버전: {APP_RELEASE.version}</div>
      <div>빌드: {APP_RELEASE.build}</div>
      <div>저장방식: {APP_RELEASE.storage}</div>
      <div>재무분석 모듈: {APP_RELEASE.finModule}</div>
    </div>
  </Card>;
}
function Settings({ data, setData, reset, pinSet, applyLock, removePin, onLockNow }) {
  const [profile, setProfile] = useState(data.profile || { name: "", title: "" });
  const [repP, setRepP] = useState(getReportProfile(data));
  const [aff, setAff] = useState(getAffordSettings(data));
  const [backup, setBackup] = useState("");
  const [pinOpen, setPinOpen] = useState(false);
  const [resetText, setResetText] = useState("");
  function download() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `corp-sales-os-backup-${todayISO().replace(/-/g, "")}.json`; a.click(); URL.revokeObjectURL(url);
  }
  function applyRestore(d) {
    if (!d || typeof d !== "object" || !("leads" in d || "companies" in d)) { alert("백업 파일 형식이 올바르지 않습니다."); return; }
    if (window.confirm("백업 데이터로 현재 데이터를 덮어쓸까요?")) { setData(d); showToast("백업을 불러왔습니다."); }
  }
  function onFile(e) {
    const file = e.target.files && e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { try { applyRestore(JSON.parse(reader.result)); } catch (err) { alert("백업 파일 형식이 올바르지 않습니다."); } e.target.value = ""; };
    reader.readAsText(file);
  }
  const curScale = data.fontScale || DEFAULT_FONT_SCALE;
  const allCust = [...(data.leads || []), ...(data.companies || [])];
  const sampleN = allCust.filter(isSample).length;
  const manualN = allCust.length - sampleN;
  const h3 = { marginTop: 0, fontSize: "calc(var(--s,1.3)*20px)" };
  return <div style={{ display: "grid", gap: 14 }}>
    <Card style={{ padding: 20, border: `1px solid ${C.blue}40`, background: C.blueBg }}>
      <h3 style={{ ...h3, fontSize: "calc(var(--s,1.3)*22px)" }}>🔰 초보자 안내 모드</h3>
      <p style={{ color: C.textS, fontSize: "calc(var(--s,1.3)*15px)", lineHeight: 1.6, margin: "0 0 6px" }}>안내가 켜져 있으면 각 화면에서 ‘이 화면에서 하는 일’ 설명과 대표 버튼만 먼저 보이고, 실제 목록·기능은 ‘펼쳐보기’로 열립니다. 익숙해지면 끄거나 오늘 하루만 숨길 수 있습니다.</p>
      <p style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*14px)", lineHeight: 1.6, margin: "0 0 14px" }}>현재 상태: <b style={{ color: guideActive(data) ? C.blue : C.textM }}>{guideActive(data) ? "안내 표시 중" : (beginnerOn(data) ? "오늘 하루 숨김" : "안내 꺼짐")}</b></p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button style={guideActive(data) ? btnP : btnS} onClick={() => { setData({ ...data, beginnerMode: true, beginnerGuideHiddenDate: "" }); showToast("초보자 안내를 켰습니다."); }}>안내 켜기</button>
        <button style={btnS} onClick={() => { setData({ ...data, beginnerMode: true, beginnerGuideHiddenDate: todayISO() }); showToast("오늘 하루 안내를 숨겼습니다. 내일 다시 표시됩니다."); }}>오늘 하루 안내 숨기기</button>
        <button style={!beginnerOn(data) ? btnP : btnS} onClick={() => { setData({ ...data, beginnerMode: false }); showToast("초보자 안내를 껐습니다."); }}>계속 안내 보지 않기</button>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
        <button style={btnS} onClick={() => { setData({ ...data, screenGuide: {}, beginnerGuideHiddenDate: "" }); showToast("모든 화면 안내를 다시 켰습니다."); }}>🔁 모든 화면 안내 다시 켜기</button>
        <button style={btnS} onClick={() => { setData({ ...data, expandedSectionsByScreen: {} }); showToast("화면 펼침 상태를 초기화했습니다. 각 화면이 기본(접힘)으로 돌아갑니다."); }}>↺ 화면 펼침 상태 초기화</button>
      </div>
      <p style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*13px)", lineHeight: 1.6, margin: "10px 0 0" }}>각 화면의 ‘이 화면에서 하는 일’ 안내는 화면별로 ‘오늘 하루 더 이상 보지 않기 / 앞으로 계속 보지 않기’로 끌 수 있습니다. 위 ‘모든 화면 안내 다시 켜기’로 한 번에 되돌릴 수 있습니다. 펼친 섹션은 자동 저장되어 다른 메뉴에 갔다 와도 유지됩니다.</p>
    </Card>
    <Card style={{ padding: 20, border: `1px solid ${C.gold}55` }}>
      <h3 style={{ ...h3, fontSize: "calc(var(--s,1.3)*22px)" }}>① 화면 글자 크기</h3>
      <p style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*15px)", lineHeight: 1.6, margin: "0 0 14px" }}>선택하면 화면 전체에 즉시 반영되고 새로고침해도 유지됩니다. ‘크게’가 기본 사용 기준입니다.</p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>{FONT_SCALES.map((f) => { const active = curScale === f[0]; return <button key={f[0]} onClick={() => { setData({ ...data, fontScale: f[0] }); showToast(`글자 크기: ${f[0]}`); }} style={{ ...(active ? btnP : btnS), minWidth: 150, textAlign: "left", lineHeight: 1.3 }}><div style={{ fontWeight: 900 }}>{active ? "✓ " : ""}{f[0]}</div><div style={{ fontSize: "calc(var(--s,1.3)*13px)", fontWeight: 600, opacity: .85, marginTop: 3 }}>{f[2]}</div></button>; })}</div>
    </Card>
    <Card style={{ padding: 20 }}><h3 style={h3}>② 프로필</h3><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}><div><Label>이름</Label><input style={inp} value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></div><div><Label>직함</Label><input style={inp} value={profile.title} onChange={(e) => setProfile({ ...profile, title: e.target.value })} /></div></div><button style={{ ...btnP, marginTop: 14 }} onClick={() => { setData({ ...data, profile }); showToast("프로필을 저장했습니다."); }}>저장</button></Card>
    <Card style={{ padding: 20 }}><h3 style={h3}>📄 리포트 표시 정보</h3><p style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*15px)", lineHeight: 1.6, margin: "0 0 12px" }}>방문용 리포트 상단/하단에 표시됩니다. 저장하면 리포트에 즉시 반영됩니다.</p><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}><div><Label>컨설턴트명</Label><input style={inp} value={repP.consultant} onChange={(e) => setRepP({ ...repP, consultant: e.target.value })} /></div><div><Label>소속명</Label><input style={inp} value={repP.org} onChange={(e) => setRepP({ ...repP, org: e.target.value })} /></div><div><Label>직함</Label><input style={inp} value={repP.title} onChange={(e) => setRepP({ ...repP, title: e.target.value })} /></div><div><Label>연락처</Label><input style={inp} value={repP.phone} onChange={(e) => setRepP({ ...repP, phone: e.target.value })} placeholder="010-0000-0000" /></div><div style={{ gridColumn: "1/-1" }}><Label>이메일</Label><input style={inp} value={repP.email} onChange={(e) => setRepP({ ...repP, email: e.target.value })} /></div><div style={{ gridColumn: "1/-1" }}><Label>리포트 하단 안내 문구</Label><textarea style={{ ...inp, height: 80, resize: "vertical" }} value={repP.footer} onChange={(e) => setRepP({ ...repP, footer: e.target.value })} /></div></div><button style={{ ...btnP, marginTop: 14 }} onClick={() => { setData({ ...data, reportProfile: repP }); showToast("리포트 표시 정보를 저장했습니다."); }}>저장</button></Card>
    <Card style={{ padding: 20 }}><h3 style={h3}>📅 월납 적정성 기준</h3><p style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*15px)", lineHeight: 1.6, margin: "0 0 12px" }}>이 기준은 내부 검토용입니다. 실제 월납 규모는 고객의 현금흐름, 기존 보험료, 관계사 상황, 목적자금 필요성에 따라 달라질 수 있습니다. 직전년도 당기순이익 1억원당 월납 한도(만원)를 기준으로 초록/노랑/빨강을 판단합니다.</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div><Label>초록 기준 (당기순이익 1억원당 월납, 만원)</Label><input type="number" style={inp} value={aff.greenPerEok} onChange={(e) => setAff({ ...aff, greenPerEok: e.target.value })} placeholder="300" /></div>
        <div><Label>노랑 기준 (당기순이익 1억원당 월납, 만원)</Label><input type="number" style={inp} value={aff.yellowPerEok} onChange={(e) => setAff({ ...aff, yellowPerEok: e.target.value })} placeholder="600" /></div>
        <div><Label>기본 납입기간 (개월)</Label><input type="number" style={inp} value={aff.defMonths} onChange={(e) => setAff({ ...aff, defMonths: e.target.value })} placeholder="84" /></div>
        <div><Label>기본 환급률 (%)</Label><input type="number" style={inp} value={aff.defRate} onChange={(e) => setAff({ ...aff, defRate: e.target.value })} placeholder="100" /></div>
      </div>
      <button style={{ ...btnP, marginTop: 14 }} onClick={() => { setData({ ...data, affordSettings: { greenPerEok: Number(aff.greenPerEok) || 300, yellowPerEok: Number(aff.yellowPerEok) || 600, defMonths: Number(aff.defMonths) || 84, defRate: isFinite(Number(aff.defRate)) ? Number(aff.defRate) : 100 } }); showToast("월납 적정성 기준을 저장했습니다."); }}>저장</button>
    </Card>
    <Card style={{ padding: 20 }}><h3 style={h3}>③ 영업 기록 백업 / 복원<Help text="영업 기록만 파일로 내려받아 보관하거나, 그 파일로 되돌립니다. OS 전체 백업(고객 운영 → 더보기 → 백업 내려받기)에도 영업 기록이 함께 담깁니다." /></h3><p style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*15px)", lineHeight: 1.6, margin: "0 0 10px" }}>영업 기록(고객·오늘 할 일·설정값)만 JSON 파일로 내려받습니다. 파일은 이 컴퓨터로만 내려받아지고 어디에도 올라가지 않습니다.</p><div style={{ background: C.warnBg, border: `1px solid ${C.warn}40`, borderRadius: 11, padding: "12px 14px", marginBottom: 12, fontSize: "calc(var(--s,1.3)*14px)", color: C.textS, lineHeight: 1.7 }}><b style={{ color: C.text }}>안전하게 쓰는 법</b><div style={{ marginTop: 4 }}>• <b>주 1회 백업</b>을 권장합니다 — OS 전체 백업 하나면 영업 기록도 함께 담깁니다.</div><div>• <b>공용 PC</b>에서는 쓰고 나서 로그아웃하세요.</div><div>• 실제 <b>민감정보(주민번호·계좌 등) 입력은 최소화</b>하시길 권합니다.</div></div><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button style={btnP} onClick={download}>⬇️ 데이터 백업 다운로드</button><label style={{ ...btnS, display: "inline-flex", alignItems: "center", cursor: "pointer" }}>📂 백업 파일 불러오기<input type="file" accept="application/json,.json" onChange={onFile} style={{ display: "none" }} /></label><button style={btnS} onClick={() => copyText(JSON.stringify(data, null, 2), () => showToast("백업을 클립보드에 복사했습니다."))}>백업 클립보드 복사</button></div><div style={{ marginTop: 12 }}><Label>또는 백업 JSON 붙여넣기로 복원</Label><textarea style={{ ...inp, height: 110, resize: "vertical" }} value={backup} onChange={(e) => setBackup(e.target.value)} placeholder="백업 JSON을 붙여넣으세요." /><button style={{ ...btnS, marginTop: 8 }} onClick={() => { try { applyRestore(JSON.parse(backup)); } catch (e) { alert("백업 파일 형식이 올바르지 않습니다."); } }}>붙여넣기 복원</button></div></Card>
    <Card style={{ padding: 20 }}><h3 style={h3}>④ 저장 방식 안내</h3><div style={{ fontSize: "calc(var(--s,1.3)*16px)", color: C.textS, lineHeight: 1.8 }}><div>• [이 OS] 영업 기록은 <b>미래에이아이랩 OS 의 모듈 기록</b>에 저장됩니다. 클라우드 모드면 작업실 안 다른 기기에서도 보입니다.</div><div>• 업체(업체명·대표자)는 <b>고객 운영</b> 업체를 그대로 씁니다. 여기서 지워도 고객 운영 업체는 남습니다.</div><div>• <b>공용 PC에서는 로그아웃에 주의하고</b>, 중요한 고객자료는 정기적으로 백업해주세요. (고객 운영 → 더보기 → 백업 내려받기 — 영업 기록도 함께 담깁니다)</div></div>
    </Card>
    {/* [D-94] 원본의 ‘출시 전 점검(QA 체크리스트)’ · ‘🐞 문제 제보용 정보’ · ‘앱 버전(Release Candidate v0.9)’ 카드와
        위와 겹치던 백업 단추 한 벌은 뺐다 — 개발 중에 쓰던 것이라 대표 화면에는 뜻이 없다 */}
    <Card style={{ padding: 20, background: "#2A1515", border: `1px solid ${C.err}66` }}><h3 style={{ ...h3, color: C.err }}>⚠️ 위험 구역</h3><p style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*15px)", lineHeight: 1.6, margin: "0 0 12px" }}>아래 작업은 되돌리기 어렵습니다. 먼저 백업을 받아두시길 권합니다.</p><div style={{ background: C.redBg, border: `1px solid ${C.err}40`, borderRadius: 11, padding: 14 }}><div style={{ fontWeight: 800, color: C.err, fontSize: "calc(var(--s,1.3)*15px)", marginBottom: 6 }}>🗑️ 전체 데이터 초기화</div><div style={{ color: C.textS, fontSize: "calc(var(--s,1.3)*14px)", lineHeight: 1.6, marginBottom: 8 }}>이 영업 도구의 모든 기록·설정이 삭제되며 복구할 수 없습니다(고객 운영 업체는 남습니다). 실행하려면 아래 칸에 <b>초기화</b> 라고 입력하세요.</div><div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}><input style={{ ...inp, width: "auto", marginBottom: 0, maxWidth: 200 }} value={resetText} onChange={(e) => setResetText(e.target.value)} placeholder="초기화" aria-label="초기화 확인 입력" /><button style={{ ...btnP, background: resetText.trim() === "초기화" ? C.err : C.bdrL, color: "#fff", cursor: resetText.trim() === "초기화" ? "pointer" : "not-allowed" }} disabled={resetText.trim() !== "초기화"} onClick={() => { setResetText(""); reset(); }}>전체 초기화 실행</button></div></div></Card>
    <Card style={{ padding: 20, background: C.bg }}><h3 style={{ ...h3, color: C.warn }}>신뢰/리스크 원칙</h3><p style={{ color: C.textS, lineHeight: 1.8, fontSize: "calc(var(--s,1.3)*16px)", margin: 0 }}>세무·절세·가업승계·판례 관련 문구는 항상 “검토 가능성”, “자료 확인 후 판단”, “세무사 검토 권장” 표현을 사용합니다. 고객에게 절세액·감면 여부·지원금 적용 여부를 단정하지 않는 것을 기본 원칙으로 합니다.</p></Card>
  </div>;
}

// PIN 설정/변경 모달 — 4~6자리 숫자, 두 번 입력 확인, 해시 저장
function PinSetup({ open, firstTime, onSet, onClose }) {
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setP1(""); setP2(""); setBusy(false); } }, [open]);
  if (!open) return null;
  const valid = /^\d{4,6}$/.test(p1);
  const submit = async () => {
    if (!valid) { showToast("4~6자리 숫자로 입력해주세요."); return; }
    if (p1 !== p2) { showToast("두 번 입력한 PIN이 서로 다릅니다."); return; }
    setBusy(true);
    try { const salt = randSalt(); const hash = await hashPin(p1, salt); onSet({ salt, hash, prompted: true }); showToast("앱 잠금(PIN)을 설정했습니다."); }
    catch (e) { setBusy(false); showToast("PIN 설정 중 문제가 발생했습니다."); }
  };
  const pinInput = { ...inp, letterSpacing: 8, textAlign: "center", fontWeight: 800 };
  return <Modal open={open} onClose={onClose} title={firstTime ? "앱 잠금(PIN) 설정" : "PIN 설정 / 변경"} width={460}>
    <p style={{ color: C.textS, fontSize: "calc(var(--s,1.3)*15px)", lineHeight: 1.65, margin: "0 0 14px" }}>공용 PC에서 사용하신다면 4~6자리 PIN으로 화면을 잠글 수 있습니다. PIN은 평문이 아니라 해시 처리되어 <b>이 브라우저에만</b> 저장됩니다(백업 파일에는 포함되지 않습니다).</p>
    <div style={{ display: "grid", gap: 12 }}>
      <div><Label>PIN (숫자 4~6자리)</Label><input type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} value={p1} onChange={(e) => setP1(e.target.value.replace(/\D/g, ""))} style={pinInput} placeholder="••••" /></div>
      <div><Label>PIN 다시 입력</Label><input type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} value={p2} onChange={(e) => setP2(e.target.value.replace(/\D/g, ""))} onKeyDown={(e) => { if (e.key === "Enter") submit(); }} style={pinInput} placeholder="••••" /></div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>{firstTime && <button style={btnS} onClick={onClose}>나중에 하기</button>}<button style={btnP} disabled={busy} onClick={submit}>{busy ? "설정 중…" : "PIN 설정"}</button></div>
    </div>
  </Modal>;
}
// 잠금 화면 — PIN 입력 후 해제, 분실 시 데이터 초기화 후 재설정만 가능
function LockScreen({ onUnlock, onReset }) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);
  const valid = /^\d{4,6}$/.test(pin);
  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try { const rec = loadLock(); const h = await hashPin(pin, rec.salt || ""); if (rec.hash && h === rec.hash) { markActive(); onUnlock(); return; } } catch (e) {}
    setErr(true); setPin(""); setBusy(false);
  };
  return <div data-scale="크게" className="appRoot" style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: FF, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
    <div style={{ width: "100%", maxWidth: 380, background: C.card, border: "1px solid " + C.bdr, borderRadius: 18, boxShadow: "0 12px 40px rgba(15,23,42,.12)", padding: 28, textAlign: "center" }}>
      <div style={{ fontSize: 40 }}>🔒</div>
      <h2 style={{ margin: "10px 0 4px", fontSize: 24 }}>앱 잠금</h2>
      <p style={{ color: C.textM, fontSize: 15, lineHeight: 1.6, margin: "0 0 18px" }}>PIN을 입력해 잠금을 해제하세요.</p>
      <input type="password" inputMode="numeric" autoComplete="off" autoFocus maxLength={6} value={pin} onChange={(e) => { setPin(e.target.value.replace(/\D/g, "")); setErr(false); }} onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
        style={{ ...inp, textAlign: "center", letterSpacing: 10, fontWeight: 800, fontSize: 22, marginBottom: 8 }} placeholder="••••" />
      {err && <div style={{ color: C.err, fontSize: 14, fontWeight: 700, marginBottom: 8 }}>PIN이 올바르지 않습니다. 다시 입력해주세요.</div>}
      <button style={{ ...btnP, width: "100%", marginTop: 4 }} disabled={!valid || busy} onClick={submit}>{busy ? "확인 중…" : "잠금 해제"}</button>
      <button onClick={onReset} style={{ background: "none", border: "none", color: C.textM, fontSize: 13, cursor: "pointer", marginTop: 16, textDecoration: "underline", fontFamily: FF }}>PIN을 잊으셨나요? · 로컬 데이터 초기화 후 재설정</button>
    </div>
  </div>;
}
// [D-98] 테마를 바꾸면 새로고침 없이 따라간다 — 팔레트(C)와 그 색을 미리 담아 둔 표(단추·단계·상태 색)를 새 색으로 고친다
const syncBrand = brandSync(
  { blue: ["600", "#2563EB"], sky: ["500", "#0284C7"], blueBg: ["50", "#E8F1FE"] },
  [C, btnP, DEAL_STAGES, PROPOSAL_STATE_STYLE, TODO_STYLE, DB_SOURCE_STYLE, DOC_STATUS_STYLE],
);

export default function App({ tab: tabProp = "briefing", onTab, focus }) {
  useThemeRerender();
  syncBrand();
  const [data, setData] = useState(() => { try { scrubLocalStorageOnce(); } catch (e) {} const d = load(); return d ? migrateData(d) : d; });
  // [D-93] 화면(tab)은 이 OS 의 모듈 목차(주소)가 쥔다
  const tab = tabProp;
  const setTab = (t) => { if (onTab) onTab(t); };
  const [focusId, setFocusId] = useState(focus || null);   // [D-93] 업체에서 열면(?client=) 그 업체로
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [addState, setAddState] = useState(null);
  const [selectId, setSelectId] = useState(null);
  const [recentId, setRecentId] = useState(null);
  const [lock, setLock] = useState(() => loadLock());
  const [locked, setLocked] = useState(() => !!loadLock().hash); // PIN이 있으면 진입 시 잠금부터
  const [setupOpen, setSetupOpen] = useState(false);
  const pinSet = !!(lock && lock.hash);
  const applyLock = (rec) => { saveLock(rec); setLock(rec); if (rec && rec.hash) markActive(); };
  const removePin = () => { clearLock(); setLock({}); setLocked(false); showToast("앱 잠금(PIN)을 해제했습니다."); };
  const lockForgotReset = () => {
    if (!window.confirm("PIN을 분실하면 잠금을 해제할 수 없습니다. 이 브라우저의 모든 로컬 데이터를 초기화한 뒤 다시 설정해야 합니다. 계속할까요? (복구 불가)")) return;
    try { localStorage.removeItem(SK); } catch (e) {}
    clearLock(); setLock({}); setLocked(false); setData(null);
  };
  // 자동 잠금: 30분 무조작 + 새로고침/재방문 시 경과 시간 확인
  useEffect(() => {
    if (!pinSet || typeof window === "undefined") return;
    const bump = () => markActive();
    const evs = ["mousedown", "keydown", "touchstart", "scroll", "click"];
    evs.forEach((e) => window.addEventListener(e, bump, { passive: true }));
    bump();
    const iv = setInterval(() => { const last = Number(localStorage.getItem(LA) || 0); if (last && Date.now() - last > AUTO_LOCK_MS) setLocked(true); }, 30000);
    const onVis = () => { if (!document.hidden) { const last = Number(localStorage.getItem(LA) || 0); if (last && Date.now() - last > AUTO_LOCK_MS) setLocked(true); } };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => { evs.forEach((e) => window.removeEventListener(e, bump)); clearInterval(iv); document.removeEventListener("visibilitychange", onVis); window.removeEventListener("focus", onVis); };
  }, [pinSet, locked]);
  // 최초 진입 시 1회: PIN 미설정·미안내면 설정 제안
  useEffect(() => { if (data && !pinSet && !lock.prompted) setSetupOpen(true); }, []);
  // 앱 내부 화면 이동 기록(뒤로/앞으로) — tab + 선택 고객(focusId) 기준. localStorage는 건드리지 않음.
  const histRef = React.useRef({ stack: [{ tab: "briefing", focusId: null }], idx: 0, nav: false });
  const [histVer, setHistVer] = useState(0);
  useEffect(() => {
    const h = histRef.current;
    if (h.nav) { h.nav = false; return; }
    const cur = h.stack[h.idx];
    if (cur && cur.tab === tab && cur.focusId === focusId) return;
    h.stack = h.stack.slice(0, h.idx + 1);
    h.stack.push({ tab, focusId });
    if (h.stack.length > 50) { h.stack.shift(); }
    h.idx = h.stack.length - 1;
    setHistVer((v) => v + 1);
  }, [tab, focusId]);
  const histGo = (delta) => {
    const h = histRef.current;
    const ni = h.idx + delta;
    if (ni < 0 || ni >= h.stack.length) return;
    h.idx = ni; h.nav = true;
    const e = h.stack[ni];
    setFocusId(e.focusId); setTab(e.tab); setDrawerOpen(false); setHistVer((v) => v + 1);
  };
  const canBack = histRef.current.idx > 0;
  const canFwd = histRef.current.idx < histRef.current.stack.length - 1;
  const goMeeting = (id) => { setFocusId(id); setTab("meetings"); };
  const go = (t) => { setTab(t); setDrawerOpen(false); };
  const openAdd = (dest, initial = null, editTarget = null) => { setDrawerOpen(false); setAddState({ dest: dest || "lead", initial, mode: initial ? "edit" : "add", editTarget }); };
  function registerCustomer(rec, dest) {
    const st = addState || {};
    let d = { ...data };
    if (st.mode === "edit") {
      if (st.editTarget === "company") d.companies = (d.companies || []).map((c) => (c.id === rec.id ? { ...c, ...rec, updatedAt: todayISO(), manual: true, sample: false } : c));
      else d.leads = (d.leads || []).map((l) => (l.id === rec.id ? { ...l, ...rec, updatedAt: todayISO(), manual: true, sample: false } : l));
      setData(d); setAddState(null); setSelectId(rec.id); setTab(st.editTarget === "company" ? "companies" : "prospecting"); showToast("고객 정보를 수정했습니다. 자동 분석이 갱신됩니다.");
      return;
    }
    const targets = dest === "both" ? ["lead", "company"] : [dest];
    let leadId = null, compId = null;
    for (const tgt of targets) {
      const list = tgt === "company" ? (d.companies || []) : (d.leads || []);
      const exists = list.find((x) => (rec.osId && x.id === rec.osId) || x.name === rec.name);
      const id = rec.osId || (exists ? exists.id : uid()); // [D-93] id = 고객 운영 업체 id
      const record = { ...rec, id, updatedAt: todayISO(), manual: true, sample: false, ...(exists ? {} : { createdAt: rec.createdAt || todayISO() }), ...(tgt === "company" ? { fromLead: dest === "both" } : {}) };
      const next = exists ? list.map((x) => (x.id === exists.id ? { ...x, ...record } : x)) : [record, ...list];
      if (tgt === "company") { d.companies = next; compId = id; } else { d.leads = next; leadId = id; }
    }
    const primaryTab = dest === "company" ? "companies" : "prospecting";
    const primaryId = dest === "company" ? compId : leadId;
    setData(d); setAddState(null); setSelectId(primaryId); setRecentId(primaryId);
    showToast(dest === "company" ? "고객사 관리에 저장되었습니다. 상세에서 방문용 리포트를 확인해보세요." : dest === "both" ? "신규 고객 발굴·고객사 관리에 저장되었습니다. 상세에서 방문용 리포트를 확인해보세요." : "신규 고객 발굴 리드로 추가되었습니다. 상세에서 방문용 리포트를 확인해보세요.");
    setTab(primaryTab);
  }
  useEffect(() => { if (data) save(data); }, [data]);
  // 메뉴(화면) 이동 시 항상 콘텐츠 상단으로 스크롤 초기화 — 이전 화면의 스크롤 위치가 새 화면에 남지 않게
  useEffect(() => {
    if (typeof document === "undefined") return;
    const mc = document.querySelector && document.querySelector(".mainCol");
    if (mc) mc.scrollTop = 0;
    if (typeof window !== "undefined" && window.scrollTo) { try { window.scrollTo(0, 0); } catch (e) {} }
  }, [tab, focusId]);
  if (!data) return <Onboarding onDone={(profile) => setData({ ...emptyData(), profile })} />;
  if (pinSet && locked) return <LockScreen onUnlock={() => setLocked(false)} onReset={lockForgotReset} />;
  const navGroups = [
    ["홈", [["briefing", "🏠", "오늘의 브리핑"]]],
    ["고객 관리", [["prospecting", "🙋", "신규 고객 등록·발굴"], ["companies", "🏢", "고객사 관리"], ["followup", "🔔", "다음 연락 관리"]]],
    ["미팅·제안", [["meetings", "🤝", "미팅 준비"], ["reports", "📄", "리포트/제안서"], ["packages", "📦", "컨설팅 상품"]]],
    ["계약·성과", [["pipeline", "🗂️", "영업 진행 현황"], ["analytics", "📈", "성과 분석"]]],
    ["마케팅·자료", [["content", "📣", "콘텐츠 전략"], ["education", "🎓", "교육 아카이브"], ["strategies", "📚", "절세전략"], ["updates", "⚖️", "법령/공고"]]],
    ["운영", [["settings", "⚙️", "설정"]]],
  ];
  const tabs = navGroups.flatMap((g) => g[1]);
  function reset() {
    try { localStorage.removeItem(SK); } catch (e) {}
    clearLock(); setLock({}); setLocked(false); salesResetAll(); setData({ ...emptyData(), profile: data.profile }); showToast("영업 기록을 초기화했습니다. 고객 운영 업체는 그대로입니다.");
  }
  const pageTitle = (tabs.find((t) => t[0] === tab) || tabs[0])[2];
  const navBtn = (on) => ({ background: C.card, border: "1px solid " + C.bdr, borderRadius: 9, height: "calc(var(--s,1.3)*36px)", minWidth: "calc(var(--s,1.3)*36px)", padding: "0 10px", color: on ? C.text : C.textM, opacity: on ? 1 : .4, cursor: on ? "pointer" : "not-allowed", fontWeight: 800, fontSize: "calc(var(--s,1.3)*15px)", display: "inline-flex", alignItems: "center", justifyContent: "center", lineHeight: 1, fontFamily: FF });
  const GUIDE = {
    prospecting: { icon: "🙋", title: "신규 고객 등록·발굴", start: "신규 고객 관리 시작하기", desc: "계약 전 잠재고객을 영업 단계별로 관리합니다. 연락 예정, 미팅 예정, 자료 요청 고객을 놓치지 않도록 정리하세요. 고객 정보를 입력하면 미팅 준비와 제안 후보가 자동으로 정리됩니다.", steps: ["고객 등록", "자동 분석", "미팅 준비"], expand: "고객 목록 보기", primary: { label: "+ 고객 등록하기", act: () => openAdd("lead") } },
    companies: { icon: "🏢", title: "고객사 관리", start: "고객사 관리 시작하기", desc: "상담이 시작되었거나 계약·관리 단계에 들어온 고객사를 관리합니다. 계약 예정, 관리 필요, 자료 요청 고객을 상태별로 확인하세요. 고객별 리포트·제안서·견적·다음 연락을 이어갈 수 있습니다.", steps: ["고객사 선택", "리포트·제안", "다음 연락"], expand: "고객사 목록 보기", primary: { label: "+ 고객 등록하기", act: () => openAdd("company") } },
    followup: { icon: "🔔", title: "다음 연락 관리", start: "다음 연락 관리 시작하기", desc: "오늘 연락할 고객과 후속 연락이 필요한 고객을 확인합니다. 연락 누락을 줄이고 다음 액션을 정리하세요. 바쁜 일정 속에서도 중요한 고객을 다시 챙길 수 있도록 도와줍니다.", expand: "다음 연락 보기", primary: null },
    meetings: { icon: "🤝", title: "미팅 준비", desc: "고객별 질문, 확인자료, 상담 흐름을 준비하는 화면입니다. 미팅 전에 이 화면만 확인해도 어떤 이야기부터 꺼낼지 정리할 수 있습니다.", expand: "미팅 준비 보기", primary: null },
    reports: { icon: "📄", title: "리포트/제안서", desc: "대표님에게 보여줄 방문용 리포트와 제안서 초안을 만드는 화면입니다. 말로만 설명하기 어려운 내용을 문서로 정리해 신뢰감을 높이는 데 도움이 됩니다.", steps: ["방문용 리포트", "제안서 초안", "견적/업무범위서"], expand: "리포트/제안서 보기", primary: null },
    packages: { icon: "📦", title: "컨설팅 상품", desc: "자주 제안하는 컨설팅 상품을 정리하는 곳입니다. 고객 유형에 맞는 상품을 빠르게 골라 제안 흐름을 만들 수 있습니다.", expand: "컨설팅 상품 보기", primary: null },
    pipeline: { icon: "🗂️", title: "영업 진행 현황", desc: "고객이 지금 어느 단계에 있는지 보는 화면입니다. 상담, 자료요청, 제안, 견적, 계약 준비 흐름을 한눈에 확인할 수 있습니다.", expand: "진행 현황 보기", primary: null },
    analytics: { icon: "📈", title: "성과 분석", tone: "warn", desc: "고객 데이터가 쌓이면 이번 달 제안, 견적, 계약 흐름을 숫자로 확인하는 화면입니다. 어떤 상품과 고객군에서 성과가 나오는지 보면 시간을 더 효율적으로 쓸 수 있습니다.", expand: "성과 분석 보기", primary: null },
    content: { icon: "📣", title: "콘텐츠 전략", desc: "블로그, 유튜브, 인스타에 올릴 주제를 찾고 고객 발굴과 미팅 연결 문구까지 만드는 곳입니다. 콘텐츠가 단순 홍보가 아니라 상담으로 이어지도록 도와주는 화면입니다.", expand: "콘텐츠 주제 보기", primary: null },
    education: { icon: "🎓", title: "교육 아카이브", desc: "강의나 교육에서 얻은 내용을 정리하는 곳입니다. 좋은 교육 내용을 고객 설명, 콘텐츠, 제안 문구로 다시 활용할 수 있습니다.", expand: "교육 자료 보기", primary: null },
    strategies: { icon: "📚", title: "절세전략", desc: "법인 고객에게 자주 검토되는 절세·세액공제·정관 관련 전략을 정리한 화면입니다. 고객 상황별로 어떤 점검이 필요한지 빠르게 떠올리는 데 도움이 됩니다.", expand: "전략 목록 보기", primary: null },
    updates: { icon: "⚖️", title: "법령/공고", desc: "새로운 법령, 공고, 제도 변화를 확인하는 화면입니다. 고객에게 먼저 알려줄 만한 이슈를 찾아 상담 기회로 연결하는 데 도움이 됩니다.", expand: "공고 목록 보기", primary: null },
    settings: { icon: "⚙️", title: "설정", desc: "글자 크기, 초보자 안내, 데이터 백업과 샘플 데이터를 관리하는 화면입니다. 실제 고객 데이터를 넣기 전 백업 습관을 만들어두면 더 안전하게 사용할 수 있습니다.", expand: "설정 전체 보기", primary: null, sample: false },
  };
  const scaleName = data.fontScale || DEFAULT_FONT_SCALE;
  return <div className={"appRoot" + (drawerOpen ? " drawer-open" : "")} data-scale={scaleName} data-testid="sales-orig" style={{ background: C.bg, color: C.text, fontFamily: FF, fontSize: "calc(var(--s) * 18px)", borderRadius: "var(--radius-panel)", overflow: "hidden" }}>
    <style>{`
      .appRoot *{box-sizing:border-box}
      /* [D-96] 원본은 제목이 브라우저 기본(굵게)이었다 — 이 OS 의 기본 초기화(굵기 상속)로 얇아진 것을 되돌린다 */
      .appRoot h1,.appRoot h2,.appRoot h3,.appRoot h4{font-weight:700}
      .appRoot{container:sales / inline-size}
      /* [D-94] 이 OS 에서는 영업 화면이 OS 목차 옆 칸에 선다 — 원본 휴대폰 규칙(칸 나눔 → 한 줄)을 화면 폭이 아니라 칸 폭으로도 건다 */
      @container sales (max-width:860px){
        .appRoot [style*="minmax("],.appRoot [style*="px 1fr"],.appRoot [style*="1.1fr"],.appRoot [style*="repeat(5"],.appRoot [style*="2fr 1fr 1fr"],.appRoot [style*="repeat(4"]{grid-template-columns:1fr !important}
        .heroBtns{flex-direction:column !important}
        .heroBtns > *{width:100% !important}
      }
      /* [D-98] 휴대폰 폭 칸에서: ‘고르기 칸 | 단추들’ 두 칸 줄은 위아래로(고르기 칸이 화살표만 남게 찌그러졌다),
         ‘제목 | 단추’ 줄은 단추가 글자 한두 자씩 세 줄로 꺾이지 않게 아랫줄로 내린다 */
      /* [D-99] 넓은 화면에서도 ‘제목 | 단추’ 줄의 단추가 ‘등/록’ 처럼 꺾였다 — 단추는 줄지 않고 한 줄, 대신 설명 글이 줄어든다 */
      .appRoot [style*="justify-content: space-between"] > button{flex-shrink:0;white-space:nowrap}
      @container sales (max-width:560px){
        .appRoot [style*="grid-template-columns: 1fr auto"]{grid-template-columns:1fr !important}
        .appRoot [style*="justify-content: space-between"]:has(> button){flex-wrap:wrap}
      }
      /* [D-96] 목차가 위 한 줄(☰ 영업 도구 모음 · 화면 이름)로 접히는 폭(1280px 아래)에서는 그 줄이 화면 이름을 이미 보여 준다 — 같은 제목을 또 크게 세우지 않는다 */
      @media (max-width:1279px){ .pcHeader{display:none !important} }
      .appRoot ::-webkit-scrollbar{width:11px;height:11px}
      .appRoot ::-webkit-scrollbar-thumb{background:${C.bdrL};border-radius:999px;border:2px solid ${C.bg}}
      .appRoot ::-webkit-scrollbar-thumb:hover{background:#94A3B8}
      /* 토스 계열 모션 — 카드 hover 떠오름, 버튼 반응, fade-in */
      .ui-card{transition:transform .18s cubic-bezier(.22,.61,.36,1),box-shadow .18s ease,border-color .18s ease;box-shadow:var(--shadow-card)}
      .ui-card.ui-hover:hover{transform:translateY(-2px);box-shadow:0 8px 20px rgba(15,23,42,.10),0 2px 6px rgba(15,23,42,.06)}
      .appRoot button{transition:transform .14s ease,box-shadow .16s ease,filter .16s ease}
      .appRoot button:not(:disabled):hover{filter:brightness(.97)}
      .appRoot button:not(:disabled):active{transform:translateY(1px)}
      .appRoot button:disabled{opacity:.45;cursor:not-allowed !important}
      .appRoot input:focus,.appRoot select:focus,.appRoot textarea:focus{border-color:${C.blue} !important;box-shadow:0 0 0 3px ${C.blue}1F}
      .appRoot button:focus-visible,.appRoot a:focus-visible{outline:2px solid ${C.blue};outline-offset:2px}
      .ui-fade{animation:uiFadeUp .26s cubic-bezier(.22,.61,.36,1) both}
      @keyframes uiFadeUp{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:none}}
      .ui-modal{animation:uiModalIn .2s cubic-bezier(.22,.61,.36,1) both}
      @keyframes uiModalIn{from{opacity:0;transform:translateY(14px) scale(.99)}to{opacity:1;transform:translateY(0) scale(1)}}
      .ui-modal-bg{animation:uiFadeIn .16s ease both}
      @keyframes uiFadeIn{from{opacity:0}to{opacity:1}}
      @media (prefers-reduced-motion:reduce){.appRoot *,.appRoot *::before,.appRoot *::after{animation-duration:.001ms !important;transition-duration:.001ms !important}.ui-card.ui-hover:hover{transform:none}}
      .appRoot{--s:1.5}
      .appRoot[data-scale="기본"]{--s:0.95}
      .appRoot[data-scale="크게"]{--s:1.12}
      .appRoot[data-scale="아주 크게"]{--s:1.32}
      .appShell{display:flex}
      .appRoot .sb,.appRoot .drawer-backdrop,.appRoot .mobileHeader{display:none !important}
      .appRoot .pcHeader{position:static !important}
      .sb{width:300px;flex:0 0 300px;background:${C.card2};border-right:1px solid ${C.bdr};position:sticky;top:0;height:100vh;display:flex;flex-direction:column;overflow-y:auto}
      .sbBrand{display:block;width:100%;text-align:left;border:none;background:transparent;cursor:pointer;font-family:inherit;color:${C.text};transition:background .15s}
      .sbBrand:hover{background:${C.hover}}
      .sbItem{display:flex;align-items:center;gap:12px;width:100%;text-align:left;padding:9px 16px;min-height:44px;border:none;background:transparent;color:${C.textS};font-weight:700;font-size:calc(var(--s,1.3)*17px);cursor:pointer;border-radius:10px;font-family:inherit;text-decoration:none;transition:background .12s,color .12s}
      .sbItem:hover{background:${C.hover};color:${C.text}}
      .sbItem.on{background:${C.blueBg};color:${C.blue};box-shadow:inset 4px 0 0 ${C.blue};font-weight:900}
      .sbIcon{font-size:calc(var(--s,1.3)*19px);width:24px;text-align:center}
      @media (min-width:769px){.sbItem{min-height:40px;padding:8px 16px}
        .sb{position:static}
      }
      .mainCol{flex:1;min-width:0;display:flex;flex-direction:column;max-width:100%}
      @media print{@page{size:A4;margin:14mm}body{background:#fff !important}body *{visibility:hidden !important}.appShell,.mainCol{overflow:visible !important;height:auto !important}#visitReport,#visitReport *{visibility:visible !important}#visitReport{position:absolute;left:0;top:0;width:100%;max-width:100% !important;background:#fff !important;color:#222 !important;font-size:12.5pt;box-shadow:none !important}#visitReport .repSec{break-inside:avoid;page-break-inside:avoid}}
      .mobileHeader{display:none}
      .drawer-backdrop{display:none}
      .mobileOnly{display:none}
      .cretopCols{display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start}
      @media (max-width:860px){ .cretopCols{grid-template-columns:1fr} }
      @media (max-width:768px){
        .appRoot[data-scale="기본"]{--s:0.84}
        .appRoot[data-scale="크게"]{--s:0.95}
        .appRoot[data-scale="아주 크게"]{--s:1.08}
        .sb{position:fixed;top:0;left:0;height:100vh;width:284px;max-width:84vw;flex:none;transform:translateX(-100%);transition:transform .25s ease;z-index:120}
        .drawer-open .sb{transform:translateX(0);box-shadow:0 0 50px rgba(0,0,0,.65)}
        .drawer-backdrop{display:none;position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:110}
        .drawer-open .drawer-backdrop{display:block}
        .mobileHeader{display:flex !important;position:sticky;top:0;z-index:90;align-items:center;justify-content:space-between;gap:10px;padding:12px 16px;background:${C.card2};border-bottom:1px solid ${C.bdr}}
        .pcHeader{position:static !important;padding:14px 16px !important}
        .pcHeader h1{font-size:clamp(24px,7vw,30px) !important}
        .appMain{padding:14px !important}
        .appRoot [style*="minmax("],.appRoot [style*="px 1fr"],.appRoot [style*="1.1fr"],.appRoot [style*="repeat(5"],.appRoot [style*="2fr 1fr 1fr"],.appRoot [style*="repeat(4"]{grid-template-columns:1fr !important}
        .pcOnly{display:none !important}
        .mobileOnly{display:inline !important}
        .heroBtns{flex-direction:column !important}
        .heroBtns > *{width:100% !important}
      }
    `}</style>
    <div className="appShell">
      <aside className="sb">
        <button className="sbBrand" onClick={() => { setTab("briefing"); setDrawerOpen(false); }} title="오늘의 브리핑으로 이동" aria-label="오늘의 브리핑으로 이동" style={{ padding: "15px 16px", borderBottom: `1px solid ${C.bdr}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div><div style={{ color: C.gold, fontSize: "calc(var(--s,1.3)*13px)", fontWeight: 900, letterSpacing: 3 }}>SALES OS</div>
          <div style={{ fontSize: "calc(var(--s,1.3)*18px)", fontWeight: 900, marginTop: 5 }}>기업컨설팅 세일즈 OS</div></div>
          <span className="mobileOnly" onClick={(e) => { e.stopPropagation(); setDrawerOpen(false); }} style={{ fontSize: 28, color: C.textM, lineHeight: 1 }}>✕</span>
        </button>
        <nav className="sbNav" style={{ display: "flex", flexDirection: "column", gap: 3, padding: 13, flex: 1 }}>
          {navGroups.map((g) => <div key={g[0]} style={{ marginBottom: 7 }}>
            <div className="sbGroup" style={{ padding: "8px 14px 4px", fontSize: "calc(var(--s,1.3)*12px)", color: C.textM, fontWeight: 800, letterSpacing: 1, opacity: .7 }}>{g[0]}</div>
            {g[1].map((t) => <button key={t[0]} className={"sbItem" + (tab === t[0] ? " on" : "")} onClick={() => go(t[0])}><span className="sbIcon">{t[1]}</span>{t[2]}</button>)}
          </div>)}
          <div className="sbDiv" style={{ height: 1, background: C.bdr, margin: "7px 10px 8px" }} />
          <div className="sbExtLabel" style={{ padding: "0 14px 6px", fontSize: "calc(var(--s,1.3)*12px)", color: C.textM, fontWeight: 800, letterSpacing: 1, opacity: .7 }}>다른 SaaS 바로가기</div>
          {EXTERNAL_APPS.map((a) => <a key={a.url} href={a.url} target="_blank" rel="noopener noreferrer" onClick={() => setDrawerOpen(false)} className="sbItem" style={{ color: C.textM, fontSize: "calc(var(--s,1.3)*15px)" }}><span className="sbIcon" style={{ fontSize: "calc(var(--s,1.3)*17px)" }}>{a.icon}</span><span style={{ flex: 1 }}>{a.label}</span><span style={{ color: C.gold, fontWeight: 900 }}>↗</span></a>)}
        </nav>
        <div className="sbBottom" style={{ borderTop: `1px solid ${C.bdr}`, padding: "15px 16px" }}>
          <div style={{ fontSize: "calc(var(--s,1.3)*17px)", fontWeight: 800 }}>{data.profile?.name || "사용자"} {data.profile?.title || "컨설턴트"}</div>
          <div style={{ fontSize: "calc(var(--s,1.3)*13px)", color: C.textM, marginTop: 3 }}>{APP_RELEASE.name} · {APP_RELEASE.version}</div>
          <div style={{ fontSize: "calc(var(--s,1.3)*12px)", color: C.textM, marginTop: 2, opacity: .85 }}>빌드 {APP_RELEASE.build} · {APP_RELEASE.storage}</div>
        </div>
      </aside>
      <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)} />
      <div className="mainCol">
        <div className="mobileHeader">
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <button onClick={() => setDrawerOpen(true)} aria-label="메뉴 열기" title="메뉴" style={{ background: C.bg, border: `1px solid ${C.bdr}`, borderRadius: 10, width: 46, height: 46, color: C.text, fontSize: 24, cursor: "pointer", lineHeight: 1 }}>☰</button>
            {/* [D-94] 앱 안 ←/→ 는 뺐다 — 화면마다 주소가 있어 브라우저·휴대폰 뒤로 가기가 같은 일을 한다 */}
            <div onClick={() => { setTab("briefing"); setDrawerOpen(false); }} style={{ fontSize: 17, fontWeight: 900, cursor: "pointer", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{pageTitle}</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => openAdd("lead")} title="고객 등록" style={{ background: C.blue, border: "none", borderRadius: 10, height: 46, padding: "0 14px", color: "#FFFFFF", fontSize: 16, fontWeight: 800, cursor: "pointer" }}>+ 등록</button>
          </div>
        </div>
        <header className="pcHeader" style={{ position: "sticky", top: 0, zIndex: 40, background: "rgba(255,255,255,.9)", backdropFilter: "blur(8px)", borderBottom: `1px solid ${C.bdr}`, padding: "14px 28px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            {/* [D-94] ‘← 뒤로 / 앞으로 →’ 는 뺐다 — OS 목차와 브라우저 뒤로 가기가 같은 일을 해 두 갈래가 되었다 */}
            <h1 style={{ margin: 0, fontSize: "calc(var(--s,1.3)*24px)", fontWeight: 700, letterSpacing: "-0.02em" }}>{pageTitle}</h1>{/* [D-96] OS 화면 제목과 같은 굵기·크기(원본 30px·얇음) */}
          </div>
        </header>
        <div className="appMain" style={{ padding: "22px 28px", maxWidth: 1720, width: "100%", margin: "0 auto" }}>
      <div key={tab} className="ui-fade">
      {tab === "briefing" && <Briefing data={data} setData={setData} setTab={setTab} goMeeting={goMeeting} openAdd={openAdd} />}
      {tab === "prospecting" && <TabFrame data={data} setData={setData} screenKey="prospecting" cfg={GUIDE.prospecting} autoOpen={!!selectId || !!recentId}><Prospecting data={data} setData={setData} setTab={setTab} goMeeting={goMeeting} openAdd={openAdd} selectId={selectId} recentId={recentId} onSelected={() => setSelectId(null)} /></TabFrame>}
      {tab === "content" && <TabFrame data={data} setData={setData} screenKey="content" cfg={GUIDE.content}><ContentLab data={data} setData={setData} /></TabFrame>}
      {tab === "meetings" && <TabFrame data={data} setData={setData} screenKey="meetings" cfg={GUIDE.meetings} autoOpen={!!focusId}><MeetingLab data={data} setData={setData} focusId={focusId} /></TabFrame>}
      {tab === "strategies" && <TabFrame data={data} setData={setData} screenKey="strategies" cfg={GUIDE.strategies}><StrategyLibrary data={data} setData={setData} setTab={setTab} /></TabFrame>}
      {tab === "education" && <TabFrame data={data} setData={setData} screenKey="education" cfg={GUIDE.education}><EducationArchive data={data} setData={setData} /></TabFrame>}
      {tab === "updates" && <TabFrame data={data} setData={setData} screenKey="updates" cfg={GUIDE.updates}><UpdatesCenter data={data} setData={setData} setTab={setTab} /></TabFrame>}
      {tab === "companies" && <TabFrame data={data} setData={setData} screenKey="companies" cfg={GUIDE.companies} autoOpen={!!selectId || !!recentId}><CompaniesDB data={data} setData={setData} goMeeting={goMeeting} openAdd={openAdd} selectId={selectId} recentId={recentId} onSelected={() => setSelectId(null)} /></TabFrame>}
      {tab === "pipeline" && <TabFrame data={data} setData={setData} screenKey="pipeline" cfg={GUIDE.pipeline}><Pipeline data={data} setData={setData} goMeeting={goMeeting} /></TabFrame>}
      {tab === "packages" && <TabFrame data={data} setData={setData} screenKey="packages" cfg={GUIDE.packages}><Packages data={data} setData={setData} goMeeting={goMeeting} /></TabFrame>}
      {tab === "reports" && <TabFrame data={data} setData={setData} screenKey="reports" cfg={GUIDE.reports}><CustomerReports data={data} setData={setData} goMeeting={goMeeting} /></TabFrame>}
      {tab === "followup" && <TabFrame data={data} setData={setData} screenKey="followup" cfg={GUIDE.followup}><FollowUps data={data} setData={setData} goMeeting={goMeeting} /></TabFrame>}
      {tab === "analytics" && <TabFrame data={data} setData={setData} screenKey="analytics" cfg={GUIDE.analytics}><Analytics data={data} setData={setData} goMeeting={goMeeting} /></TabFrame>}
      {tab === "settings" && <TabFrame data={data} setData={setData} screenKey="settings" cfg={GUIDE.settings}><Settings data={data} setData={setData} reset={reset} pinSet={pinSet} applyLock={applyLock} removePin={removePin} onLockNow={() => setLocked(true)} /></TabFrame>}
      </div>
        </div>
        <footer style={{ borderTop: "1px solid " + C.bdr, padding: 20, textAlign: "center", color: C.textM, fontSize: "calc(var(--s,1.3)*15px)", marginTop: "auto" }}><div style={{ fontSize: "calc(var(--s,1.3)*13px)", color: C.textM, marginBottom: 4 }}>🔒 영업 기록은 미래에이아이랩 OS 의 모듈 기록에 저장됩니다. 업체는 고객 운영 업체를 그대로 씁니다.</div></footer>
      </div>
    </div>
    <CustomerForm open={!!addState} initial={addState?.initial} mode={addState?.mode} defaultDest={addState?.dest} data={data} onSave={registerCustomer} onClose={() => setAddState(null)} presetOsId={focus && ![...(data?.leads || []), ...(data?.companies || [])].some((c) => c.id === focus) ? focus : null} />
    <PinSetup open={setupOpen} firstTime onSet={(rec) => { applyLock(rec); setSetupOpen(false); }} onClose={() => { applyLock({ ...lock, prompted: true }); setSetupOpen(false); }} />
  </div>;
}

































