/**
 * AI 도우미 — 마케팅 · 콘텐츠 레이더 · 홍보 글 화면의 자료 묶음(D-239 · builders.ts 에서 떼어 냄).
 * D-481 업무 화면(오늘 · 고객 관리 · 수금 …)이 AI 지시문 묶음을 받을 때 홍보 글 엔진 · 유튜브 레이더까지 함께 받지 않게 파일만 나눴다 — 묶음 내용은 그대로.
 */
import { todayLabel } from './builders'
import { RefBook, safeText } from './context'
import type { AssistBundle, AssistSection } from './context'
import { STRENGTH_LABEL, myChannelStats, ratioLine } from '../marketing/ytRadar'
import type { RadarPlan, RadarVideo, RisingTopic } from '../marketing/ytRadar'
import { BRIEF_FIELDS, defaultBrief, IDEA_STATUS_LABEL, MAKE_CHECKS } from '../marketing/radarStore'
import type { ChannelBrief, ContentIdea } from '../marketing/radarStore'
import { shootKit } from '../marketing/shootKit'
import { linkedVideo, perfOf } from '../marketing/myPerformance'
import { PACK_SECTIONS, packRules, type ContentPack } from '../marketing/contentPack'
import { customerProfileLines, isMarketingCustomer } from '../marketing/persona'
import { ANGLES, RISKY_WORDS, aiRequestFacts, aiRequestText, briefSlots } from '../contentStudio'
import type { ContentProfile, ProfileSource } from '../contentStudio'

/* ------------------------------------------------------------------ */
/* 마케팅 · 콘텐츠 레이더                                                  */
/* ------------------------------------------------------------------ */

/** 미래AI랩이 누구인지 — 레이더 · 홍보 글 AI 가 같은 관점으로 쓰게 */
/**
 * D-347 채널 설계 기준 줄 — 칸 글이 길면(최대 800자) 문장 끝에서 290자 안쪽으로 나눠 '(이어서)' 줄로.
 * 서버가 칸 하나를 300자에서 자르므로 한 칸에 다 담으면 뒤가 잘린다. 롱폼 · 쇼츠 · 스레드 · 영상 창이 같은 줄을 쓴다.
 */
export function briefRows(brief: ChannelBrief): { 항목: string; 기준: string }[] {
  const out: { 항목: string; 기준: string }[] = []
  for (const f of BRIEF_FIELDS) {
    const text = safeText(brief[f.key], [], 800)
    if (!text) continue
    const parts: string[] = []
    let rest = text
    while (rest.length > 290) {
      const cut = Math.max(rest.lastIndexOf('. ', 290), rest.lastIndexOf(' / ', 290), rest.lastIndexOf(' · ', 290))
      const at = cut > 120 ? cut + 1 : 290
      parts.push(rest.slice(0, at).trim())
      rest = rest.slice(at).trim()
    }
    if (rest) parts.push(rest)
    parts.forEach((p, i) => out.push({ 항목: i ? `${f.label}(이어서)` : f.label, 기준: p }))
  }
  return out
}
export const briefSection = (brief: ChannelBrief) => ({ name: '채널 설계 기준(대표가 정함 — 반드시 따름)', rows: briefRows(brief) })

export const MIRAE_PROFILE = [
  '미래AI랩: 중소기업 대표를 돕는 컨설팅 회사 — 정책자금 · 고용지원금 · 기업부설연구소 · 창업감면 · 절세 · 지원사업 · AX(업무에 AI 넣기) · 기업인증.',
  '유튜브 · 블로그 시청자 = 중소기업 대표와 실무자. 말투는 쉬운 말, 과장 없이, 실제 사례와 숫자로.',
  '우리만 말할 수 있는 것: 수백 개 업체 상담에서 본 실제 실수 · 받을 수 있는데 몰라서 못 받는 돈 · AI 를 현장 업무에 붙여 본 경험.',
]

/** SAAS-2 '우리는 누구인가' 줄 — 대표 계정은 미래AI랩 소개 · 고객은 그 사람 브랜드 설정에 적은 것만 */
const profileLines = (): string[] => (isMarketingCustomer() ? customerProfileLines() : MIRAE_PROFILE)

export interface RadarInput {
  today: string
  view: string
  plan: RadarPlan | null
  rising: readonly RisingTopic[]
  breakouts: readonly RadarVideo[]
  videos: readonly RadarVideo[]
  ideas: readonly ContentIdea[]
  mine: readonly RadarVideo[]
  /** D-241 채널 설계 기준(대표가 고침 · 없으면 기본값) */
  brief?: ChannelBrief | null
}

