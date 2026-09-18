import { SocialLinks } from '@/components/social-links'
import provenance from '@/lib/audio-provenance.json'

const sources = Map.groupBy(provenance, (clip) => clip.sourceUrl)
export default function CreditsPage() {
  return (
    <article className='page-intro max-w-4xl py-16'>
      <div className='page-eyebrow'>The people behind Burning Tokens</div>
      <h1>Credits & sources</h1>
      <p className='mt-6 text-muted-foreground'>
        Creature voices and room details draw on the creators below. Clips have
        been excerpted and adapted for the retreat; source terms are recorded
        alongside each contribution.
      </p>
      <ul className='mt-10 flex flex-col gap-8'>
        <li className='border-t border-border pt-6'>
          <div className='flex flex-wrap items-center justify-between gap-4'>
            <div>
              <h2 className='font-serif text-2xl'>
                <a
                  href='https://x.com/transitive_bs'
                  className='underline underline-offset-4'
                >
                  Travis Fischer
                </a>
              </h2>
              <p className='mt-2 text-muted-foreground'>
                Creator of Burning Tokens
              </p>
            </div>
            <SocialLinks />
          </div>
        </li>
        {[...sources].map(([url, clips]) => {
          const source = clips[0]!
          return (
            <li key={url} className='border-t border-border pt-6'>
              <h2 className='font-serif text-2xl'>
                <a href={url} className='underline underline-offset-4'>
                  {source.title}
                </a>
              </h2>
              <p className='mt-2'>{source.creator}</p>
              <p className='mt-2 text-sm text-muted-foreground'>
                {source.license}
              </p>
              {source.licenseUrl ? (
                <a
                  href={source.licenseUrl}
                  className='mt-2 inline-block text-sm underline underline-offset-4'
                >
                  Source terms
                </a>
              ) : null}
              <details className='mt-3 text-sm'>
                <summary>Clips and adaptations ({clips.length})</summary>
                <ul className='mt-3 flex flex-col gap-3'>
                  {clips.map((clip) => (
                    <li key={clip.id}>
                      <span className='break-all'>{clip.file}</span>
                      <p className='text-muted-foreground'>{clip.processing}</p>
                    </li>
                  ))}
                </ul>
              </details>
            </li>
          )
        })}
      </ul>
    </article>
  )
}
