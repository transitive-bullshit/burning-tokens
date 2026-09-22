// SSR shares component types with the browser. DOM's CacheStorage omits the
// Workers-only default cache; preserve that binding in the combined typecheck.
interface CacheStorage {
  readonly default: Cache
}
