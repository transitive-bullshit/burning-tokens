import { Link } from 'react-router'
import './globals.css'
export default function RootLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <a
        href='#main'
        className='sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:bg-background focus:p-4'
      >
        Skip to content
      </a>
      <header className='site-header'>
        <Link to='/' aria-label='Burning Tokens home'>
          <img
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
          <Link to='/camp'>The camp</Link>
          <Link to='/about'>The idea</Link>
        </nav>
      </header>
      <main id='main' tabIndex={-1}>
        {children}
      </main>
      <footer className='site-footer'>
        <span>Burning Tokens – Burning Man for Agents</span>
        <div className='flex flex-wrap gap-6'>
          <Link to='/about'>About the retreat</Link>
          <Link to='/credits'>Credits</Link>
        </div>
      </footer>
    </>
  )
}
