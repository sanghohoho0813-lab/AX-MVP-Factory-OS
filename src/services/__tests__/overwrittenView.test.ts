/**
 * D-550 SYNC-5 덮인 내용 보기 모양 — 기록 종류 · 이름 · 열어 볼 화면 · 달라진 곳(그때 / 지금) · 지워진 기록 · 시각 한 줄.
 */
import { diffSummary, kindLabel, openHref, recordTitle, whenLabel } from '../overwrittenView'

let passed = 0
let failed = 0
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) {
    passed++
    console.log(`PASS  ${name}`)
  } else {
    failed++
    console.log(`FAIL  ${name}${detail === undefined ? '' : ' — ' + JSON.stringify(detail).slice(0, 600)}`)
  }
}

// W1 종류 · 이름
check('W1 종류 — 특허 명세서 · 기업인증 준비 · 정책자금 상담 기록 · 모르는 모듈은 모듈 기록',
  kindLabel({ moduleKey: 'patent-draft', bucket: 'draft' }) === '특허 명세서' && kindLabel({ moduleKey: 'cert-os', bucket: 'work' }) === '기업인증 준비' &&
  kindLabel({ moduleKey: 'policy-funding', bucket: 'consults' }) === '정책자금 상담 기록' && kindLabel({ moduleKey: 'qa-mod', bucket: 'notes' }) === '모듈 기록')
check('W1b 이름 — 명세서 제목 · 회사 · 인증 이름 · 없으면 빈 글자 · 40자에서 자름',
  recordTitle({ data: { draft: { title: '스마트 화분 관리 시스템' } } }) === '스마트 화분 관리 시스템' && recordTitle({ data: { company: '한빛정밀(주)' } }) === '한빛정밀(주)' &&
  recordTitle({ data: { cert: 'venture', answers: {} } }) === '벤처 인증' && recordTitle({ data: {} }) === '' && recordTitle({ data: { title: '가'.repeat(60) } }).length === 40)

// W2 열어 볼 화면
check('W2 열어 볼 화면 — 명세서는 그 초안 · 정책자금은 모듈 · 모르는 것은 없음',
  openHref({ moduleKey: 'patent-draft', originalId: 'd1', clientId: 'c1' }) === '/patent-venture/write?draft=d1&client=c1' && openHref({ moduleKey: 'policy-funding', originalId: 'x', clientId: '' }) === '/tools/policy-funding' &&
  openHref({ moduleKey: 'qa-mod', originalId: 'x', clientId: '' }) === '')

// W3 달라진 곳
{
  const then = { draft: { title: '스마트 화분', claims: ['물을 주는 단계', '빛을 재는 단계'], updatedAt: '2026-11-06T01:00:00Z' }, memo: '' }
  const now = { draft: { title: '스마트 화분', claims: ['물을 자동으로 주는 단계', '빛을 재는 단계', '알림 단계'], updatedAt: '2026-11-06T02:00:00Z' }, memo: undefined }
  const d = diffSummary(then, now as Record<string, unknown>)
  check('W3 달라진 칸 수 3(청구항 1 고침 · 3 새로 · 시각) · 빈 글 ↔ 없음은 같다고 봄', d.count === 3 && !d.removed, d)
  check('W3b 보여 주는 곳 — 사람이 고친 글만(시각 칸은 안 보임) · 새 칸은 (비어 있음) → 지금',
    d.samples.length === 2 && d.samples[0].then === '물을 주는 단계' && d.samples[0].now === '물을 자동으로 주는 단계' && d.samples[1].then === '(비어 있음)' && d.samples[1].now === '알림 단계', d.samples)
  check('W3c 같으면 0', diffSummary(then, then).count === 0)
  check('W3d 지금 기록이 지워졌으면 removed', diffSummary(then, null).removed === true)
  const big: Record<string, unknown> = { rows: Array.from({ length: 9000 }, (_, i) => ({ t: `줄 ${i}` })) }
  const t0 = Date.now()
  const db = diffSummary(big, { rows: [] })
  check('W3e 큰 기록(9,000줄)도 멈추지 않음(6,000칸까지만 셈) · 1초 안', db.count > 0 && db.count <= 6000 && Date.now() - t0 < 1000, { count: db.count, ms: Date.now() - t0 })
  const long = diffSummary({ t: '가'.repeat(200) }, { t: '나' })
  check('W3f 긴 글은 80자에서 자름', long.samples[0].then.length === 80 && long.samples[0].then.endsWith('…'))
  check('W3g 예/아니요 · 숫자', diffSummary({ ok: true, n: 3 }, { ok: false, n: 4 }).samples.map((x) => `${x.then}>${x.now}`).join() === '예>아니요,3>4')
}

// W4 시각 한 줄
{
  const iso = new Date(2026, 10, 6, 14, 3).toISOString()
  check('W4 같은 해는 해를 뺌 · 다른 해는 붙임', whenLabel(iso, '2026-11-06') === '11월 6일 14:03' && whenLabel(iso, '2027-01-02') === '2026년 11월 6일 14:03', whenLabel(iso, '2026-11-06'))
}

console.log(`\n${passed} passed, ${failed} failed`)
if (failed) process.exit(1)
