/**
 * test:office-docs — D-266 한글(.hwp · .hwpx) · 워드(.docx) 글자 읽기 · 압축(.zip) 풀기.
 * 시험 자료는 여기서 만든다(실제 한글 파일 구조 그대로 — 복합 문서 · 미니 흐름 · 압축된 본문 기록 · 표 칸 주소).
 * 실제 공개 한글 문서 5건 대조는 이 시험 밖에서 했다(docs/QA_REPORT.md §183 — 기준 글 줄 전부 있음).
 */
import { OfficeReadError, hwpParaText, isCfb, officeKindOf, officeText, readCfb, xmlBodyText } from '../officeText'
import { archiveOf, archiveSummary, expandArchives, isOtherArchive, isZipFile, mimeOf } from '../docArchive'
import { canExtractText, extractTextFromFile } from '../docTextExtract'
import { folderOfFile, relativePathOf } from '../../lib/dropFiles'
import { zipEntries, zipStore } from '../patent/zip'
import { normalizeClientOps } from '../clientOpsService'
import { allDocumentMetas } from '../clientOpsDocuments'
import { placeDocument } from '../docClassify'
import { factCandidatesFromDocText } from '../docFacts'
import { concat, makeCfb, makeDoc, makeXls, utf16 } from './officeFixtures'
import { legacyKindOf, legacyText, rtfText, webDocText, webTableSheets, wordChars, isXlsFile } from '../legacyOffice'

let pass = 0
let fail = 0
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) {
    pass++
    console.log('PASS ', name)
  } else {
    fail++
    console.log('FAIL ', name, detail === undefined ? '' : typeof detail === 'string' ? detail : JSON.stringify(detail))
  }
}

/* ------------------------------------------------------------------ */
/* 시험 자료 만들기                                                      */
/* ------------------------------------------------------------------ */

async function deflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const s = new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(s).arrayBuffer())
}
/** 본문 기록 하나 — 머리(태그 · 깊이 · 크기) + 몸 */
function rec(tag: number, level: number, body: Uint8Array): Uint8Array {
  const big = body.length >= 0xfff
  const head = new Uint8Array(big ? 8 : 4)
  const dv = new DataView(head.buffer)
  dv.setUint32(0, (tag & 0x3ff) | ((level & 0x3ff) << 10) | ((big ? 0xfff : body.length) << 20), true)
  if (big) dv.setUint32(4, body.length, true)
  return concat([head, body])
}
/** 문단 글 — 끝은 문단 나눔(13). 8칸 개체 자리(표 · 탭)는 그대로 넣는다 */
const ctrl8 = (code: number) => utf16(String.fromCharCode(code, 0, 0, 0, 0, 0, 0, code))
const para = (...parts: (string | Uint8Array)[]) => concat([...parts.map((p) => (typeof p === 'string' ? utf16(p) : p)), utf16('\r')])
const tblCtrl = () => new Uint8Array([0x20, 0x6c, 0x62, 0x74, 0, 0, 0, 0])
function cellHead(row: number, col: number): Uint8Array {
  const b = new Uint8Array(34)
  const dv = new DataView(b.buffer)
  dv.setUint16(0, 1, true)
  dv.setUint16(8, col, true)
  dv.setUint16(10, row, true)
  dv.setUint16(12, 1, true)
  dv.setUint16(14, 1, true)
  return b
}

/** 시험용 사업자등록증(.hwp) — 제목 · 표(등록번호 · 상호 · 대표자) · 탭 · 줄바꿈 · 표 뒤 문단 */
async function makeHwp(opts: { flags?: number; preview?: string; compress?: boolean; bodyPad?: number } = {}): Promise<Uint8Array> {
  const flags = opts.flags ?? 1
  const head = new Uint8Array(256)
  head.set(new TextEncoder().encode('HWP Document File'))
  new DataView(head.buffer).setUint32(32, 0x05000300, true)
  new DataView(head.buffer).setUint32(36, flags, true)
  const cells: [number, number, string][] = [
    [0, 0, '등록번호'],
    [0, 1, '124-81-00998'],
    [1, 0, '상 호'],
    [1, 1, '주식회사 한빛정밀'],
    [2, 0, '대 표 자'],
    [2, 1, '김한빛'],
  ]
  const body = concat([
    rec(66, 0, new Uint8Array(24)),
    rec(67, 1, para('사 업 자 등 록 증')),
    rec(66, 0, new Uint8Array(24)),
    rec(67, 1, para('(법인사업자)', ctrl8(9), '발급번호 1234')),
    rec(66, 0, new Uint8Array(24)),
    rec(67, 1, para(ctrl8(11))),
    rec(71, 1, tblCtrl()),
    rec(77, 2, new Uint8Array([0, 0, 0, 0, 3, 0, 2, 0])),
    // 칸은 열 · 행이 섞여 와도 행마다 열 차례로 모은다
    ...[cells[1], cells[0], cells[2], cells[3], cells[4], cells[5]].flatMap(([r, c, t]) => [rec(72, 2, cellHead(r, c)), rec(66, 2, new Uint8Array(24)), rec(67, 3, para(t))]),
    rec(66, 0, new Uint8Array(24)),
    rec(67, 1, para('개업연월일 : 2019년 03월 02일', '\n', '사업장 소재지 : 경기도 화성시 1')),
    rec(66, 0, new Uint8Array(24)),
    rec(67, 1, para('끝 😀 ', String.fromCharCode(24), '하이픈')),
    ...(opts.bodyPad ? [rec(67, 1, para('가'.repeat(opts.bodyPad)))] : []),
  ])
  const section = opts.compress === false ? body : await deflateRaw(body)
  const streams = [
    { path: 'FileHeader', data: head },
    { path: 'DocInfo', data: new Uint8Array(10) },
    { path: 'BodyText/Section0', data: section },
  ]
  if (opts.preview !== undefined) streams.push({ path: 'PrvText', data: utf16(opts.preview) })
  return makeCfb(streams)
}

