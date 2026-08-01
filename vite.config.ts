import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import manifest from "./manifest.config.ts";

export default defineConfig({
    plugins: [tailwindcss(), crx({ manifest })],
});
