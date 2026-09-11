import { Fragment, useState } from 'react'
import { Check, ChevronDown, ChevronUp, ClipboardCopy, Copy, FileUp, Pencil, Pin, PinOff, Plus, Trash2 } from 'lucide-react'
import type { ClientOpsRecord } from '../../types/clientOps'
import {
  profileAsText,
  profileFields,
  profileFieldsByGroup,
  type ProfileEditKey,
  type ProfileField,
  type ProfileGroup,
} from '../../services/clientOpsProfile'
import { sortedNotes } from '../../services/clientOpsService'
import { digitsOf, numberSegments } from '../../lib/format'
import { Button } from '../ui/Button'

/** 번호 칸만 조각으로 나눈다 — 주소·회사명 같은 글자는 나누지 않는다 */
function segmentsOf(f: ProfileField): string[] {
  return f.numberKind ? numberSegments(f.value) : []
}

async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    /* 클립보드 차단 환경은 조용히 무시 */
  }
}

/**
 * 자주 찾는 회사 정보 한눈에 — 카톡 뒤져볼 일을 없앤다.
 *
 * 어느 칸이든 눌러서 바로 고칠 수 있다. 서류를 첨부해야만 값이 채워지는 구조가
 * 아니다 — 등록증이 없는 업체도 있고, 통화 중에 들은 값을 그 자리에서 적어야
 * 할 때가 더 많다. '서류에서 불러오기' 는 빠른 길일 뿐 유일한 길이 아니다.
 */
