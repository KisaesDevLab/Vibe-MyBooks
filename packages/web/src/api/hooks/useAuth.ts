import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LoginInput, RegisterInput, User } from '@kis-books/shared';
import { apiClient, setTokens, clearTokens } from '../client';

interface AuthResponse {
  user: User;
  tokens: { accessToken: string; refreshToken: string };
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: LoginInput) => {
      const data = await apiClient<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      setTokens(data.tokens);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: RegisterInput) => {
      const data = await apiClient<AuthResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      setTokens(data.tokens);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const refreshToken = localStorage.getItem('refreshToken');
      await apiClient('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      }).catch(() => {});
      clearTokens();
    },
    onSuccess: () => {
      queryClient.clear();
    },
  });
}

interface MeResponse {
  user: User;
  branding?: { appName: string; isCustomName: boolean };
}

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => apiClient<MeResponse>('/auth/me'),
    retry: false,
    staleTime: 5 * 60 * 1000,
    enabled: !!localStorage.getItem('accessToken'),
  });
}
