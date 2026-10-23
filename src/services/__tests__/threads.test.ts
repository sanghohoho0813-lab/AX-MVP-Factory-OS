/**
 * D-273 스레드 · 릴스 · 틱톡 · 마케팅 공식 내재화 — 틀 23가지 · 숏폼 형식 5 · 규칙 검사(규칙 계산) · 기록표 점수 · AI 에 보내는 자료 · 서버 단추 · 공식 묶음.
 */
import { ASSISTS, PACKS, PRINCIPLE_RULES, RADAR_RULES, SHORTS_RULES, THREADS_RULES, assistSystem, buildAssistPrompt, knowledgeOf } from '../../../api/_ai/assists.js'
import { CONDITION_NOTE, KIM_FACTS, REWRITES, VENTURE_CARDS, VENTURE_PROMISE, numberLint, principleLint, unknownNumbers } from '../marketing/snsRules'
import {
  AIMS,
  PLATFORMS,
  aimsOf,
  exampleOf,
  SHORT_FORMATS,
  firstWordsOf,
  formatRecords,
  formatsFor,
  keepRate,
  lintShort,
  normalizeShortPost,
  parseShortDrafts,
  secondsOf,
  shortScore,
  shortsContext,
  shortsCsv,
  spokenOf,
  weekMix,
  type ShortPost,
} from '../marketing/shorts'
import { MK_KNOWLEDGE, MK_KNOWLEDGE_META } from '../../../api/_ai/mkKnowledge.js'
import { hasMaterial, readWeekTopics, recommendShort, recommendThread, rememberWeekTopics, topicChips, topicTag, WEEK_TOPICS_MAX } from '../marketing/quickStart'
import { ASSIST_PRESETS } from '../aiAssist/presets'
import {
  ENDINGS,
  GOALS,
  NOT_THIS,
  THREAD_MAX,
  THREAD_TEMPLATES,
  ROUTINE,
  WEEK_REF_MAX,
  mondayOf,
  normalizeWeekRef,
  TOPIC_TAGS,
  WEEK_PLAN,
  endingOf,
  lintThreadPost,
  normalizeThreadPost,
  parseThreadDrafts,
  postsThisWeek,
  recordsCsv,
  skeletonDraft,
  sortThreadPosts,
  templateOf,
  templateRecords,
  threadScore,
  threadsContext,
  todayPlan,
  type ThreadPost,
} from '../marketing/threads'

let passed = 0
let failed = 0
const check = (name: string, cond: boolean, detail?: unknown) => {
  if (cond) {
    passed++
    console.log('PASS ', name)
  } else {
    failed++
    console.log('FAIL ', name, detail === undefined ? '' : JSON.stringify(detail).slice(0, 700))
  }
}

const post = (p: Partial<ThreadPost>): ThreadPost => ({
  id: p.id ?? 'thr_x',
  savedAt: p.savedAt ?? '2026-10-20T09:00:00.000Z',
  template: p.template ?? 'B',
  goal: p.goal ?? 'share',
  topic: p.topic ?? '',
  tag: p.tag ?? '벤처기업확인',
  body: p.body ?? '창업 3년 안 된 대표님,\n세금 더 내고 계실 수 있어요.',
  selfComment: p.selfComment ?? '',
  checks: p.checks ?? [],
  status: p.status ?? 'posted',
  postedOn: p.postedOn ?? '2026-10-20',
  stats: p.stats ?? { views: null, likes: null, replies: null, reposts: null, shares: null, inquiries: null },
  source: p.source ?? 'hand',
})

/* ---------------- T 틀 ---------------- */
const keys = THREAD_TEMPLATES.map((t) => t.key).join('')
check('T1 틀 24개(A~W 23 + X) · 순서대로 · 쓰지 않는 Z 는 따로', keys === 'ABCDEFGHIJKLMNOPQRSTUVWX' && NOT_THIS.key === 'Z')
check('T2 틀마다 이름 · 뼈대 2줄 이상 · 왜 · 우리 버전 · 목표 하나 이상', THREAD_TEMPLATES.every((t) => t.name && t.skeleton.length >= 2 && t.why && t.ours && t.goals.length > 0))
check('T3 반응별 추천 틀이 모두 있는 틀 · 답글은 P 가 맨 앞(점수 중앙값 1,903)', GOALS.every((g) => g.picks.every((k) => !!templateOf(k))) && GOALS.find((g) => g.key === 'reply')?.picks[0] === 'P')
check('T4 요일 계획 월~금 · 금요일 답글 · 리드(P · A · G) · 주말은 없음', [1, 2, 3, 4, 5].every((d) => WEEK_PLAN[d]) && WEEK_PLAN[5].picks.join() === 'P,A,G' && todayPlan('2026-10-25') === null && todayPlan('2026-10-23')?.day === '금')
check('T5 주제 태그 5개(정책자금 · 벤처기업확인 · 정부지원사업 · AX · 경영컨설팅)', TOPIC_TAGS.join() === '정책자금,벤처기업확인,정부지원사업,AX,경영컨설팅')
check('T6 끝 방식 8칸 · 자료 나눔이 맨 앞 · 링크는 좋지 않음', ENDINGS[0].key === 'material' && ENDINGS.find((e) => e.key === 'link')?.good === false)
check('T7 V 는 한 달에 한 번 · W 는 지어낸 선착순 금지 · H 는 공고 원문 확인', /한 달에 한 번/.test(templateOf('V')?.caution ?? '') && /선착순/.test(templateOf('W')?.caution ?? '') && /원문/.test(templateOf('H')?.caution ?? ''))

/* ---------------- E 예시가 공식을 지키는지 ---------------- */
const examples = THREAD_TEMPLATES.filter((t) => t.example)
check(`E1 우리 버전 예시 ${examples.length}개(B · I · M · P · Q · T · U · V) — 모두 태그 있음`, examples.map((t) => t.key).join('') === 'BIMPQTUV' && examples.every((t) => t.exampleTag && (TOPIC_TAGS as readonly string[]).includes(t.exampleTag)))
for (const t of examples) {
  const r = lintThreadPost({ body: t.example ?? '', template: t.key, tag: t.exampleTag })
  check(`E2 ${t.key} 예시 — 500자 안 · 고칠 것 0 (${r.chars}자 · 끝 ${r.ending})`, r.chars <= THREAD_MAX && r.bad === 0, r.lines.filter((l) => l.level !== 'ok'))
}
check('E3 예시에 링크 · 고객 실명 · 지어낸 선착순 없음', examples.every((t) => !/https?:|litt\.ly|선착순|\(주\)/.test(t.example ?? '')))

