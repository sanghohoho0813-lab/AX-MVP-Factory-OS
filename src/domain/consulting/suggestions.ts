/**
 * 시스템이 먼저 문장을 쓴다 — 사용자는 확인만 한다 (§5·§9·§18).
 *
 * "이 문제를 어떤 방식으로 풀 생각인가요?" 를 빈 칸으로 물으면 50대 컨설턴트는 멈춘다.
 * 이미 아는 것(현장문제·기존방식·업종·고객)으로 **초안 한 문장**을 만들어 보여 주고
 * [이대로 쓰기] 또는 [고쳐 쓰기] 를 누르게 한다.
 *
 * 규칙 기반이다. AI 가 아니다 — 문장 틀에 이미 확인된 값을 끼워 넣을 뿐이다.
 * 값이 없으면 문장을 만들지 않고 빈 문자열을 돌려준다. 없는 사실을 지어내지 않는다(§54).
 */

import type { ConsultingProject } from '../../types/consulting'
import { clip, subjectParticle, toPhrase, topicParticle } from './koreanText'

/** 사실표 값 — 비어 있으면 빈 문자열 */
function f(p: ConsultingProject, key: Parameters<typeof factOf>[1]): string {
  return factOf(p, key)
}

function factOf(p: ConsultingProject, key: keyof ConsultingProject['factsheet']): string {
  return (p.factsheet[key]?.value ?? '').trim()
}

/** 문장 끝의 마침표·조사 정리 */
function tidy(s: string): string {
  return s.replace(/\s+/g, ' ').replace(/\s*\.\s*$/, '').trim()
}

/**
 * 다른 문장에 끼워 넣을 수 있는 명사구로 만든다.
 * 종결어미를 떼고, 이미 조립된 문장이면 회사 소개·판정문 부분을 걷어낸다.
 * 길면 자른다 — 초안 한 줄이 문단이 되면 읽히지 않는다.
 */
function asPhrase(s: string, max = 60): string {
  return clip(toPhrase(tidy(s)), max)
}

/**
 * 이 회사의 현장문제를 짧게. 핵심 줄기(짧은 이름)가 있으면 그것을 먼저 쓴다 —
 * 사실표의 값은 이미 문장으로 늘려 둔 것이라 다시 끼워 넣으면 말이 겹친다.
 */
function shortProblem(p: ConsultingProject): string {
  const thread = p.coreThread.fieldProblem.trim()
  if (thread !== '') return asPhrase(thread)
  return asPhrase(f(p, 'coreProblem'))
}

export interface Suggestion {
  /** 제안 문장. 만들 수 없으면 '' */
  text: string
  /** 무엇을 근거로 만들었는지 — 화면에 그대로 보여 준다 */
  basedOn: string[]
}

const NONE: Suggestion = { text: '', basedOn: [] }

/* ------------------------------------------------------------------ */
/* S1 — 고른 문제를 컨설턴트가 쓸 문장으로                                */
/* ------------------------------------------------------------------ */

/**
 * 사용자가 고른 짧은 보기를 사업계획서·특허에 그대로 쓸 수 있는 한 문장으로 늘린다.
 * 회사 이름과 업종을 아는 만큼만 붙인다.
 */
export function composeProblemSentence(choice: string, p: ConsultingProject): Suggestion {
  const picked = tidy(choice)
  if (picked === '') return NONE
  const company = f(p, 'companyName') || p.clientName
  const industry = f(p, 'industry')
  const basedOn: string[] = []
  let head = ''
  if (company !== '') {
    const where = industry !== '' ? `${industry.split('·')[0].trim()} 현장에서` : '현장에서'
    head = `${topicParticle(company)} ${where}`
    basedOn.push(industry !== '' ? '회사명 · 업종' : '회사명')
  }
  const body = `${asPhrase(picked, 80)} 문제가 반복되고 있습니다`
  return { text: tidy(head === '' ? body : `${head} ${body}`), basedOn }
}

/* ------------------------------------------------------------------ */
/* S3 — 핵심 해결기술                                                    */
/* ------------------------------------------------------------------ */

/**
 * 현장문제 + 기존방식 → "무엇을 어떻게 바꾸는가" 한 줄.
 * 특허·MVP·사업계획서가 앞으로 같은 이름으로 부를 기술이므로 명사로 끝낸다.
 */
