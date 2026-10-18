/**
 * D-202 홈페이지 만들기 — 업종 알아보기 · 업체 기록으로 초안 · 지어내지 않기 · HTML 안전(무작위 공격 글) · 꾸밈 대비 · 고치기 · 저장본 읽기 · 점검.
 * D-207 — 블록 바탕 · 첫 화면 사진 가득 · 사진 모음 · 고객 후기 · 거래처 로고 · 연락처 단추(카카오톡 · 상담 신청서) · 휴대폰 고정 단추 ·
 *         질문 하나만 열기 · 탭 아이콘 · 공유 정보 · h1 점검.
 * D-208 — 디자인 한 번에(스타일 6) · 홈페이지 점수 100점 · 이것만 하면 · 업종 맞춤 블록.
 */
import { normalizeClientOps } from '../clientOpsService'
import { adoptRow, isTrialId, normalizeTrial, registerInput, rowSubjectId, sameNameClient, subjectQuery, subjectRow, trialRecord, TRIAL_SAMPLES, withoutProvisional, withTrialDetails, type TrialProfile } from '../marketingTrial'
import { industryForRecord, siteFacts } from '../siteBuilder'
import { promoForSite } from '../contentStudio'
import {
  ALL_ART,
  BLOCK_DEFS,
  PALETTES,
  blockAnchors,
  confirmSample,
  contrastRatio,
  draftSite,
  duplicateBlock,
  formatBizNo,
  hasContent,
  industryOf,
  insertBlock,
  listAdd,
  listMove,
  listRemove,
  menuItems,
  moveBlock,
  newBlock,
  normalizeSiteDoc,
  regionOf,
  removeBlock,
  renderSiteHtml,
  telHref,
  safeHref,
  safeImage,
  setHidden,
  setProp,
  siteChecks,
  siteFileName,
  withContactPhone,
  heroArt,
  imageChars,
  paletteOf,
  STYLE_PRESETS,
  INDUSTRY_STYLE,
  applyStylePreset,
  currentStyle,
  siteScore,
  blockSuggestions,
  type BlockType,
  type SiteDoc,
} from '../siteBuilder'

let passed = 0
let failed = 0
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) {
    passed += 1
    console.log('PASS ', name)
  } else {
    failed += 1
    console.log('FAIL ', name, detail === undefined ? '' : JSON.stringify(detail).slice(0, 600))
  }
}

const today = '2026-10-16'
const now = '2026-10-16T09:00:00.000Z'
let n = 0
const makeId = () => `b${++n}`

const full = normalizeClientOps({
  id: 'c-full',
  companyName: '한솔정밀(주)',
  representativeName: '김한솔',
  businessNumber: '1234567890',
  businessAddress: '경기도 화성시 동탄산단 6길 15',
  businessCategory: '제조업',
  businessItem: '정밀 금속부품, 금형, 시제품 가공',
  establishedAt: '2014-03-02',
  employeeCount: '42',
  companyPhone: '031-123-4567',
  contactPhone: '010-9999-8888',
  contactEmail: 'hello@hansol.co.kr',
  factValues: { certifications: '벤처기업, 이노비즈, ISO 9001', patents: '금형 냉각 구조, 정밀 가공 지그', researchLab: '인정(2019)' },
})

/* ---------------- 업종 ---------------- */
const IND: [string[], string][] = [
  [['제조업', '정밀 금속부품'], 'manufacturing'],
  [['제조업', '식품 제조'], 'manufacturing'],
  [['정보통신업', '응용 소프트웨어 개발 및 공급업'], 'it'],
  [['도매 및 소매업', '전자상거래 소매업'], 'trade'],
  [['숙박 및 음식점업', '일반음식점 한식'], 'food'],
  [['서비스', '카페'], 'food'],
  [['보건업', '치과의원'], 'health'],
  [['전문, 과학 및 기술 서비스업', '세무사'], 'professional'],
  [['서비스', '경영 컨설팅업'], 'professional'],
  [['교육 서비스업', '입시 학원'], 'education'],
  [['건설업', '실내 인테리어 공사'], 'construction'],
  [['', ''], 'general'],
  [['기타', '잡화'], 'general'],
  // D-205 — 간판 · 광고 · 인쇄 · 디자인은 '제조' 가 붙어도 디자인 · 광고(샤인디자인이 제조 견본으로 나가던 것)
  [['제조업', '간판 및 광고물 제조업'], 'design'],
  [['서비스업', '시각 디자인업'], 'design'],
  [['제조업', '인쇄물 출력'], 'design'],
  [['서비스', '광고 대행업'], 'design'],
  [['제조업', '인쇄회로기판 제조'], 'manufacturing'],
]
const indBad = IND.filter(([t, k]) => industryOf(...t) !== k).map(([t, k]) => ({ t, want: k, got: industryOf(...t) }))
check('H1 업종 알아보기 18가지(간판 · 광고 · 인쇄 · 디자인 먼저 · 인쇄회로기판은 제조 · 제조 · 식품 제조는 제조 · 카페는 음식 · 모르면 기타)', indBad.length === 0, indBad)

check('H2 사업자등록번호 000-00-00000 · 10자리 아니면 그대로', formatBizNo('1234567890') === '123-45-67890' && formatBizNo('123-45-678') === '123-45-678')
check('H3 지역: 경기도 화성시 → 경기 화성시 · 서울특별시 강남구 → 서울 강남구', regionOf('경기도 화성시 동탄') === '경기 화성시' && regionOf('서울특별시 강남구 테헤란로 1') === '서울 강남구' && regionOf('') === '')

/* ---------------- 초안 ---------------- */
n = 0
const d = draftSite(full, { today, now, makeId })
const types = d.blocks.map((b) => b.type)
const footer = d.blocks.find((b) => b.type === 'footer')!
const contact = d.blocks.find((b) => b.type === 'contact')!
check('H4 꽉 찬 제조 업체 — 맨 위 줄이 처음 · 맨 아래 줄이 끝 · 첫 화면 · 소개 · 숫자 · 사업 · 인증 · 순서 · 질문 · 문의 · 연락처', types[0] === 'header' && types[types.length - 1] === 'footer' && ['hero', 'about', 'numbers', 'services', 'certs', 'process', 'faq', 'cta', 'contact'].every((t) => types.includes(t as never)), types)
check('H5 바닥 줄 = 업체 기록 그대로(상호 · 대표 · 사업자번호 하이픈 · 주소 · 대표 전화 · 메일)', footer.props.companyName === '한솔정밀(주)' && footer.props.representative === '김한솔' && footer.props.businessNumber === '123-45-67890' && footer.props.address === '경기도 화성시 동탄산단 6길 15' && footer.props.phone === '031-123-4567' && footer.props.email === 'hello@hansol.co.kr', footer.props)
check('H6 홈페이지 전화 = 회사 대표 전화(담당자 휴대폰은 저절로 안 넣음)', contact.props.phone === '031-123-4567' && !JSON.stringify(d).includes('010-9999-8888'))
const nums = d.blocks.find((b) => b.type === 'numbers')!.props.items as { value: string; label: string }[]
check('H7 숫자 = 사실만(업력 12년 · 직원 42명 · 인증 4건(3 + 연구소) · 특허 2건)', JSON.stringify(nums.map((x) => x.value)) === JSON.stringify(['12년', '42명', '4건', '2건']), nums)
const certs = (d.blocks.find((b) => b.type === 'certs')!.props.items as { name: string; detail: string }[]).map((x) => x.name)
check('H8 인증 목록 = 기록의 인증 3 + 기업부설연구소 + 특허 2', certs.length === 6 && certs.includes('이노비즈') && certs.includes('기업부설연구소') && certs.some((x) => x.includes('금형 냉각 구조')), certs)
const services = d.blocks.find((b) => b.type === 'services')!
check('H9 종목이 여럿이면 사업 카드 = 종목(견본 아님) · 견본 표시 없음', (services.props.items as { name: string }[]).map((x) => x.name).join('|') === '정밀 금속부품|금형|시제품 가공' && !services.sample, services)
const about = d.blocks.find((b) => b.type === 'about')!
check('H10 회사 소개 첫 문장은 사실로((주)는 조사 · 연도 · 지역 · 종목) · 둘째 문장은 견본 표시', String(about.props.body).startsWith('한솔정밀(주)는 2014년 경기 화성시에서 시작한 정밀 금속부품 전문 기업입니다.') && about.sample?.includes('body') === true, about.props.body)
check('H11 꾸밈 = 업종 색(제조 → 숲) · 검색 제목에 회사명', d.theme.palette === 'forest' && d.seo.title.startsWith('한솔정밀(주)'))

