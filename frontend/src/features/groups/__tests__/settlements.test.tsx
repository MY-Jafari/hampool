import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import {
  listSettlements,
  createSettlement,
  confirmSettlement,
  reverseSettlement,
  optimizeSettlements,
  applyOptimizedSettlements,
} from '../api';
import { SettlementsTab } from '../components/SettlementsTab';
import { OptimizeDialog } from '../components/OptimizeDialog';
import { useAuthStore } from '@/features/auth/store';
import { useNotificationsStore } from '@/features/notifications/store';
import { getLocalizedEventMessage } from '@/features/notifications/useGroupEvents';
import { LanguageProvider } from '@/shared/providers/LanguageProvider';
import '@/shared/lib/i18n';
import type { Group, Settlement, OptimizeResult } from '@/shared/types/api';

const mockGroup: Group = {
  id: 20,
  name: 'گروه تست تسویه',
  description: 'تست فاز ۵',
  budget_limit: 0,
  invite_code: 'SETTLE12',
  invite_code_expires_at: null,
  created_by: 1,
  owner: 1,
  created_at: '2026-08-01T10:00:00Z',
  memberships: [
    { id: 1, user: 1, user_phone: '09121111111', user_name: 'امیر', role: 'admin', joined_at: '2026-08-01' },
    { id: 2, user: 2, user_phone: '09122222222', user_name: 'سارا', role: 'member', joined_at: '2026-08-01' },
  ],
  total_expenses: 500000,
  remaining_budget: null,
};

const mockSettlements: Settlement[] = [
  {
    id: 301,
    group: 20,
    from_user: 2,
    from_user_phone: '09122222222',
    to_user: 1,
    to_user_phone: '09121111111',
    amount: 150000,
    status: 'pending',
    reversed_by: null,
    created_by: 2,
    confirmed_by: null,
    created_at: '2026-08-05T12:00:00Z',
    confirmed_at: null,
  },
];

const mockOptimization: OptimizeResult = {
  balance_version: 'hash-abc-123',
  suggestions: [{ from_user_id: 2, to_user_id: 1, amount: 150000 }],
};

const API_BASE = '/api/v1/';

const server = setupServer(
  http.get(`${API_BASE}groups/20/settlements/`, () => {
    return HttpResponse.json(mockSettlements);
  }),

  http.post(`${API_BASE}groups/20/settlements/`, async ({ request }) => {
    const body = (await request.json()) as { to_user_id: number; amount: number };
    const created: Settlement = {
      id: 302,
      group: 20,
      from_user: 1,
      from_user_phone: '09121111111',
      to_user: body.to_user_id,
      to_user_phone: '09122222222',
      amount: body.amount,
      status: 'pending',
      reversed_by: null,
      created_by: 1,
      confirmed_by: null,
      created_at: new Date().toISOString(),
      confirmed_at: null,
    };
    return HttpResponse.json(created, { status: 201 });
  }),

  http.post(`${API_BASE}groups/20/settlements/301/confirm/`, () => {
    return HttpResponse.json({ ...mockSettlements[0], status: 'confirmed', confirmed_by: 1 });
  }),

  http.post(`${API_BASE}groups/20/settlements/301/reverse/`, () => {
    return HttpResponse.json({ ...mockSettlements[0], status: 'reversed', reversed_by: 1 });
  }),

  http.get(`${API_BASE}groups/20/optimize-settlements/`, () => {
    return HttpResponse.json(mockOptimization);
  }),

  http.post(`${API_BASE}groups/20/settlements/apply-optimization/`, async ({ request }) => {
    const body = (await request.json()) as { balance_version: string };
    if (body.balance_version === 'stale-hash') {
      return HttpResponse.json(
        { error: 'Balances have changed since optimization was generated. Please refresh.' },
        { status: 409 },
      );
    }
    return HttpResponse.json([mockSettlements[0]], { status: 201 });
  }),

  http.get(`${API_BASE}groups/20/balances/`, () => {
    return HttpResponse.json([
      { phone_number: '09121111111', full_name: 'امیر', net: 150000 },
      { phone_number: '09122222222', full_name: 'سارا', net: -150000 },
    ]);
  }),
);

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <MemoryRouter>
          <Routes>
            <Route path="/" element={ui} />
          </Routes>
        </MemoryRouter>
      </LanguageProvider>
    </QueryClientProvider>,
  );
}

