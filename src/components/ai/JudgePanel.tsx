/**
 * D-263 자체점검 — 판정 보기 · 대표 정의 붙여 넣기(명세서 작업판 · 벤처 사업계획서 AI 판이 같이 쓴다).
 *
 *  - JudgeReportView: 점수(90 이상 초록 · 80대 노랑 · 그 밑 빨강) · P0 · 자체점검이 직접 고친 칸 · 대표 확인 질문
 *  - JudgeSkillButton: [자체점검 기준] → 기본 정의 요약 + 대표가 쓰던 /자체점검 정의를 붙여 넣는 칸(파일로 불러오기 가능).
 *    저장하면 자체점검 · 명세서/사업계획서 쓰기 단추마다 그 정의가 같이 간다 — GPT · Gemini · Claude 어느 것을 골라도.
 */
import { useEffect, useRef, useState } from 'react'
import { Gavel } from 'lucide-react'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { useToast } from '../ui/toastContext'
import { WorkspaceScope } from '../workspace/WorkspaceScope'
import { JUDGE_PASS, judgePassed, type JudgeReport } from '../../services/aiAssist/judge'
import { JUDGE_SKILL_EVENT, JUDGE_SKILL_MAX, readJudgeSkill, saveJudgeSkill, syncJudgeSkill } from '../../services/aiAssist/judgeSkill'

const LEVEL_TONE: Record<string, string> = {
  P0: 'bg-danger-100 text-danger-800',
  감점: 'bg-warning-100 text-warning-900',
  '대표 확인': 'bg-sky-100 text-sky-900',
}

