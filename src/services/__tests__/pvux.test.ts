/**
 * D-249 특허 · 벤처 진행판 · 명세서 길잡이 · 도면 그림 글 · 제출 준비 묶음.
 * 시험용 발명(공구 마모 예측)은 실제 고객 발명과 상관없다.
 */
import { NARRATIVE_IDS, VK, VPLAN_FIELDS } from '../../certification/core/venturePlan'
import { checkDraft, draftProgress, emptyDraft, normalizeDraft } from '../patent/specDraft'
import { checkSpec } from '../patent/specCheck'
import { parseSpecText } from '../patent/specParse'
import { specMarkdown } from '../patent/specDraft'
import { isPlanStarted, nextOf, planStateOf, pvBoard, pvSummary, specHref, specStateOf } from '../patent/pvBoard'
import { AXIS_EXAMPLE, IDEA_EXAMPLE, SAMPLE_SOURCE, SECTION_RANGE, axisEndingFix, ideaHint, lengthRatio, lengthState, sampleDraft, submitChecklist } from '../patent/specCoach'
import { blockSvg, flowSvg, svgDataUrl, wrapText, xmlEsc } from '../patent/specFigureSvg'
import { unzip, zipStore } from '../patent/zip'
import { pvBrief } from '../patent/pvBrief'
import { priorIdeaLines } from '../patent/specMaterials'

let passed = 0
let failed = 0
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) {
    passed += 1
    console.log('PASS ', name)
  } else {
    failed += 1
    console.log('FAIL ', name, detail === undefined ? '' : JSON.stringify(detail).slice(0, 700))
  }
}

const full = () => {
  const d = sampleDraft()
  d.text = { field: '가', background: '나', problem: '다', effect: '라' }
  return d
}
const planNotes = (fill: { narrative: number; core: number; patent?: boolean; techName?: boolean; entered?: boolean }) => {
  const n: Record<string, string> = {}
  NARRATIVE_IDS.slice(0, fill.narrative).forEach((id) => (n[VK.text(id)] = '서술 글'))
  VPLAN_FIELDS.filter((f) => f.part === 'core').slice(0, fill.core).forEach((f) => (n[VK.text(f.id)] = '핵심 요약 글'))
  if (fill.techName) n[VK.text('tech_name')] = '기술명'
  if (fill.patent) n[VK.patent] = '[발명의 명칭] 가'
  if (fill.entered) VPLAN_FIELDS.forEach((f) => (n[VK.status(f.id)] = 'entered'))
  return n
}

/* ---------------- 견본 · 길잡이 ---------------- */
{
  const s = sampleDraft()
  check('L1 견본 — 초안 점검 고칠 것 0 · 1~4단계 · 점검 끝, 본문만 남음(5/6)', checkDraft(s).filter((i) => i.level === 'error').length === 0 && draftProgress(s).done === 5 && !draftProgress(s).steps.body, draftProgress(s))
  const r = checkSpec(parseSpecText(specMarkdown(s, { notice: false }), 'sample.md'))
  check('L2 견본 MD → 명세서 점검(D-245) 고쳐야 할 것 0', r.counts.error === 0, r.findings.filter((f) => f.level === 'error').map((f) => f.id))
  check('L3 견본 표시 — 출처 · 구성요소 6 · 마모판정부 · 종속항 씨앗 2', s.source === SAMPLE_SOURCE && s.components.length === 6 && s.components[3].name === '마모판정부' && s.seeds.length === 2)
  check('L4 예시 — 다섯 질문 · 권리축 일곱 줄 모두', Object.values(IDEA_EXAMPLE).every((x) => x.length > 15) && Object.keys(AXIS_EXAMPLE).length === 7)
  check('L5 끝맺음 — 한다 → 하는 · 명사 → 을 수행하는 · 이미 ~하는 · 빈 칸 · 연결관계는 그대로', axisEndingFix('input', '진동신호를 수집한다.') === '진동신호를 수집하는' && axisEndingFix('judge', '마모 판정') === '마모 판정을 수행하는' && axisEndingFix('input', '수집하는') === null && axisEndingFix('input', ' ') === null && axisEndingFix('link', '함께 써서 산출') === null)
  check('L6 아이디어 답 — 마케팅 말 · 너무 짧음 · 괜찮음', /사실로/.test(ideaHint('혁신적인 마모 예측') ?? '') && /한 문장만 더/.test(ideaHint('불량이 많다') ?? '') && ideaHint(IDEA_EXAMPLE.problem) === null && ideaHint('') === null)
  check('L7 본문 길이 — 빈 칸 · 짧음 · 알맞음 · 김(요약 400자)', lengthState('abstract', 0) === 'empty' && lengthState('abstract', 100) === 'short' && lengthState('abstract', 300) === 'ok' && lengthState('abstract', 401) === 'long' && SECTION_RANGE.detail[0] === 2000)
  check('L8 막대 비율 0~1', lengthRatio('field', 0) === 0 && lengthRatio('field', 99999) === 1 && lengthRatio('field', 120) > 0 && lengthRatio('field', 120) < 1)
  const list = submitChecklist(s, r, '2026-10-20')
  check('L9 제출 전 확인표 — 명칭 한글{영문} · 청구항 3개(독립 2 · 종속 1)… · 대표도 · 점검 0 · 손으로 볼 것', list.includes('발명의 명칭: 공구 진동정보 기반') && list.includes('{SYSTEM AND METHOD') && /청구항: 4개\(독립 2개 · 종속 2개\)/.test(list) && list.includes('대표도 도 1') && list.includes('명세서 점검(특허로 서식) 고칠 것: 0개') && (list.match(/^\[ \]/gm) ?? []).length === 7, list.split('\n').slice(0, 7))
}

