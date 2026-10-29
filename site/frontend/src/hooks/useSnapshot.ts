import { useQuery } from "@tanstack/react-query";

import { useAuthOwnerGlobalId } from "../auth/AuthSessionProvider";
import { queryKeys } from "../queries/queryKeys";
import {
  fetchSyncSnapshot,
  type SyncSnapshot,
} from "../services/snapshot.service";

export type { SyncSnapshot } from "../services/snapshot.service";

export type SnapshotStatus = "idle" | "loading" | "success" | "error";

export function useSnapshot() {
  const globalId = useAuthOwnerGlobalId();
  const q = useQuery({
    queryKey: queryKeys.snapshot.current(globalId),
    enabled: Boolean(globalId),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    queryFn: fetchSyncSnapshot,
  });

  const status: SnapshotStatus = q.data
    ? "success"
    : !globalId
      ? "idle"
      : q.isError
        ? "error"
        : "loading";

  return {
    snap: q.data ?? null,
    status,
    loading: status === "loading",
    refreshing: Boolean(q.data) && q.isFetching,
    error: q.isError,
    refresh: q.refetch,
  };
}
