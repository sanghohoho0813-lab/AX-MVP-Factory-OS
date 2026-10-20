/**
 * D-245 명세서 점검 — ZIP · TIFF 머리 · HWPX 읽기 · 규칙 점검.
 *
 * 실제 고객 명세서는 저장소에 넣지 않는다(공개 전 특허 내용). 같은 모양의 잘못을 만든 가짜 HWPX 로 시험한다.
 * PATENT_REAL_DIR 에 실제 .hwpx 가 있으면 그것도 읽어 결과를 찍는다(이 컴퓨터에서만).
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { unzip, zipEntries, zipStore } from '../patent/zip'
import { imageInfo, dpiOf } from '../patent/tiffInfo'
import { identOf, parseHwpx, parseSectionXml, parseSpecFile, parseSpecText } from '../patent/specParse'
import { checkSpec, claimRefs, figRefs, iGa, paraNumberOf, type SpecReport } from '../patent/specCheck'

let passed = 0
let failed = 0
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) {
    passed += 1
    console.log('PASS ', name)
  } else {
    failed += 1
    console.log('FAIL ', name, detail === undefined ? '' : JSON.stringify(detail))
  }
}
const ids = (r: SpecReport) => r.findings.map((f) => f.id)
const has = (r: SpecReport, id: string) => ids(r).includes(id)
const find = (r: SpecReport, id: string) => r.findings.find((f) => f.id === id)

/* ---------------- 가짜 TIFF · HWPX 만들기 ---------------- */

function makeTiff(o: { compression?: number; strips?: number; dpi?: number; w?: number; h?: number; bits?: number; mm?: boolean }): Uint8Array {
  const { compression = 4, strips = 1, dpi = 300, w = 2008, h = 2950, bits = 1, mm = false } = o
  const tags: Array<[number, number, number, number[]]> = [
    [256, 4, 1, [w]],
    [257, 4, 1, [h]],
    [258, 3, 1, [bits]],
    [259, 3, 1, [compression]],
    [262, 3, 1, [0]],
    [273, 4, strips, Array.from({ length: strips }, (_, i) => 200 + i)],
    [282, 5, 1, [dpi, 1]],
    [283, 5, 1, [dpi, 1]],
    [296, 3, 1, [2]],
  ]
  const buf = new Uint8Array(1024)
  const dv = new DataView(buf.buffer)
  const le = !mm
  buf.set(mm ? [0x4d, 0x4d, 0, 42] : [0x49, 0x49, 42, 0])
  dv.setUint32(4, 8, le)
  dv.setUint16(8, tags.length, le)
  let extra = 8 + 2 + tags.length * 12 + 4
  tags.forEach(([tag, type, count, vals], i) => {
    const e = 10 + i * 12
    dv.setUint16(e, tag, le)
    dv.setUint16(e + 2, type, le)
    dv.setUint32(e + 4, count, le)
    if (type === 5) {
      dv.setUint32(e + 8, extra, le)
      dv.setUint32(extra, vals[0], le)
      dv.setUint32(extra + 4, vals[1], le)
      extra += 8
    } else if (type === 3 && count === 1) dv.setUint16(e + 8, vals[0], le)
    else if (count === 1) dv.setUint32(e + 8, vals[0], le)
    else {
      dv.setUint32(e + 8, extra, le)
      vals.forEach((v, k) => dv.setUint32(extra + k * 4, v, le))
      extra += vals.length * 4
    }
  })
  return buf
}

