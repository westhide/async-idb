import type { AsyncWrapper, RequestMethodReturn } from "./useIndexedDB";
import {
  isArray,
  isFunction,
  indexedDBPreset,
  transformRequestToPromise,
  asyncWrapper,
} from "./useIndexedDB";

interface Index {
  name: string;
  keyPath: string | string[];
  options?: IDBIndexParameters;
}

interface Schema<
  StoreName extends string,
  Data extends Record<PropertyKey, unknown>
> {
  name: StoreName;
  // TODO: auto init data
  data?: Data;
  options?: IDBObjectStoreParameters;
  indexes?: Index[];
}

type EventType = keyof IDBOpenDBRequestEventMap;
type RequestCallBack<T> = (result: T, request?: IDBRequest<T>) => unknown;

interface Operator<T> {
  type: EventType;
  fn: RequestCallBack<T>;
  options?: AddEventListenerOptions | boolean;
}

// TODO: cache store & data
type Store = AsyncWrapper<IDBObjectStore>;
type ResultValue = RequestMethodReturn<IDBObjectStore>;
type Cache<StoreName extends string> = {
  [K in StoreName]: {
    storeMap: Map<StoreName | StoreName[], Store>;
    resultMap: WeakMap<object, ResultValue>;
  };
};

type RequestEvent<T> = Partial<Record<`on${EventType}`, RequestCallBack<T>>>;

type DBOperator = Operator<IDBDatabase>;
type DBRequestEvent = RequestEvent<IDBDatabase>;

interface Options<
  StoreName extends string,
  Data extends Record<PropertyKey, unknown>
> {
  name: string;
  schemas: Schema<StoreName, Data>[];
  events?: DBRequestEvent;
  version?: number;
  preset?: Partial<typeof indexedDBPreset>;
}

export class IndexedDB<
  StoreName extends string,
  Data extends Record<PropertyKey, unknown>
