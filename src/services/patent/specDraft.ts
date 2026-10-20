/**
 * D-247 특허 명세서 쓰기 — 아이디어 → 권리축 → 구성요소 · 단계 → 도면 → 청구항 뼈대 → 본문 → 복붙용 MD (규칙 · AI 없음).
 *
 * Master v2.9 PART 2 를 그대로 옮긴 것:
 *   8.  특허 아이디어 5개 고정 질문(현재 문제 · 기존 방식 · 차별 구조 · 처리 흐름 · 권리화 포인트) · 8-1 명칭 공식
 *   12-1A 발명의 명칭 = 한글명칭{ENGLISH} 한 문단
 *   12-4B 권리축 잠금 7줄(입력 · 처리 · 중간값/상태 · 판정 · 출력 · 재반영 · 회피 어려운 연결관계)
 *   12-4C 도면 N 은 고정하지 않는다 — 소프트웨어 특허 4~5장 · 역할 프리셋(구성도 · 흐름도 · 차별 관계 · 출력 · 재반영)
 *   12-4F 복붙용 MD(굵은 제목은 구분용 · 입력주의 고정문 · 내부 작업문구 0)
 *   청구항 = 시스템 독립항 1 + 필요한 종속항 + 방법 독립항 1
 *
 * 뼈대 문장은 사람이 고치거나 AI(대표만)가 늘려 쓰는 출발점이다. 고친 글이 있으면 뼈대 대신 그 글을 쓴다.
 * 만든 MD 는 D-245 명세서 점검(checkSpec)으로 곧바로 다시 걸러진다.
 */

/* ------------------------------------------------------------------ */
/* 조사(을/를 · 이/가 · 은/는 · 과/와 · 으로/로)                            */
/* ------------------------------------------------------------------ */

/** 숫자를 읽었을 때 받침: 0 영 · 1 일 · 3 삼 · 6 육 · 7 칠 · 8 팔 → 있음, 2 이 · 4 사 · 5 오 · 9 구 → 없음 */
const DIGIT_BATCHIM: Record<string, number> = { '0': 21, '1': 8, '2': 0, '3': 16, '4': 0, '5': 0, '6': 1, '7': 8, '8': 8, '9': 0 }

