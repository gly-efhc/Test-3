import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { useAuthOwnerGlobalId } from "../auth/AuthSessionProvider";
import {
  activatePanel,
  getPanelsPage,
  getPanelsSummary,
  type PanelTab,
} from "../services/panels.service";
import { queryKeys } from "./queryKeys";
import { useFrozenDemoTables } from "../reconstruction/useFrozenDemoTables";
import { demoPanelsSummary, demoPanelsPage } from "../reconstruction/demoTables";
import { isDemoPreviewEnabled } from "../reconstruction/demoUnifiedStore";

export function usePanelsSummary() {
  const globalId = useAuthOwnerGlobalId();
  const demo = useFrozenDemoTables();
  return useQuery({
    queryKey: queryKeys.panels.summary(globalId),
    enabled: Boolean(globalId) || demo,
    queryFn: demo && !isDemoPreviewEnabled() ? demoPanelsSummary : getPanelsSummary,
    staleTime: 10_000,
  });
}

export function usePanelsList(
  tab: PanelTab,
  sortDirection: "oldest" | "newest" = "oldest",
) {
  const globalId = useAuthOwnerGlobalId();
  const demo = useFrozenDemoTables();
  return useInfiniteQuery({
    // A DEMO sort changes which 20 rows are returned, not merely their order
    // inside one previously fetched page. Production query keys are unchanged.
    queryKey: demo
      ? [...queryKeys.panels.list(globalId, tab), "demo", sortDirection]
      : queryKeys.panels.list(globalId, tab),
    enabled: Boolean(globalId) || demo,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => demo
      ? (isDemoPreviewEnabled()
        ? getPanelsPage({ tab, cursor: pageParam, signal, demoSortDirection: sortDirection })
        : Promise.resolve(demoPanelsPage(tab, pageParam, sortDirection)))
      : getPanelsPage({ tab, cursor: pageParam, signal }),
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  });
}

export function usePanelActivation() {
  const globalId = useAuthOwnerGlobalId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: activatePanel,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.snapshot.current(globalId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.panels.summary(globalId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.panels.all(globalId),
          // Portfolio is inactive on the activation route, and shared query
          // defaults disable refetch-on-mount. Refresh its cached pages now.
          refetchType: "all",
        }),
      ]);
    },
  });
}
