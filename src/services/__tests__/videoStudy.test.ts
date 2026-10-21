/**
 * D-259 · D-260 벤치마킹 영상 깊게 보기 — 대본 구간 나누기 · 시각 읽기 · 줄 만들기 · 저장 읽기 · 우리 버전 자료 · 내 콘텐츠 줄.
 */
import { ADAPT_KEY, STUDY_KEEP, TRANSCRIPT_KEY, TRANSCRIPT_MAX_SEC, adaptContext, adaptIdea, adaptItem, adaptText, canTranscribe, clockOf, keepLatest, parseAdapts, parseClock, parseTranscripts, partLines, transcriptDone, transcriptLines, transcriptRows, transcriptContext, transcriptSegments, transcriptText, type TranscriptDoc } from '../marketing/videoStudy'
import { PACK_RULES } from '../marketing/contentPack'
import { DEFAULT_BRIEF } from '../marketing/radarStore'
import type { RadarVideo } from '../marketing/ytRadar'
import type { AssistAnswer } from '../aiAssist/client'

let pass = 0
let fail = 0
const check = (n: string, c: boolean, d?: unknown) => {
  if (c) {
    pass++
    console.log('PASS ', n)
  } else {
    fail++
    console.log('FAIL ', n, d === undefined ? '' : JSON.stringify(d).slice(0, 600))
  }
}

const V = {
  id: 'dQw4w9WgXcQ',
  title: '세무 기장 수수료 전부 공개합니다',
  channelName: '로뎀세무법인',
  url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  durationSec: 1421,
  isShort: false,
  views: 52000,
  ratio: 3.2,
  adjusted: 3.4,
  ageDays: 9.5,
  likeRate: 2.4,
  channelSubs: 41000,
  viewsPerSub: 1.27,
  topics: ['tax'],
  domains: ['economy'],
} as unknown as RadarVideo

