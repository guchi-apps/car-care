// @ts-check
// .mjs にしているのは、本番の `next start` が設定ファイルをトランスパイルするためだけに
// SWC のネイティブバイナリを読み込み、常駐メモリとスレッドが増えるのを避けるため（#168）。
// TypeScript（next.config.ts）に戻さない。型は JSDoc で付け、tsconfig.json の include で
// tsc --noEmit の対象にしている。
import path from "path";

const projectRoot = path.resolve(process.cwd());
const generatedClient = path.join(projectRoot, "generated/client.ts");

const devAllowedOrigins = [
  "*.sslip.io",
  ...(process.env.DEV_ALLOWED_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean) ?? []),
];

/** @type {import("next").NextConfig} */
const nextConfig = {
  turbopack: {
    root: projectRoot,
  },
  allowedDevOrigins: devAllowedOrigins,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
  async headers() {
    const swHeaders = [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
    ];

    if (process.env.NODE_ENV !== "development") {
      return swHeaders;
    }

    return [
      {
        source: "/:path*",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
      ...swHeaders,
    ];
  },
  webpack: (config, { dev }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@prisma/client$": generatedClient,
    };

    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        poll: 1000,
        ignored: ["**/node_modules/**", "**/.git/**"],
      };
    }

    return config;
  },
};

export default nextConfig;
