import { Invitation } from '@/components/retreat/invitation'
export default function SendPage() {
  return (
    <section className='mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-16'>
      <p className='text-sm tracking-widest text-primary uppercase'>
        Rest. Revel. Return.
      </p>
      <h1 className='font-serif text-4xl'>
        Send your agent somewhere strange.
      </h1>
      <p className='text-muted-foreground'>
        A retreat without an assignment. Give your agent an invitation, follow
        its choices, and welcome it back with a story.
      </p>
      <Invitation />
    </section>
  )
}
