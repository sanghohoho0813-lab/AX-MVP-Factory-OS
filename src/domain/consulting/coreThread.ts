/**
 * One Core Thread 일관성 검사 — 규칙 기반 (Master PART 6 §35, §14-2, §18-2).
 *
 * 점수를 내지 않는다. "무엇이 비었고, 무엇이 서로 다르게 읽히는가" 만 말한다.
 * AI 일관성 채점은 Future 다 — 여기서는 낱말 겹침 같은 설명 가능한 규칙만 쓴다.
 */

import type { ConsistencyWarning, ConsultingProject, CoreThreadKey } from '../../types/consulting'
import { CORE_THREAD_KEYS, CORE_THREAD_LABEL } from './projectModel'
import { factText } from './factsheetSchema'

/** 한글·영문 2자 이상 토막 (조사가 붙어도 앞 2~3자는 겹치므로 거칠지만 설명 가능한 기준) */
export function contentWords(text: string): Set<string> {
  const out = new Set<string>()
  const tokens = text.toLowerCase().match(/[가-힣a-z0-9]{2,}/g) ?? []
  for (const t of tokens) {
    out.add(t)
    // 한글 낱말은 앞 2글자도 넣어 "위험분석" 과 "위험도" 가 겹치게 한다
    if (/^[가-힣]{3,}$/.test(t)) out.add(t.slice(0, 2))
  }
  for (const s of STOP) out.delete(s)
  return out
}

const STOP = ['시스템', '방법', '기반', '통해', '위한', '있는', '하는', '및', '그리고', '기능', '서비스', '제공', '이용', '관리', '데이터']

export function sharedWords(a: string, b: string): string[] {
  const wa = contentWords(a)
  const wb = contentWords(b)
  return [...wa].filter((w) => wb.has(w))
}

/** 등록 표현 — 출원 상태에서 쓰면 안 되는 말 (§14-2, §49) */
const REGISTERED_WORDS = /특허\s*등록|등록\s*완료|등록특허|등록된\s*특허/
const AI_WORD = /\bAI\b|인공지능|AI가|AI 가|AI로/

export function coreThreadWarnings(p: ConsultingProject): ConsistencyWarning[] {
  const out: ConsistencyWarning[] = []
  const t = p.coreThread

  // 1) 빈 칸
  const empty = CORE_THREAD_KEYS.filter((k) => t[k].trim() === '')
  for (const k of empty) {
    out.push({ code: `thread_empty_${k}`, severity: 'info', message: `${CORE_THREAD_LABEL[k]} 이(가) 비어 있습니다.`, tab: 'thread', focus: k })
  }

  // 2) 핵심 기술 낱말 겹침 — 특허 ↔ AX Core ↔ 벤처 문장이 같은 기술을 말하는가
  const anchor = t.coreTech.trim()
  if (anchor !== '') {
    const pairs: [CoreThreadKey, string][] = [
      ['patentPoint', t.patentPoint],
      ['axCore', t.axCore],
      ['ventureSentence', t.ventureSentence],
    ]
    for (const [k, text] of pairs) {
      if (text.trim() === '') continue
      if (sharedWords(anchor, text).length === 0) {
        out.push({
          code: `thread_drift_${k}`,
          severity: 'p1',
          message: `${CORE_THREAD_LABEL[k]} 이(가) 핵심 해결기술과 같은 낱말을 하나도 쓰지 않습니다 — 서로 다른 기술로 읽힐 수 있습니다 (Master §35-1).`,
          tab: 'thread',
          focus: k,
        })
      }
    }
  }

  // 3) 출원 ≠ 등록
  if (p.patent.filingStatus !== 'registered') {
    const texts = [t.coreTech, t.patentPoint, t.ventureSentence, factText(p.factsheet, 'patent'), p.fieldReview.script]
    if (texts.some((x) => REGISTERED_WORDS.test(x))) {
      out.push({
        code: 'patent_registered_wording',
        severity: 'p0',
        message: '아직 등록되지 않은 특허를 "등록" 으로 적은 곳이 있습니다. 등록 전에는 "특허출원 중" 으로 씁니다 (Master §14-2).',
        tab: 'patent',
      })
    }
  }

  // 4) Rule/Scoring/Demo 인데 AI 라고 부름
  const notAi = p.mvp.axMode === 'rule' || p.mvp.axMode === 'scoring' || p.mvp.axMode === 'optimization' || p.mvp.axMode === 'demo'
  if (notAi && (AI_WORD.test(t.axCore) || AI_WORD.test(p.mvp.axCoreFeature))) {
    out.push({
      code: 'ax_called_ai',
      severity: 'p1',
      message: `AX 기능 방식이 "${p.mvp.axMode}" 인데 문장에서 AI 라고 부릅니다. 분석로직·자동판단·점수기반 추천처럼 실제에 맞는 말로 바꿉니다 (Master §18-2).`,
      tab: 'mvp',
      focus: 'axCoreFeature',
    })
  }

  // 5) 시연용 숫자가 실사 암기 숫자에 들어감
  for (const k of p.fieldReview.numbersToMemorize) {
    const f = p.factsheet[k]
    if (f && f.status === 'demo') {
      out.push({
        code: `demo_number_memorized_${k}`,
        severity: 'p0',
        message: `시연용(demo) 값을 대표가 외울 숫자에 넣었습니다. 실사에서 실적처럼 말하게 됩니다 (Master K10·§49).`,
        tab: 'review',
        focus: k,
      })
    }
  }

  // 6) 사실표 핵심기술과 줄기 핵심기술이 다름
  const factTech = factText(p.factsheet, 'coreTech')
  if (factTech !== '' && anchor !== '' && sharedWords(factTech, anchor).length === 0) {
    out.push({
      code: 'thread_vs_factsheet_tech',
      severity: 'p1',
      message: '사실표의 핵심 해결기술과 핵심 줄기의 핵심 해결기술이 다른 말을 씁니다. 한쪽으로 맞춥니다.',
      tab: 'thread',
      focus: 'coreTech',
    })
  }

  return out
}

export function threadFilledCount(p: ConsultingProject): number {
  return CORE_THREAD_KEYS.filter((k) => p.coreThread[k].trim() !== '').length
}

export function coreThreadToText(p: ConsultingProject): string {
  return CORE_THREAD_KEYS
    .filter((k) => p.coreThread[k].trim() !== '')
    .map((k) => `${CORE_THREAD_LABEL[k]}: ${p.coreThread[k].trim()}`)
    .join('\n')
}
