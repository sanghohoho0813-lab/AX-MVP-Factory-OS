/**
 * 연구소 도면 편집기 — 원본 기업부설연구소 OS(ccs-post-management) components/FloorPlanner.tsx 를 그대로 옮긴 것 (D-92).
 * 사무실 전체(파란)·연구소 공간(빨강)을 그리고 책상·실험테이블·출입문·현판을 배치해 JPG·인쇄로 낸다.
 * 바꾼 것: import 경로와 export 방식뿐. 그리는 규칙·축척(1m=32px)·항목 14종은 원본 그대로다.
 */
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { downloadSvgAsJpeg, printSvg } from "../lib/download";

/* ═══════════════════ 상수/타입 ═══════════════════ */

// 고정 축척: 1m = 32px (숫자 입력 ↔ 도면 드래그 동기화)
const S = 32;
const VW = 780;
const VH = 540;
const OX = 78;
const OY = 84;
const OFFICE_MIN = 1;
const OFFICE_MAX_REAL = 999; // 실제 입력 m 상한 (화면 표시와 무관)
// 화면 표시용 고정 사무실 박스 — 실제 m 값과 무관하게 캔버스를 꽉 채운다(여백 ~28px)
const OFFICE_DISP = { x: OX, y: OY, w: VW - OX - 28, h: VH - OY - 64 };


type ItemType =
  | "연구원 책상" | "실험테이블" | "PC" | "연구기자재"
  | "사무책상" | "회의실" | "휴게실" | "창고"
  | "주출입문" | "보조출입문" | "현판"
  | "텍스트" | "사각형" | "원형";

const ITEM_TYPES: ItemType[] = [
  "연구원 책상", "실험테이블", "PC", "연구기자재",
  "사무책상", "회의실", "휴게실", "창고",
  "주출입문", "보조출입문", "현판",
  "텍스트", "사각형", "원형",
];

const ITEM_SPEC: Record<ItemType, { w: number; h: number; min: number }> = {
  "연구원 책상": { w: 42, h: 22, min: 16 },
  실험테이블: { w: 52, h: 24, min: 16 },
  PC: { w: 26, h: 18, min: 10 },
  연구기자재: { w: 32, h: 22, min: 12 },
  사무책상: { w: 44, h: 22, min: 16 },
  회의실: { w: 86, h: 56, min: 30 },
  휴게실: { w: 76, h: 50, min: 30 },
  창고: { w: 66, h: 46, min: 30 },
  주출입문: { w: 8, h: 36, min: 6 },
  보조출입문: { w: 6, h: 30, min: 5 },
  현판: { w: 12, h: 12, min: 8 },
  텍스트: { w: 70, h: 20, min: 16 },
  사각형: { w: 72, h: 48, min: 16 },
  원형: { w: 52, h: 52, min: 16 },
};

const LAB_TYPES: ItemType[] = ["연구원 책상", "실험테이블", "PC", "연구기자재"];

// 추가 시 기본 라벨 (텍스트/도형은 사용자가 직접 입력)
const DEFAULT_LABEL: Partial<Record<ItemType, string>> = {
  주출입문: "주출입구",
  보조출입문: "보조출입구",
  텍스트: "텍스트",
  사각형: "구역",
  원형: "구역",
};