> {
  options: Options<StoreName, Data>;
  preset: typeof indexedDBPreset;
  openDBRequest?: IDBOpenDBRequest;
  private _idb?: IDBDatabase;
  private readonly _cache: Cache<StoreName>;

  get idb() {
    if (this._idb === undefined) throw new Error("IndexDB undefined");
    return this._idb;
  }
  set idb(idb: IDBDatabase) {
    this._idb = idb;
  }

  get name() {
    return this.idb.name;
  }

  get version() {
    return this.idb.version;
  }

  open(name = this.name, version?: number) {
    return indexedDB.open(name, version);
  }

  getCache(
    storeName: StoreName,
    key: { storeKey?: StoreName | StoreName[]; resultKey?: object }
  ) {
    const { storeMap, resultMap } = this._cache[storeName];
    const { storeKey, resultKey } = key;
    return {
      store: storeKey ? storeMap.get(storeKey) : undefined,
      result: resultKey ? resultMap.get(resultKey) : undefined,
    };
  }

  setCache(
    storeName: StoreName,
    mapTuples: {
      store?: [StoreName | StoreName[], Store];
      result?: [object, ResultValue];
    }
  ) {
    const cacheStore = this._cache[storeName];
    const { store, result } = mapTuples;
    if (store) cacheStore.storeMap.set(...store);
    if (result) cacheStore.resultMap.set(...result);
  }

  // * mount operators to indexedDB request
  listen(
    fn: DBOperator["fn"],
    type?: DBOperator["type"],
    options?: DBOperator["options"]
  ): unknown;
  listen(operators: DBOperator | DBOperator[]): unknown;
  listen(
    operators: unknown,
    type: DBOperator["type"] = "success",
    options?: DBOperator["options"]
  ) {
    if (isFunction(operators))
      operators = {
        type,
        fn: operators,
        options,
      };
    if (!isArray(operators)) operators = [operators];

    const request = this.open();

    for (const operator of <DBOperator[]>operators) {
      const { type, fn, options } = operator;
      request.addEventListener(
        type,
        () => fn(request.result, request),
        options
      );
    }
  }

  // * add callback function to request event
  addEvent(events: DBRequestEvent, request = this.open()) {
    for (const [key, fn] of Object.entries(events)) {
      // * remove 'on' prefix to get event type
      const type = <EventType>key.substring(2);
      request.addEventListener(type, () => fn(request.result, request));
    }
  }

  constructor(options: Options<StoreName, Data>) {
    this.preset = { ...indexedDBPreset, ...options.preset };
    this.options = options;
    this._cache = <Cache<StoreName>>(
      Object.fromEntries(
        options.schemas.map(({ name }) => [
          name,
          { storeMap: new Map(), resultMap: new WeakMap() },
        ])
      )
    );
    if (this.preset.isAutoInit) this.init();
  }

  async init() {
    const { name, schemas, events, version } = this.options;
    const { isDropDatabaseIfExist, isAutoCreateStore } = this.preset;

    // * delete database if exist
    if (isDropDatabaseIfExist) this.drop(name);

    const request = this.open(name, version);

    const onupgradeneeded = () => {
      for (const {
        name: storeName,
        options: storeOptions,
        indexes,
      } of schemas) {
        // * create stores
        const store = request.result.createObjectStore(storeName, storeOptions);

        // * create indexes
        if (indexes) {
          for (const {
            name: indexName,
            keyPath,
            options: indexOptions,
          } of indexes) {
            store.createIndex(indexName, keyPath, indexOptions);
          }
        }
      }
    };

    const onsuccess = () => {
      const idb = request.result;
      // TODO: fix behavior when upgrade version (close indexedDB at present)
      idb.addEventListener("versionchange", () => idb.close());
      this._idb = idb;
    };

    this.addEvent({ onsuccess }, request);
    if (isAutoCreateStore) this.addEvent({ onupgradeneeded }, request);
    if (events) this.addEvent(events, request);

    this.openDBRequest = request;
    return transformRequestToPromise(request);
  }

  transaction(storeName: StoreName | StoreName[], mode?: IDBTransactionMode) {
    return this.idb.transaction(storeName, mode);
  }

  store<S extends StoreName, N extends Extract<StoreName, S>>(
    storeName: N,
    options: {
      transactionStoreNames?: S[];
      mode?: IDBTransactionMode;
    } = {}
  ) {
    const { transactionStoreNames = storeName, mode = "readwrite" } = options;
    const transaction = this.transaction(transactionStoreNames, mode);
    const store = transaction.objectStore(storeName);
    return asyncWrapper(store);
  }

  index<S extends StoreName, N extends Extract<StoreName, S>>(
    storeName: N,
    indexName: string,
    options: {
      transactionStoreNames?: S[];
      mode?: IDBTransactionMode;
    } = {}
  ) {
    const { transactionStoreNames = storeName, mode = "readwrite" } = options;
    const transaction = this.transaction(transactionStoreNames, mode);
    const store = transaction.objectStore(storeName);
    const idbIndex = store.index(indexName);
    return asyncWrapper(idbIndex);
  }

  clear(storeName: StoreName | StoreName[]) {
    if (!isArray(storeName)) storeName = [storeName];
    return Promise.all(storeName.map((name) => this.store(name).clear()));
  }

  cursor(
    storeName: StoreName,
    query?: IDBValidKey | IDBKeyRange | null,
    direction?: IDBCursorDirection
  ) {
    return this.store(storeName).openCursor(query, direction);
  }

  close() {
    this.idb.close();
  }

  deleteStore(storeName: StoreName) {
    const request = this.open(this.name, this.version + 1);
    request.addEventListener("upgradeneeded", () => {
      const idb = request.result;
      idb.deleteObjectStore(storeName);
      this._idb = idb;
    });
    return transformRequestToPromise(request);
  }

  drop(name = this.name) {
    indexedDB.deleteDatabase(name);
  }
}
