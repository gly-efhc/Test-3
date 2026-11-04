import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useRouter } from "next/router";

import { useAuthOwnerGlobalId } from "../auth/AuthSessionProvider";
import { queryKeys } from "../queries/queryKeys";
import {
  fetchSyncSnapshot,
  type SyncSnapshot,
} from "../services/snapshot.service";

export type { SyncSnapshot } from "../services/snapshot.service";

export type SnapshotStatus = "idle" | "loading" | "success" | "error";

export function useSnapshot() {
  const router = useRouter();
  const entry = useRef(router.pathname);
  const globalId = useAuthOwnerGlobalId();
  const q = useQuery({
    queryKey: queryKeys.snapshot.current(globalId),
    enabled: Boolean(globalId),
    staleTime: 30_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    queryFn: fetchSyncSnapshot,
  });
  useEffect(() => {
    if (entry.current === router.pathname) return;
    entry.current = router.pathname;
    if (globalId && q.data && !q.isFetching) void q.refetch();
  }, [router.pathname, globalId, q.refetch]);

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
