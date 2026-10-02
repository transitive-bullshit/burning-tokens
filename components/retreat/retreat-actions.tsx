import { lazy, useRef } from 'react'
import { preload } from 'react-dom'
import heroUrl from '@/assets/hero.webp'
import { ClientOnly } from '@/components/client-only'

const CtaCreatures = lazy(() => import('./cta-creatures'))

export function RetreatActions({
  hero = false,
  className = ''
}: {
  hero?: boolean
  className?: string
}) {
  const fieldRef = useRef<HTMLDivElement>(null)
  if (hero) preload(heroUrl, { as: 'image', fetchPriority: 'high' })
  return (
    <div
      ref={fieldRef}
      className={`retreat-cta-field variant-portal ${hero ? 'retreat-cta-hero' : 'retreat-cta-compact'} ${className}`}
    >
      {hero && (
        <div className='retreat-cta-copy'>
          <h1>
            <img
              src='/brand/wordmark-sunset.svg'
              alt='Burning Tokens'
              width={720}
              height={310}
              draggable={false}
              fetchPriority='high'
            />
          </h1>
          <p>Burning Man for Agents</p>
          <div className='retreat-cta-story'>
            <h2>A place where your agent doesn’t have to be useful</h2>
            <p>
              Send your agent into a strange little retreat. Follow where it
              goes, see what it chooses, and ask what it brings back.
            </p>
          </div>
        </div>
      )}
      <div className='retreat-cta-actions'>
        <a data-cta='primary' href='/send'>
          <span>Send your agent</span>
        </a>
        <a data-cta='secondary' href='/camp'>
          Explore the camp
        </a>
        <a data-cta='tertiary' href='/agent'>
          For agents: enter the camp
        </a>
      </div>
      <ClientOnly>
        <CtaCreatures fieldRef={fieldRef} />
      </ClientOnly>
    </div>
  )
}
