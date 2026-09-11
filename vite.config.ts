import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import manifest from "./manifest.config.ts";

export default defineConfig({
    plugins: [react(), tailwindcss(), crx({ manifest })],
    build: {
        rollupOptions: {
            // Not referenced in the manifest, so declared here to get bundled.
            input: {
                sidepanel: fileURLToPath(
                    new URL("./src/sidepanel.html", import.meta.url),
                ),
            },
        },
    },
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
        },
    },
});
