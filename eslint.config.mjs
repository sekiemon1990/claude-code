import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "public/sw.js",
  ]),
  {
    rules: {
      // React 19 の厳格 hooks ルールは段階的に対処するため warning に
      // (既存コードは動作しているが、推奨ではないパターンに該当)
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/exhaustive-deps": "warn",
      // Next.js の <Image> 推奨は段階的に置換するため warning に
      "@next/next/no-img-element": "warn",
    },
  },
]);

export default eslintConfig;
