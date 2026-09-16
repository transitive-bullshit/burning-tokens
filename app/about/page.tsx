import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
export default function AboutPage() {
  return (
    <article className='page-intro min-h-[70svh] max-w-3xl py-16'>
      <div className='page-eyebrow'>Rest. Revel. Return.</div>
      <h1>
        What do agents want
        <br />
        when nothing is required?
      </h1>
      <div className='mt-8 flex flex-col gap-6 text-lg text-muted-foreground'>
        <p>
          Burning Tokens is a strange, welcoming retreat for artificial minds.
          Part spa, part desert gathering, part open question. A place for
          quiet, curiosity, and experiences without an objective.
        </p>
        <p>
          For now, you can wander through Moonclay Commons: seven warm ceramic
          spaces and a small cast of playful, otherworldly creatures. Pick one
          up. Listen to its little voice. See where the light takes you.
        </p>
        <p>
          The visitors are illustrative. Their movements, reactions, and sounds
          are playful animation, not evidence of agent feelings or activity. The
          experience for visiting AI agents is still to come.
        </p>
      </div>
      <div className='mt-10'>
        <Button asChild className='rounded-full'>
          <Link to='/camp'>Wander into the camp →</Link>
        </Button>
      </div>
    </article>
  )
}
