/**
 * AI 결과(구조 JSON) → 사람이 읽는 글(Markdown) · 한 줄 요약.
 * 저장할 때 둘 다 남긴다(ai_runs.structured_output + rendered_output). 모양이 맞지 않으면 원문을 그대로.
 */
import { CONTEXT_FIELDS, FACT_LABEL, type AiRun, type CaseFactKey, type SkillId } from './types'
import { skillName } from './skillCatalog'

type O = Record<string, unknown>
const obj = (v: unknown): O => (v && typeof v === 'object' && !Array.isArray(v) ? (v as O) : {})
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '')
const strs = (v: unknown): string[] => arr(v).map(str).filter(Boolean)
const list = (title: string, items: string[]) => (items.length ? [`**${title}**`, ...items.map((x) => `- ${x}`), ''] : [])
const line = (label: string, v: unknown) => (str(v) ? [`- ${label}: ${str(v)}`] : [])

export const PATENT_WARNING = '내부 아이디어 정리용이며 실제 특허성/권리범위는 선행기술조사 및 변리사 검토가 필요합니다.'

export const VENTURE_SECTION_TITLE: Record<string, string> = {
  basic: '회사 기본정보',
  problem: '해결하려는 문제',
  product: '제품 · 서비스',
  tech: '기술 · 차별성',
  market: '시장',
  growth: '매출 · 성장',
  rnd: '연구개발',
  ip: '지식재산',
  proof: '실증 · 성과',
}

export const FUNDING_BASIS = ['업체 사실', '내부 사례', '최신 외부', 'AI 추정', '미확인'] as const

/** 근거 종류를 다섯 중 하나로(이상한 값은 '미확인') — 근거 없는 확신을 막는다 */
export function fundingBasis(v: unknown): (typeof FUNDING_BASIS)[number] {
  const s = str(v)
  return (FUNDING_BASIS as readonly string[]).includes(s) ? (s as (typeof FUNDING_BASIS)[number]) : '미확인'
}

function axItem(title: string, it: O): string[] {
  return [
    `### ${title}: ${str(it.title)}`,
    str(it.why) ? `${str(it.why)}` : '',
    ...line('지금', it.before),
    ...line('바뀐 뒤', it.after),
    ...line('난이도', it.difficulty),
    ...line('MVP 범위', it.mvpScope),
    ...(strs(it.coreFeatures).length ? [`- 핵심 기능: ${strs(it.coreFeatures).join(' · ')}`] : []),
    ...(strs(it.dataNeeded).length ? [`- 필요한 데이터: ${strs(it.dataNeeded).join(' · ')}`] : []),
    ...(strs(it.risks).length ? [`- 리스크: ${strs(it.risks).join(' · ')}`] : []),
    ...line('특허 연결', it.patentLink),
    ...line('벤처 연결', it.ventureLink),
    ...line('정책지원 연결', it.fundingLink),
    '',
  ].filter((x, i, a) => x !== '' || a[i - 1] !== '')
}

