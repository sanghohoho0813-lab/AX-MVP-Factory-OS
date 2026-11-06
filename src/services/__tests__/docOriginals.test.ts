/**
 * D-549 SAFE-5 서류 원본 묶음 — 칸 이름 · (2) · 목록.txt · 못 받은 파일 · 크기 한도 · 여러 업체 폴더 · 정책자금 신청 서류 칸만.
 * 진짜 압축 파일을 만들고 다시 풀어 본다(zip.ts unzip).
 */
import { buildOriginalsZip, entryName, originalItems, originalsDoneLine, originalsZipName, zipSafeName } from '../docOriginals'
import { normalizeClientOps } from '../clientOpsService'
import { policyDocKeys } from '../policyEvidence'
import { unzip } from '../patent/zip'
import type { ClientOpsRecord, DocumentState } from '../../types/clientOps'

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

const doc = (fileName: string, path: string, extra: Partial<DocumentState> = {}): DocumentState => ({
  received: true,
  issuedAt: '2026-10-01',
  fileName,
  fileSize: 10,
  storagePath: path,
  note: '',
  updatedAt: '2026-10-01T00:00:00Z',
  uploadedAt: '2026-10-02T09:00:00Z',
  ...extra,
})

const rec: ClientOpsRecord = normalizeClientOps({
  id: 'c1',
  workspaceId: 'w1',
  companyName: '한빛정밀(주)',
  businessType: 'corporation',
  documents: {
    businessRegistration: doc('스캔0001.PDF', 'w1/c1/br/a.pdf'),
    corporateRegistry: doc('KakaoTalk_20261001.jpg', 'w1/c1/cr/b.jpg'),
    financialStatements: doc('재무제표 2025.pdf', 'w1/c1/fs/c.pdf'),
    // 받음 표시만 · 파일 없음 → 담지 않는다
    taxClearance: { ...doc('', ''), storagePath: '' },
    customdoc_dup: doc('사업자등록증_새로.pdf', 'w1/c1/dup/d.pdf'),
    customdoc_gone: doc('없어진파일.hwp', 'w1/c1/gone/e.hwp'),
  },
  customDocuments: [
    { id: 'x1', key: 'customdoc_dup', label: '사업자등록증', validMonths: null, sensitive: false },
    { id: 'x2', key: 'customdoc_gone', label: '용역 계약서', validMonths: null, sensitive: false },
  ],
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: 'v1',
})

const bytes = (s: string) => new TextEncoder().encode(s)
const fetchOk = async (p: string) => {
  if (p.includes('gone')) throw new Error('보관함에서 이 파일을 찾지 못했어요(지워졌거나 권한이 없음)')
  return bytes(`FILE:${p}`)
}
const text = (m: Map<string, Uint8Array>, name: string) => new TextDecoder('utf-8', { ignoreBOM: true }).decode(m.get(name) ?? new Uint8Array())

