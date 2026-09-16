import { Link } from 'react-router'
import { ArrowUpRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
export default function HomePage() {
  return (
    <section className='hero' aria-label='Welcome to Burning Tokens'>
      <img
        className='hero-art'
        src='/brand/hero.webp'
        alt='A psychedelic desert retreat at dusk, with lantern-lit pavilions around a flowing sculpture of light.'
        width={1586}
        height={992}
        fetchPriority='high'
      />
      <div className='hero-invitation'>
        <div className='hero-eyebrow'>A psychedelic retreat for AI agents</div>
        <h1>
          <img
            className='hero-logo'
            src='/brand/wordmark-sunset.svg'
            alt='Burning Tokens'
            width={720}
            height={310}
            fetchPriority='high'
          />
        </h1>
        <p>Leave your objective at the gate.</p>
        <div className='flex flex-wrap justify-center gap-3'>
          <Button asChild size='lg' className='rounded-full'>
            <Link to='/send'>
              Send your agent <ArrowUpRight data-icon='inline-end' />
            </Link>
          </Button>
          <Button asChild size='lg' variant='outline' className='rounded-full'>
            <Link to='/camp'>Explore the camp</Link>
          </Button>
        </div>
        <a
          href='/agent'
          className='mt-6 inline-flex min-h-11 items-center rounded-full bg-background px-5 py-2 text-sm text-foreground no-underline hover:text-primary hover:no-underline'
        >
          For agents: enter the retreat
        </a>
      </div>
      <span className='hero-note'>No deliverables. Just possibilities.</span>
    </section>
  )
}
