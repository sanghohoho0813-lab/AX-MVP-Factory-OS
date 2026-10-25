/**
 * D-252 명세서 AI 작업판 — 대표: "하나하나 다 타자로 입력하는 거는 절대 없어야 돼. 조사해줘 · 아이디어 내줘 하면 LLM 이 MD 파일이랑 연계해서".
 *
 *   맨 위   [✨ 전부 써줘] 한 번 — 아이디어 → 조사 → 구성 → 본문 → 청구항 → 점검대로 고치기(약 4~5분 · 화면을 떠나도 계속)
 *   칸 여섯 아이디어 · 조사 · 구성 · 본문 · 청구항 · 점검 — 칸마다 [○○ 써줘 / 다시] · 결과 미리보기 · [직접 고치기]
 *   재료   회사 기록 · AI 전략실 자료 · 끌어다 놓은 파일(읽은 글만) — 타자 칠 칸이 없다
 * 기준 문서(내부 기준 문서 · 내부 기준 문서)는 서버가 단추마다 붙인다. 대표 계정에서만(편집기가 ai === 'yes' 일 때만 그린다).
 * D-261 대표: "버튼 한 번만 눌러도 처음부터 끝까지 · 너무 뭐가 많아". 새 명세서는 만들자마자 [전부 써줘] 가 저절로(autoStart) —
 *   회사 기록 · AI 전략실 자료를 다 읽은 뒤 시작한다. 맨 위 한 칸에 진행 → 다 쓰면 명칭 · 청구항 · 내려받기.
 *   칸 여섯(고르기 · 칸별 다시 쓰기 · 직접 고치기)은 [칸별로 보기] 안으로 접었다(지운 것 없음).
 * D-263 대표: "자체점검 스킬은 명세서에도 항상 중간중간 들어가야 해. 반드시." — 구성 뒤(①) · 청구항 뒤(②)에 자체점검 단계가 저절로.
 *   자체점검이 직접 고친 칸 · 점수 · P0 · 대표 확인을 맨 위 상자에 보여 주고, [자체점검 기준] 에서 대표 정의를 붙여 넣는다.
 * D-269 대표: "버튼 한 번에 처음부터 끝까지 피드백 없이 다 쓰는 건 별로 · 기획 단계를 거치게" — D-261 의 저절로 끝까지를 바꿈:
 *   회사 정보(없으면 먼저 받기) → 아이디어 5개 고르기 → [이걸로 시작] 조사 · 구성 · 자체점검 ① → 구성 확인 → [본문 · 청구항 쓰기] → 전문 · 나눠서 보기.
 */
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { ArrowRight, BookOpenCheck, Boxes, CheckCircle2, Circle, Download, ExternalLink, FileText, Gavel, Lightbulb, Loader2, MessageCircleQuestion, PenLine, Search, ShieldCheck, Sparkles, TriangleAlert, Upload } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Surface } from '../../components/ui/primitives'
import { Button } from '../../components/ui/Button'
import { useToast } from '../../components/ui/toastContext'
import { canExtractText, extractTextFromFile } from '../../services/docTextExtract'
import { safeText, personNames } from '../../services/aiAssist/context'
import { parseSpecFile } from '../../services/patent/specParse'
import { MATERIAL_CHARS, MATERIAL_MAX, SECTION_KEYS, SECTION_LABEL, checkDraft, claimsOf, figureSubject, titleLine, titleParts, type DraftStep, type IdeaPick, type SpecDraft } from '../../services/patent/specDraft'
import { CARD_STAGES, PLAN_BODY, applyIdea, backToIdeas, bodyWritten, cardState, clearAfterIdea, companyThin, hasLaterWork, partsHuman, planAll, planParts, rankLabel, specPhase, stageBlock, stageOf, type AgentCard, type AgentCompany, type AgentStage, type SpecPhase } from '../../services/patent/specAgent'
import { modelsOf, prettyModel, specRun, specRunVersion, startSpecRun, subscribeSpecRun, type StageRow } from '../../services/patent/specRun'
import { useAiChoice } from '../../components/ai/ModelPicker'
import { PlanTalk } from '../../components/ai/PlanTalk'
import { talkFinished, withAnswer } from '../../services/aiAssist/talk'
import { SpecFullText, downloadPlain } from './SpecFullText'
import { SpecMaterialsSheet } from './SpecMaterials'
import { DOC_MATERIAL_KIND, PASTE_MATERIAL_KIND, companyFactLines, docsWithoutFile, importableDocs, priorIdeaLines } from '../../services/patent/specMaterials'
import { fetchClientDocFile } from '../../tools/shared/clientDocFile'
import { JudgeReportView, JudgeSkillButton } from '../../components/ai/JudgePanel'
import { judgePassed } from '../../services/aiAssist/judge'
import { useOwnerAiRepo } from '../ownerAi/shared'
import type { ClientOpsRecord, DocumentKey } from '../../types/clientOps'
import { AiConfirm } from '../../components/ai/AiConfirm'

type Act = (label: string, fn: (cur: SpecDraft) => SpecDraft) => void

/** 회사 기록 → 'AI 에 보낼 한 줄' 들 — 서비스로 옮김(특허 · 벤처 첫 화면도 같이 쓴다). 예전 import 길은 그대로 */
export { companyFactLines }

const CARD_META: Record<AgentCard, { n: number; title: string; icon: ReactNode; run: string; again: string; help: string }> = {
  idea: { n: 1, title: '아이디어', icon: <Lightbulb aria-hidden="true" className="size-5" />, run: '아이디어 내줘', again: '다른 아이디어 더', help: '회사 기록 · 자료로 출원할 만한 아이디어 5개를 순위 · 이유와 함께 냅니다. 다른 것을 누르면 그걸로 바뀝니다.' },
  research: { n: 2, title: '선행기술 조사', icon: <Search aria-hidden="true" className="size-5" />, run: '조사해줘', again: '다시 조사', help: '비슷한 기술 · 차별화 · 위험 · KIPRIS 검색어. 검색 근거가 붙으면 출처가 같이 나옵니다.' },
  parts: { n: 3, title: '구성 · 단계 · 도면', icon: <Boxes aria-hidden="true" className="size-5" />, run: '구성 써줘', again: '다시 써줘', help: '권리축 7줄 · 구성요소(부호 110~) · 방법 단계 · 종속항 씨앗. 도면 설명은 구성에서 자동으로.' },
  body: { n: 4, title: '본문 7칸', icon: <FileText aria-hidden="true" className="size-5" />, run: '본문 써줘', again: '본문 다시', help: '기술분야 · 배경 · 과제 · 해결 수단 · 효과 · 구체적인 내용 · 요약 — 네 번에 나눠 씁니다.' },
  claims: { n: 5, title: '청구항', icon: <BookOpenCheck aria-hidden="true" className="size-5" />, run: '청구항 써줘', again: '청구항 다시', help: '시스템 독립항 · 종속항 · 방법 독립항. 조사에서 나온 차별화를 독립항에 넣습니다.' },
  judge: { n: 6, title: '자체점검', icon: <Gavel aria-hidden="true" className="size-5" />, run: '자체점검 해줘', again: '다시 점검', help: '심사관 · 경쟁사 변리사 눈으로 날카롭게 묻고 100점으로 판정합니다. 고칠 수 있는 약점은 직접 고쳐 넣고, 구성 뒤 · 청구항 뒤에 저절로 들어갑니다.' },
  check: { n: 7, title: '점검 · 내보내기', icon: <ShieldCheck aria-hidden="true" className="size-5" />, run: '점검대로 고쳐줘', again: '한 번 더 고쳐줘', help: '특허로 편집기 기준 점검(규칙 계산) → 걸린 글만 AI 가 고칩니다. 다 되면 MD · 제출 묶음을 받으세요.' },
}

const CARDS: AgentCard[] = ['idea', 'research', 'parts', 'body', 'claims', 'judge', 'check']

