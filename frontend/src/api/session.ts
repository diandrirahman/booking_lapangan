import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiClientError, type RegisterInput } from "@lapangango/api-client";
import { apiClient, serverStateEnabled } from "./apiClient";

export const sessionQueryKey = ["session"] as const;

export function isAuthenticationRequired(error: unknown): boolean {
  return error instanceof ApiClientError && error.status === 401;
}

export function useSession() {
  return useQuery({
    queryKey: sessionQueryKey,
    queryFn: () => apiClient.getCurrentUser(),
    enabled: serverStateEnabled,
    retry: false,
    staleTime: 60_000,
  });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      apiClient.login(email, password),
    onSuccess: (session) => {
      queryClient.setQueryData(sessionQueryKey, session);
      window.dispatchEvent(new Event("lapangango:session-changed"));
    },
  });
}

export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterInput) => apiClient.register(input),
    onSuccess: (session) => {
      queryClient.setQueryData(sessionQueryKey, session);
      window.dispatchEvent(new Event("lapangango:session-changed"));
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.logout(),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: sessionQueryKey });
      window.dispatchEvent(new Event("lapangango:session-changed"));
    },
  });
}

export function useStartGoogleAccountLink() {
  return useMutation({
    mutationFn: (password: string) => apiClient.startGoogleAccountLink(password),
  });
}
