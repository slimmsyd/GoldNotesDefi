import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Exclude packages with WASM/native dependencies from bundling
  serverExternalPackages: ['privacycash', '@lightprotocol/hasher.rs'],

  typescript: {
    // Allow production builds to successfully complete even with type errors
    ignoreBuildErrors: true,
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'qqevyxynqvoczpdunfji.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;
