/**
 * D-513 쓰던 글 다른 기기에서 이어 쓰기 — 어느 글을 쓸지(chooseDraft) · 같은 글 비교 · 저장 모양 · 행 id · 언제 · 어디서.
 */
import { chooseDraft, draftRowId, envelopeOf, localAtKey, readLocalAt, sameDraft, whenWhere, writeLocalAt, type DraftEnvelope } from '../marketing/draftSync'
import { isUserScopedKey } from '../../auth/storageVault'

let passed = 0
let failed = 0
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) {
    passed += 1
    console.log('PASS ', name)
  } else {
    failed += 1
    console.log('FAIL ', name, detail === undefined ? '' : JSON.stringify(detail).slice(0, 500))
  }
}

// 시험용 localStorage(노드에는 없다)
const mem = new Map<string, string>()
;(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: (i: number) => [...mem.keys()][i] ?? null,
  get length() {
    return mem.size
  },
} as Storage

interface D {
  topic: string
  body: string
  checks: string[]
}
const E: D = { topic: '', body: '', checks: [] }
const empty = (d: D) => !d.topic.trim() && !d.body.trim()
const env = (d: Partial<D>, at: string, device: 'pc' | 'phone' = 'pc'): DraftEnvelope<D> => ({ draft: { ...E, ...d }, at, device })
const pick = (local: Partial<D>, localAt: string, cloud: DraftEnvelope<D> | null, blocked = false) => chooseDraft({ local: { ...E, ...local }, localAt, cloud, blocked, same: sameDraft, empty })

const T1 = '2026-11-03T05:00:00.000Z'
const T2 = '2026-11-03T06:00:00.000Z'

/* S1 어느 글을 쓸까 */
check('S1a 클라우드 글 없음 · 이 기기도 빈 글 → 그대로', pick({}, '', null) === 'keep')
check('S1b 클라우드 글 없음 · 이 기기에 글 → 올림', pick({ body: 'PC 글' }, T1, null) === 'push')
check('S1c 이 기기 빈 글 · 클라우드에 글(다른 기기) → 클라우드 글로', pick({}, '', env({ body: '휴대폰 글' }, T1)) === 'cloud')
check('S1d 둘 다 글 · 클라우드가 더 나중 → 클라우드 글로', pick({ body: 'PC 글' }, T1, env({ body: '휴대폰 글' }, T2)) === 'cloud')
check('S1e 둘 다 글 · 이 기기가 더 나중 → 올림', pick({ body: 'PC 새 글' }, T2, env({ body: '휴대폰 옛 글' }, T1)) === 'push')
check('S1f 같은 글 → 그대로(칸 순서가 달라도)', chooseDraft({ local: { body: 'x', topic: 't', checks: ['a'] }, localAt: T1, cloud: { draft: { checks: ['a'], topic: 't', body: 'x' }, at: T2, device: 'pc' }, blocked: false, same: sameDraft, empty }) === 'keep')
check('S1g 주소로 주제를 들고 옴 · 이미 고치기 시작함 → 클라우드가 나중이어도 올림(바꾸지 않음)', pick({ topic: '같은 소재' }, '', env({ body: '휴대폰 글' }, T2), true) === 'push')
check('S1h 다른 기기에서 올린 뒤 비운 글(더 나중) → 비운 글로(되돌리기 가능)', pick({ body: '예전 글' }, T1, env({}, T2)) === 'cloud')
check('S1i 비운 글이 더 예전 → 이 기기 글을 올림', pick({ body: '새 글' }, T2, env({}, T1)) === 'push')
check('S1j 예전 기록(적은 시각 없음) + 클라우드 글 → 클라우드 글로(이 기기 글은 되돌리기로 남김)', pick({ body: '시각 없는 옛 글' }, '', env({ body: '클라우드 글' }, T1)) === 'cloud')

/* S2 저장 모양 */
const clean = (v: unknown): D => {
  const o = (v ?? {}) as Partial<D>
  return { ...E, ...o, checks: Array.isArray(o.checks) ? o.checks.filter((x) => typeof x === 'string') : [] }
}
check('S2a 맞는 모양 → 글 · 시각 · 기기', JSON.stringify(envelopeOf({ draft: { body: 'b', checks: ['a', 3] }, at: T1, device: 'phone' }, clean)) === JSON.stringify({ draft: { ...E, body: 'b', checks: ['a'] }, at: T1, device: 'phone' }))
check('S2b 시각이 틀리거나 글이 없으면 null', envelopeOf({ draft: {}, at: '어제' }, clean) === null && envelopeOf({ at: T1 }, clean) === null && envelopeOf(null, clean) === null)
check('S2c 모르는 기기 → PC', envelopeOf({ draft: {}, at: T1, device: 'tablet' }, clean)?.device === 'pc')

/* S3 행 id · 이 기기 시각 · 금고 */
check('S3a 행 id 는 종류 + 작업공간(다른 작업공간과 안 겹침)', draftRowId('threads', 'ws1') === 'mkdraft_threads_ws1' && draftRowId('shorts', 'ws1') !== draftRowId('threads', 'ws1') && draftRowId('threads', 'ws2') !== draftRowId('threads', 'ws1'))
writeLocalAt('threads', T2)
check('S3b 적은 시각 저장 · 읽기 · 모양이 틀리면 빈 값', readLocalAt('threads') === T2 && (mem.set(localAtKey('shorts'), 'garbage'), readLocalAt('shorts') === ''))
check('S3c 적은 시각 키도 계정 금고에 들어감(같은 브라우저 다른 계정에 안 보임)', isUserScopedKey(localAtKey('threads')) && isUserScopedKey('mirae.threads.draft.v1') && isUserScopedKey('mirae.shorts.draft.v1'))

/* S4 언제 · 어디서 */
const w = whenWhere({ at: T1, device: 'phone' })
check('S4 언제 · 어디서 한 줄 — 월/일 시:분 기기', /^\d{1,2}\/\d{1,2} \d{2}:\d{2} 휴대폰$/.test(w) && whenWhere({ at: 'x', device: 'pc' }) === 'PC', w)

console.log(`\ndraftSync: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
