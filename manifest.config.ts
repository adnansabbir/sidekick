import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
    manifest_version: 3,
    name: "Sidekick",
    version: "0.1.0",
    description:
        "Your AI sidekick for any website — summarize, chat, and take action.",
    permissions: ["sidePanel", "scripting"],
    host_permissions: ["<all_urls>"],
    icons: {
        16: "src/icons/icon-16.png",
        32: "src/icons/icon-32.png",
        48: "src/icons/icon-48.png",
        128: "src/icons/icon-128.png",
    },
    action: {
        default_icon: {
            16: "src/icons/icon-16.png",
            32: "src/icons/icon-32.png",
            48: "src/icons/icon-48.png",
            128: "src/icons/icon-128.png",
        },
    },
    background: {
        service_worker: "src/background.ts",
    },
    // Separate UI to ask for permission
    // Asking permission on the Sidepanel does not work on chrome
    options_ui: {
        page: "src/permission.html",
        open_in_tab: true,
    },
});
