/**
 * /reports — 별도 리포트 화면은 결과자료로 통합되었다 (Stage 12C).
 * 기존 URL 접근성을 위해 라우트는 유지하고, 대표 화면으로 안내한다.
 */

import { useNavigate } from 'react-router-dom'
import { ArrowRight, FileCheck2 } from 'lucide-react'
import { Button } from '../components/ui/Button'

export function ReportsRedirectPage() {
  const navigate = useNavigate()
  return (
    <section className="rounded-(--radius-panel) border border-slate-200 bg-white p-6 shadow-(--shadow-card)">
      <div className="flex items-start gap-3.5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-400">
          <FileCheck2 aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0">
          <h1 className="text-[1.15rem] font-bold break-keep text-slate-900">전체 진행 리포트는 결과자료로 통합되었습니다</h1>
          <p className="mt-1.5 text-[0.95rem] leading-relaxed break-keep text-slate-600">
            프로젝트별 진단·설계·전달자료와 전체 자료 목록은 결과자료 화면에서 확인할 수 있습니다.
          </p>
          <Button variant="primary" className="mt-4" onClick={() => navigate('/deliverables/results')}>
            결과자료로 이동
            <ArrowRight aria-hidden="true" className="size-4" />
          </Button>
        </div>
      </div>
    </section>
  )
}
