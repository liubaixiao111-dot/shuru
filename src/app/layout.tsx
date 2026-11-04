import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "书入",
  description: "你来定方向，AI 来写好。一本跟着你的想法走的小说。",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f7f3ea" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="mx-auto min-h-screen max-w-2xl px-4 pb-16">{children}</div>
      </body>
    </html>
  );
}
