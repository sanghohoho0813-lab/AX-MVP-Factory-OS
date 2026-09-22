import type {
  FormData,
  FrameworkResult,
  ItemResult,
  Lineage,
  SavingsPoint,
  Verdict,
  YouthStatus,
} from '../types'
import { formatAge } from './lineage'

// ---------------------------------------------------------------------------
// 유틸
// ---------------------------------------------------------------------------
// 판정 사다리 (나쁨 → 좋음). downgrade(steps)로 보수적으로 하향.
const LADDER: Verdict[] = ['bad', 'conditional', 'caution', 'good']
function downgrade(v: Verdict, steps: number): Verdict {
  const i = LADDER.indexOf(v)
  return LADDER[Math.max(0, i - steps)]
}
function worst(a: Verdict, b: Verdict): Verdict {
  return LADDER.indexOf(a) <= LADDER.indexOf(b) ? a : b
}
function pct(s: string): number | null {
  if (!s) return null
  const n = Number(s)
  return Number.isNaN(n) ? null : n
}

const CONCLUSION: Record<Verdict, string> = {
  good: '현재 정보 기준 적용 가능성이 높아 보입니다.',
  caution: '가능성은 있으나 핵심 항목 확인이 필요합니다.',
  conditional: '조건에 따라 결과가 크게 달라질 수 있습니다.',
  bad: '현재 정보 기준 적용이 어려워 보입니다.',
}

function verdictToTone(v: Verdict): SavingsPoint['tone'] {
  if (v === 'good') return 'good'
  if (v === 'bad') return 'bad'
  return 'caution'
}

// ---------------------------------------------------------------------------
// 조특법 제6조 대상/제외 업종 안내
// ---------------------------------------------------------------------------
const INDUSTRY_TAXLAW_NOTE: Record<string, string> = {
  manufacturing: '제조업은 조특법 제6조 감면 대상 업종에 해당할 가능성이 높습니다.',
  ict: '정보통신업은 세부 업종(SW개발·정보서비스 등)에 따라 대상 여부가 달라져 업종코드 확인이 필요합니다.',
  professional:
    '전문서비스업은 세부 업종에 따라 대상/제외가 나뉘므로 업종코드(엔지니어링·연구개발 등) 확인이 필요합니다.',
  wholesale_retail:
    '도소매업은 조특법상 단순 도소매가 아니라 통신판매업 등 세부 업종 해당 여부 확인이 필요합니다.',
  restaurant: '음식점업은 대상 업종에 해당할 수 있으나 세부 요건 확인이 필요합니다.',
  real_estate: '부동산업은 조특법 제6조 감면 대상에서 제외될 가능성이 높습니다.',
  finance_insurance:
    '금융·보험업은 세부 업종 확인이 필요하며 감면 대상에서 제외될 가능성이 있습니다.',
  etc: '업종코드에 따라 대상 여부가 달라지므로 주업종 코드 확인이 필요합니다.',
}

