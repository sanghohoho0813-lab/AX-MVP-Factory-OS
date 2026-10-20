/**
 * D-247 특허 명세서 쓰기 — 조사 · 명칭 · 권리축 → 구성요소 · 단계 · 도면 · 청구항 뼈대 · 본문 뼈대 · 복붙용 MD(명세서 점검 0 오류) ·
 * 점검 · 진행 · AI 작업실 아이디어 → 초안 · AI 합치기(고친 칸 보호) · AI 묶음 · 보낼 자료 · 답 읽기.
 *
 * 시험용 발명(공구 마모 예측)은 실제 고객 발명과 상관없다.
 */
import { ASSISTS, buildAssistPrompt } from '../../../api/_ai/assists.js'
import { ASSIST_PRESETS } from '../aiAssist/presets'
import { checkSpec } from '../patent/specCheck'
import { parseSpecText } from '../patent/specParse'
import {
  asAdnominal,
  batchimOf,
  checkDraft,
  checkTitle,
  claimSkeleton,
  claimsOf,
  defaultFigures,
  draftFromIdea,
  draftProgress,
  drawingDescLines,
  emptyDraft,
  figureSubject,
  josa,
  mergeSpecAi,
  normalizeDraft,
  sectionSkeleton,
  signLines,
  skeletonFromAxis,
  specMarkdown,
  splitClaims,
  titleFromFormula,
  titleLine,
  titleParts,
  type SpecDraft,
} from '../patent/specDraft'
import { SPEC_BATCHES, buildSpecContext, joinDetail, specItemsOf } from '../patent/specDraftAi'

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

/** 다 채운 초안 — 뼈대만으로도 점검 0 오류가 나와야 한다 */
function fullDraft(): SpecDraft {
  const d = emptyDraft()
  d.title = '공구 진동정보 기반 마모상태 판정 및 교체시점 산출 시스템 및 방법'
  d.titleEn = 'SYSTEM AND METHOD FOR DETERMINING TOOL WEAR AND REPLACEMENT TIME BASED ON VIBRATION DATA'
  d.idea = {
    problem: '가공 현장에서 공구 교체 시점을 작업자의 감으로 정해 불량과 과잉 교체가 반복된다.',
    prior: '종래에는 정해진 사용 시간이 지나면 공구를 일괄 교체하였다.',
    distinct: '공구별 진동 특성을 기준값과 비교해 마모 단계를 나누고 다음 작업 일정에 맞춰 교체 시점을 산출한다.',
    flow: '진동 수집 → 측정항목 정규화 → 마모 지수 갱신 → 마모 단계 판정 → 교체 알림 → 교체 결과 재반영',
    point: '마모 지수의 누적 갱신과 작업 일정을 함께 써서 교체 시점을 정하는 연결',
  }
  d.axis = {
    input: '공구의 진동신호를 수집하는',
    process: '진동신호를 측정항목으로 정규화하는',
    state: '측정항목으로 공구별 마모 지수를 누적 갱신하는',
    judge: '마모 지수와 기준값을 비교하여 마모 단계를 판정하는',
    output: '마모 단계와 작업 일정으로 교체 시점을 산출하여 알리는',
    feedback: '교체 결과를 기준값에 다시 반영하는',
    link: '누적 갱신한 마모 지수와 작업 일정을 함께 써서 교체 시점을 산출',
  }
  const sk = skeletonFromAxis(d.axis)
  d.components = sk.components
  d.steps = sk.steps
  d.components[3].name = '마모판정부'
  d.systemName = '공구관리 시스템'
  d.seeds = [{ comp: '140', text: '마모 단계를 정상 · 주의 · 교체의 세 단계로 나누는' }]
  return d
}