/* ---------------- L 규칙 검사 ---------------- */
const long = lintThreadPost({ body: '가'.repeat(520), tag: 'AX' })
check('L1 500자 넘으면 고칠 것 · 줄일 글자 수', long.bad >= 1 && long.lines.some((l) => l.key === 'len' && l.level === 'bad' && /20자 줄이기/.test(l.text)))
const linked = lintThreadPost({ body: '창업 3년 안 된 대표님, 이건 꼭 봐요.\n자세한 건 https://litt.ly/kimteamjang', template: 'B', tag: '정책자금' })
check('L2 본문 링크 → 고칠 것(본인 댓글로) · 끝이 링크', linked.lines.some((l) => l.key === 'link' && l.level === 'bad') && linked.ending === 'link')
const sell = lintThreadPost({ body: '정책자금 준비하는 대표님 많죠.\n상담 신청은 프로필에서.\n어떻게 생각해?', template: 'Q', tag: '정책자금' })
check('L3 본문 상담 안내 → 고칠 것 · 열린 질문 끝 → 바꾸면 더 퍼짐', sell.lines.some((l) => l.key === 'sell' && l.level === 'bad') && sell.ending === 'open' && sell.lines.some((l) => l.key === 'ending' && l.level === 'warn'))
const vSell = lintThreadPost({ body: templateOf('V')?.example ?? '', template: 'V', tag: 'AX' })
check('L4 V(대놓고 영업)는 판매 문구 검사에서 뺀다', !vSell.lines.some((l) => l.key === 'sell'))
const hype = lintThreadPost({ body: '정책자금 100% 받는 법 알려 줄게.\n선착순 3명만.', tag: '정책자금' })
check('L5 보장 · 과장 · 선착순 → 고칠 것', hype.lines.some((l) => l.key === 'hype' && l.level === 'bad'))
const venture = lintThreadPost({ body: '벤처기업확인 받으면 세금 5년 50% 감면이야.\n창업 몇 년 차예요? 1년 / 2년 / 3년', template: 'B', tag: '벤처기업확인' })
check('L6 벤처 혜택 글에 확인기관 괄호가 없으면 알림 · 고르기 쉬운 끝은 통과', venture.lines.some((l) => l.key === 'venture' && l.level === 'warn') && venture.ending === 'choice')
const ax = lintThreadPost({ body: 'AX 화면 하나 만들면 정책자금 받을 수 있어요.\n쓸 사람?', template: 'A', tag: 'AX' })
check('L7 AX 를 자금 받는 수단으로 → 고칠 것 · 쓸 사람? 끝', ax.lines.some((l) => l.key === 'ax-money' && l.level === 'bad') && ax.ending === 'want')
const br = lintThreadPost({ body: '솔직히 말하면, 나도 처음엔 [ ]였어.\n[실제로 들은 말]\n다음 글에서 이어서 풀게.', template: 'K', tag: 'AX' })
check('L8 [대괄호] 남은 칸 수 · 후속편 끝', br.lines.some((l) => l.key === 'brackets' && /2칸/.test(l.text)) && br.ending === 'series')
const emoji = lintThreadPost({ body: '창업 3년 안 된 대표님 🔥 세금 더 내요\n✅ 이건 줄 맨 앞이라 괜찮아', tag: 'AX' })
check('L9 문장 중간 이모지만 알림(줄 맨 앞 표시는 괜찮음)', emoji.lines.some((l) => l.key === 'emoji'))
const emoji2 = lintThreadPost({ body: '✅ 줄 맨 앞 표시만 쓴 글이에요 대표님\n→ 이것도 괜찮아', tag: 'AX' })
check('L9b 줄 맨 앞 표시만 쓰면 알림 없음', !emoji2.lines.some((l) => l.key === 'emoji'))
const noTag = lintThreadPost({ body: '창업 3년 안 된 대표님,\n이건 저장해 둬.' })
check('L10 주제 태그 없으면 알림', noTag.lines.some((l) => l.key === 'tag' && l.level === 'warn'))
const firstQ = lintThreadPost({ body: '정책자금 어떻게 준비하세요?\n1. 신용\n2. 재무', tag: '정책자금' })
check('L11 첫 줄 질문 → 끝 줄로', firstQ.lines.some((l) => l.key === 'first-q'))
const recent = [post({ id: 'a', template: 'V', postedOn: '2026-10-03' })]
const vAgain = lintThreadPost({ body: templateOf('V')?.example ?? '', template: 'V', tag: 'AX', recent, today: '2026-10-23' })
check('L12 V 를 같은 달에 또 쓰면 고칠 것(날짜까지)', vAgain.lines.some((l) => l.key === 'v-month' && l.level === 'bad' && /10\/03/.test(l.text)))
const vNext = lintThreadPost({ body: templateOf('V')?.example ?? '', template: 'V', tag: 'AX', recent, today: '2026-11-02' })
check('L12b 다음 달이면 통과', !vNext.lines.some((l) => l.key === 'v-month'))
const rep = [post({ id: 'a', template: 'E', postedOn: '2026-10-22' }), post({ id: 'b', template: 'E', postedOn: '2026-10-21' })]
check('L13 최근 두 글과 같은 틀 → 반복 알림 · 다른 틀이면 없음', lintThreadPost({ body: '대부분은 여기서 멈춰.\n1. 하나\n2. 둘', template: 'E', tag: 'AX', recent: rep }).lines.some((l) => l.key === 'repeat') && !lintThreadPost({ body: '대부분은 여기서 멈춰.', template: 'B', tag: 'AX', recent: rep }).lines.some((l) => l.key === 'repeat'))
check('L14 자료 나눔 끝(고지 괄호 줄은 건너뜀)', endingOf('필요한 대표님은 댓글에 "점검표" 남겨 줘.\nDM으로 보내 줄게.\n\n(결과는 확인기관이 정하고, 회사마다 달라)') === 'material')
check('L15 다른 컨설턴트 깎아내리기 → 고칠 것', lintThreadPost({ body: '다른 컨설턴트들 다 사기야.\n조심해.', tag: 'AX' }).lines.some((l) => l.key === 'knock' && l.level === 'bad'))
check('L16 빈 글은 글자 수만 알림(오류 없음)', lintThreadPost({ body: '' }).bad === 0)

