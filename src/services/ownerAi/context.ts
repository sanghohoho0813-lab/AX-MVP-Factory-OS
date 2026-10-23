/**
 * 업체 Snapshot(화면 맨 위) · AI 에 보낼 최소 묶음.
 *
 * Snapshot: 확인된 값만 — 없으면 '미확인'(추측해서 채우지 않는다). 값마다 어디서 왔는지(출처).
 * AI 묶음: 업체 자료 전체를 넣지 않는다 → 구조화된 회사 정보 + 지금까지의 기억 + 이 작업에 필요한 자료 일부 + 채택한 결과 요약.
 *   대표자 이름 · 연락처 · 주민번호 · 비밀번호 · 키 · 개인별 4대보험 원문은 보내지 않는다(명부 자료는 통째로 뺀다).
 */
import type { ClientOpsRecord } from '../../types/clientOps'
import { clientFacts } from '../../tools/shared/clientPrefill'
import { buildInsights, manwonText } from '../clientInsights'
import { redactSensitive } from '../../domain/consulting/privacyFilter'
import { stripRrn } from '../../tools/employment/lib/privacy'
import { RELATION_LABEL, type AiRevision, type AiRun, type CaseMaterial, type CompanyCase, type CurrentContext, type MaterialKind, type SkillId, CONTEXT_FIELDS } from './types'
import { runSummary } from './render'
import { skillName } from './skillCatalog'

export const UNKNOWN = '미확인'

export interface SnapshotField {
  key: string
  label: string
  value: string
  source: string
  known: boolean
}

const dateOnly = (iso: string) => (iso ?? '').slice(0, 10)

/** 회사 Snapshot — 이어 둔 고객 기록이 먼저, 다음은 자료에서 읽은 값, 없으면 미확인 */
export function caseSnapshot(c: CompanyCase, client: ClientOpsRecord | null, ctx: CurrentContext | null, runs: readonly AiRun[], today: string): SnapshotField[] {
  const f = client ? clientFacts(client, new Date(`${today}T00:00:00`)) : null
  const fact = (k: keyof CompanyCase['facts']) => {
    const v = c.facts[k]
    return v && v.value && v.value !== UNKNOWN ? v : null
  }
  const out: SnapshotField[] = []
  const put = (key: string, label: string, value: string | null | undefined, source: string) => {
    const v = (value ?? '').toString().trim()
    out.push({ key, label, value: v || UNKNOWN, source: v ? source : '', known: !!v })
  }
  const pick = (...cands: [string | null | undefined, string][]): [string, string] => {
    for (const [v, s] of cands) if (v && String(v).trim()) return [String(v).trim(), s]
    return ['', '']
  }
  put('name', '회사명', c.companyName, client ? '고객 관리' : 'AI 전략실 등록')
  put('industry', '업종', ...pick([f?.industryText, '고객 관리'], [c.industry, 'AI 전략실 등록'], [fact('industry')?.value, `자료 · ${fact('industry')?.source ?? ''}`]))
  const years = f?.years != null && f.establishedAt ? `${f.years}년(설립 ${f.establishedAt})` : null
  put('years', '업력', ...pick([years, '고객 관리'], [fact('founded')?.value, `자료 · ${fact('founded')?.source ?? ''}`]))
  put('ceo', '대표자', ...pick([f?.representativeName, '고객 관리'], [fact('ceo')?.value, `자료 · ${fact('ceo')?.source ?? ''}`]))
  put('employees', '직원수', ...pick([f?.employeeCount != null ? `${f.employeeCount}명` : null, '고객 관리'], [fact('employees')?.value, `자료 · ${fact('employees')?.source ?? ''}`]))
  const rev = f?.revenue ? `${manwonText(f.revenue.won)}${f.revenue.asOf ? `(${f.revenue.asOf})` : ''}${f.revenue.estimated ? ' · 예상' : ''}` : null
  put('revenue', '매출', ...pick([rev, '고객 관리'], [fact('revenue')?.value, `자료 · ${fact('revenue')?.source ?? ''}`]))
  put('homepage', '홈페이지', ...pick([c.homepageUrl, 'AI 전략실 등록'], [client?.homepage, '고객 관리'], [fact('homepage')?.value, `자료 · ${fact('homepage')?.source ?? ''}`]))
  put('requester', '요청자', c.requester, 'AI 전략실 등록')
  put('relation', '관계상태', RELATION_LABEL[c.relation], 'AI 전략실')
  const firstLine = (s: string | undefined) => (s ?? '').split('\n').map((x) => x.replace(/^[-·\s]+/, '').trim()).find(Boolean) ?? ''
  put('problem', '주요 문제', ...pick([firstLine(ctx?.problems), '지금까지의 기억'], [fact('mainProblem')?.value, `자료 · ${fact('mainProblem')?.source ?? ''}`]))
  put('system', '현재 시스템 · 업무방식', ...pick([fact('currentSystem')?.value, `자료 · ${fact('currentSystem')?.source ?? ''}`]))
  const lastAt = [...runs.map((r) => r.createdAt), ...c.activity.map((a) => a.at)].sort().pop() ?? ''
  put('lastWork', '최근 작업일', lastAt ? dateOnly(lastAt) : '', '타임라인')
  const lastAdopted = runs.filter((r) => r.evaluation === 'adopted' || r.evaluation === 'partially_adopted').sort((a, b) => (b.evaluatedAt ?? b.createdAt).localeCompare(a.evaluatedAt ?? a.createdAt))[0]
  put('lastConclusion', '최근 결론', lastAdopted ? `${skillName(lastAdopted.skillId)} — ${runSummary(lastAdopted).slice(0, 160)}` : '', '채택한 결과')
  return out
}