type P = string | { t: string; bold?: boolean } | { img: string } | { blank: true } | { runs: Array<{ t: string; c: string }> }
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
function sectionXml(paras: P[]): string {
  const body = paras
    .map((p) => {
      if (typeof p === 'string') return `<hp:p id="0" paraPrIDRef="1"><hp:run charPrIDRef="1"><hp:t>${esc(p)}</hp:t></hp:run><hp:linesegarray><hp:lineseg/></hp:linesegarray></hp:p>`
      if ('blank' in p) return '<hp:p id="0" paraPrIDRef="1"><hp:run charPrIDRef="1"/><hp:linesegarray><hp:lineseg/></hp:linesegarray></hp:p>'
      if ('img' in p) return `<hp:p id="0"><hp:run charPrIDRef="1"><hp:pic id="1"><hp:imgRect/><hc:img binaryItemIDRef="${p.img}" bright="0"/></hp:pic></hp:run></hp:p>`
      if ('runs' in p) return `<hp:p id="0">${p.runs.map((r) => `<hp:run charPrIDRef="${r.c}"><hp:t>${esc(r.t)}</hp:t></hp:run>`).join('')}</hp:p>`
      return `<hp:p id="0"><hp:run charPrIDRef="${p.bold ? '2' : '1'}"><hp:t>${esc(p.t)}</hp:t></hp:run></hp:p>`
    })
    .join('')
  return `<?xml version="1.0" encoding="UTF-8"?><hs:sec xmlns:hs="s" xmlns:hp="p" xmlns:hc="c">${body}</hs:sec>`
}
const HEADER = `<?xml version="1.0"?><hh:head xmlns:hh="h"><hh:charProperties>
<hh:charPr id="0" height="1000" textColor="#000000" shadeColor="none"><hh:fontRef hangul="1"/></hh:charPr>
<hh:charPr id="1" height="1199" textColor="#000000" shadeColor="none"><hh:fontRef hangul="1"/><hh:underline type="NONE" shape="SOLID" color="#000000"/><hh:strikeout shape="NONE" color="#000000"/></hh:charPr>
<hh:charPr id="2" height="1199" textColor="#000000" shadeColor="none"><hh:fontRef hangul="1"/><hh:bold/></hh:charPr>
<hh:charPr id="3" height="1199" textColor="#000000" shadeColor="none"><hh:fontRef hangul="1"/></hh:charPr>
</hh:charProperties></hh:head>`

function hwpx(paras: P[], images: Record<string, Uint8Array>): Uint8Array {
  return zipStore([
    { name: 'mimetype', data: 'application/hwp+zip' },
    { name: 'Contents/header.xml', data: HEADER },
    { name: 'Contents/section0.xml', data: sectionXml(paras) },
    ...Object.entries(images).map(([k, v]) => ({ name: `BinData/${k}.tif`, data: v })),
  ])
}

/** 잘 쓴 명세서(도면 3장 · 청구항 4개) — 모양 기준점 */
function goodParas(): P[] {
  return [
    '【발명의 설명】',
    '【발명의 명칭】',
    '공구 마모 예측 기반 교체시점 산출 시스템 및 방법{SYSTEM AND METHOD FOR ESTIMATING TOOL REPLACEMENT TIME BASED ON WEAR PREDICTION}',
    '【기술분야】',
    '[0001] 본 발명은 공구 진동정보와 마모기준을 비교하는 시스템에 관한 것이다.',
    '【발명의 배경이 되는 기술】',
    '[0002] 종래에는 정해진 주기로만 공구를 교체하였다.',
    '【발명의 내용】',
    '【해결하고자 하는 과제】',
    '[0003] 마모량을 예측하는 것을 목적으로 한다.',
    '【과제의 해결 수단】',
    '[0004] 시스템(500)은 신호 정규화부(510)와 마모판정부(530)를 포함한다.',
    '【발명의 효과】',
    '[0005] 교체 시점을 미리 알 수 있다.',
    '【도면의 간단한 설명】',
    '[0006] 도 1은 전체 구성도이다.',
    '[0007] 도 2는 처리 흐름도이다.',
    '[0008] 도 3은 교체시점 산출 구조를 나타내는 도면이다.',
    '【발명을 실시하기 위한 구체적인 내용】',
    '[0009] 도 1을 참조하면 시스템(500)은 신호 정규화부(510) 및 마모판정부(530)를 포함한다.',
    '[0010] 도 2 및 도 3에서 마모판정부(530)는 공구별 마모상태를 판정한다.',
    '【부호의 설명】',
    '500: 공구관리 시스템',
    '510: 신호 정규화부',
    '530: 마모판정부',
    '【청구범위】',
    '【청구항 1】',
    '공구의 진동신호를 복수의 측정항목으로 변환하는 신호 정규화부; 및 상기 측정항목과 마모기준을 비교하는 마모판정부;를 포함하는 시스템.',
    '【청구항 2】',
    '청구항 1에 있어서, 상기 마모판정부는 마모상태를 판정하는 것을 특징으로 하는 시스템.',
    '【청구항 3】',
    '청구항 1 또는 청구항 2에 있어서, 상기 측정항목은 측정시점을 포함하는 것을 특징으로 하는 시스템.',
    '【청구항 4】',
    '컴퓨터에 의해 진동신호를 측정항목으로 변환하는 단계; 및 상기 측정항목을 비교하는 단계;를 포함하는 방법.',
    '【요약서】',
    '【요약】',
    '본 발명은 공구 진동정보와 마모기준을 비교하여 마모량을 예측하는 시스템(500)에 관한 것이다.',
    '【대표도】',
    '도 1',
    '【도면】',
    '【도 1】',
    { img: 'image1' },
    '【도 2】',
    { img: 'image2' },
    '【도 3】',
    { img: 'image3' },
  ]
}
const goodImages = () => ({ image1: makeTiff({}), image2: makeTiff({}), image3: makeTiff({}) })

