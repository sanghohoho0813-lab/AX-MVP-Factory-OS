/**
 * 사업자등록번호 읽기 정확도 재기 (D-255) — 실제 고객 서류는 쓰지 않는다. 만든 서류(가짜 회사 · 가짜 번호)만.
 *
 *   node e2e/bizno-bench.mjs gen <폴더> [개수]          — 스캔처럼 만든 사업자등록증(그림만 든 PDF · 사진)과 정답
 *   node e2e/bizno-bench.mjs run <개발 서버 주소> <폴더> <이름>  — 그 서버의 읽기 코드(docTextExtract → 번호)로 읽고 결과 JSON
 *
 * run 은 `npx vite --port N` (개발 서버)에서 /src 모듈을 바로 불러 읽는다 — 화면을 누르지 않고 읽기 코드만 잰다.
 * 재는 것: 정답과 똑같이 읽은 수 · 틀린 번호를 '확실'로 넣은 수(0 이어야 함) · 확인으로 돌린 수 · 걸린 시간.
 */
import { chromium } from 'playwright'
import { jsPDF } from 'jspdf'
import { mkdirSync, readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const [, , mode, a1, a2, a3] = process.argv
/** 어려운 묶음 — 명조(세리프) 숫자 · 작은 글씨 · 낮은 해상도 · 더 흐림 · 더 압축(실제 사업자등록증 스캔에 가깝게) */
const HARD = process.env.HARD === '1'

/* ---------- 재현되는 난수 ---------- */
function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}
const pick = (r, xs) => xs[Math.floor(r() * xs.length)]

function checkDigit(nine) {
  const w = [1, 3, 7, 1, 3, 7, 1, 3, 5]
  let sum = 0
  for (let i = 0; i < 9; i += 1) sum += nine[i] * w[i]
  sum += Math.floor((nine[8] * 5) / 10)
  return (10 - (sum % 10)) % 10
}

/** 헷갈리기 쉬운 숫자(1 · 7 · 4 · 8 · 3 · 6)를 일부러 많이 넣는다 */
function makeBizNo(r, corp) {
  const hard = [1, 7, 4, 8, 3, 6, 1, 7]
  const d = () => (r() < 0.6 ? pick(r, hard) : Math.floor(r() * 10))
  const office = [1 + Math.floor(r() * 7), d(), d()]
  const mid = corp ? String(pick(r, [81, 86, 87, 88])).split('').map(Number) : [d() % 8, 1 + Math.floor(r() * 9)]
  const tail = [d(), d(), d(), d()]
  const nine = [...office, ...mid, ...tail]
  const ten = [...nine, checkDigit(nine)].join('')
  return `${ten.slice(0, 3)}-${ten.slice(3, 5)}-${ten.slice(5)}`
}

const COMPANIES = ['한빛정밀', '새솔테크', '가람이엔지', '누리솔루션', '온새미로', '다온산업', '벼리시스템', '하늘공구', '미르전자', '아라기계']
const PEOPLE = ['김가온', '박하람', '이나래', '최다솜', '정새봄', '윤보람', '한누리', '오세찬']
const ROADS = ['가산디지털1로 168', '테헤란로 427', '판교로 289', '센텀중앙로 97', '유성대로 1689', '첨단과기로 123']
const CITIES = ['서울특별시 금천구', '서울특별시 강남구', '경기도 성남시 분당구', '부산광역시 해운대구', '대전광역시 유성구', '광주광역시 북구']
const OFFICES = ['금천', '삼성', '성남', '해운대', '북대전', '북광주']