/* ------------------------------------------------------------------ */
/* AI 에 보낼 묶음                                                      */
/* ------------------------------------------------------------------ */

export interface AiContextPayload {
  company: { name: string; fields: { label: string; value: string }[] }
  memory: { version: number; fields: { label: string; value: string }[] }
  diagnosis: string[]
  adopted: { skill: string; version: number; partial: boolean; summary: string }[]
  recent: { skill: string; summary: string }[]
  materials: { title: string; kind: string; text: string }[]
}

const MATERIALS_FOR: Record<SkillId, readonly MaterialKind[] | 'all' | 'none'> = {
  AX_PENGUIN: ['intro', 'company_info', 'bizplan', 'url', 'paste', 'chatgpt', 'memo', 'proposal', 'other'],
  AX_IDEA: ['intro', 'company_info', 'bizplan', 'url', 'paste', 'chatgpt', 'memo', 'other'],
  AX_MVP: ['intro', 'bizplan', 'paste', 'chatgpt', 'memo', 'url'],
  AX_FRONT: ['intro', 'paste', 'memo', 'url'],
  SANGHO_PROPOSAL: ['intro', 'company_info', 'paste', 'chatgpt', 'memo', 'proposal'],
  PATENT_IDEA: ['patent', 'intro', 'bizplan', 'paste', 'chatgpt', 'memo'],
  VENTURE_PLAN: ['bizplan', 'company_info', 'patent', 'intro', 'bizreg', 'registry', 'chatgpt', 'memo'],
  FUNDING_STRATEGY: ['company_info', 'bizreg', 'registry', 'bizplan', 'memo'],
  CONSULTANT_MESSAGE: 'none',
  FREE_CHAT: ['memo', 'paste', 'chatgpt', 'intro', 'url'],
  CONTEXT_UPDATE: 'none',
  PROOFREAD: 'none',
  SNAPSHOT_EXTRACT: 'all',
}

/** 화면 쪽에서 한 번 더 — 주민번호 · 비밀번호 · 키 · 계좌 · 이메일 · 휴대폰 */
export function clean(s: string): string {
  return redactSensitive(stripRrn(s ?? '')).text
}

/** 이 작업에 보낼 자료(최신부터 · 최대 6개 · 명부 제외). materialIds 를 주면 그것만 */
export function materialsFor(skill: SkillId, list: readonly CaseMaterial[], materialIds?: readonly string[]): CaseMaterial[] {
  const rule = MATERIALS_FOR[skill]
  if (rule === 'none' && !materialIds) return []
  const pool = list.filter((m) => !m.excluded && m.text.trim())
  const chosen = materialIds ? pool.filter((m) => materialIds.includes(m.id)) : rule === 'all' ? pool : pool.filter((m) => (rule as readonly MaterialKind[]).includes(m.kind))
  return [...chosen].sort((a, b) => b.addedAt.localeCompare(a.addedAt)).slice(0, 6)
}

