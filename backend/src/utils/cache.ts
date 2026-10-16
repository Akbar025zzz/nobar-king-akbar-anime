import NodeCache from "node-cache";

/**
 * TTL cache + in-flight request coalescing.
 *
 * Request deduplication: when 20 users ask for the same anime detail at the
 * same time, only ONE source request is performed and all 20 consumers await
 * the same promise.
 */

const store = new NodeCache({ stdTTL: 300, checkperiod: 120, useClones: false });

const inflight = new Map<string, Promise<unknown>>();

export async function cached<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>
): Promise<T> {
  const hit = store.get<T>(key);
  if (hit !== undefined) {
    return hit;
  }

  const pending = inflight.get(key);
  if (pending) {
    return pending as Promise<T>;
  }

  const promise = loader()
    .then((value) => {
      store.set(key, value, ttlSeconds);
      return value;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}

export function invalidate(prefix: string): void {
  const keys = store.keys().filter((key) => key.startsWith(prefix));
  if (keys.length > 0) {
    store.del(keys);
  }
}

export function getOrNull<T>(key: string): T | null {
  const value = store.get<T>(key);
  return value === undefined ? null : value;
}

export function set(key: string, value: unknown, ttlSeconds: number): void {
  store.set(key, value, ttlSeconds);
}

export function cacheStats() {
  return store.getStats();
}
