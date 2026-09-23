/**
 * 지원금 관리 — 기본 15종 켜기·끄기 + 우리가 쓰는 지원금 더하기 (D-91).
 *
 * 규칙표는 손대지 않는다. 끈 것과 더한 것만 모듈 기록에 남는다(usePrograms).
 * 여기서 켠 것만 '업체 관리' 의 지원금 고르는 칸에 보인다.
 */

import { useState } from 'react'
import { ExternalLink, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { Button } from '../../../components/ui/Button'
import { Badge, Disclosure, MetricTile, Section, Surface } from '../../../components/ui/primitives'
import { useToast } from '../../../components/ui/toastContext'
import { fMan } from '../lib/format'
import { usePrograms, type CustomProgramInput, type ProgramView } from '../lib/usePrograms'

const inputCls =
  'w-full rounded-(--radius-control) border border-slate-300 bg-white px-2.5 py-2 text-[0.95rem] text-slate-900 focus:border-brand-500 focus:outline-none'

interface RoundForm {
  month: string
  label: string
  amount: string
}

interface CustomForm {
  rowId?: string
  id?: string
  name: string
  year: string
  note: string
  applyUrl: string
  rounds: RoundForm[]
}

function emptyCustom(): CustomForm {
  return { name: '', year: '2026', note: '', applyUrl: '', rounds: [{ month: '6', label: '1회차', amount: '0' }] }
}

export function ProgramsScreen() {
  const { programs, setEnabled, saveCustom, removeCustom, resetBuiltins } = usePrograms()
  const { showToast } = useToast()
  const [form, setForm] = useState<CustomForm | null>(null)

  if (programs === null) return <p className="t-sub text-slate-400">지원금 표를 읽는 중…</p>

  const on = programs.filter((p) => p.enabled)
  const customs = programs.filter((p) => p.custom)

  const submit = async () => {
    if (!form) return
    if (!form.name.trim()) {
      showToast('지원금 이름을 적어 주세요.')
      return
    }
    const input: CustomProgramInput = {
      rowId: form.rowId,
      id: form.id,
      name: form.name.trim(),
      year: Number(form.year) || new Date().getFullYear(),
      note: form.note,
      applyUrl: form.applyUrl,
      rounds: form.rounds.map((r, i) => ({
        month: Number(r.month) || 0,
        label: r.label || `${i + 1}회차`,
        amount: Number(r.amount) || 0,
      })),
    }
    await saveCustom(input)
    showToast(form.rowId ? '지원금을 고쳤습니다.' : '지원금을 더했습니다.')
    setForm(null)
  }

  return (
    <div className="flex flex-col gap-5" data-testid="emp-programs">
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <MetricTile label="쓰는 지원금" value={`${on.length}개`} hint="직원 넣는 칸에 보인다" tone="brand" />
        <MetricTile label="전체" value={`${programs.length}개`} hint="기본 15종 + 더한 것" />
        <MetricTile label="직접 더한 것" value={`${customs.length}개`} />
        <MetricTile label="끈 것" value={`${programs.length - on.length}개`} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setForm(emptyCustom())} data-testid="emp-program-add">
          <Plus aria-hidden="true" className="size-4" /> 지원금 더하기
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            await resetBuiltins()
            showToast('기본 15종을 처음 상태로 되돌렸습니다. 직접 더한 것은 그대로입니다.')
          }}
        >
          <RotateCcw aria-hidden="true" className="size-4" /> 기본값으로
        </Button>
      </div>

      {form && (
        <Surface>
          <div className="flex flex-col gap-3">
            <span className="t-section text-slate-900">{form.rowId ? '지원금 고치기' : '지원금 더하기'}</span>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="t-sub font-medium text-slate-600">이름</span>
                <input aria-label="지원금 이름" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={`mt-1 ${inputCls}`} />
              </label>
              <label className="block">
                <span className="t-sub font-medium text-slate-600">연도</span>
                <input aria-label="연도" inputMode="numeric" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} className={`mt-1 ${inputCls}`} />
              </label>
              <label className="block sm:col-span-2">
                <span className="t-sub font-medium text-slate-600">공식 안내 주소</span>
                <input aria-label="공식 안내 주소" value={form.applyUrl} onChange={(e) => setForm({ ...form, applyUrl: e.target.value })} className={`mt-1 ${inputCls}`} placeholder="https://" />
              </label>
              <label className="block sm:col-span-2">
                <span className="t-sub font-medium text-slate-600">메모</span>
                <textarea aria-label="지원금 메모" rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className={`mt-1 ${inputCls}`} />
              </label>
            </div>

            <div className="flex flex-col gap-2">
              <span className="t-sub font-medium text-slate-600">회차 (입사일로부터 몇 개월 뒤에 얼마)</span>
              {form.rounds.map((r, i) => (
                <div key={i} className="grid grid-cols-[4.5rem_1fr_7rem_2.5rem] items-center gap-2">
                  <input
                    aria-label={`${i + 1}번째 회차 개월`}
                    inputMode="numeric"
                    value={r.month}
                    onChange={(e) => setForm({ ...form, rounds: form.rounds.map((x, j) => (i === j ? { ...x, month: e.target.value } : x)) })}
                    className={`${inputCls} text-right tabular-nums`}
                  />
                  <input
                    aria-label={`${i + 1}번째 회차 이름`}
                    value={r.label}
                    onChange={(e) => setForm({ ...form, rounds: form.rounds.map((x, j) => (i === j ? { ...x, label: e.target.value } : x)) })}
                    className={inputCls}
                  />
                  <input
                    aria-label={`${i + 1}번째 회차 금액`}
                    inputMode="numeric"
                    value={r.amount}
                    onChange={(e) => setForm({ ...form, rounds: form.rounds.map((x, j) => (i === j ? { ...x, amount: e.target.value } : x)) })}
                    className={`${inputCls} text-right tabular-nums`}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`${i + 1}번째 회차 지우기`}
                    onClick={() => setForm({ ...form, rounds: form.rounds.filter((_, j) => j !== i) })}
                  >
                    <Trash2 aria-hidden="true" className="size-4 text-slate-400" />
                  </Button>
                </div>
              ))}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setForm({ ...form, rounds: form.rounds.concat([{ month: '12', label: `${form.rounds.length + 1}회차`, amount: '0' }]) })}
              >
                <Plus aria-hidden="true" className="size-4" /> 회차 더하기
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="primary" onClick={submit} data-testid="emp-program-save">
                저장
              </Button>
              <Button variant="ghost" onClick={() => setForm(null)}>
                그만두기
              </Button>
            </div>
          </div>
        </Surface>
      )}

      <Section title="지원금" count={programs.length}>
        <ul className="flex flex-col gap-2" data-testid="emp-program-list">
          {programs.map((p) => (
            <li key={p.id}>
              <ProgramRow
                program={p}
                onToggle={() => void setEnabled(p.id, !p.enabled)}
                onEdit={
                  p.custom
                    ? () =>
                        setForm({
                          rowId: p.rowId,
                          id: p.id,
                          name: p.name,
                          year: String(p.year),
                          note: p.note,
                          applyUrl: p.applyUrl,
                          rounds: p.rounds.map((r) => ({ month: String(r.month), label: r.label, amount: String(r.amount) })),
                        })
                    : undefined
                }
                onRemove={p.custom ? () => void removeCustom(p.rowId) : undefined}
              />
            </li>
          ))}
        </ul>
      </Section>
    </div>
  )
}

