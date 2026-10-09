import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "@/index.css";
import { LANGUAGE_PREF_KEY, THEME_BOOT_SCRIPT, THEME_PREF_KEY, parseLanguage, parseTheme } from "@/lib/preferences";
import SiteShell from "@/components/SiteShell";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Stanza — Ruang untuk Kata",
  description: "Stanza — ruang tenang untuk menulis, membaca, dan berbagi puisi.",
  icons: { icon: "/stanza-mark.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#faf9f5",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Preferences are cookies so the server renders what the client will hydrate with.
  const store = await cookies();
  const language = parseLanguage(store.get(LANGUAGE_PREF_KEY)?.value);
  const theme = parseTheme(store.get(THEME_PREF_KEY)?.value);
  const explicitTheme = theme === "light" || theme === "dark" ? theme : undefined;

  return (
    <html
      lang={language ?? "id"}
      className={explicitTheme === "dark" ? "dark" : undefined}
      data-theme={explicitTheme}
      data-theme-preference={theme}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers initialLanguage={language} initialTheme={theme}>
          <SiteShell>{children}</SiteShell>
        </Providers>
      </body>
    </html>
  );
}
