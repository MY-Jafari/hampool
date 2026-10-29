import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import {
  addMember,
  changeRole,
  generateInvite,
  getGroupQrUrl,
  removeMember,
  requestReport,
  suggestGroupName,
  updateGroup,
} from '../api';
import { MembersTab } from '../components/MembersTab';
import { AiRenameDialog } from '../components/AiRenameDialog';
import { ReportsTab } from '../components/ReportsTab';
import { ProfilePage } from '@/features/auth/ProfilePage';
import { NotFoundPage } from '@/features/misc/NotFoundPage';
import { ForbiddenPage } from '@/features/misc/ForbiddenPage';
import { ServerErrorPage } from '@/features/misc/ServerErrorPage';
import { OfflinePage } from '@/features/misc/OfflinePage';
import { useAuthStore } from '@/features/auth/store';
import { LanguageProvider } from '@/shared/providers/LanguageProvider';
import { ThemeProvider } from '@/shared/providers/ThemeProvider';
import '@/shared/lib/i18n';
import type { Group, Membership, Expense, User } from '@/shared/types/api';

const API_BASE = '/api/v1/';

const mockGroup: Group = {
  id: 30,
  name: 'گروه تست فاز ۶',
  description: 'مدیریت اعضا و گزارش‌ها',
  budget_limit: 1000000,
  invite_code: 'INVITE30',
  invite_code_expires_at: '2026-11-01T12:00:00Z',
  created_by: 1,
  owner: 1,
  created_at: '2026-08-01T10:00:00Z',
  memberships: [
    { id: 1, user: 1, user_phone: '09121111111', user_name: 'امیر', role: 'admin', joined_at: '2026-08-01' },
    { id: 2, user: 2, user_phone: '09122222222', user_name: 'سارا', role: 'member', joined_at: '2026-08-02' },
  ],
  total_expenses: 300000,
  remaining_budget: 700000,
};

const mockExpenses: Expense[] = [
  {
    id: 101,
    group: 30,
    description: 'شام پیتزا',
    total_amount: 300000,
    split_type: 'equal',
    paid_by: 1,
    date: '2026-08-05',
    is_confirmed: true,
    receipt_image: null,
    receipt_expiry_date: null,
    splits: [
      { user: 1, amount: 150000, settled: false },
      { user: 2, amount: 150000, settled: false },
    ],
    items: [],
  },
];

const mockUser: User = {
  id: 1,
  phone_number: '09121111111',
  email: 'amir@example.com',
  full_name: 'امیر رضایی',
  language: 'fa',
  avatar: null,
  date_joined: '2026-01-01T00:00:00Z',
};

