/**
 * D-220: 마케팅 도구(홈페이지 만들기 · 홍보 글 만들기)를 고객 관리에 없는 '가상 업체 · 컨설턴트' 로도 쓰기.
 *
 * - 가상 프로필은 모듈 기록 'marketing' 상자 · 'trial' 갈래에 한 줄씩(줄 id = 가상 id). 고객 관리 표는 건드리지 않는다.
 * - 두 도구의 엔진은 업체 기록(ClientOpsRecord) 모양을 받으므로, 가상 프로필을 같은 모양으로 바꿔 넘긴다(trialRecord).
 * - 만든 홈페이지 · 홍보 글은 업체 칸(client_id)을 비우고 내용에 가상 id 를 담아 저장한다 — 클라우드 표의 client_id 는
 *   고객 관리 표에만 이어질 수 있어서(외래 키) 가상 id 를 넣으면 저장이 거절된다. DB 는 바꾸지 않는다.
 * - '임시등록' 하면 고객 관리에 잠재고객(컨설턴트면 컨설턴트 고객)으로 올리고, 만든 것을 그 업체 줄로 옮긴다.
 *   옮기다 실패해도 다시 누르면 이어서 옮긴다(이미 만든 업체를 또 만들지 않는다).
 *
 * 규칙으로만 채운다 — AI 호출 없음.
 */
import type { ClientOpsRecord, CreateClientOpsInput } from '../types/clientOps'
import { normalizeClientOps } from './clientOpsService'
import { withActivity } from './clientOpsActivity'

export const TRIAL_MODULE = 'marketing'
export const TRIAL_BUCKET = 'trial'
const PREFIX = 'trial_'

export type TrialKind = 'company' | 'consultant'

export const TRIAL_KIND_LABEL: Record<TrialKind, string> = { company: '가상 업체', consultant: '가상 컨설턴트' }

export interface TrialProfile {
  id: string
  kind: TrialKind
  /** 업체 이름 · 컨설턴트 활동 이름 */
  name: string
  /** 업종 · 하는 일(컨설턴트는 전문 분야) */
  industry: string
  /** 대표 이름(업체) · 본인 이름(컨설턴트) */
  person: string
  /** 주소 · 지역 */
  region: string
  phone: string
  email: string
  homepage: string
  /** 한 줄 소개 · 주력 서비스 — 홈페이지 큰 문구 · 홍보 글 종목 자리에 쓴다 */
  intro: string
  /** 이 일을 부탁한 동료 컨설턴트(선택) */
  requestedBy: string
  createdAt: string
  updatedAt: string
  /** 임시등록으로 만든 고객 관리 업체 id — 만든 뒤 옮기기 전이면 이것만 있고 registeredAt 은 없다 */
  registeredClientId?: string
  /** 만든 것까지 다 옮긴 때 — 이게 있으면 고르는 목록에서 빠진다(이제 고객 관리에 있다) */
  registeredAt?: string
}

export function isTrialId(id: string | null | undefined): boolean {
  return typeof id === 'string' && id.startsWith(PREFIX) && id.length > PREFIX.length
}

