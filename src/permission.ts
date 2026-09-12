import { strings } from "@/i18n";
import "./sidepanel.css";

// The side panel can't raise a mic prompt; this page runs in a real tab, so it
// can. The grant is per-origin, so the panel inherits it afterwards.

const t = strings.permission;

document.documentElement.classList.toggle(
    "dark",
    window.matchMedia("(prefers-color-scheme: dark)").matches,
);

const title = document.getElementById("title")!;
const description = document.getElementById("description")!;
const grantButton = document.getElementById("grant")!;
const status = document.getElementById("status")!;

title.textContent = t.micTitle;
description.textContent = t.micDescription;
grantButton.textContent = t.micGrant;

grantButton.addEventListener("click", async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
        });
        stream.getTracks().forEach((track) => track.stop());
        status.textContent = t.micGranted;
    } catch (error) {
        const err = error as Error;
        status.textContent = `${t.micDenied} (${err.name}: ${err.message})`;
    }
});