/* ---------------- S 점수 · 기록표 ---------------- */
check('S1 점수 = 좋아요 + 답글×3 + 리포스트×2 + 공유×3 · 숫자 없으면 null', threadScore({ views: 2400, likes: 9, replies: 4, reposts: 1, shares: 7, inquiries: 0 }) === 9 + 12 + 2 + 21 && threadScore({ views: 100, likes: null, replies: null, reposts: null, shares: null, inquiries: null }) === null)
const posts = [
  post({ id: '1', template: 'B', postedOn: '2026-10-20', stats: { views: 2400, likes: 9, replies: 4, reposts: 1, shares: 7, inquiries: 1 } }),
  post({ id: '2', template: 'B', postedOn: '2026-10-21', stats: { views: 600, likes: 3, replies: 0, reposts: 0, shares: 1, inquiries: 0 } }),
  post({ id: '3', template: 'C', postedOn: '2026-10-22', stats: { views: 1200, likes: 9, replies: 2, reposts: 1, shares: 5, inquiries: 0 } }),
  post({ id: '4', template: 'P', status: 'draft', postedOn: '' }),
  post({ id: '5', template: 'G', postedOn: '2026-10-12' }),
]
const rec = templateRecords(posts)
check('S2 틀별 평균 — 올린 글만 · 점수 높은 순 · 점수 없는 틀은 뒤', rec.map((r) => r.key).join() === 'C,B,G' && rec.find((r) => r.key === 'B')?.avgScore === Math.round((44 + 6) / 2) && rec.find((r) => r.key === 'B')?.inquiries === 1 && rec.find((r) => r.key === 'G')?.avgScore === null, rec)
check('S3 이번 주(월~일) 올린 글 — 10/23(금) 기준 10/20~ · 쓰다 둔 글 · 지난주 빼고', postsThisWeek(posts, '2026-10-23').map((p) => p.id).join() === '1,2,3')
const csv = recordsCsv(posts)
check('S4 CSV — 기록표 칸 그대로 · 올린 글만 · 점수 칸', csv.split('\n')[0] === '날짜,틀,첫 줄,조회,좋아요,답글,리포스트,공유,문의,점수,주제 태그' && csv.split('\n').length === 5 && csv.includes(',44,'))
check('S5 정렬 — 올린 글(최근 순) → 쓰다 둔 글', sortThreadPosts(posts).map((p) => p.id).join() === '3,2,1,5,4')

/* ---------------- N 저장 모양 ---------------- */
const n = normalizeThreadPost({ body: '글', template: 'Z', goal: 'x', status: 'posted', postedOn: '2026/10/20', stats: { likes: -3, replies: 2.6, views: 'a' }, checks: ['a', 3], source: 'ai' }, 'id1')
check('N1 저장 모양 거르기 — 없는 틀 · 목표는 빈칸 · 음수 · 글자 숫자는 null · 날짜 모양 · 확인할 것은 글자만', !!n && n.template === '' && n.goal === '' && n.stats.likes === null && n.stats.replies === 3 && n.stats.views === null && n.postedOn === '' && n.checks.join() === 'a' && n.source === 'ai')
check('N2 빈 글은 저장 모양이 아님', normalizeThreadPost({ body: '   ' }, 'x') === null && normalizeThreadPost(null, 'x') === null)

/* ---------------- D 초안 · AI 답 ---------------- */
const sk = skeletonDraft(templateOf('P')!, '벤처 점검표')
check('D1 틀대로 빈 글 — 뼈대 줄이 [대괄호] 칸 · 첫 칸에 소재', sk.split('\n\n').length === 4 && sk.startsWith('[막막한 사람 부르기] ← 벤처 점검표') && lintThreadPost({ body: sk }).lines.some((l) => l.key === 'brackets'))
const parsed = parseThreadDrafts({
  headline: '벤처 세금',
  items: [
    { title: '창업 3년 안 된 대표님,', tag: 'B 손해+숫자', body: '창업 3년 안 된 대표님,\n세금 더 내고 계실 수 있어요.', when: '선택형', detail: '3분 진단은 프로필에', outline: ['[숫자 확인]'] },
    { title: '빈 글', tag: 'Q', body: '' },
    { title: '두 번째', tag: 'p', body: '벤처기업확인 준비가 막막한 대표님.' },
    { title: '세 번째', tag: '?', body: '셋' },
    { title: '네 번째', tag: 'A', body: '넷' },
  ],
  next: ['주제 태그: 벤처기업확인', '오전에 올리기'],
})
check('D2 AI 답 → 글 3개(빈 글 버림) · 틀 글자 · 본인 댓글 · 확인할 것 · 태그', parsed.drafts.length === 3 && parsed.drafts[0].template === 'B' && parsed.drafts[1].template === 'P' && parsed.drafts[2].template === '' && parsed.drafts[0].selfComment === '3분 진단은 프로필에' && parsed.drafts[0].checks[0] === '[숫자 확인]' && parsed.tag === '벤처기업확인', parsed)
check('D3 답이 없으면 빈 목록', parseThreadDrafts(null).drafts.length === 0)
const ctx = threadsContext({ goal: 'reply', template: 'P', topic: '벤처 점검표', tag: '벤처기업확인', facts: '점검표 4칸 · 카드 6장\n\n', reference: '남의 글 첫 줄\n남의 글 둘째 줄', recent: posts, today: '2026-10-23' })
const ctxText = JSON.stringify(ctx)
check('D4 보낼 자료 — 목표 · 고른 틀 뼈대 · 소재 · 태그 · 요일 계획 · 참고 글(줄마다) · 최근 올린 글 · 더 쓸 사실', ctx.sections[0].name === '쓸 글' && /P 자료 나눔 조건 — 뼈대: 막막한 사람 부르기/.test(ctxText) && /금요일 답글 · 리드/.test(ctxText) && ctx.sections.some((s) => s.name.startsWith('참고 글') && s.rows.length === 2) && ctx.sections.some((s) => s.name === '최근 올린 글' && s.rows.length === 4) && (ctx.facts ?? []).length === 1, ctx)
const noRef = threadsContext({ goal: '', template: '', topic: '', tag: '', facts: '', reference: '', recent: [], today: '2026-10-25' })
check('D5 아무것도 안 골라도 자료가 만들어짐 · 참고 글 칸 없음 · 주말', !noRef.sections.some((s) => s.name.startsWith('참고 글')) && /주말/.test(JSON.stringify(noRef)) && !noRef.facts)

