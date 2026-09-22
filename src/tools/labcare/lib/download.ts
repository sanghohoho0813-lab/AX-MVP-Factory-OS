// 외부 라이브러리 없이 SVG를 PNG/JPEG로 저장 / 인쇄(PDF) 하는 유틸.

/** SVG → 래스터 이미지 다운로드 (mime 지정). JPEG는 흰 배경 + 여백 중앙배치. */
function downloadSvgAsRaster(
  svg: SVGSVGElement | null,
  filename: string,
  mime: "image/png" | "image/jpeg",
  scale = 2,
  padRatio = 0,
): void {
  if (!svg) return;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const vb = svg.viewBox.baseVal;
  const w = vb && vb.width ? vb.width : svg.clientWidth || 800;
  const h = vb && vb.height ? vb.height : svg.clientHeight || 500;
  clone.setAttribute("width", String(w));
  clone.setAttribute("height", String(h));
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.removeAttribute("style"); // 화면용 transform(zoom 등) 제거

  const data = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([data], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  const img = new Image();
  img.onload = () => {
    const pad = Math.round(Math.max(w, h) * padRatio);
    const canvas = document.createElement("canvas");
    canvas.width = (w + pad * 2) * scale;
    canvas.height = (h + pad * 2) * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // JPEG는 투명 미지원 → 항상 흰 배경
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, pad * scale, pad * scale, w * scale, h * scale);
    URL.revokeObjectURL(url);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
    }, mime, 0.95);
  };
  img.src = url;
}

/** 주어진 <svg> 요소를 PNG 파일로 다운로드 */
export function downloadSvgAsPng(svg: SVGSVGElement | null, filename: string, scale = 2): void {
  downloadSvgAsRaster(svg, filename, "image/png", scale, 0);
}

/** 주어진 <svg> 요소를 JPEG 파일로 다운로드 (흰 배경 + 여백 중앙배치) */
export function downloadSvgAsJpeg(svg: SVGSVGElement | null, filename: string, scale = 2): void {
  downloadSvgAsRaster(svg, filename, "image/jpeg", scale, 0.05);
}

/** 브라우저 인쇄(→ PDF 저장) */
export function printPage(): void {
  window.print();
}

/** 주어진 <svg>만 새 창에 담아 인쇄(→ PDF 저장) — 편집 UI 없이 그림만, A4 중앙 정렬 */
export function printSvg(svg: SVGSVGElement | null, title = "출력"): void {
  if (!svg) return;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const vb = svg.viewBox.baseVal;
  const w = vb && vb.width ? vb.width : svg.clientWidth || 800;
  const h = vb && vb.height ? vb.height : svg.clientHeight || 500;
  clone.setAttribute("width", String(w));
  clone.setAttribute("height", String(h));
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.removeAttribute("style");
  const data = new XMLSerializer().serializeToString(clone);
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(
    `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>` +
    `<style>` +
    `@page{margin:14mm}` +
    `html,body{margin:0;padding:0;height:100%}` +
    `body{display:flex;align-items:center;justify-content:center;min-height:100vh}` +
    `.wrap{width:100%;max-width:920px;margin:auto}` +
    `svg{width:100%;height:auto;display:block}` +
    `</style></head><body><div class="wrap">${data}</div></body></html>`,
  );
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 350);
}
