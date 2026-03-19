import NodeCache from 'node-cache';

// Default TTL: 60 seconds — prevents hammering the Spring Boot API during multi-tool LLM calls
const cache = new NodeCache({ stdTTL: 60, checkperiod: 30 });

export function getCached<T>(key: string): T | undefined {
  return cache.get<T>(key);
}

export function setCached<T>(key: string, value: T, ttlSeconds?: number): void {
  cache.set(key, value, ttlSeconds ?? 60);
}

export function deleteCached(key: string): void {
  cache.del(key);
}

export function flushCache(): void {
  cache.flushAll();
}