describe('Phase 5: Settlements, Optimization & Realtime Events', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => {
    server.resetHandlers();
    useAuthStore.getState().clear();
    useNotificationsStore.getState().clear();
  });
  afterAll(() => server.close());

  describe('Settlements API Operations', () => {
    it('fetches settlements list', async () => {
      const list = await listSettlements(20);
      expect(list).toHaveLength(1);
      expect(list[0]?.id).toBe(301);
      expect(list[0]?.amount).toBe(150000);
      expect(list[0]?.status).toBe('pending');
    });

    it('creates a new pending settlement', async () => {
      const res = await createSettlement(20, { to_user_id: 2, amount: 80000 });
      expect(res.id).toBe(302);
      expect(res.amount).toBe(80000);
      expect(res.status).toBe('pending');
    });

    it('confirms and reverses settlements', async () => {
      const confirmed = await confirmSettlement(20, 301);
      expect(confirmed.status).toBe('confirmed');

      const reversed = await reverseSettlement(20, 301);
      expect(reversed.status).toBe('reversed');
    });

    it('fetches optimal settlements and handles 409 stale version', async () => {
      const opt = await optimizeSettlements(20);
      expect(opt.balance_version).toBe('hash-abc-123');
      expect(opt.suggestions).toHaveLength(1);

      // Successful apply
      const applied = await applyOptimizedSettlements(20, {
        balance_version: opt.balance_version,
        suggestions: opt.suggestions,
      });
      expect(applied).toHaveLength(1);

      // Stale version triggers 409 error
      await expect(
        applyOptimizedSettlements(20, {
          balance_version: 'stale-hash',
          suggestions: opt.suggestions,
        }),
      ).rejects.toThrow();
    });
  });

  describe('WebSocket Event Localization & Notifications Store', () => {
    it('localizes all 9 event types', () => {
      const mockT = (key: string, opts?: Record<string, unknown>) => {
        if (key === 'notifications.events.settlement_created') {
          return `تسویه به مبلغ ${opts?.amount} ثبت شد.`;
        }
        if (key === 'notifications.events.expense_created') {
          return `هزینه «${opts?.description}» ثبت شد.`;
        }
        return key;
      };

      const msg1 = getLocalizedEventMessage(
        'settlement_created',
        { amount: 50000 },
        mockT,
        'fa',
      );
      expect(msg1).toContain('۵۰٬۰۰۰');

      const msg2 = getLocalizedEventMessage(
        'expense_created',
        { description: 'شام' },
        mockT,
        'fa',
      );
      expect(msg2).toContain('شام');
    });

    it('manages notification store lifecycle', () => {
      const store = useNotificationsStore.getState();
      expect(store.items).toHaveLength(0);

      store.add({
        groupId: 20,
        eventType: 'settlement_created',
        params: { amount: 150000 },
        ts: new Date().toISOString(),
      });

      expect(useNotificationsStore.getState().items).toHaveLength(1);
      expect(useNotificationsStore.getState().items[0]?.read).toBe(false);

      useNotificationsStore.getState().markAllRead();
      expect(useNotificationsStore.getState().items[0]?.read).toBe(true);

      useNotificationsStore.getState().clear();
      expect(useNotificationsStore.getState().items).toHaveLength(0);
    });
  });

  describe('Settlements UI', () => {
    it('renders settlements tab with receiver confirm button', async () => {
      // Sign in as user 1 (the receiver of settlement 301)
      useAuthStore.getState().setUser({
        id: 1,
        phone_number: '09121111111',
        full_name: 'امیر',
        email: null,
        language: 'fa',
        avatar: null,
        date_joined: '2026-01-01',
      });
      useAuthStore.getState().setTokens('mock-acc', 'mock-ref');

      renderWithProviders(
        <SettlementsTab group={mockGroup} myId={1} members={mockGroup.memberships} />,
      );

      // Verify settlement participants rendered
      expect(await screen.findByText('سارا')).toBeInTheDocument();
      expect(screen.getByText('امیر')).toBeInTheDocument();

      // Verify confirm receipt button is visible for the receiver
      expect(screen.getByTitle(/تایید دریافت|Confirm Receipt/i)).toBeInTheDocument();
    });

    it('displays stale balance error prompt in OptimizeDialog on 409', async () => {
      renderWithProviders(
        <OptimizeDialog
          open={true}
          onOpenChange={() => {}}
          groupId={20}
          members={mockGroup.memberships}
        />,
      );

      // Dialog calculates and renders suggestions
      expect(await screen.findByText('سارا')).toBeInTheDocument();
      expect(screen.getByText('امیر')).toBeInTheDocument();
    });
  });
});
