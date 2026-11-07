import type { NextConfig } from "next";

const apiHost = process.env.API_HOST ?? "127.0.0.1";
const apiPort = process.env.API_PORT ?? "3001";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  agentRules: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ddragon.leagueoflegends.com",
        pathname: "/cdn/**",
      },
    ],
  },
  // api は別プロセス。ブラウザは同一オリジンの /api だけを叩き、CORS は開けない。
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `http://${apiHost}:${apiPort}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