async function main() {
  /* ---------------- ZIP ---------------- */
  {
    const z = zipStore([
      { name: 'a.txt', data: '가나다 ABC' },
      { name: 'BinData/x.bin', data: new Uint8Array([1, 2, 3, 250]) },
    ])
    const entries = zipEntries(z)
    check('Z1 ZIP 목차 두 개 · 한글 이름', entries.length === 2 && entries[0].name === 'a.txt', entries)
    const files = await unzip(z)
    check('Z2 압축 안 함 꺼내기 · 글 그대로', new TextDecoder().decode(files.get('a.txt')) === '가나다 ABC')
    check('Z3 바이너리 그대로', [...(files.get('BinData/x.bin') ?? [])].join(',') === '1,2,3,250')
    const only = await unzip(z, (n) => n.startsWith('BinData/'))
    check('Z4 고른 것만 꺼냄', only.size === 1 && only.has('BinData/x.bin'))
    // deflate 로 묶인 것(실제 HWPX 처럼) — CompressionStream 으로 직접 만들어 확인
    const raw = new TextEncoder().encode('<hp:t>압축된 문단</hp:t>'.repeat(50))
    const deflated = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer())
    const z2 = zipStore([{ name: 'c.xml', data: deflated }])
    // 방법(method) 칸을 8(deflate)로 · 압축 전 크기를 고쳐 쓴다
    const dv = new DataView(z2.buffer)
    dv.setUint16(8, 8, true)
    dv.setUint32(22, raw.length, true)
    const cen = z2.length - 22 - (46 + 5)
    dv.setUint16(cen + 10, 8, true)
    dv.setUint32(cen + 24, raw.length, true)
    const inflated = await unzip(z2)
    check('Z5 deflate 풀기(브라우저 · Node 같은 DecompressionStream)', new TextDecoder().decode(inflated.get('c.xml')) === new TextDecoder().decode(raw))
    let threw = false
    try {
      zipEntries(new TextEncoder().encode('그냥 글'))
    } catch {
      threw = true
    }
    check('Z6 ZIP 아니면 알아듣는 말로 멈춤', threw)
  }

  /* ---------------- TIFF ---------------- */
  {
    const g4 = imageInfo(makeTiff({}))
    check('T1 G4 · 한 줄 · 300dpi · 1비트 · II', g4.format === 'tiff' && g4.compression === 4 && g4.strips === 1 && dpiOf(g4) === 300 && g4.bitsPerSample === 1 && g4.byteOrder === 'II', g4)
    check('T2 물리 크기(mm) — 2008×2950px @300 ≈ 170×250mm', g4.widthMm === 170 && g4.heightMm === 250, g4)
    const lzw = imageInfo(makeTiff({ compression: 5, strips: 17, w: 2480, h: 3508 }))
    check('T3 LZW · 17줄 · A4', lzw.compression === 5 && lzw.strips === 17 && lzw.widthMm === 210 && lzw.heightMm === 297, lzw)
    const mm = imageInfo(makeTiff({ mm: true }))
    check('T4 Motorola(MM) 도 읽음', mm.byteOrder === 'MM' && mm.compression === 4, mm)
    check('T5 PNG 는 PNG 로', imageInfo(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2])).format === 'png')
  }

  /* ---------------- 읽기 도우미 ---------------- */
  check('R1 【청구항 2】 → 청구항 2', identOf('【청구항 2】')?.role === 'claim' && identOf('【청구항 2】')?.num === 2)
  check('R2 [청구항 3] → 대괄호 모양', identOf('[청구항 3]')?.style === 'square')
  check('R3 **[요약]** → MD 모양', identOf('**[요약]**')?.style === 'md' && identOf('**[요약]**')?.role === 'abstract')
  check('R4 【0001】 문단 번호는 식별항목 아님', identOf('【0001】') === null)
  check('R5 [참고] 같은 모르는 대괄호는 식별항목 아님', identOf('[참고]') === null)
  check('R6 【표 1】은 본문 속(inline)', identOf('【표 1】')?.role === 'inline')
  check('R7 배경기술(옛 이름)도 같은 칸', identOf('【배경기술】')?.role === 'background')
  check('R8 문단 번호 떼기', paraNumberOf('[0073] 본문')?.num === 73 && paraNumberOf('【0002】')?.num === 2 && paraNumberOf('본문') === null)
  check('R9 도 번호 — 범위 펼침 · 온도 숫자 빼기', figRefs('도 1 내지 도 3은 … 온도 5 에서 도 5를 참조').join(',') === '1,2,3,5', figRefs('도 1 내지 도 3은 … 온도 5 에서 도 5를 참조'))
  check('R10 청구항 인용 — 또는 · 내지 · 제n항', claimRefs('청구항 1 또는 청구항 2에 있어서, …').join(',') === '1,2' && claimRefs('청구항 1 내지 청구항 3 중 어느 한 항에 있어서').join(',') === '1,2,3' && claimRefs('제2항에 있어서').join(',') === '2' && claimRefs('독립 청구항 시스템.').length === 0)
  {
    const paras = parseSectionXml('<hs:sec><hp:p><hp:run charPrIDRef="1"><hp:t>앞&amp;뒤 &lt;글&gt;</hp:t></hp:run></hp:p><hp:p><hp:run charPrIDRef="1"><hp:tbl><hp:tr><hp:tc><hp:subList><hp:p><hp:run><hp:t>표 안</hp:t></hp:run></hp:p></hp:subList></hp:tc></hp:tr></hp:tbl></hp:run></hp:p><hp:p><hp:run charPrIDRef="1"><hp:t>다음</hp:t></hp:run></hp:p></hs:sec>')
    check('R11 XML 글자(&amp; &lt;) 풀기', paras[0].text === '앞&뒤 <글>', paras[0])
    check('R12 표 안 문단은 바깥 문단 하나(표)로 — 문단 수 3', paras.length === 3 && paras[1].table && paras[1].text === '' && paras[2].text === '다음', paras)
  }

  check('R13 이/가 — 도 3이 · 도 2가 · 도 10이 · 청구범위가 · 요약이 · 따옴표 건너뜀', iGa('도 3') === '이' && iGa('도 2') === '가' && iGa('도 10') === '이' && iGa("'청구범위'") === '가' && iGa('요약') === '이' && iGa('도 1, 도 5') === '가')

  /* ---------------- 잘 쓴 명세서 ---------------- */
  {
    const doc = await parseHwpx(hwpx(goodParas(), goodImages()), '좋은.hwpx')
    const r = checkSpec(doc)
    check('G1 잘 쓴 명세서 — 고쳐야 할 것 0', r.counts.error === 0, r.findings.filter((f) => f.level !== 'info').map((f) => `${f.id}:${f.title}`))
    check('G2 주의 0', r.counts.warn === 0, r.findings.filter((f) => f.level === 'warn').map((f) => f.id))
    check('G3 요약 숫자 — 청구항 4 · 독립 2 · 종속 2 · 도 1~3 · 문단 번호 10', r.summary.claims === 4 && r.summary.independent === 2 && r.summary.dependent === 2 && r.summary.figs.join() === '1,2,3' && r.summary.paraNumbers === 10, r.summary)
    check('G4 발명의 명칭 한글 · 영문 나눔', r.summary.title.startsWith('공구 마모') && r.summary.titleEn.startsWith('SYSTEM'), r.summary)
    check('G5 그림 3장 · 대표도 도 1', r.summary.images === 3 && r.summary.repFig === '도 1', r.summary)
  }

  /* ---------------- 실제 명세서 A 와 같은 잘못(도 5 설명 빠짐 · [0073] 없음 · [청구항 n] 굵게 · LZW) ---------------- */
  {
    const p = goodParas()
    const i8 = p.indexOf('[0008] 도 3은 교체시점 산출 구조를 나타내는 도면이다.')
    p.splice(i8, 1) // 도 3 설명 문단을 통째로 지움 → 번호 0007 → 0009
    const c2 = p.indexOf('【청구항 2】')
    p[c2] = { t: '[청구항 2]', bold: true }
    const c3 = p.indexOf('【청구항 3】')
    p[c3] = { t: '[청구항 3]', bold: true }
    p[p.indexOf('도 1')] = '도 3'
    const doc = await parseHwpx(hwpx(p, { image1: makeTiff({ compression: 5, strips: 17, w: 2480, h: 3508 }), image2: makeTiff({ compression: 5, strips: 17, w: 2480, h: 3508 }), image3: makeTiff({ compression: 5, strips: 17, w: 2480, h: 3508 }) }), 'A같은.hwpx')
    const r = checkSpec(doc)
    check('A1 도면 3장인데 설명에 도 3 없음 → 고쳐야 함', find(r, 'FIG_DESC_MISSING')?.level === 'error' && /도 3/.test(find(r, 'FIG_DESC_MISSING')?.title ?? ''), find(r, 'FIG_DESC_MISSING'))
    check('A2 대표도 도 3 이 설명에 없음', has(r, 'REP_NO_DESC'), ids(r))
    check('A3 문단 번호 [0007] → [0009] 건너뜀(1개 빠짐)', find(r, 'PARA_GAP')?.level === 'error' && /0007.*0009.*1개/.test(find(r, 'PARA_GAP')?.where[0]?.label ?? ''), find(r, 'PARA_GAP'))
    check('A4 [청구항 n] 직접 친 식별항목 2개 → E-201', find(r, 'STRUCT_SQUARE')?.code === 'E-201' && /2개/.test(find(r, 'STRUCT_SQUARE')?.title ?? ''), find(r, 'STRUCT_SQUARE'))
    check('A5 굵은 식별항목 → 주의(E-261)', find(r, 'STRUCT_BOLD')?.level === 'warn', find(r, 'STRUCT_BOLD'))
    check('A6 대괄호여도 청구항으로 읽어 번호 · 인용은 맞게', !has(r, 'CLAIM_NUM') && !has(r, 'CLAIM_REF') && r.summary.claims === 4, r.summary)
    check('A7 LZW → 주의(G4 기준) · 17줄 → 주의 · A4 → 참고', find(r, 'TIFF_COMPRESSION')?.level === 'warn' && /LZW/.test(find(r, 'TIFF_COMPRESSION')?.title ?? '') && find(r, 'TIFF_STRIPS')?.level === 'warn' && find(r, 'TIFF_SIZE')?.level === 'info', ids(r))
  }

  /* ---------------- 실제 명세서 B 와 같은 모양({ 앞 띄어쓰기 · { } 다른 글자 모양 번호 · 빈 문단 · 요약 김) ---------------- */
  {
    const p = goodParas()
    const ti = p.findIndex((x) => typeof x === 'string' && x.startsWith('공구 마모'))
    p[ti] = { runs: [{ t: '공구 마모 예측 기반 시스템 및 방법 ', c: '1' }, { t: '{', c: '3' }, { t: 'SYSTEM AND METHOD', c: '1' }, { t: '}', c: '3' }] }
    p.splice(p.indexOf('【청구항 2】'), 0, { blank: true }, { blank: true })
    const ai = p.findIndex((x) => typeof x === 'string' && x.startsWith('본 발명은 공구 진동정보와'))
    p[ai] = '본 발명은 '.concat('공구 진동정보와 마모기준을 비교하여 마모량을 예측하는 시스템에 관한 것이다. '.repeat(10))
    const doc = await parseHwpx(hwpx(p, goodImages()), 'B같은.hwpx')
    const r = checkSpec(doc)
    check('B1 { 앞 띄어쓰기 → 참고만(편집기 판단)', find(r, 'TITLE_SPACE')?.level === 'info', ids(r))
    check('B2 { } 글자 모양 번호가 달라도 속성이 같으면 문제 아님', !has(r, 'TITLE_FORMAT'), find(r, 'TITLE_FORMAT'))
    check('B3 요약 400자 넘음 → 주의', find(r, 'ABSTRACT_LONG')?.level === 'warn' && r.summary.abstractChars > 400, r.summary)
    check('B4 빈 문단 → 참고', find(r, 'BLANK_PARAS')?.level === 'info' && r.summary.blankParas === 2, r.summary)
    check('B5 다른 고쳐야 할 것 없음', r.counts.error === 0, r.findings.filter((f) => f.level === 'error').map((f) => f.id))
  }

  /* ---------------- 편집기 오류 코드 하나씩 ---------------- */
  const variant = async (fn: (p: P[]) => void, images = goodImages()) => {
    const p = goodParas()
    fn(p)
    return checkSpec(await parseHwpx(hwpx(p, images)))
  }
  const titleIdx = (p: P[]) => p.findIndex((x) => typeof x === 'string' && x.startsWith('공구 마모'))
  {
    const r = await variant((p) => p.splice(titleIdx(p) + 1, 0, '{SECOND LINE}'))
    check('E1 발명의 명칭 두 문단 → E-262', find(r, 'TITLE_PARAS')?.code === 'E-262')
  }
  {
    const r = await variant((p) => (p[titleIdx(p)] = '영문 없는 발명의 명칭'))
    check('E2 { 영문 } 없음 → E-266', find(r, 'TITLE_BRACE')?.code === 'E-266')
  }
  {
    const r = await variant((p) => (p[titleIdx(p)] = '명칭{SYSTEM} 추가'))
    check('E3 } 뒤 글 → E-268', find(r, 'TITLE_AFTER')?.code === 'E-268')
  }
  {
    const r = await variant((p) => (p[titleIdx(p)] = '명칭{시스템 SYSTEM}'))
    check('E4 { } 안 한글 → E-267', find(r, 'TITLE_INNER')?.code === 'E-267')
  }
  {
    const r = await variant((p) => (p[titleIdx(p)] = { t: '굵은 명칭{BOLD TITLE}', bold: true }))
    check('E5 명칭 굵게 → E-261', find(r, 'TITLE_FORMAT')?.code === 'E-261' && /굵게/.test(find(r, 'TITLE_FORMAT')?.detail ?? ''))
  }
  {
    const r = await variant((p) => p.splice(p.indexOf('【발명의 내용】') + 1, 0, '발명의 내용 아래 바로 쓴 글'))
    check('E6 상위 · 하위 사이 본문 → E-249', find(r, 'STRUCT_PARENT_TEXT')?.code === 'E-249')
  }
  {
    const r = await variant((p) => p.splice(p.indexOf('【요약서】'), 2))
    check('E7 요약서 · 요약 빠짐 → E-245', find(r, 'STRUCT_MISSING')?.code === 'E-245' && /요약서/.test(find(r, 'STRUCT_MISSING')?.detail ?? ''))
  }
  {
    const r = await variant((p) => (p[p.indexOf('도 1')] = '도 7'))
    check('E8 대표도 없는 도면 → E-250', find(r, 'REP_MISSING_FIG')?.code === 'E-250')
  }
  {
    const r = await variant((p) => (p[p.indexOf('도 1')] = '도1'))
    check('E9 대표도 도1(띄어쓰기 없음) → 주의', find(r, 'REP_SPACE')?.level === 'warn')
  }
  {
    const r = await variant((p) => p.splice(p.indexOf('【도 2】') + 1, 0, { blank: true }))
    check('E10 도 n 과 그림 사이 빈 문단 → S-010', find(r, 'FIG_BLANK')?.code === 'S-010')
  }
  {
    const r = await variant((p) => p.splice(p.indexOf('【도 3】') + 1, 0, '도3_교체시점.tif'))
    check('E11 도 n 아래 글(파일 이름) → E-240', find(r, 'FIG_EXTRA')?.code === 'E-240')
  }
  {
    const r = await variant((p) => {
      const i = p.indexOf('【도 3】')
      p.splice(i + 1, 1)
    })
    check('E12 그림 없는 도면 → E-240', find(r, 'FIG_NO_IMAGE')?.code === 'E-240')
  }
  {
    const r = await variant((p) => (p[p.indexOf('【청구항 2】') + 1] = '청구항 5에 있어서, 상기 마모판정부는 판정하는 것을 특징으로 하는 시스템.'))
    check('E13 없는/뒤 청구항 인용 → 고쳐야 함', find(r, 'CLAIM_REF')?.level === 'error')
  }
  {
    const r = await variant((p) => (p[p.indexOf('【청구항 4】') + 1] = '방법 독립항: 컴퓨터에 의해 변환하는 단계를 포함하는 방법.'))
    check('E14 청구항 안 이름표 → 고쳐야 함', find(r, 'CLAIM_LABEL')?.level === 'error')
  }
  {
    const r = await variant((p) => p.splice(p.indexOf('【발명의 효과】') + 2, 0, '이번 특허에서 가장 중요한 강화 포인트다. /Devil'))
    check('E15 내부 작업 문구 → 고쳐야 함', find(r, 'HYGIENE_INTERNAL')?.level === 'error')
  }
  {
    const r = await variant((p) => p.splice(p.indexOf('[0010] 도 2 및 도 3에서 마모판정부(530)는 공구별 마모상태를 판정한다.') + 1, 0, '[0011] 도 4를 참조하면 알림부(570)가 동작한다.'))
    check('E16 본문이 없는 도 4 를 가리킴 → 고쳐야 함', find(r, 'FIG_BODY_REF')?.level === 'error')
    check('E17 부호의 설명에 없는 부호(570) → 주의', find(r, 'SIGNS_MISSING')?.level === 'warn' && /570/.test(find(r, 'SIGNS_MISSING')?.detail ?? ''))
  }
  {
    const r = await variant((p) => {
      const a = p.indexOf('【발명의 효과】')
      const block = p.splice(a, 2)
      p.splice(p.indexOf('【발명의 내용】'), 0, ...block)
    })
    check('E18 순서 뒤바뀜 → E-244', find(r, 'STRUCT_ORDER')?.code === 'E-244')
  }
  {
    const r = await variant((p) => (p[p.indexOf('【청구항 2】') + 1] = '청구항 1에 있어서, 상기 판정모듈은 마모상태를 판정하는 것을 특징으로 하는 시스템.'))
    check('E19 앞에 없는 "상기 판정모듈" → 참고', find(r, 'CLAIM_ANTECEDENT')?.level === 'info' && /판정모듈/.test(find(r, 'CLAIM_ANTECEDENT')?.where[0]?.label ?? ''))
  }
  {
    const r = await variant(() => {}, { image1: makeTiff({ dpi: 200 }), image2: makeTiff({ bits: 8 }), image3: makeTiff({ mm: true }) })
    check('E20 200dpi · 8비트 · MM → 각각 주의', has(r, 'TIFF_DPI') && has(r, 'TIFF_BITS') && has(r, 'TIFF_ORDER') && r.counts.error === 0, ids(r))
  }

  /* ---------------- 복붙용 MD(Master 12-4F 모양) ---------------- */
  {
    const md = [
      '**[발명의 명칭]**',
      '공구 마모 예측 기반 시스템{SYSTEM BASED ON WEAR PREDICTION}',
      '**[기술분야]**',
      '본 발명은 공구관리 시스템에 관한 것이다.',
      '**[발명의 배경이 되는 기술]**',
      '종래 기술.',
      '**[발명의 내용]**',
      '**[해결하려는 과제]**',
      '과제.',
      '**[과제의 해결 수단]**',
      '수단.',
      '**[발명의 효과]**',
      '효과. **강조**',
      '**[도면의 간단한 설명]**',
      '도 1은 구성도이다.',
      '도 2는 흐름도이다.',
      '**[발명을 실시하기 위한 구체적인 내용]**',
      '도 1 및 도 2를 참조한다.',
      '**[청구범위]**',
      '**[청구항 1]**',
      '시스템.',
      '**[요약서]**',
      '**[요약]**',
      '요약.',
      '**[대표도]**',
      '도 1',
    ].join('\n')
    const r = checkSpec(parseSpecText(md, '복붙용.md'))
    check('M1 MD 식별항목(**[ ]**) 읽음 — 빠진 식별항목 없음', !has(r, 'STRUCT_MISSING') && r.summary.claims === 1, r.findings.map((f) => f.id))
    check('M2 MD 본문 속 ** 는 주의', find(r, 'HYGIENE_MARKDOWN')?.level === 'warn')
    check('M3 글에는 도면 칸이 없어 대조 못 함 → 참고', has(r, 'FIG_NOT_CHECKED'))
    check('M4 MD 식별항목은 대괄호 경고 아님', !has(r, 'STRUCT_SQUARE'))
  }
  {
    let msg = ''
    try {
      await parseSpecFile('옛.hwp', new Uint8Array([1, 2, 3]))
    } catch (e) {
      msg = (e as Error).message
    }
    check('F1 .hwp 는 .hwpx 로 저장해 달라고 안내', /hwpx/.test(msg), msg)
    const t = await parseSpecFile('글.txt', new TextEncoder().encode('【발명의 명칭】\n이름{NAME}'))
    check('F2 .txt 는 글로 읽음', t.kind === 'text' && t.items[0]?.role === 'title')
  }

  /* ---------------- 이 컴퓨터에만 있는 실제 명세서(있으면) ---------------- */
  const realDir = process.env.PATENT_REAL_DIR
  if (realDir) {
    for (const f of readdirSync(realDir).filter((n) => /\.hwpx$/i.test(n))) {
      const r = checkSpec(await parseHwpx(new Uint8Array(readFileSync(join(realDir, f))), f))
      console.log(`\n=== 실제 ${f} — 고쳐야 함 ${r.counts.error} · 주의 ${r.counts.warn} · 참고 ${r.counts.info}`)
      console.log(JSON.stringify(r.summary))
      for (const x of r.findings) console.log(`  [${x.level}]${x.code ? ` ${x.code}` : ''} ${x.title} — ${x.detail}${x.where.length ? ` @ ${x.where.map((w) => w.label).join(' / ')}` : ''}`)
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
