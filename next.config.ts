import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Emit standalone output for self-hosted Docker deployments (see Dockerfile).
  // On Vercel this flag is ignored, so it's safe to keep off by default.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,

  // Turbopack config required alongside webpack config in Next.js 16
  turbopack: {
    resolveAlias: {
      "@generated": path.resolve(__dirname, "generated"),
      "@generated/prisma/client": path.resolve(__dirname, "src/lib/prisma-types.ts"),
    },
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "placehold.co",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
      {
        protocol: "https",
        hostname: "*.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "*.r2.cloudflarestorage.com",
      },
      {
        protocol: "https",
        hostname: "*.cloudflarestorage.com",
      },
      {
        protocol: "https",
        hostname: "*.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "*.discordapp.com",
      },
      {
        protocol: "https",
        hostname: "cdn.discordapp.com",
      },
      {
        protocol: "https",
        hostname: "i.ibb.co",
      },
      {
        protocol: "https",
        hostname: "*.imgur.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
      {
        protocol: "https",
        hostname: "**.picsum.photos",
      },
    ],
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Enable image optimization for all hosts
    unoptimized: process.env.NODE_ENV === "development",
  },

  // Compress responses with gzip/brotli
  compress: true,

  // Enable React strict mode for development
  reactStrictMode: true,

  // Powered-by header removal
  poweredByHeader: false,

  // Keep pdfkit as external module so __dirname resolves correctly
  serverExternalPackages: ["pdfkit"],

  // Experimental optimizations
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "framer-motion",
      "react-icons",
      "@radix-ui/react-icons",
    ],
    // Server Actions body size limit
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },

  // Include pdfkit font files in serverless function bundles (Vercel)
  outputFileTracingIncludes: {
    "/api/**/*": ["./node_modules/pdfkit/js/data/**/*.afm"],
  },

  // Production source maps (disabled for better performance)
  productionBrowserSourceMaps: false, // Disable to reduce bundle size

  // Webpack configuration
  webpack: (config, { dev, isServer }) => {
    // Alias @generated to the generated Prisma client directory
    config.resolve.alias = {
      ...config.resolve.alias,
      "@generated": path.resolve(__dirname, "generated"),
      "@generated/prisma/client": path.resolve(__dirname, "src/lib/prisma-types.ts"),
    };

    // Optimize bundle in production
    if (!dev && !isServer) {
      // Enable tree-shaking for specific packages
      config.optimization = {
        ...config.optimization,
        usedExports: true,
        sideEffects: false,
        minimize: true,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
            // Vendor chunk for node_modules
            vendor: {
              name: 'vendor',
              chunks: 'all',
              test: /node_modules/,
              priority: 20,
            },
            // Common chunk for shared code
            common: {
              name: 'common',
              minChunks: 2,
              chunks: 'all',
              priority: 10,
              reuseExistingChunk: true,
              enforce: true,
            },
            // Framer Motion in its own chunk (it's large)
            framerMotion: {
              name: 'framer-motion',
              test: /[\\/]node_modules[\\/]framer-motion[\\/]/,
              chunks: 'all',
              priority: 40,
              enforce: true,
            },
            // React Hook Form separate chunk
            reactHookForm: {
              name: 'react-hook-form',
              test: /[\\/]node_modules[\\/]react-hook-form[\\/]/,
              chunks: 'all',
              priority: 35,
              enforce: true,
            },
            // Lucide icons separate chunk
            lucideReact: {
              name: 'lucide-react',
              test: /[\\/]node_modules[\\/]lucide-react[\\/]/,
              chunks: 'all',
              priority: 35,
              enforce: true,
            },
            // Zustand separate chunk
            zustand: {
              name: 'zustand',
              test: /[\\/]node_modules[\\/]zustand[\\/]/,
              chunks: 'all',
              priority: 35,
              enforce: true,
            },
          },
        },
      };
    }

    // Ignore native modules that aren't needed
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "better-sqlite3": false,
      "@prisma/adapter-better-sqlite3": false,
    };

    return config;
  },

  // Headers for security and caching
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        {
          key: "X-Content-Type-Options",
          value: "nosniff",
        },
        {
          key: "X-Frame-Options",
          value: "DENY",
        },
        {
          key: "X-XSS-Protection",
          value: "1; mode=block",
        },
        {
          key: "Referrer-Policy",
          value: "strict-origin-when-cross-origin",
        },
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
        },
        {
          key: "Cross-Origin-Opener-Policy",
          value: "same-origin",
        },
        {
          key: "Cross-Origin-Resource-Policy",
          value: "same-origin",
        },
        {
          key: "X-Permitted-Cross-Domain-Policies",
          value: "none",
        },
        {
          key: "Content-Security-Policy",
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com https://vercel.live",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob: https://placehold.co https://*.supabase.co https://*.amazonaws.com https://*.r2.cloudflarestorage.com https://*.cloudflarestorage.com https://*.cloudinary.com https://*.discordapp.com https://cdn.discordapp.com https://i.ibb.co https://*.imgur.com https://images.unsplash.com https://picsum.photos",
            "font-src 'self'",
            "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://va.vercel-scripts.com",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "object-src 'none'",
            "form-action 'self'",
            "upgrade-insecure-requests",
          ].join("; "),
        },
        {
          key: "Strict-Transport-Security",
          value: "max-age=31536000; includeSubDomains; preload",
        },
        {
          key: "X-DNS-Prefetch-Control",
          value: "on",
        },
      ],
    },
    {
      source: "/api/(.*)",
      headers: [
        {
          key: "Cache-Control",
          value: "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
        {
          key: "Pragma",
          value: "no-cache",
        },
      ],
    },
    {
      source: "/_next/static/(.*)",
      headers: [
        {
          key: "Cache-Control",
          value: "public, max-age=31536000, immutable",
        },
      ],
    },
    {
      source: "/images/(.*)",
      headers: [
        {
          key: "Cache-Control",
          value: "public, max-age=2592000, immutable",
        },
      ],
    },
    {
      source: "/fonts/(.*)",
      headers: [
        {
          key: "Cache-Control",
          value: "public, max-age=31536000, immutable",
        },
      ],
    },
    {
      source: "/manifest.json",
      headers: [
        {
          key: "Cache-Control",
          value: "public, max-age=86400",
        },
      ],
    },
    {
      source: "/sw.js",
      headers: [
        {
          key: "Cache-Control",
          value: "public, max-age=0, must-revalidate",
        },
      ],
    },
    {
      source: "/service-worker.js",
      headers: [
        {
          key: "Cache-Control",
          value: "public, max-age=0, must-revalidate",
        },
      ],
    },
    {
      source: "/offline.html",
      headers: [
        {
          key: "Cache-Control",
          value: "public, max-age=0, must-revalidate",
        },
      ],
    },
  ],

  // Redirects
  redirects: async () => [
    {
      source: "/shop",
      destination: "/products",
      permanent: true,
    },
    {
      source: "/store",
      destination: "/products",
      permanent: true,
    },
    {
      source: "/catalog",
      destination: "/products",
      permanent: true,
    },
    {
      source: "/cart",
      destination: "/checkout",
      permanent: true,
    },
  ],
};

export default nextConfig;
