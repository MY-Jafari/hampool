import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { login, register, verifyOtp, logout } from '../api';
import { useAuthStore } from '../store';

const API_BASE = '/api/v1/';

const server = setupServer(
  http.post(`${API_BASE}accounts/login/`, async ({ request }) => {
    const body = (await request.json()) as { phone_number?: string; password?: string };
    if (body.phone_number === '09123456789' && body.password === 'Password123') {
      return HttpResponse.json({
        access: 'mock-access-token',
        refresh: 'mock-refresh-token',
      });
    }
    return HttpResponse.json(
      { detail: 'No active account found with the given credentials' },
      { status: 401 },
    );
  }),

  http.post(`${API_BASE}accounts/register/`, async () => {
    return HttpResponse.json(
      {
        detail: 'Registration successful. Please verify your phone number with the OTP.',
        temp_token: 'mock-temp-token-jwt',
      },
      { status: 201 },
    );
  }),

  http.post(`${API_BASE}accounts/verify-otp/`, async ({ request }) => {
    const authHeader = request.headers.get('Authorization');
    const body = (await request.json()) as { code?: string };

    if (!authHeader?.includes('mock-temp-token-jwt')) {
      return HttpResponse.json({ detail: 'Invalid temp token' }, { status: 403 });
    }

    if (body.code === '123456') {
      return HttpResponse.json({
        detail: 'Phone number verified successfully. You are now logged in.',
        access: 'mock-verified-access-token',
        refresh: 'mock-verified-refresh-token',
      });
    }

    return HttpResponse.json({ code: ['Invalid or expired OTP code.'] }, { status: 400 });
  }),

  http.post(`${API_BASE}accounts/logout/`, async ({ request }) => {
    const body = (await request.json()) as { refresh?: string };
    if (body.refresh) {
      return HttpResponse.json({ detail: 'Successfully logged out.' }, { status: 205 });
    }
    return HttpResponse.json({ error: 'Refresh token is required.' }, { status: 400 });
  }),
);

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  useAuthStore.getState().clear();
});
afterAll(() => server.close());

describe('Auth API & Flow', () => {
  it('successfully logs in with valid credentials and updates store', async () => {
    const response = await login('09123456789', 'Password123');
    expect(response.access).toBe('mock-access-token');
    expect(response.refresh).toBe('mock-refresh-token');

    useAuthStore.getState().setTokens(response.access, response.refresh);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().access).toBe('mock-access-token');
  });

  it('fails login with invalid credentials with 401', async () => {
    await expect(login('09123456789', 'WrongPassword')).rejects.toThrow();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('registers user and returns temp_token for OTP verification', async () => {
    const response = await register({
      phone_number: '09129998877',
      password: 'StrongPassword123',
      password_confirm: 'StrongPassword123',
    });

    expect(response.temp_token).toBe('mock-temp-token-jwt');
    expect(response.detail).toContain('OTP');
  });

  it('verifies OTP with temp_token and activates session', async () => {
    const tempToken = 'mock-temp-token-jwt';
    const verifyResponse = await verifyOtp('123456', tempToken);

    expect(verifyResponse.access).toBe('mock-verified-access-token');
    expect(verifyResponse.refresh).toBe('mock-verified-refresh-token');

    useAuthStore.getState().setTokens(verifyResponse.access, verifyResponse.refresh);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('rejects OTP verification with incorrect code', async () => {
    const tempToken = 'mock-temp-token-jwt';
    await expect(verifyOtp('000000', tempToken)).rejects.toThrow();
  });

  it('logs out user and clears tokens', async () => {
    useAuthStore.getState().setTokens('token1', 'token2');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    await logout('token2');
    useAuthStore.getState().clear();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().access).toBeNull();
    expect(useAuthStore.getState().refresh).toBeNull();
  });
});
