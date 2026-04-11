import type { NextConfig } from 'next';

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.jsdelivr.net https://cdn.tailwindcss.com https://cdnjs.cloudflare.com https://unpkg.com",
      "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://cdn.tailwindcss.com https://cdnjs.cloudflare.com https://unpkg.com https://fonts.googleapis.com",
      "img-src 'self' blob: data: https:",
      "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://unpkg.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://generativelanguage.googleapis.com https://openrouter.ai https://cdn.jsdelivr.net https://cdn.tailwindcss.com https://cdnjs.cloudflare.com https://unpkg.com",
      "media-src 'self' blob: data:",
      "frame-ancestors 'none'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  output: process.env.VERCEL ? undefined : 'standalone',
  transpilePackages: ['mathml2omml', 'pptxgenjs'],
  serverExternalPackages: [],
  experimental: {
    proxyClientMaxBodySize: '200mb',
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
