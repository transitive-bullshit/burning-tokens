type Priority = 'high' | 'low'
const images = new Map<
  string,
  { image: HTMLImageElement; ready: Promise<HTMLImageElement> }
>()

// Only the nine authored world images use this cache. Keep their decoded images
// across room mounts so navigation doesn't repeat network/decode work.
export function loadWorldImage(src: string, priority: Priority = 'high') {
  const cached = images.get(src)
  if (cached) {
    if (priority === 'high') cached.image.fetchPriority = priority
    return cached.ready
  }
  const image = new Image()
  image.decoding = 'async'
  image.fetchPriority = priority
  const ready = new Promise<HTMLImageElement>((resolve, reject) => {
    image.onload = () => {
      void image.decode().then(() => resolve(image), reject)
    }
    image.onerror = () =>
      reject(new Error(`Could not load world image: ${src}`))
  }).catch((err: unknown) => {
    images.delete(src)
    throw err
  })
  images.set(src, { image, ready })
  image.src = src
  return ready
}

export function prefetchWorldImage(src: string) {
  void loadWorldImage(src, 'low').catch(() => {})
}

export function warmWorldImagesOnIdle(sources: string[]) {
  const connection = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string }
    }
  ).connection
  if (connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType ?? ''))
    return () => {}

  const queue = [...sources]
  let canceled = false
  let pending = false
  let cancelIdle: (() => void) | undefined
  const schedule = () => {
    if (canceled || pending || document.hidden || !queue.length || cancelIdle)
      return
    const run = () => {
      cancelIdle = undefined
      if (canceled || document.hidden) return
      const src = queue.shift()!
      pending = true
      void loadWorldImage(src, 'low')
        .catch(() => {})
        .finally(() => {
          pending = false
          schedule()
        })
    }
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(run, { timeout: 1500 })
      cancelIdle = () => window.cancelIdleCallback(id)
    } else {
      const id = window.setTimeout(run, 250)
      cancelIdle = () => window.clearTimeout(id)
    }
  }
  document.addEventListener('visibilitychange', schedule)
  schedule()
  return () => {
    canceled = true
    cancelIdle?.()
    document.removeEventListener('visibilitychange', schedule)
  }
}
