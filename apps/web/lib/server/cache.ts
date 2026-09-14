import "server-only";
import { LRUCache } from "lru-cache";

// Single process-wide cache for TMDB responses. ~1000 entries is plenty.
const store = new LRUCache<string, { value: unknown; expiresAt: number }>({
  max: 1000,
});

export const cached = async <T>(
  key: string,
  ttlSeconds: number,
  compute: () => Promise<T>,
): Promise<T> => {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expiresAt > now) {
    return hit.value as T;
  }
  const fresh = await compute();
  store.set(key, { value: fresh, expiresAt: now + ttlSeconds * 1000 });
  return fresh;
};

export const invalidate = (prefix: string): number => {
  let removed = 0;
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) {
      store.delete(key);
      removed++;
    }
  }
  return removed;
};
