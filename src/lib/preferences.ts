import type { Language } from "@/contexts/LanguageContext";
import type { Theme } from "@/contexts/ThemeContext";

// Language and theme live in cookies (not just localStorage) so the Next.js layout can
// read them on the server and render the same markup the client hydrates with.
export const LANGUAGE_PREF_KEY = "stanza-language";
export const THEME_PREF_KEY = "stanza-theme";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export const parseLanguage = (value?: string | null): Language | undefined => (value === "id" || value === "en" ? value : undefined);
export const parseTheme = (value?: string | null): Theme | undefined => (value === "light" || value === "dark" || value === "system" ? value : undefined);

export function readStoredPreference(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}

export function persistPreference(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch {}
  try { document.cookie = `${key}=${value}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax`; } catch {}
}

// Runs in <head> before first paint so "system" and legacy localStorage themes never flash.
export const THEME_BOOT_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_PREF_KEY}=([^;]*)/);var p=m?m[1]:localStorage.getItem("${THEME_PREF_KEY}");if(p!=="light"&&p!=="dark")p="system";var d=p==="dark"||(p==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.dataset.theme=d?"dark":"light";r.dataset.themePreference=p;r.classList.toggle("dark",d)}catch(e){}})();`;
