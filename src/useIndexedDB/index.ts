export type { AsyncWrapper, RequestMethodReturn } from "./type";

export { default as indexedDBPreset } from "./preset";
export { default as indexedDBWorker } from "./worker?worker";
export {
  isArray,
  isFunction,
  transformRequestToPromise,
  asyncWrapper,
} from "./lib";