{
  const s = transcriptSegments(1421)
  const t = transcriptSegments(605)
  const u = transcriptSegments(0)
  const w = transcriptSegments(3 * 3600 + 7)
  check('VS1 구간 — 23분 41초 → 10분씩 3번(0~600 · 600~1200 · 1200~1421) · 10분 5초는 한 번(끝 5초 붙임) · 길이 모름은 앞 10분 · 3시간은 앞 2시간 12번',
    JSON.stringify(s) === JSON.stringify([{ start: 0, end: 600 }, { start: 600, end: 1200 }, { start: 1200, end: 1421 }]) && JSON.stringify(t) === JSON.stringify([{ start: 0, end: 605 }]) && JSON.stringify(u) === JSON.stringify([{ start: 0, end: 600 }]) && w.length === 12 && w[11].end === TRANSCRIPT_MAX_SEC && w.every((x) => x.end - x.start <= 900),
    { s, t, u, n: w.length })
}
check('VS2 시각 읽기 · 쓰기 — 0:07 · 12:05 · 1:02:03 · 틀린 것 null', parseClock('0:07') === 7 && parseClock('12:05') === 725 && parseClock('1:02:03') === 3723 && parseClock(' 9:59 ') === 599 && parseClock('3:75') === null && parseClock('abc') === null && parseClock('1:75:00') === null && clockOf(725) === '12:05' && clockOf(3723) === '1:02:03' && clockOf(7) === '0:07')
{
  const seg = { start: 600, end: 1200 }
  const lines = partLines([{ title: '10:40', body: '두 번째 말' }, { title: '10:00', body: '첫 말' }, { title: '0:05', body: '구간 앞 시각' }, { title: '25:00', body: '구간 뒤 시각' }, { title: '모름', body: '시각 없음' }, { title: '10:50', body: '  ' }, { title: '11:00', body: '수수료 표', detail: '화면 글' }], seg)
  check('VS3 줄 — 시각 순 · 구간 밖 시각은 구간 안으로 · 시각 없으면 구간 처음 · 빈 말 버림 · 화면 글 표시',
    lines.length === 6 && lines[0].t === 600 && lines.map((l) => l.t).every((t, k, a) => k === 0 || a[k - 1] <= t) && lines.some((l) => l.text === '구간 뒤 시각' && l.t === 1199) && lines.some((l) => l.text === '시각 없음' && l.t === 600) && lines.find((l) => l.text === '수수료 표')?.screen === true,
    lines)
}
const DOC: TranscriptDoc = {
  id: V.id,
  title: V.title,
  at: '2026-10-21T10:00:00Z',
  model: 'gemini-3.1-flash-lite',
  duration: 1421,
  parts: [
    { start: 600, end: 1200, status: 'done', lines: [{ t: 600, text: '두 번째 구간 말' }] },
    { start: 0, end: 600, status: 'done', lines: [{ t: 5, text: '안녕하세요 오늘은 기장 수수료' }, { t: 40, text: '수수료 표', screen: true }] },
    { start: 1200, end: 1421, status: 'error', lines: [], error: '받지 못했어요' },
  ],
}
{
  const txt = transcriptText(DOC)
  check('VS4 대본 글 — 제목 줄 + "0:05  말" · 화면 글 표시 · 구간 순서대로 · 못 받은 구간은 빠짐 · 다 받았나(아니오 → 다 받으면 예)',
    txt.startsWith('[대본] 세무 기장 수수료') && txt.includes('0:05  안녕하세요') && txt.includes('0:40  (화면 글) 수수료 표') && txt.indexOf('0:40') < txt.indexOf('10:00  두 번째') && transcriptLines(DOC).length === 3 && !transcriptDone(DOC, transcriptSegments(1421)) && transcriptDone({ ...DOC, parts: DOC.parts.map((p) => ({ ...p, status: 'done' as const })) }, transcriptSegments(1421)) && transcriptText(null) === '',
    txt)
}
{
  const raw = JSON.stringify({ [V.id]: DOC, sample_0_1: DOC, 'bad id!': DOC, abcdefghijk: { parts: [{ start: 0, end: 0 }, { start: 'x' }, { start: 0, end: 600, status: 'done', lines: [{ t: 1, text: 'ok' }, { t: 'x', text: 'no' }, { text: 'no t' }] }] } })
  const got = parseTranscripts(raw)
  check('VS5 저장 읽기 — 예시 영상 · 이상한 번호 버림 · 틀린 구간 · 줄 버림 · 깨진 글은 빈 것', Object.keys(got).sort().join() === ['abcdefghijk', V.id].sort().join() && got.abcdefghijk.parts.length === 1 && got.abcdefghijk.parts[0].lines.length === 1 && got[V.id].parts.length === 3 && Object.keys(parseTranscripts('깨짐')).length === 0 && Object.keys(parseTranscripts('[1]')).length === 0, Object.keys(got))
  let all: Record<string, { at: string }> = {}
  for (let k = 0; k < STUDY_KEEP + 5; k++) all = keepLatest(all, `v${String(k).padStart(9, '0')}x`, { at: new Date(Date.UTC(2026, 0, 1, 0, k)).toISOString() })
  check(`VS6 영상 ${STUDY_KEEP}편까지만 남김(오래된 것부터 버림) · 키 이름 그대로`, Object.keys(all).length === STUDY_KEEP && !('v000000000x' in all) && 'v000000034x' in all && TRANSCRIPT_KEY === 'axmvp.mk.transcript.v1' && ADAPT_KEY === 'axmvp.mk.adapt.v1')
}
check('VS7 받아 적기 되는 영상 — 11자 번호만(예시 영상 sample_… 11자도 아님 · 빈 것 아님)', canTranscribe('dQw4w9WgXcQ') && !canTranscribe('sample_0_1') && !canTranscribe('sample_0_10') && !canTranscribe('') && !canTranscribe('dQw4w9WgXcQx') && !canTranscribe('https://x'))
{
  const withT = adaptContext({ v: V, lessons: ['숫자를 제목 앞에', '첫 10초에 결론'], brief: null, transcript: DOC, today: '2026-10-21' })
  const noT = adaptContext({ v: V, lessons: [], brief: { ...DEFAULT_BRIEF, channel: '우리 채널 이름' }, transcript: null, today: '2026-10-21' })
  const names = withT.sections.map((s) => s.name)
  check('VS8 우리 버전 자료 — 참고 영상(숫자 · 참고할 것) · 대본 줄(있을 때만) · 채널 설계 기준 · 규칙집 · 회사 소개 · 대본 있음/없음 한 줄',
    names[0].startsWith('참고 영상') && names[1].startsWith('참고 영상 대본') && names[2].startsWith('채널 설계 기준') && withT.sections[1].rows.length === 3 && (withT.sections[0].rows[0] as Record<string, unknown>).평소대비 === '평소의 3.4배' && JSON.stringify(withT.sections[0].rows[0]).includes('숫자를 제목 앞에') && withT.rules?.length === PACK_RULES.length && (withT.facts ?? []).some((f) => f.includes('대본이 있다')) &&
      noT.sections.length === 2 && JSON.stringify(noT.sections[1].rows).includes('우리 채널 이름') && (noT.facts ?? []).some((f) => f.includes('대본이 없다')),
    names)
  const long: TranscriptDoc = { ...DOC, parts: [{ start: 0, end: 600, status: 'done', lines: Array.from({ length: 400 }, (_, k) => ({ t: k, text: '가'.repeat(400) })) }] }
  const rows = transcriptRows(long)
  check('VS9 긴 대본은 앞부분부터 약 2만 자 · 한 줄 300자', rows.length > 0 && rows.length < 400 && rows.every((r) => r.말.length <= 300) && rows.reduce((n, r) => n + r.말.length, 0) <= 20000, rows.length)
}
{
  const A: AssistAnswer = {
    headline: '기장료 얼마가 적당할까 — 대표님이 손해 안 보는 기준 3가지',
    items: [
      { title: '왜 잘 됐나', tag: '분석', outline: ['숫자를 공개해 궁금증', '첫 10초에 표'] },
      { title: '제목 후보', tag: '제목', outline: ['기장료 이 정도면 적당합니다', '세무사 바꾸기 전에 볼 것', 'c', 'd', 'e', 'f'] },
      { title: '썸네일 문구', tag: '썸네일', outline: ['월 15만원이면 적당?', 'b', 'c', 'd', 'e'] },
      { title: '첫 문장', tag: '첫 문장', body: '오늘은 기장료가 적당한지 3분 안에 판단하는 기준을 드립니다.' },
      { title: '구성 시간표', tag: '구성', outline: ['0:00 오프닝 — 질문'] },
      { title: '쇼츠로 자르기', tag: '쇼츠', outline: ['0~3초 기장료 얼마 내세요?'] },
    ],
    next: ['수수료 표 준비'],
    caution: '',
  }
  const idea = adaptIdea(A, V)
  const aiV = { ...V, domains: ['ai'] } as unknown as RadarVideo
  check('VS10 내 콘텐츠 줄 — 같은 영상은 같은 줄(video:번호) · 주제 = 우리 제목 · 제목 5 · 썸네일 4 · 첫 문장 · 참고 영상 · 대본 칸에 전체 · 단계 대본 준비',
    idea.key === `video:${V.id}` && idea.topic === A.headline && idea.titleCandidates.length === 5 && idea.thumbnailCandidates.length === 4 && idea.hook.startsWith('오늘은 기장료') && idea.benchmarkVideoIds[0] === V.id && idea.benchmarkTitles[0] === V.title && (idea.script ?? '').includes('■ 구성 시간표') && (idea.script ?? '').includes('□ 수수료 표 준비') && idea.status === 'script' && idea.type === 'market' && adaptIdea(A, aiV).type === 'axai' && idea.whyNow.length === 2,
    idea)
  check('VS11 칸 찾기 — tag 띄어쓰기 달라도("첫 문장") · 없으면 제목으로 · 글 복사에 참고 영상 출처', adaptItem(A, '첫문장')?.body?.startsWith('오늘은') === true && adaptItem({ ...A, items: [{ title: '제목 후보', outline: ['x'] }] }, '제목', /제목/)?.outline?.[0] === 'x' && adaptText(A, V).includes('(참고: 로뎀세무법인') && adaptText(null, V) === '')
  const saved = parseAdapts(JSON.stringify({ [V.id]: { at: 'x', model: 'm', withTranscript: true, answer: A }, bad: { answer: { headline: 1 } }, x2: 'nope' }))
  check('VS12 우리 버전 저장 읽기 — 맞는 것만 · 깨진 글은 빈 것', Object.keys(saved).join() === V.id && saved[V.id].answer.items.length === 6 && saved[V.id].withTranscript && Object.keys(parseAdapts('깨짐')).length === 0)
}