function certHtml(r, s) {
  const corp = s.corp
  const sp = (t) => t.split('').join(' ')
  const row = (label, value) => `<tr><th>${label}</th><td>:</td><td>${value}</td></tr>`
  const ymd = (y, m, d) => `${y} 년 ${String(m).padStart(2, '0')} 월 ${String(d).padStart(2, '0')} 일`
  const font = HARD ? `"Liberation Serif", "DejaVu Serif", "FreeSerif", "WenQuanYi Zen Hei"` : pick(r, ['"WenQuanYi Zen Hei"', '"WenQuanYi Zen Hei Sharp"'])
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page{size:A4;margin:0}
    html,body{margin:0;background:#fff}
    .page{width:794px;height:1123px;box-sizing:border-box;padding:70px 72px;font-family:${font};color:#111;position:relative}
    .no{font-size:11px;color:#333}
    h1{font-size:30px;text-align:center;letter-spacing:6px;margin:34px 0 6px;font-weight:700}
    .kind{text-align:center;font-size:15px;margin-bottom:22px}
    .num{text-align:center;font-size:${HARD ? 14 : 17}px;margin:0 0 26px;font-weight:${HARD ? 400 : 700}}
    table{border-collapse:collapse;font-size:15px;line-height:1.95}
    th{text-align:left;font-weight:400;white-space:nowrap;padding-right:6px;vertical-align:top;width:170px}
    td{vertical-align:top;padding-right:6px}
    .date{text-align:center;font-size:16px;margin-top:70px}
    .chief{text-align:center;font-size:24px;letter-spacing:10px;margin-top:26px;font-weight:700}
    .seal{position:absolute;right:150px;bottom:150px;width:72px;height:72px;border:4px solid #c33;color:#c33;font-size:13px;display:flex;align-items:center;justify-content:center;transform:rotate(-8deg);opacity:.8}
  </style></head><body><div class="page">
    <div class="no">발급번호 ${Math.floor(1000 + r() * 8999)}-${Math.floor(100 + r() * 899)}-${Math.floor(1000 + r() * 8999)}-${Math.floor(100 + r() * 899)}</div>
    <h1>${sp('사업자등록증')}</h1>
    <div class="kind">( ${corp ? '법인사업자' : '일반과세자'} )</div>
    <div class="num">등록번호 : ${s.bizNo}</div>
    <table>
      ${corp ? row('법인명(단체명)', s.name) : row(sp('상호'), s.name)}
      ${row(corp ? sp('대표자') : sp('성명'), s.rep)}
      ${row(sp('개업연월일'), `${ymd(s.y, s.m, s.d)}${corp ? `&nbsp;&nbsp;&nbsp;법인등록번호 : ${s.corpNo}` : `&nbsp;&nbsp;&nbsp;생년월일 : ${s.birth}`}`)}
      ${row('사업장 소재지', s.addr)}
      ${corp ? row('본 점 소재지', s.addr) : ''}
      ${row('사업의 종류', `업태 &nbsp;제조업 &nbsp;&nbsp;종목 &nbsp;공구 마모 예측 장치<br>업태 &nbsp;정보통신업 &nbsp;&nbsp;종목 &nbsp;응용 소프트웨어 개발`)}
      ${row(sp('발급사유'), '신규')}
      ${corp ? row('사업자 단위 과세 적용사업자 여부', '여( ) 부( √ )') : row('공동사업자', '')}
      ${row('전자세금계산서 전용 메일주소', 'tax@example.co.kr')}
    </table>
    <div class="date">${ymd(s.y, s.m, Math.min(28, s.d + 5))}</div>
    <div class="chief">${sp(s.office)} 세 무 서 장</div>
    <div class="seal">세무서장인</div>
  </div></body></html>`
}

async function gen(dir, n) {
  mkdirSync(dir, { recursive: true })
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
  const truth = []
  for (let i = 0; i < n; i += 1) {
    const r = rng(9001 + i * 7919)
    const corp = r() < 0.6
    const ci = Math.floor(r() * CITIES.length)
    const s = {
      corp,
      bizNo: makeBizNo(r, corp),
      name: corp ? pick(r, ['주식회사 ', '(주)']) + pick(r, COMPANIES) : pick(r, COMPANIES) + pick(r, ['상사', '공방', '스튜디오']),
      rep: pick(r, PEOPLE),
      y: 2008 + Math.floor(r() * 16),
      m: 1 + Math.floor(r() * 12),
      d: 1 + Math.floor(r() * 22),
      corpNo: `1${Math.floor(10000 + r() * 89999)}-${Math.floor(1000000 + r() * 8999999)}`,
      birth: `19${60 + Math.floor(r() * 35)}-0${1 + Math.floor(r() * 9)}-1${Math.floor(r() * 9)}`,
      addr: `${CITIES[ci]} ${pick(r, ROADS)}, ${2 + Math.floor(r() * 9)}층`,
      office: OFFICES[ci],
    }
    // 스캔 상태 — 해상도 · 기울기 · 흐림 · 잡티 · 압축
    const kind = i % 4 === 3 ? 'photo' : 'scan'
    const dpi = HARD ? (kind === 'photo' ? 110 + Math.floor(r() * 40) : pick(r, [150, 200, 200])) : kind === 'photo' ? 140 + Math.floor(r() * 50) : pick(r, [200, 300, 300])
    const rot = (r() - 0.5) * (kind === 'photo' ? 3 : 1.6)
    const blur = HARD ? 0.8 + r() * 0.9 : kind === 'photo' ? 0.6 + r() * 0.8 : 0.3 + r() * 0.9
    const noise = HARD ? 14 + r() * 20 : 6 + r() * 18
    const q = HARD ? 0.4 + r() * 0.2 : 0.55 + r() * 0.25
    const page = await browser.newPage({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: dpi / 96 })
    await page.setContent(certHtml(r, s), { waitUntil: 'load' })
    const png = await page.screenshot({ type: 'png' })
    const jpeg = await page.evaluate(
      async ({ b64, rot, blur, noise, q, seed }) => {
        const img = new Image()
        img.src = `data:image/png;base64,${b64}`
        await img.decode()
        const c = document.createElement('canvas')
        c.width = img.width
        c.height = img.height
        const x = c.getContext('2d')
        x.fillStyle = '#f1efe8'
        x.fillRect(0, 0, c.width, c.height)
        x.translate(c.width / 2, c.height / 2)
        x.rotate((rot * Math.PI) / 180)
        x.filter = `blur(${blur}px) contrast(0.86) brightness(0.97)`
        x.drawImage(img, -img.width / 2, -img.height / 2)
        x.setTransform(1, 0, 0, 1, 0, 0)
        x.filter = 'none'
        const d = x.getImageData(0, 0, c.width, c.height)
        let s = seed
        for (let k = 0; k < d.data.length; k += 4) {
          s = (s * 1103515245 + 12345) & 0x7fffffff
          const n = ((s / 0x7fffffff) - 0.5) * noise
          d.data[k] += n
          d.data[k + 1] += n
          d.data[k + 2] += n
        }
        x.putImageData(d, 0, 0)
        const url = c.toDataURL('image/jpeg', q)
        return url.slice(url.indexOf(',') + 1)
      },
      { b64: png.toString('base64'), rot, blur, noise, q, seed: 1234 + i },
    )
    await page.close()
    const base = `cert-${String(i + 1).padStart(2, '0')}`
    let file
    if (kind === 'photo') {
      file = `${base}.jpg`
      writeFileSync(`${dir}/${file}`, Buffer.from(jpeg, 'base64'))
    } else {
      const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
      pdf.addImage(jpeg, 'JPEG', 0, 0, 595.28, 841.89)
      file = `${base}.pdf`
      writeFileSync(`${dir}/${file}`, Buffer.from(pdf.output('arraybuffer')))
    }
    truth.push({ file, bizNo: s.bizNo, corp, name: s.name, rep: s.rep, kind, dpi, rot: +rot.toFixed(2), blur: +blur.toFixed(2), q: +q.toFixed(2) })
    console.log(file, s.bizNo, kind, `${dpi}dpi`)
  }
  writeFileSync(`${dir}/truth.json`, JSON.stringify(truth, null, 2))
  await browser.close()
}

async function run(base, dir, label) {
  const truth = JSON.parse(readFileSync(`${dir}/truth.json`, 'utf8'))
  const only = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null
  // 글자 인식 일꾼 · 한글 자료는 CDN 에서 받는다 — 이 시험 기계의 브라우저는 바깥에 못 나가서 curl 로 받아 건네준다(한 번 받으면 보관)
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
  const context = await browser.newContext()
  const cacheDir = `${dir}/.cdn`
  mkdirSync(cacheDir, { recursive: true })
  await context.route(/^https:\/\/cdn\.jsdelivr\.net\//, async (route) => {
    const url = route.request().url()
    const file = `${cacheDir}/${Buffer.from(url).toString('base64url').slice(0, 200)}`
    if (!existsSync(file)) execFileSync('curl', ['-sSfL', '-o', file, url])
    const ct = url.endsWith('.js') ? 'application/javascript' : url.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream'
    await route.fulfill({ status: 200, body: readFileSync(file), headers: { 'content-type': ct, 'access-control-allow-origin': '*' } })
  })
  const page = await context.newPage()
  page.setDefaultTimeout(300_000)
  // pdf.js 6 이 쓰는 새 함수 — 이 Chromium 에 없어서, 전후 둘 다 같은 조건으로 채워 둔다(앱 쪽 고침은 따로 잰다)
  if (!process.env.NO_POLYFILL)
    await page.addInitScript(() => {
      for (const C of [Map, WeakMap]) {
        if (typeof C.prototype.getOrInsertComputed !== 'function')
          Object.defineProperty(C.prototype, 'getOrInsertComputed', { configurable: true, writable: true, value(k, f) { if (!this.has(k)) this.set(k, f(k)); return this.get(k) } })
        if (typeof C.prototype.getOrInsert !== 'function')
          Object.defineProperty(C.prototype, 'getOrInsert', { configurable: true, writable: true, value(k, v) { if (!this.has(k)) this.set(k, v); return this.get(k) } })
      }
    })
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' })
  const out = []
  for (const t of truth) {
    if (only && !only.has(t.file)) continue
    const b64 = readFileSync(`${dir}/${t.file}`).toString('base64')
    const started = Date.now()
    const res = await page.evaluate(
      async ({ b64, name }) => {
        const bin = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0))
        const type = name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'
        const file = new File([bin], name, { type })
        const ex = await import('/src/services/docTextExtract.ts')
        const parser = await import('/src/services/koreanDocParser.ts')
        const got = await ex.extractTextFromFile(file)
        const parsed = parser.parseKoreanBusinessDocument(got.text)
        // 새 읽기(있으면): 번호 + 확실/확인 + 후보
        const read = typeof parser.readBusinessNumber === 'function' ? parser.readBusinessNumber(got.text) : null
        const line = (got.text.split('\n').find((l) => /등\s*록\s*번\s*호/.test(l)) ?? '').slice(0, 80)
        return { method: got.method, businessNumber: parsed.businessNumber ?? '', read, line, companyName: parsed.companyName ?? '', rep: parsed.representativeName ?? '' }
      },
      { b64, name: t.file },
    )
    const ms = Date.now() - started
    const value = res.read ? res.read.value ?? '' : res.businessNumber
    // 예전 규칙: 스캔(OCR)이라도 검증 숫자가 맞으면 바로 넣는다 · 안 맞으면 확인
    const sure = res.read ? !!res.read.sure : value !== '' && checksumOk(value)
    const ok = value === t.bizNo
    out.push({ file: t.file, kind: t.kind, dpi: t.dpi, want: t.bizNo, got: value, ok, sure, wrongSure: sure && !ok, candidates: res.read?.candidates ?? [], hasRight: ok || (res.read?.candidates ?? []).includes(t.bizNo), line: res.line, ms, method: res.method })
    console.log(`${t.file} ${t.kind}/${t.dpi} want ${t.bizNo} got ${value || '-'} ${ok ? 'OK' : 'XX'} ${sure ? 'sure' : 'check'} ${res.read?.candidates?.length ? `cand ${res.read.candidates.join(',')}` : ''} · ${(ms / 1000).toFixed(1)}s · ${res.line}`)
  }
  await browser.close()
  const n = out.length
  const sum = {
    label,
    n,
    exact: out.filter((o) => o.ok).length,
    wrongSure: out.filter((o) => o.wrongSure).length,
    toCheck: out.filter((o) => !o.sure).length,
    rightInCandidates: out.filter((o) => o.hasRight).length,
    avgSeconds: +(out.reduce((s, o) => s + o.ms, 0) / Math.max(1, n) / 1000).toFixed(1),
  }
  writeFileSync(`${dir}/result-${label}.json`, JSON.stringify({ sum, out }, null, 2))
  console.log(JSON.stringify(sum))
}

function checksumOk(v) {
  const d = v.replace(/\D/g, '').split('').map(Number)
  if (d.length !== 10) return false
  return checkDigit(d.slice(0, 9)) === d[9]
}

if (mode === 'gen') await gen(a1, Number(a2 ?? 20))
else if (mode === 'run') await run(a1, a2, a3 ?? 'run')
else {
  console.log('사용법: gen <폴더> [개수] | run <개발 서버 주소> <폴더> <이름>')
  readdirSync('.')
}