/**
 * D-241 콘텐츠 레이더 자료 — 대표: "미래AI랩이랑 전혀 어울리지 않는 방식 · 내 컨텐츠에 맞게 설계".
 * 예전(D-239)에는 남의 채널 영상과 회사 소개 3줄만 보내 일반론이 나왔다.
 * 이제 순서: ① 채널 설계 기준 ② 내 채널(최근 · 잘 된 것) ③ 이번 주 후보 + 찍기 키트(규칙 브리프) ④ 내 콘텐츠 ⑤ 남의 잘 된 영상 · 급상승.
 * 자료가 넘쳐 뒤를 줄여도 ①~③ 은 남는다(서버는 뒤쪽 줄부터 줄인다).
 */
export function radarBundle(i: RadarInput): AssistBundle {
  const book = new RefBook()
  const brief = i.brief ?? defaultBrief()
  const vRow = (v: RadarVideo) => ({
    ref: book.ref('v', v.id, v.url),
    제목: safeText(v.title, [], 120),
    채널: safeText(v.channelName, [], 40),
    조회: v.views,
    평소대비: ratioLine(v),
    올린지: `${v.ageDays}일`,
    길이: v.isShort ? '쇼츠' : `롱폼 ${Math.round(v.durationSec / 60)}분`,
  })
  const mineRow = (v: RadarVideo) => ({
    ref: book.ref('v', v.id, v.url),
    제목: safeText(v.title, [], 120),
    길이: v.isShort ? '쇼츠' : `롱폼 ${Math.round(v.durationSec / 60)}분`,
    조회: v.views,
    성과: perfOf(v).label,
    평소대비: ratioLine(v),
    올린지: `${v.ageDays}일`,
  })
  const picks = i.plan?.picks ?? []
  const mineById = new Map(i.mine.map((v) => [v.id, v]))
  const mineRecent = [...i.mine].sort((a, b) => b.publishedAt - a.publishedAt).slice(0, 20)
  const mineBest = [...i.mine].filter((v) => (v.adjusted ?? v.ratio ?? 0) > 1).sort((a, b) => (b.adjusted ?? b.ratio ?? 0) - (a.adjusted ?? a.ratio ?? 0)).slice(0, 6)
  const stats = myChannelStats(i.mine as RadarVideo[])
  const sections: AssistSection[] = [
    briefSection(brief),
    { name: '내 채널 최근 영상(새것부터)', rows: mineRecent.map(mineRow), total: i.mine.length },
    { name: '내 채널에서 평소보다 잘 된 영상', rows: mineBest.map(mineRow) },
    {
      name: '이번 주 찍을 후보(지금 순위대로 · 찍기 키트는 규칙으로 만든 브리프)',
      rows: picks.slice(0, 10).map((o, n) => {
        const kit = shootKit(o)
        return {
          // 같은 화면이라 주소는 두지 않는다(D-241 — 예전엔 '/marketing' 으로 이어져 눌러도 아무 일이 없었다). 답의 [내 콘텐츠에 담기] 가 이 번호로 후보를 찾는다
          ref: book.ref('o', o.key),
          순위: n + 1,
          주제: o.topic,
          신호: STRENGTH_LABEL[o.strength],
          왜지금: safeText(o.summary, [], 240),
          근거: o.facts.slice(0, 3),
          잘된영상: o.benchmarks.slice(0, 3).map((b) => `${safeText(b.title, [], 80)} (${safeText(b.channelName, [], 30)} · ${ratioLine(b)})`),
          [isMarketingCustomer() ? '관점_규칙' : '미래AI랩관점_규칙']: safeText(o.view, [], 300),
          잘된틀_우리제목: kit.frames.slice(0, 3).map((f) => `${f.label} → ${f.mine}`),
          첫문장_규칙: safeText(kit.hook, [], 160),
          구성_규칙: kit.outline.map((st) => `${st.at} ${st.what}`),
          쇼츠3컷_규칙: kit.shorts.map((st) => `${st.at} ${st.what}`),
          형식: kit.format,
          준비: kit.prep.slice(0, 3),
        }
      }),
    },
    {
      name: '내 콘텐츠(이미 담은 것 — 겹치지 않게)',
      rows: i.ideas.slice(0, 40).map((x) => {
        const linked = linkedVideo(x, mineById)
        return {
          ref: book.ref('i', x.id, `/marketing?view=make&idea=${encodeURIComponent(x.id)}`),
          주제: safeText(x.topic, [], 80),
          단계: IDEA_STATUS_LABEL[x.status],
          관점: safeText(x.angle, [], 200),
          첫문장: safeText(x.hook, [], 160),
          메모: safeText(x.memo, [], 400),
          촬영일: x.shootDate,
          게시일: x.publishDate,
          체크: `${x.checks.length}/${MAKE_CHECKS.length}`,
          제목후보: x.titleCandidates.slice(0, 3).map((t) => safeText(t, [], 120)),
          참고영상: x.benchmarkTitles.slice(0, 3).map((t) => safeText(t, [], 120)),
          대본: x.script ? `있음(${x.script.length.toLocaleString('ko-KR')}자)` : '',
          성과: linked ? `${perfOf(linked).label} · 조회 ${linked.views}` : x.link ? '올린 주소 있음(내 채널 숫자 없음)' : '',
        }
      }),
      total: i.ideas.length,
    },
    { name: '남의 채널 — 평소보다 크게 잘 된 영상(틀만 참고)', rows: i.breakouts.slice(0, 20).map(vRow), total: i.breakouts.length },
    {
      name: '인기 급상승 주제(2주)',
      rows: i.rising.slice(0, 12).map((r) => ({ 주제: safeText(r.label, [], 40), 영상: r.videos14, 채널: r.channels14, 오름세: r.growing ? '오름' : '', 터진영상: r.breakouts, 우리분야: r.fit ? '맞음' : '참고만', 예: r.recent.slice(0, 3).map((v) => safeText(v.title, [], 70)) })),
    },
    { name: '많이 쓴 제목 틀(잘된 영상 기준)', rows: (i.plan?.hot ?? []).slice(0, 8).map((h) => ({ 틀: h.label, 잘된영상중: `${h.hot}/${h.hotOf}`, 잘된몫: `${h.hotShare}%`, 전체몫: `${h.baseShare}%` })) },
  ]
  if (i.view === 'top' || i.view === 'analysis') {
    const top = [...i.videos].filter((v) => !v.mine).sort((a, b) => b.views - a.views).slice(0, 20)
    sections.push({ name: '이번 달 조회 많은 영상', rows: top.map(vRow) })
  }
  const facts = [...profileLines()]
  if (stats) {
    const longMin = stats.longMedian ? ` · 롱폼 조회 중간값 ${stats.longMedian.toLocaleString('ko-KR')}` : ''
    facts.push(`내 채널 최근 ${stats.count}편: 롱폼 ${stats.longCount} · 쇼츠 ${stats.shortCount}${longMin}${stats.cadenceDays ? ` · 평균 ${stats.cadenceDays}일마다 한 편` : ''}${stats.bestTopic ? ` · 가장 잘 된 주제 '${stats.bestTopic.label}'` : ''}${stats.bestPattern ? ` · 가장 잘 된 제목 틀 '${stats.bestPattern.label}'` : ''}`)
  } else {
    facts.push('내 채널 영상 자료가 아직 없다 — 채널 설계 기준(형식 · 말투)만으로 맞춘다.')
  }
  return { links: book.links, ids: book.ids, context: { title: '마케팅 · 브랜딩 · 콘텐츠 레이더', today: todayLabel(i.today), purpose: '내 채널(채널 설계 기준)에 맞게, 지금 잘되는 주제로 이번 주 찍을 영상을 정하고 대본까지 이어 간다', sections, facts } }
}

