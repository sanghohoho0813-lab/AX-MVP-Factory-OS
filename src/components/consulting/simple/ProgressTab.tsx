/**
 * 진행하기 — 프로젝트를 열면 처음 보이는 화면.
 *
 * 계기판을 보여주지 않는다. "어디까지 왔는가 + 지금 무엇을 하면 되는가" 만 보여준다.
 * 프롬프트를 만들면 그 자리에 결과 패널이 뜨고, 아래 카드는 자동으로 '결과 가져오기' 로 바뀐다.
 */

import { useMemo, useState } from 'react'
import { useEditor } from '../editorContext'
import { resolveCurrentTask, overallPercent } from '../../../domain/consulting/currentTask'
import type { TaskSubmission } from '../../../domain/consulting/applyTask'
import { buildPromptPackage } from '../../../domain/consulting/promptPackageBuilder'
import { artifactDef } from '../../../domain/consulting/artifactDefinitions'
import { createArtifact, savePromptPackage } from '../../../services/consultingStudioService'
import { defaultArtifactTitle, parsePastedResult } from '../../../domain/consulting/resultImport'
import { parseReturnBlock } from '../../../domain/consulting/returnBlock'
import type { ConsultingPromptPackage } from '../../../types/consulting'
import type { DocFactRead } from '../../../domain/consulting/companyDocFacts'
import { TaskCard } from './TaskCard'
import { PromptResultPanel } from './PromptResultPanel'
import { QuickImportSheet } from './QuickImportSheet'
import { CompanyDocSheet } from './CompanyDocSheet'

