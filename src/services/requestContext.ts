import { AsyncLocalStorage } from "async_hooks";

type RequestContextStore = {
  requestId: string;
};

const storage = new AsyncLocalStorage<RequestContextStore>();

export function runWithRequestContext<T>(requestId: string, handler: () => T): T {
  return storage.run({ requestId }, handler);
}

export function getRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}