export function newTrialId(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } }
  const raw = g.crypto?.randomUUID ? g.crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`
  return `${PREFIX}${raw.replace(/-/g, '').slice(0, 20)}`
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '')

/** 저장본 · 입력 → 가상 프로필(모양이 틀리면 null) */
export function normalizeTrial(raw: unknown, at = new Date().toISOString()): TrialProfile | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const id = typeof r.id === 'string' && isTrialId(r.id) ? r.id : ''
  const name = str(r.name, 60)
  if (!id || !name) return null
  const kind: TrialKind = r.kind === 'consultant' ? 'consultant' : 'company'
  const registeredClientId = str(r.registeredClientId, 80)
  const registeredAt = str(r.registeredAt, 40)
  return {
    id,
    kind,
    name,
    industry: str(r.industry, 40),
    person: str(r.person, 30),
    region: str(r.region, 80),
    phone: str(r.phone, 20),
    email: str(r.email, 80),
    homepage: str(r.homepage, 120),
    intro: str(r.intro, 80),
    requestedBy: str(r.requestedBy, 30),
    createdAt: str(r.createdAt, 40) || at,
    updatedAt: str(r.updatedAt, 40) || at,
    ...(registeredClientId ? { registeredClientId } : {}),
    ...(registeredClientId && registeredAt ? { registeredAt } : {}),
  }
}

/** 빈 칸 하나 — 고르는 화면의 '직접 넣기' 시작값 */
export function emptyTrial(kind: TrialKind, at = new Date().toISOString()): TrialProfile {
  return { id: newTrialId(), kind, name: '', industry: '', person: '', region: '', phone: '', email: '', homepage: '', intro: '', requestedBy: '', createdAt: at, updatedAt: at }
}

/**
 * 가상 프로필 → 업체 기록 모양 — 두 도구의 엔진(초안 · 홍보 정보)이 그대로 읽는다.
 * 숫자 · 인증 같은 사실은 없다(지어내지 않는다). 컨설턴트면 컨설턴트 고객 표시 → 개인 컨설턴트 견본.
 */
export function trialRecord(p: TrialProfile): ClientOpsRecord {
  return normalizeClientOps({
    id: p.id,
    workspaceId: null,
    companyName: p.name,
    contactName: p.person,
    representativeName: p.person,
    contactPhone: p.phone,
    companyPhone: p.phone,
    contactEmail: p.email,
    businessAddress: p.region,
    // 업종은 업태 칸(회사 기본 정보에 보인다) · 한 줄 소개는 종목(주력 상품)
    businessCategory: p.industry,
    businessItem: p.intro,
    industry: p.industry || (p.kind === 'consultant' ? '경영 컨설턴트' : ''),
    homepage: p.homepage,
    status: 'waiting',
    ...(p.kind === 'consultant' ? { clientType: 'consultant' as const } : {}),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  })
}

/* ------------------------------------------------------------------ */
/* 저장 줄 — 업체 칸 대신 내용에 가상 id                                  */
/* ------------------------------------------------------------------ */

interface RowLike {
  clientId: string
  data: Record<string, unknown>
}

/** 이 줄이 누구 것인가 — 업체 id, 아니면 내용에 담은 가상 id */
export function rowSubjectId(row: RowLike): string {
  if (row.clientId) return row.clientId
  return typeof row.data?.trialId === 'string' ? row.data.trialId : ''
}

/** 저장할 때 — 가상이면 업체 칸을 비우고 내용에 가상 id 를 담는다 */
export function subjectRow(subjectId: string, data: Record<string, unknown>): { clientId: string; data: Record<string, unknown> } {
  return isTrialId(subjectId) ? { clientId: '', data: { ...data, trialId: subjectId } } : { clientId: subjectId, data }
}

/** 임시등록 — 가상 줄을 새 업체 줄로(내용에서 가상 id 를 뺀다) */
export function adoptRow<T extends RowLike & { id: string }>(row: T, clientId: string): { id: string; clientId: string; data: Record<string, unknown> } {
  const data = { ...row.data }
  delete data.trialId
  return { id: row.id, clientId, data }
}

/** 도구 사이 이동 주소의 꼬리 — 가상이면 ?trial=, 아니면 ?client= */
export function subjectQuery(id: string): string {
  return `${isTrialId(id) ? 'trial' : 'client'}=${encodeURIComponent(id)}`
}

/* ------------------------------------------------------------------ */
/* 임시등록                                                             */
/* ------------------------------------------------------------------ */

/** 고객 관리에 처음 만들 때 넣는 것 — 잠재고객(계약 전). 컨설턴트면 컨설턴트 고객 */
export function registerInput(p: TrialProfile): CreateClientOpsInput {
  return {
    companyName: p.name,
    contactName: p.person,
    contactPhone: p.phone,
    industry: p.industry,
    status: 'waiting',
    ...(p.kind === 'consultant' ? { clientType: 'consultant' as const } : {}),
  }
}

/** 만든 기록에 나머지 칸 · 임시등록 표시 · 기록 한 줄 */
export function withTrialDetails(record: ClientOpsRecord, p: TrialProfile, at: string): ClientOpsRecord {
  const filled: ClientOpsRecord = {
    ...record,
    representativeName: record.representativeName || p.person,
    contactEmail: record.contactEmail || p.email,
    businessAddress: record.businessAddress || p.region,
    businessCategory: record.businessCategory || p.industry,
    businessItem: record.businessItem || p.intro,
    companyPhone: record.companyPhone || p.phone,
    homepage: record.homepage || p.homepage,
    provisional: { at, from: 'marketing', ...(p.requestedBy ? { requestedBy: p.requestedBy } : {}) },
  }
  const by = p.requestedBy ? ` · 부탁한 동료 ${p.requestedBy}` : ''
  return withActivity(filled, 'profile', `임시등록 — 마케팅 도구에서 ${TRIAL_KIND_LABEL[p.kind]}로 만들어 본 홈페이지 · 홍보 글을 옮김${by}`, null, at)
}

/** 고객 관리 표시를 지우기(보통 기록으로) */
export function withoutProvisional(record: ClientOpsRecord): ClientOpsRecord {
  const next = { ...record }
  delete next.provisional
  return next
}

/** 이름이 같은 업체(띄어쓰기 · (주) · 주식회사 무시) — 임시등록 전에 한 번 묻는다 */
export function sameNameClient(clients: readonly ClientOpsRecord[], name: string): ClientOpsRecord | null {
  const norm = (s: string) => s.replace(/\(주\)|㈜|주식회사|\s+/g, '').toLowerCase()
  const n = norm(name)
  if (!n) return null
  return clients.find((c) => !c.archivedAt && norm(c.companyName) === n) ?? null
}

/* ------------------------------------------------------------------ */
/* 예시 — 한 번 눌러 칸을 채우고 바로 만들어 볼 수 있게(전부 지어낸 이름)    */
/* ------------------------------------------------------------------ */

export interface TrialSample {
  key: string
  label: string
  kind: TrialKind
  fill: Pick<TrialProfile, 'name' | 'industry' | 'person' | 'region' | 'phone' | 'intro'>
}

export const TRIAL_SAMPLES: TrialSample[] = [
  { key: 'bakery', label: '동네 빵집', kind: 'company', fill: { name: '봄날베이커리', industry: '베이커리 카페', person: '김봄날', region: '경기도 수원시 팔달구', phone: '031-123-4567', intro: '매일 아침 굽는 빵 · 주문 케이크' } },
  { key: 'factory', label: '부품 공장', kind: 'company', fill: { name: '한결정밀', industry: '금속 부품 가공 제조', person: '이한결', region: '경기도 화성시 향남읍', phone: '031-234-5678', intro: 'CNC 정밀 가공 · 시제품 제작' } },
  { key: 'academy', label: '수학 학원', kind: 'company', fill: { name: '새솔수학학원', industry: '수학 학원 교육', person: '박새솔', region: '서울특별시 강서구', phone: '02-345-6789', intro: '중 · 고등 수학 소수 정예 수업' } },
  { key: 'consultant', label: '동료 컨설턴트', kind: 'consultant', fill: { name: '정다온 경영컨설턴트', industry: '정책자금 · 기업 인증 컨설턴트', person: '정다온', region: '서울특별시 강남구', phone: '010-1234-5678', intro: '중소기업 정책자금 · 벤처 인증 · 절세' } },
]
