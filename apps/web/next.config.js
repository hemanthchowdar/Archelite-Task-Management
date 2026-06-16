/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@workspace/database", "@workspace/validation"],
  images: {
    domains: ["s3.amazonaws.com"],
  },
};

module.exports = nextConfig;