export function JudgeReportView({ report, title, testId = 'judge-report' }: { report: JudgeReport | null | undefined; title: string; testId?: string }) {
  if (!report) return null
  const pass = judgePassed(report)
  const p0 = report.verdicts.filter((v) => v.level === 'P0').length
  const tone = report.score == null ? 'bg-slate-100 text-slate-700' : pass ? 'bg-success-100 text-success-800' : report.score >= 80 && !p0 ? 'bg-warning-100 text-warning-900' : 'bg-danger-100 text-danger-800'
  return (
    <div className="flex flex-col gap-1.5 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2" data-testid={testId} data-score={report.score ?? ''} data-pass={pass ? 'yes' : 'no'}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Gavel aria-hidden="true" className="size-4 shrink-0 text-slate-700" />
        <p className="t-sub font-semibold text-slate-900">{title}</p>
        <span className={`t-meta rounded-full px-2 py-0.5 font-bold ${tone}`} data-testid={`${testId}-score`}>
          {report.score == null ? '점수 없음' : `${report.score}점`}
        </span>
        <span className={`t-meta rounded-full px-2 py-0.5 font-semibold ${p0 ? 'bg-danger-100 text-danger-800' : 'bg-slate-100 text-slate-700'}`}>P0 {p0}</span>
        {report.rounds > 1 && <span className="t-meta rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">고친 뒤 다시 판정</span>}
        {report.custom && <span className="t-meta rounded-full bg-violet-100 px-2 py-0.5 font-semibold text-violet-800">대표 기준</span>}
      </div>
      <p className="t-meta break-keep text-slate-600">
        {/* MUX — 특허 · 벤처는 AI 가 확정하지 않는다: 통과는 '자체점검 통과(초안)' 까지, 출원 · 신청은 사람이 정한다 */}
        {pass ? `${JUDGE_PASS}점 이상 · P0 없음 — AI 자체점검 통과(아직 초안). 출원 · 신청 여부는 대표 · 변리사가 확인하고 정합니다.` : p0 ? 'P0 가 남아 있습니다 — 아래 대표 확인부터.' : `${JUDGE_PASS}점 미만 — 아래 확인할 것을 채우면 올라갑니다.`}
        {report.fixed.length ? ` 자체점검에서 직접 고친 칸: ${report.fixed.join(' · ')}.` : ' 고친 칸 없음.'}
        {report.kept.length ? ` 직접 고치신 ${report.kept.join(' · ')}은 덮지 않고 새 안으로 두었습니다.` : ''}
      </p>
      {report.scores && <p className="t-meta break-keep text-slate-500">항목 점수 · {report.scores}</p>}
      {report.verdicts.length > 0 && (
        <ul className="flex flex-col gap-1" data-testid={`${testId}-verdicts`}>
          {report.verdicts.map((v, i) => (
            <li key={i} className="t-sub flex flex-wrap items-start gap-1.5 break-keep text-slate-800">
              <span className={`t-meta shrink-0 rounded-full px-1.5 py-0.5 font-bold ${LEVEL_TONE[v.level] ?? LEVEL_TONE['감점']}`}>{v.level}</span>
              <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                {v.text}
                {v.fix && <span className="text-slate-600"> — {v.fix}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** 기본 정의 요약(서버 api/_ai/judge.js 와 같은 뜻 — 화면에는 짧게) */
const DEFAULT_LINES = [
  '공격 질문 — 심사위원 · 실사 담당(벤처) · 심사관 · 경쟁사 변리사(특허)가 던질 가장 날카로운 질문을 스스로 빠짐없이 던집니다.',
  '점수 판정 — 10개 항목 각 10점(100점)으로 판정하고, P0(하나라도 있으면 못 내는 것)를 찾습니다. 90점 이상 · P0 없음이면 통과.',
  '고친 글로 — 글로 고칠 수 있는 약점은 그 칸을 직접 고쳐 넣습니다. 사실이 없어 못 고치는 것만 "대표 확인" 으로 묻습니다.',
  '"보완하면 좋겠다" 로 끝내지 않습니다 — 취향 수준 지적은 하지 않고, 고칠 것이 없으면 없다고 판정합니다.',
]

function SkillSync({ workspaceId }: { workspaceId: string | null }) {
  useEffect(() => {
    void syncJudgeSkill(workspaceId)
  }, [workspaceId])
  return null
}

export function JudgeSkillButton({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  return <WorkspaceScope>{(ctx) => <JudgeSkillInner workspaceId={ctx.workspaceId} size={size} />}</WorkspaceScope>
}

function JudgeSkillInner({ workspaceId, size }: { workspaceId: string | null; size: 'sm' | 'md' }) {
  const { showToast } = useToast()
  const [open, setOpen] = useState(false)
  const [saved, setSaved] = useState(() => readJudgeSkill())
  const [text, setText] = useState(saved)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const on = () => setSaved(readJudgeSkill())
    window.addEventListener(JUDGE_SKILL_EVENT, on)
    return () => window.removeEventListener(JUDGE_SKILL_EVENT, on)
  }, [])
  const openSheet = () => {
    setText(readJudgeSkill())
    setOpen(true)
  }
  const save = async (value: string) => {
    setBusy(true)
    const ok = await saveJudgeSkill(workspaceId, value)
    setBusy(false)
    setSaved(readJudgeSkill())
    showToast(value.trim() ? (ok ? '점검 기준을 저장했습니다 — 다음 AI 부름부터 같이 갑니다' : '이 기기에만 저장했습니다(클라우드에 올리지 못함)') : '대표 기준을 지웠습니다 — 기본 자체점검으로 판정합니다')
    setOpen(false)
  }
  const fromFile = async (f: File | undefined) => {
    if (!f) return
    try {
      const t = (await f.text()).slice(0, JUDGE_SKILL_MAX)
      setText(t)
      showToast(`${f.name} 을 불러왔습니다 — [저장] 을 누르세요`)
    } catch {
      showToast('파일을 읽지 못했습니다 — .md · .txt 로')
    }
  }
  return (
    <>
      <SkillSync workspaceId={workspaceId} />
      <Button variant="ghost" size={size} onClick={openSheet} data-testid="judge-skill-open">
        <Gavel aria-hidden="true" className="size-4" /> 자체점검 기준{saved ? ' · 대표 기준' : ''}
      </Button>
      <Modal open={open} title="자체점검 — 쓰는 중간중간 반드시 거치는 점검" onClose={() => setOpen(false)} size="lg"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            {saved && (
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => void save('')} data-testid="judge-skill-clear">
                기본으로(대표 기준 지우기)
              </Button>
            )}
            <Button variant="primary" size="sm" disabled={busy || text.trim() === saved.trim()} onClick={() => void save(text)} data-testid="judge-skill-save">
              {busy ? '저장 중…' : '저장'}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3" data-testid="judge-skill-sheet">
          <div className="flex flex-col gap-1">
            <p className="t-sub font-semibold text-slate-900">언제 들어가나요</p>
            <p className="t-sub break-keep text-slate-700">명세서: 구성 · 권리축을 쓴 뒤(①) · 청구항까지 쓴 뒤(②). 벤처 사업계획서: 요약을 쓴 뒤 · 본문을 다 쓴 뒤. 그 단계 단추에 저절로 들어가고, 90점 미만이면 자체점검이 고친 글로 한 번 더 판정합니다. 기획 단계([이 중 제일 좋은 게 뭐야?] · [자체점검으로 더 짜내기])도 이 기준으로 후보를 봅니다.</p>
          </div>
          <div className="flex flex-col gap-1">
            <p className="t-sub font-semibold text-slate-900">기본 자체점검</p>
            <ul className="flex flex-col gap-1">
              {DEFAULT_LINES.map((l) => (
                <li key={l} className="t-sub break-keep text-slate-700">· {l}</li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="t-sub font-semibold text-slate-900">대표님이 쓰시던 점검 기준(선택)</p>
            <p className="t-meta break-keep text-slate-600">ChatGPT 에서 쓰시던 점검 스킬 설명을 그대로 붙여 넣거나 파일로 불러오세요. 저장하면 GPT · Gemini · Claude 어느 것을 골라도 자체점검 · 쓰기 단추마다 같이 가서, 따로 설명하지 않아도 그 기준대로 점검합니다(기본 기준보다 우선 · {JUDGE_SKILL_MAX.toLocaleString('ko-KR')}자까지).</p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, JUDGE_SKILL_MAX))}
              rows={8}
              placeholder="예) 너는 … 심사위원이다. 1) … 2) …"
              className="t-sub w-full rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2 text-slate-900"
              data-testid="judge-skill-text"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()} data-testid="judge-skill-file">
                파일에서 불러오기(.md · .txt)
              </Button>
              <span className="t-meta text-slate-500">{text.length.toLocaleString('ko-KR')}자</span>
            </div>
            <input ref={fileRef} type="file" accept=".md,.txt,text/plain,text/markdown" className="hidden" onChange={(e) => {
              void fromFile(e.target.files?.[0])
              e.target.value = ''
            }} />
          </div>
        </div>
      </Modal>
    </>
  )
}
