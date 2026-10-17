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
  monthPlan,
  monthPlanFrom,
  activePlan,
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
check('C29 쇼츠 · 릴스(D-207) — 고정 문구 · 첫 3초 · 구조 · 초 구간 대본(나레이션 · 자막 · 장면) · 마무리에 회사 · 대표 전화 · 캡션', ['고정 문구', '첫 3초 · 붙잡는 말', '구조', '캡션'].every((l) => sh.blocks.some((b) => b.label === l)) && sh.blocks.filter((b) => /^\d:\d{2} - \d:\d{2}$/.test(b.label)).length === 5 && sh.blocks.some((b) => b.text.includes('한솔정밀(주) · 031-123-4567')) && sh.blocks.filter((b) => /^\d:\d{2} - /.test(b.label)).every((b) => b.text.includes('나레이션:') && b.text.includes('자막:') && b.text.includes('장면:')), sh.blocks.map((b) => b.label))
const cards7 = makeDraft(fp, { kind: 'cards', topic: topics[0], pages: 7 }, today)
const cards5 = makeDraft(fp, { kind: 'cards', topic: topics[0], pages: 5 }, today)
check('C30 카드뉴스 5장 · 7장(표지 · 내용 · 마무리) + 올릴 때 쓰는 글', cards5.blocks.filter((b) => /장/.test(b.label)).length === 5 && cards7.blocks.filter((b) => /장/.test(b.label)).length === 7 && cards7.blocks.some((b) => b.label === '올릴 때 쓰는 글'))
const vid = makeDraft(fp, { kind: 'video', topic: topics[1] }, today)
check('C31 긴 영상(D-207) — 기획 카드(썸네일 문구 · 도입부 5~15초 · 주제 · 타겟 청중 · 전략) → 인사 · 본론 5 · 정리 · 마무리 · 설명란', ['썸네일 문구', '도입부 · 처음 5~15초', '주제', '타겟 청중', '전략', '0:15 · 인사', '설명란'].every((l) => vid.blocks.some((b) => b.label === l)) && vid.blocks.filter((b) => /^\d:00 · \d\. /.test(b.label)).length === 5, vid.blocks.map((b) => b.label))
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
check('C47 이 칸만 채우면 — 차별점이 맨 앞 · 채우면 빠짐 · 꽉 찬 업체는 0', gp[0]?.key === 'differ' && gp.some((g) => g.key === 'objection') && !gp.some((g) => g.key === 'phone') && profileGaps(fp7).length === 0 && profileGaps(ep).map((g) => g.key).join() === 'differ,phone,services,hours,objection', gp.map((g) => g.key))
check('C48 주제마다 전략 한 줄', topics.every((t) => t.strategy.length > 10) && new Set(topics.map((t) => t.strategy)).size === topics.length)
const bChoose = makeDraft(fp7, { kind: 'blog', topic: topicsFor(fp7, '', today).find((t) => t.type === 'choose') }, today)
const bTips = makeDraft(fp, { kind: 'blog', topic: topics[0] }, today)
const photosOf = (d: { blocks: { text: string }[] }) => d.blocks.filter((b) => b.text.startsWith('(사진 자리:')).length
check('C49 블로그 — 제목 → 첫 문단(키워드) → 사진 자리 3곳 이상 · 한눈에 정리 · 차별점 없으면 [자리] · 있으면 그 말 · 망설이는 점 풀기', bTips.blocks[0].hint === '제목' && bTips.blocks[1].hint === '첫 문단(도입부)' && bTips.blocks[1].text.includes(topics[0].keyword) && photosOf(bTips) >= 3 && photosOf(bChoose) >= 3 && bChoose.blocks.some((b) => b.label === '한눈에 정리' && b.text.startsWith('확인할 것 | 이유')) && plainText('blog', bChoose.blocks).includes('시공 뒤 1년 무상 점검') && plainText('blog', bChoose.blocks).includes('공사 기간이 길까 봐') && placeholders(plainText('blog', bChoose.blocks)).length < placeholders(plainText('blog', makeDraft(fp, { kind: 'blog', topic: topicsFor(fp, '', today).find((t) => t.type === 'choose') }, today).blocks)).length, bTips.blocks.map((b) => b.hint ?? b.label))
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
check(`C54 카드뉴스 광고 유형 ${AD_TYPES.length}가지 × 5 · 7장 × 업체 3 + 빈 업체 × 업종 ${INDUSTRIES.length} — 장 수 · 1장 표지 · 끝 마무리 · 번호 차례 · 유형 표시`, AD_TYPES.length === 5 && adBad.length === 0 && objCards.includes('공사 기간이 길까 봐, 걱정되시죠?') && CONTENT_LIB.manufacturing.problems.some((w) => probCards.includes(w)), adBad.slice(0, 3))
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
