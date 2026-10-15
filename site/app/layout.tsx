import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "此刻 LIVE — 和朋友一起在場",
  description: "用一支手機開播，透過專屬邀請連結和朋友分享此刻，觀看直播並即時聊天。",
  referrer: "no-referrer",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body className="antialiased">{children}</body>
    </html>
  );
}
