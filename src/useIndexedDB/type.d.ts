export type ValueOf<T> = T extends { [K in keyof T]: infer U } ? U : never;

export type RequestMethod<T> = {
  [K in keyof T]: T[K] extends (...arg: unknown[]) => IDBRequest ? K : never;
};

export type RequestMethodKey<T> = ValueOf<RequestMethod<T>>;

export type RequestMethodReturn<T> = ReturnType<
  Valueof<Pick<T, RequestMethodKey<T>>>
>;

export type AsyncWrapper<T> = {
  [K in keyof T]: T[K] extends (...arg: any) => IDBRequest
    ? (...arg: Parameters<T[K]>) => Promise<ReturnType<T[K]>>
    : T[K];
};