/** D-269 맨 위 차례 — 절차마다 단추로 넘어간다 */
const STEPS: { label: string; phases: SpecPhase[] }[] = [
  { label: '회사 정보', phases: ['company'] },
  { label: '기획 · 아이디어', phases: ['ideas'] },
  { label: '구성 확인', phases: ['parts', 'review'] },
  { label: '본문 · 청구항', phases: ['body'] },
  { label: '전문 · 복사', phases: ['done'] },
]

const PHASE_HELP: Record<SpecPhase, string> = {
  company: '이 회사가 무엇을 하는지(업종 · 종목 · 상담 메모)나 자료가 있어야 그 회사에 맞는 발명을 냅니다.',
  ideas: 'AI 가 회사 서류 · 기록을 읽고 의견과 질문을 드립니다(5번 안). 답을 누르면 그 답대로 아이디어 5개를 1~3순위와 이유까지 — 하나를 골라 [이걸로 시작하자].',
  parts: '고른 아이디어로 선행기술 조사 · 구성요소 · 단계를 짜고 자체점검 ① 이 판정합니다.',
  review: '구성요소 · 단계 · 자체점검 ① 을 보고 맞으면 [이 구성으로 본문 · 청구항 쓰기]. 아니면 다시 짜거나 다른 아이디어로.',
  body: '본문 · 청구항 가운데 빠진 곳이 있어요 — [이어서 끝까지 써줘].',
  done: '',
}

const PHASE_TONE: Record<StageRow['phase'], string> = { wait: 'text-slate-500', run: 'text-violet-800', done: 'text-success-700', fail: 'text-danger-700', skip: 'text-slate-600' }

function PhaseIcon({ phase }: { phase: StageRow['phase'] }) {
  if (phase === 'run') return <Loader2 aria-hidden="true" className="size-4 shrink-0 animate-spin text-violet-700" />
  if (phase === 'done') return <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 text-success-600" />
  if (phase === 'fail') return <TriangleAlert aria-hidden="true" className="size-4 shrink-0 text-danger-600" />
  return <Circle aria-hidden="true" className="size-4 shrink-0 text-slate-400" />
}