/* ---------------- A 서버 단추 · 공식 묶음 ---------------- */
const tw = ASSISTS['threads.write']
check('A1 서버 threads.write — 스레드 화면 · 쓰기 · 화면 단추 이름 같음', tw?.page === 'threads' && tw?.kind === 'write' && ASSIST_PRESETS.some((p) => p.id === 'threads.write' && p.page === 'threads' && p.label === tw.label && p.kind === 'write'))
check('A2 threads.write 에 대표 운영 원칙 + 스레드 공식 + 사실 목록이 실림', knowledgeOf(tw).map((k: { key: string }) => k.key).join() === 'mk_principles,mk_threads,mk_facts')
const sys = assistSystem(tw)
check('A3 스레드 규칙 5줄이 지시문에 · 마케팅(유튜브) 규칙은 안 붙음', THREADS_RULES.length === 5 && THREADS_RULES.every((r: string) => sys.includes(r)) && !sys.includes('[마케팅 규칙]') && sys.includes('[스레드 규칙]'))
check('A4 스레드 지시 — 500자 · 본인 댓글 · 틀 글자 · 참고 글은 뼈대만', /500자/.test(sys) && /본인 댓글/.test(sys) && /틀 글자 하나\(A~X\)/.test(sys) && /뼈대.*만 빌리고/.test(sys))
const built = buildAssistPrompt(tw, ctx, '')
check('A5 보낼 글에 참고 글 줄 · 고른 틀 · 최근 올린 글', /참고 글/.test(built.user) && /고른틀: P 자료 나눔 조건/.test(built.user) && /최근 올린 글 4건/.test(built.user), built.user.slice(0, 600))
const meta = MK_KNOWLEDGE_META as Record<string, { chars: number }>
check('A6 공식 묶음 7개 — 공통 · 스레드 · 숏폼 · 롱폼 · 사실 목록 · 운영 원칙 · 판정 기준 · 모두 글자 있음', ['mk_common', 'mk_threads', 'mk_short', 'mk_long', 'mk_facts', 'mk_principles', 'mk_judge'].every((k) => typeof (MK_KNOWLEDGE as Record<string, string>)[k] === 'string' && meta[k].chars > 800 && typeof PACKS[k] === 'string' && PACKS[k].length > 800))
const allMk = Object.values(MK_KNOWLEDGE as Record<string, string>).join('\n')
check('A7 공식 묶음에 출처 이름 · 남의 계정 · 파일 경로 · 차수 표시 없음', !/자청|이상한\s*AI|쓰레드나이스|@[A-Za-z]|[A-Za-z]:\\|\.md\b|\.csv\b|〔|⟲|배포자료\\/.test(allMk), (/자청|이상한\s*AI|쓰레드나이스|@[A-Za-z]|[A-Za-z]:\\|\.md\b|\.csv\b|〔|⟲|배포자료\\/.exec(allMk) ?? [''])[0])
const kbOf = (id: string) => knowledgeOf(ASSISTS[id]).map((k: { key: string }) => k.key).join()
check('A8 마케팅 단추마다 맞는 공식 — 모두 운영 원칙 먼저 · 기획은 공통 · 대본은 롱폼 · 쇼츠는 숏폼 · 남의 영상 보기는 판정 기준 · 블로그는 사실 목록 · 받아 적기는 없음', kbOf('radar.top5') === 'mk_principles,mk_common,mk_facts' && kbOf('radar.script') === 'mk_principles,mk_common,mk_long,mk_facts' && kbOf('radar.pack.video') === 'mk_principles,mk_common,mk_long,mk_facts' && kbOf('radar.adapt') === 'mk_principles,mk_judge,mk_common,mk_long,mk_facts' && kbOf('bench.why') === 'mk_principles,mk_judge,mk_common,mk_facts' && kbOf('rising.ref') === 'mk_principles,mk_judge,mk_common,mk_facts' && kbOf('radar.pack.short') === 'mk_principles,mk_common,mk_short,mk_facts' && kbOf('rising.shorts') === 'mk_principles,mk_common,mk_short,mk_facts' && kbOf('radar.pack.blog') === 'mk_principles,mk_facts' && kbOf('radar.transcript') === '' && kbOf('content.blog') === '')
check('A9 마케팅 규칙에 실측 공통 법칙 3줄 더(넓은 주제 · 팔지 않기 · 첫 줄 숫자 · 증거)', RADAR_RULES.length === 8 && /넓은 주제/.test(RADAR_RULES[5]) && /팔고 시작하지 않는다/.test(RADAR_RULES[6]) && /증거/.test(RADAR_RULES[7]))
const scriptI = ASSISTS['radar.script'].instruction.join(' ')
check('A10 대본 지시 — 0~15초 증거 장면 · 번호형 챕터 · 마무리 V1.8(임팩트 한 줄 · CTA 한 문장 · 김팀장이었습니다 · 숙제 없이) · 썸네일 큰 글자 10자 · 60초 한도 그대로', /0~15초 증거 장면/.test(scriptI) && /번호형 챕터/.test(scriptI) && /임팩트 한 줄/.test(scriptI) && /CTA 한 문장/.test(scriptI) && /김팀장이었습니다/.test(scriptI) && /숙제/.test(scriptI) && /큰 글자 10자/.test(scriptI) && /2,500~3,500자/.test(scriptI) && /60초/.test(scriptI))
const shortI = ASSISTS['radar.pack.short'].instruction.join(' ')
check('A11 릴스 지시 — 첫마디 10자 · 2초 · 캡션 200자 · 해시태그 0~3 · 저장 유도 · 프로필 링크 없이', /첫마디 10자/.test(shortI) && /2초/.test(shortI) && /200자/.test(shortI) && /0~3개/.test(shortI) && /저장 유도 · 프로필 링크 · 상담 안내 없이/.test(shortI) && !/해시태그 5개/.test(shortI))
const all = Object.values(ASSISTS).map((a) => assistSystem(a)).join('\n')
check('A12 모든 지시문에 쓰지 않는 이름 없음(마케팅 공식이 들어가도)', !/이상한\s*(?:AI|마케팅)|자청|악마|Devil|AX\s*펭귄|Judge\s*Scorecard/i.test(all))