// 지어내지 않는다 — 빈 업체
n = 0
const empty = normalizeClientOps({ id: 'c-empty', companyName: '새업체' })
const de = draftSite(empty, { today, now, makeId })
check('H12 빈 업체 — 숫자 · 인증 블록 없음(지어내지 않음) · 연락처 칸 비어 있음', !de.blocks.some((b) => b.type === 'numbers' || b.type === 'certs') && de.blocks.find((b) => b.type === 'contact')!.props.phone === '', de.blocks.map((b) => b.type))
const ce = siteChecks(de)
check('H13 빈 업체 점검 — 연락 방법 없음(꼭) · 주소 · 사업자번호 · 대표 없음(확인)', ce.some((c) => c.key === 'reach' && c.level === 'must') && ce.some((c) => c.key === 'address') && ce.some((c) => c.key === 'bizno') && ce.some((c) => c.key === 'rep'), ce.map((c) => c.key))

// 후보(자료에서 찾았지만 확인 안 한 값)는 쓰지 않는다
const cand = normalizeClientOps({
  id: 'c-cand',
  companyName: '후보상사',
  factInbox: [{ id: 'x', key: 'certifications', value: '벤처기업', source: 'document', asOf: '', ref: 'r', foundAt: now }],
} as never)
check('H14 확인 안 한 후보(인증)는 홈페이지에 안 들어감', !JSON.stringify(draftSite(cand, { today, now, makeId })).includes('벤처기업'))

// 담당자 번호
const onlyContact = normalizeClientOps({ id: 'c-p', companyName: '담당상회', contactPhone: '010-1111-2222', contactEmail: 'a@b.kr' })
const dp = draftSite(onlyContact, { today, now, makeId })
const cp = siteChecks(dp, { contactPhone: '010-1111-2222' }).find((c) => c.key === 'phone')
check('H15 대표 전화가 없으면 점검이 [담당자 번호 넣기] 를 권함', cp?.fix === 'useContactPhone', cp)
const dp2 = withContactPhone(dp, '010-1111-2222', now)
check('H16 [담당자 번호 넣기] → 연락처 · 바닥 줄 전화 채움 · 점검에서 사라짐', dp2.blocks.filter((b) => b.props.phone === '010-1111-2222').length === 2 && !siteChecks(dp2, { contactPhone: '010-1111-2222' }).some((c) => c.key === 'phone'))

// 업종 9개 모두 초안 → 그려짐
const allInd = ['manufacturing', 'it', 'trade', 'food', 'health', 'professional', 'education', 'construction', 'design', 'consultant', 'general'] as const
const indRender = allInd.map((k) => ({ k, html: renderSiteHtml(draftSite(full, { today, now, makeId, industry: k })) }))
check('H17 업종 11개 모두 초안(D-220 개인 컨설턴트 포함) → HTML(<!doctype · 회사명 · 스크립트 0)', indRender.every((x) => x.html.startsWith('<!doctype html>') && x.html.includes('한솔정밀(주)') && !/<script/i.test(x.html)), indRender.filter((x) => !x.html.includes('한솔정밀')).map((x) => x.k))

/* ---------------- 그리기 ---------------- */
const html = renderSiteHtml(d)
const anchors = blockAnchors(d.blocks)
const menu = menuItems(d)
check('H18 메뉴 = 메뉴 이름 있는 블록 · 링크가 실제 id 로 감', menu.length >= 4 && menu.every((m) => html.includes(`id="${m.href.slice(1)}"`)), menu)
check('H19 같은 종류 블록 둘 → 앵커 #services · #services-2', (() => {
  const dd = duplicateBlock(d, services.id, 'dup1', now)
  const a = blockAnchors(dd.blocks)
  return a.get(services.id) === 'services' && a.get('dup1') === 'services-2'
})())
check('H20 연락처 블록 · 지도 링크(네이버 · 주소 인코딩) · 전화 tel:', html.includes('https://map.naver.com/p/search/') && html.includes('href="tel:0311234567"'))
check('H21 바닥 줄에 사업자등록번호 · 끄면 빠짐', html.includes('사업자등록번호 123-45-67890') && !renderSiteHtml(setProp(d, footer.id, 'showBusinessNumber', false, now)).includes('사업자등록번호 123-45-67890'))
const hid = setHidden(setHidden(d, about.id, 'mobile', true, now), services.id, 'pc', true, now)
const hidHtml = renderSiteHtml(hid)
check('H22 휴대폰 숨김 → class hide-m · PC 숨김 → hide-pc(PC 메뉴에서도 빠짐)', hidHtml.includes(`id="about" class="alt hide-m"`) || /id="about" class="[^"]*hide-m/.test(hidHtml) ? /id="services" class="[^"]*hide-pc/.test(hidHtml) && !menuItems(hid).some((m) => m.href === '#services') : false)
check('H23 미리보기: 블록마다 data-block · 고른 블록 테두리 · 밖 링크 막음 / 내려받기본엔 없음', renderSiteHtml(d, { preview: true, selectedId: about.id }).includes(`data-block="${about.id}"`) && renderSiteHtml(d, { preview: true, selectedId: about.id }).includes(`[data-block="${about.id}"]`) && !html.includes('data-block='))
check('H24 빈 블록은 그리지 않음(질문 0개 → 질문 블록 없음)', (() => {
  const faq = d.blocks.find((b) => b.type === 'faq')!
  const x = setProp(d, faq.id, 'items', [], now)
  return !hasContent(x.blocks.find((b) => b.id === faq.id)!) && !renderSiteHtml(x).includes('id="faq"')
})())

// 안전 — 링크 · 그림
check('H25 링크: https · tel · mailto · #앵커만 / javascript: · data: · 따옴표 섞인 주소는 막음', safeHref('https://a.kr/x?y=1') !== '' && safeHref('tel:0311234567') !== '' && safeHref('#about') !== '' && safeHref('javascript:alert(1)') === '' && safeHref('data:text/html,x') === '' && safeHref('https://a.kr/"onmouseover=1') === '' && safeHref('JaVaScRiPt:alert(1)') === '')
check('H26 그림: https · png/jpeg/webp/gif data URL 만 / svg data · javascript 막음', safeImage('https://a.kr/a.png') !== '' && safeImage('data:image/png;base64,iVBORw0KGgo=') !== '' && safeImage('data:image/svg+xml;base64,PHN2Zz4=') === '' && safeImage('javascript:alert(1)') === '' && safeImage("https://a.kr/a.png')") === '')

