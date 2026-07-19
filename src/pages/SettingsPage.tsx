// 설정 — S1 최소 범위: 내 프로필(이름)만. 직원 관리·임계값 설정은 이후 스프린트.
import { useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'
import { updateMyName } from '../lib/repo'
import { Button, ErrorNote, Field, PageHeader, inputCls } from '../components/ui'

export default function SettingsPage() {
  const { profile, refresh, devMock } = useAuth()
  const [name, setName] = useState(profile?.name ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setErr(null); setSaved(false)
    try {
      await updateMyName(name.trim())
      await refresh()
      setSaved(true)
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : '저장에 실패했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="설정" desc="내 프로필 정보를 관리합니다." />
      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <dl className="space-y-1.5 rounded-lg bg-slate-50 px-4 py-3 text-sm">
          <div className="flex justify-between gap-3"><dt className="text-slate-400">이메일</dt><dd className="font-semibold text-slate-800">{profile?.email ?? '-'}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-slate-400">역할</dt><dd className="font-semibold text-slate-800">{profile?.role === 'owner' ? '대표 (owner)' : 'staff'}</dd></div>
        </dl>
        <Field label="표시 이름">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 김상호" className={inputCls} disabled={devMock} />
        </Field>
        <ErrorNote msg={err} />
        <div className="flex items-center gap-2.5">
          <Button type="submit" disabled={busy || devMock}>{busy ? '저장 중…' : '저장'}</Button>
          {saved && <span className="text-xs font-semibold text-teal-700">저장됨</span>}
          {devMock && <span className="text-xs text-slate-400">목 모드에서는 저장되지 않습니다</span>}
        </div>
        <p className="border-t border-slate-100 pt-4 text-xs leading-relaxed text-slate-400">
          직원(staff) 초대·권한 관리, 판정 임계값 설정은 이후 스프린트에서 제공됩니다.
        </p>
      </form>
    </div>
  )
}
