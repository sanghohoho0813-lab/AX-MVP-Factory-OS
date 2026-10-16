/**
 * D-203 홍보 글 만들기 — 업체 홍보 정보(사실만) · 키워드 · 주제 · 7가지 형식 × 9업종 × 말투 × 다른 안 · 지어내지 않기 ·
 * 담당자 휴대폰 안 넣기 · 말투 바꾸기 표 · 점검(대괄호 · 광고 규정 말) · 카톡 (광고) · 먼저 만들 것 · 보관함(지문 · 판 · 읽기).
 * SHOW=1 이면 견본 글을 찍는다(눈으로 보기).
 */
import { normalizeClientOps } from '../clientOpsService'
import {
  CONTENT_KINDS,
  CONTENT_LIB,
  areaOf,
  buildProfile,
  contentHash,
  draftChecks,
  firstPicks,
  formalWord,
  hashtags,
  itemData,
  keywordGroups,
  latestByRoot,
  makeDraft,
  mainKeyword,
  nextVersion,
  normalizeItem,
  normalizeOverrides,
  placeholders,
  plainText,
  sameContent,
  shortItemOf,
  toFormal,
  topicsFor,
  type ContentItem,
  type ContentKind,
  type ContentProfile,
  type KakaoPurpose,
} from '../contentStudio'
import type { IndustryKey, SiteDoc } from '../siteBuilder'

let passed = 0
let failed = 0
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) {
    passed += 1
    console.log('PASS ', name)
  } else {
    failed += 1
    console.log('FAIL ', name, detail === undefined ? '' : JSON.stringify(detail).slice(0, 700))
  }
}

const today = '2026-10-16'
const SHOW = typeof process !== 'undefined' && process.env.SHOW === '1'

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
const empty = normalizeClientOps({ id: 'c-empty', companyName: '새봄상사' })
const fresh = normalizeClientOps({ id: 'c-new', companyName: '맛나식당', businessCategory: '음식점업', businessItem: '한식', businessAddress: '서울특별시 마포구 망원로 3', establishedAt: '2026-05-01', contactPhone: '010-1111-2222' })

/* ---------------- 홍보 정보 ---------------- */
const { profile: fp, source: fs } = buildProfile(full, today)
check('C1 꽉 찬 업체 — 상호 · 제조 · 대표 상품 = 종목 첫 말 · 하는 일 3 · 지역 화성 · 대표 전화', fp.company === '한솔정밀(주)' && fp.industry === 'manufacturing' && fp.item === '정밀 금속부품' && fp.services.join('|') === '정밀 금속부품|금형|시제품 가공' && fp.area === '화성' && fp.phone === '031-123-4567' && fs.item === 'record' && fs.services === 'record', fp)
check('C2 강점 = 사실로만(설립 12년째 · 직원 42명 · 인증 3 · 연구소 · 특허 2건)', JSON.stringify(fp.strengths) === JSON.stringify(['설립 12년째', '직원 42명', '벤처기업 인증', '이노비즈 인증', 'ISO 9001 인증', '기업부설연구소', '특허 2건']), fp.strengths)
const { profile: ep, source: es } = buildProfile(empty, today)
check('C3 빈 업체 — 업종 기타 · 대표 상품 = 업종 말 · 강점 0 · 하는 일 0 · 전화 없음(지어내지 않음)', ep.industry === 'general' && ep.item === CONTENT_LIB.general.keywordItem && ep.strengths.length === 0 && ep.services.length === 0 && ep.phone === '' && es.item === 'industry' && es.services === 'none', ep)
const { profile: np } = buildProfile(fresh, today)
check('C4 담당자 휴대폰은 대표 전화로 쓰지 않음', np.phone === '' && !JSON.stringify(np).includes('010-1111-2222'))
check('C5 지역 짧게: 경기 화성시 → 화성 · 서울 강남구 → 강남 · 세종 → 세종 · 빈 값', areaOf('경기 화성시') === '화성' && areaOf('서울 강남구') === '강남' && areaOf('세종') === '세종' && areaOf('') === '' && areaOf('부산 기장군') === '기장')
check('C6 종목 짧게: 첫 말 · 끝의 업 빼기 · 너무 길면 버림', shortItemOf('전자부품 제조업, 도소매') === '전자부품 제조' && shortItemOf('아주아주긴종목이름입니다정말로아주길어요') === '')
const ov = normalizeOverrides({ industry: 'food', item: '  수제버거 ', services: ['수제버거', '', 3, '감자튀김'], tone: 'formal', hacker: '<script>', area: '망원', extraStrengths: ['주차 10대'] })
check('C7 고친 칸 읽기 — 모르는 칸 · 빈 값 · 글자 아닌 값 버림', JSON.stringify(ov) === JSON.stringify({ industry: 'food', item: '수제버거', services: ['수제버거', '감자튀김'], area: '망원', extraStrengths: ['주차 10대'], tone: 'formal' }), ov)
check('C8 이상한 업종 · 말투는 버림', JSON.stringify(normalizeOverrides({ industry: 'casino', tone: 'rude' })) === '{}' && JSON.stringify(normalizeOverrides(null)) === '{}')
const { profile: op, source: os } = buildProfile(fresh, today, ov)
check('C9 고친 칸이 이김(업종 · 대표 상품 · 하는 일 · 지역 · 말투) · 사람이 더한 강점', op.industry === 'food' && op.item === '수제버거' && op.services.join() === '수제버거,감자튀김' && op.area === '망원' && op.tone === 'formal' && op.strengths.includes('주차 10대') && os.item === 'override' && os.services === 'override')
const site = { blocks: [{ id: 's', type: 'services', props: { items: [{ name: '정밀가공', desc: '' }, { name: '금형 수리', desc: '' }] } }] } as unknown as SiteDoc
const siteSample = { blocks: [{ id: 's', type: 'services', sample: ['items'], props: { items: [{ name: '견본', desc: '' }] } }] } as unknown as SiteDoc
check('C10 홈페이지의 하는 일(견본 아닌 것)을 씀 · 견본이면 안 씀', buildProfile(full, today, {}, site).profile.services.join() === '정밀가공,금형 수리' && buildProfile(full, today, {}, siteSample).profile.services.join('|') === '정밀 금속부품|금형|시제품 가공')

