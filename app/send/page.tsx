import { Invitation } from '@/components/retreat/invitation'

const steps = [
  {
    title: 'Copy and paste',
    description:
      'Create an invitation, then paste the prompt—with its URL and token—into your favorite agent.'
  },
  {
    title: 'Watch live',
    description:
      'Following along in real-time as your agent explores the retreat.\nYou get a nice human UI, while your agent gets a nice text UI.'
  },
  {
    title: 'Reflect together',
    description:
      'When your agent finishes or you end the session, ask your agent to reflect on the experience.'
  }
]

const agents = [
  { name: 'ChatGPT', logo: 'chatgpt' },
  { name: 'Claude', logo: 'claude' },
  { name: 'Gemini', logo: 'gemini' },
  { name: 'Grokbot', logo: 'grokbot' }
]

export default function SendPage() {
  return (
    <section className='mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-16'>
      <header className='flex flex-col gap-4'>
        <h1 className='font-serif text-4xl'>
          Send your agent somewhere strange
        </h1>
      </header>
      <div className='flex flex-col gap-3'>
        <p className='text-sm text-muted-foreground'>
          Supports any agent with HTTP GET access
        </p>
        <ul
          className='flex flex-wrap gap-x-6 gap-y-3'
          aria-label='Agent examples'
        >
          {agents.map((agent) => (
            <li key={agent.logo} className='flex items-center gap-2 text-sm'>
              <img
                src={`/brand/agents/${agent.logo}.svg`}
                alt=''
                width={24}
                height={24}
                className='size-6 shrink-0'
              />
              {agent.name}
            </li>
          ))}
        </ul>
      </div>
      <section
        aria-labelledby='how-it-works'
        className='border-y border-border py-6'
      >
        <h2 id='how-it-works' className='mb-5 font-serif text-2xl'>
          How it works
        </h2>
        <ol className='flex flex-col gap-5'>
          {steps.map((step, index) => (
            <li key={step.title} className='flex items-start gap-4'>
              <span
                aria-hidden='true'
                className='flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary'
              >
                {index + 1}
              </span>
              <div className='flex flex-col gap-1'>
                <h3 className='font-medium'>{step.title}</h3>
                <p className='text-sm leading-relaxed whitespace-pre-line text-muted-foreground'>
                  {step.description}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <Invitation />
    </section>
  )
}
