/**
 * Mock Supabase 저장소 계약 테스트 (런타임 백엔드 없이 검증).
 * 검증: 워크스페이스 격리, 공통 CRUD, viewer 쓰기 차단, 도메인 특화 메서드 명시적 오류.
 * vite 로 번들 후 node 로 실행한다(실제 Supabase SDK 미포함 — 타입 전용 import).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { createSupabaseBundle } from '../bundle'
import { MockClient } from './mockClient'

let passed = 0
let failed = 0
const failures: string[] = []

function ok(cond: boolean, name: string) {
  if (cond) {
    passed++
  } else {
    failed++
    failures.push(name)
    console.log(`FAIL ${name}`)
  }
}

async function main() {
  const WS_A = 'ws-aaaa'
  const WS_B = 'ws-bbbb'

  const db = {
    organizations: [
      { id: 'a1', workspace_id: WS_A, code: 'A-ORG', status: 'active', payload: { id: 'a1', name: 'A사', archivedAt: null }, created_at: '2026-01-01' },
      { id: 'b1', workspace_id: WS_B, code: 'B-ORG', status: 'active', payload: { id: 'b1', name: 'B사', archivedAt: null }, created_at: '2026-01-01' },
    ],
    projects: [
      { id: 'pa1', workspace_id: WS_A, project_code: 'AX-1', status: 'active', version: 2, payload: { id: 'pa1', name: 'A프로젝트', projectId: 'pa1', version: 2, archivedAt: null }, created_at: '2026-01-02' },
      { id: 'pa2', workspace_id: WS_A, project_code: 'AX-2', status: 'active', version: 5, payload: { id: 'pa2', name: 'A최신', projectId: 'pa1', version: 5, archivedAt: null }, created_at: '2026-01-03' },
    ],
    assessments: [
      { id: 'as1', workspace_id: WS_A, project_id: 'pa1', version: 1, status: 'finalized', payload: { id: 'as1', projectId: 'pa1', version: 1, status: 'finalized' } },
      { id: 'as2', workspace_id: WS_A, project_id: 'pa1', version: 3, status: 'draft', payload: { id: 'as2', projectId: 'pa1', version: 3, status: 'draft' } },
    ],
  }
  const client = new MockClient(db)
  const typed = client as unknown as SupabaseClient

  // --- 워크스페이스 격리 ---
  const repoA = createSupabaseBundle(typed, WS_A)
  const orgsA = await repoA.organizations.getAll()
  ok(orgsA.length === 1, '격리: WS-A 고객사 1건만 조회')
  ok(orgsA[0]?.id === 'a1', '격리: WS-A 고객사가 a1')

  const repoB = createSupabaseBundle(typed, WS_B)
  const orgsB = await repoB.organizations.getAll()
  ok(orgsB.length === 1 && orgsB[0]?.id === 'b1', '격리: WS-B 는 b1 만 조회')

  // --- getById + 교차 워크스페이스 접근 불가 (mock: workspace_id 필터로 null) ---
  const crossed = await repoA.organizations.getById('b1')
  ok(crossed === null, '격리: WS-A 에서 WS-B 항목 getById 는 null')

  // --- create ---
  client.role = 'editor'
  const created = await repoA.organizations.create({ name: '새 고객사', archivedAt: null } as never)
  ok(typeof created.id === 'string' && created.id.length > 0, 'create: id 생성')
  ok((await repoA.organizations.getAll()).length === 2, 'create: 목록 2건으로 증가')

  // --- update ---
  const updated = await repoA.organizations.update(created.id, { name: '수정된 고객사' } as never)
  ok((updated as { name?: string }).name === '수정된 고객사', 'update: 필드 반영')

  // --- archive ---
  const archived = await repoA.organizations.archive(created.id)
  ok((archived as { status?: string }).status === 'archived', 'archive: status=archived')
  ok((await repoA.organizations.getAll()).length === 1, 'archive: 기본 목록에서 제외')
  ok((await repoA.organizations.getAll(true)).length === 2, 'archive: includeArchived 는 포함')

  // --- versioned: getLatestByProjectId + nextVersion ---
  const latest = await repoA.assessments.getLatestByProjectId('pa1')
  ok((latest as { id?: string })?.id === 'as2', 'versioned: 최신(비-superseded) 버전 as2')
  const next = await repoA.assessments.nextVersion('pa1')
  ok(next === 4, 'versioned: nextVersion = max(3)+1 = 4')

  // --- getByProjectId ---
  const byProject = await repoA.assessments.getByProjectId('pa1')
  ok(byProject.length === 2, 'getByProjectId: pa1 진단 2건')

  // --- viewer 쓰기 차단 ---
  client.role = 'viewer'
  let blocked = false
  try {
    await repoA.organizations.create({ name: '차단되어야 함', archivedAt: null } as never)
  } catch {
    blocked = true
  }
  ok(blocked, 'viewer: create 는 RLS 로 차단(예외)')
  // viewer 읽기는 허용
  client.role = 'viewer'
  const readByViewer = await repoA.organizations.getAll(true)
  ok(readByViewer.length === 2, 'viewer: 읽기는 허용')

  // --- 도메인 특화 메서드는 명시적 오류 ---
  client.role = 'editor'
  let threw = false
  try {
    // merge 는 아직 미구현 → 명시적 오류
    await (repoA.automationCandidates as unknown as { merge: (...a: unknown[]) => Promise<unknown> }).merge([], {})
  } catch {
    threw = true
  }
  ok(threw, '특화 메서드(merge): 명시적 오류(가짜 성공 아님)')

  console.log(`\nMock 계약 테스트: ${passed} passed, ${failed} failed`)
  if (failed > 0) {
    console.log('실패:', failures.join(', '))
    process.exit(1)
  }
  console.log('CONTRACT_PASS')
}

main().catch((e) => {
  console.error('계약 테스트 오류:', e)
  process.exit(1)
})
