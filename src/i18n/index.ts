import en from "./en.json";

// Only English exists today, so this always resolves to it. When more
// locales are added, this is the one place that picks the active one —
// callers just import `strings`, never a specific locale file.
export const strings = en;
