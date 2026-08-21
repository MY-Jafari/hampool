import { api } from '@/shared/lib/api';
import type {
  Activity,
  AiNameSuggestions,
  Balance,
  Expense,
  ExpenseInput,
  Group,
  GroupInput,
  Membership,
  OptimizeResult,
  Settlement,
  SettlementSuggestion,
} from '@/shared/types/api';

// ── Groups ────────────────────────────────────────────────────────

export async function listGroups(): Promise<Group[]> {
  const { data } = await api.get<Group[]>('groups/');
  return data;
}

export async function createGroup(input: GroupInput): Promise<Group> {
  const { data } = await api.post<Group>('groups/', input);
  return data;
}

export async function getGroup(id: number): Promise<Group> {
  const { data } = await api.get<Group>(`groups/${id}/`);
  return data;
}

export async function updateGroup(id: number, input: Partial<GroupInput>): Promise<Group> {
  const { data } = await api.patch<Group>(`groups/${id}/`, input);
  return data;
}

export async function deleteGroup(id: number): Promise<void> {
  await api.delete(`groups/${id}/`);
}

export async function joinGroup(invite_code: string): Promise<void> {
  await api.post('groups/join/', { invite_code });
}

// ── Members ───────────────────────────────────────────────────────

export async function listMembers(groupId: number): Promise<Membership[]> {
  const { data } = await api.get<Membership[]>(`groups/${groupId}/members/`);
  return data;
}

export async function addMember(groupId: number, phone_number: string): Promise<Membership> {
  const { data } = await api.post<Membership>(`groups/${groupId}/members/add/`, { phone_number });
  return data;
}

export async function removeMember(groupId: number, userId: number): Promise<void> {
  await api.delete(`groups/${groupId}/members/${userId}/remove/`);
}

export async function changeRole(groupId: number, userId: number, role: 'admin' | 'member'): Promise<Membership> {
  const { data } = await api.patch<Membership>(`groups/${groupId}/members/${userId}/role/`, { role });
  return data;
}

export async function generateInvite(groupId: number): Promise<{ invite_code: string; expires_at: string | null }> {
  const { data } = await api.post<{ invite_code: string; expires_at: string | null }>(
    `groups/${groupId}/invite/`,
  );
  return data;
}

/** Fetch the QR invite image as a blob URL (the endpoint requires auth). */
export async function getGroupQrUrl(groupId: number): Promise<string> {
  const { data } = await api.get<Blob>(`groups/${groupId}/qr-code/`, { responseType: 'blob' });
  return URL.createObjectURL(data);
}

// ── Balances / activities / report ────────────────────────────────

export async function getBalances(groupId: number): Promise<Balance[]> {
  const { data } = await api.get<Balance[]>(`groups/${groupId}/balances/`);
  return data;
}

export async function listActivities(groupId: number): Promise<Activity[]> {
  const { data } = await api.get<Activity[]>(`groups/${groupId}/activities/`);
  return data;
}

export async function requestReport(groupId: number): Promise<void> {
  await api.post(`groups/${groupId}/report/`);
}

// ── Expenses ──────────────────────────────────────────────────────

export async function listExpenses(groupId: number): Promise<Expense[]> {
  const { data } = await api.get<Expense[]>(`groups/${groupId}/expenses/`);
  return data;
}

export async function createExpense(groupId: number, input: ExpenseInput): Promise<Expense> {
  const { data } = await api.post<Expense>(`groups/${groupId}/expenses/`, input);
  return data;
}

export async function confirmExpense(groupId: number, expenseId: number): Promise<Expense> {
  const { data } = await api.patch<Expense>(`groups/${groupId}/expenses/${expenseId}/`, {
    is_confirmed: true,
  });
  return data;
}

export async function deleteExpense(groupId: number, expenseId: number): Promise<void> {
  await api.delete(`groups/${groupId}/expenses/${expenseId}/`);
}

// ── Settlements ───────────────────────────────────────────────────

export async function listSettlements(groupId: number): Promise<Settlement[]> {
  const { data } = await api.get<Settlement[]>(`groups/${groupId}/settlements/`);
  return data;
}

export async function createSettlement(
  groupId: number,
  input: { to_user_id: number; amount: number },
): Promise<Settlement> {
  const { data } = await api.post<Settlement>(`groups/${groupId}/settlements/`, input);
  return data;
}

export async function confirmSettlement(groupId: number, settlementId: number): Promise<Settlement> {
  const { data } = await api.post<Settlement>(`groups/${groupId}/settlements/${settlementId}/confirm/`);
  return data;
}

export async function reverseSettlement(groupId: number, settlementId: number): Promise<Settlement> {
  const { data } = await api.post<Settlement>(`groups/${groupId}/settlements/${settlementId}/reverse/`);
  return data;
}

export async function optimizeSettlements(groupId: number): Promise<OptimizeResult> {
  const { data } = await api.get<OptimizeResult>(`groups/${groupId}/optimize-settlements/`);
  return data;
}

export async function applyOptimizedSettlements(
  groupId: number,
  payload: { balance_version: string; suggestions: SettlementSuggestion[] },
): Promise<Settlement[]> {
  const { data } = await api.post<Settlement[]>(`groups/${groupId}/settlements/apply-optimization/`, payload);
  return data;
}

// ── AI ────────────────────────────────────────────────────────────

export async function suggestGroupName(groupId: number): Promise<AiNameSuggestions> {
  const { data } = await api.post<AiNameSuggestions>(`groups/${groupId}/suggest-name/`);
  return data;
}