/* ---------------- 도면 그림 글 ---------------- */
{
  const s = sampleDraft()
  const b = blockSvg(s)
  check('F1 도 1 — 상자 6 · 시스템 이름(100) · 마모판정부(140) · 흰 바탕', b.boxes === 6 && b.svg.includes('공구관리 시스템(100)') && b.svg.includes('마모판정부(140)') && b.svg.startsWith('<svg') && b.svg.includes('fill="#fff"'))
  const f = flowSvg(s)
  check('F2 도 2 — 시작 · S110~S160 · 끝', f.boxes === 6 && f.svg.includes('>시작<') && f.svg.includes('>S160<') && f.svg.includes('>끝<'))
  const evil = { ...s, components: [{ no: '110', name: '<script>alert(1)</script>', does: 'x' }] }
  const e = blockSvg(evil)
  check('F3 사람이 적은 글은 이스케이프(<script> 없음)', !e.svg.includes('<script>') && e.svg.includes('&lt;script&gt;') && xmlEsc(`a&"'`) === 'a&amp;&quot;&apos;')
  check('F4 줄 나눔 — 24자 · 두 줄 넘으면 …', wrapText('가'.repeat(60), 24, 2).length === 2 && wrapText('가'.repeat(60), 24, 2)[1].endsWith('…') && wrapText('짧은 글', 24)[0] === '짧은 글')
  check('F5 데이터 주소(이미지로 보여 줌)', svgDataUrl('<svg/>').startsWith('data:image/svg+xml;charset=utf-8,%3Csvg'))
  check('F6 구성요소 없으면 상자 0(화면은 안내 글)', blockSvg(emptyDraft()).boxes === 0 && flowSvg(emptyDraft()).boxes === 0)
}