// ===========================================================================
// 1) 조특법 기준 (법인세/소득세 세액감면)
// ===========================================================================
function buildTaxLaw(
  form: FormData,
  income: ItemResult | undefined,
  youth: YouthStatus,
  lineage: Lineage,
): FrameworkResult {
  const a = form.advanced
  let v: Verdict = income?.verdict ?? 'conditional'
  const risks: string[] = []
  const checkPoints: string[] = [
    '주업종 코드가 조특법 제6조 대상 업종인지 확인이 필요합니다.',
    '최초로 소득이 발생한 과세연도 기준으로 감면 기간이 산정됩니다.',
  ]

  // 창업 형태 리스크 (income.verdict에 이미 일부 반영되어 있어 추가 하향은 신중히)
  switch (form.startupForm) {
    case 'conversion':
      risks.push(
        '개인사업자의 법인전환은 새로운 창업으로 보지 않아, 법인 설립일 기준으로 감면이 새로 시작되지 않습니다.',
      )
      break
    case 'acquisition':
      risks.push('기존 사업 양수는 창업 제외 대상이 될 수 있습니다.')
      break
    case 'reopen_same':
      risks.push('폐업 후 동종 재개업은 창업 제외 대상이 될 수 있습니다.')
      break
    case 'succession':
      risks.push('특수관계인 사업 승계는 창업으로 인정되지 않을 가능성이 높습니다.')
      break
  }

  // 창업일 승계형(법인전환·양수·승계): 잔여 감면기간 승계 여부가 핵심
  if (lineage.inherited) {
    if (lineage.needsOriginalDate) {
      v = worst(v, 'conditional')
      risks.push(
        '기존 사업 최초 개시일이 확인되어야 감면 잔여기간(최초 창업일부터 5년) 승계 여부를 판단할 수 있습니다.',
      )
      checkPoints.push('기존 개인사업 최초 개시일(사업자등록일)을 확인해 주세요.')
    } else if (lineage.hasTaxRemaining === true) {
      // 잔여기간 있음 → 승계 검토 대상 (완전 불가로 보지 않음)
      v = worst(v, 'caution')
      risks.push(
        `기존 창업일 기준 업력 ${formatAge(lineage.businessAgeYears)} — 감면 잔여기간 약 ${formatAge(
          lineage.taxRemainingYears,
        )}이 남아 승계 적용을 검토할 수 있습니다.`,
      )
      checkPoints.push(
        '기존 개인사업 창업 당시 감면 요건(업종·지역·창업 인정)을 충족했는지 확인이 필요합니다.',
      )
    } else if (lineage.hasTaxRemaining === false) {
      v = 'bad'
      risks.push(
        `기존 창업일 기준 업력 ${formatAge(
          lineage.businessAgeYears,
        )}으로 창업중소기업 세액감면 기간(5년)이 이미 경과했을 가능성이 높습니다.`,
      )
    }
  }

  // 새 입력 기반 추가 리스크 (사업 동일성 / 자산 인수)
  // 승계형(법인전환·양수·승계)은 동일성·자산인수가 구조상 당연하므로 중복 감점하지 않고
  // 안내만 하며, 잔여 감면기간 승계 판단(위)에 맡긴다.
  let nf = 0
  const asset = pct(a.assetTakeoverRatio)
  if (asset !== null && asset > 30) {
    risks.push(`기존 자산 인수 ${asset}% — 30% 초과 시 사업확장·승계로 보아 창업 제외 가능성이 있습니다.`)
    if (!lineage.inherited) nf += 1
  }
  const identity = [a.sameAddress === 'yes', a.reuseIdentity === 'yes', a.employeeMoved === 'yes'].filter(
    Boolean,
  ).length
  if (identity >= 1) {
    risks.push('기존 사업장 주소·거래처·상호·인력의 연속성은 사업 동일성(창업 부정) 쟁점이 됩니다.')
    if (identity >= 2 && !lineage.inherited) nf += 1
  }
  if (a.prevIndustryRelation === 'same') {
    risks.push(
      lineage.inherited
        ? '기존 사업과 동종이므로 별도 신규창업이 아니라 기존 창업의 연속(승계)으로 판단됩니다. (조특법상 동종 판단)'
        : '기존 사업과 동종 영위는 사업확장·재개업으로 보일 수 있습니다. (조특법상 동종 판단)',
    )
    if (!lineage.inherited) nf += 1
  }
  v = downgrade(v, Math.min(nf, 2))

  // 업종 안내
  const industryNote = form.industry ? INDUSTRY_TAXLAW_NOTE[form.industry] : ''
  if (industryNote) checkPoints.unshift(industryNote)

  // 항목 포인트
  const points: SavingsPoint[] = [
    {
      tone: verdictToTone(v),
      text:
        v === 'bad'
          ? '법인세·소득세 감면 적용이 어려울 수 있습니다.'
          : v === 'good'
            ? '법인세·소득세 감면 검토 대상입니다.'
            : lineage.inherited
              ? '신규 감면이 아니라 기존 창업일 기준 잔여 감면기간 승계를 검토해야 합니다.'
              : '법인세·소득세 감면 가능성 있으나 제한 검토가 필요합니다.',
    },
  ]

  return {
    key: 'taxLaw',
    title: '조특법 기준 (세액감면)',
    subtitle: '법인세 / 소득세 감면 — 창업중소기업 세액감면(조특법 §6)',
    verdict: v,
    conclusion: CONCLUSION[v],
    points,
    risks,
    checkPoints,
    note: `청년이 아니어도 일반 창업중소기업 세액감면(감면율 축소) 대상이 될 수 있습니다. 청년은 감면율 우대(청년창업중소기업) 요건입니다 — ${youth.taxLawNote} · 동종 업종 판단 기준은 창업지원법과 다를 수 있습니다.`,
  }
}

