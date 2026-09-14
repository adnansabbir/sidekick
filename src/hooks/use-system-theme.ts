import { useEffect } from "react";

// Toggles .dark on <html> from prefers-color-scheme, live.
export function useSystemTheme() {
    useEffect(() => {
        const media = window.matchMedia("(prefers-color-scheme: dark)");
        const applyTheme = (source: MediaQueryList | MediaQueryListEvent) => {
            document.documentElement.classList.toggle("dark", source.matches);
        };
        applyTheme(media);
        media.addEventListener("change", applyTheme);
        return () => media.removeEventListener("change", applyTheme);
    }, []);
}
