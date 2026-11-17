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

/** D-272 AX 적합성 판정(기준 문서) — 모르는 값은 그대로 */
export const VERDICT_LABEL: Record<string, string> = {
  FULL_GO: '바로 진행 — 운영형 AX + 단계적 실증',
  LITE: '작게 시작 — 작은 워크플로 · 자동화 · MVP 부터',
  NO_GO_REDESIGN: '지금은 만들지 않음 — 업무 · 가설부터 다시 설계',
  INSUFFICIENT_DATA: '정보 부족 — 확인 질문부터(잠정 결론)',
  // D-625 기준 문서 11-04 개정 — 기존 제품 · SaaS · 규칙 · 최적화가 더 맞을 때
  NO_AX_OTHER_TECH: 'AX 아님 — 다른 기술(기존 SaaS · 규칙 · 최적화 · 통계)이 더 맞음',
}
export const verdictLabel = (v: unknown): string => {
  // D-625 기준 문서 표기 'NO-AX/OTHER-TECH' 도 같은 판정으로
  const k = str(v).toUpperCase().replace(/[\s/-]+/g, '_')
  return VERDICT_LABEL[k] ?? str(v)
}

/** D-625 증거 게이트 상태 — 통과 · 미통과 · 확인 필요(영어로 와도) */
export function gateStatus(v: unknown): string {
  const s = str(v)
  const k = s.toUpperCase().replace(/[\s_-]+/g, '')
  if (/^(PASS|PASSED|OK|통과)$/.test(k)) return '통과'
  if (/^(FAIL|FAILED|NOTPASSED|미통과|불통과)$/.test(k)) return '미통과'
  if (!s || /^(UNKNOWN|CHECK|확인필요|미확인)$/.test(k)) return '확인 필요'
  return s
}