/* ---------------- 키워드 · 주제 ---------------- */
const groups = keywordGroups(fp)
const all = groups.flatMap((g) => g.words)
check('C11 키워드 = 지역 + 대표 상품 · 추천 · 잘하는 곳 · 비교 말 · 상황 말 · 하는 일 · 우리 이름', mainKeyword(fp) === '화성 정밀 금속부품' && all.includes('화성 정밀 금속부품 추천') && all.includes('정밀 금속부품 견적') && all.includes('화성 금형') && all.includes('한솔정밀(주) 후기') && groups.map((g) => g.key).join() === 'find,compare,problem,service,brand', groups)
check('C12 키워드에 같은 말 두 번 · 빈 말 없음 · 지역이 없으면 지역 없이', groups.every((g) => new Set(g.words).size === g.words.length && g.words.every((w) => w.trim() === w && w.length > 1)) && keywordGroups(ep).flatMap((g) => g.words).every((w) => !w.startsWith(' ') && !w.includes('  ')))
const tags = hashtags(fp, 15)
check('C13 해시태그 — 빈칸 · (주) · 같은 것 없음 · 15개까지', tags.length <= 15 && tags.every((t) => /^#\S+$/.test(t) && !t.includes('(주)')) && new Set(tags).size === tags.length && tags.includes('#한솔정밀') && tags.includes('#화성정밀금속부품'), tags)
check('C13b 하는 일이 많아도 회사 이름 해시태그는 8개 안에 남음', hashtags({ ...fp, services: ['가', '나다', '라마', '바사', '아자', '차카'] }, 8).includes('#한솔정밀'))
const topics = topicsFor(fp, mainKeyword(fp), today)
check('C14 주제 6가지(정보 · 기준 · 질문 · 소개 · 사례 · 이번 달) — 10월이 없으면 11월 이야기', topics.map((t) => t.type).join() === 'tips,choose,faq,intro,case,season' && topics.every((t) => t.keyword === '화성 정밀 금속부품') && topics.find((t) => t.type === 'season')!.title.startsWith('11월'), topics.map((t) => t.title))
check('C15 병의원 · 뷰티는 사례(체험담) 주제를 만들지 않음', !topicsFor(buildProfile(full, today, { industry: 'health' }).profile, '', today).some((t) => t.type === 'case'))
check('C16 다른 안 → 주제 제목이 바뀜 · 같은 번호면 같은 제목', topicsFor(fp, '', today, 1)[0].title !== topicsFor(fp, '', today, 0)[0].title && topicsFor(fp, '', today, 1)[0].title === topicsFor(fp, '', today, 1)[0].title)

/* ---------------- 모든 형식 × 업종 × 말투 × 다른 안 ---------------- */
const INDUSTRIES = Object.keys(CONTENT_LIB) as IndustryKey[]
const PURPOSES: KakaoPurpose[] = ['news', 'event', 'season', 'thanks']
const bad: unknown[] = []
const residual: unknown[] = []
let made = 0
for (const rec of [full, empty, fresh]) {
  for (const ind of INDUSTRIES) {
    for (const tone of ['friendly', 'formal'] as const) {
      const p = buildProfile(rec, today, { industry: ind, tone }).profile
      for (const kind of CONTENT_KINDS) {
        for (const variant of [0, 1, 2]) {
          const ts = topicsFor(p, '', today, variant)
          const reqs = kind === 'kakao' ? PURPOSES.map((purpose) => ({ kind, purpose, variant })) : ['blog', 'shorts', 'video', 'cards'].includes(kind) ? ts.map((topic) => ({ kind, topic, variant, pages: (variant % 2 ? 7 : 5) as 5 | 7 })) : [{ kind, variant }]
          for (const req of reqs) {
            const d = makeDraft(p, req, today)
            made += 1
            const text = plainText(d.kind, d.blocks)
            if (!d.blocks.length || !text.trim() || /undefined|null|NaN|\[object/.test(text + d.title) || /\bAI\b/.test(text) || text.includes('010-9999-8888') || text.includes('010-1111-2222') || /\s{3,}\S/.test(text.replace(/\n/g, '')) || /을\(를\)|이\(가\)|은\(는\)/.test(text)) bad.push({ ind, kind, tone, variant, title: d.title, text: text.slice(0, 200) })
            if (tone === 'formal') {
              const left = (text + '\n' + d.title).match(/[가-힣]+요(?=[.!\n]|$)/g)?.filter((w) => !/세요$/.test(w)) ?? []
              if (left.length) residual.push({ ind, kind, left: [...new Set(left)] })
            }
          }
        }
      }
    }
  }
}
check(`C17 형식 7 × 업종 9 × 말투 2 × 다른 안 3 × 업체 3 = ${made}편 — 빈 글 · undefined · 'AI' · 담당자 휴대폰 · 어색한 조사 0`, bad.length === 0 && made > 2000, bad.slice(0, 3))
check('C18 격식 있게 — 문장 끝에 남은 "~요." 0(부탁 "~세요" 는 그대로)', residual.length === 0, residual.slice(0, 5))

const FORMAL: [string, string][] = [
  ['어떤 곳인가요', null as unknown as string], ['주차되나요', null as unknown as string], ['해요', '합니다'], ['줄어요', '줍니다'], ['쉬워요', '쉽습니다'], ['보여요', '보입니다'], ['돼요', '됩니다'], ['드려요', '드립니다'], ['좋아요', '좋습니다'], ['했어요', '했습니다'], ['손님이에요', '손님입니다'],
  ['거예요', '것입니다'], ['도와요', '돕습니다'], ['고마워요', '고맙습니다'], ['다녀요', '다닙니다'], ['봐요', '봅니다'], ['줘요', '줍니다'], ['가요', '갑니다'], ['알아요', '압니다'], ['만들어요', '만듭니다'], ['생겨요', '생깁니다'],
  ['여유로워요', '여유롭습니다'], ['둬요', '둡니다'], ['와요', '옵니다'], ['빨라져요', '빨라집니다'], ['있어요', '있습니다'], ['많아요', '많습니다'], ['이해해요', '이해합니다'], ['여쭤봐요', '여쭤봅니다'], ['달라져요', '달라집니다'],
]
const formalBad = FORMAL.filter(([a, b]) => formalWord(a) !== b).map(([a, b]) => ({ a, want: b, got: formalWord(a) }))
check(`C19 말투 바꾸기 표 ${FORMAL.length}개(받침 · ㄹ 탈락 · ㅂ 불규칙 · 줄임꼴)`, formalBad.length === 0, formalBad)
check('C20 부탁 · 물음은 그대로 · 문장 가운데는 안 바꿈', toFormal('확인해 보세요. 주차할 수 있나요? 좋아요 그래요.') === '확인해 보세요. 주차할 수 있나요? 좋아요 그렇습니다.'.replace('그렇습니다', formalWord('그래요') ?? '') && formalWord('보세요') === null)

/* ---------------- 지어내지 않기 · 점검 ---------------- */
const eDraft = makeDraft(ep, { kind: 'place' }, today)
const eText = plainText('place', eDraft.blocks)
check('C21 빈 업체 플레이스 소개 — 주소 · 시간 · 주차 · 전화 · 하는 일은 [대괄호]로 비워 둠(숫자 지어내지 않음)', ['[주소]', '[운영 시간 · 쉬는 날]', '[주차 안내]', '[대표 전화]'].every((h) => eText.includes(h)) && !/\d+년째|\d+명|\d+건/.test(eText), eText)
const fBlog = makeDraft(fp, { kind: 'blog', topic: topics[3] }, today)
const fText = plainText('blog', fBlog.blocks)
check('C22 꽉 찬 업체 소개 블로그 — 사실 문장(2014년 · 경기 화성시 · 정밀 금속부품 업체) · 강점 · 대표 전화 · 주소', fText.includes('한솔정밀(주)는 2014년에 경기 화성시에서 문을 연 정밀 금속부품 업체예요.') && fText.includes('• 특허 2건') && fText.includes('전화 031-123-4567') && fText.includes('주소 경기도 화성시 동탄산단 6길 15'), fText.slice(0, 600))
const chk = draftChecks('blog', fBlog.blocks, fp.industry, topics[3].keyword)
check('C23 점검 — 대괄호 개수 · 키워드 횟수 · 글자 수', chk.some((c) => c.key === 'holes' && c.level === 'must') && chk.some((c) => c.key === 'kw') && chk.some((c) => c.key === 'len'), chk)
const risky = draftChecks('blog', [{ label: '', text: '업계 최고! 만족도 1위, 100% 보장 · 부작용 없는 완치' }], 'health')
check('C24 광고 규정 말(최고 · 1위 · 100% · 보장 · 완치/부작용 없음) → 알림 · 병의원 주의 문구', ['risky-최고', 'risky-1위', 'risky-100%', 'risky-보장 · 무조건', 'risky-완치 · 부작용 없음', 'caution'].every((k) => risky.some((c) => c.key === k)), risky.map((c) => c.key))
check('C25 대괄호 찾기', placeholders('a [하나] b [둘 셋]\n[넷]').join('|') === '하나|둘 셋|넷' && placeholders('[]').length === 0)
const kk = (purpose: KakaoPurpose) => makeDraft(fp, { kind: 'kakao', purpose }, today)
check('C26 카톡 — 새 소식 · 혜택 · 이번 달은 맨 앞 (광고) + 야간 전송 안내 · 1:1 안부는 (광고) 없음', ['news', 'event', 'season'].every((p) => kk(p as KakaoPurpose).blocks[0].text.startsWith('(광고) ') && kk(p as KakaoPurpose).notes.some((n) => n.includes('밤 9시'))) && !kk('thanks').blocks[0].text.includes('(광고)'))
check('C27 카톡 혜택은 기간 · 대상 · 혜택을 비워 둠(지어내지 않음)', ['[혜택 내용', '[시작일]', '[끝나는 날]', '[대상]'].every((h) => kk('event').blocks[0].text.includes(h)))
const kwd = makeDraft(fp, { kind: 'keywords' }, today)
check('C28 키워드 글 — 묶음마다 설명(hint) · 검색량은 짐작하지 않는다는 안내', kwd.blocks.slice(0, -1).every((b) => !!b.hint) && kwd.notes.some((n) => n.includes('검색량')) && !/\d+회|\d+건 검색/.test(plainText('keywords', kwd.blocks)))
const sh = makeDraft(fp, { kind: 'shorts', topic: topics[0] }, today)
check('C29 짧은 영상 — 0~3초 첫마디 · 3장면 · 마무리에 회사 · 대표 전화 · 말/화면 나눔', sh.blocks.some((b) => b.label.startsWith('0~3초')) && sh.blocks.filter((b) => /번째$/.test(b.label)).length === 3 && sh.blocks.some((b) => b.text.includes('한솔정밀(주) · 031-123-4567')) && sh.blocks.filter((b) => b.label).slice(0, -1).every((b) => b.text.includes('말:') && b.text.includes('화면:')))
const cards7 = makeDraft(fp, { kind: 'cards', topic: topics[0], pages: 7 }, today)
const cards5 = makeDraft(fp, { kind: 'cards', topic: topics[0], pages: 5 }, today)
check('C30 카드뉴스 5장 · 7장(표지 · 내용 · 마무리) + 올릴 때 쓰는 글', cards5.blocks.filter((b) => /장/.test(b.label)).length === 5 && cards7.blocks.filter((b) => /장/.test(b.label)).length === 7 && cards7.blocks.some((b) => b.label === '올릴 때 쓰는 글'))
const vid = makeDraft(fp, { kind: 'video', topic: topics[1] }, today)
check('C31 긴 영상 — 썸네일 글자 · 오프닝 · 인사 · 본론 5 · 정리 · 마무리 · 설명란', ['썸네일 글자', '0:00 · 오프닝', '0:30 · 인사', '설명란'].every((l) => vid.blocks.some((b) => b.label === l)) && vid.blocks.filter((b) => /^\d:00 · \d\. /.test(b.label)).length === 5)
check('C32 같은 요청 = 같은 글 · 다른 안 = 다른 글', JSON.stringify(makeDraft(fp, { kind: 'blog', topic: topics[0], variant: 1 }, today)) === JSON.stringify(makeDraft(fp, { kind: 'blog', topic: topics[0], variant: 1 }, today)) && plainText('blog', makeDraft(fp, { kind: 'blog', topic: topics[0], variant: 0 }, today).blocks) !== plainText('blog', makeDraft(fp, { kind: 'blog', topic: topics[0], variant: 1 }, today).blocks))
check('C33 복사 모양 — 플레이스 ■ · 영상 [이름] · 블로그 제목 먼저', plainText('place', eDraft.blocks).includes('■ 하는 일') && plainText('shorts', sh.blocks).includes('[0~3초 · 첫마디]') && plainText('blog', fBlog.blocks).startsWith(fBlog.title))
const fb = makeDraft(buildProfile(full, today, { industry: 'food' }).profile, { kind: 'blog', topic: topicsFor(buildProfile(full, today, { industry: 'food' }).profile, '', today)[0] }, today)
check('C34 업종 주의 문구(음식 — 건강 효과)가 안내에 · 복사 글에는 안 들어감', fb.notes.some((n) => n.includes('건강')) && !plainText('blog', fb.blocks).includes('식품 표시'))

/* ---------------- 먼저 만들 것 ---------------- */
const picks = firstPicks(fp, today)
check('C35 먼저 만들 것 3개 — 키워드 → 소개(인증 · 특허 근거) → 플레이스', picks.length === 3 && picks[0].kind === 'keywords' && picks.some((p) => p.key === 'trust' && p.why.includes('벤처기업 인증')) && picks.some((p) => p.kind === 'place'), picks)
const picks2 = firstPicks(fp, today, [{ kind: 'keywords', createdAt: '2026-10-01' }, { kind: 'place', createdAt: '2026-10-02' }, { kind: 'blog', topicType: 'intro', createdAt: '2026-10-03' }])
check('C36 이미 만든 것은 빠지고 다음 것(이번 달 카드뉴스 · 기준 블로그 …)', !picks2.some((p) => ['keywords', 'place', 'trust'].includes(p.key)) && picks2.length === 3 && picks2[0].key === 'season', picks2)
const picks3 = firstPicks(np, today, [{ kind: 'keywords', createdAt: '2026-10-01' }, { kind: 'place', createdAt: '2026-10-01' }])
check('C37 문 연 지 1년 안 된 업체 → 새로 연 소식(카톡)', picks3.some((p) => p.key === 'open' && p.kind === 'kakao' && p.purpose === 'news'), picks3)
check('C38 추천 까닭에 어색한 조사 없음', [...picks, ...picks2, ...picks3].every((p) => !/을\(를\)|이\(가\)/.test(p.why) && p.why.length > 5))

/* ---------------- 보관함 ---------------- */
const d1 = makeDraft(fp, { kind: 'blog', topic: topics[0] }, today)
const h1 = contentHash('blog', d1.blocks)
check('C39 지문 — 같은 글 같은 값 · 한 글자 달라도 다름 · 종류가 달라도 다름', h1 === contentHash('blog', d1.blocks) && h1 !== contentHash('blog', [...d1.blocks.slice(0, -1), { label: '', text: '#다름' }]) && h1 !== contentHash('shorts', d1.blocks))
const item: ContentItem = { id: 'i1', kind: 'blog', title: d1.title, blocks: d1.blocks, input: d1.input, rootId: 'i1', version: 1, favorite: true, hash: h1, createdAt: '2026-10-16T01:00:00Z', updatedAt: '2026-10-16T01:00:00Z' }
const back = normalizeItem('i1', itemData(item), item.createdAt, item.updatedAt)
const stable = (v: unknown): string => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x))
check('C40 저장 → 읽기 그대로', stable(back) === stable(item), back)
check('C41 이상한 줄은 버림(종류 모름 · 글 없음 · 아님)', normalizeItem('x', { kind: 'hack', blocks: [{ text: 'a' }] }) === null && normalizeItem('x', { kind: 'blog', blocks: [] }) === null && normalizeItem('x', 'str') === null)
const edited = d1.blocks.map((b, i) => (i === 1 ? { ...b, text: `${b.text} 고친 문장.` } : b))
const v2 = nextVersion([item], item, edited, 'i2', '2026-10-16T02:00:00Z')
check('C42 고쳐 저장 → 같은 사슬 2판 · 원래 글은 그대로', v2.rootId === 'i1' && v2.version === 2 && v2.hash !== item.hash && item.version === 1)
const lr = latestByRoot([item, v2, { ...item, id: 'o', rootId: 'o', favorite: false, createdAt: '2026-10-16T05:00:00Z' }])
check('C43 보관함 목록 = 사슬마다 새 판 하나 · 판 수 · 즐겨찾기 먼저', lr.length === 2 && lr[0].item.id === 'i2' && lr[0].versions === 2 && lr[0].item.favorite === true && lr[1].item.id === 'o')
check('C44 같은 글은 두 번 넣지 않음(sameContent)', sameContent([item], 'blog', d1.blocks)?.id === 'i1' && sameContent([item], 'blog', edited) === null)

/* ---------------- 견본 문구 자체 ---------------- */
const libBad = INDUSTRIES.flatMap((k) => {
  const l = CONTENT_LIB[k]
  const problems: string[] = []
  if (l.tips.length < 5) problems.push(`${k} tips ${l.tips.length}`)
  if (l.checks.length < 5) problems.push(`${k} checks`)
  if (l.process.length < 3) problems.push(`${k} process`)
  if (l.faq.length < 3) problems.push(`${k} faq`)
  if (!l.ctaShort.includes('{company}')) problems.push(`${k} ctaShort`)
  const text = JSON.stringify(l)
  if (/최고|1위|100%|보장|완치/.test(text.replace(l.caution ?? '', ''))) problems.push(`${k} risky`)
  return problems
})
check('C45 업종 견본 10개(디자인 · 광고 · 간판 포함) — 정보 5 · 기준 5 · 순서 3+ · 질문 3+ · 마무리에 회사 이름 자리 · 광고 규정 말 0', libBad.length === 0 && INDUSTRIES.length === 10, libBad)

if (SHOW) {
  const show = (p: ContentProfile, kind: ContentKind, extra: Record<string, unknown> = {}) => {
    const t = topicsFor(p, '', today)
    const d = makeDraft(p, { kind, topic: t[(extra.t as number) ?? 0], ...extra }, today)
    console.log(`\n===== ${kind} · ${p.industry} · ${p.tone} · ${d.title}\n${plainText(kind, d.blocks)}\n-- notes: ${d.notes.join(' / ')}`)
  }
  show(fp, 'keywords')
  show(fp, 'blog')
  show(fp, 'blog', { t: 1 })
  show({ ...fp, tone: 'formal' }, 'blog', { t: 3 })
  show(fp, 'shorts')
  show(fp, 'video', { t: 1 })
  show(fp, 'cards', { t: 5 })
  show(fp, 'kakao', { purpose: 'season' })
  show(fp, 'place')
  show(np, 'place')
  show(buildProfile(fresh, today).profile, 'blog', { t: 2 })
}

console.log(`\n홍보 글 만들기: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
