import type { NextConfig } from "next";
const config: NextConfig = {
  ...(process.env.STATIC_PREVIEW === "1" ? { output: "export" } : {}),
  images: { unoptimized: true },
  trailingSlash: true,
};
export default config;