// 무작위 공격 글 — 어떤 칸에 무엇을 넣어도 HTML 이 깨지거나 스크립트가 생기지 않는다
const EVIL = ['<script>alert(1)</script>', '"><img src=x onerror=alert(1)>', "'><svg onload=alert(1)>", 'javascript:alert(1)', '</style><script>x</script>', '{{constructor}}', '&lt;b&gt;', '\u0000 줄', 'https://evil.kr/"onmouseover="x', 'data:text/html;base64,PHNjcmlwdD4=', '<iframe src=//x>', '한글 정상 문구', '`${x}`']
let seed = 7
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648), seed / 2147483648)
const pick = <T,>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)]
const evilBad: unknown[] = []
for (let i = 0; i < 600; i++) {
  let doc: SiteDoc = draftSite(full, { today, now, makeId, industry: pick(allInd) })
  for (const t of ['gallery', 'reviews', 'logos'] as BlockType[]) doc = insertBlock(doc, newBlock(t, full, doc.industry, today, makeId()), null, now)
  for (const b of doc.blocks) {
    for (const f of BLOCK_DEFS.find((x) => x.type === b.type)!.fields) {
      if (rnd() < 0.5) continue
      if (f.kind === 'list') doc = setProp(doc, b.id, f.key, [Object.fromEntries((f.itemFields ?? []).map((s) => [s.key, pick(EVIL)]))], now)
      else if (f.kind === 'toggle') doc = setProp(doc, b.id, f.key, rnd() < 0.5, now)
      else doc = setProp(doc, b.id, f.key, pick(EVIL), now)
    }
  }
  doc = { ...doc, seo: { title: pick(EVIL), description: pick(EVIL) } }
  const raw = renderSiteHtml(doc, { preview: rnd() < 0.5, selectedId: pick(doc.blocks).id })
  // 우리 그림 · 아이콘(art.ts — 사람이 적은 글 없음)만 빼고 본다: 그 밖의 <svg 는 하나도 없어야 한다
  const out = ALL_ART.reduce((acc, a) => acc.split(a).join(''), raw)
  const problems = [
    /<script/i.test(out) && 'script',
    /<(img|svg|iframe)[^>]*\son\w+=/i.test(out) && 'on-handler',
    /<iframe/i.test(out) && 'iframe',
    /<svg/i.test(out) && 'svg',
    /(href|src)="\s*(javascript|data:text)/i.test(out) && 'bad-url',
    /url\('(?!https?:|data:image\/)/.test(out) && 'bad-css-url',
    (out.match(/<style>/g) ?? []).length !== 1 && 'style-count',
    !out.trimEnd().endsWith('</html>') && 'tail',
  ].filter(Boolean)
  if (problems.length) {
    evilBad.push({ i, problems })
    if (evilBad.length > 3) break
  }
}
check('H27 무작위 600장 × 공격 글 13가지 — 스크립트 · on 이벤트 · iframe · svg · javascript: 링크 0 · <style> 하나 · 끝까지 그려짐', evilBad.length === 0, evilBad)

/* ---------------- 꾸밈 대비 ---------------- */
const contrastBad = PALETTES.flatMap((p) => {
  const pairs: [string, string, string, number][] = [
    ['단추 글자', p.onPrimary, p.primary, 4.5],
    ['본문', p.ink, '#ffffff', 7],
    ['흐린 글자', p.muted, '#ffffff', 4.5],
    ['흐린 글자(옅은 바탕)', p.muted, p.soft, 4.5],
    ['바닥 줄', p.footInk, p.footBg, 4.5],
    ['첫 화면 흰 글자', '#ffffff', p.heroTo, 4.5],
    ['첫 화면 단추(흰 바탕에 강조색)', p.primary, '#ffffff', 4.5],
  ]
  return pairs.filter(([, a, b, min]) => contrastRatio(a, b) < min).map(([name, a, b]) => `${p.key} ${name} ${contrastRatio(a, b).toFixed(2)}`)
})
check('H28 색 묶음 7개 × 글자/바탕 7쌍 — 모두 대비 기준 넘음', contrastBad.length === 0, contrastBad)

/* ---------------- 고치기 ---------------- */
const hdr = d.blocks[0]
check('H29 맨 위 줄은 못 내림 · 맨 아래 줄은 못 올림 · 첫 화면은 맨 위 줄 위로 못 감', moveBlock(d, hdr.id, 1, now) === d && moveBlock(d, footer.id, -1, now) === d && moveBlock(d, d.blocks[1].id, -1, now) === d)
const moved = moveBlock(d, about.id, 1, now)
check('H30 블록 한 칸 아래로', moved.blocks.findIndex((b) => b.id === about.id) === d.blocks.findIndex((b) => b.id === about.id) + 1)
check('H31 맨 위 · 맨 아래 줄은 복사 안 됨 · 다른 블록은 바로 아래에 복사', duplicateBlock(d, hdr.id, 'x', now) === d && duplicateBlock(d, about.id, 'x', now).blocks[d.blocks.findIndex((b) => b.id === about.id) + 1].id === 'x')
const ins = insertBlock(d, newBlock('history', full, 'manufacturing', today, 'h1'), null, now)
check('H32 블록 더하기(자리 안 고르면) → 맨 아래 줄 바로 위 · 연혁은 설립 연도로 첫 줄', ins.blocks[ins.blocks.length - 2].id === 'h1' && JSON.stringify(ins.blocks[ins.blocks.length - 2].props.items) === JSON.stringify([{ year: '2014', text: '한솔정밀(주) 설립' }]))
check('H33 맨 위 줄이 있는데 또 더하면 그대로 · 맨 위 줄 바로 다음(after=맨 위 줄)에 더하면 두 번째', insertBlock(d, newBlock('header', full, 'manufacturing', today, 'h2'), null, now) === d && insertBlock(d, newBlock('cta', full, 'manufacturing', today, 'c9'), hdr.id, now).blocks[1].id === 'c9')
const edited = setProp(d, about.id, 'body', '고친 소개', now)
check('H34 칸을 고치면 그 칸 견본 표시가 빠지고 점검에서 사라짐', !edited.blocks.find((b) => b.id === about.id)!.sample && !siteChecks(edited).some((c) => c.key === `sample-${about.id}`) && siteChecks(d).some((c) => c.key === `sample-${about.id}`))
check('H35 [업체와 확인했어요] → 견본 표시만 지움(글은 그대로)', (() => {
  const x = confirmSample(d, about.id, now)
  const b = x.blocks.find((y) => y.id === about.id)!
  return !b.sample && b.props.body === about.props.body
})())
check('H36 지우기 · 목록 더하기(상한) · 지우기 · 옮기기', removeBlock(d, about.id, now).blocks.length === d.blocks.length - 1 && listAdd([{ a: '1' }], { a: '' }, 1).length === 1 && listAdd([], { a: '' }, 3).length === 1 && listRemove([{ a: '1' }, { a: '2' }], 0)[0].a === '2' && listMove([{ a: '1' }, { a: '2' }], 0, 1)[0].a === '2')

/* ---------------- 저장본 읽기 ---------------- */
const round = normalizeSiteDoc(JSON.parse(JSON.stringify(d)))
check('H37 초안 → 저장 → 읽기 = 그대로', JSON.stringify(round) === JSON.stringify(d))
check('H38 엉뚱한 저장본 → null(배열 · 글 · blocks 없음)', normalizeSiteDoc(null) === null && normalizeSiteDoc('x') === null && normalizeSiteDoc({}) === null && normalizeSiteDoc([]) === null)
const dirty = normalizeSiteDoc({
  blocks: [
    { id: 'a', type: 'header', props: { logoText: 'x'.repeat(500), showMenu: 'yes', bogus: 1 } },
    { id: 'b', type: 'header', props: {} },
    { id: 'c', type: 'nope', props: {} },
    { id: 'a', type: 'about', props: {} },
    { id: 'd', type: 'hero', props: { buttonTarget: 'evil', align: 'center' }, hidePc: 'true', sample: ['title', 'zzz'] },
    { id: 'e', type: 'faq', props: { items: [{ q: 'q', a: 'a', z: 'z' }, 'str', null, ...Array.from({ length: 20 }, () => ({ q: 'x' }))] } },
  ],
  theme: { palette: 'red', font: 'comic', corner: 'pill' },
  seo: { title: 1 },
  industry: 'mars',
})
const dh = dirty?.blocks.find((b) => b.id === 'a')
const dhero = dirty?.blocks.find((b) => b.id === 'd')
const dfaq = dirty?.blocks.find((b) => b.id === 'e')
check(
  'H39 엉뚱한 칸 정리 — 머리 줄 하나 · 모르는 블록 · 겹친 id 버림 · 글 상한 · 켜고끄기는 true 만 · 고르기는 목록 값 · 목록 상한 · 모르는 칸 버림 · 꾸밈 기본값',
  !!dirty &&
    dirty.blocks.length === 3 &&
    String(dh?.props.logoText).length === 40 &&
    dh?.props.showMenu === false &&
    !('bogus' in (dh?.props ?? {})) &&
    dhero?.props.buttonTarget === 'contact' &&
    dhero?.props.align === 'center' &&
    !dhero?.hidePc &&
    JSON.stringify(dhero?.sample) === '["title"]' &&
    (dfaq?.props.items as unknown[]).length === 10 &&
    !('z' in ((dfaq?.props.items as Record<string, string>[])[0] ?? {})) &&
    dirty.theme.palette === 'navy' &&
    dirty.theme.font === 'sans' &&
    dirty.theme.corner === 'pill' &&
    dirty.industry === 'general',
  dirty,
)

/* ---------------- 점검 ---------------- */
const cd = siteChecks(d)
check('H40 꽉 찬 업체 점검 — 꼭 고칠 것 0 · 견본 문구 블록만 확인(첫 화면 · 소개 · 순서 · 질문 · 문의 · 연락처 운영 시간)', !cd.some((c) => c.level === 'must') && cd.filter((c) => c.key.startsWith('sample-')).length === 6, cd.map((c) => c.key))
const bad = setProp(setProp(d, about.id, 'image', 'ftp://x/y.png', now), d.blocks[1].id, 'buttonTarget', 'url', now)
const cb = siteChecks(bad)
check('H41 그림 주소 이상 · 단추 주소 없음 → 확인 항목', cb.some((c) => c.key === `img-${about.id}-image`) && cb.some((c) => c.key === `url-${d.blocks[1].id}`))
const both = setHidden(setHidden(d, about.id, 'pc', true, now), about.id, 'mobile', true, now)
check('H42 PC · 휴대폰 모두 숨김 → "어디에도 안 보여요"', siteChecks(both).some((c) => c.key === `hidden-${about.id}`))
check('H43 점검 순서 = 꼭 → 확인 → 참고', (() => {
  const r = siteChecks(de).map((c) => c.level)
  return r.join(',') === [...r].sort((a, b) => ['must', 'should', 'info'].indexOf(a) - ['must', 'should', 'info'].indexOf(b)).join(',')
})())

check('H44 내려받을 파일 이름 = 회사명-홈페이지.html(못 쓰는 글자 · 빈칸 뺌)', siteFileName(d) === '한솔정밀(주)-홈페이지.html' && siteFileName(setProp(d, footer.id, 'companyName', 'A/B: C*D', now)) === 'ABCD-홈페이지.html')
check('H45 블록 정의 15종(D-207 사진 모음 · 후기 · 로고) · 칸 이름 겹침 없음 · 목록 칸엔 줄 칸 정의', BLOCK_DEFS.length === 15 && BLOCK_DEFS.every((b) => new Set(b.fields.map((f) => f.key)).size === b.fields.length && b.fields.every((f) => f.kind !== 'list' || (f.itemFields?.length ?? 0) > 0)))

/* ---------------- D-205 모양 · 그림 · 업종 ---------------- */
n = 0
const shine = normalizeClientOps({
  id: 'c-shine',
  companyName: '(주)샤인디자인',
  representativeName: '권유진',
  businessCategory: '제조업',
  businessItem: '간판 및 광고물 제조업',
  businessAddress: '경기도 남양주시 진접읍 1',
  establishedAt: '2024-04-02',
  employeeCount: '3',
  companyPhone: '031-555-1234',
})
const sd = draftSite(shine, { today, now, makeId })
const sHero = sd.blocks.find((b) => b.type === 'hero')!
const sHtml = renderSiteHtml(sd)
check('H46 샤인디자인(간판 및 광고물 제조업) → 디자인 · 광고 견본(제조 문구 0) · 보라 색', sd.industry === 'design' && sd.theme.palette === 'violet' && !/제조 파트너|납기/.test(String(sHero.props.title) + String(sHero.props.subtitle)) && /간판/.test(String(sHero.props.title)), { industry: sd.industry, title: sHero.props.title })
check('H47 첫 화면 기본 = 글 + 그림 나란히 · 업종 그림 · 마지막 줄 강조 · 전화 단추 · 칩(설립 · 소재지 · 직원)', sHtml.includes('class="hero split"') && sHtml.includes(ALL_ART.find((a) => a === heroArt('design'))!) && sHtml.includes('<span class="hl">간판과 디자인</span>') && sHtml.includes('href="tel:0315551234"') && /<ul class="chips"><li><span>설립<\/span>2024년 4월<\/li><li><span>소재지<\/span>경기 남양주시<\/li><li><span>직원<\/span>3명<\/li><\/ul>/.test(sHtml), sHtml.slice(sHtml.indexOf('class="hero'), sHtml.indexOf('class="hero') + 400))
const bandDoc = setProp(sd, sHero.id, 'layout', 'band', now)
const bandHtml = renderSiteHtml(bandDoc)
check('H48 첫 화면 색 바탕 → 그림 없음 · class hero band · 칩은 그대로', bandHtml.includes('class="hero band"') && !bandHtml.includes('<svg class="art"') && bandHtml.includes('<ul class="chips">'))
const sSrv = sd.blocks.find((b) => b.type === 'services')!
const srvCount = (sSrv.props.items as unknown[]).length
check('H49 사업 카드 기본 = 아이콘 카드(카드마다 아이콘) · 번호 줄(01 …) · 글 카드(아이콘 0)', (sHtml.match(/<span class="icw"><svg class="ic"/g) ?? []).length === srvCount && renderSiteHtml(setProp(sd, sSrv.id, 'layout', 'rows', now)).includes('<ol class="rows"><li><em>01</em>') && !renderSiteHtml(setProp(sd, sSrv.id, 'layout', 'plain', now)).includes('class="icw"'), srvCount)
// 예전 저장본(모양 칸 없음) → 새 모양 · 칩은 꺼진 채(예전 화면에 없던 것을 저절로 켜지 않음)
const oldRaw = JSON.parse(JSON.stringify(d)) as { blocks: { type: string; props: Record<string, unknown> }[] }
for (const b of oldRaw.blocks) {
  delete b.props.layout
  delete b.props.showFacts
}
const oldDoc = normalizeSiteDoc(oldRaw)!
const oldHero = oldDoc.blocks.find((b) => b.type === 'hero')!
check('H50 예전 저장본(모양 칸 없음) → 첫 화면 나란히 · 사업 아이콘 카드 · 숫자 색 띠 · 칩은 꺼짐', oldHero.props.layout === 'split' && oldHero.props.showFacts === false && oldDoc.blocks.find((b) => b.type === 'services')!.props.layout === 'icons' && oldDoc.blocks.find((b) => b.type === 'numbers')!.props.layout === 'band' && !renderSiteHtml(oldDoc).includes('class="chips"'))
const fullHtml = renderSiteHtml(d)
check('H51 숫자 색 띠 = class numband · 번갈아 옅은 바탕은 띠를 세지 않음(소개 흰 → 사업 옅은)', fullHtml.includes('id="numbers" class="numband"') && fullHtml.includes('id="about" class=""') && fullHtml.includes('id="services" class="alt"'), /id="(about|services|numbers)" class="[^"]*"/g.exec(fullHtml)?.[0])
const artBad = ALL_ART.filter((a) => /\son\w+=|<text|href|<script|<foreignObject|url\(/i.test(a) || !a.startsWith('<svg class="'))
check('H52 그림 · 아이콘(업종 11 + 아이콘 18 · D-220 개인 컨설턴트 그림) — 이벤트 · 글자 · 링크 · 바깥 주소 0 · 업종마다 그림이 다름', artBad.length === 0 && ALL_ART.length === 29 && new Set(allInd.map((k) => heroArt(k))).size === allInd.length, artBad.length)
check('H53 로고 자리 글자 — (주)샤인디자인 → 샤 · 한솔정밀(주) → 한', sHtml.includes('<span class="mark" aria-hidden="true">샤</span>') && fullHtml.includes('<span class="mark" aria-hidden="true">한</span>'))
check('H54 구역 머리글(ABOUT · BUSINESS · PROCESS · FAQ · CONTACT) — 고정 글', ['ABOUT', 'BUSINESS', 'PROCESS', 'FAQ', 'CONTACT'].every((k) => fullHtml.includes(`<p class="kicker">${k}</p>`)))

/* ---------------- D-207 식스샵 회사 템플릿에서 얻은 것 ---------------- */
n = 0
const gd = draftSite(full, { today, now, makeId })
const gAbout = gd.blocks.find((b) => b.type === 'about')!
const gSrv = gd.blocks.find((b) => b.type === 'services')!
const gHero = gd.blocks.find((b) => b.type === 'hero')!
const gContact = gd.blocks.find((b) => b.type === 'contact')!
const gFaq = gd.blocks.find((b) => b.type === 'faq')!
const withBg = BLOCK_DEFS.filter((b) => b.fields.some((f) => f.key === 'bg')).map((b) => b.type)
check('H55 바탕 칸 — 내용 블록 10종에만 · 늘 맨 끝 칸 · 첫 값 자동 / 머리 · 첫 화면 · 숫자 · 문의 띠 · 바닥에는 없음', withBg.length === 10 && BLOCK_DEFS.every((b) => !b.fields.some((f) => f.key === 'bg') || b.fields[b.fields.length - 1].key === 'bg') && ['header', 'hero', 'numbers', 'cta', 'footer'].every((t) => !withBg.includes(t as BlockType)) && gAbout.props.bg === 'auto', withBg)
const darkDoc = setProp(gd, gAbout.id, 'bg', 'dark', now)
const darkHtml = renderSiteHtml(darkDoc)
const whiteHtml = renderSiteHtml(setProp(gd, gAbout.id, 'bg', 'white', now))
check('H56 바탕 고르기 — 어둡게 → class bg-dark · 다음 자동 블록은 흰 바탕 / 흰색 → 다음 자동 블록은 옅은 바탕 / 엉뚱한 값은 자동', darkHtml.includes('id="about" class="bg-dark"') && darkHtml.includes('id="services" class=""') && whiteHtml.includes('id="about" class="bg-white"') && whiteHtml.includes('id="services" class="alt"') && renderSiteHtml(setProp(gd, gAbout.id, 'bg', 'x" onclick="y', now)).includes('id="about" class=""') && normalizeSiteDoc({ ...gd, blocks: [{ ...gAbout, props: { ...gAbout.props, bg: 'neon' } }] })!.blocks[0].props.bg === 'auto')
const brandBad = PALETTES.flatMap((p) => [['흰 글자 · 꾸밈 색 바탕', '#ffffff', p.primary], ['흰 글자 · 어두운 바탕', '#ffffff', p.footBg], ['흐린 글자 · 옅은 회색', p.muted, '#f5f6f8'], ['본문 · 옅은 회색', p.ink, '#f5f6f8']].filter(([, a, b]) => contrastRatio(a, b) < 4.5).map(([name, a, b]) => `${p.key} ${name} ${contrastRatio(a, b).toFixed(2)}`))
check('H57 새 바탕 대비 — 색 묶음 7개 × (꾸밈 색 · 어둡게 · 옅은 회색) 모두 4.5:1 넘음', brandBad.length === 0, brandBad)
const photoDoc = setProp(setProp(gd, gHero.id, 'layout', 'photo', now), gHero.id, 'image', 'https://cdn.example.kr/hero.jpg', now)
const photoHtml = renderSiteHtml(photoDoc)
const photoNoImg = setProp(gd, gHero.id, 'layout', 'photo', now)
check('H58 첫 화면 사진 가득 — class hero photo · 사진 깔림 · 전화 단추 · 공유 사진(og:image) / 사진 없으면 색 바탕 + 점검 알림', photoHtml.includes(`class="hero photo" style="background-image:url('https://cdn.example.kr/hero.jpg')"`) && photoHtml.includes('<a class="btn line" href="tel:') && photoHtml.includes('<meta property="og:image" content="https://cdn.example.kr/hero.jpg">') && renderSiteHtml(photoNoImg).includes('class="hero band"') && siteChecks(photoNoImg).some((c) => c.key === `photo-${gHero.id}`) && !renderSiteHtml(gd).includes('og:image'))
const png = 'data:image/png;base64,iVBORw0KGgo='
const gal0 = newBlock('gallery', full, 'construction', today, 'g1')
check('H59 사진 모음 새로 더하기 — 빈 칸 3개 · 제목은 업종 말(시공 사례) · 견본 글 0 · 채우기 전엔 안 나옴', (gal0.props.items as unknown[]).length === 3 && gal0.props.title === '시공 사례' && !gal0.sample && !hasContent(gal0))
let galDoc = insertBlock(gd, gal0, gSrv.id, now)
galDoc = setProp(galDoc, 'g1', 'items', [{ image: png, title: '동탄 욕실', desc: '3일 시공' }, { image: '', title: '망원 주방', desc: '' }, { image: 'javascript:alert(1)', title: '', desc: '' }], now)
const galHtml = renderSiteHtml(galDoc)
check('H60 사진 모음 격자 — 비율 4:3 · 사진 1장 · 사진 없는 칸은 아이콘 자리 · 나쁜 주소는 빠짐 · 점검 "사진 없는 칸 2개" · 메뉴에 사례', galHtml.includes('<div class="gal" style="--ar:4/3">') && (galHtml.match(/<div class="gm"><img src="data:image\/png/g) ?? []).length === 1 && (galHtml.match(/<span class="gph"/g) ?? []).length === 2 && !galHtml.includes('javascript:') && siteChecks(galDoc).some((c) => c.key === 'gallery-g1' && c.text.includes('2개')) && siteChecks(galDoc).some((c) => c.key === 'img-g1-items') && menuItems(galDoc).some((m) => m.label === '시공 사례' && m.href === '#works'))
const zzHtml = renderSiteHtml(setProp(setProp(galDoc, 'g1', 'layout', 'zigzag', now), 'g1', 'ratio', '16:9', now))
check('H61 사진 모음 번갈아 · 비율 16:9 · 엉뚱한 비율은 4:3', zzHtml.includes('<div class="zz" style="--ar:16/9">') && zzHtml.includes('<div class="zt"><em>01</em><h3>동탄 욕실</h3>') && renderSiteHtml(setProp(galDoc, 'g1', 'ratio', '"><b>', now)).includes('--ar:4/3'))
const galRound = normalizeSiteDoc(JSON.parse(JSON.stringify(galDoc)))!
const galBlk = galRound.blocks.find((b) => b.id === 'g1')!
check('H62 사진 모음 저장 → 읽기 그대로 · 목록 안 사진도 저장 공간 셈 · 너무 큰 사진 · 글 아닌 값은 버림', JSON.stringify(galRound) === JSON.stringify(galDoc) && imageChars(galDoc) === png.length && (normalizeSiteDoc({ ...galDoc, blocks: [{ ...galBlk, props: { ...galBlk.props, items: [{ image: 'data:image/png;base64,' + 'A'.repeat(700_000), title: 'x' }, { image: 42, title: 'y' }] } }] })!.blocks[0].props.items as { image: string }[]).every((it) => it.image === ''))
const rv0 = newBlock('reviews', full, 'construction', today, 'r1')
let rvDoc = insertBlock(gd, rv0, gSrv.id, now)
check('H63 고객 후기 새로 더하기 — 지어낸 후기 0(빈 칸) · 채우기 전엔 안 나옴', !hasContent(rv0) && JSON.stringify(rv0.props.items) === JSON.stringify([{ text: '', name: '', meta: '' }]) && !renderSiteHtml(rvDoc).includes('class="rev"'))
rvDoc = setProp(rvDoc, 'r1', 'items', [{ text: '꼼꼼하게 해 주셨어요\n추천해요', name: '김○○ 님', meta: '네이버 리뷰 · 욕실' }], now)
const rvHtml = renderSiteHtml(rvDoc)
check('H64 고객 후기 — 카드 · 줄바꿈 · 이름 · 받은 곳 · 점검에 "실제 고객 글만" 안내 · 메뉴에 후기', rvHtml.includes('<figure class="rev"><span class="qm" aria-hidden="true">“</span><blockquote>꼼꼼하게 해 주셨어요<br>추천해요</blockquote><figcaption><b>김○○ 님</b><span>네이버 리뷰 · 욕실</span></figcaption></figure>') && siteChecks(rvDoc).some((c) => c.key === 'reviews-r1' && c.text.includes('실제 고객')) && menuItems(rvDoc).some((m) => m.href === '#reviews'))
let lgDoc = insertBlock(gd, newBlock('logos', full, 'manufacturing', today, 'l1'), null, now)
lgDoc = setProp(lgDoc, 'l1', 'items', [{ name: '현대모비스', image: '' }, { name: '삼성전자', image: png }], now)
const lgHtml = renderSiteHtml(lgDoc)
check('H65 거래처 로고 — 흑백 기본 · 로고 없으면 이름 글자 · 로고는 그림 · 흑백 끄면 색 그대로', lgHtml.includes('<ul class="logos gray"><li><span>현대모비스</span></li><li><img src="data:image/png') && renderSiteHtml(setProp(lgDoc, 'l1', 'gray', false, now)).includes('<ul class="logos">'))
let ctDoc = setProp(gd, gContact.id, 'kakaoUrl', 'https://pf.kakao.com/_abc', now)
ctDoc = setProp(ctDoc, gContact.id, 'formUrl', 'https://form.naver.com/response/xyz', now)
const ctHtml = renderSiteHtml(ctDoc)
check('H66 연락처 단추 — 전화하기 · 카카오톡 상담(노란) · 상담 신청하기 · 지도, 새 창은 noopener', ctHtml.includes('<div class="cbtns"><a class="btn" href="tel:0311234567">전화하기</a><a class="btn kakao" href="https://pf.kakao.com/_abc" target="_blank" rel="noopener">카카오톡 상담</a><a class="btn line" href="https://form.naver.com/response/xyz" target="_blank" rel="noopener">상담 신청하기</a><a class="btn ghost"'), ctHtml.slice(ctHtml.indexOf('cbtns'), ctHtml.indexOf('cbtns') + 300))
const badCt = setProp(setProp(gd, gContact.id, 'kakaoUrl', 'http://pf.kakao.com/_abc', now), gContact.id, 'formUrl', 'javascript:alert(1)', now)
check('H67 카카오톡 · 신청서는 https 만 — http · javascript 는 단추 없음 + 점검 알림', !renderSiteHtml(badCt).includes('카카오톡 상담') && !renderSiteHtml(badCt).includes('상담 신청하기') && ['kakaoUrl', 'formUrl'].every((k) => siteChecks(badCt).some((c) => c.key === `${k}-${gContact.id}`)))
const fbHtml = renderSiteHtml(gd)
check('H68 휴대폰 고정 단추 — 대표 전화가 있으면 처음부터 켬 · 전화 걸기 + 오시는 길 · body has-fbar / 카카오톡 있으면 카카오톡 · 끄면 없음 · 연락처를 휴대폰에서 숨기면 없음', gContact.props.floatBar === true && fbHtml.includes('<body id="top" class="has-fbar">') && fbHtml.includes('<nav class="fbar" aria-label="빠른 연락"><a class="fb-tel" href="tel:0311234567">전화 걸기</a><a class="fb-2" href="#contact">오시는 길</a></nav>') && ctHtml.includes('<a class="fb-2 kakao" href="https://pf.kakao.com/_abc"') && !renderSiteHtml(setProp(gd, gContact.id, 'floatBar', false, now)).includes('class="fbar"') && !renderSiteHtml(setHidden(gd, gContact.id, 'mobile', true, now)).includes('class="fbar"'))
const faqHtml = renderSiteHtml(gd)
const faqN = (gFaq.props.items as unknown[]).length
check('H69 자주 묻는 질문 — 하나를 열면 나머지 닫힘(같은 name) · 첫 질문만 열려 있음', (faqHtml.match(/<details name="faq"/g) ?? []).length === faqN && (faqHtml.match(/<details name="faq" open>/g) ?? []).length === 1)
check('H70 머리 정보 — og:locale ko_KR · theme-color = 꾸밈 색 · 탭 아이콘(로고 첫 글자, 부호화 · <svg 그대로 0)', fbHtml.includes('<meta property="og:locale" content="ko_KR">') && fbHtml.includes(`<meta name="theme-color" content="${paletteOf(gd.theme.palette).primary}">`) && /<link rel="icon" href="data:image\/svg\+xml,%3Csvg[^"]*%ED%95%9C/.test(fbHtml))
const noHero = removeBlock(gd, gHero.id, now)
const twoHero = insertBlock(gd, newBlock('hero', full, 'manufacturing', today, 'h9'), null, now)
check('H71 큰 제목(h1) 점검 — 첫 화면 없으면 알림 · 둘이면 "하나가 좋아요" · 하나면 조용', siteChecks(noHero).some((c) => c.key === 'h1' && c.level === 'should') && siteChecks(twoHero).some((c) => c.key === 'h1' && c.level === 'info') && !siteChecks(gd).some((c) => c.key === 'h1'))
const oldRaw7 = JSON.parse(JSON.stringify(gd)) as { blocks: { props: Record<string, unknown> }[] }
for (const b of oldRaw7.blocks) for (const k of ['bg', 'kakaoUrl', 'formUrl', 'floatBar']) delete b.props[k]
const old7 = normalizeSiteDoc(oldRaw7)!
const old7Html = renderSiteHtml(old7)
check('H72 예전 저장본(D-206 이전) → 바탕 자동 · 카카오톡 · 신청서 빈칸 · 고정 단추 꺼짐(예전 화면에 없던 것을 저절로 켜지 않음)', old7.blocks.every((b) => !('bg' in b.props) || b.props.bg === 'auto') && !old7Html.includes('class="fbar"') && !old7Html.includes('class="bg-') && !old7Html.includes('카카오톡 상담'))
const darkCount = [gAbout, gSrv, gFaq].reduce((doc, b) => setProp(doc, b.id, 'bg', 'dark', now), gd)
check('H73 진한 바탕이 셋 이상이면 "한두 곳만" 참고 알림', siteChecks(darkCount).some((c) => c.key === 'dark') && !siteChecks(darkDoc).some((c) => c.key === 'dark'))

/* ---------------- D-208 디자인 한 번에 · 점수 · 업종 맞춤 블록 ---------------- */
check('H74 스타일 6가지 — 이름 · 색 · 업종 추천은 모두 있는 스타일 · 색 묶음은 표에 있는 것만', STYLE_PRESETS.length === 6 && new Set(STYLE_PRESETS.map((x) => x.key)).size === 6 && Object.values(INDUSTRY_STYLE).every((k) => STYLE_PRESETS.some((x) => x.key === k)) && STYLE_PRESETS.every((x) => PALETTES.some((p) => p.key === x.palette)))
const textOf = (doc: SiteDoc) => JSON.stringify(doc.blocks.map((b) => Object.fromEntries(Object.entries(b.props).filter(([k]) => !['layout', 'align', 'bg'].includes(k)))))
const before208 = JSON.stringify(gd)
const warm = applyStylePreset(gd, 'warm', now)
const wHero = warm.blocks.find((b) => b.type === 'hero')!
const wSrv = warm.blocks.find((b) => b.type === 'services')!
check('H75 스타일 바꾸기 — 꾸밈(노을 · 아주 둥글게) · 사업 카드 모양 · 바탕 흐름이 바뀌고, 글 · 사진 · 순서 · 견본 표시는 그대로 · 원래 문서는 안 바뀜', warm.theme.palette === 'sunset' && warm.theme.corner === 'pill' && wSrv.props.layout === 'icons' && warm.blocks.find((b) => b.type === 'about')?.props.bg === 'tint' && textOf(warm) === textOf(gd) && warm.blocks.map((b) => `${b.id}:${(b.sample ?? []).join()}`).join() === gd.blocks.map((b) => `${b.id}:${(b.sample ?? []).join()}`).join() && JSON.stringify(gd) === before208 && currentStyle(warm) === 'warm')
const withPhoto = applyStylePreset(setProp(gd, gHero.id, 'image', 'https://example.com/a.jpg', now), 'bold', now)
check("H76 '사진 가득' 스타일 — 사진이 없으면 색 바탕으로(빈 사진 경고 0) · 사진이 있으면 사진 가득", wHero.props.layout === 'band' && !siteChecks(warm).some((c) => c.key.startsWith('photo-')) && withPhoto.blocks.find((b) => b.type === 'hero')?.props.layout === 'photo')
const presetBad: unknown[] = []
for (const ind of allInd) {
  const base = draftSite(full, { today, now, makeId, industry: ind })
  for (const sp of STYLE_PRESETS) {
    const out = applyStylePreset(base, sp.key, now)
    const html = renderSiteHtml(out)
    if (siteChecks(out).some((c) => c.key === 'dark' || c.key.startsWith('photo-')) || !html.includes('<h1') || currentStyle(out) !== sp.key || JSON.stringify(applyStylePreset(out, sp.key, now)) !== JSON.stringify(out) || JSON.stringify(normalizeSiteDoc(JSON.parse(JSON.stringify(out)))?.blocks) !== JSON.stringify(out.blocks)) presetBad.push({ ind, sp: sp.key })
  }
}
check(`H77 업종 ${allInd.length} × 스타일 6 — 진한 바탕 세 곳 넘음 0 · 빈 사진 경고 0 · h1 · 두 번 눌러도 같음 · 저장본 읽기 그대로`, presetBad.length === 0, presetBad.slice(0, 3))
const sc = siteScore(gd)
const scE = siteScore(de)
check('H78 홈페이지 점수 — 11가지 합 100점 · 0~100 · 빈 업체 < 꽉 찬 업체 · 이것만 하면 = 아직인 것 중 큰 점수 셋', sc.items.reduce((a, it) => a + it.points, 0) === 100 && sc.items.length === 11 && sc.score >= 0 && sc.score <= 100 && scE.score < sc.score && sc.next.length <= 3 && sc.next.every((it) => !it.done) && sc.next.every((it, i, all) => i === 0 || all[i - 1].points >= it.points) && sc.items.filter((it) => !it.done && !sc.next.includes(it)).every((it) => it.points <= (sc.next.at(-1)?.points ?? 0)), { score: sc.score, empty: scE.score, next: sc.next.map((x) => `${x.key}+${x.points}`) })
const gGal = newBlock('gallery', full, 'manufacturing', today, 'gal1')
let up = insertBlock(gd, gGal, null, now)
up = setProp(up, 'gal1', 'items', [1, 2, 3].map((i) => ({ image: `https://example.com/${i}.jpg`, title: `사진 ${i}`, desc: '' })), now)
const scUp = siteScore(up)
check('H79 실제 사진 3장(사진 모음) → +15점 · 그 항목 끝남', scUp.items.find((x) => x.key === 'photos')?.done === true && scUp.score - sc.score === 15 && !sc.items.find((x) => x.key === 'photos')?.done, { before: sc.score, after: scUp.score })
const confirmed = gd.blocks.filter((b) => b.sample?.length).reduce((doc, b) => confirmSample(doc, b.id, now), gd)
check('H80 견본 모두 확인 → 견본 항목 끝남 · 아직 남은 견본 블록을 누르면 그 블록', siteScore(confirmed).items.find((x) => x.key === 'sample')?.done === true && gd.blocks.some((b) => b.id === sc.items.find((x) => x.key === 'sample')?.open.blockId))
check('H81 누르면 열 곳 — 블록이 있으면 그 블록(문서에 있는 id) · 없으면 블록 더하기 · 검색 정보는 꾸밈 탭', sc.items.every((it) => (it.open.blockId ? gd.blocks.some((b) => b.id === it.open.blockId) : true)) && sc.items.find((x) => x.key === 'seo')?.open.tab === 'style' && siteScore(removeBlock(gd, gHero.id, now)).items.find((x) => x.key === 'hero')?.open.add === 'hero')
const con = draftSite(full, { today, now, makeId, industry: 'construction' })
const conSug = blockSuggestions(con).map((x) => x.type)
const conAfter = blockSuggestions(insertBlock(con, newBlock('gallery', full, 'construction', today, 'cg'), null, now)).map((x) => x.type)
const healthSug = blockSuggestions(draftSite(full, { today, now, makeId, industry: 'health' })).map((x) => x.type)
check('H82 업종 맞춤 블록 — 건설은 사진 모음 · 후기 · 넣으면 빠짐 · 병의원은 후기 권하지 않음 · 이유 한 줄', conSug.includes('gallery') && conSug.includes('reviews') && !conAfter.includes('gallery') && !healthSug.includes('reviews') && allInd.every((k) => blockSuggestions(draftSite(full, { today, now, makeId, industry: k })).every((x) => x.why.length > 10)), { conSug, conAfter, healthSug })

/* ---------------- D-208 고침 — 믿음 기록 열 곳 ---------------- */
const noTrust = (doc: SiteDoc) => doc.blocks.filter((b) => !['certs', 'numbers', 'reviews', 'logos', 'history'].includes(b.type)).reduce((d0, b) => d0, { ...doc, blocks: doc.blocks.filter((b) => !['certs', 'numbers', 'reviews', 'logos', 'history'].includes(b.type)) })
const hNo = noTrust(draftSite(full, { today, now, makeId, industry: 'health' }))
const mNo = noTrust(draftSite(full, { today, now, makeId, industry: 'manufacturing' }))
const withEmptyRev = insertBlock(mNo, newBlock('reviews', full, 'manufacturing', today, 'rv1'), null, now)
const trustOf = (d: SiteDoc) => siteScore(d).items.find((x) => x.key === 'trust')!
check('H83 믿음 기록이 없으면 업종에 맞는 블록 더하기(병의원 = 인증 · 후기 아님 · 제조 = 거래처) · 빈 후기 블록이 이미 있으면 그것을 엶(겹쳐 넣지 않음)', trustOf(hNo).open.add === 'certs' && trustOf(mNo).open.add === 'logos' && trustOf(withEmptyRev).open.blockId === 'rv1' && !trustOf(withEmptyRev).open.add, [trustOf(hNo).open, trustOf(mNo).open, trustOf(withEmptyRev).open])

/* ---------------- D-220 잠재고객 · 동료 컨설턴트 · 가상 업체 · 임시등록 ---------------- */
{
  const at = '2026-10-17T03:00:00.000Z'
  const sample = (key: string): TrialProfile => {
    const sm = TRIAL_SAMPLES.find((x) => x.key === key)!
    return normalizeTrial({ id: `trial_${key}000001`, kind: sm.kind, ...sm.fill, createdAt: at, updatedAt: at })!
  }
  const cons = sample('consultant')
  const bakery = sample('bakery')
  const consRec = trialRecord(cons)
  const consDoc = draftSite(consRec, { today, now, makeId })
  const consHtml = renderSiteHtml(consDoc)
  check('D220-1 동료 컨설턴트(가상) → 개인 컨설턴트 견본 · 이름 · 전문 분야 · 그려짐(스크립트 0)', consDoc.industry === 'consultant' && consHtml.includes('정다온 경영컨설턴트') && consHtml.includes('도와드리는 일') && !/<script/i.test(consHtml), consDoc.industry)
  const bakeDoc = draftSite(trialRecord(bakery), { today, now, makeId })
  const bf = siteFacts(trialRecord(bakery), today)
  check('D220-2 가상 업체(빵집) → 음식 견본 · 대표 · 주소 · 전화 · 지역 · 종목이 업체 정보 자리에(지어낸 숫자 0)', bakeDoc.industry === 'food' && bf.representative === '김봄날' && bf.address.includes('수원시') && bf.phone === '031-123-4567' && bf.region !== '' && bf.item.includes('빵') && bf.employees === null && bf.years === null, { ind: bakeDoc.industry, bf })
  check('D220-3 가상 업체는 계약 전(잠재) · 컨설턴트는 컨설턴트 고객 표시 · 업체는 표시 없음', consRec.status === 'waiting' && consRec.clientType === 'consultant' && trialRecord(bakery).clientType === undefined)
  check('D220-4 컨설턴트 고객 기록은 업종 글과 상관없이 개인 컨설턴트 견본 · 회사 업종 글 "경영컨설팅업" 은 그대로 전문 서비스 · "컨설턴트" 라고 적으면 개인 컨설턴트',
    industryForRecord(normalizeClientOps({ id: 'c1', companyName: '김세무', industry: '세무사무소', clientType: 'consultant' })) === 'consultant' && industryOf('경영컨설팅업') === 'professional' && industryOf('정책자금 컨설턴트') === 'consultant')
  check('D220-5 가상 프로필 읽기 — 이름 없으면 · 가상 id 아니면 버림 · 칸 길이 자름 · 옮기기 끝(registeredAt)은 업체 id 가 있을 때만',
    normalizeTrial({ id: 'trial_x1', name: '' }) === null && normalizeTrial({ id: 'cli_1', name: '가' }) === null && normalizeTrial({ id: 'trial_x1', name: '가'.repeat(80) })!.name.length === 60 && normalizeTrial({ id: 'trial_x1', name: '가', registeredAt: at })!.registeredAt === undefined && normalizeTrial({ id: 'trial_x1', name: '가', registeredClientId: 'cli_9', registeredAt: at })!.registeredAt === at)
  const sr = subjectRow(cons.id, { doc: 1 })
  const adopted = adoptRow({ id: 'row1', ...sr }, 'cli_new')
  check('D220-6 저장 줄 — 가상은 업체 칸 비우고 내용에 가상 id(클라우드 외래 키 때문) · 누구 것인지 읽힘 · 임시등록 때 업체 줄로(가상 id 빠짐) · 진짜 업체는 그대로',
    sr.clientId === '' && sr.data.trialId === cons.id && rowSubjectId(sr) === cons.id && adopted.clientId === 'cli_new' && adopted.id === 'row1' && !('trialId' in adopted.data) && adopted.data.doc === 1 && subjectRow('cli_1', { doc: 1 }).clientId === 'cli_1' && !('trialId' in subjectRow('cli_1', { doc: 1 }).data) && rowSubjectId({ clientId: 'cli_1', data: {} }) === 'cli_1')
  check('D220-7 도구 사이 이동 주소 — 가상은 ?trial= · 업체는 ?client=', subjectQuery(cons.id) === `trial=${cons.id}` && subjectQuery('cli_1') === 'client=cli_1' && isTrialId(cons.id) && !isTrialId('cli_1') && !isTrialId('trial_'))
  const reg = registerInput({ ...bakery, requestedBy: '최동료' })
  const base = normalizeClientOps({ id: 'cli_new', companyName: reg.companyName, contactName: reg.contactName, contactPhone: reg.contactPhone, industry: reg.industry, status: reg.status })
  const det = withTrialDetails(base, { ...bakery, requestedBy: '최동료' }, at)
  const round = normalizeClientOps(JSON.parse(JSON.stringify(det)))
  check('D220-8 임시등록 — 잠재고객(계약 전) · 대표 · 주소 · 종목 채움 · 임시등록 표시 · 부탁한 사람 · 기록 한 줄 · 저장 → 읽기에도 표시 남음 · 표시 지우면 사라짐',
    reg.status === 'waiting' && reg.clientType === undefined && registerInput(cons).clientType === 'consultant' && det.representativeName === '김봄날' && det.businessAddress.includes('수원') && det.businessItem.includes('빵') && det.provisional?.requestedBy === '최동료' && det.activity[0].text.includes('임시등록') && round.provisional?.at === at && withoutProvisional(round).provisional === undefined,
    { prov: det.provisional, act: det.activity[0]?.text })
  check('D220-9 이상한 임시등록 표시는 버림(시각 없음)', normalizeClientOps({ id: 'c2', companyName: 'x', provisional: { from: 'marketing' } as never }).provisional === undefined)
  const clients = [normalizeClientOps({ id: 'a', companyName: '(주)봄날 베이커리' }), normalizeClientOps({ id: 'b', companyName: '한결정밀', archivedAt: at })]
  check('D220-10 같은 이름 업체 알아보기 — (주) · 띄어쓰기 무시 · 보관한 업체는 아님', sameNameClient(clients, '봄날베이커리')?.id === 'a' && sameNameClient(clients, '한결정밀') === null && sameNameClient(clients, '') === null)
  const sampleDocs = TRIAL_SAMPLES.map((sm) => draftSite(trialRecord(sample(sm.key)), { today, now, makeId }))
  check('D220-11 예시 4가지 모두 초안 · 업종이 맞게(빵집 음식 · 공장 제조 · 학원 교육 · 컨설턴트 개인 컨설턴트)', sampleDocs.map((d) => d.industry).join() === 'food,manufacturing,education,consultant', sampleDocs.map((d) => d.industry))
  const heroOf = (d: SiteDoc) => String(d.blocks.find((b) => b.type === 'hero')?.props.title ?? '')
  const cafeDoc = draftSite(normalizeClientOps({ id: 'c3', companyName: '정다방', businessCategory: '휴게음식점', businessItem: '커피 전문점' }), { today, now, makeId })
  const dineDoc = draftSite(normalizeClientOps({ id: 'c4', companyName: '한솥밥', businessCategory: '일반음식점', businessItem: '한식' }), { today, now, makeId })
  check('D220-12 음식 견본 큰 문구 — 빵집은 굽는 말 · 카페는 한 잔 · 식당은 그대로 한 그릇',
    !heroOf(sampleDocs[0]).includes('그릇') && heroOf(sampleDocs[0]).includes('굽') && heroOf(cafeDoc).includes('한 잔') && heroOf(dineDoc).includes('한 그릇'), [heroOf(sampleDocs[0]), heroOf(cafeDoc), heroOf(dineDoc)])
  check('D220-13 인테리어 디자인 · 시공 → 공사 견본(간판 아님) · 간판 디자인 · 실내 인테리어 간판은 디자인 · PCB 는 제조',
    industryOf('실내 인테리어 디자인 시공') === 'construction' && industryOf('인테리어 디자인') === 'construction' && industryOf('간판 디자인') === 'design' && industryOf('인테리어 간판 제작') === 'design' && industryOf('인쇄회로기판 제조') === 'manufacturing')
  const descOf = (phone: string) => draftSite(normalizeClientOps({ id: 'c5', companyName: '가나상사', companyPhone: phone, businessItem: '도매' }), { today, now, makeId }).seo.description
  check('D220-15 소개 글 조사 — 끝자리 0 은 "으로" · 7 은 "로" · 번호 없으면 홈페이지 연락처로 · 전화 링크는 여러 번호 중 첫 번호만(이어 붙이지 않음)',
    descOf('02-123-4560').includes('4560으로') && descOf('031-123-4567').includes('4567로') && descOf('').includes('홈페이지 연락처로') && telHref('02-123-4567~8') === 'tel:021234567' && telHref('031-111-2222, 010-3333-4444') === 'tel:0311112222' && telHref('(02) 123-4567') === 'tel:021234567' && telHref('+82 10 1234 5678') === 'tel:+821012345678',
    [descOf('02-123-4560'), telHref('02-123-4567~8')])
  check('D220-14 가상 업체 업종은 업태 칸으로(회사 기본 정보에 보임) · 임시등록 때도 업태 채움 · 이미 있는 업태는 그대로',
    trialRecord(bakery).businessCategory === '베이커리 카페' && det.businessCategory === '베이커리 카페' && withTrialDetails({ ...base, businessCategory: '음식점업' }, bakery, at).businessCategory === '음식점업')
}

/* ---------------- D-237 홍보 글 만들기의 홍보 정보 → 홈페이지 빈 칸 ---------------- */
{
  // 홍보 글 만들기에 저장된 모양(고친 칸) 그대로 — 이상한 칸 · 빈 칸은 버린다
  const promo = promoForSite({ phone: ' 031-555-0000 ', hours: '평일 9시~6시 · 토 10시~2시', reviews: '네이버 후기 320개 · 평점 4.9', reviewSource: '네이버 플레이스', voice: '“아이가 매일 가고 싶어 해요”', price: '안 씀', junk: 1 })
  check('D237-1 홍보 정보 → 홈페이지에 쓸 다섯 칸만(전화 · 영업시간 · 후기 수 · 받은 곳 · 한마디)', JSON.stringify(Object.keys(promo).sort()) === JSON.stringify(['hours', 'phone', 'reviewSource', 'reviews', 'voice']) && promo.phone === '031-555-0000' && promoForSite(null).phone === undefined, promo)
  const noPhone = normalizeClientOps({ id: 'p1', companyName: '해솔수학', businessCategory: '교육 서비스업', businessItem: '입시 학원', contactPhone: '010-1111-2222' })
  const pd = draftSite(noPhone, { today, now, makeId, promo })
  const pc = pd.blocks.find((b) => b.type === 'contact')
  const pf = pd.blocks.find((b) => b.type === 'footer')
  const pr = pd.blocks.find((b) => b.type === 'reviews')
  check('D237-2 대표 전화가 없으면 홍보 글에 적은 전화 — 연락처 · 바닥 · 고정 단추 · 소개 글(담당자 휴대폰은 여전히 안 넣음)', pc?.props.phone === '031-555-0000' && pf?.props.phone === '031-555-0000' && pc?.props.floatBar === true && pd.seo.description.includes('031-555-0000') && !JSON.stringify(pd).includes('010-1111-2222'), pc?.props)
  check('D237-3 적어 둔 영업시간은 견본 표시 없이 · 고객 한마디는 후기 블록으로(따옴표 떼고 · 받은 곳 · 후기 수)', pc?.props.hours === '평일 9시~6시 · 토 10시~2시' && !pc?.sample?.includes('hours') && !!pr && (pr.props.items as { text: string; name: string; meta: string }[])[0].text === '아이가 매일 가고 싶어 해요' && (pr.props.items as { meta: string }[])[0].meta === '네이버 플레이스' && pr.props.intro === '네이버 후기 320개 · 평점 4.9' && hasContent(pr), pr?.props)
  const order = pd.blocks.map((b) => b.type)
  check('D237-4 후기 블록은 문의 띠 · 연락처 바로 위 · 하나만', order.filter((t) => t === 'reviews').length === 1 && order.indexOf('reviews') === Math.min(...['cta', 'contact'].map((t) => order.indexOf(t)).filter((i) => i >= 0)) - 1, order)
  const fd = draftSite(full, { today, now, makeId, promo })
  check('D237-5 업체 기록의 대표 전화가 있으면 그것이 먼저(홍보 전화로 덮지 않음)', fd.blocks.find((b) => b.type === 'contact')?.props.phone === '031-123-4567' && fd.blocks.find((b) => b.type === 'footer')?.props.phone === '031-123-4567')
  n = 0
  const plainDoc = draftSite(full, { today, now, makeId })
  n = 0
  const emptyPromoDoc = draftSite(full, { today, now, makeId, promo: {} })
  check('D237-6 홍보 정보가 없으면 예전 초안 그대로(후기 블록 없음 · 견본 영업시간)', JSON.stringify(plainDoc) === JSON.stringify(emptyPromoDoc) && !plainDoc.blocks.some((b) => b.type === 'reviews') && !!plainDoc.blocks.find((b) => b.type === 'contact')?.sample?.includes('hours'))
  const nb = newBlock('reviews', noPhone, 'education', today, 'nb1', promo)
  const nbEmpty = newBlock('reviews', noPhone, 'education', today, 'nb2')
  const nc = newBlock('contact', noPhone, 'education', today, 'nb3', promo)
  check('D237-7 나중에 더하는 후기 · 연락처 블록도 홍보 정보로(없으면 빈 칸 그대로)', (nb.props.items as { text: string }[])[0].text === '아이가 매일 가고 싶어 해요' && (nbEmpty.props.items as { text: string }[])[0].text === '' && nc.props.phone === '031-555-0000' && nc.props.hours === '평일 9시~6시 · 토 10시~2시')
  const html = renderSiteHtml(pd)
  check('D237-8 HTML 에 후기 · 영업시간이 나오고 공격 글은 막힘', html.includes('아이가 매일 가고 싶어 해요') && html.includes('평일 9시~6시') && !/<script/i.test(renderSiteHtml(draftSite(noPhone, { today, now, makeId, promo: { voice: '<script>alert(1)</script>' } }))))
}

console.log(`\n홈페이지 만들기: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
