/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  // 让 Next 不把 Prisma 客户端 bundle 进 server chunk，保留对 native 引擎的 require
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
};
export default nextConfig;
