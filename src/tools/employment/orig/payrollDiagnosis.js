// [D-93] 원본 src/lib/payrollDiagnosis.js 그대로. 바꾼 곳: 엑셀 읽기(xlsx 라이브러리 → OS 엑셀 읽개) 한 곳.
// [D-136] 분류·계산·글자 파싱은 도구 화면과 같은 한 벌(../lib/rosterCore.ts)을 쓴다 — 여기에는 파일 읽기(엑셀 · PDF)만 남겼다.
//         (두 벌이 따로 있어 한쪽만 고쳐지는 일이 없게. 주민번호 원본 미보관 원칙은 rosterCore 에 그대로 있다.)
// ============================================================
// 4대보험 가입자 명부 자동진단 — 파일 읽기
//
// 안전 원칙(중요):
//  - 이 모듈은 파일을 "브라우저 메모리에서만" 읽는다. 서버/Storage/Supabase 저장 없음.
//  - 주민등록번호 원본은 절대 보관/반환하지 않는다.
//    파싱 즉시 생년월일·성별만 도출하고, 화면 표시는 마스킹값(900101-1******)만 사용한다.
//  - 결과는 "확정"이 아니라 1차 검토(가능성/확인 필요/추가자료 필요/판단 불가)로만 표시한다.
// ============================================================

import { readSheetGrid } from "./stubs";
import { detectRoster, extractEmployees, parsePdfRosterLines } from "../lib/rosterCore";

export * from "../lib/rosterCore";

// ── 파일 파싱 (엑셀/CSV) — 브라우저 메모리에서만 ──────────
// 반환: { ok, employees, meta, headerIdx, error }
export async function parseRosterFile(file) {
  var ext = (file.name.split(".").pop() || "").toLowerCase();
  if (ext === "pdf") return { ok: false, error: "pdf_unsupported" };
  if (["xlsx", "xls", "csv"].indexOf(ext) === -1) return { ok: false, error: "unsupported" };
  try {
    var grid = await readSheetGrid(file); // [D-93] OS 엑셀 읽개 (라이브러리 없이 · 첫 시트)
    if (!grid || grid.length < 2) return { ok: false, error: "empty" };
    var det = detectRoster(grid);
    var emps = extractEmployees(grid, det);
    if (!emps.length) return { ok: false, error: "no_rows", headerIdx: det.headerIdx };
    return { ok: true, employees: emps, meta: det.meta, headerIdx: det.headerIdx };
  } catch (e) {
    return { ok: false, error: "read_failed", message: e && e.message };
  }
}

// ── PDF 텍스트 추출 (브라우저 워커, 서버 업로드 없음) ──────
// pdfjs 본체는 사용 시점에만 동적 import. OCR 없음(텍스트 PDF 전용).
async function loadPdfDoc(file) {
  var pdfjs = await import("pdfjs-dist-v4"); // [D-94] 원본과 같은 pdf.js 4.10.38
  // 워커 URL 도 사용 시점에만 로드(Vite 가 별도 에셋으로 방출). 본체/워커 모두 lazy.
  try {
    var workerUrl = (await import("pdfjs-dist-v4/build/pdf.worker.min.mjs?url")).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  } catch { /* worker 미설정 시 pdfjs 기본값 */ }
  var buf = await file.arrayBuffer();
  return pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false, disableAutoFetch: true }).promise;
}

// 텍스트 아이템을 y좌표로 묶어 "줄" 문자열 배열로 변환
function groupItemsToLines(items) {
  var rows = {};
  (items || []).forEach(function (it) {
    if (!it || !it.str || !String(it.str).trim()) return;
    var tr = it.transform || [];
    var y = tr.length >= 6 ? Math.round(tr[5] / 2) * 2 : 0; // 미세한 y 차이 흡수
    var x = tr.length >= 6 ? tr[4] : 0;
    if (!rows[y]) rows[y] = [];
    rows[y].push({ x: x, s: it.str });
  });
  var keys = Object.keys(rows).map(Number).sort(function (a, b) { return b - a; }); // 위→아래
  return keys.map(function (k) {
    return rows[k].sort(function (a, b) { return a.x - b.x; }).map(function (o) { return o.s; }).join(" ").replace(/\s+/g, " ").trim();
  }).filter(function (l) { return l; });
}

// 각 페이지 텍스트를 줄 단위로 추출 (onProgress(phase, cur, total))
// opts.maxPages: 모바일 등에서 과부하 방지를 위해 처리 페이지 수 제한
export async function extractPdfLines(file, onProgress, opts) {
  opts = opts || {};
  var doc = await loadPdfDoc(file);
  var lines = [];
  var total = doc.numPages;
  var limit = opts.maxPages && opts.maxPages > 0 ? Math.min(opts.maxPages, total) : total;
  var truncated = limit < total;
  try {
    for (var p = 1; p <= limit; p++) {
      if (onProgress) onProgress("extract", p, limit);
      var page = await doc.getPage(p);
      var tc = await page.getTextContent();
      lines = lines.concat(groupItemsToLines(tc.items));
      try { page.cleanup(); } catch { /* ignore */ }
    }
  } finally {
    try { doc.destroy(); } catch { /* ignore */ }
  }
  return { lines: lines, totalPages: total, processedPages: limit, truncated: truncated };
}

// PDF 명부 파싱 (텍스트 추출 → 직원 추정). 스캔 이미지 PDF 는 no_text 반환.
// opts.maxPages 로 처리 페이지 수 제한(모바일 안정화).
export async function parsePdfRoster(file, onProgress, opts) {
  try {
    if (onProgress) onProgress("read");
    var ex = await extractPdfLines(file, onProgress, opts);
    var lines = ex.lines || [];
    var textLen = lines.join("").replace(/\s/g, "").length;
    if (!lines.length || textLen < 8) return { ok: false, error: "no_text" }; // 스캔 이미지 등 텍스트 없음
    if (onProgress) onProgress("find");
    var res = parsePdfRosterLines(lines);
    if (!res.employees.length) return { ok: false, error: "no_rows", truncated: ex.truncated, totalPages: ex.totalPages };
    return { ok: true, employees: res.employees, meta: res.meta, missingCount: res.missingCount, truncated: ex.truncated, totalPages: ex.totalPages, processedPages: ex.processedPages };
  } catch (e) {
    return { ok: false, error: "read_failed", message: e && e.message };
  }
}

// PDF 에서 "검수용 텍스트"만 추출(직원 추정 전 단계). 실패해도 text 는 가능한 만큼 반환.
export async function extractPdfText(file, onProgress, opts) {
  try {
    if (onProgress) onProgress("read");
    var ex = await extractPdfLines(file, onProgress, opts);
    var lines = ex.lines || [];
    var text = lines.join("\n");
    var textLen = text.replace(/\s/g, "").length;
    if (!lines.length || textLen < 8) return { ok: false, error: "no_text", text: text, truncated: ex.truncated, totalPages: ex.totalPages };
    return { ok: true, text: text, truncated: ex.truncated, totalPages: ex.totalPages, processedPages: ex.processedPages };
  } catch (e) {
    return { ok: false, error: "read_failed", message: e && e.message, text: "" };
  }
}

