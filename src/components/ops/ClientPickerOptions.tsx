/**
 * 업체 고르는 칸의 <option> 들 (D-168) — 개인사업자 → 법인 묶음, 묶음 안 가나다 순.
 * 묶음이 하나뿐이면 묶음 이름 없이 그대로 늘어놓는다.
 */
import { pickerGroups, type OrderableClient } from '../../services/clientOrder'

export function ClientPickerOptions({ clients }: { clients: readonly (OrderableClient & { id: string })[] }) {
  const groups = pickerGroups(clients)
  if (groups.length <= 1) {
    return (
      <>
        {(groups[0]?.items ?? []).map((c) => (
          <option key={c.id} value={c.id}>
            {c.companyName}
          </option>
        ))}
      </>
    )
  }
  return (
    <>
      {groups.map((g) => (
        <optgroup key={g.kind} label={`${g.label} ${g.items.length}`}>
          {g.items.map((c) => (
            <option key={c.id} value={c.id}>
              {c.companyName}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  )
}