/* ---------------- 조사 ---------------- */
{
  check('J1 받침 — 부 · 시스템 · 단계 · 판정부(140) · 도 1 · 도 2', batchimOf('부') === 0 && batchimOf('시스템') > 0 && batchimOf('판정부(140)') === 0 && batchimOf('1') === 8 && batchimOf('2') === 0)
  check('J2 을/를 · 은/는 · 이/가 · 으로/로', josa('판정부(140)', '은/는') === '는' && josa('시스템', '은/는') === '은' && josa('도 3', '은/는') === '은' && josa('도 2', '을/를') === '를' && josa('도 1', '이/가') === '이' && josa('서울', '으로/로') === '로' && josa('부산항', '으로/로') === '으로')
}

/* ---------------- 명칭 ---------------- */
{
  check('N1 명칭 공식 — [대상] 기반 [판단] 및 [결과] 시스템 및 방법', titleFromFormula('공구 진동정보', '마모상태 판정', '교체시점 산출') === '공구 진동정보 기반 마모상태 판정 및 교체시점 산출 시스템 및 방법')
  check('N2 시스템 · 방법 이름 나누기', titleParts('가 기반 나 시스템 및 방법').system === '가 기반 나 시스템' && titleParts('가 기반 나 시스템 및 방법').method === '가 기반 나 방법' && titleParts('측정 장치').method === '측정 방법' && titleParts('산출 방법').system === '산출 시스템')
  check('N3 한글{ENGLISH} 한 문단 · 중괄호 한 번', titleLine({ title: '가 시스템', titleEn: '{A SYSTEM}' }) === '가 시스템{A SYSTEM}')
  const bad = checkTitle({ title: '혁신적인 스마트한 플랫폼\n', titleEn: '' }).map((x) => x.id)
  check('N4 명칭 점검 — 영문 없음 · 두 줄 · 끝말 · 마케팅 말', ['T_EN', 'T_LINES', 'T_KIND', 'T_MARKETING'].every((x) => bad.includes(x)), bad)
  check('N5 영문 라벨 · 이상한 글자', checkTitle({ title: '가 시스템', titleEn: 'English Title: 가나' }).map((x) => x.id).join() === 'T_EN_CHAR,T_LABEL')
  check('N6 잘 쓴 명칭은 점검 0', checkTitle(fullDraft()).length === 0, checkTitle(fullDraft()))
}

/* ---------------- 권리축 → 뼈대 ---------------- */
{
  check('A1 ~하는 꼴 — 그대로 · 한다 · 하다 · 함 · 명사', asAdnominal('수집하는') === '수집하는' && asAdnominal('정규화한다.') === '정규화하는' && asAdnominal('비교하다') === '비교하는' && asAdnominal('알림 발송함') === '알림 발송하는' && asAdnominal('마모 판정') === '마모 판정을 수행하는')
  const sk = skeletonFromAxis({ input: '진동신호를 수집하는', process: '', state: '지수를 갱신한다', judge: '단계를 판정하는', output: '', feedback: '', link: '연결' })
  check('A2 빈 줄 건너뛰고 110 · 120 · 130 / S110 …', sk.components.map((c) => `${c.no}:${c.name}`).join() === '110:데이터 수집부,120:상태 갱신부,130:판정부' && sk.steps.map((s) => s.no).join() === 'S110,S120,S130' && sk.components[1].does === '지수를 갱신하는', sk)
}

/* ---------------- 도면 · 부호 ---------------- */
{
  const d = fullDraft()
  check('F1 도면 프리셋 4장(구성 · 흐름 · 차별 관계 · 출력) · 5장이면 재반영', defaultFigures(4).map((f) => f.role).join() === 'system,flow,relation,output' && defaultFigures(5)[4].role === 'loop' && defaultFigures(99).length === 6)
  const lines = drawingDescLines(d)
  check('F2 도면의 간단한 설명 — 도 1은 … 블록도이다 · 도 2는 … 순서도이다 · 판정부 이름', lines[0] === '도 1은 본 발명의 일 실시예에 따른 공구관리 시스템(100)의 전체 구성을 나타낸 블록도이다.' && /^도 2는 .*방법의 처리 흐름을 나타낸 순서도이다\.$/.test(lines[1]) && lines[2].includes('마모판정부(140)의 판정 구조'), lines)
  check('F3 사람이 정한 그림 설명이 우선', figureSubject(d, { ...d.figures[2], subject: '마모 단계 표' }) === '마모 단계 표')
  check('F4 부호의 설명 — 100 시스템 + 구성요소', signLines(d).join('|') === '100: 공구관리 시스템|110: 데이터 수집부|120: 데이터 처리부|130: 상태 갱신부|140: 마모판정부|150: 결과 제공부|160: 피드백 반영부')
}

