/**
 * D-250 특허 · 벤처 대화창 — 규칙 답(AI 아님). 진행판(pvBoard) · 명세서 엔진 · 명세서 점검 결과를 짧은 답 카드로.
 */
import { PV_HOME, STEP_TITLE, planHref, planStateOf, pvBoard, specHref, specStateOf, type PvDraftInput, type PvPlanInput } from '../patent/pvBoard'
import { normalizeDraft, claimsOf } from '../patent/specDraft'
import type { SpecReport } from '../patent/specCheck'
import type { AssistContext } from '../aiAssist/context'
import { historyRows, type ChatAnswer, type ChatGuideStep, type ChatStarter, type ChatTopic, type ChatTurn } from './chatTypes'

export interface PvChatData {
  clientId: string
  clientName: string
  drafts: readonly PvDraftInput[]
  plans: readonly PvPlanInput[]
  clients: readonly { id: string; companyName: string }[]
}

export const PV_STARTERS: readonly ChatStarter[] = [
  { id: 'status', label: '지금 어디까지 했나요?', ask: '지금 어디까지 했나요?' },
  { id: 'write', label: '특허 명세서 쓰기', ask: '특허 명세서를 쓰고 싶어요' },
  { id: 'check', label: '명세서 점검하기', ask: '명세서가 맞게 됐는지 점검하고 싶어요' },
  { id: 'plan', label: '벤처 사업계획서', ask: '벤처 사업계획서를 쓰고 싶어요' },
]

/** 쓴 말 → 주제(앞에서부터) */
export const PV_TOPICS: readonly ChatTopic[] = [
  { id: 'status', words: /어디까지|진행|현황|상태|뭐부터|무엇부터|이어서|다음에?\s*(뭐|무엇|할)/ },
  { id: 'check', words: /점검|검사|오류|에러|hwpx|서식|특허로|틀린|맞는지|맞게/i },
  { id: 'plan', words: /사업\s*계획|계획서|벤처/ },
  { id: 'write', words: /명세서|청구항|특허|아이디어|도면|본문|발명|견본|연습/ },
]

