import { QueryClient } from "@tanstack/react-query";
import { activateUserCache, startUserDataPersistence } from "./userDataCache";
import { resetSettings, saveSettings } from "./settings";

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
        // Never queue a backend action for automatic replay when connectivity returns.
        networkMode: "always",
      },
    },
  });
  if (typeof window !== "undefined") {
    hydratePublicCatalogQueries(client);
    startPublicCatalogPersistence(client);
    startUserDataPersistence(client);
  }
  return client;
}

export function activateUserDataOwner(client: QueryClient, owner: string | null, admin: boolean): boolean {
  const changed = activateUserCache(client, owner, admin);
  if (changed) {
    saveSettings(resetSettings());
    if (typeof window !== "undefined") window.dispatchEvent?.(new Event("efhc:user-owner-changed"));
  }
  return changed;
}