/* ---------------- 청구항 ---------------- */
{
  const d = fullDraft()
  const c = claimSkeleton(d)
  check('C1 시스템 독립항 — 구성요소마다 "~하는 이름;" · 및 · ;를 포함하는 시스템.', c[0].startsWith('공구의 진동신호를 수집하는 데이터 수집부; 진동신호를') && c[0].includes('; 및 교체 결과를 기준값에 다시 반영하는 피드백 반영부;를 포함하는 공구 진동정보 기반 마모상태 판정 및 교체시점 산출 시스템.'), c[0])
  check('C2 종속항 — 청구항 1에 있어서, 상기 마모판정부는 … 것을 특징으로 하는', c[1] === '청구항 1에 있어서, 상기 마모판정부는 마모 단계를 정상 · 주의 · 교체의 세 단계로 나누는 것을 특징으로 하는 공구 진동정보 기반 마모상태 판정 및 교체시점 산출 시스템.', c[1])
  check('C3 방법 독립항 — 단계 나열 · 방법으로 끝', c.length === 3 && /^컴퓨터에 의해 수행되는 방법으로서, 공구의 진동신호를 수집하는 단계; .* 단계;를 포함하는 공구 진동정보 기반 마모상태 판정 및 교체시점 산출 방법\.$/.test(c[2]), c[2])
  check('C4 고친 청구항이 있으면 그것', claimsOf({ ...d, claims: ['고친 청구항', ' '] }).join() === '고친 청구항')
}

/* ---------------- 본문 · MD ---------------- */
{
  const d = fullDraft()
  check('B1 뼈대 — 해결 수단은 구성 · 단계를 문장으로(쌍반점 없음)', /^상기 목적을 달성하기 위한 .*시스템은 공구의 진동신호를 수집하는 데이터 수집부, .* 및 .*피드백 반영부를 포함한다\./.test(sectionSkeleton(d, 'solution')) && !sectionSkeleton(d, 'solution').includes(';'), sectionSkeleton(d, 'solution'))
  const detail = sectionSkeleton(d, 'detail')
  check('B2 구체적인 내용 — 도 1 구성 · 구성요소마다 · 단계 S번호 · 도 3 · 도 4 · 조사', detail.includes('공구관리 시스템(100)은 데이터 수집부(110),') && detail.includes('마모판정부(140)는 마모 지수와') && detail.includes('단계 S140에서는') && detail.includes('도 3을 참조하여') && detail.includes('도 4를 참조하여'), detail)
  check('B3 요약 400자 이내', sectionSkeleton(d, 'abstract').length <= 400 && sectionSkeleton(d, 'abstract').startsWith('본 발명은 공구 진동정보 기반'))
  const md = specMarkdown(d)
  const order = ['**[발명의 명칭]**', '**[기술분야]**', '**[발명의 배경이 되는 기술]**', '**[해결하려는 과제]**', '**[과제의 해결 수단]**', '**[발명의 효과]**', '**[도면의 간단한 설명]**', '**[발명을 실시하기 위한 구체적인 내용]**', '**[부호의 설명]**', '**[청구항 1]**', '**[요약]**', '**[대표도]**']
  check('M1 MD 순서 — 명칭 → … → 청구항 → 요약 → 대표도', order.every((x, i) => md.indexOf(x) >= 0 && (i === 0 || md.indexOf(x) > md.indexOf(order[i - 1]))))
  check('M2 입력주의 고정문 · 명칭 한 문단 한글{ENGLISH}', md.startsWith('입력 주의') && md.includes(`\n${d.title}{${d.titleEn}}\n`))
  const nums = [...md.matchAll(/^\[(\d{4})\] /gm)].map((m) => Number(m[1]))
  check('M3 문단 번호 [0001] 부터 빠짐없이', nums.length > 10 && nums.every((n, i) => n === i + 1), nums.slice(0, 5))
  check('M4 대표도 — 없는 도면이면 마지막 도면으로', specMarkdown({ ...d, repFig: 9 }).trim().endsWith('도 4'))
  for (const notice of [false, true]) {
    const r = checkSpec(parseSpecText(specMarkdown(d, { notice }), '복붙용.md'))
    check(`M5 명세서 점검(D-245) — 고쳐야 할 것 0 (입력주의 ${notice ? '있음' : '없음'})`, r.counts.error === 0, r.findings.filter((f) => f.level === 'error').map((f) => `${f.id}:${f.title}`))
  }
  const off = specMarkdown({ ...d, numbered: false }, { notice: false })
  check('M6 문단 번호 끄기', !/^\[\d{4}\]/m.test(off))
}

