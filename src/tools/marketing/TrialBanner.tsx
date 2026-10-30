/**
 * D-220: 가상 업체 · 컨설턴트로 만드는 화면 맨 위 띠 — 고객 관리에 없다는 것 · 정보 고치기 · 지우기 · 임시등록.
 *
 * 임시등록: 고객 관리에 잠재고객(컨설턴트면 컨설턴트 고객)으로 올리고 '임시등록' 표시를 붙인 뒤,
 * 만든 홈페이지 · 보관함 글을 그 업체로 옮기고 그 업체 화면으로 넘어간다.
 */
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FlaskConical, Pencil, Trash2, UserPlus } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { useToast } from '../../components/ui/toastContext'
import { sameNameClient, TRIAL_KIND_LABEL, type TrialProfile } from '../../services/marketingTrial'
import { CLIENT_TYPE_LABEL, rememberClientTypeView } from '../../services/clientType'
import { useToolClient } from '../shared/toolClientContext'
import { TrialForm } from './TrialForm'
import { registerTrial, type TrialStore } from './trialStore'
import { quoted } from '../../lib/josa'

export function TrialBanner({
  trial,
  store,
  buildPath,
  listPath,
  flush,
  keepNote,
}: {
  trial: TrialProfile
  store: TrialStore
  buildPath: string
  listPath: string
  /** 기다리는 저장을 지금 마저(홈페이지) — 임시등록 전에 부른다 */
  flush?: () => Promise<boolean>
  /** 임시등록 확인 창에 덧붙일 말(홍보 글: 보관함에 저장한 글만 옮겨 간다) */
  keepNote: string
}) {
  const { loadClients, replaceClient, workspaceId } = useToolClient()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [editing, setEditing] = useState(false)
  const [asking, setAsking] = useState<null | 'register' | 'delete'>(null)
  const [dupName, setDupName] = useState('')
  const [busy, setBusy] = useState(false)
  const label = TRIAL_KIND_LABEL[trial.kind]
  const target = trial.kind === 'consultant' ? CLIENT_TYPE_LABEL.consultant : '잠재고객'
  const half = !!trial.registeredClientId && !trial.registeredAt

  const askRegister = async () => {
    if (busy) return
    // 같은 이름이 이미 있으면 확인 창에 알린다(새로 만들지 그만둘지 대표가 고른다)
    const same = half ? null : sameNameClient(await loadClients(), trial.name)
    setDupName(same ? same.companyName : '')
    setAsking('register')
  }

  const doRegister = async () => {
    if (busy) return
    setBusy(true)
    try {
      if (flush && !(await flush())) {
        showToast('만든 홈페이지를 아직 저장하지 못했어요. 잠시 뒤 다시 눌러 주세요.')
        return
      }
      const r = await registerTrial(workspaceId, trial, store.save)
      replaceClient(r.record)
      if (trial.kind === 'consultant') rememberClientTypeView('consultant')
      setAsking(null)
      if (r.failed) {
        showToast(`고객 관리에 임시등록했어요. 옮기지 못한 것 ${r.failed}개 — 이 화면에서 [마저 옮기기] 를 다시 눌러 주세요.`)
        return
      }
      showToast(`${r.record.companyName} — 고객 관리에 ${target}(임시등록)으로 올렸어요${r.moved ? ` · 만든 것 ${r.moved}개를 옮겼어요` : ''}.`)
      navigate(`${buildPath}?client=${encodeURIComponent(r.record.id)}`, { replace: true })
    } catch (e) {
      showToast(e instanceof Error && e.message ? `임시등록하지 못했어요 — ${e.message}` : '임시등록하지 못했어요. 잠시 뒤 다시 눌러 주세요.')
    } finally {
      setBusy(false)
    }
  }

  const doDelete = async () => {
    if (busy) return
    setBusy(true)
    const ok = await store.remove(trial.id)
    setBusy(false)
    setAsking(null)
    if (!ok) return showToast('지우지 못했어요. 잠시 뒤 다시 눌러 주세요.')
    showToast(`${trial.name} — ${label}와 만든 것을 지웠어요.`)
    navigate(listPath, { replace: true })
  }

  return (
    <div className="no-print flex flex-col gap-2 rounded-(--radius-panel) border border-slate-200 bg-white px-3 py-2.5" data-testid="trial-banner" data-kind={trial.kind}>
      <p className="t-sub flex items-start gap-2 break-keep text-slate-700">
        <FlaskConical aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-600" />
        <span className="min-w-0">
          <b className="font-bold text-slate-900">{trial.name}</b> — {label}로 만드는 중이에요. 고객 관리에는 없어요.
          {half ? ' 임시등록은 됐는데 옮기지 못한 것이 있어요.' : ' 마음에 들면 임시등록하면 만든 것이 그대로 옮겨 가요.'}
          {trial.requestedBy && <span className="text-slate-500"> · 부탁한 사람 {trial.requestedBy}</span>}
        </span>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="primary" disabled={busy} onClick={() => void askRegister()} data-testid="trial-register">
          <UserPlus className="size-4" aria-hidden="true" /> {half ? '마저 옮기기' : '임시등록'}
        </Button>
        <Button size="sm" disabled={busy} onClick={() => setEditing(true)} data-testid="trial-edit">
          <Pencil className="size-4" aria-hidden="true" /> 정보 고치기
        </Button>
        {!half && (
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => setAsking('delete')} data-testid="trial-delete">
            <Trash2 className="size-4" aria-hidden="true" /> 지우기
          </Button>
        )}
        <Link to={listPath} className="tap t-sub ml-auto inline-flex min-h-11 items-center font-medium text-brand-700 hover:underline">
          다른 곳 고르기
        </Link>
      </div>

      {editing && (
        <TrialForm
          initial={trial}
          busy={busy}
          onClose={() => setEditing(false)}
          onSave={async (p) => {
            setBusy(true)
            const saved = await store.save(p)
            setBusy(false)
            if (!saved) return showToast('저장하지 못했어요. 잠시 뒤 다시 눌러 주세요.')
            setEditing(false)
            showToast('정보를 고쳤어요. 새로 만드는 글 · 블록부터 고친 정보로 채워요.')
          }}
        />
      )}
      <ConfirmModal
        open={asking === 'register'}
        title={half ? '옮기지 못한 것을 마저 옮길까요?' : `고객 관리에 ${target}으로 임시등록할까요?`}
        message={
          half
            ? '이미 임시등록한 업체로 남은 홈페이지 · 홍보 글을 옮깁니다.'
            : `${quoted(trial.name, '을/를')} 고객 관리에 ${target}(임시등록 표시)으로 올리고, ${keepNote} 임시등록 표시는 업체 상세 [더보기] 에서 지울 수 있어요.`
        }
        warning={dupName ? `고객 관리에 이름이 같은 ${quoted(dupName, '이/가')} 이미 있어요. 같은 곳이면 그만두고 그 업체에서 만드세요.` : undefined}
        confirmLabel={half ? '마저 옮기기' : dupName ? '그래도 새로 임시등록' : '임시등록'}
        busy={busy}
        onConfirm={() => void doRegister()}
        onCancel={() => setAsking(null)}
      />
      <ConfirmModal
        open={asking === 'delete'}
        title={`${label}를 지울까요?`}
        message={`'${trial.name}' 정보와 이것으로 만든 홈페이지 · 홍보 글을 모두 지웁니다. 되돌릴 수 없어요.`}
        confirmLabel="지우기"
        danger
        busy={busy}
        onConfirm={() => void doDelete()}
        onCancel={() => setAsking(null)}
      />
    </div>
  )
}
