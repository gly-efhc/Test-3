import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { useAuthOwnerGlobalId } from "../auth/AuthSessionProvider";
import {
  getMyRankWithTop,
  getRankContext,
  getRankTopPage,
} from "../services/ranks.service";
import { queryKeys } from "./queryKeys";
import { useFrozenDemoTables } from "../reconstruction/useFrozenDemoTables";
import { demoMyRankWithTop, demoRankTopPage, demoRankContext } from "../reconstruction/demoTables";
import { isDemoPreviewEnabled } from "../reconstruction/demoUnifiedStore";

export function useMyRankWithTop(_globalId: string | null) {
  const globalId = useAuthOwnerGlobalId();
  const demo = useFrozenDemoTables();
  return useQuery({
    queryKey: queryKeys.ranks.myPlusTop(globalId),
    enabled: Boolean(globalId) || demo,
    queryFn: ({ signal }) => demo && !isDemoPreviewEnabled() ? Promise.resolve(demoMyRankWithTop()) : getMyRankWithTop(signal),
    staleTime: 30_000,
  });
}

export function useRankTopPages(
  _globalId: string | null,
  firstCursor: string | null | undefined,
) {
  const globalId = useAuthOwnerGlobalId();
  const demo = useFrozenDemoTables();
  return useInfiniteQuery({
    queryKey: queryKeys.ranks.top(globalId),
    enabled: Boolean(firstCursor && (globalId || demo)),
    initialPageParam: firstCursor ?? null,
    queryFn: ({ pageParam, signal }) => {
      if (!pageParam) {
        return Promise.resolve({
          snapshot_at: "",
          items: [],
          next_cursor: null,
        });
      }
      return demo && !isDemoPreviewEnabled() ? Promise.resolve(demoRankTopPage(pageParam)) : getRankTopPage({ cursor: pageParam, signal });
    },
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  });
}

export function useRankContext() {
  const globalId = useAuthOwnerGlobalId();
  const demo = useFrozenDemoTables();
  return useMutation({
    mutationFn: () => demo && !isDemoPreviewEnabled() ? Promise.resolve(demoRankContext()) : getRankContext(),
  });
}

export function useRefreshRanks(_globalId: string | null) {
  const globalId = useAuthOwnerGlobalId();
  const queryClient = useQueryClient();
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.ranks.myPlusTop(globalId),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.ranks.top(globalId),
      }),
    ]);
  };
}
