/**
 * 진짜 한글 스캔 시험 (D-450) — 글꼴로 그린 한글 서류 그림을 [서류 올리기]로 올려, 글자 인식(한글)부터 칸 · 회사 정보 · 판정까지 끝까지 본다.
 * 글자 인식 언어 자료를 내려받으므로 인터넷(프록시)이 필요하다. 한글 글꼴(WenQuanYi Zen Hei)이 없으면 실패로 알린다(건너뛰지 않는다).
 *
 *  A 법인 3장(사업자등록증 · 표준재무제표증명 · 주주명부) — 쉼표를 숫자로 읽은 매출 · 주주 수 고침(D-446)
 *  B 개인 4장(사업자등록증 · 소득금액증명 · 부가세 과세표준증명 · 납세증명서) — 제목 글자 실수 · 6↔8(D-448)
 *  C 법인 5장(등기부 · 명부 사진 · 원천세 · 지방세 완납 · 벤처) — 원천세 A01(401) · 서명란(D-449)
 *  D 글자 쪽 + 스캔 쪽을 합친 PDF — 스캔 쪽도 읽어 서류 2개로(D-445)
 *
 *   node e2e/ocr-kr.mjs http://localhost:4390
 */
import { chromium } from 'playwright'
import { seedScript } from './seed.mjs'

