/**
 * qa:speccheck — 명세서 점검(D-245) 끝까지.
 *
 * 시험 파일은 이 스크립트가 직접 만든다(가짜 HWPX · 실제 명세서는 저장소에 두지 않는다).
 *
 *  1440  특허·MVP 머리에 '명세서 점검' 입구 → 화면
 *        · 잘 쓴 .hwpx → 고쳐야 함 0 · 주의 0 · 요약(청구항 4 · 도 1~3 · 문단 번호 10)
 *        · 틀린 .hwpx(직접 친 [청구항 2] · 문단 번호 건너뜀 · 도 3 설명 빠짐 · 대표도 설명 없음 · 굵은 명칭 · LZW 17줄)
 *          → 고칠 것 · 오류 코드 · 걸린 곳 누르면 그 문단(앞뒤 한 문단) · 다시 누르면 닫힘
 *        · 글로 붙여 넣기(MD 모양 **[ ]**) → 제목은 식별항목으로 · 본문 ** 는 주의 · 빠진 식별항목(E-245)
 *        · 오류 코드 도우미(E-249 · S-010 · 모르는 코드)
 *        · .hwp · 빈 ZIP → 알아듣는 말로 멈춤(화면 안 깨짐)
 *  360 · 390 · 430 × 기본 · 아주 크게  가로 넘침 0 · 화면 밖 글자 0
 *
 *   node e2e/speccheck.mjs http://localhost:4390
 */
