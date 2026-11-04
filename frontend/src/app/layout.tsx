import type { Metadata } from "next";
import type { ReactNode } from "react";

import { SiteHeader } from "@/components/SiteHeader";
import { UserProvider } from "@/lib/user/UserProvider";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "小影素材工坊",
    template: "%s · 小影素材工坊",
  },
  description: "浏览模板、上传图片并提交素材制作任务。",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <UserProvider>
          <SiteHeader />
          {children}
        </UserProvider>
      </body>
    </html>
  );
}
