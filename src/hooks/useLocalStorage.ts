"use client";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { z } from "zod";
import {
  readStorage,
  subscribeStorage,
  writeStorageBatch,
} from "@/lib/local-storage-store";

export function useLocalStorage<S extends z.ZodType>(
  key: string,
  initialValue: z.output<S>,
  schema: S,
) {
  const raw = useSyncExternalStore(
    subscribeStorage,
    useCallback(() => readStorage(key), [key]),
    () => null,
  );
  const value = useMemo(() => {
    if (raw === null) return initialValue;
    try {
      const parsed = schema.safeParse(JSON.parse(raw));
      return parsed.success ? parsed.data : initialValue;
    } catch {
      return initialValue;
    }
  }, [raw, schema, initialValue]);
  const updateValue = useCallback(
    (next: z.output<S>) => {
      writeStorageBatch({ [key]: JSON.stringify(schema.parse(next)) });
    },
    [key, schema],
  );
  const removeValue = useCallback(
    () => writeStorageBatch({ [key]: null }),
    [key],
  );
  return [value, updateValue, removeValue] as const;
}