/* ---------------- 점검 · 진행 ---------------- */
{
  const empty = checkDraft(emptyDraft()).map((x) => x.id)
  check('K1 빈 초안 — 명칭 · 아이디어 · 구성요소 · 청구항 없음', ['T_EMPTY', 'IDEA_GAP', 'PARTS_FEW', 'CLAIMS_NONE'].every((x) => empty.includes(x)), empty)
  const d = fullDraft()
  check('K2 다 채운 초안 — 오류 0', !checkDraft(d).some((x) => x.level === 'error'), checkDraft(d))
  const dup = checkDraft({ ...d, components: [...d.components, { ...d.components[0] }] }).map((x) => x.id)
  check('K3 부호 · 이름 겹침', dup.includes('PARTS_DUP') && dup.includes('PARTS_NAME'))
  check('K4 대표도가 없는 도면', checkDraft({ ...d, repFig: 7 }).some((x) => x.id === 'FIG_REP'))
  check('K5 독립항에 연결관계 말이 없으면 주의', checkDraft({ ...d, claims: ['데이터를 받는 수신부; 및 결과를 보내는 송신부;를 포함하는 시스템.', '방법.'] }).some((x) => x.id === 'CLAIM_LINK'))
  check('K6 학습 모델 없이 AI 라는 말', checkDraft({ ...d, title: 'AI 기반 마모 판정 시스템 및 방법' }).some((x) => x.id === 'AI_WORD') && !checkDraft({ ...d, title: 'AI 기반 마모 판정 시스템 및 방법', axis: { ...d.axis, judge: '학습 모델로 마모 단계를 예측하는' } }).some((x) => x.id === 'AI_WORD'))
  check('K7 본문에 내부 작업 문구 · 마크다운', checkDraft({ ...d, text: { effect: '이번 검토에서 강화 포인트', field: '**굵게**' } }).map((x) => x.id).filter((x) => x.startsWith('BODY_') && x !== 'BODY_SKELETON').sort().join() === 'BODY_INTERNAL_effect,BODY_MD_field', checkDraft({ ...d, text: { effect: '이번 검토에서 강화 포인트', field: '**굵게**' } }).map((x) => x.id))
  const p0 = draftProgress(d)
  check('K8 진행 — 본문을 아직 안 고쳤으면 본문 단계 미완', p0.steps.idea && p0.steps.parts && p0.steps.figures && p0.steps.claims && !p0.steps.body && p0.steps.check)
  const p1 = draftProgress({ ...d, text: { field: 'a', background: 'b', problem: 'c', effect: 'd' } })
  check('K9 본문 네 칸 이상 쓰면 완료', p1.done === p1.total)
}