const BASE = process.argv[2] ?? 'http://localhost:4390'
let pass = 0
let fail = 0
function check(name, ok, detail) {
  if (ok) pass += 1
  else fail += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : ' ' + detail}`)
}

const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', proxy })
const FONT = "font-family:'WenQuanYi Zen Hei',sans-serif"

const fontPage = await browser.newPage()
await fontPage.setContent(`<html><body><span id="a" style="${FONT};font-size:40px">사업자등록증</span><span id="b" style="font-family:monospace;font-size:40px">사업자등록증</span></body></html>`)
const hasFont = await fontPage.evaluate(() => document.fonts.check('40px "WenQuanYi Zen Hei"'))
await fontPage.close()
check('한글 글꼴(WenQuanYi Zen Hei) 있음 — 없으면 이 시험은 한글 그림을 못 만든다', hasFont)
if (!hasFont) {
  await browser.close()
  console.log(`\n진짜 한글 스캔: ${pass} passed, ${fail} failed`)
  process.exit(1)
}

const shot = async (lines, size = 40) => {
  const p = await browser.newPage({ viewport: { width: 1240, height: 1754 } })
  await p.setContent(`<html><body style="margin:80px;${FONT};font-size:${size}px;line-height:1.75;color:#151515;background:#fbfbf8">${lines.join('<br>')}</body></html>`)
  const buf = await p.screenshot({ type: 'jpeg', quality: 85 })
  await p.close()
  return buf
}
const img = async (name, lines, size) => ({ name, mimeType: 'image/jpeg', buffer: await shot(lines, size) })

/** 새 업체에 파일을 올리고 결과를 읽는다 */
async function upload(id, company, files, during) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', ignoreHTTPSErrors: true })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE + '/', { waitUntil: 'networkidle' })
  await page.evaluate(seedScript())
  await page.evaluate(([id, company]) => { const k = 'axmvp.v1.operations_clients'; const list = JSON.parse(localStorage.getItem(k) ?? '[]'); const now = '2026-10-01T00:00:00.000Z'; list.push({ id, companyName: company, status: 'active', createdAt: now, updatedAt: now }); localStorage.setItem(k, JSON.stringify(list)) }, [id, company])
  await page.goto(`${BASE}/ops/clients/${id}?tab=smart`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  const t0 = Date.now()
  await page.getByTestId('client-upload').click()
  await page.getByLabel('서류 파일 고르기').setInputFiles(files)
  const seen = during ? await during(page) : null
  await page.getByTestId('smart-batch').waitFor({ timeout: 240000 })
  await page.waitForTimeout(1200)
  const secs = Math.round((Date.now() - t0) / 1000)
  const txt = async (tid) => ((await page.getByTestId(tid).first().innerText().catch(() => '')) ?? '').replace(/\s+/g, ' ')
  const out = { seen, secs, placed: await txt('smart-placed'), entered: await txt('smart-entered'), inbox: await txt('fact-inbox'), tops: await txt('top-picks'), errors }
  out.record = await page.evaluate((id) => JSON.parse(localStorage.getItem('axmvp.v1.operations_clients') ?? '[]').find((x) => x.id === id), id)
  await ctx.close()
  return out
}

/* ---------------- A 법인 3장 ---------------- */
{
  const r = await upload('cli_ocrA', '미래바이오랩', [
    await img('scan_0001.jpg', ['사 업 자 등 록 증', '(법인사업자)', '등록번호 : 124-81-00998', '법인명(단체명) : 주식회사 미래바이오랩', '대표자 : 이대표', '개업연월일 : 2019 년 03 월 15 일', '법인등록번호 : 110111-1234567', '사업장 소재지 : 경기도 성남시 분당구 판교로 100', '업태 : 제조업   종목 : 의약품', '2019 년 03 월 18 일', '성남세무서장']),
    await img('scan_0002.jpg', ['표준재무제표증명', '손익계산서', '제 7(당)기 2025년 1월 1일부터 2025년 12월 31일까지', '(단위 : 원)', '과목 당기 전기', '매출액 2,400,000,000 2,000,000,000', '매출원가 1,500,000,000 1,300,000,000', '매출총이익 900,000,000 700,000,000', '판매비와관리비 600,000,000 480,000,000', '영업이익 300,000,000 220,000,000', '법인세차감전순이익 280,000,000 210,000,000', '법인세비용 60,000,000 30,000,000', '당기순이익 220,000,000 180,000,000'], 34),
    await img('scan_0003.jpg', ['주 주 명 부', '회사명 : 주식회사 미래바이오랩', '기준일 2026. 10. 01', '성명 주식수 지분율 비고', '이대표 14,000 70% 대표이사', '김배우 6,000 30% 배우자', '합계 20,000 100%']),
  ])
  check(`A 세 장 모두 제 칸(사업자등록증 · 재무제표 · 주주명부) · ${r.secs}초`, /scan_0001\.jpg → 사업자등록증/.test(r.placed) && /scan_0002\.jpg → 재무제표|scan_0002\.jpg → 최근 3개년 재무제표/.test(r.placed) && /scan_0003\.jpg → 주주명부/.test(r.placed), r.placed)
  check('A 재무제표 매출 24억 바로 입력(쉼표를 숫자로 읽어도 서류 안의 셈으로) · 잘못 읽은 "2만원" 없음', r.record?.factValues?.revenue === '2400000000' && !/매출 2만원/.test(r.inbox), JSON.stringify({ rev: r.record?.factValues?.revenue, inbox: r.inbox.slice(0, 200) }))
  check('A 주주명부 주주 2명 · 20,000주 바로 입력', /주주 2명 · 20,000주/.test(r.entered), r.entered.slice(0, 300))
  check('A 사업자등록번호 바로 입력(검증 숫자 맞음)', r.record?.businessNumber === '124-81-00998', r.record?.businessNumber)
  check('A D-467 깨끗한 스캔 개업연월일 — 숫자만 두 번 다시 읽어 같음 → 설립일 2019-03-15 바로 입력(확인 목록에 없음)', r.record?.establishedAt === '2019-03-15' && !/설립일 2019-03-15/.test(r.inbox), JSON.stringify({ est: r.record?.establishedAt, inbox: r.inbox.slice(0, 200) }))
  check('A 화면 오류 0 · 1분 안', r.errors.length === 0 && r.secs < 60, `${r.secs} ${r.errors.join(' | ')}`)
}

/* ---------------- B 개인 4장 ---------------- */
{
  const r = await upload('cli_ocrB', '미래상사', [
    await img('IMG_2001.jpg', ['사 업 자 등 록 증', '(일반과세자)', '등록번호 : 214-05-01239', '상 호 : 미래상사', '성 명 : 홍길동', '생 년 월 일 : 1988 년 01 월 01 일', '개업연월일 : 2022 년 05 월 02 일', '사업장 소재지 : 경상남도 창원시 성산구 중앙대로 10', '업 태 : 제조업   종 목 : 금속가공', '2022 년 05 월 03 일', '창원세무서장']),
    await img('IMG_2002.jpg', ['소 득 금 액 증 명', '(종합소득세 신고자용)', '(단위 : 원)', '귀속연도 사업자등록번호 상호 소득구분 수입금액 필요경비 소득금액', '2025 214-05-01239 미래상사 사업소득 860,000,000 790,000,000 70,000,000', '2024 214-05-01239 미래상사 사업소득 610,000,000 565,000,000 45,000,000', '2026년 10월 20일', '창원세무서장'], 26),
    await img('IMG_2003.jpg', ['부가가치세 과세표준증명', '상호(법인명) 미래상사 사업자등록번호 214-05-01239', '과세기간 신고구분 신고일 과세표준', '2025.01.01~2025.06.30 확정 2025.07.25 410,000,000', '2025.07.01~2025.12.31 확정 2026.01.25 450,000,000', '2026.01.01~2026.06.30 확정 2026.07.25 520,000,000'], 28),
    await img('IMG_2004.jpg', ['납 세 증 명 서', '상호 미래상사', '사업자등록번호 214-05-01239', '체납액 없음', '유효기간 2026년 11월 19일', '발급일자 2026년 10월 20일', '창원세무서장']),
  ])
  check(`B 네 장 모두 제 칸(사업자등록증 · 소득금액증명 · 부가세 과세표준증명 · 납세증명서 — 제목 글자 실수여도) · ${r.secs}초`, /IMG_2001\.jpg → 사업자등록증/.test(r.placed) && /IMG_2002\.jpg → 소득금액증명/.test(r.placed) && /IMG_2003\.jpg → 부가세 과세표준증명/.test(r.placed) && /IMG_2004\.jpg → 납세증명서/.test(r.placed), r.placed)
  check('B 사업자등록번호 · 매출 8억 6,000만원 바로 입력 · 사업소득 추이 생김', r.record?.businessNumber === '214-05-01239' && r.record?.factValues?.revenue === '860000000' && (r.record?.customFields ?? []).some((f) => f.label === '사업소득 추이' && f.value.includes('2024년보다 +56%')), JSON.stringify({ b: r.record?.businessNumber, rev: r.record?.factValues?.revenue }))
  check('B 매출 추이 = 소득금액증명 줄 + 올해 6개월(과세표준증명)', (r.record?.customFields ?? []).some((f) => f.label === '매출 추이' && f.value.includes('2024년보다 +41%') && f.value.includes('2026년 6개월')), JSON.stringify((r.record?.customFields ?? []).find((f) => f.label === '매출 추이')))
  check('B 화면 오류 0 · 1분 안', r.errors.length === 0 && r.secs < 60, `${r.secs} ${r.errors.join(' | ')}`)
}

/* ---------------- C 법인 5장 ---------------- */
{
  const r = await upload('cli_ocrC', '미래바이오랩', [
    await img('scan_0101.jpg', ['등기사항전부증명서(현재 유효사항)', '- 법 인 -', '등기번호 012345', '등록번호 110111-1234567', '상 호 주식회사 미래바이오랩', '본 점 경기도 성남시 분당구 판교로 100', '1주의 금액 금 5,000 원', '발행주식의 총수 20,000 주', '자본금의 액 금 100,000,000 원', '회사성립연월일 2019 년 03 월 15 일', '임원에 관한 사항', '사내이사 이대표 750505-*******', '2025 년 03 월 15 일 중임', '대표이사 이대표 750505-******* 경기도 성남시', '2019 년 03 월 15 일 취임', '열람일시 : 2026년 10월 20일 14시 05분'], 30),
    await img('scan_0102.jpg', ['사업장 가입자 명부', '사업장명 주식회사 미래바이오랩', '성명 주민등록번호 자격취득일 자격상실일', '김가가 990101-1****** 2024-03-01', '이나나 000505-4****** 2025-02-01', '박다다 850707-1****** 2023-01-02', '최라라 970303-2****** 2026-03-02', '정마마 680808-1****** 2022-05-01'], 32),
    await img('scan_0103.jpg', ['원천징수이행상황신고서', '귀속연월 2026년 09월 지급연월 2026년 09월', '근로소득 간이세액 A01 12 48,000,000 1,200,000'], 34),
    await img('scan_0104.jpg', ['지방세 완납증명서', '납세자 주식회사 미래바이오랩', '체납액 없음', '발급일 2026.10.20', '성남시장']),
    await img('scan_0105.jpg', ['벤처기업확인서', '기업명 주식회사 미래바이오랩', '사업자등록번호 124-81-00998', '벤처기업 확인유형 연구개발기업', '유효기간 2025.06.01 ~ 2028.05.31', '벤처기업확인기관장']),
  ], async (page) => {
    // D-455 · 457 PC 는 두 장씩 함께 읽고, 차례가 안 온 파일은 '차례를 기다려요'
    let reading = 0
    let queued = 0
    for (let i = 0; i < 30 && !(reading >= 2 && queued >= 1); i++) {
      await page.waitForTimeout(300)
      reading = await page.locator('[data-testid="bulk-item"][data-status="reading"]').count()
      queued = await page.getByTestId('bulk-item-queued').count()
    }
    return { reading, queued }
  })
  check(`C PC 는 두 장씩 함께 읽음 · 나머지는 '차례를 기다려요'(D-455 · 457) — 읽는 중 ${r.seen?.reading} · 기다림 ${r.seen?.queued}`, r.seen?.reading === 2 && r.seen?.queued >= 1, JSON.stringify(r.seen))
  check(`C 다섯 장 모두 제 칸(등기부 · 명부 · 원천세 · 지방세 · 벤처) · ${r.secs}초`, /scan_0101\.jpg → 법인등기부등본/.test(r.placed) && /scan_0102\.jpg → 4대보험 가입자 명부/.test(r.placed) && /scan_0103\.jpg → 원천징수이행상황신고서/.test(r.placed) && /scan_0104\.jpg → 지방세 납세증명서/.test(r.placed) && /scan_0105\.jpg → 벤처기업확인서/.test(r.placed), r.placed)
  check('C 명부 사진 → 직원 5명 바로 입력 · 등기부 → 대표 취임일 · 1주 액면가 · 발행주식 총수 바로 입력', /직원 수 5명/.test(r.entered) && /대표 취임일 2019-03-15/.test(r.entered) && /1주 액면가 5,000원/.test(r.entered) && /발행주식 총수 20,000주/.test(r.entered), r.entered.slice(0, 400))
  check('C 원천세 신고 인원 12명 읽음(A01 을 401 로 읽어도) · 벤처 값에 서명란 찌꺼기 없음', /원천세 신고 인원 2026년 9월분 근로자 12명/.test(r.inbox + r.entered) && /벤처기업 확인일 2025-06-01 · 2028-05-31까지(?! · 장)/.test(r.inbox), r.inbox.slice(0, 600))
  check('C 맨 위 카드 — 설립일은 겹침 없이(바로 들어갔거나 "확인만 하면 더 추천: 설립일" 한 번)', (r.record?.establishedAt === '2019-03-15' && !/설립일[^]*설립일/.test(r.tops)) || /확인만 하면 더 추천: 설립일 — /.test(r.tops), r.tops.slice(0, 400))
  check('C D-468 스캔 등기부 회사성립연월일 — 숫자만 두 번 다시 읽어 같음 → 설립일 2019-03-15 바로 입력', r.record?.establishedAt === '2019-03-15', JSON.stringify({ est: r.record?.establishedAt, inbox: r.inbox.slice(0, 200) }))
  check('C 화면 오류 0 · 1분 안', r.errors.length === 0 && r.secs < 60, `${r.secs} ${r.errors.join(' | ')}`)
}

/* ---------------- D 글자 쪽 + 스캔 쪽 합친 PDF ---------------- */
{
  const p = await browser.newPage({ viewport: { width: 1240, height: 1754 } })
  const reg = (await shot(['등기사항전부증명서(현재 유효사항)', '상 호 주식회사 미래바이오랩', '본 점 경기도 성남시 분당구 판교로 100', '회사성립연월일 2019 년 03 월 15 일', '1주의 금액 금 5,000 원', '발행주식의 총수 20,000 주', '대표이사 이대표'], 46)).toString('base64')
  const p1 = `<div style="${FONT};font-size:22px;line-height:1.8;padding:60px">사업자등록증명<br>등록번호 124-81-00998<br>상호 주식회사 미래바이오랩<br>대표자 이대표<br>개업일 2019년 03월 15일<br>사업장소재지 경기도 성남시 분당구 판교로 100<br>업태 제조업 종목 의약품<br>위와 같이 사업자등록 사실을 증명합니다<br>성남세무서장</div>`
  await p.setContent(`<html><body style="margin:0">${p1}<div style="page-break-before:always"></div><img src="data:image/jpeg;base64,${reg}" style="width:100%;display:block"></body></html>`)
  const pdf = await p.pdf({ format: 'A4', printBackground: true, margin: { top: 0, bottom: 0, left: 0, right: 0 } })
  await p.close()
  const r = await upload('cli_ocrD', '미래바이오랩', [{ name: '서류묶음.pdf', mimeType: 'application/pdf', buffer: pdf }])
  check(`D 글자 PDF 안의 스캔 쪽도 읽어 서류 2개(사업자등록증명 · 법인등기부등본) · ${r.secs}초`, /사업자등록증명/.test(r.placed) && /법인등기부등본/.test(r.placed), r.placed)
  check('D 화면 오류 0 · 1분 안', r.errors.length === 0 && r.secs < 60, `${r.secs} ${r.errors.join(' | ')}`)
}

/* ---------------- E 휴대폰 사진처럼 — 4도 기울기 · 그림자 · 흐림(D-451) ---------------- */
{
  const photo = async (name, deg, bg, filter) => {
    const p = await browser.newPage({ viewport: { width: 1240, height: 1754 } })
    const L = ['사 업 자 등 록 증', '(법인사업자)', '등록번호 : 124-81-00998', '법인명(단체명) : 주식회사 미래바이오랩', '대표자 : 이대표', '개업연월일 : 2019 년 03 월 15 일', '사업장 소재지 : 경기도 성남시 분당구 판교로 100', '업태 : 제조업   종목 : 의약품', '성남세무서장']
    await p.setContent(`<html><body style="margin:0;background:#ccc"><div style="transform:rotate(${deg}deg);margin:40px;padding:60px;${FONT};font-size:38px;line-height:1.75;color:#222;background:${bg};filter:${filter}">${L.join('<br>')}</div></body></html>`)
    const buf = await p.screenshot({ type: 'jpeg', quality: 70 })
    await p.close()
    return { name, mimeType: 'image/jpeg', buffer: buf }
  }
  for (const [tag, deg, bg, filter] of [['4도 기울기', 4, '#fbfbf8', 'none'], ['그림자', 1.5, 'linear-gradient(115deg,#f4f1e8 0%,#d9d4c6 55%,#9c968a 100%)', 'none'], ['흐림', 1, '#fbfbf8', 'blur(1.2px)']]) {
    const r = await upload(`cli_ocrE${deg}`, '미래바이오랩', [await photo('IMG_0001.jpg', deg, bg, filter)])
    check(`E ${tag} 사진 — 사업자등록증 칸 · 사업자등록번호 바로 입력(두 번 읽어 같음) · 주소 '성남시 … 판교로 100' · 설립일 2019-03-15(바로 입력 또는 확인 목록) · ${r.secs}초`, /사업자등록증/.test(r.placed) && r.record?.businessNumber === '124-81-00998' && /경기도 성남시 분당구 판교로 100/.test(r.inbox) && (r.record?.establishedAt === '2019-03-15' || /설립일 2019-03-15/.test(r.inbox)) && r.errors.length === 0, JSON.stringify({ b: r.record?.businessNumber, inbox: r.inbox.slice(0, 300) }))
  }
}

/* ---------------- F 재무상태표 · 중소기업 확인서 · 연구소 인정서(D-452) ---------------- */
{
  const r = await upload('cli_ocrF', '미래바이오랩', [
    await img('scan_0201.jpg', ['표준재무제표증명', '재무상태표', '제 7(당)기 2025년 12월 31일 현재', '(단위 : 원)', '과목 당기 전기', '단기대여금(가지급금) 150,000,000 120,000,000', '자산총계 3,200,000,000 2,900,000,000', '부채총계 1,900,000,000 1,800,000,000', '자본총계 1,300,000,000 1,100,000,000', '미처분이익잉여금 800,000,000 600,000,000'], 32),
    await img('scan_0203.jpg', ['중소기업 확인서', '기업명 주식회사 미래바이오랩', '사업자등록번호 124-81-00998', '기업규모 소기업', '유효기간 2026.04.01 ~ 2027.03.31', '중소벤처기업부']),
    await img('scan_0204.jpg', ['기업부설연구소 인정서', '연구소명 미래바이오랩 기업부설연구소', '기업명 주식회사 미래바이오랩', '인정번호 2021-1234', '인정일 2021년 04월 01일', '한국산업기술진흥협회장']),
  ])
  check(`F 재무상태표 → 자산 32억 · 부채 19억 · 가지급금 1억 5,000만원 · 배당 가능 이익 8억 바로 입력 · ${r.secs}초`, /자산 32억원/.test(r.entered) && /부채 19억원/.test(r.entered) && /가지급금 2025년 말 1억 5,000만원/.test(r.entered) && /배당 가능 이익 2025년 말 8억원/.test(r.entered), r.entered.slice(0, 400))
  check('F 중소기업 확인서 → 소기업 · 2027-03-31까지 · 연구소 인정서 → 인정일 2021-04-01(확인 목록)', /중소기업 확인 소기업/.test(r.inbox) && /2027-03-31까지/.test(r.inbox) && /기업부설연구소 인정번호 2021-1234/.test(r.inbox), r.inbox.slice(0, 500))
  check('F 화면 오류 0 · 1분 안', r.errors.length === 0 && r.secs < 60, `${r.secs} ${r.errors.join(' | ')}`)
}

/* ---------------- G 빨간 도장(직인)이 글자 위에 찍힌 사진(D-454) ---------------- */
{
  const stamped = async (name, line, left, redTitle) => {
    const p = await browser.newPage({ viewport: { width: 1240, height: 1754 } })
    const L = ['사 업 자 등 록 증', '(법인사업자)', '등록번호 : 124-81-00998', '법인명(단체명) : 주식회사 미래바이오랩', '대표자 : 이대표', '개업연월일 : 2019 년 03 월 15 일', '사업장 소재지 : 경기도 성남시 분당구 판교로 100', '업태 : 제조업   종목 : 의약품', '2026 년 04 월 01 일', '성남세무서장']
    if (redTitle) L[0] = `<span style="color:#d22">${L[0]}</span>`
    const stamp = `<div style="position:absolute;left:${left}%;top:${60 + line * 38 * 1.75}px;width:120px;height:120px;border:7px solid #d92b2b;border-radius:50%;color:#d92b2b;mix-blend-mode:multiply;display:flex;align-items:center;justify-content:center;font-size:30px;font-weight:bold;line-height:1.1;text-align:center;transform:rotate(-12deg);opacity:.85">세무<br>서장</div>`
    await p.setContent(`<html><body style="margin:0;background:#ccc"><div style="position:relative;margin:40px;padding:60px;${FONT};font-size:38px;line-height:1.75;color:#222;background:#fbfbf8">${L.join('<br>')}${stamp}</div></body></html>`)
    const buf = await p.screenshot({ type: 'jpeg', quality: 75 })
    await p.close()
    return { name, mimeType: 'image/jpeg', buffer: buf }
  }
  {
    const r = await upload('cli_ocrG1', '미래바이오랩', [await stamped('IMG_0101.jpg', 4, 18, false)])
    check(`G 도장이 대표자 · 개업일 줄 위 — 사업자등록번호 바로 입력 · 설립일 2019-03-15(바로 입력 또는 확인) · 주소 '성남시 … 판교로 100'(확인 목록) · ${r.secs}초`, /사업자등록증/.test(r.placed) && r.record?.businessNumber === '124-81-00998' && (r.record?.establishedAt === '2019-03-15' || /설립일 2019-03-15/.test(r.inbox)) && /경기도 성남시 분당구 판교로 100/.test(r.inbox) && r.errors.length === 0, JSON.stringify({ b: r.record?.businessNumber, inbox: r.inbox.slice(0, 300) }))
  }
  {
    const r = await upload('cli_ocrG2', '미래바이오랩', [await stamped('IMG_0102.jpg', 2, 30, true)])
    check(`G 도장이 사업자등록번호 위 + 빨간 제목 — 사업자등록증 칸(제목은 지우지 않음) · 번호 바로 입력 · ${r.secs}초`, /IMG_0102\.jpg → 사업자등록증/.test(r.placed) && r.record?.businessNumber === '124-81-00998' && (r.record?.establishedAt === '2019-03-15' || /설립일 2019-03-15/.test(r.inbox)) && r.errors.length === 0, JSON.stringify({ placed: r.placed, b: r.record?.businessNumber, inbox: r.inbox.slice(0, 300) }))
  }
}

/* ---------------- H 옆으로 누운 사진 · 거꾸로 된 스캔(D-460) ---------------- */
{
  const turned = async (name, deg) => {
    const p = await browser.newPage({ viewport: { width: 1240, height: 1754 } })
    const L = ['사 업 자 등 록 증', '(법인사업자)', '등록번호 : 124-81-00998', '법인명(단체명) : 주식회사 미래바이오랩', '대표자 : 이대표', '개업연월일 : 2019 년 03 월 15 일', '사업장 소재지 : 경기도 성남시 분당구 판교로 100', '업태 : 제조업   종목 : 의약품', '성남세무서장']
    await p.setContent(`<html><body style="margin:0;background:#fbfbf8"><div style="padding:100px;${FONT};font-size:38px;line-height:1.75;color:#222">${L.join('<br>')}</div></body></html>`)
    const b64 = (await p.screenshot({ type: 'jpeg', quality: 80 })).toString('base64')
    const out = await p.evaluate(async ([b64, deg]) => {
      const img = new Image()
      img.src = `data:image/jpeg;base64,${b64}`
      await img.decode()
      const c = document.createElement('canvas')
      const side = deg % 180 !== 0
      c.width = side ? img.height : img.width
      c.height = side ? img.width : img.height
      const ctx = c.getContext('2d')
      ctx.translate(c.width / 2, c.height / 2)
      ctx.rotate((deg * Math.PI) / 180)
      ctx.drawImage(img, -img.width / 2, -img.height / 2)
      return c.toDataURL('image/jpeg', 0.85).split(',')[1]
    }, [b64, deg])
    await p.close()
    return { name, mimeType: 'image/jpeg', buffer: Buffer.from(out, 'base64') }
  }
  for (const [tag, deg] of [['옆으로 누운(90도) 사진', 90], ['거꾸로 된(180도) 스캔', 180]]) {
    const r = await upload(`cli_ocrH${deg}`, '미래바이오랩', [await turned('IMG_0201.jpg', deg)])
    check(`H ${tag} — 돌려 읽어 사업자등록증 칸 · 번호 바로 입력 · 설립일 2019-03-15(바로 입력 또는 확인) · 주소(확인 목록) · ${r.secs}초`, /IMG_0201\.jpg → 사업자등록증/.test(r.placed) && r.record?.businessNumber === '124-81-00998' && (r.record?.establishedAt === '2019-03-15' || /설립일 2019-03-15/.test(r.inbox)) && /경기도 성남시 분당구 판교로 100/.test(r.inbox) && r.errors.length === 0, JSON.stringify({ placed: r.placed, b: r.record?.businessNumber, inbox: r.inbox.slice(0, 300) }))
  }
}

await browser.close()
console.log(`\n진짜 한글 스캔: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
