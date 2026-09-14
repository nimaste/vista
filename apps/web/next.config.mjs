/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  reactStrictMode: true,
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
    instrumentationHook: true,
    serverComponentsExternalPackages: ["@node-rs/argon2"],
  },
};

export default nextConfig;
