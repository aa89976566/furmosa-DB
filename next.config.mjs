/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 勿將 @prisma/client 打包進 server action，否則 schema 更新後仍會 Unknown argument
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client'],
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

export default nextConfig;
