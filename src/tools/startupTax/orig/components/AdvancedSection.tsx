import type { AdvancedInput, IndustryRelation, YesNoUnknown } from '../../types'
import { INDUSTRY_RELATIONS, YES_NO_UNKNOWN } from '../../lib/options'
import { ChoiceGroup } from './ui'

interface Props {
  value: AdvancedInput
  onChange: (next: AdvancedInput) => void
}

// 상세(선택) 입력 — 조특법/창업지원법 정밀 판단용
export default function AdvancedSection({ value, onChange }: Props) {
  const set = <K extends keyof AdvancedInput>(key: K, v: AdvancedInput[K]) =>
    onChange({ ...value, [key]: v })

  return (
    <div className="flex flex-col gap-5">
      <p className="text-base leading-relaxed text-gray-400">
        선택 입력입니다. 입력할수록 조특법·창업지원법 기준 판정이 더 정확해집니다.
      </p>

      <div>
        <Label>기존 개인사업 최초 개시일</Label>
        <p className="mb-2.5 text-base leading-relaxed text-gray-400">
          법인전환·양수·승계인 경우 창업일이 이 날짜로 승계됩니다. 업력(7년)과 감면 잔여기간(5년)
          판단에 사용됩니다.
        </p>
        <input
          type="date"
          value={value.originalStartDate}
          onChange={(e) => set('originalStartDate', e.target.value)}
          className="w-full rounded-2xl border border-gray-200 px-4 py-4 text-lg text-gray-900 outline-none focus:border-brand"
        />
      </div>

      <Ynu label="기존 개인사업자 보유 여부" value={value.hasExistingSole} onSelect={(v) => set('hasExistingSole', v)} />
      <Ynu label="기존 법인 보유 여부" value={value.hasExistingCorp} onSelect={(v) => set('hasExistingCorp', v)} />
      <Ynu label="기존 법인 임원 여부" value={value.isExistingExec} onSelect={(v) => set('isExistingExec', v)} />
      <Ynu label="기존 법인 과점주주 여부" value={value.isOligopoly} onSelect={(v) => set('isOligopoly', v)} />

      <Percent label="신규 법인 대표 지분율" value={value.newOwnerShare} onChange={(v) => set('newOwnerShare', v)} />
      <Percent label="친족 합산 지분율" value={value.familyShare} onChange={(v) => set('familyShare', v)} />
      <Percent
        label="기존 법인 및 임원 합산 지분율"
        value={value.existingCorpExecShare}
        onChange={(v) => set('existingCorpExecShare', v)}
      />
      <Percent
        label="기존 자산 인수 비율"
        value={value.assetTakeoverRatio}
        onChange={(v) => set('assetTakeoverRatio', v)}
      />

      <div>
        <Label>기존 사업과 동종 / 이종 여부</Label>
        <ChoiceGroup<IndustryRelation>
          options={INDUSTRY_RELATIONS}
          value={value.prevIndustryRelation}
          onSelect={(v) => set('prevIndustryRelation', v)}
          columns={4}
        />
      </div>

      <Ynu label="기존 직원 이동 여부" value={value.employeeMoved} onSelect={(v) => set('employeeMoved', v)} />
      <Ynu
        label="기존 거래처 / 상호 / 홈페이지 사용 여부"
        value={value.reuseIdentity}
        onSelect={(v) => set('reuseIdentity', v)}
      />
      <Ynu
        label="같은 주소 / 같은 사무실 사용 여부"
        value={value.sameAddress}
        onSelect={(v) => set('sameAddress', v)}
      />
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-2.5 text-lg font-bold text-gray-800">{children}</div>
}

function Ynu({
  label,
  value,
  onSelect,
}: {
  label: string
  value: YesNoUnknown | ''
  onSelect: (v: YesNoUnknown) => void
}) {
  return (
    <div>
      <Label>{label}</Label>
      <ChoiceGroup<YesNoUnknown>
        options={YES_NO_UNKNOWN}
        value={value}
        onSelect={onSelect}
        columns={3}
      />
    </div>
  )
}

function Percent({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={100}
          placeholder="예: 50"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-2xl border border-gray-200 px-4 py-4 text-lg text-gray-900 outline-none focus:border-brand"
        />
        <span className="shrink-0 text-lg font-bold text-gray-400">%</span>
      </div>
    </div>
  )
}
