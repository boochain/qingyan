import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { useLayoutEffect, useState } from "react";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { Shell } from "@/components/shell";
import { THEME_BOOT, type Theme } from "@/lib/qingyan/theme";
import { Toaster } from "sonner";
import appCss from "../styles.css?url";

const APP_NAME = "青砚";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      { name: "description", content: "自托管刷题室。题库、错题本、试卷，以及给 AI agent 用的同一套编辑协议。" },
      { name: "theme-color", content: "#7ecfff" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
  }),
  component: () => (
    <html lang="zh-CN" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>
        <PreviewHostBridge />
        <AuthProvider>
          <Shell>
            <Outlet />
          </Shell>
        </AuthProvider>
        <ThemeToaster />
        <Scripts />
      </body>
    </html>
  ),
});

function ThemeToaster() {
  const [theme, setTheme] = useState<Theme>("light");
  useLayoutEffect(() => {
    const read = () => setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
    read();
    window.addEventListener("qingyan-theme", read);
    return () => window.removeEventListener("qingyan-theme", read);
  }, []);
  return <Toaster theme={theme} position="top-center" />;
}