/* ---------------- SH 릴스 · 틱톡 ---------------- */
check('SH1 플랫폼 2(틱톡 · 쇼츠 / 릴스) · 목적 2씩 · 형식 5', PLATFORMS.length === 2 && AIMS.tiktok.length === 2 && AIMS.reels.length === 2 && SHORT_FORMATS.map((f) => f.key).join() === 'list,talk,demo,comment,ban')
check('SH2 고른 것에 맞는 형식만 — 틱톡 많이 보이게 = 리스트 · 대화 · 시연 · 금지 / 릴스 댓글 받기 = 댓글형 / 릴스 많이 보이게 = 시연(25초판) · 금지', formatsFor('tiktok', 'reach').map((f) => f.key).join() === 'list,talk,demo,ban' && formatsFor('reels', 'convert').map((f) => f.key).join() === 'comment' && formatsFor('reels', 'reach').map((f) => f.key).join() === 'demo,ban')
for (const f of SHORT_FORMATS) {
  for (const platform of f.platforms) {
    const aim = aimsOf(f, platform)[0]
    const ex = exampleOf(f, platform)
    const r = lintShort({ platform, aim, script: ex.script, caption: ex.caption, hashtags: f.exampleTags })
    check(`SH3 ${f.name}(${platform}) 예시 — 고칠 것 0 (약 ${r.seconds}초 · 첫마디 ${r.firstWords.replace(/\s/g, '').length}자)`, r.bad === 0, r.lines.filter((l) => l.level !== 'ok'))
  }
}
check('SH4 말만 뽑기 — 시간 · (화면: …) · 화자 · 화면 번호를 뺀다', spokenOf('[0:00] 창업 3년 안이면,  (화면 큰 글자: 창업 3년 안)') === '창업 3년 안이면,' && spokenOf('대표: AX 하면 정책자금 나와요?') === 'AX 하면 정책자금 나와요?' && spokenOf('화면 1 (0~3초) 창업 3년 지나면') === '창업 3년 지나면')
check('SH5 길이 — 시간 표시 · 화면 (a~b초) · 말 글자 ÷ 6', secondsOf(SHORT_FORMATS[0].example) >= 32 && secondsOf(SHORT_FORMATS[0].example) <= 40 && secondsOf(SHORT_FORMATS[3].example) === 12 && secondsOf('가'.repeat(60)) === 10)
const greet = lintShort({ platform: 'tiktok', aim: 'reach', script: '안녕하세요 김팀장입니다.\n오늘은 정책자금 얘기', caption: '', hashtags: '' })
check('SH6 인사로 시작 → 고칠 것 · 캡션 없음 알림 · 5초 안 숫자 없음 알림', greet.lines.some((l) => l.key === 'greet' && l.level === 'bad') && greet.lines.some((l) => l.key === 'caption' && l.level === 'warn') && greet.lines.some((l) => l.key === 'num5' && l.level === 'warn'))
const ctaReach = lintShort({ platform: 'reels', aim: 'reach', script: '[0:00] 창업 3년 안이면\n[0:05] 상담은 프로필 링크에서', caption: '짧게', hashtags: '' })
check('SH7 많이 보이게 + 상담 · 링크 안내 → 고칠 것', ctaReach.lines.some((l) => l.key === 'cta' && l.level === 'bad'))
const noKey = lintShort({ platform: 'reels', aim: 'convert', script: '화면 1 (0~3초) 창업 3년 지나면 못 받는 혜택\n화면 2 (3~8초) DM 주시면 보내 드려요', caption: '정리본 드려요', hashtags: '' })
check('SH8 댓글 받기 — 키워드 댓글 없으면 알림 · DM 안내는 고칠 것', noKey.lines.some((l) => l.key === 'keyword') && noKey.lines.some((l) => l.key === 'cta' && l.level === 'bad'))
const longReel = lintShort({ platform: 'reels', aim: 'reach', script: '[0:00] 3가지만\n[0:45] 끝', caption: '짧게', hashtags: '#a #b #c #d #e' })
check('SH9 릴스 45초 · 해시태그 5개 → 알림(20~25초 · 0~3개)', longReel.lines.some((l) => l.key === 'length' && l.level === 'warn') && longReel.lines.some((l) => l.key === 'tags' && l.level === 'warn'))
const tt = lintShort({ platform: 'tiktok', aim: 'reach', script: SHORT_FORMATS[0].example, caption: '창업 3년 안 대표님만 꼭 보세요 · 9년 경력 전문가가 하나하나 알려 드림 · 상담은 DM 으로', hashtags: '' })
check('SH10 틱톡 캡션 — 한 줄 넘음 · 경력 자랑 · DM → 알림 · 고칠 것 · 해시태그 0 알림', tt.lines.some((l) => l.key === 'caption' && l.level === 'warn') && tt.lines.some((l) => l.key === 'brag') && tt.lines.some((l) => l.key === 'caption-sell' && l.level === 'bad') && tt.lines.some((l) => l.key === 'tags' && l.level === 'warn'))
const jar = lintShort({ platform: 'tiktok', aim: 'reach', script: '연구소 보유 법인 대표님,\n보증료율 낮추는 3가지', caption: 'x', hashtags: '#a #b #c' })
check('SH11 좁은 대상 · 업계 용어 → 알림', jar.lines.some((l) => l.key === 'narrow') && jar.lines.some((l) => l.key === 'jargon'))
const spokenSave = lintShort({ platform: 'reels', aim: 'reach', script: '[0:00] 3가지만 보세요\n[0:10] 저장해 두세요', caption: 'x', hashtags: '' })
check('SH12 말로 저장 유도 → 알림(승 1%)', spokenSave.lines.some((l) => l.key === 'save' && l.level === 'warn'))
check('SH13 대화형 "AX 하면 정책자금 나와요? → 그건 따로예요" 는 자금 수단 검사에 안 걸림', !lintShort({ platform: 'tiktok', aim: 'reach', script: SHORT_FORMATS[1].example, caption: SHORT_FORMATS[1].exampleCaption, hashtags: '#a #b #c' }).lines.some((l) => l.key === 'ax-money'))
const sp = (q: Partial<ShortPost>): ShortPost => ({ id: q.id ?? 's', savedAt: '2026-10-20T00:00:00.000Z', platform: q.platform ?? 'tiktok', aim: q.aim ?? 'reach', format: q.format ?? 'list', topic: '', script: q.script ?? '[0:00] 창업 3년 안이면,', caption: '', hashtags: '', checks: [], status: q.status ?? 'posted', postedOn: q.postedOn ?? '2026-10-21', stats: q.stats ?? { views: null, likes: null, comments: null, saves: null, shares: null, inquiries: null }, source: 'hand' })
check('SH14 점수 = 좋아요 + 댓글×3 · 저장 · 공유율(%)', shortScore({ views: 1000, likes: 20, comments: 5, saves: 3, shares: 2, inquiries: 0 }) === 35 && keepRate({ views: 1000, likes: 20, comments: 5, saves: 3, shares: 2, inquiries: 0 }) === 0.5 && shortScore({ views: 10, likes: null, comments: null, saves: 1, shares: 0, inquiries: 0 }) === null)
const sposts = [sp({ id: '1', stats: { views: 1000, likes: 20, comments: 5, saves: 3, shares: 2, inquiries: 1 } }), sp({ id: '2', platform: 'reels', aim: 'convert', format: 'comment', postedOn: '2026-10-22', stats: { views: 500, likes: 10, comments: 30, saves: 0, shares: 0, inquiries: 2 } }), sp({ id: '3', status: 'draft', postedOn: '' }), sp({ id: '4', postedOn: '2026-10-10' })]
const frs = formatRecords(sposts)
check('SH15 형식별 평균 — 플랫폼 · 형식마다 · 점수 높은 순', frs[0].key === 'reels:comment' && frs[0].avgScore === 100 && frs[1].key === 'tiktok:list' && frs[1].posts === 2 && frs[1].avgScore === 35, frs)
const wm = weekMix(sposts, '2026-10-23')
check('SH16 이번 주 섞임 — 틱톡 많이 보이게 1 · 릴스 댓글 1(지난주 · 만들다 둔 것 빼고)', wm.tiktok.reach === 1 && wm.tiktok.convert === 0 && wm.reels.convert === 1 && wm.reels.reach === 0)
check('SH17 CSV — 올린 영상만 · 점수 · 저장 · 공유율', shortsCsv(sposts).split('\n').length === 4 && shortsCsv(sposts).includes(',35,0.5'))
const ns = normalizeShortPost({ script: 'x', platform: 'youtube', aim: 'z', format: 'zz', stats: { likes: -1, comments: 2 } }, 'n')
check('SH18 저장 모양 거르기 — 모르는 플랫폼은 틱톡 · 없는 목적 · 형식은 빈칸 · 음수는 null', !!ns && ns.platform === 'tiktok' && ns.aim === '' && ns.format === '' && ns.stats.likes === null && ns.stats.comments === 2 && normalizeShortPost({ script: ' ' }, 'x') === null)
const spd = parseShortDrafts({ headline: 'h', items: [{ title: '창업 3년 안이면,', tag: '리스트형', when: '약 35초', body: '[0:00] 창업 3년 안이면,', detail: '캡션 한 줄', outline: ['#벤처기업확인', '#창업', '세금'] }, { title: 'x', tag: '화면 시연형', body: '' }, { title: 'y', tag: '댓글형 글자 영상', body: '화면 1 (0~3초) y' }], next: ['[숫자 확인]'] })
check('SH19 AI 답 → 대본 2개(빈 것 버림) · 형식 이름 → 키 · 해시태그만 · 확인할 것', spd.drafts.length === 2 && spd.drafts[0].format === 'list' && spd.drafts[1].format === 'comment' && spd.drafts[0].hashtags === '#벤처기업확인 #창업' && spd.checks[0] === '[숫자 확인]')
const sctx = shortsContext({ platform: 'reels', aim: 'convert', format: 'comment', topic: '벤처 세금', facts: '카드 6장', recent: sposts, today: '2026-10-23' })
const sctxText = JSON.stringify(sctx)
check('SH20 보낼 자료 — 플랫폼 · 목적 · 고른 형식 · 맞는 형식 · 소재 · 최근 올린 영상 · 더 쓸 사실', /인스타 릴스/.test(sctxText) && /댓글 받기/.test(sctxText) && /고른형식":"댓글형 글자 영상/.test(sctxText) && /맞는형식":"댓글형 글자 영상"/.test(sctxText) && sctx.sections[1].rows.length === 3 && (sctx.facts ?? []).length === 1)
const sw = ASSISTS['shorts.write']
check('SH21 서버 shorts.write — 숏폼 화면 · 쓰기 · 화면 단추 이름 같음 · 공통 + 숏폼 공식 + 사실 목록', sw?.page === 'shorts' && sw?.kind === 'write' && ASSIST_PRESETS.some((p) => p.id === 'shorts.write' && p.page === 'shorts' && p.label === sw.label) && knowledgeOf(sw).map((k: { key: string }) => k.key).join() === 'mk_principles,mk_common,mk_short,mk_facts')
const ssys = assistSystem(sw)
check('SH22 숏폼 규칙 5줄이 지시문에 · 스레드 · 마케팅 규칙은 안 붙음 · 첫마디 10자 · 키워드 댓글', SHORTS_RULES.length === 5 && SHORTS_RULES.every((r: string) => ssys.includes(r)) && ssys.includes('[숏폼 규칙]') && !ssys.includes('[스레드 규칙]') && !ssys.includes('[마케팅 규칙]') && /첫마디 10자/.test(ssys) && /키워드 댓글/.test(ssys))
check('SH23 첫마디 뽑기 — 빈 줄 · 시간 표시 건너뜀', firstWordsOf('\n[0:00] 이거 아직 손으로 해요?  (화면: 손)') === '이거 아직 손으로 해요?')

/* ---------------- P 대표 운영 원칙 · 숫자 대조 · 나눠 줄 자료(D-274 보충본) ---------------- */
const sysOf = (id: string) => assistSystem(ASSISTS[id])
check('P1 운영 원칙 4줄이 김팀장 채널 단추(레이더 · 스레드 · 릴스 · 틱톡)에 — 채널 규칙보다 먼저', PRINCIPLE_RULES.length === 4 && ['radar.top5', 'radar.script', 'threads.write', 'shorts.write', 'bench.why'].every((id) => { const t = sysOf(id); return PRINCIPLE_RULES.every((r: string) => t.includes(r)) && t.indexOf('[대표 운영 원칙') < t.indexOf(id === 'threads.write' ? '[스레드 규칙]' : id === 'shorts.write' ? '[숏폼 규칙]' : '[마케팅 규칙]') }))
check('P2 고객 업체 글(홍보 글 만들기) · 영상 받아 적기에는 운영 원칙 · 김팀장 이야기를 붙이지 않음', !sysOf('content.blog').includes('[대표 운영 원칙') && !sysOf('content.place').includes('김팀장') && !sysOf('radar.transcript').includes('[대표 운영 원칙'))
check('P3 운영 원칙 묶음 — AX 위치 · 우선순위 · 괄호 문장 · 벤처 문장 · 사업 기준 · 롱폼 마무리 V1.8 · 작업 메모 · 외부 계정 · 파일 경로 없음', /비슷한 회사들 사이에서 눈에 띄게/.test(PACKS.mk_principles) && /기본 컨디션/.test(PACKS.mk_principles) && /재신청·이의신청을 추가 비용 없이/.test(PACKS.mk_principles) && /3분 AX Fit 진단/.test(PACKS.mk_principles) && /김팀장이었습니다/.test(PACKS.mk_principles) && !/isanghanai|마이페이지|Claude|\.md\b|이상한/.test(PACKS.mk_principles))
check('P4 판정 기준 묶음 — 주제 · 형식 · 후킹 · 표본 · 목적 · 끝 · 제목 공식 · 오프닝 · 원문 옮기지 않기 · 영어 지시문 · 경로 없음', ['주제:', '후킹', '표본:', '목적:', '제목 공식', '오프닝', '원문은 옮기지 않는다'].every((w) => PACKS.mk_judge.includes(w)) && !/[A-Za-z]:\\|localStorage|You classify/.test(PACKS.mk_judge))
const pl = (t: string) => principleLint(t).map((l) => `${l.key}:${l.level}`).join()
check('P5 원칙 검사 — "큰 가점" 고칠 것 · "꼭 성공시켜 드립니다" 고칠 것(대신 쓸 문장) · 자금+AX 에 괄호 없으면 알림 · 괄호 있으면 통과 · 바로잡는 대화는 통과', pl('AX 는 큰 가점 요소예요') === 'gajeom:bad' && principleLint('벤처확인 꼭 성공시켜 드립니다')[0]?.text.includes(VENTURE_PROMISE) && pl('정책자금 심사 전에 AX 화면 하나') === 'condition:warn' && pl(`정책자금 심사 전에 AX 화면 하나 ${CONDITION_NOTE}`) === '' && pl('AX 하면 정책자금 나와요? 그건 따로예요') === '')
check('P6 바꿔쓰기 표 — 10줄 넘게 · 가점 · 성공 약속 · 숙제 · 숫자 뜻 포함', REWRITES.length >= 10 && ['가점', '성공시켜', '숙제', '후기 N개'].every((w) => REWRITES.some((r) => r.no.includes(w))))
check('P7 숫자 대조 — 사실 목록 숫자(1,650만 원 · 5년 · 50% · 2주 · 100억 · 250건)는 통과 · 지어낸 숫자(30% · 500명 · 3배)는 알림 · 구조 숫자(3가지 · 2단계)와 연도는 안 봄', unknownNumbers('창업 3년 안 · 5년간 50% · 법인 약 1,650만 원 · 2주 · 100억+ · 250건 · 3가지 · 2단계 · 2026년', '').length === 0 && unknownNumbers('합격률 30% · 고객 500명 · 3배 빨라짐', '').join() === '30%,500명,3배')
check('P8 더 쓸 사실 · 소재에 적은 숫자는 통과(쉼표 · 띄어쓰기 달라도)', unknownNumbers('점검표 받은 대표님 12명 · 매출 3,000만 원', '점검표 받은 대표님 12명\n매출 3000만원').length === 0 && numberLint('고객 500명', '')[0]?.level === 'warn')
const kimText = (MK_KNOWLEDGE as Record<string, string>).mk_facts.replace(/[\s,]/g, '')
const kimNums = KIM_FACTS.join(' ').match(/\d[\d,]*(?:\.\d+)?\s*(?:%|억|만\s*원|원|건|년|주|분)/g) ?? []
check(`P9 화면의 사실 목록 숫자 ${kimNums.length}개가 서버 사실 목록에 그대로 있음(어긋나지 않게)`, kimNums.length >= 8 && kimNums.every((n) => kimText.includes(n.replace(/[\s,]/g, ''))), kimNums.filter((n) => !kimText.includes(n.replace(/[\s,]/g, ''))))
check('P10 규칙 검사에 원칙 · 숫자 대조가 붙음(스레드 · 릴스)', lintThreadPost({ body: 'AX 는 큰 가점 요소예요.\n합격률 30%', tag: 'AX' }).lines.some((l) => l.key === 'gajeom') && lintThreadPost({ body: 'AX 는 큰 가점 요소예요.\n합격률 30%', tag: 'AX' }).lines.some((l) => l.key === 'numbers') && lintShort({ platform: 'tiktok', aim: 'reach', script: '[0:00] 합격률 30% 비결', caption: '한 줄', hashtags: '#a #b #c' }).lines.some((l) => l.key === 'numbers') && !lintShort({ platform: 'tiktok', aim: 'reach', script: '[0:00] 합격률 30% 비결', caption: '한 줄', hashtags: '#a #b #c', facts: '합격률 30%' }).lines.some((l) => l.key === 'numbers'))
check('P11 예시 글 · 대본은 숫자 대조 · 원칙 검사에서 고칠 것 0(사실 목록 숫자만 씀)', THREAD_TEMPLATES.filter((t) => t.example).every((t) => !lintThreadPost({ body: t.example ?? '', template: t.key, tag: t.exampleTag }).lines.some((l) => l.key === 'numbers' || l.level === 'bad')) && SHORT_FORMATS.every((f) => f.platforms.every((pf) => !lintShort({ platform: pf, aim: aimsOf(f, pf)[0], ...exampleOf(f, pf), hashtags: f.exampleTags }).lines.some((l) => l.key === 'numbers' || l.level === 'bad'))))
check('P12 나눠 줄 자료 — 체크리스트 카드 6장(/sns/ 아래 PNG · 실제 파일은 qa:threads 가 받아 봄)', VENTURE_CARDS.cards.length === 6 && VENTURE_CARDS.cards.every((c, i) => c.file === `/sns/venture-check-0${i + 1}.png` && c.label))

/* ---------------- WK 이번 주 잘 터진 형식(D-275 — 매일 모으지 않고 주 단위 형식만 참고) ---------------- */
check('WK1 그 주 월요일 — 금 · 월 · 일 모두 같은 주', mondayOf('2026-10-23') === '2026-10-19' && mondayOf('2026-10-19') === '2026-10-19' && mondayOf('2026-10-25') === '2026-10-19' && mondayOf('2026-10-26') === '2026-10-26')
const wr = normalizeWeekRef({ items: [{ template: 'P', firstLine: '대상 부르기', ending: 'material', note: '가'.repeat(100) }, { template: 'Z', firstLine: 'x' }, { template: 'B', firstLine: '없는 기법', ending: 'nope' }, ...Array.from({ length: 6 }, () => ({ template: 'E' }))] }, '2026-10-19')
check('WK2 저장 모양 — 없는 틀(Z) 버림 · 모르는 첫 줄 · 끝은 빈칸 · 5줄까지 · 메모 80자', !!wr && wr.items.length === WEEK_REF_MAX && wr.items[0].template === 'P' && wr.items[0].note.length === 80 && wr.items[1].template === 'B' && wr.items[1].firstLine === '' && wr.items[1].ending === '' && wr.week === '2026-10-19')
const wctx = threadsContext({ goal: '', template: '', topic: '', tag: '', facts: '', reference: '', recent: [], today: '2026-10-23', weekRef: wr })
const wsec = wctx.sections.find((x) => x.name.startsWith('이번 주 잘 터진 형식'))
check('WK3 AI 자료 — "이번 주 잘 터진 형식(참고만 — 기본은 우리 공식)" 칸 · 틀 이름 · 첫 줄 · 끝 방식 이름 · 없으면 칸 없음', !!wsec && wsec.name === '이번 주 잘 터진 형식(참고만 — 기본은 우리 공식)' && JSON.stringify(wsec.rows[0]).includes('P 자료 나눔 조건') && JSON.stringify(wsec.rows[0]).includes('자료 나눔 조건') && !threadsContext({ goal: '', template: '', topic: '', tag: '', facts: '', reference: '', recent: [], today: '2026-10-23' }).sections.some((x) => x.name.startsWith('이번 주')))
check('WK4 할 일 — 매일 훑기(scan) 없음 · 월요일 이번 주 형식 · 금요일 기록표', !ROUTINE.some((r) => r.key === 'scan') && ROUTINE.find((r) => r.key === 'weekref')?.when === '월요일' && ROUTINE.find((r) => r.key === 'record')?.when === '금요일')
check('WK5 서버 지시 — 기본은 이 공식 · 이번 주 형식은 글 하나에만 참고', /기본은 이 공식/.test(ASSISTS['threads.write'].instruction.join(' ')) && /이번 주 잘 터진 형식\] 이 있으면 그 틀 · 첫 줄 기법 · 끝 방식을 글 하나에만 참고/.test(ASSISTS['threads.write'].instruction.join(' ')))

