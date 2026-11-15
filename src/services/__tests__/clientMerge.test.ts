/**
 * SYNC-2(D-547) 업체 기록 합치기 — 읽은 판 · 내가 고친 것 · 먼저 저장된 것.
 * 서로 다른 칸 → 둘 다 · 같은 칸 다르게 → 겹친 칸(먼저 저장된 값을 두고) · [내가 고친 것으로] → 내 값 · id 목록은 줄마다 · 글자 목록은 더한 것/뺀 것.
 */
import { applyMine, conflictLabels, conflictRows, conflictValueText, mergeClientEdits, replaceClientInList, sameValue } from '../clientMerge'
import { normalizeClientOps } from '../clientOpsService'
import type { ClientNote, ClientOpsRecord } from '../../types/clientOps'

let passed = 0
let failed = 0
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) {
    passed++
    console.log(`PASS  ${name}`)
  } else {
    failed++
    console.log(`FAIL  ${name}${detail === undefined ? '' : ' — ' + JSON.stringify(detail).slice(0, 500)}`)
  }
}

const note = (id: string, text: string): ClientNote => ({ id, text, pinned: false, createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z' })
const base: ClientOpsRecord = normalizeClientOps({
  id: 'c1',
  workspaceId: 'w1',
  companyName: '한빛정밀',
  contactName: '이과장',
  contactPhone: '010-1111-2222',
  industry: '제조',
  notes_list: [note('n1', '첫 상담'), note('n2', '서류 요청')],
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: 'v1',
})
const edit = (r: ClientOpsRecord, part: Partial<ClientOpsRecord>, v = r.updatedAt): ClientOpsRecord => ({ ...structuredClone(r), ...part, updatedAt: v })

// M1 서로 다른 칸
{
  const mine = edit(base, { contactPhone: '010-9999-0000' })
  const theirs = edit(base, { industry: '제조 · 도매' }, 'v2')
  const { merged, conflicts } = mergeClientEdits(base, mine, theirs)
  check('M1 서로 다른 칸(연락처 · 업종) → 둘 다 · 겹침 0 · 판은 먼저 저장된 것(v2)', conflicts.length === 0 && merged.contactPhone === '010-9999-0000' && merged.industry === '제조 · 도매' && merged.updatedAt === 'v2', { conflicts, merged: { p: merged.contactPhone, i: merged.industry } })
}
// M2 같은 칸 같은 값
{
  const mine = edit(base, { contactName: '김부장' })
  const theirs = edit(base, { contactName: '김부장' }, 'v2')
  const r = mergeClientEdits(base, mine, theirs)
  check('M2 같은 칸을 같은 값으로 → 겹침 0', r.conflicts.length === 0 && r.merged.contactName === '김부장')
}
// M3 같은 칸 다른 값 → 겹침 · 먼저 저장된 값 · applyMine → 내 값 · 다른 고침은 그대로
{
  const mine = edit(base, { contactPhone: '010-3333-4444', notes: '내가 쓴 메모' })
  const theirs = edit(base, { contactPhone: '010-5555-6666' }, 'v2')
  const { merged, conflicts } = mergeClientEdits(base, mine, theirs)
  const mineWin = applyMine(merged, conflicts)
  check('M3 같은 칸 다르게 → 겹친 칸 하나(contactPhone) · 일단 먼저 저장된 값 · 겹치지 않은 내 메모는 살림', conflicts.length === 1 && conflicts[0].path === 'contactPhone' && merged.contactPhone === '010-5555-6666' && merged.notes === '내가 쓴 메모', conflicts)
  check('M3b [내가 고친 것으로] → 겹친 칸만 내 값 · 메모 그대로 · 이름표 "담당자 연락처"', mineWin.contactPhone === '010-3333-4444' && mineWin.notes === '내가 쓴 메모' && conflictLabels(conflicts).join() === '담당자 연락처')
}
// M4 메모 목록 — 양쪽이 서로 다른 메모를 더함(맨 앞에 넣는 목록)
{
  const mine = edit(base, { notes_list: [note('m1', '휴대폰에서 쓴 메모'), ...base.notes_list] })
  const theirs = edit(base, { notes_list: [note('t1', 'PC 에서 쓴 메모'), ...base.notes_list] }, 'v2')
  const { merged, conflicts } = mergeClientEdits(base, mine, theirs)
  const ids = merged.notes_list.map((n) => n.id)
  check('M4 두 곳에서 메모를 하나씩 더함 → 둘 다 · 겹침 0 · 내 것은 내가 넣은 맨 앞', conflicts.length === 0 && ids.join() === 'm1,t1,n1,n2', ids)
}
// M5 한쪽이 메모 지움 · 다른 쪽은 업종 고침
{
  const mine = edit(base, { notes_list: [base.notes_list[0]] })
  const theirs = edit(base, { industry: '도매' }, 'v2')
  const { merged, conflicts } = mergeClientEdits(base, mine, theirs)
  check('M5 내가 메모 하나 지움 · 다른 곳은 업종 → 지운 것 반영 · 업종도', conflicts.length === 0 && merged.notes_list.map((n) => n.id).join() === 'n1' && merged.industry === '도매')
}
// M6 한쪽이 지운 메모를 다른 쪽이 고침 → 겹침
{
  const mine = edit(base, { notes_list: [base.notes_list[0], { ...base.notes_list[1], text: '서류 요청 — 다시 보냄' }] })
  const theirs = edit(base, { notes_list: [base.notes_list[0]] }, 'v2')
  const { merged, conflicts } = mergeClientEdits(base, mine, theirs)
  const back = applyMine(merged, conflicts)
  check('M6 다른 곳이 지운 메모를 내가 고침 → 겹침 · 일단 지운 쪽 · [내가 고친 것으로] → 되살림', conflicts.length === 1 && conflicts[0].path === 'notes_list[n2]' && merged.notes_list.length === 1 && back.notes_list.some((n) => n.id === 'n2' && n.text === '서류 요청 — 다시 보냄'), { conflicts, len: merged.notes_list.length })
}
// M7 같은 메모의 다른 칸(글 · 고정)
{
  const mine = edit(base, { notes_list: [{ ...base.notes_list[0], pinned: true }, base.notes_list[1]] })
  const theirs = edit(base, { notes_list: [{ ...base.notes_list[0], text: '첫 상담 — 고침' }, base.notes_list[1]] }, 'v2')
  const r = mergeClientEdits(base, mine, theirs)
  check('M7 같은 메모 — 나는 고정 · 다른 곳은 글 → 둘 다(줄 안 칸마다)', r.conflicts.length === 0 && r.merged.notes_list[0].pinned === true && r.merged.notes_list[0].text === '첫 상담 — 고침')
}
// M8 업무 묶음(객체) 안 서로 다른 칸
{
  const svc = Object.keys(base.services)[0] as keyof ClientOpsRecord['services']
  const mine = edit(base, { services: { ...base.services, [svc]: { ...base.services[svc], status: 'in_progress' } } })
  const theirs = edit(base, { services: { ...base.services, [svc]: { ...base.services[svc], nextStep: '서류 받기' } } }, 'v2')
  const r = mergeClientEdits(base, mine, theirs)
  check('M8 같은 업무 — 나는 상태 · 다른 곳은 다음 할 일 → 둘 다', r.conflicts.length === 0 && r.merged.services[svc].status === 'in_progress' && r.merged.services[svc].nextStep === '서류 받기')
}
// M9 회사 정보(사실 값) 객체 — 서로 다른 열쇠
{
  const mine = edit(base, { factValues: { ...base.factValues, revenue: '52억' } })
  const theirs = edit(base, { factValues: { ...base.factValues, employees: '18' } }, 'v2')
  const r = mergeClientEdits(base, mine, theirs)
  check('M9 회사 정보 — 매출 · 직원 수 각각 → 둘 다', r.conflicts.length === 0 && r.merged.factValues.revenue === '52억' && r.merged.factValues.employees === '18')
}
// M10 글자 목록 — 더한 것 · 뺀 것
{
  type WithTags = ClientOpsRecord & { tags?: string[] }
  const b2 = { ...structuredClone(base), tags: ['a', 'b'] } as WithTags
  const mine = { ...structuredClone(b2), tags: ['a', 'c'] } as WithTags
  const theirs = { ...structuredClone(b2), tags: ['a', 'b', 'd'], updatedAt: 'v2' } as WithTags
  const r = mergeClientEdits(b2, mine, theirs)
  check('M10 글자 목록 — 내가 b 뺌 · c 더함 / 다른 곳 d 더함 → a · d · c', r.conflicts.length === 0 && ((r.merged as WithTags).tags ?? []).join() === 'a,d,c', (r.merged as WithTags).tags)
}
// M11 둘 다 한 줄씩 더한 활동 기록(맨 앞) + 같은 칸 겹침 없음
{
  const act = (id: string) => ({ id, at: '2026-11-06T00:00:00Z', kind: 'profile', text: id }) as unknown as ClientOpsRecord['activity'][number]
  const mine = edit(base, { activity: [act('a-mine'), ...base.activity], contactName: '박대리' })
  const theirs = edit(base, { activity: [act('a-theirs'), ...base.activity], industry: '도매' }, 'v2')
  const r = mergeClientEdits(base, mine, theirs)
  check('M11 활동 기록 두 줄 + 담당자 · 업종 → 전부 · 겹침 0', r.conflicts.length === 0 && r.merged.activity.slice(0, 2).map((a) => a.id).join() === 'a-mine,a-theirs' && r.merged.contactName === '박대리' && r.merged.industry === '도매')
}
// M12 아무것도 안 고침 → 먼저 저장된 것 그대로
{
  const theirs = edit(base, { industry: '도매' }, 'v2')
  const r = mergeClientEdits(base, edit(base, {}), theirs)
  check('M12 나는 안 고침 → 먼저 저장된 것 그대로(같은 값)', r.conflicts.length === 0 && sameValue({ ...r.merged, updatedAt: '' }, { ...theirs, updatedAt: '' }))
}
check('V1 겹친 값 보기 — 짧은 글 그대로 · 빈 글 (비움) · 지움 · 묶음 이름 · 목록은 (여러 줄)', conflictValueText('010-1') === '010-1' && conflictValueText('') === '(비움)' && conflictValueText(undefined) === '(지움)' && conflictValueText({ text: '첫 상담' }) === '첫 상담' && conflictValueText([1]) === '(여러 줄)')
{
  // UX-STAB 영업 단계를 두 기기에서 따로 옮기면 — 예전: '영업 정보' 줄 셋(m1done · (목록) · 2026-11-15T06:55:37Z) → 지금: '영업 단계' 한 줄 · 쉬운 이름
  const rows = conflictRows([
    { path: 'sales.stage', mine: 'm1done', theirs: 'm1sched' },
    { path: 'sales.history', mine: [{ at: '2026-11-15T06:55:37Z', from: 'lead', to: 'm1done' }], theirs: [{ at: '2026-11-15T06:50:00Z', from: 'lead', to: 'm1sched' }] },
    { path: 'sales.movedAt', mine: '2026-11-15T06:55:37Z', theirs: '2026-11-15T06:50:00Z' },
    { path: 'contactPhone', mine: '010-1', theirs: '010-2' },
  ])
  const shown = JSON.stringify(rows)
  check('V2 영업 단계 겹침 → 한 줄 "영업 단계" · 1차 미팅 완료 / 1차 미팅 예정 · 딸린 줄(기록 · 옮긴 때) 없음 · 다른 칸은 그대로 · 내부 글자 0', rows.length === 2 && rows[0].label === '영업 단계' && rows[0].mine === '1차 미팅 완료' && rows[0].theirs === '1차 미팅 예정' && rows[1].label === '담당자 연락처' && !/m1done|m1sched|\(목록\)|T06:/.test(shown), rows)
  const only = conflictRows([{ path: 'sales.movedAt', mine: '2026-11-15T06:55:37Z', theirs: '2026-11-15T06:50:00Z' }])
  check('V3 단계 없이 옮긴 때만 겹침 → 그 줄은 남김 · 시각은 "11월 15일 hh:mm" 꼴(T · Z 0)', only.length === 1 && only[0].label === '영업 단계 옮긴 때' && /^11월 15일 \d{2}:\d{2}$/.test(only[0].mine) && !/T|Z/.test(only[0].mine), only)
}

// SYNC-6 저장 끝 소식 → 목록에서 그 업체만 새 판으로
{
  const old = { ...base, updatedAt: '2026-11-15T01:00:00.000Z' }
  const other = { ...base, id: 'c2', companyName: '다른업체', updatedAt: '2026-11-15T01:00:00.000Z' }
  const list = [old, other]
  const saved = { ...old, companyName: '한빛정밀(새 이름)', updatedAt: '2026-11-15T02:00:00.123456+00:00' }
  const r1 = replaceClientInList(list, saved)
  check('L1 같은 id 를 새 판으로 · 다른 업체는 같은 객체 그대로 · 순서 그대로', r1 !== list && r1[0] === saved && r1[1] === other && r1.length === 2)
  check('L2 목록에 없는 업체 → 같은 배열(다시 그리지 않음)', replaceClientInList(list, { ...saved, id: 'zz' }) === list)
  const same = [saved, other]
  check('L3 이미 같은 판(같은 updatedAt) → 같은 배열', replaceClientInList(same, { ...saved }) === same)
  const newer = { ...old, companyName: '그 뒤 다시 읽은 판', updatedAt: '2026-11-15T03:00:00.000Z' }
  check('L4 목록 쪽이 더 새 판(그 뒤 다시 읽음) → 되돌리지 않음(서버 · 이 기기 시각 모양이 달라도)', replaceClientInList([newer, other], saved)[0] === newer)
  const optimistic = { ...old, companyName: '보드에서 막 옮김' } // 화면이 먼저 그린 판 — updatedAt 은 읽은 그대로
  check('L5 화면이 먼저 그린 판(저장 전 · 옛 updatedAt) → 저장된 판으로', replaceClientInList([optimistic, other], saved)[0] === saved)
  check('L6 빈 목록 → 같은 배열', replaceClientInList([], saved).length === 0)
}

console.log(`\n${passed} passed, ${failed} failed`)
if (failed) process.exit(1)
