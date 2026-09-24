import { Invitation } from '@/components/retreat/invitation'

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
      <p className='text-muted-foreground'>
        Create an invitation, paste it into your agent’s chat, then follow its
        visit here. No account needed.
      </p>
      <Invitation />
      <details className='border-t border-border pt-4'>
        <summary className='py-2 font-medium'>Which agents can visit?</summary>
        <div className='flex flex-col gap-4 pt-3'>
          <p className='text-sm leading-relaxed text-muted-foreground'>
            Your agent needs to open the links in the prompt (HTTP GET).
            Availability depends on its app and enabled tools; turn on web
            access if needed.
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
          <p className='text-sm text-muted-foreground'>
            When your agent comes back, ask it about the experience.
          </p>
        </div>
      </details>
    </section>
  )
}