/* ---------------- QS 주제 하나 → 바로 쓰기(MUX-2 — 규칙 계산 추천 · 이번 주 키워드 칩) ---------------- */
const qsTags = ['벤처기업확인 세금', '정책자금 한도', '고용지원금', 'Claude 활용', 'ChatGPT 업무 활용', '가업승계 · 증여', 'MAIL 정리'].map(topicTag)
check('QS1 주제 태그 — 벤처 · 자금 · 지원금 · AI · 그 밖은 경영컨설팅 · 빈 주제는 빈칸 · 모두 정해진 태그 안', qsTags.join() === '벤처기업확인,정책자금,정부지원사업,AX,AX,경영컨설팅,경영컨설팅' && topicTag('  ') === '' && qsTags.every((t) => (TOPIC_TAGS as readonly string[]).includes(t)), qsTags)
const qsFri = recommendThread({ topic: '고용지원금', today: '2026-10-23' })
const qsFriP = recommendThread({ topic: '벤처기업확인 셀프 체크리스트', today: '2026-10-23' })
check('QS2 금요일(답글 · 리드) — 자료 없는 주제는 P 빼고 A · 벤처 점검표 주제는 P(이유에 점검표) · 태그 자동', qsFri.goal === 'reply' && qsFri.template === 'A' && qsFri.tag === '정부지원사업' && qsFriP.template === 'P' && /점검표/.test(qsFriP.why) && /금/.test(qsFriP.why) && hasMaterial('벤처 점검표') && !hasMaterial('고용지원금'), [qsFri, qsFriP])
const qsMonRef = normalizeWeekRef({ items: [{ template: 'B' }, { template: 'X' }] }, '2026-10-19')
const qsMon = recommendThread({ topic: '세금', today: '2026-10-19' })
const qsMonHot = recommendThread({ topic: '세금', today: '2026-10-19', weekRef: qsMonRef })
check('QS3 월요일(저장 · 공유 U Q E B) — 기본은 첫 틀 U · 이번 주 잘 된 틀(B)이 오늘 계획 안에 있으면 B(참고만 · 계획 밖 X 는 안 씀)', qsMon.template === 'U' && qsMonHot.template === 'B' && /이번 주 잘 된 틀/.test(qsMonHot.why) && !/이번 주/.test(qsMon.why), [qsMon, qsMonHot])
const qsSat = recommendThread({ topic: '고용지원금', today: '2026-10-24' })
check('QS4 주말 — 답글 · 리드 · 자료 없으면 A', qsSat.goal === 'reply' && qsSat.template === 'A' && /주말/.test(qsSat.why), qsSat)
const qsAllDays = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'].flatMap((d) => ['고용지원금', '벤처 점검표', ''].map((t) => recommendThread({ topic: t, today: d })))
check('QS5 어느 요일 · 주제든 틀은 23가지 안 · 고른 반응이 그 틀의 반응 · 자료 없는 주제에 P 없음', qsAllDays.every((r) => !!THREAD_TEMPLATES.find((t) => t.key === r.template)?.goals.includes(r.goal)) && qsAllDays.filter((_, i) => i % 3 !== 1).every((r) => r.template !== 'P'))
const qsPost = (aim: 'reach' | 'convert', platform: 'tiktok' | 'reels' = 'tiktok'): ShortPost => ({ ...(normalizeShortPost({ script: 'x', platform, aim, format: 'list' }, `s${Math.random()}`) as ShortPost), status: 'posted', postedOn: '2026-10-21' })
const qsTk = (topic: string, posts: ShortPost[] = []) => recommendShort({ topic, platform: 'tiktok', posts, today: '2026-10-23' })
check('QS6 틱톡 — 처음은 많이 보이게 · 리스트형 · 질문이면 대화형 · 화면 · 자동화면 화면 시연 · "전에 · 하지 마" 면 금지형 · 이번 주 많이 보이게 3 : 문의 0 이면 문의로(화면 시연)', qsTk('정책자금 한도').aim === 'reach' && qsTk('정책자금 한도').format === 'list' && qsTk('왜 정책자금이 거절될까?').format === 'talk' && qsTk('반복 업무 자동화 화면').format === 'demo' && qsTk('신청 전에 이것부터 하지 마세요').format === 'ban' && qsTk('정책자금', [qsPost('reach'), qsPost('reach'), qsPost('reach'), qsPost('reach')]).aim === 'convert' && qsTk('정책자금', [qsPost('reach'), qsPost('reach'), qsPost('reach'), qsPost('reach')]).format === 'demo' && /3 : 1/.test(qsTk('x').why))
const qsRl = (topic: string, posts: ShortPost[] = []) => recommendShort({ topic, platform: 'reels', posts, today: '2026-10-23' })
check('QS7 릴스 — 벤처 점검표 주제면 댓글 받기 · 댓글형 · 자료 없으면 많이 보이게(금지형 · 화면이면 화면 시연) · 형식은 늘 그 플랫폼 · 목적에 맞는 것', qsRl('벤처기업확인 체크리스트').aim === 'convert' && qsRl('벤처기업확인 체크리스트').format === 'comment' && qsRl('고용지원금').aim === 'reach' && qsRl('고용지원금').format === 'ban' && qsRl('자동화 화면 만들기').format === 'demo' && ['고용지원금', '벤처 점검표', '자동화 화면', '왜?', ''].every((t) => ['tiktok', 'reels'].every((pf) => { const r = recommendShort({ topic: t, platform: pf as 'tiktok' | 'reels', posts: [], today: '2026-10-23' }); return formatsFor(pf as 'tiktok' | 'reels', r.aim).some((f) => f.key === r.format) })))
const qsChips = topicChips(['고용지원금', '정책자금 ', ' 고용 지원금', '', '가', '나', '다', '라', '마'], ['정책자금', '벤처 세금'])
check('QS8 주제 칩 — 이번 주 키워드 먼저(6개까지 · 띄어쓰기만 다른 것 하나로) · 그다음 우리 분야(겹치면 빼기)', qsChips.filter((c) => c.from === 'week').length <= WEEK_TOPICS_MAX && qsChips[0].topic === '고용지원금' && qsChips.filter((c) => c.topic.replace(/\s/g, '') === '고용지원금').length === 1 && qsChips.filter((c) => c.topic.trim() === '정책자금').length === 1 && qsChips[qsChips.length - 1].topic === '벤처 세금' && qsChips[qsChips.length - 1].from === 'ours', qsChips)
const qsMem = new Map<string, string>()
;(globalThis as unknown as { localStorage: Pick<Storage, 'getItem' | 'setItem'> }).localStorage = { getItem: (k) => qsMem.get(k) ?? null, setItem: (k, v) => void qsMem.set(k, String(v)) }
rememberWeekTopics(['고용지원금', '고용지원금', '정책자금', 'a', 'b', 'c', 'd', 'e'], '2026-10-23')
check('QS9 이번 주 키워드 보관 — 같은 주(일요일까지)만 읽힘 · 다음 주 월요일엔 비어 있음 · 겹침 없이 6개까지 · 빈 목록은 덮지 않음', readWeekTopics('2026-10-25').join() === '고용지원금,정책자금,a,b,c,d' && readWeekTopics('2026-10-26').length === 0 && (rememberWeekTopics([], '2026-10-23'), readWeekTopics('2026-10-23').length === 6))

console.log(`\n${passed} passed, ${failed} failed`)
if (failed) process.exit(1)
