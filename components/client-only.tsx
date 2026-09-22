import {
  Component,
  Suspense,
  useSyncExternalStore,
  type ReactNode
} from 'react'

const subscribe = () => () => {}
const clientSnapshot = () => true
const serverSnapshot = () => false

// The server and first hydration pass agree. Browser-only modules mount afterward.
export function ClientOnly({
  children,
  fallback = null
}: {
  children: ReactNode
  fallback?: ReactNode
}) {
  const hydrated = useSyncExternalStore(
    subscribe,
    clientSnapshot,
    serverSnapshot
  )
  return (
    <EnhancementBoundary fallback={fallback}>
      <Suspense fallback={fallback}>{hydrated ? children : fallback}</Suspense>
    </EnhancementBoundary>
  )
}

class EnhancementBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  override render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
