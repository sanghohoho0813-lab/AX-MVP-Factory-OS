/**
 * D-514 콘텐츠 묶음 AI 결과 다른 기기에서도 — 합치기(같은 키워드는 나중 것 · 최근 12개) · 가져올 것 고르기(쓰는 중 빼기) ·
 * 같은지 · 행 id · 저장 모양(기기) · 브라우저 저장 모드에서는 올리지 않음.
 * D-515 맞추는 길 하나로(keyedSync) — '이렇게 찍으세요' AI 추천(kitAi)도 같은 길: 한 줄 이름 · 한도 40 · 모양 · 기기 · 맞추는 일.
 * D-516 영상 대본(영상마다 한 줄 + 목록 한 줄) · 우리 회사 버전(한 줄) — 줄 이름 · 모양 · 기기 · 빈 대본.
 * D-517 오늘 대화창이 배운 것(별명 · 평가) — 칸 모양 · 예전 기록 · 별명마다 나중 것.
 * D-521 작업공간 전체 내보내기 — 서류 파일 목록 · 3판 모양(예전 불러오기가 그대로 읽음) · 요약 · 못 담은 것 · 서명 주소 0.
 * D-523 보낸 초대 — 화면 상태(기한 지난 기다림 = 기한 지남) · 남은 날 · 기다리는 것 먼저(곧 만료 순) · 지난 것(최근 순).
 */
import { adoptPacks, cloudPacksOn, mergePackStores, packsRowId, samePackStores, PACK_ROW, type PackStore } from '../marketing/packSync'
import { PACK_STORE_MAX, packStoreOf, parsePackStore, type PackAiSaved } from '../marketing/contentPack'
import { KIT_MAX, KIT_ROW, kitStoreOf, parseKitStore, type KitAi } from '../marketing/kitAi'
import { adoptKeyed, keyedCloudSync, keyedRowId, mergeKeyed, sameKeyed } from '../marketing/keyedSync'
import { ADAPT_ROW, TRANSCRIPT_INDEX_ROW, transcriptBucket, transcriptIndexOf, transcriptRowId } from '../marketing/videoStudyRun'
import { adaptsOf, parseTranscripts, STUDY_KEEP } from '../marketing/videoStudy'
import { LEARN_ROW, learnedOf, learnedStore } from '../homeAsk/homeAskStore'
import { buildWorkspaceBackup, collectWorkspaceBackup, exportFileRows, workspaceBackupFileName, workspaceBackupLine, workspaceSectionOf } from '../workspaceExport'
import { buildBackup, parseBackup, parseBackupToolInputs } from '../clientOpsBackup'
import { listWorkspaceRows, type WorkspaceModuleRow } from '../moduleData'
import { normalizeClientOps } from '../clientOpsService'
import type { ClientOpsRecord } from '../../types/clientOps'
import type { JournalEntry } from '../../types/bridge'
import { inviteView, sortInvites, type WorkspaceInvite } from '../../auth/workspaceService'

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

