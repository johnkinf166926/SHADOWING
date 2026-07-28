import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Shadowing Coach 日本語",
    short_name: "Shadowing Coach",
    description: "日语跟读、听写、录音对比与表达复习。",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f5f3ed",
    theme_color: "#db5b3d",
    lang: "zh-CN",
    orientation: "any",
    categories: ["education", "productivity"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "开始今日学习",
        short_name: "今日学习",
        url: "/units",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
      {
        name: "重要表达",
        short_name: "表达",
        url: "/expressions",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
