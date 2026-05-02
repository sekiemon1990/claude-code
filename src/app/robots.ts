import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  // 社内ツールなのでクローラーを基本不許可。
  // 内部 API や認証配下を不用意にインデックスされないように。
  return {
    rules: [
      {
        userAgent: "*",
        disallow: "/",
      },
    ],
  };
}