function ProgramRow({
  program,
  onToggle,
  onEdit,
  onRemove,
}: {
  program: ProgramView
  onToggle: () => void
  onEdit?: () => void
  onRemove?: () => void
}) {
  return (
    <Surface as="div" edge={program.enabled ? 'brand' : 'neutral'} showEdge={program.enabled}>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <button
            type="button"
            onClick={onToggle}
            aria-pressed={program.enabled}
            data-program={program.id}
            className={`tap rounded-full border px-2.5 py-1 t-meta font-bold ${
              program.enabled ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-slate-300 bg-white text-slate-400'
            }`}
          >
            {program.enabled ? '쓴다' : '안 쓴다'}
          </button>
          <span className="t-sub font-bold text-slate-900">{program.name}</span>
          <Badge tone="neutral">{program.group}</Badge>
          <span className="t-meta text-slate-500">{program.year}년</span>
          <span className="t-meta text-slate-500">최대 {fMan(program.totalAmount)}</span>
          <span className="ml-auto flex items-center gap-2">
            {program.applyUrl && (
              <a href={program.applyUrl} target="_blank" rel="noopener noreferrer" className="t-meta inline-flex items-center gap-1 text-brand-700 hover:underline">
                공식 안내 <ExternalLink aria-hidden="true" className="size-3.5" />
              </a>
            )}
            {onEdit && (
              <Button variant="ghost" size="sm" onClick={onEdit}>
                고치기
              </Button>
            )}
            {onRemove && (
              <Button variant="ghost" size="sm" onClick={onRemove} aria-label={`${program.name} 지우기`}>
                <Trash2 aria-hidden="true" className="size-4 text-slate-400" />
              </Button>
            )}
          </span>
        </div>
        <Disclosure title="회차표" hint={`${program.rounds.length}회차`}>
          <ul className="flex flex-col gap-1 pt-2">
            {program.rounds.map((r, i) => (
              <li key={`${r.label}-${i}`} className="t-meta flex items-center justify-between gap-2 text-slate-600">
                <span>
                  {r.label} · 입사 +{r.month}개월
                </span>
                <span className="tabular-nums">{fMan(r.amount)}</span>
              </li>
            ))}
          </ul>
          {program.note && <p className="t-meta break-keep pt-2 text-slate-500">{program.note}</p>}
        </Disclosure>
      </div>
    </Surface>
  )
}
