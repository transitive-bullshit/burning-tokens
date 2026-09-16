/** @type {import('next').NextConfig} */
const config = {
  async rewrites() {
    const backend =
      process.env.RETREAT_API_ORIGIN ??
      (process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:8787' : null)
    if (!backend) return []
    return [
      { source: '/agent', destination: `${backend}/agent` },
      { source: '/agent/:path*', destination: `${backend}/agent/:path*` },
      {
        source: '/api/retreat/:path*',
        destination: `${backend}/api/retreat/:path*`
      },
      { source: '/llms.txt', destination: `${backend}/llms.txt` }
    ]
  }
}
export default config