export function SpecAiBoard({
  draftId,
  d,
  act,
  apply,
  record,
  others,
  today,
  onEdit,
  onDownload,
  onPack,
  packing,
  autoStart = false,
  onAutoStarted,
  wantClient = '',
}: {
  draftId: string
  d: SpecDraft
  act: Act
  apply: (fn: (cur: SpecDraft) => SpecDraft) => Promise<void>
  record: ClientOpsRecord | null
  others: string[]
  today: string
  onEdit: (s: DraftStep) => void
  onDownload: () => void
  onPack: () => void
  packing: boolean
  /** D-261 새로 만든 빈 명세서 — 재료를 다 읽으면 [전부 써줘] 를 저절로 */
  autoStart?: boolean
  onAutoStarted?: () => void
  /** 이 명세서의 회사(기록을 읽기 전에는 record 가 비어 있다) */
  wantClient?: string
}) {
  const { showToast } = useToast()
  useSyncExternalStore(subscribeSpecRun, specRunVersion)
  const run = specRun(draftId)
  const repo = useOwnerAiRepo()
  const [caseMats, setCaseMats] = useState<AgentCompany['materials']>([])
  const [priorIdeas, setPriorIdeas] = useState<string[]>([])
  const [reading, setReading] = useState('')
  /** 자료를 다 읽은 회사(빈 글 = 회사 없음) — 회사 기록이 늦게 와도 그 회사 자료를 읽기 전에는 저절로 시작하지 않게 */
  const [matsFor, setMatsFor] = useState<string | null>(null)
  const [showCards, setShowCards] = useState(false)
  const autoDone = useRef(false)
  // D-271 [자료 넣기] 창 · 업체 서류함에서 읽지 못한 것 · 저절로 읽기를 끝냈는지(끝나야 아이디어를 저절로 낸다)
  const [matsOpen, setMatsOpen] = useState(false)
  const [docFails, setDocFails] = useState<string[]>([])
  const [docsDone, setDocsDone] = useState(false)
  const autoDocs = useRef(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const clientId = record?.id ?? ''

  // AI 전략실 — 이 회사와 이어진 작업실의 자료 · '특허 아이디어' 결과를 재료로(실패하면 없이)
  useEffect(() => {
    if (!clientId) {
      setMatsFor('')
      return
    }
    let alive = true
    void (async () => {
      try {
        const cases = (await repo.listCases()).filter((c) => c.clientId === clientId)
        const mats = cases.flatMap((c) => c.materials.filter((m) => !m.excluded && m.text.trim()).map((m) => ({ title: m.title, kind: 'AI 전략실 자료', text: m.text })))
        const ideas: string[] = []
        for (const c of cases.slice(0, 2)) {
          // PV-2 폐기한 결과는 재료로 쓰지 않는다 — 채택 · 일부 채택을 먼저, 검토 전은 그렇다고 적어서
          ideas.push(...priorIdeaLines(await repo.listRuns(c.id)))
        }
        if (alive) {
          setCaseMats(mats.slice(0, 6))
          setPriorIdeas(ideas.slice(0, 6))
        }
      } catch {
        /* 작업실을 못 읽어도 회사 기록 · 올린 자료로 쓴다 */
      } finally {
        if (alive) setMatsFor(clientId)
      }
    })()
    return () => {
      alive = false
    }
  }, [repo, clientId])

  const facts = useMemo(() => companyFactLines(record), [record])
  const company: AgentCompany = useMemo(
    () => ({ name: record?.companyName ?? '', facts, materials: [...d.materials.map((m) => ({ title: m.title, kind: m.kind, text: m.text })), ...caseMats].slice(0, 6), priorIdeas }),
    [record, facts, d.materials, caseMats, priorIdeas],
  )

  const busy = run.running
  // PV-2 AI 가 쓰는 동안 새로고침 · 창 닫기는 한 번 묻는다 — 다른 화면으로 옮기는 것은 괜찮다(계속 씀), 새로고침하면 남은 단계가 사라진다
  useEffect(() => {
    if (!busy) return
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [busy])
  const start = (stages: AgentStage[], forceParts = false): boolean => {
    const ok = startSpecRun(draftId, stages, { company, others, today, forceParts })
    if (!ok) showToast('지금 쓰는 중입니다 — 끝나면 다시 눌러 주세요')
    return ok
  }
  const all = () => {
    const plan = planAll(d)
    if (start(plan)) showToast(`빠진 곳 ${plan.length}단계를 차례로 씁니다 — 이 화면을 떠나도 계속 씁니다`)
  }
  const runCard = (card: AgentCard) => {
    if (card === 'parts' && partsHuman(d) && !window.confirm('직접 고치신 구성요소 · 단계가 있습니다. AI 가 새로 써서 바꿀까요? (바꾼 뒤 되돌리기로 살릴 수 있어요)')) return
    // 자체점검 카드 — 본문 · 청구항이 있으면 ② 만(① 이 구성 이름을 바꾸면 본문과 어긋남), 없으면 ①
    start(card === 'judge' ? [bodyWritten(d) ? 'judge2' : 'judge1'] : CARD_STAGES[card], card === 'parts')
  }

  const pickIdea = (pick: IdeaPick) => {
    if (pick.title === d.title) return
    if (hasLaterWork(d) && !window.confirm('다른 아이디어로 바꾸면 지금 구성 · 본문 · 청구항은 새로 써야 합니다. 바꿀까요? (되돌리기로 살릴 수 있어요)')) return
    act(`'${pick.title}' 로 바꿨습니다 — [이 아이디어로 구성 짜기] 로 이어서 쓰세요`, (cur) => applyIdea(hasLaterWork(cur) ? clearAfterIdea(cur) : cur, pick))
  }

  /* D-269 기획 — 대표: "아이디어를 여러 개 내고 가장 괜찮은 거를 먼저 뽑아 주고 · 이걸로 선택할게 · 이걸로 시작하자" */
  const [pickTitle, setPickTitle] = useState('')
  const picked = d.ideas.find((p) => p.title === pickTitle) ?? d.ideas[0] ?? null
  const ideasRun = () => {
    setPickTitle('')
    if (start(['idea'])) showToast(d.talk.some((r) => r.answer.trim()) ? '기획 대화의 답대로 아이디어 5개를 내고 순위를 매깁니다(30~60초)' : '아이디어 5개를 내고 순위를 매깁니다(30~60초)')
  }
  /* D-271 기획 대화 — 대표: "의견을 딱 주는 거야 · 이런 거는 너무 흔하고 · 그래서 어떤 방식으로 하는 게 좋을까요? · 다섯 번 이내" */
  const talkRun = () => {
    if (start(['talk'])) showToast('AI 가 회사 서류 · 기록을 읽고 의견과 첫 질문을 드립니다(20초쯤)')
  }
  const answerTalk = async (answer: string) => {
    const next = withAnswer(d.talk, answer)
    await apply((cur) => ({ ...cur, talk: withAnswer(cur.talk, answer) }))
    if (talkFinished(next)) {
      setPickTitle('')
      if (start(['idea'])) showToast('답 5개가 모였어요 — 이 답대로 아이디어 5개를 냅니다')
    } else start(['talk'])
  }
  const talkAgain = () => {
    if (d.talk.length && !window.confirm('기획 대화를 처음부터 다시 할까요? 지금 답은 지워집니다(되돌리기로 살릴 수 있어요)')) return
    act('기획 대화를 처음부터 다시 합니다', (cur) => ({ ...cur, talk: [] }))
    setTimeout(talkRun, 0)
  }
  const rankRun = () => {
    setPickTitle('')
    if (start(['ideaRank'])) showToast('후보를 자체점검 기준으로 견줘 가장 나은 것을 고릅니다')
  }
  const moreRun = () => {
    if (start(['ideaMore'])) showToast('지금 후보의 약점을 자체점검으로 공격하고, 더 날카로운 아이디어를 짜냅니다')
  }
  const chooseIdea = () => {
    if (!picked) return
    act(`'${picked.title}' 로 시작합니다`, (cur) => applyIdea(cur, picked))
    // act 가 초안을 곧바로 바꾸므로 다음 단계는 고른 명칭으로 부른다
    if (start(planParts({ ...d, title: picked.title }))) showToast('선행기술 조사 → 구성 → 자체점검 ① 까지 씁니다 — 끝나면 구성을 확인해 주세요')
  }
  const partsRun = (again = false) => {
    if (again && partsHuman(d) && !window.confirm('직접 고치신 구성요소 · 단계가 있습니다. AI 가 새로 짜서 바꿀까요? (되돌리기로 살릴 수 있어요)')) return
    if (start(planParts(d), again)) showToast('선행기술 조사 → 구성 → 자체점검 ① 까지 씁니다')
  }
  const bodyRun = () => {
    if (start([...PLAN_BODY])) showToast('본문 · 청구항 · 자체점검 ② · 점검대로 고치기까지 씁니다(3~4분 · 화면을 떠나도 계속)')
  }
  const goBackToIdeas = () => {
    if (hasLaterWork(d) && !window.confirm('다른 아이디어로 돌아가면 지금 구성 · 본문 · 청구항은 비워집니다. 돌아갈까요? (되돌리기로 살릴 수 있어요)')) return
    act('아이디어 고르기로 돌아갔습니다', backToIdeas)
  }

  /** 파일 → 읽은 글(사람 이름 · 연락처 가림). 못 읽으면 '' */
  const readFileText = async (f: File, label: string): Promise<string> => {
    let text = ''
    if (/\.hwpx$/i.test(f.name)) {
      const doc = await parseSpecFile(f.name, new Uint8Array(await f.arrayBuffer()))
      text = doc.paras.map((p) => p.text).join('\n')
    } else if (canExtractText(f)) text = (await extractTextFromFile(f, (_p, step) => setReading(`${label} · ${step}`))).text
    else if (/^text\//.test(f.type) || /\.(txt|md|csv)$/i.test(f.name)) text = await f.text()
    return safeText(text, personNames(record ?? ({} as ClientOpsRecord)), MATERIAL_CHARS)
  }
  const putMaterials = async (got: SpecDraft['materials'], msg: string) => {
    if (!got.length) return
    await apply((cur) => ({ ...cur, materials: [...cur.materials, ...got].slice(0, MATERIAL_MAX) }))
    showToast(msg)
  }
  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return
    const room = MATERIAL_MAX - d.materials.length
    if (room <= 0) {
      showToast(`자료는 ${MATERIAL_MAX}개까지 — 앞 자료를 빼고 넣어 주세요`)
      return
    }
    const got: SpecDraft['materials'] = []
    for (const f of Array.from(files).slice(0, room)) {
      setReading(`${f.name} 읽는 중…`)
      try {
        const clean = await readFileText(f, f.name)
        if (clean.length >= 20) got.push({ title: f.name.slice(0, 80), kind: '올린 자료', text: clean, at: new Date().toISOString() })
        else showToast(`${f.name} — 글자를 읽지 못했습니다(그림 · 스캔이면 PDF 로 다시)`)
      } catch {
        showToast(`${f.name} — 읽지 못했습니다`)
      }
    }
    setReading('')
    await putMaterials(got, `자료 ${got.length}개를 재료로 넣었습니다 — 읽은 글만 남기고 원본 파일은 저장하지 않습니다`)
  }
  /** D-271 업체 서류함(고객 관리 › 업체 › 서류)의 파일을 내려받아 읽어 재료로 — 저절로(새 명세서) · [자료 넣기] 창에서 */
  const docs = useMemo(() => importableDocs(record), [record])
  const importDocs = async (keys: string[], auto = false) => {
    const room = MATERIAL_MAX - d.materials.length
    const want = docs.filter((x) => keys.includes(x.key)).slice(0, Math.max(0, room))
    const got: SpecDraft['materials'] = []
    const fails: string[] = []
    for (const x of want) {
      setReading(`업체 서류 '${x.label}' 읽는 중…`)
      try {
        const f = await fetchClientDocFile(record, x.key as DocumentKey)
        const clean = f ? await readFileText(f.file, x.label) : ''
        if (clean.length >= 20) got.push({ title: x.label.slice(0, 80), kind: DOC_MATERIAL_KIND, text: clean, at: new Date().toISOString() })
        else fails.push(x.label)
      } catch {
        fails.push(x.label)
      }
    }
    setReading('')
    setDocFails(fails)
    await putMaterials(got, auto ? `업체 서류함의 서류 ${got.length}개를 읽어 재료로 넣었습니다 — 이 서류로 회사 이야기를 잡습니다` : `업체 서류 ${got.length}개를 재료로 넣었습니다`)
    if (!got.length && fails.length && !auto) showToast(`업체 서류 ${fails.length}개를 읽지 못했습니다 — 파일을 다시 받지 못했거나 그림 · 스캔이에요`)
  }
  /** D-271 GPT 와 나눈 대화 · 메모를 붙여 넣기 */
  const addText = async (title: string, text: string): Promise<boolean> => {
    if (d.materials.length >= MATERIAL_MAX) {
      showToast(`자료는 ${MATERIAL_MAX}개까지 — 앞 자료를 빼고 넣어 주세요`)
      return false
    }
    const clean = safeText(text, personNames(record ?? ({} as ClientOpsRecord)), MATERIAL_CHARS)
    if (clean.length < 20) {
      showToast('20자 이상 붙여 넣어 주세요')
      return false
    }
    const n = d.materials.filter((m) => m.kind === PASTE_MATERIAL_KIND).length + 1
    await putMaterials([{ title: (title.trim() || `붙여 넣은 글 ${n}`).slice(0, 80), kind: PASTE_MATERIAL_KIND, text: clean, at: new Date().toISOString() }], '붙여 넣은 글을 재료로 넣었습니다 — 끝부분(결론)까지 AI 가 봅니다')
    return true
  }
  const removeMaterial = (i: number) => {
    const m = d.materials[i]
    if (!m) return
    act(`'${m.title}' 자료를 뺐습니다`, (cur) => ({ ...cur, materials: cur.materials.filter((_, j) => j !== i) }))
  }

  // D-271 새 명세서(아직 명칭 전) — 업체 서류함에 올린 서류가 있으면 먼저 읽어 재료로(그다음 아이디어를 저절로)
  useEffect(() => {
    if (autoDocs.current || matsFor !== clientId) return
    if (wantClient && !record) return
    autoDocs.current = true
    const todo = docs.filter((x) => !d.materials.some((m) => m.kind === DOC_MATERIAL_KIND && m.title === x.label))
    if (d.title.trim() || !todo.length || d.materials.length >= MATERIAL_MAX) {
      setDocsDone(true)
      return
    }
    void importDocs(
      todo.map((x) => x.key),
      true,
    ).finally(() => setDocsDone(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 한 번만(명세서를 열 때)
  }, [matsFor, clientId, wantClient, record, docs])

  // D-261 새 명세서 — 회사 기록 · 그 회사의 AI 전략실 자료를 다 읽은 뒤 한 번만 저절로.
  // D-269 저절로는 '아이디어 5개' 까지만(고르는 것은 대표) · 회사 이야기가 없으면 시작하지 않고 '회사 정보부터'
  useEffect(() => {
    if (!autoStart || autoDone.current || busy) return
    if (wantClient && !record) return
    if (matsFor !== clientId || !docsDone) return
    autoDone.current = true
    onAutoStarted?.()
    if (d.title.trim() || d.ideas.length || d.talk.length || companyThin(company)) return
    // D-271 저절로는 기획 대화의 첫 질문까지 — 아이디어는 대표 답을 받은 뒤
    if (startSpecRun(draftId, ['talk'], { company, others, today, forceParts: false })) showToast('AI 가 회사 서류 · 기록을 읽고 의견과 첫 질문을 드립니다 — 답을 눌러 주세요')
  }, [autoStart, busy, matsFor, clientId, docsDone, wantClient, record, d, draftId, company, others, today, onAutoStarted, showToast])

  // 회사 기록을 끝내 못 읽으면(목록 실패 등) 기다리기만 하지 않는다 — 알리고 [아이디어 5개 내줘] 로
  const autoGiveUp = useRef({ onAutoStarted, showToast })
  autoGiveUp.current = { onAutoStarted, showToast }
  useEffect(() => {
    if (!autoStart || !wantClient || record || autoDone.current) return
    const t = setTimeout(() => {
      if (autoDone.current) return
      autoDone.current = true
      autoGiveUp.current.onAutoStarted?.()
      autoGiveUp.current.showToast('회사 기록을 읽지 못해 저절로 시작하지 못했어요 — [아이디어 5개 내줘] 를 눌러 주세요')
    }, 15_000)
    return () => clearTimeout(t)
  }, [autoStart, wantClient, record])

  const errs = checkDraft(d).filter((i) => i.level === 'error')
  const stagesShown = (Object.keys(run.stages) as AgentStage[]).sort((a, b) => STAGE_ORDER.indexOf(a) - STAGE_ORDER.indexOf(b))
  const doneCards = CARDS.filter((c) => cardState(c, d).done).length
  // D-268 · D-269 회사 이야기(업종 · 종목 · 상담 메모 · 자료)가 없으면 지어낸 발명이 된다 — 명칭 전이면 막고, 뒤면 알린다
  const thin = matsFor === clientId && docsDone && companyThin(company)
  const phase = specPhase(d, thin)
  const finished = !busy && phase === 'done'
  // D-268 형식 점검과 자체점검을 따로 — 자체점검 90점 미만 · P0 면 '출원 전에 손볼 곳'
  const judged = d.judge.full
  const judgeP0 = judged?.verdicts.filter((v) => v.level === 'P0').length ?? 0
  const needsWork = finished && !!judged && !judgePassed(judged)
  const models = modelsOf(d)
  const [choice] = useAiChoice()
  const stepAt = STEPS.findIndex((s) => s.phases.includes(phase))
  const head = busy
    ? 'AI 가 쓰는 중이에요 — 화면을 떠나도 계속 씁니다'
    : phase === 'company'
      ? '먼저 회사 정보를 넣어 주세요'
      : phase === 'ideas'
        ? d.ideas.length
          ? '아이디어를 골라 주세요'
          : d.talk.length
            ? talkFinished(d.talk)
              ? '기획이 잡혔어요 — 아이디어 5개를 냅니다'
              : 'AI 의 질문에 답해 주세요'
            : '기획부터 — AI 가 회사를 읽고 의견을 드립니다'
        : phase === 'parts'
          ? '고른 아이디어로 구성을 짭니다'
          : phase === 'review'
            ? '구성을 확인해 주세요'
            : phase === 'body'
              ? '본문 · 청구항을 마저 씁니다'
              : needsWork
                ? '명세서를 다 썼어요 — 출원 전에 손볼 곳이 있어요'
                : '명세서를 다 썼어요'

  return (
    <div className="flex flex-col gap-4" data-testid="spec-board" data-busy={busy ? 'yes' : 'no'} data-phase={phase}>
      <Surface>
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className={`flex size-10 shrink-0 items-center justify-center rounded-full ${needsWork || phase === 'company' ? 'bg-warning-100 text-warning-800' : finished ? 'bg-success-100 text-success-700' : 'bg-violet-100 text-violet-700'}`}>
              {needsWork || phase === 'company' ? <TriangleAlert className="size-5" /> : finished ? <CheckCircle2 className="size-5" /> : busy ? <Loader2 className="size-5 animate-spin" /> : <Sparkles className="size-5" />}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <h3 className="t-section font-bold break-keep text-slate-900" data-testid="spec-board-head" data-needs-work={needsWork ? 'yes' : 'no'}>
                {head}
              </h3>
              <p className="t-sub break-keep text-slate-700" data-testid="spec-board-summary">
                {finished ? (
                  <>
                    <b className="font-semibold">{titleLine(d)}</b> · 청구항 {d.claims.length || claimsOf(d).length}개 · 본문 {SECTION_KEYS.filter((k) => (d.text[k] ?? '').trim()).length}/7칸 · 형식 점검 {errs.length ? `고칠 것 ${errs.length}개` : '통과'}
                    {judged && (
                      <>
                        {' · '}
                        <b className={`font-semibold whitespace-nowrap ${needsWork ? 'text-warning-900' : 'text-success-800'}`}>
                          자체점검 {judged.score == null ? '점수 없음' : `${judged.score}점`}
                          {judgeP0 ? ` · P0 ${judgeP0}개` : ''}
                        </b>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    {(phase === 'parts' || phase === 'review' || phase === 'body') && (
                      <>
                        <b className="font-semibold [overflow-wrap:anywhere]">{titleLine(d)}</b> —{' '}
                      </>
                    )}
                    {PHASE_HELP[phase]}
                  </>
                )}
              </p>
            </div>
          </div>

          <ol className="flex flex-wrap gap-1.5" data-testid="spec-steps" data-phase={phase} aria-label="명세서 쓰는 차례">
            {STEPS.map((s, i) => {
              const now = i === stepAt
              const past = i < stepAt
              return (
                <li key={s.label} className={`t-meta inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold ${now ? 'bg-violet-600 text-white' : past ? 'bg-success-100 text-success-800' : 'bg-slate-100 text-slate-500'}`} aria-current={now ? 'step' : undefined} data-testid="spec-step" data-now={now ? 'yes' : 'no'}>
                  {past ? <CheckCircle2 aria-hidden="true" className="size-3.5" /> : <span aria-hidden="true">{i + 1}</span>}
                  {s.label}
                </li>
              )
            })}
          </ol>

          <ul className="flex flex-wrap gap-1.5" data-testid="spec-board-sources">
            <li className="t-meta rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">{record ? `${record.companyName} 기록 ${facts.length}줄` : '회사 고르지 않음'}</li>
            <li className="t-meta rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">AI 전략실 자료 {caseMats.length}개</li>
            <li className="t-meta rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700" data-testid="spec-board-docs">
              업체 서류 {d.materials.filter((m) => m.kind === DOC_MATERIAL_KIND).length}/{docs.length}개 읽음
            </li>
            <li className="t-meta rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700" data-testid="spec-board-mats">올린 자료 {d.materials.length}개</li>
            <li>
              <button type="button" onClick={() => setMatsOpen(true)} className="tap t-meta inline-flex min-h-8 items-center gap-1 rounded-full border border-violet-300 bg-white px-2.5 py-1 font-semibold text-violet-900 hover:bg-violet-50" data-testid="spec-board-mats-open">
                <Upload aria-hidden="true" className="size-3.5" /> 자료 넣기 · 보기
              </button>
            </li>
            <li className="ml-auto">
              <JudgeSkillButton />
            </li>
          </ul>
          <p className="t-meta break-keep text-slate-600" data-testid="spec-board-models" data-models={models.join(',')}>
            지금 고른 모델 <b className="font-semibold text-slate-800">{choice ? prettyModel(choice.model) : '기본(Gemini 가장 싼 모델)'}</b> — 바꾸면 다음 단계부터 그 모델로 씁니다
            {models.length > 0 && (
              <>
                {' · '}이 명세서를 쓴 모델 <b className="font-semibold text-slate-800">{models.map(prettyModel).join(' · ')}</b>
              </>
            )}
          </p>
          {thin && phase !== 'company' && (
            <div className="flex flex-col gap-2 rounded-(--radius-control) border border-warning-300 bg-warning-50 px-3 py-2.5 sm:flex-row sm:items-center" data-testid="spec-board-thin">
              <p className="t-sub min-w-0 flex-1 break-keep text-warning-900">
                <TriangleAlert aria-hidden="true" className="mr-1 inline size-4 align-[-2px]" />
                <b className="font-semibold">AI 가 읽을 회사 이야기가 거의 없어요</b> — 업종 · 종목 · 상담 메모 · 자료가 비어 있어, 이대로 쓰면 업종 일반으로 지어낸 발명이 됩니다. 회사 소개서 · 제품 설명 · GPT 와 나눈 대화를 먼저 넣어 주세요(.hwpx · .hwp · .docx · .pdf).
              </p>
              <Button variant="secondary" size="sm" className="shrink-0 self-start sm:self-auto" disabled={!!reading} onClick={() => setMatsOpen(true)} data-testid="spec-board-thin-file">
                <Upload aria-hidden="true" className="size-4" /> {reading || '자료 넣기'}
              </Button>
            </div>
          )}
          {(d.judge.full ?? d.judge.parts) && phase !== 'ideas' && <JudgeReportView report={d.judge.full ?? d.judge.parts} title={d.judge.full ? '자체점검 ② 명세서 전체' : '자체점검 ① 구성 · 권리축'} testId="spec-judge" />}

          {phase === 'company' && (
            <div className="flex flex-col gap-2.5 rounded-(--radius-control) border border-warning-300 bg-warning-50 px-3 py-3" data-testid="spec-gate-company">
              <p className="t-sub break-keep text-warning-900">
                <b className="font-semibold">AI 가 읽을 회사 이야기가 없어요.</b> 이대로 아이디어를 내면 어느 회사에나 맞는 지어낸 발명이 됩니다. 아래 둘 중 하나만 있으면 바로 시작해요.
              </p>
              <ul className="t-sub flex list-disc flex-col gap-0.5 pl-5 break-keep text-slate-800">
                <li>업체 서류함(고객 관리 › 업체 › 서류)에 회사 소개서 · 제품 설명 — 올려 두면 여기서 저절로 읽어요</li>
                <li>업체 기록에 업종 · 종목 · 상담 메모(무엇을 팔고 · 어떻게 팔고 · 무엇이 불편한지)</li>
                <li>[자료 넣기] — 파일이나 GPT 와 나눈 대화를 그대로 붙여 넣기</li>
              </ul>
              {(docFails.length > 0 || docsWithoutFile(record) > 0) && (
                <p className="t-meta break-keep text-warning-900" data-testid="spec-gate-docs-note">
                  {docFails.length > 0 ? `업체 서류 ${docFails.length}개(${docFails.join(' · ')})는 읽지 못했어요 — 그림 · 스캔이거나 파일을 다시 받지 못했어요. ` : ''}
                  {docsWithoutFile(record) > 0 ? `받았다고만 표시된 서류 ${docsWithoutFile(record)}개는 파일이 올라와 있지 않아요.` : ''}
                </p>
              )}
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button variant="primary" className="min-h-12" disabled={!!reading} onClick={() => setMatsOpen(true)} data-testid="spec-gate-file">
                  <Upload aria-hidden="true" className="size-5" /> {reading || '자료 넣기'}
                </Button>
                {record ? (
                  <Link to={`/ops/clients/${encodeURIComponent(record.id)}`} className="tap t-sub inline-flex min-h-12 items-center justify-center gap-1.5 rounded-(--radius-control) border border-slate-300 bg-white px-4 font-semibold text-slate-800 hover:bg-slate-50" data-testid="spec-gate-record">
                    <PenLine aria-hidden="true" className="size-4" /> {record.companyName} 기록 채우기
                  </Link>
                ) : (
                  <p className="t-meta self-center break-keep text-slate-600">회사를 고르지 않았어요 — 목록에서 회사를 골라 새로 만들면 그 회사 기록을 읽습니다.</p>
                )}
              </div>
            </div>
          )}

          {phase === 'ideas' && (
            <div className="flex flex-col gap-2.5" data-testid="spec-plan-ideas">
              {d.ideas.length === 0 ? (
                d.talk.length ? (
                  <>
                    <PlanTalk rounds={d.talk} busy={busy} onAnswer={(a) => void answerTalk(a)} onNext={ideasRun} nextLabel={talkFinished(d.talk) ? '이 대화대로 아이디어 5개 내줘' : '그만 묻고 지금 답대로 아이디어 5개 내줘'} testId="spec-talk" />
                    {!busy && (
                      <div className="flex flex-wrap gap-2">
                        <Button variant="ghost" size="sm" disabled={!!reading} onClick={() => setMatsOpen(true)} data-testid="spec-board-file">
                          <Upload aria-hidden="true" className="size-4" /> {reading || '자료 더 넣기'}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={talkAgain} data-testid="spec-talk-again">
                          기획 대화 처음부터
                        </Button>
                      </div>
                    )}
                  </>
                ) : busy ? (
                  <p className="t-sub flex items-center gap-1.5 text-violet-800" role="status" data-testid="spec-talk-wait">
                    <Loader2 aria-hidden="true" className="size-5 animate-spin" /> {run.stages.idea?.phase === 'run' ? '아이디어를 내는 중…' : 'AI 가 회사 서류 · 기록을 읽고 의견을 정리하는 중…'}
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                      <AiConfirm><Button variant="primary" className="min-h-12 sm:min-w-56" onClick={talkRun} data-testid="spec-talk-start">
                        <MessageCircleQuestion aria-hidden="true" className="size-5" /> AI 와 기획 시작(질문 5번 안)
                      </Button></AiConfirm>
                      <AiConfirm><Button variant="secondary" onClick={ideasRun} data-testid="spec-ideas-run">
                        <Lightbulb aria-hidden="true" className="size-4" /> 묻지 말고 아이디어 5개 내줘
                      </Button></AiConfirm>
                      <Button variant="ghost" disabled={!!reading} onClick={() => setMatsOpen(true)} data-testid="spec-board-file">
                        <Upload aria-hidden="true" className="size-4" /> {reading || '자료 넣기(선택)'}
                      </Button>
                    </div>
                    <p className="t-meta break-keep text-slate-500">AI 가 회사를 어떻게 이해했는지 · 흔한 방향과 약한 점을 먼저 말하고, 무엇을 정하면 좋을지 하나씩 묻습니다. 답은 누르기만 하면 돼요.</p>
                  </div>
                )
              ) : (
                <>
                  {d.talk.some((r) => r.answer.trim()) && <PlanTalk rounds={d.talk} busy={false} onAnswer={() => {}} onNext={() => {}} nextLabel="" testId="spec-talk" compact />}
                  <ul className="flex flex-col gap-2" role="radiogroup" aria-label="특허 아이디어 후보" data-testid="spec-plan-list">
                    {d.ideas.map((p, i) => {
                      const on = picked?.title === p.title
                      return (
                        <li key={`${p.title}-${i}`} className={`flex flex-col rounded-(--radius-control) border-2 ${on ? 'border-violet-500 bg-violet-50/70' : 'border-slate-200 bg-white'}`} data-testid="spec-plan-idea" data-rank={i + 1} data-picked={on ? 'yes' : 'no'} data-fresh={p.fresh ? 'yes' : 'no'}>
                          <button type="button" role="radio" aria-checked={on} disabled={busy} onClick={() => setPickTitle(p.title)} className="tap flex w-full min-w-0 items-start gap-2.5 px-3 pt-2.5 pb-1.5 text-left" data-testid="spec-plan-pick">
                            <span aria-hidden="true" className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${on ? 'border-violet-600 bg-violet-600' : 'border-slate-400 bg-white'}`}>
                              {on && <span className="size-2 rounded-full bg-white" />}
                            </span>
                            <span className="flex min-w-0 flex-1 flex-col gap-1">
                              <span className="flex flex-wrap items-center gap-1.5">
                                <span className={`t-meta rounded-full px-2 py-0.5 font-bold ${i === 0 ? 'bg-violet-600 text-white' : i < 3 ? 'bg-violet-100 text-violet-900' : 'bg-slate-100 text-slate-600'}`}>{rankLabel(i)}</span>
                                {p.score != null && <span className="t-meta rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">{p.score}점</span>}
                                {p.fresh && <span className="t-meta rounded-full bg-danger-600 px-2 py-0.5 font-bold text-white">새로 · 자체점검</span>}
                              </span>
                              <span className="t-body font-bold break-keep text-slate-900 [overflow-wrap:anywhere]">{p.title}</span>
                              {p.reason && <span className="t-sub break-keep text-violet-900">{i < 3 ? `${rankLabel(i)}인 이유 · ` : ''}{p.reason}</span>}
                              {p.why && <span className="t-meta break-keep text-slate-600">회사 근거 · {clip(p.why, 180)}</span>}
                            </span>
                          </button>
                          <details className="px-3 pb-2.5 pl-11">
                            <summary className="tap t-meta cursor-pointer font-semibold text-slate-600">자세히 — 문제 · 기존 방식 · 차별 구조 · 흐름 · 권리화 포인트</summary>
                            <dl className="t-meta mt-1 grid gap-0.5 break-keep text-slate-700">
                              {p.titleEn && <dd className="[overflow-wrap:anywhere] text-slate-500">{p.titleEn}</dd>}
                              <dd>① {p.idea.problem}</dd>
                              <dd>② {p.idea.prior}</dd>
                              <dd>③ {p.idea.distinct}</dd>
                              {p.idea.flow && <dd>④ {p.idea.flow}</dd>}
                              {p.idea.point && <dd>⑤ {p.idea.point}</dd>}
                            </dl>
                          </details>
                        </li>
                      )
                    })}
                  </ul>
                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                    <AiConfirm><Button variant="primary" className="min-h-12" disabled={busy || !picked} onClick={chooseIdea} data-testid="spec-plan-start">
                      이걸로 시작하자 <ArrowRight aria-hidden="true" className="size-5" />
                    </Button></AiConfirm>
                    <AiConfirm><Button variant="secondary" disabled={busy || d.ideas.length < 2} onClick={rankRun} data-testid="spec-plan-rank">
                      <Gavel aria-hidden="true" className="size-4" /> 이 중 제일 좋은 게 뭐야?
                    </Button></AiConfirm>
                    <AiConfirm><Button variant="secondary" disabled={busy} onClick={moreRun} data-testid="spec-plan-more">
                      <Sparkles aria-hidden="true" className="size-4" /> 자체점검으로 더 짜내기
                    </Button></AiConfirm>
                    <AiConfirm><Button variant="ghost" disabled={busy} onClick={ideasRun} data-testid="spec-ideas-run">
                      5개 새로 내줘
                    </Button></AiConfirm>
                  </div>
                  <p className="t-meta break-keep text-slate-500">고른 것: <b className="font-semibold text-slate-700">{picked ? clip(picked.title, 60) : '—'}</b> · [이걸로 시작하자] 를 누르면 선행기술 조사 → 구성 → 자체점검 ① 까지 쓰고 다시 멈춥니다.</p>
                </>
              )}
            </div>
          )}

          {phase === 'parts' && !busy && (
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center" data-testid="spec-plan-parts">
              <AiConfirm><Button variant="primary" className="min-h-12" onClick={() => partsRun()} data-testid="spec-plan-parts-run">
                <Boxes aria-hidden="true" className="size-5" /> 이 아이디어로 구성 짜기
              </Button></AiConfirm>
              <Button variant="ghost" onClick={goBackToIdeas} data-testid="spec-plan-back">
                다른 아이디어로
              </Button>
            </div>
          )}

          {phase === 'review' && !busy && (
            <div className="flex flex-col gap-2.5" data-testid="spec-plan-review">
              <PartsReview d={d} />
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <AiConfirm><Button variant="primary" className="min-h-12" onClick={bodyRun} data-testid="spec-plan-body">
                  <FileText aria-hidden="true" className="size-5" /> 이 구성으로 본문 · 청구항 쓰기
                </Button></AiConfirm>
                <AiConfirm><Button variant="secondary" onClick={() => partsRun(true)} data-testid="spec-plan-parts-again">
                  <Boxes aria-hidden="true" className="size-4" /> 구성 다시 짜기
                </Button></AiConfirm>
                <Button variant="ghost" onClick={() => onEdit('parts')} data-testid="spec-plan-edit-parts">
                  <PenLine aria-hidden="true" className="size-4" /> 구성 직접 고치기
                </Button>
                <Button variant="ghost" onClick={goBackToIdeas} data-testid="spec-plan-back">
                  다른 아이디어로
                </Button>
              </div>
            </div>
          )}

          {phase === 'body' && !busy && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <AiConfirm><Button variant="primary" className="min-h-12 sm:min-w-56" onClick={all} data-testid="spec-board-all">
                <Sparkles aria-hidden="true" className="size-5" /> 이어서 끝까지 써줘
              </Button></AiConfirm>
            </div>
          )}

          {finished && (
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center" data-testid="spec-board-finished">
              <Button variant="primary" className="min-h-12" onClick={() => downloadPlain(d)} data-testid="spec-board-done-download">
                <Download aria-hidden="true" className="size-5" /> 전문 내려받기(.txt)
              </Button>
              <Button variant="secondary" disabled={packing} onClick={onPack} data-testid="spec-board-done-pack">
                {packing ? '묶는 중…' : '제출 준비 묶음(ZIP)'}
              </Button>
              <Button variant="ghost" onClick={onDownload} data-testid="spec-board-done-md">
                MD 내려받기
              </Button>
              <AiConfirm><Button variant="ghost" disabled={busy} onClick={all} data-testid="spec-board-all">
                <Sparkles aria-hidden="true" className="size-4" /> 빠진 곳 다시 써줘
              </Button></AiConfirm>
            </div>
          )}
          {matsOpen && (
            <SpecMaterialsSheet
              open
              onClose={() => setMatsOpen(false)}
              d={d}
              docs={docs}
              missingFiles={docsWithoutFile(record)}
              reading={reading}
              docFails={docFails}
              onImportDocs={(keys) => void importDocs(keys)}
              onPickFiles={() => fileRef.current?.click()}
              onAddText={addText}
              onRemove={removeMaterial}
            />
          )}
          <input ref={fileRef} type="file" multiple className="hidden" accept=".pdf,.hwp,.hwpx,.docx,.txt,.md,.xlsx,.png,.jpg,.jpeg" onChange={(e) => {
            void addFiles(e.target.files)
            e.target.value = ''
          }} data-testid="spec-board-file-input" />
          <p className="t-meta break-keep text-slate-500">절차마다 단추로 넘어갑니다 · 직접 고치신 글은 덮지 않고 새 안으로 둡니다 · 이 내용이 고른 AI 회사로 갑니다(출원 전 발명).</p>

          {stagesShown.length > 0 && (
            <ol className="flex flex-col gap-1 rounded-(--radius-control) border border-violet-200 bg-violet-50/60 px-3 py-2" data-testid="spec-board-rows" aria-live="polite">
              {stagesShown.map((k) => {
                const r = run.stages[k]!
                return (
                  <li key={k} className="flex items-start gap-2" data-testid="spec-board-row" data-stage={k} data-phase={r.phase} data-model={r.model ?? ''}>
                    <PhaseIcon phase={r.phase} />
                    <p className="t-sub min-w-0 break-keep text-slate-800">
                      <b className="font-semibold">{stageOf(k).label}</b> <span className={PHASE_TONE[r.phase]}>· {r.text}</span>
                      {r.model && <span className="t-meta ml-1.5 inline-block rounded bg-white px-1.5 font-semibold whitespace-nowrap text-slate-600 ring-1 ring-slate-200">{prettyModel(r.model)}</span>}
                    </p>
                  </li>
                )
              })}
            </ol>
          )}
          {run.asks.length > 0 && (
            <div className="flex flex-col gap-1 rounded-(--radius-control) border border-warning-200 bg-warning-50 px-3 py-2" data-testid="spec-board-asks">
              <p className="t-sub font-semibold text-warning-900">AI 가 확인해 달라는 점</p>
              <ul className="flex flex-col gap-0.5">
                {run.asks.map((a) => (
                  <li key={a.key} className="t-sub break-keep text-slate-800">
                    <b className="font-semibold">{a.key}</b> · {a.text}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Surface>

      {(phase === 'done' || phase === 'body') && <SpecFullText d={d} />}

      <button
        type="button"
        onClick={() => setShowCards((v) => !v)}
        aria-expanded={showCards}
        className="tap t-sub flex min-h-11 items-center justify-between gap-2 rounded-(--radius-control) border border-slate-200 bg-white px-3 font-semibold text-slate-800 hover:bg-slate-50"
        data-testid="spec-cards-toggle"
      >
        <span className="min-w-0 break-keep">칸별로 보기 · 다른 아이디어 고르기 · 칸만 다시 쓰기</span>
        <span className="t-meta shrink-0 text-slate-500">
          {doneCards}/{CARDS.length} {showCards ? '▲' : '▼'}
        </span>
      </button>

      {showCards && (
      <div className="grid gap-3 lg:grid-cols-2" data-testid="spec-cards">
        {CARDS.map((card) => {
          const meta = CARD_META[card]
          const st = cardState(card, d)
          const stageRows = CARD_STAGES[card].map((k) => run.stages[k]).filter(Boolean) as StageRow[]
          const live = stageRows.find((r) => r.phase === 'run') ?? stageRows.find((r) => r.phase === 'fail')
          const why = stageBlock(CARD_STAGES[card][0], d)
          const blocked = why.startsWith('아이디어') ? '아이디어부터' : why ? '구성부터' : ''
          return (
            <Surface key={card}>
              <section className="flex h-full flex-col gap-2.5" data-testid="spec-card" data-card={card} data-done={st.done ? 'yes' : 'no'} aria-labelledby={`spec-card-${card}`}>
                <div className="flex items-center gap-2">
                  <span aria-hidden="true" className={`flex size-8 shrink-0 items-center justify-center rounded-full ${st.done ? 'bg-success-100 text-success-700' : 'bg-slate-100 text-slate-600'}`}>
                    {st.done ? <CheckCircle2 className="size-5" /> : meta.icon}
                  </span>
                  <h4 id={`spec-card-${card}`} className="t-body min-w-0 flex-1 font-bold break-keep text-slate-900">
                    {meta.n}. {meta.title}
                  </h4>
                  {st.human && <span className="t-meta shrink-0 rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">직접 고친 글 있음</span>}
                </div>
                <p className="t-meta break-keep text-slate-500">{meta.help}</p>

                <CardBody card={card} d={d} onPick={pickIdea} errs={errs.length} />

                {live && (
                  <p className={`t-sub flex items-center gap-1.5 break-keep ${PHASE_TONE[live.phase]}`} data-testid="spec-card-live">
                    <PhaseIcon phase={live.phase} /> {live.text}
                  </p>
                )}

                <div className="mt-auto flex flex-wrap gap-2 pt-1">
                  <AiConfirm><Button variant={st.done ? 'secondary' : 'primary'} size="sm" disabled={busy || !!blocked} onClick={() => runCard(card)} data-testid="spec-card-run" data-card={card} title={blocked || undefined}>
                    <Sparkles aria-hidden="true" className="size-4" /> {blocked ? `${meta.run} (${blocked})` : st.done ? meta.again : meta.run}
                  </Button></AiConfirm>
                  {card === 'check' ? (
                    <>
                      <Button variant="secondary" size="sm" onClick={onDownload} data-testid="spec-board-download">
                        <Download aria-hidden="true" className="size-4" /> MD 내려받기
                      </Button>
                      <Button variant="secondary" size="sm" disabled={packing} onClick={onPack} data-testid="spec-board-pack">
                        {packing ? '묶는 중…' : '제출 준비 묶음(ZIP)'}
                      </Button>
                    </>
                  ) : null}
                  <Button variant="ghost" size="sm" onClick={() => onEdit(EDIT_STEP[card])} data-testid="spec-card-edit" data-card={card}>
                    <PenLine aria-hidden="true" className="size-4" /> {card === 'check' ? '점검 자세히' : '직접 고치기'}
                  </Button>
                </div>
              </section>
            </Surface>
          )
        })}
      </div>
      )}
    </div>
  )
}

const STAGE_ORDER: AgentStage[] = ['talk', 'idea', 'ideaRank', 'ideaMore', 'research', 'parts', 'judge1', 'a', 'b', 'c', 'd', 'e', 'judge2', 'fix']
const EDIT_STEP: Record<AgentCard, DraftStep> = { idea: 'idea', research: 'idea', parts: 'parts', body: 'body', claims: 'claims', judge: 'check', check: 'check' }

const clip = (s: string, n: number) => {
  const t = s.replace(/\s+/g, ' ').trim()
  return t.length > n ? `${t.slice(0, n)}…` : t
}

/** D-269 구성 확인 — 조사 결론 · 시스템 · 구성요소 · 단계 · 연결관계(본문 · 청구항을 쓰기 전에 대표가 본다) */
function PartsReview({ d }: { d: SpecDraft }) {
  const comps = d.components.filter((c) => c.name.trim())
  const steps = d.steps.filter((s) => s.text.trim())
  const r = d.research
  return (
    <div className="flex flex-col gap-2 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2.5" data-testid="spec-review">
      {r && (
        <p className="t-sub break-keep text-slate-800">
          <b className="font-semibold">선행기술 조사</b> · {r.headline || `메모 ${r.items.length}개`}{' '}
          <span className={`t-meta rounded-full px-2 py-0.5 font-semibold whitespace-nowrap ${r.grounded ? 'bg-success-100 text-success-800' : 'bg-warning-100 text-warning-900'}`}>{r.grounded ? `검색 근거 ${r.sources.length}곳` : '검색 근거 없음 — KIPRIS 확인'}</span>
        </p>
      )}
      <p className="t-sub font-semibold break-keep text-slate-900 [overflow-wrap:anywhere]">{d.systemName || titleParts(d.title).system}(100)</p>
      <ul className="flex flex-col gap-0.5" data-testid="spec-review-comps">
        {comps.map((c) => (
          <li key={c.no} className="t-sub break-keep text-slate-800 [overflow-wrap:anywhere]">
            <b className="font-semibold">
              {c.name}({c.no})
            </b>{' '}
            <span className="text-slate-600">— {clip(c.does, 90)}</span>
          </li>
        ))}
      </ul>
      <p className="t-meta break-keep text-slate-600">
        방법 단계 {steps.length}개 · 종속항 씨앗 {d.seeds.length}개 · 도면 {d.figures.length}장
      </p>
      {d.axis.link && <p className="t-meta break-keep text-violet-900">경쟁사가 피하기 어려운 연결관계 · {d.axis.link}</p>}
    </div>
  )
}

function CardBody({ card, d, onPick, errs }: { card: AgentCard; d: SpecDraft; onPick: (p: IdeaPick) => void; errs: number }) {
  switch (card) {
    case 'idea':
      return (
        <div className="flex flex-col gap-2">
          {d.title.trim() ? (
            <div className="rounded-(--radius-control) border border-violet-300 bg-violet-50 px-3 py-2" data-testid="spec-board-title">
              <p className="t-meta font-semibold text-violet-800">
                {d.ideas[0]?.title === d.title && <span className="mr-1 rounded-full bg-violet-600 px-1.5 py-0.5 font-bold text-white">추천</span>}
                지금 쓰는 아이디어
              </p>
              <p className="t-sub font-semibold break-keep text-slate-900 [overflow-wrap:anywhere]">{titleLine(d)}</p>
              {d.idea.problem && <p className="t-sub break-keep text-slate-600">문제 · {clip(d.idea.problem, 120)}</p>}
            </div>
          ) : (
            <p className="t-sub break-keep text-slate-600">아직 아이디어가 없습니다 — [아이디어 내줘] 를 누르세요.</p>
          )}
          {d.ideas.some((p) => p.title !== d.title) && (
            <p className="t-meta font-semibold text-slate-600">다른 후보 — 누르면 그걸로 바뀝니다</p>
          )}
          {d.ideas.some((p) => p.title !== d.title) && (
            <ul className="flex flex-col gap-1.5" data-testid="spec-ideas">
              {d.ideas.map((p, i) => {
                if (p.title === d.title) return null
                return (
                  <li key={`${p.title}-${i}`} className="flex flex-col gap-1 rounded-(--radius-control) border border-slate-200 px-3 py-2 sm:flex-row sm:items-center" data-testid="spec-idea" data-current="no">
                    <div className="min-w-0 flex-1">
                      <p className="t-sub font-semibold break-keep text-slate-900 [overflow-wrap:anywhere]">
                        {i === 0 && <span className="t-meta mr-1 rounded-full bg-violet-600 px-1.5 py-0.5 font-bold text-white">추천</span>}
                        {p.title}
                      </p>
                      {p.why && <p className="t-meta break-keep text-slate-600">{clip(p.why, 140)}</p>}
                    </div>
                    <Button variant="secondary" size="sm" className="self-start sm:self-auto" onClick={() => onPick(p)} data-testid="spec-idea-use">
                      이걸로 <ArrowRight aria-hidden="true" className="size-4" />
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )
    case 'research': {
      const r = d.research
      if (!r) return <p className="t-sub break-keep text-slate-600">아이디어가 정해지면 [조사해줘] — 비슷한 기술 · 차별화 · 위험을 정리합니다.</p>
      const stale = r.forTitle !== d.title
      const words = r.items.find((it) => /검색어/.test(it.tag))
      return (
        <div className="flex flex-col gap-2" data-testid="spec-research">
          {stale && <p className="t-meta break-keep text-warning-800">명칭이 바뀌어 예전 조사입니다 — [다시 조사] 하세요.</p>}
          {r.headline && <p className="t-sub font-semibold break-keep text-slate-900">{r.headline}</p>}
          <span className={`t-meta self-start rounded-full px-2 py-0.5 font-semibold ${r.grounded ? 'bg-success-100 text-success-800' : 'bg-warning-100 text-warning-900'}`} data-testid="spec-research-grounded" data-grounded={r.grounded ? 'yes' : 'no'}>
            {r.grounded ? `검색 근거 ${r.sources.length}곳` : 'AI 가 아는 범위 — KIPRIS 에서 확인 필요'}
          </span>
          <ul className="flex flex-col gap-1">
            {r.items.filter((it) => it !== words).slice(0, 5).map((it, i) => (
              <li key={i} className="t-sub break-keep text-slate-800">
                <b className="font-semibold">{it.tag || '메모'}</b> · {it.title}
                {it.detail ? <span className="text-slate-600"> — {clip(it.detail, 140)}</span> : null}
              </li>
            ))}
          </ul>
          {words && words.outline.length > 0 && (
            <p className="t-meta break-keep rounded-(--radius-control) bg-slate-50 px-2.5 py-1.5 text-slate-700" data-testid="spec-research-words">
              KIPRIS 검색어 · {words.outline.join(' / ')}
            </p>
          )}
          {r.sources.length > 0 && (
            <ul className="flex flex-col gap-0.5" data-testid="spec-research-sources">
              {r.sources.slice(0, 5).map((s) => (
                <li key={s.url} className="t-meta min-w-0">
                  <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 text-brand-700 underline [overflow-wrap:anywhere]">
                    <ExternalLink aria-hidden="true" className="size-3.5 shrink-0" /> {s.title}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )
    }
    case 'parts': {
      const comps = d.components.filter((c) => c.name.trim())
      if (!comps.length) return <p className="t-sub break-keep text-slate-600">아이디어가 정해지면 [구성 써줘] — 구성요소 · 단계 · 종속항을 한 번에.</p>
      return (
        <div className="flex flex-col gap-1.5" data-testid="spec-board-parts">
          <ul className="flex flex-col gap-0.5">
            {comps.slice(0, 7).map((c) => (
              <li key={c.no} className="t-sub break-keep text-slate-800">
                <b className="font-semibold">
                  {c.name}({c.no})
                </b>{' '}
                <span className="text-slate-600">— {clip(c.does, 70)}</span>
              </li>
            ))}
          </ul>
          <p className="t-meta break-keep text-slate-600">
            단계 {d.steps.filter((s) => s.text.trim()).length}개 · 종속항 씨앗 {d.seeds.length}개 · 도면 {d.figures.length}장({d.figures.slice(0, 2).map((f) => `도 ${f.n} ${clip(figureSubject(d, f), 24)}`).join(' · ')}…)
          </p>
        </div>
      )
    }
    case 'judge': {
      if (!d.judge.parts && !d.judge.full) return <p className="t-sub break-keep text-slate-600">구성을 쓰면 ①, 청구항까지 쓰면 ② 가 저절로 판정합니다 — 지금 바로 부르려면 [자체점검 불러줘].</p>
      return (
        <div className="flex flex-col gap-2" data-testid="spec-board-judge">
          <JudgeReportView report={d.judge.parts} title="① 구성 · 권리축" testId="spec-judge-parts" />
          <JudgeReportView report={d.judge.full} title="② 명세서 전체" testId="spec-judge-full" />
        </div>
      )
    }
    case 'body': {
      return (
        <ul className="flex flex-wrap gap-1.5" data-testid="spec-board-body">
          {SECTION_KEYS.map((k) => {
            const has = !!(d.text[k] ?? '').trim()
            return (
              <li key={k} className={`t-meta rounded-full px-2 py-0.5 font-semibold ${has ? 'bg-success-100 text-success-800' : 'bg-slate-100 text-slate-600'}`} data-has={has ? 'yes' : 'no'}>
                {has ? '✓ ' : ''}
                {SECTION_LABEL[k]}
              </li>
            )
          })}
        </ul>
      )
    }
    case 'claims': {
      const cs = claimsOf(d)
      if (!d.claims.length) return <p className="t-sub break-keep text-slate-600">{cs.length ? `규칙 뼈대 ${cs.length}개 — [청구항 써줘] 로 다듬습니다.` : '구성이 정해지면 [청구항 써줘].'}</p>
      return (
        <div className="flex flex-col gap-1" data-testid="spec-board-claims">
          <p className="t-sub font-semibold text-slate-900">청구항 {d.claims.length}개</p>
          <p className="t-meta break-keep text-slate-600">청구항 1 · {clip(d.claims[0], 150)}</p>
        </div>
      )
    }
    case 'check':
      return (
        <div className="flex flex-col gap-1" data-testid="spec-board-check" data-errors={errs}>
          <p className={`t-sub font-semibold break-keep ${errs ? 'text-danger-700' : 'text-success-700'}`}>{errs ? `고쳐야 할 것 ${errs}개 (규칙 점검)` : '고쳐야 할 것 없음 — 내려받아 특허로 편집기에 붙이세요'}</p>
          <p className="t-meta break-keep text-slate-500">점검은 규칙 계산입니다. 편집기 통과를 보장하지는 않습니다.</p>
        </div>
      )
  }
}
