// 크레탑 미니앱 — 원문 추출 헬퍼(페이지 기반 우선 + 전체 raw fallback). 엔진/재무계산 무관.
//  * pdf.js가 page별 text를 보존하면 pageNo 힌트로 우선 추출, 실패 시 전체 raw로 fallback.
//  * 크레탑 PDF의 글자 사이 공백(char-spacing)은 엔진 normalizeCretopPdfText로 정규화 후 추출.
//  * 개인사업자 감지 + 법인전용 전략 목록 + 추출 디버그(관리자용)도 여기서 제공.
import { normalizeCretopPdfText } from "../engine/index.js";

const norm = (t) => normalizeCretopPdfText(String(t || ""));

// ── 페이지 텍스트 유틸 ──
export function pageText(pages, no) { if (!pages || !pages.length) return ""; const p = pages.find((x) => x.pageNo === no); return p ? String(p.text || "") : ""; }
export function pagesText(pages, nos) { if (!pages || !pages.length) return ""; return nos.map((n) => pageText(pages, n)).filter(Boolean).join("\n"); }

// ── 섹션 블록 추출 ──
// 다음 섹션 헤더(또는 한도)까지의 라인을 묶어 반환. 헤더 같은 줄의 잔여 값도 포함.
const MAJOR_STOP = /^(?:[■▶※·◦\-]\s*)?(?:주요\s*주주|주주\s*현황|주주\s*구성|관계\s*회사(?!\s*와)|관계사|계열\s*회사|주요\s*구매처|구매처\s*현황|주요\s*판매처|판매처\s*현황|거래처\s*현황|매입처|매출처|매출\s*구성|연혁|회사\s*연혁|사업\s*목적|사업목적|상품\s*정보|주요\s*제품|종합\s*의견|인적\s*사항|주요\s*경력|경력\s*사항|학력|상훈|보유\s*자격|경영진\s*현황|임원\s*현황|사업장\s*현황|사업장\s*세부|공장\s*현황|특허|인증\s*현황|지식\s*재산|소송|담보|채권|재무\s*상태표|손익\s*계산서|재무\s*비율|현금\s*흐름|업계\s*순위|동종\s*업계|신용\s*등급|기술\s*평가|COPYRIGHT|Copyright|페이지)/;
const OPINION_STOP = /^(?:[■▶※·◦\-]\s*)?(?:인적\s*사항|주요\s*경력|경력\s*사항|학력|상훈|보유\s*자격|경영진\s*현황|임원\s*현황|사업장\s*현황|사업장\s*세부|주요\s*주주|주주\s*현황|관계\s*회사(?!\s*와)|주요\s*구매처|주요\s*판매처|거래처\s*현황|재무\s*상태표|손익\s*계산서|재무\s*비율|현금\s*흐름|특허|인증\s*현황|소송|담보|신용\s*등급|COPYRIGHT|Copyright)/;

// 매칭은 정규화 라인으로(char-spacing 무시), 출력은 원본 라인(산문 공백 보존). 거래처는 normalizeOutput로 정규화 출력.
function grabBlock(text, headerRe, opt) {
  const o = opt || {}; const stop = o.stop || MAJOR_STOP; const maxLines = o.maxLines || 24; const maxChars = o.maxChars || 1200;
  const orig = String(text || "").split(/\r?\n/);
  const mn = orig.map((l) => norm(l));   // 매칭 전용 정규화
  for (let i = 0; i < orig.length; i++) {
    if (!headerRe.test(mn[i]) && !headerRe.test(orig[i])) continue;
    const out = []; let chars = 0;
    const inline = orig[i].replace(headerRe, "").replace(/^[\s:：·\-]+/, "").trim();
    if (inline && !/^\(?[가-힣]*\)?$/.test(norm(inline))) { out.push(inline); chars += inline.length; }
    for (let j = i + 1; j < orig.length && out.length < maxLines; j++) {
      const lo = orig[j].trim(); const ln = mn[j];
      if (!ln) continue;
      if (stop.test(ln) || stop.test(lo)) break;
      out.push(o.normalizeOutput ? ln : lo); chars += ln.length;
      if (chars > maxChars) break;
    }
    const txt = out.join("\n").trim();
    if (txt) return txt;
  }
  return null;
}

