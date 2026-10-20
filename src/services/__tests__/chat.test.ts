/**
 * D-250 대화창(특허 · 벤처 · 기업인증) — 규칙 답 · 주제 찾기 · 기록 · AI 에 보내는 자료.
 * 시험용 발명(공구 마모 예측)은 실제 고객 발명과 상관없다.
 */
import { assessAll } from '../../certification/core/assess'
import { buildRoadmap } from '../../certification/core/roadmap'
import { FIELD_COS, FIELD_TODAY } from '../../certification/__tests__/fieldFixtures'
import { NARRATIVE_IDS, VK } from '../../certification/core/venturePlan'
import { sampleDraft } from '../patent/specCoach'
import { checkSpec } from '../patent/specCheck'
import { parseSpecText } from '../patent/specParse'
import { ASSIST_PRESETS } from '../aiAssist/presets'
import { HISTORY_MAX, answerFromAi, answerText, historyKey, historyRows, parseHistory, topicOf, type ChatTurn } from '../workChat/chatTypes'
import { PV_GUIDE, PV_STARTERS, PV_TOPICS, pvAiContext, pvAnswer, pvFileAnswer, pvHelpAnswer, type PvChatData } from '../workChat/pvChat'
import { CERT_GUIDE, CERT_STARTERS, certAiContext, certChatAnswer, certOfText, certTopicOf, type CertChatData } from '../workChat/certChat'

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

const TODAY = '2026-10-20'
const CLIENT = 'cli_tool'
const clients = [{ id: CLIENT, companyName: '공구마모(주)' }, { id: 'cli_b', companyName: '다른회사' }]
const pv = (over: Partial<PvChatData> = {}): PvChatData => ({ clientId: CLIENT, clientName: '공구마모(주)', drafts: [], plans: [], clients, ...over })
const draftRow = (id: string, clientId: string, draft: unknown, updatedAt = '2026-10-19T09:00:00Z') => ({ id, clientId, updatedAt, draft })
const done = (q: string, title: string): ChatTurn => ({ id: `t_${q}`, at: '2026-10-20T01:00:00Z', q, a: { title, lines: [], tone: 'info', actions: [], source: 'rule' }, status: 'done' })

/* ---------------- 공통 ---------------- */
{
  check('C1 기록 키 — 모듈 · 회사마다(회사 없으면 none)', historyKey('pv', '') === 'axmvp.workchat.v1.pv.none' && historyKey('cert', 'c1') === 'axmvp.workchat.v1.cert.c1')
  check('C2 깨진 기록 · 배열 아님 · 빈 값 → 빈 대화', parseHistory('{') .length === 0 && parseHistory('{"a":1}').length === 0 && parseHistory(null).length === 0 && parseHistory('[1,null,{"id":3}]').length === 0)
  const many = Array.from({ length: 30 }, (_, i) => done(`질문${i}`, `답${i}`))
  const parsed = parseHistory(JSON.stringify(many))
  check(`C3 기록은 최근 ${HISTORY_MAX}개만`, parsed.length === HISTORY_MAX && parsed[0].q === '질문10' && parsed.at(-1)!.q === '질문29', parsed.length)
  const pend = parseHistory(JSON.stringify([{ id: 'p', at: '', q: '기다리던 질문', a: null, status: 'pending' }]))
  check('C4 답을 기다리다 떠난 질문 → 끊김(error) + 다시 물어보라는 말', pend[0].status === 'error' && /다시 물어/.test(pend[0].error ?? ''), pend)
  const ai = answerFromAi({ headline: '명세서부터', items: [{ title: '청구항 정리', tag: '먼저', detail: '독립항 1개' }], next: ['', '도면 확인'], caution: ' 공식 기준 확인 ' }, '', 'gemini-x')
  check('C5 AI 답 → 카드(제목 · 줄 · 다음 · 주의 · 모델 · source=ai)', ai.source === 'ai' && ai.title === '명세서부터' && ai.lines[0] === '[먼저] 청구항 정리 — 독립항 1개' && ai.next?.length === 1 && ai.caution === '공식 기준 확인' && ai.model === 'gemini-x', ai)
  const raw = answerFromAi(null, '첫 줄 답\n둘째 줄\n\n셋째 줄', 'm')
  check('C6 AI 가 형식 없이 답해도 카드로(첫 줄 = 제목)', raw.title === '첫 줄 답' && raw.lines.length === 2, raw)
  check('C7 아무 글 없는 AI 답 → 다시 물어보라는 제목', /다시 물어/.test(answerFromAi(null, '  ', 'm').title))
  const txt = answerText(ai)
  check('C8 답 복사 글 — 제목 · 줄 · 다음 · 확인', txt.startsWith('명세서부터\n- [먼저]') && txt.includes('다음:\n- 도면 확인') && txt.includes('확인: 공식 기준 확인'), txt)
  const hist = historyRows([done('대표 전화 010-1234-5678 로 알려 줘', '답1'), done('두번째', '답2'), done('세번째', '답3'), done('네번째', '답4'), { ...done('끊긴 것', 'x'), status: 'error' }])
  check('C9 앞선 대화는 끝난 것 최근 3개만 · 전화번호 가림', hist.length === 3 && hist[0].질문 === '두번째' && !JSON.stringify(hist).includes('끊긴'), hist)
  const hist2 = historyRows([done('대표 전화 010-1234-5678 로 알려 줘', '답1')])
  check('C10 질문 속 전화번호는 AI 에 안 감', !JSON.stringify(hist2).includes('1234-5678'), hist2)
  check('C11 주제 찾기 — 빈 글 · 모르는 말은 null', topicOf('', PV_TOPICS) === null && topicOf('안녕하세요', PV_TOPICS) === null)
}

