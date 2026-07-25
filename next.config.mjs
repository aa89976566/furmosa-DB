/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  async redirects() {
    return [
      { source: '/supply', destination: '/jar-exchange/manage?tab=codes', permanent: true },
      { source: '/supply/codes', destination: '/jar-exchange/manage?tab=codes', permanent: true },
      { source: '/supply/members', destination: '/jar-exchange/members', permanent: true },
      { source: '/supply/rewards', destination: '/jar-exchange/manage?tab=rewards', permanent: true },
      { source: '/supply/:path*', destination: '/jar-exchange/manage?tab=codes', permanent: true },
    ];
  },
  /**
   * CDN Cache HIT 策略（對齊最快網站的 X-Cache: HIT / 可快取 HTML）：
   * - 靜態資產 immutable
   * - 公開殼層（login / store-redeem）短 s-maxage + SWR
   * 認證後台 HTML 由 middleware 設 private, no-store
   */
  async headers() {
    return [
      {
        source: '/icons/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/manifest.webmanifest',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800',
          },
        ],
      },
      {
        source: '/login',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=3600, stale-while-revalidate=86400',
          },
          {
            key: 'CDN-Cache-Control',
            value: 'public, s-maxage=3600, stale-while-revalidate=86400',
          },
          {
            key: 'Vercel-CDN-Cache-Control',
            value: 'public, s-maxage=3600, stale-while-revalidate=86400',
          },
        ],
      },
      {
        source: '/store-redeem',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=60, stale-while-revalidate=600',
          },
          {
            key: 'CDN-Cache-Control',
            value: 'public, s-maxage=60, stale-while-revalidate=600',
          },
          {
            key: 'Vercel-CDN-Cache-Control',
            value: 'public, s-maxage=60, stale-while-revalidate=600',
          },
        ],
      },
      {
        source: '/pos/login',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=60, stale-while-revalidate=600',
          },
          {
            key: 'CDN-Cache-Control',
            value: 'public, s-maxage=60, stale-while-revalidate=600',
          },
          {
            key: 'Vercel-CDN-Cache-Control',
            value: 'public, s-maxage=60, stale-while-revalidate=600',
          },
        ],
      },
    ];
  },
  // 勿將 @prisma/client 打包進 server action，否則 schema 更新後仍會 Unknown argument
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client'],
    optimizePackageImports: ['lucide-react', 'recharts', 'date-fns'],
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

export default nextConfig;