/* ---------------- 진행판 ---------------- */
{
  const clients = [
    { id: 'c_a', companyName: '가나 정밀' },
    { id: 'c_b', companyName: '다라 소프트' },
    { id: 'c_c', companyName: '마바 식품' },
  ]
  const rows = pvBoard({
    clients,
    drafts: [
      { id: 'd_a', clientId: 'c_a', updatedAt: '2026-10-20T09:00:00Z', draft: full() },
      { id: 'd_a_old', clientId: 'c_a', updatedAt: '2026-10-01T09:00:00Z', draft: emptyDraft() },
      { id: 'd_b', clientId: 'c_b', updatedAt: '2026-10-19T09:00:00Z', draft: emptyDraft() },
      { id: 'd_loose', clientId: '', updatedAt: '2026-10-18T09:00:00Z', draft: sampleDraft() },
    ],
    plans: [
      { clientId: 'c_c', updatedAt: '2026-10-20T10:00:00Z', notes: planNotes({ narrative: 4, core: 2 }) },
      { clientId: 'c_b', updatedAt: '2026-10-02T09:00:00Z', notes: { 'answer:x': '대표 답만' } },
    ],
  })
  check('B1 줄 — 회사 셋(사업계획서만 있는 회사 포함) + 회사 없는 명세서 하나 · 최근 순', rows.map((r) => r.key).join() === 'c_c,c_a,c_b,draft:d_loose', rows.map((r) => r.key))
  const a = rows.find((r) => r.key === 'c_a')!
  check('B2 명세서 다 됨 · 사업계획서 없음 → 재료로 보내기(점검 단계로)', a.stage === 'send' && a.spec?.id === 'd_a' && a.specCount === 2 && a.next.href === specHref('d_a', 'c_a', 'check') && a.flow.spec && a.flow.check && !a.flow.plan, a)
  const b = rows.find((r) => r.key === 'c_b')!
  check('B3 빈 명세서(도면 2장 기본만 됨) → 1 아이디어부터(주소에 step=idea) · 대표 답만 있는 벤처 기록은 사업계획서 아님', b.stage === 'spec' && b.next.href.includes('step=idea') && b.plan === null && /1\/6단계 — 다음은 1 아이디어/.test(b.next.text), b.next)
  const c = rows.find((r) => r.key === 'c_c')!
  check('B4 사업계획서만 — 서술 4/10 · 핵심 요약 2/7 → 이어 쓰기', c.stage === 'plan' && c.spec === null && c.plan?.narrative === 4 && c.plan?.core === 2 && c.next.href === '/patent-venture/plan?client=c_c' && /서술 4\/10 · 핵심 요약 2\/7/.test(c.next.text), c.next)
  const l = rows.find((r) => r.key === 'draft:d_loose')!
  check('B5 회사 없는 견본 — 이름 "견본(연습용)" · 본문부터', l.companyName === '견본(연습용)' && l.stage === 'spec' && l.spec?.sample === true && l.next.href.includes('step=body'))
  check('B6 위 숫자 — 진행 중 4 · 명세서 다 됨 1 · 사업계획서 다 됨 0', JSON.stringify(pvSummary(rows)) === JSON.stringify({ active: 4, specDone: 1, planDone: 0 }))
  check('B7 사업계획서 손댄 것만 — vplan: 칸 · 빈 글은 아님', isPlanStarted({ 'vplan:f:x': '가' }) && !isPlanStarted({ 'vplan:f:x': ' ' }) && !isPlanStarted({ a: 'b' }) && !isPlanStarted(null))
  const sp = specStateOf({ id: 'x', clientId: 'c', updatedAt: '', draft: full() })
  const done = planStateOf(planNotes({ narrative: NARRATIVE_IDS.length, core: 7, techName: true, patent: true }))
  check('B8 다음 할 일 차례 — 다 쓴 사업계획서 · 사이트 입력 전', done.complete && nextOf('c', sp, done).stage === (done.warn ? 'plan-fix' : 'enter'), { warn: done.warn, stage: nextOf('c', sp, done).stage })
  const entered = planStateOf(planNotes({ narrative: NARRATIVE_IDS.length, core: 7, techName: true, patent: true, entered: true }))
  check('B9 끝 — 다 쓰고 사이트에 다 넣음(고칠 것 없을 때)', entered.warn > 0 ? nextOf('c', sp, entered).stage === 'plan-fix' : nextOf('c', sp, entered).stage === 'done')
  const errSpec = specStateOf({ id: 'e', clientId: 'c', updatedAt: '', draft: { ...full(), components: [...full().components, { ...full().components[0] }] } })
  check('B10 명세서 고칠 것이 있으면 사업계획서보다 먼저', errSpec.errors > 0 && nextOf('c', errSpec, done).stage === 'spec-fix' && nextOf('c', errSpec, done).next.href.includes('step=check'))
  check('B11 회사 없는 다 된 명세서 → 회사 고르고 보내기', nextOf('', sp, null).stage === 'send' && /회사를 고르면/.test(nextOf('', sp, null).next.text))
  check('B12 이상한 저장값도 안전(빈 초안 취급)', specStateOf({ id: 'z', clientId: '', updatedAt: '', draft: 'oops' }).done === draftProgress(normalizeDraft(null)).done && specStateOf({ id: 'z', clientId: '', updatedAt: '', draft: 'oops' }).step === 'idea')
}

/* ---------------- 제출 준비 묶음(ZIP) ---------------- */
{
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 1, 2, 3])
  const z = zipStore([
    { name: 'spec.md', data: '**[발명의 명칭]**\n가{A}\n' },
    { name: 'fig1-draft.png', data: png },
    { name: 'checklist.txt', data: '확인표' },
  ])
  const m = await unzip(z)
  const dec = new TextDecoder()
  check('Z1 묶음 → 다시 풀면 같은 내용(글 · 그림 바이트 · 한글)', m.size === 3 && dec.decode(m.get('spec.md')!) === '**[발명의 명칭]**\n가{A}\n' && m.get('fig1-draft.png')!.join() === png.join() && dec.decode(m.get('checklist.txt')!) === '확인표')
}

