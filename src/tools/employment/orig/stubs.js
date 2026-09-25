// [D-93] 원본 SubsidyApp.jsx 가 부르던 바깥 모듈 자리.
//   원본: ../../lib/supabase · ../../hooks/useData · ../../lib/activity · ../../lib/product · ../../lib/applock
//   이 OS 에서는 로그인·결제·관리자·피드백·PIN 이 없다. 저장은 EmploymentOrig.tsx 가 모듈 기록으로 한다.
import { readXlsxSheets, isXlsxFile } from "../../../services/xlsxText";
import { parseCsv } from "../lib/excelImport";

// 원본 관리자·피드백 화면만 부른다 — 이 OS 에서는 열리지 않는다(관리자 아님 · 피드백 버튼 없음)
function unavailable() {
  var res = Promise.resolve({ data: [], error: { message: "이 OS 에서는 쓰지 않는 기능입니다." } });
  var chain = { select: function () { return chain; }, order: function () { return res; }, insert: function () { return res; }, then: res.then.bind(res) };
  return chain;
}
export var supabase = {
  from: function () { return unavailable(); },
  functions: { invoke: function () { return Promise.resolve({ error: { message: "이 OS 에서는 쓰지 않는 기능입니다." } }); } },
};

// ── 원본 hooks/useData.jsx 의 업로드 검증 그대로 ──
export const MAX_FILE_MB = 10;
export const ALLOWED_FILE_EXT = ["pdf", "jpg", "jpeg", "png", "doc", "docx", "xls", "xlsx"];
const ALLOWED_FILE_MIME = [
  "application/pdf",
  "image/jpeg", "image/png",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];
export function validateUploadFile(file) {
  if (!file) return "파일이 없습니다.";
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!ALLOWED_FILE_EXT.includes(ext)) {
    return "허용되지 않는 파일 형식입니다. (PDF·JPG·PNG·DOC·DOCX·XLS·XLSX만 가능)";
  }
  if (file.type && ALLOWED_FILE_MIME.indexOf(file.type) === -1 && !file.type.startsWith("image/")) {
    return "허용되지 않는 파일 형식입니다.";
  }
  if (file.size > MAX_FILE_MB * 1024 * 1024) {
    return `파일이 너무 큽니다. (최대 ${MAX_FILE_MB}MB)`;
  }
  return null;
}

// 원본 lib/activity.js — 사용자 활동 기록(관리자 화면용). 이 OS 는 따로 남기지 않는다
export function trackActivity() {}

// 원본 lib/product.js — 이용 기간 배지. 이 OS 에는 이용 기간이 없다
export function accessPeriodLabel() {
  return { text: "", tone: "admin" };
}

// 모달·드롭다운을 원본 글꼴·색 범위(.hr-orig) 안에 띄우는 자리
export function hrPortalRoot() {
  var el = document.getElementById("hr-orig-portal");
  if (!el) {
    el = document.createElement("div");
    el.id = "hr-orig-portal";
    el.className = "hr-orig hr-portal";
    document.body.appendChild(el);
  }
  return el;
}

// 엑셀·CSV → 표(첫 시트). 원본은 xlsx 라이브러리였다 — 이 OS 는 라이브러리 없이 읽는다
export async function readSheetGrid(file) {
  var ext = (file.name.split(".").pop() || "").toLowerCase();
  if (ext === "xls") throw new Error("옛 엑셀(.xls)은 읽지 못합니다. 엑셀에서 '다른 이름으로 저장 → .xlsx' 로 바꿔 올려 주세요.");
  if (isXlsxFile(file)) {
    var sheets = await readXlsxSheets(await file.arrayBuffer());
    return sheets.length ? sheets[0].rows : [];
  }
  var buf = await file.arrayBuffer();
  var text = new TextDecoder("utf-8").decode(buf);
  // 한글 엑셀이 CSV 로 저장하면 EUC-KR 인 경우가 많다
  if (text.indexOf("�") >= 0) {
    try { text = new TextDecoder("euc-kr").decode(buf); } catch { /* utf-8 그대로 */ }
  }
  return parseCsv(text);
}

// 표 → CSV 내려받기 (엑셀에서 바로 열리게 BOM)
export function downloadCsv(name, rows) {
  var csv = "﻿" + rows.map(function (r) {
    return r.map(function (c) { c = String(c == null ? "" : c); return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(",");
  }).join("\r\n");
  var blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}
