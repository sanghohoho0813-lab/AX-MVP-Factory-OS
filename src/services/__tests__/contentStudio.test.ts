/**
 * D-203 홍보 글 만들기 — 업체 홍보 정보(사실만) · 키워드 · 주제 · 7가지 형식 × 9업종 × 말투 × 다른 안 · 지어내지 않기 ·
 * 담당자 휴대폰 안 넣기 · 말투 바꾸기 표 · 점검(대괄호 · 광고 규정 말) · 카톡 (광고) · 먼저 만들 것 · 보관함(지문 · 판 · 읽기).
 * D-207: 차별점 · 망설이는 점 · 이 칸만 채우면 · 체험단 가이드(대가 표시) · 사진 자리 · 쇼츠 길이 · 광고 유형 5 · 검색량 정리 · 한 달 계획.
 * D-208: 상황 예시 12가지 묶음(지어내지 않기 · (광고) · 1:1 · 말투 · 지금 때) · 한 달 치 한 번에(같은 글 없음 · 올릴 날) · 진행 중 계획 되찾기 · 올렸어요.
 * SHOW=1 이면 견본 글을 찍는다(눈으로 보기).
 */
import { normalizeClientOps } from '../clientOpsService'
import {
  AD_TYPES,
  AD_TYPE_LABEL,
  ANGLES,
  ANGLE_IDS,
  CARD_FIVE,
  angleTitle,
  angleVideoTitle,
  cardFive,
  normalizeStats,
  performanceBy,
  perfKey,
  titleCandidates,
  usedAngles,
  withStats,
  type AngleId,
  CONTENT_KINDS,
  CONTENT_LIB,
  areaOf,
  buildProfile,
  contentHash,
  draftChecks,
  factChecks,
  volumeTier,
  videoSeries,
  offerLine,
  aiRequestText,
  aiRequestFacts,
  briefSlots,
  materialList,
  reviewChecklist,
  videoTitle,
  videoThumb,
  withoutArea,
  isB2B,
  CARE_NOTE,
  firstPicks,
  formalWord,
  hashtags,
  itemData,
  keywordGroups,
  latestByRoot,
  makeDraft,
  mainKeyword,
  monthPlan,
  monthPlanFrom,
  activePlan,
  keepPlan,
  titleOf,
  planDrafts,
  planSlotStates,
  withPosted,
  situationPack,
  situationsFor,
  SITUATION_KEYS,
  AD_NOTE,
  nextVersion,
  normalizeItem,
  normalizeOverrides,
  parseKeywordVolumes,
  placeholders,
  holeNames,
  holeLabel,
  holeGroups,
  fillHoles,
  plainText,
  profileGaps,
  sameContent,
  shortItemOf,
  toFormal,
  topicsFor,
  type ContentItem,
  type ContentKind,
  type ContentProfile,
  type KakaoPurpose,
  type MadeItem,
  regulatedOf,
  cardFiveTypes,
  riskyAdTypes,
  noticeOf,
  speakerLine,
  contactLine,
  priceWithoutUnit,
  reviewPlaceIn,
  AI_REQUEST_TIPS,
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
check('C14 주제 6가지(정보 · 기준 · 질문 · 소개 · 사례 · 이번 달) — 10월이 없으면 11월 이야기 · D-229 제목은 모두 키워드로 시작', topics.map((t) => t.type).join() === 'tips,choose,faq,intro,case,season' && topics.every((t) => t.keyword === '화성 정밀 금속부품' && t.title.startsWith('화성 정밀 금속부품,')) && topics.find((t) => t.type === 'season')!.title.includes('11월') && topics.find((t) => t.type === 'season')!.month === 11, topics.map((t) => t.title))
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
const freshP = buildProfile(fresh, today).profile
const objCard = plainText('cards', makeDraft(freshP, { kind: 'cards', topic: topicsFor(freshP, '', today)[0], adType: 'objection' }, today).blocks)
const shortsAll = INDUSTRIES.flatMap((ind) => { const ip = buildProfile(full, today, { industry: ind }).profile; return topicsFor(ip, '', today).flatMap((t) => [0, 1, 2].map((v) => plainText('shorts', makeDraft(ip, { kind: 'shorts', topic: t, variant: v }, today).blocks))) })
check('C83 받침 있는 이름 — "맛나식당이 먼저 답해" · 짧은 영상 말에 "?." · "!." 0', objCard.includes('맛나식당이 먼저 답해') && !objCard.includes('맛나식당가') && shortsAll.every((t) => !/[?!]\./.test(t)), { obj: objCard.slice(0, 120), bad: shortsAll.find((t) => /[?!]\./.test(t))?.match(/.{0,30}[?!]\..{0,10}/)?.[0] })

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
check('C29 쇼츠 · 릴스(D-207 · D-229) — 고정 문구 · 첫 3초 · 구조 · 초 구간 대본 · 끝은 요약(업체 말은 한 줄) · 캡션 해시태그 5개', ['고정 문구', '첫 3초 · 붙잡는 말', '구조', '캡션'].every((l) => sh.blocks.some((b) => b.label === l)) && sh.blocks.filter((b) => /^\d:\d{2} - \d:\d{2}$/.test(b.label)).length === 5 && /정리하면 .+, 이 2가지예요\./.test(sh.blocks.filter((b) => /^\d:\d{2} - /.test(b.label)).at(-1)!.text) && (sh.blocks.find((b) => b.label === '캡션')!.text.match(/#\S+/g) ?? []).length === 5 &&  sh.blocks.filter((b) => /^\d:\d{2} - /.test(b.label)).every((b) => b.text.includes('나레이션:') && b.text.includes('자막:') && b.text.includes('장면:')), sh.blocks.map((b) => b.label))
const cards7 = makeDraft(fp, { kind: 'cards', topic: topics[0], pages: 7 }, today)
const cards5 = makeDraft(fp, { kind: 'cards', topic: topics[0], pages: 5 }, today)
check('C30 카드뉴스 5장 · 7장(표지 · 내용 · 마무리) + 올릴 때 쓰는 글', cards5.blocks.filter((b) => /장/.test(b.label)).length === 5 && cards7.blocks.filter((b) => /장/.test(b.label)).length === 7 && cards7.blocks.some((b) => b.label === '올릴 때 쓰는 글'))
const vid = makeDraft(fp, { kind: 'video', topic: topics[1] }, today)
check('C31 긴 영상(D-207 · D-229) — 기획 카드(썸네일 문구 · 도입부 15초 · 주제 · 타겟 청중 · 전략) → 인사 · 체크포인트 3 · 마무리 · 설명란', ['썸네일 문구', '도입부 · 처음 15초', '주제', '타겟 청중', '전략', '0:15 · 인사', '4:00 · 마무리', '설명란'].every((l) => vid.blocks.some((b) => b.label === l)) && vid.blocks.filter((b) => /^\d:00 · \d\. /.test(b.label)).length === 3, vid.blocks.map((b) => b.label))
check('C32 같은 요청 = 같은 글 · 다른 안 = 다른 글', JSON.stringify(makeDraft(fp, { kind: 'blog', topic: topics[0], variant: 1 }, today)) === JSON.stringify(makeDraft(fp, { kind: 'blog', topic: topics[0], variant: 1 }, today)) && plainText('blog', makeDraft(fp, { kind: 'blog', topic: topics[0], variant: 0 }, today).blocks) !== plainText('blog', makeDraft(fp, { kind: 'blog', topic: topics[0], variant: 1 }, today).blocks))
check('C33 복사 모양 — 플레이스 ■ · 영상 [이름] · 블로그 제목 먼저', plainText('place', eDraft.blocks).includes('■ 하는 일') && plainText('shorts', sh.blocks).includes('[0:00 - 0:03]') && plainText('shorts', sh.blocks).includes('[고정 문구]') && plainText('blog', fBlog.blocks).startsWith(fBlog.title))
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

/* ---------------- D-207 마케팅 규칙 ---------------- */
const ov7 = normalizeOverrides({ differ: '  시공 뒤 1년 무상 점검을 계약서에 적어 드려요  ', channel: '네이버 예약', objection: '공사 기간이 길까 봐', hours: '평일 9시 – 6시' })
check('C46 차별점 · 판매 채널 · 망설이는 점 칸 읽기(앞뒤 빈칸 · 길이 상한)', ov7.differ === '시공 뒤 1년 무상 점검을 계약서에 적어 드려요' && ov7.channel === '네이버 예약' && ov7.objection === '공사 기간이 길까 봐' && (normalizeOverrides({ differ: 'x'.repeat(500) }).differ ?? '').length === 200 && normalizeOverrides({ differ: 3 }).differ === undefined, ov7)
const gp = profileGaps(fp)
const fp7 = buildProfile(full, today, ov7).profile
// D-228 재료(후기 수 · 고객 한마디)도 '이 칸만 채우면' 에 — 차별점 등 D-207 칸 뒤에
check('C47 이 칸만 채우면 — 차별점이 맨 앞 · 채우면 빠짐 · D-207 칸을 다 채우면 재료 칸만 남음', gp[0]?.key === 'differ' && gp.some((g) => g.key === 'objection') && !gp.some((g) => g.key === 'phone') && profileGaps(fp7).map((g) => g.key).join() === 'speaker,reviews,voice' && profileGaps(ep).map((g) => g.key).join() === 'differ,phone,services,hours,objection,speaker,reviews,voice', gp.map((g) => g.key))
check('C48 주제마다 전략 한 줄', topics.every((t) => t.strategy.length > 10) && new Set(topics.map((t) => t.strategy)).size === topics.length)
const bChoose = makeDraft(fp7, { kind: 'blog', topic: topicsFor(fp7, '', today).find((t) => t.type === 'choose') }, today)
const bTips = makeDraft(fp, { kind: 'blog', topic: topics[0] }, today)
const photosOf = (d: { blocks: { text: string }[] }) => d.blocks.filter((b) => b.text.startsWith('(사진 자리:')).length
const tablesOf = (d: { blocks: { text: string }[] }) => d.blocks.filter((b) => /^[^\n|]+ \| [^\n|]+\n/.test(b.text)).length
const headsOf = (d: { blocks: { hint?: string }[] }) => d.blocks.filter((b) => b.hint?.startsWith('소제목')).length
check('C49 블로그(D-229 규칙집 3-1) — 제목 → 첫 문단(키워드) → 사진 4곳 이상 · 소제목 3(기준 2 + 정리) · 표 1개 · 차별점 없으면 [자리] · 있으면 그 말 · 망설이는 점 풀기', bTips.blocks[0].hint === '제목' && bTips.blocks[1].hint === '첫 문단(도입부)' && bTips.blocks[1].text.includes(topics[0].keyword) && photosOf(bTips) >= 4 && photosOf(bChoose) >= 4 && headsOf(bTips) === 3 && headsOf(bChoose) === 3 && tablesOf(bChoose) === 1 && tablesOf(bTips) === 1 && plainText('blog', bChoose.blocks).includes('시공 뒤 1년 무상 점검') && plainText('blog', bChoose.blocks).includes('공사 기간이 길까 봐') && placeholders(plainText('blog', bChoose.blocks)).length < placeholders(plainText('blog', makeDraft(fp, { kind: 'blog', topic: topicsFor(fp, '', today).find((t) => t.type === 'choose') }, today).blocks)).length, bTips.blocks.map((b) => b.hint ?? b.label))
const bChk = draftChecks('blog', bTips.blocks, fp.industry, topics[0].keyword)
const bChkBad = draftChecks('blog', [{ label: '', text: '다른 제목', hint: '제목' }, { label: '', text: '다른 첫 문단', hint: '첫 문단(도입부)' }], fp.industry, topics[0].keyword)
check('C50 블로그 점검 — 제목 · 첫 문단 키워드(있으면 조용 · 없으면 알림) · 소제목 · 사진 자리 수', !bChk.some((c) => c.key === 'kw-title' || c.key === 'kw-first') && bChk.some((c) => c.key === 'shape' && /사진 자리 \d+곳/.test(c.text)) && ['kw-title', 'kw-first'].every((k) => bChkBad.some((c) => c.key === k)), bChk.map((c) => c.key))
const rg = makeDraft(fp7, { kind: 'blog', topic: topics[0], blogType: 'review' }, today)
const rgText = plainText('blog', rg.blocks)
const rgChk = draftChecks('blog', rg.blocks, fp7.industry, topics[0].keyword)
check('C51 체험단 가이드 — 제목 · 꼭 넣을 키워드 · 꼭 담을 것(차별점) · 찍을 사진 · 글 순서 · 대가 표시(공정위) · 점검에 대가 표시', rg.title === `체험단 가이드 · ${fp7.company} · ${topics[0].keyword}` && rg.input.blogType === 'review' && ['꼭 넣을 키워드', '꼭 담아 주세요', '글 순서', '지켜 주세요'].every((l) => rg.blocks.some((b) => b.label === l)) && rg.blocks.some((b) => b.label.startsWith('찍어 주세요')) && rgText.includes('제공받아') && rgText.includes('공정거래위원회') && rgText.includes('시공 뒤 1년 무상 점검') && rgChk.some((c) => c.key === 'disclose' && c.level === 'info') && !rgChk.some((c) => c.key === 'kw' || c.key === 'shape'), rg.blocks.map((b) => b.label))
const s20 = makeDraft(fp, { kind: 'shorts', topic: topics[0], shortLen: '20-30' }, today)
const s60 = makeDraft(fp, { kind: 'shorts', topic: topics[0], shortLen: '30-60' }, today)
const rowsOf = (d: { blocks: { label: string }[] }) => d.blocks.filter((b) => /^\d:\d{2} - \d:\d{2}$/.test(b.label)).map((b) => b.label)
const durOf = (d: { blocks: { label: string; text: string }[] }) => draftChecks('shorts', d.blocks as never, fp.industry).find((c) => c.key === 'dur')?.text ?? ''
check('C52 쇼츠 길이 — 20~30초 = 5구간 · 27초 / 30~60초 = 6구간 · 45초 · 첫 구간 0:00 - 0:03 · 이어짐', rowsOf(s20).length === 5 && rowsOf(s60).length === 6 && rowsOf(s20)[0] === '0:00 - 0:03' && rowsOf(s20).at(-1)!.endsWith('0:27') && rowsOf(s60).at(-1)!.endsWith('0:45') && durOf(s20).includes('27초') && durOf(s60).includes('45초') && s60.input.shortLen === '30-60', [rowsOf(s20), rowsOf(s60)])
const fixedLong = draftChecks('shorts', [{ label: '고정 문구', text: '이것은 열다섯 글자보다 훨씬 긴 고정 문구예요' }], fp.industry)
const vidLong = draftChecks('video', [{ label: '', text: 'x'.repeat(120), hint: '제목' }], fp.industry, '화성')
check('C53 영상 점검 — 고정 · 썸네일 문구 15자 넘으면 알림 · 영상 제목 100자 · 키워드 없는 제목', fixedLong.some((c) => c.key === 'fixed-len') && vidLong.some((c) => c.key === 'title-len') && vidLong.some((c) => c.key === 'kw-title'))
const adBad: unknown[] = []
for (const ad of AD_TYPES) for (const pages of [5, 7] as const) for (const pp of [fp, ep, fp7, ...INDUSTRIES.map((ind) => buildProfile(empty, today, { industry: ind }).profile)]) {
  const d = makeDraft(pp, { kind: 'cards', topic: topicsFor(pp, '', today)[0], pages, adType: ad }, today)
  const pageLabels = d.blocks.filter((b) => /^\d장/.test(b.label))
  const t = plainText('cards', d.blocks)
  if (pageLabels.length !== pages || !pageLabels[0].label.includes('표지') || !pageLabels.at(-1)!.label.includes('마무리') || d.blocks[0].hint !== AD_TYPE_LABEL[ad] || pageLabels.some((b, i) => !b.label.startsWith(`${i + 1}장`)) || /undefined|null|NaN/.test(t) || d.input.adType !== ad) adBad.push({ ad, pages, company: pp.company, labels: pageLabels.map((b) => b.label) })
}
const objCards = plainText('cards', makeDraft(fp7, { kind: 'cards', topic: topics[0], adType: 'objection' }, today).blocks)
const probCards = plainText('cards', makeDraft(fp, { kind: 'cards', topic: topics[0], adType: 'problem' }, today).blocks)
check(`C54 카드뉴스 광고 유형 ${AD_TYPES.length}가지(규칙집 5안 순서 + 예전 2) × 5 · 7장 × 업체 3 + 빈 업체 × 업종 ${INDUSTRIES.length} — 장 수 · 1장 표지 · 끝 마무리 · 번호 차례 · 유형 표시`, AD_TYPES.join() === 'objection,problem,before,curious,proof,info,loss' && adBad.length === 0 && objCards.includes('공사 기간이 길까 봐, 걱정되시죠?') && CONTENT_LIB.manufacturing.problems.some((w) => probCards.includes(w)), adBad.slice(0, 3))
const kv = parseKeywordVolumes('연관키워드\t월간검색수(PC)\t월간검색수(모바일)\n화성 금형\t1,230\t4,560\n화성 정밀가공\t< 10\t< 10\n동탄 시제품\t300\t2,100\n화성  금형\t10\t20\n\n금형 수리, 지그 제작')
check('C55 검색량 붙여 넣기 — 머리줄 버림 · 쉼표 숫자 · "< 10" · 같은 말은 큰 쪽 · 많이 찾는 순 · 쉼표 목록은 숫자 없이 뒤로', kv.map((r) => r.word).join('|') === '화성 금형|동탄 시제품|화성 정밀가공|금형 수리|지그 제작' && kv[0].total === 5790 && kv[0].pc === 1230 && kv[2].small && kv[2].total === 0 && kv[3].total === null && parseKeywordVolumes('').length === 0, kv)
const p2 = monthPlan(fp, today, 2)
const p4 = monthPlan(fp, today, 4)
const sorted = (xs: { date: string }[]) => xs.every((x, i) => i === 0 || xs[i - 1].date < x.date)
const dowOf = (d: string) => new Date(`${d}T00:00:00Z`).getUTCDay()
check('C56 한 달 계획 — 주 2회 8개(화 · 금) · 주 4회 16개(월 · 화 · 목 · 금) · 다음 주 월요일부터 · 날짜 차례 · 블로그 많이 · 제목 있음', p2.length === 8 && p4.length === 16 && p2[0].date === '2026-10-20' && p4[0].date === '2026-10-19' && sorted(p2) && sorted(p4) && p2.every((x) => [2, 5].includes(dowOf(x.date))) && p4.every((x) => [1, 2, 4, 5].includes(dowOf(x.date))) && p2.filter((x) => x.kind === 'blog').length >= 3 && [...p2, ...p4].every((x) => x.title && !/undefined/.test(x.title)) && monthPlan(fp, '2026-10-19', 2)[0].date === '2026-10-27', { p2: p2.map((x) => `${x.date} ${x.kind}`), p4: p4.slice(0, 4) })
const it7: ContentItem = { ...item, id: 'i7', rootId: 'i7', input: { ...item.input, blogType: 'review', shortLen: '30-60', adType: 'loss' } }
const back7 = normalizeItem('i7', itemData(it7), it7.createdAt, it7.updatedAt)
check('C57 보관함에 글 종류 · 쇼츠 길이 · 광고 유형도 남음 · 이상한 값은 버림', back7?.input.blogType === 'review' && back7?.input.shortLen === '30-60' && back7?.input.adType === 'loss' && normalizeItem('x', { ...itemData(it7), input: { blogType: 'hack', shortLen: '99', adType: 'spam' } })?.input.adType === undefined, back7?.input)
const chText = ['blog', 'place', 'cards'].map((k) => plainText(k as ContentKind, makeDraft(fp7, { kind: k as ContentKind, topic: topics[0] }, today).blocks)).concat(plainText('blog', rg.blocks))
check('C58 판매 채널(네이버 예약) → 블로그 문의 칸 · 플레이스 이용 안내 · 카드뉴스 마무리 · 체험단 가이드에 들어감 · 없으면 그 줄 없음', chText.every((x) => x.includes('네이버 예약')) && !plainText('blog', makeDraft(fp, { kind: 'blog', topic: topics[0] }, today).blocks).includes('구매 · 예약'), chText.map((x) => x.includes('네이버 예약')))

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
check('C45 업종 견본 11개(디자인 · 광고 · 간판 · D-220 개인 컨설턴트 포함) — 정보 5 · 기준 5 · 순서 3+ · 질문 3+ · 마무리에 회사 이름 자리 · 광고 규정 말 0', libBad.length === 0 && INDUSTRIES.length === 11 && INDUSTRIES.includes('consultant'), libBad)

/* ---------------- D-208 상황 예시 · 한 달 치 · 올렸어요 ---------------- */
const HOLI = [{ date: '2026-12-25', name: '성탄절' }, { date: '2027-01-01', name: '신정' }]
const sitBad: unknown[] = []
const sitResidual: unknown[] = []
let sitMade = 0
for (const rec of [full, empty, fresh]) {
  for (const ind of INDUSTRIES) {
    for (const tone of ['friendly', 'formal'] as const) {
      const p = buildProfile(rec, today, { industry: ind, tone }).profile
      for (const key of SITUATION_KEYS) {
        const sp = situationPack(p, key, today, HOLI)
        if (!sp.items.length || sp.items.length !== sp.situation.tabs.length || sp.items.map((x) => x.tab).join() !== sp.situation.tabs.join()) sitBad.push({ ind, key, tabs: sp.situation.tabs, got: sp.items.map((x) => x.tab) })
        for (const { draft: d } of sp.items) {
          sitMade += 1
          const text = plainText(d.kind, d.blocks)
          if (!d.title.trim() || !text.trim() || d.input.situation !== key || /undefined|null|NaN|\[object/.test(text + d.title) || /\bAI\b/.test(text) || text.includes('010-9999-8888') || text.includes('010-1111-2222') || /을\(를\)|이\(가\)|은\(는\)/.test(text) || /\s{3,}\S/.test(text.replace(/\n/g, ''))) sitBad.push({ ind, key, tone, title: d.title, text: text.slice(0, 160) })
          if (tone === 'formal') {
            const left = (text + '\n' + d.title).match(/[가-힣]+요(?=[.!\n]|$)/g)?.filter((w) => !/세요$/.test(w)) ?? []
            if (left.length) sitResidual.push({ ind, key, left: [...new Set(left)] })
          }
        }
      }
    }
  }
}
check(`C59 상황 12 × 업종 10 × 말투 2 × 업체 3 = ${sitMade}편 — 탭 순서 · 빈 글 · undefined · 'AI' · 담당자 휴대폰 · 어색한 조사 0 · 상황 표시`, sitBad.length === 0 && sitMade > 1500, sitBad.slice(0, 3))
check('C60 상황 묶음도 격식 있게 — 문장 끝에 남은 "~요." 0', sitResidual.length === 0, sitResidual.slice(0, 5))
const packOf = (p: ContentProfile, key: (typeof SITUATION_KEYS)[number], d = today) => situationPack(p, key, d, HOLI)
const allPacks = SITUATION_KEYS.map((k) => packOf(fp7, k))
const kakaos = allPacks.flatMap((sp) => sp.items.filter((x) => x.draft.kind === 'kakao'))
const oneToOne = kakaos.filter((x) => x.tab.includes('1:1'))
const broadcast = kakaos.filter((x) => !x.tab.includes('1:1'))
check('C61 여러 분께 보내는 카톡은 (광고)로 시작 + 광고 안내 · 1:1 은 (광고) 없이 1:1 안내', broadcast.length >= 9 && broadcast.every((x) => x.draft.blocks[0].text.startsWith('(광고)') && x.draft.notes.includes(AD_NOTE)) && oneToOne.length === 2 && oneToOne.every((x) => !x.draft.blocks[0].text.includes('(광고)') && x.draft.notes.some((n) => n.includes('1:1'))), broadcast.filter((x) => !x.draft.blocks[0].text.startsWith('(광고)')).map((x) => x.draft.title))
const textOf = (key: (typeof SITUATION_KEYS)[number], p = fp7) => packOf(p, key).items.map((x) => plainText(x.draft.kind, x.draft.blocks)).join('\n')
const holes: [(typeof SITUATION_KEYS)[number], string[]][] = [
  ['open', ['[문 연 날짜]']],
  ['newItem', ['[새 상품 · 서비스 이름]', '[가격']],
  ['event', ['[혜택 내용', '[시작일]', '[끝나는 날]', '[대상]']],
  ['holiday', ['[쉬는 날짜]', '[다시 여는 날]']],
  ['price', ['[지금 가격]', '[새 가격]', '[바뀌는 날짜]']],
  ['move', ['[새 주소]', '[옮기는 날짜]']],
  ['award', ['[받은 인증 · 상 이름]', '[주는 곳]']],
  ['hiring', ['[급여', '[마감일]', '[직무']],
  ['review', ['[후기 남기는 곳', '[고객 이름]']],
]
const holeBad = holes.filter(([k, hs]) => !hs.every((h) => textOf(k).includes(h))).map(([k]) => k)
check('C62 모르는 것은 지어내지 않고 [대괄호] — 문 연 날 · 새 상품 · 혜택 · 쉬는 날 · 가격 · 새 주소 · 인증 이름 · 급여 · 후기 자리', holeBad.length === 0, holeBad)
const openK = packOf(fp7, 'open').items[0].draft.blocks[0].text
check('C63 업체 사실은 그대로 — 차별점 · 대표 전화 · 판매 채널(문 연 소식) · 기록(인증 · 상 블로그) · 근무지 주소(채용)', openK.includes('시공 뒤 1년 무상 점검') && openK.includes('031-123-4567') && openK.includes('네이버 예약') && textOf('award').includes('벤처기업 인증') && textOf('hiring').includes('경기도 화성시 동탄산단 6길 15'), openK)
const hp = buildProfile(full, today, { industry: 'health' }).profile
const hHire = packOf(hp, 'hiring').items
const hEvent = packOf(hp, 'event').items
check('C64 채용 글 — 성별 · 나이 제한 금지 · 급여 실제와 같게(법 이름) · 업종 광고 주의는 안 붙임 / 행사 글에는 업종 주의 · 할인 표시 안내', hHire.every((x) => x.draft.notes.some((n) => n.includes('남녀고용평등법') && n.includes('채용절차법')) && !x.draft.notes.includes(CONTENT_LIB.health.caution as string)) && hEvent.every((x) => x.draft.notes.includes(CONTENT_LIB.health.caution as string) && x.draft.notes.some((n) => n.includes('할인'))), hHire[0].draft.notes)
const hCase = packOf(hp, 'caseDone')
const mCase = packOf(fp7, 'caseDone')
check('C65 병의원 · 뷰티는 사례 대신 진행 과정 소개(체험담 없음) · 제조는 사례 3편(블로그 · 영상 · 기록 증명 카드)', hCase.situation.label === '진행 과정을 소개해요' && hCase.items.every((x) => x.draft.input.topicType !== 'case') && mCase.items.length === 3 && mCase.items.every((x) => x.draft.input.topicType === 'case') && mCase.items[2].draft.input.adType === 'proof', [hCase.situation.label, mCase.items.map((x) => x.draft.input.topicType)])
const sitNow = (p: ContentProfile, d: string) => Object.fromEntries(situationsFor(p, d, HOLI).map((x) => [x.key, x.now]))
const nNew = sitNow(buildProfile(fresh, today).profile, today)
const nDec = sitNow(fp, '2026-12-10')
const nOct = sitNow(fp, today)
check('C66 지금 때 — 올해 문 연 업체 → 문 연 소식 · 공휴일 3주 안 → 쉬는 날(성탄절) · 12월 → 감사 인사 · 이번 달 이야기 달 · 10월 16일엔 쉬는 날 없음', !!nNew.open && !nOct.open && nDec.holiday === '12월 25일 성탄절' && !nOct.holiday && !!nDec.thanks && !nOct.thanks && nOct.season.startsWith('11월'), { nNew, nDec, nOct })
const cardsAll = allPacks.flatMap((sp) => sp.items.filter((x) => x.draft.kind === 'cards' && !x.draft.input.topicType))
const shortsNew = packOf(fp7, 'newItem').items.find((x) => x.draft.kind === 'shorts')!.draft
check('C67 카드뉴스 5장 + 올릴 때 쓰는 글 · 짧은 영상 27초(점검이 읽음) · 같은 상황 = 같은 묶음', cardsAll.length >= 6 && cardsAll.every((x) => x.draft.blocks.filter((b) => /^\d장/.test(b.label)).length === 5 && x.draft.blocks.at(-1)!.label === '올릴 때 쓰는 글') && draftChecks('shorts', shortsNew.blocks, fp7.industry).some((c) => c.key === 'dur' && c.text.includes('27초')) && JSON.stringify(packOf(fp7, 'move')) === JSON.stringify(packOf(fp7, 'move')), cardsAll.map((x) => x.draft.title))
const blogsKw = allPacks.flatMap((sp) => sp.items.filter((x) => x.draft.kind === 'blog' && x.draft.input.keyword && !x.draft.input.topicType))
const kwBad = blogsKw.filter((x) => draftChecks('blog', x.draft.blocks, fp7.industry, x.draft.input.keyword).some((c) => c.key === 'kw-title' || c.key === 'kw-first'))
check('C68 상황 블로그 — 제목 · 첫 문단에 키워드(점검 알림 없음) · 채용 글은 키워드 점검 안 함', blogsKw.length >= 5 && kwBad.length === 0 && !packOf(fp7, 'hiring').items[0].draft.input.keyword, kwBad.map((x) => x.draft.title))

const slots2 = monthPlan(fp, today, 2)
const slots4 = monthPlan(fp, today, 4)
const pd2 = planDrafts(fp, slots2, today)
const pd4 = planDrafts(fp, slots4, today)
const uniq = (ds: typeof pd4) => new Set(ds.map((d) => contentHash(d.kind, d.blocks))).size === ds.length
check('C69 한 달 치 한 번에 — 주 2회 8편 · 주 4회 16편 · 같은 글 0(같은 형식 · 주제는 다른 안) · 편마다 올릴 날', pd2.length === 8 && pd4.length === 16 && uniq(pd2) && uniq(pd4) && pd4.every((d, i) => d.input.planDate === slots4[i].date && d.kind === slots4[i].kind), pd4.map((d) => `${d.input.planDate} ${d.kind} v${d.input.variant}`))
const asItems = (ds: typeof pd4) => ds.map((d, i): ContentItem => ({ id: `p${i}`, kind: d.kind, title: d.title, blocks: d.blocks, input: d.input, rootId: `p${i}`, version: 1, favorite: false, hash: contentHash(d.kind, d.blocks), createdAt: '2026-10-16T01:00:00Z', updatedAt: '2026-10-16T01:00:00Z' }))
const its2 = asItems(pd2)
const posted2 = [...its2.filter((x) => x.rootId !== 'p0' && x.rootId !== 'p3'), ...withPosted(its2, 'p0', '2026-10-20T09:00:00Z'), ...withPosted(its2, 'p3', '2026-10-30T09:00:00Z')]
const st2 = planSlotStates(slots2, posted2)
const run2 = activePlan(posted2, '2026-10-29')
const run4 = activePlan(asItems(pd4), today)
check('C70 계획 칸 형편 — 만듦 8 · 올림 2 · 날이 지나도(10/29) 같은 계획(월요일 · 주 2회 · 같은 날짜) · 주 4회 알아봄 · 끝난 계획은 null · 날짜 없는 글뿐이면 null', st2.filter((x) => x.item).length === 8 && st2.filter((x) => x.posted).length === 2 && st2[0].posted && st2[3].posted && run2?.monday === '2026-10-19' && run2.perWeek === 2 && monthPlanFrom(fp, run2.monday, 2, '2026-10-29').map((x) => x.date).join() === slots2.map((x) => x.date).join() && run4?.perWeek === 4 && activePlan(posted2, '2026-11-30') === null && activePlan([item], today) === null, { run2, run4, st: st2.map((x) => [!!x.item, x.posted]) })
// D-221 계획 정보를 글에 남김 — 주 4회 계획에서 화요일 글 하나 · 둘째 주 글 하나만 저장해도 같은 계획
const tue4 = asItems(pd4).filter((x) => x.input.planDate === slots4[1].date)
const wk2 = asItems(pd4).filter((x) => x.input.planDate === slots4[5].date)
const legacy4 = tue4.map((x) => ({ ...x, input: { ...x.input, planStart: undefined, planPer: undefined } }))
const rt = normalizeItem('t1', itemData(tue4[0]))
const rtBad = normalizeItem('t1', { ...itemData(tue4[0]), input: { ...tue4[0].input, planStart: '2026/10/19', planPer: 3 } })
const shownSlot = pd4[1]
const again = keepPlan(makeDraft(fp, { kind: shownSlot.kind, variant: 9 }, today), shownSlot.input)
const after = (n: number) => { const d = new Date(`${slots4[0].date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
check('C84 계획 정보 — 칸 · 글마다 시작 월요일 · 주 4회 · 화요일 글 하나만 있어도 주 4회 · 둘째 주 글 하나만 있어도 시작 그대로 · 마지막 칸 지나면 끝 · 예전 글은 짐작(화요일만 → 주 2회) · 저장 → 읽기 그대로 · 망가진 값 버림 · 다른 안도 같은 칸',
  slots4.every((sl) => sl.start === slots4[0].date && sl.per === 4) && pd4.every((d) => d.input.planStart === slots4[0].date && d.input.planPer === 4) &&
  activePlan(tue4, today)?.perWeek === 4 && activePlan(tue4, today)?.monday === slots4[0].date && activePlan(wk2, today)?.monday === slots4[0].date &&
  activePlan(tue4, after(25)) !== null && activePlan(tue4, after(26)) === null && activePlan(legacy4, today)?.perWeek === 2 &&
  rt?.input.planStart === slots4[0].date && rt?.input.planPer === 4 && rtBad?.input.planStart === undefined && rtBad?.input.planPer === undefined && rtBad?.input.planDate === tue4[0].input.planDate &&
  again.input.planDate === shownSlot.input.planDate && again.input.planStart === slots4[0].date && again.input.planPer === 4 && keepPlan(again, { variant: 0, tone: 'friendly' }) === again,
  { tue: activePlan(tue4, today), wk2: activePlan(wk2, today), legacy: activePlan(legacy4, today), rt: rt?.input })
// D-221 보관함 제목은 글 안 제목 칸을 따라간다(고친 판 · 대괄호 채움)
const blogD = makeDraft(fp, { kind: 'blog', topic: topics[0] }, today)
const blogIt: ContentItem = { id: 'b1', kind: 'blog', title: blogD.title, blocks: blogD.blocks, input: blogD.input, rootId: 'b1', version: 1, favorite: false, hash: contentHash('blog', blogD.blocks), createdAt: '2026-10-16T01:00:00Z', updatedAt: '2026-10-16T01:00:00Z' }
const editedT = blogD.blocks.map((b) => (b.hint === '제목' ? { ...b, text: '화성 금속부품, 이것만 보면 됩니다\n(둘째 줄)' } : b))
const v2T = nextVersion([blogIt], blogIt, editedT, 'b2', '2026-10-17T01:00:00Z')
const kakaoD = makeDraft(fp, { kind: 'kakao', purpose: 'news' }, today)
check('C85 보관함 제목 — 제목 칸을 고쳐 저장하면 새 제목(첫 줄만) · 제목 칸 없는 글(카톡)은 그대로 · 빈 제목 칸이면 그대로',
  blogIt.title === titleOf(blogD.blocks, 'x') && v2T.title === '화성 금속부품, 이것만 보면 됩니다' && titleOf(kakaoD.blocks, kakaoD.title) === kakaoD.title && titleOf(blogD.blocks.map((b) => (b.hint === '제목' ? { ...b, text: ' ' } : b)), '옛 제목') === '옛 제목',
  { v2: v2T.title, blog: blogIt.title })
const itS = { ...item, id: 's1', rootId: 's1', postedAt: '2026-10-20T09:00:00Z', input: { ...item.input, situation: 'move', planDate: '2026-10-20' } }
const backS = normalizeItem('s1', itemData(itS))
const badS = normalizeItem('s1', { ...itemData(itS), postedAt: 123, input: { ...itS.input, situation: 'hack', planDate: '2026/10/20' } })
const chain = latestByRoot([{ ...itS, version: 1 }, { ...itS, id: 's2', version: 2, postedAt: undefined }])
check('C71 보관함에 상황 · 올릴 날 · 올린 때가 남음 · 이상한 값은 버림 · 고친 판에도 올림 표시가 이어짐', backS?.input.situation === 'move' && backS.input.planDate === '2026-10-20' && backS.postedAt === '2026-10-20T09:00:00Z' && badS?.input.situation === undefined && badS?.input.planDate === undefined && badS?.postedAt === undefined && chain[0].item.id === 's2' && chain[0].item.postedAt === '2026-10-20T09:00:00Z', { backS: backS?.input, chain: chain[0].item.postedAt })

/* ---------------- D-208 고침(게이트 뒤 코드 점검) ---------------- */
const foodP = buildProfile(fresh, today, { industry: 'food' }).profile
const foodSlots = monthPlan(foodP, today, 4)
const foodDrafts = planDrafts(foodP, foodSlots, today)
const keyOf = (d: { kind: ContentKind; blocks: { label: string; text: string }[] }) => `${d.kind}\u0000${plainText(d.kind, d.blocks)}`
check('C72 이번 달 이야기가 없는 업종(음식 · 10월)도 한 달 치 16편이 모두 다른 글 — 같은 글로 여겨 칸이 비지 않음', new Set(foodDrafts.map(keyOf)).size === 16 && foodDrafts.every((d, i) => d.input.planDate === foodSlots[i].date), foodDrafts.map((d) => `${d.kind}/${d.input.topicType}/v${d.input.variant}`))
const takenSet = new Set(pd2.map(keyOf))
const nextMonth = planDrafts(fp, slots2.map((s) => ({ ...s, date: s.date.replace('2026-10', '2026-11') })), today, (d) => takenSet.has(keyOf(d)))
check('C73 이미 보관함에 있는 글(지난 계획)과 같은 글은 다른 안으로 — 블로그 · 영상 · 카드 · 카톡 모두 새 글', nextMonth.filter((d) => takenSet.has(keyOf(d))).length === 0, nextMonth.filter((d) => takenSet.has(keyOf(d))).map((d) => d.kind))
check('C74 짧은 영상 안내 길이 = 실제 대본(20~60초 · 40초라고 쓰지 않음)', !JSON.stringify(firstPicks(fp, today)).includes('40초'))

/* ---------------- D-209 [대괄호] 한 번에 채우기 · 점검이 칸 이름을 빈 칸으로 세지 않기 · 먼저 만들 것 로컬 날짜 ---------------- */
// 짧은 영상 · 긴 영상 · 카드뉴스는 복사할 때 칸 이름을 [0:00 - 0:03] · [1장] 처럼 감싼다 — 이건 채울 자리가 아니다
const noHoleKinds = (['shorts', 'video', 'cards'] as const).map((k) => {
  const t = topicsFor(fp, '', today)
  const d = makeDraft(fp, { kind: k, topic: t[0] }, today)
  const clean = d.blocks.map((b) => ({ ...b, text: b.text.replace(/\[[^\]\n]{1,80}\]/g, '채움') }))
  return { k, holes: draftChecks(k, clean, fp.industry).find((c) => c.key === 'holes')?.text ?? '' }
})
check('C75 본문 [대괄호] 를 다 채운 짧은 영상 · 긴 영상 · 카드뉴스는 "[대괄호] 채우기" 가 남지 않음(칸 이름은 빈 칸이 아님)', noHoleKinds.every((x) => !x.holes), noHoleKinds)
const evPack = situationPack(fp7, 'event', today)
const evNames = holeNames(evPack.items.map((x) => x.draft.blocks))
check('C76 묶음 빈 칸 이름 — 겹치는 이름은 한 번만 · 나온 순서대로 · 칸 이름(라벨)은 넣지 않음', evNames.length > 0 && new Set(evNames).size === evNames.length && !evNames.some((n) => /^\d+:\d{2}|^\d+장$/.test(n)), evNames)
const evVals = Object.fromEntries(evNames.map((n, i) => [n, `값${i}$&$1`]))
const evFilled = evPack.items.map((x) => fillHoles(x.draft.blocks, evVals))
check('C77 한 번 적으면 묶음 모든 글의 같은 [대괄호] 가 바뀜 · $& 같은 기호도 그대로 · 남은 빈 칸 0', evFilled.every((f, i) => f.filled > 0 && draftChecks(evPack.items[i].draft.kind, f.blocks, fp7.industry).every((c) => c.key !== 'holes')) && evFilled.some((f) => f.blocks.some((b) => b.text.includes('값0$&$1'))), evFilled.map((f) => f.filled))
const half = fillHoles(evPack.items[0].draft.blocks, { [evNames[0]]: '  ', [evNames[1] ?? 'x']: '' })
check('C78 빈 값 · 띄어쓰기만 적은 칸은 그대로 [대괄호] 로 남음(지우지 않음)', half.filled === 0 && JSON.stringify(half.blocks) === JSON.stringify(evPack.items[0].draft.blocks))
const packHoles = SITUATION_KEYS.map((k) => ({ k, names: holeNames(situationPack(fp7, k, today).items.map((x) => x.draft.blocks)) }))
check('C79 상황 12가지 모두 빈 칸 입력 이름(— 앞)이 30자 안 · 괄호 · 줄바꿈 없음', packHoles.every((x) => x.names.every((n) => holeLabel(n).label.length <= 30 && !/[[\]\n]/.test(n))), packHoles.map((x) => x.names.filter((n) => holeLabel(n).label.length > 30)).flat())
const optName = packHoles.find((x) => x.k === 'open')?.names.find((n) => holeLabel(n).optional) ?? ''
const openPk = situationPack(fp7, 'open', today)
const dropped = openPk.items.map((x) => fillHoles(x.draft.blocks, {}, [optName]))
check('C81 "없으면 지워 주세요" 칸은 [없어요] 로 그 줄만 지움 — 다른 줄 · 다른 [대괄호] 는 그대로 · 빈 칸 칸은 뺌', !!optName && holeLabel(optName).optional && dropped.every((f) => !f.blocks.some((b) => b.text.includes(`[${optName}]`))) && dropped.some((f, i) => f.filled > 0 && f.blocks.length <= openPk.items[i].draft.blocks.length) && dropped.every((f) => f.blocks.every((b) => b.text.trim().length > 0)), { optName, n: dropped.map((f) => f.filled) })
const grp = holeGroups(['다른 곳과 다른 점 한 가지', '다른 곳과 다른 점 한 가지 — 업체와 확인해 적어 주세요', '기간', '혜택 — 없으면 이 줄을 지워 주세요'])
check('C82 같은 이름(— 앞)의 빈 칸은 입력 하나로 묶음 · 도움말은 있는 쪽 · 없어도 되는 칸 표시', grp.length === 3 && grp[0].names.length === 2 && grp[0].hint === '업체와 확인해 적어 주세요' && !grp[1].optional && grp[2].optional, grp)
// 먼저 만들 것 — 한국 오전 9시 전에 저장한 글(UTC 로는 어제)도 그날 만든 글로 센다
const prevTz = process.env.TZ
process.env.TZ = 'Asia/Seoul'
const longAgo = '2026-10-01T03:00:00.000Z'
const doneMost: MadeItem[] = [
  { kind: 'keywords', createdAt: longAgo },
  { kind: 'place', createdAt: longAgo },
  { kind: 'blog', topicType: 'intro', createdAt: longAgo },
  { kind: 'blog', topicType: 'choose', createdAt: longAgo },
  { kind: 'blog', topicType: 'faq', createdAt: longAgo },
  { kind: 'kakao', purpose: 'news', createdAt: longAgo },
  { kind: 'shorts', topicType: 'tips', createdAt: '2026-10-15T23:30:00.000Z' }, // 한국 10/16 08:30
]
const kstPicks = firstPicks(fp, '2026-11-15', doneMost)
if (prevTz === undefined) delete process.env.TZ
else process.env.TZ = prevTz
check('C80 먼저 만들 것 — 한국 10/16 오전에 만든 짧은 영상은 11/15 에 "30일 안" (UTC 날짜 10/15 로 세어 다시 권하지 않음)', !kstPicks.some((p) => p.key === 'shorts'), kstPicks.map((p) => p.key))

/* ------------------------------------------------------------------ */
/* D-228 재료 · 공식 · 사실 대조 · 다른 AI 도구 요청문                        */
/* ------------------------------------------------------------------ */
{
  const mat = normalizeOverrides({ reviews: '네이버 후기 1,240개 · 평점 4.8', voice: '“납기를 하루도 안 넘겨요”', offer: '첫 견적 고객 시제품 1개 무상', offerUntil: '2026-10-31', price: '시제품 1개 5만 원부터', speaker: '대표 김한솔', differ: '도면 받은 날 바로 회신해요' })
  check('C90 재료 칸 읽기 — 후기 · 한마디 · 혜택 · 기한 · 가격 · 말하는 사람(이상한 기한은 버림)', mat.reviews === '네이버 후기 1,240개 · 평점 4.8' && mat.offerUntil === '2026-10-31' && mat.speaker === '대표 김한솔' && normalizeOverrides({ offerUntil: '10월 31일' }).offerUntil === undefined && normalizeOverrides({ reviews: 'x'.repeat(200) }).reviews?.length === 60, mat)
  const mp = buildProfile(full, today, mat).profile
  check('C91 프로필 — 한마디 따옴표 벗김 · 혜택 기한 그대로 · 혜택 한 줄에 기한(10월 31일까지)', mp.voice === '납기를 하루도 안 넘겨요' && offerLine(mp) === '첫 견적 고객 시제품 1개 무상(10월 31일까지)' && mp.offerExpired === '', { voice: mp.voice, offer: offerLine(mp) })
  const old = buildProfile(full, '2026-11-02', mat).profile
  check('C92 기한 지난 혜택은 글에 안 씀 · "이 칸만 채우면" 맨 앞에 기한 지남 안내', old.offer === '' && offerLine(old) === '' && old.offerExpired === '첫 견적 고객 시제품 1개 무상' && profileGaps(old)[0].key === 'offer' && profileGaps(old)[0].why.includes('기한이 지났'), profileGaps(old))
  const t0 = topicsFor(mp, '', today)
  const choose = t0.find((x) => x.type === 'choose')!
  const blog = makeDraft(mp, { kind: 'blog', topic: { ...choose }, variant: 0 }, today)
  const blogT = plainText('blog', blog.blocks)
  const author = blog.blocks.find((b) => b.label === '이 글을 쓴 곳')
  check('C93 블로그 — 고객 속마음 인용 없음(망설이는 점 비어 있음) · 이 글을 쓴 곳 표 = 넣은 사실만(쓴 사람 · 회사 · 하는 일 · 기록 · 후기)', !!author && author.text.includes('쓴 사람 | 한솔정밀(주) 대표 김한솔') && author.text.includes('후기 | 네이버 후기 1,240개 · 평점 4.8') && author.text.includes('2014년부터') && !blogT.startsWith('"'), author?.text)
  const mpObj = buildProfile(full, today, { ...mat, objection: '처음 맡기면 비싸지 않을까' }).profile
  const blogQ = makeDraft(mpObj, { kind: 'blog', topic: choose, variant: 0 }, today)
  const first = blogQ.blocks.find((b) => b.hint?.startsWith('첫 문단'))!.text
  check('C94 블로그 첫 문단 — 망설이는 점을 고객 속마음 한 줄로 시작 · 키워드는 그대로', first.startsWith('"처음 맡기면 비싸지 않을까"') && first.includes(choose.keyword), first)
  check('C95 블로그 문의 칸 — 이번 달 혜택(기한) · 가격 조건 · 정리에 고객 한마디', blogT.includes('이번 달 혜택 — 첫 견적 고객 시제품 1개 무상(10월 31일까지)') && blogT.includes('가격 · 조건 — 시제품 1개 5만 원부터') && blogT.includes('실제로 이런 말을 들어요 — "납기를 하루도 안 넘겨요"'))
  const proof = makeDraft(mp, { kind: 'cards', topic: t0[0], adType: 'proof', pages: 7 }, today)
  const pages = proof.blocks.filter((b) => /^\d+장/.test(b.label))
  check('C96 카드뉴스 기록 증명형 — 첫 장 = 후기 수(재료) · 고객 한마디 장 · 장 번호 이어짐 · 마지막 장 = 혜택 + 기한', pages[0].text.includes('큰 글자: 네이버 후기 1,240개 · 평점 4.8') && pages.some((b) => b.label.includes('고객 한마디') && b.text.includes('"납기를 하루도 안 넘겨요"')) && pages.map((b) => Number(/^(\d+)장/.exec(b.label)![1])).join() === '1,2,3,4,5,6,7' && pages.at(-1)!.text.includes('첫 견적 고객 시제품 1개 무상(10월 31일까지)'), pages.map((b) => b.label))
  const noMatProof = makeDraft(fp, { kind: 'cards', topic: topicsFor(fp, '', today)[0], adType: 'proof', pages: 7 }, today)
  const nmp = noMatProof.blocks.filter((b) => /^\d+장/.test(b.label))
  check('C97 재료 없으면 지어내지 않음 — 첫 장 = 설립 연수(업체 기록) · 마지막 장 혜택 없음 · 선착순 · 할인 0', nmp[0].text.includes('화성 12년, 정밀 금속부품') && !/혜택|선착순|할인|증정/.test(plainText('cards', noMatProof.blocks)), nmp[0].text)
  const hp = buildProfile(full, today, { ...mat, industry: 'health' }).profile
  const hCards = plainText('cards', makeDraft(hp, { kind: 'cards', topic: topicsFor(hp, '', today)[0], adType: 'proof', pages: 7 }, today).blocks)
  const hBlog = plainText('blog', makeDraft(hp, { kind: 'blog', topic: topicsFor(hp, '', today)[1], variant: 0 }, today).blocks)
  check('C98 의료 — 혜택 · 고객 한마디를 카드 · 블로그에 싣지 않음(의료광고)', !hCards.includes('무상') && !hCards.includes('납기를') && !hBlog.includes('이번 달 혜택') && !hBlog.includes('고객 한마디'), hCards.slice(0, 120))
  const ev = plainText('kakao', makeDraft(mp, { kind: 'kakao', purpose: 'event' }, today).blocks)
  check('C99 카톡 혜택 — 적어 둔 혜택 · 끝나는 날(10월 31일) 그대로 · 시작일은 빈칸 · (광고) 맨 앞', ev.startsWith('(광고) ') && ev.includes('첫 견적 고객 시제품 1개 무상') && ev.includes('[시작일] ~ 10월 31일') && ev.includes('가격 · 조건: 시제품 1개 5만 원부터'), ev)
  const vid = makeDraft(mp, { kind: 'video', topic: choose, variant: 0 }, today)
  const series = videoSeries(mp, choose)
  const end = vid.blocks.find((b) => b.label.endsWith('· 마무리'))!.text
  check('C100 영상 — 5편 순서(깊게 → 손해 피하기 → 넓히기 → 결정 직전 → 우리 업체) · 1편에 업력(기록) · 마무리 전 다리 문장', series.length === 5 && series[0].title.includes('(12년 차 한솔정밀(주))') && series[4].title.startsWith('한솔정밀(주)만의 진행 방식') && ['깊게', '손해 피하기', '넓히기', '결정 직전', '우리 업체'].every((r, i) => series[i].role.startsWith(r)) && vid.blocks.some((b) => b.label === '이 주제로 이어 찍을 5편') && end.includes('오늘 말한') && end.includes('이렇게 지켜요') && end.includes('도면 받은 날 바로 회신해요'), series.map((x) => x.title))
  const s60 = makeDraft(mp, { kind: 'shorts', topic: choose, shortLen: '30-60' }, today)
  const s60t = plainText('shorts', s60.blocks)
  check('C101 쇼츠 30~60초 — 첫째 · 둘째 · "셋째가 제일 중요한데요"(끝까지 보는 고리) · "그럼 … 냐고요?"(질문으로 넘기기) · 저장 · 6구간 45초 그대로', s60t.includes('첫째,') && s60t.includes('둘째,') && s60t.includes('셋째가 제일 중요한데요.') && /그럼 뭘 확인하면 되냐고요\?/.test(s60t) && s60t.includes('저장해 두고') && s60t.includes('0:38 - 0:45'), s60t.slice(0, 300))
  // 사실 대조 — 우리 엔진이 만든 글은 거짓 경보 0(전 업종 · 전 형식)
  const falseAlarm: unknown[] = []
  let drafts = 0
  for (const ind of INDUSTRIES) {
    const ip = buildProfile(full, today, { ...mat, industry: ind }).profile
    const ip0 = buildProfile(full, today, { industry: ind }).profile
    for (const pp of [ip, ip0]) {
      for (const kind of CONTENT_KINDS) {
        for (const topic of topicsFor(pp, '', today)) {
          for (const adType of AD_TYPES) {
            if (kind !== 'cards' && adType !== 'info') continue
            const d = makeDraft(pp, { kind, topic, adType, purpose: 'event', shortLen: '30-60' }, today)
            drafts += 1
            const f = factChecks(plainText(d.kind, d.blocks), pp)
            if (f.length) falseAlarm.push({ ind, kind, adType, keys: f.map((x) => x.key), text: f[0].text })
          }
        }
      }
    }
  }
  check(`C102 사실 대조 — 우리가 만든 글 ${drafts}편(${INDUSTRIES.length}업종 · 7형식 · 재료 있음/없음)에는 거짓 경보 0`, falseAlarm.length === 0 && drafts > 300, falseAlarm.slice(0, 3))
  const bad = '[주제 내용]\n10년 차 전문가가 직접 골랐어요. 1,240명이 매달 재구매! 무료 배송 · 오늘만 30% 할인, 선착순 100명 사은품 증정. 식품연구소에서 권장한 방법으로, 편의점 도시락은 나트륨 덩어리예요. 다른 업체보다 못한 곳은 없어요? 고객 후기 "여기 아니면 안 맡겨요" 라는 말이 많아요.'
  const keys = factChecks(bad, mp).map((x) => x.key)
  check('C103 받은 글 점검 — 주지 않은 무료 배송 · 할인 · 증정 · 선착순 · 오늘만 / 지어낸 출처 / 다른 상품 깎기 / 업력 모순(10년 ≠ 12년) / 후기 수 → 재구매 고객 수 / 주지 않은 후기 문장', ['policy-무료 배송', 'policy-할인', 'policy-증정', 'policy-선착순', 'policy-오늘만 · 마감 임박', 'source', 'bash', 'years', 'reviews-meaning', 'voice-made'].every((k) => keys.includes(k)), keys)
  const okGiven = factChecks('첫 견적 고객 시제품 1개 무상 · 증정은 없어요', buildProfile(full, today, { ...mat, offer: '첫 주문 사은품 증정' }).profile).map((x) => x.key)
  check('C104 홍보 정보에 적힌 혜택은 경보 없음(증정을 적어 두면 증정 경보 0)', !okGiven.includes('policy-증정'), okGiven)
  const okVoice = factChecks('고객 후기 "납기를 하루도 안 넘겨요" 라는 말을 자주 들어요.', mp).map((x) => x.key)
  check('C104b 적어 둔 고객 한마디를 그대로 쓴 후기는 경보 없음', !okVoice.includes('voice-made'), okVoice)
  const dc = draftChecks('blog', [{ label: '', text: bad }], mp.industry, undefined, mp).map((x) => x.key)
  check('C105 글 점검(draftChecks)에 사실 대조가 붙음 · 프로필 없이 부르면 예전 그대로', dc.includes('source') && dc.includes('holes') && !draftChecks('blog', [{ label: '', text: bad }], mp.industry).some((x) => x.key === 'source'), dc)
  check('C106 검색량 등급 — 1,000↑ 많이 · 100↑ 보통 · 10↑ 적게 · 10 아래 · "< 10" 거의 안 찾음 · 숫자 없음', volumeTier({ total: 5790, small: false }) === 'high' && volumeTier({ total: 100, small: false }) === 'mid' && volumeTier({ total: 99, small: false }) === 'low' && volumeTier({ total: 9, small: false }) === 'tiny' && volumeTier({ total: 0, small: true }) === 'tiny' && volumeTier({ total: null, small: false }) === 'none')
  const req = aiRequestText(mp)
  check('C107 다른 AI 도구 요청문 — 업체 · 독자 · 알리는 것 · 화자(이름 하나) · 사실 목록(밖은 금지) · 넣지 말 것(자금 · 컨설팅 · 지어낸 출처)', /^업체: 한솔정밀\(주\)\(경기 화성시, /.test(req) && req.includes('독자(보는 사람):') && req.includes('알리는 것: 한솔정밀(주)의 정밀 금속부품') && req.includes("화자: 한솔정밀(주)의 대표 '김한솔' (이름은 이것만 쓰세요)") && req.includes('이 목록 밖의 숫자 · 혜택 · 후기 · 정책 · 사례는 쓰지 마세요') && req.includes('- 설립 12년째(2014년)') && req.includes('- 후기·평점: 네이버 후기 1,240개 · 평점 4.8 / 후기 출처:') && req.includes('- 이번 달 혜택: 첫 견적 고객 시제품 1개 무상(10월 31일까지)') && req.includes('정책자금 · 지원금 · 컨설팅') && !req.includes('010-9999-8888'), req)
  const reqE = aiRequestText(ep)
  const reqH = aiRequestText(hp)
  check('C108 요청문 — 사실 없는 업체는 "숫자 · 혜택 · 후기를 넣지 마세요" · 이름 없으면 "사람 이름은 쓰지 마세요" · 의료는 규정 줄 · 혜택 · 한마디 빼기 · 설립 연수 줄 하나만', reqE.includes('숫자 · 혜택 · 후기를 넣지 마세요') && reqE.includes('사람 이름은 쓰지 마세요') && reqH.includes('의료광고 규정') && !reqH.includes('무상') && !reqH.includes('납기를') && aiRequestFacts(mp).filter((f) => f.startsWith('설립')).length === 1, reqE)
}

/* ------------------------------------------------------------------ */
/* D-229 콘텐츠 작성 규칙집(1~3차 관찰 합본) 대조                                                     */
/* ------------------------------------------------------------------ */
{
  const rov = normalizeOverrides({ rebuttal: '“소량은 아무 데나 맡겨도 똑같다”', shipping: '전국 택배 · 3만 원 이상 무료 배송', avoid: '최저가, 할인, x', speaker: '대표', differ: '도면 받은 날 바로 회신해요', objection: '소량도 받아 줄까' })
  const { profile: rp, source: rs } = buildProfile(full, today, rov)
  check('C110 브리프 새 칸 — 흔한 반박(따옴표 벗김) · 배송 · 교환 조건 · 넣지 말 것(쉼표로 나눔 · 한 글자 버림)', rp.rebuttal === '소량은 아무 데나 맡겨도 똑같다' && rp.shipping.startsWith('전국 택배') && rp.avoid.join() === '최저가,할인' && normalizeOverrides({ avoid: 'x'.repeat(300) }).avoid?.length === 200, { r: rp.rebuttal, a: rp.avoid })
  const slots = briefSlots(rp, rs)
  check('C111 브리프 7칸(D-234 ⟲4차) — 업체 · 독자 · 알리는 것 · 화자 · 사실 목록 · 구매·문의처 · 넣지 말 것 / 직함만 적은 화자는 비었다고 · 재료 n/7', slots.map((x) => x.key).join() === 'company,target,item,speaker,facts,contact,avoid' && slots.find((x) => x.key === 'speaker')!.ok === false && slots.find((x) => x.key === 'speaker')!.note.includes('이름') && /재료 \d+\/7/.test(slots.find((x) => x.key === 'facts')!.note) && slots.find((x) => x.key === 'avoid')!.note.includes('2개') && profileGaps(rp).some((g) => g.key === 'speaker' && g.why.includes('이름도')), slots)
  check('C112 재료 목록 — 경력 · 배송 조건 · 차별점 · 인증(설립 N년째는 경력으로 한 번만)', materialList(rp).includes('경력 12년') && materialList(rp).some((m) => m.startsWith('전국 택배')) && !materialList(rp).some((m) => /^설립/.test(m)) && materialList(ep).length === 0, materialList(rp))

  // 블로그 — 규칙집 3-1
  const blogBad: unknown[] = []
  for (const ind of INDUSTRIES) {
    for (const pp of [buildProfile(full, today, { industry: ind }).profile, buildProfile(full, today, { ...rov, speaker: '대표 김한솔', industry: ind }).profile, buildProfile(empty, today, { industry: ind }).profile]) {
      for (const tt of ['tips', 'choose', 'faq', 'season'] as const) {
        const tp = topicsFor(pp, '', today).find((x) => x.type === tt)
        if (!tp) continue
        const d = makeDraft(pp, { kind: 'blog', topic: tp }, today)
        const title = d.blocks[0].text
        const tx = plainText('blog', d.blocks)
        const heads = d.blocks.filter((b) => b.hint?.startsWith('소제목')).length
        const photos = d.blocks.filter((b) => b.text.startsWith('(사진 자리:')).length
        const tables = d.blocks.filter((b) => /^[^\n|]+ \| [^\n|]+\n/.test(b.text)).length
        const end = d.blocks.find((b) => b.hint?.startsWith('끝'))?.text ?? ''
        const ok = title.startsWith(`${tp.keyword},`) && title.includes('2가지') && heads === 3 && photos >= 4 && photos <= 7 && tables <= 1 && end.includes(CONTENT_LIB[ind].softAsk) && !/예약하세요|연락하세요|신청하세요/.test(end) && (pp.differ ? end.includes(pp.differ) : end.includes('[앞의 2가지 기준')) && tx.includes('(구분선)') && tx.includes('관련 글 [') && (ind !== 'health' || tx.includes(CARE_NOTE)) && (!pp.rebuttal || tx.includes(`"${pp.rebuttal}"`))
        if (!ok) blogBad.push({ ind, tt, title, heads, photos, tables, end: end.slice(0, 80) })
      }
    }
  }
  check('C113 블로그 브랜드형 — 키워드로 시작 + 쉼표 · 기준 2가지 · 소제목 3 · 사진 4~7 · 표 1개 이하 · 끝은 부드럽게(직접 명령 없음) · 다리 문장(차별점 있으면 그 말, 없으면 빈칸) · 의료 개인차 안내 · 흔한 반박', blogBad.length === 0, blogBad.slice(0, 3))
  const lens = INDUSTRIES.map((ind) => buildProfile(full, today, { industry: ind }).profile).flatMap((pp) => topicsFor(pp, '', today).filter((x) => x.type === 'tips' || x.type === 'choose').map((x) => x.title.length))
  check(`C114 블로그 제목 25~35자 — 업종 ${INDUSTRIES.length} × 정보 · 기준(${Math.min(...lens)}~${Math.max(...lens)}자)`, lens.every((n) => n >= 25 && n <= 35), lens)

  // 영상 — 규칙집 3-3
  const vidBad: unknown[] = []
  for (const ind of INDUSTRIES) {
    for (const pp of [buildProfile(full, today, { industry: ind }).profile, buildProfile(empty, today, { industry: ind }).profile]) {
      for (const tp of topicsFor(pp, '', today)) {
        const d = makeDraft(pp, { kind: 'video', topic: tp }, today)
        const title = d.blocks[0].text
        const thumb = d.blocks.find((b) => b.label === '썸네일 문구')!.text
        const intro = /말: (.*)/.exec(d.blocks.find((b) => b.label.startsWith('도입부'))!.text)![1]
        const sentences = intro.split(/(?<=[.?!])\s+/).filter(Boolean).length
        const cps = d.blocks.filter((b) => b.hint === '소제목 — 체크포인트').length
        const turns = (plainText('video', d.blocks).match(/그런데 이것보다|여기까지는 기본|가장 많이 놓치는/g) ?? []).length
        const holes = placeholders(title).length + placeholders(thumb).length
        const area = [pp.area, ...pp.region.split(/\s+/)].filter((w) => w.length >= 2)
        const b2b = isB2B(pp)
        const titleOk = holes > 0 || (b2b ? title.length >= 25 && title.length <= 35 && !/ \([^)]*\)$/.test(title) : title.length >= 40 && title.length <= 55 && / \(.+\)$/.test(title))
        const thumbOk = placeholders(thumb).length > 0 || (thumb.length >= 20 && thumb.length <= 35 && /\d/.test(thumb))
        const ok = !area.some((w) => title.includes(w) || thumb.includes(w)) && titleOk && thumbOk && (tp.type === 'case' || (intro.length >= 100 && intro.length <= 160 && sentences >= 3 && sentences <= 5)) && cps === 3 && turns >= 3 && d.title === title && (ind !== 'health' || plainText('video', d.blocks).includes(CARE_NOTE))
        if (!ok) vidBad.push({ ind, type: tp.type, title, tl: title.length, thumb, thl: thumb.length, il: intro.length, sentences, cps, turns })
      }
    }
  }
  check('C115 긴 영상 — 제목 · 썸네일에 지역 없음 · 기업형 25~35자 괄호 없음 / 소비자형 40~55자 (괄호 꼬리말) · 썸네일 20~35자 + 숫자 · 도입부 3~5문장 100~160자 · 체크포인트 3 · 반전 문장 3 · 의료 개인차', vidBad.length === 0, vidBad.slice(0, 3))
  check('C116 지역 빼기 — "화성 정밀 금속부품" → "정밀 금속부품" · 영상 5편도 지역 없음', withoutArea(fp, '화성 정밀 금속부품') === '정밀 금속부품' && videoSeries(fp, topics[0]).every((x) => !x.title.includes('화성')) && videoTitle(fp, topics[1], 3).startsWith('정밀 금속부품 업체 고를 때 꼭 볼 3가지') && videoThumb(fp, topics[0], 3).length >= 20)

  // 쇼츠 · 카드 — 규칙집 3-4 · 3-5
  const shBad: unknown[] = []
  for (const ind of INDUSTRIES) {
    const pp = buildProfile(full, today, { industry: ind }).profile
    for (const tp of topicsFor(pp, '', today)) for (const sl of ['20-30', '30-60'] as const) {
      const d = makeDraft(pp, { kind: 'shorts', topic: tp, shortLen: sl }, today)
      const fixed = d.blocks.find((b) => b.label === '고정 문구')!.text
      const rows = d.blocks.filter((b) => /^\d:\d{2} - /.test(b.label)).map((b) => b.text).join('\n')
      const tags = (d.blocks.find((b) => b.label === '캡션')!.text.match(/#\S+/g) ?? []).length
      if (!(placeholders(fixed).length || (fixed.length >= 14 && fixed.length <= 22)) || rows.includes('안녕하세요') || tags > 5) shBad.push({ ind, type: tp.type, sl, fixed, fl: fixed.length, tags })
    }
  }
  check('C117 쇼츠 — 상단 문구 14~22자 · 인사 없이 바로 · 캡션 해시태그 5개 이하(업종 × 주제 × 길이)', shBad.length === 0, shBad.slice(0, 3))
  const before = plainText('cards', makeDraft(fp, { kind: 'cards', topic: topics[0], adType: 'before', pages: 7 }, today).blocks)
  const hpB = buildProfile(full, today, { industry: 'health' }).profile
  const beforeH = makeDraft(hpB, { kind: 'cards', topic: topicsFor(hpB, '', today)[0], adType: 'before', pages: 7 }, today)
  const curious = makeDraft(fp, { kind: 'cards', topic: topics[0], adType: 'curious', pages: 7 }, today)
  check('C118 카드 전후 변화형 — 전 · 후는 빈칸(실제 사례만) / 의료는 전후 없이 과정만 + 안내 · 궁금증형 표지 · 마지막 장 의료 개인차', before.includes('[전]: [바꾸기 전 모습] → [후]: [바뀐 뒤 모습]') && !plainText('cards', beforeH.blocks).includes('[전]') && beforeH.notes.some((n) => n.includes('전후 비교를 쓰지 않아요')) && plainText('cards', beforeH.blocks).includes(CARE_NOTE) && curious.blocks[0].text.includes('고를 때 이것은 꼭 보래요'))

  // 점검 — 규칙집 5장 · 6장
  const fk = (txt: string, pp = fp) => factChecks(txt, pp).map((x) => x.key)
  const rpOffer = buildProfile(full, today, { offer: '첫 주문 증정', offerUntil: '2026-11-30' }).profile
  check('C119 통계형 · 기간 한정 · 업체 모아 소개 — "10명 중 7~8명" · 기한 없는 "11월 한정" · 기한과 다른 달 · 같은 달은 통과 · "맛집 5곳 총정리"', fk('10명 중 7~8명이 놓쳐요').includes('stat') && fk('11월 한정 특가').includes('month-limit') && fk('12월 한정', rpOffer).includes('month-limit') && !fk('11월 한정', rpOffer).includes('month-limit') && fk('동네 맛집 5곳 총정리').includes('roundup'))
  const hp2 = buildProfile(full, today, { industry: 'health' }).profile
  const ed2 = buildProfile(full, today, { industry: 'education' }).profile
  check('C120 압박형은 의료 · 교육만 · 업체가 막은 말 · 배송 조건에 적은 무료 배송은 통과', fk('지금 안 하면 내년에 후회해요', hp2).includes('pressure') && fk('지금 안 하면 내년에 후회해요', ed2).includes('pressure') && !fk('지금 안 하면 내년에 후회해요').includes('pressure') && fk('오늘은 최저가로 모십니다', rp).includes('avoid-최저가') && !fk('3만 원 이상 무료 배송', rp).some((k) => k.startsWith('policy-무료')) && fk('3만 원 이상 무료 배송').some((k) => k.startsWith('policy-무료')))
  const dk = (kind: ContentKind, blocks: { label: string; text: string; hint?: string }[], pp = fp, kw?: string) => draftChecks(kind, blocks, pp.industry, kw, pp).map((x) => x.key)
  check("C121 '정보 없음' · 의료 개인차 안내 없음 · 썸네일 15자(숫자 없음) · 고정 문구 30자 · 영상 제목에 지역 · 쇼츠 인사", dk('blog', [{ label: '', text: '연락처: 정보 없음' }]).includes('no-info') && dk('blog', [{ label: '', text: '치료 이야기' }], hp2).includes('care') && !dk('blog', [{ label: '', text: `치료 이야기 ${CARE_NOTE}` }], hp2).includes('care') && ['fixed-len', 'thumb-num'].every((k) => dk('video', [{ label: '썸네일 문구', text: '꼭 알아야 할 것들이에요' }]).includes(k)) && dk('shorts', [{ label: '고정 문구', text: '이 문구는 스물두 글자를 훌쩍 넘는 아주 긴 문구예요' }]).includes('fixed-len') && dk('video', [{ label: '', text: '화성 정밀 금속부품 고를 때 꼭 볼 3가지', hint: '제목' }], fp, '화성 정밀 금속부품').includes('video-area') && dk('shorts', [{ label: '0:00 - 0:03', text: '나레이션: 안녕하세요, 오늘은' }]).includes('shorts-hello'))
  check('C122 블로그 제목 — 키워드가 맨 앞 + 쉼표가 아니면 알림 · 키워드 8번이면 많다고', dk('blog', [{ label: '', text: '꼭 알아야 할 화성 정밀 금속부품 2가지', hint: '제목' }], fp, '화성 정밀 금속부품').includes('kw-front') && !dk('blog', [{ label: '', text: '화성 정밀 금속부품, 꼭 알아야 할 2가지', hint: '제목' }], fp, '화성 정밀 금속부품').includes('kw-front') && dk('blog', [{ label: '', text: Array(8).fill('화성 정밀 금속부품').join(' '), hint: '제목' }], fp, '화성 정밀 금속부품').includes('kw-many'))
  // 우리가 만든 글은 형식 · 규정 점검에 걸리지 않는다(빈칸 · 길이 안내 같은 info 는 빼고)
  const fmtKeys = /^(kw-front|kw-title|kw-first|kw-many|video-area|thumb-num|fixed-len|shorts-hello|care|no-info|stat|roundup|pressure|month-limit|policy-|source|bash|years|reviews-meaning|voice-made|avoid-)/
  const own: unknown[] = []
  let ownN = 0
  for (const ind of INDUSTRIES) {
    for (const pp of [buildProfile(full, today, { industry: ind }).profile, buildProfile(full, today, { ...rov, speaker: '대표 김한솔', industry: ind }).profile, buildProfile(empty, today, { industry: ind }).profile]) {
      for (const kind of CONTENT_KINDS) {
        if (kind === 'keywords') continue
        for (const tp of topicsFor(pp, '', today)) {
          for (const ad of kind === 'cards' ? AD_TYPES : (['info'] as AdType[])) {
            for (const sl of kind === 'shorts' ? (['20-30', '30-60'] as const) : (['20-30'] as const)) {
              const d = makeDraft(pp, { kind, topic: tp, adType: ad, shortLen: sl, purpose: 'event', pages: 7 }, today)
              ownN += 1
              const bad = draftChecks(kind, d.blocks, pp.industry, d.input.keyword, pp).filter((c) => c.level !== 'info' && fmtKeys.test(c.key))
              if (bad.length) own.push({ ind, kind, type: tp.type, ad, sl, keys: bad.map((c) => c.key), text: bad[0].text.slice(0, 90) })
            }
          }
        }
      }
    }
  }
  check(`C123 우리가 만든 글 ${ownN}편 — 형식 · 규정 · 사실 대조 경보 0(빈칸 · 길이 안내 제외)`, own.length === 0 && ownN > 1000, own.slice(0, 4))
  const okList = reviewChecklist('blog', draftChecks('blog', bTips.blocks, fp.industry, topics[0].keyword, fp), fp)
  const badList = reviewChecklist('blog', draftChecks('blog', [{ label: '', text: '1,240명이 재구매! 무료 배송 · 식품연구소에서 권장한 방법. 연락처 정보 없음' }], fp.industry, undefined, fp), fp)
  const st = (l: typeof okList, part: string) => l.find((x) => x.text.includes(part))?.state
  check('C124 발행 전 검수표 — 다섯 묶음 · 사람이 볼 것(화자 · 독자 · 실명) · 자동(정책 · 출처 · 정보 없음) 통과/확인 · 키워드 글은 표 없음', ['사람 · 업체', '숫자 · 사실', '형식', '고친 뒤 · 올린 뒤'].every((g) => okList.some((x) => x.group === g)) && st(okList, '실명 브랜드') === 'manual' && st(okList, '정책') === 'pass' && st(badList, '정책') === 'warn' && st(badList, '출처') === 'warn' && st(badList, '정보 없음') === 'warn' && reviewChecklist('keywords', [], fp).length === 0 && reviewChecklist('blog', [], hp2).some((x) => x.text.includes('개인차')) && reviewChecklist('blog', [], fp, { guide: true }).some((x) => x.text.includes('광고 표시')), badList.map((x) => `${x.state}:${x.text.slice(0, 12)}`))
  const rq = aiRequestText(rp, { kind: 'blog', keyword: '화성 정밀 금속부품' })
  const rqv = aiRequestText(rp, { kind: 'video', keyword: '화성 정밀 금속부품' })
  const rqs = aiRequestText(rp, { kind: 'shorts', shortLen: '30-60' })
  check('C125 요청문 채널별 — 채널 · 길이(숫자) · 지역 방침 · 걱정 · 흔한 반박 · 마지막 제안(업종표) · 업체가 막은 말 · 직함만이면 이름 금지 · 배송 조건', rq.includes('채널 · 종류: 네이버 블로그 글') && rq.includes('2,100~3,000자') && rq.includes('검색 키워드 "화성 정밀 금속부품" 를 띄어쓰기까지 그대로 제목 맨 앞에') && rq.includes('흔한 반박 1개: "소량은 아무 데나 맡겨도 똑같다"') && rq.includes('독자의 걱정 1개: "소량도 받아 줄까"') && rq.includes('끝: 도면 검토 · 방문 상담 안내 하나만') && rq.includes('"최저가"') && rq.includes('사람 이름은 쓰지 마세요') && rq.includes('배송 · 교환 조건: 전국 택배') && rqv.includes('("정밀 금속부품")') && rqv.includes('괄호 없이 25~35자') && rqs.includes('60초 이내 · 컷 15개 이하') && !aiRequestText(rp).includes('채널 · 종류'), rq)
}

/* ---------------- D-230 제목 각도 · 카드 5안 · 올린 뒤 숫자 ---------------- */
{
  const intents = new Set(ANGLES.map((a) => a.intent))
  check('C126 제목 각도 17개 — 규칙집 번호 1~17 · 검색 의도 5가지 모두', ANGLES.length === 17 && ANGLES.map((a) => a.no).join() === Array.from({ length: 17 }, (_, i) => i + 1).join() && intents.size === 5 && new Set(ANGLE_IDS).size === 17)
  const kw = '화성 정밀 금속부품'
  const hp = buildProfile(full, today, { industry: 'health' }).profile
  const edp = buildProfile(full, today, { industry: 'education' }).profile
  const vp = buildProfile(full, today, { voice: '도면 받은 날 바로 연락 주셔서 좋았어요', rebuttal: '소량은 아무 데나 맡겨도 똑같다', objection: '소량도 받아 줄까' }).profile
  const at = (pp: ContentProfile, id: AngleId) => angleTitle(pp, id, kw, 2, today)
  check('C127 각도 조건 — 통계 · 비교는 우리 데이터 없으면 안 씀 · 의료는 비용 · 역설 · 구조 · 긴급 안 씀 · 교육 긴급 안 씀 · 권위는 경력 3년 이상 · 사례는 고객 말 있을 때 · 질문 = 망설이는 점 · 통념 = 흔한 반박',
    at(fp, 'stat') === null && at(fp, 'compare') === null && ['cost', 'paradox', 'inside', 'urgent'].every((id) => at(hp, id as AngleId) === null) && at(edp, 'urgent') === null && at(fp, 'urgent') !== null &&
    at(ep, 'expert') === null && (at(fp, 'expert') ?? '').includes('12년 차') && at(fp, 'case') === null && at(vp, 'case') !== null && (at(vp, 'question') ?? '').includes('소량도 받아 줄까?') && (at(vp, 'myth') ?? '').includes('"소량은 아무 데나 맡겨도 똑같다"') && (angleTitle(fp, 'fail', '', 2, today) ?? '').startsWith(`${mainKeyword(fp)},`))
  const candBad: unknown[] = []
  for (const ind of INDUSTRIES) {
    for (const pp of [buildProfile(full, today, { industry: ind }).profile, buildProfile(empty, today, { industry: ind }).profile, buildProfile(full, today, { industry: ind, tone: 'formal' }).profile]) {
      const k = mainKeyword(pp)
      for (const v of [0, 5, 10]) {
        const cs = titleCandidates(pp, k, today, [], 5, 2, v)
        const ok = cs.length === 5 && new Set(cs.map((c) => c.id)).size === 5 && new Set(cs.map((c) => c.intent)).size >= 4 && cs.every((c) => c.title.startsWith(`${k},`) && c.title.length >= 25 && c.title.length <= 40 && c.id !== 'stat' && c.id !== 'compare')
        // 고른 각도로 만든 글의 제목 = 후보에 보인 제목(말투까지)
        const same = cs.every((c) => makeDraft(pp, { kind: 'blog', keyword: k, topic: topicsFor(pp, k, today)[0], angle: c.id }, today).title === c.title)
        if (!ok || !same) candBad.push({ ind, tone: pp.tone, v, same, cs: cs.map((c) => `${c.id}/${c.intent}/${c.title.length}:${c.title}`) })
      }
    }
  }
  check(`C128 후보 5개 — 업종 ${INDUSTRIES.length} × 꽉 찬/빈/합쇼체 × 돌리기 3 · 각도 겹침 0 · 검색 의도 4가지 이상 · 키워드로 시작 · 25~40자 · 만든 글 제목 = 후보 제목`, candBad.length === 0, candBad.slice(0, 2))
  const c1 = titleCandidates(fp, kw, today, ['fail', 'myth'])
  const avail = ANGLE_IDS.filter((id) => at(fp, id))
  const usedAll = [...avail].reverse()
  const c2 = titleCandidates(fp, kw, today, usedAll)
  check('C129 쓴 각도는 빼고 · 새 각도를 다 쓰면 가장 오래전에 쓴 것부터 다시(전에 쓴 각도 표시)', !c1.some((c) => c.id === 'fail' || c.id === 'myth') && c1.length === 5 && c2.length === 5 && c2.every((c) => c.again) && c2[0].id === usedAll[usedAll.length - 1], { c2: c2.map((c) => c.id), last: usedAll[usedAll.length - 1] })
  const mk = (angle: AngleId | undefined, keyword: string, createdAt: string) => ({ input: { keyword, ...(angle ? { angle } : {}) }, createdAt })
  const ua = usedAngles([mk('fail', kw, '2026-10-01'), mk('myth', kw, '2026-10-05'), mk('fail', kw, '2026-10-09'), mk('trap', '다른 키워드', '2026-10-10'), mk(undefined, kw, '2026-10-11')], ` ${kw} `)
  check('C130 키워드별 쓴 각도 — 최근 것 먼저 · 겹치지 않게 · 다른 키워드 · 각도 없는 글은 빼고', ua.join() === 'fail,myth', ua)
  const tp = topicsFor(fp, kw, today)[0]
  const dBlog = makeDraft(fp, { kind: 'blog', keyword: kw, topic: tp, angle: 'trap' }, today)
  const dReview = makeDraft(fp, { kind: 'blog', keyword: kw, topic: tp, angle: 'trap', blogType: 'review' }, today)
  const dHealth = makeDraft(hp, { kind: 'blog', keyword: kw, topic: topicsFor(hp, kw, today)[0], angle: 'cost' }, today)
  const dVid = makeDraft(fp, { kind: 'video', keyword: kw, topic: tp, angle: 'fail' }, today)
  const cp = buildProfile(full, today, { industry: 'cafe' }).profile
  const dVidC = makeDraft(cp, { kind: 'video', keyword: mainKeyword(cp), topic: topicsFor(cp, '', today)[0], angle: 'fail' }, today)
  const dCards = makeDraft(fp, { kind: 'cards', keyword: kw, topic: tp, angle: 'trap' }, today)
  check('C131 각도로 만들기 — 블로그 제목 = 각도 제목 · 기록에 각도 / 체험단 가이드 · 조건 안 맞는 각도(의료 비용) · 카드는 각도 안 씀 / 영상 제목 지역 없음 · 기업형 괄호 없이 · 소비자형 (괄호 꼬리말)',
    dBlog.title.startsWith(`${kw}, 고를 때 후회하는 함정 TOP 2`) && dBlog.blocks[0].text === dBlog.title && dBlog.input.angle === 'trap' && !dReview.input.angle && !dHealth.input.angle && !dCards.input.angle &&
    dVid.input.angle === 'fail' && !dVid.title.includes('화성') && dVid.title.startsWith('정밀 금속부품 알아봐도') && !/\)$/.test(dVid.title) && dVid.title === angleVideoTitle(fp, 'fail', kw, 3, today) && dVidC.input.angle === 'fail' && /\)$/.test(dVidC.title) && dVidC.title.length >= 40 && dVidC.title.length <= 55,
    { b: dBlog.title, v: dVid.title, vc: dVidC.title })
  const saved = normalizeItem('x1', { ...itemData({ id: 'x1', kind: 'blog', title: dBlog.title, blocks: dBlog.blocks, input: dBlog.input, rootId: 'x1', version: 1, favorite: false, hash: '', createdAt: '2026-10-16T00:00:00Z', updatedAt: '' }) })
  const hacked = normalizeItem('x2', { kind: 'blog', title: 't', blocks: [{ label: '', text: 't' }], input: { angle: 'hack', keyword: kw }, rootId: 'x2', version: 1 })
  check('C132 보관함 읽기 — 각도 남김 · 모르는 각도 버림', saved?.input.angle === 'trap' && hacked !== null && !hacked.input.angle)

  const five = cardFive(fp, { keyword: kw, topic: tp, pages: 7 }, today)
  const fiveH = cardFive(hp, { keyword: kw, topic: topicsFor(hp, kw, today)[0] }, today)
  check('C133 카드뉴스 5안 — 순서 고정(망설임 → 고민 → 전후 → 궁금증 → 기록) · 탭 이름 = 유형 · 5안 모두 다른 글 · 첫 장 모두 다름 · 7장 · 제목 끝에 유형 · 의료는 두 안(D-234) · 의료 전후는 과정만 안내',
    CARD_FIVE.join() === 'objection,problem,before,curious,proof' && five.map((x) => x.draft.input.adType).join() === CARD_FIVE.join() && five.map((x) => x.tab).join() === '망설임 풀기,고민 공감,전후 변화,궁금증,기록 증명' && new Set(five.map((x) => contentHash('cards', x.draft.blocks))).size === 5 && new Set(five.map((x) => x.draft.blocks[0].text)).size === 5 && five.every((x) => x.draft.input.pages === 7 && x.draft.title.endsWith(AD_TYPE_LABEL[x.draft.input.adType!])) && fiveH.map((x) => x.draft.input.adType).join() === 'objection,curious' && makeDraft(hp, { kind: 'cards', keyword: kw, adType: 'before' }, today).notes.some((n) => n.includes('전후 비교를 쓰지 않아요')),
    five.map((x) => `${x.tab}: ${x.draft.blocks[0].text}`))

  const ns = normalizeStats({ views: 1200.7, saves: -3, inquiries: '5', at: '2026-10-16T09:00:00Z' })
  check('C134 올린 뒤 숫자 읽기 — 0 이상 정수만 · 글자 · 음수 · 끝없는 수 버림 · 하나도 없으면 없음', ns?.views === 1200 && ns.saves === undefined && ns.inquiries === undefined && normalizeStats({ views: Infinity, at: 'x' }) === null && normalizeStats(null) === null && normalizeStats({ inquiries: 0, at: '2026-10-16' })?.inquiries === 0, ns)
  const base = (id: string, rootId: string, version: number, extra: Partial<ContentItem> = {}): ContentItem => ({ id, kind: 'blog', title: id, blocks: [{ label: '', text: id }], input: { keyword: kw, topicType: 'tips', variant: 0, tone: 'friendly' }, rootId, version, favorite: false, hash: id, createdAt: `2026-10-0${version}T00:00:00Z`, updatedAt: '', ...extra })
  const chain = [base('a1', 'a1', 1), base('a2', 'a1', 2), base('b1', 'b1', 1)]
  const st = { views: 900, saves: 12, inquiries: 2, at: '2026-10-16T00:00:00Z' }
  const ws = withStats(chain, 'a1', st)
  const back = normalizeItem('a2', itemData(ws[1]))
  check('C135 숫자는 사슬 전체에 · 지우면 빠짐 · 새 판에서도 보임 · 저장 · 읽기 그대로', ws.length === 2 && ws.every((x) => x.stats?.inquiries === 2) && withStats(ws, 'a1', null).every((x) => !x.stats) && latestByRoot([...ws, chain[2]]).find((r) => r.item.rootId === 'a1')?.item.stats?.views === 900 && back?.stats?.saves === 12)
  const perfItems: ContentItem[] = [
    base('p1', 'p1', 1, { input: { keyword: kw, topicType: 'tips', angle: 'fail', variant: 0, tone: 'friendly' }, stats: { views: 500, saves: 10, inquiries: 1, at: '2026-10-10' } }),
    base('p2', 'p2', 2, { input: { keyword: kw, topicType: 'tips', angle: 'fail', variant: 0, tone: 'friendly' }, stats: { views: 300, saves: 5, inquiries: 2, at: '2026-10-11' } }),
    base('p3', 'p3', 3, { kind: 'cards', input: { keyword: kw, topicType: 'tips', adType: 'objection', pages: 7, variant: 0, tone: 'friendly' }, stats: { views: 5000, saves: 80, inquiries: 1, at: '2026-10-12' } }),
    base('p4', 'p4', 4, { input: { keyword: kw, topicType: 'faq', variant: 0, tone: 'friendly' } }),
  ]
  const perf = performanceBy(perfItems)
  check('C136 무엇이 잘 됐나 — 각도 · 카드 유형 · 주제별로 더함 · 문의 → 저장 → 조회 순 · 숫자 없는 글은 빼고', perf.length === 2 && perf[0].key === 'angle:fail' && perf[0].n === 2 && perf[0].inquiries === 3 && perf[0].views === 800 && perf[1].key === 'ad:objection' && perfKey(perfItems[3]).key === 'topic:blog:faq' && perfKey(perfItems[0]).label.includes('실패'), perf)
}

/* ------------------------------------------------------------------ */
/* D-234 콘텐츠 작성 규칙집 ⟲4차(이상한AI 4차 실험 — 규칙집 실전 검증 · 규제 업종 4곳) 대조                    */
/* ------------------------------------------------------------------ */
{
  const rec = (id: string, companyName: string, businessCategory: string, businessItem: string) => normalizeClientOps({ id, companyName, businessCategory, businessItem, businessAddress: '서울특별시 강남구 테헤란로 1', companyPhone: '02-555-1234', establishedAt: '2018-04-01' })
  const regOv = normalizeOverrides({ reviews: '후기 620개 · 평점 4.8', reviewSource: '자사몰', price: '1회 32,000원', speaker: '대표 박하나', offer: '첫 구매 1+1', offerUntil: '2026-10-31', voice: '먹고 나서 편해졌어요' })
  const mk = (r: ReturnType<typeof rec>, ov = regOv) => buildProfile(r, today, ov).profile
  const hf = mk(rec('r-hf', '바른장연구소', '도매 및 소매업', '유산균 · 건강기능식품'))
  const ins = mk(rec('r-ins', '든든보험상담', '보험대리점', '보험 상담 · 보장 분석'))
  const rl = mk(rec('r-rl', '햇살공인중개사사무소', '부동산업', '아파트 매매 · 전월세 중개'))
  const lw = mk(rec('r-lw', '정의법률사무소', '법무 서비스', '교통사고 · 손해배상 소송'))
  const md = buildProfile(full, today, { ...regOv, industry: 'health' }).profile
  const edu = buildProfile(full, today, { ...regOv, industry: 'education' }).profile
  const notReg = [
    mk(rec('r-tax', '바른세무회계', '세무 서비스', '법인 기장 · 부동산 양도세 상담')),
    mk(rec('r-cl', '맑은피부의원', '의원', '피부 관리 · 실손보험 청구 안내')),
    mk(rec('r-food', '할매삼계탕', '음식점업', '홍삼 삼계탕')),
    mk(rec('r-arch', '공간건축', '건축 설계', '건축 설계사무소 · 인테리어')),
    mk(rec('r-labor', '한빛노무법인', '노무 서비스', '4대보험 신고 · 급여 아웃소싱')),
  ]
  check('D234-1 규제 업종 알아보기 — 건강기능식품 · 보험 · 부동산 중개 · 법률(상품 · 하는 일 · 이름) / 의료 · 교육은 업종 칸 / 세무사 부동산 양도세 · 병원 실손 청구 · 식당 홍삼 · 건축 설계사무소 · 4대보험은 규제 업종 아님(병원은 의료)',
    regulatedOf(hf)?.kind === 'hfood' && regulatedOf(ins)?.kind === 'insurance' && regulatedOf(rl)?.kind === 'realty' && regulatedOf(lw)?.kind === 'law' && regulatedOf(md)?.kind === 'medical' && regulatedOf(edu)?.kind === 'education' && regulatedOf(fp) === null &&
    regulatedOf(notReg[0]) === null && regulatedOf(notReg[1])?.kind === 'medical' && regulatedOf(notReg[2]) === null && regulatedOf(notReg[3]) === null && regulatedOf(notReg[4]) === null,
    [hf, ins, rl, lw, ...notReg].map((x) => `${x.company}:${x.industry}:${regulatedOf(x)?.kind ?? '-'}`))

  const regs = [hf, ins, rl, lw]
  const noticeBad: string[] = []
  for (const pp of [...regs, md]) {
    const n = noticeOf(pp)
    const t = topicsFor(pp, '', today)
    const blog = plainText('blog', makeDraft(pp, { kind: 'blog', topic: t[0] }, today).blocks)
    const intro = plainText('blog', makeDraft(pp, { kind: 'blog', topic: t.find((x) => x.type === 'intro') ?? t[1] }, today).blocks)
    const cards = makeDraft(pp, { kind: 'cards', topic: t[0], adType: 'objection' }, today)
    const vid = makeDraft(pp, { kind: 'video', topic: t[0] }, today)
    const sh = plainText('shorts', makeDraft(pp, { kind: 'shorts', topic: t[0] }, today).blocks)
    const end = vid.blocks.find((b) => b.label.endsWith('· 마무리'))!.text
    const ok = !!n && blog.includes(n) && intro.includes(n) && plainText('cards', cards.blocks).includes(n) && sh.includes(n) && vid.blocks.find((b) => b.label === '설명란')!.text.includes(n) && (regulatedOf(pp)!.kind === 'realty' ? end.includes(`화면 아래 작은 글자: ${n}`) && !/^말:.*등록번호/m.test(end) : end.includes(n)) && (pp === md || cards.notes.some((x) => x.includes('필수 안내 문구')))
    if (!ok) noticeBad.push(pp.company)
  }
  check('D234-2 필수 안내 문구 — 블로그(규칙집 · 소개 틀) · 카드 마지막 장 · 쇼츠 캡션 · 영상 마무리 · 설명란에 그대로(의료 개인차 · 의약품 아님 · 약관 · 중개사무소 정보 · 사실관계) · 부동산 정보는 말이 아니라 화면 글자 · 카드 메모에 "사람이 직접 넣기"', noticeBad.length === 0 && noticeOf(hf).includes('의약품이 아닙니다') && noticeOf(ins).includes('약관') && noticeOf(rl).startsWith('중개사무소 정보: 햇살공인중개사사무소 / 소재지 서울') && noticeOf(rl).includes('[중개사무소 등록번호]') && noticeOf(lw).includes('사실관계에 따라') && noticeOf(edu) === '' && noticeOf(fp) === '', noticeBad)

  const promoBad: string[] = []
  for (const pp of regs) {
    for (const kind of CONTENT_KINDS) {
      if (kind === 'keywords') continue
      const t = topicsFor(pp, '', today)
      const tx = plainText(kind, makeDraft(pp, { kind, topic: t[0], adType: 'proof', purpose: 'event' }, today).blocks)
      const reviewHidden = regulatedOf(pp)!.kind === 'insurance' || regulatedOf(pp)!.kind === 'realty' || !tx.includes('620')
      if (tx.includes('1+1') || (regulatedOf(pp)!.kind !== 'insurance' && regulatedOf(pp)!.kind !== 'realty' && tx.includes('편해졌어요')) || !reviewHidden) promoBad.push(`${pp.company}:${kind}`)
    }
  }
  const mdBlog = plainText('blog', makeDraft(md, { kind: 'blog', topic: topicsFor(md, '', today)[0] }, today).blocks)
  check('D234-3 판촉 · 후기 — 건강기능식품 · 보험 · 부동산 · 법률 글에 혜택(1+1) 0 · 건강기능식품 · 법률은 고객 한마디 · 후기 수 0 · 의료는 가격 0(가격 표시 금지)', promoBad.length === 0 && !mdBlog.includes('32,000') && plainText('blog', makeDraft(fp, { kind: 'blog', topic: topicsFor(fp, '', today)[0] }, today).blocks).length > 0, promoBad.slice(0, 5))

  const regFive = cardFive(hf, { pages: 7 }, today)
  check('D234-4 규제 업종 카드뉴스 — 망설임 풀기 · 궁금증 두 안만(교육은 + 고민 공감) · 권하지 않는 유형 = 고민 공감 · 전후 변화 · 기록 증명 · 손해 피하기 · 일반 업체는 5안 그대로 · 권하지 않는 유형으로 만들면 메모',
    regFive.map((x) => x.draft.input.adType).join() === 'objection,curious' && cardFiveTypes(edu).join() === 'objection,problem,curious' && cardFiveTypes(fp).join() === CARD_FIVE.join() && riskyAdTypes(hf).join() === 'problem,before,proof,loss' && riskyAdTypes(edu).join() === 'before,proof,loss' && riskyAdTypes(fp).length === 0 &&
    makeDraft(lw, { kind: 'cards', adType: 'proof' }, today).notes.some((n) => n.includes("'기록 증명형' 틀이 금지한 표현")) && !makeDraft(lw, { kind: 'cards', adType: 'objection' }, today).notes.some((n) => n.includes('틀이 금지한 표현')) &&
    makeDraft(ins, { kind: 'kakao', purpose: 'event' }, today).notes.some((n) => n.includes('혜택 광고를 하지 않아요')),
    regFive.map((x) => x.tab))

  // 우리 엔진이 만든 글은 규제 업종에서도 거짓 경보 0
  const regAlarm: unknown[] = []
  let regDrafts = 0
  for (const pp of [...regs, ...regs.map((x) => ({ ...x, reviews: '', reviewSource: '', price: '', offer: '', voice: '', speaker: '' }))]) {
    for (const kind of CONTENT_KINDS) {
      for (const topic of topicsFor(pp, '', today)) {
        for (const adType of AD_TYPES) {
          if (kind !== 'cards' && adType !== 'info') continue
          const d = makeDraft(pp, { kind, topic, adType, purpose: 'event', shortLen: '30-60' }, today)
          regDrafts += 1
          const f = factChecks(plainText(d.kind, d.blocks), pp)
          const dc = draftChecks(d.kind, d.blocks, pp.industry, undefined, pp).filter((c) => c.key === 'notice' || c.key === 'care')
          if (f.length || dc.length) regAlarm.push({ co: pp.company, kind, adType, keys: [...f, ...dc].map((x) => x.key), text: (f[0] ?? dc[0]).text })
        }
      }
    }
  }
  check(`D234-5 규제 업종 4곳에서 우리가 만든 글 ${regDrafts}편(재료 있음/없음)에는 거짓 경보 0 · 필수 안내 빠짐 0`, regAlarm.length === 0 && regDrafts > 150, regAlarm.slice(0, 3))

  const pr = buildProfile(full, today, normalizeOverrides({ reviews: '후기 620개 · 평점 4.8', reviewSource: '자사몰', price: '1회 32,000원' })).profile
  const bad4 = "지금 스마트스토어에서 신청하세요. 포털에서 누구나 후기 확인 가능해요. 월 3만 원이면 충분! 100명 중 96명이 만족, 만족도 96%. 효과는 두 배. 놓치면 3만 2천 원 손해예요.\n'OO 보장 범위' 꼭 보세요. 김OO님 부부도 그랬어요. 1+1 행사 중."
  const k4 = factChecks(bad4, pr).map((x) => x.key)
  const frame = factChecks('[상품] [유형] 카드 1 - [상품] [유형] 메시지 1', pr).map((x) => x.key)
  const kong = buildProfile(full, today, normalizeOverrides({ price: '공임 3만 원(오일값 별도)' })).profile
  const kongBad = factChecks('엔진오일 교환 3만 원? 11월까지만!', kong).map((x) => x.key)
  const kongOk = factChecks('엔진오일 교환 공임 3만 원(오일값 별도)이에요.', kong).map((x) => x.key)
  const okBrief = factChecks('자사몰 후기 620개 · 평점 4.8 이에요. 1회 32,000원이에요.', pr).map((x) => x.key)
  check('D234-6 받은 글 점검(⟲4차) — 브리프에 없는 판매처 · 지어낸 후기 출처 · 1회 → 월 · 평점 → 만족 비율 · 한글 숫자 · 손해 금액 · OO 빈칸(꼭) · 가린 이름 사례 · 1+1 · 빈 틀(꼭) · 공임 뺀 가격 / 브리프대로 쓴 글은 경보 0',
    ['platform', 'review-source', 'price-unit', 'stat', 'rating-stat', 'korean-num', 'loss', 'oo-hole', 'case-made', 'policy-1+1'].every((k) => k4.includes(k)) && frame.includes('blank-frame') && kongBad.includes('price-unit') && !kongOk.includes('price-unit') && okBrief.length === 0 &&
    factChecks(bad4, pr).find((x) => x.key === 'oo-hole')!.level === 'must' && !factChecks('네이버 스마트스토어 후기 1,240개', buildProfile(full, today, normalizeOverrides({ channel: '네이버 스마트스토어', reviews: '네이버 스마트스토어 후기 1,240개' })).profile).some((x) => x.key === 'platform' || x.key === 'review-source'),
    { k4, frame, kongBad, okBrief })

  const rk = (txt: string, pp: ContentProfile) => factChecks(txt, pp).map((x) => x.key)
  check('D234-7 규제 업종 표현 — 보험(가입 압박 · 갈아타기 · 최저 보험료) · 부동산(원스톱 대출 · 수수료 할인 · 급매) · 법률(승소율 · 합의금 숫자) · 건강기능식품(변비 해결 · 식약처 인정) · 일반 업체엔 이 점검 없음',
    ['reg-가입 압박', 'reg-갈아타기', 'reg-최저 · 원금 보장'].every((k) => rk('그대로 두면 손해예요. 지금 갈아타세요. 최저 보험료!', ins).includes(k)) &&
    ['reg-대출 알선 · 원스톱', 'reg-수수료 할인', 'reg-급매 · 마지막 기회'].every((k) => rk('대출·세금 원스톱 안내, 중개수수료 50% 할인, 급매 나왔어요', rl).includes(k)) &&
    ['reg-승소율 · 건수', 'reg-금액 사례'].every((k) => rk('승소율 98%! 합의금 300만 원 → 1,200만 원', lw).includes(k)) &&
    ['reg-질병 예방 · 치료', 'reg-특허 · 식약처 인정'].every((k) => rk('변비 해결에 좋아요. 식약처 인정 원료', hf).includes(k)) &&
    !rk('그대로 두면 손해예요. 승소율 98%', fp).some((k) => k.startsWith('reg-')),
    rk('대출·세금 원스톱 안내, 중개수수료 50% 할인, 급매 나왔어요', rl))

  const dkn = (pp: ContentProfile, kind: ContentKind, text: string) => draftChecks(kind, [{ label: '', text }], pp.industry, undefined, pp)
  const insCard = dkn(ins, 'cards', '보장 분석 이야기')
  check('D234-8 필수 안내 빠짐 점검 — 보험 카드뉴스에 약관 문구 없으면 "직접 넣기" · 넣으면 통과 · 카톡 · 플레이스는 안 봄 · 의료는 예전 그대로(개인차)',
    insCard.some((c) => c.key === 'notice' && c.text.includes('카드뉴스는 다른 도구가')) && !dkn(ins, 'cards', `보장 분석 ${noticeOf(ins)}`).some((c) => c.key === 'notice') && !dkn(ins, 'kakao', '보장 분석').some((c) => c.key === 'notice') && dkn(md, 'blog', '치료 이야기').some((c) => c.key === 'care'), insCard.map((c) => c.key))

  const reqHf = aiRequestText(hf)
  const reqNo = aiRequestText(ep)
  const lines = reqHf.split('\n')
  const at = (prefix: string) => lines.findIndex((l) => l.startsWith(prefix))
  const order = ['업체:', '독자(보는 사람):', '알리는 것:', '화자:', '사실 목록', '구매·문의처:', '넣지 말 것:'].map(at)
  check('D234-9 요청문 7칸 이름표 줄 — 업체 · 독자 · 알리는 것 · 화자 · 사실 목록 · 구매·문의처 · 넣지 말 것 순서 · 화자 = "업체의 직함 \'이름\'" · 숫자 뜻 바꾸지 않기 · 가격 단위 그대로 · 구매처 없으면 "플랫폼 이름 넣지 마세요" · 규제 업종 금지 · 필수 문구 · 카드 두 안',
    order.every((x, i) => x >= 0 && (i === 0 || x > order[i - 1])) && reqHf.includes("화자: 바른장연구소의 대표 '박하나' (이름은 이것만 쓰세요).") && reqHf.includes('받은 숫자의 뜻(후기 수 · 평점 · 가격 단위)을 바꾸지 마세요') &&
    reqHf.includes('구매·문의처: 전화 02-555-1234') && reqNo.includes('구매·문의처: (아직 없음 — 판매처 · 플랫폼 이름을 넣지 마세요).') &&
    reqHf.includes('건강기능식품 광고 규정 — 넣지 말 것: 질병의 예방') && reqHf.includes('"이 제품은 질병의 예방 및 치료를 위한 의약품이 아닙니다.') && reqHf.includes('카드뉴스는 망설임 풀기 · 궁금증 안만') && reqHf.includes('할인 → 1+1') &&
    !reqHf.includes('620') && !reqHf.includes('1+1 ') && aiRequestText(ins).includes('- 후기·평점: 후기 620개 · 평점 4.8 / 후기 출처: 자사몰') && aiRequestText(fp, {}).includes('후기 출처') === false && aiRequestText(pr).includes("- 가격: 1회 32,000원 (단위 그대로") &&
    speakerLine({ ...fp, speaker: '김한솔 대표' }) === "화자: 한솔정밀(주)의 대표 '김한솔' (이름은 이것만 쓰세요)." && speakerLine({ ...fp, speaker: 'MD 지은' }).includes("의 MD '지은'") && speakerLine({ ...fp, speaker: '원장' }).includes('(사람 이름은 쓰지 마세요)') && speakerLine({ ...fp, speaker: '' }) === '화자: 한솔정밀(주) (사람 이름은 쓰지 마세요).' && contactLine(ep).includes('아직 없음') &&
    AI_REQUEST_TIPS.length === 8 && AI_REQUEST_TIPS.some((x) => x.includes('500번')) && AI_REQUEST_TIPS.some((x) => x.includes('수정 요청 단추가 없어요')) && AI_REQUEST_TIPS.some((x) => x.includes('넘어가는 칸의 숫자부터')),
    reqHf)

  const noSrc = buildProfile(full, today, normalizeOverrides({ reviews: '후기 620개', price: '32,000원' })).profile
  const { profile: srcP, source: srcS } = buildProfile(full, today, normalizeOverrides({ reviews: '후기 620개', reviewSource: '자사몰', price: '1회 32,000원' }))
  const { source: eS } = buildProfile(empty, today)
  check('D234-10 홍보 정보 — 후기 출처 칸(60자) · 후기만 있고 출처 없으면 "후기 출처" 채울 칸 · 단위 없는 가격은 "가격 단위" 채울 칸 · 사실 목록에 출처 · 구매·문의처 칸(전화 있으면 채움 · 없으면 비었다고)',
    normalizeOverrides({ reviewSource: 'x'.repeat(90) }).reviewSource?.length === 60 && profileGaps(noSrc).some((g) => g.key === 'reviewSource') && profileGaps(noSrc).some((g) => g.key === 'price') && !profileGaps(srcP).some((g) => g.key === 'reviewSource' || g.key === 'price') &&
    priceWithoutUnit('32,000원') && !priceWithoutUnit('1회 32,000원') && !priceWithoutUnit('공임 3만 원(부품값 별도)') && !priceWithoutUnit('300만 원부터') && !priceWithoutUnit('월 9,900원') && !priceWithoutUnit('') &&
    materialList(srcP).includes('후기 620개 (후기 출처: 자사몰)') && briefSlots(srcP, srcS).find((x) => x.key === 'contact')!.ok && briefSlots(srcP, srcS).find((x) => x.key === 'contact')!.note.includes('031-123-4567') && !briefSlots(ep, eS).find((x) => x.key === 'contact')!.ok,
    { gaps: profileGaps(noSrc).map((g) => g.key), slot: briefSlots(ep, eS).find((x) => x.key === 'contact') })
  const namedSrc = buildProfile(full, today, normalizeOverrides({ reviews: '네이버 후기 1,240개 · 평점 4.8' })).profile
  check('D234-12 후기 칸에 어디 후기인지 이미 적혀 있으면(네이버 후기 …) 출처를 또 묻지 않음 · 장소 없는 후기는 물음',
    !profileGaps(namedSrc).some((g) => g.key === 'reviewSource') && reviewPlaceIn('스마트스토어 리뷰 320') && reviewPlaceIn('매장 후기 50개') && !reviewPlaceIn('후기 620개 · 평점 4.8'),
    profileGaps(namedSrc).map((g) => g.key))

  const rcl = (kind: ContentKind, keys: string[], pp: ContentProfile, guide = false) => reviewChecklist(kind, keys.map((key) => ({ key, level: 'should' as const, text: '' })), pp, { guide })
  const st = (items: ReturnType<typeof rcl>, part: string) => items.find((x) => x.text.includes(part))?.state ?? null
  const okCl = rcl('blog', [], fp)
  const badCl = rcl('blog', ['price-unit', 'platform', 'oo-hole', 'korean-num'], fp)
  const insCl = rcl('cards', ['notice', 'reg-가입 압박'], ins)
  check('D234-11 검수표(⟲4차 6장) — 가격 단위 · 평점 통계 · 한글 숫자 · 구매처 · 후기 출처 · OO 빈칸 · 빈 틀 · 블로그 작성자 표(사람) · 영상 숫자 두 번(사람) · 규제 업종: 금지 표현 · 필수 문구(카드는 사람이) · 전후 · 문제 해결 · 권위 · 다른 이름 판촉 · 지어낸 사례',
    st(okCl, '단위째로') === 'pass' && st(badCl, '단위째로') === 'warn' && st(badCl, '구매처 · 후기를 볼 수 있는 곳') === 'warn' && st(badCl, "'OO'") === 'warn' && st(badCl, '한글로 쓴 숫자') === 'warn' && st(okCl, '한글로 쓴 숫자') === 'manual' && st(okCl, '작성자 소개 표') === 'manual' && st(rcl('blog', [], fp, true), '작성자 소개 표') === null &&
    st(rcl('video', [], fp), '두 번') === 'manual' && st(insCl, '보험 금지 표현') === 'warn' && st(insCl, '필수 안내 문구가 들어갔는가(카드뉴스는 사람이 직접 넣었는가)') === 'warn' && st(insCl, "'문제 해결'(손실 압박)") === 'manual' && st(rcl('blog', [], lw), "지어낸 '실제 사례'") === 'pass' && st(rcl('blog', ['case-made'], lw), "지어낸 '실제 사례'") === 'warn' && st(okCl, '보험 금지') === null,
    [st(okCl, '단위째로'), st(badCl, '단위째로'), st(badCl, '구매처 · 후기를 볼 수 있는 곳'), st(badCl, "'OO'"), st(badCl, '한글로 쓴 숫자'), st(okCl, '한글로 쓴 숫자'), st(okCl, '작성자 소개 표'), st(rcl('blog', [], fp, true), '작성자 소개 표'), st(rcl('video', [], fp), '두 번'), st(insCl, '보험 금지 표현'), st(insCl, '필수 안내 문구가 들어갔는가(카드뉴스는 사람이 직접 넣었는가)'), st(insCl, "'문제 해결'(손실 압박)"), st(rcl('blog', [], lw), "지어낸 '실제 사례'"), st(rcl('blog', ['case-made'], lw), "지어낸 '실제 사례'"), st(okCl, '보험 금지')])
}

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
  for (const [pp, key] of [[fp7, 'open'], [fp7, 'event'], [{ ...fp7, tone: 'formal' }, 'move'], [fp7, 'hiring'], [np, 'review'], [fp7, 'thanks']] as const) {
    for (const { tab, draft: d } of situationPack(pp, key, today).items) console.log(`\n===== 상황 ${key} · ${tab} · ${pp.tone} · ${d.title}\n${plainText(d.kind, d.blocks)}\n-- notes: ${d.notes.join(' / ')}`)
  }
}

console.log(`\n홍보 글 만들기: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
