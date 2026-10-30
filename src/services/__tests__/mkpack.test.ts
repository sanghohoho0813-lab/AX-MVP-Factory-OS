/**
 * D-251 마케팅 첫 화면 — 이번 주 키워드 하나 → 콘텐츠 묶음(제목 · 유튜브 · 릴스 · 블로그 · 카드뉴스 · 올릴 때 글).
 * 규칙 초안(AI 아님) · AI 답을 칸으로 · 이 브라우저에 남기는 칸 · AI 에 보내는 자료.
 */
import { ASSISTS, RADAR_RULES, buildAssistPrompt } from '../../../api/_ai/assists.js'
import { ASSIST_PRESETS } from '../aiAssist/presets'
import { packBundle } from '../aiAssist/builders'
import { BRIEF_FIELDS, DEFAULT_BRIEF, listIdeas, saveIdea } from '../marketing/radarStore'
import { prepareFeed } from '../marketing/ytBench'
import { radarPlan } from '../marketing/ytRadar'
import { sampleFeed } from '../marketing/ytSample'
import { noticeKeywords, noticePackSource, noticeTopicOf, rememberWeek, weekChange, weekOf, weekWindow, withNoticeFacts, withNoticeKeywords } from '../marketing/noticeKeywords'
import { parseBizinfoJson, postedOf } from '../grants/grantText'
import { LONG_DAY, SHORT_SLOTS, THREAD_SLOTS, buildWeek, normalizeWeekSaved, partResult, parseWeekStore, placeThreads, putWeekStore, weekCalendar, weekLintSummary, weekRequests, weekSetup, weekStart, weekText, type WeekSaved } from '../marketing/weekPlan'
import { collectWeek, decideRow, weekBadge, weekItemId, weekRows } from '../marketing/weekCollect'
import { brandPicks, briefCores, coreChoices, coreOf } from '../marketing/brandAngle'
import { kitContext, parseKitAnswer, parseKitStore, putKitStore } from '../marketing/kitAi'
import { shootKit } from '../marketing/shootKit'
import { listThreadPosts, saveThreadPost, sortThreadPosts, type ThreadDraft } from '../marketing/threads'
import { listShortPosts, type ShortDraft } from '../marketing/shorts'
import type { GrantNotice } from '../grants/grantMatch'
import {
  HOLE,
  PACK_AI_PARTS,
  PACK_AVOID,
  PACK_RULES,
  PACK_SECTIONS,
  PACK_STORE_KEY,
  PACK_STORE_MAX,
  aiSections,
  cleanTopic,
  countHoles,
  fit,
  customSource,
  makePack,
  packSourceOf,
  packText,
  parsePackStore,
  putPackStore,
  sectionText,
  withAi,
  type ContentPack,
  type PackSource,
} from '../marketing/contentPack'

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

const NOW = Date.parse('2026-10-14T03:00:00Z')
const plan = radarPlan(prepareFeed(sampleFeed(NOW), NOW), { now: NOW })
const picks = plan.picks
const customs = ['정책자금 2027 달라지는 점', 'ChatGPT 견적서 자동화', '가업승계'].map((t) => customSource(t)!)
const sources: PackSource[] = [...picks.map(packSourceOf), ...customs]
const packs: ContentPack[] = sources.map((s) => makePack(s, null))
const viewer = (p: ContentPack) => p.sections.filter((x) => x.id !== 'checks')
const sec = (p: ContentPack, id: string) => p.sections.find((x) => x.id === id)!
const allText = (p: ContentPack) => viewer(p).flatMap((x) => x.blocks.map((b) => `${b.label}\n${b.text}`)).join('\n')

/* ---------------- 규칙 초안 ---------------- */
{
  check('M0 예시 레이더에서 이번 주 키워드가 나온다(3개 이상)', picks.length >= 3, picks.length)
  const order = PACK_SECTIONS.map((s) => s.id).join()
  const badOrder = packs.filter((p) => p.sections.map((x) => x.id).join() !== order).map((p) => p.topic)
  check('M1 키워드마다 7칸 같은 순서(제목 · 유튜브 · 릴스 · 블로그 · 카드뉴스 · 올릴 때 글 · 발행 전 확인)', badOrder.length === 0 && order === 'titles,video,shorts,blog,cards,upload,checks', badOrder)
  const empty = packs.flatMap((p) => p.sections.flatMap((x) => x.blocks.filter((b) => !b.label.trim() || !b.text.trim()).map((b) => `${p.topic}/${x.id}/${b.label}`)))
  check('M2 빈 칸 없음 — 칸마다 이름 · 글', empty.length === 0 && packs.every((p) => p.sections.every((x) => x.blocks.length > 0)), empty)
  const avoid = packs.filter((p) => PACK_AVOID.test(allText(p))).map((p) => [p.topic, allText(p).match(PACK_AVOID)?.[0]])
  check('M3 쓰지 않는 말(꿀팁 · 충격 · 무조건 · 대박 · 100% · 최고의 …) 0 — 발행 전 확인 칸 빼고', avoid.length === 0, avoid)
  const holesOk = packs.every((p) => p.holes === countHoles(p.sections) && p.holes > 0 && sec(p, 'checks').blocks[0].text.includes(`${p.holes}곳`))
  check('M4 숫자 · 조건은 지어내지 않음 — [공식 자료 확인] 빈칸 수 = 발행 전 확인에 적힌 수', holesOk, packs.map((p) => p.holes))
  const leak = packs.filter((p) => p.source.facts.some((f) => allText(p).includes(f))).map((p) => p.topic)
  check('M5 레이더가 센 근거(채널 · 영상 수)는 시청자 글에 안 들어감 — 우리만 보는 칸에만', leak.length === 0 && packs.filter((p) => p.source.facts.length).every((p) => sec(p, 'checks').blocks.some((b) => b.label.includes('우리만'))), leak)
  const copied = packs.filter((p) => p.source.refs.some((r) => r.length >= 8 && allText(p).includes(r))).map((p) => p.topic)
  check('M6 참고 영상 제목을 그대로 쓰지 않음', copied.length === 0, copied)
  const same = JSON.stringify(makePack(sources[0], null)) === JSON.stringify(makePack(sources[0], null))
  check('M7 같은 키워드 → 같은 묶음(규칙 · 매번 같음)', same)
}

