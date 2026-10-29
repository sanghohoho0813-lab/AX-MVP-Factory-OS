/**
 * D-231 이번 주 찍기 키트 — 레이더 후보 하나를 '오늘 바로 찍을 수 있는' 모양으로 바꾼다.
 *
 * 대표: "이번 주 뭐가 제일 잘 터지는지 보고 벤치마킹해서, 잘 되는 틀 · 주제는 그대로 보고 내 스타일대로 변형해 찍는다.
 *        보면 몇 분 안에 '오늘 이거 찍자' 가 판단되게."
 *  - 잘 된 틀: 평소보다 잘된 벤치마킹 영상의 제목 구조(숫자형 · 경고형 …) → 그 틀로 쓴 우리 제목.
 *  - 첫 문장 · 긴 영상 구성(시간표) · 쇼츠 3컷 · 그대로 가져올 것 / 내 스타일로 바꿀 것 · 찍기 전 준비물 · 준비 시간.
 * 규칙으로 고른다(LLM 호출 0 — 나중에 대본 만들기를 붙일 때 이 키트가 브리프가 된다).
 * 벤치마킹 영상의 제목 · 대사를 그대로 쓰지 않는다 — 구조만 가져오고 내용은 미래AI랩 관점으로.
 * 숫자는 우리가 가진 근거(레이더가 센 영상 · 채널 수)만 쓰고, 영상 안 숫자는 '공식 자료로 확인' 빈칸으로 남긴다.
 */
import { TITLE_PATTERNS, type Opportunity, type RadarVideo } from './ytRadar'
import { mkText } from './persona'
import { josa } from '../../lib/josa'

export interface KitFrame {
  pattern: string
  label: string
  /** 이 틀에서 참고할 것 한 줄 */
  note: string
  /** 그 틀로 잘된 영상(제목은 참고만) — 벤치마킹 영상이 없으면 null */
  ref: { title: string; channel: string; ratio: string; short: boolean } | null
  /** 같은 틀로 쓴 우리 제목 */
  mine: string
}

export interface KitStep {
  at: string
  what: string
}

export type KitFormat = '롱폼 + 쇼츠' | '쇼츠 먼저'

export interface ShootKit {
  /** 영상 첫 문장(시작 3초) */
  hook: string
  frames: KitFrame[]
  titles: string[]
  thumbs: string[]
  /** 긴 영상 구성 — 시간표 */
  outline: KitStep[]
  /** 쇼츠 3컷 */
  shorts: KitStep[]
  keep: string[]
  change: string[]
  prep: string[]
  effort: { label: string; minutes: number }
  format: KitFormat
}

/** 'BRIDGE' 머리 '정책자금 × 공고 자동 수집' → 시장 주제 · 장치 */
function split(topic: string): { market: string; device: string } {
  const [a, b] = topic.split(/\s*×\s*/)
  return { market: (a ?? topic).trim(), device: (b ?? '').trim() }
}

const PATTERN_BY_ID = new Map(TITLE_PATTERNS.map((p) => [p.id, p]))

function ratioText(v: RadarVideo): string {
  const x = v.adjusted ?? v.ratio
  return x && x > 0 ? `평소 ${x >= 10 ? Math.round(x) : x.toFixed(1)}배` : ''
}