/* Q D-515 '이렇게 찍으세요' AI 추천 — 같은 길 */
{
  const kit = (t: string, device?: 'pc' | 'phone'): KitAi => ({ at: t, model: 'm', core: '정책자금', view: '관점', hook: '첫 문장', titles: [{ text: '제목', type: '숫자형' }], thumbs: [], outline: [], ...(device ? { device } : {}) })
  check('Q1 행 id — 묶음(mkpacks_)과 추천(mkkits_)은 다른 줄 · 같은 작업공간', keyedRowId(KIT_ROW.rowPrefix, 'ws-1').startsWith('mkkits_') && keyedRowId(KIT_ROW.rowPrefix, 'ws-1') !== keyedRowId(PACK_ROW.rowPrefix, 'ws-1') && KIT_ROW.bucket === 'kits' && PACK_ROW.bucket === 'packs' && KIT_ROW.module === 'marketing')
  const st = kitStoreOf({ a: kit(at(5), 'phone'), b: { ...kit(at(6)), device: 'tablet' }, c: { ...kit('어제') }, d: { ...kit(at(7)), titles: [] }, e: kit(at(8)) })
  check('Q2 모양 — 기기는 휴대폰 · PC 만 · 시각이 틀리거나 제목 없는 칸은 버림 · 예전 기록(기기 없음) 그대로', st.a.device === 'phone' && !!st.b && st.b.device === undefined && !st.c && !st.d && st.e.device === undefined, Object.keys(st))
  check('Q3 브라우저 칸 읽기도 같은 규칙(깨진 값 → 빈 칸)', Object.keys(parseKitStore('{')).length === 0 && Object.keys(parseKitStore(JSON.stringify({ a: kit(at(5)) }))).length === 1 && Object.keys(kitStoreOf([1])).length === 0)
  let many: Record<string, KitAi> = {}
  for (let i = 0; i < 50; i++) many = { ...many, [`w:k${i}`]: kit(`2026-11-03T0${Math.floor(i / 10)}:${String(i % 60).padStart(2, '0')}:00.000Z`) }
  const kept = mergeKeyed(many, {}, KIT_ROW.max)
  check('Q4 추천은 최근 40개(이 브라우저와 같은 한도)', KIT_MAX === 40 && Object.keys(kept).length === 40 && !!kept['w:k49'] && !kept['w:k0'])
  const r = adoptKeyed({ 'w:a': kit(at(5)) }, { 'w:a': kit(at(7), 'phone'), 'w:b': kit(at(6), 'phone') }, new Set(['w:b']), KIT_MAX)
  check('Q5 가져오기 — 나중 것만 · 쓰는 중인 후보는 빼기', r.adopted.join(',') === 'w:a' && r.local['w:a'].device === 'phone' && !r.local['w:b'])
  check('Q6 같은지(기본 표지 = 시각)', sameKeyed({ x: kit(at(5)) }, { x: kit(at(5), 'phone') }) && !sameKeyed({ x: kit(at(5)) }, { x: kit(at(6)) }))
}

/* S D-516 영상 대본 · 우리 회사 버전 */
{
  const VID = 'abcDEF12345'
  check('S1 줄 이름 — 대본 목록(transcripts) · 영상마다 칸(transcript_<영상>) · 우리 버전(adapts) · 모두 작업공간마다 · 30개', TRANSCRIPT_INDEX_ROW.bucket === 'transcripts' && transcriptBucket(VID) === `transcript_${VID}` && transcriptRowId('ws-1', VID) !== transcriptRowId('ws-2', VID) && transcriptRowId('ws-1', VID).includes(VID) && ADAPT_ROW.bucket === 'adapts' && keyedRowId(ADAPT_ROW.rowPrefix, 'ws-1') !== keyedRowId(TRANSCRIPT_INDEX_ROW.rowPrefix, 'ws-1') && ADAPT_ROW.max === STUDY_KEEP && STUDY_KEEP === 30)
  const idx = transcriptIndexOf({ [VID]: { at: at(5), title: '영상', parts: 3 }, sample_xx: { at: at(5), parts: 1 }, bad: { at: '어제' }, ['zzzZZZ99999']: { at: at(6), title: 7, parts: 'x' } })
  check('S2 대본 목록 모양 — 받아 적을 수 있는 영상 번호만 · 시각 틀리면 버림 · 구간 수 숫자만', Object.keys(idx).join(',') === `${VID},zzzZZZ99999` && idx[VID].parts === 3 && idx.zzzZZZ99999.parts === 0 && idx.zzzZZZ99999.title === '', idx)
  const docs = parseTranscripts(JSON.stringify({ [VID]: { id: VID, title: 't', at: at(5), model: 'm', duration: 600, parts: [], device: 'phone' }, ['qqqQQQ11111']: { id: 'q', title: 't', at: at(4), model: 'm', duration: 60, parts: [{ start: 0, end: 60, status: 'done', lines: [{ t: 1, text: '말' }] }], device: 'tv' } }))
  check('S3 대본 — 기기는 휴대폰 · PC 만 · 빈 대본(처음부터 다시 받기)도 그대로 읽힘(다른 기기 옛 대본을 덮게)', docs[VID]?.device === 'phone' && docs[VID]?.parts.length === 0 && docs.qqqQQQ11111?.device === undefined && docs.qqqQQQ11111?.parts.length === 1)
  const ad = adaptsOf({ [VID]: { at: at(5), model: 'm', withTranscript: true, device: 'pc', answer: { headline: 'h', items: [{ title: '제목' }] } }, x: { at: at(5) } })
  check('S4 우리 버전 모양 — 기기 남김 · 답 없는 칸 버림 · 깨진 값 → 빈 칸', ad[VID]?.device === 'pc' && ad[VID]?.withTranscript === true && !ad.x && Object.keys(adaptsOf(null)).length === 0 && Object.keys(adaptsOf([1])).length === 0)
}

