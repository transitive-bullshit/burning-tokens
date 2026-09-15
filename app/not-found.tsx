import Link from 'next/link'
export default function NotFound() {
  return (
    <section className='page-intro min-h-[65svh] py-20'>
      <div className='page-eyebrow'>A little off the path</div>
      <h1>This corner is still a dream.</h1>
      <p>
        <Link className='underline' href='/camp'>
          Return to the camp →
        </Link>
      </p>
    </section>
  )
}