// 후보 텍스트(힌트 페이지들 → 전체 raw)에 차례로 grabBlock 시도. 매칭은 grabBlock 내부에서 정규화.
function grabAny(raw, pages, nos, headerRe, opt) {
  const cands = [];
  (nos || []).forEach((n) => { const t = pageText(pages, n); if (t && t.replace(/\s/g, "").length > 8) cands.push(t); });
  cands.push(String(raw || ""));
  for (const c of cands) { const r = grabBlock(c, headerRe, opt); if (r) return r; }
  return null;
}

// ── 이해관계자 구간 슬라이스 — 시작 헤더 ~ 다음(끝) 헤더 전까지만 잘라 영역 혼합 방지 ──
function sliceBetween(normText, startRe, endRes) {
  const t = String(normText || ""); const sm = t.search(startRe); if (sm < 0) return null;
  let body = t.slice(sm).replace(startRe, "");
  let cut = body.length;
  (endRes || []).forEach((er) => { const m = body.search(er); if (m >= 0 && m < cut) cut = m; });
  return body.slice(0, cut).trim();
}
// 영역 추출: 우선 페이지(상세) 슬라이스 → 없으면 fallback 페이지 → 전체 raw. source 라벨 동반.
function extractArea(raw, pages, primaryNo, primaryLabel, fallbackNo, fallbackLabel, startRe, endRes) {
  const tryPage = (no) => { const pt = pageText(pages, no); return pt ? sliceBetween(norm(pt), startRe, endRes) : null; };
  let slice = tryPage(primaryNo), source = primaryLabel;
  if (slice == null || !slice.trim()) { slice = tryPage(fallbackNo); source = fallbackLabel; }
  if (slice == null || !slice.trim()) { slice = sliceBetween(norm(raw), startRe, endRes); source = "전체 원문"; }
  const parsed = parseTradeBlock(slice);
  return Object.assign({ source: (parsed.empty && !parsed.noData) ? null : source }, parsed);
}

// 구간 내 모든 슬라이스(시작 헤더가 여러 번 나오면 각각). 가장 행이 많은 슬라이스를 detail로 채택.
function allSlices(normFull, startRe, endRes) {
  const re = new RegExp(startRe.source, startRe.flags.includes("g") ? startRe.flags : startRe.flags + "g");
  const out = []; let m; let guard = 0;
  while ((m = re.exec(normFull)) && guard++ < 50) {
    const rest = normFull.slice(m.index + m[0].length);
    let cut = rest.length; (endRes || []).forEach((er) => { const k = rest.search(er); if (k >= 0 && k < cut) cut = k; });
    out.push(rest.slice(0, cut).trim());
    if (re.lastIndex <= m.index) re.lastIndex = m.index + 1;
  }
  return out;
}
const noDataOf = (s) => { const nd = String(s || "").match(/해당\s*사항\s*없음?|조회된\s*자료가?\s*없습니다?|자료가?\s*없습니다|해당\s*자료\s*없/); return nd ? { noData: true, rows: [], note: /해당\s*사항/.test(nd[0]) ? "해당사항없음" : "조회된 자료가 없습니다." } : null; };

