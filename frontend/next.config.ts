import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 交付 M10 使用 standalone 产物制作精简运行镜像。
  output: "standalone",
  reactStrictMode: true,
};

export default nextConfig;