/* ---------------- 칸마다 ---------------- */
{
  const p = packs[0]
  const titles = sec(p, 'titles').blocks[0].text.split('\n')
  check('T1 제목 후보 5개 · 겹침 없음 · 추천 제목 = 1번', titles.length === 5 && new Set(titles).size === 5 && titles[0] === `1. ${p.headline}`, titles)
  const thumbs = sec(p, 'titles').blocks[1].text.split('\n')
  check('T2 썸네일 문구 1~3개', thumbs.length >= 1 && thumbs.length <= 3, thumbs)

  const video = sec(p, 'video').blocks
  const times = video.slice(1).map((b) => b.label.split(' ')[0])
  // D-273 롱폼 실측 공식 — 0~15초 증거 장면 → 결론 먼저 · 번호형 챕터 · 끝은 정리 · 다음 편
  check('V1 유튜브 대본 — 확정 제목 + 0:00 오프닝(증거 장면 · 결론 먼저) → 왜 지금 → 번호형 챕터 ①②③ → 7:30 정리 · 다음 편', video[0].label === '확정 제목' && times.join() === '0:00,0:40,1:30,3:30,5:30,7:30' && /증거 장면/.test(video[1].label) && video.filter((b) => /^\d+:\d+ [①②③] /.test(b.label)).length === 3 && video[6].label === '7:30 정리 · 다음 편', video.map((b) => b.label))
  check('V2 오프닝은 0~15초 증거 장면 → 첫 문장(찍기 키트) · 마무리는 채널 끝맺음', video[1].text.startsWith('[0~15초 증거 장면]') && video[1].text.includes(p.source.hook) && video[6].text.includes(DEFAULT_BRIEF.ending), video[1].text.slice(0, 80))
  check('V3 구간마다 [화면] 지시', video.slice(1).every((b) => b.text.includes('[화면]')))
  // D-274 대표 롱폼 마무리 V1.8 — 핵심 다시 짚기 → 임팩트 한 줄 → CTA 한 문장 → 다음 편 → 끝인사 · 숙제 없음 · 챕터마다 '해당 / 손해' 한 문장
  const endT = video[6].text
  const order = ['핵심만 다시 짚겠습니다', '먼저 알고 움직인 회사가', DEFAULT_BRIEF.ending, '다음 영상에서는', '김팀장이었습니다. 감사합니다.'].map((w) => endT.indexOf(w))
  check('V4 마무리 V1.8 순서(다시 짚기 → 임팩트 → CTA 한 문장 → 다음 편 → "김팀장이었습니다. 감사합니다.") · 숙제(적어 보세요) 없음 · 챕터 셋 모두 해당 / 손해 문장', order.every((x, i) => x >= 0 && (i === 0 || x > order[i - 1])) && !/적어\s*보세요|계산해\s*보세요/.test(endT) && video.slice(3, 6).every((b) => /해당되는지|놓치면|차이가 여기서/.test(b.text)) && /고정 댓글 링크/.test(DEFAULT_BRIEF.ending), { order, endT: endT.slice(0, 300) })

  const shorts = sec(p, 'shorts').blocks
  const fixed = shorts.slice(0, 2).map((b) => (b.text.split('\n')[0] ?? '').replace('상단 고정 문구: ', ''))
  const cuts = shorts.slice(0, 2).map((b) => b.text.split('\n').filter((l) => /초 {2}말:/.test(l)).length)
  check('S1 릴스 2편(50초 · 25초) — 상단 고정 문구 22자 이하 · 컷 15개 이하', shorts.length === 3 && fixed.every((f) => f.length > 0 && f.length <= 22) && cuts.every((n) => n >= 3 && n <= 15), { fixed, cuts })
  check('S2 첫 컷은 인사 없이 바로 · 끝은 3줄 요약', /인사 없이 바로/.test(shorts[0].text) && /3줄 요약/.test(shorts[0].text) && !/안녕하세요/.test(shorts[0].text))
  const tags = (shorts[2].text.match(/#[0-9A-Za-z가-힣]+/g) ?? [])
  // D-273 릴스 실측 — 해시태그 5개는 진 쪽에 더 많았다 → 0~3개
  check('S3 캡션 + 해시태그 3개 이하(겹침 없음)', tags.length >= 1 && tags.length <= 3 && new Set(tags).size === tags.length, tags)

  const blog = sec(p, 'blog').blocks
  const blogAll = blog.map((b) => b.text).join('\n')
  const photos = blogAll.match(/\[사진:/g)?.length ?? 0
  check('B1 블로그 제목 35자 이하 · 주제 키워드 맨 앞', blog[0].text.length <= 35 && blog[0].text.startsWith(p.topic.slice(0, 10)), blog[0].text)
  check('B2 도입 → 본문 3 → 한눈에 정리 표 → 다리 · 소개 · 문의', blog.map((b) => b.label.split(' ')[0]).join() === '제목,도입,본문,한눈에,다리' && /\| --- \| --- \|/.test(blog[3].text), blog.map((b) => b.label))
  check('B3 사진 자리 4~7곳', photos >= 4 && photos <= 7, photos)
  check('B4 작성자 소개 표 없음(규칙집)', !/작성자/.test(blogAll))

  const cards = sec(p, 'cards').blocks
  check('C1 카드뉴스 7장 — 장마다 큰 글자 · 작은 글자 · 그림', cards.length === 7 && cards.every((c) => /큰 글자:/.test(c.text) && /작은 글자:/.test(c.text) && /그림:/.test(c.text)))
  check('C2 마지막 장은 실제로 하는 일만(혜택 약속 · 기간 한정 없음)', !/한정|이번 달만|선착순/.test(cards[6].text) && /혜택 약속 없이/.test(cards[6].text), cards[6].text)

  const up = sec(p, 'upload').blocks
  const blogTags = up.find((b) => b.label.startsWith('블로그 태그'))!.text.split(', ')
  check('U1 올릴 때 글 — 설명란(타임스탬프) · 고정 댓글(개인정보 적지 말기) · 인스타 캡션 · 태그 10개 이하', /0:00 오프닝/.test(up[0].text) && /연락처는 적지 마세요/.test(up[1].text) && blogTags.length <= 10 && new Set(blogTags).size === blogTags.length, blogTags)
}

/* ---------------- 축마다 · 직접 주제 ---------------- */
{
  const axes = new Set(picks.map((o) => o.axis))
  // D-273 번호형 챕터(①②③) — 예전 '체크포인트 N —'
  const heads = (p: ContentPack) => sec(p, 'video').blocks.filter((b) => /^\S+ [①②③] /.test(b.label)).map((b) => b.label.replace(/^\S+ [①②③] /, ''))
  const market = packs.find((p) => p.source.axis === 'market')!
  const axai = packs.find((p) => p.source.axis === 'axai')!
  check('A1 시장 · AI 축은 챕터가 다름(누가 받나 ↔ 한 줄로 말하면)', !!market && !!axai && heads(market)[0].includes('누가 받을 수 있나') && heads(axai)[0].includes('한 줄로 말하면'), { axes: [...axes], m: market && heads(market), a: axai && heads(axai) })
  const bridge = makePack({ ...customs[0], key: 'bridge:정책자금 × 공고 자동 수집', topic: '정책자금 × 공고 자동 수집', axis: 'bridge', custom: false })
  check('A2 BRIDGE(시장 × 장치) — 손으로 챙기면 → 장치로 바꾸면 → 만드는 순서', heads(bridge).join('|') === '정책자금, 손으로 챙기면 생기는 일|공고 자동 수집으로 바꾸면|만드는 순서 3단계', heads(bridge))

  check('D1 직접 주제 — 2자 미만은 null · 괄호/꺾쇠 지움 · 40자', customSource(' ') === null && customSource('가') === null && cleanTopic('<b>정책[자금]</b>') === 'b정책자금/b' && cleanTopic('가'.repeat(60)).length === 40)
  check('D2 직접 주제 키 custom: · AI 말이 있으면 AI 축', customs[0].key === 'custom:정책자금 2027 달라지는 점' && customs[0].axis === 'market' && customs[1].axis === 'axai' && customs.every((c) => c.custom && c.facts.length === 0))
  const dp = makePack(customs[2])
  check('D3 직접 주제도 7칸 다 · 조사 맞음(가업승계를 · 가업승계는)', dp.sections.length === 7 && /가업승계를/.test(allText(dp)) && /가업승계는/.test(allText(dp)), allText(dp).slice(0, 200))
  check('D4 직접 주제는 근거 칸 없음 · 왜 지금은 "요즘 상담에서"', !sec(dp, 'checks').blocks.some((b) => b.label.includes('우리만')) && /요즘 상담에서/.test(sec(dp, 'video').blocks[2].text))
  const briefed = makePack(customs[0], { ...DEFAULT_BRIEF, host: '박대표(미래AI랩)', channel: '돈 되는 경영 — 설명', ending: '설명란 상담 신청서로 남겨 주세요.' })
  check('D5 채널 설계 기준을 고치면 인사 · 끝맺음이 따라감', /돈 되는 경영 박대표입니다/.test(sec(briefed, 'video').blocks[1].text) && allText(briefed).includes('설명란 상담 신청서로 남겨 주세요.'), sec(briefed, 'video').blocks[1].text.slice(0, 160))
}

/* ---------------- 점검에서 고친 것 ---------------- */
{
  check('F1 줄이기가 빈칸 한가운데서 자르지 않음([공식 자료 확인: … 가 닫히지 않은 채 남지 않음)', fit('대상은 [공식 자료 확인: 정책자금 2027 개편 대상 · 조건] 에 해당합니다', 20) === '대상은…' && fit('짧은 글', 20) === '짧은 글')
  const unclosed = packs.flatMap((p) => viewer(p).flatMap((x) => x.blocks.filter((b) => (b.text.match(/\[/g)?.length ?? 0) !== (b.text.match(/\]/g)?.length ?? 0)).map((b) => `${p.topic}/${x.id}/${b.label}`)))
  check('F2 모든 키워드 · 모든 칸에서 [ ] 짝이 맞음(카드뉴스 60자 줄임 포함)', unclosed.length === 0, unclosed)
  const ai = packs.find((p) => p.source.axis === 'axai')!
  const market = packs.find((p) => p.source.axis === 'market')!
  const aiShort = sec(ai, 'shorts').blocks.map((b) => b.text).join('\n')
  check('F3 AI 주제 쇼츠 · 카드는 AI 말로(시장 주제의 "서류는 미리 · 시기 · 마감" 이 안 섞임)', !/서류는 미리|시기 · 마감/.test(aiShort + sec(ai, 'cards').blocks[5].text) && /예시 하나/.test(aiShort) && sec(ai, 'shorts').blocks[1].label.startsWith('② 릴스 — 먼저 해 볼 것'), aiShort.slice(0, 300))
  check('F4 시장 주제는 예전 그대로(해당되는지 확인 · 시기 먼저 · 서류는 미리 · 놓치는 것 하나)', /해당되는지 확인, 시기 먼저, 서류는 미리/.test(sec(market, 'shorts').blocks[0].text) && sec(market, 'shorts').blocks[1].label.startsWith('② 릴스 — 놓치는 것 하나'))
  const merged = withAi(market, { upload: [{ label: '유튜브 설명란', text: 'AI 설명' }, { label: '고정 댓글', text: 'AI 댓글' }], titles: [{ label: '제목 후보', text: 'AI 제목' }] })
  const up = sec(merged, 'upload').blocks.map((b) => b.label)
  const ti = sec(merged, 'titles').blocks.map((b) => b.label)
  check('F5 AI 가 일부만 쓴 칸(올릴 때 글 · 제목)은 안 쓴 블록을 규칙 초안으로 남김 — 인스타 캡션 · 블로그 태그 · 다른 제목 · 썸네일 · 첫 문장', up.join() === '유튜브 설명란,고정 댓글,인스타 캡션,블로그 태그 10개,다른 제목 후보' && sec(merged, 'upload').blocks[0].text === 'AI 설명' && ti.join() === '제목 후보,썸네일 문구,첫 문장 (영상 시작 3초)', { up, ti })
}

/* ---------------- 복사 글 ---------------- */
{
  const p = packs[0]
  const t = packText(p)
  check('X1 전체 복사 — 주제 · 추천 제목 · 7칸 이름이 다', t.startsWith(`[콘텐츠 묶음] ${p.topic}`) && t.includes(`추천 제목: ${p.headline}`) && PACK_SECTIONS.every((s) => t.includes(`■ ${s.label}`)))
  check('X2 칸 복사 — ■ 칸 이름 + [블록 이름] 줄', sectionText(sec(p, 'blog')).startsWith('■ 블로그 글') && sectionText(sec(p, 'blog')).includes('[도입 (공감)]'))
}

/* ---------------- AI 답 → 칸 ---------------- */
{
  const v = aiSections(
    'video',
    '정책자금, 지금 확인할 3가지',
    [
      { title: '0:00 오프닝', tag: '유튜브 대본', body: '대표님, 오늘은…', outline: ['썸네일 크게'] },
      { title: '3:30 체크포인트 2 — 제목 짓는 법', tag: '유튜브 대본', body: '두 번째는…' },
      { title: '제목 후보', tag: '제목', outline: ['가', '나', '다', '라', '마'] },
      { title: '썸네일 문구', tag: '제목', outline: ['하나', '둘'] },
      { title: '빈 항목', tag: '유튜브 대본' },
      { title: '', tag: '제목', body: '이름 없는 항목' },
    ],
    ['노트북 화면 녹화', '공고 캡처'],
  )
  check('I1 유튜브 갈래 — tag 먼저(구간 제목에 "제목" 이 있어도 대본 칸) · 제목 칸 따로', v.video?.length === 4 && v.video[0].label === '확정 제목' && v.video[2].label.includes('제목 짓는 법') && v.titles?.length === 2, { video: v.video?.map((b) => b.label), titles: v.titles?.map((b) => b.label) })
  check('I2 outline 은 "- " 줄로 · 빈 항목 · 이름 없는 항목은 버림 · next → 찍기 전 준비물', v.video![1].text.includes('- 썸네일 크게') && v.titles![0].text.split('\n').length === 5 && v.video![3].label === '찍기 전 준비물' && v.video![3].text.includes('□ 공고 캡처'))
  const s = aiSections('short', '', [
    { title: '① 핵심 셋(50초)', tag: '릴스', body: '0~3초 말: …' },
    { title: '캡션', tag: '릴스', body: '캡션 글 #정책자금' },
    { title: '카드뉴스 7장', tag: '카드뉴스', outline: ['1장 | 표지 | | 그림'] },
    { title: '유튜브 설명란', body: '요약' },
    { title: '고정 댓글', tag: '올릴 때 글', body: '댓글' },
    { title: '모르는 것', body: '어디로?' },
  ])
  check('I3 릴스 갈래 — 릴스(캡션 포함) · 카드뉴스 · 올릴 때 글(tag 없으면 title 로) · 모르면 첫 칸(릴스)', s.shorts?.length === 3 && s.cards?.length === 1 && s.upload?.length === 2 && !s.titles && !s.video, { shorts: s.shorts?.map((b) => b.label), upload: s.upload?.map((b) => b.label) })
  const b = aiSections('blog', '', [{ title: '제목', tag: '블로그', body: '정책자금, 먼저 볼 3가지' }, { title: '도입', tag: '블로그', body: '…' }], ['정책자금', '중소기업'])
  check('I4 블로그 갈래 — 한 칸에 순서대로 · next → 블로그 태그', b.blog?.length === 3 && b.blog[2].label === '블로그 태그' && b.blog[2].text === '정책자금, 중소기업')
  check('I5 갈래 셋 = 서버 질문 셋(radar.pack.*) · 칸이 겹치지 않음 · 발행 전 확인은 AI 가 안 씀', PACK_AI_PARTS.map((x) => x.assistId).join() === 'radar.pack.video,radar.pack.short,radar.pack.blog' && new Set(PACK_AI_PARTS.flatMap((x) => x.sections)).size === 6 && !PACK_AI_PARTS.some((x) => x.sections.includes('checks')))

  const base = packs[0]
  const over = withAi(base, { video: [{ label: '확정 제목', text: base.headline }, { label: '0:00 오프닝', text: '빈칸 없는 AI 대본' }], blog: [{ label: '제목', text: '[공식 자료 확인: 금리] 한 곳' }] })
  const keptOthers = ['titles', 'shorts', 'cards', 'upload'].every((id) => JSON.stringify(sec(over, id)) === JSON.stringify(sec(base, id)))
  const expect = countHoles(over.sections)
  check('W1 AI 칸을 덮어도 나머지 칸은 규칙 초안 그대로 · 빈칸 수 · 발행 전 확인 다시 셈', keptOthers && sec(over, 'video').blocks.length === 2 && over.holes === expect && over.holes < base.holes && sec(over, 'checks').blocks[0].text.includes(`${expect}곳`) && over.source === base.source, { base: base.holes, over: over.holes })
  check('W4 AI 확정 제목이 있으면 머리 제목도 바뀜 · 없으면 규칙 제목 그대로', withAi(base, { video: [{ label: '확정 제목', text: 'AI 제목' }, { label: '0:00', text: '대사' }] }).headline === 'AI 제목' && withAi(base, { blog: [{ label: '제목', text: 'x' }] }).headline === base.headline)
  check('W2 AI 가 빈 칸을 주면 덮지 않음', JSON.stringify(withAi(base, { blog: [] }).sections) === JSON.stringify(base.sections))
  check('W3 [공식 자료 확인] · [실제 사례] · [실제 숫자] 를 빈칸으로 셈', ('[공식 자료 확인: a] [실제 사례 — b] [실제 숫자: c] [사진: d]'.match(HOLE) ?? []).length === 3)
}

/* ---------------- 이 브라우저에 남기는 칸 ---------------- */
{
  check('K1 깨진 값 · 배열 · 빈 값 → 빈 칸', Object.keys(parsePackStore('{')).length === 0 && Object.keys(parsePackStore('[1]')).length === 0 && Object.keys(parsePackStore(null)).length === 0 && PACK_STORE_KEY.startsWith('axmvp.'))
  const raw = JSON.stringify({
    'market:a': { at: '2026-10-20T01:00:00Z', model: 'gemini', sections: { video: [{ label: '0:00', text: 'x'.repeat(20000) }, { label: 3 }], nope: [{ label: 'a', text: 'b' }] } },
    'market:b': { at: 5, sections: {} },
    'market:c': { at: '2026-10-20T02:00:00Z', sections: { blog: 'not array' } },
  })
  const st = parsePackStore(raw)
  check('K2 모르는 칸 · 이상한 블록 버림 · 글 1만 2천 자에서 자름 · 빈 결과는 안 남김', Object.keys(st).join() === 'market:a' && st['market:a'].sections.video?.length === 1 && st['market:a'].sections.video![0].text.length === 12000 && !('nope' in st['market:a'].sections), st)
  let store = {}
  for (let i = 0; i < 20; i++) store = putPackStore(store, `k${i}`, { at: `2026-10-20T00:${String(i).padStart(2, '0')}:00Z`, model: '', sections: { blog: [{ label: 'a', text: 'b' }] } })
  check('K3 최근 12개만 남김(오래된 것부터 버림)', Object.keys(store).length === PACK_STORE_MAX && PACK_STORE_MAX === 12 && 'k19' in store && !('k7' in store) && 'k8' in store)
}

/* ---------------- AI 에 보내는 자료 · 서버 질문 ---------------- */
{
  const p = packs[0]
  const bundle = packBundle({ today: '2026-10-20', pack: p, brief: null })
  const names = bundle.context.sections.map((s) => s.name)
  check('P1 보내는 자료 — 고른 키워드 · 채널 설계 기준 · 규칙 초안 뼈대(6칸) + 규칙집', names.length === 3 && names[0].startsWith('고른 키워드') && names[1].startsWith('채널 설계 기준') && names[2].includes('6칸') && bundle.context.sections[2].rows.length === 6 && JSON.stringify(bundle.context.rules) === JSON.stringify(PACK_RULES), names)
  const sent = JSON.stringify(bundle)
  check('P2 고객 · 개인 정보 없음(레이더 · 미래AI랩 자료만) · 링크 없음', !/@|010-|\d{6}-\d{7}/.test(sent) && Object.keys(bundle.links).length === 0)
  for (const part of PACK_AI_PARTS) {
    const a = ASSISTS[part.assistId]
    const preset = ASSIST_PRESETS.find((x) => x.id === part.assistId)
    const { user, sent: meta } = buildAssistPrompt(a, bundle.context, '')
    check(`P3 ${part.assistId} — 서버 질문(page radar · 긴 글) = 화면 질문 · 규칙집이 다 들어감 · 4만 자 안 · 줄임 0`, !!a && a.page === 'radar' && preset?.kind === 'write' && preset.page === 'radar' && PACK_RULES.every((r) => user.includes(r.slice(0, 40))) && meta.userChars < 40000 && meta.rowsCut === 0, { page: a?.page, chars: meta.userChars, cut: meta.rowsCut })
  }
  check('P4 radar 쪽 공통 마케팅 규칙도 같이 감(서버가 붙임)', RADAR_RULES.length > 0)
}

/* ---------------- D-267 이번 주 공고 키워드 · 지난주와 비교 ---------------- */
{
  const T = '2026-10-22'
  const n = (id: string, title: string, o: Partial<GrantNotice> = {}): GrantNotice => ({ id, title, agency: '중소벤처기업부', operator: '', category: 'etc', applyStart: '', applyEnd: '2026-11-30', deadlineKind: 'date', amountText: '', target: '중소기업', summary: '', url: `https://www.bizinfo.go.kr/x?${id}`, rules: {} as GrantNotice['rules'], source: 'bizinfo', published: true, createdAt: T, updatedAt: T, ...o }) as GrantNotice
  check('N1 공고 → 우리 분야 — 금융 분야 · 융자 → 정책자금 / 인력 · 채용 → 고용지원금 / 벤처 · 연구소 → 인증 / 소상공인 먼저 / 그 밖 지원사업',
    noticeTopicOf(n('a', '2026년 하반기 중소기업 운전자금 융자 공고', { category: 'money' })) === 'policy_fund' &&
      noticeTopicOf(n('b', '경기도 이차보전 지원사업')) === 'policy_fund' &&
      noticeTopicOf(n('c', '청년 채용 인건비 지원', { category: 'hr' })) === 'employ_subsidy' &&
      noticeTopicOf(n('d', '2026 기업부설연구소 설립 컨설팅 지원')) === 'certification' &&
      noticeTopicOf(n('e', '소상공인 경영안정자금 융자', { category: 'money' })) === 'sme_subsidy' &&
      noticeTopicOf(n('f', '2026 수출바우처 2차 모집', { category: 'export' })) === 'grant_program')
  check('N1b 분야(금융 · 인력)만으로는 아님 — 실제 공고 "품질인증 바우처"(금융) · "근로자 임대주택"(인력)은 정부지원사업 / "경영안정자금" · "일자리창출" 은 맞음',
    noticeTopicOf(n('g', '[경남] 진주시 2026년 우수바이오제품 품질인증 맞춤형 바우처 지원사업 운영계획 변경 공고', { category: 'money' })) === 'grant_program' &&
      noticeTopicOf(n('h', '[부산] 기장군 LH임대주택 중소기업 근로자 공공임대주택 기관공급 사업 대상기업 모집계획 공고', { category: 'hr' })) === 'grant_program' &&
      noticeTopicOf(n('i', '[강원] 2026년 관광사업체 경영안정자금 지원계획 추가 공고', { category: 'money' })) === 'policy_fund' &&
      noticeTopicOf(n('j', '[서울] 금천구 2026년 일자리창출 우수기업 인증 신청기업 모집 공고', { category: 'hr' })) === 'employ_subsidy')
  const list = [
    n('p1', '2026 정책자금 융자 3차 공고', { category: 'money', postedAt: '2026-10-21', applyEnd: '2026-10-27' }),
    n('p2', '신용보증 특례 지원', { category: 'money', postedAt: '2026-10-16' }),
    n('p3', '기술보증 우대 보증', { category: 'money', postedAt: '2026-10-15' }),
    n('p4', '시설자금 융자 — 지난주', { category: 'money', postedAt: '2026-10-10' }),
    n('p5', '마감 지난 정책자금', { category: 'money', postedAt: '2026-10-20', applyEnd: '2026-10-21' }),
    n('h1', '청년 일자리 도약 장려금 참여기업 모집', { category: 'hr', applyStart: '2026-10-20' }),
    n('h2', '중장년 채용 인건비 지원', { category: 'hr', postedAt: '2026-10-19' }),
    n('h3', '고용유지 지원', { category: 'hr', postedAt: '2026-10-22', applyEnd: '2026-10-25' }),
    n('c1', '벤처기업 확인 설명회', { postedAt: '2026-10-20' }),
  ]
  const ks = noticeKeywords(list, T)
  check('N2 이번 주(오늘까지 7일 · 10/16~10/22) 새 공고만 — 올라온 날 · 없으면 접수 시작일 · 지난주 · 마감 지난 것 빼기 · 1건(인증)은 흐름 아님 · 정책자금이 수가 적어도 먼저',
    ks.map((k) => `${k.topicId}:${k.fresh.length}`).join() === 'policy_fund:2,employ_subsidy:3' && weekWindow(T).from === '2026-10-16', ks.map((k) => `${k.topicId}:${k.fresh.map((x) => x.id)}`))
  const pf = ks.find((k) => k.topicId === 'policy_fund')!
  check('N3 새 것 먼저 · 7일 안 마감은 따로(가까운 것 먼저) · 칩 "이번 주 새 공고 2건"', pf.fresh.map((x) => x.id).join() === 'p1,p2' && pf.closing.map((x) => x.id).join() === 'p1' && pf.note === '이번 주 새 공고 2건' && pf.key === 'notice:policy_fund')
  const src = noticePackSource(pf, T)!
  check('N4 묶음 재료 — 왜 지금(기간 · 새 공고 · 곧 마감) · 근거에 실제 공고 이름 · 소관 · 마감 · 관점 · 제목은 분류표 그대로 · 금액은 짓지 않음',
    src.why.includes('10/16~10/22') && src.why.includes('새로 2건') && src.why.includes('1건은 7일 안에 마감') && src.facts.some((f) => f.includes('2026 정책자금 융자 3차 공고 — 중소벤처기업부 · 마감 10/27')) && src.titles.length === 3 && src.titles[0].includes('정책자금') && src.hook.includes('2건') && !/\d+\s*(억|만)\s*원/.test([src.why, ...src.facts, src.hook].join(' ')), src)
  const pack = makePack(src)
  check('N5 공고 키워드로도 묶음이 그대로(섹션 7 · 보이는 글에 쓰지 않는 말 0 · 근거는 우리만 보기 칸)', pack.sections.length === PACK_SECTIONS.length && !PACK_AVOID.test(allText(pack)) && packText(pack).includes('이번 주 새 공고 2건'), allText(pack).match(PACK_AVOID)?.[0])
  type HK = { key: string; topicId?: string; notice?: boolean }
  const base: HK[] = Array.from({ length: 10 }, (_, i) => ({ key: `axai:t${i}`, topicId: `t${i}` }))
  const merged = withNoticeKeywords(base, ks, (k) => ({ key: k.key, topicId: k.topicId, notice: true }))
  check('N6 첫 화면 — 공고 키워드 3번째(정책자금) · 6번째(고용지원금) 자리 · 10개 그대로(뒤에서 빠짐) · 칩', merged.list.length === 10 && merged.list[2].key === 'notice:policy_fund' && merged.list[5].key === 'notice:employ_subsidy' && merged.noteOf.get('notice:policy_fund') === '이번 주 새 공고 2건' && !merged.list.some((x) => x.key === 'axai:t9'), merged.list.map((x) => x.key))
  const withSame = withNoticeKeywords([{ key: 'market:policy_fund', topicId: 'policy_fund' }, ...base.slice(0, 3)], ks, (k) => ({ key: k.key, topicId: k.topicId, notice: true }))
  check('N7 같은 주제가 레이더에도 있으면 새 줄 대신 그 줄에 칩만(겹치지 않게)', !withSame.list.some((x) => x.key === 'notice:policy_fund') && withSame.noteOf.get('market:policy_fund') === '이번 주 새 공고 2건' && withSame.list[2].key === 'notice:employ_subsidy')
  const sameFacts = withNoticeFacts({ ...customSource('정책자금')!, key: 'market:policy_fund', custom: false }, pf)
  check('N8 레이더 묶음에 같은 주제 공고 근거 덧붙임', sameFacts.facts.some((f) => f.startsWith('이번 주 새 공고 2건')) && sameFacts.facts.some((f) => f.includes('2026 정책자금 융자 3차 공고')))
  check('N9 공고가 없거나 적으면 키워드 없음(억지로 넣지 않음)', noticeKeywords([], T).length === 0 && noticeKeywords([list[0]], T).length === 0)
  check('N10 주 이름 = 월요일 — 10/22(목) → 10/19 · 10/19(월) 그대로 · 10/25(일) → 10/19', weekOf('2026-10-22') === '2026-10-19' && weekOf('2026-10-19') === '2026-10-19' && weekOf('2026-10-25') === '2026-10-19' && weekOf('2026-10-26') === '2026-10-26')
  const r1 = rememberWeek({ '2026-10-12': ['a', 'b', 'c'] }, '2026-10-22', ['a', 'x', 'y'])
  const r2 = rememberWeek(r1.log, '2026-10-24', ['z'])
  check('N11 주마다 처음 목록만 적음(같은 주에 다시 와도 그대로) · 지난주 목록 돌려줌', r1.log['2026-10-19'].join() === 'a,x,y' && r1.last?.join() === 'a,b,c' && r2.log['2026-10-19'].join() === 'a,x,y')
  const many = rememberWeek({ '2026-09-14': ['1'], '2026-09-21': ['2'], '2026-09-28': ['3'], '2026-10-05': ['4'], '2026-10-12': ['5'] }, '2026-10-22', ['6'])
  check('N12 4주까지만 둠', Object.keys(many.log).join() === '2026-09-28,2026-10-05,2026-10-12,2026-10-19')
  const ch = weekChange(['a', 'x', 'y'], ['a', 'b', 'c'], (k) => k.toUpperCase())
  check('N13 지난주와 비교 — 새로 2개 · 빠진 것 이름 · 같으면 그렇다고 · 지난주 기록 없으면 아무것도', ch.fresh.has('x') && ch.fresh.has('y') && !ch.fresh.has('a') && ch.line === '지난주와 비교: 새로 2개 · 빠진 것: B, C' && weekChange(['a'], ['a'], (k) => k).line.includes('같은 키워드') && weekChange(['a'], null, (k) => k).line === '' && weekChange(['a'], null, (k) => k).fresh.size === 0)
  check('N14 기업마당 등록일시 읽기 — "2026-10-20 10:31:22" · "20261020" · 깨진 값은 빈칸', postedOf('2026-10-20 10:31:22') === '2026-10-20' && postedOf('20261020') === '2026-10-20' && postedOf('2026-13-01') === '' && postedOf('') === '')
  const parsed = parseBizinfoJson(JSON.stringify({ jsonArray: [{ pblancId: 'X1', pblancNm: '정책자금 공고', creatPnttm: '2026-10-21 09:00:00', reqstBeginEndDe: '20261021 ~ 20261110', pldirSportRealmLclasCodeNm: '금융' }] }))
  check('N15 받아 온 공고에 올라온 날(postedAt)이 남음', parsed.drafts[0]?.postedAt === '2026-10-21', parsed.drafts[0])
}

/* ---------------- D-346 1주일치 한 번에 — 롱폼 1 · 릴스/쇼츠 3 · 스레드 7(+예비 2) ---------------- */
/* ---------------- D-348 주제 = 본업(고정 키워드) × 미끼(이번 주 AI 흐름) 짝 셋 ---------------- */
{
  check('K1 만들 주 — 월 · 화는 이번 주, 수요일부터는 다음 주 월요일', weekStart('2026-11-02') === '2026-11-02' && weekStart('2026-11-03') === '2026-11-02' && weekStart('2026-10-29') === '2026-11-02' && weekStart('2026-11-08') === '2026-11-09', [weekStart('2026-11-02'), weekStart('2026-10-29'), weekStart('2026-11-08')])
  const CORE = ['정책자금', '고용지원금', '기업인증', '정부지원금', '정부지원사업']
  const coreSrc = (fresh: readonly number[]) => CORE.map((t, i) => ({ source: customSource(t)!, fresh: fresh[i] ?? 0 }))
  const trending = picks.map(packSourceOf)
  const tp = weekSetup(trending, coreSrc([0, 3, 0, 5, 1]), '2026-11-02')
  const axFirst = trending.some((t) => t.axis === 'axai')
  check('K2 짝 셋 — 본업은 이번 주 새 공고 많은 순(정부지원금 5 · 고용지원금 3 · 정부지원사업 1) · 미끼는 이번 주 키워드에서 AI 먼저 · 이름 = 본업 × 미끼', tp.pairs.length === 3 && tp.pairs.map((p) => p.core.topic).join() === '정부지원금,고용지원금,정부지원사업' && tp.pairs.every((p) => !!p.hook && p.label === `${p.core.topic} × ${p.hook.topic}`) && (!axFirst || tp.pairs[0].hook?.axis === 'axai'), tp.pairs.map((p) => p.label))
  const firsts = new Set([0, 1, 2, 3, 4].map((k) => weekSetup(trending, coreSrc([]), weekStart(`2026-11-${String(2 + k * 7).padStart(2, '0')}`)).pairs[0].core.topic))
  check('K2b 새 공고 수가 같으면 주마다 돌아가며 — 다섯 주에 다섯 본업이 모두 첫 짝', firsts.size === 5, [...firsts])
  const noTrend = weekSetup([], coreSrc([1, 0, 0, 0, 0]), '2026-11-02')
  check('K2c 이번 주 키워드가 없으면 늘 뜨는 AI 업무 활용이 미끼 · 흐름 목록도 그것', noTrend.pairs.length === 3 && noTrend.pairs[0].hook?.topic === 'AI 업무 활용(ChatGPT · Claude)' && noTrend.trend[0] === 'AI 업무 활용(ChatGPT · Claude)', noTrend.pairs.map((p) => p.label))
  const p0 = tp.pairs[0]
  check('K2d 재료 = 본업 주제 + 미끼로 시작하는 관점 · 순수 AI 설명으로 끝내지 않기 · 각도는 본업 길(지원금 → 몰라서 못 받던 돈)', p0.source.topic === p0.core.topic && p0.source.key.startsWith('bridge:') && p0.source.view.includes('순수 AI 설명으로 끝내지 않기') && p0.angle.includes('몰라서 못 받던 돈') && p0.angle.includes('(이번 주 뜨는 미끼)'), p0)
  const noCore = weekSetup(trending, [], '2026-11-02')
  check('K2e 고정 키워드가 없으면(드묾) 이번 주 키워드를 본업 자리에', noCore.pairs.length === 3 && noCore.pairs[0].core.topic === trending[0].topic, noCore.pairs.map((p) => p.label))
  const days = THREAD_SLOTS.filter((x) => x.day > 0).map((x) => x.day)
  check('K3 스레드 자리 — 월~일 하루 하나 + 예비 둘 · 아홉 글 모두 다른 틀 · 실화 · 실적 숫자 · 밥줄 틀(C · F · U) 없음', days.join() === '1,2,3,4,5,6,7' && THREAD_SLOTS.length === 9 && new Set(THREAD_SLOTS.map((x) => x.template)).size === 9 && !THREAD_SLOTS.some((x) => ['C', 'F', 'U'].includes(x.template)), THREAD_SLOTS.map((x) => x.template).join(''))
  check('K4 쇼츠 자리 — ①② 짝 1 틱톡 · 쇼츠(롱폼 전날 · 다음 날) · ③ 짝 2 릴스 · 다른 버전 하나 · 롱폼은 수요일', SHORT_SLOTS.filter((x) => x.n > 0).map((x) => `${x.n}${x.platform}${x.topic}${x.day}`).join() === '1tiktok02,2tiktok04,3reels16' && LONG_DAY === 3 && SHORT_SLOTS.some((x) => x.n === 0))
  const reqs = weekRequests(tp, DEFAULT_BRIEF, '2026-10-29')
  check('K5 여섯 갈래 — 롱폼 1(radar.pack.video) · 숏폼 2(shorts.write) · 스레드 3(threads.write) — 서버에 있는 공식 단추 그대로', reqs.map((r) => r.assistId).join() === 'radar.pack.video,shorts.write,shorts.write,threads.write,threads.write,threads.write' && reqs.every((r) => !!ASSISTS[r.assistId] && ASSISTS[r.assistId].page === r.page), reqs.map((r) => `${r.assistId}/${r.page}`))
  const sentOf = (i: number) => buildAssistPrompt(ASSISTS[reqs[i].assistId], reqs[i].context, '')
  const longU = sentOf(0).user
  check('K6 롱폼 자료 — 짝 1 본업 · 미끼 · 접목 각도 · 채널 설계 기준 · 규칙집(AI 는 미끼, 끝은 본업) · 이번 주 계획(수요일 · 쇼츠로 자를 곳) · 줄임 0', longU.includes(p0.core.topic) && longU.includes(p0.hook!.topic) && longU.includes('접목') && longU.includes('[규칙집]') && longU.includes('AI 는 미끼, 끝은 본업') && longU.includes('11/4(수)') && longU.includes('쇼츠로 자를 곳') && sentOf(0).sent.rowsCut === 0, [longU.slice(0, 300), sentOf(0).sent])
  const sA = sentOf(1).user
  const sB = sentOf(2).user
  const brief0 = BRIEF_FIELDS.filter((f) => DEFAULT_BRIEF[f.key]).map((f) => f.label)
  check('K7 쇼츠 자료 — ① ② 짝 1 · 틱톡 · 같은 주 롱폼 제목 · 링크는 고정 댓글 / ③ 짝 2 · 릴스 · 관점 · 둘 다 채널 설계 기준 전부 · 접목 · 규칙집', sA.includes(tp.pairs[0].label) && sA.includes('틱톡 · 유튜브 쇼츠') && sA.includes('같은주롱폼') && sA.includes('고정 댓글에만') && sB.includes(tp.pairs[1].label) && sB.includes('인스타 릴스') && sB.includes('관점') && [sA, sB].every((u) => u.includes('채널 설계 기준') && brief0.every((l) => u.includes(l)) && u.includes('접목') && u.includes('AI 는 미끼, 끝은 본업')), [sA.slice(0, 200), sB.slice(0, 200), brief0.filter((l) => !sA.includes(l))])
  const tU = [3, 4, 5].map((i) => sentOf(i).user)
  const tpls = tU.map((u) => [...u.matchAll(/(\d)번 ([A-X]) /g)].map((m) => m[2]).join(''))
  check('K8 스레드 자료 — 짝 셋 · 글마다 요일 · 목적 · 틀 뼈대(ETX / DGQ / ISP) · 요일 이름 · 채널 설계 기준 · 접목 · 본업 태그', tpls.join() === 'ETX,DGQ,ISP' && tU.every((u, i) => u.includes(tp.pairs[i].label) && u.includes('채널 설계 기준') && u.includes('접목') && u.includes('AI 는 미끼, 끝은 본업')) && tU[0].includes('11/2(월) 저장 · 공유') && tU[1].includes('뼈대:'), tpls)
  const leak = reqs.slice(1).filter((r) => tp.pairs.some((p) => p.hook?.facts.some((f) => JSON.stringify(r.context).includes(f))))
  check('K9 쇼츠 · 스레드 자료에 레이더 숫자(근거) 없음 · 개인정보 없음', leak.length === 0 && reqs.every((r) => !/010-|\d{6}-\d{7}/.test(JSON.stringify(r.context))), leak.map((r) => r.part))
  const d = (t: string, body = `${t} 본문`): ThreadDraft => ({ firstLine: t, template: t as ThreadDraft['template'], body, ending: '', selfComment: '', checks: [] })
  const placed = placeThreads(THREAD_SLOTS.filter((x) => x.part === 'th1'), [d('G'), d('D'), d('Q')])
  const loose = placeThreads(THREAD_SLOTS.filter((x) => x.part === 'th1'), [d('A'), d('D')])
  check('K10 스레드 답 → 자리 — 같은 틀은 그 요일로(답 순서가 섞여도) · 틀이 다르면 차례로 · 모자라면 빈 자리', placed.map((x) => x?.template).join() === 'D,G,Q' && loose.map((x) => x?.template ?? '-').join() === 'D,A,-', [placed.map((x) => x?.template), loose.map((x) => x?.template)])
  const longA = partResult('long', { headline: '확정 제목 X', items: [{ title: '0:00 오프닝', tag: '유튜브 대본', body: '말' }, { title: '제목 후보', tag: '제목', outline: ['a'] }] }, '규칙 제목')
  const empty = partResult('th0', { headline: '', items: [{ title: '', body: '' }] }, '')
  check('K11 답 나누기 — 롱폼은 대본 · 제목 칸(확정 제목) · 빈 답은 실패(null)', !!longA?.long?.video?.length && longA.long.video[0].text === '확정 제목 X' && !!longA.long.titles?.length && empty === null, longA)
  const rule = buildWeek(tp, DEFAULT_BRIEF, '2026-10-29', null)
  check('K12 규칙 초안(AI 전) — 롱폼 대본 · 쇼츠 4(①②③ + 다른 버전) · 스레드 9 · 모두 글이 있음 · AI 아님 · 주제 이름 = 짝', rule.long.script.length > 0 && !rule.long.ai && rule.shorts.length === 4 && rule.shorts.every((x) => x.draft.script.trim().length > 20 && !x.ai) && rule.threads.length === 9 && rule.threads.every((x) => x.draft.body.includes('[') && !x.ai) && rule.topics.join() === tp.pairs.map((p) => p.label).join(), rule.shorts.map((x) => x.draft.script.slice(0, 30)))
  const saved: WeekSaved = { at: '2026-10-29T01:00:00Z', model: 'gemini', start: '2026-11-02', topics: tp.pairs.map((p) => p.label), long: longA!.long, th1: [d('G', '첫 줄\n\n둘째\n\n이 셋 중 몇 번? 1 / 2 / 3'), d('D'), d('Q', '자세한 건 https://example.com')] }
  const w = buildWeek(tp, DEFAULT_BRIEF, '2026-10-29', saved)
  const sum = weekLintSummary(w)
  check('K13 AI 결과 섞기 — 온 갈래만 AI(롱폼 · 목~토) · 나머지는 초안 · 점검: 이번 주 11개 · 링크 글은 고칠 곳', w.long.ai && w.long.headline === '확정 제목 X' && w.threads.filter((x) => x.ai).map((x) => x.slot.day).join() === '4,5,6' && w.shorts.every((x) => !x.ai) && sum.total === 11 && (w.threads.find((x) => x.slot.day === 6)?.lint.bad ?? 0) > 0 && sum.pass < sum.total, sum)
  const cal = weekCalendar(w)
  check('K14 달력 — 7일 · 수요일 롱폼 · 화 쇼츠① · 목 쇼츠② · 토 릴스③ · 날마다 스레드', cal.length === 7 && cal[2].items.some((i) => i.kind === 'long') && cal[1].items.some((i) => i.text === '쇼츠 ①') && cal[3].items.some((i) => i.text === '쇼츠 ②') && cal[5].items.some((i) => i.text === '릴스 ③') && cal.every((c) => c.items.some((i) => i.kind === 'thread')), cal.map((c) => c.items.map((i) => i.text).join('+')))
  const txt = weekText(w)
  check('K15 전체 글 — 기간 · 짝 셋 · 롱폼(확정 제목) · 쇼츠 4 · 스레드 9 · 줄바꿈 셋 이상 없음', txt.startsWith('1주일치 콘텐츠 — 11/2(월) ~ 11/8(일)') && tp.pairs.every((p) => txt.includes(p.label)) && txt.includes('확정 제목 X') && (txt.match(/■ 스레드 /g) ?? []).length === 9 && (txt.match(/■ (쇼츠|릴스)/g) ?? []).length === 4 && !/\n{3,}/.test(txt), txt.slice(0, 200))
  const store = putWeekStore(putWeekStore(putWeekStore(putWeekStore(putWeekStore({}, { ...saved, start: '2026-10-05' }), { ...saved, start: '2026-10-12' }), { ...saved, start: '2026-10-19' }), { ...saved, start: '2026-10-26' }), saved)
  const back = parseWeekStore(JSON.stringify({ ...store, bad: { at: 1 }, '2026-12-01': { at: 'x', start: '2026-12-01' } }))
  check('K16 이 브라우저 저장 — 최근 4주만 · 깨진 값 · 모르는 칸은 버림 · 다시 읽으면 같은 결과', Object.keys(store).join() === '2026-11-02,2026-10-26,2026-10-19,2026-10-12' && Object.keys(back).length === 4 && JSON.stringify(buildWeek(tp, DEFAULT_BRIEF, '2026-10-29', back['2026-11-02'])) === JSON.stringify(w) && parseWeekStore('{x').constructor === Object, Object.keys(back))
  const sentAll = reqs.map((_, i) => sentOf(i).user).join('\n')
  check('K17 내부 자료 잠금 — 여섯 갈래 자료에 예전 점검 이름 · 문서 이름 · 버전 표시 없음', !/\.md\b|v\d+\.\d+|자체점검표/.test(sentAll.replace(/\(radar\.pack\.video v\d+\)|\(shorts\.write v\d+\)|\(threads\.write v\d+\)/g, '')), sentAll.match(/\.md\b|v\d+\.\d+/g))

  /* ---------------- D-349 결과 모으기 — 클라우드 · 내 콘텐츠 · 릴스 · 스레드 ---------------- */
  const shortD = (n: number): ShortDraft => ({ firstWords: '', format: '', seconds: '약 40초', script: `대본 ${n}\n이거 아직 손으로 해요?`, caption: `캡션 ${n}`, hashtags: '#정책자금' })
  const full: WeekSaved = { ...saved, shortA: [shortD(1), shortD(2)], shortB: [shortD(3), shortD(4)], th0: [d('E', '월 글'), d('T', '화 글'), d('X', '수 글')], th2: [d('I', '일 글'), d('S', '예비 글'), d('P', '예비 자료')] }
  const rows = weekRows('ws-A', full, undefined, '2026-11-01T00:00:00Z')
  check('L1 모을 줄 — 롱폼 1(대본 준비 · 수요일 올리기 · 짝 이름) · 쇼츠 3(예비 빼고 · 요일 붙임) · 스레드 7(예비 빼고 · 요일 · 목적) · 모두 AI 표시', !!rows.idea && rows.idea.status === 'script' && rows.idea.publishDate === '2026-11-04' && rows.idea.script.includes('확정 제목 X') && rows.idea.angle.includes(tp.pairs[0].label) && rows.shorts.length === 3 && rows.shorts.map((s) => s.topic.split(' · ')[0]).join() === '11/3(화),11/5(목),11/7(토)' && rows.shorts.every((s) => s.source === 'ai' && s.status === 'draft') && rows.threads.length === 7 && rows.threads.map((t) => t.topic.slice(0, 7)).join() === '11/2(월),11/3(화),11/4(수),11/5(목),11/6(금),11/7(토),11/8(일)' && rows.threads.every((t) => t.source === 'ai' && t.status === 'draft' && !t.body.includes('예비')), [rows.idea?.topic, rows.shorts.map((s) => s.topic), rows.threads.map((t) => t.topic)])
  const rowsB = weekRows('ws-B', full)
  check('L2 줄 id — 같은 주 같은 자리는 늘 같은 id · 작업공간이 다르면 다른 id(클라우드 표 id 는 하나뿐)', rows.threads[0].id === weekRows('ws-A', full).threads[0].id && rows.threads[0].id !== rowsB.threads[0].id && rows.idea?.id === weekItemId('ws-A', '2026-11-02', 'l') && new Set([rows.idea!.id, ...rows.shorts.map((s) => s.id), ...rows.threads.map((t) => t.id)]).size === 11, [rows.threads[0].id, rowsB.threads[0].id])
  const onlyLong = weekRows('ws-A', { ...full, long: undefined })
  const partOnly = weekRows('ws-A', full, ['th1'])
  check('L3 규칙 초안(AI 아님)은 모으지 않음 · 갈래를 주면 그 갈래 줄만(목~토 스레드 3)', onlyLong.idea === null && partOnly.idea === null && partOnly.shorts.length === 0 && partOnly.threads.map((t) => t.topic.slice(0, 7)).join() === '11/5(목),11/6(금),11/7(토)', partOnly.threads.map((t) => t.topic))
  check('L4 덮을지 — 없으면 새로 · 올린 글은 그대로 · 같은 글이면 안 씀 · 예전 AI 글 그대로면 새 글로 · 고쳤으면 그대로', decideRow(undefined, undefined, 'a') === 'write' && decideRow({ text: 'x', posted: true }, 'x', 'b') === 'posted' && decideRow({ text: 'b', posted: false }, 'a', 'b') === 'same' && decideRow({ text: 'a', posted: false }, 'a', 'b') === 'write' && decideRow({ text: '고침', posted: false }, 'a', 'b') === 'kept' && decideRow({ text: '고침', posted: false }, undefined, 'b') === 'kept')
  const sorted = sortThreadPosts(rows.threads).map((t) => weekBadge(t))
  check('L4b 기록표 — 1주일치 표시(요일) · 월요일 글이 맨 위부터 차례로 · 다른 글은 표시 없음', sorted.join() === ['11/2(월)', '11/3(화)', '11/4(수)', '11/5(목)', '11/6(금)', '11/7(토)', '11/8(일)'].map((x) => `1주일치 · ${x}`).join() && weekBadge({ id: 'thr_x', topic: '11/2(월) 무엇' }) === null, sorted)
  check('L5 클라우드에서 읽은 한 주 — 깨진 값 버림 · 같은 결과', normalizeWeekSaved(null) === null && normalizeWeekSaved({ at: 'x', start: 'bad', topics: [] }) === null && JSON.stringify(weekRows('ws-A', normalizeWeekSaved(JSON.parse(JSON.stringify(full)))!, undefined, 'T')) === JSON.stringify(weekRows('ws-A', full, undefined, 'T')))
}

/* D-349 실제로 목록에 넣기(시험은 메모리 저장) — 두 번 해도 줄이 늘지 않음 · 고친 글 · 올린 글 지킴 · 다시 쓰면 바뀜 */
{
  const tp = weekSetup(picks.map(packSourceOf), ['정책자금', '고용지원금', '기업인증'].map((t) => ({ source: customSource(t)!, fresh: 0 })), '2026-11-02')
  const dr = (t: string, body: string): ThreadDraft => ({ firstLine: body, template: t as ThreadDraft['template'], body, ending: '', selfComment: '', checks: [] })
  const sh = (s: string): ShortDraft => ({ firstWords: '', format: '', seconds: '', script: s, caption: '', hashtags: '' })
  const v1: WeekSaved = {
    at: '2026-11-02T01:00:00Z',
    model: 'gemini',
    start: '2026-11-02',
    topics: tp.pairs.map((p) => p.label),
    long: { video: [{ label: '확정 제목', text: '제목 1' }, { label: '0:00 오프닝', text: '대본 1' }] },
    shortA: [sh('쇼츠 하나'), sh('쇼츠 둘')],
    shortB: [sh('릴스 셋'), sh('릴스 예비')],
    th0: [dr('E', '월요일 글'), dr('T', '화요일 글'), dr('X', '수요일 글')],
    th1: [dr('D', '목요일 글'), dr('G', '금요일 글'), dr('Q', '토요일 글')],
    th2: [dr('I', '일요일 글'), dr('S', '예비 하나'), dr('P', '예비 둘')],
  }
  const WS = 'ws-collect'
  const first = await collectWeek(WS, v1, null)
  const again = await collectWeek(WS, v1, null)
  const [ideas1, shorts1, threads1] = await Promise.all([listIdeas(WS), listShortPosts(WS), listThreadPosts(WS)])
  check('L6 처음 모으기 — 내 콘텐츠 1 · 릴스/쇼츠 3 · 스레드 7 · 다시 해도 줄이 늘지 않고 쓰지도 않음', first.written === 11 && again.written === 0 && ideas1.length === 1 && shorts1.length === 3 && threads1.length === 7 && ideas1[0].key === 'week:2026-11-02' && ideas1[0].topic === '제목 1', [first, again, ideas1.length, shorts1.length, threads1.length])
  // 대표가 화요일 글을 고치고 · 월요일 글을 올렸다 · 내 콘텐츠 단계를 '촬영 완료' 로
  const tue = threads1.find((t) => t.topic.startsWith('11/3'))!
  const mon = threads1.find((t) => t.topic.startsWith('11/2'))!
  await saveThreadPost(WS, { ...tue, body: '대표가 고친 화요일 글' })
  await saveThreadPost(WS, { ...mon, status: 'posted', postedOn: '2026-11-02' })
  await saveIdea(WS, { ...ideas1[0], status: 'filmed', memo: '메모' })
  const v2: WeekSaved = { ...v1, at: '2026-11-02T02:00:00Z', long: { video: [{ label: '확정 제목', text: '제목 2' }, { label: '0:00 오프닝', text: '대본 2' }] }, th0: [dr('E', '새 월요일'), dr('T', '새 화요일'), dr('X', '새 수요일')], shortA: [sh('새 쇼츠 하나'), sh('쇼츠 둘')] }
  const re = await collectWeek(WS, v2, v1, ['long', 'th0', 'shortA'])
  const [ideas2, shorts2, threads2] = await Promise.all([listIdeas(WS), listShortPosts(WS), listThreadPosts(WS)])
  const body = (day: string) => threads2.find((t) => t.topic.startsWith(day))?.body
  check('L7 다시 쓰기 — 수요일 글 · 쇼츠 ①은 새 글로 · 고친 화요일 · 올린 월요일 · 촬영 완료 롱폼은 그대로 · 줄 수 그대로', body('11/4') === '새 수요일' && body('11/3') === '대표가 고친 화요일 글' && body('11/2') === '월요일 글' && shorts2.find((s) => s.topic.startsWith('11/3'))?.script === '새 쇼츠 하나' && ideas2[0].script.includes('대본 1') && ideas2[0].memo === '메모' && re.kept === 1 && re.posted === 2 && re.keptIds.length === 1 && threads2.length === 7 && shorts2.length === 3 && ideas2.length === 1, [re, body('11/2'), body('11/3'), body('11/4')])
  const other = await collectWeek('ws-other', v1, null)
  check('L8 다른 작업공간은 따로 — 대표 목록에 섞이지 않음', other.written === 11 && (await listThreadPosts(WS)).length === 7 && (await listThreadPosts('ws-other')).length === 7)
}

/* ---------------- D-351 이번 주 이렇게 찍으세요 = 채널 설계 기준의 본업으로 ---------------- */
{
  const own = briefCores(DEFAULT_BRIEF).map((c) => c.id)
  const cust = briefCores({ services: '절세 · 자본거래(가지급금 · 차등배당) · 정부지원금 · 정책자금 · 기업인증(이노비즈)', covers: '', bridge: '' }).map((c) => c.id)
  const none = briefCores({ services: '', covers: '', bridge: '' }).map((c) => c.id)
  check('S1 본업 목록 — 대표 기준은 AX · 시제품 · 벤처 · 정책자금 순 · 구독 컨설턴트는 적은 순서(절세 · 자본거래 · 지원금 · 정책자금 · 인증) · 없으면 돈 문제 셋', own.slice(0, 4).join() === 'ax,mvp,venture,policy' && cust.join() === 'tax,capital,grant,policy,cert' && none.join() === 'policy,grant,tax', { own, cust, none })
  const branded = brandPicks(picks, DEFAULT_BRIEF)
  const ai = branded.filter((o) => o.axis === 'axai')
  const market = branded.filter((o, i) => o.axis === 'market' && picks[i])
  const bad = /\d+\s*(분|배)|꿀팁|충격/
  check('S2 AI 주제는 모두 본업으로 이음(첫 문장 · 이렇게 말해요 · 제목) · 시장 주제는 그대로', ai.length > 0 && ai.every((o) => !!o.brand && o.view.includes('기능 소개로 끝내지 않습니다') && shootKit(o).hook === o.brand.hook) && market.every((o) => !o.brand && o.view === picks.find((p) => p.key === o.key)?.view), ai.map((o) => `${o.topic}→${o.brand?.label}`))
  const pats = ai.map((o) => new Set(o.titles.flatMap((t) => t.patterns)).size)
  check('S3 제목 — 틀이 다섯 가지 넘게(숫자 · 질문 · 방법 · 경고 · 비교 · 결과) · 본업 이름이 들어감 · 쓰지 않는 말 0', ai.every((o) => o.titles.length === 6 && o.titles.some((t) => t.text.includes(o.brand!.label.replace(/\(.*\)/, '')) || o.brand!.core === 'ax')) && pats.every((n) => n >= 5) && !ai.some((o) => o.titles.some((t) => bad.test(t.text))), { pats, t: ai[0]?.titles.map((t) => t.text) })
  check('S4 AI 후보가 여럿이면 본업이 돌아가며(같은 본업만 나오지 않게)', ai.length < 2 || new Set(ai.map((o) => o.brand?.core)).size >= 2, ai.map((o) => o.brand?.core))
  const custBrief = { ...DEFAULT_BRIEF, services: '절세 · 자본거래 · 정부지원금 · 정책자금 · 기업인증', covers: '', bridge: '' }
  const cb = brandPicks(picks, custBrief).filter((o) => o.axis === 'axai')
  check('S5 구독 컨설턴트(절세 · 자본거래 …) — AI 주제가 그 사람 본업으로(대표 AX 로 가지 않음)', cb.length > 0 && cb.every((o) => ['tax', 'capital', 'grant', 'policy', 'cert'].includes(o.brand?.core ?? '')) && cb.some((o) => o.titles.some((t) => /절세|자본거래|정부지원사업/.test(t.text))), cb.map((o) => o.brand?.core))
  const k0 = ai[0]
  const chosen = brandPicks(picks, DEFAULT_BRIEF, new Map([[k0.key, 'policy']])).find((o) => o.key === k0.key)!
  const kept = brandPicks(picks, DEFAULT_BRIEF, new Map(market[0] ? [[market[0].key, 'policy']] : [])).find((o) => o.key === market[0]?.key)
  check('S6 칩으로 고른 본업 — 그 본업으로 다시(정책자금) · 시장 주제도 고르면 본업으로 이음', chosen.brand?.core === 'policy' && chosen.titles.some((t) => t.text.includes('정책자금')) && (!market[0] || (kept?.brand?.core === 'policy' && kept.titles.some((t) => t.text.includes(market[0].topic)))), [chosen.titles.map((t) => t.text), kept?.titles.map((t) => t.text)])
  check('S7 칩 목록 — AI 주제는 본업 전부 · 본업인 시장 주제(정책자금 등)는 칩 없음', coreChoices(k0, briefCores(DEFAULT_BRIEF)).length === briefCores(DEFAULT_BRIEF).length && coreChoices({ topic: '정책자금 2027', axis: 'market' }, briefCores(DEFAULT_BRIEF)).length === 0)
  const ans = { headline: '도구가 아니라 정책자금 준비에 붙입니다.', items: [{ title: '정책자금 준비, Claude로 먼저 해 둘 3가지', tag: '제목', when: '숫자형' }, { title: 'Claude로 사업계획서 써도 될까?', tag: '제목', when: '질문형' }, { title: '첫 문장', tag: '첫 문장', body: '오늘은 기능 말고 정책자금입니다.' }, { title: '썸네일', tag: '썸네일', outline: ['정책자금 × Claude'] }, { title: '구성', tag: '구성', outline: ['0:00 결과 먼저'] }] }
  const kp = parseKitAnswer(ans, '정책자금', '2026-10-30T00:00:00Z', 'gemini')
  const back = parseKitStore(JSON.stringify(putKitStore({}, 'w:k', kp!)))
  check('S8 AI 추천 답 → 칸(제목 · 틀 · 첫 문장 · 썸네일 · 구성) · 첫 문장이 없으면 실패 · 저장했다 읽어도 같음', !!kp && kp.titles.length === 2 && kp.titles[0].type === '숫자형' && kp.hook.includes('정책자금') && kp.thumbs[0] === '정책자금 × Claude' && kp.outline.length === 1 && parseKitAnswer({ headline: '', items: [{ title: 'x', tag: '제목' }] }, '', '', '') === null && JSON.stringify(back['w:k']) === JSON.stringify(kp), kp)
  const kc = kitContext(k0, DEFAULT_BRIEF, coreOf('policy') ?? null, briefCores(DEFAULT_BRIEF), '2026-10-30')
  const sent = buildAssistPrompt(ASSISTS['radar.kit'], kc, '').user
  check('S9 AI 추천 단추(radar.kit) — 서버에 있음 · 보내는 자료에 채널 설계 기준 전부 · 후보 · 고른 본업 · 레이더 숫자 근거 없음', !!ASSISTS['radar.kit'] && ASSIST_PRESETS.some((p) => p.id === 'radar.kit') && sent.includes('채널 설계 기준') && sent.includes(k0.topic) && sent.includes('이 본업으로') && sent.includes('우리가 실제로 하는 일') && !k0.facts.some((f) => sent.includes(f)), sent.slice(0, 300))
  if (process.env.MK_SHOW) for (const o of branded.slice(0, 10)) console.log(`  ${o.axis} ${o.topic} → ${o.brand?.label ?? '(그대로)'}\n    ${o.titles.map((t) => t.text).join('\n    ')}\n    첫 문장: ${shootKit(o).hook}\n    말해요: ${o.view}`)
}

console.log(`\nmkpack: ${passed} passed, ${failed} failed`)
if (failed) process.exit(1)
