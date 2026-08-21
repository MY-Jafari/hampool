import { useQuery } from '@tanstack/react-query';
import { getProfile } from './api';
import { useAuthStore } from './store';

/** Fetch the current profile and keep it in the auth store. */
export function useProfile() {
  const setUser = useAuthStore((s) => s.setUser);
  return useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const user = await getProfile();
      setUser(user);
      return user;
    },
  });
}
