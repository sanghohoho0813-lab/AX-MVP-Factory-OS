// 크레탑 미니앱 — 상세 팝업/이해관계자 표시용 텍스트 정리 헬퍼.
//  * 재무제표 숫자/계산에는 절대 적용하지 않음. 상세 팝업 텍스트 가독성 개선 전용.
import { normalizeCretopPdfText } from "../engine/index.js";

// 한글 가독성 보정 — 글자공백(char-spacing) 압축 후 단어경계 보정 + 문장 줄바꿈.
//  * 표시(렌더) 단계 팝업 텍스트 전용. extract.js/재무 파싱은 엔진 normalizeCretopPdfText만 사용(이 함수 미사용).
//  * 법인 약칭 (주)(유)…는 제어문자 토큰(\x01,\x02)으로 보호했다가 마지막에 복원 — 회사명엔 붙이고 바깥쪽만 띄움.
export function normalizeKoreanText(s) {
  if (!s) return "";
  return normalizeCretopPdfText(String(s))
    .replace(/[ ​　﻿]/g, " ")
    .replace(/\(\s*([주유사재합])\s*\)/g, "\x01$1\x02")
    .replace(/\(\s+/g, "(").replace(/\s+\)/g, ")")
    .replace(/\)\s*\(/g, ") (")
    .replace(/([가-힣])\(/g, "$1 (").replace(/\)([가-힣])/g, ") $1")
    .replace(/([A-Za-z])([가-힣])/g, "$1 $2").replace(/([가-힣])([A-Za-z])/g, "$1 $2")
    .replace(/\s*([:：])\s*/g, "$1 ")
    .replace(/([가-힣])(\d)/g, (m, a, b) => /[제총약]/.test(a) ? a + b : a + " " + b)
    .replace(/(\d\s*[년월일원％%주배회개명세호평㎡]?)([가-힣])/g, (m, a, b) => /[년월일원％%주배회개명세호평㎡]/.test(a.slice(-1)) ? a + " " + b : a + b)
    .replace(/([,，·;])(?=[^\s\d])/g, "$1 ")
    .replace(/([가-힣A-Za-z)])\s*및\s*([가-힣A-Za-z(])/g, "$1 및 $2")
    .replace(/(각자대표이사|공동대표이사|대표이사|대표자|사내이사|사외이사|감사|과장|부장|차장|사장|회장|상무|전무|팀장|실장)([가-힣]{2,3})(?=[\s,()]|$)/g, "$1 $2")
    .replace(/(으로|에서|에의해|에 의해|하여|하고|으며|면서|까지|부터|바탕으로|소재에서|목적으로|통해|위해|대해|운영하며|졸업하고|영위|취임|총괄|승계|등을|등의|중이며|있으며|하였고|규모의|로)(?=[가-힣(])/g, "$1 ")
    .replace(/((?:서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)(?:특별자치시|특별자치도|특별시|광역시|도)?)(?=[가-힣])/g, "$1 ")
    .replace(/([가-힣]{2}(?:시|군))(?=[가-힣]{2,3}(?:읍|면|동|리))/g, "$1 ")
    .replace(/([가-힣]{2}(?:읍|면|동|리))(?=\d)/g, "$1 ")
    .replace(/(고용노동부|중소벤처기업부|산업통상자원부|과학기술정보통신부|중소기업청|특허청|행정안전부|국세청)(?=[가-힣])/g, "$1 ")
    .replace(/([가-힣])외(?=[\s,)·\d]|$)/g, "$1 외")
    .replace(/([다음임요됨])\.\s*/g, "$1.\n")
    .replace(/([가-힣A-Za-z])\x01([주유사재합])\x02(?=[가-힣])/g, "$1 ($2)")
    .replace(/\x01([주유사재합])\x02(?=[가-힣])/g, "($1)")
    .replace(/([가-힣A-Za-z])\x01([주유사재합])\x02(?=[(（A-Za-z0-9])/g, "$1($2) ")
    .replace(/\x01([주유사재합])\x02/g, "($1)")
    .replace(/[\x01\x02]/g, "")
    .replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n")
    .split(/\r?\n/).map((l) => l.trim()).filter(Boolean).join("\n")
    .trim();
}

// 알려진 라벨 기준으로 'label: value' 행 분리. 라벨 위치를 찾아 다음 라벨 전까지를 값으로.
export function splitRowsByKnownLabels(text, labels) {
  const t = normalizeKoreanText(text).replace(/\n/g, " ").trim();
  if (!t || !labels || !labels.length) return [];
  const esc = labels.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\//g, "\\s*/\\s*").replace(/\s+/g, "\\s*"));
  const re = new RegExp("(" + esc.join("|") + ")\\s*[:：]?\\s*", "g");
  const marks = []; let m;
  while ((m = re.exec(t))) marks.push({ label: m[1].replace(/\s+/g, ""), start: m.index, end: re.lastIndex });
  const rows = [];
  for (let i = 0; i < marks.length; i++) {
    const cur = marks[i], next = marks[i + 1];
    const val = t.slice(cur.end, next ? next.start : undefined).trim().replace(/[·,\s]+$/, "");
    rows.push({ label: cur.label, value: val });
  }
  return rows;
}

// 행 중복 제거(keyFn 기준). 같은 키 첫 행만 유지.
export function dedupeRows(rows, keyFn) {
  const seen = new Set(), out = [];
  for (const r of (rows || [])) { const k = keyFn ? keyFn(r) : JSON.stringify(r); if (seen.has(k)) continue; seen.add(k); out.push(r); }
  return out;
}

// 연혁: '날짜 + 내용' 행으로 분리(날짜 없으면 내용만).
function historyRows(text) {
  return normalizeKoreanText(text).split(/\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
    const m = l.match(/^((?:19|20)\d{2}(?:[-.\/]\d{1,2}){0,2})\s*(.*)$/);
    return m && m[2] ? { date: m[1], desc: m[2] } : { date: "", desc: l };
  });
}