/* H D-517 대화창이 배운 것 */
{
  const fb = { up: 2, down: { tooLong: 1 }, liked: [{ q: '정책자금', headline: '세 가지' }] }
  const st = learnedStore({ 해성: 'c1', 미래: 'c2' }, fb as never, { aliases: { 해성: at(5) }, fb: at(6) })
  check('H1 이 기기 → 칸 — 별명마다 한 칸(배운 때 · 없으면 빈 시각) · 평가 한 칸', st['alias:해성']?.client === 'c1' && st['alias:해성']?.at === at(5) && st['alias:미래']?.at === '' && st.fb?.fb?.up === 2 && st.fb?.at === at(6), st)
  check('H2 평가를 한 번도 안 했으면 평가 칸 없음', !learnedStore({}, { up: 0, down: {}, liked: [] }, { aliases: {}, fb: '' }).fb)
  const back = learnedOf(JSON.parse(JSON.stringify({ ...st, 'alias:x': { at: at(1), client: 'c3' }, other: { at: at(1) }, 'alias:긴': { at: at(1) }, fb2: { at: at(1), fb: {} } })))
  check('H3 클라우드 칸 다듬기 — 별명(업체 있는 것) · 평가만 · 모르는 칸 · 업체 없는 별명은 버림', !!back['alias:해성'] && !!back['alias:미래'] && !back.other && !back['alias:긴'] && !back.fb2 && back.fb?.fb?.liked.length === 1 && back.fb?.fb?.down.tooLong === 1, Object.keys(back))
  const merged = mergeKeyed({ 'alias:해성': { at: at(5), client: 'c1' } }, { 'alias:해성': { at: at(7), client: 'c9' }, 'alias:새': { at: at(6), client: 'c4' } }, LEARN_ROW.max)
  check('H4 같은 별명은 나중에 배운 업체 · 다른 별명은 모두(합침) · 한 줄에 별명 200 + 평가 1', merged['alias:해성'].client === 'c9' && merged['alias:새'].client === 'c4' && LEARN_ROW.max === 201 && LEARN_ROW.module === 'home')
}

/* R 맞추는 일 — 브라우저 저장 모드에서는 아무것도 부르지 않음 · 못 올림 표시 없음 */
{
  let calls = 0
  let changed = 0
  const sync = keyedCloudSync<KitAi>({
    ...KIT_ROW,
    local: () => {
      calls += 1
      return {}
    },
    running: () => new Set(),
    adopt: () => {
      calls += 1
    },
    changed: () => {
      changed += 1
    },
  })
  await sync.open('ws-1')
  sync.push()
  await sync.open(null)
  check('R1 브라우저 저장 모드 · 작업공간 없음 → 읽기 · 올리기 0 · 못 올림 표시 없음', calls === 0 && changed === 0 && sync.failed() === false, { calls, changed })
}

