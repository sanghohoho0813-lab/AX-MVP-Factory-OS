/**
 * D-220: 가상 업체 · 컨설턴트 정보 넣기 — 고객 관리에 없어도 홈페이지 · 홍보 글을 바로 만들어 보게.
 * 이름 하나만 있으면 된다. 예시를 누르면 칸이 채워진다(전부 지어낸 이름).
 */
import { useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { TRIAL_KIND_LABEL, TRIAL_SAMPLES, type TrialKind, type TrialProfile } from '../../services/marketingTrial'
import { inputClass } from '../homepage/BlockFields'

const LABELS: Record<TrialKind, { name: string; namePh: string; industry: string; industryPh: string; person: string; intro: string; introPh: string }> = {
  company: { name: '업체 이름', namePh: '예: 봄날베이커리', industry: '업종 · 하는 일', industryPh: '예: 베이커리 카페 · 금속 가공 · 학원', person: '대표 이름', intro: '한 줄 소개 · 주력 상품', introPh: '예: 매일 아침 굽는 빵 · 주문 케이크' },
  consultant: { name: '컨설턴트 이름(활동 이름)', namePh: '예: 정다온 경영컨설턴트', industry: '전문 분야', industryPh: '예: 정책자금 · 기업 인증 · 절세', person: '본인 이름', intro: '한 줄 소개 · 주로 돕는 일', introPh: '예: 중소기업 정책자금 · 벤처 인증' },
}

export function TrialForm({ initial, busy, onClose, onSave }: { initial: TrialProfile; busy: boolean; onClose: () => void; onSave: (p: TrialProfile) => void }) {
  const [p, setP] = useState<TrialProfile>(initial)
  const L = LABELS[p.kind]
  const set = (k: keyof TrialProfile) => (e: { target: { value: string } }) => setP({ ...p, [k]: e.target.value })
  const editing = initial.name !== ''
  const field = (k: keyof TrialProfile, label: string, ph = '', type = 'text') => (
    <label className="flex flex-col gap-1">
      <span className="t-sub font-semibold text-slate-700">{label}</span>
      <input className={inputClass} type={type} value={String(p[k] ?? '')} placeholder={ph} onChange={set(k)} data-testid={`trial-${k}`} />
    </label>
  )
  return (
    <Modal
      open
      title={editing ? `${TRIAL_KIND_LABEL[p.kind]} 정보 고치기` : '가상 업체 · 컨설턴트로 만들어 보기'}
      onClose={onClose}
      size="lg"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button onClick={onClose}>닫기</Button>
          <Button variant="primary" disabled={busy || !p.name.trim()} onClick={() => onSave(p)} data-testid="trial-save">
            {editing ? '저장' : '이 정보로 만들기'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4" data-testid="trial-form">
        <p className="t-sub break-keep text-slate-600">
          고객 관리에 없어도 돼요. 이름만 있으면 업종 견본으로 바로 만들어지고, 마음에 들면 나중에 <b className="text-slate-800">임시등록</b>으로 고객 관리에 올릴 수 있어요.
        </p>
        {!editing && (
          <div className="flex flex-col gap-1.5">
            <span className="t-sub font-semibold text-slate-700">누구 것인가요?</span>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="종류">
              {(['company', 'consultant'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={p.kind === k}
                  onClick={() => setP({ ...p, kind: k })}
                  className={`tap t-sub min-h-11 rounded-full border px-4 font-semibold ${p.kind === k ? 'border-brand-600 bg-brand-50 text-brand-800' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}
                  data-testid={`trial-kind-${k}`}
                >
                  {k === 'company' ? '업체(잠재고객 · 아직 고객 아님)' : '컨설턴트(동료 · 본인)'}
                </button>
              ))}
            </div>
          </div>
        )}
        {!editing && (
          <div className="flex flex-col gap-1.5">
            <span className="t-sub font-semibold text-slate-700">예시로 채우기</span>
            <div className="flex flex-wrap gap-2">
              {TRIAL_SAMPLES.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setP({ ...p, kind: s.kind, ...s.fill })}
                  className="tap t-sub min-h-11 rounded-full border border-slate-300 px-3 text-slate-700 hover:bg-slate-50"
                  data-testid="trial-sample"
                  data-sample={s.key}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {field('name', `${L.name} *`, L.namePh)}
          {field('industry', L.industry, L.industryPh)}
          {field('person', L.person)}
          {field('region', '지역 · 주소', '예: 경기도 수원시')}
          {field('phone', '전화', '예: 031-123-4567', 'tel')}
          {field('email', '이메일', '', 'email')}
          {field('intro', L.intro, L.introPh)}
          {field('homepage', '지금 쓰는 홈페이지 · 블로그(선택)', 'https://')}
          {field('requestedBy', '부탁한 사람(선택 · 동료 컨설턴트 등)')}
        </div>
      </div>
    </Modal>
  )
}
