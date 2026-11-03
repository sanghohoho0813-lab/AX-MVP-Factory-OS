/**
 * D-514 콘텐츠 묶음 AI 결과 다른 기기에서도 — 합치기(같은 키워드는 나중 것 · 최근 12개) · 가져올 것 고르기(쓰는 중 빼기) ·
 * 같은지 · 행 id · 저장 모양(기기) · 브라우저 저장 모드에서는 올리지 않음.
 */
import { adoptPacks, cloudPacksOn, mergePackStores, packsRowId, samePackStores, type PackStore } from '../marketing/packSync'
import { PACK_STORE_MAX, packStoreOf, parsePackStore, type PackAiSaved } from '../marketing/contentPack'

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

const at = (h: number, m = 0) => `2026-11-03T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`
const saved = (t: string, text = '글', device?: 'pc' | 'phone'): PackAiSaved => ({ at: t, model: 'm', sections: { blog: [{ label: '블로그', text }] }, ...(device ? { device } : {}) })

/* P1 합치기 */
{
  const a: PackStore = { k1: saved(at(5), 'PC 옛 글'), k2: saved(at(6), 'PC 글') }
  const b: PackStore = { k1: saved(at(7), '휴대폰 새 글'), k3: saved(at(4), '휴대폰 글') }
  const m = mergePackStores(a, b)
  check('P1a 같은 키워드는 더 나중에 쓴 것', m.k1.sections.blog?.[0].text === '휴대폰 새 글')
  check('P1b 한쪽에만 있는 키워드도 모두', !!m.k2 && !!m.k3 && Object.keys(m).length === 3)
  check('P1c 나중 것 먼저(순서)', Object.keys(m).join(',') === 'k1,k2,k3', Object.keys(m))
  const m2 = mergePackStores(b, a)
  check('P1d 어느 쪽을 먼저 넣어도 같은 결과', JSON.stringify(m2) === JSON.stringify(m))
  let many: PackStore = {}
  for (let i = 0; i < 20; i++) many = { ...many, [`k${i}`]: saved(at(1, i)) }
  const kept = mergePackStores(many, {})
  check('P1e 최근 12개만(이 브라우저와 같은 한도)', Object.keys(kept).length === PACK_STORE_MAX && PACK_STORE_MAX === 12 && !!kept.k19 && !kept.k0)
  check('P1f 같은 시각이면 먼저 있던 것 그대로(뒤집지 않음)', mergePackStores({ k: saved(at(5), 'A') }, { k: saved(at(5), 'B') }).k.sections.blog?.[0].text === 'A')
}

/* P2 같은지 */
{
  const a: PackStore = { k1: saved(at(5)), k2: saved(at(6)) }
  check('P2a 같은 키워드 · 같은 시각 → 같음(올리지 않음)', samePackStores(a, { k2: saved(at(6)), k1: saved(at(5)) }))
  check('P2b 시각이 다르면 다름', !samePackStores(a, { k1: saved(at(5)), k2: saved(at(7)) }))
  check('P2c 키워드 수가 다르면 다름', !samePackStores(a, { k1: saved(at(5)) }) && !samePackStores({}, a))
  check('P2d 같은 시각이어도 칸 수가 다르면 다름(한 갈래 더 온 것)', !samePackStores({ k: saved(at(5)) }, { k: { ...saved(at(5)), sections: { blog: [{ label: 'a', text: 'b' }], video: [{ label: 'c', text: 'd' }] } } }))
}

/* P3 가져올 것 고르기 */
{
  const local: PackStore = { k1: saved(at(5), 'PC 옛 글'), k2: saved(at(9), 'PC 새 글') }
  const cloud: PackStore = { k1: saved(at(7), '휴대폰 글'), k2: saved(at(8), '휴대폰 옛 글'), k3: saved(at(6), '휴대폰만') }
  const r = adoptPacks(local, cloud, new Set())
  check('P3a 클라우드 쪽이 나중인 키워드 · 이 기기에 없는 키워드만 가져옴', r.adopted.sort().join(',') === 'k1,k3', r.adopted)
  check('P3b 이 기기 쪽이 나중이면 그대로(덮지 않음)', r.local.k2.sections.blog?.[0].text === 'PC 새 글')
  check('P3c 가져온 뒤 이 기기 칸 = 둘을 합친 것', r.local.k1.sections.blog?.[0].text === '휴대폰 글' && r.local.k3.sections.blog?.[0].text === '휴대폰만')
  const busy = adoptPacks(local, cloud, new Set(['k1']))
  check('P3d 지금 쓰는 중인 키워드는 가져오지 않음(쓰는 중 글을 덮지 않음)', !busy.adopted.includes('k1') && busy.local.k1.sections.blog?.[0].text === 'PC 옛 글')
  check('P3e 클라우드가 비어 있으면 가져올 것 없음', adoptPacks(local, {}, new Set()).adopted.length === 0)
  let full: PackStore = {}
  for (let i = 0; i < 12; i++) full = { ...full, [`n${i}`]: saved(at(10, i)) }
  const old = adoptPacks(full, { old: saved(at(1)) }, new Set())
  check('P3f 이 기기가 이미 12개 · 클라우드 것이 더 예전이면 가져온 것으로 세지 않음(한도 밖)', old.adopted.length === 0 && !old.local.old && Object.keys(old.local).length === 12)
}

/* P4 행 id · 저장 모양 · 모드 */
check('P4a 행 id 는 작업공간마다(다른 작업공간과 안 겹침) · 같은 작업공간은 한 줄', packsRowId('ws-1') === packsRowId('ws-1') && packsRowId('ws-1') !== packsRowId('ws-2') && packsRowId('ws-1').startsWith('mkpacks_'))
{
  const raw = JSON.stringify({ k: { ...saved(at(5)), device: 'phone' }, j: { ...saved(at(6)), device: 'tablet' }, x: { at: at(7), sections: {} } })
  const st = parsePackStore(raw)
  check('P4b 기기는 휴대폰 · PC 만 남기고(모르는 값은 버림) · 빈 결과는 버림', st.k.device === 'phone' && st.j && st.j.device === undefined && !st.x)
  check('P4c 클라우드 한 줄도 같은 규칙으로(깨진 값 · 배열 → 빈 칸)', Object.keys(packStoreOf(null)).length === 0 && Object.keys(packStoreOf([1, 2])).length === 0 && packStoreOf({ k: saved(at(5)) }).k.at === at(5))
  check('P4d 예전 기록(기기 없음)도 그대로 읽힘', parsePackStore(JSON.stringify({ k: saved(at(5)) })).k.device === undefined)
}
check('P4e 브라우저 저장 모드 · 작업공간 없음 → 올리지 않음', !cloudPacksOn(null) && !cloudPacksOn(undefined) && !cloudPacksOn('ws-1'))

console.log(`\npackSync: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
