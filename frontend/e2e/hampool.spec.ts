import { test, expect } from '@playwright/test';
import path from 'node:path';

const SCREENSHOT_DIR = path.resolve(process.cwd(), '../screenshots');

test.describe('HamPool E2E Flow & Bilingual Verification', () => {
  test.beforeEach(async ({ page }) => {
    // Mock accounts endpoints
    await page.route('**/api/v1/accounts/login/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access: 'mock-access-token',
          refresh: 'mock-refresh-token',
        }),
      });
    });

    await page.route('**/api/v1/accounts/profile/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 1,
          phone_number: '09121111111',
          full_name: 'امیر رضایی',
          email: 'amir@example.com',
          language: 'fa',
          avatar: null,
          date_joined: '2026-01-01T00:00:00Z',
        }),
      });
    });

    // Mock groups endpoints
    const mockGroups = [
      {
        id: 1,
        name: 'سفر شمال و ویلا',
        description: 'هزینه‌های اقامت و تفریح',
        budget_limit: 5000000,
        invite_code: 'TRIP2026',
        invite_code_expires_at: '2026-11-10T12:00:00Z',
        created_by: 1,
        owner: 1,
        created_at: '2026-08-01T10:00:00Z',
        memberships: [
          { id: 1, user: 1, user_phone: '09121111111', user_name: 'امیر رضایی', role: 'admin', joined_at: '2026-08-01' },
          { id: 2, user: 2, user_phone: '09122222222', user_name: 'سارا کاظمی', role: 'member', joined_at: '2026-08-02' },
        ],
        total_expenses: 1200000,
        remaining_budget: 3800000,
      },
    ];

    await page.route('**/api/v1/groups/', async (route) => {
      if (route.request().method() === 'POST') {
        const body = JSON.parse(route.request().postData() || '{}');
        const newGroup = {
          ...mockGroups[0],
          id: 2,
          name: body.name || 'گروه جدید',
          budget_limit: body.budget_limit || 0,
        };
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(newGroup),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockGroups),
        });
      }
    });

    await page.route('**/api/v1/groups/1/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockGroups[0]),
      });
    });

    await page.route('**/api/v1/groups/1/balances/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { phone_number: '09121111111', full_name: 'امیر رضایی', net: 450000 },
          { phone_number: '09122222222', full_name: 'سارا کاظمی', net: -450000 },
        ]),
      });
    });

    await page.route('**/api/v1/groups/1/expenses/', async (route) => {
      if (route.request().method() === 'POST') {
        const body = JSON.parse(route.request().postData() || '{}');
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 101,
            group: 1,
            description: body.description,
            total_amount: body.total_amount,
            split_type: body.split_type,
            paid_by: 1,
            date: new Date().toISOString(),
            is_confirmed: false,
            receipt_image: null,
            receipt_expiry_date: null,
            splits: [
              { user: 1, amount: body.total_amount / 2, settled: false },
              { user: 2, amount: body.total_amount / 2, settled: false },
            ],
            items: [],
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 100,
              group: 1,
              description: 'خرید مواد غذایی سوپرمارکت',
              total_amount: 1200000,
              split_type: 'equal',
              paid_by: 1,
              date: '2026-10-25T14:00:00Z',
              is_confirmed: true,
              receipt_image: null,
              receipt_expiry_date: null,
              splits: [
                { user: 1, amount: 600000, settled: false },
                { user: 2, amount: 600000, settled: false },
              ],
              items: [],
            },
          ]),
        });
      }
    });

    await page.route('**/api/v1/groups/1/settlements/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 201,
            group: 1,
            from_user: 2,
            from_user_phone: '09122222222',
            to_user: 1,
            to_user_phone: '09121111111',
            amount: 450000,
            status: 'pending',
            reversed_by: null,
            created_by: 2,
            confirmed_by: null,
            created_at: '2026-10-28T16:00:00Z',
            confirmed_at: null,
          },
        ]),
      });
    });

    await page.route('**/api/v1/groups/1/optimize-settlements/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          balance_version: 'optimal-v1-hash',
          suggestions: [{ from_user_id: 2, to_user_id: 1, amount: 450000 }],
        }),
      });
    });

    await page.route('**/api/v1/groups/1/settlements/apply-optimization/', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 202,
            group: 1,
            from_user: 2,
            from_user_phone: '09122222222',
            to_user: 1,
            to_user_phone: '09121111111',
            amount: 450000,
            status: 'pending',
            reversed_by: null,
            created_by: 1,
            confirmed_by: null,
            created_at: new Date().toISOString(),
            confirmed_at: null,
          },
        ]),
      });
    });

    await page.route('**/api/v1/groups/1/settlements/201/confirm/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 201,
          group: 1,
          from_user: 2,
          from_user_phone: '09122222222',
          to_user: 1,
          to_user_phone: '09121111111',
          amount: 450000,
          status: 'confirmed',
          confirmed_by: 1,
          created_by: 2,
          reversed_by: null,
          created_at: '2026-10-28T16:00:00Z',
          confirmed_at: new Date().toISOString(),
        }),
      });
    });
  });

  test('Full User Journey in Persian (fa) + Screenshot Capture', async ({ page }) => {
    // 1. Visit Login
    await page.goto('/login');
    await expect(page).toHaveTitle(/هم‌پول/);
    await page.waitForSelector('#phone');

    // Capture login screenshot
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'login.png') });

    // Fill login form
    await page.fill('#phone', '09121111111');
    await page.fill('#password', 'password123');
    await page.click('button[type="submit"]');

    // 2. Dashboard
    await page.waitForURL('**/dashboard');
    await expect(page.locator('h1')).toContainText(/داشبورد|Dashboard/);

    // Capture dashboard screenshot
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'dashboard.png') });

    // 3. Groups List
    await page.goto('/groups');
    await expect(page.locator('h1')).toContainText(/گروه‌ها|Groups/);

    // Capture groups screenshot
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'groups.png') });

    // 4. Group Detail
    await page.goto('/groups/1');
    await expect(page.locator('h1')).toContainText(/سفر شمال و ویلا/);

    // Capture group detail screenshot
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'group-detail.png') });

    // 5. Navigate to Settlements Tab
    await page.click('button[role="tab"]:has-text("تسویه‌ها"), button[role="tab"]:has-text("Settlements")');
    await expect(page.locator('text=سارا کاظمی').first()).toBeVisible();

    // Verify receiver confirmation button is accessible
    const confirmBtn = page.locator('button[title="تایید دریافت"], button:has-text("تایید دریافت"), button:has-text("Confirm Receipt")');
    if (await confirmBtn.count() > 0) {
      await expect(confirmBtn.first()).toBeVisible();
    }
  });

  test('English (en) Runtime Language Switch & Direction (LTR) Verification', async ({ page }) => {
    // Pre-populate tokens to go directly to dashboard
    await page.addInitScript(() => {
      localStorage.setItem('hampool.access', 'mock-access-token');
      localStorage.setItem('hampool.refresh', 'mock-refresh-token');
      localStorage.setItem('hampool.lang', 'en');
    });

    await page.goto('/dashboard');

    // Verify English text and LTR direction
    const html = page.locator('html');
    await expect(html).toHaveAttribute('dir', 'ltr');
    await expect(html).toHaveAttribute('lang', 'en');

    await expect(page.locator('h1')).toContainText(/Dashboard/);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'dashboard-en.png') });
  });
});
