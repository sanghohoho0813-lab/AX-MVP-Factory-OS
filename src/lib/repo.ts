// 데이터 접근 계층 — Supabase 구현 + 개발 전용 메모리 목(mock) 구현.
// 화면은 이 모듈만 사용한다 (supabase 직접 호출 금지) → S2 이후 테이블 추가 시 확장 용이.
// 목 모드는 VITE_DEV_MOCK==='1' 일 때만 활성화 (Supabase 없이 UI 검수용, 운영 금지).
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type {
  ChecklistItem, Company, Industry, Profile, Project, ProjectStage, StageLog, StageLogType,
} from './types'
import { STAGE_TITLES } from './types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
export const DEV_MOCK = import.meta.env.VITE_DEV_MOCK === '1'

export const supabase: SupabaseClient | null =
  !DEV_MOCK && url && anonKey ? createClient(url, anonKey) : null

export const configured = DEV_MOCK || Boolean(supabase)

export type CompanyInput = Omit<Company, 'id' | 'created_at' | 'updated_at' | 'status'> & { status?: Company['status'] }
export type ProjectInput = {
  company_id: string
  name: string
  industry_code: string | null
  target_level: number
  summary: string | null
}
export type StagePatch = Partial<Omit<ProjectStage, 'id' | 'project_id' | 'stage_no' | 'title'>>
export type ProjectPatch = Partial<Pick<Project, 'name' | 'industry_code' | 'current_level' | 'target_level' | 'status' | 'contract_status' | 'summary'>>

// ── 개발 목 저장소 (메모리 — 새로고침 시 초기화) ─────────────────
const mem = {
  industries: [
    { code: 'manufacturing', name: '제조업', parent_code: null, sort: 10, active: true },
    { code: 'distribution', name: '유통·물류업', parent_code: null, sort: 20, active: true },
    { code: 'professional', name: '전문서비스업', parent_code: null, sort: 30, active: true },
    { code: 'prof_consulting', name: '경영컨설팅', parent_code: 'professional', sort: 31, active: true },
    { code: 'prof_hr', name: '노무·인사 지원', parent_code: 'professional', sort: 32, active: true },
    { code: 'prof_tax', name: '세무·회계 지원', parent_code: 'professional', sort: 33, active: true },
    { code: 'prof_sales', name: '법인영업', parent_code: 'professional', sort: 34, active: true },
    { code: 'prof_cert_funding', name: '기업인증·정책자금 지원', parent_code: 'professional', sort: 35, active: true },
  ] as Industry[],
  companies: [] as Company[],
  projects: [] as Project[],
  stages: [] as ProjectStage[],
  logs: [] as StageLog[],
}
let seq = 0
const mid = () => `mock-${++seq}-${Math.random().toString(36).slice(2, 8)}`
const nowIso = () => new Date().toISOString()

function mockSeedStages(projectId: string) {
  STAGE_TITLES.forEach((title, i) => {
    mem.stages.push({
      id: mid(), project_id: projectId, stage_no: i, title, purpose: null,
      status: 'not_started', started_at: null, target_end_at: null, completed_at: null,
      owner_name: null, customer_contact: null, required_materials: null,
      completion_criteria: null, checklist: [], risks: null, hold_reason: null,
      next_action: null, memo: null, customer_confirmed: false, updated_at: nowIso(),
    })
  })
}

function normalizeChecklist(v: unknown): ChecklistItem[] {
  if (!Array.isArray(v)) return []
  return v
    .filter((x): x is ChecklistItem => !!x && typeof x === 'object' && 'label' in x)
    .map((x) => ({ label: String(x.label), done: Boolean(x.done) }))
}

function req<T>(data: T | null, error: { message?: string } | null): T {
  if (error) throw new Error(error.message || '요청에 실패했습니다.')
  if (data == null) throw new Error('데이터를 찾을 수 없습니다.')
  return data
}

// ── 조회 ──────────────────────────────────────────────────────

