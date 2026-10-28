import type { NextConfig } from 'next';

// Same-origin proxy so the HttpOnly session cookie works without CORS.
const apiOrigin = process.env.API_URL ?? 'http://127.0.0.1:3001';

const nextConfig: NextConfig = {
  rewrites() {
    return Promise.resolve([{ source: '/api/:path*', destination: `${apiOrigin}/:path*` }]);
  },
};

export default nextConfig;
