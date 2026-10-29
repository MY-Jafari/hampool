import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { listGroups, createGroup, joinGroup, getBalances, listExpenses } from '../api';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { GroupsPage } from '../GroupsPage';
import { useAuthStore } from '@/features/auth/store';
import { LanguageProvider } from '@/shared/providers/LanguageProvider';
import '@/shared/lib/i18n';
import type { Group, Balance, Expense } from '@/shared/types/api';

const mockGroups: Group[] = [
  {
    id: 1,
    name: 'سفر شمال',
    description: 'هزینه‌های سفر شمال تابستان',
    budget_limit: 5000000,
    invite_code: 'SHOMAL12',
    invite_code_expires_at: null,
    created_by: 1,
    owner: 1,
    created_at: '2026-08-01T10:00:00Z',
    memberships: [
      { id: 1, user: 1, user_phone: '09121111111', user_name: 'کاربر یک', role: 'admin', joined_at: '2026-08-01' },
      { id: 2, user: 2, user_phone: '09122222222', user_name: 'کاربر دو', role: 'member', joined_at: '2026-08-01' },
    ],
    total_expenses: 3200000,
    remaining_budget: 1800000,
  },
  {
    id: 2,
    name: 'خونه دانشجویی',
    description: 'قبوض و اجاره',
    budget_limit: 0,
    invite_code: 'KHANEH34',
    invite_code_expires_at: null,
    created_by: 2,
    owner: 2,
    created_at: '2026-08-05T12:00:00Z',
    memberships: [
      { id: 3, user: 1, user_phone: '09121111111', user_name: 'کاربر یک', role: 'member', joined_at: '2026-08-05' },
    ],
    total_expenses: 850000,
    remaining_budget: null,
  },
];

const mockBalances: Balance[] = [
  { phone_number: '09121111111', full_name: 'کاربر یک', net: 150000 },
  { phone_number: '09122222222', full_name: 'کاربر دو', net: -150000 },
];

const mockExpenses: Expense[] = [
  {
    id: 101,
    group: 1,
    paid_by: 1,
    description: 'هزینه اقامت هتل',
    total_amount: 2000000,
    split_type: 'equal',
    is_confirmed: true,
    receipt_image: null,
    receipt_expiry_date: null,
    date: '2026-08-10T14:30:00Z',
    splits: [],
    items: [],
  },
];

const API_BASE = '/api/v1/';

const server = setupServer(
  http.get(`${API_BASE}groups/`, () => {
    return HttpResponse.json(mockGroups);
  }),

  http.post(`${API_BASE}groups/`, async ({ request }) => {
    const body = (await request.json()) as { name: string; description?: string; budget_limit?: number };
    const created: Group = {
      id: 3,
      name: body.name,
      description: body.description ?? '',
      budget_limit: body.budget_limit ?? 0,
      invite_code: 'NEWGRP99',
      invite_code_expires_at: null,
      created_by: 1,
      owner: 1,
      created_at: new Date().toISOString(),
      memberships: [
        { id: 4, user: 1, user_phone: '09121111111', user_name: 'کاربر یک', role: 'admin', joined_at: '2026-08-15' },
      ],
      total_expenses: 0,
      remaining_budget: body.budget_limit ?? null,
    };
    return HttpResponse.json(created, { status: 201 });
  }),

  http.post(`${API_BASE}groups/join/`, async ({ request }) => {
    const body = (await request.json()) as { invite_code: string };
    if (body.invite_code === 'SHOMAL12' || body.invite_code === 'VALID123') {
      return HttpResponse.json({ detail: 'Successfully joined the group.' }, { status: 201 });
    }
    return HttpResponse.json({ error: 'Invalid or expired invite code.' }, { status: 400 });
  }),

  http.get(`${API_BASE}groups/:id/balances/`, () => {
    return HttpResponse.json(mockBalances);
  }),

  http.get(`${API_BASE}groups/:id/expenses/`, ({ params }) => {
    if (String(params.id) === '1') {
      return HttpResponse.json(mockExpenses);
    }
    return HttpResponse.json([]);
  }),
);

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <MemoryRouter>{ui}</MemoryRouter>
      </LanguageProvider>
    </QueryClientProvider>,
  );
}

describe('Groups & Dashboard Feature', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => {
    server.resetHandlers();
    useAuthStore.getState().clear();
  });
  afterAll(() => server.close());

  describe('API Layer', () => {
    it('lists groups correctly', async () => {
      const groups = await listGroups();
      expect(groups).toHaveLength(2);
      expect(groups[0]?.name).toBe('سفر شمال');
      expect(groups[1]?.budget_limit).toBe(0);
    });

    it('creates a new group', async () => {
      const created = await createGroup({
        name: 'گروه جدید آزمایشی',
        description: 'تست ای‌پی‌آی',
        budget_limit: 1000000,
      });
      expect(created.id).toBe(3);
      expect(created.name).toBe('گروه جدید آزمایشی');
      expect(created.invite_code).toBe('NEWGRP99');
    });

    it('joins a group via invite code', async () => {
      await expect(joinGroup('VALID123')).resolves.toBeUndefined();
    });

    it('fetches group balances and expenses', async () => {
      const balances = await getBalances(1);
      expect(balances).toHaveLength(2);
      expect(balances[0]?.net).toBe(150000);

      const expenses = await listExpenses(1);
      expect(expenses).toHaveLength(1);
      expect(expenses[0]?.description).toBe('هزینه اقامت هتل');
    });
  });

  describe('Dashboard UI', () => {
    it('renders dashboard with financial stats and groups overview', async () => {
      useAuthStore.getState().setUser({
        id: 1,
        phone_number: '09121111111',
        full_name: 'کاربر یک',
        email: null,
        language: 'fa',
        avatar: null,
        date_joined: '2026-01-01',
      });
      useAuthStore.getState().setTokens('mock-acc', 'mock-ref');

      renderWithProviders(<DashboardPage />);

      // Verify dashboard header
      expect(await screen.findByText(/داشبورد|Dashboard/)).toBeInTheDocument();

      // Verify groups rendered
      expect(await screen.findByText('سفر شمال')).toBeInTheDocument();
      expect(screen.getByText('خونه دانشجویی')).toBeInTheDocument();

      // Verify recent expense rendered
      expect(await screen.findByText('هزینه اقامت هتل')).toBeInTheDocument();
    });
  });

  describe('Groups Page UI', () => {
    it('renders groups list and filters by search query', async () => {
      const user = userEvent.setup();
      renderWithProviders(<GroupsPage />);

      // Groups appear
      expect(await screen.findByText('سفر شمال')).toBeInTheDocument();
      expect(screen.getByText('خونه دانشجویی')).toBeInTheDocument();

      // Search input filters
      const searchInput = screen.getByPlaceholderText(/search|جستجو/i);
      await user.type(searchInput, 'شمال');

      expect(screen.getByText('سفر شمال')).toBeInTheDocument();
      expect(screen.queryByText('خونه دانشجویی')).not.toBeInTheDocument();

      // Clearing search restores all
      await user.clear(searchInput);
      expect(screen.getByText('خونه دانشجویی')).toBeInTheDocument();
    });
  });
});
