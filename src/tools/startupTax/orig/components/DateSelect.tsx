import { daysInMonth, joinDate, splitDate } from '../../lib/date'

interface Props {
  value: string // YYYY-MM-DD
  onChange: (value: string) => void
  minYear: number
  maxYear: number
  // 연도 빠른 이동 버튼 표시 여부
  yearStep?: number
  // 이 OS 에서 더함 — 화면 읽기·시험용 이름 (생년월일 / 창업일 구분)
  groupLabel?: string
  /** D-215: 값이 비었을 때 처음 보여 줄 날짜(예시) — 값으로 쓰지 않는다. 비었으면 '아직 고르지 않음' + [이 날짜로 정하기] */
  startAt?: string
}

// HTML date 입력 대신 연/월/일 분리 선택 방식.
// 연도 드롭다운 + 빠른 이동(±10년) 버튼으로 연도 이동을 매우 편하게 한다.
export default function DateSelect({ value, onChange, minYear, maxYear, yearStep = 10, groupLabel, startAt }: Props) {
  const picked = splitDate(value)
  const parts = picked ?? splitDate(startAt ?? '') ?? { year: maxYear, month: 1, day: 1 }
  const { year, month, day } = parts

  // 연도: 최신 연도가 위로 오도록 내림차순
  const years: number[] = []
  for (let y = maxYear; y >= minYear; y--) years.push(y)

  const months = Array.from({ length: 12 }, (_, i) => i + 1)
  const days = Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1)

  const setYear = (y: number) => onChange(joinDate(clamp(y, minYear, maxYear), month, day))
  const setMonth = (m: number) => onChange(joinDate(year, m, day))
  const setDay = (d: number) => onChange(joinDate(year, month, d))

  const selectClass =
    'w-full appearance-none rounded-2xl border border-gray-200 bg-white px-3 py-4 text-lg font-medium text-gray-900 outline-none focus:border-brand'

  return (
    <div className="flex flex-col gap-2.5" role="group" aria-label={groupLabel} data-value={value}>
      {/* 연도 빠른 이동 */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setYear(year - yearStep)}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-base font-bold text-gray-600 hover:bg-gray-50"
          aria-label={`${yearStep}년 전`}
        >
          −{yearStep}년
        </button>
        <div className="flex-1 text-center text-lg font-bold text-gray-900">{year}년</div>
        <button
          type="button"
          onClick={() => setYear(year + yearStep)}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-base font-bold text-gray-600 hover:bg-gray-50"
          aria-label={`${yearStep}년 후`}
        >
          +{yearStep}년
        </button>
      </div>

      {/* 연 / 월 / 일 드롭다운 */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="relative">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className={selectClass}
            aria-label="연도"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>
          <Caret />
        </div>
        <div className="relative">
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className={selectClass}
            aria-label="월"
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {m}월
              </option>
            ))}
          </select>
          <Caret />
        </div>
        <div className="relative">
          <select
            value={day}
            onChange={(e) => setDay(Number(e.target.value))}
            className={selectClass}
            aria-label="일"
          >
            {days.map((d) => (
              <option key={d} value={d}>
                {d}일
              </option>
            ))}
          </select>
          <Caret />
        </div>
      </div>
      {!picked && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-base text-amber-900" data-testid="date-unpicked">
          <span className="break-keep">아직 고르지 않았어요 — 위 날짜는 예시입니다.</span>
          <button
            type="button"
            onClick={() => onChange(joinDate(year, month, day))}
            className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 font-semibold text-amber-900 hover:bg-amber-100"
            data-testid="date-pick-this"
          >
            {year}.{String(month).padStart(2, '0')}.{String(day).padStart(2, '0')} 로 정하기
          </button>
        </div>
      )}
    </div>
  )
}

function Caret() {
  return (
    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
      ▾
    </span>
  )
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}