export function CompanyProfileCard({
  record,
  today,
  onImport,
  onEdit,
  onCustomField,
  onRemoveCustomField,
  /** 접이식 구역 안에 들어갈 때 — 카드 안 카드가 되지 않도록 테두리·제목을 뺀다 */
  bare = false,
}: {
  record: ClientOpsRecord
  today: string
  onImport: () => void
  /** 칸을 고쳤을 때. 없으면 읽기 전용으로 그린다 */
  onEdit?: (key: ProfileEditKey, value: string) => void
  /** 직접 만든 칸을 넣거나 고쳤을 때 */
  onCustomField?: (field: { id?: string; group: ProfileGroup; label: string; value: string }) => void
  /** 직접 만든 칸을 지웠을 때 */
  onRemoveCustomField?: (id: string) => void
  bare?: boolean
}) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  /** 이름까지 함께 고치는 칸(직접 만든 칸)의 이름 초안 */
  const [labelDraft, setLabelDraft] = useState('')
  /** 지금 새 칸을 만들고 있는 묶음 */
  const [addingGroup, setAddingGroup] = useState<ProfileGroup | null>(null)
  const [newLabel, setNewLabel] = useState('')
  const [newValue, setNewValue] = useState('')
  /** 지우기를 한 번 더 확인받는 칸 */
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)
  const fields = profileFields(record, today)
  const allGroups = profileFieldsByGroup(record, today)
  const filled = fields.filter((f) => !f.empty).length
  const emptyCount = fields.length - filled

  /*
   * 아직 안 적은 칸을 늘어놓지 않는다.
   *
   * 17칸 중 6칸만 채워진 업체를 열면 '+ 입력' 이 열한 줄 나오고, 정작 적혀 있는 값이
   * 그 사이에 묻힌다. 기본은 **적힌 것만** 보여 주고, 빈 칸은 아래 한 줄로 접는다.
   * 아무것도 안 적혀 있으면 접을 것이 없으므로 그때는 전부 편다.
   */
  const [showEmpty, setShowEmpty] = useState(filled === 0)
  /*
   * 묶음 머리는 칸을 만들 수 있을 때 남겨 둔다.
   * 빈 칸을 접으면 '연락처' 처럼 아직 아무것도 안 적은 묶음이 통째로 사라지는데,
   * 그러면 그 묶음에 칸을 만들 길이 없어진다 — 머리 한 줄을 남기는 편이 낫다.
   */
  const groups = showEmpty
    ? allGroups
    : allGroups
        .map((g) => ({ ...g, fields: g.fields.filter((f) => !f.empty) }))
        .filter((g) => g.fields.length > 0 || Boolean(onCustomField))

  const copy = async (key: string, value: string) => {
    await copyText(value)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 1500)
  }

  /** 고칠 때는 합쳐 보여 주던 값이 아니라 원래 값을 넣는다 */
  const startEdit = (f: ProfileField) => {
    if (!canEdit(f)) return
    setEditingKey(f.key)
    setConfirmRemove(null)
    if (f.custom) {
      const c = record.customFields.find((x) => x.id === f.custom)
      setLabelDraft(c?.label ?? f.label)
      setDraft(c?.value ?? '')
      return
    }
    setDraft(f.edit ? (record[f.edit] ?? '') : '')
  }

  const saveEdit = (f: ProfileField) => {
    if (f.custom) {
      // 직접 만든 칸은 이름도 함께 고친다 — 이름을 다 지우면 고치지 않고 닫는다
      if (onCustomField && labelDraft.trim() !== '') {
        onCustomField({ id: f.custom, group: f.group, label: labelDraft, value: draft })
      }
      setEditingKey(null)
      return
    }
    if (onEdit && f.edit && draft !== (record[f.edit] ?? '')) onEdit(f.edit, draft.trim())
    setEditingKey(null)
  }

  /** 표준 칸은 값만 비운다. 칸 자체는 남는다 — 나중에 다시 적을 수 있어야 한다 */
  const clearValue = (f: ProfileField) => {
    if (onEdit && f.edit) onEdit(f.edit, '')
    setEditingKey(null)
  }

  const canEdit = (f: ProfileField) => (f.custom ? Boolean(onCustomField) : Boolean(onEdit && f.edit))

  const addField = (group: ProfileGroup) => {
    if (onCustomField && newLabel.trim() !== '') onCustomField({ group, label: newLabel, value: newValue })
    setAddingGroup(null)
    setNewLabel('')
    setNewValue('')
  }

  return (
    <section
      aria-labelledby="profile"
      className={bare ? '' : 'rounded-(--radius-panel) border border-slate-200 bg-white p-5'}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 id="profile" className="t-section min-w-0 text-slate-900">
          회사 기본 정보
          <span className="t-meta ml-2 font-medium text-slate-500">
            {filled}/{fields.length} 입력됨
          </span>
        </h2>
        {/* 글자를 크게 쓰는 설정에서는 단추 두 개가 한 줄을 넘는다 — 줄여도 되고 접혀도 되게 둔다 */}
        <div className="flex min-w-0 flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={onImport}>
            <FileUp aria-hidden="true" className="size-3.5" />
            서류에서 불러오기
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void copy('__all', profileAsText(record, today))}>
            <ClipboardCopy aria-hidden="true" className="size-3.5" />
            {copiedKey === '__all' ? '복사됨' : '전체 복사'}
          </Button>
          {/* 신청서에 그대로 붙일 때는 번호에 하이픈이 없어야 하는 곳이 많다 */}
          <Button
            variant="secondary"
            size="sm"
            title="번호에서 하이픈을 뺀 채로 전체 복사"
            onClick={() => void copy('__all_digits', profileAsText(record, today, { plainNumbers: true }))}
          >
            <ClipboardCopy aria-hidden="true" className="size-3.5" />
            {copiedKey === '__all_digits' ? '복사됨' : '숫자만'}
          </Button>
        </div>
      </div>
      <p className="t-sub mt-0.5 break-keep text-slate-500">
        번호는 <strong className="font-semibold">조각마다 따로</strong> 복사됩니다 — 칸이 나뉜 신청서에 하나씩 붙이세요.
      </p>

      {groups.map((g) => (
        <div key={g.group} className="mt-4 first:mt-3">
          <p className="t-meta font-semibold tracking-wide text-slate-500 uppercase">{g.label}</p>
          <dl className="mt-1 grid gap-x-6 gap-y-0 sm:grid-cols-2 xl:grid-cols-3">
            {g.fields.map((f) => (
              <div
                key={f.key}
                className={`flex flex-wrap items-baseline justify-between gap-x-2 border-b border-slate-200/70 py-2 ${
                  f.wide ? 'sm:col-span-2 xl:col-span-3' : ''
                }`}
              >
                <dt className="t-sub shrink-0 text-slate-500">{f.label}</dt>
                {/*
                  조각으로 나뉜 번호는 한 줄에 다 들어가야 한다 — 조각이 세로로 쌓이면
                  번호가 아니라 숫자 기둥이 된다(D-23). 남는 폭이 모자라면 값 전체가
                  라벨 아래 줄로 내려가 제 폭을 갖는다.
                */}
                <dd className={`flex-1 text-right ${segmentsOf(f).length > 0 ? 'min-w-[9.5rem]' : 'min-w-0'}`}>
                  {editingKey === f.key ? (
                    <div className="flex flex-col gap-1.5">
                      {/* 직접 만든 칸은 이름도 고칠 수 있다 — 잘못 적은 이름 때문에 지웠다 다시 만들지 않게 */}
                      {f.custom && (
                        <input
                          aria-label="칸 이름"
                          value={labelDraft}
                          placeholder="칸 이름"
                          onChange={(e) => setLabelDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEdit(f)
                            if (e.key === 'Escape') setEditingKey(null)
                          }}
                          className="w-full rounded-(--radius-control) border border-slate-300 px-2 py-1 text-right text-[0.9rem] text-slate-700 focus:border-brand-400 focus:outline-none"
                        />
                      )}
                      <input
                        autoFocus
                        aria-label={`${f.label} 값`}
                        value={draft}
                        placeholder={f.placeholder}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit(f)
                          if (e.key === 'Escape') setEditingKey(null)
                        }}
                        className="w-full rounded-(--radius-control) border border-brand-400 px-2 py-1 text-right text-[0.98rem] font-semibold text-slate-900 focus:outline-none"
                      />
                      <div className="flex flex-wrap justify-end gap-x-3 gap-y-1">
                        {/*
                          지우기는 두 가지다.
                          표준 칸(담당자·업태…)은 **값만** 비운다 — 칸은 남아서 나중에 다시 적을 수 있다.
                          직접 만든 칸은 **칸째** 없앤다. 없애면 되돌릴 수 없으니 한 번 더 묻는다.
                        */}
                        {f.custom
                          ? onRemoveCustomField && (
                              confirmRemove === f.key ? (
                                <span className="t-sub flex items-center gap-2">
                                  <span className="text-slate-600">칸을 없앨까요?</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onRemoveCustomField(f.custom ?? '')
                                      setConfirmRemove(null)
                                      setEditingKey(null)
                                    }}
                                    className="font-semibold text-danger-700 hover:underline"
                                  >
                                    네, 없앱니다
                                  </button>
                                  <button type="button" onClick={() => setConfirmRemove(null)} className="text-slate-500 hover:underline">
                                    아니요
                                  </button>
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmRemove(f.key)}
                                  className="t-sub font-medium text-danger-700 hover:underline"
                                >
                                  칸 없애기
                                </button>
                              )
                            )
                          : !f.empty && (
                              <button
                                type="button"
                                onClick={() => clearValue(f)}
                                title="적어 둔 값만 지웁니다. 칸은 남습니다."
                                className="t-sub font-medium text-danger-700 hover:underline"
                              >
                                값 지우기
                              </button>
                            )}
                        <button type="button" onClick={() => setEditingKey(null)} className="t-sub text-slate-500 hover:underline">
                          취소
                        </button>
                        <button type="button" onClick={() => saveEdit(f)} className="t-sub font-semibold text-brand-700 hover:underline">
                          저장
                        </button>
                      </div>
                    </div>
                  ) : f.empty ? (
                    // 비어 있어도 누르면 바로 적을 수 있다 — 서류가 없어도 채울 수 있어야 한다
                    <button
                      type="button"
                      disabled={!canEdit(f)}
                      onClick={() => startEdit(f)}
                      className="text-[0.95rem] text-slate-500 hover:text-brand-700 hover:underline disabled:hover:text-slate-500 disabled:hover:no-underline"
                    >
                      {canEdit(f) ? '+ 입력' : '미입력'}
                    </button>
                  ) : (
                    <span className="inline-flex max-w-full items-center gap-1.5">
                      {f.copyable ? (
                        <span className="inline-flex min-w-0 flex-wrap items-center justify-end gap-1">
                          {/*
                            번호는 조각마다 따로 복사된다.
                            신청서 입력칸이 [ ]-[ ]-[ ] 로 나뉘어 있으면 전체를 붙이고 손으로
                            지우는 것이 아니라, 조각을 하나씩 복사해 칸을 옮겨 가며 붙여야 한다.
                            주민등록번호를 앞자리·뒷자리 따로 넣는 것과 같은 일이다.
                          */}
                          {segmentsOf(f).length > 0 ? (
                            <span className="inline-flex shrink-0 flex-nowrap items-baseline whitespace-nowrap">
                              {segmentsOf(f).map((seg, i) => (
                                <Fragment key={`${f.key}-seg-${i}`}>
                                  {/* 하이픈도 조각과 같은 글자 크기·줄높이로 — 다르면 글자가 서로 다른 줄에 앉는다 */}
                                  {i > 0 && (
                                    <span aria-hidden="true" className="inline-block py-1 text-[0.98rem] font-semibold tabular-nums text-slate-400">
                                      -
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => void copy(`${f.key}__s${i}`, seg)}
                                    aria-label={`${f.label} ${seg} 만 복사`}
                                    title={`${seg} 만 복사 — 칸이 나뉜 신청서용`}
                                    className={`rounded px-1 py-1 text-[0.98rem] font-semibold tabular-nums ${
                                      copiedKey === `${f.key}__s${i}`
                                        ? 'bg-success-50 text-success-700'
                                        : 'text-slate-800 hover:bg-brand-50 hover:text-brand-700'
                                    }`}
                                  >
                                    {seg}
                                  </button>
                                </Fragment>
                              ))}
                              {/* 조각 옆의 아이콘 하나가 '보이는 그대로 전체' 다 */}
                              <button
                                type="button"
                                onClick={() => void copy(f.key, f.value)}
                                aria-label={`${f.label} 전체 복사`}
                                title={`전체 복사 — ${f.value}`}
                                className="ml-0.5 shrink-0 rounded p-1 hover:bg-slate-100"
                              >
                                {copiedKey === f.key ? (
                                  <Check aria-hidden="true" className="size-3.5 text-success-600" />
                                ) : (
                                  <Copy aria-hidden="true" className="size-3.5 text-slate-400" />
                                )}
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => void copy(f.key, f.value)}
                              title="눌러서 복사 — 보이는 그대로"
                              className="group inline-flex min-w-0 items-center gap-1 text-right"
                            >
                              <span className={`truncate text-[0.98rem] font-semibold text-slate-800 group-hover:text-brand-700 group-hover:underline ${f.numberKind ? 'tabular-nums' : ''}`}>
                                {f.value}
                              </span>
                              {copiedKey === f.key ? (
                                <Check aria-hidden="true" className="size-3.5 shrink-0 text-success-600" />
                              ) : (
                                <Copy aria-hidden="true" className="size-3.5 shrink-0 text-slate-400 group-hover:text-brand-600" />
                              )}
                            </button>
                          )}
                          {/*
                            번호는 쓰는 곳마다 모양이 다르다 — 서류에는 하이픈을 넣고,
                            홈택스·공공 신청서 입력칸은 숫자만 받는 곳이 많다.
                          */}
                          {f.numberKind && digitsOf(f.value) !== f.value && (
                            <button
                              type="button"
                              onClick={() => void copy(`${f.key}__digits`, digitsOf(f.value))}
                              title={`숫자만 복사 — ${digitsOf(f.value)}`}
                              aria-label={`${f.label} 숫자만 복사`}
                              className="t-meta shrink-0 rounded-(--radius-control) border border-slate-200 px-1.5 py-0.5 font-medium text-slate-500 hover:border-brand-300 hover:text-brand-700"
                            >
                              {copiedKey === `${f.key}__digits` ? '복사됨' : '숫자만'}
                            </button>
                          )}
                        </span>
                      ) : (
                        <span className="min-w-0 text-[0.98rem] font-semibold break-keep text-slate-800">{f.value}</span>
                      )}
                      {canEdit(f) && (
                        <button
                          type="button"
                          aria-label={`${f.label} 고치기`}
                          title="고치기"
                          onClick={() => startEdit(f)}
                          className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-brand-600"
                        >
                          <Pencil aria-hidden="true" className="size-3.5" />
                        </button>
                      )}
                    </span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
          {g.group === 'credential' && (
            <p className="t-sub mt-1.5 break-keep text-slate-500">
              <strong className="font-semibold">비밀번호는 여기에 적지 않습니다.</strong> 받았는지와 어디에 두었는지만 적습니다.
            </p>
          )}

          {/*
            묶음마다 칸을 직접 만든다.
            업종마다 챙길 값이 다르다 — 어떤 업체는 공장 등록번호가, 어떤 업체는 세무사
            연락처가 매번 필요하다. 개발을 기다리는 대신 그 자리에서 칸을 만든다.
          */}
          {onCustomField && (
            addingGroup === g.group ? (
              <div className="mt-2 rounded-(--radius-card) border border-brand-200 bg-brand-50/50 p-3">
                <p className="t-sub font-semibold text-slate-700">{g.label}에 칸 만들기</p>
                <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                  <input
                    autoFocus
                    aria-label="새 칸 이름"
                    value={newLabel}
                    placeholder="칸 이름 — 예: 공장 등록번호"
                    onChange={(e) => setNewLabel(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Escape') setAddingGroup(null) }}
                    className="t-body h-11 w-full rounded-(--radius-control) border border-slate-300 bg-white px-3 sm:w-2/5"
                  />
                  <input
                    aria-label="새 칸 내용"
                    value={newValue}
                    placeholder="내용"
                    onChange={(e) => setNewValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') addField(g.group)
                      if (e.key === 'Escape') setAddingGroup(null)
                    }}
                    className="t-body h-11 w-full min-w-0 flex-1 rounded-(--radius-control) border border-slate-300 bg-white px-3"
                  />
                </div>
                <div className="mt-2 flex justify-end gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setAddingGroup(null)}>
                    취소
                  </Button>
                  <Button variant="primary" size="sm" disabled={newLabel.trim() === ''} onClick={() => addField(g.group)}>
                    넣기
                  </Button>
                </div>
                <p className="t-sub mt-2 break-keep text-slate-500">비밀번호·주민등록번호는 여기에도 적지 않습니다.</p>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setAddingGroup(g.group)
                  setNewLabel('')
                  setNewValue('')
                }}
                className="tap t-sub mt-2 inline-flex items-center gap-1 font-medium text-slate-500 hover:text-brand-700"
              >
                <Plus aria-hidden="true" className="size-3.5" />
                {g.label}에 칸 추가
              </button>
            )
          )}
        </div>
      ))}

      {emptyCount > 0 && filled > 0 && (
        <button
          type="button"
          onClick={() => setShowEmpty((v) => !v)}
          className="tap t-sub mt-4 inline-flex items-center gap-1.5 font-medium text-slate-600 hover:text-brand-700"
        >
          {showEmpty ? <ChevronUp aria-hidden="true" className="size-4" /> : <ChevronDown aria-hidden="true" className="size-4" />}
          {showEmpty ? '아직 안 적은 칸 접기' : `아직 안 적은 ${emptyCount}칸 채우기`}
        </button>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ */
/* 메모                                                                 */
/* ------------------------------------------------------------------ */

export function NotesSection({
  record,
  onAdd,
  onEdit,
  onPin,
  onDelete,
}: {
  record: ClientOpsRecord
  onAdd: (text: string) => void
  onEdit: (id: string, text: string) => void
  onPin: (id: string, pinned: boolean) => void
  onDelete: (id: string) => void
}) {
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const notes = sortedNotes(record)

  const add = () => {
    const t = draft.trim()
    if (t === '') return
    onAdd(t)
    setDraft('')
  }

  return (
    <section aria-labelledby="notes" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="notes" className="text-[1.3rem] font-bold text-slate-900">
          메모
        </h2>
        <p className="text-[0.9rem] text-slate-500">통화 내용·요청사항을 적어두세요. 수정·삭제할 수 있습니다.</p>
      </div>

      <div className="rounded-(--radius-panel) border border-slate-200 bg-slate-50 p-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) add()
          }}
          rows={2}
          placeholder="예: 9/3 대표님 통화 — 중소기업확인서 이번 주 안에 발급해서 보내주기로 함"
          className="t-body w-full rounded-(--radius-control) border border-slate-300 bg-white px-3 py-2.5 focus:border-brand-500 focus:outline-none"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[0.82rem] text-slate-500">Ctrl(⌘) + Enter 로도 추가됩니다</span>
          <Button variant="primary" size="sm" disabled={draft.trim() === ''} onClick={add}>
            <Plus aria-hidden="true" className="size-3.5" />
            메모 추가
          </Button>
        </div>
      </div>

      {notes.length === 0 ? (
        <p className="rounded-(--radius-panel) border border-slate-200 bg-white px-5 py-6 text-[0.95rem] text-slate-500">
          아직 메모가 없습니다.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {notes.map((n) => (
            <li
              key={n.id}
              className={`rounded-(--radius-panel) border p-3.5 ${
                n.pinned ? 'border-brand-200 bg-brand-50/60' : 'border-slate-200 bg-white'
              }`}
            >
              {editingId === n.id ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={3}
                    className="w-full rounded-(--radius-control) border border-slate-300 px-3 py-2 text-[0.98rem] focus:border-brand-500 focus:outline-none"
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setEditingId(null)}>
                      취소
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        onEdit(n.id, editText.trim())
                        setEditingId(null)
                      }}
                    >
                      저장
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <p className="min-w-0 flex-1 text-[1rem] leading-relaxed break-keep whitespace-pre-wrap text-slate-800">
                    {n.text}
                  </p>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      aria-label={n.pinned ? '고정 해제' : '위로 고정'}
                      title={n.pinned ? '고정 해제' : '위로 고정'}
                      onClick={() => onPin(n.id, !n.pinned)}
                      className={`rounded-(--radius-control) p-1.5 hover:bg-slate-100 ${
                        n.pinned ? 'text-brand-700' : 'text-slate-400'
                      }`}
                    >
                      {n.pinned ? (
                        <PinOff aria-hidden="true" className="size-4" />
                      ) : (
                        <Pin aria-hidden="true" className="size-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      aria-label="메모 수정"
                      title="수정"
                      onClick={() => {
                        setEditingId(n.id)
                        setEditText(n.text)
                      }}
                      className="rounded-(--radius-control) p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600"
                    >
                      <Pencil aria-hidden="true" className="size-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="메모 삭제"
                      title="삭제"
                      onClick={() => onDelete(n.id)}
                      className="rounded-(--radius-control) p-1.5 text-slate-400 hover:bg-slate-100 hover:text-danger-600"
                    >
                      <Trash2 aria-hidden="true" className="size-4" />
                    </button>
                  </div>
                </div>
              )}
              <p className="mt-1.5 text-[0.8rem] text-slate-400">
                {n.updatedAt.slice(0, 10)}
                {n.createdAt !== n.updatedAt ? ' 수정됨' : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
