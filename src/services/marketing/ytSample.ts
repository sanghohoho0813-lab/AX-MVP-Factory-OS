/**
 * 유튜브 벤치마킹 예시 데이터 (D-193) — 키를 넣기 전에 화면이 어떻게 돌아가는지 보는 용도 · 시험용.
 *
 * 진짜 채널 이름 · 진짜 숫자를 쓰지 않는다(지어낸 숫자가 실제 채널 성적처럼 보이면 안 된다).
 * 채널은 '예시 채널 가 · 나 …', 숫자는 정해진 씨앗으로 만든 가짜 — 화면 맨 위에 '예시 데이터' 를 크게 단다.
 * 같은 '지금' 이면 늘 같은 데이터가 나온다(시험이 흔들리지 않게).
 */
import type { YtChannel, YtFeed, YtVideoRaw } from './ytBench'

/** 같은 씨앗 → 같은 수열 */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const NAMES = ['내 채널(예시)', '예시 채널 가', '예시 채널 나', '예시 채널 다', '예시 채널 라', '예시 채널 마', '예시 채널 바', '예시 채널 사']

/** 주제 — 대표 분야(정책자금 · 지원금 · 세금 · 승계) */
const TOPICS = ['정책자금', '고용지원금', '가업승계', '법인세 절세', '부가세 신고', '소상공인 대출', '청년도약계좌', '퇴직연금', '노란우산공제', '창업감면', '기업부설연구소', '벤처인증']
const SHAPES = [
  (k: string) => `${k} 이렇게 받으세요`,
  (k: string) => `${k} 놓치면 손해 보는 이유`,
  (k: string) => `${k} 신청 전에 꼭 볼 것`,
  (k: string) => `사장님 ${k} 실제 사례`,
  (k: string) => `${k} 2026년 바뀐 점`,
  (k: string) => `${k} 한 번에 끝내기`,
  (k: string) => `${k} 질문 TOP5`,
]

export function sampleFeed(now: number = Date.now()): YtFeed {
  const r = rng(20261013)
  const day = 86_400_000
  const channels: YtChannel[] = NAMES.map((title, i) => {
    const subs = Math.round((i === 0 ? 8_000 : 20_000 + r() * 300_000) / 100) * 100
    return {
      id: `sample_ch_${i}`,
      handle: `@sample${i}`,
      title,
      customUrl: `@sample${i}`,
      thumb: '',
      subs,
      videoCount: Math.round(80 + r() * 600),
      views: Math.round(subs * (40 + r() * 160)),
      mine: i === 0,
    }
  })
  const videos: YtVideoRaw[] = []
  channels.forEach((ch, ci) => {
    const n = 26 + Math.floor(r() * 10)
    let t = now - Math.floor(r() * 2) * day - 3 * 3_600_000
    for (let k = 0; k < n; k += 1) {
      const topic = TOPICS[Math.floor(r() * (k < 6 ? 4 : TOPICS.length))]
      const shape = SHAPES[Math.floor(r() * SHAPES.length)]
      const short = r() < 0.35
      const base = ch.subs * (0.05 + r() * (short ? 0.6 : 1.4))
      const hot = topic === '정책자금' || topic === '고용지원금' ? 1.8 : 1
      const views = Math.round(base * hot * (ci === 0 ? 0.7 : 1))
      videos.push({
        id: `sample_${ci}_${k}`,
        ch: ch.id,
        t: shape(topic),
        at: new Date(t).toISOString(),
        d: short ? 25 + Math.floor(r() * 150) : 240 + Math.floor(r() * 1800),
        v: views,
        l: Math.round(views * (0.01 + r() * 0.04)),
        c: Math.round(views * (0.001 + r() * 0.004)),
      })
      // 다음 영상은 1~9일 전(한국 시간 오전 7시 ~ 밤 10시 사이)
      t -= Math.floor(1 + r() * 8) * day + Math.floor(r() * 15) * 3_600_000 - 7 * 3_600_000
    }
  })
  return { fetchedAt: new Date(now).toISOString(), channels, videos, failed: [], units: 0 }
}
