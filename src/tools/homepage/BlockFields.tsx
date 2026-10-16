/**
 * 블록 칸 고치기 (D-202) — 칸 정의(blocks.ts)만 보고 그린다. 글 · 여러 줄 · 고르기 · 켜고 끄기 · 그림 · 목록.
 * 견본 문구 칸에는 '견본' 표시가 붙는다(고치면 빠진다).
 */
import { useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ImagePlus, Plus, Trash2, X } from 'lucide-react'
import {
  MAX_IMAGE_CHARS,
  listAdd,
  listMove,
  listRemove,
  listSet,
  safeImage,
  type FieldDef,
  type ListItem,
  type PropValue,
  type SiteBlock,
} from '../../services/siteBuilder'

export const inputClass =
  'mt-1 w-full min-h-11 rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2 text-[0.95rem] text-slate-800 focus:border-brand-500 focus:outline-none'

/** 올린 사진을 줄여 data URL 로 — 긴 변 1600 → 1200 → 900 으로 줄이며 상한 안에 맞춘다 */
export async function imageFileToDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('그림을 읽지 못했어요'))
      el.src = url
    })
    for (const [max, q] of [
      [1600, 0.85],
      [1200, 0.8],
      [900, 0.72],
    ] as const) {
      const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
      const c = document.createElement('canvas')
      c.width = Math.max(1, Math.round(img.naturalWidth * s))
      c.height = Math.max(1, Math.round(img.naturalHeight * s))
      const ctx = c.getContext('2d')
      if (!ctx) break
      ctx.drawImage(img, 0, 0, c.width, c.height)
      // 투명한 로고를 위해 webp 먼저 — 안 되는 브라우저는 png 를 주므로 jpeg 로
      let out = c.toDataURL('image/webp', q)
      if (!out.startsWith('data:image/webp') || out.length > MAX_IMAGE_CHARS) out = c.toDataURL('image/jpeg', q)
      if (out.length <= MAX_IMAGE_CHARS && safeImage(out)) return out
    }
    throw new Error('사진이 너무 커요 — 더 작은 사진을 골라 주세요')
  } finally {
    URL.revokeObjectURL(url)
  }
}

function SampleChip() {
  return (
    <span className="t-meta ml-1.5 rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800" data-testid="field-sample">
      견본 문구
    </span>
  )
}

function str(v: PropValue | undefined): string {
  return typeof v === 'string' ? v : ''
}

export interface BlockFieldsProps {
  block: SiteBlock
  fields: FieldDef[]
  /** 칸 하나 바꾸기 — group: 같은 칸을 이어 치면 되돌리기 한 번으로 */
  onChange: (key: string, value: PropValue, group?: string) => void
  /** 그림 상한을 넘으면 알림 */
  onImageError: (message: string) => void
  /** 이 홈페이지에 아직 넣을 수 있는 그림 크기(글자 수) */
  imageRoom: number
}

export function BlockFields({ block, fields, onChange, onImageError, imageRoom }: BlockFieldsProps) {
  return (
    <div className="flex flex-col gap-3" data-testid="block-fields">
      {fields
        .filter((f) => !f.showWhen || str(block.props[f.showWhen.key]) === f.showWhen.value)
        .map((f) => (
          <Field key={f.key} block={block} field={f} onChange={onChange} onImageError={onImageError} imageRoom={imageRoom} />
        ))}
    </div>
  )
}

