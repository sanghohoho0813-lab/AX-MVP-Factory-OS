/**
 * 지금 할 일 카드 — 화면의 주인공.
 *
 * 이 카드는 단계도 프롬프트 종류도 모른다. CurrentTask 하나를 받아
 * actionType 에 따라 7가지 중 하나로 그린다.
 *
 * 처음 쓰는 사람 기준으로 세 가지를 지킨다.
 *   1. 강조 버튼은 하나다. 나머지는 눈에 약하게.
 *   2. 시스템이 먼저 쓴 초안·추천이 있으면 그것을 먼저 보여 주고, 사용자는 확인만 한다.
 *   3. 모르면 [나중에 확인] 으로 넘어갈 수 있다 — 값 하나 때문에 일이 멈추지 않는다.
 */

import { useEffect, useState } from 'react'
import { ArrowRight, Check, CircleAlert, FileUp, Lightbulb, Pencil, Sparkles } from 'lucide-react'
import type { CurrentTask } from '../../../domain/consulting/currentTask'
import type { TaskSubmission } from '../../../domain/consulting/applyTask'
import { RED_FLAGS } from '../../../domain/consulting/qaRules'
import { composeProblemSentence } from '../../../domain/consulting/suggestions'
import type { ConsultingProject } from '../../../types/consulting'
import { Button } from '../../ui/Button'
import { HelpNote } from './HelpNote'