// O1 담을 칸 — 파일 있는 칸만 · 서류함 순서
{
  const items = originalItems(rec)
  check('O1 원본 있는 칸만(파일 없는 받음 표시는 뺌) — 5칸', items.length === 5 && !items.some((i) => i.key === 'taxClearance'), items.map((i) => i.key))
  check('O1b 직접 만든 칸 이름 · 원래 파일 이름 · 올린 날', items.find((i) => i.key === 'customdoc_gone')?.label === '용역 계약서' && items.find((i) => i.key === 'businessRegistration')?.fileName === '스캔0001.PDF' && items[0].uploadedAt === '2026-10-02')
}
// O2 이름 — 칸 이름 + 원래 확장자(소문자) · 같은 이름 (2) · 못 쓰는 글자
{
  const used = new Set<string>()
  const a = entryName('사업자등록증', '스캔0001.PDF', used)
  const b = entryName('사업자등록증', '사업자등록증_새로.pdf', used)
  const c = entryName('재무제표 2025/2024: 표준', 'x.pdf', used)
  const d = entryName('정관', '이름없음', used)
  check('O2 칸 이름.확장자 · 같은 이름 (2) · / : 는 빈칸 · 확장자 없으면 그대로', a === '사업자등록증.pdf' && b === '사업자등록증 (2).pdf' && c === '재무제표 2025 2024 표준.pdf' && d === '정관', { a, b, c, d })
  check('O2b 빈 이름 → 서류 · 점으로 시작 안 함', zipSafeName('') === '서류' && zipSafeName('..abc') === 'abc')
}
// O3 한 업체 묶음 — 풀어 보면 칸 이름 파일 + 목록.txt · 못 받은 파일은 건너뛰고 목록에
{
  const progress: number[] = []
  const r = await buildOriginalsZip([{ record: rec }], { fetchBytes: fetchOk, today: '2026-11-06', title: '서류 원본', onProgress: (d) => progress.push(d) })
  const m = await unzip(r.zip)
  const names = [...m.keys()].sort()
  check('O3 담은 4 · 못 담음 1(지워진 파일) · 업체 1', r.got === 4 && r.failed === 1 && r.clients === 1, { got: r.got, failed: r.failed })
  check('O3b 압축 안 이름 = 칸 이름(사업자등록증 · (2) · 법인 등기부 …) + 목록.txt', names.includes('사업자등록증.pdf') && names.includes('사업자등록증 (2).pdf') && names.includes('목록.txt') && names.length === 5, names)
  check('O3c 내용은 받은 그대로', text(m, '사업자등록증.pdf') === 'FILE:w1/c1/br/a.pdf')
  const idx = text(m, '목록.txt')
  check('O3d 목록 — 원래 이름 · 발급일 · 올린 날 · 못 담은 파일 까닭(지워졌거나 권한)', idx.startsWith('﻿한빛정밀(주) — 서류 원본') && idx.includes('원래 이름 스캔0001.PDF') && idx.includes('발급일 2026-10-01') && idx.includes('올린 날 2026-10-02') && idx.includes('못 담은 파일 1개') && idx.includes('용역 계약서 (없어진파일.hwp) — 보관함에서 이 파일을 찾지 못했어요'), idx.slice(0, 500))
  check('O3e 진행 표시 1 → 5', progress.join() === '1,2,3,4,5', progress)
  check('O3f 끝 한 줄 — 4개 · 1개 못 담음 · 목록 맨 아래', /원본 4개/.test(originalsDoneLine(r)) && /1개는 담지 못했어요/.test(originalsDoneLine(r)))
}
// O4 한 번 끊겼다 다시 되면 담는다(두 번째 시도)
{
  const tries: Record<string, number> = {}
  const flaky = async (p: string) => {
    tries[p] = (tries[p] ?? 0) + 1
    if (p.includes('fs/') && tries[p] === 1) throw new Error('인터넷이 잠깐 끊겨 받지 못했어요')
    return fetchOk(p)
  }
  const r = await buildOriginalsZip([{ record: rec }], { fetchBytes: flaky, today: '2026-11-06', title: '서류 원본' })
  check('O4 잠깐 끊긴 파일은 한 번 더 받아 담음(재무제표)', r.got === 4 && tries['w1/c1/fs/c.pdf'] === 2, tries)
}
// O5 크기 한도 — 넘는 파일은 목록에만
{
  const r = await buildOriginalsZip([{ record: rec }], { fetchBytes: fetchOk, today: '2026-11-06', title: '서류 원본', maxBytes: 45 })
  const idx = text(await unzip(r.zip), '목록.txt')
  check('O5 한도(45B)를 넘으면 그 뒤 파일은 담지 않고 목록에 · 크기 한도 표시', r.overSize > 0 && r.got >= 1 && idx.includes('묶음이 너무 커져') && /크기 한도/.test(originalsDoneLine(r)), { got: r.got, over: r.overSize })
}
// O6 여러 업체 — 업체마다 폴더 · 같은 이름 업체 (2) · 맨 위 전체 목록
{
  const b = normalizeClientOps({ ...rec, id: 'c2', companyName: '한빛정밀(주)', documents: { businessRegistration: doc('a.png', 'w1/c2/br/z.png') }, customDocuments: [] })
  const empty = normalizeClientOps({ ...rec, id: 'c3', companyName: '서류없는곳', documents: {}, customDocuments: [] })
  const r = await buildOriginalsZip([{ record: rec }, { record: b }, { record: empty }], { fetchBytes: fetchOk, today: '2026-11-06', title: '작업공간 서류 원본 전부' })
  const names = [...(await unzip(r.zip)).keys()]
  check('O6 업체마다 폴더 · 같은 이름 업체는 (2) 폴더 · 파일 없는 업체는 폴더 없음 · 맨 위 목록', r.clients === 2 && names.includes('한빛정밀(주)/사업자등록증.pdf') && names.includes('한빛정밀(주) (2)/사업자등록증.png') && names.includes('한빛정밀(주) (2)/목록.txt') && names[0] === '목록.txt' && !names.some((n) => n.startsWith('서류없는곳')), names)
  check('O6b 작업공간 끝 한 줄 — 업체 2곳', /업체 2곳/.test(originalsDoneLine(r, true)))
}
// O7 정책자금 신청 서류 칸만(policyDocKeys) — 사업자등록증 · 법인 등기부 · 재무제표, 용역 계약서는 아님
{
  const keys = policyDocKeys(rec, '2026-11-06')
  const items = originalItems(rec, keys)
  check('O7 정책자금 신청 서류 칸만 — 사업자등록증 · 재무제표는 들고 용역 계약서는 빠짐', items.some((i) => i.key === 'businessRegistration') && items.some((i) => i.key === 'financialStatements') && !items.some((i) => i.key === 'customdoc_gone'), { keys, items: items.map((i) => i.label) })
  // 기한 지난 칸은 빼고
  const old = normalizeClientOps({ ...rec, documents: { ...rec.documents, taxClearance: doc('납세.pdf', 'w1/c1/tax/t.pdf', { issuedAt: '2025-01-01' }) } })
  check('O7b 기한 지난 납세증명서는 신청 서류 묶음에서 뺌', !policyDocKeys(old, '2026-11-06').includes('taxClearance'))
}
// O8 파일 없음 → 빈 묶음 한 줄 · 압축 이름
{
  const none = normalizeClientOps({ ...rec, documents: {}, customDocuments: [] })
  const r = await buildOriginalsZip([{ record: none }], { fetchBytes: fetchOk, today: '2026-11-06', title: '서류 원본' })
  check('O8 원본 없음 → 담은 0 · 안내 한 줄', r.got === 0 && /내려받을 원본 파일이 없어요/.test(originalsDoneLine(r)))
  check('O8b 압축 이름 — 업체_서류원본_날짜 · 정책자금신청서류 · 작업공간 서류원본전부', originalsZipName('client', '한빛정밀(주)', '2026-11-06') === '한빛정밀(주)_서류원본_2026-11-06.zip' && originalsZipName('policy', '한빛 정밀', '2026-11-06') === '한빛_정밀_정책자금신청서류_2026-11-06.zip' && originalsZipName('workspace', '', '2026-11-06') === '작업공간_서류원본전부_2026-11-06.zip')
}

console.log(`\n${passed} passed, ${failed} failed`)
if (failed) process.exit(1)
