import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Theme = "light" | "dark" | "system";
interface ThemeContextType {
  theme: Theme;
  effectiveTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
  toggleTheme?: () => void;
  switchable: boolean;
}
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children, defaultTheme = "system", switchable = true }: { children: React.ReactNode; defaultTheme?: Theme; switchable?: boolean }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const stored = localStorage.getItem("stanza-theme");
      return stored === "light" || stored === "dark" || stored === "system" ? stored : defaultTheme;
    } catch { return defaultTheme; }
  });
  const [systemDark, setSystemDark] = useState(() => typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-color-scheme: dark)").matches));
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!media) return;
    const update = () => setSystemDark(media.matches);
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);
  const effectiveTheme = theme === "system" ? (systemDark ? "dark" : "light") : theme;
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = effectiveTheme;
    root.dataset.themePreference = theme;
    root.classList.toggle("dark", effectiveTheme === "dark");
    try { localStorage.setItem("stanza-theme", theme); } catch {}
  }, [theme, effectiveTheme]);
  const setTheme = useCallback((next: Theme) => setThemeState(next), []);
  const toggleTheme = switchable ? () => setThemeState(current => current === "dark" ? "light" : "dark") : undefined;
  const value = useMemo(() => ({ theme, effectiveTheme, setTheme, toggleTheme, switchable }), [theme, effectiveTheme, setTheme, toggleTheme, switchable]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