/* ---------------- AI 작업실 아이디어 → 초안 ---------------- */
{
  const base = { ...emptyDraft(), idea: { ...emptyDraft().idea, problem: '사람이 쓴 문제' } }
  const d = draftFromIdea(base, { title: '가 기반 나 시스템 및 방법', problem: 'AI 문제', priorArt: '기존', coreIdea: '핵심', distinct: ['차별1', '차별2'], dataFlow: ['수집', '판정'], procedure: ['진동을 수집한다', '마모를 판정한다'], independentClaim: '연결', dependentClaims: ['세 단계로 나누는'] }, 'AI 작업실 · 특허 아이디어 1')
  check('I1 이미 적은 칸은 그대로 · 빈 칸만 채움', d.idea.problem === '사람이 쓴 문제' && d.idea.prior === '기존' && d.idea.distinct === '핵심 · 차별1 · 차별2' && d.idea.flow === '수집 → 판정' && d.axis.link === '연결' && d.title === '가 기반 나 시스템 및 방법')
  check('I2 처리 절차 → 단계 · 종속항 후보 → 씨앗', d.steps.map((s) => `${s.no}:${s.text}`).join() === 'S110:진동을 수집하는,S120:마모를 판정하는' && d.seeds[0].text === '세 단계로 나누는' && d.source === 'AI 작업실 · 특허 아이디어 1')
}

/* ---------------- AI 합치기 ---------------- */
{
  const d: SpecDraft = { ...fullDraft(), text: { field: '사람이 쓴 기술분야', background: 'AI 옛 글' }, ai: { background: 'AI 옛 글' } }
  const r = mergeSpecAi(d, [
    { key: 'field', text: '새 기술분야' },
    { key: 'background', text: '## 새 배경\n\n\n\n[0001] **둘째** 문단' },
    { key: 'problem', text: '처음 과제' },
    { key: 'claims', text: '청구항 1. 가를 포함하는 시스템.\n\n청구항 2. 청구항 1에 있어서, 나 것을 특징으로 하는 시스템.' },
  ])
  check('G1 사람이 고친 칸 → 그대로 · 새 안 따로', r.kept.join() === 'field' && r.draft.text.field === '사람이 쓴 기술분야' && r.draft.suggestion.field === '새 기술분야')
  check('G2 AI 가 쓴 그대로인 칸 → 바꿈 · 마크다운 · 문단 번호 지움', r.draft.text.background === '새 배경\n\n둘째 문단' && r.draft.ai.background === '새 배경\n\n둘째 문단', r.draft.text.background)
  check('G3 빈 칸 · 청구항(머리로 나눔)', r.draft.text.problem === '처음 과제' && r.draft.claims.length === 2 && r.draft.claims[1].startsWith('청구항 1에 있어서') && r.replaced.includes('claims'))
  check('G4 청구항 나누기 — [청구항 n] · 빈 줄 · 머리 하나', splitClaims('[청구항 1]\n가\n[청구항 2]\n나').join('|') === '가|나' && splitClaims('가 시스템.\n\n나 방법.').length === 2 && splitClaims('청구항 1. 하나뿐.').join() === '하나뿐.')
  const heads = mergeSpecAi(emptyDraft(), [{ key: 'claims', text: '**[청구항 1]**\n가 시스템.\n**[청구항 2]**\n청구항 1에 있어서, 나.' }])
  check('G4b AI 청구항 머리가 굵은 글씨여도 나눔', heads.draft.claims.join('|') === '가 시스템.|청구항 1에 있어서, 나.', heads.draft.claims)
  const again = mergeSpecAi(r.draft, [{ key: 'claims', text: '청구항 1. 다른 안.' }])
  check('G5 AI 청구항 그대로면 다음 AI 안으로 바꿈', again.replaced.join() === 'claims' && again.draft.claims.join() === '다른 안.')
  const edited = mergeSpecAi({ ...r.draft, claims: ['사람이 고친 청구항'] }, [{ key: 'claims', text: '청구항 1. 또 다른 안.' }])
  check('G6 사람이 고친 청구항 → 새 안 따로', edited.kept.join() === 'claims' && edited.draft.claims.join() === '사람이 고친 청구항' && edited.draft.suggestion.claims === '또 다른 안.')
}

