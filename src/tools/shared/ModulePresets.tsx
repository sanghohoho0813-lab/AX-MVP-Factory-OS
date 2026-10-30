/**
 * MOD-1 모듈 첫 화면 '상황 예시' — 대표 목표 3 "계산기는 상황 예시로 — 한 번 누르면 그 업체 숫자로 설계까지".
 * 예전엔 상황 예시가 업체 상세(맞춤 추천)에만 있어 모듈 첫 화면에서는 빈 칸부터 적어야 했다.
 *  - 업체를 골랐으면 그 업체 숫자로 바로(?client=&preset= — 각 화면이 이미 읽는 주소, D-199).
 *  - 안 골랐으면 예시 가정만 얹어 연다(업체를 고르라는 한 줄 — D-354 누르면 업체 고르기 창).
 *  - 규칙 계산(AI 아님) · 계산식은 그대로.
 *  - NX-4 예시가 많아져 처음엔 6개(휴대폰 4개)만 — 나머지는 [상황 예시 n개 더 보기].
 */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Lightbulb } from 'lucide-react'
import { SCENARIO_MODULE_PATH, SCENARIO_PRESETS, scenarioPath, type ScenarioModule } from '../../services/scenarioPresets'
import { Surface } from '../../components/ui/primitives'
import { Button } from '../../components/ui/Button'
import { useToolClient } from './toolClientContext'
import { useIsPhone } from '../../lib/useIsPhone'
import { openToolClientPicker } from './toolClientPick'

export function ModulePresets({ module }: { module: ScenarioModule }) {
  const { clientId, clientRecord } = useToolClient()
  const phone = useIsPhone()
  const [all, setAll] = useState(false)
  const list = SCENARIO_PRESETS.filter((p) => p.module === module && !p.calc)
  if (!list.length) return null
  const first = phone ? 4 : 6
  const shown = all ? list : list.slice(0, first)
  const name = clientId ? clientRecord?.companyName : ''
  return (
    <div data-testid="module-presets" data-module={module}>
      <Surface className="flex flex-col gap-3">
        <h2 className="t-section flex items-center gap-2 break-keep text-slate-900">
          <Lightbulb aria-hidden="true" className="size-5 shrink-0 text-amber-500" />
          상황 예시 — 누르면 {name ? `${name} 숫자로` : '바로'} 계산
        </h2>
        {!clientId && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {/* D-354 예전엔 '위에서 업체를 먼저 고르면' 이라고만 했다(위에 고르는 곳이 없었다) — 이제 여기서 바로 */}
            <p className="t-sub min-w-[14rem] flex-1 break-keep text-slate-600">업체를 먼저 고르면 그 업체 숫자(직원 수 · 매출 · 주소 등)로 채워져요. 고르지 않으면 예시 가정만 넣어 엽니다.</p>
            <Button size="sm" variant="secondary" onClick={openToolClientPicker} data-testid="module-presets-pick">
              <Building2 aria-hidden="true" className="size-4" /> 업체 고르기
            </Button>
          </div>
        )}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((p) => (
            <Link
              key={p.id}
              to={clientId ? scenarioPath(p, clientId) : `${SCENARIO_MODULE_PATH[module]}?preset=${encodeURIComponent(p.id)}`}
              data-testid="module-preset"
              data-preset={p.id}
              className="tap flex min-h-14 flex-col justify-center gap-0.5 rounded-(--radius-control) border border-slate-200 bg-white px-3 py-2.5 hover:border-brand-400 hover:bg-brand-50"
            >
              <span className="t-body font-semibold break-keep text-slate-900">{p.title}</span>
              <span className="t-meta break-keep text-slate-600">{p.when}</span>
            </Link>
          ))}
        </div>
        {list.length > first && (
          <button type="button" onClick={() => setAll((v) => !v)} className="tap t-sub self-start font-semibold text-brand-700 hover:underline" data-testid="module-presets-more" aria-expanded={all}>
            {all ? '상황 예시 접기' : `상황 예시 ${list.length - first}개 더 보기`}
          </button>
        )}
      </Surface>
    </div>
  )
}
