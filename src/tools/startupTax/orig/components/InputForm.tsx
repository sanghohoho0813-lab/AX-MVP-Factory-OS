import type { ExemptionKey, FormData } from '../../types'
import {
  BUSINESS_TYPES,
  CHECK_ITEMS,
  INDUSTRIES,
  OVERCONCENTRATIONS,
  REGIONS,
  STARTUP_FORMS,
  YES_NO_UNKNOWN,
} from '../../lib/options'
import { REVISED_RULE_FROM } from '../../lib/rules'
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
          startAt="1980-01-01"
          minYear={1930}
          maxYear={currentYear - 10}
        />
        <HintText>창업 당시 만 15~34세면 청년 창업에 해당할 수 있습니다. (병역 기간 최대 6년 빼기)</HintText>
      </Section>

      {/* 3. 창업일 */}
      <Section>
        <FieldLabel step={3}>창업일</FieldLabel>
        <DateSelect
          groupLabel="③ 창업일"
          value={form.startupDate}
          onChange={(v) => update('startupDate', v)}
          startAt="2020-01-01"
          minYear={1990}
          maxYear={currentYear}
          yearStep={5}
        />
        <HintText>사업자등록증의 개업일(법인은 설립등기일)을 고르세요.</HintText>
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
        {/* D-318 2026년 이후 창업 · 경기 · 인천 과밀억제권역 밖이면 — 인구감소지역인지로 감면율이 한 단계 갈린다 */}
        {form.region === 'gyeonggi_incheon' && form.overconcentration !== 'yes' && form.startupDate >= REVISED_RULE_FROM && (
          <div className="mt-4 border-t border-gray-100 pt-4" data-testid="startup-pop-decline">
            <p className="mb-3 break-keep text-base font-bold text-gray-800">가평 · 연천 · 강화 · 옹진(수도권 인구감소지역)인가요?</p>
            <ChoiceGroup options={YES_NO_UNKNOWN} value={form.popDecline ?? ''} onSelect={(v) => update('popDecline', v)} columns={3} />
            <HintText>2026년 이후 창업은 이 네 곳이면 수도권 밖과 같은 감면율(청년 100% · 일반 50%), 아니면 청년 75% · 일반 25%입니다.</HintText>
          </div>
        )}
      </Section>

      {/* D-325 벤처기업 확인 — 창업 3년 안이면 권역과 상관없이 50%(창업벤처중소기업 · 조특법 §6②) */}
      <Section>
        <div data-testid="startup-venture">
          <p className="mb-3 break-keep text-base font-bold text-gray-800">벤처기업 확인을 받았나요?</p>
          <ChoiceGroup
            options={[
              { value: 'yes', label: '예' },
              { value: 'no', label: '아니오' },
            ]}
            value={form.ventureDate ? 'yes' : form.ventureDate === '' ? 'no' : ''}
            onSelect={(v) => update('ventureDate', v === 'yes' ? form.ventureDate || form.startupDate || `${currentYear}-01-01` : '')}
          />
          {form.ventureDate && (
            <div className="mt-3">
              <p className="mb-2 text-sm font-semibold text-gray-600">처음 확인받은 날(벤처기업확인서 '확인일')</p>
              <DateSelect groupLabel="벤처기업 확인일" value={form.ventureDate} onChange={(v) => update('ventureDate', v)} startAt={form.startupDate || '2024-01-01'} minYear={1990} maxYear={currentYear} yearStep={5} />
            </div>
          )}
          <HintText>창업 후 3년 안에 확인받았으면 사업장 권역과 상관없이 5년간 50% 감면(창업벤처중소기업). 업체 서류함에 벤처기업확인서가 있으면 저절로 채워져요.</HintText>
        </div>
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
                  // D-99: 휴대폰에서 '등록면허/세' 처럼 꺾이고 네모가 눌렸다 — 좌우 여백을 줄이고 네모는 줄지 않게, 글은 왼쪽 정렬
                  'flex items-center gap-2.5 rounded-2xl border px-3 py-4 text-left text-base font-medium transition-colors sm:px-4 sm:text-lg',
                  active
                    ? 'border-brand bg-brand/5 text-brand'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300',
                ].join(' ')}
              >
                <span
                  className={[
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-sm',
                    active ? 'border-brand bg-brand text-white' : 'border-gray-300 bg-white',
                  ].join(' ')}
                >
                  {active ? '✓' : ''}
                </span>
                <span className="min-w-0">{item.label}</span>
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