// ===========================================================================
// 2) 창업지원법 기준 (정책자금 / 창업기업 확인)
// ===========================================================================
function buildStartupLaw(
  form: FormData,
  recognition: Verdict,
  youth: YouthStatus,
  lineage: Lineage,
): FrameworkResult {
  const a = form.advanced
  let v: Verdict = recognition
  const risks: string[] = []
  const checkPoints: string[] = [
    '창업기업 확인은 청년 여부와 무관하며, 업력 7년 이내 중소기업이면서 창업 제외사유에 해당하지 않으면 가능합니다.',
    '청년(만 39세 이하)은 창업기업 확인의 필수 요건이 아니라 청년전용 정책자금 등 별도 우대 요건입니다.',
  ]

  // 창업일 승계형: 법인전환은 창업기업 지위를 잃는 것이 아니라
  // 창업일이 기존 개인사업 최초 개시일로 승계되어 업력 7년으로 판단한다.
  if (lineage.inherited) {
    if (lineage.needsOriginalDate) {
      v = worst(v, 'conditional')
      risks.push(
        '기존 사업 최초 개시일이 확인되어야 업력 7년 이내(창업기업) 여부를 판단할 수 있습니다.',
      )
      checkPoints.push('기존 개인사업 최초 개시일(사업자등록일)을 확인해 주세요.')
    } else if (lineage.within7Years === true) {
      // 업력 7년 이내 → 창업기업 지위 유지 가능 (법인전환 자체로 배제되지 않음)
      v = worst(v, 'caution')
      risks.push(
        `창업일이 기존 개인사업 최초 개시일로 승계되어 업력 ${formatAge(
          lineage.businessAgeYears,
        )} — 7년 이내이므로 창업기업 지위가 유지될 수 있습니다.`,
      )
      checkPoints.push(
        '기존 개인사업의 최초 창업이 창업 제외사유(승계·양수 등)에 해당하지 않았는지 확인이 필요합니다.',
      )
    } else if (lineage.within7Years === false) {
      v = 'bad'
      risks.push(
        `승계된 창업일 기준 업력 ${formatAge(
          lineage.businessAgeYears,
        )}으로 창업기업 업력 요건(7년 이내)을 초과했을 가능성이 높습니다.`,
      )
    }
  } else if (lineage.within7Years === false) {
    // 신규 창업이어도 업력 7년 초과면 창업기업 아님
    v = 'bad'
    risks.push(
      `업력 ${formatAge(lineage.businessAgeYears)}으로 창업기업 업력 요건(7년 이내)을 초과했습니다.`,
    )
  }

  let nf = 0
  const family = pct(a.familyShare)
  if (family !== null && family > 50) {
    risks.push(`친족 합산 지분 ${family}% — 50% 초과 시 창업기업 인정에서 제외될 수 있습니다.`)
    nf += 1
  }
  const corpExec = pct(a.existingCorpExecShare)
  if (corpExec !== null && corpExec > 50) {
    risks.push(`기존 법인+임원 합산 지분 ${corpExec}% — 50% 초과 시 창업기업 제외 가능성이 있습니다.`)
    nf += 1
  }
  if (a.isOligopoly === 'yes') {
    risks.push('기존 법인 과점주주가 중복되면 창업기업 인정에서 제외될 수 있습니다.')
    nf += 1
  }
  // 폐업 후 동종 재개업 기준은 "폐업"이 전제 — 법인전환·양수 승계형에는 적용하지 않는다.
  if (
    form.startupForm === 'reopen_same' ||
    (a.prevIndustryRelation === 'same' && !lineage.inherited)
  ) {
    risks.push('폐업 후 동종 재개업은 폐업 후 3년(부도·파산은 2년) 경과 여부 확인이 필요합니다.')
    nf += 1
    checkPoints.push('폐업일~재창업일 경과기간(동종 3년 / 부도·파산 2년)을 확인해야 합니다.')
  }
  if (a.hasExistingCorp === 'yes' || a.isExistingExec === 'yes') {
    risks.push('기존 법인 보유·임원 등재 여부는 창업기업 독립성 판단에 영향을 줄 수 있습니다.')
  }
  v = downgrade(v, Math.min(nf, 2))

  const points: SavingsPoint[] = [
    {
      tone: verdictToTone(v),
      text:
        v === 'bad'
          ? '창업기업 확인이 어려울 수 있습니다.'
          : v === 'good'
            ? '창업기업 확인 및 정책자금 검토 대상입니다.'
            : lineage.inherited
              ? '기존 창업일 승계 기준으로 창업기업 확인 가능성이 있어 최초 창업 유효성 확인이 필요합니다.'
              : '창업기업 확인 가능성 있으나 지분·승계 요건 확인이 필요합니다.',
    },
  ]

  return {
    key: 'startupLaw',
    title: '창업지원법 기준',
    subtitle: '정책자금 / 창업기업 확인 — 중소기업창업 지원법',
    verdict: v,
    conclusion: CONCLUSION[v],
    points,
    risks,
    checkPoints,
    note: `창업기업 확인은 청년이 아니어도 요건 충족 시 가능합니다. 청년(만 39세 이하)은 별도 우대 요건입니다 — ${youth.startupLawNote} · 동종 업종 판단 기준은 조특법과 다를 수 있습니다.`,
  }
}

