/**
 * D-536 백업이 실제로 보장하는 것 — 되살아나는 것 · 보관용으로만 담기는 것 · 담기지 않는 것(점검 A7).
 * '백업' 이라는 말만 보고 모두 되살아난다고 오해하지 않게 세 곳(고객 관리 › 더보기 · 설정 › 데이터 · 백업 불러오기)이 같은 글을 쓴다.
 * 더보기 · 설정에서는 접어 두고(📐 첫 화면은 짧게), 불러오기 창에서는 펴 둔다(결정하는 자리).
 */
import { BACKUP_SCOPE } from '../../services/workspaceExport'

function Lists() {
  return (
    <dl className="mt-2 flex flex-col gap-1.5 text-[0.875rem] break-keep">
      <div>
        <dt className="font-semibold text-slate-900">되살릴 수 있어요</dt>
        <dd className="text-slate-700">{BACKUP_SCOPE.restore.join(' · ')}</dd>
      </div>
      <div>
        <dt className="font-semibold text-slate-900">보관용으로만 담겨요(되살리지 않아요)</dt>
        <dd className="text-slate-700">{BACKUP_SCOPE.archive.join(' · ')}</dd>
      </div>
      <div>
        <dt className="font-semibold text-danger-700">담기지 않아요</dt>
        <dd className="text-slate-700">{BACKUP_SCOPE.excluded.join(' · ')}</dd>
      </div>
    </dl>
  )
}

export function BackupScopeNote({ open = false }: { open?: boolean }) {
  if (open) {
    return (
      <div data-testid="backup-scope" data-open="1" className="mt-3 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2">
        <p className="text-[0.9375rem] font-semibold text-slate-900">이 백업으로 되살아나는 것</p>
        <Lists />
      </div>
    )
  }
  return (
    <details data-testid="backup-scope" data-open="0" className="group rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2">
      <summary className="tap cursor-pointer text-[0.875rem] font-semibold text-slate-700">백업으로 무엇이 되살아나나요?</summary>
      <Lists />
    </details>
  )
}