const draftsOf = (data: PvChatData) => [...data.drafts].filter((d) => !data.clientId || d.clientId === data.clientId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
const planOf = (data: PvChatData) => (data.clientId ? data.plans.filter((p) => p.clientId === data.clientId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null : null)

const startActions = (): ChatAnswer['actions'] => [
  { id: 'new-spec', label: '새 명세서 쓰기', act: 'new-spec', primary: true },
  { id: 'sample', label: '견본으로 연습', act: 'sample' },
]

function statusAnswer(data: PvChatData): ChatAnswer {
  const rows = pvBoard({ drafts: data.drafts, plans: data.plans, clients: data.clients })
  if (data.clientId) {
    const r = rows.find((x) => x.key === data.clientId)
    if (!r) {
      return { title: `${data.clientName || '이 회사'}는 아직 시작 전이에요`, lines: ['명세서부터 쓰면 그 요약이 벤처 사업계획서 재료가 됩니다.'], tone: 'info', actions: startActions(), source: 'rule', topic: 'status' }
    }
    const lines: string[] = []
    if (r.spec) lines.push(`명세서: ${r.spec.title || '(명칭 아직 없음)'} · ${r.spec.done}/${r.spec.total}단계${r.spec.errors ? ` · 고칠 것 ${r.spec.errors}` : ''}`)
    else lines.push('명세서: 아직 없음')
    if (r.plan) lines.push(`사업계획서: 서술 ${r.plan.narrative}/${r.plan.narrativeTotal} · 핵심 요약 ${r.plan.core}/${r.plan.coreTotal}${r.plan.hasPatent ? ' · 특허 재료 있음' : ''}`)
    else lines.push('사업계획서: 아직 시작 전')
    const actions: ChatAnswer['actions'] = [{ id: 'next', label: r.next.label, href: r.next.href, primary: true }]
    if (r.spec && !r.next.href.includes(`draft=${encodeURIComponent(r.spec.id)}`)) actions.push({ id: 'spec', label: '명세서 열기', href: specHref(r.spec.id, r.clientId) })
    if (!r.next.href.includes('/plan')) actions.push({ id: 'plan', label: '사업계획서 열기', href: planHref(r.clientId) })
    return { title: r.next.text, lines, tone: r.stage === 'done' ? 'ok' : r.stage.endsWith('fix') ? 'warn' : 'info', actions, source: 'rule', topic: 'status' }
  }
  if (!rows.length) return { title: '아직 시작한 것이 없어요', lines: ['회사를 고르고 명세서부터 쓰면 그 요약이 벤처 사업계획서 재료가 됩니다.'], tone: 'info', actions: startActions(), source: 'rule', topic: 'status' }
  return {
    title: `진행 중 ${rows.filter((r) => r.stage !== 'done').length}건 — 최근 순`,
    lines: rows.slice(0, 4).map((r) => `${r.companyName} — ${r.next.text}`),
    tone: 'info',
    actions: rows.slice(0, 3).map((r, i) => ({ id: `row-${r.key}`, label: `${r.companyName} 이어서`, href: r.next.href, primary: i === 0 })),
    source: 'rule',
    topic: 'status',
  }
}

function writeAnswer(data: PvChatData): ChatAnswer {
  const list = draftsOf(data)
  if (!list.length) {
    return {
      title: '새 명세서를 시작해요',
      lines: ['아이디어 질문 5개 → 권리축 7줄만 적으면 구성요소 · 도면 · 청구항 · 본문 뼈대가 저절로 나와요.', '처음이면 견본(연습용 발명)으로 한 번 따라 해 보세요.'],
      tone: 'info',
      actions: startActions(),
      source: 'rule',
      topic: 'write',
    }
  }
  const s = specStateOf(list[0])
  return {
    title: `${s.title || '(명칭 아직 없음)'} — ${s.done}/${s.total}단계`,
    lines: [s.step === 'check' && s.done === s.total ? '다 썼어요 — 점검하고 내려받으면 됩니다.' : `다음은 ${STEP_TITLE[s.step]}`, ...(list.length > 1 ? [`${data.clientId ? '이 회사' : '전체'} 명세서 ${list.length}건 중 가장 최근 것`] : [])],
    tone: s.errors ? 'warn' : 'info',
    actions: [
      { id: 'open', label: '이어서 쓰기', href: specHref(s.id, list[0].clientId, s.step), primary: true },
      { id: 'new-spec', label: '새 명세서', act: 'new-spec' },
      ...(list.length > 1 ? [{ id: 'list', label: `명세서 ${list.length}건 보기`, href: `${PV_HOME}/write` }] : []),
    ],
    source: 'rule',
    topic: 'write',
  }
}

function checkAnswer(data: PvChatData): ChatAnswer {
  const done = draftsOf(data).find((d) => specStateOf(d).step === 'check')
  return {
    title: '명세서 파일을 올려 주세요',
    lines: ['특허로 서식(.hwpx) 또는 MD 파일 — 형식 · 도면 · 청구항이 서로 맞는지 바로 봅니다.', ...(done ? ['여기서 쓴 명세서는 6 점검 단계에서 파일 없이 볼 수 있어요.'] : [])],
    tone: 'info',
    actions: [{ id: 'file', label: '파일 올리기', act: 'file', primary: true }, ...(done ? [{ id: 'own', label: '쓴 명세서 점검', href: specHref(done.id, done.clientId, 'check') }] : [])],
    source: 'rule',
    topic: 'check',
  }
}

function planAnswer(data: PvChatData): ChatAnswer {
  if (!data.clientId) return { title: '어느 회사 사업계획서인가요?', lines: ['위에서 회사를 먼저 골라 주세요.'], tone: 'info', actions: [{ id: 'pick', label: '회사 고르기', act: 'pick-client', primary: true }], source: 'rule', topic: 'plan' }
  const p = planOf(data)
  const spec = draftsOf(data)[0]
  if (!p || !Object.keys(p.notes).some((k) => k.startsWith('vplan:') && String(p.notes[k] ?? '').trim())) {
    return {
      title: '사업계획서는 아직 시작 전이에요',
      lines: ['신청서 칸 순서 그대로 씁니다 — 칸마다 [복사] 해서 신청 사이트에 붙이면 끝.', ...(spec ? ['이 회사 명세서가 있어서 재료 칸에서 바로 가져올 수 있어요.'] : ['특허 명세서를 먼저 쓰면 재료로 바로 들어가요.'])],
      tone: 'info',
      actions: [{ id: 'plan', label: '사업계획서 쓰기', href: planHref(data.clientId), primary: true }, ...(spec ? [] : [{ id: 'new-spec', label: '명세서 먼저 쓰기', act: 'new-spec' as const }])],
      source: 'rule',
      topic: 'plan',
    }
  }
  const st = planStateOf(p.notes)
  const lines = [st.complete ? `다 썼어요 — 신청 사이트에 넣은 칸 ${st.entered}/${st.total}` : `아직 빈 칸이 있어요 — 서술 ${st.narrativeTotal - st.narrative}칸 · 핵심 요약 ${st.coreTotal - st.core}칸`]
  if (st.warn) lines.push(`내기 전에 고칠 것 ${st.warn}개`)
  lines.push(st.hasPatent ? '특허 재료 들어 있음' : spec ? '특허 재료가 비었어요 — 재료 칸에서 이 회사 명세서를 바로 가져오세요' : '특허 재료가 비었어요')
  return { title: `서술 ${st.narrative}/${st.narrativeTotal} · 핵심 요약 ${st.core}/${st.coreTotal}`, lines, tone: st.warn ? 'warn' : st.complete ? 'ok' : 'info', actions: [{ id: 'plan', label: '이어서 쓰기', href: planHref(data.clientId), primary: true }], source: 'rule', topic: 'plan' }
}

export function pvHelpAnswer(owner: boolean): ChatAnswer {
  return {
    title: '이렇게 물어보세요',
    lines: ['"지금 어디까지 했어?" · "명세서 쓰고 싶어" · "명세서 점검" · "사업계획서"', owner ? 'AI 연결이 아직 안 돼 있어 정해진 답만 드려요 — 설정의 AI 연결을 확인해 주세요.' : '아래 단추를 누르면 바로 답해요.'],
    tone: 'info',
    actions: [],
    source: 'rule',
    topic: 'help',
  }
}

/** 시작 단추 · 찾은 주제 → 답 */
export function pvAnswer(topic: string, data: PvChatData, owner = false): ChatAnswer {
  if (topic === 'status') return statusAnswer(data)
  if (topic === 'write') return writeAnswer(data)
  if (topic === 'check') return checkAnswer(data)
  if (topic === 'plan') return planAnswer(data)
  return pvHelpAnswer(owner)
}

/** 올린 명세서 파일 점검 결과 → 답 */
export function pvFileAnswer(fileName: string, report: SpecReport): ChatAnswer {
  const bad = report.findings.filter((f) => f.level === 'error')
  const warn = report.findings.filter((f) => f.level === 'warn')
  const top = [...bad, ...warn].slice(0, 5).map((f) => `${f.level === 'error' ? '✕' : '△'} ${f.title}${f.fix ? ` — ${f.fix}` : ''}`)
  return {
    title: bad.length ? `고칠 것 ${bad.length}개 · 확인할 것 ${warn.length}개` : warn.length ? `고칠 것 없음 · 확인할 것 ${warn.length}개` : '고칠 것 없음 ✓',
    lines: [`${fileName} · 청구항 ${report.summary.claims}개(독립 ${report.summary.independent}) · 도면 ${report.summary.figs.length}장`, ...top, ...(bad.length + warn.length > 5 ? [`외 ${bad.length + warn.length - 5}개 — 점검 화면에서 모두 볼 수 있어요`] : [])],
    tone: bad.length ? 'warn' : 'ok',
    actions: [
      { id: 'detail', label: '점검 화면에서 자세히', href: `${PV_HOME}/spec-check`, primary: !!bad.length },
      { id: 'file', label: '다른 파일 올리기', act: 'file' },
    ],
    source: 'rule',
    topic: 'check',
  }
}

/** AI 에 보낼 자료 — 진행 · 명칭 · 구성요소 이름 · 점검 수만(발명 본문은 보내지 않는다) */
export function pvAiContext(data: PvChatData, turns: readonly ChatTurn[], today: string): AssistContext {
  const list = draftsOf(data).slice(0, 6)
  const p = planOf(data)
  const st = p ? planStateOf(p.notes) : null
  return {
    title: '특허 · 벤처 대화창',
    today,
    purpose: '대표가 이 회사의 특허 명세서 · 벤처 사업계획서 진행을 묻는다. 화면에 있는 진행 기록만 근거로 답한다.',
    sections: [
      { name: '회사', rows: [{ 회사: data.clientName || '(회사 고르지 않음 — 전체)' }] },
      {
        name: '명세서',
        rows: list.map((d) => {
          const s = specStateOf(d)
          const dr = normalizeDraft(d.draft)
          return { 명칭: s.title || '(없음)', 단계: `${s.done}/${s.total}`, 다음: STEP_TITLE[s.step], 고칠것: s.errors, 견본: s.sample ? '예(연습용)' : '', 구성요소: dr.components.filter((c) => c.name.trim()).map((c) => `${c.name}(${c.no})`), 청구항수: claimsOf(dr).length }
        }),
      },
      { name: '사업계획서', rows: st ? [{ 서술: `${st.narrative}/${st.narrativeTotal}`, 핵심요약: `${st.core}/${st.coreTotal}`, 사이트입력: `${st.entered}/${st.total}`, 고칠것: st.warn, 특허재료: st.hasPatent ? '있음' : '없음' }] : [] },
      { name: '앞선 대화', rows: historyRows(turns) },
    ],
  }
}

/** [사용 방법] — 처음 쓰는 사람용(대표 "사용 방법만 좀 자세히") */
export const PV_GUIDE: readonly ChatGuideStep[] = [
  { head: '회사부터 고르세요(안 골라도 됩니다)', body: "맨 위 '회사' 칸에서 고르면 그 회사의 명세서 · 사업계획서만 보고 답해요.\n회사 없이 명세서를 먼저 써도 됩니다 — 나중에 골라도 돼요." },
  {
    head: '단추 하나만 누르면 됩니다',
    body: '지금 어디까지 했나요? — 다음에 할 일 하나와 바로 가는 단추\n특허 명세서 쓰기 — 새로 쓰거나 쓰던 것 이어 쓰기\n명세서 점검하기 — HWPX · MD 파일을 올리면 형식 · 도면 · 청구항을 바로 점검\n벤처 사업계획서 — 신청서 칸 순서대로, 특허 명세서를 재료로',
  },
  {
    head: '궁금한 건 그냥 물어보세요',
    body: '질문창에 말하듯 쓰고 Enter.\n대표 계정: ✨ AI가 이 회사 기록(명세서 명칭 · 진행 단계 · 구성요소 이름 · 사업계획서 진행)만 보고 답해요. 발명 본문은 보내지 않아요.\n팀장 계정 · AI 연결 전: 정해진 답으로 바로 알려 드려요.',
  },
  { head: '답 아래 단추로 바로 작업', body: "[이어서 쓰기] [사업계획서 쓰기] 처럼 답 아래 단추를 누르면 그 작업 화면이 바로 열려요. 끝나면 왼쪽 메뉴 '특허 · 벤처'로 돌아오면 대화가 그대로 있어요.\n바로 답 아래 [✨ AI로 더 자세히]를 누르면 같은 질문을 AI에게 다시 물어요(대표만)." },
  { head: '전체 순서', body: '① 명세서: 아이디어 질문 5개 → 권리축 7줄 → 구성요소 · 도면 → 청구항 → 본문 → 점검 · 내려받기\n② 점검: 특허로에 넣기 전에 형식 확인(📎 파일 올리기)\n③ 벤처 사업계획서: 재료(특허 명세서)를 가져와 칸 채우기 → 칸마다 복사해 신청 사이트에 붙이기' },
  { head: '처음이면 견본으로 연습', body: '[견본으로 연습]을 누르면 1~4단계가 채워진 연습용 발명(실제 고객 발명 아님)이 열려요. 무엇을 어떻게 적는지 보면서 5 본문을 직접 써 보세요.' },
  { head: '예전 전체 화면은 [자세히]', body: '오른쪽 위 [자세히]를 누르면 회사별 진행판 · 명세서 쓰기 · 사업계획서 · 명세서 점검 카드가 있는 예전 화면이 그대로 있어요.' },
  { head: '알아 둘 것', body: '출원 · 신청 제출은 대표님이 특허로 · 신청 사이트에서 직접 합니다.\nAI 답은 참고용 — 제도 · 숫자는 공식 자료로 한 번 더 확인해 주세요.' },
]