function Field({ block, field: f, onChange, onImageError, imageRoom }: { block: SiteBlock; field: FieldDef } & Omit<BlockFieldsProps, 'block' | 'fields'>) {
  const value = block.props[f.key]
  const sample = block.sample?.includes(f.key)
  const id = `f-${block.id}-${f.key}`
  const group = `${block.id}:${f.key}`
  const label = (
    <span className="t-sub font-semibold text-slate-700">
      {f.label}
      {sample && <SampleChip />}
    </span>
  )

  if (f.kind === 'toggle') {
    return (
      <label className="flex min-h-11 cursor-pointer items-center gap-3" htmlFor={id}>
        <input id={id} type="checkbox" className="size-5 accent-brand-600" checked={value === true} onChange={(e) => onChange(f.key, e.target.checked)} data-field={f.key} />
        {label}
      </label>
    )
  }
  if (f.kind === 'select') {
    return (
      <label htmlFor={id} className="flex flex-col">
        {label}
        <select id={id} className={inputClass} value={str(value)} onChange={(e) => onChange(f.key, e.target.value)} data-field={f.key}>
          {(f.options ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    )
  }
  if (f.kind === 'image') return <ImageField id={id} label={label} value={str(value)} onChange={(v) => onChange(f.key, v)} onImageError={onImageError} imageRoom={imageRoom} hint={f.hint} fieldKey={f.key} />
  if (f.kind === 'list') {
    const items = Array.isArray(value) ? value : []
    return <ListField label={label} field={f} items={items} onChange={(next, g) => onChange(f.key, next, g ? `${group}:${g}` : undefined)} />
  }
  const common = {
    id,
    value: str(value),
    maxLength: f.max,
    placeholder: f.placeholder,
    'data-field': f.key,
    onChange: (e: { target: { value: string } }) => onChange(f.key, e.target.value, group),
  }
  return (
    <label htmlFor={id} className="flex flex-col">
      {label}
      {f.kind === 'textarea' ? <textarea {...common} rows={f.max && f.max > 300 ? 5 : 3} className={`${inputClass} resize-y leading-relaxed`} /> : <input {...common} className={inputClass} />}
      {f.hint && <span className="t-meta mt-1 text-slate-500">{f.hint}</span>}
    </label>
  )
}

function ImageField({
  id,
  label,
  value,
  onChange,
  onImageError,
  imageRoom,
  hint,
  fieldKey,
}: {
  id: string
  label: React.ReactNode
  value: string
  onChange: (v: string) => void
  onImageError: (m: string) => void
  imageRoom: number
  hint?: string
  fieldKey: string
}) {
  const file = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const shown = safeImage(value)
  const isData = value.startsWith('data:')
  return (
    <div className="flex flex-col gap-1.5" data-field={fieldKey}>
      {label}
      {shown ? (
        <div className="flex items-center gap-3">
          <img src={shown} alt="" className="h-16 w-24 rounded-md border border-slate-200 object-cover" />
          <button type="button" className="tap t-sub inline-flex items-center gap-1 text-danger-700 hover:underline" onClick={() => onChange('')} data-testid="image-remove">
            <X className="size-4" aria-hidden="true" /> 빼기
          </button>
        </div>
      ) : value ? (
        <p className="t-meta text-danger-700">주소가 올바르지 않아 홈페이지에서 빠져요.</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="tap t-sub inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-control) border border-slate-300 bg-white px-3 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          disabled={busy}
          onClick={() => file.current?.click()}
          data-testid="image-upload"
        >
          <ImagePlus className="size-4" aria-hidden="true" />
          {busy ? '줄이는 중…' : '사진 올리기'}
        </button>
        <input
          ref={file}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          data-testid="image-file"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (!f) return
            setBusy(true)
            try {
              const data = await imageFileToDataUrl(f)
              const prev = isData ? value.length : 0
              if (data.length - prev > imageRoom) onImageError('이 홈페이지에 올린 사진이 너무 많아요 — 다른 사진을 빼거나 사진 주소를 붙여 넣어 주세요.')
              else onChange(data)
            } catch (err) {
              onImageError(err instanceof Error ? err.message : '사진을 넣지 못했어요')
            } finally {
              setBusy(false)
            }
          }}
        />
        <input
          id={id}
          className={`${inputClass} mt-0 min-w-0 flex-1`}
          placeholder="또는 사진 주소(https://…)"
          value={isData ? '' : value}
          onChange={(e) => onChange(e.target.value.trim())}
          aria-label="사진 주소"
        />
      </div>
      {hint && <span className="t-meta text-slate-500">{hint}</span>}
    </div>
  )
}

function ListField({ label, field, items, onChange }: { label: React.ReactNode; field: FieldDef; items: ListItem[]; onChange: (next: ListItem[], group?: string) => void }) {
  const max = field.maxItems ?? 12
  const blank: ListItem = Object.fromEntries((field.itemFields ?? []).map((s) => [s.key, '']))
  return (
    <div className="flex flex-col gap-2" data-field={field.key}>
      <div className="flex items-center justify-between gap-2">
        {label}
        <span className="t-meta text-slate-500">
          {items.length}/{max}
        </span>
      </div>
      {items.map((it, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-(--radius-control) border border-slate-200 bg-slate-50 p-3" data-testid="list-item">
          {(field.itemFields ?? []).map((sub) => {
            const props = {
              value: it[sub.key] ?? '',
              maxLength: sub.max,
              'aria-label': `${i + 1}번째 ${sub.label}`,
              onChange: (e: { target: { value: string } }) => onChange(listSet(items, i, sub.key, e.target.value), `${i}:${sub.key}`),
            }
            return (
              <label key={sub.key} className="flex flex-col">
                <span className="t-meta font-semibold text-slate-600">{sub.label}</span>
                {sub.kind === 'textarea' ? <textarea {...props} rows={2} className={`${inputClass} resize-y`} /> : <input {...props} className={inputClass} />}
              </label>
            )
          })}
          <div className="flex flex-wrap gap-1">
            <IconBtn label="위로" disabled={i === 0} onClick={() => onChange(listMove(items, i, -1))}>
              <ArrowUp className="size-4" />
            </IconBtn>
            <IconBtn label="아래로" disabled={i === items.length - 1} onClick={() => onChange(listMove(items, i, 1))}>
              <ArrowDown className="size-4" />
            </IconBtn>
            <IconBtn label="이 줄 지우기" danger onClick={() => onChange(listRemove(items, i))}>
              <Trash2 className="size-4" />
            </IconBtn>
          </div>
        </div>
      ))}
      <button
        type="button"
        disabled={items.length >= max}
        onClick={() => onChange(listAdd(items, blank, max))}
        className="tap t-sub inline-flex min-h-11 items-center justify-center gap-1.5 rounded-(--radius-control) border border-dashed border-slate-300 px-3 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        data-testid="list-add"
      >
        <Plus className="size-4" aria-hidden="true" /> 줄 더하기
      </button>
    </div>
  )
}

export function IconBtn({ label, onClick, disabled, danger, children, testId }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode; testId?: string }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      data-testid={testId}
      className={`tap inline-flex size-11 items-center justify-center rounded-(--radius-control) border bg-white disabled:opacity-40 ${danger ? 'border-danger-200 text-danger-700 hover:bg-danger-50' : 'border-slate-300 text-slate-600 hover:bg-slate-50'}`}
    >
      {children}
    </button>
  )
}
