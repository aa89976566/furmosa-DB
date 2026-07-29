/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: '/supply', destination: '/jar-exchange/manage?tab=codes', permanent: true },
      { source: '/supply/codes', destination: '/jar-exchange/manage?tab=codes', permanent: true },
      { source: '/supply/members', destination: '/jar-exchange/members', permanent: true },
      { source: '/supply/rewards', destination: '/jar-exchange/manage?tab=rewards', permanent: true },
      { source: '/supply/:path*', destination: '/jar-exchange/manage?tab=codes', permanent: true },
    ];
  },
  // 勿將 @prisma/client 打包進 server action，否則 schema 更新後仍會 Unknown argument
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs'],
    optimizePackageImports: ['lucide-react', 'recharts', 'date-fns'],
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

export default nextConfig;
