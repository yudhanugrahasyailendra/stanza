import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { THEME_PREF_KEY, parseTheme, persistPreference, readStoredPreference } from "@/lib/preferences";

export type Theme = "light" | "dark" | "system";
interface ThemeContextType {
  theme: Theme;
  effectiveTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
  toggleTheme?: () => void;
  switchable: boolean;
}
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children, defaultTheme = "system", switchable = true, initialTheme }: { children: React.ReactNode; defaultTheme?: Theme; switchable?: boolean; initialTheme?: Theme }) {
  // First render must match the server, so no localStorage / matchMedia here.
  const [theme, setThemeState] = useState<Theme>(initialTheme ?? defaultTheme);
  const [systemDark, setSystemDark] = useState(false);
  useEffect(() => {
    // Users from before cookies existed only have localStorage: adopt it once.
    if (initialTheme === undefined) {
      const stored = parseTheme(readStoredPreference(THEME_PREF_KEY));
      if (stored) { setThemeState(stored); persistPreference(THEME_PREF_KEY, stored); }
    }
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!media) return;
    const update = () => setSystemDark(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, [initialTheme]);
  const effectiveTheme = theme === "system" ? (systemDark ? "dark" : "light") : theme;
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = effectiveTheme;
    root.dataset.themePreference = theme;
    root.classList.toggle("dark", effectiveTheme === "dark");
  }, [theme, effectiveTheme]);
  // Persist on explicit changes only; persisting from an effect would overwrite the stored choice with the default on mount.
  const setTheme = useCallback((next: Theme) => { setThemeState(next); persistPreference(THEME_PREF_KEY, next); }, []);
  const toggleTheme = useMemo(() => switchable ? () => setTheme(effectiveTheme === "dark" ? "light" : "dark") : undefined, [switchable, effectiveTheme, setTheme]);
  const value = useMemo(() => ({ theme, effectiveTheme, setTheme, toggleTheme, switchable }), [theme, effectiveTheme, setTheme, toggleTheme, switchable]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