/**
 * D-251 이번 주 키워드 하나 → 콘텐츠 묶음을 AI 로(대표만 · 갈래 셋을 같은 자료로).
 * 순서: ① 고른 키워드(관점 · 제목 · 첫 문장 · 근거) ② 채널 설계 기준 ③ 규칙 초안(구성만 — 다듬을 뼈대) + [규칙집] = 참고한 외부 방법 규칙집(미래AI랩 채널용).
 */
export function packBundle(i: { today: string; pack: ContentPack; brief?: ChannelBrief | null }): AssistBundle {
  const p = i.pack
  const s = p.source
  const brief = i.brief ?? defaultBrief()
  const outline = p.sections
    .filter((x) => x.id !== 'checks')
    .map((x) => ({ 칸: x.label, 구성: x.blocks.map((b) => safeText(b.label, [], 80)), 예시: safeText(x.blocks[1]?.text ?? x.blocks[0]?.text ?? '', [], 400) }))
  return {
    links: {},
    context: {
      title: `마케팅 · 콘텐츠 묶음 · ${p.topic}`,
      today: todayLabel(i.today),
      purpose: isMarketingCustomer() ? '이번 주 키워드 하나로 유튜브 대본 · 릴스 대본 · 블로그 글 · 올릴 때 글을 검증된 방법대로 한 번에' : '이번 주 키워드 하나로 유튜브 대본 · 릴스 대본 · 블로그 글 · 카드뉴스 · 올릴 때 글을 검증된 방법대로 한 번에',
      sections: [
        {
          name: '고른 키워드(이 주제 하나로)',
          rows: [
            {
              주제: safeText(s.topic, [], 80),
              왜지금: safeText(s.why, [], 240),
              [isMarketingCustomer() ? '관점' : '미래AI랩관점']: safeText(s.view, [], 300),
              제목후보_규칙: s.titles.slice(0, 5).map((t) => safeText(t, [], 80)),
              썸네일_규칙: s.thumbs.slice(0, 3).map((t) => safeText(t, [], 60)),
              첫문장_규칙: safeText(s.hook, [], 160),
              근거_우리만: s.facts.slice(0, 3).map((f) => safeText(f, [], 120)),
              참고영상_제목은베끼지않기: s.refs.slice(0, 3).map((t) => safeText(t, [], 80)),
              직접고른주제: s.custom ? '예' : '',
            },
          ],
        },
        briefSection(brief),
        { name: `규칙 초안 뼈대(${PACK_SECTIONS.length - 1}칸 — 이 순서 · 칸 이름을 살려 다듬기)`, rows: outline },
      ],
      facts: [...profileLines()],
      rules: [...packRules()],
    },
  }
}

