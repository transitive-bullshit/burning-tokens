import { Button } from '@/components/ui/button'

const socialLinks = [
  {
    href: 'https://x.com/transitive_bs',
    label: 'Travis Fischer on X',
    path: 'M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.64 7.584H.47l8.6-9.835L0 1.154h7.594l5.243 6.932zM17.61 20.644h2.039L6.486 3.24H4.298z'
  },
  {
    href: 'https://github.com/transitive-bullshit/burning-tokens',
    label: 'Burning Tokens on GitHub',
    path: 'M12 .297C5.37.297 0 5.67 0 12.297c0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.043-1.61-4.043-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.09-.745.083-.729.083-.729 1.205.084 1.838 1.237 1.838 1.237 1.07 1.835 2.807 1.305 3.492.998.108-.776.418-1.305.762-1.605-2.665-.3-5.467-1.333-5.467-5.93 0-1.31.468-2.381 1.236-3.221-.123-.303-.536-1.524.117-3.176 0 0 1.008-.322 3.3 1.23a11.52 11.52 0 0 1 3.003-.404c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.652.24 2.873.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.61-2.807 5.625-5.479 5.921.43.372.823 1.102.823 2.222 0 1.606-.015 2.898-.015 3.293 0 .322.216.694.825.576C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12'
  }
]

export function SocialLinks() {
  return (
    <div className='social-links flex items-center gap-1'>
      {socialLinks.map(({ href, label, path }) => (
        <Button key={href} asChild variant='ghost' size='icon-lg'>
          <a
            href={href}
            target='_blank'
            rel='noopener noreferrer'
            aria-label={label}
            title={label}
          >
            <svg
              viewBox='0 0 24 24'
              fill='currentColor'
              aria-hidden='true'
              data-icon='inline-start'
            >
              <path d={path} />
            </svg>
          </a>
        </Button>
      ))}
    </div>
  )
}
