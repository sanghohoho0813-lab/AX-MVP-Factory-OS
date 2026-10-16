/**
 * D-202 홈페이지 만들기 — 업종 알아보기 · 업체 기록으로 초안 · 지어내지 않기 · HTML 안전(무작위 공격 글) · 꾸밈 대비 · 고치기 · 저장본 읽기 · 점검.
 */
import { normalizeClientOps } from '../clientOpsService'
import {
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
  safeHref,
  safeImage,
  setHidden,
  setProp,
  siteChecks,
  siteFileName,
  withContactPhone,
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
]
const indBad = IND.filter(([t, k]) => industryOf(...t) !== k).map(([t, k]) => ({ t, want: k, got: industryOf(...t) }))
check('H1 업종 알아보기 13가지(제조 먼저 · 식품 제조는 제조 · 카페는 음식 · 모르면 기타)', indBad.length === 0, indBad)

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
const allInd = ['manufacturing', 'it', 'trade', 'food', 'health', 'professional', 'education', 'construction', 'general'] as const
const indRender = allInd.map((k) => ({ k, html: renderSiteHtml(draftSite(full, { today, now, makeId, industry: k })) }))
check('H17 업종 9개 모두 초안 → HTML(<!doctype · 회사명 · 스크립트 0)', indRender.every((x) => x.html.startsWith('<!doctype html>') && x.html.includes('한솔정밀(주)') && !/<script/i.test(x.html)), indRender.filter((x) => !x.html.includes('한솔정밀')).map((x) => x.k))

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
  for (const b of doc.blocks) {
    for (const f of BLOCK_DEFS.find((x) => x.type === b.type)!.fields) {
      if (rnd() < 0.5) continue
      if (f.kind === 'list') doc = setProp(doc, b.id, f.key, [Object.fromEntries((f.itemFields ?? []).map((s) => [s.key, pick(EVIL)]))], now)
      else if (f.kind === 'toggle') doc = setProp(doc, b.id, f.key, rnd() < 0.5, now)
      else doc = setProp(doc, b.id, f.key, pick(EVIL), now)
    }
  }
  doc = { ...doc, seo: { title: pick(EVIL), description: pick(EVIL) } }
  const out = renderSiteHtml(doc, { preview: rnd() < 0.5, selectedId: pick(doc.blocks).id })
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
check('H28 색 묶음 6개 × 글자/바탕 7쌍 — 모두 대비 기준 넘음', contrastBad.length === 0, contrastBad)

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
check('H45 블록 정의 12종 · 칸 이름 겹침 없음 · 목록 칸엔 줄 칸 정의', BLOCK_DEFS.length === 12 && BLOCK_DEFS.every((b) => new Set(b.fields.map((f) => f.key)).size === b.fields.length && b.fields.every((f) => f.kind !== 'list' || (f.itemFields?.length ?? 0) > 0)))

console.log(`\n홈페이지 만들기: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