/* ------------------------------------------------------------------ */
/* 블로그 · 플레이스 홍보 글 — 규칙집(참고한 외부 방법 방식) 그대로                   */
/* ------------------------------------------------------------------ */

export function contentBundle(i: { today: string; profile: ContentProfile; source: ProfileSource; keyword: string; mirae: boolean; items: readonly { title: string; kind: string; createdAt: string }[] }): AssistBundle {
  const p = i.profile
  const blogReq = aiRequestText(p, { kind: 'blog', keyword: i.keyword })
  const placeReq = aiRequestText(p, { kind: 'place' })
  const placeOnly = placeReq.split('\n').filter((l) => /^(채널|길이|지역)/.test(l.trim()))
  const rules = [
    '— 블로그 글일 때(아래 요청문 그대로) —',
    ...blogReq.split('\n').filter((l) => l.trim()),
    '— 플레이스 소개글일 때(위 업체 · 사실 · 넣지 말 것은 같고, 아래만 바꿈) —',
    ...placeOnly,
    '— 제목 각도 17개(서로 다른 검색 의도) —',
    ...ANGLES.map((a) => `${a.no}. ${a.label} (${a.intent}) — ${a.rule}`),
    `— 쓰지 말 말 — ${RISKY_WORDS.map((w) => `${w.word}(${w.why})`).join(' · ')}`,
  ]
  return {
    links: {},
    context: {
      title: `블로그 · 플레이스 홍보 글 · ${p.company}`,
      today: todayLabel(i.today),
      purpose: '업체 홍보 정보(사실)만으로 네이버 블로그 · 플레이스에 올릴 글을 규칙집대로',
      sections: [
        { name: '홍보 브리프 7칸', rows: briefSlots(p, i.source).map((b) => ({ 칸: b.label, 내용: safeText(b.note, [], 200), 채움: b.ok ? '채움' : '비어 있음' })) },
        { name: '사실 목록(이것만 사실로)', rows: aiRequestFacts(p).map((f) => ({ 사실: safeText(f, [], 300) })) },
        { name: '보관함에 이미 있는 글(같은 제목 피하기)', rows: i.items.slice(0, 15).map((x) => ({ 제목: safeText(x.title, [], 80), 종류: x.kind, 만든날: x.createdAt.slice(0, 10) })) },
      ],
      facts: [`주 키워드: ${i.keyword || '(없음)'}`, ...(i.mirae ? profileLines() : [])],
      rules,
    },
  }
}