function axItem(title: string, it: O): string[] {
  return [
    `### ${title}: ${str(it.title)}`,
    str(it.why) ? `${str(it.why)}` : '',
    ...line('AI 전에 먼저', it.processFirst),
    ...line('지금', it.before),
    ...line('바뀐 뒤', it.after),
    ...line('방법', it.method),
    ...line('기술 위상', it.techLevel),
    ...line('한 문장', it.oneSentence),
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

/** D-626 자체점검 판정 → 화면 말 */
export function judgeVerdictLabel(v: unknown): string {
  const k = str(v).toUpperCase().replace(/[\s-]+/g, '_')
  return ({ GO: '이대로 개발', FIX: '고치고 개발', HOLD: '더 알아본 뒤', NO_GO: '다시 기획' } as Record<string, string>)[k] ?? (str(v) || '판정 없음')
}

/** D-626 기획서 판 칸(순서 = 화면 · 글 · 서버에 다시 보내는 판) */
export const BOARD_FIELDS: readonly { key: string; label: string; kind: 'text' | 'list' | 'kpi' | 'process' | 'method' }[] = [
  { key: 'verdict', label: '판정', kind: 'text' },
  { key: 'constraint', label: '가장 큰 병목', kind: 'text' },
  { key: 'coreValues', label: '핵심 가치 3', kind: 'list' },
  { key: 'moneyKpis', label: '돈으로 보이는 지표 3', kind: 'kpi' },
  { key: 'conversion', label: '고객이 해야 하는 행동', kind: 'text' },
  { key: 'process', label: '업무 재설계', kind: 'process' },
  { key: 'job', label: '고객이 지금 하려는 일', kind: 'text' },
  { key: 'dataAsset', label: '쌓이는 데이터 자산', kind: 'text' },
  { key: 'eventMap', label: '고객 행동 → 사내 업무', kind: 'list' },
  { key: 'aiMethods', label: 'AI 방식', kind: 'method' },
  { key: 'proofPlan', label: '증명 계획', kind: 'list' },
  { key: 'readiness', label: '고객 화면 · 확장 준비', kind: 'text' },
  { key: 'expansion', label: '뒤에 넓힐 것', kind: 'list' },
  { key: 'moat', label: '만든 뒤 남는 것', kind: 'text' },
  { key: 'risks', label: '위험', kind: 'list' },
  { key: 'notBuilding', label: '이번에 안 만드는 것', kind: 'list' },
]

/** 판 한 칸 → 줄들(빈 칸은 빈 목록) */
export function boardFieldLines(kind: (typeof BOARD_FIELDS)[number]['kind'], v: unknown): string[] {
  if (kind === 'text') return str(v) ? [str(v)] : []
  if (kind === 'list') return strs(v)
  if (kind === 'process') {
    const p = obj(v)
    return [str(p.before) ? `지금: ${str(p.before)}` : '', str(p.after) ? `바뀐 뒤: ${str(p.after)}` : ''].filter(Boolean)
  }
  if (kind === 'kpi')
    return arr(v)
      .map(obj)
      .filter((k) => str(k.name))
      .map((k) => `${str(k.name)} — 지금 ${str(k.baseline) || '미확인'} → 목표 ${str(k.target) || '미정'}${str(k.how) ? ` (재는 법: ${str(k.how)})` : ''}`)
  return arr(v)
    .map(obj)
    .filter((m) => str(m.job))
    .map((m) => `${str(m.job)} — ${str(m.method) || '미정'}${str(m.why) ? ` (${str(m.why)})` : ''}`)
}

/** 기획서 판 → 글(복사 · 서버에 '지금 기획서 판' 으로 다시 보내는 글) */
export function boardText(s: unknown): string {
  const o = obj(s)
  const out: string[] = [`**${str(o.title) || '기획서 판'}**`, ...(str(o.ready) ? [`- 개발로 넘기기: ${str(o.ready)}`] : []), '']
  for (const f of BOARD_FIELDS) {
    const rows = boardFieldLines(f.kind, o[f.key])
    if (!rows.length) continue
    if (rows.length === 1 && f.kind === 'text') out.push(`- ${f.label}: ${rows[0]}`)
    else out.push(`**${f.label}**`, ...rows.map((r) => `- ${r}`), '')
  }
  out.push('', ...list('아직 미정', strs(o.open)), ...list('지난 판에서 바뀐 것', strs(o.changed)))
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

export function renderStructured(skill: SkillId, s: unknown): string {
  const o = obj(s)
  switch (skill) {
    case 'AX_PENGUIN': {
      // D-272 기준 문서대로 — 판정 · 가장 큰 문제 · 12주 · TOP 아이템 · 돈 KPI 3 · 16단계 · 반론 질문 · 지금 만들 것
      const k = obj(o.kpis)
      return [
        `## ${str(o.oneLine)}`,
        '',
        ...line('판정', verdictLabel(o.verdict)),
        ...line('가장 큰 문제', o.primaryConstraint),
        ...line('12주에 증명할 것', o.prove12w),
        ...line('지금 증거 등급', o.evidence),
        '',
        ...axItem('가장 추천', obj(o.recommended)),
        ...arr(o.alternatives).flatMap((a, i) => axItem(`차선 ${i + 1}`, obj(a))),
        ...list('돈 KPI 3', [str(k.cost) && `비용 · 효율: ${str(k.cost)}`, str(k.revenue) && `매출 · 고객: ${str(k.revenue)}`, str(k.scale) && `규모 · 처리 능력: ${str(k.scale)}`].filter(Boolean)),
        ...list(arr(o.thinking).length > 12 ? '16단계로 본 것' : '단계별로 본 것', arr(o.thinking).map((t) => `${str(obj(t).step)}. ${str(obj(t).title)} — ${str(obj(t).finding)}`)),
        ...list('반론 질문', arr(o.challenges).map((d) => { const x = obj(d); return `${str(x.risk) ? `[${str(x.risk)}] ` : ''}${str(x.q)} — ${str(x.answer) || '답 없음'}` }).filter((x) => x.length > 4)),
        ...list('증거 게이트', arr(o.gates).map((g) => { const x = obj(g); return `${str(x.id)} ${gateStatus(x.status)}${str(x.note) ? ` — ${str(x.note)}` : ''}` }).filter((x) => x.trim().length > 2)),
        ...list('지금 만들 것', strs(o.buildNow)),
        ...list('준비할 것', strs(o.prepareNow)),
        ...list('나중에 검증할 것', strs(o.validateLater)),
        ...list('주의', strs(o.cautions)),
        ...list('확인할 것', strs(o.unknowns)),
      ].filter((x, i, a) => x !== '' || a[i - 1] !== '').join('\n').trim()
    }
    case 'AX_IDEA':
      return [`## ${str(o.oneLine)}`, '', ...arr(o.items).flatMap((x, i) => { const it = obj(x); return [`### ${i + 1}. ${str(it.title)}${it.quickWin === true ? ' (빨리 됨)' : ''}`, ...line('문제', it.problem), ...line('아이디어', it.idea), ...line('방법', it.method), ...line('기술 위상', it.techLevel), ...line('쓰는 사람', it.users), ...line('난이도', it.difficulty), ...line('얻는 것', it.value), ...line('12주 증명', it.prove12w), ...(strs(it.dataNeeded).length ? [`- 데이터: ${strs(it.dataNeeded).join(' · ')}`] : []), ''] }), ...list('확인할 것', strs(o.unknowns))].join('\n').trim()
    case 'AX_MVP':
      return [
        `## ${str(o.mvpName)} — ${str(o.oneLine)}`,
        ...line('대상', o.target),
        ...line('푸는 문제', o.problem),
        '',
        ...list('사용 흐름', strs(o.coreFlow)),
        ...list('기능', arr(o.features).map((f) => `[${str(obj(f).priority) || '필수'}${str(obj(f).level) ? ` · ${str(obj(f).level)}` : ''}] ${str(obj(f).name)}${str(obj(f).detail) ? ` — ${str(obj(f).detail)}` : ''}`)),
        ...list('화면', strs(o.screens)),
        ...list('데이터', strs(o.data)),
        ...list('단계', arr(o.phases).map((p) => `${str(obj(p).name)}: ${str(obj(p).scope)}${str(obj(p).duration) ? ` (${str(obj(p).duration)})` : ''}`)),
        ...list('KPI', arr(o.kpis).map((k) => `${str(obj(k).name)}${str(obj(k).howToMeasure) ? ` — ${str(obj(k).howToMeasure)}` : ''}`)),
        ...list('증명할 사건', strs(o.proofEvents)),
        ...list('이번에 안 하는 것', strs(o.outOfScope)),
        ...list('리스크', strs(o.risks)),
        ...list('확인할 것', strs(o.unknowns)),
      ].join('\n').trim()
    case 'AX_FRONT': {
      const d = obj(o.dashboard)
      return [
        `## ${str(o.appName)}${str(o.oneLine) ? ` — ${str(o.oneLine)}` : ''}`,
        ...line('바탕', o.basedOn),
        ...line('사용자', o.userType),
        '',
        ...list('KPI(예시 데이터)', arr(o.kpis).map((k) => `${str(obj(k).label)}: ${str(obj(k).value)}`)),
        ...list(`PC 대시보드 · ${str(d.title)}`, arr(d.sections).map((x) => `${str(obj(x).title)}: ${strs(obj(x).items).join(' · ')}`)),
        ...list(`모바일 1 · ${str(obj(o.mobile1).title)}`, arr(obj(o.mobile1).blocks).map((b) => `${str(obj(b).title)}: ${strs(obj(b).lines).join(' · ')}`)),
        ...list(`모바일 2 · ${str(obj(o.mobile2).title)}`, arr(obj(o.mobile2).blocks).map((b) => `${str(obj(b).title)}: ${strs(obj(b).lines).join(' · ')}`)),
        ...list('확인할 것', strs(o.unknowns)),
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
        ...list('공식 평가 항목별 근거 · 빈 곳', arr(o.criteria).map((c) => { const x = obj(c); return `${str(x.area) ? `[${str(x.area)}] ` : ''}${str(x.item)} — 근거: ${str(x.basis) || '없음'}${str(x.gap) ? ` · 빈 곳: ${str(x.gap)}` : ''}` }).filter((x) => !x.startsWith(' —'))),
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
    // D-626 기획 대화
    case 'PLAN_TALK':
      return [str(o.answer), '', ...list('정해야 할 것', strs(o.questions)), ...list('새로 정해진 것', strs(o.keep))].join('\n').trim()
    case 'PLAN_RESEARCH':
      return [
        o.searched === false ? '(검색 없이 아는 범위로 답함 — 확인 필요)' : '',
        str(o.answer),
        '',
        ...list('찾은 것', arr(o.findings).map(obj).map((f) => `[${[str(f.grade), str(f.kind)].filter(Boolean).join(' · ') || '등급 없음'}] ${str(f.claim)}${str(f.source) ? ` — ${str(f.source)}` : ''}${str(f.note) ? ` → ${str(f.note)}` : ''}`)),
        ...list('못 찾은 것', strs(o.unknowns)),
        ...list('출처(검색 기록)', arr(o.sources).map(obj).map((x) => `${str(x.title)} ${str(x.url)}`.trim()).filter(Boolean)),
        ...list('기획에 남길 것', strs(o.keep)),
      ].join('\n').trim()
    case 'PLAN_JUDGE':
      return [
        `**판정: ${judgeVerdictLabel(o.verdict)}**${str(o.oneLine) ? ` — ${str(o.oneLine)}` : ''}`,
        ...(typeof o.score === 'number' && o.score > 0 ? [`- 전략 점수: ${Math.round(o.score)}점${str(o.scoreWhy) ? ` — ${str(o.scoreWhy)}` : ''}`] : []),
        '',
        ...list('꼭 고칠 것', strs(o.mustFix)),
        ...list('따져 본 것', arr(o.attacks).map(obj).map((a) => `[${str(a.level) || 'P1'}] ${str(a.role) ? `${str(a.role)}: ` : ''}${str(a.point)}${str(a.why) ? ` — ${str(a.why)}` : ''}${str(a.fix) ? ` → ${str(a.fix)}` : ''}`)),
        ...list('다섯 질문', arr(o.five).map(obj).map((f) => `${str(f.q)} → ${str(f.a) || '(답 없음)'}${str(f.state) ? ` (${str(f.state)})` : ''}`)),
        ...list('접거나 다시 설계할 기준', strs(o.stop)),
      ].join('\n').trim()
    case 'PLAN_LOCK':
      return boardText(o)
    case 'DEV_PROMPT':
      return [
        ...line('저장소 이름', o.repoName),
        '',
        ...list('아직 비어 있는 것', strs(o.missing)),
        '**처음 붙여 넣을 말**',
        str(o.firstMessage),
        '',
        '**프롬프트**',
        str(o.prompt),
        '',
        ...list('먼저 만들어 둘 그림', strs(o.assets)),
        ...list('보내기 전 확인', strs(o.checks)),
      ].join('\n').trim()
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
    // D-626 기획 대화 — 채택한 판은 다른 작업(MVP · 화면 · 제안서)이 '대표가 채택한 결과' 로 이어받는다
    case 'PLAN_TALK':
    case 'PLAN_RESEARCH':
      return strs(s.keep).join(' / ') || str(s.answer).slice(0, 300)
    case 'PLAN_JUDGE':
      return [`${judgeVerdictLabel(s.verdict)}${str(s.oneLine) ? ` — ${str(s.oneLine)}` : ''}`, strs(s.mustFix).length ? `꼭 고칠 것: ${strs(s.mustFix).slice(0, 4).join(' / ')}` : ''].filter(Boolean).join(' · ')
    case 'PLAN_LOCK':
      return [
        str(s.title),
        str(s.constraint) ? `병목: ${str(s.constraint)}` : '',
        strs(s.coreValues).length ? `핵심 가치: ${strs(s.coreValues).slice(0, 3).join(' / ')}` : '',
        arr(s.moneyKpis).length ? `지표: ${arr(s.moneyKpis).map(obj).map((k) => str(k.name)).filter(Boolean).slice(0, 3).join(' / ')}` : '',
        strs(s.notBuilding).length ? `안 만드는 것: ${strs(s.notBuilding).slice(0, 3).join(' / ')}` : '',
        strs(s.open).length ? `미정 ${strs(s.open).length}개` : '',
      ].filter(Boolean).join(' · ')
    case 'DEV_PROMPT':
      return `개발 프롬프트 — 저장소 ${str(s.repoName) || '(이름 없음)'}${strs(s.missing).length ? ` · 비어 있는 것 ${strs(s.missing).length}개` : ''}`
    case 'SNAPSHOT_EXTRACT':
      return str(s.summary).slice(0, 400)
    default:
      return (run.rendered || '').slice(0, 400)
  }
}

/**
 * D-624 결과 줄에 보이는 한 줄 — 펼치지 않아도 무엇이 나왔는지.
 * 요약(runSummary) 이 칸이 비어 기호만 남거나 붙여넣은 · 형식이 다른 결과면 원문에서 처음 읽을 만한 줄.
 */
export function runHeadline(run: Pick<AiRun, 'skillId' | 'structured' | 'rendered' | 'adoptedPart' | 'evaluation' | 'status'>, revised?: unknown, max = 140): string {
  const flat = (s: string) =>
    s
      .replace(/[#*_>`|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^(?:[-•·/—:]\s*)+/, '')
      .replace(/(?:\s*[-•·/—:])+$/, '')
      .trim()
  // 이름표(추천: · 필수 기능 · 기술:)만 남은 것은 읽을 거리가 아니다
  const meaningful = (s: string) => (s.replace(/추천:|필수 기능|기술:/g, '').match(/[가-힣A-Za-z0-9]/g) ?? []).length >= 4
  if (run.status !== 'pasted' && run.status !== 'parse_fallback') {
    const s = flat(runSummary(run, revised))
    if (meaningful(s)) return s.slice(0, max)
  }
  const source = typeof revised === 'string' && revised.trim() ? revised : run.rendered || ''
  return (source.split('\n').map(flat).find(meaningful) ?? '').slice(0, max)
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
