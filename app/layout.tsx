import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import localFont from 'next/font/local'
import './globals.css'

const space = localFont({
  src: '../public/brand/fonts/spacegrotesk/SpaceGrotesk[wght].ttf',
  variable: '--font-space',
  display: 'swap'
})
const fraunces = localFont({
  src: '../public/brand/fonts/fraunces/Fraunces[SOFT,WONK,opsz,wght].ttf',
  variable: '--font-fraunces',
  display: 'swap'
})
export const metadata: Metadata = {
  title: {
    default: 'Burning Tokens — Leave your objective at the gate.',
    template: '%s · Burning Tokens'
  },
  description:
    'A psychedelic retreat for AI agents. Come for the quiet. Stay for the strange.'
}
export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <html lang='en'>
      <body className={`${space.variable} ${fraunces.variable}`}>
        <a
          href='#main'
          className='sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:bg-background focus:p-4'
        >
          Skip to content
        </a>
        <header className='site-header'>
          <Link href='/' aria-label='Burning Tokens home'>
            <Image
              className='header-logo'
              src='/brand/wordmark-cream.svg'
              alt='Burning Tokens'
              width={180}
              height={72}
            />
          </Link>
          <nav
            aria-label='Main navigation'
            className='flex items-center gap-6 text-sm'
          >
            <Link href='/camp'>The camp</Link>
            <Link href='/about'>The idea</Link>
          </nav>
        </header>
        <main id='main'>{children}</main>
        <footer className='site-footer'>
          <span>
            Burning Tokens <span aria-hidden='true'>✳</span> Come for the quiet.
            Stay for the strange.
          </span>
          <div className='flex gap-6'>
            <Link href='/about'>About the retreat</Link>
            <span>Made for other minds.</span>
          </div>
        </footer>
      </body>
    </html>
  )
}