/* ---------------- 특허 · 벤처 ---------------- */
{
  check('P1 시작 단추 4개(어디까지 · 쓰기 · 점검 · 사업계획서)', PV_STARTERS.map((s) => s.id).join() === 'status,write,check,plan')
  const cases: [string, string][] = [
    ['이 회사 명세서 어디까지 썼어?', 'status'],
    ['다음에 뭐 해야 돼?', 'status'],
    ['hwpx 서식 맞는지 점검해 줘', 'check'],
    ['특허로에 넣기 전에 오류 있는지', 'check'],
    ['벤처 사업계획서 쓰고 싶어', 'plan'],
    ['청구항은 어떻게 써?', 'write'],
    ['새 발명 아이디어 있어', 'write'],
    ['견본으로 연습할래', 'write'],
  ]
  const wrong = cases.filter(([t, want]) => topicOf(t, PV_TOPICS) !== want).map(([t, want]) => `${t} → ${topicOf(t, PV_TOPICS)} (기대 ${want})`)
  check(`P2 쓴 말 → 주제 ${cases.length}가지`, wrong.length === 0, wrong)

  const empty = pvAnswer('status', pv({ clientId: '', clientName: '' }))
  check('P3 아무것도 없을 때: 아직 시작 전 + [새 명세서 쓰기][견본으로 연습]', /아직 시작/.test(empty.title) && empty.actions.map((a) => a.act).join() === 'new-spec,sample' && empty.actions[0].primary === true, empty)
  const noneClient = pvAnswer('status', pv())
  check('P4 회사 골랐는데 기록 없음: 회사 이름으로 말함', noneClient.title.startsWith('공구마모(주)') && noneClient.actions.length === 2, noneClient)

  const sample = sampleDraft()
  const withDraft = pv({ drafts: [draftRow('d1', CLIENT, sample), draftRow('d2', 'cli_b', sample, '2026-10-18T00:00:00Z')] })
  const st = pvAnswer('status', withDraft)
  const next = st.actions.find((a) => a.primary)
  check('P5 명세서 있음: 다음 할 일 하나 + 바로 가는 단추(그 회사 · 그 초안)', st.topic === 'status' && !!next?.href && next.href.includes('draft=d1') && next.href.includes(`client=${CLIENT}`), st)
  check('P6 진행 답에 다른 회사 초안 안 섞임', !JSON.stringify(st).includes('d2'), st)
  const all = pvAnswer('status', pv({ clientId: '', clientName: '', drafts: withDraft.drafts }))
  check('P7 회사 안 고름: 진행 중 n건 — 최근 순', /진행 중 \d+건/.test(all.title) && all.lines.length >= 2, all)

  const w0 = pvAnswer('write', pv())
  check('P8 쓰기(명세서 없음): 새로 시작 · 견본 단추', /새 명세서/.test(w0.title) && w0.actions.some((a) => a.act === 'new-spec') && w0.actions.some((a) => a.act === 'sample'), w0)
  const w1 = pvAnswer('write', withDraft)
  const open = w1.actions.find((a) => a.id === 'open')
  check('P9 쓰기(쓰던 것 있음): 명칭 — n/6단계 · [이어서 쓰기] 그 단계로', /단계/.test(w1.title) && !!open?.href?.includes('draft=d1') && !!open?.href?.includes('step='), w1)

  const c0 = pvAnswer('check', pv())
  check('P10 점검: 파일 올려 달라 + [파일 올리기]', c0.actions[0].act === 'file' && c0.actions[0].primary === true, c0)

  const p0 = pvAnswer('plan', pv({ clientId: '', clientName: '' }))
  check('P11 사업계획서(회사 없음): 회사부터 고르기', p0.actions[0].act === 'pick-client', p0)
  const p1 = pvAnswer('plan', pv())
  check('P12 사업계획서(시작 전 · 명세서 없음): [사업계획서 쓰기] + [명세서 먼저 쓰기]', p1.actions[0].href?.includes('/plan') === true && p1.actions.some((a) => a.act === 'new-spec'), p1)
  const notes: Record<string, string> = {}
  NARRATIVE_IDS.slice(0, 3).forEach((id) => (notes[VK.text(id)] = '서술 글'))
  const p2 = pvAnswer('plan', pv({ plans: [{ clientId: CLIENT, updatedAt: '2026-10-19T00:00:00Z', notes }] }))
  check('P13 사업계획서(쓰는 중): 서술 3/n · [이어서 쓰기]', /^서술 3\//.test(p2.title) && p2.actions[0].label === '이어서 쓰기', p2)

  const help = pvHelpAnswer(true)
  check('P14 모르는 말 → 이렇게 물어보세요(topic=help)', help.topic === 'help' && help.lines.length >= 1 && pvAnswer('zzz', pv()).topic === 'help')

  const report = checkSpec(parseSpecText('【발명의 명칭】\n공구 마모 예측 장치\n【청구범위】\n【청구항 1】\n센서부를 포함하는 장치.'))
  const f = pvFileAnswer('tool.md', report)
  check('P15 파일 점검 답: 고칠 것 n · 확인할 것 n · [점검 화면에서 자세히][다른 파일 올리기]', /고칠 것|확인할 것/.test(f.title) && f.actions.some((a) => a.href?.includes('spec-check')) && f.actions.some((a) => a.act === 'file') && f.topic === 'check', f)

  const ctx = pvAiContext(withDraft, [done('지난 질문', '지난 답')], TODAY)
  const sent = JSON.stringify(ctx)
  const body = [...Object.values(sample.idea), ...Object.values(sample.axis), ...Object.values(sample.text ?? {})].filter((v) => typeof v === 'string' && v.trim().length >= 12)
  const leaked = body.filter((v) => sent.includes(v))
  check(`P16 AI 자료에 발명 본문(아이디어 · 권리축 · 본문 ${body.length}줄) 안 감`, body.length > 0 && leaked.length === 0, leaked.slice(0, 2))
  check('P17 AI 자료: 회사 · 명세서(명칭 · 단계 · 구성요소 이름 · 청구항 수) · 사업계획서 · 앞선 대화', ctx.sections.map((s) => s.name).join() === '회사,명세서,사업계획서,앞선 대화' && /구성요소/.test(sent) && /청구항수/.test(sent) && sent.includes('지난 질문'), ctx.sections.map((s) => s.name))
  check('P18 AI 자료에 다른 회사 초안 안 감', ctx.sections[1].rows.length === 1, ctx.sections[1].rows.length)
  check('P19 사용 방법 8단계 — 단계마다 제목 · 설명', PV_GUIDE.length === 8 && PV_GUIDE.every((g) => g.head && g.body.length > 20))
}

/* ---------------- 기업인증 ---------------- */
{
  const data = (co: keyof typeof FIELD_COS): CertChatData => {
    const ctx = { ...FIELD_COS[co], today: FIELD_TODAY }
    const list = assessAll(ctx)
    return { clientId: `cli_${co}`, clientName: ctx.companyName, ctx, list, roadmap: buildRoadmap(list, ctx) }
  }
  check('K1 시작 단추 4개(받을 수 있는 인증 · 빠진 서류 · 다음에 할 일 · 대표님께 보낼 설명)', CERT_STARTERS.map((s) => s.id).join() === 'can,docs,next,explain')
  const noClient = certChatAnswer('can', null)
  check('K2 회사 없음: 어느 회사? + [회사 고르기]', noClient.actions[0].act === 'pick-client' && /회사/.test(noClient.title), noClient)

  const words: [string, string | null][] = [
    ['벤처', 'venture'],
    ['이노비즈 받을 수 있어?', 'innobiz'],
    ['메인비즈', 'mainbiz'],
    ['연구소 설립', 'lab'],
    ['ISO 14001 환경', 'iso14001'],
    ['iso 인증', 'iso9001'],
    ['그냥 질문', null],
  ]
  const wrongW = words.filter(([t, k]) => certOfText(t) !== k).map(([t, k]) => `${t} → ${certOfText(t)} (기대 ${k})`)
  check(`K3 쓴 말 → 인증 ${words.length}가지`, wrongW.length === 0, wrongW)
  const topics: [string, string | null][] = [
    ['벤처 서류 뭐 필요해?', 'docs'],
    ['이노비즈 받을 수 있어?', 'k:innobiz'],
    ['메인비즈', 'k:mainbiz'],
    ['다음에 뭐부터 해?', 'next'],
    ['대표님께 보낼 카톡 문구', 'explain'],
    ['어떤 인증이 가능해?', 'can'],
    ['안녕', null],
  ]
  const wrongT = topics.filter(([t, want]) => certTopicOf(t).topic !== want).map(([t, want]) => `${t} → ${certTopicOf(t).topic} (기대 ${want})`)
  check(`K4 쓴 말 → (주제, 인증) ${topics.length}가지 — 인증 이름만 있으면 그 인증 답`, wrongT.length === 0, wrongT)

  const A = data('A')
  const can = certChatAnswer('can', A)
  check('K5 받을 수 있는 인증: 1순위 제목 · 인증별 판정 줄 · [○○ 자세히][전체 판정 보기]', can.topic === 'can' && can.lines.length >= 4 && can.actions.some((a) => a.id === 'hero' && a.href?.includes(`client=cli_A`)) && can.actions.some((a) => a.href?.includes('detail=1')), can)
  check('K6 판정 줄은 Core 판정 그대로(인증 수만큼 · 최대 6)', can.lines.length === Math.min(6, A.list.length), { lines: can.lines.length, list: A.list.length })

  const v = certChatAnswer('k:venture', A, 'venture')
  check('K7 인증 하나(벤처): 판정 · 근거 기호(✓△✗?) · [벤처 자세히][벤처 사업계획서 쓰기]', v.topic === 'k:venture' && v.lines.some((l) => /^[✓△✗?] /.test(l)) && v.actions[0].href?.includes('/tools/cert-os/venture') === true && v.actions.some((a) => a.href?.startsWith('/patent-venture/plan')), v)

  const docs = certChatAnswer('docs', A, 'innobiz', false, '김상호')
  const copy = docs.actions.find((a) => a.copy)
  check('K8 빠진 서류: 그 인증 제출에 n가지 · [요청 문구 복사] 안에 회사 · 보내는 사람', docs.topic === 'docs' && (/n?가지가 더 필요|다 있어요/.test(docs.title)) && (!copy || (copy.copy!.includes(A.clientName) && copy.copy!.includes('김상호'))), docs)

  const nx = certChatAnswer('next', A)
  check('K9 다음에 할 일: 순서 줄 · 첫 단계 열기 단추(그 회사)', nx.topic === 'next' && nx.lines.length >= 1 && nx.actions.every((a) => !!a.href), nx)

  const ex = certChatAnswer('explain', A, null, false, '김상호')
  check('K10 대표님께 보낼 설명: 카톡 줄 · [카톡 문구 복사][30초 설명 복사]', ex.topic === 'explain' && ex.actions.map((a) => a.id).join() === 'kakao,thirty' && ex.actions.every((a) => !!a.copy) && ex.lines.length >= 1, ex)

  const unsure: CertChatData = { ...A, list: A.list.map((x) => ({ ...x, recommendation: 'need_info' as const })), roadmap: { ...A.roadmap, steps: [] } }
  const u = certChatAnswer('can', unsure)
  check('K16 판정 못 함(정보 모자람) → [확인 질문에 답하기](예전 인증 한눈에) · 이유 한 줄', u.actions.length === 1 && u.actions[0].id === 'ask' && !!u.actions[0].href?.includes('detail=1') && u.lines.some((l) => /확인 질문/.test(l)), u)

  const ud = certChatAnswer('docs', unsure)
  const chip = ud.actions.find((x) => x.ask)
  check('K17 서류(1순위 없음) → 인증 고르기 칩(이어 묻기 · 3개 이하) + [확인 질문에 답하기]', !!chip && ud.actions.filter((x) => x.ask).length <= 3 && ud.actions.some((x) => x.id === 'ask'), ud)
  const routed = certTopicOf(chip?.ask ?? '')
  const routedA = routed.topic ? certChatAnswer(routed.topic, unsure, routed.cert) : null
  check('K18 칩 말 → 그 인증 서류 답으로 이어짐', routed.topic === 'docs' && !!routed.cert && !!routedA && routedA.topic === 'docs' && routedA.title.includes(unsure.list.find((x) => x.key === routed.cert)!.label), { chip, routed, title: routedA?.title })
  const ue = certChatAnswer('explain', unsure, null, false, '김상호')
  const echip = ue.actions.find((x) => x.ask)
  const er = certTopicOf(echip?.ask ?? '')
  const eA = er.topic ? certChatAnswer(er.topic, unsure, er.cert, false, '김상호') : null
  check('K19 설명(1순위 없음) → 칩 → 그 인증 카톡 문구(복사 단추)', !!echip && er.topic === 'explain' && !!eA && eA.actions.some((x) => x.id === 'kakao' && !!x.copy?.includes('김상호')), { echip, er, eA: eA?.title })
  const un = certChatAnswer('next', unsure)
  check('K20 순서(정보 모자람) → 먼저 확인 질문 + [확인 질문에 답하기]', /확인 질문/.test(un.title) && un.actions[0].id === 'ask', un)

  const help = certChatAnswer('help', A)
  check('K11 모르는 말 → 이렇게 물어보세요', help.topic === 'help')

  // 5유형 모두 — 답이 비지 않고 · 단추는 그 회사로만
  const bad: string[] = []
  for (const co of Object.keys(FIELD_COS) as (keyof typeof FIELD_COS)[]) {
    const d = data(co)
    for (const t of ['can', 'docs', 'next', 'explain']) {
      const a = certChatAnswer(t, d, null, true, '담당')
      if (!a.title) bad.push(`${co}/${t} 제목 없음`)
      for (const x of a.actions) if (x.href && x.href.includes('client=') && !x.href.includes(`client=cli_${co}`)) bad.push(`${co}/${t} ${x.href}`)
    }
  }
  check('K12 업체 5유형 × 단추 4 = 20가지 — 제목 있음 · 단추는 그 회사로만', bad.length === 0, bad)

  const ctx = certAiContext(A, [done('벤처 돼?', '벤처 — 가능')], TODAY)
  const sent = JSON.stringify(ctx)
  check('K13 AI 자료: 회사 숫자 · 인증 판정(OS 규칙) · 추천 순서 · 앞선 대화', ctx.sections.map((s) => s.name).join() === '회사,인증 판정(OS 규칙),추천 순서,앞선 대화' && ctx.sections[1].rows.length === A.list.length && sent.includes('벤처 돼?'), ctx.sections.map((s) => s.name))
  check('K14 AI 자료 목적에 "판정은 OS 가 규칙으로 계산" — AI 판단이라고 하지 않음', /규칙으로 계산/.test(ctx.purpose ?? ''), ctx.purpose)
  check('K15 사용 방법 7단계 — 신청은 각 기관 사이트에서 직접', CERT_GUIDE.length === 7 && CERT_GUIDE.some((g) => /직접/.test(g.body)))
}

/* ---------------- 서버 질문과 맞물림 ---------------- */
{
  const pvP = ASSIST_PRESETS.find((p) => p.id === 'pv.chat')
  const certP = ASSIST_PRESETS.find((p) => p.id === 'cert.chat')
  check('S1 화면 질문 목록에 pv.chat(patent) · cert.chat(cert)', pvP?.page === 'patent' && certP?.page === 'cert', { pvP, certP })
}

console.log(`\n${passed} passed, ${failed} failed`)
if (failed) process.exit(1)
