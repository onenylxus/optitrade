import path from 'path';
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname, '../..'),
  },
  // Next.js 16 blocks dev-mode resources (HMR, etc.) for cross-origin requests
  // by default. When the app is reached via a public IP or a different host
  // name from the one Next.js was started on, the browser sends an Origin
  // header that Next.js doesn't recognize and refuses to serve the HMR
  // endpoint, which in turn prevents client-side hydration (the page renders
  // but buttons are dead). Allow the public host here. See:
  // https://nextjs.org/docs/app/api-reference/config/next-config-js/allowedDevOrigins
  //
  // Comma-separated list. Default is the production-style server's public IP;
  // teammates running `npx nx dev @optitrade/frontend` on localhost don't
  // need to set anything (localhost is allowed by default). Override via
  // NEXT_PUBLIC_ALLOWED_DEV_ORIGINS only if testing from another host.
  allowedDevOrigins: (process.env.NEXT_PUBLIC_ALLOWED_DEV_ORIGINS ?? '178.128.213.162')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};

export default nextConfig;