/** 잘 된 틀 — 벤치마킹 영상마다 제목 구조 하나, 그 구조로 쓴 우리 제목을 짝짓는다(같은 구조 두 번 안 씀) */
function framesOf(o: Opportunity): KitFrame[] {
  const out: KitFrame[] = []
  const used = new Set<string>()
  const titleFor = (pattern: string, i: number) => o.titles.find((t) => t.patterns.includes(pattern) && !out.some((f) => f.mine === t.text))?.text ?? o.titles[i % Math.max(1, o.titles.length)]?.text ?? ''
  o.benchmarks.forEach((v, i) => {
    const pattern = v.patterns.find((p) => !used.has(p))
    if (!pattern) return
    const def = PATTERN_BY_ID.get(pattern)
    if (!def) return
    used.add(pattern)
    out.push({ pattern, label: def.label, note: def.note, ref: { title: v.title, channel: v.channelName, ratio: ratioText(v), short: v.isShort }, mine: titleFor(pattern, i) })
  })
  // 벤치마킹 영상이 없거나 구조를 못 읽었으면 — 우리 제목 후보의 구조로(참고 영상 없음)
  for (const [i, t] of o.titles.entries()) {
    if (out.length >= 3) break
    const pattern = t.patterns.find((p) => !used.has(p))
    if (!pattern || out.some((f) => f.mine === t.text)) continue
    const def = PATTERN_BY_ID.get(pattern)
    if (!def) continue
    used.add(pattern)
    out.push({ pattern, label: def.label, note: def.note, ref: null, mine: o.titles[i].text })
  }
  return out.slice(0, 3)
}

function formatOf(o: Opportunity): KitFormat {
  const shorts = o.benchmarks.filter((v) => v.isShort).length
  return o.benchmarks.length > 0 && shorts * 2 > o.benchmarks.length ? '쇼츠 먼저' : '롱폼 + 쇼츠'
}