/** 쓰는 방식 · 이름 표시를 고를 수 있는 ZIP(이름은 날 바이트 그대로 — CP949 시험용) */
async function makeZip(entries: { name: Uint8Array | string; data: Uint8Array | string; deflate?: boolean; encrypted?: boolean; utf8?: boolean }[]): Promise<Uint8Array> {
  const enc = new TextEncoder()
  const locals: Uint8Array[] = []
  const cens: Uint8Array[] = []
  let off = 0
  for (const e of entries) {
    const name = typeof e.name === 'string' ? enc.encode(e.name) : e.name
    const raw = typeof e.data === 'string' ? enc.encode(e.data) : e.data
    const comp = e.deflate ? await deflateRaw(raw) : raw
    const flags = (e.utf8 ? 0x800 : 0) | (e.encrypted ? 1 : 0)
    const lh = new Uint8Array(30 + name.length)
    const ldv = new DataView(lh.buffer)
    ldv.setUint32(0, 0x04034b50, true)
    ldv.setUint16(4, 20, true)
    ldv.setUint16(6, flags, true)
    ldv.setUint16(8, e.deflate ? 8 : 0, true)
    ldv.setUint32(18, comp.length, true)
    ldv.setUint32(22, raw.length, true)
    ldv.setUint16(26, name.length, true)
    lh.set(name, 30)
    const ch = new Uint8Array(46 + name.length)
    const cdv = new DataView(ch.buffer)
    cdv.setUint32(0, 0x02014b50, true)
    cdv.setUint16(4, 20, true)
    cdv.setUint16(6, 20, true)
    cdv.setUint16(8, flags, true)
    cdv.setUint16(10, e.deflate ? 8 : 0, true)
    cdv.setUint32(20, comp.length, true)
    cdv.setUint32(24, raw.length, true)
    cdv.setUint16(28, name.length, true)
    cdv.setUint32(42, off, true)
    ch.set(name, 46)
    locals.push(lh, comp)
    cens.push(ch)
    off += lh.length + comp.length
  }
  const cd = concat(cens)
  const eocd = new Uint8Array(22)
  const edv = new DataView(eocd.buffer)
  edv.setUint32(0, 0x06054b50, true)
  edv.setUint16(8, entries.length, true)
  edv.setUint16(10, entries.length, true)
  edv.setUint32(12, cd.length, true)
  edv.setUint32(16, off, true)
  return concat([...locals, cd, eocd])
}

const HWPX_SECTION = (body: string) => `<?xml version="1.0" encoding="UTF-8"?><hs:sec xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph">${body}</hs:sec>`
const hp = (t: string) => `<hp:p><hp:run charPrIDRef="0"><hp:t>${t}</hp:t></hp:run></hp:p>`
const hcell = (t: string) => `<hp:tc><hp:subList>${hp(t)}</hp:subList></hp:tc>`
const DOCX_DOC = (body: string) => `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`
const wp = (t: string) => `<w:p><w:r><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`
const wcell = (t: string) => `<w:tc><w:tcPr/>${wp(t)}</w:tc>`
const fileOf = (name: string, data: Uint8Array, type = '') => new File([data as BlobPart], name, { type })