/* ---------------- PV-1 첫 화면 준비 현황(규칙) · PV-2 폐기한 AI 아이디어는 재료로 안 씀 ---------------- */
{
  const clients = [{ id: 'c1', companyName: '한솔' }]
  const base = { clientId: 'c1', clients, factLines: 4, docs: ['사업자등록증', '재무제표', '크레탑'], specAi: true }
  const b0 = pvBrief({ ...base, drafts: [], plans: [] })
  check('PB1 명세서 없음 — 세 칸 다 아직 · 다음 할 일 = AI로 명세서 초안(새 명세서) · 이미 있는 자료(회사 기록 4줄 · 서류 3개) · 선행기술 줄 없음', b0.steps.every((x) => x.state === 'todo' && x.text === '') && b0.next.act === 'new-spec' && b0.next.label === 'AI로 명세서 초안 쓰기' && !b0.next.href && b0.have.join('|') === '회사 기록 4줄|서류함 3개(사업자등록증 · 재무제표 …)' && b0.research === null, b0)
  check('PB2 AI 없는 계정 → "명세서 쓰기 시작" · 주의 2줄(AI 초안은 사람이 정함 · 출원번호는 기록에 있는 것만)', pvBrief({ ...base, specAi: false, drafts: [], plans: [] }).next.label === '명세서 쓰기 시작' && b0.cautions.length === 2 && /대표 · 변리사/.test(b0.cautions[0]) && /출원번호 없음/.test(b0.cautions[1]) && /10-2026-1/.test(pvBrief({ ...base, drafts: [], plans: [], applicationNumber: '10-2026-1' }).cautions[1]))
  const half = emptyDraft()
  half.title = '공구 마모 예측'
  const b1 = pvBrief({ ...base, drafts: [{ id: 'd1', clientId: 'c1', updatedAt: '2026-10-20T00:00:00Z', draft: half }], plans: [] })
  check('PB3 쓰던 명세서 — 1칸 진행 중(n/6단계) · 다음 할 일은 진행판과 같은 주소(명세서 이어 쓰기) · 선행기술 조사 아직', b1.steps[0].state === 'doing' && /\/6단계/.test(b1.steps[0].text) && b1.next.label === '명세서 이어 쓰기' && (b1.next.href ?? '').includes('draft=d1') && b1.research === 'todo' && b1.have.includes('명세서 1개'), b1)
  const done = full()
  const b2 = pvBrief({ ...base, drafts: [{ id: 'd2', clientId: 'c1', updatedAt: '2026-10-21T00:00:00Z', draft: done }], plans: [] })
  check('PB4 다 쓴 명세서 → 다음 할 일은 진행판 그대로(고칠 것 또는 재료로 보내기) · 다른 회사 명세서는 안 봄', b2.next.href !== undefined && b2.next.text === (pvBoard({ drafts: [{ id: 'd2', clientId: 'c1', updatedAt: '2026-10-21T00:00:00Z', draft: done }], plans: [], clients }).find((r) => r.key === 'c1')?.next.text) && pvBrief({ ...base, clientId: 'c2', drafts: [{ id: 'd2', clientId: 'c1', updatedAt: '2026-10-21T00:00:00Z', draft: done }], plans: [] }).steps[0].state === 'todo')
  const runs = [
    { skillId: 'PATENT_IDEA', evaluation: 'rejected', structured: { ideas: [{ title: '폐기한 아이디어' }] } },
    { skillId: 'PATENT_IDEA', evaluation: 'draft', structured: { ideas: [{ title: '검토 전 아이디어', coreIdea: '핵심' }] } },
    { skillId: 'PATENT_IDEA', evaluation: 'adopted', structured: { ideas: [{ title: '채택 아이디어' }] } },
    { skillId: 'AX_STRATEGY', evaluation: 'adopted', structured: { ideas: [{ title: '다른 작업' }] } },
  ]
  const lines = priorIdeaLines(runs)
  check('PB5 AI 전략실 특허 아이디어 → 폐기 빼고 · 채택 먼저 · 검토 전은 표시 · 다른 작업 결과는 안 섞음', lines.join('|') === '채택 아이디어|(검토 전) 검토 전 아이디어 — 핵심', lines)
}

console.log(`\n${passed} passed, ${failed} failed`)
if (failed) process.exit(1)
