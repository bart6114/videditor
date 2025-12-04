// Fix EMFILE "too many open files" error on Fly.io builds
const fs = require("fs");
const gracefulFs = require("graceful-fs");
gracefulFs.gracefulify(fs);

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:8787'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'https',
        hostname: 'img.clerk.com',
      },
      {
        protocol: 'https',
        hostname: '**.cloudflarestream.com',
      },
      {
        protocol: 'https',
        hostname: '**.r2.cloudflarestorage.com',
      },
      {
        protocol: 'https',
        hostname: '**.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: '**.ggpht.com',
      },
      {
        protocol: 'https',
        hostname: 'fly.storage.tigris.dev',
      },
      {
        // Tigris CDN/accelerated endpoints (e.g., t3.storage.dev)
        protocol: 'https',
        hostname: '**.storage.dev',
      },
    ],
  },
  env: {
    NEXT_PUBLIC_APP_URL: APP_URL,
    NEXT_PUBLIC_WORKER_URL: WORKER_URL,
  },
  // Ensure compatibility with Cloudflare Pages
  output: 'standalone',
}

module.exports = nextConfig