export function TaskCard({
  task,
  busy,
  onSubmit,
  onEditItem,
  onImportDoc,
  project,
  quiet = false,
}: {
  task: CurrentTask
  busy: boolean
  /** 문장 초안을 만들 때 필요한 회사 정보 */
  project: ConsultingProject
  /** INPUT·SELECT·CONFIRM·CONTINUE 는 여기로. GENERATE_PROMPT·IMPORT_RESULT 는 바깥에서 처리한다 */
  onSubmit: (sub: TaskSubmission) => void
  /** CONFIRM 에서 '수정' */
  onEditItem?: () => void
  /** task.docImport 일 때 — 사업자등록증·법인등기부등본 올리기 */
  onImportDoc?: () => void
  /** 위에 이미 강조 블록(프롬프트 결과)이 있을 때 — 조용하게 그린다 */
  quiet?: boolean
}) {
  const inputs = task.inputs ?? []
  const hasDraft = inputs.some((i) => (i.suggestion ?? '').trim() !== '')
  const rec = task.recommend

  const [values, setValues] = useState<string[]>([])
  const [picked, setPicked] = useState<string[]>([])
  const [freeText, setFreeText] = useState('')
  const [freeOpen, setFreeOpen] = useState(false)
  /** 초안이 있으면 칸을 접어 둔다 — 고칠 때만 편다 */
  const [editOpen, setEditOpen] = useState(false)
  /** 추천이 있으면 목록을 접어 둔다 — 다르게 고를 때만 편다 */
  const [chooseOpen, setChooseOpen] = useState(false)

  // 할 일이 바뀌면 입력 상태를 비우고, 초안이 있으면 그것으로 채운다
  useEffect(() => {
    setValues((task.inputs ?? []).map((i) => i.suggestion ?? ''))
    setPicked(task.recommend ? task.recommend.values : [])
    setFreeText('')
    setFreeOpen(false)
    setEditOpen(false)
    setChooseOpen(false)
  }, [task.id, task.inputs, task.recommend])

  const readyOk = task.ready.filter((r) => r.ok).length
  const multi = task.multi
  /** 추천을 그대로 쓰는 중인가 — 그러면 목록을 굳이 펴지 않는다 */
  const usingRec = rec !== undefined && !chooseOpen
  /** 고른 보기를 시스템이 늘려 쓸 문장 — 저장 전에 미리 보여 준다 */
  const composedSource = freeOpen ? freeText : picked[0] ?? ''
  const composed = task.composeKind === 'coreProblem' && composedSource.trim() !== '' ? composeProblemSentence(composedSource, project).text : ''

  const canSubmit = (() => {
    if (busy) return false
    switch (task.actionType) {
      case 'INPUT':
        return values.some((v) => v.trim() !== '')
      case 'SELECT':
        if (usingRec) return true
        if (freeOpen) return freeText.trim() !== ''
        if (multi) return picked.length >= multi.min && picked.length <= multi.max
        return picked.length === 1
      default:
        return true
    }
  })()

  const submit = () => {
    if (!canSubmit) return
    if (task.actionType === 'INPUT') onSubmit({ values })
    else if (task.actionType === 'SELECT') onSubmit({ selected: freeOpen ? [freeText.trim()] : picked })
    else onSubmit({})
  }

  const togglePick = (v: string) => {
    setFreeOpen(false)
    if (multi) setPicked((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : cur.length >= multi.max ? cur : [...cur, v]))
    else setPicked([v])
  }

  return (
    <section className={`rounded-(--radius-panel) bg-white p-5 sm:p-6 ${quiet ? 'border border-slate-200' : 'border-2 border-brand-200'}`}>
      <h2 className={`${quiet ? 't-section' : 't-page'} break-keep text-slate-900`}>{task.headline}</h2>
      {task.detail && <p className="t-body mt-2 break-keep text-slate-600">{task.detail}</p>}

      {/* 아무것도 준비되지 않았을 때 0/7 목록은 도움이 안 되고 자리만 차지한다 */}
      {readyOk > 0 && (
        <div className="mt-4">
          <p className="t-sub font-semibold text-slate-600">
            준비된 정보 {readyOk}/{task.ready.length}
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
            {task.ready.map((r) => (
              <li key={r.label} className={`t-sub flex items-center gap-1 ${r.ok ? 'text-slate-700' : 'text-slate-500'}`}>
                {r.ok ? <Check aria-hidden="true" className="size-4 shrink-0 text-success-600" /> : <span aria-hidden="true" className="size-4 shrink-0 text-center">·</span>}
                {r.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/*
        ── 서류로 채우기 ──
        손으로 적기 전에 먼저 보이게 둔다. 아래 [저장하고 계속] 과 경쟁하지 않도록
        강조 버튼이 아니라 점선 칸으로 그린다.
      */}
      {task.docImport && onImportDoc && (
        <button
          type="button"
          onClick={onImportDoc}
          className="tap mt-4 flex w-full items-start gap-3 rounded-(--radius-card) border border-dashed border-brand-300 bg-brand-50/40 px-4 py-3.5 text-left hover:border-brand-500 hover:bg-brand-50"
        >
          <FileUp aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-600" />
          <span className="min-w-0 flex-1">
            <span className="t-body block font-semibold break-keep text-brand-800">사업자등록증 · 법인등기부등본으로 채우기</span>
            <span className="t-sub mt-0.5 block break-keep text-slate-500">올리면 회사명 · 대표자 · 설립일 · 본점 · 사업자번호를 알아서 읽습니다.</span>
          </span>
        </button>
      )}

      {/* ── 시스템 의견 먼저 (§5) ── */}
      {rec && (
        <div className="mt-4 rounded-(--radius-card) border border-brand-200 bg-brand-50/60 px-4 py-3.5">
          <p className="t-sub inline-flex items-center gap-1.5 font-medium text-slate-600">
            <Sparkles aria-hidden="true" className="size-4 text-brand-600" /> 지금 자료로 보면
          </p>
          {rec.label && <p className="t-card mt-0.5 break-keep text-brand-800">{rec.label}</p>}
          <ul className="mt-2 flex flex-col gap-1">
            {rec.reasons.map((r) => (
              <li key={r} className="t-body break-keep text-slate-700">
                · {r}
              </li>
            ))}
          </ul>
          {!chooseOpen && (
            <button type="button" onClick={() => { setChooseOpen(true); setPicked([]) }} className="tap t-sub mt-2 font-medium text-slate-600 hover:text-slate-900">
              다르게 선택할게요
            </button>
          )}
        </div>
      )}

      {/* ── 확인형 ── */}
      {task.actionType === 'CONFIRM' && task.confirmItems && task.confirmItems.length > 0 && (
        <dl className="mt-4 divide-y divide-slate-100 rounded-(--radius-card) border border-slate-200">
          {task.confirmItems.map((c) => (
            <div key={c.label} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-3">
              <dt className="t-sub w-full shrink-0 text-slate-600 sm:w-40">{c.label}</dt>
              <dd className="t-body min-w-0 flex-1 break-keep text-slate-900">
                {c.value || <span className="text-slate-500">비어 있음</span>}
                {c.needsCheck && (
                  <span className="t-meta ml-2 inline-flex items-center gap-1 rounded-full border border-warning-200 bg-warning-50 px-2 py-0.5 font-medium text-warning-700">
                    <CircleAlert aria-hidden="true" className="size-3" /> 확인 필요
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {task.actionType === 'CONFIRM' && task.confirmKind === 'redflags' && (
        <ul className="mt-4 flex flex-col gap-1 rounded-(--radius-card) border border-slate-200 px-4 py-3">
          {RED_FLAGS.map((f) => (
            <li key={f.no} className="t-sub break-keep text-slate-700">
              {f.no}. {f.text}
            </li>
          ))}
        </ul>
      )}

      {/* ── 선택형 ── */}
      {task.actionType === 'SELECT' && task.choices && !usingRec && (
        <div className="mt-4 flex flex-col gap-2">
          {task.choices.map((c) => {
            const on = !freeOpen && picked.includes(c.value)
            return (
              <button
                key={c.value}
                type="button"
                aria-pressed={on}
                onClick={() => togglePick(c.value)}
                className={`tap flex w-full items-start gap-3 rounded-(--radius-card) border px-4 py-3.5 text-left ${
                  on ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-400' : 'border-slate-200 bg-white hover:border-brand-300 hover:bg-slate-50'
                }`}
              >
                <span aria-hidden="true" className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300'}`}>
                  {on && <Check className="size-3" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="t-body block break-keep font-medium text-slate-900">{c.label}</span>
                  {c.hint && <span className="t-sub mt-0.5 block break-keep text-slate-600">{c.hint}</span>}
                </span>
              </button>
            )
          })}
          {task.allowFreeText && (
            <div className={`rounded-(--radius-card) border px-4 py-3 ${freeOpen ? 'border-brand-500 bg-brand-50' : 'border-dashed border-slate-300'}`}>
              {freeOpen ? (
                <label className="block">
                  <span className="t-sub font-medium text-slate-600">직접 입력</span>
                  <textarea
                    autoFocus
                    aria-label="직접 입력"
                    value={freeText}
                    rows={2}
                    onChange={(e) => setFreeText(e.target.value)}
                    className="t-body mt-1 w-full resize-y rounded-(--radius-control) border border-slate-300 px-3 py-2"
                  />
                </label>
              ) : (
                <button type="button" onClick={() => { setFreeOpen(true); setPicked([]) }} className="tap t-body w-full text-left font-medium text-slate-600 hover:text-brand-700">
                  여기 없습니다 — 직접 쓰기
                </button>
              )}
            </div>
          )}
          {multi && <p className="t-sub text-slate-600">{multi.min}~{multi.max}개를 고릅니다. 지금 {picked.length}개.</p>}

          {/* 고른 즉시 무엇이 저장될지 보여 준다 — 저장하고 나서 놀라지 않게 (§9) */}
          {composed !== '' && (
            <div className="rounded-(--radius-card) border border-brand-200 bg-brand-50/60 px-4 py-3">
              <p className="t-sub inline-flex items-center gap-1.5 font-semibold text-brand-800">
                <Sparkles aria-hidden="true" className="size-4" /> 이렇게 저장됩니다
              </p>
              <p className="t-body mt-1 break-keep text-slate-900">{composed}</p>
            </div>
          )}
        </div>
      )}

      {/* ── 입력형 ── */}
      {task.actionType === 'INPUT' && inputs.length > 0 && (
        <div className="mt-4 flex flex-col gap-3">
          {/* 초안이 있으면 그것을 먼저 크게 보여 준다. 칸은 접어 둔다 (§9) */}
          {hasDraft && !editOpen && (
            <div className="rounded-(--radius-card) border border-brand-200 bg-brand-50/60 px-4 py-3.5">
              <p className="t-sub inline-flex items-center gap-1.5 font-semibold text-brand-800">
                <Sparkles aria-hidden="true" className="size-4" /> 이렇게 정리해 봤습니다
              </p>
              {inputs.map((f, i) => (
                <p key={`${f.label}-${i}`} className="t-body mt-1.5 break-keep text-slate-900">
                  {values[i] || f.suggestion}
                </p>
              ))}
              {(inputs[0].suggestionBasedOn ?? []).length > 0 && (
                <p className="t-sub mt-2 text-slate-600">앞에서 정한 {inputs[0].suggestionBasedOn?.join(' · ')} 을(를) 보고 만들었습니다.</p>
              )}
              <button type="button" onClick={() => setEditOpen(true)} className="tap t-sub mt-2 font-medium text-slate-600 hover:text-slate-900">
                고쳐 쓸게요
              </button>
            </div>
          )}

          {(!hasDraft || editOpen) &&
            inputs.map((f, i) => (
              <label key={`${f.label}-${i}`} className="block">
                <span className="t-sub font-medium text-slate-700">{f.label}</span>
                {f.multiline ? (
                  <textarea
                    aria-label={f.label}
                    value={values[i] ?? ''}
                    rows={3}
                    placeholder={f.placeholder}
                    onChange={(e) => setValues((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
                    className="t-body mt-1 w-full resize-y rounded-(--radius-control) border border-slate-300 px-3 py-2.5"
                  />
                ) : (
                  <input
                    aria-label={f.label}
                    value={values[i] ?? ''}
                    placeholder={f.placeholder}
                    onChange={(e) => setValues((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
                    onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
                    className="t-body mt-1 w-full rounded-(--radius-control) border border-slate-300 px-3 py-2.5"
                  />
                )}
                {f.example && (
                  <span className="t-sub mt-1 flex items-start gap-1.5 break-keep text-slate-600">
                    <Lightbulb aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning-600" /> {f.example}
                  </span>
                )}
                {f.numeric && !f.example && <span className="t-sub mt-1 block text-slate-600">숫자에는 기준연도와 출처를 함께 적어 두면 나중에 다시 찾지 않아도 됩니다.</span>}
              </label>
            ))}
        </div>
      )}

      {/* ── 버튼 ── */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button variant={quiet ? 'secondary' : 'primary'} size="md" disabled={!canSubmit} onClick={submit} className="min-w-40 flex-1 sm:flex-none">
          {busy ? '처리 중…' : task.primaryAction}
          {!busy && <ArrowRight aria-hidden="true" className="size-4" />}
        </Button>
        {task.actionType === 'CONFIRM' && onEditItem && (
          <Button variant="ghost" onClick={onEditItem}>
            <Pencil aria-hidden="true" className="size-4" /> 수정
          </Button>
        )}
        {task.deferrable && (
          <Button variant="ghost" disabled={busy} onClick={() => onSubmit({ defer: true })}>
            잘 모르겠어요 · 나중에
          </Button>
        )}
      </div>

      {task.helpKeys && <HelpNote keys={task.helpKeys} />}

      {task.nextPreview && <p className="t-sub mt-3 text-slate-500">{task.nextPreview}</p>}
    </section>
  )
}