/* ---------------- AI 묶음 · 자료 · 답 ---------------- */
{
  check('S1 묶음 5개 · 화면 · 서버 이름표 같음(page patent · write)', SPEC_BATCHES.length === 5 && SPEC_BATCHES.every((b) => ASSISTS[b.assistId]?.page === 'patent' && ASSISTS[b.assistId]?.kind === 'write' && ASSIST_PRESETS.some((p) => p.id === b.assistId && p.label === ASSISTS[b.assistId].label)))
  const d = { ...fullDraft(), text: { field: '이미 쓴 기술분야', detail: '구성 '.repeat(400) } }
  const a = buildSpecContext({ batch: 'a', draft: d, today: '2026-10-20' })
  const rows = a.sections.flatMap((s) => s.rows)
  check('S2 자료 — 명칭 · 아이디어 · 권리축 · 구성요소(100 포함) · 단계 · 도면 · 600자 이하', ['명칭', '아이디어', '권리축', '구성요소', '단계', '도면'].every((n) => a.sections.some((s) => s.name === n)) && a.sections.find((s) => s.name === '구성요소')!.rows[0].part === '100' && rows.every((r) => String(r.memo ?? '').length <= 600))
  check('S3 이번 묶음 칸은 "이미 쓴 칸" 에서 빼고 · 청구항 뼈대는 b · e 만', !JSON.stringify(a.sections.find((s) => s.name === '이미 쓴 칸')?.rows ?? []).includes('이미 쓴 기술분야') && !a.sections.some((s) => s.name === '청구항 뼈대') && buildSpecContext({ batch: 'e', draft: d, today: '' }).sections.some((s) => s.name === '청구항 뼈대'))
  check('S4 규칙 — 공통 + 묶음 칸 규칙 · AI 라고 부르지 않음', a.rules!.some((r) => r.startsWith('칸 field')) && a.rules!.some((r) => r.includes('AI · 인공지능')) && buildSpecContext({ batch: 'e', draft: d, today: '' }).rules!.some((r) => r.includes('연결관계')))
  const p = buildAssistPrompt(ASSISTS['spec.c'], buildSpecContext({ batch: 'c', draft: d, today: '2026-10-20' }), '')
  check('S5 서버가 만드는 글 — 4만 자 안 · 구성요소 이름 들어감', p.user.length < 40000 && p.user.includes('마모판정부'))
  const items = specItemsOf({ headline: 'x', items: [{ title: 'field', body: '가' , detail: '확인' }, { title: '발명의 배경이 되는 기술', body: '나' }, { title: 'claims', body: '다른 묶음' }, { title: 'effect', body: '' }] }, 'a')
  check('S6 답 읽기 — 이름표 · 칸 이름 · 다른 묶음 칸 · 빈 본문 버림 · 확인할 점', items.map((i) => i.key).join() === 'field,background' && items[0].note === '확인')
  check('S7 칸 하나인 묶음은 이름표가 어긋나도 첫 본문', specItemsOf({ headline: '', items: [{ title: '청구범위 전체', body: '청구항 1. 가' }] }, 'e')[0]?.key === 'claims' && specItemsOf({ headline: '', items: [{ title: '엉뚱', body: '본문' }] }, 'd')[0]?.key === 'detail2')
  check('S8 구체적인 내용 앞 · 뒤 잇기', joinDetail(' 앞 ', '') === '앞' && joinDetail('앞', '뒤') === '앞\n\n뒤')
}

/* ---------------- 저장된 것 읽기 ---------------- */
{
  const n = normalizeDraft({ title: 3, components: [{ no: '110', name: '가', does: 1 }], figures: [{ role: 'weird', subject: 's' }], repFig: -1, text: { field: '가', bad: '나' }, numbered: false })
  check('R1 이상한 값 → 안전하게(빈 글 · 기본 도면 · 대표도 1 · 모르는 칸 버림)', n.title === '' && n.components[0].does === '' && n.figures[0].role === 'custom' && n.repFig === 1 && Object.keys(n.text).join() === 'field' && n.numbered === false)
  check('R2 아무것도 아니면 빈 초안', normalizeDraft(null).figures.length === 4 && normalizeDraft('x').numbered === true)
}

console.log(`\n${passed} passed, ${failed} failed`)
if (failed) process.exit(1)
