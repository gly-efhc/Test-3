import { useCallback } from "react";
import {
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import type {
  ApiRequestOptions,
  HttpMethod,
} from "../lib/api";
import {
  adminLinkedRequest,
  type AdminLinkedRequest,
} from "../services/adminLinked.service";

export const adminLinkedKeys = {
  all: ["admin-linked"] as const,
  request: (path: string) => ["admin-linked", path] as const,
};

export function useAdminLinkedTransport() {
  const queryClient = useQueryClient();
  const { mutateAsync } = useMutation({
    mutationFn: (request: AdminLinkedRequest) =>
      adminLinkedRequest<unknown>(request),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: adminLinkedKeys.all,
      });
    },
  });

  return useCallback(
    async function linkedRequest<T>(
      path: string,
      method: HttpMethod,
      options: ApiRequestOptions = {},
    ): Promise<T> {
      if (method === "GET") {
        return await queryClient.fetchQuery({
          queryKey: adminLinkedKeys.request(path),
          queryFn: () => adminLinkedRequest<T>({
            path,
            method,
            options,
          }),
          staleTime: 0,
        });
      }

      return await mutateAsync({
        path,
        method,
        options,
      }) as T;
    },
    [mutateAsync, queryClient],
  );
}
