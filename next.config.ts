import type { NextConfig } from 'next';

const isGitHubPages = process.env.GITHUB_ACTIONS === 'true';
const repositoryName = 'solers-traffic-rush';
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? (isGitHubPages ? `/${repositoryName}` : '');

const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  basePath,
  assetPrefix: basePath ? `${basePath}/` : '',
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default nextConfig;
