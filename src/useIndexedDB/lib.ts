import type { AsyncWrapper } from "./type";

export function isFunction(fn: unknown): fn is Function {
  return typeof fn === "function";
}

export function isArray<T>(value: unknown): value is T[] {
  return Array.isArray(value);
}

// * transform IDBRequest to Promise<IDBRequest>
export function transformRequestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

type RequestEntry = IDBObjectStore | IDBIndex;
// * wrap objectStore IDBRequest methods to Promise<IDBRequest>
export function asyncWrapper<T extends RequestEntry>(entry: T) {
  return <AsyncWrapper<T>>(<unknown>new Proxy(entry, {
    get: function (target: T, key: PropertyKey, receiver: T) {
      const prop = Reflect.get(target, key, receiver);
      return isFunction(prop)
        ? new Proxy(
            // ! cause illegal invocation if not bind entry
            prop.bind(entry),
            {
              apply(
                target: (...arg: unknown[]) => unknown,
                thisArg: T,
                argArray: Parameters<typeof target>
              ) {
                const result = Reflect.apply(target, thisArg, argArray);
                return result instanceof IDBRequest
                  ? transformRequestToPromise(result)
                  : result;
              },
            }
          )
        : prop;
    },
  }));
}
