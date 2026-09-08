/**
 * 지금 할 일 카드 — 화면의 주인공.
 *
 * 이 카드는 단계도 프롬프트 종류도 모른다. CurrentTask 하나를 받아
 * actionType 에 따라 7가지 중 하나로 그린다. 버튼은 원칙적으로 하나다.
 */

import { useEffect, useState } from 'react'
import { ArrowRight, Check, CircleAlert, Pencil } from 'lucide-react'
import type { CurrentTask } from '../../../domain/consulting/currentTask'
import type { TaskSubmission } from '../../../domain/consulting/applyTask'
import { RED_FLAGS } from '../../../domain/consulting/qaRules'
import { Button } from '../../ui/Button'

export function TaskCard({
  task,
  busy,
  onSubmit,
  onEditItem,
  quiet = false,
}: {
  task: CurrentTask
  busy: boolean
  /** INPUT·SELECT·CONFIRM·CONTINUE 는 여기로. GENERATE_PROMPT·IMPORT_RESULT 는 바깥에서 처리한다 */
  onSubmit: (sub: TaskSubmission) => void
  /** CONFIRM 에서 '수정' */
  onEditItem?: () => void
  /** 위에 이미 강조 블록(프롬프트 결과)이 있을 때 — 조용하게 그린다 */
  quiet?: boolean
}) {
  const [values, setValues] = useState<string[]>([])
  const [picked, setPicked] = useState<string[]>([])
  const [freeText, setFreeText] = useState('')
  const [freeOpen, setFreeOpen] = useState(false)

  // 할 일이 바뀌면 입력 상태를 비운다
  useEffect(() => {
    setValues((task.inputs ?? []).map(() => ''))
    setPicked([])
    setFreeText('')
    setFreeOpen(false)
  }, [task.id, task.inputs])

  const readyOk = task.ready.filter((r) => r.ok).length
  const multi = task.multi

  const canSubmit = (() => {
    if (busy) return false
    switch (task.actionType) {
      case 'INPUT':
        return values.some((v) => v.trim() !== '')
      case 'SELECT':
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

      {task.ready.length > 0 && (
        <div className="mt-4">
          <p className="t-sub font-semibold text-slate-500">
            준비된 정보 {readyOk}/{task.ready.length}
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
            {task.ready.map((r) => (
              <li key={r.label} className={`t-sub flex items-center gap-1 ${r.ok ? 'text-slate-700' : 'text-slate-400'}`}>
                {r.ok ? <Check aria-hidden="true" className="size-4 shrink-0 text-success-600" /> : <span aria-hidden="true" className="size-4 shrink-0 text-center">·</span>}
                {r.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── 확인형 ── */}
      {task.actionType === 'CONFIRM' && task.confirmItems && task.confirmItems.length > 0 && (
        <dl className="mt-4 divide-y divide-slate-100 rounded-(--radius-card) border border-slate-200">
          {task.confirmItems.map((c) => (
            <div key={c.label} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-3">
              <dt className="t-sub w-full shrink-0 text-slate-500 sm:w-40">{c.label}</dt>
              <dd className="t-body min-w-0 flex-1 break-keep text-slate-900">
                {c.value || <span className="text-slate-400">비어 있음</span>}
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
      {task.actionType === 'SELECT' && task.choices && (
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
                  {c.hint && <span className="t-sub mt-0.5 block break-keep text-slate-500">{c.hint}</span>}
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
                <button type="button" onClick={() => { setFreeOpen(true); setPicked([]) }} className="tap t-body w-full text-left font-medium text-slate-500 hover:text-brand-700">
                  여기 없습니다 — 직접 쓰기
                </button>
              )}
            </div>
          )}
          {multi && <p className="t-meta text-slate-500">{multi.min}~{multi.max}개를 고릅니다. 지금 {picked.length}개.</p>}
        </div>
      )}

      {/* ── 입력형 ── */}
      {task.actionType === 'INPUT' && task.inputs && (
        <div className="mt-4 flex flex-col gap-3">
          {task.inputs.map((f, i) => (
            <label key={`${f.label}-${i}`} className="block">
              <span className="t-sub font-medium text-slate-600">{f.label}</span>
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
              {f.numeric && <span className="t-meta mt-1 block text-slate-500">숫자에는 기준연도와 출처를 함께 적어 두면 나중에 다시 찾지 않아도 됩니다.</span>}
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
      </div>

      {task.nextPreview && <p className="t-meta mt-3 text-slate-400">{task.nextPreview}</p>}
    </section>
  )
}