async function main() {
  /* ---------------- .hwp ---------------- */
  {
    const bytes = await makeHwp()
    check('H0 시험 자료는 복합 문서(CFB) · 머리 · 미니 흐름(FileHeader) · BodyText/Section0', isCfb(bytes) && readCfb(bytes).list().join() === 'FileHeader,DocInfo,BodyText,BodyText/Section0' && readCfb(bytes).get('FileHeader')?.length === 256)
    const t = await officeText('hwp', bytes)
    const lines = t.split('\n')
    check('H1 한글(.hwp) — 제목 줄 · 탭 · 문단 안 줄바꿈 · 하이픈 · 이모지(두 글자 짝) 그대로', lines[0] === '사 업 자 등 록 증' && lines.includes('(법인사업자)\t발급번호 1234') && lines.includes('개업연월일 : 2019년 03월 02일') && lines.includes('사업장 소재지 : 경기도 화성시 1') && t.includes('끝 😀 -하이픈'), t)
    check('H2 표 — 한 행이 한 줄 · 칸 사이 탭 · 열이 섞여 와도 차례대로(등록번호 [탭] 번호)', lines.includes('등록번호\t124-81-00998') && lines.includes('상 호\t주식회사 한빛정밀') && lines.includes('대 표 자\t김한빛'), lines)
    check('H3 표 개체 자리(8칸 제어 글자)는 글에 안 남음 · 표 뒤 문단은 표 다음 줄', !/[\u0000-\u0008\u000b-\u001f]/.test(t) && lines.indexOf('대 표 자\t김한빛') < lines.indexOf('개업연월일 : 2019년 03월 02일'))
    const raw = await officeText('hwp', await makeHwp({ flags: 0, compress: false }))
    check('H4 압축 안 한 본문(속성 0)도 읽음', raw === t, raw.slice(0, 80))
    const bigT = await officeText('hwp', await makeHwp({ bodyPad: 6000 }))
    check('H5 4KB 넘는 본문(큰 흐름 · 큰 기록 머리)도 읽음', bigT.includes('가'.repeat(6000)) && bigT.includes('등록번호\t124-81-00998'))
    let pw = ''
    try {
      await officeText('hwp', await makeHwp({ flags: 1 | 2 }))
    } catch (e) {
      pw = e instanceof OfficeReadError ? e.message : 'other'
    }
    check('H6 암호 걸린 한글 문서 → 사람 말("암호 … 풀어 다시 저장")', pw.includes('암호') && pw.includes('다시 저장'), pw)
    const dist = await officeText('hwp', await makeHwp({ flags: 1 | 4, preview: '<사업자등록증><등록번호 124-81-00998>' }))
    check('H7 배포용 문서 → 미리보기 글(앞부분)만', dist.includes('사업자등록증') && dist.includes('124-81-00998') && !dist.includes('<'), dist)
    let bad = ''
    try {
      await officeText('hwp', new TextEncoder().encode('이건 한글 파일이 아닙니다'.repeat(40)))
    } catch (e) {
      bad = e instanceof OfficeReadError ? e.message : 'other'
    }
    check('H8 한글이 아닌 파일 → 사람 말(멈추지 않음)', bad.includes('한글'), bad)
    check('H9 문단 글 제어 — 줄바꿈(10) · 빈칸(30 · 31) · 8칸 개체 건너뜀', hwpParaText(concat([utf16('가'), ctrl8(2), utf16('나\n다'), utf16(String.fromCharCode(30, 31)), utf16('라')])) === '가나\n다  라')
  }

  /* ---------------- .hwpx ---------------- */
  {
    const sec0 = HWPX_SECTION(
      hp('주 주 명 부') +
        hp('회사명 : (주)한빛정밀 &amp; 파트너스') +
        `<hp:p><hp:run><hp:tbl><hp:tr>${hcell('성명')}${hcell('주식 수')}${hcell('지분율')}</hp:tr><hp:tr>${hcell('김한빛')}${hcell('6,000')}${hcell('60%')}</hp:tr><hp:tr>${hcell('이배우')}<hp:tc><hp:subList>${hp('4,000')}<hp:p><hp:run><hp:tbl><hp:tr>${hcell('보통주')}${hcell('우선주 0')}</hp:tr></hp:tbl></hp:run></hp:p></hp:subList></hp:tc>${hcell('40%')}</hp:tr></hp:tbl></hp:run></hp:p>` +
        `<hp:p><hp:run><hp:t>기준일<hp:tab width="4000"/>2026. 09. 30.<hp:lineBreak/>작성 : 대표이사</hp:t></hp:run></hp:p>`,
    )
    const sec1 = HWPX_SECTION(hp('둘째 구역'))
    const sec10 = HWPX_SECTION(hp('열한째 구역'))
    const bytes = zipStore([
      { name: 'mimetype', data: 'application/hwp+zip' },
      { name: 'Contents/section10.xml', data: sec10 },
      { name: 'Contents/section0.xml', data: sec0 },
      { name: 'Contents/section1.xml', data: sec1 },
      { name: 'Contents/header.xml', data: '<hh:head/>' },
    ])
    const t = await officeText('hwpx', bytes)
    const lines = t.split('\n')
    check('X1 한글(.hwpx) — 제목 · &amp; 풀기 · 표 한 행 한 줄(탭) · 탭 · 줄바꿈', lines[0] === '주 주 명 부' && lines.includes('회사명 : (주)한빛정밀 & 파트너스') && lines.includes('성명\t주식 수\t지분율') && lines.includes('김한빛\t6,000\t60%') && lines.includes('기준일\t2026. 09. 30.') && lines.includes('작성 : 대표이사'), lines)
    check('X2 표 안의 표는 바깥 칸 글로(칸 사이도 빈칸) — 바깥 행은 그대로 세 칸 한 줄', lines.includes('이배우\t4,000 보통주 우선주 0\t40%'), lines)
    check('X3 구역 차례 — section0 · 1 · 10(글자 차례가 아니라 번호 차례)', t.indexOf('주 주 명 부') < t.indexOf('둘째 구역') && t.indexOf('둘째 구역') < t.indexOf('열한째 구역'))
    let none = ''
    try {
      await officeText('hwpx', zipStore([{ name: 'a.txt', data: 'x' }]))
    } catch (e) {
      none = e instanceof OfficeReadError ? e.message : 'other'
    }
    check('X4 본문 없는 .hwpx → 사람 말', none.includes('본문'), none)
  }

  /* ---------------- .docx ---------------- */
  {
    const doc = DOCX_DOC(
      `<w:p><w:pPr><w:tabs><w:tab w:val="left" w:pos="2000"/></w:tabs></w:pPr><w:r><w:t>직 원 명 부</w:t></w:r></w:p>` +
        `<w:p><w:r><w:t>부서</w:t></w:r><w:r><w:tab/><w:t>영업팀</w:t></w:r><w:r><w:br/><w:t>둘째 줄</w:t></w:r></w:p>` +
        `<w:p><w:r><w:delText>지운 글</w:delText></w:r><w:r><w:instrText> PAGE </w:instrText></w:r><w:r><w:t>남은 글</w:t></w:r></w:p>` +
        `<w:tbl><w:tblPr/><w:tr>${wcell('성명')}${wcell('생년월일')}${wcell('입사일')}</w:tr><w:tr>${wcell('박청년')}${wcell('1999-05-01')}${wcell('2026-03-02')}</w:tr><w:tr>${wcell('최은혜')}<w:tc/>${wcell('2025-01-02')}</w:tr></w:tbl>` +
        wp('끝 &lt;확인&gt;'),
    )
    const bytes = zipStore([
      { name: '[Content_Types].xml', data: '<Types/>' },
      { name: 'word/document.xml', data: doc },
    ])
    const t = await officeText('docx', bytes)
    const lines = t.split('\n')
    check('D1 워드(.docx) — 제목(탭 위치 정의는 글이 아님) · 탭 · 줄바꿈 · 지운 글 · 필드 명령 빼기', lines[0] === '직 원 명 부' && lines.includes('부서\t영업팀') && lines.includes('둘째 줄') && lines.includes('남은 글') && !t.includes('지운 글') && !t.includes('PAGE'), lines)
    check('D2 표 — 한 행 한 줄 · 빈 칸은 자리만(탭)', lines.includes('성명\t생년월일\t입사일') && lines.includes('박청년\t1999-05-01\t2026-03-02') && lines.includes('최은혜\t\t2025-01-02') && lines.includes('끝 <확인>'), lines)
    check('D3 xmlBodyText — 문단 밖 글 · 빈 문단은 안 남김', xmlBodyText('<w:body>바깥<w:p></w:p><w:p><w:r><w:t>안</w:t></w:r></w:p></w:body>') === '안')
  }

  /* ---------------- 읽기 길 · 분류 · 사실 ---------------- */
  {
    const hwp = fileOf('스캔0003.hwp', await makeHwp())
    check('E1 종류 — 이름(.hwp · .hwpx · .docx · 대소문자) · 브라우저가 준 종류로도', officeKindOf('A.HWP') === 'hwp' && officeKindOf('b.hwpx') === 'hwpx' && officeKindOf('c.DocX') === 'docx' && officeKindOf('d', 'application/x-hwp') === 'hwp' && officeKindOf('e.doc') === null && officeKindOf('f.pdf') === null)
    check('E2 읽을 수 있는 파일 — 한글 · 워드도(예전엔 이름으로만)', canExtractText(hwp) && canExtractText(fileOf('a.hwpx', new Uint8Array(1))) && canExtractText(fileOf('a.docx', new Uint8Array(1))) && !canExtractText(fileOf('a.zip', new Uint8Array(1))))
    const res = await extractTextFromFile(hwp)
    check('E3 읽기 길 — 방법 "hwp" · 같은 글', res.method === 'hwp' && res.text.includes('등록번호\t124-81-00998'), res.method)
    const base = normalizeClientOps({ id: 'od1', companyName: '한빛정밀', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' })
    const metas = allDocumentMetas(base)
    const placed = placeDocument({ text: res.text, fileName: hwp.name }, metas)
    check('E4 이름이 "스캔0003.hwp" 여도 글로 사업자등록증 칸 · 확실(예전: 기타 · 확인 필요)', placed.kind === 'existing' && placed.key === 'businessRegistration' && placed.sure, placed)
    const facts = factCandidatesFromDocText('businessRegistration', res.text, 'doc:hwp')
    check('E5 표 한 줄(등록번호 [탭] 번호)에서 사업자등록번호 · 회사명 찾음', facts.some((f) => f.key === 'businessNumber' && f.value === '124-81-00998') && facts.some((f) => f.key === 'companyName' && f.value.includes('한빛정밀')), facts.map((f) => `${f.key}=${f.value}`))
    const before = placeDocument({ text: '', fileName: hwp.name }, metas)
    check('E6 (비교) 글 없이 이름만이면 예전처럼 기타 · 확인 필요', before.kind === 'new' && !before.sure)
    let note = ''
    try {
      await extractTextFromFile(fileOf('암호.hwp', await makeHwp({ flags: 3 })))
    } catch (e) {
      note = e instanceof OfficeReadError ? e.message : ''
    }
    check('E7 암호 문서는 읽기 길에서 사람 말 그대로(올리기 창이 까닭을 보여 줌)', note.includes('암호'), note)
  }

  /* ---------------- .zip ---------------- */
  {
    const cp = (arr: number[]) => new Uint8Array(arr)
    const BIZ_CP949 = cp([188, 173, 183, 249, 184, 240, 192, 189, 47, 187, 231, 190, 247, 192, 218, 181, 238, 183, 207, 193, 245, 46, 112, 100, 102])
    const HWP_CP949 = cp([188, 173, 183, 249, 184, 240, 192, 189, 47, 193, 164, 176, 252, 46, 104, 119, 112])
    const inner = await makeZip([{ name: '주주명부.docx', data: zipStore([{ name: 'word/document.xml', data: DOCX_DOC(wp('주 주 명 부')) }]), utf8: true, deflate: true }])
    const deeper = await makeZip([{ name: '셋째.zip', data: await makeZip([{ name: 'x.txt', data: 'x', utf8: true }]), utf8: true }])
    const zip = await makeZip([
      { name: '서류모음/', data: '' },
      { name: BIZ_CP949, data: '%PDF-1.4 가짜', deflate: true },
      { name: HWP_CP949, data: await makeHwp() },
      { name: '서류모음/인감.png', data: new Uint8Array([137, 80, 78, 71, 1]), utf8: true },
      { name: '__MACOSX/서류모음/._인감.png', data: 'mac', utf8: true },
      { name: '서류모음/.DS_Store', data: 'ds', utf8: true },
      { name: '서류모음/Thumbs.db', data: 'tb', utf8: true },
      { name: '서류모음/~$임시.docx', data: 'tmp', utf8: true },
      { name: '서류모음/잠김.pdf', data: 'secret', utf8: true, encrypted: true },
      { name: '서류모음/안쪽.zip', data: inner, utf8: true },
      { name: '서류모음/더안쪽.zip', data: deeper, utf8: true },
    ])
    const names = zipEntries(zip).map((e) => e.name)
    check('Z1 한글 이름 — UTF-8 표시 없는 CP949(Windows 기본 압축 · 알집) 이름도 그대로', names.includes('서류모음/사업자등록증.pdf') && names.includes('서류모음/정관.hwp') && names.includes('서류모음/인감.png'), names)
    const { files, notes } = await expandArchives([fileOf('2026 한빛정밀 서류.zip', zip, 'application/zip'), fileOf('따로.pdf', new Uint8Array([1, 2, 3]), 'application/pdf')])
    const fn = files.map((f) => f.name)
    check('Z2 압축 풀기 — 안의 서류 · 안쪽 압축 한 번 더 · 시스템 파일(__MACOSX · .DS_Store · Thumbs.db · ~$) · 암호 항목 빼기 · 따로 넣은 파일은 그대로 · 차례 유지', fn.join('|') === '사업자등록증.pdf|정관.hwp|인감.png|주주명부.docx|셋째.zip|따로.pdf', fn)
    const biz = files.find((f) => f.name === '사업자등록증.pdf') as File
    check('Z3 꺼낸 파일 — 종류(pdf · hwp · png) · 원래 경로 "압축 이름/안의 폴더/이름" · 서류함 폴더 · 출처', biz.type === 'application/pdf' && (files.find((f) => f.name === '정관.hwp') as File).type === 'application/x-hwp' && relativePathOf(biz) === '2026 한빛정밀 서류/서류모음/사업자등록증.pdf' && folderOfFile(biz) === '2026 한빛정밀 서류/서류모음' && archiveOf(biz) === '2026 한빛정밀 서류.zip' && archiveOf(files[5]) === '', { path: relativePathOf(biz), type: biz.type })
    const docx = files.find((f) => f.name === '주주명부.docx') as File
    check('Z4 안쪽 압축 — 경로 이어 붙임 · 출처는 바깥 압축 · 압축(deflate) 풀어 같은 내용', relativePathOf(docx) === '2026 한빛정밀 서류/서류모음/안쪽/주주명부.docx' && archiveOf(docx) === '2026 한빛정밀 서류.zip' && (await officeText('docx', new Uint8Array(await docx.arrayBuffer()))) === '주 주 명 부', relativePathOf(docx))
    const hwpIn = files.find((f) => f.name === '정관.hwp') as File
    check('Z5 압축 안 한글 파일도 바로 읽힘(같은 글)', (await extractTextFromFile(hwpIn)).text.includes('등록번호\t124-81-00998'))
    check('Z6 알림 한 줄 — "꺼냈어요 · n개는 못 꺼냄"(안쪽 압축은 바깥 줄에 합침)', notes.length === 1 && notes[0].opened === 5 && notes[0].skipped === 1 && archiveSummary(notes).includes('서류 5개를 꺼냈어요') && archiveSummary(notes).includes('1개는 못 꺼냄'), notes)
    const allLocked = await makeZip([{ name: 'a.pdf', data: 'x', utf8: true, encrypted: true }])
    const r1 = await expandArchives([fileOf('잠긴.zip', allLocked)])
    check('Z7 전부 암호 → 원래 압축 파일 그대로 올림(잃는 파일 0) · 까닭', r1.files.length === 1 && r1.files[0].name === '잠긴.zip' && (r1.notes[0].reason ?? '').includes('암호'), r1.notes)
    const r2 = await expandArchives([fileOf('깨진.zip', new TextEncoder().encode('zip 아님'))])
    check('Z8 깨진 압축 → 그대로 · 까닭', r2.files.length === 1 && (r2.notes[0].reason ?? '').includes('깨졌'), r2.notes)
    const r3 = await expandArchives([fileOf('서류.alz', new Uint8Array([1])), fileOf('b.7z', new Uint8Array([1]))])
    check('Z9 .alz · .7z(못 여는 형식) → 그대로 · "풀어서 올리면" 안내', r3.files.length === 2 && r3.notes.length === 2 && r3.notes.every((n) => (n.reason ?? '').includes('풀어서')), r3.notes)
    const many = await makeZip(Array.from({ length: 30 }, (_, i) => ({ name: `f${i}.txt`, data: `글 ${i}`, utf8: true })))
    const r4 = await expandArchives([fileOf('많음.zip', many)], 10)
    check('Z10 한 번에 다루는 수 한도 — 10개만 · 나머지는 못 꺼냄으로 셈', r4.files.length === 10 && r4.notes[0].skipped === 20, r4.notes)
    check('Z11 압축 · 다른 형식 · 종류 판별', isZipFile({ name: 'A.ZIP', type: '' }) && isZipFile({ name: 'x', type: 'application/x-zip-compressed' }) && !isZipFile({ name: 'a.hwpx', type: '' }) && isOtherArchive({ name: 'a.egg' }) && !isOtherArchive({ name: 'a.zip' }) && mimeOf('A.JPG') === 'image/jpeg' && mimeOf('noext') === 'application/octet-stream')
    const empty = await expandArchives([fileOf('빈.zip', await makeZip([{ name: '폴더/', data: '' }]))])
    check('Z12 빈 압축 → 그대로 · "안에 서류가 없어요"', empty.files.length === 1 && (empty.notes[0].reason ?? '').includes('없어요'))
  }

  /* ---------------- D-301 옛 엑셀(.xls) · 옛 워드(.doc) · 파워포인트(.pptx) ---------------- */
  {
    const enc = new TextEncoder()
    const xls = makeXls(
      [
        {
          name: '가입자명부',
          rows: [
            ['사업장명', '한솔테크(주)'],
            [],
            ['연번', '성명', '주민등록번호', '자격취득일', '월급여', '비율', '합계식', '비고식', '메모', '재직'],
            [1, '김철수', '900101-1234567', { date: 45200 }, 2500000, 0.1 + 0.2, { fnum: 1234.5 }, { fstr: '정규직' }, { label: '바로 적힌 글' }, { bool: true }],
            [2, '박영희', '880202-2345678', { date: 45108, xf: 2 }, { mulrk: [3000000, 7, 8] }],
          ],
        },
        { name: 'Sheet2', rows: [['두 번째 시트']] },
      ],
      { splitSst: true },
    )
    const t = await legacyText('xls', xls)
    const lines = t.split('\n')
    check('XL1 옛 엑셀(.xls) — 시트 이름 · 글 표(SST · CONTINUE 에서 잘린 한글 글도 그대로) · 줄마다 탭', t.startsWith('[가입자명부]') && lines.includes('사업장명\t한솔테크(주)') && lines.includes('연번\t성명\t주민등록번호\t자격취득일\t월급여\t비율\t합계식\t비고식\t메모\t재직') && t.includes('[Sheet2]\n두 번째 시트'), t.slice(0, 300))
    check('XL2 칸 값 — 정수(RK) · 소수(0.30000000000000004 → 0.3) · 날짜(기본 서식 · "yyyy년" 서식) · 식 결과(숫자 · 글) · 바로 적힌 글 · 참거짓 · 숫자 여럿(MULRK)', lines.includes('1\t김철수\t900101-1234567\t2023-10-01\t2500000\t0.3\t1234.5\t정규직\t바로 적힌 글\tTRUE') && lines.includes('2\t박영희\t880202-2345678\t2023-07-01\t3000000\t7\t8'), lines)
    const x1904 = await legacyText('xls', makeXls([{ name: 'a', rows: [[{ date: 43738 }]] }], { date1904: true }))
    check('XL3 1904 날짜 체계(맥 엑셀) — 1462일 더해서', x1904 === '2023-10-01', x1904)
    const errOf = async (f: () => Promise<unknown>) => {
      try {
        await f()
        return ''
      } catch (e) {
        return e instanceof OfficeReadError ? e.message : `다른 오류: ${String(e)}`
      }
    }
    check('XL4 암호 엑셀 · 아주 옛 엑셀(95) · 엉뚱한 파일 — 사람 말', (await errOf(() => legacyText('xls', makeXls([{ name: 'a', rows: [['x']] }], { encrypt: true })))).includes('암호') && (await errOf(() => legacyText('xls', makeXls([{ name: 'a', rows: [['x']] }], { biff5: true })))).includes('아주 옛 엑셀') && (await errOf(() => legacyText('xls', enc.encode('그냥 글')))).includes('엑셀(.xls) 파일이 아닙니다'))
    // 관공서 · EDI '엑셀로 저장' — 이름만 .xls 인 웹 표(euc-kr)
    const cp = (arr: number[]) => new Uint8Array(arr)
    const html = concat([enc.encode('<html><head><meta http-equiv="Content-Type" content="text/html; charset=euc-kr"></head><body><table border=1><thead><tr><th>'), cp([188, 186, 184, 237]), enc.encode('</th><th colspan="2">'), cp([193, 214, 185, 206, 181, 238, 183, 207, 185, 248, 200, 163]), enc.encode('</th><th>X</th></tr></thead><tr><td>'), cp([199, 209, 188, 214, 193, 164, 185, 208]), enc.encode('&nbsp;</td><td>900101</td><td>1234567</td><td>a&amp;b</td></tr></table></body></html>')])
    const ht = await legacyText('xls', html)
    check('XL5 이름만 .xls 인 웹 표(euc-kr · th · colspan · &nbsp; · &amp;) → 표 그대로', ht === '성명\t주민등록번호\t\tX\n한솔정밀\t900101\t1234567\ta&b', ht)
    const ssml = '<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="명부"><Table><Row><Cell><Data ss:Type="String">성명</Data></Cell><Cell ss:Index="3"><Data ss:Type="String">입사일</Data></Cell></Row><Row><Cell><Data ss:Type="String">김철수</Data></Cell><Cell ss:Index="3"><Data ss:Type="DateTime">2026-01-15T00:00:00.000</Data></Cell></Row></Table></Worksheet></Workbook>'
    const st = await legacyText('xls', enc.encode(ssml))
    check('XL6 이름만 .xls 인 엑셀 2003 XML — 칸 건너뛰기(ss:Index) · 날짜', st === '성명\t\t입사일\n김철수\t\t2026-01-15', st)
    const realXlsx = zipStore([
      { name: 'xl/workbook.xml', data: '<workbook><sheets><sheet name="S" sheetId="1"/></sheets></workbook>' },
      { name: 'xl/worksheets/sheet1.xml', data: '<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>속은 xlsx</t></is></c></row></sheetData></worksheet>' },
    ])
    check('XL7 이름만 .xls 인 .xlsx(ZIP) → .xlsx 로 읽음', (await legacyText('xls', realXlsx)) === '속은 xlsx')
    check('XL8 웹 표 읽개 — 표 없는 웹 문서는 빈 목록', webTableSheets('<html><body><p>표 없음</p></body></html>').length === 0)

    // 옛 워드
    // 표 두 행: [등록번호 | 124-81-00998] [법인명 | 한빛정밀] — 행 끝 0x07 은 문단 속성(fTtp)으로 알아본다(빈 칸 0x07 과 글자로는 같다)
    const t1 = '사 업 자 등 록 증\r(법인사업자)\r등록번호\u0007124-81-00998\u0007\u0007법인명(단체명)\u0007\u0007한빛정밀 주식회사\u0007\u0007'
    const rowEnd1 = t1.indexOf('00998\u0007\u0007') + 6
    const doc = makeDoc(
      [
        { text: t1 },
        { text: '\u0013 PAGE \\* MERGEFORMAT \u00143\u0015\rISO 9001\u000bline2\r', compressed: true },
      ],
      { rowEnds: [rowEnd1, t1.length - 1] },
    )
    const wt = await legacyText('doc', doc)
    const wl = wt.split('\n')
    check('W1 옛 워드(.doc) — 조각표(UTF-16 조각 + 1바이트 조각) · 문단 · 표 한 행 = 한 줄(빈 칸은 자리만) · 필드는 결과만 · 줄바꿈', wl[0] === '사 업 자 등 록 증' && wl.includes('등록번호\t124-81-00998') && wl.includes('법인명(단체명)\t\t한빛정밀 주식회사') && wl.includes('3') && !wt.includes('PAGE') && wl.includes('ISO 9001') && wl.includes('line2'), wl)
    const noTtp = (await legacyText('doc', makeDoc([{ text: 'A\u0007B\u0007\u0007C\r' }]))).split('\n')
    check('W1b 문단 속성이 없으면(행 끝을 모름) 한 줄로 이어질 뿐 · 글은 다 있음', noTtp[0] === 'A\tB\t\tC', noTtp)
    check('W2 0Table 쓰는 문서도', (await legacyText('doc', makeDoc([{ text: '영번 표\r' }], { table: '0Table' }))) === '영번 표')
    check('W3 암호 워드 · 아주 옛 워드(95) · 이름만 .doc 인 .docx — 사람 말', (await errOf(() => legacyText('doc', makeDoc([{ text: 'x' }], { encrypted: true })))).includes('암호') && (await errOf(() => legacyText('doc', makeDoc([{ text: 'x' }], { nFib: 0x0065 - 1 })))).includes('아주 옛 워드') && (await errOf(() => legacyText('doc', zipStore([{ name: 'word/document.xml', data: 'x' }])))).includes('.docx 로 바꿔'))
    const rtf = "{\\rtf1\\ansi\\ansicpg949\\deff0{\\fonttbl{\\f0 Batang;}}{\\*\\generator Riched20;}\\f0\\'bb\\'e7\\'be\\'f7\\'c0\\'da\\'b5\\'ee\\'b7\\'cf\\'c1\\'f5\\par \\'b5\\'ee\\'b7\\'cf\\'b9\\'f8\\'c8\\'a3\\tab 124-81-00998\\par \\u54620?\\u44544? done}"
    check('W4 이름만 .doc 인 RTF(cp949 \\\'hh · \\u · 글꼴표 · 생성기 빼기)', rtfText(rtf) === '사업자등록증\n등록번호\t124-81-00998\n한글 done', rtfText(rtf))
    check('W5 이름만 .doc 인 웹 문서 → 문단 · 표 줄', webDocText('<html><head><title>x</title><style>p{}</style></head><body><p>상호&nbsp;한빛</p><table><tr><td>대표</td><td>김가나</td></tr></table></body></html>') === '상호 한빛\n대표\t김가나', webDocText('<p>상호&nbsp;한빛</p><table><tr><td>대표</td><td>김가나</td></tr></table>'))
    check('W6 wordChars — 겹친 필드 · 쪽 나눔 · 줄 끝 탭 · 3줄 넘는 빈 줄', wordChars('A\u0013 X \u0013 Y \u0014y\u0015 \u0014r\u0015B\u000cC\u0007\u0007\r\r\r\rD') === 'ArB\nC\n\nD', wordChars('A\u0013 X \u0013 Y \u0014y\u0015 \u0014r\u0015B\u000cC\u0007\u0007\r\r\r\rD'))

    // 파워포인트
    const slide = (body: string) => `<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree>${body}</p:spTree></p:cSld></p:sld>`
    const ap = (t: string) => `<p:sp><p:txBody><a:p><a:r><a:t>${t}</a:t></a:r></a:p></p:txBody></p:sp>`
    const pptx = await makeZip([
      { name: 'ppt/slides/slide10.xml', data: slide(ap('열째 장')), deflate: true },
      { name: 'ppt/slides/slide2.xml', data: slide(`${ap('둘째 장')}<p:graphicFrame><a:graphic><a:graphicData><a:tbl><a:tr><a:tc><a:txBody><a:p><a:r><a:t>매출</a:t></a:r></a:p></a:txBody></a:tc><a:tc><a:txBody><a:p><a:r><a:t>12억</a:t></a:r></a:p></a:txBody></a:tc></a:tr></a:tbl></a:graphicData></a:graphic></p:graphicFrame>`), deflate: true },
      { name: 'ppt/slides/slide1.xml', data: slide(ap('회사 소개서')), deflate: true },
      { name: 'ppt/slides/_rels/slide1.xml.rels', data: '<x/>' },
    ])
    const pt = await legacyText('pptx', pptx)
    check('P1 파워포인트(.pptx) — 슬라이드 차례(1 · 2 · 10) · 표 한 행 한 줄', pt === '회사 소개서\n\n둘째 장\n매출\t12억\n\n열째 장', pt)

    // 읽기 길 · 분류 · 사실
    check('E8 종류 — .xls · .doc · .pptx(대소문자 · 브라우저 종류) · 명부용 isXlsFile', legacyKindOf('A.XLS') === 'xls' && legacyKindOf('b.Doc') === 'doc' && legacyKindOf('c.pptx') === 'pptx' && legacyKindOf('x', 'application/msword') === 'doc' && legacyKindOf('a.docx') === null && legacyKindOf('a.xlsx') === null && isXlsFile({ name: '명부.XLS' }))
    check('E9 읽을 수 있는 파일 — .xls · .doc · .pptx 도(예전엔 이름으로만)', canExtractText(fileOf('a.xls', new Uint8Array(1))) && canExtractText(fileOf('a.doc', new Uint8Array(1))) && canExtractText(fileOf('a.pptx', new Uint8Array(1))))
    const docFile = fileOf('스캔_0007.doc', doc)
    const res = await extractTextFromFile(docFile)
    const base = normalizeClientOps({ id: 'od2', companyName: '한빛정밀', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' })
    const placed = placeDocument({ text: res.text, fileName: docFile.name }, allDocumentMetas(base))
    check('E10 이름이 "스캔_0007.doc" 여도 글로 사업자등록증 칸 · 확실(예전: 기타 · 확인 필요)', res.method === 'doc' && placed.kind === 'existing' && placed.key === 'businessRegistration' && placed.sure, { m: res.method, placed })
    const facts = factCandidatesFromDocText('businessRegistration', res.text, 'doc:doc')
    check('E11 옛 워드 표 줄에서 사업자등록번호 찾음', facts.some((f) => f.key === 'businessNumber' && f.value === '124-81-00998'), facts)
    const xr = await extractTextFromFile(fileOf('명부.xls', xls))
    check('E12 읽기 길 — 옛 엑셀은 방법 "xls" · 같은 글', xr.method === 'xls' && xr.text.includes('김철수'), xr.method)
    // 압축 안 옛 서류도
    const { files } = await expandArchives([fileOf('옛서류.zip', await makeZip([{ name: '정관.doc', data: makeDoc([{ text: '정 관\r제1조 상호\r' }]), utf8: true }, { name: '명부.xls', data: xls, utf8: true }]))])
    const docIn = files.find((f) => f.name === '정관.doc') as File
    const xlsIn = files.find((f) => f.name === '명부.xls') as File
    check('E13 압축 안 .doc · .xls 도 꺼내서 바로 읽힘(종류 application/msword · vnd.ms-excel)', docIn?.type === 'application/msword' && xlsIn?.type === 'application/vnd.ms-excel' && (await extractTextFromFile(docIn)).text.startsWith('정 관') && (await extractTextFromFile(xlsIn)).text.includes('박영희'))
    check('E14 mimeOf — doc · xls · pptx', mimeOf('a.doc') === 'application/msword' && mimeOf('a.xls') === 'application/vnd.ms-excel' && mimeOf('a.pptx').includes('presentationml'))
  }

  // D-432 브라우저가 못 여는 사진(아이폰 HEIC) — 말없이 빈 글이 아니라 까닭 한 줄(OfficeReadError → 서류 올리기 줄에 보임)
  {
    const heic = fileOf('IMG_0042.HEIC', new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 104, 101, 105, 99]))
    let msg = ''
    try {
      await extractTextFromFile(heic)
    } catch (e) {
      msg = e instanceof OfficeReadError ? e.message : `other:${String(e)}`
    }
    check('D-432 아이폰 사진(.HEIC · 종류 비어 있어도) — 읽을 파일로 보고, 못 열면 "아이폰 사진(HEIC) … JPG 로 바꿔" 한 줄(예전: 말없이 빈 글 → 기타)', canExtractText(heic) && msg.includes('아이폰 사진(HEIC)') && msg.includes('높은 호환성'), msg)
  }
  console.log(`\nofficeDocs: ${pass} passed, ${fail} failed`)
  if (fail) process.exit(1)
}

void main()
