import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import {
  calculateEqualSplit,
  calculateExactSplitSum,
  calculatePercentageSplitAmounts,
  validateEqualSplit,
  validateExactSplit,
  validatePercentageSplit,
  validateItemizedSplit,
  buildExpensePayload,
} from '../lib/splitCalculations';
import {
  createExpense,
  confirmExpense,
  deleteExpense,
} from '../api';
import { GroupDetailPage } from '../GroupDetailPage';
import { useAuthStore } from '@/features/auth/store';
import { LanguageProvider } from '@/shared/providers/LanguageProvider';
import '@/shared/lib/i18n';
import type { Expense, Group, Balance } from '@/shared/types/api';

const mockGroup: Group = {
  id: 10,
  name: 'سفر کویر',
  description: 'هزینه‌های سفر کویر مرنجاب',
  budget_limit: 4000000,
  invite_code: 'KAVIR123',
  invite_code_expires_at: null,
  created_by: 1,
  owner: 1,
  created_at: '2026-08-01T10:00:00Z',
  memberships: [
    { id: 1, user: 1, user_phone: '09121111111', user_name: 'رضا', role: 'admin', joined_at: '2026-08-01' },
    { id: 2, user: 2, user_phone: '09122222222', user_name: 'علی', role: 'member', joined_at: '2026-08-01' },
  ],
  total_expenses: 2500000,
  remaining_budget: 1500000,
};

const mockBalances: Balance[] = [
  { phone_number: '09121111111', full_name: 'رضا', net: 200000 },
  { phone_number: '09122222222', full_name: 'علی', net: -200000 },
];

const mockExpenses: Expense[] = [
  {
    id: 201,
    group: 10,
    paid_by: 1,
    description: 'بنزین و عوارضی',
    total_amount: 500000,
    split_type: 'equal',
    is_confirmed: true,
    receipt_image: null,
    receipt_expiry_date: null,
    date: '2026-08-02T08:00:00Z',
    splits: [
      { user: 1, amount: 250000, settled: false },
      { user: 2, amount: 250000, settled: false },
    ],
    items: [],
  },
];

const API_BASE = '/api/v1/';

const server = setupServer(
  http.get(`${API_BASE}groups/10/`, () => HttpResponse.json(mockGroup)),
  http.get(`${API_BASE}groups/10/balances/`, () => HttpResponse.json(mockBalances)),
  http.get(`${API_BASE}groups/10/expenses/`, () => HttpResponse.json(mockExpenses)),
  http.get(`${API_BASE}groups/10/settlements/`, () => HttpResponse.json([])),
  http.get(`${API_BASE}groups/10/members/`, () => HttpResponse.json(mockGroup.memberships)),
  http.get(`${API_BASE}groups/10/activities/`, () => HttpResponse.json([])),

  http.post(`${API_BASE}groups/10/expenses/`, async ({ request }) => {
    const body = (await request.json()) as Partial<Expense>;
    const created: Expense = {
      id: 202,
      group: 10,
      paid_by: 1,
      description: body.description ?? '',
      total_amount: body.total_amount ?? 0,
      split_type: body.split_type ?? 'equal',
      is_confirmed: false,
      receipt_image: null,
      receipt_expiry_date: null,
      date: new Date().toISOString(),
      splits: body.splits ?? [],
      items: body.items ?? [],
    };
    return HttpResponse.json(created, { status: 201 });
  }),

  http.patch(`${API_BASE}groups/10/expenses/201/`, async ({ request }) => {
    const body = (await request.json()) as { is_confirmed?: boolean };
    return HttpResponse.json({ ...mockExpenses[0], is_confirmed: body.is_confirmed ?? true });
  }),

  http.delete(`${API_BASE}groups/10/expenses/201/`, () => {
    return new HttpResponse(null, { status: 204 });
  }),
);

function renderWithProviders(ui: React.ReactElement, initialRoute = '/groups/10') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <MemoryRouter initialEntries={[initialRoute]}>
          <Routes>
            <Route path="/groups/:groupId" element={ui} />
          </Routes>
        </MemoryRouter>
      </LanguageProvider>
    </QueryClientProvider>,
  );
}

