import { api } from '@/shared/lib/api';
import type { LoginResponse, RegisterResponse, User } from '@/shared/types/api';

export async function login(phone_number: string, password: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('accounts/login/', { phone_number, password });
  return data;
}

export async function register(payload: {
  phone_number: string;
  password: string;
  password_confirm: string;
}): Promise<RegisterResponse> {
  const { data } = await api.post<RegisterResponse>('accounts/register/', payload);
  return data;
}

export async function verifyOtp(code: string, tempToken: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>(
    'accounts/verify-otp/',
    { code },
    { headers: { Authorization: `Bearer ${tempToken}` } },
  );
  return data;
}

export async function logout(refresh: string): Promise<void> {
  await api.post('accounts/logout/', { refresh });
}

export async function getProfile(): Promise<User> {
  const { data } = await api.get<User>('accounts/profile/');
  return data;
}

export async function updateProfile(payload: FormData): Promise<User> {
  const { data } = await api.patch<User>('accounts/profile/', payload, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}