// ===========================================================================
// 3) 지방세 기준 (취득세 / 재산세 / 등록면허세 참고)
// ===========================================================================
function buildLocalTax(
  acquisition: ItemResult | undefined,
  property: ItemResult | undefined,
  registrationNote: string | null,
): FrameworkResult {
  const points: SavingsPoint[] = []
  if (acquisition) {
    points.push({
      tone: verdictToTone(acquisition.verdict),
      text:
        acquisition.verdict === 'good'
          ? '취득세 감면 검토 가능'
          : acquisition.verdict === 'bad'
            ? '취득세 감면 어려움'
            : '취득세 감면 제한 검토 필요',
    })
  }
  if (property) {
    points.push({
      tone: verdictToTone(property.verdict),
      text:
        property.verdict === 'good'
          ? '재산세 감면 검토 가능'
          : property.verdict === 'bad'
            ? '재산세 감면 어려움'
            : '재산세 감면 제한 검토 필요',
    })
  }

  // 종합: 취득세·재산세 중 가장 보수적
  let v: Verdict = 'good'
  if (acquisition) v = worst(v, acquisition.verdict)
  if (property) v = worst(v, property.verdict)
  if (!acquisition && !property) v = 'conditional'

  const checkPoints = [
    '사업용으로 직접 사용하는 부동산인지(투자·임대 제외) 확인이 필요합니다.',
    '지방세특례제한법상 요건·적용기한을 관할 지자체에 확인하는 것이 안전합니다.',
  ]

  return {
    key: 'localTax',
    title: '지방세 기준 (참고)',
    subtitle: '취득세 / 재산세 / 등록면허세 — 지방세특례제한법',
    verdict: v,
    conclusion: CONCLUSION[v],
    points,
    risks: registrationNote ? [`등록면허세: ${registrationNote}`] : [],
    checkPoints,
    note: '지방세 감면은 취득 목적·시점·권역에 따라 달라지며, 등록면허세는 개정·일몰 확인이 필요합니다.',
  }
}

// ===========================================================================
// 통합
// ===========================================================================
export function buildFrameworks(
  form: FormData,
  allCore: ItemResult[],
  recognition: Verdict,
  youth: YouthStatus,
  registrationNote: string | null,
  lineage: Lineage,
): FrameworkResult[] {
  const income = allCore.find((i) => i.key === 'incomeTax')
  const acquisition = allCore.find((i) => i.key === 'acquisitionTax')
  const property = allCore.find((i) => i.key === 'propertyTax')

  return [
    buildTaxLaw(form, income, youth, lineage),
    buildStartupLaw(form, recognition, youth, lineage),
    buildLocalTax(acquisition, property, registrationNote),
  ]
}