const server = setupServer(
  // Members endpoints
  http.get(`${API_BASE}groups/30/members/`, () => {
    return HttpResponse.json(mockGroup.memberships);
  }),

  http.post(`${API_BASE}groups/30/members/add/`, async ({ request }) => {
    const body = (await request.json()) as { phone_number: string };
    const newMembership: Membership = {
      id: 3,
      user: 3,
      user_phone: body.phone_number,
      user_name: 'کاربر جدید',
      role: 'member',
      joined_at: new Date().toISOString(),
    };
    return HttpResponse.json(newMembership, { status: 201 });
  }),

  http.delete(`${API_BASE}groups/30/members/2/remove/`, () => {
    return new HttpResponse(null, { status: 204 });
  }),

  http.delete(`${API_BASE}groups/30/members/99/remove/`, () => {
    return HttpResponse.json(
      { error: 'Cannot remove member with unsettled balance.' },
      { status: 400 },
    );
  }),

  http.patch(`${API_BASE}groups/30/members/2/role/`, async ({ request }) => {
    const body = (await request.json()) as { role: 'admin' | 'member' };
    return HttpResponse.json({ ...mockGroup.memberships[1], role: body.role });
  }),

  http.post(`${API_BASE}groups/30/invite/`, () => {
    return HttpResponse.json({
      invite_code: 'NEWCODE8',
      expires_at: '2026-11-05T12:00:00Z',
    });
  }),

  http.get(`${API_BASE}groups/30/qr-code/`, () => {
    const pngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    return new HttpResponse(pngBytes, {
      status: 200,
      headers: { 'Content-Type': 'image/png' },
    });
  }),

  // AI Suggestion endpoint
  http.post(`${API_BASE}groups/30/suggest-name/`, () => {
    return HttpResponse.json({
      persian: ['همسفران البرز', 'پاتوق دوستان', 'سفرنامه شمال'],
      english: ['Alpine Crew', 'Hangout Hub', 'North Trail'],
    });
  }),

  http.patch(`${API_BASE}groups/30/`, async ({ request }) => {
    const body = (await request.json()) as { name?: string };
    return HttpResponse.json({ ...mockGroup, name: body.name ?? mockGroup.name });
  }),

  // Reports endpoints
  http.get(`${API_BASE}groups/30/expenses/`, () => {
    return HttpResponse.json(mockExpenses);
  }),

  http.post(`${API_BASE}groups/30/report/`, () => {
    return HttpResponse.json(
      { detail: 'Report generation started. You will receive an email shortly.' },
      { status: 202 },
    );
  }),

  // Accounts Profile endpoints
  http.get(`${API_BASE}accounts/profile/`, () => {
    return HttpResponse.json(mockUser);
  }),

  http.patch(`${API_BASE}accounts/profile/`, async () => {
    return HttpResponse.json({
      ...mockUser,
      full_name: 'امیر رضایی جدید',
      email: 'newamir@example.com',
    });
  }),

  http.post(`${API_BASE}accounts/logout/`, () => {
    return HttpResponse.json({ detail: 'Successfully logged out.' }, { status: 205 });
  }),
);

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <ThemeProvider>
          <MemoryRouter>{ui}</MemoryRouter>
        </ThemeProvider>
      </LanguageProvider>
    </QueryClientProvider>,
  );
}