describe('Phase 4: Expenses & Split Calculations', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => {
    server.resetHandlers();
    useAuthStore.getState().clear();
  });
  afterAll(() => server.close());

  describe('Split Calculation & Validation Functions', () => {
    it('calculates equal split correctly', () => {
      expect(calculateEqualSplit(1000000, 4)).toBe(250000);
      expect(calculateEqualSplit(100000, 3)).toBe(33333);
      expect(calculateEqualSplit(0, 3)).toBe(0);
    });

    it('validates equal split rules', () => {
      expect(validateEqualSplit(1000, [1, 2]).valid).toBe(true);
      expect(validateEqualSplit(0, [1, 2]).valid).toBe(false);
      expect(validateEqualSplit(1000, []).valid).toBe(false);
    });

    it('calculates and validates exact split', () => {
      const shares = [
        { user: 1, amount: 60000 },
        { user: 2, amount: 40000 },
      ];
      expect(calculateExactSplitSum(shares)).toBe(100000);

      const validResult = validateExactSplit(100000, shares);
      expect(validResult.valid).toBe(true);
      expect(validResult.difference).toBe(0);

      const invalidResult = validateExactSplit(120000, shares);
      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.difference).toBe(20000);
    });

    it('calculates and validates percentage split', () => {
      const shares = [
        { user: 1, percentage: 60 },
        { user: 2, percentage: 40 },
      ];
      const valid = validatePercentageSplit(shares);
      expect(valid.valid).toBe(true);
      expect(valid.difference).toBe(0);

      const amounts = calculatePercentageSplitAmounts(100000, shares);
      expect(amounts[0]?.amount).toBe(60000);
      expect(amounts[1]?.amount).toBe(40000);

      const invalid = validatePercentageSplit([{ user: 1, percentage: 80 }]);
      expect(invalid.valid).toBe(false);
      expect(invalid.difference).toBe(20);
    });

    it('validates itemized split', () => {
      const validItems = [
        {
          name: 'پیتزا',
          total_amount: 200000,
          shares: [
            { user: 1, amount: 100000 },
            { user: 2, amount: 100000 },
          ],
        },
      ];
      const res = validateItemizedSplit(validItems);
      expect(res.valid).toBe(true);
      expect(res.totalExpense).toBe(200000);

      const invalidItems = [
        {
          name: 'نوشابه',
          total_amount: 50000,
          shares: [{ user: 1, amount: 30000 }],
        },
      ];
      const invalidRes = validateItemizedSplit(invalidItems);
      expect(invalidRes.valid).toBe(false);
      expect(invalidRes.itemErrors[0]).toContain('shares_mismatch');
    });

    it('builds correct payloads matching backend contract', () => {
      // Equal payload
      const equalPayload = buildExpensePayload({
        description: 'شام',
        total_amount: 100000,
        split_type: 'equal',
        selectedUserIds: [1, 2],
        exactShares: [],
        percentageShares: [],
        itemizedItems: [],
      });
      expect(equalPayload.split_type).toBe('equal');
      expect(equalPayload.splits).toEqual([{ user: 1 }, { user: 2 }]);

      // Exact payload
      const exactPayload = buildExpensePayload({
        description: 'خرید میوه',
        total_amount: 80000,
        split_type: 'exact',
        selectedUserIds: [1, 2],
        exactShares: [
          { user: 1, amount: 50000 },
          { user: 2, amount: 30000 },
        ],
        percentageShares: [],
        itemizedItems: [],
      });
      expect(exactPayload.split_type).toBe('exact');
      expect(exactPayload.total_amount).toBe(80000);
      expect(exactPayload.splits).toEqual([
        { user: 1, amount: 50000 },
        { user: 2, amount: 30000 },
      ]);

      // Percentage payload
      const pctPayload = buildExpensePayload({
        description: 'بنزین',
        total_amount: 50000,
        split_type: 'percentage',
        selectedUserIds: [1, 2],
        exactShares: [],
        percentageShares: [
          { user: 1, percentage: 70 },
          { user: 2, percentage: 30 },
        ],
        itemizedItems: [],
      });
      expect(pctPayload.split_type).toBe('percentage');
      expect(pctPayload.splits).toEqual([
        { user: 1, percentage: 70 },
        { user: 2, percentage: 30 },
      ]);

      // Itemized payload
      const itemPayload = buildExpensePayload({
        description: 'رستوران',
        total_amount: 0,
        split_type: 'itemized',
        selectedUserIds: [],
        exactShares: [],
        percentageShares: [],
        itemizedItems: [
          {
            name: 'کباب',
            total_amount: 150000,
            shares: [{ user: 1, amount: 150000 }],
          },
        ],
      });
      expect(itemPayload.split_type).toBe('itemized');
      expect(itemPayload.total_amount).toBe(150000);
      expect(itemPayload.items?.[0]?.name).toBe('کباب');
    });
  });

  describe('Expenses API Operations', () => {
    it('creates all 4 split types against API', async () => {
      // 1. Equal
      const eq = await createExpense(10, {
        description: 'تست مساوی',
        total_amount: 100000,
        split_type: 'equal',
        splits: [{ user: 1 }, { user: 2 }],
      });
      expect(eq.id).toBe(202);
      expect(eq.split_type).toBe('equal');

      // 2. Exact
      const ex = await createExpense(10, {
        description: 'تست دقیق',
        total_amount: 90000,
        split_type: 'exact',
        splits: [
          { user: 1, amount: 50000 },
          { user: 2, amount: 40000 },
        ],
      });
      expect(ex.split_type).toBe('exact');

      // 3. Percentage
      const pct = await createExpense(10, {
        description: 'تست درصدی',
        total_amount: 200000,
        split_type: 'percentage',
        splits: [
          { user: 1, percentage: 60 },
          { user: 2, percentage: 40 },
        ],
      });
      expect(pct.split_type).toBe('percentage');

      // 4. Itemized
      const itm = await createExpense(10, {
        description: 'تست آیتمی',
        total_amount: 120000,
        split_type: 'itemized',
        items: [
          {
            name: 'سالاد',
            total_amount: 120000,
            shares: [{ user: 1, amount: 120000 }],
          },
        ],
      });
      expect(itm.split_type).toBe('itemized');
    });

    it('confirms and deletes expenses', async () => {
      const confirmed = await confirmExpense(10, 201);
      expect(confirmed.is_confirmed).toBe(true);

      await expect(deleteExpense(10, 201)).resolves.toBeUndefined();
    });
  });

  describe('Group Detail & Expenses UI', () => {
    it('renders group detail with budget bar and expenses tab', async () => {
      useAuthStore.getState().setUser({
        id: 1,
        phone_number: '09121111111',
        full_name: 'رضا',
        email: null,
        language: 'fa',
        avatar: null,
        date_joined: '2026-01-01',
      });
      useAuthStore.getState().setTokens('mock-acc', 'mock-ref');

      renderWithProviders(<GroupDetailPage />);

      // Verify group name
      expect(await screen.findByText('سفر کویر')).toBeInTheDocument();

      // Verify expense item appears in expenses tab
      expect(await screen.findByText('بنزین و عوارضی')).toBeInTheDocument();
    });
  });
});
