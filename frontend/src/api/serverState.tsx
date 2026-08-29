import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { RealtimeSync } from "./RealtimeSync";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export function ServerStateProvider({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <RealtimeSync />
      {children}
    </QueryClientProvider>
  );
}
