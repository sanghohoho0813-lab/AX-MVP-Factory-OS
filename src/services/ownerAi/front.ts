/**
 * AX 화면 스튜디오 엔진 — AI 가 준 UI 명세를 화면이 그릴 수 있게 다듬는다(이미지 생성 없음 · 글자는 OS 가 그린다).
 * 미래AI랩 AX Front 원칙: PC 핵심 대시보드 1 · 모바일 핵심 화면 2 · 큰 글자 · KPI 3~4 · 정보 과다 금지.
 */
type O = Record<string, unknown>
const obj = (v: unknown): O => (v && typeof v === 'object' && !Array.isArray(v) ? (v as O) : {})
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const str = (v: unknown, n = 120): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '').slice(0, n)

export interface FrontKpi {
  label: string
  value: string
  hint: string
}
export interface FrontSection {
  title: string
  kind: 'kpi' | 'table' | 'list' | 'chart'
  items: string[]
}
export interface FrontBlock {
  title: string
  lines: string[]
}
export interface FrontMobile {
  title: string
  purpose: string
  blocks: FrontBlock[]
}
export interface FrontSpec {
  appName: string
  userType: string
  oneLine: string
  kpis: FrontKpi[]
  navigation: string[]
  dashboardTitle: string
  sections: FrontSection[]
  table: { title: string; columns: string[]; rows: string[][] }
  mobile1: FrontMobile
  mobile2: FrontMobile
}

const KINDS = ['kpi', 'table', 'list', 'chart'] as const

function mobile(v: unknown, fallback: string): FrontMobile {
  const o = obj(v)
  return {
    title: str(o.title, 40) || fallback,
    purpose: str(o.purpose, 80),
    blocks: arr(o.blocks).slice(0, 4).map((b) => ({ title: str(obj(b).title, 40), lines: arr(obj(b).lines).map((l) => str(l, 80)).filter(Boolean).slice(0, 4) })),
  }
}

export function frontFrom(v: unknown): FrontSpec {
  const o = obj(v)
  if (Array.isArray(o.sections) && 'dashboardTitle' in o) {
    // 이미 다듬은 모양(고친 글)
    const s = o as unknown as FrontSpec
    return { ...s, mobile1: mobile(s.mobile1, '모바일 1'), mobile2: mobile(s.mobile2, '모바일 2') }
  }
  const d = obj(o.dashboard)
  const t = obj(o.table)
  const columns = arr(t.columns).map((c) => str(c, 24)).filter(Boolean).slice(0, 6)
  return {
    appName: str(o.appName, 40) || 'AX 서비스',
    userType: str(o.userType, 60),
    oneLine: str(o.oneLine, 120),
    kpis: arr(o.kpis).slice(0, 4).map((k) => ({ label: str(obj(k).label, 24), value: str(obj(k).value, 20), hint: str(obj(k).hint, 40) })),
    navigation: arr(o.navigation).map((n) => str(n, 16)).filter(Boolean).slice(0, 7),
    dashboardTitle: str(d.title, 40) || '대시보드',
    sections: arr(d.sections).slice(0, 4).map((x) => {
      const k = str(obj(x).kind, 10) as FrontSection['kind']
      return { title: str(obj(x).title, 40), kind: (KINDS as readonly string[]).includes(k) ? k : 'list', items: arr(obj(x).items).map((i) => str(i, 80)).filter(Boolean).slice(0, 6) }
    }),
    table: { title: str(t.title, 40), columns, rows: arr(t.rows).slice(0, 6).map((r) => arr(r).map((c) => str(c, 40)).slice(0, columns.length || 6)) },
    mobile1: mobile(o.mobile1, '모바일 1'),
    mobile2: mobile(o.mobile2, '모바일 2'),
  }
}

/** 다 비었는지(그릴 것이 없으면 화면이 안내만) */
export function frontIsEmpty(s: FrontSpec): boolean {
  return s.kpis.length === 0 && s.sections.length === 0 && s.mobile1.blocks.length === 0 && s.mobile2.blocks.length === 0
}