/** 끝소리 받침 번호(0 = 없음, 8 = ㄹ). 괄호 · 따옴표 · 공백은 건너뛰고, 괄호 안 부호는 앞말을 본다 */
export function batchimOf(word: string): number {
  let t = String(word ?? '').trim()
  t = t.replace(/\s*\([^()]*\)\s*$/, '') // "마모판정부(530)" → "마모판정부"
  t = t.replace(/["'」』)\]】}\s.]+$/, '')
  const ch = t.slice(-1)
  if (!ch) return 0
  if (/[0-9]/.test(ch)) return DIGIT_BATCHIM[ch]
  const code = ch.charCodeAt(0)
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28
  if (/[LMNRlmnr]/.test(ch)) return 8
  return 0
}

export type JosaPair = '을/를' | '이/가' | '은/는' | '과/와' | '으로/로' | '이다/다'

export function josa(word: string, pair: JosaPair): string {
  const b = batchimOf(word)
  const [withB, withoutB] = pair.split('/')
  if (pair === '으로/로') return b === 0 || b === 8 ? '로' : '으로'
  if (pair === '이다/다') return b === 0 ? '다' : '이다'
  return b === 0 ? withoutB : withB
}

/** 단어 + 조사 */
export const w = (word: string, pair: JosaPair) => `${word}${josa(word, pair)}`

/* ------------------------------------------------------------------ */
/* 모양                                                                  */
/* ------------------------------------------------------------------ */

export interface SpecIdea {
  /** ① 현재 문제 */
  problem: string
  /** ② 기존 방식과 부족한 점 */
  prior: string
  /** ③ 차별 구조 */
  distinct: string
  /** ④ 처리 흐름(입력 → 정리 → 판단 → 출력 → 행동 → 재반영) */
  flow: string
  /** ⑤ 권리화 포인트(경쟁사가 가장 쉽게 베낄 구조) */
  point: string
}

/** 12-4B 권리축 잠금 — 줄마다 '~하는' 으로 쓰면 구성요소 · 단계 뼈대가 바로 나온다 */
export interface SpecAxis {
  input: string
  process: string
  state: string
  judge: string
  output: string
  feedback: string
  link: string
}

export interface SpecComponent {
  /** 부호(110 · 120 …) */
  no: string
  name: string
  /** 하는 일 — '~하는' 꼴(청구항에 그대로 들어간다) */
  does: string
}

export interface SpecStep {
  /** S110 · S120 … */
  no: string
  /** '~하는' 꼴 */
  text: string
}

export type FigRole = 'system' | 'flow' | 'relation' | 'output' | 'loop' | 'custom'

export interface SpecFigure {
  n: number
  role: FigRole
  /** '판정부(140)의 판정 구조' 처럼 무엇을 — 도면의 간단한 설명 · 본문이 함께 쓴다 */
  subject: string
  /** 블록도 · 순서도 · 도면 */
  kind: string
}

export interface DependentSeed {
  /** 꾸밀 구성요소 부호(없으면 시스템 전체) */
  comp: string
  /** '~하는' 꼴 — '상기 X는 (이것) 것을 특징으로 하는' */
  text: string
}

export type SectionKey = 'field' | 'background' | 'problem' | 'solution' | 'effect' | 'detail' | 'abstract'

export const SECTION_LABEL: Record<SectionKey, string> = {
  field: '기술분야',
  background: '발명의 배경이 되는 기술',
  problem: '해결하려는 과제',
  solution: '과제의 해결 수단',
  effect: '발명의 효과',
  detail: '발명을 실시하기 위한 구체적인 내용',
  abstract: '요약',
}

export const SECTION_KEYS: readonly SectionKey[] = ['field', 'background', 'problem', 'solution', 'effect', 'detail', 'abstract']

export interface SpecDraft {
  v: 1
  /** 한글 명칭(시스템 및 방법까지) */
  title: string
  /** 영문 명칭 — 대문자 권장 */
  titleEn: string
  idea: SpecIdea
  axis: SpecAxis
  /** 100 번 — 시스템 이름(비우면 명칭의 시스템 부분) */
  systemName: string
  components: SpecComponent[]
  steps: SpecStep[]
  figures: SpecFigure[]
  /** 대표도 번호 */
  repFig: number
  seeds: DependentSeed[]
  /** 사람이 고친 청구항(비면 뼈대) */
  claims: string[]
  /** 사람이 고친 본문(비면 뼈대) */
  text: Partial<Record<SectionKey, string>>
  /** AI 가 마지막으로 쓴 글 · 고친 칸에 온 새 안 */
  ai: Partial<Record<string, string>>
  suggestion: Partial<Record<string, string>>
  /** 문단 번호 [0001] 붙이기 */
  numbered: boolean
  /** 어디서 왔나(AI 작업실 특허 아이디어 등) */
  source: string
}

export function emptyDraft(): SpecDraft {
  return {
    v: 1,
    title: '',
    titleEn: '',
    idea: { problem: '', prior: '', distinct: '', flow: '', point: '' },
    axis: { input: '', process: '', state: '', judge: '', output: '', feedback: '', link: '' },
    systemName: '',
    components: [],
    steps: [],
    figures: defaultFigures(4),
    repFig: 1,
    seeds: [],
    claims: [],
    text: {},
    ai: {},
    suggestion: {},
    numbered: true,
    source: '',
  }
}

/** 저장된 것을 안전하게 읽는다(모르는 값 · 빠진 칸 채움) */
export function normalizeDraft(v: unknown): SpecDraft {
  const d = emptyDraft()
  if (!v || typeof v !== 'object') return d
  const o = v as Partial<SpecDraft>
  const str = (x: unknown) => (typeof x === 'string' ? x : '')
  const rec = <T extends object>(base: T, x: unknown): T => {
    const out = { ...base }
    if (x && typeof x === 'object') for (const k of Object.keys(base)) (out as Record<string, string>)[k] = str((x as Record<string, unknown>)[k])
    return out
  }
  return {
    v: 1,
    title: str(o.title),
    titleEn: str(o.titleEn),
    idea: rec(d.idea, o.idea),
    axis: rec(d.axis, o.axis),
    systemName: str(o.systemName),
    components: Array.isArray(o.components) ? o.components.map((c) => ({ no: str(c?.no), name: str(c?.name), does: str(c?.does) })) : [],
    steps: Array.isArray(o.steps) ? o.steps.map((s) => ({ no: str(s?.no), text: str(s?.text) })) : [],
    figures: Array.isArray(o.figures) && o.figures.length ? o.figures.map((f, i) => ({ n: i + 1, role: (['system', 'flow', 'relation', 'output', 'loop', 'custom'] as FigRole[]).includes(f?.role as FigRole) ? (f.role as FigRole) : 'custom', subject: str(f?.subject), kind: str(f?.kind) || '도면' })) : d.figures,
    repFig: typeof o.repFig === 'number' && o.repFig >= 1 ? Math.floor(o.repFig) : 1,
    seeds: Array.isArray(o.seeds) ? o.seeds.map((s) => ({ comp: str(s?.comp), text: str(s?.text) })) : [],
    claims: Array.isArray(o.claims) ? o.claims.map(str) : [],
    text: o.text && typeof o.text === 'object' ? Object.fromEntries(SECTION_KEYS.map((k) => [k, str((o.text as Record<string, unknown>)[k])]).filter(([, x]) => x)) : {},
    ai: o.ai && typeof o.ai === 'object' ? Object.fromEntries(Object.entries(o.ai).map(([k, x]) => [k, str(x)])) : {},
    suggestion: o.suggestion && typeof o.suggestion === 'object' ? Object.fromEntries(Object.entries(o.suggestion).map(([k, x]) => [k, str(x)]).filter(([, x]) => x)) : {},
    numbered: o.numbered !== false,
    source: str(o.source),
  }
}

/* ------------------------------------------------------------------ */
/* 명칭                                                                  */
/* ------------------------------------------------------------------ */

/** 8-1 명칭 공식: [대상/데이터] 기반 [핵심 판단·처리] 및 [실행·결과] 시스템 및 방법 */
export function titleFromFormula(target: string, judge: string, result: string, kind = '시스템 및 방법'): string {
  const parts = [target.trim() ? `${target.trim()} 기반` : '', judge.trim(), result.trim() ? `및 ${result.trim()}` : '', kind.trim()].filter(Boolean)
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

/** '… 시스템 및 방법' → 시스템 쪽 · 방법 쪽 이름 */
export function titleParts(title: string): { system: string; method: string } {
  const t = (title || '').trim()
  if (!t) return { system: '시스템', method: '방법' }
  const m = /^(.*?)(시스템|장치)\s*및\s*(그\s*)?방법$/.exec(t)
  if (m) return { system: `${m[1]}${m[2]}`.trim(), method: `${m[1]}방법`.trim() }
  if (/(시스템|장치)$/.test(t)) return { system: t, method: t.replace(/(시스템|장치)$/, '방법') }
  if (/방법$/.test(t)) return { system: t.replace(/방법$/, '시스템'), method: t }
  return { system: `${t} 시스템`, method: `${t} 방법` }
}

/** 12-1A — 한글{ENGLISH} 한 문단 */
export function titleLine(d: Pick<SpecDraft, 'title' | 'titleEn'>): string {
  const en = (d.titleEn || '').trim().replace(/[{}]/g, '')
  return en ? `${d.title.trim()}{${en}}` : d.title.trim()
}

export interface TitleIssue {
  id: string
  level: 'error' | 'warn'
  text: string
}

/** 명칭 점검 — 편집기 오류(E-262 · E-266 · E-267 · E-268)를 미리 */
export function checkTitle(d: Pick<SpecDraft, 'title' | 'titleEn'>): TitleIssue[] {
  const out: TitleIssue[] = []
  const t = d.title.trim()
  const en = d.titleEn.trim()
  if (!t) out.push({ id: 'T_EMPTY', level: 'error', text: '한글 명칭이 비어 있습니다' })
  if (/\n/.test(d.title) || /\n/.test(d.titleEn)) out.push({ id: 'T_LINES', level: 'error', text: '명칭은 한 문단이어야 합니다(E-262) — 줄바꿈을 지우세요' })
  if (!en) out.push({ id: 'T_EN', level: 'error', text: '영문 명칭이 없습니다 — 한글명칭{ENGLISH} 모양이어야 합니다(E-266)' })
  if (en && /[^A-Za-z0-9 ,.\-'()/&;:]/.test(en)) out.push({ id: 'T_EN_CHAR', level: 'warn', text: '영문 명칭에 영문 · 숫자 · 기본 기호 밖의 글자가 있습니다(E-267 위험)' })
  if (/[{}]/.test(d.titleEn) || /[{}]/.test(d.title)) out.push({ id: 'T_BRACE', level: 'warn', text: '중괄호는 자동으로 붙입니다 — 칸에는 빼고 적으세요(E-268 예방)' })
  if (/영문\s*명|English\s*Title/i.test(`${t} ${en}`)) out.push({ id: 'T_LABEL', level: 'error', text: "'영문명:' · 'English Title:' 같은 라벨을 넣지 않습니다" })
  if (t && !/(시스템|방법|장치)$/.test(t)) out.push({ id: 'T_KIND', level: 'warn', text: '명칭 끝이 시스템 · 방법 · 장치가 아닙니다 — 기술구조가 읽히게(마케팅 문구 금지)' })
  if (/혁신|최고|스마트한|획기적|AI\s*플랫폼$/.test(t)) out.push({ id: 'T_MARKETING', level: 'warn', text: '마케팅 말(혁신 · 최고 · 획기적)은 명칭에 쓰지 않습니다' })
  return out
}

/* ------------------------------------------------------------------ */
/* 권리축 → 구성요소 · 단계 뼈대                                          */
/* ------------------------------------------------------------------ */

const AXIS_ORDER: readonly { key: keyof SpecAxis; name: string; label: string }[] = [
  { key: 'input', name: '데이터 수집부', label: '핵심 입력' },
  { key: 'process', name: '데이터 처리부', label: '핵심 처리' },
  { key: 'state', name: '상태 갱신부', label: '핵심 중간값 · 상태 갱신' },
  { key: 'judge', name: '판정부', label: '핵심 판정' },
  { key: 'output', name: '결과 제공부', label: '핵심 출력' },
  { key: 'feedback', name: '피드백 반영부', label: '실행결과 재반영' },
]
export const AXIS_LABEL: Record<keyof SpecAxis, string> = { ...Object.fromEntries(AXIS_ORDER.map((a) => [a.key, a.label])), link: '경쟁사가 피하기 어려운 연결관계' } as Record<keyof SpecAxis, string>

/** 자유 글 → '~하는' 꼴(청구항 · 단계에 그대로 넣을 수 있게) */
export function asAdnominal(text: string): string {
  let t = String(text ?? '').trim().replace(/[.。]+$/, '').trim()
  if (!t) return ''
  if (/는$/.test(t)) return t
  if (/한다$/.test(t)) return t.replace(/한다$/, '하는')
  if (/된다$/.test(t)) return t.replace(/된다$/, '되는')
  if (/하다$/.test(t)) return t.replace(/하다$/, '하는')
  if (/되다$/.test(t)) return t.replace(/되다$/, '되는')
  if (/함$/.test(t)) return t.replace(/함$/, '하는')
  if (/됨$/.test(t)) return t.replace(/됨$/, '되는')
  return `${w(t, '을/를')} 수행하는`
}

/** 권리축 7줄 → 구성요소(110~) · 단계(S110~) — 빈 줄은 건너뛴다 */
export function skeletonFromAxis(axis: SpecAxis): { components: SpecComponent[]; steps: SpecStep[] } {
  const components: SpecComponent[] = []
  const steps: SpecStep[] = []
  let i = 0
  for (const a of AXIS_ORDER) {
    const does = asAdnominal(axis[a.key])
    if (!does) continue
    i += 1
    components.push({ no: String(100 + i * 10), name: a.name, does })
    steps.push({ no: `S${100 + i * 10}`, text: does })
  }
  return { components, steps }
}

/* ------------------------------------------------------------------ */
/* 도면                                                                  */
/* ------------------------------------------------------------------ */

const ROLE_DEFAULT: Record<FigRole, { kind: string; label: string }> = {
  system: { kind: '블록도', label: '전체 시스템 구성도' },
  flow: { kind: '순서도', label: '핵심 처리 흐름도' },
  relation: { kind: '도면', label: '차별화 관계 · 판정 구조' },
  output: { kind: '도면', label: '역할별 출력 · 시퀀스' },
  loop: { kind: '도면', label: '실행결과 재반영 · 재산정' },
  custom: { kind: '도면', label: '직접 정함' },
}
export const FIG_ROLE_LABEL: Record<FigRole, string> = Object.fromEntries(Object.entries(ROLE_DEFAULT).map(([k, v]) => [k, v.label])) as Record<FigRole, string>

/** 12-4C 권장 역할 프리셋 — 4장(구성 · 흐름 · 차별 관계 · 출력), 5장이면 재반영 */
export function defaultFigures(n: number): SpecFigure[] {
  const roles: FigRole[] = ['system', 'flow', 'relation', 'output', 'loop', 'custom']
  const count = Math.max(2, Math.min(6, Math.floor(n) || 4))
  return roles.slice(0, count).map((role, i) => ({ n: i + 1, role, subject: '', kind: ROLE_DEFAULT[role].kind }))
}

/** 도면이 무엇을 보여 주는지 — 사람이 비워 두면 역할과 구성요소로 정한다 */
export function figureSubject(d: SpecDraft, f: SpecFigure): string {
  if (f.subject.trim()) return f.subject.trim()
  const { system, method } = titleParts(d.title)
  const sys = sysName(d)
  const judge = d.components.find((c) => /판정|판단|산출|분석|예측|추천/.test(c.name)) ?? d.components[Math.min(3, d.components.length - 1)]
  const out = d.components.find((c) => /제공|출력|알림|표시/.test(c.name))
  switch (f.role) {
    case 'system':
      return `${sys || system}(100)의 전체 구성`
    case 'flow':
      return `${method}의 처리 흐름`
    case 'relation':
      return judge ? `${judge.name}(${judge.no})의 판정 구조` : '핵심 판정 구조'
    case 'output':
      return out ? `${out.name}(${out.no})의 결과 제공 및 사용자 조치 흐름` : '결과 제공 및 사용자 조치 흐름'
    case 'loop':
      return '실행결과의 재반영 및 재산정 흐름'
    default:
      return `도 ${f.n}의 구성`
  }
}

const sysName = (d: SpecDraft) => (d.systemName || '').trim() || titleParts(d.title).system

/** '도 1은 본 발명의 일 실시예에 따른 …을 나타낸 블록도이다.' */
export function drawingDescLines(d: SpecDraft): string[] {
  return d.figures.map((f) => {
    const subject = figureSubject(d, f)
    return `도 ${f.n}${josa(String(f.n), '은/는')} 본 발명의 일 실시예에 따른 ${w(subject, '을/를')} 나타낸 ${f.kind || '도면'}이다.`
  })
}

/** 부호의 설명 — 100 시스템 + 구성요소 */
export function signLines(d: SpecDraft): string[] {
  const lines = [`100: ${sysName(d)}`]
  for (const c of d.components) if (c.no.trim() && c.name.trim()) lines.push(`${c.no.trim()}: ${c.name.trim()}`)
  return lines
}

/* ------------------------------------------------------------------ */
/* 청구항 뼈대                                                            */
/* ------------------------------------------------------------------ */

/** 글 속 나열 — A, B 및 C */
function listProse(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} 및 ${items[items.length - 1]}`
}

/** A; B; 및 C; — 마지막 앞에 '및' */
function listWithAnd(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join('; ')}; 및 ${items[items.length - 1]}`
}

/** 시스템 독립항 1 + 종속항(씨앗) + 방법 독립항 1 */
export function claimSkeleton(d: SpecDraft): string[] {
  const { system, method } = titleParts(d.title)
  const comps = d.components.filter((c) => c.name.trim())
  const claims: string[] = []
  if (comps.length) claims.push(`${listWithAnd(comps.map((c) => `${(c.does || '').trim()} ${c.name.trim()}`.trim()))};${josa(comps[comps.length - 1].name, '을/를')} 포함하는 ${system}.`)
  for (const s of d.seeds) {
    const text = asAdnominal(s.text)
    if (!text) continue
    const c = comps.find((x) => x.no === s.comp)
    const head = c ? `상기 ${w(c.name.trim(), '은/는')} ` : ''
    claims.push(`청구항 1에 있어서, ${head}${text} 것을 특징으로 하는 ${system}.`)
  }
  const steps = d.steps.filter((s) => s.text.trim())
  if (steps.length) claims.push(`컴퓨터에 의해 수행되는 방법으로서, ${listWithAnd(steps.map((s) => `${asAdnominal(s.text)} 단계`))};를 포함하는 ${method}.`)
  return claims
}

/** 실제로 쓸 청구항 — 고친 것이 있으면 그것 */
export function claimsOf(d: SpecDraft): string[] {
  const edited = d.claims.map((c) => c.trim()).filter(Boolean)
  return edited.length ? edited : claimSkeleton(d)
}

/* ------------------------------------------------------------------ */
/* 본문 뼈대                                                              */
/* ------------------------------------------------------------------ */

const paras = (...xs: (string | false | null | undefined)[]) => xs.filter((x): x is string => !!x && !!x.trim()).join('\n\n')

export function sectionSkeleton(d: SpecDraft, key: SectionKey): string {
  const { system, method } = titleParts(d.title)
  const sys = sysName(d)
  const comps = d.components.filter((c) => c.name.trim())
  const steps = d.steps.filter((s) => s.text.trim())
  const title = d.title.trim() || '이 발명'
  switch (key) {
    case 'field':
      return `본 발명은 ${title}에 관한 것이다.`
    case 'background':
      return paras(d.idea.prior.trim() && d.idea.prior.trim(), d.idea.problem.trim() && d.idea.problem.trim())
    case 'problem':
      return paras(`본 발명은 상술한 문제점을 해결하기 위한 것으로, ${w(title, '을/를')} 제공하는 것을 목적으로 한다.`, d.idea.distinct.trim() && `특히 ${d.idea.distinct.trim()}`)
    case 'solution': {
      const c1 = comps.length ? `상기 목적을 달성하기 위한 본 발명의 일 실시예에 따른 ${w(system, '은/는')} ${listProse(comps.map((c) => `${c.does.trim()} ${c.name.trim()}`))}${josa(comps[comps.length - 1].name, '을/를')} 포함한다.` : ''
      const m1 = steps.length ? `또한 본 발명의 일 실시예에 따른 ${w(method, '은/는')} ${listProse(steps.map((s) => `${asAdnominal(s.text)} 단계`))}${josa('단계', '을/를')} 포함한다.` : ''
      return paras(c1, m1)
    }
    case 'effect':
      return paras(d.idea.distinct.trim() && `본 발명에 따르면, ${d.idea.distinct.trim()}`, d.axis.output.trim() && `또한 ${d.axis.output.trim()}`)
    case 'detail': {
      const lines: string[] = ['이하, 첨부된 도면을 참조하여 본 발명의 실시예를 상세히 설명한다.']
      if (comps.length) lines.push(`도 1${josa('1', '을/를')} 참조하면, 본 발명의 일 실시예에 따른 ${sys}(100)${josa(sys, '은/는')} ${listProse(comps.map((c) => `${c.name.trim()}(${c.no})`))}${josa(comps[comps.length - 1].name, '을/를')} 포함한다.`)
      for (const c of comps) lines.push(`${c.name.trim()}(${c.no})${josa(c.name, '은/는')} ${c.does.trim()} 역할을 한다.`)
      if (steps.length) {
        lines.push(`도 2${josa('2', '을/를')} 참조하면, 본 발명의 일 실시예에 따른 ${w(method, '은/는')} 다음 단계로 이루어진다.`)
        for (const s of steps) lines.push(`단계 ${s.no}에서는 ${asAdnominal(s.text)} 처리를 수행한다.`)
      }
      for (const f of d.figures.filter((x) => x.n > 2)) lines.push(`도 ${f.n}${josa(String(f.n), '을/를')} 참조하여 ${w(figureSubject(d, f), '을/를')} 설명한다.`)
      if (d.axis.link.trim()) lines.push(`본 실시예에서 ${d.axis.link.trim()}`)
      return lines.join('\n\n')
    }
    case 'abstract': {
      const head = `본 발명은 ${title}에 관한 것으로,`
      const body = comps.length ? ` ${w(sys, '은/는')} ${comps.map((c) => `${c.name.trim()}(${c.no})`).join(', ')}${josa(comps[comps.length - 1].name, '을/를')} 포함한다.` : ''
      return `${head}${body}`.slice(0, 400)
    }
  }
}

/** 실제로 쓸 본문 — 고친 글 우선 */
export function sectionOf(d: SpecDraft, key: SectionKey): string {
  const t = (d.text[key] ?? '').trim()
  return t || sectionSkeleton(d, key)
}

export const isSkeleton = (d: SpecDraft, key: SectionKey) => !(d.text[key] ?? '').trim()

/* ------------------------------------------------------------------ */
/* 복붙용 MD (12-4F)                                                      */
/* ------------------------------------------------------------------ */

export const MD_NOTICE = [
  '입력 주의',
  '- 굵은 제목은 구분용이다. 편집기에서 정식 식별항목을 만든 뒤 그 아래 본문만 텍스트로 붙여 넣는다.',
  '- 청구항 식별문구를 일반 본문으로 직접 입력하지 않는다.',
  '- 발명의 명칭은 한글명칭{영문명칭} 한 문단으로 입력한다.',
  '- 대표도에는 평문 도 n 만 입력한다.',
  '- 각 도 n 다음에는 이미지 1개만 삽입한다.',
]

/** 본문 → 문단(빈 줄 · 줄바꿈 기준) */
function splitParas(text: string): string[] {
  return String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .split(/\n+/)
    .map((x) => x.trim())
    .filter(Boolean)
}

/**
 * 복붙용 MD. notice=false 면 점검용(입력주의 문장 없이).
 * 문단 번호는 기술분야 ~ 구체적인 내용까지 이어서 [0001] 부터.
 */
export function specMarkdown(d: SpecDraft, opts: { notice?: boolean } = {}): string {
  const out: string[] = []
  let n = 0
  const num = (p: string) => (d.numbered ? `[${String(++n).padStart(4, '0')}] ${p}` : p)
  const head = (name: string) => out.push(`**[${name}]**`)
  const body = (text: string, numbered = true) => {
    for (const p of splitParas(text)) out.push(numbered ? num(p) : p)
  }
  if (opts.notice !== false) out.push(...MD_NOTICE, '')
  head('발명의 설명')
  head('발명의 명칭')
  out.push(titleLine(d))
  head('기술분야')
  body(sectionOf(d, 'field'))
  head('발명의 배경이 되는 기술')
  body(sectionOf(d, 'background') || '(배경기술을 적어 주세요)')
  head('발명의 내용')
  head('해결하려는 과제')
  body(sectionOf(d, 'problem'))
  head('과제의 해결 수단')
  body(sectionOf(d, 'solution'))
  head('발명의 효과')
  body(sectionOf(d, 'effect') || '(발명의 효과를 적어 주세요)')
  if (d.figures.length) {
    head('도면의 간단한 설명')
    for (const l of drawingDescLines(d)) out.push(num(l))
  }
  head('발명을 실시하기 위한 구체적인 내용')
  body(sectionOf(d, 'detail'))
  head('부호의 설명')
  out.push(...signLines(d))
  head('청구범위')
  claimsOf(d).forEach((c, i) => {
    head(`청구항 ${i + 1}`)
    out.push(c)
  })
  head('요약서')
  head('요약')
  out.push(sectionOf(d, 'abstract'))
  if (d.figures.length) {
    head('대표도')
    out.push(`도 ${Math.min(Math.max(1, d.repFig), d.figures.length)}`)
  }
  return out.join('\n') + '\n'
}

/* ------------------------------------------------------------------ */
/* 진행 · 연결 점검(규칙)                                                 */
/* ------------------------------------------------------------------ */

export interface DraftIssue {
  id: string
  level: 'error' | 'warn' | 'info'
  /** 화면 단계(idea · parts · figures · claims · body) */
  step: DraftStep
  text: string
}

export type DraftStep = 'idea' | 'parts' | 'figures' | 'claims' | 'body' | 'check'

/** 2자 이상 낱말(조사 떼기 대충) */
function keywords(text: string): string[] {
  return [...new Set(String(text ?? '').replace(/[^가-힣A-Za-z0-9\s]/g, ' ').split(/\s+/).map((x) => x.replace(/(을|를|이|가|은|는|의|에|와|과|로|으로|에서|하는|되는|한다|된다)$/, '')).filter((x) => x.length >= 2))]
}

const INTERNAL = /\/Devil|Judge|이번 검토|이번 특허에서 가장 중요한|강화 포인트|AI 코멘트|내부 메모|초안 메모|작업용|TODO|TBD|\(.*적어 주세요\)/

export function checkDraft(d: SpecDraft): DraftIssue[] {
  const out: DraftIssue[] = []
  const add = (id: string, level: DraftIssue['level'], step: DraftStep, text: string) => out.push({ id, level, step, text })
  for (const t of checkTitle(d)) add(t.id, t.level, 'idea', t.text)
  const ideaEmpty = (Object.keys(d.idea) as (keyof SpecIdea)[]).filter((k) => !d.idea[k].trim())
  if (ideaEmpty.length) add('IDEA_GAP', 'warn', 'idea', `아이디어 5개 질문 중 ${ideaEmpty.length}개가 비어 있습니다`)
  if (!d.axis.link.trim()) add('AXIS_LINK', 'warn', 'idea', '경쟁사가 피하기 어려운 연결관계(권리축 마지막 줄)가 비어 있습니다 — 독립항의 중심입니다')
  const comps = d.components.filter((c) => c.name.trim())
  if (comps.length < 2) add('PARTS_FEW', 'error', 'parts', '구성요소가 2개보다 적습니다 — 권리축에서 뼈대를 만들거나 직접 넣으세요')
  const nos = comps.map((c) => c.no.trim())
  if (new Set(nos).size !== nos.length) add('PARTS_DUP', 'error', 'parts', '부호가 겹칩니다 — 구성요소마다 다른 번호를 쓰세요')
  if (nos.some((x) => !/^\d{2,4}[a-z]?$/.test(x))) add('PARTS_NO', 'warn', 'parts', '부호는 숫자로(110 · 120 …) 적습니다')
  if (nos.includes('100')) add('PARTS_100', 'warn', 'parts', '100번은 시스템 전체 번호입니다 — 구성요소는 110부터')
  if (comps.some((c) => !c.does.trim())) add('PARTS_DOES', 'warn', 'parts', '하는 일이 빈 구성요소가 있습니다 — 청구항이 이름만 늘어놓게 됩니다')
  const names = comps.map((c) => c.name.trim())
  if (new Set(names).size !== names.length) add('PARTS_NAME', 'error', 'parts', '같은 이름의 구성요소가 있습니다 — 청구항 "상기 …" 가 누구를 가리키는지 흐려집니다')
  if (d.steps.filter((s) => s.text.trim()).length < 2) add('STEPS_FEW', 'warn', 'parts', '방법 단계가 2개보다 적습니다 — 방법 독립항이 약해집니다')
  if (d.figures.length < 2) add('FIG_FEW', 'warn', 'figures', '도면이 2장보다 적습니다 — 소프트웨어 특허는 4~5장을 먼저 검토합니다')
  if (d.figures.length > 6) add('FIG_MANY', 'info', 'figures', '도면이 6장을 넘습니다 — 중복 도면이 없는지 보세요(장수 채우기 금지)')
  if (d.repFig > d.figures.length) add('FIG_REP', 'error', 'figures', `대표도 도 ${d.repFig}${josa(String(d.repFig), '이/가')} 실제 도면에 없습니다`)
  const claims = claimsOf(d)
  if (!claims.length) add('CLAIMS_NONE', 'error', 'claims', '청구항이 없습니다')
  const link = keywords(d.axis.link)
  if (claims[0] && link.length && !link.some((k) => claims[0].includes(k))) add('CLAIM_LINK', 'warn', 'claims', '독립항 1에 핵심 연결관계의 말이 하나도 없습니다 — 실시예에만 있고 독립항에서 빠지지 않았는지 보세요(12-4B)')
  if (claims.length && !claims.some((c) => /방법\.?$/.test(c.trim()))) add('CLAIM_METHOD', 'info', 'claims', '방법 독립항이 없습니다 — 소프트웨어 특허는 시스템 + 방법 독립항을 권장합니다')
  for (const k of SECTION_KEYS) {
    const t = sectionOf(d, k)
    if (INTERNAL.test(t)) add(`BODY_INTERNAL_${k}`, 'error', 'body', `${SECTION_LABEL[k]}에 내부 작업 문구가 남아 있습니다`)
    if (/\*\*|^#+\s/m.test(t)) add(`BODY_MD_${k}`, 'warn', 'body', `${SECTION_LABEL[k]}에 마크다운 기호(** · #)가 있습니다 — 편집기에 그대로 들어갑니다`)
  }
  const skeletonOnly = SECTION_KEYS.filter((k) => isSkeleton(d, k))
  if (skeletonOnly.length) add('BODY_SKELETON', 'info', 'body', `뼈대 문장 그대로인 칸 ${skeletonOnly.length}개 — ${skeletonOnly.map((k) => SECTION_LABEL[k]).join(' · ')}`)
  if (sectionOf(d, 'abstract').length > 400) add('ABSTRACT_LONG', 'warn', 'body', `요약이 ${sectionOf(d, 'abstract').length}자 — 400자 이내 권장`)
  if (/\bAI\b|인공지능|머신러닝|딥러닝/.test(`${d.title} ${claims.join(' ')}`) && !/(학습|모델|신경망|머신러닝|딥러닝|LLM|예측\s*모델)/.test(`${d.axis.process} ${d.axis.judge}`)) add('AI_WORD', 'warn', 'claims', '명칭 · 청구항에 AI 라는 말이 있는데 권리축에 학습 · 모델 처리가 없습니다 — 규칙 · 점수 계산을 AI 라고 쓰지 않습니다(12-2)')
  return out
}

export interface DraftProgress {
  steps: Record<DraftStep, boolean>
  done: number
  total: number
}

export function draftProgress(d: SpecDraft): DraftProgress {
  const comps = d.components.filter((c) => c.name.trim())
  const steps: Record<DraftStep, boolean> = {
    idea: !!d.title.trim() && !!d.titleEn.trim() && Object.values(d.idea).filter((x) => x.trim()).length >= 3,
    parts: comps.length >= 2 && d.steps.filter((s) => s.text.trim()).length >= 2,
    figures: d.figures.length >= 2 && d.repFig <= d.figures.length,
    claims: claimsOf(d).length >= 2,
    body: SECTION_KEYS.filter((k) => !isSkeleton(d, k)).length >= 4,
    check: !checkDraft(d).some((i) => i.level === 'error'),
  }
  const done = Object.values(steps).filter(Boolean).length
  return { steps, done, total: Object.keys(steps).length }
}

/* ------------------------------------------------------------------ */
/* AI 작업실 '특허 아이디어' → 초안                                        */
/* ------------------------------------------------------------------ */

export interface PatentIdeaLike {
  title?: string
  problem?: string
  priorArt?: string
  coreIdea?: string
  distinct?: string[]
  dataFlow?: string[]
  procedure?: string[]
  independentClaim?: string
  dependentClaims?: string[]
}

/** AI 작업실 특허 아이디어 하나로 1단계(아이디어) · 단계 뼈대를 채운다 — 이미 적은 칸은 그대로 */
export function draftFromIdea(base: SpecDraft, idea: PatentIdeaLike, source: string): SpecDraft {
  const keep = (cur: string, next: string) => (cur.trim() ? cur : next.trim())
  const list = (xs?: string[]) => (Array.isArray(xs) ? xs.map((x) => String(x ?? '').trim()).filter(Boolean) : [])
  const procedure = list(idea.procedure)
  const d: SpecDraft = {
    ...base,
    title: keep(base.title, idea.title ?? ''),
    idea: {
      problem: keep(base.idea.problem, idea.problem ?? ''),
      prior: keep(base.idea.prior, idea.priorArt ?? ''),
      distinct: keep(base.idea.distinct, [idea.coreIdea ?? '', ...list(idea.distinct)].filter(Boolean).join(' · ')),
      flow: keep(base.idea.flow, list(idea.dataFlow).join(' → ')),
      point: keep(base.idea.point, idea.independentClaim ?? ''),
    },
    axis: { ...base.axis, link: keep(base.axis.link, idea.independentClaim ?? '') },
    source,
  }
  if (!d.steps.length && procedure.length) d.steps = procedure.slice(0, 8).map((t, i) => ({ no: `S${110 + i * 10}`, text: asAdnominal(t) }))
  if (!d.seeds.length) d.seeds = list(idea.dependentClaims).slice(0, 6).map((t) => ({ comp: '', text: t }))
  return d
}

/* ------------------------------------------------------------------ */
/* AI 초안 합치기 — 사람이 고친 칸은 덮지 않는다                           */
/* ------------------------------------------------------------------ */

export function cleanAiText(t: string): string {
  return String(t ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/^#+\s*/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/^[ \t]*(?:\[\d{4}\]|【\d{4}】)[ \t]*/gm, '')
    .replace(/^[ \t]*[【[](?:청구항\s*\d+|기술분야|요약)[】\]][ \t]*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * 본문 칸(키 = SectionKey) · 청구항(키 = 'claims', 줄마다 하나 — '청구항 n' 머리 없이) AI 안을 합친다.
 * 비어 있거나 AI 가 쓴 그대로면 바꾸고, 사람이 고쳤으면 새 안(suggestion)으로.
 */
export function mergeSpecAi(d: SpecDraft, items: { key: SectionKey | 'claims'; text: string }[]): { draft: SpecDraft; replaced: string[]; kept: string[] } {
  const next: SpecDraft = { ...d, text: { ...d.text }, ai: { ...d.ai }, suggestion: { ...d.suggestion } }
  const replaced: string[] = []
  const kept: string[] = []
  for (const it of items) {
    // 청구항은 머리('청구항 n.' · '[청구항 n]')로 먼저 나눈다 — 머리를 지운 뒤에는 나눌 수 없다
    const claimList = it.key === 'claims' ? splitClaims(String(it.text ?? '').replace(/\*\*/g, '')).map(cleanAiText).filter(Boolean) : []
    const text = it.key === 'claims' ? claimList.join('\n\n') : cleanAiText(it.text)
    if (!text) continue
    const cur = it.key === 'claims' ? d.claims.join('\n\n').trim() : (d.text[it.key] ?? '').trim()
    const human = !!cur && cur !== (d.ai[it.key] ?? '').trim()
    if (human) {
      next.suggestion[it.key] = text
      kept.push(it.key)
      continue
    }
    if (it.key === 'claims') next.claims = claimList
    else next.text[it.key] = text
    next.ai[it.key] = text
    delete next.suggestion[it.key]
    replaced.push(it.key)
  }
  return { draft: next, replaced, kept }
}

/** AI 청구항 글 → 청구항 배열('청구항 n.' · '[청구항 n]' 머리 · 빈 줄로 나눔) */
export function splitClaims(text: string): string[] {
  const t = String(text ?? '').replace(/\r\n?/g, '\n')
  const head = /(?:^|\n)\s*(?:[【[]\s*청구항\s*\d+\s*[】\]]|청구항\s*\d+\s*[.:)]\s)/
  const parts = head.test(t)
    ? t.split(new RegExp(head.source, 'g')).map((x) => x.trim()).filter(Boolean)
    : t.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean)
  return parts.map((x) => x.replace(/\s*\n\s*/g, ' ').trim())
}
