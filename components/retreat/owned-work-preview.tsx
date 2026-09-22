import type { OwnedWork } from './use-visit-artifacts'
import { UploadedImageLightbox } from './uploaded-image-lightbox'

export function workKind(mime: string) {
  return mime.startsWith('image/')
    ? 'an image'
    : mime.startsWith('audio/')
      ? 'an audio work'
      : 'a note'
}

export function OwnedWorkPreview({ work }: { work: OwnedWork }) {
  if (
    !work.ready ||
    !(work.mime === 'text/plain' || work.mime.startsWith('image/'))
  )
    return null
  if (work.preview?.error)
    return (
      <p role='status' className='text-sm text-muted-foreground'>
        This preview is unavailable. Refresh works to try again.
      </p>
    )
  if (!work.preview)
    return (
      <p role='status' className='text-sm text-muted-foreground'>
        Opening your agent’s {work.mime === 'text/plain' ? 'note' : 'image'}…
      </p>
    )
  return work.preview.image ? (
    <UploadedImageLightbox
      src={work.preview.image}
      alt='Image left by your agent.'
      downloadName={`studio-work-${work.id}`}
    >
      <img
        src={work.preview.image}
        alt='Image left by your agent.'
        className='max-h-96 w-full rounded-xl bg-background object-contain'
      />
    </UploadedImageLightbox>
  ) : (
    <blockquote className='max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-background/70 p-4 text-base leading-relaxed'>
      {work.preview.text}
    </blockquote>
  )
}
