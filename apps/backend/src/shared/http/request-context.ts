import { AsyncLocalStorage } from 'node:async_hooks';

// Per-request context carried through the call stack. Services read this — they never receive `req`.

export interface RequestContext {
  requestId: string;
  userId?: string;
  role?: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

export const getContext = (): RequestContext | undefined => requestContext.getStore();
