import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { useAuthOwnerGlobalId } from "../auth/AuthSessionProvider";
import {
  claimTask,
  getMyTasks,
  getTaskEarnings,
  getTasksCatalog,
} from "../services/tasks.service";
import type { GlobalId } from "../types/identity";
import { queryKeys } from "./queryKeys";
import { useFrozenDemoTables } from "../reconstruction/useFrozenDemoTables";
import { demoTasksCatalog, demoMyTasks, demoTaskEarnings } from "../reconstruction/demoTables";

async function invalidateTaskState(
  queryClient: ReturnType<typeof useQueryClient>,
  globalId: GlobalId | null,
): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({
      queryKey: queryKeys.tasks.mine(globalId),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.snapshot.current(globalId),
    }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.tasks.earnings(globalId),
    }),
  ]);
}

export function useTasksCatalog() {
  const globalId = useAuthOwnerGlobalId();
  const demo = useFrozenDemoTables() && !globalId;
  return useQuery({
    queryKey: queryKeys.tasks.catalog,
    enabled: (process.env.NEXT_PUBLIC_EFHC_E2E_TONCONNECT_MOCK !== "1" ||
      process.env.NEXT_PUBLIC_EFHC_ADMIN_VISUAL_PROOF !== "1") || demo,
    staleTime: 60_000,
    queryFn: demo ? demoTasksCatalog : getTasksCatalog,
  });
}

export function useTaskEarnings() {
  const globalId = useAuthOwnerGlobalId();
  const demo = useFrozenDemoTables() && !globalId;
  return useQuery({
    queryKey: queryKeys.tasks.earnings(globalId),
    enabled: Boolean(globalId) || demo,
    staleTime: 10_000,
    queryFn: demo ? demoTaskEarnings : getTaskEarnings,
  });
}

export function useMyTasks() {
  const globalId = useAuthOwnerGlobalId();
  const demo = useFrozenDemoTables() && !globalId;
  return useQuery({
    queryKey: queryKeys.tasks.mine(globalId),
    enabled: Boolean(globalId) || demo,
    staleTime: 10_000,
    queryFn: demo ? demoMyTasks : getMyTasks,
  });
}

export function useClaimTask() {
  const globalId = useAuthOwnerGlobalId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: claimTask,
    onSuccess: async () => {
      await invalidateTaskState(queryClient, globalId);
    },
  });
}

export function useRefreshTaskState() {
  const globalId = useAuthOwnerGlobalId();
  const queryClient = useQueryClient();
  return async (): Promise<void> => {
    await invalidateTaskState(queryClient, globalId);
  };
}