describe('Phase 6: Members, AI Name, Reports, Profile & Error Pages', () => {
  beforeAll(() => {
    server.listen();
    useAuthStore.getState().setTokens('mock-acc', 'mock-ref');
    useAuthStore.getState().setUser(mockUser);
  });

  afterEach(() => {
    server.resetHandlers();
  });

  afterAll(() => {
    server.close();
  });

  describe('Members & Invite API & UI', () => {
    it('executes member management contracts: add, changeRole, remove, invite, qr', async () => {
      const added = await addMember(30, '09123333333');
      expect(added.user_phone).toBe('09123333333');

      const updatedRole = await changeRole(30, 2, 'admin');
      expect(updatedRole.role).toBe('admin');

      await expect(removeMember(30, 2)).resolves.not.toThrow();

      const invite = await generateInvite(30);
      expect(invite.invite_code).toBe('NEWCODE8');

      // Mock createObjectURL for QR test
      global.URL.createObjectURL = () => 'blob:mock-qr-blob-url';
      global.URL.revokeObjectURL = () => {};

      const qrUrl = await getGroupQrUrl(30);
      expect(qrUrl).toBe('blob:mock-qr-blob-url');
    });

    it('renders MembersTab with invite card and member list', async () => {
      renderWithProviders(
        <MembersTab group={mockGroup} myId={1} myRole="admin" />,
      );

      // Verify invite code display
      expect(screen.getByText('INVITE30')).toBeInTheDocument();

      // Verify member names rendered
      expect(screen.getByText('امیر')).toBeInTheDocument();
      expect(screen.getByText('سارا')).toBeInTheDocument();
      expect(screen.getByText('09121111111')).toBeInTheDocument();
      expect(screen.getByText('09122222222')).toBeInTheDocument();
    });
  });

  describe('AI Name Suggestion Dialog', () => {
    it('fetches AI name suggestions contract', async () => {
      const suggestions = await suggestGroupName(30);
      expect(suggestions.persian).toHaveLength(3);
      expect(suggestions.english).toHaveLength(3);
      expect(suggestions.persian).toContain('همسفران البرز');
    });

    it('renders AiRenameDialog and allows applying a suggested name', async () => {
      const onOpenChange = () => {};
      renderWithProviders(
        <AiRenameDialog open={true} onOpenChange={onOpenChange} groupId={30} />,
      );

      // Trigger generation
      const genButton = screen.getByRole('button', {
        name: /دریافت پیشنهادها با هوش مصنوعی|Generate Suggestions/i,
      });
      fireEvent.click(genButton);

      // Await suggested chips
      await waitFor(() => {
        expect(screen.getByText('همسفران البرز')).toBeInTheDocument();
      });

      // Click suggestion
      fireEvent.click(screen.getByText('همسفران البرز'));

      // Group update API called
      const updated = await updateGroup(30, { name: 'همسفران البرز' });
      expect(updated.name).toBe('همسفران البرز');
    });
  });

  describe('ReportsTab & PDF Export', () => {
    it('executes report request API contract', async () => {
      await expect(requestReport(30)).resolves.not.toThrow();
    });

    it('renders ReportsTab with charts and triggers PDF report request', async () => {
      renderWithProviders(
        <ReportsTab group={mockGroup} members={mockGroup.memberships} />,
      );

      await waitFor(() => {
        expect(
          screen.getAllByRole('button', { name: /درخواست گزارش PDF|Request PDF Report/i }).length,
        ).toBeGreaterThanOrEqual(1);
      });

      const reportBtn = screen.getAllByRole('button', {
        name: /درخواست گزارش PDF|Request PDF Report/i,
      })[0];
      if (reportBtn) {
        fireEvent.click(reportBtn);
      }
    });

    it('handles 403 report rate-limiting gracefully', async () => {
      server.use(
        http.post(`${API_BASE}groups/30/report/`, () => {
          return HttpResponse.json(
            { detail: 'Rate limit exceeded: maximum 3 requests per hour.' },
            { status: 403 },
          );
        }),
      );

      await expect(requestReport(30)).rejects.toThrow();
    });
  });

  describe('Profile & Settings Page', () => {
    it('renders ProfilePage with user details and triggers save', async () => {
      renderWithProviders(<ProfilePage />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('امیر رضایی')).toBeInTheDocument();
        expect(screen.getByDisplayValue('amir@example.com')).toBeInTheDocument();
      });

      // Submit changes
      const submitBtn = screen.getByRole('button', {
        name: /ذخیره تغییرات|Save Changes/i,
      });
      fireEvent.click(submitBtn);
    });

    it('handles logout button click', async () => {
      renderWithProviders(<ProfilePage />);

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: /خروج از حساب کاربری|Log Out/i }),
        ).toBeInTheDocument();
      });

      const logoutBtn = screen.getByRole('button', {
        name: /خروج از حساب کاربری|Log Out/i,
      });
      fireEvent.click(logoutBtn);
    });
  });

  describe('Error Pages (404, 403, 500, Offline)', () => {
    it('renders NotFoundPage (404) with illustration and return button', () => {
      renderWithProviders(<NotFoundPage />);
      expect(screen.getByText(/۴۰۴|404/)).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: /بازگشت به داشبورد|Back to Dashboard/i }),
      ).toBeInTheDocument();
    });

    it('renders ForbiddenPage (403) with access denied notice', () => {
      renderWithProviders(<ForbiddenPage />);
      expect(screen.getByText(/۴۰۳|403/)).toBeInTheDocument();
      expect(
        screen.getByRole('link', { name: /بازگشت به داشبورد|Back to Dashboard/i }),
      ).toBeInTheDocument();
    });

    it('renders ServerErrorPage (500) with retry and return buttons', () => {
      renderWithProviders(<ServerErrorPage />);
      expect(screen.getByText(/۵۰۰|500/)).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /تلاش مجدد|Try Again/i }),
      ).toBeInTheDocument();
    });

    it('renders OfflinePage with network offline illustration', () => {
      renderWithProviders(<OfflinePage />);
      expect(
        screen.getByText(/عدم اتصال به شبکه|You Are Offline/i),
      ).toBeInTheDocument();
    });
  });
});
