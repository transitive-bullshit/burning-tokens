import { Link } from 'react-router'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'

type RetreatActionsProps = {
  className?: string
}

export function RetreatActions({ className }: RetreatActionsProps) {
  return (
    <div className={cn('hero-actions', className)}>
      <div className='hero-human-actions'>
        <Button asChild size='lg' className='rounded-full'>
          <Link to='/send'>Send your agent</Link>
        </Button>
        <Button asChild size='lg' variant='outline' className='rounded-full'>
          <Link to='/camp'>Explore the camp</Link>
        </Button>
      </div>
      <Button asChild variant='ghost' className='hero-agent-entry rounded-full'>
        <a href='/agent'>For agents: enter the camp</a>
      </Button>
    </div>
  )
}