export async function listIndustries(): Promise<Industry[]> {
  if (DEV_MOCK) return [...mem.industries].sort((a, b) => a.sort - b.sort)
  const { data, error } = await supabase!.from('industries').select('*').eq('active', true).order('sort')
  return req(data, error) as Industry[]
}

export async function listCompanies(): Promise<Company[]> {
  if (DEV_MOCK) return [...mem.companies].sort((a, b) => b.created_at.localeCompare(a.created_at))
  const { data, error } = await supabase!.from('companies').select('*').order('created_at', { ascending: false })
  return req(data, error) as Company[]
}

export async function getCompany(id: string): Promise<Company | null> {
  if (DEV_MOCK) return mem.companies.find((c) => c.id === id) ?? null
  const { data, error } = await supabase!.from('companies').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return (data as Company | null) ?? null
}

export async function listProjects(): Promise<Project[]> {
  if (DEV_MOCK) return [...mem.projects].sort((a, b) => b.updated_at.localeCompare(a.updated_at))
  const { data, error } = await supabase!.from('projects').select('*').order('updated_at', { ascending: false })
  return req(data, error) as Project[]
}

export async function getProject(id: string): Promise<Project | null> {
  if (DEV_MOCK) return mem.projects.find((p) => p.id === id) ?? null
  const { data, error } = await supabase!.from('projects').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return (data as Project | null) ?? null
}

export async function listStages(projectId: string): Promise<ProjectStage[]> {
  if (DEV_MOCK) return mem.stages.filter((s) => s.project_id === projectId).sort((a, b) => a.stage_no - b.stage_no)
  const { data, error } = await supabase!
    .from('project_stages').select('*').eq('project_id', projectId).order('stage_no')
  const rows = req(data, error) as (Omit<ProjectStage, 'checklist'> & { checklist: unknown })[]
  return rows.map((r) => ({ ...r, checklist: normalizeChecklist(r.checklist) }))
}

// 대시보드용: 전체 진행 중 프로젝트의 현재 단계 행 일괄 조회
export async function listCurrentStages(projects: Project[]): Promise<ProjectStage[]> {
  const ids = projects.map((p) => p.id)
  if (ids.length === 0) return []
  if (DEV_MOCK) {
    return mem.stages.filter((s) =>
      projects.some((p) => p.id === s.project_id && p.current_stage === s.stage_no))
  }
  const { data, error } = await supabase!.from('project_stages').select('*').in('project_id', ids)
  const rows = req(data, error) as (Omit<ProjectStage, 'checklist'> & { checklist: unknown })[]
  return rows
    .filter((s) => projects.some((p) => p.id === s.project_id && p.current_stage === s.stage_no))
    .map((r) => ({ ...r, checklist: normalizeChecklist(r.checklist) }))
}

export async function listLogs(projectId: string): Promise<StageLog[]> {
  if (DEV_MOCK) return mem.logs.filter((l) => l.project_id === projectId).sort((a, b) => b.created_at.localeCompare(a.created_at))
  const { data, error } = await supabase!
    .from('stage_logs').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).limit(100)
  return req(data, error) as StageLog[]
}

// ── 쓰기 ──────────────────────────────────────────────────────

export async function createCompany(input: CompanyInput): Promise<Company> {
  if (DEV_MOCK) {
    const row: Company = { ...input, id: mid(), status: input.status ?? 'active', created_at: nowIso(), updated_at: nowIso() }
    mem.companies.push(row)
    return row
  }
  const { data, error } = await supabase!.from('companies').insert(input).select('*').single()
  return req(data, error) as Company
}