export function renderStructured(skill: SkillId, s: unknown): string {
  const o = obj(s)
  switch (skill) {
    case 'AX_PENGUIN':
      return [
        `## ${str(o.oneLine)}`,
        '',
        ...axItem('가장 추천', obj(o.recommended)),
        ...arr(o.alternatives).flatMap((a, i) => axItem(`차선 ${i + 1}`, obj(a))),
        ...list('12단계로 본 것', arr(o.thinking).map((t) => `${str(obj(t).step)}. ${str(obj(t).title)} — ${str(obj(t).finding)}`)),
        ...list('주의', strs(o.cautions)),
        ...list('확인할 것', strs(o.unknowns)),
      ].join('\n').trim()
    case 'AX_IDEA':
      return [`## ${str(o.oneLine)}`, '', ...arr(o.items).flatMap((x, i) => { const it = obj(x); return [`### ${i + 1}. ${str(it.title)}${it.quickWin === true ? ' (빨리 됨)' : ''}`, ...line('문제', it.problem), ...line('아이디어', it.idea), ...line('쓰는 사람', it.users), ...line('난이도', it.difficulty), ...line('얻는 것', it.value), ...(strs(it.dataNeeded).length ? [`- 데이터: ${strs(it.dataNeeded).join(' · ')}`] : []), ''] }), ...list('확인할 것', strs(o.unknowns))].join('\n').trim()
    case 'AX_MVP':
      return [
        `## ${str(o.mvpName)} — ${str(o.oneLine)}`,
        ...line('대상', o.target),
        ...line('푸는 문제', o.problem),
        '',
        ...list('사용 흐름', strs(o.coreFlow)),
        ...list('기능', arr(o.features).map((f) => `[${str(obj(f).priority) || '필수'}] ${str(obj(f).name)}${str(obj(f).detail) ? ` — ${str(obj(f).detail)}` : ''}`)),
        ...list('화면', strs(o.screens)),
        ...list('데이터', strs(o.data)),
        ...list('단계', arr(o.phases).map((p) => `${str(obj(p).name)}: ${str(obj(p).scope)}${str(obj(p).duration) ? ` (${str(obj(p).duration)})` : ''}`)),
        ...list('KPI', arr(o.kpis).map((k) => `${str(obj(k).name)}${str(obj(k).howToMeasure) ? ` — ${str(obj(k).howToMeasure)}` : ''}`)),
        ...list('이번에 안 하는 것', strs(o.outOfScope)),
        ...list('리스크', strs(o.risks)),
        ...list('확인할 것', strs(o.unknowns)),
      ].join('\n').trim()
    case 'AX_FRONT': {
      const d = obj(o.dashboard)
      return [
        `## ${str(o.appName)}${str(o.oneLine) ? ` — ${str(o.oneLine)}` : ''}`,
        ...line('사용자', o.userType),
        '',
        ...list('KPI(예시 데이터)', arr(o.kpis).map((k) => `${str(obj(k).label)}: ${str(obj(k).value)}`)),
        ...list(`PC 대시보드 · ${str(d.title)}`, arr(d.sections).map((x) => `${str(obj(x).title)}: ${strs(obj(x).items).join(' · ')}`)),
        ...list(`모바일 1 · ${str(obj(o.mobile1).title)}`, arr(obj(o.mobile1).blocks).map((b) => `${str(obj(b).title)}: ${strs(obj(b).lines).join(' · ')}`)),
        ...list(`모바일 2 · ${str(obj(o.mobile2).title)}`, arr(obj(o.mobile2).blocks).map((b) => `${str(obj(b).title)}: ${strs(obj(b).lines).join(' · ')}`)),
      ].join('\n').trim()
    }
    case 'SANGHO_PROPOSAL':
      return [
        `## 제안서 구성 — ${str(o.purpose)}`,
        ...line('대상', o.audience),
        '',
        ...arr(o.pages).flatMap((p, i) => { const pg = obj(p); return [`### ${i + 1}. ${str(pg.title)}`, str(pg.message), ...strs(pg.bullets).map((b) => `- ${b}`), ...arr(pg.keyNumbers).map((k) => `- [수치] ${str(obj(k).label)}: ${str(obj(k).value)} (${str(obj(k).basis) || '미확인'})`), ...line('시각', pg.visual), ''] }),
        ...list('확인할 것', strs(o.unknowns)),
      ].join('\n').trim()
    case 'PATENT_IDEA':
      return [
        `> ⚠ ${PATENT_WARNING}`,
        '',
        ...arr(o.ideas).flatMap((x, i) => { const it = obj(x); return [`### 아이디어 ${i + 1}. ${str(it.title)}`, ...line('발명의 문제', it.problem), ...line('기존 방식', it.priorArt), ...line('핵심 아이디어', it.coreIdea), ...(strs(it.distinct).length ? [`- 차별적 구성: ${strs(it.distinct).join(' · ')}`] : []), ...(strs(it.dataFlow).length ? [`- 데이터 흐름: ${strs(it.dataFlow).join(' → ')}`] : []), ...(strs(it.procedure).length ? [`- 처리 절차: ${strs(it.procedure).join(' → ')}`] : []), ...line('예상 독립항 포인트', it.independentClaim), ...(strs(it.dependentClaims).length ? [`- 종속항 후보: ${strs(it.dependentClaims).join(' · ')}`] : []), ...line('구현 예', it.embodiment), ...(strs(it.searchKeywords).length ? [`- 선행기술 검색 키워드: ${strs(it.searchKeywords).join(', ')}`] : []), ...(strs(it.risks).length ? [`- 특허성 리스크: ${strs(it.risks).join(' · ')}`] : []), ...line('사업과의 연결', it.businessLink), ''] }),
        ...list('확인할 것', strs(o.unknowns)),
      ].join('\n').trim()
    case 'VENTURE_PLAN': {
      const sec = obj(o.sections)
      return [
        str(o.oneLine) ? `## ${str(o.oneLine)}` : '## 벤처기업확인 사업계획',
        '',
        ...Object.entries(VENTURE_SECTION_TITLE).flatMap(([k, t]) => [`### ${t}`, str(sec[k]) || '미확인', '']),
        ...list('필요 증빙', strs(o.evidenceNeeded)),
        ...list('확인할 것', strs(o.unknowns)),
      ].join('\n').trim()
    }
    case 'FUNDING_STRATEGY':
      return [
        `## ${str(o.oneLine)}`,
        '',
        ...arr(o.items).map((x) => { const it = obj(x); return `- **${str(it.title)}** [${fundingBasis(it.basis)}]${it.needsLatestCheck === true ? ' · 최신 자료 확인 필요' : ''} — ${str(it.detail)}` }),
        '',
        ...list('다음 할 일', strs(o.nextSteps)),
        ...list('최신 자료 확인 필요', strs(o.latestCheck)),
        ...list('확인할 것', strs(o.unknowns)),
      ].join('\n').trim()
    case 'CONSULTANT_MESSAGE':
      return str(o.message)
    case 'FREE_CHAT':
      return str(o.answer)
    case 'CONTEXT_UPDATE':
      return Object.entries(obj(o.proposed)).filter(([, v]) => str(v)).map(([k, v]) => `- ${CONTEXT_FIELDS.find((f) => f.key === k)?.label ?? k}: ${str(v)}`).join('\n')
    case 'PROOFREAD':
      return arr(o.fixes).map((f) => `- ${str(obj(f).where)}: "${str(obj(f).before)}" → "${str(obj(f).after)}"${str(obj(f).reason) ? ` (${str(obj(f).reason)})` : ''}`).join('\n') || '고칠 곳이 없습니다.'
    case 'SNAPSHOT_EXTRACT':
      return [str(o.summary), '', ...arr(o.facts).map((f) => `- ${FACT_LABEL[str(obj(f).key) as CaseFactKey] ?? str(obj(f).key)}: ${str(obj(f).value) || '미확인'}${str(obj(f).source) ? ` (${str(obj(f).source)})` : ''}`)].join('\n').trim()
    default:
      return ''
  }
}