export function ProgressTab({ onOpenAdvanced }: { onOpenAdvanced: () => void }) {
  const ed = useEditor()
  const { project: p, artifacts, prompts, evidence, decisions, today, workspaceId } = ed
  const [busy, setBusy] = useState(false)
  const [generated, setGenerated] = useState<ConsultingPromptPackage | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [docOpen, setDocOpen] = useState(false)

  const ctx = useMemo(() => ({ artifacts, prompts, evidence, today }), [artifacts, prompts, evidence, today])
  const task = useMemo(() => resolveCurrentTask(p, ctx), [p, ctx])
  const percent = overallPercent(p)

  /* ---------- 프롬프트 만들기 (원클릭) ---------- */
  const generate = async () => {
    if (!task.promptType) return
    setBusy(true)
    try {
      const built = buildPromptPackage({ project: p, type: task.promptType, target: 'chatgpt', section: (task.promptSection as 1) ?? 1, artifacts, evidence })
      const pkg = await savePromptPackage(workspaceId, {
        projectId: p.id,
        type: task.promptType,
        target: 'chatgpt',
        stageKey: built.stageKey,
        title: built.title,
        prompt: built.prompt,
        context: built.context,
        privacy: built.privacy,
        section: built.section,
      })
      setGenerated(pkg)
      await ed.refresh()
      await ed.submitTask(task, {}, { extraPrompts: [pkg] })
    } catch (cause) {
      ed.toast(cause instanceof Error ? cause.message : '프롬프트를 만들지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  /* ---------- 결과 가져오기 ---------- */
  const importResult = async (text: string, fileName: string) => {
    const type = task.artifactType ?? 'NOTE'
    setBusy(true)
    try {
      const header = parsePastedResult(text)
      const block = parseReturnBlock(text)
      /*
       * 저장하는 것은 LLM 이 준 그대로다(맨 앞 [ARTIFACT] 머리줄만 뺀다).
       * 끝의 OS 반환 블록은 지우지 않는다 — 나중에 후보·부족한 사실을 다시 읽어야 하기 때문이다.
       * 사람이 읽는 화면에서는 stripReturnBlock 으로 감춘다.
       */
      const body = (header.hadHeader ? header.body : text).trim()
      const pkg = prompts.find((x) => x.type === task.promptType)
      const art = await createArtifact(workspaceId, {
        projectId: p.id,
        type,
        title: defaultArtifactTitle(type, 1, header.title || block.summary.slice(0, 40)),
        stageKey: header.stage ?? task.stageKey,
        content: body,
        source: fileName ? 'llm_file' : 'llm_paste',
        promptPackageId: pkg?.id ?? null,
        fileName,
        supersedePrevious: true,
      })
      setImportOpen(false)
      setGenerated(null)
      await ed.refresh()
      await ed.submitTask(task, {}, { extraArtifacts: [art] })
      ed.toast(`${artifactDef(type).label} 저장했습니다.`)
    } catch (cause) {
      ed.toast(cause instanceof Error ? cause.message : '저장하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  /* ---------- 서류에서 회사 정보 채우기 ---------- */
  const applyDocFacts = async (facts: DocFactRead[]) => {
    setBusy(true)
    try {
      await ed.submitTask(task, { facts })
      setDocOpen(false)
      ed.toast(`${facts.length}개 항목을 서류에서 채웠습니다.`)
    } catch (cause) {
      ed.toast(cause instanceof Error ? cause.message : '채우지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  /* ---------- 그 밖의 제출 ---------- */
  const submit = async (sub: TaskSubmission) => {
    if (task.actionType === 'GENERATE_PROMPT') return void generate()
    if (task.actionType === 'IMPORT_RESULT') return setImportOpen(true)
    if (task.actionType === 'CONTINUE') {
      if (task.finished) return ed.goTo('results')
      return onOpenAdvanced()
    }
    setBusy(true)
    try {
      await ed.submitTask(task, sub)
    } finally {
      setBusy(false)
    }
  }

  const recent = artifacts.slice(0, 3)
  const lastDecision = decisions[0]

  return (
    <div className="flex flex-col gap-4">
      {/* 어디까지 왔는가 — 한 줄 */}
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <span className="t-sub font-medium text-slate-600">전체 진행</span>
          <span className="t-sub font-semibold text-slate-700">{percent}%</span>
        </div>
        <div aria-hidden="true" className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-brand-500 transition-[width] duration-500" style={{ width: `${percent}%` }} />
        </div>
      </div>

      {generated && <PromptResultPanel pkg={generated} />}

      <TaskCard
        task={task}
        project={p}
        busy={busy}
        quiet={generated !== null}
        onSubmit={(sub) => void submit(sub)}
        onEditItem={onOpenAdvanced}
        onImportDoc={() => setDocOpen(true)}
      />

      {/*
        나중에 확인하기로 한 것 (§6).
        사용자가 기억할 필요가 없다 — 시스템이 들고 있다가 필요한 단계에서 다시 묻는다.
      */}
      {p.deferred.length > 0 && (
        <div className="rounded-(--radius-panel) border border-warning-200 bg-warning-50/60 px-4 py-3">
          <p className="t-sub font-semibold text-warning-800">나중에 확인하기로 한 것 {p.deferred.length}가지</p>
          <p className="t-sub mt-0.5 break-keep text-slate-700">{p.deferred.map((d) => d.label).join(' · ')}</p>
          <p className="t-sub mt-1 break-keep text-slate-600">지금은 몰라도 됩니다. 이 값이 꼭 필요해지는 단계에서 다시 여쭤봅니다.</p>
        </div>
      )}

      {/* 작게 — 최근 것만 */}
      {(recent.length > 0 || lastDecision) && (
        <div className="flex flex-col gap-1.5 rounded-(--radius-panel) border border-slate-200 bg-white px-4 py-3">
          {recent.map((a) => (
            <button key={a.id} type="button" onClick={() => ed.goTo('results')} className="tap flex items-baseline justify-between gap-3 text-left">
              <span className="t-sub min-w-0 truncate text-slate-700">{a.title}</span>
              <span className="t-sub shrink-0 text-slate-500">{artifactDef(a.type).label}</span>
            </button>
          ))}
          {lastDecision && (
            <div className="flex items-baseline justify-between gap-3">
              <button type="button" onClick={() => ed.goTo('timeline')} className="tap t-sub min-w-0 truncate text-left text-slate-600">
                방금 · {lastDecision.summary}
              </button>
              {/* 잘못 눌렀을 때 돌아갈 자리 (§36) */}
              <button type="button" onClick={onOpenAdvanced} className="tap t-sub shrink-0 font-medium text-slate-600 hover:text-slate-900">
                고치기
              </button>
            </div>
          )}
        </div>
      )}

      {docOpen && <CompanyDocSheet project={p} busy={busy} onApply={(facts) => void applyDocFacts(facts)} onClose={() => setDocOpen(false)} />}

      {importOpen && task.artifactType && (
        <QuickImportSheet artifactType={task.artifactType} busy={busy} onSave={(t, f) => void importResult(t, f)} onClose={() => setImportOpen(false)} />
      )}
    </div>
  )
}
