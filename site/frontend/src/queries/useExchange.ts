import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { useAuthOwnerGlobalId } from "../auth/AuthSessionProvider";
import {
  convertExchange,
  getExchangePreview,
} from "../services/exchange.service";
import { queryKeys } from "./queryKeys";

export function useExchangePreview() {
  const globalId = useAuthOwnerGlobalId();
  return useQuery({
    queryKey: queryKeys.exchange.preview(globalId),
    enabled: Boolean(globalId),
    queryFn: getExchangePreview,
  });
}

export function useExchangeConvert() {
  const globalId = useAuthOwnerGlobalId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: convertExchange,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.snapshot.current(globalId),
        }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.exchange.preview(globalId),
        }),
      ]);
    },
  });
}
