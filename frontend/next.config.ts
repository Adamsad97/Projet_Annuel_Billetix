import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Requis pour le Dockerfile multi-stage (production standalone)
  output: 'standalone',

  // Variables d'environnement exposées côté client
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },

  // Optimisation des images
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '9000',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
