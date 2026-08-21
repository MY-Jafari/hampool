export interface User {
  id: number;
  phone_number: string;
  email: string | null;
  full_name: string;
  language: 'fa' | 'en';
  avatar: string | null;
  date_joined: string;
}

export interface LoginResponse {
  access: string;
  refresh: string;
}

export interface RegisterResponse {
  detail: string;
  temp_token: string;
}

export interface Membership {
  id: number;
  user: number;
  user_phone: string;
  user_name: string;
  role: 'admin' | 'member';
  joined_at: string;
}

export interface Group {
  id: number;
  name: string;
  description: string;
  budget_limit: number;
  invite_code: string | null;
  invite_code_expires_at: string | null;
  created_by: number;
  owner: number;
  created_at: string;
  memberships: Membership[];
  total_expenses: number;
  remaining_budget: number | null;
}

export interface GroupInput {
  name: string;
  description?: string;
  budget_limit?: number;
}

export interface ExpenseSplit {
  user: number;
  amount?: number;
  percentage?: number;
  settled: boolean;
}

export interface ExpenseItemShare {
  user: number;
  amount: number;
  is_confirmed: boolean;
}

export interface ExpenseItem {
  name: string;
  total_amount: number;
  shares: ExpenseItemShare[];
}

export type SplitType = 'equal' | 'exact' | 'percentage' | 'itemized';

export interface Expense {
  id: number;
  group: number;
  paid_by: number;
  description: string;
  total_amount: number;
  split_type: SplitType;
  is_confirmed: boolean;
  receipt_image: string | null;
  receipt_expiry_date: string | null;
  date: string;
  splits: ExpenseSplit[];
  items: ExpenseItem[];
}

export interface ExpenseInput {
  description: string;
  total_amount: number;
  split_type: SplitType;
  splits?: { user: number; amount?: number; percentage?: number }[];
  items?: { name: string; total_amount: number; shares: { user: number; amount: number }[] }[];
}

export type SettlementStatus = 'pending' | 'confirmed' | 'reversed';

export interface Settlement {
  id: number;
  group: number;
  from_user: number;
  from_user_phone: string;
  to_user: number;
  to_user_phone: string;
  amount: number;
  status: SettlementStatus;
  reversed_by: number | null;
  created_by: number;
  confirmed_by: number | null;
  created_at: string;
  confirmed_at: string | null;
}

export interface Balance {
  phone_number: string;
  full_name: string;
  net: number;
}

export interface Activity {
  id: number;
  user: number;
  user_phone: string;
  action: string;
  description: string;
  timestamp: string;
}

export interface SettlementSuggestion {
  from_user_id: number;
  to_user_id: number;
  amount: number;
}

export interface OptimizeResult {
  balance_version: string;
  suggestions: SettlementSuggestion[];
}

export interface AiNameSuggestions {
  persian: string[];
  english: string[];
}

export interface GroupStateEvent {
  type: 'group_state_changed';
  group_id: number;
  event_type: string;
  params: Record<string, unknown>;
  ts: string;
}
