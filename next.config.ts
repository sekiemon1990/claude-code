import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "1",
});

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
      // Mercari
      { protocol: "https", hostname: "static.mercdn.net" },
      { protocol: "https", hostname: "assets.mercari-shops-static.com" },
      { protocol: "https", hostname: "u-static.mercdn.net" },
      // Yahoo Auctions
      { protocol: "https", hostname: "wing-auctions.c.yimg.jp" },
      { protocol: "https", hostname: "auc-pctr.c.yimg.jp" },
      { protocol: "https", hostname: "auctions.c.yimg.jp" },
      // Yahoo PayPay フリマ
      { protocol: "https", hostname: "item-shopping.c.yimg.jp" },
      // Jimoty
      { protocol: "https", hostname: "cdn.jmty.jp" },
      { protocol: "https", hostname: "img.jmty.jp" },
      { protocol: "https", hostname: "jmty.jp" },
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

export default withBundleAnalyzer(nextConfig);
