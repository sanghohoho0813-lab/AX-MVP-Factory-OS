import type { ExemptionKey, FormData } from '../../types'
import {
  BUSINESS_TYPES,
  CHECK_ITEMS,
  INDUSTRIES,
  OVERCONCENTRATIONS,
  REGIONS,
  STARTUP_FORMS,
} from '../../lib/options'
import { Accordion, ChoiceGroup, FieldLabel, HintText, Section } from './ui'
import DateSelect from './DateSelect'
import AdvancedSection from './AdvancedSection'

interface Props {
  form: FormData
  onChange: (form: FormData) => void
  onSubmit: () => void
  onReset: () => void
  currentYear: number
}

export default function InputForm({ form, onChange, onSubmit, onReset, currentYear }: Props) {
  const update = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    onChange({ ...form, [key]: value })
  }

  const toggleCheck = (key: ExemptionKey) => {
    onChange({ ...form, checkItems: { ...form.checkItems, [key]: !form.checkItems[key] } })
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
    >
      {/* 1. 사업자 유형 */}
      <Section>
        <FieldLabel step={1}>사업자 유형</FieldLabel>
        <ChoiceGroup
          options={BUSINESS_TYPES}
          value={form.businessType}
          onSelect={(v) => update('businessType', v)}
        />
      </Section>

      {/* 2. 생년월일 */}
      <Section>
        <FieldLabel step={2}>대표자 생년월일</FieldLabel>
        <DateSelect
          groupLabel="② 대표자 생년월일"
          value={form.birthDate}
          onChange={(v) => update('birthDate', v)}
          minYear={1930}
          maxYear={currentYear - 10}
        />
        <HintText>만 15~34세는 청년 창업 요건에 해당할 수 있습니다. (병역기간 미반영)</HintText>
      </Section>

      {/* 3. 창업일 */}
      <Section>
        <FieldLabel step={3}>창업일</FieldLabel>
        <DateSelect
          groupLabel="③ 창업일"
          value={form.startupDate}
          onChange={(v) => update('startupDate', v)}
          minYear={1990}
          maxYear={currentYear}
          yearStep={5}
        />
      </Section>

      {/* 4. 지역 */}
      <Section>
        <FieldLabel step={4}>사업장 지역</FieldLabel>
        <ChoiceGroup options={REGIONS} value={form.region} onSelect={(v) => update('region', v)} />
      </Section>

      {/* 5. 과밀억제권역 */}
      <Section>
        <FieldLabel step={5}>수도권 과밀억제권역 여부</FieldLabel>
        <ChoiceGroup
          options={OVERCONCENTRATIONS}
          value={form.overconcentration}
          onSelect={(v) => update('overconcentration', v)}
          columns={3}
        />
        <HintText>과밀억제권역 여부에 따라 감면율과 적용 여부가 크게 달라집니다.</HintText>
      </Section>

      {/* 6. 업종 */}
      <Section>
        <FieldLabel step={6}>업종</FieldLabel>
        <ChoiceGroup
          options={INDUSTRIES}
          value={form.industry}
          onSelect={(v) => update('industry', v)}
        />
      </Section>

      {/* 7. 창업 형태 */}
      <Section>
        <FieldLabel step={7}>창업 형태</FieldLabel>
        <ChoiceGroup
          options={STARTUP_FORMS}
          value={form.startupForm}
          onSelect={(v) => update('startupForm', v)}
          columns={1}
        />
      </Section>

      {/* 8. 감면 확인 항목 */}
      <Section>
        <FieldLabel step={8}>감면 확인 항목</FieldLabel>
        <HintText>
          확인하고 싶은 항목을 선택하세요. (선택하지 않으면 전체 항목을 판정합니다)
        </HintText>
        <div className="mt-3.5 grid grid-cols-2 gap-2.5">
          {CHECK_ITEMS.map((item) => {
            const active = form.checkItems[item.value]
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => toggleCheck(item.value)}
                className={[
                  'flex items-center gap-2.5 rounded-2xl border px-4 py-4 text-lg font-medium transition-colors',
                  active
                    ? 'border-brand bg-brand/5 text-brand'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300',
                ].join(' ')}
              >
                <span
                  className={[
                    'flex h-6 w-6 items-center justify-center rounded-md border text-sm',
                    active ? 'border-brand bg-brand text-white' : 'border-gray-300 bg-white',
                  ].join(' ')}
                >
                  {active ? '✓' : ''}
                </span>
                {item.label}
              </button>
            )
          })}
        </div>
      </Section>

      {/* 9. 상세 입력 (선택, 접힘) */}
      <Accordion title="상세 입력 (선택) · 법 기준 정밀 판정">
        <AdvancedSection
          value={form.advanced}
          onChange={(advanced) => onChange({ ...form, advanced })}
        />
      </Accordion>

      {/* 액션 */}
      <div className="sticky bottom-4 z-10 mt-2 flex gap-3 max-lg:bottom-[calc(4.75rem+env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={onReset}
          className="rounded-2xl border border-gray-200 bg-white px-6 py-4 text-lg font-bold text-gray-600 shadow-card transition-colors hover:bg-gray-50"
        >
          초기화
        </button>
        <button
          type="submit"
          className="flex-1 rounded-2xl bg-brand px-6 py-4 text-lg font-bold text-white shadow-card transition-colors hover:bg-brand-dark"
        >
          1분 판정하기
        </button>
      </div>
    </form>
  )
}
