import type { NextConfig } from 'next';

// Same-origin proxy so the HttpOnly session cookie works without CORS.
const apiOrigin = process.env.API_URL ?? 'http://127.0.0.1:3001';
// Demo build (Vercel): no backend; /api/* is answered by app/demo-api from a data snapshot.
const demo = process.env.NEXT_PUBLIC_DEMO_MODE === '1';

const nextConfig: NextConfig = {
  rewrites() {
    return Promise.resolve([
      { source: '/api/:path*', destination: demo ? '/demo-api/:path*' : `${apiOrigin}/:path*` },
    ]);
  },
};

export default nextConfig;