// 주요경력: '기간(시작~종료) + 내용(근무기업/업종/직위/담당)'으로 분리. 종료 없으면 '~ 현재'.
function careerRows(text) {
  return normalizeKoreanText(text).split(/\n/).map((l) => l.trim()).filter(Boolean).map((l) => {
    const m = l.match(/^((?:19|20)\d{2}[-.\/]\d{1,2})\s*~\s*((?:19|20)\d{2}[-.\/]\d{1,2})?\s*(.*)$/);
    if (m) { const start = m[1], end = m[2] || "", desc = (m[3] || "").trim(); return { period: end ? `${start} ~ ${end}` : `${start} ~ 현재`, desc }; }
    return { period: "", desc: l };
  }).filter((r) => r.period || r.desc);
}

// 종합의견: 기업체개요(+경영진) 본문만 하나의 문단형 영역으로 정리. 영업상황(재무 반복)·COPYRIGHT·조회일시는 제외
//  (해당 재무 숫자는 핵심지표/재무상세에서 이미 표시). 문장 끝 마침표 기준 줄바꿈으로 읽기 쉽게.
function opinionBlocks(text) {
  const rows = splitRowsByKnownLabels(text, ["기업체개요", "기업개요", "경영진", "영업상황"]);
  let body;
  if (rows.length) {
    const keep = rows.filter((r) => /기업체?개요|경영진/.test(r.label));
    body = (keep.length ? keep : rows.filter((r) => !/영업상황/.test(r.label))).map((r) => r.value).join(" ");
    if (!body.trim()) body = rows.map((r) => r.value).join(" ");
  } else {
    body = String(text || "");
  }
  // 영업상황/저작권/조회일시/페이지 꼬리 제거(혼입 대비)
  body = body
    .replace(/영업\s*상황[\s\S]*$/, "")
    .replace(/C\s*O\s*P\s*Y\s*R\s*I\s*G\s*H\s*T[\s\S]*$/i, "").replace(/copyright[\s\S]*$/i, "")
    .replace(/조회\s*일시[\s\S]*$/, "").replace(/\d+\s*\/\s*\d+\s*$/, "");
  const clean = normalizeKoreanText(body)
    .replace(/([가-힣)」』”'%）])\s*\.\s+(?=[가-힣“"「『(（])/g, "$1.\n")   // 문장 끝 마침표 기준 줄바꿈(종합의견 전용)
    .split(/\r?\n/).map((l) => l.trim()).filter(Boolean).join("\n");
  return clean ? [{ title: "종합의견", body: clean }] : [];
}

// 팝업 섹션 포맷 통합 — mode: 'kv' | 'history' | 'opinion' | 'text'
//  반환: { mode, rows?, blocks?, text?, empty }
export function formatPopupSection(text, opt) {
  const o = opt || {}; const mode = o.mode || "text";
  const isNoData = text && /조회된\s*자료가?\s*없|자료가?\s*없습니다|해당\s*자료\s*없/.test(String(text));
  if (!text) return { mode, empty: true };
  if (isNoData) return { mode: "text", text: "조회된 자료가 없습니다.", empty: false, noData: true };
  if (mode === "kv") {
    const rows = dedupeRows(splitRowsByKnownLabels(text, o.labels || []), (r) => r.label).filter((r) => r.value);
    return rows.length ? { mode: "kv", rows, empty: false } : { mode: "text", text: normalizeKoreanText(text), empty: false };
  }
  if (mode === "history") { const rows = historyRows(text); return { mode: "history", rows, empty: !rows.length }; }
  if (mode === "career") { const rows = careerRows(text); return { mode: "career", rows, empty: !rows.length }; }
  if (mode === "opinion") { const blocks = opinionBlocks(text); return { mode: "opinion", blocks, empty: !blocks.length }; }
  if (mode === "lines") {
    // 표 헤더(내용/순번 등)·저작권 꼬리 제거. 외부 일련번호(1~N) 제거 후 항목은 '1. 내용'으로 통일 표기.
    const drop = (l) => { const s = l.replace(/\s/g, ""); return !s || /^(내용|순번|번호|구분|항목|목적|내역)$/.test(s) || /^copyright/i.test(s) || /allrightsreserved|korearating|bykorea|조회일시|기준일자/i.test(s); };
    const items = normalizeKoreanText(text)
      .replace(/\s(\d{1,2})\s*[.)]\s+/g, "\n$1. ")
      .split(/\n/).map((l) => l.trim()).filter((l) => l && !drop(l))
      .map((l) => l.replace(/^(\d{1,2})\s*[.)]\s+/, ""))   // 외부 일련번호(예: '2. ') 제거
      .map((l) => l.replace(/^(\d{1,2})\s+/, "").trim())   // 표의 상수 번호열('1 ') 제거 → 내용만
      .filter((l) => l && !drop(l));
    return items.length ? { mode: "lines", items, empty: false } : { mode: "text", text: normalizeKoreanText(text), empty: false };
  }
  return { mode: "text", text: normalizeKoreanText(text), empty: false };
}

// 라벨 세트(상세 팝업용)
export const CEO_PERSONAL_LABELS = ["성명/직위", "성명", "직위", "생년월일/성별", "생년월일", "성별", "거주지", "주소지", "상훈", "경영실권자와의 관계", "출신학교", "자격증"];
export const CEO_CAREER_LABELS = ["기간", "근무기업", "근무업종", "최종직위", "담당업무"];
export const WORK_BASIC_LABELS = ["번호", "구분", "사업자번호", "사업장명", "주생산품", "주소", "전화번호"];
export const WORK_DETAIL_LABELS = ["구분", "사업장명", "주사업장여부", "소유자", "소유주와의 관계", "자가소유여부", "실제가동여부", "주생산품", "주소", "전화번호", "팩스번호", "입지조건", "산업단지명", "대지", "건물", "임차보증금규모", "월세금액규모", "권리침해여부", "담보제공여부"];
