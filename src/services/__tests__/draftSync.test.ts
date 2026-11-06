/**
 * D-513 쓰던 글 다른 기기에서 이어 쓰기 — 어느 글을 쓸지(chooseDraft) · 같은 글 비교 · 저장 모양 · 행 id · 언제 · 어디서.
 */
import { chooseDraft, clockSkew, draftRowId, envelopeOf, localAtKey, noteServerTime, readLocalAt, readSynced, sameDraft, serverNowIso, syncedKey, whenWhere, writeLocalAt, writeSynced, type CloudDraft, type DraftEnvelope } from '../marketing/draftSync'
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

/* S5 D-551 서버 판으로 — 시계가 틀린 기기 */
{
  const S1 = '2026-11-03T05:00:00.100+00:00'
  const S2 = '2026-11-03T05:30:00.200+00:00'
  const cloudAt = (d: Partial<D>, at: string, serverAt: string): CloudDraft<D> => ({ ...env(d, at), serverAt })
  const pickS = (local: Partial<D>, localAt: string, cloud: CloudDraft<D>, synced: { serverAt: string; localAt: string } | null) =>
    chooseDraft({ local: { ...E, ...local }, localAt, cloud, blocked: false, same: sameDraft, empty, synced })
  // 기기 A 시계가 1시간 빠름: A 가 적은 시각 = 실제+1h. B(맞는 시계)가 그 뒤 고쳐 올림 → 클라우드 판이 바뀜
  const A_AT = '2026-11-03T06:00:00.000Z' // A 시계로 05:00 에 쓴 것
  const B_AT = '2026-11-03T05:20:00.000Z' // B 가 실제 05:20 에 쓴 것(A 시각보다 '예전' 처럼 보임)
  const before = pick({ body: 'A 예전 글' }, A_AT, env({ body: 'B 새 글' }, B_AT))
  check('S5a (수정 전 규칙) 시계 빠른 기기 A 로 돌아오면 예전 글을 올려 B 의 새 글을 덮음(재현)', before === 'push', before)
  const after = pickS({ body: 'A 예전 글' }, A_AT, cloudAt({ body: 'B 새 글' }, B_AT, S2), { serverAt: S1, localAt: A_AT })
  check('S5b (D-551) 클라우드 판이 바뀌었고 A 는 그 뒤 안 고침 → B 의 새 글을 가져옴', after === 'cloud', after)
  check('S5c 클라우드 판 그대로 · A 가 고침 → 올림(클라우드 적은 시각이 더 나중처럼 보여도)',
    pickS({ body: 'A 가 고친 글' }, '2026-11-03T06:10:00.000Z', cloudAt({ body: '옛 글' }, '2026-11-03T09:00:00.000Z', S1), { serverAt: S1, localAt: A_AT }) === 'push')
  check('S5d 둘 다 고침 → 적은 시각 견줌(클라우드가 나중 → 가져옴 · 이 기기가 나중 → 올림)',
    pickS({ body: 'A 고침' }, '2026-11-03T05:40:00.000Z', cloudAt({ body: 'B 고침' }, '2026-11-03T05:50:00.000Z', S2), { serverAt: S1, localAt: A_AT }) === 'cloud' &&
    pickS({ body: 'A 고침' }, '2026-11-03T05:55:00.000Z', cloudAt({ body: 'B 고침' }, '2026-11-03T05:50:00.000Z', S2), { serverAt: S1, localAt: A_AT }) === 'push')
  check('S5e 이 기기 글이 비었으면 클라우드를 비우지 않음(예전 규칙 — 가져옴)', pickS({}, A_AT, cloudAt({ body: '클라우드 글' }, B_AT, S1), { serverAt: S1, localAt: A_AT }) === 'cloud')
  check('S5f 기억이 없으면 예전 규칙 그대로', pickS({ body: 'A' }, A_AT, cloudAt({ body: 'B' }, B_AT, S2), null) === 'push')
  check('S5g 주소로 주제를 들고 왔으면 기억과 상관없이 올림', chooseDraft({ local: { ...E, topic: '소재' }, localAt: A_AT, cloud: cloudAt({ body: 'B' }, B_AT, S2), blocked: true, same: sameDraft, empty, synced: { serverAt: S1, localAt: A_AT } }) === 'push')
  writeSynced('threads', { ws: 'ws1', serverAt: S1, localAt: A_AT })
  check('S5h 기억 — 같은 작업공간만 읽음 · 계정 금고 키', readSynced('threads', 'ws1')?.serverAt === S1 && readSynced('threads', 'ws2') === null && readSynced('shorts', 'ws1') === null && isUserScopedKey(syncedKey('threads')))
  mem.set(syncedKey('shorts'), '{깨짐')
  check('S5i 깨진 기억 → 없음(예전 규칙)', readSynced('shorts', 'ws1') === null)
}

/* S6 D-551 시계 차이 */
{
  const sent = Date.parse('2026-11-03T05:00:00.000Z')
  const got = sent + 2000
  const skew = noteServerTime('2026-11-03T05:00:05.000Z', sent, got)
  check('S6a 서버가 5초 앞(왕복 2초) → 차이 +4초 · 남김', skew === 4000 && clockSkew() === 4000, { skew, saved: clockSkew() })
  check('S6b 서버 시계로 맞춘 지금 = 기기 시각 + 4초', serverNowIso('2026-11-03T05:10:00.000Z') === '2026-11-03T05:10:04.000Z')
  check('S6c 말이 안 되는 값(8일 차이 · 받은 때가 보낸 때보다 앞 · 시각 아님)은 버림 — 남긴 값 그대로',
    noteServerTime('2026-11-11T05:00:00.000Z', sent, got) === null && noteServerTime('2026-11-03T05:00:05.000Z', got, sent) === null && noteServerTime('어제', sent, got) === null && clockSkew() === 4000)
  noteServerTime('2026-11-03T04:59:59.000Z', sent, sent)
  check('S6d 기기가 앞서면 음수 차이 · 맞춘 시각이 당겨짐', clockSkew() === -1000 && serverNowIso('2026-11-03T05:10:00.000Z') === '2026-11-03T05:09:59.000Z')
  mem.set('axmvp.clock.skew.v1', 'abc')
  check('S6e 깨진 값 → 차이 0', clockSkew() === 0 && serverNowIso('2026-11-03T05:10:00.000Z') === '2026-11-03T05:10:00.000Z')
}

console.log(`\ndraftSync: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