// 거래처(구매/판매) 구간 → '이름 + 거래비중%' 행. 크레탑 거래처현황 표(기업명·사업자번호·대표자·거래비중·재무) 파싱.
//  * 거래비중은 'X.XX'(0~100, % 없음). 이름은 사업자번호/숫자 앞. 줄바꿈된 ((주) 등)은 이름 버퍼로 이어붙임.
function parseTradeBlock(block) {
  if (block == null) return { empty: true, rows: [] };
  const nd = noDataOf(block); if (nd) return nd;
  const clean = (s) => String(s).replace(/[（]/g, "(").replace(/[）]/g, ")").replace(/\(\s*주\s*\)/g, "(주)").replace(/\s*\(\s*/g, "(").replace(/\s*\)\s*/g, ")").replace(/\s+/g, "").trim();
  const HDR = /^(기업명|사업자|대표자|거래비중|결산|단위|구매처현황|판매처현황|매출구성|기준일|조회일|관계내용|사업내용|품목|주요제품|사업부문)/;
  const rows = []; const seen = new Set(); let nameBuf = "";
  for (const ln of block.split(/\n/).map((l) => l.trim()).filter(Boolean)) {
    const t = ln.replace(/\s/g, "");
    if (HDR.test(t)) { nameBuf = ""; continue; }
    const pm = ln.match(/(\d{1,2}\.\d{2})(?!\d)/);   // 거래비중 X.XX (financials는 콤마 정수 → 소수 없음)
    const pct = pm ? pm[1] : null;
    // 이름 후보: 사업자번호 앞, 또는 (숫자 전) 한글·괄호
    let namePart = "";
    const bizIdx = ln.search(/\d{3}\s*-\s*\d{2}\s*-/);
    if (bizIdx > 0) namePart = ln.slice(0, bizIdx);
    else { const nm = ln.match(/^([()（）주\s]*[가-힣A-Za-z][가-힣A-Za-z()（）주\s]*?)(?=\s*\d|$)/); if (nm) namePart = nm[1]; }
    namePart = clean(namePart);
    if (/^[()（）주]+$/.test(namePart)) namePart = "";   // 줄바꿈된 괄호 조각('주)' 등) 무시
    if (namePart && !/^\d/.test(namePart) && !/^(합계|소계|총계|계)$/.test(namePart)) nameBuf += namePart;
    if (pct) {
      let name = /^기타/.test(nameBuf) ? "기타" : nameBuf.replace(/\($/, "(주)");   // 끝이 '(' 면 줄바꿈된 (주)
      const v = parseFloat(pct);
      if (name && name.length >= 1 && !/^(합계|소계|총계|계|구분|순위|비중)$/.test(name) && v > 0 && v <= 100) {
        const key = name + "|" + pct; if (!seen.has(key)) { seen.add(key); rows.push(`${name} ${pct}%`); }
      }
      nameBuf = "";
    }
  }
  return rows.length ? { rows } : { empty: true, rows: [] };
}
// 주주현황 구간 → 구조화 행 cols:[{name,kind,shares,pct,relMgr,relCo}] + rows(문자열) + _raw + total.
//  * 크레탑 표는 문자간격(char-spacing) + 셀 병합으로 추출되어, 엔진 정규화 후에도 셀 경계가 흐려진다.
//    - 긴 구분('최대주주의특수관계인')은 데이터 행 위/아래로 줄바꿈됨 → 인접 프래그먼트로 재구성.
//    - 콤마 없는 숫자열(예 '500 0 500 1 0 1' → '5000500101')은 'X 0 X' 대칭으로 보통주(X) 복원.
//    - 관계('본인대표이사')는 공백 없이 붙음 → 경영실권자 관계 접두로 분리.
//    - 지분율은 소유주식수 ÷ 발행주식수(합계 or 개별합) × 100 으로 계산(원문 표와 동일값).
const SH_KIND = /(최대주주의?\s*특수\s*관계인|최대주주|5\s*%?\s*이상\s*주주?|특수\s*관계인|소액\s*주주|기타\s*주주|우리\s*사주)/;
const SH_RELMGR = /^(본인|배우자|친인척|형제자매|직계존속|직계비속|가족|친척|형제|자매|타인|모친|부친|모|부|처|자녀|자|손|법인)/;
function parseShareholderRows(block) {
  if (block == null) return { empty: true, rows: [] };
  const nd = noDataOf(block); if (nd) return nd;
  const tight = (s) => String(s).replace(/\s+/g, "").replace(/\(주\)/g, "(주)").trim();
  const META = /^(?:주주명|성명|구분|순위|보통주|우선주|지분율|소유\s*주식|발행\s*주식|현황\s*기준|기준\s*일|작성|조회\s*일|단위|자본금|비고|경영\s*실권자|회사와)/;
  // 콤마 없는 병합 숫자에서 보통주(소유주식수) 복원 — 'X 0 X …' 대칭 또는 첫 값
  const recoverShares = (s) => {
    const d = s.replace(/[^0-9]/g, "");
    if (s.includes(",") || d.length <= 4) return parseInt(d, 10);
    for (let len = 1; len * 2 + 1 <= d.length; len++) { const b = d.slice(0, len); if (d[len] === "0" && d.slice(len + 1, len + 1 + len) === b) return parseInt(b, 10); }
    return parseInt(d.slice(0, Math.max(1, Math.round(d.length / 3))), 10);   // 폴백: 앞 1/3
  };
  const isFrag = (l) => !!l && !/\d/.test(l) && /^[가-힣()]+$/.test(l.replace(/\s/g, "")) && l.replace(/\s/g, "").length <= 12 && !META.test(l);
  const lines = block.split(/\n/).map((l) => l.trim()).filter(Boolean);
  let total = null;
  for (const ln of lines) if (/합\s*계|총\s*계/.test(ln)) { const tn = (ln.match(/\d[\d,]{2,}/g) || []).map((x) => parseInt(x.replace(/,/g, ""), 10)).filter((v) => v >= 100 && v < 1e9); if (tn.length) total = Math.max(...tn); }
  const recs = [];
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    if (META.test(ln) || /합\s*계|총\s*계/.test(ln) || !/\d/.test(ln)) continue;   // 데이터 행만(숫자 포함)
    const km = ln.match(SH_KIND);
    let name, kind = null;
    if (km && km.index > 0) { name = tight(ln.slice(0, km.index)).replace(/[\d,(].*$/, ""); kind = tight(km[0]); }
    else { name = tight((ln.match(/^([가-힣()][가-힣().·]*?)(?=\s*[\d(]|$)/) || [])[1] || ""); }
    if (!name || name.length < 2 || META.test(name)) continue;
    if (!kind) {   // 구분 줄바꿈 재구성: 앞 프래그먼트 + 뒤 프래그먼트
      const combo = (isFrag(lines[i - 1]) ? lines[i - 1].replace(/\s/g, "") : "") + (isFrag(lines[i + 1]) ? lines[i + 1].replace(/\s/g, "") : "");
      if (SH_KIND.test(combo) || /특수\s*관계인/.test(combo)) kind = combo;
    }
    const numTok = (ln.replace(SH_KIND, " ").replace(name, " ").match(/\d[\d,]*/g) || [])[0];
    const shares = numTok ? recoverShares(numTok) : null;
    const tm = ln.match(/([가-힣]+)(?:\s+([가-힣]+))?\s*$/);   // 끝 관계(공백분리 또는 병합)
    let relMgr = null, relCo = null;
    if (tm) {
      if (tm[2]) { relMgr = tm[1]; relCo = tm[2]; }                                       // 공백 분리형
      else { const rm = tm[1].match(SH_RELMGR); if (rm && tm[1].length > rm[1].length) { relMgr = rm[1]; relCo = tm[1].slice(rm[1].length); } }   // 병합형
    }
    if (!shares) continue;
    recs.push({ name, kind, shares, relMgr, relCo });
  }
  const sumShares = recs.reduce((a, r) => a + (r.shares || 0), 0);
  const base = (total != null && total > 0) ? total : (sumShares > 0 ? sumShares : null);   // 지분율 분모(합계 우선, 없으면 개별합)
  const rows = [], cols = [], _raw = []; const seen = new Set();
  recs.forEach((r) => {
    const pct = (r.shares != null && base) ? Math.round((r.shares / base) * 100 * 10) / 10 : null;
    const pctStr = pct != null ? String(pct) : null;
    const key = r.name + "|" + (r.shares || ""); if (seen.has(key)) return; seen.add(key);
    _raw.push({ name: r.name, shares: r.shares, pct: pctStr });
    cols.push({ name: r.name, kind: r.kind || null, shares: r.shares, pct: pctStr, relMgr: r.relMgr || null, relCo: r.relCo || null });
    rows.push(r.name + (r.shares ? ` ${r.shares.toLocaleString()}주` : "") + (pctStr ? ` / ${pctStr}%` : ""));
  });
  return (rows.length || total) ? { rows, cols, _raw, total } : { empty: true, rows: [] };
}
function bestBy(normFull, startRe, endRes, parser, source) {
  let best = { empty: true, rows: [] }, bestN = -1;
  for (const s of allSlices(normFull, startRe, endRes)) { const p = parser(s); const n = p.noData ? 0.5 : (p.rows ? p.rows.length : 0); if (n > bestN) { bestN = n; best = p; } }
  return Object.assign({ source: (best.noData || (best.rows && best.rows.length)) ? source : null }, best);
}

// 비교용 이름 정규화 — 거래처/주주 행에서 뒤따르는 비중%·주식수 등 제거 후 순수 이름만.
const bareName = (s) => String(s || "").replace(/\s*[\d(].*$/, "").replace(/\(\s*주\s*\)|\(주\)/g, "").replace(/\s+/g, "").trim();

// 종합의견 본문의 '주요매입처로는 …, 주요매출처로는 …' 문장에서 거래처명 목록 추출(거래처현황 페이지가 없을 때 폴백, %는 없음).
function tradeFromOpinion(nf, which) {
  const re = which === "buy"
    ? /주요\s*매입처\s*로?\s*는?\s*([\s\S]*?)(?=주요\s*매출처|등이?\s*있|최근\s*년?\s*도?\s*영업|영업\s*실적|$)/
    : /주요\s*매출처\s*로?\s*는?\s*([\s\S]*?)(?=등이?\s*있|최근\s*년?\s*도?\s*영업|영업\s*실적|$)/;
  const m = nf.match(re); if (!m || !m[1]) return null;
  const names = m[1].split(/[,，]/).map((s) => s.replace(/\(\s*주\s*\)/g, "(주)").replace(/\s+/g, "").replace(/(외|등)$/, "").trim())
    .filter((s) => s && /[가-힣A-Za-z]/.test(s) && s.length >= 2 && !/^(외|등|및|로는|으로)$/.test(s));
  return names.length ? Array.from(new Set(names)).slice(0, 8) : null;
}

// ── 이해관계자 — 전체 정규화 원문에서 섹션 구간 슬라이스(detail 우선) → 영역 혼합 차단 ──
export function extractStakeholders(raw, pages) {
  const nf = norm(pages && pages.length ? pages.map((p) => p.text).join("\n") : raw);
  const majorShareholders = bestBy(nf, /주주\s*현황|주요\s*주주/, [/관계\s*회사(?!\s*와)|임원\s*현황|경영진\s*현황|사업장|거래처\s*현황|재무\s*상태|손익/], parseShareholderRows, "주요주주현황");
  const affiliates = bestBy(nf, /관계\s*회사(?!\s*와)/, [/주요\s*구매처|주요\s*판매처|구매처\s*현황|판매처\s*현황|거래처\s*현황|사업장|재무\s*상태|손익/], parseTradeBlock, "관계회사현황");
  const purchaseSuppliers = bestBy(nf, /구매처\s*현황|주요\s*구매처|매입처\s*현황/, [/판매처\s*현황|주요\s*판매처|매출처\s*현황|매출\s*구성/], parseTradeBlock, "거래처현황 구매처현황");
  const salesCustomers = bestBy(nf, /판매처\s*현황|주요\s*판매처|매출처\s*현황/, [/매출\s*구성|관계\s*회사(?!\s*와)|구매처\s*현황|사업장|재무\s*상태|손익/], parseTradeBlock, "거래처현황 판매처현황");
  // 섹션 혼선 차단: 거래처(구매/판매)가 주주 명단(지분율)을 그대로 가져온 경우 → 해당 영역 숨김(정보 없음)
  const shNames = new Set(((majorShareholders && majorShareholders._raw) || []).map((r) => bareName(r.name)).filter(Boolean));
  const dropIfShareholders = (st) => {
    if (!st || !st.rows || !st.rows.length || shNames.size < 2) return st;
    const names = st.rows.map((r) => bareName(r));
    return names.every((n) => n && shNames.has(n)) ? { source: null, empty: true, rows: [] } : st;
  };
  // 거래처현황 페이지 데이터(%) 우선, 비면 종합의견 본문 거래처명으로 폴백(공란 방지)
  const withFallback = (st, which) => {
    const c = dropIfShareholders(st);
    if (c && ((c.rows && c.rows.length) || c.noData)) return c;
    const names = tradeFromOpinion(nf, which);
    return names ? { source: "종합의견 본문(비중 미표기)", rows: names, fromOpinion: true } : c;
  };
  return { majorShareholders, affiliates, purchaseSuppliers: withFallback(purchaseSuppliers, "buy"), salesCustomers: withFallback(salesCustomers, "sell") };
}
// 발행주식수 = 주주현황의 보통주(소유주식수) 합산. '주' 단위가 없어도 인식, 지분율%는 제외.
export function extractShareCount(raw, pages) {
  const nf = norm(pages && pages.length ? pages.map((p) => p.text).join("\n") : raw);
  const sh = bestBy(nf, /주주\s*현황|주요\s*주주/, [/관계\s*회사(?!\s*와)|임원\s*현황|경영진\s*현황|사업장|거래처\s*현황|재무\s*상태|손익/], parseShareholderRows, "주요주주현황");
  const raws = sh._raw || [];
  const sum = raws.reduce((a, r) => a + (r.shares || 0), 0);
  const holders = raws.filter((r) => r.shares).length;
  const count = (sh.total && sh.total >= sum * 0.9) ? sh.total : (sum > 0 ? sum : null);   // 합계 행 우선(개별합과 큰 차이 없을 때)
  return (count && holders >= 1) ? { count, holders, source: "크레탑 주요주주현황 자동 추출" } : { count: null };
}
// 6p: 연혁/사업목적
export function extractCompanyExtras(raw, pages) {
  return {
    history: grabAny(raw, pages, [6], /(?:회\s*사\s*)?연\s*혁/, { maxLines: 30, maxChars: 1600 }),
    bizPurpose: grabAny(raw, pages, [6], /^\s*(?:[■▶※·◦\-]\s*)?사\s*업\s*(?:의\s*)?목\s*적(?!\s*(?:변경|추가|정정|삭제|변동))/, { maxLines: 16 }),
    opinion: grabAny(raw, pages, [7], /종\s*합\s*의\s*견|평\s*가\s*의\s*견/, { stop: OPINION_STOP, maxLines: 60, maxChars: 2200 }),
  };
}
// 7p: 대표자 인적사항/주요경력/학력/자격
export function extractCeoDetail(raw, pages) {
  return {
    personal: grabAny(raw, pages, [7], /인\s*적\s*사\s*항/, { maxLines: 14 }),
    career: grabAny(raw, pages, [7], /주\s*요\s*경\s*력\s*사항|주\s*요\s*경\s*력|경\s*력\s*사\s*항/, { maxLines: 16 }),
    education: grabAny(raw, pages, [7], /(?:^|\s)학\s*력|출\s*신\s*학\s*교/, { maxLines: 4 }),
    license: grabAny(raw, pages, [7], /보\s*유\s*자\s*격|자\s*격\s*증|(?:^|\s)자\s*격/, { maxLines: 4 }),
  };
}
// 9p: 사업장 현황/세부현황
export function extractWorkplace(raw, pages) {
  return {
    basic: grabAny(raw, pages, [9], /사\s*업\s*장\s*현\s*황(?!\s*세부)|사\s*업\s*장\s*정\s*보/, { maxLines: 16 }),
    detail: grabAny(raw, pages, [9], /사\s*업\s*장\s*세\s*부\s*현\s*황|세\s*부\s*현\s*황/, { maxLines: 30, maxChars: 1600 }),
  };
}
// 발행주식수/액면가(best-effort)
export function extractShares(raw) {
  const t = String(raw || "").replace(/\s+/g, " ");
  let m = t.match(/(?:발행\s*주식\s*(?:총)?수|총\s*발행\s*주식\s*수|주식\s*수|발행주식)[^0-9]{0,6}([0-9][0-9,]{1,})\s*주?/);
  let shares = m ? parseInt(m[1].replace(/,/g, ""), 10) : null;
  let pm = t.match(/(?:1\s*주당\s*)?액면\s*가(?:액)?[^0-9]{0,6}([0-9][0-9,]{1,})\s*원?/);
  let par = pm ? parseInt(pm[1].replace(/,/g, ""), 10) : null;
  return { shares: (shares && shares > 0 && shares < 1e12) ? shares : null, parValue: (par && par > 0 && par <= 100000) ? par : null };
}

// ── 개인사업자 감지 ──
export function detectBizForm(ui) {
  const co = (ui && ui.companyInfo) || {};
  const corpType = String(co.corpType || "").trim();
  const corpReg = String(co.corpRegNo || "").trim();
  const isPersonalType = /개인\s*사업자|개인\s*기업/.test(corpType);
  const dashReg = corpReg === "-" || corpReg === "－";
  const emptyReg = corpReg === "";
  const looksCorp = /주식회사|유한|합자|합명|법인/.test(corpType) || /\(주\)|주식회사|㈜/.test(String(co.companyName || ""));
  const reasons = [];
  if (isPersonalType) reasons.push("기업유형: 개인사업자");
  if (dashReg) reasons.push('법인등기정보: "-" (법인번호 없음)');
  const isPersonal = isPersonalType || dashReg;                  // 확정 개인사업자 → 차단/OFF
  const possible = !isPersonal && emptyReg && !!co.businessNo && !looksCorp; // 가능성 → 경고만
  if (possible) reasons.push("법인번호 미확인 + 사업자번호 존재 → 개인사업자 가능성");
  return { isPersonal, possible, corpType: corpType || null, reasons };
}

// ── 법인전용 컨설팅(개인사업자에서 OFF) — 전략명 정확 매칭 ──
export const CORP_ONLY_NAMES = new Set([
  "가수금 정리", "가지급금 정리", "미처분이익잉여금", "이익소각", "배당정책 정비",
  "임원 퇴직금 재원", "정관 정비", "주주구성 점검", "가업승계", "상속·증여 설계",
  "벤처투자유형",   // 개인사업자에서는 법인 전환 후 검토(전략에 personalNote로 안내 문구)
]);
export function isCorpOnlyStrategy(name) { return CORP_ONLY_NAMES.has(name); }

// ── 전체 추출 + 추출 디버그(관리자용) ──
export function extractAll(raw, pages) {
  const stakeholders = extractStakeholders(raw, pages);
  const companyExtras = extractCompanyExtras(raw, pages);
  const ceoDetail = extractCeoDetail(raw, pages);
  const workplace = extractWorkplace(raw, pages);
  const sh = extractShares(raw);
  const sc = extractShareCount(raw, pages);   // 주주현황 보통주 합산(우선)
  const sharesDefault = (sc && sc.count) ? sc.count : sh.shares;
  const sharesSource = (sc && sc.count) ? `${sc.source} (${sc.holders}명 합산)` : (sh.shares ? "원문 발행주식수" : null);
  const preview = (v) => v ? String(v).replace(/\s+/g, " ").slice(0, 300) : null;
  const stakePrev = (st) => st ? (st.noData ? "조회된 자료가 없습니다." : (st.rows || []).join(" / ")) : null;
  const stakeOk = (st) => !!(st && (st.noData || (st.rows && st.rows.length)));
  const debug = {
    hasPages: !!(pages && pages.length), pageCount: pages ? pages.length : 0,
    sections: [
      { key: "stake", label: "page 4/8/10 이해관계자·거래처", ok: stakeOk(stakeholders.purchaseSuppliers) || stakeOk(stakeholders.salesCustomers) || stakeOk(stakeholders.majorShareholders), preview: preview(stakePrev(stakeholders.purchaseSuppliers) || stakePrev(stakeholders.salesCustomers) || stakePrev(stakeholders.majorShareholders)) },
      { key: "hist", label: "page 6 연혁/사업목적", ok: !!(companyExtras.history || companyExtras.bizPurpose), preview: preview(companyExtras.history || companyExtras.bizPurpose) },
      { key: "opinion", label: "page 7 종합의견", ok: !!companyExtras.opinion, preview: preview(companyExtras.opinion) },
      { key: "ceo", label: "page 7 대표자 상세", ok: !!(ceoDetail.personal || ceoDetail.career), preview: preview(ceoDetail.personal || ceoDetail.career) },
      { key: "work", label: "page 9 사업장 현황", ok: !!(workplace.basic || workplace.detail), preview: preview(workplace.detail || workplace.basic) },
    ],
  };
  return { stakeholders, companyExtras, ceoDetail, workplace, shares: sharesDefault, sharesSource, parValue: sh.parValue, _extractDebug: debug };
}