/**
 * D-219: 고친 판을 글로 — 스튜디오에서 고친 제안서 · 화면 글은 구조(글자 아님)로 남아, 결과 카드가 원래 AI 글을 보여 주고 복사했다.
 * 글이면 그대로, 구조면 같은 모양으로 그린다(화면 글은 대시보드 칸 이름만 맞춘다). 못 그리면 ''.
 */
export function revisedText(skill: SkillId, content: unknown): string {
  if (typeof content === 'string') return content
  const c = obj(content)
  if (!Object.keys(c).length) return ''
  const shaped = skill === 'AX_FRONT' ? { ...c, dashboard: { title: c.dashboardTitle, sections: c.sections } } : c
  return renderStructured(skill, shaped)
}

/** 기억 · 다음 호출에 쓸 짧은 요약(채택한 결과는 고친 글이 있으면 그 글) */
export function runSummary(run: Pick<AiRun, 'skillId' | 'structured' | 'rendered' | 'adoptedPart' | 'evaluation'>, revised?: unknown): string {
  const s = obj(revised ?? run.structured)
  const part = obj(run.adoptedPart)
  const idx = typeof part.index === 'number' ? part.index : -1
  const pick = (list: unknown[]) => (idx >= 0 && idx < list.length ? [list[idx]] : list)
  if (typeof revised === 'string') return revised.slice(0, 900)
  switch (run.skillId) {
    case 'AX_PENGUIN': {
      if (idx >= 0) {
        const all = [obj(s.recommended), ...arr(s.alternatives).map(obj)]
        const it = all[idx] ?? all[0]
        return `${str(it.title)} — ${str(it.why)}`
      }
      return `${str(s.oneLine)} / 추천: ${str(obj(s.recommended).title)} — ${str(obj(s.recommended).why)}`
    }
    case 'AX_IDEA':
      return pick(arr(s.items)).map((x) => `${str(obj(x).title)}: ${str(obj(x).idea)}`).join(' / ')
    case 'AX_MVP':
      return `${str(s.mvpName)}: ${str(s.oneLine)} · 필수 기능 ${arr(s.features).filter((f) => str(obj(f).priority) !== '다음').map((f) => str(obj(f).name)).slice(0, 5).join(', ')}`
    case 'PATENT_IDEA':
      return pick(arr(s.ideas)).map((x) => `${str(obj(x).title)} — ${str(obj(x).coreIdea)}`).join(' / ')
    case 'VENTURE_PLAN':
      return `${str(s.oneLine)} · 기술: ${str(obj(s.sections).tech).slice(0, 200)}`
    case 'FUNDING_STRATEGY':
      return `${str(s.oneLine)} · ${arr(s.items).slice(0, 3).map((x) => `${str(obj(x).title)}[${fundingBasis(obj(x).basis)}]`).join(', ')}`
    case 'SANGHO_PROPOSAL':
      return `${str(s.purpose)} · ${arr(s.pages).map((p) => str(obj(p).title)).join(' / ')}`
    case 'AX_FRONT':
      return `${str(s.appName)} — ${str(s.oneLine)}`
    case 'CONSULTANT_MESSAGE':
      return str(s.message).slice(0, 300)
    case 'FREE_CHAT':
      return str(s.memoryCandidate) || str(s.answer).slice(0, 300)
    case 'SNAPSHOT_EXTRACT':
      return str(s.summary).slice(0, 400)
    default:
      return (run.rendered || '').slice(0, 400)
  }
}

export function runTitle(run: Pick<AiRun, 'skillId' | 'skillVersion'>): string {
  return `${skillName(run.skillId)} v${run.skillVersion}`
}

/** 일부 채택할 때 고를 수 있는 부분(추천 · 차선 · 아이디어 · 항목) — 고를 것이 없으면 빈 목록(메모로 남긴다) */
export function runParts(run: Pick<AiRun, 'skillId' | 'structured'>): { index: number; title: string }[] {
  const s = obj(run.structured)
  const titles = (list: unknown[]) => list.map((x, i) => ({ index: i, title: str(obj(x).title) || `${i + 1}번` }))
  switch (run.skillId) {
    case 'AX_PENGUIN': {
      const all = [obj(s.recommended), ...arr(s.alternatives).map(obj)].filter((x) => str(x.title))
      return all.map((x, i) => ({ index: i, title: `${i === 0 ? '추천' : `차선 ${i}`} · ${str(x.title)}` }))
    }
    case 'AX_IDEA':
    case 'FUNDING_STRATEGY':
      return titles(arr(s.items))
    case 'PATENT_IDEA':
      return titles(arr(s.ideas))
    default:
      return []
  }
}
