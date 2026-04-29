"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

let globalQueryClient: QueryClient | null = null;

export function getQueryClient(): QueryClient | null {
  return globalQueryClient;
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => {
    const c = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 30_000,
          refetchOnWindowFocus: false,
          retry: 1,
        },
      },
    });
    globalQueryClient = c;
    return c;
  });

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
