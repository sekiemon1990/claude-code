import type { NextConfig } from "next";

// 全レスポンスに付与するセキュリティヘッダ
// CSP は既存の inline scripts (theme init) と相性が悪いので段階的に対応
const securityHeaders = [
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value:
      // 音声入力はマイク許可が必要 / その他は不要
      "camera=(), microphone=(self), geolocation=(), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" },
    ],
  },
  async headers() {
    return [
      {
        // 全てのルートに適用
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
