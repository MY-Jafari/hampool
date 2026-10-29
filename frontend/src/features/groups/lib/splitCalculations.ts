import type { SplitType } from '@/shared/types/api';

export interface ExactShare {
  user: number;
  amount: number;
}

export interface PercentageShare {
  user: number;
  percentage: number;
}

export interface ItemShare {
  user: number;
  amount: number;
}

export interface ItemizedItem {
  name: string;
  total_amount: number;
  shares: ItemShare[];
}

/**
 * Calculates per-person equal share amount in Tomans.
 */
export function calculateEqualSplit(totalAmount: number, memberCount: number): number {
  if (memberCount <= 0 || totalAmount <= 0) return 0;
  return Math.floor(totalAmount / memberCount);
}

/**
 * Validates Equal split parameters.
 */
export function validateEqualSplit(
  totalAmount: number,
  memberIds: number[],
): { valid: boolean; error?: string } {
  if (!totalAmount || totalAmount <= 0) {
    return { valid: false, error: 'total_amount_required' };
  }
  if (!memberIds || memberIds.length === 0) {
    return { valid: false, error: 'members_required' };
  }
  return { valid: true };
}

/**
 * Sums the amounts in an Exact split.
 */
export function calculateExactSplitSum(shares: ExactShare[]): number {
  return shares.reduce((acc, s) => acc + (Number(s.amount) || 0), 0);
}

/**
 * Validates Exact split: shares must sum to totalAmount.
 */
export function validateExactSplit(
  totalAmount: number,
  shares: ExactShare[],
): { valid: boolean; difference: number; error?: string } {
  if (shares.length === 0) {
    return { valid: false, difference: totalAmount, error: 'members_required' };
  }
  const sum = calculateExactSplitSum(shares);
  const diff = totalAmount - sum;
  if (diff !== 0) {
    return { valid: false, difference: diff, error: 'exact_mismatch' };
  }
  return { valid: true, difference: 0 };
}

/**
 * Calculates per-person amount from percentage.
 */
export function calculatePercentageSplitAmounts(
  totalAmount: number,
  shares: PercentageShare[],
): { user: number; amount: number }[] {
  return shares.map((s) => ({
    user: s.user,
    amount: Math.round((totalAmount * (s.percentage || 0)) / 100),
  }));
}

/**
 * Validates Percentage split: percentages must sum to 100.
 */
export function validatePercentageSplit(
  shares: PercentageShare[],
): { valid: boolean; totalPercentage: number; difference: number; error?: string } {
  if (shares.length === 0) {
    return { valid: false, totalPercentage: 0, difference: 100, error: 'members_required' };
  }
  const totalPercentage = shares.reduce((acc, s) => acc + (Number(s.percentage) || 0), 0);
  const diff = Number((100 - totalPercentage).toFixed(2));
  if (Math.abs(diff) > 0.01) {
    return { valid: false, totalPercentage, difference: diff, error: 'percentage_mismatch' };
  }
  return { valid: true, totalPercentage: 100, difference: 0 };
}

/**
 * Validates Itemized split:
 * - At least one item with a valid name and amount.
 * - For each item, sum of member shares must match item total amount.
 */
export function validateItemizedSplit(
  items: ItemizedItem[],
): { valid: boolean; totalExpense: number; itemErrors: Record<number, string>; error?: string } {
  if (items.length === 0) {
    return { valid: false, totalExpense: 0, itemErrors: {}, error: 'items_required' };
  }

  let totalExpense = 0;
  const itemErrors: Record<number, string> = {};
  let isValid = true;

  items.forEach((item, index) => {
    if (!item.name.trim()) {
      itemErrors[index] = 'item_name_required';
      isValid = false;
      return;
    }
    if (item.total_amount <= 0) {
      itemErrors[index] = 'item_amount_required';
      isValid = false;
      return;
    }
    totalExpense += item.total_amount;

    if (!item.shares || item.shares.length === 0) {
      itemErrors[index] = 'shares_required';
      isValid = false;
      return;
    }

    const sharesSum = item.shares.reduce((acc, s) => acc + (Number(s.amount) || 0), 0);
    if (sharesSum !== item.total_amount) {
      itemErrors[index] = `shares_mismatch:${item.total_amount - sharesSum}`;
      isValid = false;
    }
  });

  return {
    valid: isValid,
    totalExpense,
    itemErrors,
    error: isValid ? undefined : 'item_validation_failed',
  };
}

/**
 * Formats the backend payload for any of the 4 split types according to ANALYSIS.md.
 */
export function buildExpensePayload(data: {
  description: string;
  total_amount: number;
  split_type: SplitType;
  selectedUserIds: number[];
  exactShares: ExactShare[];
  percentageShares: PercentageShare[];
  itemizedItems: ItemizedItem[];
}) {
  const {
    description,
    total_amount,
    split_type,
    selectedUserIds,
    exactShares,
    percentageShares,
    itemizedItems,
  } = data;

  if (split_type === 'equal') {
    return {
      description,
      total_amount,
      split_type: 'equal' as const,
      splits: selectedUserIds.map((userId) => ({ user: userId })),
    };
  }

  if (split_type === 'exact') {
    const validShares = exactShares.filter((s) => s.user && s.amount > 0);
    const sum = calculateExactSplitSum(validShares);
    return {
      description,
      total_amount: sum,
      split_type: 'exact' as const,
      splits: validShares.map((s) => ({ user: s.user, amount: s.amount })),
    };
  }

  if (split_type === 'percentage') {
    const validShares = percentageShares.filter((s) => s.user && s.percentage > 0);
    return {
      description,
      total_amount,
      split_type: 'percentage' as const,
      splits: validShares.map((s) => ({ user: s.user, percentage: s.percentage })),
    };
  }

  // itemized
  const totalItemized = itemizedItems.reduce((acc, it) => acc + (it.total_amount || 0), 0);
  return {
    description,
    total_amount: totalItemized,
    split_type: 'itemized' as const,
    items: itemizedItems.map((item) => ({
      name: item.name.trim(),
      total_amount: item.total_amount,
      shares: item.shares
        .filter((s) => s.user && s.amount > 0)
        .map((s) => ({ user: s.user, amount: s.amount })),
    })),
  };
}
