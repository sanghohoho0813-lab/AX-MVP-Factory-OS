/**
 * 매출 · 비용 저장 (D-142) — 모듈 기록 `finance/subscriptions` · `finance/expenses` · `finance/settings`.
 * 매출은 저장하지 않는다(계약 수금 항목에서 매번 계산 — 두 벌이 되지 않게).
 * 카드번호 · 계좌번호 칸은 없다. 결제 수단은 '법인카드' 같은 구분만.
 */
import { generateId } from '../../storage/localStore'
import { nowIso } from '../../lib/appClock'
import { deleteRow, listRows, saveRow } from '../moduleData'
import { DEFAULT_SETTINGS, normalizeExpense, normalizeSettings, normalizeSubscription, type Expense, type FinanceSettings, type Subscription } from './financeCore'

const MODULE = 'finance'

export async function listSubscriptions(workspaceId: string | null): Promise<Subscription[]> {
  const rows = await listRows(workspaceId, MODULE, 'subscriptions')
  return rows.map((r) => normalizeSubscription({ ...r.data, createdAt: r.createdAt, updatedAt: r.updatedAt }, r.id, r.updatedAt)).filter((s): s is Subscription => s !== null)
}

export async function saveSubscription(workspaceId: string | null, input: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'> & { id?: string; createdAt?: string }): Promise<Subscription> {
  const id = input.id ?? `sub_${generateId()}`
  const now = nowIso()
  const clean = normalizeSubscription({ ...input, createdAt: input.createdAt ?? now, updatedAt: now }, id, now)
  if (!clean) throw new Error('이름을 적어 주세요.')
  if (!(clean.amount > 0)) throw new Error('금액을 적어 주세요.')
  const { id: _i, ...data } = clean
  void _i
  await saveRow(workspaceId, MODULE, 'subscriptions', { id, data: data as unknown as Record<string, unknown> })
  return clean
}

export async function removeSubscription(workspaceId: string | null, id: string): Promise<void> {
  await deleteRow(workspaceId, MODULE, 'subscriptions', id)
}

export async function listExpenses(workspaceId: string | null): Promise<Expense[]> {
  const rows = await listRows(workspaceId, MODULE, 'expenses')
  return rows
    .map((r) => normalizeExpense({ ...r.data, createdAt: r.createdAt, updatedAt: r.updatedAt }, r.id, r.updatedAt))
    .filter((e): e is Expense => e !== null)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
}

export async function saveExpense(workspaceId: string | null, input: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'> & { id?: string; createdAt?: string }): Promise<Expense> {
  const id = input.id ?? `exp_${generateId()}`
  const now = nowIso()
  const clean = normalizeExpense({ ...input, createdAt: input.createdAt ?? now, updatedAt: now }, id, now)
  if (!clean) throw new Error('금액과 날짜를 확인해 주세요.')
  const { id: _i, ...data } = clean
  void _i
  await saveRow(workspaceId, MODULE, 'expenses', { id, clientId: clean.clientId || undefined, data: data as unknown as Record<string, unknown> })
  return clean
}

export async function removeExpense(workspaceId: string | null, id: string): Promise<void> {
  await deleteRow(workspaceId, MODULE, 'expenses', id)
}

export async function loadSettings(workspaceId: string | null): Promise<FinanceSettings> {
  const rows = await listRows(workspaceId, MODULE, 'settings')
  return rows[0] ? normalizeSettings(rows[0].data) : DEFAULT_SETTINGS
}

export async function saveSettings(workspaceId: string | null, s: FinanceSettings): Promise<FinanceSettings> {
  const clean = normalizeSettings(s)
  await saveRow(workspaceId, MODULE, 'settings', { id: 'finance_settings', data: clean as unknown as Record<string, unknown> })
  return clean
}
