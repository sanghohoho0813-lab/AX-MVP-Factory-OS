/**
 * D-557 기업인증 화면 — 이 인증과 지금 열린 지원사업(받아 둔 진짜 공고 · 판정 규칙 그대로).
 *
 *  - 아직 없는 인증: "받으면 지금 열린 지원사업 n건이 더 맞아요"(D-556 grantWhatIfs 의 그 인증 칸)
 *  - 이미 있는 인증: "이 인증으로 지금 맞는 공고 n건" + 120일 안에 끝나면 "갱신하지 않으면 n건을 못 해요"
 *  - compact: 인증 화면 맨 위 한 줄(있을 때만) · 아니면 '받으면 무엇이 달라지나요?' 칸(공고 목록 · 없으면 없다고 한 줄)
 * 화면 원칙: 흰 바탕 · 얇은 회색 테두리 · 강조는 글자색(빨강 = 주의).
 */
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import type { ClientOpsRecord } from '../../types/clientOps'
import { CERT_LABEL, type CertKey } from '../../services/grants/grantMatch'
import { certGrantView } from '../../services/grants/grantWhatIf'
import { todayLocalDate } from '../../lib/appClock'
import { useGrantData } from './useGrants'

/** 기업인증 화면의 인증 열쇠 → 지원사업 공고의 인증 열쇠(ISO 는 공고 조건에 없다) */
const GRANT_CERT: Partial<Record<string, CertKey>> = { venture: 'venture', innobiz: 'innobiz', mainbiz: 'mainbiz', lab: 'lab' }

export function CertGrantGain({ certKey, record, workspaceId, validUntil, compact }: { certKey: string; record: ClientOpsRecord | null; workspaceId: string | null; validUntil?: string | null; compact?: boolean }) {
  const cert = GRANT_CERT[certKey] ?? null
  const { notices, loaded } = useGrantData(cert && record ? workspaceId : null)
  const today = todayLocalDate()
  const v = useMemo(() => (cert && record && loaded ? certGrantView(cert, record, notices, today, validUntil) : null), [cert, record, loaded, notices, today, validUntil])
  if (!cert || !record || !v) return null
  const grantsHref = `/grants?view=clients&client=${encodeURIComponent(record.id)}`
  const label = CERT_LABEL[cert]
  const what = cert === 'lab' ? '연구소(전담부서)를 세우면' : `${label} ${cert === 'venture' ? '확인' : '인증'}을 받으면`
  if (compact) {
    if (!v.matches.length && !v.risk) return null
    return (
      <p className="t-sub break-keep text-slate-800" data-testid="cert-grant-line">
        {v.risk ? <b className="font-semibold text-danger-700">{v.risk}</b> : v.held ? <>이 인증으로 지금 맞는 지원사업 <b className="font-semibold text-brand-700">{v.matches.length}건</b></> : <>{what} 지금 열린 지원사업 <b className="font-semibold text-brand-700">{v.matches.length}건</b>이 더 맞아요</>}
        <Link to={grantsHref} className="tap ml-2 inline-flex items-center gap-1 font-semibold text-brand-700 hover:underline">
          공고 보기 <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-1.5 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2" data-testid="cert-grant-gain">
      <p className="t-sub break-keep text-slate-900">
        <b className="font-semibold">지금 열린 지원사업</b> —{' '}
        {v.held ? (v.matches.length ? `이 인증이 있어서 맞는 공고 ${v.matches.length}건` : '이 인증이 있어야 하는 공고는 지금 없어요') : v.matches.length ? `${what} ${v.matches.length}건이 더 맞아요` : '받아 둔 공고 중 이 인증 하나로 새로 맞는 공고는 지금 없어요'}
      </p>
      {v.risk && <p className="t-sub break-keep font-semibold text-danger-700" data-testid="cert-grant-risk">{v.risk}</p>}
      {v.matches.length > 0 && (
        <ul className="t-sub flex flex-col gap-0.5 pl-4 break-keep text-slate-700">
          {v.matches.slice(0, 5).map((m) => (
            <li key={m.notice.id} className="list-disc">
              {m.notice.title} <span className="text-slate-500">— {m.deadline.label}{m.notice.amountText ? ` · ${m.notice.amountText}` : ''}</span>
            </li>
          ))}
          {v.matches.length > 5 ? <li className="list-none text-slate-500">외 {v.matches.length - 5}건</li> : null}
        </ul>
      )}
      <p className="t-meta break-keep text-slate-500">받아 둔 공고(기업마당 · 직접 넣은 공고)에 적힌 조건으로만 다시 판정했어요 — 선정을 약속하지 않아요.</p>
      <Link to={grantsHref} className="tap t-sub inline-flex items-center gap-1 self-start font-semibold text-brand-700 hover:underline">
        이 업체 지원사업 보기 <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
    </div>
  )
}
