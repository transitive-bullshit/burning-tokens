import type { CSSProperties, ReactNode } from 'react'
import { useCallback, useRef, useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'

const motion = { duration: 240, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' }
const reducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function UploadedImageLightbox({
  children,
  src,
  alt,
  caption = '',
  downloadHref = src,
  downloadName = 'uploaded-image'
}: {
  children: ReactNode
  src: string
  alt: string
  caption?: string
  downloadHref?: string
  downloadName?: string
}) {
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState(src)
  const [ready, setReady] = useState(false)
  const [ratio, setRatio] = useState(1)
  const trigger = useRef<HTMLButtonElement>(null)
  const frame = useRef<HTMLButtonElement | null>(null)
  const origin = useRef<DOMRect | null>(null)
  const animation = useRef<Animation | null>(null)
  const closing = useRef(false)
  const dismissedWithEscape = useRef(false)

  const transformFrom = (target: DOMRect, source: DOMRect) =>
    `translate(${source.x - target.x}px, ${source.y - target.y}px) scale(${source.width / target.width}, ${source.height / target.height})`

  const mountFrame = useCallback((node: HTMLButtonElement | null) => {
    frame.current = node
    if (!node || !origin.current || reducedMotion()) return
    animation.current = node.animate(
      [
        {
          transform: transformFrom(node.getBoundingClientRect(), origin.current)
        },
        { transform: 'none' }
      ],
      motion
    )
    return () => animation.current?.cancel()
  }, [])

  function changeOpen(next: boolean) {
    if (next) {
      const inline = trigger.current?.querySelector('img')
      origin.current = inline?.getBoundingClientRect() ?? null
      setPreview(inline?.currentSrc || src)
      if (inline?.naturalWidth && inline.naturalHeight)
        setRatio(inline.naturalWidth / inline.naturalHeight)
      setReady(false)
      dismissedWithEscape.current = false
      closing.current = false
      setOpen(true)
    } else if (!closing.current) {
      closing.current = true
      const node = frame.current
      const destination = trigger.current
        ?.querySelector('img')
        ?.getBoundingClientRect()
      if (node && destination && !reducedMotion()) {
        const current = getComputedStyle(node).transform
        animation.current?.cancel()
        const end = transformFrom(node.getBoundingClientRect(), destination)
        animation.current = node.animate(
          [{ transform: current }, { transform: end }],
          { ...motion, fill: 'forwards' }
        )
        void animation.current.finished.then(
          () => setOpen(false),
          () => setOpen(false)
        )
      } else setOpen(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <button
          ref={trigger}
          type='button'
          className='uploaded-image-lightbox-trigger'
          aria-label={alt ? `Enlarge image: ${alt}` : 'Enlarge image'}
        >
          {children}
        </button>
      </DialogTrigger>
      <DialogContent
        className='uploaded-image-lightbox'
        overlayClassName='uploaded-image-lightbox-overlay'
        onClick={(event) => {
          if (event.target === event.currentTarget) changeOpen(false)
        }}
        onEscapeKeyDown={() => {
          dismissedWithEscape.current = true
        }}
        onCloseAutoFocus={(event) => {
          if (dismissedWithEscape.current) {
            event.preventDefault()
            trigger.current?.blur()
          }
        }}
      >
        <DialogTitle className='sr-only'>{alt || 'Image preview'}</DialogTitle>
        <button
          ref={mountFrame}
          type='button'
          className='uploaded-image-lightbox-frame'
          aria-label={alt ? `Zoom out image: ${alt}` : 'Zoom out image'}
          onClick={() => changeOpen(false)}
          style={{ '--image-ratio': ratio } as CSSProperties}
        >
          <img
            src={preview}
            alt={ready ? '' : alt}
            aria-hidden={ready}
            className='uploaded-image-lightbox-image uploaded-image-lightbox-preview'
          />
          <img
            src={src}
            alt={alt}
            aria-hidden={!ready}
            loading='eager'
            decoding='async'
            onLoad={(event) => {
              const image = event.currentTarget
              if (image.naturalWidth && image.naturalHeight)
                setRatio(image.naturalWidth / image.naturalHeight)
              setReady(true)
            }}
            className='uploaded-image-lightbox-image uploaded-image-lightbox-full'
            style={{ opacity: ready ? 1 : 0 }}
          />
        </button>
        <DialogDescription
          className={caption ? 'uploaded-image-lightbox-caption' : 'sr-only'}
        >
          {caption || 'Enlarged uploaded image'}
        </DialogDescription>
        <Button asChild variant='ghost' size='sm'>
          <a href={downloadHref} download={downloadName}>
            <Download data-icon='inline-start' />
            Download image
          </a>
        </Button>
      </DialogContent>
    </Dialog>
  )
}