export function suggestCoreTech(p: ConsultingProject): Suggestion {
  const subject = shortProblem(p)
  if (subject === '') return NONE
  const method = asPhrase(f(p, 'currentMethod'), 40)
  const basedOn = ['핵심 현장문제']
  if (method !== '') basedOn.push('기존 해결방식')
  /*
   * 잘린 동사구에 조사를 붙이면 "…확인을 대신하는" 처럼 어색해진다.
   * 조사로 잇지 않고 줄표와 절로 나눠 쓴다 — 어떤 값이 들어와도 문장이 무너지지 않는다.
   */
  const instead = method !== '' ? `${method} 대신` : '사람이 매번 눈으로 확인하던 일 대신'
  return {
    text: tidy(`${subject} — 흩어진 자료를 한 곳에 모으고, ${instead} 위험을 자동으로 계산해 처리 순서를 추천하는 기능`),
    basedOn,
  }
}

/* ------------------------------------------------------------------ */
/* S3 — 권리화 포인트 (GPT 후보가 없을 때의 초안)                         */
/* ------------------------------------------------------------------ */

export function suggestPatentPoint(p: ConsultingProject): Suggestion {
  const tech = asPhrase(f(p, 'coreTech') || p.coreThread.coreTech, 50)
  if (tech === '') return NONE
  return {
    text: tidy(`${tech} 에서, 흩어진 데이터를 한 형식으로 모으고 → 위험도를 계산해 → 처리 순서를 다시 정하는 그 순서 자체`),
    basedOn: ['핵심 해결기술'],
  }
}

/* ------------------------------------------------------------------ */
/* S8 — MVP                                                             */
/* ------------------------------------------------------------------ */

/** 가장 중요한 사용 흐름 — 5단계 화살표로 (§28) */
export function suggestJourney(p: ConsultingProject): Suggestion {
  const user = p.mvp.targetUser.trim() || f(p, 'platformUsers')
  const tech = f(p, 'coreTech') || p.coreThread.coreTech
  if (user === '' && tech === '') return NONE
  const who = user !== '' ? user.split('·')[0].trim() : '현장 담당자'
  const basedOn = user !== '' ? ['쓰는 사람'] : []
  if (tech !== '') basedOn.push('핵심 해결기술')
  return {
    text: `${subjectParticle(who)} 요청·자료를 넣으면 → 시스템이 한 형식으로 정리하고 → 위험한 건을 먼저 표시하고 → 담당자가 처리하고 → 결과가 다시 기록된다`,
    basedOn,
  }
}

/** 실제로 동작해야 하는 기능 1개 */
export function suggestAxCore(p: ConsultingProject): Suggestion {
  const tech = asPhrase(f(p, 'coreTech') || p.coreThread.coreTech, 50)
  if (tech === '') return NONE
  return {
    text: tidy(`${tech} — 이 중에서 "위험도를 계산해 처리 순서를 추천하는 것" 하나만 실제로 동작하게 만든다`),
    basedOn: ['핵심 해결기술'],
  }
}

/** 지금은 안 만들 것 — 실사에서 '만들었다' 고 말하지 않기 위해 미리 적어 둔다 */
export function suggestNotBuilding(p: ConsultingProject): Suggestion {
  const has = (p.mvp.axCoreFeature.trim() !== '' || f(p, 'coreTech') !== '')
  if (!has) return NONE
  return {
    text: '결제·정산, 외부 시스템 자동연동, 모바일 앱, 다국어 — 이번 MVP 에서는 만들지 않는다',
    basedOn: ['MVP 범위'],
  }
}

/* ------------------------------------------------------------------ */
/* 모아 보기                                                            */
/* ------------------------------------------------------------------ */

/** 할 일 id 로 초안을 찾는다. 없으면 빈 제안. */
export function suggestionFor(id: string, p: ConsultingProject): Suggestion {
  switch (id) {
    case 'S3:INPUT:coreTech':
      return suggestCoreTech(p)
    case 'S3:INPUT:patentPoint':
      return suggestPatentPoint(p)
    case 'S8:INPUT:primaryJourney':
      return suggestJourney(p)
    case 'S8:INPUT:axCore':
      return suggestAxCore(p)
    case 'S8:INPUT:future':
      return suggestNotBuilding(p)
    default:
      return NONE
  }
}
