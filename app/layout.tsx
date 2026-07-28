import type { Metadata } from "next";
import { headers } from "next/headers";
import { AppShell } from "@/components/app-shell";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const metadataBase = new URL(`${protocol}://${host}`);
  const socialImage = new URL("/og.png", metadataBase).toString();

  return {
    metadataBase,
    title: {
      default: "Shadowing Coach 日本語",
      template: "%s · Shadowing Coach 日本語",
    },
    description: "本地优先的日语跟读、听写、录音对比与表达复习工具。",
    applicationName: "Shadowing Coach 日本語",
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      title: "Shadowing Coach",
      statusBarStyle: "default",
    },
    formatDetection: {
      telephone: false,
    },
    icons: {
      icon: "/icon-192.png",
      apple: "/icon-192.png",
    },
    openGraph: {
      type: "website",
      locale: "zh_CN",
      siteName: "Shadowing Coach 日本語",
      title: "Shadowing Coach 日本語",
      description: "听清每一句，说出自己的声音。",
      images: [
        {
          url: socialImage,
          width: 1715,
          height: 910,
          alt: "Shadowing Coach 日本語",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: "Shadowing Coach 日本語",
      description: "听清每一句，说出自己的声音。",
      images: [socialImage],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <PwaRegister />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
