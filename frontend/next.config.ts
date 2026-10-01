import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Requis pour le Dockerfile multi-stage (production standalone)
  output: 'standalone',

  // Variables d'environnement exposées côté client
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  },

  // Ancienne adresse de la liste des événements : liens déjà partagés
  // redirigés (filtres conservés, la requête suit la redirection).
  async redirects() {
    return [{ source: '/catalogue', destination: '/evenements', permanent: true }];
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