interface PlanItem {
  id: string;
  type: ItemType;
  label: string;
  memo: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Pt {
  x: number;
  y: number;
}

/** 펜/지우개 자유선 — 원본 도면 위에 벽·선을 그리거나(펜) 일부를 흰색으로 가린다(지우개) */
interface PenStroke {
  id: string;
  points: Pt[];
  color: string;
  width: number;
  eraser: boolean;
}

/** 히스토리에 저장되는 도면 문서 (UI 상태는 제외) */
interface Doc {
  officeW: number;
  officeH: number;
  officePoly: Pt[] | null;
  lab: { x: number; y: number; wM: number; hM: number };
  labPoly: Pt[] | null;
  items: PlanItem[];
  /** 펜/지우개 자유선 레이어 */
  strokes: PenStroke[];
  /** 전체(파란) 공간 숨김 — 삭제/빈 도면/원본 불러오기 시 true */
  hideOffice?: boolean;
  /** 연구소(빨강) 공간 숨김 */
  hideLab?: boolean;
}

type Sel = null | { k: "item"; id: string } | { k: "office" } | { k: "lab" };

type DragKind =
  | { k: "item"; id: string }
  | { k: "item-resize"; id: string; edge: "e" | "s" | "br" }
  | { k: "lab-move"; dx: number; dy: number }
  | { k: "lab-resize"; edge: "e" | "s" | "w" | "n" | "br" }
  | { k: "lab-scale" }
  | { k: "office-resize"; edge: "e" | "s" | "br" }
  | { k: "office-move"; dx: number; dy: number }
  | { k: "office-scale" }
  | { k: "poly-vertex"; target: "office" | "lab"; idx: number }
  | { k: "bg-move"; dx: number; dy: number }
  | { k: "bg-resize"; x0: number; w: number };

let seq = 0;
const uid = () => `it-${Date.now().toString(36)}-${++seq}`;

const LAB_DEFAULT = { x: OX + 40, y: OY + 40, wM: 5, hM: 4 };

function initialDoc(): Doc {
  return { officeW: 12, officeH: 8, officePoly: null, lab: { ...LAB_DEFAULT }, labPoly: null, items: defaultItems(), strokes: [], hideOffice: false, hideLab: false };
}

/** 빈 도면 — 샘플 요소 없이 시작 (전체/연구소 공간·요소 모두 비움) */
function emptyDoc(): Doc {
  return { officeW: 12, officeH: 8, officePoly: null, lab: { ...LAB_DEFAULT }, labPoly: null, items: [], strokes: [], hideOffice: true, hideLab: true };
}

/* ═══════════════════ 메인 ═══════════════════ */

export function FloorPlanner({ company }: { company: string }) {
  /* 단일 문서 상태 + 동기 ref (히스토리/드래그 정확도용) */
  const [doc, setDocState] = useState<Doc>(() => initialDoc());
  const docRef = useRef<Doc>(doc);
  const setDoc = useCallback((next: Doc) => {
    docRef.current = next;
    setDocState(next);
  }, []);

  /* 히스토리 스택 */
  const histRef = useRef<Doc[]>([cloneDoc(doc)]);
  const idxRef = useRef(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const syncHist = useCallback(() => {
    setCanUndo(idxRef.current > 0);
    setCanRedo(idxRef.current < histRef.current.length - 1);
  }, []);

  /** 새 상태를 히스토리에 적재 (이산 변경 — 추가/삭제/형태변경/라벨 등) */
  const commit = useCallback((next: Doc) => {
    histRef.current = histRef.current.slice(0, idxRef.current + 1);
    histRef.current.push(cloneDoc(next));
    if (histRef.current.length > 80) histRef.current.shift();
    idxRef.current = histRef.current.length - 1;
    syncHist();
  }, [syncHist]);

  /** 변경 + 히스토리 적재 한 번에 */
  const applyChange = useCallback((producer: (d: Doc) => Doc) => {
    const next = producer(docRef.current);
    setDoc(next);
    commit(next);
  }, [setDoc, commit]);

  const undo = useCallback(() => {
    if (idxRef.current <= 0) return;
    idxRef.current -= 1;
    setDoc(cloneDoc(histRef.current[idxRef.current]));
    syncHist();
  }, [setDoc, syncHist]);

  const redo = useCallback(() => {
    if (idxRef.current >= histRef.current.length - 1) return;
    idxRef.current += 1;
    setDoc(cloneDoc(histRef.current[idxRef.current]));
    syncHist();
  }, [setDoc, syncHist]);

  /* UI 상태 (히스토리 제외) */
  const [exporting, setExporting] = useState(false);
  const [sel, setSel] = useState<Sel>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [drawing, setDrawing] = useState<null | { target: "office" | "lab"; pts: Pt[] }>(null);
  const [labLabel, setLabLabel] = useState("연구소 전용공간");
  // 펜/지우개 도구 (원본 위에 자유선 그리기 / 흰색으로 가리기)
  const [tool, setTool] = useState<"select" | "pen" | "eraser">("select");
  const [penColor, setPenColor] = useState("#0f172a");
  const [penWidth, setPenWidth] = useState(3);
  const [penPts, setPenPts] = useState<Pt[]>([]);
  const penningRef = useRef<Pt[] | null>(null);

  /* 배경(원본 도면) — 히스토리 제외 */
  const [bg, setBg] = useState<null | { url: string; w: number; h: number }>(null);
  const [bgOpacity, setBgOpacity] = useState(0.5);
  const [bgScale, setBgScale] = useState(1);
  const [bgPos, setBgPos] = useState({ x: OX, y: OY });
  const [bgVisible, setBgVisible] = useState(true);
  const [bgInExport, setBgInExport] = useState(false);
  const [bgMoveMode, setBgMoveMode] = useState(false);
  const [bgNotice, setBgNotice] = useState<string | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragKind | null>(null);
  const pendingRef = useRef<Pt | null>(null);
  const rafRef = useRef(0);

  /* 파생 박스/면적 */
  const oBox = officeBox(doc);
  const lBox = labBox(doc);
  // 실제 치수(입력값) ↔ 화면 표시 크기 분리:
  //  · 전체면적은 입력한 실제 m(officeW·officeH) 기준
  //  · 연구소 면적/비율은 "화면상 점유 비율 × 전체 실제 면적"으로 환산
  const officeArea = doc.officePoly ? polyArea(doc.officePoly) / (S * S) : doc.officeW * doc.officeH;
  const dispFrac = oBox.w * oBox.h > 0 ? (lBox.w * lBox.h) / (oBox.w * oBox.h) : 0;
  const labArea = officeArea * dispFrac;
  const ratio = Math.round(dispFrac * 100);
  const approxO = doc.officePoly ? "약 " : "";
  const approxL = doc.officePoly || doc.labPoly ? "약 " : "";
  // 치수선·라벨에 표시할 실제 m (표시 크기와 무관)
  const officeRealW = doc.officePoly ? round1(oBox.w / S) : doc.officeW;
  const officeRealH = doc.officePoly ? round1(oBox.h / S) : doc.officeH;
  const labRealW = round1(officeRealW * (oBox.w ? lBox.w / oBox.w : 0));
  const labRealH = round1(officeRealH * (oBox.h ? lBox.h / oBox.h : 0));

  // 출력(내보내기) 중에만 편집 표시를 숨긴다 — 평소에는 항상 편집 모드
  const editMode = !exporting;
  const printMode = exporting;
  const showBg = bg && bgVisible && (!printMode || bgInExport);

  /** 편집 표시를 숨긴 깨끗한 도면으로 JPEG/PDF 내보내기 */
  const exportPlan = useCallback((kind: "jpeg" | "pdf") => {
    setSel(null);
    setEditingId(null);
    setDrawing(null);
    setExporting(true);
    setTimeout(() => {
      if (kind === "jpeg") downloadSvgAsJpeg(svgRef.current, `${company || "연구소"}_도면.jpg`);
      else printSvg(svgRef.current, `${company || "연구소"} 도면`);
      setExporting(false);
    }, 80);
  }, [company]);

  /* ── 좌표 변환 ── */
  const svgPoint = useCallback((e: { clientX: number; clientY: number }): Pt => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }, []);

  /* ── rAF 드래그 (커밋은 종료 시) ── */
  const applyDrag = useCallback(() => {
    rafRef.current = 0;
    const p = pendingRef.current;
    const d = dragRef.current;
    if (!p || !d) return;
    if (d.k === "bg-move") {
      setBgPos({ x: p.x - d.dx, y: p.y - d.dy });
      return;
    }
    if (d.k === "bg-resize") {
      setBgScale(clamp(round1((p.x - d.x0) / d.w), 0.1, 8));
      return;
    }
    setDoc(produceDrag(docRef.current, d, p));
  }, [setDoc]);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      pendingRef.current = svgPoint(e);
      if (!rafRef.current) rafRef.current = requestAnimationFrame(applyDrag);
    },
    [svgPoint, applyDrag],
  );

  const endDrag = useCallback(() => {
    const d = dragRef.current;
    if (d) {
      // 진행 중 rAF가 남아 있으면 즉시 반영 (docRef를 최신으로)
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
        const p = pendingRef.current;
        if (p && d.k !== "bg-move" && d.k !== "bg-resize") setDoc(produceDrag(docRef.current, d, p));
      }
      // 드래그 종료 시점에만, 실제 변동이 있으면 히스토리 적재 (배경 조작은 히스토리 제외)
      if (d.k !== "bg-move" && d.k !== "bg-resize") {
        const base = histRef.current[idxRef.current];
        if (JSON.stringify(base) !== JSON.stringify(docRef.current)) commit(docRef.current);
      }
    }
    dragRef.current = null;
    pendingRef.current = null;
  }, [setDoc, commit]);

  /* ── 직접 그리기 ── */
  function startDraw(target: "office" | "lab") {
    setDrawing({ target, pts: [] });
    setSel(null);
    setEditingId(null);
  }
  function onSvgClick(e: React.MouseEvent) {
    if (!drawing) return;
    const p = svgPoint(e);
    if (drawing.pts.length >= 3 && dist(p, drawing.pts[0]) < 14) {
      finishDraw();
      return;
    }
    setDrawing((d) => (d ? { ...d, pts: [...d.pts, p] } : d));
  }
  function finishDraw() {
    if (!drawing) return;
    const pts = simplifyPoly(drawing.pts);
    if (pts.length >= 3) {
      const target = drawing.target;
      applyChange((d) => (target === "office" ? { ...d, officePoly: pts } : { ...d, labPoly: pts }));
      setSel({ k: target === "office" ? "office" : "lab" });
    }
    setDrawing(null);
  }
  function undoLastPoint() {
    setDrawing((d) => (d && d.pts.length ? { ...d, pts: d.pts.slice(0, -1) } : d));
  }

  function revertOffice() {
    applyChange((d) => ({ ...d, officePoly: null }));
  }
  function revertLab() {
    applyChange((d) => ({ ...d, labPoly: null }));
  }
  function removeVertex(target: "office" | "lab", idx: number) {
    applyChange((d) => {
      const pts = target === "office" ? d.officePoly : d.labPoly;
      if (!pts || pts.length <= 3) return d;
      const np = pts.filter((_, i) => i !== idx);
      return target === "office" ? { ...d, officePoly: np } : { ...d, labPoly: np };
    });
  }

  /* ── 펜/지우개 자유선 ── */
  function startPen(e: React.PointerEvent) {
    const p = svgPoint(e);
    penningRef.current = [p];
    setPenPts([p]);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }
  function movePen(e: React.PointerEvent) {
    if (!penningRef.current) return;
    penningRef.current.push(svgPoint(e));
    setPenPts(penningRef.current.slice());
  }
  function finishPen() {
    const pts = penningRef.current;
    penningRef.current = null;
    setPenPts([]);
    if (!pts || pts.length < 2) return;
    const stroke: PenStroke = {
      id: uid(),
      points: pts,
      color: tool === "eraser" ? "#ffffff" : penColor,
      width: tool === "eraser" ? penWidth * 4 : penWidth,
      eraser: tool === "eraser",
    };
    applyChange((d) => ({ ...d, strokes: [...(d.strokes ?? []), stroke] }));
  }
  function clearStrokes() {
    applyChange((d) => ({ ...d, strokes: [] }));
  }

  /* ── 배경 업로드 ── */
  function onBgFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.type === "application/pdf") {
      setBgNotice("PDF는 캡처 이미지(PNG/JPG)로 업로드하면 더 정확합니다. PDF 미리보기는 추후 업데이트 예정입니다.");
      return;
    }
    setBgNotice(null);
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      const img = new Image();
      img.onload = () => {
        const scale0 = Math.min((VW - 120) / img.naturalWidth, (VH - 140) / img.naturalHeight, 1);
        setBg({ url, w: img.naturalWidth, h: img.naturalHeight });
        setBgScale(round1(scale0) || 1);
        setBgPos({ x: OX, y: OY });
        setBgVisible(true);
        // 원본 도면을 불러오면 기본 샘플 도형(파란 전체공간·빨간 연구소·책상/문/라벨)을 자동 제거해
        // 원본과 겹치지 않게 한다. 원본 위에 공간·요소를 새로 그리면 된다.
        applyChange(() => emptyDoc());
        setSel(null); setEditingId(null); setDrawing(null);
        setBgNotice("원본 도면을 불러왔습니다. 겹침 방지를 위해 기본 샘플 도형을 비웠습니다 — 아래에서 ‘전체 공간/연구소 공간 표시’ 또는 ‘직접 그리기’로 원본 위에 새로 배치하세요.");
      };
      img.src = url;
    };
    reader.readAsDataURL(f);
  }

  /* ── 아이템 ── */
  function addItem(t: ItemType) {
    const d = docRef.current;
    const ob = officeBox(d);
    const lb = labBox(d);
    const spec = ITEM_SPEC[t];
    const n = d.items.filter((i) => i.type === t).length;
    const base = LAB_TYPES.includes(t)
      ? { x: clamp(lb.x + 14 + (n % 3) * (spec.w + 10), ob.x + 4, ob.x + ob.w - spec.w - 4), y: clamp(lb.y + 24 + Math.floor(n / 3) * (spec.h + 10), ob.y + 4, ob.y + ob.h - spec.h - 4) }
      : { x: clamp(ob.x + 16 + (n % 3) * (spec.w + 14), ob.x + 4, ob.x + ob.w - spec.w - 4), y: clamp(ob.y + 16 + Math.floor(n / 3) * (spec.h + 16), ob.y + 4, ob.y + ob.h - spec.h - 4) };
    const label = DEFAULT_LABEL[t] ?? `${t}${n + 1}`;
    const it: PlanItem = { id: uid(), type: t, label, memo: "", x: base.x, y: base.y, w: spec.w, h: spec.h };
    applyChange((dd) => ({ ...dd, items: [...dd.items, it] }));
    setSel({ k: "item", id: it.id });
  }
  function removeLast(t: ItemType) {
    const arr = docRef.current.items;
    const ridx = [...arr].reverse().findIndex((i) => i.type === t);
    if (ridx < 0) return;
    const real = arr.length - 1 - ridx;
    if (sel?.k === "item" && sel.id === arr[real].id) setSel(null);
    applyChange((d) => ({ ...d, items: d.items.filter((_, i) => i !== real) }));
  }

  /** 선택 요소 삭제 (요소→제거, 전체/연구소 공간→도면에서 제거(숨김)) */
  function deleteSelection() {
    if (!sel) return;
    if (sel.k === "item") {
      applyChange((d) => ({ ...d, items: d.items.filter((i) => i.id !== sel.id) }));
    } else if (sel.k === "office") {
      applyChange((d) => ({ ...d, hideOffice: true, officePoly: null }));
    } else if (sel.k === "lab") {
      applyChange((d) => ({ ...d, hideLab: true, labPoly: null }));
    }
    setSel(null);
  }

  /** 빈 도면으로 시작 — 모든 샘플 요소 제거 (편집 요소만 초기화) */
  function startBlank() {
    if (!confirm("빈 도면으로 시작할까요? 현재 도면의 모든 요소(전체 공간·연구소 공간·책상·문 등)가 제거됩니다.\n(저장된 고객 데이터는 영향받지 않습니다)")) return;
    applyChange(() => emptyDoc());
    setSel(null); setEditingId(null); setDrawing(null);
  }
  /** 기본 샘플 도면 불러오기 (선택) */
  function loadSamples() {
    if (!confirm("기본 샘플 도면을 불러올까요? 현재 편집 중인 도면 요소가 샘플로 대체됩니다.")) return;
    applyChange(() => initialDoc());
    setSel(null); setEditingId(null); setDrawing(null);
  }
  /** 숨긴 전체/연구소 공간 다시 표시 */
  function showOffice() { applyChange((d) => ({ ...d, hideOffice: false })); setSel({ k: "office" }); }
  function showLab() { applyChange((d) => ({ ...d, hideLab: false })); setSel({ k: "lab" }); }

  const selItem = sel?.k === "item" ? doc.items.find((i) => i.id === sel.id) ?? null : null;

  /* 인라인 라벨 편집 */
  function beginEdit(id: string, initial?: string) {
    const it = docRef.current.items.find((i) => i.id === id);
    if (!it) return;
    setSel({ k: "item", id });
    setEditingId(id);
    setEditText(initial !== undefined ? initial : it.label);
  }
  function commitEdit() {
    if (editingId && editText.trim()) {
      const id = editingId;
      const text = editText.trim();
      applyChange((d) => ({ ...d, items: d.items.map((i) => (i.id === id ? { ...i, label: text } : i)) }));
    }
    setEditingId(null);
  }

  /* 키보드: 글자입력→라벨편집 / Delete·Backspace→삭제 / 그리기 중 마지막 점 취소 */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (editingId) return;
      // 직접 그리기 중
      if (drawing) {
        if (e.key === "Backspace" || e.key === "Delete") { e.preventDefault(); undoLastPoint(); }
        else if (e.key === "Escape") setDrawing(null);
        return;
      }
      // 삭제
      if ((e.key === "Delete" || e.key === "Backspace") && sel && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        deleteSelection();
        return;
      }
      // 선택된 요소 글자 입력 → 라벨 편집
      if (sel?.k === "item" && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        beginEdit(sel.id, e.key);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, editingId, drawing]);

  /* 키보드: 되돌리기/다시실행 */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        if (drawing) undoLastPoint();
        else undo();
      } else if ((k === "z" && e.shiftKey) || k === "y") {
        e.preventDefault();
        redo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, drawing]);

  /* ── 드래그 시작 핸들러 ── */
  const startDrag = useCallback((e: React.PointerEvent, kind: DragKind) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = kind;
  }, []);

  const onItemDown = useCallback(
    (e: React.PointerEvent, id: string) => {
      if (drawing || tool !== "select") return; // 펜/지우개 모드면 자유선으로 넘김
      setSel({ k: "item", id });
      e.stopPropagation();
      (e.target as Element).setPointerCapture?.(e.pointerId);
      dragRef.current = { k: "item", id };
    },
    [drawing, tool],
  );
  const onItemDbl = useCallback((id: string) => beginEdit(id), []); // eslint-disable-line react-hooks/exhaustive-deps

  const countOf = (t: ItemType) => doc.items.filter((i) => i.type === t).length;
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, ".");

  const editingItem = doc.items.find((i) => i.id === editingId);
  const selOffice = sel?.k === "office";
  const selLab = sel?.k === "lab";

  return (
    <div className="space-y-4">
      {/* 단계 헤더 — 도면 편집 (출력은 도면 아래에 이어짐) */}
      <div className="flex items-center gap-2 rounded-xl border border-navy-700 bg-navy-700 px-3 py-2.5 text-white shadow-sm">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-base font-bold text-navy-700">1</span>
        <span>
          <span className="block text-base font-bold">도면 편집</span>
          <span className="block text-xs text-navy-100">공간·요소를 편집하면, 바로 아래에서 JPEG/PDF로 저장할 수 있습니다</span>
        </span>
      </div>

      {/* 편집 도구 막대 */}
      {editMode ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <button type="button" onClick={undo} disabled={!canUndo} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40">↶ 되돌리기</button>
          <button type="button" onClick={redo} disabled={!canRedo} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40">↷ 다시 실행</button>
          <button type="button" onClick={deleteSelection} disabled={!sel} className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-bold text-status-danger hover:bg-red-50 disabled:opacity-40">🗑 선택 삭제</button>
          <span className="hidden text-xs text-slate-400 @2xl:inline">Ctrl+Z 되돌리기 · Ctrl+Shift+Z 다시실행 · Delete 삭제</span>
          <button type="button" onClick={startBlank} className="ml-auto rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-bold text-slate-600 hover:bg-slate-100">빈 도면으로 시작</button>
          <button type="button" onClick={loadSamples} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-bold text-slate-600 hover:bg-slate-100">기본 샘플 불러오기</button>
        </div>
      ) : null}

      {/* ── 그리기(펜/지우개) 도구 — 원본 위에 직접 그리기·가리기 ── */}
      {editMode ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
          <span className="text-sm font-bold text-slate-600">그리기:</span>
          <button type="button" onClick={() => setTool("select")} className={`rounded-lg border px-3 py-1.5 text-sm font-bold ${tool === "select" ? "border-navy-600 bg-navy-700 text-white" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"}`}>🖱 선택/이동</button>
          <button type="button" onClick={() => { setDrawing(null); setSel(null); setTool(tool === "pen" ? "select" : "pen"); }} className={`rounded-lg border px-3 py-1.5 text-sm font-bold ${tool === "pen" ? "border-navy-600 bg-navy-700 text-white" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"}`}>✏️ 펜(벽·선)</button>
          <button type="button" onClick={() => { setDrawing(null); setSel(null); setTool(tool === "eraser" ? "select" : "eraser"); }} className={`rounded-lg border px-3 py-1.5 text-sm font-bold ${tool === "eraser" ? "border-amber-500 bg-amber-500 text-white" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"}`}>🩹 지우개(가리기)</button>
          {tool !== "select" ? (
            <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-600">굵기
              <input type="range" min={2} max={10} step={1} value={penWidth} onChange={(e) => setPenWidth(Number(e.target.value))} />
              <span className="w-5 text-xs text-slate-500">{penWidth}</span>
            </label>
          ) : null}
          {tool === "pen" ? (
            <span className="flex items-center gap-1">
              {["#0f172a", "#dc2626", "#2563eb"].map((c) => (
                <button key={c} type="button" onClick={() => setPenColor(c)} aria-label={c}
                  className={`h-6 w-6 rounded-full border-2 ${penColor === c ? "border-slate-800" : "border-white shadow"}`} style={{ background: c }} />
              ))}
            </span>
          ) : null}
          {tool !== "select" ? <span className="text-xs text-slate-400">원본 도면 위를 드래그해 그리세요 · Ctrl+Z 되돌리기</span> : null}
          <button type="button" onClick={clearStrokes} disabled={!(doc.strokes?.length)} className="ml-auto rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-bold text-status-danger hover:bg-red-50 disabled:opacity-40">그린 선 전체 삭제</button>
        </div>
      ) : null}

      {/* ── 편집 컨트롤 ── */}
      {editMode ? (
        <div className="space-y-3">
          {/* 원본 도면 불러오기 (항상 표시) */}
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-base font-bold text-navy-700">원본 도면 불러오기 (선택)</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">
              기존 손도면·이미지(PNG/JPG)를 배경으로 깔 수 있습니다. <b>이미지 픽셀 자체는 편집되지 않지만</b>, 그 위에 ‘직접 그리기’로 벽·공간을 따라 그리고 책상·문·라벨을 올려 새 도면으로 만들 수 있습니다.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <input type="file" accept="image/png,image/jpeg,application/pdf" onChange={onBgFile}
                className="min-w-0 max-w-full text-base text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-navy-50 file:px-4 file:py-2 file:text-base file:font-bold file:text-navy-700" />
              {bg ? (
                <>
                  <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-600">투명도<input type="range" min={0.1} max={1} step={0.1} value={bgOpacity} onChange={(e) => setBgOpacity(Number(e.target.value))} /></label>
                  <label className="flex items-center gap-1.5 text-sm font-semibold text-slate-600">크기<input type="range" min={0.2} max={5} step={0.1} value={bgScale} onChange={(e) => setBgScale(Number(e.target.value))} /></label>
                  <button type="button" onClick={() => setBgMoveMode((v) => !v)} className={`rounded-lg border px-3 py-1.5 text-sm font-bold ${bgMoveMode ? "border-navy-600 bg-navy-50 text-navy-700" : "border-slate-200 text-slate-600"}`}>{bgMoveMode ? "배경 이동 중(끄기)" : "배경 이동/크기"}</button>
                  <button type="button" onClick={() => setBgVisible((v) => !v)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-bold text-slate-600">{bgVisible ? "배경 숨기기" : "배경 보이기"}</button>
                  <button type="button" onClick={() => setBg(null)} className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-bold text-status-danger">원본 제거</button>
                </>
              ) : null}
            </div>
            {bg ? (
              <p className="mt-2 rounded-lg bg-navy-50 px-3 py-2 text-sm font-semibold text-navy-700">
                원본 위에 도면 만들기: <b>① ‘연구소/사무실 직접 그리기’</b>로 외곽을 따라 그림 → <b>② 책상·문·텍스트 추가</b> → 배경은 ‘크기/이동’ 또는 캔버스의 <b>◢ 모서리 핸들</b>로 맞춤.
              </p>
            ) : null}
            {bgNotice ? <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">{bgNotice}</p> : null}
          </div>

          {/* 공간 형태·라벨 (숫자 크기 입력은 도면 바로 아래 바에서) */}
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-base font-bold text-navy-700">① 공간 형태·라벨</p>
            <p className="mt-1 text-sm text-slate-500">크기(m)는 <b>도면 바로 아래 입력칸</b>에서 조정합니다. 모서리·변 핸들 드래그로도 크기를 바꿀 수 있고, 사각형이 아니면 “직접 그리기”로 외곽선을 만들 수 있습니다.</p>
            {/* 전용공간 라벨 전환 (연구소 / 전담부서 / 직접입력) — 출력물에도 반영 */}
            <div className="mt-4 rounded-xl border-2 border-red-200 bg-red-50/40 p-3.5">
              <p className="text-base font-bold text-red-800">전용공간 라벨 <span className="ml-1 text-sm font-semibold text-red-700/70">— 도면·출력물에 표시되는 명칭</span></p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => setLabLabel("연구소 전용공간")}
                  className={`rounded-xl border-2 px-5 py-2.5 text-base font-bold ${labLabel === "연구소 전용공간" ? "border-red-500 bg-red-600 text-white shadow-sm" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"}`}>연구소 전용공간</button>
                <button type="button" onClick={() => setLabLabel("연구전담부서 전용공간")}
                  className={`rounded-xl border-2 px-5 py-2.5 text-base font-bold ${labLabel === "연구전담부서 전용공간" ? "border-red-500 bg-red-600 text-white shadow-sm" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"}`}>연구전담부서 전용공간</button>
                <input value={labLabel} onChange={(e) => setLabLabel(e.target.value)}
                  className="min-w-[180px] flex-1 rounded-xl border-2 border-slate-300 bg-white px-4 py-2.5 text-base font-semibold focus:border-red-500 focus:outline-none" placeholder="직접 입력" />
              </div>
              <p className="mt-1.5 text-sm text-red-700/70">현재 표시: <b>{labLabel}</b></p>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => startDraw("office")} className="whitespace-nowrap rounded-lg border border-navy-300 bg-navy-50 px-4 py-2 text-base font-bold text-navy-700 hover:bg-navy-100">✏️ 사무실 직접 그리기</button>
              <button type="button" onClick={() => startDraw("lab")} className="whitespace-nowrap rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-base font-bold text-red-700 hover:bg-red-100">✏️ 연구소 직접 그리기</button>
              <p className="rounded-lg bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800">전체 {doc.hideOffice ? "—" : `${approxO}${officeArea.toFixed(1)}㎡`} · 연구소 {doc.hideLab ? "—" : `${approxL}${labArea.toFixed(1)}㎡`}{!doc.hideOffice && !doc.hideLab ? ` (${ratio}%)` : ""}</p>
            </div>
            {drawing ? (
              <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 px-3 py-2">
                <p className="text-sm font-bold text-amber-800">도면 위를 클릭해 {drawing.target === "office" ? "사무실" : "연구소"} 외곽 점을 찍으세요 ({drawing.pts.length}개) — 시작점 재클릭 또는 [완료]로 닫힘</p>
                <button type="button" onClick={undoLastPoint} disabled={!drawing.pts.length} className="rounded-lg border border-amber-300 px-3 py-1.5 text-sm font-bold text-amber-700 disabled:opacity-40">마지막 점 취소</button>
                <button type="button" onClick={finishDraw} disabled={drawing.pts.length < 3} className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-bold text-white disabled:opacity-40">완료</button>
                <button type="button" onClick={() => setDrawing(null)} className="rounded-lg border border-amber-300 px-3 py-1.5 text-sm font-bold text-amber-700">취소</button>
              </div>
            ) : null}
            {labArea > 0 && labArea < 3 ? <p className="mt-2 text-sm font-semibold text-status-danger">⚠ 연구소 면적이 매우 작습니다 — 상시 근무 가능 면적인지 확인하세요</p> : null}
            {ratio > 70 ? <p className="mt-2 text-sm font-semibold text-amber-700">⚠ 연구소 비율이 매우 높습니다 — 일반 업무공간 구획을 확인하세요</p> : null}
          </div>

          {/* 요소 추가 */}
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-base font-bold text-navy-700">② 책상·장비·실 추가</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">+ 로 추가 → 드래그로 이동 → 모서리 핸들로 크기조정 → <b>더블클릭(또는 선택 후 글자 입력)으로 이름 수정</b> · Delete로 삭제</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 @2xl:grid-cols-5">
              {ITEM_TYPES.map((t) => {
                const isText = t === "텍스트";
                return (
                  <div key={t} className={`rounded-xl border px-2.5 py-2 ${isText ? "border-violet-300 bg-violet-50" : "border-slate-200 bg-white"}`}>
                    <div className="flex items-center justify-between gap-1">
                      <span className={`min-w-0 break-keep text-sm font-bold ${isText ? "text-violet-700" : "text-slate-600"}`}>
                        {isText ? "✏️ 직접 텍스트 입력" : t}
                      </span>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => removeLast(t)} className="h-8 w-8 rounded-lg bg-slate-100 text-lg font-bold text-slate-600 hover:bg-slate-200">−</button>
                        <button type="button" onClick={() => addItem(t)} className={`h-8 w-8 rounded-lg text-lg font-bold text-white ${isText ? "bg-violet-600 hover:bg-violet-700" : "bg-navy-700 hover:bg-navy-800"}`}>+</button>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">{isText ? "원하는 위치에 글자 배치" : `${countOf(t)}개 배치됨`}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {/* ── 도면 SVG (스크롤 없이 컨테이너에 맞춰 표시) ── */}
      <div className="overflow-hidden rounded-xl border border-slate-100 bg-slate-50/60 p-3">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VW} ${VH}`}
          className="w-full touch-none select-none rounded-lg bg-white ring-1 ring-slate-200"
          onPointerMove={(e) => { if (penningRef.current) { movePen(e); return; } onPointerMove(e); }}
          onPointerUp={() => { if (penningRef.current) { finishPen(); return; } endDrag(); }}
          onPointerLeave={() => { if (penningRef.current) { finishPen(); return; } endDrag(); }}
          onClick={onSvgClick}
          onPointerDown={(e) => {
            if (drawing) return;
            // 펜/지우개 모드: 어디서 시작해도 자유선 그리기
            if ((tool === "pen" || tool === "eraser") && editMode) { startPen(e); return; }
            if (bgMoveMode && bg && editMode) {
              const p = svgPoint(e);
              dragRef.current = { k: "bg-move", dx: p.x - bgPos.x, dy: p.y - bgPos.y };
              return;
            }
            // 빈 영역 클릭 → 선택 해제
            if (e.target === svgRef.current) setSel(null);
          }}
          style={{ cursor: drawing || tool !== "select" ? "crosshair" : bgMoveMode && editMode ? "move" : "default", display: "block", width: "100%", height: "auto" }}
        >
          <defs>
            <marker id="fpArrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#475569" /></marker>
            <marker id="fpArrowR" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#dc2626" /></marker>
          </defs>

          {/* 배경 클릭 해제용 투명 영역 */}
          <rect x="0" y="0" width={VW} height={VH} fill="transparent" onPointerDown={() => { if (!drawing) setSel(null); }} />

          {/* 배경 원본 도면 */}
          {showBg ? <image href={bg!.url} x={bgPos.x} y={bgPos.y} width={bg!.w * bgScale} height={bg!.h * bgScale} opacity={bgOpacity} preserveAspectRatio="xMidYMid meet" /> : null}
          {/* 배경 크기 조절 핸들 (우하단 모서리 드래그) */}
          {showBg && bg && editMode && !drawing ? (
            <Handle x={bgPos.x + bg.w * bgScale} y={bgPos.y + bg.h * bgScale} cursor="nwse-resize" onDown={(e) => startDrag(e, { k: "bg-resize", x0: bgPos.x, w: bg.w })} />
          ) : null}

          {/* 헤더 */}
          <text x={OX} y="22" fontSize="15" fontWeight="bold" fill="#0f172a">{company} — 층 전체 도면 초안</text>
          <text x={OX} y="40" fontSize="11" fill="#64748b">연구소 내부 상세도면 초안 포함 · 작성일 {today}</text>
          {!printMode ? (
            <>
              <text x={VW - 12} y="22" fontSize="10" fill="#94a3b8" textAnchor="end">본 도면은 신고 준비용 초안입니다</text>
              <text x={VW - 12} y="36" fontSize="10" fill="#94a3b8" textAnchor="end">실제 제출 전 현장 치수 확인 필요</text>
            </>
          ) : null}

          {/* 사무실(전체 공간) — 숨김 시 미표시 */}
          {!doc.hideOffice ? (
            <>
              {doc.officePoly ? (
                <polygon
                  points={polyStr(doc.officePoly)}
                  fill="#fafafa" fillOpacity={showBg ? 0.55 : 1}
                  stroke={selOffice && !printMode ? "#2563eb" : "#334e76"} strokeWidth={selOffice && !printMode ? 3.5 : 2.5}
                  style={{ cursor: editMode && !drawing ? "move" : "default" }}
                  onPointerDown={(e) => {
                    if (drawing || printMode || tool !== "select") return;
                    setSel({ k: "office" });
                    const p = svgPoint(e);
                    const b = bbox(doc.officePoly!);
                    startDrag(e, { k: "office-move", dx: p.x - b.x, dy: p.y - b.y });
                  }}
                />
              ) : (
                <rect
                  x={oBox.x} y={oBox.y} width={oBox.w} height={oBox.h}
                  fill="#fafafa" fillOpacity={showBg ? 0.55 : 1}
                  stroke={selOffice && !printMode ? "#2563eb" : "#334e76"} strokeWidth={selOffice && !printMode ? 3.5 : 2.5}
                  style={{ cursor: editMode && !drawing ? "pointer" : "default" }}
                  onPointerDown={(e) => { if (drawing || printMode || tool !== "select") return; e.stopPropagation(); setSel({ k: "office" }); }}
                />
              )}
              <DimH x1={oBox.x} x2={oBox.x + oBox.w} y={oBox.y - 18} label={`${approxO}${officeRealW}m`} />
              <DimV y1={oBox.y} y2={oBox.y + oBox.h} x={oBox.x - 18} label={`${approxO}${officeRealH}m`} />
              {!doc.officePoly ? (
                <>
                  <rect x={oBox.x - 3} y={oBox.y + oBox.h / 2 - 18} width="6" height="36" fill="#fff" stroke="#334e76" strokeWidth="2" pointerEvents="none" />
                  <text x={oBox.x + 8} y={oBox.y + oBox.h / 2 + 42} fontSize="10" fill="#64748b" pointerEvents="none">주출입구</text>
                </>
              ) : null}
            </>
          ) : null}

          {/* 연구소 전용공간 — 숨김 시 미표시 */}
          {!doc.hideLab ? (
            <>
              <g
                onPointerDown={(e) => {
                  if (drawing || printMode || tool !== "select") return;
                  setSel({ k: "lab" });
                  const p = svgPoint(e);
                  startDrag(e, { k: "lab-move", dx: p.x - lBox.x, dy: p.y - lBox.y });
                }}
                style={{ cursor: !printMode && !drawing ? "move" : "default" }}
              >
                {doc.labPoly ? (
                  <polygon points={polyStr(doc.labPoly)} fill="#fee2e2" fillOpacity={0.55} stroke="#dc2626" strokeWidth={selLab && !printMode ? 4 : 3} />
                ) : (
                  <rect x={lBox.x} y={lBox.y} width={lBox.w} height={lBox.h} fill="#fee2e2" fillOpacity={0.55} stroke="#dc2626" strokeWidth={selLab && !printMode ? 4 : 3} />
                )}
                <text x={lBox.x + lBox.w / 2} y={lBox.y + 16} fontSize="12" fontWeight="bold" fill="#dc2626" textAnchor="middle">{labLabel}</text>
                <text x={lBox.x + lBox.w / 2} y={lBox.y + lBox.h - 8} fontSize="11" fontWeight="bold" fill="#b91c1c" textAnchor="middle">전용면적: {approxL}{labArea.toFixed(1)}㎡</text>
              </g>
              <DimH x1={lBox.x} x2={lBox.x + lBox.w} y={lBox.y + lBox.h + 14} label={`${approxL}${labRealW}m`} red />
              <DimV y1={lBox.y} y2={lBox.y + lBox.h} x={lBox.x + lBox.w + 12} label={`${approxL}${labRealH}m`} red />
            </>
          ) : null}

          {/* 아이템 */}
          {doc.items.map((it) => (
            <ItemG key={it.id} it={it} selected={!printMode && sel?.k === "item" && sel.id === it.id} draggable={editMode} onDown={onItemDown} onDbl={onItemDbl} />
          ))}

          {/* 펜/지우개 자유선 (원본 위에 그린 선·가림) */}
          {(doc.strokes ?? []).map((s) => (
            <polyline key={s.id} points={polyStr(s.points)} fill="none" stroke={s.color} strokeWidth={s.width} strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />
          ))}
          {penPts.length > 1 ? (
            <polyline points={polyStr(penPts)} fill="none" stroke={tool === "eraser" ? "#ffffff" : penColor} strokeWidth={tool === "eraser" ? penWidth * 4 : penWidth} strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />
          ) : null}

          {/* 선택 핸들 */}
          {editMode && !drawing && selItem && !editingId ? (
            <>
              <Handle x={selItem.x + selItem.w} y={selItem.y + selItem.h} cursor="nwse-resize" onDown={(e) => startDrag(e, { k: "item-resize", id: selItem.id, edge: "br" })} />
              <Handle x={selItem.x + selItem.w} y={selItem.y + selItem.h / 2} cursor="ew-resize" onDown={(e) => startDrag(e, { k: "item-resize", id: selItem.id, edge: "e" })} />
              <Handle x={selItem.x + selItem.w / 2} y={selItem.y + selItem.h} cursor="ns-resize" onDown={(e) => startDrag(e, { k: "item-resize", id: selItem.id, edge: "s" })} />
            </>
          ) : null}

          {/* 사각형 사무실은 화면 고정(크기조정 핸들 없음) — 직접 그린 다각형만 꼭짓점/스케일 핸들 표시 */}
          {editMode && !drawing && selOffice && !doc.hideOffice && doc.officePoly ? (
            <>
              {doc.officePoly.map((pt, i) => (
                <PolyHandle key={`ov-${i}`} x={pt.x} y={pt.y} onDown={(e) => startDrag(e, { k: "poly-vertex", target: "office", idx: i })} onDbl={() => removeVertex("office", i)} />
              ))}
              <Handle x={bbox(doc.officePoly).x + bbox(doc.officePoly).w} y={bbox(doc.officePoly).y + bbox(doc.officePoly).h} cursor="nwse-resize" onDown={(e) => startDrag(e, { k: "office-scale" })} />
            </>
          ) : null}

          {editMode && !drawing && selLab && !doc.hideLab ? (
            doc.labPoly ? (
              <>
                {doc.labPoly.map((pt, i) => (
                  <PolyHandle key={`lv-${i}`} red x={pt.x} y={pt.y} onDown={(e) => startDrag(e, { k: "poly-vertex", target: "lab", idx: i })} onDbl={() => removeVertex("lab", i)} />
                ))}
                <Handle red x={bbox(doc.labPoly).x + bbox(doc.labPoly).w} y={bbox(doc.labPoly).y + bbox(doc.labPoly).h} cursor="nwse-resize" onDown={(e) => startDrag(e, { k: "lab-scale" })} />
              </>
            ) : (
              <>
                <Handle x={lBox.x + lBox.w} y={lBox.y + lBox.h} red cursor="nwse-resize" onDown={(e) => startDrag(e, { k: "lab-resize", edge: "br" })} />
                <Handle x={lBox.x + lBox.w} y={lBox.y + lBox.h / 2} red cursor="ew-resize" onDown={(e) => startDrag(e, { k: "lab-resize", edge: "e" })} />
                <Handle x={lBox.x + lBox.w / 2} y={lBox.y + lBox.h} red cursor="ns-resize" onDown={(e) => startDrag(e, { k: "lab-resize", edge: "s" })} />
                <Handle x={lBox.x} y={lBox.y + lBox.h / 2} red cursor="ew-resize" onDown={(e) => startDrag(e, { k: "lab-resize", edge: "w" })} />
                <Handle x={lBox.x + lBox.w / 2} y={lBox.y} red cursor="ns-resize" onDown={(e) => startDrag(e, { k: "lab-resize", edge: "n" })} />
              </>
            )
          ) : null}

          {/* 직접 그리기 진행 표시 */}
          {drawing && drawing.pts.length ? (
            <g pointerEvents="none">
              <polyline points={polyStr(drawing.pts)} fill="none" stroke={drawing.target === "lab" ? "#dc2626" : "#334e76"} strokeWidth="2" strokeDasharray="6 4" />
              {drawing.pts.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={i === 0 ? 7 : 4} fill={i === 0 ? "#fff" : drawing.target === "lab" ? "#dc2626" : "#334e76"} stroke={drawing.target === "lab" ? "#dc2626" : "#334e76"} strokeWidth="2" />
              ))}
            </g>
          ) : null}

          {/* 인라인 라벨 편집 */}
          {editingItem ? (
            <foreignObject x={editingItem.x - 10} y={editingItem.y + editingItem.h + 4} width={Math.max(editingItem.w + 40, 150)} height="34">
              <input autoFocus value={editText} onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditingId(null); }}
                onBlur={commitEdit}
                className="w-full rounded border-2 border-navy-600 bg-white px-2 py-1 text-sm font-bold text-slate-800 outline-none" />
            </foreignObject>
          ) : null}

          {/* 면적 요약 + 범례 */}
          <text x={OX} y={VH - 26} fontSize="12" fontWeight="bold" fill="#334155">{doc.hideOffice ? "" : `전체면적: ${approxO}${officeArea.toFixed(1)}㎡`}{!doc.hideLab ? `${doc.hideOffice ? "" : " / "}${labLabel.replace(" 전용공간", "")} 전용면적: ${approxL}${labArea.toFixed(1)}㎡` : ""}{!doc.hideOffice && !doc.hideLab ? ` / 연구공간 비율: ${ratio}%` : ""}</text>
          {!printMode ? (
            <text x={OX} y={VH - 10} fontSize="10" fill="#94a3b8">🔴 {labLabel} · 점선: 회의실/휴게실/창고 · 클릭: 선택 / 더블클릭: 이름 수정</text>
          ) : null}
        </svg>
      </div>

      {/* ── 공간 크기 입력 (도면 바로 아래) ── */}
      {editMode ? (
        <div className="rounded-xl border-2 border-navy-200 bg-navy-50/40 p-4">
          <p className="text-base font-bold text-navy-800">공간 크기 (m) — 면적·치수 계산용</p>
          <p className="mt-0.5 text-sm text-slate-500">전체 가로/세로 m을 바꿔도 <b>도면 표시 크기는 고정</b>되고, 면적·치수·비율만 갱신됩니다.</p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {doc.hideOffice ? (
              <div className="col-span-2"><button type="button" onClick={showOffice} className="w-full rounded-lg border border-navy-300 bg-navy-50 px-3 py-2.5 text-base font-bold text-navy-700 hover:bg-navy-100">＋ 전체 공간 표시</button></div>
            ) : doc.officePoly ? (
              <div className="col-span-2 flex items-end gap-2"><p className="flex-1 rounded-lg bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-600">전체 공간: 직접 그린 형태</p><button type="button" onClick={revertOffice} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-600">사각형으로</button></div>
            ) : (
              <>
                <Num label="전체 가로(m)" value={doc.officeW} onChange={(v) => applyChange((d) => ({ ...d, officeW: clamp(v, OFFICE_MIN, OFFICE_MAX_REAL) }))} />
                <Num label="전체 세로(m)" value={doc.officeH} onChange={(v) => applyChange((d) => ({ ...d, officeH: clamp(v, OFFICE_MIN, OFFICE_MAX_REAL) }))} />
              </>
            )}
            {doc.hideLab ? (
              <div className="col-span-2"><button type="button" onClick={showLab} className="w-full rounded-lg border border-red-300 bg-red-50 px-3 py-2.5 text-base font-bold text-red-700 hover:bg-red-100">＋ 연구소 공간 표시</button></div>
            ) : doc.labPoly ? (
              <div className="col-span-2 flex items-end gap-2"><p className="flex-1 rounded-lg bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700">연구소: 직접 그린 형태</p><button type="button" onClick={revertLab} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-600">사각형으로</button></div>
            ) : (
              <div className="col-span-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700">연구소(빨강) 전용공간은 <b>도면에서 드래그·모서리 핸들</b>로 크기/위치를 조정하세요. (전용면적·비율은 아래에 자동 반영)</div>
            )}
          </div>
          <p className="mt-2 rounded-lg bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800">
            면적 자동 계산 — 전체 {doc.hideOffice ? "—" : `${approxO}${officeArea.toFixed(1)}㎡`} · 연구소 {doc.hideLab ? "—" : `${approxL}${labArea.toFixed(1)}㎡`}{!doc.hideOffice && !doc.hideLab ? ` (연구공간 비율 ${ratio}%)` : ""}
          </p>
        </div>
      ) : null}

      {/* ── 선택 요소 편집 패널 ── */}
      {selItem && editMode ? (
        <div className="rounded-xl border-2 border-navy-200 bg-navy-50/50 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[180px] flex-1">
              <label className="text-sm font-bold text-slate-600">선택: {selItem.type} · {Math.round(selItem.w)}×{Math.round(selItem.h)}px</label>
              <input value={selItem.label} onChange={(e) => { const v = e.target.value; applyChange((d) => ({ ...d, items: d.items.map((i) => (i.id === selItem.id ? { ...i, label: v } : i)) })); }}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-base font-semibold focus:border-navy-600 focus:outline-none" placeholder="표시 이름 (예: 3D프린터)" />
            </div>
            <div className="min-w-[180px] flex-1">
              <label className="text-sm font-bold text-slate-600">메모</label>
              <input value={selItem.memo} onChange={(e) => { const v = e.target.value; applyChange((d) => ({ ...d, items: d.items.map((i) => (i.id === selItem.id ? { ...i, memo: v } : i)) })); }}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-base focus:border-navy-600 focus:outline-none" placeholder="내부 메모 (도면 미표시)" />
            </div>
            <button type="button" onClick={deleteSelection} className="whitespace-nowrap rounded-lg border border-red-200 px-4 py-2.5 text-base font-bold text-status-danger hover:bg-red-50">선택 삭제</button>
          </div>
        </div>
      ) : null}
      {(selOffice || selLab) && editMode ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          선택: <b>{selOffice ? "사무실 공간" : labLabel}</b> — {(selOffice ? doc.officePoly : doc.labPoly) ? "꼭짓점(○) 드래그로 모양 수정 · 우하단 핸들로 크기조정 · 전체 드래그 이동 · Delete로 사각형 복원" : "모서리 핸들로 크기조정 · Delete로 기본값 복원"}
        </div>
      ) : null}

      {/* ── 출력 미리보기 / 저장 (도면 바로 아래) ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-navy-200 bg-navy-50/50 p-4">
        <div>
          <p className="text-base font-bold text-navy-800">② 출력 미리보기 / 저장</p>
          <p className="mt-0.5 text-sm leading-relaxed text-slate-500">위 도면이 그대로 저장됩니다 (편집용 표시는 자동 제외) · 실제 제출 전 현장 치수 확인 필요</p>
          {bg ? (
            <label className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-600">
              <input type="checkbox" checked={bgInExport} onChange={(e) => setBgInExport(e.target.checked)} className="h-4 w-4 accent-navy-700" />
              출력에 배경 도면 포함 (제출용은 배경 숨김 권장)
            </label>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => exportPlan("jpeg")} className="whitespace-nowrap rounded-xl bg-navy-700 px-5 py-3 text-base font-bold text-white hover:bg-navy-800">JPEG 다운로드</button>
          <button type="button" onClick={() => exportPlan("pdf")} className="whitespace-nowrap rounded-xl border border-navy-200 bg-white px-5 py-3 text-base font-bold text-navy-700 hover:bg-navy-50">PDF 저장 (인쇄)</button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════ 드래그 produce (순수함수) ═══════════════════ */

function produceDrag(d: Doc, drag: DragKind, p: Pt): Doc {
  const ob = officeBox(d);
  const bx1 = ob.x + 4, by1 = ob.y + 4, bx2 = ob.x + ob.w - 4, by2 = ob.y + ob.h - 4;

  switch (drag.k) {
    case "item":
      return { ...d, items: d.items.map((it) => it.id !== drag.id ? it : { ...it, x: clamp(p.x - it.w / 2, bx1, Math.max(bx1, bx2 - it.w)), y: clamp(p.y - it.h / 2, by1, Math.max(by1, by2 - it.h)) }) };
    case "item-resize":
      return { ...d, items: d.items.map((it) => {
        if (it.id !== drag.id) return it;
        const min = ITEM_SPEC[it.type].min;
        let w = it.w, h = it.h;
        if (drag.edge === "e" || drag.edge === "br") w = clamp(p.x - it.x, min, bx2 - it.x);
        if (drag.edge === "s" || drag.edge === "br") h = clamp(p.y - it.y, min, by2 - it.y);
        return { ...it, w: Math.round(w), h: Math.round(h) };
      }) };
    case "lab-move": {
      const lb = labBox(d);
      if (d.labPoly) {
        const nx = clamp(p.x - drag.dx, bx1, bx2 - lb.w);
        const ny = clamp(p.y - drag.dy, by1, by2 - lb.h);
        const ddx = nx - lb.x, ddy = ny - lb.y;
        return ddx || ddy ? { ...d, labPoly: d.labPoly.map((q) => ({ x: q.x + ddx, y: q.y + ddy })) } : d;
      }
      return { ...d, lab: { ...d.lab, x: clamp(p.x - drag.dx, bx1, bx2 - d.lab.wM * S), y: clamp(p.y - drag.dy, by1, by2 - d.lab.hM * S) } };
    }
    case "lab-resize": {
      if (d.labPoly) return d;
      const lb = labBox(d);
      let { wM, hM } = d.lab;
      let x = lb.x, y = lb.y;
      const maxW = (bx2 - x) / S, maxH = (by2 - y) / S;
      if (drag.edge === "e" || drag.edge === "br") wM = clamp(round1((p.x - x) / S), 1.5, maxW);
      if (drag.edge === "s" || drag.edge === "br") hM = clamp(round1((p.y - y) / S), 1.5, maxH);
      if (drag.edge === "w") { const r = x + wM * S; const nx = clamp(p.x, bx1, r - 1.5 * S); wM = round1((r - nx) / S); x = r - wM * S; }
      if (drag.edge === "n") { const b = y + hM * S; const ny = clamp(p.y, by1, b - 1.5 * S); hM = round1((b - ny) / S); y = b - hM * S; }
      return { ...d, lab: { x, y, wM, hM } };
    }
    case "lab-scale": {
      if (!d.labPoly) return d;
      const b = bbox(d.labPoly);
      const nw = clamp(p.x - b.x, 1.5 * S, bx2 - b.x);
      const nh = clamp(p.y - b.y, 1.5 * S, by2 - b.y);
      const sx = nw / (b.w || 1), sy = nh / (b.h || 1);
      return { ...d, labPoly: d.labPoly.map((q) => ({ x: round1(b.x + (q.x - b.x) * sx), y: round1(b.y + (q.y - b.y) * sy) })) };
    }
    case "office-resize": {
      // 사각형 사무실은 화면 고정 — 크기조정 드래그 없음(no-op)
      return d;
    }
    case "office-move": {
      if (!d.officePoly) return d;
      const b = bbox(d.officePoly);
      const nx = clamp(p.x - drag.dx, 8, VW - b.w - 8);
      const ny = clamp(p.y - drag.dy, 48, VH - b.h - 36);
      const ddx = nx - b.x, ddy = ny - b.y;
      return ddx || ddy ? clampItems({ ...d, officePoly: d.officePoly.map((q) => ({ x: q.x + ddx, y: q.y + ddy })) }) : d;
    }
    case "office-scale": {
      if (!d.officePoly) return d;
      const b = bbox(d.officePoly);
      const nw = clamp(p.x - b.x, OFFICE_MIN * S, VW - b.x - 8);
      const nh = clamp(p.y - b.y, OFFICE_MIN * S, VH - b.y - 36);
      const sx = nw / (b.w || 1), sy = nh / (b.h || 1);
      return clampItems({ ...d, officePoly: d.officePoly.map((q) => ({ x: round1(b.x + (q.x - b.x) * sx), y: round1(b.y + (q.y - b.y) * sy) })) });
    }
    case "poly-vertex": {
      const nx = clamp(p.x, 8, VW - 8);
      const ny = clamp(p.y, 48, VH - 36);
      if (drag.target === "office") return d.officePoly ? clampItems({ ...d, officePoly: d.officePoly.map((q, i) => (i === drag.idx ? { x: nx, y: ny } : q)) }) : d;
      return d.labPoly ? { ...d, labPoly: d.labPoly.map((q, i) => (i === drag.idx ? { x: nx, y: ny } : q)) } : d;
    }
    default:
      return d;
  }
}

/* ═══════════════════ 보조 ═══════════════════ */

function cloneDoc(d: Doc): Doc {
  return {
    officeW: d.officeW, officeH: d.officeH,
    officePoly: d.officePoly ? d.officePoly.map((p) => ({ ...p })) : null,
    lab: { ...d.lab },
    labPoly: d.labPoly ? d.labPoly.map((p) => ({ ...p })) : null,
    items: d.items.map((it) => ({ ...it })),
    strokes: (d.strokes ?? []).map((s) => ({ ...s, points: s.points.map((p) => ({ ...p })) })),
    hideOffice: d.hideOffice ?? false,
    hideLab: d.hideLab ?? false,
  };
}
function officeBox(d: Doc) {
  // 사각형 사무실은 실제 m와 무관하게 화면 고정 박스로 표시(스크롤 없이 꽉 차게)
  return d.officePoly ? bbox(d.officePoly) : { ...OFFICE_DISP };
}
function labBox(d: Doc) {
  const ob = officeBox(d);
  return d.labPoly
    ? bbox(d.labPoly)
    : { x: clamp(d.lab.x, ob.x + 2, ob.x + ob.w - d.lab.wM * S - 2), y: clamp(d.lab.y, ob.y + 2, ob.y + ob.h - d.lab.hM * S - 2), w: d.lab.wM * S, h: d.lab.hM * S };
}
function clampItems(d: Doc): Doc {
  const ob = officeBox(d);
  return {
    ...d,
    items: d.items.map((it) => {
      const nx = clamp(it.x, ob.x + 4, Math.max(ob.x + 4, ob.x + ob.w - it.w - 4));
      const ny = clamp(it.y, ob.y + 4, Math.max(ob.y + 4, ob.y + ob.h - it.h - 4));
      return nx === it.x && ny === it.y ? it : { ...it, x: nx, y: ny };
    }),
  };
}
function clamp(v: number, a: number, b: number) { return Math.max(a, Math.min(b, v)); }
function round1(v: number) { return Math.round(v * 10) / 10; }
function dist(a: Pt, b: Pt) { return Math.hypot(a.x - b.x, a.y - b.y); }
function polyStr(pts: Pt[]) { return pts.map((p) => `${p.x},${p.y}`).join(" "); }
function bbox(pts: Pt[]) {
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}
function polyArea(pts: Pt[]) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; s += a.x * b.y - b.x * a.y; }
  return Math.abs(s) / 2;
}
function simplifyPoly(raw: Pt[]): Pt[] {
  const merged: Pt[] = [];
  for (const p of raw) if (!merged.length || dist(merged[merged.length - 1], p) > 12) merged.push({ ...p });
  if (merged.length > 2 && dist(merged[0], merged[merged.length - 1]) < 16) merged.pop();
  for (let i = 1; i < merged.length; i++) {
    const dx = Math.abs(merged[i].x - merged[i - 1].x), dy = Math.abs(merged[i].y - merged[i - 1].y);
    if (dx < dy * 0.3) merged[i].x = merged[i - 1].x;
    else if (dy < dx * 0.3) merged[i].y = merged[i - 1].y;
  }
  if (merged.length >= 3) {
    const a = merged[merged.length - 1], b = merged[0];
    const dx = Math.abs(b.x - a.x), dy = Math.abs(b.y - a.y);
    if (dx < dy * 0.3) a.x = b.x; else if (dy < dx * 0.3) a.y = b.y;
  }
  return merged.map((p) => ({ x: Math.round(p.x / 2) * 2, y: Math.round(p.y / 2) * 2 }));
}
function defaultItems(): PlanItem[] {
  const mk = (type: ItemType, n: number, x: number, y: number): PlanItem => ({ id: uid(), type, label: `${type}${n}`, memo: "", x, y, w: ITEM_SPEC[type].w, h: ITEM_SPEC[type].h });
  const lx0 = LAB_DEFAULT.x, ly0 = LAB_DEFAULT.y;
  return [
    mk("연구원 책상", 1, lx0 + 14, ly0 + 28), mk("연구원 책상", 2, lx0 + 66, ly0 + 28),
    mk("실험테이블", 1, lx0 + 14, ly0 + 64), mk("PC", 1, lx0 + 76, ly0 + 66),
    mk("연구기자재", 1, lx0 + 112, ly0 + 28), mk("연구기자재", 2, lx0 + 112, ly0 + 62),
    mk("사무책상", 1, OX + OFFICE_DISP.w - 120, OY + 18), mk("사무책상", 2, OX + OFFICE_DISP.w - 64, OY + 18),
    mk("사무책상", 3, OX + OFFICE_DISP.w - 120, OY + 54), mk("사무책상", 4, OX + OFFICE_DISP.w - 64, OY + 54),
    mk("회의실", 1, OX + 14, OY + OFFICE_DISP.h - 70), mk("현판", 1, lx0 - 22, ly0 + 40),
  ];
}

/* 치수선 */
function DimH({ x1, x2, y, label, red }: { x1: number; x2: number; y: number; label: string; red?: boolean }) {
  const c = red ? "#dc2626" : "#475569", m = red ? "url(#fpArrowR)" : "url(#fpArrow)";
  return (
    <g pointerEvents="none">
      <line x1={x1} y1={y} x2={x2} y2={y} stroke={c} strokeWidth="1.2" markerStart={m} markerEnd={m} />
      <rect x={(x1 + x2) / 2 - 24} y={y - 9} width="48" height="16" fill="#fff" />
      <text x={(x1 + x2) / 2} y={y + 4} fontSize="12" fontWeight="bold" fill={c} textAnchor="middle">{label}</text>
    </g>
  );
}
function DimV({ y1, y2, x, label, red }: { y1: number; y2: number; x: number; label: string; red?: boolean }) {
  const c = red ? "#dc2626" : "#475569", m = red ? "url(#fpArrowR)" : "url(#fpArrow)";
  return (
    <g pointerEvents="none">
      <line x1={x} y1={y1} x2={x} y2={y2} stroke={c} strokeWidth="1.2" markerStart={m} markerEnd={m} />
      <rect x={x - 17} y={(y1 + y2) / 2 - 9} width="34" height="16" fill="#fff" />
      <text x={x} y={(y1 + y2) / 2 + 4} fontSize="12" fontWeight="bold" fill={c} textAnchor="middle">{label}</text>
    </g>
  );
}
function Handle({ x, y, red, cursor, onDown }: { x: number; y: number; red?: boolean; cursor: string; onDown: (e: React.PointerEvent) => void }) {
  return <rect x={x - 6} y={y - 6} width="12" height="12" rx="3" fill="#fff" stroke={red ? "#dc2626" : "#334e76"} strokeWidth="2" style={{ cursor }} onPointerDown={onDown} />;
}
function PolyHandle({ x, y, red, onDown, onDbl }: { x: number; y: number; red?: boolean; onDown: (e: React.PointerEvent) => void; onDbl: () => void }) {
  return (
    <g>
      <circle cx={x} cy={y} r="14" fill="transparent" style={{ cursor: "move" }} onPointerDown={onDown} onDoubleClick={onDbl} />
      <circle cx={x} cy={y} r="6" fill="#fff" stroke={red ? "#dc2626" : "#334e76"} strokeWidth="2.5" pointerEvents="none" />
    </g>
  );
}
const ItemG = memo(function ItemG({ it, selected, draggable, onDown, onDbl }: {
  it: PlanItem; selected: boolean; draggable: boolean;
  onDown: (e: React.PointerEvent, id: string) => void; onDbl: (id: string) => void;
}) {
  const sw = selected ? 2.5 : 1.2;
  const room = it.type === "회의실" || it.type === "휴게실" || it.type === "창고";
  return (
    <g onPointerDown={(e) => onDown(e, it.id)} onDoubleClick={() => onDbl(it.id)} style={{ cursor: draggable ? "grab" : "pointer" }}>
      {selected ? <rect x={it.x - 3} y={it.y - 3} width={it.w + 6} height={it.h + 6} fill="none" stroke="#2563eb" strokeWidth="1.5" strokeDasharray="4 3" /> : null}
      {it.type === "연구기자재" ? (
        <>
          <rect x={it.x} y={it.y} width={it.w} height={it.h} rx={Math.min(11, it.h / 2)} fill="#dbeafe" stroke="#1d4ed8" strokeWidth={sw} />
          <text x={it.x + it.w / 2} y={it.y + it.h / 2 + 3} fontSize="8" fill="#1d4ed8" textAnchor="middle">{it.label}</text>
        </>
      ) : it.type === "PC" ? (
        <>
          <rect x={it.x} y={it.y} width={it.w} height={it.h} rx="3" fill="#0f172a" stroke="#334155" strokeWidth={sw} />
          <text x={it.x + it.w / 2} y={it.y + it.h / 2 + 3} fontSize="7.5" fill="#fff" textAnchor="middle">{it.label}</text>
        </>
      ) : room ? (
        <>
          <rect x={it.x} y={it.y} width={it.w} height={it.h} fill="#f1f5f9" fillOpacity={0.85} stroke="#94a3b8" strokeWidth={sw} strokeDasharray="4 3" />
          <text x={it.x + it.w / 2} y={it.y + it.h / 2 + 4} fontSize="11" fill="#475569" textAnchor="middle">{it.label}</text>
        </>
      ) : it.type === "주출입문" ? (
        <>
          <rect x={it.x} y={it.y} width={it.w} height={it.h} fill="#1d4ed8" stroke={selected ? "#1e3a8a" : "#1d4ed8"} strokeWidth={selected ? 3 : 2} />
          <text x={it.x + it.w + 3} y={it.y + it.h / 2 + 3} fontSize="9" fontWeight="bold" fill="#1d4ed8">{it.label}</text>
        </>
      ) : it.type === "보조출입문" ? (
        <>
          <rect x={it.x} y={it.y} width={it.w} height={it.h} fill="#fff" stroke="#334e76" strokeWidth={selected ? 3 : 2} />
          <text x={it.x + it.w + 3} y={it.y + it.h / 2 + 3} fontSize="9" fill="#334e76">{it.label}</text>
        </>
      ) : it.type === "현판" ? (
        <>
          <rect x={it.x} y={it.y} width={it.w} height={it.h} fill="#f59e0b" stroke={selected ? "#b45309" : "none"} strokeWidth="2" />
          <text x={it.x + it.w + 3} y={it.y + 10} fontSize="9" fill="#b45309">{it.label}</text>
        </>
      ) : it.type === "텍스트" ? (
        <>
          {selected ? <rect x={it.x} y={it.y} width={it.w} height={it.h} fill="none" stroke="#2563eb" strokeWidth="1" strokeDasharray="3 2" /> : null}
          <text x={it.x + 2} y={it.y + it.h / 2 + 5} fontSize="15" fontWeight="bold" fill="#13233b">{it.label}</text>
        </>
      ) : it.type === "사각형" ? (
        <>
          <rect x={it.x} y={it.y} width={it.w} height={it.h} rx="3" fill="#f8fafc" fillOpacity={0.6} stroke={selected ? "#2563eb" : "#64748b"} strokeWidth={selected ? 2.5 : 1.5} />
          <text x={it.x + it.w / 2} y={it.y + it.h / 2 + 4} fontSize="11" fill="#475569" textAnchor="middle">{it.label}</text>
        </>
      ) : it.type === "원형" ? (
        <>
          <ellipse cx={it.x + it.w / 2} cy={it.y + it.h / 2} rx={it.w / 2} ry={it.h / 2} fill="#f8fafc" fillOpacity={0.6} stroke={selected ? "#2563eb" : "#64748b"} strokeWidth={selected ? 2.5 : 1.5} />
          <text x={it.x + it.w / 2} y={it.y + it.h / 2 + 4} fontSize="11" fill="#475569" textAnchor="middle">{it.label}</text>
        </>
      ) : (
        <>
          <rect x={it.x} y={it.y} width={it.w} height={it.h} fill="#fff" stroke="#64748b" strokeWidth={sw} />
          <text x={it.x + it.w / 2} y={it.y + it.h / 2 + 3} fontSize="8" fill="#475569" textAnchor="middle">{it.label}</text>
        </>
      )}
    </g>
  );
});
function Num({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="whitespace-nowrap text-sm font-bold text-slate-600">{label}</label>
      <input type="number" step={0.5} min={1} value={value} onChange={(e) => onChange(Number(e.target.value) || 1)}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-base focus:border-navy-600 focus:outline-none focus:ring-1 focus:ring-navy-600" />
    </div>
  );
}