import { chromium } from 'playwright'
import fs from 'node:fs'
import path from 'node:path'
import { seedScript } from './seed.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'
const SHOTS = process.env.SPECCHECK_SHOTS ?? ''
let pass = 0
let fail = 0
function check(name, ok, detail) {
  if (ok) pass += 1
  else fail += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || detail === undefined ? '' : ' ' + String(typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 600)}`)
}
const shot = async (page, name) => {
  if (!SHOTS) return
  fs.mkdirSync(SHOTS, { recursive: true })
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true })
}

/* ---------------- 가짜 HWPX 만들기(압축 안 한 ZIP) ---------------- */

const CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
const crc32 = (b) => {
  let c = 0xffffffff
  for (const x of b) c = CRC[(c ^ x) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function zipStore(files) {
  const enc = new TextEncoder()
  const parts = []
  const cent = []
  let off = 0
  for (const f of files) {
    const name = enc.encode(f.name)
    const data = typeof f.data === 'string' ? enc.encode(f.data) : f.data
    const crc = crc32(data)
    const lh = Buffer.alloc(30)
    lh.writeUInt32LE(0x04034b50, 0)
    lh.writeUInt16LE(20, 4)
    lh.writeUInt16LE(0x0800, 6)
    lh.writeUInt32LE(crc, 14)
    lh.writeUInt32LE(data.length, 18)
    lh.writeUInt32LE(data.length, 22)
    lh.writeUInt16LE(name.length, 26)
    parts.push(lh, Buffer.from(name), Buffer.from(data))
    const ch = Buffer.alloc(46)
    ch.writeUInt32LE(0x02014b50, 0)
    ch.writeUInt16LE(20, 4)
    ch.writeUInt16LE(20, 6)
    ch.writeUInt16LE(0x0800, 8)
    ch.writeUInt32LE(crc, 16)
    ch.writeUInt32LE(data.length, 20)
    ch.writeUInt32LE(data.length, 24)
    ch.writeUInt16LE(name.length, 28)
    ch.writeUInt32LE(off, 42)
    cent.push(ch, Buffer.from(name))
    off += 30 + name.length + data.length
  }
  const cd = Buffer.concat(cent)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(files.length, 8)
  end.writeUInt16LE(files.length, 10)
  end.writeUInt32LE(cd.length, 12)
  end.writeUInt32LE(off, 16)
  return Buffer.concat([...parts, cd, end])
}

function makeTiff({ compression = 4, strips = 1, dpi = 300, w = 2008, h = 2950 } = {}) {
  const tags = [
    [256, 4, 1, [w]],
    [257, 4, 1, [h]],
    [258, 3, 1, [1]],
    [259, 3, 1, [compression]],
    [262, 3, 1, [0]],
    [273, 4, strips, Array.from({ length: strips }, (_, i) => 200 + i)],
    [282, 5, 1, [dpi, 1]],
    [283, 5, 1, [dpi, 1]],
    [296, 3, 1, [2]],
  ]
  const buf = Buffer.alloc(1024)
  buf.set([0x49, 0x49, 42, 0])
  buf.writeUInt32LE(8, 4)
  buf.writeUInt16LE(tags.length, 8)
  let extra = 8 + 2 + tags.length * 12 + 4
  tags.forEach(([tag, type, count, vals], i) => {
    const e = 10 + i * 12
    buf.writeUInt16LE(tag, e)
    buf.writeUInt16LE(type, e + 2)
    buf.writeUInt32LE(count, e + 4)
    if (type === 5) {
      buf.writeUInt32LE(extra, e + 8)
      buf.writeUInt32LE(vals[0], extra)
      buf.writeUInt32LE(vals[1], extra + 4)
      extra += 8
    } else if (type === 3 && count === 1) buf.writeUInt16LE(vals[0], e + 8)
    else if (count === 1) buf.writeUInt32LE(vals[0], e + 8)
    else {
      buf.writeUInt32LE(extra, e + 8)
      vals.forEach((v, k) => buf.writeUInt32LE(v, extra + k * 4))
      extra += vals.length * 4
    }
  })
  return buf
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
function sectionXml(paras) {
  const body = paras
    .map((p) => {
      if (typeof p === 'string') return `<hp:p id="0"><hp:run charPrIDRef="1"><hp:t>${esc(p)}</hp:t></hp:run></hp:p>`
      if (p.img) return `<hp:p id="0"><hp:run charPrIDRef="1"><hp:pic id="1"><hc:img binaryItemIDRef="${p.img}"/></hp:pic></hp:run></hp:p>`
      return `<hp:p id="0"><hp:run charPrIDRef="${p.bold ? '2' : '1'}"><hp:t>${esc(p.t)}</hp:t></hp:run></hp:p>`
    })
    .join('')
  return `<?xml version="1.0" encoding="UTF-8"?><hs:sec xmlns:hs="s" xmlns:hp="p" xmlns:hc="c">${body}</hs:sec>`
}
const HEADER = `<?xml version="1.0"?><hh:head xmlns:hh="h"><hh:charProperties>
<hh:charPr id="1" height="1199" textColor="#000000" shadeColor="none"><hh:fontRef hangul="1"/></hh:charPr>
<hh:charPr id="2" height="1199" textColor="#000000" shadeColor="none"><hh:fontRef hangul="1"/><hh:bold/></hh:charPr>
</hh:charProperties></hh:head>`
const hwpx = (paras, images) =>
  zipStore([
    { name: 'mimetype', data: 'application/hwp+zip' },
    { name: 'Contents/header.xml', data: HEADER },
    { name: 'Contents/section0.xml', data: sectionXml(paras) },
    ...Object.entries(images).map(([k, v]) => ({ name: `BinData/${k}.tif`, data: v })),
  ])

const TITLE = '공구 마모 예측 기반 교체시점 산출 시스템 및 방법{SYSTEM AND METHOD FOR ESTIMATING TOOL REPLACEMENT TIME BASED ON WEAR PREDICTION}'
function goodParas() {
  return [
    '【발명의 설명】', '【발명의 명칭】', TITLE,
    '【기술분야】', '[0001] 본 발명은 공구 진동정보와 마모기준을 비교하는 시스템에 관한 것이다.',
    '【발명의 배경이 되는 기술】', '[0002] 종래에는 정해진 주기로만 공구를 교체하였다.',
    '【발명의 내용】', '【해결하고자 하는 과제】', '[0003] 마모량을 예측하는 것을 목적으로 한다.',
    '【과제의 해결 수단】', '[0004] 시스템(500)은 신호 정규화부(510)와 마모판정부(530)를 포함한다.',
    '【발명의 효과】', '[0005] 교체 시점을 미리 알 수 있다.',
    '【도면의 간단한 설명】', '[0006] 도 1은 전체 구성도이다.', '[0007] 도 2는 처리 흐름도이다.', '[0008] 도 3은 교체시점 산출 구조를 나타내는 도면이다.',
    '【발명을 실시하기 위한 구체적인 내용】',
    '[0009] 도 1을 참조하면 시스템(500)은 신호 정규화부(510) 및 마모판정부(530)를 포함한다.',
    '[0010] 도 2 및 도 3에서 마모판정부(530)는 공구별 마모상태를 판정한다.',
    '【부호의 설명】', '500: 공구관리 시스템', '510: 신호 정규화부', '530: 마모판정부',
    '【청구범위】',
    '【청구항 1】', '공구의 진동신호를 복수의 측정항목으로 변환하는 신호 정규화부; 및 상기 측정항목과 마모기준을 비교하는 마모판정부;를 포함하는 시스템.',
    '【청구항 2】', '청구항 1에 있어서, 상기 마모판정부는 마모상태를 판정하는 것을 특징으로 하는 시스템.',
    '【청구항 3】', '청구항 1 또는 청구항 2에 있어서, 상기 측정항목은 측정시점을 포함하는 것을 특징으로 하는 시스템.',
    '【청구항 4】', '컴퓨터에 의해 진동신호를 측정항목으로 변환하는 단계; 및 상기 측정항목을 비교하는 단계;를 포함하는 방법.',
    '【요약서】', '【요약】', '본 발명은 공구 진동정보와 마모기준을 비교하여 마모량을 예측하는 시스템(500)에 관한 것이다.',
    '【대표도】', '도 1',
    '【도면】', '【도 1】', { img: 'image1' }, '【도 2】', { img: 'image2' }, '【도 3】', { img: 'image3' },
  ]
}
/** 실제 0911 판에서 본 모양을 그대로 흉내 — 직접 친 [청구항 2] · 문단 번호 건너뜀 · 도 3 설명 빠짐 · 대표도 도 3 설명 없음 · 굵은 명칭 */
function badParas() {
  return goodParas()
    .map((p) => (p === TITLE ? { t: TITLE, bold: true } : p))
    .filter((p) => p !== '[0008] 도 3은 교체시점 산출 구조를 나타내는 도면이다.')
    .map((p) => (p === '【청구항 2】' ? '[청구항 2]' : p))
    .map((p) => (typeof p === 'string' && p.startsWith('[0009]') ? p.replace('[0009]', '[0008]') : p))
    .map((p) => (typeof p === 'string' && p.startsWith('[0010]') ? p.replace('[0010]', '[0010]') : p))
    .map((p, i, arr) => (p === '도 1' && arr[i - 1] === '【대표도】' ? '도 3' : p))
}

// 한글 이름 파일은 경로 대신 내용으로 넘긴다(Playwright 가 한글 경로를 조용히 놓치는 경우가 있다)
const file = (name, buffer) => ({ name, mimeType: 'application/octet-stream', buffer })
const GOOD = file('좋은 명세서.hwpx', hwpx(goodParas(), { image1: makeTiff(), image2: makeTiff(), image3: makeTiff() }))
const BAD = file('고칠 명세서 0911.hwpx', hwpx(badParas(), { image1: makeTiff({ compression: 5, strips: 17, w: 2480, h: 3508 }), image2: makeTiff(), image3: makeTiff() }))
const HWP = file('옛 형식.hwp', Buffer.from('HWP Document File'))
const EMPTY = file('빈 묶음.hwpx', zipStore([{ name: 'mimetype', data: 'application/hwp+zip' }]))

const MD = [
  '**[발명의 설명]**', '**[발명의 명칭]**', TITLE,
  '**[기술분야]**', '[0001] 본 발명은 **핵심** 시스템에 관한 것이다.',
  '**[청구범위]**', '**[청구항 1]**', '진동신호를 변환하는 정규화부;를 포함하는 시스템.',
  '**[요약서]**', '**[요약]**', '본 발명은 시스템에 관한 것이다.',
].join('\n')

const ids = (page) => page.locator('[data-finding]').evaluateAll((els) => els.map((e) => e.getAttribute('data-finding')))
const upload = async (page, file) => {
  await page.locator('#spec-file').setInputFiles(file)
  await page.waitForTimeout(400)
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })

/* ---------------- 1440 ---------------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR' })
  const page = await ctx.newPage()
  const errors = []
  const sent = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('request', (r) => {
    if (r.method() !== 'GET') sent.push(r.url())
  })
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())

  await page.goto(BASE + '/studio', { waitUntil: 'networkidle' })
  await page.waitForTimeout(400)
  const entry = page.getByRole('button', { name: '명세서 점검' })
  check('특허·MVP 머리에 [명세서 점검] 입구', (await entry.count()) === 1)
  await entry.click()
  await page.waitForURL('**/studio/spec-check')
  // 화면 조각을 받는 사이 앞 화면 제목을 읽지 않게 — 올리기 칸이 뜰 때까지 기다린다(게이트 중 한 번 앞질러 읽음)
  await page.locator('label[for="spec-file"]').waitFor({ timeout: 10000 }).catch(() => {})
  check('입구 → /studio/spec-check · 제목 명세서 점검', ((await page.locator('h1').first().innerText()) ?? '').includes('명세서 점검'))
  check('처음엔 결과 없음 · 올리기 칸 · 오류 코드 도우미', (await page.locator('[data-summary]').count()) === 0 && (await page.locator('label[for="spec-file"]').count()) === 1 && (await page.getByText('특허로 오류 코드로 찾기').count()) === 1)
  await shot(page, 'speccheck-1440-empty')

  // 잘 쓴 명세서
  await upload(page, GOOD)
  const counts = (await page.locator('[data-counts]').innerText()) ?? ''
  check('잘 쓴 .hwpx → 고쳐야 함 0 · 주의 0', counts.includes('고쳐야 함 0') && counts.includes('주의 0'), counts)
  const sum = (await page.locator('[data-summary]').innerText()) ?? ''
  check('요약: 파일 이름 · 한글 명칭 · 영문 명칭', sum.includes('좋은 명세서.hwpx') && sum.includes('공구 마모 예측') && sum.includes('SYSTEM AND METHOD'), sum.slice(0, 300))
  check('요약: 청구항 4개(독립 2 · 종속 2) · 도면 3장 · 대표도 도 1 · 문단 번호 10개', sum.includes('4개(독립 2 · 종속 2)') && sum.includes('3장(도 1~도 3)') && sum.includes('도 1') && sum.includes('10개'), sum)
  check('고쳐야 할 것 없음 안내 · 최종은 특허로 편집기', sum.includes('고쳐야 할 것은 없습니다') && sum.includes('특허로 편집기 오류검사 0건'))
  check('잘 쓴 명세서엔 고쳐야 함 · 주의 묶음 없음', (await page.locator('[data-level="error"]').count()) === 0 && (await page.locator('[data-level="warn"]').count()) === 0)
  await shot(page, 'speccheck-1440-good')

  // 틀린 명세서
  await upload(page, BAD)
  const c2 = (await page.locator('[data-counts]').innerText()) ?? ''
  const found = await ids(page)
  check('틀린 .hwpx → 고쳐야 함 있음 · 다시 올리면 결과 바뀜', !c2.includes('고쳐야 함 0') && ((await page.locator('[data-summary]').innerText()) ?? '').includes('고칠 명세서 0911.hwpx'), c2)
  for (const id of ['STRUCT_SQUARE', 'PARA_GAP', 'FIG_DESC_MISSING', 'REP_NO_DESC', 'TITLE_FORMAT', 'TIFF_COMPRESSION', 'TIFF_STRIPS']) check(`찾음: ${id}`, found.includes(id), found)
  const order = await page.locator('[data-level]').evaluateAll((els) => els.map((e) => e.getAttribute('data-level')))
  check('순서: 고쳐야 함 → 주의 → 참고', order[0] === 'error' && order.indexOf('warn') > order.indexOf('error') && (order.indexOf('info') === -1 || order.indexOf('info') > order.indexOf('warn')), order)
  const sq = page.locator('[data-finding="STRUCT_SQUARE"]')
  check('직접 친 [청구항 2] → E-201 · 고치는 법 [서식목록 삽입]', ((await sq.innerText()) ?? '').includes('E-201') && ((await sq.innerText()) ?? '').includes('고치는 법'), (await sq.innerText()).slice(0, 300))
  const gap = page.locator('[data-finding="PARA_GAP"]')
  const chip = gap.locator('button').first()
  check('걸린 곳 단추(닫힘)', (await chip.count()) === 1 && (await chip.getAttribute('aria-expanded')) === 'false')
  await chip.click()
  const view = gap.locator('[data-para-view]')
  const viewText = (await view.innerText().catch(() => '')) ?? ''
  check('걸린 곳 누르면 그 문단 · 앞뒤 한 문단', (await view.count()) === 1 && viewText.includes('[0010]') && viewText.includes('앞뒤 한 문단'), viewText)
  check('누른 단추는 펼침 표시', (await chip.getAttribute('aria-expanded')) === 'true')
  await shot(page, 'speccheck-1440-bad')
  await chip.click()
  check('다시 누르면 닫힘', (await gap.locator('[data-para-view]').count()) === 0)
  const rep = (await page.locator('[data-finding="REP_NO_DESC"]').innerText()) ?? ''
  check('대표도 도 3 인데 도면 설명에 도 3 없음', rep.includes('도 3'), rep.slice(0, 200))

  // 글로 붙여 넣기(MD 모양)
  await page.getByText('글로 붙여 넣기').first().click()
  await page.getByLabel('명세서 글').fill(MD)
  await page.getByRole('button', { name: '이 글 점검하기' }).click()
  await page.waitForTimeout(300)
  const mdIds = await ids(page)
  check('붙여 넣은 MD 제목(**[ ]**)은 식별항목으로 읽음(대괄호 경고 아님) · 명칭 나옴', !mdIds.includes('STRUCT_SQUARE') && ((await page.locator('[data-summary]').innerText()) ?? '').includes('공구 마모 예측'), mdIds)
  check('본문 속 ** 는 주의(E-201)', mdIds.includes('HYGIENE_MARKDOWN') && (await page.locator('[data-level="warn"] [data-finding="HYGIENE_MARKDOWN"]').count()) === 1, mdIds)
  check('붙여 넣은 글 이름 · 빠진 식별항목(E-245)', ((await page.locator('[data-summary]').innerText()) ?? '').includes('붙여 넣은 글') && mdIds.includes('STRUCT_MISSING'), mdIds)

  // 오류 코드 도우미
  await page.getByText('특허로 오류 코드로 찾기').first().click()
  await page.locator('#editor-code').fill('s010 e-249')
  const hits = await page.locator('[data-code-hits] li').evaluateAll((els) => els.map((e) => e.querySelector('p')?.textContent))
  check('코드 두 개 — 푸는 순서(E-249 먼저 · S-010 다음)', hits.join(',') === 'E-249,S-010', hits)
  check('여러 개면 위에서부터 안내', (await page.getByText('여러 개면 위에서부터 푸세요').count()) === 1)
  await page.locator('#editor-code').fill('E-999')
  check('모르는 코드 → 아는 코드 목록', (await page.getByText('아는 코드가 아닙니다').count()) === 1)
  await shot(page, 'speccheck-1440-paste-codes')

  // 못 읽는 파일
  await upload(page, HWP)
  const alert1 = (await page.getByRole('alert').innerText().catch(() => '')) ?? ''
  check('.hwp → hwpx 로 저장하라는 말 · 결과 비움', alert1.includes('.hwpx') && (await page.locator('[data-summary]').count()) === 0, alert1)
  await upload(page, EMPTY)
  const alert2 = (await page.getByRole('alert').innerText().catch(() => '')) ?? ''
  check('본문 없는 hwpx → 알아듣는 말로 멈춤', alert2.length > 0 && (await page.locator('[data-summary]').count()) === 0, alert2)
  await upload(page, GOOD)
  check('다시 올리면 오류 말 사라짐', (await page.getByRole('alert').count()) === 0 && (await page.locator('[data-summary]').count()) === 1)

  check('파일은 서버로 안 감(GET 말고 요청 0)', sent.filter((u) => u.startsWith(BASE)).length === 0, sent)
  check('페이지 오류 0', errors.length === 0, errors)
  await ctx.close()
}

/* ---------------- 휴대폰 ---------------- */
for (const width of [360, 390, 430]) {
  for (const scale of ['default', 'extra_large']) {
    const ctx = await browser.newContext({ viewport: { width, height: 800 }, locale: 'ko-KR', isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
    const page = await ctx.newPage()
    await page.goto(BASE + '/', { waitUntil: 'networkidle' })
    await page.evaluate(seedScript())
    await page.goto(BASE + '/studio/spec-check', { waitUntil: 'networkidle' })
    await page.evaluate((s) => document.documentElement.setAttribute('data-text-scale', s), scale)
    await upload(page, BAD)
    await page.locator('[data-finding="PARA_GAP"] button').first().click()
    await page.getByText('특허로 오류 코드로 찾기').first().click()
    await page.locator('#editor-code').fill('E-249 E-261 S-010')
    await page.waitForTimeout(200)
    const m = await page.evaluate(() => {
      const over = document.documentElement.scrollWidth - document.documentElement.clientWidth
      const wide = []
      for (const el of document.querySelectorAll('main *')) {
        if (!(el instanceof HTMLElement) || !el.offsetParent) continue
        const r = el.getBoundingClientRect()
        if (r.right > window.innerWidth + 1) wide.push(`${el.tagName}.${String(el.className).slice(0, 40)}:${Math.round(r.right)}`)
      }
      return { over, wide: wide.slice(0, 5) }
    })
    check(`${width} ${scale} 가로 넘침 0 · 화면 밖 글자 0`, m.over <= 0 && m.wide.length === 0, m)
    if (width === 390 && scale === 'default') await shot(page, 'speccheck-390')
    if (width === 360 && scale === 'extra_large') await shot(page, 'speccheck-360-130')
    await ctx.close()
  }
}

await browser.close()
console.log(`\nqa:speccheck  PASS ${pass} · FAIL ${fail}`)
process.exit(fail ? 1 : 0)