// 점검 결과 고침 — 뒷 구간 시각을 구간 처음부터 센 것으로 답한 때 · 받아 적기 자료는 영상 정보만
{
  const seg = { start: 600, end: 1200 }
  const rel = partLines([{ title: '0:00', body: '첫 말' }, { title: '2:30', body: '둘째 말' }, { title: '9:50', body: '끝 말' }], seg)
  const abs = partLines([{ title: '10:05', body: '첫 말' }, { title: '12:30', body: '둘째 말' }], seg)
  const mixed = partLines([{ title: '3:00', body: '앞' }, { title: '15:00', body: '뒤' }], seg)
  check('VS13 뒷 구간 — 시각이 모두 구간 처음보다 앞이면 구간 처음을 더함(10:00 · 12:30 · 19:50) · 영상 처음부터 센 시각은 그대로 · 섞이면 더하지 않음(앞은 구간 처음으로)',
    rel.map((l) => l.t).join() === '600,750,1190' && abs.map((l) => l.t).join() === '605,750' && mixed.map((l) => l.t).join() === '600,900' && partLines([{ title: '0:30', body: 'x' }], { start: 0, end: 600 })[0].t === 30,
    { rel, abs, mixed })
  const tc = transcriptContext({ title: '세무 기장 수수료 전부 공개', channelName: '로뎀세무법인', durationSec: 1395 }, '2026-10-21')
  const flat = JSON.stringify(tc)
  check('VS14 받아 적기 자료 — 영상 이름 · 채널 · 길이(23:15)만 · 규칙집 · 채널 기준 · 회사 소개 · 앞서 받은 대본 없음',
    tc.sections.length === 1 && tc.sections[0].rows[0].길이 === '23:15' && flat.includes('로뎀세무법인') && !tc.rules && !tc.facts && !flat.includes(PACK_RULES[0]) && !flat.includes('채널 설계 기준') && !flat.includes('참고 영상 대본'),
    tc)
}

console.log(`\nvideoStudy: ${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