/* W D-521 작업공간 전체 내보내기 */
{
  const doc = (over: Record<string, unknown> = {}) => ({ received: true, issuedAt: '2026-10-01', fileName: '', fileSize: 0, storagePath: '', note: '', updatedAt: '2026-10-02T01:00:00.000Z', ...over })
  const a = normalizeClientOps({
    id: 'ca', workspaceId: 'ws-1', companyName: '한솔정밀(주)', status: 'active', createdAt: at(1), updatedAt: at(2),
    customDocuments: [{ id: 'x1', key: 'customdoc_keep', label: '시험 성적서', validMonths: null, sensitive: false }],
    documents: {
      businessRegistration: doc({ fileName: '사업자등록증.pdf', fileSize: 1200, storagePath: 'ws-1/ca/businessRegistration/a.pdf', folderPath: '한솔/기본', uploadedAt: '2026-10-02T02:00:00.000Z' }),
      smeCertificate: doc(),
      customdoc_keep: doc({ fileName: '성적서.jpg', storagePath: 'ws-1/ca/customdoc_keep/b.jpg' }),
      customdoc_gone: doc({ fileName: '남은 파일.pdf', storagePath: 'ws-1/ca/customdoc_gone/c.pdf' }),
    },
  } as Partial<ClientOpsRecord>)
  const b = normalizeClientOps({ id: 'cb', workspaceId: 'ws-1', companyName: '빈 업체', status: 'waiting', createdAt: at(1), updatedAt: at(1) } as Partial<ClientOpsRecord>)
  const files = exportFileRows([a, b])
  check('W1a 파일이 붙은 칸만 목록에(받았다고만 적은 칸 · 빈 업체 빼고)', files.length === 3, files.map((f) => f.slot))
  const br = files.find((f) => f.slot === 'businessRegistration')
  check('W1b 업체 · 칸 이름 · 파일 이름 · 크기 · 폴더 · 올린 날 · 저장 위치', !!br && br.company === '한솔정밀(주)' && br.label.length > 0 && br.fileName === '사업자등록증.pdf' && br.fileSize === 1200 && br.folderPath === '한솔/기본' && br.uploadedAt === '2026-10-02T02:00:00.000Z' && br.storagePath.endsWith('a.pdf'), br)
  check('W1c 직접 만든 칸은 그 이름 · 지운 칸에 남은 파일은 (지운 서류 칸)', files.find((f) => f.slot === 'customdoc_keep')?.label === '시험 성적서' && files.find((f) => f.slot === 'customdoc_gone')?.label === '(지운 서류 칸)')
  check('W1d 올린 날이 없던 예전 파일은 고친 날로', files.find((f) => f.slot === 'customdoc_keep')?.uploadedAt === '2026-10-02T01:00:00.000Z')

  const journal = [
    { id: 'j1', workspaceId: 'ws-1', ownerId: 'u', entryDate: '2026-11-01', entryType: 'consulting', content: '상담 메모', clientId: 'ca', projectId: null, serviceKey: null, dueDate: '', pinned: false, completed: false, completedAt: null, createdAt: at(3), updatedAt: at(3) },
    { id: 'j2', workspaceId: 'ws-1', ownerId: 'u', entryDate: '2026-11-02', entryType: 'follow_up', content: '서류 받기', clientId: 'ca', projectId: null, serviceKey: null, dueDate: '2026-11-05', pinned: false, completed: false, completedAt: null, createdAt: at(4), updatedAt: at(4) },
  ] as unknown as JournalEntry[]
  const rows: WorkspaceModuleRow[] = [
    { id: 'r1', clientId: 'ca', data: { name: '직원 1' }, createdAt: at(1), updatedAt: at(2), moduleKey: 'employment', bucket: 'employees' },
    { id: 'r2', clientId: 'ca', data: { name: '직원 2' }, createdAt: at(1), updatedAt: at(2), moduleKey: 'employment', bucket: 'employees' },
    { id: 'r3', clientId: '', data: { packs: {} }, createdAt: at(1), updatedAt: at(2), moduleKey: 'marketing', bucket: 'packs' },
  ]
  const tools = { 'axmvp.tools.cretop': '{"raw":"붙여넣은 글"}', 'axmvp.module.sales-kit.accounts.local': '[]' }
  const file = buildWorkspaceBackup({ records: [a, b], journal, moduleRows: rows, toolInputs: tools, mode: 'cloud', workspaceId: 'ws-1', missing: ['업무 일기'] })
  check('W2a 같은 형식 · 3판 · 업체 수', file.format === 'ax-client-ops' && file.version === 3 && file.count === 2 && file.clients.length === 2)
  const s = file.workspace.summary
  check('W2b 요약 — 업체 2 · 받은 서류 4 · 파일 3 · 업무 일기 2 · 모듈 기록 3 · 모듈마다', s.clients === 2 && s.documents === 4 && s.files === 3 && s.journal === 2 && s.moduleRows === 3 && s.modules.employment === 2 && s.modules.marketing === 1, s)
  check('W2c 이 브라우저에만 있는 모듈 기록 칸도 센다', s.localModuleKeys === 1, s.localModuleKeys)
  check('W2d 못 담은 것을 감추지 않는다', file.workspace.missing.join() === '업무 일기')
  const text = JSON.stringify(file)
  check('W3a 예전 [백업 불러오기] 가 그대로 읽는다 — 업체 · 도구 입력값', parseBackup(text).length === 2 && parseBackupToolInputs(text)['axmvp.tools.cretop'] === '{"raw":"붙여넣은 글"}')
  check('W3b 3판이면 보관용 요약을 꺼낸다 · 2판이면 없음', workspaceSectionOf(text)?.journal === 2 && workspaceSectionOf(JSON.stringify(buildBackup([a], {}))) === null && workspaceSectionOf('글') === null)
  check('W4 열어 볼 수 있는 주소(서명 주소 · http) 0', !/signedUrl|token=|https?:\/\//i.test(JSON.stringify(file.workspace.files)))
  check('W5a 한 줄 요약', workspaceBackupLine(s) === '업체 2곳 · 업무 일기 2건 · 모듈 기록 3줄 · 서류 파일 목록 3개', workspaceBackupLine(s))
  check('W5b 서버 모듈 기록이 없으면 브라우저 칸 수로', workspaceBackupLine({ ...s, moduleRows: 0 }).includes('모듈 기록 1칸'))
  check('W5c 파일 이름은 영문(브라우저가 한글 이름을 버림) · 예전 백업과 갈림', /^[\x20-\x7E]+$/.test(workspaceBackupFileName('2026-11-03')) && workspaceBackupFileName('2026-11-03') === 'client-ops-workspace-2026-11-03.json')

  check('W6a 브라우저 저장 모드면 서버 모듈 기록을 읽지 않는다(null)', (await listWorkspaceRows('ws-1')) === null && (await listWorkspaceRows(null)) === null)
  const local = await collectWorkspaceBackup(null, [a], false)
  check('W6b 브라우저 저장 모드 — 업무 일기(이 브라우저) · 서버 모듈 0 · 못 담은 것 0', local.workspace.mode === 'local' && local.workspace.moduleRows.length === 0 && local.workspace.missing.length === 0 && local.clients.length === 1, local.workspace)
}

/* I D-523 보낸 초대 */
{
  const NOW = Date.parse('2026-11-03T12:00:00.000Z')
  const inv = (id: string, status: WorkspaceInvite['status'], expiresAt: string, createdAt: string): WorkspaceInvite => ({ id, email: `${id}@x.kr`, role: 'editor', status, expiresAt, createdAt })
  const list = [
    inv('a', 'pending', '2026-11-06T13:00:00.000Z', '2026-10-30T00:00:00.000Z'),
    inv('b', 'pending', '2026-11-04T00:00:00.000Z', '2026-10-28T00:00:00.000Z'),
    inv('late', 'pending', '2026-11-02T00:00:00.000Z', '2026-10-26T00:00:00.000Z'),
    inv('in', 'accepted', '2026-11-08T00:00:00.000Z', '2026-11-01T00:00:00.000Z'),
    inv('off', 'revoked', '2026-11-08T00:00:00.000Z', '2026-10-31T00:00:00.000Z'),
  ]
  check('I1 기다림 · 남은 날(올림 · 최소 1)', inviteView(list[0], NOW).state === 'pending' && inviteView(list[0], NOW).daysLeft === 4 && inviteView(list[1], NOW).daysLeft === 1)
  check('I2 기한이 지난 기다림은 화면에서 기한 지남 · 남은 날 0', inviteView(list[2], NOW).state === 'expired' && inviteView(list[2], NOW).daysLeft === 0)
  check('I3 들어옴 · 취소는 그대로', inviteView(list[3], NOW).state === 'accepted' && inviteView(list[4], NOW).state === 'revoked')
  const { open, past } = sortInvites(list, NOW)
  check('I4 기다리는 것만 위 — 곧 만료 순', open.map((i) => i.id).join() === 'b,a', open.map((i) => i.id))
  check('I5 지난 것 — 최근 보낸 순(기한 지남 포함)', past.map((i) => i.id).join() === 'in,off,late', past.map((i) => i.id))
  check('I6 기한을 못 읽으면 기다림으로 두지 않음', inviteView(inv('x', 'pending', '', '2026-11-01T00:00:00.000Z'), NOW).state === 'expired')
}

console.log(`\npackSync: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
