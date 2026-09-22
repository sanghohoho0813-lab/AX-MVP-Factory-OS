/**
 * 엑셀(.xlsx) 판독기 단위 테스트 (D-89).
 * 실행: npm run test:xlsx
 *
 * 진짜 xlsx 를 시험 안에서 만들어 읽는다 — zip 을 손으로 쓰고(저장·압축 두 방식),
 * 공유 문자열·인라인 글자·날짜 서식·빈 칸·XML 기호까지 넣는다.
 */

import { excelSerialToDate, isXlsxFile, readXlsxSheets, readXlsxText, XlsxReadError } from '../xlsxText'
import { makeZip } from './xlsxFixture'

let passed = 0
let failed = 0
function check(name: string, cond: boolean, detail?: string): void {
  if (cond) passed += 1
  else {
    failed += 1
    console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

const WORKBOOK = `<?xml version="1.0"?><workbook><sheets><sheet name="명부" sheetId="1" r:id="rId1"/><sheet name="비고" sheetId="2" r:id="rId2"/></sheets></workbook>`

/** 날짜 서식(s="1")을 쓰는 스타일 표 — 14번은 엑셀 기본 날짜 서식이다 */
const STYLES = `<?xml version="1.0"?><styleSheet><numFmts count="1"><numFmt numFmtId="166" formatCode="yyyy&quot;년&quot;\\ mm&quot;월&quot;"/></numFmts><cellXfs count="3"><xf numFmtId="0"/><xf numFmtId="14"/><xf numFmtId="166"/></cellXfs></styleSheet>`

const SHARED = `<?xml version="1.0"?><sst count="6" uniqueCount="6">
<si><t>성명</t></si>
<si><t>주민등록번호</t></si>
<si><t>입사일</t></si>
<si><r><t>김</t></r><r><t>철수</t></r></si>
<si><t>900101-1******</t></si>
<si><t>㈜한솔 &amp; 테크</t></si>
</sst>`

// A1~C1 머리글 · 2행 값(입사일은 날짜 서식 숫자 46037 = 2026-01-15) · 3행은 B 칸이 비어 있다
const SHEET1 = `<?xml version="1.0"?><worksheet><sheetData>
<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row>
<row r="2"><c r="A2" t="s"><v>3</v></c><c r="B2" t="s"><v>4</v></c><c r="C2" s="1"><v>46037</v></c></row>
<row r="3"><c r="A3" t="inlineStr"><is><t>박영희</t></is></c><c r="C3" s="2"><v>46037</v></c></row>
<row r="4"><c r="A4" t="s"><v>5</v></c><c r="B4"><v>12345</v></c></row>
</sheetData></worksheet>`

const SHEET2 = `<?xml version="1.0"?><worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>메모</t></is></c></row></sheetData></worksheet>`

/* ------------------------------------------------------------------ */

const buf = await makeZip([
  { name: 'xl/workbook.xml', text: WORKBOOK, compress: true },
  { name: 'xl/styles.xml', text: STYLES, compress: true },
  // 공유 문자열은 '그냥 담기'(방식 0)로 — 두 방식 다 읽는지 보기 위해
  { name: 'xl/sharedStrings.xml', text: SHARED, compress: false },
  { name: 'xl/worksheets/sheet1.xml', text: SHEET1, compress: true },
  { name: 'xl/worksheets/sheet2.xml', text: SHEET2, compress: true },
])

const sheets = await readXlsxSheets(buf)
check('엑셀: 시트 둘을 읽는다', sheets.length === 2, String(sheets.length))
check('엑셀: 시트 이름을 읽는다', sheets[0].name === '명부' && sheets[1].name === '비고', sheets.map((s) => s.name).join())

const rows = sheets[0].rows
check('엑셀: 머리글 (공유 문자열, 압축 안 한 칸)', rows[0].join('|') === '성명|주민등록번호|입사일', rows[0].join('|'))
check('엑셀: 서식으로 쪼개진 글자를 이어 붙인다', rows[1][0] === '김철수', rows[1][0])
check('엑셀: 마스킹된 주민번호는 그대로', rows[1][1] === '900101-1******', rows[1][1])
check('엑셀: 날짜 서식 숫자를 날짜로 (기본 서식 14)', rows[1][2] === '2026-01-15', rows[1][2])
check('엑셀: 직접 만든 날짜 서식도 날짜로', rows[2][2] === '2026-01-15', rows[2][2])
check('엑셀: 빈 칸은 자리를 지킨다', rows[2].length === 3 && rows[2][1] === '', JSON.stringify(rows[2]))
check('엑셀: 인라인 글자도 읽는다', rows[2][0] === '박영희', rows[2][0])
check('엑셀: XML 기호를 풀어 준다', rows[3][0] === '㈜한솔 & 테크', rows[3][0])
check('엑셀: 서식 없는 숫자는 숫자 그대로', rows[3][1] === '12345', rows[3][1])

const text = await readXlsxText(buf)
check('엑셀→글자: 탭으로 칸, 줄바꿈으로 줄', text.includes('성명\t주민등록번호\t입사일'), text.slice(0, 80))
check('엑셀→글자: 시트가 여럿이면 이름을 적는다', text.includes('[명부]') && text.includes('[비고]'))
check('엑셀→글자: 빈 줄은 버린다', !text.includes('\n\n\n'))

// 엑셀이 아닌 파일
let threw = ''
try {
  await readXlsxText(new TextEncoder().encode('그냥 글자입니다').buffer as ArrayBuffer)
} catch (e) {
  threw = e instanceof XlsxReadError ? e.message : `다른 오류: ${String(e)}`
}
check('엑셀: 엑셀이 아니면 사람 말로 알려 준다', threw.includes('엑셀 파일이 아닙니다'), threw)

// 표가 없는 zip
let threw2 = ''
try {
  await readXlsxText(await makeZip([{ name: 'docProps/app.xml', text: '<a/>', compress: true }]))
} catch (e) {
  threw2 = e instanceof XlsxReadError ? e.message : `다른 오류: ${String(e)}`
}
check('엑셀: 표가 없으면 그렇게 말한다', threw2.includes('표를 찾지 못했습니다'), threw2)

check('엑셀: 날짜 숫자 환산 (1900-03-01 = 61)', excelSerialToDate(61) === '1900-03-01', excelSerialToDate(61))
check('엑셀: 파일 이름으로 판별', isXlsxFile({ name: '명부.xlsx' }) && !isXlsxFile({ name: '명부.csv' }))
check('엑셀: 형식(MIME)으로도 판별', isXlsxFile({ name: 'x', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))

console.log(`\nxlsx: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