export function shootKit(o: Opportunity): ShootKit {
  const { market, device } = split(o.topic)
  const thumb = o.thumbs[0] ?? ''
  const main = o.titles[0]?.text ?? o.topic
  const frames = framesOf(o)
  const format = formatOf(o)
  const view = o.view
  let hook: string
  let outline: KitStep[]
  let prep: string[]
  let effort: ShootKit['effort']
  if (o.axis === 'axai') {
    hook = `${o.topic}, 직접 써 보니 일이 이렇게 달라졌습니다 — 결과부터 보여 드릴게요.`
    outline = [
      { at: '0:00', what: `결과 먼저 — 완성 화면 5초 + 첫 문장 "${hook}"` },
      { at: '0:30', what: '어떤 일에 쓰나 — 대표님 회사에서 매주 반복되는 업무 한 장면' },
      { at: '1:00', what: '따라 하기 ① 준비 → ② 설정 → ③ 실행(화면 녹화 · 단계마다 자막)' },
      { at: '4:00', what: '막히는 곳 · 주의할 점 2가지(실제로 써 보며 겪은 것만)' },
      { at: '5:00', what: `이렇게 말해요 — ${view}` },
      { at: '6:00', what: '마무리 — 3줄 요약 + 회사 업무에 붙이는 상담 · 자료 안내 한 줄' },
    ]
    prep = ['실제로 돌려 볼 계정 · 예시 파일(고객 정보는 지우기)', '완성 결과 화면 캡처 · 녹화', `썸네일 문구 고르기 — "${thumb}"`]
    effort = { label: '화면 녹화가 필요해요', minutes: 60 }
  } else if (o.axis === 'bridge') {
    hook = `${market} 챙기느라 바쁘시죠 — 손으로 찾지 말고 이렇게 자동으로 받아 보세요.`
    outline = [
      { at: '0:00', what: `문제 장면 — 첫 문장 "${hook}"` },
      { at: '0:30', what: `지금 어떻게들 하나 — ${josa(market, '을/를')} 손으로 챙길 때 놓치는 것` },
      { at: '1:30', what: `장치 보여 주기 — ${device || '자동화 장치'} 완성 화면` },
      { at: '3:00', what: '만드는 순서 3단계(화면 녹화)' },
      { at: '5:00', what: '달라진 점 — 시간 · 놓침이 어떻게 줄었나(우리 실제 기록만)' },
      { at: '6:00', what: `이렇게 말해요 + 마무리 — ${view}` },
    ]
    prep = ['자동화 완성 화면(시연)', '손으로 할 때 걸린 시간 · 놓친 일(실제 기록)', `썸네일 문구 고르기 — "${thumb}"`]
    effort = { label: '장치 시연이 필요해요', minutes: 90 }
  } else {
    hook = `${market} 소식, 대표님 회사에는 무엇이 달라질까요? 오늘 딱 3가지만 짚어 드리겠습니다.`
    outline = [
      { at: '0:00', what: `첫 문장 — "${hook}"` },
      { at: '0:20', what: `왜 지금 — ${o.summary}` },
      { at: '1:00', what: '핵심 ① 무엇이 바뀌나 — 뉴스 한 줄 요약(숫자는 공식 자료로 확인)' },
      { at: '2:30', what: '핵심 ② 우리 회사에는 — 예시 회사 하나로 계산해 보이기' },
      { at: '4:00', what: '핵심 ③ 지금 할 일 — 체크리스트 3개' },
      { at: '5:30', what: `이렇게 말해요 — ${view}` },
      { at: '6:30', what: '마무리 — 3줄 요약 + "회사 상황마다 달라 상담으로 확인해 드립니다" 한 줄' },
    ]
    prep = ['공식 자료 한 장(보도자료 · 공고문) — 영상 속 숫자는 여기서만', '예시 회사 숫자 하나(매출 · 직원 수 — 실제 고객이면 이름은 빼기)', `썸네일 문구 고르기 — "${thumb}"`]
    effort = { label: '자료 + 말로 설명', minutes: 30 }
  }
  const shorts: KitStep[] = [
    { at: '0~3초', what: `화면 자막 "${thumb || main}" + 첫 문장 짧게` },
    { at: '3~40초', what: `핵심 하나만 — "${main}" 의 답 한 가지` },
    { at: '40~60초', what: '결론 한 줄 + "자세한 건 긴 영상에서" (인사 없이 바로 시작)' },
  ]
  const keep = [
    frames.length ? `잘 된 틀 — ${frames.map((f) => f.label).join(' · ')}` : '잘 된 틀 — 숫자 · 질문으로 시작하는 제목',
    `주제 — ${o.topic}`,
    format === '쇼츠 먼저' ? '형식 — 잘된 영상이 쇼츠 위주라 쇼츠부터' : '형식 — 긴 영상 1편 + 쇼츠로 잘라 1~2편',
    '썸네일 — 짧은 질문 · 숫자 한 줄',
  ]
  const change = [
    mkText('사례 — 미래AI랩이 실제로 본 회사 이야기(회사 이름은 빼고)'),
    `관점 — ${view}`,
    '말투 — 대표님께 설명하듯, 숫자는 공식 자료로 확인',
    '제목 · 대사 — 참고 영상과 다르게(그대로 쓰지 않기)',
  ]
  return { hook, frames, titles: o.titles.map((t) => t.text), thumbs: [...o.thumbs], outline, shorts, keep, change, prep, effort, format }
}

/** 이번 주 찍을 것 — 복사해서 대본 메모 · 다른 도구에 붙여 쓰는 글(D-253: 화면에 남긴 것만 — 말할 각도 · 제목 · 첫 문장 · 잘 된 틀 · 썸네일) */
export function kitText(o: Opportunity, k: ShootKit = shootKit(o)): string {
  return [
    `[이번 주 이렇게 찍으세요] ${o.topic}`,
    `이렇게 말해요: ${o.view}`,
    `준비: ${k.effort.label}(${k.effort.minutes}분쯤) · ${k.format}`,
    '',
    `첫 문장: ${k.hook}`,
    '',
    '제목 후보',
    ...k.titles.map((t, i) => `${i + 1}. ${t}`),
    `썸네일 문구: ${k.thumbs.join(' / ')}`,
    '',
    '잘 된 틀 → 우리 제목',
    ...k.frames.map((f) => `- ${f.label}: ${f.mine}${f.ref ? `  (참고: ${f.ref.title} · ${f.ref.channel}${f.ref.ratio ? ` · ${f.ref.ratio}` : ''})` : ''}`),
    '',
    '참고 영상은 주제 · 구조만 참고 — 제목 · 대사를 그대로 쓰지 않는다.',
  ].join('\n')
}
