/**
 * 업체에서 AX 스튜디오 열기 (D-135) — /ax/open?client=<업체>
 *
 * 그 업체의 AX 고객사로 간다. 없으면 업체 정보(회사명 · 사업자번호 · 업종 · 설립일 · 직원 · 매출 · 담당자)로 하나 만든다.
 * 사업자번호가 같은 고객사가 이미 있으면 새로 만들지 않고 그것과 잇는다.
 */
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToolClient } from '../tools/shared/toolClientContext'
import { ensureOrgForClient } from '../services/axClientLink'
import { useToast } from '../components/ui/toastContext'

export function AxOpenPage() {
  const { clientId, clientRecord } = useToolClient()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const done = useRef(false)
  useEffect(() => {
    if (done.current) return
    if (!clientId) {
      done.current = true
      navigate('/clients', { replace: true })
      return
    }
    if (!clientRecord) return
    done.current = true
    try {
      const { org, created } = ensureOrgForClient(clientRecord)
      showToast(created ? `${org.name} — 업체 정보로 AX 고객사를 만들었습니다.` : `${org.name} AX 고객사로 왔습니다.`)
      navigate(`/clients/${org.id}`, { replace: true })
    } catch (cause) {
      showToast(cause instanceof Error ? cause.message : 'AX 고객사를 열지 못했습니다.')
      navigate(`/ops/clients/${clientId}`, { replace: true })
    }
  }, [clientId, clientRecord, navigate, showToast])
  return <p className="t-sub px-1 py-6 text-slate-500">AX 스튜디오 고객사를 여는 중…</p>
}
