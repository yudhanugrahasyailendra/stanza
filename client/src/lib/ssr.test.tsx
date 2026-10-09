import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import Providers from "../../../app/providers";
import { useAuth } from "@/_core/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { THEME_BOOT_SCRIPT, parseLanguage, parseTheme } from "./preferences";

function Probe() {
  const { t, language } = useLanguage();
  const { theme } = useTheme();
  const { user, loading } = useAuth();
  return <p>{`${language}|${t("nav.explore")}|${theme}|${user ? "user" : "guest"}|${loading ? "loading" : "idle"}`}</p>;
}

describe("Providers server render (no window, no localStorage)", () => {
  it("renders with server-supplied preferences", () => {
    expect(typeof window).toBe("undefined");
    const html = renderToString(<Providers initialLanguage="en" initialTheme="dark"><Probe /></Providers>);
    expect(html).toContain("en|Explore|dark|guest|loading");
  });

  it("falls back to Indonesian and the system theme when no cookie exists", () => {
    const html = renderToString(<Providers><Probe /></Providers>);
    expect(html).toContain("id|Jelajah|system|guest|loading");
  });
});

describe("preference parsing", () => {
  it("accepts only known values", () => {
    expect(parseLanguage("en")).toBe("en");
    expect(parseLanguage("fr")).toBeUndefined();
    expect(parseLanguage(null)).toBeUndefined();
    expect(parseTheme("system")).toBe("system");
    expect(parseTheme("<script>")).toBeUndefined();
  });
});

describe("theme boot script", () => {
  const run = (cookie: string, stored: string | null, prefersDark: boolean) => {
    const dataset: Record<string, string> = {};
    const toggles: Array<[string, boolean]> = [];
    const document = { cookie, documentElement: { dataset, classList: { toggle: (name: string, on: boolean) => toggles.push([name, on]) } } };
    const window = { matchMedia: () => ({ matches: prefersDark }) };
    new Function("document", "window", "localStorage", THEME_BOOT_SCRIPT)(document, window, { getItem: () => stored });
    return { dataset, toggles };
  };

  it("prefers the cookie, then legacy localStorage, then the system setting", () => {
    expect(run("a=1; stanza-theme=dark", "light", false).dataset).toMatchObject({ theme: "dark", themePreference: "dark" });
    expect(run("", "dark", false).dataset).toMatchObject({ theme: "dark", themePreference: "dark" });
    expect(run("", null, true).dataset).toMatchObject({ theme: "dark", themePreference: "system" });
    expect(run("", null, false).dataset).toMatchObject({ theme: "light", themePreference: "system" });
    expect(run("stanza-theme=dark", null, false).toggles).toEqual([["dark", true]]);
  });

  it("treats an unknown stored value as system and never throws", () => {
    expect(run("stanza-theme=evil", null, false).dataset.themePreference).toBe("system");
    expect(() => new Function("document", "window", "localStorage", THEME_BOOT_SCRIPT)({}, {}, {})).not.toThrow();
  });
});