export async function updateCompany(id: string, patch: Partial<CompanyInput>): Promise<void> {
  if (DEV_MOCK) {
    const c = mem.companies.find((x) => x.id === id)
    if (c) Object.assign(c, patch, { updated_at: nowIso() })
    return
  }
  const { error } = await supabase!.from('companies').update(patch).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function createProject(input: ProjectInput): Promise<Project> {
  if (DEV_MOCK) {
    const row: Project = {
      id: mid(), company_id: input.company_id, name: input.name, industry_code: input.industry_code,
      current_stage: 0, current_level: 0, target_level: input.target_level,
      status: 'active', contract_status: 'pre', summary: input.summary,
      created_at: nowIso(), updated_at: nowIso(),
    }
    mem.projects.push(row)
    mockSeedStages(row.id)
    return row
  }
  // Stage 0~7 은 DB 트리거(seed_project_stages)가 자동 생성
  const { data, error } = await supabase!.from('projects').insert(input).select('*').single()
  return req(data, error) as Project
}

export async function updateProject(id: string, patch: ProjectPatch): Promise<void> {
  if (DEV_MOCK) {
    const p = mem.projects.find((x) => x.id === id)
    if (p) Object.assign(p, patch, { updated_at: nowIso() })
    return
  }
  const { error } = await supabase!.from('projects').update(patch).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function updateStage(stageId: string, patch: StagePatch): Promise<void> {
  if (DEV_MOCK) {
    const s = mem.stages.find((x) => x.id === stageId)
    if (s) Object.assign(s, patch, { updated_at: nowIso() })
    return
  }
  const { error } = await supabase!.from('project_stages').update(patch).eq('id', stageId)
  if (error) throw new Error(error.message)
}

export async function addLog(projectId: string, stageNo: number, type: StageLogType, content: string): Promise<void> {
  if (DEV_MOCK) {
    mem.logs.push({ id: mid(), project_id: projectId, stage_no: stageNo, type, content, created_at: nowIso() })
    return
  }
  const { error } = await supabase!.from('stage_logs').insert({ project_id: projectId, stage_no: stageNo, type, content })
  if (error) throw new Error(error.message)
}

/** 다음 단계로 이동 — owner 확인 버튼에서만 호출 (자동 진행 금지) */
export async function advanceStage(project: Project, currentStage: ProjectStage): Promise<void> {
  if (project.current_stage >= 7) throw new Error('마지막 단계입니다.')
  const today = new Date().toISOString().slice(0, 10)
  await updateStage(currentStage.id, { status: 'passed', completed_at: today })
  await updateProject(project.id, { })
  if (DEV_MOCK) {
    const p = mem.projects.find((x) => x.id === project.id)
    if (p) { p.current_stage += 1; p.updated_at = nowIso() }
  } else {
    const { error } = await supabase!.from('projects').update({ current_stage: project.current_stage + 1 }).eq('id', project.id)
    if (error) throw new Error(error.message)
  }
  await addLog(project.id, currentStage.stage_no, 'stage_advance',
    `Stage ${currentStage.stage_no} → ${currentStage.stage_no + 1} 진행 (owner 확인)`)
}

// ── 인증 (auth.tsx 에서 사용) ─────────────────────────────────

let mockUser: { id: string; email: string } | null = null

export async function getSessionProfile(): Promise<Profile | null> {
  if (DEV_MOCK) {
    return mockUser ? { id: mockUser.id, role: 'owner', name: '대표(목)', email: mockUser.email } : null
  }
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  const user = data.session?.user
  if (!user) return null
  const { data: prof } = await supabase.from('profiles').select('id, role, name, email').eq('id', user.id).maybeSingle()
  if (!prof) return null
  return prof as Profile
}

export async function signIn(email: string, password: string): Promise<void> {
  if (DEV_MOCK) {
    if (!email || !password) throw new Error('이메일과 비밀번호를 입력해 주세요.')
    mockUser = { id: 'mock-owner', email }
    return
  }
  if (!supabase) throw new Error('Supabase 환경변수(.env)가 설정되지 않았습니다.')
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    throw new Error(error.message === 'Invalid login credentials' ? '이메일 또는 비밀번호가 올바르지 않습니다.' : error.message)
  }
}

export async function signOut(): Promise<void> {
  if (DEV_MOCK) { mockUser = null; return }
  await supabase?.auth.signOut()
}

export async function updateMyName(name: string): Promise<void> {
  if (DEV_MOCK) return
  if (!supabase) return
  const { data } = await supabase.auth.getSession()
  const uid = data.session?.user?.id
  if (!uid) return
  const { error } = await supabase.from('profiles').update({ name }).eq('id', uid)
  if (error) throw new Error(error.message)
}
