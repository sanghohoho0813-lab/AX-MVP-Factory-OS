/**
 * 추천 진행 순서 (D-170) — 업체마다 다르다. 판정 결과 + 업체 계획(정책자금 · 조달 · B2B)으로 순서를 짠다.
 *  - 연구소가 열려 있고 벤처 · 이노비즈가 연구조직을 기다리면 → 연구소 먼저
 *  - 특허가 없는데 기술형 인증을 노리면 → 특허 보강을 그 앞에
 *  - 벤처 → 이노비즈(기술형) / 메인비즈(경영형)
 *  - 정책자금 계획이 있으면 인증 뒤에 정책자금
 *  - B2B · 조달이면 ISO 9001 을 끝에
 * 보유 중 · 필요 없음 · 아직 이름 · 추가 확인 필요는 순서에 넣지 않는다(아직 이름은 '나중' 으로 따로).
 */
import type { CertificationAssessment, CertificationClientContext, CertificationKey } from './types'

export interface RoadmapStep {
  id: CertificationKey | 'patent' | 'policy_fund'
  label: string
  /** 왜 이 자리인가 */
  why: string
}

export interface Roadmap {
  steps: RoadmapStep[]
  /** 아직 이른 것 — 언제부터 */
  later: { label: string; when: string }[]
}

const ACTIVE = new Set(['now', 'possible', 'after_fix'])

export function buildRoadmap(list: readonly CertificationAssessment[], c: CertificationClientContext): Roadmap {
  const by = new Map(list.map((a) => [a.key, a]))
  const on = (k: CertificationKey) => {
    const a = by.get(k)
    return !!a && ACTIVE.has(a.recommendation)
  }
  const steps: RoadmapStep[] = []
  const labUnit = c.researchUnit === 'lab' || c.researchUnit === 'dept'
  const techTarget = on('venture') || on('innobiz')
  // 연구소가 다음 인증의 바탕일 때만 맨 앞 — 이미 전담부서가 있어 '전환 검토' 인 연구소는 뒤로(AX)
  const labFirst = on('lab') && techTarget && !labUnit
  if (labFirst) steps.push({ id: 'lab', label: '기업부설연구소', why: '벤처(연구개발유형) · 이노비즈 평가의 바탕 — 연구조직이 먼저 있어야 다음이 쉽습니다.' })
  if (techTarget && c.patents === 0) steps.push({ id: 'patent', label: '특허 보강', why: '기술 성과 증빙이 약합니다 — 출원 1건이라도 있으면 벤처 · 이노비즈 평가가 달라집니다.' })
  if (on('venture')) steps.push({ id: 'venture', label: '벤처기업', why: by.get('venture')!.oneLine })
  if (on('innobiz')) steps.push({ id: 'innobiz', label: '이노비즈', why: on('venture') ? '벤처 확인 뒤 기술혁신 체계를 인정받는 다음 단계.' : by.get('innobiz')!.oneLine })
  if (on('mainbiz') && by.get('mainbiz')!.recommendation !== 'after_fix') steps.push({ id: 'mainbiz', label: '메인비즈', why: on('innobiz') ? '이노비즈와 함께 경영혁신도 인정받으려면.' : by.get('mainbiz')!.oneLine })
  if (on('lab') && !labFirst) steps.push({ id: 'lab', label: '기업부설연구소', why: c.researchUnit === 'dept' ? '전담부서가 있어 인원이 늘면 연구소로 바꿀 수 있습니다 — 세액공제 · 다른 인증에 함께 쓰입니다.' : '연구 인력 조건이 맞아 지금 갖춰 두면 세액공제 · 다른 인증에 함께 쓰입니다.' })
  if (c.policyFundPlan && steps.length) steps.push({ id: 'policy_fund', label: '정책자금', why: '인증을 받은 뒤 신청하면 보증 · 우대를 함께 쓸 수 있습니다.' })
  if (on('iso9001') && (c.b2b || c.procurement)) steps.push({ id: 'iso9001', label: 'ISO 9001', why: '거래처 · 입찰에서 품질 체계를 보여 줄 때.' })
  const later = list
    .filter((a) => a.recommendation === 'too_early')
    .map((a) => ({ label: a.label, when: a.oneLine.replace(/^업력 3년 이상부터( 신청 가능)?\s*—?\s*/, '') || '업력이 차면' }))
  return { steps: steps.slice(0, 6), later }
}
