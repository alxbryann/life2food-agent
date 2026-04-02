import { AsyncLocalStorage } from 'node:async_hooks';

const springBootFirebaseToken = new AsyncLocalStorage<string | undefined>();

/**
 * Firebase ID token (sin prefijo "Bearer") del request actual, para reenviarlo al Spring Boot.
 */
export function runWithSpringBootAuth<T>(token: string | undefined, fn: () => T | Promise<T>): T | Promise<T> {
  return springBootFirebaseToken.run(token, fn);
}

export function getSpringBootFirebaseToken(): string | undefined {
  return springBootFirebaseToken.getStore();
}

export function firebaseIdTokenFromRequest(req: {
  headers: { authorization?: string };
}): string | undefined {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return undefined;
  return h.slice(7);
}
