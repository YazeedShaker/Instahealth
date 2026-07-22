import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Workspace packages ship TypeScript source — Next transpiles them.
  transpilePackages: ['@instahealth/core', '@instahealth/design-tokens'],
}

export default nextConfig