export interface BuildContextArgs {
  skill: SkillId
  c: CompanyCase
  client: ClientOpsRecord | null
  memory: { version: number; content: CurrentContext } | null
  runs: readonly AiRun[]
  revisions: ReadonlyMap<string, AiRevision>
  today: string
  materialIds?: readonly string[]
  /** 정책자금 · 벤처는 이어 둔 고객의 OS 진단(규칙 계산)을 같이 */
  usable?: (key: string) => boolean
}

export function buildAiContext(a: BuildContextArgs): AiContextPayload {
  const snap = caseSnapshot(a.c, a.client, a.memory?.content ?? null, a.runs, a.today)
  // 대표자 이름 · 요청자 · 관계상태 · 최근 작업일은 AI 에 필요 없다(개인정보 · 군더더기)
  const SEND = new Set(['industry', 'years', 'employees', 'revenue', 'homepage', 'problem', 'system'])
  const fields = snap.filter((s) => SEND.has(s.key)).map((s) => ({ label: s.label, value: clean(s.value) }))
  if (a.client) {
    const f = clientFacts(a.client, new Date(`${a.today}T00:00:00`))
    const sido = f.address.match(/^(서울|경기|인천|부산|대구|광주|대전|울산|세종|강원|충북|충남|전북|전남|경북|경남|제주)/)?.[1]
    if (sido) fields.push({ label: '지역', value: sido })
    if (f.businessType) fields.push({ label: '사업자 구분', value: f.businessType === 'corporation' ? '법인' : '개인' })
  }
  const mem = a.memory?.content
  const memoryFields = mem ? CONTEXT_FIELDS.filter((x) => mem[x.key].trim()).map((x) => ({ label: x.label, value: clean(mem[x.key]) })) : []
  const diagnosis: string[] = []
  if (a.client && (a.skill === 'FUNDING_STRATEGY' || a.skill === 'VENTURE_PLAN')) {
    try {
      for (const i of buildInsights(a.client, a.today, [], a.usable ?? (() => true)).slice(0, 8)) diagnosis.push(clean(`${i.label}: ${i.headline}${i.detail ? ` — ${i.detail}` : ''}${i.amount ? ` (${i.amount})` : ''}`))
    } catch {
      // 진단이 실패해도 AI 작업은 이어 간다
    }
  }
  const evaluated = [...a.runs].filter((r) => r.evaluation === 'adopted' || r.evaluation === 'partially_adopted').sort((x, y) => (y.evaluatedAt ?? y.createdAt).localeCompare(x.evaluatedAt ?? x.createdAt))
  const seen = new Set<string>()
  const adopted: AiContextPayload['adopted'] = []
  for (const r of evaluated) {
    if (seen.has(r.skillId) || adopted.length >= 6) continue
    seen.add(r.skillId)
    adopted.push({ skill: skillName(r.skillId), version: r.skillVersion, partial: r.evaluation === 'partially_adopted', summary: clean(runSummary(r, a.revisions.get(r.id)?.content)).slice(0, 900) })
  }
  const recent = [...a.runs]
    .filter((r) => r.evaluation === 'draft' && r.skillId !== a.skill && r.status !== 'failed')
    .sort((x, y) => y.createdAt.localeCompare(x.createdAt))
    .slice(0, 2)
    .map((r) => ({ skill: skillName(r.skillId), summary: clean(runSummary(r)).slice(0, 300) }))
  const materials = materialsFor(a.skill, a.c.materials, a.materialIds).map((m) => ({ title: m.title, kind: m.kind, text: clean(m.text).slice(0, 6000) }))
  return {
    company: { name: a.c.companyName, fields },
    memory: { version: a.memory?.version ?? 0, fields: memoryFields },
    diagnosis,
    adopted,
    recent,
    materials,
  }
}

/** 보내기 전 크기(글자 수) — 화면에 '보낼 양' 으로 */
export function payloadChars(p: AiContextPayload): number {
  return JSON.stringify(p).length
}
