import { QueryClient } from "@tanstack/react-query";

import {
  hydratePublicCatalogQueries,
  startPublicCatalogPersistence,
} from "./publicCatalogPersistence";

// EFHC Mini App: a single global QueryClient.
// Defaults are tuned for Telegram Mini App UX:
// - keep data "fresh enough" without hammering backend
// - refetch on focus (when user returns to Telegram)
export function createEfhcQueryClient() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        // Mini App: не дергаем API при каждом переходе по вкладкам.
        staleTime: 10_000,
        gcTime: 300_000,
        retry: 1,
        refetchOnMount: false,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: 0,
      },
    },
  });
  if (typeof window !== "undefined") {
    hydratePublicCatalogQueries(client);
    startPublicCatalogPersistence(client);
  }
  return client;
}
